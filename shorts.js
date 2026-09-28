"use strict";

/*
============================================================
 VIEWORA SHORTS ENGINE
 Fixed: real username after upload + music text
 Compatible with shorts.html + shorts.css
============================================================
*/

(() => {

    if (window.__VIEWORA_SHORTS_READY__) {
        return;
    }
    window.__VIEWORA_SHORTS_READY__ = true;

    /* watch history */
    function __recordShortWatch(data, progress) {
        try {
            if (!window.VieworaRecordWatch || !data) return;
            var id = data.id || data.shortId || data.videoId;
            if (!id) return;
            VieworaRecordWatch({
                videoId: id,
                type: "short",
                title: data.title || data.caption || "Short",
                thumb: data.thumbnail || data.thumb || data.coverUrl || data.poster || "",
                ownerName: data.username || data.userName || data.ownerName || "",
                progress: progress != null ? progress : 0.15
            });
        } catch (_) {}
    }

    function __bindShortProgress(videoEl, data) {
        try {
            if (!videoEl || videoEl.dataset.vieworaHistBound === "1") return;
            videoEl.dataset.vieworaHistBound = "1";
            var meta = {
                videoId: data.id || data.shortId || data.videoId,
                type: "short",
                title: data.title || data.caption || "Short",
                thumb: data.thumbnail || data.thumb || data.coverUrl || "",
                ownerName: data.username || data.userName || data.ownerName || ""
            };
            var tick = function (force) {
                try {
                    if (!data) return;
                    var dur = videoEl.duration || 0;
                    var cur = videoEl.currentTime || 0;
                    if (!force && cur < 0.9) return;
                    if (window.VieworaWatchProgress) {
                        VieworaWatchProgress(meta, Math.max(cur, 1), dur || 15);
                    } else {
                        __recordShortWatch(data, dur > 0 ? Math.min(1, Math.max(cur, 1) / dur) : 0.1);
                    }
                } catch (_) {}
            };
            var oneSec = null;
            videoEl.addEventListener("playing", function () {
                try { clearTimeout(oneSec); } catch (_) {}
                oneSec = setTimeout(function () {
                    if (!videoEl.paused && !videoEl.ended) tick(true);
                }, 1000);
            });
            videoEl.addEventListener("timeupdate", function () { tick(false); });
            videoEl.addEventListener("pause", function () {
                try { clearTimeout(oneSec); } catch (_) {}
                if ((videoEl.currentTime || 0) >= 0.9) tick(true);
            });
            videoEl.addEventListener("ended", function () {
                __recordShortWatch(data, 1);
            });
        } catch (_) {}
    }



    /* =====================================================
       ELEMENTS
    ===================================================== */

    const container = document.getElementById("shortsContainer");
    const skeleton = document.getElementById("shortsSkeleton");
    const emptyState = document.getElementById("emptyState");
    const toastEl = document.getElementById("toast");
    const toastText = document.getElementById("toastText");
    const toastIcon = document.getElementById("toastIcon");
    const heartAnim = document.getElementById("heartAnimation");

    const commentsModal = document.getElementById("commentsModal");
    const commentsContainer = document.getElementById("commentsContainer");
    const commentText = document.getElementById("commentText");
    const sendComment = document.getElementById("sendComment");
    const closeComments = document.getElementById("closeComments");
    const commentsOverlay = document.getElementById("commentsOverlay");
    const commentCountText = document.getElementById("commentCountText");
    const commentUserAvatar = document.getElementById("commentUserAvatar");

    const shareModal = document.getElementById("shareModal");
    const closeShare = document.getElementById("closeShare");
    const shareOverlay = document.getElementById("shareOverlay");

    const networkStatus = document.getElementById("networkStatus");
    const shortSearchBar = document.getElementById("shortSearchBar");
    const shortSearchInput = document.getElementById("shortSearchInput");


    /* =====================================================
       STATE
    ===================================================== */

    let currentUser = null;
    let shorts = [];
    let activeShort = null;
    let observer = null;
    let userCache = {};

    /* Once user unmutes, keep sound on while scrolling shorts */
    let preferUnmuted = false;
    try {
        preferUnmuted = localStorage.getItem("viewora_shorts_unmuted") === "1";
    } catch (_) {}
    try {
        Object.defineProperty(window, "__vieworaPreferUnmuted", {
            get: function () { return preferUnmuted; },
            set: function (v) { preferUnmuted = !!v; },
            configurable: true
        });
    } catch (_) {
        window.__vieworaPreferUnmuted = preferUnmuted;
    }


    // Ensure Realtime Database handle (firebase.js may set window.db)
    try {
        if (!window.db && typeof firebase !== "undefined") {
            window.db = firebase.database();
        }
    } catch (_) {}
    var db = window.db || (typeof firebase !== "undefined" ? firebase.database() : null);



    /* Like locks + spam detection */
    const likeInFlight = new Set();
    const likeSpamLog = {}; // shortId -> timestamps[]
    const LIKE_SPAM_LIMIT = 6;
    const LIKE_SPAM_WINDOW_MS = 12000;


    /* =====================================================
       HELPERS
    ===================================================== */

    function $(id) {
        return document.getElementById(id);
    }

    function safeNumber(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function formatCount(v) {
        const n = safeNumber(v);
        if (n >= 1e6) {
            return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".0", "") + "M";
        }
        if (n >= 1e3) {
            return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(".0", "") + "K";
        }
        return String(n);
    }

    function escapeHTML(v) {
        return String(v ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /** Never show [object Object] */
    function safeText(value, fallback) {
        if (value == null) return fallback || "";
        if (typeof value === "object") {
            if (typeof value.name === "string") return value.name;
            if (typeof value.title === "string") return value.title;
            if (typeof value.text === "string") return value.text;
            if (typeof value.username === "string") return value.username;
            return fallback || "";
        }
        const s = String(value).trim();
        if (!s || s === "[object Object]") return fallback || "";
        return s;
    }

    function showToast(msg, icon) {
        const text = String(msg || "");
        // Premium floating pill for feed refresh & key actions
        if (/feed refreshed/i.test(text) || !toastEl) {
            try {
                let pill = document.getElementById("vieworaPremiumToast");
                if (!pill) {
                    pill = document.createElement("div");
                    pill.id = "vieworaPremiumToast";
                    pill.className = "vieworaPremiumToast";
                    document.body.appendChild(pill);
                }
                pill.innerHTML =
                    '<span class="vptIcon"><i class="' +
                    (icon || "fa-solid fa-arrows-rotate") +
                    '"></i></span><span class="vptText"></span>';
                pill.querySelector(".vptText").textContent = text.replace(/^🔄\s*/, "");
                pill.classList.add("show");
                clearTimeout(window.__vptTimer);
                window.__vptTimer = setTimeout(function () {
                    pill.classList.remove("show");
                }, 2000);
                if (!toastEl) return;
            } catch (_) {}
        }
        if (!toastEl) return;
        if (toastText) toastText.textContent = text;
        if (toastIcon) {
            toastIcon.className = icon || "fa-solid fa-circle-check";
        }
        toastEl.classList.remove("hidden");
        clearTimeout(window.__shortsToastTimer);
        window.__shortsToastTimer = setTimeout(() => {
            toastEl.classList.add("hidden");
        }, 2200);
    }

    function hideSkeleton() {
        skeleton?.classList.add("hidden");
    }

    function showEmpty() {
        hideSkeleton();
        emptyState?.classList.remove("hidden");
    }

    function hideEmpty() {
        emptyState?.classList.add("hidden");
    }


    /* =====================================================
       AUTH
    ===================================================== */

    function waitForAuth() {
        return new Promise((resolve) => {
            if (!window.firebase || !firebase.auth) {
                resolve(null);
                return;
            }
            const unsub = firebase.auth().onAuthStateChanged((user) => {
                currentUser = user || null;
                unsub();
                resolve(user || null);
            });
        });
    }


    /* =====================================================
       USER LOOKUP (fixed – real name after upload)
    ===================================================== */

    async function getUser(uid) {
        if (!uid) return null;
        // Re-fetch if cache is thin (old builds only stored verified)
        if (userCache[uid]) {
            const c = userCache[uid];
            if ("redTick" in c && "vip" in c && "tickType" in c) {
                return c;
            }
            // stale cache without full badge fields — drop and re-fetch
            delete userCache[uid];
        }

        try {
            const snap = await db.ref("users/" + uid).once("value");
            if (!snap.exists()) {
                // fallback: auth displayName if own profile
                if (currentUser && currentUser.uid === uid) {
                    const fallback = {
                        uid,
                        name: currentUser.displayName || "",
                        fullName: currentUser.displayName || "",
                        username:
                            currentUser.email?.split("@")[0] ||
                            "user",
                        profilePhoto: currentUser.photoURL || "",
                        photoURL: currentUser.photoURL || ""
                    };
                    userCache[uid] = fallback;
                    return fallback;
                }
                return null;
            }

            const data = snap.val() || {};
            const user = {
                uid,
                name:
                    data.name ||
                    data.fullName ||
                    data.displayName ||
                    "",
                fullName:
                    data.fullName ||
                    data.name ||
                    data.displayName ||
                    "",
                displayName:
                    data.displayName ||
                    data.name ||
                    data.fullName ||
                    "",
                username:
                    data.username ||
                    data.userName ||
                    data.handle ||
                    (data.email ? String(data.email).split("@")[0] : "") ||
                    "",
                profilePhoto:
                    data.profilePhoto ||
                    data.photoURL ||
                    data.avatar ||
                    data.profilePic ||
                    "",
                photoURL:
                    data.photoURL ||
                    data.profilePhoto ||
                    data.avatar ||
                    "",
                // Full badge fields (profile parity — red/blue/white)
                verified: data.verified === true || data.isVerified === true,
                isVerified: data.isVerified === true || data.verified === true,
                blueTick: data.blueTick === true,
                redTick: data.redTick === true,
                redTickForce: data.redTickForce === true,
                whiteTick: data.whiteTick === true,
                whiteTickForce: data.whiteTickForce === true,
                vip: data.vip === true,
                elite: data.elite === true,
                tickType: data.tickType || data.badge || "",
                badge: data.badge || "",
                verificationStatus: data.verificationStatus || "",
                monetized: data.monetized === true,
                monetizationEnabled: data.monetizationEnabled === true,
                premium: data.premium === true,
                isPremium: data.isPremium === true,
                plan: data.plan || (data.subscription && data.subscription.plan) || "",
                subscription: data.subscription || null,
                subscriptionActive: data.subscriptionActive === true,
                subscriptionStatus: data.subscriptionStatus || "",
                subscriptionExpiresAt: data.subscriptionExpiresAt || null
            };

            userCache[uid] = user;
            return user;
        } catch (err) {
            console.warn("getUser failed:", uid, err);
            return null;
        }
    }

    function getCreatorId(short) {
        return (
            short.uid ||
            short.userId ||
            short.authorId ||
            short.creatorId ||
            short.ownerId ||
            short.userUID ||
            ""
        );
    }

    function getMediaURL(short) {
        return (
            short.videoUrl ||
            short.videoURL ||
            short.mediaUrl ||
            short.mediaURL ||
            short.url ||
            short.fileUrl ||
            short.fileURL ||
            short.cloudinaryUrl ||
            short.imageUrl ||
            short.imageURL ||
            ""
        );
    }

    function getThumbnail(short) {
        return (
            short.thumbnail ||
            short.thumbnailUrl ||
            short.thumbnailURL ||
            short.cover ||
            short.coverUrl ||
            short.poster ||
            ""
        );
    }

        function getMusicMeta(short, username) {
        const raw =
            short.music ||
            short.sound ||
            short.audio ||
            short.song ||
            null;
        let id = short.musicId || short.soundId || short.originalSoundId || "";
        let title = "";
        let artist = "";
        let audioUrl = short.musicUrl || short.audioUrl || "";
        let coverUrl = "";
        let isOriginal = false;

        if (raw && typeof raw === "object") {
            id = id || raw.id || raw.musicId || raw.originalSoundId || "";
            title = safeText(raw.title || raw.name || raw.musicTitle || "", "");
            artist = safeText(
                raw.artist || raw.singer || raw.creatorName || raw.username || "",
                ""
            );
            audioUrl =
                audioUrl ||
                raw.audioUrl ||
                raw.url ||
                raw.src ||
                raw.previewUrl ||
                "";
            coverUrl =
                raw.coverUrl ||
                raw.cover ||
                raw.thumbnail ||
                raw.image ||
                raw.artwork ||
                "";
            isOriginal = !!(
                raw.isOriginal ||
                raw.original ||
                String(id).indexOf("orig_") === 0 ||
                String(title).toLowerCase().indexOf("original") === 0
            );
        } else if (typeof raw === "string" && raw.trim()) {
            title = safeText(raw, "");
        }

        if (!title) title = safeText(short.musicTitle || short.musicName || "", "");
        if (!coverUrl) {
            coverUrl = safeText(
                short.musicCover ||
                    short.musicCoverUrl ||
                    short.coverUrl ||
                    "",
                ""
            );
        }

        const uname = safeText(
            username ||
                short.username ||
                short.userName ||
                short.name ||
                "user",
            "user"
        ).replace(/^@/, "");

        // Creator avatar for original audio chip
        const avatarUrl = safeText(
            short.userPhoto ||
                short.photoURL ||
                short.avatar ||
                short.profilePic ||
                short.profilePhoto ||
                short.userAvatar ||
                "",
            ""
        );

        // Stable original-sound id so other shorts can reuse & group
        if (!id) {
            const sid = short.id || short.shortId || short.key || "";
            const uid =
                short.uid || short.userId || short.ownerId || short.creatorId || "";
            if (sid) id = "orig_" + sid;
            else if (uid)
                id =
                    "orig_" +
                    uid +
                    "_" +
                    (title || "audio").replace(/\s+/g, "_").slice(0, 24);
            isOriginal = true;
        }

        // Treat placeholder artist as original
        const badArtist = /^(your video|unknown|unknown artist|n\/?a|null|undefined)$/i;
        if (artist && badArtist.test(artist.trim())) {
            artist = "";
            isOriginal = true;
        }

        if (
            !title ||
            /^original(\s+audio)?$/i.test(title) ||
            /^your video$/i.test(title)
        ) {
            title = "Original audio";
            isOriginal = true;
        }

        // Original = always this Short's creator username (not "Your video")
        if (isOriginal) {
            artist = uname || artist || "user";
            title = "Original audio";
        }

        const label = isOriginal
            ? "Original audio · " + artist
            : artist
              ? title + " · " + artist
              : title;

        // Icon: original → profile pic; library music → cover/logo
        const iconUrl = isOriginal
            ? avatarUrl || coverUrl || "assets/logo.png"
            : coverUrl || avatarUrl || "assets/logo.png";

        return {
            id: id,
            title: title,
            artist: artist,
            label: label,
            audioUrl: audioUrl,
            isOriginal: isOriginal,
            sourceShortId: short.id || short.shortId || "",
            coverUrl: coverUrl,
            avatarUrl: avatarUrl,
            iconUrl: iconUrl
        };
    }

    function getMusicLabel(short, username) {
        return getMusicMeta(short, username).label;
    }

    /** Check if current user already follows target */
    async function isFollowingUser(targetUID) {
        if (!currentUser?.uid || !targetUID) return false;
        if (currentUser.uid === targetUID) return false;

        try {
            const snap = await db
                .ref("following/" + currentUser.uid + "/" + targetUID)
                .once("value");

            const val = snap.val();
            return val === true || val === 1 || val === "true" || (val && typeof val === "object");
        } catch (err) {
            console.warn("Follow check failed:", err);
            return false;
        }
    }

    /** Format upload time like YouTube (2 hours ago, 3 days ago...) */
    function timeAgo(value) {
        let ts = 0;

        if (typeof value === "number") {
            ts = value;
        } else if (typeof value === "string" && value) {
            const parsed = Date.parse(value);
            if (Number.isFinite(parsed)) ts = parsed;
        }

        // Firebase sometimes stores seconds
        if (ts > 0 && ts < 1e12) {
            ts = ts * 1000;
        }

        if (!ts || !Number.isFinite(ts)) {
            return "";
        }

        const now = Date.now();
        const diff = Math.max(0, now - ts);

        const sec = Math.floor(diff / 1000);
        if (sec < 60) return "just now";

        const min = Math.floor(sec / 60);
        if (min < 60) return min + (min === 1 ? " minute ago" : " minutes ago");

        const hr = Math.floor(min / 60);
        if (hr < 24) return hr + (hr === 1 ? " hour ago" : " hours ago");

        const day = Math.floor(hr / 24);
        if (day < 7) return day + (day === 1 ? " day ago" : " days ago");

        const week = Math.floor(day / 7);
        if (week < 5) return week + (week === 1 ? " week ago" : " weeks ago");

        const month = Math.floor(day / 30);
        if (month < 12) return month + (month === 1 ? " month ago" : " months ago");

        const year = Math.floor(day / 365);
        return year + (year === 1 ? " year ago" : " years ago");
    }


    /* =====================================================
       BUILD SHORT CARD
    ===================================================== */

    async function createShortCard(short) {
        const id = String(short.id || short.shortId || short.key || "");
        if (!id) return null;

        const creatorId = getCreatorId(short);
        const creator = await getUser(creatorId);

        // Enrich avatar for original-audio chip
        if (creator && typeof creator === "object") {
            short.userPhoto =
                short.userPhoto ||
                short.photoURL ||
                short.avatar ||
                creator.photoURL ||
                creator.avatar ||
                creator.profilePic ||
                creator.photo ||
                "";
            short.photoURL = short.userPhoto;
            if (!short.username && creator.username) {
                short.username = creator.username;
            }
        }

        // Prefer data stored on short, then users node, then auth
        let displayName = safeText(
            short.name ||
            short.fullName ||
            short.displayName ||
            short.userName ||
            creator?.name ||
            creator?.fullName,
            ""
        );

        let username = safeText(
            short.username ||
            short.userName ||
            short.handle ||
            creator?.username,
            ""
        );

        // Own short fallback from auth
        if (
            (!displayName || displayName === "Viewora User") &&
            currentUser &&
            creatorId === currentUser.uid
        ) {
            displayName =
                currentUser.displayName ||
                currentUser.email?.split("@")[0] ||
                displayName;
            if (!username) {
                username =
                    currentUser.email?.split("@")[0] || "user";
            }
        }

        if (!displayName) displayName = "Viewora User";
        if (!username) username = "user";

        let avatar =
            short.profilePhoto ||
            short.photoURL ||
            short.avatar ||
            creator?.profilePhoto ||
            creator?.photoURL ||
            creator?.avatar ||
            (currentUser && creatorId === currentUser.uid
                ? (currentUser.photoURL || "")
                : "") ||
            "";
        if (!avatar || /default-avatar|placeholder|null|undefined/i.test(String(avatar))) {
            var _n = encodeURIComponent((displayName || username || "U").charAt(0).toUpperCase());
            avatar = "https://ui-avatars.com/api/?name=" + _n + "&background=7c3aed&color=fff&size=128&bold=true";
        }

        const caption = safeText(
            short.caption || short.description || short.text || short.title,
            ""
        );

        const media = getMediaURL(short);
        const thumbnail = getThumbnail(short);
        // Tick hierarchy: Red VIP > Blue > White — profile parity
        let tickHTML = "";
        try {
            const u = creator && typeof creator === "object" ? Object.assign({}, creator) : {};
            // Never let short.verified override a red VIP creator
            const isRed =
                u.redTick === true ||
                u.redTickForce === true ||
                u.vip === true ||
                u.elite === true ||
                String(u.tickType || "").toLowerCase() === "red" ||
                String(u.tickType || "").toLowerCase() === "vip" ||
                String(u.badge || "").toLowerCase() === "vip" ||
                short.redTick === true ||
                short.redTickForce === true ||
                short.tickType === "red";

            if (isRed) {
                u.redTick = true;
                u.redTickForce = true;
                u.vip = true;
                u.tickType = "red";
                // strip blue so hierarchy stays red
                u.blueTick = false;
            } else {
                if (short.blueTick || short.verified || short.tickType === "blue") {
                    u.blueTick = u.blueTick || true;
                    u.verified = u.verified || true;
                }
                if (short.whiteTick || short.tickType === "white") {
                    u.whiteTick = true;
                    u.tickType = u.tickType || "white";
                }
            }

            if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
                const r = VieworaBadges.resolve(u);
                if (r && r.level === "red") {
                    tickHTML = '<i class="fa-solid fa-certificate vieworaTick redTick" title="VIP Elite" aria-label="VIP" style="color:#ff3b5c;font-size:12px;margin-left:5px;vertical-align:middle"></i>';
                } else if (r && r.html) {
                    tickHTML = r.html;
                }
            } else if (isRed) {
                tickHTML = '<i class="fa-solid fa-certificate vieworaTick redTick" style="color:#ff3b5c;font-size:12px;margin-left:5px;vertical-align:middle" title="VIP Elite"></i>';
            } else if (u.blueTick || u.verified || u.isVerified) {
                tickHTML = '<i class="fa-solid fa-circle-check vieworaTick blueTick" style="color:#1d9bf0;font-size:11px;margin-left:4px" title="Verified"></i>';
            } else if (u.whiteTick || u.monetized) {
                tickHTML = '<i class="fa-solid fa-circle-check vieworaTick whiteTick" style="color:#e8e8e8;font-size:11px;margin-left:4px" title="Monetized"></i>';
            }
        } catch (e) {
            console.warn("[shorts] tick resolve", e);
        }

        const likes = safeNumber(short.likes || short.likeCount);
        const comments = safeNumber(short.comments || short.commentCount);
        const shares = safeNumber(short.shares || short.shareCount);
        const views = safeNumber(short.views || short.viewCount);

        // Settings from short-edit / publish
        const hideLikeCount =
            short.hideLikeCount === true ||
            short.showLikeCount === false ||
            short.hideLikes === true;
        const commentsOff =
            short.commentsDisabled === true ||
            short.allowComments === false ||
            short.disableComments === true;
        const hideCommentCount =
            commentsOff ||
            short.showCommentCount === false ||
            short.hideComments === true;

        const musicMeta = getMusicMeta(short, username);
        const musicLabel = musicMeta.label;
        const isSelf =
            currentUser && creatorId && creatorId === currentUser.uid;

        // Already following? → show Following button
        let alreadyFollowing = false;
        if (!isSelf && currentUser && creatorId) {
            alreadyFollowing = await isFollowingUser(creatorId);
        }

        const uploadedAgo = timeAgo(
            short.createdAt ||
            short.timestamp ||
            short.uploadedAt ||
            short.time
        );

        const isVideo =
            short.type === "video" ||
            short.mediaType === "video" ||
            /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(media) ||
            !/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(media);

        const card = document.createElement("article");
        card.className = "shortCard";
        card.dataset.shortId = id;
        card.dataset.uid = creatorId || "";

        card.innerHTML = `
            ${
                isVideo
                    ? `<video
                            class="shortVideo"
                            src="${escapeHTML(media)}"
                            ${thumbnail && !/play|placeholder|default-thumb|empty/i.test(String(thumbnail)) ? `poster="${escapeHTML(thumbnail)}"` : ""}
                            playsinline
                            loop
                            muted
                            preload="metadata"
                        ></video>`
                    : `<img
                            class="shortVideo"
                            src="${escapeHTML(media || "assets/default-banner.jpg")}"
                            alt="Short"
                        >`
            }

            <div class="shortVideoShade"></div>

            <button type="button" class="volumeBtn" data-action="mute" aria-label="Mute">
                <i class="fa-solid fa-volume-xmark"></i>
            </button>

            <button type="button" class="moreBtn" data-action="more" aria-label="More">
                <i class="fa-solid fa-ellipsis"></i>
            </button>

            <div class="shortContent">
                <div class="creatorRow">
                    <div class="creatorProfile" data-action="profile" data-uid="${escapeHTML(creatorId)}">
                        <img
                            class="creatorAvatar"
                            src="${escapeHTML(avatar)}"
                            alt=""
                            onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff&size=128'"
                        >
                        <span class="shortUsername">
                            ${escapeHTML(displayName)}
                            ${tickHTML}
                        </span>
                    </div>
                    ${
                        isSelf
                            ? ""
                            : alreadyFollowing
                                ? `<button type="button" class="followBtn following" data-action="follow" data-uid="${escapeHTML(creatorId)}">Following</button>`
                                : `<button type="button" class="followBtn" data-action="follow" data-uid="${escapeHTML(creatorId)}">Follow</button>`
                    }
                </div>

                ${
                    caption
                        ? `<p class="shortCaption" data-action="caption">${escapeHTML(caption)}</p>`
                        : `<p class="shortCaption" data-action="caption">${escapeHTML(displayName)}</p>`
                }

                <!-- YouTube-style meta: views • likes • time (toggle on caption click) -->
                <div class="shortMeta" hidden>
                    <span>${formatCount(views)} views</span>
                    <span class="metaDot">•</span>
                    <span>${formatCount(likes)} likes</span>
                    ${
                        uploadedAgo
                            ? `<span class="metaDot">•</span><span>${escapeHTML(uploadedAgo)}</span>`
                            : ""
                    }
                </div>

                <button type="button" class="shortMusic" data-action="music"
                    data-music-id="${escapeHTML(musicMeta.id || "")}"
                    data-music-title="${escapeHTML(musicMeta.title || "")}"
                    data-music-artist="${escapeHTML(musicMeta.artist || "")}"
                    data-music-audio="${escapeHTML(musicMeta.audioUrl || "")}"
                    data-original="${musicMeta.isOriginal ? "1" : "0"}">
                    <img class="shortMusicIcon" src="${escapeHTML(musicMeta.iconUrl || "assets/logo.png")}" alt="" onerror="this.src='assets/logo.png'">
                    <span>${escapeHTML(musicLabel)}</span>
                </button>
            </div>

            <div class="shortActions">
                <button type="button" class="shortAction likeBtn" data-action="like"
                    data-hide-count="${hideLikeCount ? "1" : "0"}">
                    <i class="fa-regular fa-heart"></i>
                    <span ${hideLikeCount ? 'style="display:none"' : ""}>${formatCount(likes)}</span>
                </button>

                <button type="button" class="shortAction" data-action="comment"
                    ${commentsOff ? 'data-comments-off="1" style="opacity:.45"' : ""}>
                    <i class="fa-regular fa-comment"></i>
                    <span ${hideCommentCount ? 'style="display:none"' : ""}>${formatCount(comments)}</span>
                </button>

                <button type="button" class="shortAction" data-action="share">
                    <i class="fa-solid fa-share"></i>
                    <span>${formatCount(shares)}</span>
                </button>

                <button type="button" class="shortAction saveBtn" data-action="save">
                    <i class="fa-regular fa-bookmark"></i>
                    <span>Save</span>
                </button>

                <button type="button" class="musicDisc" data-action="music" aria-label="Sound">
                    <img src="${escapeHTML(musicMeta.iconUrl || "assets/logo.png")}" alt="" onerror="this.src='assets/logo.png'">
                </button>
            </div>

            <div class="shortProgress"><span></span></div>
        `;

        // store refs on element
        card.__short = short;
        card.__likes = likes;

        // Initial mute state from preference (autoplay may still force mute)
        const vidEl = card.querySelector("video.shortVideo");
        if (vidEl) {
            vidEl.muted = !preferUnmuted;
            if (preferUnmuted) vidEl.removeAttribute("muted");
            else vidEl.setAttribute("muted", "");
            // icon will sync after first observer fire
        }

        bindCardEvents(card, short, isVideo);

        // Restore liked / saved state for current user
        if (currentUser) {
            restoreLikeState(card, id).catch(() => {});
            restoreSaveState(card, id).catch(() => {});
        }

        return card;
    }

    async function restoreLikeState(card, shortId) {
        if (!currentUser || !shortId) return;
        try {
            const paths = [
                "shortLikes/" + shortId + "/" + currentUser.uid,
                "shorts/" + shortId + "/likedBy/" + currentUser.uid,
                "likes/" + shortId + "/" + currentUser.uid
            ];
            for (const p of paths) {
                const snap = await db.ref(p).once("value");
                if (snap.exists()) {
                    const likeBtn = card.querySelector(".likeBtn");
                    const icon = likeBtn?.querySelector("i");
                    likeBtn?.classList.add("liked");
                    if (icon) icon.className = "fa-solid fa-heart";
                    return;
                }
            }
        } catch (_) {}
    }

    async function restoreSaveState(card, shortId) {
        if (!currentUser || !shortId) return;
        try {
            const snap = await db
                .ref("savedShorts/" + currentUser.uid + "/" + shortId)
                .once("value");
            if (snap.exists()) {
                const btn = card.querySelector(".saveBtn");
                const icon = btn?.querySelector("i");
                btn?.classList.add("saved");
                if (icon) icon.className = "fa-solid fa-bookmark";
            }
        } catch (_) {}
    }


    /* =====================================================
       CARD EVENTS
    ===================================================== */

    function bindCardEvents(card, short, isVideo) {
        const video = card.querySelector("video.shortVideo");
        const playOverlay = card.querySelector(".playOverlay");
        const progressBar = card.querySelector(".shortProgress span");

        // Single tap → play/pause (delayed so double-tap can like without pause)
        let __tapTimer = null;
        let __lastTapAt = 0;
        function toggleShortPlay() {
            if (!video) return;
            if (video.paused) {
                if (preferUnmuted) video.muted = false;
                try {
                    if (typeof currentShort !== "undefined") __recordShortWatch(currentShort);
                    else if (typeof activeShort !== "undefined") __recordShortWatch(activeShort, 0.1);
                } catch (_r) {}
                video.play().catch(function () {
                    video.muted = true;
                    video.play().catch(function () {});
                });
                playOverlay && playOverlay.classList.remove("show");
                try { syncVolumeIcon(card, video); } catch (_) {}
            } else {
                video.pause();
                playOverlay && playOverlay.classList.add("show");
            }
        }
        function likeThisShort(clientX, clientY) {
            try {
                // Ensure video keeps playing
                if (video && video.paused) {
                    video.play().catch(function () {});
                    playOverlay && playOverlay.classList.remove("show");
                }
                // Heart burst at tap point
                var heart = document.createElement("div");
                heart.className = "shortDblHeart";
                heart.innerHTML = '<i class="fa-solid fa-heart"></i>';
                heart.style.cssText = "position:absolute;left:" + (clientX || 50) + "px;top:" + (clientY || 50) + "px;transform:translate(-50%,-50%) scale(0.4);color:#ff2d55;font-size:72px;pointer-events:none;z-index:50;opacity:0;transition:transform .45s ease,opacity .45s ease;";
                card.style.position = card.style.position || "relative";
                card.appendChild(heart);
                requestAnimationFrame(function () {
                    heart.style.opacity = "1";
                    heart.style.transform = "translate(-50%,-50%) scale(1.15)";
                });
                setTimeout(function () {
                    heart.style.opacity = "0";
                    heart.style.transform = "translate(-50%,-50%) scale(1.4)";
                }, 280);
                setTimeout(function () { try { heart.remove(); } catch (_) {} }, 600);
                var likeBtn = card.querySelector('[data-action="like"]');
                if (likeBtn) handleAction("like", likeBtn, card, short);
                else handleAction("like", null, card, short);
            } catch (err) {
                console.warn("dbl like", err);
            }
        }
        card.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-action]");
            if (btn) {
                e.stopPropagation();
                handleAction(btn.dataset.action, btn, card, short);
                return;
            }
            // Delay single-tap so double-tap can cancel it
            if (__tapTimer) clearTimeout(__tapTimer);
            __tapTimer = setTimeout(function () {
                __tapTimer = null;
                toggleShortPlay();
            }, 280);
        });
        card.addEventListener("dblclick", function (e) {
            if (e.target.closest("[data-action], button, a")) return;
            e.preventDefault();
            e.stopPropagation();
            if (__tapTimer) { clearTimeout(__tapTimer); __tapTimer = null; }
            var rect = card.getBoundingClientRect();
            likeThisShort(e.clientX - rect.left, e.clientY - rect.top);
        });
        card.addEventListener("touchend", function (e) {
            if (e.target.closest("[data-action], button, a, input, textarea")) return;
            var now = Date.now();
            if (now - __lastTapAt < 300) {
                e.preventDefault();
                e.stopPropagation();
                if (__tapTimer) { clearTimeout(__tapTimer); __tapTimer = null; }
                var t = (e.changedTouches && e.changedTouches[0]) || null;
                var rect = card.getBoundingClientRect();
                var x = t ? t.clientX - rect.left : rect.width / 2;
                var y = t ? t.clientY - rect.top : rect.height / 2;
                likeThisShort(x, y);
                __lastTapAt = 0;
                return;
            }
            __lastTapAt = now;
        });

                if (video) {
            video.addEventListener("timeupdate", () => {
                if (!progressBar || !video.duration) return;
                if (card.__scrubbing) return;
                progressBar.style.width =
                    (video.currentTime / video.duration) * 100 + "%";
            });

            // VIEWORA_SHORT_AUTO_POSTER — real frame instead of play-icon placeholder
            (function autoPoster() {
                if (!video) return;
                function grab() {
                    try {
                        if (video.getAttribute("data-poster-set") === "1") return;
                        var w = video.videoWidth || 0, h = video.videoHeight || 0;
                        if (w < 2 || h < 2) return;
                        var c = document.createElement("canvas");
                        c.width = Math.min(w, 720);
                        c.height = Math.round(c.width * (h / w));
                        c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
                        var url = c.toDataURL("image/jpeg", 0.7);
                        if (url && url.length > 100) {
                            video.setAttribute("poster", url);
                            video.setAttribute("data-poster-set", "1");
                        }
                    } catch (_) {}
                }
                video.addEventListener("loadeddata", function () {
                    try {
                        if ((video.currentTime || 0) < 0.05) {
                            video.currentTime = 0.12;
                        }
                    } catch (_) {}
                    setTimeout(grab, 100);
                });
                video.addEventListener("seeked", grab, { once: true });
            })();


            // === Instagram-style: hold 2s to pause (no icons), release to play ===
            (function bindHoldPause() {
                if (!video) return;
                var holdTimer = null;
                var holding = false;
                var holdPaused = false;
                var startX = 0, startY = 0;
                function clearHold() {
                    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
                }
                function onDown(e) {
                    if (e.target.closest("[data-action], .shortProgress, .shortActions, .shortContent, button, a")) return;
                    if (card.__scrubbing) return;
                    var pt = e.touches ? e.touches[0] : e;
                    startX = pt.clientX; startY = pt.clientY;
                    holding = true;
                    holdPaused = false;
                    clearHold();
                    holdTimer = setTimeout(function () {
                        if (!holding || card.__scrubbing) return;
                        holdPaused = true;
                        try {
                            if (!video.paused) {
                                video.pause();
                                // NO play overlay / symbols on hold-pause
                                if (playOverlay) playOverlay.classList.remove("show");
                            }
                        } catch (_) {}
                    }, 2000);
                }
                function onMove(e) {
                    if (!holding) return;
                    var pt = e.touches ? e.touches[0] : e;
                    if (Math.abs(pt.clientX - startX) > 12 || Math.abs(pt.clientY - startY) > 12) {
                        // moved → cancel hold (user scrolling)
                        holding = false;
                        clearHold();
                    }
                }
                function onUp() {
                    if (!holding && !holdPaused) { clearHold(); return; }
                    holding = false;
                    clearHold();
                    if (holdPaused) {
                        holdPaused = false;
                        try {
                            if (preferUnmuted) { video.muted = false; try { video.volume = 1; } catch (_) {} }
                            video.play().catch(function () {});
                            if (playOverlay) playOverlay.classList.remove("show");
                            try { syncVolumeIcon(card, video); } catch (_) {}
                        } catch (_) {}
                    }
                }
                card.addEventListener("touchstart", onDown, { passive: true });
                card.addEventListener("touchmove", onMove, { passive: true });
                card.addEventListener("touchend", onUp);
                card.addEventListener("touchcancel", onUp);
                card.addEventListener("mousedown", onDown);
                card.addEventListener("mousemove", onMove);
                card.addEventListener("mouseup", onUp);
                card.addEventListener("mouseleave", onUp);
            })();

            // === Scrub timeline (drag bottom progress like IG Reels) ===
            (function bindScrub() {
                var bar = card.querySelector(".shortProgress");
                if (!bar || !video) return;
                function seekFromEvent(e) {
                    var rect = bar.getBoundingClientRect();
                    var pt = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
                    var x = (pt.clientX - rect.left) / Math.max(1, rect.width);
                    x = Math.max(0, Math.min(1, x));
                    if (video.duration && isFinite(video.duration)) {
                        video.currentTime = x * video.duration;
                        if (progressBar) progressBar.style.width = (x * 100) + "%";
                    }
                }
                function startScrub(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    card.__scrubbing = true;
                    bar.classList.add("scrubbing");
                    seekFromEvent(e);
                }
                function moveScrub(e) {
                    if (!card.__scrubbing) return;
                    e.preventDefault();
                    seekFromEvent(e);
                }
                function endScrub(e) {
                    if (!card.__scrubbing) return;
                    seekFromEvent(e);
                    card.__scrubbing = false;
                    bar.classList.remove("scrubbing");
                    try {
                        if (preferUnmuted) { video.muted = false; video.volume = 1; }
                        if (video.paused) video.play().catch(function () {});
                    } catch (_) {}
                }
                bar.addEventListener("touchstart", startScrub, { passive: false });
                bar.addEventListener("touchmove", moveScrub, { passive: false });
                bar.addEventListener("touchend", endScrub);
                bar.addEventListener("mousedown", startScrub);
                window.addEventListener("mousemove", moveScrub);
                window.addEventListener("mouseup", endScrub);
            })();

            video.addEventListener("play", () => {
                playOverlay?.classList.remove("show");
            });

            video.addEventListener("pause", () => {
                // only show if still visible
            });
        }
    }

    function showHeart(x, y) {
        try {
            var card = document.querySelector(".shortCard.active, .shortCard[data-active='1']") ||
                document.querySelector(".shortCard:hover") ||
                document.querySelector(".shortCard");
            if (!card) return;
            var heart = document.createElement("div");
            heart.className = "shortLikeBurst";
            heart.innerHTML = '<i class="fa-solid fa-heart"></i>';
            var left = (typeof x === "number") ? x : (card.clientWidth / 2);
            var top = (typeof y === "number") ? y : (card.clientHeight / 2);
            heart.style.cssText = "position:absolute;left:" + left + "px;top:" + top + "px;transform:translate(-50%,-50%) scale(.35);color:#ff2d55;font-size:78px;pointer-events:none;z-index:60;opacity:0;filter:drop-shadow(0 4px 12px rgba(255,45,85,.45));transition:transform .5s cubic-bezier(.2,.9,.3,1.2),opacity .5s ease;";
            if (getComputedStyle(card).position === "static") card.style.position = "relative";
            card.appendChild(heart);
            requestAnimationFrame(function () {
                heart.style.opacity = "1";
                heart.style.transform = "translate(-50%,-50%) scale(1.2)";
            });
            setTimeout(function () {
                heart.style.opacity = "0";
                heart.style.transform = "translate(-50%,-120%) scale(1.35)";
            }, 320);
            setTimeout(function () { try { heart.remove(); } catch (_) {} }, 700);
            // pulse like button
            var lb = card.querySelector(".likeBtn");
            if (lb) {
                lb.classList.add("liked", "pop");
                setTimeout(function () { lb.classList.remove("pop"); }, 400);
            }
        } catch (_) {}
    }


    /* =====================================================
       ACTIONS
    ===================================================== */

    async function handleAction(action, btn, card, short) {
        switch (action) {
            case "like":
                await doLike(card, short, false);
                break;
            case "comment":
                if (
                    short.commentsDisabled === true ||
                    short.allowComments === false ||
                    short.disableComments === true
                ) {
                    showToast("Comments are turned off");
                    break;
                }
                openComments(short);
                break;
            case "share":
                openShare(short);
                break;
            case "save":
                await doSave(card, short);
                break;
            case "follow":
                await doFollow(btn, btn.dataset.uid);
                break;
            case "profile":
                openProfile(btn.dataset.uid || card.dataset.uid);
                break;
            case "mute":
                toggleMute(card);
                break;
            case "more":
                openMoreMenu(short, card);
                break;
            case "caption":
                // Open description sheet (same as long video)
                try {
                    var sid = short.id || short.shortId || (card && (card.dataset.id || card.dataset.shortId)) || "";
                    var payload = Object.assign({}, short, {
                        title: short.title || short.caption || short.text || "",
                        description: short.description || short.caption || short.text || "",
                        caption: short.caption || short.title || "",
                        likes: short.likes || short.likeCount || card.__likes || 0,
                        likeCount: short.likeCount || short.likes || card.__likes || 0,
                        views: short.views || short.viewCount || short.plays || 0,
                        id: sid,
                        shortId: sid
                    });
                    if (typeof openShortDescriptionSheet === "function") {
                        openShortDescriptionSheet(payload);
                    } else if (typeof window.openShortDescriptionSheet === "function") {
                        window.openShortDescriptionSheet(payload);
                    } else {
                        toggleCaptionMeta(card);
                    }
                } catch (err) {
                    console.warn("caption desc", err);
                    toggleCaptionMeta(card);
                }
                break;
            case "music": {
                const uname =
                    short.username ||
                    short.userName ||
                    short.name ||
                    "user";
                const meta = getMusicMeta(short, uname);
                const id = (btn && btn.dataset.musicId) || meta.id || "";
                const title = (btn && btn.dataset.musicTitle) || meta.title || "";
                const artist = (btn && btn.dataset.musicArtist) || meta.artist || "";
                const q = new URLSearchParams();
                if (id) q.set("id", id);
                if (title) q.set("name", title);
                if (artist) q.set("artist", artist);
                if (meta.audioUrl) q.set("audio", meta.audioUrl);
                if (meta.isOriginal) q.set("original", "1");
                const sid = short.id || card.dataset.id || card.dataset.shortId || "";
                if (sid) q.set("shortId", sid);
                const uid =
                    short.uid ||
                    short.userId ||
                    card.dataset.uid ||
                    "";
                if (uid) q.set("uid", uid);
                // video url as fallback playable "original audio"
                const vurl =
                    short.videoUrl ||
                    short.videoURL ||
                    short.mediaUrl ||
                    short.mediaURL ||
                    "";
                if (vurl && !meta.audioUrl) q.set("video", vurl);
                location.href = "music-detail.html?" + q.toString();
                break;
            }
        }
    }

    function toggleCaptionMeta(card) {
        const meta = card.querySelector(".shortMeta");
        if (!meta) return;

        const isHidden = meta.hasAttribute("hidden");
        if (isHidden) {
            meta.removeAttribute("hidden");
        } else {
            meta.setAttribute("hidden", "");
        }
    }


    /* =====================================================
       3-DOT MORE MENU
    ===================================================== */

    let menuShort = null;
    let menuCard = null;

    function openMoreMenu(short, card) {
        menuShort = short;
        menuCard = card;

        const menu = $("shortMenu");
        const ownerMenu = $("ownerMenu");
        const viewerMenu = $("viewerMenu");

        if (!menu) {
            // Fallback if HTML menu missing
            showToast("Menu unavailable");
            return;
        }

        const creatorId = getCreatorId(short);
        const isOwner =
            currentUser &&
            creatorId &&
            currentUser.uid === creatorId;

        if (ownerMenu) {
            ownerMenu.classList.toggle("hidden", !isOwner);
        }
        if (viewerMenu) {
            viewerMenu.classList.toggle("hidden", !!isOwner);
        }

        // Toggle labels for owner settings
        if (isOwner && short) {
            const commentsOff =
                short.commentsDisabled === true ||
                short.allowComments === false ||
                short.disableComments === true;
            const likesHidden =
                short.hideLikeCount === true ||
                short.showLikeCount === false ||
                short.hideLikes === true;

            const dcBtn = $("disableCommentsBtn");
            if (dcBtn) {
                const strong = dcBtn.querySelector("strong");
                const small = dcBtn.querySelector("small");
                if (strong) {
                    strong.textContent = commentsOff
                        ? "Turn on comments"
                        : "Turn off comments";
                }
                if (small) {
                    small.textContent = commentsOff
                        ? "Allow viewers to comment again"
                        : "Stop new comments on this Short";
                }
            }
            const hlBtn = $("hideLikeCountBtn");
            if (hlBtn) {
                const strong = hlBtn.querySelector("strong");
                const small = hlBtn.querySelector("small");
                if (strong) {
                    strong.textContent = likesHidden
                        ? "Show like count"
                        : "Hide like count";
                }
                if (small) {
                    small.textContent = likesHidden
                        ? "Display the number of likes"
                        : "Hide the number of likes from viewers";
                }
            }
        }

        menu.classList.remove("hidden");
        menu.setAttribute("aria-hidden", "false");
        document.body.classList.add("modalOpen");
    }

    function closeMoreMenu() {
        const menu = $("shortMenu");
        menu?.classList.add("hidden");
        menu?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modalOpen");
        menuShort = null;
        menuCard = null;
    }

    function getActiveShortId() {
        if (!menuShort) return "";
        return String(
            menuShort.id ||
            menuShort.shortId ||
            menuShort.key ||
            ""
        );
    }

    async function copyActiveShortLink() {
        const id = getActiveShortId();
        if (!id) return;

        const url =
            window.location.origin +
            (window.location.pathname.includes("shorts")
                ? window.location.pathname
                : "/shorts.html") +
            "?id=" +
            encodeURIComponent(id);

        try {
            await navigator.clipboard.writeText(url);
            showToast("Link copied");
        } catch (err) {
            showToast("Could not copy link");
        }
        closeMoreMenu();
    }

    async function deleteActiveShort() {
        if (!currentUser || !menuShort) return;

        const id = getActiveShortId();
        if (!id) return;

        const confirmed = window.confirm(
            "Delete this Short permanently?"
        );
        if (!confirmed) return;

        try {
            var ts = firebase.database.ServerValue.TIMESTAMP;
            var patch = {
                deleted: true,
                deletedAt: ts,
                archived: true,
                visibility: "private",
                hidden: true
            };
            var paths = [
                "shorts/" + id,
                "videos/" + id,
                "posts/" + id,
                "userVideos/" + (currentUser.uid) + "/" + id,
                "users/" + currentUser.uid + "/videos/" + id,
                "users/" + currentUser.uid + "/shorts/" + id
            ];
            await Promise.all(paths.map(function (path) {
                return db.ref(path).update(patch).catch(function () {
                    return db.ref(path).remove().catch(function () {});
                });
            }));
            // also remove from any feed mirrors
            try { await db.ref("feed/" + id).remove(); } catch (_) {}
            try { await db.ref("homeFeed/" + id).remove(); } catch (_) {}

            if (menuCard) menuCard.remove();
            showToast("Deleted permanently");
            closeMoreMenu();
        } catch (err) {
            console.error("Delete failed:", err);
            showToast("Delete failed");
        }
    }

    async function hideActiveShort() {
        if (!currentUser || !menuShort) return;
        const id = getActiveShortId();
        if (!id) return;

        try {
            await db.ref("shorts/" + id).update({
                hidden: true,
                hiddenAt: firebase.database.ServerValue.TIMESTAMP
            });

            if (menuCard) menuCard.remove();
            showToast("Short hidden");
            closeMoreMenu();
        } catch (err) {
            showToast("Hide failed");
        }
    }

    async function notInterestedShort() {
        if (!currentUser || !menuShort) return;
        const id = getActiveShortId();
        if (!id) return;

        try {
            await db
                .ref(
                    "notInterested/" +
                    currentUser.uid +
                    "/" +
                    id
                )
                .set(true);

            if (menuCard) menuCard.remove();
            showToast("We'll show fewer like this");
            closeMoreMenu();
        } catch (err) {
            showToast("Action failed");
        }
    }

    function openReportSheet() {
        closeMoreMenu();
        const id = getActiveShortId() ||
            (activeShort
                ? String(activeShort.id || activeShort.shortId || activeShort.key || "")
                : "") ||
            (menuShort
                ? String(menuShort.id || menuShort.shortId || menuShort.key || "")
                : "");
        const uid =
            (menuShort && getCreatorId(menuShort)) ||
            (activeShort && getCreatorId(activeShort)) ||
            (menuCard && menuCard.dataset.uid) ||
            "";
        const params = new URLSearchParams();
        params.set("type", "short");
        if (id) params.set("id", id);
        if (uid) params.set("uid", uid);
        window.location.href = "report.html?" + params.toString();
    }

    function closeReportSheet() {
        const reportModal = $("reportModal");
        reportModal?.classList.add("hidden");
        reportModal?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modalOpen");
    }

    async function submitReport(reason) {
        if (!currentUser) {
            showToast("Login required to report");
            closeReportSheet();
            return;
        }

        const id = getActiveShortId() ||
            (activeShort
                ? String(activeShort.id || activeShort.shortId || activeShort.key)
                : "");

        if (!id) {
            closeReportSheet();
            return;
        }

        try {
            await db.ref("reports").push({
                type: "short",
                shortId: id,
                reason: reason || "other",
                fromUID: currentUser.uid,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            showToast("Report submitted");
        } catch (err) {
            showToast("Report failed");
        }

        closeReportSheet();
    }

    function editActiveShort() {
        const id = getActiveShortId();
        if (!id) {
            showToast("Short not found");
            return;
        }
        closeMoreMenu();
        // Always open short-edit (details + settings), not upload
        window.location.href =
            "short-edit.html?id=" + encodeURIComponent(id) + "&edit=1";
    }

    function syncVolumeIcon(card, video) {
        const icon = card?.querySelector(".volumeBtn i");
        if (!icon || !video) return;
        icon.className = video.muted
            ? "fa-solid fa-volume-xmark"
            : "fa-solid fa-volume-high";
    }

    function toggleMute(card) {
        const video = card.querySelector("video.shortVideo");
        if (!video) return;

        video.muted = !video.muted;
        preferUnmuted = !video.muted;

        try {
            localStorage.setItem(
                "viewora_shorts_unmuted",
                preferUnmuted ? "1" : "0"
            );
        } catch (_) {}

        // Apply same mute state to every short video
        container?.querySelectorAll("video.shortVideo").forEach((v) => {
            v.muted = video.muted;
        });
        container?.querySelectorAll(".shortCard").forEach((c) => {
            const v = c.querySelector("video.shortVideo");
            if (v) syncVolumeIcon(c, v);
        });

        syncVolumeIcon(card, video);
    }

    function trackLikeSpam(shortId) {
        const now = Date.now();
        const arr = (likeSpamLog[shortId] || []).filter(
            (t) => now - t < LIKE_SPAM_WINDOW_MS
        );
        arr.push(now);
        likeSpamLog[shortId] = arr;
        return arr.length;
    }

    function showLikeSpamWarning() {
        const msg =
            "Please do not spam likes. Rapid like / unlike is against Viewora Community Guidelines. Repeated abuse may lead to account suspension.";
        try {
            var existing = document.getElementById("vieworaSpamSheet");
            if (existing) existing.remove();
            var wrap = document.createElement("div");
            wrap.id = "vieworaSpamSheet";
            wrap.className = "vieworaSpamSheet";
            wrap.innerHTML =
                '<div class="vieworaSpamBackdrop" data-close="1"></div>' +
                '<div class="vieworaSpamCard" role="dialog" aria-modal="true">' +
                '<div class="vieworaSpamIcon"><i class="fa-solid fa-shield-halved"></i></div>' +
                '<h3>Community Guidelines</h3>' +
                '<p>' + msg + '</p>' +
                '<button type="button" class="vieworaSpamOk" data-close="1">Got it</button>' +
                '</div>';
            document.body.appendChild(wrap);
            requestAnimationFrame(function () { wrap.classList.add("show"); });
            wrap.addEventListener("click", function (e) {
                if (!e.target.closest("[data-close]")) return;
                wrap.classList.remove("show");
                setTimeout(function () { try { wrap.remove(); } catch (_) {} }, 220);
            });
        } catch (_) {
            try { showToast(msg); } catch (__) {}
        }
    }

    async function doLike(card, short, fromDoubleTap) {
        if (!currentUser) {
            showToast("Login required to like");
            return;
        }

        const id = String(short.id || short.shortId || short.key || "");
        if (!id) return;

        const lockKey = id + ":" + currentUser.uid;
        if (likeInFlight.has(lockKey)) return;

        const taps = trackLikeSpam(id);
        if (taps >= LIKE_SPAM_LIMIT) {
            showLikeSpamWarning();
            return;
        }

        const likeBtn = card.querySelector(".likeBtn");
        const icon = likeBtn?.querySelector("i");
        const label = likeBtn?.querySelector("span");

        likeInFlight.add(lockKey);

        // Optimistic UI first — instant feedback
        const wasLikedUI = likeBtn?.classList.contains("liked");
        let willLike = fromDoubleTap ? true : !wasLikedUI;
        if (fromDoubleTap && wasLikedUI) {
            showHeart();
            likeInFlight.delete(lockKey);
            return;
        }

        let optimisticCount = safeNumber(card.__likes ?? short.likes ?? short.likeCount);
        if (willLike && !wasLikedUI) optimisticCount += 1;
        if (!willLike && wasLikedUI) optimisticCount = Math.max(0, optimisticCount - 1);

        card.__likes = optimisticCount;
        short.likes = optimisticCount;
        short.likeCount = optimisticCount;
        if (label) label.textContent = formatCount(optimisticCount);
        if (willLike) {
            likeBtn?.classList.add("liked");
            if (icon) icon.className = "fa-solid fa-heart";
            if (fromDoubleTap) showHeart();
        } else {
            likeBtn?.classList.remove("liked");
            if (icon) icon.className = "fa-regular fa-heart";
        }

        // Background Firebase — fully async, UI already updated
        (async function () {
            try {
                if (!db) return;
                const primaryRef = db.ref("shortLikes/" + id + "/" + currentUser.uid);
                let wasLiked = false;
                await primaryRef.transaction(function (cur) {
                    if (cur === null) {
                        wasLiked = false;
                        return willLike ? { uid: currentUser.uid, at: Date.now() } : null;
                    }
                    wasLiked = true;
                    return willLike ? cur : null;
                });
                const afterSnap = await primaryRef.once("value");
                const isLiked = afterSnap.exists();
                let delta = 0;
                if (isLiked && !wasLiked) delta = 1;
                if (!isLiked && wasLiked) delta = -1;
                let finalCount = optimisticCount;
                if (delta !== 0) {
                    try {
                        const countRef = db.ref("shorts/" + id + "/likes");
                        await countRef.transaction(function (c) {
                            const n = (typeof c === "number" ? c : 0) + delta;
                            finalCount = Math.max(0, n);
                            return finalCount;
                        });
                    } catch (_) {}
                    try { db.ref("shorts/" + id + "/likeCount").set(finalCount); } catch (_) {}
                }
                card.__likes = finalCount;
                short.likes = finalCount;
                short.likeCount = finalCount;
                const lbl = card.querySelector(".likeBtn span");
                if (lbl) lbl.textContent = formatCount(finalCount);
                try {
                    if (isLiked) {
                        const payload = { uid: currentUser.uid, at: Date.now() };
                        db.ref("shorts/" + id + "/likedBy/" + currentUser.uid).set(payload);
                        db.ref("users/" + currentUser.uid + "/likedShorts/" + id).set(payload);
                    } else {
                        db.ref("shorts/" + id + "/likedBy/" + currentUser.uid).remove();
                        db.ref("users/" + currentUser.uid + "/likedShorts/" + id).remove();
                    }
                } catch (_) {}
                const ownerId = getCreatorId(short);
                if (delta === 1 && ownerId && ownerId !== currentUser.uid) {
                    // Deterministic key → 1 like = 1 notification (no spam)
                    var notifKey = "like_short_" + id + "_" + currentUser.uid;
                    db.ref("notifications/" + ownerId + "/" + notifKey).set({
                        type: "like",
                        contentType: "short",
                        contentId: id,
                        senderUID: currentUser.uid,
                        fromUID: currentUser.uid,
                        createdAt: firebase.database.ServerValue.TIMESTAMP,
                        read: false
                    }).catch(function () {});
                } else if (delta === -1 && ownerId) {
                    try {
                        var nk = "like_short_" + id + "_" + currentUser.uid;
                        db.ref("notifications/" + ownerId + "/" + nk).remove();
                    } catch (_) {}
                }
            } catch (err) {
                console.error("Like sync failed:", err);
            } finally {
                likeInFlight.delete(lockKey);
            }
        })();
        // release lock quickly if network hangs (max 8s)
        setTimeout(function () { likeInFlight.delete(lockKey); }, 8000);
        return;
    }

    async function doSave(card, short) {
        if (!currentUser) {
            showToast("Login required to save");
            return;
        }

        const id = String(short.id || short.shortId || short.key);
        const ref = db.ref("savedShorts/" + currentUser.uid + "/" + id);
        const btn = card.querySelector(".saveBtn");
        const icon = btn?.querySelector("i");

        try {
            const snap = await ref.once("value");
            if (snap.exists()) {
                await ref.remove();
                btn?.classList.remove("saved");
                if (icon) icon.className = "fa-regular fa-bookmark";
                showToast("Removed from saved");
            } else {
                await ref.set({
                    shortId: id,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
                btn?.classList.add("saved");
                if (icon) icon.className = "fa-solid fa-bookmark";
                showToast("Short saved");
            }
        } catch (err) {
            console.error("Save failed:", err);
            showToast("Save failed");
        }
    }

    async function doFollow(button, uid) {
        if (!currentUser) {
            showToast("Login required to follow");
            return;
        }
        if (!uid || uid === currentUser.uid) return;

        const followingRef = db.ref(
            "following/" + currentUser.uid + "/" + uid
        );
        const followerRef = db.ref(
            "followers/" + uid + "/" + currentUser.uid
        );

        try {
            const snap = await followingRef.once("value");
            if (snap.exists()) {
                await Promise.all([
                    followingRef.remove(),
                    followerRef.remove()
                ]);
                button.textContent = "Follow";
                button.classList.remove("following");
            } else {
                await Promise.all([
                    followingRef.set(true),
                    followerRef.set(true)
                ]);
                button.textContent = "Following";
                button.classList.add("following");
            }
        } catch (err) {
            console.error("Follow failed:", err);
            showToast("Follow failed");
        }
    }

    function openProfile(uid) {
        if (!uid) return;
        window.location.href =
            "profile.html?uid=" + encodeURIComponent(uid);
    }


    /* =====================================================
       COMMENTS
    ===================================================== */

    let __shortsScrollY = 0;
    function openComments(short) {
        if (!short) return;
        activeShort = short;
        const sid = String(short.id || short.shortId || short.key || short.videoId || "");
        if (!sid) {
            showToast("Cannot open comments");
            return;
        }
        // remember scroll so page does not jump to top
        try {
            __shortsScrollY = (container && container.scrollTop) || 0;
        } catch (_) {}
        commentsModal?.classList.remove("hidden");
        commentsModal?.setAttribute("aria-hidden", "false");
        document.body.classList.add("modalOpen");
        // keep composer visible
        try {
            const sheet = commentsModal?.querySelector(".commentsSheet");
            if (sheet) sheet.scrollTop = 0;
        } catch (_) {}

        (async function () {
            try {
                if (commentUserAvatar && currentUser) {
                    let photo = currentUser.photoURL || "";
                    if (db) {
                        const us = await db.ref("users/" + currentUser.uid).once("value");
                        const u = us.val() || {};
                        photo = u.profilePhoto || u.photoURL || photo;
                    }
                    commentUserAvatar.src = photo || ("https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff&size=128");
                }
            } catch (_) {}
        })();

        loadComments(sid);
    }

    function closeCommentsModal() {
        commentsModal?.classList.add("hidden");
        commentsModal?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modalOpen");
        activeShort = null;
        // restore scroll position
        try {
            if (container) {
                requestAnimationFrame(function () {
                    container.scrollTop = __shortsScrollY || 0;
                });
            }
        } catch (_) {}
    }

    async function loadComments(id) {
        if (!commentsContainer || !id) return;

        if (!db && typeof firebase !== "undefined") {
            try { db = firebase.database(); window.db = db; } catch (_) {}
        }

        commentsContainer.innerHTML =
            '<div class="commentsLoading"><div class="loadingSpinner"></div><span>Loading comments...</span></div>';

        try {
            if (!db) throw new Error("no db");

            const snaps = await Promise.all([
                db.ref("comments/" + id).once("value").catch(function () { return null; }),
                db.ref("shorts/" + id + "/comments").once("value").catch(function () { return null; }),
                db.ref("shortComments/" + id).once("value").catch(function () { return null; })
            ]);
            let merged = {};
            snaps.forEach(function (s) {
                if (s && s.val) {
                    var v = s.val();
                    if (v && typeof v === "object") Object.assign(merged, v);
                }
            });

            let list = Object.entries(merged)
                .map(function (pair) {
                    return Object.assign({ id: pair[0] }, pair[1] || {});
                })
                .filter(function (c) {
                    return !c.deleted && !c.hidden && (c.text || c.comment || c.message);
                });

            // Strong dedupe: keep newest per uid+text+parent
            const byFp = {};
            list.forEach(function (c) {
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
            list = Object.keys(byFp).map(function (k) { return byFp[k]; });

            list.sort(function (a, b) {
                return (
                    safeNumber(a.createdAt || a.timestamp) -
                    safeNumber(b.createdAt || b.timestamp)
                );
            });

            if (!list.length) {
                commentsContainer.innerHTML =
                    '<div class="noComments">' +
                    '<i class="fa-regular fa-comment"></i>' +
                    "<strong>No comments yet</strong>" +
                    "<span>Be the first to comment.</span></div>";
                if (commentCountText) commentCountText.textContent = "0 comments";
                return;
            }

            if (commentCountText) {
                commentCountText.textContent =
                    list.length + (list.length === 1 ? " comment" : " comments");
            }

            commentsContainer.innerHTML = "";
            for (const c of list) {
                let user = {};
                try {
                    user = (await getUser(c.uid || c.userId)) || {};
                } catch (_) {}
                const name = safeText(
                    c.displayName || c.name || c.username || user.name || user.username,
                    "User"
                );
                const avatar =
                    c.profilePhoto ||
                    c.photoURL ||
                    c.avatar ||
                    user.profilePhoto ||
                    user.photoURL ||
                    "https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff&size=128";
                const text = safeText(c.text || c.comment || c.message, "");
                const when = timeAgo(c.createdAt || c.timestamp);
                const likes = safeNumber(c.likesCount || c.likes || 0);

                                let tick = "";
                try {
                    if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
                        const r = VieworaBadges.resolve(Object.assign({}, user, c));
                        tick = (r && r.html) ? r.html : "";
                    }
                } catch (_) {}
                const replyHint = c.replyToName
                    ? '<div class="csReplyLabel">↳ @' + escapeHTML(String(c.replyToName).replace(/^@/, "")) + "</div>"
                    : "";
                const row = document.createElement("div");
                row.className = "commentItem" + (c.parentId ? " csReplyItem" : "");
                row.innerHTML =
                    '<img src="' +
                    escapeHTML(avatar) +
                    '" alt="" onerror="this.onerror=null;this.src=\'https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff&size=128\'">' +
                    '<div class="commentBody">' +
                    "<strong>" +
                    escapeHTML(name) +
                    (tick ? " " + tick : "") +
                    "</strong>" +
                    replyHint +
                    "<p>" +
                    escapeHTML(text) +
                    "</p>" +
                    '<div class="commentMeta">' +
                    "<small>" +
                    escapeHTML(when) +
                    "</small>" +
                    '<button type="button" class="cLike" data-id="' +
                    escapeHTML(c.id) +
                    '"><i class="fa-regular fa-heart"></i> ' +
                    likes +
                    "</button>" +
                    '<button type="button" class="cReply" data-reply-name="' +
                    escapeHTML(name) +
                    '" data-reply-id="' +
                    escapeHTML(c.id) +
                    '">Reply</button>' +
                    "</div></div>";
                commentsContainer.appendChild(row);

            }

            commentsContainer.querySelectorAll(".cLike").forEach(function (btn) {
                btn.addEventListener("click", async function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!currentUser) {
                        showToast("Login required");
                        return;
                    }
                    const cid = btn.getAttribute("data-id");
                    if (!cid || !db) return;
                    if (btn.dataset.busy === "1") return;
                    btn.dataset.busy = "1";
                    const ref = db.ref(
                        "comments/" + id + "/" + cid + "/likedBy/" + currentUser.uid
                    );
                    try {
                        const snap = await ref.once("value");
                        const was = snap.exists();
                        if (was) await ref.remove();
                        else await ref.set(true);
                        const tree = await db
                            .ref("comments/" + id + "/" + cid + "/likedBy")
                            .once("value");
                        const count = tree.exists()
                            ? Object.keys(tree.val() || {}).length
                            : 0;
                        await db.ref("comments/" + id + "/" + cid).update({
                            likesCount: count,
                            likes: count
                        });
                        btn.innerHTML = was
                            ? '<i class="fa-regular fa-heart"></i> ' + count
                            : '<i class="fa-solid fa-heart" style="color:#ff304f"></i> ' + count;
                    } catch (err) {
                        console.warn(err);
                    } finally {
                        btn.dataset.busy = "0";
                    }
                });
            });
            commentsContainer.querySelectorAll(".cReply").forEach(function (btn) {
                btn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.__shortReplyToId = btn.getAttribute("data-reply-id") || "";
                    window.__shortReplyToName = btn.getAttribute("data-reply-name") || "";
                    if (commentText) {
                        commentText.focus();
                        commentText.placeholder =
                            "Reply to @" + (window.__shortReplyToName || "user") + "…";
                    }
                });
            });

            commentsContainer.scrollTop = commentsContainer.scrollHeight;
        } catch (err) {
            console.error("Comments failed:", err);
            commentsContainer.innerHTML =
                '<div class="noComments"><span>Comments unavailable.</span></div>';
        }
    }


    let __shortCommentInFlight = false;

    async function submitComment() {
        if (!currentUser) {
            showToast("Login required to comment");
            return;
        }
        if (!activeShort) return;
        if (__shortCommentInFlight) return;

        const text = (commentText?.value || "").trim();
        if (!text) return;

        const id = String(
            activeShort.id || activeShort.shortId || activeShort.key || ""
        );
        if (!id) {
            showToast("Short not found");
            return;
        }

        __shortCommentInFlight = true;
        if (sendComment) sendComment.disabled = true;

        try {
            if (!db && typeof firebase !== "undefined") {
                db = firebase.database();
                window.db = db;
            }
            if (!db) {
                showToast("Offline");
                return;
            }

            let me = {};
            try {
                const us = await db.ref("users/" + currentUser.uid).once("value");
                me = us.val() || {};
            } catch (_) {}

            const name =
                me.displayName ||
                me.name ||
                currentUser.displayName ||
                me.username ||
                "Viewora User";
            const username = me.username || "";
            const profilePhoto =
                me.profilePhoto ||
                me.photoURL ||
                currentUser.photoURL ||
                "https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff&size=128";

            const pushRef = db.ref("comments/" + id).push();
            let finalText = text;
            const parentId = window.__shortReplyToId || null;
            const replyToName = window.__shortReplyToName || "";
            if (parentId && replyToName) {
                const m = "@" + String(replyToName).replace(/^@/, "");
                if (finalText.indexOf(m) !== 0) finalText = m + " " + finalText;
            }
            const payload = {
                uid: currentUser.uid,
                userId: currentUser.uid,
                text: finalText,
                name: name,
                displayName: name,
                username: username,
                profilePhoto: profilePhoto,
                photoURL: profilePhoto,
                avatar: profilePhoto,
                likesCount: 0,
                parentId: parentId || null,
                replyToName: replyToName || null,
                createdAt: Date.now(),
                timestamp: Date.now()
            };
            await pushRef.set(payload);
            window.__shortReplyToId = "";
            window.__shortReplyToName = "";
            if (commentText) commentText.placeholder = "Add a comment...";

            try {
                const shortRef = db.ref("shorts/" + id);
                const snap = await shortRef.once("value");
                const cur = snap.val() || {};
                const next = safeNumber(cur.comments || cur.commentCount) + 1;
                await shortRef.update({ comments: next, commentCount: next });
                activeShort.comments = next;
                activeShort.commentCount = next;
                const card = container?.querySelector(
                    '[data-short-id="' + CSS.escape(id) + '"]'
                );
                const commentLabel = card?.querySelector('[data-action="comment"] span');
                if (commentLabel) commentLabel.textContent = formatCount(next);
            } catch (_) {}

            const ownerId = getCreatorId(activeShort);
            if (ownerId && ownerId !== currentUser.uid) {
                try {
                    await db.ref("notifications/" + ownerId).push({
                        type: "comment",
                        contentType: "short",
                        contentId: id,
                        text: text.slice(0, 120),
                        senderUID: currentUser.uid,
                        createdAt: Date.now(),
                        read: false
                    });
                } catch (_) {}
            }

            if (commentText) commentText.value = "";
            showToast("Comment added");
            await loadComments(id);
        } catch (err) {
            console.error("Comment failed:", err);
            showToast(
                err && err.code === "PERMISSION_DENIED"
                    ? "Permission denied for comments"
                    : "Comment failed"
            );
        } finally {
            __shortCommentInFlight = false;
            if (sendComment) sendComment.disabled = false;
        }
    }


    function openShare(short) {
        const id = (short && (short.id || short.shortId)) || "";
        const url =
            location.origin +
            "/shorts.html?id=" +
            encodeURIComponent(id);
        let thumb =
            (short &&
                (short.thumbnail ||
                    short.thumbnailUrl ||
                    short.thumb ||
                    short.cover ||
                    short.poster ||
                    short.imageUrl)) ||
            "";
        const vurl =
            (short && (short.videoUrl || short.videoURL || short.url || short.mediaUrl)) ||
            "";
        if ((!thumb || /\.mp4|\.webm/i.test(thumb)) && vurl && /cloudinary/i.test(vurl)) {
            thumb = vurl
                .replace("/video/upload/", "/video/upload/so_0,w_480,h_840,c_fill,q_auto,f_jpg/")
                .replace(/\.mp4($|\?)/i, ".jpg$1");
        }
        if (window.VieworaShare && typeof VieworaShare.open === "function") {
            VieworaShare.open({
                type: "short",
                id: id,
                url: url,
                title: (short && (short.caption || short.title)) || "Viewora Short",
                thumb: thumb || "",
                thumbnail: thumb || ""
            });
            return;
        }
        // fallback
        shareModal?.classList.remove("hidden");
        shareModal?.setAttribute("aria-hidden", "false");
    }

    function closeShareModal() {
        shareModal?.classList.add("hidden");
        shareModal?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modalOpen");
    }

    async function handleShare(type) {
        if (!activeShort) return;
        const id = String(
            activeShort.id || activeShort.shortId || activeShort.key
        );
        const url =
            window.location.origin +
            window.location.pathname.replace(/short\.html.*/, "shorts.html") +
            "?id=" +
            encodeURIComponent(id);

        try {
            if (type === "copy") {
                await navigator.clipboard.writeText(url);
                showToast("Link copied");
            } else if (type === "native") {
                if (navigator.share) {
                    await navigator.share({
                        title: "Viewora Short",
                        text: "Watch this Short on Viewora",
                        url
                    });
                } else {
                    await navigator.clipboard.writeText(url);
                    showToast("Link copied");
                }
            } else if (type === "whatsapp") {
                window.open(
                    "https://wa.me/?text=" + encodeURIComponent(url),
                    "_blank"
                );
            } else if (type === "facebook") {
                window.open(
                    "https://www.facebook.com/sharer/sharer.php?u=" +
                        encodeURIComponent(url),
                    "_blank"
                );
            } else if (type === "x") {
                window.open(
                    "https://twitter.com/intent/tweet?url=" +
                        encodeURIComponent(url),
                    "_blank"
                );
            }
            // Count share (copy / native / social)
            try {
                await bumpShareCount(id);
            } catch (_) {}
            closeShareModal();
        } catch (err) {
            if (err?.name !== "AbortError") {
                showToast("Share failed");
            }
        }
    }

    async function bumpShareCount(shortId) {
        if (!shortId || !db) return;
        try {
            const shortRef = db.ref("shorts/" + shortId);
            const snap = await shortRef.once("value");
            const cur = snap.val() || {};
            const next = (Number(cur.shares || cur.shareCount) || 0) + 1;
            await shortRef.update({ shares: next, shareCount: next });
            try {
                document.querySelectorAll('.shortAction[data-action="share"] span, [data-share-count]').forEach(function (el) {
                    var card = el.closest('.shortCard, .short-item, [data-id]');
                    if (card && String(card.dataset.id || "") === String(shortId)) {
                        el.textContent = formatCount ? formatCount(next) : String(next);
                    }
                });
            } catch (_) {}
            if (activeShort && String(activeShort.id || activeShort.shortId || activeShort.key) === String(shortId)) {
                activeShort.shares = next;
                activeShort.shareCount = next;
            }
            try {
                const el = document.querySelector("[data-share-count], #shareCount, .shareCount");
                if (el) el.textContent = next >= 1000 ? (next / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(next);
            } catch (_) {}
            // update side action label if present
            try {
                document.querySelectorAll(".shareCount, [data-count=share]").forEach(function (n) {
                    n.textContent = String(next);
                });
            } catch (_) {}
        } catch (e) {
            console.warn("share count", e);
        }
    }


    /* =====================================================
       LOAD SHORTS
    ===================================================== */

    async function loadShorts() {
        if (!container) return;

        try {
            const params = new URLSearchParams(window.location.search);
            const focusUid =
                params.get("uid") ||
                params.get("user") ||
                params.get("userId") ||
                "";
            const soloMode =
                params.get("solo") === "1" ||
                params.get("solo") === "true" ||
                params.get("from") === "profile";
            const requestedId =
                params.get("id") ||
                params.get("short") ||
                params.get("shortId") ||
                "";

            const snap = await db.ref("shorts").once("value");
            const val = snap.val();

            if (!val) {
                showEmpty();
                return;
            }

            shorts = Object.entries(val)
                .map(([key, data]) => {
                    if (!data || typeof data !== "object") return null;
                    return { ...data, id: data.id || key };
                })
                .filter(Boolean)
                .filter((s) => !!getMediaURL(s))
                .filter(
                    (s) =>
                        s.deleted !== true &&
                        s.archived !== true &&
                        s.hidden !== true &&
                        s.visibility !== "private"
                );

            // Profile / deep-link: ONLY this creator's shorts
            if (soloMode && focusUid) {
                shorts = shorts.filter((s) => {
                    const owner =
                        s.uid ||
                        s.userId ||
                        s.ownerId ||
                        s.creatorId ||
                        s.authorId ||
                        "";
                    return String(owner) === String(focusUid);
                });
            }

            // Rank via shared feed helper if present
            if (window.VieworaFeed && typeof window.VieworaFeed.rankShorts === "function") {
                shorts = window.VieworaFeed.rankShorts(shorts, {
                    preferId: requestedId,
                    solo: soloMode
                });
            } else {
                function engagementScore(s) {
                    const likes = safeNumber(s.likes || s.likeCount);
                    const comments = safeNumber(s.comments || s.commentCount);
                    const views = safeNumber(
                        s.views || s.viewCount || s.plays || s.playCount
                    );
                    const shares = safeNumber(s.shares || s.shareCount);
                    const created = safeNumber(s.createdAt || s.timestamp);
                    const ageH = created
                        ? Math.max(
                              0.5,
                              (Date.now() -
                                  (created < 1e12 ? created * 1000 : created)) /
                                  36e5
                          )
                        : 48;
                    const eng =
                        likes * 4 +
                        comments * 6 +
                        shares * 5 +
                        views * 0.15;
                    return eng / Math.pow(ageH + 2, 1.15) + (created || 0) / 1e15;
                }
                shorts.sort((a, b) => engagementScore(b) - engagementScore(a));
            }

            // Put requested short first so it plays immediately
            if (requestedId) {
                const ix = shorts.findIndex(
                    (s) => String(s.id) === String(requestedId)
                );
                if (ix > 0) {
                    const [hit] = shorts.splice(ix, 1);
                    shorts.unshift(hit);
                }
            }

            if (!shorts.length) {
                showEmpty();
                return;
            }

            hideEmpty();
            await renderShorts();
        } catch (err) {
            console.error("Shorts load failed:", err);
            showToast("Unable to load Shorts");
            showEmpty();
        }
    }

    async function renderShorts() {
        container.innerHTML = "";

        for (const short of shorts) {
            const card = await createShortCard(short);
            if (card) container.appendChild(card);
        }

        hideSkeleton();
        setupObserver();

        // Deep link
        const params = new URLSearchParams(window.location.search);
        const requested =
            params.get("id") ||
            params.get("short") ||
            params.get("shortId");

        if (requested) {
            const target = container.querySelector(
                `[data-short-id="${CSS.escape(requested)}"]`
            );
            if (target) {
                setTimeout(() => {
                    target.scrollIntoView({
                        behavior: "instant",
                        block: "start"
                    });
                }, 80);
            }
        }
    }


    /* =====================================================
       INTERSECTION OBSERVER
    ===================================================== */

    
    /* =====================================================
       UNIQUE VIEWS — 1 logged-in user = 1 view per short (forever)
    ===================================================== */
    const viewedShortIds = new Set(); // session memory
    const historyRecordedIds = new Set();

    function shortsViewerUid() {
        try {
            if (typeof currentUser !== "undefined" && currentUser && currentUser.uid) {
                return String(currentUser.uid);
            }
        } catch (_) {}
        try {
            if (typeof auth !== "undefined" && auth.currentUser && auth.currentUser.uid) {
                return String(auth.currentUser.uid);
            }
        } catch (_) {}
        try {
            if (typeof firebase !== "undefined" && firebase.auth) {
                const u = firebase.auth().currentUser;
                if (u && u.uid) return String(u.uid);
            }
        } catch (_) {}
        return null; // anonymous — do NOT count views
    }

    async function recordShortView(shortId) {
        if (!shortId) return;

        // Session lock (sync) — blocks rapid observer double-fire
        if (viewedShortIds.has(shortId)) return;
        viewedShortIds.add(shortId);

        // Profile → History
        try {
            let title = "Short";
            let thumb = "";
            let ownerName = "";
            const card =
                container &&
                container.querySelector(
                    '.shortCard[data-short-id="' +
                        (window.CSS && CSS.escape ? CSS.escape(shortId) : shortId) +
                        '"]'
                );
            if (card) {
                title =
                    card.getAttribute("data-title") ||
                    card.querySelector(".shortTitle")?.textContent ||
                    card.querySelector(".caption")?.textContent ||
                    title;
                const img = card.querySelector("img, video");
                if (img) {
                    thumb = img.getAttribute("poster") || img.getAttribute("src") || "";
                }
                ownerName =
                    card.getAttribute("data-username") ||
                    card.querySelector(".shortUsername")?.textContent ||
                    card.querySelector(".username")?.textContent ||
                    "";
            }
            if (window.__shortsById && window.__shortsById[shortId]) {
                const s = window.__shortsById[shortId];
                title = s.title || s.caption || title;
                thumb = s.thumbnail || s.thumb || s.coverUrl || thumb;
                ownerName = s.username || s.userName || ownerName;
            }
            if (typeof __recordShortWatch === "function") {
                __recordShortWatch({
                    id: shortId,
                    shortId: shortId,
                    title: String(title || "Short").trim().slice(0, 120),
                    thumbnail: thumb,
                    username: String(ownerName || "").replace(/^@/, "").trim()
                });
                try {
                    const vEl = card && card.querySelector("video");
                    if (vEl && typeof __bindShortProgress === "function") {
                        __bindShortProgress(vEl, {
                            id: shortId,
                            shortId: shortId,
                            title: String(title || "Short").trim().slice(0, 120),
                            thumbnail: thumb,
                            username: String(ownerName || "").replace(/^@/, "").trim()
                        });
                    }
                } catch (_bp) {}
            } else if (window.VieworaRecordWatch) {
                VieworaRecordWatch({
                    videoId: shortId,
                    type: "short",
                    title: String(title || "Short").trim().slice(0, 120),
                    thumb: thumb,
                    ownerName: String(ownerName || "").replace(/^@/, "").trim()
                });
            }
        } catch (histErr) {
            console.warn("[shorts history]", histErr);
        }

        const uid = shortsViewerUid();
        if (!uid) {
            // Not logged in → no view count (user asked: ek user id)
            return;
        }

        // Don't count creator watching own short
        try {
            const card =
                container &&
                container.querySelector(
                    '.shortCard[data-short-id="' + CSS.escape(shortId) + '"]'
                );
            if (card && card.dataset.uid && String(card.dataset.uid) === uid) {
                return;
            }
        } catch (_) {}

        // Persistent local lock
        const localKey = "viewora_sv_" + shortId + "_" + uid;
        try {
            if (localStorage.getItem(localKey) === "1") return;
        } catch (_) {}

        try {
            const viewedRef = db.ref("shorts/" + shortId + "/viewedBy/" + uid);

            // Atomic claim: only first writer "commits"
            const tx = await viewedRef.transaction((cur) => {
                if (cur !== null && cur !== undefined) {
                    // already viewed by this uid
                    return;
                }
                return {
                    at: Date.now(),
                    uid: uid
                };
            });

            if (!tx || !tx.committed) {
                // Someone already counted this uid
                try {
                    localStorage.setItem(localKey, "1");
                } catch (_) {}
                return;
            }

            // Only the winner increments the counter
            const viewsRef = db.ref("shorts/" + shortId + "/views");
            const viewCountRef = db.ref("shorts/" + shortId + "/viewCount");

            const vTx = await viewsRef.transaction((n) => {
                return (Number(n) || 0) + 1;
            });

            let next = 0;
            if (vTx && vTx.committed) {
                next = Number(vTx.snapshot.val()) || 0;
            } else {
                const snap = await viewsRef.once("value");
                next = (Number(snap.val()) || 0) + 1;
                await viewsRef.set(next);
            }
            try {
                await viewCountRef.set(next);
            } catch (_) {}

            try {
                localStorage.setItem(localKey, "1");
            } catch (_) {}

            // UI update
            try {
                const card =
                    container &&
                    container.querySelector(
                        '.shortCard[data-short-id="' + CSS.escape(shortId) + '"]'
                    );
                if (card) {
                    const meta = card.querySelector(".shortMeta span");
                    if (meta && /view/i.test(meta.textContent || "")) {
                        meta.textContent =
                            (typeof formatCount === "function"
                                ? formatCount(next)
                                : String(next)) + " views";
                    }
                }
            } catch (_) {}
        } catch (err) {
            console.warn("[shorts] unique view failed", err);
            // Roll back session lock so a later retry can work if rules blocked
            viewedShortIds.delete(shortId);
        }
    }


    function setupObserver() {
        if (observer) observer.disconnect();

        observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const item = entry.target;
                    const video = item.querySelector("video.shortVideo");

                    if (
                        entry.isIntersecting &&
                        entry.intersectionRatio >= 0.6
                    ) {
                        if (video) {
                            // pause others
                            container
                                .querySelectorAll("video.shortVideo")
                                .forEach((v) => {
                                    if (v !== video) {
                                        v.pause();
                                    }
                                });

                            // Keep sound ON across scroll once user unmuted (IG/YT style)
                            video.muted = !preferUnmuted;
                            if (preferUnmuted) {
                                try { video.volume = 1; } catch (_) {}
                            }
                            const sid = item.getAttribute("data-short-id") || item.dataset.shortId || "";
                            if (sid) {
                                recordShortView(sid);
                                try {
                                    if (!historyRecordedIds.has(sid)) {
                                        historyRecordedIds.add(sid);
                                        let title = "Short", thumb = "", ownerName = "";
                                        title = item.getAttribute("data-title") || item.querySelector(".shortTitle,.caption,.shortCaption")?.textContent || title;
                                        const media = item.querySelector("video.shortVideo, img");
                                        if (media) thumb = media.getAttribute("poster") || media.currentSrc || media.src || "";
                                        ownerName = item.getAttribute("data-username") || item.querySelector(".shortUsername,.username,.userName")?.textContent || "";
                                        if (window.VieworaRecordWatch) {
                                            VieworaRecordWatch({
                                                videoId: sid,
                                                type: "short",
                                                title: String(title || "Short").trim().slice(0, 120),
                                                thumb: thumb,
                                                ownerName: String(ownerName || "").replace(/^@/, "").trim()
                                            });
                                        }
                                    }
                                } catch (_) {}
                            }
                            const playPromise = video.play();
                            if (playPromise && typeof playPromise.catch === "function") {
                                playPromise.catch(() => {
                                    // Autoplay with sound blocked → fallback mute once
                                    if (!video.muted) {
                                        video.muted = true;
                                        video.play().catch(() => {});
                                    }
                                });
                            }
                            syncVolumeIcon(item, video);
                        }
                    } else if (video) {
                        video.pause();
                    }
                });
            },
            { threshold: [0.25, 0.6, 0.9] }
        );

        container.querySelectorAll(".shortCard").forEach((c) => {
            observer.observe(c);
        });
    }


    /* =====================================================
       UI WIRING
    ===================================================== */

    function wireUI() {
        $("shortsBackBtn")?.addEventListener("click", () => {
            if (history.length > 1) history.back();
            else window.location.href = "index.html";
        });

        $("createShortBtn")?.addEventListener("click", () => {
            window.location.href = "upload.html";
        });

        $("emptyCreateBtn")?.addEventListener("click", () => {
            window.location.href = "upload.html";
        });

        $("shortSearchBtn")?.addEventListener("click", () => {
            shortSearchBar?.classList.toggle("hidden");
            if (!shortSearchBar?.classList.contains("hidden")) {
                shortSearchInput?.focus();
            }
        });

        $("clearShortSearch")?.addEventListener("click", () => {
            if (shortSearchInput) shortSearchInput.value = "";
            shortSearchBar?.classList.add("hidden");
        });

        closeComments?.addEventListener("click", closeCommentsModal);
        commentsOverlay?.addEventListener("click", closeCommentsModal);
        sendComment?.addEventListener("click", submitComment);
        commentText?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitComment();
            }
        });

        closeShare?.addEventListener("click", closeShareModal);
        shareOverlay?.addEventListener("click", closeShareModal);

        document.querySelectorAll("[data-share]").forEach((btn) => {
            btn.addEventListener("click", () => {
                handleShare(btn.dataset.share);
            });
        });

        // 3-dot menu
        $("closeShortMenu")?.addEventListener("click", closeMoreMenu);
        $("menuBackdrop")?.addEventListener("click", closeMoreMenu);

        $("copyShortLinkBtn")?.addEventListener("click", copyActiveShortLink);
        $("deleteShortBtn")?.addEventListener("click", deleteActiveShort);
        $("hideShortBtn")?.addEventListener("click", hideActiveShort);
        
        $("descShortBtn")?.addEventListener("click", () => {
            var s = menuShort;
            closeMoreMenu();
            if (s && typeof openShortDescriptionSheet === "function") {
                openShortDescriptionSheet(s);
            }
        });
        $("descOwnShortBtn")?.addEventListener("click", () => {
            var s = menuShort;
            closeMoreMenu();
            if (s && typeof openShortDescriptionSheet === "function") {
                openShortDescriptionSheet(s);
            }
        });
        $("useAudioMenuBtn")?.addEventListener("click", () => {
            var s = menuShort;
            closeMoreMenu();
            if (!s) return;
            try {
                var uname = s.username || s.userName || s.name || "user";
                var meta = (typeof getMusicMeta === "function") ? getMusicMeta(s, uname) : {};
                var payload = {
                    id: meta.id || s.musicId || s.audioId || ("orig_" + (s.id || "")),
                    musicId: meta.id || s.musicId || s.audioId || "",
                    title: meta.title || s.musicTitle || "Original audio",
                    name: meta.title || s.musicTitle || "Original audio",
                    artist: meta.artist || uname,
                    audioUrl: meta.audioUrl || s.musicUrl || s.audioUrl || s.videoUrl || "",
                    url: meta.audioUrl || s.musicUrl || s.audioUrl || s.videoUrl || "",
                    isOriginal: true,
                    sourceShortId: s.id || "",
                    uid: s.uid || s.userId || "",
                    at: Date.now()
                };
                sessionStorage.setItem("vieworaSelectedMusic", JSON.stringify(payload));
                sessionStorage.setItem("viewora_selected_music", JSON.stringify(payload));
                localStorage.setItem("viewora_selected_music", JSON.stringify(payload));
            } catch (_) {}
            location.href = "upload.html?type=shorts&useMusic=1";
        });
        $("saveShortMenuBtn")?.addEventListener("click", async () => {
            closeMoreMenu();
            if (menuCard && menuShort && typeof doSave === "function") {
                await doSave(menuCard, menuShort);
            }
        });
        $("hideCreatorBtn")?.addEventListener("click", () => {
            closeMoreMenu();
            try {
                const uid = getCreatorId(menuShort);
                if (uid) {
                    const key = "viewora_hidden_creators";
                    const arr = JSON.parse(localStorage.getItem(key) || "[]");
                    if (!arr.includes(uid)) arr.push(uid);
                    localStorage.setItem(key, JSON.stringify(arr));
                    showToast("Creator hidden from your feed");
                    if (menuCard) menuCard.remove();
                }
            } catch (_) {}
        });

        $("notInterestedBtn")?.addEventListener("click", notInterestedShort);
        $("reportShortBtn")?.addEventListener("click", openReportSheet);
        $("editShortBtn")?.addEventListener("click", editActiveShort);

        $("saveShortBtn")?.addEventListener("click", async () => {
            if (menuCard && menuShort) {
                await doSave(menuCard, menuShort);
            }
            closeMoreMenu();
        });

        $("disableCommentsBtn")?.addEventListener("click", async () => {
            const id = getActiveShortId();
            if (!id || !currentUser) return;
            if (!db) {
                showToast("Not connected");
                return;
            }
            const currentlyOff =
                menuShort &&
                (menuShort.commentsDisabled === true ||
                    menuShort.allowComments === false ||
                    menuShort.disableComments === true);
            const nextOff = !currentlyOff;
            try {
                await db.ref("shorts/" + id).update({
                    commentsDisabled: nextOff,
                    allowComments: !nextOff,
                    disableComments: nextOff
                });
                if (menuShort) {
                    menuShort.commentsDisabled = nextOff;
                    menuShort.allowComments = !nextOff;
                    menuShort.disableComments = nextOff;
                }
                // Live-update active card
                if (menuCard) {
                    menuCard.dataset.commentsOff = nextOff ? "1" : "0";
                }
                showToast(nextOff ? "Comments turned off" : "Comments turned on");
            } catch (e) {
                console.error(e);
                showToast("Failed");
            }
            closeMoreMenu();
        });

        $("hideLikeCountBtn")?.addEventListener("click", async () => {
            const id = getActiveShortId();
            if (!id || !currentUser) return;
            if (!db) {
                showToast("Not connected");
                return;
            }
            const currentlyHidden =
                menuShort &&
                (menuShort.hideLikeCount === true ||
                    menuShort.showLikeCount === false ||
                    menuShort.hideLikes === true);
            const nextHidden = !currentlyHidden;
            try {
                await db.ref("shorts/" + id).update({
                    hideLikeCount: nextHidden,
                    showLikeCount: !nextHidden,
                    hideLikes: nextHidden
                });
                if (menuShort) {
                    menuShort.hideLikeCount = nextHidden;
                    menuShort.showLikeCount = !nextHidden;
                    menuShort.hideLikes = nextHidden;
                }
                if (menuCard) {
                    const span = menuCard.querySelector(
                        '[data-action="like"] span, .likeCount, .shortLikeCount'
                    );
                    if (span) {
                        span.style.display = nextHidden ? "none" : "";
                    }
                    menuCard.dataset.hideCount = nextHidden ? "1" : "0";
                }
                showToast(nextHidden ? "Like count hidden" : "Like count visible");
            } catch (e) {
                console.error(e);
                showToast("Failed");
            }
            closeMoreMenu();
        });

        // Report modal
        $("closeReport")?.addEventListener("click", closeReportSheet);
        $("reportOverlay")?.addEventListener("click", closeReportSheet);

        document.querySelectorAll(".reportBtn").forEach((btn) => {
            btn.addEventListener("click", () => {
                submitReport(btn.dataset.report || "other");
            });
        });

        // Bottom nav handled by global nav.js

        // Network
        window.addEventListener("offline", () => {
            networkStatus?.classList.remove("hidden");
        });
        window.addEventListener("online", () => {
            networkStatus?.classList.add("hidden");
        });
    }


    /* =====================================================
       INIT
    ===================================================== */

    async function init() {
        wireUI();

        try {
            await waitForAuth();
            await loadShorts();
        } catch (err) {
            console.error("Shorts init failed:", err);
            showEmpty();
        } finally {
            hideSkeleton();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

    // Global
    window.VieworaShorts = {
        reload: loadShorts,
        getUser
    };

})();


