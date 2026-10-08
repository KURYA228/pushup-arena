/*
 * Imported into the generated service worker (see `workbox.importScripts` in vite.config.ts).
 *
 * The page-side handler in main.tsx reloads when a new worker takes over, but that only helps
 * pages already running a build that contains it. This runs inside the worker, so it also
 * rescues a page still executing an older bundle — which is exactly the case right after a
 * deploy, and the reason an installed app could sit on a stale version indefinitely.
 *
 * `client.navigate` is not implemented everywhere; where it throws, the page-side handler is
 * the fallback.
 */

const MARKER_CACHE = 'arena-version-marker';

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(MARKER_CACHE);
      const seenBefore = await cache.match('installed');
      await cache.put('installed', new Response('1'));

      await self.clients.claim();

      // A first ever install has nothing to replace, and reloading there would just be a
      // pointless flash on someone's first visit.
      if (!seenBefore) return;

      for (const client of await self.clients.matchAll({ type: 'window' })) {
        try {
          await client.navigate(client.url);
        } catch {
          // Unsupported or refused — main.tsx handles it from the page side.
        }
      }
    })(),
  );
});
