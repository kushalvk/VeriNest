const mongoose = require('mongoose');
const Document = require('../models/Document');
const fraudDetectionService = require('../services/fraudDetectionService');

// POST /api/documents/:id/fraud-check
// Tenants may check their own documents; admins may check any.
const runFraudCheck = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (
      req.user.role !== 'admin' &&
      document.tenantId.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ error: 'Forbidden: you can only check your own documents' });
    }

    const checks = await fraudDetectionService.runChecksById(document._id);
    const updated = await Document.findById(document._id);

    return res.status(200).json({ checks, document: updated });
  } catch (err) {
    return next(err);
  }
};

module.exports = { runFraudCheck };
