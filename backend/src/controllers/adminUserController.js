const mongoose = require('mongoose');
const User = require('../models/User');
const TenantProfile = require('../models/TenantProfile');
const LandlordProfile = require('../models/LandlordProfile');
const Document = require('../models/Document');
const Property = require('../models/Property');
const Application = require('../models/Application');
const Agreement = require('../models/Agreement');
const RentalHistory = require('../models/RentalHistory');
const VerificationRequest = require('../models/VerificationRequest');
const TrustScoreHistory = require('../models/TrustScoreHistory');
const Notification = require('../models/Notification');
const RefreshToken = require('../models/RefreshToken');
const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const {
  adminAccountBlocked,
  adminAccountUnblocked,
  adminAccountDeleted,
} = require('../emails/baseTemplate');

const ROLES = ['tenant', 'landlord', 'admin'];
const STATUSES = ['pending', 'active', 'blocked'];
// An admin can only flip a user between active and blocked; "pending" is
// owned by the signup/OTP flow and must not be settable by hand.
const SETTABLE_STATUSES = ['active', 'blocked'];

// Escape regex metacharacters — the search term is user input, matched literally.
const literalRegex = (term) =>
  new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/**
 * GET /api/admin/users?search=&role=&status=&page=&limit=  (admin only)
 *
 * The user directory behind the admin "Users" page: every tenant, landlord
 * and admin account with the counts an admin needs to judge a row at a
 * glance (trust score for tenants, property count for landlords). Those
 * extras are fetched in two batch queries scoped to the current page, so
 * the cost does not grow with the size of the user table.
 */
