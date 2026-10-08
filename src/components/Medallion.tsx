interface MedallionProps {
  monogram: string;
  size?: number;
  dim?: boolean;
}

/** A coin-like medallion: laurel wreath around the philosopher's initial. */
export function Medallion({ monogram, size = 120, dim = false }: MedallionProps) {
  const leaves = Array.from({ length: 9 }, (_, i) => i);
  const stroke = dim ? "#6f665a" : "#c9a96e";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <radialGradient id={`face-${monogram}-${dim}`} cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor={dim ? "#2a241d" : "#3a2f22"} />
          <stop offset="100%" stopColor="#120f0b" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill={`url(#face-${monogram}-${dim})`} stroke={stroke} strokeOpacity="0.55" />
      <circle cx="60" cy="60" r="51" fill="none" stroke={stroke} strokeOpacity="0.25" strokeDasharray="1 3" />
      {[-1, 1].map((side) => (
        <g key={side} transform={side === 1 ? "translate(120 0) scale(-1 1)" : undefined}>
          {leaves.map((i) => {
            // Left branch climbs from the bottom (265°) up to the upper left (153°); the right is mirrored.
            const angle = 265 - i * 14;
            const rad = (angle * Math.PI) / 180;
            const x = 60 + 44 * Math.cos(rad);
            const y = 60 - 44 * Math.sin(rad);
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx="2.4"
                ry="6"
                fill={stroke}
                fillOpacity={dim ? 0.35 : 0.7}
                // Align each leaf with the circle's tangent, tilted slightly outward.
                transform={`rotate(${180 - angle + 25} ${x} ${y})`}
              />
            );
          })}
        </g>
      ))}
      <text
        x="60"
        y="61"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-cormorant), Georgia, serif"
        fontSize="46"
        fontWeight="500"
        fill={dim ? "#8a7f70" : "#e2c58c"}
      >
        {monogram}
      </text>
    </svg>
  );
}
