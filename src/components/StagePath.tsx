import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Check, Crown } from 'lucide-react';
import type { BossDef } from '../data/bosses';

/**
 * The route through one stage: three minions, then the boss.
 *
 * Its whole job is to answer "how far am I from the boss" at a glance — a bare HP bar tells you
 * about the enemy in front of you but nothing about how much of the stage is left.
 */
export function StagePath({
  boss,
  step,
  color,
}: {
  boss: BossDef;
  /** 0..2 for the minions, 3 for the boss. */
  step: number;
  color: string;
}) {
  const nodes = [
    ...boss.minions.map((m) => ({ key: m.id, label: m.name, isBoss: false })),
    { key: boss.id, label: boss.name, isBoss: true },
  ];

  return (
    <div className="flex items-start">
      {nodes.map((node, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <div key={node.key} className="flex flex-1 flex-col items-center">
            {/* Fixed row height for every node, boss included. Without it the row is only as tall
                as its own circle, and since the boss's circle is larger its centreline — and the
                connectors either side of it — sit lower than everyone else's. */}
            <div className="flex h-8 w-full items-center">
              {/* Connector on the left of every node but the first. */}
              <span
                className={clsx(
                  'h-0.5 flex-1 rounded-full',
                  i === 0 && 'opacity-0',
                  done || current ? 'bg-arena-amber/60' : 'bg-arena-border',
                )}
              />
              <motion.span
                className={clsx(
                  'flex shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  node.isBoss ? 'h-8 w-8' : 'h-6 w-6',
                  done && 'border-arena-amber bg-arena-amber text-black',
                  current && 'border-arena-amber bg-arena-surface-2',
                  !done && !current && 'border-arena-border bg-arena-surface',
                )}
                // The node you're on keeps a slow halo, so the eye finds your place on the route
                // without reading any of the names.
                animate={
                  current
                    ? { boxShadow: [`0 0 0 3px ${color}44`, `0 0 0 8px ${color}00`] }
                    : { boxShadow: '0 0 0 0px transparent' }
                }
                transition={
                  current
                    ? { duration: 1.7, repeat: Infinity, ease: 'easeOut' }
                    : { duration: 0.2 }
                }
              >
                {done ? (
                  <motion.span
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                  >
                    <Check size={node.isBoss ? 16 : 13} strokeWidth={3} />
                  </motion.span>
                ) : node.isBoss ? (
                  <Crown size={15} className={current ? 'text-arena-amber' : 'text-arena-text-dim'} />
                ) : (
                  <span
                    className={clsx(
                      'h-1.5 w-1.5 rounded-full',
                      current ? 'bg-arena-amber' : 'bg-arena-text-dim',
                    )}
                  />
                )}
              </motion.span>
              <span
                className={clsx(
                  'h-0.5 flex-1 rounded-full',
                  i === nodes.length - 1 && 'opacity-0',
                  done ? 'bg-arena-amber/60' : 'bg-arena-border',
                )}
              />
            </div>
            <span
              className={clsx(
                'mt-1 line-clamp-2 px-0.5 text-center text-[9px] leading-tight',
                current ? 'font-semibold text-arena-amber' : 'text-arena-text-dim',
                !done && !current && 'opacity-60',
              )}
            >
              {node.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
