import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * The King's stage, from Clash Royale, drawn the way the other bosses' things are — in CSS and
 * SVG, no art files.
 *
 *  - {@link KingAmbient}: what's always on while he's up — the torches either side of the throne
 *    flickering, a glint running along his crown, the gold piles twinkling, and the ruby on his
 *    sceptre flaring with every blow. A crit knocks his crown off his head.
 *  - {@link KingPanic}: under 30% HP he starts to sweat and the edges of the picture throb red.
 *  - {@link ElixirBar}: "Регенерация" as the game's own elixir bar — it fills while you rest,
 *    and when it's full he drinks it.
 *  - {@link HealSpell}: the heal landing on him, the moment he gets his HP back.
 *  - {@link KingEmote}: the goblin's "mi-mi-mi" emote, popping up beside him when he's healed
 *    back to full — Clash Royale's taunt.
 *  - {@link MegaKnightRun}: now and then a little Mega Knight charges across under him, leaps,
 *    slams the floor and bellows his own name.
 *  - {@link KingFace}, {@link Crown}: the figures his scenes are made of (in AbilityScene).
 */

/** Where things are in his artwork (11-worldbreaker.jpg), as % of its width and height. */
const TORCHES: [number, number][] = [
  [19, 43],
  [80, 43],
];
const CROWN: [number, number] = [50, 22];
const RUBY: [number, number] = [32.5, 33];
const GOLD: [number, number][] = [
  [5, 90],
  [11, 86],
  [16, 93],
  [86, 88],
  [92, 84],
  [96, 92],
];

/** Elixir pink, the game's own. */
const ELIXIR = '#d946ef';

