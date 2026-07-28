// Avail logo — inline SVG recreation of the six-petal pinwheel mark plus the
// lowercase wordmark. Swap in the official SVG asset any time by replacing
// this component's contents.
export function AvailLogo({ className }) {
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
            <path
              key={deg}
              transform={`rotate(${deg} 50 50)`}
              // Tag-shaped petal pointing toward the center.
              d="M 39 2 h 22 q 8 0 8 8 v 20 l -19 15 l -19 -15 v -20 q 0 -8 8 -8 z"
            />
          ))}
        </g>
      </svg>
      <span className="text-foreground text-lg leading-none font-bold tracking-tight lowercase">
        avail
      </span>
    </span>
  );
}
