/** A small laurel wreath, open at the top, used as the centre of ornamental dividers. */
export function Laurel({ size = 34, className = "" }: { size?: number; className?: string }) {
  const leaves = Array.from({ length: 6 }, (_, i) => i);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      {[-1, 1].map((side) => (
        <g key={side} transform={side === 1 ? "translate(32 0) scale(-1 1)" : undefined}>
          {/* Branch: an arc from the tied stems at the bottom up the left side. */}
          <path d="M15 27 A11 11 0 0 1 6.2 9.5" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
          {leaves.map((i) => {
            // Leaves sit along the branch from bottom (255°) to the top (150°), pointing up the
            // branch and tilted 30° outward.
            const angle = 255 - i * 21;
            const rad = (angle * Math.PI) / 180;
            const x = 16 + 11 * Math.cos(rad);
            const y = 16 - 11 * Math.sin(rad);
            const leaf = ((angle - 60) * Math.PI) / 180;
            const lx = x + 2.4 * Math.cos(leaf);
            const ly = y - 2.4 * Math.sin(leaf);
            return (
              <ellipse
                key={i}
                cx={lx}
                cy={ly}
                rx="1.25"
                ry="2.9"
                fill="currentColor"
                transform={`rotate(${150 - angle} ${lx} ${ly})`}
              />
            );
          })}
        </g>
      ))}
      <circle cx="16" cy="27.4" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** Thin gold rule with a laurel in the middle. */
export function LaurelDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`ornament ${className}`}>
      <Laurel />
    </div>
  );
}
