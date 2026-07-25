const dns = require('dns');
const mongoose = require('mongoose');

// One connection per process, shared by every caller. The promise is cached
// (not the connection) so concurrent callers during a cold start all await
// the same connect; on failure the cache is cleared so the next call — the
// next serverless invocation or the server's retry loop — can try again.
let connectionPromise = null;
let dnsConfigured = false;

// --- DNS hardening for mongodb+srv:// -------------------------------------
// An srv connection string forces a DNS SRV + TXT lookup. Node runs these
// through c-ares (the dns.resolve* family), NOT the OS resolver that
// `nslookup` uses. On some Windows machines c-ares ends up with 127.0.0.1 as
// its only nameserver — a leftover from a VPN / local DNS proxy that is no
// longer running — so every SRV query returns `querySrv ECONNREFUSED` even
// though nslookup works fine. When the configured resolver is missing or
// loopback, fall back to public DNS so srv resolution works regardless of the
// local machine's state. Production (Vercel, etc.) has real resolvers, so this
// override never triggers there.
const configureDns = () => {
  if (dnsConfigured) return;
  dnsConfigured = true;

  // Prefer IPv4 for the subsequent shard TCP connections — harmless, and
  // avoids broken-IPv6 stalls on some networks. (Does NOT affect SRV lookups.)
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }

  const override = (process.env.DNS_SERVERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let current = [];
  try {
    current = dns.getServers();
  } catch {
    /* getServers can throw on exotic configs — treat as "none" */
  }
  const usable = current.filter(
    (s) => s && s !== '::1' && !s.startsWith('127.')
  );

  if (override.length) {
    dns.setServers(override);
    console.log(`[db] DNS servers set from DNS_SERVERS: ${override.join(', ')}`);
  } else if (usable.length === 0) {
    const fallback = ['1.1.1.1', '8.8.8.8'];
    dns.setServers(fallback);
    console.warn(
      `[db] Local DNS resolver is unusable (saw: ${current.join(', ') || 'none'}); ` +
        `falling back to public DNS ${fallback.join(', ')} so mongodb+srv lookups resolve. ` +
        `Override with DNS_SERVERS in .env if needed.`
    );
  }
};

// Reconcile the collections' indexes with the current schemas exactly once per
// process, best-effort. syncIndexes() builds any missing index AND drops any
// index that is no longer declared in the schema — which self-heals schema
// drift such as a leftover legacy unique index on an optional profile field
// (would make every null value collide with E11000) or the pre-sparse `phone`
// index on users. Runs only for the models where drift has caused real bugs;
// never throws, so a slow/failed reindex can't block the app from serving.
//
// `Application` is here because an older schema used `tenant`/`property` field
// names with a UNIQUE compound index; after the rename to `tenantId`/
// `propertyId` that `tenant_1_property_1` unique index lingered in the DB.
// Current docs lack those fields, so all of them index as {null,null} and the
// SECOND application anywhere collides with E11000 — surfacing to users as a
// bogus "you've already applied" 409. syncIndexes drops that stale index.
const MODELS_TO_SYNC = ['User', 'TenantProfile', 'LandlordProfile', 'Application'];
let indexesSynced = false;
const syncModelIndexes = async () => {
  if (indexesSynced) return;
  indexesSynced = true;
  for (const name of MODELS_TO_SYNC) {
    const model = mongoose.models[name];
    if (!model) continue; // model not registered in this entrypoint — skip
    try {
      await model.syncIndexes();
    } catch (err) {
      console.warn(`[db] Index sync for ${name} skipped: ${err.message}`);
    }
  }
};

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

  configureDns();

  connectionPromise = mongoose
    .connect(uri, {
      // Fail fast instead of the 30s default — a serverless invocation
      // should return a clean 503 rather than hit the platform timeout.
      serverSelectionTimeoutMS: 10000,
    })
    .then(async (m) => {
      console.log(`[db] MongoDB connected: ${mongoose.connection.host}`);
      await syncModelIndexes(); // best-effort; never rejects
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
