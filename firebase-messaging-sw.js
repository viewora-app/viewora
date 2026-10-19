/* Viewora FCM SW — keep in sync with sw.js FCM block */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyByS4lox5JHhG2u4qazZSvwecVjzJRP0mc",
  authDomain: "viewora-cc4ac.firebaseapp.com",
  databaseURL: "https://viewora-cc4ac-default-rtdb.firebaseio.com",
  projectId: "viewora-cc4ac",
  storageBucket: "viewora-cc4ac.appspot.com",
  messagingSenderId: "988622911735",
  appId: "1:988622911735:web:e30c97dd88d5ac87c93bf2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var data = (payload && payload.data) || {};
  var n = (payload && payload.notification) || {};
  var title = n.title || data.title || "Viewora";
  var body = n.body || data.body || "";
  var link = data.link || data.click_action || "./index.html";
  return self.registration.showNotification(title, {
    body: body,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: { url: link },
    tag: data.tag || "viewora-msg",
    renotify: true
  });
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./index.html";
  try {
    if (url && url.indexOf("http") !== 0) {
      url = new URL(url, self.registration.scope).href;
    }
  } catch (_) {}
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && "focus" in c) {
          try { if (c.navigate) c.navigate(url); } catch (_) {}
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
