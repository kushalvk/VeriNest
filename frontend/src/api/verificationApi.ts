import { client } from './client';

export type AccessType = 'one_time' | '24_hours' | '7_days';
export type VerificationRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface VerificationRequest {
  _id: string;
  accessType: AccessType;
  status: VerificationRequestStatus;
  createdAt: string;
  expiresAt?: string;
  landlordId?: { _id: string; fullName: string } | string;
  applicationId?: {
    _id: string;
    propertyId?: { _id: string; title: string; address?: { city?: string } };
  } | string;
}

/**
 * A landlord's own request, as returned by /verification-requests/landlord.
 * `active` is computed server-side (approved, within its window, and — for a
 * one-time link — not yet viewed); the in-app "view documents" affordance only
 * shows while it is true.
 */
export interface LandlordVerificationRequest extends VerificationRequest {
  active: boolean;
}

export interface SharedDocument {
  documentType: string;
  url?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export const createVerificationRequest = async (
  applicationId: string,
  accessType: AccessType
) => {
  const { data } = await client.post<{ request: VerificationRequest }>(
    '/verification-requests',
    { applicationId, accessType }
  );
  return data.request;
};

export const getMyVerificationRequests = async () => {
  const { data } = await client.get<{ requests: VerificationRequest[] }>(
    '/verification-requests/mine',
    { params: { limit: 100 } }
  );
  return data.requests;
};

/**
 * On approve, the response carries the RAW access token — the only time it
 * ever exists client-side. It is never persisted or re-fetchable.
 */
export const respondToVerificationRequest = async (
  id: string,
  action: 'approve' | 'reject'
) => {
  const { data } = await client.patch<{
    request: VerificationRequest;
    accessToken?: string;
    accessUrl?: string;
  }>(`/verification-requests/${id}/respond`, { action });
  return data;
};

export const accessDocumentsByToken = async (token: string) => {
  const { data } = await client.get<{
    accessType: AccessType;
    expiresAt: string;
    documents: SharedDocument[];
  }>(`/verification/access/${encodeURIComponent(token)}`);
  return data;
};

/** The landlord's own list of verification requests (for the in-app access UI). */
export const getLandlordVerificationRequests = async () => {
  const { data } = await client.get<{ requests: LandlordVerificationRequest[] }>(
    '/verification-requests/landlord',
    { params: { limit: 100 } }
  );
  return data.requests;
};

/**
 * Landlord fetches the shared documents for one of their approved requests,
 * gated by their session (no bearer token). Same response + 410 semantics as
 * accessDocumentsByToken. For a one-time request this consumes the single view.
 */
export const accessDocumentsByRequestId = async (requestId: string) => {
  const { data } = await client.get<{
    accessType: AccessType;
    expiresAt: string;
    documents: SharedDocument[];
  }>(`/verification-requests/${encodeURIComponent(requestId)}/documents`);
  return data;
};
