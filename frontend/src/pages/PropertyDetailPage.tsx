import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import * as propertyApi from '../api/propertyApi';
import * as applicationApi from '../api/applicationApi';
import { getApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { inputClass, labelClass } from '../components/AuthCard';
import { HouseArtwork } from '../components/Artwork';
import type { Property } from '../api/propertyApi';

type ApplyError =
  | { kind: 'incomplete'; missingFields: string[] }
  | { kind: 'duplicate' }
  | { kind: 'other'; message: string };

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const [property, setProperty] = useState<Property | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [error, setError] = useState('');
  const [mainImage, setMainImage] = useState(0);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<ApplyError | null>(null);

  const submitApplication = async () => {
    if (!property || applying) return;
    setApplyError(null);
    setApplying(true);
    try {
      await applicationApi.applyToProperty(property._id, applyMessage);
      setApplied(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; missingFields?: string[] } | undefined;
        if (err.response?.status === 422 && data?.missingFields?.length) {
          setApplyError({ kind: 'incomplete', missingFields: data.missingFields });
        } else if (err.response?.status === 409) {
          setApplyError({ kind: 'duplicate' });
        } else {
          setApplyError({ kind: 'other', message: getApiError(err) });
        }
      } else {
        setApplyError({ kind: 'other', message: getApiError(err) });
      }
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    propertyApi
      .getProperty(id)
      .then((p) => {
        if (cancelled) return;
        setProperty(p);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setState('notfound');
        } else {
          setError(getApiError(err));
          setState('error');
        }
      });
    return () => { cancelled = true; };
  }, [id]);

  const backLink = (
    <div className="mx-auto max-w-4xl px-4 pt-6">
      <Link to="/properties" className="text-sm font-medium text-primary-600 hover:underline">
        ← Back to search
      </Link>
    </div>
  );

  if (state === 'loading') {
    return <main><p className="p-10 text-center text-ink-faint">Loading property…</p></main>;
  }
  if (state === 'notfound') {
    return (
      <main className="pb-16">
        <div className="mx-auto mt-16 max-w-md px-4 text-center" data-testid="not-found">
          <p className="text-5xl">🔍</p>
          <h1 className="mt-4 text-xl font-bold text-ink">Property not found</h1>
          <p className="mt-2 text-sm text-ink-muted">
            This listing may have been removed or the link is incorrect.
          </p>
          <Link to="/properties"
            className="mt-4 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            Browse properties
          </Link>
        </div>
      </main>
    );
  }
  if (state === 'error' || !property) {
    return <main><p className="p-10 text-center text-red-600">{error}</p></main>;
  }

  const images = property.images ?? [];

  return (
    <main className="pb-16">
      {backLink}
      <div className="mx-auto mt-6 max-w-4xl px-4">
        {/* gallery — a listing with no photos gets illustrated, never a stock
            photo of somebody else's home */}
        <div className="overflow-hidden rounded-lg bg-line">
          {images.length > 0 ? (
            <img src={images[mainImage]?.url} alt={property.title}
              className="h-80 w-full object-cover" data-testid="main-image" />
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-2 bg-surface-muted"
              data-testid="no-photos">
              <HouseArtwork className="h-24 w-auto text-ink-faint" />
              <p className="text-sm text-ink-faint">
                The landlord hasn’t added photos for this listing yet.
              </p>
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto" data-testid="thumbnails">
            {images.map((img, i) => (
              <button key={img.publicId ?? i} type="button" onClick={() => setMainImage(i)}
                className={`h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 ${i === mainImage ? 'border-primary-500' : 'border-transparent'}`}>
                <img src={img.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink" data-testid="detail-title">{property.title}</h1>
            <p className="mt-1 text-ink-muted">
              {[property.address?.addressLine, property.address?.city, property.address?.state, property.address?.pincode]
                .filter(Boolean).join(', ')}
            </p>
          </div>
          <p className="text-2xl font-bold text-primary-700" data-testid="detail-rent">
            Rs. {property.rent.toLocaleString('en-IN')}<span className="text-sm font-medium text-ink-faint">/month</span>
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {property.propertyType && <span className="rounded-full bg-surface px-3 py-1 shadow-sm">{property.propertyType}</span>}
          {property.bedrooms != null && <span className="rounded-full bg-surface px-3 py-1 shadow-sm">{property.bedrooms} bedroom{property.bedrooms === 1 ? '' : 's'}</span>}
          {property.bathrooms != null && <span className="rounded-full bg-surface px-3 py-1 shadow-sm">{property.bathrooms} bathroom{property.bathrooms === 1 ? '' : 's'}</span>}
          {property.area != null && <span className="rounded-full bg-surface px-3 py-1 shadow-sm">{property.area} sq. ft.</span>}
          {property.furnishing && <span className="rounded-full bg-surface px-3 py-1 shadow-sm">{property.furnishing}</span>}
          {property.securityDeposit != null && (
            <span className="rounded-full bg-surface px-3 py-1 shadow-sm">
              Deposit Rs. {property.securityDeposit.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {property.description && (
          <section className="mt-6 rounded-lg border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">About this property</h2>
            <p className="mt-2 whitespace-pre-line text-ink-muted">{property.description}</p>
          </section>
        )}

        {(property.amenities?.length ?? 0) > 0 && (
          <section className="mt-4 rounded-lg border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Amenities</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {property.amenities!.map((a) => (
                <span key={a} className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700">{a}</span>
              ))}
            </div>
          </section>
        )}

        {(property.rules?.length ?? 0) > 0 && (
          <section className="mt-4 rounded-lg border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">House rules</h2>
            <ul className="mt-2 list-inside list-disc text-sm text-ink-muted">
              {property.rules!.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </section>
        )}

        {/* Apply: tenants get the action (wired in a later task); guests get a login nudge.
            Occupied/inactive listings (reachable via direct link) can't be applied to. */}
        <div className="mt-8">
          {property.status !== 'available' && (
            <p data-testid="not-available-note"
              className="inline-block rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {property.status === 'occupied'
                ? 'This property is currently rented and not accepting applications.'
                : 'This listing is no longer active.'}
            </p>
          )}
          {property.status === 'available' && !isAuthenticated && (
            <Link to="/login" data-testid="apply-login-link"
              className="inline-block rounded-md bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700">
              Log in to apply
            </Link>
          )}
          {property.status === 'available' && isAuthenticated && user?.role === 'tenant' && (
            <button type="button" data-testid="apply-button"
              className="rounded-md bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
              onClick={() => { setApplyOpen(true); setApplyError(null); setApplied(false); }}>
              Apply for this property
            </button>
          )}
        </div>
      </div>

      {/* apply modal */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" data-testid="apply-modal">
          <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
            {applied ? (
              <div className="text-center" data-testid="apply-success">
                <p className="text-4xl">🎉</p>
                <h3 className="mt-3 font-semibold text-ink">Application submitted!</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  The landlord will review it — track progress in your applications.
                </p>
                <div className="mt-4 flex gap-3">
                  <Link to="/my-applications"
                    className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                    View my applications
                  </Link>
                  <button type="button" onClick={() => setApplyOpen(false)}
                    className="flex-1 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-ink">Apply for “{property.title}”</h3>

                {applyError?.kind === 'incomplete' && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm" data-testid="apply-incomplete">
                    <p className="font-medium text-amber-800">
                      Your profile is missing some details required to apply:
                    </p>
                    <ul className="mt-1 list-inside list-disc text-amber-700">
                      {applyError.missingFields.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                    <Link to="/profile" className="mt-2 inline-block font-semibold text-amber-900 underline">
                      Complete your profile →
                    </Link>
                  </div>
                )}
                {applyError?.kind === 'duplicate' && (
                  <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800" data-testid="apply-duplicate">
                    You’ve already applied to this property.
                  </p>
                )}
                {applyError?.kind === 'other' && (
                  <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {applyError.message}
                  </p>
                )}

                <label htmlFor="apply-message" className={`${labelClass} mt-4`}>
                  Message to the landlord (optional)
                </label>
                <textarea id="apply-message" rows={3} className={inputClass} value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="Introduce yourself briefly…" />

                <div className="mt-4 flex gap-3">
                  <button type="button" onClick={() => void submitApplication()} disabled={applying}
                    data-testid="apply-submit"
                    className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                    {applying ? 'Submitting…' : 'Submit application'}
                  </button>
                  <button type="button" onClick={() => setApplyOpen(false)}
                    className="flex-1 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
