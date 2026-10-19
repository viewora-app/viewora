/*==========================================================
  Viewora FCM — uses main sw.js (no second service worker)
==========================================================*/
(function (global) {
  "use strict";

  var VAPID_KEY =
    "BMDVErTurk8DSxivY3w8BdtbJGBTo3pdWooa6bRPp9x2taNSisj-15w5hHNJ_ctYqDWQGx2lZBFb7j6Gb45610Q";

  var TOKEN_PATH = "fcmTokens";

  function log() {
    try {
      console.log.apply(console, ["[Viewora FCM]"].concat([].slice.call(arguments)));
    } catch (_) {}
  }

  function ready() {
    return typeof firebase !== "undefined" && firebase.apps && firebase.apps.length > 0;
  }

  function hashToken(token) {
    var h = 0;
    for (var i = 0; i < token.length; i++) {
      h = (Math.imul(31, h) + token.charCodeAt(i)) | 0;
    }
    return "t" + (h >>> 0).toString(16);
  }

  function getMessaging() {
    if (!ready()) return null;
    try {
      if (!firebase.messaging) {
        log("messaging SDK missing — add firebase-messaging-compat.js before fcm.js");
        return null;
      }
      return firebase.messaging();
    } catch (e) {
      log("getMessaging", e);
      return null;
    }
  }

  function saveToken(uid, token) {
    if (!uid || !token || !firebase.database) return Promise.resolve(false);
    var key = hashToken(token);
    return firebase
      .database()
      .ref("users/" + uid + "/" + TOKEN_PATH + "/" + key)
      .set({
        token: token,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        platform: "web",
        userAgent: (navigator.userAgent || "").slice(0, 180)
      })
      .then(function () {
        // also mirror single field for simple rules / debugging
        return firebase.database().ref("users/" + uid + "/fcmToken").set(token);
      })
      .then(function () {
        log("token saved", uid, key);
        return true;
      })
      .catch(function (e) {
        log("token save FAILED — check RTDB rules for users/$uid/fcmTokens", e && (e.code || e.message || e));
        return false;
      });
  }

  /** Prefer existing PWA SW (sw.js) so FCM + cache share one controller */
  function getSwRegistration() {
    if (!("serviceWorker" in navigator)) {
      return Promise.reject(new Error("no serviceWorker"));
    }
    return navigator.serviceWorker.getRegistration("./").then(function (reg) {
      if (reg) {
        log("using existing SW", reg.scope);
        return reg;
      }
      // register main sw.js if nothing active yet
      return navigator.serviceWorker.register("./sw.js", { scope: "./" }).then(function (r) {
        log("registered sw.js", r.scope);
        return r;
      });
    });
  }

  function enablePush() {
    if (!ready()) {
      log("firebase not ready");
      return Promise.resolve(null);
    }
    if (typeof Notification === "undefined") {
      log("Notification API missing");
      return Promise.resolve(null);
    }
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      log("HTTPS required");
      return Promise.resolve(null);
    }

    var messaging = getMessaging();
    if (!messaging) return Promise.resolve(null);

    return Notification.requestPermission()
      .then(function (perm) {
        log("permission:", perm);
        if (perm !== "granted") return null;
        return getSwRegistration().then(function (reg) {
          return messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: reg
          });
        });
      })
      .then(function (token) {
        if (!token) {
          log("no token");
          return null;
        }
        log("token:", token.slice(0, 28) + "…");
        try {
          localStorage.setItem("viewora_fcm_token", token);
        } catch (_) {}
        var user = firebase.auth() && firebase.auth().currentUser;
        if (user) {
          return saveToken(user.uid, token).then(function () {
            return token;
          });
        }
        return token;
      })
      .catch(function (err) {
        log("enablePush error", err && (err.code || err.message || err));
        return null;
      });
  }

  function listenForeground() {
    var messaging = getMessaging();
    if (!messaging) return;
    try {
      messaging.onMessage(function (payload) {
        log("foreground", payload);
        var n = (payload && payload.notification) || {};
        var d = (payload && payload.data) || {};
        var title = n.title || d.title || "Viewora";
        var body = n.body || d.body || "";
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification(title, {
              body: body,
              icon: "icon-192.png",
              data: { url: d.link || "index.html" }
            });
          } catch (_) {}
        }
      });
    } catch (e) {
      log("onMessage", e);
    }
  }

  function initFcmAuto() {
    if (!ready()) {
      setTimeout(initFcmAuto, 2000);
      return;
    }
    listenForeground();
    try {
      firebase.auth().onAuthStateChanged(function (user) {
        if (!user) return;
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          enablePush();
        }
      });
    } catch (_) {}
  }

  global.VieworaFCM = {
    enablePush: enablePush,
    initFcmAuto: initFcmAuto,
    saveToken: saveToken
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(initFcmAuto, 1200);
    });
  } else {
    setTimeout(initFcmAuto, 1200);
  }
})(typeof window !== "undefined" ? window : this);
