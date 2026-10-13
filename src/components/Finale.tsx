import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { SkipForward } from 'lucide-react';
import type { Feedback } from '../hooks/useFeedback';
import { readIntroAbout } from '../lib/intro';
import { markFinaleSeen } from '../lib/finale';

/**
 * The end of the campaign, after the last boss. It borrows Minecraft's ending: a slab reading
 * «ЭТО КОНЕЦ?», the XP pouring in with its pings and dings — and then everything cuts out at
 * once. In the silence the host from the intro walks in, takes the slab and snaps it over his
 * knee. The answer to the question, without a word; the words come after.
 *
 * Driven by timers rather than by animations finishing, as the intro is: animations stop while
 * the page is hidden, and the scene must not hang on one that never completes.
 */

type Phase = 'dark' | 'title' | 'xp' | 'silence' | 'walk' | 'reach' | 'hold' | 'smash' | 'flex' | 'talk' | 'end';

/** When each phase starts, ms from the top. */
const AT: [Phase, number][] = [
  ['title', 700],
  ['xp', 1700],
  ['silence', 7100],
  ['walk', 8700],
  ['reach', 10600],
  ['hold', 11250],
  ['smash', 12300],
  ['flex', 13000],
  ['talk', 14200],
];

/** The XP stretch, from the first orb to the cut. */
const XP_MS = 5400;
/** How long Kiryukha takes to walk in, and his step. */
const WALK_MS = 1800;
const STEP_MS = 450;

const BASE = import.meta.env.BASE_URL;
/** He walks in as the intro has him. host-full.webp is 447×1100, cropped to him top to toe. */
const HOST_WALK = `${BASE}intro/host-full.webp`;
const HOST_ASPECT = 447 / 1100;

/**
 * Then the drawn frames take over (public/finale, cut off their white by
 * scripts/cutout-white.mjs). All five share one 720×1080 canvas and one scale, with his feet on
 * the same line, so changing one for the next is a cut, not a jump.
 */
const FRAMES = {
  reach: `${BASE}finale/k-9902.png`, // arms up for it
  hold: `${BASE}finale/k-9903.png`, // the slab over his head
  smash: `${BASE}finale/k-9904.png`, // over his knee, cracked
  flex: `${BASE}finale/k-9905.png`, // flexing, the halves at his feet
  stand: `${BASE}finale/k-9906.png`, // standing easy, the halves at his feet
};
type FrameKey = keyof typeof FRAMES;
/** Within those frames, as shares of the canvas. */
const CANVAS_ASPECT = 720 / 1080;
/** How much of the canvas his body takes, crest to sole — what matches the walking picture. */
const BODY = 0.84;
/** Where his soles are, from the top. */
const SOLES = 0.949;
/** The top of his helmet in the frames he talks in. */
const HELMET = 0.1;
/** The slab in his hands in the "hold" frame: centre and width. */
const HELD = { x: 0.512, y: 0.128, w: 0.483 };
/** Where the slab cracks in the "smash" frame. */
const CRACK_AT = { x: 0.473, y: 0.376 };
/** The slab's shape, as the frames draw it. */
const SLAB_ASPECT = 2.65;

const ORDER: Phase[] = ['dark', 'title', 'xp', 'silence', 'walk', 'reach', 'hold', 'smash', 'flex', 'talk', 'end'];
const reached = (now: Phase, p: Phase) => ORDER.indexOf(now) >= ORDER.indexOf(p);

/** Which frame he's in, phase by phase; null while he's still the walking picture. */
function frameFor(phase: Phase): FrameKey | null {
  if (!reached(phase, 'reach')) return null;
  if (phase === 'reach') return 'reach';
  if (phase === 'hold') return 'hold';
  if (phase === 'smash') return 'smash';
  if (phase === 'end') return 'stand';
  return 'flex';
}

