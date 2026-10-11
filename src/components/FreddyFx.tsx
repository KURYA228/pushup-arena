import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Freddy's night shift, on the fight screen:
 *
 *  - {@link CameraFeed}: while his scream holds you, the screen is a security camera — static,
 *    scan lines, REC, CAM 1A, a running clock — and the count you have to reach, big.
 *  - {@link LightsFlicker}: as he nears half health the lights start to go and eyes shine out of
 *    the dark: the scream is coming.
 *  - {@link EnrageEyes}: below 40%, his eyes burn red.
 */

const SCANLINES =
  'repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 3px)';

export function CameraFeed({ active, reps, need }: { active: boolean; reps: number; need: number }) {
  const calm = useReducedMotion();
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      setSince(null);
      return;
    }
    setSince(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);
  const secs = since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
  const clock = `00:${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  return createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          key="camera"
          aria-hidden
          className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          // After the jump-scare has had the screen.
          transition={{ duration: 0.3, delay: 1.4 }}
        >
          {/* The feed's cast: a cold green-grey over everything, darker at the edges. */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(120,160,130,0.08), rgba(10,20,15,0.55) 85%)', mixBlendMode: 'multiply' }} />
          <div className="absolute inset-0" style={{ background: 'rgba(90,140,110,0.12)', mixBlendMode: 'screen' }} />
          {/* Scan lines, rolling. */}
          {!calm && (
            <motion.div
              className="absolute inset-0"
              style={{ backgroundImage: SCANLINES }}
              animate={{ backgroundPositionY: ['0px', '12px'] }}
              transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}
            />
          )}
          {/* Static: noise that flickers. */}
          {!calm && (
            <motion.div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-radial-gradient(circle at 17% 32%, rgba(255,255,255,0.09) 0 1px, transparent 1px 4px), repeating-radial-gradient(circle at 73% 61%, rgba(255,255,255,0.07) 0 1px, transparent 1px 5px)',
              }}
              animate={{ opacity: [0.3, 0.8, 0.4, 0.9, 0.3], x: [0, -3, 2, -1, 0] }}
              transition={{ duration: 0.35, repeat: Infinity }}
            />
          )}
          {/* A band of interference that rolls down the picture now and then. */}
          {!calm && (
            <motion.div
              className="absolute inset-x-0 h-16"
              style={{ background: 'linear-gradient(transparent, rgba(255,255,255,0.12), transparent)' }}
              animate={{ top: ['-10%', '110%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }}
            />
          )}
          {/* Corner brackets of the camera frame. */}
          {(['left-3 top-3 border-l-2 border-t-2', 'right-3 top-3 border-r-2 border-t-2', 'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'] as const).map((c) => (
            <div key={c} className={`absolute h-8 w-8 border-white/70 ${c}`} />
          ))}
          <div className="absolute left-6 top-6 flex items-center gap-1.5 font-mono text-sm font-bold text-white/90">
            <motion.span
              className="inline-block h-3 w-3 rounded-full bg-red-600"
              animate={{ opacity: [1, 0.15, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            REC
          </div>
          <div className="absolute right-6 top-6 font-mono text-sm font-bold text-white/90">CAM 1A</div>
          <div className="absolute bottom-6 left-6 font-mono text-sm text-white/80">{clock}</div>
          {/* What you have to do, big: the reps without a pause. */}
          <div className="absolute inset-x-0 top-[13%] flex flex-col items-center gap-2">
            <span
              className="rounded-md bg-black/60 px-3 py-1 font-mono text-2xl font-bold tracking-wider text-white"
              style={{ textShadow: '0 0 8px rgba(255,255,255,0.6)' }}
            >
              БЕЗ ПАУЗЫ: {reps}/{need}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: need }, (_, i) => (
                <span
                  key={i}
                  className="h-2.5 w-4 rounded-sm border border-white/60"
                  style={{ background: i < reps ? '#4ade80' : 'rgba(0,0,0,0.5)', boxShadow: i < reps ? '0 0 6px #22c55e' : undefined }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * The lights going, as he gets close to half health: the room drops into darkness for a
 * moment at a time, and in the dark a pair of eyes shines out from somewhere on the screen.
 */
export function LightsFlicker({ active }: { active: boolean }) {
  const calm = useReducedMotion();
  // Each blink gets a new place for the eyes to shine from.
  const [blink, setBlink] = useState<{ n: number; x: number; y: number }>({ n: 0, x: 50, y: 40 });
  useEffect(() => {
    if (!active || calm) return;
    let id = 0;
    const next = () => {
      id = window.setTimeout(() => {
        setBlink((b) => ({ n: b.n + 1, x: 10 + Math.random() * 80, y: 15 + Math.random() * 55 }));
        next();
      }, 1400 + Math.random() * 2200);
    };
    next();
    return () => window.clearTimeout(id);
  }, [active, calm]);
  const eyes = blink;
  if (!active || calm || blink.n === 0) return null;
  return createPortal(
    <motion.div
      key={blink.n}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.92, 0.3, 0.95, 0.95, 0] }}
      transition={{ duration: 0.9, times: [0, 0.1, 0.2, 0.3, 0.8, 1] }}
    >
      <motion.div
        className="absolute flex gap-3"
        style={{ left: `${eyes.x}%`, top: `${eyes.y}%` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: 0.9, times: [0, 0.3, 0.38, 0.75, 0.85] }}
      >
        {[0, 1].map((i) => (
          <span key={i} className="block h-3 w-4 rounded-full bg-white" style={{ boxShadow: '0 0 10px #fff, 0 0 22px #fde68a' }} />
        ))}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/**
 * Below 40% the boss is enraged: a red glow pulsing round him, and — for Freddy, whose eyes we
 * know the place of — his eyes burning red. Laid over the picture, inside its box.
 */
const FREDDY_EYES: [number, number][] = [
  [47.3, 28],
  [54.1, 28],
];

export function EnrageEyes({ active, eyes }: { active: boolean; eyes: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-[6%] rounded-[30%]"
            animate={{ boxShadow: ['0 0 30px 6px rgba(220,38,38,0.35)', '0 0 50px 14px rgba(220,38,38,0.6)', '0 0 30px 6px rgba(220,38,38,0.35)'] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          {eyes &&
            FREDDY_EYES.map(([x, y], i) => (
              <motion.span
                key={i}
                className="absolute block rounded-full"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: 12,
                  height: 9,
                  marginLeft: -6,
                  marginTop: -4,
                  background: 'radial-gradient(circle, #fff 0%, #fca5a5 30%, #dc2626 70%)',
                  boxShadow: '0 0 10px #ef4444, 0 0 22px #dc2626',
                }}
                animate={{ opacity: [0.75, 1, 0.75], scale: [1, 1.15, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
