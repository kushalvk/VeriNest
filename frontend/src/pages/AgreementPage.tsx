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
      <p className="mt-1 text-sm font-medium text-black">{label}</p>
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
  const [downloading, setDownloading] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [loadingView, setLoadingView] = useState(false);

  // Cloudinary serves raw assets as a download, not inline — so both viewing
  // and downloading go through a blob typed application/pdf: the browser can
  // render that in its own PDF viewer, and saves keep the .pdf name.
  const fetchPdfBlobUrl = async () => {
    if (!agreement?.agreementPdf?.url) throw new Error('No PDF');
    const res = await fetch(agreement.agreementPdf.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  };

  const viewPdf = async () => {
    if (loadingView || viewUrl) return;
    setLoadingView(true);
    try {
      setViewUrl(await fetchPdfBlobUrl());
    } catch {
      if (agreement?.agreementPdf?.url) {
        window.open(agreement.agreementPdf.url, '_blank', 'noreferrer');
      }
    } finally {
      setLoadingView(false);
    }
  };

  const closeViewer = () => setViewUrl(null);

  // Revoke the blob URL only AFTER the viewer is gone (cleanup), and let
  // Escape close it. Revoking inside the click handler can race the iframe.
  useEffect(() => {
    if (!viewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewUrl(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      URL.revokeObjectURL(viewUrl);
    };
  }, [viewUrl]);

  const downloadPdf = async () => {
    if (!agreement?.agreementPdf?.url || downloading) return;
    setDownloading(true);
    try {
      const href = await fetchPdfBlobUrl();
      const link = document.createElement('a');
      link.href = href;
      link.download = `${agreement.agreementNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch {
      // fall back to opening the raw URL in a new tab
      window.open(agreement.agreementPdf.url, '_blank', 'noreferrer');
    } finally {
      setDownloading(false);
    }
  };

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
              <div className="mt-0.5 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void viewPdf()} disabled={loadingView}
                  data-testid="agreement-pdf"
                  className="inline-block font-medium text-primary-600 hover:underline disabled:opacity-50">
                  {loadingView ? 'Opening…' : 'View 👁'}
                </button>
                <button type="button" onClick={() => void downloadPdf()} disabled={downloading}
                  data-testid="download-agreement-pdf"
                  className="inline-block font-medium text-primary-600 hover:underline disabled:opacity-50">
                  {downloading ? 'Downloading…' : 'Download PDF ⬇'}
                </button>
              </div>
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

      {/* in-page PDF viewer — closes via ✕, backdrop click, or Escape */}
      {viewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6"
          data-testid="pdf-viewer-modal"
          onClick={(e) => { if (e.target === e.currentTarget) closeViewer(); }}>
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-surface shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
              <h3 className="truncate text-sm font-semibold text-ink">
                Agreement {agreement.agreementNumber}
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => void downloadPdf()} disabled={downloading}
                  className="rounded-md px-2 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50">
                  {downloading ? 'Downloading…' : 'Download ⬇'}
                </button>
                <button type="button" onClick={closeViewer} data-testid="close-pdf-viewer"
                  className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                  Close ✕
                </button>
              </div>
            </div>
            <iframe src={viewUrl} title="Agreement PDF" className="min-h-0 w-full flex-1 bg-canvas" />
          </div>
        </div>
      )}
    </main>
  );
}