const listUsers = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const search = String(req.query.search || '').trim().slice(0, 100);
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();

    if (role && role !== 'all' && !ROLES.includes(role)) {
      return res
        .status(422)
        .json({ error: `role must be one of: ${ROLES.join(', ')}` });
    }
    if (status && status !== 'all' && !STATUSES.includes(status)) {
      return res
        .status(422)
        .json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }

    const filter = {};
    if (role && role !== 'all') filter.role = role;
    if (status && status !== 'all') filter.accountStatus = status;
    if (search) {
      const rx = literalRegex(search);
      filter.$or = [{ fullName: rx }, { email: rx }, { phone: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('fullName email phone role accountStatus authProvider isEmailVerified profileImage lastLogin createdAt')
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    const tenantIds = users.filter((u) => u.role === 'tenant').map((u) => u._id);
    const landlordIds = users.filter((u) => u.role === 'landlord').map((u) => u._id);

    const [profiles, propertyCounts] = await Promise.all([
      tenantIds.length
        ? TenantProfile.find({ userId: { $in: tenantIds } }).select('userId trustScore')
        : [],
      landlordIds.length
        ? Property.aggregate([
            { $match: { landlordId: { $in: landlordIds } } },
            { $group: { _id: '$landlordId', count: { $sum: 1 } } },
          ])
        : [],
    ]);
    const scoreByUser = new Map(
      profiles.map((p) => [p.userId.toString(), p.trustScore ?? null])
    );
    const propertiesByUser = new Map(
      propertyCounts.map((p) => [p._id.toString(), p.count])
    );

    return res.status(200).json({
      users: users.map((u) => ({
        ...u.toJSON(),
        trustScore: u.role === 'tenant' ? scoreByUser.get(u._id.toString()) ?? null : null,
        propertyCount:
          u.role === 'landlord' ? propertiesByUser.get(u._id.toString()) ?? 0 : null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/users/:id  (admin only)
 * One account with its profile and an activity summary, so an admin can
 * see what a block or a delete would actually affect.
 */
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [
      tenantProfile,
      landlordProfile,
      documents,
      verifiedDocuments,
      properties,
      applications,
      activeAgreements,
      rentals,
    ] = await Promise.all([
      TenantProfile.findOne({ userId: id }),
      LandlordProfile.findOne({ userId: id }),
      Document.countDocuments({ tenantId: id }),
      Document.countDocuments({ tenantId: id, verificationStatus: 'verified' }),
      Property.countDocuments({ landlordId: id }),
      Application.countDocuments({ $or: [{ tenantId: id }, { landlordId: id }] }),
      Agreement.countDocuments({
        $or: [{ tenantId: id }, { landlordId: id }],
        status: 'active',
      }),
      RentalHistory.countDocuments({ $or: [{ tenantId: id }, { landlordId: id }] }),
    ]);

    return res.status(200).json({
      user: user.toJSON(),
      profile: tenantProfile || landlordProfile || null,
      stats: {
        documents,
        verifiedDocuments,
        properties,
        applications,
        activeAgreements,
        rentals,
        trustScore: tenantProfile?.trustScore ?? null,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/admin/users/:id/status  body: { status: "active"|"blocked" }
 *
 * Blocking is enforced at sign-in (password, OTP and Google login all reject
 * accountStatus "blocked"), so an already-issued access token would survive
 * up to its 15-minute lifetime — deleting the user's refresh tokens closes
 * the session for good instead of letting it roll over indefinitely.
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body || {};

    const adminMessage =
        typeof reason === 'string'
            ? reason.trim().slice(0, 500)
            : '';

    if (!status || !SETTABLE_STATUSES.includes(status)) {
      return res.status(422).json({
        error: `status must be one of: ${SETTABLE_STATUSES.join(', ')}`,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    if (id === req.user.id) {
      return res.status(403).json({
        error: 'You cannot change your own account status',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        error: 'Admin accounts cannot be blocked',
      });
    }

    user.accountStatus = status;
    await user.save();

    if (status === 'blocked') {
      await RefreshToken.deleteMany({
        userId: id,
      });
    }

    /*
     * ------------------------------------------------------------
     * SEND DIRECT EMAIL
     *
     * emailService is the ONLY service responsible for the email.
     * ------------------------------------------------------------
     */

    try {
      const isBlocked = status === 'blocked';

      const html = isBlocked
          ? adminAccountBlocked({
            fullName: user.fullName,
            message: adminMessage,
          })
          : adminAccountUnblocked({
            fullName: user.fullName,
            message: adminMessage,
          });

      const text = isBlocked
          ? [
            `Hi ${user.fullName || 'there'},`,
            '',
            'Your VeriNest account has been blocked by an administrator.',
            adminMessage
                ? `Message from the administrator: ${adminMessage}`
                : '',
            '',
            'You will not be able to sign in while your account is blocked.',
            'If you believe this action was taken in error, please contact VeriNest support.',
          ]
              .filter(Boolean)
              .join('\n')
          : [
            `Hi ${user.fullName || 'there'},`,
            '',
            'Your VeriNest account has been restored by an administrator.',
            adminMessage
                ? `Message from the administrator: ${adminMessage}`
                : '',
            '',
            'You can now sign in and continue using VeriNest.',
          ]
              .filter(Boolean)
              .join('\n');

      await emailService.sendEmail({
        to: user.email,
        subject: isBlocked
            ? 'Your VeriNest account has been blocked'
            : 'Your VeriNest account has been restored',
        html,
        text,
      });

      console.log(
          `[admin] ${isBlocked ? 'Block' : 'Unblock'} email sent to ${user.email}`
      );
    } catch (err) {
      console.error(
          `[admin] Account status email failed for ${user.email}: ${err.message}`
      );
    }

    try {
      await notificationService.createNotification({
        receiverId: user._id,
        title:
            status === 'blocked'
                ? 'Account blocked'
                : 'Account reactivated',

        message:
            status === 'blocked'
                ? [
                  'Your VeriNest account has been blocked by an administrator.',
                  adminMessage
                      ? `Reason: ${adminMessage}`
                      : null,
                  'Contact support if you believe this is a mistake.',
                ]
                    .filter(Boolean)
                    .join(' ')
                : [
                  'Your VeriNest account has been reactivated.',
                  adminMessage
                      ? `Message from administrator: ${adminMessage}`
                      : null,
                ]
                    .filter(Boolean)
                    .join(' '),

        type: 'push',
        event: 'general',
      });
    } catch (err) {
      console.error(
          `[admin] In-app notification failed: ${err.message}`
      );
    }

    try {
      await auditService.logAction({
        userId: req.user.id,
        action:
            status === 'blocked'
                ? 'user_blocked'
                : 'user_unblocked',
        module: 'users',
        req,
      });
    } catch (err) {
      console.error(
          `[admin] Audit log creation failed: ${err.message}`
      );
    }

    return res.status(200).json({
      user: user.toJSON(),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/users/:id  (admin only)
 *
 * Removes the account and every record it owns. Refused while the user is
 * party to an active agreement — that record belongs to the other party too,
 * and blocking is the right tool for a live tenancy.
 *
 * Cloudinary assets (document scans, property photos, agreement PDFs) are
 * intentionally left in place: they are unreachable once the owning records
 * are gone, and deleting them is not reversible if the removal was a mistake.
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const adminMessage =
        typeof reason === 'string'
            ? reason.trim().slice(0, 500)
            : '';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    if (id === req.user.id) {
      return res.status(403).json({
        error: 'You cannot delete your own account',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        error: 'Admin accounts cannot be deleted',
      });
    }

    /*
     * ------------------------------------------------------------
     * ACTIVE AGREEMENT CHECK
     * ------------------------------------------------------------
     */

    const activeAgreements = await Agreement.countDocuments({
      $or: [
        { tenantId: id },
        { landlordId: id },
      ],
      status: 'active',
    });

    if (activeAgreements > 0) {
      return res.status(409).json({
        error: `This user is party to ${activeAgreements} active agreement${
            activeAgreements === 1 ? '' : 's'
        }. Block the account instead, or end the agreement first.`,
      });
    }

    const userEmail = user.email;
    const userFullName = user.fullName || 'there';

    const partyFilter = {
      $or: [
        { tenantId: id },
        { landlordId: id },
      ],
    };

    const propertyIds = (
        await Property.find({
          landlordId: id,
        }).select('_id')
    ).map((p) => p._id);

    /*
     * ------------------------------------------------------------
     * SEND DELETION EMAIL
     *
     * This happens BEFORE Notification/User deletion.
     *
     * Most importantly, this uses emailService DIRECTLY.
     * ------------------------------------------------------------
     */

    try {
      const html = adminAccountDeleted({
        fullName: userFullName,
        message: adminMessage,
      });

      const text = [
        `Hi ${userFullName},`,
        '',
        'Your VeriNest account has been permanently deleted by an administrator.',
        adminMessage
            ? `Message from the administrator: ${adminMessage}`
            : '',
        '',
        'You will no longer be able to sign in to this account.',
        '',
        'If you believe this action was taken incorrectly, please contact VeriNest support.',
      ]
          .filter(Boolean)
          .join('\n');

      await emailService.sendEmail({
        to: userEmail,
        subject: 'Your VeriNest account has been deleted',
        html,
        text,
      });

      console.log(
          `[admin] Account deletion email sent to ${userEmail}`
      );
    } catch (err) {
      /*
       * Email failure must NOT prevent the account deletion.
       */
      console.error(
          `[admin] Account deletion email failed for ${userEmail}: ${err.message}`
      );
    }

    /*
     * ------------------------------------------------------------
     * DELETE RELATED DATA
     * ------------------------------------------------------------
     */

    await Promise.all([
      TenantProfile.deleteOne({
        userId: id,
      }),

      LandlordProfile.deleteOne({
        userId: id,
      }),

      Document.deleteMany({
        tenantId: id,
      }),

      TrustScoreHistory.deleteMany({
        tenantId: id,
      }),

      Notification.deleteMany({
        receiverId: id,
      }),

      RefreshToken.deleteMany({
        userId: id,
      }),

      VerificationRequest.deleteMany(
          partyFilter
      ),

      Agreement.deleteMany(
          partyFilter
      ),

      RentalHistory.deleteMany(
          partyFilter
      ),

      Application.deleteMany(
          propertyIds.length
              ? {
                $or: [
                  { tenantId: id },
                  { landlordId: id },
                  {
                    propertyId: {
                      $in: propertyIds,
                    },
                  },
                ],
              }
              : partyFilter
      ),

      Property.deleteMany({
        landlordId: id,
      }),
    ]);

    /*
     * ------------------------------------------------------------
     * DELETE USER
     * ------------------------------------------------------------
     */

    await User.deleteOne({
      _id: id,
    });

    /*
     * ------------------------------------------------------------
     * AUDIT LOG
     * ------------------------------------------------------------
     */

    try {
      await auditService.logAction({
        userId: req.user.id,
        action: 'user_deleted',
        module: 'users',
        req,
      });
    } catch (err) {
      console.error(
          `[admin] Audit log creation failed: ${err.message}`
      );
    }

    return res.status(200).json({
      message: 'User deleted',
      userId: id,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { listUsers, getUser, updateUserStatus, deleteUser };
