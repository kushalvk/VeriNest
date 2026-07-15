const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/verificationRequestController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', requireRole('landlord'), controller.createRequest);
router.get('/mine', requireRole('tenant'), controller.listMyRequests);
router.patch('/:id/respond', requireRole('tenant'), controller.respondToRequest);

module.exports = router;
