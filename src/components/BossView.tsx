import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useReducedMotion } from 'framer-motion';
import type { ProfileRecord, RepResult, RepUndo, ToastKind } from '../types';
import type { useProfile } from '../hooks/useProfile';
import type { Feedback } from '../hooks/useFeedback';
import { ACHIEVEMENTS } from '../data/achievements';
import { BOSSES, stageProgressLabel, type BossDef } from '../data/bosses';
import { abilityName, describeAbility, hasAbility } from '../data/abilities';
import { BossIcon } from './BossIcon';
import { BossTalk } from './BossTalk';
import { BossBriefing, markBriefed, wasBriefed } from './BossBriefing';
import { AbilityStamp, AbilityStatus, FrostOverlay } from './AbilityFx';
import type { AbilityEvent } from '../data/combat';
import { BossIntro } from './BossIntro';
import { BOSS_INTRO_SEC } from '../lib/bossCut';
import { EnemyIcon } from './EnemyIcon';
import { StagePath } from './StagePath';
import { Heartbeat, PulseTrace } from './Heartbeat';
import { BOSS_HEARTS, MINION_HEARTS } from '../lib/vitals';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { CameraPanel } from './CameraPanel';
import { Camera, Search, Zap } from 'lucide-react';
import clsx from 'clsx';
import { HintCard } from './HintCard';
import { useHint } from '../lib/hints';
import { streakNotices } from '../lib/streak';
import { bossLineLevel, preloadBossCues } from '../lib/feedback';

type Derived = NonNullable<ReturnType<typeof useProfile>['derived']>;

interface DamagePop {
  id: number;
  text: string;
  crit: boolean;
}

let popId = 0;

/** Height over width for the fight artwork — the sheets are cut as portraits. */
const ART_RATIO = 1.12;

/**
 * Everything on the fight screen that isn't the artwork: the stage path, the pulse, the health
 * bar, the mode switch and the counter. Measured, not guessed — the figure is sized from
 * whatever is left, because a laptop at 800px tall has *less* room than a phone, and a fixed
 * size pushed the plus button below the fold there.
 */
// Measured with the hand counter below, the shorter of the two: the stage card, the pulse, the
// health bar, the mode switch, the counter and the tab bar, with a little to spare. The camera
// panel is taller, so in camera mode the page scrolls a little — the boss stays on screen,
// which is what you look at from the floor.
const CHROME_PX = 432;
const ART_MIN = 180;
/** The name and the line under it (the title, with the boss's ability chips), below the picture. */
const NAME_PX = 62;
/**
 * The widest the fight artwork is shown, width over height. The sheets are wide scenes with the
 * figure in the middle; trimming their sides makes the figure itself bigger on a phone.
 */
const ART_MAX_SHAPE = 1.15;

