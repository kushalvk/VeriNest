const mongoose = require('mongoose');

const addressSchema = {
  addressLine1: { type: String },
  addressLine2: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
};

const tenantProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    dob: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    occupation: { type: String },
    companyName: { type: String },
    designation: { type: String },
    employmentType: {
      type: String,
      enum: ['Full Time', 'Part Time', 'Business', 'Student', 'Other'],
    },
    monthlySalary: { type: Number },
    aadhaarNumber: { type: String },
    panNumber: { type: String },
    passportNumber: { type: String },
    currentAddress: addressSchema,
    permanentAddress: addressSchema,
    emergencyContact: {
      name: { type: String },
      relation: { type: String },
      phone: { type: String },
    },
    familyMembers: [
      {
        name: { type: String },
        relation: { type: String },
        age: { type: Number },
      },
    ],
    policeVerificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    trustScore: { type: Number, default: 0 },
    trustReason: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('TenantProfile', tenantProfileSchema);
