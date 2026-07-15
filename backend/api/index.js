// Vercel serverless entry. Every request lands here (see vercel.json
// rewrites); the Express app in src/app.js does its own /api routing, and
// Vercel preserves the original URL, so the paths line up unchanged.
//
// Environment variables come from the Vercel project settings — there is
// no .env file in the deployment, so dotenv is not loaded here.
const app = require('../src/app');
const connectDB = require('../src/config/db');

module.exports = async (req, res) => {
  try {
    // Cached after the first invocation of a warm instance; a failure
    // clears the cache so the next request retries (see config/db.js).
    await connectDB();
  } catch (err) {
    console.error(`[db] Connection failed while handling request: ${err.message}`);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database unavailable. Please try again shortly.' }));
    return;
  }
  app(req, res);
};
