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

    let videoLikeInFlight = false;
    const videoLikeSpam = [];
    const VIDEO_LIKE_SPAM_LIMIT = 6;
    const VIDEO_LIKE_SPAM_WINDOW = 12000;

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
        let id =
            params.get("videoId") ||
            params.get("id") ||
            params.get("v") ||
            params.get("video") ||
            null;

        // hash style: #id=xxx or #/video/xxx
        if (!id && location.hash) {
            const h = location.hash.replace(/^#/, "");
            const hp = new URLSearchParams(h.includes("=") ? h : "");
            id = hp.get("id") || hp.get("videoId") || null;
            const m = h.match(/(?:video)\/([A-Za-z0-9_-]{4,})/i);
            if (!id && m) id = m[1];
        }

        // path style: /video/xxx or video.html/xxx
        if (!id) {
            const parts = location.pathname.split("/").filter(Boolean);
            const vi = parts.findIndex(p => p.toLowerCase().replace(".html","") === "video");
            if (vi >= 0 && parts[vi + 1] && parts[vi + 1].length >= 4) {
                id = parts[vi + 1];
            }
        }

        if (!id) {
            id = sessionStorage.getItem("vieworaVideoId") ||
                 localStorage.getItem("vieworaVideoId") ||
                 null;
        }

        if (id) id = String(id).trim();
        if (!id || id.length < 4 || id === "undefined" || id === "null" || id === "?i" || id === "i") {
            return null;
        }
        return id;
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

    function looksLikeVideoUrl(s) {
        if (!s || typeof s !== "string") return false;
        const u = s.trim();
        if (!/^https?:\/\//i.test(u)) return false;
        // hard reject images / avatars
        if (/\/image\/upload\//i.test(u)) return false;
        if (/\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(u)) return false;
        if (/ui-avatars|dicebear|default-avatar|placeholder/i.test(u)) return false;
        // accept clear video signals
        if (/\.(mp4|webm|ogg|m3u8|mov)(\?|$)/i.test(u)) return true;
        if (/\/video\/upload\//i.test(u)) return true;
        if (/cloudinary\.com/i.test(u) && /\/video\//i.test(u)) return true;
        if (/firebasestorage\.googleapis\.com/i.test(u) && /video|mp4|webm/i.test(u)) return true;
        if (/firebasestorage\.googleapis\.com/i.test(u)) return true;
        return false;
    }

    function collectVideoUrlCandidates(video) {
        const out = [];
        const seen = new Set();
        const push = (u) => {
            if (!u || typeof u !== "string") return;
            let s = u.trim();
            if (!s || seen.has(s)) return;
            if (!looksLikeVideoUrl(s)) return;
            seen.add(s);
            out.push(s);
            // also push normalized cloudinary variant
            const n = normalizePlayableUrl(s);
            if (n && n !== s && !seen.has(n)) {
                seen.add(n);
                out.push(n);
            }
        };

        if (!video || typeof video !== "object") return out;

        const priority = [
            "videoUrl", "videoURL", "mediaUrl", "mediaURL", "downloadURL",
            "downloadUrl", "playbackUrl", "streamUrl", "mp4", "hdUrl", "sdUrl",
            "secure_url", "secureUrl", "fileUrl", "fileURL", "src", "url"
        ];
        for (const k of priority) {
            const v = video[k];
            if (typeof v === "string") push(v);
            else if (v && typeof v === "object") {
                if (typeof v.url === "string") push(v.url);
                if (typeof v.secure_url === "string") push(v.secure_url);
                if (typeof v.src === "string") push(v.src);
            }
        }
        // nested media
        if (video.media && typeof video.media === "object") {
            for (const k of priority) {
                const v = video.media[k];
                if (typeof v === "string") push(v);
            }
        }
        // mediaUrls array
        const arr = video.mediaUrls || video.videos || video.sources;
        if (Array.isArray(arr)) {
            arr.forEach(function (item) {
                if (typeof item === "string") push(item);
                else if (item && typeof item === "object") {
                    push(item.url || item.secure_url || item.src || item.videoUrl || "");
                }
            });
        }
        return out;
    }

    function getVideoUrl(video) {
        const list = collectVideoUrlCandidates(video);
        return list[0] || "";
    }

    function normalizePlayableUrl(url) {
        if (!url) return "";
        let u = String(url).trim();
        try {
            if (/res\.cloudinary\.com/i.test(u) && /\/video\/upload\//i.test(u)) {
                if (!/\.(mp4|webm|m3u8)(\?|$)/i.test(u) && !/\/upload\/[^/]*f_mp4/i.test(u)) {
                    u = u.replace(/\/upload\//i, "/upload/f_mp4,q_auto/");
                }
            }
        } catch (_) {}
        return u;
    }

    async function resolveVideoUrl(video) {
        const list = collectVideoUrlCandidates(video);
        if (list.length) return normalizePlayableUrl(list[0]);
        const path =
            video?.storagePath ||
            video?.path ||
            video?.filePath ||
            video?.videoPath ||
            "";
        if (!path) return "";
        try {
            const storage = getFirebaseStorage();
            if (storage) {
                const ref = storage.ref(path);
                const url = await ref.getDownloadURL();
                return normalizePlayableUrl(url || "");
            }
        } catch (e) {
            console.warn("Storage URL resolve failed:", e);
        }
        return "";
    }

    let __mediaCandidates = [];
    let __mediaCandidateIndex = 0;

    function __vieworaHistMeta() {
        try {
            let vid =
                (typeof state !== "undefined" && state.videoId) ||
                window.currentVideoId ||
                "";
            if (!vid) {
                try {
                    const p = new URLSearchParams(location.search);
                    vid = p.get("id") || p.get("videoId") || "";
                } catch (_) {}
            }
            if (!vid) {
                try {
                    const m = String(location.pathname || "").match(/video[^/]*\/([^/?#]+)/i);
                    if (m) vid = m[1];
                } catch (_) {}
            }
            const v = (typeof state !== "undefined" && state.video) || {};
            let thumb =
                v.thumbnailUrl ||
                v.thumbnail ||
                v.thumb ||
                v.coverUrl ||
                v.cover ||
                v.poster ||
                "";
            if (!thumb) {
                try {
                    const pl = document.getElementById("mainVideo");
                    thumb = (pl && (pl.getAttribute("poster") || "")) || "";
                } catch (_) {}
            }
            return {
                videoId: String(vid || ""),
                type: "video",
                title:
                    v.title ||
                    v.name ||
                    (document.getElementById("videoTitle") &&
                        document.getElementById("videoTitle").textContent) ||
                    "Video",
                thumb: thumb,
                ownerName: v.username || v.userName || v.ownerName || v.displayName || ""
            };
        } catch (_) {
            return { videoId: "", type: "video" };
        }
    }

    function __vieworaBindHistoryOnce(player) {
        try {
            if (!player || player.dataset.vieworaHistBound === "1") return;
            player.dataset.vieworaHistBound = "1";
            const bump = function (force) {
                try {
                    const meta = __vieworaHistMeta();
                    if (!meta.videoId) return;
                    const cur = player.currentTime || 0;
                    const dur = player.duration || 0;
                    // 1 second rule: only save once we've actually played ~1s (or force after ended)
                    if (!force && cur < 0.9) return;
                    if (window.VieworaWatchProgress) {
                        VieworaWatchProgress(meta, Math.max(cur, force && cur < 0.9 ? 1 : cur), dur || 15);
                    } else if (window.VieworaRecordWatch) {
                        const p = dur > 0 ? Math.min(1, cur / dur) : 0.05;
                        VieworaRecordWatch(Object.assign({}, meta, { progress: Math.max(p, 0.05) }));
                    }
                } catch (_) {}
            };
            // After 1s of continuous play, force first history write
            let __histOneSec = null;
            player.addEventListener("playing", function () {
                try { clearTimeout(__histOneSec); } catch (_) {}
                __histOneSec = setTimeout(function () {
                    if (!player.paused && !player.ended) bump(true);
                }, 1000);
                bump(false);
            });
            player.addEventListener("pause", function () {
                try { clearTimeout(__histOneSec); } catch (_) {}
                if ((player.currentTime || 0) >= 0.9) bump(true);
            });
            player.addEventListener("timeupdate", function () { bump(false); });
            player.addEventListener("pause", function () { bump(true); });
            player.addEventListener("ended", function () {
                try {
                    const meta = __vieworaHistMeta();
                    if (meta.videoId && window.VieworaRecordWatch) {
                        VieworaRecordWatch(Object.assign({}, meta, { progress: 1 }));
                    }
                } catch (_) {}
            });
        } catch (_) {}
    }

    function applyMediaToPlayer(url) {
        const player = $("mainVideo");
        if (!player || !url) return false;
        try { __vieworaBindHistoryOnce(player); } catch (_) {}
        clearPlayerError();
        hide($("playerLoading"));
        try { player.pause(); } catch (_) {}
        // clean
        try {
            player.removeAttribute("src");
            while (player.firstChild) player.removeChild(player.firstChild);
        } catch (_) {}
        player.src = url;
        player.setAttribute("playsinline", "true");
        player.setAttribute("webkit-playsinline", "true");
        player.setAttribute("preload", "auto");
        // poster from thumbnail if available
        try {
            const thumb = getThumbnail(state.video || {});
            if (thumb) player.setAttribute("poster", thumb);
        } catch (_) {}
        try { player.load(); } catch (_) {}
        setSrc("previewVideoSafe", url);
        console.log("[VIEWORA] media src set", url.slice(0, 120));
        return true;
    }

    function tryNextMediaCandidate() {
        __mediaCandidateIndex += 1;
        if (__mediaCandidateIndex >= __mediaCandidates.length) return false;
        const next = __mediaCandidates[__mediaCandidateIndex];
        console.warn("[VIEWORA] trying next media candidate", __mediaCandidateIndex, next);
        applyMediaToPlayer(next);
        return true;
    }

    function startMediaPlayback(video) {
        // 1) session bootstrap (from home feed click)
        let boot = null;
        try {
            boot = JSON.parse(sessionStorage.getItem("viewora_open_video") || "null");
        } catch (_) { boot = null; }
        if (boot && boot.id && state.videoId && String(boot.id) === String(state.videoId) && boot.url) {
            if (looksLikeVideoUrl(boot.url)) {
                __mediaCandidates = [normalizePlayableUrl(boot.url)].concat(collectVideoUrlCandidates(video));
            }
        }
        if (!__mediaCandidates.length) {
            __mediaCandidates = collectVideoUrlCandidates(video).map(normalizePlayableUrl);
        }
        // dedupe
        __mediaCandidates = Array.from(new Set(__mediaCandidates.filter(Boolean)));
        __mediaCandidateIndex = 0;

        const thumb = getThumbnail(video);
        if (thumb) {
            const player = $("mainVideo");
            if (player) player.setAttribute("poster", thumb);
        }

        if (!__mediaCandidates.length) {
            // async storage
            resolveVideoUrl(video).then(function (resolved) {
                if (!resolved) {
                    hide($("playerLoading"));
                    showPlayerError("Video file missing on server. Please re-upload this video.");
                    console.warn("[VIEWORA] no playable url", Object.keys(video || {}));
                    return;
                }
                __mediaCandidates = [resolved];
                __mediaCandidateIndex = 0;
                applyMediaToPlayer(resolved);
                hide($("playerLoading"));
            });
            return;
        }

        applyMediaToPlayer(__mediaCandidates[0]);
        hide($("playerLoading"));
    }

    function getThumbnail(video) {
        if (!video || typeof video !== "object") return "";
        const direct =
            video.thumbnailUrl ||
            video.thumbnailURL ||
            video.thumbnail ||
            video.coverUrl ||
            video.cover ||
            video.poster ||
            video.imageUrl ||
            video.photoUrl ||
            "";
        if (direct && typeof direct === "string" && /^https?:/i.test(direct)) return direct.trim();
        // Cloudinary video → frame at 1s
        const vurl =
            video.videoUrl || video.videoURL || video.mediaUrl || video.mediaURL || video.url || "";
        if (vurl && /cloudinary\.com/i.test(vurl) && /\/video\/upload\//i.test(vurl)) {
            return vurl.replace("/video/upload/", "/video/upload/so_1,w_720,h_1280,c_fill,f_jpg/");
        }
        return typeof vurl === "string" ? "" : "";
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
        if (loader) {
            loader.classList.add("hidden");
            try { loader.remove(); } catch (_) {}
        }
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


    function formatCountShort(n) {
        n = Number(n) || 0;
        if (n >= 1e7) return (n / 1e7).toFixed(1).replace(/\.0$/, "") + " Cr";
        if (n >= 1e5) return (n / 1e5).toFixed(1).replace(/\.0$/, "") + " Lakh";
        if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
        return String(n);
    }

    function openDescSheet() {
        const v = state.video || {};
        const title = v.title || v.name || "Video";
        const desc = v.description || v.caption || v.text || "No description added.";
        const likes = v.likesCount || v.likes || state.likeCount || 0;
        const views = v.views || v.viewCount || v.viewsCount || 0;
        const dateRaw = v.createdAt || v.timestamp || v.uploadedAt || null;
        let dateStr = "—";
        try {
            const d = dateRaw ? new Date(typeof dateRaw === "number" ? dateRaw : dateRaw) : null;
            if (d && !isNaN(d)) {
                dateStr = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
            }
        } catch (_) {}

        const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
        set("descSheetTitle", title);
        set("descLikes", formatCountShort(likes));
        set("descViews", formatCountShort(views));
        set("descDate", dateStr.split(" ").slice(0, 2).join(" ") || dateStr);
        set("descDetailDate", dateStr);
        set("descDetailViews", formatCountShort(views));
        set("descDetailLikes", formatCountShort(likes));
        const body = $("descBody");
        if (body) {
            body.textContent = desc;
            body.classList.remove("expanded");
        }
        const see = $("descSeeMore");
        if (see) {
            if (String(desc).length > 180) see.classList.remove("hidden");
            else see.classList.add("hidden");
        }

        // hashtags
        const tags = [];
        const tagSrc = v.tags || v.hashtags || [];
        if (Array.isArray(tagSrc)) tagSrc.forEach(t => tags.push(String(t).replace(/^#/, "")));
        String(desc).replace(/#([\w\u0900-\u097F]+)/g, (_, t) => { tags.push(t); return ""; });
        const ht = $("descHashtags");
        if (ht) {
            const uniq = [...new Set(tags)].slice(0, 12);
            ht.innerHTML = uniq.map(t => "<span>#" + t + "</span>").join("");
        }

        // music
        const musicTitle =
            v.musicTitle || v.songName || v.audioTitle ||
            (v.music && (v.music.title || v.music.name)) ||
            "Original audio";
        const musicArtist =
            v.musicArtist || v.artist ||
            (v.music && (v.music.artist || v.music.author)) ||
            state.creator?.name || state.creator?.username || "Creator";
        set("descMusicTitle", musicTitle);
        set("descMusicArtist", musicArtist);
        const art = $("descMusicArt");
        if (art) {
            const cover = v.musicCover || v.thumbnail || v.thumb || "";
            if (cover) art.innerHTML = '<img src="' + cover + '" alt="">';
            else art.innerHTML = '<i class="fa-solid fa-music"></i>';
        }

        show($("descSheet"));
    }

    function startRemixFromVideo() {
        const v = state.video || {};
        const audioUrl =
            v.musicURL || v.audioURL || v.songURL ||
            (v.music && (v.music.url || v.music.src)) ||
            v.videoURL || v.mediaURL || v.url || "";
        const payload = {
            source: "video_remix",
            videoId: state.videoId || v.id || "",
            audioUrl: audioUrl,
            musicTitle: v.musicTitle || v.songName || "Original audio",
            musicArtist: v.musicArtist || state.creator?.name || "",
            thumbnail: v.thumbnail || v.thumb || "",
            ownerId: v.uid || v.userId || "",
            at: Date.now()
        };
        try {
            sessionStorage.setItem("VIEWORA_REMIX_AUDIO", JSON.stringify(payload));
            localStorage.setItem("VIEWORA_REMIX_AUDIO", JSON.stringify(payload));
        } catch (_) {}
        // Shorts create flow
        location.href =
            "upload.html?type=short&remix=1&audio=" +
            encodeURIComponent(audioUrl || "") +
            "&title=" + encodeURIComponent(payload.musicTitle);
    }


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

            const roots = [
                `${DB_ROOT}/${state.videoId}`,
                `posts/${state.videoId}`,
                `longVideos/${state.videoId}`,
                `videos/${state.videoId}`,
                `content/${state.videoId}`
            ];

            let snapshot = null;
            for (const path of roots) {
                try {
                    const snap = await db.ref(path).once("value");
                    if (snap.exists()) {
                        snapshot = snap;
                        break;
                    }
                } catch (_) {}
            }

            // fallback: scan videos node by matching id field
            if (!snapshot || !snapshot.exists()) {
                try {
                    const all = await db.ref(DB_ROOT).orderByKey().limitToLast(80).once("value");
                    all.forEach(function (child) {
                        if (snapshot && snapshot.exists()) return;
                        const v = child.val() || {};
                        if (child.key === state.videoId || v.id === state.videoId) {
                            snapshot = child;
                        }
                    });
                } catch (_) {}
            }

            if (!snapshot || !snapshot.exists()) {
                showPlayerError("This video no longer exists.");
                hidePageLoader();
                return;
            }

            state.video = snapshot.val() || {};
            state.videoId = snapshot.key || state.videoId;
            if (!state.video.id) state.video.id = state.videoId;
            console.log("[VIEWORA] video loaded", state.videoId, {
                hasUrl: !!getVideoUrl(state.video),
                keys: Object.keys(state.video || {}).slice(0, 20)
            });

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

        // allow reload for new videoId
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

            // Media may already be playing — do NOT cover player unless src missing
            const player = $("mainVideo");
            const hasSrc = player && (player.currentSrc || player.src);
            if (!hasSrc) {
                showPlayerError(
                    error.message ||
                    "Unable to open this video."
                );
            } else {
                // non-fatal: comments / recommendations / etc.
                try {
                    toast("Partial load", "Video is ready. Some extras failed.", "info");
                } catch (_) {}
                clearPlayerError();
                hide($("playerLoading"));
            }

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

        show($("playerLoading"));
        clearPlayerError();
        startMediaPlayback(video);
        try {
            const vid =
                (video && (video.id || video.videoId || video.key)) ||
                (typeof state !== "undefined" && state.videoId) ||
                window.currentVideoId ||
                "";
            if (window.VieworaRecordWatch && vid) {
                VieworaRecordWatch({
                    videoId: String(vid),
                    type: "video",
                    title: (video && (video.title || video.name)) || "Video",
                    thumb:
                        (video &&
                            (video.thumbnailUrl ||
                                video.thumbnail ||
                                video.thumb ||
                                video.coverUrl ||
                                video.cover ||
                                video.poster)) ||
                        "",
                    ownerName:
                        (video &&
                            (video.username ||
                                video.userName ||
                                video.ownerName ||
                                video.displayName)) ||
                        ""
                });
            }
        } catch (_) {}

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

    function getCreatorTickHTML(user) {
        if (!user || typeof user !== "object") return "";
        try {
            if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
                const r = VieworaBadges.resolve(user);
                return (r && r.html) ? r.html : "";
            }
        } catch (_) {}
        if (user.redTick || user.redTickForce || user.tickType === "red" || user.vip || user.elite) {
            return '<i class="fa-solid fa-certificate vieworaTick redTick" title="VIP Elite" style="color:#ff3b5c;margin-left:6px"></i>';
        }
        if (user.blueTick || user.verified || user.isVerified) {
            return '<i class="fa-solid fa-circle-check vieworaTick blueTick" title="Verified" style="color:#1d9bf0;margin-left:6px"></i>';
        }
        if (user.whiteTick || user.tickType === "white" || user.monetized) {
            return '<i class="fa-solid fa-circle-check vieworaTick whiteTick" title="Monetized" style="color:#e8eef7;margin-left:6px"></i>';
        }
        return "";
    }

    function renderCreator(user) {

        const video = state.video || {};

        const name = getCreatorName(user, video);

        const username =
            getCreatorUsername(user, video);

        const avatar =
            user?.profilePhoto ||
            user?.photoURL ||
            user?.photoUrl ||
            user?.avatar ||
            user?.profilePic ||
            user?.profileImage ||
            user?.profilePicture ||
            user?.dp ||
            video?.creatorAvatar ||
            "assets/default-avatar.png";

        const nameEl = $("creatorName");
        if (nameEl) {
            nameEl.innerHTML = escapeHTML(name) + getCreatorTickHTML(user || {});
        } else {
            setText("creatorName", name);
        }

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

    let __chromeTimer = null;
    function showPlayerChrome(ms) {
        ms = typeof ms === "number" ? ms : 3800;
        const shell = $("playerShell");
        const chrome = $("playerChrome");
        const bar = $("centerPlayBar");
        const controls = $("customControls");
        try {
            shell && shell.classList.add("showControls");
            chrome && chrome.classList.add("visible");
            bar && bar.classList.add("visible");
            controls && controls.classList.add("visible");
        } catch (_) {}
        clearTimeout(__chromeTimer);
        __chromeTimer = setTimeout(function () {
            try {
                const player = $("mainVideo");
                if (player && player.paused) return; // stay visible when paused
                shell && shell.classList.remove("showControls");
                chrome && chrome.classList.remove("visible");
                bar && bar.classList.remove("visible");
                controls && controls.classList.remove("visible");
            } catch (_) {}
        }, ms);
    }

    function hidePlayerChrome() {
        clearTimeout(__chromeTimer);
        try {
            const player = $("mainVideo");
            if (player && player.paused) return;
            const shell = $("playerShell");
            shell && shell.classList.remove("showControls");
            $("playerChrome") && $("playerChrome").classList.remove("visible");
            $("centerPlayBar") && $("centerPlayBar").classList.remove("visible");
            $("customControls") && $("customControls").classList.remove("visible");
        } catch (_) {}
    }

    function setupPlayer() {

        const player = $("mainVideo");
        if (!player) return;

        // Keep loading visible until metadata/canplay
        try { show($("playerLoading")); } catch (_) {}
        hidePageLoader();

        player.setAttribute("playsinline", "");
        player.setAttribute("webkit-playsinline", "");
        player.playsInline = true;
        player.controls = false; /* custom controls */
        player.preload = "auto";

        const video = state.video || {};
        const poster = getThumbnail(video);
        if (poster) {
            try { player.poster = poster; } catch (_) {}
        }

        const shell = $("playerShell");
        const bigPlay = $("ccBigPlay");
        const playBtn = $("ccPlay");
        const muteBtn = $("ccMute");
        const fsBtn = $("ccFs") || $("playerFsBtn");
        const seek = $("ccSeek");
        const ccCurrent = $("ccCurrent");
        const ccTotal = $("ccTotal");
        const backBtn = $("ccBack");
        const fwdBtn = $("ccFwd");

        function fmt(t) {
            return formatDuration(t);
        }

        function syncTime() {
            const cur = player.currentTime || 0;
            const dur = player.duration || 0;
            if (ccCurrent) ccCurrent.textContent = fmt(cur);
            if (ccTotal) ccTotal.textContent = Number.isFinite(dur) ? fmt(dur) : "0:00";
            if (seek && Number.isFinite(dur) && dur > 0) {
                seek.value = String(Math.round((cur / dur) * 1000));
            }
            const pageDur = $("videoDuration");
            if (pageDur && Number.isFinite(dur) && dur > 0) {
                pageDur.textContent = fmt(dur);
            }
        }

        
        // Mobile play reliability
        try {
            player.setAttribute("playsinline", "");
            player.setAttribute("webkit-playsinline", "");
            player.playsInline = true;
            if (!player.getAttribute("preload")) player.setAttribute("preload", "metadata");
        } catch (_) {}
        player.addEventListener("play", function () { try { setPlayingUI(true); } catch (_) {} });
        player.addEventListener("pause", function () { try { setPlayingUI(false); } catch (_) {} });
        player.addEventListener("playing", function () { try { setPlayingUI(true); } catch (_) {} });
        player.addEventListener("waiting", function () { /* buffering */ });

        function setPlayingUI(playing) {
            shell?.classList.toggle("isPlaying", !!playing);
            const icon = playing
                ? '<i class="fa-solid fa-pause"></i>'
                : '<i class="fa-solid fa-play"></i>';
            if (playBtn) playBtn.innerHTML = icon;
            const big = $("ccBigPlay");
            if (big) big.innerHTML = icon;
            if (!playing) {
                try { showPlayerChrome(4000); } catch (_) {}
            } else {
                try { showPlayerChrome(3800); } catch (_) {}
            }
        }

        function togglePlay() {
            if (player.paused) {
                player.play().catch(() => {});
            } else {
                player.pause();
            }
        }

        backBtn?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            try { player.currentTime = Math.max(0, (player.currentTime || 0) - 10); } catch (_) {}
        });
        fwdBtn?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const d = player.duration || 0;
                player.currentTime = Math.min(d || 1e9, (player.currentTime || 0) + 10);
            } catch (_) {}
        });
        bigPlay?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (player.paused) player.play().catch(function(){});
            else player.pause();
            try { shell?.classList.add("showControls"); } catch (_) {}
        });

        // YouTube-style ±10s on ALL skip buttons (center + any extra)
        if (!player.__skipBound) {
            player.__skipBound = true;
            document.querySelectorAll(".centerSkipBtn, .seekSkipBtn, [data-seek]").forEach(function (btn) {
                btn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var delta = parseInt(btn.getAttribute("data-seek") || "0", 10);
                    if (!delta) {
                        if (btn.id === "ccBack" || btn.classList.contains("back")) delta = -10;
                        else delta = 10;
                    }
                    try {
                        var cur = player.currentTime || 0;
                        var dur = Number.isFinite(player.duration) ? player.duration : 1e9;
                        player.currentTime = Math.max(0, Math.min(dur, cur + delta));
                    } catch (_) {}
                    try { syncTime(); } catch (_) {}
                    try { showPlayerChrome(3000); } catch (_) {}
                });
            });
        }

        // tap player: always toggle play/pause (YouTube-like, reliable on mobile)
        if (shell && !shell.__centerBound) {
            shell.__centerBound = true;
            shell.addEventListener("click", function (e) {
                if (e.target.closest("button, input, a, .customControls, .playerChrome, .centerPlayBar, .seekBar, .progressWrap")) return;
                try {
                    if (player.paused || player.ended) {
                        var p = player.play();
                        if (p && p.catch) p.catch(function () {
                            player.muted = true;
                            player.play().catch(function () {});
                        });
                    } else {
                        player.pause();
                    }
                } catch (_) {}
                try { showPlayerChrome(3800); } catch (_) {}
                try { setPlayingUI(!player.paused); } catch (_) {}
            });
        }

        playBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePlay();
        });
        bigPlay?.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePlay();
        });
        backBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            player.currentTime = Math.max(0, (player.currentTime || 0) - 10);
            syncTime();
            showPlayerChrome(3000);
        });
        fwdBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const dur = player.duration || 0;
            player.currentTime = Math.min(dur, (player.currentTime || 0) + 10);
            syncTime();
            showPlayerChrome(3000);
        });
        muteBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            player.muted = !player.muted;
            muteBtn.innerHTML = player.muted
                ? '<i class="fa-solid fa-volume-xmark"></i>'
                : '<i class="fa-solid fa-volume-high"></i>';
        });
        fsBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePlayerFullscreen();
        });
        seek?.addEventListener("input", () => {
            const dur = player.duration || 0;
            if (!dur) return;
            player.currentTime = (Number(seek.value) / 1000) * dur;
            syncTime();
        });

        // tap video: show ±10s + bottom bar for 3s; if paused, play
        function flashControls() {
            showPlayerChrome(3000);
        }
        player.addEventListener("click", (e) => {
            // don't steal clicks from seek buttons
            if (e.target.closest && e.target.closest(".seekSkipBtn, .customControls, .playerChrome")) return;
            if (player.paused) {
                togglePlay();
                showPlayerChrome(3000);
            } else {
                showPlayerChrome(3000);
            }
        });
        shell?.addEventListener("touchstart", function () {
            showPlayerChrome(3000);
        }, { passive: true });

        player.addEventListener("loadedmetadata", () => {
            hide($("playerLoading"));
            syncTime();
            if (video.duration) {
                /* keep */
            } else if (Number.isFinite(player.duration)) {
                setText("videoDuration", fmt(player.duration));
            }
        });
        player.addEventListener("timeupdate", syncTime);
        player.addEventListener("loadeddata", () => {
            hide($("playerLoading"));
            try {
                const sh = $("playerShell");
                if (sh) sh.classList.add("videoReady");
            } catch (_) {}
        });
        player.addEventListener("canplay", () => {
            hide($("playerLoading"));
            clearPlayerError();
            try {
                const sh = $("playerShell");
                if (sh) sh.classList.add("videoReady");
            } catch (_) {}
            try { syncTime(); } catch (_) {}
            if (!player.__vieworaAutoplay) {
                player.__vieworaAutoplay = true;
                try { hide($("playerLoading")); } catch (_) {}
                try {
                    player.muted = true; // mobile autoplay policy
                    var p = player.play();
                    if (p && p.then) {
                        p.then(function () {
                            setPlayingUI(true);
                            // unmute after start if user already interacted
                            try {
                                if (window.__vieworaUserGesture) {
                                    player.muted = false;
                                }
                            } catch (_) {}
                        }).catch(function () {
                            try {
                                player.muted = true;
                                player.play().catch(function () {});
                            } catch (_) {}
                        });
                    }
                } catch (_) {}
            }
        });
        player.addEventListener("loadeddata", () => {
            hide($("playerLoading"));
            clearPlayerError();
            try { syncTime(); } catch (_) {}
        });
        player.addEventListener("loadedmetadata", () => {
            hide($("playerLoading"));
            try { syncTime(); } catch (_) {}
            if (Number.isFinite(player.duration) && player.duration > 0) {
                setText("videoDuration", formatDuration(player.duration));
                if (ccTotal) ccTotal.textContent = formatDuration(player.duration);
            }
        });
        player.addEventListener("waiting", () => hide($("playerLoading")));
        player.addEventListener("playing", () => {
            hide($("playerLoading"));
            setPlayingUI(true);
            flashControls();
        });
        player.addEventListener("pause", () => setPlayingUI(false));
        player.addEventListener("error", () => {
            const src = player.currentSrc || player.src || "";
            if (!src) return;
            const code = player.error && player.error.code;
            console.warn("[VIEWORA] media error", code, src);
            // try remaining candidates
            if (tryNextMediaCandidate()) return;
            // last attempt: strip transforms
            if (!player.__stripRetry && src) {
                player.__stripRetry = true;
                const stripped = src
                    .replace(/\/upload\/f_mp4,q_auto\//i, "/upload/")
                    .replace(/\/upload\/f_mp4\//i, "/upload/");
                if (stripped !== src) {
                    applyMediaToPlayer(stripped);
                    return;
                }
            }
            showPlayerError("Video unavailable — file missing or format not supported.");
        });
        player.addEventListener("ended", () => {
            setPlayingUI(false);
            loadRecommendations();
        });

        // DB duration if present
        if (video.duration) {
            setText("videoDuration", fmt(video.duration));
        }

        window.__vieworaToggleFullscreen = function () {
            if (typeof togglePlayerFullscreen === "function") {
                togglePlayerFullscreen();
                return;
            }
            try {
                if (document.fullscreenElement) {
                    document.exitFullscreen?.();
                } else if (shell?.requestFullscreen) {
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

        if (videoLikeInFlight) return;

        // Spam guard
        const now = Date.now();
        while (videoLikeSpam.length && now - videoLikeSpam[0] > VIDEO_LIKE_SPAM_WINDOW) {
            videoLikeSpam.shift();
        }
        videoLikeSpam.push(now);
        if (videoLikeSpam.length >= VIDEO_LIKE_SPAM_LIMIT) {
            try {
                window.alert(
                    "Please do not spam likes. Rapid like / unlike is against Viewora Community Guidelines. Repeated abuse may lead to account suspension."
                );
            } catch (_) {}
            return;
        }

        const db = getFirebaseDatabase();
        if (!db || !state.videoId) return;

        const uid = user.uid;
        const likeRef = db.ref(
            `${DB_ROOT}/${state.videoId}/likedBy/${uid}`
        );
        const dislikeRef = db.ref(
            `${DB_ROOT}/${state.videoId}/dislikedBy/${uid}`
        );

        videoLikeInFlight = true;
        const btn = $("likeBtn");
        if (btn) btn.style.pointerEvents = "none";

        try {
            let wasLiked = state.liked;
            const before = await likeRef.once("value");
            wasLiked = before.exists() || state.liked;

            // Optimistic UI
            state.liked = !wasLiked;
            let optimistic = safeNumber(state.video?.likeCount ?? state.video?.likes);
            if (!wasLiked) optimistic += 1;
            else optimistic = Math.max(0, optimistic - 1);
            if (state.video) {
                state.video.likeCount = optimistic;
                state.video.likes = optimistic;
            }
            try { updateLikeCount(); renderActionStates(); } catch (_) {}

            await likeRef.transaction((cur) => {
                if (cur === null) return true;
                return null;
            });

            const after = await likeRef.once("value");
            const isLiked = after.exists();
            state.liked = isLiked;

            // Remove dislike if liking
            if (isLiked && state.disliked) {
                await dislikeRef.remove();
                state.disliked = false;
            }

            // Count from likedBy tree
            let likeCount = 0;
            try {
                const tree = await db
                    .ref(`${DB_ROOT}/${state.videoId}/likedBy`)
                    .once("value");
                if (tree.exists()) {
                    likeCount = Object.keys(tree.val() || {}).length;
                }
            } catch (_) {
                likeCount = safeNumber(state.video?.likeCount);
                if (isLiked && !wasLiked) likeCount += 1;
                if (!isLiked && wasLiked) likeCount = Math.max(0, likeCount - 1);
            }

            let dislikeCount = safeNumber(
                state.video?.dislikeCount ?? state.video?.dislikes
            );
            try {
                const dtree = await db
                    .ref(`${DB_ROOT}/${state.videoId}/dislikedBy`)
                    .once("value");
                if (dtree.exists()) {
                    dislikeCount = Object.keys(dtree.val() || {}).length;
                }
            } catch (_) {}

            state.video.likeCount = likeCount;
            state.video.likes = likeCount;
            state.video.dislikeCount = dislikeCount;
            state.video.dislikes = dislikeCount;

            await db.ref(`${DB_ROOT}/${state.videoId}`).update({
                likeCount: likeCount,
                likes: likeCount,
                dislikeCount: dislikeCount,
                dislikes: dislikeCount
            });

            updateLikeCount();
            renderActionStates();

        } catch (error) {
            console.error("Like failed:", error);
            toast("Like failed", "Please try again.", "error");
        } finally {
            videoLikeInFlight = false;
            if (btn) btn.style.pointerEvents = "";
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
            // Check all paths used across Viewora (profile / activity / index)
            let isFollowing = false;
            const paths = [
                `${USERS_ROOT}/${user.uid}/following/${creatorId}`,
                `following/${user.uid}/${creatorId}`,
                `${USERS_ROOT}/${creatorId}/followers/${user.uid}`,
                `followers/${creatorId}/${user.uid}`
            ];
            for (const p of paths) {
                try {
                    const snap = await db.ref(p).once("value");
                    if (!snap.exists()) continue;
                    const v = snap.val();
                    if (v === true || v === 1 || (v && typeof v === "object")) {
                        isFollowing = true;
                        break;
                    }
                } catch (_) {}
            }
            state.following = isFollowing;
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
        // visual style when already following
        if (state.following) {
            btn.style.background = "rgba(255,255,255,.12)";
            btn.style.color = "#fff";
            btn.style.border = "1px solid rgba(255,255,255,.18)";
        } else {
            btn.style.background = "";
            btn.style.color = "";
            btn.style.border = "";
        }
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
                try { await db.ref(`following/${user.uid}/${creatorId}`).remove(); } catch (_) {}
                try { await db.ref(`followers/${creatorId}/${user.uid}`).remove(); } catch (_) {}
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
                try { await db.ref(`following/${user.uid}/${creatorId}`).set(true); } catch (_) {}
                try { await db.ref(`followers/${creatorId}/${user.uid}`).set({
                    uid: user.uid,
                    followedAt: firebase.database.ServerValue.TIMESTAMP
                }); } catch (_) {}
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

    
    function formatRelativeTime(ts) {
        const t = Number(ts);
        if (!t) return "";
        const diff = Date.now() - t;
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
        if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
        if (diff < 604800000) return Math.floor(diff / 86400000) + "d ago";
        try {
            return new Date(t).toLocaleDateString();
        } catch (_) {
            return "";
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
            try { updateYtCommentsPreview(); } catch (_) {}
            return;
        }

        hide(empty);

        entries.forEach(comment => {
            const item = document.createElement("article");
            item.className = "commentItem";
            item.dataset.uid = comment.uid || comment.userId || "";

            const avatar =
                comment.avatar ||
                comment.photoURL ||
                comment.profilePhoto ||
                "assets/default-avatar.png";

            const username = String(
                comment.username ||
                comment.userName ||
                comment.name ||
                "user"
            ).replace(/^@/, "");

            const displayName = String(
                comment.name || comment.displayName || username
            );

            const text = comment.text || comment.comment || "";
            const uid = comment.uid || comment.userId || "";
            const time = formatRelativeTime
                ? formatRelativeTime(comment.createdAt || comment.timestamp)
                : "";

            item.innerHTML = `
                <button type="button" class="commentAvatarBtn" data-uid="${escapeHTML(uid)}" aria-label="Open profile">
                    <div class="commentAvatar">
                        <img
                            src="${escapeHTML(avatar)}"
                            alt=""
                            onerror="this.src=\'assets/default-avatar.png\'"
                        >
                    </div>
                </button>
                <div class="commentBody">
                    <div class="commentMeta">
                        <button type="button" class="commentUserBtn" data-uid="${escapeHTML(uid)}">
                            <strong>@${escapeHTML(username)}</strong>
                        </button>
                        <span class="commentTime">${escapeHTML(String(time || ""))}</span>
                    </div>
                    <p class="commentText">${escapeHTML(text)}</p>
                </div>
            `;

            list.appendChild(item);
        });

        // Click avatar/name → profile (story ring handled on profile)
        list.querySelectorAll("[data-uid]").forEach(function (el) {
            el.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                const uid = el.getAttribute("data-uid");
                if (!uid) return;
                window.location.href =
                    "profile.html?uid=" + encodeURIComponent(uid);
            });
        });

        // Enrich missing avatars from users/{uid}
        entries.forEach(async function (c) {
            const uid = c.uid || c.userId;
            if (!uid) return;
            if (c.avatar || c.photoURL || c.profilePhoto) return;
            try {
                const db = getFirebaseDatabase();
                if (!db) return;
                const snap = await db.ref("users/" + uid).once("value");
                const u = snap.val() || {};
                const photo =
                    u.profilePhoto || u.photoURL || u.avatar || "";
                if (!photo) return;
                const img = list.querySelector(
                    '.commentAvatarBtn[data-uid="' + uid + '"] img'
                );
                if (img) img.src = photo;
                const nameBtn = list.querySelector(
                    '.commentUserBtn[data-uid="' + uid + '"] strong'
                );
                if (nameBtn && (u.username || u.displayName)) {
                    nameBtn.textContent =
                        "@" + String(u.username || u.displayName).replace(/^@/, "");
                }
            } catch (_) {}
        });
    }

    
    async function loadMyCommentAvatar() {
        try {
            const user = getCurrentUser();
            if (!user) return;
            const db = getFirebaseDatabase();
            let photo = user.photoURL || "";
            if (db) {
                try {
                    const snap = await db.ref("users/" + user.uid).once("value");
                    const u = snap.val() || {};
                    photo =
                        u.profilePhoto ||
                        u.photoURL ||
                        u.avatar ||
                        photo ||
                        "";
                } catch (_) {}
            }
            photo = photo || "assets/default-avatar.png";
            const apply = function (el) {
                if (!el) return;
                el.src = photo;
                el.onerror = function () {
                    this.onerror = null;
                    this.src = "assets/default-avatar.png";
                };
            };
            apply($("currentUserAvatar"));
            apply($("csAvatar"));
            apply($("ytPreviewAvatar"));
        } catch (_) {}
    }

    let __commentInFlight = false;
    let __replyToId = null;

    async function postComment(opts) {
        opts = opts || {};
        const user = getCurrentUser();
        if (!user) {
            toast("Sign in required", "Sign in to comment on this video.", "info");
            return;
        }
        if (!state.videoId) {
            toast("Error", "Video not loaded yet.", "error");
            return;
        }
        if (__commentInFlight) return;
        __commentInFlight = true;

        const input = $("commentInput");
        const csInput = $("csInput");
        let text = "";
        if (opts.text) text = String(opts.text).trim();
        else if (csInput && csInput.value.trim()) text = csInput.value.trim();
        else if (input) text = input.value.trim();

        if (!text) {
            __commentInFlight = false;
            toast("Write a comment", "Your comment is empty.", "info");
            return;
        }

        const db = getFirebaseDatabase();
        if (!db) {
            __commentInFlight = false;
            toast("Offline", "Database not available.", "error");
            return;
        }

        const btn = $("postCommentBtn");
        const csBtn = $("csPostBtn");
        if (btn) { btn.disabled = true; btn.textContent = "…"; }
        if (csBtn) { csBtn.disabled = true; }

        try {
            let profile = {};
            try {
                const snap = await db.ref("users/" + user.uid).once("value");
                profile = snap.val() || {};
            } catch (_) {}

            const displayName = String(
                profile.displayName ||
                profile.name ||
                user.displayName ||
                profile.username ||
                "User"
            ).replace(/^@/, "");
            const handle = String(
                profile.username || displayName
            ).replace(/^@/, "").replace(/\s+/g, "").toLowerCase() || "user";

            const avatar =
                profile.profilePhoto ||
                profile.photoURL ||
                profile.avatar ||
                user.photoURL ||
                "assets/default-avatar.png";

            const key = db.ref(COMMENTS_ROOT + "/" + state.videoId).push().key;
            const parentId = opts.parentId || __replyToId || null;
            let replyToName = __replyToName || "";
            let replyToUid = "";
            if (parentId && state.comments && state.comments[parentId]) {
                const p = state.comments[parentId];
                replyToName =
                    replyToName ||
                    p.displayName ||
                    p.username ||
                    p.name ||
                    "";
                replyToUid = p.uid || p.userId || "";
            }
            // Prefix @mention if reply and text doesn't already mention
            let finalText = text;
            if (parentId && replyToName) {
                const mention = "@" + String(replyToName).replace(/^@/, "");
                if (finalText.indexOf(mention) !== 0) {
                    finalText = mention + " " + finalText;
                }
            }
            const comment = {
                id: key,
                uid: user.uid,
                userId: user.uid,
                username: displayName,
                userHandle: handle,
                name: displayName,
                displayName: displayName,
                avatar: avatar,
                photoURL: avatar,
                profilePhoto: avatar,
                text: finalText,
                createdAt: Date.now(),
                timestamp: Date.now(),
                likesCount: 0,
                parentId: parentId || null,
                replyToName: replyToName || null,
                replyToUid: replyToUid || null,
                blueTick: !!(profile.blueTick || profile.verified || profile.isVerified),
                redTick: !!(profile.redTick || profile.vip || profile.elite),
                whiteTick: !!(profile.whiteTick || profile.monetized),
                verified: !!(profile.verified || profile.isVerified || profile.blueTick)
            };

            // SINGLE write path only — prevents duplicate reads from dual trees
            await db.ref(COMMENTS_ROOT + "/" + state.videoId + "/" + key).set(comment);

            state.comments = state.comments || {};
            state.comments[key] = comment;

            if (input) input.value = "";
            if (csInput) csInput.value = "";
            __replyToId = null;
            __replyToName = "";
            try {
                const hint = $("csReplyHint");
                if (hint) hint.classList.add("hidden");
                if (csInput) csInput.placeholder = "Add a comment...";
            } catch (_) {}

            try { await incrementCommentCount(1); } catch (_) {}
            try { renderComments(); } catch (_) {}
            try { await renderCommentsSheet(); } catch (_) {}
            try { updateYtCommentsPreview(); } catch (_) {}
            toast("Comment posted", "Your comment is now visible.");
        } catch (error) {
            console.error("Comment failed:", error);
            toast("Comment failed", error.message || "Please try again.", "error");
        } finally {
            __commentInFlight = false;
            if (btn) { btn.disabled = false; btn.textContent = "Post"; }
            if (csBtn) { csBtn.disabled = false; }
        }
    }

    const __commentLikeInFlight = {};
    async function toggleCommentLike(commentId, btnEl) {
        const user = getCurrentUser();
        if (!user || !state.videoId || !commentId) return;
        if (__commentLikeInFlight[commentId]) return;
        __commentLikeInFlight[commentId] = true;
        const db = getFirebaseDatabase();
        if (!db) {
            __commentLikeInFlight[commentId] = false;
            return;
        }
        const ref = db.ref(
            COMMENTS_ROOT + "/" + state.videoId + "/" + commentId + "/likedBy/" + user.uid
        );
        try {
            const snap = await ref.once("value");
            const was = snap.exists();
            if (was) await ref.remove();
            else await ref.set(true);
            const tree = await db
                .ref(COMMENTS_ROOT + "/" + state.videoId + "/" + commentId + "/likedBy")
                .once("value");
            const count = tree.exists() ? Object.keys(tree.val() || {}).length : 0;
            await db.ref(COMMENTS_ROOT + "/" + state.videoId + "/" + commentId).update({
                likesCount: count,
                likes: count
            });
            if (state.comments && state.comments[commentId]) {
                state.comments[commentId].likesCount = count;
                state.comments[commentId].likes = count;
            }
            // Update UI in place — no full re-render (prevents glitch/duplicates)
            const targets = document.querySelectorAll('[data-c-like="' + commentId + '"]');
            targets.forEach(function (btn) {
                btn.innerHTML =
                    (was
                        ? '<i class="fa-regular fa-heart"></i> '
                        : '<i class="fa-solid fa-heart" style="color:#ff304f"></i> ') +
                    count;
            });
        } catch (e) {
            console.warn(e);
        } finally {
            __commentLikeInFlight[commentId] = false;
        }
    }

    let __replyToName = "";
    function startReplyTo(comment) {
        if (!comment) return;
        __replyToId = comment.id;
        __replyToName = String(
            comment.displayName || comment.username || comment.name || "user"
        ).replace(/^@/, "");
        const csInput = $("csInput");
        if (csInput) {
            csInput.focus();
            csInput.placeholder = "Reply to @" + __replyToName + "…";
            if (!csInput.value.trim()) {
                // optional: don't auto-insert @ so user types freely; show in hint
            }
        }
        let hint = $("csReplyHint");
        if (!hint) {
            const composer = document.querySelector(".csComposer");
            if (composer) {
                hint = document.createElement("div");
                hint.id = "csReplyHint";
                hint.className = "csReplyHint";
                composer.insertBefore(hint, composer.firstChild);
            }
        }
        if (hint) {
            hint.classList.remove("hidden");
            hint.innerHTML =
                '<span>Replying to <b>@' +
                escapeHTML(__replyToName) +
                "</b></span>" +
                '<button type="button" id="csReplyCancel">Cancel</button>';
            $("csReplyCancel")?.addEventListener("click", function () {
                __replyToId = null;
                __replyToName = "";
                hint.classList.add("hidden");
                if (csInput) csInput.placeholder = "Add a comment...";
            });
        }
    }


    async function incrementCommentCount(delta) {
        delta = typeof delta === "number" ? delta : 1;

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

        const container = $("recommendedVideos");
        if (!container) return;

        try {
            container.innerHTML = '<div class="relatedLoadingRow"><div class="spin"></div><span>Loading videos…</span></div>';
            hide($("videoRecommendationsEmpty"));
        } catch (_) {}

        try {
            const roots = [DB_ROOT, "longVideos", "lives", "liveVideos"];
            let merged = {};
            for (let r = 0; r < roots.length; r++) {
                try {
                    const snapshot = await db.ref(roots[r]).limitToLast(80).once("value");
                    const data = snapshot.val() || {};
                    Object.keys(data).forEach(function (id) {
                        const item = data[id] || {};
                        // include ended lives that have a saved video URL
                        const isLiveActive = item.isLive === true || item.live === true || item.status === "live";
                        if (isLiveActive) return;
                        merged[id] = Object.assign({}, item, { id: id });
                    });
                } catch (_) {}
            }
            const currentId = state.videoId;

            let list = Object.keys(merged)
                .map(function (id) {
                    return Object.assign({ id: id }, merged[id] || {});
                })
                .filter(function (item) {
                    return (
                        item.id !== currentId &&
                        !!getVideoUrl(item) &&
                        String(item.visibility || "public").toLowerCase() === "public" &&
                        item.deleted !== true
                    );
                });

            // light shuffle so feed is not always same order
            list.sort(function (a, b) {
                const score = function (v) {
                    return safeNumber(v.views) * 2 + safeNumber(v.createdAt || v.timestamp) / 1e10;
                };
                return score(b) - score(a) + (Math.random() * 0.15 - 0.07);
            });

            state.recommendations = list.slice(0, 24);
            state.topRecommendations = state.recommendations.slice(0, 3);
            state.moreRecommendations = state.recommendations.slice(3);

            renderRecommendations();
            await renderMixedFeed();

        } catch (error) {
            console.warn("Recommendations failed:", error);
            state.recommendationsLoaded = false;
        }
    }

    function renderRecommendations() {
        const container = $("recommendedVideos");
        const empty = $("videoRecommendationsEmpty");
        if (!container) return;
        container.innerHTML = "";

        const top = state.topRecommendations || state.recommendations.slice(0, 3);
        if (!top.length) {
            show(empty);
            return;
        }
        hide(empty);
        top.forEach(function (video) {
            container.appendChild(createVideoCard(video));
        });
    }

    async function loadRandomPosts(limit) {
        limit = limit || 8;
        const db = getFirebaseDatabase();
        if (!db) return [];
        try {
            const snap = await db.ref("posts").limitToLast(40).once("value");
            const data = snap.val() || {};
            let list = Object.entries(data)
                .map(function (p) {
                    return Object.assign({ id: p[0] }, p[1] || {});
                })
                .filter(function (p) {
                    const t = String(p.type || p.postType || "").toLowerCase();
                    if (t === "video" || t === "short" || t === "shorts" || t === "live" || t === "story") return false;
                    if (p.deleted === true || p.hidden === true) return false;
                    if (p.isLive === true || p.live === true || p.liveEnded === true) return false;
                    if (p.liveId || p.streamId) return false;

                    const text = String(p.caption || p.text || p.description || p.message || "").toLowerCase();
                    if (text.indexOf("live ended") !== -1) return false;
                    if (text === "u" || text === "g" || text === "hey" || text.length <= 2) {
                        // skip tiny leftover live messages unless they have real media
                        const hasStrongMedia =
                            p.imageUrl ||
                            (Array.isArray(p.images) && p.images.length) ||
                            (Array.isArray(p.mediaUrls) && p.mediaUrls.length);
                        if (!hasStrongMedia) return false;
                    }

                    const hasImg =
                        p.imageUrl ||
                        p.mediaUrl ||
                        p.thumbnailUrl ||
                        (Array.isArray(p.images) && p.images.length) ||
                        (Array.isArray(p.mediaUrls) && p.mediaUrls.length);
                    // prefer posts with image; allow text-only if meaningful
                    if (hasImg) return true;
                    if (text.length >= 8 && text.indexOf("live") === -1) return true;
                    return false;
                });
            // shuffle
            for (let i = list.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = list[i];
                list[i] = list[j];
                list[j] = tmp;
            }
            return list.slice(0, limit);
        } catch (e) {
            console.warn("posts load", e);
            return [];
        }
    }

    function createPostCard(post) {
        const card = document.createElement("article");
        card.className = "mixedPostCard";
        const uid = post.uid || post.userId || post.ownerId || "";
        let name = String(
            post.displayName || post.username || post.name || "Viewora User"
        ).replace(/^@/, "");
        const text = post.caption || post.text || post.description || "";
        let img = "";
        if (Array.isArray(post.images) && post.images[0]) {
            img = typeof post.images[0] === "string" ? post.images[0] : (post.images[0].url || "");
        }
        if (!img && Array.isArray(post.mediaUrls) && post.mediaUrls[0]) {
            img = typeof post.mediaUrls[0] === "string" ? post.mediaUrls[0] : (post.mediaUrls[0].url || "");
        }
        if (!img) img = post.imageUrl || post.mediaUrl || post.thumbnailUrl || "";
        let avatar = post.userPhoto || post.profilePhoto || post.photoURL || post.avatar || "";
        let tick = tickFromUser(post);

        function paint() {
            card.innerHTML =
                '<span class="mpTag">Post</span>' +
                '<div class="mpHeader">' +
                (avatar
                    ? '<img src="' + escapeHTML(avatar) + '" alt="" onerror="this.style.display=\'none\'">'
                    : '<span class="mpInitial">' + escapeHTML((name.charAt(0) || "?").toUpperCase()) + "</span>") +
                "<div><strong>" +
                escapeHTML(name) +
                (tick ? '<span class="recTick">' + tick + "</span>" : "") +
                "</strong>" +
                (post.username ? "<span>@" + escapeHTML(String(post.username).replace(/^@/, "")) + "</span>" : "") +
                "</div></div>" +
                (text
                    ? '<div class="mpText">' +
                      escapeHTML(text.slice(0, 280)) +
                      (text.length > 280 ? "…" : "") +
                      "</div>"
                    : "") +
                (img
                    ? '<div class="mpMedia"><img src="' + escapeHTML(img) + '" alt="" loading="lazy"></div>'
                    : "") +
                '<div class="mpActions">' +
                '<button type="button" class="mpLikeBtn" data-post-like="1">' +
                '<i class="fa-regular fa-heart"></i> <span data-like-n="1">' +
                String(safeNumber(post.likesCount || post.likes || 0)) +
                "</span></button>" +
                '<button type="button" class="mpOpenBtn">Open</button>' +
                "</div>";
        }
        paint();

        card.addEventListener("click", function (e) {
            if (e.target.closest("[data-post-like]")) return;
            if (post.id) {
                location.href = "post.html?id=" + encodeURIComponent(post.id);
            } else if (uid) {
                location.href = "profile.html?uid=" + encodeURIComponent(uid);
            }
        });

        card.querySelector("[data-post-like]")?.addEventListener("click", async function (e) {
            e.preventDefault();
            e.stopPropagation();
            const me = getCurrentUser();
            if (!me) {
                toast("Sign in required", "Sign in to like posts.", "info");
                return;
            }
            if (!post.id) return;
            const db = getFirebaseDatabase();
            if (!db) return;
            const ref = db.ref("posts/" + post.id + "/likedBy/" + me.uid);
            try {
                const snap = await ref.once("value");
                const liked = snap.exists();
                if (liked) await ref.remove();
                else await ref.set(true);
                const tree = await db.ref("posts/" + post.id + "/likedBy").once("value");
                const count = tree.exists() ? Object.keys(tree.val() || {}).length : 0;
                await db.ref("posts/" + post.id).update({ likesCount: count, likes: count });
                const nEl = card.querySelector("[data-like-n]");
                if (nEl) nEl.textContent = String(count);
                const icon = card.querySelector("[data-post-like] i");
                if (icon) {
                    icon.className = liked ? "fa-regular fa-heart" : "fa-solid fa-heart";
                    icon.style.color = liked ? "" : "#ff304f";
                }
            } catch (err) {
                console.warn(err);
            }
        });

        if (uid) {
            (async function () {
                try {
                    const db = getFirebaseDatabase();
                    if (!db) return;
                    const snap = await db.ref("users/" + uid).once("value");
                    const u = snap.val();
                    if (!u) return;
                    name = String(u.displayName || u.name || u.username || name).replace(/^@/, "");
                    avatar =
                        u.profilePhoto ||
                        u.photoURL ||
                        u.avatar ||
                        avatar;
                    tick = tickFromUser(u);
                    if (u.username) post.username = u.username;
                    paint();
                } catch (_) {}
            })();
        }

        return card;
    }


    async function renderMixedFeed() {
        const feed = $("mixedFeed");
        if (!feed) return;
        feed.innerHTML = "";

        const more = (state.moreRecommendations || []).slice();
        const posts = await loadRandomPosts(6);

        // Mix: every ~4-5 videos insert a post (randomly ~ after 3–6 items)
        let postIdx = 0;
        let sincePost = 0;
        const nextGap = function () {
            return 3 + Math.floor(Math.random() * 4); // 3–6
        };
        let gap = nextGap();

        more.forEach(function (video, i) {
            feed.appendChild(createVideoCard(video));
            sincePost += 1;
            if (sincePost >= gap && postIdx < posts.length) {
                feed.appendChild(createPostCard(posts[postIdx++]));
                sincePost = 0;
                gap = nextGap();
            }
        });
        // leftover posts
        while (postIdx < posts.length) {
            feed.appendChild(createPostCard(posts[postIdx++]));
        }
    }

    function tickFromUser(user) {
        try {
            if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
                const r = VieworaBadges.resolve(user || {});
                return (r && r.html) ? r.html : "";
            }
        } catch (_) {}
        return getCreatorTickHTML(user);
    }

    function createVideoCard(video) {
        const card = document.createElement("article");
        card.className = "recommendVideoCard recommendationCard";

        const thumbnail = getThumbnail(video);
        const title = video.title || "Untitled video";
        const views = formatNumber(video.views || 0);
        const date = formatDate(video.createdAt || video.timestamp);
        const uid = video.uid || video.userId || video.ownerId || video.creatorId || "";

        let creatorName =
            video.displayName ||
            video.creatorName ||
            video.username ||
            video.name ||
            "Viewora Creator";
        let tick = tickFromUser(video);

        card.innerHTML =
            '<button class="recommendThumb" type="button">' +
            (thumbnail
                ? '<img src="' + escapeHTML(thumbnail) + '" alt="" loading="lazy">'
                : '<div class="recommendThumbFallback"><i class="fa-solid fa-play"></i></div>') +
            '<span class="recommendDuration">' + formatDuration(video.duration) + "</span>" +
            "</button>" +
            '<div class="recommendInfo">' +
            '<strong class="recommendTitle">' + escapeHTML(title) + "</strong>" +
            '<span class="recommendCreator" data-creator-line="1">' +
            escapeHTML(String(creatorName).replace(/^@/, "")) +
            (tick ? '<span class="recTick">' + tick + "</span>" : "") +
            "</span>" +
            '<span class="recommendMeta">' + views + " views • " + escapeHTML(date) + "</span>" +
            "</div>";

        card.addEventListener("click", function () {
            const id = video.id || video.videoId;
            if (!id) return;
            const vUrl = getVideoUrl(video) || "";
            try {
                localStorage.setItem("vieworaVideoId", id);
                sessionStorage.setItem(
                    "viewora_open_video",
                    JSON.stringify({ id: id, url: vUrl, at: Date.now() })
                );
            } catch (_) {}
            window.location.href = "video.html?id=" + encodeURIComponent(id);
        });

        // Enrich name + tick from users/{uid}
        if (uid) {
            (async function () {
                try {
                    const db = getFirebaseDatabase();
                    if (!db) return;
                    const snap = await db.ref("users/" + uid).once("value");
                    const u = snap.val();
                    if (!u) return;
                    const name = String(
                        u.displayName || u.name || u.username || creatorName
                    ).replace(/^@/, "");
                    const t = tickFromUser(u);
                    const line = card.querySelector("[data-creator-line]");
                    if (line) {
                        line.innerHTML =
                            escapeHTML(name) + (t ? '<span class="recTick">' + t + "</span>" : "");
                    }
                } catch (_) {}
            })();
        }

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
                "shortRecommendationCard recommendedShortCard shortCard";

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

                <strong class="shortsTitle" data-short-title="1"
                    data-short-id="${escapeHTML(short.id || "")}"
                    data-desc="${escapeHTML(short.description || short.caption || title)}"
                    data-created="${escapeHTML(String(short.createdAt || short.timestamp || ""))}"
                    data-music="${escapeHTML(short.musicUrl || short.audioUrl || "")}"
                    data-music-id="${escapeHTML(short.musicId || short.audioId || "")}">
                    ${escapeHTML(title)}
                </strong>

                <span>
                    ${formatNumber(short.views || 0)} views
                </span>
            `;

            card.addEventListener("click", (e) => {
                // title click → description sheet
                if (e.target.closest(".shortsTitle, [data-short-title]")) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof openShortDescriptionSheet === "function") {
                        openShortDescriptionSheet(short);
                    } else if (window.openShortDescriptionSheet) {
                        window.openShortDescriptionSheet(short);
                    }
                    return;
                }
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

    function openShare(item) {
        const id = (item && (item.id || item.videoId)) || (new URLSearchParams(location.search).get("id")) || "";
        if (window.VieworaShare) {
            VieworaShare.open({
                type: "video",
                id: id,
                url: location.origin + "/video.html?id=" + encodeURIComponent(id),
                title: (item && (item.title || item.caption)) || "Viewora Video"
            });
            return;
        }
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

        const params = new URLSearchParams();
        params.set("type", "video");
        if (state.videoId) params.set("id", state.videoId);
        const creatorId = getCreatorId(state.video || {});
        if (creatorId) params.set("uid", creatorId);
        window.location.href = "report.html?" + params.toString();
    }

    /* ========================================================
       INTERACTIONS
    ======================================================== */

    
    /* ========================================================
       PLAYER SETTINGS (YouTube-style 3-dot)
    ======================================================== */

    const playerSettings = {
        quality: "auto",
        speed: 1,
        loop: false,
        ambient: false,
        stable: false,
        lock: false,
        sleepMin: 0,
        sleepTimer: null
    };

    function openPlayerSettings() {
        show($("playerSettingsOverlay"));
        syncPlayerSettingsUI();
    }

    function closePlayerSettings() {
        hide($("playerSettingsOverlay"));
        hide($("psQualityOverlay"));
        hide($("psSpeedOverlay"));
        hide($("psSleepOverlay"));
    }

    function syncPlayerSettingsUI() {
        const q = $("psQualityLabel");
        if (q) q.textContent = playerSettings.quality === "auto" ? "Auto" : playerSettings.quality + "p";
        const s = $("psSpeedLabel");
        if (s) s.textContent = playerSettings.speed === 1 ? "1x" : playerSettings.speed + "x";
        const loop = $("psLoopLabel");
        if (loop) loop.textContent = playerSettings.loop ? "On" : "Off";
        const amb = $("psAmbientLabel");
        if (amb) amb.textContent = playerSettings.ambient ? "On" : "Off";
        const st = $("psStableLabel");
        if (st) st.textContent = playerSettings.stable ? "On" : "Off";
        const lk = $("psLockLabel");
        if (lk) lk.textContent = playerSettings.lock ? "On" : "Off";
        const sl = $("psSleepLabel");
        if (sl) {
            sl.textContent = playerSettings.sleepMin
                ? (playerSettings.sleepMin >= 60 ? "1 hour" : playerSettings.sleepMin + " min")
                : "Off";
        }
    }

    function applyPlaybackRate() {
        const player = $("mainVideo");
        if (player) player.playbackRate = playerSettings.speed || 1;
    }

    function applyLoop() {
        const player = $("mainVideo");
        if (player) player.loop = !!playerSettings.loop;
    }

    function applyAmbient() {
        document.body.classList.toggle("ambientOn", !!playerSettings.ambient);
    }

    function applyStableVolume() {
        const player = $("mainVideo");
        if (!player) return;
        // Soft normalize: clamp volume a bit when enabled
        if (playerSettings.stable) {
            player.volume = Math.min(0.85, Math.max(0.4, player.volume || 0.85));
        }
    }

    function setSleepTimer(minutes) {
        if (playerSettings.sleepTimer) {
            clearTimeout(playerSettings.sleepTimer);
            playerSettings.sleepTimer = null;
        }
        playerSettings.sleepMin = minutes || 0;
        if (!minutes) {
            syncPlayerSettingsUI();
            return;
        }
        playerSettings.sleepTimer = setTimeout(() => {
            const player = $("mainVideo");
            try { player?.pause(); } catch (_) {}
            toast("Sleep timer", "Video paused.", "info");
            playerSettings.sleepMin = 0;
            playerSettings.sleepTimer = null;
            syncPlayerSettingsUI();
        }, minutes * 60 * 1000);
        syncPlayerSettingsUI();
        toast("Sleep timer", "Video will pause in " + minutes + " min.", "info");
    }

    function togglePlayerFullscreen() {
        const shell = $("playerShell") || $("mainVideo");
        const player = $("mainVideo");
        try {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
            } else if (shell?.requestFullscreen) {
                shell.requestFullscreen();
            } else if (shell?.webkitRequestFullscreen) {
                shell.webkitRequestFullscreen();
            } else if (player?.webkitEnterFullscreen) {
                player.webkitEnterFullscreen();
            }
        } catch (e) {
            console.warn("Fullscreen failed:", e);
        }
    }

    function setupPlayerSettings() {
        
        $("videoTitle")?.addEventListener("click", openDescSheet);
        // description box removed — title / More opens sheet
        $("descriptionToggle")?.addEventListener("click", openDescSheet);
        $("descSeeMore")?.addEventListener("click", () => {
            $("descBody")?.classList.toggle("expanded");
            const b = $("descSeeMore");
            if (b) b.textContent = $("descBody")?.classList.contains("expanded") ? "See less" : "See more";
        });
        $("descRemixBtn")?.addEventListener("click", startRemixFromVideo);
        $("descMusicCard")?.addEventListener("click", startRemixFromVideo);
        document.querySelectorAll('[data-close="descSheet"]').forEach((el) => {
            el.addEventListener("click", () => hide($("descSheet")));
        });

        $("playerSettingsBtn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            openPlayerSettings();
        });

        $("playerFsBtn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePlayerFullscreen();
        });

        // Also wire header/video more to open player settings when appropriate? keep page more separate.

        document.querySelectorAll("[data-close]").forEach((el) => {
            el.addEventListener("click", () => {
                const id = el.dataset.close;
                if (id === "playerSettingsOverlay") closePlayerSettings();
                if (id === "psQualityOverlay") hide($("psQualityOverlay"));
                if (id === "psSpeedOverlay") hide($("psSpeedOverlay"));
                if (id === "psSleepOverlay") hide($("psSleepOverlay"));
            });
        });

        document.querySelectorAll("[data-ps]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const key = btn.dataset.ps;
                if (key === "quality") {
                    hide($("playerSettingsOverlay"));
                    show($("psQualityOverlay"));
                } else if (key === "speed") {
                    hide($("playerSettingsOverlay"));
                    show($("psSpeedOverlay"));
                } else if (key === "sleep") {
                    hide($("playerSettingsOverlay"));
                    show($("psSleepOverlay"));
                } else if (key === "loop") {
                    playerSettings.loop = !playerSettings.loop;
                    applyLoop();
                    syncPlayerSettingsUI();
                    toast("Loop", playerSettings.loop ? "On" : "Off", "info");
                } else if (key === "ambient") {
                    playerSettings.ambient = !playerSettings.ambient;
                    applyAmbient();
                    syncPlayerSettingsUI();
                    toast("Ambient mode", playerSettings.ambient ? "On" : "Off", "info");
                } else if (key === "stable") {
                    playerSettings.stable = !playerSettings.stable;
                    applyStableVolume();
                    syncPlayerSettingsUI();
                    toast("Stable volume", playerSettings.stable ? "On" : "Off", "info");
                } else if (key === "lock") {
                    playerSettings.lock = !playerSettings.lock;
                    document.body.classList.toggle("playerLocked", playerSettings.lock);
                    syncPlayerSettingsUI();
                    toast("Screen lock", playerSettings.lock ? "Controls locked" : "Unlocked", "info");
                } else if (key === "captions") {
                    toast("Captions", "Captions unavailable for this video.", "info");
                } else if (key === "music") {
                    toast("Music", "Music mode coming soon.", "info");
                } else if (key === "vr") {
                    toast("VR", "VR mode is not available on this device.", "info");
                } else if (key === "description") {
                    closePlayerSettings();
                    openDescSheet();
                } else if (key === "remix") {
                    closePlayerSettings();
                    startRemixFromVideo();
                } else if (key === "help") {
                    toast("Help", "Report issues from the video menu.", "info");
                    closePlayerSettings();
                } else if (key === "fullscreen") {
                    closePlayerSettings();
                    togglePlayerFullscreen();
                }
            });
        });

        document.querySelectorAll(".psQualityOpt").forEach((btn) => {
            btn.addEventListener("click", () => {
                playerSettings.quality = btn.dataset.quality || "auto";
                // Single-stream CDN: label only (real ABR needs multi-bitrate sources)
                syncPlayerSettingsUI();
                hide($("psQualityOverlay"));
                show($("playerSettingsOverlay"));
                toast("Quality", playerSettings.quality === "auto" ? "Auto" : playerSettings.quality + "p", "info");
            });
        });

        document.querySelectorAll(".psSpeedOpt").forEach((btn) => {
            btn.addEventListener("click", () => {
                playerSettings.speed = Number(btn.dataset.speed) || 1;
                applyPlaybackRate();
                syncPlayerSettingsUI();
                hide($("psSpeedOverlay"));
                show($("playerSettingsOverlay"));
                toast("Speed", playerSettings.speed + "x", "info");
            });
        });

        document.querySelectorAll(".psSleepOpt").forEach((btn) => {
            btn.addEventListener("click", () => {
                const mins = Number(btn.dataset.sleep) || 0;
                setSleepTimer(mins);
                hide($("psSleepOverlay"));
                show($("playerSettingsOverlay"));
            });
        });
    }





    function updateYtCommentsPreview() {
        const countEl = $("commentsHeadingCount");
        const textEl = $("ytPreviewText");
        const avEl = $("ytPreviewAvatar");
        const entries = Object.entries(state.comments || {})
            .map(function (p) { return Object.assign({ id: p[0] }, p[1] || {}); })
            .sort(function (a, b) {
                return safeNumber(b.createdAt || b.timestamp) - safeNumber(a.createdAt || a.timestamp);
            });
        if (countEl) countEl.textContent = String(entries.length);
        if ($("csCount")) $("csCount").textContent = String(entries.length);

        if (!entries.length) {
            if (textEl) textEl.textContent = "Add a comment...";
            // show current user avatar on empty
            try {
                const me = $("currentUserAvatar");
                if (avEl && me && me.src) avEl.src = me.src;
            } catch (_) {}
            return;
        }
        const top = entries[0];
        const name = String(top.username || top.name || "user").replace(/^@/, "");
        const text = String(top.text || top.comment || "");
        if (textEl) textEl.textContent = name + "  " + text;
        const photo = top.avatar || top.photoURL || top.profilePhoto || "";
        if (avEl) {
            if (photo) {
                avEl.src = photo;
                avEl.onerror = function () { this.src = "assets/default-avatar.png"; };
            }
        }
    }

    function openCommentsSheet() {
        const sheet = $("commentsSheet");
        if (!sheet) return;
        Promise.resolve(renderCommentsSheet()).catch(function(){});
        sheet.classList.add("open");
        sheet.setAttribute("aria-hidden", "false");
        try { loadMyCommentAvatar(); } catch (_) {}
        setTimeout(function () { $("csInput")?.focus(); }, 280);
    }

    function closeCommentsSheet() {
        const sheet = $("commentsSheet");
        if (!sheet) return;
        sheet.classList.remove("open");
        sheet.setAttribute("aria-hidden", "true");
    }

    async function renderCommentsSheet() {
        const list = $("csList");
        const empty = $("csEmpty");
        const countEl = $("csCount");
        if (!list) return;
        list.innerHTML = "";

        const raw = Object.entries(state.comments || {})
            .map(function (pair) {
                return Object.assign({ id: pair[0] }, pair[1] || {});
            })
            .filter(function (c) {
                return !c.hidden && !c.deleted && (c.text || c.comment);
            });

        // Strong dedupe: one comment per uid+text+parent (keep newest)
        const byFp = {};
        raw.forEach(function (c) {
            const fp =
                String(c.uid || c.userId || "") +
                "|" +
                String(c.text || c.comment || "").trim().toLowerCase() +
                "|" +
                String(c.parentId || "root");
            const t = safeNumber(c.createdAt || c.timestamp);
            if (!byFp[fp] || t > safeNumber(byFp[fp].createdAt || byFp[fp].timestamp)) {
                byFp[fp] = c;
            }
        });
        const all = Object.keys(byFp).map(function (k) {
            return byFp[k];
        });

        // Split roots and replies
        const roots = [];
        const children = {};
        all.forEach(function (c) {
            if (c.parentId && byFp[Object.keys(byFp).find(function () { return false; })]) {
                /* noop */
            }
            if (c.parentId) {
                if (!children[c.parentId]) children[c.parentId] = [];
                children[c.parentId].push(c);
            } else {
                roots.push(c);
            }
        });
        // orphans whose parent missing → treat as root
        all.forEach(function (c) {
            if (c.parentId) {
                const parentExists = all.some(function (x) {
                    return x.id === c.parentId;
                });
                if (!parentExists && roots.indexOf(c) < 0) roots.push(c);
            }
        });

        roots.sort(function (a, b) {
            return safeNumber(b.createdAt || b.timestamp) - safeNumber(a.createdAt || a.timestamp);
        });
        Object.keys(children).forEach(function (pid) {
            children[pid].sort(function (a, b) {
                return safeNumber(a.createdAt || a.timestamp) - safeNumber(b.createdAt || b.timestamp);
            });
        });

        const flatOrder = [];
        roots.forEach(function (r) {
            flatOrder.push(r);
            (children[r.id] || []).forEach(function (ch) {
                flatOrder.push(ch);
            });
        });

        if (countEl) countEl.textContent = String(flatOrder.length);
        if ($("commentsHeadingCount")) $("commentsHeadingCount").textContent = String(flatOrder.length);

        if (!flatOrder.length) {
            if (empty) empty.classList.remove("hidden");
            return;
        }
        if (empty) empty.classList.add("hidden");

        const db = getFirebaseDatabase();
        const userCache = {};
        async function fetchUser(uid) {
            if (!uid) return {};
            if (userCache[uid]) return userCache[uid];
            try {
                if (!db) return {};
                const snap = await db.ref("users/" + uid).once("value");
                userCache[uid] = snap.val() || {};
                return userCache[uid];
            } catch (_) {
                return {};
            }
        }
        function tickHTML(user) {
            try {
                if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
                    const r = VieworaBadges.resolve(user);
                    return (r && r.html) ? r.html : "";
                }
            } catch (_) {}
            return getCreatorTickHTML(user);
        }

        for (const comment of flatOrder) {
            const uid = comment.uid || comment.userId || "";
            const u = await fetchUser(uid);
            const avatar =
                comment.avatar ||
                comment.photoURL ||
                comment.profilePhoto ||
                u.profilePhoto ||
                u.photoURL ||
                u.avatar ||
                "";
            const username = String(
                comment.displayName ||
                comment.name ||
                comment.username ||
                u.displayName ||
                u.name ||
                u.username ||
                "user"
            ).replace(/^@/, "");
            const text = comment.text || comment.comment || "";
            const time = formatRelativeTime(comment.createdAt || comment.timestamp);
            const initial = (username.charAt(0) || "?").toUpperCase();
            const tick = tickHTML(Object.assign({}, u, comment));
            const isReply = !!comment.parentId;
            const likes = safeNumber(comment.likesCount || comment.likes || 0);
            const replyLabel = comment.replyToName
                ? '<div class="csReplyLabel">↳ Replying to <b>@' +
                  escapeHTML(String(comment.replyToName).replace(/^@/, "")) +
                  "</b></div>"
                : "";

            const item = document.createElement("article");
            item.className = "csItem" + (isReply ? " csReplyItem" : "");
            item.dataset.cid = comment.id;
            item.innerHTML =
                '<button type="button" class="csItemAvatar" data-uid="' +
                escapeHTML(uid) +
                '">' +
                (avatar
                    ? '<img src="' +
                      escapeHTML(avatar) +
                      '" alt="" onerror="this.onerror=null;this.style.display=\'none\';this.parentNode.insertAdjacentHTML(\'beforeend\',\'<span class=csInitial>' +
                      initial +
                      "</span>\')\">"
                    : '<span class="csInitial">' + initial + "</span>") +
                "</button>" +
                '<div class="csItemBody">' +
                '<div class="csItemMeta">' +
                '<strong data-uid="' +
                escapeHTML(uid) +
                '">' +
                escapeHTML(username) +
                "</strong>" +
                (tick ? '<span class="csTick">' + tick + "</span>" : "") +
                (time ? "<time>" + escapeHTML(time) + "</time>" : "") +
                "</div>" +
                replyLabel +
                "<p>" +
                escapeHTML(text) +
                "</p>" +
                '<div class="csActions">' +
                '<button type="button" class="csLike" data-c-like="' +
                escapeHTML(comment.id) +
                '">' +
                '<i class="fa-regular fa-heart"></i> ' +
                likes +
                "</button>" +
                '<button type="button" class="csReplyBtn" data-c-reply="1">Reply</button>' +
                "</div></div>";
            list.appendChild(item);
        }

        list.querySelectorAll("[data-uid]").forEach(function (el) {
            el.addEventListener("click", function (e) {
                e.preventDefault();
                const uid = el.getAttribute("data-uid");
                if (!uid) return;
                location.href = "profile.html?uid=" + encodeURIComponent(uid);
            });
        });

        list.querySelectorAll("[data-c-like]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleCommentLike(btn.getAttribute("data-c-like"), btn);
            });
        });

        list.querySelectorAll("[data-c-reply]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                const item = btn.closest(".csItem");
                const cid = item && item.dataset.cid;
                const comment =
                    (cid && state.comments && state.comments[cid]) ||
                    flatOrder.find(function (c) {
                        return c.id === cid;
                    });
                if (comment) startReplyTo(comment);
            });
        });

        list.querySelectorAll(".csItem").forEach(function (item) {
            const cid = item.dataset.cid;
            const comment = cid && state.comments ? state.comments[cid] : null;
            if (!comment) return;
            let timer = null;
            const startPress = function () {
                timer = setTimeout(function () {
                    openCommentActions(comment, item);
                }, 500);
            };
            const cancelPress = function () {
                if (timer) clearTimeout(timer);
                timer = null;
            };
            item.addEventListener("touchstart", startPress, { passive: true });
            item.addEventListener("touchend", cancelPress);
            item.addEventListener("touchmove", cancelPress);
            item.addEventListener("contextmenu", function (e) {
                e.preventDefault();
                openCommentActions(comment, item);
            });
        });
    }






    let __activeComment = null; // { id, uid, text, el }

    function isVideoOwner() {
        try {
            const me = getCurrentUser();
            const v = state.video || {};
            const owner = v.uid || v.userId || v.ownerId || v.creatorId || "";
            return !!(me && owner && me.uid === owner);
        } catch (_) {
            return false;
        }
    }

    function openCommentActions(comment, el) {
        __activeComment = Object.assign({}, comment, { el: el });
        const sheet = $("commentActionSheet");
        if (!sheet) return;
        const me = getCurrentUser();
        const isOwn = me && (comment.uid === me.uid || comment.userId === me.uid);
        const owner = isVideoOwner();

        const editBtn = $("casEdit");
        const delBtn = $("casDelete");
        const hideBtn = $("casHide");
        const reportBtn = $("casReport");

        if (editBtn) editBtn.classList.toggle("hidden", !isOwn);
        if (delBtn) delBtn.classList.toggle("hidden", !(isOwn || owner));
        if (hideBtn) hideBtn.classList.toggle("hidden", !owner || isOwn);
        if (reportBtn) reportBtn.classList.toggle("hidden", !owner || isOwn);

        sheet.classList.add("open");
        sheet.setAttribute("aria-hidden", "false");
    }

    function closeCommentActions() {
        const sheet = $("commentActionSheet");
        if (sheet) {
            sheet.classList.remove("open");
            sheet.setAttribute("aria-hidden", "true");
        }
        __activeComment = null;
    }

    async function deleteActiveComment() {
        if (!__activeComment || !__activeComment.id || !state.videoId) return;
        const db = getFirebaseDatabase();
        if (!db) return;
        const id = __activeComment.id;
        try {
            const updates = {};
            updates[COMMENTS_ROOT + "/" + state.videoId + "/" + id] = null;
            updates["videos/" + state.videoId + "/comments/" + id] = null;
            await db.ref().update(updates);
            if (state.comments) delete state.comments[id];
            try { await incrementCommentCount(-1); } catch (_) {}
            closeCommentActions();
            try { renderComments(); } catch (_) {}
            try { await renderCommentsSheet(); } catch (_) {}
            try { updateYtCommentsPreview(); } catch (_) {}
            toast("Deleted", "Comment removed.");
        } catch (e) {
            console.error(e);
            toast("Failed", "Could not delete comment.", "error");
        }
    }

    async function editActiveComment() {
        if (!__activeComment || !__activeComment.id) return;
        const next = prompt("Edit comment", __activeComment.text || "");
        if (next == null) return;
        const text = String(next).trim();
        if (!text) return;
        const db = getFirebaseDatabase();
        if (!db) return;
        const id = __activeComment.id;
        try {
            const patch = { text: text, editedAt: Date.now(), edited: true };
            await db.ref(COMMENTS_ROOT + "/" + state.videoId + "/" + id).update(patch);
            try {
                await db.ref("videos/" + state.videoId + "/comments/" + id).update(patch);
            } catch (_) {}
            if (state.comments && state.comments[id]) {
                state.comments[id].text = text;
                state.comments[id].edited = true;
            }
            closeCommentActions();
            try { renderComments(); } catch (_) {}
            try { await renderCommentsSheet(); } catch (_) {}
            try { updateYtCommentsPreview(); } catch (_) {}
            toast("Updated", "Comment edited.");
        } catch (e) {
            toast("Failed", "Could not edit.", "error");
        }
    }

    async function hideActiveComment() {
        if (!__activeComment || !__activeComment.id) return;
        const db = getFirebaseDatabase();
        if (!db) return;
        const id = __activeComment.id;
        try {
            await db.ref(COMMENTS_ROOT + "/" + state.videoId + "/" + id).update({
                hidden: true,
                hiddenAt: Date.now()
            });
            if (state.comments) delete state.comments[id];
            closeCommentActions();
            try { renderComments(); } catch (_) {}
            try { await renderCommentsSheet(); } catch (_) {}
            try { updateYtCommentsPreview(); } catch (_) {}
            toast("Hidden", "Comment hidden from this video.");
        } catch (e) {
            toast("Failed", "Could not hide.", "error");
        }
    }

    function reportActiveComment() {
        if (!__activeComment) return;
        closeCommentActions();
        const id = __activeComment.id || "";
        location.href =
            "report.html?type=comment&videoId=" +
            encodeURIComponent(state.videoId || "") +
            "&commentId=" + encodeURIComponent(id);
    }



    function setupHeaderBadges() {
        const user = getCurrentUser();
        if (!user || typeof firebase === "undefined" || !firebase.database) return;
        if (window.__vieworaHeaderBadgesBound) return;
        window.__vieworaHeaderBadgesBound = true;

        const db = firebase.database();
        const uid = user.uid;

        function paint(el, n) {
            if (!el) return;
            n = Math.max(0, Number(n) || 0);
            if (n <= 0) {
                el.classList.add("hidden");
                el.textContent = "";
            } else {
                el.classList.remove("hidden");
                el.textContent = n > 99 ? "99+" : String(n);
            }
        }

        function chatUnread(v) {
            if (!v || typeof v !== "object") return 0;
            // Explicit zero wins
            if (v.unread === 0 || v.unreadCount === 0 || v.unreadMessages === 0) return 0;
            if (v.read === true && !(Number(v.unread) > 0)) return 0;
            const n = Math.max(
                Number(v.unread || 0) || 0,
                Number(v.unreadCount || 0) || 0,
                Number(v.unreadMessages || 0) || 0,
                Number(v.unread_count || 0) || 0
            );
            return n > 0 ? n : 0;
        }

        // Messages: sum unread across unique chats only
        try {
            db.ref("userChats/" + uid).on("value", function (snap) {
                const data = snap.val() || {};
                const seen = {};
                let total = 0;
                Object.keys(data).forEach(function (k) {
                    const v = data[k] || {};
                    // dedupe by peer or chatId
                    const key = String(v.chatId || v.peerId || v.uid || k);
                    if (seen[key]) return;
                    seen[key] = true;
                    total += chatUnread(v);
                });
                paint($("headerMsgBadge"), total);
            });
        } catch (_) {}

        // Activity: notifications/{uid} only (same as activity page)
        try {
            db.ref("notifications/" + uid).limitToLast(100).on("value", function (snap) {
                let total = 0;
                const data = snap.val() || {};
                Object.keys(data).forEach(function (k) {
                    const v = data[k] || {};
                    if (v.read === true || v.seen === true || v.isRead === true) return;
                    if (v.deleted === true) return;
                    total += 1;
                });
                paint($("headerActBadge"), total);
            });
        } catch (_) {}
    }

    function setupInteractions() {
        try { setupHeaderBadges(); } catch (_) {}
        try {
            if (!window.__vieworaAvatarBound) {
                window.__vieworaAvatarBound = true;
                if (typeof firebase !== "undefined" && firebase.auth) {
                    firebase.auth().onAuthStateChanged(function () {
                        try { loadMyCommentAvatar(); } catch (_) {}
                    });
                }
            }
            try { loadMyCommentAvatar(); } catch (_) {}
        } catch (_) {}


        setupPlayerSettings();

        $("commentActionSheet")?.addEventListener("click", function (e) {
            if (e.target.closest("[data-cas-close]")) closeCommentActions();
        });
        $("casEdit")?.addEventListener("click", function () { editActiveComment(); });
        $("casDelete")?.addEventListener("click", function () { deleteActiveComment(); });
        $("casHide")?.addEventListener("click", function () { hideActiveComment(); });
        $("casReport")?.addEventListener("click", function () { reportActiveComment(); });


        $("openCommentsSheetBtn")?.addEventListener("click", openCommentsSheet);
        $("viewAllCommentsBtn")?.addEventListener("click", function (e) {
            e.stopPropagation();
            openCommentsSheet();
        });
        $("commentBtn")?.addEventListener("click", function () {
            openCommentsSheet();
        });
        $("commentsSheet")?.addEventListener("click", function (e) {
            if (e.target.closest("[data-cs-close]")) closeCommentsSheet();
        });
        $("csPostBtn")?.addEventListener("click", async function (e) {
            e.preventDefault();
            e.stopPropagation();
            await postComment();
        });
        $("csInput")?.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                $("csPostBtn")?.click();
            }
        });


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

        $("searchBtn")?.addEventListener("click", function () {
            window.location.href = "search-page.html";
        });

        $("postCommentBtn")?.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            postComment();
        });

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

                hide($("playerLoading"));

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

        hidePageLoader();
        hide($("playerLoading"));

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

/* Short description sheet (title click) — shared with shorts */
function openShortDescriptionSheet(shortObj) {
    if (!shortObj) return;
    let sheet = document.getElementById("vieworaShortDescSheet");
    if (!sheet) {
        sheet = document.createElement("div");
        sheet.id = "vieworaShortDescSheet";
        sheet.innerHTML = '<div class="vsdBackdrop" data-close="1"></div><div class="vsdPanel"><div class="vsdHandle"></div><div class="vsdTitle" id="vsdTitle"></div><div class="vsdMeta" id="vsdMeta"></div><div class="vsdDesc" id="vsdDesc"></div><button type="button" class="vsdAudioBtn" id="vsdUseAudio"><i class="fa-solid fa-music"></i> Use this audio</button><button type="button" class="vsdClose" data-close="1">Close</button></div>';
        document.body.appendChild(sheet);
        if (!document.getElementById("vsdCSS")) {
            var st = document.createElement("style");
            st.id = "vsdCSS";
            st.textContent = "#vieworaShortDescSheet{position:fixed;inset:0;z-index:99999;display:none;align-items:flex-end;justify-content:center}#vieworaShortDescSheet.open{display:flex}.vsdBackdrop{position:absolute;inset:0;background:rgba(0,0,0,.55)}.vsdPanel{position:relative;width:100%;max-width:480px;background:#1a1b22;border-radius:16px 16px 0 0;padding:12px 16px 28px;color:#fff}.vsdHandle{width:40px;height:4px;border-radius:4px;background:rgba(255,255,255,.25);margin:0 auto 14px}.vsdTitle{font-size:16px;font-weight:700;margin-bottom:6px}.vsdMeta{font-size:12px;color:rgba(255,255,255,.55);margin-bottom:12px}.vsdDesc{font-size:14px;line-height:1.45;color:rgba(255,255,255,.85);max-height:160px;overflow:auto;margin-bottom:16px;white-space:pre-wrap}.vsdAudioBtn{width:100%;border:0;border-radius:24px;padding:12px;background:linear-gradient(135deg,#7c5cff,#4f8cff);color:#fff;font-weight:700;margin-bottom:10px}.vsdClose{width:100%;border:0;border-radius:24px;padding:12px;background:rgba(255,255,255,.08);color:#fff}";
            document.head.appendChild(st);
        }
        sheet.addEventListener("click", function(e) {
            if (e.target.closest("[data-close]")) sheet.classList.remove("open");
        });
    }
    var title = shortObj.title || shortObj.caption || "Short";
    var desc = shortObj.description || shortObj.caption || shortObj.title || "No description.";
    var when = shortObj.createdAt || shortObj.timestamp || shortObj.uploadedAt;
    var dateStr = "";
    try {
        var d = typeof when === "number" ? new Date(when) : new Date(when);
        if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    } catch (e) {}
    var views = shortObj.views != null ? Number(shortObj.views) : 0;
    sheet.querySelector("#vsdTitle").textContent = title;
    sheet.querySelector("#vsdMeta").textContent = (views ? views + " views · " : "") + (dateStr ? "Uploaded " + dateStr : "");
    sheet.querySelector("#vsdDesc").textContent = desc;
    sheet.querySelector("#vsdUseAudio").onclick = function () {
        try {
            sessionStorage.setItem("vieworaUseAudio", JSON.stringify({
                musicId: shortObj.musicId || shortObj.audioId || "",
                musicUrl: shortObj.musicUrl || shortObj.audioUrl || "",
                title: shortObj.musicTitle || title,
                fromShortId: shortObj.id || ""
            }));
        } catch (e) {}
        window.location.href = "upload.html?type=short&useAudio=1";
    };
    sheet.classList.add("open");
}
window.openShortDescriptionSheet = openShortDescriptionSheet;

/* VIEWORA_HIST_FORCE_BIND */
(function () {
    function tryBind() {
        try {
            var p = document.getElementById("mainVideo");
            if (p && typeof __vieworaBindHistoryOnce === "function") {
                __vieworaBindHistoryOnce(p);
            }
        } catch (_) {}
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            tryBind();
            setTimeout(tryBind, 800);
            setTimeout(tryBind, 2000);
        });
    } else {
        tryBind();
        setTimeout(tryBind, 800);
    }
})();


/* VIEWORA_FORCE_HIST_VIDEO */
(function () {
  function forceVideoHist() {
    try {
      if (!window.VieworaRecordWatch) return;
      var p = document.getElementById("mainVideo");
      if (!p || p.paused || p.ended) return;
      if ((p.currentTime || 0) < 0.5 && !p.dataset.vwhForce) {
        // still allow after 1s wall via dataset
      }
      var id = "";
      try {
        var sp = new URLSearchParams(location.search);
        id = sp.get("id") || sp.get("videoId") || "";
      } catch (_) {}
      if (!id) return;
      var title = (document.getElementById("videoTitle") || {}).textContent || "Video";
      var thumb = p.getAttribute("poster") || "";
      var cur = p.currentTime || 0;
      var dur = p.duration || 0;
      var progress = dur > 0 ? Math.min(1, cur / dur) : 0.15;
      if (cur < 0.8 && progress < 0.1) progress = 0.15;
      VieworaRecordWatch({
        videoId: String(id),
        type: "video",
        title: String(title).trim().slice(0, 120),
        thumb: thumb,
        progress: progress
      });
    } catch (e) {
      console.warn("[FORCE_HIST_V]", e);
    }
  }
  setInterval(forceVideoHist, 2500);
})();
