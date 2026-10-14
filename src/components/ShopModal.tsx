import { Fragment, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { ProfileRecord } from '../types';
import { levelFromTotalXp } from '../data/leveling';
import { getRank } from '../data/ranks';
import { CONSUMABLES, FREEZE_COST, STOCK_FIELD, UPGRADES, nextCost, upgradeLevel, type ConsumableId, type UpgradeId } from '../data/shop';
import { MAX_FREEZES, freezesOf } from '../lib/streak';
import { Burst } from './Burst';
import { CountUp } from './CountUp';

type ItemId = UpgradeId | 'freeze' | ConsumableId;

const isConsumable = (id: ItemId): id is ConsumableId => id in CONSUMABLES;

/** The items with a drawn badge under public/shop (cut by scripts/slice-ability-sheet.mjs --out shop). */
const DRAWN = new Set<ItemId>(['power', 'precision', 'heavy', 'breath', 'freeze']);
/**
 * The ones drawn as a figure rather than a disc (cut off their white by scripts/cutout-white.mjs):
 * shown whole, on a dark disc of the same size, so the row of icons still lines up.
 */
const FIGURES = new Set<ItemId>(['pierce', 'rage', 'ward', 'hunter', 'scout', 'hourglass', 'double']);

/** An item's badge: the drawn disc, or the drawn figure on a dark disc of the same size. */
function ItemIcon({ id }: { id: ItemId }) {
  if (FIGURES.has(id)) {
    return (
      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-arena-surface shadow-[0_0_10px_rgba(0,0,0,0.6)]">
        <img
          src={`${import.meta.env.BASE_URL}shop/${id}.png`}
          alt=""
          draggable={false}
          className="h-10 w-10 select-none object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
        />
      </span>
    );
  }
  if (DRAWN.has(id)) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}shop/${id}.png`}
        alt=""
        aria-hidden
        draggable={false}
        className="h-11 w-11 select-none rounded-full shadow-[0_0_10px_rgba(0,0,0,0.6)]"
      />
    );
  }
  return null;
}

/**
 * Where XP turns into upgrades. Every price is paid out of the XP that makes up your level, so
 * each card says what the purchase will do to it — and a purchase that costs a level asks twice.
 */
export function ShopModal({
  profile,
  buyUpgrade,
  buyFreeze,
  buyConsumable,
  onPurchased,
  onClose,
}: {
  profile: ProfileRecord;
  buyUpgrade: (id: UpgradeId) => Promise<boolean>;
  buyFreeze: () => Promise<boolean>;
  buyConsumable: (id: ConsumableId) => Promise<boolean>;
  /** Plays the payment chime. */
  onPurchased: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  /** The item waiting for a second tap because buying it costs a level. */
  const [confirming, setConfirming] = useState<ItemId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** The last purchase, keyed by time so buying the same thing twice celebrates twice. */
  const [bought, setBought] = useState<{ id: ItemId; at: number } | null>(null);
  /** Set when a purchase cost a level — the level line flashes red. */
  const [droppedAt, setDroppedAt] = useState<number | null>(null);
  /**
   * The flinch is driven by controls, not by re-keying the block: a new key remounts the
   * counter inside it, which then rolled up from zero as if the balance had been reset.
   */
  const balance = useAnimationControls();
  const calm = useReducedMotion();

  // Focus goes to the close button once, on opening. Tied to `onClose` it ran again on every
  // purchase — the parent passes a fresh arrow each render — and focusing a button at the top
  // scrolled the sheet back up under your finger.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const xp = profile.totalXp;
  const level = levelFromTotalXp(xp).level;

  const buy = async (id: ItemId, cost: number, name: string) => {
    const after = levelFromTotalXp(xp - cost).level;
    if (after < level && confirming !== id) {
      setConfirming(id);
      return;
    }
    setConfirming(null);
    const ok =
      id === 'freeze'
        ? await buyFreeze()
        : isConsumable(id)
          ? await buyConsumable(id)
          : await buyUpgrade(id);
    if (ok) {
      onPurchased();
      setBought({ id, at: Date.now() });
      if (after < level) {
        setDroppedAt(Date.now());
        if (!calm) void balance.start({ x: [0, -8, 7, -5, 3, 0], transition: { duration: 0.45 } });
      }
    }
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
    /** Bought by the piece and used up, rather than levelled. */
    consumable?: boolean;
    /** A heading over this item, starting a section of the shop. */
    section?: string;
    have: number;
    max: number;
    cost: number | null;
  }[] = [
    ...UPGRADES.map((u) => ({
      id: u.id,
      name: u.name,
      detail: u.perLevel,
      have: upgradeLevel(profile.upgrades, u.id),
      max: u.costs.length,
      cost: nextCost(profile.upgrades, u),
    })),
    {
      id: 'freeze' as const,
      name: 'Заморозка стрика',
      detail: 'Закрывает один пропущенный день',
      consumable: true,
      have: freezesOf(profile),
      max: MAX_FREEZES,
      cost: freezesOf(profile) >= MAX_FREEZES ? null : FREEZE_COST,
    },
    ...(Object.keys(CONSUMABLES) as ConsumableId[]).map((id, i) => {
      const def = CONSUMABLES[id];
      const have = profile[STOCK_FIELD[id]] ?? 0;
      return {
        id,
        name: def.name,
        detail: def.detail,
        consumable: true,
        have,
        max: def.max,
        cost: have >= def.max ? null : def.cost,
        section: i === 0 ? 'В бой с собой' : undefined,
      };
    }),
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
        <motion.div animate={balance} className="text-center">
          <p className="mt-1 text-2xl font-bold tabular-nums text-arena-text">
            {/* Starts on the real balance and only rolls on a purchase. */}
            <CountUp value={xp} fromZero={false} /> XP
          </p>
          <motion.p
            key={level}
            initial={droppedAt ? { color: '#ef4444', scale: 1.15 } : false}
            animate={{ color: 'var(--color-arena-text-dim)', scale: 1 }}
            transition={{ duration: 0.9 }}
            className="text-xs"
          >
            уровень {level} · {getRank(level).name}
          </motion.p>
        </motion.div>
        <p className="mx-auto mt-2 max-w-[18rem] text-center text-[11px] leading-snug text-arena-text-dim">
          Покупки оплачиваются из XP уровня — уровень и ранг могут упасть, в таблице лидеров тоже.
        </p>

        <ul className="mt-4 space-y-2">
          {items.map((it, index) => {
            const maxed = it.cost == null;
            const affordable = !maxed && xp >= it.cost!;
            const after = maxed ? level : levelFromTotalXp(Math.max(0, xp - it.cost!)).level;
            const drops = affordable && after < level;
            const isConfirming = confirming === it.id;
            const justBought = bought?.id === it.id;
            return (
              <Fragment key={it.id}>
              {it.section && (
                <li className="px-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-arena-text-dim">{it.section}</li>
              )}
              <motion.li
                // Dealt onto the table one after another.
                initial={calm ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.06, type: 'spring', stiffness: 320, damping: 26 }}
                className="relative rounded-2xl border border-arena-border bg-arena-surface-2 p-3"
              >
                {/* A warm flash over the card that was just bought. */}
                {justBought && !calm && (
                  <motion.span
                    key={bought.at}
                    aria-hidden
                    initial={{ opacity: 0.55 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{ background: 'radial-gradient(circle at 20% 30%, rgba(245,158,11,0.55), transparent 70%)' }}
                  />
                )}
                <div className="flex items-start gap-3">
                  <motion.span
                    key={justBought ? bought.at : 'icon'}
                    initial={justBought && !calm ? { rotate: -25, scale: 1.4 } : false}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                    className="relative mt-0.5 shrink-0"
                  >
                    <ItemIcon id={it.id} />
                    <AnimatePresence>
                      {justBought && (
                        <motion.span
                          key={bought.at}
                          initial={{ opacity: 0, y: 0 }}
                          animate={{ opacity: [0, 1, 0], y: -28 }}
                          transition={{ duration: 1.1, ease: 'easeOut' }}
                          className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-extrabold text-arena-amber"
                        >
                          {it.consumable ? '+1' : '+1 ур.'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.span>
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
                        <span key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-arena-border">
                          {i < it.have && (
                            // The newest pip fills from the left with a spring; the rest just sit.
                            <motion.span
                              initial={justBought && i === it.have - 1 && !calm ? { scaleX: 0 } : false}
                              animate={{ scaleX: 1 }}
                              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                              className="absolute inset-0 origin-left rounded-full bg-arena-amber"
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <motion.button
                  onClick={() => void buy(it.id, it.cost!, it.name)}
                  disabled={!affordable}
                  whileTap={{ scale: 0.96 }}
                  // The confirm state wobbles, so a second tap is clearly being asked for.
                  animate={isConfirming && !calm ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                  className={clsx(
                    'relative mt-2.5 w-full rounded-xl py-2 text-sm font-semibold tabular-nums disabled:opacity-40',
                    isConfirming ? 'bg-arena-red text-white' : 'bg-arena-amber text-arena-bg',
                  )}
                >
                  {justBought && <Burst key={bought.at} count={16} spread={90} />}
                  {maxed
                    ? it.consumable
                      ? 'Запас полон'
                      : 'Максимум'
                    : isConfirming
                      ? `Точно? Уровень ${level} → ${after}`
                      : `Купить за ${it.cost} XP`}
                </motion.button>
                {!maxed && !affordable && (
                  <p className="mt-1 text-center text-[10px] text-arena-text-dim">не хватает {it.cost! - xp} XP</p>
                )}
                {drops && !isConfirming && (
                  <p className="mt-1 text-center text-[10px] text-arena-red">уровень упадёт до {after}</p>
                )}
              </motion.li>
              </Fragment>
            );
          })}
        </ul>

        {message && <p className="mt-3 text-center text-xs text-arena-text">{message}</p>}
      </motion.div>
    </motion.div>
  );
}
