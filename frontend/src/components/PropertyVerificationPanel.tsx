import { useRef, useState } from 'react';
import * as propertyApi from '../api/propertyApi';
import { getApiError } from '../api/client';
import { checkFile } from '../utils/fileValidation';
import { toneClass, verificationBadge } from '../utils/propertyVerification';
import type { Property } from '../api/propertyApi';

interface Props {
    property: Property;
    onChanged: () => void | Promise<void>;
    onNotice: (n: { tone: 'error' | 'success'; message: string }) => void;
}

const MESSAGES = {
    not_submitted: 'Hidden from tenants — upload your house tax bill to get this listing verified.',
    pending: 'Tax bill under review — hidden from tenants until an admin verifies it.',
    rejected: 'Your tax bill was rejected — fix the issue and upload a new bill.',
    verified: 'Verified — visible to tenants. Changing the address sends it back for review.',
} as const;

const BUTTON_LABEL = {
    not_submitted: 'Upload tax bill',
    pending: 'Replace bill',
    rejected: 'Upload new bill',
} as const;

export default function PropertyVerificationPanel({ property, onChanged, onNotice }: Props) {
    const v = property.verification;
    const status = v?.status ?? 'not_submitted';
    const badge = verificationBadge[status];
    const input = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const onPick = async (files: FileList | null) => {
        const file = files?.[0];
        if (!file || status === 'verified') return;
        setError('');
        const problem = checkFile(file); // jpg/png only — same rule as property images
        if (problem) {
            setError(`${file.name}: ${problem}`);
            if (input.current) input.current.value = '';
            return;
        }
        setUploading(true);
        try {
            await propertyApi.uploadTaxBill(property._id, file);
            onNotice({
                tone: 'success',
                message: `Tax bill submitted for "${property.title}". It will appear to tenants once an admin verifies it.`,
            });
            await onChanged();
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setUploading(false);
            if (input.current) input.current.value = '';
        }
    };

    return (
        <div
            data-testid="verification-panel"
            data-status={status}
            className="mt-2 rounded-lg border border-line bg-surface p-3 text-sm"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass[badge.tone]}`}
          >
            {badge.label}
          </span>
                    <span className="text-ink-muted">{MESSAGES[status]}</span>
                </div>

                {status !== 'verified' && (
                    <>
                        <button
                            type="button"
                            onClick={() => input.current?.click()}
                            disabled={uploading}
                            data-testid="upload-tax-bill"
                            className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                            {uploading ? 'Uploading & scanning…' : BUTTON_LABEL[status]}
                        </button>
                        <input
                            ref={input}
                            type="file"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            data-testid="tax-bill-reupload-input"
                            onChange={(e) => void onPick(e.target.files)}
                        />
                    </>
                )}
            </div>

            {status === 'rejected' && v?.rejectionReason && (
                <p
                    data-testid="rejection-reason"
                    className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700"
                >
                    Reason: {v.rejectionReason}
                </p>
            )}

            {status !== 'verified' && v?.taxBill?.url && (
                <p className="mt-2 text-xs text-ink-faint">
                    Submitted{' '}
                    {v.taxBill.uploadedAt ? new Date(v.taxBill.uploadedAt).toLocaleDateString() : ''} ·{' '}
                    <a
                        href={v.taxBill.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary-600 hover:underline"
                    >
                        View uploaded bill
                    </a>
                </p>
            )}

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
    );
}