import { useState } from 'react';
import * as verificationApi from '../api/verificationApi';
import { getApiError } from '../api/client';
import { inputClass, labelClass } from './AuthCard';
import type { AccessType } from '../api/verificationApi';

const ACCESS_OPTIONS: Array<{ value: AccessType; label: string; hint: string }> = [
  { value: 'one_time', label: 'One-time view', hint: 'Link works for a single viewing, then expires.' },
  { value: '24_hours', label: '24 hours', hint: 'Unlimited views for one day.' },
  { value: '7_days', label: '7 days', hint: 'Unlimited views for one week.' },
];

interface Props {
  applicationId: string;
  tenantName?: string;
  onClose: () => void;
}

export default function VerificationRequestModal({ applicationId, tenantName, onClose }: Props) {
  const [accessType, setAccessType] = useState<AccessType>('one_time');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await verificationApi.createVerificationRequest(applicationId, accessType);
      setSent(true);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" data-testid="verification-modal">
      <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
        {sent ? (
          <div className="text-center" data-testid="verification-sent">
            <p className="text-4xl">📨</p>
            <h3 className="mt-3 font-semibold text-ink">Request sent</h3>
            <p className="mt-1 text-sm text-ink-muted">
              {tenantName ?? 'The tenant'} will be notified. Once they approve, they will share a
              secure access link with you.
            </p>
            <button type="button" onClick={onClose}
              className="mt-4 w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-ink">Request document verification</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Ask {tenantName ?? 'the tenant'} for temporary access to their verified documents.
            </p>
            {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <label htmlFor="accessType" className={`${labelClass} mt-4`}>Access duration</label>
            <select id="accessType" className={inputClass} value={accessType}
              onChange={(e) => setAccessType(e.target.value as AccessType)}>
              {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-ink-faint">
              {ACCESS_OPTIONS.find((o) => o.value === accessType)?.hint}
            </p>

            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => void submit()} disabled={submitting}
                data-testid="verification-submit"
                className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {submitting ? 'Sending…' : 'Send request'}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
