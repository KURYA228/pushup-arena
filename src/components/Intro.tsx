import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { SkipForward } from 'lucide-react';
import { markIntroSeen } from '../lib/intro';

/**
 * The cold open: the Colosseum, a pull-back into darkness, then the host asking whether you're
 * in. Shown once — the flag lives in localStorage, and the dev panel can put it back.
 *
 * The refusal doesn't lead anywhere, on purpose. A first-run screen that can trap you behind a
 * wrong answer is a bug, so "no" gets a comeback and the door opens anyway.
 */

/** The arena stops pulling back at this point and the dark takes over. */
const PULL_BACK_SEC = 3.2;

export function Intro({ onDone }: { onDone: () => void }) {
  const [act, setAct] = useState<'arena' | 'talk'>('arena');

  useEffect(() => {
    if (act !== 'arena') return;
    const id = window.setTimeout(() => setAct('talk'), PULL_BACK_SEC * 1000);
    return () => window.clearTimeout(id);
  }, [act]);

  const finish = () => {
    markIntroSeen();
    onDone();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Cross-fade rather than `mode="wait"`: waiting makes the next act hostage to the
          previous one's exit animation, and animations stop running while the page is hidden —
          so backgrounding the app mid-intro would leave it stuck on the arena. */}
      <AnimatePresence>
        {act === 'arena' ? <ArenaShot key="arena" /> : <DialogueScene key="talk" onFinish={finish} />}
      </AnimatePresence>

      <button
        onClick={finish}
        className="safe-bottom absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur active:scale-95"
      >
        Пропустить <SkipForward size={12} />
      </button>
    </motion.div>
  );
}

/* ------------------------------ act one ------------------------------- */

function ArenaShot() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Starts filling the frame and retreats — the camera pulling back off the arena. */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 2.1, y: 30 }}
        animate={{ scale: 0.92, y: 0 }}
        transition={{ duration: PULL_BACK_SEC, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <Colosseum />
      </motion.div>

      {/* The dark closes in over the last third of the shot. */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1] }}
        transition={{ duration: PULL_BACK_SEC, times: [0, 0.6, 1], ease: 'easeIn' }}
      />

      <motion.p
        className="absolute inset-x-0 bottom-24 text-center text-xs uppercase tracking-[0.4em] text-arena-amber"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: PULL_BACK_SEC, times: [0, 0.45, 0.9] }}
      >
        Push Up Legends
      </motion.p>
    </motion.div>
  );
}

/**
 * The amphitheatre, drawn rather than photographed: two tiers of arches over a lit sand floor.
 * Swap in a picture later by replacing this component — nothing else depends on it.
 */
function Colosseum() {
  const outer = Array.from({ length: 15 }, (_, i) => i);
  const inner = Array.from({ length: 13 }, (_, i) => i);

  return (
    <svg viewBox="0 0 400 260" className="h-auto w-[130%] max-w-none" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1208" />
          <stop offset="60%" stopColor="#3a2410" />
          <stop offset="100%" stopColor="#0b0c0f" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="72%" r="42%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a3a28" />
          <stop offset="100%" stopColor="#221a12" />
        </linearGradient>
      </defs>

      <rect width="400" height="260" fill="url(#sky)" />
      <ellipse cx="200" cy="190" rx="190" ry="70" fill="url(#glow)" />

      {/* Outer wall: an ellipse of arches, squashed into perspective. */}
      <g fill="url(#stone)">
        <path d="M40 180 Q40 96 200 96 Q360 96 360 180 L360 200 Q200 232 40 200 Z" />
      </g>
      <g fill="#0b0c0f">
        {outer.map((i) => {
          const t = (i + 0.5) / outer.length;
          const x = 46 + t * 308;
          const lift = Math.sin(t * Math.PI) * 26;
          return <rect key={i} x={x - 6} y={150 - lift} width="12" height={26} rx="6" />;
        })}
      </g>
      <g fill="#0b0c0f" opacity="0.85">
        {inner.map((i) => {
          const t = (i + 0.5) / inner.length;
          const x = 58 + t * 284;
          const lift = Math.sin(t * Math.PI) * 22;
          return <rect key={i} x={x - 5} y={118 - lift} width="10" height={22} rx="5" />;
        })}
      </g>

      {/* The sand, lit from inside. */}
      <ellipse cx="200" cy="196" rx="120" ry="30" fill="#d9a441" opacity="0.22" />
      <ellipse cx="200" cy="196" rx="86" ry="20" fill="#f5c26b" opacity="0.18" />

      {/* Dust in the light. */}
      {Array.from({ length: 18 }, (_, i) => (
        <motion.circle
          key={i}
          cx={90 + ((i * 47) % 220)}
          cy={150 + ((i * 29) % 60)}
          r={0.9 + (i % 3) * 0.5}
          fill="#f5c26b"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0], y: [0, -18] }}
          transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.17 }}
        />
      ))}
    </svg>
  );
}


