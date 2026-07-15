import type { ReactNode } from 'react';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-lg bg-surface p-8 shadow-card">
        <h1 className="mb-6 text-center text-2xl font-bold text-ink">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}

export function FormAlert({ message, tone }: { message: string; tone: 'error' | 'success' }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-green-200 bg-green-50 text-green-700';
  return (
    <div role="alert" className={`mb-4 rounded-md border px-3 py-2 text-sm ${styles}`}>
      {message}
    </div>
  );
}

export const inputClass =
  'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

export const labelClass = 'mb-1 block text-sm font-medium text-ink-muted';

export const buttonClass =
  'w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50';
