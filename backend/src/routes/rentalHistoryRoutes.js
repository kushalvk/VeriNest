const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const controller = require('../controllers/rentalHistoryController');

const router = express.Router();

router.use(authMiddleware);

// No POST / — rental records are only created internally when an
// agreement activates. Party checks happen in the controller by identity.
router.patch('/:id/complete', controller.completeRental);
router.patch('/:id/rate', controller.submitRating);
router.get('/mine', controller.getMyRentalHistory);

module.exports = router;
