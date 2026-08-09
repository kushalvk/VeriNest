/* Creates (or resets) the public demo tenant + landlord accounts.
 * Run with: npm run seed:demo
 * Re-runnable: the demo workspace is wiped and rebuilt every time — which is
 * exactly what happens on each demo sign-in too (see services/demoService.js).
 */
require('dotenv').config();
const mongoose = require('mongoose');
// Connect through the app's own connector, not a bare mongoose.connect: it
// carries the DNS hardening that makes mongodb+srv:// resolve on machines
// whose local resolver is broken (see config/db.js).
const connectDB = require('../config/db');
const demoService = require('../services/demoService');

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('[seed:demo] MONGO_URI is not set — configure .env first.');
    process.exit(1);
  }
  await connectDB();

  const { properties, applications } = await demoService.resetDemoWorkspace();
  console.log(
    `[seed:demo] Workspace rebuilt: ${properties} properties, ${applications} applications, 2 documents`
  );

  console.log('[seed:demo] Credentials now live on the login page:');
  for (const account of demoService.DEMO_ACCOUNTS) {
    console.log(`  ${account.role.padEnd(8)} ${account.email}  /  ${account.password}`);
  }

  await mongoose.disconnect();
  console.log('[seed:demo] Done');
};

run().catch((err) => {
  console.error('[seed:demo] Failed:', err.message);
  process.exit(1);
});
