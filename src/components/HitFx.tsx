import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { JackO } from './GoblinFx';
import { Paw } from './TaiLungFx';

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
  /** The King's tower cannon: a cannonball slamming in and a puff of smoke, instead of a cut. */
  cannon?: boolean;
  /** The Green Goblin's: a pumpkin bomb lobbed in, bursting orange in a puff of green smoke. */
  pumpkin?: boolean;
  /** Tai Lung's: Po's belly bouncing him — a panda paw print stamped where it lands, a jiggling ring. */
  paw?: boolean;
  /** Ultron's: steel struck — a white-hot spray of sparks and a hex ripple across his plating. */
  metal?: boolean;
  /** Kiryukha's: a fist into muscle on the arena floor — a burst of sand and a heavy shockwave. */
  sand?: boolean;
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
  if (hit.sand) return <SandStrike key={hit.id} crit={hit.crit} box={hit.box} />;
  if (hit.metal) return <MetalStrike key={hit.id} crit={hit.crit} box={hit.box} />;
  if (hit.paw) return <PawStrike key={hit.id} crit={hit.crit} box={hit.box} />;
  if (hit.cannon || hit.pumpkin) return <CannonStrike key={hit.id} crit={hit.crit} box={hit.box} pumpkin={hit.pumpkin} />;
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

/**
 * A shot from the King's tower: an iron ball flying in from below the screen in a short arc,
 * a hot flash where it lands, a ring of grey smoke puffing out and a spray of orange sparks.
 * A crit is a bigger ball and a bigger bang.
 */
