const jwt = require('jsonwebtoken');

// Populates req.user when a valid access token is present; otherwise leaves it
// unset and continues. Public routes use this only to widen visibility for
// the owner/admin — never to restrict anyone.
const optionalAuth = (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme === 'Bearer' && token) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            req.user = {
                id: payload.id || payload.userId || payload.sub,
                role: payload.role,
            };
        } catch (err) {
            // invalid/expired token → treated as anonymous
        }
    }
    next();
};

module.exports = optionalAuth;