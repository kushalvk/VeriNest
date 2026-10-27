const mongoose = require('mongoose');
const Property = require('../models/Property');
const User = require('../models/User');
const { uploadToCloudinary, FOLDERS } = require('../services/cloudinaryService');
const { getDemoUserIds } = require('../services/demoService');
const { matchesSignature } = require('../utils/fileSignature');
const { extractText, parseTaxBillFields } = require('../services/ocrService');
const auditService = require('../services/auditService');
const {
  MAX_ATTEMPTS,
  ALLOWED_BILL_MIME,
  REVERIFY_ON_ADDRESS_CHANGE,
  TAX_BILL_OCR_LANG,
  buildAutoChecks,
} = require('../services/propertyVerificationService');

const TAX_BILL_FOLDER = FOLDERS.taxBills || `${FOLDERS.properties}-tax-bills`;

const ADDRESS_PATHS = [
  'address.addressLine',
  'address.city',
  'address.state',
  'address.pincode',
];

// Tenant-facing queries: expose only the verification status/date, never the
// bill, OCR text or review internals.
const PUBLIC_HIDE =
    '-verification.taxBill -verification.ocr -verification.autoChecks -verification.reviewedBy -verification.rejectionReason -verification.attempts';

// landlordId always comes from the JWT — strip anything the client sent.
// Also strips every "verification*" key (including dotted paths) so a client
// can never self-verify via mass assignment.
const sanitizeBody = (body = {}) => {
  const data = { ...body };
  delete data.landlordId;
  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;
  Object.keys(data).forEach((key) => {
    if (key === 'verification' || key.startsWith('verification.')) {
      delete data[key];
    }
  });
  return data;
};

// Shapes a single property for a viewer: 'admin' (everything), 'owner'
// (own status + bill + rejection reason, no OCR internals) or 'public'.
const shape = (property, viewer) => {
  const obj = property.toObject ? property.toObject() : { ...property };
  if (viewer === 'admin' || !obj.verification) return obj;
  delete obj.verification.ocr;
  delete obj.verification.autoChecks;
  if (viewer !== 'owner') {
    delete obj.verification.taxBill;
    delete obj.verification.reviewedBy;
    delete obj.verification.rejectionReason;
    delete obj.verification.attempts;
  }
  return obj;
};

const getLandlordName = async (userId) => {
  const user = await User.findById(userId).select('fullName');
  return user?.fullName || '';
};

