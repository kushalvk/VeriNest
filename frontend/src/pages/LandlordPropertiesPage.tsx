import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as propertyApi from '../api/propertyApi';
import { getApiError } from '../api/client';
import { checkFile } from '../utils/fileValidation';
import PropertyCard from '../components/PropertyCard';
import TagInput from '../components/TagInput';
import { FormAlert, buttonClass, inputClass, labelClass } from '../components/AuthCard';
import type { Property, PropertyInput } from '../api/propertyApi';

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Studio', 'Independent House', 'Other'];
const FURNISHINGS = ['Furnished', 'Semi-Furnished', 'Unfurnished'];

interface FormState {
  title: string;
  description: string;
  propertyType: string;
  rent: string;
  securityDeposit: string;
  furnishing: string;
  bedrooms: string;
  bathrooms: string;
  area: string;
  amenities: string[];
  rules: string[];
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
}

const emptyForm: FormState = {
  title: '', description: '', propertyType: '', rent: '', securityDeposit: '',
  furnishing: '', bedrooms: '', bathrooms: '', area: '', amenities: [], rules: [],
  addressLine: '', city: '', state: '', pincode: '',
};

const fromProperty = (p: Property): FormState => ({
  title: p.title, description: p.description ?? '', propertyType: p.propertyType ?? '',
  rent: String(p.rent), securityDeposit: p.securityDeposit != null ? String(p.securityDeposit) : '',
  furnishing: p.furnishing ?? '', bedrooms: p.bedrooms != null ? String(p.bedrooms) : '',
  bathrooms: p.bathrooms != null ? String(p.bathrooms) : '', area: p.area != null ? String(p.area) : '',
  amenities: p.amenities ?? [], rules: p.rules ?? [],
  addressLine: p.address?.addressLine ?? '', city: p.address?.city ?? '',
  state: p.address?.state ?? '', pincode: p.address?.pincode ?? '',
});

const toPayload = (f: FormState): PropertyInput => {
  const str = (v: string) => (v.trim() ? v.trim() : undefined);
  const num = (v: string) => (v.trim() ? Number(v) : undefined);
  return {
    title: f.title.trim(),
    description: str(f.description),
    propertyType: str(f.propertyType),
    rent: num(f.rent),
    securityDeposit: num(f.securityDeposit),
    furnishing: str(f.furnishing),
    bedrooms: num(f.bedrooms),
    bathrooms: num(f.bathrooms),
    area: num(f.area),
    amenities: f.amenities,
    rules: f.rules,
    address: {
      addressLine: str(f.addressLine),
      city: f.city.trim(),
      state: str(f.state),
      pincode: str(f.pincode),
    },
  };
};