/* Shorts Live cards in feed */
(function () {
  function findShortsTrack() {
    return (
      document.getElementById("shortsTrack") ||
      document.getElementById("shortsFeed") ||
      document.getElementById("shortsContainer") ||
      document.querySelector(".shortsFeed, .shorts-track, .shortsContainer, #feed, main.shorts")
    );
  }
  async function injectShortsLives() {
    try {
      var db = window.db || (window.firebase && firebase.database && firebase.database());
      if (!db) return;
      var snap = await db.ref("feedLive/shorts").once("value");
      var track = findShortsTrack();
      if (!track) return;
      // remove stale live cards first
      track.querySelectorAll(".shortLiveCard").forEach(function (n) {
        try { n.remove(); } catch (_) {}
      });
      if (!snap.exists()) return;
      var nodes = [];
      snap.forEach(function (child) {
        var d = child.val() || {};
        if (d.active === false) return;
        var uid = d.hostUid || d.uid || child.key;
        var el = document.createElement("article");
        el.className = "shortCard shortLiveCard";
        el.dataset.liveUid = uid;
        el.dataset.shortId = "live_" + uid;
        var photo = d.hostPhoto || "https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff&size=128";
        var name = d.hostName || "Live";
        var title = d.title || "Shorts Live";
        el.innerHTML =
          '<div class="shortLiveInner" style="position:relative;width:100%;min-height:70vh;background:#0a0a0f;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;padding:24px;box-sizing:border-box">' +
          '<span style="position:absolute;top:16px;left:16px;background:#ef4444;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:800;letter-spacing:.04em">LIVE</span>' +
          '<img src="' +
          String(photo).replace(/"/g, "") +
          '" alt="" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid #ef4444" onerror="this.onerror=null;this.src=\'https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff&size=128\'">' +
          '<strong style="margin-top:14px;font-size:16px">' +
          String(name).replace(/</g, "") +
          "</strong>" +
          '<span style="opacity:.75;font-size:13px;margin-top:6px;text-align:center">' +
          String(title).replace(/</g, "") +
          "</span>" +
          '<button type="button" style="margin-top:18px;padding:12px 22px;border-radius:99px;border:none;background:linear-gradient(135deg,#ef4444,#ec4899);color:#fff;font-weight:700">Join Live</button>' +
          "</div>";
        el.addEventListener("click", function () {
          location.href = "live.html?uid=" + encodeURIComponent(uid) + "&format=shorts";
        });
        nodes.push(el);
      });
      nodes.reverse().forEach(function (el) {
        if (track.firstChild) track.insertBefore(el, track.firstChild);
        else track.appendChild(el);
      });
    } catch (e) {
      console.warn("[VIEWORA] shorts lives", e);
    }
  }
  function bootLives() {
    injectShortsLives();
    setTimeout(injectShortsLives, 1200);
    setTimeout(injectShortsLives, 3500);
    try {
      var db = window.db || (window.firebase && firebase.database && firebase.database());
      if (db && !window.__vieworaShortsLiveBound) {
        window.__vieworaShortsLiveBound = true;
        db.ref("feedLive/shorts").on("value", function () {
          injectShortsLives();
        });
      }
    } catch (_) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootLives, { once: true });
  } else bootLives();
})();


    /* ---- Short title → description sheet (upload date + use this audio) ---- */
    function openShortDescriptionSheet(shortObj) {
        if (!shortObj) return;
        var likes = Number(shortObj.likes || shortObj.likeCount || 0) || 0;
        var views = Number(shortObj.views || shortObj.viewCount || shortObj.plays || 0) || 0;
        var title = String(shortObj.title || shortObj.caption || shortObj.text || "Short").trim();
        var desc = String(shortObj.description || shortObj.caption || shortObj.text || "").trim();
        if (!desc || desc === title) desc = "No description added.";
        var dateStr = "—";
        try {
            var ts = shortObj.createdAt || shortObj.timestamp || shortObj.publishedAt || shortObj.time || 0;
            if (typeof ts === "object" && ts !== null) ts = ts.seconds ? ts.seconds * 1000 : (ts.toMillis ? ts.toMillis() : 0);
            if (ts) {
                var d = new Date(Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts));
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                }
            }
        } catch (_) {}
        var uname = String(shortObj.username || shortObj.userName || shortObj.name || "user").replace(/^@/, "");
        var musicMeta = (typeof getMusicMeta === "function") ? getMusicMeta(shortObj, uname) : { title: "Original audio", artist: uname, isOriginal: true, iconUrl: "", id: "", audioUrl: "" };
        var musicTitle = (musicMeta && musicMeta.title) || "Original audio";
        var musicArtist = (musicMeta && musicMeta.artist) || uname;
        var musicIcon = (musicMeta && musicMeta.iconUrl) || shortObj.userPhoto || shortObj.avatar || "assets/logo.png";

        function fmt(n) {
            n = Number(n) || 0;
            if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
            if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
            return String(n);
        }

        var sheet = document.getElementById("vieworaShortDescSheet");
        if (!sheet) {
            sheet = document.createElement("div");
            sheet.id = "vieworaShortDescSheet";
            sheet.innerHTML =
              '<div class="vsdBackdrop" data-close="1"></div>' +
              '<div class="vsdPanel">' +
                '<div class="vsdHandle"></div>' +
                '<div class="vsdHead"><h2>Description</h2><button type="button" class="vsdX" data-close="1" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
                '<div class="vsdTitle" id="vsdTitle"></div>' +
                '<div class="vsdStats">' +
                  '<div class="vsdStat"><strong id="vsdLikes">0</strong><span>Likes</span></div>' +
                  '<div class="vsdStat"><strong id="vsdViews">0</strong><span>Views</span></div>' +
                  '<div class="vsdStat"><strong id="vsdDate">—</strong><span>Date</span></div>' +
                '</div>' +
                '<div class="vsdDesc clamped" id="vsdDesc"></div>' +
                '<button type="button" class="vsdMore hidden" id="vsdMore">...more</button>' +
                '<div class="vsdMusicBlock">' +
                  '<div class="vsdSection">Music</div>' +
                  '<button type="button" class="vsdMusicCard" id="vsdMusicCard">' +
                    '<img class="vsdMusicArt" id="vsdMusicArt" src="assets/logo.png" alt="">' +
                    '<div class="vsdMusicMeta"><strong id="vsdMusicTitle">Original audio</strong><span id="vsdMusicArtist">Creator</span></div>' +
                    '<i class="fa-solid fa-chevron-right"></i>' +
                  '</button>' +
                  '<button type="button" class="vsdAudioBtn" id="vsdUseAudio"><i class="fa-solid fa-music"></i> Use this audio · Remix Short</button>' +
                '</div>' +
                '<div class="vsdSection">Video details</div>' +
                '<div class="vsdDetails">' +
                  '<div class="vsdRow"><span><i class="fa-regular fa-calendar"></i> Date</span><span id="vsdDetailDate">—</span></div>' +
                  '<div class="vsdRow"><span><i class="fa-regular fa-eye"></i> Views</span><span id="vsdDetailViews">0</span></div>' +
                  '<div class="vsdRow"><span><i class="fa-regular fa-heart"></i> Likes</span><span id="vsdDetailLikes">0</span></div>' +
                '</div>' +
              '</div>';
            document.body.appendChild(sheet);
            if (!document.getElementById("vsdCSS_v10")) {
                var st = document.createElement("style");
                st.id = "vsdCSS_v10";
                st.textContent =
                  "#vieworaShortDescSheet{position:fixed;inset:0;z-index:99999;display:none;align-items:flex-end;justify-content:stretch;padding:0;margin:0}" +
                  "#vieworaShortDescSheet.open{display:flex!important}" +
                  ".vsdBackdrop{position:absolute;inset:0;background:rgba(0,0,0,.6)}" +
                  ".vsdPanel{position:relative;width:100%;max-width:100%;max-height:88vh;overflow-y:auto;background:#0f0f0f;border-radius:18px 18px 0 0;padding:8px 18px calc(28px + env(safe-area-inset-bottom));color:#f1f1f1;-webkit-overflow-scrolling:touch}" +
                  ".vsdHandle{width:40px;height:4px;border-radius:4px;background:rgba(255,255,255,.25);margin:6px auto 12px}" +
                  ".vsdHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}" +
                  ".vsdHead h2{margin:0;font-size:18px;font-weight:700}" +
                  ".vsdX{border:0;background:rgba(255,255,255,.08);width:36px;height:36px;border-radius:50%;color:#fff;display:grid;place-items:center;font-size:16px}" +
                  ".vsdTitle{font-size:16px;font-weight:700;line-height:1.35;margin:6px 0 14px;color:#f1f1f1}" +
                  ".vsdStats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}" +
                  ".vsdStat{background:#272727;border-radius:12px;padding:14px 10px;text-align:center;display:flex;flex-direction:column;gap:4px}" +
                  ".vsdStat strong{font-size:16px;font-weight:700;color:#fff}" +
                  ".vsdStat span{font-size:12px;color:#aaa;font-weight:500}" +
                  ".vsdDesc{font-size:15px;line-height:1.55;color:#f1f1f1;white-space:pre-wrap;background:#272727;border-radius:12px;padding:14px 16px;margin-bottom:6px}" +
                  ".vsdDesc.clamped{-webkit-line-clamp:5;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;max-height:7.75em}" +
                  ".vsdMore{border:0;background:transparent;color:#3ea6ff;font-size:14px;font-weight:600;padding:4px 0 14px;cursor:pointer;text-align:left}" +
                  ".vsdMore.hidden{display:none}" +
                  ".vsdSection{font-size:15px;font-weight:700;margin:10px 0 12px;color:#fff}" +
                  ".vsdMusicCard{width:100%;display:flex;align-items:center;gap:12px;background:transparent;border:0;color:#fff;text-align:left;padding:4px 0 10px}" +
                  ".vsdMusicArt{width:52px;height:52px;border-radius:8px;object-fit:cover;background:#272727;flex-shrink:0}" +
                  ".vsdMusicMeta{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}" +
                  ".vsdMusicMeta strong{font-size:14px;font-weight:600}" +
                  ".vsdMusicMeta span{font-size:12px;color:#aaa}" +
                  ".vsdAudioBtn{width:100%;border:0;background:transparent;color:#aaa;font-size:13px;font-weight:500;padding:8px 0 14px;text-align:center}" +
                  ".vsdDetails{display:flex;flex-direction:column}" +
                  ".vsdRow{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:14px;color:#f1f1f1}" +
                  ".vsdRow span:first-child{color:#aaa;display:inline-flex;align-items:center;gap:8px}";

                document.head.appendChild(st);
            }
            sheet.addEventListener("click", function (e) {
                if (e.target.closest("[data-close]")) {
                    sheet.classList.remove("open");
                    document.body.classList.remove("modalOpen");
                    return;
                }
                if (e.target.closest("#vsdUseAudio") || e.target.closest("#vsdMusicCard")) {
                    try {
                        var so = sheet.__shortObj || {};
                        var un = String(so.username || so.userName || so.name || "user").replace(/^@/, "");
                        var meta = (typeof getMusicMeta === "function") ? getMusicMeta(so, un) : {};
                        var q = new URLSearchParams();
                        if (meta.id) q.set("id", meta.id);
                        if (meta.title) q.set("name", meta.title);
                        if (meta.artist) q.set("artist", meta.artist);
                        if (meta.audioUrl) q.set("audio", meta.audioUrl);
                        if (meta.isOriginal) q.set("original", "1");
                        var sid = so.id || so.shortId || "";
                        if (sid) q.set("shortId", sid);
                        var uid = so.uid || so.userId || so.ownerId || "";
                        if (uid) q.set("uid", uid);
                        var vurl = so.videoUrl || so.videoURL || so.mediaUrl || "";
                        if (vurl && !meta.audioUrl) q.set("video", vurl);
                        location.href = "music-detail.html?" + q.toString();
                    } catch (err) {
                        console.warn("music open", err);
                    }
                }
            });
        }
        // fill
        var set = function (id, val) {
            var el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        set("vsdTitle", title);
        set("vsdLikes", fmt(likes));
        set("vsdViews", fmt(views));
        set("vsdDate", dateStr);
        set("vsdDesc", desc);
        var descEl = document.getElementById("vsdDesc");
        var moreBtn = document.getElementById("vsdMore");
        if (descEl) {
            descEl.classList.add("clamped");
            descEl.textContent = desc;
            // show more if longer than ~5 lines (~280 chars or height)
            var needMore = String(desc).length > 180 || String(desc).split("\n").length > 4;
            if (moreBtn) {
                if (needMore && desc !== "No description added.") {
                    moreBtn.classList.remove("hidden");
                    moreBtn.textContent = "...more";
                    moreBtn.onclick = function () {
                        if (descEl.classList.contains("clamped")) {
                            descEl.classList.remove("clamped");
                            moreBtn.textContent = "Show less";
                        } else {
                            descEl.classList.add("clamped");
                            moreBtn.textContent = "...more";
                        }
                    };
                } else {
                    moreBtn.classList.add("hidden");
                    descEl.classList.remove("clamped");
                }
            }
        }
        set("vsdMusicTitle", musicTitle);
        set("vsdMusicArtist", musicArtist);
        set("vsdDetailDate", dateStr);
        set("vsdDetailViews", fmt(views));
        set("vsdDetailLikes", fmt(likes));
        var art = document.getElementById("vsdMusicArt");
        if (art) {
            art.src = musicIcon || "assets/logo.png";
            art.onerror = function () { this.src = "assets/logo.png"; };
        }
        // store shortObj for music click
        sheet.__shortObj = shortObj;
        sheet.classList.add("open");
        document.body.classList.add("modalOpen");
    }

    window.openShortDescriptionSheet = openShortDescriptionSheet;


    document.addEventListener("click", function (e) {
        const t = e.target.closest(".shortMusicLabel, .musicTitleBtn, .short-title, [data-short-title], .bottomTitle, .shortsTitle");
        if (!t) return;
        e.preventDefault();
        e.stopPropagation();
        let shortObj = null;
        try {
            if (window.currentShort) shortObj = window.currentShort;
            else if (typeof getActiveShort === "function") shortObj = getActiveShort();
            else if (t.dataset && t.dataset.shortId && window.__shortsMap) shortObj = window.__shortsMap[t.dataset.shortId];
        } catch (_) {}
        if (!shortObj) {
            shortObj = {
                title: t.textContent || t.getAttribute("title") || "Short",
                description: t.getAttribute("data-desc") || "",
                createdAt: t.getAttribute("data-created") || null,
                musicUrl: t.getAttribute("data-music") || "",
                musicId: t.getAttribute("data-music-id") || "",
                id: t.getAttribute("data-short-id") || ""
            };
        }
        if (typeof openShortDescriptionSheet === "function") openShortDescriptionSheet(shortObj);
    }, true);
    window.vsdTitleClickBound = true;


