/* Viewora — Firebase Cloud Messaging service worker */
/* Must be at site root: /viewora/firebase-messaging-sw.js */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyByS4lox5JHhG2u4qazZSvwecVjzJRP0mc',
  authDomain: 'viewora-cc4ac.firebaseapp.com',
  databaseURL: 'https://viewora-cc4ac-default-rtdb.firebaseio.com',
  projectId: 'viewora-cc4ac',
  storageBucket: 'viewora-cc4ac.appspot.com',
  messagingSenderId: '988622911735',
  appId: '1:988622911735:web:e30c97dd88d5ac87c93bf2'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log('[Viewora FCM] background', payload);
  const data = payload.data || {};
  const title =
    (payload.notification && payload.notification.title) ||
    data.title ||
    'Viewora';
  const body =
    (payload.notification && payload.notification.body) ||
    data.body ||
    '';
  const link = data.link || data.click_action || './index.html';
  const icon = data.icon || './icon-192.png';

  self.registration.showNotification(title, {
    body: body,
    icon: icon,
    badge: './icon-192.png',
    data: { url: link },
    tag: data.tag || 'viewora',
    renotify: true
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) ||
    './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && 'focus' in c) {
          c.navigate && c.navigate(url);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
