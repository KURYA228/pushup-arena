import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronRight, CircleHelp, Flame, MessageSquare, MousePointerClick, ShoppingBag, Snowflake, Trophy } from 'lucide-react';
import type { ProfileRecord } from '../types';
import type { useProfile } from '../hooks/useProfile';
import { ACHIEVEMENTS } from '../data/achievements';
import { BOSSES, bossStatusAt, stageProgressLabel } from '../data/bosses';
import { AchievementGrid } from './AchievementGrid';
import { BossIcon } from './BossIcon';
import { BossGallery } from './BossGallery';
import { BossProfileModal } from './BossProfileModal';
import { ShopModal } from './ShopModal';
import { WeeklyGoal } from './WeeklyGoal';
import { FEEDBACK_FORM_URL } from '../lib/feedbackForm';
import type { UpgradeId } from '../data/shop';
import { CountUp } from './CountUp';
import { nextRank } from '../data/ranks';
import { HelpModal } from './HelpModal';
import { HintCard } from './HintCard';
import { InstallHint } from './InstallHint';
import { useHint } from '../lib/hints';
import { armDevGate, openDevPanel, tapCounter } from '../lib/devGate';
import { MAX_FREEZES, streakView, todayLocal } from '../lib/streak';

type Derived = NonNullable<ReturnType<typeof useProfile>['derived']>;

