import { BOSSES } from '../data/bosses';
import type { ProfileRecord } from '../types';
import { bossArtUrl } from './bossArt';

/**
 * Avatars. What a player has on theirs is one string, stored on their row in the cloud:
 *
 *  - `g:<file>` — a picture from the gallery: a portrait of a boss or one of his minions, the
 *    same files the arena draws them with (public/bosses);
 *  - an `https://…` address — a photo they uploaded (Supabase Storage, the `avatars` bucket);
 *  - nothing — the letter of their name, as before.
 */

const GALLERY_PREFIX = 'g:';

/** One picture in the gallery: the value stored for it, who it is, and what it takes to earn it. */
export interface GalleryItem {
  value: string;
  file: string;
  label: string;
  /** Which stage it's from. */
  bossIndex: number;
  /** Which of the stage's minions; null for the boss himself. */
  minion: number | null;
  /** What to do to unlock it, said when a locked one is tapped. */
  hint: string;
}

/** Every portrait in the arena, boss by boss — each boss first, then his three. */
export const AVATAR_GALLERY: GalleryItem[] = BOSSES.flatMap((b, bossIndex) => [
  { value: GALLERY_PREFIX + b.icon, file: b.icon, label: b.name, bossIndex, minion: null, hint: `Откроется, когда победишь босса: ${b.name}` },
  ...b.minions.map((m, i) => ({
    value: GALLERY_PREFIX + m.icon,
    file: m.icon,
    label: m.name,
    bossIndex,
    minion: i,
    hint: `Откроется, когда победишь подчинённого ${b.nameGenitive}: ${m.name}`,
  })),
]);

/**
 * The portraits a player has earned — your own photo and the letter are always yours, a face from
 * the arena is earned by beating it: a boss once he's down, a minion once you're past him (or his
 * whole stage is). Counted on the real progress, not a replay's.
 */
export function unlockedAvatars(profile: ProfileRecord): Set<string> {
  const stage = profile.replay?.returnTo.currentBossIndex ?? profile.currentBossIndex;
  const step = profile.replay?.returnTo.stageStep ?? profile.stageStep;
  const beaten = new Set(profile.bossesDefeated);
  return new Set(
    AVATAR_GALLERY.filter((g) => {
      if (beaten.has(BOSSES[g.bossIndex].id)) return true;
      return g.minion != null && g.bossIndex === stage && step > g.minion;
    }).map((g) => g.value),
  );
}

/** The picture to draw for an avatar value, or null for the letter. */
export function avatarSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith(GALLERY_PREFIX)) return bossArtUrl(value.slice(GALLERY_PREFIX.length), true);
  if (/^https:\/\//.test(value)) return throughProxy(value);
  return null;
}

/**
 * Photos uploaded before the proxy were saved with the project's own address, which mobile
 * operators block — so they're fetched through the proxy too, like everything else.
 */
const DIRECT = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const PROXY = import.meta.env.VITE_SUPABASE_PROXY_URL as string | undefined;

function throughProxy(src: string): string {
  return DIRECT && PROXY && src.startsWith(`${DIRECT}/`) ? PROXY + src.slice(DIRECT.length) : src;
}

/** The side of the square an uploaded photo is cut down to, in px — plenty for any avatar on screen. */
const PHOTO_SIDE = 320;

/**
 * Turns a photo off the phone into an avatar: the biggest centred square of it, scaled down to
 * PHOTO_SIDE and saved as a JPEG — a few dozen kilobytes instead of a 5 MB camera shot.
 */
export async function photoToAvatar(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Не получилось открыть картинку.'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_SIDE;
    canvas.height = PHOTO_SIDE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Не получилось обработать картинку.');
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, PHOTO_SIDE, PHOTO_SIDE);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('Не получилось сохранить картинку.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const CACHE_KEY = 'arena.avatar';

/** This device's copy of the player's avatar, so it shows before the server answers. */
export function readCachedAvatar(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

export function writeCachedAvatar(value: string | null) {
  try {
    if (value) localStorage.setItem(CACHE_KEY, value);
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage blocked: it'll just come from the server each time.
  }
}
