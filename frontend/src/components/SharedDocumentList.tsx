import type { SharedDocument } from '../api/verificationApi';

const verificationBadge: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  verified: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

/**
 * Renders a tenant's shared verification documents (type + status + a "View"
 * link to the file). Shared by the public token page (VerificationAccessPage)
 * and the landlord's in-app access modal so both stay identical.
 */
export default function SharedDocumentList({ documents }: { documents: SharedDocument[] }) {
  if (documents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-faint">
        The tenant hasn’t uploaded any documents yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc, i) => (
        <div key={i} data-testid="shared-document"
          className="flex items-center justify-between rounded-lg border border-line bg-surface p-4">
          <div>
            <p className="font-medium capitalize text-ink">
              {doc.documentType.replace(/_/g, ' ')}
            </p>
            <span
              className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${verificationBadge[doc.verificationStatus]}`}>
              {doc.verificationStatus}
            </span>
          </div>
          {doc.url && (
            <a href={doc.url} target="_blank" rel="noreferrer"
              className="rounded-md border border-primary-300 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50">
              View
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
