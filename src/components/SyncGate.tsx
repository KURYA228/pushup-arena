import { useState } from 'react';
import { motion } from 'framer-motion';
import { Laptop, Cloud as CloudIcon } from 'lucide-react';
import type { ProfileRecord } from '../types';
import type { Cloud } from '../hooks/useCloud';
import { levelFromTotalXp } from '../data/leveling';
import { BOSSES } from '../data/bosses';

/**
 * The one question the app refuses to answer for you: two copies of your progress moved on
 * independently, and keeping one means losing the other.
 *
 * It stands in front of everything rather than sitting on the leaderboard tab, where the first
 * version of it lived. Nothing syncs while the question is open — so a question you don't
 * notice looks exactly like a feature that doesn't work, which is what happened.
 */
export function SyncGate({ cloud }: { cloud: Cloud }) {
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(false);
  const conflict = cloud.conflict;
  if (!conflict || later) return null;

  const run = (action: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="safe-top safe-x fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 px-4 py-8 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="w-full max-w-md rounded-2xl border border-arena-amber/40 bg-arena-surface p-5"
      >
        <h1 className="text-lg font-bold text-arena-text">Прогресс разошёлся</h1>
        <p className="mt-1.5 text-xs leading-snug text-arena-text-dim">
          На этом устройстве и в аккаунте записаны разные результаты — значит, занимались и тут,
          и там. Сложить их нельзя: этап боя это не число. Выбери, что оставить; вторая версия
          будет потеряна.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Side icon={<Laptop size={14} />} title="Здесь" profile={conflict.mine} />
          <Side icon={<CloudIcon size={14} />} title="В аккаунте" profile={conflict.theirs} accent />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={run(cloud.takeCloud)}
            className="arena-glow rounded-xl bg-arena-amber py-3 text-sm font-bold text-black active:scale-[0.98] disabled:opacity-50"
          >
            Взять из аккаунта
          </button>
          <button
            disabled={busy}
            onClick={run(cloud.keepLocal)}
            className="rounded-xl border border-arena-border bg-arena-surface-2 py-3 text-sm font-medium text-arena-text active:scale-[0.98] disabled:opacity-50"
          >
            Оставить здешний
          </button>
          <button
            disabled={busy}
            onClick={() => setLater(true)}
            className="py-1 text-center text-xs text-arena-text-dim underline disabled:opacity-50"
          >
            Решу позже
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-snug text-arena-text-dim">
          Пока не выберешь, синхронизация стоит: приложение не станет ничего перезаписывать за
          твоей спиной. Вопрос останется на вкладке «Лидеры».
        </p>
      </motion.div>
    </motion.div>
  );
}

/** One side of the comparison. Shows what the choice actually costs, not just the rep count. */
function Side({
  icon,
  title,
  profile,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  profile: ProfileRecord;
  accent?: boolean;
}) {
  const level = levelFromTotalXp(profile.totalXp).level;
  const stage = Math.min(profile.currentBossIndex + 1, BOSSES.length);
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent ? 'border-arena-amber/50 bg-arena-surface-2' : 'border-arena-border bg-arena-surface-2/50'
      }`}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-arena-text-dim">
        {icon}
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-arena-text">{profile.totalPushups}</p>
      <p className="text-[11px] text-arena-text-dim">отжиманий</p>
      <dl className="mt-2 space-y-0.5 text-[11px] text-arena-text-dim">
        <Row label="уровень" value={level} />
        <Row label="боссов" value={profile.bossesDefeated.length} />
        <Row label="этап" value={`${stage} из ${BOSSES.length}`} />
        <Row label="рекорд Rush" value={profile.rushBestReps} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="tabular-nums text-arena-text">{value}</dd>
    </div>
  );
}
