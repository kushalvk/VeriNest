import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as applicationApi from '../api/applicationApi';
import * as agreementApi from '../api/agreementApi';
import { getApiError } from '../api/client';
import VerificationRequestModal from '../components/VerificationRequestModal';
import TenantProfileModal from '../components/TenantProfileModal';
import { trustScoreColor } from '../utils/trustScore';
import { inputClass, labelClass } from '../components/AuthCard';
import type { ReceivedApplication } from '../api/applicationApi';

// Rental agreements must run 3–11 months (mirrors the server-side rule).
const MIN_AGREEMENT_MONTHS = 3;
const MAX_AGREEMENT_MONTHS = 11;

const addMonths = (isoDate: string, months: number) => {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d;
};

const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

const allDocsVerified = (app: ReceivedApplication) =>
  !!app.tenantMeta &&
  app.tenantMeta.documentsTotal > 0 &&
  app.tenantMeta.documentsVerified === app.tenantMeta.documentsTotal;

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
  }, []);

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
                  {allDocsVerified(app) ? (
                    <span data-testid="verification-done"
                      className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                      ✓ Documents verified — no request needed
                    </span>
                  ) : (
                    <button type="button" data-testid="request-verification"
                      onClick={() => setVerifyFor(app)}
                      className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                      Request document verification
                    </button>
                  )}
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
          onClose={() => setVerifyFor(null)}
        />
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