/** `pumpkin`: the Goblin's bomb instead — the ball is a jack-o'-lantern, the smoke green. */
function CannonStrike({ crit, box, pumpkin }: { crit: boolean; box: Hit['box']; pumpkin?: boolean }) {
  const s = useMemo(() => {
    const side = Math.random() < 0.5 ? -1 : 1;
    const puffCount = crit ? 10 : 7;
    return {
      x: 38 + Math.random() * 24,
      y: 32 + Math.random() * 24,
      from: { x: side * (120 + Math.random() * 60), y: 220 + Math.random() * 60 },
      puffs: Array.from({ length: puffCount }, (_, i) => {
        const a = (i / puffCount) * Math.PI * 2 + Math.random() * 0.4;
        const d = (crit ? 60 : 42) * (0.6 + Math.random() * 0.4);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.7, size: (crit ? 46 : 34) * (0.7 + Math.random() * 0.5) };
      }),
      sparks: Array.from({ length: crit ? 22 : 14 }, () => {
        const a = Math.random() * Math.PI * 2;
        const d = (crit ? 110 : 80) * (0.4 + Math.random() * 0.6);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, rot: (a * 180) / Math.PI, len: 8 + Math.random() * 12 };
      }),
    };
  }, [crit]);
  const ball = crit ? 30 : 22;
  /** How long the ball is in the air before it lands. */
  const FLY = 0.11;
  return (
    <div aria-hidden className="pointer-events-none absolute z-20 overflow-visible" style={box}>
      <div className="absolute" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
        {/* The ball, arcing in and squashing as it lands. */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: ball,
            height: ball,
            left: -ball / 2,
            top: -ball / 2,
            background: pumpkin ? undefined : 'radial-gradient(circle at 35% 30%, #9ca3af, #374151 45%, #0b0f14 80%)',
            boxShadow: pumpkin ? undefined : '0 0 0 2px #0b0f14',
          }}
          initial={{ x: s.from.x, y: s.from.y, scale: 1.6, opacity: 1 }}
          animate={{ x: [s.from.x, s.from.x * 0.4, 0], y: [s.from.y, s.from.y * 0.1 - 40, 0], scale: [1.6, 1.2, 1, 0.6], opacity: [1, 1, 1, 0] }}
          transition={{ duration: FLY + 0.08, times: [0, 0.4, 0.6, 1], ease: 'easeIn' }}
        >
          {pumpkin && <JackO size={ball} />}
        </motion.div>
        {/* The flash. */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 130, height: 130, left: -65, top: -65, background: 'radial-gradient(circle, #ffffff 0%, #fde68a 25%, #f9731600 70%)' }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, crit ? 2 : 1.3], opacity: [1, 0] }}
          transition={{ duration: crit ? 0.4 : 0.28, delay: FLY, ease: 'easeOut' }}
        />
        {/* Smoke puffing out. */}
        {s.puffs.map((p, i) => (
          <motion.div
            key={`p${i}`}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: -p.size / 2,
              top: -p.size / 2,
              background: pumpkin
                ? 'radial-gradient(circle at 40% 35%, #ecfccb, #84cc16 55%, rgba(54,83,20,0.5))'
                : 'radial-gradient(circle at 40% 35%, #f5f5f4, #a8a29e 60%, rgba(87,83,78,0.5))',
            }}
            initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
            animate={{ x: p.dx, y: p.dy - 14, scale: [0.2, 1, 1.25], opacity: [0, 0.85, 0] }}
            transition={{ duration: 0.6, delay: FLY, ease: 'easeOut' }}
          />
        ))}
        {/* Sparks. */}
        {s.sparks.map((p, i) => (
          <motion.div
            key={`s${i}`}
            className="absolute left-0 top-0 rounded-full"
            style={{ width: p.len, height: 2.5, marginTop: -1.25, rotate: p.rot, transformOrigin: '0% 50%', background: '#fdba74', boxShadow: '0 0 6px #f97316' }}
            initial={{ x: 0, y: 0, opacity: 0, scaleX: 0.4 }}
            animate={{ x: p.dx, y: p.dy, opacity: [1, 1, 0], scaleX: [0.4, 1.2, 0.2] }}
            transition={{ duration: 0.45, delay: FLY, ease: 'easeOut' }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A blow on Tai Lung, the way Po lands them: a big soft one. A black panda paw print is stamped
 * where it hits, tilted, and fades; a white ring wobbles out from it like a belly settling; on a
 * crit there are two prints and a «БОИНГ!».
 */
function PawStrike({ crit, box }: { crit: boolean; box: Hit['box'] }) {
  const s = useMemo(
    () => ({
      x: 34 + Math.random() * 32,
      y: 30 + Math.random() * 30,
      rot: -30 + Math.random() * 60,
      second: { dx: 30 + Math.random() * 20, dy: -20 + Math.random() * 40, rot: -30 + Math.random() * 60 },
    }),
    [],
  );
  const size = crit ? 70 : 52;
  return (
    <div aria-hidden className="pointer-events-none absolute z-20 overflow-visible" style={box}>
      <div className="absolute" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
        {[0, 1].slice(0, crit ? 2 : 1).map((i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: -size / 2 + (i ? s.second.dx : 0), top: -size / 2 + (i ? s.second.dy : 0), rotate: i ? s.second.rot : s.rot, filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }}
            initial={{ scale: 1.8, opacity: 0 }}
            animate={{ scale: [1.8, 0.9, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 0.55, delay: i * 0.1, times: [0, 0.2, 1], ease: 'easeOut' }}
          >
            <Paw size={size} />
          </motion.div>
        ))}
        {/* The wobbling ring. */}
        <motion.div
          className="absolute rounded-full border-[3px] border-white"
          style={{ width: 60, height: 60, left: -30, top: -30 }}
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scaleX: [0.3, 1.6, 1.3, 2], scaleY: [0.3, 1.2, 1.5, 1.8], opacity: [0.9, 0.7, 0.4, 0] }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
        {crit && (
          <motion.div
            className="absolute whitespace-nowrap text-2xl font-black"
            style={{ left: -40, top: -64, color: '#fff', WebkitTextStroke: '1.5px #111', textShadow: '0 3px 0 #111', fontFamily: "'Russo One', sans-serif" }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0], y: [0, -6, -14] }}
            transition={{ duration: 0.7 }}
          >
            БОИНГ!
          </motion.div>
        )}
      </div>
    </div>
  );
}

/**
 * A blow on Ultron: iron on steel. A white-hot flash, a fan of orange-white sparks skittering off
 * his plating, and a ripple of red hexagons spreading from the spot — his armour taking it. A
 * crit is a bigger fan and a second ring.
 */
