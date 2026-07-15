const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/tenantProfileController');

const router = express.Router();

router.use(authMiddleware, requireRole('tenant'));

router.post('/', controller.createProfile);
router.get('/me', controller.getMyProfile);
router.put('/', controller.updateMyProfile);

module.exports = router;