/* VIEWORA_FORCE_HIST_SHORT — guarantee history write */
(function () {
  function forceRecord() {
    try {
      if (!window.VieworaRecordWatch) return;
      var card = document.querySelector(".shortCard.active, .shortCard[data-active='1']") ||
        document.querySelector(".shortCard video.shortVideo:not([paused])")?.closest(".shortCard");
      if (!card) {
        var videos = document.querySelectorAll("video.shortVideo");
        for (var i = 0; i < videos.length; i++) {
          if (!videos[i].paused && !videos[i].ended) {
            card = videos[i].closest(".shortCard");
            break;
          }
        }
      }
      if (!card) return;
      var sid = card.getAttribute("data-short-id") || card.dataset.shortId || "";
      if (!sid) return;
      var title = card.getAttribute("data-title") ||
        (card.querySelector(".shortCaption, .shortTitle, .caption") || {}).textContent || "Short";
      var thumb = "";
      var v = card.querySelector("video");
      if (v) thumb = v.getAttribute("poster") || v.currentSrc || "";
      var owner = card.getAttribute("data-username") ||
        (card.querySelector(".shortUsername") || {}).textContent || "";
      VieworaRecordWatch({
        videoId: String(sid),
        type: "short",
        title: String(title).trim().slice(0, 120),
        thumb: thumb,
        ownerName: String(owner || "").replace(/^@/, "").trim(),
        progress: 0.2
      });
    } catch (e) {
      console.warn("[FORCE_HIST]", e);
    }
  }
  setInterval(forceRecord, 2500);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) forceRecord();
  });
})();

