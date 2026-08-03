const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/adminUserController');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.get('/', controller.listUsers);
router.get('/:id', controller.getUser);
router.patch('/:id/status', controller.updateUserStatus);
router.delete('/:id', controller.deleteUser);

module.exports = router;
