const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const authRoutes = require('./routes/authRoutes');
const otpRoutes = require('./routes/otpRoutes');
const tenantProfileRoutes = require('./routes/tenantProfileRoutes');
const landlordProfileRoutes = require('./routes/landlordProfileRoutes');
const documentRoutes = require('./routes/documentRoutes');
const adminDocumentRoutes = require('./routes/adminDocumentRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const verificationRequestRoutes = require('./routes/verificationRequestRoutes');
const verificationAccessRoutes = require('./routes/verificationAccessRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const trustScoreRoutes = require('./routes/trustScoreRoutes');
const agreementRoutes = require('./routes/agreementRoutes');
const rentalHistoryRoutes = require('./routes/rentalHistoryRoutes');
const chatRoutes = require('./routes/chatRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Behind Vercel/most reverse proxies the client IP arrives in
// X-Forwarded-For. Trust exactly one proxy hop so req.ip (used by the
// express-rate-limit keyers) resolves to the real client — without this,
// express-rate-limit v8 rejects every request that carries the header.
app.set('trust proxy', 1);

// helmet v8 defaults already include Content-Security-Policy, HSTS,
// X-Content-Type-Options, frameguard, etc. — applied in all environments.
app.use(helmet());

// CORS: explicit allowlist from ALLOWED_ORIGINS (comma-separated).
// Requests without an Origin header (curl, server-to-server, tests) are
// allowed; browser requests from non-allowlisted origins get no CORS
// headers and are blocked by the browser.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false); // no CORS headers → browser blocks
    },
  })
);

// 2mb (not the 100kb default) because agreement signing sends a base64
// signature image in JSON — up to 1MB of image ≈ 1.4MB encoded.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// NoSQL injection defense: strip keys starting with "$" or containing "."
// from all inbound containers. Express 5 exposes req.query via a getter,
// so sanitize each object IN PLACE — app.use(mongoSanitize()) would throw
// when the library tries to reassign req.query.
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

if (process.env.NODE_ENV !== 'production') {
  // Verification access tokens travel in the URL path — redact them so
  // request logging never captures a usable raw token.
  morgan.token('url', (req) =>
    (req.originalUrl || req.url).replace(
      /(\/verification\/access\/)[^/?\s]+/i,
      '$1<redacted>'
    )
  );
  app.use(morgan('dev'));
}

const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.use('/auth/otp', otpRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/tenant-profile', tenantProfileRoutes);
apiRouter.use('/landlord-profile', landlordProfileRoutes);
apiRouter.use('/documents', documentRoutes);
apiRouter.use('/admin/documents', adminDocumentRoutes);
apiRouter.use('/properties', propertyRoutes);
apiRouter.use('/applications', applicationRoutes);
apiRouter.use('/verification-requests', verificationRequestRoutes);
apiRouter.use('/verification', verificationAccessRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/trust-score', trustScoreRoutes);
apiRouter.use('/agreements', agreementRoutes);
apiRouter.use('/rental-history', rentalHistoryRoutes);
apiRouter.use('/chat', chatRoutes);

app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Central error handler — must stay last
app.use(errorHandler);

module.exports = app;
