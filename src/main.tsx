import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// In dev, tear down any service worker left over from a production build served on the same
// origin. vite-plugin-pwa doesn't register one here, but a worker installed earlier by
// `npm run preview` keeps intercepting http://localhost:5173 and serving its cached copy — so
// source changes land on disk, the dev server serves them, and the tab still shows the old app.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) void reg.unregister()
  })
}

/**
 * Picking up a new version.
 *
 * The generated `registerSW.js` only registers the worker — it never looks for updates and never
 * refreshes anything. In a browser tab that mostly works out, because opening the page is a
 * navigation and the fresh worker serves it. An **installed PWA is different**: resuming it from
 * the app switcher doesn't navigate, so the old page can stay on screen for as long as the phone
 * keeps it alive. That is why a deploy could land and the app still looked untouched.
 *
 * So: ask for an update whenever the app comes back into view, and reload once the new worker
 * takes over. The worker is built with `skipWaiting`, so it claims the page as soon as it
 * installs and `controllerchange` fires — the guard below keeps that from firing on the very
 * first visit, when there was no previous version to replace, and from looping.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  const askForUpdate = () => {
    void navigator.serviceWorker.getRegistration().then((reg) => reg?.update())
  }
  // Returning to the app is the moment worth checking; there's no point spending a request on a
  // page nobody is looking at.
  const onResume = () => {
    if (document.visibilityState === 'visible') askForUpdate()
  }
  document.addEventListener('visibilitychange', onResume)
  window.addEventListener('focus', onResume)
  // Startup is checked regardless of visibility — a page restored into a background tab would
  // otherwise sit on the old version until it happened to be looked at.
  askForUpdate()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
