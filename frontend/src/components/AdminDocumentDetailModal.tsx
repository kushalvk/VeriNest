import { useState } from 'react';
import * as adminApi from '../api/adminApi';
import { getApiError } from '../api/client';
import { inputClass, labelClass } from './AuthCard';
import type { AdminDocument } from '../api/adminApi';

const isImage = (url?: string) => !!url && !url.toLowerCase().split('?')[0].endsWith('.pdf');

const statusBadge: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  verified: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

interface Props {
  document: AdminDocument;
  onClose: () => void;
  /** called with the updated document after a successful decision */
  onDecided: (updated: AdminDocument) => void;
}

export default function AdminDocumentDetailModal({ document: doc, onClose, onDecided }: Props) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState<'verified' | 'rejected' | null>(null);
  const [error, setError] = useState('');
  const [showOcr, setShowOcr] = useState(false);

  const decide = async (status: 'verified' | 'rejected') => {
    if (busy) return; // double-submit guard
    setBusy(status);
    setError('');
    try {
      const updated = await adminApi.updateDocumentStatus(doc._id, status, remarks);
      onDecided(updated);
    } catch (err) {
      setError(getApiError(err));
      setBusy(null);
    }
  };

  const tenant = typeof doc.tenantId === 'object' && doc.tenantId ? doc.tenantId : null;

  const flags = [
    doc.fraudDetected && { label: 'Fraud signal', cls: 'bg-red-100 text-red-700 border-red-200' },
    doc.duplicateDetected && { label: 'Duplicate image', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    doc.blurryDocument && { label: 'Blurry', cls: 'bg-canvas text-ink-muted border-line' },
  ].filter(Boolean) as Array<{ label: string; cls: string }>;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 px-4 py-8"
      data-testid="admin-doc-modal">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-surface shadow-xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <h3 className="font-semibold capitalize text-ink">
            {doc.documentType.replace(/_/g, ' ')}
          </h3>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[doc.verificationStatus]}`}>
            {doc.verificationStatus}
          </span>
          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" data-testid="modal-flags">
              {flags.map((f) => (
                <span key={f.label}
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${f.cls}`}>
                  ⚠ {f.label}
                </span>
              ))}
            </div>
          )}
          <button type="button" onClick={onClose} aria-label="Close"
            className="ml-auto rounded-md p-1 text-ink-faint hover:bg-surface-muted hover:text-ink">
            ✕
          </button>
        </div>

        {/* body: preview | details */}
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-5 md:overflow-hidden">
          {/* preview panel */}
          <div className="flex min-h-64 items-center justify-center bg-canvas p-4 md:col-span-3 md:overflow-y-auto">
            {isImage(doc.cloudinary?.url) ? (
              <a href={doc.cloudinary?.url} target="_blank" rel="noreferrer" title="Open full size"
                className="block">
                <img src={doc.cloudinary?.url} alt="Document preview"
                  data-testid="modal-preview"
                  className="max-h-[26rem] w-full rounded-md border border-line bg-white object-contain shadow-sm" />
              </a>
            ) : doc.cloudinary?.url ? (
              <a href={doc.cloudinary.url} target="_blank" rel="noreferrer"
                className="rounded-lg border border-dashed border-line-strong bg-surface px-8 py-10 text-center text-sm font-medium text-primary-600 hover:border-primary-300">
                <span className="block text-3xl">📄</span>
                <span className="mt-2 block">Open PDF document ↗</span>
              </a>
            ) : (
              <p className="text-sm text-ink-faint">No file stored.</p>
            )}
          </div>

          {/* details panel */}
          <div className="border-t border-line p-5 md:col-span-2 md:overflow-y-auto md:border-l md:border-t-0">
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Tenant</dt>
                <dd className="mt-0.5 text-sm font-medium text-ink">{tenant?.fullName ?? 'Unknown'}</dd>
                {tenant?.email && <dd className="text-xs text-ink-muted">{tenant.email}</dd>}
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Uploaded</dt>
                <dd className="mt-0.5 text-sm text-ink">{new Date(doc.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">OCR status</dt>
                <dd className="mt-0.5 text-sm capitalize text-ink">{doc.ocrStatus.replace(/_/g, ' ')}</dd>
              </div>
            </dl>

            {doc.remarks && (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                data-testid="modal-remarks">
                <span className="font-medium">Existing remarks:</span> {doc.remarks}
              </p>
            )}

            {/* OCR text is admin-only context — intentionally not shown to tenants */}
            <div className="mt-4">
              <button type="button" onClick={() => setShowOcr((v) => !v)}
                className="text-xs font-semibold uppercase tracking-wide text-primary-600 hover:underline">
                {showOcr ? '▾ Hide' : '▸ Show'} OCR extracted text
                {doc.extractedData?.confidence != null ? ` (confidence ${doc.extractedData.confidence})` : ''}
              </button>
              {showOcr && (
                <pre data-testid="modal-ocr-text"
                  className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-surface-muted p-3 text-xs text-ink-muted">
                  {doc.extractedData?.rawText?.trim() || '(no text extracted)'}
                </pre>
              )}
            </div>

            <div className="mt-4">
              <label htmlFor="admin-remarks" className={labelClass}>Remarks (optional)</label>
              <textarea id="admin-remarks" rows={2} className={inputClass} value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Visible to the tenant with the decision…" />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </div>

        {/* footer */}
        <div className="flex gap-3 border-t border-line bg-surface-muted px-5 py-3">
          <button type="button" data-testid="approve-doc" disabled={busy !== null}
            onClick={() => void decide('verified')}
            className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            {busy === 'verified' ? 'Approving…' : '✓ Approve'}
          </button>
          <button type="button" data-testid="reject-doc" disabled={busy !== null}
            onClick={() => void decide('rejected')}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy === 'rejected' ? 'Rejecting…' : '✕ Reject'}
          </button>
          <button type="button" onClick={onClose} disabled={busy !== null}
            className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
