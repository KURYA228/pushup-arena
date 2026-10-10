import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { BossDef } from '../data/bosses';
import { BOSSES } from '../data/bosses';
import { ABILITY_TIPS, abilityName, describeAbility } from '../data/abilities';
import { BossIcon } from './BossIcon';

// v2: the first version showed the report as the stage began and marked bosses seen then, so a
// boss could count as briefed without his report ever having come up in front of him.
const SEEN_KEY = 'arena.briefed.v2';

/** Bosses whose scouting report this device has already been shown. */
function seenIds(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function wasBriefed(bossId: string): boolean {
  return seenIds().includes(bossId);
}

/** Forgets every report this device has shown, so each boss's comes up again (dev panel). */
export function resetBriefed() {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // Nothing stored to forget.
  }
}

export function markBriefed(bossId: string) {
  try {
    const ids = seenIds();
    if (!ids.includes(bossId)) localStorage.setItem(SEEN_KEY, JSON.stringify([...ids, bossId]));
  } catch {
    // Private mode or storage blocked: the report just shows again next time.
  }
}

/**
 * The scouting report: who waits at the end of this stage and how he fights — every ability
 * with an icon, what it does and what to do about it.
 *
 * Shown on its own once per boss, as the stage begins, so the rules are known before the first
 * set rather than discovered in the middle of it; and any time after from the stage card. It
 * doesn't stop the camera — reps keep counting underneath if you're already mid-set.
 */
export function BossBriefing({ boss, index, onClose }: { boss: BossDef; index: number; onClose: () => void }) {
  const goRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    goRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="safe-top safe-x fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Разведка: ${boss.name}`}
        initial={{ opacity: 0, y: 40, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-full w-full max-w-sm overflow-y-auto rounded-3xl border-2 bg-arena-surface p-5 text-center"
        style={{ borderColor: `${boss.color}88`, boxShadow: `0 0 40px ${boss.color}40` }}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 rounded-full bg-arena-surface-2 p-2 text-arena-text-dim active:scale-95"
        >
          <X size={16} />
        </button>

        <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: boss.color }}>
          Разведка · этап {index + 1} из {BOSSES.length}
        </p>

        <div
          className="mx-auto mt-3 flex w-full justify-center rounded-2xl py-3"
          style={{ background: `radial-gradient(circle at 50% 55%, ${boss.color}33, transparent 70%)` }}
        >
          <BossIcon boss={boss} index={index} size={130} />
        </div>
        <h2 className="mt-1 text-2xl font-black text-arena-text">{boss.name}</h2>
        <p className="text-xs text-arena-text-dim">{boss.title}</p>
        <p className="mt-1 text-[11px] text-arena-text-dim">
          Ждёт в конце этапа, после: {boss.minions.map((m) => m.name).join(', ')}
        </p>

        <p className="mt-4 text-left text-[11px] font-bold uppercase tracking-wider text-arena-text-dim">
          Его способности
        </p>
        <div className="mt-1.5 space-y-2 text-left">
          {boss.abilities.map((a, i) => (
            <motion.div
              key={a.kind}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1, type: 'spring', stiffness: 300, damping: 24 }}
              className="flex gap-3 rounded-2xl border border-arena-amber/30 bg-arena-surface-2 p-3"
            >
              <span className="text-2xl leading-none">{ABILITY_TIPS[a.kind].icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-arena-amber">{abilityName(a)}</span>
                <span className="block text-xs leading-snug text-arena-text">{describeAbility(a)}</span>
                <span className="mt-1 block text-[11px] leading-snug text-arena-text-dim">
                  <b className="text-arena-text">Как бить:</b> {ABILITY_TIPS[a.kind].tip}
                </span>
              </span>
            </motion.div>
          ))}
        </div>

        <motion.button
          ref={goRef}
          onClick={onClose}
          animate={{
            boxShadow: [
              '0 0 12px rgba(245,158,11,0.4)',
              '0 0 26px rgba(245,158,11,0.85)',
              '0 0 12px rgba(245,158,11,0.4)',
            ],
          }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="mt-5 w-full rounded-xl bg-arena-amber py-3 text-sm font-bold text-black active:scale-[0.98]"
        >
          Понятно, в бой!
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
