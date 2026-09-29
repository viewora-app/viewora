"use strict";

  // Live format: story | shorts | video (3 types)
  (function applyLiveFormat() {
    try {
      var params = new URLSearchParams(location.search);
      var format = (params.get("format") || params.get("type") || "").toLowerCase();
      var aspect = (params.get("aspect") || "").toLowerCase().replace(":", "x");
      if (format === "video" || format === "long" || format === "stream") {
        format = "video";
      } else if (format === "shorts" || format === "short") {
        format = "shorts";
      } else if (format === "story" || format === "stories") {
        format = "story";
      } else if (aspect === "16x9" || aspect.indexOf("16x9") !== -1) {
        format = "video";
      } else if (aspect === "9x16" || aspect.indexOf("9x16") !== -1) {
        // default vertical without explicit format → story
        format = "story";
      } else {
        format = "story";
      }
      document.body.classList.remove(
        "live-format-video",
        "live-format-story",
        "live-format-shorts"
      );
      document.body.classList.add("live-format-" + format);
      document.body.setAttribute("data-live-format", format);
      window.__VIEWORA_LIVE_FORMAT = format;
      var titles = {
        video: "Video Live • Viewora",
        shorts: "Shorts Live • Viewora",
        story: "Stories Live • Viewora"
      };
      var t = document.querySelector("title");
      if (t) t.textContent = titles[format] || titles.story;
    } catch (_) {
      document.body.classList.add("live-format-story");
      window.__VIEWORA_LIVE_FORMAT = "story";
    }
  })();


/*
============================================================
 VIEWORA LIVE
 • Host starts live → live/{uid} active
 • Story rings turn RED (CSS class .live + live-ring-helper)
 • Viewers open live.html?uid=HOST_UID
 • Live comments in Firebase
 • Host camera preview (getUserMedia)
 Note: Full multi-viewer WebRTC SFU needs a media server later.
        This version: presence + red rings + room UI + host cam + comments.
============================================================
*/

