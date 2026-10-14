/**
 * Viewora — Shorts Sponsored Ads (live)
 * Inserts a full-screen ad card every N shorts (ads/config/shorts + creatives placement shorts|all).
 *
 * Usage (shorts.html after shorts.js):
 *   <script src="shorts-ad.js"></script>
 *   VieworaShortsAds.injectContainer('#shortsContainer');
 * Hooks loadShorts render automatically if VieworaShorts exists.
 */
(function (global) {
  "use strict";

  const PATH_CONFIG = "ads/config/shorts";
  const PATH_CREATIVES = "ads/creatives";
  const DEFAULTS = {
    enabled: true,
    frequency: 4,
    startAfter: 1,
    maxPerSession: 6,
  };

  let cachedConfig = null;
  let cachedAds = [];
  let rotationIndex = 0;
  let sessionShown = 0;

  function db() {
    if (global.db) return global.db;
    if (global.firebase && global.firebase.database) return global.firebase.database();
    return null;
  }

  function injectCSS() {
    if (document.getElementById("viewora-shorts-ad-css")) return;
    const s = document.createElement("style");
    s.id = "viewora-shorts-ad-css";
    s.textContent = `
.shortCard.vieworaShortAd {
  background: #0a0612;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
}
.vieworaShortAd .vsaMedia {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; background: #120c1c;
}
.vieworaShortAd .vsaOverlay {
  position: absolute; inset: 0;
  background: linear-gradient(transparent 40%, rgba(0,0,0,0.85) 100%);
  pointer-events: none;
}
.vieworaShortAd .vsaBadge {
  position: absolute; top: 56px; left: 14px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: #e9d5ff;
  background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 8px;
  backdrop-filter: blur(8px); z-index: 3;
}
.vieworaShortAd .vsaBody {
  position: relative; z-index: 2; padding: 20px 16px 48px;
}
.vieworaShortAd .vsaTitle {
  font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 6px;
}
.vieworaShortAd .vsaDesc {
  font-size: 14px; color: #d4d0e0; margin: 0 0 16px; line-height: 1.4;
}
.vieworaShortAd .vsaCta {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 20px; border-radius: 999px; border: 0;
  background: linear-gradient(135deg, #a855f7, #6d28d9);
  color: #fff; font-weight: 800; font-size: 14px;
  text-decoration: none; cursor: pointer;
}
.vieworaShortAd .vsaSkip {
  position: absolute; top: 56px; right: 14px; z-index: 3;
  padding: 8px 12px; border-radius: 999px; border: 0;
  background: rgba(0,0,0,0.55); color: #eee; font-size: 12px;
  font-weight: 600; cursor: pointer; backdrop-filter: blur(8px);
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
          const p = String(a.placement || "").toLowerCase();
          if (p !== "shorts" && p !== "all") return;
          if (a.active === false) return;
          list.push({
            id: child.key,
            title: a.title || "Sponsored",
            description: a.description || "",
            imageUrl: a.imageUrl || a.thumbnail || "",
            videoUrl: a.videoUrl || "",
            clickUrl: a.clickUrl || a.link || "#",
            cta: a.cta || "Learn more",
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
    try {
      rdb
        .ref(PATH_CREATIVES + "/" + adId + "/" + (event === "click" ? "clicks" : "impressions"))
        .transaction((n) => (typeof n === "number" ? n + 1 : 1));
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildAdCard(ad) {
    injectCSS();
    const card = document.createElement("div");
    card.className = "shortCard vieworaShortAd";
    card.dataset.adId = ad.id;
    card.dataset.sponsored = "1";

    const mediaTag = ad.videoUrl
      ? `<video class="vsaMedia" src="${escapeHtml(ad.videoUrl)}" muted loop playsinline poster="${escapeHtml(ad.imageUrl || "")}"></video>`
      : ad.imageUrl
        ? `<img class="vsaMedia" src="${escapeHtml(ad.imageUrl)}" alt="">`
        : `<div class="vsaMedia"></div>`;

    card.innerHTML =
      mediaTag +
      `<div class="vsaOverlay"></div>` +
      `<span class="vsaBadge">Sponsored</span>` +
      `<button type="button" class="vsaSkip">Skip</button>` +
      `<div class="vsaBody">` +
      `<h3 class="vsaTitle">${escapeHtml(ad.title)}</h3>` +
      (ad.description ? `<p class="vsaDesc">${escapeHtml(ad.description)}</p>` : "") +
      `<a class="vsaCta" href="${escapeHtml(ad.clickUrl)}" target="_blank" rel="noopener sponsored nofollow">${escapeHtml(ad.cta)}</a>` +
      `</div>`;

    card.querySelector(".vsaCta")?.addEventListener("click", () => track(ad.id, "click"));
    card.querySelector(".vsaSkip")?.addEventListener("click", () => {
      // scroll to next card if container supports scroll-snap
      const next = card.nextElementSibling;
      if (next) next.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    if ("IntersectionObserver" in global) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              track(ad.id, "impression");
              const v = card.querySelector("video");
              if (v) {
                try {
                  v.play();
                } catch (_) {}
              }
              io.disconnect();
            } else {
              const v = card.querySelector("video");
              if (v) v.pause();
            }
          });
        },
        { threshold: 0.55 }
      );
      io.observe(card);
    } else {
      track(ad.id, "impression");
    }

    return card;
  }

  /**
   * After short cards are in the container, insert ad cards by frequency.
   */
  async function injectContainer(container) {
    const root =
      typeof container === "string" ? document.querySelector(container) : container;
    if (!root) return 0;

    await Promise.all([loadConfig(), loadAds()]);
    const cfg = cachedConfig || DEFAULTS;
    if (!cfg.enabled || !cachedAds.length) return 0;

    // clear previous ads
    root.querySelectorAll(".vieworaShortAd").forEach((n) => n.remove());

    const shorts = Array.from(root.querySelectorAll(".shortCard")).filter(
      (c) => !c.classList.contains("vieworaShortAd")
    );
    if (!shorts.length) return 0;

    let inserted = 0;
    let count = 0;
    for (let i = 0; i < shorts.length; i++) {
      count += 1;
      if (i + 1 <= cfg.startAfter) continue;
      if (count < cfg.frequency) continue;
      if (sessionShown >= cfg.maxPerSession) break;

      const ad = cachedAds[rotationIndex % cachedAds.length];
      rotationIndex += 1;
      const card = buildAdCard(ad);
      const node = shorts[i];
      if (node.nextSibling) node.parentNode.insertBefore(card, node.nextSibling);
      else node.parentNode.appendChild(card);

      sessionShown += 1;
      inserted += 1;
      count = 0;
    }
    return inserted;
  }

  function autoHook() {
    const run = () => injectContainer("#shortsContainer, .shortsContainer");
    // Observe container for re-renders from loadShorts
    const boot = () => {
      run();
      const c = document.querySelector("#shortsContainer, .shortsContainer");
      if (!c) return;
      const mo = new MutationObserver(() => {
        clearTimeout(autoHook._t);
        autoHook._t = setTimeout(run, 500);
      });
      mo.observe(c, { childList: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  global.VieworaShortsAds = {
    injectContainer,
    autoHook,
    loadConfig,
    loadAds,
    getConfig: () => cachedConfig || DEFAULTS,
  };

  autoHook();
})(typeof window !== "undefined" ? window : this);
