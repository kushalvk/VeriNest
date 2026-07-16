const mongoose = require('mongoose');
const Application = require('../models/Application');
const Document = require('../models/Document');
const Property = require('../models/Property');
const TenantProfile = require('../models/TenantProfile');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const { isTenantProfileComplete } = require('../services/profileCompletionService');

const DECISION_STATUSES = ['accepted', 'rejected'];

const paginate = (req) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  return { page, limit };
};

// Side effects must never fail the primary action.
const notifySafely = async (payload) => {
  try {
    await notificationService.createNotification(payload);
  } catch (err) {
    console.error(`[applications] Notification creation failed: ${err.message}`);
  }
};

// POST /api/applications  body: { propertyId, message? }
const applyToProperty = async (req, res, next) => {
  try {
    const { propertyId, message } = req.body || {};

    if (!propertyId || !mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(422).json({ error: 'A valid propertyId is required' });
    }

    const property = await Property.findById(propertyId);
    if (!property || property.status !== 'available') {
      return res
        .status(404)
        .json({ error: 'Property not found or not available' });
    }

    const profile = await TenantProfile.findOne({ userId: req.user.id });
    const { complete, missingFields } = isTenantProfileComplete(profile);
    if (!complete) {
      return res.status(422).json({ error: 'Profile incomplete', missingFields });
    }

    const existing = await Application.findOne({
      tenantId: req.user.id,
      propertyId,
      status: { $in: ['pending', 'accepted'] },
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: 'You have already applied to this property' });
    }

    const application = await Application.create({
      tenantId: req.user.id,
      propertyId,
      landlordId: property.landlordId, // always from the property record
      message,
    });

    try {
      const [tenant, landlord] = await Promise.all([
        User.findById(req.user.id).select('fullName'),
        User.findById(property.landlordId).select('fullName'),
      ]);
      await notifySafely({
        receiverId: property.landlordId,
        title: 'New application received',
        message: `${tenant?.fullName || 'A tenant'} has applied for "${property.title}".`,
        type: 'email',
        event: 'application',
        emailTemplate: {
          templateName: 'applicationSubmitted',
          templateArgs: [landlord?.fullName, tenant?.fullName, property.title],
        },
      });
    } catch (err) {
      console.error(`[applications] Notification lookup failed: ${err.message}`);
    }

    return res.status(201).json({ application });
  } catch (err) {
    return next(err);
  }
};

// GET /api/applications/mine — tenant's own applications
const getMyApplications = async (req, res, next) => {
  try {
    const { page, limit } = paginate(req);
    const filter = { tenantId: req.user.id };

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('propertyId', 'title rent address.city'),
      Application.countDocuments(filter),
    ]);

    return res.status(200).json({
      applications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/applications/received — applications for the landlord's properties.
// Each application carries a tenantMeta block (trust score + document
// verification counts) so the landlord can screen BEFORE accepting.
const getReceivedApplications = async (req, res, next) => {
  try {
    const { page, limit } = paginate(req);
    const filter = { landlordId: req.user.id };

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('tenantId', 'fullName email')
        .populate('propertyId', 'title rent address.city'),
      Application.countDocuments(filter),
    ]);

    const tenantIds = [
      ...new Set(
        applications
          .map((a) => a.tenantId?._id?.toString())
          .filter(Boolean)
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const [profiles, docCounts] = await Promise.all([
      TenantProfile.find({ userId: { $in: tenantIds } }).select('userId trustScore'),
      Document.aggregate([
        { $match: { tenantId: { $in: tenantIds } } },
        {
          $group: {
            _id: '$tenantId',
            total: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);
    const scoreByTenant = new Map(profiles.map((p) => [p.userId.toString(), p.trustScore]));
    const docsByTenant = new Map(docCounts.map((d) => [d._id.toString(), d]));

    const enriched = applications.map((a) => {
      const tid = a.tenantId?._id?.toString();
      const docs = tid ? docsByTenant.get(tid) : null;
      return {
        ...a.toObject(),
        tenantMeta: {
          trustScore: tid ? scoreByTenant.get(tid) ?? null : null,
          documentsTotal: docs?.total ?? 0,
          documentsVerified: docs?.verified ?? 0,
        },
      };
    });

    return res.status(200).json({
      applications: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/applications/:id/tenant-profile — screening summary for the
// landlord the application is addressed to (any status — the point is to
// review the tenant BEFORE deciding). Only non-sensitive profile fields:
// never Aadhaar/PAN/passport numbers, full addresses, or document files —
// document ACCESS still goes through the tenant-approved token flow.
const getTenantSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (application.landlordId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: this application is not addressed to you' });
    }

    const [tenant, profile, documents] = await Promise.all([
      User.findById(application.tenantId).select('fullName email createdAt'),
      TenantProfile.findOne({ userId: application.tenantId }),
      Document.find({ tenantId: application.tenantId })
        .select('documentType verificationStatus')
        .sort({ createdAt: -1 }),
    ]);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const docList = documents.map((d) => ({
      documentType: d.documentType,
      verificationStatus: d.verificationStatus,
    }));

    return res.status(200).json({
      tenant: {
        fullName: tenant.fullName,
        email: tenant.email,
        memberSince: tenant.createdAt,
      },
      trustScore: profile?.trustScore ?? null,
      trustReasons: profile?.trustReason ?? [],
      profile: profile
        ? {
            occupation: profile.occupation,
            employmentType: profile.employmentType,
            companyName: profile.companyName,
            designation: profile.designation,
            monthlySalary: profile.monthlySalary,
            currentCity: profile.currentAddress?.city,
            currentState: profile.currentAddress?.state,
            policeVerificationStatus: profile.policeVerificationStatus,
          }
        : null,
      documents: docList,
      allDocumentsVerified:
        docList.length > 0 && docList.every((d) => d.verificationStatus === 'verified'),
    });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/applications/:id  body: { status: "accepted"|"rejected" }
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !DECISION_STATUSES.includes(status)) {
      return res.status(422).json({
        error: `status must be one of: ${DECISION_STATUSES.join(', ')}`,
      });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = await Application.findById(id).populate(
      'propertyId',
      'title'
    );
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (application.landlordId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: this application is not addressed to you' });
    }

    application.status = status;
    await application.save();

    const propertyTitle = application.propertyId?.title || 'the property';
    try {
      const tenant = await User.findById(application.tenantId).select('fullName');
      await notifySafely({
        receiverId: application.tenantId,
        title: status === 'accepted' ? 'Application accepted' : 'Application rejected',
        message:
          status === 'accepted'
            ? `Your application for "${propertyTitle}" has been accepted.`
            : `Your application for "${propertyTitle}" was rejected.`,
        type: 'email',
        event: 'application',
        emailTemplate: {
          templateName: status === 'accepted' ? 'applicationAccepted' : 'applicationRejected',
          templateArgs: [tenant?.fullName, propertyTitle],
        },
      });
    } catch (err) {
      console.error(`[applications] Notification lookup failed: ${err.message}`);
    }

    return res.status(200).json({ application });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  applyToProperty,
  getMyApplications,
  getReceivedApplications,
  getTenantSummary,
  updateApplicationStatus,
};