export default function LandlordPropertiesPage() {
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [banner, setBanner] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [imagesFor, setImagesFor] = useState<Property | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageError, setImageError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setProperties(await propertyApi.getMyProperties());
    } catch (err) {
      setBanner({ tone: 'error', message: getApiError(err) });
    }
  };
  useEffect(() => { void load(); }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); setBanner(null); };
  const openEdit = (p: Property) => { setEditing(p); setForm(fromProperty(p)); setFormOpen(true); setBanner(null); };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.title.trim() || !form.rent.trim() || !form.city.trim()) {
      setBanner({ tone: 'error', message: 'Title, rent and city are required.' });
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await propertyApi.updateProperty(editing._id, toPayload(form));
        setBanner({ tone: 'success', message: 'Property updated.' });
      } else {
        await propertyApi.createProperty(toPayload(form));
        setBanner({ tone: 'success', message: 'Property created.' });
      }
      setFormOpen(false);
      setEditing(null);
      await load();
      window.scrollTo({ top: 0 });
    } catch (err) {
      setBanner({ tone: 'error', message: getApiError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await propertyApi.deleteProperty(deleting._id);
      setBanner({ tone: 'success', message: `"${deleting.title}" deactivated.` });
      setDeleting(null);
      await load();
    } catch (err) {
      setBanner({ tone: 'error', message: getApiError(err) });
      setDeleting(null);
    }
  };

  const onImagesPicked = async (files: FileList | null) => {
    if (!imagesFor || !files?.length) return;
    setImageError('');
    const list = Array.from(files);
    for (const file of list) {
      const problem = checkFile(file); // jpg/png only, 5MB — matches backend
      if (problem) { setImageError(`${file.name}: ${problem}`); return; }
    }
    setUploadingImages(true);
    try {
      const updated = await propertyApi.uploadPropertyImages(imagesFor._id, list);
      setImagesFor(updated);
      await load();
    } catch (err) {
      setImageError(getApiError(err));
    } finally {
      setUploadingImages(false);
      if (imageInput.current) imageInput.current.value = '';
    }
  };

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-3xl space-y-6 px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">My properties</h1>
          <button type="button" onClick={openCreate} data-testid="add-property"
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            + Add property
          </button>
        </div>

        {banner && <FormAlert tone={banner.tone} message={banner.message} />}

        {formOpen && (
          <form onSubmit={onSubmit} noValidate data-testid="property-form"
            className="space-y-4 rounded-lg border border-line bg-surface p-5">
            <h2 className="font-semibold text-ink">{editing ? `Edit: ${editing.title}` : 'New property'}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="title" className={labelClass}>Title *</label>
                <input id="title" className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className={labelClass}>Description</label>
                <textarea id="description" rows={3} className={inputClass} value={form.description}
                  onChange={(e) => set('description', e.target.value)} />
              </div>
              <div>
                <label htmlFor="propertyType" className={labelClass}>Property type</label>
                <select id="propertyType" className={inputClass} value={form.propertyType}
                  onChange={(e) => set('propertyType', e.target.value)}>
                  <option value="">Select…</option>
                  {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="furnishing" className={labelClass}>Furnishing</label>
                <select id="furnishing" className={inputClass} value={form.furnishing}
                  onChange={(e) => set('furnishing', e.target.value)}>
                  <option value="">Select…</option>
                  {FURNISHINGS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="rent" className={labelClass}>Monthly rent (Rs.) *</label>
                <input id="rent" type="number" min="0" className={inputClass} value={form.rent}
                  onChange={(e) => set('rent', e.target.value)} />
              </div>
              <div>
                <label htmlFor="securityDeposit" className={labelClass}>Security deposit (Rs.)</label>
                <input id="securityDeposit" type="number" min="0" className={inputClass} value={form.securityDeposit}
                  onChange={(e) => set('securityDeposit', e.target.value)} />
              </div>
              <div>
                <label htmlFor="bedrooms" className={labelClass}>Bedrooms</label>
                <input id="bedrooms" type="number" min="0" className={inputClass} value={form.bedrooms}
                  onChange={(e) => set('bedrooms', e.target.value)} />
              </div>
              <div>
                <label htmlFor="bathrooms" className={labelClass}>Bathrooms</label>
                <input id="bathrooms" type="number" min="0" className={inputClass} value={form.bathrooms}
                  onChange={(e) => set('bathrooms', e.target.value)} />
              </div>
              <div>
                <label htmlFor="area" className={labelClass}>Area (sq. ft.)</label>
                <input id="area" type="number" min="0" className={inputClass} value={form.area}
                  onChange={(e) => set('area', e.target.value)} />
              </div>
            </div>

            <div>
              <label htmlFor="amenities" className={labelClass}>Amenities (press Enter to add)</label>
              <TagInput id="amenities" value={form.amenities} onChange={(v) => set('amenities', v)}
                placeholder="parking, lift, gym…" />
            </div>
            <div>
              <label htmlFor="rules" className={labelClass}>Rules (press Enter to add)</label>
              <TagInput id="rules" value={form.rules} onChange={(v) => set('rules', v)}
                placeholder="No smoking…" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="addressLine" className={labelClass}>Address line</label>
                <input id="addressLine" className={inputClass} value={form.addressLine}
                  onChange={(e) => set('addressLine', e.target.value)} />
              </div>
              <div>
                <label htmlFor="city" className={labelClass}>City *</label>
                <input id="city" className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
              </div>
              <div>
                <label htmlFor="state" className={labelClass}>State</label>
                <input id="state" className={inputClass} value={form.state} onChange={(e) => set('state', e.target.value)} />
              </div>
              <div>
                <label htmlFor="pincode" className={labelClass}>Pincode</label>
                <input id="pincode" className={inputClass} value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className={buttonClass} disabled={submitting}>
                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create property'}
              </button>
              <button type="button" onClick={() => { setFormOpen(false); setEditing(null); }}
                className="w-full rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                Cancel
              </button>
            </div>
          </form>
        )}

        {properties === null ? (
          <p className="text-sm text-ink-faint">Loading your properties…</p>
        ) : properties.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-faint">
            No properties yet — add your first listing.
          </p>
        ) : (
          <div className="space-y-3">
            {properties.map((p) => (
              <PropertyCard key={p._id} property={p} variant="owner"
                onEdit={openEdit} onDelete={setDeleting} onManageImages={setImagesFor} />
            ))}
          </div>
        )}
      </div>

      {/* delete confirmation dialog */}
      {deleting && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 px-4" data-testid="delete-dialog">
          <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-xl">
            <h3 className="font-semibold text-ink">Deactivate this listing?</h3>
            <p className="mt-2 text-sm text-ink-muted">
              “{deleting.title}” will be hidden from search. This does not permanently delete the record.
            </p>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => void confirmDelete()} data-testid="confirm-delete"
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Deactivate
              </button>
              <button type="button" onClick={() => setDeleting(null)}
                className="flex-1 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* image manager dialog */}
      {imagesFor && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 px-4" data-testid="images-dialog">
          <div className="w-full max-w-lg rounded-lg bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">Images — {imagesFor.title}</h3>
              <button type="button" onClick={() => { setImagesFor(null); setImageError(''); }}
                className="text-ink-faint hover:text-ink" aria-label="Close">✕</button>
            </div>
            {imageError && <p className="mt-2 text-sm text-red-600">{imageError}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2" data-testid="image-grid">
              {(imagesFor.images ?? []).map((img, i) => (
                <a key={img.publicId ?? i} href={img.url} target="_blank" rel="noreferrer"
                  className="block aspect-video overflow-hidden rounded-md bg-canvas">
                  <img src={img.url} alt={`Property photo ${i + 1}`} className="h-full w-full object-cover" />
                </a>
              ))}
              {(imagesFor.images ?? []).length === 0 && (
                <p className="col-span-3 text-sm text-ink-faint">No images yet.</p>
              )}
            </div>
            <label className="mt-4 block">
              <span className="sr-only">Add images</span>
              <input ref={imageInput} type="file" multiple accept="image/jpeg,image/png"
                data-testid="images-input" disabled={uploadingImages}
                onChange={(e) => void onImagesPicked(e.target.files)}
                className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-700" />
            </label>
            <p className="mt-2 text-xs text-ink-faint">
              {uploadingImages ? 'Uploading…' : 'JPG/PNG, max 5MB each, up to 10 per upload.'}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
