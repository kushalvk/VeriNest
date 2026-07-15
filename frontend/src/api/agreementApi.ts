import { client } from './client';

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
  status: 'draft' | 'active' | 'completed' | 'terminated';
  createdAt: string;
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
  const { data } = await client.patch<{ agreement: Agreement }>(
    `/agreements/${id}/sign`,
    { signatureBase64 }
  );
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
