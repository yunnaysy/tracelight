// Tracelight service worker: only shows watchlist notifications and opens the wallet on tap.
// No caching and no push service, so it costs nothing and never serves stale pages.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { await c.focus(); c.postMessage({ type: 'tl:open', url }); return }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url)
  })())
})