function MetalStrike({ crit, box }: { crit: boolean; box: Hit['box'] }) {
  const s = useMemo(() => {
    const x = 34 + Math.random() * 32;
    const y = 28 + Math.random() * 34;
    const n = crit ? 30 : 18;
    return {
      x,
      y,
      sparks: Array.from({ length: n }, () => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
        const d = (crit ? 120 : 85) * (0.4 + Math.random() * 0.6);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, len: 6 + Math.random() * 12, rot: (a * 180) / Math.PI };
      }),
    };
  }, [crit]);
  const HEX = 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)';
  return (
    <div aria-hidden className="pointer-events-none absolute z-20 overflow-visible" style={box}>
      <div className="absolute" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
        <motion.div
          className="absolute rounded-full"
          style={{ width: 90, height: 90, left: -45, top: -45, background: 'radial-gradient(circle, #ffffff 0%, #fed7aa 30%, transparent 70%)' }}
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: crit ? 1.8 : 1.2, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
        {/* The hex ripple: rings of hexagons, outlined in red, spreading and fading. */}
        {[0, 1].slice(0, crit ? 2 : 1).map((i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ width: 70, height: 62, left: -35, top: -31, clipPath: HEX, background: 'rgba(239,68,68,0.55)' }}
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 2.4 + i, opacity: 0 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
          >
            <div className="absolute inset-[3px]" style={{ clipPath: HEX, background: 'rgba(17,24,39,0.6)' }} />
          </motion.div>
        ))}
        {s.sparks.map((p, i) => (
          <motion.div
            key={i}
            className="absolute left-0 top-0 rounded-full"
            style={{ width: p.len, height: 2, marginTop: -1, rotate: p.rot, transformOrigin: '0% 50%', background: i % 3 ? '#fdba74' : '#ffffff', boxShadow: '0 0 5px #f97316' }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: p.dx, y: [0, p.dy, p.dy + 40], opacity: [1, 1, 0] }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A blow on Kiryukha: heavy and dull, a fist into a wall of muscle. A ring of force thumping out
 * from it, a burst of arena sand and grit spraying sideways and falling, and on a crit a second,
 * bigger ring and a few golden sparks.
 */
function SandStrike({ crit, box }: { crit: boolean; box: Hit['box'] }) {
  const s = useMemo(() => {
    const n = crit ? 22 : 14;
    return {
      x: 36 + Math.random() * 28,
      y: 30 + Math.random() * 32,
      grains: Array.from({ length: n }, () => {
        const a = Math.random() * Math.PI * 2;
        const d = (crit ? 100 : 70) * (0.4 + Math.random() * 0.6);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.6, s: 3 + Math.random() * 5, c: Math.random() < 0.5 ? '#d6b48a' : '#a8875f' };
      }),
    };
  }, [crit]);
  return (
    <div aria-hidden className="pointer-events-none absolute z-20 overflow-visible" style={box}>
      <div className="absolute" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
        {[0, 1].slice(0, crit ? 2 : 1).map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: 70, height: 70, left: -35, top: -35, border: `${i ? 3 : 5}px solid rgba(253,230,200,0.85)` }}
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 2.2 + i * 1.2, opacity: 0 }}
            transition={{ duration: 0.45, delay: i * 0.07, ease: 'easeOut' }}
          />
        ))}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 90, height: 90, left: -45, top: -45, background: 'radial-gradient(circle, rgba(255,247,237,0.9), rgba(214,180,138,0.4) 40%, transparent 70%)' }}
          initial={{ scale: 0.3, opacity: 1 }}
          animate={{ scale: crit ? 1.7 : 1.2, opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
        {s.grains.map((g, i) => (
          <motion.span
            key={i}
            className="absolute block rounded-[2px]"
            style={{ width: g.s, height: g.s, left: -g.s / 2, top: -g.s / 2, background: g.c }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: g.dx, y: [0, g.dy, g.dy + 50], opacity: [1, 1, 0] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </div>
    </div>
  );
}
