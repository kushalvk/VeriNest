import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import ChatWidget from './ChatWidget';
import { useAuthStore } from '../store/authStore';

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

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
      {isAuthenticated && <ChatWidget />}
    </div>
  );
}
