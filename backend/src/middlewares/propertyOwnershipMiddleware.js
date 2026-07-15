const mongoose = require('mongoose');
const Property = require('../models/Property');

/**
 * Loads the property from :id and verifies the authenticated user owns it.
 * Attaches the loaded document as req.property for downstream handlers.
 * Must run after authMiddleware.
 */
const propertyOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    if (property.landlordId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: you do not own this property' });
    }

    req.property = property;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = propertyOwnership;
