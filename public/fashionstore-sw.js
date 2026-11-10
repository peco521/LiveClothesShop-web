// The authenticated application owns the IndexedDB queue and posts it with its
// current HttpOnly session; this worker never caches API responses or tokens.
const SHELL_CACHE = 'fashionstore-shell-v3';
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(SHELL_CACHE);
  try { await cache.add('/'); } catch { /* navigation requests populate cache when online */ }
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('fashionstore-shell-') && key !== SHELL_CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }
  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    })());
  }
});
self.addEventListener('sync', event => {
  if (event.tag === 'fashionstore-sync') {
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) client.postMessage({ type: 'FASHIONSTORE_SYNC_REQUEST' });
    }));
  }
});
self.addEventListener('message', event => {
  if (event.data?.type === 'FASHIONSTORE_REGISTER_SYNC') {
    event.waitUntil(self.registration.sync?.register('fashionstore-sync'));
  }
});
