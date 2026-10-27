// Usage (from backend/):
//   node scripts/migratePropertyVerification.js            # grandfather existing listings as VERIFIED
//   node scripts/migratePropertyVerification.js --pending  # force re-verification (hidden until a bill is uploaded)
require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('../models/Property');

const run = async () => {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
    const forceReverify = process.argv.includes('--pending');

    await mongoose.connect(process.env.MONGO_URI);

    // Only touch documents that predate the feature.
    const filter = { 'verification.status': { $exists: false } };
    const update = forceReverify
        ? { $set: { 'verification.status': 'not_submitted' } }
        : {
            $set: {
                'verification.status': 'verified',
                'verification.grandfathered': true,
                'verification.reviewedAt': new Date(),
            },
        };

    const result = await Property.updateMany(filter, update);
    console.log(
        `[migrate] ${result.modifiedCount} propert${result.modifiedCount === 1 ? 'y' : 'ies'} set to ` +
        `${forceReverify ? 'not_submitted' : 'verified (grandfathered)'}`
    );

    await Property.createIndexes();
    console.log('[migrate] indexes ensured');

    await mongoose.disconnect();
};

run().catch((err) => {
    console.error('[migrate] failed:', err.message);
    process.exit(1);
});