const { uploadToCloudinary, FOLDERS } = require('./cloudinaryService');

// Kept as a thin wrapper so document uploads keep their default folder;
// the shared logic lives in cloudinaryService.js.
module.exports = {
  uploadToCloudinary: (fileBuffer, folder = FOLDERS.documents) =>
    uploadToCloudinary(fileBuffer, folder),
  DOCUMENTS_FOLDER: FOLDERS.documents,
};
