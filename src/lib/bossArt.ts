import artOriginals from '../data/artOriginals.json';

/**
 * Pictures scripts/brighten-boss-art.mjs lifted for the fight screen whose as-drawn version is
 * kept too, under `public/bosses/original/`.
 */
const ORIGINALS = new Set<string>(artOriginals);

/**
 * URL of a picture under `public/bosses/`. `original` asks for it as drawn — everywhere but the
 * fight screen — and falls back to the one file there is when it was never lifted.
 */
export function bossArtUrl(file: string, original: boolean): string {
  return `${import.meta.env.BASE_URL}bosses/${original && ORIGINALS.has(file) ? `original/${file}` : file}`;
}
