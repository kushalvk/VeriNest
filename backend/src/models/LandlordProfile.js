const mongoose = require('mongoose');

const landlordProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    companyName: { type: String },
    gstNumber: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    bio: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LandlordProfile', landlordProfileSchema);
