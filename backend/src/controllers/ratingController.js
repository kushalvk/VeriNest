const Rating = require('../models/Rating');
const { submitRating: submitAgreementRating } = require('./agreementLifecycleController');

// POST /api/ratings/:agreementId  (kept for backward compatibility)
// Delegates to the lifecycle controller so there is a single rating implementation.
const submitRating = (req, res, next) => {
  req.params.id = req.params.agreementId || req.params.id;
  return submitAgreementRating(req, res, next);
};

// GET /api/ratings/mine — ratings received by the current user
const getMyRatings = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = { ratee: req.user.id };
    const [ratings, total] = await Promise.all([
      Rating.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('rater', 'fullName')
          .populate('agreementId', 'agreementNumber'),
      Rating.countDocuments(filter),
    ]);

    return res.status(200).json({
      ratings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { submitRating, getMyRatings };