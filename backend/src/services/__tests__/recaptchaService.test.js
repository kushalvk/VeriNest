/**
 * recaptchaService policy tests. Google's siteverify is mocked via global
 * fetch — these verify OUR decision logic (fail closed, action binding,
 * score threshold), not Google's.
 */

describe('recaptchaService.verifyRecaptcha', () => {
  let verifyRecaptcha;

  const mockSiteverify = (payload) => {
    global.fetch = jest.fn().mockResolvedValue({ json: async () => payload });
  };

  beforeEach(() => {
    jest.resetModules();
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    ({ verifyRecaptcha } = require('../recaptchaService'));
  });

  afterEach(() => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    delete global.fetch;
  });

  test('accepts a valid token with matching action and passing score', async () => {
    mockSiteverify({ success: true, action: 'register', score: 0.9 });
    const result = await verifyRecaptcha('tok', 'register');
    expect(result).toEqual({ success: true, score: 0.9 });
  });

  test('rejects a missing token without calling Google', async () => {
    global.fetch = jest.fn();
    const result = await verifyRecaptcha(undefined, 'register');
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/missing token/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('rejects when siteverify says success: false', async () => {
    mockSiteverify({ success: false, 'error-codes': ['invalid-input-response'] });
    const result = await verifyRecaptcha('garbage', 'register');
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/invalid-input-response/);
  });

  test('rejects an action mismatch (login token replayed against register)', async () => {
    mockSiteverify({ success: true, action: 'login', score: 0.9 });
    const result = await verifyRecaptcha('tok', 'register');
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/action mismatch/);
  });

  test('rejects a score below the 0.5 default threshold', async () => {
    mockSiteverify({ success: true, action: 'login', score: 0.3 });
    const result = await verifyRecaptcha('tok', 'login');
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/below threshold/);
  });

  test('fails closed when the siteverify call itself throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await verifyRecaptcha('tok', 'login');
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/unreachable/);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('failing closed'));
    spy.mockRestore();
  });
});
