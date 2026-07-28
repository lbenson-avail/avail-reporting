import { useState } from 'react';

// Avail logo. Prefers the official asset at /avail-logo.png (drop the PNG into
// the repo's public/ folder and it takes over automatically); falls back to an
// inline SVG recreation of the six-petal pinwheel mark + wordmark.
export function AvailLogo({ className }) {
  const [hasPng, setHasPng] = useState(true);

  if (hasPng) {
    return (
      <img
        src="/avail-logo.png"
        alt="Avail"
        className={`h-7 w-auto ${className || ''}`}
        onError={() => setHasPng(false)}
      />
    );
  }

  return (
    <span className={`flex items-center gap-2 ${className || ''}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Avail logo"
        className="shrink-0"
      >
        <g fill="#2E6BF6">
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 50 50)`}>
              {/* Rounded petal pointing inward, tilted for the pinwheel motion. */}
              <path
                transform="rotate(16 50 24)"
                d="M 41 2 H 59 Q 68 2 68 11 V 30 L 50 45 L 32 30 V 11 Q 32 2 41 2 Z"
              />
            </g>
          ))}
        </g>
      </svg>
      <span className="text-foreground text-lg leading-none font-bold tracking-tight lowercase">
        avail
      </span>
    </span>
  );
}
