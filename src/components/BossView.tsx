import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import type { ProfileRecord, RepResult, RepUndo, ToastKind } from '../types';
import type { useProfile } from '../hooks/useProfile';
import type { Feedback } from '../hooks/useFeedback';
import { ACHIEVEMENTS } from '../data/achievements';
import { BOSSES, stageProgressLabel } from '../data/bosses';
import { abilityName, describeAbility, hasAbility } from '../data/abilities';
import { BossIcon } from './BossIcon';
import { BossIntro } from './BossIntro';
import { BOSS_INTRO_SEC } from '../lib/bossCut';
import { EnemyIcon } from './EnemyIcon';
import { StagePath } from './StagePath';
import { Heartbeat, PulseTrace } from './Heartbeat';
import { BOSS_HEARTS, MINION_HEARTS } from '../lib/vitals';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { CameraPanel } from './CameraPanel';
import { streakNotices } from '../lib/streak';

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
const CHROME_PX = 486;
const ART_MIN = 180;

export function BossView({
  profile,
  derived,
  registerBossRep,
  revertRep,
  tickArena,
  feedback,
  notify,
}: {
  profile: ProfileRecord;
  derived: Derived;
  registerBossRep: () => Promise<RepResult>;
  revertRep: (u: RepUndo) => Promise<void>;
  tickArena: () => Promise<number>;
  feedback: Feedback;
  notify: (kind: ToastKind, title: string, description?: string) => void;
}) {
  const [pops, setPops] = useState<DamagePop[]>([]);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<'win' | null>(null);
  const [impact, setImpact] = useState<'hit' | 'crit' | null>(null);
  /** The dark-and-"BOSS" cut, shown once the third minion falls. */
  const [bossIntro, setBossIntro] = useState(false);
  const enemyControls = useAnimationControls();
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
  const artWidth = Math.max(
    ART_MIN,
    Math.round(Math.min(wide ? 420 : 320, (viewport.h - CHROME_PX) / ART_RATIO)),
  );
  /**
   * How wide the artwork is allowed to get when the picture itself is a wide one. The column
   * minus its gutters — a landscape illustration held to the portrait width would be shrunk
   * for no reason, since its height is what's cheap.
   */
  const artRoom = Math.min(viewport.w - 32, wide ? 560 : 400);
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
        feedback.bossEncounter();
        // The cut to the boss. Cleared on a timer rather than by the animation, so a tab
        // backgrounded mid-flourish can't leave the veil hanging over the fight.
        setBossIntro(true);
        window.setTimeout(() => setBossIntro(false), BOSS_INTRO_SEC * 1000);
      } else if (result.bossDefeated || result.minionDefeated) feedback.bossDefeat();
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
      } as const;
      if (result.blocked) addPop(BLOCKED_TEXT[result.blocked], false);
      else addPop(result.isCrit ? `-${result.damage} КРИТ!` : `-${result.damage}`, result.isCrit);
      if (result.healed > 0) addPop(`+${result.healed} HP`, true);
      if (result.revived) notify('info', 'Он поднялся', 'Зеркало вернуло его с половиной HP');
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

      if (result.bossDefeated) {
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
      for (const id of result.newAchievements) {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) notify('achievement', `Достижение: ${def.title}`, def.description);
      }
    } finally {
      busyRef.current = false;
    }
  };

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
      <div className="mb-2 flex items-center justify-between text-xs text-arena-text-dim">
        <span>
          Этап {derived.bossIndex + 1} / {BOSSES.length}
        </span>
        <span>{stageProgressLabel(derived.stageStep)}</span>
      </div>

      <div className="mb-3 rounded-2xl border border-arena-border bg-arena-surface px-3 pb-2 pt-3">
        <StagePath boss={boss} step={derived.stageStep} color={boss.color} />
      </div>

      {/*
        No frame. The enemy is the screen, not an illustration inside a box — the card that used
        to hold him capped how large he could be and clipped him at its own edges.
      */}
      <motion.div
        animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.22 }}
        className="relative mb-3 mt-1 text-center"
      >
        {/* Soft washes rather than filled rectangles: with the box gone there are no edges for
            a solid colour to sit inside, so they bloom from the middle instead. */}
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
            className="relative flex justify-center"
          >
            <motion.div animate={enemyControls}>
              {enemy.isBoss ? (
                <BossIcon
                  boss={boss}
                  index={derived.bossIndex}
                  size={artWidth}
                  maxWidth={artRoom}
                  ratio={ART_RATIO}
                  bare
                />
              ) : (
                <EnemyIcon
                  file={enemy.icon}
                  color={boss.color}
                  tier={derived.stageStep * 0.18}
                  size={Math.round(artWidth * 0.92)}
                  maxWidth={Math.round(artRoom * 0.92)}
                  ratio={ART_RATIO}
                  bare
                />
              )}
            </motion.div>

            {/*
              The name sits on the figure's lower third, where these illustrations are darkest,
              with a scrim underneath it. Putting it below the picture instead would push the
              controls off a phone screen — the whole point of dropping the box was the room.
            */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-32"
                style={{ background: 'linear-gradient(to top, var(--color-arena-bg) 12%, transparent 100%)' }}
              />
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
              <p className="relative mt-1 text-xs leading-snug text-arena-text-dim md:text-sm">
                {enemy.isBoss ? boss.title : `подчинённый ${boss.nameGenitive}`}
              </p>
              {enemy.isBoss &&
                boss.abilities.map((a, i) => (
                  <motion.p
                    key={a.kind}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.07 }}
                    className="relative mt-0.5 px-4 text-[10px] leading-tight text-arena-amber"
                  >
                    {abilityName(a)} — {describeAbility(a)}
                  </motion.p>
                ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Clear of the name, which now hangs over the bottom of the picture. */}
        <div className="mt-3">
          <PulseTrace pct={hpPct} />
        </div>

        <div className="relative mt-1 h-4 overflow-hidden rounded-full bg-arena-surface-2">
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
              >
                {p.text}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      <CameraPanel onRep={handleRep} onUndo={handleUndo} canUndo={undoDepth > 0} feedback={feedback} />

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
