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

function ActionCard({ to, icon: Icon, title, text }: {
  to: string;
  icon: IconType;
  title: string;
  text: string;
}) {
  return (
      <Link
          to={to}
          data-testid="action-card"
          className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-slate-900/80 dark:hover:border-primary-500/40"
      >
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary-500/5 blur-2xl transition-transform duration-500 group-hover:scale-150" />

        <div className="relative flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-indigo-100 text-primary-600 ring-1 ring-primary-100 transition-all duration-300 group-hover:scale-105 group-hover:from-primary-100 group-hover:to-indigo-200 dark:from-primary-500/15 dark:to-indigo-500/15 dark:text-primary-300 dark:ring-primary-400/20">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              {title}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-primary-100 group-hover:text-primary-600 dark:bg-white/5 dark:text-slate-500 dark:group-hover:bg-primary-500/15 dark:group-hover:text-primary-300">
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
          </div>
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
          <section data-testid="dashboard-actions">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400">
                Shortcuts
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Quick actions
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Jump directly to the tools you use most.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {role === 'tenant' && (
                  <>
                    <ActionCard to="/properties" icon={Search} title="Browse properties"
                                text="Search listings by city, rent, and amenities — then apply in one click." />
                    <ActionCard to="/documents" icon={FileText} title="My documents"
                                text="Upload and track Aadhaar, PAN, and salary slips through verification." />
                    <ActionCard to="/my-applications" icon={ClipboardList} title="My applications"
                                text="Follow every application from submission to agreement." />
                    <ActionCard to="/verification-requests" icon={ShieldCheck} title="Verification requests"
                                text="Approve or decline landlord requests to view your documents." />
                    <ActionCard to="/rental-history" icon={KeyRound} title="Rental history"
                                text="Your tenancies, ratings, and the reputation you carry forward." />
                    <ActionCard to="/profile" icon={UserRound} title="My profile"
                                text="Keep your personal, employment, and address details current." />
                  </>
              )}

              {role === 'landlord' && (
                  <>
                    <ActionCard to="/my-properties" icon={Building2} title="My properties"
                                text="Create listings, upload photos, and manage availability." />
                    <ActionCard to="/received-applications" icon={Inbox} title="Received applications"
                                text="Review verified applicants and request document access." />
                    <ActionCard to="/rental-history" icon={KeyRound} title="Rental history"
                                text="Track active tenancies, complete them, and rate your tenants." />
                    <ActionCard to="/properties" icon={Search} title="Browse the market"
                                text="See what similar properties list for in your city." />
                    <ActionCard to="/profile" icon={UserRound} title="My profile"
                                text="Company details and contact information tenants will see." />
                  </>
              )}

              {role === 'admin' && (
                  <>
                    <ActionCard to="/admin" icon={FileText} title="Document review"
                                text="Work the verification queue — approve clean documents, reject with remarks." />
                    <ActionCard to="/admin/users" icon={Users} title="Manage users"
                                text="Every tenant and landlord account — inspect activity, block or remove." />
                    <ActionCard to="/admin/trust-score" icon={ShieldCheck} title="Trust scores"
                                text="Recalculate a tenant's score and audit the reasons behind it." />
                    <ActionCard to="/properties" icon={Search} title="Browse listings"
                                text="See the platform the way tenants and landlords do." />
                  </>
              )}
            </div>
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
