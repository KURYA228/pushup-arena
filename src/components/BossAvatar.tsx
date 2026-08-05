/**
 * Stylised fighter drawn from the boss's difficulty tier. Every dimension — shoulders, arms,
 * chest, neck, legs — is interpolated from `tier` (0 for the first boss, 1 for the last), so the
 * silhouette visibly bulks up as the arena gets harder. Muscle definition (traps, pecs, abs)
 * fades in past a threshold rather than being drawn faintly from the start, which keeps the
 * early bosses looking lean instead of just small.
 */
export function BossAvatar({
  color,
  tier,
  size = 96,
  className,
}: {
  color: string;
  tier: number;
  size?: number;
  className?: string;
}) {
  const t = Math.min(1, Math.max(0, tier));

  const shoulder = 16 + 13 * t;
  const chest = 12.5 + 8 * t;
  const waist = 9 + 4 * t;
  const arm = 4.4 + 4.2 * t;
  const neck = 3.4 + 3.2 * t;
  // Thighs outgrow arms deliberately — matching arm thickness reads as spindly legs on the
  // heavier bosses, which undercuts the whole point of the silhouette.
  const thigh = 7.5 + 4.8 * t;

  const shade = 'rgba(0,0,0,0.34)';
  const light = 'rgba(255,255,255,0.13)';

  const showTraps = t > 0.12;
  const showAbs = t > 0.32;
  const showVeins = t > 0.66;

  // Eyes tilt further inward on the harder bosses — the cheapest way to read as "angrier".
  const glare = 8 + 20 * t;

  const sides = [-1, 1];

  return (
    <svg
      viewBox="0 0 100 136"
      width={size}
      height={(size * 136) / 100}
      className={className}
      role="img"
      aria-hidden="true"
    >
      {/* Legs */}
      {sides.map((s) => (
        <g key={`leg${s}`}>
          <ellipse
            cx={50 + s * (waist * 0.55)}
            cy={97}
            rx={thigh}
            ry={16}
            fill={color}
            stroke={shade}
            strokeWidth={0.8}
          />
          <ellipse
            cx={50 + s * (waist * 0.62)}
            cy={121}
            rx={thigh * 0.74}
            ry={13}
            fill={color}
            stroke={shade}
            strokeWidth={0.8}
          />
        </g>
      ))}

      {/* Hips */}
      <path
        d={`M${50 - waist} 72 L${50 + waist} 72 L${50 + waist * 1.05} 88 L${50 - waist * 1.05} 88 Z`}
        fill={color}
        stroke={shade}
        strokeWidth={0.8}
      />

      {/* Torso */}
      <path
        d={`M${50 - chest} 34 L${50 + chest} 34 Q${50 + chest + 1.5} 55 ${50 + waist} 76 L${50 - waist} 76 Q${50 - chest - 1.5} 55 ${50 - chest} 34 Z`}
        fill={color}
        stroke={shade}
        strokeWidth={0.9}
      />

      {/* Trapezius sloping from neck to shoulders */}
      {showTraps && (
        <path
          d={`M${50 - neck - 1} 26 Q${50 - shoulder * 0.7} ${30 - 4 * t} ${50 - chest} 35 L${50 + chest} 35 Q${50 + shoulder * 0.7} ${30 - 4 * t} ${50 + neck + 1} 26 Z`}
          fill={color}
          stroke={shade}
          strokeWidth={0.8}
        />
      )}

      {/* Pecs */}
      {sides.map((s) => (
        <ellipse
          key={`pec${s}`}
          cx={50 + s * chest * 0.47}
          cy={45}
          rx={chest * 0.44}
          ry={chest * 0.3}
          fill={light}
          stroke={shade}
          strokeWidth={0.7}
        />
      ))}

      {/* Abs */}
      {showAbs &&
        [0, 1, 2].map((row) =>
          sides.map((s) => (
            <rect
              key={`ab${row}${s}`}
              x={50 + s * 1.2 - (s < 0 ? waist * 0.62 : 0)}
              y={55 + row * 6}
              width={waist * 0.62}
              height={4.4}
              rx={1.6}
              fill={light}
              stroke={shade}
              strokeWidth={0.5}
            />
          )),
        )}

      {/* Arms */}
      {sides.map((s) => {
        const upperX = 50 + s * (shoulder + arm * 0.15);
        const foreX = 50 + s * (shoulder + arm * 0.95);
        return (
          <g key={`arm${s}`}>
            {/* Deltoid cap */}
            <circle
              cx={50 + s * (shoulder - arm * 0.3)}
              cy={38}
              r={arm * 1.35}
              fill={color}
              stroke={shade}
              strokeWidth={0.8}
            />
            {/* Upper arm with the bicep bulge */}
            <ellipse
              cx={upperX}
              cy={52}
              rx={arm}
              ry={13}
              transform={`rotate(${s * 7} ${upperX} 52)`}
              fill={color}
              stroke={shade}
              strokeWidth={0.8}
            />
            <ellipse
              cx={upperX - s * arm * 0.15}
              cy={48}
              rx={arm * 0.55}
              ry={6.5}
              fill={light}
              stroke="none"
            />
            {/* Forearm */}
            <ellipse
              cx={foreX}
              cy={74}
              rx={arm * 0.78}
              ry={12}
              transform={`rotate(${s * 11} ${foreX} 74)`}
              fill={color}
              stroke={shade}
              strokeWidth={0.8}
            />
            {/* Fist */}
            <circle
              cx={50 + s * (shoulder + arm * 1.5)}
              cy={88}
              r={arm * 0.85}
              fill={color}
              stroke={shade}
              strokeWidth={0.8}
            />
            {showVeins && (
              <path
                d={`M${foreX - s * 1.5} 68 q${s * 2.5} 5 ${-s * 1} 11`}
                fill="none"
                stroke={shade}
                strokeWidth={0.6}
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}

      {/* Neck */}
      <rect x={50 - neck} y={22} width={neck * 2} height={10} rx={neck * 0.5} fill={color} stroke={shade} strokeWidth={0.8} />

      {/* Head */}
      <circle cx={50} cy={16} r={10.5} fill={color} stroke={shade} strokeWidth={0.9} />
      {sides.map((s) => (
        <rect
          key={`eye${s}`}
          x={50 + s * 5.4 - 2.6}
          y={14}
          width={5.2}
          height={2.2}
          rx={1}
          fill="rgba(0,0,0,0.6)"
          transform={`rotate(${s * glare} ${50 + s * 5.4} 15)`}
        />
      ))}
    </svg>
  );
}
