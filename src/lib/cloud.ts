import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import type { ProfileRecord } from '../types';
import { streakView, todayLocal } from './streak';
import { isStale } from './season';

/**
 * Accounts and the leaderboard, over Supabase.
 *
 * The game stays offline-first: IndexedDB remains the source of truth for playing, and this is a
 * mirror pushed up when something changes. Signed out, or with no project configured, every
 * function here is inert and the app behaves exactly as it did before — which matters, because
 * the thing is used in a gym where the network often isn't.
 *
 * The anon key is meant to ship inside the page; it identifies the project, not a person. What
 * actually protects the data is row-level security in supabase/schema.sql — without those
 * policies the key would indeed be an open door.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function cloudConfigured(): boolean {
  return Boolean(url && anonKey);
}

/* ------------------------------------------------------------------ *
 * Remembering the device
 *
 * The session token has to outlive the tab, or every visit starts with a
 * login form — which for a gym app means typing a password with wet hands.
 * Two switches control that: where the token is kept (localStorage survives
 * a restart, sessionStorage dies with the tab), and whether the browser is
 * allowed to evict our storage at all.
 * ------------------------------------------------------------------ */

const AUTH_STORAGE_KEY = 'arena.auth';
const REMEMBER_KEY = 'arena.rememberDevice';
const LAST_ACCOUNT_KEY = 'arena.lastAccount';

type StoreKind = 'local' | 'session';

