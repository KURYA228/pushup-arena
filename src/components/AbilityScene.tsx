import { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Minion } from './Minion';
import { Penguin } from './Penguin';
import { BeastBoy, Cyborg, Raven, Starfire } from './Titans';
import { Antipka, BOGATYRS, Bogatyr } from './Kyiv';
import { FootNinja, Mouser, Turtle } from './ShredderFx';
import { Crown, KingFace } from './KingFx';
import { GoblinMini, JackO } from './GoblinFx';
import { MiniPo, PeachPetal } from './TaiLungFx';
import { Mjolnir } from './UltronFx';
import { Laurel, Spartan } from './KiryukhaFx';
import { Avatar } from './PlayerBadge';

/**
 * The bosses' abilities, acted out. Each signature move gets a little scene of its own over the
 * fight — snow swirling in on Gru's freeze, Freddy lunging out of a failing light, Skipper vanishing
 * in smoke, the Titans' shields closing round Robin, the tsar's treasury bursting open — and the
 * ones that swallow a rep (Krabs' fee, the pig's stolen egg, the Joker's joke, the tsar's tribute)
 * show where it went.
 *
 * Laid over the whole screen, click-through, centred on where the enemy is drawn. Keyed by `id`,
 * so the same ability twice in a row plays twice. The word for it (AbilityStamp) still comes up
 * on top; this is the picture under it. Nothing at all under reduced motion.
 */

export type SceneKind =
  | 'freeze'
  | 'ice-chip'
  | 'ice-shatter'
  | 'minion-thief'
  | 'minions-carry'
  | 'scream'
  | 'scream-burned'
  | 'scream-survived'
  | 'retreat'
  | 'power-out'
  | 'penguins-wave'
  | 'crystal'
  | 'xp-orbs'
  | 'infect-pass'
  | 'creeper-boom'
  | 'ender-death'
  | 'dragon-roar'
  | 'covered'
  | 'staff-block'
  | 'smoke-cape'
  | 'coins'
  | 'egg'
  | 'planks'
  | 'pig-poof'
  | 'cards'
  | 'acid-flower'
  | 'jack-box'
  | 'scold'
  | 'slipper'
  | 'steel-shield'
  | 'dizzy'
  | 'tribute'
  | 'treasury'
  | 'crown-roll'
  | 'coin-spill'
  | 'foot-ninja'
  | 'turtle-soup'
  | 'soup-cool'
  | 'laser-volley'
  | 'mousers'
  | 'cowabunga'
  | 'tower-fall'
  | 'goblin-blast'
  | 'wuxi'
  | 'mjolnir'
  | 'laurel';

export interface Scene {
  id: number;
  kind: SceneKind;
  /** The enemy's centre on screen, in px. */
  x: number;
  y: number;
  /** The boss's picture, for the scenes that bring him at you. */
  art?: string;
  /** Which way round a scene with two versions plays — see the scene itself. */
  variant?: number;
  /** The player, for the scenes that end on them — Kiryukha's wreath comes down on their head. */
  player?: { name: string; avatar: string | null; level: number };
}

/** How long each scene runs, so the caller can clear it. */
export const SCENE_MS: Record<SceneKind, number> = {
  freeze: 1800,
  'ice-chip': 600,
  'ice-shatter': 1100,
  'minion-thief': 1500,
  'minions-carry': 2600,
  scream: 1700,
  'scream-burned': 1300,
  'scream-survived': 2000,
  'power-out': 4400,
  retreat: 2400,
  'penguins-wave': 2700,
  crystal: 1400,
  'xp-orbs': 1300,
  'infect-pass': 1500,
  'creeper-boom': 1600,
  'ender-death': 8200,
  'dragon-roar': 1600,
  // A touch past the Titans' own 2.6 s, for their T to finish going.
  covered: 2900,
  'staff-block': 800,
  'smoke-cape': 2800,
  coins: 1400,
  egg: 1500,
  planks: 800,
  'pig-poof': 2200,
  cards: 2000,
  'acid-flower': 1500,
  'jack-box': 3000,
  scold: 900,
  slipper: 1200,
  'steel-shield': 950,
  dizzy: 2600,
  tribute: 1900,
  treasury: 2300,
  'crown-roll': 5200,
  'coin-spill': 2600,
  'foot-ninja': 1100,
  'turtle-soup': 2000,
  'soup-cool': 950,
  'laser-volley': 700,
  'mousers': 2400,
  cowabunga: 3500,
  'tower-fall': 3000,
  'goblin-blast': 3200,
  wuxi: 3600,
  mjolnir: 3400,
  laurel: 4200,
};

/**
 * Memoised: the fight screen re-renders constantly (the pulse, the boss talking), and each
 * re-render reaching a scene mid-flight could restart its animations from the first frame.
 */
export const AbilityScene = memo(function AbilityScene({ scene }: { scene: Scene | null }) {
  const calm = useReducedMotion();
  if (!scene || calm) return null;
  const Body = BODIES[scene.kind];
  // Into the body: the fight block it's declared in shakes with every blow, and a transformed
  // ancestor would make `fixed` mean "fixed to the block" instead of to the screen.
  return createPortal(
    <div key={scene.id} aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <Body scene={scene} />
    </div>,
    document.body,
  );
});

type BodyProps = { scene: Scene };

const BODIES: Record<SceneKind, (p: BodyProps) => React.ReactNode> = {
  freeze: Freeze,
  'ice-chip': IceChip,
  'ice-shatter': IceShatter,
  'minion-thief': MinionThief,
  'minions-carry': MinionsCarry,
  scream: Scream,
  'scream-burned': Embers,
  'scream-survived': SixAm,
  'power-out': PowerOut,
  retreat: Retreat,
  'penguins-wave': PenguinsWave,
  crystal: Crystal,
  'xp-orbs': XpOrbs,
  'infect-pass': InfectPass,
  'creeper-boom': CreeperBoom,
  'ender-death': EnderDeath,
  'dragon-roar': DragonRoar,
  covered: Covered,
  'staff-block': StaffBlock,
  'smoke-cape': SmokeCape,
  coins: Register,
  egg: Egg,
  planks: Planks,
  'pig-poof': PigPoof,
  cards: CardTrick,
  'acid-flower': AcidFlower,
  'jack-box': JackBox,
  scold: Scold,
  slipper: Slipper,
  'steel-shield': SteelShield,
  dizzy: Dizzy,
  tribute: Tribute,
  treasury: Treasury,
  'crown-roll': CrownRoll,
  'coin-spill': CoinSpill,
  'foot-ninja': FootNinjaSub,
  'turtle-soup': TurtleSoupDinner,
  'soup-cool': SoupCool,
  'laser-volley': LaserVolley,
  mousers: Mousers,
  cowabunga: Cowabunga,
  'tower-fall': TowerFall,
  'goblin-blast': GoblinBlast,
  wuxi: Wuxi,
  mjolnir: MjolnirStrike,
  laurel: LaurelCrown,
};

/* --------------------------------- helpers -------------------------------- */

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A point placed absolutely at the enemy's centre; children are laid out around (0, 0). */
function At({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      {children}
    </div>
  );
}

/** Pieces flying out from the centre in every direction. */
function useSpray(count: number, dist: [number, number]) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
        const d = rand(dist[0], dist[1]);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, rot: rand(-360, 360), deg: (a * 180) / Math.PI, s: rand(0.6, 1.2) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

/* ---------------------------------- Грю ---------------------------------- */

/** The freeze: big snowflakes swirl in from the four corners, and he ices over where they meet. */
function Freeze({ scene }: BodyProps) {
  const { x, y } = scene;
  const shards = useSpray(16, [70, 150]);
  // Several flakes from each corner, staggered, of different sizes.
  const flakes = useMemo(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const corners = [
      [-40, -40],
      [w + 40, -40],
      [-40, h + 40],
      [w + 40, h + 40],
    ];
    return corners.flatMap(([cx, cy], c) =>
      Array.from({ length: 4 }, (_, k) => ({
        // Start a little apart along the corner, end scattered around him.
        from: { x: cx + rand(-30, 30) - x, y: cy + rand(-30, 30) - y },
        to: { x: rand(-50, 50), y: rand(-50, 50) },
        size: rand(34, 62),
        spin: (c % 2 ? 1 : -1) * rand(200, 420),
        delay: k * 0.08 + rand(0, 0.05),
      })),
    );
  }, [x, y]);
  /** When the flakes arrive and the ice bursts off him. */
  const ARRIVE = 0.6;

  return (
    <>
      {/* The room goes cold. */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(125,211,252,0.15), rgba(14,116,144,0.45))' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0.6, 0] }}
        transition={{ duration: 1.6, times: [0, 0.3, 0.65, 1] }}
      />

      <At x={x} y={y}>
        {/* Snowflakes from the corners, spinning in and melting into him. */}
        {flakes.map((f, i) => (
          <motion.span
            key={i}
            className="absolute select-none leading-none"
            style={{
              fontSize: f.size,
              marginLeft: -f.size / 2,
              marginTop: -f.size / 2,
              color: '#e0f2fe',
              textShadow: '0 0 10px #7dd3fc, 0 0 22px #38bdf8',
            }}
            initial={{ x: f.from.x, y: f.from.y, rotate: 0, opacity: 0, scale: 0.6 }}
            animate={{
              x: [f.from.x, f.to.x],
              y: [f.from.y, f.to.y],
              rotate: f.spin,
              opacity: [0, 1, 1, 0],
              scale: [0.6, 1.1, 0.4],
            }}
            transition={{ duration: ARRIVE + 0.25, delay: f.delay, ease: 'easeIn' }}
          >
            ❄
          </motion.span>
        ))}

        {/* Ice bursting off him as they land. */}
        {shards.map((p, i) => (
          <motion.div
            key={`s${i}`}
            className="absolute"
            style={{
              width: 10 * p.s,
              height: 26 * p.s,
              marginLeft: -5 * p.s,
              marginTop: -13 * p.s,
              clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
              background: 'linear-gradient(160deg, #ffffff, #7dd3fc 60%, #0ea5e9)',
              filter: 'drop-shadow(0 0 4px #7dd3fc)',
            }}
            initial={{ x: 0, y: 0, rotate: p.deg + 90, opacity: 0, scale: 0.3 }}
            animate={{ x: p.dx, y: p.dy, rotate: p.deg + 90 + p.rot * 0.3, opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ duration: 0.8, delay: ARRIVE + 0.2, ease: 'easeOut' }}
          />
        ))}
        {/* A ring of frost rolling out. */}
        <motion.div
          className="absolute rounded-full border-4"
          style={{ width: 80, height: 80, left: -40, top: -40, borderColor: '#e0f2fe', boxShadow: '0 0 24px #38bdf8, inset 0 0 18px #7dd3fc' }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 3.4], opacity: [0, 1, 0] }}
          transition={{ duration: 0.8, delay: ARRIVE + 0.2, ease: 'easeOut' }}
        />
      </At>
    </>
  );
}

/** A rep spent on ice while frozen: a few chips of it flying off. */
function IceChip({ scene }: BodyProps) {
  const chips = useSpray(9, [40, 80]);
  return (
    <At x={scene.x} y={scene.y}>
      {chips.map((p, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            width: 8 * p.s,
            height: 14 * p.s,
            clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
            background: 'linear-gradient(160deg, #ffffff, #7dd3fc)',
            filter: 'drop-shadow(0 0 3px #7dd3fc)',
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy + 30, opacity: 0, rotate: p.rot }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
      ))}
    </At>
  );
}

/* --------------------------------- Фредди -------------------------------- */

/** The jump-scare: the light fails, then he comes at the screen out of the static. */
function Scream({ scene }: BodyProps) {
  return (
    <>
      {/* The light failing: a stutter of blackouts. */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.1, 1, 0, 1, 0.85, 0] }}
        transition={{ duration: 0.55, times: [0, 0.12, 0.22, 0.36, 0.48, 0.6, 0.85, 1] }}
      />

      {/* Him, lunging out at you, drowned in red. */}
      {scene.art && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 1.5, times: [0, 0.3, 0.36, 0.75, 1] }}
        >
          <motion.img
            src={scene.art}
            alt=""
            className="max-w-none"
            style={{ width: '120vmin', filter: 'sepia(1) saturate(6) hue-rotate(-30deg) contrast(1.4) brightness(0.9)' }}
            initial={{ scale: 0.4 }}
            animate={{
              scale: [0.4, 0.4, 1.7, 1.55, 1.75],
              x: [0, 0, -14, 12, -8, 6, 0],
              y: [0, 0, 8, -10, 6, -4, 0],
            }}
            transition={{ duration: 1.5, times: [0, 0.3, 0.42, 0.6, 1] }}
          />
        </motion.div>
      )}

      {/* Static over it, like a camera feed breaking up. */}
      <motion.div
        className="absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(255,0,0,0.08) 0 2px, transparent 2px 5px)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.9, 0.5, 0.9, 0], backgroundPositionY: ['0px', '0px', '40px', '-30px', '60px', '0px'] }}
        transition={{ duration: 1.5, times: [0, 0.3, 0.45, 0.6, 0.8, 1] }}
      />

      {/* A red pulse at the edges as it lets go. */}
      <motion.div
        className="absolute inset-0"
        style={{ boxShadow: 'inset 0 0 120px 40px rgba(220,38,38,0.85)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0.4, 1, 0] }}
        transition={{ duration: 1.7, times: [0, 0.3, 0.45, 0.65, 0.8, 1] }}
      />
    </>
  );
}

/** A pause during the scream: the damage burns up — embers off him, the edges scorched. */
function Embers({ scene }: BodyProps) {
  const embers = useMemo(
    () => Array.from({ length: 26 }, () => ({ x: rand(-90, 90), rise: rand(120, 260), s: rand(3, 7), delay: rand(0, 0.3), sway: rand(-30, 30) })),
    [],
  );
  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={{ boxShadow: 'inset 0 0 100px 30px rgba(234,88,12,0.7)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.1 }}
      />
      <At x={scene.x} y={scene.y}>
        {embers.map((e, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: e.s, height: e.s, background: i % 3 ? '#fb923c' : '#fde047', boxShadow: '0 0 8px #f97316' }}
            initial={{ x: e.x, y: 40, opacity: 0 }}
            animate={{ x: e.x + e.sway, y: 40 - e.rise, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.1, delay: e.delay, ease: 'easeOut' }}
          />
        ))}
      </At>
    </>
  );
}

/* --------------------------------- Шкипер -------------------------------- */

/** A white sticking plaster in a cross, for Skipper patched up after his retreat. */
export function Plaster({ size }: { size: number }) {
  const strip = { width: size, height: size * 0.3, background: 'linear-gradient(#fde7c8, #f3c99a)', border: '1px solid #c99a66', borderRadius: size * 0.08 };
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute left-0" style={{ ...strip, top: size * 0.35, rotate: '45deg' }} />
      <div className="absolute left-0" style={{ ...strip, top: size * 0.35, rotate: '-45deg' }} />
    </div>
  );
}

/**
 * Skipper's tactical retreat: Rico pops up and coughs up a smoke bomb, it bursts on Skipper in a
 * cloud, and out of the smoke he goes — flat on his belly, sliding off the side of the screen in
 * a spray of snow — and slides back in from the other side, plastered up and healed.
 *
 * The real picture is hidden for the length of it (BossView's retreat move), and this scene's
 * own copy of him does the sliding.
 */
