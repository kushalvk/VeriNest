import { Outlet } from 'react-router-dom';
import { Info } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import ChatWidget from './ChatWidget';
import { useAuthStore } from '../store/authStore';

/**
 * Standing reminder that this is a shared guest account whose data the backend
 * wipes on every demo sign-in — so nobody mistakes the demo for their own
 * workspace, or leaves anything here expecting to find it later.
 */
function DemoModeBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <Info className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
      You're exploring VeriNest with a shared <strong>demo account</strong>. Everything works,
      but the demo data is reset each time someone signs in with these credentials — don't
      upload anything real.
    </div>
  );
}

/**
 * Universal site shell — Header + page content + Footer on EVERY route,
 * public and authenticated alike (supersedes the old auth-only Layout).
 * The chat widget (and, inside Header, the notification bell) only mount
 * while authenticated, so their polling and FAB never exist for guests.
 *
 * Auth state is in-memory and synchronous (zustand), so the header renders
 * its final logged-in/out variant on first paint — no resolving flash.
 */
export default function AppShell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDemo = useAuthStore((s) => Boolean(s.user?.isDemo));

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {isAuthenticated && isDemo && <DemoModeBanner />}
      <Header />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
      {isAuthenticated && <ChatWidget />}
    </div>
  );
}