(() => {
  if (window.__VIEWORA_LIVE__) return;
  window.__VIEWORA_LIVE__ = true;

  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  const hostUidParam = params.get("uid") || params.get("host") || "";
  const wantStart = params.get("start") === "1" || params.get("mode") === "host";

  let me = null;
  let hostUid = hostUidParam;
  let isHost = false;
  let liveRef = null;
  let commentsRef = null;
  let viewersRef = null;
  let localStream = null;
  let ended = false;
  var auth = window.auth || null;
  var db = window.db || null;

  function toast(msg) {
    try {
      console.log("[LIVE]", msg);
    } catch (_) {}
    alert(msg);
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveAuth() {
    if (window.auth) return window.auth;
    try { return firebase.auth(); } catch (_) { return null; }
  }
  function resolveDb() {
    if (window.db) return window.db;
    try { return firebase.database(); } catch (_) { return null; }
  }

  async function waitAuth() {
    let a = resolveAuth();
    let d = resolveDb();
    for (let i = 0; i < 8 && (!a || !d); i++) {
      await new Promise((r) => setTimeout(r, 400));
      a = resolveAuth();
      d = resolveDb();
    }
    if (!a || !d) throw new Error("Firebase not ready");
    window.auth = a;
    window.db = d;
    // use globals expected by rest of file
    // eslint-disable-next-line no-global-assign
    auth = a;
    // eslint-disable-next-line no-global-assign
    db = d;

    if (a.currentUser) {
      me = a.currentUser;
      return me;
    }
    return new Promise((resolve, reject) => {
      const unsub = a.onAuthStateChanged((u) => {
        unsub();
        if (u) {
          me = u;
          resolve(u);
        } else reject(new Error("Login required"));
      });
    });
  }

  async function loadUser(uid) {
    try {
      const snap = await db.ref("users/" + uid).once("value");
      return snap.exists() ? snap.val() || {} : {};
    } catch (_) {
      return {};
    }
  }

  /* ---------- Media ---------- */
  async function getCam() {
    const fmt = window.__VIEWORA_LIVE_FORMAT || "story";
    const isVideo = fmt === "video";
    const videoConstraints = isVideo
      ? {
          facingMode: { ideal: "user" },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          aspectRatio: { ideal: 16 / 9 }
        }
      : {
          // story + shorts = vertical 9:16
          facingMode: { ideal: "user" },
          width: { ideal: 720, max: 1080 },
          height: { ideal: 1280, max: 1920 },
          aspectRatio: { ideal: 9 / 16 }
        };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: videoConstraints
      });
    } catch (e1) {
      // fallback soft constraints
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" }
      });
    }
    localStream = stream;
    return stream;
  }

  function bindPreviewVideo(videoEl, stream) {
    if (!videoEl || !stream) return;
    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.setAttribute("playsinline", "true");
    videoEl.playsInline = true;
    // Natural orientation — NOT mirrored (user asked to remove mirror)
    videoEl.style.transform = "none";
    videoEl.style.objectFit = "contain";
    videoEl.style.background = "#000";
    videoEl.play().catch(function () {});
  }

  function stopCam() {
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      localStream = null;
    }
  }

  /* ---------- Firebase live node ---------- */
  async function createLiveSession(title) {
    const uid = me.uid;
    const user = await loadUser(uid);
    const payload = {
      active: true,
      hostUid: uid,
      title: title || "Live",
      hostName:
        user.displayName || user.name || user.username || me.displayName || "Host",
      hostPhoto:
        user.photoURL || user.avatar || user.profilePhoto || user.profilePic || "",
      startedAt: firebase.database.ServerValue.TIMESTAMP,
      viewerCount: 0
    };
    payload.liveFormat = window.__VIEWORA_LIVE_FORMAT || "story";
    payload.aspect = payload.liveFormat === "video" ? "16:9" : "9:16";
    payload.isStoryLive = payload.liveFormat === "story";
    payload.isShortsLive = payload.liveFormat === "shorts";
    payload.isVideoLive = payload.liveFormat === "video";
    await db.ref("live/" + uid).set(payload);

    // User flags — story ring ONLY for Stories Live
    const updates = {
      liveFormat: payload.liveFormat,
      liveAt: firebase.database.ServerValue.TIMESTAMP,
      liveTitle: payload.title || "Live"
    };
    if (payload.isStoryLive) {
      updates.isLive = true;
      updates.storyLive = true;
    } else {
      updates.isLive = false;
      updates.storyLive = false;
    }
    // shorts / video still mark activity for discovery
    updates.isShortsLive = !!payload.isShortsLive;
    updates.isVideoLive = !!payload.isVideoLive;
    await db.ref("users/" + uid).update(updates);

    // Feed cards
    const card = {
      active: true,
      hostUid: uid,
      uid: uid,
      title: payload.title || "Live",
      hostName: payload.hostName,
      hostPhoto: payload.hostPhoto,
      liveFormat: payload.liveFormat,
      aspect: payload.aspect,
      startedAt: Date.now(),
      viewerCount: 0,
      type: "live",
      isLive: true
    };

    if (payload.isShortsLive) {
      await db.ref("feedLive/shorts/" + uid).set(card);
      await db.ref("shortsLive/" + uid).set(card);
    } else {
      await db.ref("feedLive/shorts/" + uid).remove().catch(function () {});
      await db.ref("shortsLive/" + uid).remove().catch(function () {});
    }

    if (payload.isVideoLive) {
      await db.ref("feedLive/videos/" + uid).set(card);
      await db.ref("videosLive/" + uid).set(card);
    } else {
      await db.ref("feedLive/videos/" + uid).remove().catch(function () {});
      await db.ref("videosLive/" + uid).remove().catch(function () {});
    }

    if (payload.isStoryLive) {
      await db.ref("feedLive/stories/" + uid).set(card);
    } else {
      await db.ref("feedLive/stories/" + uid).remove().catch(function () {});
    }

    return payload;
  }

  async function endLiveSession() {
    if (!me) return;
    const uid = hostUid || me.uid;
    try {
      const liveSnap = await db.ref("live/" + uid).once("value");
      const live = liveSnap.val() || {};
      const startedAt = Number(live.startedAt || 0);
      const endedAt = Date.now();
      const durationSec = startedAt
        ? Math.max(0, Math.round((endedAt - startedAt) / 1000))
        : 0;
      let peakViewers = Number(live.viewerCount || 0);
      try {
        const vSnap = await db.ref("live/" + uid + "/viewers").once("value");
        if (vSnap.exists()) peakViewers = Math.max(peakViewers, vSnap.numChildren());
      } catch (_) {}

      const user = await loadUser(uid);
      const hostName =
        live.hostName ||
        user.displayName ||
        user.name ||
        user.username ||
        me.displayName ||
        "Host";
      const hostPhoto =
        live.hostPhoto ||
        user.photoURL ||
        user.avatar ||
        user.profilePhoto ||
        user.profilePic ||
        "";
      const title = live.title || "Live";
      const format =
        live.liveFormat ||
        window.__VIEWORA_LIVE_FORMAT ||
        (live.isVideoLive ? "video" : live.isShortsLive ? "shorts" : "story");

      const replayId = db.ref("liveReplays").push().key;
      const payload = {
        id: replayId,
        uid: uid,
        userId: uid,
        type: "live_replay",
        liveFormat: format,
        isLiveReplay: true,
        isStoryLive: format === "story",
        isShortsLive: format === "shorts",
        isVideoLive: format === "video",
        title: title,
        caption: title,
        description: "Live · " + formatDuration(durationSec),
        hostName: hostName,
        hostPhoto: hostPhoto,
        photoURL: hostPhoto,
        thumbnail: hostPhoto,
        name: hostName,
        username: user.username || "",
        duration: durationSec,
        viewerCount: peakViewers,
        views: peakViewers,
        likesCount: 0,
        commentsCount: 0,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        timestamp: endedAt,
        liveStartedAt: startedAt || null,
        liveEndedAt: endedAt,
        status: "public",
        // no fake image/video URL — UI uses live replay card
        hasMedia: false
      };

      // Always archive under liveReplays (profile Live tab + admin)
      await db.ref("liveReplays/" + replayId).set(payload);
      await db.ref("users/" + uid + "/liveReplays/" + replayId).set({
        id: replayId,
        title: title,
        liveFormat: format,
        duration: durationSec,
        endedAt: endedAt,
        viewerCount: peakViewers,
        thumbnail: hostPhoto
      });

      // Route by format — NEVER write empty "posts" without media
      if (format === "video") {
        await db.ref("videos/" + replayId).set({
          ...payload,
          type: "live_replay",
          wasLive: true,
          isLive: false
        });
      } else if (format === "shorts") {
        await db.ref("shorts/" + replayId).set({
          ...payload,
          type: "live_replay",
          wasLive: true,
          isLive: false,
          isShort: true
        });
      }
      // story live → only liveReplays (stories ring / highlights flow), not posts grid

      // Close live flags & feed cards
      await db.ref("users/" + uid).update({
        isLive: false,
        storyLive: false,
        isShortsLive: false,
        isVideoLive: false,
        liveFormat: null,
        liveAt: null,
        liveTitle: null
      });
      await db.ref("live/" + uid).update({
        active: false,
        endedAt: endedAt,
        duration: durationSec
      });
      try {
        await db.ref("feedLive/shorts/" + uid).remove();
        await db.ref("feedLive/videos/" + uid).remove();
        await db.ref("shortsLive/" + uid).remove();
        await db.ref("videosLive/" + uid).remove();
        await db.ref("live/" + uid + "/viewers").remove();
        await db.ref("live/" + uid + "/signal").remove();
      } catch (_) {}

      console.log("[LIVE] Replay saved", replayId, format);
      try {
        toast("Live ended · saved to " + (format === "video" ? "Videos" : format === "shorts" ? "Shorts" : "Live history"));
      } catch (_) {}
    } catch (e) {
      console.warn("endLiveSession", e);
      try {
        await db.ref("users/" + (hostUid || me.uid) + "/isLive").set(false);
        await db.ref("live/" + (hostUid || me.uid)).update({ active: false });
      } catch (_) {}
    }
  }

  function formatDuration(sec) {
    sec = Number(sec) || 0;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m <= 0) return s + "s";
    return m + "m " + (s < 10 ? "0" : "") + s + "s";
  }

  /* ---------- UI ---------- */
  function showSetup() {
    $("liveSetup")?.classList.remove("hidden");
    $("liveRoom")?.classList.add("hidden");
  }

  function showRoom() {
    $("liveSetup")?.classList.add("hidden");
    $("liveRoom")?.classList.remove("hidden");
  }

  async function fillHostChrome(uid) {
    const u = await loadUser(uid);
    const name = u.displayName || u.name || u.username || "Host";
    const photo =
      u.photoURL || u.avatar || u.profilePhoto || "https://ui-avatars.com/api/?name=H&background=7c3aed&color=fff&size=128";
    if ($("hostName")) $("hostName").textContent = name;
    if ($("hostAvatar")) {
      $("hostAvatar").src = photo;
      $("hostAvatar").onerror = function () {
        this.src = "https://ui-avatars.com/api/?name=H&background=7c3aed&color=fff&size=128";
      };
    }
  }

  const seenCommentKeys = {};
  function addComment(name, text, key) {
    const box = $("liveComments");
    if (!box) return;
    if (key) {
      if (seenCommentKeys[key]) return;
      seenCommentKeys[key] = true;
    }
    // also de-dupe identical rapid text from same user (3x spam)
    const sig = String(name) + "|" + String(text);
    const now = Date.now();
    if (addComment._lastSig === sig && now - (addComment._lastAt || 0) < 1500) {
      return;
    }
    addComment._lastSig = sig;
    addComment._lastAt = now;

    const el = document.createElement("div");
    el.className = "live-comment";
    if (key) el.dataset.key = key;
    el.innerHTML =
      "<b>" + escapeHtml(name) + "</b> <span>" + escapeHtml(text) + "</span>";
    box.appendChild(el);
    while (box.children.length > 50) {
      box.removeChild(box.firstChild);
    }
    box.scrollTop = box.scrollHeight;
  }

  /* ---------- Host flow ---------- */
  async function prepareSetup() {
    isHost = true;
    hostUid = me.uid;
    showSetup();
    try {
      const stream = await getCam();
      const v = $("setupPreview");
      if (v) bindPreviewVideo(v, stream);
    } catch (e) {
      toast("Camera/mic permission needed to go live.");
      console.error(e);
    }
  }

  async function startLive() {
    try {
      let title = ($("liveTitleInput")?.value || "").trim();
      if (!title) {
        try {
          const t = new URLSearchParams(location.search).get("title");
          if (t) title = t;
        } catch (_) {}
      }
      if (!title) {
        try {
          const raw = sessionStorage.getItem("vieworaLiveData");
          if (raw) {
            const d = JSON.parse(raw);
            if (d && d.title) title = d.title;
          }
        } catch (_) {}
      }
      title = title || "Live";
      if (!localStream) await getCam();
      await createLiveSession(title);
      showRoom();
      const preview = $("livePreview");
      if (preview && localStream) {
        preview.classList.remove("hidden");
        bindPreviewVideo(preview, localStream);
      }
      if ($("liveTitleLabel")) $("liveTitleLabel").textContent = title;
      await fillHostChrome(me.uid);
      $("endLiveBtn")?.classList.remove("hidden");
      attachLiveListeners(me.uid);
      try { wireHostControls(); } catch (_) {}
      try { hostWatchViewersForWebrtc(me.uid); } catch (e) { console.warn("host webrtc watch", e); }
      try {
        var mainV = $("liveVideo");
        if (mainV && localStream) {
          mainV.srcObject = localStream;
          mainV.muted = true;
          mainV.play().catch(function () {});
        }
      } catch (_) {}
    } catch (e) {
      console.error(e);
      toast("Could not start live. Try again.");
    }
  }

  /* ---------- Viewer flow ---------- */
  async function joinAsViewer(uid) {
    isHost = false;
    hostUid = uid;
    showRoom();
    $("liveWaiting")?.classList.remove("hidden");
    $("endLiveBtn")?.classList.add("hidden");

    const snap = await db.ref("live/" + uid).once("value");
    if (!snap.exists() || !snap.val().active) {
      toast("This live has ended.");
      location.href = "index.html";
      return;
    }
    const data = snap.val() || {};
    if ($("liveTitleLabel")) $("liveTitleLabel").textContent = data.title || "Live";
    if ($("hostName")) $("hostName").textContent = data.hostName || "Host";
    if ($("hostAvatar")) {
      $("hostAvatar").src = data.hostPhoto || "https://ui-avatars.com/api/?name=H&background=7c3aed&color=fff&size=128";
    }
    await fillHostChrome(uid);

    // register viewer
    const vRef = db.ref("live/" + uid + "/viewers/" + me.uid);
    await vRef.set({
      uid: me.uid,
      joinedAt: firebase.database.ServerValue.TIMESTAMP
    });
    vRef.onDisconnect().remove();

    attachLiveListeners(uid);
    $("liveWaiting")?.classList.add("hidden");
    try { await viewerJoinWebrtc(uid); } catch (e) { console.warn("viewer webrtc", e); }
  }

  
  /* ---------- Reactions + stickers ---------- */
  function spawnFloatEmoji(emoji) {
    const layer = $("liveFloatLayer");
    if (!layer) return;
    const el = document.createElement("span");
    el.className = "live-float-emoji";
    el.textContent = emoji;
    el.style.left = Math.floor(Math.random() * 40) + "px";
    layer.appendChild(el);
    setTimeout(function () {
      try { el.remove(); } catch (_) {}
    }, 2500);
  }

  async function sendLiveReaction(emoji, kind) {
    if (!hostUid || !me || !emoji) return;
    spawnFloatEmoji(emoji);
    try {
      await db.ref("live/" + hostUid + "/reactions").push({
        uid: me.uid,
        emoji: emoji,
        kind: kind || "reaction",
        at: Date.now()
      });
    } catch (_) {}
  }

  function bindReactionsUI() {
    document.querySelectorAll(".live-rx[data-rx]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        sendLiveReaction(btn.getAttribute("data-rx"), "reaction");
      });
    });
    const stickerBtn = $("liveStickerBtn");
    const panel = $("liveStickerPanel");
    if (stickerBtn && panel) {
      stickerBtn.addEventListener("click", function () {
        panel.classList.toggle("hidden");
      });
      panel.querySelectorAll("[data-sticker]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          sendLiveReaction(btn.getAttribute("data-sticker"), "sticker");
          panel.classList.add("hidden");
        });
      });
    }
  }

  let reactionsRef = null;
  function attachReactions(uid) {
    if (reactionsRef) {
      try { reactionsRef.off(); } catch (_) {}
    }
    reactionsRef = db.ref("live/" + uid + "/reactions").limitToLast(30);
    reactionsRef.on("child_added", function (snap) {
      const d = snap.val() || {};
      if (d.uid && me && d.uid === me.uid && Date.now() - Number(d.at || 0) < 2000) {
        return; // already floated locally
      }
      if (d.emoji) spawnFloatEmoji(d.emoji);
    });
  }

  
  function showViewerPlaceholder(host) {
    const stage = document.querySelector(".live-stage") || $("liveRoom");
    if (!stage) return;
    let ph = document.getElementById("viewerLivePlaceholder");
    if (!ph) {
      ph = document.createElement("div");
      ph.id = "viewerLivePlaceholder";
      ph.className = "viewer-live-placeholder";
      stage.insertBefore(ph, stage.firstChild);
    }
    const photo = (host && (host.hostPhoto || host.photoURL || host.avatar)) || "https://ui-avatars.com/api/?name=H&background=7c3aed&color=fff&size=128";
    const name = (host && (host.hostName || host.name)) || "Host";
    const title = (host && host.title) || "Live";
    ph.innerHTML =
      '<img class="vlp-bg" src="' + String(photo).replace(/"/g, "") + '" alt="" onerror="this.style.display=\'none\'">' +
      '<div class="vlp-center">' +
      '<img class="vlp-avatar" src="' + String(photo).replace(/"/g, "") + '" alt="" onerror="this.src=\'assets/default-avatar.png\">' +
      '<strong>' + String(name).replace(/</g, "") + '</strong>' +
      '<span class="vlp-live"><i class="fa-solid fa-circle"></i> LIVE</span>' +
      '<p>' + String(title).replace(/</g, "") + '</p>' +
      '<small>Connecting to stream…</small>' +
      '</div>';
  }

  function attachLiveListeners(uid) {
    liveRef = db.ref("live/" + uid);
    liveRef.on("value", (snap) => {
      const d = snap.val();
      if (!d || d.active === false) {
        if (!ended && !isHost) {
          ended = true;
          toast("Live ended");
          setTimeout(() => {
            location.href = "index.html";
          }, 500);
        }
        return;
      }
      if (!isHost) {
        try {
          var f = d.liveFormat || "story";
          document.body.classList.remove("live-format-video","live-format-story","live-format-shorts");
          document.body.classList.add("live-format-" + f);
          document.body.setAttribute("data-live-format", f);
          window.__VIEWORA_LIVE_FORMAT = f;
        } catch (_) {}
        showViewerPlaceholder(d);
        if ($("hostName")) $("hostName").textContent = d.hostName || "Host";
        if ($("liveTitleLabel")) $("liveTitleLabel").textContent = d.title || "Live";
        if ($("hostAvatar") && d.hostPhoto) {
          $("hostAvatar").src = d.hostPhoto;
        }
      }
      if ($("viewerCount")) {
        const vc = d && d.viewers ? Object.keys(d.viewers).length : Number(d?.viewerCount || 0);
        $("viewerCount").textContent = String(vc);
      }
    });

    viewersRef = db.ref("live/" + uid + "/viewers");
    viewersRef.on("value", (snap) => {
      const n = snap.exists() ? snap.numChildren() : 0;
      if ($("viewerCount")) $("viewerCount").textContent = String(n);
      db.ref("live/" + uid + "/viewerCount").set(n).catch(() => {});
    });

    if (commentsRef) {
      try { commentsRef.off(); } catch (_) {}
    }
    commentsRef = db.ref("live/" + uid + "/comments").limitToLast(40);
    commentsRef.on("child_added", (snap) => {
      const c = snap.val() || {};
      addComment(c.name || "User", c.text || "", snap.key);
    });
    attachReactions(uid);
  }

  let sendingComment = false;
  async function sendComment() {
    const input = $("liveCommentInput");
    const text = (input?.value || "").trim();
    if (!text || !hostUid || !me || sendingComment) return;
    sendingComment = true;
    try {
      if (input) input.value = "";
      const u = await loadUser(me.uid);
      const name = u.displayName || u.name || u.username || "User";
      await db.ref("live/" + hostUid + "/comments").push({
        uid: me.uid,
        name: name,
        text: text,
        at: Date.now()
      });
    } catch (e) {
      console.error(e);
      if (input) input.value = text;
    } finally {
      sendingComment = false;
    }
  }

  async function leave() {
    ended = true;
    if (isHost) {
      await endLiveSession();
    } else if (hostUid && me) {
      try {
        await db.ref("live/" + hostUid + "/viewers/" + me.uid).remove();
      } catch (_) {}
    }
    closeAllWebrtc(); stopCam();
    if (liveRef) liveRef.off();
    if (commentsRef) commentsRef.off();
    if (reactionsRef) try { reactionsRef.off(); } catch (_) {}
    if (viewersRef) viewersRef.off();
    location.href = "index.html";
  }

  /* ---------- Boot ---------- */
  async function boot() {
    try {
      await waitAuth();
    } catch (_) {
      location.href = "login.html";
      return;
    }

    $("setupBack")?.addEventListener("click", () => {
      stopCam();
      history.back();
    });
    $("startLiveBtn")?.addEventListener("click", startLive);
    try { /* host controls wired after go-live */ } catch (_) {}
    $("endLiveBtn")?.addEventListener("click", leave);
    $("closeLiveBtn")?.addEventListener("click", leave);
    $("sendCommentBtn")?.addEventListener("click", sendComment);
    try { bindReactionsUI(); } catch (_) {}
    $("liveCommentInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendComment();
    });

    window.addEventListener("beforeunload", () => {
      if (isHost) endLiveSession();
      stopCam();
    });

    if (wantStart || (!hostUidParam && !hostUid)) {
      // Host from Create/Upload — open setup, prefill title, optional auto-start
      await prepareSetup();
      try {
        const t = new URLSearchParams(location.search).get("title");
        if (t && $("liveTitleInput")) $("liveTitleInput").value = t;
        else {
          const raw = sessionStorage.getItem("vieworaLiveData");
          if (raw) {
            const d = JSON.parse(raw);
            if (d && d.title && $("liveTitleInput")) $("liveTitleInput").value = d.title;
          }
        }
      } catch (_) {}
      // From upload with start=1 → go live automatically after camera ready
      if (wantStart) {
        setTimeout(() => { startLive().catch(() => {}); }, 600);
      }
    } else if (hostUidParam) {
      if (hostUidParam === me.uid) await prepareSetup();
      else await joinAsViewer(hostUidParam);
    } else {
      await prepareSetup();
    }
  }



  /* ============================================================
     WEBRTC BROADCAST (host → each viewer, 1-way)
     No SFU required. Host holds N peer connections (practical ~8–12).
     ============================================================ */
  var hostPeers = {}; // viewerUid -> { pc }
  var viewerPc = null;
  var usingFront = true;
  var micMuted = false;
  var MAX_LIVE_VIEWER_PEERS = 12;

  function liveIceServers() {
    var servers = [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }
    ];
    try {
      var custom = window.VieworaTurnConfig;
      if (!custom) {
        var raw = localStorage.getItem("viewora_turn_config");
        if (raw) custom = JSON.parse(raw);
      }
      if (custom && custom.urls) {
        servers.push({
          urls: Array.isArray(custom.urls) ? custom.urls : [custom.urls],
          username: custom.username || "",
          credential: custom.credential || ""
        });
      } else {
        servers.push({
          urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443"],
          username: "openrelayproject",
          credential: "openrelayproject"
        });
      }
    } catch (_) {}
    return { iceServers: servers, iceCandidatePoolSize: 8, bundlePolicy: "max-bundle" };
  }

  function signalRef(hostId, viewerId) {
    return db.ref("live/" + hostId + "/signal/" + viewerId);
  }

  async function hostCreatePeerForViewer(viewerUid) {
    if (!isHost || !localStream || !viewerUid || viewerUid === me.uid) return;
    if (hostPeers[viewerUid]) return;
    if (Object.keys(hostPeers).length >= MAX_LIVE_VIEWER_PEERS) {
      console.warn("[Live] max viewer peers reached");
      return;
    }
    var pc = new RTCPeerConnection(liveIceServers());
    hostPeers[viewerUid] = { pc: pc };
    localStream.getTracks().forEach(function (track) {
      try { pc.addTrack(track, localStream); } catch (e) { console.warn(e); }
    });
    var sref = signalRef(hostUid || me.uid, viewerUid);
    pc.onicecandidate = function (ev) {
      if (ev.candidate) {
        sref.child("hostCandidates").push(ev.candidate.toJSON()).catch(function () {});
      }
    };
    pc.onconnectionstatechange = function () {
      var st = pc.connectionState;
      if (st === "failed" || st === "closed" || st === "disconnected") {
        try { pc.close(); } catch (_) {}
        delete hostPeers[viewerUid];
      }
    };
    try {
      var offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
      await sref.update({
        offer: { type: offer.type, sdp: offer.sdp },
        hostUid: me.uid,
        at: Date.now()
      });
      // listen answer once
      sref.child("answer").on("value", async function (snap) {
        var ans = snap.val();
        if (!ans || !ans.sdp) return;
        try {
          if (!pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(ans));
          }
        } catch (e) { console.warn("setRemote answer", e); }
      });
      sref.child("viewerCandidates").on("child_added", async function (snap) {
        var c = snap.val();
        if (!c) return;
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
      });
    } catch (e) {
      console.error("[Live] host peer", e);
      try { pc.close(); } catch (_) {}
      delete hostPeers[viewerUid];
    }
  }

  function hostWatchViewersForWebrtc(uid) {
    db.ref("live/" + uid + "/viewers").on("child_added", function (snap) {
      var vid = snap.key;
      if (vid && vid !== me.uid) hostCreatePeerForViewer(vid);
    });
    db.ref("live/" + uid + "/viewers").on("child_removed", function (snap) {
      var vid = snap.key;
      var entry = hostPeers[vid];
      if (entry && entry.pc) {
        try { entry.pc.close(); } catch (_) {}
      }
      delete hostPeers[vid];
      try { signalRef(uid, vid).remove(); } catch (_) {}
    });
  }

  async function viewerJoinWebrtc(hostId) {
    if (!me || !hostId) return;
    try {
      viewerPc = new RTCPeerConnection(liveIceServers());
      var sref = signalRef(hostId, me.uid);
      viewerPc.ontrack = function (ev) {
        var stream = ev.streams && ev.streams[0];
        if (!stream) {
          stream = new MediaStream([ev.track]);
        }
        var v = $("liveVideo");
        if (v) {
          v.srcObject = stream;
          v.muted = false;
          v.playsInline = true;
          v.setAttribute("playsinline", "true");
          v.play().catch(function () {});
        }
        document.body.classList.add("live-streaming");
        var ph = document.querySelector(".viewer-live-placeholder");
        if (ph) ph.style.display = "none";
        var wait = $("liveWaiting");
        if (wait) wait.classList.add("hidden");
      };
      viewerPc.onicecandidate = function (ev) {
        if (ev.candidate) {
          sref.child("viewerCandidates").push(ev.candidate.toJSON()).catch(function () {});
        }
      };
      // wait for host offer
      sref.child("offer").on("value", async function (snap) {
        var off = snap.val();
        if (!off || !off.sdp || !viewerPc) return;
        try {
          if (viewerPc.currentRemoteDescription) return;
          await viewerPc.setRemoteDescription(new RTCSessionDescription(off));
          var answer = await viewerPc.createAnswer();
          await viewerPc.setLocalDescription(answer);
          await sref.update({
            answer: { type: answer.type, sdp: answer.sdp },
            answeredAt: Date.now()
          });
        } catch (e) {
          console.warn("viewer answer", e);
        }
      });
      sref.child("hostCandidates").on("child_added", async function (snap) {
        var c = snap.val();
        if (!c || !viewerPc) return;
        try { await viewerPc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
      });
      // ensure viewer entry exists (triggers host peer)
      await db.ref("live/" + hostId + "/viewers/" + me.uid).set({
        uid: me.uid,
        name: me.displayName || "Viewer",
        photo: me.photoURL || "",
        at: Date.now()
      });
      try {
        db.ref("live/" + hostId + "/viewers/" + me.uid).onDisconnect().remove();
      } catch (_) {}
    } catch (e) {
      console.error("[Live] viewer webrtc", e);
    }
  }

  function closeAllWebrtc() {
    Object.keys(hostPeers).forEach(function (id) {
      try { hostPeers[id].pc.close(); } catch (_) {}
    });
    hostPeers = {};
    if (viewerPc) {
      try { viewerPc.close(); } catch (_) {}
      viewerPc = null;
    }
  }

  /* Host controls */
  function wireHostControls() {
    var bar = $("liveHostControls");
    if (isHost && bar) bar.classList.remove("hidden");
    $("liveMuteBtn")?.addEventListener("click", function () {
      if (!localStream) return;
      micMuted = !micMuted;
      localStream.getAudioTracks().forEach(function (tr) { tr.enabled = !micMuted; });
      var btn = $("liveMuteBtn");
      if (btn) {
        btn.classList.toggle("active", micMuted);
        btn.innerHTML = micMuted
          ? '<i class="fa-solid fa-microphone-slash"></i>'
          : '<i class="fa-solid fa-microphone"></i>';
      }
      toast(micMuted ? "Mic muted" : "Mic on");
    });
    $("liveFlipBtn")?.addEventListener("click", async function () {
      if (!localStream || !isHost) return;
      try {
        var old = localStream.getVideoTracks()[0];
        if (!old) return;
        usingFront = !usingFront;
        var facing = usingFront ? "user" : "environment";
        var devices = await navigator.mediaDevices.enumerateDevices();
        var cams = devices.filter(function (d) { return d.kind === "videoinput"; });
        var constraints = { audio: false, video: { facingMode: { ideal: facing } } };
        if (cams.length >= 2) {
          var curId = old.getSettings ? (old.getSettings().deviceId || "") : "";
          var idx = cams.findIndex(function (d) { return d.deviceId === curId; });
          if (idx < 0) idx = 0;
          var next = cams[(idx + 1) % cams.length];
          constraints.video = { deviceId: { exact: next.deviceId } };
          var lab = String(next.label || "").toLowerCase();
          usingFront = !(/back|rear|environment/.test(lab));
        }
        var ns = await navigator.mediaDevices.getUserMedia(constraints);
        var nt = ns.getVideoTracks()[0];
        if (!nt) return;
        // replace on all host peers
        Object.keys(hostPeers).forEach(function (id) {
          var pc = hostPeers[id].pc;
          var sender = pc.getSenders().find(function (s) { return s.track && s.track.kind === "video"; });
          if (sender) sender.replaceTrack(nt).catch(function () {});
        });
        try { localStream.removeTrack(old); old.stop(); } catch (_) {}
        localStream.addTrack(nt);
        ns.getTracks().forEach(function (tr) {
          if (tr.id !== nt.id) try { tr.stop(); } catch (_) {}
        });
        var prev = $("livePreview") || $("liveVideo");
        if (prev && isHost) {
          prev.srcObject = localStream;
          prev.play().catch(function () {});
        }
        toast(usingFront ? "Front camera" : "Back camera");
      } catch (e) {
        console.warn("flip", e);
        usingFront = !usingFront;
        toast("Could not flip camera");
      }
    });
    $("liveShareBtn")?.addEventListener("click", async function () {
      var url = location.origin + location.pathname + "?uid=" + encodeURIComponent(hostUid || me.uid);
      try {
        if (navigator.share) {
          await navigator.share({ title: "Viewora Live", url: url });
        } else {
          await navigator.clipboard.writeText(url);
          toast("Live link copied");
        }
      } catch (_) {
        try {
          await navigator.clipboard.writeText(url);
          toast("Live link copied");
        } catch (__) {
          toast(url);
        }
      }
    });
  }


  /* Public helper: is user live? */
  window.VieworaLive = {
    openHost: () => {
      location.href = "live.html?start=1";
    },
    openViewer: (uid) => {
      location.href = "live.html?uid=" + encodeURIComponent(uid);
    },
    async isLive(uid) {
      try {
        const s = await db.ref("live/" + uid + "/active").once("value");
        return s.val() === true;
      } catch (_) {
        return false;
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
