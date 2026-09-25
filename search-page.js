"use strict";

/*
============================================================
 VIEWORA — SEARCH ENGINE v2 (~95%)
 Users · Videos · Shorts · Posts
 • ~40% fuzzy match (token overlap / includes)
 • @username → people only
 • Live debounce
 • Recent searches
 • Blue / Red / White ticks
 • Real followers count
 • Tab filters: All | People | Videos | Shorts | Posts
============================================================
*/

(() => {
  if (window.__VIEWORA_SEARCH_V2__) return;
  window.__VIEWORA_SEARCH_V2__ = true;

  const CONFIG = {
    recentKey: "viewora_recent_searches",
    maxRecent: 12,
    debounceMs: 280,
    maxUsers: 24,
    maxMedia: 36,
    minMatchRatio: 0.45,
    maxRandomFill: 12
  };

  const $ = (id) => document.getElementById(id);

  const searchInput = $("searchInput");
  const clearSearch = $("clearSearch");
  const recentSection = $("recentSection");
  const recentList = $("recentList");
  const clearAllRecent = $("clearAllRecent");
  const trendingSection = $("trendingSection");
  const resultsSection = $("resultsSection");
  const resultsBody = $("resultsBody");
  const resultCount = $("resultCount");
  const emptyState = $("emptyState");
  const emptyTitle = $("emptyTitle");
  const emptyText = $("emptyText");
  const loadingState = $("loadingState");
  const tabsBar = $("searchTabs");

  let db = null;
  let authUser = null;
  let timer = null;
  let reqId = 0;
  let activeTab = "all";
  let lastBundle = null;
  let lastQuery = "";

  function normalize(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeUrl(v, fallback) {
    const u = String(v || "").trim();
    if (!u) return fallback || "";
    if (
      u.startsWith("https://") ||
      u.startsWith("http://") ||
      u.startsWith("data:image/") ||
      u.startsWith("blob:")
    ) {
      return u;
    }
    return fallback || "";
  }

  function tokens(str) {
    return normalize(str)
      .split(/[^a-z0-9_@#]+/)
      .filter((t) => t.length > 1);
  }

  function matchScore(haystack, query) {
    const h = normalize(haystack);
    const q = normalize(query);
    if (!q || !h) return 0;
    if (h === q) return 1;
    if (h.startsWith(q)) return 0.95;
    if (h.includes(q)) return 0.82;

    const qt = tokens(q);
    const ht = tokens(h);
    if (!qt.length) return 0;
    const htSet = new Set(ht);

    let hit = 0;
    qt.forEach((t) => {
      if (t.length < 2) return;
      if (htSet.has(t)) {
        hit += 1;
        return;
      }
      // only allow substring match for tokens length >= 3
      if (t.length >= 3) {
        for (const x of ht) {
          if (x.length >= 3 && (x.includes(t) || t.includes(x))) {
            hit += 0.55;
            break;
          }
        }
      }
    });
    return hit / qt.length;
  }

  function isJunkTitle(title) {
    const t = normalize(title);
    if (!t) return true;
    if (t.length <= 2) return true;
    // placeholders / test uploads
    if (
      /^(upload|untitled|post|video|short|test|new post|viewora test|viewora)\b/.test(t) &&
      t.length < 22
    ) {
      return true;
    }
    // only symbols / hashtags
    if (!/[a-z0-9]{3,}/.test(t)) return true;
    return false;
  }

  function postMediaList(data) {
    if (!data || typeof data !== "object") return [];
    const out = [];
    const isHttp = (u) => typeof u === "string" && /^https?:\/\//i.test(u.trim());
    const push = (u) => {
      if (!isHttp(u)) return;
      const s = safeUrl(u, "");
      if (!s) return;
      // skip likely avatars (tiny default paths / known avatar keys already excluded)
      if (out.indexOf(s) === -1) out.push(s);
    };

    // Prefer explicit post image arrays first
    if (Array.isArray(data.images) && data.images.length) {
      data.images.forEach((it) => {
        if (typeof it === "string") push(it);
        else if (it && typeof it === "object")
          push(it.url || it.src || it.imageUrl || it.secure_url || it.downloadURL);
      });
    }
    if (Array.isArray(data.media) && data.media.length) {
      data.media.forEach((it) => {
        if (typeof it === "string") push(it);
        else if (it && typeof it === "object") {
          const t = String(it.type || it.mediaType || "").toLowerCase();
          if (t.indexOf("video") !== -1) return;
          push(it.url || it.src || it.secure_url || it.imageUrl || it.downloadURL);
        }
      });
    }
    if (Array.isArray(data.photos)) {
      data.photos.forEach((it) => {
        if (typeof it === "string") push(it);
        else if (it && typeof it === "object") push(it.url || it.src || it.secure_url);
      });
    }
    if (Array.isArray(data.files)) {
      data.files.forEach((it) => {
        if (typeof it === "string") push(it);
        else if (it && typeof it === "object") {
          const t = String(it.type || "").toLowerCase();
          if (t.indexOf("video") !== -1) return;
          push(it.url || it.src || it.secure_url);
        }
      });
    }

    // Single-image fields — NEVER photoURL / avatar / profilePhoto (those are DP)
    ["imageUrl", "image", "postImage", "postImageUrl", "mediaUrl", "coverUrl", "cover", "thumbnailUrl", "thumbnail"].forEach((k) => {
      if (data[k] && !out.length) push(data[k]);
      else if (data[k]) push(data[k]);
    });

    // Deduplicate and cap
    return out.slice(0, 10);
  }

  function postMediaUrl(data) {
    const list = postMediaList(data);
    return list[0] || "";
  }

  function isBrokenOrTinyUrl(url) {
    const u = String(url || "").toLowerCase();
    if (!u) return true;
    // common broken / placeholder patterns
    if (u.indexOf("undefined") !== -1 || u.indexOf("null") !== -1) return true;
    if (u.indexOf("default-avatar") !== -1) return true;
    if (u.indexOf("placeholder") !== -1) return true;
    return false;
  }

  function isValidMediaItem(data, kind) {
    if (!data || typeof data !== "object") return false;
    if (
      data.deleted === true ||
      data.archived === true ||
      data.hidden === true ||
      data.isDeleted === true ||
      data.removed === true
    ) {
      return false;
    }
    if (data.status === "processing" || data.status === "failed" || data.status === "draft") return false;
    if (data.uploading === true || data.isDraft === true) return false;

    const vis = String(data.visibility || data.privacy || "public").toLowerCase();
    if (vis === "private" || vis === "only_me") return false;

    // owner deleted?
    if (data.ownerDeleted === true || data.userDeleted === true) return false;

    const title = data.title || data.caption || data.name || data.text || "";

    if (kind === "post") {
      // ALWAYS reject junk titles (even if image exists)
      if (isJunkTitle(title)) return false;
      const media = postMediaUrl(data);
      if (!media || isBrokenOrTinyUrl(media)) return false;
      return true;
    }

    // video / short
    if (isJunkTitle(title) && title) {
      // allow empty title videos if they have real media
    }
    const url = videoUrlOf(data);
    const thumb = thumbOf(data);
    if (!url && !thumb) return false;
    if (url && isBrokenOrTinyUrl(url) && (!thumb || isBrokenOrTinyUrl(thumb))) return false;
    return true;
  }

  // cache deleted users for this search session
  let deletedUserSet = null;
  async function loadDeletedUsers() {
    if (deletedUserSet) return deletedUserSet;
    deletedUserSet = new Set();
    if (!db) return deletedUserSet;
    try {
      const snap = await db.ref("deletedUsers").once("value");
      if (snap.exists()) {
        snap.forEach((ch) => {
          deletedUserSet.add(ch.key);
        });
      }
    } catch (_) {}
    return deletedUserSet;
  }

  async function isUserDeleted(uid) {
    if (!uid) return false;
    const set = await loadDeletedUsers();
    if (set.has(uid)) return true;
    try {
      if (!db) return false;
      const snap = await db.ref("users/" + uid).once("value");
      if (!snap.exists()) return true; // account gone
      const u = snap.val() || {};
      if (u.deleted === true || u.disabled === true || u.banned === true) return true;
    } catch (_) {}
    return false;
  }

  function textBlob(...parts) {
    return parts.filter(Boolean).join(" ");
  }

  function formatCount(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  function resolveBadge(user) {
    if (!user || typeof user !== "object") return "";
    if (window.VieworaBadges && typeof window.VieworaBadges.resolve === "function") {
      try {
        const r = window.VieworaBadges.resolve(user);
        if (r && typeof r === "string" && r.indexOf("<") !== -1) return r;
        if (r && r.html) return r.html;
        if (r && r.type) {
          const t = r.type;
          if (t === "red" || t === "vip")
            return '<i class="fa-solid fa-certificate badge-tick red" title="VIP"></i>';
          if (t === "blue" || t === "verified")
            return '<i class="fa-solid fa-circle-check badge-tick blue" title="Verified"></i>';
          if (t === "white" || t === "monetized")
            return '<i class="fa-solid fa-circle-check badge-tick white" title="Monetized"></i>';
        }
      } catch (_) {}
    }
    if (user.redTick || user.vip || user.isVip || user.subscriptionTier === "yearly")
      return '<i class="fa-solid fa-certificate badge-tick red" title="VIP"></i>';
    if (user.blueTick || user.verified || user.isVerified || user.creator)
      return '<i class="fa-solid fa-circle-check badge-tick blue" title="Verified"></i>';
    if (user.whiteTick || user.monetized || user.isMonetized)
      return '<i class="fa-solid fa-circle-check badge-tick white" title="Monetized"></i>';
    return "";
  }

  function avatarOf(user) {
    return safeUrl(
      user.photoURL || user.avatar || user.profilePic || user.profilePhoto || user.image,
      ""
    );
  }

  function displayNameOf(user) {
    return user.displayName || user.name || user.fullName || user.username || "User";
  }

  function usernameOf(user) {
    return user.username || user.userName || user.handle || "";
  }

  function videoUrlOf(item) {
    return item.videoUrl || item.videoURL || item.video || item.mediaUrl || item.url || "";
  }

  function thumbOf(item) {
    if (!item || typeof item !== "object") return "";
    // Content thumbnails only — never profile DP
    const candidates = [
      item.thumbnailUrl,
      item.thumbnailURL,
      item.thumbnail,
      item.thumbUrl,
      item.thumb,
      item.coverUrl,
      item.cover,
      item.poster,
      item.posterUrl,
      item.imageUrl,
      item.postImage,
      item.postImageUrl,
      item.secure_url
    ];
    for (let i = 0; i < candidates.length; i++) {
      const u = safeUrl(candidates[i], "");
      if (u) return u;
    }
    // media array first image
    if (Array.isArray(item.media) && item.media.length) {
      const m0 = item.media[0];
      if (typeof m0 === "string") {
        const u = safeUrl(m0, "");
        if (u) return u;
      } else if (m0 && typeof m0 === "object") {
        const u = safeUrl(m0.thumbnail || m0.poster || m0.url || m0.secure_url || m0.src, "");
        if (u) return u;
      }
    }
    if (item.media && typeof item.media === "object" && !Array.isArray(item.media)) {
      const u = safeUrl(
        item.media.thumbnail || item.media.poster || item.media.url || item.media.secure_url,
        ""
      );
      if (u) return u;
    }
    // Cloudinary video → frame poster
    const v =
      item.videoUrl || item.videoURL || item.video || item.mediaUrl || item.url || "";
    if (typeof v === "string" && v.indexOf("res.cloudinary.com") !== -1 && /\/video\/upload\//.test(v)) {
      const poster = v.replace("/upload/", "/upload/so_0,w_480,h_854,c_fill,f_jpg/");
      if (poster !== v) return poster;
    }
    return "";
  }

  function initFb() {
    try {
      if (typeof firebase !== "undefined") {
        db = firebase.database();
        authUser = firebase.auth().currentUser;
        firebase.auth().onAuthStateChanged((u) => {
          authUser = u;
        });
      }
    } catch (e) {
      console.warn("Search FB init", e);
    }
  }

  async function realFollowers(uid, user) {
    try {
      if (!db || !uid) return Number(user.followersCount || user.followers || 0) || 0;
      const snap = await db.ref("followers/" + uid).once("value");
      if (snap.exists()) return snap.numChildren();
    } catch (_) {}
    return Number(user.followersCount || user.followers || 0) || 0;
  }

  function getRecent() {
    try {
      const raw = localStorage.getItem(CONFIG.recentKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch (_) {
      return [];
    }
  }

  function saveRecent(q) {
    q = String(q || "").trim();
    if (!q) return;
    let list = getRecent().filter((x) => normalize(x) !== normalize(q));
    list.unshift(q);
    list = list.slice(0, CONFIG.maxRecent);
    try {
      localStorage.setItem(CONFIG.recentKey, JSON.stringify(list));
    } catch (_) {}
  }

  function removeRecent(q) {
    const list = getRecent().filter((x) => normalize(x) !== normalize(q));
    try {
      localStorage.setItem(CONFIG.recentKey, JSON.stringify(list));
    } catch (_) {}
    renderRecent();
  }

  function clearRecent() {
    try {
      localStorage.removeItem(CONFIG.recentKey);
    } catch (_) {}
    renderRecent();
  }

  function renderRecent() {
    if (!recentList) return;
    const list = getRecent();
    if (!list.length) {
      if (recentSection) recentSection.classList.add("hidden");
      recentList.innerHTML = "";
      return;
    }
    if (recentSection) recentSection.classList.remove("hidden");
    recentList.innerHTML = list
      .map(
        (q) =>
          '<button type="button" class="chip" data-q="' +
          escapeHtml(q) +
          '"><i class="fa-solid fa-clock-rotate-left"></i><span>' +
          escapeHtml(q) +
          '</span><i class="fa-solid fa-xmark chip-remove" data-remove="' +
          escapeHtml(q) +
          '"></i></button>'
      )
      .join("");

    recentList.querySelectorAll(".chip").forEach((el) => {
      el.addEventListener("click", (e) => {
        const rem = e.target.closest("[data-remove]");
        if (rem) {
          e.stopPropagation();
          removeRecent(rem.getAttribute("data-remove"));
          return;
        }
        const q = el.getAttribute("data-q");
        if (searchInput) searchInput.value = q;
        updateClear();
        runSearch(q, true);
      });
    });
  }

  function updateClear() {
    if (!clearSearch || !searchInput) return;
    clearSearch.classList.toggle("hidden", !searchInput.value.trim());
  }

  function showHome() {
    if (loadingState) loadingState.classList.add("hidden");
    if (resultsSection) resultsSection.classList.add("hidden");
    if (emptyState) emptyState.classList.add("hidden");
    if (recentSection) recentSection.classList.remove("hidden");
    if (trendingSection) trendingSection.classList.remove("hidden");
    renderRecent();
  }

  function showLoading() {
    if (recentSection) recentSection.classList.add("hidden");
    if (trendingSection) trendingSection.classList.add("hidden");
    if (resultsSection) resultsSection.classList.add("hidden");
    if (emptyState) emptyState.classList.add("hidden");
    if (loadingState) loadingState.classList.remove("hidden");
  }

  function hideLoading() {
    if (loadingState) loadingState.classList.add("hidden");
  }

  function showEmpty(q) {
    if (loadingState) loadingState.classList.add("hidden");
    if (resultsSection) resultsSection.classList.add("hidden");
    if (emptyState) emptyState.classList.remove("hidden");
    if (emptyTitle) emptyTitle.textContent = "No results";
    if (emptyText)
      emptyText.textContent = q
        ? 'Nothing matched "' + q + '". Try another word or @username.'
        : "Type to search users, videos, shorts & posts.";
  }

  function setTab(tab) {
    activeTab = tab || "all";
    if (tabsBar) {
      tabsBar.querySelectorAll(".search-tab").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tab === activeTab);
      });
    }
    if (lastBundle) renderBundle(lastBundle, lastQuery);
  }

  async function runSearch(query, save) {
    const raw = String(query || "").trim();
    lastQuery = raw;

    if (!raw) {
      showHome();
      return;
    }

    if (save) saveRecent(raw);
    showLoading();

    const myId = ++reqId;
    if (!db) initFb();
    if (!db) {
      showEmpty(raw);
      if (emptyText) emptyText.textContent = "Firebase unavailable.";
      return;
    }

    try {
      const isAt = raw.startsWith("@");
      const q = isAt ? raw.slice(1).trim() : raw;

      deletedUserSet = null; // refresh each search
      const [usersSnap, videosSnap, shortsSnap, postsSnap, deletedSnap] = await Promise.all([
        db.ref("users").once("value"),
        db.ref("videos").once("value"),
        db.ref("shorts").once("value"),
        db.ref("posts").once("value"),
        db.ref("deletedUsers").once("value").catch(function () { return { exists: function () { return false; }, forEach: function () {} }; })
      ]);
      deletedUserSet = new Set();
      try {
        if (deletedSnap && deletedSnap.exists && deletedSnap.exists()) {
          deletedSnap.forEach(function (ch) { deletedUserSet.add(ch.key); });
        }
      } catch (_) {}

      if (myId !== reqId) return;

      const users = [];
      const videos = [];
      const shorts = [];
      const posts = [];

      usersSnap.forEach((ch) => {
        const uid = ch.key;
        const user = ch.val() || {};
        if (!user || typeof user !== "object") return;
        if (user.deleted === true || user.disabled === true || user.banned === true) return;
        if (deletedUserSet && deletedUserSet.has(uid)) return;
        if (authUser && uid === authUser.uid) return;

        const name = displayNameOf(user);
        const uname = usernameOf(user);
        const nName = normalize(name);
        const nUname = normalize(uname);
        const nq = normalize(q);
        const full = normalize(name + " " + uname);

        // ONLY name / username — multi-word: "viewora music", "abhinandan70"
        let score = Math.max(matchScore(name, q), matchScore(uname, q), matchScore(full, q));
        if (nUname === nq || nName === nq || full === nq) score = 1;
        else if (nUname.startsWith(nq) || nName.startsWith(nq) || full.startsWith(nq))
          score = Math.max(score, 0.95);
        else if (nUname.includes(nq) || nName.includes(nq) || full.includes(nq))
          score = Math.max(score, 0.88);
        // all query tokens present in name/username
        const qTokens = tokens(q);
        if (qTokens.length > 1) {
          const blob = nName + " " + nUname;
          const allHit = qTokens.every(function (t) {
            return blob.indexOf(t) !== -1;
          });
          if (allHit) score = Math.max(score, 0.93);
        }

        // strict: require real name/username hit
        if (score < 0.5) return;
        if (
          !(
            nUname.includes(nq) ||
            nName.includes(nq) ||
            full.includes(nq) ||
            score >= 0.85
          )
        ) {
          // multi-token partial
          if (!(qTokens.length > 1 && score >= 0.7)) return;
        }

        // @search → username-focused (ignore spaces in query)
        if (isAt) {
          const nq2 = nq.replace(/\s+/g, "");
          const nu2 = nUname.replace(/\s+/g, "");
          if (!(nu2.includes(nq2) || nu2 === nq2 || nu2.startsWith(nq2))) return;
          score = Math.max(score, nu2 === nq2 ? 1 : 0.95);
        }
        // "viewora music" matches vieworamusic
        const nqCompact = nq.replace(/\s+/g, "");
        if (nqCompact.length >= 3 && nUname.replace(/\s+/g, "").includes(nqCompact)) {
          score = Math.max(score, 0.94);
        }

        users.push({ uid, user, score });
      });
      users.sort((a, b) => b.score - a.score);
      const topUsers = users.slice(0, isAt ? 12 : 10);

      // full user map for owner name/tick enrichment
      const userMap = {};
      usersSnap.forEach(function (ch) {
        userMap[ch.key] = ch.val() || {};
      });


      await Promise.all(
        topUsers.slice(0, 12).map(async (row) => {
          row.followers = await realFollowers(row.uid, row.user);
        })
      );

      // primary matched user (best score)
      const primaryUser = topUsers.length && topUsers[0].score >= 0.7 ? topUsers[0] : null;
      const primaryUid = primaryUser ? primaryUser.uid : null;

      const allVideos = [];
      const allShorts = [];
      const allPosts = [];

      const considerMedia = (id, data, bucket, kind, requireMatch) => {
        if (!isValidMediaItem(data, kind)) return;
        const ownerUid = data.uid || data.userId || data.ownerId || data.authorId || "";
        if (ownerUid && deletedUserSet && deletedUserSet.has(ownerUid)) return;
        // skip users marked deleted in users node
        try {
          if (ownerUid && usersSnap && usersSnap.child) {
            const u = usersSnap.child(ownerUid).val();
            if (u && (u.deleted === true || u.disabled === true || u.banned === true)) return;
          }
        } catch (_) {}

        const title = data.title || data.caption || data.name || data.text || "";
        const desc = data.description || data.desc || "";
        const tags = Array.isArray(data.hashtags)
          ? data.hashtags.join(" ")
          : Array.isArray(data.tags)
            ? data.tags.join(" ")
            : String(data.hashtags || data.tags || "");
        const uname = data.username || data.creatorName || data.displayName || data.userName || "";

        // Content-first score (title/caption/tags weighted higher than username)
        const titleScore = Math.max(matchScore(title, q), matchScore(desc, q), matchScore(tags, q));
        const userScore = matchScore(uname, q) * 0.55;
        const blob = textBlob(title, desc, tags);
        const blobScore = matchScore(blob, q);
        let score = Math.max(titleScore, blobScore, userScore);

        // Bonus for exact phrase in title
        if (normalize(title).includes(normalize(q))) score = Math.max(score, 0.88);

        if (requireMatch) {
          // Must meet threshold OR clear phrase hit in title/caption/tags
          const phraseHit =
            normalize(title).includes(normalize(q)) ||
            normalize(desc).includes(normalize(q)) ||
            normalize(tags).includes(normalize(q));
          if (score < CONFIG.minMatchRatio && !phraseHit) return;
          // Username-only weak matches: skip unless query looks like a handle
          if (titleScore < 0.3 && userScore >= CONFIG.minMatchRatio && q.length < 4) return;
        }

        bucket.push({ id, data, score, kind, related: !!requireMatch });
      };

      videosSnap.forEach((ch) => {
        const data = ch.val() || {};
        considerMedia(ch.key, data, videos, "video", true);
        considerMedia(ch.key, data, allVideos, "video", false);
      });
      shortsSnap.forEach((ch) => {
        const data = ch.val() || {};
        considerMedia(ch.key, data, shorts, "short", true);
        considerMedia(ch.key, data, allShorts, "short", false);
      });
      postsSnap.forEach((ch) => {
        const data = ch.val() || {};
        const type = String(data.type || data.contentType || "").toLowerCase();
        if (type === "video" || type === "long_video" || type === "long-video" || type === "long") {
          considerMedia(ch.key, data, videos, "video", true);
          considerMedia(ch.key, data, allVideos, "video", false);
        } else if (type === "short" || type === "shorts") {
          considerMedia(ch.key, data, shorts, "short", true);
          considerMedia(ch.key, data, allShorts, "short", false);
        } else {
          // skip carousel child fragments if parentId set
          if (data.parentPostId || data.isCarouselChild) return;
          considerMedia(ch.key, data, posts, "post", true);
          considerMedia(ch.key, data, allPosts, "post", false);
        }
      });

      // Dedupe by id + soft dedupe same uid+title
      function dedupeMedia(list) {
        const byId = {};
        const byFp = {};
        const out = [];
        list.sort((a, b) => b.score - a.score);
        list.forEach((row) => {
          if (byId[row.id]) return;
          const title = normalize(row.data.title || row.data.caption || row.data.name || "");
          const uid = row.data.uid || row.data.userId || row.data.ownerId || "";
          const fp = uid + "|" + title;
          if (title && byFp[fp]) return;
          byId[row.id] = true;
          if (title) byFp[fp] = true;
          out.push(row);
        });
        return out;
      }

      let relVideos = dedupeMedia(videos);
      let relShorts = dedupeMedia(shorts);
      let relPosts = dedupeMedia(posts);

      // Fill with random/popular when related is short
      function fillRandom(related, pool, limit) {
        if (related.length >= limit) return related.slice(0, limit);
        const have = new Set(related.map((r) => r.id));
        const rest = dedupeMedia(pool)
          .filter((r) => !have.has(r.id))
          .sort((a, b) => {
            const va = Number(a.data.views || a.data.viewsCount || a.data.likesCount || 0);
            const vb = Number(b.data.views || b.data.viewsCount || b.data.likesCount || 0);
            return vb - va;
          });
        // shuffle top portion lightly
        for (let i = rest.length - 1; i > 0; i--) {
          if (Math.random() > 0.5) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = rest[i];
            rest[i] = rest[j];
            rest[j] = t;
          }
        }
        const need = Math.min(CONFIG.maxRandomFill, limit - related.length);
        return related.concat(rest.slice(0, need));
      }

      relVideos = fillRandom(relVideos, allVideos, CONFIG.maxMedia);
      relShorts = fillRandom(relShorts, allShorts, CONFIG.maxMedia);
      relPosts = fillRandom(relPosts, allPosts, CONFIG.maxMedia);

      // If a user strongly matched: their 3–6 videos first, then their shorts/posts, then rest
      function ownerOf(row) {
        const d = row.data || {};
        return d.uid || d.userId || d.ownerId || d.authorId || "";
      }
      function prioritizeOwner(list, uid, maxOwn) {
        if (!uid) return list;
        const own = [];
        const rest = [];
        list.forEach(function (r) {
          if (ownerOf(r) === uid) own.push(r);
          else rest.push(r);
        });
        own.sort(function (a, b) {
          return (
            Number(b.data.views || b.data.viewsCount || 0) -
            Number(a.data.views || a.data.viewsCount || 0)
          );
        });
        return own.slice(0, maxOwn).concat(rest);
      }

      if (primaryUid) {
        relVideos = prioritizeOwner(relVideos, primaryUid, 6);
        relShorts = prioritizeOwner(relShorts, primaryUid, 8);
        relPosts = prioritizeOwner(relPosts, primaryUid, 6);
        // boost: also pull owner's content from pools even if weak text match
        function pullOwner(pool, into, kind, maxN) {
          const have = new Set(into.map(function (r) { return r.id; }));
          const extra = [];
          pool.forEach(function (r) {
            if (have.has(r.id)) return;
            if (ownerOf(r) !== primaryUid) return;
            if (!isValidMediaItem(r.data, kind)) return;
            extra.push(r);
          });
          extra.sort(function (a, b) {
            return (
              Number(b.data.views || b.data.viewsCount || 0) -
              Number(a.data.views || a.data.viewsCount || 0)
            );
          });
          return extra.slice(0, maxN).concat(into.filter(function (r) {
            return !extra.some(function (e) { return e.id === r.id; });
          }));
        }
        relVideos = pullOwner(allVideos, relVideos, "video", 6);
        relShorts = pullOwner(allShorts, relShorts, "short", 8);
        relPosts = pullOwner(allPosts, relPosts, "post", 4);
        // re-apply own-first order
        relVideos = prioritizeOwner(relVideos, primaryUid, 6);
        relShorts = prioritizeOwner(relShorts, primaryUid, 8);
        relPosts = prioritizeOwner(relPosts, primaryUid, 6);
      }

      // @username search: people first + their content (not empty)
      try { window.__searchUserMap = userMap; } catch (_) {}
      // enrich owner names on media
      function enrichOwner(list) {
        list.forEach(function (row) {
          const d = row.data || {};
          const uid = d.uid || d.userId || d.ownerId || d.authorId || "";
          if (!uid || !userMap[uid]) return;
          const u = userMap[uid] || {};
          // Prefer live user profile over stale post/video fields
          const uname =
            u.username || u.userName || u.handle || d.username || d.userName || "";
          const dname =
            u.displayName || u.name || u.fullName || d.displayName || d.creatorName || uname;
          d.username = uname;
          d.userName = uname;
          d.displayName = dname;
          d.creatorName = dname;
          d.profilePhoto =
            u.profilePhoto || u.photoURL || u.avatar || d.profilePhoto || d.photoURL || "";
          d.photoURL = d.profilePhoto;
          // ticks from user profile
          d.verified = u.verified === true || u.verified === "true" || d.verified;
          d.blueTick = u.blueTick || u.isVerified || u.creator || d.blueTick;
          d.redTick = u.redTick || u.vip || u.elite || d.redTick;
          d.whiteTick = u.whiteTick || u.monetized || u.monetization || d.whiteTick;
          d.vip = u.vip || d.vip;
          d.isCreator = u.isCreator || u.creator || d.isCreator;
          d.monetized = u.monetized || d.monetized;
          d.uid = uid;
          row.data = d;
        });
      }
      enrichOwner(relVideos);
      enrichOwner(relShorts);
      enrichOwner(relPosts);

      lastBundle = {
        users: topUsers,
        videos: relVideos,
        shorts: relShorts,
        posts: relPosts,
        primaryUid: primaryUid || null
      };
      renderBundle(lastBundle, raw);
    } catch (err) {
      console.error("Search error", err);
      if (myId === reqId) {
        showEmpty(raw);
        if (emptyText) emptyText.textContent = "Search failed. Try again.";
      }
    }
  }

  function renderBundle(bundle, query) {
    hideLoading();
    if (recentSection) recentSection.classList.add("hidden");
    if (trendingSection) trendingSection.classList.add("hidden");
    if (resultsSection) resultsSection.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");

    const tab = activeTab || "all";
    const users = tab === "all" || tab === "people" ? bundle.users || [] : [];
    const videos = tab === "all" || tab === "videos" ? bundle.videos || [] : [];
    const shorts = tab === "all" || tab === "shorts" ? bundle.shorts || [] : [];
    const posts = tab === "all" || tab === "posts" ? bundle.posts || [] : [];

    const total = users.length + videos.length + shorts.length + posts.length;
    if (resultCount) {
      resultCount.textContent =
        total + (total === 1 ? " result" : " results") + (query ? ' for "' + query + '"' : "");
    }

    if (!total) {
      showEmpty(query);
      return;
    }
    if (!resultsBody) return;

    let html = "";

    // People — only real matches
    if (users.length && (tab === "all" || tab === "people")) {
      html += '<div class="searchSectionLabel">People</div>';
      html +=
        '<div class="searchUsersGrid">' +
        users
          .slice(0, tab === "people" ? 30 : 8)
          .map(userCard)
          .join("") +
        "</div>";
    }

    function shortsGridHtml(list) {
      if (!list || !list.length) return "";
      return (
        '<div class="searchSectionHead"><div class="searchSectionLabel"><i class="fa-solid fa-circle-play" style="color:#ff304f;margin-right:6px;"></i>Shorts</div></div>' +
        '<div class="searchShortsGrid">' +
        list
          .map(function (row) {
            return mediaCard(row, "short");
          })
          .join("") +
        "</div>"
      );
    }

    // Shorts-only tab
    if (tab === "shorts") {
      html += shortsGridHtml(shorts.slice(0, 24));
    }

    // Interleave: videos + posts, insert 4-shorts grid every ~4 videos
    if (tab === "all") {
      html += '<div class="searchSectionLabel">Videos & posts</div>';
      html += '<div class="searchMixedFeed">';
      let vi = 0;
      let pi = 0;
      let si = 0;
      let sincePost = 0;
      let sinceShorts = 0;
      const vList = videos.slice();
      const pList = posts.slice();
      const sList = shorts.slice();
      let step = 3 + Math.floor(Math.random() * 2); // 3..4

      // first shorts row if any
      if (sList.length) {
        html += shortsGridHtml(sList.slice(si, si + 4));
        si += 4;
      }

      while (vi < vList.length || pi < pList.length) {
        let batch = 0;
        while (vi < vList.length && batch < step) {
          html += mediaCard(vList[vi], "video");
          vi++;
          batch++;
          sincePost++;
          sinceShorts++;
        }
        if (pi < pList.length && (sincePost >= step || sincePost >= 8 || vi >= vList.length)) {
          html += mediaCard(pList[pi], "post");
          pi++;
          sincePost = 0;
          step = 3 + Math.floor(Math.random() * 2);
        }
        // every ~4 videos → another 4 shorts
        if (si < sList.length && sinceShorts >= 4) {
          html += shortsGridHtml(sList.slice(si, si + 4));
          si += 4;
          sinceShorts = 0;
        }
        if (vi >= vList.length) {
          while (pi < pList.length) {
            html += mediaCard(pList[pi], "post");
            pi++;
          }
          break;
        }
        if (pi >= pList.length && vi >= vList.length) break;
        if (pi >= pList.length) {
          while (vi < vList.length) {
            html += mediaCard(vList[vi], "video");
            vi++;
            sinceShorts++;
            if (si < sList.length && sinceShorts >= 4) {
              html += shortsGridHtml(sList.slice(si, si + 4));
              si += 4;
              sinceShorts = 0;
            }
          }
          break;
        }
      }
      // remaining shorts
      while (si < sList.length) {
        html += shortsGridHtml(sList.slice(si, si + 4));
        si += 4;
      }
      html += "</div>";
    } else if (tab === "videos") {
      html += '<div class="searchSectionLabel">Videos</div>';
      html +=
        '<div class="searchMixedFeed">' +
        videos
          .map(function (row) {
            return mediaCard(row, "video");
          })
          .join("") +
        "</div>";
    } else if (tab === "posts") {
      html += '<div class="searchSectionLabel">Posts</div>';
      html +=
        '<div class="searchMixedFeed">' +
        posts
          .map(function (row) {
            return mediaCard(row, "post");
          })
          .join("") +
        "</div>";
    } else if (tab === "shorts") {
      // already rendered rail; if only shorts tab also show list
      if (!shorts.length) {
        /* empty handled above */
      }
    }

    resultsBody.innerHTML = html;
    hydrateSearchLikes();
  }

  function userCard(row) {
    const uid = row.uid;
    const user = row.user;
    const isStar = row.score >= 0.9;
    const followers = row.followers;
    const name = displayNameOf(user);
    const uname = usernameOf(user);
    const av = avatarOf(user);
    const badge = resolveBadge(user);
    const fc = followers != null ? followers : Number(user.followersCount || user.followers || 0) || 0;
    const initial = escapeHtml((name[0] || "V").toUpperCase());
    let avHtml;
    if (av) {
      avHtml =
        '<img class="user-avatar" src="' +
        escapeHtml(av) +
        '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'">' +
        '<div class="user-avatar-fallback" style="display:none">' +
        initial +
        "</div>";
    } else {
      avHtml = '<div class="user-avatar-fallback">' + initial + "</div>";
    }

    return (
      '<div class="user-card" data-uid="' +
      escapeHtml(uid) +
      '" role="button">' +
      avHtml +
      '<div class="user-meta"><div class="user-name-row"><span class="user-name">' +
      escapeHtml(name) + (isStar ? ' <span class="searchStar" title="Top match">★</span>' : '') +
      "</span>" +
      badge +
      "</div>" +
      (uname ? '<div class="user-handle">@' + escapeHtml(uname) + "</div>" : "") +
      '<div class="user-followers">' +
      formatCount(fc) +
      " followers</div></div></div>"
    );
  }

  function formatDuration(sec) {
    sec = Math.floor(Number(sec) || 0);
    if (sec <= 0) return "";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    return m + ":" + String(s).padStart(2, "0");
  }

  function formatDate(ts) {
    const n = Number(ts) || 0;
    if (!n) return "";
    try {
      const d = new Date(n);
      if (isNaN(d.getTime())) return "";
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
    } catch (_) {
      return "";
    }
  }

  function mediaCard(row, kind) {
    const id = row.id;
    const data = row.data || {};
    const title = String(
      data.title || data.caption || data.name || data.text || (kind === "post" ? "Post" : "Untitled")
    ).trim();
    const sub =
      data.username ||
      data.creatorName ||
      data.displayName ||
      data.userName ||
      data.name ||
      "Creator";
    const thumb =
      kind === "post"
        ? postMediaUrl(data) || thumbOf(data)
        : thumbOf(data) || postMediaUrl(data);
    const views = Number(data.views || data.viewsCount || data.viewCount || 0) || 0;
    const duration = formatDuration(
      data.duration || data.durationSec || data.length || data.videoDuration || 0
    );
    const when = formatDate(data.createdAt || data.timestamp || data.uploadedAt);

    if (kind === "post") {
      const mediaList = postMediaList(data);
      const avatar = safeUrl(
        data.profilePhoto || data.photoURL || data.avatar || data.userAvatar || data.dp || "",
        "assets/default-avatar.png"
      );
      const likes = Number(data.likesCount || data.likes || 0) || 0;
      const comments = Number(data.commentsCount || data.comments || data.commentCount || 0) || 0;
      const viewsN = Number(data.views || data.viewsCount || data.viewCount || 0) || 0;
      const uid = data.uid || data.userId || data.ownerId || "";
      const postName =
        data.username ||
        data.userName ||
        data.displayName ||
        data.creatorName ||
        sub ||
        "User";
      let tick = "";
      try {
        tick = resolveBadge(data) || "";
        if (!tick && window.VieworaBadges && VieworaBadges.resolve) {
          const r = VieworaBadges.resolve(data);
          tick = (r && r.html) ? r.html : "";
        }
      } catch (_) {}

      let mediaHtml = "";
      if (mediaList.length) {
        const imgs = mediaList
          .map(function (u, i) {
            return (
              '<img src="' +
              escapeHtml(u) +
              '" alt="" class="spImg" loading="' +
              (i === 0 ? "eager" : "lazy") +
              '" data-i="' +
              i +
              '"' +
              (i === 0 ? "" : ' style="display:none"') +
              ">"
            );
          })
          .join("");
        const nav =
          mediaList.length > 1
            ? '<button type="button" class="spPrev" aria-label="Prev">‹</button>' +
              '<button type="button" class="spNext" aria-label="Next">›</button>' +
              '<span class="spCount">1/' +
              mediaList.length +
              "</span>" +
              '<div class="spDots">' +
              mediaList
                .map(function (_, i) {
                  return '<span class="spDot' + (i === 0 ? " on" : "") + '" data-d="' + i + '"></span>';
                })
                .join("") +
              "</div>"
            : "";
        mediaHtml =
          '<div class="spMedia' +
          (mediaList.length > 1 ? " multi" : "") +
          '" data-count="' +
          mediaList.length +
          '">' +
          imgs +
          nav +
          "</div>";
      }

      return (
        '<article class="searchPostCard media-card homeLikePost" data-kind="post" data-id="' +
        escapeHtml(id) +
        '" data-uid="' +
        escapeHtml(uid) +
        '">' +
        '<div class="spHead">' +
        '<button type="button" class="spUser" data-uid="' +
        escapeHtml(uid) +
        '">' +
        '<img class="spAvatar" src="' +
        escapeHtml(avatar) +
        '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
        "<div><strong>" +
        escapeHtml(typeof postName !== "undefined" ? postName : sub) +
        (tick ? " " + tick : "") +
        "</strong></div></button></div>" +
        mediaHtml +
        (title
          ? '<p class="spCaption">' + escapeHtml(title.slice(0, 280)) + "</p>"
          : "") +
        '<div class="spActions">' +
        '<button type="button" class="spLike" data-id="' +
        escapeHtml(id) +
        '"><i class="fa-regular fa-heart"></i> <span>' +
        (likes || "") +
        "</span></button>" +
        '<button type="button" class="spComment" data-id="' +
        escapeHtml(id) +
        '"><i class="fa-regular fa-comment"></i> <span>' +
        (comments || "") +
        "</span></button>" +
        '<button type="button" class="spShare" data-id="' +
        escapeHtml(id) +
        '"><i class="fa-solid fa-share-nodes"></i></button>' +
        '<span class="spViews">' +
        ((typeof viewsN !== "undefined" ? viewsN : views)
          ? formatCount(typeof viewsN !== "undefined" ? viewsN : views) + " views"
          : "") +
        "</span>" +
        '<button type="button" class="spSave" data-id="' +
        escapeHtml(id) +
        '"><i class="fa-regular fa-bookmark"></i></button>' +
        "</div></article>"
      );
    }

    if (kind === "short") {
      return (
        '<article class="searchShortRailCard" data-kind="short" data-id="' +
        escapeHtml(id) +
        '" role="button">' +
        '<div class="searchShortRailThumb">' +
        (thumb
          ? '<img src="' + escapeHtml(thumb) + '" alt="" loading="lazy" onerror="this.style.opacity=0">'
          : '<div class="searchVideoPlaceholder"><i class="fa-solid fa-play"></i></div>') +
        '<span class="searchShortPlay"><i class="fa-solid fa-play"></i></span></div>' +
        '<div class="searchShortRailTitle">' +
        escapeHtml(title.slice(0, 52)) +
        (title.length > 52 ? "…" : "") +
        "</div>" +
        (views
          ? '<div class="searchShortRailViews">' + formatCount(views) + " views</div>"
          : "") +
        "</article>"
      );
    }

    // VIDEO — YouTube up-next list style
    let vTick = "";
    try {
      vTick = resolveBadge(data) || "";
      if (!vTick && window.VieworaBadges && VieworaBadges.resolve) {
        const r = VieworaBadges.resolve(data);
        if (r && r.html) vTick = r.html;
      }
    } catch (_) {}
    const vName =
      data.username ||
      data.userName ||
      data.displayName ||
      data.creatorName ||
      data.ownerName ||
      (sub && sub !== "Creator" ? sub : "") ||
      "Creator";
    return (
      '<article class="searchVideoRow media-card" data-kind="video" data-id="' +
      escapeHtml(id) +
      '" role="button">' +
      '<div class="searchVideoRowThumb">' +
      (thumb
        ? '<img src="' + escapeHtml(thumb) + '" alt="" loading="lazy">'
        : '<div class="searchVideoPlaceholder"><i class="fa-solid fa-play"></i></div>') +
      (duration ? '<span class="searchDur">' + escapeHtml(duration) + "</span>" : "") +
      "</div>" +
      '<div class="searchVideoRowMeta">' +
      '<div class="searchVideoRowTitle">' +
      escapeHtml(title.slice(0, 100)) +
      "</div>" +
      '<div class="searchVideoRowSub">' +
      escapeHtml(vName) +
      (vTick ? " " + vTick : "") +
      "</div>" +
      '<div class="searchVideoRowStats">' +
      (views ? formatCount(views) + " views" : "") +
      (views && when ? " · " : "") +
      (when ? escapeHtml(when) : "") +
      "</div></div></article>"
    );
  }

  function openProfile(uid) {
    if (!uid) return;
    location.href = "profile.html?uid=" + encodeURIComponent(uid);
  }


  async function hydrateSearchLikes() {
    if (!db) initFb();
    if (!db || !resultsBody) return;
    const btns = resultsBody.querySelectorAll(".spLike[data-id]");
    for (let i = 0; i < btns.length; i++) {
      const btn = btns[i];
      const id = btn.getAttribute("data-id");
      if (!id) continue;
      try {
        const postSnap = await db.ref("posts/" + id).once("value");
        const post = postSnap.val() || {};
        let count = Number(post.likesCount || post.likes || 0) || 0;
        if (!count && post.likedBy && typeof post.likedBy === "object") {
          count = Object.keys(post.likedBy).length;
        }
        const span = btn.querySelector("span");
        if (span) span.textContent = count ? String(count) : "";

        if (authUser) {
          const snap = await db.ref("posts/" + id + "/likedBy/" + authUser.uid).once("value");
          if (snap.exists()) {
            const icon = btn.querySelector("i");
            if (icon) {
              icon.className = "fa-solid fa-heart";
              icon.style.color = "#ff304f";
            }
          }
        }
      } catch (_) {}
    }
  }

  function openMedia(kind, id) {
    if (!id) return;
    // Remember search so back returns here
    try {
      const q = lastQuery || (searchInput && searchInput.value) || "";
      sessionStorage.setItem(
        "viewora_search_return",
        JSON.stringify({ q: q, tab: activeTab || "all", t: Date.now() })
      );
      if (q) {
        history.replaceState(
          { vieworaSearch: q },
          "",
          "search-page.html?q=" + encodeURIComponent(q)
        );
      }
    } catch (_) {}

    if (kind === "short") {
      location.href =
        "shorts.html?id=" +
        encodeURIComponent(id) +
        "&from=search&q=" +
        encodeURIComponent(lastQuery || "");
      return;
    }
    if (kind === "video") {
      location.href =
        "video.html?id=" +
        encodeURIComponent(id) +
        "&from=search&q=" +
        encodeURIComponent(lastQuery || "");
      return;
    }
    if (kind === "post") {
      // locked — no open
      return;
    }
  }


  function onInput() {
    updateClear();
    clearTimeout(timer);
    const q = searchInput ? searchInput.value.trim() : "";
    if (!q) {
      reqId++;
      showHome();
      return;
    }
    timer = setTimeout(() => runSearch(q, false), CONFIG.debounceMs);
  }

  function onSubmit(e) {
    if (e) e.preventDefault();
    const q = searchInput ? searchInput.value.trim() : "";
    clearTimeout(timer);
    runSearch(q, true);
    try {
      const url = new URL(location.href);
      if (q) url.searchParams.set("q", q);
      else url.searchParams.delete("q");
      history.replaceState({}, "", url);
    } catch (_) {}
  }

  function bind() {
    if (searchInput) {
      searchInput.addEventListener("input", onInput);
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") onSubmit(e);
      });
    }
    if (clearSearch) {
      clearSearch.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        updateClear();
        showHome();
        try {
          const url = new URL(location.href);
          url.searchParams.delete("q");
          history.replaceState({}, "", url);
        } catch (_) {}
        searchInput && searchInput.focus();
      });
    }
    const go = $("searchGo");
    if (go) go.addEventListener("click", onSubmit);
    const back = $("searchBack");
    if (back) {
      back.addEventListener("click", () => {
        if (history.length > 1) history.back();
        else location.href = "index.html";
      });
    }
    if (clearAllRecent) clearAllRecent.addEventListener("click", clearRecent);

    if (tabsBar) {
      tabsBar.querySelectorAll(".search-tab").forEach((btn) => {
        btn.addEventListener("click", () => setTab(btn.dataset.tab));
      });
    }

    if (resultsBody) {
      resultsBody.addEventListener("click", async (e) => {
        const userBtn = e.target.closest(".spUser, .user-card");
        if (userBtn && userBtn.getAttribute("data-uid")) {
          e.preventDefault();
          e.stopPropagation();
          openProfile(userBtn.getAttribute("data-uid"));
          return;
        }

        // carousel nav
        const prev = e.target.closest(".spPrev");
        const next = e.target.closest(".spNext");
        if (prev || next) {
          e.preventDefault();
          e.stopPropagation();
          const wrap = (prev || next).closest(".spMedia");
          if (wrap) stepCarousel(wrap, prev ? -1 : 1);
          return;
        }
        const dot = e.target.closest(".spDot");
        if (dot) {
          e.preventDefault();
          e.stopPropagation();
          const wrap = dot.closest(".spMedia");
          const i = Number(dot.getAttribute("data-d") || 0);
          if (wrap) goCarousel(wrap, i);
          return;
        }

        // like
        const likeBtn = e.target.closest(".spLike");
        if (likeBtn) {
          e.preventDefault();
          e.stopPropagation();
          await toggleSearchPostLike(likeBtn);
          return;
        }

        // comment sheet
        const cBtn = e.target.closest(".spComment");
        if (cBtn) {
          e.preventDefault();
          e.stopPropagation();
          const id = cBtn.getAttribute("data-id");
          if (id) openSearchCommentSheet(id);
          return;
        }

        // share with rate limit
        const sBtn = e.target.closest(".spShare");
        if (sBtn) {
          e.preventDefault();
          e.stopPropagation();
          const id = sBtn.getAttribute("data-id");
          if (id) await shareSearchPost(id);
          return;
        }

        if (e.target.closest(".spSave, .spActions, .spHead")) {
          e.stopPropagation();
          return;
        }

        const media = e.target.closest(".media-card, .searchShortRailCard");
        if (media) {
          const kind = media.getAttribute("data-kind");
          const id = media.getAttribute("data-id");
          // Post: stay on search (no navigation) — only actions work
          if (kind === "post") {
            return;
          }
          openMedia(kind, id);
        }
      });
    }

    function goCarousel(wrap, index) {
      const imgs = Array.from(wrap.querySelectorAll(".spImg"));
      if (!imgs.length) return;
      const n = imgs.length;
      let i = ((index % n) + n) % n;
      imgs.forEach(function (img, idx) {
        img.style.display = idx === i ? "block" : "none";
      });
      wrap.querySelectorAll(".spDot").forEach(function (d, idx) {
        d.classList.toggle("on", idx === i);
      });
      const count = wrap.querySelector(".spCount");
      if (count) count.textContent = i + 1 + "/" + n;
      wrap.dataset.i = String(i);
    }
    function stepCarousel(wrap, dir) {
      const cur = Number(wrap.dataset.i || 0);
      goCarousel(wrap, cur + dir);
    }

    function ensureAuth() {
      if (!db) initFb();
      if (!authUser && window.firebase && firebase.auth) {
        authUser = firebase.auth().currentUser;
      }
      return !!(db && authUser);
    }

    function rateKey(kind) {
      const day = new Date().toISOString().slice(0, 10);
      return "viewora_rl_" + kind + "_" + day + "_" + (authUser ? authUser.uid : "x");
    }
    function getRate(kind) {
      try {
        return Number(localStorage.getItem(rateKey(kind)) || 0) || 0;
      } catch (_) {
        return 0;
      }
    }
    function bumpRate(kind) {
      try {
        const n = getRate(kind) + 1;
        localStorage.setItem(rateKey(kind), String(n));
        return n;
      } catch (_) {
        return 0;
      }
    }
    function guidelineAlert(msg) {
      const text =
        msg ||
        "Community Guidelines: Please avoid excessive sharing or spam. Repeated abuse may suspend your account.";
      let modal = document.getElementById("vieworaGuidelineModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "vieworaGuidelineModal";
        modal.innerHTML =
          '<div class="vgBackdrop"></div>' +
          '<div class="vgCard">' +
          '<div class="vgIcon"><i class="fa-solid fa-shield-halved"></i></div>' +
          "<h3>Community Guidelines</h3>" +
          '<p class="vgText"></p>' +
          '<button type="button" class="vgOk">Got it</button></div>';
        document.body.appendChild(modal);
        let st = document.getElementById("vieworaGuidelineStyle");
        if (!st) {
          st = document.createElement("style");
          st.id = "vieworaGuidelineStyle";
          st.textContent =
            "#vieworaGuidelineModal{position:fixed;inset:0;z-index:400000;display:none;align-items:center;justify-content:center;padding:24px;}" +
            "#vieworaGuidelineModal.open{display:flex;}" +
            ".vgBackdrop{position:absolute;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);}" +
            ".vgCard{position:relative;z-index:1;width:100%;max-width:340px;background:linear-gradient(180deg,#1a1a24,#12121a);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:28px 22px 20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5);}" +
            ".vgIcon{width:56px;height:56px;margin:0 auto 14px;border-radius:50%;background:rgba(91,140,255,.15);display:grid;place-items:center;color:#7c9cff;font-size:24px;}" +
            ".vgCard h3{margin:0 0 10px;font-size:17px;color:#fff;}" +
            ".vgText{margin:0 0 20px;font-size:14px;line-height:1.5;color:rgba(255,255,255,.7);}" +
            ".vgOk{width:100%;border:0;border-radius:14px;padding:14px;background:linear-gradient(135deg,#5b8cff,#7c5cff);color:#fff;font-weight:700;font-size:15px;cursor:pointer;}";
          document.head.appendChild(st);
        }
        modal.querySelector(".vgBackdrop").onclick = function () {
          modal.classList.remove("open");
        };
        modal.querySelector(".vgOk").onclick = function () {
          modal.classList.remove("open");
        };
      }
      const p = modal.querySelector(".vgText");
      if (p) p.textContent = text;
      modal.classList.add("open");
    }

    async function toggleSearchPostLike(btn) {
      if (!ensureAuth()) {
        alert("Please login to like posts.");
        return;
      }
      const id = btn.getAttribute("data-id");
      if (!id) return;
      if (btn.dataset.busy === "1") return;

      const spamKey = "viewora_like_spam_" + authUser.uid + "_" + id;
      let spam = 0;
      try {
        spam = Number(sessionStorage.getItem(spamKey) || 0) || 0;
      } catch (_) {}
      if (spam >= 10) {
        guidelineAlert(
          "Community Guidelines: Please stop spamming likes. Repeated abuse may suspend your account."
        );
        return;
      }
      try {
        sessionStorage.setItem(spamKey, String(spam + 1));
      } catch (_) {}

      btn.dataset.busy = "1";
      const icon = btn.querySelector("i");
      const span = btn.querySelector("span");
      const prevCount = Number((span && span.textContent) || 0) || 0;
      const wasLiked = !!(icon && icon.classList.contains("fa-solid"));

      // instant UI
      const optimisticCount = Math.max(0, prevCount + (wasLiked ? -1 : 1));
      if (icon) {
        icon.className = wasLiked ? "fa-regular fa-heart" : "fa-solid fa-heart";
        icon.style.color = wasLiked ? "" : "#ff304f";
      }
      if (span) span.textContent = optimisticCount > 0 ? String(optimisticCount) : "";

      try {
        const postRef = db.ref("posts/" + id);
        const likeRef = db.ref("posts/" + id + "/likedBy/" + authUser.uid);
        const [postSnap, likeSnap] = await Promise.all([
          postRef.once("value"),
          likeRef.once("value")
        ]);
        const post = postSnap.val() || {};
        const currentlyLiked = likeSnap.exists();
        let base = Number(post.likesCount != null ? post.likesCount : post.likes) || 0;
        if (base < 0) base = 0;

        // If UI and server disagree on liked state, trust server for write
        let newCount;
        let nowLiked;
        if (currentlyLiked) {
          await likeRef.remove();
          newCount = Math.max(0, base - 1);
          nowLiked = false;
        } else {
          await likeRef.set({ at: Date.now(), uid: authUser.uid });
          newCount = base + 1;
          nowLiked = true;
        }
        await postRef.update({ likesCount: newCount, likes: newCount });

        if (icon) {
          icon.className = nowLiked ? "fa-solid fa-heart" : "fa-regular fa-heart";
          icon.style.color = nowLiked ? "#ff304f" : "";
        }
        if (span) span.textContent = newCount > 0 ? String(newCount) : "";
      } catch (err) {
        console.error("[search like]", err);
        // rollback UI
        if (icon) {
          icon.className = wasLiked ? "fa-solid fa-heart" : "fa-regular fa-heart";
          icon.style.color = wasLiked ? "#ff304f" : "";
        }
        if (span) span.textContent = prevCount > 0 ? String(prevCount) : "";
      } finally {
        btn.dataset.busy = "0";
      }
    }

    async function shareSearchPost(id) {
      if (!ensureAuth()) {
        // still allow share link without login
      }
      if (authUser) {
        const n = getRate("share");
        if (n >= 50) {
          guidelineAlert(
            "Community Guidelines: You can share up to 50 times per day. Please slow down to avoid spam."
          );
          return;
        }
        bumpRate("share");
      }
      const url =
        (location.origin || "") +
        "/post.html?id=" +
        encodeURIComponent(id || "");
      try {
        if (navigator.share) {
          await navigator.share({ title: "Viewora Post", url: url, text: "Check this on Viewora" });
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          alert("Link copied");
        } else {
          prompt("Copy link:", url);
        }
      } catch (err) {
        if (err && err.name === "AbortError") return;
        try {
          await navigator.clipboard.writeText(url);
          alert("Link copied");
        } catch (_) {
          prompt("Copy link:", url);
        }
      }
      // optional analytics
      try {
        if (db && id) {
          db.ref("posts/" + id + "/sharesCount").transaction(function (c) {
            return (c || 0) + 1;
          });
        }
      } catch (_) {}
    }

    function openSearchCommentSheet(postId) {
      if (!ensureAuth()) {
        alert("Please login to comment.");
        return;
      }
      // rate: max 10 top-level comments per day on search
      if (getRate("comment") >= 10) {
        guidelineAlert(
          "Community Guidelines: Max 10 comments per day from Search. Open the post for more."
        );
        return;
      }
      let sheet = document.getElementById("searchCommentSheet");
      if (!sheet) {
        sheet = document.createElement("div");
        sheet.id = "searchCommentSheet";
        sheet.innerHTML =
          '<div class="scsBackdrop"></div>' +
          '<div class="scsPanel">' +
          '<div class="scsHead"><strong>Comments</strong><button type="button" class="scsClose">✕</button></div>' +
          '<div class="scsList" id="scsList"><div class="scsEmpty">Loading…</div></div>' +
          '<div class="scsReplyHint" id="scsReplyHint"><span id="scsReplyLabel">Replying…</span><button type="button" id="scsReplyCancel">Cancel</button></div>' +
          '<div class="scsComposer">' +
          '<input type="text" id="scsInput" placeholder="Add a comment…" maxlength="500" autocomplete="off">' +
          '<button type="button" id="scsSend">Post</button></div></div>';
        document.body.appendChild(sheet);
        let st = document.getElementById("searchCommentSheetStyle");
        if (!st) {
          st = document.createElement("style");
          st.id = "searchCommentSheetStyle";
          document.head.appendChild(st);
        }
        st.textContent =
            "#searchCommentSheet{position:fixed;inset:0;z-index:300000;display:none;}" +
            "#searchCommentSheet.open{display:block;}" +
            ".scsBackdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);}" +
            ".scsPanel{position:absolute;left:0;right:0;bottom:0;height:85vh;max-height:85vh;background:#121218;border-radius:22px 22px 0 0;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.08);box-shadow:0 -8px 40px rgba(0,0,0,.5);}" +
            ".scsHead{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;}" +
            ".scsHead strong{font-size:16px;}" +
            ".scsClose{border:0;background:transparent;color:#fff;font-size:20px;padding:4px 8px;}" +
            ".scsList{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px;}" +
            ".scsItem{display:flex;gap:12px;margin-bottom:16px;}" +
            ".scsItem.reply{margin-left:44px;margin-bottom:12px;}" +
            ".scsItem img{width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#1a1a24;}" +
            ".scsItem .body{flex:1;min-width:0;}" +
            ".scsItem strong{font-size:13px;font-weight:700;}" +
            ".scsItem p{margin:4px 0 0;font-size:14px;line-height:1.45;color:rgba(255,255,255,.92);word-break:break-word;}" +
            ".scsActions{display:flex;gap:16px;margin-top:8px;align-items:center;}" +
            ".scsActions button{border:0;background:transparent;color:rgba(255,255,255,.55);font-size:12px;font-weight:600;padding:0;cursor:pointer;display:inline-flex;align-items:center;gap:4px;}" +
            ".scsActions button.liked{color:#ff304f;}" +
            ".scsActions button.liked i{font-weight:900;}" +
            ".scsEmpty{text-align:center;color:rgba(255,255,255,.45);padding:28px;}" +
            ".scsReplyHint{display:none;padding:6px 16px;font-size:12px;color:#8ab4ff;background:rgba(90,140,255,.12);}" +
            ".scsReplyHint.show{display:flex;justify-content:space-between;align-items:center;}" +
            ".scsComposer{display:flex;gap:10px;padding:14px 16px calc(18px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;align-items:center;background:#0e0e14;}" +
            ".scsComposer input{flex:1;border:0;border-radius:26px;padding:16px 20px;background:#1c1c24;color:#fff;font-size:16px;min-height:54px;box-sizing:border-box;outline:none;}" +
            ".scsComposer button{border:0;border-radius:24px;padding:14px 22px;background:linear-gradient(135deg,#5b8cff,#7c5cff);color:#fff;font-weight:700;font-size:15px;min-height:54px;}";
        sheet.querySelector(".scsBackdrop").onclick = closeSearchCommentSheet;
        sheet.querySelector(".scsClose").onclick = closeSearchCommentSheet;
        sheet.querySelector("#scsSend").onclick = function () {
          submitSearchComment();
        };
        sheet.querySelector("#scsInput").addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") submitSearchComment();
        });
        const cancelBtn = sheet.querySelector("#scsReplyCancel");
        if (cancelBtn) {
          cancelBtn.onclick = function () {
            sheet.dataset.replyTo = "";
            const hint = document.getElementById("scsReplyHint");
            if (hint) hint.classList.remove("show");
            const inp2 = document.getElementById("scsInput");
            if (inp2) inp2.placeholder = "Add a comment…";
          };
        }
      }
      // always refresh comment sheet styles (bigger box)
      try {
        let st = document.getElementById("searchCommentSheetStyle");
        if (!st) {
          st = document.createElement("style");
          st.id = "searchCommentSheetStyle";
          document.head.appendChild(st);
        }
        st.textContent =
          "#searchCommentSheet{position:fixed;inset:0;z-index:300000;display:none;}" +
          "#searchCommentSheet.open{display:block;}" +
          ".scsBackdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);}" +
          ".scsPanel{position:absolute;left:0;right:0;bottom:0;height:85vh;max-height:85vh;background:#121218;border-radius:22px 22px 0 0;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.08);}" +
          ".scsHead{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08);}" +
          ".scsClose{border:0;background:transparent;color:#fff;font-size:20px;}" +
          ".scsList{flex:1;overflow-y:auto;padding:14px 16px;}" +
          ".scsItem{display:flex;gap:12px;margin-bottom:16px;}" +
          ".scsItem.reply{margin-left:44px;}" +
          ".scsItem img{width:36px;height:36px;border-radius:50%;object-fit:cover;}" +
          ".scsItem strong{font-size:13px;font-weight:700;}" +
          ".scsItem p{margin:4px 0 0;font-size:14px;line-height:1.45;}" +
          ".scsActions{display:flex;gap:16px;margin-top:8px;}" +
          ".scsActions button{border:0;background:transparent;color:rgba(255,255,255,.55);font-size:12px;font-weight:600;}" +
          ".scsActions button.liked{color:#ff304f;}" +
          ".scsEmpty{text-align:center;color:rgba(255,255,255,.45);padding:28px;}" +
          ".scsReplyHint{display:none;padding:6px 16px;font-size:12px;color:#8ab4ff;}" +
          ".scsReplyHint.show{display:flex;justify-content:space-between;}" +
          ".scsComposer{display:flex;gap:10px;padding:14px 16px calc(18px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.08);align-items:center;background:#0e0e14;}" +
          ".scsComposer input{flex:1;border:0;border-radius:26px;padding:16px 20px;background:#1c1c24;color:#fff;font-size:16px;min-height:54px;}" +
          ".scsComposer button{border:0;border-radius:24px;padding:14px 22px;background:linear-gradient(135deg,#5b8cff,#7c5cff);color:#fff;font-weight:700;min-height:54px;}";
      } catch (_) {}

      sheet.dataset.postId = postId;
      sheet.classList.add("open");
      loadSearchComments(postId);
      setTimeout(function () {
        const inp = document.getElementById("scsInput");
        if (inp) inp.focus();
      }, 200);
    }

    function closeSearchCommentSheet() {
      const sheet = document.getElementById("searchCommentSheet");
      if (sheet) sheet.classList.remove("open");
    }

    async function loadSearchComments(postId) {
      const list = document.getElementById("scsList");
      if (!list || !db) return;
      list.innerHTML = '<div class="scsEmpty">Loading…</div>';
      try {
        const paths = ["comments/" + postId, "postComments/" + postId, "posts/" + postId + "/comments"];
        let items = [];
        let usedPath = paths[0];
        for (let i = 0; i < paths.length; i++) {
          try {
            const snap = await db.ref(paths[i]).once("value");
            if (!snap.exists()) continue;
            snap.forEach(function (ch) {
              const c = ch.val() || {};
              if (c.deleted) return;
              items.push({ id: ch.key, data: c, path: paths[i] });
            });
            if (items.length) {
              usedPath = paths[i];
              break;
            }
          } catch (_) {}
        }
        const sheet = document.getElementById("searchCommentSheet");
        if (sheet) sheet.dataset.commentsPath = usedPath;

        // resolve real usernames from users/{uid}
        const uidSet = {};
        items.forEach(function (row) {
          const uid = row.data.uid || row.data.userId || row.data.ownerId || "";
          if (uid) uidSet[uid] = true;
        });
        const uids = Object.keys(uidSet);
        for (let ui = 0; ui < uids.length; ui++) {
          try {
            const us = await db.ref("users/" + uids[ui]).once("value");
            if (!us.exists()) continue;
            const u = us.val() || {};
            const uname =
              u.username || u.userName || u.displayName || u.name || "";
            const photo = u.profilePhoto || u.photoURL || u.avatar || "";
            items.forEach(function (row) {
              const uid = row.data.uid || row.data.userId || row.data.ownerId || "";
              if (uid === uids[ui]) {
                if (uname) row.data._resolvedName = uname;
                if (photo) row.data._resolvedPhoto = photo;
              }
            });
          } catch (_) {}
        }

        // tree: parents + replies
        const roots = [];
        const children = {};
        items.forEach(function (row) {
          const pid = row.data.parentId || row.data.replyTo || null;
          if (pid) {
            if (!children[pid]) children[pid] = [];
            children[pid].push(row);
          } else {
            roots.push(row);
          }
        });
        roots.sort(function (a, b) {
          return (a.data.createdAt || a.data.timestamp || 0) - (b.data.createdAt || b.data.timestamp || 0);
        });

        if (!roots.length && !items.length) {
          list.innerHTML = '<div class="scsEmpty">No comments yet</div>';
          return;
        }

        function renderItem(row, isReply) {
          const c = row.data;
          const name =
            c._resolvedName ||
            c.username ||
            c.userName ||
            c.displayName ||
            c.name ||
            "User";
          const text = c.text || c.comment || c.message || "";
          const av =
            c._resolvedPhoto ||
            c.profilePhoto ||
            c.photoURL ||
            c.avatar ||
            "assets/default-avatar.png";
          const likes = Number(c.likesCount || c.likes || 0) || 0;
          const liked =
            authUser &&
            c.likedBy &&
            typeof c.likedBy === "object" &&
            c.likedBy[authUser.uid];
          return (
            '<div class="scsItem' +
            (isReply ? " reply" : "") +
            '" data-cid="' +
            escapeHtml(row.id) +
            '">' +
            '<img src="' +
            escapeHtml(av) +
            '" onerror="this.src=\'assets/default-avatar.png\'">' +
            '<div class="body"><strong>' +
            escapeHtml(name) +
            "</strong><p>" +
            escapeHtml(text) +
            '</p><div class="scsActions">' +
            '<button type="button" class="scsLike' +
            (liked ? " liked" : "") +
            '" data-cid="' +
            escapeHtml(row.id) +
            '"><i class="fa-' +
            (liked ? "solid" : "regular") +
            ' fa-heart"></i> <span>' +
            (likes || "") +
            "</span></button>" +
            (!isReply
              ? '<button type="button" class="scsReply" data-cid="' +
                escapeHtml(row.id) +
                '" data-name="' +
                escapeHtml(name) +
                '">Reply</button>'
              : "") +
            "</div></div></div>"
          );
        }

        let html = "";
        roots.forEach(function (row) {
          html += renderItem(row, false);
          const kids = children[row.id] || [];
          kids.sort(function (a, b) {
            return (a.data.createdAt || 0) - (b.data.createdAt || 0);
          });
          kids.forEach(function (k) {
            html += renderItem(k, true);
          });
        });
        // orphan replies
        items.forEach(function (row) {
          const pid = row.data.parentId || row.data.replyTo;
          if (pid && !roots.some(function (r) { return r.id === pid; })) {
            html += renderItem(row, true);
          }
        });

        list.innerHTML = html || '<div class="scsEmpty">No comments yet</div>';

        // bind like / reply
        list.querySelectorAll(".scsLike").forEach(function (btn) {
          btn.onclick = function (ev) {
            ev.preventDefault();
            toggleCommentLike(btn, postId);
          };
        });
        list.querySelectorAll(".scsReply").forEach(function (btn) {
          btn.onclick = function (ev) {
            ev.preventDefault();
            const cid = btn.getAttribute("data-cid");
            const name = btn.getAttribute("data-name") || "User";
            const sheet = document.getElementById("searchCommentSheet");
            if (sheet) sheet.dataset.replyTo = cid;
            const hint = document.getElementById("scsReplyHint");
            const label = document.getElementById("scsReplyLabel");
            if (hint) hint.classList.add("show");
            if (label) label.textContent = "Replying to @" + name;
            const inp = document.getElementById("scsInput");
            if (inp) {
              inp.placeholder = "Reply to @" + name + "…";
              inp.focus();
            }
          };
        });
      } catch (err) {
        console.error(err);
        list.innerHTML = '<div class="scsEmpty">Failed to load</div>';
      }
    }

    async function toggleCommentLike(btn, postId) {
      if (!ensureAuth()) {
        alert("Please login to like comments.");
        return;
      }
      const cid = btn.getAttribute("data-cid");
      if (!cid || btn.dataset.busy === "1") return;
      btn.dataset.busy = "1";
      const sheet = document.getElementById("searchCommentSheet");
      const base = (sheet && sheet.dataset.commentsPath) || "comments/" + postId;
      try {
        const ref = db.ref(base + "/" + cid + "/likedBy/" + authUser.uid);
        const snap = await ref.once("value");
        const was = snap.exists();
        if (was) await ref.remove();
        else await ref.set(true);
        let count = 0;
        try {
          const tree = await db.ref(base + "/" + cid + "/likedBy").once("value");
          if (tree.exists()) count = Object.keys(tree.val() || {}).length;
        } catch (_) {}
        await db.ref(base + "/" + cid).update({ likesCount: count, likes: count });
        const span = btn.querySelector("span");
        const icon = btn.querySelector("i");
        if (span) span.textContent = count ? String(count) : "";
        if (icon) icon.className = was ? "fa-regular fa-heart" : "fa-solid fa-heart";
        btn.classList.toggle("liked", !was);
      } catch (err) {
        console.error(err);
      } finally {
        btn.dataset.busy = "0";
      }
    }

    async function submitSearchComment() {
      if (!ensureAuth()) {
        alert("Please login to comment.");
        return;
      }
      if (getRate("comment") >= 10) {
        guidelineAlert("Community Guidelines: Max 10 comments per day from Search.");
        return;
      }
      const sheet = document.getElementById("searchCommentSheet");
      const inp = document.getElementById("scsInput");
      if (!sheet || !inp) return;
      const postId = sheet.dataset.postId;
      const replyTo = sheet.dataset.replyTo || null;
      const text = String(inp.value || "").trim();
      if (!text || !postId) return;
      if (inp.dataset.busy === "1") return;

      if (replyTo) {
        if (getRate("reply") >= 100) {
          guidelineAlert("Community Guidelines: Max 100 replies per day.");
          return;
        }
      } else if (getRate("comment") >= 10) {
        guidelineAlert("Community Guidelines: Max 10 comments per day from Search.");
        return;
      }

      inp.dataset.busy = "1";
      try {
        let uname = "User";
        let profilePhoto = "";
        try {
          const us = await db.ref("users/" + authUser.uid).once("value");
          const u = us.val() || {};
          uname = u.username || u.userName || u.displayName || u.name || uname;
          profilePhoto = u.profilePhoto || u.photoURL || u.avatar || "";
        } catch (_) {
          uname =
            authUser.displayName ||
            (authUser.email && authUser.email.split("@")[0]) ||
            "User";
        }
        const payload = {
          text: text,
          comment: text,
          uid: authUser.uid,
          userId: authUser.uid,
          username: uname,
          displayName: uname,
          profilePhoto: profilePhoto,
          createdAt: Date.now(),
          timestamp: Date.now(),
          parentId: replyTo || null,
          replyTo: replyTo || null
        };
        const path = sheet.dataset.commentsPath || "comments/" + postId;
        await db.ref(path).push(payload);
        try {
          await db.ref("posts/" + postId + "/commentsCount").transaction(function (c) {
            return (c || 0) + 1;
          });
        } catch (_) {}
        if (replyTo) bumpRate("reply");
        else bumpRate("comment");
        inp.value = "";
        sheet.dataset.replyTo = "";
        const hint = document.getElementById("scsReplyHint");
        if (hint) hint.classList.remove("show");
        inp.placeholder = "Add a comment…";
        const cardBtn = document.querySelector('.spComment[data-id="' + postId + '"] span');
        if (cardBtn) {
          const n = (Number(cardBtn.textContent) || 0) + 1;
          cardBtn.textContent = String(n);
        }
        await loadSearchComments(postId);
      } catch (err) {
        console.error("[search comment]", err);
        alert("Could not post comment.");
      } finally {
        inp.dataset.busy = "0";
      }
    }

    document.querySelectorAll("[data-trend]").forEach((el) => {
      el.addEventListener("click", () => {
        const q = el.getAttribute("data-trend");
        if (searchInput) searchInput.value = q;
        updateClear();
        runSearch(q, true);
      });
    });
  }

  function boot() {
    initFb();
    bind();
    updateClear();
    renderRecent();

    try {
      const params = new URLSearchParams(location.search);
      const q = params.get("q");
      if (q) {
        if (searchInput) searchInput.value = q;
        updateClear();
        runSearch(q, true);
        return;
      }
    } catch (_) {}

    showHome();
    if (searchInput) setTimeout(() => searchInput.focus(), 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.VieworaSearch = {
    go(q) {
      location.href = "search-page.html?q=" + encodeURIComponent(String(q || "").trim());
    },
    run: runSearch
  };
})();
