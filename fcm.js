/*==========================================================
  Viewora FCM — phone web push (GitHub Pages safe)
==========================================================*/
(function (global) {
  "use strict";

  var VAPID_KEY =
    "BMDVErTurk8DSxivY3w8BdtbJGBTo3pdWooa6bRPp9x2taNSisj-15w5hHNJ_ctYqDWQGx2lZBFb7j6Gb45610Q";

  var TOKEN_PATH = "fcmTokens";
  var SW_URL = "firebase-messaging-sw.js";

  function log() {
    try {
      var a = ["[Viewora FCM]"].concat([].slice.call(arguments));
      console.log.apply(console, a);
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
        log("messaging SDK missing — add firebase-messaging-compat.js");
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
        log("token saved under users/" + uid + "/fcmTokens/" + key);
        return true;
      })
      .catch(function (e) {
        log("token save FAILED (check DB rules fcmTokens)", e && (e.code || e.message || e));
        return false;
      });
  }

  function registerMessagingSW() {
    if (!("serviceWorker" in navigator)) {
      return Promise.reject(new Error("no serviceWorker"));
    }
    // Absolute path under current folder (works on /viewora/ GitHub Pages)
    var url = new URL(SW_URL, window.location.href).pathname;
    return navigator.serviceWorker.register(url, { scope: new URL("./", window.location.href).pathname })
      .then(function (reg) {
        log("SW registered", reg.scope);
        return reg;
      });
  }

  /**
   * Ask permission + token + save
   */
  function enablePush() {
    if (!ready()) {
      log("firebase not ready");
      return Promise.resolve(null);
    }
    if (!("Notification" in window)) {
      log("Notification API missing (old browser / iOS restrictions)");
      return Promise.resolve(null);
    }
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      log("HTTPS required for push");
      return Promise.resolve(null);
    }

    var messaging = getMessaging();
    if (!messaging) return Promise.resolve(null);

    return Notification.requestPermission()
      .then(function (perm) {
        log("permission:", perm);
        if (perm !== "granted") return null;

        return registerMessagingSW()
          .catch(function (e) {
            log("SW register fail, using ready()", e);
            return navigator.serviceWorker.ready;
          })
          .then(function (reg) {
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
        log("token:", token.slice(0, 24) + "…");
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
        log("foreground message", payload);
        var n = (payload && payload.notification) || {};
        var d = (payload && payload.data) || {};
        var title = n.title || d.title || "Viewora";
        var body = n.body || d.body || "";
        if (Notification.permission === "granted") {
          try {
            new Notification(title, {
              body: body,
              icon: "icon-192.png",
              data: { url: d.link || d.click_action || "index.html" }
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
        if (Notification.permission === "granted") {
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
