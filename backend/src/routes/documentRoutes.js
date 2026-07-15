const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const { singleFile } = require('../middlewares/uploadMiddleware');
const controller = require('../controllers/documentController');
const ocrController = require('../controllers/ocrController');
const fraudCheckController = require('../controllers/fraudCheckController');

const router = express.Router();

const tenantOnly = [authMiddleware, requireRole('tenant')];

router.post('/upload', tenantOnly, singleFile('file'), controller.uploadDocument);
router.get('/my', tenantOnly, controller.getMyDocuments);
router.post('/:id/ocr', tenantOnly, ocrController.runOcr);
// Tenant (own doc — enforced in controller) or admin (any doc)
router.post(
  '/:id/fraud-check',
  authMiddleware,
  requireRole('tenant', 'admin'),
  fraudCheckController.runFraudCheck
);

module.exports = router;