function Retreat({ scene }: BodyProps) {
  const side = scene.x > window.innerWidth / 2 ? -1 : 1;
  const off = window.innerWidth / 2 + 160;
  const puffs = useMemo(
    () => Array.from({ length: 12 }, () => ({ x: rand(-80, 80), y: rand(-60, 60), s: rand(50, 100), delay: rand(0, 0.2) })),
    [],
  );
  const snow = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ t: i / 16, s: rand(4, 9), dy: rand(-6, 10) })), []);
  const pluses = useMemo(() => Array.from({ length: 7 }, () => ({ x: rand(-70, 70), delay: rand(1.9, 2.1), s: rand(18, 28) })), []);
  const T = 2.3;
  const at = (sec: number) => sec / T;
  return (
    <At x={scene.x} y={scene.y}>
      {/* Rico, popping up at Skipper's side, big and lit so you can't miss him, coughing up the
          bomb. */}
      <motion.div
        className="absolute"
        style={{ left: side * 150 - 50, top: -10, filter: 'drop-shadow(0 0 3px #fff) drop-shadow(0 0 12px rgba(125,211,252,0.9))' }}
        initial={{ y: 260, opacity: 0 }}
        animate={{ y: [260, 0, 0, -10, 0, 0, 280], opacity: [0, 1, 1, 1, 1, 1, 0], scaleY: [1, 1, 1, 0.85, 1.08, 1, 1] }}
        transition={{ duration: 1.25, times: [0, 0.2, 0.26, 0.3, 0.35, 0.65, 1], ease: 'easeOut' }}
      >
        <Penguin size={120} mohawk />
        <motion.span
          className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border-2 border-[#111827] bg-white px-1.5 text-sm font-black text-[#111827]"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1.1, 1, 1] }}
          transition={{ duration: 1, times: [0, 0.25, 0.32, 0.8, 1] }}
        >
          Рико!
        </motion.span>
      </motion.div>
      {/* The bomb, from his beak to Skipper. */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 22, height: 22, marginLeft: -11, marginTop: -11, background: 'radial-gradient(circle at 35% 30%, #6b7280, #111827 60%)', boxShadow: '0 0 8px rgba(0,0,0,0.6)' }}
        initial={{ x: side * 150, y: 30, opacity: 0 }}
        animate={{ x: [side * 150, side * 75, 0], y: [30, -40, 0], opacity: [0, 1, 1, 0], rotate: 360 }}
        transition={{ duration: 0.4, delay: 0.3, ease: 'easeIn' }}
      >
        <motion.span
          className="absolute -right-1 -top-2 block h-2 w-2 rounded-full bg-[#fde047]"
          style={{ boxShadow: '0 0 8px #f59e0b' }}
          animate={{ scale: [1, 1.6, 1] }}
          transition={{ duration: 0.12, repeat: Infinity }}
        />
      </motion.div>
      {/* Smoke where it bursts. */}
      {puffs.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.s,
            height: p.s,
            left: p.x - p.s / 2,
            top: p.y - p.s / 2,
            background: 'radial-gradient(circle at 35% 35%, rgba(229,231,235,0.95), rgba(156,163,175,0.75) 60%, rgba(107,114,128,0))',
          }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.3, 1.8], opacity: [0, 0.95, 0], y: -20 }}
          transition={{ duration: 1.1, delay: 0.66 + p.delay, ease: 'easeOut' }}
        />
      ))}
      {/* Snow kicked up along where he slides. */}
      {snow.map((f, i) => (
        <motion.div
          key={`s${i}`}
          className="absolute rounded-full bg-white"
          style={{ width: f.s, height: f.s, left: -side * f.t * off, top: 50 + f.dy, boxShadow: '0 0 6px #e0f2fe' }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], y: [0, -24, 10] }}
          transition={{ duration: 0.5, delay: 0.8 + f.t * 0.45 }}
        />
      ))}
      {/* Skipper himself: out of the smoke, onto his belly and away; back in, patched up. */}
      {scene.art && (
        <motion.div
          className="absolute"
          style={{ width: 140, height: 140, left: -70, top: -70 }}
          initial={{ x: 0, opacity: 0, rotate: 0 }}
          animate={{
            x: [0, 0, 0, -side * off, side * off, side * off, 0, 0],
            y: [0, 0, 30, 40, 40, 40, 30, 0],
            rotate: [0, 0, side * 75, side * 80, side * 80, side * 80, side * 75, 0],
            opacity: [0, 0, 1, 1, 0, 1, 1, 0],
          }}
          transition={{
            duration: T,
            times: [0, at(0.68), at(0.82), at(1.3), at(1.31), at(1.42), at(1.9), at(2.3)],
            ease: 'easeInOut',
          }}
        >
          <div
            className="h-full w-full rounded-full border-4 border-[#1f2937]"
            style={{ backgroundImage: `url(${scene.art})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.6)' }}
          />
          {/* The plaster, on him from the moment he comes back. */}
          <motion.div
            className="absolute right-2 top-2"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0, 1], scale: [0, 0, 1] }}
            transition={{ duration: T, times: [0, at(1.4), at(1.45)] }}
          >
            <Plaster size={40} />
          </motion.div>
        </motion.div>
      )}
      {pluses.map((p, i) => (
        <motion.span
          key={i}
          className="absolute font-black"
          style={{ left: p.x, fontSize: p.s, color: '#4ade80', textShadow: '0 0 10px #22c55e, 0 2px 0 #14532d' }}
          initial={{ y: 20, opacity: 0, scale: 0.5 }}
          animate={{ y: -110, opacity: [0, 1, 0], scale: 1 }}
          transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
        >
          +
        </motion.span>
      ))}
    </At>
  );
}

/**
 * Skipper going down: the whole unit pops up standing on the health bar he's just emptied
 * (the scene's point is the bar) and does what they do — smile and wave — and then they're off,
 * flat on their bellies, along it and out of the side of the shot.
 */
function PenguinsWave({ scene }: BodyProps) {
  const floor = -84;
  const off = window.innerWidth / 2 + 120;
  const squad = [-150, -50, 50, 150];
  return (
    <At x={scene.x} y={scene.y}>
      <motion.div
        className="absolute whitespace-nowrap text-center text-2xl"
        style={{ width: 320, left: -160, top: floor - 60, fontFamily: "'Russo One', sans-serif", color: '#ffffff', WebkitTextStroke: '1.5px #0c4a6e', textShadow: '0 3px 0 #0c4a6e, 0 0 14px #38bdf8' }}
        initial={{ opacity: 0, scale: 0.5, y: 20 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.1, 1, 1], y: [20, 0, 0, -10] }}
        transition={{ duration: 2, delay: 0.3, times: [0, 0.15, 0.8, 1] }}
      >
        Улыбаемся и машем!
      </motion.div>
      {squad.map((x, i) => (
        <motion.div
          key={x}
          className="absolute"
          style={{ left: x - 30, top: floor }}
          initial={{ y: 40, x: 0, rotate: 0, opacity: 0, scaleY: 0.2 }}
          animate={{ y: [40, -12, 0, 0, 20], x: [0, 0, 0, 0, off + 200], rotate: [0, 0, 0, 0, 80], opacity: [0, 1, 1, 1, 1], scaleY: [0.2, 1.1, 1, 1, 1] }}
          transition={{ duration: 2.5, delay: i * 0.08, times: [0, 0.1, 0.16, 0.7, 1], ease: 'easeInOut' }}
        >
          <Penguin size={72} wave mohawk={i === 2} />
        </motion.div>
      ))}
    </At>
  );
}

/* ------------------------------ Эндер-дракон ------------------------------ */

/** An End crystal breaking: purple shards, a shockwave, the End's particles drifting up. */
function Crystal({ scene }: BodyProps) {
  const shards = useSpray(18, [90, 190]);
  const motes = useMemo(() => Array.from({ length: 16 }, () => ({ x: rand(-110, 110), y: rand(-40, 80), delay: rand(0.2, 0.7), s: rand(4, 8) })), []);
  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at center, rgba(192,132,252,0.35), transparent 60%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.8 }}
      />
      <At x={scene.x} y={scene.y}>
        <motion.div
          className="absolute rounded-full border-[5px]"
          style={{ width: 70, height: 70, left: -35, top: -35, borderColor: '#e9d5ff', boxShadow: '0 0 30px #a855f7, inset 0 0 20px #c084fc' }}
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: 4.2, opacity: 0 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        />
        {shards.map((p, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              width: 14 * p.s,
              height: 22 * p.s,
              marginLeft: -7 * p.s,
              marginTop: -11 * p.s,
              clipPath: i % 2 ? 'polygon(50% 0, 100% 35%, 70% 100%, 20% 90%, 0 30%)' : 'polygon(30% 0, 100% 20%, 80% 100%, 0 70%)',
              background: 'linear-gradient(150deg, #faf5ff, #c084fc 45%, #7e22ce)',
              filter: 'drop-shadow(0 0 5px #a855f7)',
            }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: p.dx, y: p.dy + 40, rotate: p.rot, opacity: [1, 1, 0], scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        ))}
        {motes.map((m, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ width: m.s, height: m.s, left: m.x, top: m.y, background: '#d8b4fe', boxShadow: '0 0 6px #a855f7' }}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], y: -70, rotate: 90 }}
            transition={{ duration: 1, delay: m.delay, ease: 'easeOut' }}
          />
        ))}
      </At>
    </>
  );
}

/* ---------------------------------- Робин --------------------------------- */

/**
 * The Titans cover him, and their attacks become his shield. The four of them turn up as little
 * figures round him and each throws what they've got — not at him, at a ring round him: Cyborg's
 * sonic beam lights the left of it blue, Starfire's starbolts the right green, Beast Boy leaps in
 * as a tiger and becomes the bottom, Raven's dark energy pours down into the top — and the ring,
 * whole, flares up into a dome over him. Then they're gone, and the damage it undid rises off him.
 */
const SHIELD_R = 118;
/** How long the T in the middle lasts, from the start of the scene. */
const TITANS_T = 2.8;
/** Each Titan's share of the ring: where it starts (degrees, 0 = right, clockwise) and its colour. */
const ARCS = [
  { from: 135, color: '#38bdf8', at: 0.62 }, // Cyborg — the left
  { from: -45, color: '#4ade80', at: 1.0 }, // Starfire — the right
  { from: 45, color: '#84cc16', at: 1.32 }, // Beast Boy — the bottom
  { from: 225, color: '#a855f7', at: 1.55 }, // Raven — the top
];

function Covered({ scene }: BodyProps) {
  const w = window.innerWidth;
  const T = 2.6;
  const at = (sec: number) => sec / T;
  const pluses = useMemo(() => Array.from({ length: 7 }, () => ({ x: rand(-70, 70), delay: rand(1.95, 2.2), s: rand(18, 28) })), []);
  const R = SHIELD_R;
  const cy = { x: -205, y: 10 };
  const sf = { x: 175, y: -150 };
  const bb = { x: -90, y: 175 };
  const rv = { x: 0, y: -230 };
  // Where each attack meets the ring.
  const hitL = { x: -R, y: 0 };
  const hitR = { x: R * Math.cos(-Math.PI / 4), y: R * Math.sin(-Math.PI / 4) };
  const hitB = { x: 0, y: R };
  const hitT = { x: 0, y: -R };
  const glow = (c: string) => `drop-shadow(0 0 6px ${c}) drop-shadow(0 0 14px ${c})`;
  return (
    <At x={scene.x} y={scene.y}>
      {/* The ring, lit a quarter at a time as each attack lands in it. */}
      <svg className="absolute overflow-visible" style={{ left: -R - 20, top: -R - 20 }} width={(R + 20) * 2} height={(R + 20) * 2}>
        {ARCS.map((arc) => (
          <motion.circle
            key={arc.from}
            cx={R + 20}
            cy={R + 20}
            r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth={10}
            strokeLinecap="round"
            style={{ rotate: arc.from, transformOrigin: 'center', transformBox: 'fill-box', filter: glow(arc.color) }}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 0, 0.25, 0.25, 0.25], opacity: [0, 0, 1, 1, 0] }}
            transition={{ duration: T, times: [0, at(arc.at), at(arc.at + 0.22), at(2.2), 1], ease: 'easeOut' }}
          />
        ))}
      </svg>
      {/* The ring whole: it flares into a dome of all their colours. */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: R * 2 + 16,
          height: R * 2 + 16,
          left: -R - 8,
          top: -R - 8,
          background: 'radial-gradient(circle, rgba(255,255,255,0) 55%, rgba(255,255,255,0.18) 75%, rgba(255,255,255,0.45) 92%, rgba(255,255,255,0) 100%)',
          boxShadow: '0 0 30px #38bdf8, 0 0 50px #a855f7, inset 0 0 40px rgba(74,222,128,0.6)',
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: [0.9, 0.9, 1.08, 1, 1], opacity: [0, 0, 1, 0.8, 0] }}
        transition={{ duration: T, times: [0, at(1.78), at(1.9), at(2.15), 1] }}
      />
      {/* And in the middle of it, their T — the ring round it makes it the team's badge. It
          punches in as the dome flares, holds long enough to be read and is gone a moment
          after the Titans; it runs on its own clock (TITANS_T) for that reason. */}
      <motion.svg
        className="absolute overflow-visible"
        style={{ left: -R * 0.55, top: -R * 0.55, filter: 'drop-shadow(0 0 8px #38bdf8) drop-shadow(0 0 18px #a855f7)' }}
        width={R * 1.1}
        height={R * 1.1}
        viewBox="0 0 100 100"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.35, 1, 1, 1.15], opacity: [0, 0, 1, 1, 1, 0] }}
        transition={{
          duration: TITANS_T,
          times: [0, 1.8 / TITANS_T, 1.95 / TITANS_T, 2.1 / TITANS_T, 2.5 / TITANS_T, 1],
          ease: 'easeOut',
        }}
      >
        <defs>
          <linearGradient id="titans-t" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {/* A heavy T with its crossbar flared at the ends and the stem tapering to the foot. */}
        <path
          d="M8 12 L92 12 L86 32 L60 32 L56 90 L44 90 L40 32 L14 32 Z"
          fill="url(#titans-t)"
          stroke="#1e1b4b"
          strokeWidth={4}
          strokeLinejoin="round"
        />
      </motion.svg>

      {/* Cyborg: runs in from the left, aims, fires into the left of the ring. */}
      <motion.div
        className="absolute"
        style={{ left: cy.x - 32, top: cy.y - 40 }}
        initial={{ x: -w / 2 - 100 }}
        animate={{ x: [-w / 2 - 100, 0, 0, -w / 2 - 100], y: [0, -6, 0, 0] }}
        transition={{ duration: T, times: [0, at(0.4), at(2.1), 1], ease: 'easeInOut' }}
      >
        <Cyborg size={80} aim />
      </motion.div>
      <motion.div
        className="absolute rounded-full"
        style={{
          left: cy.x + 40,
          top: cy.y - 8,
          height: 16,
          width: hitL.x - (cy.x + 40),
          originX: 0,
          background: 'linear-gradient(90deg, #38bdf8, #ffffff 50%, #7dd3fc)',
          boxShadow: '0 0 20px #38bdf8, 0 0 40px #0ea5e9',
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 0, 1, 1, 1], opacity: [0, 0, 1, 1, 0], scaleY: [1, 1, 1, 1.3, 0.2] }}
        transition={{ duration: 0.95, times: [0, 0.5, 0.62, 0.82, 1] }}
      />

      {/* Starfire: swoops in from the top right and throws three bolts into the right of it. */}
      <motion.div
        className="absolute"
        style={{ left: sf.x - 32, top: sf.y - 40 }}
        initial={{ x: w / 2, y: -200 }}
        animate={{ x: [w / 2, 0, 0, w / 2], y: [-200, 0, 0, -200], rotate: [20, 0, 0, -20] }}
        transition={{ duration: T, times: [0, at(0.55), at(2.1), 1], ease: 'easeInOut' }}
      >
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>
          <Starfire size={80} />
        </motion.div>
      </motion.div>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`bolt${i}`}
          className="absolute rounded-full"
          style={{ width: 22, height: 22, marginLeft: -11, marginTop: -11, background: 'radial-gradient(circle, #f0fdf4, #4ade80 45%, #16a34a 70%, transparent 72%)', boxShadow: '0 0 16px #4ade80' }}
          initial={{ x: sf.x - 20, y: sf.y + 10, opacity: 0 }}
          animate={{ x: [sf.x - 20, hitR.x + (i - 1) * 14], y: [sf.y + 10, hitR.y + (i - 1) * 14], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.28, delay: 0.72 + i * 0.1, ease: 'easeIn' }}
        />
      ))}

      {/* Beast Boy: runs in, turns into a tiger in a puff, and leaps into the bottom of it. */}
      <motion.div
        className="absolute"
        style={{ left: bb.x - 28, top: bb.y - 36 }}
        initial={{ x: -w / 2 - 100, opacity: 1 }}
        animate={{ x: [-w / 2 - 100, 0, 0], opacity: [1, 1, 1, 0] }}
        transition={{ duration: 1.05, times: [0, 0.75, 0.95, 1], ease: 'easeOut' }}
      >
        <BeastBoy size={70} />
      </motion.div>
      <motion.div
        className="absolute rounded-full"
        style={{ left: bb.x - 40, top: bb.y - 40, width: 80, height: 80, background: 'radial-gradient(circle, rgba(187,247,208,0.95), rgba(74,222,128,0.6) 50%, transparent 70%)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.6], opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, times: [0, 0.68, 1] }}
      />
      <motion.div
        className="absolute text-5xl"
        style={{ left: bb.x - 26, top: bb.y - 32, filter: 'hue-rotate(80deg) saturate(2) drop-shadow(0 0 8px #22c55e)' }}
        initial={{ opacity: 0, x: 0, y: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], x: [0, 0, 0, hitB.x - bb.x], y: [0, 0, 0, hitB.y - bb.y - 20], scale: [1, 1, 1, 0.4] }}
        transition={{ duration: 1.45, times: [0, 0.7, 0.74, 0.97, 1], ease: 'easeIn' }}
      >
        🐯
      </motion.div>

      {/* Raven: floats down above him and pours her energy into the top of it. */}
      <motion.div
        className="absolute"
        style={{ left: rv.x - 32, top: rv.y - 40 }}
        initial={{ y: -260, opacity: 0 }}
        animate={{ y: [-260, -260, 0, 0, -260], opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: T, times: [0, at(0.8), at(1.2), at(2.1), 1], ease: 'easeInOut' }}
      >
        <Raven size={80} />
      </motion.div>
      <motion.div
        className="absolute rounded-full"
        style={{
          left: -10,
          top: rv.y + 40,
          width: 20,
          height: hitT.y - (rv.y + 40),
          originY: 0,
          background: 'linear-gradient(180deg, #ddd6fe, #7c3aed 60%, #4c1d95)',
          boxShadow: '0 0 18px #7c3aed',
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: [0, 0, 1, 1], opacity: [0, 0, 1, 0] }}
        transition={{ duration: T, times: [0, at(1.35), at(1.5), at(1.8)] }}
      />
      <motion.span
        className="absolute whitespace-nowrap text-sm font-black text-[#c4b5fd]"
        style={{ left: -100, top: rv.y - 70, width: 200, textAlign: 'center', textShadow: '0 0 8px #7c3aed' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: T, times: [0, at(1.25), at(1.35), at(1.95), at(2.1)] }}
      >
        Азарат Метрион Зинтос!
      </motion.span>

      {pluses.map((p, i) => (
        <motion.span
          key={i}
          className="absolute font-black"
          style={{ left: p.x, fontSize: p.s, color: '#4ade80', textShadow: '0 0 10px #22c55e, 0 2px 0 #14532d' }}
          initial={{ y: 20, opacity: 0, scale: 0.5 }}
          animate={{ y: -110, opacity: [0, 1, 0], scale: 1 }}
          transition={{ duration: 0.8, delay: p.delay, ease: 'easeOut' }}
        >
          +
        </motion.span>
      ))}
    </At>
  );
}

/** "Толстокожесть", Robin's way: his bo staff whirls up in front of him and the blow clacks off it. */
function StaffBlock({ scene }: BodyProps) {
  const sparks = useSpray(12, [40, 90]);
  return (
    <At x={scene.x} y={scene.y}>
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 190,
          height: 12,
          left: -95,
          top: -6,
          background: 'linear-gradient(90deg, #6b7280 0 8%, #d1d5db 8% 12%, #9ca3af 12% 88%, #d1d5db 88% 92%, #6b7280 92%)',
          border: '1px solid #1f2937',
          boxShadow: '0 0 10px rgba(255,255,255,0.5)',
        }}
        initial={{ rotate: 0, scale: 0.5, opacity: 0 }}
        animate={{ rotate: [0, 540, 720, 720], scale: [0.5, 1, 1, 0.8], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.75, times: [0, 0.4, 0.6, 1], ease: 'easeOut' }}
      />
      {sparks.map((p, i) => (
        <motion.div
          key={i}
          className="absolute h-[3px] rounded-full"
          style={{ width: 12, background: '#fde047', boxShadow: '0 0 6px #f59e0b', rotate: p.deg }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: p.dx, y: p.dy, opacity: [0, 0, 1, 0] }}
          transition={{ duration: 0.5, delay: 0.25, times: [0, 0.01, 0.2, 1] }}
        />
      ))}
      <motion.span
        className="absolute whitespace-nowrap text-xl font-black text-white"
        style={{ left: 40, top: -60, fontFamily: "'Russo One', sans-serif", WebkitTextStroke: '1px #7f1d1d', textShadow: '0 2px 0 #7f1d1d' }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0.5, 0.5, 1.15, 1] }}
        transition={{ duration: 0.75, times: [0, 0.3, 0.45, 1] }}
      >
        ДЗЫНЬ!
      </motion.span>
    </At>
  );
}

/**
 * Robin going down, the way he leaves: a smoke bomb, a cloud, and when it clears only his cape
 * is left, drifting down; the Titans' "T" lights up over it and goes out.
 */
function SmokeCape({ scene }: BodyProps) {
  const puffs = useMemo(() => Array.from({ length: 14 }, () => ({ x: rand(-90, 90), y: rand(-70, 60), s: rand(60, 110), delay: rand(0, 0.25) })), []);
  return (
    <At x={scene.x} y={scene.y}>
      {puffs.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ width: p.s, height: p.s, left: p.x - p.s / 2, top: p.y - p.s / 2, background: 'radial-gradient(circle at 35% 35%, rgba(229,231,235,0.95), rgba(107,114,128,0.8) 60%, rgba(55,65,81,0))' }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.3, 1.8], opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
      {/* The cape, falling as the smoke clears. */}
      <motion.div
        className="absolute"
        style={{ width: 90, height: 110, left: -45, top: -55 }}
        initial={{ opacity: 0, y: -10, rotate: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], y: [-10, -10, 0, 160, 220], rotate: [0, 0, -8, 10, -6], x: [0, 0, 10, -14, 8] }}
        transition={{ duration: 2.6, times: [0, 0.3, 0.42, 0.85, 1], ease: 'easeInOut' }}
      >
        <div
          className="h-full w-full"
          style={{
            clipPath: 'polygon(30% 0, 70% 0, 100% 100%, 75% 92%, 50% 100%, 25% 92%, 0 100%)',
            background: 'linear-gradient(180deg, #111827, #1f2937 60%, #111827)',
            boxShadow: 'inset 0 0 0 4px #facc15',
          }}
        />
        <div className="absolute inset-0" style={{ clipPath: 'polygon(30% 0, 70% 0, 100% 100%, 75% 92%, 50% 100%, 25% 92%, 0 100%)', background: 'linear-gradient(180deg, transparent 0 85%, #facc15 85%)', opacity: 0.6 }} />
      </motion.div>
      {/* The T, over it. */}
      <motion.div
        className="absolute text-7xl font-black"
        style={{ left: -24, top: -170, color: '#ef4444', fontFamily: "'Russo One', sans-serif", WebkitTextStroke: '2px #fef08a', textShadow: '0 0 20px #ef4444' }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 1, 0.3, 1, 0], scale: [0.4, 0.4, 1.1, 1, 1, 1.2] }}
        transition={{ duration: 2.4, times: [0, 0.35, 0.45, 0.6, 0.7, 1] }}
      >
        T
      </motion.div>
    </At>
  );
}

/* ---------------------------------- Джокер -------------------------------- */

/* ---------------------------------- Николь -------------------------------- */

/** Strict mom: caught slacking — the edges of the screen flare an angry red, twice. */
function Scold() {
  return (
    <motion.div
      className="absolute inset-0"
      style={{ boxShadow: 'inset 0 0 90px 24px rgba(239,68,68,0.8)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.2, 1, 0] }}
      transition={{ duration: 0.85 }}
    />
  );
}

/* ------------------------------ Царь Владимир ----------------------------- */

/** A small treasure chest drawn in CSS: a body, a lid that can swing, a gold lock. */
function Chest({ size, open }: { size: number; open: boolean | number[] }) {
  const w = size;
  const h = size * 0.62;
  const lid = size * 0.34;
  const wood = 'linear-gradient(180deg, #a0522d, #6b3410)';
  const band = '#f2b705';
  return (
    <div className="relative" style={{ width: w, height: h + lid * 0.6 }}>
      <motion.div
        className="absolute left-0 rounded-t-[40%] border-2"
        style={{ width: w, height: lid, top: 0, background: wood, borderColor: band, originY: 1, zIndex: 2 }}
        initial={{ rotateX: 0 }}
        animate={{ rotateX: Array.isArray(open) ? open : open ? 115 : 0 }}
        transition={{ duration: Array.isArray(open) ? 1.1 : 0.3, ease: 'easeOut' }}
      />
      <div
        className="absolute left-0 rounded-b-md border-2"
        style={{ width: w, height: h, top: lid * 0.6, background: wood, borderColor: band, zIndex: 1 }}
      >
        <div className="absolute inset-x-0 top-1/3 h-[3px]" style={{ background: band }} />
        <div
          className="absolute left-1/2 top-[22%] -translate-x-1/2 rounded-sm"
          style={{ width: size * 0.16, height: size * 0.2, background: 'linear-gradient(#fde68a, #b45309)' }}
        />
      </div>
    </div>
  );
}

/**
 * Tribute: a chest pops up beside him and the rep's coins arc off him into it; Antipka runs in
 * with his ledger, writes it down — «Записано!» — and carries the chest off.
 */
function Tribute({ scene }: BodyProps) {
  const T = 1.8;
  const at = (sec: number) => sec / T;
  const side = scene.x > window.innerWidth * 0.6 ? -1 : 1;
  const coins = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ delay: 0.1 + i * 0.05, lift: rand(60, 120), spin: rand(2, 4) })), []);
  const cx = 110 * side;
  const cy = 70;
  const off = window.innerWidth / 2 + 120;
  return (
    <At x={scene.x} y={scene.y}>
      {/* The chest: up, filled, and away under Antipka's arm. */}
      <motion.div
        className="absolute"
        style={{ left: cx - 30, top: cy - 30, perspective: 200 }}
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={{ scale: [0, 1.1, 1, 1, 1, 0.8], opacity: [0, 1, 1, 1, 1, 1], y: [20, 0, 0, 0, -16, -16], x: [0, 0, 0, 0, 0, side * off] }}
        transition={{ duration: T, times: [0, at(0.15), at(0.25), at(1.15), at(1.25), 1], ease: 'easeIn' }}
      >
        <Chest size={60} open={[0, 115, 115, 0]} />
      </motion.div>
      {coins.map((c, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center justify-center rounded-full text-[10px] font-black"
          style={{
            width: 20,
            height: 20,
            marginLeft: -10,
            marginTop: -10,
            background: 'radial-gradient(circle at 35% 30%, #fffbe6, #fcd34d 45%, #b45309)',
            color: '#78350f',
            border: '1.5px solid #92400e',
            boxShadow: '0 0 10px #f59e0b',
          }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{
            x: [0, cx * 0.5, cx],
            y: [0, -c.lift, cy - 14],
            opacity: [0, 1, 1, 0],
            scaleX: Array.from({ length: Math.round(c.spin) * 2 + 1 }, (_, k) => (k % 2 ? 0.15 : 1)),
          }}
          transition={{ duration: 0.55, delay: c.delay, ease: 'easeIn' }}
        >
          ₽
        </motion.div>
      ))}
      {/* Antipka: runs in, writes it down, picks it up, runs off with it. */}
      <motion.div
        className="absolute"
        style={{ left: cx + side * 50 - 35, top: cy - 50, scaleX: -side }}
        initial={{ x: side * off }}
        animate={{ x: [side * off, 0, 0, side * off] }}
        transition={{ duration: T, times: [0, at(0.45), at(1.15), 1], ease: 'easeInOut' }}
      >
        <Antipka size={84} writing run />
      </motion.div>
      <motion.span
        className="absolute whitespace-nowrap rounded-lg border-2 border-[#78350f] bg-[#fef3c7] px-1.5 text-sm font-black text-[#78350f]"
        style={{ left: cx + side * 50 - 36, top: cy - 86 }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1.1, 1, 1] }}
        transition={{ duration: T, times: [0, at(0.6), at(0.7), at(1.1), at(1.2)] }}
      >
        Записано!
      </motion.span>
    </At>
  );
}

/**
 * The treasury: "Антипка! Готовь казну!" — a big chest bursts open under him in a fountain of
 * gold, a warm light floods the room, and the three bogatyrs run in and close up in front of him
 * behind their shields: «Не выдадим, батюшка!».
 */
function Treasury({ scene }: BodyProps) {
  const T = 2.2;
  const at = (sec: number) => sec / T;
  const gold = useMemo(
    () => Array.from({ length: 26 }, () => ({ dx: rand(-170, 170), up: rand(150, 300), delay: rand(0.15, 0.5), spin: rand(2, 5), s: rand(0.7, 1.2) })),
    [],
  );
  const off = window.innerWidth / 2 + 120;
  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at center, rgba(250,204,21,0.38), rgba(245,158,11,0.12) 45%, transparent 70%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: T, times: [0, 0.15, 0.75, 1] }}
      />
      <At x={scene.x} y={scene.y}>
        <motion.div
          className="absolute"
          style={{ left: -45, top: 60, perspective: 260 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.15, 1, 1, 0.9], opacity: [0, 1, 1, 1, 0], rotate: [0, -4, 4, 0, 0] }}
          transition={{ duration: T, times: [0, 0.1, 0.17, 0.85, 1] }}
        >
          <Chest size={90} open={[0, 0, 125, 125]} />
        </motion.div>
        {gold.map((c, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 18 * c.s,
              height: 18 * c.s,
              marginLeft: -9 * c.s,
              marginTop: -9 * c.s,
              background: 'radial-gradient(circle at 35% 30%, #fffbe6, #fcd34d 45%, #b45309)',
              border: '1.5px solid #92400e',
              boxShadow: '0 0 10px #f59e0b',
            }}
            initial={{ x: 0, y: 80, opacity: 0 }}
            animate={{
              x: [0, c.dx * 0.6, c.dx],
              y: [80, 80 - c.up, 80 - c.up + 140],
              opacity: [0, 1, 1, 0],
              scaleX: Array.from({ length: Math.round(c.spin) * 2 + 1 }, (_, k) => (k % 2 ? 0.15 : 1)),
            }}
            transition={{ duration: 1.2, delay: c.delay, ease: 'easeOut' }}
          />
        ))}
        {/* The bogatyrs: in from both sides, into a line in front of him. */}
        {BOGATYRS.map((b, i) => {
          const x = (i - 1) * 78;
          const from = i === 0 ? -off : i === 2 ? off : -off;
          return (
            <motion.div
              key={b.name}
              className="absolute"
              style={{ left: x - 38, top: 40 }}
              initial={{ x: from, opacity: 0 }}
              animate={{ x: [from, from, 0, 0, 0], opacity: [0, 1, 1, 1, 0], y: [0, 0, -10, 0, 0] }}
              transition={{ duration: T, times: [0, at(0.45 + i * 0.08), at(0.85 + i * 0.08), at(1.0 + i * 0.08), 1], ease: 'easeOut' }}
            >
              <Bogatyr size={92} beard={b.beard} hair={b.hair} />
            </motion.div>
          );
        })}
        <motion.span
          className="absolute whitespace-nowrap text-xl"
          style={{ left: -130, top: -20, width: 260, textAlign: 'center', fontFamily: "'Russo One', sans-serif", color: '#fde047', WebkitTextStroke: '1.5px #7c2d12', textShadow: '0 3px 0 #7c2d12' }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1.1, 1, 1] }}
          transition={{ duration: T, times: [0, at(1.2), at(1.32), at(1.9), 1] }}
        >
          Не выдадим, батюшка!
        </motion.span>
      </At>
    </>
  );
}

/**
 * The tsar going down, played out on the empty health bar. His crown drops onto it, bounces and
 * rolls; Antipka runs in and catches it, tries it on — it's far too big and slides down over his
 * eyes — wails «Казна пуста!» with tears flying, and runs off with it. The bogatyrs pop up at
 * the other end of the bar and cheer «Слава!», the bells swing and ring in the corners, and
 * rockets go up and burst into a salute.
 */
function CrownRoll({ scene }: BodyProps) {
  const T = 5;
  const at = (sec: number) => sec / T;
  const salute = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: rand(-window.innerWidth * 0.38, window.innerWidth * 0.38),
        y: -scene.y + rand(60, 220),
        delay: 0.4 + i * 0.55,
        c: ['#facc15', '#ef4444', '#38bdf8', '#4ade80', '#f472b6', '#a78bfa', '#fb923c'][i % 7],
      })),
    [scene.y],
  );
  const tears = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ dx: (i % 2 ? 1 : -1) * rand(20, 50), up: rand(20, 50), delay: 2.4 + i * 0.12 })), []);
  const runOff = window.innerWidth / 2 + 120;
  const ax = 110; // where Antipka stands on the bar
  return (
    <At x={scene.x} y={scene.y}>
      {/* The bells, swinging in the top corners. */}
      {[-1, 1].map((side) => (
        <motion.div
          key={side}
          className="absolute text-5xl"
          style={{ left: side * (window.innerWidth / 2 - 50) - 24, top: -scene.y + 30, originY: 0 }}
          initial={{ opacity: 0, rotate: 0 }}
          animate={{ opacity: [0, 1, 1, 0], rotate: side < 0 ? [0, 25, -25, 25, -25, 20, -20, 0] : [0, -25, 25, -25, 25, -20, 20, 0] }}
          transition={{ duration: T, opacity: { duration: T, times: [0, 0.05, 0.92, 1] }, rotate: { duration: T * 0.9 } }}
        >
          🔔
        </motion.div>
      ))}
      {/* The salute: a rocket's trail up, then the burst. */}
      {salute.map((f, i) => (
        <div key={i} className="absolute" style={{ left: f.x, top: 0 }}>
          <motion.span
            className="absolute block w-[3px] rounded-full"
            style={{ height: 24, background: `linear-gradient(${f.c}, transparent)`, marginLeft: -1 }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: f.y, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.45, delay: f.delay, ease: 'easeOut' }}
          />
          {Array.from({ length: 16 }, (_, k) => {
            const a = (k / 16) * Math.PI * 2;
            return (
              <motion.span
                key={k}
                className="absolute block h-1.5 w-1.5 rounded-full"
                style={{ top: f.y, background: f.c, boxShadow: `0 0 8px ${f.c}` }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: Math.cos(a) * 80, y: Math.sin(a) * 80 + 30, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.2, delay: f.delay + 0.45, ease: 'easeOut' }}
              />
            );
          })}
        </div>
      ))}
      {/* The crown: drops onto the bar, bounces, rolls to Antipka. */}
      <motion.div
        className="absolute text-4xl"
        style={{ left: -20, top: -44 }}
        initial={{ y: -260, x: 0, rotate: 0, opacity: 0 }}
        animate={{
          y: [-260, 0, -34, 0, -10, 0, 0],
          x: [0, 0, 20, 40, 60, ax - 30, ax - 30],
          rotate: [0, 0, 30, 60, 120, 340, 340],
          opacity: [0, 1, 1, 1, 1, 1, 0],
        }}
        transition={{ duration: T, times: [0, at(0.4), at(0.55), at(0.7), at(0.8), at(1.5), at(1.55)], ease: 'easeOut' }}
      >
        👑
      </motion.div>
      {/* Antipka: in to catch it, puts it on, wails, and runs off with it. */}
      <motion.div
        className="absolute"
        style={{ left: ax - 36, top: -92 }}
        initial={{ x: runOff, scaleX: -1 }}
        animate={{
          x: [runOff, runOff, 0, 0, 0, 0, runOff + 60],
          y: [0, 0, 0, -10, 0, 0, 0],
          scaleX: [-1, -1, -1, -1, -1, 1, 1],
          rotate: [0, 0, 0, 0, -6, 6, 0],
        }}
        transition={{ duration: T, times: [0, at(0.5), at(1.45), at(1.65), at(2.3), at(3.6), at(4.6)], ease: 'easeInOut' }}
      >
        <Antipka size={84} run />
        {/* The crown on his head, sliding down over his eyes. */}
        <motion.span
          className="absolute left-[18px] text-4xl"
          initial={{ opacity: 0, top: -26 }}
          animate={{ opacity: [0, 0, 1, 1], top: [-26, -26, -26, 0] }}
          transition={{ duration: T, times: [0, at(1.6), at(1.65), at(2.1)] }}
        >
          👑
        </motion.span>
      </motion.div>
      {/* His tears. */}
      {tears.map((t, i) => (
        <motion.span
          key={`t${i}`}
          className="absolute block h-2.5 w-2 rounded-full bg-[#7dd3fc]"
          style={{ left: ax, top: -60, borderRadius: '50% 50% 50% 50% / 30% 30% 70% 70%' }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: t.dx, y: [0, -t.up, 40], opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, delay: t.delay, ease: 'easeOut' }}
        />
      ))}
      <motion.span
        className="absolute whitespace-nowrap rounded-lg border-2 border-[#7c2d12] bg-[#fef3c7] px-2 text-lg font-black text-[#7c2d12]"
        style={{ left: ax - 70, top: -150 }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1.15, 1, 1], rotate: [0, 0, -4, 4, 0] }}
        transition={{ duration: T, times: [0, at(2.2), at(2.32), at(3.5), at(3.7)] }}
      >
        Казна пуста!
      </motion.span>
      {/* The bogatyrs at the other end of the bar, cheering. */}
      {BOGATYRS.map((bg, i) => (
        <motion.div
          key={bg.name}
          className="absolute"
          style={{ left: -150 + i * 46 - 30, top: -78 }}
          initial={{ y: 60, opacity: 0, scaleY: 0.3 }}
          animate={{ y: [60, 60, -8, 0, -14, 0, -14, 0, 60], opacity: [0, 0, 1, 1, 1, 1, 1, 1, 0], scaleY: [0.3, 0.3, 1.1, 1, 1, 1, 1, 1, 0.3] }}
          transition={{ duration: T, times: [0, at(2.6 + i * 0.08), at(2.8 + i * 0.08), at(2.95), at(3.2), at(3.4), at(3.65), at(3.85), at(4.6)] }}
        >
          <Bogatyr size={70} beard={bg.beard} hair={bg.hair} />
        </motion.div>
      ))}
      <motion.span
        className="absolute whitespace-nowrap text-2xl"
        style={{ left: -150, top: -130, fontFamily: "'Russo One', sans-serif", color: '#fde047', WebkitTextStroke: '1.5px #7c2d12', textShadow: '0 3px 0 #7c2d12' }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1.2, 1, 1] }}
        transition={{ duration: T, times: [0, at(3), at(3.12), at(4.2), at(4.5)] }}
      >
        Слава!
      </motion.span>
    </At>
  );
}

/* ---------------------------------- Крабс --------------------------------- */

const GOLD_COIN = 'radial-gradient(circle at 35% 30%, #fffbe6, #fcd34d 45%, #b45309)';

/**
 * The entry fee: an old brass till rolls out beside him, the rep's coins arc into it, the
 * drawer shoots out and slams back, and the price pops up out of the top.
 */
function Register({ scene }: BodyProps) {
  const coins = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ delay: 0.12 + i * 0.05, lift: rand(50, 110), spin: rand(2, 4) })), []);
  // Off to the side, where the art isn't — and to whichever side has room on screen.
  const side = scene.x > window.innerWidth * 0.6 ? -1 : 1;
  const tx = 120 * side;
  const ty = 40;
  const brass = 'linear-gradient(180deg, #fcd34d, #d97706 55%, #92400e)';
  return (
    <At x={scene.x} y={scene.y}>
      <motion.div
        className="absolute"
        style={{ left: tx - 38, top: ty - 30 }}
        initial={{ opacity: 0, scale: 0.3, y: 30 }}
        animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.3, 1.1, 1, 1, 0.8], y: [30, 0, 0, 0, 10] }}
        transition={{ duration: 1.35, times: [0, 0.15, 0.25, 0.82, 1] }}
      >
        {/* The price, popping up out of the top as the bell would ring. */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 rounded border-2 border-[#78350f] bg-[#fef3c7] px-1.5 text-[13px] font-black text-[#14532d]"
          style={{ top: -6, fontFamily: "'Russo One', sans-serif" }}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: [10, 10, -26, -26], opacity: [0, 0, 1, 1] }}
          transition={{ duration: 1.2, times: [0, 0.4, 0.55, 1], ease: 'easeOut' }}
        >
          $1
        </motion.div>
        {/* Keys and display. */}
        <div
          className="absolute rounded-t-lg border-2 border-[#78350f]"
          style={{ left: 8, top: 0, width: 60, height: 26, background: brass }}
        >
          <div className="absolute inset-x-2 top-1.5 h-2.5 rounded-sm bg-[#14532d]" />
          <div className="absolute inset-x-2 bottom-1 flex justify-between">
            {[0, 1, 2, 3].map((k) => (
              <span key={k} className="h-1.5 w-1.5 rounded-full bg-[#fef3c7]" />
            ))}
          </div>
        </div>
        {/* Body. */}
        <div
          className="absolute rounded-md border-2 border-[#78350f]"
          style={{ left: 0, top: 24, width: 76, height: 30, background: brass }}
        >
          <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full bg-[#78350f]" />
        </div>
        {/* The drawer: out with a jolt when the coins land, and slammed back. */}
        <motion.div
          className="absolute rounded-b-md border-2 border-[#78350f] bg-[#92400e]"
          style={{ left: 6, top: 50, width: 64, height: 12 }}
          initial={{ y: 0 }}
          animate={{ y: [0, 0, 14, 14, 0] }}
          transition={{ duration: 1.2, times: [0, 0.42, 0.5, 0.75, 0.82], ease: 'easeOut' }}
        >
          <div className="absolute inset-x-3 top-0.5 flex justify-between">
            {[0, 1, 2].map((k) => (
              <span key={k} className="h-2 w-3 rounded-full" style={{ background: GOLD_COIN }} />
            ))}
          </div>
        </motion.div>
      </motion.div>
      {coins.map((c, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center justify-center rounded-full text-[11px] font-black"
          style={{
            width: 22,
            height: 22,
            marginLeft: -11,
            marginTop: -11,
            background: GOLD_COIN,
            color: '#78350f',
            border: '1.5px solid #92400e',
            boxShadow: '0 0 10px #f59e0b',
          }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{
            x: [0, tx * 0.5, tx],
            y: [0, -c.lift, ty - 8],
            opacity: [0, 1, 1, 0],
            scaleX: Array.from({ length: Math.round(c.spin) * 2 + 1 }, (_, k) => (k % 2 ? 0.15 : 1)),
          }}
          transition={{ duration: 0.55, delay: c.delay, ease: 'easeIn' }}
        >
          $
        </motion.div>
      ))}
    </At>
  );
}

/**
 * Krabs going down: everything he took comes back out of him — a burst of gold that falls to the
 * bottom of the screen, bounces, and rolls away.
 */
function CoinSpill({ scene }: BodyProps) {
  const floor = window.innerHeight - scene.y - 40;
  const coins = useMemo(
    () =>
      Array.from({ length: 34 }, () => {
        const up = rand(80, 240);
        const dx = rand(-180, 180);
        return { up, dx, roll: dx + rand(-160, 160), delay: rand(0, 0.25), s: rand(0.7, 1.2), spin: rand(3, 6), bounce: rand(30, 70) };
      }),
    [],
  );
  return (
    <At x={scene.x} y={scene.y}>
      <motion.div
        className="absolute rounded-full"
        style={{ width: 160, height: 160, left: -80, top: -80, background: 'radial-gradient(circle, rgba(253,224,71,0.8), rgba(245,158,11,0) 70%)' }}
        initial={{ scale: 0.3, opacity: 1 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      {coins.map((c, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center justify-center rounded-full text-[10px] font-black"
          style={{
            width: 22 * c.s,
            height: 22 * c.s,
            marginLeft: -11 * c.s,
            marginTop: -11 * c.s,
            background: GOLD_COIN,
            color: '#78350f',
            border: '1.5px solid #92400e',
            boxShadow: '0 0 8px #f59e0b',
          }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          // Up, down to the floor, a bounce, and rolling off along it.
          animate={{
            x: [0, c.dx * 0.5, c.dx, c.dx + (c.roll - c.dx) * 0.4, c.roll],
            y: [0, -c.up, floor, floor - c.bounce, floor],
            opacity: [0, 1, 1, 1, 0],
            rotate: [0, 0, 0, c.roll > c.dx ? 360 : -360, c.roll > c.dx ? 720 : -720],
          }}
          transition={{ duration: 2.2, delay: c.delay, times: [0, 0.25, 0.55, 0.72, 1], ease: 'easeOut' }}
        >
          $
        </motion.div>
      ))}
    </At>
  );
}

/* ------------------------------- Король Свин ------------------------------ */

const PIG_GREEN = '#7ab23c';

/**
 * The stolen egg: a nest of eggs turns up beside him, he snatches one — up it goes, glowing,
 * under his crown — and the green of his healing rises off him.
 */
function Egg({ scene }: BodyProps) {
  const from = scene.x > window.innerWidth / 2 ? 1 : -1;
  const sparks = useMemo(() => Array.from({ length: 10 }, () => ({ x: rand(-70, 70), delay: rand(0.55, 0.95) })), []);
  return (
    <At x={scene.x} y={scene.y}>
      {/* The nest it comes out of. */}
      <motion.div
        className="absolute"
        style={{ left: 90 * from - 40, top: 100 }}
        initial={{ opacity: 0, scale: 0.4, y: 20 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.9], y: [20, 0, 0, 10] }}
        transition={{ duration: 1.45, times: [0, 0.15, 0.8, 1] }}
      >
        <Nest />
      </motion.div>
      {/* The egg: snatched out of the nest and lifted up into his crown. */}
      <motion.div
        className="absolute"
        style={{
          width: 30,
          height: 38,
          marginLeft: -15,
          marginTop: -19,
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          background: 'radial-gradient(circle at 38% 30%, #ffffff, #f1efe6 55%, #c9c3ad)',
          boxShadow: '0 0 16px rgba(255,255,255,0.9), 0 0 30px rgba(122,178,60,0.7)',
        }}
        initial={{ x: 90 * from, y: 106, opacity: 0, scale: 0.8 }}
        animate={{ x: [90 * from, 90 * from, 40 * from, 0], y: [106, 106, 20, -70], opacity: [0, 1, 1, 1, 0], scale: [0.8, 0.8, 1.1, 1, 0.4] }}
        transition={{ duration: 1.25, delay: 0.15, times: [0, 0.25, 0.55, 0.85, 1], ease: 'easeInOut' }}
      />
      {/* His healing, rising off him. */}
      {sparks.map((p, i) => (
        <motion.span
          key={i}
          className="absolute text-xl font-black"
          style={{ left: p.x, top: 20, color: PIG_GREEN, textShadow: `0 0 8px ${PIG_GREEN}` }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: -110, opacity: [0, 1, 0] }}
          transition={{ duration: 0.8, delay: p.delay, ease: 'easeOut' }}
        >
          +
        </motion.span>
      ))}
    </At>
  );
}

/** A nest of twigs with two eggs left in it, in CSS. */
function Nest() {
  const egg = {
    width: 22,
    height: 28,
    borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
    background: 'radial-gradient(circle at 38% 30%, #ffffff, #f1efe6 55%, #c9c3ad)',
  };
  return (
    <div className="relative" style={{ width: 80, height: 44 }}>
      <div className="absolute" style={{ ...egg, left: 16, top: 0 }} />
      <div className="absolute" style={{ ...egg, left: 40, top: 2 }} />
      <div
        className="absolute inset-x-0 bottom-0 rounded-b-[50%] rounded-t-[30%]"
        style={{
          height: 26,
          background: 'repeating-linear-gradient(35deg, #8b5a2b 0 4px, #a8743f 4px 7px, #6b4220 7px 9px)',
          boxShadow: 'inset 0 4px 6px rgba(0,0,0,0.35), 0 3px 6px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}

const WOOD = 'linear-gradient(180deg, #d9a066, #a8672f)';
const STONE = 'linear-gradient(180deg, #b8bcc6, #6b7280)';

/**
 * His fort taking the blow: a couple of planks and a stone block flash up round him where the
 * strike lands, and the planks burst into splinters — the share of the hit his armour soaked.
 */
function Planks({ scene }: BodyProps) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const blocks = useMemo(
    () => [
      { x: side * 70, y: -10, w: 14, h: 80, wood: true, rot: side * 6 },
      { x: side * 46, y: -58, w: 70, h: 12, wood: true, rot: side * -4 },
      { x: side * 92, y: 40, w: 26, h: 26, wood: false, rot: 0 },
    ],
    [side],
  );
  const splinters = useSpray(14, [50, 120]);
  return (
    <At x={scene.x} y={scene.y}>
      {blocks.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-sm border border-black/40"
          style={{ width: b.w, height: b.h, left: b.x - b.w / 2, top: b.y - b.h / 2, background: b.wood ? WOOD : STONE, rotate: b.rot }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, b.wood ? 1.2 : 1], y: [0, 0, 0, b.wood ? 0 : 20] }}
          transition={{ duration: 0.75, times: [0, 0.15, 0.4, 0.6] }}
        />
      ))}
      <div className="absolute" style={{ left: side * 62, top: -20 }}>
        {splinters.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-sm"
            style={{ width: 4 + 6 * p.s, height: 3, background: '#c7884a', rotate: p.deg }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: p.dx, y: p.dy + 50, opacity: [0, 0, 1, 0], rotate: p.deg + p.rot }}
            transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
          />
        ))}
      </div>
    </At>
  );
}

/**
 * The pig going pop: a green cloud bursts where he stood, his fort's planks and his crown fly,
 * and the score floats up out of the smoke, the way it does in the game.
 */
function PigPoof({ scene }: BodyProps) {
  const puffs = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { dx: Math.cos(a) * rand(40, 90), dy: Math.sin(a) * rand(30, 70), s: rand(50, 90), delay: rand(0, 0.12) };
  }), []);
  const debris = useSpray(12, [120, 260]);
  return (
    <At x={scene.x} y={scene.y}>
      {puffs.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ width: p.s, height: p.s, marginLeft: -p.s / 2, marginTop: -p.s / 2, background: 'radial-gradient(circle at 40% 35%, #e8f5d0, #a3d16a 55%, #6b9b2f)' }}
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
          animate={{ x: p.dx, y: p.dy - 20, scale: [0.2, 1.2, 1.4], opacity: [0, 0.95, 0] }}
          transition={{ duration: 1.3, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
      {debris.map((p, i) => (
        <motion.div
          key={`d${i}`}
          className="absolute rounded-sm border border-black/30"
          style={{ width: i % 3 ? 34 * p.s : 18, height: i % 3 ? 9 : 18, marginLeft: -12, marginTop: -5, background: i % 3 ? WOOD : STONE }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
          animate={{ x: p.dx, y: [0, p.dy - 60, p.dy + 220], rotate: p.rot * 2, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      ))}
      {/* The crown, knocked high and spinning down. */}
      <motion.div
        className="absolute text-4xl"
        style={{ marginLeft: -18, marginTop: -60 }}
        initial={{ y: 0, x: 0, rotate: 0, opacity: 0 }}
        animate={{ y: [0, -170, 260], x: [0, 30, 70], rotate: [0, 200, 520], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.8, times: [0, 0.35, 0.9, 1], ease: 'easeOut' }}
      >
        👑
      </motion.div>
      {/* The score. */}
      <motion.div
        className="absolute whitespace-nowrap text-4xl"
        style={{ marginLeft: -60, width: 120, textAlign: 'center', fontFamily: "'Russo One', sans-serif", color: '#fde047', WebkitTextStroke: '2px #1f2937', textShadow: '0 3px 0 #1f2937' }}
        initial={{ y: -10, opacity: 0, scale: 0.6 }}
        animate={{ y: [-10, -60, -110], opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1, 1] }}
        transition={{ duration: 2, delay: 0.3, times: [0, 0.2, 0.75, 1] }}
      >
        5000
      </motion.div>
    </At>
  );
}

/* ---------------------------------- Грю: ещё ----------------------------- */

/** The ice block round Gru giving way: big clear shards flying off, a frosty puff, a flash. */
function IceShatter({ scene }: BodyProps) {
  const shards = useSpray(20, [100, 220]);
  // Variant 1 is the King's: his shield is royal gold glass, not ice.
  const gold = scene.variant === 1;
  return (
    <At x={scene.x} y={scene.y}>
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 200,
          height: 200,
          left: -100,
          top: -100,
          background: gold
            ? 'radial-gradient(circle, rgba(255,255,255,0.95), rgba(253,224,71,0.5) 40%, transparent 70%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.95), rgba(186,230,253,0.5) 40%, transparent 70%)',
        }}
        initial={{ scale: 0.4, opacity: 1 }}
        animate={{ scale: 2, opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {shards.map((p, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            width: 26 * p.s,
            height: 34 * p.s,
            marginLeft: -13 * p.s,
            marginTop: -17 * p.s,
            clipPath: i % 2 ? 'polygon(50% 0, 100% 40%, 60% 100%, 0 60%)' : 'polygon(20% 0, 100% 25%, 75% 100%, 0 80%)',
            background: gold
              ? 'linear-gradient(140deg, rgba(255,255,255,0.95), rgba(253,230,138,0.9) 45%, rgba(202,138,4,0.75))'
              : 'linear-gradient(140deg, rgba(255,255,255,0.95), rgba(186,230,253,0.85) 45%, rgba(56,189,248,0.7))',
            filter: gold ? 'drop-shadow(0 0 6px #facc15)' : 'drop-shadow(0 0 6px #7dd3fc)',
          }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.dx, y: [0, p.dy - 30, p.dy + 160], rotate: p.rot, opacity: [1, 1, 0] }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      ))}
    </At>
  );
}

/**
 * Gru's "Изматывание", made visible: a minion dashes in from the bottom corner, grabs the XP
 * bubble off the rep and runs away with it, giggling.
 */
function MinionThief({ scene }: BodyProps) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const edge = side * (window.innerWidth / 2 + 80);
  const floor = Math.min(window.innerHeight - scene.y - 30, 220);
  const grabX = side * 70;
  return (
    <At x={scene.x} y={scene.y}>
      {/* The XP he's after, floating up off the rep. */}
      <motion.div
        className="absolute whitespace-nowrap rounded-full border-2 border-[#a3e635] bg-black/70 px-2 text-sm font-black text-[#a3e635]"
        style={{ marginLeft: -22, marginTop: -12 }}
        initial={{ x: grabX * 0.3, y: 20, opacity: 0, scale: 0.6 }}
        animate={{
          x: [grabX * 0.3, grabX, grabX, edge * 1.1],
          y: [20, floor - 100, floor - 100, floor - 100],
          opacity: [0, 1, 1, 1],
          scale: [0.6, 1, 1, 0.9],
        }}
        transition={{ duration: 1.4, times: [0, 0.3, 0.45, 1], ease: 'easeInOut' }}
      >
        +XP
      </motion.div>
      {/* The thief: in, a hop for the bubble, and away. */}
      <motion.div
        className="absolute"
        style={{ marginLeft: -22, top: floor - 80 }}
        initial={{ x: edge, y: 0 }}
        animate={{ x: [edge, grabX, grabX, edge * 1.1], y: [0, 0, -18, 0], scaleX: [-side, -side, side, side] }}
        transition={{ duration: 1.4, times: [0, 0.3, 0.42, 1], ease: 'easeInOut' }}
      >
        <Minion size={84} run />
      </motion.div>
      {/* What it cost you. */}
      <motion.div
        className="absolute whitespace-nowrap text-lg font-black text-[#f87171]"
        style={{ left: grabX - 20, top: floor - 150, textShadow: '0 2px 0 #000' }}
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: [0, 0, 1, 0], y: [0, 0, -10, -30] }}
        transition={{ duration: 1.3, times: [0, 0.4, 0.55, 1] }}
      >
        −XP
      </motion.div>
    </At>
  );
}

/**
 * Gru going down: Bob, Stuart and Kevin run in, hoist their boss over their heads and carry him
 * off the far side of the screen, while bananas rain down.
 */
function MinionsCarry({ scene }: BodyProps) {
  const off = window.innerWidth / 2 + 200;
  const bananas = useMemo(
    () => Array.from({ length: 14 }, () => ({ x: rand(-window.innerWidth / 2, window.innerWidth / 2), delay: rand(0.3, 1.4), rot: rand(-360, 360) })),
    [],
  );
  const art = scene.art;
  // Run in from the left, stop under him, lift, run off to the right.
  const xs = [-off, 0, 0, off];
  const times = [0, 0.3, 0.5, 1];
  return (
    <>
      {bananas.map((b, i) => (
        <motion.div
          key={i}
          className="absolute text-3xl"
          style={{ left: '50%', top: -40, marginLeft: b.x }}
          initial={{ y: 0, rotate: 0, opacity: 1 }}
          animate={{ y: window.innerHeight + 80, rotate: b.rot }}
          transition={{ duration: 1.4, delay: b.delay, ease: 'easeIn' }}
        >
          🍌
        </motion.div>
      ))}
      <At x={scene.x} y={scene.y}>
        {/* Him, lifted and carried away. */}
        {art && (
          <motion.div
            className="absolute overflow-hidden rounded-full border-4 border-[#f5c518]"
            style={{ width: 150, height: 150, left: -75, top: -90, backgroundImage: `url(${art})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.6)' }}
            initial={{ x: 0, y: 0, rotate: 0 }}
            animate={{ x: xs, y: [0, 0, -20, -20], rotate: [0, 0, -8, 8] }}
            transition={{ duration: 2.4, times, ease: 'easeInOut' }}
          />
        )}
        {[-62, 0, 62].map((dx, i) => (
          <motion.div
            key={dx}
            className="absolute"
            style={{ left: dx - 25, top: 48 }}
            initial={{ x: -off }}
            animate={{ x: xs, y: [0, 0, -14, -14] }}
            transition={{ duration: 2.4, times, ease: 'easeInOut', delay: i * 0.04 }}
          >
            <Minion size={92} run twoEyes={i === 1} />
          </motion.div>
        ))}
      </At>
    </>
  );
}

