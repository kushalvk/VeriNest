import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, ShieldCheck, X } from 'lucide-react';
import * as authApi from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';

type Role = 'tenant' | 'landlord' | 'admin';

interface NavItem {
  to: string;
  label: string;
  /** exact-match only (for "/" and "/admin" so they don't stay lit on children) */
  end?: boolean;
}

// Marketing pages — visible to everyone. "Home" is dropped when logged in
// (the wordmark already goes home, and "/" duplicates the dashboard then).
const marketingLinks: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/properties', label: 'Properties' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/contact', label: 'Contact' },
];

// App links per role — each role sees ONLY its own set.
const roleLinks: Record<Role, NavItem[]> = {
  tenant: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/documents', label: 'Documents' },
    { to: '/my-applications', label: 'My Applications' },
    { to: '/verification-requests', label: 'Verifications' },
    { to: '/rental-history', label: 'Rentals' },
    { to: '/agreements', label: 'Agreements' },
  ],
  landlord: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/my-properties', label: 'My Properties' },
    { to: '/received-applications', label: 'Applications' },
    { to: '/rental-history', label: 'Rentals' },
    { to: '/agreements', label: 'Agreements' },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/admin', label: 'Document Review', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/trust-score', label: 'Trust Scores' },
  ],
};

const initialsOf = (fullName?: string) =>
  (fullName || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Site-wide sticky header. Auth state lives in the in-memory zustand store
 * and is read synchronously, so the correct variant renders on first paint —
 * there is no "resolving auth" flash to handle.
 */
export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshToken, clearAuth } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const role = (user?.role ?? null) as Role | null;
  const appLinks = role ? roleLinks[role] : [];
  // Authenticated users keep the marketing pages reachable, minus Home.
  const publicLinks = isAuthenticated ? marketingLinks.slice(1) : marketingLinks;

  // Close the user menu on outside click.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  // Escape closes whichever menu is open.
  useEffect(() => {
    if (!menuOpen && !mobileOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, mobileOpen]);

  const closeAll = () => {
    setMenuOpen(false);
    setMobileOpen(false);
  };

  const onLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // best-effort — local state is cleared regardless
    }
    clearAuth();
    closeAll();
    navigate('/login');
  };

  return (
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">

        <div className="mx-auto max-w-7xl px-3 sm:px-6">

          <div className="flex h-[72px] items-center justify-between gap-3">

            {/* =====================================================
            BRAND + DESKTOP NAV
        ====================================================== */}
            <div className="flex min-w-0 items-center gap-4 lg:gap-8">

              {/* Brand */}
              <Link
                  to={isAuthenticated ? '/dashboard' : '/'}
                  onClick={closeAll}
                  className="group flex shrink-0 items-center gap-2.5"
                  data-testid="brand"
              >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 via-indigo-600 to-violet-700 text-white shadow-lg shadow-primary-600/20 transition-all duration-300 group-hover:scale-105 group-hover:shadow-primary-600/30">

              <ShieldCheck
                  className="h-5 w-5"
                  aria-hidden="true"
              />

              <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />

            </span>

                <span className="hidden text-xl font-black tracking-tight text-slate-900 dark:text-white sm:block">
              Veri
              <span className="bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
                Nest
              </span>
            </span>
              </Link>


              {/* =====================================================
              DESKTOP NAVIGATION
              xl:flex = prevents overlap on smaller desktop widths
          ====================================================== */}
              <nav
                  aria-label="Primary"
                  className="hidden items-center gap-1 xl:flex"
                  data-testid="header-nav"
              >

                {/* Role-specific links */}
                {appLinks.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                            `rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                                isActive
                                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                            }`
                        }
                    >
                      {item.label}
                    </NavLink>
                ))}


                {/* =================================================
                PUBLIC LINKS

                IMPORTANT:
                When logged in, About / Services / Contact
                are hidden from the desktop navigation.
            ================================================== */}
                {!isAuthenticated &&
                    publicLinks.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                                `rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                                    isActive
                                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                                }`
                            }
                        >
                          {item.label}
                        </NavLink>
                    ))}

              </nav>
            </div>


            {/* =====================================================
            RIGHT SIDE
        ====================================================== */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">

              {/* Theme */}
              <div className="rounded-xl transition hover:bg-slate-100 dark:hover:bg-white/5">
                <ThemeToggle />
              </div>


              {/* =================================================
              AUTHENTICATED USER
          ================================================== */}
              {isAuthenticated ? (
                  <>
                    {/* Notification */}
                    <div className="rounded-xl transition hover:bg-slate-100 dark:hover:bg-white/5">
                      <NotificationBell />
                    </div>


                    {/* Profile */}
                    <div
                        className="relative"
                        ref={menuRef}
                    >

                      <button
                          type="button"
                          data-testid="user-menu"
                          aria-haspopup="menu"
                          aria-expanded={menuOpen}
                          onClick={() => setMenuOpen((o) => !o)}
                          className={`group flex items-center gap-2 rounded-2xl border px-1.5 py-1.5 transition-all duration-200 ${
                              menuOpen
                                  ? 'border-primary-200 bg-primary-50 shadow-sm dark:border-primary-500/30 dark:bg-primary-500/10'
                                  : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/10 dark:hover:bg-white/5'
                          }`}
                      >

                        {/* Avatar */}
                        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 text-xs font-black text-white shadow-md">

                    {initialsOf(user?.fullName)}

                          {/* Online indicator */}
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />

                  </span>


                        {/* User info */}
                        {/* max-w-[120px] prevents long names from pushing navbar */}
                        <div className="hidden max-w-[120px] min-w-0 text-left md:block">

                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                            {user?.fullName}
                          </p>

                          <p className="truncate text-[10px] font-medium capitalize text-slate-400">
                            {role}
                          </p>

                        </div>


                        <ChevronDown
                            aria-hidden="true"
                            className={`mr-1 hidden h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 md:block ${
                                menuOpen
                                    ? 'rotate-180 text-primary-600'
                                    : ''
                            }`}
                        />

                      </button>


                      {/* =================================================
                    USER DROPDOWN
                ================================================== */}
                      {menuOpen && (
                          <div
                              role="menu"
                              data-testid="user-menu-panel"
                              className="absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-slate-900"
                          >

                            {/* User information */}
                            <div className="bg-gradient-to-br from-primary-50 via-white to-indigo-50 p-4 dark:from-primary-500/10 dark:via-slate-900 dark:to-indigo-500/10">

                              <div className="flex items-center gap-3">

                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-700 text-sm font-black text-white shadow-lg">
                          {initialsOf(user?.fullName)}
                        </span>

                                <div className="min-w-0">

                                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                    {user?.fullName}
                                  </p>

                                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                    {user?.email}
                                  </p>

                                  <span className="mt-1.5 inline-flex rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                            {role}
                          </span>

                                </div>

                              </div>

                            </div>


                            {/* Menu */}
                            <div className="p-2">

                              {/* Profile */}
                              {role !== 'admin' && (
                                  <Link
                                      to="/profile"
                                      role="menuitem"
                                      onClick={closeAll}
                                      className="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                                  >

                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-primary-50 group-hover:text-primary-600 dark:bg-white/5 dark:text-slate-400 dark:group-hover:bg-primary-500/10 dark:group-hover:text-primary-300">
                            👤
                          </span>

                                    <span className="flex-1">
                            My Profile
                          </span>

                                    <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-500">
                            →
                          </span>

                                  </Link>
                              )}


                              {/* Logout */}
                              <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => void onLogout()}
                                  data-testid="logout"
                                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                              >

                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
                          ↪
                        </span>

                                <span className="flex-1">
                          Log out
                        </span>

                              </button>

                            </div>

                          </div>
                      )}

                    </div>
                  </>

              ) : (

                  /* =================================================
                     GUEST USER
                  ================================================== */
                  <div className="hidden items-center gap-2 sm:flex">

                    <Link
                        to="/login"
                        data-testid="header-login"
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      Log in
                    </Link>

                    <Link
                        to="/register"
                        data-testid="header-signup"
                        className="group inline-flex items-center rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-primary-700 hover:to-indigo-700 hover:shadow-primary-600/30"
                    >
                      Get started

                      <span className="ml-2 transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
                    </Link>

                  </div>
              )}


              {/* =================================================
              MOBILE / TABLET MENU

              lg:hidden means the hamburger can appear before
              the full desktop nav becomes available.
          ================================================== */}
              <button
                  type="button"
                  data-testid="mobile-menu-toggle"
                  aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={mobileOpen}
                  aria-controls="mobile-menu"
                  onClick={() => setMobileOpen((o) => !o)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 xl:hidden ${
                      mobileOpen
                          ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300'
                          : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                  }`}
              >
                {mobileOpen ? (
                    <X
                        className="h-6 w-6"
                        aria-hidden="true"
                    />
                ) : (
                    <Menu
                        className="h-6 w-6"
                        aria-hidden="true"
                    />
                )}
              </button>

            </div>
          </div>
        </div>


        {/* =========================================================
        MOBILE MENU
    ========================================================= */}
        {mobileOpen && (
            <nav
                id="mobile-menu"
                aria-label="Mobile"
                data-testid="mobile-menu"
                className="border-t border-slate-200/80 bg-white/95 px-4 pb-5 pt-3 shadow-[0_15px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-slate-950/95"
            >

              <div className="mx-auto max-h-[75vh] max-w-7xl space-y-1 overflow-y-auto">

                {/* Role links */}
                {appLinks.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={closeAll}
                        className={({ isActive }) =>
                            `flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                isActive
                                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'
                            }`
                        }
                    >
                      {item.label}

                      <span className="text-slate-300">
                →
              </span>
                    </NavLink>
                ))}


                {appLinks.length > 0 && (
                    <div className="my-3 border-t border-slate-200 dark:border-white/10" />
                )}


                {/* Public links
              These remain available in mobile even when logged in. */}
                {publicLinks.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={closeAll}
                        className={({ isActive }) =>
                            `flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                isActive
                                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'
                            }`
                        }
                    >
                      {item.label}

                      <span className="text-slate-300">
                →
              </span>
                    </NavLink>
                ))}


                <div className="my-3 border-t border-slate-200 dark:border-white/10" />


                {/* Authenticated mobile */}
                {isAuthenticated ? (
                    <>

                      {role !== 'admin' && (
                          <NavLink
                              to="/profile"
                              onClick={closeAll}
                              className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                          >
                            My Profile

                            <span className="text-slate-300">
                    →
                  </span>
                          </NavLink>
                      )}

                      <button
                          type="button"
                          onClick={() => void onLogout()}
                          data-testid="mobile-logout"
                          className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        Log out

                        <span>
                  ↪
                </span>
                      </button>

                    </>

                ) : (

                    /* Guest mobile */
                    <div className="grid grid-cols-2 gap-2">

                      <Link
                          to="/login"
                          onClick={closeAll}
                          className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      >
                        Log in
                      </Link>

                      <Link
                          to="/register"
                          onClick={closeAll}
                          className="rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-primary-600/20"
                      >
                        Get started
                      </Link>

                    </div>
                )}

              </div>

            </nav>
        )}

      </header>
  );
}
