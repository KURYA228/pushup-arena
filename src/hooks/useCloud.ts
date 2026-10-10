import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ProfileRecord } from '../types';
import {
  cloudConfigured,
  ensurePlayer,
  fetchLeaderboard,
  fetchSave,
  forgetAccount,
  getMyName,
  getSession,
  hasStoredSession,
  keepDataOnDevice,
  onAuthChange,
  pushProfile,
  readLastAccount,
  rememberAccount,
  rememberDevice,
  retrySession,
  setRememberDevice,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  clearPendingName,
  peekPendingName,
  type CloudError,
  type LastAccount,
  type LeaderboardRow,
} from '../lib/cloud';
import { compare, fingerprint, readMark, writeMark, clearMark, type Verdict } from '../lib/syncMark';

/** How long to sit on changes before pushing, so a fast set doesn't fire a write per rep. */
const SYNC_DEBOUNCE_MS = 4000;

/**
 * How often an open app re-checks the account. Short enough that reps done on the laptop show
 * up on the phone lying next to it, long enough that a phone left open for an hour costs a few
 * hundred reads rather than a few thousand.
 */
const SYNC_POLL_MS = 15000;

/**
 * How long to wait for the server to confirm the session before trusting the token we already
 * hold. Supabase retries a failed refresh with backoff and takes well over ten seconds to give
 * up — far too long to sit on "Проверяем вход…" when the answer is already on the device.
 */
const SESSION_TIMEOUT_MS = 3000;

/**
 * What the two sides hold when they've genuinely diverged and only the user can choose.
 * Both whole profiles, because the decision is about more than the rep count — a copy can be
 * behind on reps and ahead on bosses, and picking blind is how someone loses a stage.
 */
export interface SyncConflict {
  mine: ProfileRecord;
  theirs: ProfileRecord;
}

/**
 * Account state and syncing.
 *
 * Uploads are debounced and fire-and-forget: a set can be forty reps in a minute, and neither
 * the network nor the user should feel that.
 *
 * Downloads used to be a button, because that direction can destroy progress. They're automatic
 * now — an account is supposed to mean one result on every device — but only where it provably
 * costs nothing: the sync mark says whether this device has anything of its own that the server
 * hasn't seen. If it doesn't, the cloud copy is simply newer and gets adopted. If both sides
 * moved, nothing is touched and the user is asked.
 */