/* --------------------------------- Николь: ещё ---------------------------- */

/** A pink house slipper with a fluffy strap, in CSS. */
function SlipperShape({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size * 0.45 }}>
      <div
        className="absolute inset-0"
        style={{ borderRadius: '50% 45% 45% 50% / 60% 50% 50% 60%', background: 'linear-gradient(180deg, #f9a8d4, #db2777)', border: '2px solid #9d174d' }}
      />
      <div
        className="absolute"
        style={{ left: '8%', top: '-28%', width: '52%', height: '70%', borderRadius: '50% 50% 30% 30%', background: 'radial-gradient(circle at 40% 40%, #fff1f7, #fbcfe8 60%, #f472b6)', border: '2px solid #be185d' }}
      />
    </div>
  );
}

/**
 * Strict mum catches you slacking: a slipper comes whistling in from the corner, spinning, and
 * smacks the middle of the screen — a comic "ШЛЁП!" — with the edges flaring an angry red.
 */
function Slipper({ scene }: BodyProps) {
  const from = scene.x > window.innerWidth / 2 ? -1 : 1;
  const sx = -from * (window.innerWidth / 2 + 80);
  const sy = -window.innerHeight * 0.3;
  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={{ boxShadow: 'inset 0 0 90px 24px rgba(239,68,68,0.8)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0.2, 0.8, 0] }}
        transition={{ duration: 1.1, times: [0, 0.27, 0.35, 0.55, 0.7, 1] }}
      />
      <At x={scene.x} y={scene.y}>
        <motion.div
          className="absolute"
          style={{ marginLeft: -50, marginTop: -22 }}
          initial={{ x: sx, y: sy, rotate: 0, scale: 0.8 }}
          animate={{ x: [sx, 0, 6, 10], y: [sy, 0, 30, 140], rotate: [0, from * 720, from * 760, from * 820], scale: [0.8, 1.6, 1.4, 1], opacity: [1, 1, 1, 0] }}
          transition={{ duration: 1.1, times: [0, 0.3, 0.45, 1], ease: 'easeIn' }}
        >
          <SlipperShape size={100} />
        </motion.div>
        {/* The smack. */}
        <motion.div
          className="absolute flex items-center justify-center"
          style={{
            width: 170,
            height: 120,
            left: -85,
            top: -60,
            clipPath: 'polygon(50% 0, 60% 30%, 92% 10%, 72% 42%, 100% 55%, 70% 62%, 85% 95%, 55% 72%, 40% 100%, 36% 70%, 6% 88%, 26% 58%, 0 40%, 30% 36%, 14% 6%, 42% 28%)',
            background: 'radial-gradient(circle, #fff7ed, #fde047 55%, #f97316)',
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 0, 1.2, 1, 1], opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 1, times: [0, 0.3, 0.38, 0.75, 1] }}
        >
          <span className="text-xl font-black text-[#7c2d12]" style={{ fontFamily: "'Russo One', sans-serif" }}>
            ШЛЁП!
          </span>
        </motion.div>
      </At>
    </>
  );
}

