import { Link } from 'react-router-dom';
import {
  AtSign,
  Globe,
  Mail,
  MessageCircle,
  ArrowRight,
  BadgeCheck,
  ShieldCheck,
  FileCheck2,
  KeyRound,
} from 'lucide-react';

const exploreLinks = [
  { to: '/', label: 'Home' },
  { to: '/properties', label: 'Properties' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/contact', label: 'Contact' },
];

const legalLinks = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
];

const socialLinks = [
  { label: 'social media', Icon: AtSign },
  { label: 'community chat', Icon: MessageCircle },
  { label: 'the web', Icon: Globe },
];

export default function Footer() {
  return (
      <footer
          className="relative overflow-hidden border-t border-line bg-surface text-ink transition-colors duration-300"
          data-testid="site-footer"
      >

        {/* =========================================================
          DECORATIVE BACKGROUND
      ========================================================== */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">

          <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-primary-500/5 blur-3xl dark:bg-primary-500/10" />

          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl dark:bg-indigo-500/10" />

          <div className="absolute inset-0 bg-gradient-to-b from-primary-50/30 to-transparent dark:from-primary-950/10" />

        </div>


        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">

          {/* =========================================================
            TRUST FEATURES
        ========================================================== */}
          <div className="grid border-b border-line sm:grid-cols-3">

            {/* Verification */}
            <div className="border-b border-line py-7 sm:border-b-0 sm:border-r sm:pr-6">

              <div className="flex items-start gap-4">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/10">

                  <BadgeCheck className="h-5 w-5" />

                </div>

                <div>

                  <p className="text-sm font-bold text-ink">
                    Verified documents
                  </p>

                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    Important tenant documents are verified before sharing.
                  </p>

                </div>

              </div>

            </div>


            {/* Trust */}
            <div className="border-b border-line py-7 sm:border-b-0 sm:border-r sm:px-6">

              <div className="flex items-start gap-4">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-200 dark:bg-primary-500/10 dark:text-primary-300 dark:ring-primary-500/10">

                  <ShieldCheck className="h-5 w-5" />

                </div>

                <div>

                  <p className="text-sm font-bold text-ink">
                    Transparent trust
                  </p>

                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    Explainable scores built from verified rental signals.
                  </p>

                </div>

              </div>

            </div>


            {/* Agreements */}
            <div className="py-7 sm:pl-6">

              <div className="flex items-start gap-4">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/10">

                  <FileCheck2 className="h-5 w-5" />

                </div>

                <div>

                  <p className="text-sm font-bold text-ink">
                    Digital agreements
                  </p>

                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    Sign rental agreements digitally from any device.
                  </p>

                </div>

              </div>

            </div>

          </div>


          {/* =========================================================
            MAIN FOOTER
        ========================================================== */}
          <div className="grid gap-12 py-14 sm:py-16 md:grid-cols-[1.7fr_1fr_1fr_1fr]">


            {/* =======================================================
              BRAND
          ======================================================== */}
            <div className="max-w-sm">

              <Link
                  to="/"
                  className="group inline-flex items-center gap-3"
              >

              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 via-indigo-600 to-violet-700 text-white shadow-lg shadow-primary-600/20 transition-all duration-300 group-hover:scale-105">

                <ShieldCheck className="h-5 w-5" />

                <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />

              </span>


                <span className="text-2xl font-black tracking-tight text-ink">

                Veri
                <span className="bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent dark:from-primary-300 dark:to-indigo-300">
                  Nest
                </span>

              </span>

              </Link>


              <p className="mt-5 text-sm leading-7 text-ink-muted">
                Verified tenants, trusted landlords. VeriNest brings document
                verification, transparent trust scores and digital agreements
                together in one rental experience.
              </p>


              {/* Small badges */}
              <div className="mt-6 flex flex-wrap gap-2">

              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[10px] font-bold text-ink-muted">

                <ShieldCheck className="h-3 w-3 text-emerald-500" />

                Trust first

              </span>


                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[10px] font-bold text-ink-muted">

                <KeyRound className="h-3 w-3 text-primary-500" />

                Better renting

              </span>

              </div>

            </div>


            {/* =======================================================
              EXPLORE
          ======================================================== */}
            <nav aria-label="Explore">

              <p className="text-xs font-black uppercase tracking-[0.18em] text-ink">
                Explore
              </p>


              <ul className="mt-5 space-y-3">

                {exploreLinks.map((link) => (

                    <li key={link.to}>

                      <Link
                          to={link.to}
                          className="group inline-flex items-center text-sm text-ink-muted transition hover:text-primary-700 dark:hover:text-primary-300"
                      >

                    <span>
                      {link.label}
                    </span>

                        <ArrowRight className="ml-1.5 h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />

                      </Link>

                    </li>

                ))}

              </ul>

            </nav>


            {/* =======================================================
              LEGAL
          ======================================================== */}
            <nav aria-label="Legal">

              <p className="text-xs font-black uppercase tracking-[0.18em] text-ink">
                Legal
              </p>


              <ul className="mt-5 space-y-3">

                {legalLinks.map((link) => (

                    <li key={link.to}>

                      <Link
                          to={link.to}
                          className="group inline-flex items-center text-sm text-ink-muted transition hover:text-primary-700 dark:hover:text-primary-300"
                      >

                    <span>
                      {link.label}
                    </span>

                        <ArrowRight className="ml-1.5 h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />

                      </Link>

                    </li>

                ))}


                <li>

                  <Link
                      to="/contact"
                      className="group inline-flex items-center text-sm text-ink-muted transition hover:text-primary-700 dark:hover:text-primary-300"
                  >

                  <span>
                    Support
                  </span>

                    <ArrowRight className="ml-1.5 h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />

                  </Link>

                </li>

              </ul>

            </nav>


            {/* =======================================================
              CONNECT
          ======================================================== */}
            <div>

              <p className="text-xs font-black uppercase tracking-[0.18em] text-ink">
                Connect
              </p>


              <div className="mt-5 flex gap-2">

                {socialLinks.map(({ label, Icon }) => (

                    <a
                        key={label}
                        href="#"
                        aria-label={`VeriNest on ${label} (coming soon)`}
                        onClick={(e) => e.preventDefault()}
                        className="group flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-muted text-ink-muted transition-all duration-200 hover:-translate-y-1 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-500/30 dark:hover:bg-primary-500/10 dark:hover:text-primary-300"
                    >

                      <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />

                    </a>

                ))}


                <Link
                    to="/contact"
                    aria-label="Email us"
                    className="group flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-muted text-ink-muted transition-all duration-200 hover:-translate-y-1 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-500/30 dark:hover:bg-primary-500/10 dark:hover:text-primary-300"
                >

                  <Mail className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />

                </Link>

              </div>


              <p className="mt-4 text-xs leading-5 text-ink-faint">
                Social profiles coming soon.
              </p>


              {/* Contact card */}
              <Link
                  to="/contact"
                  className="group mt-5 flex items-center gap-3 rounded-xl border border-line bg-surface-muted p-3 transition-all duration-200 hover:border-primary-300 hover:bg-primary-50 dark:hover:border-primary-500/20 dark:hover:bg-primary-500/5"
              >

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">

                  <Mail className="h-4 w-4" />

                </div>


                <div className="min-w-0">

                  <p className="text-xs font-bold text-ink">
                    Need help?
                  </p>

                  <p className="text-[10px] text-ink-muted">
                    Contact our support team
                  </p>

                </div>


                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-faint transition group-hover:translate-x-1 group-hover:text-primary-600 dark:group-hover:text-primary-300" />

              </Link>

            </div>

          </div>


          {/* =========================================================
            BOTTOM BAR
        ========================================================== */}
          <div className="border-t border-line">

            <div className="flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">

              <p className="text-xs text-ink-faint">
                &copy; {new Date().getFullYear()} VeriNest. All rights reserved.
              </p>


              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-ink-faint">

              <span className="flex items-center gap-1.5">

                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                Built for transparent renting

              </span>


                <span className="hidden h-3 w-px bg-line sm:block" />


                <span>

                Photography from{' '}

                  <a
                      href="https://unsplash.com"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-ink-muted transition hover:text-primary-700 hover:underline dark:hover:text-primary-300"
                  >
                  Unsplash
                </a>

              </span>

              </div>

            </div>

          </div>

        </div>

      </footer>
  );
}