/**
 * The edge of a portrait that still has a background of its own.
 *
 * Only needed for a photograph: a cut-out carries its own transparency and wants none of this.
 * Dissolving a rectangle is a way of hiding a rectangle, and it never fully works — what you
 * get is a soft-edged rectangle, which is what this is for until the cut-outs arrive.
 */
const FIGURE_FADE =
  'radial-gradient(ellipse 62% 58% at 50% 42%, #000 62%, rgba(0, 0, 0, 0.35) 88%, transparent 100%)';

/** How long one pose takes to become the other. */
const POSE_FADE = 0.45;

/**
 * How much room each side of the conversation gets, in pixels.
 *
 * Not an equal split, because the two sides are not equal things. On the right is a
 * photograph of a man doing something with his hands; on the left is a silhouette standing
 * in for you, and a silhouette is just as readable at half the size. Giving them the same
 * width spent half the row on an icon.
 *
 * It matters most on the picture where he holds up the sign. There the board sets how wide
 * the picture is, so the man inside it is necessarily smaller than in the one where he only
 * raises a hand — and since the pictures are fitted whole, that is not something scaling or
 * cropping can fix. More room for the picture is the only thing that makes him bigger.
 *
 * The two together have to fit a phone across: 110 and 230 plus the gap leaves a margin
 * either side at 375px, which is the narrowest screen worth designing for.
 */
const PLAYER_W = 110;
const HOST_W = 230;


/* ------------------------------ act two ------------------------------- */

/**
 * Which picture of him is up. He waves by default and holds the sign to name the place.
 *
 * Cut-outs, not photographs. The originals came with a temple behind him, and no amount of
 * dissolving the edges of a rectangle stops it being a rectangle — what you get is a rounded
 * photo card with somebody else's architecture inside it, sitting in a scene it does not
 * belong to. These were lifted off their background with the segmentation that ships with
 * macOS (the same one behind the Finder's "Remove Background"); scripts/cutout.jxa.js does it
 * and can do the next one.
 */
type Pose = 'wave' | 'sign' | 'call';
const POSE_FILE: Record<Pose, string> = {
  wave: 'host-wave.png',
  sign: 'host-sign.png',
  call: 'host-call.png',
};

interface Line {
  who: 'host' | 'player';
  text: string;
  /** Only on his lines; the pose holds until one of his lines changes it. */
  pose?: Pose;
}

// He waves hello, holds up the name of the place while he asks, and beckons once you have
// said yes — three gestures that match the three beats of the conversation, so the pictures
// carry it as well as the words do.
const OPENING: Line[] = [
  { who: 'host', text: 'Привет, Боец!', pose: 'wave' },
  { who: 'host', text: 'Решил присоединиться к Push Up Legends?', pose: 'sign' },
];

const ACCEPTED: Line[] = [
  { who: 'player', text: 'Конечно' },
  {
    who: 'host',
    text: 'Тогда пол тебя уже ждёт. Пятнадцать боссов, и ни один не отступит.',
    pose: 'call',
  },
];

const REFUSED: Line[] = [
  { who: 'player', text: 'Нет, отстань от меня' },
  { who: 'host', text: 'Поздно. Ты уже здесь.', pose: 'call' },
];

/** The pose set by the most recent line of his, at or before `at`. */
function lastPose(queue: Line[], at: number): Pose {
  for (let i = Math.min(at, queue.length - 1); i >= 0; i -= 1) {
    const p = queue[i].pose;
    if (p) return p;
  }
  return 'sign';
}

/**
 * The conversation: you on the left, the host on the right, one line at a time.
 *
 * Lines advance on a tap rather than a timer — a countdown either rushes a slow reader or bores
 * a fast one, and there's nothing to hurry towards. The answer you pick is spoken back as your
 * own line, which is what makes it read as a dialogue instead of a menu.
 */
