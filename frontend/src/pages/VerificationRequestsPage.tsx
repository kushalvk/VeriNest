import { useEffect, useState } from 'react';
import * as verificationApi from '../api/verificationApi';
import { getApiError } from '../api/client';
import type { VerificationRequest } from '../api/verificationApi';

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  expired: 'bg-canvas text-ink-muted border-line',
};

const accessLabel: Record<string, string> = {
  one_time: 'One-time view',
  '24_hours': '24-hour access',
  '7_days': '7-day access',
};

const landlordName = (r: VerificationRequest) =>
  typeof r.landlordId === 'object' && r.landlordId ? r.landlordId.fullName : 'A landlord';

const propertyTitle = (r: VerificationRequest) =>
  typeof r.applicationId === 'object' && r.applicationId?.propertyId
    ? r.applicationId.propertyId.title
    : undefined;

export default function VerificationRequestsPage() {
  const [requests, setRequests] = useState<VerificationRequest[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Raw tokens live ONLY in this component's memory, keyed by request id.
  // They are shown once and are not re-fetchable — by design (backend
  // stores only a hash).
  const [issuedTokens, setIssuedTokens] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    verificationApi
      .getMyVerificationRequests()
      .then(setRequests)
      .catch((err) => setError(getApiError(err)));
  }, []);

  const respond = async (request: VerificationRequest, action: 'approve' | 'reject') => {
    setBusyId(request._id);
    setError('');
    try {
      const result = await verificationApi.respondToVerificationRequest(request._id, action);
      setRequests((list) =>
        (list ?? []).map((r) => (r._id === request._id ? { ...r, status: result.request.status } : r))
      );
      if (action === 'approve' && result.accessToken) {
        setIssuedTokens((t) => ({ ...t, [request._id]: result.accessToken! }));
      }
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (requestId: string, token: string) => {
    const link = `${window.location.origin}/verify/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(requestId);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard may be unavailable — the link is visible for manual copy
    }
  };

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-3xl space-y-4 px-4">
        <h1 className="text-2xl font-bold text-ink">Verification requests</h1>
        <p className="text-sm text-ink-muted">
          Landlords you applied to can request temporary access to your uploaded documents.
          You decide whether to share.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {requests === null && !error && <p className="text-sm text-ink-faint">Loading…</p>}
        {requests?.length === 0 && (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-faint">
            No verification requests yet.
          </p>
        )}
        {requests?.map((req) => (
          <div key={req._id} data-testid="verification-request-card"
            className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-ink">{landlordName(req)}</h3>
              <span data-testid="request-status"
                className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[req.status]}`}>
                {req.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {propertyTitle(req) ? <>For <span className="font-medium">{propertyTitle(req)}</span> · </> : null}
              {accessLabel[req.accessType]}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Requested {new Date(req.createdAt).toLocaleDateString()}
            </p>

            {req.status === 'pending' && (
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <button type="button" data-testid="approve-request"
                  disabled={busyId === req._id}
                  onClick={() => void respond(req, 'approve')}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  Approve &amp; generate link
                </button>
                <button type="button" data-testid="reject-request"
                  disabled={busyId === req._id}
                  onClick={() => void respond(req, 'reject')}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Reject
                </button>
              </div>
            )}

            {issuedTokens[req._id] && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3" data-testid="token-panel">
                <p className="text-sm font-semibold text-amber-900">
                  ⚠️ This access link will not be shown again
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Copy it now and share it securely with the landlord. If it is lost, they will
                  need to send a new request.
                </p>
                <code data-testid="access-link"
                  className="mt-2 block break-all rounded bg-surface px-2 py-1.5 text-xs text-ink">
                  {window.location.origin}/verify/{issuedTokens[req._id]}
                </code>
                <button type="button" data-testid="copy-link"
                  onClick={() => void copyLink(req._id, issuedTokens[req._id])}
                  className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
                  {copied === req._id ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
