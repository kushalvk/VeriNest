const mongoose = require('mongoose');

const { Schema } = mongoose;

/** One entry per early-termination request. Kept as history. */
const endRequestSchema = new Schema({
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedByRole: { type: String, enum: ['tenant', 'landlord'], required: true },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    requestedAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending',
    },
    respondedAt: { type: Date },
    responseNote: { type: String, trim: true, maxlength: 300 },
});

const agreementSchema = new Schema(
    {
        tenantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        landlordId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
        applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
        agreementNumber: { type: String, required: true, unique: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        monthlyRent: { type: Number, required: true },
        deposit: { type: Number },
        agreementPdf: {
            publicId: { type: String },
            url: { type: String },
        },

        // ---- Signing ----
        tenantSigned: { type: Boolean, default: false },
        landlordSigned: { type: Boolean, default: false },
        tenantSignedAt: { type: Date },
        landlordSignedAt: { type: Date },
        signedAt: { type: Date }, // set when BOTH have signed (= activation time)

        // draft          -> waiting for signatures
        // active         -> both signed
        // end_requested  -> early-end request waiting for the other party
        // completed      -> ended on/after endDate
        // terminated     -> ended early with the other party's approval
        status: {
            type: String,
            enum: ['draft', 'active', 'end_requested', 'completed', 'terminated'],
            default: 'draft',
            index: true,
        },

        // ---- Ending ----
        endRequests: { type: [endRequestSchema], default: [] },
        endedAt: { type: Date },
        endType: { type: String, enum: ['natural', 'early_approved'] },

        // ---- Ratings (unlocked once completed or terminated) ----
        tenantRated: { type: Boolean, default: false },
        landlordRated: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// ---------- Indexes ----------
agreementSchema.index({ landlordId: 1, status: 1 });
agreementSchema.index({ tenantId: 1, status: 1 });
agreementSchema.index({ status: 1, endDate: 1 }); // auto-end job

// ---------- Validation (sync throw works in every Mongoose version) ----------
agreementSchema.pre('validate', function () {
    if (this.startDate && this.endDate && this.endDate <= this.startDate) {
        throw new Error('endDate must be after startDate');
    }
});

// ---------- Virtuals ----------
agreementSchema.virtual('isFullySigned').get(function () {
    return this.tenantSigned && this.landlordSigned;
});

agreementSchema.virtual('isEnded').get(function () {
    return this.status === 'completed' || this.status === 'terminated';
});

agreementSchema.virtual('pendingEndRequest').get(function () {
    return this.endRequests.find((r) => r.status === 'pending') || null;
});

// ---------- Instance methods ----------

/** 'tenant' | 'landlord' | null */
agreementSchema.methods.getRoleOf = function (userId) {
    const id = String(userId);
    if (String(this.tenantId) === id) return 'tenant';
    if (String(this.landlordId) === id) return 'landlord';
    return null;
};

/** Record a signature; activates the agreement when both have signed. */
agreementSchema.methods.signAs = function (role) {
    const now = new Date();
    if (role === 'tenant') {
        this.tenantSigned = true;
        this.tenantSignedAt = now;
    } else if (role === 'landlord') {
        this.landlordSigned = true;
        this.landlordSignedAt = now;
    } else {
        throw new Error('Invalid role');
    }

    if (this.tenantSigned && this.landlordSigned) {
        this.status = 'active';
        this.signedAt = now;
    }
};

/** endType: 'natural' -> completed, 'early_approved' -> terminated */
agreementSchema.methods.finalize = function (endType) {
    this.status = endType === 'natural' ? 'completed' : 'terminated';
    this.endType = endType;
    this.endedAt = new Date();
};

agreementSchema.set('toJSON', { virtuals: true });
agreementSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Agreement', agreementSchema);