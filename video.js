/* ==========================================================
   VIEWORA
   video.js
   PREMIUM VIDEO WATCH + CREATOR STUDIO
   ========================================================== */

"use strict";

(() => {

    /* ========================================================
       CONFIG
    ======================================================== */

    const DB_ROOT = "videos";
    const SHORTS_ROOT = "shorts";
    const USERS_ROOT = "users";
    const SAVED_ROOT = "savedVideos";
    const COMMENTS_ROOT = "comments";

    const EDIT_PAGE = "edit-video.html";
    const SHORTS_PAGE = "shorts.html";
    const PROFILE_PAGE = "profile.html";

    /* ========================================================
       STATE
    ======================================================== */

    const state = {
        videoId: null,
        video: null,
        currentUser: null,
        creator: null,

        liked: false,
        disliked: false,
        saved: false,
        following: false,

        comments: {},
        recommendations: [],
        shorts: [],

        descriptionExpanded: false,
        recommendationsLoaded: false,

        viewRegistered: false,
        initialized: false
    };

    /* ========================================================
       HELPERS
    ======================================================== */

    const $ = id => document.getElementById(id);

    const qs = selector => document.querySelector(selector);

    const qsa = selector => [...document.querySelectorAll(selector)];


    function setText(id, value) {

        const el = $(id);

        if (el) {
            el.textContent = value ?? "";
        }

    }


    function setHTML(id, value) {

        const el = $(id);

        if (el) {
            el.innerHTML = value ?? "";
        }

    }


    function setSrc(id, value) {

        const el = $(id);

        if (el && value) {
            el.src = value;
        }

    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function formatNumber(value) {
        const n = safeNumber(value);

        if (n < 1000) {
            return String(n);
        }

        if (n < 1000000) {
            return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
        }

        if (n < 1000000000) {
            return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
        }

        return `${(n / 1000000000).toFixed(1)}B`;
    }

    function formatDate(value) {
        if (!value) return "Recently";

        let date;

        if (typeof value === "number") {
            date = new Date(value);
        } else {
            date = new Date(value);
        }

        if (Number.isNaN(date.getTime())) {
            return "Recently";
        }

        const now = Date.now();
        const diff = Math.max(0, now - date.getTime());

        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (diff < minute) return "Just now";
        if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
        if (diff < day) return `${Math.floor(diff / hour)}h ago`;
        if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;

        return date.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function formatDuration(seconds) {
        seconds = Math.max(0, Math.floor(Number(seconds) || 0));

        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (h > 0) {
            return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        }

        return `${m}:${String(s).padStart(2, "0")}`;
    }

    function getVideoId() {
        const params = new URLSearchParams(window.location.search);

        return (
            params.get("videoId") ||
            params.get("id") ||
            params.get("video") ||
            localStorage.getItem("vieworaVideoId") ||
            null
        );
    }

    function getFirebaseDatabase() {
        if (typeof firebase === "undefined") return null;

        try {
            return firebase.database();
        } catch (error) {
            console.error("Firebase database unavailable:", error);
            return null;
        }
    }

    function getFirebaseStorage() {
        if (typeof firebase === "undefined") return null;

        try {
            return firebase.storage();
        } catch (error) {
            return null;
        }
    }

    function getAuth() {
        if (typeof firebase === "undefined") return null;

        try {
            return firebase.auth();
        } catch (error) {
            return null;
        }
    }

    function getCurrentUser() {
        const auth = getAuth();

        if (!auth) return null;

        return auth.currentUser || null;
    }

    function getCreatorId(video) {
        return (
            video?.uid ||
            video?.userId ||
            video?.ownerId ||
            video?.creatorId ||
            video?.authorId ||
            ""
        );
    }

    function getVideoUrl(video) {
        return (
            video?.videoUrl ||
            video?.videoURL ||
            video?.url ||
            video?.downloadURL ||
            video?.mediaUrl ||
            video?.mediaURL ||
            ""
        );
    }

    function getThumbnail(video) {
        return (
            video?.thumbnailUrl ||
            video?.thumbnailURL ||
            video?.thumbnail ||
            video?.coverUrl ||
            video?.cover ||
            ""
        );
    }

    function getCreatorName(user, video) {
        return (
            user?.displayName ||
            user?.name ||
            video?.creatorName ||
            video?.displayName ||
            "Viewora Creator"
        );
    }

    function getCreatorUsername(user, video) {
        const value =
            user?.username ||
            video?.username ||
            video?.creatorUsername ||
            "creator";

        return String(value).replace(/^@/, "");
    }

    function show(element) {
        if (element) {
            element.classList.remove("hidden");
        }
    }

    function hide(element) {
        if (element) {
            element.classList.add("hidden");
        }
    }

    /* ========================================================
       TOAST
    ======================================================== */

    let toastTimer = null;

    function toast(title, message, type = "success") {

        const box = $("toast");
        const titleEl = $("toastTitle");
        const textEl = $("toastText");
        const iconEl = $("toastIcon");

        if (!box) return;

        if (titleEl) titleEl.textContent = title;
        if (textEl) textEl.textContent = message;

        if (iconEl) {

            let icon = "fa-circle-check";

            if (type === "error") {
                icon = "fa-circle-exclamation";
            }

            if (type === "info") {
                icon = "fa-circle-info";
            }

            iconEl.innerHTML =
                `<i class="fa-solid ${icon}"></i>`;
        }

        show(box);

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            hide(box);
        }, 3000);
    }

    /* ========================================================
       PAGE LOADER
    ======================================================== */

    function hidePageLoader() {

        const loader = $("pageLoader");

        if (!loader) return;

        setTimeout(() => {
            loader.classList.add("hidden");
        }, 300);
    }

    /* ========================================================
       ERROR STATE
    ======================================================== */

    function showPlayerError(message = "This video could not be loaded.") {

        const loading = $("playerLoading");
        const error = $("playerError");

        hide(loading);
        show(error);

        const span = error?.querySelector("span");

        if (span) {
            span.textContent = message;
        }
    }

    function clearPlayerError() {
        hide($("playerError"));
    }

    /* ========================================================
       LOAD VIDEO
    ======================================================== */

    async function loadVideo() {

        state.videoId = getVideoId();

        if (!state.videoId) {

            showPlayerError("No video was selected.");

            hidePageLoader();

            toast(
                "Video unavailable",
                "No video ID was provided.",
                "error"
            );

            return;
        }

        const db = getFirebaseDatabase();

        if (!db) {

            showPlayerError("Firebase is not available.");

            hidePageLoader();

            return;
        }

        try {

            let snapshot =
                await db.ref(`${DB_ROOT}/${state.videoId}`).once("value");

            if (!snapshot.exists()) {

                snapshot =
                    await db.ref(`posts/${state.videoId}`).once("value");
            }

            if (!snapshot.exists()) {

                showPlayerError("This video no longer exists.");

                hidePageLoader();

                return;
            }

            state.video = snapshot.val() || {};

            /*
             * Normalize like/dislike counts from maps when present
             */
            const likedBy = state.video.likedBy;
            if (likedBy && typeof likedBy === "object") {
                state.video.likeCount =
                    Object.keys(likedBy).filter(k => likedBy[k]).length;
                state.video.likes = state.video.likeCount;
            } else if (
                state.video.likes &&
                typeof state.video.likes === "object"
            ) {
                state.video.likeCount =
                    Object.keys(state.video.likes)
                        .filter(k => state.video.likes[k])
                        .length;
                state.video.likes = state.video.likeCount;
            } else {
                state.video.likeCount =
                    safeNumber(
                        state.video.likeCount ??
                        state.video.likes
                    );
                state.video.likes = state.video.likeCount;
            }

            const dislikedBy = state.video.dislikedBy;
            if (dislikedBy && typeof dislikedBy === "object") {
                state.video.dislikeCount =
                    Object.keys(dislikedBy)
                        .filter(k => dislikedBy[k])
                        .length;
                state.video.dislikes = state.video.dislikeCount;
            } else {
                state.video.dislikeCount =
                    safeNumber(
                        state.video.dislikeCount ??
                        state.video.dislikes
                    );
                state.video.dislikes = state.video.dislikeCount;
            }

            await initializeVideoPage();

        } catch (error) {

            console.error("Video load failed:", error);

            showPlayerError(
                "Unable to load this video right now."
            );

            toast(
                "Loading failed",
                error.message || "Please try again.",
                "error"
            );
        }
    }

    /* ========================================================
       INITIALIZE
    ======================================================== */

    async function initializeVideoPage() {

        if (state.initialized) return;

        state.initialized = true;

        clearPlayerError();

        try {

            renderVideo();

            await loadCreator();

            await loadUserState();

            await registerView();

            setupPlayer();

            setupInteractions();

            await Promise.allSettled([
                loadRecommendations(),
                loadRecommendedShorts(),
                loadComments()
            ]);

        } catch (error) {

            console.error(
                "initializeVideoPage error:",
                error
            );

            showPlayerError(
                error.message ||
                "Unable to open this video."
            );

        } finally {

            hidePageLoader();

        }
    }

    /* ========================================================
       RENDER VIDEO
    ======================================================== */

    function renderVideo() {

        const video = state.video || {};

        const title =
            video.title ||
            video.name ||
            "Untitled video";

        const description =
            video.description ||
            video.caption ||
            "No description added.";

        const url = getVideoUrl(video);

        setText("videoTitle", title);

        setText("videoDescription", description);

        setText(
            "videoViews",
            `${formatNumber(video.views || 0)} views`
        );

        setText(
            "videoDate",
            formatDate(
                video.createdAt ||
                video.timestamp ||
                video.uploadedAt ||
                video.date
            )
        );

        if (url) {

            setSrc("mainVideo", url);

            setSrc("previewVideoSafe", url);
        }

        const visibility =
            video.visibility ||
            video.privacy ||
            "public";

        renderVisibility(visibility);

        renderHashtags(
            video.hashtags ||
            video.tags ||
            ""
        );

        renderDescription();

        updateLikeCount();

        updateCommentCount();

        updateOwnerTools();

        renderAnalytics();

        updateMetaTitle(title);
    }

    function updateMetaTitle(title) {
        document.title = `Viewora • ${title}`;
    }

    /* ========================================================
       CREATOR
    ======================================================== */

    async function loadCreator() {

        const creatorId = getCreatorId(state.video);

        const db = getFirebaseDatabase();

        if (!creatorId || !db) {

            renderCreator(null);

            return;
        }

        try {

            const snapshot =
                await db.ref(`${USERS_ROOT}/${creatorId}`).once("value");

            state.creator = snapshot.exists()
                ? snapshot.val()
                : null;

        } catch (error) {

            console.warn(
                "Creator profile unavailable:",
                error
            );

            state.creator = null;
        }

        renderCreator(state.creator);
    }

    function renderCreator(user) {

        const video = state.video || {};

        const name = getCreatorName(user, video);

        const username =
            getCreatorUsername(user, video);

        const avatar =
            user?.photoURL ||
            user?.photoUrl ||
            user?.avatar ||
            user?.profilePic ||
            user?.profileImage ||
            video?.creatorAvatar ||
            "assets/logo.png";

        setText("creatorName", name);

        setText(
            "creatorUsername",
            `@${username}`
        );

        setSrc("creatorAvatar", avatar);

        setText(
            "previewUsername",
            `@${username}`
        );

        setSrc("previewAvatar", avatar);

        setSrc(
            "currentUserAvatar",
            getCurrentUserAvatar()
        );

        updateFollowButton();
    }

    function getCurrentUserAvatar() {

        const user = getCurrentUser();

        return (
            user?.photoURL ||
            user?.photoUrl ||
            "assets/logo.png"
        );
    }

    /* ========================================================
       OWNER
    ======================================================== */

    function isOwner() {

        const user = getCurrentUser();

        if (!user || !state.video) return false;

        const creatorId = getCreatorId(state.video);

        return creatorId === user.uid;
    }

    function updateOwnerTools() {

        const owner = isOwner();

        if (owner) {
            show($("ownerTools"));
            show($("sheetEditBtn"));
            show($("sheetAnalyticsBtn"));
            show($("videoVisibility"));
        } else {
            hide($("ownerTools"));
            hide($("sheetEditBtn"));
            hide($("sheetAnalyticsBtn"));
        }
    }

    /* ========================================================
       PLAYER
    ======================================================== */

    function setupPlayer() {

        const player = $("mainVideo");

        if (!player) return;

        /*
         * Mobile / iOS friendly defaults
         */
        player.setAttribute("playsinline", "");
        player.setAttribute("webkit-playsinline", "");
        player.playsInline = true;
        player.controls = true;
        player.preload = "metadata";

        const video = state.video || {};

        const poster = getThumbnail(video);

        if (poster) {
            player.poster = poster;
        }

        player.addEventListener("loadedmetadata", () => {

            hide($("playerLoading"));

        });

        player.addEventListener("canplay", () => {
            hide($("playerLoading"));
        });

        player.addEventListener("waiting", () => {
            show($("playerLoading"));
        });

        player.addEventListener("playing", () => {
            hide($("playerLoading"));
        });

        player.addEventListener("error", () => {

            showPlayerError(
                "The video file could not be played."
            );
        });

        player.addEventListener("ended", () => {

            loadRecommendations();
        });

        /*
         * Double-tap / click center → play/pause is native.
         * Expose fullscreen helper for menu.
         */
        window.__vieworaToggleFullscreen = function () {

            const shell =
                $("playerShell") || player;

            try {

                if (document.fullscreenElement) {

                    document.exitFullscreen?.();

                } else if (shell.requestFullscreen) {

                    shell.requestFullscreen();

                } else if (player.webkitEnterFullscreen) {

                    player.webkitEnterFullscreen();

                }

            } catch (e) {

                console.warn("Fullscreen failed:", e);

            }

        };

    }


    /* ========================================================
       SCREEN WAKE LOCK (keep screen on while watching)
    ======================================================== */

    let wakeLock = null;

    async function requestWakeLock() {

        try {

            if (!("wakeLock" in navigator)) {

                toast(
                    "Not supported",
                    "Keep screen on is not available on this device.",
                    "info"
                );

                return false;

            }

            wakeLock =
                await navigator.wakeLock.request("screen");

            wakeLock.addEventListener("release", () => {
                wakeLock = null;
                updateWakeLockMenu();
            });

            updateWakeLockMenu();

            toast(
                "Screen on",
                "Screen will stay awake while you watch.",
                "success"
            );

            return true;

        } catch (e) {

            console.warn("WakeLock failed:", e);

            toast(
                "Could not keep screen on",
                e.message || "Permission denied.",
                "error"
            );

            return false;

        }

    }


    async function releaseWakeLock() {

        try {

            if (wakeLock) {

                await wakeLock.release();

                wakeLock = null;

            }

        } catch (e) {
            /* ignore */
        }

        updateWakeLockMenu();

    }


    function updateWakeLockMenu() {

        const btn = $("sheetWakeLockBtn");

        if (!btn) return;

        const on = !!wakeLock;

        btn.innerHTML = on
            ? `<i class="fa-solid fa-moon"></i> Allow screen sleep`
            : `<i class="fa-solid fa-sun"></i> Keep screen on`;

    }


    async function toggleWakeLock() {

        if (wakeLock) {

            await releaseWakeLock();

            toast(
                "Screen sleep allowed",
                "Device can dim / sleep normally.",
                "info"
            );

        } else {

            await requestWakeLock();

        }

        closeMore();

    }

    /* ========================================================
       VIEW COUNT
    ======================================================== */

    async function registerView() {

        if (state.viewRegistered) return;

        state.viewRegistered = true;

        const db = getFirebaseDatabase();

        if (!db || !state.videoId) return;

        const videoRef =
            db.ref(`${DB_ROOT}/${state.videoId}`);

        const user = getCurrentUser();

        /*
         * Unique view key:
         *  - signed-in → uid
         *  - guest     → localStorage device id
         */
        let viewerKey = null;

        if (user?.uid) {

            viewerKey = user.uid;

        } else {

            try {

                const storageKey =
                    "viewora_device_id";

                let deviceId =
                    localStorage.getItem(storageKey);

                if (!deviceId) {

                    deviceId =
                        "g_" +
                        Math.random()
                            .toString(36)
                            .slice(2) +
                        Date.now().toString(36);

                    localStorage.setItem(
                        storageKey,
                        deviceId
                    );

                }

                viewerKey = deviceId;

            } catch (e) {

                viewerKey = null;

            }

        }

        if (!viewerKey) return;

        /*
         * Client-side de-dupe (same session / device)
         */
        try {

            const localKey =
                `viewora_viewed_${state.videoId}`;

            if (localStorage.getItem(localKey)) {

                return;

            }

            localStorage.setItem(localKey, "1");

        } catch (e) {
            /* ignore quota / private mode */
        }

        try {

            const viewedRef =
                videoRef.child(
                    `viewedBy/${viewerKey}`
                );

            const already =
                await viewedRef.once("value");

            if (already.exists()) {

                /*
                 * Already counted for this user/device
                 */
                return;
            }

            /*
             * Mark viewer first (transaction-safe enough for RTDB)
             */
            await viewedRef.set({
                at: Date.now(),
                uid: user?.uid || null
            });

            /*
             * Increment total views once
             */
            const snap = await videoRef
                .child("views")
                .once("value");

            const current =
                safeNumber(snap.val());

            const next = current + 1;

            await videoRef.update({
                views: next
            });

            if (state.video) {

                state.video.views = next;

            }

            setText(
                "videoViews",
                `${formatNumber(next)} views`
            );

        } catch (error) {

            console.warn(
                "View count update failed:",
                error
            );

        }

    }

    /* ========================================================
       USER STATE
    ======================================================== */

    async function loadUserState() {

        const auth = getAuth();

        state.currentUser =
            auth?.currentUser || null;

        if (!state.currentUser) {

            updateOwnerTools();

            return;
        }

        const uid =
            state.currentUser.uid;

        const db = getFirebaseDatabase();

        if (!db) return;

        try {

            const [
                likeSnap,
                dislikeSnap,
                legacyLikeSnap,
                legacyDislikeSnap,
                saveSnap
            ] = await Promise.all([
                db.ref(
                    `${DB_ROOT}/${state.videoId}/likedBy/${uid}`
                ).once("value"),

                db.ref(
                    `${DB_ROOT}/${state.videoId}/dislikedBy/${uid}`
                ).once("value"),

                db.ref(
                    `${DB_ROOT}/${state.videoId}/likes/${uid}`
                ).once("value"),

                db.ref(
                    `${DB_ROOT}/${state.videoId}/dislikes/${uid}`
                ).once("value"),

                db.ref(
                    `${SAVED_ROOT}/${uid}/${state.videoId}`
                ).once("value")
            ]);

            state.liked =
                (likeSnap.exists() && likeSnap.val() === true) ||
                (legacyLikeSnap.exists() && legacyLikeSnap.val() === true);

            state.disliked =
                (dislikeSnap.exists() && dislikeSnap.val() === true) ||
                (legacyDislikeSnap.exists() && legacyDislikeSnap.val() === true);

            state.saved = saveSnap.exists();

            await loadFollowState();

        } catch (error) {

            console.warn(
                "User state load failed:",
                error
            );
        }

        renderActionStates();

        updateOwnerTools();
    }

    /* ========================================================
       LIKE
    ======================================================== */

    async function toggleLike() {

        const user = getCurrentUser();

        if (!user) {

            toast(
                "Sign in required",
                "Sign in to like this video.",
                "info"
            );

            return;

        }

        const db = getFirebaseDatabase();

        if (!db) return;

        const uid = user.uid;

        const likeRef =
            db.ref(
                `${DB_ROOT}/${state.videoId}/likedBy/${uid}`
            );

        const dislikeRef =
            db.ref(
                `${DB_ROOT}/${state.videoId}/dislikedBy/${uid}`
            );

        try {

            let likeCount =
                safeNumber(
                    state.video?.likeCount ??
                    state.video?.likes
                );

            let dislikeCount =
                safeNumber(
                    state.video?.dislikeCount ??
                    state.video?.dislikes
                );

            if (state.liked) {

                await likeRef.remove();

                state.liked = false;

                likeCount = Math.max(0, likeCount - 1);

            } else {

                await likeRef.set(true);

                state.liked = true;

                likeCount = likeCount + 1;

                if (state.disliked) {

                    await dislikeRef.remove();

                    state.disliked = false;

                    dislikeCount =
                        Math.max(0, dislikeCount - 1);

                }

            }

            state.video.likeCount = likeCount;
            state.video.likes = likeCount;
            state.video.dislikeCount = dislikeCount;
            state.video.dislikes = dislikeCount;

            await db.ref(
                `${DB_ROOT}/${state.videoId}`
            ).update({
                likeCount: likeCount,
                likes: likeCount,
                dislikeCount: dislikeCount,
                dislikes: dislikeCount
            });

            updateLikeCount();

            renderActionStates();

        } catch (error) {

            console.error("Like failed:", error);

            toast(
                "Like failed",
                "Please try again.",
                "error"
            );

        }

    }

    /* ========================================================
       DISLIKE
    ======================================================== */

async function toggleDislike() {

        const user = getCurrentUser();

        if (!user) {

            toast(
                "Sign in required",
                "Sign in to react to this video.",
                "info"
            );

            return;

        }

        const db = getFirebaseDatabase();

        if (!db) return;

        const uid = user.uid;

        const dislikeRef =
            db.ref(
                `${DB_ROOT}/${state.videoId}/dislikedBy/${uid}`
            );

        const likeRef =
            db.ref(
                `${DB_ROOT}/${state.videoId}/likedBy/${uid}`
            );

        try {

            let likeCount =
                safeNumber(
                    state.video?.likeCount ??
                    state.video?.likes
                );

            let dislikeCount =
                safeNumber(
                    state.video?.dislikeCount ??
                    state.video?.dislikes
                );

            if (state.disliked) {

                await dislikeRef.remove();

                state.disliked = false;

                dislikeCount =
                    Math.max(0, dislikeCount - 1);

            } else {

                await dislikeRef.set(true);

                state.disliked = true;

                dislikeCount = dislikeCount + 1;

                if (state.liked) {

                    await likeRef.remove();

                    state.liked = false;

                    likeCount =
                        Math.max(0, likeCount - 1);

                }

            }

            state.video.likeCount = likeCount;
            state.video.likes = likeCount;
            state.video.dislikeCount = dislikeCount;
            state.video.dislikes = dislikeCount;

            await db.ref(
                `${DB_ROOT}/${state.videoId}`
            ).update({
                likeCount: likeCount,
                likes: likeCount,
                dislikeCount: dislikeCount,
                dislikes: dislikeCount
            });

            updateLikeCount();

            renderActionStates();

        } catch (error) {

            console.error(
                "Dislike failed:",
                error
            );

            toast(
                "Dislike failed",
                "Please try again.",
                "error"
            );

        }

    }

function updateLikeCount() {

        const count =
            safeNumber(
                state.video?.likeCount ??
                state.video?.likes
            );

        setText(
            "likeCount",
            formatNumber(count)
        );

        setText(
            "analyticsLikes",
            formatNumber(count)
        );

    }

    function updateCommentCount() {

        const count =
            safeNumber(
                state.video?.comments ||
                state.video?.commentCount
            );

        setText("commentCount", 
            formatNumber(count));

        setText("commentsHeadingCount", 
            formatNumber(count));

        setText("analyticsComments", 
            formatNumber(count));
    }

    function renderActionStates() {

        const likeBtn = $("likeBtn");
        const dislikeBtn = $("dislikeBtn");
        const saveBtn = $("saveBtn");

        if (likeBtn) {

            likeBtn.classList.toggle(
                "active",
                state.liked
            );

            const icon =
                likeBtn.querySelector("i");

            if (icon) {
                icon.className =
                    state.liked
                        ? "fa-solid fa-heart"
                        : "fa-regular fa-heart";
            }
        }

        if (dislikeBtn) {

            dislikeBtn.classList.toggle(
                "active",
                state.disliked
            );

            const icon =
                dislikeBtn.querySelector("i");

            if (icon) {
                icon.className =
                    state.disliked
                        ? "fa-solid fa-thumbs-down"
                        : "fa-regular fa-thumbs-down";
            }
        }

        if (saveBtn) {

            saveBtn.classList.toggle(
                "active",
                state.saved
            );

            const icon =
                saveBtn.querySelector("i");

            if (icon) {
                icon.className =
                    state.saved
                        ? "fa-solid fa-bookmark"
                        : "fa-regular fa-bookmark";
            }

            const span =
                saveBtn.querySelector("span");

            if (span) {
                span.textContent =
                    state.saved ? "Saved" : "Save";
            }
        }
    }

    /* ========================================================
       SAVE
    ======================================================== */

    async function toggleSave() {

        const user = getCurrentUser();

        if (!user) {

            toast(
                "Sign in required",
                "Sign in to save videos.",
                "info"
            );

            return;
        }

        const db = getFirebaseDatabase();

        if (!db) return;

        const ref =
            db.ref(
                `${SAVED_ROOT}/${user.uid}/${state.videoId}`
            );

        try {

            if (state.saved) {

                await ref.remove();

                state.saved = false;

                toast(
                    "Removed",
                    "Video removed from saved videos."
                );

            } else {

                await ref.set({
                    videoId: state.videoId,
                    savedAt: firebase.database.ServerValue.TIMESTAMP
                });

                state.saved = true;

                toast(
                    "Saved",
                    "Video added to your saved videos."
                );
            }

            renderActionStates();

        } catch (error) {

            console.error(
                "Save failed:",
                error
            );

            toast(
                "Save failed",
                "Please try again.",
                "error"
            );
        }
    }

    /* ========================================================
       FOLLOW
    ======================================================== */

    async function loadFollowState() {

        const user = getCurrentUser();

        const creatorId =
            getCreatorId(state.video);

        const db = getFirebaseDatabase();

        if (!user || !creatorId || !db) return;

        if (user.uid === creatorId) {

            hide($("followBtn"));

            state.following = false;

            return;
        }

        show($("followBtn"));

        try {

            const snap =
                await db.ref(
                    `${USERS_ROOT}/${user.uid}/following/${creatorId}`
                ).once("value");

            state.following =
                snap.exists() &&
                snap.val() === true;

        } catch (error) {

            state.following = false;
        }

        updateFollowButton();
    }

    function updateFollowButton() {

        const btn = $("followBtn");

        if (!btn) return;

        if (isOwner()) {

            hide(btn);

            return;
        }

        show(btn);

        btn.textContent =
            state.following
                ? "Following"
                : "Follow";

        btn.classList.toggle(
            "following",
            state.following
        );
    }

    async function toggleFollow() {

        const user = getCurrentUser();

        if (!user) {

            toast(
                "Sign in required",
                "Sign in to follow creators.",
                "info"
            );

            return;
        }

        const creatorId =
            getCreatorId(state.video);

        if (!creatorId || creatorId === user.uid) {
            return;
        }

        const db = getFirebaseDatabase();

        if (!db) return;

        const followingRef =
            db.ref(
                `${USERS_ROOT}/${user.uid}/following/${creatorId}`
            );

        const followerRef =
            db.ref(
                `${USERS_ROOT}/${creatorId}/followers/${user.uid}`
            );

        try {

            if (state.following) {

                await followingRef.remove();
                await followerRef.remove();

                state.following = false;

                toast(
                    "Unfollowed",
                    `You unfollowed @${getCreatorUsername(
                        state.creator,
                        state.video
                    )}.`
                );

            } else {

                await followingRef.set(true);
                await followerRef.set(true);

                state.following = true;

                toast(
                    "Following",
                    `You are now following @${getCreatorUsername(
                        state.creator,
                        state.video
                    )}.`
                );
            }

            updateFollowButton();

        } catch (error) {

            console.error(
                "Follow failed:",
                error
            );

            toast(
                "Action failed",
                "Please try again.",
                "error"
            );
        }
    }

    /* ========================================================
       DESCRIPTION
    ======================================================== */

    function renderDescription() {

        const description =
            state.video?.description ||
            state.video?.caption ||
            "";

        setText("videoDescription", 
            description || "No description added.");

        renderDescriptionState();
    }

    function renderDescriptionState() {

        const description =
            state.video?.description ||
            state.video?.caption ||
            "";

        const toggle =
            $("descriptionToggle");

        if (!toggle) return;

        if (description.length <= 260) {

            toggle.classList.add("hidden");

            $("videoDescription")
                .classList.remove("collapsed");

            return;
        }

        toggle.classList.remove("hidden");

        $("videoDescription")
            .classList.toggle(
                "collapsed",
                !state.descriptionExpanded
            );

        toggle.textContent =
            state.descriptionExpanded
                ? "Show less"
                : "Show more";
    }

    function toggleDescription() {

        state.descriptionExpanded =
            !state.descriptionExpanded;

        renderDescriptionState();
    }

    /* ========================================================
       HASHTAGS
    ======================================================== */

    function renderHashtags(value) {

        const box = $("videoHashtags");

        if (!box) return;

        let tags = [];

        if (Array.isArray(value)) {
            tags = value;
        } else {
            tags = String(value || "")
                .split(/[\s,]+/)
                .filter(Boolean);
        }

        tags = tags
            .map(tag => tag.startsWith("#") ? tag : `#${tag}`)
            .slice(0, 30);

        box.innerHTML =
            tags.map(
                tag =>
                    `<span>${escapeHTML(tag)}</span>`
            ).join("");
    }

    /* ========================================================
       VISIBILITY
    ======================================================== */

    function renderVisibility(value) {

        const normalized =
            String(value || "public")
                .toLowerCase();

        const label =
            normalized === "private"
                ? "Private"
                : normalized === "unlisted"
                    ? "Unlisted"
                    : "Public";

        setText("videoVisibility", label);

        setText("summaryVisibility", label);

        setText("analyticsVisibility", label);
    }

    /* ========================================================
       COMMENTS
    ======================================================== */

    async function loadComments() {

        const db = getFirebaseDatabase();

        if (!db || !state.videoId) return;

        try {

            const snapshot =
                await db.ref(
                    `${COMMENTS_ROOT}/${state.videoId}`
                ).once("value");

            state.comments =
                snapshot.val() || {};

            renderComments();

            const count =
                Object.keys(state.comments).length;

            setText("commentCount", 
                formatNumber(count));

            setText("commentsHeadingCount", 
                formatNumber(count));

            setText("analyticsComments", 
                formatNumber(count));

        } catch (error) {

            console.warn(
                "Comments load failed:",
                error
            );
        }
    }

    function renderComments() {

        const list = $("commentsList");
        const empty = $("commentsEmpty");

        if (!list) return;

        list.innerHTML = "";

        const entries =
            Object.entries(state.comments || {})
                .map(([id, data]) => ({
                    id,
                    ...(data || {})
                }))
                .sort(
                    (a, b) =>
                        safeNumber(b.createdAt || b.timestamp) -
                        safeNumber(a.createdAt || a.timestamp)
                );

        if (!entries.length) {

            show(empty);

            return;
        }

        hide(empty);

        entries.forEach(comment => {

            const item =
                document.createElement("article");

            item.className = "commentItem";

            const avatar =
                comment.avatar ||
                comment.photoURL ||
                "assets/logo.png";

            const username =
                String(
                    comment.username ||
                    comment.userName ||
                    "creator"
                ).replace(/^@/, "");

            const text =
                comment.text ||
                comment.comment ||
                "";

            item.innerHTML = `

                <div class="commentAvatar">

                    <img
                        src="${escapeHTML(avatar)}"
                        alt=""
                        onerror="this.src='assets/logo.png'"
                    >

                </div>

                <div class="commentBody">

                    <div class="commentTop">

                        <strong>
                            @${escapeHTML(username)}
                        </strong>

                        <span>
                            ${escapeHTML(
                                formatDate(
                                    comment.createdAt ||
                                    comment.timestamp
                                )
                            )}
                        </span>

                    </div>

                    <p>
                        ${escapeHTML(text)}
                    </p>

                </div>
            `;

            list.appendChild(item);
        });
    }

    async function postComment() {

        const user = getCurrentUser();

        if (!user) {

            toast(
                "Sign in required",
                "Sign in to comment on this video.",
                "info"
            );

            return;
        }

        const input = $("commentInput");

        if (!input) return;

        const text = input.value.trim();

        if (!text) {

            toast(
                "Write a comment",
                "Your comment is empty.",
                "info"
            );

            return;
        }

        const db = getFirebaseDatabase();

        if (!db) return;

        const key =
            db.ref(
                `${COMMENTS_ROOT}/${state.videoId}`
            ).push().key;

        const creator =
            state.creator || {};

        const username =
            creator.username ||
            user.displayName ||
            "you";

        const avatar =
            user.photoURL ||
            user.photoUrl ||
            "assets/logo.png";

        const comment = {
            uid: user.uid,
            username:
                user.uid === getCreatorId(state.video)
                    ? username
                    : (
                        user.displayName ||
                        username
                    ),
            avatar,
            text,
            createdAt:
                firebase.database.ServerValue.TIMESTAMP
        };

        const updates = {};

        updates[
            `${COMMENTS_ROOT}/${state.videoId}/${key}`
        ] = comment;

        try {

            await db.ref().update(updates);

            input.value = "";

            await loadComments();

            await incrementCommentCount();

            toast(
                "Comment posted",
                "Your comment is now visible."
            );

        } catch (error) {

            console.error(
                "Comment failed:",
                error
            );

            toast(
                "Comment failed",
                "Please try again.",
                "error"
            );
        }
    }

    async function incrementCommentCount() {

        const db = getFirebaseDatabase();

        if (!db) return;

        const ref =
            db.ref(
                `${DB_ROOT}/${state.videoId}/commentCount`
            );

        try {

            const snap =
                await ref.once("value");

            const count =
                safeNumber(snap.val()) + 1;

            await ref.set(count);

            state.video.commentCount = count;

            updateCommentCount();

        } catch (error) {
            console.warn(
                "Comment count update failed:",
                error
            );
        }
    }

    /* ========================================================
       RECOMMENDED VIDEOS
    ======================================================== */

    async function loadRecommendations() {

        if (state.recommendationsLoaded) return;

        state.recommendationsLoaded = true;

        const db = getFirebaseDatabase();

        if (!db) return;

        const container =
            $("recommendedVideos");

        if (!container) return;

        try {

            const snapshot =
                await db.ref(DB_ROOT)
                    .limitToLast(80)
                    .once("value");

            const data =
                snapshot.val() || {};

            const currentId =
                state.videoId;

            const list =
                Object.entries(data)
                    .map(([id, video]) => ({
                        id,
                        ...(video || {})
                    }))
                    .filter(item =>
                        item.id !== currentId &&
                        getVideoUrl(item) &&
                        String(
                            item.visibility || "public"
                        ).toLowerCase() === "public"
                    );

            list.sort(
                (a, b) =>
                    safeNumber(b.views) -
                    safeNumber(a.views)
            );

            state.recommendations =
                list.slice(0, 16);

            renderRecommendations();

        } catch (error) {

            console.warn(
                "Recommendations failed:",
                error
            );

            state.recommendationsLoaded = false;
        }
    }

    function renderRecommendations() {

        const container =
            $("recommendedVideos");

        const empty =
            $("videoRecommendationsEmpty");

        if (!container) return;

        container.innerHTML = "";

        if (!state.recommendations.length) {

            show(empty);

            return;
        }

        hide(empty);

        state.recommendations.forEach(video => {

            const card =
                createVideoCard(video);

            container.appendChild(card);
        });
    }

    function createVideoCard(video) {

        const card =
            document.createElement("article");

        card.className =
            "recommendVideoCard";

        const thumbnail =
            getThumbnail(video);

        const title =
            video.title ||
            "Untitled video";

        const creatorName =
            video.creatorName ||
            video.username ||
            "Viewora Creator";

        const views =
            formatNumber(video.views || 0);

        const date =
            formatDate(
                video.createdAt ||
                video.timestamp
            );

        card.innerHTML = `

            <button
                class="recommendThumb"
                type="button"
            >

                ${
                    thumbnail
                        ? `
                            <img
                                src="${escapeHTML(thumbnail)}"
                                alt=""
                                loading="lazy"
                            >
                          `
                        : `
                            <div class="recommendThumbFallback">
                                <i class="fa-solid fa-play"></i>
                            </div>
                          `
                }

                <span class="recommendDuration">
                    ${formatDuration(video.duration)}
                </span>

            </button>

            <div class="recommendInfo">

                <strong class="recommendTitle">
                    ${escapeHTML(title)}
                </strong>

                <span class="recommendCreator">
                    ${escapeHTML(creatorName)}
                </span>

                <span class="recommendMeta">
                    ${views} views • ${escapeHTML(date)}
                </span>

            </div>
        `;

        card.addEventListener("click", () => {

            const id = video.id;

            if (!id) return;

            window.location.href =
                `${location.pathname}?videoId=${encodeURIComponent(id)}`;
        });

        return card;
    }

    /* ========================================================
       SHORTS
    ======================================================== */

    async function loadRecommendedShorts() {

        const db = getFirebaseDatabase();

        if (!db) return;

        const container =
            $("recommendedShorts");

        if (!container) return;

        try {

            const snapshot =
                await db.ref(SHORTS_ROOT)
                    .limitToLast(40)
                    .once("value");

            const data =
                snapshot.val() || {};

            const list =
                Object.entries(data)
                    .map(([id, short]) => ({
                        id,
                        ...(short || {})
                    }))
                    .filter(short =>
                        short.videoUrl ||
                        short.videoURL ||
                        short.url
                    );

            list.sort(
                (a, b) =>
                    safeNumber(b.views) -
                    safeNumber(a.views)
            );

            state.shorts =
                list.slice(0, 12);

            renderShorts();

        } catch (error) {

            console.warn(
                "Shorts load failed:",
                error
            );
        }
    }

    function renderShorts() {

        const container =
            $("recommendedShorts");

        if (!container) return;

        container.innerHTML = "";

        state.shorts.forEach(short => {

            const card =
                document.createElement("article");

            card.className =
                "shortRecommendationCard";

            const thumbnail =
                getThumbnail(short);

            const title =
                short.title ||
                short.caption ||
                "Viewora Short";

            card.innerHTML = `

                <button
                    type="button"
                    class="shortThumb"
                >

                    ${
                        thumbnail
                            ? `
                                <img
                                    src="${escapeHTML(thumbnail)}"
                                    alt=""
                                    loading="lazy"
                                >
                              `
                            : `
                                <div class="shortFallback">
                                    <i class="fa-solid fa-play"></i>
                                </div>
                              `
                    }

                    <span class="shortPlay">
                        <i class="fa-solid fa-play"></i>
                    </span>

                </button>

                <strong>
                    ${escapeHTML(title)}
                </strong>

                <span>
                    ${formatNumber(short.views || 0)} views
                </span>
            `;

            card.addEventListener("click", () => {

                window.location.href =
                    `${SHORTS_PAGE}?shortId=${encodeURIComponent(short.id)}`;
            });

            container.appendChild(card);
        });
    }

    /* ========================================================
       ANALYTICS
    ======================================================== */

    function renderAnalytics() {

        const video =
            state.video || {};

        const views =
            safeNumber(video.views);

        const likes =
            safeNumber(
                video.likes ||
                video.likeCount
            );

        const comments =
            safeNumber(
                video.comments ||
                video.commentCount
            );

        const shares =
            safeNumber(
                video.shares ||
                video.shareCount
            );

        const saves =
            safeNumber(
                video.saves ||
                video.saveCount
            );

        const engagementBase =
            Math.max(views, 1);

        const engagement =
            (
                (
                    likes +
                    comments +
                    shares +
                    saves
                ) /
                engagementBase
            ) * 100;

        setText("analyticsViews", 
            formatNumber(views));

        setText("analyticsLikes", 
            formatNumber(likes));

        setText("analyticsComments", 
            formatNumber(comments));

        setText("analyticsShares", 
            formatNumber(shares));

        setText("analyticsSaves", 
            formatNumber(saves));

        setText("analyticsEngagement", 
            `${engagement.toFixed(1)}%`);

        setText("analyticsTitle", 
            video.title || "Your video");

        const thumbnail =
            getThumbnail(video);

        if (thumbnail) {
            setSrc("analyticsThumbnail", thumbnail);
        }

        setText("analyticsCategory", 
            formatLabel(
                video.category || "—"
            ));

        setText("analyticsLanguage", 
            formatLabel(
                video.language || "—"
            ));
    }

    function formatLabel(value) {

        return String(value || "—")
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, char =>
                char.toUpperCase()
            );
    }

    /* ========================================================
       SHARE
    ======================================================== */

    function getShareUrl() {

        return (
            `${window.location.origin}` +
            `${window.location.pathname}` +
            `?videoId=${encodeURIComponent(state.videoId)}`
        );
    }

    function openShare() {
        show($("shareOverlay"));
    }

    function closeShare() {
        hide($("shareOverlay"));
    }

    async function copyVideoLink() {

        const url =
            getShareUrl();

        try {

            await navigator.clipboard.writeText(url);

            toast(
                "Link copied",
                "Video link copied to clipboard."
            );

        } catch (error) {

            const textarea =
                document.createElement("textarea");

            textarea.value = url;

            document.body.appendChild(textarea);

            textarea.select();

            document.execCommand("copy");

            textarea.remove();

            toast(
                "Link copied",
                "Video link copied to clipboard."
            );
        }
    }

    async function nativeShare() {

        const url =
            getShareUrl();

        if (!navigator.share) {

            await copyVideoLink();

            return;
        }

        try {

            await navigator.share({
                title:
                    state.video?.title ||
                    "Viewora Video",
                text:
                    state.video?.description ||
                    "Watch this video on Viewora.",
                url
            });

        } catch (error) {

            if (error.name !== "AbortError") {
                console.warn(
                    "Native share failed:",
                    error
                );
            }
        }
    }

    /* ========================================================
       SHARE COUNT
    ======================================================== */

    async function incrementShareCount() {

        const db = getFirebaseDatabase();

        if (!db) return;

        try {

            const ref =
                db.ref(
                    `${DB_ROOT}/${state.videoId}/shareCount`
                );

            const snap =
                await ref.once("value");

            const count =
                safeNumber(snap.val()) + 1;

            await ref.set(count);

            state.video.shareCount =
                count;

            setText("analyticsShares", 
                formatNumber(count));

        } catch (error) {
            console.warn(
                "Share count failed:",
                error
            );
        }
    }

    /* ========================================================
       MORE MENU
    ======================================================== */

    function openMore() {
        updateWakeLockMenu();
        show($("moreOverlay"));
    }

    function closeMore() {
        hide($("moreOverlay"));
    }

    /* ========================================================
       ANALYTICS MODAL
    ======================================================== */

    function openAnalytics() {

        if (!isOwner()) {

            toast(
                "Creator only",
                "Analytics are available to the video owner.",
                "info"
            );

            return;
        }

        renderAnalytics();

        show($("analyticsOverlay"));
    }

    function closeAnalytics() {
        hide($("analyticsOverlay"));
    }

    /* ========================================================
       EDIT
    ======================================================== */

    function openEditor() {

        if (!state.videoId) return;

        window.location.href =
            `${EDIT_PAGE}?videoId=${encodeURIComponent(state.videoId)}&source=video`;
    }

    /* ========================================================
       PROFILE
    ======================================================== */

    function openCreatorProfile() {

        const creatorId =
            getCreatorId(state.video);

        const username =
            getCreatorUsername(
                state.creator,
                state.video
            );

        if (creatorId) {

            window.location.href =
                `${PROFILE_PAGE}?uid=${encodeURIComponent(creatorId)}`;

            return;
        }

        if (username) {

            window.location.href =
                `${PROFILE_PAGE}?username=${encodeURIComponent(username)}`;
        }
    }

    /* ========================================================
       REPORT
    ======================================================== */

    function reportVideo() {

        closeMore();

        toast(
            "Report received",
            "Thanks. We'll review this video.",
            "info"
        );
    }

    /* ========================================================
       INTERACTIONS
    ======================================================== */

    function setupInteractions() {

        $("backBtn")?.addEventListener(
            "click",
            () => {
                if (history.length > 1) {
                    history.back();
                } else {
                    window.location.href = "index.html";
                }
            }
        );

        $("searchBtn")?.addEventListener(
            "click",
            () => {
                window.location.href = "search.html";
            }
        );

        $("headerMoreBtn")?.addEventListener(
            "click",
            openMore
        );

        $("videoMoreBtn")?.addEventListener(
            "click",
            openMore
        );

        $("likeBtn")?.addEventListener(
            "click",
            toggleLike
        );

        $("dislikeBtn")?.addEventListener(
            "click",
            toggleDislike
        );

        $("followBtn")?.addEventListener(
            "click",
            toggleFollow
        );

        $("saveBtn")?.addEventListener(
            "click",
            toggleSave
        );

        $("sheetSaveBtn")?.addEventListener(
            "click",
            async () => {
                closeMore();
                await toggleSave();
            }
        );

        $("commentBtn")?.addEventListener(
            "click",
            () => {
                $("commentInput")?.focus();

                $("commentsSection")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        );

        $("postCommentBtn")?.addEventListener(
            "click",
            postComment
        );

        $("commentInput")?.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {
                    event.preventDefault();
                    postComment();
                }
            }
        );

        $("shareBtn")?.addEventListener(
            "click",
            openShare
        );

        $("closeShareBtn")?.addEventListener(
            "click",
            closeShare
        );

        $("copyLinkBtn")?.addEventListener(
            "click",
            copyVideoLink
        );

        $("nativeShareBtn")?.addEventListener(
            "click",
            async () => {

                await nativeShare();

                await incrementShareCount();
            }
        );

        $("descriptionToggle")?.addEventListener(
            "click",
            toggleDescription
        );

        $("creatorProfileBtn")?.addEventListener(
            "click",
            openCreatorProfile
        );

        $("editVideoBtn")?.addEventListener(
            "click",
            openEditor
        );

        $("analyticsBtn")?.addEventListener(
            "click",
            openAnalytics
        );

        $("sheetEditBtn")?.addEventListener(
            "click",
            () => {
                closeMore();
                openEditor();
            }
        );

        $("sheetAnalyticsBtn")?.addEventListener(
            "click",
            () => {
                closeMore();
                openAnalytics();
            }
        );

        $("analyticsEditBtn")?.addEventListener(
            "click",
            () => {
                closeAnalytics();
                openEditor();
            }
        );

        $("closeAnalyticsBtn")?.addEventListener(
            "click",
            closeAnalytics
        );

        $("reportBtn")?.addEventListener(
            "click",
            reportVideo
        );


        $("sheetFullscreenBtn")?.addEventListener(
            "click",
            () => {
                closeMore();
                window.__vieworaToggleFullscreen?.();
            }
        );

        $("sheetWakeLockBtn")?.addEventListener(
            "click",
            () => {
                toggleWakeLock();
            }
        );

        $("sheetCopyLinkBtn")?.addEventListener(
            "click",
            async () => {
                closeMore();
                try {
                    const url = location.href;
                    await navigator.clipboard.writeText(url);
                    toast(
                        "Link copied",
                        "Video link copied to clipboard.",
                        "success"
                    );
                } catch (e) {
                    toast(
                        "Copy failed",
                        "Could not copy link.",
                        "error"
                    );
                }
            }
        );


        $("retryVideoBtn")?.addEventListener(
            "click",
            () => {
                clearPlayerError();

                show($("playerLoading"));

                $("mainVideo").load();

                $("mainVideo").play()
                    .catch(() => {});
            }
        );

        $("openShortsBtn")?.addEventListener(
            "click",
            () => {
                window.location.href = SHORTS_PAGE;
            }
        );

        $("refreshRecommendations")?.addEventListener(
            "click",
            () => {

                state.recommendationsLoaded = false;

                loadRecommendations();

                toast(
                    "Refreshed",
                    "Recommendations updated."
                );
            }
        );

        setupOverlayCloseHandlers();
    }

    /* ========================================================
       OVERLAY CLOSE
    ======================================================== */

    function setupOverlayCloseHandlers() {

        qsa("[data-close]").forEach(
            backdrop => {

                backdrop.addEventListener(
                    "click",
                    () => {

                        const id =
                            backdrop.dataset.close;

                        if (id === "shareOverlay") {
                            closeShare();
                        }

                        if (id === "moreOverlay") {
                            closeMore();
                        }

                        if (id === "analyticsOverlay") {
                            closeAnalytics();
                        }
                    }
                );
            }
        );
    }

    /* ========================================================
       AUTH LISTENER
    ======================================================== */

    function setupAuthListener() {

        const auth = getAuth();

        if (!auth) return;

        auth.onAuthStateChanged(
            async user => {

                state.currentUser = user;

                if (user) {

                    getCurrentUserAvatar();

                    await loadUserState();

                } else {

                    state.liked = false;
                    state.disliked = false;
                    state.saved = false;
                    state.following = false;

                    renderActionStates();

                    updateOwnerTools();
                    updateFollowButton();
                }
            }
        );
    }

    /* ========================================================
       KEYBOARD
    ======================================================== */

    function setupKeyboard() {

        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {

                    closeShare();
                    closeMore();
                    closeAnalytics();
                }
            }
        );
    }

    /* ========================================================
       INIT
    ======================================================== */

    async function init() {

        setupAuthListener();

        setupKeyboard();

        await loadVideo();
    }

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );

    } else {

        init();
    }

})();