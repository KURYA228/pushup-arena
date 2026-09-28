import { useState } from 'react';
import { useProfile } from './hooks/useProfile';
import { useFeedback } from './hooks/useFeedback';
import { useWakeLock } from './hooks/useWakeLock';
import { useToasts } from './hooks/useToasts';
import { NavBar, type ViewId } from './components/NavBar';
import { ToastStack } from './components/ToastStack';
import { HomeView } from './components/HomeView';
import { BossView } from './components/BossView';
import { RushView } from './components/RushView';
import { LeaderboardView } from './components/LeaderboardView';
import { useCloud } from './hooks/useCloud';

function App() {
  const [view, setView] = useState<ViewId>('home');
  const {
    profile,
    derived,
    registerBossRep,
    registerRushRep,
    finishRush,
    revertRep,
    tickArena,
    restoreProfile,
    devPatchProfile,
    devResetProfile,
  } = useProfile();
  const { toasts, push } = useToasts();
  const feedback = useFeedback();
  const cloud = useCloud(profile, derived?.level ?? 1);
  // Keep the screen alive on the two screens where you're actually working out.
  useWakeLock(view === 'boss' || view === 'rush');

  if (!profile || !derived) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-arena-bg text-arena-text-dim">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="safe-top safe-x flex min-h-screen flex-col bg-arena-bg">
      <ToastStack toasts={toasts} />
      <main className="flex-1 overflow-y-auto">
        {view === 'home' && (
          <HomeView
            profile={profile}
            derived={derived}
            devPatchProfile={devPatchProfile}
            devResetProfile={devResetProfile}
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
          />
        )}
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
      </main>
      <NavBar current={view} onChange={setView} />
    </div>
  );
}

export default App;
