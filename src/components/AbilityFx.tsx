import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Burst } from './Burst';
import type { BossDef } from '../data/bosses';
import type { AbilityEvent, FightState } from '../data/combat';
import { CRYSTAL_REPS, END_CRYSTALS, abilityValue, hasAbility } from '../data/abilities';

/**
 * What the bosses' own abilities look like on the fight screen.
 *
 *  - {@link AbilityStamp}: the big moment — a word slammed over the boss when an ability goes
 *    off (a crystal breaking, the scream, the retreat), each in its own colour and motion.
 *  - {@link AbilityStatus}: what's in force right now — frozen reps left, the scream count,
 *    the crystals still standing — as chips over the corner of the art.
 *  - {@link FrostOverlay}: the screen's edges iced over while Gru's ray holds you.
 */

interface StampStyle {
  text: string;
  color: string;
  /** How it arrives. */
  motion: 'slam' | 'shake' | 'shatter' | 'float';
}

export const STAMPS: Record<AbilityEvent, StampStyle> = {
  frozen: { text: 'ЗАМОРОЗКА!', color: '#7dd3fc', motion: 'shake' },
  retreat: { text: 'ОТСТУПАЕМ!', color: '#f59e0b', motion: 'float' },
  scream: { text: 'СКРИМЕР!', color: '#ef4444', motion: 'shake' },
  'scream-burned': { text: 'УРОН СГОРЕЛ!', color: '#ef4444', motion: 'slam' },
  'scream-survived': { text: 'ВЫДЕРЖАЛ!', color: '#4ade80', motion: 'slam' },
  crystal: { text: 'КРИСТАЛЛ РАЗБИТ!', color: '#c084fc', motion: 'shatter' },
  covered: { text: 'ТИТАНЫ ПРИКРЫЛИ!', color: '#ef4444', motion: 'slam' },
};

/** The big word over the boss. Remount (change `id`) to play it again. */
export function AbilityStamp({ stamp }: { stamp: { id: number; event: AbilityEvent } | null }) {
  const calm = useReducedMotion();
  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <AnimatePresence>
        {stamp && (
          <motion.div
            key={stamp.id}
            className="relative flex items-center justify-center"
            initial={calm ? { opacity: 0 } : enterFrom(STAMPS[stamp.event].motion)}
            animate={calm ? { opacity: 1 } : settle(STAMPS[stamp.event].motion)}
            exit={{ opacity: 0, scale: 1.15, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
          >
            <span
              className="whitespace-nowrap rounded-xl border-2 bg-black/70 px-4 py-2 text-2xl font-black uppercase tracking-wider"
              style={{
                color: STAMPS[stamp.event].color,
                borderColor: STAMPS[stamp.event].color,
                textShadow: `0 0 14px ${STAMPS[stamp.event].color}`,
                boxShadow: `0 0 30px ${STAMPS[stamp.event].color}66`,
              }}
            >
              {STAMPS[stamp.event].text}
            </span>
            {STAMPS[stamp.event].motion === 'shatter' && <Burst count={22} spread={110} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function enterFrom(kind: StampStyle['motion']) {
  switch (kind) {
    case 'slam':
      return { opacity: 0, scale: 2.4, rotate: -8 };
    case 'shake':
      return { opacity: 0, scale: 0.6 };
    case 'shatter':
      return { opacity: 0, scale: 0.3, rotate: 10 };
    case 'float':
      return { opacity: 0, y: 30 };
  }
}

function settle(kind: StampStyle['motion']) {
  switch (kind) {
    case 'shake':
      return { opacity: 1, scale: 1, x: [0, -10, 9, -7, 5, -3, 0] };
    case 'float':
      return { opacity: 1, y: [30, -6, 0] };
    default:
      return { opacity: 1, scale: 1, rotate: 0 };
  }
}

/** Chips for what's in force right now. Nothing for a boss with nothing running. */
export function AbilityStatus({ boss, fight }: { boss: BossDef; fight: FightState }) {
  const chips: { key: string; node: ReactNode; color: string }[] = [];
  const a = boss.abilities;

  const frozen = fight.frozenLeft ?? 0;
  if (frozen > 0) chips.push({ key: 'frozen', color: '#7dd3fc', node: <>❄ заморожено: {frozen}</> });

  if (fight.scream) {
    const need = abilityValue(a, 'scream');
    chips.push({
      key: 'scream',
      color: '#ef4444',
      node: (
        <>
          😱 без паузы {fight.scream.reps}/{need}
        </>
      ),
    });
  }

  if (hasAbility(a, 'endCrystals')) {
    const broken = fight.crystalsBroken ?? 0;
    const left = END_CRYSTALS - broken;
    chips.push({
      key: 'crystals',
      color: '#c084fc',
      node:
        left > 0 ? (
          <>
            {Array.from({ length: END_CRYSTALS }, (_, i) => (
              <span key={i} className={i < left ? '' : 'opacity-25 grayscale'}>
                💎
              </span>
            ))}{' '}
            {fight.setReps % CRYSTAL_REPS}/{CRYSTAL_REPS}
          </>
        ) : (
          <>💎 разбиты</>
        ),
    });
  }

  if (hasAbility(a, 'retreat') && fight.retreatUsed) {
    chips.push({ key: 'retreat', color: '#a3a3a3', node: <>отступление потрачено</> });
  }

  if (!chips.length) return null;
  return (
    <div className="pointer-events-none absolute left-1 top-1 z-10 flex flex-col items-start gap-1">
      <AnimatePresence>
        {chips.map((c) => (
          <motion.span
            key={c.key}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="rounded-full border bg-black/70 px-2 py-0.5 text-[11px] font-bold tabular-nums"
            style={{ color: c.color, borderColor: `${c.color}99` }}
          >
            {c.node}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Ice creeping in from the edges of the screen while reps are frozen. */
export function FrostOverlay({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.8] }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
          transition={{ duration: 0.6 }}
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 55%, rgba(125, 211, 252, 0.18) 75%, rgba(186, 230, 253, 0.55) 100%)',
            boxShadow: 'inset 0 0 60px rgba(186, 230, 253, 0.6)',
          }}
        />
      )}
    </AnimatePresence>
  );
}
