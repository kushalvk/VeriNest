import { client } from './client';

export const DOCUMENT_TYPES = [
  'aadhaar',
  'pan',
  'passport',
  'salary_slip',
  'bank_statement',
  'employment_letter',
  'driving_license',
  'agreement',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface TenantDocument {
  _id: string;
  tenantId: string;
  documentType: DocumentType;
  cloudinary?: { publicId?: string; url?: string };
  verificationStatus: 'pending' | 'verified' | 'rejected';
  ocrStatus: 'not_started' | 'processing' | 'done' | 'failed';
  fraudDetected: boolean;
  duplicateDetected: boolean;
  blurryDocument: boolean;
  remarks?: string;
  createdAt: string;
}

export const uploadDocument = async (
  file: File,
  documentType: DocumentType,
  onProgress?: (percent: number) => void
) => {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  const { data } = await client.post<{ document: TenantDocument }>(
    '/documents/upload',
    form,
    {
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    }
  );
  return data.document;
};

export const getMyDocuments = async () => {
  const { data } = await client.get<{ documents: TenantDocument[] }>(
    '/documents/my',
    { params: { limit: 100 } }
  );
  return data.documents;
};

export const runOcr = async (documentId: string) => {
  const { data } = await client.post<{ message: string; document: TenantDocument }>(
    `/documents/${documentId}/ocr`
  );
  return data.document;
};

export const runFraudCheck = async (documentId: string) => {
  const { data } = await client.post<{ document: TenantDocument }>(
    `/documents/${documentId}/fraud-check`
  );
  return data.document;
};
