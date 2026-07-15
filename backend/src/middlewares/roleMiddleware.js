/**
 * Restricts a route to the given roles. Must run after authMiddleware,
 * which attaches the decoded JWT payload ({ id, role }) to req.user.
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  }
  return next();
};

module.exports = { requireRole };
