/**
 * Wiping everyone's progress for a fresh start.
 *
 * The obvious way — delete the rows in Supabase — doesn't work, and it's worth being precise
 * about why. The cloud is a mirror, not the original: every player's real save lives in
 * IndexedDB on their own phone. Emptying the tables leaves all of that untouched, and the
 * first time each player opens the app their device notices the account is behind and
 * publishes its save again. An hour later the board is back, and the players whose devices
 * never checked in were never reset at all.
 *
 * So the reset has to be something every device recognises. This number is it. It ships inside
 * the app, so it reaches everyone the moment they load the new build — including players with
 * no account, players who are offline, and phones with the game installed. Each save records
 * the season it belongs to; a save from an older one is discarded on sight, on the device and
 * in the cloud alike.
 *
 * To reset everybody: raise this by one, deploy, and run supabase/reset-season.sql. The README
 * has the full procedure and the order it has to happen in.
 *
 * 0 — the testing period, before the game was handed out.
 * 1 — the real start, 30 September 2026. Everything the testers piled up is wiped.
 */
export const SEASON = 1;

/**
 * Is this save from a season that's over?
 *
 * Older only, never merely different: rolling the app back to a previous build must not be a
 * second wipe. Saves written before seasons existed carry no number and count as season 0.
 */
export function isStale(season: number | null | undefined): boolean {
  return (season ?? 0) < SEASON;
}
