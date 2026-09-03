"use strict";
(() => {
  if (window.__VIEWORA_STORIES__) return;
  window.__VIEWORA_STORIES__ = true;

  const STORY_TTL = 24 * 60 * 60 * 1000;
  const IMAGE_MS = 5000;
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
    if (d.verified === true || d.isVerified === true || d.blueTick === true) return true;
    const s = String(d.verificationStatus || d.badge || "").toLowerCase();
    return s === "verified" || s === "creator" || s === "influencer";
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
    return { audioUrl, title, artist, id };
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

    try {
      const el = ensureAudioEl();
      el.loop = true;
      el.volume = 1;
      el.muted = false;
      el.src = url;
      state.musicAudio = el;

      const attempt = () => {
        const p = el.play();
        if (p && p.catch) {
          p.catch((err) => {
            console.warn("Autoplay blocked, waiting for tap:", err && err.message);
          });
        }
      };

      el.oncanplay = attempt;
      attempt();

      // Extra retries (mobile browsers)
      setTimeout(attempt, 200);
      setTimeout(attempt, 600);
      setTimeout(attempt, 1200);
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
      if (ratio < 1) state.raf = requestAnimationFrame(step);
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

    $("storiesAvatar").src = g.avatar || "assets/default-avatar.png";

    // Name + blue tick
    const nameEl = $("storiesName");
    const baseName = g.username || "User";
    let verified = isVerifiedUser(item.data);

    // Enrich from users node
    try {
      const u = await fetchUser(g.uid);
      if (u) {
        if (isVerifiedUser(u)) verified = true;
        if ((!g.avatar || g.avatar.includes("default")) && (u.profilePhoto || u.photoURL)) {
          $("storiesAvatar").src = u.profilePhoto || u.photoURL;
        }
      }
    } catch (_) {}

    if (nameEl) {
      nameEl.innerHTML = "";
      nameEl.appendChild(document.createTextNode(baseName));
      if (verified) {
        const tick = document.createElement("i");
        tick.className = "fa-solid fa-circle-check storiesBlueTick";
        tick.title = "Verified";
        tick.style.cssText = "color:#1d9bf0;margin-left:5px;font-size:12px;vertical-align:middle";
        nameEl.appendChild(tick);
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

  function showItem() {
    const g = currentGroup();
    if (!g || !g.items.length) {
      window.location.href = "index.html";
      return;
    }
    if (state.itemIndex >= g.items.length) {
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
    buildProgress(g.items.length, state.itemIndex);
    setFill(0);
    markView(item.id, g.uid);

    // Play attached music
    playStoryMusic(data);

    const type = String(data.mediaType || data.type || "").toLowerCase();
    const isVideo = type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url);
    const img = $("storyImg");
    const vid = $("storyVid");
    const goNext = () => { state.itemIndex += 1; showItem(); };
    const hasMusic = !!(musicInfo(data)?.audioUrl);

    if (isVideo && vid) {
      img?.classList.add("hidden");
      vid.classList.remove("hidden");
      vid.src = url;
      // mute video if story music exists so song is clear
      vid.muted = hasMusic;
      vid.onended = goNext;
      vid.onloadedmetadata = () => {
        const d = vid.duration && isFinite(vid.duration) ? vid.duration * 1000 : 15000;
        state.duration = Math.min(d, 30000);
        state.startedAt = Date.now();
        tick();
      };
      vid.play().catch(() => {
        vid.muted = true;
        vid.play().catch(goNext);
      });
      state.duration = 15000;
      state.startedAt = Date.now();
      tick();
    } else if (img) {
      vid?.classList.add("hidden");
      try { vid.pause(); vid.removeAttribute("src"); vid.load(); } catch (_) {}
      img.classList.remove("hidden");
      img.onerror = goNext;
      img.onload = () => {
        state.duration = IMAGE_MS;
        state.startedAt = Date.now();
        tick();
      };
      img.src = url;
      state.duration = IMAGE_MS;
      state.startedAt = Date.now();
      tick();
      clearTimeout(state.timer);
      state.timer = setTimeout(goNext, IMAGE_MS);
    }
  }

  async function loadAll() {
    const db = firebase.database();
    const now = Date.now();
    const params = new URLSearchParams(location.search);
    const focusUid = params.get("uid") || "";
    const focusId = params.get("id") || params.get("storyId") || params.get("story") || "";

    let following = new Set();
    if (state.user) {
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
      if (isExpired(data, now)) return;
      const uid = ownerId(data);
      if (!uid) return;

      const isOwn = state.user && uid === state.user.uid;
      const isFollowing = following.has(uid);
      // allow open if focus matches even without follow (deep link)
      const isFocus = focusUid === uid || focusId === child.key;
      if (!isOwn && !isFollowing && !isFocus) return;

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

    state.groups = Object.values(byUser).sort((a, b) => b.latest - a.latest);

    if (!state.groups.length) {
      showToast("No stories");
      setTimeout(() => (location.href = "index.html"), 800);
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
      await firebase.database().ref(`stories/${item.id}/reactions/${state.user.uid}`).set({
        uid: state.user.uid,
        reaction: emoji,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
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

    $("reportBtn")?.addEventListener("click", async () => {
      closeSheet("moreSheet");
      if (!state.user) { showToast("Login required"); return; }
      const item = currentItem();
      if (!item) return;
      try {
        await firebase.database().ref(`reports/${item.id}/${state.user.uid}`).set({
          uid: state.user.uid,
          storyId: item.id,
          reason: "inappropriate",
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        showToast("Reported");
      } catch (_) {
        showToast("Report failed");
      }
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

  function init() {
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
