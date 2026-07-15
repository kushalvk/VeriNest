import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as adminApi from '../api/adminApi';
import { getApiError } from '../api/client';
import AdminDocumentDetailModal from '../components/AdminDocumentDetailModal';
import type { AdminDocument, AdminVerificationStatus } from '../api/adminApi';
import type { Pagination } from '../api/propertyApi';

const STATUSES: AdminVerificationStatus[] = ['pending', 'verified', 'rejected'];

const flagBadges = (doc: AdminDocument) => {
  const flags: Array<{ label: string; cls: string }> = [];
  if (doc.fraudDetected) flags.push({ label: 'fraud', cls: 'bg-red-100 text-red-700' });
  if (doc.duplicateDetected) flags.push({ label: 'duplicate', cls: 'bg-orange-100 text-orange-700' });
  if (doc.blurryDocument) flags.push({ label: 'blurry', cls: 'bg-line text-ink-muted' });
  return flags;
};

const tenantName = (doc: AdminDocument) =>
  typeof doc.tenantId === 'object' && doc.tenantId ? doc.tenantId.fullName : String(doc.tenantId ?? '—');

export default function AdminDashboardPage() {
  const [status, setStatus] = useState<AdminVerificationStatus>('pending');
  const [page, setPage] = useState(1);
  const [documents, setDocuments] = useState<AdminDocument[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AdminDocument | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async (s: AdminVerificationStatus, p: number) => {
    setError('');
    try {
      const data = await adminApi.getDocuments(s, p);
      setDocuments(data.documents);
      setPagination(data.pagination);
    } catch (err) {
      setError(getApiError(err));
    }
  }, []);

  useEffect(() => { void load(status, page); }, [load, status, page]);

  const switchStatus = (s: AdminVerificationStatus) => {
    setStatus(s);
    setPage(1);
    setDocuments(null);
  };

  const onDecided = (updated: AdminDocument) => {
    setSelected(null);
    setToast(`Document ${updated.verificationStatus === 'verified' ? 'approved' : 'rejected'}.`);
    setTimeout(() => setToast(''), 4000);
    void load(status, page); // refetch — decided items leave the current filter
  };

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-4xl px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">Document verification queue</h1>
          <Link to="/admin/trust-score" className="text-sm font-medium text-primary-600 hover:underline">
            Trust score tool →
          </Link>
        </div>

        {toast && (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
            data-testid="admin-toast" role="status">
            {toast}
          </p>
        )}

        {/* status tabs */}
        <div className="mt-4 flex gap-1 rounded-lg bg-line p-1" data-testid="status-tabs">
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => switchStatus(s)} data-testid={`tab-${s}`}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                status === s ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}>
              {s}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {documents === null && !error && <p className="mt-6 text-sm text-ink-faint">Loading…</p>}
        {documents?.length === 0 && (
          <p className="mt-6 rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-faint">
            No {status} documents.
          </p>
        )}

        <div className="mt-4 space-y-2">
          {documents?.map((doc) => (
            <button key={doc._id} type="button" onClick={() => setSelected(doc)}
              data-testid="admin-doc-row"
              className="flex w-full items-center gap-4 rounded-lg border border-line bg-surface p-3 text-left transition hover:border-primary-300 hover:shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-canvas">
                {doc.cloudinary?.url && !doc.cloudinary.url.toLowerCase().endsWith('.pdf') ? (
                  <img src={doc.cloudinary.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>📄</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium capitalize text-ink">
                  {doc.documentType.replace(/_/g, ' ')}
                  <span className="ml-2 text-sm font-normal text-ink-faint">{tenantName(doc)}</span>
                </p>
                <p className="text-xs text-ink-faint">
                  Uploaded {new Date(doc.createdAt).toLocaleDateString()} · OCR {doc.ocrStatus}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {flagBadges(doc).map((f) => (
                  <span key={f.label} className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.cls}`}>
                    {f.label}
                  </span>
                ))}
                <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium capitalize text-ink-muted">
                  {doc.verificationStatus}
                </span>
              </div>
            </button>
          ))}
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4" data-testid="admin-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40">
              ← Previous
            </button>
            <span className="text-sm text-ink-muted">
              Page {pagination.page} of {pagination.pages} · {pagination.total} total
            </span>
            <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40">
              Next →
            </button>
          </div>
        )}
      </div>

      {selected && (
        <AdminDocumentDetailModal
          document={selected}
          onClose={() => setSelected(null)}
          onDecided={onDecided}
        />
      )}
    </main>
  );
}