export function KingAmbient({ active, hitId, critId }: { active: boolean; hitId: number | null; critId: number | null }) {
  const calm = useReducedMotion();
  const sparkles = useMemo(() => GOLD.map(([x, y]) => ({ x, y, d: 1.6 + Math.random() * 1.4, delay: Math.random() * 3 })), []);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="ambient"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* The torches: warm light breathing unevenly round each flame. */}
          {TORCHES.map(([x, y], i) => (
            <motion.span
              key={`t${i}`}
              className="absolute block rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: '26%',
                aspectRatio: '1',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(circle, rgba(253,186,116,0.55) 0%, rgba(249,115,22,0.22) 35%, transparent 70%)',
                mixBlendMode: 'screen',
              }}
              animate={calm ? { opacity: 0.8 } : { opacity: [0.6, 1, 0.75, 0.95, 0.65], scale: [1, 1.08, 0.97, 1.05, 1] }}
              transition={{ duration: 1.3 + i * 0.27, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}

          {/* A glint running across his crown now and then. */}
          {!calm && (
            <div
              className="absolute overflow-hidden"
              style={{ left: `${CROWN[0]}%`, top: `${CROWN[1]}%`, width: '14%', height: '12%', transform: 'translate(-50%, -50%)', borderRadius: '30%' }}
            >
              <motion.span
                className="absolute block h-[160%] w-[30%]"
                style={{ top: '-30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)', rotate: 20 }}
                animate={{ left: ['-40%', '140%'] }}
                transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 2.8, ease: 'easeInOut' }}
              />
            </div>
          )}

          {/* The gold piles twinkling. */}
          {!calm &&
            sparkles.map((s, i) => (
              <motion.span
                key={`g${i}`}
                className="absolute block"
                style={{ left: `${s.x}%`, top: `${s.y}%`, width: 12, height: 12, marginLeft: -6, marginTop: -6 }}
                animate={{ scale: [0, 1, 0], rotate: [0, 90], opacity: [0, 1, 0] }}
                transition={{ duration: s.d, delay: s.delay, repeat: Infinity, repeatDelay: 1.5 }}
              >
                <Sparkle color="#fde68a" />
              </motion.span>
            ))}

          {/* The ruby on his sceptre: smouldering, and flaring with every blow. */}
          <motion.span
            key={hitId ?? 'idle'}
            className="absolute block rounded-full"
            style={{
              left: `${RUBY[0]}%`,
              top: `${RUBY[1]}%`,
              width: 16,
              height: 16,
              marginLeft: -8,
              marginTop: -8,
              background: 'radial-gradient(circle, #fff 0%, #fca5a5 30%, rgba(220,38,38,0) 70%)',
              mixBlendMode: 'screen',
            }}
            initial={hitId != null && !calm ? { scale: 3, opacity: 1 } : false}
            animate={calm ? { opacity: 0.6 } : { scale: [1, 1.3, 1], opacity: [0.45, 0.85, 0.45] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />

        </motion.div>
      )}
      {/* A crit knocks his crown off: up, spinning, and back down onto his head. Outside the
          clipped layer above — it flies higher than the picture's top edge. */}
      {active && critId != null && !calm && (
        <div
          key={`crown-${critId}`}
          aria-hidden
          className="pointer-events-none absolute z-20"
          style={{ left: `${CROWN[0]}%`, top: `${CROWN[1] + 5}%`, width: 40, marginLeft: -20, marginTop: -16 }}
        >
          <motion.div
            initial={{ y: 0, rotate: 0, opacity: 0 }}
            animate={{ y: [0, -70, -70, 0], x: [0, 18, 24, 0], rotate: [0, 200, 340, 360], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.85, times: [0, 0.4, 0.55, 1], ease: 'easeOut' }}
            style={{ filter: 'drop-shadow(0 0 8px #facc15)' }}
          >
            <Crown size={40} color="#facc15" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Where his forehead is, for the sweat (% of the picture). */
const BROW: [number, number][] = [
  [44, 33],
  [57, 32],
  [55, 36],
];

/**
 * Him losing: under 30% HP sweat starts running down his face, the edges of the picture throb
 * red, and now and then a puff of steam comes off his head.
 */
export function KingPanic({ active }: { active: boolean }) {
  const calm = useReducedMotion();
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[6%]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ boxShadow: 'inset 0 0 40px rgba(220,38,38,0.85)' }}
            animate={calm ? { opacity: 0.6 } : { opacity: [0.25, 0.9, 0.25] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          />
          {!calm &&
            BROW.map(([x, y], i) => (
              <motion.span
                key={i}
                className="absolute block"
                style={{ left: `${x}%`, top: `${y}%`, width: 8, height: 11, marginLeft: -4 }}
                animate={{ y: [0, 26], opacity: [0, 1, 0], scale: [0.6, 1, 0.8] }}
                transition={{ duration: 1.1, delay: i * 0.37, repeat: Infinity, repeatDelay: 0.3, ease: 'easeIn' }}
              >
                <svg viewBox="0 0 20 25" width="100%" height="100%">
                  <path d="M10 1 C14 8 18 12 18 16.5 C18 21 14.5 24 10 24 C5.5 24 2 21 2 16.5 C2 12 6 8 10 1 Z" fill="#bae6fd" stroke="#0369a1" strokeWidth={2} />
                </svg>
              </motion.span>
            ))}
          {!calm &&
            [-1, 1].map((side) => (
              <motion.span
                key={side}
                className="absolute block rounded-full"
                style={{ left: `${50 + side * 6}%`, top: '14%', width: 18, height: 18, background: 'rgba(241,245,249,0.75)', filter: 'blur(2px)' }}
                animate={{ y: [0, -30], x: [0, side * 14], scale: [0.4, 1.6], opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.9, delay: side > 0 ? 0.5 : 0, repeat: Infinity, repeatDelay: 1.2, ease: 'easeOut' }}
              />
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A four-pointed twinkle. */
function Sparkle({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
      <path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" fill={color} />
    </svg>
  );
}

/** Cells in the bar — ten, as in the game. */
const CELLS = 10;
/** How long into a pause before the bar shows: not between two reps of a set. */
const SHOW_AFTER_MS = 900;

/**
 * "Регенерация" as Clash Royale's elixir bar, along the bottom of his picture. It shows once
 * you've stopped, fills cell by cell over the regeneration tick, and when it's full he drinks it
 * — the heal lands (HealSpell) and it starts over. A rep empties it on the spot. Not shown while
 * he's already at full HP: there's nothing for him to win back.
 *
 * Its progress is read off `regenAt` the same way the healing itself is — whole intervals since
 * the mark — so the bar fills up exactly as the next heal comes due.
 */
export function ElixirBar({
  enabled,
  lastRepAt,
  regenAt,
  intervalMs,
}: {
  enabled: boolean;
  lastRepAt: number | null;
  regenAt: number | null;
  intervalMs: number;
}) {
  const calm = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const ticking = enabled && regenAt != null;
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [ticking]);

  const idle = lastRepAt == null ? 0 : now - lastRepAt;
  const show = ticking && idle >= SHOW_AFTER_MS;
  const fill = regenAt == null ? 0 : (((now - regenAt) % intervalMs) + intervalMs) % intervalMs / intervalMs;
  const full = fill * CELLS;
  const left = Math.max(1, Math.ceil(((1 - fill) * intervalMs) / 1000));
  /** The last three seconds: the bar throbs and shakes, the count goes red. */
  const urgent = left <= 3;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-[8%] bottom-[4%] z-20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
        >
          <div
            className="mb-1 flex items-center justify-center gap-1.5 text-[11px] font-bold"
            style={{ color: urgent ? '#fecaca' : '#f5d0fe', textShadow: '0 1px 2px #000' }}
          >
            <ElixirDrop size={14} />
            {urgent ? `полное HP через ${left} с — бей!` : `лечится через ${left} с`}
          </div>
          <motion.div
            className="flex gap-[3px] rounded-lg p-[3px]"
            style={{
              background: 'rgba(17,6,25,0.78)',
              border: `2px solid ${urgent ? ELIXIR : '#3b0764'}`,
              boxShadow: urgent ? `0 0 14px ${ELIXIR}, 0 2px 8px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.5)',
            }}
            animate={urgent && !calm ? { x: [0, -2, 2, -1, 0], scale: [1, 1.03, 1] } : { x: 0, scale: 1 }}
            transition={urgent ? { duration: 0.4, repeat: Infinity } : undefined}
          >
            {Array.from({ length: CELLS }, (_, i) => {
              const f = Math.max(0, Math.min(1, full - i));
              return (
                <div key={i} className="relative h-3 flex-1 overflow-hidden rounded-[3px]" style={{ background: '#2e1065' }}>
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${f * 100}%`,
                      background: `linear-gradient(180deg, #f5d0fe, ${ELIXIR} 45%, #a21caf)`,
                      boxShadow: f >= 1 ? `0 0 6px ${ELIXIR}` : undefined,
                    }}
                  />
                </div>
              );
            })}
          </motion.div>
          {/* Drops of it rising off the bar into him. */}
          {!calm &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute block"
                style={{ left: `${25 + i * 25}%`, top: -4 }}
                animate={{ y: [0, -70], opacity: [0, 1, 0], scale: [0.6, 1, 0.5] }}
                transition={{ duration: 1.4, delay: i * 0.45, repeat: Infinity, ease: 'easeOut' }}
              >
                <ElixirDrop size={12} />
              </motion.span>
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A drop of elixir: pink, with a highlight. */
export function ElixirDrop({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 20 25" aria-hidden style={{ filter: `drop-shadow(0 0 3px ${ELIXIR})` }}>
      <path d="M10 1 C14 8 18 12 18 16.5 C18 21 14.5 24 10 24 C5.5 24 2 21 2 16.5 C2 12 6 8 10 1 Z" fill={ELIXIR} stroke="#701a75" strokeWidth={1.4} />
      <ellipse cx={7} cy={15} rx={2} ry={3.2} fill="#fdf4ff" opacity={0.8} />
    </svg>
  );
}

/**
 * The heal landing on him: the spell's golden ring opening on the floor at his feet, a glow
 * washing over him, and pluses rising off him. Keyed by `healId`; nothing under reduced motion.
 */
export function HealSpell({ healId }: { healId: number | null }) {
  const calm = useReducedMotion();
  const pluses = useMemo(
    () => Array.from({ length: 9 }, () => ({ x: 20 + Math.random() * 60, y: 35 + Math.random() * 40, s: 14 + Math.random() * 12, delay: Math.random() * 0.35 })),
    // A fresh scatter for every heal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [healId],
  );
  if (healId == null || calm) return null;
  return (
    <div key={healId} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {/* The glow washing over him. */}
      <motion.div
        className="absolute inset-0 rounded-[18%]"
        style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(253,224,71,0.45), rgba(217,70,239,0.25) 45%, transparent 75%)', mixBlendMode: 'screen' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.1, times: [0, 0.25, 1] }}
      />
      {/* The spell's ring on the floor, opening out — flattened, as if lying on the ground. */}
      <div className="absolute left-1/2 top-[86%]" style={{ transform: 'scaleY(0.35)' }}>
        {[0, 0.15].map((d, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: 220, height: 220, left: -110, top: -110, border: `${i ? 3 : 6}px solid #fde047`, boxShadow: '0 0 24px #facc15, inset 0 0 24px #facc15' }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1, 1.15], opacity: [0, 1, 0] }}
            transition={{ duration: 1, delay: d, ease: 'easeOut' }}
          />
        ))}
      </div>
      {/* Pluses rising off him. */}
      {pluses.map((p, i) => (
        <motion.span
          key={i}
          className="absolute block font-black leading-none"
          style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: p.s, color: '#fef08a', textShadow: '0 0 6px #facc15, 0 1px 0 #854d0e' }}
          initial={{ y: 0, opacity: 0, scale: 0.4 }}
          animate={{ y: -60, opacity: [0, 1, 0], scale: [0.4, 1.1, 0.9] }}
          transition={{ duration: 1, delay: p.delay, ease: 'easeOut' }}
        >
          +
        </motion.span>
      ))}
    </div>
  );
}

