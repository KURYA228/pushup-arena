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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
