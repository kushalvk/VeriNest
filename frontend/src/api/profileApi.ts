import axios from 'axios';
import { client } from './client';

export interface Address {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface FamilyMember {
  name?: string;
  relation?: string;
  age?: number;
}

export interface EmergencyContact {
  name?: string;
  relation?: string;
  phone?: string;
}

export type Gender = 'Male' | 'Female' | 'Other';
export type EmploymentType = 'Full Time' | 'Part Time' | 'Business' | 'Student' | 'Other';

export interface TenantProfile {
  _id?: string;
  userId?: string;
  dob?: string;
  gender?: Gender;
  occupation?: string;
  companyName?: string;
  designation?: string;
  employmentType?: EmploymentType;
  monthlySalary?: number;
  aadhaarNumber?: string;
  panNumber?: string;
  passportNumber?: string;
  currentAddress?: Address;
  permanentAddress?: Address;
  emergencyContact?: EmergencyContact;
  familyMembers?: FamilyMember[];
  policeVerificationStatus?: 'pending' | 'verified' | 'rejected';
  trustScore?: number;
  trustReason?: string[];
}

export interface LandlordProfile {
  _id?: string;
  userId?: string;
  companyName?: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  bio?: string;
}

/** Returns the profile, or null when none exists yet (404). */
const getOrNull = async <T>(url: string): Promise<T | null> => {
  try {
    const { data } = await client.get<{ profile: T }>(url);
    return data.profile;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
};

export const getMyTenantProfile = () => getOrNull<TenantProfile>('/tenant-profile/me');

export const createTenantProfile = async (input: TenantProfile) => {
  const { data } = await client.post<{ profile: TenantProfile }>('/tenant-profile', input);
  return data.profile;
};

export const updateTenantProfile = async (input: TenantProfile) => {
  const { data } = await client.put<{ profile: TenantProfile }>('/tenant-profile', input);
  return data.profile;
};

/**
 * Save the tenant profile idempotently. PUT /tenant-profile upserts server-side
 * (create-or-update, keyed by the caller's user id), so a single call works
 * whether or not a profile already exists — no "already exists" (409) or "not
 * found" (404) errors from the page guessing create-vs-edit from a stale load.
 */
export const saveTenantProfile = (input: TenantProfile) => updateTenantProfile(input);

export const getMyLandlordProfile = () => getOrNull<LandlordProfile>('/landlord-profile/me');

export const createLandlordProfile = async (input: LandlordProfile) => {
  const { data } = await client.post<{ profile: LandlordProfile }>('/landlord-profile', input);
  return data.profile;
};

export const updateLandlordProfile = async (input: LandlordProfile) => {
  const { data } = await client.put<{ profile: LandlordProfile }>('/landlord-profile', input);
  return data.profile;
};

/** Idempotent landlord-profile save (PUT upserts) — see saveTenantProfile. */
export const saveLandlordProfile = (input: LandlordProfile) => updateLandlordProfile(input);
