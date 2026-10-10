import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// The MediaPipe engine (WASM) is fetched from a CDN at runtime and has to be the same release as
// the JS package that drives it. Read from the installed package so the two can't drift apart —
// a hard-coded version had already fallen two major releases behind.
const mediapipeVersion = (
  JSON.parse(readFileSync(new URL('./node_modules/@mediapipe/tasks-vision/package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

// GitHub Pages serves the app from /<repo>/, not the domain root. Everything that emits an
// absolute URL — the manifest, the service worker scope, asset links in index.html — has to be
// told about that prefix, or it will reach for paths one level too high and 404.
// Override with BASE_PATH=/ when deploying somewhere that serves from the root.
const base = process.env.BASE_PATH ?? '/pushup-arena/';

// https://vite.dev/config/
export default defineConfig({
  base,
  define: {
    __MEDIAPIPE_VERSION__: JSON.stringify(mediapipeVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Push Up Legends',
        short_name: 'Арена',
        description: 'Геймифицированный счётчик отжиманий с боссами, XP и AI-подсчётом через камеру',
        theme_color: '#0b0c0f',
        background_color: '#0b0c0f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + JS/CSS/icons are precached for offline use. Pose-detection model/wasm
        // are fetched from CDN at runtime (see README) and are not part of this precache.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,ico}'],
        navigateFallback: `${base}index.html`,
        // Runs inside the worker and reloads open windows once a new version activates. The
        // page-side handler in main.tsx can only rescue pages that already run a build
        // containing it; this one also rescues a page still on the previous bundle.
        importScripts: ['sw-refresh.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://storage.googleapis.com' || url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-assets',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
