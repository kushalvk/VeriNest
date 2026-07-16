import { client } from './client';

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

interface PopulatedProperty {
  _id: string;
  title: string;
  rent: number;
  address?: { city?: string };
}

interface PopulatedTenant {
  _id: string;
  fullName: string;
  email: string;
}

export interface Application {
  _id: string;
  status: ApplicationStatus;
  message?: string;
  appliedAt: string;
  createdAt: string;
}

export interface MyApplication extends Application {
  propertyId: PopulatedProperty | null;
}

export interface TenantMeta {
  trustScore: number | null;
  documentsTotal: number;
  documentsVerified: number;
}

export interface ReceivedApplication extends Application {
  tenantId: PopulatedTenant | null;
  propertyId: PopulatedProperty | null;
  tenantMeta?: TenantMeta;
}

export interface TenantSummary {
  tenant: { fullName: string; email: string; memberSince?: string };
  trustScore: number | null;
  trustReasons: string[];
  profile: {
    occupation?: string;
    employmentType?: string;
    companyName?: string;
    designation?: string;
    monthlySalary?: number;
    currentCity?: string;
    currentState?: string;
    policeVerificationStatus?: 'pending' | 'verified' | 'rejected';
  } | null;
  documents: Array<{ documentType: string; verificationStatus: 'pending' | 'verified' | 'rejected' }>;
  allDocumentsVerified: boolean;
}

export const getTenantSummary = async (applicationId: string) => {
  const { data } = await client.get<TenantSummary>(
    `/applications/${applicationId}/tenant-profile`
  );
  return data;
};

export const applyToProperty = async (propertyId: string, message?: string) => {
  const { data } = await client.post<{ application: Application }>('/applications', {
    propertyId,
    ...(message?.trim() ? { message: message.trim() } : {}),
  });
  return data.application;
};

export const getMyApplications = async () => {
  const { data } = await client.get<{ applications: MyApplication[] }>(
    '/applications/mine',
    { params: { limit: 100 } }
  );
  return data.applications;
};

export const getReceivedApplications = async () => {
  const { data } = await client.get<{ applications: ReceivedApplication[] }>(
    '/applications/received',
    { params: { limit: 100 } }
  );
  return data.applications;
};

export const updateApplicationStatus = async (
  id: string,
  status: 'accepted' | 'rejected'
) => {
  const { data } = await client.patch<{ application: ReceivedApplication }>(
    `/applications/${id}`,
    { status }
  );
  return data.application;
};
