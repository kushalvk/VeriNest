import { Link } from 'react-router-dom';
import { AtSign, Globe, Mail, MessageCircle } from 'lucide-react';

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

// Placeholder social presences — non-functional links are fine for MVP.
// (lucide no longer ships brand glyphs, so these use generic icons.)
const socialLinks = [
  { label: 'social media', Icon: AtSign },
  { label: 'community chat', Icon: MessageCircle },
  { label: 'the web', Icon: Globe },
];

const footerLink =
  'text-sm text-ink-muted transition hover:text-primary-700 hover:underline dark:hover:text-primary-300';

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface" data-testid="site-footer">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr,1fr,1fr,1fr]">
        {/* brand */}
        <div className="max-w-sm">
          <p className="text-lg font-bold tracking-tight text-ink">
            Veri<span className="text-primary-600 dark:text-primary-400">Nest</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Verified tenants, trusted landlords. VeriNest brings document verification,
            trust scores, and digitally signed agreements together so renting is
            transparent for both sides.
          </p>
        </div>

        {/* quick links */}
        <nav aria-label="Explore">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink">Explore</p>
          <ul className="mt-4 space-y-2.5">
            {exploreLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className={footerLink}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* legal / support */}
        <nav aria-label="Legal">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink">Legal</p>
          <ul className="mt-4 space-y-2.5">
            {legalLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className={footerLink}>{l.label}</Link>
              </li>
            ))}
            <li>
              <Link to="/contact" className={footerLink}>Support</Link>
            </li>
          </ul>
        </nav>

        {/* connect */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-ink">Connect</p>
          <div className="mt-4 flex gap-2">
            {socialLinks.map(({ label, Icon }) => (
              <a key={label} href="#" aria-label={`VeriNest on ${label} (coming soon)`}
                onClick={(e) => e.preventDefault()}
                className="rounded-full border border-line p-2 text-ink-muted transition hover:border-primary-300 hover:text-primary-700 dark:hover:text-primary-300">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </a>
            ))}
            <Link to="/contact" aria-label="Email us"
              className="rounded-full border border-line p-2 text-ink-muted transition hover:border-primary-300 hover:text-primary-700 dark:hover:text-primary-300">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-3 text-xs text-ink-faint">Social profiles coming soon.</p>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 sm:flex-row sm:px-6">
          <p className="text-xs text-ink-faint">
            &copy; {new Date().getFullYear()} VeriNest. All rights reserved.
          </p>
          {/* Unsplash's licence doesn't require credit — we give it anyway. */}
          <p className="text-xs text-ink-faint">
            Built for transparent renting · Photography from{' '}
            <a href="https://unsplash.com" target="_blank" rel="noreferrer noopener"
              className="hover:text-primary-700 hover:underline dark:hover:text-primary-300">
              Unsplash
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
