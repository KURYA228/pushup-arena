import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SkipForward } from 'lucide-react';
import { AGE_MAX, AGE_MIN, NICK_MAX, NICK_MIN, markIntroSeen, readIntroAbout, saveIntroAbout } from '../lib/intro';

/**
 * The cold open: the Colosseum, a pull-back into darkness, then the host asking whether you're
 * in. Shown once — the flag lives in localStorage, and the dev panel can put it back.
 *
 * The refusal doesn't lead anywhere, on purpose. A first-run screen that can trap you behind a
 * wrong answer is a bug, so "no" gets a comeback and the door opens anyway.
 */

/** The arena stops pulling back at this point and the dark takes over. */
const PULL_BACK_SEC = 3.2;

/** How long the gates take to open on the way in — light floods out of the button. */
const ENTER_SEC = 0.55;

/** The breathing glow on the buttons that move you forward. */
const BUTTON_GLOW = [
  '0 0 14px rgba(245, 158, 11, 0.45), 0 0 0 rgba(245, 158, 11, 0)',
  '0 0 26px rgba(245, 158, 11, 0.85), 0 0 60px rgba(245, 158, 11, 0.35)',
  '0 0 14px rgba(245, 158, 11, 0.45), 0 0 0 rgba(245, 158, 11, 0)',
];
const GLOW_PULSE = { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const };

export function Intro({ onDone }: { onDone: () => void }) {
  const [act, setAct] = useState<'arena' | 'talk'>('arena');
  const calm = useReducedMotion();
  /** Where the light pours from: the button that was pressed, in viewport pixels. */
  const [gate, setGate] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (act !== 'arena') return;
    const id = window.setTimeout(() => setAct('talk'), PULL_BACK_SEC * 1000);
    return () => window.clearTimeout(id);
  }, [act]);

  const finish = () => {
    markIntroSeen();
    onDone();
  };

  /**
   * Into the arena: the light floods out of the button and fills the screen, then the game is
   * there. On a timer, not on the animation finishing — animations stop while the page is
   * hidden, and the way in must not depend on one completing.
   */
  const enter = (from: { x: number; y: number }) => {
    if (calm) return finish();
    setGate(from);
    window.setTimeout(finish, ENTER_SEC * 1000);
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
        {act === 'arena' ? <ArenaShot key="arena" /> : <HostScene key="talk" onFinish={enter} />}
      </AnimatePresence>

      {gate && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-10 rounded-full"
          style={{
            left: gate.x,
            top: gate.y,
            width: 40,
            height: 40,
            marginLeft: -20,
            marginTop: -20,
            background: 'radial-gradient(circle, #fff7e0 0%, #f5c26b 35%, #f59e0b 60%, #0b0c0f 100%)',
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 60, opacity: [1, 1, 0.95] }}
          transition={{ duration: ENTER_SEC, ease: [0.5, 0, 0.75, 0] }}
        />
      )}

      <button
        onClick={finish}
        // Top corner: the bottom of the screen is where the way into the arena appears.
        className="safe-top absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur active:scale-95"
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

      {/* The title, big, over the sky as the arena appears. Letter by letter, each rising out
          of a blur — the name assembling itself — and a word never splits across lines. */}
      <motion.h1
        className="absolute inset-x-0 top-[9%] px-4 text-center text-[44px] font-black uppercase leading-[1.05] tracking-[0.06em] text-arena-amber sm:text-6xl"
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [1.08, 1, 1, 0.98] }}
        transition={{ duration: PULL_BACK_SEC, times: [0, 0.15, 0.8, 0.95] }}
        aria-label="Push Up Legends"
      >
        {['Push Up', 'Legends'].map((line, li) => (
          <span key={li} aria-hidden className="block whitespace-nowrap">
            {Array.from(line).map((ch, i) => (
              <motion.span
                key={i}
                className="inline-block"
                style={{
                  textShadow:
                    '0 0 12px rgba(245, 158, 11, 0.95), 0 0 32px rgba(245, 158, 11, 0.65), 0 0 64px rgba(245, 158, 11, 0.4), 0 2px 2px rgba(0, 0, 0, 0.8)',
                }}
                initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.35 + (li * 7 + i) * 0.05, duration: 0.45, ease: 'easeOut' }}
              >
                {ch === ' ' ? '\u00a0' : ch}
              </motion.span>
            ))}
          </span>
        ))}
      </motion.h1>
    </motion.div>
  );
}

