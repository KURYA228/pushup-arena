import clsx from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * The legionary: filmed, not drawn, and cut out of his background — just him. One push-up taken
 * from a longer clip (the cut points are where his pose matches, so the loop doesn't jump), each
 * frame masked by the system's subject cut-out and laid side by side in one transparent strip;
 * plus a photo of him asleep, cut out the same way. The sources are in `art/legionary/`.
 *
 * A strip of frames rather than a video: browsers can't agree on a video format that keeps a
 * transparent background, and a picture with transparency works everywhere.
 *
 * Three ways to run him:
 *  - `loop` (default): push-ups on his own, for the "how to play" sheet;
 *  - `follow`: pushes along while the camera sees you, and cheers each counted rep;
 *  - `sleep`: lying on his back, while there's nobody to copy.
 */

export type GuyMode = 'loop' | 'follow' | 'sleep';

const STRIP = `${import.meta.env.BASE_URL}legionary/pushup.webp`;
const SLEEP_PHOTO = `${import.meta.env.BASE_URL}legionary/sleep.webp`;
/** Frames in the strip, and how long the whole push-up takes. */
const FRAMES = 48;
const CYCLE_S = 3.2;

export function PushupGuy({
  className,
  mode = 'loop',
  repKey = 0,
  quip,
}: {
  className?: string;
  mode?: GuyMode;
  /** Changes on every counted rep: "+1" and the quip float up. */
  repKey?: number;
  /** A one-liner to say on this rep. */
  quip?: string;
}) {
  const calm = useReducedMotion();
  const sleeping = mode === 'sleep';

  return (
    <div aria-hidden className={clsx('relative', className)}>
      {/* A soft glow on the ground, so he stands on something rather than floating. */}
      <div className="absolute inset-x-[8%] bottom-0 h-[14%] rounded-[50%] bg-arena-amber/25 blur-md" />

      <div
        className={clsx(
          'absolute bottom-[4%] left-1/2 h-[96%] -translate-x-1/2 transition-opacity duration-500',
          sleeping ? 'opacity-0' : 'opacity-100',
        )}
        style={{
          aspectRatio: '196 / 220',
          backgroundImage: `url(${STRIP})`,
          backgroundSize: `${FRAMES * 100}% 100%`,
          backgroundRepeat: 'no-repeat',
          // Still on his first frame under reduced motion; paused while he sleeps.
          animation: calm ? undefined : `legionary-pushup ${CYCLE_S}s steps(${FRAMES}, jump-none) infinite`,
          animationPlayState: sleeping ? 'paused' : 'running',
        }}
      />

      {/* Asleep: sized to the box's width and resting on the same ground. */}
      <div
        className={clsx(
          'absolute bottom-[4%] left-0 w-full transition-opacity duration-500',
          sleeping ? 'opacity-100' : 'opacity-0',
        )}
        style={{ aspectRatio: '480 / 295' }}
      >
        <img src={SLEEP_PHOTO} alt="" loading="lazy" className="h-full w-full object-contain" />
        {/* Zs rising from his helmet, each growing as it goes and fading at its biggest. */}
        {sleeping &&
          !calm &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute left-[12%] top-[2%] text-[11px] font-black leading-none text-indigo-100 drop-shadow-[0_0_4px_rgba(199,210,254,0.8)]"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1.8, 2.6], x: [0, 3, 8, 14], y: [0, -8, -16, -24] }}
              transition={{ duration: 3, repeat: Infinity, delay: i, ease: 'easeOut', times: [0, 0.2, 0.65, 1] }}
            >
              z
            </motion.span>
          ))}
      </div>

      <AnimatePresence>
        {mode === 'follow' && repKey > 0 && !calm && (
          <motion.div
            key={repKey}
            className="pointer-events-none absolute inset-x-0 top-1 flex flex-col items-center"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [6, 0, -3, -8] }}
            transition={{ duration: 1.6, times: [0, 0.1, 0.75, 1] }}
          >
            <span className="text-sm font-black text-arena-amber drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">+1</span>
            {quip && (
              <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{quip}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