/**
 * The taunt, the way the game puts an emote up: a white bubble beside him with Clash Royale's
 * goblin in it going "mi-mi-mi", jiggling.
 */
export function KingEmote({ show }: { show: boolean }) {
  const calm = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-[2%] top-[2%] z-30"
          style={{ transformOrigin: '20% 100%' }}
          initial={{ scale: 0, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0, opacity: 0, transition: { duration: 0.18 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 16 }}
        >
          <div
            className="relative flex flex-col items-center rounded-2xl px-2 pb-1.5 pt-1"
            style={{ background: '#ffffff', border: '3px solid #1e293b', boxShadow: '0 4px 0 #1e293b' }}
          >
            <motion.img
              src={`${import.meta.env.BASE_URL}emotes/goblin-mimimi.jpg`}
              alt=""
              className="block h-auto w-[88px] rounded-lg"
              animate={calm ? undefined : { x: [-2, 2, -2], rotate: [-4, 4, -4] }}
              transition={{ duration: 0.22, repeat: Infinity }}
            />
            <div className="whitespace-nowrap text-[12px] font-black leading-none" style={{ color: '#1e293b', fontFamily: "'Russo One', sans-serif" }}>
              Ми-ми-ми!
            </div>
            {/* The bubble's tail, pointing back at him. */}
            <div
              className="absolute -bottom-[11px] left-4 h-0 w-0"
              style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '11px solid #1e293b' }}
            />
            <div
              className="absolute -bottom-[6px] left-[18px] h-0 w-0"
              style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #ffffff' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The King's face, emote-style: crown, bushy brows, black beard; laughing or smug. */
