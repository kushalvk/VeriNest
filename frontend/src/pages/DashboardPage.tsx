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
    <div className="rounded-lg border border-line bg-surface p-4 shadow-card" data-testid="stat-card">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          attention
            ? 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400'
            : 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300'
        }`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight text-ink" data-testid="stat-value">
            {value ?? '—'}
          </p>
          <p className="truncate text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
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
    <Link to={to} data-testid="action-card"
      className="group rounded-lg border border-line bg-surface p-4 shadow-card transition hover:border-primary-300 hover:shadow-md dark:hover:border-primary-500/50">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-semibold text-ink">
            {title}
            <ArrowRight className="h-4 w-4 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-primary-600 dark:group-hover:text-primary-300" aria-hidden="true" />
          </p>
          <p className="mt-0.5 text-sm leading-snug text-ink-muted">{text}</p>
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
    <main className="pb-16">
      {/* greeting band */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <p className="text-sm text-primary-200">{today()}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {greetingFor(new Date().getHours())}, {firstName} 👋
          </h1>
          <p className="mt-2 max-w-xl text-primary-100">{SLOGANS[role ?? ''] ?? 'Welcome to VeriNest.'}</p>
          <span className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {role} account
          </span>
        </div>
      </section>

      <div className="mx-auto mt-8 max-w-5xl space-y-8 px-4 sm:px-6">
        {/* profile nudge */}
        {profileMissing && role !== 'admin' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-500/30 dark:bg-warning-500/10"
            data-testid="profile-prompt">
            <div>
              <p className="text-sm font-semibold text-warning-800 dark:text-warning-300">
                Your profile is incomplete.
              </p>
              <p className="text-xs text-warning-700 dark:text-warning-400/80">
                {role === 'tenant'
                  ? 'A complete profile is required before you can apply to properties.'
                  : 'A complete profile helps tenants trust your listings.'}
              </p>
            </div>
            <Link to="/profile"
              className="rounded-md bg-warning-600 px-4 py-2 text-sm font-semibold text-white hover:bg-warning-700">
              Complete your profile
            </Link>
          </div>
        )}

        {/* actionable: a landlord is waiting on the tenant */}
        {role === 'tenant' && tenant?.verifs && tenant.verifs.pending > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-500/30 dark:bg-primary-500/10"
            data-testid="verif-prompt">
            <p className="text-sm font-medium text-primary-800 dark:text-primary-300">
              A landlord is waiting: you have {tenant.verifs.pending} document access{' '}
              request{tenant.verifs.pending > 1 ? 's' : ''} to respond to.
            </p>
            <Link to="/verification-requests"
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              Review requests
            </Link>
          </div>
        )}

        {/* stats */}
        <section data-testid="dashboard-stats">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">At a glance</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {role === 'tenant' && tenantStatsCards(tenant)}
            {role === 'landlord' && landlordStatsCards(landlord)}
            {role === 'admin' && adminStatsCards(admin)}
          </div>
        </section>

        {/* quick actions */}
        <section data-testid="dashboard-actions">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">Quick actions</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
