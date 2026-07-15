const mongoose = require('mongoose');

const RETRY_DELAY_MS = 5000;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error(
      '[db] MONGO_URI is not set. Copy .env.example to .env and provide a MongoDB connection string. ' +
        'The server will keep running, but database operations will fail until it is configured.'
    );
    return;
  }

  const attempt = async () => {
    try {
      await mongoose.connect(uri);
      console.log(`[db] MongoDB connected: ${mongoose.connection.host}`);
    } catch (err) {
      console.error(`[db] MongoDB connection failed: ${err.message}`);
      console.error(`[db] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      setTimeout(attempt, RETRY_DELAY_MS);
    }
  };

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected.');
  });

  await attempt();
};

module.exports = connectDB;
