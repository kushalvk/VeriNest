import { useCallback, useEffect, useRef, useState } from 'react';
import * as documentApi from '../api/documentApi';
import { getApiError } from '../api/client';
import DocumentCard from './DocumentCard';
import type { TenantDocument } from '../api/documentApi';

const POLL_MS = 5000;

interface Props {
  /** bump to force a refetch (e.g. after an upload) */
  refreshKey: number;
  /** document ids with an OCR call still in flight from this session */
  processingIds: Set<string>;
}

export default function DocumentList({ refreshKey, processingIds }: Props) {
  const [documents, setDocuments] = useState<TenantDocument[] | null>(null);
  const [error, setError] = useState('');
  const graceDone = useRef(false);

  const load = useCallback(async () => {
    try {
      const docs = await documentApi.getMyDocuments();
      setDocuments([...docs].sort((a, b) => a.documentType.localeCompare(b.documentType)));
      setError('');
      return docs;
    } catch (err) {
      setError(getApiError(err));
      return null;
    }
  }, []);

  useEffect(() => {
    graceDone.current = false;
    void load();
  }, [load, refreshKey]);

  // Poll ONLY while something is still processing; once every document
  // reaches a terminal ocrStatus, do a single grace poll (to catch the
  // server-side fraud-check that runs just after OCR) and then stop.
  const anyProcessing =
    processingIds.size > 0 ||
    (documents ?? []).some((d) => d.ocrStatus === 'processing');

  useEffect(() => {
    if (anyProcessing) {
      graceDone.current = false;
      const timer = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(timer);
    }
    if (documents && !graceDone.current) {
      graceDone.current = true;
      const timer = setTimeout(() => void load(), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [anyProcessing, documents, load]);

  if (documents === null && !error) {
    return <p className="text-sm text-ink-faint">Loading documents…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">
          Your documents {documents ? `(${documents.length})` : ''}
        </h2>
        <button
          type="button"
          data-testid="refresh-documents"
          onClick={() => void load()}
          className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-muted"
        >
          Refresh
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {documents?.length === 0 && (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-faint">
          No documents uploaded yet.
        </p>
      )}
      {documents?.map((doc) => (
        <DocumentCard key={doc._id} document={doc} processing={processingIds.has(doc._id)} />
      ))}
    </div>
  );
}
