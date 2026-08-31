import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import * as adminApi from '../api/adminApi';
import { getApiError } from '../api/client';
import { inputClass, labelClass } from './AuthCard';
import type { AdminUser, AdminUserStats } from '../api/adminApi';

const DELETE_PHRASE = 'DELETE';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

const fmtDate = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

/** A labelled number in the activity grid. */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-surface-muted px-3 py-2">
      <p className="text-lg font-semibold text-ink">{value}</p>
      <p className="text-xs text-ink-faint">{label}</p>
    </div>
  );
}

interface Props {
  user: AdminUser;
  /** the signed-in admin — self-actions are disabled */
  currentUserId?: string;
  onClose: () => void;
  /** called with the updated user after a block/unblock */
  onUpdated: (updated: AdminUser) => void;
  /** called after the account has been deleted */
  onDeleted: (userId: string) => void;
}

/**
 * Full account view for one user, with the two management actions:
 * block/unblock (reversible) and delete (type-to-confirm, permanent).
 * The activity counts are loaded here rather than in the list so the row
 * query stays cheap.
 */
export default function AdminUserDetailModal({
  user,
  currentUserId,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'status' | 'delete' | null>(null);
  const [reason, setReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [status, setStatus] = useState(user.accountStatus);

  const isSelf = currentUserId === user._id;
  const isAdmin = user.role === 'admin';
  const locked = isSelf || isAdmin;

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getUser(user._id)
      .then((data) => { if (!cancelled) setStats(data.stats); })
      .catch((err) => { if (!cancelled) setLoadError(getApiError(err)); });
    return () => { cancelled = true; };
  }, [user._id]);

  const toggleStatus = async () => {
    if (busy) return;
    const next = status === 'blocked' ? 'active' : 'blocked';
    setBusy('status');
    setError('');
    try {
      const updated = await adminApi.setUserStatus(user._id, next, reason);
      setStatus(updated.accountStatus);
      setReason('');
      onUpdated(updated);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy || confirmText !== DELETE_PHRASE) return;

    setBusy('delete');
    setError('');

    try {
      await adminApi.deleteUser(user._id, reason.trim());
      onDeleted(user._id);
    } catch (err) {
      setError(getApiError(err));
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8"
      data-testid="admin-user-modal">
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface shadow-xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          {user.profileImage?.url ? (
            <img src={user.profileImage.url} alt=""
              className="h-11 w-11 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {initialsOf(user.fullName)}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-ink" data-testid="modal-user-name">
              {user.fullName}
            </h3>
            <p className="truncate text-sm text-ink-muted">{user.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="ml-auto rounded-md p-1 text-ink-faint hover:bg-surface-muted hover:text-ink">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Role</dt>
              <dd className="mt-0.5 text-sm capitalize text-ink">{user.role ?? 'not chosen yet'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Status</dt>
              <dd className="mt-0.5 text-sm capitalize text-ink" data-testid="modal-user-status">{status}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Sign-in</dt>
              <dd className="mt-0.5 text-sm capitalize text-ink">
                {user.authProvider === 'google' ? 'Google' : 'Email & password'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Phone</dt>
              <dd className="mt-0.5 text-sm text-ink">{user.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Email verified</dt>
              <dd className="mt-0.5 text-sm text-ink">{user.isEmailVerified ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Joined</dt>
              <dd className="mt-0.5 text-sm text-ink">{fmtDate(user.createdAt)}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Last login</dt>
              <dd className="mt-0.5 text-sm text-ink">{fmtDate(user.lastLogin)}</dd>
            </div>
          </dl>

          {/* activity */}
          <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">Activity</h4>
          {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}
          {!stats && !loadError && <p className="mt-2 text-sm text-ink-faint">Loading activity…</p>}
          {stats && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="modal-user-stats">
              {user.role === 'tenant' && (
                <>
                  <Stat label="Trust score" value={stats.trustScore ?? '—'} />
                  <Stat label="Documents" value={stats.documents} />
                  <Stat label="Verified docs" value={stats.verifiedDocuments} />
                </>
              )}
              {user.role === 'landlord' && <Stat label="Properties" value={stats.properties} />}
              <Stat label="Applications" value={stats.applications} />
              <Stat label="Active agreements" value={stats.activeAgreements} />
              <Stat label="Rental records" value={stats.rentals} />
            </div>
          )}

          {/* actions */}
          <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">Manage</h4>
          {locked ? (
            <p className="mt-2 rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink-muted">
              {isSelf
                ? 'This is your own account — block and delete are disabled.'
                : 'Admin accounts cannot be blocked or deleted from this panel.'}
            </p>
          ) : (
            <>
              <div className="mt-2">
                <label htmlFor="admin-message" className={labelClass}>
                  Message to user
                  <span className="ml-1 font-normal text-ink-faint">
      (optional)
    </span>
                </label>

                <textarea
                    id="admin-message"
                    rows={3}
                    maxLength={500}
                    className={`${inputClass} resize-none`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      status === 'blocked'
                          ? 'e.g. Your account has been reviewed and restored.'
                          : 'e.g. Repeated fraudulent document uploads.'
                    }
                />

                <p className="mt-1 text-xs text-ink-faint">
                  This message will be included in the email sent to the user.
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" onClick={() => void toggleStatus()} disabled={busy !== null}
                  data-testid="toggle-user-status"
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                    status === 'blocked'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}>
                  {busy === 'status' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : status === 'blocked' ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Ban className="h-4 w-4" aria-hidden="true" />
                  )}
                  {status === 'blocked' ? 'Unblock account' : 'Block account'}
                </button>

                {!confirmDelete && (
                  <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy !== null}
                    data-testid="delete-user"
                    className="flex items-center gap-2 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete account
                  </button>
                )}
              </div>

              <p className="mt-2 text-xs text-ink-faint">
                Blocking signs the user out everywhere and stops them signing in again;
                it is fully reversible.
              </p>

              {confirmDelete && (
                  <div
                      className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10"
                      data-testid="delete-confirm">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                      Permanently delete {user.fullName}?
                    </p>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                      This also removes their profile, documents, applications, verification
                      requests{user.role === 'landlord' ? ', properties' : ''} and rental
                      records. It cannot be undone.
                    </p>
                    <div className="mt-4">
                      <label htmlFor="delete-message" className={labelClass}>
                        Message to user
                        <span className="ml-1 font-normal text-ink-faint">
      (optional)
    </span>
                      </label>

                      <textarea
                          id="delete-message"
                          rows={3}
                          maxLength={500}
                          className={`${inputClass} mt-1 resize-none`}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Account removed because it was created for testing."
                      />

                      <p className="mt-1 text-xs text-ink-faint">
                        The user will receive this message in their account deletion email.
                      </p>
                    </div>
                    <label htmlFor="delete-confirm-input"
                           className="mt-3 block text-xs font-medium text-red-800 dark:text-red-300">
                      Type {DELETE_PHRASE} to confirm
                    </label>
                    <input id="delete-confirm-input" type="text" value={confirmText}
                           onChange={(e) => setConfirmText(e.target.value)}
                           data-testid="delete-confirm-input"
                           className={`${inputClass} mt-1`}/>
                    <div className="mt-3 flex gap-3">
                      <button type="button" onClick={() => void remove()}
                              disabled={busy !== null || confirmText !== DELETE_PHRASE}
                              data-testid="confirm-delete-user"
                              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {busy === 'delete' ? 'Deleting…' : 'Delete permanently'}
                      </button>
                      <button type="button" disabled={busy !== null}
                              onClick={() => {
                                setConfirmDelete(false);
                                setConfirmText('');
                              }}
                              className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-50">
                        Cancel
                      </button>
                    </div>
                  </div>
              )}
            </>
          )}

          {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
        </div>

        <div className="border-t border-line bg-surface-muted px-5 py-3 text-right">
          <button type="button" onClick={onClose} disabled={busy !== null}
                  className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface disabled:opacity-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
