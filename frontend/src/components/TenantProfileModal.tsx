import { useEffect, useState } from 'react';
import * as applicationApi from '../api/applicationApi';
import { getApiError } from '../api/client';
import { trustScoreColor } from '../utils/trustScore';
import type { TenantSummary } from '../api/applicationApi';

const docStatusBadge: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};

const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
  value == null || value === '' ? null : (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-sm text-ink-faint">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );

interface Props {
  applicationId: string;
  onClose: () => void;
}

export default function TenantProfileModal({ applicationId, onClose }: Props) {
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    applicationApi
      .getTenantSummary(applicationId)
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch((err) => { if (!cancelled) setError(getApiError(err)); });
    return () => { cancelled = true; };
  }, [applicationId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8"
      data-testid="tenant-profile-modal">
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="font-semibold text-ink">Tenant profile</h3>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-ink-faint hover:text-ink">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {!summary && !error && <p className="text-sm text-ink-faint">Loading…</p>}

          {summary && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-ink" data-testid="summary-name">
                    {summary.tenant.fullName}
                  </p>
                  <p className="truncate text-sm text-ink-muted">{summary.tenant.email}</p>
                  {summary.tenant.memberSince && (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      Member since {new Date(summary.tenant.memberSince).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="shrink-0 rounded-lg border border-line bg-surface-muted px-4 py-2 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Trust score</p>
                  <p data-testid="summary-trust-score"
                    className={`text-2xl font-bold ${summary.trustScore != null ? trustScoreColor(summary.trustScore) : 'text-ink-faint'}`}>
                    {summary.trustScore ?? '—'}
                  </p>
                  <p className="text-xs text-ink-faint">/ 100</p>
                </div>
              </div>

              {summary.trustReasons.length > 0 && (
                <div className="mt-3 rounded-md bg-surface-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Score breakdown
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-ink-muted">
                    {summary.trustReasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              )}

              <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Profile
              </h4>
              {summary.profile ? (
                <dl className="mt-1 divide-y divide-line rounded-md border border-line px-3">
                  <Row label="Occupation" value={summary.profile.occupation} />
                  <Row label="Employment type" value={summary.profile.employmentType} />
                  <Row label="Company" value={summary.profile.companyName} />
                  <Row label="Designation" value={summary.profile.designation} />
                  <Row label="Monthly salary"
                    value={summary.profile.monthlySalary != null
                      ? `Rs. ${summary.profile.monthlySalary.toLocaleString('en-IN')}`
                      : null} />
                  <Row label="Current location"
                    value={[summary.profile.currentCity, summary.profile.currentState].filter(Boolean).join(', ') || null} />
                  <Row label="Police verification" value={summary.profile.policeVerificationStatus} />
                </dl>
              ) : (
                <p className="mt-1 text-sm text-ink-faint">No profile created yet.</p>
              )}

              <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Documents
              </h4>
              {summary.allDocumentsVerified && (
                <p className="mt-1 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
                  data-testid="summary-all-verified">
                  ✓ All documents verified by admin
                </p>
              )}
              {summary.documents.length === 0 ? (
                <p className="mt-1 text-sm text-ink-faint">No documents uploaded yet.</p>
              ) : (
                <ul className="mt-1 space-y-1.5">
                  {summary.documents.map((d, i) => (
                    <li key={`${d.documentType}-${i}`}
                      className="flex items-center justify-between rounded-md border border-line px-3 py-2">
                      <span className="text-sm font-medium capitalize text-ink">
                        {d.documentType.replace(/_/g, ' ')}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${docStatusBadge[d.verificationStatus]}`}>
                        {d.verificationStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="border-t border-line px-5 py-3">
          <button type="button" onClick={onClose}
            className="w-full rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
