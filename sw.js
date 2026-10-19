/* Viewora SW — PWA shell + FCM background (ONE worker, ONE scope) */
const CACHE = "viewora-shell-v4";
const SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./signup.html",
  "./manifest.webmanifest",
  "./icon-192.png"
];

/* ---- Firebase Messaging (background) ---- */
try {
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
} catch (e) {
  console.warn("[Viewora SW] FCM init", e);
}

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./index.html";
  // absolute if relative
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
          try {
            if (c.navigate) c.navigate(url);
          } catch (_) {}
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* ---- PWA cache ---- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(SHELL).catch(function () {});
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var isHtml =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").indexOf("text/html") !== -1;

  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) {
            c.put(req, copy);
          }).catch(function () {});
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (r) {
            return r || caches.match("./index.html");
          });
        })
    );
    return;
  }

  if (/\.(css|js|png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) {
            c.put(req, copy);
          }).catch(function () {});
          return res;
        })
        .catch(function () {
          return caches.match(req);
        })
    );
  }
});
