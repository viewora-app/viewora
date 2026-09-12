"use strict";
(() => {
  if (window.__VIEWORA_STORIES__) return;
  window.__VIEWORA_STORIES__ = true;

  const STORY_TTL = 24 * 60 * 60 * 1000;
  const IMAGE_MS = 5000;
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
    return d?.mediaURL || d?.mediaUrl || d?.url || d?.imageUrl || d?.videoUrl || d?.videoURL || "";
  }
  function ownerId(d) {
    return d?.uid || d?.userId || d?.ownerId || "";
  }
  function isExpired(d, now) {
    const c = Number(d.createdAt || d.timestamp || 0);
    if (!c) return true;
    const e = Number(d.expiresAt || c + STORY_TTL);
    return e < now;
  }
  function avatarOf(d) {
    return d?.avatar || d?.photoURL || d?.profilePhoto || d?.profileImage || "assets/default-avatar.png";
  }
  function nameOf(d) {
    return d?.username || d?.userName || d?.displayName || d?.creatorName || d?.name || "User";
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
        state.musicAudio = null;
      }
    } catch (_) {}
    const el = $("storyAudio");
    if (el) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch (_) {}
    }
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
    stopMusic();
    bindMusicUnlock();

    const info = musicInfo(data);
    if (!info) return;

    let url = info.audioUrl || "";
    if (!url) {
      url = (await resolveMusicUrl(info)) || "";
    }
    if (!url) {
      console.warn("Story music has no audioUrl", info);
      return;
    }

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
      el.muted = false;
      el.src = url;
      state.musicAudio = el;

      let seekDone = false;
      const seekAndPlay = () => {
        try {
          if (!seekDone && startAt > 0 && isFinite(el.duration) && el.duration > 0.5) {
            const maxStart = Math.max(0, el.duration - 1.5);
            el.currentTime = Math.min(startAt, maxStart);
            seekDone = true;
          }
        } catch (_) {}
        el.muted = false;
        el.volume = 1;
        const p = el.play();
        if (p && p.catch) {
          p.catch((err) => {
            console.warn("Autoplay blocked, waiting for tap:", err && err.message);
          });
        }
      };

      el.onloadedmetadata = () => {
        try {
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
      setTimeout(seekAndPlay, 250);
      setTimeout(seekAndPlay, 700);
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

    // Name + tick (blue / red / white) — always enrich from users/
    const nameEl = $("storiesName");
    let baseName =
      g.username ||
      nameOf(item.data) ||
      "User";
    let userNode = null;
    let verified = isVerifiedUser(item.data);

    try {
      userNode = await fetchUser(g.uid);
      if (userNode) {
        const realName =
          userNode.username ||
          userNode.userName ||
          userNode.displayName ||
          userNode.name ||
          userNode.fullName ||
          "";
        // Replace generic placeholders
        const generic = /^(user|viewora user|viewora)$/i;
        if (realName && (generic.test(String(baseName).trim()) || !baseName || baseName === "User")) {
          baseName = realName;
        } else if (realName) {
          baseName = realName;
        }
        g.username = baseName;
        if (isVerifiedUser(userNode)) verified = true;
        const photo =
          userNode.profilePhoto ||
          userNode.photoURL ||
          userNode.avatar ||
          userNode.profilePicture ||
          "";
        if (photo) {
          $("storiesAvatar").src = photo;
          g.avatar = photo;
        }
      }
    } catch (_) {}

    if (nameEl) {
      nameEl.innerHTML = "";
      nameEl.appendChild(document.createTextNode(baseName));

      // Prefer VieworaBadges hierarchy (red > blue > white)
      let tickHtml = "";
      const badgeSource = userNode || item.data || {};
      if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
        const b = VieworaBadges.resolve(badgeSource);
        if (b && b.html) tickHtml = b.html;
      }
      if (!tickHtml && verified) {
        if (badgeSource.redTick || badgeSource.vip) {
          tickHtml = '<i class="fa-solid fa-certificate vieworaTick redTick storiesBlueTick" title="VIP Elite" style="color:#ff3b5c;margin-left:5px;font-size:12px;vertical-align:middle"></i>';
        } else if (badgeSource.whiteTick && !badgeSource.blueTick && !badgeSource.verified) {
          tickHtml = '<i class="fa-solid fa-circle-check vieworaTick whiteTick storiesBlueTick" title="Monetized" style="color:#f0f4fa;margin-left:5px;font-size:12px;vertical-align:middle"></i>';
        } else {
          tickHtml = '<i class="fa-solid fa-circle-check vieworaTick blueTick storiesBlueTick" title="Verified" style="color:#1d9bf0;margin-left:5px;font-size:12px;vertical-align:middle"></i>';
        }
      }
      if (tickHtml) {
        const wrap = document.createElement("span");
        wrap.innerHTML = tickHtml;
        while (wrap.firstChild) nameEl.appendChild(wrap.firstChild);
      }
    }

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

  function showItem() {
    state._advancing = false;
    const g = currentGroup();
    if (!g || !g.items.length) {
      const uid = new URLSearchParams(location.search).get("uid") || "";
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
    const data = item.data || {};
    const url = mediaURL(data);
    if (!url) {
      state.itemIndex += 1;
      showItem();
      return;
    }

    updateChrome();
    renderReactions(data);
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

    const type = String(data.mediaType || data.type || "").toLowerCase();
    const isVideo = type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url);
    const img = $("storyImg");
    const vid = $("storyVid");
    const goNext = () => {
      clearTimeout(state.timer);
      state.timer = null;
      state.itemIndex += 1;
      showItem();
    };
    const hasMusic = !!(musicInfo(data)?.audioUrl);
    // Photo + music = 15s minimum; photo alone = 5s
    const imageDuration = hasMusic ? IMAGE_MUSIC_MS : IMAGE_MS;

    // Soft loading: keep stage dark until media is ready (avoids blank user flash)
    const stage = $("storyStage") || $("storiesStage") || img?.parentElement;
    if (stage) stage.classList.add("storyLoading");

    if (isVideo && vid) {
      img?.classList.add("hidden");
      vid.classList.remove("hidden");
      vid.src = url;
      vid.muted = hasMusic;
      vid.onended = goNext;
      vid.onloadedmetadata = () => {
        const d = vid.duration && isFinite(vid.duration) ? vid.duration * 1000 : 15000;
        // With music, at least 15s if video shorter; cap 30s without forcing short clips long
        let ms = Math.min(Math.max(d, hasMusic ? IMAGE_MUSIC_MS : 1000), 30000);
        if (!hasMusic) ms = Math.min(d, 30000);
        state.duration = ms;
        state.startedAt = Date.now();
        if (stage) stage.classList.remove("storyLoading");
        tick();
      };
      vid.play().catch(() => {
        vid.muted = true;
        vid.play().catch(goNext);
      });
      state.duration = hasMusic ? IMAGE_MUSIC_MS : 15000;
      state.startedAt = Date.now();
      tick();
    } else if (img) {
      vid?.classList.add("hidden");
      try { vid.pause(); vid.removeAttribute("src"); vid.load(); } catch (_) {}
      img.classList.remove("hidden");
      img.onerror = () => {
        if (stage) stage.classList.remove("storyLoading");
        goNext();
      };
      img.onload = () => {
        if (stage) stage.classList.remove("storyLoading");
        state.duration = imageDuration;
        state.startedAt = Date.now();
        tick();
      };
      // If already cached, onload may not fire — force
      img.src = url;
      if (img.complete && img.naturalWidth) {
        if (stage) stage.classList.remove("storyLoading");
        state.duration = imageDuration;
        state.startedAt = Date.now();
        tick();
      } else {
        state.duration = imageDuration;
        state.startedAt = Date.now();
        tick();
      }
      // Fallback timer (tick also advances — belt & suspenders)
      clearTimeout(state.timer);
      state.timer = setTimeout(goNext, imageDuration + 80);
    }
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
    if (state.user && !soloMode) {
      try {
        let snap = await db.ref(`following/${state.user.uid}`).once("value");
        if (!snap.exists()) {
          snap = await db.ref(`users/${state.user.uid}/following`).once("value");
        }
        following = new Set(Object.keys(snap.val() || {}));
      } catch (_) {}
    }

    const snap = await db.ref("stories").once("value");
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
    await Promise.all(
      Object.values(byUser).map(async (g) => {
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

    // Mark live users (followed live goes to front with red LIVE)
    try {
      const liveSnap = await db.ref("live").once("value");
      if (liveSnap.exists()) {
        liveSnap.forEach((c) => {
          const v = c.val() || {};
          const lid = String(v.uid || c.key || "");
          if (!lid || !byUser[lid]) return;
          if (v.active === true || v.isLive === true || v.status === "live") {
            byUser[lid].isLive = true;
          }
        });
      }
    } catch (_) {}
    try {
      await Promise.all(
        Object.keys(byUser).map(async (uid) => {
          try {
            const s = await db.ref("users/" + uid + "/isLive").once("value");
            if (s.val() === true) byUser[uid].isLive = true;
          } catch (_) {}
        })
      );
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

    // Hard lock: if solo + focusUid, never keep other users
    if (soloMode && focusUid) {
      state.groups = state.groups.filter((g) => g.uid === focusUid);
    }

    if (!state.groups.length) {
      showToast("No stories");
      setTimeout(() => {
        if (window.history.length > 1) history.back();
        else location.href = focusUid
          ? "profile.html?uid=" + encodeURIComponent(focusUid)
          : "index.html";
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
    }

    state.groupIndex = gi;
    state.itemIndex = ii;
    // Prevent advancing to other users in solo mode
    state.soloMode = soloMode && !!focusUid;
    showItem();
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

  async function deleteCurrent() {
    if (!isOwner()) return;
    const item = currentItem();
    if (!item) return;
    if (!confirm("Delete this story?")) return;
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
    try {
      if (state.peopleMode === "mention") {
        await firebase.database().ref(`stories/${item.id}/mentions/${uid}`).set({
          uid,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        if (typeof notifyStoryMention === "function") {
          notifyStoryMention(item.id, g.uid, uid);
        }
        showToast("Mentioned");
      } else {
        await firebase.database().ref(`stories/${item.id}/collab/${uid}`).set({
          uid,
          invitedBy: state.user.uid,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        showToast("Collab invite sent");
      }
      closeSheet("peopleSheet");
    } catch (e) {
      showToast("Failed");
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

    // long press pause
    const stage = $("stage");
    let pressT;
    stage?.addEventListener("touchstart", () => {
      pressT = setTimeout(() => {
        state.paused = true;
        $("storyVid")?.pause();
        try { state.musicAudio?.pause(); } catch (_) {}
      }, 180);
    }, { passive: true });
    stage?.addEventListener("touchend", () => {
      clearTimeout(pressT);
      if (state.paused) {
        state.paused = false;
        $("storyVid")?.play().catch(() => {});
        try { state.musicAudio?.play().catch(() => {}); } catch (_) {}
        tick();
      }
    });

    $("storiesMoreBtn")?.addEventListener("click", () => openSheet("moreSheet"));
    document.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => closeSheet(el.dataset.close));
    });

    $("replySendBtn")?.addEventListener("click", sendReply);
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
      closeSheet("moreSheet");
      state.peopleMode = "collab";
      if ($("peopleSheetTitle")) $("peopleSheetTitle").textContent = "Collab";
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

  function init() {
    injectStoriesCSS();
    if (!ready()) {
      showToast("Firebase not ready");
      return;
    }
    bind();
    firebase.auth().onAuthStateChanged(async (user) => {
      state.user = user || null;
      await loadAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else init();
})();
