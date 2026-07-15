const mongoose = require('mongoose');

// One connection per process, shared by every caller. The promise is cached
// (not the connection) so concurrent callers during a cold start all await
// the same connect; on failure the cache is cleared so the next call — the
// next serverless invocation or the server's retry loop — can try again.
let connectionPromise = null;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error(
      '[db] MONGO_URI is not set. Copy .env.example to .env and provide a MongoDB connection string. ' +
        'The server will keep running, but database operations will fail until it is configured.'
    );
    return null;
  }

  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose
    .connect(uri, {
      // Fail fast instead of the 30s default — a serverless invocation
      // should return a clean 503 rather than hit the platform timeout.
      serverSelectionTimeoutMS: 10000,
    })
    .then((m) => {
      console.log(`[db] MongoDB connected: ${mongoose.connection.host}`);
      return m;
    })
    .catch((err) => {
      connectionPromise = null;
      throw err;
    });

  return connectionPromise;
};

mongoose.connection.on('disconnected', () => {
  console.warn('[db] MongoDB disconnected.');
});

module.exports = connectDB;
