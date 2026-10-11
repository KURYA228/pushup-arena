import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Burst } from './Burst';
import type { BossDef } from '../data/bosses';
import type { AbilityEvent, FightState } from '../data/combat';
import { CRYSTAL_REPS, END_CRYSTALS, PIGGY_EVERY, SET_BREAK_MS, abilityValue, hasAbility } from '../data/abilities';

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
  treasury: { text: 'КАЗНА ОТКРЫТА!', color: '#fbbf24', motion: 'slam' },
  'fee-paid': { text: 'ОПЛАЧЕНО ✓', color: '#4ade80', motion: 'slam' },
  'bulwark-broken': { text: 'ПАНЦИРЬ ПРОБИТ!', color: '#7dd3fc', motion: 'shatter' },
  'crit-blocked': { text: 'КРИТ ЗАБЛОКИРОВАН!', color: '#3fa9e0', motion: 'slam' },
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

/** Robin, Cyborg, Starfire, Raven, Beast Boy. */
const TITAN_COLORS = ['#ef4444', '#3b82f6', '#f97316', '#a855f7', '#22c55e'];

/** Chips for what's in force right now. Nothing for a boss with nothing running. */
export function AbilityStatus({ boss, fight, pulse }: { boss: BossDef; fight: FightState; /** Changes when the chip for what just happened should flash. */ pulse?: number }) {
  const chips: { key: string; node: ReactNode; color: string }[] = [];
  const a = boss.abilities;

  // Krabs' fee is owed again after every pause, and nothing re-renders the screen when a pause
  // crosses the line — so while he's up, look at the clock twice a second.
  const fee = abilityValue(a, 'entryFee');
  const team = abilityValue(a, 'teamwork');
  const tribute = abilityValue(a, 'tribute');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!fee && !team && !tribute) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [fee, team, tribute]);
  const inSet = fight.lastRepAt != null && now - fight.lastRepAt < SET_BREAK_MS;

  // The tsar's tribute: a coin lights for each rep of the set, and the last one — the rep that
  // goes to the treasury — glows red when it's next.
  if (tribute) {
    const done = inSet ? fight.setReps % tribute : 0;
    const next = done === tribute - 1;
    chips.push({
      key: 'tribute',
      color: next ? '#f87171' : '#fbbf24',
      node: (
        <span className="inline-flex items-center gap-[3px]">
          дань
          {Array.from({ length: tribute }, (_, i) => (
            <span
              key={i}
              className="inline-block h-2.5 w-2.5 rounded-full border"
              style={{
                borderColor: i === tribute - 1 ? '#f87171' : '#fbbf24',
                background: i < done ? '#fbbf24' : i === tribute - 1 && next ? '#ef4444' : 'transparent',
                boxShadow: i === tribute - 1 && next ? '0 0 6px #ef4444' : undefined,
              }}
            />
          ))}
        </span>
      ),
    });
  }

  // Robin's Titans: one light per rep of the set, in their colours; once the set's long enough
  // they can't cover him any more.
  if (team) {
    const done = inSet ? Math.min(team, fight.setReps) : 0;
    chips.push({
      key: 'titans',
      color: done >= team ? '#4ade80' : '#fca5a5',
      node:
        done >= team ? (
          <>✓ Титаны не помогут</>
        ) : (
          <span className="inline-flex items-center gap-1">
            подход
            {TITAN_COLORS.slice(0, team).map((c, i) => (
              <span
                key={c}
                className="inline-block h-2.5 w-2.5 rounded-full border border-white/60"
                style={{ background: i < done ? c : 'transparent', boxShadow: i < done ? `0 0 6px ${c}` : undefined }}
              />
            ))}
          </span>
        ),
    });
  }
  if (fee) {
    const owed = inSet ? Math.max(0, fee - fight.setReps) : fee;
    chips.push(
      owed > 0
        ? { key: 'fee', color: '#fbbf24', node: <>🪙 вход: {owed}</> }
        : { key: 'fee', color: '#4ade80', node: <>✓ оплачено</> },
    );
  }

  // The pig's nest: an egg goes dark with each rep, and the rep that would take the last one is
  // the one he steals. Counted over the whole fight, as the ability is.
  if (hasAbility(a, 'piggyBank')) {
    const left = PIGGY_EVERY - (fight.repsOnEnemy % PIGGY_EVERY);
    chips.push({
      key: 'nest',
      color: left === 1 ? '#f87171' : '#a3e635',
      node: (
        <>
          гнездо{' '}
          {Array.from({ length: PIGGY_EVERY }, (_, i) => (
            <span key={i} className={i < left ? '' : 'opacity-25 grayscale'}>
              🥚
            </span>
          ))}
        </>
      ),
    });
  }

  // The Joker's card: a standing reminder that crits work against you here, flashing when one
  // just did.
  if (hasAbility(a, 'jokerCard')) {
    chips.push({
      key: `joker-${pulse ?? 0}`,
      color: '#c084fc',
      node: (
        <motion.span
          className="inline-block"
          initial={pulse ? { scale: 1.5, color: '#4ade80' } : false}
          animate={{ scale: 1, color: '#c084fc' }}
          transition={{ duration: 0.6 }}
        >
          🃏 криты лечат его!
        </motion.span>
      ),
    });
  }

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

  const guard = fight.guardLeft ?? 0;
  if (guard > 0) chips.push({ key: 'guard', color: '#fbbf24', node: <>🛡 богатыри: {guard}</> });

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
