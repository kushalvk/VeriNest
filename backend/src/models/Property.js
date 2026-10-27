const mongoose = require('mongoose');

const VERIFICATION_STATUSES = ['not_submitted', 'pending', 'verified', 'rejected'];

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

        // Landlord-side verification (house tax bill). Never client-writable —
        // propertyController.sanitizeBody strips every "verification*" key.
        verification: {
            status: {
                type: String,
                enum: VERIFICATION_STATUSES,
                default: 'not_submitted',
            },
            // true for listings that existed before this feature (migration script)
            grandfathered: { type: Boolean, default: false },
            taxBill: {
                publicId: { type: String },
                url: { type: String },
                uploadedAt: { type: Date },
            },
            ocr: {
                status: {
                    type: String,
                    enum: ['not_started', 'done', 'failed'],
                    default: 'not_started',
                },
                rawText: { type: String },
                confidence: { type: Number },
                extracted: {
                    ownerName: { type: String },
                    propertyTaxId: { type: String },
                    billYear: { type: String },
                    amount: { type: String },
                },
            },
            // Advisory signals for the admin — never auto-approve/reject from these.
            autoChecks: {
                ownerNameMatch: { type: Number, default: null }, // 0-100, null = unknown
                addressMatch: { type: Number, default: null }, // 0-100, null = unknown
                billYearValid: { type: Boolean, default: null }, // null = year not found
                duplicateBill: { type: Boolean, default: false },
                lowOcrConfidence: { type: Boolean, default: false },
            },
            attempts: { type: Number, default: 0 },
            reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            reviewedAt: { type: Date },
            rejectionReason: { type: String },
        },
    },
    { timestamps: true }
);

// Serves city + status + rent-range queries (Task 9 search)
propertySchema.index({ 'address.city': 1, status: 1, rent: 1 });
// Tenant search now always filters on verification.status too
propertySchema.index({
    'verification.status': 1,
    status: 1,
    'address.city': 1,
    rent: 1,
});
// Admin review queue + duplicate-bill lookup
propertySchema.index({ 'verification.status': 1, 'verification.taxBill.uploadedAt': 1 });
propertySchema.index({ 'verification.ocr.extracted.propertyTaxId': 1 }, { sparse: true });

module.exports = mongoose.model('Property', propertySchema);
module.exports.VERIFICATION_STATUSES = VERIFICATION_STATUSES;