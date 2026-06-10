const CACHE = 'billar-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => clients.claim())
))

self.addEventListener('fetch', e => {
  // Solo cachear GET, no API calls
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return
  }

  // Navegaciones (index.html): red siempre, caché solo como fallback offline.
  // Si el HTML se sirviera de caché con red viva, apuntaría a bundles con hash
  // ya caducados y la app quedaría congelada en una versión vieja.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request))
    )
    return
  }

  // Assets con hash en el nombre: inmutables — caché primero, red si falta
  if (e.request.url.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      }))
    )
    return
  }

  // Resto (iconos, manifest…): red con fallback a caché
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
