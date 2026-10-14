import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Flame, RefreshCw, Trophy, Zap } from 'lucide-react';
import type { ProfileRecord, RepResult, RepUndo, ToastKind } from '../types';
import type { Feedback } from '../hooks/useFeedback';
import { ACHIEVEMENTS } from '../data/achievements';
import { streakNotices } from '../lib/streak';
import { CameraPanel } from './CameraPanel';
import { Burst } from './Burst';
import { GhostRace } from './GhostRace';
import { DuelHud } from './DuelHud';
import { DuelResult } from './DuelResult';
import { DuelEntry, DuelMatching, DuelVersus } from './DuelLobby';
import { tapCounter, tryOpenDevPanel } from '../lib/devGate';
import { ghostAt } from '../lib/ghost';
import { DUEL_DAILY_LIMIT, DUEL_START, duelOutcome, duelsToday, exhaustedToday, pickOpponent, sparringRun, type DuelOutcome } from '../data/duel';
import type { DuelOpponent } from '../lib/cloud';
import { localDay } from '../lib/stats';

const DURATION_S = 60;
const COMBO_WINDOW_MS = 2000;

/** Seconds counted down before the clock starts — time to get down into position. */
const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 800;
/** The final stretch, where the clock turns red and starts to pound. */
const FINAL_SECONDS = 10;
/** Combo at which the card catches fire. */
const HOT_COMBO = 5;

type SessionState = 'idle' | 'matching' | 'versus' | 'countdown' | 'running' | 'finished';

/**
 * Who a 1 на 1 is against: a player's recorded best Rush, or — when there's nobody to challenge —
 * the sparring robot, which is unrated (`rating` null).
 */
interface Rival {
  id: string | null;
  name: string;
  avatar: string | null;
  level?: number;
  rating: number | null;
  best: number;
  run: number[] | null;
}

let plusId = 0;

