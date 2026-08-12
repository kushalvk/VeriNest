const mongoose = require('mongoose');
const Property = require('../models/Property');
const { uploadToCloudinary, FOLDERS } = require('../services/cloudinaryService');
const { getDemoUserIds } = require('../services/demoService');
const { matchesSignature } = require('../utils/fileSignature');

// landlordId always comes from the JWT — strip anything the client sent.
const sanitizeBody = (body = {}) => {
  const data = { ...body };
  delete data.landlordId;
  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;
  return data;
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

    const property = await Property.create({
      ...data,
      landlordId: req.user.id,
    });
    return res.status(201).json({ property });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/properties/:id  (ownership middleware already loaded req.property)
const updateProperty = async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body);
    req.property.set(data);
    await req.property.save();
    return res.status(200).json({ property: req.property });
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
      property: req.property,
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/properties/:id — public
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
    return res.status(200).json({ property });
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

    return res.status(200).json({ property: req.property });
  } catch (err) {
    return next(err);
  }
};

// GET /api/properties/mine — the landlord's own listings, ALL statuses
// (public search deliberately exposes only "available" ones; owners need
// to see occupied/inactive listings too).
const getMyProperties = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = { landlordId: req.user.id };
    const [properties, total] = await Promise.all([
      Property.find(filter)
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

    // Never client-overridable: only available listings are searchable.
    const filter = { status: 'available' };

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
  searchProperties,
};
