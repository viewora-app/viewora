/**
 * Viewora — Long Video Sponsored Ads (live)
 * - Companion sponsored card beside / under the player
 * - Hooks for real pre-roll / mid-roll ad-serving (IMA / custom VAST-ready)
 *
 * Usage (video.html):
 *   <script src="video-ad.js"></script>
 *   VieworaVideoAds.mountCompanion('#videoAdSlot');
 *   VieworaVideoAds.attachPlayer(videoElement, { midRollAt: 0.5 });
 */
(function (global) {
  "use strict";

  const PATH_CONFIG = "ads/config/video";
  const PATH_CREATIVES = "ads/creatives";
  const DEFAULTS = {
    enabled: true,
    companion: true,
    preRoll: false, // enable when real ad network / VAST URL configured
    midRoll: false,
    midRollPercent: 50,
    skipAfterSeconds: 5,
  };

  let cachedConfig = null;
  let cachedAds = [];
  let rotationIndex = 0;

  function db() {
    if (global.db) return global.db;
    if (global.firebase && global.firebase.database) return global.firebase.database();
    return null;
  }

  function injectCSS() {
    if (document.getElementById("viewora-video-ad-css")) return;
    const s = document.createElement("style");
    s.id = "viewora-video-ad-css";
    s.textContent = `
.vieworaVideoCompanion {
  margin: 12px 0 16px;
  border-radius: 14px;
  overflow: hidden;
  background: #14101f;
  border: 1px solid rgba(168, 85, 247, 0.3);
  display: flex; gap: 12px; align-items: stretch;
}
.vieworaVideoCompanion img {
  width: 120px; min-height: 72px; object-fit: cover; flex-shrink: 0;
  background: #1e1830;
}
.vieworaVideoCompanion .vvcBody { padding: 10px 12px 12px; flex: 1; min-width: 0; }
.vieworaVideoCompanion .vvcLabel {
  font-size: 10px; font-weight: 700; color: #c4b5fd; text-transform: uppercase;
}
.vieworaVideoCompanion .vvcTitle {
  font-size: 14px; font-weight: 700; color: #f3f0ff; margin: 4px 0;
}
.vieworaVideoCompanion .vvcDesc {
  font-size: 12px; color: #9b95ad; margin: 0 0 8px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.vieworaVideoCompanion .vvcCta {
  display: inline-block; padding: 8px 14px; border-radius: 999px;
  background: #a855f7; color: #fff; font-size: 12px; font-weight: 700;
  text-decoration: none;
}
.vieworaVideoPreroll {
  position: absolute; inset: 0; z-index: 20;
  background: #000; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
.vieworaVideoPreroll video { max-width: 100%; max-height: 100%; }
.vieworaVideoPreroll .vvpSkip {
  position: absolute; bottom: 20px; right: 16px;
  padding: 8px 14px; border-radius: 8px; border: 0;
  background: rgba(0,0,0,0.7); color: #fff; font-weight: 600; cursor: pointer;
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
          companion: v.companion !== false,
          preRoll: v.preRoll === true,
          midRoll: v.midRoll === true,
          midRollPercent: Math.min(90, Math.max(10, parseInt(v.midRollPercent, 10) || 50)),
          skipAfterSeconds: Math.max(0, parseInt(v.skipAfterSeconds, 10) || 5),
          vastUrl: v.vastUrl || "", // for future IMA / VAST integration
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
          if (p !== "video" && p !== "all") return;
          if (a.active === false) return;
          list.push({
            id: child.key,
            title: a.title || "Sponsored",
            description: a.description || "",
            imageUrl: a.imageUrl || a.thumbnail || "",
            videoUrl: a.videoUrl || "",
            clickUrl: a.clickUrl || a.link || "#",
            cta: a.cta || "Visit",
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

  function pickAd() {
    if (!cachedAds.length) return null;
    const ad = cachedAds[rotationIndex % cachedAds.length];
    rotationIndex += 1;
    return ad;
  }

  async function mountCompanion(target) {
    await Promise.all([loadConfig(), loadAds()]);
    const cfg = cachedConfig || DEFAULTS;
    if (!cfg.enabled || !cfg.companion || !cachedAds.length) return null;

    const ad = pickAd();
    if (!ad) return null;

    injectCSS();
    let root = typeof target === "string" ? document.querySelector(target) : target;
    if (!root) {
      root = document.createElement("div");
      root.id = "vieworaVideoAdSlot";
      const player =
        document.querySelector(".videoPlayerWrap, .playerContainer, #videoPlayer, video");
      if (player && player.parentNode) {
        player.parentNode.insertBefore(root, player.nextSibling);
      } else {
        document.body.appendChild(root);
      }
    }

    root.className = "vieworaVideoCompanion";
    root.innerHTML =
      (ad.imageUrl ? `<img src="${escapeHtml(ad.imageUrl)}" alt="">` : "") +
      `<div class="vvcBody">` +
      `<div class="vvcLabel">Sponsored</div>` +
      `<div class="vvcTitle">${escapeHtml(ad.title)}</div>` +
      (ad.description ? `<p class="vvcDesc">${escapeHtml(ad.description)}</p>` : "") +
      `<a class="vvcCta" href="${escapeHtml(ad.clickUrl)}" target="_blank" rel="noopener sponsored nofollow">${escapeHtml(ad.cta)}</a>` +
      `</div>`;

    root.querySelector(".vvcCta")?.addEventListener("click", () => track(ad.id, "click"));
    track(ad.id, "impression");
    return root;
  }

  /**
   * Attach pre-roll / mid-roll behavior to an HTMLVideoElement.
   * When preRoll/midRoll are false (default until VAST configured), only companion shows.
   * When enabled and creative has videoUrl, plays that as interstitial.
   */
  async function attachPlayer(videoEl, opts) {
    if (!videoEl || videoEl.tagName !== "VIDEO") return;
    await Promise.all([loadConfig(), loadAds()]);
    const cfg = Object.assign({}, cachedConfig || DEFAULTS, opts || {});
    if (!cfg.enabled) return;

    // Always try companion near player
    if (cfg.companion) mountCompanion(opts && opts.companionTarget);

    const adVideo = cachedAds.find((a) => a.videoUrl) || pickAd();
    if (!adVideo || !adVideo.videoUrl) return;

    const parent = videoEl.parentNode;
    if (!parent) return;
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    function playInterstitial(when) {
      if (when === "pre" && !cfg.preRoll) return Promise.resolve();
      if (when === "mid" && !cfg.midRoll) return Promise.resolve();

      return new Promise((resolve) => {
        injectCSS();
        const overlay = document.createElement("div");
        overlay.className = "vieworaVideoPreroll";
        overlay.innerHTML =
          `<video src="${escapeHtml(adVideo.videoUrl)}" playsinline></video>` +
          `<button type="button" class="vvpSkip" hidden>Skip Ad</button>`;
        parent.appendChild(overlay);
        const v = overlay.querySelector("video");
        const skip = overlay.querySelector(".vvpSkip");
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          overlay.remove();
          resolve();
        };
        track(adVideo.id, "impression");
        v.addEventListener("ended", done);
        v.addEventListener("error", done);
        if (cfg.skipAfterSeconds > 0) {
          setTimeout(() => {
            skip.hidden = false;
          }, cfg.skipAfterSeconds * 1000);
        } else {
          skip.hidden = false;
        }
        skip.addEventListener("click", done);
        v.play().catch(done);
      });
    }

    // Pre-roll before first play
    if (cfg.preRoll) {
      let primed = false;
      const onPlay = async (e) => {
        if (primed) return;
        primed = true;
        e.preventDefault();
        videoEl.pause();
        await playInterstitial("pre");
        videoEl.play().catch(() => {});
        videoEl.removeEventListener("play", onPlay);
      };
      videoEl.addEventListener("play", onPlay);
    }

    // Mid-roll once at percent
    if (cfg.midRoll) {
      let midDone = false;
      videoEl.addEventListener("timeupdate", async () => {
        if (midDone || !videoEl.duration) return;
        if (videoEl.currentTime / videoEl.duration >= cfg.midRollPercent / 100) {
          midDone = true;
          videoEl.pause();
          await playInterstitial("mid");
          videoEl.play().catch(() => {});
        }
      });
    }

    /**
     * Future: if cfg.vastUrl is set, integrate Google IMA / custom VAST parser here.
     * Placeholder keeps API stable for production ad networks.
     */
    if (cfg.vastUrl) {
      global.VieworaVideoAds._vastUrl = cfg.vastUrl;
      // eslint-disable-next-line no-console
      console.info("[VieworaVideoAds] VAST URL configured — wire IMA SDK for network pre-roll:", cfg.vastUrl);
    }
  }

  function autoMount() {
    const run = () => {
      mountCompanion("#vieworaVideoAdSlot, .videoAdSlot");
      const v = document.querySelector("#mainVideo, .longVideoPlayer, video.videoPlayer, video");
      if (v) attachPlayer(v);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
  }

  global.VieworaVideoAds = {
    mountCompanion,
    attachPlayer,
    autoMount,
    loadConfig,
    loadAds,
    getConfig: () => cachedConfig || DEFAULTS,
  };
})(typeof window !== "undefined" ? window : this);
