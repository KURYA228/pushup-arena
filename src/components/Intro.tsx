import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Info, SkipForward } from 'lucide-react';
import { AGE_MAX, AGE_MIN, NICK_MAX, NICK_MIN, markIntroSeen, readIntroAbout, saveIntroAbout } from '../lib/intro';
import { introLineMs, playIntroLine, stopIntroLine, type IntroLine } from '../lib/feedback';

/**
 * The cold open: a title screen over the Colosseum, then the host getting to know you. Shown once — the flag lives in localStorage, and the dev panel can put it back.
 *
 * The refusal doesn't lead anywhere, on purpose. A first-run screen that can trap you behind a
 * wrong answer is a bug, so "no" gets a comeback and the door opens anyway.
 */

/** How long the gates take to open on the way in — light floods out of the button. */
const ENTER_SEC = 0.55;

/**
 * Where the intro sends you: `signin` for "already have an account" — the sign-in form alone —
 * and `signup` for everyone who met the host, or skipped him, and gets the full form.
 */
export type IntroExit = 'signin' | 'signup';

export function Intro({ onDone }: { onDone: (exit: IntroExit) => void }) {
  const [act, setAct] = useState<'title' | 'talk'>('title');
  const calm = useReducedMotion();
  /** Where the light pours from: the button that was pressed, in viewport pixels. */
  const [gate, setGate] = useState<{ x: number; y: number } | null>(null);

  const finish = (exit: IntroExit = 'signup') => {
    markIntroSeen();
    onDone(exit);
  };

  /**
   * Into the arena: the light floods out of the button and fills the screen, then the game is
   * there. On a timer, not on the animation finishing — animations stop while the page is
   * hidden, and the way in must not depend on one completing.
   */
  const enter = (from: { x: number; y: number }) => {
    if (calm) return finish();
    setGate(from);
    window.setTimeout(() => finish(), ENTER_SEC * 1000);
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
          so backgrounding the app mid-intro would leave it stuck on the title. */}
      <AnimatePresence>
        {act === 'title' ? (
          <TitleScreen key="title" onStart={() => setAct('talk')} onHaveAccount={() => finish('signin')} />
        ) : (
          <HostScene key="talk" onFinish={enter} />
        )}
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

      {/* The title screen has its own way past — "already have an account". */}
      {act === 'talk' && (
        <button
          onClick={() => finish()}
          // Top corner: the bottom of the screen is where the way into the arena appears.
          className="safe-top absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur active:scale-95"
        >
          Пропустить <SkipForward size={12} />
        </button>
      )}
    </motion.div>
  );
}

/* ------------------------------ act one ------------------------------- */

/**
 * The arena behind the whole intro. Swap the file for the illustrated one when it's drawn —
 * nothing here depends on what's in the picture.
 */
const COLOSSEUM = `${import.meta.env.BASE_URL}intro/colosseum.jpg`;

/** The chunky display face the title, tagline and button share (Cyrillic included). */
const DISPLAY_FONT = "'Russo One', 'Inter', system-ui, sans-serif";

/** The tagline yellow — the same as the face of the game buttons (`.btn-3d`). */
const YELLOW = '#f2b705';

/**
 * Act one: the title screen. The arena, dimmed to a night blue, the name over the sky, and two
 * ways on — meet the host, or straight to signing in for someone who's been here before.
 */
function TitleScreen({ onStart, onHaveAccount }: { onStart: () => void; onHaveAccount: () => void }) {
  const calm = useReducedMotion();
  return (
    <motion.div
      className="absolute inset-0"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <ArenaBackdrop />

      <div className="safe-top safe-bottom absolute inset-0 flex flex-col items-center px-6">
        {/* The name, letter by letter out of a blur, a word never splitting across lines. */}
        <h1
          className="mt-[24vh] text-center text-[52px] uppercase leading-[1.02] text-white sm:text-7xl"
          style={{ fontFamily: DISPLAY_FONT, textShadow: '0 3px 0 rgba(0,0,0,0.45), 0 8px 30px rgba(0,0,0,0.6)' }}
          aria-label="Push Up Legends"
        >
          {['Push Up', 'Legends'].map((line, li) => (
            <span key={li} aria-hidden className="block whitespace-nowrap">
              {Array.from(line).map((ch, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={calm ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.3 + (li * 7 + i) * 0.045, duration: 0.45, ease: 'easeOut' }}
                >
                  {ch === ' ' ? ' ' : ch}
                </motion.span>
              ))}
            </span>
          ))}
        </h1>

        <motion.p
          className="mt-5 text-center text-[17px] leading-snug"
          style={{ fontFamily: DISPLAY_FONT, color: YELLOW, textShadow: '0 2px 0 rgba(0,0,0,0.5)' }}
          initial={calm ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          Качайся. Расти. Стань легендой.
        </motion.p>

        <motion.div
          className="mt-auto w-full max-w-sm pb-6"
          initial={calm ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, type: 'spring', stiffness: 260, damping: 24 }}
        >
          <button onClick={onStart} className="btn-3d h-14 w-full text-[22px]">
            Начать
          </button>
          <button onClick={onHaveAccount} className="mt-5 w-full py-2 text-center text-[15px] text-white/60 active:text-white/90">
            У меня уже есть аккаунт
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

/**
 * The arena behind everything, under a night-blue veil that deepens towards the bottom where
 * the buttons sit. It settles in from a little close, then drifts very slowly so the screen
 * never looks frozen.
 */
function ArenaBackdrop({ dim = false }: { dim?: boolean }) {
  const calm = useReducedMotion();
  return (
    <>
      <motion.img
        src={COLOSSEUM}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: dim ? 'brightness(0.55) blur(1.5px)' : undefined }}
        initial={calm ? false : { opacity: 0, scale: 1.12 }}
        animate={calm ? { opacity: 1 } : { opacity: 1, scale: [1.12, 1.03, 1.06, 1.03] }}
        transition={{ opacity: { duration: 1 }, scale: { duration: 24, times: [0, 0.12, 0.56, 1], ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' } }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(14,20,38,0.62) 0%, rgba(14,20,38,0.5) 40%, rgba(10,14,26,0.78) 78%, rgba(8,10,18,0.94) 100%)',
        }}
      />
    </>
  );
}


