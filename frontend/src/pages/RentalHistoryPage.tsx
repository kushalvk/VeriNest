import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as rentalHistoryApi from '../api/rentalHistoryApi';
import { getApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { inputClass, labelClass } from '../components/AuthCard';
import type { RentalRecord } from '../api/rentalHistoryApi';

type Side = 'tenant' | 'landlord';
type Notice = { type: 'success' | 'info' | 'error'; text: string };

const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

const paymentStyles: Record<string, string> = {
  clear: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  default: 'bg-red-100 text-red-700',
};

const noticeStyles: Record<Notice['type'], string> = {
  success: 'border-green-300 bg-green-50 text-green-800',
  info: 'border-amber-300 bg-amber-50 text-amber-800',
  error: 'border-red-300 bg-red-50 text-red-700',
};

/** The agreement a rental record belongs to (string id, or populated object). */
const getAgreementId = (record: RentalRecord): string | null => {
  const raw = (record as unknown as { agreementId?: string | { _id: string } | null }).agreementId;
  if (!raw) return null;
  return typeof raw === 'object' ? raw._id : raw;
};

/** Single place that decides whether a record can be rated or is already rated. */
function getRateInfo(record: RentalRecord, side: Side) {
  // tenant rates the landlord (stored in landlordRating) and vice versa
  const myRating = side === 'tenant' ? record.landlordRating : record.tenantRating;
  const completed = Boolean(record.moveOutDate); // set when the agreement ends
  const iRated = myRating != null;
  return { myRating, completed, iRated, canRate: completed && !iRated };
}

const Stars = ({ value }: { value: number }) => (
    <span className="text-amber-500">{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>
);

function RatingForm({ side, onSubmit, onCancel }: {
  side: Side;
  onSubmit: (rating: number, review: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!rating || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(rating, review.trim());
    } catch (err) {
      setError(getApiError(err));
      setBusy(false);
    }
  };

  return (
      <div className="mt-3 rounded-md border border-line bg-surface-muted p-3" data-testid="rating-form">
        {/* direction is implicit from the viewer's side — never selectable */}
        <p className="text-sm font-semibold text-ink" data-testid="rating-label">
          {side === 'tenant' ? 'Rate your landlord' : 'Rate your tenant'}
        </p>
        {side === 'landlord' && (
            <p className="mt-0.5 text-xs text-ink-muted">This rating is included in the tenant&apos;s trust score.</p>
        )}
        <div className="mt-2 flex gap-1" data-testid="star-picker">
          {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} data-testid={`star-${n}`}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      className={`text-2xl transition ${n <= rating ? 'text-amber-500' : 'text-line-strong hover:text-amber-300'}`}>
                ★
              </button>
          ))}
        </div>
        <textarea rows={2} maxLength={500} className={`${inputClass} mt-2`} placeholder="Optional review…"
                  value={review} onChange={(e) => setReview(e.target.value)} data-testid="review-input" />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={!rating || busy}
                  data-testid="submit-rating"
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {busy ? 'Submitting…' : 'Submit rating'}
          </button>
          <button type="button" onClick={onCancel} disabled={busy}
                  className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
  );
}

