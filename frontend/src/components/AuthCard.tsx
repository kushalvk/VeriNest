import type { ReactNode } from 'react';
import { AuthBackdrop } from './Imagery';
import type { Photo } from '../assets/photos';

/**
 * The centred card every auth page sits in.
 *
 * Pass `aside` to get a two-column layout instead: the aside on the left, the
 * card on the right. Grid items stretch, so both columns end up exactly as
 * tall as the taller one whichever that happens to be — the card's content is
 * centred in the leftover space (`my-auto`) rather than sitting against the
 * top edge. Below `lg` they stack with the card FIRST: signing in stays the
 * primary action on a phone. Without `aside` this is the original single
 * narrow card, unchanged for the other auth pages.
 *
 * Pass `backdrop` to wash a muted photo behind the whole page. It works with
 * either layout — including the login page, whose left column is already spoken
 * for by the demo-account panel — because it sits behind everything rather than
 * claiming a column. `min-h` gives it a full-height canvas to fade across
 * instead of a short band hugging the card, and `isolate` keeps its negative
 * z-index inside this main.
 */
export function AuthCard({
  title,
  children,
  aside,
  backdrop,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  backdrop?: Photo;
}) {
  const heading = <h1 className="mb-6 text-center text-2xl font-bold text-ink">{title}</h1>;
  const shell = `relative isolate px-4 py-16 ${backdrop ? 'min-h-[36rem]' : ''}`;

  if (!aside) {
    return (
      <main className={`${shell} flex items-center justify-center`}>
        {backdrop && <AuthBackdrop photo={backdrop} />}
        <div className="w-full max-w-md rounded-lg bg-surface p-8 shadow-card">
          {heading}
          {children}
        </div>
      </main>
    );
  }

  return (
    <main className={`${shell} flex justify-center`}>
      {backdrop && <AuthBackdrop photo={backdrop} />}
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="order-2 lg:order-1">{aside}</div>
        <div className="order-1 mx-auto w-full max-w-md lg:order-2 lg:max-w-none">
          <div className="flex h-full w-full flex-col rounded-lg bg-surface p-8 shadow-card">
            {/* my-auto centres the form once the aside makes this column taller */}
            <div className="my-auto">
              {heading}
              {children}
            </div>
          </div>
        </div>
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
