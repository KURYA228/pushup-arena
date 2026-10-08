import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ProfileRecord } from '../types';
import { BOSSES, BOSS_STEP, encounterAt } from '../data/bosses';
import { freshFight } from '../data/combat';
import { ACHIEVEMENTS } from '../data/achievements';
import { totalXpForLevel } from '../data/leveling';
import { BossIcon } from './BossIcon';
import { MAX_FREEZES, freezesOf, todayLocal } from '../lib/streak';
import { setPlusCountsReps, usePlusCountsReps } from '../lib/devFlags';
import { UPGRADES, upgradeLevel } from '../data/shop';
import { cloudConfigured, isAdmin } from '../lib/cloud';
import { AdminPanel } from './AdminPanel';
import { db } from '../db/db';
import { useRepLog } from '../hooks/useRepLog';
import { repsThisWeek, repsToday, weekStart } from '../lib/weekly';

/** Local midnight today. */
const dayStart = (now: number) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
import { forgetIntro } from '../lib/intro';

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
  const plusCounts = usePlusCountsReps();
  const log = useRepLog();
  const ringToday = log ? repsToday(log, Date.now()) : 0;
  const ringWeek = log ? repsThisWeek(log, Date.now()) : 0;
  /** Drops this period's reps from the log, so the rings start that period empty again. */
  const clearReps = async (from: number, unpay = false) => {
    await db.reps.where('at').aboveOrEqual(from).delete();
    if (unpay) await patch({ weeklyRewardWeek: undefined });
  };
  const boughtLevels = UPGRADES.reduce((n, u) => n + upgradeLevel(profile.upgrades, u.id), 0);
  /** What every bought level cost, for handing the XP back. */
  const refund = UPGRADES.reduce(
    (sum, u) => sum + u.costs.slice(0, upgradeLevel(profile.upgrades, u.id)).reduce((a, c) => a + c, 0),
    0,
  );
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  /** The admin section exists only for accounts the database lists as admins. */
  const [admin, setAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  useEffect(() => {
    if (!cloudConfigured()) return;
    let alive = true;
    void isAdmin().then((yes) => alive && setAdmin(yes));
    return () => {
      alive = false;
    };
  }, []);

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

  /**
   * Jumping to stage N implies you got there honestly — mark everything before it as defeated.
   * The fight state has to be rebuilt too: it carries the enemy's max HP and the timestamps the
   * stateful abilities measure against, and leaving them pointing at the previous opponent
   * corrupts every rule that reads them.
   */
  const jumpToStage = (index: number, step: number) => {
    const hp = encounterAt(BOSSES[index], step).hp;
    void patch({
      currentBossIndex: index,
      stageStep: step,
      enemyHp: hp,
      fight: freshFight(hp),
      bossesDefeated: BOSSES.slice(0, index).map((b) => b.id),
    });
  };

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

        <Group
          title={`Этап ${profile.currentBossIndex + 1} из ${BOSSES.length}, шаг ${profile.stageStep + 1} из ${BOSS_STEP + 1}`}
        >
          <div className="grid grid-cols-4 gap-1.5">
            {BOSSES.map((boss, i) => (
              <button
                key={boss.id}
                onClick={() => jumpToStage(i, 0)}
                aria-label={`Перейти к этапу ${boss.name}`}
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
            {/* 1 HP, not baseDamage: armour makes a rep land for less than the base, so setting
                it to the base left the enemy alive on 1 HP and needing a second hit. */}
            <Action onClick={() => void patch({ enemyHp: 1 })}>Оставить 1 удар</Action>
            <Action onClick={() => jumpToStage(profile.currentBossIndex, BOSS_STEP)}>
              Сразу к боссу
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
            onApply={(v) => void patch({ streak: v, lastWorkoutDate: v > 0 ? todayLocal() : null })}
          />
          <NumberField
            label="заморозки стрика"
            value={freezesOf(profile)}
            min={0}
            max={MAX_FREEZES}
            onApply={(v) => void patch({ streakFreezes: v })}
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
          {/* Each one on its own: tap to open or take back. */}
          <div className="flex flex-wrap gap-1">
            {ACHIEVEMENTS.map((a) => {
              const on = profile.achievementsUnlocked.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() =>
                    void patch({
                      achievementsUnlocked: on
                        ? profile.achievementsUnlocked.filter((id) => id !== a.id)
                        : [...profile.achievementsUnlocked, a.id],
                    })
                  }
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium active:scale-95 ${
                    on ? 'bg-arena-amber/20 text-arena-amber' : 'bg-arena-surface-2 text-arena-text-dim'
                  }`}
                >
                  {a.emoji} {a.title}
                </button>
              );
            })}
          </div>
        </Group>

        <Group title={`Кольца — сегодня ${ringToday}, неделя ${ringWeek}`}>
          <Row>
            <Action onClick={() => void clearReps(dayStart(Date.now()))}>Обнулить день</Action>
            <Action onClick={() => void clearReps(weekStart(Date.now()), true)}>Обнулить неделю</Action>
          </Row>
          <Row>
            <Action
              onClick={() => void patch({ weeklyGoal: undefined, dailyGoal: undefined, weeklyRewardWeek: undefined })}
            >
              Нормы и награду — по умолчанию
            </Action>
          </Row>
          <p className="text-[10px] leading-snug text-arena-text-dim">
            Обнуление стирает отжимания за день или неделю из журнала — кольца, календарь и «Статы»
            это увидят; общий счёт и XP не трогает. «Неделя» заодно снимает отметку о выданной
            награде, чтобы её можно было получить снова.
          </p>
        </Group>

        <Group title={`Магазин — куплено уровней: ${boughtLevels}`}>
          <Row>
            <Action onClick={() => void patch({ upgrades: {} })}>Убрать покупки</Action>
            <Action onClick={() => void patch({ upgrades: {}, totalXp: profile.totalXp + refund })}>
              Убрать и вернуть {refund} XP
            </Action>
          </Row>
          <p className="text-[10px] leading-snug text-arena-text-dim">
            Сбрасывает улучшения. Заморозки стрика не трогает — купленные не отличить от
            заработанных, их число правится в «Счётчиках».
          </p>
        </Group>

        {admin && (
          <Group title="Админ">
            <button
              onClick={() => setAdminOpen(true)}
              className="w-full rounded-lg border border-arena-red/50 bg-arena-red/10 px-3 py-2 text-xs font-semibold text-arena-red active:scale-95"
            >
              Игроки и их прогресс
            </button>
          </Group>
        )}

        <Group title="Кнопка «+»">
          <Row>
            <Action onClick={() => setPlusCountsReps(false)}>
              {plusCounts ? 'Кликер' : '✓ Кликер'}
            </Action>
            <Action onClick={() => setPlusCountsReps(true)}>
              {plusCounts ? '✓ Отжимания' : 'Отжимания'}
            </Action>
          </Row>
          <p className="text-[10px] leading-snug text-arena-text-dim">
            {plusCounts
              ? '«+» бьёт босса, даёт XP и идёт в общий счёт — как отжимание с камеры. Только на этом устройстве.'
              : '«+» считает только нажатия в кликер и не влияет на игру.'}
          </p>
        </Group>

        <Group title="Интро">
          <button
            onClick={() => {
              forgetIntro();
              window.location.reload();
            }}
            className="w-full rounded-lg bg-arena-surface-2 px-3 py-2 text-xs font-medium text-arena-text active:scale-95"
          >
            Показать заново
          </button>
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
      <AnimatePresence>{adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}</AnimatePresence>
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
