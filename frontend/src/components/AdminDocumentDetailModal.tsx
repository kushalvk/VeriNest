import { useState } from 'react';
import * as adminApi from '../api/adminApi';
import { getApiError } from '../api/client';
import { inputClass, labelClass } from './AuthCard';
import type { AdminDocument } from '../api/adminApi';

const isImage = (url?: string) => !!url && !url.toLowerCase().split('?')[0].endsWith('.pdf');

const tenantOf = (doc: AdminDocument) =>
  typeof doc.tenantId === 'object' && doc.tenantId
    ? `${doc.tenantId.fullName} <${doc.tenantId.email}>`
    : String(doc.tenantId ?? 'unknown');

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

  const flags = [
    doc.fraudDetected && { label: 'Fraud signal', cls: 'bg-red-100 text-red-700 border-red-200' },
    doc.duplicateDetected && { label: 'Duplicate image', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    doc.blurryDocument && { label: 'Blurry', cls: 'bg-canvas text-ink-muted border-line' },
  ].filter(Boolean) as Array<{ label: string; cls: string }>;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 px-4 py-8"
      data-testid="admin-doc-modal">
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="font-semibold capitalize text-ink">
            {doc.documentType.replace(/_/g, ' ')} — review
          </h3>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-ink-faint hover:text-ink">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="text-sm text-ink-muted">
            <span className="font-medium">Tenant:</span> {tenantOf(doc)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Uploaded {new Date(doc.createdAt).toLocaleString()} · OCR: {doc.ocrStatus}
          </p>

          {flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" data-testid="modal-flags">
              {flags.map((f) => (
                <span key={f.label}
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${f.cls}`}>
                  {f.label}
                </span>
              ))}
            </div>
          )}

          {doc.remarks && (
            <p className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-muted" data-testid="modal-remarks">
              <span className="font-medium">Existing remarks:</span> {doc.remarks}
            </p>
          )}

          <div className="mt-4 overflow-hidden rounded-md border border-line bg-surface-muted">
            {isImage(doc.cloudinary?.url) ? (
              <img src={doc.cloudinary?.url} alt="Document preview"
                data-testid="modal-preview" className="max-h-80 w-full object-contain" />
            ) : doc.cloudinary?.url ? (
              <a href={doc.cloudinary.url} target="_blank" rel="noreferrer"
                className="block p-6 text-center text-sm font-medium text-primary-600 hover:underline">
                📄 Open PDF document
              </a>
            ) : (
              <p className="p-6 text-center text-sm text-ink-faint">No file stored.</p>
            )}
          </div>

          {/* OCR text is admin-only context — intentionally not shown to tenants */}
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              OCR extracted text{doc.extractedData?.confidence != null ? ` (confidence ${doc.extractedData.confidence})` : ''}
            </h4>
            <pre data-testid="modal-ocr-text"
              className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-surface-muted p-3 text-xs text-ink-muted">
              {doc.extractedData?.rawText?.trim() || '(no text extracted)'}
            </pre>
          </div>

          <div className="mt-4">
            <label htmlFor="admin-remarks" className={labelClass}>Remarks (optional)</label>
            <textarea id="admin-remarks" rows={2} className={inputClass} value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Visible to the tenant with the decision…" />
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-3 border-t border-line px-5 py-3">
          <button type="button" data-testid="approve-doc" disabled={busy !== null}
            onClick={() => void decide('verified')}
            className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            {busy === 'verified' ? 'Approving…' : 'Approve'}
          </button>
          <button type="button" data-testid="reject-doc" disabled={busy !== null}
            onClick={() => void decide('rejected')}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
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
