import { useEffect, useRef } from 'react';

/**
 * Keeps the screen awake while `active`.
 *
 * Without this the phone locks about half a minute into a set, which kills the camera stream and
 * leaves you doing push-ups in front of a dark screen.
 *
 * Two details the API forces on us: the lock is dropped whenever the page is hidden, so it has to
 * be re-acquired on `visibilitychange`; and `request` rejects on its own (low battery, policy),
 * which is not worth surfacing — the screen simply behaves as it did before.
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible' || sentinelRef.current) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Denied or unavailable — nothing to do but let the screen time out normally.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
