import { useCallback, useEffect, useRef, useState } from 'react';
import * as notificationApi from '../api/notificationApi';
import { useAuthStore } from '../store/authStore';
import type { AppNotification } from '../api/notificationApi';

const POLL_MS = 30_000;

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const eventLabel: Record<string, string> = {
  verification_request: 'verification',
  application: 'application',
  agreement: 'agreement',
  rent_due: 'rent',
  document_expired: 'documents',
  general: 'update',
};

export default function NotificationBell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await notificationApi.getMyNotifications();
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // polling is best-effort; keep last known state
    }
  }, []);

  // Poll ONLY while authenticated — the interval dies with this component
  // (Layout unmounts on logout), and the guard below covers state races.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated, load]);

  // close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markRead = async (notification: AppNotification) => {
    if (notification.isRead) return;
    setError('');
    // optimistic update…
    setItems((list) => list.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationApi.markNotificationRead(notification._id);
    } catch {
      // …with rollback when the backend call actually fails
      setItems((list) => list.map((n) => (n._id === notification._id ? { ...n, isRead: false } : n)));
      setUnreadCount((c) => c + 1);
      setError('Could not mark as read — please try again.');
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button type="button" data-testid="notification-bell" aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-ink-muted hover:bg-surface-muted">
        <span aria-hidden="true" className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span data-testid="unread-badge"
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div data-testid="notification-panel"
          className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-4 py-2 text-sm font-semibold text-ink">
            Notifications
          </div>
          {error && <p className="px-4 py-2 text-xs text-red-600" data-testid="bell-error">{error}</p>}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-ink-faint">No notifications yet.</p>
            )}
            {items.map((n) => (
              <button key={n._id} type="button" onClick={() => void markRead(n)}
                data-testid="notification-item" data-read={n.isRead}
                className={`block w-full border-b border-line px-4 py-3 text-left transition hover:bg-surface-muted ${
                  n.isRead ? 'bg-surface' : 'bg-primary-50/60 dark:bg-primary-500/10'
                }`}>
                <div className="flex items-start gap-2">
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" />}
                  <div className="min-w-0">
                    <p className={`text-sm ${n.isRead ? 'font-normal text-ink-muted' : 'font-semibold text-ink'}`}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-faint">{n.message}</p>
                    <p className="mt-1 text-xs text-ink-faint">
                      <span className="rounded bg-canvas px-1.5 py-0.5">{eventLabel[n.event] ?? n.event}</span>
                      {' · '}{relativeTime(n.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