/* Triple-tap nav refresh */
window.VieworaRefreshFeed = function () {
  try {
    sessionStorage.setItem("viewora_shorts_shuffle", String(Date.now()));
  } catch (_) {}
  try {
    if (typeof loadFeed === "function") { loadFeed(true); return; }
    if (typeof refreshFeed === "function") { refreshFeed(); return; }
    if (typeof loadShorts === "function") { loadShorts(true); return; }
  } catch (_) {}
  location.reload();
};


/* VIEWORA_SHORT_DESC_OPEN — title / caption / 3-dot Description */
(function () {
  function getActiveShortData(card) {
    try {
      if (!card) return null;
      var id = card.getAttribute("data-short-id") || card.getAttribute("data-id") || card.dataset.shortId || card.dataset.id || "";
      var map = window.__shortsMap || window.shortsMap || null;
      if (map && id && map[id]) return map[id];
      if (card.__shortData) return card.__shortData;
      return {
        id: id,
        title: (card.querySelector(".shortCaption, .shortTitle") || {}).textContent || "Short",
        caption: (card.querySelector(".shortCaption") || {}).textContent || "",
        description: card.getAttribute("data-desc") || "",
        likes: card.__likes || 0,
        views: card.getAttribute("data-views") || 0,
        username: card.getAttribute("data-username") || "",
        videoUrl: (card.querySelector("video") || {}).src || ""
      };
    } catch (_) { return null; }
  }
  document.addEventListener("click", function (e) {
    var cap = e.target.closest(".shortCaption, .shortTitle, [data-action='caption']");
    if (!cap) return;
    // let internal handleAction run first; fallback if sheet not open after 50ms
    var card = cap.closest(".shortCard");
    setTimeout(function () {
      var sheet = document.getElementById("vieworaShortDescSheet");
      if (sheet && sheet.classList.contains("open")) return;
      var shortObj = getActiveShortData(card);
      if (shortObj && typeof window.openShortDescriptionSheet === "function") {
        window.openShortDescriptionSheet(shortObj);
      }
    }, 60);
  }, false);
})();


