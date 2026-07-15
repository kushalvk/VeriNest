const crypto = require('crypto');

const OTP_TTL_MS = 10 * 60 * 1000;

// Cryptographically random 6-digit numeric string ("100000"–"999999")
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

module.exports = { generateOtp, OTP_TTL_MS };