// POST /api/properties
const createProperty = async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body);

    const missing = [];
    if (!data.title) missing.push('title');
    if (data.rent === undefined || data.rent === null || data.rent === '')
      missing.push('rent');
    if (!data.address?.city) missing.push('address.city');
    if (missing.length) {
      return res
          .status(422)
          .json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    // verification.status defaults to 'not_submitted' — invisible to tenants
    // until a tax bill is uploaded and an admin verifies it.
    const property = await Property.create({
      ...data,
      landlordId: req.user.id,
    });
    return res.status(201).json({ property: shape(property, 'owner') });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/properties/:id  (ownership middleware already loaded req.property)
const updateProperty = async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body);
    req.property.set(data);

    // A verified listing whose address changed no longer matches the bill
    // that was verified → send it back through review.
    let reverification = false;
    if (
        REVERIFY_ON_ADDRESS_CHANGE &&
        req.property.verification?.status === 'verified' &&
        ADDRESS_PATHS.some((p) => req.property.isModified(p))
    ) {
      reverification = true;
      const hasBill = !!req.property.verification?.taxBill?.url;
      req.property.set(
          'verification.status',
          hasBill ? 'pending' : 'not_submitted'
      );
      req.property.set('verification.grandfathered', false);
      req.property.set('verification.reviewedBy', undefined);
      req.property.set('verification.reviewedAt', undefined);
      req.property.set('verification.rejectionReason', undefined);
      if (hasBill) {
        const landlordName = await getLandlordName(req.user.id);
        req.property.set(
            'verification.autoChecks',
            await buildAutoChecks({
              property: req.property,
              landlordName,
              ocr: req.property.verification.ocr,
            })
        );
      }
    }

    await req.property.save();
    return res
        .status(200)
        .json({ property: shape(req.property, 'owner'), reverification });
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/properties/:id — soft delete only
const deleteProperty = async (req, res, next) => {
  try {
    req.property.status = 'inactive';
    await req.property.save();
    return res.status(200).json({
      message: 'Property deactivated',
      property: shape(req.property, 'owner'),
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/properties/:id — public for VERIFIED listings; the owner and admins
// can also open unverified ones (optionalAuth populates req.user if a token
// is sent).
const getPropertyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const isAdmin = req.user?.role === 'admin';
    const isOwner =
        !!req.user?.id && String(property.landlordId) === String(req.user.id);
    const isVerified = property.verification?.status === 'verified';

    if (!isVerified && !isOwner && !isAdmin) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const viewer = isAdmin ? 'admin' : isOwner ? 'owner' : 'public';
    return res.status(200).json({ property: shape(property, viewer) });
  } catch (err) {
    return next(err);
  }
};

// POST /api/properties/:id/images
const uploadPropertyImages = async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res
          .status(422)
          .json({ error: 'At least one image is required (multipart field "images")' });
    }

    // Validate every file before ANY Cloudinary call — all or nothing.
    for (const file of files) {
      if (!matchesSignature(file.buffer, file.mimetype)) {
        return res.status(400).json({
          error: `Unsupported file type: "${file.originalname}" content does not match an allowed format (JPG, PNG).`,
        });
      }
    }

    const uploaded = await Promise.all(
        files.map((file) => uploadToCloudinary(file.buffer, FOLDERS.properties))
    );

    req.property.images.push(...uploaded);
    await req.property.save();

    return res.status(200).json({ property: shape(req.property, 'owner') });
  } catch (err) {
    return next(err);
  }
};

// POST /api/properties/:id/tax-bill  (multipart field "taxBill", owner only)
// Upload → magic-byte check → Cloudinary → OCR (best effort) → advisory
// auto-checks → status "pending" for admin review. Also used to re-upload
// after a rejection.
const uploadTaxBill = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res
          .status(422)
          .json({ error: 'A tax bill file is required (multipart field "taxBill")' });
    }

    const current = req.property.verification || {};
    if (current.status === 'verified') {
      return res
          .status(409)
          .json({ error: 'This property is already verified' });
    }
    if ((current.attempts || 0) >= MAX_ATTEMPTS) {
      return res.status(403).json({
        error:
            'Maximum tax bill submissions reached for this property. Please contact support.',
      });
    }

    // Never trust extension/mimetype alone.
    if (
        !ALLOWED_BILL_MIME.includes(file.mimetype) ||
        !matchesSignature(file.buffer, file.mimetype)
    ) {
      return res.status(400).json({
        error: 'Unsupported file type: the tax bill must be a JPG or PNG image.',
      });
    }

    const uploaded = await uploadToCloudinary(file.buffer, TAX_BILL_FOLDER);

    // OCR is best effort — a failure must not block submission; the admin
    // reviews the image manually either way.
    let ocr = { status: 'failed', rawText: '', confidence: 0, extracted: {} };
    try {
      const { rawText, confidence } = await extractText(
          uploaded.url,
          TAX_BILL_OCR_LANG
      );
      ocr = {
        status: 'done',
        rawText: rawText.slice(0, 8000),
        confidence,
        extracted: parseTaxBillFields(rawText),
      };
    } catch (err) {
      console.warn(`[property] Tax bill OCR failed: ${err.message}`);
    }

    const landlordName = await getLandlordName(req.user.id);
    const autoChecks = await buildAutoChecks({
      property: req.property,
      landlordName,
      ocr,
    });

    req.property.set('verification.taxBill', {
      publicId: uploaded.publicId,
      url: uploaded.url,
      uploadedAt: new Date(),
    });
    req.property.set('verification.ocr', ocr);
    req.property.set('verification.autoChecks', autoChecks);
    req.property.set('verification.attempts', (current.attempts || 0) + 1);
    req.property.set('verification.grandfathered', false);
    req.property.set('verification.status', 'pending');
    req.property.set('verification.rejectionReason', undefined);
    req.property.set('verification.reviewedBy', undefined);
    req.property.set('verification.reviewedAt', undefined);
    await req.property.save();

    try {
      await auditService.logAction({
        userId: req.user.id,
        action: 'property_tax_bill_upload',
        module: 'properties',
        req,
      });
    } catch (err) {
      console.error(`[property] Audit log creation failed: ${err.message}`);
    }

    return res.status(200).json({ property: shape(req.property, 'owner') });
  } catch (err) {
    return next(err);
  }
};

