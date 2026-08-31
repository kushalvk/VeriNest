import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
} from 'lucide-react';
import { PhotoBand } from '../components/Imagery';
import { photos } from '../assets/photos';

const features = [
  {
    number: '01',
    icon: ShieldCheck,
    title: 'Verified documents',
    shortTitle: 'Trust starts with verification',
    text: 'Tenants upload identity and income documents once. Our review pipeline helps verify them so landlords can make decisions with greater confidence.',
    photo: photos.featureDocuments,
    tag: 'DOCUMENT VERIFICATION',
  },
  {
    number: '02',
    icon: Star,
    title: 'Transparent trust scores',
    shortTitle: 'Know who you are dealing with',
    text: 'A deterministic and explainable score built from verified documents, profile completeness, and real rental ratings — no black boxes.',
    photo: photos.featureTrust,
    tag: 'TRUST SCORE',
  },
  {
    number: '03',
    icon: FileCheck2,
    title: 'Digital agreements',
    shortTitle: 'From approval to agreement',
    text: 'Generate rental agreements, sign them digitally from any device, and keep the completed document available to both parties.',
    photo: photos.featureAgreement,
    tag: 'DIGITAL AGREEMENT',
  },
];

const steps = [
  {
    n: '01',
    icon: UserCheck,
    title: 'Build your profile',
    text: 'Register, verify your email, and complete your tenant or landlord profile.',
  },
  {
    n: '02',
    icon: BadgeCheck,
    title: 'Apply & verify',
    text: 'Tenants apply to listings while landlords request controlled access to verified documents.',
  },
  {
    n: '03',
    icon: KeyRound,
    title: 'Sign & move in',
    text: 'Sign the agreement digitally and rate each other when the tenancy is complete.',
  },
];

