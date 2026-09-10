"use strict";

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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 1280 },
        aspectRatio: { ideal: 9 / 16 }
      }
    });
    localStream = stream;
    return stream;
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
    await db.ref("live/" + uid).set(payload);
    // also flag on user for quick ring checks
    await db.ref("users/" + uid + "/isLive").set(true);
    await db.ref("users/" + uid + "/liveAt").set(firebase.database.ServerValue.TIMESTAMP);
    return payload;
  }

  async function endLiveSession() {
    if (!me) return;
    const uid = hostUid || me.uid;
    try {
      // Read live meta before closing
      const liveSnap = await db.ref("live/" + uid).once("value");
      const live = liveSnap.val() || {};
      const startedAt = Number(live.startedAt || 0);
      const endedAt = Date.now();
      const durationSec = startedAt ? Math.max(0, Math.round((endedAt - startedAt) / 1000)) : 0;
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

      // Save replay / live post so it appears in feed & profile
      const postRef = db.ref("posts").push();
      const postId = postRef.key;
      const postPayload = {
        id: postId,
        uid: uid,
        userId: uid,
        type: "live",
        isLiveReplay: true,
        title: title,
        caption: title + " · Live ended",
        text: title + " · Live ended",
        description: "Live stream · " + formatDuration(durationSec),
        hostName: hostName,
        hostPhoto: hostPhoto,
        photoURL: hostPhoto,
        avatar: hostPhoto,
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
        status: "public"
      };
      await postRef.set(postPayload);

      // Archive under liveReplays
      await db.ref("liveReplays/" + postId).set({
        ...postPayload,
        liveId: uid
      });

      // Link on user
      await db.ref("users/" + uid + "/lastLivePostId").set(postId);

      await db.ref("live/" + uid).update({
        active: false,
        endedAt: firebase.database.ServerValue.TIMESTAMP,
        savedPostId: postId,
        peakViewers: peakViewers,
        durationSec: durationSec
      });
      await db.ref("users/" + uid + "/isLive").set(false);
      await db.ref("live/" + uid + "/viewers").remove();
      console.log("[LIVE] Saved as post", postId);
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
      u.photoURL || u.avatar || u.profilePhoto || "assets/default-avatar.png";
    if ($("hostName")) $("hostName").textContent = name;
    if ($("hostAvatar")) {
      $("hostAvatar").src = photo;
      $("hostAvatar").onerror = function () {
        this.src = "assets/default-avatar.png";
      };
    }
  }

  function addComment(name, text) {
    const box = $("liveComments");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "live-comment";
    el.innerHTML = "<b>" + escapeHtml(name) + "</b><span>" + escapeHtml(text) + "</span>";
    box.appendChild(el);
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
      if (v) {
        v.srcObject = stream;
        v.muted = true;
        v.play().catch(() => {});
      }
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
        preview.srcObject = localStream;
        preview.muted = true;
        preview.play().catch(() => {});
      }
      if ($("liveTitleLabel")) $("liveTitleLabel").textContent = title;
      await fillHostChrome(me.uid);
      $("endLiveBtn")?.classList.remove("hidden");
      attachLiveListeners(me.uid);
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
      $("hostAvatar").src = data.hostPhoto || "assets/default-avatar.png";
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

    commentsRef = db.ref("live/" + uid + "/comments").limitToLast(40);
    commentsRef.on("child_added", (snap) => {
      const c = snap.val() || {};
      addComment(c.name || "User", c.text || "");
    });
  }

  async function sendComment() {
    const input = $("liveCommentInput");
    const text = (input?.value || "").trim();
    if (!text || !hostUid || !me) return;
    const u = await loadUser(me.uid);
    const name = u.displayName || u.name || u.username || "User";
    await db.ref("live/" + hostUid + "/comments").push({
      uid: me.uid,
      name: name,
      text: text,
      at: firebase.database.ServerValue.TIMESTAMP
    });
    if (input) input.value = "";
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
    stopCam();
    if (liveRef) liveRef.off();
    if (commentsRef) commentsRef.off();
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
    $("endLiveBtn")?.addEventListener("click", leave);
    $("closeLiveBtn")?.addEventListener("click", leave);
    $("sendCommentBtn")?.addEventListener("click", sendComment);
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
