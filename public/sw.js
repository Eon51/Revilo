const CACHE_NAME = 'revilo-v2';
const STATIC_DESTINATIONS = new Set(['document', 'script', 'style', 'image', 'font']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/manifest.json']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys
          .filter((key) => key.startsWith('revilo-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (
    requestUrl.origin !== self.location.origin
    || event.request.headers.has('authorization')
    || !STATIC_DESTINATIONS.has(event.request.destination)
  ) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') {
        const offlinePage = await cache.match('/');
        if (offlinePage) return offlinePage;
      }
      throw error;
    }
  })());
});
