const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/applicationController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', requireRole('tenant'), controller.applyToProperty);
router.get('/mine', requireRole('tenant'), controller.getMyApplications);
router.get('/received', requireRole('landlord'), controller.getReceivedApplications);
router.get('/:id/tenant-profile', requireRole('landlord'), controller.getTenantSummary);
router.patch('/:id', requireRole('landlord'), controller.updateApplicationStatus);

module.exports = router;
