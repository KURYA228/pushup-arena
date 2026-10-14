/**
 * The game moved from GitHub Pages to Yandex Object Storage: mobile operators in Russia cut
 * github.io (README, «Игра на Yandex Cloud»). The old address keeps working, but sends people on —
 * newcomers straight away, players with progress on this device only when they choose to, because
 * whatever hasn't reached the cloud yet would stay behind in the old copy.
 */

export const NEW_HOME = 'https://pushuplegends.website.yandexcloud.net/';

const OLD_HOST = 'kurya228.github.io';

export function isOldHome(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === OLD_HOST;
}

/**
 * The new address, carrying the query and hash along: a confirmation link that landed here brings
 * its sign-in with it.
 */
export function newHomeUrl(): string {
  return `${NEW_HOME}${window.location.search}${window.location.hash}`;
}

/** A Google sign-in coming back for the old home-screen app must be relayed here, not moved. */
export function isAuthReturn(): boolean {
  return new URLSearchParams(window.location.search).has('handoff');
}
