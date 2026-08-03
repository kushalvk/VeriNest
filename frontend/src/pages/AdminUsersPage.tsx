import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import * as adminApi from '../api/adminApi';
import { getApiError } from '../api/client';
import { inputClass } from '../components/AuthCard';
import AdminUserDetailModal from '../components/AdminUserDetailModal';
import { useAuthStore } from '../store/authStore';
import type { AccountStatus, AdminUser, UserRole } from '../api/adminApi';
import type { Pagination } from '../api/propertyApi';

type RoleFilter = UserRole | 'all';
type StatusFilter = AccountStatus | 'all';

const ROLE_TABS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'tenant', label: 'Tenants' },
  { value: 'landlord', label: 'Landlords' },
  { value: 'admin', label: 'Admins' },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending verification' },
  { value: 'blocked', label: 'Blocked' },
];

const statusBadge: Record<AccountStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  blocked: 'bg-red-100 text-red-700 border-red-200',
};

const roleBadge: Record<UserRole, string> = {
  tenant: 'bg-primary-50 text-primary-700 border-primary-200',
  landlord: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  admin: 'bg-slate-100 text-slate-700 border-slate-200',
};

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Role-specific one-liner under the name: score for tenants, listings for landlords. */
const summaryOf = (user: AdminUser) => {
  if (user.role === 'tenant') {
    return user.trustScore === null ? 'No trust score yet' : `Trust score ${user.trustScore}`;
  }
  if (user.role === 'landlord') {
    return `${user.propertyCount ?? 0} propert${user.propertyCount === 1 ? 'y' : 'ies'}`;
  }
  return null;
};

/**
 * Admin user directory: every tenant, landlord and admin account, with
 * search, role/status filters and drill-in for management actions.
 */
export default function AdminUsersPage() {
  const currentUserId = useAuthStore((s) => s.user?._id);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState('');

  // Debounce typing → one request per pause, and jump back to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Changing a filter re-anchors to the first page.
  useEffect(() => { setPage(1); }, [role, status]);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await adminApi.listUsers({ search: debounced, role, status }, page);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(getApiError(err));
    }
  }, [debounced, role, status, page]);

  useEffect(() => { void load(); }, [load]);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 4000);
  };

  const onUpdated = (updated: AdminUser) => {
    setUsers((list) =>
      (list ?? []).map((u) => (u._id === updated._id ? { ...u, ...updated } : u))
    );
    setSelected((u) => (u && u._id === updated._id ? { ...u, ...updated } : u));
    flash(
      updated.accountStatus === 'blocked'
        ? `${updated.fullName} has been blocked and signed out.`
        : `${updated.fullName} has been reactivated.`
    );
  };

  const onDeleted = (userId: string) => {
    const name = users?.find((u) => u._id === userId)?.fullName ?? 'User';
    setSelected(null);
    flash(`${name} and their records have been deleted.`);
    void load(); // refill the page from the server so counts stay correct
  };

  const pages = pagination?.pages ?? 1;

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-4xl px-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-ink">Users</h1>
          <Link to="/admin" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
            ← Document review
          </Link>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Every account on the platform. Open a user to see their activity, block or
          reactivate them, or remove the account entirely.
        </p>

        {toast && (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
            data-testid="admin-users-toast" role="status">
            {toast}
          </p>
        )}

        {/* filters */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or phone…"
              aria-label="Search users by name, email or phone"
              data-testid="user-search"
              className={`${inputClass} pl-9`} />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}
            aria-label="Filter by account status" data-testid="status-filter"
            className={`${inputClass} sm:w-52`}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex gap-1 rounded-lg bg-line p-1" data-testid="role-tabs">
          {ROLE_TABS.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setRole(tab.value)}
              data-testid={`role-tab-${tab.value}`}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                role === tab.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {users === null && !error && <p className="mt-6 text-sm text-ink-faint">Loading users…</p>}
        {users?.length === 0 && (
          <p className="mt-6 rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-faint">
            {debounced ? <>No users match “{debounced}”.</> : 'No users match these filters.'}
          </p>
        )}

        {/* user list */}
        <div className="mt-4 space-y-2">
          {users?.map((user) => {
            const summary = summaryOf(user);
            return (
              <button key={user._id} type="button" onClick={() => setSelected(user)}
                data-testid="admin-user-row"
                className="flex w-full items-center gap-4 rounded-lg border border-line bg-surface p-3 text-left transition hover:border-primary-300 hover:shadow-sm">
                {user.profileImage?.url ? (
                  <img src={user.profileImage.url} alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                    {initialsOf(user.fullName)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {user.fullName}
                    {user._id === currentUserId && (
                      <span className="ml-2 text-xs font-normal text-ink-faint">(you)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    {user.email}
                    {summary ? ` · ${summary}` : ''}
                    {' · joined '}
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                    user.role ? roleBadge[user.role] : 'border-line bg-canvas text-ink-faint'
                  }`}>
                    {user.role ?? 'no role'}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[user.accountStatus]}`}
                    data-testid="user-status-badge">
                    {user.accountStatus}
                  </span>
                  <span className="ml-1 text-ink-faint">›</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* pagination */}
        {pagination && pagination.total > 0 && (
          <div className="mt-6 flex items-center justify-between" data-testid="user-pagination">
            <p className="text-sm text-ink-faint">
              Page {pagination.page} of {pages} · {pagination.total} user{pagination.total === 1 ? '' : 's'}
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

      {selected && (
        <AdminUserDetailModal
          user={selected}
          currentUserId={currentUserId}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
        />
      )}
    </main>
  );
}
