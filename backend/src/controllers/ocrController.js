const mongoose = require('mongoose');
const Document = require('../models/Document');
const ocrService = require('../services/ocrService');
const fraudDetectionService = require('../services/fraudDetectionService');

const LOW_CONFIDENCE_THRESHOLD = 40;

// POST /api/documents/:id/ocr
const runOcr = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = await Document.findById(id);
    // Same 404 for "doesn't exist" and "not yours" — don't leak which.
    if (!document || document.tenantId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const imageUrl = document.cloudinary?.url;
    if (!imageUrl) {
      return res
        .status(422)
        .json({ error: 'Document has no stored file to run OCR on' });
    }

    // OCR is image-only for the MVP — skip PDFs gracefully.
    if (imageUrl.toLowerCase().endsWith('.pdf')) {
      return res.status(200).json({
        message: 'OCR skipped: PDF documents are not supported yet',
        document,
      });
    }

    document.ocrStatus = 'processing';
    await document.save();

    let result = null;
    let failureReason = null;
    try {
      result = await ocrService.extractText(imageUrl);
    } catch (err) {
      // Expected outcome for bad/corrupted images or timeouts — never a 500.
      failureReason = err.message;
      console.warn(`[ocr] Extraction failed for document ${id}: ${err.message}`);
    }

    if (!result || result.confidence < LOW_CONFIDENCE_THRESHOLD) {
      document.ocrStatus = 'failed';
      document.blurryDocument = true;
      if (result) {
        document.extractedData = {
          rawText: result.rawText,
          confidence: result.confidence,
        };
        document.markModified('extractedData');
      }
      await document.save();
      return res.status(200).json({
        message: result
          ? 'OCR completed but text quality was too low to trust. The document may be blurry — consider re-uploading a clearer image.'
          : 'OCR could not process this document. The file may be corrupted or unreadable.',
        document,
      });
    }

    document.extractedData = {
      rawText: result.rawText,
      confidence: result.confidence,
      ...ocrService.parseBasicFields(result.rawText, document.documentType),
    };
    document.markModified('extractedData');
    document.ocrStatus = 'done';
    await document.save();

    // Fire-and-forget: fraud checks must never block or fail the OCR
    // response (same defensive pattern as trust score / notifications).
    fraudDetectionService.runChecksById(document._id).catch((err) => {
      console.error(`[ocr] Automatic fraud check failed: ${err.message}`);
    });

    return res.status(200).json({ message: 'OCR completed', document });
  } catch (err) {
    return next(err);
  }
};

module.exports = { runOcr };