// GET /api/properties/mine — the landlord's own listings, ALL statuses
// (public search deliberately exposes only verified+available ones; owners
// need to see occupied/inactive/unverified listings too).
const getMyProperties = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = { landlordId: req.user.id };
    const [properties, total] = await Promise.all([
      Property.find(filter)
          // owners see status, bill and rejection reason — not OCR internals
          .select('-verification.ocr -verification.autoChecks')
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
      Property.countDocuments(filter),
    ]);

    return res.status(200).json({
      properties,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/properties — public search with filters + pagination
const searchProperties = async (req, res, next) => {
  try {
    const { city, minRent, maxRent, bedrooms, furnishing, propertyType } =
        req.query;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    // Cap at 50 regardless of what the client asks for.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

    const parseNonNegative = (value, name) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) {
        const err = new Error(`${name} must be a non-negative number`);
        err.status = 422;
        throw err;
      }
      return n;
    };

    // Never client-overridable: only available AND admin-verified listings
    // are searchable.
    const filter = { status: 'available', 'verification.status': 'verified' };

    // The demo landlord's seeded listings are throwaway fixtures rebuilt on
    // every demo sign-in — keep them out of the public search entirely. The
    // demo landlord still sees them under /properties/mine, and they stay
    // reachable by id so the seeded applications keep linking somewhere.
    const demoUserIds = await getDemoUserIds();
    if (demoUserIds.length) {
      filter.landlordId = { $nin: demoUserIds };
    }

    if (city) {
      // String() guards against array/object query params (?city=a&city=b)
      filter['address.city'] = { $regex: escapeRegex(String(city)), $options: 'i' };
    }
    if (minRent !== undefined || maxRent !== undefined) {
      filter.rent = {};
      if (minRent !== undefined)
        filter.rent.$gte = parseNonNegative(minRent, 'minRent');
      if (maxRent !== undefined)
        filter.rent.$lte = parseNonNegative(maxRent, 'maxRent');
      if (
          filter.rent.$gte !== undefined &&
          filter.rent.$lte !== undefined &&
          filter.rent.$gte > filter.rent.$lte
      ) {
        return res
            .status(422)
            .json({ error: 'minRent cannot be greater than maxRent' });
      }
    }
    if (bedrooms !== undefined) {
      filter.bedrooms = parseNonNegative(bedrooms, 'bedrooms');
    }
    if (furnishing) filter.furnishing = furnishing;
    if (propertyType) filter.propertyType = propertyType;

    const [results, total] = await Promise.all([
      Property.find(filter)
          .select(PUBLIC_HIDE)
          // _id tiebreaker keeps pagination stable when createdAt values tie
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
      Property.countDocuments(filter),
    ]);

    return res.status(200).json({
      results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    if (err.status === 422) {
      return res.status(422).json({ error: err.message });
    }
    return next(err);
  }
};

module.exports = {
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyById,
  getMyProperties,
  uploadPropertyImages,
  uploadTaxBill,
  searchProperties,
};