import { client } from './client';
import type { Pagination } from './propertyApi';

export type AdminVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface AdminDocument {
  _id: string;
  tenantId: { _id: string; fullName: string; email: string } | string | null;
  documentType: string;
  cloudinary?: { publicId?: string; url?: string };
  extractedData?: { rawText?: string; confidence?: number; [key: string]: unknown };
  verificationStatus: AdminVerificationStatus;
  ocrStatus: 'not_started' | 'processing' | 'done' | 'failed';
  fraudDetected: boolean;
  duplicateDetected: boolean;
  blurryDocument: boolean;
  remarks?: string;
  createdAt: string;
}

export const getDocuments = async (status: AdminVerificationStatus, page = 1) => {
  const { data } = await client.get<{ documents: AdminDocument[]; pagination: Pagination }>(
    '/admin/documents',
    { params: { status, page, limit: 10 } }
  );
  return data;
};

export interface AdminDocumentUser {
  tenantId: string;
  fullName?: string;
  email?: string;
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  flagged: number;
  lastUploadAt: string;
}

export const getDocumentUsers = async (page = 1) => {
  const { data } = await client.get<{ users: AdminDocumentUser[]; pagination: Pagination }>(
    '/admin/documents/users',
    { params: { page, limit: 10 } }
  );
  return data;
};

export const getUserDocuments = async (tenantId: string) => {
  const { data } = await client.get<{ documents: AdminDocument[] }>(
    `/admin/documents/users/${tenantId}`
  );
  return data.documents;
};

export const updateDocumentStatus = async (
  id: string,
  status: 'verified' | 'rejected',
  remarks?: string
) => {
  const { data } = await client.patch<{ document: AdminDocument }>(
    `/admin/documents/${id}`,
    { status, ...(remarks?.trim() ? { remarks: remarks.trim() } : {}) }
  );
  return data.document;
};

export const recalculateTrustScore = async (tenantId: string) => {
  const { data } = await client.post<{ tenantId: string; score: number; reasons: string[] }>(
    `/trust-score/recalculate/${tenantId}`
  );
  return data;
};

export interface AdminTenant {
  _id: string;
  fullName: string;
  email: string;
  createdAt?: string;
  hasProfile: boolean;
  trustScore: number | null;
}

export const listTenants = async (search: string, page = 1) => {
  const { data } = await client.get<{ tenants: AdminTenant[]; pagination: Pagination }>(
    '/trust-score/tenants',
    { params: { ...(search.trim() ? { search: search.trim() } : {}), page, limit: 10 } }
  );
  return data;
};

/* ---------------------------------------------------------------- users --- */

export type UserRole = 'tenant' | 'landlord' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'blocked';

export interface AdminUser {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  role?: UserRole;
  accountStatus: AccountStatus;
  authProvider: 'local' | 'google';
  isEmailVerified: boolean;
  profileImage?: { publicId?: string; url?: string };
  lastLogin?: string;
  createdAt: string;
  /** tenants only — null for other roles */
  trustScore: number | null;
  /** landlords only — null for other roles */
  propertyCount: number | null;
}

export interface AdminUserStats {
  documents: number;
  verifiedDocuments: number;
  properties: number;
  applications: number;
  activeAgreements: number;
  rentals: number;
  trustScore: number | null;
}

export interface AdminUserFilters {
  search?: string;
  role?: UserRole | 'all';
  status?: AccountStatus | 'all';
}

export const listUsers = async (filters: AdminUserFilters, page = 1) => {
  const { data } = await client.get<{ users: AdminUser[]; pagination: Pagination }>(
    '/admin/users',
    {
      params: {
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.role && filters.role !== 'all' ? { role: filters.role } : {}),
        ...(filters.status && filters.status !== 'all' ? { status: filters.status } : {}),
        page,
        limit: 10,
      },
    }
  );
  return data;
};

export const getUser = async (id: string) => {
  const { data } = await client.get<{
    user: AdminUser;
    profile: Record<string, unknown> | null;
    stats: AdminUserStats;
  }>(`/admin/users/${id}`);
  return data;
};

export const setUserStatus = async (
  id: string,
  status: 'active' | 'blocked',
  reason?: string
) => {
  const { data } = await client.patch<{ user: AdminUser }>(`/admin/users/${id}/status`, {
    status,
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
  });
  return data.user;
};

export const deleteUser = async (id: string) => {
  const { data } = await client.delete<{ message: string; userId: string }>(
    `/admin/users/${id}`
  );
  return data;
};
