import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import * as applicationApi from '../api/applicationApi';
import * as agreementApi from '../api/agreementApi';
import * as verificationApi from '../api/verificationApi';
import { getApiError } from '../api/client';
import VerificationRequestModal from '../components/VerificationRequestModal';
import TenantProfileModal from '../components/TenantProfileModal';
import SharedDocumentList from '../components/SharedDocumentList';
import { trustScoreColor } from '../utils/trustScore';
import { inputClass, labelClass } from '../components/AuthCard';
import type { ReceivedApplication } from '../api/applicationApi';
import type { AccessType, LandlordVerificationRequest, SharedDocument } from '../api/verificationApi';

const accessWindowLabel: Record<AccessType, string> = {
  one_time: 'One-time view',
  '24_hours': '24-hour access',
  '7_days': '7-day access',
};

// State of the in-app "view documents" modal fetch. `gone` is a 410 (a
// one-time link already consumed, or the window elapsed).
type DocsState =
  | { kind: 'loading' }
  | { kind: 'ready'; documents: SharedDocument[]; accessType: AccessType; expiresAt: string }
  | { kind: 'gone'; message: string }
  | { kind: 'error'; message: string };

// Rental agreements must run 3–11 months (mirrors the server-side rule).
const MIN_AGREEMENT_MONTHS = 3;
const MAX_AGREEMENT_MONTHS = 11;

const addMonths = (isoDate: string, months: number) => {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d;
};

const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-canvas text-ink-muted border-line',
};

