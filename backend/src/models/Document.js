const mongoose = require('mongoose');

const DOCUMENT_TYPES = [
  'aadhaar',
  'pan',
  'passport',
  'salary_slip',
  'bank_statement',
  'employment_letter',
  'driving_license',
  'agreement',
  'other',
];

const documentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: DOCUMENT_TYPES,
      required: true,
    },
    cloudinary: {
      publicId: { type: String },
      url: { type: String },
    },
    extractedData: { type: Object, default: {} },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    expiryDate: { type: Date },
    ocrStatus: {
      type: String,
      enum: ['not_started', 'processing', 'done', 'failed'],
      default: 'not_started',
    },
    fraudDetected: { type: Boolean, default: false },
    duplicateDetected: { type: Boolean, default: false },
    blurryDocument: { type: Boolean, default: false },
    remarks: { type: String },
    // Perceptual (average) hash for duplicate detection — internal only.
    perceptualHash: { type: String, select: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      // Safety net: even when explicitly selected, the hash must never
      // serialize into an API response.
      transform(doc, ret) {
        delete ret.perceptualHash;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Document', documentSchema);
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
