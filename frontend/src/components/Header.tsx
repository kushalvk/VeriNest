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
  ],
  landlord: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/my-properties', label: 'My Properties' },
    { to: '/received-applications', label: 'Applications' },
    { to: '/rental-history', label: 'Rentals' },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/admin', label: 'Document Review', end: true },
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

const desktopLinkClass = (extra = '') =>
  ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
        : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
    } ${extra}`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2.5 text-base font-medium ${
    isActive
      ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
      : 'text-ink-muted hover:bg-surface-muted'
  }`;

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
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* brand + desktop nav */}
          <div className="flex min-w-0 items-center gap-2 lg:gap-6">
            <Link to={isAuthenticated ? '/dashboard' : '/'} onClick={closeAll}
              className="flex shrink-0 items-center gap-2" data-testid="brand">
              <ShieldCheck className="h-7 w-7 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              <span className="text-lg font-bold tracking-tight text-ink">
                Veri<span className="text-primary-600 dark:text-primary-400">Nest</span>
              </span>
            </Link>

            <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex" data-testid="header-nav">
              {appLinks.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={desktopLinkClass()}>
                  {item.label}
                </NavLink>
              ))}
              {publicLinks.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}
                  // when signed in, marketing links yield to app links on tighter screens
                  className={desktopLinkClass(isAuthenticated ? 'hidden xl:inline-block' : '')}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* right side */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <NotificationBell />
                <div className="relative" ref={menuRef}>
                  <button type="button" data-testid="user-menu"
                    aria-haspopup="menu" aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-full p-1 hover:bg-surface-muted">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                      {initialsOf(user?.fullName)}
                    </span>
                    <ChevronDown aria-hidden="true"
                      className={`hidden h-4 w-4 text-ink-faint transition sm:block ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {menuOpen && (
                    <div role="menu" data-testid="user-menu-panel"
                      className="absolute right-0 z-40 mt-2 w-60 rounded-lg border border-line bg-surface py-1 shadow-lg">
                      <div className="border-b border-line px-4 py-2.5">
                        <p className="truncate text-sm font-semibold text-ink">{user?.fullName}</p>
                        <p className="truncate text-xs text-ink-faint">{user?.email}</p>
                        <p className="mt-1 inline-block rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium capitalize text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                          {role}
                        </p>
                      </div>
                      {role !== 'admin' && (
                        <Link to="/profile" role="menuitem" onClick={closeAll}
                          className="block px-4 py-2 text-sm text-ink-muted hover:bg-surface-muted">
                          My Profile
                        </Link>
                      )}
                      <button type="button" role="menuitem" onClick={() => void onLogout()} data-testid="logout"
                        className="block w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-500/10">
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login" data-testid="header-login"
                  className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink">
                  Log in
                </Link>
                <Link to="/register" data-testid="header-signup"
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700">
                  Sign up
                </Link>
              </div>
            )}

            {/* hamburger */}
            <button type="button" data-testid="mobile-menu-toggle"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen} aria-controls="mobile-menu"
              onClick={() => setMobileOpen((o) => !o)}
              className="rounded-md p-2 text-ink-muted hover:bg-surface-muted lg:hidden">
              {mobileOpen
                ? <X className="h-6 w-6" aria-hidden="true" />
                : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* mobile menu */}
      {mobileOpen && (
        <nav id="mobile-menu" aria-label="Mobile" data-testid="mobile-menu"
          className="border-t border-line bg-surface px-4 pb-4 pt-2 shadow-lg lg:hidden">
          <div className="max-h-[70vh] space-y-0.5 overflow-y-auto">
            {appLinks.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={closeAll} className={mobileLinkClass}>
                {item.label}
              </NavLink>
            ))}
            {appLinks.length > 0 && <div className="my-2 border-t border-line" />}
            {publicLinks.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={closeAll} className={mobileLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <div className="my-2 border-t border-line" />
            {isAuthenticated ? (
              <>
                {role !== 'admin' && (
                  <NavLink to="/profile" onClick={closeAll} className={mobileLinkClass}>
                    My Profile
                  </NavLink>
                )}
                <button type="button" onClick={() => void onLogout()} data-testid="mobile-logout"
                  className="block w-full rounded-md px-3 py-2.5 text-left text-base font-medium text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-500/10">
                  Log out
                </button>
              </>
            ) : (
              <div className="flex gap-2 px-1 pt-1">
                <Link to="/login" onClick={closeAll}
                  className="flex-1 rounded-md border border-line-strong px-4 py-2 text-center text-sm font-medium text-ink-muted hover:bg-surface-muted">
                  Log in
                </Link>
                <Link to="/register" onClick={closeAll}
                  className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-primary-700">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
