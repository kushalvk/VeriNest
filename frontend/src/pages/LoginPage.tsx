import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import * as authApi from '../api/authApi';
import { getApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { AuthCard, FormAlert, buttonClass, inputClass, labelClass } from '../components/AuthCard';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // undefined when no VITE_RECAPTCHA_SITE_KEY / provider — form still works,
  // the backend's dev fallback accepts tokenless requests in that case.
  const { executeRecaptcha } = useGoogleReCaptcha();
  const setAuth = useAuthStore((s) => s.setAuth);
  const initial = (location.state ?? {}) as { verified?: boolean; email?: string };

  const [email, setEmail] = useState(initial.email ?? '');
  const [password, setPassword] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setApiError('');
    if (!email || !password) {
      setApiError('Email and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      // Invisible reCAPTCHA: a fresh token per attempt (they're single-use),
      // action name must match the backend's requireRecaptcha("login").
      const recaptchaToken = executeRecaptcha ? await executeRecaptcha('login') : undefined;
      const { accessToken, refreshToken, user } = await authApi.login(email, password, recaptchaToken);
      setAuth({ user, accessToken, refreshToken });
      navigate('/dashboard');
    } catch (err) {
      setApiError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Log in">
      {initial.verified && !apiError && (
        <FormAlert tone="success" message="Email verified! You can log in now." />
      )}
      {apiError && <FormAlert tone="error" message={apiError} />}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" type="email" className={inputClass} value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className={labelClass}>Password</label>
            <Link to="/forgot-password" data-testid="forgot-password-link"
              className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
              Forgot password?
            </Link>
          </div>
          <input id="password" type="password" className={inputClass} value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button type="submit" className={buttonClass} disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <GoogleSignInButton />
      <p className="mt-4 text-center text-sm text-ink-muted">
        New here?{' '}
        <Link to="/register" className="font-medium text-primary-600 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