export default function RentalHistoryPage() {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const rateParam = searchParams.get('rate'); // agreement id sent from the Agreements page

  const [records, setRecords] = useState<RentalRecord[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [moveOutDate, setMoveOutDate] = useState('');
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rentalHistoryApi
        .getMyRentalHistory()
        .then(setRecords)
        .catch((err) => setError(getApiError(err)));
  }, []);

  // Arriving from the Agreements page via /rental-history?rate=<agreementId>
  useEffect(() => {
    if (!rateParam || records === null || !user) return;

    const target = records.find((r) => getAgreementId(r) === rateParam);
    if (!target) {
      setNotice({ type: 'error', text: 'We could not find that rental in your history.' });
    } else {
      const side: Side = target.tenantId === user._id ? 'tenant' : 'landlord';
      const info = getRateInfo(target, side);
      const other = side === 'tenant' ? 'landlord' : 'tenant';

      setHighlightId(target._id);
      if (info.iRated) {
        setNotice({ type: 'info', text: `You have already rated your ${other} for this rental.` });
      } else if (info.canRate) {
        setRatingId(target._id);
        setCompletingId(null);
      } else {
        setNotice({ type: 'info', text: 'You can rate once the rental has ended.' });
      }
    }
    setSearchParams({}, { replace: true });
  }, [rateParam, records, user, setSearchParams]);

  // Scroll the highlighted card into view
  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`rental-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, records]);

  // Auto-dismiss notices
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  const replace = (updated: RentalRecord) => {
    setRecords((list) => (list ?? []).map((r) => (r._id === updated._id ? updated : r)));
    setCompletingId(null);
    setRatingId(null);
    setBusy(false);
    setMoveOutDate('');
  };

  const complete = async (record: RentalRecord) => {
    if (!moveOutDate || busy) return;
    setBusy(true);
    setError('');
    try {
      replace(await rentalHistoryApi.completeRental(record._id, moveOutDate));
    } catch (err) {
      setError(getApiError(err));
      setBusy(false);
    }
  };

  const submitRatingFor = async (record: RentalRecord, rating: number, review: string) => {
    replace(await rentalHistoryApi.submitRating(record._id, rating, review));
    setNotice({ type: 'success', text: 'Thanks! Your rating has been submitted.' });
  };

  return (
      <main className="pb-16">
        <div className="mx-auto mt-8 max-w-3xl space-y-4 px-4">
          <h1 className="text-2xl font-bold text-ink">Rental history</h1>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {notice && (
              <div role="status" data-testid="rental-notice"
                   className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${noticeStyles[notice.type]}`}>
                <span>{notice.text}</span>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="font-bold">×</button>
              </div>
          )}

          {records === null && !error && <p className="text-sm text-ink-faint">Loading…</p>}
          {records?.length === 0 && (
              <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-faint">
                No rentals yet. A record appears here automatically once an agreement is fully signed.
              </p>
          )}

          {records?.map((record) => {
            const side: Side = record.tenantId === user?._id ? 'tenant' : 'landlord';
            const { myRating, completed, canRate } = getRateInfo(record, side);
            const theirRating = side === 'tenant' ? record.tenantRating : record.landlordRating;
            const property = typeof record.propertyId === 'object' ? record.propertyId : null;
            const other = side === 'tenant' ? 'landlord' : 'tenant';
            const isHighlighted = highlightId === record._id;

            return (
                <div key={record._id} id={`rental-${record._id}`} data-testid="rental-card"
                     className={`rounded-lg border bg-surface p-4 transition ${
                         isHighlighted ? 'border-primary-500 ring-2 ring-primary-200' : 'border-line'
                     }`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{property?.title ?? 'Property'}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${paymentStyles[record.paymentStatus]}`}>
                  payments {record.paymentStatus}
                </span>
                    {completed && (
                        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink-muted">
                    completed
                  </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink-muted" data-testid="rental-dates">
                    {fmtDate(record.moveInDate) ?? '—'} → {fmtDate(record.moveOutDate) ?? 'ongoing'}
                    {record.rentAmount != null && ` · Rs. ${record.rentAmount.toLocaleString('en-IN')}/month`}
                  </p>

                  <div className="mt-2 space-y-1 text-sm">
                    {myRating != null && (
                        <p data-testid="my-rating">
                          You rated the {other}: <Stars value={myRating} />
                        </p>
                    )}
                    {theirRating != null && (
                        <p data-testid="their-rating" className="text-ink-muted">
                          They rated you: <Stars value={theirRating} />
                        </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    {/* completing a rental relists the property, so it's landlord-only */}
                    {!completed && side === 'landlord' && completingId !== record._id && (
                        <button type="button" onClick={() => { setCompletingId(record._id); setRatingId(null); }}
                                data-testid="mark-completed"
                                className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted">
                          Mark as completed
                        </button>
                    )}
                    {!completed && side === 'tenant' && (
                        <p className="text-xs text-ink-faint">
                          Ongoing — this rental completes when the agreement ends.
                        </p>
                    )}

                    {canRate && ratingId !== record._id && (
                        <button type="button" onClick={() => { setRatingId(record._id); setCompletingId(null); }}
                                data-testid="rate-button"
                                className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                          Rate your {other}
                        </button>
                    )}
                  </div>

                  {completingId === record._id && (
                      <div className="mt-3 flex items-end gap-2" data-testid="complete-form">
                        <div>
                          <label htmlFor={`moveout-${record._id}`} className={labelClass}>Move-out date</label>
                          <input id={`moveout-${record._id}`} type="date" className={inputClass}
                                 value={moveOutDate} onChange={(e) => setMoveOutDate(e.target.value)} />
                        </div>
                        <button type="button" onClick={() => void complete(record)} disabled={!moveOutDate || busy}
                                data-testid="confirm-complete"
                                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                          {busy ? 'Saving…' : 'Confirm'}
                        </button>
                        <button type="button" onClick={() => setCompletingId(null)}
                                className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                          Cancel
                        </button>
                      </div>
                  )}

                  {ratingId === record._id && canRate && (
                      <RatingForm
                          side={side}
                          onSubmit={(rating, review) => submitRatingFor(record, rating, review)}
                          onCancel={() => setRatingId(null)}
                      />
                  )}
                </div>
            );
          })}
        </div>
      </main>
  );
}