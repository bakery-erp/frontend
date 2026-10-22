const CACHE_NAME = 'koket-erp-v4';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch listener - Network-first with cache fallback (bypasses API requests)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls, auth, or mutation requests
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/uploads')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid network response, clone to cache for offline fallback
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/');
        });
      })
  );
});

// Web Push event listener
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'Koket Bakery ERP',
      body: event.data.text(),
      link: '/dashboard',
    };
  }

  const title = payload.title || 'Koket Bakery ERP';
  const body = payload.body || 'You have a new update in Bakery ERP';

  const options = {
    body: body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: {
      link: payload.link || '/dashboard',
      timestamp: payload.timestamp || Date.now(),
    },
    vibrate: [300, 100, 300, 100, 300],
    tag: payload.id || `${payload.type || 'alert'}-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            payload: { title, body, ...payload }
          });
        }
      });
    })
  );
});

// Notification Click event listener
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const rawLink = (event.notification.data && event.notification.data.link) || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          client.navigate(rawLink);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(rawLink);
      }
    })
  );
});