/** Every access is guarded: private mode throws on the property itself, not just on use. */
function store(kind: StoreKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read(kind: StoreKind, key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(kind: StoreKind, key: string, value: string) {
  try {
    store(kind)?.setItem(key, value);
  } catch {
    // Full or blocked storage. The user stays signed in for this tab and no more.
  }
}

function drop(kind: StoreKind, key: string) {
  try {
    store(kind)?.removeItem(key);
  } catch {
    // Nothing to do — the value was unreachable anyway.
  }
}

/** Remembering is the default; only an explicit "no" turns it off. */
export function rememberDevice(): boolean {
  return read('local', REMEMBER_KEY) !== '0';
}

export function setRememberDevice(on: boolean) {
  write('local', REMEMBER_KEY, on ? '1' : '0');
  // Move the token that already exists instead of waiting for the next refresh to rewrite it,
  // so switching this off on a borrowed phone takes effect immediately.
  const from: StoreKind = on ? 'session' : 'local';
  const to: StoreKind = on ? 'local' : 'session';
  const token = read(from, AUTH_STORAGE_KEY);
  if (token !== null) {
    write(to, AUTH_STORAGE_KEY, token);
    drop(from, AUTH_STORAGE_KEY);
  }
  if (!on) forgetAccount();
}

const authStorage = {
  getItem: (key: string) => read('local', key) ?? read('session', key),
  setItem: (key: string, value: string) => {
    const persist = rememberDevice();
    write(persist ? 'local' : 'session', key, value);
    drop(persist ? 'session' : 'local', key);
  },
  removeItem: (key: string) => {
    drop('local', key);
    drop('session', key);
  },
};

/**
 * Supabase names its token `sb-<project-ref>-auth-token` by default. Now that the key is ours,
 * anyone already signed in would land on a login form after this update — so the old value is
 * carried over once. The legacy copy is left in place: harmless, and it makes a rollback painless.
 */
function adoptLegacyToken() {
  if (authStorage.getItem(AUTH_STORAGE_KEY)) return;
  try {
    const ref = new URL(url!).hostname.split('.')[0];
    const legacy = read('local', `sb-${ref}-auth-token`);
    if (legacy) write('local', AUTH_STORAGE_KEY, legacy);
  } catch {
    // Malformed URL — there was nothing to adopt.
  }
}

/**
 * Asks the browser to stop counting our data as disposable cache.
 *
 * This guards the whole save, not just the login: the game itself lives in IndexedDB, and Safari
 * in particular throws away storage from sites you haven't opened in a week. Granted silently
 * for an installed PWA; a plain tab may be refused, which is why the result is only advisory.
 */
export async function keepDataOnDevice(): Promise<boolean> {
  try {
    const s = navigator.storage;
    if (!s?.persist) return false;
    if (await s.persisted()) return true;
    return await s.persist();
  } catch {
    return false;
  }
}

/** Who signed in here last, so the next visit can greet them instead of interrogating them. */
export interface LastAccount {
  email: string;
  name: string | null;
}

export function rememberAccount(email: string, name: string | null) {
  if (!rememberDevice()) return;
  const clean = email.trim();
  if (!clean) return;
  write('local', LAST_ACCOUNT_KEY, JSON.stringify({ email: clean, name }));
}

export function readLastAccount(): LastAccount | null {
  const raw = read('local', LAST_ACCOUNT_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LastAccount>;
    return typeof v.email === 'string' && v.email ? { email: v.email, name: v.name ?? null } : null;
  } catch {
    return null;
  }
}

export function forgetAccount() {
  drop('local', LAST_ACCOUNT_KEY);
}

function supabase(): SupabaseClient | null {
  if (!cloudConfigured()) return null;
  if (!client) {
    adoptLegacyToken();
    client = createClient(url!, anonKey!, {
      auth: {
        storage: authStorage,
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

export interface LeaderboardRow {
  id: string;
  displayName: string;
  totalPushups: number;
  level: number;
  streak: number;
  bossesDefeated: number;
  rushBestReps: number;
}

export type CloudError = { message: string } | null;

/** Turns Supabase's English errors into something readable in the app's own voice. */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Неверная почта или пароль.';
  if (m.includes('user already registered')) return 'Такая почта уже зарегистрирована — войди.';
  if (m.includes('password should be at least')) return 'Пароль слишком короткий — нужно от 6 символов.';
  if (m.includes('duplicate key') && m.includes('display_name')) return 'Это имя уже занято.';
  if (m.includes('email not confirmed')) {
    return 'Почта не подтверждена. Открой письмо от Supabase или выключи подтверждение в настройках проекта.';
  }

  // Supabase's built-in mailer allows only a handful of letters per hour on the free plan, which
  // is very easy to hit while testing the confirmation flow on several addresses.
  const cooldown = message.match(/after (\d+) seconds?/i);
  if (cooldown) return `Слишком часто. Supabase просит подождать ${cooldown[1]} секунд.`;
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Превышен лимит писем — Supabase на бесплатном тарифе шлёт всего несколько штук в час. Подожди час или отключи подтверждение почты.';
  }

  if (m.includes('is invalid') && m.includes('email')) return 'Supabase считает этот адрес недопустимым.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'Регистрация отключена в настройках проекта.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) return 'Нет связи с сервером.';

  // Anything unrecognised is shown as-is: a cryptic English line is still better than silence,
  // and it's what makes the next problem diagnosable.
  return message;
}

/**
 * Is a token sitting in storage, regardless of whether the server could be reached?
 *
 * `getSession()` answers `null` both when nobody ever signed in and when a perfectly good refresh
 * token couldn't be exchanged because the network was down. Treating those the same is what threw
 * a logged-in player back onto the password form the moment the connection dropped.
 */
export function hasStoredSession(): boolean {
  const raw = authStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // The shape has moved around between versions, so accept the wrappers too.
    const s = (parsed?.currentSession ?? parsed?.session ?? parsed) as { refresh_token?: string };
    return Boolean(s?.refresh_token);
  } catch {
    return false;
  }
}

/** Tries the stored refresh token again — on a button, or the moment the network returns. */
export async function retrySession(): Promise<Session | null> {
  const db = supabase();
  if (!db) return null;
  const { data } = await db.auth.refreshSession();
  if (data.session) return data.session;
  const { data: fallback } = await db.auth.getSession();
  return fallback.session;
}

export async function getSession(): Promise<Session | null> {
  const db = supabase();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const db = supabase();
  if (!db) return () => {};
  const { data } = db.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Where the confirmation link should land. Supabase otherwise falls back to the project's Site
 * URL, which defaults to localhost:3000 — an address this app never runs on, so the link opens
 * a dead page. Built from the live location so dev and GitHub Pages both work without editing
 * the project settings each time; the address still has to be on the Redirect URLs allow list.
 */
function redirectTarget(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

/**
 * The name chosen at sign-up, kept until the account is confirmed.
 *
 * Confirming happens in a fresh page load from an e-mail link, by which time the form — and the
 * name typed into it — is long gone. Without this the user comes back signed in but nameless.
 */
const PENDING_NAME_KEY = 'arena.pendingDisplayName';

export function rememberPendingName(name: string) {
  try {
    localStorage.setItem(PENDING_NAME_KEY, name.trim());
  } catch {
    // Private mode — the user will just be asked for the name again.
  }
}

/**
 * Reads the pending name *without* consuming it.
 *
 * The earlier version deleted it on read, before anything had confirmed the public row was
 * actually written. One failed write — a hiccup right after following the confirmation link, a
 * name someone else had taken — and the name was gone for good: the player ended up with an
 * account, no row in `players`, and therefore no place on the board at all. It's cleared by
 * {@link clearPendingName} once the row exists.
 */
export function peekPendingName(): string | null {
  try {
    return localStorage.getItem(PENDING_NAME_KEY);
  } catch {
    return null;
  }
}

export function clearPendingName() {
  try {
    localStorage.removeItem(PENDING_NAME_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export interface SignUpResult {
  error: CloudError;
  /**
   * The project requires the address to be verified, so the account exists but there's no
   * session yet. Without surfacing this the button looks like it did nothing at all.
   */
  needsConfirmation: boolean;
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<SignUpResult> {
  const db = supabase();
  if (!db) return { error: { message: 'Облако не настроено.' }, needsConfirmation: false };

  // A session left over from an account that has since been deleted in the dashboard makes
  // sign-up behave strangely — the browser still holds a token for a user that no longer
  // exists. Clearing it first keeps re-testing predictable.
  await db.auth.signOut();

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTarget() },
  });
  if (error) return { error: { message: translate(error.message) }, needsConfirmation: false };

  rememberPendingName(displayName);

  // With confirmation on there's no session yet, and the public row has to wait for the first
  // real sign-in; `ensurePlayer` is called again from `login` to cover that.
  if (data.session) return { error: await ensurePlayer(displayName), needsConfirmation: false };
  return { error: null, needsConfirmation: true };
}

export async function signIn(email: string, password: string): Promise<CloudError> {
  const db = supabase();
  if (!db) return { message: 'Облако не настроено.' };
  const { error } = await db.auth.signInWithPassword({ email, password });
  return error ? { message: translate(error.message) } : null;
}

/**
 * Signing out keeps the address on file by default, so coming back is one password away.
 * `forget` is the stronger version for a shared or borrowed device: it wipes that trace too.
 */
export async function signOut(forget = false): Promise<void> {
  await supabase()?.auth.signOut();
  if (forget) forgetAccount();
}

/** Creates the public row on first sign-in, or renames it later. */
export async function ensurePlayer(displayName: string): Promise<CloudError> {
  const db = supabase();
  if (!db) return { message: 'Облако не настроено.' };
  const { data } = await db.auth.getUser();
  const id = data.user?.id;
  if (!id) return { message: 'Сначала войди в аккаунт.' };

  const name = displayName.trim();
  if (name.length < 2 || name.length > 24) return { message: 'Имя должно быть от 2 до 24 символов.' };

  const { error } = await db.from('players').upsert({ id, display_name: name });
  return error ? { message: translate(error.message) } : null;
}

export async function getMyName(): Promise<string | null> {
  const db = supabase();
  if (!db) return null;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data } = await db.from('players').select('display_name').eq('id', auth.user.id).maybeSingle();
  return (data?.display_name as string | undefined) ?? null;
}

/**
 * Pushes the local profile up: the public numbers for the board, and the whole save for moving
 * between devices. Silent on failure — a lost sync must never interrupt a set.
 */
/**
 * Publishes one save: the public numbers and the full copy, both from the same profile.
 *
 * An earlier version took the maximum of each field against whatever the account already held.
 * That kept the standing from falling when a stale device reported in, but it built the row out
 * of pieces of different saves — reps from the phone next to a level from the laptop — and the
 * result described nobody. The whole point of a row is that it is one person's actual state.
 *
 * Nothing guards against a stale device here any more, and nothing needs to: the caller waits
 * for the sync to reconcile first, so by the time anything is published this device is either
 * the one that's ahead or a copy of the account.
 */
export async function pushProfile(profile: ProfileRecord, level: number): Promise<void> {
  const db = supabase();
  if (!db) return;
  const { data } = await db.auth.getUser();
  const id = data.user?.id;
  if (!id) return;

  await db
    .from('players')
    .update({
      total_pushups: profile.totalPushups,
      total_xp: profile.totalXp,
      level,
      // The live streak, not the stored one: the stored number only changes on the next rep, so
      // a streak that broke while the player was away would stay on the board indefinitely.
      streak: streakView(profile, todayLocal()).streak,
      bosses_defeated: profile.bossesDefeated.length,
      rush_best_reps: profile.rushBestReps,
    })
    .eq('id', id);

  await db.from('saves').upsert({ id, profile: profile as unknown as Record<string, unknown> });
}

/** The save stored in the cloud, for pulling onto a second device. */
/**
 * The save stored in the cloud, or `null` when the account genuinely has none yet.
 *
 * **Throws** when the answer couldn't be obtained — a dropped connection, a refused request.
 * That distinction is load-bearing: syncing treats "no save" as permission to publish this
 * device's state, so quietly returning `null` on a network blip would let a fresh phone
 * overwrite a year of progress.
 */
export async function fetchSave(): Promise<{ profile: ProfileRecord; updatedAt: string } | null> {
  const db = supabase();
  if (!db) return null;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await db
    .from('saves')
    .select('profile, updated_at')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error) throw new Error(translate(error.message));
  if (!data?.profile) return null;
  const profile = data.profile as ProfileRecord;
  // A save from a season that's over is treated as no save at all, which is what closes the
  // loop on a reset: the device wipes itself, then publishes the empty state over the top
  // instead of being told the account is "ahead" and pulling the old progress back down.
  if (isStale(profile.season)) return null;
  return { profile, updatedAt: data.updated_at as string };
}

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const db = supabase();
  if (!db) return [];
  const { data, error } = await db
    .from('players')
    .select('id, display_name, total_pushups, level, streak, bosses_defeated, rush_best_reps')
    .order('total_pushups', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    totalPushups: r.total_pushups as number,
    level: r.level as number,
    streak: r.streak as number,
    bossesDefeated: r.bosses_defeated as number,
    rushBestReps: r.rush_best_reps as number,
  }));
}
