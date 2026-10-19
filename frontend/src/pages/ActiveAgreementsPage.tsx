import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar,
    CheckCircle2,
    Clock,
    Home,
    IndianRupee,
    Loader2,
    Shield,
    Star,
    X,
    XCircle,
} from 'lucide-react';
import * as agreementApi from '../api/agreementApi';
import type { LifecycleAgreement } from '../api/agreementApi';
import { getApiError } from '../api/client';

type TabKey = 'active' | 'end_requests' | 'ended';

// ---------- helpers ----------

const fmtDate = (iso?: string) =>
    iso
        ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

const fmtMoney = (n?: number) =>
    typeof n === 'number'
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
        : '—';

const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const END_TYPE_LABEL: Record<string, string> = {
    natural: 'Completed on the end date',
    early_approved: 'Ended early with mutual approval',
};

// ---------- small UI pieces ----------

type BtnVariant = 'primary' | 'danger' | 'success' | 'outline';

function Btn({
                 variant = 'primary',
                 loading,
                 className = '',
                 children,
                 ...props
             }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
    const styles: Record<BtnVariant, string> = {
        primary: 'bg-primary-600 hover:bg-primary-700 text-white',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        success: 'bg-green-600 hover:bg-green-700 text-white',
        outline: 'border border-line text-ink hover:bg-surface',
    };
    return (
        <button
            {...props}
            disabled={props.disabled || loading}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
        >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
}

function StatusBadge({ status }: { status: LifecycleAgreement['status'] }) {
    const map = {
        active: { label: 'Active', icon: CheckCircle2, cls: 'border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300' },
        end_requested: { label: 'End requested', icon: Clock, cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' },
        completed: { label: 'Completed', icon: CheckCircle2, cls: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300' },
        terminated: { label: 'Terminated', icon: XCircle, cls: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300' },
        draft: { label: 'Awaiting signatures', icon: Clock, cls: 'border-line bg-surface text-ink-muted' },
    } as const;
    const { label, icon: Icon, cls } = map[status];
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
            {label}
    </span>
    );
}

function SignChip({ label, signed }: { label: string; signed: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                signed
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'border-line bg-surface text-ink-muted'
            }`}
        >
      {signed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {label}: {signed ? 'Signed' : 'Pending'}
    </span>
    );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-xl dark:bg-slate-950"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="text-lg font-bold text-ink">{title}</h3>
                    <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-muted hover:bg-surface">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    const [hover, setHover] = useState(0);
    return (
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => {
                const active = n <= (hover || value);
                return (
                    <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={value === n}
                        aria-label={`${n} star${n > 1 ? 's' : ''}`}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => onChange(n)}
                        className="rounded p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                        <Star className={`h-8 w-8 transition ${active ? 'fill-amber-400 text-amber-400' : 'text-line-strong'}`} />
                    </button>
                );
            })}
        </div>
    );
}

// ---------- page ----------

export default function ActiveAgreementsPage() {
    const navigate = useNavigate();

    const [items, setItems] = useState<LifecycleAgreement[]>([]);
    const [tab, setTab] = useState<TabKey>('active');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const [endTarget, setEndTarget] = useState<LifecycleAgreement | null>(null);
    const [endReason, setEndReason] = useState('');
    const [modalError, setModalError] = useState('');

    const [rateTarget, setRateTarget] = useState<LifecycleAgreement | null>(null);
    const [ratingValue, setRatingValue] = useState(0);
    const [ratingReview, setRatingReview] = useState('');
    const [rateBusy, setRateBusy] = useState(false);
    const [rateError, setRateError] = useState('');

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError('');
        try {
            const data = await agreementApi.listMyAgreementsLifecycle();
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 5000);
        return () => clearTimeout(t);
    }, [notice]);

    const groups = useMemo(
        () => ({
            active: items.filter((a) => a.status === 'active'),
            end_requests: items.filter((a) => a.status === 'end_requested'),
            ended: items.filter((a) => a.status === 'completed' || a.status === 'terminated'),
        }),
        [items],
    );

    const tabs: { key: TabKey; label: string }[] = [
        { key: 'active', label: 'Active' },
        { key: 'end_requests', label: 'End requests' },
        { key: 'ended', label: 'Ended' },
    ];

    // ---------- actions ----------

    const runAction = async (
        id: string,
        fn: () => Promise<{ message?: string }>,
        fallbackMsg: string,
    ) => {
        setBusyId(id);
        setNotice(null);
        try {
            const res = await fn();
            setNotice({ type: 'success', text: res?.message || fallbackMsg });
            await load(true);
            return true;
        } catch (err) {
            setNotice({ type: 'error', text: getApiError(err) });
            return false;
        } finally {
            setBusyId(null);
        }
    };

    const openEndModal = (a: LifecycleAgreement) => {
        setEndTarget(a);
        setEndReason('');
        setModalError('');
    };

    const submitEnd = async () => {
        if (!endTarget) return;
        const reason = endReason.trim();
        if (endTarget.isEarlyEnd && reason.length < 5) {
            setModalError('Please enter a reason (at least 5 characters).');
            return;
        }
        const target = endTarget;
        const ok = await runAction(
            target._id,
            () => agreementApi.initiateEndRequest(target._id, reason),
            'Request submitted.',
        );
        if (ok) {
            setEndTarget(null);
            setTab(target.isEarlyEnd ? 'end_requests' : 'ended');
        }
    };

    const respond = async (a: LifecycleAgreement, action: 'approve' | 'reject') => {
        const ok = await runAction(
            a._id,
            () => agreementApi.respondToEndRequest(a._id, action),
            action === 'approve' ? 'Request approved. Agreement ended.' : 'Request rejected.',
        );
        if (ok) setTab(action === 'approve' ? 'ended' : 'active');
    };

    const cancel = async (a: LifecycleAgreement) => {
        const ok = await runAction(a._id, () => agreementApi.cancelEndRequest(a._id), 'End request cancelled.');
        if (ok) setTab('active');
    };

    // ---------- rating (popup on this page) ----------

    const openRate = (a: LifecycleAgreement) => {
        setRateTarget(a);
        setRatingValue(0);
        setRatingReview('');
        setRateError('');
    };

    const submitRating = async () => {
        if (!rateTarget) return;
        if (ratingValue < 1) {
            setRateError('Please select a star rating.');
            return;
        }
        setRateBusy(true);
        setRateError('');
        try {
            await agreementApi.submitRating(rateTarget._id, ratingValue, ratingReview.trim());
            setRateTarget(null);
            setNotice({ type: 'success', text: 'Thanks! Your rating has been submitted.' });
            await load(true);
        } catch (err) {
            setRateError(getApiError(err));
        } finally {
            setRateBusy(false);
        }
    };

    // ---------- render ----------

    if (loading) {
        return (
            <main className="flex items-center justify-center gap-2 p-10 text-ink-muted">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading agreements…
            </main>
        );
    }

    const list = groups[tab];

    return (
        <main className="pb-16">
            <div className="mx-auto max-w-3xl px-4 py-8">
                <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600/10 text-primary-600">
            <Shield className="h-6 w-6" />
          </span>
                    <div>
                        <h1 className="text-2xl font-bold text-ink">My Agreements</h1>
                        <p className="text-sm text-ink-muted">Active rentals, end requests and ratings</p>
                    </div>
                </header>

                {error && (
                    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                        <span>{error}</span>
                        <Btn variant="outline" onClick={() => void load()} className="!px-3 !py-1">
                            Retry
                        </Btn>
                    </div>
                )}

                {notice && (
                    <div
                        role="status"
                        className={`mb-4 rounded-lg border p-3 text-sm ${
                            notice.type === 'success'
                                ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                                : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}
                    >
                        {notice.text}
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-5 flex gap-1 border-b border-line" role="tablist">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            role="tab"
                            aria-selected={tab === t.key}
                            onClick={() => setTab(t.key)}
                            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
                                tab === t.key
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-ink-muted hover:text-ink'
                            }`}
                        >
                            {t.label}
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs ${
                                    tab === t.key ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted'
                                }`}
                            >
                {groups[t.key].length}
              </span>
                        </button>
                    ))}
                </div>

                {/* List */}
                {list.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line p-10 text-center text-ink-faint">
                        {tab === 'active' && 'No active agreements yet. An agreement becomes active once both parties sign.'}
                        {tab === 'end_requests' && 'No pending end requests.'}
                        {tab === 'ended' && 'No ended agreements yet.'}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {list.map((a) => {
                            const busy = busyId === a._id;
                            const other = a.counterparty;
                            const otherLabel = a.myRole === 'tenant' ? 'Landlord' : 'Tenant';
                            const remaining = daysLeft(a.endDate);

                            return (
                                <article key={a._id} className="rounded-xl border border-line bg-white p-5 shadow-sm dark:bg-slate-950">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                                                {a.agreementNumber}
                                            </p>
                                            <h2 className="mt-0.5 flex items-center gap-2 text-lg font-bold text-ink">
                                                <Home className="h-5 w-5 text-ink-muted" />
                                                {a.property?.title || 'Rental property'}
                                            </h2>
                                            {a.property?.address?.city && (
                                                <p className="text-sm text-ink-muted">{a.property.address.city}</p>
                                            )}
                                        </div>
                                        <StatusBadge status={a.status} />
                                    </div>

                                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                                        <div>
                                            <dt className="text-xs uppercase tracking-wide text-ink-faint">{otherLabel}</dt>
                                            <dd className="font-medium text-ink">
                                                {other?.fullName || '—'}
                                                {typeof other?.ratingAvg === 'number' && other.ratingAvg > 0 && (
                                                    <span className="ml-2 inline-flex items-center gap-0.5 text-amber-500">
                            <Star className="h-3.5 w-3.5 fill-amber-400" />
                                                        {other.ratingAvg.toFixed(1)}
                          </span>
                                                )}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase tracking-wide text-ink-faint">Term</dt>
                                            <dd className="flex items-center gap-1 font-medium text-ink">
                                                <Calendar className="h-4 w-4 text-ink-muted" />
                                                {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase tracking-wide text-ink-faint">Monthly rent</dt>
                                            <dd className="flex items-center gap-1 font-medium text-ink">
                                                <IndianRupee className="h-4 w-4 text-ink-muted" />
                                                {fmtMoney(a.monthlyRent)}
                                                {typeof a.deposit === 'number' && (
                                                    <span className="ml-2 text-xs text-ink-muted">Deposit {fmtMoney(a.deposit)}</span>
                                                )}
                                            </dd>
                                        </div>
                                        {a.status === 'active' && (
                                            <div>
                                                <dt className="text-xs uppercase tracking-wide text-ink-faint">Time left</dt>
                                                <dd className="font-medium text-ink">
                                                    {remaining > 0 ? `${remaining} day${remaining === 1 ? '' : 's'}` : 'Term completed'}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <SignChip label="Tenant" signed={a.tenantSigned} />
                                        <SignChip label="Landlord" signed={a.landlordSigned} />
                                        {a.signedAt && (
                                            <span className="self-center text-xs text-ink-muted">Activated {fmtDate(a.signedAt)}</span>
                                        )}
                                    </div>

                                    {/* ACTIVE actions */}
                                    {a.status === 'active' && a.canInitiateEnd && (
                                        <div className="mt-5 border-t border-line pt-4">
                                            <Btn variant="danger" onClick={() => openEndModal(a)} loading={busy}>
                                                {a.isEarlyEnd ? 'Request early end' : 'End agreement'}
                                            </Btn>
                                            {a.isEarlyEnd && (
                                                <p className="mt-2 text-xs text-ink-muted">
                                                    Ending before {fmtDate(a.endDate)} needs the other party&apos;s approval.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* END REQUEST block */}
                                    {a.status === 'end_requested' && a.endRequests.hasPending && (
                                        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
                                            <p className="font-semibold text-amber-800 dark:text-amber-300">
                                                {a.canCancelEndRequest
                                                    ? 'You requested to end this agreement early.'
                                                    : `${cap(a.endRequests.requestedByRole || 'The other party')} requested to end this agreement early.`}
                                            </p>
                                            {a.endRequests.reason && (
                                                <p className="mt-1 text-ink-muted">Reason: {a.endRequests.reason}</p>
                                            )}
                                            {a.endRequests.requestedAt && (
                                                <p className="mt-1 text-xs text-ink-muted">Requested on {fmtDate(a.endRequests.requestedAt)}</p>
                                            )}

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {a.canRespondEndRequest && (
                                                    <>
                                                        <Btn variant="success" loading={busy} onClick={() => respond(a, 'approve')}>
                                                            Approve &amp; end
                                                        </Btn>
                                                        <Btn variant="outline" disabled={busy} onClick={() => respond(a, 'reject')}>
                                                            Reject
                                                        </Btn>
                                                    </>
                                                )}
                                                {a.canCancelEndRequest && (
                                                    <>
                                                        <Btn variant="outline" loading={busy} onClick={() => cancel(a)}>
                                                            Cancel request
                                                        </Btn>
                                                        <span className="self-center text-xs text-ink-muted">
                              Waiting for the other party to respond.
                            </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ENDED block */}
                                    {(a.status === 'completed' || a.status === 'terminated') && (
                                        <div className="mt-5 rounded-lg bg-surface p-4 text-sm">
                                            <p className="text-ink">
                        <span className="font-semibold">
                          {a.endType ? END_TYPE_LABEL[a.endType] : 'Agreement ended'}
                        </span>
                                                {a.endedAt && <span className="text-ink-muted"> · {fmtDate(a.endedAt)}</span>}
                                            </p>

                                            <div className="mt-3">
                                                {a.canRate ? (
                                                    <Btn onClick={() => openRate(a)}>
                                                        <Star className="h-4 w-4" /> Rate {otherLabel.toLowerCase()}
                                                    </Btn>
                                                ) : a.iRated ? (
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <p className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            Already rated — you rated this {otherLabel.toLowerCase()}
                                                            {a.myRating != null && (
                                                                <span className="ml-1 text-amber-500">
                                  {'★'.repeat(a.myRating)}{'☆'.repeat(5 - a.myRating)}
                                </span>
                                                            )}
                                                        </p>
                                                        <Btn variant="outline" onClick={() => navigate('/rental-history')}>
                                                            View rental history
                                                        </Btn>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* End / early-end modal */}
            {endTarget && (
                <Modal
                    title={endTarget.isEarlyEnd ? 'Request early termination' : 'End agreement'}
                    onClose={() => setEndTarget(null)}
                >
                    {endTarget.isEarlyEnd ? (
                        <>
                            <p className="mb-3 text-sm text-ink-muted">
                                The agreement ends only after the other party approves. They will be notified by email.
                            </p>
                            <label htmlFor="end-reason" className="mb-1 block text-sm font-medium text-ink">
                                Reason
                            </label>
                            <textarea
                                id="end-reason"
                                rows={3}
                                maxLength={500}
                                value={endReason}
                                onChange={(e) => setEndReason(e.target.value)}
                                placeholder="Why do you want to end this agreement early?"
                                className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-ink"
                            />
                        </>
                    ) : (
                        <p className="mb-3 text-sm text-ink-muted">
                            The end date has passed, so the agreement will be completed immediately. Both parties can then rate each
                            other.
                        </p>
                    )}
                    {modalError && <p className="mt-2 text-sm text-red-600">{modalError}</p>}
                    <div className="mt-5 flex gap-3">
                        <Btn variant="outline" className="flex-1" onClick={() => setEndTarget(null)}>
                            Cancel
                        </Btn>
                        <Btn variant="danger" className="flex-1" loading={busyId === endTarget._id} onClick={submitEnd}>
                            {endTarget.isEarlyEnd ? 'Send request' : 'Confirm'}
                        </Btn>
                    </div>
                </Modal>
            )}

            {/* Rating modal */}
            {rateTarget && (
                <Modal
                    title={`Rate ${rateTarget.counterparty?.fullName || (rateTarget.myRole === 'tenant' ? 'your landlord' : 'your tenant')}`}
                    onClose={() => !rateBusy && setRateTarget(null)}
                >
                    <p className="mb-3 text-sm text-ink-muted">
                        {rateTarget.myRole === 'landlord'
                            ? "Your honest rating is included in the tenant's trust score."
                            : 'Your honest rating helps other tenants choose their landlord.'}
                    </p>
                    <StarPicker value={ratingValue} onChange={setRatingValue} />
                    <label htmlFor="rating-review" className="mb-1 mt-4 block text-sm font-medium text-ink">
                        Review <span className="font-normal text-ink-faint">(optional)</span>
                    </label>
                    <textarea
                        id="rating-review"
                        rows={3}
                        maxLength={500}
                        value={ratingReview}
                        onChange={(e) => setRatingReview(e.target.value)}
                        placeholder="Share your experience…"
                        className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-ink"
                    />
                    {rateError && <p className="mt-2 text-sm text-red-600">{rateError}</p>}
                    <div className="mt-5 flex gap-3">
                        <Btn variant="outline" className="flex-1" disabled={rateBusy} onClick={() => setRateTarget(null)}>
                            Cancel
                        </Btn>
                        <Btn className="flex-1" loading={rateBusy} onClick={submitRating}>
                            Submit rating
                        </Btn>
                    </div>
                </Modal>
            )}
        </main>
    );
}