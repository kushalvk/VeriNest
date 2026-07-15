import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'verinest-theme';

/**
 * Light/dark switch. The `.dark` class on <html> drives the semantic
 * surface tokens (index.css); index.html applies the saved choice before
 * first paint, so this component only needs to read the current state.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // storage unavailable — theme still applies for this session
    }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      data-testid="theme-toggle"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="rounded-full p-2 text-ink-muted hover:bg-surface-muted hover:text-ink"
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}
