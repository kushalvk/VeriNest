const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const controller = require('../controllers/agreementController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', requireRole('landlord'), controller.createAgreement);
// registered before GET /:id so "mine" never matches as an id
router.get('/mine', controller.listMyAgreements);
// Party checks (tenant/landlord of THIS agreement, or admin for GET)
// happen in the controller by identity, not by role.
router.patch('/:id/sign', controller.signAgreement);
router.get('/:id', controller.getAgreement);

module.exports = router;