export default function ReceivedApplicationsPage() {
  const [applications, setApplications] = useState<ReceivedApplication[] | null>(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<ReceivedApplication | null>(null);
  const [verifyFor, setVerifyFor] = useState<ReceivedApplication | null>(null);
  const [profileFor, setProfileFor] = useState<ReceivedApplication | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // applicationId → agreementId, so accepted rows can link to an existing agreement
  const [agreementByApp, setAgreementByApp] = useState<Record<string, string>>({});
  const [agreementFor, setAgreementFor] = useState<ReceivedApplication | null>(null);
  const [agrForm, setAgrForm] = useState({ startDate: '', endDate: '', deposit: '' });
  const [agrBusy, setAgrBusy] = useState(false);
  const [agrError, setAgrError] = useState('');
  // applicationId → the landlord's latest verification request for it, so an
  // accepted row can show the in-app "view documents" access once approved.
  const [requestByApp, setRequestByApp] = useState<Record<string, LandlordVerificationRequest>>({});
  const [docsFor, setDocsFor] = useState<ReceivedApplication | null>(null);
  const [docsState, setDocsState] = useState<DocsState>({ kind: 'loading' });

  // Best-effort; re-run after creating/opening a request so the row reflects
  // the new status (pending → approved, or a consumed one-time link → expired).
  const refreshRequests = useCallback(() => {
    verificationApi
      .getLandlordVerificationRequests()
      .then((reqs) => {
        const map: Record<string, LandlordVerificationRequest> = {};
        reqs.forEach((r) => {
          const appId =
            typeof r.applicationId === 'object' && r.applicationId
              ? r.applicationId._id
              : r.applicationId;
          // List is newest-first, so the first seen per application wins.
          if (appId && !map[appId]) map[appId] = r;
        });
        setRequestByApp(map);
      })
      .catch(() => { /* access affordance is best-effort */ });
  }, []);

  useEffect(() => {
    applicationApi
      .getReceivedApplications()
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
    refreshRequests();
  }, [refreshRequests]);

  const openDocs = async (app: ReceivedApplication, request: LandlordVerificationRequest) => {
    setDocsFor(app);
    setDocsState({ kind: 'loading' });
    try {
      const data = await verificationApi.accessDocumentsByRequestId(request._id);
      setDocsState({ kind: 'ready', ...data });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 410) {
        const message = (err.response?.data as { error?: string })?.error ?? 'Access ended';
        setDocsState({ kind: 'gone', message });
      } else {
        setDocsState({ kind: 'error', message: getApiError(err) });
      }
    } finally {
      // A one-time view is consumed on open — refresh so the button updates.
      refreshRequests();
    }
  };

  const closeDocs = () => setDocsFor(null);

  // The verification affordance for an accepted application, driven by the
  // landlord's latest request for it.
  const renderVerificationAction = (app: ReceivedApplication) => {
    const vreq = requestByApp[app._id];
    const activeAccess = vreq?.status === 'approved' && vreq.active;

    if (vreq?.status === 'pending') {
      return (
        <span data-testid="verification-pending"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
          Verification requested — awaiting tenant approval
        </span>
      );
    }
    if (activeAccess) {
      return (
        <button type="button" data-testid="view-verified-documents"
          onClick={() => void openDocs(app, vreq)}
          className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
          View verified documents · {accessWindowLabel[vreq.accessType]}
        </button>
      );
    }
    // No request yet, or a finished one (rejected / expired / one-time used).
    const lapsed = vreq && (vreq.status === 'approved' || vreq.status === 'expired' || vreq.status === 'rejected');
    return (
      <div className="flex items-center gap-2">
        {lapsed && <span className="text-xs text-ink-faint" data-testid="access-ended">Access ended</span>}
        <button type="button" data-testid="request-verification"
          onClick={() => setVerifyFor(app)}
          className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
          Request document verification
        </button>
      </div>
    );
  };

  const createAgreement = async () => {
    if (!agreementFor || agrBusy) return;
    if (!agrForm.startDate || !agrForm.endDate) {
      setAgrError('Start and end dates are required.');
      return;
    }
    const end = new Date(agrForm.endDate);
    if (
      end < addMonths(agrForm.startDate, MIN_AGREEMENT_MONTHS) ||
      end > addMonths(agrForm.startDate, MAX_AGREEMENT_MONTHS)
    ) {
      setAgrError('Agreement duration must be between 3 and 11 months.');
      return;
    }
    setAgrBusy(true);
    setAgrError('');
    try {
      const agreement = await agreementApi.createAgreement(
        agreementFor._id,
        agrForm.startDate,
        agrForm.endDate,
        agrForm.deposit.trim() ? Number(agrForm.deposit) : undefined
      );
      setAgreementByApp((m) => ({ ...m, [agreementFor._id]: agreement._id }));
      setAgreementFor(null);
      setAgrForm({ startDate: '', endDate: '', deposit: '' });
    } catch (err) {
      setAgrError(getApiError(err));
    } finally {
      setAgrBusy(false);
    }
  };

  const decide = async (app: ReceivedApplication, status: 'accepted' | 'rejected') => {
    setBusyId(app._id);
    setError('');
    try {
      const updated = await applicationApi.updateApplicationStatus(app._id, status);
      // update in place — no reload
      setApplications((list) =>
        (list ?? []).map((a) => (a._id === app._id ? { ...a, status: updated.status } : a))
      );
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusyId(null);
      setRejecting(null);
    }
  };

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-3xl space-y-4 px-4">
        <h1 className="text-2xl font-bold text-ink">Received applications</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {applications === null && !error && <p className="text-sm text-ink-faint">Loading…</p>}
        {applications?.length === 0 && (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-faint">
            No applications received yet.
          </p>
        )}
        {applications?.map((app) => (
          <div key={app._id} data-testid="received-card"
            className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-ink" data-testid="applicant-name">
                {app.tenantId?.fullName ?? 'Unknown applicant'}
              </h3>
              <span data-testid="received-status"
                className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[app.status]}`}>
                {app.status}
              </span>
              {app.tenantMeta?.trustScore != null && (
                <span data-testid="trust-score-chip"
                  className="rounded-full border border-line bg-surface-muted px-2 py-0.5 text-xs font-semibold">
                  <span className="font-normal text-ink-faint">Trust </span>
                  <span className={trustScoreColor(app.tenantMeta.trustScore)}>
                    {app.tenantMeta.trustScore}
                  </span>
                  <span className="font-normal text-ink-faint">/100</span>
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">{app.tenantId?.email}</p>
            <p className="mt-1 text-sm text-ink-muted">
              Applied for <span className="font-medium">{app.propertyId?.title ?? 'a removed listing'}</span>
              {app.propertyId?.address?.city && ` · ${app.propertyId.address.city}`}
            </p>
            {app.message && (
              <p className="mt-2 rounded-md bg-surface-muted px-3 py-2 text-sm italic text-ink-muted">
                “{app.message}”
              </p>
            )}
            <p className="mt-1 text-xs text-ink-faint">
              Received {new Date(app.appliedAt).toLocaleDateString()}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <button type="button" data-testid="view-tenant-profile"
                onClick={() => setProfileFor(app)}
                className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted">
                View tenant profile
              </button>
              {app.status === 'pending' && (
                <>
                  <button type="button" data-testid="accept-application"
                    disabled={busyId === app._id}
                    onClick={() => void decide(app, 'accepted')}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                    Accept
                  </button>
                  <button type="button" data-testid="reject-application"
                    disabled={busyId === app._id}
                    onClick={() => setRejecting(app)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Reject
                  </button>
                </>
              )}
              {app.status === 'accepted' && (
                <>
                  {/* A landlord can request document verification at any time —
                      even when the tenant's documents are already admin-verified.
                      Once the tenant approves, this flips to an in-app "view
                      documents" link that lasts only for the granted window. */}
                  {renderVerificationAction(app)}
                  {agreementByApp[app._id] ? (
                    <Link to={`/agreements/${agreementByApp[app._id]}`} data-testid="view-agreement"
                      className="rounded-md border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50">
                      View agreement →
                    </Link>
                  ) : (
                    <button type="button" data-testid="create-agreement"
                      onClick={() => { setAgreementFor(app); setAgrError(''); }}
                      className="rounded-md border border-primary-300 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50">
                      Create agreement
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* reject confirmation */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" data-testid="reject-dialog">
          <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-xl">
            <h3 className="font-semibold text-ink">Reject this application?</h3>
            <p className="mt-2 text-sm text-ink-muted">
              {rejecting.tenantId?.fullName ?? 'The applicant'} will be notified that their
              application was not successful.
            </p>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => void decide(rejecting, 'rejected')}
                data-testid="confirm-reject"
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Reject
              </button>
              <button type="button" onClick={() => setRejecting(null)}
                className="flex-1 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {verifyFor && (
        <VerificationRequestModal
          applicationId={verifyFor._id}
          tenantName={verifyFor.tenantId?.fullName}
          onClose={() => { setVerifyFor(null); refreshRequests(); }}
        />
      )}

      {/* landlord views the tenant's shared documents in-app, gated by session
          identity — only while the request is approved and within its window */}
      {docsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" data-testid="landlord-docs-modal">
          <div className="w-full max-w-lg rounded-lg bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-semibold text-ink">
                {docsFor.tenantId?.fullName ?? 'Tenant'}’s verified documents
              </h3>
              <button type="button" onClick={closeDocs} aria-label="Close"
                className="rounded p-1 text-lg leading-none text-ink-faint hover:bg-surface-muted">×</button>
            </div>

            {docsState.kind === 'loading' && (
              <p className="mt-4 text-sm text-ink-faint">Loading documents…</p>
            )}
            {docsState.kind === 'ready' && (
              <>
                <p className="mt-1 text-sm text-ink-muted">
                  {docsState.accessType === 'one_time'
                    ? 'One-time view — this will not be available again after you close it.'
                    : `Access expires ${new Date(docsState.expiresAt).toLocaleString()}.`}
                </p>
                <div className="mt-4">
                  <SharedDocumentList documents={docsState.documents} />
                </div>
              </>
            )}
            {docsState.kind === 'gone' && (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="docs-gone">
                {docsState.message}. Send a new verification request to view the documents again.
              </p>
            )}
            {docsState.kind === 'error' && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {docsState.message}
              </p>
            )}

            <button type="button" onClick={closeDocs}
              className="mt-5 w-full rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
              Close
            </button>
          </div>
        </div>
      )}

      {profileFor && (
        <TenantProfileModal
          applicationId={profileFor._id}
          onClose={() => setProfileFor(null)}
        />
      )}

      {/* create-agreement dialog: tenant/property/rent come from the application */}
      {agreementFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" data-testid="agreement-dialog">
          <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
            <h3 className="font-semibold text-ink">Create rental agreement</h3>
            <p className="mt-1 text-sm text-ink-muted">
              For <span className="font-medium">{agreementFor.tenantId?.fullName}</span> at{' '}
              <span className="font-medium">{agreementFor.propertyId?.title}</span>
              {agreementFor.propertyId
                ? ` — Rs. ${agreementFor.propertyId.rent.toLocaleString('en-IN')}/month`
                : ''}
            </p>
            {agrError && <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{agrError}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="agr-start" className={labelClass}>Start date</label>
                <input id="agr-start" type="date" className={inputClass} value={agrForm.startDate}
                  onChange={(e) => setAgrForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="agr-end" className={labelClass}>End date</label>
                <input id="agr-end" type="date" className={inputClass} value={agrForm.endDate}
                  min={agrForm.startDate ? toInputDate(addMonths(agrForm.startDate, MIN_AGREEMENT_MONTHS)) : undefined}
                  max={agrForm.startDate ? toInputDate(addMonths(agrForm.startDate, MAX_AGREEMENT_MONTHS)) : undefined}
                  onChange={(e) => setAgrForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
              <p className="col-span-2 -mt-1 text-xs text-ink-faint">
                Agreement duration must be between 3 and 11 months.
              </p>
              <div className="col-span-2">
                <label htmlFor="agr-deposit" className={labelClass}>Security deposit (Rs., optional)</label>
                <input id="agr-deposit" type="number" min="0" className={inputClass} value={agrForm.deposit}
                  onChange={(e) => setAgrForm((f) => ({ ...f, deposit: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => void createAgreement()} disabled={agrBusy}
                data-testid="submit-agreement"
                className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {agrBusy ? 'Creating…' : 'Create agreement'}
              </button>
              <button type="button" onClick={() => setAgreementFor(null)}
                className="flex-1 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
