import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import type { ProfileRecord } from '../types';

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

function supabase(): SupabaseClient | null {
  if (!cloudConfigured()) return null;
  if (!client) client = createClient(url!, anonKey!);
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

export function takePendingName(): string | null {
  try {
    const v = localStorage.getItem(PENDING_NAME_KEY);
    if (v) localStorage.removeItem(PENDING_NAME_KEY);
    return v;
  } catch {
    return null;
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

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
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
export async function pushProfile(profile: ProfileRecord, level: number): Promise<void> {
  const db = supabase();
  if (!db) return;
  const { data } = await db.auth.getUser();
  const id = data.user?.id;
  if (!id) return;

  await db.from('players').update({
    total_pushups: profile.totalPushups,
    total_xp: profile.totalXp,
    level,
    streak: profile.streak,
    bosses_defeated: profile.bossesDefeated.length,
    rush_best_reps: profile.rushBestReps,
  }).eq('id', id);

  await db.from('saves').upsert({ id, profile: profile as unknown as Record<string, unknown> });
}

/** The save stored in the cloud, for pulling onto a second device. */
export async function fetchSave(): Promise<{ profile: ProfileRecord; updatedAt: string } | null> {
  const db = supabase();
  if (!db) return null;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data } = await db
    .from('saves')
    .select('profile, updated_at')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!data?.profile) return null;
  return { profile: data.profile as ProfileRecord, updatedAt: data.updated_at as string };
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
