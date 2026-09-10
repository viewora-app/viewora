"use strict";
/*
  VIEWORA LIVE RINGS (global)
  Include on every main page after firebase.js:

    <link rel="stylesheet" href="live.css">
    <script src="live-ring.js"></script>

  Marks ANY profile avatar / story ring with red live ring when
  users/{uid}.isLive or live/{uid}.active === true
*/
(() => {
  if (window.__VIEWORA_LIVE_RING__) return;
  window.__VIEWORA_LIVE_RING__ = true;

  const liveUsers = new Set();
  let db = null;
  let started = false;

  function resolveDb() {
    if (window.db) return window.db;
    try {
      return firebase.database();
    } catch (_) {
      return null;
    }
  }

  function getUidFromEl(el) {
    if (!el || el.nodeType !== 1) return "";
    return (
      el.getAttribute("data-uid") ||
      el.getAttribute("data-user-id") ||
      el.getAttribute("data-userid") ||
      el.getAttribute("data-owner") ||
      el.dataset.uid ||
      el.dataset.userId ||
      ""
    );
  }

  /** Mark element + nearest avatar image wrapper */
  function markLive(el, on) {
    if (!el) return;
    el.classList.toggle("live", on);
    el.classList.toggle("is-live", on);

    const wraps = el.querySelectorAll(
      ".storyImageWrap, .ring, .avatar-wrap, .avatarWrap, .profilePicWrap, .userAvatar, .chatAvatar, .postAvatar, .story-avatar"
    );
    wraps.forEach((w) => {
      w.classList.toggle("live-ring", on);
      w.classList.toggle("live", on);
    });

    // element itself is avatar
    if (
      el.matches(
        "img.avatar, img.profilePic, img.chatPhoto, img.user-photo, .avatar, .profile-photo"
      )
    ) {
      el.classList.toggle("live-ring", on);
    }

    // parent wrap of img
    const img = el.matches("img") ? el : el.querySelector("img");
    if (img && img.parentElement) {
      img.parentElement.classList.toggle("live-ring", on);
    }

    // LIVE badge
    let badge = el.querySelector(".liveBadge, .live-badge-mini");
    if (on) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "liveBadge live-badge-mini";
        badge.textContent = "LIVE";
        (el.querySelector(".storyImageWrap, .avatar-wrap, .ring") || el).appendChild(badge);
      }
      badge.style.display = "";
    } else if (badge) {
      badge.style.display = "none";
    }
  }

  function applyRings() {
    // Story cards / rings
    document
      .querySelectorAll(
        "[data-uid], [data-user-id], [data-userid], .storyCard, .story-ring, .storyItem, .userCard, .postAuthor, .chatRow, .messageAvatar, .profileHeader"
      )
      .forEach((el) => {
        const uid = getUidFromEl(el);
        if (!uid) return;
        markLive(el, liveUsers.has(uid));
      });

    // Profile page own ring
    const profileRing =
      document.getElementById("storyRing") ||
      document.querySelector(".profileStoryRing, #profileStoryRing");
    if (profileRing) {
      const puid =
        getUidFromEl(profileRing) ||
        new URLSearchParams(location.search).get("uid") ||
        (window.auth && auth.currentUser && auth.currentUser.uid) ||
        "";
      markLive(profileRing, puid && liveUsers.has(puid));
    }

    // Chat header photo
    const chatPhoto = document.getElementById("chatPhoto");
    if (chatPhoto) {
      const uid =
        getUidFromEl(chatPhoto) ||
        getUidFromEl(chatPhoto.closest("[data-uid]")) ||
        new URLSearchParams(location.search).get("uid") ||
        "";
      if (uid) markLive(chatPhoto.parentElement || chatPhoto, liveUsers.has(uid));
    }
  }

  function listen() {
    db = resolveDb();
    if (!db) {
      console.warn("[LIVE RING] Firebase db missing — retry");
      setTimeout(listen, 800);
      return;
    }
    if (started) return;
    started = true;

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

    // Also listen isLive flags for robustness
    db.ref("users").orderByChild("isLive").equalTo(true).on("value", (snap) => {
      if (snap.exists()) {
        snap.forEach((ch) => {
          liveUsers.add(ch.key);
        });
      }
      applyRings();
    });

    const mo = new MutationObserver(() => {
      clearTimeout(window.__liveRingMO);
      window.__liveRingMO = setTimeout(applyRings, 120);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Click live ring → open live room
  document.addEventListener(
    "click",
    (e) => {
      const card = e.target.closest(
        ".live, .is-live, .live-ring, .storyCard.live, .story-ring.live, #storyRing.live, .profileStoryRing.live"
      );
      if (!card) return;
      if (!card.classList.contains("live") && !card.classList.contains("is-live") && !card.classList.contains("live-ring")) {
        // parent might hold live class
        if (!e.target.closest(".live, .is-live")) return;
      }
      const root = e.target.closest("[data-uid], [data-user-id], .storyCard, .story-ring, #storyRing, .profileStoryRing") || card;
      const uid =
        getUidFromEl(root) ||
        new URLSearchParams(location.search).get("uid") ||
        "";
      if (!uid) return;
      if (!liveUsers.has(uid)) return;
      e.preventDefault();
      e.stopPropagation();
      location.href = "live.html?uid=" + encodeURIComponent(uid);
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", listen);
  } else {
    listen();
  }

  window.VieworaLiveRings = {
    refresh: applyRings,
    liveUsers,
    isLive: (uid) => liveUsers.has(uid)
  };
})();
