import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, UserRound } from 'lucide-react';
import * as googleAuthApi from '../api/googleAuthApi';
import { getApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { AuthCard, FormAlert } from '../components/AuthCard';
import { photos } from '../assets/photos';

/**
 * One-time role picker shown right after a first Google login (when the account
 * has no role yet). Choosing persists the role server-side and swaps in a fresh,
 * correctly-roled session; afterwards the user goes to the dashboard, where the
 * usual profile-completion nudge takes over.
 */
export default function SelectRolePage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const role = useAuthStore((s) => s.user?.role);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<null | 'tenant' | 'landlord'>(null);

  // Role already chosen (or a normal account landed here) — nothing to do.
  if (role) return <Navigate to="/dashboard" replace />;

  const choose = async (choice: 'tenant' | 'landlord') => {
    if (submitting) return;
    setError('');
    setSubmitting(choice);
    try {
      const { accessToken, refreshToken, user } = await googleAuthApi.setRole(choice);
      setAuth({ user, accessToken, refreshToken });
      navigate('/dashboard');
    } catch (err) {
      setError(getApiError(err));
      setSubmitting(null);
    }
  };

  return (
    <AuthCard title="How will you use VeriNest?" backdrop={photos.authNewHome}>
      <p className="mb-6 text-center text-sm text-ink-muted">
        Pick the role that fits you. This is a one-time choice and sets up the
        right experience for your account.
      </p>
      {error && <FormAlert tone="error" message={error} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          { role: 'tenant', icon: UserRound, title: "I'm a Tenant", text: 'Build a verified profile and rent with confidence.' },
          { role: 'landlord', icon: Building2, title: "I'm a Landlord", text: 'List properties and receive pre-verified applicants.' },
        ] as const).map(({ role: r, icon: Icon, title, text }) => (
          <button
            key={r}
            type="button"
            onClick={() => choose(r)}
            disabled={submitting !== null}
            className="group flex flex-col items-center gap-2 rounded-lg border border-line-strong bg-surface p-5 text-center transition hover:border-primary-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="font-semibold text-ink">
              {submitting === r ? 'Setting up…' : title}
            </span>
            <span className="text-xs leading-snug text-ink-muted">{text}</span>
          </button>
        ))}
      </div>
    </AuthCard>
  );
}