/**
 * "Стальная воля": the crit you rolled meets a steel shield. It slams up in front of him, the blow lands on it — sparks off the face, a ring of
 * force, the shield jolting back — and it sinks away. The word itself comes from the stamp.
 */
/** How long the shield is up, and when in that it starts sinking away (s) — the stamp goes then too. */
const STEEL_SHIELD_SEC = 0.9;
const STEEL_SHIELD_FADE_SEC = 0.68;
export const STEEL_SHIELD_FADE_MS = STEEL_SHIELD_FADE_SEC * 1000;

function SteelShield({ scene }: BodyProps) {
  const sparks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + rand(-0.2, 0.2);
        const d = rand(70, 120);
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: rand(4, 8) };
      }),
    [],
  );
  const W = 120;
  const H = 140;
  return (
    <At x={scene.x} y={scene.y}>
      {/* The shield: a heater of polished steel with a riveted rim and a boss in the middle. */}
      <motion.svg
        className="absolute overflow-visible"
        style={{ left: -W / 2, top: -H / 2, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(186,230,253,0.5))' }}
        width={W}
        height={H}
        viewBox="0 0 120 140"
        initial={{ y: 80, scale: 0.4, opacity: 0 }}
        animate={{
          y: [80, 0, 0, 0, 0, 0, 30],
          x: [0, 0, 0, -7, 6, -3, 0],
          scale: [0.4, 1.12, 1, 0.95, 1, 1, 0.9],
          opacity: [0, 1, 1, 1, 1, 1, 0],
        }}
        transition={{
          duration: STEEL_SHIELD_SEC,
          times: [0, 0.18, 0.26, 0.32, 0.4, STEEL_SHIELD_FADE_SEC / STEEL_SHIELD_SEC, 1],
          ease: 'easeOut',
        }}
      >
        <defs>
          <linearGradient id="steel-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="35%" stopColor="#cbd5e1" />
            <stop offset="65%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <radialGradient id="steel-boss" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#334155" />
          </radialGradient>
        </defs>
        <path d="M60 4 L114 16 L114 62 C114 100 90 124 60 136 C30 124 6 100 6 62 L6 16 Z" fill="#1e293b" />
        <path d="M60 11 L107 21 L107 62 C107 96 86 117 60 128 C34 117 13 96 13 62 L13 21 Z" fill="url(#steel-face)" />
        {/* The light catching the upper left of it. */}
        <path d="M60 11 L107 21 L107 34 C80 30 40 40 13 58 L13 21 Z" fill="#ffffff" opacity={0.25} />
        {[
          [60, 18],
          [100, 27],
          [20, 27],
          [100, 70],
          [20, 70],
          [60, 120],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#e2e8f0" stroke="#334155" strokeWidth={1.5} />
        ))}
        <circle cx={60} cy={64} r={17} fill="url(#steel-boss)" stroke="#1e293b" strokeWidth={3} />
      </motion.svg>

      {/* The blow landing on it: a flash, sparks off the face, a ring of force. */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 90, height: 90, left: -45, top: -45, background: 'radial-gradient(circle, #ffffff, rgba(186,230,253,0.7) 40%, transparent 70%)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.4, 1.8], opacity: [0, 0, 1, 0] }}
        transition={{ duration: 0.6, times: [0, 0.4, 0.5, 1] }}
      />
      <motion.div
        className="absolute rounded-full border-4"
        style={{ width: 70, height: 70, left: -35, top: -35, borderColor: '#e0f2fe', boxShadow: '0 0 16px #7dd3fc' }}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 0.3, 3], opacity: [0, 1, 0] }}
        transition={{ duration: 0.75, times: [0, 0.36, 1] }}
      />
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full"
          style={{ width: s.s, height: s.s, marginLeft: -s.s / 2, marginTop: -s.s / 2, background: '#fef9c3', boxShadow: '0 0 8px #fde047' }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: [0, 0, s.x], y: [0, 0, s.y + 20], opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, delay: 0.27, times: [0, 0.05, 1], ease: 'easeOut' }}
        />
      ))}
    </At>
  );
}

