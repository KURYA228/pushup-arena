import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Flame, Trophy } from 'lucide-react';
import type { ProfileRecord } from '../types';
import type { useProfile } from '../hooks/useProfile';
import { ACHIEVEMENTS } from '../data/achievements';
import { BOSSES, bossStatusAt } from '../data/bosses';
import { AchievementGrid } from './AchievementGrid';
import { BossIcon } from './BossIcon';
import { BossGallery } from './BossGallery';
import { BossProfileModal } from './BossProfileModal';
import { DevPanel } from './DevPanel';
import { nextRank } from '../data/ranks';

type Derived = NonNullable<ReturnType<typeof useProfile>['derived']>;

/** Taps on the title needed to reveal the dev panel, and how long the streak of taps stays alive. */
const DEV_TAPS = 5;
const DEV_TAP_WINDOW_MS = 1500;

export function HomeView({
  profile,
  derived,
  devPatchProfile,
  devResetProfile,
}: {
  profile: ProfileRecord;
  derived: Derived;
  devPatchProfile: (p: Partial<ProfileRecord>) => Promise<void>;
  devResetProfile: () => Promise<void>;
}) {
  const upcoming = nextRank(derived.level);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openBoss = openIndex == null ? null : BOSSES[openIndex];

  const [devOpen, setDevOpen] = useState(false);
  const tapsRef = useRef({ count: 0, at: 0 });
  const onTitleTap = () => {
    const now = Date.now();
    const t = tapsRef.current;
    t.count = now - t.at > DEV_TAP_WINDOW_MS ? 1 : t.count + 1;
    t.at = now;
    if (t.count >= DEV_TAPS) {
      t.count = 0;
      setDevOpen(true);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-6">
      <header className="mb-6 text-center">
        {/* Five quick taps open the dev panel — hidden rather than absent, so it also works on
            the phone against a production build. */}
        <button
          onClick={onTitleTap}
          className="text-xs uppercase tracking-widest text-arena-text-dim"
        >
          Железная Арена
        </button>
        <h1 className="mt-1 text-2xl font-bold text-arena-text">{derived.rank.name}</h1>
        {upcoming && (
          <p className="mt-0.5 text-xs text-arena-text-dim">
            до ранга «{upcoming.name}» — уровень {upcoming.minLevel}
          </p>
        )}
        {import.meta.env.DEV && (
          <button
            onClick={() => setDevOpen(true)}
            className="mt-2 rounded-full border border-arena-amber/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-arena-amber"
          >
            dev
          </button>
        )}
      </header>

      <section className="mb-4 rounded-2xl border border-arena-border bg-arena-surface p-4">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-lg font-semibold text-arena-text">Уровень {derived.level}</span>
          <span className="text-xs tabular-nums text-arena-text-dim">
            {derived.xpIntoLevel} / {derived.xpForNext} XP
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-arena-surface-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-arena-amber-dim to-arena-amber"
            initial={false}
            animate={{ width: `${Math.min(100, derived.progress * 100)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-arena-border bg-arena-surface p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-arena-text">{profile.totalPushups}</p>
          <p className="text-xs text-arena-text-dim">всего отжиманий</p>
        </div>
        <div className="rounded-2xl border border-arena-border bg-arena-surface p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Flame size={18} className="text-arena-red" />
            <p className="text-2xl font-bold tabular-nums text-arena-text">{profile.streak}</p>
          </div>
          <p className="text-xs text-arena-text-dim">дней подряд</p>
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-arena-border bg-arena-surface p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-arena-text">
          <Trophy size={16} className="text-arena-amber" /> Текущий босс
        </div>
        <button
          onClick={() => setOpenIndex(derived.bossIndex)}
          aria-label={`Открыть карточку босса: ${derived.boss.name}`}
          className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-3 rounded-xl px-1 py-1 text-left active:scale-[0.99]"
        >
          <BossIcon boss={derived.boss} index={derived.bossIndex} size={40} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm text-arena-text-dim">
              <span className="truncate">
                {derived.boss.name} — {derived.boss.title}
              </span>
              <ChevronRight size={14} className="shrink-0 text-arena-amber" />
            </p>
            {!derived.allBossesDefeated ? (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-arena-surface-2">
                  <div
                    className="h-full rounded-full bg-arena-red"
                    style={{ width: `${Math.max(0, Math.min(100, (profile.bossHp / derived.boss.hp) * 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-arena-text-dim">
                  повержено {profile.bossesDefeated.length} из {BOSSES.length}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs font-medium text-arena-amber">Арена пройдена полностью</p>
            )}
          </div>
        </button>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-arena-text">
          Арена <span className="font-normal text-arena-text-dim">— все {BOSSES.length} противников</span>
        </h2>
        <BossGallery
          currentIndex={derived.bossIndex}
          defeatedIds={profile.bossesDefeated}
          onSelect={setOpenIndex}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-arena-text">
          Достижения{' '}
          <span className="font-normal text-arena-text-dim">
            — {profile.achievementsUnlocked.length} из {ACHIEVEMENTS.length}, нажми, чтобы узнать условие
          </span>
        </h2>
        <AchievementGrid unlockedIds={profile.achievementsUnlocked} />
      </section>

      <AnimatePresence>
        {openBoss && openIndex != null && (
          <BossProfileModal
            boss={openBoss}
            index={openIndex}
            hpLeft={profile.bossHp}
            status={bossStatusAt(openIndex, derived.bossIndex, profile.bossesDefeated)}
            onClose={() => setOpenIndex(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {devOpen && (
          <DevPanel
            profile={profile}
            patch={devPatchProfile}
            reset={devResetProfile}
            onClose={() => setDevOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
