const mongoose = require('mongoose');
const Document = require('../models/Document');
const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');
const trustScoreService = require('../services/trustScoreService');

const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'];
const DECISION_STATUSES = ['verified', 'rejected'];

// GET /api/admin/documents?status=pending&page=1&limit=20
const listPendingDocuments = async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    if (!VERIFICATION_STATUSES.includes(status)) {
      return res.status(422).json({
        error: `status must be one of: ${VERIFICATION_STATUSES.join(', ')}`,
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = { verificationStatus: status };
    const [documents, total] = await Promise.all([
      Document.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('tenantId', 'fullName email'),
      Document.countDocuments(filter),
    ]);

    return res.status(200).json({
      documents,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/admin/documents/:id  body: { status: "verified"|"rejected", remarks? }
const updateDocumentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body || {};

    if (!status || !DECISION_STATUSES.includes(status)) {
      return res.status(422).json({
        error: `status must be one of: ${DECISION_STATUSES.join(', ')}`,
      });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    document.verificationStatus = status;
    document.verifiedBy = req.user.id;
    document.verifiedAt = new Date();
    if (remarks !== undefined) document.remarks = remarks;
    await document.save();

    // Side effects: must not block or roll back the status update.
    const readableType = document.documentType.replace(/_/g, ' ');
    // In-app notification only — per-decision emails were too noisy for
    // admins working through the review queue (tenants still see the bell).
    try {
      await notificationService.createNotification({
        receiverId: document.tenantId,
        title:
          status === 'verified' ? 'Document verified' : 'Document rejected',
        message:
          status === 'verified'
            ? `Your ${readableType} document has been verified.`
            : `Your ${readableType} document was rejected.${remarks ? ` Reason: ${remarks}` : ''}`,
        type: 'push',
        event: 'general',
      });
    } catch (err) {
      console.error(`[admin] Notification creation failed: ${err.message}`);
    }
    try {
      await auditService.logAction({
        userId: req.user.id,
        action: 'document_status_update',
        module: 'documents',
        req,
      });
    } catch (err) {
      console.error(`[admin] Audit log creation failed: ${err.message}`);
    }
    if (status === 'verified') {
      try {
        await trustScoreService.recalculateAndPersist(document.tenantId, 'System');
      } catch (err) {
        console.error(`[admin] Trust score recalculation failed: ${err.message}`);
      }
    }

    return res.status(200).json({ document });
  } catch (err) {
    return next(err);
  }
};

module.exports = { listPendingDocuments, updateDocumentStatus };
