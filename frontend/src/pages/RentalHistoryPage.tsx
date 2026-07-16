import { useEffect, useState } from 'react';
import * as rentalHistoryApi from '../api/rentalHistoryApi';
import { getApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { inputClass, labelClass } from '../components/AuthCard';
import type { RentalRecord } from '../api/rentalHistoryApi';

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

const paymentStyles: Record<string, string> = {
  clear: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  default: 'bg-red-100 text-red-700',
};

const Stars = ({ value }: { value: number }) => (
  <span className="text-amber-500">{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>
);

function RatingForm({ record, side, onDone }: {
  record: RentalRecord;
  side: 'tenant' | 'landlord';
  onDone: (updated: RentalRecord) => void;
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
      onDone(await rentalHistoryApi.submitRating(record._id, rating, review));
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
      <div className="mt-2 flex gap-1" data-testid="star-picker">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} data-testid={`star-${n}`}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={`text-2xl transition ${n <= rating ? 'text-amber-500' : 'text-line-strong hover:text-amber-300'}`}>
            ★
          </button>
        ))}
      </div>
      <textarea rows={2} className={`${inputClass} mt-2`} placeholder="Optional review…"
        value={review} onChange={(e) => setReview(e.target.value)} data-testid="review-input" />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <button type="button" onClick={() => void submit()} disabled={!rating || busy}
        data-testid="submit-rating"
        className="mt-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
        {busy ? 'Submitting…' : 'Submit rating'}
      </button>
    </div>
  );
}

export default function RentalHistoryPage() {
  const user = useAuthStore((s) => s.user);
  const [records, setRecords] = useState<RentalRecord[] | null>(null);
  const [error, setError] = useState('');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [moveOutDate, setMoveOutDate] = useState('');
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rentalHistoryApi
      .getMyRentalHistory()
      .then(setRecords)
      .catch((err) => setError(getApiError(err)));
  }, []);

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
    try {
      replace(await rentalHistoryApi.completeRental(record._id, moveOutDate));
    } catch (err) {
      setError(getApiError(err));
      setBusy(false);
    }
  };

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-3xl space-y-4 px-4">
        <h1 className="text-2xl font-bold text-ink">Rental history</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {records === null && !error && <p className="text-sm text-ink-faint">Loading…</p>}
        {records?.length === 0 && (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-faint">
            No rentals yet. A record appears here automatically once an agreement is fully signed.
          </p>
        )}
        {records?.map((record) => {
          const side: 'tenant' | 'landlord' = record.tenantId === user?._id ? 'tenant' : 'landlord';
          // tenant rates the landlord (stored in landlordRating) and vice versa
          const myRating = side === 'tenant' ? record.landlordRating : record.tenantRating;
          const theirRating = side === 'tenant' ? record.tenantRating : record.landlordRating;
          const property = typeof record.propertyId === 'object' ? record.propertyId : null;
          const completed = Boolean(record.moveOutDate);

          return (
            <div key={record._id} data-testid="rental-card"
              className="rounded-lg border border-line bg-surface p-4">
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
                    You rated {side === 'tenant' ? 'the landlord' : 'the tenant'}: <Stars value={myRating} />
                  </p>
                )}
                {theirRating != null && (
                  <p data-testid="their-rating" className="text-ink-muted">
                    They rated you: <Stars value={theirRating} />
                  </p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
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
                    Ongoing — your landlord will mark this rental as completed after move-out.
                  </p>
                )}
                {completed && myRating == null && ratingId !== record._id && (
                  <button type="button" onClick={() => { setRatingId(record._id); setCompletingId(null); }}
                    data-testid="rate-button"
                    className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                    Rate {side === 'tenant' ? 'your landlord' : 'your tenant'}
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

              {ratingId === record._id && (
                <RatingForm record={record} side={side} onDone={replace} />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
