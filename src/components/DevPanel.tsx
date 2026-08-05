import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ProfileRecord } from '../types';
import { BOSSES } from '../data/bosses';
import { ACHIEVEMENTS } from '../data/achievements';
import { totalXpForLevel } from '../data/leveling';
import { BossIcon } from './BossIcon';

/**
 * Debug controls for jumping around the game state without grinding reps. Writes go through the
 * same Dexie handle the app uses, so the UI updates live — poking IndexedDB directly would need
 * a reload before `useLiveQuery` noticed.
 */
export function DevPanel({
  profile,
  patch,
  reset,
  onClose,
}: {
  profile: ProfileRecord;
  patch: (p: Partial<ProfileRecord>) => Promise<void>;
  reset: () => Promise<void>;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const level = (() => {
    // Cheap inverse lookup for display: find the level whose XP floor the profile sits above.
    let l = 1;
    while (l < 300 && totalXpForLevel(l + 1) <= profile.totalXp) l += 1;
    return l;
  })();

  /** Jumping to boss N implies you got there honestly — mark everything before it as defeated. */
  const jumpToBoss = (index: number) =>
    void patch({
      currentBossIndex: index,
      bossHp: BOSSES[index].hp,
      bossesDefeated: BOSSES.slice(0, index).map((b) => b.id),
    });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="safe-top safe-x fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Дев-панель"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-full w-full max-w-sm overflow-y-auto rounded-3xl border border-arena-amber/40 bg-arena-surface p-4"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 rounded-full bg-arena-surface-2 p-2 text-arena-text-dim active:scale-95"
        >
          <X size={16} />
        </button>

        <p className="text-[11px] font-semibold uppercase tracking-widest text-arena-amber">Дев-панель</p>
        <p className="mb-3 text-[11px] text-arena-text-dim">
          Пишет в профиль напрямую, минуя правила игры.
        </p>

        <Group title={`Босс — сейчас ${profile.currentBossIndex + 1} из ${BOSSES.length}`}>
          <div className="grid grid-cols-4 gap-1.5">
            {BOSSES.map((boss, i) => (
              <button
                key={boss.id}
                onClick={() => jumpToBoss(i)}
                aria-label={`Перейти к боссу ${boss.name}`}
                className={`flex flex-col items-center rounded-lg border py-1.5 ${
                  i === profile.currentBossIndex
                    ? 'border-arena-amber/60 bg-arena-surface-2'
                    : 'border-arena-border bg-arena-surface'
                }`}
              >
                <BossIcon boss={boss} index={i} size={26} />
                <span className="mt-0.5 text-[9px] text-arena-text-dim">{i + 1}</span>
              </button>
            ))}
          </div>
          <Row>
            <Action onClick={() => void patch({ bossHp: BOSSES[profile.currentBossIndex].baseDamage })}>
              Оставить 1 удар
            </Action>
            <Action onClick={() => void patch({ bossHp: BOSSES[profile.currentBossIndex].hp })}>
              Полное HP
            </Action>
          </Row>
        </Group>

        <Group title={`Уровень — сейчас ${level}`}>
          <NumberField
            label="перейти на уровень"
            value={level}
            min={1}
            max={300}
            onApply={(v) => void patch({ totalXp: totalXpForLevel(v) })}
          />
        </Group>

        <Group title="Счётчики">
          <NumberField
            label="всего отжиманий"
            value={profile.totalPushups}
            min={0}
            max={999999}
            onApply={(v) => void patch({ totalPushups: v })}
          />
          <NumberField
            label="стрик, дней"
            value={profile.streak}
            min={0}
            max={9999}
            onApply={(v) =>
              void patch({ streak: v, lastWorkoutDate: v > 0 ? new Date().toISOString().slice(0, 10) : null })
            }
          />
          <NumberField
            label="рекорд Rush"
            value={profile.rushBestReps}
            min={0}
            max={9999}
            onApply={(v) => void patch({ rushBestReps: v })}
          />
        </Group>

        <Group title={`Достижения — ${profile.achievementsUnlocked.length} из ${ACHIEVEMENTS.length}`}>
          <Row>
            <Action onClick={() => void patch({ achievementsUnlocked: ACHIEVEMENTS.map((a) => a.id) })}>
              Открыть все
            </Action>
            <Action onClick={() => void patch({ achievementsUnlocked: [] })}>Закрыть все</Action>
          </Row>
        </Group>

        <Group title="Опасное">
          <button
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              void reset();
              setConfirmReset(false);
              onClose();
            }}
            onBlur={() => setConfirmReset(false)}
            className={`w-full rounded-lg px-3 py-2 text-xs font-semibold ${
              confirmReset ? 'bg-arena-red text-white' : 'bg-arena-surface-2 text-arena-red'
            }`}
          >
            {confirmReset ? 'Точно стереть весь прогресс?' : 'Сбросить профиль'}
          </button>
        </Group>
      </motion.div>
    </motion.div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-2xl border border-arena-border bg-arena-surface-2/50 p-3">
      <p className="mb-2 text-[11px] font-medium text-arena-text">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>;
}

function Action({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-lg bg-arena-surface-2 px-2 py-1.5 text-[11px] font-medium text-arena-text active:scale-95"
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onApply,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onApply: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // Follow external changes (another control wrote the same field) unless mid-edit.
  const lastValue = useRef(value);
  if (lastValue.current !== value) {
    lastValue.current = value;
    if (draft !== String(value)) setDraft(String(value));
  }

  const apply = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) return;
    onApply(Math.round(Math.min(max, Math.max(min, n))));
  };

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-[11px] text-arena-text-dim">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        className="w-20 rounded-lg border border-arena-border bg-arena-bg px-2 py-1 text-right text-xs tabular-nums text-arena-text"
      />
      <button
        onClick={apply}
        className="rounded-lg bg-arena-amber px-2.5 py-1 text-[11px] font-semibold text-black active:scale-95"
      >
        ОК
      </button>
    </div>
  );
}
