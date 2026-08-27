"use strict";

/*
============================================================
 VIEWORA V12
 PROFILE.JS
 FINAL • CLEAN PREMIUM PROFILE
============================================================

 COMPATIBLE WITH:
 • firebase.js provided by Viewora
 • Firebase Realtime Database
 • Cloudinary uploads
 • profile.html

 FEATURES
 -----------------------------------------------------------
 • Own / other profile detection
 • Real followers count
 • Real following count
 • Follow / Unfollow
 • Message
 • Edit profile
 • Profile sharing
 • Stories
 • Story viewer
 • Posts
 • Shorts
 • Videos
 • Saved posts
 • Archive
 • Delete own content
 • NaN-safe counters
 • Loading timeout protection
 • Missing Firebase data protection
 • No duplicate initialization
============================================================
*/

(() => {

    /* =====================================================
       PREVENT DOUBLE INITIALIZATION
    ===================================================== */

    if (window.__VIEWORA_PROFILE_INITIALIZED__) {
        console.warn("VIEWORA Profile already initialized.");
        return;
    }

    window.__VIEWORA_PROFILE_INITIALIZED__ = true;


    /* =====================================================
       STATE
    ===================================================== */

    let currentUser = null;
    let profileUser = null;

    let profileUID = null;

    let isOwnProfile = false;
    let isFollowing = false;

    let currentTab = "posts";

    let profileData = null;

    let storyInput = null;

    let busyFollow = false;
    let busyStory = false;

    let profileLoadFinished = false;


    /* =====================================================
       DEFAULT ASSETS
    ===================================================== */

    const DEFAULT_AVATAR =
        "assets/default-avatar.png";

    const DEFAULT_BANNER =
        "assets/default-banner.jpg";


    /* =====================================================
       SAFE NUMBER
    ===================================================== */

    function safeNumber(value) {

        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : 0;

    }


    /* =====================================================
       FORMAT NUMBER
    ===================================================== */

    function formatNumber(value) {

        const number = safeNumber(value);

        if (number < 1000) {
            return String(number);
        }

        if (number < 1000000) {

            return (
                (number / 1000)
                    .toFixed(number >= 10000 ? 0 : 1)
                    .replace(".0", "") +
                "K"
            );

        }

        if (number < 1000000000) {

            return (
                (number / 1000000)
                    .toFixed(number >= 10000000 ? 0 : 1)
                    .replace(".0", "") +
                "M"
            );

        }

        return (
            (number / 1000000000)
                .toFixed(1)
                .replace(".0", "") +
            "B"
        );

    }


    /* =====================================================
       DOM HELPERS
    ===================================================== */

    function $(id) {
        return document.getElementById(id);
    }


    function setText(id, value) {

        const element = $(id);

        if (element) {
            element.textContent = value ?? "";
        }

    }


    function show(element) {

        if (!element) return;

        element.classList.remove("hidden");

    }


    function hide(element) {

        if (!element) return;

        element.classList.add("hidden");

    }


    /* =====================================================
       HTML ESCAPE
    ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* =====================================================
       URL PROFILE UID
    ===================================================== */

    function getProfileUIDFromURL() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return (
            params.get("uid") ||
            params.get("user") ||
            params.get("userId") ||
            params.get("profile") ||
            null
        );

    }


    /* =====================================================
       AUTH
    ===================================================== */

    async function loadCurrentUser() {

        try {

            if (
                typeof requireAuth === "function"
            ) {

                currentUser =
                    await requireAuth();

            } else {

                currentUser =
                    window.auth?.currentUser;

            }

            if (!currentUser) {
                return null;
            }

            return currentUser;

        } catch (error) {

            console.error(
                "Profile authentication error:",
                error
            );

            currentUser =
                window.auth?.currentUser || null;

            return currentUser;

        }

    }


    /* =====================================================
       RESOLVE PROFILE
    ===================================================== */

    function resolveProfileUID() {

        const urlUID =
            getProfileUIDFromURL();

        if (urlUID) {
            return urlUID;
        }

        if (currentUser?.uid) {
            return currentUser.uid;
        }

        return null;

    }


    /* =====================================================
       LOAD USER
    ===================================================== */

    async function loadProfileUser(uid) {

        if (!uid) {
            return null;
        }

        try {

            const snapshot =
                await userRef(uid).once("value");

            const data =
                snapshot.exists()
                    ? snapshot.val() || {}
                    : {};

            /*
             * IMPORTANT:
             * A Firebase user may not have a users/
             * profile node yet. We still create a usable
             * profile from auth information.
             */

            if (
                !snapshot.exists() &&
                currentUser?.uid !== uid
            ) {
                return null;
            }

            return {

                ...data,

                uid,

                name:
                    data.name ||
                    data.fullName ||
                    (
                        currentUser?.uid === uid
                            ? currentUser.displayName
                            : ""
                    ) ||
                    "Viewora User",

                fullName:
                    data.fullName ||
                    data.name ||
                    (
                        currentUser?.uid === uid
                            ? currentUser.displayName
                            : ""
                    ) ||
                    "Viewora User",

                username:
                    data.username ||
                    (
                        currentUser?.uid === uid
                            ? (
                                currentUser.username ||
                                currentUser.email?.split("@")[0]
                            )
                            : ""
                    ) ||
                    "user",

                email:
                    data.email ||
                    (
                        currentUser?.uid === uid
                            ? currentUser.email
                            : ""
                    ) ||
                    "",

                profilePhoto:
                    data.profilePhoto ||
                    data.photoURL ||
                    (
                        currentUser?.uid === uid
                            ? currentUser.photoURL
                            : ""
                    ) ||
                    DEFAULT_AVATAR,

                coverPhoto:
                    data.coverPhoto ||
                    data.banner ||
                    DEFAULT_BANNER,

                bio:
                    data.bio ||
                    "Welcome to Viewora 🚀",

                verified:
                    data.verified === true,

                followers:
                    safeNumber(data.followers),

                following:
                    safeNumber(data.following),

                posts:
                    safeNumber(data.posts),

                videos:
                    safeNumber(data.videos),

                shorts:
                    safeNumber(data.shorts),

                createdAt:
                    data.createdAt ||
                    currentUser?.metadata?.creationTime ||
                    null

            };

        } catch (error) {

            console.error(
                "Failed to load profile user:",
                error
            );

            return null;

        }

    }


    /* =====================================================
       REAL FOLLOWER COUNT
    ===================================================== */

    async function getRealFollowersCount(uid) {

        if (!uid) {
            return 0;
        }

        try {

            const snapshot =
                await followersRef(uid)
                    .once("value");

            if (!snapshot.exists()) {
                return 0;
            }

            const value =
                snapshot.val();

            if (
                !value ||
                typeof value !== "object"
            ) {
                return 0;
            }

            /*
             * Only count actual truthy follower entries.
             */

            return Object.values(value)
                .filter(
                    item =>
                        item === true ||
                        item === 1 ||
                        item === "true"
                )
                .length;

        } catch (error) {

            console.warn(
                "Real followers count failed:",
                error
            );

            return 0;

        }

    }


    /* =====================================================
       REAL FOLLOWING COUNT
    ===================================================== */

    async function getRealFollowingCount(uid) {

        if (!uid) {
            return 0;
        }

        try {

            const snapshot =
                await followingRef(uid)
                    .once("value");

            if (!snapshot.exists()) {
                return 0;
            }

            const value =
                snapshot.val();

            if (
                !value ||
                typeof value !== "object"
            ) {
                return 0;
            }

            return Object.values(value)
                .filter(
                    item =>
                        item === true ||
                        item === 1 ||
                        item === "true"
                )
                .length;

        } catch (error) {

            console.warn(
                "Real following count failed:",
                error
            );

            return 0;

        }

    }


    /* =====================================================
       REFRESH REAL COUNTS
    ===================================================== */

    async function refreshRealFollowCounts() {

        if (!profileUID) {
            return;
        }

        try {

            const [
                followersCount,
                followingCount
            ] = await Promise.all([

                getRealFollowersCount(
                    profileUID
                ),

                getRealFollowingCount(
                    profileUID
                )

            ]);

            /*
             * Update local profile object.
             */

            if (profileData) {

                profileData.followers =
                    followersCount;

                profileData.following =
                    followingCount;

            }

            /*
             * Update UI.
             */

            setText(
                "followersCount",
                formatNumber(
                    followersCount
                )
            );

            setText(
                "followingCount",
                formatNumber(
                    followingCount
                )
            );

        } catch (error) {

            console.warn(
                "Follow counts refresh failed:",
                error
            );

        }

    }


    /* =====================================================
       RENDER PROFILE
    ===================================================== */

    function renderProfile(user) {

        if (!user) {
            return;
        }

        profileData =
            user;


        /* NAME */

        setText(
            "profileName",
            user.name
        );


        /* VERIFIED */

        const verifiedBadge =
            $("verifiedBadge");

        if (verifiedBadge) {

            verifiedBadge.classList.toggle(
                "hidden",
                user.verified !== true
            );

        }


        /* USERNAME */

        setText(
            "profileUsername",
            "@" +
            (
                user.username ||
                "user"
            )
        );


        /* BIO */

        setText(
            "profileBio",
            user.bio ||
            "Welcome to Viewora 🚀"
        );


        /* PROFILE IMAGE */

        const profilePic =
            $("profilePic");

        if (profilePic) {

            profilePic.src =
                user.profilePhoto ||
                DEFAULT_AVATAR;

            profilePic.onerror =
                () => {

                    profilePic.onerror = null;

                    profilePic.src =
                        DEFAULT_AVATAR;

                };

        }


        /* COVER */

        const coverPhoto =
            $("coverPhoto");

        if (coverPhoto) {

            coverPhoto.src =
                user.coverPhoto ||
                DEFAULT_BANNER;

            coverPhoto.onerror =
                () => {

                    coverPhoto.onerror = null;

                    coverPhoto.src =
                        DEFAULT_BANNER;

                };

        }


        /* POSTS */

        setText(
            "postsCount",
            formatNumber(user.posts)
        );


        /* FOLLOWERS */

        setText(
            "followersCount",
            formatNumber(user.followers)
        );


        /* FOLLOWING */

        setText(
            "followingCount",
            formatNumber(user.following)
        );


        /* VIDEOS */

        setText(
            "videosCount",
            formatNumber(user.videos)
        );


        /* JOIN DATE */

        renderJoinDate(
            user.createdAt
        );


        /* LOCATION */

        const location =
            user.location ||
            user.city ||
            user.country ||
            "";

        const locationElement =
            $("profileLocation");

        if (locationElement) {

            if (location) {

                locationElement.innerHTML =
                    '<i class="fa-solid fa-location-dot"></i> ' +
                    escapeHTML(location);

                show(locationElement);

            } else {

                hide(locationElement);

            }

        }

    }


    /* =====================================================
       JOIN DATE
    ===================================================== */

    function renderJoinDate(value) {

        const element =
            $("joinDate");

        if (!element) {
            return;
        }

        let date = null;


        if (typeof value === "number") {

            date =
                new Date(value);

        }


        if (
            typeof value === "string" &&
            value
        ) {

            const parsed =
                Date.parse(value);

            if (
                Number.isFinite(parsed)
            ) {

                date =
                    new Date(parsed);

            }

        }


        if (
            !date ||
            Number.isNaN(
                date.getTime()
            )
        ) {

            element.innerHTML =
                '<i class="fa-solid fa-calendar"></i> Joined Viewora';

            return;

        }


        element.innerHTML =
            '<i class="fa-solid fa-calendar"></i> Joined ' +
            date.getFullYear();

    }


    /* =====================================================
       PROFILE MODE
    ===================================================== */

    function renderProfileMode() {

        const followBtn =
            $("followBtn");

        const messageBtn =
            $("messageBtn");

        const editBtn =
            $("editProfileBtn");

        const settingsBtn =
            $("settingsBtn");

        if (isOwnProfile) {

            hide(followBtn);
            hide(messageBtn);

            show(editBtn);
            show(settingsBtn);

        } else {

            show(followBtn);
            show(messageBtn);

            hide(editBtn);
            hide(settingsBtn);

        }

        updateFollowButton();

    }


    /* =====================================================
       FOLLOW STATE
    ===================================================== */

    async function checkFollowState() {

        if (
            !currentUser?.uid ||
            !profileUID ||
            isOwnProfile
        ) {

            isFollowing = false;

            updateFollowButton();

            return;

        }

        try {

            const snapshot =
                await followingRef(
                    currentUser.uid
                )
                .child(profileUID)
                .once("value");

            const value =
                snapshot.val();

            isFollowing =
                value === true ||
                value === 1 ||
                value === "true";

        } catch (error) {

            console.warn(
                "Follow state failed:",
                error
            );

            isFollowing = false;

        }

        updateFollowButton();

    }


    /* =====================================================
       FOLLOW BUTTON
    ===================================================== */

    function updateFollowButton() {

        const button =
            $("followBtn");

        if (!button) {
            return;
        }

        if (isOwnProfile) {

            hide(button);

            return;

        }

        show(button);

        button.disabled =
            busyFollow;

        if (busyFollow) {

            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i>' +
                '<span>Please wait</span>';

            return;

        }

        if (isFollowing) {

            button.classList.remove(
                "primaryBtn"
            );

            button.classList.add(
                "secondaryBtn"
            );

            button.innerHTML =
                '<i class="fa-solid fa-user-check"></i>' +
                '<span>Following</span>';

        } else {

            button.classList.remove(
                "secondaryBtn"
            );

            button.classList.add(
                "primaryBtn"
            );

            button.innerHTML =
                '<i class="fa-solid fa-user-plus"></i>' +
                '<span>Follow</span>';

        }

    }


    /* =====================================================
       FOLLOW / UNFOLLOW
    ===================================================== */

    async function toggleFollow() {

        if (busyFollow) {
            return;
        }

        if (
            !currentUser?.uid ||
            !profileUID ||
            isOwnProfile
        ) {
            return;
        }

        /*
         * Never allow following yourself.
         */

        if (
            currentUser.uid === profileUID
        ) {
            return;
        }

        busyFollow = true;

        updateFollowButton();


        const previousState =
            isFollowing;

        const nextState =
            !previousState;


        try {

            const myUID =
                currentUser.uid;

            const targetUID =
                profileUID;


            /*
             * IMPORTANT
             * ---------------------------------------------
             * Do NOT update users.followers using:
             *
             * Number(value) + 1
             *
             * because old database values may be NaN,
             * strings, null or missing.
             *
             * We maintain actual follower relationships
             * here. Counts are calculated from these nodes.
             */

            const updates = {};


            if (nextState) {

                updates[
                    "following/" +
                    myUID +
                    "/" +
                    targetUID
                ] = true;

                updates[
                    "followers/" +
                    targetUID +
                    "/" +
                    myUID
                ] = true;

            } else {

                updates[
                    "following/" +
                    myUID +
                    "/" +
                    targetUID
                ] = null;

                updates[
                    "followers/" +
                    targetUID +
                    "/" +
                    myUID
                ] = null;

            }


            /*
             * One atomic Firebase update.
             */

            await db
                .ref()
                .update(updates);


            /*
             * Update UI immediately.
             */

            isFollowing =
                nextState;


            if (profileData) {

                const currentFollowers =
                    safeNumber(
                        profileData.followers
                    );

                profileData.followers =
                    Math.max(
                        0,
                        currentFollowers +
                        (
                            nextState
                                ? 1
                                : -1
                        )
                    );

            }


            setText(
                "followersCount",
                formatNumber(
                    profileData?.followers || 0
                )
            );


            updateFollowButton();


            /*
             * Get the exact real count from Firebase.
             */

            await refreshRealFollowCounts();


            /*
             * Notification only on new follow.
             */

            if (nextState) {

                await createFollowNotification(
                    targetUID
                );

                showToast(
                    "Following"
                );

            } else {

                showToast(
                    "Unfollowed"
                );

            }

        } catch (error) {

            console.error(
                "Follow action failed:",
                error
            );

            /*
             * Restore previous UI state.
             */

            isFollowing =
                previousState;

            updateFollowButton();

            showToast(
                "Follow action failed"
            );

        } finally {

            busyFollow = false;

            updateFollowButton();

        }

    }


    /* =====================================================
       FOLLOW NOTIFICATION
    ===================================================== */

    async function createFollowNotification(
        targetUID
    ) {

        if (
            !targetUID ||
            !currentUser?.uid
        ) {
            return;
        }

        try {

            const notification =
                notificationsRef(
                    targetUID
                ).push();

            const senderName =
                currentUser.displayName ||
                currentUser.name ||
                profileData?.name ||
                "Viewora User";

            const senderUsername =
                currentUser.username ||
                "user";

            const senderPhoto =
                currentUser.photoURL ||
                currentUser.profilePhoto ||
                DEFAULT_AVATAR;


            await notification.set({

                id:
                    notification.key,

                type:
                    "follow",

                fromUID:
                    currentUser.uid,

                fromName:
                    senderName,

                fromUsername:
                    senderUsername,

                fromPhoto:
                    senderPhoto,

                message:
                    "started following you",

                read:
                    false,

                createdAt:
                    SERVER_TIME

            });

        } catch (error) {

            /*
             * Notification failure should NEVER
             * make the follow action fail.
             */

            console.warn(
                "Follow notification failed:",
                error
            );

        }

    }


    /* =====================================================
       FOLLOWERS / FOLLOWING PAGE
    ===================================================== */

    function openFollowList(type) {

        if (!profileUID) {
            return;
        }

        const page =
            type === "followers"
                ? "followers.html"
                : "following.html";

        window.location.href =
            page +
            "?uid=" +
            encodeURIComponent(
                profileUID
            );

    }


    /* =====================================================
       PROFILE BUTTONS
    ===================================================== */

    function setupProfileButtons() {

        $("followBtn")
            ?.addEventListener(
                "click",
                toggleFollow
            );


        $("messageBtn")
            ?.addEventListener(
                "click",
                openMessage
            );


        $("shareProfileBtn")
            ?.addEventListener(
                "click",
                shareProfile
            );


        $("settingsBtn")
            ?.addEventListener(
                "click",
                () => {

                    if (!isOwnProfile) {
                        return;
                    }

                    window.location.href =
                        "settings.html";

                }
            );


        $("editProfileBtn")
            ?.addEventListener(
                "click",
                () => {

                    if (!isOwnProfile) {
                        return;
                    }

                    window.location.href =
                        "edit-profile.html";

                }
            );


        /*
         * Use IDs first because they are more reliable.
         */

        $("followersStat")
            ?.addEventListener(
                "click",
                () =>
                    openFollowList(
                        "followers"
                    )
            );


        $("followingStat")
            ?.addEventListener(
                "click",
                () =>
                    openFollowList(
                        "following"
                    )
            );


        /*
         * Fallback for existing HTML where stats
         * only use .profileStats .stat.
         */

        const stats =
            document.querySelectorAll(
                ".profileStats .stat"
            );


        if (stats[1]) {

            stats[1].style.cursor =
                "pointer";

            stats[1].addEventListener(
                "click",
                () =>
                    openFollowList(
                        "followers"
                    )
            );

        }


        if (stats[2]) {

            stats[2].style.cursor =
                "pointer";

            stats[2].addEventListener(
                "click",
                () =>
                    openFollowList(
                        "following"
                    )
            );

        }

    }


    /* =====================================================
       MESSAGE
    ===================================================== */

    function openMessage() {

        if (
            isOwnProfile ||
            !profileUID
        ) {
            return;
        }

        window.location.href =
            "chat.html?uid=" +
            encodeURIComponent(
                profileUID
            );

    }


    /* =====================================================
       SHARE
    ===================================================== */

    async function shareProfile() {

        if (!profileUID) {
            return;
        }

        const username =
            profileData?.username ||
            "user";

        const shareURL =
            window.location.href;

        const shareData = {

            title:
                profileData?.name ||
                "Viewora Profile",

            text:
                "Check out @" +
                username +
                " on Viewora",

            url:
                shareURL

        };


        try {

            if (
                navigator.share
            ) {

                await navigator.share(
                    shareData
                );

            } else if (
                navigator.clipboard
            ) {

                await navigator.clipboard.writeText(
                    shareURL
                );

                showToast(
                    "Profile link copied"
                );

            } else {

                showToast(
                    "Copy this profile link"
                );

            }

        } catch (error) {

            if (
                error?.name !==
                "AbortError"
            ) {

                console.warn(
                    "Share failed:",
                    error
                );

            }

        }

    }


    /* =====================================================
       TABS
    ===================================================== */

    function setupTabs() {

        document
            .querySelectorAll(
                ".tabBtn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const tab =
                                button.dataset.tab;

                            if (!tab) {
                                return;
                            }

                            switchTab(
                                tab
                            );

                        }
                    );

                }
            );

    }


    /* =====================================================
       SWITCH TAB
    ===================================================== */

    async function switchTab(tab) {

        currentTab =
            tab;


        document
            .querySelectorAll(
                ".tabBtn"
            )
            .forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.tab ===
                        tab
                    );

                }
            );


        document
            .querySelectorAll(
                ".tabContent"
            )
            .forEach(
                content => {

                    content.classList.remove(
                        "active"
                    );

                }
            );


        const target =
            $(
                tab +
                "Tab"
            );

        if (target) {

            target.classList.add(
                "active"
            );

        }


        if (tab === "posts") {
            await loadPosts();
        }


        if (tab === "shorts") {
            await loadShorts();
        }


        if (tab === "videos") {
            await loadVideos();
        }


        if (tab === "saved") {
            await loadSaved();
        }

    }


    /* =====================================================
       LOAD POSTS
    ===================================================== */

    async function loadPosts() {

        const container =
            $("postsList");

        if (
            !container ||
            !profileUID
        ) {
            return;
        }

        renderLoading(
            container,
            "Loading posts..."
        );


        try {

            const snapshot =
                await postsRef()
                    .orderByChild("uid")
                    .equalTo(profileUID)
                    .once("value");


            const data =
                snapshot.val() || {};


            const items =
                Object.entries(data)
                    .map(
                        ([id, value]) => ({
                            id,
                            ...(value || {})
                        })
                    )
                    .filter(
                        item =>
                            item.archived !== true &&
                            item.deleted !== true
                    )
                    .sort(
                        (a, b) =>
                            safeNumber(
                                b.createdAt
                            ) -
                            safeNumber(
                                a.createdAt
                            )
                    );


            /*
             * Update post count from actual content.
             */

            if (isOwnProfile) {

                setText(
                    "postsCount",
                    formatNumber(
                        items.length
                    )
                );

            }


            if (!items.length) {

                renderEmpty(
                    container,
                    "No posts yet",
                    "Share your first moment on Viewora."
                );

                return;

            }


            container.innerHTML =
                items
                    .map(
                        renderPostCard
                    )
                    .join("");


            bindContentActions(
                container
            );

        } catch (error) {

            console.error(
                "Posts loading error:",
                error
            );

            renderEmpty(
                container,
                "Unable to load posts",
                "Please try again."
            );

        }

    }


    /* =====================================================
       POST CARD
    ===================================================== */

    function renderPostCard(item) {

        const media =
            getMediaURL(item);

        const type =
            String(
                item.type ||
                item.mediaType ||
                "image"
            ).toLowerCase();


        if (!media) {

            return `
                <article
                    class="profileContentCard"
                    data-id="${escapeHTML(item.id)}"
                    data-type="post"
                >

                    <div class="contentPlaceholder">
                        <i class="fa-solid fa-image"></i>
                    </div>

                </article>
            `;

        }


        const isVideo =
            type === "video" ||
            type === "mp4" ||
            item.video === true;


        return `
            <article
                class="profileContentCard"
                data-id="${escapeHTML(item.id)}"
                data-type="post"
            >

                ${
                    isVideo
                        ? `
                            <video
                                src="${escapeHTML(media)}"
                                muted
                                playsinline
                                preload="metadata"
                            ></video>
                        `
                        : `
                            <img
                                src="${escapeHTML(media)}"
                                alt="Post"
                                loading="lazy"
                            >
                        `
                }

                <div class="contentOverlay">

                    <span>
                        <i class="fa-solid fa-heart"></i>
                        ${formatNumber(item.likes)}
                    </span>

                    <span>
                        <i class="fa-solid fa-comment"></i>
                        ${formatNumber(item.comments)}
                    </span>

                </div>

                ${
                    isOwnProfile
                        ? `
                            <button
                                class="contentMoreBtn"
                                data-action="manage"
                                type="button"
                                aria-label="Manage post"
                            >
                                <i class="fa-solid fa-ellipsis"></i>
                            </button>
                        `
                        : ""
                }

            </article>
        `;

    }


    /* =====================================================
       LOAD SHORTS
    ===================================================== */

    async function loadShorts() {

        const container =
            $("shortsList");

        if (
            !container ||
            !profileUID
        ) {
            return;
        }

        renderLoading(
            container,
            "Loading shorts..."
        );


        try {

            const snapshot =
                await shortsRef()
                    .orderByChild("uid")
                    .equalTo(profileUID)
                    .once("value");


            const data =
                snapshot.val() || {};


            const items =
                Object.entries(data)
                    .map(
                        ([id, value]) => ({
                            id,
                            ...(value || {})
                        })
                    )
                    .filter(
                        item =>
                            item.archived !== true &&
                            item.deleted !== true
                    )
                    .sort(
                        (a, b) =>
                            safeNumber(
                                b.createdAt
                            ) -
                            safeNumber(
                                a.createdAt
                            )
                    );


            if (!items.length) {

                renderEmpty(
                    container,
                    "No shorts yet",
                    "Your short videos will appear here."
                );

                return;

            }


            container.innerHTML =
                items
                    .map(
                        renderShortCard
                    )
                    .join("");


            bindContentActions(
                container
            );

        } catch (error) {

            console.error(
                "Shorts loading error:",
                error
            );

            renderEmpty(
                container,
                "Unable to load shorts",
                "Please try again."
            );

        }

    }


    /* =====================================================
       SHORT CARD
    ===================================================== */

    function renderShortCard(item) {

        const media =
            getMediaURL(item);

        const poster =
            item.thumbnail ||
            item.poster ||
            item.cover ||
            "";


        return `
            <article
                class="profileContentCard shortCard"
                data-id="${escapeHTML(item.id)}"
                data-type="short"
            >

                <video
                    src="${escapeHTML(media)}"
                    ${
                        poster
                            ? `poster="${escapeHTML(poster)}"`
                            : ""
                    }
                    muted
                    playsinline
                    preload="metadata"
                ></video>

                <div class="shortBadge">
                    <i class="fa-solid fa-play"></i>
                </div>

                <div class="contentOverlay">

                    <span>
                        <i class="fa-solid fa-eye"></i>
                        ${formatNumber(item.views)}
                    </span>

                </div>

                ${
                    isOwnProfile
                        ? `
                            <button
                                class="contentMoreBtn"
                                data-action="manage"
                                type="button"
                            >
                                <i class="fa-solid fa-ellipsis"></i>
                            </button>
                        `
                        : ""
                }

            </article>
        `;

    }


    /* =====================================================
       LOAD VIDEOS
    ===================================================== */

    async function loadVideos() {

        const container =
            $("videosList");

        if (
            !container ||
            !profileUID
        ) {
            return;
        }

        renderLoading(
            container,
            "Loading videos..."
        );


        try {

            let items = [];


            /*
             * Dedicated videos node.
             */

            try {

                const videosSnapshot =
                    await db
                        .ref("videos")
                        .orderByChild("uid")
                        .equalTo(profileUID)
                        .once("value");


                const videos =
                    videosSnapshot.val() || {};


                items =
                    Object.entries(videos)
                        .map(
                            ([id, value]) => ({
                                id,
                                ...(value || {})
                            })
                        );

            } catch (error) {

                console.warn(
                    "Dedicated videos node unavailable:",
                    error
                );

            }


            /*
             * Fallback to video posts.
             */

            if (!items.length) {

                const postSnapshot =
                    await postsRef()
                        .orderByChild("uid")
                        .equalTo(profileUID)
                        .once("value");


                const posts =
                    postSnapshot.val() || {};


                items =
                    Object.entries(posts)
                        .map(
                            ([id, value]) => ({
                                id,
                                ...(value || {})
                            })
                        )
                        .filter(
                            item =>
                                String(
                                    item.type ||
                                    item.mediaType ||
                                    ""
                                ).toLowerCase() ===
                                "video" ||
                                item.video === true
                        );

            }


            items =
                items
                    .filter(
                        item =>
                            item.archived !== true &&
                            item.deleted !== true
                    )
                    .sort(
                        (a, b) =>
                            safeNumber(
                                b.createdAt
                            ) -
                            safeNumber(
                                a.createdAt
                            )
                    );


            if (!items.length) {

                renderEmpty(
                    container,
                    "No long videos yet",
                    "Long-form videos will appear here."
                );

                return;

            }


            container.innerHTML =
                items
                    .map(
                        renderVideoCard
                    )
                    .join("");


            bindContentActions(
                container
            );

        } catch (error) {

            console.error(
                "Videos loading error:",
                error
            );

            renderEmpty(
                container,
                "Unable to load videos",
                "Please try again."
            );

        }

    }


    /* =====================================================
       VIDEO CARD
    ===================================================== */

    function renderVideoCard(item) {

        const media =
            getMediaURL(item);

        const thumbnail =
            item.thumbnail ||
            item.poster ||
            item.cover ||
            "";


        return `
            <article
                class="videoProfileCard"
                data-id="${escapeHTML(item.id)}"
                data-type="video"
            >

                <div class="videoThumb">

                    ${
                        thumbnail
                            ? `
                                <img
                                    src="${escapeHTML(thumbnail)}"
                                    alt="Video"
                                    loading="lazy"
                                >
                            `
                            : `
                                <video
                                    src="${escapeHTML(media)}"
                                    muted
                                    playsinline
                                    preload="metadata"
                                ></video>
                            `
                    }

                    <div class="videoPlay">
                        <i class="fa-solid fa-play"></i>
                    </div>

                    ${
                        isOwnProfile
                            ? `
                                <button
                                    class="contentMoreBtn"
                                    data-action="manage"
                                    type="button"
                                >
                                    <i class="fa-solid fa-ellipsis"></i>
                                </button>
                            `
                            : ""
                    }

                </div>

                <div class="videoInfo">

                    <h3>
                        ${escapeHTML(
                            item.title ||
                            item.caption ||
                            "Viewora Video"
                        )}
                    </h3>

                    <p>
                        ${formatNumber(item.views)}
                        views
                    </p>

                </div>

            </article>
        `;

    }


    /* =====================================================
       LOAD SAVED
    ===================================================== */

    async function loadSaved() {

        const container =
            $("savedList");

        if (!container) {
            return;
        }


        if (!isOwnProfile) {

            renderEmpty(
                container,
                "Private section",
                "Saved posts are visible only to you."
            );

            return;

        }


        if (!currentUser?.uid) {
            return;
        }


        renderLoading(
            container,
            "Loading saved..."
        );


        try {

            const snapshot =
                await savedPostsRef(
                    currentUser.uid
                ).once("value");


            const saved =
                snapshot.val() || {};


            const ids =
                Object.keys(saved);


            if (!ids.length) {

                renderEmpty(
                    container,
                    "Nothing saved",
                    "Posts you save will appear here."
                );

                return;

            }


            const posts = [];


            for (const id of ids) {

                try {

                    const postSnapshot =
                        await postRef(id)
                            .once("value");


                    if (
                        postSnapshot.exists()
                    ) {

                        const data =
                            postSnapshot.val() ||
                            {};


                        if (
                            data.deleted !== true &&
                            data.archived !== true
                        ) {

                            posts.push({
                                id,
                                ...data
                            });

                        }

                    }

                } catch (error) {

                    console.warn(
                        "Saved post skipped:",
                        id
                    );

                }

            }


            if (!posts.length) {

                renderEmpty(
                    container,
                    "Nothing saved",
                    "Your saved posts will appear here."
                );

                return;

            }


            container.innerHTML =
                posts
                    .map(
                        renderPostCard
                    )
                    .join("");


            bindContentActions(
                container
            );

        } catch (error) {

            console.error(
                "Saved loading error:",
                error
            );

            renderEmpty(
                container,
                "Unable to load saved posts",
                "Please try again."
            );

        }

    }


    /* =====================================================
       MEDIA URL
    ===================================================== */

    function getMediaURL(item) {

        if (!item) {
            return "";
        }

        return (
            item.mediaUrl ||
            item.mediaURL ||
            item.url ||
            item.videoUrl ||
            item.videoURL ||
            item.imageUrl ||
            item.imageURL ||
            item.fileUrl ||
            item.cloudinaryUrl ||
            ""
        );

    }


    /* =====================================================
       CONTENT ACTIONS
    ===================================================== */

    function bindContentActions(container) {

        container
            .querySelectorAll("[data-type]")
            .forEach(
                card => {

                    card.addEventListener(
                        "click",
                        event => {

                            if (
                                event.target.closest(
                                    "[data-action='manage']"
                                )
                            ) {
                                return;
                            }

                            const id =
                                card.dataset.id;

                            const type =
                                card.dataset.type;

                            if (!id) {
                                return;
                            }

                            openContent(
                                id,
                                type
                            );

                        }
                    );

                }
            );


        container
            .querySelectorAll(
                "[data-action='manage']"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        event => {

                            event.preventDefault();

                            event.stopPropagation();

                            const card =
                                button.closest(
                                    "[data-id]"
                                );

                            if (!card) {
                                return;
                            }

                            openManageMenu(
                                card.dataset.id,
                                card.dataset.type
                            );

                        }
                    );

                }
            );

    }


    /* =====================================================
       OPEN CONTENT
    ===================================================== */

    function openContent(id, type) {

        if (!id) {
            return;
        }


        if (type === "short") {

            window.location.href =
                "shorts.html?short=" +
                encodeURIComponent(id);

            return;

        }


        if (type === "video") {

            window.location.href =
                "video.html?id=" +
                encodeURIComponent(id);

            return;

        }


        window.location.href =
            "post.html?id=" +
            encodeURIComponent(id);

    }


    /* =====================================================
       MANAGE CONTENT
    ===================================================== */

    function openManageMenu(id, type) {

        if (!isOwnProfile) {
            return;
        }


        /*
         * Use a native action menu fallback.
         */

        const action =
            window.prompt(
                "Manage content\n\n" +
                "1 = Archive\n" +
                "2 = Delete\n" +
                "3 = Cancel"
            );


        if (action === "1") {

            archiveContent(
                id,
                type
            );

        }


        if (action === "2") {

            deleteContent(
                id,
                type
            );

        }

    }


    /* =====================================================
       CONTENT REFERENCE
    ===================================================== */

    function contentReference(id, type) {

        if (type === "short") {

            return shortRef(id);

        }

        if (type === "video") {

            return db.ref(
                "videos/" + id
            );

        }

        return postRef(id);

    }


    /* =====================================================
       ARCHIVE
    ===================================================== */

    async function archiveContent(id, type) {

        if (
            !id ||
            !isOwnProfile
        ) {
            return;
        }


        try {

            await contentReference(
                id,
                type
            ).update({

                archived:
                    true,

                archivedAt:
                    SERVER_TIME

            });


            showToast(
                "Moved to archive"
            );


            await refreshCurrentTab();

        } catch (error) {

            console.error(
                "Archive failed:",
                error
            );

            showToast(
                "Archive failed"
            );

        }

    }


    /* =====================================================
       DELETE
    ===================================================== */

    async function deleteContent(id, type) {

        if (
            !id ||
            !isOwnProfile
        ) {
            return;
        }


        const confirmed =
            window.confirm(
                "Delete this content from your profile?"
            );


        if (!confirmed) {
            return;
        }


        try {

            await contentReference(
                id,
                type
            ).update({

                deleted:
                    true,

                deletedAt:
                    SERVER_TIME

            });


            showToast(
                "Content deleted"
            );


            await refreshCurrentTab();

        } catch (error) {

            console.error(
                "Delete failed:",
                error
            );

            showToast(
                "Delete failed"
            );

        }

    }


    /* =====================================================
       REFRESH CURRENT TAB
    ===================================================== */

    async function refreshCurrentTab() {

        if (currentTab === "posts") {

            await loadPosts();

        }

        if (currentTab === "shorts") {

            await loadShorts();

        }

        if (currentTab === "videos") {

            await loadVideos();

        }

        if (currentTab === "saved") {

            await loadSaved();

        }

    }


    /* =====================================================
       STORY SETUP
    ===================================================== */

    function setupStory() {

        storyInput =
            $("storyFile");


        $("storyPlusBtn")
            ?.addEventListener(
                "click",
                () => {

                    if (!isOwnProfile) {

                        openProfileStories();

                        return;

                    }

                    storyInput?.click();

                }
            );


        $("newStoryItem")
            ?.addEventListener(
                "click",
                () => {

                    if (isOwnProfile) {

                        storyInput?.click();

                    } else {

                        openProfileStories();

                    }

                }
            );


        storyInput
            ?.addEventListener(
                "change",
                handleStoryUpload
            );

    }


    /* =====================================================
       STORY UPLOAD
    ===================================================== */

    async function handleStoryUpload(event) {

        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        if (busyStory) {
            return;
        }

        if (!isOwnProfile) {
            return;
        }

        busyStory = true;


        try {

            showToast(
                "Uploading story..."
            );


            const media =
                await uploadToCloudinary(
                    file
                );


            if (!media?.url) {

                throw new Error(
                    "Cloudinary upload failed."
                );

            }


            const story =
                storiesRef().push();


            await story.set({

                id:
                    story.key,

                uid:
                    currentUser.uid,

                type:
                    file.type.startsWith(
                        "video/"
                    )
                        ? "video"
                        : "image",

                mediaUrl:
                    media.url,

                thumbnail:
                    media.thumbnail ||
                    media.url,

                createdAt:
                    SERVER_TIME,

                expiresAt:
                    Date.now() +
                    (
                        24 *
                        60 *
                        60 *
                        1000
                    ),

                viewed:
                    false

            });


            if (storyInput) {
                storyInput.value = "";
            }


            showToast(
                "Story added"
            );


            await loadStories();

        } catch (error) {

            console.error(
                "Story upload failed:",
                error
            );

            showToast(
                "Story upload failed"
            );

        } finally {

            busyStory = false;

        }

    }


    /* =====================================================
       CLOUDINARY
    ===================================================== */

    async function uploadToCloudinary(file) {

        const CLOUD_NAME =
            "z5m6wjdf";

        const UPLOAD_PRESET =
            "Viewora-upload";

        const UPLOAD_URL =
            "https://api.cloudinary.com/v1_1/" +
            CLOUD_NAME +
            "/auto/upload";


        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );

        formData.append(
            "upload_preset",
            UPLOAD_PRESET
        );


        const response =
            await fetch(
                UPLOAD_URL,
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!response.ok) {

            throw new Error(
                "Cloudinary HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        return {

            url:
                data.secure_url ||
                data.url ||
                "",

            thumbnail:
                data.thumbnail_url ||
                data.secure_url ||
                "",

            publicId:
                data.public_id ||
                "",

            resourceType:
                data.resource_type ||
                ""

        };

    }


    /* =====================================================
       LOAD STORIES
    ===================================================== */

    async function loadStories() {

        const wrapper =
            $("storiesWrapper");

        if (
            !wrapper ||
            !profileUID
        ) {
            return;
        }


        try {

            const snapshot =
                await storiesRef()
                    .orderByChild("uid")
                    .equalTo(profileUID)
                    .once("value");


            const data =
                snapshot.val() || {};


            const now =
                Date.now();


            const stories =
                Object.entries(data)
                    .map(
                        ([id, value]) => ({
                            id,
                            ...(value || {})
                        })
                    )
                    .filter(
                        story => {

                            const expiry =
                                safeNumber(
                                    story.expiresAt
                                );

                            return (
                                !expiry ||
                                expiry > now
                            );

                        }
                    )
                    .sort(
                        (a, b) =>
                            safeNumber(
                                b.createdAt
                            ) -
                            safeNumber(
                                a.createdAt
                            )
                    );


            const newItem =
                $("newStoryItem");


            wrapper.innerHTML = "";


            if (
                isOwnProfile &&
                newItem
            ) {

                wrapper.appendChild(
                    newItem
                );

            }


            stories.forEach(
                story => {

                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "storyItem";


                    const media =
                        story.mediaUrl ||
                        story.url ||
                        "";


                    item.innerHTML = `

                        <div class="storyCircle">

                            ${
                                story.type === "video"
                                    ? `
                                        <video
                                            src="${escapeHTML(media)}"
                                            muted
                                            playsinline
                                            preload="metadata"
                                        ></video>
                                    `
                                    : `
                                        <img
                                            src="${escapeHTML(
                                                media ||
                                                DEFAULT_AVATAR
                                            )}"
                                            alt="Story"
                                        >
                                    `
                            }

                        </div>

                        <p>
                            ${
                                escapeHTML(
                                    story.title ||
                                    "Story"
                                )
                            }
                        </p>

                    `;


                    item.addEventListener(
                        "click",
                        () => {

                            openStoryViewer(
                                story
                            );

                        }
                    );


                    wrapper.appendChild(
                        item
                    );

                }
            );


            if (!stories.length && !isOwnProfile) {

                renderStoryEmpty(
                    wrapper
                );

            }

        } catch (error) {

            console.warn(
                "Stories loading failed:",
                error
            );

        }

    }


    /* =====================================================
       STORY VIEWER
    ===================================================== */

    function openStoryViewer(story) {

        const url =
            story.mediaUrl ||
            story.url ||
            "";


        if (!url) {
            return;
        }


        document
            .getElementById(
                "vieworaStoryViewer"
            )
            ?.remove();


        const viewer =
            document.createElement(
                "div"
            );


        viewer.id =
            "vieworaStoryViewer";


        viewer.innerHTML = `

            <div class="storyViewerBackdrop"></div>

            <div class="storyViewerContent">

                <button
                    class="storyViewerClose"
                    type="button"
                    aria-label="Close"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

                ${
                    story.type === "video"
                        ? `
                            <video
                                src="${escapeHTML(url)}"
                                controls
                                autoplay
                                playsinline
                            ></video>
                        `
                        : `
                            <img
                                src="${escapeHTML(url)}"
                                alt="Story"
                            >
                        `
                }

            </div>

        `;


        document.body.appendChild(
            viewer
        );


        viewer
            .querySelector(
                ".storyViewerClose"
            )
            ?.addEventListener(
                "click",
                () => viewer.remove()
            );


        viewer
            .querySelector(
                ".storyViewerBackdrop"
            )
            ?.addEventListener(
                "click",
                () => viewer.remove()
            );


        document.addEventListener(
            "keydown",
            function closeOnEscape(event) {

                if (
                    event.key === "Escape"
                ) {

                    viewer.remove();

                    document.removeEventListener(
                        "keydown",
                        closeOnEscape
                    );

                }

            }
        );

    }


    /* =====================================================
       OPEN PROFILE STORIES
    ===================================================== */

    function openProfileStories() {

        const firstStory =
            document.querySelector(
                ".storyItem:not(#newStoryItem)"
            );


        if (firstStory) {

            firstStory.click();

            return;

        }


        showToast(
            "No active stories"
        );

    }


    /* =====================================================
       STORY EMPTY
    ===================================================== */

    function renderStoryEmpty(wrapper) {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "storyItem";


        item.innerHTML = `

            <div class="storyCircle addStory">

                <i class="fa-solid fa-clock"></i>

            </div>

            <p>
                No Story
            </p>

        `;


        wrapper.appendChild(
            item
        );

    }


    /* =====================================================
       LOADING
    ===================================================== */

    function renderLoading(
        container,
        text
    ) {

        container.innerHTML = `

            <div class="profileLoading">

                <div class="profileSpinner"></div>

                <span>
                    ${escapeHTML(text)}
                </span>

            </div>

        `;

    }


    /* =====================================================
       EMPTY
    ===================================================== */

    function renderEmpty(
        container,
        title,
        description
    ) {

        container.innerHTML = `

            <div class="profileEmpty">

                <div class="emptyIcon">

                    <i class="fa-solid fa-layer-group"></i>

                </div>

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
                    ${escapeHTML(description)}
                </p>

            </div>

        `;

    }


    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(message) {

        let toast =
            document.getElementById(
                "vieworaProfileToast"
            );


        if (!toast) {

            toast =
                document.createElement(
                    "div"
                );

            toast.id =
                "vieworaProfileToast";

            document.body.appendChild(
                toast
            );

        }


        toast.textContent =
            message;


        toast.classList.add(
            "show"
        );


        clearTimeout(
            toast.__timer
        );


        toast.__timer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                2400
            );

    }


    /* =====================================================
       SCROLL TOP
    ===================================================== */

    function setupScrollTop() {

        const button =
            $("scrollTopBtn");

        if (!button) {
            return;
        }


        window.addEventListener(
            "scroll",
            () => {

                button.classList.toggle(
                    "hidden",
                    window.scrollY < 400
                );

            },
            {
                passive: true
            }
        );


        button.addEventListener(
            "click",
            () => {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }


    /* =====================================================
       PAGE LOADER
    ===================================================== */

    function hidePageLoader() {

        const loader =
            $("pageLoader");

        const app =
            $("app");


        loader?.classList.add(
            "hidden"
        );

        app?.classList.remove(
            "hidden"
        );

        profileLoadFinished = true;

    }


    /* =====================================================
       LOADER TIMEOUT
    ===================================================== */

    function startLoaderProtection() {

        setTimeout(
            () => {

                if (profileLoadFinished) {
                    return;
                }

                console.warn(
                    "Profile loader timeout."
                );

                hidePageLoader();

            },
            10000
        );

    }


    /* =====================================================
       ERROR SCREEN
    ===================================================== */

    function showProfileError(message) {

        const app =
            $("app");

        if (!app) {
            return;
        }


        app.classList.remove(
            "hidden"
        );


        app.innerHTML = `

            <div class="profileError">

                <div class="errorIcon">

                    <i class="fa-solid fa-user-slash"></i>

                </div>

                <h2>
                    Profile unavailable
                </h2>

                <p>
                    ${escapeHTML(message)}
                </p>

                <button
                    type="button"
                    onclick="history.back()"
                >
                    Go Back
                </button>

            </div>

        `;

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initProfile() {

        startLoaderProtection();


        try {

            /*
             * STEP 1
             * Authentication
             */

            await loadCurrentUser();


            if (!currentUser) {

                hidePageLoader();

                return;

            }


            /*
             * STEP 2
             * Profile UID
             */

            profileUID =
                resolveProfileUID();


            if (!profileUID) {

                showProfileError(
                    "User profile could not be found."
                );

                hidePageLoader();

                return;

            }


            /*
             * STEP 3
             * Own profile
             */

            isOwnProfile =
                currentUser.uid ===
                profileUID;


            /*
             * STEP 4
             * Load profile
             */

            profileUser =
                await loadProfileUser(
                    profileUID
                );


            if (!profileUser) {

                showProfileError(
                    "This profile does not exist."
                );

                hidePageLoader();

                return;

            }


            /*
             * STEP 5
             * Render immediately.
             *
             * This prevents the page from staying
             * blank while counts are loading.
             */

            renderProfile(
                profileUser
            );


            /*
             * STEP 6
             * Profile mode
             */

            renderProfileMode();


            /*
             * STEP 7
             * Setup UI
             */

            setupProfileButtons();

            setupTabs();

            setupStory();

            setupScrollTop();


            /*
             * STEP 8
             * Hide loader NOW.
             */

            hidePageLoader();


            /*
             * STEP 9
             * Follow state.
             */

            await checkFollowState();


            /*
             * STEP 10
             * Real followers/following.
             */

            await refreshRealFollowCounts();


            /*
             * STEP 11
             * Stories.
             *
             * Don't let story errors block profile.
             */

            await loadStories();


            /*
             * STEP 12
             * Default posts.
             */

            await loadPosts();


            console.log(
                "=========================================="
            );

            console.log(
                "✅ VIEWORA PROFILE READY"
            );

            console.log(
                "Profile UID:",
                profileUID
            );

            console.log(
                "Own Profile:",
                isOwnProfile
            );

            console.log(
                "=========================================="
            );

        } catch (error) {

            console.error(
                "❌ Profile initialization failed:",
                error
            );


            /*
             * Never leave the user stuck on loading.
             */

            hidePageLoader();


            /*
             * Only show error if profile wasn't
             * already rendered.
             */

            if (!profileUser) {

                showProfileError(
                    "Something went wrong while loading this profile."
                );

            }

        }

    }


    /* =====================================================
       START
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initProfile,
            {
                once: true
            }
        );

    } else {

        initProfile();

    }


    /* =====================================================
       GLOBAL API
    ===================================================== */

    window.VieworaProfile = {

        reload:
            initProfile,

        loadPosts:
            loadPosts,

        loadShorts:
            loadShorts,

        loadVideos:
            loadVideos,

        loadSaved:
            loadSaved,

        loadStories:
            loadStories,

        toggleFollow:
            toggleFollow,

        openContent:
            openContent,

        refreshCounts:
            refreshRealFollowCounts

    };


})();