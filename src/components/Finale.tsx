import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { SkipForward } from 'lucide-react';
import type { Feedback } from '../hooks/useFeedback';
import { readIntroAbout } from '../lib/intro';
import { markFinaleSeen } from '../lib/finale';
import { preloadKiryukhaTalk } from '../lib/feedback';
import { BOSSES } from '../data/bosses';
import { bossArtUrl } from '../lib/bossArt';

/**
 * The end of the campaign, after the last boss. It borrows Minecraft's ending: a slab reading
 * «ЭТО КОНЕЦ?», the XP pouring in with its pings and dings — and then everything cuts out at
 * once. In the silence the host from the intro walks in, takes the slab and snaps it over his
 * knee. The answer to the question, without a word; the words come after.
 *
 * Driven by timers rather than by animations finishing, as the intro is: animations stop while
 * the page is hidden, and the scene must not hang on one that never completes.
 */

type Phase = 'dark' | 'title' | 'xp' | 'silence' | 'walk' | 'hold' | 'smash' | 'flex' | 'talk' | 'end';

/** The XP stretch, from the first orb to the cut. */
const XP_MS = 7900;
/** Within it: the ring fills for this long, holds at 50 for a second, then bursts. */
const XP_FILL_MS = 5100;
const XP_HOLD_MS = 1000;
/** The level the ring counts up to, filling once all the way round on the way. */
const XP_TOP = 50;
/** When each phase starts, ms from the top. */
const AT: [Phase, number][] = [
  ['title', 700],
  ['xp', 1700],
  // The cut comes the moment the XP stretch ends: the ring has burst by then.
  ['silence', 1700 + XP_MS],
  ['walk', 11200],
  // No reaching for it: once he's there, the slab melts out of the air into his hands.
  ['hold', 13100],
  ['smash', 14200],
  ['flex', 15000],
  ['talk', 16200],
];

/**
 * Where each of his lines falls in the voice recordings: start and length, in seconds — read off
 * the gaps between the phrases. The last one runs on to the end. One for the way into his fight
 * (sfx/kiryukha-talk.m4a), one for a rerun (sfx/kiryukha-talk-2.m4a).
 */
const VOICE_LINES: [number, number][] = [
  [0.1, 0.7],
  [1.4, 1.9],
  [3.9, 2.2],
  [6.6, 3.6],
];
const VOICE_LINES_RERUN: [number, number][] = [
  [0.1, 0.7],
  [1.4, 2.2],
  // «Конца не будет. Будет только следующий подход.» is two phrases in the recording.
  [4.3, 3.45],
  [8.35, 1.1],
];

/** How long Kiryukha takes to walk in, and his step. */
const WALK_MS = 1800;
const STEP_MS = 450;

const BASE = import.meta.env.BASE_URL;
/** He walks in as the intro has him. host-full.webp is 447×1100, cropped to him top to toe. */
const HOST_WALK = `${BASE}intro/host-full.webp`;
const HOST_ASPECT = 447 / 1100;

/**
 * Then the drawn frames take over (public/finale, cut off their white by
 * scripts/cutout-white.mjs). They share one 720×1080 canvas and one scale, with his feet on
 * the same line, so changing one for the next is a cut, not a jump.
 */
