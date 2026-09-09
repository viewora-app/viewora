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
        if (!toastEl) return;
        if (toastText) toastText.textContent = String(msg || "");
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
        if (userCache[uid]) return userCache[uid];

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
                    "",
                photoURL:
                    data.photoURL ||
                    data.profilePhoto ||
                    "",
                verified: data.verified === true
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

    function getMusicLabel(short, username) {
        // Prevent [object Object]
        const raw =
            short.music ||
            short.sound ||
            short.audio ||
            short.song ||
            short.musicTitle ||
            null;

        const music = safeText(raw, "");
        if (music) return music;

        const uname = safeText(username, "user").replace(/^@/, "");
        return "Original sound • " + uname;
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

        const avatar =
            short.profilePhoto ||
            short.photoURL ||
            short.avatar ||
            creator?.profilePhoto ||
            creator?.photoURL ||
            (currentUser && creatorId === currentUser.uid
                ? currentUser.photoURL
                : "") ||
            "assets/default-avatar.png";

        const caption = safeText(
            short.caption || short.description || short.text || short.title,
            ""
        );

        const media = getMediaURL(short);
        const thumbnail = getThumbnail(short);
        const verified =
            short.verified === true || creator?.verified === true;

        const likes = safeNumber(short.likes || short.likeCount);
        const comments = safeNumber(short.comments || short.commentCount);
        const shares = safeNumber(short.shares || short.shareCount);
        const views = safeNumber(short.views || short.viewCount);

        const musicLabel = getMusicLabel(short, username);
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
                            ${thumbnail ? `poster="${escapeHTML(thumbnail)}"` : ""}
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

            <div class="playOverlay">
                <i class="fa-solid fa-play"></i>
            </div>

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
                            onerror="this.src='assets/default-avatar.png'"
                        >
                        <span class="shortUsername">
                            ${escapeHTML(displayName)}
                            ${verified ? '<i class="fa-solid fa-circle-check" style="color:#27cfff;font-size:11px;margin-left:4px"></i>' : ""}
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

                <div class="shortMusic">
                    <i class="fa-solid fa-music"></i>
                    <span>${escapeHTML(musicLabel)}</span>
                </div>
            </div>

            <div class="shortActions">
                <button type="button" class="shortAction likeBtn" data-action="like">
                    <i class="fa-regular fa-heart"></i>
                    <span>${formatCount(likes)}</span>
                </button>

                <button type="button" class="shortAction" data-action="comment">
                    <i class="fa-regular fa-comment"></i>
                    <span>${formatCount(comments)}</span>
                </button>

                <button type="button" class="shortAction" data-action="share">
                    <i class="fa-solid fa-share"></i>
                    <span>${formatCount(shares)}</span>
                </button>

                <button type="button" class="shortAction saveBtn" data-action="save">
                    <i class="fa-regular fa-bookmark"></i>
                    <span>Save</span>
                </button>

                <div class="musicDisc" aria-hidden="true">
                    <i class="fa-solid fa-music"></i>
                </div>
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

        // Tap to play/pause
        card.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-action]");
            if (btn) {
                e.stopPropagation();
                handleAction(btn.dataset.action, btn, card, short);
                return;
            }

            if (video) {
                if (video.paused) {
                    if (preferUnmuted) video.muted = false;
                    video.play().catch(() => {
                        video.muted = true;
                        video.play().catch(() => {});
                    });
                    playOverlay?.classList.remove("show");
                    syncVolumeIcon(card, video);
                } else {
                    video.pause();
                    playOverlay?.classList.add("show");
                }
            }
        });

        // Double-tap like
        let lastTap = 0;
        card.addEventListener("touchend", (e) => {
            const now = Date.now();
            if (now - lastTap < 280) {
                e.preventDefault();
                doLike(card, short, true);
                showHeart();
            }
            lastTap = now;
        });

        if (video) {
            video.addEventListener("timeupdate", () => {
                if (!progressBar || !video.duration) return;
                progressBar.style.width =
                    (video.currentTime / video.duration) * 100 + "%";
            });

            video.addEventListener("play", () => {
                playOverlay?.classList.remove("show");
            });

            video.addEventListener("pause", () => {
                // only show if still visible
            });
        }
    }

    function showHeart() {
        if (!heartAnim) return;
        heartAnim.classList.remove("heartPlay");
        void heartAnim.offsetWidth;
        heartAnim.classList.add("heartPlay");
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
                // Toggle YouTube-style views / likes / time
                toggleCaptionMeta(card);
                break;
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
            await db.ref("shorts/" + id).update({
                deleted: true,
                deletedAt: firebase.database.ServerValue.TIMESTAMP
            });

            if (menuCard) {
                menuCard.remove();
            }

            showToast("Short deleted");
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
        if (!id) return;
        closeMoreMenu();
        window.location.href =
            "upload.html?edit=" + encodeURIComponent(id);
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
            window.alert(msg);
        } catch (_) {
            showToast(msg);
        }
    }

    async function doLike(card, short, fromDoubleTap) {
        if (!currentUser) {
            showToast("Login required to like");
            return;
        }

        const id = String(short.id || short.shortId || short.key || "");
        if (!id) return;

        // Prevent concurrent toggles (race → count jumps 3,4,5…)
        const lockKey = id + ":" + currentUser.uid;
        if (likeInFlight.has(lockKey)) {
            return;
        }

        // Spam detection
        const taps = trackLikeSpam(id);
        if (taps >= LIKE_SPAM_LIMIT) {
            showLikeSpamWarning();
            // still allow one settle but block this spam burst
            return;
        }

        const likeBtn = card.querySelector(".likeBtn");
        const icon = likeBtn?.querySelector("i");
        const label = likeBtn?.querySelector("span");

        likeInFlight.add(lockKey);
        if (likeBtn) likeBtn.style.pointerEvents = "none";

        const primaryRef = db.ref(
            "shortLikes/" + id + "/" + currentUser.uid
        );

        try {
            // Atomic membership toggle
            let wasLiked = false;
            await primaryRef.transaction((cur) => {
                if (cur === null) {
                    wasLiked = false;
                    return {
                        uid: currentUser.uid,
                        at: Date.now()
                    };
                }
                wasLiked = true;
                if (fromDoubleTap) {
                    // keep liked
                    return cur;
                }
                return null; // unlike
            });

            // After transaction, read definitive state
            const afterSnap = await primaryRef.once("value");
            const isLiked = afterSnap.exists();

            // Double-tap on already-liked: no count change
            if (fromDoubleTap && wasLiked && isLiked) {
                showHeart();
                return;
            }

            // Atomic count update based on final state vs previous
            // delta: +1 if newly liked, -1 if unliked, 0 otherwise
            let delta = 0;
            if (isLiked && !wasLiked) delta = 1;
            if (!isLiked && wasLiked) delta = -1;

            let finalCount = safeNumber(
                card.__likes ?? short.likes ?? short.likeCount
            );

            if (delta !== 0) {
                const countRef = db.ref("shorts/" + id + "/likes");
                const tx = await countRef.transaction((cur) => {
                    const n = safeNumber(cur);
                    return Math.max(0, n + delta);
                });
                if (tx.committed && tx.snapshot) {
                    finalCount = safeNumber(tx.snapshot.val());
                } else {
                    finalCount = Math.max(0, finalCount + delta);
                }

                // keep likeCount in sync
                try {
                    await db.ref("shorts/" + id + "/likeCount").set(finalCount);
                } catch (_) {}
            }

            // Mirrors (non-critical)
            try {
                if (isLiked) {
                    const payload = {
                        uid: currentUser.uid,
                        at: Date.now()
                    };
                    await Promise.all([
                        db
                            .ref("shorts/" + id + "/likedBy/" + currentUser.uid)
                            .set(payload)
                            .catch(() => {}),
                        db
                            .ref("likes/" + id + "/" + currentUser.uid)
                            .set(payload)
                            .catch(() => {})
                    ]);
                } else {
                    await Promise.all([
                        db
                            .ref("shorts/" + id + "/likedBy/" + currentUser.uid)
                            .remove()
                            .catch(() => {}),
                        db
                            .ref("likes/" + id + "/" + currentUser.uid)
                            .remove()
                            .catch(() => {})
                    ]);
                }
            } catch (_) {}

            // UI
            card.__likes = finalCount;
            short.likes = finalCount;
            short.likeCount = finalCount;
            if (label) label.textContent = formatCount(finalCount);

            if (isLiked) {
                likeBtn?.classList.add("liked");
                if (icon) icon.className = "fa-solid fa-heart";
                if (fromDoubleTap) showHeart();
            } else {
                likeBtn?.classList.remove("liked");
                if (icon) icon.className = "fa-regular fa-heart";
            }

            // Notify only on first like in this toggle
            const ownerId = getCreatorId(short);
            if (delta === 1 && ownerId && ownerId !== currentUser.uid) {
                try {
                    await db.ref("notifications/" + ownerId).push({
                        type: "like",
                        contentType: "short",
                        contentId: id,
                        senderUID: currentUser.uid,
                        createdAt: firebase.database.ServerValue.TIMESTAMP,
                        read: false
                    });
                } catch (_) {}
            }
        } catch (err) {
            console.error("Like failed:", err);
            showToast("Like failed");
        } finally {
            likeInFlight.delete(lockKey);
            if (likeBtn) likeBtn.style.pointerEvents = "";
        }
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

    function openComments(short) {
        activeShort = short;
        commentsModal?.classList.remove("hidden");
        commentsModal?.setAttribute("aria-hidden", "false");
        document.body.classList.add("modalOpen");

        if (commentUserAvatar && currentUser?.photoURL) {
            commentUserAvatar.src = currentUser.photoURL;
        }

        loadComments(String(short.id || short.shortId || short.key));
    }

    function closeCommentsModal() {
        commentsModal?.classList.add("hidden");
        commentsModal?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modalOpen");
        activeShort = null;
    }

    async function loadComments(id) {
        if (!commentsContainer || !id) return;

        commentsContainer.innerHTML = `
            <div class="commentsLoading">
                <div class="loadingSpinner"></div>
                <span>Loading comments...</span>
            </div>
        `;

        try {
            // Support both legacy paths
            const [snapA, snapB] = await Promise.all([
                db.ref("comments/" + id).once("value"),
                db.ref("shorts/" + id + "/comments").once("value")
            ]);

            const merged = {};
            const a = snapA.val() || {};
            const b = snapB.val() || {};
            Object.keys(a).forEach((k) => {
                merged[k] = a[k];
            });
            Object.keys(b).forEach((k) => {
                if (!merged[k]) merged[k] = b[k];
            });

            const list = Object.entries(merged)
                .map(([key, data]) => ({ id: key, ...(data || {}) }))
                .sort(
                    (a, b) =>
                        safeNumber(a.createdAt || a.timestamp) -
                        safeNumber(b.createdAt || b.timestamp)
                );

            if (!list.length) {
                commentsContainer.innerHTML = `
                    <div class="noComments">
                        <i class="fa-regular fa-comment"></i>
                        <strong>No comments yet</strong>
                        <span>Be the first to comment.</span>
                    </div>
                `;
                if (commentCountText) {
                    commentCountText.textContent = "0 comments";
                }
                return;
            }

            if (commentCountText) {
                commentCountText.textContent =
                    list.length +
                    (list.length === 1 ? " comment" : " comments");
            }

            commentsContainer.innerHTML = "";

            for (const c of list) {
                const user = await getUser(c.uid || c.userId);
                const name = safeText(
                    c.name ||
                        c.username ||
                        user?.name ||
                        user?.username,
                    "User"
                );
                const avatar =
                    c.profilePhoto ||
                    c.photoURL ||
                    user?.profilePhoto ||
                    user?.photoURL ||
                    "assets/default-avatar.png";
                const text = safeText(c.text || c.comment || c.message, "");
                const when = timeAgo(c.createdAt || c.timestamp);

                const row = document.createElement("div");
                row.className = "commentItem";
                row.innerHTML = `
                    <img src="${escapeHTML(avatar)}" alt="" onerror="this.src='assets/default-avatar.png'">
                    <div>
                        <strong>${escapeHTML(name)}</strong>
                        <p>${escapeHTML(text)}</p>
                        <small>${escapeHTML(when)}</small>
                    </div>
                `;
                commentsContainer.appendChild(row);
            }

            // scroll to bottom
            commentsContainer.scrollTop = commentsContainer.scrollHeight;
        } catch (err) {
            console.error("Comments failed:", err);
            commentsContainer.innerHTML = `
                <div class="noComments">
                    <span>Comments unavailable.</span>
                </div>
            `;
        }
    }

    async function submitComment() {
        if (!currentUser) {
            showToast("Login required to comment");
            return;
        }
        if (!activeShort) return;

        const text = (commentText?.value || "").trim();
        if (!text) return;

        const id = String(
            activeShort.id || activeShort.shortId || activeShort.key || ""
        );
        if (!id) return;

        if (sendComment) sendComment.disabled = true;

        try {
            const me = await getUser(currentUser.uid);
            const name =
                me?.name ||
                currentUser.displayName ||
                me?.username ||
                "Viewora User";
            const username = me?.username || "";
            const profilePhoto =
                me?.profilePhoto ||
                currentUser.photoURL ||
                "assets/default-avatar.png";

            const payload = {
                uid: currentUser.uid,
                userId: currentUser.uid,
                text,
                name,
                username,
                profilePhoto,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                timestamp: Date.now()
            };

            // Write to BOTH paths for compatibility with comments.js + admin
            const pushRef = db.ref("comments/" + id).push();
            await pushRef.set(payload);
            try {
                await db.ref("shorts/" + id + "/comments/" + pushRef.key).set(payload);
            } catch (_) {}

            // Bump comment count on short
            try {
                const shortRef = db.ref("shorts/" + id);
                const snap = await shortRef.once("value");
                const cur = snap.val() || {};
                const next =
                    safeNumber(cur.comments || cur.commentCount) + 1;
                await shortRef.update({
                    comments: next,
                    commentCount: next
                });
                activeShort.comments = next;
                activeShort.commentCount = next;

                // Update visible count on card
                const card = container?.querySelector(
                    `[data-short-id="${CSS.escape(id)}"]`
                );
                const commentLabel = card?.querySelector(
                    '[data-action="comment"] span'
                );
                if (commentLabel) {
                    commentLabel.textContent = formatCount(next);
                }
            } catch (_) {}

            // Notify owner
            const ownerId = getCreatorId(activeShort);
            if (ownerId && ownerId !== currentUser.uid) {
                try {
                    await db.ref("notifications/" + ownerId).push({
                        type: "comment",
                        contentType: "short",
                        contentId: id,
                        text: text.slice(0, 120),
                        senderUID: currentUser.uid,
                        createdAt: firebase.database.ServerValue.TIMESTAMP,
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
                err?.code === "PERMISSION_DENIED"
                    ? "Permission denied for comments"
                    : "Comment failed"
            );
        } finally {
            if (sendComment) sendComment.disabled = false;
        }
    }

    function openShare(short) {
        activeShort = short;
        shareModal?.classList.remove("hidden");
        shareModal?.setAttribute("aria-hidden", "false");
        document.body.classList.add("modalOpen");
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
            closeShareModal();
        } catch (err) {
            if (err?.name !== "AbortError") {
                showToast("Share failed");
            }
        }
    }


    /* =====================================================
       LOAD SHORTS
    ===================================================== */

    async function loadShorts() {
        if (!container) return;

        try {
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
                        s.hidden !== true
                )
                .sort(
                    (a, b) =>
                        safeNumber(b.createdAt) - safeNumber(a.createdAt)
                );

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

                            // Respect user unmute preference across shorts
                            video.muted = !preferUnmuted;
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
            try {
                await db.ref("shorts/" + id).update({
                    commentsDisabled: true
                });
                showToast("Comments turned off");
            } catch (e) {
                showToast("Failed");
            }
            closeMoreMenu();
        });

        $("hideLikeCountBtn")?.addEventListener("click", async () => {
            const id = getActiveShortId();
            if (!id || !currentUser) return;
            try {
                await db.ref("shorts/" + id).update({
                    hideLikeCount: true
                });
                showToast("Like count hidden");
            } catch (e) {
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