export function Finale({
  feedback,
  level,
  totalPushups,
  bosses,
  intoFight,
  onDone,
}: {
  feedback: Feedback;
  level: number;
  totalPushups: number;
  bosses: number;
  /** He walks out of it into the last fight — the words end on a challenge, not a send-off. */
  intoFight: boolean;
  onDone: () => void;
}) {
  const calm = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(calm ? 'talk' : 'dark');
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const stage = useAnimationControls();
  const host = useAnimationControls();
  const fb = useRef(feedback);
  fb.current = feedback;

  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The script.
  useEffect(() => {
    if (calm) return;
    const timers = AT.map(([p, ms]) => window.setTimeout(() => setPhase(p), ms));
    return () => timers.forEach(clearTimeout);
  }, [calm]);

  // The sounds and moves each phase starts with.
  useEffect(() => {
    const f = fb.current;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    if (phase === 'title') f.slabLand();
    if (phase === 'walk') {
      for (let t = 150; t < WALK_MS; t += STEP_MS) later(t, f.footstep);
    }
    if (phase === 'hold') {
      f.footstep();
      void host.start({ y: [0, -10, 0], transition: { duration: 0.9, ease: 'easeInOut' } });
    }
    if (phase === 'smash') {
      // The crack, and the halves hitting the floor as he lets them go (the sound has them in).
      f.slabBreak();
      void stage.start({ x: [0, -14, 12, -8, 5, 0], y: [0, 8, -6, 3, 0], transition: { duration: 0.5 } });
      void host.start({ y: [-18, 10, 0], scaleY: [1, 0.96, 1], transition: { duration: 0.45, ease: 'easeOut' } });
    }
    if (phase === 'flex') void host.start({ scale: [0.97, 1.03, 1], transition: { duration: 0.5, ease: 'easeOut' } });
    return () => timers.forEach(clearTimeout);
  }, [phase, stage, host]);

  const finish = () => {
    markFinaleSeen();
    onDone();
  };

  // The walking picture: most of the screen's height, but never wider than a good part of it.
  const hostH = Math.round(Math.min(view.h * 0.62, (view.w * 0.7) / HOST_ASPECT, 640));
  const hostW = Math.round(hostH * HOST_ASPECT);
  // The frames, sized so he's the same height in them as walking in, his feet on the floor.
  const canvasH = Math.round(hostH / BODY);
  const canvasW = Math.round(canvasH * CANVAS_ASPECT);
  const floor = view.h;
  const canvasTop = floor - canvasH * SOLES;
  const slabW = Math.round(Math.min(view.w * 0.84, 380));
  const slabH = Math.round(slabW / SLAB_ASPECT);
  const frame = frameFor(phase);

  /** Where the slab is, until the frames draw it in his hands. */
  const slab =
    phase === 'reach'
      ? {
          x: (HELD.x - 0.5) * canvasW,
          y: canvasTop + HELD.y * canvasH,
          scale: (HELD.w * canvasW) / slabW,
        }
      : { x: 0, y: view.h * 0.24, scale: 1 };

  return (
    <motion.div
      className="fixed inset-0 z-[70] overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      role="dialog"
      aria-label="Финал"
    >
      <motion.div className="absolute inset-0" animate={stage}>
        <EndSky />

        {phase === 'xp' && <XpRun view={view} level={level} feedback={feedback} />}

        {/* Kiryukha walking in from the right, as the intro has him. */}
        {phase === 'walk' && (
          <motion.div
            className="absolute bottom-0 left-1/2"
            style={{ width: hostW, height: hostH, marginLeft: -hostW / 2 }}
            initial={{ x: view.w / 2 + hostW }}
            animate={{ x: 0, y: [0, -10, 0, -10, 0, -10, 0, -10, 0] }}
            transition={{ duration: WALK_MS / 1000, ease: [0.25, 0.1, 0.35, 1], y: { duration: WALK_MS / 1000, ease: 'linear' } }}
          >
            <img
              src={HOST_WALK}
              alt="Кирюха"
              draggable={false}
              className="h-full w-full select-none object-contain"
              style={{ filter: 'drop-shadow(0 0 24px rgba(168,85,247,0.25))' }}
            />
          </motion.div>
        )}

        {/* Then the drawn frames. All of them are mounted from the start, so each is loaded and
            decoded by the time it's needed and the cut to it is instant; only one shows. */}
        <motion.div
          className="pointer-events-none absolute left-1/2"
          style={{ width: canvasW, height: canvasH, marginLeft: -canvasW / 2, top: canvasTop, transformOrigin: '50% 95%' }}
          animate={host}
        >
          {(Object.keys(FRAMES) as FrameKey[]).map((k) => (
            <img
              key={k}
              src={FRAMES[k]}
              alt={k === frame ? 'Кирюха' : ''}
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-contain"
              style={{ opacity: k === frame ? 1 : 0, filter: 'drop-shadow(0 0 24px rgba(168,85,247,0.25))' }}
            />
          ))}
        </motion.div>

        {/* The slab, until it's in his hands — from there the frames draw it. */}
        {reached(phase, 'title') && !reached(phase, 'hold') && (
          <motion.div
            className="absolute left-1/2 top-0"
            style={{ width: slabW, height: slabH, marginLeft: -slabW / 2, marginTop: -slabH / 2 }}
            initial={{ x: 0, y: -slabH, scale: 1.3, opacity: 0 }}
            animate={{ ...slab, opacity: 1 }}
            transition={phase === 'title' ? { duration: 0.35, ease: [0.5, 0, 0.75, 0] } : { duration: 0.55, ease: 'easeInOut' }}
          >
            <Slab />
          </motion.div>
        )}

        {phase === 'smash' && (
          <>
            <Chips x={(CRACK_AT.x - 0.5) * canvasW} y={canvasTop + CRACK_AT.y * canvasH} floor={floor} calm={!!calm} />
            <motion.div
              className="pointer-events-none absolute inset-0 bg-white"
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            />
          </>
        )}
      </motion.div>

      {reached(phase, 'talk') && (
        <Talk
          headY={canvasTop + HELMET * canvasH}
          intoFight={intoFight}
          bosses={bosses}
          level={level}
          totalPushups={totalPushups}
          onEnd={() => setPhase('end')}
          ended={phase === 'end'}
          onDone={finish}
        />
      )}

      {!reached(phase, 'talk') && (
        <button
          type="button"
          onClick={finish}
          className="safe-top absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/60 backdrop-blur"
        >
          Пропустить <SkipForward size={12} />
        </button>
      )}
    </motion.div>
  );
}

