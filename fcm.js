/*==========================================================
  Viewora FCM client (web push)
  Requires: firebase app + auth + database already init
  Upload: root fcm.js
  Include after firebase.js:
    <script src="fcm.js"></script>
==========================================================*/
(function (global) {
  "use strict";

  // TODO: Firebase Console → Project settings → Cloud Messaging →
  // Web Push certificates → Key pair → paste here
  var VAPID_KEY = "BMDVErTurk8DSxivY3w8BdtbJGBTo3pdWooa6bRPp9x2taNSisj-15w5hHNJ_ctYqDWQGx2lZBFb7j6Gb45610Q";

  var TOKEN_PATH = "fcmTokens"; // users/{uid}/fcmTokens/{tokenHash}

  function ready() {
    return typeof firebase !== "undefined" &&
      firebase.apps &&
      firebase.apps.length > 0;
  }

  function hashToken(token) {
    // short key-safe id from token
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
        console.warn("[Viewora FCM] messaging SDK not loaded");
        return null;
      }
      return firebase.messaging();
    } catch (e) {
      console.warn("[Viewora FCM]", e);
      return null;
    }
  }

  function saveToken(uid, token) {
    if (!uid || !token || !firebase.database) return Promise.resolve();
    var key = hashToken(token);
    var ref = firebase.database().ref("users/" + uid + "/" + TOKEN_PATH + "/" + key);
    return ref.set({
      token: token,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      platform: "web",
      userAgent: (navigator.userAgent || "").slice(0, 180)
    });
  }

  function removeToken(uid, token) {
    if (!uid || !token || !firebase.database) return Promise.resolve();
    var key = hashToken(token);
    return firebase.database().ref("users/" + uid + "/" + TOKEN_PATH + "/" + key).remove();
  }

  /**
   * Request permission + get FCM token + save under user
   * @returns {Promise<string|null>}
   */
  function enablePush() {
    if (!ready()) return Promise.resolve(null);
    if (!("Notification" in window)) {
      console.warn("[Viewora FCM] Notification API missing");
      return Promise.resolve(null);
    }
    if (VAPID_KEY.indexOf("PASTE_") === 0) {
      console.warn("[Viewora FCM] Set VAPID_KEY in fcm.js from Firebase Console");
      return Promise.resolve(null);
    }

    var messaging = getMessaging();
    if (!messaging) return Promise.resolve(null);

    return Notification.requestPermission()
      .then(function (perm) {
        if (perm !== "granted") {
          console.log("[Viewora FCM] permission:", perm);
          return null;
        }
        // Use dedicated messaging SW
        return navigator.serviceWorker
          .register("./firebase-messaging-sw.js", { scope: "./" })
          .catch(function () {
            // fallback: existing registration
            return navigator.serviceWorker.ready;
          })
          .then(function (reg) {
            return messaging.getToken({
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: reg && reg.scope ? reg : undefined
            });
          });
      })
      .then(function (token) {
        if (!token) return null;
        var user = firebase.auth() && firebase.auth().currentUser;
        if (user) {
          return saveToken(user.uid, token).then(function () {
            try {
              localStorage.setItem("viewora_fcm_token", token);
            } catch (e) {}
            console.log("[Viewora FCM] token saved");
            return token;
          });
        }
        try {
          localStorage.setItem("viewora_fcm_token", token);
        } catch (e) {}
        return token;
      })
      .catch(function (err) {
        console.warn("[Viewora FCM] enablePush", err);
        return null;
      });
  }

  function listenForeground(handler) {
    var messaging = getMessaging();
    if (!messaging) return function () {};
    return messaging.onMessage(function (payload) {
      console.log("[Viewora FCM] foreground", payload);
      if (typeof handler === "function") {
        handler(payload);
        return;
      }
      // default toast-like notification when app open
      if (payload.notification && Notification.permission === "granted") {
        var n = payload.notification;
        new Notification(n.title || "Viewora", {
          body: n.body || "",
          icon: "./icon-192.png"
        });
      }
    });
  }

  function initFcmAuto() {
    if (!ready()) return;
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) return;
      // only if already granted — don't spam prompt on every page
      if (Notification.permission === "granted") {
        enablePush();
      }
    });
    listenForeground(null);
  }

  // Public API
  global.VieworaFCM = {
    enablePush: enablePush,
    listenForeground: listenForeground,
    initFcmAuto: initFcmAuto,
    saveToken: saveToken,
    removeToken: removeToken
  };

  // auto when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(initFcmAuto, 1500);
    });
  } else {
    setTimeout(initFcmAuto, 1500);
  }
})(typeof window !== "undefined" ? window : this);
