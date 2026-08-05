import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer, Trophy, Zap } from 'lucide-react';
import type { ProfileRecord, RepResult, ToastKind } from '../types';
import { ACHIEVEMENTS } from '../data/achievements';
import { CameraPanel } from './CameraPanel';

const DURATION_S = 60;
const COMBO_WINDOW_MS = 2000;

type SessionState = 'idle' | 'running' | 'finished';

export function RushView({
  profile,
  registerRushRep,
  revertRushRep,
  finishRush,
  notify,
}: {
  profile: ProfileRecord;
  registerRushRep: () => Promise<RepResult>;
  revertRushRep: (r: RepResult) => Promise<void>;
  finishRush: (reps: number, bestCombo: number) => Promise<{ isNewRecord: boolean; newAchievements: string[] }>;
  notify: (kind: ToastKind, title: string, description?: string) => void;
}) {
  const [state, setState] = useState<SessionState>('idle');
  const [timeLeft, setTimeLeft] = useState(DURATION_S);
  const [reps, setReps] = useState(0);
  const [combo, setCombo] = useState(1);
  const [bestComboSession, setBestComboSession] = useState(1);

  const lastRepAtRef = useRef(0);
  const lastResultRef = useRef<RepResult | null>(null);
  const repsRef = useRef(0);
  const bestComboRef = useRef(1);
  const busyRef = useRef(false);

  useEffect(() => {
    if (state !== 'running') return;
    const interval = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [state]);

  useEffect(() => {
    if (state === 'running' && timeLeft === 0) {
      void endSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, state]);

  const startSession = () => {
    setReps(0);
    setCombo(1);
    setBestComboSession(1);
    repsRef.current = 0;
    bestComboRef.current = 1;
    lastRepAtRef.current = 0;
    lastResultRef.current = null;
    setTimeLeft(DURATION_S);
    setState('running');
  };

  const endSession = async () => {
    setState('finished');
    const { isNewRecord, newAchievements } = await finishRush(repsRef.current, bestComboRef.current);
    if (isNewRecord && repsRef.current > 0) {
      notify('record', 'Новый личный рекорд!', `${repsRef.current} повторов за 60 секунд`);
    }
    for (const id of newAchievements) {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) notify('achievement', `Достижение: ${def.title}`, def.description);
    }
  };

  const handleRep = async () => {
    if (state !== 'running' || busyRef.current) return;
    busyRef.current = true;
    try {
      const now = performance.now();
      const nextCombo = now - lastRepAtRef.current < COMBO_WINDOW_MS ? combo + 1 : 1;
      lastRepAtRef.current = now;
      setCombo(nextCombo);
      setBestComboSession((b) => {
        const nb = Math.max(b, nextCombo);
        bestComboRef.current = nb;
        return nb;
      });
      setReps((r) => {
        const nr = r + 1;
        repsRef.current = nr;
        return nr;
      });

      const result = await registerRushRep();
      lastResultRef.current = result;
      if (result.leveledUp) notify('level-up', `Новый уровень: ${result.newLevel}`);
      for (const id of result.newAchievements) {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) notify('achievement', `Достижение: ${def.title}`, def.description);
      }
    } finally {
      busyRef.current = false;
    }
  };

  const handleUndo = async () => {
    if (state !== 'running' || reps === 0) return;
    const last = lastResultRef.current;
    setReps((r) => {
      const nr = Math.max(0, r - 1);
      repsRef.current = nr;
      return nr;
    });
    setCombo(1);
    if (last) {
      await revertRushRep(last);
      lastResultRef.current = null;
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-6 text-center">
      <h1 className="mb-1 text-xl font-bold text-arena-text">Speed Rush</h1>
      <p className="mb-4 text-xs text-arena-text-dim">60 секунд, максимум повторов, комбо за темп</p>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-arena-border bg-arena-surface p-3">
          <div className="flex items-center justify-center gap-1 text-arena-text-dim">
            <Timer size={14} />
            <span className="text-[10px] uppercase">время</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-arena-text">{timeLeft}</p>
        </div>
        <div className="rounded-2xl border border-arena-border bg-arena-surface p-3">
          <div className="flex items-center justify-center gap-1 text-arena-text-dim">
            <Zap size={14} />
            <span className="text-[10px] uppercase">комбо</span>
          </div>
          <motion.p
            key={combo}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-2xl font-bold tabular-nums text-arena-amber"
          >
            x{combo}
          </motion.p>
        </div>
        <div className="rounded-2xl border border-arena-border bg-arena-surface p-3">
          <div className="flex items-center justify-center gap-1 text-arena-text-dim">
            <Trophy size={14} />
            <span className="text-[10px] uppercase">рекорд</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-arena-text">{profile.rushBestReps}</p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-arena-border bg-arena-surface p-6">
        <p className="text-6xl font-extrabold tabular-nums text-arena-text">{reps}</p>
        <p className="mt-1 text-xs text-arena-text-dim">повторов{bestComboSession > 1 ? ` · лучшее комбо x${bestComboSession}` : ''}</p>
      </div>

      {state === 'idle' && (
        <button
          onClick={startSession}
          className="arena-glow w-full rounded-xl bg-arena-amber py-3 text-sm font-bold text-black active:scale-95"
        >
          Начать Rush
        </button>
      )}

      {state === 'finished' && (
        <div className="space-y-3">
          <p className="text-sm text-arena-text-dim">
            Готово: <span className="font-semibold text-arena-text">{reps}</span> повторов
          </p>
          <button
            onClick={startSession}
            className="arena-glow w-full rounded-xl bg-arena-amber py-3 text-sm font-bold text-black active:scale-95"
          >
            Ещё раз
          </button>
        </div>
      )}

      {state === 'running' && <CameraPanel onRep={handleRep} onUndo={handleUndo} />}
    </div>
  );
}
