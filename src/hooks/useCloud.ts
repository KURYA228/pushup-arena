import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ProfileRecord } from '../types';
import {
  cloudConfigured,
  ensurePlayer,
  fetchLeaderboard,
  fetchSave,
  getMyName,
  getSession,
  onAuthChange,
  pushProfile,
  signIn,
  signOut,
  signUp,
  takePendingName,
  type CloudError,
  type LeaderboardRow,
} from '../lib/cloud';

/** How long to sit on changes before pushing, so a fast set doesn't fire a write per rep. */
const SYNC_DEBOUNCE_MS = 4000;

/**
 * Account state and the push half of syncing.
 *
 * Uploads are debounced and fire-and-forget: a set can be forty reps in a minute, and neither
 * the network nor the user should feel that. Pulling the cloud save back down is deliberately
 * *not* automatic — that direction can overwrite progress, so it stays a button the user presses.
 */
export function useCloud(profile: ProfileRecord | undefined, level: number) {
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(!cloudConfigured());
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!cloudConfigured()) return;
    let alive = true;
    void getSession().then((s) => {
      if (!alive) return;
      setSession(s);
      setReady(true);
    });
    const off = onAuthChange((s) => {
      setSession(s);
      setReady(true);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setName(null);
      return;
    }
    void (async () => {
      let current = await getMyName();
      // Coming back from a confirmation link: the session is new and the public row was never
      // created, but the name typed at sign-up is still waiting in storage.
      if (!current) {
        const pending = takePendingName();
        if (pending) {
          await ensurePlayer(pending);
          current = await getMyName();
        }
      }
      setName(current);
    })();
  }, [session]);

  // Push on change, debounced. The signature keeps the effect from firing on unrelated renders.
  const signature = profile
    ? `${profile.totalPushups}|${profile.totalXp}|${profile.streak}|${profile.bossesDefeated.length}|${profile.rushBestReps}|${profile.currentBossIndex}|${profile.stageStep}`
    : '';
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    if (!session || !profile) return;
    const id = window.setTimeout(() => {
      const current = profileRef.current;
      if (!current) return;
      void pushProfile(current, level).then(() => setSyncedAt(Date.now()));
    }, SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, session, level]);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await signUp(email, password, displayName);
    if (!result.error && !result.needsConfirmation) setName(await getMyName());
    return result;
  }, []);

  const login = useCallback(async (email: string, password: string, displayName: string) => {
    const err = await signIn(email, password);
    if (err) return err;
    // First sign-in after a confirmed sign-up: the public row may still be missing.
    const existing = await getMyName();
    if (!existing && displayName.trim()) {
      const nameErr = await ensurePlayer(displayName);
      if (nameErr) return nameErr;
    }
    setName(await getMyName());
    return null as CloudError;
  }, []);

  const rename = useCallback(async (displayName: string) => {
    const err = await ensurePlayer(displayName);
    if (!err) setName(await getMyName());
    return err;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setSession(null);
    setName(null);
  }, []);

  const syncNow = useCallback(async () => {
    const current = profileRef.current;
    if (!current) return;
    await pushProfile(current, level);
    setSyncedAt(Date.now());
  }, [level]);

  return useMemo(
    () => ({
      configured: cloudConfigured(),
      ready,
      session,
      name,
      syncedAt,
      register,
      login,
      logout,
      rename,
      syncNow,
      fetchSave,
      fetchLeaderboard,
    }),
    [ready, session, name, syncedAt, register, login, logout, rename, syncNow],
  );
}

export type Cloud = ReturnType<typeof useCloud>;
export type { LeaderboardRow };