function DialogueScene({ onFinish }: { onFinish: () => void }) {
  const [queue, setQueue] = useState<Line[]>(OPENING);
  const [at, setAt] = useState(0);
  const [branch, setBranch] = useState<'none' | 'accepted' | 'refused'>('none');

  const line = queue[at];
  const lastOfQueue = at >= queue.length - 1;
  // His pose holds through your replies — it must not flip back while you are the one
  // talking — so it comes from the last of his lines, not from the line on screen.
  const pose = lastPose(queue, at);
  // The two options only exist at the end of the opening; after a branch there's one way out.
  const atChoice = lastOfQueue && branch === 'none';
  const atEnd = lastOfQueue && branch !== 'none';

  /**
   * Buttons wait for the line to land. They're kept out of the tree rather than merely faded
   * in, because a transparent button is still a button — you could hit it blind before the
   * question had finished appearing.
   */
  const [answersReady, setAnswersReady] = useState(false);
  useEffect(() => {
    if (!atChoice && !atEnd) {
      setAnswersReady(false);
      return;
    }
    const id = window.setTimeout(() => setAnswersReady(true), 700);
    return () => window.clearTimeout(id);
  }, [atChoice, atEnd, at, branch]);

  const choosing = atChoice && answersReady;
  const closing = atEnd && answersReady;

  const advance = () => {
    if (!lastOfQueue) setAt((i) => i + 1);
  };

  const pick = (chosen: 'accepted' | 'refused') => {
    setBranch(chosen);
    setQueue(chosen === 'accepted' ? ACCEPTED : REFUSED);
    setAt(0);
  };

  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-end px-5 pb-28 pt-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      onClick={choosing || closing ? undefined : advance}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end">
        {/* Each bubble carries its own side. Putting the alignment on the container instead
            dragged the outgoing line across to the other speaker while it faded, so the host's
            words appeared over on your side for a moment. */}
        <div className="mb-5 flex flex-col">
          {/*
            Replaced by `key` rather than cross-faded. Waiting for an outgoing bubble to finish
            leaving means two of them exist at once — which is how your answer ended up on screen
            twice — and animations stop while the page is hidden, so a dialogue that waits on one
            can freeze mid-sentence.
          */}
          <motion.div
            key={`${branch}-${at}`}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className={clsx(
              'max-w-[86%] rounded-2xl border px-4 py-3 text-[15px] font-medium leading-snug',
              line.who === 'host'
                ? 'self-end rounded-br-sm border-arena-amber/40 bg-arena-surface text-arena-text'
                : 'self-start rounded-bl-sm border-arena-border bg-arena-surface-2 text-arena-text-dim',
            )}
          >
            {line.text}
          </motion.div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <Portrait file="player.jpg" room={PLAYER_W} speaking={line.who === 'player'} side="left" />
          <Portrait file={POSE_FILE[pose]} room={HOST_W} speaking={line.who === 'host'} side="right" />
        </div>

        <div className="mt-7 min-h-[104px]">
          <AnimatePresence mode="wait">
            {choosing ? (
              // No exit animation: the answer you pick is immediately spoken back as your own
              // line, and a button fading out under it showed the same words twice.
              <motion.div key="choice" className="flex flex-col gap-2">
                {/* Held back until the question has landed. Appearing alongside it made the
                    two read as one block, and you answered before you'd finished reading. */}
                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  onClick={() => pick('accepted')}
                  className="arena-glow rounded-xl bg-arena-amber py-3 text-sm font-bold text-black active:scale-[0.98]"
                >
                  Конечно
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, type: 'spring', stiffness: 320, damping: 26 }}
                  onClick={() => pick('refused')}
                  className="rounded-xl border border-arena-border bg-arena-surface py-3 text-sm font-medium text-arena-text-dim active:scale-[0.98]"
                >
                  Нет, отстань от меня
                </motion.button>
              </motion.div>
            ) : closing ? (
              <motion.button
                key="closing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                onClick={onFinish}
                className="arena-glow w-full rounded-xl bg-arena-amber py-3 text-sm font-bold text-black active:scale-[0.98]"
              >
                {branch === 'refused' ? 'Ладно' : 'На арену'}
              </motion.button>
            ) : lastOfQueue ? (
              // The pause between the line landing and the answers appearing. Nothing to
              // prompt for here: tapping wouldn't advance anything.
              <span key="pause" />
            ) : (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.25, 0.7, 0.25] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="pt-3 text-center text-xs text-arena-text-dim"
              >
                нажми, чтобы продолжить
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * One of the two faces. Drops in a photo from `public/intro/` when the file exists; until then
 * it's a lit silhouette, so the scene reads properly with nothing supplied. The one talking is
 * brought forward and lit — otherwise there's no telling who the line belongs to.
 */