/* ------------------------------ act two ------------------------------- */

/** The host's name, on the plate at his feet. */
const HOST_NAME = 'Кирюха';

/** The host standing full length, cut out of his own background: waving, then offering a hand. */
const HOST_WAVE = `${import.meta.env.BASE_URL}intro/host-full.webp`;
const HOST_GREET = `${import.meta.env.BASE_URL}intro/host-greet.webp`;

/**
 * His lines, in four bubbles: who he is, then — turning to offer his hand — who you are, your
 * age, and the way in. The last two greet you by your nickname on screen; a voiced version skips
 * the name. The last one hints at the finale, where he turns out to be the boss.
 */
const HELLO = 'Здравствуй, воин! Это мой Колизей — я построил его своими руками. И сила здесь меряется только одним — отжиманиями.';
const MEET = 'Но сначала давай познакомимся. Меня зовут Кирюха. А тебя как звать?';
const askAge = (name: string) => `Приятно познакомиться, ${name}! А скажи-ка, сколько тебе лет?`;
const welcome = (name: string) =>
  `Отлично, ${name}. Тогда слушай: впереди пятнадцать боссов, и каждое отжимание — это удар. Дойдёшь до конца — и мы с тобой ещё встретимся. Вперёд!`;

/** The pause between his question being typed out and the answer card appearing. */
const ANSWER_DELAY_MS = 300;

/** When things happen in act two, seconds from its start. */
const T = {
  /** He steps in. */
  host: 0.9,
  /** And starts talking once he's there. */
  speak: 2.1,
};

/** Punctuation holds the typing about five letters' worth, so a sentence has its pauses. */
const PAUSE_WEIGHT = 5;
const isPause = (ch: string | undefined) => Boolean(ch && /[,.!?—:]/.test(ch));

/**
 * A line typed out letter by letter, the way a character speaks in a game. `skip` shows the
 * rest at once — the first tap on a line finishes it, the second moves on.
 */
