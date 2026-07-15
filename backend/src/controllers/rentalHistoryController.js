const mongoose = require('mongoose');
const RentalHistory = require('../models/RentalHistory');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const trustScoreService = require('../services/trustScoreService');

/**
 * INTERNAL — not a route. Called when an Agreement flips to "active"
 * (both parties signed). This is the ONLY way rental records come into
 * existence; there is deliberately no client-facing create endpoint.
 * agreementId is unique, so a double trigger cannot create duplicates.
 */
const createRentalRecord = async (agreement) => {
  try {
    return await RentalHistory.create({
      tenantId: agreement.tenantId,
      landlordId: agreement.landlordId,
      propertyId: agreement.propertyId,
      agreementId: agreement._id,
      moveInDate: agreement.startDate,
      rentAmount: agreement.monthlyRent,
      securityDeposit: agreement.deposit,
      paymentStatus: 'clear',
    });
  } catch (err) {
    if (err.code === 11000) return null; // record already exists — fine
    throw err;
  }
};

// Resolves the record and which side the caller is on ('tenant'|'landlord').
const loadRecordForParty = async (id, userId) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return { status: 404 };
  const record = await RentalHistory.findById(id);
  if (!record) return { status: 404 };

  let party = null;
  if (record.tenantId.toString() === userId) party = 'tenant';
  else if (record.landlordId.toString() === userId) party = 'landlord';
  if (!party) return { status: 403 };

  return { record, party };
};

// PATCH /api/rental-history/:id/complete  body: { moveOutDate }
const completeRental = async (req, res, next) => {
  try {
    const { record, status } = await loadRecordForParty(req.params.id, req.user.id);
    if (!record) {
      return res.status(status).json({
        error: status === 404 ? 'Rental record not found' : 'Forbidden: you are not a party to this rental',
      });
    }

    const moveOutDate = new Date(req.body?.moveOutDate);
    if (!req.body?.moveOutDate || Number.isNaN(moveOutDate.getTime())) {
      return res.status(422).json({ error: 'A valid moveOutDate is required' });
    }

    record.moveOutDate = moveOutDate;
    await record.save();
    return res.status(200).json({ rentalHistory: record });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/rental-history/:id/rate  body: { rating: 1-5, review? }
const submitRating = async (req, res, next) => {
  try {
    const { record, party, status } = await loadRecordForParty(req.params.id, req.user.id);
    if (!record) {
      return res.status(status).json({
        error: status === 404 ? 'Rental record not found' : 'Forbidden: you are not a party to this rental',
      });
    }

    const { rating, review } = req.body || {};
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(422).json({ error: 'rating must be an integer from 1 to 5' });
    }

    // Direction is fixed by the caller's identity, never by the client:
    // the tenant rates the LANDLORD; the landlord rates the TENANT.
    if (party === 'tenant') {
      record.landlordRating = rating;
      if (review !== undefined) record.landlordReview = String(review);
    } else {
      record.tenantRating = rating;
      if (review !== undefined) record.tenantReview = String(review);
    }
    await record.save();

    // Only a landlord-given rating feeds the TENANT's trust score.
    if (party === 'landlord') {
      try {
        await trustScoreService.recalculateAndPersist(record.tenantId, 'System');
      } catch (err) {
        console.error(`[rental-history] Trust score recalculation failed: ${err.message}`);
      }
    }

    // Email the RATED party — direction mirrors the rating itself.
    const ratedPartyId = party === 'tenant' ? record.landlordId : record.tenantId;
    try {
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
      console.error(`[rental-history] Notification creation failed: ${err.message}`);
    }

    return res.status(200).json({ rentalHistory: record });
  } catch (err) {
    return next(err);
  }
};

// GET /api/rental-history/mine — whichever side the caller is on
const getMyRentalHistory = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = {
      $or: [{ tenantId: req.user.id }, { landlordId: req.user.id }],
    };
    const [records, total] = await Promise.all([
      RentalHistory.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('propertyId', 'title address.city'),
      RentalHistory.countDocuments(filter),
    ]);

    return res.status(200).json({
      rentalHistory: records,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createRentalRecord,
  completeRental,
  submitRating,
  getMyRentalHistory,
};