export function useCloud(
  profile: ProfileRecord | undefined,
  level: number,
  /** Replaces the local save wholesale. Supplied by the profile hook, which owns the database. */
  adopt: (p: ProfileRecord) => Promise<void>,
) {
  const [session, setSession] = useState<Session | null>(null);
  /**
   * `undefined` while the public row is still being fetched, `null` once the server has confirmed
   * there isn't one. Collapsing the two is what made "Выбери имя" flash for a few seconds after
   * every sign-in: the name simply hadn't arrived yet.
   */
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [ready, setReady] = useState(!cloudConfigured());
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [remember, setRememberState] = useState(rememberDevice);
  const [lastAccount, setLastAccount] = useState<LastAccount | null>(readLastAccount);

  /**
   * Signed in as far as this device knows, but the server couldn't confirm it. Kept apart from
   * "signed out" so a dropped connection shows a retry, not a password form.
   */
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    if (!cloudConfigured()) return;
    let alive = true;
    let timer = 0;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = window.setTimeout(() => resolve('timeout'), SESSION_TIMEOUT_MS);
    });
    void Promise.race([getSession(), timeout]).then((result) => {
      window.clearTimeout(timer);
      if (!alive) return;
      // Out of patience: go with the token on the device. Supabase keeps retrying underneath,
      // and `onAuthChange` corrects us the moment one of those attempts lands.
      if (result === 'timeout') {
        setUnreachable(hasStoredSession());
        setReady(true);
        return;
      }
      setSession(result);
      setUnreachable(!result && hasStoredSession());
      setReady(true);
    });
    const off = onAuthChange((s) => {
      setSession(s);
      // A background refresh that finally lands clears the offline state on its own.
      setUnreachable(!s && hasStoredSession());
      setReady(true);
    });
    return () => {
      alive = false;
      window.clearTimeout(timer);
      off();
    };
  }, []);

  const retry = useCallback(async () => {
    const s = await retrySession();
    setSession(s);
    setUnreachable(!s && hasStoredSession());
    return Boolean(s);
  }, []);

  // The browser tells us when the network is back; no reason to make the user tap anything.
  useEffect(() => {
    if (!unreachable) return;
    const onOnline = () => void retry();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [unreachable, retry]);

  useEffect(() => {
    if (!session) {
      setName(undefined);
      return;
    }
    let alive = true;
    setName(undefined);
    void (async () => {
      let current = await getMyName();
      // Coming back from a confirmation link: the session is new and the public row was never
      // created, but the name typed at sign-up is still waiting in storage. The name is only
      // discarded once the row it was meant for actually exists — otherwise a single failed
      // write leaves an account that can never appear on the board.
      if (!current) {
        const pending = peekPendingName();
        if (pending) {
          await ensurePlayer(pending);
          current = await getMyName();
          if (current) clearPendingName();
        }
      }
      if (!alive) return;
      setName(current);
      // Every confirmed session refreshes the greeting for next time, including one restored
      // from storage — so a device stays recognised without ever retyping the address.
      const email = session.user.email;
      if (email) {
        rememberAccount(email, current);
        setLastAccount(readLastAccount());
      }
      void keepDataOnDevice();
    })();
    return () => {
      alive = false;
    };
  }, [session]);

  // Push on change, debounced. The signature keeps the effect from firing on unrelated renders.
  const signature = profile
    ? `${profile.totalPushups}|${profile.totalXp}|${profile.streak}|${profile.bossesDefeated.length}|${profile.rushBestReps}|${profile.currentBossIndex}|${profile.stageStep}`
    : '';
  const profileRef = useRef(profile);
  profileRef.current = profile;

  /* --------------------------- pulling down --------------------------- */

  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const adoptRef = useRef(adopt);
  adoptRef.current = adopt;
  // Read inside the debounced timer, which would otherwise close over a stale value.
  const conflictRef = useRef<SyncConflict | null>(null);
  conflictRef.current = conflict;
  /** Which pair of states the open question is about, so it isn't re-raised identically. */
  const conflictKeyRef = useRef<string | null>(null);

  /**
   * Nothing is published until this device has been compared against the account.
   *
   * Publishing is a whole-row replacement now, so a device that hasn't caught up yet would
   * overwrite the account with an older state. The two gates are: the first comparison of the
   * session must have finished, and there must be no unanswered conflict on screen — while the
   * user is being asked which copy to keep, neither may quietly win.
   */
  const [reconciled, setReconciled] = useState(false);

  useEffect(() => {
    if (!session || !profile || !reconciled || conflictRef.current) return;
    const id = window.setTimeout(() => {
      const current = profileRef.current;
      if (!current || conflictRef.current) return;
      void pushProfile(current, level).then(() => {
        setSyncedAt(Date.now());
        // Server and device now agree; that agreement is the ancestor the next sync reasons from.
        writeMark(fingerprint(current));
      });
    }, SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, session, level, reconciled]);

  /**
   * Brings this device in line with the account. Returns what it decided, so the caller can
   * say something about it.
   */
  const reconcile = useCallback(async (): Promise<Verdict | 'no-save' | 'idle' | 'unreachable'> => {
    const mine = profileRef.current;
    if (!mine) return 'idle';

    let remote: Awaited<ReturnType<typeof fetchSave>>;
    try {
      remote = await fetchSave();
    } catch {
      // Couldn't ask. Staying un-reconciled is the whole point: nothing gets published until
      // this device knows what the account holds, and the next return to the app tries again.
      return 'unreachable';
    }

    // Nothing stored yet — this device is the first, so its own state becomes the account's.
    if (!remote) {
      setReconciled(true);
      return 'no-save';
    }
    setReconciled(true);

    const verdict = compare(mine, remote.profile, readMark());
    if (verdict === 'same') {
      writeMark(fingerprint(mine));
      conflictKeyRef.current = null;
      setConflict(null);
      return verdict;
    }
    if (verdict === 'behind') {
      // Provably safe: this device has nothing the server hasn't already got.
      await adoptRef.current(remote.profile);
      writeMark(fingerprint(remote.profile));
      setSyncedAt(Date.now());
      conflictKeyRef.current = null;
      setConflict(null);
      return verdict;
    }
    if (verdict === 'diverged') {
      // Re-asking the same question must not produce a new object every time: the hook's
      // returned value is rebuilt when it changes, and anything re-running on that identity
      // would poll itself into a loop.
      const key = `${fingerprint(mine)}>${fingerprint(remote.profile)}`;
      if (conflictKeyRef.current !== key) {
        conflictKeyRef.current = key;
        setConflict({ mine, theirs: remote.profile });
      }
      return verdict;
    }
    // Ahead: the debounced push will carry it up on its own.
    conflictKeyRef.current = null;
    setConflict(null);
    return verdict;
  }, []);

  /**
   * When to look at the account.
   *
   * On arrival and on every return to the app, because opening it on a second device is the
   * moment it has to mean one result. And on a timer on top of that: a phone lying unlocked
   * beside the laptop never fires either event, so without it the screen would just sit there
   * while the numbers changed elsewhere.
   *
   * The timer only runs while the app is actually on screen — polling a page nobody is looking
   * at is a request an hour for nothing — and stops while a conflict is waiting for an answer,
   * since there's nothing to decide until it's answered.
   */
  useEffect(() => {
    if (!session || !profile) return;

    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (conflictRef.current) return;
      void reconcile();
    };

    check();
    const onResume = () => check();
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    const timer = window.setInterval(check, SYNC_POLL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      window.clearInterval(timer);
    };
    // Only the arrival of a session should arm this; `profile` changes on every rep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, reconcile]);

  /** Conflict resolution: take the account's copy, or keep this device's and publish it. */
  const takeCloud = useCallback(async () => {
    if (!conflict) return;
    await adoptRef.current(conflict.theirs);
    writeMark(fingerprint(conflict.theirs));
    conflictKeyRef.current = null;
    setConflict(null);
    setSyncedAt(Date.now());
  }, [conflict]);

  const keepLocal = useCallback(async () => {
    const mine = profileRef.current;
    if (!mine) return;
    // Marking it synced first is what lets the push through: until the device stops looking
    // diverged, it would keep being asked the same question.
    writeMark(fingerprint(mine));
    conflictKeyRef.current = null;
    setConflict(null);
    await pushProfile(mine, level);
    setSyncedAt(Date.now());
  }, [level]);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await signUp(email, password, displayName);
    if (result.error) return result;
    // Worth storing even while the address is still unconfirmed: the user comes back from the
    // e-mail link to a screen that already knows who they are.
    rememberAccount(email, displayName);
    setLastAccount(readLastAccount());
    if (!result.needsConfirmation) setName(await getMyName());
    return result;
  }, []);

  /** Off to Google and back; the session arrives through the auth listener on return. */
  const googleLogin = useCallback(() => signInWithGoogle(), []);

  const login = useCallback(async (email: string, password: string, displayName: string) => {
    const err = await signIn(email, password);
    if (err) return err;
    // First sign-in after a confirmed sign-up: the public row may still be missing.
    const existing = await getMyName();
    if (!existing && displayName.trim()) {
      const nameErr = await ensurePlayer(displayName);
      if (nameErr) return nameErr;
    }
    const resolved = await getMyName();
    setName(resolved);
    rememberAccount(email, resolved);
    setLastAccount(readLastAccount());
    return null as CloudError;
  }, []);

  const rename = useCallback(async (displayName: string) => {
    const err = await ensurePlayer(displayName);
    if (!err) {
      setName(await getMyName());
      clearPendingName();
    }
    return err;
  }, []);

  /** `forget` also drops the remembered address, for a device that isn't yours. */
  const logout = useCallback(async (forget = false) => {
    await signOut(forget);
    setSession(null);
    setName(undefined);
    setUnreachable(false);
    setConflict(null);
    // The next account has to be compared from scratch before anything of its own goes up.
    setReconciled(false);
    // The mark records an agreement with one particular account. Left behind, the next account
    // signing in on this device would be compared against a stranger's history.
    clearMark();
    if (forget) setLastAccount(null);
  }, []);

  const setRemember = useCallback((on: boolean) => {
    setRememberDevice(on);
    setRememberState(on);
    if (!on) setLastAccount(null);
  }, []);

  const forgetDevice = useCallback(() => {
    forgetAccount();
    setLastAccount(null);
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
      remember,
      lastAccount,
      unreachable,
      conflict,
      takeCloud,
      keepLocal,
      reconcile,
      register,
      login,
      googleLogin,
      logout,
      rename,
      retry,
      setRemember,
      forgetDevice,
      syncNow,
      fetchSave,
      fetchLeaderboard,
    }),
    [
      ready,
      session,
      name,
      syncedAt,
      remember,
      lastAccount,
      unreachable,
      conflict,
      takeCloud,
      keepLocal,
      reconcile,
      register,
      login,
      googleLogin,
      logout,
      rename,
      retry,
      setRemember,
      forgetDevice,
      syncNow,
    ],
  );
}

export type Cloud = ReturnType<typeof useCloud>;
export type { LeaderboardRow };
