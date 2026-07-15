/* Seeds sample properties for local development / search testing.
 * Run with: npm run seed:properties
 * Re-runnable: previous seed data (owned by the seed landlord) is replaced.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Property = require('../models/Property');

const SEED_LANDLORD_EMAIL = 'seed.landlord@example.com';
const COUNT = 120;

const CITIES = [
  'Mumbai',
  'Navi Mumbai',
  'Delhi',
  'Bengaluru',
  'Pune',
  'Chennai',
  'Hyderabad',
  'Ahmedabad',
];
const FURNISHINGS = ['Furnished', 'Semi-Furnished', 'Unfurnished'];
const PROPERTY_TYPES = ['Apartment', 'Villa', 'Studio', 'Independent House'];
const AMENITIES = ['parking', 'lift', 'gym', 'security', 'power backup', 'garden'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const randomStatus = () => {
  const roll = Math.random();
  if (roll < 0.8) return 'available';
  if (roll < 0.9) return 'occupied';
  return 'inactive';
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('[seed] MONGO_URI is not set — configure .env first.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[seed] Connected to MongoDB');

  let landlord = await User.findOne({ email: SEED_LANDLORD_EMAIL });
  if (!landlord) {
    landlord = await User.create({
      fullName: 'Seed Landlord',
      email: SEED_LANDLORD_EMAIL,
      phone: '0000000000',
      password: await bcrypt.hash('seed-only-not-for-login', 10),
      role: 'landlord',
      accountStatus: 'active',
      isEmailVerified: true,
    });
    console.log('[seed] Created seed landlord user');
  }

  const removed = await Property.deleteMany({ landlordId: landlord._id });
  if (removed.deletedCount) {
    console.log(`[seed] Removed ${removed.deletedCount} previously seeded properties`);
  }

  const docs = [];
  for (let i = 1; i <= COUNT; i++) {
    const city = pick(CITIES);
    const bedrooms = between(1, 4);
    docs.push({
      landlordId: landlord._id,
      title: `${bedrooms}BHK ${pick(PROPERTY_TYPES)} in ${city} #${i}`,
      description: `Seeded sample listing number ${i} for development and testing.`,
      propertyType: pick(PROPERTY_TYPES),
      rent: between(5, 60) * 1000,
      securityDeposit: between(1, 6) * 25000,
      furnishing: pick(FURNISHINGS),
      bedrooms,
      bathrooms: between(1, bedrooms),
      area: between(350, 2500),
      amenities: AMENITIES.filter(() => Math.random() > 0.5),
      address: {
        addressLine: `${between(1, 200)} Sample Street`,
        city,
        state: 'NA',
        pincode: String(between(100000, 999999)),
      },
      availability: new Date(Date.now() + between(0, 60) * 86400000),
      rules: Math.random() > 0.5 ? ['No smoking'] : [],
      status: randomStatus(),
    });
  }

  await Property.insertMany(docs);

  const byStatus = await Property.aggregate([
    { $match: { landlordId: landlord._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byCity = await Property.aggregate([
    { $match: { landlordId: landlord._id } },
    { $group: { _id: '$address.city', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.log(`[seed] Inserted ${docs.length} properties`);
  console.log('[seed] By status:', byStatus.map((s) => `${s._id}=${s.count}`).join(', '));
  console.log('[seed] By city  :', byCity.map((c) => `${c._id}=${c.count}`).join(', '));

  await mongoose.disconnect();
  console.log('[seed] Done');
};

run().catch((err) => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