/**
 * Nicole going down: seeing stars. Her picture wobbles round in circles with stars and birds
 * going round her head, a last slipper sails past, missing, and she keels over and drops.
 */
function Dizzy({ scene }: BodyProps) {
  const orbit = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ phase: (i / 6) * 360, bird: i % 3 === 2 })), []);
  const T = 2.4;
  return (
    <At x={scene.x} y={scene.y}>
      {scene.art && (
        <motion.div
          className="absolute overflow-hidden rounded-full border-4 border-[#3fa9e0]"
          style={{ width: 150, height: 150, left: -75, top: -75, backgroundImage: `url(${scene.art})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.6)' }}
          initial={{ rotate: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            rotate: [0, -12, 12, -16, 16, -10, 90],
            x: [0, -14, 14, -18, 18, 0, 30],
            y: [0, 0, 0, 0, 0, 0, window.innerHeight * 0.6],
            opacity: [1, 1, 1, 1, 1, 1, 0],
          }}
          transition={{ duration: T, times: [0, 0.12, 0.25, 0.38, 0.5, 0.62, 1], ease: 'easeInOut' }}
        />
      )}
      {/* Stars and birds going round her head. */}
      <motion.div
        className="absolute"
        style={{ left: 0, top: -95 }}
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 720, opacity: [0, 1, 1, 0] }}
        transition={{ duration: T * 0.7, ease: 'linear', opacity: { duration: T * 0.7, times: [0, 0.1, 0.85, 1] } }}
      >
        {orbit.map((o, i) => (
          <span
            key={i}
            className="absolute text-xl"
            style={{ transform: `rotate(${o.phase}deg) translateX(64px) rotate(${-o.phase}deg) scaleY(0.9)`, marginLeft: -10, marginTop: -12 }}
          >
            {o.bird ? '🐦' : '⭐'}
          </span>
        ))}
      </motion.div>
      {/* The last slipper, sailing past and missing. */}
      <motion.div
        className="absolute"
        style={{ marginLeft: -40, marginTop: -18 }}
        initial={{ x: -window.innerWidth / 2 - 80, y: -140, rotate: 0 }}
        animate={{ x: window.innerWidth / 2 + 80, y: -170, rotate: 900 }}
        transition={{ duration: 0.9, delay: 0.35, ease: 'linear' }}
      >
        <SlipperShape size={80} />
      </motion.div>
    </At>
  );
}

/* ---------------------------------- Фредди: ещё --------------------------- */

const CONFETTI = ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#f97316', '#a78bfa'];

/** "5:59 AM" turning over to "6:00 AM", a burst of confetti, and the line under it. */
function Dawn({ line, delay = 0 }: { line: string; delay?: number }) {
  const bits = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({ dx: rand(-200, 200), up: rand(80, 260), rot: rand(-720, 720), c: CONFETTI[i % CONFETTI.length], d: rand(0, 0.2) })),
    [],
  );
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="relative h-16 w-64 overflow-hidden">
        {(['5:59 AM', '6:00 AM'] as const).map((t, i) => (
          <motion.div
            key={t}
            className="absolute inset-0 flex items-center justify-center font-mono text-5xl font-bold text-white"
            style={{ textShadow: '0 0 14px rgba(255,255,255,0.8)' }}
            initial={{ y: i ? 64 : 0, opacity: i ? 0 : 1 }}
            animate={{ y: i ? [64, 64, 0] : [0, 0, -64], opacity: i ? [0, 0, 1] : [1, 1, 0] }}
            transition={{ duration: 0.5, delay: delay + 0.5, times: [0, 0.01, 1], ease: 'easeOut' }}
          >
            {t}
          </motion.div>
        ))}
      </div>
      <motion.div
        className="mt-3 text-2xl"
        style={{ fontFamily: "'Russo One', sans-serif", color: '#fde047', WebkitTextStroke: '1.5px #713f12', textShadow: '0 3px 0 #713f12' }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: [0.5, 1.15, 1] }}
        transition={{ duration: 0.5, delay: delay + 1 }}
      >
        {line}
      </motion.div>
      {bits.map((b, i) => (
        <motion.div
          key={i}
          className="absolute h-3 w-2 rounded-[2px]"
          style={{ left: '50%', top: '50%', background: b.c }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
          animate={{ x: [0, b.dx * 0.6, b.dx], y: [0, -b.up, -b.up + 320], opacity: [0, 1, 1, 0], rotate: b.rot }}
          transition={{ duration: 1.6, delay: delay + 1 + b.d, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/** Lived through the scream: the camera clock turns over to six, and the shift's survived. */
function SixAm() {
  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55), rgba(0,0,0,0.25) 70%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2, times: [0, 0.1, 0.8, 1] }}
      />
      <motion.div className="absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 0] }} transition={{ duration: 2, times: [0, 0.85, 1] }}>
        <Dawn line="ДОЖИЛ ДО УТРА!" />
      </motion.div>
    </>
  );
}

/**
 * Freddy going down: the power goes. Black, and in the black his face flickers in and out,
 * lit from below, while the music box plays — then nothing — then the clock strikes six.
 */
function PowerOut({ scene }: BodyProps) {
  return (
    <>
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0.85, 0] }}
        transition={{ duration: 4.2, times: [0, 0.04, 0.6, 0.9, 1] }}
      />
      {scene.art && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="overflow-hidden rounded-full"
            style={{
              width: 'min(70vw, 300px)',
              height: 'min(70vw, 300px)',
              backgroundImage: `url(${scene.art})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 30%',
              filter: 'brightness(0.9) contrast(1.3) saturate(0.6)',
              maskImage: 'radial-gradient(circle, #000 45%, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(circle, #000 45%, transparent 72%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.9, 0, 0.8, 0.1, 0.9, 0, 0.7, 0, 0] }}
            transition={{ duration: 2.4, delay: 0.3, times: [0, 0.05, 0.12, 0.25, 0.35, 0.45, 0.55, 0.68, 0.78, 0.9, 1] }}
          />
        </div>
      )}
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 2, delay: 2.3, times: [0, 0.05, 0.85, 1] }}>
        <Dawn line="СМЕНА ОКОНЧЕНА!" />
      </motion.div>
    </>
  );
}

/* ---------------------------------- Джокер -------------------------------- */

const JOKER_PURPLE = '#7b3fb5';
const JOKER_GREEN = '#4ade80';

/**
 * The Joker's card: a fan of cards shuffles open in front of him and one spins out of it reading
 * «КРИТ!» — it lands with a wobble, turns over with a snap, and on the back the joker grins and
 * shakes with laughter, sparkling, while "ХА!"s burst out round it and his healing rises off him.
 * Then it spins off into his pocket. The joke's on you.
 */
function CardTrick({ scene }: BodyProps) {
  const T = 1.9;
  const at = (sec: number) => sec / T;
  const has = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * Math.PI * 2 + rand(-0.3, 0.3), d: rand(110, 180), delay: rand(0.75, 1.15), s: rand(18, 30), c: i % 2 ? JOKER_PURPLE : JOKER_GREEN, r: rand(-30, 30) })),
    [],
  );
  const sparkles = useMemo(() => Array.from({ length: 10 }, () => ({ x: rand(-85, 85), y: rand(-105, 105), delay: rand(0.7, 1.4), s: rand(10, 18) })), []);
  const pluses = useMemo(() => Array.from({ length: 6 }, () => ({ x: rand(-70, 70), delay: rand(1, 1.3) })), []);
  const face = 'absolute inset-0 flex flex-col items-center justify-center rounded-xl border-4';
  const hidden = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as const;
  const SUITS = ['♠', '♦', '♣', '♥'];
  return (
    <At x={scene.x} y={scene.y}>
      {/* The deck, fanned open behind it and shut again. */}
      {SUITS.map((suit, i) => {
        const fan = (i - 1.5) * 22;
        return (
          <motion.div
            key={suit}
            className="absolute flex items-center justify-center rounded-lg border-2 bg-white text-2xl font-black"
            style={{ width: 70, height: 100, left: -35, top: -50, borderColor: JOKER_PURPLE, color: suit === '♦' || suit === '♥' ? '#dc2626' : '#111827', originY: 1.2 }}
            initial={{ opacity: 0, rotate: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], rotate: [0, fan, fan, 0], scale: [0.5, 1, 1, 0.6], y: [40, 0, 0, 20] }}
            transition={{ duration: 0.6, times: [0, 0.3, 0.7, 1], delay: i * 0.03 }}
          >
            {suit}
          </motion.div>
        );
      })}
      {/* The card itself. */}
      <motion.div
        className="absolute"
        style={{ width: 110, height: 156, left: -55, top: -78, perspective: 700 }}
        initial={{ scale: 0.2, opacity: 0, y: 40, rotate: -360 }}
        animate={{
          scale: [0.2, 1.15, 0.95, 1.05, 1, 1, 1.12, 1, 1.12, 1, 0.15],
          rotate: [-360, 8, -6, 3, 0, 0, -4, 4, -4, 0, 540],
          opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
          x: [0, 0, 0, 0, 0, 0, -5, 5, -5, 0, 0],
          y: [40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 30],
        }}
        transition={{ duration: T, times: [0, at(0.3), at(0.38), at(0.45), at(0.5), at(0.8), at(0.95), at(1.1), at(1.25), at(1.55), 1], ease: 'easeOut' }}
      >
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' } as React.CSSProperties}
          initial={{ rotateY: 0 }}
          // A snap over, past the turn and back.
          animate={{ rotateY: [0, 0, 205, 170, 185, 180] }}
          transition={{ duration: 0.75, delay: 0.45, times: [0, 0.05, 0.5, 0.7, 0.85, 1], ease: 'easeOut' }}
        >
          {/* Front: your crit. */}
          <div className={face} style={{ ...hidden, background: 'linear-gradient(160deg, #ffffff, #fef3c7)', borderColor: '#b91c1c' }}>
            <span className="absolute left-2 top-1 text-lg font-black text-[#b91c1c]">♥</span>
            <motion.span
              className="text-2xl font-black text-[#b91c1c]"
              style={{ fontFamily: "'Russo One', sans-serif" }}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 0.25, repeat: 2 }}
            >
              КРИТ!
            </motion.span>
            <span className="absolute bottom-1 right-2 rotate-180 text-lg font-black text-[#b91c1c]">♥</span>
          </div>
          {/* Back: the joke. */}
          <div
            className={face}
            style={{ ...hidden, background: 'linear-gradient(160deg, #f5f3ff, #ddd6fe)', borderColor: JOKER_PURPLE, transform: 'rotateY(180deg)', boxShadow: `0 0 26px ${JOKER_GREEN}` }}
          >
            <motion.span
              className="text-6xl leading-none"
              animate={{ rotate: [0, -12, 12, -12, 12, 0], y: [0, -4, 0, -4, 0] }}
              transition={{ duration: 0.7, delay: 0.95 }}
            >
              🃏
            </motion.span>
            <span className="mt-1 text-xl font-black" style={{ color: JOKER_PURPLE, fontFamily: "'Russo One', sans-serif" }}>
              ХА-ХА!
            </span>
          </div>
        </motion.div>
      </motion.div>
      {/* Glitter round it once it's turned. */}
      {sparkles.map((p, i) => (
        <motion.span
          key={`s${i}`}
          className="absolute"
          style={{ left: p.x, top: p.y, fontSize: p.s, color: i % 2 ? '#fde047' : JOKER_GREEN, textShadow: '0 0 8px currentColor', marginLeft: -6, marginTop: -8 }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.3, 0], rotate: 180 }}
          transition={{ duration: 0.5, delay: p.delay }}
        >
          ✦
        </motion.span>
      ))}
      {has.map((h, i) => (
        <motion.span
          key={i}
          className="absolute font-black"
          style={{ fontSize: h.s, color: h.c, fontFamily: "'Russo One', sans-serif", WebkitTextStroke: '1px #1e1b4b', marginLeft: -14, marginTop: -12 }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0 }}
          animate={{ x: Math.cos(h.a) * h.d, y: Math.sin(h.a) * h.d, opacity: [0, 1, 0], scale: [0.3, 1.3, 1], rotate: h.r }}
          transition={{ duration: 0.85, delay: h.delay, ease: 'easeOut' }}
        >
          ХА!
        </motion.span>
      ))}
      {pluses.map((p, i) => (
        <motion.span
          key={`p${i}`}
          className="absolute text-2xl font-black"
          style={{ left: p.x, top: 30, color: JOKER_GREEN, textShadow: `0 0 8px ${JOKER_GREEN}` }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: -120, opacity: [0, 1, 0] }}
          transition={{ duration: 0.8, delay: p.delay, ease: 'easeOut' }}
        >
          +
        </motion.span>
      ))}
    </At>
  );
}

/**
 * "Изматывание", the Joker's way: a flower blooms on his lapel and squirts a jet of acid at the
 * rep's XP as it floats up — it fizzes away to green drips.
 */
function AcidFlower({ scene }: BodyProps) {
  const side = scene.x > window.innerWidth / 2 ? -1 : 1;
  const flower = { x: side * 70, y: 30 };
  const xp = { x: side * 150, y: -60 };
  const drips = useMemo(() => Array.from({ length: 7 }, () => ({ dx: rand(-22, 22), delay: rand(0.55, 0.75), fall: rand(60, 120) })), []);
  return (
    <At x={scene.x} y={scene.y}>
      {/* The flower. */}
      <motion.div
        className="absolute"
        style={{ left: flower.x - 18, top: flower.y - 18, width: 36, height: 36 }}
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: [0, 1.2, 1, 1, 0], rotate: [-90, 0, 0, 0, 40] }}
        transition={{ duration: 1.4, times: [0, 0.15, 0.22, 0.8, 1] }}
      >
        {[0, 72, 144, 216, 288].map((r) => (
          <span
            key={r}
            className="absolute left-1/2 top-1/2 block h-4 w-3 rounded-full"
            style={{ background: '#f9fafb', border: '1px solid #a3a3a3', transform: `translate(-50%, -50%) rotate(${r}deg) translateY(-9px)` }}
          />
        ))}
        <span className="absolute left-1/2 top-1/2 block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: '#facc15', border: '1px solid #a16207' }} />
      </motion.div>
      {/* The XP it's aimed at, floating up off the rep. */}
      <motion.div
        className="absolute whitespace-nowrap rounded-full border-2 border-[#a3e635] bg-black/70 px-2 text-sm font-black text-[#a3e635]"
        style={{ left: xp.x - 24, top: xp.y - 12 }}
        initial={{ y: 40, opacity: 0, scale: 0.7 }}
        animate={{ y: [40, 0, 0, 6], opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 0.6], filter: ['hue-rotate(0deg)', 'hue-rotate(0deg)', 'hue-rotate(60deg) blur(1px)', 'hue-rotate(60deg) blur(3px)'] }}
        transition={{ duration: 1.1, times: [0, 0.3, 0.55, 1] }}
      >
        +XP
      </motion.div>
      {/* The jet: a stream of drops along an arc from the flower to the XP. */}
      {Array.from({ length: 12 }, (_, i) => {
        const t = i / 11;
        const x = flower.x + (xp.x - flower.x) * t;
        const y = flower.y + (xp.y - flower.y) * t - Math.sin(t * Math.PI) * 50;
        return (
          <motion.span
            key={i}
            className="absolute block h-2 w-2 rounded-full"
            style={{ left: x - 4, top: y - 4, background: JOKER_GREEN, boxShadow: `0 0 6px ${JOKER_GREEN}` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
            transition={{ duration: 0.35, delay: 0.3 + t * 0.2 }}
          />
        );
      })}
      {/* Fizz and drips where it hits. */}
      <motion.div
        className="absolute rounded-full"
        style={{ left: xp.x - 30, top: xp.y - 30, width: 60, height: 60, background: `radial-gradient(circle, ${JOKER_GREEN}cc, transparent 70%)` }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.4], opacity: [0, 1, 0] }}
        transition={{ duration: 0.8, delay: 0.45, times: [0, 0.1, 1] }}
      />
      {drips.map((d, i) => (
        <motion.span
          key={`d${i}`}
          className="absolute block h-3 w-2"
          style={{ left: xp.x + d.dx, top: xp.y, borderRadius: '50% 50% 50% 50% / 30% 30% 70% 70%', background: JOKER_GREEN }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: d.fall, opacity: [0, 1, 0] }}
          transition={{ duration: 0.7, delay: d.delay, ease: 'easeIn' }}
        />
      ))}
      <motion.span
        className="absolute whitespace-nowrap text-lg font-black text-[#f87171]"
        style={{ left: xp.x - 18, top: xp.y - 50, textShadow: '0 2px 0 #000' }}
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: [0, 0, 1, 0], y: [0, 0, -8, -26] }}
        transition={{ duration: 1.3, times: [0, 0.45, 0.6, 1] }}
      >
        −XP
      </motion.span>
    </At>
  );
}

/**
 * The Joker going down, as a jack-in-the-box: a box under him, the lid flies open, he pops out
 * on a spring and wobbles, a toy gun pops its «БАХ!» flag in a burst of confetti — then he's
 * squashed back in and the lid slams.
 */
