const DUPLICATE_FIELD_MESSAGES = {
  email: 'Email already registered',
  phone: 'Phone number already registered',
};

// Central error handler — must be registered last in app.js.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Mongoose/MongoDB duplicate key (unique index violation)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const message =
      DUPLICATE_FIELD_MESSAGES[field] ||
      `A record with this ${field || 'value'} already exists`;
    return res.status(409).json({ error: message });
  }

  // Multer upload errors (uploadMiddleware normalizes the common ones,
  // but catch any that arrive raw)
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 4MB limit' : err.message;
    return res.status(400).json({ error: message });
  }

  // Mongoose schema validation errors
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(422).json({
      error: details.length ? details.join('; ') : 'Validation failed',
    });
  }

  // Malformed ObjectId and similar cast failures
  if (err.name === 'CastError') {
    return res.status(422).json({ error: `Invalid value for ${err.path}` });
  }

  // Log the full error (with stack) server-side only. Clients never
  // receive stack traces or file paths in ANY environment; outside
  // production a `detail` field carries err.message to aid debugging.
  console.error(err);
  const body = { error: err.status ? err.message : 'Internal server error' };
  if (process.env.NODE_ENV !== 'production' && !err.status) {
    body.detail = err.message;
  }
  return res.status(err.status || 500).json(body);
};

module.exports = errorHandler;
