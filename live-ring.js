"use strict";
/*
  VIEWORA LIVE RINGS
  Include on index.html + profile.html (after firebase):
    <script src="live-ring.js"></script>
    <link rel="stylesheet" href="live.css">  (or only ring CSS)

  Marks story rings with class "live" when users/{uid}.isLive or live/{uid}.active
*/
(() => {
  if (window.__VIEWORA_LIVE_RING__) return;
  window.__VIEWORA_LIVE_RING__ = true;

  if (typeof firebase === "undefined" || !window.db) {
    console.warn("[LIVE RING] Firebase missing");
    return;
  }

  const liveUsers = new Set();

  function applyRings() {
    document.querySelectorAll("[data-uid], [data-user-id], .storyCard, .story-ring").forEach((el) => {
      const uid =
        el.getAttribute("data-uid") ||
        el.getAttribute("data-user-id") ||
        el.dataset.uid ||
        "";
      if (!uid) return;
      if (liveUsers.has(uid)) {
        el.classList.add("live");
        const wrap = el.querySelector(".storyImageWrap, .ring, .avatar-wrap");
        if (wrap) wrap.classList.add("live-ring");
      } else {
        el.classList.remove("live");
        const wrap = el.querySelector(".storyImageWrap, .ring, .avatar-wrap");
        if (wrap) wrap.classList.remove("live-ring");
      }
    });

    // Profile own ring
    const profileRing = document.getElementById("storyRing") || document.querySelector(".profileStoryRing");
    if (profileRing) {
      const puid =
        profileRing.getAttribute("data-uid") ||
        new URLSearchParams(location.search).get("uid") ||
        (window.auth && auth.currentUser && auth.currentUser.uid) ||
        "";
      if (puid && liveUsers.has(puid)) {
        profileRing.classList.add("live");
      } else {
        profileRing.classList.remove("live");
      }
    }
  }

  function listen() {
    db.ref("live").on("value", (snap) => {
      liveUsers.clear();
      if (snap.exists()) {
        snap.forEach((ch) => {
          const v = ch.val() || {};
          if (v.active === true) liveUsers.add(ch.key);
        });
      }
      applyRings();
    });

    // Re-apply when DOM story list changes
    const mo = new MutationObserver(() => applyRings());
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Click live ring → open live room
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".storyCard.live, .story-ring.live, #storyRing.live, .profileStoryRing.live");
    if (!card) return;
    const uid =
      card.getAttribute("data-uid") ||
      card.getAttribute("data-user-id") ||
      new URLSearchParams(location.search).get("uid") ||
      "";
    if (!uid) return;
    // If live, prefer live page over story
    e.preventDefault();
    e.stopPropagation();
    location.href = "live.html?uid=" + encodeURIComponent(uid);
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", listen);
  } else {
    listen();
  }

  window.VieworaLiveRings = { refresh: applyRings, liveUsers };
})();
