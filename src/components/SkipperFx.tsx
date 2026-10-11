import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Strike } from './GruFx';
import { Plaster } from './AbilityScene';
import type { BossDef } from '../data/bosses';
import type { FightState } from '../data/combat';
import { HALF_HP, hasAbility } from '../data/abilities';

/**
 * "Панцирь", made visible: while he's above 60% HP a pane of ice hangs in front of him. Every
 * blow flashes on it, and it cracks further the closer he gets to the line — struck once when
 * he's down to 90%, again at 80%, again at 70%. At 60% it breaks (the ice-shatter scene) and
 * is gone, and from then on the blows land in full. `hitId` changes with every landed blow.
 */
const CRACK_AT = [0.9, 0.8, 0.7];
const IMPACTS: [number, number][] = [
  [36, 30],
  [66, 52],
  [40, 72],
];

export function IceShield({ hpFrac, hitId, ready }: { hpFrac: number; hitId: number | null; ready: boolean }) {
  const up = ready && hpFrac > 0.6;
  const strikes = CRACK_AT.filter((t) => hpFrac <= t).length;
  const [seed] = useState(() => 1 + Math.floor(Math.random() * 100000));
  return (
    <AnimatePresence>
      {up && (
        <motion.div
          key="shield"
          aria-hidden
          className="pointer-events-none absolute inset-[-2%] z-10 overflow-hidden rounded-[18%]"
          style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,0.32), rgba(186,230,253,0.16) 35%, rgba(125,211,252,0.12) 70%, rgba(56,189,248,0.24))',
            border: '2px solid rgba(224,242,254,0.7)',
            boxShadow: 'inset 0 0 22px rgba(224,242,254,0.5), 0 0 16px rgba(125,211,252,0.45)',
          }}
          initial={{ opacity: 0, scale: 1.15 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.06, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        >
          <div className="absolute left-[10%] top-[5%] h-[50%] w-[7%] rotate-[20deg] rounded-full bg-white/40 blur-[2px]" />
          {IMPACTS.slice(0, strikes).map((at, i) => (
            <Strike key={i} at={at} seed={seed + i * 7919} />
          ))}
          {/* The blow glancing off it: a flash across the pane. */}
          {hitId != null && (
            <motion.div
              key={hitId}
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.75), rgba(186,230,253,0.25) 45%, transparent 75%)' }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The plaster Skipper wears for the rest of the fight once he's retreated and patched himself up. */
export function RetreatPlaster({ used }: { used: boolean }) {
  return (
    <AnimatePresence>
      {used && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-[18%] top-[8%] z-10"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          // In place as he comes back out of the slide.
          transition={{ delay: 2, type: 'spring', stiffness: 400, damping: 16 }}
        >
          <Plaster size={44} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Where something happens on the HP bar: a notch at each threshold a boss's abilities care
 * about, with its icon over it, so you can see it coming. Dimmed once it's been spent.
 */
export function hpMarks(boss: BossDef, fight: FightState): { at: number; icon: string; spent: boolean }[] {
  const a = boss.abilities;
  const marks: { at: number; icon: string; spent: boolean }[] = [];
  if (hasAbility(a, 'bulwark')) marks.push({ at: 0.6, icon: '🛡️', spent: false });
  if (hasAbility(a, 'retreat')) marks.push({ at: HALF_HP, icon: '🏃', spent: !!fight.retreatUsed });
  if (hasAbility(a, 'scream')) marks.push({ at: HALF_HP, icon: '😱', spent: !!fight.screamUsed });
  if (hasAbility(a, 'treasury')) marks.push({ at: HALF_HP, icon: '💰', spent: !!fight.treasuryUsed });
  if (hasAbility(a, 'enrage')) marks.push({ at: 0.4, icon: '😡', spent: false });
  return marks;
}

export function HpMarks({ marks, pct }: { marks: { at: number; icon: string; spent: boolean }[]; pct: number }) {
  if (!marks.length) return null;
  return (
    <>
      {marks.map((m) => {
        const passed = pct / 100 <= m.at;
        return (
          <div
            key={m.icon}
            className={`pointer-events-none absolute top-0 h-full ${m.spent || passed ? 'opacity-40 grayscale' : ''}`}
            style={{ left: `${m.at * 100}%` }}
          >
            <div className="absolute -left-px top-0 h-full w-[2px] bg-white/85 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
            {/* The icon sits on the notch, on a dark disc so it reads over red and grey alike. */}
            <span className="absolute left-0 top-1/2 flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/75 text-[10px] leading-none">
              {m.icon}
            </span>
          </div>
        );
      })}
    </>
  );
}
