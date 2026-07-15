const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/trustScoreController');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.get('/tenants', controller.listTenants);
router.post('/recalculate/:tenantId', controller.recalculate);

module.exports = router;
