import { useEffect, useState } from 'react';
import { Loader2, Star, X } from 'lucide-react';
import * as agreementApi from '../api/agreementApi';
import { getApiError } from '../api/client';

interface Props {
    agreementId: string;
    /** Name of the person being rated (optional, for the title) */
    partyName?: string;
    onClose: () => void;
    /** Called after a successful submit so the page can refresh */
    onSubmitted?: () => void;
}

export default function RateAgreementModal({ agreementId, partyName, onClose, onSubmitted }: Props) {
    const [value, setValue] = useState(0);
    const [hover, setHover] = useState(0);
    const [review, setReview] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const submit = async () => {
        if (value < 1) {
            setError('Please select a star rating.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await agreementApi.submitRating(agreementId, value, review.trim());
            setDone(true);
            onSubmitted?.();
        } catch (err) {
            setError(getApiError(err)); // e.g. "You have already submitted a rating for this agreement"
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-xl dark:bg-slate-950"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="text-lg font-bold text-ink">{partyName ? `Rate ${partyName}` : 'Rate this rental'}</h3>
                    <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-muted hover:bg-surface">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {done ? (
                    <>
                        <p className="text-sm text-green-700 dark:text-green-400">Thanks! Your rating has been submitted.</p>
                        <button
                            onClick={onClose}
                            className="mt-5 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                        >
                            Close
                        </button>
                    </>
                ) : (
                    <>
                        <p className="mb-3 text-sm text-ink-muted">
                            Your honest rating helps other users and updates this person&apos;s profile rating.
                        </p>

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
                                        onClick={() => setValue(n)}
                                        className="rounded p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                    >
                                        <Star className={`h-8 w-8 transition ${active ? 'fill-amber-400 text-amber-400' : 'text-line-strong'}`} />
                                    </button>
                                );
                            })}
                        </div>

                        <label htmlFor="rating-review" className="mb-1 mt-4 block text-sm font-medium text-ink">
                            Review <span className="font-normal text-ink-faint">(optional)</span>
                        </label>
                        <textarea
                            id="rating-review"
                            rows={3}
                            maxLength={500}
                            value={review}
                            onChange={(e) => setReview(e.target.value)}
                            placeholder="Share your experience…"
                            className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-ink"
                        />

                        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

                        <div className="mt-5 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submit}
                                disabled={submitting}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                            >
                                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                Submit rating
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}