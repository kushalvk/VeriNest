import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as profileApi from '../api/profileApi';
import { getApiError } from '../api/client';
import { FormAlert, buttonClass, inputClass, labelClass } from '../components/AuthCard';
import type { LandlordProfile } from '../api/profileApi';

interface FormState {
  companyName: string;
  gstNumber: string;
  address: string;
  city: string;
  state: string;
  bio: string;
}

const emptyForm: FormState = {
  companyName: '', gstNumber: '', address: '', city: '', state: '', bio: '',
};

const fromProfile = (p: LandlordProfile): FormState => ({
  companyName: p.companyName ?? '',
  gstNumber: p.gstNumber ?? '',
  address: p.address ?? '',
  city: p.city ?? '',
  state: p.state ?? '',
  bio: p.bio ?? '',
});

const toPayload = (f: FormState): LandlordProfile => {
  const str = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    companyName: str(f.companyName),
    gstNumber: str(f.gstNumber),
    address: str(f.address),
    city: str(f.city),
    state: str(f.state),
    bio: str(f.bio),
  };
};

export default function LandlordProfilePage() {
  const [mode, setMode] = useState<'loading' | 'create' | 'edit'>('loading');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [banner, setBanner] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous re-entry guard against a fast double submit (see TenantProfilePage).
  const submitLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    profileApi
      .getMyLandlordProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile) {
          setForm(fromProfile(profile));
          setMode('edit');
        } else {
          setMode('create');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMode('create');
          setBanner({ tone: 'error', message: getApiError(err) });
        }
      });
    return () => { cancelled = true; };
  }, []);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitLock.current || submitting || mode === 'loading') return;
    setBanner(null);
    submitLock.current = true;
    setSubmitting(true);
    try {
      const payload = toPayload(form);
      const saved = await profileApi.saveLandlordProfile(payload);
      setForm(fromProfile(saved));
      setMode('edit');
      setBanner({ tone: 'success', message: mode === 'create' ? 'Profile created successfully.' : 'Profile updated successfully.' });
    } catch (err) {
      setBanner({ tone: 'error', message: getApiError(err) });
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (mode === 'loading') {
    return <main className="flex items-center justify-center py-24 text-ink-faint">Loading profile…</main>;
  }

  return (
    <main className="pb-16">
      <form onSubmit={onSubmit} noValidate className="mx-auto mt-8 max-w-xl space-y-4 px-4">
        <div>
          <h1 className="text-2xl font-bold text-ink" data-testid="profile-title">
            {mode === 'create' ? 'Complete your landlord profile' : 'Edit your landlord profile'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Tell tenants a little about you or your business.
          </p>
        </div>

        {banner && <FormAlert tone={banner.tone} message={banner.message} />}

        <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <div>
            <label htmlFor="companyName" className={labelClass}>Company name</label>
            <input id="companyName" className={inputClass} value={form.companyName}
              onChange={(e) => set('companyName')(e.target.value)} />
          </div>
          <div>
            <label htmlFor="gstNumber" className={labelClass}>GST number (optional)</label>
            <input id="gstNumber" className={`${inputClass} uppercase`} value={form.gstNumber}
              onChange={(e) => set('gstNumber')(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label htmlFor="address" className={labelClass}>Address</label>
            <input id="address" className={inputClass} value={form.address}
              onChange={(e) => set('address')(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={labelClass}>City</label>
              <input id="city" className={inputClass} value={form.city}
                onChange={(e) => set('city')(e.target.value)} />
            </div>
            <div>
              <label htmlFor="state" className={labelClass}>State</label>
              <input id="state" className={inputClass} value={form.state}
                onChange={(e) => set('state')(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="bio" className={labelClass}>Bio</label>
            <textarea id="bio" rows={4} className={inputClass} value={form.bio}
              onChange={(e) => set('bio')(e.target.value)} />
          </div>
        </div>

        <button type="submit" className={buttonClass} disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create profile' : 'Save changes'}
        </button>
      </form>
    </main>
  );
}
