import { client } from './client';

export type Party = 'tenant' | 'landlord';
export type AgreementStatus = 'draft' | 'active' | 'end_requested' | 'completed' | 'terminated';

export interface EndRequestRecord {
  _id?: string;
  requestedBy: string;
  requestedByRole: Party;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  respondedAt?: string;
  responseNote?: string;
}

export interface Agreement {
  _id: string;
  tenantId: string;
  landlordId: string;
  propertyId: string | { _id: string; title: string; address?: { city?: string } };
  applicationId: string;
  agreementNumber: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit?: number;
  agreementPdf?: { publicId?: string; url?: string };
  tenantSigned: boolean;
  landlordSigned: boolean;
  signedAt?: string;
  status: AgreementStatus;
  createdAt: string;
  endRequests?: EndRequestRecord[];
  endedAt?: string;
  endType?: 'natural' | 'early_approved';
  tenantRated?: boolean;
  landlordRated?: boolean;
}

/** Shape returned by GET /agreements/mine/lifecycle */
export interface LifecycleAgreement {
  _id: string;
  agreementNumber: string;
  status: AgreementStatus;
  myRole: Party;
  property: { _id: string; title?: string; address?: { city?: string } } | null;
  counterparty: { _id: string; fullName?: string; ratingAvg?: number } | null;
  startDate: string;
  endDate: string;
  monthlyRent?: number;
  deposit?: number;
  tenantSigned: boolean;
  landlordSigned: boolean;
  signedAt?: string;
  endRequests: {
    hasPending: boolean;
    requestedByRole: Party | null;
    requester: { _id: string; fullName?: string } | null;
    reason: string | null;
    requestedAt: string | null;
  };
  canInitiateEnd: boolean;
  isEarlyEnd: boolean;
  canRespondEndRequest: boolean;
  canCancelEndRequest: boolean;
  canRate: boolean;
  iRated: boolean;
  myRating?: number | null;
  endedAt?: string;
  endType?: 'natural' | 'early_approved';
}

export interface ActionResponse {
  message?: string;
  outcome?: 'completed' | 'end_requested';
  agreement?: Agreement;
}

export const createAgreement = async (
    applicationId: string,
    startDate: string,
    endDate: string,
    deposit?: number
) => {
  const { data } = await client.post<{ agreement: Agreement }>('/agreements', {
    applicationId,
    startDate,
    endDate,
    ...(deposit != null && !Number.isNaN(deposit) ? { deposit } : {}),
  });
  return data.agreement;
};

export const signAgreement = async (id: string, signatureBase64: string) => {
  const { data } = await client.patch<{ agreement: Agreement }>(`/agreements/${id}/sign`, {
    signatureBase64,
  });
  return data.agreement;
};

export const getAgreement = async (id: string) => {
  const { data } = await client.get<{ agreement: Agreement }>(`/agreements/${id}`);
  return data.agreement;
};

export const getMyAgreements = async () => {
  const { data } = await client.get<{ agreements: Agreement[] }>('/agreements/mine', {
    params: { limit: 100 },
  });
  return data.agreements;
};

// ---------- Lifecycle ----------

export const listMyAgreementsLifecycle = async () => {
  const { data } = await client.get<{ agreements: LifecycleAgreement[] }>(
      '/agreements/mine/lifecycle',
      { params: { limit: 100 } }
  );
  return data.agreements;
};

export const initiateEndRequest = async (agreementId: string, reason: string) => {
  const { data } = await client.patch<ActionResponse>(`/agreements/${agreementId}/end`, { reason });
  return data;
};

export const respondToEndRequest = async (agreementId: string, action: 'approve' | 'reject') => {
  const { data } = await client.patch<ActionResponse>(`/agreements/${agreementId}/end/respond`, {
    action,
  });
  return data;
};

export const cancelEndRequest = async (agreementId: string) => {
  const { data } = await client.patch<ActionResponse>(
      `/agreements/${agreementId}/cancel-end-request`
  );
  return data;
};

export const submitRating = async (agreementId: string, rating: number, review?: string) => {
  const { data } = await client.post(`/agreements/${agreementId}/rate`, {
    rating,
    ...(review?.trim() ? { review: review.trim() } : {}),
  });
  return data;
};