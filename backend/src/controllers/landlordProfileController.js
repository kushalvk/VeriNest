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
// Idempotent "save my profile": updates the caller's profile, or creates it if
// none exists yet (upsert) — safe to call regardless of the client's stale
// create/edit state, with no 404 and no duplicate (unique userId index).
const updateMyProfile = async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body);
    let profile;
    try {
      profile = await LandlordProfile.findOneAndUpdate(
        { userId: req.user.id },
        { $set: data, $setOnInsert: { userId: req.user.id } },
        { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      // Only a userId-index duplicate is the legitimate concurrent double-submit
      // race — see tenantProfileController for the full rationale. Other
      // duplicate-key errors must surface, not be masked as a silent success.
      const isUserIdRace = err && err.code === 11000 && err.keyPattern && err.keyPattern.userId;
      if (!isUserIdRace) throw err;
      profile = await LandlordProfile.findOneAndUpdate(
        { userId: req.user.id },
        { $set: data },
        { returnDocument: 'after', runValidators: true }
      );
    }
    return res.status(200).json({ profile });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createProfile, getMyProfile, updateMyProfile };
