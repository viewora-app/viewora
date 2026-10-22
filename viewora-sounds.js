/**
 * VIEWORA SOUNDS — WhatsApp / Instagram style
 * -------------------------------------------
 * Include on ALL main pages AFTER firebase.js, BEFORE message-listener / chat / call:
 *   <script src="viewora-sounds.js"></script>
 *
 * API:
 *   VieworaSounds.playMessage()   // new msg while NOT in that chat
 *   VieworaSounds.playChat()      // new msg while chat open
 *   VieworaSounds.startRing()     // incoming call
 *   VieworaSounds.stopRing()
 *   VieworaSounds.test('message'|'chat'|'ring')
 *   VieworaSounds.setMuted(true)
 *   VieworaSounds.setMessageEnabled(true)
 *   VieworaSounds.setChatEnabled(true)
 *   VieworaSounds.setCallEnabled(true)
 */
(function (global) {
  "use strict";
  if (global.__VIEWORA_SOUNDS__) return;
  global.__VIEWORA_SOUNDS__ = true;

  var KEYS = {
    masterMute: "viewora_sound_muted",
    msgOn: "viewora_sound_message_on",
    chatOn: "viewora_sound_chat_on",
    callOn: "viewora_sound_call_on",
    msgSrc: "viewora_message_sound",
    chatSrc: "viewora_chat_beep",
    ringSrc: "viewora_call_ringtone",
    vol: "viewora_sound_volume"
  };

  var DEFAULTS = {
    message: "assets/message-tone.mp3",
    chat: "assets/chat-beep.mp3",
    ring: "assets/call-ringtone.mp3"
  };

  var cache = {};
  var ringAudio = null;
  var ringTimer = null;
  var lastMsgAt = 0;
  var lastChatAt = 0;
  var unlocked = false;

  function lsGet(k, fallback) {
    try {
      var v = localStorage.getItem(k);
      if (v == null || v === "") return fallback;
      return v;
    } catch (_) {
      return fallback;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (_) {}
  }
  function bool(k, defTrue) {
    var v = lsGet(k, defTrue ? "1" : "0");
    return v === "1" || v === "true";
  }
  function setBool(k, on) {
    lsSet(k, on ? "1" : "0");
  }

  function volume() {
    var n = parseFloat(lsGet(KEYS.vol, "0.85"));
    if (isNaN(n)) n = 0.85;
    return Math.max(0, Math.min(1, n));
  }

  function isMasterMuted() {
    return bool(KEYS.masterMute, false);
  }

  function getSrc(kind) {
    if (kind === "chat") return lsGet(KEYS.chatSrc, DEFAULTS.chat);
    if (kind === "ring") return lsGet(KEYS.ringSrc, DEFAULTS.ring);
    return lsGet(KEYS.msgSrc, DEFAULTS.message);
  }

  function getAudio(kind) {
    var src = getSrc(kind);
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

  function playOnce(kind, minGap) {
    if (isMasterMuted()) return false;
    if (kind === "message" && !bool(KEYS.msgOn, true)) return false;
    if (kind === "chat" && !bool(KEYS.chatOn, true)) return false;
    if (kind === "ring" && !bool(KEYS.callOn, true)) return false;

    var now = Date.now();
    if (kind === "message") {
      if (now - lastMsgAt < (minGap || 400)) return false;
      lastMsgAt = now;
    }
    if (kind === "chat") {
      if (now - lastChatAt < (minGap || 220)) return false;
      lastChatAt = now;
    }

    try {
      var a = getAudio(kind);
      if (!a) return beepFallback(kind);
      a.pause();
      a.currentTime = 0;
      a.volume = volume();
      a.loop = false;
      var p = a.play();
      if (p && p.catch) p.catch(function () { beepFallback(kind); });
      return true;
    } catch (_) {
      return beepFallback(kind);
    }
  }

  function beepFallback(kind) {
    try {
      var Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return false;
      var ctx = new Ctx();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = kind === "chat" ? 1500 : kind === "ring" ? 460 : 1000;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      var t = ctx.currentTime;
      var peak = volume() * (kind === "chat" ? 0.1 : 0.14);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "chat" ? 0.08 : 0.25));
      o.start(t);
      o.stop(t + 0.3);
      setTimeout(function () {
        try { ctx.close(); } catch (_) {}
      }, 400);
      return true;
    } catch (_) {
      return false;
    }
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    ["message", "chat", "ring"].forEach(function (k) {
      try {
        var a = getAudio(k);
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

  function startRing() {
    if (isMasterMuted() || !bool(KEYS.callOn, true)) return;
    stopRing();
    try {
      ringAudio = getAudio("ring");
      if (!ringAudio) {
        // fallback loop via timer + beep
        ringTimer = setInterval(function () {
          beepFallback("ring");
        }, 1200);
        return;
      }
      ringAudio.loop = true;
      ringAudio.volume = volume();
      ringAudio.currentTime = 0;
      var p = ringAudio.play();
      if (p && p.catch) p.catch(function () {});
      // safety stop after 45s
      ringTimer = setTimeout(stopRing, 45000);
    } catch (_) {}
  }

  function stopRing() {
    try {
      if (ringTimer) {
        clearTimeout(ringTimer);
        clearInterval(ringTimer);
        ringTimer = null;
      }
      if (ringAudio) {
        ringAudio.loop = false;
        ringAudio.pause();
        ringAudio.currentTime = 0;
      }
    } catch (_) {}
  }

  /** WhatsApp-like: if viewing this peer chat → chat beep, else message tone */
  function notifyIncomingMessage(peerId) {
    try {
      var onChat = false;
      var f = (location.pathname || "").split("/").pop() || "";
      if (f.indexOf("chat") === 0) {
        var q = new URLSearchParams(location.search || "");
        var uid =
          q.get("uid") ||
          q.get("userId") ||
          q.get("peer") ||
          q.get("to") ||
          "";
        if (peerId && uid && String(peerId) === String(uid)) onChat = true;
        if (!peerId && uid) onChat = true;
      }
      if (onChat && !document.hidden) {
        return playOnce("chat", 220);
      }
      return playOnce("message", 400);
    } catch (_) {
      return playOnce("message", 400);
    }
  }

  var api = {
    playMessage: function () {
      return playOnce("message", 400);
    },
    playChat: function () {
      return playOnce("chat", 220);
    },
    notifyIncomingMessage: notifyIncomingMessage,
    startRing: startRing,
    stopRing: stopRing,
    test: function (kind) {
      unlock();
      if (kind === "ring") {
        startRing();
        setTimeout(stopRing, 2500);
        return;
      }
      if (kind === "chat") return playOnce("chat", 0);
      return playOnce("message", 0);
    },
    setMuted: function (on) {
      setBool(KEYS.masterMute, !!on);
      if (on) stopRing();
    },
    isMuted: isMasterMuted,
    setMessageEnabled: function (on) {
      setBool(KEYS.msgOn, !!on);
    },
    setChatEnabled: function (on) {
      setBool(KEYS.chatOn, !!on);
    },
    setCallEnabled: function (on) {
      setBool(KEYS.callOn, !!on);
      if (!on) stopRing();
    },
    setVolume: function (v) {
      lsSet(KEYS.vol, String(v));
    },
    getVolume: volume,
    getPrefs: function () {
      return {
        muted: isMasterMuted(),
        messageOn: bool(KEYS.msgOn, true),
        chatOn: bool(KEYS.chatOn, true),
        callOn: bool(KEYS.callOn, true),
        volume: volume(),
        messageSrc: getSrc("message"),
        chatSrc: getSrc("chat"),
        ringSrc: getSrc("ring")
      };
    },
    unlock: unlock
  };

  // Keep legacy keys in sync for message-listener.js
  try {
    if (!localStorage.getItem(KEYS.msgSrc)) lsSet(KEYS.msgSrc, DEFAULTS.message);
    if (!localStorage.getItem(KEYS.chatSrc)) lsSet(KEYS.chatSrc, DEFAULTS.chat);
    if (!localStorage.getItem(KEYS.ringSrc)) lsSet(KEYS.ringSrc, DEFAULTS.ring);
  } catch (_) {}

  global.VieworaSounds = api;
  // aliases
  global.playMessageTone = function () {
    api.playChat();
  };
  global.playMessageSound = function () {
    api.playMessage();
  };

  console.log("[VieworaSounds] ready — WA/IG style");
})(typeof window !== "undefined" ? window : this);
