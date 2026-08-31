import { useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CircleX,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  KeyRound,
  ScrollText,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import * as profileApi from '../api/profileApi';
import * as documentApi from '../api/documentApi';
import * as applicationApi from '../api/applicationApi';
import * as verificationApi from '../api/verificationApi';
import * as rentalHistoryApi from '../api/rentalHistoryApi';
import * as propertyApi from '../api/propertyApi';
import * as agreementApi from '../api/agreementApi';
import * as adminApi from '../api/adminApi';
import { useAuthStore } from '../store/authStore';
import { PhotoBand } from '../components/Imagery';
import { photos } from '../assets/photos';

type IconType = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

// The three document types we nudge every tenant to upload first.
const CORE_DOC_TYPES = ['aadhaar', 'pan', 'salary_slip'] as const;

const SLOGANS: Record<string, string> = {
  tenant: 'Build your verified profile once — rent with confidence everywhere.',
  landlord: 'List with confidence — every applicant arrives verified.',
  admin: 'Keep the platform trustworthy — review, verify, decide.',
};

const greetingFor = (hour: number) =>
    hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

const today = () =>
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- building blocks ---------- */

function StatCard({ icon: Icon, label, value, hint, attention }: {
  icon: IconType;
  label: string;
  value: string | number | null;
  hint?: string;
  attention?: boolean;
}) {
  return (
      <div
          className={`group relative overflow-hidden rounded-2xl border p-5 shadow-[0_12px_35px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.18)] ${
              attention
                  ? 'border-amber-300/50 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:border-amber-400/20 dark:from-amber-500/10 dark:via-slate-900 dark:to-orange-500/10'
                  : 'border-slate-200/80 bg-white/90 dark:border-white/10 dark:bg-slate-900/80'
          }`}
          data-testid="stat-card"
      >
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-500/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p
                className="mt-2 text-4xl font-black tracking-tight text-slate-900 dark:text-white"
                data-testid="stat-value"
            >
              {value ?? '—'}
            </p>
          </div>

          <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-105 ${
                  attention
                      ? 'bg-amber-100 text-amber-600 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20'
                      : 'bg-primary-50 text-primary-600 ring-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-400/20'
              }`}
          >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        </div>

        {hint && (
            <p className="relative mt-3 min-h-[2.5rem] text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {hint}
            </p>
        )}

        <div
            className={`absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 ${
                attention ? 'bg-amber-500' : 'bg-primary-500'
            }`}
        />
      </div>
  );
}

function DashboardAction({
                           to,
                           icon: Icon,
                           title,
                           text,
                           label,
                           featured = false,
                           tone = 'primary',
                         }: {
  to: string;
  icon: IconType;
  title: string;
  text: string;
  label?: string;
  featured?: boolean;
  tone?: 'primary' | 'emerald' | 'amber' | 'violet';
}) {
  const tones = {
    primary: {
      visual: 'from-primary-600 via-indigo-600 to-violet-700',
      glow: 'bg-primary-400/30',
      icon: 'bg-white/15 text-white',
      badge: 'bg-white/15 text-white',
    },
    emerald: {
      visual: 'from-emerald-600 via-teal-600 to-cyan-700',
      glow: 'bg-emerald-300/30',
      icon: 'bg-white/15 text-white',
      badge: 'bg-white/15 text-white',
    },
    amber: {
      visual: 'from-amber-500 via-orange-600 to-rose-600',
      glow: 'bg-amber-200/30',
      icon: 'bg-white/15 text-white',
      badge: 'bg-white/15 text-white',
    },
    violet: {
      visual: 'from-violet-600 via-purple-600 to-fuchsia-700',
      glow: 'bg-violet-300/30',
      icon: 'bg-white/15 text-white',
      badge: 'bg-white/15 text-white',
    },
  };

  const theme = tones[tone];

  if (featured) {
    return (
        <Link
            to={to}
            className="group relative min-h-[280px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_15px_45px_rgba(15,23,42,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-slate-900"
        >
          {/* Visual background */}
          <div
              className={`absolute inset-0 bg-gradient-to-br ${theme.visual}`}
          />

          {/* Decorative circles */}
          <div
              className={`absolute -right-20 -top-20 h-64 w-64 rounded-full ${theme.glow} blur-3xl transition-transform duration-700 group-hover:scale-125`}
          />

          <div className="absolute right-8 top-8 h-32 w-32 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm" />
          <div className="absolute right-16 top-16 h-16 w-16 rounded-full border border-white/10 bg-white/5" />

          {/* Content */}
          <div className="relative flex h-full flex-col justify-between p-7">
            <div>
              <div className="flex items-center justify-between">
              <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${theme.icon} shadow-lg backdrop-blur-md`}
              >
                <Icon className="h-7 w-7" aria-hidden="true" />
              </span>

                {label && (
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${theme.badge} backdrop-blur-md`}
                    >
                  {label}
                </span>
                )}
              </div>

              <h3 className="mt-8 max-w-md text-2xl font-black tracking-tight text-white sm:text-3xl">
                {title}
              </h3>

              <p className="mt-3 max-w-lg text-sm leading-6 text-white/80">
                {text}
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm font-bold text-white">
              Explore now
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-white/25">
              <ArrowRight className="h-4 w-4" />
            </span>
            </div>
          </div>
        </Link>
    );
  }

  return (
      <Link
          to={to}
          className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.13)] dark:border-white/10 dark:bg-slate-900"
      >
        <div
            className={`absolute -right-12 -top-12 h-32 w-32 rounded-full ${theme.glow} opacity-30 blur-3xl transition-transform duration-500 group-hover:scale-150`}
        />

        <div className="relative">
          <div className="flex items-center justify-between">
          <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.visual} text-white shadow-lg`}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>

            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-primary-50 group-hover:text-primary-600 dark:bg-white/5 dark:text-slate-500 dark:group-hover:bg-primary-500/15 dark:group-hover:text-primary-300">
            <ArrowRight className="h-4 w-4" />
          </span>
          </div>

          {label && (
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {label}
              </p>
          )}

          <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
            {title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {text}
          </p>
        </div>
      </Link>
  );
}

/* ---------- role data ---------- */

interface TenantStats {
  trustScore: number | null;
  docs: { verified: number; pending: number; coreUploaded: number } | null;
  apps: { total: number; pending: number } | null;
  verifs: { pending: number } | null;
  rentals: { active: number; total: number } | null;
}

interface LandlordStats {
  props: { total: number; available: number } | null;
  apps: { total: number; pending: number } | null;
  rentals: { active: number; total: number } | null;
  agreements: { active: number; draft: number } | null;
}

interface AdminStats {
  pending: number | null;
  verified: number | null;
  rejected: number | null;
  users: { total: number; blocked: number } | null;
}

/* ---------- page ---------- */

export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const [profileMissing, setProfileMissing] = useState(false);
  const [tenant, setTenant] = useState<TenantStats | null>(null);
  const [landlord, setLandlord] = useState<LandlordStats | null>(null);
  const [admin, setAdmin] = useState<AdminStats | null>(null);

  // Everything below is a best-effort summary: any individual fetch failing
  // just leaves its card at "—" — the dashboard itself never errors.
  useEffect(() => {
    let cancelled = false;
    const val = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' ? r.value : null;

    const load = async () => {
      if (role === 'tenant') {
        const [profile, docs, apps, verifs, rentals] = await Promise.allSettled([
          profileApi.getMyTenantProfile(),
          documentApi.getMyDocuments(),
          applicationApi.getMyApplications(),
          verificationApi.getMyVerificationRequests(),
          rentalHistoryApi.getMyRentalHistory(),
        ]);
        if (cancelled) return;
        const p = val(profile);
        const d = val(docs);
        const a = val(apps);
        const v = val(verifs);
        const r = val(rentals);
        if (profile.status === 'fulfilled') setProfileMissing(p === null);
        const types = new Set((d ?? []).map((x) => x.documentType));
        setTenant({
          trustScore: p?.trustScore ?? null,
          docs: d ? {
            verified: d.filter((x) => x.verificationStatus === 'verified').length,
            pending: d.filter((x) => x.verificationStatus === 'pending').length,
            coreUploaded: CORE_DOC_TYPES.filter((t) => types.has(t)).length,
          } : null,
          apps: a ? { total: a.length, pending: a.filter((x) => x.status === 'pending').length } : null,
          verifs: v ? { pending: v.filter((x) => x.status === 'pending').length } : null,
          rentals: r ? { active: r.filter((x) => !x.moveOutDate).length, total: r.length } : null,
        });
      } else if (role === 'landlord') {
        const [profile, props, apps, rentals, agreements] = await Promise.allSettled([
          profileApi.getMyLandlordProfile(),
          propertyApi.getMyProperties(),
          applicationApi.getReceivedApplications(),
          rentalHistoryApi.getMyRentalHistory(),
          agreementApi.getMyAgreements(),
        ]);
        if (cancelled) return;
        if (profile.status === 'fulfilled') setProfileMissing(val(profile) === null);
        const pr = val(props);
        const a = val(apps);
        const r = val(rentals);
        const g = val(agreements);
        setLandlord({
          props: pr ? { total: pr.length, available: pr.filter((x) => x.status === 'available').length } : null,
          apps: a ? { total: a.length, pending: a.filter((x) => x.status === 'pending').length } : null,
          rentals: r ? { active: r.filter((x) => !x.moveOutDate).length, total: r.length } : null,
          agreements: g ? {
            active: g.filter((x) => x.status === 'active').length,
            draft: g.filter((x) => x.status === 'draft').length,
          } : null,
        });
      } else if (role === 'admin') {
        const [pending, verified, rejected, users, blocked] = await Promise.allSettled([
          adminApi.getDocuments('pending'),
          adminApi.getDocuments('verified'),
          adminApi.getDocuments('rejected'),
          adminApi.listUsers({}),
          adminApi.listUsers({ status: 'blocked' }),
        ]);
        if (cancelled) return;
        const userTotal = val(users)?.pagination.total;
        setAdmin({
          pending: val(pending)?.pagination.total ?? null,
          verified: val(verified)?.pagination.total ?? null,
          rejected: val(rejected)?.pagination.total ?? null,
          // only counts are used here — the pages themselves are discarded
          users: userTotal === undefined ? null : {
            total: userTotal,
            blocked: val(blocked)?.pagination.total ?? 0,
          },
        });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [role]);

  const firstName = user?.fullName?.trim().split(/\s+/)[0] ?? 'there';

  return (
      <main className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
        {/* Premium hero */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 bg-slate-950" />
          <div className="absolute -left-24 top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-primary-600/30 blur-3xl" />
          <div className="absolute right-[-8rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />

          <PhotoBand photo={photos.dashboard} scrim="hero" eager>
            <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary-100 shadow-lg backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                  {role} dashboard
                </div>

                <p className="mt-5 text-sm font-medium text-primary-200/90">{today()}</p>

                <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {greetingFor(new Date().getHours())},{' '}
                  <span className="bg-gradient-to-r from-white via-primary-100 to-indigo-200 bg-clip-text text-transparent">
                  {firstName}
                </span>{' '}
                  👋
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                  {SLOGANS[role ?? ''] ?? 'Welcome to VeriNest.'}
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                <span className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
                  Secure & verified
                </span>
                  <span className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
                  Everything in one place
                </span>
                </div>
              </div>
            </div>
          </PhotoBand>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-950" />
        </section>

        <div className="relative z-10 mx-auto -mt-4 max-w-6xl space-y-10 px-4 sm:px-6">
          {/* Profile nudge */}
          {profileMissing && role !== 'admin' && (
              <div
                  className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-5 shadow-[0_12px_35px_rgba(245,158,11,0.12)] dark:border-amber-500/20 dark:from-amber-500/10 dark:via-slate-900 dark:to-orange-500/10"
                  data-testid="profile-prompt"
              >
                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                        Your profile is incomplete
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-400/80">
                      {role === 'tenant'
                          ? 'A complete profile is required before you can apply to properties.'
                          : 'A complete profile helps tenants trust your listings.'}
                    </p>
                  </div>
                  <Link
                      to="/profile"
                      className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-600/20 transition hover:-translate-y-0.5 hover:bg-amber-700"
                  >
                    Complete profile
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
          )}

          {/* Verification prompt */}
          {role === 'tenant' && tenant?.verifs && tenant.verifs.pending > 0 && (
              <div
                  className="relative overflow-hidden rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-50 via-white to-indigo-50 p-5 shadow-[0_12px_35px_rgba(79,70,229,0.12)] dark:border-primary-500/20 dark:from-primary-500/10 dark:via-slate-900 dark:to-indigo-500/10"
                  data-testid="verif-prompt"
              >
                <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary-500/10 blur-2xl" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                    <div>
                      <p className="text-sm font-bold text-primary-900 dark:text-primary-300">
                        Action required
                      </p>
                      <p className="mt-1 text-sm text-primary-800/80 dark:text-primary-400/80">
                        A landlord is waiting: you have {tenant.verifs.pending} document access request
                        {tenant.verifs.pending > 1 ? 's' : ''} to respond to.
                      </p>
                    </div>
                  </div>

                  <Link
                      to="/verification-requests"
                      className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:-translate-y-0.5 hover:bg-primary-700"
                  >
                    Review requests
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
          )}

          {/* Stats */}
          <section data-testid="dashboard-stats">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400">
                  Overview
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  At a glance
                </h2>
              </div>
              <div className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10 sm:block">
                Live account summary
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {role === 'tenant' && tenantStatsCards(tenant)}
              {role === 'landlord' && landlordStatsCards(landlord)}
              {role === 'admin' && adminStatsCards(admin)}
            </div>
          </section>

          {/* Quick actions */}
          {/* Dashboard-specific actions */}
          <section data-testid="dashboard-actions">

            {/* ================= TENANT ================= */}
            {role === 'tenant' && (
                <div>
                  <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400">
                        Your rental journey
                      </p>

                      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                        Find a place that feels like home
                      </h2>

                      <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                        Everything you need to discover properties, manage documents,
                        and move into your next home.
                      </p>
                    </div>

                    <div className="hidden rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2 text-xs font-bold text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300 sm:block">
                      🏠 Tenant workspace
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">

                    {/* Featured */}
                    <DashboardAction
                        to="/properties"
                        icon={Search}
                        title="Find your next home"
                        text="Explore verified rental properties by city, budget, amenities, and availability."
                        label="Discover"
                        featured
                        tone="primary"
                    />

                    <div className="grid gap-4 sm:grid-cols-2">

                      <DashboardAction
                          to="/documents"
                          icon={FileText}
                          title="Your documents"
                          text="Keep Aadhaar, PAN and salary documents ready for verification."
                          label="Verification"
                          tone="violet"
                      />

                      <DashboardAction
                          to="/my-applications"
                          icon={ClipboardList}
                          title="Applications"
                          text="Track every application from submission to landlord decision."
                          label="Track"
                          tone="emerald"
                      />

                      <DashboardAction
                          to="/verification-requests"
                          icon={ShieldCheck}
                          title="Access requests"
                          text="Review landlords requesting access to your verified documents."
                          label="Security"
                          tone="amber"
                      />

                      <DashboardAction
                          to="/rental-history"
                          icon={KeyRound}
                          title="Rental history"
                          text="View your previous stays, ratings, and rental reputation."
                          label="History"
                          tone="primary"
                      />

                    </div>
                  </div>

                  {/* Profile strip */}
                  <Link
                      to="/profile"
                      className="group mt-4 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md dark:border-white/10 dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300">
            <UserRound className="h-5 w-5" />
          </span>

                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Keep your profile up to date
                        </p>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          A complete profile helps landlords trust your application.
                        </p>
                      </div>
                    </div>

                    <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-primary-600" />
                  </Link>
                </div>
            )}

            {/* ================= LANDLORD ================= */}
            {role === 'landlord' && (
                <div>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                      Property workspace
                    </p>

                    <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                      Manage your properties with confidence
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                      Manage listings, applicants, tenants and agreements from one place.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">

                    {/* Large property card */}
                    <div className="lg:col-span-2">
                      <DashboardAction
                          to="/my-properties"
                          icon={Building2}
                          title="Your property portfolio"
                          text="Create beautiful listings, upload property photos, manage availability, and keep your rental inventory organized."
                          label="Properties"
                          featured
                          tone="emerald"
                      />
                    </div>

                    {/* Applications */}
                    <DashboardAction
                        to="/received-applications"
                        icon={Inbox}
                        title="Applicant inbox"
                        text="Review verified tenants and decide who gets access to your properties."
                        label="Applicants"
                        tone="amber"
                    />

                    <DashboardAction
                        to="/rental-history"
                        icon={KeyRound}
                        title="Current tenants"
                        text="Track active tenancies, completed rentals and tenant ratings."
                        label="Tenancies"
                        tone="primary"
                    />

                    <DashboardAction
                        to="/properties"
                        icon={Search}
                        title="Market explorer"
                        text="Compare similar listings and understand what properties are asking in your market."
                        label="Market"
                        tone="violet"
                    />

                    {/* Agreements */}
                    <DashboardAction
                        to="/received-applications"
                        icon={ScrollText}
                        title="Agreements"
                        text="Keep rental agreements organized and monitor documents awaiting signatures."
                        label="Contracts"
                        tone="emerald"
                    />

                  </div>

                  {/* Landlord bottom banner */}
                  <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-teal-500/10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <BadgeCheck className="h-5 w-5" />
            </span>

                        <div>
                          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                            Build trust with every listing
                          </p>

                          <p className="text-xs text-emerald-800/70 dark:text-emerald-400/70">
                            Keep your property information and profile complete.
                          </p>
                        </div>
                      </div>

                      <Link
                          to="/profile"
                          className="text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300"
                      >
                        Update profile →
                      </Link>
                    </div>
                  </div>
                </div>
            )}

            {/* ================= ADMIN ================= */}
            {role === 'admin' && (
                <div>
                  <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
                        Administration
                      </p>

                      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                        Platform control center
                      </h2>

                      <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                        Keep VeriNest secure, trusted, and running smoothly.
                      </p>
                    </div>

                    <div className="hidden rounded-2xl border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300 sm:block">
                      🛡️ Admin workspace
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">

                    {/* Main review card */}
                    <div className="lg:col-span-2">
                      <DashboardAction
                          to="/admin"
                          icon={FileText}
                          title="Verification command center"
                          text="Review pending documents, validate submitted information, and keep the platform's verification pipeline moving."
                          label="Priority"
                          featured
                          tone="violet"
                      />
                    </div>

                    <DashboardAction
                        to="/admin/users"
                        icon={Users}
                        title="User management"
                        text="Inspect tenant and landlord accounts, review activity, and manage account access."
                        label="Accounts"
                        tone="primary"
                    />

                    <DashboardAction
                        to="/admin/trust-score"
                        icon={ShieldCheck}
                        title="Trust scores"
                        text="Audit tenant trust scores and understand the verification signals behind them."
                        label="Trust"
                        tone="emerald"
                    />

                    <DashboardAction
                        to="/properties"
                        icon={Search}
                        title="Platform listings"
                        text="Browse the marketplace from the platform administrator's perspective."
                        label="Marketplace"
                        tone="amber"
                    />

                    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-900 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:border-white/10">
                      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />

                      <div className="relative">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                          <BadgeCheck className="h-6 w-6" />
                        </div>

                        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          Platform health
                        </p>

                        <h3 className="mt-1 text-xl font-black text-white">
                          Trust starts with verification
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Keep document reviews accurate and users' information protected.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
            )}

          </section>
        </div>
      </main>
  );
}

/* ---------- per-role stat rows ---------- */

function tenantStatsCards(s: TenantStats | null) {
  return (
      <>
        <StatCard icon={ShieldCheck} label="Trust score" value={s?.trustScore ?? null}
                  hint="Grows with verified documents, a complete profile, and good ratings." />
        <StatCard icon={FileText} label="Documents verified" value={s?.docs ? s.docs.verified : null}
                  hint={s?.docs
                      ? s.docs.pending > 0
                          ? `${s.docs.pending} awaiting review · ${s.docs.coreUploaded}/${CORE_DOC_TYPES.length} core docs uploaded`
                          : `${s.docs.coreUploaded}/${CORE_DOC_TYPES.length} core docs uploaded (Aadhaar, PAN, salary slip)`
                      : undefined} />
        <StatCard icon={ClipboardList} label="Applications" value={s?.apps ? s.apps.total : null}
                  hint={s?.apps && s.apps.pending > 0 ? `${s.apps.pending} awaiting a landlord's decision` : undefined}
                  attention={Boolean(s?.apps && s.apps.pending > 0)} />
        <StatCard icon={KeyRound} label="Active rentals" value={s?.rentals ? s.rentals.active : null}
                  hint={s?.rentals ? `${s.rentals.total} total on record` : undefined} />
      </>
  );
}

function landlordStatsCards(s: LandlordStats | null) {
  return (
      <>
        <StatCard icon={Building2} label="My properties" value={s?.props ? s.props.total : null}
                  hint={s?.props ? `${s.props.available} currently available` : undefined} />
        <StatCard icon={Inbox} label="Applications" value={s?.apps ? s.apps.total : null}
                  hint={s?.apps && s.apps.pending > 0 ? `${s.apps.pending} waiting for your decision` : undefined}
                  attention={Boolean(s?.apps && s.apps.pending > 0)} />
        <StatCard icon={KeyRound} label="Active rentals" value={s?.rentals ? s.rentals.active : null}
                  hint={s?.rentals ? `${s.rentals.total} total on record` : undefined} />
        <StatCard icon={ScrollText} label="Agreements" value={s?.agreements ? s.agreements.active : null}
                  hint={s?.agreements && s.agreements.draft > 0
                      ? `${s.agreements.draft} draft${s.agreements.draft > 1 ? 's' : ''} awaiting signatures`
                      : 'Fully signed and active'}
                  attention={Boolean(s?.agreements && s.agreements.draft > 0)} />
      </>
  );
}

function adminStatsCards(s: AdminStats | null) {
  return (
      <>
        <StatCard icon={Clock} label="Pending review" value={s?.pending ?? null}
                  hint="Documents waiting for a verification decision."
                  attention={Boolean(s?.pending && s.pending > 0)} />
        <StatCard icon={BadgeCheck} label="Verified" value={s?.verified ?? null}
                  hint="Documents approved to date." />
        <StatCard icon={CircleX} label="Rejected" value={s?.rejected ?? null}
                  hint="Sent back with reviewer remarks." />
        <StatCard icon={Users} label="Users" value={s?.users?.total ?? null}
                  hint={s?.users && s.users.blocked > 0
                      ? `${s.users.blocked} account${s.users.blocked > 1 ? 's' : ''} currently blocked`
                      : 'Tenants, landlords and admins on the platform.'}
                  attention={Boolean(s?.users && s.users.blocked > 0)} />
      </>
  );
}
