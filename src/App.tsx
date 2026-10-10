import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useProfile } from './hooks/useProfile';
import { useFeedback } from './hooks/useFeedback';
import { useWakeLock } from './hooks/useWakeLock';
import { useToasts } from './hooks/useToasts';
import { NavBar, type ViewId } from './components/NavBar';
import { ToastStack } from './components/ToastStack';
import { RankUpOverlay } from './components/RankUpOverlay';
import { useRankUpQueue } from './lib/rankEvents';
import { HomeView } from './components/HomeView';
import { BossView } from './components/BossView';
import { RushView } from './components/RushView';
import { LeaderboardView } from './components/LeaderboardView';
import { StatsView } from './components/StatsView';
import { AuthView } from './components/AuthView';
import { Intro } from './components/Intro';
import { SyncGate } from './components/SyncGate';
import { hasSeenIntro } from './lib/intro';
import { useCloud } from './hooks/useCloud';
import { DevPanel } from './components/DevPanel';
import { onDevPanelOpen } from './lib/devGate';
import { isAdmin } from './lib/cloud';

function App() {
  const [view, setView] = useState<ViewId>('home');
  /** Set by "играть без аккаунта" — the welcome screen is a door, never a lock. */
  const [entered, setEntered] = useState(false);
  /** The cold open, first launch only. Read once so it can't flicker back mid-session. */
  const [introDone, setIntroDone] = useState(hasSeenIntro);
  /** Opened from anywhere through the dev gate (src/lib/devGate.ts), so it lives up here. */
  const [devOpen, setDevOpen] = useState(false);
  // In a published build the gesture alone opens nothing: the account must also be an admin,
  // which the database decides (supabase/admin.sql). Knowing the gesture — it's in the source,
  // and the source is public — gets nobody in. Locally, in `npm run dev`, it opens for anyone.
  useEffect(
    () =>
      onDevPanelOpen(() => {
        if (import.meta.env.DEV) return setDevOpen(true);
        void isAdmin().then((yes) => yes && setDevOpen(true));
      }),
    [],
  );
  const {
    profile,
    derived,
    registerBossRep,
    registerRushRep,
    finishRush,
    revertRep,
    tickArena,
    buyUpgrade,
    buyFreeze,
    setWeeklyGoal,
    restoreProfile,
    devPatchProfile,
    devResetProfile,
    startReplay,
    endReplay,
  } = useProfile();
  const { toasts, push } = useToasts();
  const feedback = useFeedback();
  const rankUps = useRankUpQueue();
  const cloud = useCloud(profile, derived?.level ?? 1, restoreProfile);
  // Keep the screen alive on the two screens where you're actually working out.
  useWakeLock(view === 'boss' || view === 'rush');

  // The cold open goes before everything, including the loading state — it's the first thing
  // anyone sees, and the session can settle behind it.
  if (!introDone) return <Intro onDone={() => setIntroDone(true)} />;

  // Wait for the session before drawing anything: showing the game and then replacing it with a
  // welcome screen half a second later is worse than a moment of nothing.
  if (!profile || !derived || (cloud.configured && !cloud.ready)) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-arena-bg text-arena-text-dim">
        Загрузка…
      </div>
    );
  }

  /**
   * The front door: a screen of its own, before the app's tabs exist. An unconfirmed session
   * (offline) counts as signed in — that case shows a retry inside the app, not a locked door.
   */
  if (cloud.configured && !cloud.session && !cloud.unreachable && !entered) {
    return (
      <div className="safe-top safe-x safe-bottom min-h-screen overflow-y-auto bg-arena-bg">
        <AuthView cloud={cloud} onSkip={() => setEntered(true)} />
      </div>
    );
  }

  return (
    <div className="safe-top safe-x flex min-h-screen flex-col bg-arena-bg">
      <ToastStack toasts={toasts} />
      <RankUpOverlay current={rankUps.current} onDone={rankUps.next} onShow={feedback.rankUp} />
      <SyncGate cloud={cloud} />
      <main className="flex-1 overflow-y-auto">
        {/*
          Keyed by tab so the incoming screen fades up instead of appearing as a hard cut, which
          on a phone reads as a page reload. Deliberately no exit animation: waiting for one
          would hold the new tab hostage to the old tab's fade, and animations stop while the
          page is hidden — a screen backgrounded mid-switch could come back stuck on neither.
        */}
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
            {view === 'home' && (
              <HomeView
                profile={profile}
                derived={derived}
                buyUpgrade={buyUpgrade}
                buyFreeze={buyFreeze}
                setWeeklyGoal={setWeeklyGoal}
                onPurchased={feedback.purchase}
                onReplay={(i) => {
                  void startReplay(i).then((ok) => {
                    if (ok) setView('boss');
                  });
                }}
              />
            )}
            {view === 'boss' && (
              <BossView
                profile={profile}
                derived={derived}
                registerBossRep={registerBossRep}
                revertRep={revertRep}
                tickArena={tickArena}
                feedback={feedback}
                notify={push}
                endReplay={endReplay}
              />
            )}
            {view === 'stats' && <StatsView profile={profile} />}
            {view === 'board' && (
              <LeaderboardView cloud={cloud} profile={profile} onRestore={restoreProfile} />
            )}
            {view === 'rush' && (
              <RushView
                profile={profile}
                registerRushRep={registerRushRep}
                revertRep={revertRep}
                finishRush={finishRush}
                feedback={feedback}
                notify={push}
              />
            )}
        </motion.div>
      </main>
      <NavBar current={view} onChange={setView} />
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

export default App;
