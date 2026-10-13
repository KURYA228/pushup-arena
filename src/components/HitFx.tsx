import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** One landed blow, for the effects over the enemy. A new `id` plays them again. */
export interface Hit {
  id: number;
  crit: boolean;
  /** Where the enemy's picture was when struck, in px within the effects' container. */
  box: { left: number; top: number; width: number; height: number };
  /**
   * Shredder's katana: a cold steel cut instead of the gold one — two crossing, a beat apart,
   * when it's both blades (the sound is told the same, so the two land together).
   */
  katana?: { double: boolean };
}

/**
 * What a rep looks like landing: a blade's streak across the enemy (a cross of two on a crit),
 * a flash and a spray of sparks where it struck, and on a crit a shockwave rolling out from it.
 * Laid over the artwork and click-through. The point and the angle change every blow, so a set
 * of twenty reads as twenty separate hits rather than one loop. Nothing under reduced motion.
 */
export function HitFx({ hit }: { hit: Hit | null }) {
  const calm = useReducedMotion();
  if (!hit || calm) return null;
  return <Strike key={hit.id} crit={hit.crit} box={hit.box} katana={hit.katana} />;
}

/** The sparks are every colour — a burst of confetti-fire rather than one hot metal. */
const SPARK_COLORS = ['#ffffff', '#fde047', '#f59e0b', '#ef4444', '#f472b6', '#a78bfa', '#38bdf8', '#34d399'];
/** Off a katana: steel-white sparks with a few of his red. */
const STEEL_SPARKS = ['#ffffff', '#e2e8f0', '#cbd5e1', '#f8fafc', '#ef4444'];
/** Seconds between Shredder's two blades — the same gap the sound leaves (KATANA_GAP_SEC). */
const KATANA_GAP = 0.08;

function Strike({ crit, box, katana }: { crit: boolean; box: Hit['box']; katana?: Hit['katana'] }) {
  // Fixed per blow: where it lands, which way the blade travels, which way the sparks fly.
  const s = useMemo(() => {
    const angle = -35 + Math.random() * 70 + (Math.random() < 0.5 ? 0 : 180);
    const count = crit ? 38 : 24;
    return {
      // Around the middle of the figure, never at its edges.
      x: 38 + Math.random() * 24,
      y: 30 + Math.random() * 26,
      angle,
      sparks: Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        // Most fly far, a few stay close — a spray, not a ring.
        const d = (crit ? 120 : 82) * (0.35 + Math.random() * 0.65);
        return {
          dx: Math.cos(a) * d,
          dy: Math.sin(a) * d,
          rot: (a * 180) / Math.PI,
          len: 10 + Math.random() * (crit ? 22 : 15),
          delay: Math.random() * 0.06,
          color: katana
            ? STEEL_SPARKS[Math.floor(Math.random() * STEEL_SPARKS.length)]
            : SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        };
      }),
    };
  }, [crit, katana]);

  const slashColor = katana ? '#cbd5e1' : crit ? '#ff6a3d' : '#fde68a';
  // A katana's second blade crosses the first steeply, the way two swords cut an X.
  const slashes = katana ? (katana.double ? [s.angle, s.angle + 62] : [s.angle]) : crit ? [s.angle, s.angle + 74] : [s.angle];
  const gap = katana ? KATANA_GAP : 0.07;
  /** Each streak is the blade's edge with two fainter lines riding beside it, like a swing's wake. */
  const LINES = [
    { offset: 0, thick: 1, len: 1, fade: 1 },
    { offset: -11, thick: 0.35, len: 0.78, fade: 0.75 },
    { offset: 12, thick: 0.3, len: 0.66, fade: 0.6 },
  ];
  // A sword's cut is longer and finer than a fist's.
  const W = katana ? 330 : crit ? 340 : 260;
  const H = katana ? 3.5 : crit ? 6 : 4;

  return (
    <div aria-hidden className="pointer-events-none absolute z-20 overflow-visible" style={box}>
      <div className="absolute" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
        {/* The blade's streak: drawn out along its path from one end, then gone. */}
        {slashes.map((a, i) => (
          <div key={i} className="absolute left-0 top-0" style={{ transform: `rotate(${a}deg)` }}>
            {LINES.map((l, j) => (
              <motion.div
                key={j}
                className="absolute rounded-full"
                style={{
                  width: W * l.len,
                  height: Math.max(1.5, H * l.thick),
                  left: (-W * l.len) / 2,
                  top: l.offset - Math.max(1.5, H * l.thick) / 2,
                  transformOrigin: '0% 50%',
                  background: `linear-gradient(90deg, transparent 0%, ${slashColor} 28%, #ffffff 55%, ${slashColor} 80%, transparent 100%)`,
                  // The katana's edge catches his red as it cuts.
                  boxShadow: katana
                    ? `0 0 ${j === 0 ? 8 : 5}px #ffffff, 0 0 ${j === 0 ? 18 : 8}px #ef444488`
                    : `0 0 ${j === 0 ? 10 : 6}px ${slashColor}, 0 0 ${j === 0 ? 22 : 10}px ${slashColor}77`,
                }}
                initial={{ scaleX: 0, scaleY: 1, opacity: l.fade }}
                animate={{ scaleX: [0, 1, 1], scaleY: [1, 1, 0.2], opacity: [l.fade, l.fade, 0] }}
                transition={{
                  duration: crit ? 0.46 : 0.34,
                  delay: i * gap + j * 0.025,
                  times: [0, 0.4, 1],
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>
        ))}

        {/* The flash where it struck. */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 120,
            height: 120,
            left: -60,
            top: -60,
            background: katana
              ? 'radial-gradient(circle, #ffffff 0%, #e2e8f0 25%, #94a3b800 70%)'
              : `radial-gradient(circle, #ffffff 0%, ${crit ? '#ffb199' : '#fff3c4'} 25%, ${crit ? '#ef444400' : '#f59e0b00'} 70%)`,
          }}
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: crit ? 1.9 : 1.2, opacity: 0 }}
          transition={{ duration: crit ? 0.4 : 0.26, ease: 'easeOut' }}
        />

        {/* A crit's shockwave: a ring rolling out from the point of impact. */}
        {crit && (
          <motion.div
            className="absolute rounded-full border-[3px]"
            style={{ width: 60, height: 60, left: -30, top: -30, borderColor: '#ffd2c2', boxShadow: '0 0 18px #ef4444' }}
            initial={{ scale: 0.3, opacity: 0.95 }}
            animate={{ scale: 3.6, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}

        {/* Sparks: short streaks flying out along their own direction. */}
        {s.sparks.map((p, i) => (
          <motion.div
            key={i}
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: p.len,
              height: crit ? 3 : 2,
              marginTop: crit ? -1.5 : -1,
              rotate: p.rot,
              transformOrigin: '0% 50%',
              background: p.color,
              boxShadow: `0 0 6px ${p.color}`,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scaleX: 0.4 }}
            animate={{ x: p.dx, y: p.dy, opacity: [1, 1, 0], scaleX: [0.4, 1.2, 0.2] }}
            transition={{ duration: crit ? 0.6 : 0.45, delay: p.delay, ease: 'easeOut' }}
          />
        ))}
      </div>
    </div>
  );
}
