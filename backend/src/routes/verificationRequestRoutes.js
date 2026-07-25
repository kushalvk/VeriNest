const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/verificationRequestController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', requireRole('landlord'), controller.createRequest);
router.get('/mine', requireRole('tenant'), controller.listMyRequests);
router.get('/landlord', requireRole('landlord'), controller.listLandlordRequests);
router.patch('/:id/respond', requireRole('tenant'), controller.respondToRequest);
router.get('/:id/documents', requireRole('landlord'), controller.accessDocumentsForLandlord);

module.exports = router;
