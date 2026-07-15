const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const propertyOwnership = require('../middlewares/propertyOwnershipMiddleware');
const { imagesArray } = require('../middlewares/uploadMiddleware');
const controller = require('../controllers/propertyController');

const router = express.Router();

const landlordOnly = [authMiddleware, requireRole('landlord')];
const ownerOnly = [...landlordOnly, propertyOwnership];

router.post('/', landlordOnly, controller.createProperty);
// registered before GET /:id so "mine" never matches as an id
router.get('/mine', landlordOnly, controller.getMyProperties);
router.put('/:id', ownerOnly, controller.updateProperty);
router.delete('/:id', ownerOnly, controller.deleteProperty);
router.post(
  '/:id/images',
  ownerOnly,
  imagesArray('images', 10),
  controller.uploadPropertyImages
);

// Public — no auth
router.get('/', controller.searchProperties);
router.get('/:id', controller.getPropertyById);

module.exports = router;
