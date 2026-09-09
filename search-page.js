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
    maxUsers: 30,
    maxMedia: 40,
    minMatchRatio: 0.4
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
    if (h.includes(q)) return 0.85;

    const qt = tokens(q);
    const ht = new Set(tokens(h));
    if (!qt.length) return 0;

    let hit = 0;
    qt.forEach((t) => {
      if (ht.has(t)) hit++;
      else {
        for (const x of ht) {
          if (x.includes(t) || t.includes(x)) {
            hit += 0.5;
            break;
          }
        }
      }
    });
    return hit / qt.length;
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
    return safeUrl(
      item.thumbnailUrl ||
        item.thumbnailURL ||
        item.thumbnail ||
        item.coverUrl ||
        item.cover ||
        item.imageUrl ||
        item.mediaUrl ||
        item.photoUrl,
      ""
    );
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

      const [usersSnap, videosSnap, shortsSnap, postsSnap] = await Promise.all([
        db.ref("users").once("value"),
        db.ref("videos").once("value"),
        db.ref("shorts").once("value"),
        db.ref("posts").once("value")
      ]);

      if (myId !== reqId) return;

      const users = [];
      const videos = [];
      const shorts = [];
      const posts = [];

      usersSnap.forEach((ch) => {
        const uid = ch.key;
        const user = ch.val() || {};
        if (!user || typeof user !== "object") return;
        if (authUser && uid === authUser.uid) return;

        const name = displayNameOf(user);
        const uname = usernameOf(user);
        const blob = textBlob(name, uname, user.bio, user.email);

        let score = Math.max(matchScore(name, q), matchScore(uname, q), matchScore(blob, q));
        if (normalize(uname) === normalize(q)) score = 1;

        const includes =
          normalize(uname).includes(normalize(q)) || normalize(name).includes(normalize(q));
        if (score < CONFIG.minMatchRatio && !includes) return;

        if (isAt && matchScore(uname, q) < 0.4 && !normalize(uname).includes(normalize(q))) {
          return;
        }

        users.push({ uid, user, score });
      });
      users.sort((a, b) => b.score - a.score);
      const topUsers = users.slice(0, CONFIG.maxUsers);

      await Promise.all(
        topUsers.slice(0, 15).map(async (row) => {
          row.followers = await realFollowers(row.uid, row.user);
        })
      );

      if (isAt) {
        lastBundle = { users: topUsers, videos: [], shorts: [], posts: [] };
        renderBundle(lastBundle, raw);
        return;
      }

      const considerMedia = (id, data, bucket, kind) => {
        if (!data || data.deleted === true || data.archived === true) return;
        const vis = String(data.visibility || "public").toLowerCase();
        if (vis === "private") return;

        const title = data.title || data.caption || data.name || "";
        const desc = data.description || data.desc || data.caption || "";
        const tags = data.hashtags || data.tags || "";
        const uname = data.username || data.creatorName || data.displayName || "";
        const blob = textBlob(title, desc, tags, uname, data.category);

        const score = Math.max(
          matchScore(title, q),
          matchScore(desc, q),
          matchScore(tags, q),
          matchScore(uname, q),
          matchScore(blob, q)
        );
        if (score < CONFIG.minMatchRatio && !normalize(blob).includes(normalize(q))) return;

        if ((kind === "video" || kind === "short") && !videoUrlOf(data) && !thumbOf(data)) return;

        bucket.push({ id, data, score, kind });
      };

      videosSnap.forEach((ch) => considerMedia(ch.key, ch.val() || {}, videos, "video"));
      shortsSnap.forEach((ch) => considerMedia(ch.key, ch.val() || {}, shorts, "short"));
      postsSnap.forEach((ch) => {
        const data = ch.val() || {};
        const type = String(data.type || "").toLowerCase();
        if (type === "video" || type === "long_video" || type === "long-video") {
          considerMedia(ch.key, data, videos, "video");
        } else if (type === "short" || type === "shorts") {
          considerMedia(ch.key, data, shorts, "short");
        } else {
          considerMedia(ch.key, data, posts, "post");
        }
      });

      videos.sort((a, b) => b.score - a.score);
      shorts.sort((a, b) => b.score - a.score);
      posts.sort((a, b) => b.score - a.score);

      lastBundle = {
        users: topUsers,
        videos: videos.slice(0, CONFIG.maxMedia),
        shorts: shorts.slice(0, CONFIG.maxMedia),
        posts: posts.slice(0, CONFIG.maxMedia)
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
    if (!bundle) {
      showEmpty(query);
      return;
    }

    const tab = activeTab;
    const users = tab === "all" || tab === "people" ? bundle.users : [];
    const videos = tab === "all" || tab === "videos" ? bundle.videos : [];
    const shorts = tab === "all" || tab === "shorts" ? bundle.shorts : [];
    const posts = tab === "all" || tab === "posts" ? bundle.posts : [];

    const total = users.length + videos.length + shorts.length + posts.length;
    if (!total) {
      showEmpty(query);
      return;
    }

    if (loadingState) loadingState.classList.add("hidden");
    if (emptyState) emptyState.classList.add("hidden");
    if (recentSection) recentSection.classList.add("hidden");
    if (trendingSection) trendingSection.classList.add("hidden");
    if (resultsSection) resultsSection.classList.remove("hidden");

    if (resultCount) resultCount.textContent = total + " result" + (total === 1 ? "" : "s");

    if (!resultsBody) return;
    let html = "";

    if (users.length) {
      html += '<div class="group-label">People</div>';
      html += users.map(userCard).join("");
    }
    if (videos.length) {
      html += '<div class="group-label">Videos</div><div class="media-grid">';
      html += videos.map((row) => mediaCard(row, "video")).join("");
      html += "</div>";
    }
    if (shorts.length) {
      html += '<div class="group-label">Shorts</div><div class="media-grid">';
      html += shorts.map((row) => mediaCard(row, "short")).join("");
      html += "</div>";
    }
    if (posts.length) {
      html += '<div class="group-label">Posts</div><div class="media-grid">';
      html += posts.map((row) => mediaCard(row, "post")).join("");
      html += "</div>";
    }

    resultsBody.innerHTML = html;
  }

  function userCard(row) {
    const uid = row.uid;
    const user = row.user;
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
      escapeHtml(name) +
      "</span>" +
      badge +
      "</div>" +
      (uname ? '<div class="user-handle">@' + escapeHtml(uname) + "</div>" : "") +
      '<div class="user-followers">' +
      formatCount(fc) +
      " followers</div></div></div>"
    );
  }

  function mediaCard(row, kind) {
    const id = row.id;
    const data = row.data;
    const title =
      data.title || data.caption || data.name || (kind === "post" ? "Post" : "Untitled");
    const sub = data.username || data.creatorName || data.displayName || "Creator";
    const thumb = thumbOf(data);
    const typeLabel = kind === "short" ? "Short" : kind === "post" ? "Post" : "Video";
    const thumbClass = kind === "short" ? "media-thumb short" : "media-thumb";
    const icon = kind === "post" ? "image" : "play";
    const thumbHtml = thumb
      ? '<img class="' + thumbClass + '" src="' + escapeHtml(thumb) + '" alt="">'
      : '<div class="' +
        thumbClass +
        '" style="display:grid;place-items:center;color:var(--muted)"><i class="fa-solid fa-' +
        icon +
        '"></i></div>';

    return (
      '<div class="media-card" data-kind="' +
      kind +
      '" data-id="' +
      escapeHtml(id) +
      '" role="button">' +
      thumbHtml +
      '<div class="media-info"><span class="media-type">' +
      typeLabel +
      '</span><div class="media-title">' +
      escapeHtml(title) +
      '</div><div class="media-sub">' +
      escapeHtml(sub) +
      "</div></div></div>"
    );
  }

  function openProfile(uid) {
    if (!uid) return;
    location.href = "profile.html?uid=" + encodeURIComponent(uid);
  }

  function openMedia(kind, id) {
    if (!id) return;
    if (kind === "short") location.href = "shorts.html?id=" + encodeURIComponent(id);
    else if (kind === "post") location.href = "post.html?id=" + encodeURIComponent(id);
    else location.href = "video.html?id=" + encodeURIComponent(id);
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
      resultsBody.addEventListener("click", (e) => {
        const user = e.target.closest(".user-card");
        if (user) {
          openProfile(user.getAttribute("data-uid"));
          return;
        }
        const media = e.target.closest(".media-card");
        if (media) {
          openMedia(media.getAttribute("data-kind"), media.getAttribute("data-id"));
        }
      });
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
