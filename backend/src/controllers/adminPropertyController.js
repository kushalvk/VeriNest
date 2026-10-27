const mongoose = require('mongoose');
const Property = require('../models/Property');
const auditService = require('../services/auditService');

// notificationService is imported inconsistently across the codebase — use
// the safe shape from CLAUDE.md.
const notificationModule = require('../services/notificationService');
const notificationService = notificationModule.notificationService || notificationModule;

const QUEUE_STATUSES = ['pending', 'verified', 'rejected'];
const DECISION_STATUSES = ['verified', 'rejected'];

// GET /api/admin/properties?status=pending&page=1&limit=20
// Full verification data (bill URL, OCR text, auto-checks) — admin only.
const listProperties = async (req, res, next) => {
    try {
        const status = req.query.status || 'pending';
        if (!QUEUE_STATUSES.includes(status)) {
            return res.status(422).json({
                error: `status must be one of: ${QUEUE_STATUSES.join(', ')}`,
            });
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

        const filter = { 'verification.status': status };
        // Oldest submission first for the pending queue (FIFO), newest first otherwise.
        const sort =
            status === 'pending'
                ? { 'verification.taxBill.uploadedAt': 1, _id: 1 }
                : { 'verification.reviewedAt': -1, _id: -1 };

        const [properties, total, ...counts] = await Promise.all([
            Property.find(filter)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('landlordId', 'fullName email'),
            Property.countDocuments(filter),
            ...QUEUE_STATUSES.map((s) =>
                Property.countDocuments({ 'verification.status': s })
            ),
        ]);

        return res.status(200).json({
            properties,
            counts: Object.fromEntries(QUEUE_STATUSES.map((s, i) => [s, counts[i]])),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        return next(err);
    }
};

// PATCH /api/admin/properties/:id  body: { status: "verified"|"rejected", remarks? }
// remarks are required when rejecting (shown to the landlord).
const updatePropertyVerification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body || {};

        if (!status || !DECISION_STATUSES.includes(status)) {
            return res.status(422).json({
                error: `status must be one of: ${DECISION_STATUSES.join(', ')}`,
            });
        }
        if (status === 'rejected' && (!remarks || String(remarks).trim().length < 3)) {
            return res
                .status(422)
                .json({ error: 'A rejection reason is required' });
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const update = {
            $set: {
                'verification.status': status,
                'verification.reviewedBy': req.user.id,
                'verification.reviewedAt': new Date(),
            },
        };
        if (status === 'rejected') {
            update.$set['verification.rejectionReason'] = String(remarks).trim();
        } else {
            update.$unset = { 'verification.rejectionReason': '' };
        }

        // Atomic + status-guarded: two admins can't both decide the same bill,
        // and only a submitted ("pending") bill can be decided.
        const property = await Property.findOneAndUpdate(
            { _id: id, 'verification.status': 'pending' },
            update,
            { new: true }
        );

        if (!property) {
            const exists = await Property.exists({ _id: id });
            if (!exists) return res.status(404).json({ error: 'Property not found' });
            return res
                .status(409)
                .json({ error: 'This property is not awaiting verification' });
        }

        // Side effects: must not block or roll back the decision.
        try {
            await notificationService.createNotification({
                receiverId: property.landlordId,
                title:
                    status === 'verified' ? 'Property verified' : 'Property verification rejected',
                message:
                    status === 'verified'
                        ? `Your property "${property.title}" is verified and now visible to tenants.`
                        : `Your tax bill for "${property.title}" was rejected. Reason: ${String(remarks).trim()}`,
                type: 'push',
                event: 'general',
            });
        } catch (err) {
            console.error(`[admin] Notification creation failed: ${err.message}`);
        }
        try {
            await auditService.logAction({
                userId: req.user.id,
                action: 'property_verification_update',
                module: 'properties',
                req,
            });
        } catch (err) {
            console.error(`[admin] Audit log creation failed: ${err.message}`);
        }

        return res.status(200).json({ property });
    } catch (err) {
        return next(err);
    }
};

module.exports = { listProperties, updatePropertyVerification };