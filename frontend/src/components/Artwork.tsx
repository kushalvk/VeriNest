/**
 * Hand-drawn SVG artwork, for the places a photograph would be wrong.
 *
 * What lands here rather than in photos.ts: anything standing in for content
 * that doesn't exist yet. A listing with no photos must not borrow a stock
 * house — an illustration honestly says "no picture yet", a photo of somebody
 * else's home claims to be this one. It also backs `PhotoSplit`, so a photo
 * that fails to load leaves a drawing rather than a hole.
 *
 * Everything draws in `currentColor` at low opacities, so the parent's text
 * colour decides the tone and both themes are handled for free.
 */

/**
 * A simple house. Decorative by default; pass `title` to give it a name and
 * expose it to screen readers (worth doing when it stands in for missing
 * content rather than merely decorating something already labelled).
 */
export function HouseArtwork({
  className = '',
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 140"
      fill="none"
      className={className}
      {...(title ? { role: 'img' as const } : { 'aria-hidden': true })}
    >
      {title && <title>{title}</title>}

      {/* ground */}
      <path
        d="M18 122h164"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".25"
      />

      {/* chimney — drawn first so the roof crops it */}
      <path
        d="M124 60V32h13v28z"
        fill="currentColor"
        fillOpacity=".12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* walls */}
      <path
        d="M54 72v50h92V72"
        fill="currentColor"
        fillOpacity=".06"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* roof */}
      <path
        d="M100 28 156 72H44z"
        fill="currentColor"
        fillOpacity=".14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* door */}
      <path
        d="M88 122v-16a12 12 0 0 1 24 0v16"
        fill="currentColor"
        fillOpacity=".12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* windows */}
      {[64, 118].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y="84"
            width="18"
            height="18"
            rx="2"
            fill="currentColor"
            fillOpacity=".1"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d={`M${x + 9} 84v18M${x} 93h18`}
            stroke="currentColor"
            strokeWidth="2"
            opacity=".5"
          />
        </g>
      ))}

      {/* shrubs */}
      <circle
        cx="32"
        cy="112"
        r="10"
        fill="currentColor"
        fillOpacity=".12"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle
        cx="170"
        cy="114"
        r="8"
        fill="currentColor"
        fillOpacity=".12"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}
