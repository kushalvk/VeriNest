import type { TenantDocument } from '../api/documentApi';

const typeLabel = (t: string) => t.replace(/_/g, ' ');

const verificationBadge: Record<TenantDocument['verificationStatus'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  verified: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const ocrLabel: Record<TenantDocument['ocrStatus'], string> = {
  not_started: 'OCR: not started',
  processing: 'OCR: processing…',
  done: 'OCR: done',
  failed: 'OCR: could not read',
};

const isImage = (url?: string) => !!url && !url.toLowerCase().split('?')[0].endsWith('.pdf');

export default function DocumentCard({
  document,
  processing,
}: {
  document: TenantDocument;
  /** true while an OCR request launched from this session is still in flight */
  processing?: boolean;
}) {
  const inFlight = processing || document.ocrStatus === 'processing';
  // Soft signals for admin review — always worded neutrally, never accusatory.
  const flagged = document.fraudDetected || document.duplicateDetected;

  return (
    <div
      data-testid="document-card"
      data-doctype={document.documentType}
      className="flex gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-canvas">
        {isImage(document.cloudinary?.url) ? (
          <img
            src={document.cloudinary?.url}
            alt={`${typeLabel(document.documentType)} document`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-2xl" role="img" aria-label="PDF document">📄</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold capitalize text-ink">
            {typeLabel(document.documentType)}
          </h3>
          <span
            data-testid="verification-badge"
            className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${verificationBadge[document.verificationStatus]}`}
          >
            {document.verificationStatus}
          </span>
          {flagged && (
            <span
              data-testid="flag-badge"
              className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
            >
              Flagged for review
            </span>
          )}
        </div>

        <p data-testid="ocr-status" className="mt-1 text-sm text-ink-faint">
          {inFlight ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
              Processing…
            </span>
          ) : (
            ocrLabel[document.ocrStatus]
          )}
        </p>
        {document.blurryDocument && !inFlight && (
          <p className="mt-1 text-xs text-ink-faint">
            The image may be hard to read — consider re-uploading a clearer copy.
          </p>
        )}
        <p className="mt-1 text-xs text-ink-faint">
          Uploaded {new Date(document.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