function JackBox({ scene }: BodyProps) {
  const confetti = useMemo(
    () => Array.from({ length: 30 }, (_, i) => ({ dx: rand(-170, 170), up: rand(90, 230), rot: rand(-720, 720), c: [JOKER_PURPLE, JOKER_GREEN, '#fde047', '#f472b6'][i % 4] })),
    [],
  );
  const T = 2.9;
  const at = (sec: number) => sec / T;
  return (
    <At x={scene.x} y={scene.y + 40}>
      <motion.div
        className="absolute"
        style={{ left: -60, top: 30, width: 120, height: 100 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.1, 1, 1, 1, 1.12, 1, 0.8], y: [0, 0, 0, 0, 0, -18, 0, 0], opacity: [0, 1, 1, 1, 1, 1, 1, 0] }}
        transition={{ duration: T, times: [0, at(0.2), at(0.3), at(1.9), at(2.25), at(2.4), at(2.55), 1] }}
      >
        {/* The spring and him on it, rising out of the box. */}
        <motion.div
          className="absolute left-1/2"
          style={{ bottom: 70, marginLeft: -60, width: 120, originY: 1 }}
          initial={{ y: 100, scaleY: 0.2 }}
          animate={{ y: [100, 100, -20, 0, -8, 0, 0, 100], scaleY: [0.2, 0.2, 1.15, 0.95, 1.05, 1, 1, 0.2], rotate: [0, 0, -10, 8, -5, 3, 0, 0] }}
          transition={{ duration: T, times: [0, at(0.45), at(0.65), at(0.85), at(1.05), at(1.25), at(2.15), at(2.3)] }}
        >
          {scene.art && (
            <div
              className="mx-auto overflow-hidden rounded-full border-4"
              style={{ width: 120, height: 120, borderColor: JOKER_PURPLE, backgroundImage: `url(${scene.art})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: `0 0 18px ${JOKER_GREEN}` }}
            />
          )}
          <div
            className="mx-auto"
            style={{ width: 26, height: 60, background: 'repeating-linear-gradient(170deg, #9ca3af 0 4px, #4b5563 4px 8px)', borderRadius: 4 }}
          />
        </motion.div>
        {/* The box. */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center rounded-md border-4 text-3xl font-black"
          style={{ height: 76, background: `linear-gradient(160deg, #a855f7, ${JOKER_PURPLE})`, borderColor: '#3b0764', color: JOKER_GREEN }}
        >
          ?
        </div>
        {/* The lid: open, and slammed shut at the end. */}
        <motion.div
          className="absolute inset-x-0 rounded-md border-4"
          style={{ top: 12, height: 14, background: JOKER_GREEN, borderColor: '#14532d', originX: 0, originY: 1 }}
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, 0, -120, -120, 0] }}
          transition={{ duration: T, times: [0, at(0.4), at(0.5), at(2.2), at(2.3)] }}
        />
        {/* The toy gun with its flag. */}
        <motion.div
          className="absolute"
          style={{ right: -70, top: -60 }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1, 1, 0.6] }}
          transition={{ duration: T, times: [0, at(1.2), at(1.3), at(1.9), at(2.1)] }}
        >
          <div className="relative h-7 w-16 rounded-md border-2 border-black bg-[#6b7280]" />
          <motion.div
            className="absolute -top-9 left-10 whitespace-nowrap rounded border-2 border-black bg-white px-1.5 text-lg font-black text-[#dc2626]"
            style={{ fontFamily: "'Russo One', sans-serif", originX: 0 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: [0, 0, 1.2, 1] }}
            transition={{ duration: T, times: [0, at(1.35), at(1.45), at(1.55)] }}
          >
            БАХ!
          </motion.div>
        </motion.div>
      </motion.div>
      {confetti.map((b, i) => (
        <motion.div
          key={i}
          className="absolute h-3 w-2 rounded-[2px]"
          style={{ left: 70, top: -50, background: b.c }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: [0, b.dx * 0.6, b.dx], y: [0, -b.up, -b.up + 300], opacity: [0, 1, 1, 0], rotate: b.rot }}
          transition={{ duration: 1.4, delay: 1.4, ease: 'easeOut' }}
        />
      ))}
    </At>
  );
}

/* ------------------------------ Эндер-дракон: ещё ------------------------- */

/** A Minecraft XP orb: a little green-yellow ball with a bright core. */
function Orb({ s }: { s: number }) {
  return (
    <span
      className="block rounded-full"
      style={{ width: s, height: s, background: 'radial-gradient(circle at 40% 35%, #fefce8, #bef264 35%, #65a30d 70%)', boxShadow: '0 0 8px #a3e635' }}
    />
  );
}

/** "Изматывание", the dragon's way: XP orbs float up off the rep and he draws them into himself. */
function XpOrbs({ scene }: BodyProps) {
  const orbs = useMemo(
    () => Array.from({ length: 10 }, () => ({ x: rand(-120, 120), y: rand(130, 220), delay: rand(0, 0.25), s: rand(10, 16) })),
    [],
  );
  return (
    <At x={scene.x} y={scene.y}>
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ marginLeft: -o.s / 2, marginTop: -o.s / 2 }}
          initial={{ x: o.x, y: o.y, opacity: 0, scale: 1 }}
          animate={{ x: [o.x, o.x * 0.6, 0], y: [o.y, o.y * 0.3, 0], opacity: [0, 1, 1, 0], scale: [1, 1.1, 0.3] }}
          transition={{ duration: 0.9, delay: o.delay, ease: 'easeIn' }}
        >
          <Orb s={o.s} />
        </motion.div>
      ))}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 90, height: 90, left: -45, top: -45, background: 'radial-gradient(circle, rgba(190,242,100,0.7), transparent 70%)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.6], opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, times: [0, 0.7, 1] }}
      />
      <motion.span
        className="absolute whitespace-nowrap text-lg font-black text-[#f87171]"
        style={{ left: 50, top: -60, textShadow: '0 2px 0 #000' }}
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: [0, 0, 1, 0], y: [0, 0, -8, -26] }}
        transition={{ duration: 1.25, times: [0, 0.6, 0.72, 1] }}
      >
        −XP
      </motion.span>
    </At>
  );
}

/** The infection passing on: a stream of green particles from the one who fell into the next. */
function InfectPass({ scene }: BodyProps) {
  const bits = useMemo(() => Array.from({ length: 18 }, () => ({ x: rand(-60, 60), y: rand(-60, 60), delay: rand(0, 0.5), s: rand(6, 12) })), []);
  return (
    <At x={scene.x} y={scene.y}>
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{ width: b.s, height: b.s, background: i % 2 ? '#4ade80' : '#166534', boxShadow: '0 0 6px #22c55e', marginLeft: -b.s / 2, marginTop: -b.s / 2 }}
          initial={{ x: b.x, y: b.y, opacity: 0 }}
          animate={{ x: [b.x, b.x * 2.2, 0], y: [b.y, b.y - 80, 0], opacity: [0, 1, 1, 0], rotate: 180 }}
          transition={{ duration: 1.1, delay: b.delay, ease: 'easeInOut' }}
        />
      ))}
      <motion.span
        className="absolute whitespace-nowrap text-lg font-black text-[#4ade80]"
        style={{ left: -70, top: -110, width: 140, textAlign: 'center', textShadow: '0 2px 0 #052e16' }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.1, 1, 1] }}
        transition={{ duration: 1.4, times: [0, 0.2, 0.8, 1] }}
      >
        ☣ +HP перешло
      </motion.span>
    </At>
  );
}

/** The creeper: flashing white and swelling as it hisses, then the boom — smoke and blocks. */
function CreeperBoom({ scene }: BodyProps) {
  const blocks = useSpray(16, [90, 200]);
  const smoke = useMemo(() => Array.from({ length: 10 }, () => ({ x: rand(-70, 70), y: rand(-60, 50), s: rand(50, 90), delay: rand(0.95, 1.1) })), []);
  return (
    <At x={scene.x} y={scene.y}>
      {scene.art && (
        <motion.div
          className="absolute overflow-hidden rounded-[20%]"
          style={{ width: 150, height: 150, left: -75, top: -75, backgroundImage: `url(${scene.art})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          initial={{ scale: 1, opacity: 1, filter: 'brightness(1)' }}
          animate={{
            scale: [1, 1.05, 1, 1.1, 1, 1.18, 1.3, 1.3],
            filter: ['brightness(1)', 'brightness(3)', 'brightness(1)', 'brightness(3)', 'brightness(1)', 'brightness(3)', 'brightness(4)', 'brightness(4)'],
            opacity: [1, 1, 1, 1, 1, 1, 1, 0],
          }}
          transition={{ duration: 1, times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.95, 1] }}
        />
      )}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 200, height: 200, left: -100, top: -100, background: 'radial-gradient(circle, #ffffff, #fde68a 30%, rgba(156,163,175,0.6) 60%, transparent 72%)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.7], opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, times: [0, 0.65, 1] }}
      />
      {smoke.map((p, i) => (
        <motion.div
          key={`m${i}`}
          className="absolute"
          style={{ width: p.s, height: p.s, left: p.x - p.s / 2, top: p.y - p.s / 2, background: 'rgba(156,163,175,0.85)' }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.2, 1.5], opacity: [0, 0.9, 0], y: -30 }}
          transition={{ duration: 0.6, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
      {blocks.map((p, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ width: 14, height: 14, marginLeft: -7, marginTop: -7, background: i % 3 === 0 ? '#3f6212' : i % 3 === 1 ? '#65a30d' : '#78716c', border: '1px solid rgba(0,0,0,0.4)' }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: p.dx, y: [0, p.dy - 40, p.dy + 140], opacity: [0, 1, 1, 0], rotate: p.rot }}
          transition={{ duration: 0.9, delay: 0.97, ease: 'easeOut' }}
        />
      ))}
    </At>
  );
}

/**
 * The dragon roaring, as he's hurt past a quarter of his health: the screen pulses purple, rings
 * of force roll out from him, End particles blow off, and the roar itself in big letters.
 */
function DragonRoar({ scene }: BodyProps) {
  const bits = useSpray(22, [120, 260]);
  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 35%, rgba(168,85,247,0.45), rgba(59,7,100,0.6))' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.4, 0.8, 0] }}
        transition={{ duration: 1.5, times: [0, 0.12, 0.35, 0.5, 1] }}
      />
      <At x={scene.x} y={scene.y}>
        {[0, 0.18, 0.36].map((d) => (
          <motion.div
            key={d}
            className="absolute rounded-full border-[5px]"
            style={{ width: 120, height: 120, left: -60, top: -60, borderColor: '#e9d5ff', boxShadow: '0 0 30px #a855f7, inset 0 0 20px #a855f7' }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 4, opacity: [0, 1, 0] }}
            transition={{ duration: 1, delay: d, ease: 'easeOut' }}
          />
        ))}
        {bits.map((p, i) => (
          <motion.span
            key={i}
            className="absolute block h-2.5 w-2.5"
            style={{ background: i % 2 ? '#d8b4fe' : '#7e22ce', boxShadow: '0 0 6px #a855f7', marginLeft: -5, marginTop: -5 }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: p.dx, y: p.dy, opacity: [0, 1, 0], rotate: p.rot }}
            transition={{ duration: 1.1, delay: 0.1, ease: 'easeOut' }}
          />
        ))}
        <motion.div
          className="absolute whitespace-nowrap text-5xl"
          style={{ left: -160, top: -150, width: 320, textAlign: 'center', fontFamily: "'Russo One', sans-serif", color: '#f5d0fe', WebkitTextStroke: '2px #3b0764', textShadow: '0 0 20px #a855f7, 0 4px 0 #3b0764' }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.25, 1.1, 1.3], x: [0, -6, 6, -4, 4, 0] }}
          transition={{ duration: 1.4, times: [0, 0.15, 0.75, 1] }}
        >
          РРРАААР!
        </motion.div>
      </At>
    </>
  );
}

/**
 * The dragon dying, as he does at the end of the game — and then the win, made a proper one.
 * Beams of light burst out of him, he rises and dissolves into purple particles, a fountain of
 * XP orbs goes up and an End portal opens below with the dragon egg settling on top of it. Then
 * the fireworks go up and the banner comes down: you've beaten the End.
 */
function EnderDeath({ scene }: BodyProps) {
  const T = 8;
  const at = (sec: number) => sec / T;
  const beams = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ a: i * (360 / 14) + rand(-8, 8), delay: rand(0, 1.3), len: rand(240, 460) })), []);
  const motes = useMemo(() => Array.from({ length: 30 }, () => ({ x: rand(-100, 100), y: rand(-90, 90), delay: rand(1.3, 2.4) })), []);
  const orbs = useMemo(() => Array.from({ length: 30 }, () => ({ dx: rand(-200, 200), up: rand(150, 320), delay: rand(2.1, 2.7), s: rand(10, 16) })), []);
  const rockets = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        x: rand(-window.innerWidth * 0.4, window.innerWidth * 0.4),
        y: -scene.y + rand(60, 240),
        delay: 3.6 + i * 0.42,
        c: ['#f472b6', '#38bdf8', '#facc15', '#4ade80', '#a78bfa', '#fb923c', '#f87171', '#e879f9'][i],
      })),
    [scene.y],
  );
  const confetti = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({ x: rand(-window.innerWidth / 2, window.innerWidth / 2), delay: rand(4.6, 5.6), rot: rand(-720, 720), c: ['#facc15', '#a855f7', '#38bdf8', '#4ade80', '#f472b6'][i % 5] })),
    [],
  );
  const floor = window.innerHeight - scene.y - 140;
  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 35%, rgba(88,28,135,0.6), rgba(0,0,0,0.8))' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: T, times: [0, 0.05, 0.9, 1] }}
      />
      {/* A white-out the moment he breaks apart. */}
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.85, 0, 0] }}
        transition={{ duration: T, times: [0, at(2.1), at(2.2), at(2.6), 1] }}
      />
      <At x={scene.x} y={scene.y}>
        {beams.map((b, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: 0, top: -6, height: 12, width: b.len, originX: 0, rotate: b.a, background: 'linear-gradient(90deg, #ffffff, rgba(216,180,254,0.9) 30%, rgba(168,85,247,0))', filter: 'blur(1px)' }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 1.2, delay: b.delay, ease: 'easeOut' }}
          />
        ))}
        {scene.art && (
          <motion.div
            className="absolute overflow-hidden rounded-full"
            style={{ width: 170, height: 170, left: -85, top: -85, backgroundImage: `url(${scene.art})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{
              y: [0, -10, -60, -90, -90],
              opacity: [1, 1, 0.6, 0, 0],
              scale: [1, 1.05, 1.1, 0.9, 0.9],
              filter: ['brightness(1) blur(0px)', 'brightness(1.8) blur(0px)', 'brightness(2.4) blur(2px)', 'brightness(3) blur(8px)', 'brightness(3) blur(8px)'],
            }}
            transition={{ duration: T, times: [0, at(0.6), at(1.8), at(2.3), 1] }}
          />
        )}
        {motes.map((m, i) => (
          <motion.span
            key={`m${i}`}
            className="absolute block h-2 w-2"
            style={{ left: m.x, top: m.y, background: i % 2 ? '#d8b4fe' : '#a855f7', boxShadow: '0 0 6px #a855f7' }}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], y: -140, rotate: 90 }}
            transition={{ duration: 1.3, delay: m.delay, ease: 'easeOut' }}
          />
        ))}
        {orbs.map((o, i) => (
          <motion.div
            key={`o${i}`}
            className="absolute"
            style={{ marginLeft: -o.s / 2, marginTop: -o.s / 2 }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: [0, o.dx * 0.6, o.dx], y: [0, -o.up, -o.up + 340], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.7, delay: o.delay, ease: 'easeOut' }}
          >
            <Orb s={o.s} />
          </motion.div>
        ))}
        {/* The portal, with the egg coming down onto it. */}
        <motion.div
          className="absolute"
          style={{ left: -120, top: floor, width: 240 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: T, times: [0, at(2.4), at(2.7), at(7.6), 1] }}
        >
          <motion.div
            className="relative overflow-hidden"
            style={{ height: 70, border: '8px solid #3f3f46', background: 'radial-gradient(ellipse at center, #1e1b4b, #020617)' }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: [0, 0, 1, 1] }}
            transition={{ duration: T, times: [0, at(2.4), at(2.8), 1] }}
          >
            {Array.from({ length: 22 }, (_, k) => (
              <motion.span
                key={k}
                className="absolute block h-1 w-1 rounded-full bg-[#a5f3fc]"
                style={{ left: `${(k * 37) % 100}%`, top: `${(k * 53) % 100}%` }}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 0.8 + (k % 4) * 0.3, repeat: Infinity }}
              />
            ))}
          </motion.div>
          <motion.div
            className="absolute left-1/2"
            style={{ top: -46, width: 34, height: 44, marginLeft: -17, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: 'radial-gradient(circle at 35% 30%, #6b21a8, #1e1b4b 60%, #0b0614)', boxShadow: '0 0 16px #a855f7' }}
            initial={{ y: -300, opacity: 0 }}
            animate={{ y: [-300, -300, 0, -6, 0, -6, 0, 0], opacity: [0, 0, 1, 1, 1, 1, 1, 1] }}
            transition={{ duration: T, times: [0, at(3), at(3.5), at(4.3), at(5), at(5.7), at(6.4), 1], ease: 'easeOut' }}
          >
            {Array.from({ length: 4 }, (_, k) => (
              <span key={k} className="absolute block h-1 w-1 bg-[#e9d5ff]" style={{ left: `${20 + k * 18}%`, top: `${30 + (k % 2) * 25}%` }} />
            ))}
          </motion.div>
        </motion.div>
        <motion.div
          className="absolute whitespace-nowrap text-3xl"
          style={{ left: -150, top: -170, width: 300, textAlign: 'center', fontFamily: "'Russo One', sans-serif", color: '#e9d5ff', WebkitTextStroke: '1.5px #3b0764', textShadow: '0 0 18px #a855f7, 0 3px 0 #3b0764' }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0, 1, 1, 0, 0], scale: [0.5, 0.5, 1.1, 1, 1, 1] }}
          transition={{ duration: T, times: [0, at(2.6), at(2.8), at(4), at(4.3), 1] }}
        >
          Край покорён!
        </motion.div>
        {/* Fireworks. */}
        {rockets.map((f, i) => (
          <div key={`r${i}`} className="absolute" style={{ left: f.x, top: 0 }}>
            <motion.span
              className="absolute block w-[3px] rounded-full"
              style={{ height: 26, background: `linear-gradient(${f.c}, transparent)`, marginLeft: -1 }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: f.y, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.45, delay: f.delay, ease: 'easeOut' }}
            />
            {Array.from({ length: 18 }, (_, k) => {
              const a = (k / 18) * Math.PI * 2;
              return (
                <motion.span
                  key={k}
                  className="absolute block h-2 w-2"
                  style={{ top: f.y, background: f.c, boxShadow: `0 0 8px ${f.c}` }}
                  initial={{ x: 0, y: 0, opacity: 0 }}
                  animate={{ x: Math.cos(a) * 90, y: Math.sin(a) * 90 + 40, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.3, delay: f.delay + 0.45, ease: 'easeOut' }}
                />
              );
            })}
          </div>
        ))}
        {/* The banner. */}
        <motion.div
          className="absolute flex flex-col items-center"
          style={{ left: -170, top: -210, width: 340 }}
          initial={{ y: -200, opacity: 0 }}
          animate={{ y: [-200, -200, 0, 0], opacity: [0, 0, 1, 1] }}
          transition={{ duration: T, times: [0, at(4.4), at(4.9), 1], type: 'spring' }}
        >
          <motion.span
            className="text-6xl"
            style={{ fontFamily: "'Russo One', sans-serif", color: '#fde047', WebkitTextStroke: '2px #713f12', textShadow: '0 4px 0 #713f12, 0 0 30px #facc15' }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: 5 }}
          >
            ПОБЕДА!
          </motion.span>
          <span className="mt-1 rounded-lg bg-black/60 px-3 py-1 text-center text-base font-bold text-[#e9d5ff]">
            Эндер-дракон повержен — ты прошёл Край!
          </span>
        </motion.div>
      </At>
      {/* Confetti over everything at the end. */}
      {confetti.map((b, i) => (
        <motion.div
          key={`c${i}`}
          className="absolute h-3 w-2 rounded-[2px]"
          style={{ left: '50%', top: -20, marginLeft: b.x, background: b.c }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: window.innerHeight + 40, opacity: [0, 1, 1], rotate: b.rot }}
          transition={{ duration: 2.4, delay: b.delay, ease: 'easeIn' }}
        />
      ))}
    </>
  );
}

/* --------------------------------- Шреддер -------------------------------- */

/**
 * "Слепая зона", the Foot Clan's way: a ninja leaps in front of him and takes the blow, then
 * is gone in a puff of smoke — which is why that rep didn't land.
 */
