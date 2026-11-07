/**
 * Viewora Sound Manager
 * All call / chat / PTT / group events → real files in assets/sounds/
 *
 * Usage:
 *   VieworaSounds.play("send_message");
 *   VieworaSounds.loop("incoming");
 *   VieworaSounds.stop("incoming");
 *   VieworaSounds.stopAll();
 */
(function (global) {
  "use strict";

  var BASE = "assets/sounds/";

  // Map logical event → file (relative to site root)
  var MAP = {
    // Calls
    connect_group_call: "connect-group.wav",
    end_call: "end-call.wav",
    end_call_m4: "end-call-m4.wav",
    incoming: "incoming.wav",
    incoming_group: "incoming-group.wav",
    incoming_short: "incoming-short.wav",
    join_group_call: "join-group.wav",
    join_group_call_m4: "join-group-m4.wav",
    leave_group_call: "leave-group.wav",
    leave_group_call_m4: "leave-group-m4.wav",
    group_ring_short: "group-ring-short.wav",
    calling: "calling.mp3",
    outgoing_call: "outgoing-call.mp3",
    ringing: "ringing.wav",
    on_hold: "on-hold.wav",
    reconnect: "reconnect.wav",

    // Chat / message
    send_message: "send-message.wav",
    message: "message.wav",
    voice_note_stop: "voice-note-stop.wav",

    // Push-to-talk / voice note (WhatsApp-style cues)
    ptt_end_fast: "ptt-end.wav",
    ptt_middle_fast: "ptt-middle.wav",
    ptt_start: "ptt-start.wav",
    ptt_stop: "voice-note-stop.wav",
    ptt_sent: "ptt-sent.wav",
    ptt_cancel: "ptt-cancel.wav",
    ptt_quick_cancel: "ptt-cancel.wav",
    ptt_slide_cancel: "ptt-slide-cancel.wav",
    ptt_start_recording: "ptt-start.wav",
    ptt_stop_recording: "ptt-end.wav"
  };

  // Aliases people might type
  var ALIAS = {
    "1": "connect_group_call",
    "2": "end_call",
    "3": "end_call_m4",
    "4": "incoming",
    "5": "incoming_group",
    "6": "incoming_short",
    "7": "join_group_call",
    "8": "join_group_call_m4",
    "9": "leave_group_call",
    "10": "leave_group_call_m4",
    "11": "group_ring_short",
    "12": "ptt_end_fast",
    "13": "ptt_middle_fast",
    "14": "send_message",
    "15": "voice_note_stop",
    "16": "ptt_quick_cancel",
    "17": "ptt_sent",
    "18": "ptt_slide_cancel",
    "19": "ptt_start_recording",
    "20": "ptt_stop_recording",
    end: "end_call",
    hangup: "end_call",
    ring: "ringing",
    ringtone: "incoming",
    chat_beep: "send_message",
    notify: "message"
  };

  var pool = {}; // key → HTMLAudioElement
  var looping = {};

  function resolve(name) {
    if (!name) return null;
    var k = String(name).trim();
    if (ALIAS[k]) k = ALIAS[k];
    if (ALIAS[k.toLowerCase()]) k = ALIAS[k.toLowerCase()];
    // normalize spaces / dashes
    var n = k.toLowerCase().replace(/[\s-]+/g, "_");
    if (MAP[n]) return n;
    if (MAP[k]) return k;
    return n;
  }

  function urlFor(key) {
    var file = MAP[key];
    if (!file) return null;
    return BASE + file;
  }

  function getAudio(key) {
    if (pool[key]) return pool[key];
    var url = urlFor(key);
    if (!url) return null;
    try {
      var a = new Audio(url);
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      pool[key] = a;
      return a;
    } catch (e) {
      console.warn("[VieworaSounds] create", key, e);
      return null;
    }
  }

  function play(name, opts) {
    opts = opts || {};
    var key = resolve(name);
    if (!key || !MAP[key]) {
      console.warn("[VieworaSounds] unknown:", name);
      return null;
    }
    try {
      var a = getAudio(key);
      if (!a) return null;
      // clone for overlapping one-shots
      var node = a.cloneNode(true);
      node.volume = opts.volume != null ? opts.volume : 0.85;
      if (opts.loop) node.loop = true;
      var p = node.play();
      if (p && typeof p.catch === "function") {
        p.catch(function (err) {
          // autoplay policy — silent fail, retry on next gesture
          console.warn("[VieworaSounds] play blocked", key, err && err.name);
        });
      }
      if (opts.loop) looping[key] = node;
      return node;
    } catch (e) {
      console.warn("[VieworaSounds] play", key, e);
      return null;
    }
  }

  function loop(name, opts) {
    opts = opts || {};
    opts.loop = true;
    stop(name);
    return play(name, opts);
  }

  function stop(name) {
    var key = resolve(name);
    try {
      if (key && looping[key]) {
        looping[key].pause();
        try {
          looping[key].currentTime = 0;
        } catch (_) {}
        looping[key] = null;
      }
      // also stop pooled original if looping on it
      if (key && pool[key]) {
        pool[key].pause();
        try {
          pool[key].currentTime = 0;
        } catch (_) {}
      }
    } catch (_) {}
  }

  function stopAll() {
    Object.keys(looping).forEach(function (k) {
      try {
        if (looping[k]) {
          looping[k].pause();
          looping[k] = null;
        }
      } catch (_) {}
    });
    Object.keys(pool).forEach(function (k) {
      try {
        pool[k].pause();
        pool[k].currentTime = 0;
      } catch (_) {}
    });
  }

  /** Preload important ones so first ring is instant */
  function preload(list) {
    (list || Object.keys(MAP)).forEach(function (k) {
      try {
        getAudio(k);
      } catch (_) {}
    });
  }

  // Unlock audio on first user gesture (mobile)
  function unlock() {
    try {
      var a = getAudio("ptt_start") || getAudio("send_message");
      if (!a) return;
      var p = a.play();
      if (p && p.then) {
        p.then(function () {
          a.pause();
          a.currentTime = 0;
        }).catch(function () {});
      }
    } catch (_) {}
  }
  ["touchstart", "pointerdown", "click"].forEach(function (ev) {
    document.addEventListener(
      ev,
      function once() {
        unlock();
        document.removeEventListener(ev, once, true);
      },
      true
    );
  });

  var api = {
    play: play,
    loop: loop,
    stop: stop,
    stopAll: stopAll,
    preload: preload,
    unlock: unlock,
    map: MAP
  };

  global.VieworaSounds = api;

  // Auto-preload core call/chat sounds
  try {
    if (document.readyState === "complete") {
      preload([
        "calling",
        "ringing",
        "incoming",
        "end_call",
        "send_message",
        "message",
        "reconnect",
        "ptt_start",
        "ptt_stop"
      ]);
    } else {
      window.addEventListener("load", function () {
        preload([
          "calling",
          "ringing",
          "incoming",
          "end_call",
          "send_message",
          "message",
          "reconnect"
        ]);
      });
    }
  } catch (_) {}
})(typeof window !== "undefined" ? window : this);
