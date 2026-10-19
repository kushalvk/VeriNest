require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { autoEndAgreements } = require('./cron/autoEndAgreements');

const PORT = process.env.PORT || 5000;
const RETRY_DELAY_MS = 5000;
const AUTO_END_INTERVAL_MS = 60 * 60 * 1000; // hourly; the query is indexed and cheap

let autoEndTimer = null;

// Starts only after MongoDB is connected. Runs once immediately, then hourly.
const startAutoEndJob = () => {
  if (autoEndTimer) return;
  void autoEndAgreements();
  autoEndTimer = setInterval(() => void autoEndAgreements(), AUTO_END_INTERVAL_MS);
  if (typeof autoEndTimer.unref === 'function') autoEndTimer.unref();
};

// Long-lived server: keep retrying the initial connection so `npm run dev`
// survives MongoDB starting late. (The serverless entry in api/index.js
// instead awaits connectDB() per request — no retry loop there.)
const connectWithRetry = async () => {
  try {
    await connectDB();
    startAutoEndJob();
  } catch (err) {
    console.error(`[db] MongoDB connection failed: ${err.message}`);
    console.error(`[db] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
    setTimeout(connectWithRetry, RETRY_DELAY_MS);
  }
};

connectWithRetry();

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});