export function RushView({
  profile,
  registerRushRep,
  revertRep,
  finishRush,
  feedback,
  notify,
  me,
  fetchOpponents,
  recordDuel,
}: {
  profile: ProfileRecord;
  registerRushRep: () => Promise<RepResult>;
  revertRep: (u: RepUndo) => Promise<void>;
  finishRush: (reps: number, bestCombo: number, run: number[]) => Promise<{ isNewRecord: boolean; newAchievements: string[] }>;
  feedback: Feedback;
  notify: (kind: ToastKind, title: string, description?: string) => void;
  /** You, as the 1 на 1 card shows you; null name when not signed in. */
  me: { name: string | null; avatar: string | null; level: number };
  /** Players to challenge near a rating (empty when not signed in or nobody's there). */
  fetchOpponents: (rating: number) => Promise<DuelOpponent[]>;
  /** Books a 1 на 1's result; `opponent` null for an unrated sparring round. */
  recordDuel: (outcome: DuelOutcome, opponent: { id: string; rating: number } | null) => Promise<{ before: number; after: number }>;
}) {
  const [state, setState] = useState<SessionState>('idle');
  const [timeLeft, setTimeLeft] = useState(DURATION_S);
  const [reps, setReps] = useState(0);
  const [combo, setCombo] = useState(1);
  const [bestComboSession, setBestComboSession] = useState(1);
  /** 3, 2, 1, then 0 for "GO!". */
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const [newRecord, setNewRecord] = useState(false);
  /** Floating "+1"s, one per rep. */
  const [pluses, setPluses] = useState<number[]>([]);
  const calm = useReducedMotion();
  const devTap = useMemo(() => tapCounter(tryOpenDevPanel), []);

  /** When the clock started, and when each rep of this run landed — the next ghost if it wins. */
  const startedAtRef = useRef(0);
  const runRef = useRef<number[]>([]);
  /** The record being raced, frozen at the start so beating it mid-run doesn't move the target. */
  const [ghost, setGhost] = useState<{ run: number[] | undefined; best: number }>({ run: undefined, best: 0 });
  const [elapsed, setElapsed] = useState(0);

  /** Solo against your own record, or 1 на 1 against someone else's. */
  const [mode, setMode] = useState<'solo' | 'duel'>('solo');
  const [rival, setRival] = useState<Rival | null>(null);
  /** How the last 1 на 1 went. */
  const [duelResult, setDuelResult] = useState<{ outcome: DuelOutcome; before: number; after: number; rated: boolean } | null>(null);
  /** Opponents met lately, so "another one" finds someone else. */
  const recentRef = useRef<Set<string>>(new Set());
  const myRating = profile.duelRating ?? DUEL_START;
  /** Rated duels against the current rival today, out of DUEL_DAILY_LIMIT. */
  const today = localDay(Date.now());
  const rivalToday = rival?.id ? duelsToday(profile.duelDay, today, rival.id) : 0;
  const rivalSpent = !!rival?.id && rivalToday >= DUEL_DAILY_LIMIT;
  /** Why the robot came out instead of a player: nobody to call, or everyone near used up for today. */
  const [allSpent, setAllSpent] = useState(false);

  // Advance the ghost a few times a second; the clock's own one-second tick is too coarse.
  useEffect(() => {
    if (state !== 'running') return;
    startedAtRef.current = performance.now();
    setElapsed(0);
    const id = window.setInterval(() => setElapsed(performance.now() - startedAtRef.current), 200);
    return () => window.clearInterval(id);
  }, [state]);

  const lastRepAtRef = useRef(0);
  const undoStackRef = useRef<RepUndo[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
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

  // The count-in. The camera is already up underneath it, so the first rep after "GO!" counts.
  useEffect(() => {
    if (state !== 'countdown') return;
    if (count > 0) feedback.rep();
    else feedback.levelUp();
    const id = window.setTimeout(
      () => (count > 0 ? setCount(count - 1) : setState('running')),
      count > 0 ? COUNTDOWN_STEP_MS : 500,
    );
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, count]);

  useEffect(() => {
    if (state === 'running' && timeLeft === 0) {
      void endSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, state]);

  /** Finds someone to take on: a player rated near you with a record, or the sparring robot. */
  const findRival = async () => {
    // No record, no duel: the record is what goes up against theirs.
    if (!(profile.rushBestReps > 0)) return;
    setMode('duel');
    setDuelResult(null);
    setState('matching');
    // Long enough for the search to read as one, even when the answer is instant.
    const [list] = await Promise.all([fetchOpponents(myRating), new Promise((r) => window.setTimeout(r, 1300))]);
    // Whoever you've already met DUEL_DAILY_LIMIT times today sits out until tomorrow.
    const spent = exhaustedToday(profile.duelDay, localDay(Date.now()));
    let picked = pickOpponent(list, myRating, new Set([...recentRef.current, ...spent]));
    // Met everyone near you lately: start the round of them again.
    if (!picked && recentRef.current.size) {
      recentRef.current.clear();
      picked = pickOpponent(list, myRating, spent);
    }
    setAllSpent(!picked && list.some((c) => c.rushBest > 0 && spent.has(c.id)));
    if (picked) {
      recentRef.current.add(picked.id);
      setRival({ id: picked.id, name: picked.name, avatar: picked.avatar, level: picked.level, rating: picked.rating, best: picked.rushBest, run: picked.run });
    } else {
      // Nobody to challenge yet: a robot about as good as your own best.
      const best = Math.max(12, profile.rushBestReps || 15);
      setRival({ id: null, name: 'Спарринг-робот', avatar: null, rating: null, best, run: sparringRun(best) });
    }
    setState('versus');
  };

  const startSession = (as: 'solo' | 'duel' = mode) => {
    setMode(as);
    setDuelResult(null);
    setReps(0);
    setCombo(1);
    setBestComboSession(1);
    repsRef.current = 0;
    bestComboRef.current = 1;
    lastRepAtRef.current = 0;
    undoStackRef.current = [];
    setUndoDepth(0);
    setTimeLeft(DURATION_S);
    setNewRecord(false);
    setPluses([]);
    runRef.current = [];
    // The ghost: your record solo, their record in a 1 на 1.
    setGhost(as === 'duel' && rival ? { run: rival.run ?? undefined, best: rival.best } : { run: profile.rushBestRun, best: profile.rushBestReps });
    setCount(COUNTDOWN_FROM);
    setState('countdown');
  };

  const endSession = async () => {
    setState('finished');
    feedback.rushEnd();
    const { isNewRecord, newAchievements } = await finishRush(repsRef.current, bestComboRef.current, runRef.current);
    if (isNewRecord && repsRef.current > 0) {
      setNewRecord(true);
      notify('record', 'Новый личный рекорд!', `${repsRef.current} повторов за 60 секунд`);
    }
    for (const id of newAchievements) {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) notify('achievement', `Достижение: ${def.title}`, def.description);
    }
    if (mode === 'duel' && rival) {
      const outcome = duelOutcome(repsRef.current, rival.best);
      // Past today's limit against them it's still a fight, just not for rating.
      const rated = rival.id != null && rival.rating != null && !rivalSpent;
      const { before, after } = await recordDuel(outcome, rated ? { id: rival.id!, rating: rival.rating! } : null);
      setDuelResult({ outcome, before, after, rated });
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
      runRef.current.push(performance.now() - startedAtRef.current);
      const id = ++plusId;
      setPluses((p) => [...p, id]);
      window.setTimeout(() => setPluses((p) => p.filter((x) => x !== id)), 700);

      const result = await registerRushRep();
      undoStackRef.current.push(result.undo);
      setUndoDepth(undoStackRef.current.length);
      // Same rule as the arena: the level-up chime replaces the rep beep instead of piling on it.
      if (result.leveledUp) feedback.levelUp();
      else feedback.rep();
      if (result.leveledUp) notify('level-up', `Новый уровень: ${result.newLevel}`);
      for (const [title, desc] of streakNotices(result)) notify('info', title, desc);
      if (result.weeklyBonus > 0) notify('record', 'Цель недели выполнена!', `+${result.weeklyBonus} XP`);
      for (const id of result.newAchievements) {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) notify('achievement', `Достижение: ${def.title}`, def.description);
      }
    } finally {
      busyRef.current = false;
    }
  };

  const handleUndo = async () => {
    if (state !== 'running') return;
    // Pop first: the on-screen counter used to drop even when there was nothing left to revert,
    // so the number and the saved progress drifted apart.
    const last = undoStackRef.current.pop();
    setUndoDepth(undoStackRef.current.length);
    if (!last) return;
    setReps((r) => {
      const nr = Math.max(0, r - 1);
      repsRef.current = nr;
      return nr;
    });
    setCombo(1);
    runRef.current.pop();
    await revertRep(last);
  };

  const hot = combo >= HOT_COMBO;
  const final = state === 'running' && timeLeft <= FINAL_SECONDS;
  // The ring empties with the clock. Circumference of r=16 in a 36-unit box.
  const RING = 2 * Math.PI * 16;

  // In a 1 на 1 the scoreboard plaque stands in for the clock, combo, counter and ghost track.
  const dueling = mode === 'duel' && !!rival && (state === 'running' || state === 'countdown');
  // …and around it — the search, the face-off, the result — the duel cards have the screen to themselves.
  const duelOver = state === 'matching' || (mode === 'duel' && !!rival && (state === 'versus' || state === 'finished'));
  const ghostReps = ghostAt(ghost.run, ghost.best, elapsed, DURATION_S * 1000);

  return (
    <div className="arena-page relative pb-8 pt-6 text-center">
      {dueling && rival ? (
        <DuelHud
          you={{ name: me.name ?? 'Ты', avatar: me.avatar, level: me.level, rating: myRating }}
          rival={{ name: rival.name, avatar: rival.avatar, level: rival.level, rating: rival.rating, emoji: rival.id ? undefined : '🤖' }}
          myReps={reps}
          rivalReps={ghostReps}
          timeLeft={timeLeft}
          duration={DURATION_S}
          final={final}
          rated={rival.id != null && rival.rating != null && !rivalSpent}
          myBest={profile.rushBestReps}
          combo={combo}
        />
      ) : duelOver ? null : (
      <>
      <h1 className="mb-1 text-xl font-bold text-arena-text">Speed Rush</h1>
      <p className="mb-4 text-xs text-arena-text-dim">60 секунд, максимум повторов, комбо за темп</p>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {/* The clock as a ring that drains. Red and pounding through the last ten seconds. */}
        <div
          className={`rounded-2xl border bg-arena-surface p-3 transition-colors ${
            final ? 'border-arena-red' : 'border-arena-border'
          }`}
        >
          <motion.div
            key={final ? timeLeft : 'steady'}
            initial={final && !calm ? { scale: 1.18 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            className="relative mx-auto h-12 w-12"
          >
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-arena-surface-2)" strokeWidth="3" />
              <motion.circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                stroke={final ? 'var(--color-arena-red)' : 'var(--color-arena-amber)'}
                strokeDasharray={RING}
                animate={{ strokeDashoffset: RING * (1 - timeLeft / DURATION_S) }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </svg>
            <span
              className={`absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums ${
                final ? 'text-arena-red' : 'text-arena-text'
              }`}
            >
              {timeLeft}
            </span>
          </motion.div>
          <p className="mt-1 text-[10px] uppercase text-arena-text-dim">время</p>
        </div>

        {/* The combo heats up: the glow grows with every link, and past five it catches fire. */}
        <motion.div
          className="relative overflow-hidden rounded-2xl border border-arena-border bg-arena-surface p-3"
          animate={{
            boxShadow: `0 0 ${Math.min(combo, 12) * 3}px rgba(245, 158, 11, ${Math.min(combo, 12) * 0.05})`,
            borderColor: hot ? 'rgba(245, 158, 11, 0.8)' : 'var(--color-arena-border)',
          }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex items-center justify-center gap-1 text-arena-text-dim">
            {hot ? (
              <motion.span
                animate={calm ? {} : { rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="text-arena-red"
              >
                <Flame size={14} fill="currentColor" />
              </motion.span>
            ) : (
              <Zap size={14} />
            )}
            <span className="text-[10px] uppercase">{hot ? 'огонь' : 'комбо'}</span>
          </div>
          <motion.p
            key={combo}
            initial={calm ? false : { scale: combo > 1 ? 1.6 : 0.8, rotate: combo > 1 ? -8 : 0 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 14 }}
            className="mt-2 text-2xl font-bold tabular-nums text-arena-amber"
          >
            x{combo}
          </motion.p>
        </motion.div>

        <div className="rounded-2xl border border-arena-border bg-arena-surface p-3">
          <div className="flex items-center justify-center gap-1 text-arena-text-dim">
            <Trophy size={14} />
            <span className="text-[10px] uppercase">рекорд</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-arena-text">{profile.rushBestReps}</p>
        </div>
      </div>

      <div className="relative mb-5 overflow-hidden rounded-2xl border border-arena-border bg-arena-surface p-6">
        <motion.p
          key={reps}
          initial={calm || reps === 0 ? false : { scale: 1.25, y: -4 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 600, damping: 18 }}
          className="text-6xl font-extrabold tabular-nums text-arena-text"
        >
          {reps}
        </motion.p>
        <p className="mt-1 text-xs text-arena-text-dim">
          повторов{bestComboSession > 1 ? ` · лучшее комбо x${bestComboSession}` : ''}
        </p>
        <AnimatePresence>
          {pluses.map((id) => (
            <motion.span
              key={id}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], y: -46, scale: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="pointer-events-none absolute right-8 top-8 text-lg font-extrabold text-arena-amber"
            >
              +1
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* The race against the record: two bars, you and the ghost of your best run. */}
      {(state === 'running' || state === 'countdown') && ghost.best > 0 && (
        <GhostRace
          you={reps}
          ghost={ghostReps}
          best={ghost.best}
        />
      )}
      </>
      )}

      {state === 'idle' && (
        <>
          {/* The pulse moves a wrapper: the button's own transform is its press. */}
          <motion.div
            animate={calm ? {} : { scale: [1, 1.03, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <button onClick={() => startSession('solo')} className="btn-3d w-full">
              Начать Rush
            </button>
          </motion.div>
          {/* 1 на 1: a minute against someone else's record — once you have one of your own. */}
          <DuelEntry
            rating={myRating}
            wins={profile.duelWins ?? 0}
            losses={profile.duelLosses ?? 0}
            draws={profile.duelDraws ?? 0}
            locked={!(profile.rushBestReps > 0)}
            onFind={() => void findRival()}
          />
        </>
      )}

      {state === 'matching' && <DuelMatching you={{ name: me.name ?? 'Ты', avatar: me.avatar, level: me.level, rating: myRating }} />}

      {state === 'versus' && rival && (
        <DuelVersus
          you={{ name: me.name ?? 'Ты', avatar: me.avatar, level: me.level, rating: myRating }}
          rival={{ name: rival.name, avatar: rival.avatar, level: rival.level, rating: rival.rating, emoji: rival.id ? undefined : '🤖' }}
          myBest={profile.rushBestReps}
          rivalBest={rival.best}
          today={rival.id ? rivalToday : null}
          spent={rivalSpent}
          note={
            rival.id
              ? undefined
              : allSpent
                ? 'С соперниками твоего уровня на сегодня всё — разомнись с роботом, завтра снова.'
                : me.name
                  ? 'Пока некого вызвать — разомнись с роботом.'
                  : 'Войди в аккаунт, чтобы соревноваться с живыми игроками.'
          }
          onFight={() => startSession('duel')}
          onAnother={() => void findRival()}
          onBack={() => setState('idle')}
        />
      )}
      {/* Step two of the way into the dev panel: an invisible patch under the start button.
          Not announced to screen readers and out of the tab order — it isn't a control. */}
      {state === 'idle' && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={devTap}
          className="mt-1 block h-12 w-full cursor-default opacity-0"
        />
      )}

      {state === 'finished' && (
        <div className="space-y-3">
          {mode === 'duel' && rival ? (
            <DuelResult
              you={{ name: me.name ?? 'Ты', avatar: me.avatar, level: me.level, rating: myRating }}
              rival={{ name: rival.name, avatar: rival.avatar, level: rival.level, rating: rival.rating, emoji: rival.id ? undefined : '🤖' }}
              myReps={reps}
              rivalReps={rival.best}
              outcome={duelOutcome(reps, rival.best)}
              rating={duelResult}
              newRecord={newRecord}
              bestCombo={bestComboSession}
              onVerdict={() => {
                if (duelOutcome(repsRef.current, rival.best) === 'win') feedback.levelUp();
              }}
            />
          ) : (
          <>
          {/* The bell: a stamp that slams down, and confetti if the record fell. */}
          <div className="relative flex flex-col items-center py-2">
            <motion.span
              initial={calm ? false : { scale: 3, rotate: -24, opacity: 0 }}
              animate={{ scale: 1, rotate: -8, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 480, damping: 16 }}
              className={`rounded-lg border-4 px-4 py-1 text-2xl font-black uppercase tracking-wider ${
                newRecord ? 'border-arena-amber text-arena-amber' : 'border-arena-red text-arena-red'
              }`}
            >
              {newRecord ? 'Рекорд!' : 'Время!'}
            </motion.span>
            {newRecord && <Burst count={28} spread={110} confetti />}
          </div>
          <p className="text-sm text-arena-text-dim">
            Готово: <span className="font-semibold text-arena-text">{reps}</span> повторов
          </p>
          </>
          )}
          {mode === 'duel' && rival ? (
            // The buttons wait for the reveal to play out.
            <motion.div
              className="space-y-3"
              initial={calm ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.6, duration: 0.3 }}
            >
              {/* No rematch past the daily limit: that's how one record gets farmed for rating. */}
              {rivalSpent ? (
                <p className="rounded-xl bg-arena-surface-2 px-3 py-2.5 text-xs text-arena-text-dim">
                  На сегодня с этим соперником всё — не больше {DUEL_DAILY_LIMIT} боёв в день с одним. Реванш завтра.
                </p>
              ) : (
                <button onClick={() => startSession('duel')} className="btn-3d w-full">
                  Реванш{rival.id ? ` · ${rivalToday}/${DUEL_DAILY_LIMIT}` : ''}
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => void findRival()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-arena-surface-2 py-2.5 text-xs font-medium text-arena-text active:scale-[0.98]"
                >
                  <RefreshCw size={13} /> Новый соперник
                </button>
                <button
                  onClick={() => {
                    setMode('solo');
                    setState('idle');
                  }}
                  className="flex-1 rounded-xl bg-arena-surface-2 py-2.5 text-xs font-medium text-white active:scale-[0.98]"
                >
                  Назад
                </button>
              </div>
            </motion.div>
          ) : (
            <button onClick={() => startSession('solo')} className="btn-3d w-full">
              Ещё раз
            </button>
          )}
        </div>
      )}

      {/* Mounted for the count-in too, so the camera is already up when the clock starts. */}
      {(state === 'running' || state === 'countdown') && (
        <CameraPanel onRep={handleRep} onUndo={handleUndo} canUndo={undoDepth > 0} feedback={feedback} />
      )}

      <AnimatePresence>
        {state === 'countdown' && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/70"
          >
            {/* Each number replaces the last outright and punches in. No exit animation: with
                one the outgoing digit sometimes hung on under the next on a quick change. */}
            <motion.span
              key={count}
              initial={calm ? { opacity: 0 } : { scale: 2.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
              className={`text-[9rem] font-black leading-none ${count > 0 ? 'text-arena-text' : 'text-arena-amber'}`}
              style={{ textShadow: '0 0 40px rgba(245, 158, 11, 0.6)' }}
            >
              {count > 0 ? count : 'GO!'}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
