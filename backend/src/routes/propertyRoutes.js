const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const optionalAuth = require('../middlewares/optionalAuthMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const propertyOwnership = require('../middlewares/propertyOwnershipMiddleware');
const { imagesArray } = require('../middlewares/uploadMiddleware');
const taxBillUpload = require('../middlewares/taxBillUploadMiddleware');
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
// Landlord house-tax-bill upload (also the re-upload path after a rejection)
router.post(
    '/:id/tax-bill',
    ownerOnly,
    taxBillUpload,
    controller.uploadTaxBill
);

// Public — no auth required. optionalAuth only lets the owner/admin see
// their own unverified listings; anonymous callers get verified ones only.
router.get('/', controller.searchProperties);
router.get('/:id', optionalAuth, controller.getPropertyById);

module.exports = router;