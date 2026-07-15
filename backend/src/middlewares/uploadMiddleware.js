const multer = require('multer');

const DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];
// 4MB per file — must stay under Vercel's 4.5MB serverless request-body
// cap, or oversized uploads get a platform 413 instead of our JSON error.
const MAX_FILE_SIZE = 4 * 1024 * 1024;

const makeUploader = (allowedMimeTypes, allowedLabel) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        const err = new Error(
          `Unsupported file type. Only ${allowedLabel} files are allowed.`
        );
        err.status = 400;
        return cb(err);
      }
      return cb(null, true);
    },
  });

const documentUpload = makeUploader(DOCUMENT_MIME_TYPES, 'JPG, PNG and PDF');
const imageUpload = makeUploader(IMAGE_MIME_TYPES, 'JPG and PNG');

// Converts raw MulterErrors into clean errors for the central errorHandler.
const normalizeMulterError = (err, next) => {
  if (err instanceof multer.MulterError) {
    let message = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'File exceeds 4MB limit';
    if (err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Too many files uploaded';
    const clean = new Error(message);
    clean.status = 400;
    return next(clean);
  }
  if (!err.status) err.status = 400;
  return next(err);
};

/** Single document upload (jpg/png/pdf, 4MB) — used by /documents/upload. */
const singleFile = (fieldName) => (req, res, next) => {
  documentUpload.single(fieldName)(req, res, (err) => {
    if (!err) return next();
    return normalizeMulterError(err, next);
  });
};

/** Multi-image upload (jpg/png only, 4MB each) — used by property images. */
const imagesArray = (fieldName, maxCount) => (req, res, next) => {
  imageUpload.array(fieldName, maxCount)(req, res, (err) => {
    if (!err) return next();
    return normalizeMulterError(err, next);
  });
};

module.exports = {
  singleFile,
  imagesArray,
  ALLOWED_MIME_TYPES: DOCUMENT_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_FILE_SIZE,
};
