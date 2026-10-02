/* Service Worker der v2-App: macht die Trainingsansicht offline startfähig.
   - Seitenaufrufe: erst Netz (frischer Stand), ohne Netz die letzte Kopie
   - /_next/static/*: unveränderliche Build-Dateien, einmal laden, dann aus dem Cache
   - /admin und /api: nie cachen – das sind Server-Funktionen
   Neue Version = CACHE hochzählen, alte Caches werden beim Aktivieren gelöscht. */
const CACHE = 'calisthenics-v2-2'

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/manifest.webmanifest', '/apple-touch-icon.png'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(res => {
        if (url.pathname === '/' && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy)) }
        return res
      })
      .catch(() => caches.match('/')))
    return
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/apple-touch-icon.png' || url.pathname === '/manifest.webmanifest') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res
    })))
  }
})
