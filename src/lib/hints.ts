import { useCallback, useState } from 'react';

/**
 * Hints for newcomers: which ones have been dismissed, and what kind of device this is.
 *
 * Dismissals live in localStorage — they describe this device's reader, not anyone's progress,
 * and showing a hint again after storage is cleared is the right way to fail.
 */

const PREFIX = 'arena.hint.';

export type HintId = 'install' | 'howto' | 'fight';

function isDismissed(id: HintId): boolean {
  try {
    return localStorage.getItem(PREFIX + id) === '1';
  } catch {
    return false;
  }
}

/** A hint that stays gone once closed. */
export function useHint(id: HintId): [visible: boolean, dismiss: () => void] {
  const [visible, setVisible] = useState(() => !isDismissed(id));
  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(PREFIX + id, '1');
    } catch {
      // Without storage the hint comes back next launch — harmless.
    }
  }, [id]);
  return [visible, dismiss];
}

export type Platform = 'ios' | 'android' | 'other';

export function platform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch points give it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** Running from the home-screen icon rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Safari is the only browser on iOS that can add a web app to the home screen. */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return platform() === 'ios' && !/CriOS|FxiOS|EdgiOS|YaBrowser|OPiOS/.test(ua);
}

/**
 * Chrome on Android offers its own install prompt, but only through an event that fires once,
 * early, and has to be caught then. It's caught here at module load and held until the install
 * card asks for it.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export const canPromptInstall = () => deferredPrompt != null;

export function onInstallPromptChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Shows the browser's own install dialog. Resolves true if the player accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const e = deferredPrompt;
  deferredPrompt = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  listeners.forEach((l) => l());
  return outcome === 'accepted';
}
