import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as adminPropertyApi from '../api/adminPropertyApi';
import { getApiError } from '../api/client';
import AdminPropertyReviewModal from '../components/AdminPropertyReviewModal';
import { autoCheckChips, toneClass, verificationBadge } from '../utils/propertyVerification';
import type {
    AdminProperty,
    AdminPropertyCounts,
    AdminPropertyStatus,
} from '../api/adminPropertyApi';
import type { Pagination } from '../api/propertyApi';

const TABS: AdminPropertyStatus[] = ['pending', 'verified', 'rejected'];

export default function AdminPropertiesPage() {
    const [status, setStatus] = useState<AdminPropertyStatus>('pending');
    const [page, setPage] = useState(1);
    const [properties, setProperties] = useState<AdminProperty[] | null>(null);
    const [counts, setCounts] = useState<AdminPropertyCounts | null>(null);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState<AdminProperty | null>(null);
    const [toast, setToast] = useState('');

    const load = useCallback(async (s: AdminPropertyStatus, p: number) => {
        setError('');
        try {
            const data = await adminPropertyApi.listAdminProperties(s, p);
            setProperties(data.properties);
            setCounts(data.counts);
            setPagination(data.pagination);
        } catch (err) {
            setError(getApiError(err));
        }
    }, []);

    useEffect(() => {
        void load(status, page);
    }, [load, status, page]);

    const switchTab = (s: AdminPropertyStatus) => {
        setProperties(null);
        setPage(1);
        setStatus(s);
    };

    const onDecided = (updated: AdminProperty) => {
        setSelected(null);
        setToast(
            `Property ${updated.verification.status === 'verified' ? 'approved' : 'rejected'}.`
        );
        setTimeout(() => setToast(''), 4000);
        void load(status, page); // the row leaves this tab and the counts change
    };

    return (
        <main className="pb-16">
            <div className="mx-auto mt-8 max-w-4xl px-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-ink">Property verification</h1>
                    <Link to="/admin" className="text-sm font-medium text-primary-600 hover:underline">
                        ← Document review
                    </Link>
                </div>
                <p className="mt-2 text-sm text-ink-muted">
                    Landlords upload a house tax bill per property. Approve it and the listing becomes
                    visible to tenants.
                </p>

                {toast && (
                    <p
                        className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
                        data-testid="admin-toast"
                        role="status"
                    >
                        {toast}
                    </p>
                )}

                <div className="mt-4 flex gap-1 rounded-lg bg-line p-1" data-testid="property-status-tabs">
                    {TABS.map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => switchTab(t)}
                            data-testid={`property-tab-${t}`}
                            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                                status === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            {t}
                            {counts ? ` (${counts[t]})` : ''}
                        </button>
                    ))}
                </div>

                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                {properties === null && !error && (
                    <p className="mt-6 text-sm text-ink-faint">Loading…</p>
                )}
                {properties?.length === 0 && (
                    <p className="mt-6 rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-faint">
                        No {status} properties.
                    </p>
                )}

                <div className="mt-4 space-y-2">
                    {properties?.map((p) => {
                        const landlord =
                            p.landlordId && typeof p.landlordId === 'object' ? p.landlordId : null;
                        const badge = verificationBadge[p.verification.status];
                        const flags = autoCheckChips(p.verification).filter(
                            (c) => c.tone === 'bad' || c.tone === 'warn'
                        );
                        const bill = p.verification.taxBill?.url;
                        return (
                            <button
                                key={p._id}
                                type="button"
                                onClick={() => setSelected(p)}
                                data-testid="admin-property-row"
                                className="flex w-full items-center gap-4 rounded-lg border border-line bg-surface p-3 text-left transition hover:border-primary-300 hover:shadow-sm"
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-canvas">
                                    {bill && !bill.toLowerCase().endsWith('.pdf') ? (
                                        <img src={bill} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <span>📄</span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-ink">{p.title}</p>
                                    <p className="truncate text-xs text-ink-faint">
                                        {[p.address?.city, landlord?.fullName].filter(Boolean).join(' · ')}
                                        {p.verification.taxBill?.uploadedAt
                                            ? ` · uploaded ${new Date(p.verification.taxBill.uploadedAt).toLocaleDateString()}`
                                            : ''}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                    {flags.slice(0, 2).map((f) => (
                                        <span
                                            key={f.label}
                                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass[f.tone]}`}
                                        >
                      {f.label}
                    </span>
                                    ))}
                                    <span
                                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass[badge.tone]}`}
                                    >
                    {badge.label}
                  </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {pagination && pagination.pages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-4" data-testid="admin-pagination">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40"
                        >
                            ← Previous
                        </button>
                        <span className="text-sm text-ink-muted">
              Page {pagination.page} of {pagination.pages} · {pagination.total} properties
            </span>
                        <button
                            type="button"
                            disabled={page >= pagination.pages}
                            onClick={() => setPage((p) => p + 1)}
                            className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>

            {selected && (
                <AdminPropertyReviewModal
                    property={selected}
                    onClose={() => setSelected(null)}
                    onDecided={onDecided}
                />
            )}
        </main>
    );
}