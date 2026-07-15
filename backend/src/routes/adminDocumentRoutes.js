const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/adminDocumentController');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.get('/', controller.listPendingDocuments);
router.patch('/:id', controller.updateDocumentStatus);

module.exports = router;
