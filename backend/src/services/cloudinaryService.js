const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

const FOLDERS = {
  documents: 'tenant-verification/documents',
  properties: 'tenant-verification/properties',
  agreements: 'tenant-verification/agreements',
};

/**
 * Uploads a file buffer to Cloudinary. Returns { publicId, url }.
 * Throws a config error (status 500) when credentials are missing —
 * callers should validate everything else BEFORE invoking this.
 *
 * Pass options.publicId to overwrite an existing asset in place (used for
 * re-uploading agreement PDFs after each signature); the returned versioned
 * URL changes on every overwrite, so CDN caching never serves a stale copy.
 *
 * Pass options.resourceType: 'raw' for PDFs — Cloudinary blocks public
 * delivery of image-typed PDFs by default (returns 401), but raw assets
 * deliver normally.
 */
const uploadToCloudinary = (fileBuffer, folder, options = {}) => {
  if (!isCloudinaryConfigured()) {
    const err = new Error(
      'File storage is not configured. Set the CLOUDINARY_* environment variables.'
    );
    err.status = 500;
    return Promise.reject(err);
  }

  const resourceType = options.resourceType || 'auto';
  const uploadOptions = options.publicId
    ? {
        resource_type: resourceType,
        public_id: options.publicId, // already includes the folder path
        overwrite: true,
        invalidate: true,
      }
    : { resource_type: resourceType, folder };

  console.log(
    `[cloudinary] Uploading to ${options.publicId ? `existing asset "${options.publicId}"` : `folder "${folder}"`}...`
  );

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        return resolve({ publicId: result.public_id, url: result.secure_url });
      }
    );
    stream.end(fileBuffer);
  });
};

module.exports = { uploadToCloudinary, FOLDERS };
