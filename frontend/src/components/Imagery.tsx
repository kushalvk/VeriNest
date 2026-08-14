import { useState, type ReactNode } from 'react';
import { HouseArtwork } from './Artwork';
import type { Photo } from '../assets/photos';

/**
 * Decorative imagery primitives for the public pages.
 *
 * The rule every component here follows: the photo is a *layer*, never the
 * design. Underneath it there is always the brand gradient that these sections
 * used before, and on top of it always a scrim — so the text contrast is set by
 * the gradient, not by whatever pixels the photo happens to contain, and a
 * photo that never arrives costs nothing but a little richness.
 */

/**
 * The <img> itself: absolutely positioned, cover-cropped, and self-removing on
 * error. Always decorative — alt is empty and it is hidden from screen readers,
 * because the surrounding heading already says what the section is.
 */
export function PhotoLayer({
  photo,
  className = '',
  sizes = '100vw',
  /** Above-the-fold photos should load eagerly; everything else stays lazy. */
  eager = false,
}: {
  photo: Photo;
  className?: string;
  sizes?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <img
      src={photo.src}
      srcSet={photo.srcSet}
      sizes={sizes}
      alt=""
      aria-hidden="true"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
      style={photo.position ? { objectPosition: photo.position } : undefined}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}

/**
 * A full-bleed brand band with a photo behind it: indigo gradient → photo →
 * scrim → content. Text on it is fixed white in both themes (the band is dark
 * either way), which is the same rule the original gradient hero followed.
 *
 * `scrim="hero"` keeps the left column readable while letting the right side of
 * the picture breathe — right for tall sections with a single text column.
 * `scrim="band"` is flatter and darker across the full width, for short banners
 * whose text runs the whole way.
 */
export function PhotoBand({
  photo,
  children,
  scrim = 'band',
  eager = false,
  className = '',
}: {
  photo: Photo;
  children: ReactNode;
  scrim?: 'hero' | 'band';
  eager?: boolean;
  className?: string;
}) {
  // Opacity modifiers MUST stay on Tailwind's 5-step scale. An off-scale value
  // (/92, /82…) generates no rule at all, and this div then inherits the
  // section's own --tw-gradient-* variables — an opaque scrim that hides the
  // photo completely, with nothing in the console to say why.
  const scrimClass =
    scrim === 'hero'
      ? 'bg-gradient-to-r from-primary-950/90 via-primary-900/80 to-primary-900/55'
      : 'bg-gradient-to-r from-primary-950/90 via-primary-900/85 to-primary-900/75';

  return (
    <section
      className={`relative isolate overflow-hidden bg-gradient-to-br from-primary-700 to-primary-900 text-white ${className}`}
    >
      <PhotoLayer photo={photo} eager={eager} />
      <div aria-hidden="true" className={`absolute inset-0 ${scrimClass}`} />
      {/* A bright photo that reads fine against a light page glares against a
          dark one, so dark mode gets a second, flat layer of depth. */}
      <div aria-hidden="true" className="absolute inset-0 dark:bg-primary-950/40" />
      <div className="relative">{children}</div>
    </section>
  );
}

/**
 * A block of text beside a photo. Alternate `side` down a list of these and
 * the page zig-zags, which gives each row its own shape and stops a run of
 * identical cards from turning into wallpaper.
 *
 * The `md:order-*` swap only applies from `md` up. Below that the grid
 * collapses to DOM order, which is text first every time — on a phone a
 * picture above the words it illustrates reads backwards.
 */
export function PhotoSplit({
  photo,
  side = 'right',
  children,
}: {
  photo: Photo;
  /** Which side the photo takes from `md` up. */
  side?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <div className={side === 'left' ? 'md:order-2' : ''}>{children}</div>
      <figure
        className={`relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-muted shadow-card ${
          side === 'left' ? 'md:order-1' : ''
        }`}
      >
        {/* Underneath the photo, so a photo that never loads leaves an
            illustrated tile rather than an empty grey rectangle. */}
        <HouseArtwork className="absolute inset-0 m-auto h-1/2 w-auto text-ink-faint" />
        <PhotoLayer photo={photo} sizes="(min-width: 768px) 50vw, 100vw" />
      </figure>
    </div>
  );
}

/**
 * The soft photo wash behind an auth page's card. Muted hard (and harder still
 * in dark mode) and faded into the page background, so it reads as texture —
 * the card must stay the only thing competing for attention.
 *
 * Expects a `relative isolate` parent; it parks itself on a negative z-index
 * inside that stacking context, which keeps it behind the card without
 * escaping to sit behind the page.
 */
export function AuthBackdrop({ photo }: { photo: Photo }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <PhotoLayer photo={photo} className="opacity-30 dark:opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/75 via-canvas/85 to-canvas" />
    </div>
  );
}
