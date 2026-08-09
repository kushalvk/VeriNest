import { client } from './client';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  // Optional: a Google-created account has no phone until the user completes
  // their profile.
  phone?: string;
  // Null/undefined for a brand-new Google account that hasn't chosen a role
  // yet — such users are routed through /select-role before any role-gated page.
  role: 'tenant' | 'landlord' | 'admin' | null;
  authProvider?: 'local' | 'google';
  isEmailVerified: boolean;
  accountStatus: 'pending' | 'active' | 'blocked';
  // True for the public "try it out" guest accounts, whose data is reset on
  // every sign-in. Drives the demo-mode banner in AppShell.
  isDemo?: boolean;
}

/** A publicly advertised guest login — password included by design. */
export interface DemoAccount {
  role: 'tenant' | 'landlord';
  label: string;
  email: string;
  password: string;
  description: string;
}

export type OtpPurpose = 'signup' | 'forgot_password' | 'email_verification' | 'login';

export interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: 'tenant' | 'landlord';
}

export const register = async (input: RegisterInput) => {
  const { data } = await client.post<{ message: string; user: User }>(
    '/auth/register',
    input
  );
  return data;
};

export const login = async (email: string, password: string) => {
  const { data } = await client.post<{
    accessToken: string;
    refreshToken: string;
    user: User;
  }>('/auth/login', { email, password });
  return data;
};

/**
 * Guest logins offered on the login page. Returns an empty list when the demo
 * accounts have not been seeded (`npm run seed:demo`), which hides the section.
 */
export const getDemoAccounts = async () => {
  const { data } = await client.get<{ accounts: DemoAccount[] }>('/auth/demo-accounts');
  return data.accounts;
};

export const sendOtp = async (email: string, purpose: OtpPurpose = 'signup') => {
  const { data } = await client.post<{ message: string }>('/auth/otp/send', {
    email,
    purpose,
  });
  return data;
};

export const verifyOtp = async (
  email: string,
  otp: string,
  purpose: OtpPurpose = 'signup'
) => {
  // For purpose "signup" the backend also returns a full session (the OTP
  // proved control of the email), so the new user is signed in immediately.
  const { data } = await client.post<{
    message: string;
    accessToken?: string;
    refreshToken?: string;
    user?: User;
  }>('/auth/otp/verify', {
    email,
    otp,
    purpose,
  });
  return data;
};

/** Completes the forgot-password flow: emailed OTP + new password in one call. */
export const resetPassword = async (email: string, otp: string, newPassword: string) => {
  const { data } = await client.post<{ message: string }>('/auth/reset-password', {
    email,
    otp,
    newPassword,
  });
  return data;
};

export const logout = async (refreshToken: string) => {
  const { data } = await client.post<{ message: string }>('/auth/logout', {
    refreshToken,
  });
  return data;
};

/** Decoded token payload — used by the dashboard as a session check. */
export const me = async () => {
  const { data } = await client.get<{ user: { id: string; role: string } }>(
    '/auth/me'
  );
  return data;
};