export default function HomePage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
      <main className="overflow-hidden bg-slate-50 dark:bg-slate-950">

        {/* =========================================================
          HERO
      ========================================================= */}
        <section className="relative isolate">

          <PhotoBand photo={photos.home} scrim="hero" eager>
            <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">

              <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">

                {/* Hero content */}
                <div className="max-w-3xl">

                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-md">
                    <Sparkles className="h-4 w-4 text-yellow-300" />
                    Digital tenant verification
                  </div>

                  <h1 className="mt-7 text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
                    Renting,
                    <br />
                    <span className="bg-gradient-to-r from-white via-primary-100 to-indigo-200 bg-clip-text text-transparent">
                    without the leap
                  </span>
                    <br />
                    of faith.
                  </h1>

                  <p className="mt-7 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                    VeriNest verifies tenant documents, creates transparent trust
                    scores, and simplifies rental agreements — helping tenants
                    and landlords build confidence before the keys change hands.
                  </p>

                  <div className="mt-9 flex flex-wrap gap-3">

                    <Link
                        to="/properties"
                        data-testid="hero-browse"
                        className="group inline-flex items-center rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-primary-700 shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:bg-primary-50"
                    >
                      Browse properties

                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>

                    {isAuthenticated ? (
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/20"
                        >
                          Go to dashboard
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    ) : (
                        <Link
                            to="/register"
                            data-testid="hero-signup"
                            className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/20"
                        >
                          Get started — it's free
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    )}

                  </div>

                  {/* Trust points */}
                  <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/80">

                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    Verified profiles
                  </span>

                    <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    Explainable scores
                  </span>

                    <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    Digital agreements
                  </span>

                  </div>
                </div>

                {/* Floating visual card */}
                <div className="relative hidden min-h-[430px] lg:block">

                  <div className="absolute right-0 top-8 w-[360px] rotate-2 rounded-3xl border border-white/20 bg-white/10 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl">

                    <div className="rounded-2xl bg-slate-950/70 p-5">

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Tenant profile
                          </p>

                          <p className="mt-1 text-lg font-bold text-white">
                            Verified applicant
                          </p>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                          <BadgeCheck className="h-6 w-6" />
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl bg-white/5 p-4">

                        <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">
                          Trust score
                        </span>

                          <span className="text-2xl font-black text-white">
                          92
                        </span>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">

                          <div className="rounded-xl bg-white/5 p-3">
                            <p className="text-lg font-bold text-white">3</p>
                            <p className="text-[10px] uppercase text-slate-500">
                              Docs
                            </p>
                          </div>

                          <div className="rounded-xl bg-white/5 p-3">
                            <p className="text-lg font-bold text-white">✓</p>
                            <p className="text-[10px] uppercase text-slate-500">
                              Profile
                            </p>
                          </div>

                          <div className="rounded-xl bg-white/5 p-3">
                            <p className="text-lg font-bold text-white">4.9</p>
                            <p className="text-[10px] uppercase text-slate-500">
                              Rating
                            </p>
                          </div>

                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">

                        <ShieldCheck className="h-5 w-5 text-emerald-300" />

                        <div>
                          <p className="text-xs font-bold text-emerald-200">
                            Verification complete
                          </p>

                          <p className="text-[11px] text-emerald-300/70">
                            Documents reviewed successfully
                          </p>
                        </div>

                      </div>

                    </div>
                  </div>

                  {/* Floating mini card */}
                  <div className="absolute bottom-12 left-0 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-xl backdrop-blur-xl">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300">
                      <ShieldCheck className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-white">
                        Secure verification
                      </p>

                      <p className="text-[11px] text-white/60">
                        Built for trusted renting
                      </p>
                    </div>

                  </div>

                </div>
              </div>
            </div>
          </PhotoBand>

          {/* Hero bottom fade */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-950" />
        </section>


        {/* =========================================================
          FEATURES
      ========================================================= */}
        <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">

          <div className="mx-auto max-w-2xl text-center">

            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400">
              Why VeriNest
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              A smarter way to rent
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-500 dark:text-slate-400">
              We bring verification, transparency and agreements into one
              connected rental experience.
            </p>

          </div>


          <div className="mt-16 space-y-20">

            {features.map((feature, index) => {
              const Icon = feature.icon;
              const reversed = index % 2 !== 0;

              return (
                  <div
                      key={feature.title}
                      className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-20 ${
                          reversed ? 'lg:[&>*:first-child]:order-2' : ''
                      }`}
                  >

                    {/* Image */}
                    <div className="group relative">

                      <div className="absolute -inset-4 rounded-[2rem] bg-primary-500/5 blur-2xl transition duration-500 group-hover:bg-primary-500/10" />

                      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-2 shadow-[0_20px_60px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-slate-900">

                        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem]">

                          <img
                              src={feature.photo.src}
                              srcSet={feature.photo.srcSet}
                              alt=""
                              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                          />

                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

                          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">

                        <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white backdrop-blur-md">
                          {feature.tag}
                        </span>

                            <span className="text-5xl font-black text-white/20">
                          {feature.number}
                        </span>

                          </div>

                        </div>
                      </div>
                    </div>


                    {/* Content */}
                    <div className="max-w-xl">

                      <div className="flex items-center gap-4">

                    <span className="text-sm font-black tracking-wider text-primary-500">
                      {feature.number}
                    </span>

                        <div className="h-px w-12 bg-primary-200 dark:bg-primary-500/30" />

                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {feature.tag}
                    </span>

                      </div>

                      <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-indigo-100 text-primary-600 shadow-sm ring-1 ring-primary-100 dark:from-primary-500/15 dark:to-indigo-500/15 dark:text-primary-300 dark:ring-primary-500/20">
                        <Icon className="h-7 w-7" />
                      </div>

                      <h3 className="mt-6 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                        {feature.shortTitle}
                      </h3>

                      <p className="mt-5 text-base leading-8 text-slate-500 dark:text-slate-400">
                        {feature.text}
                      </p>

                      <div className="mt-7 flex items-center gap-2 text-sm font-bold text-primary-600 dark:text-primary-400">
                        Built for trustworthy renting
                        <ArrowRight className="h-4 w-4" />
                      </div>

                    </div>

                  </div>
              );
            })}

          </div>
        </section>


        {/* =========================================================
          HOW IT WORKS
      ========================================================= */}
        <section className="relative overflow-hidden border-y border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">

          <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-500/5 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">

            <div className="mx-auto max-w-2xl text-center">

              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400">
                Simple process
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                How it works
              </h2>

              <p className="mt-4 text-slate-500 dark:text-slate-400">
                Three simple steps from profile to keys.
              </p>

            </div>


            <div className="relative mt-16 grid gap-8 md:grid-cols-3">

              {/* Connecting line */}
              <div className="absolute left-[16.66%] right-[16.66%] top-10 hidden h-px bg-gradient-to-r from-primary-200 via-primary-400 to-primary-200 md:block dark:from-primary-500/10 dark:via-primary-500/40 dark:to-primary-500/10" />

              {steps.map((step) => {
                const Icon = step.icon;

                return (
                    <div
                        key={step.n}
                        className="group relative rounded-3xl border border-slate-200/80 bg-slate-50 p-7 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.03]"
                    >

                      <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-lg ring-1 ring-slate-200 transition-transform duration-300 group-hover:scale-105 dark:bg-slate-800 dark:ring-white/10">

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-700 text-white shadow-lg">
                          <Icon className="h-6 w-6" />
                        </div>

                      </div>

                      <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400">
                        Step {step.n}
                      </p>

                      <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                        {step.title}
                      </h3>

                      <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {step.text}
                      </p>

                    </div>
                );
              })}

            </div>
          </div>
        </section>


        {/* =========================================================
          TRUST BANNER
      ========================================================= */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">

          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-primary-950 to-indigo-950 p-8 shadow-[0_25px_70px_rgba(15,23,42,0.2)] sm:p-12">

            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

            <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">

              <div>

                <div className="flex items-center gap-2 text-primary-300">
                  <ShieldCheck className="h-5 w-5" />

                  <span className="text-xs font-black uppercase tracking-[0.18em]">
                  Built around trust
                </span>
                </div>

                <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Less uncertainty.
                  <br />
                  More confident renting.
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  From document verification to digital agreements, VeriNest
                  brings the important parts of renting into one transparent
                  experience.
                </p>

              </div>

              <div className="flex shrink-0 items-center justify-center">

                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-inner backdrop-blur-md">

                  <ShieldCheck className="h-8 w-8 text-emerald-300" />

                  <p className="mt-2 text-xs font-bold text-white">
                    Trust first
                  </p>

                </div>

              </div>

            </div>

          </div>
        </section>


        {/* =========================================================
          CLOSING CTA
      ========================================================= */}
        {!isAuthenticated && (
            <section className="relative overflow-hidden">

              <PhotoBand photo={photos.homeCta}>

                <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:py-32">

                  <div className="mx-auto max-w-3xl">

                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                  <Sparkles className="h-4 w-4" />
                  Start your journey
                </span>

                    <h2 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">
                      Ready to rent with confidence?
                    </h2>

                    <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-200">
                      Create a free account as a tenant or landlord and experience
                      a more transparent way to rent.
                    </p>

                    <Link
                        to="/register"
                        className="group mt-8 inline-flex items-center rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-primary-700 shadow-[0_15px_40px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:bg-primary-50"
                    >
                      Create your account

                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>

                    <p className="mt-5 text-xs text-white/60">
                      Free to get started · Built for tenants and landlords
                    </p>

                  </div>

                </div>

              </PhotoBand>

            </section>
        )}

      </main>
  );
}