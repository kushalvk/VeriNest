const TenantProfile = require('../models/TenantProfile');

const AADHAAR_REGEX = /^\d{12}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Returns an error string, or null when the identity fields are valid.
const validateIdentityFields = ({ aadhaarNumber, panNumber }) => {
  if (aadhaarNumber !== undefined && !AADHAAR_REGEX.test(aadhaarNumber)) {
    return 'Aadhaar number must be exactly 12 digits';
  }
  if (panNumber !== undefined && !PAN_REGEX.test(panNumber)) {
    return 'PAN must match the format AAAAA9999A (5 letters, 4 digits, 1 letter)';
  }
  return null;
};

// userId always comes from the JWT — strip anything the client sent.
const sanitizeBody = (body = {}) => {
  const data = { ...body };
  delete data.userId;
  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;
  return data;
};

// POST /api/tenant-profile
const createProfile = async (req, res, next) => {
  try {
    const existing = await TenantProfile.findOne({ userId: req.user.id });
    if (existing) {
      return res
        .status(409)
        .json({ error: 'Tenant profile already exists for this user' });
    }

    const data = sanitizeBody(req.body);
    const validationError = validateIdentityFields(data);
    if (validationError) {
      return res.status(422).json({ error: validationError });
    }

    const profile = await TenantProfile.create({
      ...data,
      userId: req.user.id,
    });
    return res.status(201).json({ profile });
  } catch (err) {
    return next(err);
  }
};

// GET /api/tenant-profile/me
const getMyProfile = async (req, res, next) => {
  try {
    const profile = await TenantProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ error: 'Tenant profile not found' });
    }
    return res.status(200).json({ profile });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/tenant-profile
// Idempotent "save my profile": updates the caller's profile, or creates it if
// none exists yet (upsert). This makes the endpoint safe for the frontend to
// call regardless of whether it thinks a profile already exists — no 404 when
// the client's create/edit state is stale, and no duplicate thanks to the
// unique userId index. `userId` always comes from the JWT (sanitizeBody strips
// any client-sent value) and the filter supplies it on insert.
const updateMyProfile = async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body);
    const validationError = validateIdentityFields(data);
    if (validationError) {
      return res.status(422).json({ error: validationError });
    }

    let profile;
    try {
      profile = await TenantProfile.findOneAndUpdate(
        { userId: req.user.id },
        { $set: data, $setOnInsert: { userId: req.user.id } },
        { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      // A duplicate-key error ON THE userId INDEX is the legitimate concurrent
      // double-submit race: two upserts both miss the existing doc and try to
      // insert; the unique userId index rejects the loser. The record now
      // exists, so just apply this update to it. Any OTHER duplicate-key error
      // (e.g. a stale/legacy unique index left on an optional field) is a real
      // problem and must surface — never mask it as a silent success.
      const isUserIdRace = err && err.code === 11000 && err.keyPattern && err.keyPattern.userId;
      if (!isUserIdRace) throw err;
      profile = await TenantProfile.findOneAndUpdate(
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
