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
