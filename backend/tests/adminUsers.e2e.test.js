/**
 * End-to-end test for the admin user-management panel
 * (GET/PATCH/DELETE /api/admin/users).
 *
 * Runs against a DEDICATED throwaway database (dropped before and after) —
 * never the dev database. Email delivery is mocked at the emailService
 * boundary so the block/unblock notification never reaches SMTP.
 *
 * Run with: npx jest tests/adminUsers.e2e.test.js --runInBand
 */
process.env.NODE_ENV = 'test';
require('dotenv').config();
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/tenant-verification-admin-users-test';

const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const emailService = require('../src/services/emailService');
const app = require('../src/app');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const Agreement = require('../src/models/Agreement');
const RefreshToken = require('../src/models/RefreshToken');
const Document = require('../src/models/Document');
const TenantProfile = require('../src/models/TenantProfile');

jest.setTimeout(30000);

const S = {};
const sentEmails = [];

const login = async (email, password) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken;
};

const seedUser = async (over) => {
  const user = await User.create({
    password: await bcrypt.hash('AdminPanel123!', 10),
    isEmailVerified: true,
    accountStatus: 'active',
    ...over,
  });
  return user;
};

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();
  jest.spyOn(emailService, 'sendEmail').mockImplementation(async (msg) => {
    sentEmails.push(msg);
  });

  S.admin = await seedUser({
    fullName: 'Panel Admin', email: 'admin@panel.test', phone: '9100000001', role: 'admin',
  });
  S.tenant = await seedUser({
    fullName: 'Tina Tenant', email: 'tina@panel.test', phone: '9100000002', role: 'tenant',
  });
  S.landlord = await seedUser({
    fullName: 'Larry Landlord', email: 'larry@panel.test', phone: '9100000003', role: 'landlord',
  });
  S.pending = await seedUser({
    fullName: 'Penny Pending', email: 'penny@panel.test', phone: '9100000004',
    role: 'tenant', accountStatus: 'pending', isEmailVerified: false,
  });

  await TenantProfile.create({ userId: S.tenant._id, trustScore: 42 });
  await Property.create({
    landlordId: S.landlord._id,
    title: 'Panel Test Flat',
    description: 'A flat used by the admin panel E2E test.',
    propertyType: 'apartment',
    rent: 15000,
    securityDeposit: 30000,
    address: { addressLine: '1 Test Road', city: 'Testville', state: 'TS', pincode: '400001' },
  });

  S.adminToken = await login('admin@panel.test', 'AdminPanel123!');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const asAdmin = (req) => req.set('Authorization', `Bearer ${S.adminToken}`);

