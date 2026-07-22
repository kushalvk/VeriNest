const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const authService = require('../services/authService');
const googleAuthService = require('../services/googleAuthService');

// Session creation is shared with every other sign-in path — see
// authService.issueSession.
const { issueSession } = authService;

// POST /api/auth/google   body: { idToken }
const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body || {};

    // (a) Verify the token's signature + audience server-side. The browser
    // could send anything, so nothing below runs until this succeeds.
    let payload;
    try {
      payload = await googleAuthService.verifyGoogleToken(idToken);
    } catch (err) {
      return res.status(err.statusCode || 401).json({ error: err.message });
    }

    // Trust the email as pre-verified ONLY if Google itself says so. If Google
    // has not verified this exact address we refuse to key an account off it —
    // that is the sole condition under which auto-linking by email is safe.
    if (!payload.email_verified) {
      return res.status(401).json({
        error: 'Your Google email is not verified. Please verify it with Google first.',
      });
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;

    // (b) Prefer the stable Google subject id; fall back to email. googleId is
    // select:false, so ask for it explicitly here.
    let user = await User.findOne({ googleId }).select('+googleId');
    if (!user) {
      user = await User.findOne({ email }).select('+googleId');
    }

    if (user) {
      if (user.accountStatus === 'blocked') {
        return res.status(403).json({ error: 'This account has been blocked' });
      }

      // (c) Account linking. A pre-existing email/password account with this
      // verified Google email is the SAME person — Google's verification is
      // authoritative, so linking cannot be abused to take over an account an
      // attacker doesn't control (they would need Google to vouch for the
      // address, which only the real owner can obtain). We attach googleId as
      // an additional identifier but deliberately DO NOT touch authProvider or
      // the existing password, so the user keeps password login too.
      if (!user.googleId) {
        user.googleId = googleId;
      }
      // Google has verified the address, so reflect that (harmless if already true).
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
      }
    } else {
      // (d) Brand-new user: create from the verified Google profile. No
      // password, no phone, isEmailVerified true (Google substitutes for OTP),
      // account immediately active. role is intentionally left unset — the
      // frontend routes first-time Google users through /select-role before
      // any role-gated feature (PATCH /api/auth/set-role).
      user = await User.create({
        fullName: payload.name || email.split('@')[0],
        email,
        authProvider: 'google',
        googleId,
        isEmailVerified: true,
        accountStatus: 'active',
        profileImage: payload.picture ? { url: payload.picture } : undefined,
      });
    }

    // (e) Issue tokens exactly like the normal login controller and (f) return
    // the identical response shape so the frontend reuses its auth handling.
    const { accessToken, refreshToken } = await issueSession(user);
    return res.status(200).json({ accessToken, refreshToken, user });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/auth/set-role   (auth required)   body: { role }
// One-time role selection for a freshly created Google account. Only allowed
// while the role is still unset — this endpoint can never be used to CHANGE an
// existing role, only to fill in a missing one.
const setRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!['tenant', 'landlord'].includes(role)) {
      return res
        .status(422)
        .json({ error: 'role must be "tenant" or "landlord"' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role) {
      // Already onboarded — refuse to let anyone re-pick their role here.
      return res.status(409).json({ error: 'Your account role is already set.' });
    }

    user.role = role;
    await user.save();

    // The old access/refresh tokens carry role:undefined baked into their JWT
    // payload (and /auth/refresh mints access tokens from the refresh token's
    // claims, not the DB), so they would keep the user role-less. Revoke every
    // existing session and hand back a fresh, correctly-roled token pair the
    // frontend swaps in — mirroring the login response shape.
    await RefreshToken.deleteMany({ userId: user._id });
    const { accessToken, refreshToken } = await issueSession(user);

    return res.status(200).json({ accessToken, refreshToken, user });
  } catch (err) {
    return next(err);
  }
};

module.exports = { googleLogin, setRole };