const COLOSSEUM = `${import.meta.env.BASE_URL}intro/colosseum.jpg`;

/**
 * Floodlights on the rim of the photo, in its own pixels (1536×1024), and which way each one's
 * beam leans in the picture — the live beams sweep around that same direction.
 */
const FLOODLIGHTS = [
  { x: 150, y: 290, lean: -32 },
  { x: 366, y: 272, lean: 22 },
  { x: 797, y: 274, lean: -18 },
  { x: 1207, y: 296, lean: -16 },
  { x: 1322, y: 302, lean: 18 },
];

/** Spots in the stands and on the rim where a camera flash can go off. */
const FLASHES = Array.from({ length: 16 }, (_, i) => {
  const t = ((i * 7) % 16) / 15;
  return { x: 180 + t * 1160, y: 330 + ((i * 37) % 70) - Math.sin(t * Math.PI) * 40 };
});

/**
 * The amphitheatre at night: a photo, brought to life on top — floodlight beams sweeping the
 * sky, the lamps themselves throbbing, and camera flashes popping in the stands.
 */
function Colosseum() {
  return (
    // The photo's top and bottom dissolve into the dark around it instead of ending in a
    // hard edge across the screen.
    <svg
      viewBox="0 0 1536 1024"
      className="h-auto w-[130%] max-w-none"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent, #000 14%, #000 82%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 14%, #000 82%, transparent)',
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#dfe8ff" stopOpacity="0.55" />
          <stop offset="35%" stopColor="#b9c9ff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#b9c9ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lamp">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="30%" stopColor="#dfe8ff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#9fb4ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="flash">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="40%" stopColor="#fff6dd" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fff6dd" stopOpacity="0" />
        </radialGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <image href={COLOSSEUM} width="1536" height="1024" preserveAspectRatio="xMidYMid slice" />

      {/* Searchlights: a beam out of every floodlight, sweeping the sky slowly and out of step,
          added on top of the picture so the light itself is what moves. */}
      <g style={{ mixBlendMode: 'screen' }}>
        {FLOODLIGHTS.map((f, i) => (
          <motion.polygon
            key={`beam-${i}`}
            points={`${f.x - 10},${f.y} ${f.x + 10},${f.y} ${f.x + 80},${f.y - 560} ${f.x - 80},${f.y - 560}`}
            fill="url(#beam)"
            filter="url(#soft)"
            style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
            initial={{ rotate: f.lean }}
            animate={{ rotate: [f.lean - 14, f.lean + 14, f.lean - 14], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 4 + (i % 3) * 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          />
        ))}
      </g>

      {/* The lamps: a halo that breathes, a hot core, and now and then a bright flare. */}
      {FLOODLIGHTS.map((f, i) => (
        <g key={`lamp-${i}`} style={{ mixBlendMode: 'screen' }}>
          <motion.circle
            cx={f.x}
            cy={f.y}
            r={70}
            fill="url(#lamp)"
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 1.6 + (i % 3) * 0.35, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.circle
            cx={f.x}
            cy={f.y}
            r={26}
            fill="url(#lamp)"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={{ opacity: [0.8, 1, 0.8], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.9 + (i % 2) * 0.3, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Flare: a star burst that blinks out of the lamp. */}
          <motion.g
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0, 1, 0], scale: [0.4, 0.4, 1.3, 0.6] }}
            transition={{ duration: 2.6 + i * 0.37, repeat: Infinity, delay: 0.3 + i * 0.45, times: [0, 0.78, 0.84, 1] }}
          >
            <rect x={f.x - 90} y={f.y - 2.5} width="180" height="5" rx="2.5" fill="#ffffff" filter="url(#soft)" />
            <rect x={f.x - 2.5} y={f.y - 60} width="5" height="120" rx="2.5" fill="#ffffff" filter="url(#soft)" />
            <circle cx={f.x} cy={f.y} r={40} fill="url(#flash)" />
          </motion.g>
        </g>
      ))}

      {/* The crowd: camera flashes going off here and there in the stands. */}
      {FLASHES.map((p, i) => (
        <motion.circle
          key={`flash-${i}`}
          cx={p.x}
          cy={p.y}
          r={18}
          fill="url(#flash)"
          style={{ transformBox: 'fill-box', transformOrigin: 'center', mixBlendMode: 'screen' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 0], scale: [0.4, 0.4, 1.4, 0.5] }}
          transition={{ duration: 1.4 + (i % 4) * 0.45, repeat: Infinity, delay: 0.2 + i * 0.19, times: [0, 0.82, 0.86, 1] }}
        />
      ))}
    </svg>
  );
}


