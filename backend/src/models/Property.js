const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    propertyType: { type: String },
    rent: { type: Number, required: true },
    securityDeposit: { type: Number },
    furnishing: { type: String },
    bedrooms: { type: Number },
    bathrooms: { type: Number },
    area: { type: Number },
    amenities: [{ type: String }],
    address: {
      addressLine: { type: String },
      city: { type: String, required: true },
      state: { type: String },
      pincode: { type: String },
    },
    images: [
      {
        publicId: { type: String },
        url: { type: String },
      },
    ],
    availability: { type: Date },
    rules: [{ type: String }],
    status: {
      type: String,
      enum: ['available', 'occupied', 'inactive'],
      default: 'available',
    },
  },
  { timestamps: true }
);

// Serves city + status + rent-range queries (Task 9 search)
propertySchema.index({ 'address.city': 1, status: 1, rent: 1 });

module.exports = mongoose.model('Property', propertySchema);
