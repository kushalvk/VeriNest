import { client } from './client';

export type AccessType = 'one_time' | '24_hours' | '7_days';
export type VerificationRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface VerificationRequest {
  _id: string;
  accessType: AccessType;
  status: VerificationRequestStatus;
  createdAt: string;
  landlordId?: { _id: string; fullName: string } | string;
  applicationId?: {
    _id: string;
    propertyId?: { _id: string; title: string; address?: { city?: string } };
  } | string;
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
