const CACHE_NAME = 'digital-delta-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];
// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});
// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});
// Fetch event - network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip service worker for API calls in development - let browser handle directly
  if (url.pathname.startsWith('/api') && url.origin === 'http://localhost:3001') {
    event.respondWith(fetch(request));
    return;
  }
  
  // API calls: network-first with 3s timeout, then cache
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      new Promise((resolve, reject) => {
        fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
            resolve(response);
          })
          .catch(() => {
            caches.match(request).then((cached) => {
              if (cached) {
                resolve(cached);
              } else {
                resolve(new Response(JSON.stringify({ error: 'OFFLINE', message: 'No network and no cached response' }), {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }));
              }
            });
          });
      })
    );
    return;
  }
  // Map tiles: cache-first with network fallback
  if (url.hostname.includes('tile') || url.pathname.includes('/tiles/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }
  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).catch(() => {
        // If it's a page navigation request, always serve the cached index.html
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Network error. Offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});
// Background sync for offline mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-deliveries') {
    event.waitUntil(syncDeliveries());
  }
});
async function syncDeliveries() {
  // Sync pending deliveries from IndexedDB
  console.log('[SW] Syncing pending deliveries...');
}
// Push notifications for critical alerts
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.message,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view' && event.notification.data?.url) {
    self.clients.openWindow(event.notification.data.url);
  }
});