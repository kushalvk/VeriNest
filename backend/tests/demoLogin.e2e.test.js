/**
 * End-to-end test for the public demo accounts
 * (GET /api/auth/demo-accounts + the reset-on-login behaviour).
 *
 * Runs against a DEDICATED throwaway database (dropped before and after) —
 * never the dev database. Email delivery is mocked at the emailService
 * boundary so seeded notifications never reach SMTP.
 *
 * Run with: npx jest tests/demoLogin.e2e.test.js --runInBand
 */
process.env.NODE_ENV = 'test';
require('dotenv').config();
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/tenant-verification-demo-test';

const mongoose = require('mongoose');
const request = require('supertest');

const emailService = require('../src/services/emailService');
const app = require('../src/app');
const demoService = require('../src/services/demoService');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const Application = require('../src/models/Application');
const Document = require('../src/models/Document');
const TenantProfile = require('../src/models/TenantProfile');

jest.setTimeout(30000);

const S = {};

const login = async (email, password) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body;
};

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();
  jest.spyOn(emailService, 'sendEmail').mockResolvedValue(undefined);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  jest.restoreAllMocks();
});

describe('demo accounts', () => {
  test('the endpoint reports nothing until the accounts are seeded', async () => {
    const res = await request(app).get('/api/auth/demo-accounts');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toEqual([]);
  });

  test('seeding creates a tenant and a landlord with a populated workspace', async () => {
    const summary = await demoService.resetDemoWorkspace();
    S.tenant = summary.tenant;
    S.landlord = summary.landlord;

    expect(S.tenant.isDemo).toBe(true);
    expect(S.tenant.role).toBe('tenant');
    expect(S.tenant.accountStatus).toBe('active');
    expect(S.landlord.role).toBe('landlord');

    expect(await Property.countDocuments({ landlordId: S.landlord._id })).toBe(3);
    expect(await Document.countDocuments({ tenantId: S.tenant._id })).toBe(2);
    expect(await Application.countDocuments({ tenantId: S.tenant._id })).toBe(2);

    // The trust score comes from the real scoring pass, not a hardcoded number.
    const profile = await TenantProfile.findOne({ userId: S.tenant._id });
    expect(profile.trustScore).toBeGreaterThan(0);
  });

  test('the endpoint hands out working credentials once seeded', async () => {
    const res = await request(app).get('/api/auth/demo-accounts');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(2);

    const roles = res.body.accounts.map((a) => a.role).sort();
    expect(roles).toEqual(['landlord', 'tenant']);

    S.credentials = Object.fromEntries(res.body.accounts.map((a) => [a.role, a]));
    for (const account of res.body.accounts) {
      expect(account.email).toBeTruthy();
      expect(account.password).toBeTruthy();
    }
  });

  test('the advertised credentials log in and are flagged as demo', async () => {
    const body = await login(S.credentials.tenant.email, S.credentials.tenant.password);
    expect(body.user.isDemo).toBe(true);
    expect(body.user.role).toBe('tenant');
    S.tenantToken = body.accessToken;

    const landlordBody = await login(
      S.credentials.landlord.email,
      S.credentials.landlord.password
    );
    expect(landlordBody.user.isDemo).toBe(true);
    expect(landlordBody.user.role).toBe('landlord');
  });

  test('a demo user can really write — and the write is wiped by the next sign-in', async () => {
    // Sign in fresh: the landlord login above already reset the workspace, so
    // re-read the ids that survived it.
    const { accessToken } = await login(
      S.credentials.tenant.email,
      S.credentials.tenant.password
    );
    const studio = await Property.findOne({
      landlordId: S.landlord._id,
      propertyType: 'Studio',
    });

    const applied = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ propertyId: studio._id.toString(), message: 'Demo application' });
    expect(applied.status).toBe(201);
    expect(await Application.countDocuments({ tenantId: S.tenant._id })).toBe(3);

    // Signing in again rebuilds the snapshot — the third application is gone.
    await login(S.credentials.tenant.email, S.credentials.tenant.password);
    expect(await Application.countDocuments({ tenantId: S.tenant._id })).toBe(2);
    expect(
      await Application.countDocuments({ tenantId: S.tenant._id, message: 'Demo application' })
    ).toBe(0);
    expect(await Property.countDocuments({ landlordId: S.landlord._id })).toBe(3);
  });

  test('demo listings stay out of the public property search', async () => {
    const realListing = await Property.create({
      landlordId: new mongoose.Types.ObjectId(),
      title: 'Real 1BHK in Ahmedabad',
      rent: 15000,
      address: { city: 'Ahmedabad' },
      status: 'available',
    });

    const res = await request(app).get('/api/properties').query({ city: 'Ahmedabad' });
    expect(res.status).toBe(200);

    const ids = res.body.results.map((p) => p._id);
    expect(ids).toContain(realListing._id.toString());
    expect(res.body.total).toBe(1);

    const demoIds = (
      await Property.find({
        landlordId: S.landlord._id,
        'address.city': 'Ahmedabad',
      }).select('_id')
    ).map((p) => p._id.toString());
    expect(demoIds).toHaveLength(2); // the two Ahmedabad demo listings
    for (const id of demoIds) expect(ids).not.toContain(id);

    // ...but a demo listing is still reachable directly by id.
    const detail = await request(app).get(`/api/properties/${demoIds[0]}`);
    expect(detail.status).toBe(200);

    await Property.deleteOne({ _id: realListing._id });
  });

  test('a reset reuses the same accounts instead of piling up new ones', async () => {
    await demoService.resetDemoWorkspace();
    expect(await User.countDocuments({ isDemo: true })).toBe(2);
  });
});
