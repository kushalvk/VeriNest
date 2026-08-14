import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import * as authApi from '../api/authApi';
import { getApiError } from '../api/client';
import { AuthCard, FormAlert, buttonClass, inputClass, labelClass } from '../components/AuthCard';
import { photos } from '../assets/photos';

const RESEND_COOLDOWN_S = 30;

/**
 * Forgot-password flow:
 *   1. email → OTP is sent (purpose "forgot_password")
 *   2. OTP + new password → /auth/reset-password (verifies and sets atomically)
 *   3. done → link to log in (all previous sessions are revoked server-side)
 */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendCode = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setBusy(true);
    try {
      await authApi.sendOtp(email.trim(), 'forgot_password');
      setStep('reset');
      setInfo(`We emailed a 6-digit reset code to ${email.trim()}.`);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const onRequestSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) void sendCode();
  };

  const onResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setInfo('');
    if (!otp.trim()) {
      setError('Please enter the code from the email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(email.trim(), otp.trim(), newPassword);
      setStep('done');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <AuthCard title="Password reset" backdrop={photos.authLiving}>
        <FormAlert tone="success"
          message="Your password has been changed and all previous sessions were signed out." />
        <Link to="/login"
          className={`${buttonClass} block text-center`} data-testid="back-to-login">
          Log in with your new password
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot password" backdrop={photos.authLiving}>
      {error && <FormAlert tone="error" message={error} />}
      {!error && info && <FormAlert tone="success" message={info} />}

      {step === 'email' && (
        <form onSubmit={onRequestSubmit} noValidate className="space-y-4">
          <p className="text-sm text-ink-muted">
            Enter the email you registered with and we’ll send you a one-time reset code.
          </p>
          <div>
            <label htmlFor="fp-email" className={labelClass}>Email</label>
            <input id="fp-email" type="email" className={inputClass} value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email"
              data-testid="fp-email" />
          </div>
          <button type="submit" className={buttonClass} disabled={busy} data-testid="fp-send">
            {busy ? 'Sending code…' : 'Email me a reset code'}
          </button>
          <p className="text-center text-sm text-ink-muted">
            Remembered it?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:underline dark:text-primary-400">
              Back to log in
            </Link>
          </p>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={onResetSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="fp-otp" className={labelClass}>Reset code</label>
            <input id="fp-otp" inputMode="numeric" maxLength={6} className={inputClass}
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit code" autoComplete="one-time-code" data-testid="fp-otp" />
          </div>
          <div>
            <label htmlFor="fp-new" className={labelClass}>New password</label>
            <input id="fp-new" type="password" className={inputClass} value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password"
              data-testid="fp-new-password" />
            <p className="mt-1 text-xs text-ink-faint">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="fp-confirm" className={labelClass}>Confirm new password</label>
            <input id="fp-confirm" type="password" className={inputClass} value={confirm}
              onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
              data-testid="fp-confirm" />
          </div>
          <button type="submit" className={buttonClass} disabled={busy} data-testid="fp-reset">
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" data-testid="fp-resend"
              onClick={() => void sendCode()} disabled={busy || cooldown > 0}
              className="font-medium text-primary-600 hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline dark:text-primary-400">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
            <button type="button"
              onClick={() => { setStep('email'); setOtp(''); setError(''); setInfo(''); }}
              className="font-medium text-ink-muted hover:underline">
              Use a different email
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
