"use strict";

/* ============================================================
   VIEWORA • PREMIUM NOTIFICATIONS
   Firebase Realtime Database
   ============================================================ */

(() => {

    if (window.__VIEWORA_NOTIFICATIONS_V2__) {
        console.warn("Viewora Notifications already running.");
        return;
    }

    window.__VIEWORA_NOTIFICATIONS_V2__ = true;


    /* ============================================================
       ELEMENTS
       ============================================================ */

    const $ = id => document.getElementById(id);

    const list = $("notificationList");
    const loading = $("loadingState");
    const empty = $("emptyState");

    const backBtn = $("backBtn");
    const markAllBtn = $("markAllBtn");
    const loadMoreBtn = $("loadMoreBtn");

    const subtitle = $("notificationSubtitle");

    const sheet = $("notificationSheet");
    const sheetBackdrop = $("sheetBackdrop");
    const closeSheetBtn = $("closeSheetBtn");
    const sheetTitle = $("sheetTitle");
    const sheetContent = $("sheetContent");
    const sheetOpenBtn = $("sheetOpenBtn");
    const sheetDeleteBtn = $("sheetDeleteBtn");

    const toast = $("toast");


    /* ============================================================
       STATE
       ============================================================ */

    let currentUser = null;
    let allNotifications = [];

    let currentFilter = "all";
    let currentSheetNotification = null;

    let databaseListener = null;
    let toastTimer = null;

    let busy = false;

    const userCache = new Map();
    const mediaCache = new Map();


    /* ============================================================
       FIREBASE CHECK
       ============================================================ */

    function firebaseReady() {

        return (
            typeof firebase !== "undefined" &&
            firebase.apps &&
            firebase.apps.length > 0 &&
            typeof auth !== "undefined" &&
            typeof db !== "undefined"
        );

    }


    /* ============================================================
       SAFE HELPERS
       ============================================================ */

    function safeString(value, fallback = "") {

        if (
            value === null ||
            value === undefined
        ) {
            return fallback;
        }

        return String(value);

    }


    function safeNumber(value) {

        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : 0;

    }


    function escapeHTML(value) {

        return safeString(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function normalizeURL(url) {

        if (!url) {
            return "";
        }

        return safeString(url).trim();

    }


    function formatNumber(value) {

        const n = safeNumber(value);

        if (n >= 1000000) {
            return (
                (n / 1000000)
                    .toFixed(n >= 10000000 ? 0 : 1)
                    .replace(".0", "") +
                "M"
            );
        }

        if (n >= 1000) {
            return (
                (n / 1000)
                    .toFixed(n >= 10000 ? 0 : 1)
                    .replace(".0", "") +
                "K"
            );
        }

        return String(n);
    }


    /* ============================================================
       TIME
       ============================================================ */

    function getTimestamp(data) {

        return safeNumber(
            data?.createdAt ??
            data?.timestamp ??
            data?.time ??
            data?.date ??
            data?.created ??
            0
        );

    }


    function formatTime(timestamp) {

        const value = safeNumber(timestamp);

        if (!value) {
            return "Just now";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Just now";
        }

        const difference =
            Math.max(
                0,
                Date.now() - date.getTime()
            );

        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (difference < minute) {
            return "Just now";
        }

        if (difference < hour) {
            return Math.floor(
                difference / minute
            ) + "m";
        }

        if (difference < day) {
            return Math.floor(
                difference / hour
            ) + "h";
        }

        if (difference < 7 * day) {
            return Math.floor(
                difference / day
            ) + "d";
        }

        return date.toLocaleDateString(
            undefined,
            {
                day: "numeric",
                month: "short"
            }
        );

    }


    /* ============================================================
       AUTH
       ============================================================ */

    function waitForAuth() {

        if (!firebaseReady()) {
            return Promise.resolve(null);
        }

        if (auth.currentUser) {
            return Promise.resolve(
                auth.currentUser
            );
        }

        return new Promise(resolve => {

            let finished = false;

            const unsubscribe =
                auth.onAuthStateChanged(user => {

                    if (finished) {
                        return;
                    }

                    finished = true;

                    try {
                        unsubscribe();
                    } catch (_) {}

                    resolve(user || null);

                });

            setTimeout(() => {

                if (finished) {
                    return;
                }

                finished = true;

                try {
                    unsubscribe();
                } catch (_) {}

                resolve(
                    auth.currentUser || null
                );

            }, 7000);

        });

    }


    /* ============================================================
       TOAST
       ============================================================ */

    function showToast(message) {

        if (!toast) {
            return;
        }

        clearTimeout(toastTimer);

        toast.textContent =
            safeString(message);

        toast.classList.add("show");

        toastTimer =
            setTimeout(() => {

                toast.classList.remove("show");

            }, 2500);

    }


    /* ============================================================
       USER DATA
       ============================================================ */

    async function getUser(uid) {

        uid = safeString(uid).trim();

        if (!uid) {
            return {};
        }

        if (userCache.has(uid)) {
            return userCache.get(uid);
        }

        try {

            const snapshot =
                await db
                    .ref("users/" + uid)
                    .once("value");

            const data =
                snapshot.exists()
                    ? snapshot.val() || {}
                    : {};

            userCache.set(
                uid,
                data
            );

            return data;

        } catch (error) {

            console.warn(
                "User read failed:",
                error
            );

            return {};

        }

    }


    /* ============================================================
       USER NAME
       ============================================================ */

    function getUserName(user) {

        return (
            user?.displayName ||
            user?.name ||
            user?.fullName ||
            user?.username ||
            user?.userName ||
            "Viewora User"
        );

    }


    /* ============================================================
       PROFILE PHOTO
       ============================================================ */

    function getProfilePhoto(user) {

        return normalizeURL(
            user?.profilePhoto ||
            user?.profilePicture ||
            user?.photoURL ||
            user?.avatar ||
            user?.avatarUrl ||
            user?.image ||
            user?.photo ||
            ""
        );

    }


    function avatarHTML(user) {

        const photo =
            getProfilePhoto(user);

        const name =
            getUserName(user);

        const letter =
            escapeHTML(
                name
                    .trim()
                    .charAt(0)
                    .toUpperCase() || "V"
            );

        if (photo) {

            return `
                <img
                    class="notificationAvatar"
                    src="${escapeHTML(photo)}"
                    alt=""
                    loading="lazy"
                    onerror="
                        this.style.display='none';
                        this.nextElementSibling.style.display='flex';
                    "
                >

                <span
                    class="avatarFallback"
                    style="display:none"
                >
                    ${letter}
                </span>
            `;

        }

        return `
            <span class="avatarFallback">
                ${letter}
            </span>
        `;

    }


    /* ============================================================
       NORMALIZE NOTIFICATION
       ============================================================ */

    function normalizeNotification(id, data) {

        if (
            !data ||
            typeof data !== "object"
        ) {
            return null;
        }

        const senderUID =
            data.senderUID ||
            data.senderUid ||
            data.senderId ||
            data.fromUID ||
            data.fromUid ||
            data.fromId ||
            data.actorUID ||
            data.actorUid ||
            data.actorId ||
            data.uid ||
            data.userId ||
            "";

        let type =
            data.type ||
            data.notificationType ||
            data.action ||
            "notification";

        type =
            safeString(type)
                .toLowerCase()
                .replace(/\s+/g, "_");

        return {

            id: safeString(id),

            ...data,

            senderUID:
                safeString(senderUID),

            type,

            createdAt:
                getTimestamp(data),

            read:
                data.read === true ||
                data.isRead === true ||
                data.seen === true

        };

    }


    /* ============================================================
       TYPE HELPERS
       ============================================================ */

    function isLike(notification) {

        const type =
            safeString(
                notification?.type
            ).toLowerCase();

        return (
            type === "like" ||
            type === "liked" ||
            type === "post_like" ||
            type === "short_like" ||
            type === "video_like" ||
            type === "story_like" ||
            type.includes("like")
        );

    }


    function isComment(notification) {

        const type =
            safeString(
                notification?.type
            ).toLowerCase();

        return (
            type.includes("comment") ||
            type.includes("reply")
        );

    }


    function isFollow(notification) {

        const type =
            safeString(
                notification?.type
            ).toLowerCase();

        return type.includes("follow");

    }


    function isMessage(notification) {

        const type =
            safeString(
                notification?.type
            ).toLowerCase();

        return (
            type === "dm" ||
            type.includes("message")
        );

    }


    /* ============================================================
       NOTIFICATION MESSAGE
       ============================================================ */

    function getMessage(notification, user) {

        const name =
            getUserName(user);

        const custom =
            notification.message ||
            notification.text ||
            notification.body ||
            "";

        if (custom) {

            return {
                name,
                message: custom
            };

        }

        if (isLike(notification)) {

            return {
                name,
                message:
                    "liked your post."
            };

        }

        if (isComment(notification)) {

            if (
                safeString(
                    notification.type
                ).includes("reply")
            ) {

                return {
                    name,
                    message:
                        "replied to your comment."
                };

            }

            return {
                name,
                message:
                    "commented on your post."
            };

        }

        if (isFollow(notification)) {

            if (
                safeString(
                    notification.type
                ).includes("request")
            ) {

                return {
                    name,
                    message:
                        "sent you a follow request."
                };

            }

            return {
                name,
                message:
                    "started following you."
            };

        }

        if (
            safeString(
                notification.type
            ).includes("mention")
        ) {

            return {
                name,
                message:
                    "mentioned you."
            };

        }

        if (
            safeString(
                notification.type
            ).includes("share")
        ) {

            return {
                name,
                message:
                    "shared your post."
            };

        }

        if (
            safeString(
                notification.type
            ).includes("save")
        ) {

            return {
                name,
                message:
                    "saved your post."
            };

        }

        if (
            safeString(
                notification.type
            ).includes("verification")
        ) {

            return {
                name: "Viewora",
                message:
                    custom ||
                    "Your account status was updated."
            };

        }

        return {
            name,
            message:
                custom ||
                "sent you a notification."
        };

    }


    /* ============================================================
       ICON
       ============================================================ */

    function getIcon(notification) {

        const type =
            safeString(
                notification?.type
            ).toLowerCase();

        if (type.includes("like")) {

            return {
                icon: "fa-heart",
                className: "heart"
            };

        }

        if (
            type.includes("comment") ||
            type.includes("reply")
        ) {

            return {
                icon: "fa-comment",
                className: "comment"
            };

        }

        if (type.includes("follow")) {

            return {
                icon: "fa-user-plus",
                className: "follow"
            };

        }

        if (type.includes("mention")) {

            return {
                icon: "fa-at",
                className: "mention"
            };

        }

        if (type.includes("share")) {

            return {
                icon: "fa-paper-plane",
                className: "share"
            };

        }

        if (type.includes("save")) {

            return {
                icon: "fa-bookmark",
                className: "save"
            };

        }

        if (
            type.includes("message") ||
            type === "dm"
        ) {

            return {
                icon: "fa-message",
                className: "message"
            };

        }

        return {
            icon: "fa-bell",
            className: "default"
        };

    }


    /* ============================================================
       MEDIA ID
       ============================================================ */

    function getMediaId(notification) {

        return safeString(
            notification.postId ||
            notification.postID ||
            notification.post_id ||
            notification.post ||
            notification.videoId ||
            notification.videoID ||
            notification.video_id ||
            notification.video ||
            notification.shortId ||
            notification.shortID ||
            notification.short_id ||
            notification.short ||
            notification.contentId ||
            notification.contentID ||
            ""
        );

    }


    /* ============================================================
       MEDIA TYPE
       ============================================================ */

    function getMediaType(notification) {

        const raw =
            safeString(
                notification.contentType ||
                notification.mediaType ||
                notification.postType ||
                notification.targetType ||
                notification.kind ||
                ""
            ).toLowerCase();

        if (
            raw.includes("short") ||
            raw.includes("reel")
        ) {
            return "shorts";
        }

        if (
            raw.includes("video")
        ) {
            return "videos";
        }

        if (
            raw.includes("story")
        ) {
            return "stories";
        }

        return "posts";

    }


    /* ============================================================
       MEDIA PATHS
       ============================================================ */

    function mediaPaths(notification) {

        const id =
            getMediaId(notification);

        if (!id) {
            return [];
        }

        const type =
            getMediaType(notification);

        const paths = [];

        if (type === "shorts") {

            paths.push(
                "shorts/" + id
            );

        }

        if (type === "videos") {

            paths.push(
                "videos/" + id
            );

        }

        if (type === "stories") {

            paths.push(
                "stories/" + id
            );

        }

        paths.push(
            "posts/" + id
        );

        paths.push(
            "shorts/" + id
        );

        paths.push(
            "videos/" + id
        );

        return [
            ...new Set(paths)
        ];

    }


    /* ============================================================
       GET MEDIA
       ============================================================ */

    async function getMedia(notification) {

        const id =
            getMediaId(notification);

        if (!id) {
            return null;
        }

        const cacheKey =
            getMediaType(notification) +
            ":" +
            id;

        if (mediaCache.has(cacheKey)) {
            return mediaCache.get(cacheKey);
        }

        try {

            const paths =
                mediaPaths(notification);

            for (
                const path of paths
            ) {

                const snapshot =
                    await db
                        .ref(path)
                        .once("value");

                if (
                    snapshot.exists()
                ) {

                    const media =
                        snapshot.val() || {};

                    const result = {
                        ...media,
                        _path: path
                    };

                    mediaCache.set(
                        cacheKey,
                        result
                    );

                    return result;

                }

            }

        } catch (error) {

            console.warn(
                "Media read failed:",
                error
            );

        }

        mediaCache.set(
            cacheKey,
            null
        );

        return null;

    }


    /* ============================================================
       MEDIA IMAGE
       ============================================================ */

    function getMediaImage(media, notification) {

        return normalizeURL(
            notification?.thumbnail ||
            notification?.thumbnailUrl ||
            notification?.image ||
            notification?.imageUrl ||
            notification?.mediaUrl ||
            notification?.cover ||
            media?.thumbnail ||
            media?.thumbnailUrl ||
            media?.cover ||
            media?.coverImage ||
            media?.coverUrl ||
            media?.image ||
            media?.imageUrl ||
            media?.photoURL ||
            media?.photo ||
            media?.mediaUrl ||
            media?.url ||
            media?.videoThumbnail ||
            ""
        );

    }


    /* ============================================================
       TARGET URL
       ============================================================ */

    function getTargetURL(notification) {

        const senderUID =
            safeString(
                notification?.senderUID
            );

        const mediaId =
            getMediaId(notification);

        const type =
            safeString(
                notification?.type
            ).toLowerCase();

        if (isMessage(notification)) {

            return senderUID
                ? "chat.html?uid=" +
                  encodeURIComponent(senderUID)
                : "chat.html";

        }

        if (mediaId) {

            const mediaType =
                getMediaType(notification);

            if (
                mediaType === "shorts" ||
                type.includes("short")
            ) {

                return (
                    "shorts.html?id=" +
                    encodeURIComponent(mediaId)
                );

            }

            if (
                mediaType === "stories" ||
                type.includes("story")
            ) {

                return (
                    "stories.html?storyId=" +
                    encodeURIComponent(mediaId)
                );

            }

            if (
                mediaType === "videos" ||
                type.includes("video") ||
                type.includes("long")
            ) {
                return (
                    "video.html?id=" +
                    encodeURIComponent(mediaId)
                );
            }

            return (
                "post.html?uid=" +
                encodeURIComponent(senderUID) +
                "&post=" +
                encodeURIComponent(mediaId)
            );

        }

        if (senderUID) {

            return (
                "profile.html?uid=" +
                encodeURIComponent(
                    senderUID
                )
            );

        }

        return "";

    }


    /* ============================================================
       FILTER
       ============================================================ */

    function matchesFilter(notification) {

        if (currentFilter === "all") {
            return true;
        }

        if (
            currentFilter === "likes"
        ) {
            return isLike(notification);
        }

        if (
            currentFilter === "comments"
        ) {
            return isComment(notification);
        }

        if (
            currentFilter === "follows"
        ) {
            return isFollow(notification);
        }

        return true;

    }


    function getFilteredNotifications() {

        return allNotifications.filter(
            matchesFilter
        );

    }


    /* ============================================================
       NOTIFICATION LISTENER
       ============================================================ */

    function startListener() {

        if (!currentUser) {
            showEmpty(
                "Login required",
                "Please login to see your notifications."
            );
            return;
        }

        const uid =
            currentUser.uid;

        const ref =
            db.ref(
                "notifications/" +
                uid
            );

        if (databaseListener) {

            try {
                ref.off(
                    "value",
                    databaseListener
                );
            } catch (_) {}

        }

        databaseListener =
            snapshot => {

                const value =
                    snapshot.exists()
                        ? snapshot.val() || {}
                        : {};

                allNotifications =
                    Object.entries(value)
                        .map(
                            ([id, data]) =>
                                normalizeNotification(
                                    id,
                                    data
                                )
                        )
                        .filter(Boolean)
                        .sort(
                            (a, b) =>
                                b.createdAt -
                                a.createdAt
                        );

                render();

            };

        ref.on(
            "value",
            databaseListener,
            error => {

                console.error(
                    "Notification listener:",
                    error
                );

                showEmpty(
                    "Unable to load notifications",
                    "Please try again."
                );

            }
        );

    }


    /* ============================================================
       RENDER
       ============================================================ */

    async function render() {

        hideLoading();

        if (!list) {
            return;
        }

        const notifications =
            getFilteredNotifications();

        if (!notifications.length) {

            showEmpty(
                currentFilter === "all"
                    ? "No notifications yet"
                    : "Nothing here yet",
                currentFilter === "all"
                    ? "When people interact with your posts, shorts or profile, you'll see it here."
                    : "No notifications match this filter."
            );

            updateHeader();

            return;

        }

        hideEmpty();

        list.innerHTML = "";

        const fragment =
            document.createDocumentFragment();

        for (
            let index = 0;
            index < notifications.length;
            index++
        ) {

            const notification =
                notifications[index];

            const user =
                await getUser(
                    notification.senderUID
                );

            const element =
                await createNotification(
                    notification,
                    user,
                    index
                );

            fragment.appendChild(
                element
            );

        }

        list.appendChild(
            fragment
        );

        updateHeader();

    }


    /* ============================================================
       CREATE NOTIFICATION
       ============================================================ */

    async function createNotification(
        notification,
        user,
        index
    ) {

        const item =
            document.createElement(
                "article"
            );

        item.className =
            "notificationItem";

        if (!notification.read) {
            item.classList.add(
                "unread"
            );
        }

        item.style.setProperty(
            "--notification-index",
            String(
                Math.min(index, 20)
            )
        );

        item.dataset.id =
            notification.id;

        const message =
            getMessage(
                notification,
                user
            );

        const icon =
            getIcon(notification);

        const target =
            getTargetURL(
                notification
            );

        const media =
            getMediaId(notification)
                ? await getMedia(
                    notification
                )
                : null;

        const mediaImage =
            getMediaImage(
                media,
                notification
            );

        const mediaType =
            getMediaType(
                notification
            );

        let mediaHTML = "";

        if (mediaImage) {

            mediaHTML = `
                <div class="notificationMedia">
                    <img
                        src="${escapeHTML(mediaImage)}"
                        alt=""
                        loading="lazy"
                        onerror="this.parentElement.style.display='none'"
                    >
                    ${
                        isLike(notification)
                        ? `
                            <span class="mediaLikeBadge">
                                <i class="fa-solid fa-heart"></i>
                            </span>
                        `
                        : ""
                    }
                </div>
            `;

        } else if (getMediaId(notification)) {

            mediaHTML = `
                <div class="notificationMedia notificationMediaFallback">
                    <i class="fa-solid ${
                        mediaType === "shorts"
                            ? "fa-play"
                            : "fa-image"
                    }"></i>

                    ${
                        isLike(notification)
                        ? `
                            <span class="mediaLikeBadge">
                                <i class="fa-solid fa-heart"></i>
                            </span>
                        `
                        : ""
                    }
                </div>
            `;

        }


        let actionHTML = "";

        if (isFollow(notification)) {

            actionHTML = `
                <button
                    type="button"
                    class="notificationFollowBtn"
                    data-follow-back="${escapeHTML(
                        notification.senderUID
                    )}"
                >
                    Follow back
                </button>
            `;

        } else if (target) {

            actionHTML = `
                <button
                    type="button"
                    class="notificationArrow"
                    aria-label="Open notification"
                >
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            `;

        }


        item.innerHTML = `

            <div class="notificationAvatarWrap">

                ${avatarHTML(user)}

                <span
                    class="notificationType ${escapeHTML(
                        icon.className
                    )}"
                >
                    <i class="fa-solid ${escapeHTML(
                        icon.icon
                    )}"></i>
                </span>

            </div>


            <div class="notificationContent">

                <div class="notificationText">

                    <strong>
                        ${escapeHTML(
                            message.name
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            message.message
                        )}
                    </span>

                </div>


                <div class="notificationMeta">

                    <span class="notificationTime">
                        ${escapeHTML(
                            formatTime(
                                notification.createdAt
                            )
                        )}
                    </span>

                    ${
                        !notification.read
                        ? `
                            <span class="unreadDot"></span>
                        `
                        : ""
                    }

                </div>

            </div>


            ${mediaHTML}

            ${actionHTML}

        `;


        /* ========================================================
           PROFILE CLICK (avatar / username)
           ======================================================== */

        const openProfile = (uid) => {
            if (!uid) return;
            window.location.href =
                "profile.html?uid=" + encodeURIComponent(uid);
        };

        item.querySelector(".notificationAvatarWrap")?.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();
                openProfile(notification.senderUID);
            }
        );

        item.querySelector(".notificationText strong")?.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();
                openProfile(notification.senderUID);
            }
        );

        /* ========================================================
           FOLLOW BACK
           ======================================================== */

        const followBtn =
            item.querySelector(
                "[data-follow-back]"
            );

        if (followBtn) {

            await updateFollowButton(
                followBtn,
                notification.senderUID
            );

            followBtn.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();

                    await followBack(
                        notification.senderUID,
                        followBtn
                    );

                }
            );

        }


        /* ========================================================
           OPEN NOTIFICATION
           ======================================================== */

        item.addEventListener(
            "click",
            async event => {

                if (
                    event.target.closest(
                        "button"
                    )
                ) {
                    return;
                }

                await markAsRead(
                    notification.id
                );

                openNotification(
                    notification,
                    target
                );

            }
        );


        item
            .querySelector(
                ".notificationArrow"
            )
            ?.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();

                    await markAsRead(
                        notification.id
                    );

                    openNotification(
                        notification,
                        target
                    );

                }
            );


        return item;

    }


    /* ============================================================
       OPEN
       ============================================================ */

    function openNotification(
        notification,
        target
    ) {

        if (!target) {

            openSheet(
                notification
            );

            return;

        }

        window.location.href =
            target;

    }


    /* ============================================================
       FOLLOW STATE
       ============================================================ */

    async function isFollowing(uid) {

        if (
            !currentUser ||
            !uid
        ) {
            return false;
        }

        try {

            let snapshot =
                await db
                    .ref(
                        "following/" +
                        currentUser.uid +
                        "/" +
                        uid
                    )
                    .once("value");

            // fallback legacy path
            if (!snapshot.exists()) {
                snapshot = await db
                    .ref(
                        "users/" +
                        currentUser.uid +
                        "/following/" +
                        uid
                    )
                    .once("value");
            }

            const value =
                snapshot.val();

            return (
                value === true ||
                value === 1 ||
                value === "true" ||
                (
                    value &&
                    typeof value === "object"
                )
            );

        } catch (error) {

            console.warn(
                "Follow state failed:",
                error
            );

            return false;

        }

    }


    /* ============================================================
       FOLLOW BUTTON UI
       ============================================================ */

    async function updateFollowButton(
        button,
        uid
    ) {

        if (
            !button ||
            !uid ||
            !currentUser
        ) {
            return;
        }

        const following =
            await isFollowing(uid);

        if (following) {

            button.textContent =
                "Following";

            button.classList.add(
                "following"
            );

        } else {

            button.textContent =
                "Follow back";

            button.classList.remove(
                "following"
            );

        }

    }


    /* ============================================================
       FOLLOW BACK
       ============================================================ */

    async function followBack(
        targetUID,
        button
    ) {

        if (
            !currentUser ||
            !targetUID ||
            targetUID === currentUser.uid ||
            busy
        ) {
            return;
        }

        busy = true;

        if (button) {

            button.disabled = true;
            button.classList.add(
                "loading"
            );

        }

        try {

            const myUID =
                currentUser.uid;

            const alreadyFollowing =
                await isFollowing(
                    targetUID
                );

            if (alreadyFollowing) {

                if (button) {

                    button.textContent =
                        "Following";

                    button.classList.add(
                        "following"
                    );

                }

                return;

            }


            /* ====================================================
               FOLLOWING
               ==================================================== */

            await Promise.all([
                db.ref("following/" + myUID + "/" + targetUID).set(true),
                db.ref("followers/" + targetUID + "/" + myUID).set(true),
                db.ref("users/" + myUID + "/following/" + targetUID).set(true),
                db.ref("users/" + targetUID + "/followers/" + myUID).set(true)
            ]);


            /* ====================================================
               FOLLOWING COUNT
               ==================================================== */

            await incrementSafeCount(
                "users/" +
                myUID +
                "/followingCount",
                1
            );


            /* ====================================================
               FOLLOWERS COUNT
               ==================================================== */

            await incrementSafeCount(
                "users/" +
                targetUID +
                "/followersCount",
                1
            );


            if (button) {

                button.textContent =
                    "Following";

                button.classList.remove(
                    "loading"
                );

                button.classList.add(
                    "following"
                );

            }

            showToast(
                "Following"
            );


            /* ====================================================
               OPTIONAL FOLLOW-BACK NOTIFICATION
               ==================================================== */

            try {

                const notificationRef =
                    db
                        .ref(
                            "notifications/" +
                            targetUID
                        )
                        .push();

                await notificationRef.set({

                    type: "follow",

                    senderUID: myUID,

                    recipientUID:
                        targetUID,

                    message:
                        "started following you.",

                    createdAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP,

                    read: false

                });

            } catch (_) {}

        } catch (error) {

            console.error(
                "Follow back failed:",
                error
            );

            showToast(
                "Unable to follow. Try again."
            );

            if (button) {

                button.classList.remove(
                    "following"
                );

                button.textContent =
                    "Follow back";

            }

        } finally {

            busy = false;

            if (button) {
                button.disabled = false;
                button.classList.remove(
                    "loading"
                );
            }

        }

    }


    /* ============================================================
       SAFE COUNT
       ============================================================ */

    function incrementSafeCount(
        path,
        amount
    ) {

        return new Promise(
            (resolve, reject) => {

                db
                    .ref(path)
                    .transaction(
                        current => {

                            const number =
                                safeNumber(
                                    current
                                );

                            return Math.max(
                                0,
                                number + amount
                            );

                        },
                        (error, committed) => {

                            if (error) {
                                reject(error);
                                return;
                            }

                            resolve(
                                committed
                            );

                        }
                    );

            }
        );

    }


    /* ============================================================
       MARK ONE READ
       ============================================================ */

    async function markAsRead(
        notificationId
    ) {

        if (
            !currentUser ||
            !notificationId
        ) {
            return false;
        }

        try {

            await db
                .ref(
                    "notifications/" +
                    currentUser.uid +
                    "/" +
                    notificationId
                )
                .update({

                    read: true,

                    isRead: true,

                    seen: true,

                    readAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                });

            return true;

        } catch (error) {

            console.warn(
                "Mark read failed:",
                error
            );

            return false;

        }

    }


    /* ============================================================
       MARK ALL (quiet — no toast, for page visit)
       ============================================================ */

    async function markAllReadQuiet() {
        if (!currentUser || !allNotifications.length) return;

        const unread = allNotifications.filter((item) => !item.read);
        if (!unread.length) return;

        try {
            const updates = {};
            unread.forEach((notification) => {
                const base = notification.id;
                updates[base + "/read"] = true;
                updates[base + "/isRead"] = true;
                updates[base + "/seen"] = true;
                updates[base + "/readAt"] =
                    firebase.database.ServerValue.TIMESTAMP;
            });
            await db.ref("notifications/" + currentUser.uid).update(updates);
        } catch (error) {
            console.warn("Quiet mark-all failed:", error);
        }
    }

    /* ============================================================
       MARK ALL
       ============================================================ */

    async function markAllRead() {

        if (
            !currentUser ||
            busy
        ) {
            return;
        }

        const unread =
            allNotifications.filter(
                item =>
                    !item.read
            );

        if (!unread.length) {

            showToast(
                "All notifications are already read."
            );

            return;

        }

        busy = true;

        if (markAllBtn) {
            markAllBtn.disabled = true;
        }

        try {

            const updates = {};

            unread.forEach(
                notification => {

                    const base =
                        notification.id;

                    updates[
                        base + "/read"
                    ] = true;

                    updates[
                        base + "/isRead"
                    ] = true;

                    updates[
                        base + "/seen"
                    ] = true;

                    updates[
                        base + "/readAt"
                    ] =
                        firebase.database
                            .ServerValue
                            .TIMESTAMP;

                }
            );

            await db
                .ref(
                    "notifications/" +
                    currentUser.uid
                )
                .update(updates);

            showToast(
                "All notifications marked as read."
            );

        } catch (error) {

            console.error(
                "Mark all failed:",
                error
            );

            showToast(
                "Unable to mark notifications."
            );

        } finally {

            busy = false;

            if (markAllBtn) {
                markAllBtn.disabled = false;
            }

        }

    }


    /* ============================================================
       DELETE ONE
       ============================================================ */

    async function deleteNotification(
        notificationId
    ) {

        if (
            !currentUser ||
            !notificationId
        ) {
            return;
        }

        try {

            await db
                .ref(
                    "notifications/" +
                    currentUser.uid +
                    "/" +
                    notificationId
                )
                .remove();

            showToast(
                "Notification removed."
            );

        } catch (error) {

            console.error(
                "Delete notification failed:",
                error
            );

            showToast(
                "Unable to remove notification."
            );

        }

    }


    /* ============================================================
       SHEET
       ============================================================ */

    function openSheet(
        notification
    ) {

        if (!sheet) {
            return;
        }

        currentSheetNotification =
            notification;

        const user =
            userCache.get(
                notification.senderUID
            ) || {};

        const message =
            getMessage(
                notification,
                user
            );

        if (sheetTitle) {

            sheetTitle.textContent =
                message.name;

        }

        if (sheetContent) {

            sheetContent.innerHTML = `

                <div class="sheetNotificationPreview">

                    <div class="sheetAvatar">
                        ${avatarHTML(user)}
                    </div>

                    <div class="sheetPreviewText">

                        <strong>
                            ${escapeHTML(
                                message.name
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                message.message
                            )}
                        </span>

                        <small>
                            ${escapeHTML(
                                formatTime(
                                    notification.createdAt
                                )
                            )}
                        </small>

                    </div>

                </div>

            `;

        }

        sheet.classList.add(
            "active"
        );

        sheet.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "sheet-open"
        );

    }


    function closeSheet() {

        if (!sheet) {
            return;
        }

        sheet.classList.remove(
            "active"
        );

        sheet.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "sheet-open"
        );

        currentSheetNotification =
            null;

    }


    /* ============================================================
       SHEET EVENTS
       ============================================================ */

    closeSheetBtn?.addEventListener(
        "click",
        closeSheet
    );

    sheetBackdrop?.addEventListener(
        "click",
        closeSheet
    );


    sheetOpenBtn?.addEventListener(
        "click",
        async () => {

            if (
                !currentSheetNotification
            ) {
                return;
            }

            const notification =
                currentSheetNotification;

            await markAsRead(
                notification.id
            );

            const target =
                getTargetURL(
                    notification
                );

            closeSheet();

            if (target) {
                window.location.href =
                    target;
            }

        }
    );


    sheetDeleteBtn?.addEventListener(
        "click",
        async () => {

            if (
                !currentSheetNotification
            ) {
                return;
            }

            const id =
                currentSheetNotification.id;

            closeSheet();

            await deleteNotification(
                id
            );

        }
    );


    /* ============================================================
       FILTER TABS
       ============================================================ */

    document
        .querySelectorAll(
            ".notification-tab"
        )
        .forEach(tab => {

            tab.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".notification-tab"
                        )
                        .forEach(
                            button =>
                                button.classList.remove(
                                    "active"
                                )
                        );

                    tab.classList.add(
                        "active"
                    );

                    currentFilter =
                        safeString(
                            tab.dataset.filter
                        ).toLowerCase() ||
                        "all";

                    render();

                }
            );

        });


    /* ============================================================
       HEADER
       ============================================================ */

    function updateHeader() {

        const unread =
            allNotifications.filter(
                item =>
                    !item.read
            ).length;

        if (subtitle) {

            subtitle.textContent =
                unread > 0
                    ? unread +
                      (
                        unread === 1
                            ? " new notification"
                            : " new notifications"
                      )
                    : "Stay updated";

        }

        if (markAllBtn) {

            markAllBtn.disabled =
                unread === 0;

            markAllBtn.classList.toggle(
                "disabled",
                unread === 0
            );

        }

    }


    /* ============================================================
       EMPTY
       ============================================================ */

    function hideLoading() {

        if (loading) {

            loading.style.display =
                "none";

        }

    }


    function hideEmpty() {

        if (!empty) {
            return;
        }

        empty.style.display =
            "none";

        empty.hidden = true;

    }


    function showEmpty(
        title,
        description
    ) {

        hideLoading();

        if (list) {
            list.innerHTML = "";
        }

        if (!empty) {
            return;
        }

        const titleElement =
            empty.querySelector(
                ".emptyTitle"
            ) ||
            empty.querySelector(
                "h2"
            );

        const descriptionElement =
            empty.querySelector(
                ".emptyDescription"
            ) ||
            empty.querySelector(
                "p"
            );

        if (titleElement) {

            titleElement.textContent =
                title;

        }

        if (descriptionElement) {

            descriptionElement.textContent =
                description;

        }

        empty.hidden = false;

        empty.style.display =
            "flex";

    }


    /* ============================================================
       LOAD MORE
       ============================================================ */

    loadMoreBtn?.addEventListener(
        "click",
        () => {

            showToast(
                "You're viewing all available notifications."
            );

        }
    );


    /* ============================================================
       MARK ALL BUTTON
       ============================================================ */

    markAllBtn?.addEventListener("click", () => {
        markAllRead();
    });

    /* ============================================================
       BACK
       ============================================================ */

    backBtn?.addEventListener(
        "click",
        () => {

            if (
                window.history.length > 1
            ) {

                window.history.back();

            } else {

                window.location.href =
                    "index.html";

            }

        }
    );


    /* ============================================================
       KEYBOARD
       ============================================================ */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeSheet();

            }

        }
    );


    /* ============================================================
       VISIBILITY
       ============================================================ */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                !document.hidden &&
                currentUser
            ) {

                updateHeader();

            }

        }
    );


    /* ============================================================
       CLEANUP
       ============================================================ */

    window.addEventListener(
        "beforeunload",
        () => {

            if (
                currentUser &&
                databaseListener &&
                firebaseReady()
            ) {

                try {

                    db
                        .ref(
                            "notifications/" +
                            currentUser.uid
                        )
                        .off(
                            "value",
                            databaseListener
                        );

                } catch (_) {}

            }

        }
    );


    /* ============================================================
       INIT
       ============================================================ */

    async function init() {

        try {

            if (!firebaseReady()) {

                showEmpty(
                    "Firebase unavailable",
                    "Firebase is not configured correctly."
                );

                return;

            }

            currentUser =
                await waitForAuth();

            if (!currentUser) {

                showEmpty(
                    "Login required",
                    "Please login to see your notifications."
                );

                return;

            }

            startListener();

            // Visit activity → clear badge / mark all read after short delay
            setTimeout(() => {
                markAllReadQuiet();
            }, 1200);

        } catch (error) {

            console.error(
                "Viewora Notifications init failed:",
                error
            );

            showEmpty(
                "Something went wrong",
                "Unable to initialize notifications."
            );

        }

    }


    init();

})();