/* VIEWORA_SHORTS_AUDIO_UNLOCK — first tap unlocks sound (no extra speaker click needed after) */
(function () {
  var unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      window.__vieworaPreferUnmuted = true;
      localStorage.setItem("viewora_shorts_unmuted", "1");
    } catch (_) {}
    try {
      document.querySelectorAll("video.shortVideo").forEach(function (v) {
        try {
          v.muted = false;
          v.volume = 1;
          v.removeAttribute("muted");
        } catch (_) {}
      });
      var active = document.querySelector(".shortCard.active video.shortVideo, .shortCard[data-active='1'] video.shortVideo") ||
        document.querySelector("video.shortVideo:not([paused])");
      if (active) {
        active.muted = false;
        active.play().catch(function () {});
      }
    } catch (_) {}
  }
  // Any intentional interaction unlocks (volume btn still works)
  ["pointerdown", "touchstart", "click"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      // Don't unlock on pure scroll; unlock on card / controls
      if (e.target.closest && e.target.closest(".shortCard, .volumeBtn, .shortActions")) {
        unlock();
      }
    }, { passive: true, once: false });
  });
  // If already preferred unmuted from previous session
  try {
    if (localStorage.getItem("viewora_shorts_unmuted") === "1") {
      window.__vieworaPreferUnmuted = true;
    }
  } catch (_) {}
})();


/* VIEWORA_VIS_FILTER — private / unlisted / deleted */
(function () {
  function isHiddenContent(d) {
    if (!d) return true;
    if (d.deleted === true || d.archived === true) return true;
    var v = String(d.visibility || d.privacy || "public").toLowerCase();
    if (v === "private") return true;
    // unlisted: only show if URL has matching id
    if (v === "unlisted") {
      try {
        var q = new URLSearchParams(location.search);
        var id = q.get("id") || q.get("short") || q.get("v") || "";
        var sid = String(d.id || d.shortId || "");
        if (id && sid && id === sid) return false;
        return true;
      } catch (_) { return true; }
    }
    return false;
  }
  window.__vieworaIsHiddenContent = isHiddenContent;
})();
