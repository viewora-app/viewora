/**
 * Viewora — Feed Sponsored Ads (live)
 * Inserts sponsored cards between posts based on ads/config + ads/creatives.
 *
 * Usage (index.html):
 *   <script src="feed-ad.js"></script>
 * After posts are rendered:
 *   VieworaFeedAds.inject(containerElement);
 * Or auto-hook:
 *   VieworaFeedAds.autoHook('#postsContainer, .postsFeed, #allPosts, #postFeed');
 */
(function (global) {
  "use strict";

  const PATH_CONFIG = "ads/config/feed";
  const PATH_CREATIVES = "ads/creatives";
  const DEFAULTS = {
    enabled: true,
    frequency: 5, // every N posts
    startAfter: 2,
    maxPerSession: 8,
  };

  let cachedConfig = null;
  let cachedAds = [];
  let sessionShown = 0;
  let rotationIndex = 0;
  let unsubConfig = null;
  let unsubAds = null;

  function db() {
    if (global.db) return global.db;
    if (global.firebase && global.firebase.database) return global.firebase.database();
    return null;
  }

  function injectCSS() {
    if (document.getElementById("viewora-feed-ad-css")) return;
    const s = document.createElement("style");
    s.id = "viewora-feed-ad-css";
    s.textContent = `
.vieworaFeedAd {
  margin: 14px 0;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(160deg, #16122a 0%, #0d0b16 100%);
  border: 1px solid rgba(168, 85, 247, 0.28);
  box-shadow: 0 8px 28px rgba(0,0,0,0.35);
  position: relative;
}
.vieworaFeedAd .vfaLabel {
  position: absolute; top: 10px; left: 10px; z-index: 2;
  font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: #c4b5fd;
  background: rgba(0,0,0,0.55); padding: 4px 8px; border-radius: 6px;
  backdrop-filter: blur(8px);
}
.vieworaFeedAd .vfaMedia {
  width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block;
  background: #1a1528;
}
.vieworaFeedAd .vfaBody { padding: 12px 14px 14px; }
.vieworaFeedAd .vfaTitle {
  font-size: 15px; font-weight: 700; color: #f5f3ff; margin: 0 0 4px;
  line-height: 1.3;
}
.vieworaFeedAd .vfaDesc {
  font-size: 13px; color: #a5a0b8; margin: 0 0 12px; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.vieworaFeedAd .vfaCta {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: 999px; border: 0;
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #fff; font-weight: 700; font-size: 13px; cursor: pointer;
  text-decoration: none;
}
.vieworaFeedAd .vfaCta:active { transform: scale(0.98); }
.vieworaFeedAd .vfaSponsor {
  font-size: 11px; color: #8b849c; margin-top: 8px;
}
`;
    document.head.appendChild(s);
  }

  function loadConfig() {
    const rdb = db();
    if (!rdb) return Promise.resolve({ ...DEFAULTS });
    return rdb
      .ref(PATH_CONFIG)
      .once("value")
      .then((snap) => {
        const v = snap.val() || {};
        cachedConfig = {
          enabled: v.enabled !== false,
          frequency: Math.max(2, parseInt(v.frequency, 10) || DEFAULTS.frequency),
          startAfter: Math.max(0, parseInt(v.startAfter, 10) || DEFAULTS.startAfter),
          maxPerSession: Math.max(1, parseInt(v.maxPerSession, 10) || DEFAULTS.maxPerSession),
        };
        return cachedConfig;
      })
      .catch(() => {
        cachedConfig = { ...DEFAULTS };
        return cachedConfig;
      });
  }

  function loadAds() {
    const rdb = db();
    if (!rdb) return Promise.resolve([]);
    return rdb
      .ref(PATH_CREATIVES)
      .orderByChild("active")
      .equalTo(true)
      .once("value")
      .then((snap) => {
        const list = [];
        snap.forEach((child) => {
          const a = child.val() || {};
          const placement = String(a.placement || "feed").toLowerCase();
          if (placement !== "feed" && placement !== "all") return;
          if (a.active === false) return;
          list.push({
            id: child.key,
            title: a.title || "Sponsored",
            description: a.description || a.desc || "",
            imageUrl: a.imageUrl || a.thumbnail || a.mediaUrl || "",
            videoUrl: a.videoUrl || "",
            clickUrl: a.clickUrl || a.link || a.url || "#",
            cta: a.cta || "Learn more",
            sponsor: a.sponsor || a.advertiser || "Sponsored",
            priority: Number(a.priority) || 0,
          });
        });
        list.sort((x, y) => y.priority - x.priority);
        cachedAds = list;
        return list;
      })
      .catch(() => {
        cachedAds = [];
        return [];
      });
  }

  function track(adId, event) {
    const rdb = db();
    if (!rdb || !adId) return;
    const path = PATH_CREATIVES + "/" + adId + "/" + (event === "click" ? "clicks" : "impressions");
    try {
      rdb.ref(path).transaction((n) => (typeof n === "number" ? n + 1 : 1));
    } catch (_) {}
    try {
      rdb.ref("ads/events").push({
        adId,
        event: event === "click" ? "click" : "impression",
        placement: "feed",
        at: Date.now(),
        uid: (global.auth && global.auth.currentUser && global.auth.currentUser.uid) || null,
      });
    } catch (_) {}
  }

  function pickAd() {
    if (!cachedAds.length) return null;
    const ad = cachedAds[rotationIndex % cachedAds.length];
    rotationIndex += 1;
    return ad;
  }

  function buildCard(ad) {
    injectCSS();
    const el = document.createElement("article");
    el.className = "vieworaFeedAd";
    el.dataset.adId = ad.id;
    el.setAttribute("data-sponsored", "1");

    const media =
      ad.imageUrl
        ? `<img class="vfaMedia" src="${escapeAttr(ad.imageUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="vfaMedia" style="display:flex;align-items:center;justify-content:center;color:#7c3aed;font-size:28px"><i class="fa-solid fa-bullhorn"></i></div>`;

    el.innerHTML =
      `<span class="vfaLabel">Sponsored</span>` +
      media +
      `<div class="vfaBody">` +
      `<h3 class="vfaTitle">${escapeHtml(ad.title)}</h3>` +
      (ad.description ? `<p class="vfaDesc">${escapeHtml(ad.description)}</p>` : "") +
      `<a class="vfaCta" href="${escapeAttr(ad.clickUrl)}" target="_blank" rel="noopener sponsored nofollow">${escapeHtml(ad.cta)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` +
      `<div class="vfaSponsor">${escapeHtml(ad.sponsor)}</div>` +
      `</div>`;

    const cta = el.querySelector(".vfaCta");
    if (cta) {
      cta.addEventListener("click", () => track(ad.id, "click"));
    }

    // impression when in viewport
    if ("IntersectionObserver" in global) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              track(ad.id, "impression");
              io.disconnect();
            }
          });
        },
        { threshold: 0.5 }
      );
      io.observe(el);
    } else {
      track(ad.id, "impression");
    }

    return el;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  /**
   * Inject sponsored cards into a container of post cards.
   * @param {HTMLElement|string} container
   * @param {object} [opts]
   */
  async function inject(container, opts) {
    const root =
      typeof container === "string" ? document.querySelector(container) : container;
    if (!root) return 0;

    await Promise.all([loadConfig(), loadAds()]);
    const cfg = cachedConfig || DEFAULTS;
    if (!cfg.enabled || !cachedAds.length) return 0;

    // Remove previous feed ads to avoid duplicates on re-render
    root.querySelectorAll(".vieworaFeedAd").forEach((n) => n.remove());

    const posts = Array.from(
      root.querySelectorAll(
        ".vieworaPostCard, .postCard, article[data-post-id], .feedPost"
      )
    ).filter((n) => !n.classList.contains("vieworaFeedAd"));

    if (!posts.length) return 0;

    let inserted = 0;
    let sinceLast = 0;

    for (let i = 0; i < posts.length; i++) {
      sinceLast += 1;
      const shouldInsert =
        i + 1 > cfg.startAfter &&
        sinceLast >= cfg.frequency &&
        sessionShown < cfg.maxPerSession;

      if (!shouldInsert) continue;

      const ad = pickAd();
      if (!ad) break;

      const card = buildCard(ad);
      const post = posts[i];
      if (post.nextSibling) {
        post.parentNode.insertBefore(card, post.nextSibling);
      } else {
        post.parentNode.appendChild(card);
      }
      sessionShown += 1;
      inserted += 1;
      sinceLast = 0;
    }

    return inserted;
  }

  function autoHook(selector) {
    const tryInject = () => {
      const el = document.querySelector(selector || "#postsContainer, .postsFeed, #allPosts");
      if (el) inject(el);
    };
    // MutationObserver for feed re-renders
    const obs = new MutationObserver(() => {
      clearTimeout(autoHook._t);
      autoHook._t = setTimeout(tryInject, 400);
    });
    const boot = () => {
      tryInject();
      const root = document.body;
      if (root) obs.observe(root, { childList: true, subtree: true });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  function subscribeLive() {
    const rdb = db();
    if (!rdb) return;
    if (unsubConfig) try { unsubConfig(); } catch (_) {}
    if (unsubAds) try { unsubAds(); } catch (_) {}
    unsubConfig = rdb.ref(PATH_CONFIG).on("value", (snap) => {
      const v = snap.val() || {};
      cachedConfig = {
        enabled: v.enabled !== false,
        frequency: Math.max(2, parseInt(v.frequency, 10) || DEFAULTS.frequency),
        startAfter: Math.max(0, parseInt(v.startAfter, 10) || DEFAULTS.startAfter),
        maxPerSession: Math.max(1, parseInt(v.maxPerSession, 10) || DEFAULTS.maxPerSession),
      };
    });
    unsubAds = rdb.ref(PATH_CREATIVES).on("value", () => loadAds());
  }

  global.VieworaFeedAds = {
    inject,
    autoHook,
    loadConfig,
    loadAds,
    subscribeLive,
    getConfig: () => cachedConfig || DEFAULTS,
  };

  // Live config
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", subscribeLive);
  } else {
    subscribeLive();
  }
})(typeof window !== "undefined" ? window : this);
