const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/adminPropertyController');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.get('/', controller.listProperties);
router.patch('/:id', controller.updatePropertyVerification);

module.exports = router;