/* ------------------------------ act two ------------------------------- */

/** The host's name, on the plate at his feet. */
const HOST_NAME = 'Кирюха';

/** The host standing full length, cut out of his own background: waving, then offering a hand. */
const HOST_WAVE = `${import.meta.env.BASE_URL}intro/host-full.webp`;
const HOST_GREET = `${import.meta.env.BASE_URL}intro/host-greet.webp`;

/** His opening, in two bubbles: who he is, then — turning to offer his hand — who you are. */
const HELLO = 'Привет, воин! Я создатель этого всего и хочу посвятить тебя в своё творение!';
const MEET = 'Давай сначала познакомимся. Меня зовут Кирюха, а тебя?';
/** How long the hello stays on screen once typed, before the introduction replaces it. */
const HELLO_HOLD_MS = 1600;

/** When things happen in act two, seconds from its start. */
const T = {
  /** The arena comes up out of the dark. */
  backdrop: 1.2,
  /** He steps in. */
  host: 0.9,
  /** And starts talking once he's there. */
  speak: 2.1,
};

/**
 * A line typed out letter by letter, the way a character speaks in a game. `skip` shows the
 * rest at once — the first tap on a line finishes it, the second moves on.
 */
function Typewriter({
  text,
  skip,
  onDone,
  startAt = 0,
}: {
  text: string;
  skip: boolean;
  onDone: () => void;
  /** Letters already on screen — a line that carries on from the one before it. */
  startAt?: number;
}) {
  const calm = useReducedMotion();
  const [shown, setShown] = useState(calm ? text.length : startAt);
  const done = skip || shown >= text.length;

  useEffect(() => {
    if (done) {
      onDone();
      return;
    }
    // A touch slower on punctuation, so a sentence has its pauses.
    const prev = text[shown - 1];
    const wait = prev && /[,.!?—]/.test(prev) ? 140 : 26;
    const id = window.setTimeout(() => setShown((n) => n + 1), wait);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, done]);

  const visible = done ? text : text.slice(0, shown);
  return (
    // Both copies in one grid cell: the full line, invisible, sets the bubble's final size from
    // the first letter, and the typed one wraps at exactly the same width over it. An absolute
    // overlay inside an inline box was sized by the first line fragment — on a line that wraps,
    // the typed text came out as a narrow column of one word per row.
    <span className="inline-grid">
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {text}
      </span>
      <span className="col-start-1 row-start-1" aria-label={text}>
        {visible}
        {!done && <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-current align-middle" style={{ height: '1em' }} />}
      </span>
    </span>
  );
}

/** Where the conversation is. */
type Step = 'hello' | 'meet' | 'name' | 'ask-age' | 'age' | 'welcome';

/**
 * Act two: the darkened arena, the host stepping in full length in the middle of it, and the
 * getting-to-know-you — he says hello, turns to offer his hand and asks your name, then your
 * age, then lets you in. His lines are typed out over his head; a tap finishes one.
 */
function HostScene({ onFinish }: { onFinish: (from: { x: number; y: number }) => void }) {
  const calm = useReducedMotion();
  const [step, setStep] = useState<Step | null>(calm ? 'hello' : null);
  const [skip, setSkip] = useState(false);
  const [typed, setTyped] = useState(false);
  const [nick, setNick] = useState(() => readIntroAbout()?.nickname ?? '');
  const [age, setAge] = useState('');

  useEffect(() => {
    if (calm) return;
    const id = window.setTimeout(() => setStep('hello'), T.speak * 1000);
    return () => window.clearTimeout(id);
  }, [calm]);

  /** Moves to the next step; a new line starts untyped. */
  const go = (next: Step) => {
    setSkip(false);
    setTyped(false);
    setStep(next);
  };
  // The hello stays up long enough to read, then gives way to the introduction (a tap sooner).
  useEffect(() => {
    if (step !== 'hello' || !typed) return;
    const id = window.setTimeout(() => go('meet'), HELLO_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [step, typed]);
  // After a question is asked, its answer field.
  useEffect(() => {
    if (!typed) return;
    if (step === 'meet') setStep('name');
    if (step === 'ask-age') setStep('age');
  }, [step, typed]);

  const name = nick.trim();
  const nameOk = name.length >= NICK_MIN && name.length <= NICK_MAX;
  const ageNum = Number(age);
  const ageOk = Number.isInteger(ageNum) && ageNum >= AGE_MIN && ageNum <= AGE_MAX;

  // What's in his bubble right now, and how much of it was already on screen.
  const bubble: { text: string; from: number } | null =
    step === 'hello'
      ? { text: HELLO, from: 0 }
      : step === 'meet' || step === 'name'
        ? { text: MEET, from: 0 }
        : step === 'ask-age' || step === 'age'
          ? { text: `Приятно познакомиться, ${name}! А сколько тебе лет?`, from: 0 }
          : step === 'welcome'
            ? { text: `Отлично, ${name}! Добро пожаловать на арену. Покажи, на что способен!`, from: 0 }
            : null;
  // One bubble per thought: who he is, then the introduction (which stays up while you answer).
  const lineKey = step === 'name' ? 'meet' : step === 'age' ? 'ask-age' : step;
  const typing = bubble != null && (step === 'hello' || step === 'meet' || step === 'ask-age' || step === 'welcome') && !typed;
  // He offers his hand from the introduction on.
  const greeting = step != null && step !== 'hello';

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onClick={() => {
        if (typing) setSkip(true);
        else if (step === 'hello') go('meet');
      }}
    >
      {/* The arena, barely there: dark, a little soft, coming up out of the black. */}
      <motion.img
        src={`${import.meta.env.BASE_URL}intro/colosseum.jpg`}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: 'brightness(0.28) saturate(0.8) blur(1.5px)' }}
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: calm ? 0 : T.backdrop, ease: 'easeOut' }}
      />
      {/* Darker at the edges, so the eye goes to the middle where he'll stand. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 55%, transparent 30%, rgba(0,0,0,0.85) 100%)' }}
      />

      <div className="safe-top safe-bottom absolute inset-0 flex flex-col items-center justify-end px-5 pb-6">
        {/* What he says, over his head. */}
        <div className="relative z-10 mb-3 min-h-[76px] w-full max-w-sm">
          <AnimatePresence mode="wait">
            {bubble && (
              <motion.div
                key={lineKey}
                initial={{ opacity: 0, y: 12, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                className="relative rounded-2xl border border-arena-amber/60 bg-arena-surface/95 px-4 py-3 text-center text-[15px] font-semibold leading-snug text-arena-text shadow-[0_0_26px_rgba(245,158,11,0.4)]"
              >
                <Typewriter
                  key={`${step === 'name' ? 'meet' : step === 'age' ? 'ask-age' : step}`}
                  text={bubble.text}
                  startAt={bubble.from}
                  skip={skip || step === 'name' || step === 'age'}
                  onDone={() => setTyped(true)}
                />
                <span className="absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-arena-amber/60 bg-arena-surface" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Him, full length, stepping up into the light. */}
        <motion.div
          className="relative flex flex-col items-center"
          initial={calm ? false : { opacity: 0, y: 60, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: T.host, duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-30%] bottom-[8%] top-[10%] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.45), transparent 65%)' }}
            animate={calm ? undefined : { opacity: [0.55, 0.9, 0.55] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Two poses on top of each other, cross-faded: waving hello, then a hand held out. */}
          <motion.div
            className="relative"
            style={{ height: 'min(48vh, 460px)', aspectRatio: '446 / 1100' }}
            animate={calm ? undefined : { scale: [1, 1.012, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {[HOST_WAVE, HOST_GREET].map((src, i) => (
              <motion.img
                key={src}
                src={src}
                alt={i === 0 ? HOST_NAME : ''}
                aria-hidden={i === 1}
                className="absolute inset-0 h-full w-full object-contain"
                style={{ filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.7))' }}
                initial={false}
                animate={{ opacity: (i === 1) === greeting ? 1 : 0, scale: (i === 1) === greeting ? 1 : 0.97 }}
                transition={{ duration: 0.45 }}
              />
            ))}
          </motion.div>
          <span className="relative -mt-1 rounded-full border border-arena-amber/50 bg-black/60 px-3 py-0.5 text-[11px] font-bold uppercase tracking-[0.3em] text-arena-amber">
            {HOST_NAME}
          </span>
        </motion.div>

        {/* Your answer, or the way in. */}
        <div className="mt-4 min-h-[96px] w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <AnimatePresence mode="wait">
            {step === 'name' && (
              <Answer
                key="name"
                label="Твой ник"
                value={nick}
                onChange={setNick}
                placeholder="как тебя звать, воин?"
                maxLength={NICK_MAX}
                ok={nameOk}
                hint={`от ${NICK_MIN} до ${NICK_MAX} символов — так тебя увидят в таблице лидеров`}
                onSubmit={() => go('ask-age')}
              />
            )}
            {step === 'age' && (
              <Answer
                key="age"
                label="Возраст"
                value={age}
                onChange={(v) => setAge(v.replace(/\D/g, '').slice(0, 3))}
                placeholder="сколько тебе лет?"
                numeric
                ok={ageOk}
                hint={`от ${AGE_MIN} до ${AGE_MAX}`}
                onSubmit={() => {
                  void saveIntroAbout({ nickname: name, age: ageNum });
                  go('welcome');
                }}
              />
            )}
            {step === 'welcome' && typed && (
              <motion.button
                key="go"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, boxShadow: BUTTON_GLOW }}
                transition={{ type: 'spring', stiffness: 320, damping: 26, boxShadow: GLOW_PULSE }}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onFinish({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                }}
                className="arena-glow relative mt-6 h-12 w-full overflow-hidden rounded-xl bg-arena-amber text-sm font-bold text-black active:scale-[0.98]"
              >
                {!calm && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                    initial={{ x: '-120%' }}
                    animate={{ x: ['-120%', '400%'] }}
                    transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
                  />
                )}
                <span className="relative">На арену</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/** An answer to the host: one field and "Дальше", Enter submitting too. */
function Answer({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  numeric = false,
  ok,
  hint,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
  numeric?: boolean;
  ok: boolean;
  hint: string;
  onSubmit: () => void;
}) {
  return (
    <motion.form
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSubmit();
      }}
    >
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-arena-amber">{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={numeric ? 'numeric' : 'text'}
          enterKeyHint="next"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-arena-amber/50 bg-black/60 px-3 py-3 text-base text-arena-text outline-none backdrop-blur placeholder:text-arena-text-dim focus:border-arena-amber"
        />
        <motion.button
          type="submit"
          disabled={!ok}
          animate={ok ? { boxShadow: BUTTON_GLOW } : { boxShadow: 'none' }}
          transition={ok ? GLOW_PULSE : { duration: 0.2 }}
          className="shrink-0 rounded-xl bg-arena-amber px-4 text-sm font-bold text-black active:scale-95 disabled:opacity-40"
        >
          Дальше
        </motion.button>
      </div>
      <p className="mt-1 text-[11px] text-arena-text-dim">{hint}</p>
    </motion.form>
  );
}
