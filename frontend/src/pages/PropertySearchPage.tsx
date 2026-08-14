import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as propertyApi from '../api/propertyApi';
import { getApiError } from '../api/client';
import PropertyCard from '../components/PropertyCard';
import { inputClass, labelClass } from '../components/AuthCard';
import { PhotoBand } from '../components/Imagery';
import { photos } from '../assets/photos';
import type { SearchFilters, SearchResult } from '../api/propertyApi';

const FURNISHINGS = ['Furnished', 'Semi-Furnished', 'Unfurnished'];
const PROPERTY_TYPES = ['Apartment', 'Villa', 'Studio', 'Independent House', 'Other'];

const emptyFilters: SearchFilters = {
  city: '', minRent: '', maxRent: '', bedrooms: '', furnishing: '', propertyType: '',
};

export default function PropertySearchPage() {
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (activeFilters: SearchFilters, targetPage: number) => {
    setLoading(true);
    setError('');
    try {
      setResult(await propertyApi.searchProperties({ ...activeFilters, page: targetPage, limit: 12 }));
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void search(emptyFilters, 1); }, [search]);

  const set = (key: keyof SearchFilters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // dropdown changes trigger a search immediately; text inputs wait for Search
  const setAndSearch = (key: keyof SearchFilters) => (value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setPage(1);
    void search(next, 1);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    void search(filters, 1);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
    void search(emptyFilters, 1);
  };

  const goToPage = (p: number) => {
    setPage(p);
    void search(filters, p);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="pb-16">
      <PhotoBand photo={photos.search} scrim="hero" eager>
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h1 className="text-3xl font-bold tracking-tight">Find a home</h1>
          <p className="mt-2 max-w-xl text-primary-100">
            Every listing here comes from a landlord on VeriNest — filter by city, budget,
            and the things that actually matter to you.
          </p>
        </div>
      </PhotoBand>

      <div className="mx-auto mt-8 max-w-5xl px-4">
        {/* The filter card is pulled up over the banner's bottom edge so the
            search sits visually inside the hero rather than after it. It needs
            `relative` to paint above the banner, which is itself positioned. */}
        <form onSubmit={onSubmit}
          className="relative -mt-14 rounded-lg border border-line bg-surface p-4 shadow-card">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="col-span-2">
              <label htmlFor="city" className={labelClass}>City</label>
              <input id="city" className={inputClass} value={filters.city}
                placeholder="e.g. Mumbai" onChange={(e) => set('city')(e.target.value)} />
            </div>
            <div>
              <label htmlFor="minRent" className={labelClass}>Min rent</label>
              <input id="minRent" type="number" min="0" className={inputClass} value={filters.minRent}
                onChange={(e) => set('minRent')(e.target.value)} />
            </div>
            <div>
              <label htmlFor="maxRent" className={labelClass}>Max rent</label>
              <input id="maxRent" type="number" min="0" className={inputClass} value={filters.maxRent}
                onChange={(e) => set('maxRent')(e.target.value)} />
            </div>
            <div>
              <label htmlFor="bedrooms" className={labelClass}>Bedrooms</label>
              <select id="bedrooms" className={inputClass} value={filters.bedrooms}
                onChange={(e) => setAndSearch('bedrooms')(e.target.value)}>
                <option value="">Any</option>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="furnishing" className={labelClass}>Furnishing</label>
              <select id="furnishing" className={inputClass} value={filters.furnishing}
                onChange={(e) => setAndSearch('furnishing')(e.target.value)}>
                <option value="">Any</option>
                {FURNISHINGS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="propertyType" className={labelClass}>Type</label>
              <select id="propertyType" className={inputClass} value={filters.propertyType}
                onChange={(e) => setAndSearch('propertyType')(e.target.value)}>
                <option value="">Any</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <button type="submit" data-testid="search-button"
              className="rounded-md bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
            <button type="button" onClick={clearFilters} data-testid="clear-filters"
              className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
              Clear filters
            </button>
          </div>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <p className="mt-6 text-sm text-ink-muted" data-testid="result-count">
          {result ? `${result.total} propert${result.total === 1 ? 'y' : 'ies'} available` : 'Loading…'}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {result?.results.map((p) => (
            <PropertyCard key={p._id} property={p} variant="public" />
          ))}
        </div>
        {result && result.results.length === 0 && (
          <p className="mt-4 rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-faint">
            No properties match these filters.
          </p>
        )}

        {result && result.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4" data-testid="pagination">
            <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}
              className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40">
              ← Previous
            </button>
            <span className="text-sm text-ink-muted">Page {result.page} of {result.totalPages}</span>
            <button type="button" disabled={page >= result.totalPages} onClick={() => goToPage(page + 1)}
              className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40">
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
