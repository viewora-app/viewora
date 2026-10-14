/**
 * Viewora — Banner Ads (live)
 * Shows a fixed or in-flow banner from ads/config/banner + ads/creatives (placement: banner|all).
 *
 * Usage:
 *   <script src="banner-ad.js"></script>
 *   VieworaBannerAds.mount('#bannerSlot'); // or auto
 *   VieworaBannerAds.autoMount(); // looks for #vieworaBannerAd / body top after header
 */
(function (global) {
  "use strict";

  const PATH_CONFIG = "ads/config/banner";
  const PATH_CREATIVES = "ads/creatives";
  const DEFAULTS = {
    enabled: true,
    position: "top", // top | bottom | inline
    rotateSeconds: 30,
    dismissible: true,
  };

  let cachedConfig = null;
  let cachedAds = [];
  let rotationIndex = 0;
  let rotateTimer = null;
  let currentRoot = null;

  function db() {
    if (global.db) return global.db;
    if (global.firebase && global.firebase.database) return global.firebase.database();
    return null;
  }

  function injectCSS() {
    if (document.getElementById("viewora-banner-ad-css")) return;
    const s = document.createElement("style");
    s.id = "viewora-banner-ad-css";
    s.textContent = `
.vieworaBannerAd {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: linear-gradient(90deg, #1a1330, #12101c);
  border-bottom: 1px solid rgba(168, 85, 247, 0.25);
  position: relative;
  z-index: 40;
}
.vieworaBannerAd.bottom {
  position: fixed; left: 0; right: 0; bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  border-bottom: 0; border-top: 1px solid rgba(168, 85, 247, 0.25);
  z-index: 90;
}
.vieworaBannerAd .vbaInner {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; max-width: 960px; margin: 0 auto;
}
.vieworaBannerAd .vbaThumb {
  width: 56px; height: 56px; border-radius: 10px; object-fit: cover;
  background: #2a2240; flex-shrink: 0;
}
.vieworaBannerAd .vbaText { flex: 1; min-width: 0; }
.vieworaBannerAd .vbaLabel {
  font-size: 10px; font-weight: 700; color: #c4b5fd; text-transform: uppercase;
  letter-spacing: 0.05em;
}
.vieworaBannerAd .vbaTitle {
  font-size: 14px; font-weight: 700; color: #f5f3ff; margin: 2px 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.vieworaBannerAd .vbaDesc {
  font-size: 12px; color: #9b95ad;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.vieworaBannerAd .vbaCta {
  flex-shrink: 0; padding: 8px 14px; border-radius: 999px; border: 0;
  background: #a855f7; color: #fff; font-weight: 700; font-size: 12px;
  text-decoration: none; cursor: pointer;
}
.vieworaBannerAd .vbaClose {
  position: absolute; top: 6px; right: 8px; width: 28px; height: 28px;
  border: 0; border-radius: 50%; background: rgba(0,0,0,0.4); color: #ccc;
  cursor: pointer; font-size: 12px;
}
@media (min-width: 768px) {
  .vieworaBannerAd.bottom { bottom: 0; left: 72px; }
}
@media (min-width: 1280px) {
  .vieworaBannerAd.bottom { left: 220px; }
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
          position: v.position === "bottom" || v.position === "inline" ? v.position : "top",
          rotateSeconds: Math.max(8, parseInt(v.rotateSeconds, 10) || DEFAULTS.rotateSeconds),
          dismissible: v.dismissible !== false,
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
          const p = String(a.placement || "banner").toLowerCase();
          if (p !== "banner" && p !== "all") return;
          if (a.active === false) return;
          list.push({
            id: child.key,
            title: a.title || "Sponsored",
            description: a.description || "",
            imageUrl: a.imageUrl || a.thumbnail || "",
            clickUrl: a.clickUrl || a.link || "#",
            cta: a.cta || "Open",
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
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderInto(root, ad, cfg) {
    injectCSS();
    root.className = "vieworaBannerAd" + (cfg.position === "bottom" ? " bottom" : "");
    root.innerHTML =
      (cfg.dismissible
        ? `<button type="button" class="vbaClose" aria-label="Close">&times;</button>`
        : "") +
      `<div class="vbaInner">` +
      (ad.imageUrl
        ? `<img class="vbaThumb" src="${escapeHtml(ad.imageUrl)}" alt="" onerror="this.style.display='none'">`
        : "") +
      `<div class="vbaText">` +
      `<div class="vbaLabel">Sponsored</div>` +
      `<div class="vbaTitle">${escapeHtml(ad.title)}</div>` +
      (ad.description ? `<div class="vbaDesc">${escapeHtml(ad.description)}</div>` : "") +
      `</div>` +
      `<a class="vbaCta" href="${escapeHtml(ad.clickUrl)}" target="_blank" rel="noopener sponsored nofollow">${escapeHtml(ad.cta)}</a>` +
      `</div>`;

    const close = root.querySelector(".vbaClose");
    if (close) {
      close.addEventListener("click", () => {
        root.remove();
        currentRoot = null;
        if (rotateTimer) clearInterval(rotateTimer);
      });
    }
    const cta = root.querySelector(".vbaCta");
    if (cta) cta.addEventListener("click", () => track(ad.id, "click"));
    track(ad.id, "impression");
  }

  async function mount(target) {
    await Promise.all([loadConfig(), loadAds()]);
    const cfg = cachedConfig || DEFAULTS;
    if (!cfg.enabled || !cachedAds.length) return null;

    let root =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!root) {
      root = document.createElement("div");
      root.id = "vieworaBannerAd";
      if (cfg.position === "bottom") {
        document.body.appendChild(root);
      } else {
        const header = document.querySelector("header, .topBar, .appHeader, .homeHeader");
        if (header && header.parentNode) {
          header.parentNode.insertBefore(root, header.nextSibling);
        } else {
          document.body.insertBefore(root, document.body.firstChild);
        }
      }
    }

    currentRoot = root;
    const show = () => {
      if (!cachedAds.length || !currentRoot) return;
      const ad = cachedAds[rotationIndex % cachedAds.length];
      rotationIndex += 1;
      renderInto(currentRoot, ad, cfg);
    };
    show();

    if (rotateTimer) clearInterval(rotateTimer);
    if (cachedAds.length > 1) {
      rotateTimer = setInterval(show, cfg.rotateSeconds * 1000);
    }
    return root;
  }

  function autoMount() {
    const run = () => mount("#vieworaBannerAd");
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  global.VieworaBannerAds = {
    mount,
    autoMount,
    loadConfig,
    loadAds,
    getConfig: () => cachedConfig || DEFAULTS,
  };
})(typeof window !== "undefined" ? window : this);
