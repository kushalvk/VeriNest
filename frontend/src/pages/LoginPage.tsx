import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as authApi from '../api/authApi';
import type { DemoAccount } from '../api/authApi';
import { getApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { AuthCard, FormAlert, buttonClass, inputClass, labelClass } from '../components/AuthCard';
import GoogleSignInButton from '../components/GoogleSignInButton';
import DemoLoginPanel from '../components/DemoLoginPanel';
import { useDemoAccounts } from '../hooks/useDemoAccounts';

// How long the filled-in demo credentials sit visible before the request goes
// out. Long enough to see what was typed into the form, short enough not to
// feel like a stall.
const DEMO_FILL_PAUSE_MS = 450;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const initial = (location.state ?? {}) as { verified?: boolean; email?: string };

  const [email, setEmail] = useState(initial.email ?? '');
  const [password, setPassword] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Which demo account is mid-login (empty when none) — drives that card's
  // button label and locks the rest of the form while it runs.
  const [demoBusy, setDemoBusy] = useState('');
  // Empty until the demo accounts are seeded — the page then stays a single
  // centred card instead of an empty second column.
  const demoAccounts = useDemoAccounts();

  const busy = submitting || Boolean(demoBusy);

  /** Shared by the form and the demo buttons — values are passed explicitly
   *  because a demo click sets state and signs in within the same tick. */
  const signIn = async (emailValue: string, passwordValue: string) => {
    const { accessToken, refreshToken, user } = await authApi.login(emailValue, passwordValue);
    setAuth({ user, accessToken, refreshToken });
    navigate('/dashboard');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setApiError('');
    if (!email || !password) {
      setApiError('Email and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setApiError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Demo button: fills the real form fields first — so it's obvious which
   * credentials are being used, and they stay on screen if the login fails —
   * then submits them.
   */
  const onUseDemoAccount = async (account: DemoAccount) => {
    if (busy) return;
    setApiError('');
    setEmail(account.email);
    setPassword(account.password);
    setDemoBusy(account.email);
    try {
      await new Promise((resolve) => setTimeout(resolve, DEMO_FILL_PAUSE_MS));
      await signIn(account.email, account.password);
    } catch (err) {
      setApiError(getApiError(err));
    } finally {
      setDemoBusy('');
    }
  };

  return (
    <AuthCard
      title="Log in"
      aside={
        demoAccounts.length > 0 ? (
          <DemoLoginPanel
            accounts={demoAccounts}
            onUseAccount={onUseDemoAccount}
            busyEmail={demoBusy}
            disabled={busy}
          />
        ) : undefined
      }
    >
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
        <button type="submit" className={buttonClass} disabled={busy}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <GoogleSignInButton />
      <p className="mt-6 text-center text-sm text-ink-muted">
        New here?{' '}
        <Link to="/register" className="font-medium text-primary-600 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