export function KingFace({ size, laughing = false }: { size: number; laughing?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden>
      {/* Beard behind the face. */}
      <path d="M14 42 C14 66 28 76 40 76 C52 76 66 66 66 42 Z" fill="#1f1611" />
      <circle cx={40} cy={42} r={22} fill="#f2b98b" />
      {/* Crown. */}
      <path d="M18 24 L22 6 L31 17 L40 3 L49 17 L58 6 L62 24 Z" fill="#facc15" stroke="#a16207" strokeWidth={2} strokeLinejoin="round" />
      <rect x={17} y={21} width={46} height={7} rx={2} fill="#eab308" stroke="#a16207" strokeWidth={2} />
      <circle cx={40} cy={24.5} r={2.5} fill="#dc2626" />
      {/* Brows. */}
      <path d="M24 34 L36 36 M56 34 L44 36" stroke="#1f1611" strokeWidth={4} strokeLinecap="round" />
      {laughing ? (
        <>
          {/* Eyes squeezed shut, a tear of laughter. */}
          <path d="M26 41 Q30 37 34 41 M46 41 Q50 37 54 41" stroke="#1f1611" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <path d="M56 44 C58 48 58 50 56 51 C54 50 54 48 56 44 Z" fill="#7dd3fc" />
        </>
      ) : (
        <>
          <circle cx={30} cy={41} r={2.6} fill="#1f1611" />
          <circle cx={50} cy={41} r={2.6} fill="#1f1611" />
        </>
      )}
      {/* Moustache. */}
      <path d="M40 50 C34 46 26 48 22 53 C28 52 34 53 40 52 C46 53 52 52 58 53 C54 48 46 46 40 50 Z" fill="#1f1611" />
      {/* Mouth: wide open laughing, or a smirk. */}
      {laughing ? (
        <path d="M30 55 Q40 70 50 55 Z" fill="#7f1d1d" stroke="#1f1611" strokeWidth={1.5} />
      ) : (
        <path d="M33 57 Q40 61 47 56" stroke="#1f1611" strokeWidth={2} fill="none" strokeLinecap="round" />
      )}
      {laughing && <path d="M33 56.5 L47 56.5 L46 59 L34 59 Z" fill="#fff" />}
    </svg>
  );
}

