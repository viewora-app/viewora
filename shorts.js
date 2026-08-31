"use strict";

/*
==============================================================
 VIEWORA V12 — SHORTS
 PREMIUM TIKTOK / INSTAGRAM STYLE SHORTS ENGINE

 Firebase:
 • Authentication
 • Realtime Database
 • Realtime feed
 • Realtime likes
 • Realtime comments
 • Realtime follows
 • Realtime saves
 • Views
 • Reports

 Cloudinary:
 • Reads Cloudinary videoURL/mediaURL
 • Compatible with Cloudinary uploaded videos

 Edit:
 • edit-shorts.html?shortId=ID
 • old ?edit=ID also supported

==============================================================
*/

(() => {

    /* =========================================================
       DOUBLE INITIALIZATION PROTECTION
    ========================================================= */

    if (window.__VIEWORA_SHORTS_V12__) {
        console.warn("Viewora Shorts already initialized.");
        return;
    }

    window.__VIEWORA_SHORTS_V12__ = true;


    /* =========================================================
       CONFIG
    ========================================================= */

    const CONFIG = {

        SHORTS_PATH: "shorts",

        USERS_PATH: "users",

        COMMENTS_PATH: "comments",

        REPORTS_PATH: "reports",

        FOLLOWERS_PATH: "followers",

        FOLLOWING_PATH: "following",

        SAVED_PATH: "savedShorts",

        MAX_FEED: 100,

        MAX_COMMENTS: 100,

        VIEW_DELAY: 3000,

        LOAD_TIMEOUT: 12000,

        SEARCH_DEBOUNCE: 180

    };


    /* =========================================================
       STATE
    ========================================================= */

    const state = {

        initialized: false,

        currentUser: null,

        shorts: [],

        filteredShorts: [],

        currentShortId: null,

        currentShortIndex: 0,

        currentVideo: null,

        muted: true,

        observer: null,

        searchText: "",

        menuShortId: null,

        commentShortId: null,

        shareShortId: null,

        reportShortId: null,

        viewed: {},

        viewTimers: {},

        commentListener: null,

        shortListener: null,

        followListeners: {},

        likeListeners: {},

        saveListeners: {},

        loading: false,

        searchTimer: null,

        confirmAction: null

    };


    /* =========================================================
       DOM HELPERS
    ========================================================= */

    const $ = id =>
        document.getElementById(id);


    const container =
        $("shortsContainer");

    const skeleton =
        $("shortsSkeleton");

    const emptyState =
        $("emptyState");

    const toast =
        $("toast");

    const toastText =
        $("toastText");

    const toastIcon =
        $("toastIcon");


    /* =========================================================
       FIREBASE CHECK
    ========================================================= */

    function firebaseReady() {

        return (
            typeof firebase !== "undefined" &&
            typeof firebase.database === "function" &&
            typeof firebase.auth === "function"
        );

    }


    if (!firebaseReady()) {

        console.error(
            "Viewora Shorts: Firebase SDK unavailable."
        );

        showToast(
            "Firebase is not available",
            "error"
        );

        return;

    }


    /* =========================================================
       FIREBASE
    ========================================================= */

    const db =
        firebase.database();

    const auth =
        firebase.auth();


    /* =========================================================
       BASIC HELPERS
    ========================================================= */

    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function safeNumber(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;

    }


    function formatCount(value) {

        const number =
            safeNumber(value);

        if (number >= 10000000) {

            return (
                (number / 10000000)
                    .toFixed(1)
                    .replace(".0", "") +
                "Cr"
            );

        }

        if (number >= 100000) {

            return (
                (number / 100000)
                    .toFixed(1)
                    .replace(".0", "") +
                "L"
            );

        }

        if (number >= 1000) {

            return (
                (number / 1000)
                    .toFixed(1)
                    .replace(".0", "") +
                "K"
            );

        }

        return String(number);

    }


    function parseDisplayedCount(value) {

        const text =
            String(value || "")
                .trim()
                .toUpperCase();

        if (text.endsWith("CR")) {

            return (
                safeNumber(
                    parseFloat(
                        text.replace("CR", "")
                    )
                ) * 10000000
            );

        }

        if (text.endsWith("L")) {

            return (
                safeNumber(
                    parseFloat(
                        text.replace("L", "")
                    )
                ) * 100000
            );

        }

        if (text.endsWith("K")) {

            return (
                safeNumber(
                    parseFloat(
                        text.replace("K", "")
                    )
                ) * 1000
            );

        }

        return safeNumber(
            text.replace(/,/g, "")
        );

    }


    function getUserId(short) {

        return (
            short?.uid ||
            short?.userId ||
            short?.authorId ||
            short?.creatorId ||
            ""
        );

    }


    function getUserName(data) {

        return (
            data?.username ||
            data?.userName ||
            data?.displayName ||
            data?.name ||
            "Viewora User"
        );

    }


    function getAvatar(data) {

        return (
            data?.avatar ||
            data?.avatarUrl ||
            data?.photoURL ||
            data?.profileImage ||
            data?.profilePhoto ||
            "assets/default-avatar.png"
        );

    }


    function getVideoURL(short) {

        return (
            short?.videoURL ||
            short?.videoUrl ||
            short?.videoUrl ||
            short?.mediaURL ||
            short?.mediaUrl ||
            short?.url ||
            short?.video ||
            short?.cloudinaryURL ||
            ""
        );

    }


    function getCaption(short) {

        return (
            short?.caption ||
            short?.description ||
            short?.text ||
            ""
        );

    }


    function getCreatedAt(short) {

        return safeNumber(
            short?.createdAt ||
            short?.timestamp ||
            short?.created_at ||
            0
        );

    }


    function countObject(value) {

        if (
            !value ||
            typeof value !== "object"
        ) {
            return 0;
        }

        return Object.keys(value).length;

    }


    function isHidden(short) {

        return (
            short?.hidden === true ||
            short?.isHidden === true ||
            short?.status === "hidden"
        );

    }


    function commentsDisabled(short) {

        return (
            short?.commentsDisabled === true ||
            short?.disableComments === true ||
            short?.commentsEnabled === false
        );

    }


    function likesHidden(short) {

        return (
            short?.hideLikeCount === true ||
            short?.hideLikes === true ||
            short?.likesVisible === false
        );

    }


    function formatTime(timestamp) {

        const time =
            safeNumber(timestamp);

        if (!time) {
            return "";
        }

        const diff =
            Date.now() - time;

        if (diff < 60000) {
            return "Just now";
        }

        if (diff < 3600000) {

            return (
                Math.floor(diff / 60000) +
                "m"
            );

        }

        if (diff < 86400000) {

            return (
                Math.floor(diff / 3600000) +
                "h"
            );

        }

        if (diff < 604800000) {

            return (
                Math.floor(diff / 86400000) +
                "d"
            );

        }

        return new Date(time)
            .toLocaleDateString(
                undefined,
                {
                    day: "numeric",
                    month: "short"
                }
            );

    }


    /* =========================================================
       TOAST
    ========================================================= */

    function showToast(
        message,
        type = "success"
    ) {

        if (!toast) {
            return;
        }

        if (toastText) {
            toastText.textContent =
                message;
        }

        if (toastIcon) {

            toastIcon.className =
                type === "error"
                    ? "fa-solid fa-circle-exclamation"
                    : "fa-solid fa-circle-check";

        }

        toast.classList.remove("hidden");

        clearTimeout(
            showToast.timer
        );

        showToast.timer =
            setTimeout(() => {

                toast.classList.add(
                    "hidden"
                );

            }, 2400);

    }


    /* =========================================================
       AUTH
    ========================================================= */

    auth.onAuthStateChanged(user => {

        state.currentUser =
            user || null;

        updateCommentAvatar();

        loadShorts();

    });


    /* =========================================================
       COMMENT AVATAR
    ========================================================= */

    function updateCommentAvatar() {

        const avatar =
            $("commentUserAvatar");

        if (!avatar) {
            return;
        }

        if (!state.currentUser) {

            avatar.src =
                "assets/default-avatar.png";

            return;

        }

        avatar.src =
            state.currentUser.photoURL ||
            "assets/default-avatar.png";

    }


    /* =========================================================
       LOAD SHORTS
    ========================================================= */

    async function loadShorts() {

        if (!container || state.loading) {
            return;
        }

        state.loading = true;

        showSkeleton(true);

        hideEmpty();

        try {

            const snapshot =
                await Promise.race([

                    db
                        .ref(CONFIG.SHORTS_PATH)
                        .limitToLast(CONFIG.MAX_FEED)
                        .once("value"),

                    new Promise((_, reject) => {

                        setTimeout(() => {

                            reject(
                                new Error(
                                    "SHORTS_LOAD_TIMEOUT"
                                )
                            );

                        }, CONFIG.LOAD_TIMEOUT);

                    })

                ]);


            const data =
                snapshot.val() || {};

            state.shorts =
                Object.entries(data)

                    .map(([id, value]) => ({

                        id,

                        ...(value || {})

                    }))

                    .filter(short => {

                        return (
                            short &&
                            !isHidden(short) &&
                            Boolean(
                                getVideoURL(short)
                            )
                        );

                    })

                    .sort((a, b) => {

                        return (
                            getCreatedAt(b) -
                            getCreatedAt(a)
                        );

                    });


            state.filteredShorts =
                [...state.shorts];


            renderFeed();


            /*
             * Start realtime listener AFTER initial load.
             */

            startRealtimeShortListener();

        } catch (error) {

            console.error(
                "Viewora Shorts load error:",
                error
            );

            container.innerHTML = "";

            showEmpty();

            showToast(
                error?.message ===
                "SHORTS_LOAD_TIMEOUT"
                    ? "Loading timed out. Tap retry."
                    : "Unable to load Shorts",
                "error"
            );

        } finally {

            state.loading = false;

            showSkeleton(false);

        }

    }


    /* =========================================================
       REALTIME SHORT LISTENER
    ========================================================= */

    function startRealtimeShortListener() {

        if (state.shortListener) {
            return;
        }

        state.shortListener =
            snapshot => {

                const data =
                    snapshot.val() || {};

                const realtime =
                    Object.entries(data)

                        .map(([id, value]) => ({

                            id,

                            ...(value || {})

                        }))

                        .filter(short => {

                            return (
                                short &&
                                !isHidden(short) &&
                                Boolean(
                                    getVideoURL(short)
                                )
                            );

                        })

                        .sort((a, b) => {

                            return (
                                getCreatedAt(b) -
                                getCreatedAt(a)
                            );

                        });


                state.shorts =
                    realtime;


                applySearchAndRender();

            };


        db
            .ref(CONFIG.SHORTS_PATH)
            .limitToLast(CONFIG.MAX_FEED)
            .on(
                "value",
                state.shortListener,
                error => {

                    console.warn(
                        "Realtime Shorts listener:",
                        error
                    );

                }
            );

    }


    /* =========================================================
       SEARCH
    ========================================================= */

    function applySearchAndRender() {

        const query =
            state.searchText;

        if (!query) {

            state.filteredShorts =
                [...state.shorts];

        } else {

            state.filteredShorts =
                state.shorts.filter(short => {

                    const searchable =
                        [

                            getUserName(short),

                            getCaption(short),

                            short.music,

                            short.audioName,

                            short.hashtags,

                            short.title

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();

                    return searchable.includes(
                        query
                    );

                });

        }

        renderFeed();

    }


    function performSearch(value) {

        clearTimeout(
            state.searchTimer
        );

        state.searchTimer =
            setTimeout(() => {

                state.searchText =
                    String(value || "")
                        .trim()
                        .toLowerCase();

                applySearchAndRender();

            }, CONFIG.SEARCH_DEBOUNCE);

    }


    /* =========================================================
       RENDER FEED
    ========================================================= */

    function renderFeed() {

        if (!container) {
            return;
        }

        if (!state.filteredShorts.length) {

            container.innerHTML = "";

            showEmpty();

            return;

        }

        hideEmpty();

        /*
         * Preserve current playing short when realtime
         * data updates.
         */

        const previousId =
            state.currentShortId;


        container.innerHTML = "";


        const fragment =
            document.createDocumentFragment();


        state.filteredShorts.forEach(
            (short, index) => {

                const card =
                    createShortCard(
                        short,
                        index
                    );

                fragment.appendChild(
                    card
                );

            }
        );


        container.appendChild(
            fragment
        );


        setupVideoEvents();

        setupObserver();


        /*
         * If currently visible short still exists,
         * restore it.
         */

        if (previousId) {

            const card =
                container.querySelector(
                    `.shortCard[data-short-id="${CSS.escape(previousId)}"]`
                );

            if (card) {

                state.currentShortIndex =
                    Number(
                        card.dataset.index
                    );

                const video =
                    card.querySelector(
                        ".shortVideo"
                    );

                if (video) {

                    setTimeout(() => {

                        playVideo(video);

                    }, 80);

                }

                return;

            }

        }


        updateCurrentIndex();

    }


    function showSkeleton(show) {

        skeleton?.classList.toggle(
            "hidden",
            !show
        );

    }


    function showEmpty() {

        emptyState?.classList.remove(
            "hidden"
        );

    }


    function hideEmpty() {

        emptyState?.classList.add(
            "hidden"
        );

    }


    /* =========================================================
       CREATE SHORT CARD
    ========================================================= */

    function createShortCard(
        short,
        index
    ) {

        const card =
            document.createElement("article");

        card.className =
            "shortCard";

        card.dataset.shortId =
            short.id;

        card.dataset.index =
            String(index);


        const ownerId =
            getUserId(short);


        const currentUid =
            state.currentUser?.uid || "";


        const isOwner =
            Boolean(
                currentUid &&
                ownerId === currentUid
            );


        const likeCount =
            safeNumber(
                short.likeCount ??
                short.likesCount ??
                countObject(short.likes)
            );


        const commentCount =
            safeNumber(
                short.commentCount ??
                short.commentsCount ??
                0
            );


        const shareCount =
            safeNumber(
                short.shareCount ??
                short.sharesCount ??
                0
            );


        const saveCount =
            safeNumber(
                short.saveCount ??
                short.savesCount ??
                0
            );


        const liked =
            Boolean(
                currentUid &&
                short.likes &&
                short.likes[currentUid]
            );


        const saved =
            Boolean(
                currentUid &&
                short.saves &&
                short.saves[currentUid]
            );


        const videoURL =
            getVideoURL(short);


        const commentsOff =
            commentsDisabled(short);


        const hideLikes =
            likesHidden(short);


        const music =
            short.music ||
            short.audioName ||
            short.audioTitle ||
            "Original audio";


        card.innerHTML = `

            <video
                class="shortVideo"
                playsinline
                loop
                muted
                preload="${index < 2 ? "auto" : "metadata"}"
                src="${escapeHTML(videoURL)}"
            ></video>


            <div class="shortVideoShade"></div>


            <div class="playOverlay">
                <i class="fa-solid fa-play"></i>
            </div>


            <button
                type="button"
                class="volumeBtn"
                aria-label="Toggle sound"
            >
                <i class="fa-solid fa-volume-xmark"></i>
            </button>


            <button
                type="button"
                class="moreBtn"
                aria-label="More options"
            >
                <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>


            <div class="shortContent">


                <div class="creatorRow">


                    <div
                        class="creatorProfile"
                        data-user-id="${escapeHTML(ownerId)}"
                    >

                        <img
                            class="creatorAvatar"
                            src="${escapeHTML(getAvatar(short))}"
                            alt=""
                            loading="lazy"
                            onerror="this.src='assets/default-avatar.png'"
                        >


                        <div class="creatorInfo">

                            <strong class="shortUsername">
                                ${escapeHTML(
                                    getUserName(short)
                                )}
                            </strong>

                            ${
                                short.verified === true ||
                                short.isVerified === true
                                ? `
                                    <span class="verifiedBadge">
                                        <i class="fa-solid fa-circle-check"></i>
                                    </span>
                                `
                                : ""
                            }

                        </div>

                    </div>


                    ${
                        currentUid &&
                        ownerId &&
                        currentUid !== ownerId
                            ? `
                                <button
                                    type="button"
                                    class="followBtn"
                                    data-follow-uid="${escapeHTML(ownerId)}"
                                >
                                    Follow
                                </button>
                            `
                            : ""
                    }

                </div>


                ${
                    getCaption(short)
                        ? `
                            <p class="shortCaption">
                                ${escapeHTML(
                                    getCaption(short)
                                )}
                            </p>
                        `
                        : ""
                }


                ${
                    short.hashtags
                        ? `
                            <div class="shortHashtags">
                                ${escapeHTML(
                                    Array.isArray(short.hashtags)
                                        ? short.hashtags.join(" ")
                                        : short.hashtags
                                )}
                            </div>
                        `
                        : ""
                }


                <div class="shortMusic">

                    <i class="fa-solid fa-music"></i>

                    <span>
                        ${escapeHTML(music)}
                    </span>

                </div>


                ${
                    short.createdAt
                        ? `
                            <div class="shortTime">
                                ${formatTime(
                                    short.createdAt
                                )}
                            </div>
                        `
                        : ""
                }

            </div>


            <div class="shortActions">


                <button
                    type="button"
                    class="shortAction likeBtn ${liked ? "liked" : ""}"
                    data-action="like"
                    aria-label="Like"
                >

                    <i class="${
                        liked
                            ? "fa-solid fa-heart"
                            : "fa-regular fa-heart"
                    }"></i>

                    <span
                        class="likeCount ${
                            hideLikes ? "hidden" : ""
                        }"
                    >
                        ${formatCount(likeCount)}
                    </span>

                </button>


                <button
                    type="button"
                    class="shortAction commentBtn ${
                        commentsOff ? "commentsDisabled" : ""
                    }"
                    data-action="comment"
                    aria-label="Comments"
                >

                    <i class="fa-regular fa-comment"></i>

                    <span>
                        ${formatCount(commentCount)}
                    </span>

                </button>


                <button
                    type="button"
                    class="shortAction shareBtn"
                    data-action="share"
                    aria-label="Share"
                >

                    <i class="fa-solid fa-share"></i>

                    <span>
                        ${formatCount(shareCount)}
                    </span>

                </button>


                <button
                    type="button"
                    class="shortAction saveBtn ${
                        saved ? "saved" : ""
                    }"
                    data-action="save"
                    aria-label="Save"
                >

                    <i class="${
                        saved
                            ? "fa-solid fa-bookmark"
                            : "fa-regular fa-bookmark"
                    }"></i>

                    <span>
                        ${saved ? "Saved" : "Save"}
                    </span>

                </button>


                <div class="musicDisc">

                    <i class="fa-solid fa-music"></i>

                </div>

            </div>


            <div class="shortProgress">
                <span></span>
            </div>

        `;


        /*
         * Owner-specific realtime UI listeners
         */

        if (currentUid) {

            attachLikeListener(
                short.id,
                card
            );

            attachSaveListener(
                short.id,
                card
            );

        }


        if (
            currentUid &&
            ownerId &&
            currentUid !== ownerId
        ) {

            attachFollowListener(
                ownerId,
                card
            );

        }


        return card;

    }


    /* =========================================================
       VIDEO EVENTS
    ========================================================= */

    function setupVideoEvents() {

        if (!container) {
            return;
        }


        container
            .querySelectorAll(".shortVideo")
            .forEach(video => {

                video.onclick =
                    event => {

                        event.stopPropagation();

                        toggleVideo(video);

                    };


                video.ontimeupdate =
                    () => {

                        updateProgress(video);

                    };


                video.onended =
                    () => {

                        playNext();

                    };


                video.onerror =
                    () => {

                        console.warn(
                            "Short video failed:",
                            video.src
                        );

                    };

            });


        container
            .querySelectorAll(".volumeBtn")
            .forEach(button => {

                button.onclick =
                    event => {

                        event.stopPropagation();

                        toggleMute();

                    };

            });


        container
            .querySelectorAll(".moreBtn")
            .forEach(button => {

                button.onclick =
                    event => {

                        event.stopPropagation();

                        const card =
                            button.closest(
                                ".shortCard"
                            );

                        if (!card) {
                            return;
                        }

                        openShortMenu(
                            card.dataset.shortId
                        );

                    };

            });


        container
            .querySelectorAll(".shortAction")
            .forEach(button => {

                button.onclick =
                    event => {

                        event.stopPropagation();

                        const card =
                            button.closest(
                                ".shortCard"
                            );

                        if (!card) {
                            return;
                        }

                        const shortId =
                            card.dataset.shortId;

                        const action =
                            button.dataset.action;


                        if (action === "like") {

                            toggleLike(
                                shortId,
                                button
                            );

                        }


                        if (action === "comment") {

                            openComments(
                                shortId
                            );

                        }


                        if (action === "share") {

                            openShare(
                                shortId
                            );

                        }


                        if (action === "save") {

                            toggleSave(
                                shortId,
                                button
                            );

                        }

                    };

            });


        container
            .querySelectorAll(".creatorProfile")
            .forEach(profile => {

                profile.onclick =
                    event => {

                        event.stopPropagation();

                        openProfile(
                            profile.dataset.userId
                        );

                    };

            });


        container
            .querySelectorAll(".followBtn")
            .forEach(button => {

                button.onclick =
                    event => {

                        event.stopPropagation();

                        toggleFollow(
                            button.dataset.followUid,
                            button
                        );

                    };

            });

    }


    /* =========================================================
       VIDEO PLAYBACK
    ========================================================= */

    function toggleVideo(video) {

        if (!video) {
            return;
        }

        if (video.paused) {

            playVideo(video);

        } else {

            video.pause();

            showPlayOverlay(
                video.closest(".shortCard"),
                true
            );

        }

    }


    function playVideo(video) {

        if (!video) {
            return;
        }


        document
            .querySelectorAll(".shortVideo")
            .forEach(other => {

                if (other !== video) {

                    other.pause();

                    showPlayOverlay(
                        other.closest(".shortCard"),
                        true
                    );

                }

            });


        video.muted =
            state.muted;


        video.play()
            .then(() => {

                state.currentVideo =
                    video;

                showPlayOverlay(
                    video.closest(".shortCard"),
                    false
                );

                updateVolumeIcons();

            })
            .catch(error => {

                console.warn(
                    "Autoplay blocked:",
                    error
                );

                showPlayOverlay(
                    video.closest(".shortCard"),
                    true
                );

            });

    }


    function showPlayOverlay(
        card,
        visible
    ) {

        const overlay =
            card?.querySelector(
                ".playOverlay"
            );

        if (!overlay) {
            return;
        }

        overlay.classList.toggle(
            "show",
            Boolean(visible)
        );

    }


    function updateProgress(video) {

        if (
            !video.duration ||
            !Number.isFinite(video.duration)
        ) {
            return;
        }

        const card =
            video.closest(
                ".shortCard"
            );

        const bar =
            card?.querySelector(
                ".shortProgress span"
            );

        if (!bar) {
            return;
        }

        const percentage =
            (
                video.currentTime /
                video.duration
            ) * 100;


        bar.style.width =
            `${percentage}%`;

    }


    function toggleMute() {

        state.muted =
            !state.muted;

        document
            .querySelectorAll(".shortVideo")
            .forEach(video => {

                video.muted =
                    state.muted;

            });

        updateVolumeIcons();

    }


    function updateVolumeIcons() {

        document
            .querySelectorAll(".volumeBtn i")
            .forEach(icon => {

                icon.className =
                    state.muted
                        ? "fa-solid fa-volume-xmark"
                        : "fa-solid fa-volume-high";

            });

    }


    /* =========================================================
       OBSERVER
    ========================================================= */

    function setupObserver() {

        state.observer?.disconnect();


        state.observer =
            new IntersectionObserver(
                entries => {

                    let bestEntry =
                        null;


                    entries.forEach(entry => {

                        if (
                            entry.isIntersecting &&
                            entry.intersectionRatio >= 0.65
                        ) {

                            if (
                                !bestEntry ||
                                entry.intersectionRatio >
                                bestEntry.intersectionRatio
                            ) {

                                bestEntry =
                                    entry;

                            }

                        }

                    });


                    if (!bestEntry) {
                        return;
                    }


                    const card =
                        bestEntry.target;

                    const video =
                        card.querySelector(
                            ".shortVideo"
                        );


                    state.currentShortId =
                        card.dataset.shortId;


                    state.currentShortIndex =
                        Number(
                            card.dataset.index
                        );


                    playVideo(video);


                    registerView(
                        state.currentShortId
                    );

                },
                {
                    threshold: [
                        0.25,
                        0.65,
                        0.85,
                        1
                    ]
                }
            );


        container
            ?.querySelectorAll(".shortCard")
            .forEach(card => {

                state.observer.observe(
                    card
                );

            });

    }


    function updateCurrentIndex() {

        const first =
            container?.querySelector(
                ".shortCard"
            );

        if (!first) {
            return;
        }


        state.currentShortId =
            first.dataset.shortId;


        state.currentShortIndex =
            Number(
                first.dataset.index
            );


        const video =
            first.querySelector(
                ".shortVideo"
            );


        setTimeout(() => {

            playVideo(video);

            registerView(
                first.dataset.shortId
            );

        }, 180);

    }


    /* =========================================================
       NEXT SHORT
    ========================================================= */

    function playNext() {

        const nextIndex =
            state.currentShortIndex + 1;


        if (
            nextIndex >=
            state.filteredShorts.length
        ) {

            return;

        }


        const nextCard =
            container?.querySelector(
                `.shortCard[data-index="${nextIndex}"]`
            );


        if (!nextCard) {
            return;
        }


        nextCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }


    /* =========================================================
       VIEWS
    ========================================================= */

    function registerView(shortId) {

        if (!shortId) {
            return;
        }


        if (state.viewed[shortId]) {
            return;
        }


        state.viewed[shortId] =
            true;


        clearTimeout(
            state.viewTimers[shortId]
        );


        state.viewTimers[shortId] =
            setTimeout(async () => {

                try {

                    await db
                        .ref(
                            `${CONFIG.SHORTS_PATH}/${shortId}/views`
                        )
                        .transaction(
                            current => {

                                return (
                                    safeNumber(current) +
                                    1
                                );

                            }
                        );

                } catch (error) {

                    console.warn(
                        "View update failed:",
                        error
                    );

                }

            }, CONFIG.VIEW_DELAY);

    }


    /* =========================================================
       REALTIME LIKE LISTENER
    ========================================================= */

    function attachLikeListener(
        shortId,
        card
    ) {

        if (
            !shortId ||
            !state.currentUser ||
            !card
        ) {
            return;
        }


        const uid =
            state.currentUser.uid;


        const key =
            `${shortId}:${uid}`;


        if (state.likeListeners[key]) {
            return;
        }


        const ref =
            db.ref(
                `${CONFIG.SHORTS_PATH}/${shortId}/likes/${uid}`
            );


        const listener =
            snapshot => {

                const button =
                    card.querySelector(
                        ".likeBtn"
                    );

                if (!button) {
                    return;
                }


                updateLikeVisual(
                    button,
                    snapshot.exists()
                );

            };


        state.likeListeners[key] =
            listener;


        ref.on(
            "value",
            listener
        );

    }


    function updateLikeVisual(
        button,
        liked
    ) {

        button.classList.toggle(
            "liked",
            liked
        );


        const icon =
            button.querySelector("i");


        if (icon) {

            icon.className =
                liked
                    ? "fa-solid fa-heart"
                    : "fa-regular fa-heart";

        }

    }


    /* =========================================================
       LIKE
    ========================================================= */

    async function toggleLike(
        shortId,
        button
    ) {

        if (!state.currentUser) {

            openLogin();

            return;

        }


        const uid =
            state.currentUser.uid;


        const ref =
            db.ref(
                `${CONFIG.SHORTS_PATH}/${shortId}/likes/${uid}`
            );


        try {

            const snapshot =
                await ref.once("value");


            const alreadyLiked =
                snapshot.exists();


            if (alreadyLiked) {

                await ref.remove();


                await decrementCounter(
                    `${CONFIG.SHORTS_PATH}/${shortId}/likeCount`
                );


                updateLikeVisual(
                    button,
                    false
                );


            } else {

                await ref.set({

                    uid,

                    createdAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                });


                await incrementCounter(
                    `${CONFIG.SHORTS_PATH}/${shortId}/likeCount`
                );


                updateLikeVisual(
                    button,
                    true
                );


                playHeart();

            }


            refreshButtonCount(
                button,
                alreadyLiked ? -1 : 1
            );


        } catch (error) {

            console.error(
                "Like error:",
                error
            );

            showToast(
                "Could not update like",
                "error"
            );

        }

    }


    /* =========================================================
       SAVE
    ========================================================= */

    function attachSaveListener(
        shortId,
        card
    ) {

        if (
            !shortId ||
            !state.currentUser ||
            !card
        ) {
            return;
        }


        const uid =
            state.currentUser.uid;


        const key =
            `${shortId}:${uid}`;


        if (state.saveListeners[key]) {
            return;
        }


        const ref =
            db.ref(
                `${CONFIG.SHORTS_PATH}/${shortId}/saves/${uid}`
            );


        const listener =
            snapshot => {

                const button =
                    card.querySelector(
                        ".saveBtn"
                    );

                if (!button) {
                    return;
                }


                const saved =
                    snapshot.exists();


                button.classList.toggle(
                    "saved",
                    saved
                );


                const icon =
                    button.querySelector("i");


                if (icon) {

                    icon.className =
                        saved
                            ? "fa-solid fa-bookmark"
                            : "fa-regular fa-bookmark";

                }


                const label =
                    button.querySelector("span");


                if (label) {

                    label.textContent =
                        saved
                            ? "Saved"
                            : "Save";

                }

            };


        state.saveListeners[key] =
            listener;


        ref.on(
            "value",
            listener
        );

    }


    async function toggleSave(
        shortId,
        button
    ) {

        if (!state.currentUser) {

            openLogin();

            return;

        }


        const uid =
            state.currentUser.uid;


        const ref =
            db.ref(
                `${CONFIG.SHORTS_PATH}/${shortId}/saves/${uid}`
            );


        try {

            const snapshot =
                await ref.once("value");


            const saved =
                snapshot.exists();


            if (saved) {

                await ref.remove();

                await decrementCounter(
                    `${CONFIG.SHORTS_PATH}/${shortId}/saveCount`
                );


                updateSaveVisual(
                    button,
                    false
                );


                showToast(
                    "Removed from saved"
                );

            } else {

                await ref.set({

                    uid,

                    createdAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                });


                await incrementCounter(
                    `${CONFIG.SHORTS_PATH}/${shortId}/saveCount`
                );


                updateSaveVisual(
                    button,
                    true
                );


                showToast(
                    "Saved to profile"
                );

            }

        } catch (error) {

            console.error(
                "Save error:",
                error
            );

            showToast(
                "Could not update save",
                "error"
            );

        }

    }


    function updateSaveVisual(
        button,
        saved
    ) {

        if (!button) {
            return;
        }


        button.classList.toggle(
            "saved",
            saved
        );


        const icon =
            button.querySelector("i");


        if (icon) {

            icon.className =
                saved
                    ? "fa-solid fa-bookmark"
                    : "fa-regular fa-bookmark";

        }


        const label =
            button.querySelector("span");


        if (label) {

            label.textContent =
                saved
                    ? "Saved"
                    : "Save";

        }

    }


    /* =========================================================
       FOLLOW LISTENER
    ========================================================= */

    function attachFollowListener(
        targetUid,
        card
    ) {

        if (
            !targetUid ||
            !state.currentUser ||
            !card
        ) {
            return;
        }


        const uid =
            state.currentUser.uid;


        const key =
            `${targetUid}:${uid}`;


        if (state.followListeners[key]) {
            return;
        }


        const ref =
            db.ref(
                `${CONFIG.FOLLOWERS_PATH}/${targetUid}/${uid}`
            );


        const listener =
            snapshot => {

                const button =
                    card.querySelector(
                        ".followBtn"
                    );


                if (!button) {
                    return;
                }


                button.textContent =
                    snapshot.exists()
                        ? "Following"
                        : "Follow";


                button.classList.toggle(
                    "following",
                    snapshot.exists()
                );

            };


        state.followListeners[key] =
            listener;


        ref.on(
            "value",
            listener
        );

    }


    /* =========================================================
       FOLLOW / UNFOLLOW
    ========================================================= */

    async function toggleFollow(
        targetUid,
        button
    ) {

        if (!state.currentUser) {

            openLogin();

            return;

        }


        const uid =
            state.currentUser.uid;


        if (
            !targetUid ||
            targetUid === uid
        ) {
            return;
        }


        const followerRef =
            db.ref(
                `${CONFIG.FOLLOWERS_PATH}/${targetUid}/${uid}`
            );


        const followingRef =
            db.ref(
                `${CONFIG.FOLLOWING_PATH}/${uid}/${targetUid}`
            );


        try {

            const snapshot =
                await followerRef.once("value");


            const following =
                snapshot.exists();


            /*
             * Multi-location update.
             * Both sides stay synchronized.
             */

            if (following) {

                const updates = {};

                updates[
                    `${CONFIG.FOLLOWERS_PATH}/${targetUid}/${uid}`
                ] = null;

                updates[
                    `${CONFIG.FOLLOWING_PATH}/${uid}/${targetUid}`
                ] = null;


                await db.ref().update(
                    updates
                );


                if (button) {
                    button.textContent =
                        "Follow";

                    button.classList.remove(
                        "following"
                    );
                }


                showToast(
                    "Unfollowed"
                );


            } else {

                const timestamp =
                    firebase.database
                        .ServerValue
                        .TIMESTAMP;


                const updates = {};


                updates[
                    `${CONFIG.FOLLOWERS_PATH}/${targetUid}/${uid}`
                ] = {

                    uid,

                    createdAt:
                        timestamp

                };


                updates[
                    `${CONFIG.FOLLOWING_PATH}/${uid}/${targetUid}`
                ] = {

                    uid: targetUid,

                    createdAt:
                        timestamp

                };


                await db.ref().update(
                    updates
                );


                if (button) {
                    button.textContent =
                        "Following";

                    button.classList.add(
                        "following"
                    );
                }


                showToast(
                    "Following"
                );

            }

        } catch (error) {

            console.error(
                "Follow error:",
                error
            );

            showToast(
                "Could not update follow",
                "error"
            );

        }

    }


    /* =========================================================
       COMMENTS
    ========================================================= */

    function openComments(
        shortId
    ) {

        const short =
            getShort(shortId);


        if (
            short &&
            commentsDisabled(short)
        ) {

            showToast(
                "Comments are turned off",
                "error"
            );

            return;

        }


        state.commentShortId =
            shortId;


        const modal =
            $("commentsModal");


        if (!modal) {
            return;
        }


        modal.classList.remove(
            "hidden"
        );


        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.classList.add(
            "modalOpen"
        );


        loadComments(
            shortId
        );

    }


    function closeComments() {

        const modal =
            $("commentsModal");


        modal?.classList.add(
            "hidden"
        );


        modal?.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.classList.remove(
            "modalOpen"
        );


        if (
            state.commentListener &&
            state.commentShortId
        ) {

            db.ref(
                `${CONFIG.COMMENTS_PATH}/${state.commentShortId}`
            ).off(
                "value",
                state.commentListener
            );

        }


        state.commentListener =
            null;

        state.commentShortId =
            null;

    }


    function loadComments(
        shortId
    ) {

        const list =
            $("commentsContainer");


        if (!list) {
            return;
        }


        list.innerHTML = `

            <div class="commentsLoading">

                <div class="loadingSpinner"></div>

                <span>
                    Loading comments...
                </span>

            </div>

        `;


        const ref =
            db.ref(
                `${CONFIG.COMMENTS_PATH}/${shortId}`
            );


        if (state.commentListener) {

            ref.off(
                "value",
                state.commentListener
            );

        }


        state.commentListener =
            snapshot => {

                const data =
                    snapshot.val() || {};


                const comments =
                    Object.entries(data)

                        .map(([id, value]) => ({

                            id,

                            ...(value || {})

                        }))

                        .filter(comment =>
                            comment &&
                            !comment.deleted
                        )

                        .sort((a, b) => {

                            return (
                                safeNumber(
                                    a.createdAt
                                ) -
                                safeNumber(
                                    b.createdAt
                                )
                            );

                        })

                        .slice(
                            -CONFIG.MAX_COMMENTS
                        );


                renderComments(
                    comments
                );


                updateCommentCount(
                    comments.length
                );

            };


        ref.on(
            "value",
            state.commentListener,
            error => {

                console.error(
                    "Comment realtime error:",
                    error
                );

                list.innerHTML = `

                    <div class="noComments">
                        Unable to load comments.
                    </div>

                `;

            }
        );

    }


    function renderComments(
        comments
    ) {

        const list =
            $("commentsContainer");


        if (!list) {
            return;
        }


        if (!comments.length) {

            list.innerHTML = `

                <div class="noComments">

                    <i class="fa-regular fa-comment"></i>

                    <strong>
                        No comments yet
                    </strong>

                    <span>
                        Be the first to comment.
                    </span>

                </div>

            `;

            return;

        }


        list.innerHTML =
            comments
                .map(comment => {

                    const commentUid =
                        comment.uid ||
                        comment.userId ||
                        "";


                    const isOwn =
                        state.currentUser &&
                        commentUid ===
                        state.currentUser.uid;


                    return `

                        <div
                            class="commentItem"
                            data-comment-id="${escapeHTML(comment.id)}"
                        >

                            <img
                                src="${escapeHTML(getAvatar(comment))}"
                                alt=""
                                onerror="this.src='assets/default-avatar.png'"
                            >


                            <div class="commentBody">

                                <strong>
                                    ${escapeHTML(
                                        getUserName(comment)
                                    )}
                                </strong>


                                <p>
                                    ${escapeHTML(
                                        comment.text ||
                                        comment.comment ||
                                        ""
                                    )}
                                </p>


                                <small>
                                    ${formatTime(
                                        comment.createdAt
                                    )}
                                </small>


                                ${
                                    isOwn
                                        ? `
                                            <button
                                                type="button"
                                                class="deleteCommentBtn"
                                                data-comment-id="${escapeHTML(comment.id)}"
                                            >
                                                Delete
                                            </button>
                                        `
                                        : ""
                                }

                            </div>

                        </div>

                    `;

                })
                .join("");


        list
            .querySelectorAll(
                ".deleteCommentBtn"
            )
            .forEach(button => {

                button.onclick =
                    () => {

                        deleteComment(
                            state.commentShortId,
                            button.dataset.commentId
                        );

                    };

            });

    }


    function updateCommentCount(
        count
    ) {

        const element =
            $("commentCountText");


        if (!element) {
            return;
        }


        element.textContent =
            count
                ? `${formatCount(count)} comments`
                : "Join the conversation";

    }


    /* =========================================================
       SEND COMMENT
    ========================================================= */

    async function sendComment() {

        if (!state.currentUser) {

            openLogin();

            return;

        }


        const shortId =
            state.commentShortId;


        if (!shortId) {
            return;
        }


        const short =
            getShort(shortId);


        if (
            short &&
            commentsDisabled(short)
        ) {

            showToast(
                "Comments are turned off",
                "error"
            );

            return;

        }


        const input =
            $("commentText");


        const text =
            input?.value
                ?.trim();


        if (!text) {
            return;
        }


        try {

            const commentRef =
                db
                    .ref(
                        `${CONFIG.COMMENTS_PATH}/${shortId}`
                    )
                    .push();


            const user =
                state.currentUser;


            await commentRef.set({

                uid:
                    user.uid,

                userId:
                    user.uid,

                username:
                    user.displayName ||
                    "Viewora User",

                avatar:
                    user.photoURL ||
                    "assets/default-avatar.png",

                text,

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP

            });


            await incrementCounter(
                `${CONFIG.SHORTS_PATH}/${shortId}/commentCount`
            );


            input.value = "";


            showToast(
                "Comment added"
            );

        } catch (error) {

            console.error(
                "Comment error:",
                error
            );

            showToast(
                "Could not post comment",
                "error"
            );

        }

    }


    /* =========================================================
       DELETE COMMENT
    ========================================================= */

    async function deleteComment(
        shortId,
        commentId
    ) {

        if (
            !state.currentUser ||
            !shortId ||
            !commentId
        ) {
            return;
        }


        const ref =
            db.ref(
                `${CONFIG.COMMENTS_PATH}/${shortId}/${commentId}`
            );


        try {

            const snapshot =
                await ref.once("value");


            const comment =
                snapshot.val();


            if (!comment) {
                return;
            }


            const owner =
                comment.uid ||
                comment.userId;


            if (
                owner !==
                state.currentUser.uid
            ) {

                showToast(
                    "You cannot delete this comment",
                    "error"
                );

                return;

            }


            await ref.remove();


            await decrementCounter(
                `${CONFIG.SHORTS_PATH}/${shortId}/commentCount`
            );


            showToast(
                "Comment deleted"
            );

        } catch (error) {

            console.error(
                "Delete comment error:",
                error
            );

            showToast(
                "Could not delete comment",
                "error"
            );

        }

    }


    /* =========================================================
       SHARE
    ========================================================= */

    function openShare(
        shortId
    ) {

        state.shareShortId =
            shortId;


        const modal =
            $("shareModal");


        if (!modal) {
            return;
        }


        modal.classList.remove(
            "hidden"
        );


        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.classList.add(
            "modalOpen"
        );

    }


    function closeShare() {

        $("shareModal")
            ?.classList.add(
                "hidden"
            );


        $("shareModal")
            ?.setAttribute(
                "aria-hidden",
                "true"
            );


        document.body.classList.remove(
            "modalOpen"
        );


        state.shareShortId =
            null;

    }


    function getShareURL(shortId) {

        return (
            window.location.origin +
            window.location.pathname.replace(
                /[^/]+$/,
                ""
            ) +
            `shorts.html?short=${encodeURIComponent(shortId)}`
        );

    }


    async function shareShort(
        type
    ) {

        const shortId =
            state.shareShortId;


        if (!shortId) {
            return;
        }


        const url =
            getShareURL(shortId);


        const short =
            getShort(shortId);


        const title =
            getCaption(short) ||
            "Watch this Short on Viewora";


        try {

            if (
                type === "native" &&
                navigator.share
            ) {

                await navigator.share({

                    title:
                        "Viewora Short",

                    text:
                        title,

                    url

                });


            } else if (
                type === "copy"
            ) {

                await copyText(url);

                showToast(
                    "Link copied"
                );


            } else if (
                type === "whatsapp"
            ) {

                window.open(
                    "https://wa.me/?text=" +
                    encodeURIComponent(
                        `${title}\n${url}`
                    ),
                    "_blank"
                );


            } else if (
                type === "facebook"
            ) {

                window.open(
                    "https://www.facebook.com/sharer/sharer.php?u=" +
                    encodeURIComponent(url),
                    "_blank"
                );


            } else if (
                type === "x"
            ) {

                window.open(
                    "https://twitter.com/intent/tweet?text=" +
                    encodeURIComponent(title) +
                    "&url=" +
                    encodeURIComponent(url),
                    "_blank"
                );

            }


            await incrementCounter(
                `${CONFIG.SHORTS_PATH}/${shortId}/shareCount`
            );


        } catch (error) {

            if (
                error?.name !==
                "AbortError"
            ) {

                console.error(
                    "Share error:",
                    error
                );

            }

        }

    }


    async function copyText(text) {

        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {

            await navigator.clipboard.writeText(
                text
            );

            return;

        }


        const textarea =
            document.createElement(
                "textarea"
            );


        textarea.value =
            text;


        textarea.style.position =
            "fixed";

        textarea.style.opacity =
            "0";


        document.body.appendChild(
            textarea
        );


        textarea.focus();

        textarea.select();


        try {

            document.execCommand(
                "copy"
            );

        } finally {

            textarea.remove();

        }

    }


    /* =========================================================
       THREE DOT MENU
    ========================================================= */

    function openShortMenu(
        shortId
    ) {

        const menu =
            $("shortMenu");


        if (!menu) {
            return;
        }


        const short =
            getShort(shortId);


        if (!short) {
            return;
        }


        state.menuShortId =
            shortId;


        const ownerId =
            getUserId(short);


        const isOwner =
            Boolean(
                state.currentUser &&
                ownerId ===
                state.currentUser.uid
            );


        const ownerMenu =
            $("ownerMenu");


        const viewerMenu =
            $("viewerMenu");


        ownerMenu?.classList.toggle(
            "hidden",
            !isOwner
        );


        viewerMenu?.classList.toggle(
            "hidden",
            isOwner
        );


        updateOwnerMenuText(
            short
        );


        menu.classList.remove(
            "hidden"
        );


        menu.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.classList.add(
            "modalOpen"
        );

    }


    function closeShortMenu() {

        $("shortMenu")
            ?.classList.add(
                "hidden"
            );


        $("shortMenu")
            ?.setAttribute(
                "aria-hidden",
                "true"
            );


        state.menuShortId =
            null;


        document.body.classList.remove(
            "modalOpen"
        );

    }


    function updateOwnerMenuText(
        short
    ) {

        const hideBtn =
            $("hideShortBtn");


        const commentsBtn =
            $("disableCommentsBtn");


        const likesBtn =
            $("hideLikeCountBtn");


        if (hideBtn) {

            const strong =
                hideBtn.querySelector(
                    "strong"
                );

            const small =
                hideBtn.querySelector(
                    "small"
                );


            if (strong) {

                strong.textContent =
                    isHidden(short)
                        ? "Show Short"
                        : "Hide Short";

            }


            if (small) {

                small.textContent =
                    isHidden(short)
                        ? "Make this Short visible"
                        : "Hide this Short from viewers";

            }

        }


        if (commentsBtn) {

            const strong =
                commentsBtn.querySelector(
                    "strong"
                );


            const small =
                commentsBtn.querySelector(
                    "small"
                );


            if (strong) {

                strong.textContent =
                    commentsDisabled(short)
                        ? "Turn on comments"
                        : "Turn off comments";

            }


            if (small) {

                small.textContent =
                    commentsDisabled(short)
                        ? "Allow people to comment"
                        : "Stop people from commenting";

            }

        }


        if (likesBtn) {

            const strong =
                likesBtn.querySelector(
                    "strong"
                );


            const small =
                likesBtn.querySelector(
                    "small"
                );


            if (strong) {

                strong.textContent =
                    likesHidden(short)
                        ? "Show like count"
                        : "Hide like count";

            }


            if (small) {

                small.textContent =
                    likesHidden(short)
                        ? "Show the number of likes"
                        : "Hide the number of likes";

            }

        }

    }


    /* =========================================================
       EDIT SHORT
    ========================================================= */

    function editCurrentShort() {

        const id =
            state.menuShortId;


        if (!id) {
            return;
        }


        const short =
            getShort(id);


        if (!short) {
            return;
        }


        const ownerId =
            getUserId(short);


        if (
            !state.currentUser ||
            ownerId !==
            state.currentUser.uid
        ) {

            showToast(
                "You can only edit your own Short",
                "error"
            );

            return;

        }


        /*
         * IMPORTANT:
         * New edit flow:
         * edit-shorts.html?shortId=YOUR_ID
         */

        try {

            sessionStorage.setItem(
                "vieworaEditShortId",
                id
            );

        } catch (_) {}


        try {

            localStorage.setItem(
                "vieworaEditShortId",
                id
            );

        } catch (_) {}


        window.location.href =
            `edit-shorts.html?shortId=${encodeURIComponent(id)}`;

    }


    /* =========================================================
       HIDE / SHOW SHORT
    ========================================================= */

    async function toggleHideCurrentShort() {

        const id =
            state.menuShortId;


        if (!id) {
            return;
        }


        const short =
            getShort(id);


        if (!short) {
            return;
        }


        if (!isOwner(short)) {

            showToast(
                "You cannot change this Short",
                "error"
            );

            return;

        }


        const currentlyHidden =
            isHidden(short);


        try {

            await db
                .ref(
                    `${CONFIG.SHORTS_PATH}/${id}/hidden`
                )
                .set(
                    !currentlyHidden
                );


            closeShortMenu();


            if (currentlyHidden) {

                showToast(
                    "Short is visible again"
                );

            } else {

                showToast(
                    "Short hidden"
                );

            }


            await loadShorts();

        } catch (error) {

            console.error(
                "Hide Short error:",
                error
            );

            showToast(
                "Could not update Short",
                "error"
            );

        }

    }


    /* =========================================================
       COMMENTS ON / OFF
    ========================================================= */

    async function toggleComments() {

        const id =
            state.menuShortId;


        if (!id) {
            return;
        }


        const short =
            getShort(id);


        if (!short || !isOwner(short)) {

            showToast(
                "You cannot change this Short",
                "error"
            );

            return;

        }


        const disabled =
            commentsDisabled(short);


        try {

            await db
                .ref(
                    `${CONFIG.SHORTS_PATH}/${id}/commentsDisabled`
                )
                .set(
                    !disabled
                );


            closeShortMenu();


            showToast(
                disabled
                    ? "Comments turned on"
                    : "Comments turned off"
            );


            await loadShorts();

        } catch (error) {

            console.error(
                "Comments setting error:",
                error
            );

            showToast(
                "Could not update comments",
                "error"
            );

        }

    }


    /* =========================================================
       HIDE LIKE COUNT
    ========================================================= */

    async function toggleLikeCountVisibility() {

        const id =
            state.menuShortId;


        if (!id) {
            return;
        }


        const short =
            getShort(id);


        if (!short || !isOwner(short)) {

            showToast(
                "You cannot change this Short",
                "error"
            );

            return;

        }


        const hidden =
            likesHidden(short);


        try {

            await db
                .ref(
                    `${CONFIG.SHORTS_PATH}/${id}/hideLikeCount`
                )
                .set(
                    !hidden
                );


            closeShortMenu();


            showToast(
                hidden
                    ? "Like count shown"
                    : "Like count hidden"
            );


            await loadShorts();

        } catch (error) {

            console.error(
                "Like visibility error:",
                error
            );

            showToast(
                "Could not update like visibility",
                "error"
            );

        }

    }


    /* =========================================================
       DELETE SHORT
    ========================================================= */

    function deleteCurrentShort() {

        const id =
            state.menuShortId;


        if (!id) {
            return;
        }


        const short =
            getShort(id);


        if (!short) {
            return;
        }


        if (!isOwner(short)) {

            showToast(
                "You cannot delete this Short",
                "error"
            );

            return;

        }


        openConfirm(

            "Delete Short?",

            "This Short will be permanently removed from Viewora.",

            "Delete",

            async () => {

                await permanentlyDeleteShort(
                    id
                );

            }

        );

    }


    async function permanentlyDeleteShort(
        id
    ) {

        try {

            /*
             * Firebase record delete.
             *
             * Cloudinary file deletion normally requires
             * a secure server/backend because Cloudinary
             * destroy credentials must NOT be exposed
             * in frontend JS.
             */

            await db
                .ref(
                    `${CONFIG.SHORTS_PATH}/${id}`
                )
                .remove();


            closeShortMenu();


            state.viewed[id] =
                false;


            state.shorts =
                state.shorts.filter(
                    short =>
                        short.id !== id
                );


            state.filteredShorts =
                state.filteredShorts.filter(
                    short =>
                        short.id !== id
                );


            renderFeed();


            showToast(
                "Short deleted"
            );

        } catch (error) {

            console.error(
                "Delete Short error:",
                error
            );

            showToast(
                "Could not delete Short",
                "error"
            );

        }

    }


    /* =========================================================
       SAVE TO PROFILE FROM MENU
    ========================================================= */

    async function saveCurrentShortToProfile() {

        if (!state.currentUser) {

            openLogin();

            return;

        }


        const id =
            state.menuShortId;


        if (!id) {
            return;
        }


        try {

            await db
                .ref(
                    `${CONFIG.SAVED_PATH}/${state.currentUser.uid}/${id}`
                )
                .set({

                    shortId: id,

                    createdAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                });


            closeShortMenu();


            showToast(
                "Saved to profile"
            );

        } catch (error) {

            console.error(
                "Profile save error:",
                error
            );

            showToast(
                "Could not save Short",
                "error"
            );

        }

    }


    /* =========================================================
       COPY SHORT LINK
    ========================================================= */

    async function copyCurrentShortLink() {

        const id =
            state.menuShortId;


        if (!id) {
            return;
        }


        try {

            await copyText(
                getShareURL(id)
            );


            closeShortMenu();


            showToast(
                "Link copied"
            );

        } catch (error) {

            console.error(
                "Copy link error:",
                error
            );

            showToast(
                "Could not copy link",
                "error"
            );

        }

    }


    /* =========================================================
       NOT INTERESTED
    ========================================================= */

    async function notInterested() {

        const id =
            state.menuShortId;


        if (!id) {
            return;
        }


        try {

            closeShortMenu();


            state.shorts =
                state.shorts.filter(
                    short =>
                        short.id !== id
                );


            state.filteredShorts =
                state.filteredShorts.filter(
                    short =>
                        short.id !== id
                );


            renderFeed();


            showToast(
                "Short removed from your feed"
            );


        } catch (error) {

            console.error(
                "Not interested error:",
                error
            );

        }

    }


    /* =========================================================
       REPORT
    ========================================================= */

    function openReport(
        shortId
    ) {

        state.reportShortId =
            shortId;


        $("reportModal")
            ?.classList.remove(
                "hidden"
            );


        $("reportModal")
            ?.setAttribute(
                "aria-hidden",
                "false"
            );


        document.body.classList.add(
            "modalOpen"
        );

    }


    function closeReport() {

        $("reportModal")
            ?.classList.add(
                "hidden"
            );


        $("reportModal")
            ?.setAttribute(
                "aria-hidden",
                "true"
            );


        document.body.classList.remove(
            "modalOpen"
        );


        state.reportShortId =
            null;

    }


    async function submitReport(
        reason
    ) {

        if (!state.currentUser) {

            openLogin();

            return;

        }


        const shortId =
            state.reportShortId;


        if (!shortId) {
            return;
        }


        try {

            await db
                .ref(
                    `${CONFIG.REPORTS_PATH}/${shortId}/${state.currentUser.uid}`
                )
                .set({

                    uid:
                        state.currentUser.uid,

                    shortId,

                    reason,

                    createdAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                });


            closeReport();

            closeShortMenu();


            showToast(
                "Report submitted"
            );

        } catch (error) {

            console.error(
                "Report error:",
                error
            );

            showToast(
                "Could not submit report",
                "error"
            );

        }

    }


    /* =========================================================
       CONFIRM MODAL
    ========================================================= */

    function openConfirm(
        title,
        message,
        actionText,
        callback
    ) {

        const modal =
            $("confirmModal");


        if (!modal) {

            if (
                window.confirm(
                    message
                )
            ) {

                callback?.();

            }

            return;

        }


        $("confirmTitle").textContent =
            title;


        $("confirmMessage").textContent =
            message;


        $("confirmActionBtn").textContent =
            actionText;


        state.confirmAction =
            callback;


        modal.classList.remove(
            "hidden"
        );


        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.classList.add(
            "modalOpen"
        );

    }


    function closeConfirm() {

        $("confirmModal")
            ?.classList.add(
                "hidden"
            );


        $("confirmModal")
            ?.setAttribute(
                "aria-hidden",
                "true"
            );


        state.confirmAction =
            null;


        document.body.classList.remove(
            "modalOpen"
        );

    }


    /* =========================================================
       LOGIN
    ========================================================= */

    function openLogin() {

        const modal =
            $("loginModal");


        if (!modal) {

            showToast(
                "Please login first",
                "error"
            );

            return;

        }


        modal.classList.remove(
            "hidden"
        );


        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.classList.add(
            "modalOpen"
        );

    }


    function closeLogin() {

        $("loginModal")
            ?.classList.add(
                "hidden"
            );


        $("loginModal")
            ?.setAttribute(
                "aria-hidden",
                "true"
            );


        document.body.classList.remove(
            "modalOpen"
        );

    }


    /* =========================================================
       PROFILE
    ========================================================= */

    function openProfile(uid) {

        if (!uid) {
            return;
        }


        window.location.href =
            `profile.html?uid=${encodeURIComponent(uid)}`;

    }


    /* =========================================================
       COUNTERS
    ========================================================= */

    async function incrementCounter(
        path
    ) {

        return db
            .ref(path)
            .transaction(
                current => {

                    return (
                        safeNumber(current) +
                        1
                    );

                }
            );

    }


    async function decrementCounter(
        path
    ) {

        return db
            .ref(path)
            .transaction(
                current => {

                    return Math.max(
                        0,
                        safeNumber(current) -
                        1
                    );

                }
            );

    }


    function refreshButtonCount(
        button,
        delta
    ) {

        if (!button) {
            return;
        }


        const count =
            button.querySelector(
                "span"
            );


        if (!count) {
            return;
        }


        const current =
            parseDisplayedCount(
                count.textContent
            );


        count.textContent =
            formatCount(
                Math.max(
                    0,
                    current +
                    safeNumber(delta)
                )
            );

    }


    /* =========================================================
       HEART ANIMATION
    ========================================================= */

    function playHeart() {

        const heart =
            $("heartAnimation");


        if (!heart) {
            return;
        }


        heart.classList.remove(
            "heartPlay"
        );


        void heart.offsetWidth;


        heart.classList.add(
            "heartPlay"
        );

    }


    /* =========================================================
       GET SHORT
    ========================================================= */

    function getShort(id) {

        return state.shorts.find(
            short =>
                short.id === id
        ) || null;

    }


    function isOwner(short) {

        if (
            !short ||
            !state.currentUser
        ) {
            return false;
        }


        return (
            getUserId(short) ===
            state.currentUser.uid
        );

    }


    /* =========================================================
       GLOBAL EVENTS
    ========================================================= */

    function setupGlobalEvents() {


        /* -----------------------------------------------
           COMMENT
        ------------------------------------------------ */

        $("sendComment")
            ?.addEventListener(
                "click",
                sendComment
            );


        $("commentText")
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        sendComment();

                    }

                }
            );


        /* -----------------------------------------------
           SHARE
        ------------------------------------------------ */

        document
            .querySelectorAll(
                ".shareItem"
            )
            .forEach(item => {

                item.addEventListener(
                    "click",
                    () => {

                        shareShort(
                            item.dataset.share
                        );

                    }
                );

            });


        /* -----------------------------------------------
           CLOSE COMMENTS
        ------------------------------------------------ */

        $("closeComments")
            ?.addEventListener(
                "click",
                closeComments
            );


        $("commentsOverlay")
            ?.addEventListener(
                "click",
                closeComments
            );


        /* -----------------------------------------------
           CLOSE SHARE
        ------------------------------------------------ */

        $("closeShare")
            ?.addEventListener(
                "click",
                closeShare
            );


        $("shareOverlay")
            ?.addEventListener(
                "click",
                closeShare
            );


        /* -----------------------------------------------
           EDIT
        ------------------------------------------------ */

        $("editShortBtn")
            ?.addEventListener(
                "click",
                editCurrentShort
            );


        /* -----------------------------------------------
           HIDE
        ------------------------------------------------ */

        $("hideShortBtn")
            ?.addEventListener(
                "click",
                toggleHideCurrentShort
            );


        /* -----------------------------------------------
           COMMENTS ON/OFF
        ------------------------------------------------ */

        $("disableCommentsBtn")
            ?.addEventListener(
                "click",
                toggleComments
            );


        /* -----------------------------------------------
           LIKE COUNT
        ------------------------------------------------ */

        $("hideLikeCountBtn")
            ?.addEventListener(
                "click",
                toggleLikeCountVisibility
            );


        /* -----------------------------------------------
           SAVE TO PROFILE
        ------------------------------------------------ */

        $("saveShortBtn")
            ?.addEventListener(
                "click",
                saveCurrentShortToProfile
            );


        /* -----------------------------------------------
           DELETE
        ------------------------------------------------ */

        $("deleteShortBtn")
            ?.addEventListener(
                "click",
                deleteCurrentShort
            );


        /* -----------------------------------------------
           VIEWER NOT INTERESTED
        ------------------------------------------------ */

        $("notInterestedBtn")
            ?.addEventListener(
                "click",
                notInterested
            );


        /* -----------------------------------------------
           REPORT
        ------------------------------------------------ */

        $("reportShortBtn")
            ?.addEventListener(
                "click",
                () => {

                    const id =
                        state.menuShortId;

                    closeShortMenu();

                    openReport(id);

                }
            );


        document
            .querySelectorAll(
                ".reportBtn"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        submitReport(
                            button.dataset.report
                        );

                    }
                );

            });


        $("closeReport")
            ?.addEventListener(
                "click",
                closeReport
            );


        $("reportOverlay")
            ?.addEventListener(
                "click",
                closeReport
            );


        /* -----------------------------------------------
           COPY LINK
        ------------------------------------------------ */

        $("copyShortLinkBtn")
            ?.addEventListener(
                "click",
                copyCurrentShortLink
            );


        /* -----------------------------------------------
           CLOSE MENU
        ------------------------------------------------ */

        $("closeShortMenu")
            ?.addEventListener(
                "click",
                closeShortMenu
            );


        $("menuBackdrop")
            ?.addEventListener(
                "click",
                closeShortMenu
            );


        /* -----------------------------------------------
           CONFIRM
        ------------------------------------------------ */

        $("confirmCancelBtn")
            ?.addEventListener(
                "click",
                closeConfirm
            );


        $("confirmActionBtn")
            ?.addEventListener(
                "click",
                async () => {

                    const action =
                        state.confirmAction;

                    if (!action) {
                        return;
                    }


                    try {

                        await action();

                    } catch (error) {

                        console.error(
                            error
                        );

                    } finally {

                        closeConfirm();

                    }

                }
            );


        /* -----------------------------------------------
           LOGIN
        ------------------------------------------------ */

        $("loginBtn")
            ?.addEventListener(
                "click",
                () => {

                    /*
                     * If your auth page has another filename,
                     * change this destination.
                     */

                    window.location.href =
                        "login.html";

                }
            );


        $("closeLoginBtn")
            ?.addEventListener(
                "click",
                closeLogin
            );


        /* -----------------------------------------------
           SEARCH
        ------------------------------------------------ */

        $("shortSearchBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("shortSearchBar")
                        ?.classList.toggle(
                            "hidden"
                        );


                    if (
                        !$("shortSearchBar")
                            ?.classList.contains(
                                "hidden"
                            )
                    ) {

                        $("shortSearchInput")
                            ?.focus();

                    }

                }
            );


        $("shortSearchInput")
            ?.addEventListener(
                "input",
                event => {

                    performSearch(
                        event.target.value
                    );

                }
            );


        $("clearShortSearch")
            ?.addEventListener(
                "click",
                () => {

                    const input =
                        $("shortSearchInput");


                    if (input) {

                        input.value =
                            "";

                    }


                    state.searchText =
                        "";


                    applySearchAndRender();


                    input?.focus();

                }
            );


        /* -----------------------------------------------
           CREATE SHORT
        ------------------------------------------------ */

        $("createShortBtn")
            ?.addEventListener(
                "click",
                openCreateShort
            );


        $("emptyCreateBtn")
            ?.addEventListener(
                "click",
                openCreateShort
            );


        /* -----------------------------------------------
           BACK
        ------------------------------------------------ */

        $("shortsBackBtn")
            ?.addEventListener(
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


        /* -----------------------------------------------
           BOTTOM NAV
        ------------------------------------------------ */

        document
            .querySelectorAll(
                ".bottomNavItem, .bottomCreate"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        handleNavigation(
                            button.dataset.nav
                        );

                    }
                );

            });


        /* -----------------------------------------------
           OUTSIDE MENU
        ------------------------------------------------ */

        document.addEventListener(
            "click",
            event => {

                const menu =
                    $("shortMenu");


                if (
                    !menu ||
                    menu.classList.contains(
                        "hidden"
                    )
                ) {
                    return;
                }


                if (
                    !menu.contains(
                        event.target
                    ) &&
                    !event.target.closest(
                        ".moreBtn"
                    )
                ) {

                    closeShortMenu();

                }

            }
        );


        /* -----------------------------------------------
           ESCAPE
        ------------------------------------------------ */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }


                closeComments();

                closeShare();

                closeReport();

                closeConfirm();

                closeLogin();

                closeShortMenu();

            }
        );


        /* -----------------------------------------------
           ONLINE / OFFLINE
        ------------------------------------------------ */

        window.addEventListener(
            "online",
            () => {

                $("networkStatus")
                    ?.classList.add(
                        "hidden"
                    );


                loadShorts();

            }
        );


        window.addEventListener(
            "offline",
            () => {

                $("networkStatus")
                    ?.classList.remove(
                        "hidden"
                    );

            }
        );

    }


    /* =========================================================
       CREATE SHORT
    ========================================================= */

    function openCreateShort() {

        if (!state.currentUser) {

            openLogin();

            return;

        }


        window.location.href =
            "short_upload.html";

    }


    /* =========================================================
       BOTTOM NAVIGATION
    ========================================================= */

    function handleNavigation(
        nav
    ) {

        switch (nav) {

            case "home":

                window.location.href =
                    "index.html";

                break;


            case "search":

                $("shortSearchBar")
                    ?.classList.remove(
                        "hidden"
                    );


                $("shortSearchInput")
                    ?.focus();

                break;


            case "create":

                openCreateShort();

                break;


            case "notifications":

                window.location.href =
                    "notifications.html";

                break;


            case "profile":

                if (state.currentUser) {

                    window.location.href =
                        `profile.html?uid=${encodeURIComponent(
                            state.currentUser.uid
                        )}`;

                } else {

                    openLogin();

                }

                break;

        }

    }


    /* =========================================================
       DOUBLE TAP LIKE
    ========================================================= */

    let lastTapTime = 0;


    if (container) {

        container.addEventListener(
            "click",
            event => {

                const video =
                    event.target.closest(
                        ".shortVideo"
                    );


                if (!video) {
                    return;
                }


                const now =
                    Date.now();


                if (
                    now -
                    lastTapTime <
                    320
                ) {

                    const card =
                        video.closest(
                            ".shortCard"
                        );


                    if (!card) {
                        return;
                    }


                    const button =
                        card.querySelector(
                            ".likeBtn"
                        );


                    if (
                        button &&
                        !button.classList.contains(
                            "liked"
                        )
                    ) {

                        toggleLike(
                            card.dataset.shortId,
                            button
                        );

                    }


                    playHeart();

                }


                lastTapTime =
                    now;

            }
        );

    }


    /* =========================================================
       CLEANUP
    ========================================================= */

    function cleanup() {

        state.observer?.disconnect();


        if (state.shortListener) {

            db
                .ref(CONFIG.SHORTS_PATH)
                .off(
                    "value",
                    state.shortListener
                );

        }


        if (
            state.commentListener &&
            state.commentShortId
        ) {

            db
                .ref(
                    `${CONFIG.COMMENTS_PATH}/${state.commentShortId}`
                )
                .off(
                    "value",
                    state.commentListener
                );

        }


        Object.entries(
            state.viewTimers
        ).forEach(([id, timer]) => {

            clearTimeout(timer);

        });


        state.observer =
            null;

        state.shortListener =
            null;

        state.commentListener =
            null;

    }


    window.addEventListener(
        "beforeunload",
        cleanup
    );


    /* =========================================================
       INITIALIZE
    ========================================================= */

    function init() {

        if (state.initialized) {
            return;
        }


        state.initialized =
            true;


        setupGlobalEvents();


        updateCommentAvatar();


        /*
         * Firebase auth listener will call loadShorts().
         * Also load immediately if auth state is already available.
         */

        if (
            auth.currentUser
        ) {

            state.currentUser =
                auth.currentUser;

        }

    }


    init();


    /* =========================================================
       PUBLIC API
    ========================================================= */

    window.VieworaShorts = {

        reload:
            () => {

                state.loading =
                    false;

                return loadShorts();

            },

        openComments,

        closeComments,

        openShare,

        closeShare,

        openReport,

        closeReport,

        toggleMute,

        playNext,

        openShortMenu,

        closeShortMenu,

        editCurrentShort,

        deleteCurrentShort

    };


})();