import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as authApi from '../api/authApi';
import { getApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { AuthCard, FormAlert, buttonClass, inputClass, labelClass } from '../components/AuthCard';
import { photos } from '../assets/photos';

const RESEND_COOLDOWN_S = 30;

export default function OtpVerifyPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const location = useLocation();
  const initial = (location.state ?? {}) as { email?: string; otpJustSent?: boolean };

  const [email, setEmail] = useState(initial.email ?? '');
  const [otp, setOtp] = useState('');
  const [apiError, setApiError] = useState('');
  const [info, setInfo] = useState(initial.otpJustSent ? 'A verification code has been sent to your email.' : '');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(initial.otpJustSent ? RESEND_COOLDOWN_S : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setApiError('');
    setInfo('');
    setResending(true);
    try {
      const { message } = await authApi.sendOtp(email, 'signup');
      setInfo(message);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setApiError(getApiError(err));
    } finally {
      setResending(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setApiError('');
    setInfo('');
    if (!email || !/^\d{6}$/.test(otp.trim())) {
      setApiError('Enter your email and the 6-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await authApi.verifyOtp(email, otp.trim(), 'signup');
      if (data.accessToken && data.refreshToken && data.user) {
        // Signup verification returns a full session — sign the new user in
        // and take them straight to their dashboard, no manual login step.
        setAuth({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { state: { verified: true, email } });
      }
    } catch (err) {
      setApiError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Verify your email" backdrop={photos.authNewHome}>
      {apiError && <FormAlert tone="error" message={apiError} />}
      {info && !apiError && <FormAlert tone="success" message={info} />}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" type="email" className={inputClass} value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="otp" className={labelClass}>Verification code</label>
          <input id="otp" inputMode="numeric" maxLength={6} placeholder="6-digit code"
            className={`${inputClass} text-center text-lg tracking-[0.5em]`}
            value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
        </div>
        <button type="submit" className={buttonClass} disabled={submitting}>
          {submitting ? 'Verifying…' : 'Verify'}
        </button>
      </form>
      <button type="button" onClick={resend} disabled={cooldown > 0 || resending || !email}
        className="mt-3 w-full rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">
        {cooldown > 0 ? `Resend OTP (${cooldown}s)` : resending ? 'Sending…' : 'Resend OTP'}
      </button>
      <p className="mt-4 text-center text-sm text-ink-muted">
        Back to{' '}
        <Link to="/login" className="font-medium text-primary-600 hover:underline">login</Link>
      </p>
    </AuthCard>
  );
}
