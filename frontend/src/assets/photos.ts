/**
 * Photography for VeriNest's public-facing pages.
 *
 * Photos are hotlinked from the Unsplash CDN (their licence permits it) and
 * requested at four widths, so the browser downloads the cheapest file that
 * fits the slot instead of a 2000px hero on a phone.
 *
 * Nothing here is load-bearing. Every photo is rendered through <PhotoLayer>,
 * which sits ON TOP of the brand gradient and removes itself if the request
 * fails — a visitor who is offline, behind a corporate proxy, or running an
 * aggressive blocker still gets the original solid-gradient design rather than
 * a broken image box.
 *
 * Deliberately public-only: the home page, the auth pages, property search and
 * the About/Services/Contact pages. In-app screens (dashboard, documents,
 * applications, agreements, admin) stay photo-free, and the places that still
 * want a visual — an empty state, a listing with no photos — use the
 * theme-aware SVG in components/Artwork.tsx instead, because a stock photo
 * standing in for a real listing would be misleading.
 */

export interface Photo {
  /** Fallback for browsers that ignore srcSet. */
  src: string;
  srcSet: string;
  /**
   * What the photo shows. Documentation only — these are decorative, so
   * PhotoLayer renders them with an empty alt and aria-hidden.
   */
  description: string;
  /** CSS object-position, for photos whose subject isn't centred. */
  position?: string;
}

const WIDTHS = [640, 1024, 1600, 2000];

const unsplash = (id: string, description: string, position?: string): Photo => {
  const at = (w: number) =>
    `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=70&w=${w}`;
  return {
    src: at(1600),
    srcSet: WIDTHS.map((w) => `${at(w)} ${w}w`).join(', '),
    description,
    position,
  };
};

export const photos = {
  /** Home hero — a family home lit from inside at dusk. */
  home: unsplash('1568605114967-8130f3a36994', 'A family home lit from inside at dusk'),
  /** Home closing CTA band. */
  homeCta: unsplash(
    '1570129477492-45c003edd2be',
    'A white clapboard house behind a green lawn'
  ),
  /**
   * Register, OTP and role selection — moving into a new place. Backdrops must
   * be wide scenes, not macro shots: blurred back to a texture, a close-up of
   * keys on a desk turns into an unreadable smudge, a room does not.
   */
  authNewHome: unsplash(
    '1522708323590-d24dbb6b0267',
    'A bright, newly furnished apartment'
  ),
  /** Login and password reset — a calm, sunlit living room. */
  authLiving: unsplash(
    '1560448204-e02f11c3d0e2',
    'A sunlit living room looking out over the rooftops'
  ),
  /**
   * Property search banner. The band is a letterbox strip, so this needs a
   * horizontal subject that survives an aggressive crop — a street of houses
   * does, a single building shot head-on becomes an abstract wall.
   */
  search: unsplash(
    '1567496898669-ee935f5f647a',
    'A street of townhouses in a row'
  ),
  about: unsplash('1519501025264-65ba15a82390', 'A city avenue at dusk'),
  services: unsplash(
    '1554995207-c18c203602cb',
    'An open-plan living room with a tan leather sofa'
  ),
  contact: unsplash(
    '1522071820081-009f0129c71c',
    'People working together around a table'
  ),

  /**
   * The dashboard greeting band. Same letterbox problem as the search banner,
   * only worse — a skyline is one of the few subjects that reads at 7:1.
   */
  dashboard: unsplash('1512453979798-5ea266f8880c', 'A city skyline at sunrise'),

  /** Home page feature rows, in order. */
  featureDocuments: unsplash(
    '1554224155-6726b3ff858f',
    'Paperwork, a calculator and a phone spread across a desk'
  ),
  featureTrust: unsplash(
    '1583847268964-b28dc8f51f92',
    'A calm living room with a grey sofa and framed prints'
  ),
  featureAgreement: unsplash(
    '1521791136064-7986c2920216',
    'Two people shaking hands'
  ),

  /** Services page rows, in order. */
  servicesTenant: unsplash(
    '1484154218962-a197022b5858',
    'A modern kitchen with an island'
  ),
  servicesLandlord: unsplash(
    '1600585154340-be6161a56a0c',
    'A contemporary house lit from inside at dusk'
  ),
  servicesEveryone: unsplash(
    '1502672260266-1c1ef2d93688',
    'A cosy living room full of plants'
  ),
} satisfies Record<string, Photo>;
