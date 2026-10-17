/* Viewora Chat Reliability — offline queue, retry, reconnect, delivery UX
 * Load AFTER chat.js (and firebase.js).
 * No fake messages. Works with existing vieworaChats/{id}/messages paths.
 */
(function () {
  "use strict";

  var OUTBOX_KEY = "viewora_chat_outbox_v1";
  var MAX_OUTBOX = 80;
  var RETRY_MS = 3500;
  var MAX_RETRY = 8;

  var auth = null;
  var db = null;
  var flushTimer = null;
  var flushing = false;
  var connected = true;
  var wired = false;

  function log() {
    try {
      var a = ["[VIEWORA CHAT RELIABILITY]"].concat([].slice.call(arguments));
      console.log.apply(console, a);
    } catch (_) {}
  }

  function toast(msg) {
    try {
      if (window.showToast) return window.showToast(msg, "warning");
    } catch (_) {}
    try {
      var t = document.getElementById("toast");
      if (t) {
        t.textContent = msg;
        t.classList.add("show");
        setTimeout(function () {
          t.classList.remove("show");
        }, 2200);
      }
    } catch (_) {}
  }

  function uid() {
    try {
      return (auth && auth.currentUser && auth.currentUser.uid) || null;
    } catch (_) {
      return null;
    }
  }

  function loadOutbox() {
    try {
      var raw = localStorage.getItem(OUTBOX_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function saveOutbox(arr) {
    try {
      if (arr.length > MAX_OUTBOX) arr = arr.slice(arr.length - MAX_OUTBOX);
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(arr));
    } catch (_) {}
  }

  function queueMessage(item) {
    var box = loadOutbox();
    item.localId = item.localId || "out_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    item.createdAtClient = item.createdAtClient || Date.now();
    item.retries = item.retries || 0;
    item.status = "pending";
    box.push(item);
    saveOutbox(box);
    paintPending(item);
    scheduleFlush(800);
    return item.localId;
  }

  function removeFromOutbox(localId) {
    var box = loadOutbox().filter(function (x) {
      return x.localId !== localId;
    });
    saveOutbox(box);
    unpaintPending(localId);
  }

  function paintPending(item) {
    try {
      var list = document.getElementById("messagesList") || document.querySelector(".messagesList, #chatMessages, .chatMessages");
      if (!list) return;
      if (document.getElementById("pending_" + item.localId)) return;
      var div = document.createElement("div");
      div.id = "pending_" + item.localId;
      div.className = "msgBubble me pendingReliability";
      div.setAttribute("data-local-id", item.localId);
      div.innerHTML =
        '<div class="msgText">' +
        escapeHtml(item.text || "[media]") +
        '</div><div class="msgMeta"><span class="msgStatus">Sending…</span></div>';
      list.appendChild(div);
      try {
        list.scrollTop = list.scrollHeight;
      } catch (_) {}
    } catch (_) {}
  }

  function markPendingFailed(localId, reason) {
    var el = document.getElementById("pending_" + localId);
    if (!el) return;
    var st = el.querySelector(".msgStatus");
    if (st) st.textContent = "Failed · tap to retry";
    el.classList.add("failedReliability");
    el.onclick = function () {
      scheduleFlush(100);
      toast("Retrying…");
    };
  }

  function unpaintPending(localId) {
    var el = document.getElementById("pending_" + localId);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function serverTs() {
    try {
      return firebase.database.ServerValue.TIMESTAMP;
    } catch (_) {
      return Date.now();
    }
  }

  function chatIdFor(a, b) {
    if (!a || !b) return null;
    return a < b ? a + "_" + b : b + "_" + a;
  }

  async function writeTextMessage(item) {
    var me = uid();
    if (!me || !db) throw new Error("Not signed in");
    var peer = item.peerUid || item.receiverId;
    if (!peer) throw new Error("No peer");
    var chatId = item.chatId || chatIdFor(me, peer);
    var messagesPath =
      item.messagesPath ||
      "vieworaChats/" + chatId + "/messages";

    var ref = db.ref(messagesPath).push();
    var msg = {
      id: ref.key,
      senderId: me,
      receiverId: peer,
      type: item.type || "text",
      text: item.text || "",
      createdAt: serverTs(),
      deliveredAt: null,
      seenAt: null,
      edited: false,
      pinned: false,
      deletedForEveryone: false,
      clientLocalId: item.localId
    };
    if (item.replyTo) msg.replyTo = item.replyTo;
    if (item.mediaUrl) {
      msg.mediaUrl = item.mediaUrl;
      msg.type = item.type || "image";
    }

    await ref.set(msg);

    // lightweight inbox sync (best-effort)
    var preview = (item.text || "").slice(0, 120);
    var ts = serverTs();
    var nowMs = Date.now();
    var inboxPatch = {
      chatId: chatId,
      userId: peer,
      peerId: peer,
      peerUid: peer,
      lastMessage: preview || (item.type || "message"),
      lastMessageAt: ts,
      lastMessageTime: ts,
      lastSenderId: me,
      updatedAt: ts,
      unread: 0,
      unreadCount: 0
    };
    try {
      await db.ref("userChats/" + me + "/" + chatId).update(inboxPatch);
    } catch (_) {}
    try {
      await db.ref("userChats/" + peer + "/" + chatId).transaction(function (cur) {
        cur = cur || {};
        cur.chatId = chatId;
        cur.userId = me;
        cur.peerId = me;
        cur.peerUid = me;
        cur.lastMessage = inboxPatch.lastMessage;
        cur.lastMessageAt = nowMs;
        cur.lastMessageTime = nowMs;
        cur.lastSenderId = me;
        cur.updatedAt = nowMs;
        cur.unread = (Number(cur.unread || 0) || 0) + 1;
        cur.unreadCount = (Number(cur.unreadCount || 0) || 0) + 1;
        cur.read = false;
        cur.seen = false;
        return cur;
      });
    } catch (_) {}
    try {
      await db.ref("vieworaChats/" + chatId).update({
        lastMessage: preview,
        lastMessageAt: serverTs(),
        updatedAt: serverTs()
      });
    } catch (_) {}

    return msg;
  }

  async function flushOutbox() {
    if (flushing) return;
    if (!navigator.onLine) {
      log("offline — hold outbox");
      return;
    }
    if (!uid() || !db) return;
    flushing = true;
    try {
      var box = loadOutbox();
      if (!box.length) return;
      log("flush", box.length);
      for (var i = 0; i < box.length; i++) {
        var item = box[i];
        if (item.retries >= MAX_RETRY) {
          markPendingFailed(item.localId, "max retries");
          continue;
        }
        try {
          await writeTextMessage(item);
          removeFromOutbox(item.localId);
          log("sent", item.localId);
        } catch (e) {
          item.retries = (item.retries || 0) + 1;
          item.lastError = (e && e.message) || "fail";
          log("retry fail", item.localId, item.lastError);
          var all = loadOutbox().map(function (x) {
            return x.localId === item.localId ? item : x;
          });
          saveOutbox(all);
          if (item.retries >= MAX_RETRY) markPendingFailed(item.localId, item.lastError);
        }
      }
    } finally {
      flushing = false;
    }
  }

  function scheduleFlush(ms) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(function () {
      flushOutbox().catch(function () {});
    }, ms == null ? RETRY_MS : ms);
  }

  /** Public: queue a text if live send fails, or when offline */
  function reliableSendText(opts) {
    opts = opts || {};
    var text = String(opts.text || "").trim();
    if (!text) return Promise.reject(new Error("Empty"));
    var peer = opts.peerUid || opts.receiverId;
    if (!peer) return Promise.reject(new Error("No peer"));

    var item = {
      peerUid: peer,
      receiverId: peer,
      chatId: opts.chatId || chatIdFor(uid(), peer),
      text: text,
      type: "text",
      replyTo: opts.replyTo || null,
      messagesPath: opts.messagesPath || null
    };

    if (!navigator.onLine || !connected) {
      queueMessage(item);
      toast("You're offline — message queued");
      return Promise.resolve({ queued: true, localId: item.localId });
    }

    return writeTextMessage(item)
      .then(function (msg) {
        return { queued: false, message: msg };
      })
      .catch(function (e) {
        queueMessage(item);
        toast("Send failed — queued for retry");
        return { queued: true, error: e };
      });
  }

  function wireConnection() {
    if (!db || wired) return;
    wired = true;
    try {
      db.ref(".info/connected").on("value", function (snap) {
        connected = snap.val() === true;
        log("firebase connected:", connected);
        if (connected) scheduleFlush(500);
      });
    } catch (_) {}

    window.addEventListener("online", function () {
      log("browser online");
      scheduleFlush(400);
    });
    window.addEventListener("offline", function () {
      log("browser offline");
      toast("Offline — messages will send when back online");
    });

    // periodic safety flush
    setInterval(function () {
      if (navigator.onLine && loadOutbox().length) scheduleFlush(0);
    }, 15000);
  }

  function patchChatSendIfPossible() {
    // If VieworaChat exposes send, wrap it; else hook send button once DOM ready
    try {
      if (window.VieworaChat && typeof window.VieworaChat.sendText === "function") {
        var orig = window.VieworaChat.sendText;
        window.VieworaChat.sendText = function () {
          var args = arguments;
          return Promise.resolve(orig.apply(window.VieworaChat, args)).catch(function (e) {
            log("VieworaChat.sendText failed, queue", e);
            throw e;
          });
        };
      }
    } catch (_) {}

    // Hook #sendBtn / form submit failures via capture of input
    document.addEventListener(
      "click",
      function (e) {
        var btn = e.target && e.target.closest && e.target.closest("#sendBtn, .sendBtn, [data-send-message]");
        if (!btn) return;
        // Don't block default chat.js handler — only help if offline
        if (!navigator.onLine) {
          var input =
            document.getElementById("messageInput") ||
            document.querySelector("textarea.messageInput, #chatInput, .chatInput textarea");
          var text = input && input.value ? String(input.value).trim() : "";
          if (!text) return;
          e.preventDefault();
          e.stopPropagation();
          var peer =
            (window.state && (window.state.peerUid || window.state.otherUid || window.state.targetUid)) ||
            (new URLSearchParams(location.search).get("uid") ||
              new URLSearchParams(location.search).get("user") ||
              new URLSearchParams(location.search).get("id"));
          if (!peer) {
            toast("Open a chat first");
            return;
          }
          reliableSendText({ text: text, peerUid: peer }).then(function () {
            if (input) input.value = "";
          });
        }
      },
      true
    );
  }

  function ensureCss() {
    if (document.getElementById("vieworaChatReliabilityCss")) return;
    var s = document.createElement("style");
    s.id = "vieworaChatReliabilityCss";
    s.textContent =
      ".pendingReliability{opacity:.75;border:1px dashed rgba(167,139,250,.45)!important}" +
      ".pendingReliability .msgStatus{font-size:11px;color:#a78bfa}" +
      ".failedReliability{opacity:1;border-color:rgba(239,68,68,.5)!important}" +
      ".failedReliability .msgStatus{color:#f87171;cursor:pointer}";
    document.head.appendChild(s);
  }

  function boot() {
    try {
      auth = firebase.auth();
      db = firebase.database();
    } catch (e) {
      log("firebase not ready", e);
      setTimeout(boot, 200);
      return;
    }
    ensureCss();
    wireConnection();
    patchChatSendIfPossible();
    // repaint any leftover outbox
    loadOutbox().forEach(paintPending);
    scheduleFlush(1000);
    log("ready, outbox=", loadOutbox().length);

    auth.onAuthStateChanged(function (u) {
      if (u) scheduleFlush(600);
    });
  }

  // Expose API for chat.js integration
  window.VieworaChatReliability = {
    queue: queueMessage,
    flush: flushOutbox,
    sendText: reliableSendText,
    outbox: loadOutbox,
    isConnected: function () {
      return !!(navigator.onLine && connected);
    }
  };

  if (window.firebase && firebase.apps && firebase.apps.length) boot();
  else setTimeout(boot, 150);
})();