function FootNinjaSub({ scene }: BodyProps) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const puffs = useMemo(() => Array.from({ length: 9 }, () => ({ x: rand(-50, 50), y: rand(-40, 50), s: rand(30, 56) })), []);
  return (
    <At x={scene.x} y={scene.y}>
      <motion.div
        className="absolute"
        style={{ left: -45, top: -55 }}
        initial={{ x: side * 240, y: 40, rotate: side * 30, opacity: 0 }}
        animate={{ x: [side * 240, 0, 0], y: [40, -30, 0], rotate: [side * 30, 0, 0], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.75, times: [0, 0.4, 0.6, 0.62] }}
      >
        <FootNinja size={90} />
      </motion.div>
      {puffs.map((p, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full"
          style={{ width: p.s, height: p.s, left: p.x - p.s / 2, top: p.y - p.s / 2, background: 'radial-gradient(circle, #9ca3af, #4b5563 60%, transparent 72%)' }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 0, 1.3, 1.6], opacity: [0, 0, 0.95, 0] }}
          transition={{ duration: 1.05, times: [0, 0.43, 0.55, 1] }}
        />
      ))}
      <motion.span
        className="absolute whitespace-nowrap text-2xl"
        style={{ left: -side * 70 - 34, top: -96, fontFamily: "'Russo One', sans-serif", color: '#e5e7eb', WebkitTextStroke: '1.5px #111827', textShadow: '0 3px 0 #111827' }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0.5, 0.5, 1.15, 1] }}
        transition={{ duration: 1, times: [0, 0.45, 0.55, 1] }}
      >
        ПУФ!
      </motion.span>
    </At>
  );
}

/**
 * "Суп из черепашек" boiling: a steaming bowl comes up to him, the ladle tips, he slurps — and
 * the healing (shown by the HP pop) is his dinner.
 */
function TurtleSoupDinner({ scene }: BodyProps) {
  const steam = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ x: -36 + i * 14, delay: i * 0.12 })), []);
  return (
    <At x={scene.x} y={scene.y}>
      <motion.div
        className="absolute"
        style={{ left: -60, top: 30 }}
        initial={{ y: 160, opacity: 0 }}
        animate={{ y: [160, 0, 0, -10, 160], opacity: [0, 1, 1, 1, 0] }}
        transition={{ duration: 1.9, times: [0, 0.2, 0.6, 0.75, 1], ease: 'easeOut' }}
      >
        <svg width={120} height={70} viewBox="0 0 120 70" aria-hidden>
          <path d="M6 18 L114 18 C112 48 90 66 60 66 C30 66 8 48 6 18 Z" fill="#7f1d1d" stroke="#450a0a" strokeWidth={3} />
          <ellipse cx={60} cy={18} rx={54} ry={8} fill="#65a30d" stroke="#450a0a" strokeWidth={3} />
          <ellipse cx={72} cy={16} rx={13} ry={5} fill="#4d7c0f" stroke="#1a2e05" strokeWidth={1.5} />
          <circle cx={40} cy={17} r={3} fill="#a3e635" />
          <circle cx={52} cy={19} r={2} fill="#a3e635" />
        </svg>
        {steam.map((s, i) => (
          <motion.span
            key={i}
            className="absolute block rounded-full"
            style={{ left: 60 + s.x, top: -6, width: 12, height: 22, background: 'rgba(226,232,240,0.6)', filter: 'blur(3px)' }}
            animate={{ y: [0, -50], scaleX: [1, 2], opacity: [0, 0.8, 0] }}
            transition={{ duration: 1.1, delay: s.delay, repeat: 1 }}
          />
        ))}
      </motion.div>
      {/* The ladle, scooping up to him. */}
      <motion.div
        className="absolute"
        style={{ left: 10, top: 10, originX: 0, originY: 1 }}
        initial={{ opacity: 0, rotate: 40 }}
        animate={{ opacity: [0, 0, 1, 1, 0], rotate: [40, 40, 40, -35, -35], y: [0, 0, 20, -50, -50] }}
        transition={{ duration: 1.9, times: [0, 0.25, 0.35, 0.6, 0.75] }}
      >
        <svg width={70} height={20} viewBox="0 0 70 20" aria-hidden>
          <rect x={0} y={7} width={50} height={5} rx={2.5} fill="#9ca3af" stroke="#374151" strokeWidth={1.5} />
          <ellipse cx={58} cy={10} rx={11} ry={8} fill="#9ca3af" stroke="#374151" strokeWidth={1.5} />
          <ellipse cx={58} cy={8} rx={8} ry={4} fill="#65a30d" />
        </svg>
      </motion.div>
      <motion.span
        className="absolute whitespace-nowrap text-3xl"
        style={{ left: -40, top: -110, fontFamily: "'Russo One', sans-serif", color: '#bef264', WebkitTextStroke: '1.5px #1a2e05', textShadow: '0 3px 0 #1a2e05' }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0.4, 0.4, 1.2, 1], y: [0, 0, 0, -16] }}
        transition={{ duration: 1.9, times: [0, 0.55, 0.65, 1] }}
      >
        ХЛЮП!
      </motion.span>
    </At>
  );
}

/** The pot taken off the heat by a long set: a burst of steam and cold drops. */
function SoupCool({ scene }: BodyProps) {
  const drops = useMemo(() => Array.from({ length: 12 }, () => ({ x: rand(-90, 90), up: rand(30, 90) })), []);
  return (
    <At x={scene.x} y={scene.y}>
      <motion.div
        className="absolute rounded-full"
        style={{ width: 160, height: 100, left: -80, top: 20, background: 'radial-gradient(ellipse, rgba(224,242,254,0.85), rgba(186,230,253,0.3) 55%, transparent 72%)', filter: 'blur(4px)' }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.3, 1.6], opacity: [0, 0.9, 0], y: [0, -30, -60] }}
        transition={{ duration: 0.9 }}
      />
      {drops.map((d, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full"
          style={{ width: 6, height: 9, left: d.x, top: 50, background: '#7dd3fc', boxShadow: '0 0 6px #38bdf8' }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [0, -d.up, 40], opacity: [0, 1, 0] }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
        />
      ))}
    </At>
  );
}

/**
 * Bebop or Rocksteady walking on: a volley from his gun — the muzzle flashing at his side and
 * three laser bolts coming straight out of the picture at you.
 */
function LaserVolley({ scene }: BodyProps) {
  // Bebop (1) holds his gun low on the right of his picture, Rocksteady (-1) his on the left.
  const side = scene.variant ?? 1;
  const gun = { x: side * 70, y: 40 };
  const color = side > 0 ? '#e879f9' : '#fb923c';
  return (
    <At x={scene.x} y={scene.y}>
      {[0, 1, 2].map((i) => (
        <motion.div key={`f${i}`} className="absolute rounded-full" style={{ left: gun.x - 30, top: gun.y - 30, width: 60, height: 60, background: `radial-gradient(circle, #fff, ${color} 40%, transparent 70%)` }} initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }} transition={{ duration: 0.18, delay: i * 0.12 }} />
      ))}
      {[0, 1, 2].map((i) => {
        const tx = gun.x + side * rand(30, 120);
        const ty = gun.y + rand(80, 220);
        return (
          <motion.div
            key={`b${i}`}
            className="absolute rounded-full"
            style={{ left: gun.x - 14, top: gun.y - 5, width: 28, height: 10, background: `linear-gradient(90deg, #fff, ${color})`, boxShadow: `0 0 12px ${color}, 0 0 24px ${color}` }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
            animate={{ x: tx - gun.x, y: ty - gun.y, scale: [0.4, 2.6], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.35, delay: i * 0.12, ease: 'easeIn' }}
          />
        );
      })}
    </At>
  );
}

/**
 * Stockman down: his mousers pour out and scuttle the length of the health bar, jaws snapping,
 * before the boss himself walks out. Placed on the bar.
 */
function Mousers({ scene }: BodyProps) {
  const w = window.innerWidth;
  const pack = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ delay: i * 0.17, y: rand(-30, -8), s: rand(30, 40) })), []);
  return (
    <At x={scene.x} y={scene.y}>
      {pack.map((m, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: -m.s / 2, top: m.y - m.s / 2 }}
          initial={{ x: -w / 2 - 60 }}
          animate={{ x: w / 2 + 60, y: [0, -4, 0, -4, 0, -4, 0] }}
          transition={{ duration: 1.3, delay: m.delay, ease: 'linear' }}
        >
          <Mouser size={m.s} bite={i * 0.05} />
        </motion.div>
      ))}
    </At>
  );
}

/**
 * Shredder going down: he shudders, his helmet comes off and clangs across the floor, pieces of
 * his armour scatter — and the four of them come running through, bandanas flying, pizza in the
 * air, with the shout that ends every one of their fights.
 */
function Cowabunga({ scene }: BodyProps) {
  const T = 3.4;
  const at = (s: number) => s / T;
  const w = window.innerWidth;
  const shards = useMemo(() => Array.from({ length: 10 }, () => ({ dx: rand(-160, 160), up: rand(40, 140), r: rand(-400, 400), s: rand(10, 22) })), []);
  const pizza = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ x: rand(-w * 0.4, w * 0.4), delay: 1.3 + i * 0.12, up: rand(120, 260), r: rand(-360, 360) })), [w]);
  const TURTLES = ['#2563eb', '#dc2626', '#f97316', '#7c3aed'];
  return (
    <At x={scene.x} y={scene.y}>
      {scene.art && (
        <motion.div
          className="absolute overflow-hidden rounded-full border-4 border-[#b91c1c]"
          style={{ width: 150, height: 150, left: -75, top: -75, backgroundImage: `url(${scene.art})`, backgroundSize: 'cover', backgroundPosition: '45% 20%' }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: [0, -6, 6, -6, 6, 0, 0], y: [0, 0, 0, 0, 0, 0, window.innerHeight * 0.5], rotate: [0, 0, 0, 0, 0, 0, -50], opacity: [1, 1, 1, 1, 1, 1, 0] }}
          transition={{ duration: 1.3, times: [0, 0.08, 0.16, 0.24, 0.32, 0.4, 1], ease: 'easeIn' }}
        />
      )}
      {/* The helmet: off his head, onto the floor, bouncing. */}
      <motion.div
        className="absolute"
        style={{ left: -36, top: -110, filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' }}
        initial={{ y: 0, opacity: 0 }}
        animate={{ y: [0, 0, 170, 120, 170, 150, 170], x: [0, 0, 20, 40, 55, 62, 66], rotate: [0, 0, 40, 70, 95, 105, 110], opacity: [0, 1, 1, 1, 1, 1, 0] }}
        transition={{ duration: T, times: [0, at(0.2), at(0.35), at(0.5), at(0.62), at(0.72), 1] }}
      >
        <svg width={72} height={78} viewBox="-4 -20 72 78" className="overflow-visible" aria-hidden>
          {/* The crest: a tall blade up the middle, and a horn curving up either side. */}
          <path d="M32 -18 L36 6 L28 6 Z" fill="#d1d5db" stroke="#1f2937" strokeWidth={2} strokeLinejoin="round" />
          <path d="M16 14 C4 8 -2 -4 2 -16 C6 -6 12 2 22 8 Z" fill="#d1d5db" stroke="#1f2937" strokeWidth={2} strokeLinejoin="round" />
          <path d="M48 14 C60 8 66 -4 62 -16 C58 -6 52 2 42 8 Z" fill="#d1d5db" stroke="#1f2937" strokeWidth={2} strokeLinejoin="round" />
          {/* The dome. */}
          <path d="M8 32 C8 14 19 4 32 4 C45 4 56 14 56 32 Z" fill="#9ca3af" stroke="#1f2937" strokeWidth={2.5} />
          <path d="M16 14 C22 9 28 8 32 8" stroke="#f3f4f6" strokeWidth={2} fill="none" strokeLinecap="round" />
          {/* The face: a dark mask with his eyes still burning in it. */}
          <path d="M12 30 L52 30 L48 48 L32 56 L16 48 Z" fill="#111827" stroke="#1f2937" strokeWidth={2} strokeLinejoin="round" />
          <rect x={18} y={35} width={10} height={3.5} rx={1.5} fill="#ef4444" />
          <rect x={36} y={35} width={10} height={3.5} rx={1.5} fill="#ef4444" />
          <path d="M32 30 L32 56" stroke="#374151" strokeWidth={2} />
        </svg>
      </motion.div>
      {shards.map((p, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{ width: p.s, height: p.s * 0.7, background: 'linear-gradient(135deg, #e5e7eb, #4b5563)', clipPath: 'polygon(0 0, 100% 20%, 70% 100%, 10% 70%)' }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: p.dx, y: [0, -p.up, 220], rotate: p.r, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.3, delay: 0.3, ease: 'easeOut' }}
        />
      ))}
      {/* The turtles, running through in a line. */}
      {TURTLES.map((c, i) => (
        <motion.div
          key={c}
          className="absolute"
          style={{ left: -40, top: 40 + (i % 2) * 18 }}
          initial={{ x: -w / 2 - 120 }}
          animate={{ x: w / 2 + 120, y: [0, -14, 0, -14, 0, -14, 0] }}
          transition={{ duration: 1.5, delay: 1.1 + i * 0.16, ease: 'linear' }}
        >
          <Turtle size={84} bandana={c} />
        </motion.div>
      ))}
      {pizza.map((p, i) => (
        <motion.span
          key={i}
          className="absolute text-3xl"
          style={{ left: p.x, top: 60 }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [0, -p.up, 120], rotate: p.r, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, delay: p.delay, ease: 'easeOut' }}
        >
          🍕
        </motion.span>
      ))}
      <motion.span
        className="absolute whitespace-nowrap"
        style={{ left: 0, top: -150, fontSize: 'clamp(30px, 10vw, 54px)', fontFamily: "'Russo One', sans-serif", color: '#a3e635', WebkitTextStroke: '2px #14532d', textShadow: '0 4px 0 #14532d, 0 0 20px #65a30d', translateX: '-50%' }}
        initial={{ opacity: 0, scale: 0.3, rotate: -8 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.3, 0.3, 1.25, 1, 1], rotate: [-8, -8, 3, 0, 0] }}
        transition={{ duration: T, times: [0, at(1.1), at(1.3), at(1.5), 1] }}
      >
        КАВАБАНГА!
      </motion.span>
    </At>
  );
}

/* --------------------------------- Король -------------------------------- */

/**
 * The King going down the way a King Tower does in Clash Royale: a blast, the stonework flying
 * apart in a cloud of dust, his face popping up out of the rubble in a sulk — and then the three
 * crowns for a three-crown win, dropping into a row one after another.
 */
function TowerFall({ scene }: BodyProps) {
  const debris = useSpray(18, [120, 280]);
  const dust = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return { dx: Math.cos(a) * rand(50, 120), dy: Math.sin(a) * rand(20, 60) + 30, s: rand(60, 110), delay: rand(0, 0.2) };
      }),
    [],
  );
  return (
    <At x={scene.x} y={scene.y}>
      {/* The blast. */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 240, height: 240, left: -120, top: -120, background: 'radial-gradient(circle, #ffffff 0%, #fde68a 25%, #f97316 50%, transparent 72%)' }}
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
      {/* Dust rolling out and hanging. */}
      {dust.map((p, i) => (
        <motion.div
          key={`d${i}`}
          className="absolute rounded-full"
          style={{ width: p.s, height: p.s, marginLeft: -p.s / 2, marginTop: -p.s / 2, background: 'radial-gradient(circle at 40% 35%, #e7e2d8, #a8a29e 60%, rgba(120,113,108,0.6))' }}
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
          animate={{ x: p.dx, y: p.dy, scale: [0.2, 1.1, 1.4], opacity: [0, 0.9, 0] }}
          transition={{ duration: 1.8, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
      {/* The stonework flying apart: blocks of grey, a few of his red-and-gold banner. */}
      {debris.map((p, i) => (
        <motion.div
          key={`s${i}`}
          className="absolute rounded-sm border border-black/30"
          style={{
            width: i % 4 === 0 ? 16 : 26 * p.s,
            height: i % 4 === 0 ? 22 : 16 * p.s,
            marginLeft: -12,
            marginTop: -8,
            background: i % 4 === 0 ? 'linear-gradient(180deg, #dc2626, #991b1b 70%, #facc15 70%)' : STONE,
          }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
          animate={{ x: p.dx, y: [0, p.dy - 90, p.dy + 260], rotate: p.rot * 1.5, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
        />
      ))}
      {/* His face out of the rubble, sulking, then sinking back. */}
      <motion.div
        className="absolute"
        style={{ left: -45, top: -20 }}
        initial={{ y: 60, opacity: 0, scale: 0.6 }}
        animate={{ y: [60, -10, -10, 70], opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1, 0.8], rotate: [0, -6, 6, 0] }}
        transition={{ duration: 1.6, delay: 0.45, times: [0, 0.25, 0.75, 1] }}
      >
        <KingFace size={90} />
      </motion.div>
      {/* Three crowns dropping into a row. */}
      <div className="absolute" style={{ top: -150 }}>
        {[-1, 0, 1].map((k, i) => (
          <motion.div
            key={k}
            className="absolute"
            style={{ left: k * 74 - 32, top: k === 0 ? -14 : 0 }}
            initial={{ y: -260, scale: 0.4, rotate: k * 30, opacity: 0 }}
            animate={{ y: [-260, 0, -12, 0, 0], scale: [0.4, 1.25, 1, 1, 0.9], rotate: [k * 30, 0, 0, 0, 0], opacity: [0, 1, 1, 1, 0] }}
            transition={{ duration: 1.9, delay: 0.95 + i * 0.32, times: [0, 0.18, 0.28, 0.85, 1], ease: 'easeOut' }}
          >
            <div style={{ filter: 'drop-shadow(0 0 12px #60a5fa)' }}>
              <Crown size={64} />
            </div>
          </motion.div>
        ))}
      </div>
    </At>
  );
}

/* ------------------------------ Зелёный Гоблин ----------------------------- */

/** When, in the Goblin's last scene, his bomb goes off (s) — the sound keeps to it too. */
export const GOBLIN_BOOM_SEC = 0.9;

/**
 * The Goblin going down with his own bomb: the pumpkin from his hand rolls out in front of him,
 * fuse fizzing, its grin flashing faster and faster — and it goes off. A white-hot flash, a ring
 * of shock, the Goblin blown up and away spinning off his glider, pumpkin shell flying, and a
 * great cloud of orange smoke rolling out and up and hanging there before it thins away.
 */
function GoblinBlast({ scene }: BodyProps) {
  const B = GOBLIN_BOOM_SEC;
  const smoke = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2 + rand(-0.2, 0.2);
        const d = rand(40, 150);
        return {
          dx: Math.cos(a) * d,
          dy: Math.sin(a) * d * 0.7 - rand(20, 90),
          s: rand(70, 140),
          delay: B + rand(0, 0.25),
          hue: i % 3,
        };
      }),
    [B],
  );
  const shell = useSpray(14, [120, 260]);
  const SMOKE = [
    'radial-gradient(circle at 40% 35%, #fed7aa, #fb923c 50%, rgba(234,88,12,0.55))',
    'radial-gradient(circle at 40% 35%, #ffedd5, #f97316 55%, rgba(194,65,12,0.5))',
    'radial-gradient(circle at 40% 35%, #fde68a, #fdba74 50%, rgba(249,115,22,0.45))',
  ];
  return (
    <At x={scene.x} y={scene.y}>
      {/* The bomb, rolling out in front of him, flashing faster as the fuse runs down. */}
      <motion.div
        className="absolute"
        style={{ left: -32, top: 10 }}
        initial={{ scale: 0.4, opacity: 0, x: 60, rotate: 90 }}
        animate={{ scale: [0.4, 1, 1, 1.15, 1.3], opacity: [0, 1, 1, 1, 0], x: [60, 0, 0, 0, 0], rotate: [90, 0, -6, 6, 0] }}
        transition={{ duration: B + 0.05, times: [0, 0.3, 0.6, 0.9, 1] }}
      >
        <motion.div
          animate={{ filter: ['brightness(1)', 'brightness(2.2)', 'brightness(1)', 'brightness(2.4)', 'brightness(1)', 'brightness(2.6)', 'brightness(1)', 'brightness(3)'] }}
          transition={{ duration: B, times: [0, 0.3, 0.45, 0.6, 0.7, 0.8, 0.88, 1] }}
        >
          <JackO size={64} />
        </motion.div>
        {/* The fuse fizzing. */}
        {Array.from({ length: 6 }, (_, i) => (
          <motion.span
            key={i}
            className="absolute block h-1 w-1 rounded-full bg-yellow-200"
            style={{ left: 40, top: 4, boxShadow: '0 0 4px #facc15' }}
            animate={{ x: [0, rand(-14, 14)], y: [0, rand(-16, -4)], opacity: [1, 0] }}
            transition={{ duration: 0.25, delay: i * 0.12, repeat: 1 }}
          />
        ))}
      </motion.div>

      {/* The flash and the ring of shock. */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 300, height: 300, left: -150, top: -150, background: 'radial-gradient(circle, #ffffff 0%, #fef3c7 20%, #fb923c 45%, transparent 70%)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 2], opacity: [0, 1, 0] }}
        transition={{ duration: B + 0.6, times: [0, B / (B + 0.6), 1], ease: 'easeOut' }}
      />
      <motion.div
        className="absolute rounded-full border-[5px]"
        style={{ width: 80, height: 80, left: -40, top: -40, borderColor: '#fed7aa', boxShadow: '0 0 24px #f97316' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 5], opacity: [0, 1, 0] }}
        transition={{ duration: B + 0.55, times: [0, B / (B + 0.55), 1], ease: 'easeOut' }}
      />

      {/* Orange smoke: rolling out, rising, hanging, thinning. */}
      {smoke.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ width: p.s, height: p.s, marginLeft: -p.s / 2, marginTop: -p.s / 2, background: SMOKE[p.hue], filter: 'blur(1px)' }}
          initial={{ x: 0, y: 0, scale: 0.1, opacity: 0 }}
          animate={{ x: [0, p.dx, p.dx * 1.15], y: [0, p.dy, p.dy - 50], scale: [0.1, 1, 1.35], opacity: [0, 0.95, 0] }}
          transition={{ duration: 2.3, delay: p.delay, times: [0, 0.3, 1], ease: 'easeOut' }}
        />
      ))}

      {/* Pumpkin shell flying. */}
      {shell.map((p, i) => (
        <motion.div
          key={`s${i}`}
          className="absolute"
          style={{ width: 16 * p.s, height: 11 * p.s, marginLeft: -8, marginTop: -5, borderRadius: '60% 60% 30% 30%', background: i % 3 ? '#ea580c' : '#fde047', border: '1.5px solid #7c2d12' }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: [0, 0, p.dx], y: [0, 0, p.dy + 140], rotate: [0, 0, p.rot * 2], opacity: [0, 0, 1, 0] }}
          transition={{ duration: B + 1.2, times: [0, B / (B + 1.2), 0.75, 1], ease: 'easeOut' }}
        />
      ))}

      {/* The Goblin, blown up and away off his glider, spinning. */}
      <motion.div
        className="absolute"
        style={{ left: -45, top: -60 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], x: [0, 0, 60, 160, 240], y: [0, 0, -120, -220, -160], rotate: [0, 0, 220, 520, 720], scale: [0.6, 0.6, 1, 0.8, 0.5] }}
        transition={{ duration: B + 1.4, times: [0, B / (B + 1.4), 0.55, 0.8, 1], ease: 'easeOut' }}
      >
        <GoblinMini size={90} />
      </motion.div>

      {/* The word. */}
      <motion.div
        className="absolute whitespace-nowrap text-5xl font-black"
        style={{ left: -110, width: 220, top: -40, textAlign: 'center', color: '#fde047', WebkitTextStroke: '2.5px #7c2d12', textShadow: '0 4px 0 #7c2d12', fontFamily: "'Russo One', sans-serif" }}
        initial={{ scale: 0, opacity: 0, rotate: -8 }}
        animate={{ scale: [0, 0, 1.35, 1, 1], opacity: [0, 0, 1, 1, 0], rotate: [-8, -8, 5, 0, 0] }}
        transition={{ duration: B + 2, times: [0, B / (B + 2), (B + 0.15) / (B + 2), 0.8, 1] }}
      >
        БА-БАХ!
      </motion.div>
    </At>
  );
}

