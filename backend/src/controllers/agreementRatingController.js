const mongoose = require('mongoose');
const Agreement = require('../models/Agreement');
const RentalHistory = require('../models/RentalHistory');
const User = require('../models/User');
const trustScoreService = require('../services/trustScoreService');

// Works whether the service exports the object directly or as { notificationService }
const notificationModule = require('../services/notificationService');
const notificationService = notificationModule.notificationService || notificationModule;

const ENDED_STATUSES = ['completed', 'terminated'];

// Finds the rental record for an ended agreement, or creates / completes it.
const ensureRecord = async (agreement) => {
    const moveOutDate =
        agreement.endType === 'natural' && agreement.endDate
            ? agreement.endDate
            : agreement.endedAt || new Date();

    let record = await RentalHistory.findOne({ agreementId: agreement._id });

    if (!record) {
        record = await RentalHistory.create({
            tenantId: agreement.tenantId,
            landlordId: agreement.landlordId,
            propertyId: agreement.propertyId,
            agreementId: agreement._id,
            moveInDate: agreement.startDate,
            rentAmount: agreement.monthlyRent,
            ...(agreement.deposit != null ? { securityDeposit: agreement.deposit } : {}),
            paymentStatus: 'clear',
            moveOutDate,
        });
    } else if (!record.moveOutDate) {
        record.moveOutDate = moveOutDate;
        await record.save();
    }
    return record;
};

// POST /api/agreements/:id/rate   body: { rating: 1-5, review? }
const rateAgreement = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ error: 'Agreement not found' });
        }
        const agreement = await Agreement.findById(id);
        if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

        const userId = String(req.user.id);
        let party = null;
        if (String(agreement.tenantId) === userId) party = 'tenant';
        else if (String(agreement.landlordId) === userId) party = 'landlord';
        if (!party) {
            return res.status(403).json({ error: 'Forbidden: you are not a party to this agreement' });
        }

        if (!ENDED_STATUSES.includes(agreement.status)) {
            return res.status(400).json({ error: 'You can rate only after the agreement has ended' });
        }

        const rating = Number(req.body?.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(422).json({ error: 'Rating must be a whole number from 1 to 5' });
        }
        const review = typeof req.body?.review === 'string' ? req.body.review.trim().slice(0, 500) : '';

        let record;
        try {
            record = await ensureRecord(agreement);
        } catch (err) {
            console.error(`[agreement-rating] Could not prepare rental record: ${err.message}`);
            return res.status(500).json({ error: `Could not prepare the rental record: ${err.message}` });
        }

        // Direction is fixed by identity: tenant rates the LANDLORD, landlord rates the TENANT.
        const alreadyRated = party === 'tenant' ? record.landlordRating != null : record.tenantRating != null;
        if (alreadyRated) {
            return res.status(409).json({ error: 'You have already rated this rental' });
        }

        if (party === 'tenant') {
            record.landlordRating = rating;
            if (review) record.landlordReview = review;
        } else {
            record.tenantRating = rating;
            if (review) record.tenantReview = review;
        }
        await record.save();

        // keep the agreement flags in sync too
        await Agreement.updateOne(
            { _id: agreement._id },
            { $set: { [party === 'tenant' ? 'tenantRated' : 'landlordRated']: true } }
        );

        // Only a landlord-given rating feeds the TENANT's trust score.
        if (party === 'landlord') {
            try {
                await trustScoreService.recalculateAndPersist(record.tenantId, 'System');
            } catch (err) {
                console.error(`[agreement-rating] Trust score recalculation failed: ${err.message}`);
            }
        }

        // Email the rated party (best-effort)
        try {
            const ratedPartyId = party === 'tenant' ? record.landlordId : record.tenantId;
            const ratedUser = await User.findById(ratedPartyId).select('fullName');
            await notificationService.createNotification({
                receiverId: ratedPartyId,
                title: "You've received a new rating",
                message: `You received a ${rating}-star rating from your ${party === 'tenant' ? 'tenant' : 'landlord'} on a completed rental.`,
                type: 'email',
                event: 'general',
                emailTemplate: {
                    templateName: 'ratingReceived',
                    templateArgs: [ratedUser?.fullName],
                },
            });
        } catch (err) {
            console.error(`[agreement-rating] Notification failed: ${err.message}`);
        }

        return res.status(200).json({ rentalHistory: record });
    } catch (err) {
        return next(err);
    }
};

module.exports = { rateAgreement };