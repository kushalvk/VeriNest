const multer = require('multer');
const { MAX_BILL_BYTES } = require('../services/propertyVerificationService');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BILL_BYTES, files: 1 },
});

// Single file, multipart field "taxBill". Multer errors become clean JSON
// in the project's { error } shape instead of reaching the generic handler.
const taxBillUpload = (req, res, next) => {
    upload.single('taxBill')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                error: `Tax bill must be ${Math.round(MAX_BILL_BYTES / 1024 / 1024)} MB or smaller`,
            });
        }
        return res.status(400).json({
            error: 'Invalid upload (send one file in the "taxBill" field)',
        });
    });
};

module.exports = taxBillUpload;