/** A crown, the kind the game hands out per tower: blue for yours, red for theirs. */
export function Crown({ size, color = '#3b82f6' }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 100 80" aria-hidden>
      <path
        d="M8 70 L4 18 L28 40 L50 6 L72 40 L96 18 L92 70 Z"
        fill={color}
        stroke="#0f172a"
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M14 58 L86 58" stroke="#0f172a" strokeWidth={4} opacity={0.35} />
      <path d="M20 26 L30 44 L50 14 L58 28" stroke="#ffffff" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.45} />
      <circle cx={50} cy={6} r={6} fill="#fde047" stroke="#0f172a" strokeWidth={3} />
      <circle cx={4} cy={18} r={5} fill="#fde047" stroke="#0f172a" strokeWidth={3} />
      <circle cx={96} cy={18} r={5} fill="#fde047" stroke="#0f172a" strokeWidth={3} />
    </svg>
  );
}

/** How long one Mega Knight run takes, and when in it he lands his slam (s). */
const MK_SEC = 3.6;
const MK_LAND = 0.58;
/** The times of his run, as fractions: in, crouch, apex, land, stand, off. */
const MK_TIMES = [0, 0.32, 0.38, 0.48, MK_LAND, 0.72, 1];

/**
 * A little Mega Knight charging across the floor under the King now and then: he runs in, stops,
 * crouches, leaps — bellowing "Mega Knight!" — and slams down in a ring of dust, then runs off
 * the other side. First one a few seconds into the fight, then every 8–14 s. `under` is where
 * the floor is (the bottom of the King's picture); `onShout` gets when the slam lands, for the
 * sound. Nothing under reduced motion.
 */