/* ---------------------------------- the End sky ---------------------------------- */

/** The End's sky: near-black with a faint violet haze and a scatter of dim specks. */
function EndSky() {
  const specks = useMemo(
    () => Array.from({ length: 40 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, s: 1 + Math.random() * 2, o: 0.15 + Math.random() * 0.4 })),
    [],
  );
  return (
    <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a1026 0%, #07050b 60%, #000 100%)' }}>
      {specks.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-[1px] bg-[#d8c8f0]"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------ the slab ------------------------------------ */

/** The slab with the question on it, drawn as the frames draw it: dark, rimmed, pixel letters. */
function Slab() {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center rounded-[6%/16%]"
      style={{
        background: 'linear-gradient(180deg, #3a3a3a, #2b2b2b)',
        border: '3px solid #111',
        boxShadow: 'inset 0 0 0 3px #5a5a5a, inset 0 0 0 5px #222, 0 10px 30px rgba(0,0,0,0.7)',
      }}
    >
      <span
        className="select-none whitespace-nowrap text-[#f2f2f2]"
        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(14px, 4.6vw, 22px)', textShadow: '2px 2px 0 #111' }}
      >
        Это конец?
      </span>
    </div>
  );
}

/** Bits of the slab flying off where it cracks over his knee. */
function Chips({ x, y, floor, calm }: { x: number; y: number; floor: number; calm: boolean }) {
  const chips = useMemo(
    () =>
      Array.from({ length: 16 }, () => ({
        dx: (Math.random() - 0.5) * 260,
        up: 40 + Math.random() * 120,
        s: 4 + Math.random() * 7,
        rot: (Math.random() - 0.5) * 540,
        c: Math.random() < 0.5 ? '#2b2b2b' : '#4a4a4a',
      })),
    [],
  );
  if (calm) return null;
  return (
    <>
      {chips.map((c, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-0 block"
          style={{ width: c.s, height: c.s, background: c.c, marginLeft: -c.s / 2, border: '1px solid #111' }}
          initial={{ x, y, opacity: 1 }}
          animate={{ x: x + c.dx, y: [y, y - c.up, floor + 20], rotate: c.rot, opacity: [1, 1, 0] }}
          transition={{ duration: 1, ease: 'easeIn', times: [0, 0.3, 1] }}
        />
      ))}
    </>
  );
}

/* ------------------------------------- the XP ------------------------------------- */

/**
 * The XP pouring in: orbs flying in from the edges to the bar, the bar filling and rolling over,
 * the level counting up to yours. It speeds up as it goes, the way a big pickup does.
 */
function XpRun({ view, level, feedback }: { view: { w: number; h: number }; level: number; feedback: Feedback }) {
  const target = Math.max(5, level);
  const [shown, setShown] = useState(0);
  const [fill, setFill] = useState(0);
  const fb = useRef(feedback);
  fb.current = feedback;
  const barY = view.h * 0.62;
  const barW = Math.min(view.w * 0.8, 360);

  const orbs = useMemo(
    () =>
      Array.from({ length: 70 }, () => {
        // From any edge, more and more of them as it goes.
        const edge = Math.floor(Math.random() * 4);
        const along = Math.random();
        const x = edge === 0 ? -20 : edge === 1 ? view.w + 20 : along * view.w;
        const y = edge === 2 ? -20 : edge === 3 ? view.h + 20 : along * view.h;
        return {
          x,
          y,
          s: 9 + Math.random() * 8,
          delay: Math.sqrt(Math.random()) * (XP_MS - 900) / 1000,
          dur: 0.6 + Math.random() * 0.4,
          tx: view.w / 2 + (Math.random() - 0.5) * barW * 0.8,
        };
      }),
    // Thrown once, where the screen was when it started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const start = performance.now();
    let last = 0;
    let lastPing = 0;
    const id = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / XP_MS);
      // Slow at first, rushing at the end.
      const p = Math.pow(t, 1.7) * target;
      const lvl = Math.floor(p);
      setShown(lvl);
      setFill(p - lvl);
      if (lvl > last) {
        last = lvl;
        fb.current.xpLevel();
      }
      // The pings come faster as it goes.
      const gap = 200 - 150 * t;
      if (performance.now() - lastPing > gap) {
        lastPing = performance.now();
        fb.current.orb();
      }
    }, 40);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {orbs.map((o, i) => (
        <motion.span
          key={i}
          className="absolute left-0 top-0 block rounded-full"
          style={{
            width: o.s,
            height: o.s,
            marginLeft: -o.s / 2,
            marginTop: -o.s / 2,
            background: 'radial-gradient(circle at 40% 35%, #fefce8, #d9f99d 30%, #84cc16 65%, #3f6212)',
            boxShadow: '0 0 10px #a3e635',
          }}
          initial={{ x: o.x, y: o.y, opacity: 0, scale: 1 }}
          animate={{ x: [o.x, (o.x + o.tx) / 2, o.tx], y: [o.y, (o.y + barY) / 2 - 60, barY], opacity: [0, 1, 1, 0], scale: [1, 1.15, 0.4] }}
          transition={{ duration: o.dur, delay: o.delay, ease: 'easeIn' }}
        />
      ))}

      <div className="absolute left-1/2" style={{ top: barY, width: barW, marginLeft: -barW / 2 }}>
        <div
          className="mb-1 text-center font-['Russo_One'] text-3xl text-[#80ff20]"
          style={{ textShadow: '2px 2px 0 #1a3d00, -2px -2px 0 #1a3d00, 2px -2px 0 #1a3d00, -2px 2px 0 #1a3d00' }}
        >
          {shown}
        </div>
        <div className="relative h-3 w-full border-2 border-black bg-[#1d1d1d]">
          <div className="h-full bg-[#7ed321]" style={{ width: `${fill * 100}%`, boxShadow: 'inset 0 -3px 0 #4a8a10' }} />
          {/* The notches the game's bar has. */}
          <div
            className="absolute inset-0"
            style={{ background: 'repeating-linear-gradient(90deg, transparent 0 calc(100%/18 - 2px), #000 calc(100%/18 - 2px) calc(100%/18))' }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------ the words ------------------------------------ */

function Talk({
  headY,
  intoFight,
  bosses,
  level,
  totalPushups,
  ended,
  onEnd,
  onDone,
}: {
  /** Where the top of Kiryukha's helmet is, so the bubble sits just over it. */
  headY: number;
  intoFight: boolean;
  bosses: number;
  level: number;
  totalPushups: number;
  ended: boolean;
  onEnd: () => void;
  onDone: () => void;
}) {
  const nick = readIntroAbout()?.nickname?.trim();
  const lines = useMemo(
    () => [
      'Конец? Ха.',
      'Конец — это когда перестаёшь отжиматься.',
      intoFight
        ? `${nick ? `${nick}, ты` : 'Ты'} прошёл их всех. Остался я.`
        : nick
          ? `${nick}, вставай. Завтра — новый подход.`
          : 'Вставай. Завтра — новый подход.',
    ],
    [nick, intoFight],
  );
  const full = lines.join('\n');
  const [n, setN] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (n >= full.length) {
      const t = window.setTimeout(() => endRef.current(), 500);
      return () => clearTimeout(t);
    }
    // A beat at the end of each line.
    const pause = full[n - 1] === '\n' ? 500 : full[n - 1] === '.' || full[n - 1] === '?' ? 220 : 38;
    const t = window.setTimeout(() => setN((k) => k + 1), pause);
    return () => clearTimeout(t);
  }, [n, full]);

  return (
    <>
      <div className="absolute inset-x-0 flex justify-center px-4" style={{ bottom: `calc(100% - ${Math.max(150, headY - 6)}px)` }}>
        <motion.button
          type="button"
          // A tap shows the rest of the line at once.
          onClick={() => setN(full.length)}
          className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#141018]/90 px-4 py-3 text-left shadow-2xl backdrop-blur"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-arena-amber">Кирюха</div>
          <p className="min-h-[4.5em] whitespace-pre-line text-[15px] leading-snug text-white">{full.slice(0, n)}</p>
          <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-[#141018]" />
        </motion.button>
      </div>

      {ended && (
        <motion.div
          className="safe-bottom absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-sm flex-col items-center gap-3 px-4 pb-6 pt-16"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 55%, transparent)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="grid w-full grid-cols-3 gap-2 text-center">
            <Stat value={bosses} label="боссов" />
            <Stat value={totalPushups} label="отжиманий" />
            <Stat value={level} label="уровень" />
          </div>
          <button
            type="button"
            onClick={onDone}
            className="w-full rounded-xl bg-arena-amber py-3 text-sm font-bold text-black active:scale-[0.98]"
          >
            {intoFight ? 'В бой' : 'Дальше'}
          </button>
        </motion.div>
      )}
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/50 px-2 py-2 backdrop-blur">
      <div className="font-['Russo_One'] text-lg text-white">{value.toLocaleString('ru-RU')}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/50">{label}</div>
    </div>
  );
}
