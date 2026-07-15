const authService = require('../services/authService');

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Authentication required. Provide a Bearer token.' });
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    req.user = authService.verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
};

module.exports = authMiddleware;
