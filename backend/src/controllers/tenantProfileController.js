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
const updateMyProfile = async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body);
    const validationError = validateIdentityFields(data);
    if (validationError) {
      return res.status(422).json({ error: validationError });
    }

    const profile = await TenantProfile.findOneAndUpdate(
      { userId: req.user.id },
      data,
      { new: true, runValidators: true }
    );
    if (!profile) {
      return res.status(404).json({ error: 'Tenant profile not found' });
    }
    return res.status(200).json({ profile });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createProfile, getMyProfile, updateMyProfile };
