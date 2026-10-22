/**
 * Outgoing call tones
 * call-calling.mp3  = peer offline
 * call-ringing.mp3  = peer online
 * Load AFTER viewora-sounds.js + call.js
 */
(function () {
  "use strict";
  if (window.__VIEWORA_CALL_TONE_BRIDGE__) return;
  window.__VIEWORA_CALL_TONE_BRIDGE__ = true;

  function S() {
    return window.VieworaSounds;
  }

  function peerOnline(uid) {
    return new Promise(function (resolve) {
      try {
        if (!uid || typeof firebase === "undefined" || !firebase.database) {
          resolve(false);
          return;
        }
        firebase
          .database()
          .ref("users/" + uid)
          .once("value")
          .then(function (snap) {
            var u = snap.val() || {};
            var last = Number(u.lastActive || u.lastSeen || 0);
            var online =
              u.isOnline === true ||
              u.online === true ||
              u.state === "online" ||
              (u.presence && (u.presence.online || u.presence.state === "online")) ||
              (last && Date.now() - last < 90000);
            resolve(!!online);
          })
          .catch(function () {
            resolve(false);
          });
      } catch (_) {
        resolve(false);
      }
    });
  }

  window.VieworaStartOutgoingCallTones = function (peerUid) {
    var s = S();
    if (!s) return;
    s.startCallingTone();
    peerOnline(peerUid).then(function (online) {
      if (!S()) return;
      if (online) S().startOutboundRingingTone();
      else S().startCallingTone();
    });
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (n > 15) {
        clearInterval(t);
        return;
      }
      peerOnline(peerUid).then(function (online) {
        if (online && S()) S().startOutboundRingingTone();
      });
    }, 3000);
    window.__vieworaOutCallToneTimer = t;
  };

  window.VieworaStopOutgoingCallTones = function () {
    try {
      if (window.__vieworaOutCallToneTimer) {
        clearInterval(window.__vieworaOutCallToneTimer);
        window.__vieworaOutCallToneTimer = null;
      }
      if (S()) S().stopCallSounds();
    } catch (_) {}
  };

  function hook() {
    if (!window.VieworaCall || !window.VieworaCall.startCall) return;
    if (window.VieworaCall.__toneHooked) return;
    window.VieworaCall.__toneHooked = true;
    var orig = window.VieworaCall.startCall.bind(window.VieworaCall);
    window.VieworaCall.startCall = function (uid, type) {
      try {
        window.VieworaStartOutgoingCallTones(uid);
      } catch (_) {}
      var ret = orig(uid, type);
      return ret;
    };
    console.log("[Viewora] outgoing call tones hooked");
  }
  hook();
  setTimeout(hook, 800);
  setTimeout(hook, 2500);
})();
