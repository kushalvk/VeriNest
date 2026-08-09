import { useState } from 'react';
import { Building2, Copy, Check, PlayCircle, ShieldCheck, User } from 'lucide-react';
import type { DemoAccount } from '../api/authApi';

const roleIcon = {
  tenant: User,
  landlord: Building2,
} as const;

/** Small copy-to-clipboard chip for a credential value. */
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied (or insecure context) — the value is
      // visible on screen anyway, so there is nothing to recover from.
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <span className="shrink-0 text-ink-faint">{label}</span>
      <code className="truncate rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label} ${value}`}
        className="shrink-0 rounded p-0.5 text-ink-faint transition hover:bg-surface hover:text-ink"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

interface Props {
  accounts: DemoAccount[];
  /** Fills the login form with this account and signs in — owned by LoginPage. */
  onUseAccount: (account: DemoAccount) => void | Promise<void>;
  /** Email of the account currently signing in, or '' when none. */
  busyEmail: string;
  /** True while any sign-in (form or demo) is in flight. */
  disabled: boolean;
}

/**
 * The "explore without an account" column beside the login form.
 *
 * Choosing an account autofills the real email/password fields in the form and
 * submits them through the ordinary login flow — a demo account is a real
 * account, so every feature behaves exactly as it does for a real user. The
 * backend resets the demo workspace on each of these sign-ins, so nothing a
 * visitor does here sticks around.
 */
export default function DemoLoginPanel({
  accounts,
  onUseAccount,
  busyEmail,
  disabled,
}: Props) {
  if (accounts.length === 0) return null;

  return (
    <section
      data-testid="demo-login-panel"
      aria-labelledby="demo-login-heading"
      className="flex h-full flex-col rounded-lg border border-line-strong bg-surface-muted/40 p-6 shadow-card"
    >
      <div className="flex items-start gap-2.5">
        <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" />
        <div>
          <h2 id="demo-login-heading" className="text-lg font-bold text-ink">
            Try VeriNest with a demo account
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            No signup needed. Pick a role and we'll fill in the form and log you straight in.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {accounts.map((account) => {
          const Icon = roleIcon[account.role] ?? User;
          const busy = busyEmail === account.email;
          return (
            <div
              key={account.email}
              className="rounded-lg border border-line-strong bg-surface p-4 transition hover:border-primary-300 dark:hover:border-primary-500/50"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
                <span className="text-sm font-semibold text-ink">{account.label}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{account.description}</p>

              <div className="mt-3 space-y-1">
                <CopyField label="Email" value={account.email} />
                <CopyField label="Password" value={account.password} />
              </div>

              <button
                type="button"
                data-testid={`demo-login-${account.role}`}
                onClick={() => void onUseAccount(account)}
                disabled={disabled}
                className="mt-3 w-full rounded-md border border-primary-600 px-3 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-500 dark:text-primary-300 dark:hover:bg-primary-500/10"
              >
                {busy
                  ? 'Filling in and signing you in…'
                  : `Enter as ${account.label.replace('Demo ', '')}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* mt-auto keeps the note on the bottom edge if this column is the
          shorter one and gets stretched to match the login card. */}
      <p className="mt-auto flex items-start gap-1.5 pt-4 text-xs text-ink-faint">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Shared guest logins — everything you change is reset the next time someone signs in
          with them. Please don't upload anything real.
        </span>
      </p>
    </section>
  );
}
