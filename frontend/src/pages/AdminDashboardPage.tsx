import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as adminApi from '../api/adminApi';
import { getApiError } from '../api/client';
import AdminDocumentDetailModal from '../components/AdminDocumentDetailModal';
import type { AdminDocument, AdminDocumentUser, AdminVerificationStatus } from '../api/adminApi';
import type { Pagination } from '../api/propertyApi';

type StatusFilter = 'all' | AdminVerificationStatus;
const FILTERS: StatusFilter[] = ['all', 'pending', 'verified', 'rejected'];

const statusBadge: Record<AdminVerificationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  verified: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

const flagBadges = (doc: AdminDocument) => {
  const flags: Array<{ label: string; cls: string }> = [];
  if (doc.fraudDetected) flags.push({ label: 'fraud', cls: 'bg-red-100 text-red-700' });
  if (doc.duplicateDetected) flags.push({ label: 'duplicate', cls: 'bg-orange-100 text-orange-700' });
  if (doc.blurryDocument) flags.push({ label: 'blurry', cls: 'bg-line text-ink-muted' });
  return flags;
};

const initialOf = (user: AdminDocumentUser) =>
  (user.fullName?.trim()[0] ?? user.email?.trim()[0] ?? '?').toUpperCase();

export default function AdminDashboardPage() {
  // level 1 — users with documents
  const [users, setUsers] = useState<AdminDocumentUser[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  // level 2 — one user's documents
  const [openUser, setOpenUser] = useState<AdminDocumentUser | null>(null);
  const [docs, setDocs] = useState<AdminDocument[] | null>(null);
  const [docsError, setDocsError] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const [selected, setSelected] = useState<AdminDocument | null>(null);
  const [toast, setToast] = useState('');

  const loadUsers = useCallback(async (p: number) => {
    setError('');
    try {
      const data = await adminApi.getDocumentUsers(p);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(getApiError(err));
    }
  }, []);

  useEffect(() => { void loadUsers(page); }, [loadUsers, page]);

  const openUserDocs = async (user: AdminDocumentUser) => {
    setOpenUser(user);
    setDocs(null);
    setDocsError('');
    setFilter(user.pending > 0 ? 'pending' : 'all');
    try {
      setDocs(await adminApi.getUserDocuments(user.tenantId));
    } catch (err) {
      setDocsError(getApiError(err));
    }
  };

  const backToUsers = () => {
    setOpenUser(null);
    setDocs(null);
    void loadUsers(page); // counts may have changed while reviewing
  };

  const onDecided = (updated: AdminDocument) => {
    setSelected(null);
    setToast(`Document ${updated.verificationStatus === 'verified' ? 'approved' : 'rejected'}.`);
    setTimeout(() => setToast(''), 4000);
    // update the open list in place and keep the header counts honest
    setDocs((list) => (list ?? []).map((d) => (d._id === updated._id ? { ...d, ...updated } : d)));
    setOpenUser((u) => {
      if (!u || !docs) return u;
      const next = docs.map((d) => (d._id === updated._id ? updated : d));
      return {
        ...u,
        pending: next.filter((d) => d.verificationStatus === 'pending').length,
        verified: next.filter((d) => d.verificationStatus === 'verified').length,
        rejected: next.filter((d) => d.verificationStatus === 'rejected').length,
      };
    });
  };

  const visibleDocs = docs?.filter((d) => filter === 'all' || d.verificationStatus === filter);

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-4xl px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">Document verification</h1>
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

        {/* ---------- level 1: users ---------- */}
        {!openUser && (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              Select a user to review all of their documents.
            </p>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            {users === null && !error && <p className="mt-6 text-sm text-ink-faint">Loading…</p>}
            {users?.length === 0 && (
              <p className="mt-6 rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-faint">
                No documents have been uploaded yet.
              </p>
            )}

            <div className="mt-4 space-y-2">
              {users?.map((user) => (
                <button key={user.tenantId} type="button" onClick={() => void openUserDocs(user)}
                  data-testid="admin-user-row"
                  className="flex w-full items-center gap-4 rounded-lg border border-line bg-surface p-3 text-left transition hover:border-primary-300 hover:shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
                    {initialOf(user)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{user.fullName ?? 'Unknown user'}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {user.email ?? '—'} · {user.total} document{user.total !== 1 ? 's' : ''} ·
                      last upload {new Date(user.lastUploadAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {user.flagged > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        ⚠ {user.flagged} flagged
                      </span>
                    )}
                    {user.pending > 0 && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge.pending}`}>
                        {user.pending} pending
                      </span>
                    )}
                    {user.verified > 0 && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge.verified}`}>
                        {user.verified} verified
                      </span>
                    )}
                    {user.rejected > 0 && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge.rejected}`}>
                        {user.rejected} rejected
                      </span>
                    )}
                    <span className="ml-1 text-ink-faint">›</span>
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
                  Page {pagination.page} of {pagination.pages} · {pagination.total} users
                </span>
                <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40">
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {/* ---------- level 2: one user's documents ---------- */}
        {openUser && (
          <>
            <button type="button" onClick={backToUsers} data-testid="back-to-users"
              className="mt-4 text-sm font-medium text-primary-600 hover:underline">
              ← All users
            </button>

            <div className="mt-3 flex items-center gap-4 rounded-lg border border-line bg-surface p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
                {initialOf(openUser)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-ink" data-testid="open-user-name">
                  {openUser.fullName ?? 'Unknown user'}
                </h2>
                <p className="truncate text-sm text-ink-muted">{openUser.email ?? '—'}</p>
              </div>
              <div className="ml-auto flex shrink-0 gap-1.5">
                {openUser.pending > 0 && (
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge.pending}`}>
                    {openUser.pending} pending
                  </span>
                )}
                {openUser.flagged > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    ⚠ {openUser.flagged} flagged
                  </span>
                )}
              </div>
            </div>

            {/* client-side status filter — all docs are already loaded */}
            <div className="mt-4 flex gap-1 rounded-lg bg-line p-1" data-testid="status-tabs">
              {FILTERS.map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} data-testid={`tab-${f}`}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                    filter === f ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                  }`}>
                  {f}
                </button>
              ))}
            </div>

            {docsError && <p className="mt-4 text-sm text-red-600">{docsError}</p>}
            {docs === null && !docsError && <p className="mt-6 text-sm text-ink-faint">Loading…</p>}
            {visibleDocs?.length === 0 && (
              <p className="mt-6 rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-faint">
                No {filter === 'all' ? '' : `${filter} `}documents for this user.
              </p>
            )}

            <div className="mt-4 space-y-2">
              {visibleDocs?.map((doc) => (
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
                    <p className="font-medium capitalize text-ink">{doc.documentType.replace(/_/g, ' ')}</p>
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
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[doc.verificationStatus]}`}>
                      {doc.verificationStatus}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
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
