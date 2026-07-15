import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as applicationApi from '../api/applicationApi';
import * as agreementApi from '../api/agreementApi';
import { getApiError } from '../api/client';
import type { MyApplication } from '../api/applicationApi';

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-canvas text-ink-muted border-line',
};

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<MyApplication[] | null>(null);
  const [agreementByApp, setAgreementByApp] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    applicationApi
      .getMyApplications()
      .then(setApplications)
      .catch((err) => setError(getApiError(err)));
    agreementApi
      .getMyAgreements()
      .then((agreements) => {
        const map: Record<string, string> = {};
        agreements.forEach((a) => { map[a.applicationId] = a._id; });
        setAgreementByApp(map);
      })
      .catch(() => { /* links are best-effort */ });
  }, []);

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-3xl space-y-4 px-4">
        <h1 className="text-2xl font-bold text-ink">My applications</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {applications === null && !error && <p className="text-sm text-ink-faint">Loading…</p>}
        {applications?.length === 0 && (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-faint">
            You haven’t applied to any properties yet.{' '}
            <Link to="/properties" className="font-medium text-primary-600 hover:underline">Browse listings →</Link>
          </p>
        )}
        {applications?.map((app) => (
          <div key={app._id} data-testid="application-card"
            className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-ink">
                {app.propertyId ? (
                  <Link to={`/properties/${app.propertyId._id}`} className="hover:underline">
                    {app.propertyId.title}
                  </Link>
                ) : 'Listing unavailable'}
              </h3>
              <span data-testid="application-status"
                className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[app.status]}`}>
                {app.status}
              </span>
            </div>
            {app.propertyId && (
              <p className="mt-1 text-sm text-ink-muted">
                Rs. {app.propertyId.rent.toLocaleString('en-IN')}/month
                {app.propertyId.address?.city && ` · ${app.propertyId.address.city}`}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-faint">
              Applied {new Date(app.appliedAt).toLocaleDateString()}
            </p>
            {app.status === 'accepted' && (
              <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800" data-testid="accepted-note">
                Accepted! The landlord may now request access to your verification documents —
                watch your <Link to="/verification-requests" className="font-semibold underline">verification requests</Link>.
              </p>
            )}
            {agreementByApp[app._id] && (
              <Link to={`/agreements/${agreementByApp[app._id]}`} data-testid="view-agreement"
                className="mt-2 inline-block rounded-md border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50">
                View rental agreement →
              </Link>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
