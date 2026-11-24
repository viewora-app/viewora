"use strict";
(() => {
  if (window.__VIEWORA_STORIES__) return;
  window.__VIEWORA_STORIES__ = true;

  const STORY_TTL = 24 * 60 * 60 * 1000;
  const IMAGE_MS = 5000;

  /* ---------- Notifications (story mention / react / reply) ---------- */
  async function pushNotif(toUid, payload) {
    if (!toUid || !payload) return;
    try {
      if (state.user && toUid === state.user.uid) return; // no self-notify
      const ref = firebase.database().ref("notifications/" + toUid).push();
      await ref.set(Object.assign({
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        timestamp: Date.now(),
        read: false,
        isRead: false
      }, payload));
      return ref.key;
    } catch (e) {
      console.warn("[story notif]", e);
    }
  }

  async function actorName() {
    try {
      if (!state.user) return "Someone";
      const us = await fetchUser(state.user.uid);
      if (us) return us.displayName || us.name || us.username || "Someone";
      return state.user.displayName || "Someone";
    } catch (_) {
      return (state.user && state.user.displayName) || "Someone";
    }
  }

  async function notifyStoryMention(storyId, ownerUid, targetUid) {
    const name = await actorName();
    await pushNotif(targetUid, {
      type: "story_mention",
      kind: "mention",
      message: "mentioned you in their story",
      text: name + " mentioned you in their story",
      senderUID: state.user.uid,
      senderId: state.user.uid,
      fromUid: state.user.uid,
      storyId: storyId,
      ownerUid: ownerUid || state.user.uid,
      mediaType: "story"
    });
    // Instagram-style invite for Add to story
    try {
      const inv = firebase.database().ref("storyInvites/" + targetUid).push();
      const item = currentItem();
      const data = (item && item.data) || {};
      await inv.set({
        storyId: storyId,
        fromUid: state.user.uid,
        ownerUid: ownerUid || state.user.uid,
        mediaUrl: data.mediaUrl || data.imageUrl || data.videoUrl || data.url || "",
        thumb: data.thumbnail || data.mediaUrl || data.imageUrl || "",
        isVideo: !!(data.videoUrl || data.isVideo || (data.type === "video")),
        ownerName: name,
        ownerUsername: (data.username || data.ownerUsername || ""),
        status: "pending",
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      // Lightweight chat-style system message under a virtual thread
      try {
        const chatId = [state.user.uid, targetUid].sort().join("_");
        await firebase.database().ref("chats/" + chatId + "/messages").push({
          type: "story_mention",
          text: name + " mentioned you in their story",
          storyId: storyId,
          inviteId: inv.key,
          mediaUrl: data.mediaUrl || data.imageUrl || data.videoUrl || "",
          from: state.user.uid,
          to: targetUid,
          addToStory: true,
          createdAt: Date.now(),
          timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        await firebase.database().ref("userChats/" + targetUid + "/" + chatId).update({
          lastMessage: "Mentioned you in their story",
          updatedAt: Date.now(),
          unread: true
        });
        await firebase.database().ref("userChats/" + state.user.uid + "/" + chatId).update({
          lastMessage: "You mentioned them in your story",
          updatedAt: Date.now()
        });
      } catch (chatErr) {
        console.warn("story mention chat", chatErr);
      }
    } catch (e) {
      console.warn("story invite", e);
    }
  }

  async function notifyStoryReaction(storyId, ownerUid, fromUid, emoji) {
    if (!ownerUid || fromUid === ownerUid) return;
    const name = await actorName();
    const em = emoji || "❤️";
    await pushNotif(ownerUid, {
      type: "story_reaction",
      kind: "reaction",
      message: "reacted " + em + " to your story",
      text: name + " reacted " + em + " to your story",
      senderUID: fromUid,
      senderId: fromUid,
      fromUid: fromUid,
      storyId: storyId,
      emoji: em,
      reaction: em,
      mediaType: "story"
    });
  }

  async function notifyStoryReply(storyId, ownerUid, fromUid, replyId) {
    if (!ownerUid || fromUid === ownerUid) return;
    const name = await actorName();
    await pushNotif(ownerUid, {
      type: "story_reply",
      kind: "reply",
      message: "replied to your story",
      text: name + " replied to your story",
      senderUID: fromUid,
      senderId: fromUid,
      fromUid: fromUid,
      storyId: storyId,
      replyId: replyId || "",
      mediaType: "story"
    });
  }

  // Expose globally for other pages if needed
  window.notifyStoryMention = notifyStoryMention;
  window.notifyStoryReaction = notifyStoryReaction;
  window.notifyStoryReply = notifyStoryReply;


  const IMAGE_MUSIC_MS = 15000; // photo + music = 15s minimum
  const $ = (id) => document.getElementById(id);

  const state = {
    user: null,
    groups: [],
    groupIndex: 0,
    itemIndex: 0,
    timer: null,
    raf: null,
    startedAt: 0,
    duration: IMAGE_MS,
    paused: false,
    peopleMode: "mention",
    musicAudio: null,
    userCache: {}
  };

  function ready() {
    return typeof firebase !== "undefined" && firebase.database && firebase.auth;
  }

  function escapeHTML(v) {
    if (v == null) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    const t = $("toast"), tx = $("toastText");
    if (!t) return;
    if (tx) tx.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.add("hidden"), 2200);
  }

  function openSheet(id) { $(id)?.classList.remove("hidden"); }
  function closeSheet(id) { $(id)?.classList.add("hidden"); }

  function mediaURL(d) {
    if (!d || typeof d !== "object") return "";
    var keys = [
      "mediaURL", "mediaUrl", "media_url", "url", "src",
      "imageUrl", "imageURL", "image", "photo", "photoUrl", "photoURL",
      "videoUrl", "videoURL", "video", "downloadURL", "secure_url",
      "cloudinaryUrl", "fileUrl", "contentUrl", "thumb", "thumbnail"
    ];
    function ok(v) {
      if (typeof v !== "string") return "";
      v = v.trim();
      if (v.length < 8) return "";
      if (/^https?:\/\//i.test(v)) return v;
      if (/^\/\//.test(v)) return "https:" + v;
      if (/^data:image\//i.test(v)) return v;
      return "";
    }
    for (var i = 0; i < keys.length; i++) {
      var got = ok(d[keys[i]]);
      if (got && !/\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(got)) return got;
    }
    try {
      if (d.media && typeof d.media === "object") {
        var nested = mediaURL(d.media);
        if (nested) return nested;
      }
    } catch (_) {}
    return "";
  }

  function optimizeMediaUrl(url, asVideo) {
    if (!url || typeof url !== "string") return url;
    try {
      // Cloudinary: force progressive JPEG / limited size for mobile paint reliability
      if (url.indexOf("res.cloudinary.com") !== -1 && url.indexOf("/upload/") !== -1) {
        if (asVideo) {
          if (url.indexOf("/video/upload/") !== -1 && url.indexOf("f_auto") === -1) {
            url = url.replace("/video/upload/", "/video/upload/q_auto,f_auto/");
          }
        } else {
          if (url.indexOf("/image/upload/") !== -1 && url.indexOf("f_auto") === -1) {
            url = url.replace("/image/upload/", "/image/upload/f_auto,q_auto,c_limit,w_1080/");
          }
          // video URL used as poster frame
          if (url.indexOf("/video/upload/") !== -1) {
            url = url.replace("/video/upload/", "/video/upload/so_0,w_720,c_limit,f_jpg,q_auto/");
            url = url.replace(/\.(mp4|webm|mov)(\?|$)/i, ".jpg$2");
          }
        }
      }
    } catch (_) {}
    return url;
  }

  function ownerId(d) {
    return d?.uid || d?.userId || d?.ownerId || "";
  }
  function isExpired(d, now) {
    let c = Number(d.createdAt || d.timestamp || 0);
    if (!c) return true;
    if (c < 1e12) c = c * 1000; // seconds → ms
    let e = Number(d.expiresAt || 0);
    if (e && e < 1e12) e = e * 1000;
    if (!e) e = c + STORY_TTL;
    return e < now;
  }
  function avatarOf(d) {
    return d?.avatar || d?.photoURL || d?.profilePhoto || d?.profileImage || "assets/default-avatar.png";
  }
  function nameOf(d) {
    return d?.username || d?.userName || d?.displayName || d?.creatorName || d?.name || "…";
  }

  function isVerifiedUser(d) {
    if (!d || typeof d !== "object") return false;
    if (window.VieworaBadges && typeof VieworaBadges.isVerified === "function") {
      return VieworaBadges.isVerified(d);
    }
    if (
      d.verified === true ||
      d.isVerified === true ||
      d.blueTick === true ||
      d.redTick === true ||
      d.vip === true ||
      d.whiteTick === true
    ) return true;
    const s = String(d.verificationStatus || d.badge || "").toLowerCase();
    return (
      s === "verified" ||
      s === "creator" ||
      s === "influencer" ||
      s === "vip" ||
      s === "monetized"
    );
  }

  function musicInfo(data) {
    if (!data) return null;
    const m = data.music;
    let audioUrl = "";
    let title = "";
    let artist = "";
    let id = "";

    if (m && typeof m === "object") {
      id = m.id || m.key || "";
      audioUrl = m.audioUrl || m.audioURL || m.url || m.src || m.fileUrl || "";
      title = m.name || m.title || m.trackName || "";
      artist = m.artist || m.artistName || "";
    } else if (typeof m === "string") {
      if (m.indexOf("http") === 0) audioUrl = m;
      else id = m;
    }

    if (!audioUrl) {
      audioUrl =
        data.musicUrl ||
        data.musicURL ||
        data.audioUrl ||
        data.audioURL ||
        data.soundUrl ||
        data.soundURL ||
        "";
    }
    if (!title) {
      title =
        data.audioName ||
        data.musicTitle ||
        data.musicName ||
        data.songName ||
        "";
    }
    if (!artist) {
      artist = data.musicArtist || data.artist || data.songArtist || "";
    }
    if (!id) id = data.musicId || data.trackId || "";

    // ignore "original"
    if (id === "original" && !audioUrl) return null;
    if (!audioUrl && !title && !id) return null;
    if (!title) title = "Music";
    let startAt = 0;
    if (m && typeof m === "object") {
      startAt = Number(m.startAt || m.offset || m.startTime || 0) || 0;
    }
    if (!startAt) startAt = Number(data.musicStartAt || data.audioStartAt || 0) || 0;
    return { audioUrl, title, artist, id, startAt };
  }

  function stopMusic() {
    try {
      if (state.musicAudio) {
        state.musicAudio.pause();
        try { state.musicAudio.currentTime = 0; } catch (_) {}
        try { state.musicAudio.src = ""; } catch (_) {}
        state.musicAudio = null;
      }
    } catch (_) {}
    try {
      document.querySelectorAll("audio.vieworaStoryAudio, #storyAudio").forEach(function (a) {
        try {
          a.pause();
          a.removeAttribute("src");
          a.load();
        } catch (_) {}
      });
    } catch (_) {}
    window.__vieworaMusicPlayingUrl = "";
  }

  async function resolveMusicUrl(info) {
    if (!info) return null;
    if (info.audioUrl) return info.audioUrl;
    if (!info.id) return null;
    try {
      const snap = await firebase.database().ref("musicLibrary/" + info.id).once("value");
      if (snap.exists()) {
        const t = snap.val() || {};
        return t.audioUrl || t.url || t.src || "";
      }
      // scan library if id is custom key
      const all = await firebase.database().ref("musicLibrary").once("value");
      let found = "";
      all.forEach((c) => {
        if (found) return;
        const t = c.val() || {};
        if (c.key === info.id || t.id === info.id || t.name === info.title) {
          found = t.audioUrl || t.url || "";
        }
      });
      return found || null;
    } catch (_) {
      return null;
    }
  }

  function ensureAudioEl() {
    let el = $("storyAudio");
    if (el) return el;
    el = document.createElement("audio");
    el.id = "storyAudio";
    el.setAttribute("playsinline", "");
    el.setAttribute("preload", "auto");
    el.loop = true;
    el.style.display = "none";
    document.body.appendChild(el);
    return el;
  }

  let musicUnlockBound = false;
  
  // One-time audio unlock (gesture lost on page navigation)
  window.__vieworaMusicGestureUnlocked = false;
  window.__vieworaMusicPlayingUrl = "";
  function unlockStoryAudioFromGesture() {
    if (window.__vieworaMusicGestureUnlocked) return;
    window.__vieworaMusicGestureUnlocked = true;
    try {
      const el = ensureAudioEl();
      el.muted = false;
      el.volume = 1;
      const p = el.play();
      if (p && p.then) {
        p.then(function () {
          if (!el.getAttribute("src") && !el.src) el.pause();
        }).catch(function () {});
      }
    } catch (_) {}
    try {
      if (window.AudioContext || window.webkitAudioContext) {
        if (!window.__vieworaAudioCtx) {
          window.__vieworaAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (window.__vieworaAudioCtx.resume) window.__vieworaAudioCtx.resume();
      }
    } catch (_) {}
  }
  ["pointerdown", "touchstart", "click"].forEach(function (ev) {
    document.addEventListener(
      ev,
      function onFirstGesture() {
        unlockStoryAudioFromGesture();
        try {
          sessionStorage.setItem("VIEWORA_AUDIO_UNLOCK", "1");
        } catch (_) {}
        // Resume current / pending track — unmute + play
        try {
          var el =
            document.getElementById("storyAudio") ||
            state.musicAudio ||
            window.__vieworaPendingMusic;
          if (el && el.src) {
            el.muted = false;
            el.volume = 1;
            if (el.paused) el.play().catch(function () {});
          }
        } catch (_) {}
      },
      { capture: true, passive: true }
    );
  });

  function bindMusicUnlock() {
    if (musicUnlockBound) return;
    musicUnlockBound = true;
    const resume = () => {
      const el = $("storyAudio") || state.musicAudio;
      if (!el) return;
      try {
        if (el.paused) el.play().catch(() => {});
      } catch (_) {}
    };
    ["touchstart", "touchend", "click", "pointerdown"].forEach((ev) => {
      document.addEventListener(ev, resume, { passive: true });
    });
  }

  async function playStoryMusic(data) {
    bindMusicUnlock();
    // Gesture may have been unlocked on index before navigation
    try {
      if (sessionStorage.getItem("VIEWORA_AUDIO_UNLOCK") === "1") {
        window.__vieworaMusicGestureUnlocked = true;
      }
    } catch (_) {}

    const info = musicInfo(data);
    if (!info) {
      stopMusic();
      return;
    }

    let url = info.audioUrl || "";
    if (!url) {
      url = (await resolveMusicUrl(info)) || "";
    }
    if (!url) {
      console.warn("Story music has no audioUrl", info);
      stopMusic();
      return;
    }

    // Prevent garble: same track already playing → just unmute/resume
    try {
      var cur = document.getElementById("storyAudio") || state.musicAudio;
      if (cur && window.__vieworaMusicPlayingUrl === url && !cur.paused) {
        cur.muted = false;
        cur.volume = 1;
        return;
      }
    } catch (_) {}

    stopMusic();

    // Seek offset (seconds) — set when uploading story
    let startAt = 0;
    try {
      const m = data && data.music;
      if (m && typeof m === "object") {
        startAt = Number(m.startAt || m.offset || m.startTime || 0) || 0;
      }
      if (!startAt) {
        startAt = Number(data.musicStartAt || data.audioStartAt || 0) || 0;
      }
    } catch (_) {}
    if (startAt < 0) startAt = 0;

    try {
      const el = ensureAudioEl();
      el.loop = true;
      el.volume = 1;
      // Try muted autoplay first (allowed), then unmute — reduces "need 2nd tap"
      el.muted = true;
      el.src = url;
      el.classList.add("vieworaStoryAudio");
      state.musicAudio = el;
      window.__vieworaMusicPlayingUrl = url;

      let seekDone = false;
      const seekAndPlay = () => {
        try {
          if (!seekDone && startAt > 0 && isFinite(el.duration) && el.duration > 0.5) {
            const maxStart = Math.max(0, el.duration - 1.5);
            el.currentTime = Math.min(startAt, maxStart);
            seekDone = true;
          }
        } catch (_) {}
        el.volume = 1;
        const tryPlay = () => {
          const p = el.play();
          if (p && p.then) {
            p.then(function () {
              try {
                el.muted = false;
                el.volume = 1;
              } catch (_) {}
            }).catch(function (err) {
              console.warn("Autoplay blocked, waiting for tap:", err && err.message);
              // Will resume on first user gesture via unlock listener
            });
          } else {
            try { el.muted = false; } catch (_) {}
          }
        };
        tryPlay();
        // If gesture already unlocked on this page, force unmute path
        if (window.__vieworaMusicGestureUnlocked) {
          el.muted = false;
          tryPlay();
        }
      };

      el.onloadedmetadata = () => {
        try {
          el.muted = false;
          el.volume = 1;
          if (startAt > 0 && isFinite(el.duration) && el.duration > 0.5) {
            const maxStart = Math.max(0, el.duration - 1.5);
            el.currentTime = Math.min(startAt, maxStart);
            seekDone = true;
          }
        } catch (_) {}
        seekAndPlay();
      };
      el.oncanplay = seekAndPlay;
      // If startAt was invalid / near end, restart from 0
      el.onended = () => {
        try {
          el.currentTime = (startAt > 0 && isFinite(el.duration) && startAt < el.duration - 1)
            ? startAt
            : 0;
          el.play().catch(() => {});
        } catch (_) {}
      };
      seekAndPlay();
      setTimeout(seekAndPlay, 120);
      setTimeout(seekAndPlay, 400);
      setTimeout(seekAndPlay, 900);
      // Keep retrying unmute until playing (max ~2s)
      let tries = 0;
      const kick = setInterval(function () {
        tries++;
        try {
          if (!el || !el.src) { clearInterval(kick); return; }
          if (!el.paused && !el.muted) { clearInterval(kick); return; }
          el.muted = false;
          el.volume = 1;
          el.play().then(function () {
            el.muted = false;
            clearInterval(kick);
          }).catch(function () {});
        } catch (_) {}
        if (tries > 12) clearInterval(kick);
      }, 160);
      window.__vieworaPendingMusic = el;
    } catch (e) {
      console.warn("Music play failed", e);
    }
  }

  async function fetchUser(uid) {
    if (!uid) return null;
    if (state.userCache[uid]) return state.userCache[uid];
    try {
      const snap = await firebase.database().ref("users/" + uid).once("value");
      const d = snap.exists() ? snap.val() : null;
      state.userCache[uid] = d;
      return d;
    } catch (_) {
      return null;
    }
  }

  function formatTime(ts) {
    const t = Number(ts || 0);
    if (!t) return "";
    const diff = Date.now() - t;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h";
    return Math.floor(diff / 86400000) + "d";
  }

  function stop() {
    try { clearOverlays(); } catch (_) {}
    clearTimeout(state.timer);
    state.timer = null;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    stopMusic();
    const v = $("storyVid");
    if (v) {
      try { v.pause(); v.removeAttribute("src"); v.load(); } catch (_) {}
    }
  }

  function buildProgress(n, active) {
    const row = $("progressRow");
    if (!row) return;
    row.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const seg = document.createElement("div");
      seg.className = "progressSeg" + (i < active ? " done" : "") + (i === active ? " active" : "");
      seg.appendChild(document.createElement("span"));
      row.appendChild(seg);
    }
  }

  function setFill(r) {
    const span = $("progressRow")?.querySelector(".progressSeg.active span");
    if (span) span.style.width = Math.max(0, Math.min(100, r * 100)) + "%";
  }

  function tick() {
    if (state.raf) cancelAnimationFrame(state.raf);
    const step = () => {
      if (state.paused) {
        state.raf = requestAnimationFrame(step);
        return;
      }
      const ratio = (Date.now() - state.startedAt) / (state.duration || IMAGE_MS);
      setFill(ratio);
      if (ratio >= 1) {
        clearTimeout(state.timer);
        state.timer = null;
        if (state.raf) cancelAnimationFrame(state.raf);
        state.raf = null;
        if (state._advancing) return;
        state._advancing = true;
        state.itemIndex += 1;
        showItem();
        return;
      }
      state.raf = requestAnimationFrame(step);
    };
    state.raf = requestAnimationFrame(step);
  }

  function currentGroup() {
    return state.groups[state.groupIndex] || null;
  }
  function currentItem() {
    const g = currentGroup();
    return g?.items?.[state.itemIndex] || null;
  }
  function isOwner() {
    const g = currentGroup();
    return state.user && g && g.uid === state.user.uid;
  }

  async function updateChrome() {
    const g = currentGroup();
    const item = currentItem();
    if (!g || !item) return;

    const av = $("storiesAvatar");
    if (av) {
      av.src = g.avatar || "assets/default-avatar.png";
      av.onerror = function () {
        this.onerror = null;
        this.src = "assets/default-avatar.png";
      };
    }

    // LIVE badge under username when this user is live
    try {
      let liveTag = $("storiesLiveTag");
      if (!liveTag) {
        const host = $("storiesUser") || $("storiesName")?.parentElement;
        if (host) {
          liveTag = document.createElement("span");
          liveTag.id = "storiesLiveTag";
          liveTag.className = "storiesLiveTag";
          host.appendChild(liveTag);
        }
      }
      if (liveTag) {
        if (g.isLive) {
          liveTag.textContent = "LIVE";
          liveTag.classList.remove("hidden");
          liveTag.style.display = "";
        } else {
          liveTag.textContent = "";
          liveTag.classList.add("hidden");
          liveTag.style.display = "none";
        }
      }
    } catch (_) {}

    // Name + tick — show immediately from story data / URL, enrich in background
    const nameEl = $("storiesName");
    const urlName = (new URLSearchParams(location.search).get("name") || "").trim();
    let baseName =
      g.username ||
      urlName ||
      nameOf(item.data) ||
      (item.data && (item.data.username || item.data.userName || item.data.displayName || item.data.creatorName || item.data.name)) ||
      "";
    if (!baseName || /^(user|viewora user|viewora|creator)$/i.test(String(baseName).trim())) {
      baseName = g.username || urlName || "…";
    }
    // Avatar immediately
    try {
      const av =
        g.avatar ||
        avatarOf(item.data) ||
        (item.data && (item.data.profilePhoto || item.data.photoURL || item.data.avatar)) ||
        new URLSearchParams(location.search).get("photo") ||
        "";
      if (av && $("storiesAvatar")) {
        $("storiesAvatar").src = av;
        $("storiesAvatar").onerror = function () {
          this.src = "assets/default-avatar.png";
        };
      }
    } catch (_) {}
    let userNode = null;
    let verified = isVerifiedUser(item.data);

    // Paint name NOW so UI is not stuck on "User"
    if (nameEl) {
      nameEl.textContent = baseName;
    }
    try {
      const av0 =
        g.avatar ||
        (item.data && (item.data.avatar || item.data.photoURL || item.data.profilePhoto || item.data.userPhoto)) ||
        "";
      if (av0 && $("storiesAvatar")) $("storiesAvatar").src = av0;
    } catch (_) {}

    function applyStoriesNameTick(displayName, source) {
      if (!nameEl) return;
      nameEl.innerHTML = "";
      nameEl.appendChild(document.createTextNode(displayName || "…"));
      let tickHtml = "";
      const badgeSource = source || {};
      try {
        if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
          const b = VieworaBadges.resolve(badgeSource);
          if (b && b.html) tickHtml = b.html;
        } else if (window.VieworaBadges && typeof VieworaBadges.badgeHTML === "function") {
          tickHtml = VieworaBadges.badgeHTML(badgeSource) || "";
        }
      } catch (_) {}
      // Same tick as Activity / profile — no custom fa-circle icons
      if (tickHtml) {
        const wrap = document.createElement("span");
        wrap.className = "storiesTickWrap";
        wrap.innerHTML = tickHtml;
        while (wrap.firstChild) nameEl.appendChild(wrap.firstChild);
      }
    }

    // Paint immediately from story data
    applyStoriesNameTick(baseName, item.data || {});

    // Background enrich — re-apply tick with full user profile
    (async () => {
      try {
        userNode = await fetchUser(g.uid);
        if (!userNode) return;
        const realName =
          userNode.username ||
          userNode.userName ||
          userNode.displayName ||
          userNode.name ||
          userNode.fullName ||
          "";
        if (realName) {
          baseName = realName;
          g.username = realName;
        }
        if (isVerifiedUser(userNode)) verified = true;
        const photo =
          userNode.profilePhoto ||
          userNode.photoURL ||
          userNode.avatar ||
          userNode.profilePicture ||
          "";
        if (photo && $("storiesAvatar")) {
          $("storiesAvatar").src = photo;
          g.avatar = photo;
        }
        applyStoriesNameTick(baseName, userNode);
      } catch (_) {}
    })();


    // Time + music under name
    const timeEl = $("storiesTime");
    const info = musicInfo(item.data);
    if (timeEl) {
      const time = formatTime(item.data.createdAt || item.data.timestamp);
      if (info && (info.title || info.artist)) {
        const songLine =
          (info.title || "Music") +
          (info.artist ? " · " + info.artist : "");
        timeEl.innerHTML =
          '<span class="storiesTimeText">' + escapeHTML(time) + '</span>' +
          '<span class="storiesMusicLine"><i class="fa-solid fa-music"></i> ' +
          escapeHTML(songLine) + '</span>';
      } else {
        timeEl.textContent = time;
      }
    }

    // Floating music badge
    const badge = $("storyMusicBadge");
    const badgeText = $("storyMusicBadgeText");
    if (badge) {
      if (info && info.audioUrl) {
        badge.classList.remove("hidden");
        if (badgeText) {
          badgeText.textContent =
            (info.title || "Music") +
            (info.artist ? " · " + info.artist : "");
        }
      } else {
        badge.classList.add("hidden");
      }
    }

    const own = isOwner();
    $("viewerFooter")?.classList.toggle("hidden", own);
    $("ownerFooter")?.classList.toggle("hidden", !own);
    $("ownerMenu")?.classList.toggle("hidden", !own);
    $("viewerMenu")?.classList.toggle("hidden", own);

    if (own) {
      const viewers = item.data.viewers || {};
      const count = Object.keys(viewers).length;
      if ($("viewersCount")) $("viewersCount").textContent = count + (count === 1 ? " view" : " views");
    }
  }

  async function markView(storyId, owner) {
    try {
      const u = state.user;
      if (!u || !storyId || owner === u.uid) return;
      await firebase.database().ref(`stories/${storyId}/viewers/${u.uid}`).set({
        uid: u.uid,
        viewedAt: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (_) {}
  }


  function renderReactions(data) {
    let bar = document.getElementById("storyReactionsBar");
    if (!bar) {
      const stage = $("stage");
      if (!stage) return;
      bar = document.createElement("div");
      bar.id = "storyReactionsBar";
      bar.className = "storyReactionsBar";
      stage.appendChild(bar);
    }
    const reactions = (data && data.reactions) || {};
    const entries = Object.entries(reactions).filter(([, v]) => v && (v.reaction || v.emoji));
    if (!entries.length) {
      bar.innerHTML = "";
      bar.classList.add("hidden");
      return;
    }
    bar.classList.remove("hidden");
    // Show up to 12: Name + emoji
    const chips = entries.slice(0, 12).map(([uid, v]) => {
      const emoji = escapeHTML(v.reaction || v.emoji || "❤️");
      const name = escapeHTML(
        v.username || v.userName || v.displayName || v.name || ("User")
      );
      return `<span class="storyReactionChip" data-uid="${escapeHTML(uid)}"><b>${name}</b>${emoji}</span>`;
    });
    const more = entries.length > 12 ? `<span class="storyReactionMore">+${entries.length - 12}</span>` : "";
    bar.innerHTML = chips.join("") + more;

    // Enrich names from users/
    entries.slice(0, 12).forEach(async ([uid, v]) => {
      if (v.username || v.userName || v.displayName || v.name) return;
      try {
        const u = await fetchUser(uid);
        if (!u) return;
        const n = u.username || u.displayName || u.name || "User";
        const chip = bar.querySelector(`[data-uid="${CSS.escape(uid)}"] b`);
        if (chip) chip.textContent = n;
      } catch (_) {}
    });
  }

  function preloadNextStoryMedia() {
    try {
      const g = currentGroup();
      if (!g) return;
      const next = g.items[state.itemIndex + 1];
      if (!next) return;
      const url = mediaURL(next.data || {});
      if (!url) return;
      const type = String((next.data || {}).mediaType || (next.data || {}).type || "").toLowerCase();
      const isVid = type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url);
      if (isVid) {
        const v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.src = url;
      } else {
        const i = new Image();
        i.src = url;
      }
    } catch (_) {}
  }


  async function renderMentionAddBar(item, data, g) {
    var bar = $("storyMentionBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "storyMentionBar";
      bar.className = "storyMentionBar hidden";
      bar.innerHTML =
        '<button type="button" id="storyAddToStoryBtn" class="storyAddToStoryBtn">Add to story</button>';
      var footer = $("viewerFooter") || document.querySelector(".storiesFooter");
      if (footer) {
        footer.insertBefore(bar, footer.firstChild);
      } else {
        document.body.appendChild(bar);
      }
      bar.querySelector("#storyAddToStoryBtn")?.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        try {
          var it = currentItem();
          var d = (it && it.data) || {};
          var url = mediaURL(d);
          sessionStorage.setItem("viewora_add_story_mention", JSON.stringify({
            storyId: it && it.id,
            ownerUid: ownerId(d) || (currentGroup() && currentGroup().uid),
            mediaUrl: url,
            isVideo: !!(d.videoUrl || d.mediaType === "video"),
            ownerName: nameOf(d),
            at: Date.now()
          }));
          if (url) sessionStorage.setItem("shareRemoteMedia", url);
        } catch (_) {}
        location.href = "story-upload.html?from=mention";
      });
    }
    bar.classList.add("hidden");
    if (!state.user || !item || !item.id) return;
    var me = state.user.uid;
    var mentioned = false;
    try {
      if (data.mentions && data.mentions[me]) mentioned = true;
    } catch (_) {}
    if (!mentioned) {
      try {
        var snap = await firebase.database().ref("stories/" + item.id + "/mentions/" + me).once("value");
        if (snap.exists()) mentioned = true;
      } catch (_) {}
    }
    // also if opened via notification deep link
    try {
      var p = new URLSearchParams(location.search);
      if (p.get("mentioned") === "1" && p.get("id") === item.id) mentioned = true;
    } catch (_) {}
    if (mentioned) bar.classList.remove("hidden");
  }


  function ensureOverlayLayer() {
    var stage = $("stage") || $("storyStage");
    if (!stage) return null;
    var layer = $("storyOverlayLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "storyOverlayLayer";
      layer.className = "storyOverlayLayer";
      layer.style.cssText = "position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden;background:transparent;";
      stage.appendChild(layer);
    }
    return layer;
  }

  function clearOverlays() {
    var layer = $("storyOverlayLayer");
    if (layer) layer.innerHTML = "";
  }

  function renderStoryOverlays(data) {
    clearOverlays();
    if (!data) return;
    var layer = ensureOverlayLayer();
    if (!layer) return;

    // Draw strokes (PNG data URL)
    try {
      var drawUrl = data.drawDataUrl || data.drawUrl || data.drawing || "";
      if (drawUrl && String(drawUrl).indexOf("data:image") === 0) {
        var dimg = document.createElement("img");
        dimg.className = "storyDrawOverlay";
        dimg.src = drawUrl;
        dimg.alt = "";
        dimg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;z-index:4;";
        layer.appendChild(dimg);
      }
    } catch (_) {}

    // Text overlays
    var texts = data.texts || data.textOverlays || [];
    if (!Array.isArray(texts)) texts = [];
    texts.forEach(function (t) {
      if (!t) return;
      var text = (t.text || t.value || t.content || "").trim();
      if (!text) return;
      var el = document.createElement("div");
      el.className = "storyTextOverlay style-" + (t.style || "classic");
      el.textContent = text;
      var left = t.left || "50%";
      var top = t.top || "40%";
      var fs = t.fontSize || "28px";
      var scale = Number(t.scale || 1) || 1;
      var color = t.color || "#ffffff";
      el.style.cssText =
        "position:absolute;left:" + left + ";top:" + top + ";" +
        "transform:" + (t.transform || "translate(-50%,-50%)") + ";" +
        "font-size:" + fs + ";color:" + color + ";" +
        "font-weight:" + (t.fontWeight || "800") + ";" +
        "text-align:" + (t.textAlign || "center") + ";" +
        "white-space:pre-wrap;word-break:break-word;max-width:86%;" +
        "text-shadow:0 2px 8px rgba(0,0,0,.55);pointer-events:none;z-index:7;line-height:1.25;";
      if (scale !== 1 && !t.transform) {
        el.style.transform = "translate(-50%,-50%) scale(" + scale + ")";
      }
      // @mention / username — Instagram style: tap opens profile
      var uname = "";
      if (text.charAt(0) === "@") {
        uname = text.replace(/^@/, "").split(/\s/)[0].replace(/[^a-zA-Z0-9._]/g, "");
        el.style.background = "rgba(0,0,0,.45)";
        el.style.border = "2px solid #25d366";
        el.style.borderRadius = "12px";
        el.style.padding = "6px 14px";
        el.style.color = "#fff";
        el.style.pointerEvents = "auto";
        el.style.cursor = "pointer";
        el.setAttribute("data-mention-user", uname);
        el.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          try { state.paused = true; } catch (_) {}
          try { if (typeof pauseStory === "function") pauseStory(); } catch (_) {}
          if (uname) {
            location.href = "profile.html?username=" + encodeURIComponent(uname);
          }
        });
      } else {
        // also detect inline @user in longer text
        var m = text.match(/@([a-zA-Z0-9._]{2,30})/);
        if (m) {
          uname = m[1];
          el.style.pointerEvents = "auto";
          el.style.cursor = "pointer";
          el.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            try { state.paused = true; } catch (_) {}
            location.href = "profile.html?username=" + encodeURIComponent(uname);
          });
        }
      }
      layer.appendChild(el);
    });

    // Stickers
    var stickers = data.stickers || data.stickerOverlays || [];
    if (!Array.isArray(stickers)) stickers = [];
    stickers.forEach(function (s) {
      if (!s) return;
      var el = document.createElement("div");
      el.className = "storyStickerOverlay";
      el.style.cssText =
        "position:absolute;left:" + (s.left || "50%") + ";top:" + (s.top || "50%") + ";" +
        "transform:" + (s.transform || "translate(-50%,-50%)") + ";" +
        "pointer-events:none;z-index:7;";
      if (s.url) {
        var img = document.createElement("img");
        img.src = s.url;
        img.alt = s.name || "";
        img.style.cssText = "width:" + (s.width || "88px") + ";height:auto;display:block;";
        el.appendChild(img);
      } else {
        el.textContent = s.emoji || "";
        el.style.fontSize = s.fontSize || "48px";
      }
      var sc = Number(s.scale || 1) || 1;
      if (sc !== 1 && !s.transform) {
        el.style.transform = "translate(-50%,-50%) scale(" + sc + ")";
      }
      layer.appendChild(el);
    });

    // Shared / mentioned content chip — View story / View post (Instagram style)
    try {
      var shared = data.sharedFrom || data.originalOwner || data.mentionedContent || null;
      var viewStoryId = data.mentionedStoryId || (shared && (shared.storyId || shared.id)) || "";
      var viewPostId = data.mentionedPostId || (shared && shared.postId) || "";
      var viewUid = (shared && (shared.uid || shared.ownerUid || shared.userId)) || data.originalUid || "";
      var viewUname = (shared && (shared.username || shared.userName)) || data.originalUsername || "";
      if (viewStoryId || viewPostId || (data.sharedFrom && (data.mediaURL || data.mediaUrl))) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "storyViewMentionChip";
        chip.textContent = viewStoryId || (data.sharedFrom && String(data.sharedFrom.type || "").indexOf("story") >= 0)
          ? "View story"
          : (viewPostId ? "View post" : "View profile");
        chip.style.cssText = "position:absolute;left:50%;bottom:18%;transform:translateX(-50%);z-index:12;pointer-events:auto;border:0;background:rgba(0,0,0,.55);color:#fff;font-weight:700;font-size:13px;padding:10px 18px;border-radius:999px;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);";
        chip.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          try { state.paused = true; } catch (_) {}
          if (viewStoryId) {
            location.href = "stories.html?id=" + encodeURIComponent(viewStoryId) +
              (viewUid ? "&uid=" + encodeURIComponent(viewUid) : "");
          } else if (viewPostId) {
            location.href = "post.html?id=" + encodeURIComponent(viewPostId);
          } else if (viewUid) {
            location.href = "profile.html?uid=" + encodeURIComponent(viewUid);
          } else if (viewUname) {
            location.href = "profile.html?username=" + encodeURIComponent(viewUname);
          }
        });
        layer.appendChild(chip);
      }
    } catch (_) {}

  }

  function showItem() {
    state._advancing = false;
    const g = currentGroup();
    if (!g || !g.items.length) {
      const uid = new URLSearchParams(location.search).get("uid") || "";
      const stage = document.getElementById("stage");
      if (stage && !stage.dataset.emptyShown) {
        stage.dataset.emptyShown = "1";
        var empty = document.getElementById("storyEmptyOverlay");
        if (!empty) {
          empty = document.createElement("div");
          empty.id = "storyEmptyOverlay";
          empty.style.cssText = "position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;text-align:center;padding:40px 20px;font-family:system-ui";
          empty.innerHTML = '<div><p style="opacity:.7;margin:0 0 16px">No active story</p><button type="button" id="storyEmptyBack" style="padding:12px 20px;border:0;border-radius:12px;background:#6d28d9;color:#fff;font-weight:700">Back</button></div>';
          stage.appendChild(empty);
        } else {
          empty.style.display = "flex";
        }
        const b = document.getElementById("storyEmptyBack");
        if (b) b.onclick = function () {
          window.location.href = uid
            ? "profile.html?uid=" + encodeURIComponent(uid)
            : "index.html";
        };
        // auto-back after 2.5s
        setTimeout(function () {
          if (document.getElementById("storyEmptyBack")) {
            window.location.href = uid
              ? "profile.html?uid=" + encodeURIComponent(uid)
              : "index.html";
          }
        }, 2500);
        return;
      }
      window.location.href = uid
        ? "profile.html?uid=" + encodeURIComponent(uid)
        : "index.html";
      return;
    }
    if (state.itemIndex >= g.items.length) {
      if (state.soloMode) {
        // Finished solo: home → index, profile → profile
        const params = new URLSearchParams(location.search);
        const from = (params.get("from") || "").toLowerCase();
        const uid = g.uid || params.get("uid") || "";
        if (from === "home" || from === "index") {
          window.location.href = "index.html";
        } else if (uid) {
          window.location.href = "profile.html?uid=" + encodeURIComponent(uid);
        } else {
          window.location.href = "index.html";
        }
        return;
      }
      state.groupIndex += 1;
      state.itemIndex = 0;
      if (state.groupIndex >= state.groups.length) {
        window.location.href = "index.html";
        return;
      }
      showItem();
      return;
    }
    if (state.itemIndex < 0) {
      if (state.soloMode) {
        state.itemIndex = 0;
        return;
      }
      state.groupIndex -= 1;
      if (state.groupIndex < 0) {
        state.groupIndex = 0;
        state.itemIndex = 0;
      } else {
        state.itemIndex = state.groups[state.groupIndex].items.length - 1;
      }
      showItem();
      return;
    }

    stop();
    const item = g.items[state.itemIndex];
    let data = item.data || {};

    // Async hydrate then re-enter (one retry)
    if (!item._hydrated && item.id && (!mediaURL(data) || !(data.texts || data.stickers || data.drawDataUrl))) {
      item._hydrated = true;
      try {
        firebase.database().ref("stories/" + item.id).once("value").then(function (snap) {
          if (snap.exists()) {
            item.data = Object.assign({}, data, snap.val() || {}, { id: item.id });
          }
          showItem();
        }).catch(function () { showItem(); });
        return;
      } catch (_) {}
    }
    data = item.data || {};
    let url = mediaURL(data);
    if (!url) {
      // last try: any http field
      try {
        Object.keys(data).forEach(function (k) {
          if (url) return;
          var v = data[k];
          if (typeof v === "string" && /^https?:\/\//i.test(v) && !/\.(mp3|m4a|aac|wav)(\?|$)/i.test(v)) url = v;
        });
      } catch (_) {}
    }
    if (!url) {
      state.itemIndex += 1;
      showItem();
      return;
    }

    updateChrome();
    renderReactions(data);
    try { renderStoryOverlays(data); } catch (_) {}

    // If I was mentioned in this story → show Add to story (above reply)
    try {
      renderMentionAddBar(item, data, g);
    } catch (_) {}
    // Live-refresh reactions from Firebase
    (async () => {
      try {
        const snap = await firebase.database().ref("stories/" + item.id + "/reactions").once("value");
        if (snap.exists()) {
          data.reactions = snap.val() || {};
          item.data.reactions = data.reactions;
          renderReactions(data);
        }
      } catch (_) {}
    })();
    buildProgress(g.items.length, state.itemIndex);
    setFill(0);
    markView(item.id, g.uid);

    // Play attached music
    playStoryMusic(data);
    preloadNextStoryMedia();

    const type = String(data.mediaType || data.type || data.contentType || "").toLowerCase();
    var isVideo = false;
    if (type === "video" || type === "reel" || type === "short") isVideo = true;
    else if (type === "image" || type === "photo" || type === "picture" || type === "img") isVideo = false;
    else {
      isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url);
      if (/\/image\/upload\//i.test(url)) isVideo = false;
    }

    var stage = $("stage") || document.querySelector(".stage");
    // Permanent poster layer (never black empty)
    var posterEl = $("storyPoster");
    if (stage && !posterEl) {
      posterEl = document.createElement("div");
      posterEl.id = "storyPoster";
      posterEl.setAttribute("aria-hidden", "true");
      posterEl.style.cssText = "position:absolute;inset:0;z-index:1;background:#0a0a0a center/contain no-repeat;pointer-events:none;";
      stage.insertBefore(posterEl, stage.firstChild);
    }
    var img = $("storyImg");
    var vid = $("storyVid");
    if (stage) {
      if (!img) {
        img = document.createElement("img");
        img.id = "storyImg";
        img.className = "storyMedia";
        img.alt = "";
        stage.appendChild(img);
      }
      if (!vid) {
        vid = document.createElement("video");
        vid.id = "storyVid";
        vid.className = "storyMedia";
        stage.appendChild(vid);
      }
      // Remove empty overlay if present
      var empty = $("storyEmptyOverlay");
      if (empty) empty.style.display = "none";
    }

    function styleVisible(el, on) {
      if (!el) return;
      if (on) {
        el.classList.remove("hidden");
        el.style.position = "absolute";
        el.style.inset = "0";
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.objectFit = "contain";
        el.style.opacity = "1";
        el.style.visibility = "visible";
        el.style.display = "block";
        el.style.zIndex = "3";
        el.style.background = "transparent";
      } else {
        el.classList.add("hidden");
        el.style.display = "none";
      }
    }

    try {
      if (img) { img.onload = null; img.onerror = null; styleVisible(img, false); img.removeAttribute("src"); }
      if (vid) {
        try { vid.pause(); } catch (_) {}
        vid.onloadedmetadata = null; vid.onerror = null; vid.onended = null;
        styleVisible(vid, false);
        try { vid.removeAttribute("src"); vid.load(); } catch (_) {}
      }
    } catch (_) {}

    var goNext = function () {
      clearTimeout(state.timer);
      state.timer = null;
      state.itemIndex += 1;
      showItem();
    };
    var hasMusic = !!(musicInfo(data) && musicInfo(data).audioUrl);
    var imageDuration = hasMusic ? IMAGE_MUSIC_MS : IMAGE_MS;

    function setPoster(src) {
      if (!posterEl || !src) return;
      try {
        posterEl.style.backgroundImage = 'url("' + String(src).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '")';
        posterEl.style.opacity = "1";
      } catch (_) {}
    }

    function thumbOf(d, mediaUrl) {
      try {
        var t = (d && (d.thumbnail || d.thumb || d.poster || d.coverUrl)) || "";
        if (t && /^https?:\/\//i.test(t)) return t;
        if (mediaUrl && /\/video\/upload\//i.test(mediaUrl)) {
          return optimizeMediaUrl(mediaUrl, false);
        }
      } catch (_) {}
      return "";
    }

    function beginTimer(ms) {
      state.duration = ms || imageDuration;
      state.startedAt = Date.now();
      tick();
      clearTimeout(state.timer);
      state.timer = setTimeout(goNext, state.duration + 60);
    }

    function showAsImage(rawUrl, ms) {
      var src = optimizeMediaUrl(rawUrl, false) || rawUrl;
      if (!src) { goNext(); return; }
      setPoster(src);
      styleVisible(vid, false);
      styleVisible(img, true);
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        beginTimer(ms || imageDuration);
      }
      if (!img) { finish(); return; }
      img.onload = finish;
      img.onerror = function () {
        // keep poster background — still not pure black
        finish();
      };
      try {
        img.src = src;
        if (img.complete && img.naturalWidth > 0) finish();
      } catch (_) { finish(); }
      setTimeout(finish, 2800);
    }

    function showAsVideo(rawUrl) {
      var src = optimizeMediaUrl(rawUrl, true) || rawUrl;
      var poster = thumbOf(data, rawUrl) || optimizeMediaUrl(rawUrl, false);
      if (poster) setPoster(poster);

      // Fresh video element (fixes black frame reuse bugs on Android)
      try {
        if (vid && vid.parentNode) {
          var nv = document.createElement("video");
          nv.id = "storyVid";
          nv.className = "storyMedia";
          nv.setAttribute("playsinline", "true");
          nv.setAttribute("webkit-playsinline", "true");
          nv.setAttribute("x5-playsinline", "true");
          nv.setAttribute("preload", "auto");
          nv.playsInline = true;
          nv.controls = false;
          vid.parentNode.replaceChild(nv, vid);
          vid = nv;
        }
      } catch (_) {}

      styleVisible(img, false);
      styleVisible(vid, true);
      if (poster) try { vid.poster = poster; } catch (_) {}
      vid.muted = !!hasMusic;
      vid.defaultMuted = !!hasMusic;

      var started = false;
      function startProg(ms) {
        if (started) return;
        started = true;
        beginTimer(ms);
      }

      vid.onended = goNext;
      vid.onloadedmetadata = function () {
        var d = vid.duration && isFinite(vid.duration) ? vid.duration * 1000 : 15000;
        var ms = Math.min(Math.max(d, hasMusic ? IMAGE_MUSIC_MS : 800), 30000);
        if (!hasMusic) ms = Math.min(d, 30000);
        startProg(ms);
      };
      vid.onerror = function () {
        styleVisible(vid, false);
        showAsImage(poster || src, imageDuration);
      };

      setTimeout(function () {
        try {
          if (vid && (vid.videoWidth || 0) < 2) {
            // still black — show poster image on top as <img>
            if (poster) {
              styleVisible(vid, false);
              showAsImage(poster, state.duration || imageDuration);
            }
          }
        } catch (_) {}
      }, 1500);

      try { vid.src = src; vid.load(); } catch (_) {}
      var p;
      try { p = vid.play(); } catch (_) { p = null; }
      if (p && p.then) {
        p.then(function () {
          if (!hasMusic) { try { vid.muted = false; } catch (_) {} }
        }).catch(function () {
          try {
            vid.muted = true;
            return vid.play();
          } catch (e2) {
            return Promise.reject(e2);
          }
        }).then(function () {}).catch(function () {
          styleVisible(vid, false);
          showAsImage(poster || src, imageDuration);
        });
      } else {
        startProg(imageDuration);
      }
    }

    if (isVideo) showAsVideo(url);
    else showAsImage(url, imageDuration);
  }

  async function loadAll() {
    const db = firebase.database();
    const now = Date.now();
    const params = new URLSearchParams(location.search);
    const focusUid = params.get("uid") || "";
    const focusId = params.get("id") || params.get("storyId") || params.get("story") || "";
    // Profile / highlight deep-link: ONLY that user's stories (no swipe to others)
    // Solo = only this user's stories (profile ring). Home = all following chain.
    const soloMode =
      params.get("solo") === "1" ||
      params.get("solo") === "true" ||
      params.get("from") === "profile";
    const includeExpired =
      params.get("highlight") === "1" ||
      params.get("expired") === "1";

    let following = new Set();
    // Solo / focused uid: skip following fetch (faster open)
    if (state.user && !soloMode && !focusUid) {
      try {
        let snap = await db.ref(`following/${state.user.uid}`).once("value");
        if (!snap.exists()) {
          snap = await db.ref(`users/${state.user.uid}/following`).once("value");
        }
        following = new Set(Object.keys(snap.val() || {}));
      } catch (_) {}
    } else if (state.user && !soloMode && focusUid) {
      // Still need following for multi-user chain after current
      try {
        let snap = await db.ref(`following/${state.user.uid}`).once("value");
        if (!snap.exists()) {
          snap = await db.ref(`users/${state.user.uid}/following`).once("value");
        }
        following = new Set(Object.keys(snap.val() || {}));
      } catch (_) {}
    }

    // Prefer querying only focus user stories when opening one ring
    let snap;
    if (focusUid && (soloMode || true)) {
      // Full scan still needed for home chain; but prioritize speed with once
      try {
        snap = await db.ref("stories").once("value");
      } catch (e) {
        console.warn("[VIEWORA STORIES] load", e);
        snap = { forEach: function () {}, exists: function () { return false; }, val: function () { return null; } };
      }
    } else {
      try {
        snap = await db.ref("stories").once("value");
      } catch (e) {
        console.warn("[VIEWORA STORIES] load", e);
        snap = { forEach: function () {}, exists: function () { return false; }, val: function () { return null; } };
      }
    }
    const byUser = {};

    snap.forEach((child) => {
      const data = child.val() || {};
      const uid = ownerId(data);
      if (!uid) return;

      // Solo from profile: only this uid
      if (soloMode && focusUid && uid !== focusUid) return;

      const expired = isExpired(data, now);
      if (expired && !includeExpired) {
        // In solo mode without highlight flag, skip expired
        if (!(soloMode && focusId && focusId === child.key)) return;
      }
      // When opening a specific highlight story id, allow even if expired
      if (expired && focusId && focusId === child.key) {
        /* allow */
      } else if (expired && !includeExpired) {
        return;
      }

      if (!soloMode) {
        const isOwn = state.user && uid === state.user.uid;
        const isFollowing = following.has(uid);
        const isFocus = focusUid === uid || focusId === child.key;
        if (!isOwn && !isFollowing && !isFocus) return;
      }

      if (!byUser[uid]) {
        byUser[uid] = {
          uid,
          username: nameOf(data),
          avatar: avatarOf(data),
          latest: Number(data.createdAt || data.timestamp || 0),
          items: []
        };
      }
      byUser[uid].items.push({ id: child.key, data });
      const c = Number(data.createdAt || data.timestamp || 0);
      if (c > byUser[uid].latest) {
        byUser[uid].latest = c;
        byUser[uid].username = nameOf(data);
        byUser[uid].avatar = avatarOf(data) || byUser[uid].avatar;
      }
    });

    Object.values(byUser).forEach((g) => {
      g.items.sort(
        (a, b) =>
          Number(a.data.createdAt || a.data.timestamp || 0) -
          Number(b.data.createdAt || b.data.timestamp || 0)
      );
    });

    // Enrich group names/avatars/ticks from users/
    // FAST PATH: do NOT block on user profile / live fetches
    // Apply URL name/photo for focus user immediately
    try {
      const urlName = (params.get("name") || "").trim();
      const urlPhoto = (params.get("photo") || "").trim();
      if (focusUid && byUser[focusUid]) {
        if (urlName) byUser[focusUid].username = urlName;
        if (urlPhoto) byUser[focusUid].avatar = urlPhoto;
      }
    } catch (_) {}

    state.groups = Object.values(byUser).sort((a, b) => {
      // Live first (followed live at front)
      if (!!a.isLive !== !!b.isLive) return a.isLive ? -1 : 1;
      // Own stories early if present
      if (state.user) {
        const aOwn = a.uid === state.user.uid;
        const bOwn = b.uid === state.user.uid;
        if (aOwn !== bOwn) return aOwn ? -1 : 1;
      }
      return b.latest - a.latest;
    });


    // Highlight album playlist: ONLY when explicitly opening a highlight
    let playlistIds = null;
    const isHighlightOpen =
      params.get("highlight") === "1" ||
      params.get("expired") === "1" ||
      !!params.get("album");
    try {
      if (isHighlightOpen) {
        const raw = sessionStorage.getItem("vieworaHighlightPlaylist");
        if (raw) {
          const pl = JSON.parse(raw);
          if (pl && Array.isArray(pl.storyIds) && pl.storyIds.length) {
            if (!pl.uid || !focusUid || String(pl.uid) === String(focusUid)) {
              playlistIds = new Set(pl.storyIds.map(String));
            }
          }
        }
      } else {
        // Normal story open from home/profile — clear stale playlist
        try { sessionStorage.removeItem("vieworaHighlightPlaylist"); } catch (_) {}
      }
    } catch (_) {}
    const albumParam = params.get("album") || "";
    if (!playlistIds && albumParam && focusUid) {
      try {
        const as = await db.ref("users/" + focusUid + "/highlights/" + albumParam).once("value");
        const av = as.val();
        if (av && Array.isArray(av.storyIds) && av.storyIds.length) {
          playlistIds = new Set(av.storyIds.map(String));
        } else if (av && (av.storyId || albumParam)) {
          playlistIds = new Set([String(av.storyId || albumParam)]);
        }
      } catch (_) {}
    }
    if (playlistIds && playlistIds.size) {
      Object.keys(byUser).forEach((uid) => {
        byUser[uid].items = byUser[uid].items.filter((it) =>
          playlistIds.has(String(it.id))
        );
        // preserve playlist order
        const order = Array.from(playlistIds);
        byUser[uid].items.sort((a, b) => {
          const ia = order.indexOf(String(a.id));
          const ib = order.indexOf(String(b.id));
          return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib);
        });
        if (!byUser[uid].items.length) delete byUser[uid];
      });
    } else if (includeExpired && focusId) {
      // Single highlight story deep-link: only that story, not all expired
      Object.keys(byUser).forEach((uid) => {
        byUser[uid].items = byUser[uid].items.filter(
          (it) => String(it.id) === String(focusId)
        );
        if (!byUser[uid].items.length) delete byUser[uid];
      });
    }

    // Rebuild groups after any byUser item filters
    state.groups = Object.values(byUser)
      .filter((g) => g && g.items && g.items.length)
      .sort((a, b) => {
        if (!!a.isLive !== !!b.isLive) return a.isLive ? -1 : 1;
        if (state.user) {
          const aOwn = a.uid === state.user.uid;
          const bOwn = b.uid === state.user.uid;
          if (aOwn !== bOwn) return aOwn ? -1 : 1;
        }
        return b.latest - a.latest;
      });

    // Hard lock: if solo + focusUid, never keep other users
    if (soloMode && focusUid) {
      state.groups = state.groups.filter((g) => g.uid === focusUid);
    }

    if (!state.groups.length) {
      // Phase-1: never history.back() into about:blank — show empty UI
      try {
        const empty = document.getElementById("storiesEmpty");
        if (empty) {
          empty.classList.remove("hidden");
          empty.style.display = "grid";
        }
        const app = document.getElementById("app");
        if (app) app.classList.add("is-empty");
      } catch (_) {}
      showToast("No stories");
      // Soft redirect only when we clearly came from profile with a uid
      setTimeout(() => {
        try {
          const from = (params.get("from") || "").toLowerCase();
          if (from === "profile" && focusUid) {
            location.href = "profile.html?uid=" + encodeURIComponent(focusUid);
          }
          // otherwise stay on empty state (user taps Back to Home)
        } catch (_) {}
      }, 800);
      return;
    }

    let gi = 0;
    let ii = 0;
    if (focusUid) {
      const idx = state.groups.findIndex((g) => g.uid === focusUid);
      if (idx >= 0) gi = idx;
    }
    if (focusId) {
      for (let i = 0; i < state.groups.length; i++) {
        const j = state.groups[i].items.findIndex((it) => it.id === focusId);
        if (j >= 0) { gi = i; ii = j; break; }
      }
    } else if (state.user && state.groups[gi]) {
      // Instagram-style: jump to first unseen; if all seen → start from 0 (rewatch)
      const me = state.user.uid;
      const items = state.groups[gi].items || [];
      let firstUnseen = -1;
      for (let k = 0; k < items.length; k++) {
        const viewers = (items[k].data && items[k].data.viewers) || {};
        if (!viewers[me]) {
          firstUnseen = k;
          break;
        }
      }
      ii = firstUnseen >= 0 ? firstUnseen : 0;
    }

    state.groupIndex = gi;
    state.itemIndex = ii;
    // Prevent advancing to other users in solo mode
    state.soloMode = soloMode && !!focusUid;
    showItem();

    // Background: enrich names / avatars / live (does not block first paint)
    (async function enrichInBackground() {
      try {
        await Promise.all(
          state.groups.map(async (g) => {
            try {
              const u = await fetchUser(g.uid);
              if (!u) return;
              const n =
                u.username ||
                u.userName ||
                u.displayName ||
                u.name ||
                u.fullName ||
                "";
              if (n) g.username = n;
              const photo =
                u.profilePhoto ||
                u.photoURL ||
                u.avatar ||
                "";
              if (photo) g.avatar = photo;
              g.userNode = u;
            } catch (_) {}
          })
        );
        // Refresh chrome for current group if still viewing
        try {
          const cur = currentGroup();
          if (cur) updateChrome();
        } catch (_) {}
      } catch (_) {}
      try {
        const liveSnap = await db.ref("live").once("value");
        if (liveSnap.exists()) {
          liveSnap.forEach((c) => {
            const v = c.val() || {};
            const lid = String(v.uid || c.key || "");
            const g = state.groups.find((x) => x.uid === lid);
            if (!g) return;
            if (v.active === true || v.isLive === true || v.status === "live") {
              g.isLive = true;
            }
          });
        }
      } catch (_) {}
    })();
  }

  async function sendReply() {
    const input = $("replyInput");
    const text = (input?.value || "").trim();
    if (!text) return;
    if (!state.user) {
      showToast("Login to reply");
      return;
    }
    const item = currentItem();
    const g = currentGroup();
    if (!item || !g) return;
    try {
      const ref = firebase.database().ref(`stories/${item.id}/replies`).push();
      await ref.set({
        uid: state.user.uid,
        text,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      if (typeof notifyStoryReply === "function") {
        notifyStoryReply(item.id, g.uid, state.user.uid, ref.key);
      }
      input.value = "";
      showToast("Reply sent");
    } catch (e) {
      console.error(e);
      showToast("Could not reply");
    }
  }

  async function sendReaction(emoji) {
    if (!state.user) {
      showToast("Login to react");
      return;
    }
    const item = currentItem();
    const g = currentGroup();
    if (!item || !g) return;
    try {
      let uname = state.user.displayName || "";
      try {
        const us = await fetchUser(state.user.uid);
        if (us) uname = us.username || us.displayName || us.name || uname;
      } catch (_) {}
      await firebase.database().ref(`stories/${item.id}/reactions/${state.user.uid}`).set({
        uid: state.user.uid,
        username: uname || "User",
        reaction: emoji,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      // Refresh bar on current item
      try {
        const snap = await firebase.database().ref(`stories/${item.id}/reactions`).once("value");
        if (item.data) item.data.reactions = snap.val() || {};
        renderReactions(item.data);
      } catch (_) {}
      if (typeof notifyStoryReaction === "function") {
        notifyStoryReaction(item.id, g.uid, state.user.uid, emoji);
      }
      showToast(emoji + " sent");
    } catch (e) {
      showToast("Could not react");
    }
  }

  function showDeleteConfirm() {
    return new Promise(function (resolve) {
      var existing = document.getElementById("vieworaDeleteSheet");
      if (existing) existing.remove();
      var wrap = document.createElement("div");
      wrap.id = "vieworaDeleteSheet";
      wrap.className = "vieworaConfirmSheet";
      wrap.innerHTML =
        '<div class="vieworaConfirmBackdrop" data-act="no"></div>' +
        '<div class="vieworaConfirmCard">' +
        '<div class="vieworaConfirmIcon"><i class="fa-regular fa-trash-can"></i></div>' +
        '<h3>Delete story?</h3>' +
        '<p>This story will be removed permanently. You cannot undo this.</p>' +
        '<div class="vieworaConfirmActions">' +
        '<button type="button" class="vieworaConfirmBtn ghost" data-act="no">Cancel</button>' +
        '<button type="button" class="vieworaConfirmBtn danger" data-act="yes">Delete</button>' +
        '</div></div>';
      document.body.appendChild(wrap);
      requestAnimationFrame(function () { wrap.classList.add("show"); });
      function close(val) {
        wrap.classList.remove("show");
        setTimeout(function () { try { wrap.remove(); } catch (_) {} }, 220);
        resolve(val);
      }
      wrap.addEventListener("click", function (e) {
        var t = e.target.closest("[data-act]");
        if (!t) return;
        close(t.getAttribute("data-act") === "yes");
      });
    });
  }

  async function deleteCurrent() {
    if (!isOwner()) return;
    const item = currentItem();
    if (!item) return;
    const ok = await showDeleteConfirm();
    if (!ok) return;
    try {
      await firebase.database().ref(`stories/${item.id}`).remove();
      try {
        await firebase.database().ref(`users/${state.user.uid}/stories/${item.id}`).remove();
      } catch (_) {}
      const g = currentGroup();
      g.items = g.items.filter((x) => x.id !== item.id);
      if (!g.items.length) {
        state.groups = state.groups.filter((x) => x.uid !== g.uid);
        state.itemIndex = 0;
        if (!state.groups.length) {
          location.href = "index.html";
          return;
        }
        if (state.groupIndex >= state.groups.length) state.groupIndex = state.groups.length - 1;
      } else if (state.itemIndex >= g.items.length) {
        state.itemIndex = g.items.length - 1;
      }
      showToast("Story deleted");
      showItem();
    } catch (e) {
      showToast("Delete failed");
    }
  }

  async function loadPeople(query) {
    const list = $("peopleList");
    if (!list) return;
    list.innerHTML = "<p style='padding:12px;color:#888'>Loading…</p>";
    try {
      const snap = await firebase.database().ref("users").limitToFirst(50).once("value");
      const q = String(query || "").toLowerCase().trim();
      const rows = [];
      snap.forEach((c) => {
        const d = c.val() || {};
        const name = nameOf(d);
        if (q && !name.toLowerCase().includes(q) && !String(d.username || "").toLowerCase().includes(q)) return;
        if (state.user && c.key === state.user.uid) return;
        rows.push({ id: c.key, data: d, name });
      });
      if (!rows.length) {
        list.innerHTML = "<p style='padding:12px;color:#888'>No users found</p>";
        return;
      }
      list.innerHTML = rows.slice(0, 30).map((u) => `
        <button type="button" class="peopleItem" data-uid="${escapeHTML(u.id)}">
          <img src="${escapeHTML(avatarOf(u.data))}" alt="" onerror="this.src='assets/default-avatar.png'">
          <span>
            <strong>${escapeHTML(u.name)}</strong>
            <small>@${escapeHTML(u.data.username || u.id.slice(0, 6))}</small>
          </span>
        </button>
      `).join("");

      list.querySelectorAll(".peopleItem").forEach((btn) => {
        btn.addEventListener("click", () => selectPerson(btn.dataset.uid));
      });
    } catch (e) {
      list.innerHTML = "<p style='padding:12px;color:#888'>Could not load users</p>";
    }
  }

  async function selectPerson(uid) {
    const item = currentItem();
    const g = currentGroup();
    if (!item || !g || !uid) return;
    if (!state.user) {
      showToast("Login required");
      return;
    }
    try {
      // Mention = Instagram-style (replaces separate Collab)
      await firebase.database().ref("stories/" + item.id + "/mentions/" + uid).set({
        uid: uid,
        by: state.user.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      await notifyStoryMention(item.id, g.uid, uid);
      showToast("Mentioned — they can Add to story");
      closeSheet("peopleSheet");
    } catch (e) {
      console.error(e);
      showToast("Failed to mention");
    }
  }

  async function loadViewers() {
    const list = $("viewersList");
    const item = currentItem();
    if (!list || !item) return;
    list.innerHTML = "<p style='padding:12px;color:#888'>Loading…</p>";
    const viewers = item.data.viewers || {};
    const ids = Object.keys(viewers);
    if (!ids.length) {
      list.innerHTML = "<p style='padding:12px;color:#888'>No viewers yet</p>";
      return;
    }
    const html = [];
    for (const id of ids.slice(0, 40)) {
      try {
        const snap = await firebase.database().ref(`users/${id}`).once("value");
        const d = snap.val() || {};
        html.push(`
          <a class="peopleItem" href="profile.html?uid=${encodeURIComponent(id)}">
            <img src="${escapeHTML(avatarOf(d))}" alt="" onerror="this.src='assets/default-avatar.png'">
            <span>
              <strong>${escapeHTML(nameOf(d))}</strong>
              <small>${formatTime(viewers[id]?.viewedAt)}</small>
            </span>
          </a>
        `);
      } catch (_) {}
    }
    list.innerHTML = html.join("") || "<p style='padding:12px;color:#888'>No viewers</p>";
  }

  function bind() {
    $("storiesCloseBtn")?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = "index.html";
    });

    $("tapLeft")?.addEventListener("click", (e) => {
      e.stopPropagation();
      state.itemIndex -= 1;
      showItem();
      try { ($("storyAudio") || state.musicAudio)?.play()?.catch(() => {}); } catch (_) {}
    });
    $("tapRight")?.addEventListener("click", (e) => {
      e.stopPropagation();
      state.itemIndex += 1;
      showItem();
      try { ($("storyAudio") || state.musicAudio)?.play()?.catch(() => {}); } catch (_) {}
    });

    // Long-press / hold → pause story (Instagram style)
    const stage = $("stage");
    let pressT = null;
    let holdPaused = false;
    function pauseStory() {
      state.paused = true;
      holdPaused = true;
      try { $("storyVid")?.pause(); } catch (_) {}
      try { state.musicAudio?.pause(); } catch (_) {}
      try { $("storyAudio")?.pause(); } catch (_) {}
      clearTimeout(state.timer);
      state.timer = null;
    }
    function resumeStory() {
      if (!holdPaused && !state.paused) return;
      state.paused = false;
      holdPaused = false;
      try { $("storyVid")?.play().catch(function () {}); } catch (_) {}
      try { state.musicAudio?.play().catch(function () {}); } catch (_) {}
      try { $("storyAudio")?.play().catch(function () {}); } catch (_) {}
      tick();
    }
    function onPressStart(e) {
      // ignore if tapping UI buttons
      if (e.target && e.target.closest && e.target.closest("button, a, input, .sheet")) return;
      clearTimeout(pressT);
      pressT = setTimeout(function () { pauseStory(); }, 160);
    }
    function onPressEnd() {
      clearTimeout(pressT);
      if (holdPaused) resumeStory();
    }
    if (stage) {
      stage.addEventListener("touchstart", onPressStart, { passive: true });
      stage.addEventListener("touchend", onPressEnd);
      stage.addEventListener("touchcancel", onPressEnd);
      stage.addEventListener("mousedown", onPressStart);
      stage.addEventListener("mouseup", onPressEnd);
      stage.addEventListener("mouseleave", onPressEnd);
    }

    // 3-dot menu also pauses while open
    $("storiesMoreBtn")?.addEventListener("click", function () {
      pauseStory();
      openSheet("moreSheet");
    });
    document.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", function () {
        closeSheet(el.dataset.close);
        resumeStory();
      });
    });
    $("replySendBtn")?.addEventListener("click", sendReply);

    // Reply focus → pause story
    try {
      var ri = $("replyInput");
      if (ri && !ri._vieworaPauseBound) {
        ri._vieworaPauseBound = true;
        ri.addEventListener("focus", function () {
          try { if (typeof pauseStory === "function") pauseStory(); } catch (_) {}
          state.paused = true;
          try { $("storyVid")?.pause(); } catch (_) {}
          try { state.musicAudio?.pause(); } catch (_) {}
        });
        ri.addEventListener("blur", function () {
          // keep paused while menu open; else resume after short delay
          setTimeout(function () {
            if ($("moreSheet") && !$("moreSheet").classList.contains("hidden")) return;
            try { if (typeof resumeStory === "function") resumeStory(); } catch (_) {
              state.paused = false;
            }
          }, 200);
        });
      }
    } catch (_) {}

    $("replyInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); sendReply(); }
    });
    document.querySelectorAll(".reactBtn").forEach((btn) => {
      btn.addEventListener("click", () => sendReaction(btn.dataset.reaction));
    });

    $("deleteStoryBtn")?.addEventListener("click", deleteCurrent);
    $("deleteFromMenuBtn")?.addEventListener("click", () => {
      closeSheet("moreSheet");
      deleteCurrent();
    });

    $("mentionBtn")?.addEventListener("click", () => {
      closeSheet("moreSheet");
      state.peopleMode = "mention";
      if ($("peopleSheetTitle")) $("peopleSheetTitle").textContent = "Mention";
      openSheet("peopleSheet");
      loadPeople("");
    });
    $("collabBtn")?.addEventListener("click", () => {
      // Collab removed — same as mention
      closeSheet("moreSheet");
      state.peopleMode = "mention";
      if ($("peopleSheetTitle")) $("peopleSheetTitle").textContent = "Mention";
      openSheet("peopleSheet");
      loadPeople("");
    });
    $("peopleSearch")?.addEventListener("input", (e) => loadPeople(e.target.value));

    $("viewersBtn")?.addEventListener("click", () => {
      openSheet("viewersSheet");
      loadViewers();
    });

    $("reportBtn")?.addEventListener("click", () => {
      closeSheet("moreSheet");
      const item = currentItem();
      const g = currentGroup();
      if (!item) return;
      const params = new URLSearchParams();
      params.set("type", "story");
      params.set("id", item.id);
      if (g?.uid) params.set("uid", g.uid);
      window.location.href = "report.html?" + params.toString();
    });

    $("storiesUser")?.addEventListener("click", () => {
      const g = currentGroup();
      if (g?.uid) location.href = `profile.html?uid=${encodeURIComponent(g.uid)}`;
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") location.href = "index.html";
      if (e.key === "ArrowRight") { state.itemIndex += 1; showItem(); }
      if (e.key === "ArrowLeft") { state.itemIndex -= 1; showItem(); }
    });
  }


  function injectStoriesCSS() {
    if (document.getElementById("vieworaStoriesExtraCSS")) return;
    const s = document.createElement("style");
    s.id = "vieworaStoriesExtraCSS";
    s.textContent = `
      .storiesLiveTag {
        display: inline-block;
        margin-left: 6px;
        padding: 2px 7px;
        border-radius: 6px;
        background: #ff2d55;
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .06em;
        vertical-align: middle;
      }
      .storyLoading {
        background: #000 !important;
      }
      .storyLoading #storyImg:not([src]),
      .storyLoading #storyVid:not([src]) {
        opacity: 0;
      }
    `;
    document.head.appendChild(s);
  }

  function paintFromUrlParams() {
    try {
      const p = new URLSearchParams(location.search);
      const name = (p.get("name") || "").trim();
      const photo = (p.get("photo") || "").trim();
      const ne = $("storiesName");
      const ae = $("storiesAvatar");
      if (ne && name) ne.textContent = name;
      if (ae && photo) {
        ae.src = photo;
        ae.onerror = function () { this.src = "assets/default-avatar.png"; };
      }
      if (ne && !name) ne.textContent = "";
    } catch (_) {}
  }

  function init() {
    injectStoriesCSS();
    paintFromUrlParams();
    try {
      document.body.style.background = "#000";
      document.documentElement.style.background = "#000";
    } catch (_) {}
    if (!ready()) {
      showToast("Firebase not ready");
      return;
    }
    bind();
    var loading = false;
    function runLoad(user) {
      if (loading) return;
      loading = true;
      state.user = user || null;
      loadAll()
        .catch(function (e) {
          console.warn("[STORIES] loadAll", e);
          showToast("Could not load story");
        })
        .finally(function () {
          loading = false;
        });
    }
    var unsub = firebase.auth().onAuthStateChanged(function (user) {
      runLoad(user || null);
    });
    // Guest safety: if auth never fires within 1.2s, load as guest
    setTimeout(function () {
      if (!state.user && !loading) {
        try {
          if (!firebase.auth().currentUser) runLoad(null);
        } catch (_) {
          runLoad(null);
        }
      }
    }, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else init();
})();
