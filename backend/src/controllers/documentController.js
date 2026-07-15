const Document = require('../models/Document');
const { DOCUMENT_TYPES } = require('../models/Document');
const { uploadToCloudinary } = require('../services/documentService');
const { matchesSignature } = require('../utils/fileSignature');

// POST /api/documents/upload
const uploadDocument = async (req, res, next) => {
  try {
    const { documentType } = req.body || {};

    // Fail fast — nothing reaches Cloudinary unless every check passes.
    if (!req.file) {
      return res
        .status(422)
        .json({ error: 'A file is required (multipart field "file")' });
    }
    if (!documentType || !DOCUMENT_TYPES.includes(documentType)) {
      return res.status(422).json({
        error: `documentType must be one of: ${DOCUMENT_TYPES.join(', ')}`,
      });
    }
    if (!matchesSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({
        error: 'Unsupported file type. File content does not match an allowed format (JPG, PNG, PDF).',
      });
    }

    const { publicId, url } = await uploadToCloudinary(req.file.buffer);

    const document = await Document.create({
      tenantId: req.user.id,
      documentType,
      cloudinary: { publicId, url },
      verificationStatus: 'pending',
    });

    return res.status(201).json({ document });
  } catch (err) {
    return next(err);
  }
};

// GET /api/documents/my
const getMyDocuments = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = { tenantId: req.user.id };
    const [documents, total] = await Promise.all([
      Document.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
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

module.exports = { uploadDocument, getMyDocuments };
