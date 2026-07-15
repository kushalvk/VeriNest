const crypto = require('crypto');

/** 32 bytes of cryptographic entropy → 64-char hex string. */
const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

/**
 * SHA-256 hash for storage/lookup. Only the hash is ever persisted — same
 * principle as refresh tokens. (SHA-256 rather than bcrypt because the
 * token has 256 bits of entropy, so brute-forcing the hash is infeasible
 * and we need an exact-match DB lookup.)
 */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

module.exports = { generateSecureToken, hashToken };
