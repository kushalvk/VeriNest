const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/landlordProfileController');

const router = express.Router();

router.use(authMiddleware, requireRole('landlord'));

router.post('/', controller.createProfile);
router.get('/me', controller.getMyProfile);
router.put('/', controller.updateMyProfile);

module.exports = router;