function Portrait({
  file,
  speaking,
  side,
  room,
}: {
  file: string;
  speaking: boolean;
  side: 'left' | 'right';
  /** How wide this portrait may get, in pixels. */
  room: number;
}) {
  const [missing, setMissing] = useState(false);
  // A PNG is taken to be a real cut-out with its own transparency; a JPEG is a rectangular
  // photograph with a background baked into it. The same test the fight screen's artwork uses.
  const cutout = /\.png$/i.test(file);
  // A standing figure, not a head in a circle: these are full-length photographs, and a
  // round crop of one is a picture of a chest. Big enough to see what he is doing with his
  // hands, which is the whole point of there being two of them — he waves, then he holds
  // up the name of the place.
  //
  // Both limits are needed and they bind on different screens. Width: two of these sit side
  // by side, so neither may take more than its share of the row — that is what caps them on
  // a phone. Height: the dialogue has a bubble above and two buttons below, and on a short
  // laptop window the whole column would run off the top — that is what caps them there.
  // Taller than it used to be. The pictures are fitted whole, so whichever of width and
  // height runs out first decides how big the man is — and at the old 32vh it was always the
  // height, which meant the extra width given to his side did nothing at all.
  const box = { width: '100%', height: 'min(320px, 38vh)' } as const;

  return (
    <motion.div
      animate={{
        scale: speaking ? 1 : 0.88,
        opacity: speaking ? 1 : 0.45,
        y: speaking ? -6 : 0,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      // An equal share of the row, capped. A percentage on the picture itself resolved
      // against this box, which shrink-wraps its contents — so it came out the width of the
      // caption underneath.
      className="flex min-w-0 flex-1 flex-col items-center"
      style={{ maxWidth: room }}
    >
      <span
        className="relative flex items-end justify-center"
        style={{
          ...box,
          // Mirrored so the two of them face each other rather than both looking the same way.
          transform: side === 'left' ? 'scaleX(-1)' : undefined,
        }}
      >
        {missing ? (
          // A bare silhouette, on nothing. It used to sit on a rounded plate with a lit
          // gradient inside it, which was fine while the other side was a photograph in a
          // box too — once he became a cut-out standing in the scene, the plate was the only
          // rectangle left on the screen and read as the thing that hadn't loaded.
          <span className="flex h-full w-full items-end justify-center">
            <svg
              viewBox="0 0 100 100"
              width="80%"
              height="80%"
              aria-hidden
              style={{
                filter: speaking ? 'drop-shadow(0 0 28px rgba(245, 158, 11, 0.4))' : 'none',
              }}
            >
              <circle cx="50" cy="34" r="17" fill="#f59e0b" opacity="0.5" />
              <path d="M18 100 Q22 62 50 58 Q78 62 82 100 Z" fill="#f59e0b" opacity="0.5" />
            </svg>
          </span>
        ) : (
          // Keyed on the file, so changing pose mounts the new one and lets the old one leave
          // rather than swapping the `src` underneath a single element. A `src` swap is a cut:
          // one frame he is waving, the next he is holding a sign. Both are laid over each
          // other and absolutely placed, because two images in the flow would stand side by
          // side for the length of the dissolve and shove the column about.
          <AnimatePresence initial={false}>
            <motion.img
              key={file}
              src={`${import.meta.env.BASE_URL}intro/${file}`}
              alt=""
              aria-hidden="true"
              onError={() => setMissing(true)}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: POSE_FADE, ease: 'easeInOut' }}
              style={{
                width: '100%',
                height: '100%',
                // A cut-out is fitted whole and stood on the floor of its box: `cover` would
                // trim a figure that isn't the box's shape, and trimming a cut-out takes the
                // hand or the crest off. A photograph is still cropped to fill, because the
                // part being lost there is background.
                objectFit: cutout ? 'contain' : 'cover',
                objectPosition: cutout ? 'bottom' : 'top',
                // Only a photograph needs its edges dissolved. A cut-out has no edges to
                // hide, and masking one would eat the hand he is waving.
                ...(cutout
                  ? null
                  : { maskImage: FIGURE_FADE, WebkitMaskImage: FIGURE_FADE }),
                // On a cut-out the shadow traces the figure, which is what makes him read as
                // lit from the scene rather than as a lit rectangle.
                filter: speaking ? 'drop-shadow(0 0 34px rgba(245, 158, 11, 0.45))' : 'none',
              }}
            />
          </AnimatePresence>
        )}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-arena-text-dim">
        {side === 'left' ? 'ты' : 'арена'}
      </span>
    </motion.div>
  );
}
