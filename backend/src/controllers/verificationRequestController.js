const mongoose = require('mongoose');
const VerificationRequest = require('../models/VerificationRequest');
const Application = require('../models/Application');
const Document = require('../models/Document');
const Property = require('../models/Property');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');
const { generateSecureToken, hashToken } = require('../services/tokenService');

const ACCESS_TYPES = ['one_time', '24_hours', '7_days'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Window per access type. one_time gets a 24h ceiling as a safety net;
// its real limit is the single-use flip on first view.
const EXPIRY_MS = {
  one_time: DAY_MS,
  '24_hours': DAY_MS,
  '7_days': 7 * DAY_MS,
};

const notifySafely = async (payload) => {
  try {
    await notificationService.createNotification(payload);
  } catch (err) {
    console.error(`[verification] Notification creation failed: ${err.message}`);
  }
};

// POST /api/verification-requests  body: { applicationId, accessType }
// Assumption: only ACCEPTED applications qualify — a landlord has no
// business seeing documents for an application they haven't accepted.
const createRequest = async (req, res, next) => {
  try {
    const { applicationId, accessType } = req.body || {};

    if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(422).json({ error: 'A valid applicationId is required' });
    }
    if (!accessType || !ACCESS_TYPES.includes(accessType)) {
      return res
        .status(422)
        .json({ error: `accessType must be one of: ${ACCESS_TYPES.join(', ')}` });
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
        error: 'Verification can only be requested for accepted applications',
      });
    }

    const request = await VerificationRequest.create({
      landlordId: req.user.id,
      tenantId: application.tenantId,
      applicationId,
      accessType,
      status: 'pending',
    });

    try {
      const [tenant, landlord, property] = await Promise.all([
        User.findById(application.tenantId).select('fullName'),
        User.findById(req.user.id).select('fullName'),
        Property.findById(application.propertyId).select('title'),
      ]);
      await notifySafely({
        receiverId: application.tenantId,
        title: 'Document verification requested',
        message: `A landlord has requested access to your verification documents (${accessType.replace(/_/g, ' ')}).`,
        type: 'email',
        event: 'verification_request',
        emailTemplate: {
          templateName: 'verificationRequestReceived',
          templateArgs: [
            tenant?.fullName,
            landlord?.fullName,
            property?.title || 'your application',
          ],
        },
      });
    } catch (err) {
      console.error(`[verification] Notification lookup failed: ${err.message}`);
    }

    return res.status(201).json({ request });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/verification-requests/:id/respond  body: { action: "approve"|"reject" }
const respondToRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};

    if (!['approve', 'reject'].includes(action)) {
      return res
        .status(422)
        .json({ error: 'action must be "approve" or "reject"' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Verification request not found' });
    }

    const request = await VerificationRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: 'Verification request not found' });
    }
    if (request.tenantId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: this request is not addressed to you' });
    }
    if (request.status !== 'pending') {
      return res
        .status(409)
        .json({ error: 'This request has already been responded to' });
    }

    if (action === 'reject') {
      request.status = 'rejected';
      await request.save();
      await notifySafely({
        receiverId: request.landlordId,
        title: 'Verification request rejected',
        message: 'The tenant declined your document verification request.',
        type: 'push',
        event: 'verification_request',
      });
      return res.status(200).json({ request });
    }

    // approve: raw token exists only in this response — never stored/logged
    const rawToken = generateSecureToken();
    request.secureToken = hashToken(rawToken);
    request.expiresAt = new Date(Date.now() + EXPIRY_MS[request.accessType]);
    request.status = 'approved';
    await request.save();

    try {
      const landlord = await User.findById(request.landlordId).select('fullName');
      await notifySafely({
        receiverId: request.landlordId,
        title: 'Verification request approved',
        message: 'The tenant approved your document verification request.',
        type: 'email',
        event: 'verification_request',
        emailTemplate: {
          templateName: 'verificationRequestApproved',
          templateArgs: [landlord?.fullName],
        },
      });
    } catch (err) {
      console.error(`[verification] Notification lookup failed: ${err.message}`);
    }

    const response = request.toJSON();
    delete response.secureToken;
    return res.status(200).json({
      request: response,
      accessToken: rawToken,
      accessUrl: `/api/verification/access/${rawToken}`,
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/verification-requests/mine — the tenant's incoming requests.
// secureToken is select:false and is NEVER included here: the raw token is
// shown exactly once (at approval time) and the hash is useless to clients.
const listMyRequests = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = { tenantId: req.user.id };
    const [requests, total] = await Promise.all([
      VerificationRequest.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('landlordId', 'fullName')
        .populate({
          path: 'applicationId',
          select: 'propertyId',
          populate: { path: 'propertyId', select: 'title address.city' },
        }),
      VerificationRequest.countDocuments(filter),
    ]);

    return res.status(200).json({
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/verification/access/:token — public, protected solely by token
const accessDocuments = async (req, res, next) => {
  try {
    const tokenHash = hashToken(req.params.token || '');

    const request = await VerificationRequest.findOne({
      secureToken: tokenHash,
    });
    // Generic 404: reveals nothing about whether such a token ever existed.
    if (!request) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (request.status === 'expired') {
      const message =
        request.accessType === 'one_time' && request.viewedAt
          ? 'Access already used'
          : 'Access expired';
      return res.status(410).json({ error: message });
    }
    if (request.status !== 'approved') {
      return res.status(403).json({ error: 'Access not granted' });
    }
    if (!request.expiresAt || request.expiresAt < new Date()) {
      request.status = 'expired';
      await request.save();
      return res.status(410).json({ error: 'Access expired' });
    }

    if (request.accessType === 'one_time') {
      // Atomic claim: even two concurrent requests can't both win this.
      const claimed = await VerificationRequest.findOneAndUpdate(
        { _id: request._id, status: 'approved', viewedAt: null },
        { $set: { viewedAt: new Date(), status: 'expired' } },
        { new: true }
      );
      if (!claimed) {
        return res.status(410).json({ error: 'Access already used' });
      }
    } else {
      request.viewedAt = new Date();
      await request.save();
    }

    const documents = await Document.find({ tenantId: request.tenantId });
    // Only non-sensitive fields — never extractedData or internal metadata.
    const safeDocuments = documents.map((d) => ({
      documentType: d.documentType,
      url: d.cloudinary?.url,
      verificationStatus: d.verificationStatus,
    }));

    try {
      await auditService.logAction({
        userId: request.landlordId,
        action: 'verification_access',
        module: 'verification',
        req,
      });
    } catch (err) {
      console.error(`[verification] Audit log failed: ${err.message}`);
    }

    return res.status(200).json({
      accessType: request.accessType,
      expiresAt: request.expiresAt,
      documents: safeDocuments,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createRequest, respondToRequest, listMyRequests, accessDocuments };
