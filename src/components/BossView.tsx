import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProfileRecord, RepResult, RepUndo, ToastKind } from '../types';
import type { useProfile } from '../hooks/useProfile';
import type { Feedback } from '../hooks/useFeedback';
import { ACHIEVEMENTS } from '../data/achievements';
import { BOSSES, stageProgressLabel } from '../data/bosses';
import { abilityName, describeAbility, hasAbility } from '../data/abilities';
import { BossIcon } from './BossIcon';
import { EnemyIcon } from './EnemyIcon';
import { StagePath } from './StagePath';
import { CameraPanel } from './CameraPanel';

type Derived = NonNullable<ReturnType<typeof useProfile>['derived']>;

interface DamagePop {
  id: number;
  text: string;
  crit: boolean;
}

let popId = 0;

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
      if (result.bossReached) feedback.bossEncounter();
      else if (result.bossDefeated || result.minionDefeated) feedback.bossDefeat();
      else if (result.leveledUp) feedback.levelUp();
      else feedback.rep(result.isCrit);

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
      <div className="mx-auto flex max-w-md flex-col items-center px-4 pb-8 pt-16 text-center">
        <h1 className="mt-3 text-xl font-bold text-arena-text">Все боссы арены повержены</h1>
        <p className="mt-2 text-sm text-arena-text-dim">
          Ты прошёл всех {BOSSES.length} противников. Заходи в Speed Rush, чтобы продолжать качаться и бить рекорды.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-6">
      <div className="mb-2 flex items-center justify-between text-xs text-arena-text-dim">
        <span>
          Этап {derived.bossIndex + 1} / {BOSSES.length}
        </span>
        <span>{stageProgressLabel(derived.stageStep)}</span>
      </div>

      <div className="mb-3 rounded-2xl border border-arena-border bg-arena-surface px-3 pb-2 pt-3">
        <StagePath boss={boss} step={derived.stageStep} color={boss.color} />
      </div>

      <motion.div
        animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.22 }}
        className="relative mb-4 overflow-hidden rounded-2xl border border-arena-border bg-arena-surface p-5 text-center"
      >
        {flash === 'win' && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="pointer-events-none absolute inset-0 bg-arena-amber"
          />
        )}
        <div className="flex items-center justify-center gap-4">
          {/* Minions have their own art slot; until a file exists they fall back to a leaner
              silhouette in the stage's colour, which reads as "lesser version of the boss". */}
          {enemy.isBoss ? (
            <BossIcon boss={boss} index={derived.bossIndex} size={92} />
          ) : (
            <EnemyIcon
              file={enemy.icon}
              color={boss.color}
              tier={derived.stageStep * 0.18}
              size={78}
            />
          )}
          <div className="text-left">
            <h2 className="mt-2 text-lg font-bold leading-tight text-arena-text">{enemy.name}</h2>
            <p className="text-xs text-arena-text-dim">
              {enemy.isBoss ? boss.title : `подчинённый ${boss.nameGenitive}`}
            </p>
            {enemy.isBoss &&
              boss.abilities.map((a) => (
                <p key={a.kind} className="mt-1 text-[10px] leading-tight text-arena-amber">
                  {abilityName(a)} — {describeAbility(a)}
                </p>
              ))}
          </div>
        </div>

        <div className="relative mt-4 h-4 overflow-hidden rounded-full bg-arena-surface-2">
          <motion.div
            className="h-full rounded-full bg-arena-red"
            animate={{ width: `${hpPct}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          />
        </div>
        <p className="mt-1 text-xs tabular-nums text-arena-text-dim">
          {profile.enemyHp} / {enemy.hp} HP
        </p>

        <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2">
          <AnimatePresence>
            {pops.map((p) => (
              <motion.span
                key={p.id}
                initial={{ opacity: 0, y: 0, scale: 0.8 }}
                animate={{ opacity: 1, y: -40, scale: 1 }}
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
    </div>
  );
}
