import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as agreementApi from '../api/agreementApi';
import { getApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import SignatureCapture from '../components/SignatureCapture';
import type { Agreement } from '../api/agreementApi';

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function SignSlot({ label, signed }: { label: string; signed: boolean }) {
  return (
    <div data-testid={`slot-${label.toLowerCase()}`} data-signed={signed}
      className={`flex-1 rounded-lg border p-4 text-center ${
        signed ? 'border-green-200 bg-green-50' : 'border-line bg-surface'
      }`}>
      <p className="text-2xl">{signed ? '✅' : '🖊️'}</p>
      <p className="mt-1 text-sm font-medium text-ink">{label}</p>
      <p className={`text-xs ${signed ? 'text-green-700' : 'text-ink-faint'}`}>
        {signed ? 'Signed' : 'Awaiting signature'}
      </p>
    </div>
  );
}

export default function AgreementPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [error, setError] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  useEffect(() => {
    if (!id) return;
    agreementApi
      .getAgreement(id)
      .then(setAgreement)
      .catch((err) => setError(getApiError(err)));
  }, [id]);

  const party: 'tenant' | 'landlord' | null = agreement && user
    ? agreement.tenantId === user._id ? 'tenant'
      : agreement.landlordId === user._id ? 'landlord' : null
    : null;

  const alreadySigned = party === 'tenant' ? agreement?.tenantSigned : agreement?.landlordSigned;
  const canSign = agreement?.status === 'draft' && party !== null && !alreadySigned;

  const doSign = async () => {
    if (!agreement || !signature || signing) return;
    setSigning(true);
    setSignError('');
    try {
      const updated = await agreementApi.signAgreement(agreement._id, signature);
      setAgreement(updated);
      setSignature(null);
    } catch (err) {
      setSignError(getApiError(err));
    } finally {
      setSigning(false);
    }
  };

  if (error) {
    return <main className="p-10 text-center text-red-600">{error}</main>;
  }
  if (!agreement) {
    return <main className="p-10 text-center text-ink-faint">Loading agreement…</main>;
  }

  const property = typeof agreement.propertyId === 'object' ? agreement.propertyId : null;

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-2xl space-y-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-ink">Rental agreement</h1>
            <p className="text-sm text-ink-faint">{agreement.agreementNumber}</p>
          </div>
          {agreement.status === 'active' ? (
            <span data-testid="agreement-active"
              className="rounded-full border border-green-300 bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
              🎉 Agreement Active
            </span>
          ) : (
            <span data-testid="agreement-status"
              className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-sm font-medium capitalize text-yellow-800">
              {agreement.status === 'draft' ? 'Awaiting signatures' : agreement.status}
            </span>
          )}
        </div>

        <section className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface p-5 sm:grid-cols-4">
          <div className="col-span-2">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Property</p>
            <p className="mt-0.5 font-medium text-ink">
              {property ? property.title : '—'}
              {property?.address?.city ? `, ${property.address.city}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Rent</p>
            <p className="mt-0.5 font-medium text-ink" data-testid="agreement-rent">
              Rs. {agreement.monthlyRent.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Deposit</p>
            <p className="mt-0.5 font-medium text-ink">
              {agreement.deposit != null ? `Rs. ${agreement.deposit.toLocaleString('en-IN')}` : '—'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Term</p>
            <p className="mt-0.5 font-medium text-ink">
              {fmtDate(agreement.startDate)} → {fmtDate(agreement.endDate)}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Document</p>
            {agreement.agreementPdf?.url ? (
              <a href={agreement.agreementPdf.url} target="_blank" rel="noreferrer"
                data-testid="agreement-pdf"
                className="mt-0.5 inline-block font-medium text-primary-600 hover:underline">
                View / download PDF ↗
              </a>
            ) : <p className="mt-0.5 text-ink-faint">Not generated</p>}
          </div>
        </section>

        <section className="flex gap-4">
          <SignSlot label="Tenant" signed={agreement.tenantSigned} />
          <SignSlot label="Landlord" signed={agreement.landlordSigned} />
        </section>

        {/* the viewer only ever sees THEIR OWN signing slot */}
        {canSign && (
          <section className="rounded-lg border border-line bg-surface p-5" data-testid="sign-section">
            <h2 className="font-semibold text-ink">
              Sign as {party === 'tenant' ? 'tenant' : 'landlord'}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Your signature will be stamped into the agreement PDF. This is a visual signature,
              recorded with a timestamp.
            </p>
            <div className="mt-4">
              {signature ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-faint">Your signature</p>
                  <img src={signature} alt="Your signature"
                    className="mt-1 h-24 rounded-md border border-line bg-white" />
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => void doSign()} disabled={signing}
                      data-testid="sign-agreement"
                      className="rounded-md bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                      {signing ? 'Signing…' : 'Sign agreement'}
                    </button>
                    <button type="button" onClick={() => setSignature(null)} disabled={signing}
                      className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                      Redraw
                    </button>
                  </div>
                </div>
              ) : (
                <SignatureCapture onConfirm={setSignature} />
              )}
              {signError && <p className="mt-2 text-sm text-red-600">{signError}</p>}
            </div>
          </section>
        )}

        {agreement.status === 'draft' && alreadySigned && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"
            data-testid="waiting-other-party">
            You’ve signed. Waiting for the other party to sign — the agreement becomes active
            once both signatures are in.
          </p>
        )}
      </div>
    </main>
  );
}
