import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import * as authApi from '../api/authApi';
import { getApiError } from '../api/client';
import { AuthCard, FieldError, FormAlert, buttonClass, inputClass, labelClass } from '../components/AuthCard';
import GoogleSignInButton from '../components/GoogleSignInButton';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?\d{10,15}$/;

// Client-side checks mirror the backend rules for fast feedback only —
// the backend remains the authoritative validator.
const validate = (form: authApi.RegisterInput) => {
  const errors: Partial<Record<keyof authApi.RegisterInput, string>> = {};
  if (!form.fullName.trim()) errors.fullName = 'Full name is required';
  if (!EMAIL_REGEX.test(form.email)) errors.email = 'Enter a valid email address';
  if (!PHONE_REGEX.test(form.phone)) errors.phone = 'Phone must be 10-15 digits';
  if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
  return errors;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  // undefined when no VITE_RECAPTCHA_SITE_KEY / provider — form still works,
  // the backend's dev fallback accepts tokenless requests in that case.
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [form, setForm] = useState<authApi.RegisterInput>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'tenant',
  });
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validate>>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof authApi.RegisterInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setApiError('');

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      // Invisible reCAPTCHA: a fresh token per attempt (they're single-use),
      // action name must match the backend's requireRecaptcha("register").
      const recaptchaToken = executeRecaptcha ? await executeRecaptcha('register') : undefined;
      await authApi.register({ ...form, recaptchaToken });
      await authApi.sendOtp(form.email, 'signup');
      navigate('/verify-otp', { state: { email: form.email, otpJustSent: true } });
    } catch (err) {
      setApiError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Create your account">
      {apiError && <FormAlert tone="error" message={apiError} />}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="fullName" className={labelClass}>Full name</label>
          <input id="fullName" className={inputClass} value={form.fullName}
            onChange={(e) => set('fullName')(e.target.value)} autoComplete="name" />
          <FieldError message={fieldErrors.fullName} />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" type="email" className={inputClass} value={form.email}
            onChange={(e) => set('email')(e.target.value)} autoComplete="email" />
          <FieldError message={fieldErrors.email} />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>Phone</label>
          <input id="phone" type="tel" className={inputClass} value={form.phone}
            onChange={(e) => set('phone')(e.target.value)} autoComplete="tel" />
          <FieldError message={fieldErrors.phone} />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>Password</label>
          <input id="password" type="password" className={inputClass} value={form.password}
            onChange={(e) => set('password')(e.target.value)} autoComplete="new-password" />
          <FieldError message={fieldErrors.password} />
        </div>
        <div>
          <span className={labelClass}>I am a</span>
          <div className="flex gap-4">
            {(['tenant', 'landlord'] as const).map((role) => (
              <label key={role}
                className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-medium capitalize transition ${
                  form.role === role
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-line-strong text-ink-muted hover:border-ink-faint'
                }`}>
                <input type="radio" name="role" value={role} className="sr-only"
                  checked={form.role === role}
                  onChange={() => setForm((f) => ({ ...f, role }))} />
                {role}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className={buttonClass} disabled={submitting}>
          {submitting ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <GoogleSignInButton />
      <p className="mt-4 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary-600 hover:underline">Log in</Link>
      </p>
    </AuthCard>
  );
}
