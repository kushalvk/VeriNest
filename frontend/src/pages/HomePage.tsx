import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const features = [
  {
    icon: '🛡️',
    title: 'Verified documents',
    text: 'Tenants upload identity and income documents once; our review pipeline (with OCR and fraud checks) verifies them so landlords don’t have to.',
  },
  {
    icon: '⭐',
    title: 'Transparent trust scores',
    text: 'A deterministic, explainable score built from verified documents, profile completeness, and real rental ratings — no black boxes.',
  },
  {
    icon: '✍️',
    title: 'Digital agreements',
    text: 'Generate the rental agreement, sign it digitally from any device, and get a stamped PDF the moment both parties have signed.',
  },
];

const steps = [
  { n: '1', title: 'Build your profile', text: 'Register, verify your email, and complete your tenant or landlord profile.' },
  { n: '2', title: 'Apply & verify', text: 'Tenants apply to listings; landlords request time-limited access to verified documents.' },
  { n: '3', title: 'Sign & move in', text: 'Sign the agreement digitally and rate each other when the tenancy completes.' },
];

export default function HomePage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <main>
      {/* hero */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              Digital tenant verification
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Renting, without the leap of faith.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-primary-100">
              VeriNest verifies tenant documents, computes transparent trust scores, and
              handles digitally signed rental agreements — so tenants and landlords can
              trust each other before the keys change hands.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {/* fixed white — sits on the brand gradient in both themes */}
              <Link to="/properties" data-testid="hero-browse"
                className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-primary-700 shadow-card transition hover:bg-primary-50">
                Browse properties
              </Link>
              {isAuthenticated ? (
                <Link to="/dashboard"
                  className="rounded-md border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Go to dashboard
                </Link>
              ) : (
                <Link to="/register" data-testid="hero-signup"
                  className="rounded-md border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Get started — it’s free
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-ink">Why VeriNest</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg bg-surface p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-2xl dark:bg-primary-500/15">
                {f.icon}
              </span>
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-ink">How it works</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* closing CTA */}
      {!isAuthenticated && (
        <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-ink">Ready to rent with confidence?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted">
            Create a free account as a tenant or landlord and see the difference verified
            renting makes.
          </p>
          <Link to="/register"
            className="mt-6 inline-block rounded-md bg-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700">
            Create your account
          </Link>
        </section>
      )}
    </main>
  );
}
