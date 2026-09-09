"use strict";

/*
============================================================
 VIEWORA — GLOBAL MESSAGE LISTENER
 Shows new message banner on EVERY page (like incoming calls)
 + notification sound (customizable)
 + browser Notification when tab/app in background

 Include on all main pages (after firebase.js):
   <script src="message-listener.js"></script>

 Sounds (optional):
   localStorage.setItem("viewora_message_sound", "assets/message-tone.mp3");
   localStorage.setItem("viewora_call_ringtone", "assets/call-ringtone.mp3");

 Firebase path listened:
   userChats/{myUid}/{peerUid}
   fields: unread, lastMessage, lastMessageAt, updatedAt, name, photoURL, peerId
============================================================
*/

(() => {
  if (window.__VIEWORA_MESSAGE_LISTENER__) return;
  window.__VIEWORA_MESSAGE_LISTENER__ = true;

  if (typeof firebase === "undefined" || !window.auth || !window.db) {
    console.warn("[VIEWORA MSG] Firebase not ready.");
    return;
  }

  const SOUND_KEY = "viewora_message_sound";
  const DEFAULT_SOUND = "assets/message-tone.mp3";

  let currentUser = null;
  let chatsRef = null;
  let known = {}; // peerId -> { unread, lastAt, lastText }
  let primed = false;
  let bannerEl = null;
  let hideTimer = null;
  let audioEl = null;

  function log() {
    try {
      console.log.apply(console, ["[VIEWORA MSG]"].concat([].slice.call(arguments)));
    } catch (_) {}
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pageName() {
    return (location.pathname.split("/").pop() || "").toLowerCase();
  }

  function isOnChatWith(peerId) {
    const page = pageName();
    if (page !== "chat.html") return false;
    try {
      const p = new URLSearchParams(location.search);
      const uid = p.get("uid") || p.get("user") || p.get("peer") || "";
      return uid && peerId && uid === peerId;
    } catch (_) {
      return false;
    }
  }

  function isMessagesPage() {
    const p = pageName();
    return p === "messages.html" || p === "chat.html";
  }

  /* ---------- sound ---------- */
  function getSoundSrc() {
    try {
      let src = localStorage.getItem(SOUND_KEY) || DEFAULT_SOUND;
      // Never play call ringtone for messages
      if (!src || src.indexOf("call-ringtone") !== -1 || src.indexOf("call_ringtone") !== -1) {
        src = DEFAULT_SOUND;
      }
      return src;
    } catch (_) {
      return DEFAULT_SOUND;
    }
  }

  function playMessageSound() {
    try {
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.preload = "auto";
      }
      audioEl.src = getSoundSrc();
      audioEl.currentTime = 0;
      const p = audioEl.play();
      if (p && p.catch) p.catch(() => playBeepFallback());
    } catch (_) {
      playBeepFallback();
    }
  }

  function playBeepFallback() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.start(t);
      o.stop(t + 0.3);
      setTimeout(() => {
        try {
          ctx.close();
        } catch (_) {}
      }, 400);
    } catch (_) {}
  }

  /* ---------- system notification ---------- */
  function ensureNotifPermission() {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch (_) {}
  }

  function showSystemNotification(title, body, peerId) {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      // Only when tab hidden / background
      if (!document.hidden && document.visibilityState === "visible") return;

      const n = new Notification(title || "New message", {
        body: body || "You have a new message on Viewora",
        icon: "assets/logo.png",
        badge: "assets/logo.png",
        tag: "viewora-msg-" + (peerId || "x"),
        renotify: true
      });
      n.onclick = function () {
        window.focus();
        location.href =
          "chat.html?uid=" + encodeURIComponent(peerId || "");
        n.close();
      };
      setTimeout(() => {
        try {
          n.close();
        } catch (_) {}
      }, 8000);
    } catch (_) {}
  }

  /* ---------- in-app banner ---------- */
  function ensureStyles() {
    if (document.getElementById("vieworaMsgListenerStyles")) return;
    const style = document.createElement("style");
    style.id = "vieworaMsgListenerStyles";
    style.textContent =
      "#vieworaMsgBanner{position:fixed;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translateX(-50%) translateY(-120%);z-index:99999;width:min(420px,calc(100% - 24px));background:rgba(18,18,24,.96);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:12px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 12px 40px rgba(0,0,0,.45);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:transform .35s cubic-bezier(.2,.9,.2,1);cursor:pointer}" +
      "#vieworaMsgBanner.show{transform:translateX(-50%) translateY(0)}" +
      "#vieworaMsgBanner img{width:44px;height:44px;border-radius:50%;object-fit:cover;background:#333;flex-shrink:0}" +
      "#vieworaMsgBanner .meta{flex:1;min-width:0}" +
      "#vieworaMsgBanner .name{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#vieworaMsgBanner .preview{font-size:13px;color:rgba(255,255,255,.7);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#vieworaMsgBanner .closeBtn{border:0;background:rgba(255,255,255,.08);color:#fff;width:28px;height:28px;border-radius:50%;flex-shrink:0}" +
      "[data-theme=light] #vieworaMsgBanner{background:rgba(255,255,255,.96);color:#111;border-color:rgba(0,0,0,.08)}" +
      "[data-theme=light] #vieworaMsgBanner .preview{color:rgba(0,0,0,.55)}" +
      "[data-theme=light] #vieworaMsgBanner .closeBtn{background:rgba(0,0,0,.06);color:#111}";
    document.head.appendChild(style);
  }

  function showBanner(opts) {
    ensureStyles();
    if (!bannerEl) {
      bannerEl = document.createElement("div");
      bannerEl.id = "vieworaMsgBanner";
      document.body.appendChild(bannerEl);
    }

    const name = opts.name || "Someone";
    const text = opts.text || "New message";
    const photo = opts.photo || "";
    const peerId = opts.peerId || "";

    bannerEl.innerHTML =
      (photo
        ? '<img src="' + escapeHtml(photo) + '" alt="">'
        : '<img src="assets/default-avatar.png" alt="">') +
      '<div class="meta"><div class="name">' +
      escapeHtml(name) +
      '</div><div class="preview">' +
      escapeHtml(text) +
      '</div></div><button type="button" class="closeBtn" aria-label="Close">✕</button>';

    bannerEl.onclick = function (e) {
      if (e.target && e.target.classList.contains("closeBtn")) {
        hideBanner();
        return;
      }
      if (peerId) location.href = "chat.html?uid=" + encodeURIComponent(peerId);
    };

    requestAnimationFrame(() => bannerEl.classList.add("show"));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBanner, 5500);
  }

  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.classList.remove("show");
  }

  /* ---------- core logic ---------- */
  function lastAtOf(chat) {
    return Number(
      chat.lastMessageAt ||
        chat.updatedAt ||
        chat.timestamp ||
        chat.time ||
        0
    );
  }

  function lastTextOf(chat) {
    const m = chat.lastMessage;
    if (typeof m === "string") return m;
    if (m && typeof m === "object") {
      return m.text || m.message || m.caption || m.type || "New message";
    }
    return chat.lastText || chat.preview || "New message";
  }

  function handleChatSnap(snap) {
    const data = snap.val() || {};
    const peerIds = Object.keys(data);

    // First snapshot: only seed, no alerts
    if (!primed) {
      peerIds.forEach((pid) => {
        const c = data[pid] || {};
        known[pid] = {
          unread: Number(c.unread || c.unreadCount || 0),
          lastAt: lastAtOf(c),
          lastText: lastTextOf(c)
        };
      });
      primed = true;
      log("primed", peerIds.length, "chats");
      return;
    }

    peerIds.forEach((pid) => {
      const c = data[pid] || {};
      const unread = Number(c.unread || c.unreadCount || 0);
      const lastAt = lastAtOf(c);
      const lastText = lastTextOf(c);
      const prev = known[pid] || { unread: 0, lastAt: 0, lastText: "" };

      const isNew =
        (unread > prev.unread && unread > 0) ||
        (lastAt > prev.lastAt && unread > 0);

      known[pid] = { unread: unread, lastAt: lastAt, lastText: lastText };

      if (!isNew) return;
      if (isOnChatWith(pid)) return; // already reading this chat

      const name =
        c.name || c.displayName || c.username || c.peerName || "Someone";
      const photo =
        c.photoURL || c.avatar || c.profilePic || c.peerPhoto || "";

      log("new message from", pid, lastText);

      playMessageSound();
      showBanner({
        name: name,
        text: lastText,
        photo: photo,
        peerId: pid
      });
      showSystemNotification(name, lastText, pid);
    });
  }

  async function start() {
    try {
      currentUser = auth.currentUser;
      if (!currentUser) {
        await new Promise((resolve, reject) => {
          const unsub = auth.onAuthStateChanged((u) => {
            unsub();
            if (u) {
              currentUser = u;
              resolve(u);
            } else reject(new Error("no auth"));
          });
        });
      }
    } catch (_) {
      log("not logged in — listener idle");
      return;
    }

    ensureNotifPermission();

    if (chatsRef) {
      try {
        chatsRef.off();
      } catch (_) {}
    }

    chatsRef = db.ref("userChats/" + currentUser.uid);
    chatsRef.on("value", handleChatSnap, (err) => {
      console.warn("[VIEWORA MSG] listen error", err);
    });

    log("listening userChats/" + currentUser.uid);
  }

  // Public helpers for settings page
  window.VieworaMessageSounds = {
    setMessageSound: function (url) {
      try {
        localStorage.setItem(SOUND_KEY, url || DEFAULT_SOUND);
      } catch (_) {}
    },
    setCallRingtone: function (url) {
      try {
        localStorage.setItem("viewora_call_ringtone", url || "assets/call-ringtone.mp3");
      } catch (_) {}
    },
    getMessageSound: getSoundSrc,
    getCallRingtone: function () {
      try {
        return localStorage.getItem("viewora_call_ringtone") || "assets/call-ringtone.mp3";
      } catch (_) {
        return "assets/call-ringtone.mp3";
      }
    },
    testMessageSound: playMessageSound
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
