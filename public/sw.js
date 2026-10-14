/* Die Web-Trainingsansicht ist abgeschaltet (Okt 2026) – Lever läuft als App.
   Dieser Service Worker räumt bei früheren Web-Nutzern auf: Caches löschen, sich selbst
   abmelden, offene Seiten neu laden (dann kommt die Landingpage statt der alten Kopie). */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
  })())
})
