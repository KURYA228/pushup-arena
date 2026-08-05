import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProfileRecord, RepResult, ToastKind } from '../types';
import type { useProfile } from '../hooks/useProfile';
import { ACHIEVEMENTS } from '../data/achievements';
import { BOSSES } from '../data/bosses';
import { BossIcon } from './BossIcon';
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
  revertBossRep,
  notify,
}: {
  profile: ProfileRecord;
  derived: Derived;
  registerBossRep: () => Promise<RepResult>;
  revertBossRep: (r: RepResult) => Promise<void>;
  notify: (kind: ToastKind, title: string, description?: string) => void;
}) {
  const [pops, setPops] = useState<DamagePop[]>([]);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<'win' | null>(null);
  const lastResultRef = useRef<RepResult | null>(null);
  const busyRef = useRef(false);

  const boss = derived.boss;
  const hpPct = Math.max(0, Math.min(100, (profile.bossHp / boss.hp) * 100));

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
      lastResultRef.current = result;
      addPop(result.isCrit ? `-${result.damage} КРИТ!` : `-${result.damage}`, result.isCrit);
      setShake(true);
      window.setTimeout(() => setShake(false), 220);

      if (result.bossDefeated) {
        setFlash('win');
        window.setTimeout(() => setFlash(null), 900);
        notify('boss-defeat', `${boss.name} повержен!`, 'Открыт следующий противник');
      }
      if (result.leveledUp) {
        notify('level-up', `Новый уровень: ${result.newLevel}`);
      }
      for (const id of result.newAchievements) {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) notify('achievement', `Достижение: ${def.title}`, def.description);
      }
    } finally {
      busyRef.current = false;
    }
  };

  const handleUndo = async () => {
    const last = lastResultRef.current;
    if (!last) return;
    await revertBossRep(last);
    lastResultRef.current = null;
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
          Босс {derived.bossIndex + 1} / {BOSSES.length}
        </span>
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
          <BossIcon boss={boss} index={derived.bossIndex} size={92} />
          <div className="text-left">
            <h2 className="mt-2 text-lg font-bold leading-tight text-arena-text">{boss.name}</h2>
            <p className="text-xs text-arena-text-dim">{boss.title}</p>
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
          {profile.bossHp} / {boss.hp} HP
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

      <CameraPanel onRep={handleRep} onUndo={handleUndo} />
    </div>
  );
}
