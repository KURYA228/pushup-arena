import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Dumbbell, Hammer, Snowflake, Wind, X } from 'lucide-react';
import clsx from 'clsx';
import type { ProfileRecord } from '../types';
import { levelFromTotalXp } from '../data/leveling';
import { getRank } from '../data/ranks';
import { FREEZE_COST, UPGRADES, nextCost, upgradeLevel, type UpgradeId } from '../data/shop';
import { MAX_FREEZES, freezesOf } from '../lib/streak';

const ICONS: Record<UpgradeId, typeof Dumbbell> = {
  power: Dumbbell,
  precision: Crosshair,
  heavy: Hammer,
  breath: Wind,
};

type ItemId = UpgradeId | 'freeze';

/**
 * Where XP turns into upgrades. Every price is paid out of the XP that makes up your level, so
 * each card says what the purchase will do to it — and a purchase that costs a level asks twice.
 */
export function ShopModal({
  profile,
  buyUpgrade,
  buyFreeze,
  onClose,
}: {
  profile: ProfileRecord;
  buyUpgrade: (id: UpgradeId) => Promise<boolean>;
  buyFreeze: () => Promise<boolean>;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  /** The item waiting for a second tap because buying it costs a level. */
  const [confirming, setConfirming] = useState<ItemId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const xp = profile.totalXp;
  const level = levelFromTotalXp(xp).level;

  const buy = async (id: ItemId, cost: number, name: string) => {
    const after = levelFromTotalXp(xp - cost).level;
    if (after < level && confirming !== id) {
      setConfirming(id);
      return;
    }
    setConfirming(null);
    const ok = id === 'freeze' ? await buyFreeze() : await buyUpgrade(id);
    setMessage(
      ok
        ? after < level
          ? `Куплено: ${name}. Уровень ${level} → ${after}`
          : `Куплено: ${name}`
        : 'Не получилось — не хватает XP',
    );
  };

  const items: {
    id: ItemId;
    name: string;
    detail: string;
    icon: typeof Dumbbell;
    have: number;
    max: number;
    cost: number | null;
  }[] = [
    ...UPGRADES.map((u) => ({
      id: u.id,
      name: u.name,
      detail: u.perLevel,
      icon: ICONS[u.id],
      have: upgradeLevel(profile.upgrades, u.id),
      max: u.costs.length,
      cost: nextCost(profile.upgrades, u),
    })),
    {
      id: 'freeze' as const,
      name: 'Заморозка стрика',
      detail: 'Закрывает один пропущенный день',
      icon: Snowflake,
      have: freezesOf(profile),
      max: MAX_FREEZES,
      cost: freezesOf(profile) >= MAX_FREEZES ? null : FREEZE_COST,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="safe-top safe-x fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Магазин"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-full w-full max-w-sm overflow-y-auto rounded-3xl border border-arena-border bg-arena-surface p-5"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 rounded-full bg-arena-surface-2 p-2 text-arena-text-dim active:scale-95"
        >
          <X size={16} />
        </button>

        <p className="text-center text-[11px] uppercase tracking-widest text-arena-text-dim">Магазин</p>
        <p className="mt-1 text-center text-2xl font-bold tabular-nums text-arena-text">{xp} XP</p>
        <p className="text-center text-xs text-arena-text-dim">
          уровень {level} · {getRank(level).name}
        </p>
        <p className="mx-auto mt-2 max-w-[18rem] text-center text-[11px] leading-snug text-arena-text-dim">
          Покупки оплачиваются из XP уровня — уровень и ранг могут упасть, в таблице лидеров тоже.
        </p>

        <ul className="mt-4 space-y-2">
          {items.map((it) => {
            const Icon = it.icon;
            const maxed = it.cost == null;
            const affordable = !maxed && xp >= it.cost!;
            const after = maxed ? level : levelFromTotalXp(Math.max(0, xp - it.cost!)).level;
            const drops = affordable && after < level;
            const isConfirming = confirming === it.id;
            return (
              <li key={it.id} className="rounded-2xl border border-arena-border bg-arena-surface-2 p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-xl bg-arena-surface p-2 text-arena-amber">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-arena-text">{it.name}</p>
                      <span className="shrink-0 text-[11px] tabular-nums text-arena-text-dim">
                        {it.have} / {it.max}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-arena-text-dim">{it.detail}</p>
                    {/* Pips for the levels, so progress reads at a glance. */}
                    <div className="mt-1.5 flex gap-1">
                      {Array.from({ length: it.max }, (_, i) => (
                        <span
                          key={i}
                          className={clsx('h-1 flex-1 rounded-full', i < it.have ? 'bg-arena-amber' : 'bg-arena-border')}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => void buy(it.id, it.cost!, it.name)}
                  disabled={!affordable}
                  className={clsx(
                    'mt-2.5 w-full rounded-xl py-2 text-sm font-semibold tabular-nums active:scale-[0.98] disabled:opacity-40',
                    isConfirming ? 'bg-arena-red text-white' : 'bg-arena-amber text-arena-bg',
                  )}
                >
                  {maxed
                    ? 'Максимум'
                    : isConfirming
                      ? `Точно? Уровень ${level} → ${after}`
                      : `Купить за ${it.cost} XP`}
                </button>
                {!maxed && !affordable && (
                  <p className="mt-1 text-center text-[10px] text-arena-text-dim">не хватает {it.cost! - xp} XP</p>
                )}
                {drops && !isConfirming && (
                  <p className="mt-1 text-center text-[10px] text-arena-red">уровень упадёт до {after}</p>
                )}
              </li>
            );
          })}
        </ul>

        {message && <p className="mt-3 text-center text-xs text-arena-text">{message}</p>}
      </motion.div>
    </motion.div>
  );
}