function Typewriter({
  text,
  skip,
  onDone,
  startAt = 0,
  durationMs = null,
}: {
  text: string;
  skip: boolean;
  onDone: () => void;
  /** Letters already on screen — a line that carries on from the one before it. */
  startAt?: number;
  /** How long the voiced line runs: the typing keeps pace with it, finishing a touch ahead. */
  durationMs?: number | null;
}) {
  const calm = useReducedMotion();
  const [shown, setShown] = useState(calm ? text.length : startAt);
  const done = skip || shown >= text.length;
  // One letter's worth of time: from the voice when there is one, the old fixed pace otherwise.
  const [unit] = useState(() => {
    if (!durationMs) return 26;
    const weight = Array.from(text).reduce((sum, ch) => sum + (isPause(ch) ? PAUSE_WEIGHT : 1), 0);
    return Math.max(26, (durationMs * 0.9) / Math.max(1, weight));
  });

  useEffect(() => {
    if (done) {
      onDone();
      return;
    }
    // A touch slower on punctuation, so a sentence has its pauses.
    const wait = isPause(text[shown - 1]) ? unit * PAUSE_WEIGHT : unit;
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
  // After a question is asked, its answer field — once he's finished and had a beat, not while
  // the last words are still landing.
  useEffect(() => {
    if (!typed || (step !== 'meet' && step !== 'ask-age')) return;
    const next = step === 'meet' ? 'name' : 'age';
    const id = window.setTimeout(() => setStep(next), calm ? 0 : ANSWER_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [step, typed, calm]);

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
          ? { text: askAge(name), from: 0 }
          : step === 'welcome'
            ? { text: welcome(name), from: 0 }
            : null;
  // One bubble per thought: who he is, then the introduction (which stays up while you answer).
  const lineKey = step === 'name' ? 'meet' : step === 'age' ? 'ask-age' : step;
  // Each bubble voiced as it appears (sfx/intro, played in lib/feedback.ts); the voice stops when
  // the next one starts, or when he's gone — skipped, or into the arena.
  const voiced: IntroLine | null =
    lineKey === 'hello' ? 1 : lineKey === 'meet' ? 2 : lineKey === 'ask-age' ? 3 : lineKey === 'welcome' ? 4 : null;
  useEffect(() => {
    if (voiced) playIntroLine(voiced);
  }, [voiced]);
  useEffect(() => stopIntroLine, []);
  const typing = bubble != null && (step === 'hello' || step === 'meet' || step === 'ask-age' || step === 'welcome') && !typed;
  /** An answer card is up: he steps back a little to make room for it. */
  const answering = step === 'name' || step === 'age';
  // He offers his hand from the introduction on.
  const greeting = step != null && step !== 'hello';

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      // A tap finishes the line being typed; moving on is always the button's job, so nobody
      // loses a line they hadn't finished reading.
      onClick={() => {
        if (typing) setSkip(true);
      }}
    >
      {/* The same arena as the title, a little darker and softer behind him. */}
      <ArenaBackdrop dim />
      {/* Darker at the edges, so the eye goes to the middle where he'll stand. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 55%, transparent 30%, rgba(0,0,0,0.85) 100%)' }}
      />

      {/* The bottom gap is the safe area or 1.5rem, whichever is more: `safe-bottom` alongside
          `pb-6` silently won and left no gap at all in a browser tab, where the safe area is 0. */}
      <div className="safe-top absolute inset-0 flex flex-col items-center justify-end px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
                  durationMs={voiced ? introLineMs(voiced) : null}
                  skip={skip || step === 'name' || step === 'age'}
                  onDone={() => setTyped(true)}
                />
                {/* The tail points at him — not while the answer card sits in between. */}
                {!answering && (
                  <span className="absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-arena-amber/60 bg-arena-surface" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Your answer, right under his question: high on the screen, where the keyboard can't
            cover it, and read together with what he asked. */}
        <div className="relative z-10 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
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
                hint="Этот ник будет у тебя в игре — под ним тебя увидят в таблице лидеров."
                rule={`от ${NICK_MIN} до ${NICK_MAX} символов`}
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
                hint="Возраст ни на что не влияет — просто хочу знать, с кем имею дело."
                rule={`от ${AGE_MIN} до ${AGE_MAX}`}
                onSubmit={() => {
                  void saveIntroAbout({ nickname: name, age: ageNum });
                  go('welcome');
                }}
              />
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
          {/* A size smaller while you answer, to leave the room to the card. */}
          <motion.div
            className="relative"
            style={{ aspectRatio: '446 / 1100' }}
            initial={false}
            animate={{
              // dvh, not vh: on a phone vh is the height with the browser's bars hidden.
              height: answering ? 'min(36dvh, 360px)' : 'min(46dvh, 460px)',
              ...(calm ? {} : { scale: [1, 1.012, 1] }),
            }}
            transition={{
              height: { type: 'spring', stiffness: 220, damping: 30 },
              scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            }}
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

        {/* The way on, under him. */}
        <div className={`w-full max-w-sm ${answering ? 'h-6' : 'mt-4 min-h-[72px]'}`} onClick={(e) => e.stopPropagation()}>
          <AnimatePresence mode="wait">
            {step === 'hello' && typed && (
              // The entrance moves a wrapper: the button's own transform is its press.
              <motion.div
                key="next"
                className="mt-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              >
                <button onClick={() => go('meet')} className="btn-3d w-full">
                  Дальше
                </button>
              </motion.div>
            )}
            {step === 'welcome' && typed && (
              <motion.div
                key="go"
                className="mt-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              >
                <button
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    onFinish({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                  }}
                  className="btn-3d relative w-full overflow-hidden"
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
                </button>
              </motion.div>
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
  rule,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
  numeric?: boolean;
  ok: boolean;
  /** What the answer is for, said before it's typed. */
  hint: string;
  /** What counts as a valid answer. */
  rule: string;
  onSubmit: () => void;
}) {
  return (
    <motion.form
      className="mb-4 rounded-2xl border border-arena-amber/30 bg-black/65 p-3.5 backdrop-blur-md"
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
      <p className="mt-1 flex gap-1.5 text-xs leading-snug text-arena-text">
        <Info size={14} className="mt-px shrink-0 text-arena-amber" />
        {hint}
      </p>
      <div className="mt-2.5 flex gap-2">
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
        <button type="submit" disabled={!ok} className="btn-3d shrink-0 text-base">
          Дальше
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-arena-text-dim">{rule}</p>
    </motion.form>
  );
}
