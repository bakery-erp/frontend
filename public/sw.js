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
  const body = payload.body || 'You have a new system alert in Bakery ERP';

  const options = {
    body: body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      link: payload.link || '/dashboard',
      timestamp: payload.timestamp || Date.now(),
    },
    vibrate: [200, 100, 200],
    tag: payload.type ? `${payload.type}-${Date.now()}` : 'bakery-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

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
