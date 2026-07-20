import { client } from './client';
import type { User } from './authApi';

/**
 * Exchange a Google ID token (the `credential` from Google Identity Services)
 * for a VeriNest session. The backend verifies the token server-side and
 * returns the exact same shape as the email/password login endpoint, so the
 * caller can hand it straight to authStore.setAuth().
 */
export const googleLogin = async (idToken: string) => {
  const { data } = await client.post<{
    accessToken: string;
    refreshToken: string;
    user: User;
  }>('/auth/google', { idToken });
  return data;
};

/**
 * One-time role selection for a freshly created Google account. Returns a fresh
 * token pair reflecting the chosen role (the previous, role-less tokens are
 * revoked server-side), so the caller re-runs setAuth() with the result.
 */
export const setRole = async (role: 'tenant' | 'landlord') => {
  const { data } = await client.patch<{
    accessToken: string;
    refreshToken: string;
    user: User;
  }>('/auth/set-role', { role });
  return data;
};
