const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const controller = require('../controllers/notificationController');

const router = express.Router();

router.use(authMiddleware);

router.get('/mine', controller.getMyNotifications);
router.patch('/:id/read', controller.markAsRead);

module.exports = router;
