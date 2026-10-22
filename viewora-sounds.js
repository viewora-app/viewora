/**
 * VIEWORA SOUNDS — WhatsApp / Instagram style
 * --------------------------------------------
 * assets/message-notify.mp3  — msg/like/alert when that chat is NOT open
 * assets/chat-message.mp3    — soft tone when that chat IS open (~1s)
 * assets/call-calling.mp3    — you call, peer offline / unreachable
 * assets/call-ringing.mp3    — you call, peer online (their side ringing)
 * assets/call-incoming.mp3   — someone is calling you
 *
 * Load on every main page AFTER firebase.js, BEFORE listeners:
 *   <script src="viewora-sounds.js"></script>
 */
(function (g) {
  "use strict";
  if (g.__VIEWORA_SOUNDS_NAMED__) return;
  g.__VIEWORA_SOUNDS_NAMED__ = true;

  var FILES = {
    notify: "assets/message-notify.mp3",
    chat: "assets/chat-message.mp3",
    calling: "assets/call-calling.mp3",
    ringing: "assets/call-ringing.mp3",
    incoming: "assets/call-incoming.mp3"
  };

  /* Legacy aliases still used by older scripts */
  var LEGACY = {
    messageTone: "assets/message-tone.mp3",
    chatBeep: "assets/chat-beep.mp3",
    callRingtone: "assets/call-ringtone.mp3"
  };

  var KEY = {
    mute: "viewora_sound_muted",
    msg: "viewora_sound_message_on",
    chat: "viewora_sound_chat_on",
    call: "viewora_sound_call_on",
    vol: "viewora_sound_volume"
  };

  var cache = {};
  var loopAudio = null;
  var loopTimer = null;
  var lastNotify = 0;
  var lastChat = 0;
  var unlocked = false;

  function ls(k, d) {
    try {
      var v = localStorage.getItem(k);
      return v == null || v === "" ? d : v;
    } catch (_) {
      return d;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (_) {}
  }
  function flagOn(k) {
    var v = ls(k, "1");
    return v !== "0" && v !== "false";
  }
  function muted() {
    var v = ls(KEY.mute, "0");
    return v === "1" || v === "true";
  }
  function vol() {
    var n = parseFloat(ls(KEY.vol, "0.9"));
    return isNaN(n) ? 0.9 : Math.max(0, Math.min(1, n));
  }

  function getAudio(src) {
    if (!cache[src]) {
      try {
        var a = new Audio(src);
        a.preload = "auto";
        cache[src] = a;
      } catch (_) {
        return null;
      }
    }
    return cache[src];
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    Object.keys(FILES).forEach(function (k) {
      try {
        var a = getAudio(FILES[k]);
        if (!a) return;
        var p = a.play();
        if (p && p.then)
          p.then(function () {
            a.pause();
            a.currentTime = 0;
          }).catch(function () {});
      } catch (_) {}
    });
  }
  document.addEventListener("touchstart", unlock, true);
  document.addEventListener("click", unlock, true);

  function playOnce(src, kind) {
    if (muted()) return false;
    if (kind === "notify" && !flagOn(KEY.msg)) return false;
    if (kind === "chat" && !flagOn(KEY.chat)) return false;

    var now = Date.now();
    if (kind === "notify") {
      if (now - lastNotify < 500) return false;
      lastNotify = now;
    }
    if (kind === "chat") {
      if (now - lastChat < 280) return false;
      lastChat = now;
    }

    try {
      var a = getAudio(src);
      if (!a) return false;
      a.loop = false;
      a.pause();
      a.currentTime = 0;
      a.volume = vol();
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (_) {
      return false;
    }
  }

  function stopLoop() {
    try {
      if (loopTimer) {
        clearTimeout(loopTimer);
        clearInterval(loopTimer);
        loopTimer = null;
      }
      if (loopAudio) {
        loopAudio.loop = false;
        loopAudio.pause();
        loopAudio.currentTime = 0;
      }
      loopAudio = null;
    } catch (_) {}
  }

  function startLoop(src, maxMs) {
    if (muted() || !flagOn(KEY.call)) return;
    stopLoop();
    try {
      loopAudio = getAudio(src);
      if (!loopAudio) return;
      loopAudio.loop = true;
      loopAudio.volume = vol();
      loopAudio.currentTime = 0;
      var p = loopAudio.play();
      if (p && p.catch) p.catch(function () {});
      loopTimer = setTimeout(stopLoop, maxMs || 45000);
    } catch (_) {}
  }

  function peerFromUrl() {
    try {
      var q = new URLSearchParams(location.search || "");
      return (
        q.get("uid") ||
        q.get("userId") ||
        q.get("peer") ||
        q.get("to") ||
        q.get("user") ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function isOnChatWith(peerId) {
    try {
      var f = (location.pathname || "").split("/").pop() || "";
      if (f.indexOf("chat") !== 0) return false;
      if (document.hidden) return false;
      var uid = peerFromUrl();
      if (!peerId) return !!uid;
      return String(peerId) === String(uid);
    } catch (_) {
      return false;
    }
  }

  /* --- public API --- */
  function playNotify() {
    return playOnce(FILES.notify, "notify");
  }
  function playChatMessage() {
    return playOnce(FILES.chat, "chat");
  }
  function onNewMessage(peerId) {
    if (isOnChatWith(peerId)) return playChatMessage();
    return playNotify();
  }
  function startCallingTone() {
    startLoop(FILES.calling, 45000);
  }
  function startOutboundRingingTone() {
    startLoop(FILES.ringing, 45000);
  }
  function startIncomingRingtone() {
    startLoop(FILES.incoming, 45000);
  }

  var api = {
    FILES: FILES,
    LEGACY: LEGACY,
    playNotify: playNotify,
    playChatMessage: playChatMessage,
    playChatBeep: playChatMessage,
    playChat: playChatMessage,
    playMessage: playNotify,
    onNewMessage: onNewMessage,
    startCallingTone: startCallingTone,
    startOutboundRingingTone: startOutboundRingingTone,
    startIncomingRingtone: startIncomingRingtone,
    stopCallSounds: stopLoop,
    stopRing: stopLoop,
    startRing: startIncomingRingtone,
    isOnChatWith: isOnChatWith,
    unlock: unlock,
    setMuted: function (v) {
      lsSet(KEY.mute, v ? "1" : "0");
      if (v) stopLoop();
    },
    isMuted: muted,
    setMessageEnabled: function (v) {
      lsSet(KEY.msg, v ? "1" : "0");
    },
    setChatEnabled: function (v) {
      lsSet(KEY.chat, v ? "1" : "0");
    },
    setCallEnabled: function (v) {
      lsSet(KEY.call, v ? "1" : "0");
      if (!v) stopLoop();
    },
    setVolume: function (v) {
      lsSet(KEY.vol, String(v));
    },
    test: function (name) {
      unlock();
      stopLoop();
      name = String(name || "").toLowerCase();
      if (name === "notify" || name === "message") return playNotify();
      if (name === "chat") return playChatMessage();
      if (name === "calling") return startCallingTone();
      if (name === "ringing") return startOutboundRingingTone();
      if (name === "incoming") return startIncomingRingtone();
      return playNotify();
    },
    getPrefs: function () {
      return {
        muted: muted(),
        messageOn: flagOn(KEY.msg),
        chatOn: flagOn(KEY.chat),
        callOn: flagOn(KEY.call),
        volume: vol()
      };
    }
  };

  /* Keep older scripts working */
  try {
    lsSet("viewora_message_sound", FILES.notify);
    lsSet("viewora_chat_beep", FILES.chat);
    lsSet("viewora_call_ringtone", FILES.incoming);
  } catch (_) {}

  g.VieworaSounds = api;
  g.playMessageTone = function () {
    api.playChatMessage();
  };
  g.playMessageSound = function () {
    api.playNotify();
  };

  console.log("[VieworaSounds] named files ready", FILES);
})(typeof window !== "undefined" ? window : this);
