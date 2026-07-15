const crypto = require('crypto');
const mongoose = require('mongoose');
const Agreement = require('../models/Agreement');
const Application = require('../models/Application');
const Property = require('../models/Property');
const User = require('../models/User');
const { generateAgreementPdf, stampSignature } = require('../services/agreementPdfService');
const { uploadToCloudinary, FOLDERS } = require('../services/cloudinaryService');
const notificationService = require('../services/notificationService');
const { matchesSignature } = require('../utils/fileSignature');

// Side effects must never fail the primary action.
const notifySafely = async (payload) => {
  try {
    await notificationService.createNotification(payload);
  } catch (err) {
    console.error(`[agreements] Notification creation failed: ${err.message}`);
  }
};

const MAX_SIGNATURE_BYTES = 1024 * 1024; // 1MB

const newAgreementNumber = () =>
  `AGR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/**
 * Validates a client-supplied signature: plausible base64 (data-URI prefix
 * optional) decoding to a real PNG/JPEG under 1MB. Returns the reason it's
 * invalid, or null when acceptable.
 */
const signatureProblem = (signatureBase64) => {
  if (typeof signatureBase64 !== 'string' || !signatureBase64.trim()) {
    return 'signatureBase64 is required';
  }
  const base64 = signatureBase64.replace(/^data:image\/(png|jpe?g);base64,/, '');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
    return 'signatureBase64 is not valid base64 data';
  }
  let bytes;
  try {
    bytes = Buffer.from(base64, 'base64');
  } catch {
    return 'signatureBase64 could not be decoded';
  }
  if (!bytes.length || bytes.length > MAX_SIGNATURE_BYTES) {
    return 'Signature image must be a non-empty image under 1MB';
  }
  if (!matchesSignature(bytes, 'image/png') && !matchesSignature(bytes, 'image/jpeg')) {
    return 'signatureBase64 must decode to a PNG or JPEG image';
  }
  return null;
};

// POST /api/agreements  body: { applicationId, startDate, endDate, deposit? }
const createAgreement = async (req, res, next) => {
  try {
    const { applicationId, startDate, endDate, deposit } = req.body || {};

    if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(422).json({ error: 'A valid applicationId is required' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!startDate || !endDate || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(422).json({ error: 'Valid startDate and endDate are required' });
    }
    if (end <= start) {
      return res.status(422).json({ error: 'endDate must be after startDate' });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (application.landlordId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: this application is not addressed to you' });
    }
    if (application.status !== 'accepted') {
      return res.status(400).json({
        error: 'An agreement can only be created for an accepted application',
      });
    }

    const [property, tenant, landlord] = await Promise.all([
      Property.findById(application.propertyId),
      User.findById(application.tenantId),
      User.findById(application.landlordId),
    ]);
    if (!property || !tenant || !landlord) {
      return res.status(404).json({ error: 'Related property or parties not found' });
    }

    const agreementNumber = newAgreementNumber();
    const addr = property.address || {};
    const pdfBuffer = await generateAgreementPdf({
      agreementNumber,
      tenantName: tenant.fullName,
      landlordName: landlord.fullName,
      propertyTitle: property.title,
      propertyAddress: [addr.addressLine, addr.city, addr.state, addr.pincode]
        .filter(Boolean)
        .join(', '),
      monthlyRent: property.rent,
      deposit,
      startDate: start,
      endDate: end,
    });

    // 'raw' — Cloudinary refuses public delivery of image-typed PDFs (401)
    const uploaded = await uploadToCloudinary(pdfBuffer, FOLDERS.agreements, {
      resourceType: 'raw',
    });

    // agreementNumber collision is astronomically unlikely (timestamp +
    // 24 random bits) but the unique index makes a retry cheap insurance.
    let agreement;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        agreement = await Agreement.create({
          tenantId: application.tenantId,
          landlordId: application.landlordId,
          propertyId: application.propertyId,
          applicationId,
          agreementNumber: attempt === 0 ? agreementNumber : newAgreementNumber(),
          startDate: start,
          endDate: end,
          monthlyRent: property.rent,
          deposit,
          agreementPdf: uploaded,
          status: 'draft',
        });
        break;
      } catch (err) {
        if (err.code !== 11000 || attempt === 2) throw err;
      }
    }

    await notifySafely({
      receiverId: agreement.tenantId,
      title: 'Rental agreement ready for signature',
      message: `Your rental agreement for "${property.title}" is ready to review and sign.`,
      type: 'email',
      event: 'agreement',
      emailTemplate: {
        templateName: 'agreementCreated',
        templateArgs: [tenant.fullName, property.title, agreement._id.toString()],
      },
    });

    return res.status(201).json({ agreement });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/agreements/:id/sign  body: { signatureBase64 }
const signAgreement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { signatureBase64 } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    const agreement = await Agreement.findById(id);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Which section the caller signs is decided by identity match ONLY —
    // never by a client-supplied role.
    let party = null;
    if (agreement.tenantId.toString() === req.user.id) party = 'tenant';
    else if (agreement.landlordId.toString() === req.user.id) party = 'landlord';
    if (!party) {
      return res
        .status(403)
        .json({ error: 'Forbidden: you are not a party to this agreement' });
    }

    if ((party === 'tenant' && agreement.tenantSigned) ||
        (party === 'landlord' && agreement.landlordSigned)) {
      return res.status(409).json({ error: 'You have already signed this agreement' });
    }

    const problem = signatureProblem(signatureBase64);
    if (problem) {
      return res.status(422).json({ error: problem });
    }

    // Load the current stored PDF (keeps any earlier signature stamps).
    const pdfRes = await fetch(agreement.agreementPdf.url);
    if (!pdfRes.ok) {
      const err = new Error(`Could not load stored agreement PDF (HTTP ${pdfRes.status})`);
      err.status = 502;
      throw err;
    }
    const currentPdf = Buffer.from(await pdfRes.arrayBuffer());

    const stamped = await stampSignature(currentPdf, signatureBase64, party);
    const uploaded = await uploadToCloudinary(stamped, FOLDERS.agreements, {
      publicId: agreement.agreementPdf.publicId,
      resourceType: 'raw',
    });

    agreement.agreementPdf = uploaded;
    if (party === 'tenant') agreement.tenantSigned = true;
    else agreement.landlordSigned = true;

    const becameActive =
      agreement.status !== 'active' &&
      agreement.tenantSigned &&
      agreement.landlordSigned;
    if (becameActive) {
      agreement.status = 'active';
      agreement.signedAt = new Date();
    }
    await agreement.save();

    if (becameActive) {
      // Fire-and-forget: rental history bookkeeping must never block or
      // fail the signing response (same pattern as trust score / emails).
      const rentalHistoryController = require('./rentalHistoryController');
      rentalHistoryController.createRentalRecord(agreement).catch((err) => {
        console.error(`[agreements] Rental history creation failed: ${err.message}`);
      });

      // Both parties get the "rental active" email.
      try {
        const [tenant, landlord, property] = await Promise.all([
          User.findById(agreement.tenantId).select('fullName'),
          User.findById(agreement.landlordId).select('fullName'),
          Property.findById(agreement.propertyId).select('title'),
        ]);
        const propertyTitle = property?.title || 'your rental property';
        for (const recipient of [
          { id: agreement.tenantId, name: tenant?.fullName },
          { id: agreement.landlordId, name: landlord?.fullName },
        ]) {
          await notifySafely({
            receiverId: recipient.id,
            title: 'Agreement fully signed — rental active',
            message: `The rental agreement for "${propertyTitle}" is now fully signed and active.`,
            type: 'email',
            event: 'agreement',
            emailTemplate: {
              templateName: 'agreementFullySigned',
              templateArgs: [recipient.name, propertyTitle, agreement._id.toString()],
            },
          });
        }
      } catch (err) {
        console.error(`[agreements] Notification lookup failed: ${err.message}`);
      }
    }

    await agreement.populate('propertyId', 'title address.city');
    return res.status(200).json({ agreement });
  } catch (err) {
    return next(err);
  }
};

// GET /api/agreements/mine — agreements where the caller is a party
const listMyAgreements = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = { $or: [{ tenantId: req.user.id }, { landlordId: req.user.id }] };
    const [agreements, total] = await Promise.all([
      Agreement.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('propertyId', 'title address.city'),
      Agreement.countDocuments(filter),
    ]);

    return res.status(200).json({
      agreements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/agreements/:id — parties or admin only
const getAgreement = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    const agreement = await Agreement.findById(id);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    const isParty =
      agreement.tenantId.toString() === req.user.id ||
      agreement.landlordId.toString() === req.user.id;
    if (!isParty && req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Forbidden: you are not a party to this agreement' });
    }

    await agreement.populate('propertyId', 'title address.city');
    return res.status(200).json({ agreement });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createAgreement, signAgreement, getAgreement, listMyAgreements };
