import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../api/authApi';

/**
 * Session persistence: the user object and the 7-day REFRESH token are
 * persisted to localStorage so a page reload (or reopening the tab) keeps
 * you logged in for the refresh token's lifetime. The short-lived ACCESS
 * token is deliberately NOT persisted — it starts null after a reload and
 * the axios interceptor's silent-refresh path mints a fresh one on the
 * first API call. Logout and refresh-failure both clear the stored state,
 * and a password reset revokes all refresh tokens server-side.
 */
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (auth: { user: User; accessToken: string; refreshToken: string }) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'verinest-auth',
      // accessToken is intentionally excluded (memory-only, 15-min TTL).
      partialize: (s) => ({
        user: s.user,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);

// Dev-only hook for E2E tests to manipulate the session (e.g. corrupt the
// access token to exercise the silent-refresh path). Stripped from prod builds.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__authStore = useAuthStore;
}
