const mongoose = require('mongoose');
const TenantProfile = require('../models/TenantProfile');
const User = require('../models/User');
const trustScoreService = require('../services/trustScoreService');

// GET /api/trust-score/tenants?search=&page=&limit=  (admin only)
// Tenant directory for the admin panel: name/email search, paginated,
// with each tenant's current stored trust score joined in.
const listTenants = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const search = String(req.query.search || '').trim().slice(0, 100);

    const filter = { role: 'tenant' };
    if (search) {
      // Escape regex metacharacters — the term is user input, matched literally.
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ fullName: rx }, { email: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('fullName email createdAt')
        .sort({ fullName: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    const profiles = await TenantProfile.find({
      userId: { $in: users.map((u) => u._id) },
    }).select('userId trustScore');
    const profileByUser = new Map(profiles.map((p) => [p.userId.toString(), p]));

    const tenants = users.map((u) => {
      const profile = profileByUser.get(u._id.toString());
      return {
        _id: u._id,
        fullName: u.fullName,
        email: u.email,
        createdAt: u.createdAt,
        hasProfile: Boolean(profile),
        trustScore: profile?.trustScore ?? null,
      };
    });

    return res.status(200).json({
      tenants,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

// POST /api/trust-score/recalculate/:tenantId  (admin only)
const recalculate = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(404).json({ error: 'Tenant profile not found' });
    }

    const profile = await TenantProfile.findOne({ userId: tenantId });
    if (!profile) {
      return res.status(404).json({ error: 'Tenant profile not found' });
    }

    const { score, reasons } = await trustScoreService.recalculateAndPersist(
      tenantId,
      'Admin'
    );

    return res.status(200).json({ tenantId, score, reasons });
  } catch (err) {
    return next(err);
  }
};

module.exports = { recalculate, listTenants };
