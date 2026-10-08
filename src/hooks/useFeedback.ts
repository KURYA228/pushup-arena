import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HitSound } from '../data/bosses';
import {
  installAudioUnlock,
  loadFeedbackPrefs,
  playBossDefeat,
  playBossEncounter,
  playLevelUp,
  playPurchase,
  playRep,
  playRushEnd,
  saveFeedbackPrefs,
  vibrationSupported,
  type FeedbackPrefs,
} from '../lib/feedback';

/** Shared feedback settings plus the cues bound to them. */
export function useFeedback() {
  const [prefs, setPrefs] = useState<FeedbackPrefs>(loadFeedbackPrefs);

  useEffect(() => {
    installAudioUnlock();
  }, []);

  const update = useCallback((patch: Partial<FeedbackPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      saveFeedbackPrefs(next);
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      prefs,
      setSound: (on: boolean) => update({ sound: on }),
      setVibration: (on: boolean) => update({ vibration: on }),
      canVibrate: vibrationSupported(),
      /** `sound` lets a stage ask for its own rep cue; left out, the ordinary beep plays. */
      rep: (crit = false, sound?: HitSound) => playRep(prefs, crit, sound),
      bossDefeat: () => playBossDefeat(prefs),
      bossEncounter: () => playBossEncounter(prefs),
      levelUp: () => playLevelUp(prefs),
      rushEnd: () => playRushEnd(prefs),
      purchase: () => playPurchase(prefs),
    }),
    [prefs, update],
  );
}

export type Feedback = ReturnType<typeof useFeedback>;
