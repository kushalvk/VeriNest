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
  const { data } = await client.post<{ message: string }>('/auth/otp/verify', {
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
