const mongoose = require('mongoose');

const agreementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    agreementNumber: { type: String, required: true, unique: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    monthlyRent: { type: Number, required: true },
    deposit: { type: Number },
    agreementPdf: {
      publicId: { type: String },
      url: { type: String },
    },
    tenantSigned: { type: Boolean, default: false },
    landlordSigned: { type: Boolean, default: false },
    signedAt: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'terminated'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Agreement', agreementSchema);
