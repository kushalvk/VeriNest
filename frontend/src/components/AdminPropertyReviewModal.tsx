import { useState } from 'react';
import * as adminPropertyApi from '../api/adminPropertyApi';
import { getApiError } from '../api/client';
import {
    autoCheckChips,
    toneClass,
    verificationBadge,
} from '../utils/propertyVerification';
import type { AdminProperty } from '../api/adminPropertyApi';

interface Props {
    property: AdminProperty;
    onClose: () => void;
    onDecided: (updated: AdminProperty) => void;
}

const Field = ({ label, value }: { label: string; value?: string }) => (
    <div>
        <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
        <dd className="text-sm text-ink">{value || <span className="text-ink-faint">—</span>}</dd>
    </div>
);

export default function AdminPropertyReviewModal({ property, onClose, onDecided }: Props) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showRaw, setShowRaw] = useState(false);

    const v = property.verification;
    const badge = verificationBadge[v.status];
    const landlord =
        property.landlordId && typeof property.landlordId === 'object'
            ? property.landlordId
            : null;
    const billUrl = v.taxBill?.url;
    const billIsPdf = !!billUrl && billUrl.toLowerCase().endsWith('.pdf');
    const extracted = v.ocr?.extracted ?? {};
    const address = [
        property.address?.addressLine,
        property.address?.city,
        property.address?.state,
        property.address?.pincode,
    ]
        .filter(Boolean)
        .join(', ');
    const canDecide = v.status === 'pending';

    const decide = async (status: 'verified' | 'rejected') => {
        if (busy) return;
        if (status === 'rejected' && reason.trim().length < 3) {
            setError('Enter a rejection reason (at least 3 characters) — the landlord will see it.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const updated = await adminPropertyApi.decideProperty(
                property._id,
                status,
                status === 'rejected' ? reason.trim() : undefined
            );
            // The decision response has a bare landlordId — keep the populated one.
            onDecided({ ...property, ...updated, landlordId: property.landlordId });
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
            data-testid="property-review-modal"
        >
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-surface p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-ink">{property.title}</h2>
                        <p className="text-sm text-ink-muted">
                            {landlord?.fullName ?? 'Unknown landlord'}
                            {landlord?.email ? ` · ${landlord.email}` : ''}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
            <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass[badge.tone]}`}
            >
              {badge.label}
            </span>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="text-ink-faint hover:text-ink"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* left: the bill itself */}
                    <div>
                        <h3 className="text-sm font-semibold text-ink">Uploaded tax bill</h3>
                        <div className="mt-2 overflow-hidden rounded-lg border border-line bg-canvas">
                            {billUrl && !billIsPdf ? (
                                <a href={billUrl} target="_blank" rel="noreferrer">
                                    <img
                                        src={billUrl}
                                        alt="House tax bill"
                                        className="max-h-[60vh] w-full object-contain"
                                        data-testid="tax-bill-image"
                                    />
                                </a>
                            ) : billUrl ? (
                                <a
                                    href={billUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block p-6 text-center text-sm font-medium text-primary-600 hover:underline"
                                >
                                    📄 Open bill (PDF)
                                </a>
                            ) : (
                                <p className="p-6 text-center text-sm text-ink-faint">No bill uploaded.</p>
                            )}
                        </div>
                        {billUrl && (
                            <p className="mt-1 text-xs text-ink-faint">
                                Click the image to open it full size.
                                {v.taxBill?.uploadedAt
                                    ? ` Uploaded ${new Date(v.taxBill.uploadedAt).toLocaleString()}.`
                                    : ''}
                                {v.attempts ? ` Submission #${v.attempts}.` : ''}
                            </p>
                        )}
                    </div>

                    {/* right: what the landlord entered vs what OCR read */}
                    <div className="space-y-4">
                        <section className="rounded-lg border border-line p-3">
                            <h3 className="text-sm font-semibold text-ink">Entered by landlord</h3>
                            <dl className="mt-2 grid grid-cols-2 gap-3">
                                <Field label="Landlord name" value={landlord?.fullName} />
                                <Field label="Monthly rent" value={`Rs. ${property.rent.toLocaleString('en-IN')}`} />
                                <div className="col-span-2">
                                    <Field label="Property address" value={address} />
                                </div>
                            </dl>
                        </section>

                        <section className="rounded-lg border border-line p-3">
                            <h3 className="text-sm font-semibold text-ink">
                                Read from the bill (OCR)
                                {v.ocr?.status === 'failed' && (
                                    <span className="ml-2 text-xs font-normal text-red-600">OCR failed</span>
                                )}
                            </h3>
                            <dl className="mt-2 grid grid-cols-2 gap-3">
                                <Field label="Owner name" value={extracted.ownerName} />
                                <Field label="Property tax ID" value={extracted.propertyTaxId} />
                                <Field label="Bill year" value={extracted.billYear} />
                                <Field label="Amount" value={extracted.amount} />
                            </dl>
                            {typeof v.ocr?.confidence === 'number' && (
                                <p className="mt-2 text-xs text-ink-faint">
                                    OCR confidence: {Math.round(v.ocr.confidence)}%
                                </p>
                            )}
                            {v.ocr?.rawText && (
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowRaw((s) => !s)}
                                        className="text-xs font-medium text-primary-600 hover:underline"
                                    >
                                        {showRaw ? 'Hide raw text' : 'Show raw text'}
                                    </button>
                                    {showRaw && (
                                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-canvas p-2 text-xs text-ink-muted">
                      {v.ocr.rawText}
                    </pre>
                                    )}
                                </div>
                            )}
                        </section>

                        <section className="rounded-lg border border-line p-3">
                            <h3 className="text-sm font-semibold text-ink">Automatic checks</h3>
                            <p className="text-xs text-ink-faint">
                                Advisory only — OCR can misread. Always compare against the image.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5" data-testid="auto-check-chips">
                                {autoCheckChips(v).map((c) => (
                                    <span
                                        key={c.label}
                                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass[c.tone]}`}
                                    >
                    {c.label}
                  </span>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                {/* decision */}
                <div className="mt-6 border-t border-line pt-4">
                    {canDecide ? (
                        <>
                            <label htmlFor="reject-reason" className="text-sm font-medium text-ink">
                                Rejection reason{' '}
                                <span className="font-normal text-ink-faint">(required only to reject)</span>
                            </label>
                            <textarea
                                id="reject-reason"
                                rows={2}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g. Owner name on the bill does not match your profile."
                                className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
                            />
                            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                            <div className="mt-3 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => void decide('verified')}
                                    disabled={busy}
                                    data-testid="approve-property"
                                    className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                    {busy ? 'Saving…' : 'Approve'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void decide('rejected')}
                                    disabled={busy}
                                    data-testid="reject-property"
                                    className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                    Reject
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="ml-auto rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
                                >
                                    Close
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-between gap-4">
                            <div className="text-sm text-ink-muted">
                                {v.status === 'verified' ? 'Verified' : 'Rejected'}
                                {v.reviewedAt ? ` on ${new Date(v.reviewedAt).toLocaleString()}` : ''}
                                {v.grandfathered ? ' (existing listing, grandfathered in)' : ''}
                                {v.status === 'rejected' && v.rejectionReason
                                    ? ` — reason: ${v.rejectionReason}`
                                    : ''}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="shrink-0 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}