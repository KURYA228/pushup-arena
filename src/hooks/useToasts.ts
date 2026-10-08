import { useCallback, useRef, useState } from 'react';
import type { ToastItem, ToastKind } from '../types';

let idCounter = 0;

/**
 * At most this many on screen. One rep can kill a boss, level you up and unlock two achievements
 * at once; stacked in full that was a wall over the top third of the fight screen.
 */
const MAX_VISIBLE = 2;

/** How long each kind stays. Short: these confirm what the flash and sound already said. */
const DURATION_MS: Record<ToastKind, number> = {
  'boss-defeat': 2200,
  'level-up': 2200,
  info: 2600,
  achievement: 3000,
  record: 3000,
};

/**
 * Which go first when there are too many. Not "the newest": on a killing blow the achievements
 * arrive last, and keeping the newest two threw away the boss and the level-up — the two things
 * the player actually wants to see. What doesn't fit waits in line rather than being lost.
 */
const PRIORITY: Record<ToastKind, number> = {
  record: 4,
  'boss-defeat': 3,
  'level-up': 3,
  info: 2,
  achievement: 1,
};

const byPriority = (a: ToastItem, b: ToastItem) => PRIORITY[b.kind] - PRIORITY[a.kind];
const achievementName = (title: string) => title.replace(/^Достижени[ея]: /, '');

/** Achievements that land together become one pill: "Достижения: A, B". */
function mergeAchievement(list: ToastItem[], item: ToastItem): ToastItem[] | null {
  if (item.kind !== 'achievement') return null;
  const open = list.find((t) => t.kind === 'achievement');
  if (!open) return null;
  const merged: ToastItem = {
    id: open.id,
    kind: 'achievement',
    title: `Достижения: ${achievementName(open.title)}, ${achievementName(item.title)}`,
  };
  return list.map((t) => (t === open ? merged : t));
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // The source of truth lives in refs and is mirrored into state for rendering. Timers and the
  // queue are side effects, and a state updater is not the place for them — React may run an
  // updater twice, which would start every timer twice.
  const visibleRef = useRef<ToastItem[]>([]);
  /** Waiting for room, most important first. */
  const queueRef = useRef<ToastItem[]>([]);

  const commit = useCallback((list: ToastItem[]) => {
    visibleRef.current = list;
    setToasts(list);
  }, []);

  const startTimer = useCallback(
    (item: ToastItem) => {
      window.setTimeout(() => {
        const visible = visibleRef.current;
        // Bumped back into the queue meanwhile: nothing on screen to remove, no room freed.
        if (!visible.some((t) => t.id === item.id)) return;
        const rest = visible.filter((t) => t.id !== item.id);
        const next = queueRef.current.shift();
        if (next) startTimer(next);
        commit(next ? [...rest, next] : rest);
      }, DURATION_MS[item.kind]);
    },
    [commit],
  );

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const item: ToastItem = { id: `t${++idCounter}`, kind, title, description };
      const visible = visibleRef.current;

      const merged = mergeAchievement(visible, item);
      if (merged) return commit(merged);
      const queued = mergeAchievement(queueRef.current, item);
      if (queued) {
        queueRef.current = queued;
        return;
      }

      if (visible.length < MAX_VISIBLE) {
        startTimer(item);
        return commit([...visible, item]);
      }
      // Full: the least important of what's showing and the newcomer waits in line.
      const keep = [...visible, item].sort(byPriority).slice(0, MAX_VISIBLE);
      // A fresh id for anything sent back to wait, so a timer it started on screen can't later
      // cut its second showing short.
      const bumped = [...visible, item]
        .filter((t) => !keep.includes(t))
        .map((t) => ({ ...t, id: `t${++idCounter}` }));
      queueRef.current = [...queueRef.current, ...bumped].sort(byPriority);
      if (keep.includes(item)) startTimer(item);
      // Survivors stay where they were; the newcomer goes at the end.
      commit([...visible.filter((t) => keep.includes(t)), ...keep.filter((t) => !visible.includes(t))]);
    },
    [commit, startTimer],
  );

  const dismiss = useCallback(
    (id: string) => commit(visibleRef.current.filter((t) => t.id !== id)),
    [commit],
  );

  return { toasts, push, dismiss };
}