const FRAMES = {
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
/** The slab itself, the same picture the frames draw in his hands (945×373, cut off its white). */
const SLAB = `${BASE}finale/plaque.png`;
const SLAB_ASPECT = 945 / 373;
/**
 * How long one picture of him takes to dissolve into the next (s). Soft everywhere but the blow
 * over his knee, where a cut is what sells it — the flash covers the join.
 */
const FADE_S: Partial<Record<Phase, number>> = { hold: 0.7, smash: 0.08, flex: 0.35, end: 0.6 };
/** How long the slab takes to appear (s): out of the dark, growing, settling with a little give. */
const SLAB_IN_S = 1.1;

const ORDER: Phase[] = ['dark', 'title', 'xp', 'silence', 'walk', 'hold', 'smash', 'flex', 'talk', 'end'];
const reached = (now: Phase, p: Phase) => ORDER.indexOf(now) >= ORDER.indexOf(p);

/** Which frame he's in, phase by phase; null while he's still the walking picture. */
function frameFor(phase: Phase): FrameKey | null {
  if (!reached(phase, 'hold')) return null;
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

  // His voice, fetched now, well before he speaks.
  useEffect(() => preloadKiryukhaTalk(intoFight), [intoFight]);

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
    // The slab settles a moment after it starts to appear — that's when it "lands".
    if (phase === 'title') later(SLAB_IN_S * 1000 * 0.8, f.slabLand);
    if (phase === 'walk') {
      for (let t = 150; t < WALK_MS; t += STEP_MS) later(t, f.footstep);
    }
    // The catch: a thud, and nothing moves — the slab is exactly where it flew to. (He used to
    // bob up as he took it, which read as the slab going down to him and then back up.)
    if (phase === 'hold') f.footstep();
    if (phase === 'smash') {
      // The crack, and the halves hitting the floor as he lets them go (the sound has them in).
      f.slabBreak();
      void stage.start({ x: [0, -14, 12, -8, 5, 0], y: [0, 8, -6, 3, 0], transition: { duration: 0.5 } });
      void host.start({ y: [-18, 10, 0], scaleY: [1, 0.96, 1], transition: { duration: 0.45, ease: 'easeOut' } });
    }
    if (phase === 'flex') void host.start({ scale: [0.97, 1.03, 1], transition: { duration: 0.5, ease: 'easeOut' } });
    return () => timers.forEach(clearTimeout);
  }, [phase, stage, host]);

  // Seen once he's broken the slab and starts to talk — not only when "В бой" is pressed. Leave
  // the app at that point (on a phone, coming back often reloads the page) and it would start
  // all over again every time the arena opened, before he'd even been fought once. Only the
  // real one counts: a rerun from the dev panel or the end screen must not use it up, or the
  // player who watched it early never gets it when Ultron actually falls.
  useEffect(() => {
    if (intoFight && reached(phase, 'talk')) markFinaleSeen();
  }, [intoFight, phase]);

  const finish = () => {
    if (intoFight) markFinaleSeen();
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

  const fade = FADE_S[phase] ?? 0.35;
  /**
   * Where the slab is. It hangs in the air until he's there; then, as he fades in holding it, it
   * melts into the one in his hands — drifting to the same spot and size while it fades, so the
   * two meet instead of one blinking out and the other blinking in somewhere else.
   */
  const slab =
    phase === 'hold'
      ? { x: (HELD.x - 0.5) * canvasW, y: canvasTop + HELD.y * canvasH, scale: (HELD.w * canvasW) / slabW }
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

        {phase === 'xp' && <XpRun view={view} feedback={feedback} />}

        {/* Kiryukha walking in from the right, as the intro has him — and dissolving into the
            first drawn frame as he gets there. */}
        {(phase === 'walk' || phase === 'hold') && (
          <motion.div
            className="absolute bottom-0 left-1/2"
            style={{ width: hostW, height: hostH, marginLeft: -hostW / 2 }}
            initial={{ x: view.w / 2 + hostW, opacity: 1 }}
            animate={{ x: 0, y: [0, -10, 0, -10, 0, -10, 0, -10, 0], opacity: phase === 'walk' ? 1 : 0 }}
            transition={{
              duration: WALK_MS / 1000,
              ease: [0.25, 0.1, 0.35, 1],
              y: { duration: WALK_MS / 1000, ease: 'linear' },
              opacity: { duration: fade, ease: 'easeInOut' },
            }}
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
            decoded by the time it's needed; one dissolves into the next. */}
        <motion.div
          className="pointer-events-none absolute left-1/2"
          style={{ width: canvasW, height: canvasH, marginLeft: -canvasW / 2, top: canvasTop, transformOrigin: '50% 95%' }}
          animate={host}
        >
          {(Object.keys(FRAMES) as FrameKey[]).map((k) => (
            <motion.img
              key={k}
              src={FRAMES[k]}
              alt={k === frame ? 'Кирюха' : ''}
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-contain"
              style={{ filter: 'drop-shadow(0 0 24px rgba(168,85,247,0.25))' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: k === frame ? 1 : 0 }}
              transition={{ duration: fade, ease: 'easeInOut' }}
            />
          ))}
        </motion.div>

        {/* The slab, until it's in his hands — there it dissolves into the one the frame draws. */}
        {reached(phase, 'title') && !reached(phase, 'smash') && (
          <motion.div
            className="absolute left-1/2 top-0"
            style={{ width: slabW, height: slabH, marginLeft: -slabW / 2, marginTop: -slabH / 2 }}
            // Out of the dark: a little above where it'll hang, small and blurred, and easing into
            // place — no slam.
            initial={{ x: 0, y: view.h * 0.24 - 40, scale: 0.7, opacity: 0, filter: 'blur(8px)' }}
            animate={{ ...slab, opacity: phase === 'hold' ? 0 : 1, filter: 'blur(0px)' }}
            transition={
              phase === 'title'
                ? { duration: SLAB_IN_S, ease: [0.16, 1, 0.3, 1], opacity: { duration: SLAB_IN_S * 0.6 } }
                : // Drifting into his hands and fading out the whole way, so it's never seen to
                  // arrive — the frame's own slab takes over as this one goes.
                  { duration: fade, ease: [0.45, 0, 0.25, 1], opacity: { duration: fade, ease: [0.5, 0, 0.75, 1] } }
            }
          >
            {/* While it waits it hangs in the air, breathing a little. */}
            <motion.div
              className="h-full w-full"
              animate={calm ? { y: 0, rotate: 0 } : { y: [0, -5, 0], rotate: [-0.6, 0.6, -0.6] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img src={SLAB} alt="Это конец?" draggable={false} className="h-full w-full select-none" />
              {/* A glow behind it as it appears, fading once it's settled. */}
              <motion.div
                className="absolute -inset-6 -z-10 rounded-[30%]"
                style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.55), transparent 70%)' }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: [0, 1, 0.35], scale: [0.6, 1.15, 1] }}
                transition={{ duration: SLAB_IN_S * 1.4 }}
              />
            </motion.div>
          </motion.div>
        )}

        {/* The swap, under a soft violet glow that swells and fades. */}
        {phase === 'hold' && !calm && (
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 35%, rgba(233,213,255,0.45), rgba(168,85,247,0.18) 50%, transparent 75%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, times: [0, 0.35, 1], ease: 'easeInOut' }}
          />
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
          feedback={feedback}
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
 * The XP pouring in — into a ring, not a bar. Orbs stream in from every edge, curling in as they
 * come, and land on the ring at points all the way round; the ring fills clockwise in one slow
 * sweep while the level in the middle counts up to 50, a bright spark riding the end of the arc.
 * Each level gives the number a jump and a little ripple; when the ring closes on 50 it flashes,
 * throws out a shockwave and a spray of sparks. Sparks circle it the whole time, faster and faster.
 */
function XpRun({ view, feedback }: { view: { w: number; h: number }; feedback: Feedback }) {
  const calm = useReducedMotion();
  const target = XP_TOP;
  const [shown, setShown] = useState(0);
  const [fill, setFill] = useState(0);
  const [pace, setPace] = useState(0);
  const [burst, setBurst] = useState(false);
  const fb = useRef(feedback);
  fb.current = feedback;
  const cx = view.w / 2;
  const cy = view.h * 0.6;
  const R = Math.min(view.w * 0.26, 110);
  const STROKE = 12;
  const C = 2 * Math.PI * R;

  const orbs = useMemo(
    () =>
      Array.from({ length: 90 }, () => {
        const edge = Math.floor(Math.random() * 4);
        const along = Math.random();
        const x = edge === 0 ? -20 : edge === 1 ? view.w + 20 : along * view.w;
        const y = edge === 2 ? -20 : edge === 3 ? view.h + 20 : along * view.h;
        // Where on the ring it lands, and a point beside its straight path to curl it in.
        const a = Math.random() * Math.PI * 2;
        const tx = cx + Math.cos(a) * R;
        const ty = cy + Math.sin(a) * R;
        const curl = (Math.random() < 0.5 ? -1 : 1) * 0.35;
        const mx = (x + tx) / 2 - (ty - y) * curl;
        const my = (y + ty) / 2 + (tx - x) * curl;
        return {
          x,
          y,
          mx,
          my,
          tx,
          ty,
          s: 8 + Math.random() * 8,
          delay: Math.sqrt(Math.random()) * (XP_FILL_MS - 900) / 1000,
          dur: 0.7 + Math.random() * 0.4,
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
      const t = Math.min(1, (performance.now() - start) / XP_FILL_MS);
      // One slow sweep round the ring, picking up a little pace as it goes.
      const p = Math.pow(t, 1.3) * target;
      const lvl = Math.floor(p);
      setShown(lvl);
      setFill(p / target);
      setPace(t);
      if (lvl > last) {
        last = lvl;
        fb.current.xpLevel();
      }
      // The pings come faster as it goes, and stop once it's full.
      const gap = 200 - 150 * t;
      if (t < 1 && performance.now() - lastPing > gap) {
        lastPing = performance.now();
        fb.current.orb();
      }
    }, 40);
    // A second at 50, and then it bursts: a rush of pings as it goes.
    const burstAt = window.setTimeout(() => {
      setBurst(true);
      for (let i = 0; i < 6; i += 1) window.setTimeout(() => fb.current.orb(), i * 45);
    }, XP_FILL_MS + XP_HOLD_MS);
    return () => {
      clearInterval(id);
      clearTimeout(burstAt);
    };
  }, [target]);

  /** The orbs it bursts into, flying off from round the ring to the four corners. */
  const outward = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => {
        const a = (i / 56) * Math.PI * 2;
        // The corner on its side of the ring.
        const corner = [Math.cos(a) > 0 ? view.w : 0, Math.sin(a) > 0 ? view.h : 0];
        const fx = cx + Math.cos(a) * R;
        const fy = cy + Math.sin(a) * R;
        const tx = corner[0] + (Math.random() - 0.5) * view.w * 0.3;
        const ty = corner[1] + (Math.random() - 0.5) * view.h * 0.2;
        // A gentle curve out, not a straight shot.
        const bend = (Math.random() < 0.5 ? -1 : 1) * 0.18;
        return {
          fx,
          fy,
          tx,
          ty,
          mx: (fx + tx) / 2 - (ty - fy) * bend,
          my: (fy + ty) / 2 + (tx - fx) * bend,
          s: 8 + Math.random() * 8,
          delay: Math.random() * 0.25,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const glow = 0.5 + pace * 0.5;
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
          animate={{ x: [o.x, o.mx, o.tx], y: [o.y, o.my, o.ty], opacity: [0, 1, 1, 0], scale: [1, 1.2, 0.3] }}
          transition={{ duration: o.dur, delay: o.delay, ease: 'easeIn' }}
        />
      ))}

      {/* The ring: a breath bigger as it bursts, and gone. */}
      <motion.div
        className="absolute"
        style={{ left: cx, top: cy }}
        animate={burst ? { scale: [1, 1.18, 0.2], opacity: [1, 1, 0] } : { scale: 1, opacity: 1 }}
        transition={burst ? { duration: 0.55, times: [0, 0.35, 1], ease: [0.4, 0, 0.6, 1] } : { duration: 0 }}
      >
        {/* The glow under it, brighter as it rushes. */}
        <div
          className="absolute rounded-full"
          style={{ width: R * 3, height: R * 3, left: -R * 1.5, top: -R * 1.5, background: `radial-gradient(circle, rgba(132,204,22,${0.28 * glow}), transparent 65%)` }}
        />

        {/* The ring itself, filling clockwise from the top. */}
        <svg width={R * 2 + STROKE * 2} height={R * 2 + STROKE * 2} className="absolute" style={{ left: -R - STROKE, top: -R - STROKE, overflow: 'visible' }}>
          <g transform={`translate(${R + STROKE} ${R + STROKE}) rotate(-90)`}>
            <circle r={R} fill="none" stroke="#0b1a02" strokeWidth={STROKE + 6} />
            <circle r={R} fill="none" stroke="#1d3a08" strokeWidth={STROKE} />
            <circle
              r={R}
              fill="none"
              stroke="#84cc16"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - fill)}
              style={{ filter: `drop-shadow(0 0 ${6 + glow * 8}px #a3e635)` }}
            />
            {/* The notches. */}
            <circle r={R} fill="none" stroke="#000" strokeWidth={STROKE + 2} strokeDasharray={`2 ${C / 18 - 2}`} opacity={0.6} />
          </g>
        </svg>

        {/* A dashed outer ring turning, and sparks circling — both faster as it goes. */}
        {!calm && (
          <>
            <motion.div
              className="absolute rounded-full border-2 border-dashed border-lime-300/40"
              style={{ width: R * 2 + 44, height: R * 2 + 44, left: -R - 22, top: -R - 22 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute"
              style={{ width: 0, height: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2.4 - pace * 1.6, repeat: Infinity, ease: 'linear' }}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className="absolute block h-1.5 w-1.5 rounded-full bg-lime-200"
                  style={{
                    transform: `rotate(${i * 36}deg) translateX(${R + 16}px)`,
                    boxShadow: '0 0 6px #bef264',
                    opacity: 0.4 + (i % 3) * 0.3,
                  }}
                />
              ))}
            </motion.div>
          </>
        )}

        {/* The bright spark riding the end of the arc. */}
        {fill > 0 && (
          <span
            className="absolute block rounded-full"
            style={{
              width: 16,
              height: 16,
              left: Math.sin(fill * Math.PI * 2) * R - 8,
              top: -Math.cos(fill * Math.PI * 2) * R - 8,
              background: 'radial-gradient(circle, #ffffff, #ecfccb 40%, rgba(163,230,53,0) 75%)',
              boxShadow: '0 0 14px #d9f99d',
            }}
          />
        )}

        {/* Each level: a faint ripple off the ring. */}
        {shown > 0 && shown < XP_TOP && !calm && (
          <motion.div
            key={`r${shown}`}
            className="absolute rounded-full border-2 border-lime-200/60"
            style={{ width: R * 2, height: R * 2, left: -R, top: -R }}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}

        {/* The ring closing on 50: a flash, a shockwave, sparks. */}
        {shown >= XP_TOP && !calm && (
          <div className="absolute">
            <motion.div
              className="absolute rounded-full"
              style={{ width: R * 2, height: R * 2, left: -R, top: -R, border: '6px solid #d9f99d', boxShadow: '0 0 24px #a3e635' }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ width: R * 2.4, height: R * 2.4, left: -R * 1.2, top: -R * 1.2, background: 'radial-gradient(circle, rgba(236,252,203,0.9), transparent 65%)' }}
              initial={{ opacity: 1, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.3 }}
              transition={{ duration: 0.7 }}
            />
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  className="absolute block h-2 w-2 rounded-full bg-lime-200"
                  style={{ left: -4, top: -4, boxShadow: '0 0 8px #a3e635' }}
                  initial={{ x: Math.cos(a) * R, y: Math.sin(a) * R, opacity: 1 }}
                  animate={{ x: Math.cos(a) * (R + 110), y: Math.sin(a) * (R + 110), opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              );
            })}
          </div>
        )}

        {/* The level, in the middle, jumping up each time. */}
        <motion.div
          key={`n${shown}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 font-['Russo_One'] text-5xl text-[#80ff20]"
          style={{ textShadow: '3px 3px 0 #1a3d00, -3px -3px 0 #1a3d00, 3px -3px 0 #1a3d00, -3px 3px 0 #1a3d00, 0 0 18px #84cc16' }}
          initial={calm ? false : { scale: 1.7 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 14 }}
        >
          {shown}
        </motion.div>
      </motion.div>

      {/* What it bursts into: orbs flying off from round the ring to the corners. */}
      {burst &&
        !calm &&
        outward.map((o, i) => (
          <motion.span
            key={`o${i}`}
            className="absolute left-0 top-0 block rounded-full"
            style={{
              width: o.s,
              height: o.s,
              marginLeft: -o.s / 2,
              marginTop: -o.s / 2,
              background: 'radial-gradient(circle at 40% 35%, #fefce8, #d9f99d 30%, #84cc16 65%, #3f6212)',
              boxShadow: '0 0 10px #a3e635',
            }}
            initial={{ x: o.fx, y: o.fy, opacity: 0, scale: 0.6 }}
            animate={{ x: [o.fx, o.mx, o.tx], y: [o.fy, o.my, o.ty], opacity: [0, 1, 0.9, 0], scale: [0.6, 1.15, 0.7] }}
            // Out from the ring slowing as they go, and fading the whole second of it — drifting
            // off into the corners rather than being flung there.
            transition={{
              duration: 1.25,
              delay: 0.15 + o.delay,
              ease: [0.2, 0.7, 0.3, 1],
              opacity: { duration: 1.25, delay: 0.15 + o.delay, times: [0, 0.12, 0.55, 1], ease: 'easeInOut' },
            }}
          />
        ))}
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
  feedback,
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
  feedback: Feedback;
}) {
  const nick = readIntroAbout()?.nickname?.trim();
  const lines = useMemo(
    () => [
      'Конец?',
      'Здесь я решаю, где конец.',
      ...(intoFight
        ? [
            // Every boss before him, by count, so it stays true if the roster changes.
            `${nick ? `${nick}, все` : 'Все'} ${bosses} были разминкой.`,
            'Теперь ты отжимаешься передо мной. Пока не упадёшь.',
          ]
        : ['Конца не будет. Будет только следующий подход.', `${nick ? `${nick}, я` : 'Я'} буду смотреть.`]),
    ],
    [nick, intoFight, bosses],
  );
  const full = lines.join('\n');
  /** When each line is typed out, in step with his voice: start and length, in seconds. */
  const timing = intoFight ? VOICE_LINES : VOICE_LINES_RERUN;
  const [n, setN] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const fb = useRef(feedback);
  fb.current = feedback;

  // His voice, and the words typed in step with it off one clock.
  useEffect(() => {
    const stop = fb.current.kiryukhaTalk(intoFight);
    const start = performance.now();
    const last = timing[timing.length - 1];
    const id = window.setInterval(() => {
      const t = (performance.now() - start) / 1000;
      let shown = 0;
      lines.forEach((line, i) => {
        const [at, dur] = timing[i];
        const k = Math.round(Math.max(0, Math.min(1, (t - at) / dur)) * line.length);
        shown += k + (i > 0 && t >= at ? 1 : 0);
      });
      setN((cur) => Math.max(cur, shown));
      if (t > last[0] + last[1] + 0.5) {
        window.clearInterval(id);
        endRef.current();
      }
    }, 30);
    return () => {
      window.clearInterval(id);
      stop();
    };
  }, [lines, timing, intoFight]);

  return (
    <>
      {/* Over his head: his words, and once he's done, the tally and the way on in their place —
          up here, because the broken slab lies in the bottom corners and must stay in view. */}
      <div className="absolute inset-x-0 flex justify-center px-4" style={{ bottom: `calc(100% - ${Math.max(150, headY - 6)}px)` }}>
        <motion.button
          type="button"
          // A tap shows the rest of the line at once.
          onClick={() => setN(full.length)}
          className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#141018]/90 px-4 py-3 text-left shadow-2xl backdrop-blur"
          style={{ pointerEvents: ended ? 'none' : undefined }}
          initial={{ opacity: 0, y: -8 }}
          animate={ended ? { opacity: 0, y: -6, scale: 0.97 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-arena-amber">Кирюха</div>
          <p className="min-h-[4.5em] whitespace-pre-line text-[15px] leading-snug text-white">{full.slice(0, n)}</p>
          <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-[#141018]" />
        </motion.button>
      </div>

      {ended && (
        // Over his head where there's room; on a short screen it comes down over him rather than
        // off the top (roughly how tall the card is, plus a margin).
        <div className="absolute inset-x-0 flex justify-center px-4" style={{ bottom: `calc(100% - ${Math.max(296, headY - 6)}px)` }}>
          <motion.div
            className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#141018]/90 p-3 shadow-2xl backdrop-blur"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {/* His portrait over the tally: who's waiting — the same picture the fight uses. */}
            <div className="relative h-28 w-full overflow-hidden rounded-xl">
              <motion.img
                src={bossArtUrl(BOSSES[BOSSES.length - 1].icon, true)}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-cover"
                style={{ objectPosition: '50% 22%' }}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(20,16,24,0.95), rgba(20,16,24,0.15) 60%, transparent)' }}
              />
              <div className="absolute inset-x-3 bottom-2 text-left">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-arena-amber">
                  {intoFight ? 'Последний бой' : 'Хозяин арены'}
                </div>
                <div className="font-['Russo_One'] text-xl leading-tight text-white" style={{ textShadow: '0 2px 6px #000' }}>
                  {BOSSES[BOSSES.length - 1].name}
                </div>
              </div>
            </div>
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
        </div>
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
