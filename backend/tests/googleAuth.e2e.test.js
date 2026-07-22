/**
 * Integration test for the "Sign in with Google" flow.
 *
 * Runs against a DEDICATED throwaway database (dropped before and after) —
 * never the dev DB. The Google ID-token verification itself is mocked at the
 * service boundary (googleAuthService.verifyGoogleToken) so no real Google
 * network call or client id is needed; every test controls the payload the
 * "verified" token yields, or forces a verification failure.
 *
 * Run with: npx jest tests/googleAuth.e2e.test.js --runInBand
 */
process.env.NODE_ENV = 'test';
require('dotenv').config();
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/tenant-verification-google-test';
// The register/login steps must not depend on Google's siteverify: with the
// key unset the recaptcha middleware takes its logged dev fallback.
delete process.env.RECAPTCHA_SECRET_KEY;

const mongoose = require('mongoose');
const request = require('supertest');

const googleAuthService = require('../src/services/googleAuthService');
const app = require('../src/app');
const User = require('../src/models/User');

jest.setTimeout(30000);

// Build a fake verified-Google payload.
const payloadFor = (over = {}) => ({
  sub: 'google-sub-123',
  email: 'guser@gmail.com',
  email_verified: true,
  name: 'Google User',
  picture: 'https://example.com/pic.png',
  ...over,
});

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(() => jest.restoreAllMocks());

describe('Google sign-in', () => {
  test('brand-new Google user is created active, verified, role-less, no password', async () => {
    jest.spyOn(googleAuthService, 'verifyGoogleToken').mockResolvedValue(payloadFor());

    const res = await request(app).post('/api/auth/google').send({ idToken: 'any' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.authProvider).toBe('google');
    expect(res.body.user.isEmailVerified).toBe(true);
    expect(res.body.user.accountStatus).toBe('active');
    // role unset → serialized as undefined; never a password / googleId leak.
    expect(res.body.user.role == null).toBe(true);
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.googleId).toBeUndefined();

    const inDb = await User.findOne({ email: 'guser@gmail.com' }).select('+password +googleId');
    expect(inDb.password).toBeUndefined();
    expect(inDb.googleId).toBe('google-sub-123');
    expect(inDb.role == null).toBe(true);
  });

  test('set-role fills the role once, then refuses to change it', async () => {
    jest.spyOn(googleAuthService, 'verifyGoogleToken').mockResolvedValue(payloadFor());
    const login = await request(app).post('/api/auth/google').send({ idToken: 'any' });
    const token = login.body.accessToken;

    const bad = await request(app)
      .patch('/api/auth/set-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });
    expect(bad.status).toBe(422); // admin can never be self-assigned

    const ok = await request(app)
      .patch('/api/auth/set-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'tenant' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe('tenant');
    expect(ok.body.accessToken).toBeTruthy();

    // A fresh token now carries the role; re-picking is rejected.
    const again = await request(app)
      .patch('/api/auth/set-role')
      .set('Authorization', `Bearer ${ok.body.accessToken}`)
      .send({ role: 'landlord' });
    expect(again.status).toBe(409);
  });

  test('signing in again with the same Google account returns the SAME user', async () => {
    jest.spyOn(googleAuthService, 'verifyGoogleToken').mockResolvedValue(payloadFor());
    const first = await request(app).post('/api/auth/google').send({ idToken: 'any' });
    const second = await request(app).post('/api/auth/google').send({ idToken: 'any' });

    expect(second.body.user._id).toBe(first.body.user._id);
    // role persisted from the earlier set-role → no /select-role next time.
    expect(second.body.user.role).toBe('tenant');
    const count = await User.countDocuments({ email: 'guser@gmail.com' });
    expect(count).toBe(1);
  });

  test('links to an existing email/password account without a duplicate; password still works', async () => {
    // Local account, verified + active so it can log in.
    await request(app).post('/api/auth/register').send({
      fullName: 'Local Person',
      email: 'local@gmail.com',
      phone: '9111111111',
      password: 'LocalPass123!',
    });
    await User.updateOne(
      { email: 'local@gmail.com' },
      { isEmailVerified: true, accountStatus: 'active' }
    );

    jest.spyOn(googleAuthService, 'verifyGoogleToken').mockResolvedValue(
      payloadFor({ sub: 'google-sub-local', email: 'local@gmail.com' })
    );
    const g = await request(app).post('/api/auth/google').send({ idToken: 'any' });
    expect(g.status).toBe(200);

    const count = await User.countDocuments({ email: 'local@gmail.com' });
    expect(count).toBe(1); // linked, not duplicated

    const linked = await User.findOne({ email: 'local@gmail.com' }).select('+password +googleId');
    expect(linked.googleId).toBe('google-sub-local');
    expect(linked.authProvider).toBe('local'); // original provider preserved
    expect(linked.role).toBe('tenant'); // existing role untouched, no /select-role
    expect(linked.password).toBeTruthy(); // password intact

    // Password login still works after linking.
    const pw = await request(app)
      .post('/api/auth/login')
      .send({ email: 'local@gmail.com', password: 'LocalPass123!' });
    expect(pw.status).toBe(200);
  });

  test('an unverified Google email is rejected with 401', async () => {
    jest.spyOn(googleAuthService, 'verifyGoogleToken').mockResolvedValue(
      payloadFor({ sub: 'unverified', email: 'unv@gmail.com', email_verified: false })
    );
    const res = await request(app).post('/api/auth/google').send({ idToken: 'any' });
    expect(res.status).toBe(401);
    expect(await User.countDocuments({ email: 'unv@gmail.com' })).toBe(0);
  });

  test('a tampered / invalid token verification fails cleanly with 401', async () => {
    jest.spyOn(googleAuthService, 'verifyGoogleToken').mockImplementation(async () => {
      const err = new Error('Google sign-in failed: the token is invalid or expired.');
      err.statusCode = 401;
      throw err;
    });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'tampered' });
    expect(res.status).toBe(401);
  });

  test('unconfigured feature surfaces a clear 503, not a crash', async () => {
    jest.spyOn(googleAuthService, 'verifyGoogleToken').mockImplementation(async () => {
      const err = new Error('Google sign-in is not configured on this server.');
      err.statusCode = 503;
      throw err;
    });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'any' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  test('a role-gated API rejects a role-less Google user (403), guiding them to /select-role', async () => {
    jest.spyOn(googleAuthService, 'verifyGoogleToken').mockResolvedValue(
      payloadFor({ sub: 'roleless', email: 'roleless@gmail.com' })
    );
    const login = await request(app).post('/api/auth/google').send({ idToken: 'any' });
    // /documents/my is tenant-only; a role-less token must not pass roleMiddleware.
    const res = await request(app)
      .get('/api/documents/my')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });
});