/* --------------------------------- Тай Лунг -------------------------------- */

/** When, in Tai Lung's last scene, the golden blast goes off (s) — the sound keeps to it too. */
export const WUXI_BOOM_SEC = 1.3;

/**
 * Tai Lung going down the way he does in the film: the Wuxi finger hold. Po pops up in front of
 * him with a paw held up, little finger raised — «СКИДЫЩ!» — the finger comes down, and a golden
 * blast rolls out from the spot: a white-gold flash, a ring of light sweeping out past the edges
 * of the screen, a gust of dust and peach blossom thrown out on it.
 */
function Wuxi({ scene }: BodyProps) {
  const B = WUXI_BOOM_SEC;
  const petals = useSpray(18, [140, 320]);
  const reach = Math.hypot(window.innerWidth, window.innerHeight);
  return (
    <At x={scene.x} y={scene.y}>
      {/* Po, popping up in front with his paw raised. */}
      <motion.div
        className="absolute"
        style={{ left: -50, top: 10 }}
        initial={{ y: 80, opacity: 0, scale: 0.6 }}
        animate={{ y: [80, 0, 0, 0, 30], opacity: [0, 1, 1, 1, 0], scale: [0.6, 1, 1, 1.05, 0.9] }}
        transition={{ duration: B + 0.6, times: [0, 0.2, 0.7, B / (B + 0.6), 1] }}
      >
        <MiniPo size={100} />
      </motion.div>
      {/* The paw, little finger up — and down. */}
      <motion.div
        className="absolute"
        style={{ left: 30, top: -70 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 1, 1, 1.2], opacity: [0, 1, 1, 1, 0] }}
        transition={{ duration: B + 0.2, times: [0, 0.15, 0.25, 0.85, 1] }}
      >
        <svg width={70} height={80} viewBox="0 0 70 80" aria-hidden style={{ filter: 'drop-shadow(0 0 8px #fde68a)' }}>
          <ellipse cx={35} cy={56} rx={22} ry={20} fill="#111" />
          <rect x={14} y={32} width={10} height={22} rx={5} fill="#111" />
          <rect x={26} y={30} width={10} height={22} rx={5} fill="#111" />
          <rect x={38} y={32} width={10} height={22} rx={5} fill="#111" />
          {/* The little finger: raised, then folding down on the beat. */}
          <motion.rect
            x={50}
            y={10}
            width={9}
            height={34}
            rx={4.5}
            fill="#111"
            style={{ transformOrigin: '54px 44px' }}
            animate={{ rotate: [0, 0, 80] }}
            transition={{ duration: B, times: [0, 0.75, 1] }}
          />
        </svg>
      </motion.div>
      {/* «СКИДЫЩ!» */}
      <motion.div
        className="absolute whitespace-nowrap text-5xl font-black"
        style={{ left: -120, width: 240, top: -120, textAlign: 'center', color: '#fde68a', WebkitTextStroke: '2.5px #7c2d12', textShadow: '0 4px 0 #7c2d12', fontFamily: "'Russo One', sans-serif" }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.3, 1, 1], opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: B + 2, times: [0, 0.3, 0.38, 0.85, 1] }}
      >
        СКИДЫЩ!
      </motion.div>
      {/* The blast: flash, then a ring of gold sweeping out past the screen's edges. */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 260, height: 260, left: -130, top: -130, background: 'radial-gradient(circle, #ffffff 0%, #fef3c7 30%, #fbbf24 55%, transparent 72%)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 2.6], opacity: [0, 1, 0] }}
        transition={{ duration: B + 0.8, times: [0, B / (B + 0.8), 1], ease: 'easeOut' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 100, height: 100, left: -50, top: -50, border: '10px solid #fde68a', boxShadow: '0 0 40px #f59e0b, inset 0 0 40px #f59e0b' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, (reach * 2.2) / 100], opacity: [0, 1, 0] }}
        transition={{ duration: B + 1.2, times: [0, B / (B + 1.2), 1], ease: 'easeOut' }}
      />
      {/* Dust and peach blossom thrown out on it. */}
      {petals.map((p, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ marginLeft: -8, marginTop: -8 }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: [0, 0, p.dx], y: [0, 0, p.dy], rotate: [0, 0, p.rot * 2], opacity: [0, 0, 1, 0] }}
          transition={{ duration: B + 1.3, times: [0, B / (B + 1.3), (B + 0.3) / (B + 1.3), 1], ease: 'easeOut' }}
        >
          {i % 3 ? <PeachPetal size={16 * p.s} /> : <div className="h-4 w-4 rounded-full bg-amber-100/70 blur-[2px]" />}
        </motion.div>
      ))}
    </At>
  );
}

/* --------------------------------- Альтрон --------------------------------- */

/** When, in Ultron's last scene, the hammer lands (s) — the sound keeps to it too. */
export const MJOLNIR_STRIKE_SEC = 0.75;

/**
 * Ultron going down: Mjolnir comes spinning in from the top corner of the screen trailing
 * lightning, and hits him square. A blue-white flash, forks of lightning, and his steel bursting
 * apart — dark plates and red-glowing bits flying out, a last red eye blinking out —
 * «СИСТЕМА ОТКЛЮЧЕНА».
 */
function MjolnirStrike({ scene }: BodyProps) {
  const S = MJOLNIR_STRIKE_SEC;
  const side = useMemo(() => (Math.random() < 0.5 ? -1 : 1), []);
  const from = { x: side * (window.innerWidth / 2 + 60), y: -scene.y - 60 };
  const plates = useSpray(20, [120, 300]);
  const f = (t: number, total: number) => t / total;
  return (
    <At x={scene.x} y={scene.y}>
      {/* The hammer, spinning in. */}
      <motion.div
        className="absolute"
        style={{ left: -30, top: -30 }}
        initial={{ x: from.x, y: from.y, rotate: 0, opacity: 1 }}
        animate={{ x: [from.x, 0, side * 40], y: [from.y, 0, -60], rotate: [0, side * 720, side * 820], opacity: [1, 1, 0] }}
        transition={{ duration: S + 0.5, times: [0, f(S, S + 0.5), 1], ease: 'easeIn' }}
      >
        <Mjolnir size={60} />
      </motion.div>
      {/* Lightning trailing it in, and forking out from the hit. */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * 360 + side * 20;
        return (
          <motion.svg
            key={i}
            viewBox="0 0 20 100"
            className="absolute"
            style={{ left: -10, top: 0, width: 20, height: 140, transformOrigin: '50% 0%', rotate: a, filter: 'drop-shadow(0 0 6px #93c5fd)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 0, 0.8, 0] }}
            transition={{ duration: S + 0.5, times: [0, f(S, S + 0.5), f(S + 0.05, S + 0.5), f(S + 0.15, S + 0.5), f(S + 0.22, S + 0.5), 1] }}
          >
            <path d="M10 0 L6 30 L13 34 L4 66 L11 70 L3 100" stroke="#eff6ff" strokeWidth={2.5} fill="none" />
          </motion.svg>
        );
      })}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 280, height: 280, left: -140, top: -140, background: 'radial-gradient(circle, #ffffff 0%, #bfdbfe 30%, #3b82f6 55%, transparent 72%)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 2.2], opacity: [0, 1, 0] }}
        transition={{ duration: S + 0.6, times: [0, f(S, S + 0.6), 1], ease: 'easeOut' }}
      />
      {/* His steel bursting apart. */}
      {plates.map((p, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            width: 22 * p.s,
            height: 14 * p.s,
            marginLeft: -11,
            marginTop: -7,
            clipPath: 'polygon(10% 0, 100% 20%, 85% 100%, 0 70%)',
            background: i % 4 ? 'linear-gradient(135deg, #6b7280, #1f2937)' : 'radial-gradient(circle, #fecaca, #ef4444 60%, #7f1d1d)',
            boxShadow: i % 4 ? undefined : '0 0 8px #ef4444',
          }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: [0, 0, p.dx], y: [0, 0, p.dy + 180], rotate: [0, 0, p.rot * 2], opacity: [0, 0, 1, 0] }}
          transition={{ duration: S + 1.4, times: [0, f(S, S + 1.4), f(S + 0.2, S + 1.4), 1], ease: 'easeOut' }}
        />
      ))}
      {/* A last red eye, blinking out. */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 14, height: 14, left: -7, top: -7, background: '#ef4444', boxShadow: '0 0 14px #ef4444' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0.2, 1, 0], scale: [1, 1, 1, 1, 1, 0.2] }}
        transition={{ duration: S + 1.6, times: [0, f(S + 0.4, S + 1.6), f(S + 0.6, S + 1.6), f(S + 0.9, S + 1.6), f(S + 1.1, S + 1.6), 1] }}
      />
      <motion.div
        className="absolute whitespace-nowrap font-mono text-2xl font-black"
        style={{ left: -130, width: 260, top: 60, textAlign: 'center', color: '#fecaca', textShadow: '0 0 10px #ef4444, 0 3px 0 #450a0a' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0.4, 1, 1, 0] }}
        transition={{ duration: S + 2.4, times: [0, f(S + 0.3, S + 2.4), f(S + 0.4, S + 2.4), f(S + 0.5, S + 2.4), f(S + 0.6, S + 2.4), 0.88, 1] }}
      >
        СИСТЕМА ОТКЛЮЧЕНА
      </motion.div>
    </At>
  );
}

/* --------------------------------- Кирюха --------------------------------- */

/** When, in Kiryukha's last scene, the wreath settles and the crowd goes up (s). */
export const LAUREL_AT_SEC = 1.3;

/**
 * Kiryukha going down — the master of the arena beaten. He drops to one knee in a burst of sand,
 * his helmet coming off and rolling away; spartans run in from both sides and raise their spears;
 * the player rises in his place, and a golden laurel wreath floats down from above onto their
 * head, with rose petals falling over the whole arena. «НОВЫЙ ХОЗЯИН АРЕНЫ».
 */
function LaurelCrown({ scene }: BodyProps) {
  const L = LAUREL_AT_SEC;
  const petals = useMemo(
    () =>
      Array.from({ length: 26 }, () => ({
        x: rand(-window.innerWidth / 2, window.innerWidth / 2),
        delay: rand(L, L + 1.4),
        d: rand(2.2, 3.4),
        rot: rand(0, 360),
        sway: rand(-40, 40),
      })),
    [L],
  );
  const sand = useSpray(16, [80, 200]);
  return (
    <At x={scene.x} y={scene.y}>
      {/* The sand thrown up as he goes down. */}
      {sand.map((p, i) => (
        <motion.span
          key={`s${i}`}
          className="absolute block rounded-full"
          style={{ width: 26 * p.s, height: 26 * p.s, marginLeft: -13 * p.s, marginTop: -13 * p.s, background: 'radial-gradient(circle at 40% 35%, #f5e6cf, #d6b48a 55%, rgba(168,135,95,0.4))' }}
          initial={{ x: 0, y: 60, scale: 0.2, opacity: 0 }}
          animate={{ x: p.dx, y: 60 + p.dy * 0.4, scale: [0.2, 1, 1.4], opacity: [0, 0.85, 0] }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
      ))}
      {/* His helmet, knocked off and rolling away. */}
      <motion.div
        className="absolute"
        style={{ left: -18, top: -80 }}
        initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
        animate={{ x: [0, 40, 150], y: [0, -60, 150], rotate: [0, 180, 600], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.5, times: [0, 0.3, 0.85, 1], ease: 'easeOut' }}
      >
        <svg width={36} height={36} viewBox="0 0 40 40" aria-hidden>
          <path d="M6 22 C6 6 34 6 34 22 L34 32 L26 32 L26 22 L14 22 L14 32 L6 32 Z" fill="#3f2a1d" stroke="#1c120c" strokeWidth={2} />
          <path d="M8 10 C14 0 26 0 32 10" stroke="#111" strokeWidth={5} fill="none" />
        </svg>
      </motion.div>
      {/* Spartans running in from both sides and raising their spears. */}
      {[-1, 1].map((side) =>
        [0, 1].map((k) => (
          <motion.div
            key={`${side}${k}`}
            className="absolute"
            style={{ top: 70, left: side * (150 + k * 46) - 22 }}
            initial={{ x: side * window.innerWidth * 0.6 }}
            animate={{ x: 0, y: [0, 0, -14, 0, -14, 0] }}
            transition={{ duration: 2.4, x: { duration: 0.9, delay: 0.3 + k * 0.1, ease: 'easeOut' }, y: { duration: 2.4, delay: 0.3, times: [0, 0.5, 0.6, 0.7, 0.8, 1] } }}
          >
            <div style={{ transform: `scaleX(${-side})` }}>
              <Spartan size={44} />
            </div>
          </motion.div>
        )),
      )}
      {/* The player, rising where he stood: the arena's theirs now. */}
      {scene.player && (
        // An exact 64px square: left to size itself, the box picked up a line of text's height
        // under the avatar, and the glow drawn to it came out an oval.
        <motion.div
          className="absolute flex h-16 w-16 items-center justify-center"
          style={{ left: -32, top: -92 }}
          initial={{ y: 140, scale: 0.4, opacity: 0 }}
          animate={{ y: 0, scale: 1.35, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 170, damping: 16, delay: 0.35 }}
        >
          {/* A gold glow behind them that flares the moment the wreath lands. */}
          <motion.span
            aria-hidden
            className="absolute -inset-3 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.55), transparent 70%)' }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.4, 1, 0.6], scale: [0.6, 1, 1.5, 1.2] }}
            transition={{ duration: L + 0.6, times: [0, L / (L + 0.6) - 0.1, L / (L + 0.6), 1] }}
          />
          <div className="relative flex">
            <Avatar name={scene.player.name} avatar={scene.player.avatar} level={scene.player.level} size="lg" />
          </div>
        </motion.div>
      )}
      {/* The wreath, floating down onto the player's head (or where his was). */}
      <motion.div
        className="absolute"
        style={{ left: -60, top: -60 }}
        initial={{ y: -scene.y - 100, rotate: -20, opacity: 0 }}
        // On a player it comes down round the face — its branches open upward, so it frames the
        // head rather than sitting on top of it like a pair of horns.
        animate={{
          y: scene.player ? [-scene.y - 100, -36, -48, -42] : [-scene.y - 100, -70, -80, -76],
          rotate: [-20, 8, -4, 0],
          opacity: [0, 1, 1, 1],
        }}
        transition={{ duration: L, ease: 'easeOut', times: [0, 0.8, 0.9, 1] }}
      >
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.2, delay: L, repeat: 2 }}>
          <Laurel size={120} />
        </motion.div>
      </motion.div>
      {/* Rose petals over the arena. */}
      {petals.map((p, i) => (
        <motion.span
          key={`p${i}`}
          className="absolute block"
          style={{ left: p.x, top: -scene.y - 20, width: 10, height: 8, borderRadius: '70% 0 70% 0', background: i % 3 ? '#e11d48' : '#fb7185' }}
          initial={{ opacity: 0 }}
          animate={{ y: [0, window.innerHeight + 40], x: [0, p.sway, -p.sway / 2], rotate: [p.rot, p.rot + 540], opacity: [0, 1, 1, 0] }}
          transition={{ duration: p.d, delay: p.delay, ease: 'linear' }}
        />
      ))}
      <motion.div
        className="absolute whitespace-nowrap text-center text-3xl font-black leading-tight"
        style={{ left: -150, width: 300, top: 130, color: '#fde68a', WebkitTextStroke: '2px #78350f', textShadow: '0 3px 0 #78350f', fontFamily: "'Russo One', sans-serif" }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.25, 1, 1] }}
        transition={{ duration: 4, times: [0, L / 4, (L + 0.2) / 4, 0.88, 1] }}
      >
        НОВЫЙ ХОЗЯИН
        <br />
        АРЕНЫ
      </motion.div>
    </At>
  );
}
