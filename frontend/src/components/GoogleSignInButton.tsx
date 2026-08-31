import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import * as googleAuthApi from '../api/googleAuthApi';
import { getApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { FormAlert } from './AuthCard';

// Present only when the app was built with a Google client id. Reading it here
// lets us hide the whole block (and avoid touching GoogleLogin, which throws
// outside a GoogleOAuthProvider) when Google sign-in is not configured.
const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

// Track the app's light/dark state (`.dark` on <html>, driven by ThemeToggle)
// so Google's own button matches the surrounding card in both themes and
// re-renders the moment the user flips the switch.
const useIsDark = () => {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains('dark')));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
};

/**
 * "Sign in with Google" block: a labelled divider above Google's own button,
 * framed in a soft, theme-aware panel. On a successful credential it exchanges
 * the token for a VeriNest session via the same authStore.setAuth() the
 * email/password flow uses, then routes the user — first-time Google accounts
 * (role still unset) go to /select-role, everyone else to /dashboard.
 */
export default function GoogleSignInButton() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isDark = useIsDark();

  if (!GOOGLE_ENABLED) return null;

  const handleCredential = async (idToken: string) => {
    setError('');
    setBusy(true);
    try {
      const { accessToken, refreshToken, user } = await googleAuthApi.googleLogin(idToken);
      setAuth({ user, accessToken, refreshToken });
      // A returned role of null means this is a first-time Google signup that
      // still has to choose tenant vs. landlord before anything role-gated.
      navigate(user.role ? '/dashboard' : '/select-role');
    } catch (err) {
      setError(getApiError(err));
      setBusy(false);
    }
  };

  return (
      <div className="mt-6">

        {/* =========================================================
        DIVIDER
    ========================================================== */}
        <div className="relative mb-5">
          <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
          >
            <div className="w-full border-t border-line-strong" />
          </div>

          <div className="relative flex justify-center">
        <span className="bg-surface px-3 text-xs font-medium uppercase tracking-widest text-ink-faint">
          or continue with
        </span>
          </div>
        </div>


        {/* Error */}
        {error && (
            <div className="mb-4">
              <FormAlert tone="error" message={error} />
            </div>
        )}


        {/* =========================================================
        GOOGLE SIGN-IN
    ========================================================== */}
        <div
            className="
        relative
        overflow-hidden
        rounded-2xl
        border
        border-line-strong
        bg-surface
        p-1
        shadow-sm
        transition-all
        duration-200
        hover:border-primary-300
        hover:shadow-md
        dark:hover:border-primary-500/40
      "
        >

          {/* Inner surface */}
          <div
              className={`
          relative
          flex
          min-h-[52px]
          items-center
          justify-center
          overflow-hidden
          rounded-[14px]
          bg-surface
          transition-opacity
          ${busy ? 'pointer-events-none opacity-50' : ''}
        `}
          >

            <GoogleLogin
                key={isDark ? 'dark' : 'light'}
                onSuccess={(res) => {
                  if (res.credential) {
                    void handleCredential(res.credential);
                  } else {
                    setError(
                        'Google did not return a credential. Please try again.'
                    );
                  }
                }}
                onError={() => {
                  setError(
                      'Google sign-in was cancelled or failed. Please try again.'
                  );
                }}
                theme={isDark ? 'filled_black' : 'outline'}
                size="large"
                shape="pill"
                text="continue_with"
                logo_alignment="center"
                width="320"
            />

            {/* Loading overlay */}
            {busy && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-surface/80 backdrop-blur-[2px]">
                  <div className="flex items-center gap-2">

                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600 dark:border-primary-500/30 dark:border-t-primary-400" />

                    <span className="text-sm font-semibold text-ink-muted">
                Signing you in…
              </span>

                  </div>
                </div>
            )}

          </div>

        </div>


        {/* Privacy note */}
        <div className="mt-3 flex items-center justify-center gap-1.5">

          <svg
              className="h-3.5 w-3.5 text-ink-faint"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
          >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3l7 4v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V7l7-4z"
            />
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4"
            />
          </svg>

          <p className="text-center text-xs text-ink-faint">
            Secure sign-in · We never post to Google
          </p>

        </div>

      </div>
  );
}