export function HomeView({
  profile,
  derived,
  buyUpgrade,
  buyFreeze,
  setWeeklyGoal,
  onPurchased,
}: {
  profile: ProfileRecord;
  derived: Derived;
  buyUpgrade: (id: UpgradeId) => Promise<boolean>;
  buyFreeze: () => Promise<boolean>;
  setWeeklyGoal: (goal: number) => Promise<void>;
  onPurchased: () => void;
}) {
  const upcoming = nextRank(derived.level);
  // The stored streak goes stale while you're away; this is what it actually is today.
  const streak = streakView(profile, todayLocal());
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openBoss = openIndex == null ? null : BOSSES[openIndex];

  const [shopOpen, setShopOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [howtoVisible, dismissHowto] = useHint('howto');
  // Step one of the two-step way into the dev panel (see devGate.ts). Silent on purpose.
  const onTitleTap = useMemo(() => tapCounter(armDevGate), []);

  return (
    <div className="arena-page pb-8 pt-6">
      <header className="relative mb-6 text-center">
        {/* Always within reach, not just while the newcomer card is up. */}
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Как играть"
          className="absolute right-0 top-0 rounded-full bg-arena-surface p-2 text-arena-text-dim active:scale-95"
        >
          <CircleHelp size={18} />
        </button>
        {/* Five quick taps here are step one of two into the dev panel (src/lib/devGate.ts);
            step two is under "Начать Rush". Works against a production build on the phone. */}
        <button
          onClick={onTitleTap}
          className="text-xs uppercase tracking-widest text-arena-text-dim"
        >
          Push Up Legends
        </button>
        <h1 className="mt-1 text-2xl font-bold text-arena-text">{derived.rank.name}</h1>
        {upcoming && (
          <p className="mt-0.5 text-xs text-arena-text-dim">
            до ранга «{upcoming.name}» — уровень {upcoming.minLevel}
          </p>
        )}
        {import.meta.env.DEV && (
          <button
            onClick={openDevPanel}
            className="mt-2 rounded-full border border-arena-amber/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-arena-amber"
          >
            dev
          </button>
        )}
      </header>

      <AnimatePresence initial={false}>
        <InstallHint key="install" />
        {howtoVisible && (
          <HintCard key="howto" icon={<BookOpen size={16} />} title="Впервые здесь?" onClose={dismissHowto}>
            <p>
              Отжимания считает камера, каждое — удар по боссу. За них XP, уровни и улучшения в
              магазине.
            </p>
            <button
              onClick={() => {
                setHelpOpen(true);
                dismissHowto();
              }}
              className="mt-2.5 w-full rounded-xl bg-arena-amber py-2 text-sm font-semibold text-arena-bg active:scale-[0.98]"
            >
              Как играть — за минуту
            </button>
          </HintCard>
        )}
      </AnimatePresence>

      {/* Two columns once there's room: your own numbers on the left, the roster on the right.
          One stretched column on a laptop wastes most of the window and makes every card a
          letterbox. */}
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] xl:items-start xl:gap-6">
        <div>
      <section className="mb-4 rounded-2xl border border-arena-border bg-arena-surface p-4">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-lg font-semibold text-arena-text">Уровень {derived.level}</span>
          <span className="text-xs tabular-nums text-arena-text-dim">
            {derived.xpIntoLevel} / {derived.xpForNext} XP
          </span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-arena-surface-2">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-arena-amber-dim to-arena-amber"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, derived.progress * 100)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          >
            {/*
              A highlight sweeping the filled part, so the bar looks charged rather than painted.
              It lives inside the fill, which clips it to exactly the earned length — the earlier
              version sat over the whole track and was held back by a max-width, which is not the
              same thing. `x` in percent is measured against the element's own width, so covering
              a third of the bar means travelling from -100% to 400% to clear both ends; the old
              -40%…140% moved it less than half a bar and it died in the middle. Linear, because
              an eased sweep visibly stalls at the turn.
            */}
            <motion.div
              aria-hidden
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          </motion.div>
        </div>
        <button
          onClick={() => setShopOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-arena-amber/40 bg-arena-surface-2 py-2 text-xs font-semibold text-arena-amber active:scale-[0.99]"
        >
          <ShoppingBag size={14} /> Магазин — потратить XP на улучшения
        </button>
      </section>

      <WeeklyGoal profile={profile} setWeeklyGoal={setWeeklyGoal} />

      <section className="mb-4 grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-arena-border bg-arena-surface p-4 text-center"
        >
          <p className="text-2xl font-bold tabular-nums text-arena-text">
            <CountUp value={profile.totalPushups} />
          </p>
          <p className="text-xs text-arena-text-dim">всего отжиманий</p>
          <p className="mt-1 text-[10px] leading-tight text-arena-text-dim">с камеры</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.11 }}
          className="rounded-2xl border border-arena-border bg-arena-surface p-4 text-center"
        >
          <div className="flex items-center justify-center gap-1">
            {/*
              A live streak is actually alight: the flame is filled rather than drawn as an
              outline, and it throws an orange glow that breathes with it. A broken one is a
              grey outline that sits still — the difference has to be visible from across a
              room, because that is the number people keep coming back for.
            */}
            <motion.span
              className="inline-flex"
              animate={
                streak.streak > 0
                  ? {
                      scale: [1, 1.16, 1],
                      rotate: [0, -5, 4, 0],
                      filter: [
                        'drop-shadow(0 0 4px #fb923ccc) drop-shadow(0 0 11px #f9731655)',
                        'drop-shadow(0 0 9px #fdba74) drop-shadow(0 0 22px #f97316aa)',
                        'drop-shadow(0 0 4px #fb923ccc) drop-shadow(0 0 11px #f9731655)',
                      ],
                    }
                  : {}
              }
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Flame
                size={18}
                fill={streak.streak > 0 ? 'currentColor' : 'none'}
                className={streak.streak > 0 ? 'text-arena-red' : 'text-arena-text-dim'}
              />
            </motion.span>
            <p className="text-2xl font-bold tabular-nums text-arena-text">
              <CountUp value={streak.streak} />
            </p>
          </div>
          <p className="text-xs text-arena-text-dim">дней подряд</p>
          {/* Freezes in stock: each covers one missed day, earned one per week of streak. */}
          <div
            className="mt-1.5 flex items-center justify-center gap-1"
            aria-label={`Заморозки стрика: ${streak.freezes} из ${MAX_FREEZES}`}
            title="Заморозка закрывает один пропущенный день. Даётся за каждую неделю стрика."
          >
            {Array.from({ length: MAX_FREEZES }, (_, i) => (
              <Snowflake
                key={i}
                size={13}
                strokeWidth={2.2}
                className={i < streak.freezes ? 'text-sky-300' : 'text-arena-border'}
              />
            ))}
          </div>
          {streak.pendingFreezes > 0 ? (
            <p className="mt-1 text-[10px] leading-tight text-sky-300">
              {streak.pendingFreezes === 1 ? 'вчера пропуск — закроет заморозка' : 'пропуски закроют заморозки'}
            </p>
          ) : (
            streak.needsToday && (
              <p className="mt-1 text-[10px] leading-tight text-arena-text-dim">сегодня ещё не было</p>
            )
          )}
        </motion.div>
        {/* Presses of «+» live apart from the real count — they're taps, not push-ups. */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17 }}
          className="rounded-2xl border border-arena-border bg-arena-surface p-4 text-center"
        >
          <div className="flex items-center justify-center gap-1">
            <MousePointerClick size={16} className="text-arena-amber" />
            <p className="text-2xl font-bold tabular-nums text-arena-text">
              <CountUp value={profile.clickerTaps ?? 0} />
            </p>
          </div>
          <p className="text-xs text-arena-text-dim">кликер</p>
          <p className="mt-1 text-[10px] leading-tight text-arena-text-dim">не в зачёт</p>
        </motion.div>
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
                {derived.enemy.name}{derived.enemy.isBoss ? '' : ` — подчинённый ${derived.boss.nameGenitive}`}
              </span>
              <ChevronRight size={14} className="shrink-0 text-arena-amber" />
            </p>
            {!derived.allBossesDefeated ? (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-arena-surface-2">
                  <div
                    className="h-full rounded-full bg-arena-red"
                    style={{ width: `${Math.max(0, Math.min(100, (profile.enemyHp / Math.max(1, derived.enemy.hp)) * 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-arena-text-dim">
                  {stageProgressLabel(derived.stageStep)} · этап {derived.bossIndex + 1} из {BOSSES.length}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs font-medium text-arena-amber">Арена пройдена полностью</p>
            )}
          </div>
        </button>
      </section>
        </div>

        <div>
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
        </div>
      </div>

      {FEEDBACK_FORM_URL && (
        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-arena-border bg-arena-surface px-4 py-3 text-sm font-medium text-arena-text active:scale-[0.99]"
        >
          <MessageSquare size={16} className="text-arena-amber" />
          Предложить улучшение или сообщить об ошибке
        </a>
      )}

      <AnimatePresence>
        {openBoss && openIndex != null && (
          <BossProfileModal
            boss={openBoss}
            index={openIndex}
            hpLeft={derived.stageStep >= 3 ? profile.enemyHp : derived.boss.hp}
            status={bossStatusAt(openIndex, derived.bossIndex, profile.bossesDefeated)}
            level={derived.level}
            rankName={derived.rank.name}
            onClose={() => setOpenIndex(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}</AnimatePresence>

      <AnimatePresence>
        {shopOpen && (
          <ShopModal
            profile={profile}
            buyUpgrade={buyUpgrade}
            buyFreeze={buyFreeze}
            onPurchased={onPurchased}
            onClose={() => setShopOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
