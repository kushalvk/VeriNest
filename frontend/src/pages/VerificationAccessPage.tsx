import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import * as verificationApi from '../api/verificationApi';
import SharedDocumentList from '../components/SharedDocumentList';
import type { AccessType, SharedDocument } from '../api/verificationApi';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; documents: SharedDocument[]; accessType: AccessType; expiresAt: string }
  | { kind: 'used' }      // 410 — one-time link already viewed
  | { kind: 'expired' }   // 410 — time window over
  | { kind: 'invalid' }   // 404/403 — unknown or not-granted token
  | { kind: 'error'; message: string };

// Single-flight per token: accessing a one-time link CONSUMES it, so the
// fetch must never fire twice for the same token in one session (React
// StrictMode double-runs effects in dev, which would burn the link on the
// first of the two calls). Both effect invocations share one promise.
const accessOnce = new Map<string, ReturnType<typeof verificationApi.accessDocumentsByToken>>();
const fetchAccess = (token: string) => {
  if (!accessOnce.has(token)) {
    accessOnce.set(token, verificationApi.accessDocumentsByToken(token));
  }
  return accessOnce.get(token)!;
};

export default function VerificationAccessPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    if (!token) { setState({ kind: 'invalid' }); return; }
    let cancelled = false;
    fetchAccess(token)
      .then((data) => {
        if (!cancelled) setState({ kind: 'ready', ...data });
      })
      .catch((err) => {
        if (cancelled) return;
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const message = (err.response?.data as { error?: string })?.error ?? '';
          if (status === 410 && /already used/i.test(message)) return setState({ kind: 'used' });
          if (status === 410) return setState({ kind: 'expired' });
          if (status === 404 || status === 403) return setState({ kind: 'invalid' });
        }
        setState({ kind: 'error', message: 'Could not load this link. Please try again.' });
      });
    return () => { cancelled = true; };
  }, [token]);

  const shell = (content: React.ReactNode) => (
    <main className="pb-16">
      <div className="mx-auto mt-10 max-w-2xl px-4">{content}</div>
    </main>
  );

  if (state.kind === 'loading') {
    return shell(<p className="text-center text-ink-faint">Checking access link…</p>);
  }

  if (state.kind === 'used' || state.kind === 'expired' || state.kind === 'invalid' || state.kind === 'error') {
    const copy = {
      used: { icon: '🔒', title: 'Access already used', body: 'This was a one-time link and it has already been viewed. Ask the tenant to approve a new request if you need access again.' },
      expired: { icon: '⌛', title: 'Access expired', body: 'This link’s access window has ended. Ask the tenant to approve a new request.' },
      invalid: { icon: '🚫', title: 'Invalid or expired link', body: 'This link is not valid. Check that it was copied completely, or request access again.' },
      error: { icon: '⚠️', title: 'Something went wrong', body: state.kind === 'error' ? state.message : '' },
    }[state.kind];
    return shell(
      <div className="rounded-lg border border-line bg-surface p-8 text-center" data-testid={`access-${state.kind}`}>
        <p className="text-5xl">{copy.icon}</p>
        <h1 className="mt-4 text-xl font-bold text-ink">{copy.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{copy.body}</p>
      </div>
    );
  }

  return shell(
    <div data-testid="access-ready">
      <h1 className="text-2xl font-bold text-ink">Shared verification documents</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {state.accessType === 'one_time'
          ? 'One-time view — this link will not work again after you leave.'
          : `Access expires ${new Date(state.expiresAt).toLocaleString()}.`}
      </p>

      <div className="mt-6">
        <SharedDocumentList documents={state.documents} />
      </div>
    </div>
  );
}
