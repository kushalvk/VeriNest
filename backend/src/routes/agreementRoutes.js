const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const lifecycleController = require('../controllers/agreementLifecycleController');
const ratingController = require('../controllers/agreementRatingController');
const controller = require('../controllers/agreementController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', requireRole('landlord'), controller.createAgreement);
// registered before GET /:id so "mine" never matches as an id
router.get('/mine', controller.listMyAgreements);

// Lifecycle routes — registered before /:id so they don't conflict
router.get('/mine/lifecycle', lifecycleController.listMyAgreementsLifecycle);
router.patch('/:id/end', lifecycleController.initiateEndRequest);
router.patch('/:id/end/respond', lifecycleController.respondToEndRequest);
router.patch('/:id/cancel-end-request', lifecycleController.cancelEndRequest);
router.post('/:id/rate', ratingController.rateAgreement);

// Party checks happen in the controller by identity, not by role.
router.patch('/:id/sign', controller.signAgreement);
router.get('/:id', controller.getAgreement);

module.exports = router;