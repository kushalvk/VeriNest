/**
 * End-to-end smoke test: chains the full tenant verification journey
 * (register → OTP → profile → property → document → OCR → admin approval →
 * trust score → application → verification request → token access).
 *
 * Runs against a DEDICATED throwaway database (dropped before and after
 * each run) — never the dev database. Run with: npm run test:smoke
 */
process.env.NODE_ENV = 'test';
require('dotenv').config();
// Isolated test DB — overrides whatever .env points at.
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/tenant-verification-smoke-test';

const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const emailService = require('../src/services/emailService');
const app = require('../src/app');
const User = require('../src/models/User');
const TrustScoreHistory = require('../src/models/TrustScoreHistory');

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'sample-document.png');

jest.setTimeout(30000);

// Shared state across ordered steps
const S = {};
const sentEmails = [];

// Runs steps in order; after the first failure, later steps are skipped
// with an explicit message instead of cascading into confusing errors.
let aborted = null;
const step = (name, fn, timeout) =>
  it(
    name,
    async () => {
      if (aborted) {
        throw new Error(`Skipped — earlier step failed: "${aborted}"`);
      }
      try {
        await fn();
      } catch (err) {
        aborted = name;
        err.message = `[step ${name}] ${err.message}`;
        throw err;
      }
    },
    timeout
  );

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase(); // clean slate even after a crashed run
  // Capture outbound email (OTP) instead of hitting SMTP / console fallback.
  jest.spyOn(emailService, 'sendEmail').mockImplementation(async (msg) => {
    sentEmails.push(msg);
  });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('Tenant verification E2E smoke test', () => {
  step('a. register tenant → 201', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Smoke Tenant',
      email: 'tenant@smoke.test',
      phone: '9000000001',
      password: 'SmokePass123!',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.password).toBeUndefined();
    S.tenantUserId = res.body.user._id;
  });

  step('b. register landlord → 201', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Smoke Landlord',
      email: 'landlord@smoke.test',
      phone: '9000000002',
      password: 'SmokePass123!',
    });
    expect(res.status).toBe(201);
    S.landlordUserId = res.body.user._id;
    // Registration has no role selection by design — promote in DB (test-only).
    await User.updateOne({ _id: S.landlordUserId }, { role: 'landlord' });
  });

  step('c. send + verify OTP → isEmailVerified true', async () => {
    const sendRes = await request(app)
      .post('/api/auth/otp/send')
      .send({ email: 'tenant@smoke.test', purpose: 'signup' });
    expect(sendRes.status).toBe(200);

    // OTP captured from the mocked email service — never from an API response.
    const lastEmail = sentEmails[sentEmails.length - 1];
    expect(lastEmail.to).toBe('tenant@smoke.test');
    const otp = lastEmail.text.match(/\b(\d{6})\b/)?.[1];
    expect(otp).toBeDefined();

    const verifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: 'tenant@smoke.test', otp, purpose: 'signup' });
    expect(verifyRes.status).toBe(200);

    const user = await User.findById(S.tenantUserId);
    expect(user.isEmailVerified).toBe(true);
    expect(user.accountStatus).toBe('active');
  });

  step('d. login tenant → accessToken', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tenant@smoke.test', password: 'SmokePass123!' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    S.tenantToken = res.body.accessToken;
  });

  step('e. login landlord → accessToken', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'landlord@smoke.test', password: 'SmokePass123!' });
    expect(res.status).toBe(200);
    S.landlordToken = res.body.accessToken;
  });

  step('f. tenant creates complete profile → 201', async () => {
    const res = await request(app)
      .post('/api/tenant-profile')
      .set('Authorization', `Bearer ${S.tenantToken}`)
      .send({
        dob: '1997-06-15',
        gender: 'Male',
        occupation: 'Software Engineer',
        monthlySalary: 60000,
        currentAddress: { addressLine1: '1 Test Lane', city: 'Pune', pincode: '411001' },
        permanentAddress: { addressLine1: '2 Home Road', city: 'Nashik', pincode: '422001' },
        emergencyContact: { name: 'Parent', relation: 'father', phone: '9000000009' },
      });
    expect(res.status).toBe(201);
  });

  step('g. landlord creates property → 201', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${S.landlordToken}`)
      .send({
        title: 'Smoke Test 2BHK',
        rent: 20000,
        address: { city: 'Pune', addressLine: '5 Market Street' },
        bedrooms: 2,
      });
    expect(res.status).toBe(201);
    S.propertyId = res.body.property._id;
  });

  step('h. tenant uploads document → 201', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${S.tenantToken}`)
      .field('documentType', 'aadhaar')
      .attach('file', FIXTURE_IMAGE);
    expect(res.status).toBe(201);
    expect(res.body.document.cloudinary.url).toMatch(/^https:\/\//);
    S.documentId = res.body.document._id;
  });

  step(
    'i. tenant runs OCR → 200, no hang',
    async () => {
      const res = await request(app)
        .post(`/api/documents/${S.documentId}/ocr`)
        .set('Authorization', `Bearer ${S.tenantToken}`);
      expect(res.status).toBe(200); // "done" or "failed" both fine — never 500
      expect(['done', 'failed']).toContain(res.body.document.ocrStatus);
    },
    25000 // OCR has its own 15s internal timeout; give it headroom
  );

  step('j. create + login admin → accessToken', async () => {
    await User.create({
      fullName: 'Smoke Admin',
      email: 'admin@smoke.test',
      phone: '9000000003',
      password: await bcrypt.hash('SmokePass123!', 10),
      role: 'admin',
      accountStatus: 'active',
      isEmailVerified: true,
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@smoke.test', password: 'SmokePass123!' });
    expect(res.status).toBe(200);
    S.adminToken = res.body.accessToken;
  });

  step('k. admin approves document → verified', async () => {
    const res = await request(app)
      .patch(`/api/admin/documents/${S.documentId}`)
      .set('Authorization', `Bearer ${S.adminToken}`)
      .send({ status: 'verified' });
    expect(res.status).toBe(200);
    expect(res.body.document.verificationStatus).toBe('verified');
  });

  step('l. tenant has a notification', async () => {
    const res = await request(app)
      .get('/api/notifications/mine')
      .set('Authorization', `Bearer ${S.tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBeGreaterThanOrEqual(1);
  });

  step('m. TrustScoreHistory created by approval trigger', async () => {
    const records = await TrustScoreHistory.find({ tenantId: S.tenantUserId });
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[records.length - 1].generatedBy).toBe('System');
    expect(records[records.length - 1].score).toBeGreaterThan(0);
  });

  step('n. tenant applies to property → 201', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${S.tenantToken}`)
      .send({ propertyId: S.propertyId, message: 'Smoke test application' });
    expect(res.status).toBe(201);
    S.applicationId = res.body.application._id;
  });

  step('o. landlord sees the application in /received', async () => {
    const res = await request(app)
      .get('/api/applications/received')
      .set('Authorization', `Bearer ${S.landlordToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.applications.map((a) => a._id);
    expect(ids).toContain(S.applicationId);
  });

  step('p. landlord accepts application → 200', async () => {
    const res = await request(app)
      .patch(`/api/applications/${S.applicationId}`)
      .set('Authorization', `Bearer ${S.landlordToken}`)
      .send({ status: 'accepted' });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('accepted');
  });

  step('q. landlord creates verification request → 201', async () => {
    const res = await request(app)
      .post('/api/verification-requests')
      .set('Authorization', `Bearer ${S.landlordToken}`)
      .send({ applicationId: S.applicationId, accessType: '24_hours' });
    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe('pending');
    S.requestId = res.body.request._id;
  });

  step('r. tenant approves request → raw secure token', async () => {
    const res = await request(app)
      .patch(`/api/verification-requests/${S.requestId}/respond`)
      .set('Authorization', `Bearer ${S.tenantToken}`)
      .send({ action: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toMatch(/^[0-9a-f]{64}$/);
    S.secureToken = res.body.accessToken;
  });

  step('s. token grants document access without extractedData', async () => {
    const res = await request(app).get(`/api/verification/access/${S.secureToken}`);
    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBeGreaterThanOrEqual(1);
    for (const doc of res.body.documents) {
      expect(doc.documentType).toBeDefined();
      expect(doc.url).toBeDefined();
      expect(doc.verificationStatus).toBe('verified');
      expect(doc.extractedData).toBeUndefined();
      expect(doc._id).toBeUndefined();
    }
  });
});