describe('Admin user management E2E', () => {
  it('rejects non-admins', async () => {
    const tenantToken = await login('tina@panel.test', 'AdminPanel123!');
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);

    const anon = await request(app).get('/api/admin/users');
    expect(anon.status).toBe(401);
  });

  it('lists every account with role-specific extras', async () => {
    const res = await asAdmin(request(app).get('/api/admin/users'));
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(4);

    const byEmail = Object.fromEntries(res.body.users.map((u) => [u.email, u]));
    expect(byEmail['tina@panel.test'].trustScore).toBe(42);
    expect(byEmail['larry@panel.test'].propertyCount).toBe(1);
    // secrets never leak
    expect(byEmail['tina@panel.test'].password).toBeUndefined();
    expect(byEmail['tina@panel.test'].googleId).toBeUndefined();
  });

  it('filters by role and by status, and searches name/email/phone', async () => {
    const tenants = await asAdmin(request(app).get('/api/admin/users?role=tenant'));
    expect(tenants.body.pagination.total).toBe(2);

    const pending = await asAdmin(request(app).get('/api/admin/users?status=pending'));
    expect(pending.body.users.map((u) => u.email)).toEqual(['penny@panel.test']);

    const byName = await asAdmin(request(app).get('/api/admin/users?search=Larry'));
    expect(byName.body.users.map((u) => u.email)).toEqual(['larry@panel.test']);

    const byPhone = await asAdmin(request(app).get('/api/admin/users?search=9100000002'));
    expect(byPhone.body.users.map((u) => u.email)).toEqual(['tina@panel.test']);

    // regex metacharacters are matched literally, not compiled
    const literal = await asAdmin(request(app).get('/api/admin/users?search=.*'));
    expect(literal.body.pagination.total).toBe(0);

    const bad = await asAdmin(request(app).get('/api/admin/users?role=wizard'));
    expect(bad.status).toBe(422);
  });

  it('returns one account with its activity stats', async () => {
    const res = await asAdmin(request(app).get(`/api/admin/users/${S.landlord._id}`));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('larry@panel.test');
    expect(res.body.stats.properties).toBe(1);
    expect(res.body.stats.activeAgreements).toBe(0);

    const missing = await asAdmin(
      request(app).get(`/api/admin/users/${new mongoose.Types.ObjectId()}`)
    );
    expect(missing.status).toBe(404);
  });

  it('blocks a user, kills their sessions, and stops them signing in', async () => {
    // a live session to be revoked
    await login('tina@panel.test', 'AdminPanel123!');
    expect(await RefreshToken.countDocuments({ userId: S.tenant._id })).toBeGreaterThan(0);

    const res = await asAdmin(
      request(app)
        .patch(`/api/admin/users/${S.tenant._id}/status`)
        .send({ status: 'blocked', reason: 'Testing the panel' })
    );
    expect(res.status).toBe(200);
    expect(res.body.user.accountStatus).toBe('blocked');
    expect(await RefreshToken.countDocuments({ userId: S.tenant._id })).toBe(0);

    const blockedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tina@panel.test', password: 'AdminPanel123!' });
    expect(blockedLogin.status).toBe(403);

    expect(sentEmails.some((m) => m.to === 'tina@panel.test')).toBe(true);
  });

  it('unblocks the user again', async () => {
    const res = await asAdmin(
      request(app).patch(`/api/admin/users/${S.tenant._id}/status`).send({ status: 'active' })
    );
    expect(res.status).toBe(200);
    expect(res.body.user.accountStatus).toBe('active');
    await login('tina@panel.test', 'AdminPanel123!'); // asserts 200 internally
  });

  it('refuses self-, admin- and unsupported-status changes', async () => {
    const self = await asAdmin(
      request(app).patch(`/api/admin/users/${S.admin._id}/status`).send({ status: 'blocked' })
    );
    expect(self.status).toBe(403);

    const otherAdmin = await seedUser({
      fullName: 'Second Admin', email: 'admin2@panel.test', phone: '9100000005', role: 'admin',
    });
    const onAdmin = await asAdmin(
      request(app).patch(`/api/admin/users/${otherAdmin._id}/status`).send({ status: 'blocked' })
    );
    expect(onAdmin.status).toBe(403);

    const bad = await asAdmin(
      request(app).patch(`/api/admin/users/${S.landlord._id}/status`).send({ status: 'pending' })
    );
    expect(bad.status).toBe(422);

    await User.deleteOne({ _id: otherAdmin._id });
  });

  it('refuses to delete a user party to an active agreement', async () => {
    const agreement = await Agreement.create({
      tenantId: S.tenant._id,
      landlordId: S.landlord._id,
      propertyId: new mongoose.Types.ObjectId(),
      applicationId: new mongoose.Types.ObjectId(),
      agreementNumber: 'PANEL-TEST-0001',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      monthlyRent: 15000,
      status: 'active',
    });

    const res = await asAdmin(request(app).delete(`/api/admin/users/${S.tenant._id}`));
    expect(res.status).toBe(409);
    expect(await User.countDocuments({ _id: S.tenant._id })).toBe(1);

    await Agreement.deleteOne({ _id: agreement._id });
  });

  it('deletes a user and the records they own', async () => {
    await Document.create({
      tenantId: S.tenant._id,
      documentType: 'aadhaar',
      cloudinary: { publicId: 'x', url: 'https://example.com/x.png' },
    });

    const res = await asAdmin(request(app).delete(`/api/admin/users/${S.tenant._id}`));
    expect(res.status).toBe(200);

    expect(await User.countDocuments({ _id: S.tenant._id })).toBe(0);
    expect(await TenantProfile.countDocuments({ userId: S.tenant._id })).toBe(0);
    expect(await Document.countDocuments({ tenantId: S.tenant._id })).toBe(0);
    expect(await RefreshToken.countDocuments({ userId: S.tenant._id })).toBe(0);

    const gone = await asAdmin(request(app).get(`/api/admin/users/${S.tenant._id}`));
    expect(gone.status).toBe(404);
  });

  it('refuses to delete yourself or another admin', async () => {
    const self = await asAdmin(request(app).delete(`/api/admin/users/${S.admin._id}`));
    expect(self.status).toBe(403);
    expect(await User.countDocuments({ _id: S.admin._id })).toBe(1);
  });

  it("deleting a landlord removes their listings", async () => {
    const res = await asAdmin(request(app).delete(`/api/admin/users/${S.landlord._id}`));
    expect(res.status).toBe(200);
    expect(await Property.countDocuments({ landlordId: S.landlord._id })).toBe(0);
  });
});
