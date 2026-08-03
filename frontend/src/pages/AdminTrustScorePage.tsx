import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import * as adminApi from '../api/adminApi';
import { getApiError } from '../api/client';
import { inputClass } from '../components/AuthCard';
import type { AdminTenant } from '../api/adminApi';
import type { Pagination } from '../api/propertyApi';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Score badge with a quick visual read: strong / building / low. */
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink-faint">
        no profile yet
      </span>
    );
  }
  const tone =
    score >= 60
      ? 'bg-green-100 text-green-800'
      : score >= 30
        ? 'bg-amber-100 text-amber-800'
        : 'bg-canvas text-ink-muted';
  return (
    <span data-testid="row-score" className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {score} pts
    </span>
  );
}

export default function AdminTrustScorePage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [tenants, setTenants] = useState<AdminTenant[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Last recalculation result, shown expanded under its tenant's row.
  const [result, setResult] = useState<{ tenantId: string; score: number; reasons: string[] } | null>(null);

  // Debounce typing → one request per pause, and jump back to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    adminApi
      .listTenants(debounced, page)
      .then((data) => {
        if (cancelled) return;
        setTenants(data.tenants);
        setPagination(data.pagination);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiError(err));
      });
    return () => { cancelled = true; };
  }, [debounced, page]);

  const recalculate = async (tenant: AdminTenant) => {
    if (busyId) return;
    setBusyId(tenant._id);
    setError('');
    try {
      const r = await adminApi.recalculateTrustScore(tenant._id);
      setResult(r);
      // reflect the fresh score in the row immediately
      setTenants((list) =>
        (list ?? []).map((t) => (t._id === tenant._id ? { ...t, trustScore: r.score } : t))
      );
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const pages = pagination?.pages ?? 1;

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-3xl px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">Trust scores</h1>
          <div className="flex gap-4">
            <Link to="/admin" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
              ← Document review
            </Link>
            <Link to="/admin/users" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
              Users →
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Every tenant on the platform, with their current stored score. Recalculating
          recomputes the rule-based score from verified documents, profile, and rental
          history, and records the reasons.
        </p>

        {/* search */}
        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenants by name or email…"
            aria-label="Search tenants by name or email"
            data-testid="tenant-search"
            className={`${inputClass} pl-9`}
          />
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {tenants === null && !error && <p className="mt-6 text-sm text-ink-faint">Loading tenants…</p>}
        {tenants?.length === 0 && (
          <p className="mt-6 rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-faint">
            {debounced ? <>No tenants match “{debounced}”.</> : 'No tenant accounts yet.'}
          </p>
        )}

        {/* tenant list */}
        <div className="mt-4 space-y-3">
          {tenants?.map((tenant) => (
            <div key={tenant._id} data-testid="tenant-row"
              className="rounded-lg border border-line bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                  {initialsOf(tenant.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink" data-testid="tenant-name">
                    {tenant.fullName}
                  </p>
                  <p className="truncate text-sm text-ink-faint">{tenant.email}</p>
                </div>
                <ScoreBadge score={tenant.trustScore} />
                <button
                  type="button"
                  data-testid="recalculate"
                  onClick={() => void recalculate(tenant)}
                  disabled={busyId !== null || !tenant.hasProfile}
                  title={tenant.hasProfile ? undefined : 'This tenant has not created a profile yet'}
                  className="flex items-center gap-1.5 rounded-md border border-primary-300 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-300 dark:hover:bg-primary-500/10">
                  <RefreshCw className={`h-3.5 w-3.5 ${busyId === tenant._id ? 'animate-spin' : ''}`} aria-hidden="true" />
                  {busyId === tenant._id ? 'Recalculating…' : 'Recalculate'}
                </button>
              </div>

              {/* freshly recalculated breakdown, inline under the row */}
              {result?.tenantId === tenant._id && (
                <div className="mt-3 rounded-md border border-line bg-surface-muted p-4" data-testid="score-result">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary-700 dark:text-primary-300" data-testid="score-value">
                      {result.score}
                    </span>
                    <span className="text-sm text-ink-faint">/ 100</span>
                  </div>
                  <h2 className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Contributing factors
                  </h2>
                  {result.reasons.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-faint">
                      No contributing factors yet — no verified documents or qualifying profile data.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1" data-testid="score-reasons">
                      {result.reasons.map((r) => (
                        <li key={r} className="flex items-start gap-2 text-sm text-ink-muted">
                          <span className="mt-0.5 text-green-600">✓</span> {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* pagination */}
        {pagination && pagination.total > 0 && (
          <div className="mt-6 flex items-center justify-between" data-testid="tenant-pagination">
            <p className="text-sm text-ink-faint">
              Page {pagination.page} of {pages} · {pagination.total} tenant{pagination.total === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <button type="button" data-testid="prev-page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="flex items-center gap-1 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
              </button>
              <button type="button" data-testid="next-page"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={pagination.page >= pages}
                className="flex items-center gap-1 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">
                Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
