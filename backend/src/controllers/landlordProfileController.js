const LandlordProfile = require('../models/LandlordProfile');

// userId always comes from the JWT — strip anything the client sent.
const sanitizeBody = (body = {}) => {
  const data = { ...body };
  delete data.userId;
  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;
  return data;
};

// POST /api/landlord-profile
const createProfile = async (req, res, next) => {
  try {
    const existing = await LandlordProfile.findOne({ userId: req.user.id });
    if (existing) {
      return res
        .status(409)
        .json({ error: 'Landlord profile already exists for this user' });
    }

    const profile = await LandlordProfile.create({
      ...sanitizeBody(req.body),
      userId: req.user.id,
    });
    return res.status(201).json({ profile });
  } catch (err) {
    return next(err);
  }
};

// GET /api/landlord-profile/me
const getMyProfile = async (req, res, next) => {
  try {
    const profile = await LandlordProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ error: 'Landlord profile not found' });
    }
    return res.status(200).json({ profile });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/landlord-profile
const updateMyProfile = async (req, res, next) => {
  try {
    const profile = await LandlordProfile.findOneAndUpdate(
      { userId: req.user.id },
      sanitizeBody(req.body),
      { new: true, runValidators: true }
    );
    if (!profile) {
      return res.status(404).json({ error: 'Landlord profile not found' });
    }
    return res.status(200).json({ profile });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createProfile, getMyProfile, updateMyProfile };
