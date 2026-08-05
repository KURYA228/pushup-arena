import { useState } from 'react';
import { useProfile } from './hooks/useProfile';
import { useToasts } from './hooks/useToasts';
import { NavBar, type ViewId } from './components/NavBar';
import { ToastStack } from './components/ToastStack';
import { HomeView } from './components/HomeView';
import { BossView } from './components/BossView';
import { RushView } from './components/RushView';

function App() {
  const [view, setView] = useState<ViewId>('home');
  const {
    profile,
    derived,
    registerBossRep,
    registerRushRep,
    finishRush,
    revertBossRep,
    revertRushRep,
    devPatchProfile,
    devResetProfile,
  } = useProfile();
  const { toasts, push } = useToasts();

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
            revertBossRep={revertBossRep}
            notify={push}
          />
        )}
        {view === 'rush' && (
          <RushView
            profile={profile}
            registerRushRep={registerRushRep}
            revertRushRep={revertRushRep}
            finishRush={finishRush}
            notify={push}
          />
        )}
      </main>
      <NavBar current={view} onChange={setView} />
    </div>
  );
}

export default App;