export function MegaKnightRun({
  active,
  under,
  onShout,
}: {
  active: boolean;
  under: () => number | null;
  onShout: (landAt: number) => void;
}) {
  const calm = useReducedMotion();
  const [run, setRun] = useState<{ id: number; dir: -1 | 1; floor: number } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        setRun({ id: Date.now(), dir: Math.random() < 0.5 ? -1 : 1, floor: under() ?? window.innerHeight * 0.5 });
        // He shouts as he takes off, a beat before the landing.
        window.setTimeout(() => onShout((MK_LAND - MK_TIMES[2]) * MK_SEC), MK_TIMES[2] * MK_SEC * 1000);
        next(8000 + Math.random() * 6000);
      }, wait);
    };
    next(4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  if (!active || calm || !run) return null;
  const w = window.innerWidth;
  const SIZE = 74;
  const from = run.dir === 1 ? -SIZE - 20 : w + 20;
  const to = run.dir === 1 ? w + 20 : -SIZE - 20;
  // He stops a little off centre, on his side of the King.
  const mid = w / 2 - SIZE / 2 - run.dir * w * 0.18;
  return createPortal(
    <motion.div
      key={run.id}
      aria-hidden
      className="pointer-events-none fixed left-0 z-30"
      style={{ top: run.floor - SIZE * 1.05 }}
      initial={{ x: from }}
      animate={{ x: [from, mid, mid, mid, mid, mid, to] }}
      transition={{ duration: MK_SEC, times: MK_TIMES, ease: 'linear' }}
      onAnimationComplete={() => setRun((r) => (r?.id === run.id ? null : r))}
    >
      {/* The leap and the crouch either side of it. */}
      <motion.div
        animate={{ y: [0, 0, 6, -90, 0, 0, 0], scaleY: [1, 1, 0.82, 1.08, 0.86, 1, 1] }}
        transition={{ duration: MK_SEC, times: MK_TIMES, ease: 'easeInOut' }}
        style={{ transformOrigin: '50% 100%' }}
      >
        <div style={{ transform: `scaleX(${run.dir})` }}>
          <MegaKnight size={SIZE} />
        </div>
      </motion.div>
      {/* The slam: a ring of dust and a shockwave where he lands. */}
      <motion.div
        className="absolute left-1/2 top-full"
        style={{ transform: 'scaleY(0.35)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0] }}
        transition={{ duration: MK_SEC, times: [0, MK_LAND - 0.01, MK_LAND, 0.8] }}
      >
        <motion.div
          className="absolute rounded-full"
          style={{ width: 200, height: 200, left: -100, top: -100, border: '6px solid #a78bfa', boxShadow: '0 0 20px #7c3aed' }}
          initial={{ scale: 0.1 }}
          animate={{ scale: [0.1, 0.1, 1.3] }}
          transition={{ duration: MK_SEC * 0.8, times: [0, MK_LAND / 0.8, 1], ease: 'easeOut' }}
        />
      </motion.div>
      {[-1, -0.5, 0.5, 1].map((k) => (
        <motion.span
          key={k}
          className="absolute block rounded-full"
          style={{ left: SIZE / 2 - 16, top: SIZE * 0.85, width: 32, height: 32, background: 'radial-gradient(circle at 40% 35%, #e7e5e4, #a8a29e 60%, rgba(120,113,108,0.4))' }}
          initial={{ opacity: 0 }}
          animate={{ x: [0, 0, k * 70], y: [0, 0, -12], scale: [0.3, 0.3, 1.5], opacity: [0, 0, 0.9, 0] }}
          transition={{ duration: MK_SEC * 0.82, times: [0, MK_LAND / 0.82, 0.92, 1], ease: 'easeOut' }}
        />
      ))}
      {/* His shout. */}
      <motion.div
        className="absolute whitespace-nowrap rounded-xl px-2 py-0.5 text-[13px] font-black"
        style={{
          left: SIZE / 2,
          bottom: SIZE + 14,
          translateX: '-50%',
          background: '#fff',
          color: '#4c1d95',
          border: '3px solid #1e1b4b',
          boxShadow: '0 3px 0 #1e1b4b',
          fontFamily: "'Russo One', sans-serif",
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.15, 1, 0.9] }}
        transition={{ duration: MK_SEC, times: [0, MK_TIMES[2], MK_TIMES[3], MK_TIMES[5], 0.8] }}
      >
        MEGA KNIGHT!
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/**
 * The Mega Knight, small: black steel, a great domed helmet with a slit of glowing eyes and spikes
 * along the crest, spiked pauldrons and fists twice the size of his head. Legs pump while he runs.
 */
export function MegaKnight({ size }: { size: number }) {
  const steel = '#2b2f3a';
  const edge = '#0b0d12';
  return (
    <svg width={size} height={size * 1.05} viewBox="0 0 80 84" aria-hidden style={{ overflow: 'visible' }}>
      {/* Legs, pumping. */}
      {[0, 1].map((i) => (
        <motion.g
          key={i}
          style={{ transformOrigin: `${32 + i * 16}px 58px` }}
          animate={{ rotate: i ? [25, -25, 25] : [-25, 25, -25] }}
          transition={{ duration: 0.32, repeat: Infinity, ease: 'easeInOut' }}
        >
          <rect x={27 + i * 16} y={56} width={11} height={22} rx={3} fill={steel} stroke={edge} strokeWidth={2} />
          <rect x={25 + i * 16} y={74} width={15} height={8} rx={2} fill="#1a1d25" stroke={edge} strokeWidth={2} />
        </motion.g>
      ))}
      {/* Body. */}
      <path d="M18 30 L62 30 L58 62 L22 62 Z" fill={steel} stroke={edge} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M26 36 L54 36 L52 52 L28 52 Z" fill="#3b4150" />
      <rect x={22} y={56} width={36} height={6} fill="#4c1d95" stroke={edge} strokeWidth={2} />
      {/* Pauldrons with spikes. */}
      {[-1, 1].map((k) => (
        <g key={k} transform={`translate(${40 + k * 23} 31)`}>
          <ellipse rx={12} ry={9} fill={steel} stroke={edge} strokeWidth={2.5} />
          <path d={`M${-4 * k} -7 L${6 * k} -17 L${6 * k} -5 Z`} fill="#9ca3af" stroke={edge} strokeWidth={1.5} />
          <path d={`M${3 * k} -6 L${13 * k} -12 L${10 * k} -2 Z`} fill="#9ca3af" stroke={edge} strokeWidth={1.5} />
        </g>
      ))}
      {/* Big fists, swinging. */}
      {[-1, 1].map((k) => (
        <motion.g
          key={`f${k}`}
          animate={{ y: k > 0 ? [-3, 3, -3] : [3, -3, 3] }}
          transition={{ duration: 0.32, repeat: Infinity, ease: 'easeInOut' }}
        >
          <rect x={40 + k * 25 - 7} y={36} width={14} height={14} rx={3} fill={steel} stroke={edge} strokeWidth={2} />
          <rect x={40 + k * 26 - 10} y={48} width={20} height={16} rx={5} fill="#1f232c" stroke={edge} strokeWidth={2.5} />
        </motion.g>
      ))}
      {/* Helmet: a dome with a crest of spikes and the slit of eyes. */}
      <path d="M22 26 C22 6 58 6 58 26 L58 32 L22 32 Z" fill={steel} stroke={edge} strokeWidth={2.5} strokeLinejoin="round" />
      {[28, 34, 40, 46, 52].map((x, i) => (
        <path key={x} d={`M${x - 3} ${10 + Math.abs(2 - i) * 2} L${x} ${-2 + Math.abs(2 - i) * 3} L${x + 3} ${10 + Math.abs(2 - i) * 2} Z`} fill="#9ca3af" stroke={edge} strokeWidth={1.5} />
      ))}
      <rect x={27} y={20} width={26} height={6} rx={2} fill="#0b0d12" />
      <circle cx={34} cy={23} r={2.2} fill="#c084fc" style={{ filter: 'drop-shadow(0 0 3px #a855f7)' }} />
      <circle cx={46} cy={23} r={2.2} fill="#c084fc" style={{ filter: 'drop-shadow(0 0 3px #a855f7)' }} />
    </svg>
  );
}