export function BossView({
  profile,
  derived,
  registerBossRep,
  revertRep,
  tickArena,
  feedback,
  notify,
  endReplay,
}: {
  profile: ProfileRecord;
  derived: Derived;
  registerBossRep: () => Promise<RepResult>;
  revertRep: (u: RepUndo) => Promise<void>;
  tickArena: () => Promise<number>;
  feedback: Feedback;
  notify: (kind: ToastKind, title: string, description?: string) => void;
  /** Leaves a rematch; the real progress comes back. */
  endReplay: () => Promise<void>;
}) {
  const [pops, setPops] = useState<DamagePop[]>([]);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<'win' | 'scream' | null>(null);
  /** The ability moment on screen right now, if any — see AbilityFx. */
  const [stamp, setStamp] = useState<{ id: number; event: AbilityEvent } | null>(null);
  /**
   * The scouting report on this stage's boss. Every time the third minion falls — beaten before
   * or not, on a replay too — the boss walks out first (the "BOSS" cut, the call, his line) and
   * the report comes up once he's said his piece. Also on request from the stage card, and once
   * on its own if you land on a boss some other way (below).
   */
  const [briefing, setBriefing] = useState(false);
  /** A report waiting for the boss to finish his entrance. */
  const briefAfterEntrance = useRef(false);
  // Arriving some other way — a reload, a jump from the dev panel — there's no entrance to wait
  // for, so the report just comes up on its own. Checked when the timer fires: the new boss can
  // show up a moment before the rep that brought him has flagged his entrance.
  const bossUp = !derived.allBossesDefeated && derived.enemy.isBoss;
  // His entrance cues, fetched while you're still on his minions — and again after the first tap
  // of a session, which is when audio becomes available at all.
  useEffect(() => {
    preloadBossCues(derived.boss.line);
    const again = () => preloadBossCues(derived.boss.line);
    window.addEventListener('pointerdown', again, { once: true });
    return () => window.removeEventListener('pointerdown', again);
  }, [derived.boss.line]);
  useEffect(() => {
    if (!bossUp || wasBriefed(derived.boss.id)) return;
    const id = window.setTimeout(() => {
      if (!briefAfterEntrance.current) setBriefing(true);
    }, 600);
    return () => window.clearTimeout(id);
  }, [bossUp, derived.boss.id]);
  const closeBriefing = () => {
    markBriefed(derived.boss.id);
    setBriefing(false);
  };
  const [impact, setImpact] = useState<'hit' | 'crit' | null>(null);
  /** The dark-and-"BOSS" cut, shown once the third minion falls. */
  const [bossIntro, setBossIntro] = useState(false);
  /** Which ability chip under the boss's name has its description open. */
  const [openAbility, setOpenAbility] = useState<string | null>(null);
  // A new boss closes whatever the last one had open.
  useEffect(() => setOpenAbility(null), [derived.boss.id]);
  const enemyControls = useAnimationControls();
  const calm = useReducedMotion();
  /**
   * The boss "talking": the loudness of his line, read every frame while it plays, for
   * `BossTalk` to move him with — so he moves with what he actually says, pauses included.
   */
  const talk = useMotionValue(0);
  const [talking, setTalking] = useState(false);
  useEffect(() => {
    if (!talking || calm) return;
    let raf = 0;
    let smooth = 0;
    let started = false;
    const since = performance.now();
    const tick = () => {
      const level = bossLineLevel();
      if (level === null) {
        // Null is either "finished" or "not scheduled yet" — the file can still be loading
        // when the boss walks out. Before it has started, give it a few seconds; after, settle
        // back to rest and stop.
        smooth *= 0.85;
        talk.set(smooth);
        const gaveUp = !started && performance.now() - since > 5000;
        if ((started && smooth < 0.01) || gaveUp) {
          talk.set(0);
          setTalking(false);
          return;
        }
      } else {
        if (level > 0) started = true;
        // Quick to rise, slower to fall — how a mouth looks, more or less.
        smooth += (level - smooth) * (level > smooth ? 0.5 : 0.15);
        talk.set(smooth);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      talk.set(0);
    };
  }, [talking, calm, talk]);
  const [fightHint, dismissFightHint] = useHint('fight');
  const wide = useMediaQuery('(min-width: 768px)');

  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined'
      ? { h: 800, w: 390 }
      : { h: window.innerHeight, w: window.innerWidth },
  );
  useEffect(() => {
    const onResize = () => setViewport({ h: window.innerHeight, w: window.innerWidth });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // The name and the title line sit under the picture, so they come out of the height the
  // picture may take.
  const namePx = NAME_PX;
  const artWidth = Math.max(
    ART_MIN,
    Math.round(Math.min(wide ? 420 : 320, (viewport.h - CHROME_PX - namePx) / ART_RATIO)),
  );
  /**
   * How wide the artwork is allowed to get when the picture itself is a wide one. The column
   * minus its gutters — a landscape illustration held to the portrait width would be shrunk
   * for no reason, since its height is what's cheap.
   */
  // Edge to edge on a phone: the picture's own edges are feathered into the background, so it
  // needs no gutter of its own.
  const artRoom = Math.min(viewport.w, wide ? 560 : 400);
  // A stack, not a single slot: you can add ten reps by hand, so you must be able to take ten
  // back. The old single-slot version undid exactly one press and then silently did nothing.
  const undoStackRef = useRef<RepUndo[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const busyRef = useRef(false);

  const boss = derived.boss;
  const enemy = derived.enemy;
  const regenerating = enemy.isBoss && hasAbility(boss.abilities, 'regen');
  const hpPct = Math.max(0, Math.min(100, (profile.enemyHp / Math.max(1, enemy.hp)) * 100));

  // A regenerating boss heals on the clock, so it has to be driven while you rest — waiting for
  // your next rep would leave the bar frozen exactly when the pressure should be visible.
  useEffect(() => {
    if (!regenerating) return;
    const id = window.setInterval(() => {
      void tickArena().then((healed) => {
        if (healed > 0) addPop(`+${healed} HP`, true);
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenerating, tickArena]);

  const addPop = (text: string, crit: boolean) => {
    const id = ++popId;
    setPops((p) => [...p, { id, text, crit }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  };

  const handleRep = async () => {
    if (busyRef.current || derived.allBossesDefeated) return;
    busyRef.current = true;
    try {
      const result = await registerBossRep();
      undoStackRef.current.push(result.undo);
      setUndoDepth(undoStackRef.current.length);
      // One cue per rep, picked by significance. Firing them all meant the rep that reached a
      // boss played the plain beep, the announcement and the level-up chime on top of each
      // other — three sounds for one event, which just reads as noise.
      if (result.bossReached) {
        playEntrance(boss.line);
        // First time against him: the scouting report once he's done talking.
        // Every time he walks out — the first time, again after a loss of the thread, on a replay.
        briefAfterEntrance.current = true;
      } else if (result.bossDefeated || result.bossRebeaten || result.minionDefeated) feedback.bossDefeat();
      else if (result.leveledUp) feedback.levelUp();
      // The named cue belongs to the boss himself, not to the three who come first. `enemy`
      // is read from before the rep landed, which is the one being hit — after it, a killing
      // blow would already have moved on to the next.
      else feedback.rep(result.isCrit, enemy.isBoss ? boss.hitSound : undefined);

      // A rep that lands for nothing has to say why, or the counter looks broken.
      const BLOCKED_TEXT = {
        'blind-spot': 'СЛЕПАЯ ЗОНА',
        'odd-rep': 'НЕ В СЧЁТ',
        'last-stand': 'НЕ УМИРАЕТ!',
        fee: '🪙 В КАССУ!',
        piggy: '🐷 ХРЮК! В КОПИЛКУ',
        frozen: '❄ ЗАМОРОЖЕН',
        slacking: 'НЕ ОТЛЫНИВАЙ!',
        joke: '🃏 ХА-ХА, ШУТКА!',
      } as const;
      if (result.blocked) addPop(BLOCKED_TEXT[result.blocked], false);
      else addPop(result.isCrit ? `-${result.damage} КРИТ!` : `-${result.damage}`, result.isCrit);
      if (result.healed > 0) addPop(`+${result.healed} HP`, true);
      if (result.revived) notify('info', 'Он поднялся', 'Зеркало вернуло его с половиной HP');
      playAbilityEvents(result.events);
      setShake(true);
      window.setTimeout(() => setShake(false), 220);

      // The enemy itself recoils, and harder on a crit. Shaking only the card made the hit feel
      // like it landed on the interface rather than on him.
      void enemyControls.start({
        scale: result.isCrit ? [1, 0.84, 1.08, 1] : [1, 0.93, 1.02, 1],
        rotate: result.isCrit ? [0, -7, 5, 0] : [0, -3, 2, 0],
        transition: { duration: result.isCrit ? 0.4 : 0.28, ease: 'easeOut' },
      });
      if (!result.blocked) {
        setImpact(result.isCrit ? 'crit' : 'hit');
        window.setTimeout(() => setImpact(null), result.isCrit ? 320 : 200);
      }

      if (result.replayWon) {
        setFlash('win');
        window.setTimeout(() => setFlash(null), 900);
        notify('boss-defeat', `${result.enemyName} повержен снова!`, 'Ты догнал свой прогресс — дальше как было');
      } else if (result.bossRebeaten) {
        setFlash('win');
        window.setTimeout(() => setFlash(null), 900);
        notify('boss-defeat', `${result.enemyName} повержен снова!`, 'Дальше — следующий этап');
      } else if (result.bossDefeated) {
        setFlash('win');
        window.setTimeout(() => setFlash(null), 900);
        notify('boss-defeat', `${result.enemyName} повержен!`, 'Этап пройден — впереди новый');
      } else if (result.minionDefeated) {
        setFlash('win');
        window.setTimeout(() => setFlash(null), 600);
        notify('boss-defeat', `${result.enemyName} повержен!`, 'Следующий уже ждёт');
      }
      if (result.leveledUp) notify('level-up', `Новый уровень: ${result.newLevel}`);
      for (const [title, desc] of streakNotices(result)) notify('info', title, desc);
      if (result.weeklyBonus > 0) notify('record', 'Цель недели выполнена!', `+${result.weeklyBonus} XP`);
      for (const id of result.newAchievements) {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) notify('achievement', `Достижение: ${def.title}`, def.description);
      }
    } finally {
      busyRef.current = false;
    }
  };

  /**
   * Plays out the moments a rep's abilities set off. The most important one gets the stamp —
   * a scream beats a crystal beats the rest — and a few get a move of the boss's own on top.
   */
  const playAbilityEvents = (events: AbilityEvent[]) => {
    if (!events.length) return;
    const ORDER: AbilityEvent[] = ['scream', 'scream-burned', 'scream-survived', 'crystal', 'retreat', 'frozen', 'covered'];
    const top = ORDER.find((e) => events.includes(e)) ?? events[0];
    const id = ++popId;
    setStamp({ id, event: top });
    window.setTimeout(() => setStamp((cur) => (cur?.id === id ? null : cur)), 1300);

    if (events.includes('scream')) {
      // The jump-scare: a white-to-red flash, and Freddy lunging at the screen.
      setFlash('scream');
      window.setTimeout(() => setFlash(null), 700);
      void enemyControls.start({
        scale: [1, 1.55, 1.4, 1],
        rotate: [0, -4, 4, -3, 0],
        transition: { duration: 0.7, ease: 'easeOut' },
      });
    } else if (events.includes('retreat')) {
      // Skipper falls back, then steps in again patched up.
      void enemyControls.start({
        x: [0, 60, 60, 0],
        scale: [1, 0.8, 0.8, 1],
        opacity: [1, 0.5, 0.5, 1],
        transition: { duration: 1, times: [0, 0.3, 0.7, 1] },
      });
    } else if (events.includes('crystal')) {
      void enemyControls.start({
        scale: [1, 0.9, 1.06, 1],
        filter: ['brightness(1)', 'brightness(2.2)', 'brightness(1)'],
        transition: { duration: 0.5 },
      });
    } else if (events.includes('frozen')) {
      void enemyControls.start({
        filter: ['hue-rotate(0deg) brightness(1)', 'hue-rotate(160deg) brightness(1.6)', 'hue-rotate(0deg) brightness(1)'],
        transition: { duration: 0.8 },
      });
    }
  };

  /** The boss walks out: the "BOSS" cut, the call, and his line if he has one. */
  const playEntrance = (line: BossDef['line']) => {
    feedback.bossEncounter(line);
    if (line) setTalking(true);
    // The cut to the boss. Cleared on a timer rather than by the animation, so a tab
    // backgrounded mid-flourish can't leave the veil hanging over the fight.
    setBossIntro(true);
    window.setTimeout(() => setBossIntro(false), BOSS_INTRO_SEC * 1000);
  };

  // The report comes once the cut has cleared and he's finished talking — never over his line,
  // however long it runs. (A boss with no line never starts talking, and a line that can't play
  // gives up within seconds; under reduced motion nothing tracks the talking, so the cut alone
  // decides.)
  useEffect(() => {
    if (bossIntro || (talking && !calm) || !briefAfterEntrance.current) return;
    const id = window.setTimeout(() => {
      if (!briefAfterEntrance.current) return;
      briefAfterEntrance.current = false;
      setBriefing(true);
    }, 400);
    return () => window.clearTimeout(id);
  }, [bossIntro, talking, calm]);

  const handleUndo = async () => {
    if (busyRef.current) return;
    const last = undoStackRef.current.pop();
    setUndoDepth(undoStackRef.current.length);
    if (!last) return;
    busyRef.current = true;
    try {
      await revertRep(last);
    } finally {
      busyRef.current = false;
    }
  };

  if (derived.allBossesDefeated) {
    return (
      <div className="arena-page flex flex-col items-center pb-8 pt-16 text-center">
        <h1 className="mt-3 text-xl font-bold text-arena-text">Все боссы арены повержены</h1>
        <p className="mt-2 text-sm text-arena-text-dim">
          Ты прошёл всех {BOSSES.length} противников. Заходи в Speed Rush, чтобы продолжать качаться и бить рекорды.
        </p>
      </div>
    );
  }

  return (
    <div className="arena-page pb-8 pt-6">
      {/* A rematch says so, with the way out: the real progress waits until he falls or you leave. */}
      {derived.replaying && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-arena-amber/50 bg-arena-amber/10 px-3 py-2"
        >
          <span className="text-xs leading-snug text-arena-text">
            <b className="text-arena-amber">Перепрохождение</b> · твой этап {(profile.replay?.returnTo.currentBossIndex ?? 0) + 1}{' '}
            ждёт впереди
          </span>
          <button
            onClick={() => void endReplay()}
            className="shrink-0 rounded-lg bg-arena-surface-2 px-2.5 py-1 text-[11px] font-semibold text-arena-text active:scale-95"
          >
            Выйти
          </button>
        </motion.div>
      )}

      {/* Where you are, written into the card's top edge rather than on a line of its own —
          every line saved here goes to the artwork. */}
      <div className="relative mb-2 mt-1 rounded-2xl border border-arena-border bg-arena-surface px-3 pb-1.5 pt-2.5">
        <div className="absolute inset-x-3 -top-2 flex justify-between text-[10px] leading-4 text-arena-text-dim">
          {/* Doubles as the way back into the scouting report. */}
          <button
            type="button"
            onClick={() => setBriefing(true)}
            className="pointer-events-auto flex items-center gap-1 rounded bg-arena-bg px-1.5 font-semibold text-arena-amber active:scale-95"
          >
            Этап {derived.bossIndex + 1} / {BOSSES.length} · <Search size={10} /> разведка
          </button>
          <span className="rounded bg-arena-bg px-1.5">{stageProgressLabel(derived.stageStep)}</span>
        </div>
        <StagePath boss={boss} step={derived.stageStep} color={boss.color} />
      </div>

      {/*
        No frame. The enemy is the screen, not an illustration inside a box — the card that used
        to hold him capped how large he could be and clipped him at its own edges.
      */}
      <motion.div
        animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.22 }}
        className="relative mb-2 text-center"
      >
        {/* Soft washes rather than filled rectangles: with the box gone there are no edges for
            a solid colour to sit inside, so they bloom from the middle instead. */}
        {flash === 'scream' && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 0.9, 0], backgroundColor: ['#ffffff', '#ef4444', '#7f1d1d'] }}
            transition={{ duration: 0.7, times: [0, 0.25, 1] }}
            className="pointer-events-none fixed inset-0 z-40"
          />
        )}
        <AbilityStamp stamp={stamp} />
        {flash === 'win' && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="pointer-events-none absolute inset-0 z-10"
            style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(245,158,11,0.85), transparent 68%)' }}
          />
        )}
        <AnimatePresence>
          {impact && (
            <motion.div
              key={impact}
              initial={{ opacity: impact === 'crit' ? 0.5 : 0.24 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: impact === 'crit' ? 0.32 : 0.2 }}
              className="pointer-events-none absolute inset-0 z-10"
              style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(239,68,68,0.9), transparent 66%)' }}
            />
          )}
        </AnimatePresence>

        {/* Keyed by enemy: the one you just killed shrinks away before the next walks in. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={enemy.name}
            initial={{ opacity: 0, scale: 0.86, x: 30 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: 10, y: 16 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative flex flex-col items-center"
          >
            {enemy.isBoss && <AbilityStatus boss={boss} fight={profile.fight} />}
            <motion.div animate={enemyControls}>
              {enemy.isBoss ? (
                <BossTalk talk={talk} active={talking} color={boss.color}>
                  <BossIcon
                    boss={boss}
                    index={derived.bossIndex}
                    size={artWidth}
                    maxWidth={artRoom}
                    ratio={ART_RATIO}
                    maxShape={ART_MAX_SHAPE}
                    hug
                    bare
                  />
                </BossTalk>
              ) : (
                <EnemyIcon
                  file={enemy.icon}
                  color={boss.color}
                  tier={derived.stageStep * 0.18}
                  size={Math.round(artWidth * 0.92)}
                  maxWidth={Math.round(artRoom * 0.92)}
                  ratio={ART_RATIO}
                  maxShape={ART_MAX_SHAPE}
                  hug
                  bare
                />
              )}
            </motion.div>

            {/* Under the picture, not over it: laid on top, the name and its scrim hid the
                bottom of the artwork. */}
            <div className="pointer-events-none relative mt-1 flex flex-col items-center text-center">
              <div className="relative flex items-center gap-2.5">
                <h2 className="text-3xl font-black leading-none text-arena-text md:text-4xl">
                  {enemy.name}
                </h2>
                <Heartbeat
                  pct={hpPct}
                  size={wide ? 26 : 21}
                  hearts={enemy.isBoss ? BOSS_HEARTS : MINION_HEARTS}
                />
              </div>
              {/* The title, and the boss's abilities as chips on the same line — a line of
                  their own each ate into the picture. Tap a chip for what it does. */}
              <div className="relative mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-2">
                <p className="text-xs leading-snug text-arena-text-dim md:text-sm">
                  {enemy.isBoss ? boss.title : `подчинённый ${boss.nameGenitive}`}
                </p>
                {enemy.isBoss &&
                  boss.abilities.map((a) => (
                    <button
                      key={a.kind}
                      type="button"
                      onClick={() => setOpenAbility((k) => (k === a.kind ? null : a.kind))}
                      aria-expanded={openAbility === a.kind}
                      className={clsx(
                        'pointer-events-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight',
                        openAbility === a.kind
                          ? 'border-arena-amber bg-arena-amber/15 text-arena-amber'
                          : 'border-arena-amber/40 text-arena-amber',
                      )}
                    >
                      <Zap size={10} />
                      {abilityName(a)}
                    </button>
                  ))}
              </div>
              <AnimatePresence>
                {enemy.isBoss && openAbility && (
                  <motion.div
                    key={openAbility}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="pointer-events-auto absolute inset-x-4 top-full z-20 mt-1 rounded-xl border border-arena-amber/40 bg-arena-surface px-3 py-2 text-[11px] leading-snug text-arena-text shadow-lg"
                    onClick={() => setOpenAbility(null)}
                  >
                    {boss.abilities
                      .filter((a) => a.kind === openAbility)
                      .map((a) => (
                        <span key={a.kind}>
                          <b className="text-arena-amber">{abilityName(a)}</b> — {describeAbility(a)}
                        </span>
                      ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-1">
          <PulseTrace pct={hpPct} className="h-7" />
        </div>

        <div className="relative mt-0.5 h-4 overflow-hidden rounded-full bg-arena-surface-2">
          <motion.div
            className="h-full rounded-full bg-arena-red"
            animate={{ width: `${hpPct}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          />
          {/* Under a quarter left the bar breathes — the moment you should push harder is the
              one moment the screen shouldn't be still. */}
          {hpPct > 0 && hpPct <= 25 && (
            <motion.div
              animate={{ opacity: [0, 0.55, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-0 rounded-full bg-arena-red blur-[3px]"
            />
          )}
        </div>
        <p className="mt-1 text-xs tabular-nums text-arena-text-dim">
          {profile.enemyHp} / {enemy.hp} HP
        </p>

        <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2">
          <AnimatePresence>
            {pops.map((p) => (
              <motion.span
                key={p.id}
                initial={{ opacity: 0, y: 0, scale: p.crit ? 0.5 : 0.8 }}
                animate={{
                  opacity: 1,
                  y: -40,
                  // A crit overshoots before settling, so it punches above the ordinary rep.
                  scale: p.crit ? [0.5, 1.7, 1.35] : 1,
                }}
                exit={{ opacity: 0, y: -60 }}
                transition={{ duration: 0.8 }}
                className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-extrabold ${
                  p.crit ? 'text-arena-red' : 'text-arena-text'
                }`}
                // Plain damage numbers wear your title's colour — one of the things a rank is for.
                style={
                  !p.crit && p.text.startsWith('-')
                    ? { color: derived.rank.color, textShadow: `0 0 8px ${derived.rank.color}88` }
                    : undefined
                }
              >
                {p.text}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Gru's ray: the edges of the screen ice over while reps are frozen. */}
      <FrostOverlay active={enemy.isBoss && (profile.fight.frozenLeft ?? 0) > 0} />

      <CameraPanel onRep={handleRep} onUndo={handleUndo} canUndo={undoDepth > 0} feedback={feedback} />

      {/* Floats over the top of the screen rather than taking a place in the layout: the fight
          screen is sized to fit a phone exactly, so a card in the flow would either push the
          counter off the bottom or sit below the fold where a newcomer never scrolls. */}
      <AnimatePresence>
        {fightHint && (
          <div className="safe-top arena-page fixed inset-x-0 top-0 z-30 pt-3">
            <HintCard icon={<Camera size={16} />} title="Как бить" onClose={dismissFightHint}>
              <p>
                Нажми <b className="text-arena-text">«Камера (AI)»</b>, поставь телефон на пол сбоку
                от себя, чтобы в кадр попадал ты целиком, — и отжимайся. Каждый повтор — удар.
              </p>
              <p className="mt-1">
                «+» — только кликер: считает нажатия, но босса не бьёт.
              </p>
            </HintCard>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {briefing && <BossBriefing key="briefing" boss={boss} index={derived.bossIndex} onClose={closeBriefing} />}
      </AnimatePresence>

      <AnimatePresence>
        {bossIntro && (
          <BossIntro
            key="boss-intro"
            boss={boss}
            index={derived.bossIndex}
            // Bigger than the fight screen's artwork, and bigger on a phone than it used to
            // be: stacked under the name there is a whole empty half-screen below it, and the
            // figure is the thing the cut is announcing. Still a share of the width rather
            // than a flat number, so a narrow phone does not get a picture wider than itself.
            // The height is a limit too, and only starts to bite on a short window: stacked
            // under the name on a phone, or beside the word on a laptop turned landscape,
            // a figure sized from the width alone runs off the top and bottom of the screen.
            size={Math.min(
              wide ? 440 : 320,
              Math.round(viewport.w * (wide ? 0.46 : 0.84)),
              Math.round(viewport.h * (wide ? 0.62 : 0.46)),
            )}
            wide={wide}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
