"use strict";

/*
============================================================
 VIEWORA POSTS
 posts.js
 PREMIUM • PRODUCTION READY

 Features:
 • Firebase Auth
 • Global posts + user/posts fallback
 • Exact post loading
 • Profile-aware posts
 • Like / Unlike
 • Save / Unsave
 • Comments
 • Share
 • Copy link
 • Edit / Delete owner posts
 • User profile navigation
 • Video playback
 • Double-tap like
 • Safe HTML rendering
 • Safe Firebase values
 • No global variable collisions
============================================================
*/

(() => {

    /* =====================================================
       PREVENT DOUBLE INITIALIZATION
    ===================================================== */

    if (window.__VIEWORA_POSTS_INITIALIZED__) {
        console.warn("Viewora Posts already initialized.");
        return;
    }

    window.__VIEWORA_POSTS_INITIALIZED__ = true;


    /* =====================================================
       DOM
    ===================================================== */

    const feed =
        document.getElementById("postFeed");

    const counter =
        document.getElementById("postCounter");

    const toast =
        document.getElementById("toast");

    const commentSheet =
        document.getElementById("commentSheet");

    const commentBackdrop =
        document.getElementById("commentBackdrop");

    const commentList =
        document.getElementById("commentList");

    const commentInput =
        document.getElementById("commentInput");

    const commentSend =
        document.getElementById("commentSend");

    const closeCommentsBtn =
        document.getElementById("closeComments");

    const menuSheet =
        document.getElementById("menuSheet");

    const menuBackdrop =
        document.getElementById("menuBackdrop");

    const menuCancel =
        document.getElementById("menuCancel");

    const editPostBtn =
        document.getElementById("editPostBtn");

    const deletePostBtn =
        document.getElementById("deletePostBtn");

    const copyLinkBtn =
        document.getElementById("copyLinkBtn");

    const backBtn =
        document.getElementById("backBtn");

    const headerMore =
        document.getElementById("headerMore");


    /* =====================================================
       STATE
    ===================================================== */

    let currentUser = null;

    let profileUID = null;

    let requestedPostID = null;

    let loadedPosts = [];

    let activePost = null;

    let toastTimer = null;

    let doubleTapLock = false;

    const userCache = new Map();


    /* =====================================================
       FIREBASE
    ===================================================== */

    function firebaseReady() {

        return (
            typeof firebase !== "undefined" &&
            firebase.apps &&
            firebase.apps.length > 0 &&
            typeof auth !== "undefined" &&
            typeof db !== "undefined"
        );

    }


    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(message) {

        if (!toast) return;

        toast.textContent =
            String(message || "");

        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {

            toast.classList.remove("show");

        }, 2300);

    }


    /* =====================================================
       URL
    ===================================================== */

    function readURL() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        profileUID =
            params.get("uid") ||
            params.get("user") ||
            params.get("userId") ||
            params.get("profileId") ||
            null;

        requestedPostID =
            params.get("post") ||
            params.get("postId") ||
            params.get("id") ||
            null;

    }


    /* =====================================================
       SAFE NUMBER
    ===================================================== */

    function safeNumber(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;

    }


    /* =====================================================
       FORMAT NUMBER
    ===================================================== */

    function formatNumber(value) {

        const number =
            safeNumber(value);

        if (number >= 1000000) {

            return (
                (number / 1000000)
                    .toFixed(
                        number >= 10000000
                            ? 0
                            : 1
                    )
                    .replace(".0", "") +
                "M"
            );

        }

        if (number >= 1000) {

            return (
                (number / 1000)
                    .toFixed(
                        number >= 10000
                            ? 0
                            : 1
                    )
                    .replace(".0", "") +
                "K"
            );

        }

        return String(number);

    }


    /* =====================================================
       ESCAPE HTML
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
       NORMALIZE UID
    ===================================================== */

    function normalizeUID(value) {

        if (
            value === null ||
            value === undefined ||
            typeof value === "object"
        ) {
            return "";
        }

        return String(value).trim();

    }


    /* =====================================================
       AUTHOR UID
    ===================================================== */

    function getAuthorUID(post) {

        if (!post) return "";

        const keys = [

            "uid",
            "userId",
            "userUID",
            "userUid",
            "authorId",
            "authorUID",
            "authorUid",
            "ownerId",
            "ownerUID",
            "ownerUid",
            "creatorId",
            "creatorUID",
            "creatorUid",
            "profileUID",
            "profileUid"

        ];

        for (const key of keys) {

            const uid =
                normalizeUID(post[key]);

            if (uid) {
                return uid;
            }

        }

        if (
            post.author &&
            typeof post.author === "object"
        ) {

            const nestedKeys = [
                "uid",
                "userId",
                "id"
            ];

            for (const key of nestedKeys) {

                const uid =
                    normalizeUID(
                        post.author[key]
                    );

                if (uid) {
                    return uid;
                }

            }

        }

        return "";

    }


    /* =====================================================
       MEDIA URL
    ===================================================== */

    function getMediaURL(post) {

        if (!post) return "";

        const keys = [

            "mediaURL",
            "mediaUrl",
            "imageURL",
            "imageUrl",
            "videoURL",
            "videoUrl",
            "downloadURL",
            "downloadUrl",
            "fileURL",
            "fileUrl",
            "url"

        ];

        for (const key of keys) {

            if (
                typeof post[key] === "string" &&
                post[key].trim()
            ) {

                return post[key].trim();

            }

        }

        if (
            typeof post.media === "string" &&
            post.media.trim()
        ) {

            return post.media.trim();

        }

        if (
            post.media &&
            typeof post.media === "object"
        ) {

            return (
                post.media.url ||
                post.media.mediaURL ||
                post.media.downloadURL ||
                ""
            );

        }

        return "";

    }


    /* =====================================================
       VIDEO DETECTION
    ===================================================== */

    function isVideo(post, url) {

        const type =
            String(
                post?.mediaType ||
                post?.type ||
                post?.contentType ||
                post?.fileType ||
                ""
            ).toLowerCase();

        if (
            type.includes("video") ||
            type === "mp4" ||
            type === "webm" ||
            type === "mov"
        ) {

            return true;

        }

        return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i
            .test(url);

    }


    /* =====================================================
       AUTH
    ===================================================== */

    function waitForAuth() {

        if (
            typeof auth === "undefined"
        ) {
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

                    if (finished) return;

                    finished = true;

                    try {
                        unsubscribe();
                    } catch (_) {}

                    resolve(user || null);

                });

            setTimeout(() => {

                if (finished) return;

                finished = true;

                try {
                    unsubscribe();
                } catch (_) {}

                resolve(
                    auth.currentUser || null
                );

            }, 5000);

        });

    }


    /* =====================================================
       GET USER
    ===================================================== */

    async function getUser(uid) {

        uid =
            normalizeUID(uid);

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

            const user =
                snapshot.exists()
                    ? snapshot.val() || {}
                    : {};

            userCache.set(uid, user);

            return user;

        } catch (error) {

            console.warn(
                "User read failed:",
                error
            );

            return {};

        }

    }


    /* =====================================================
       OBJECT → POSTS
    ===================================================== */

    function objectToPosts(raw) {

        if (
            !raw ||
            typeof raw !== "object"
        ) {
            return [];
        }

        return Object.entries(raw)
            .map(([id, data]) => {

                if (
                    !data ||
                    typeof data !== "object"
                ) {
                    return null;
                }

                return {
                    id,
                    ...data
                };

            })
            .filter(Boolean);

    }


    /* =====================================================
       EXACT POST
    ===================================================== */

    async function getExactPost(postID) {

        if (!postID) {
            return null;
        }

        try {

            const snapshot =
                await db
                    .ref(
                        "posts/" +
                        postID
                    )
                    .once("value");

            if (snapshot.exists()) {

                return {
                    id: postID,
                    ...(snapshot.val() || {})
                };

            }

        } catch (error) {

            console.warn(
                "Direct post read failed:",
                error
            );

        }

        return null;

    }


    /* =====================================================
       PROFILE POSTS
    ===================================================== */

    async function getPostsForProfile(uid) {

        uid =
            normalizeUID(uid);

        if (!uid) {
            return [];
        }

        const result = [];

        /* -----------------------------------------------
           GLOBAL POSTS
        ------------------------------------------------ */

        try {

            const snapshot =
                await db
                    .ref("posts")
                    .once("value");

            if (snapshot.exists()) {

                const posts =
                    objectToPosts(
                        snapshot.val()
                    );

                posts.forEach(post => {

                    if (
                        getAuthorUID(post) === uid
                    ) {

                        result.push(post);

                    }

                });

            }

        } catch (error) {

            console.warn(
                "Global posts failed:",
                error
            );

        }


        /* -----------------------------------------------
           USER POSTS FALLBACK
        ------------------------------------------------ */

        try {

            const snapshot =
                await db
                    .ref(
                        "users/" +
                        uid +
                        "/posts"
                    )
                    .once("value");

            if (snapshot.exists()) {

                const posts =
                    objectToPosts(
                        snapshot.val()
                    );

                posts.forEach(post => {

                    if (
                        !getAuthorUID(post)
                    ) {

                        post.uid = uid;

                    }

                    const exists =
                        result.some(
                            item =>
                                String(item.id) ===
                                String(post.id)
                        );

                    if (!exists) {
                        result.push(post);
                    }

                });

            }

        } catch (error) {

            console.warn(
                "Nested posts failed:",
                error
            );

        }

        return result;

    }


    /* =====================================================
       RESOLVE POST PROFILE
    ===================================================== */

    async function resolveProfileFromPost() {

        if (!requestedPostID) {
            return null;
        }

        const post =
            await getExactPost(
                requestedPostID
            );

        if (!post) {
            return null;
        }

        const authorUID =
            getAuthorUID(post);

        if (authorUID) {

            profileUID =
                authorUID;

        }

        return post;

    }


    /* =====================================================
       LOAD POSTS
    ===================================================== */

    async function loadPosts() {

        readURL();

        try {

            if (!firebaseReady()) {

                throw new Error(
                    "Firebase is not ready."
                );

            }

            currentUser =
                await waitForAuth();

            let exactPost = null;

            /* -------------------------------------------
               EXACT POST HAS PRIORITY
            -------------------------------------------- */

            if (requestedPostID) {

                exactPost =
                    await resolveProfileFromPost();

                if (!exactPost) {

                    showEmpty(
                        "Post not found",
                        "This post may have been deleted or is no longer available."
                    );

                    return;

                }

            }

            /* -------------------------------------------
               FALLBACK TO CURRENT USER
            -------------------------------------------- */

            if (!profileUID) {

                if (currentUser) {

                    profileUID =
                        currentUser.uid;

                } else {

                    showEmpty(
                        "Profile not found",
                        "The profile information for this post is missing."
                    );

                    return;

                }

            }

            loadedPosts =
                await getPostsForProfile(
                    profileUID
                );

            /* -------------------------------------------
               EXACT POST FALLBACK
            -------------------------------------------- */

            if (exactPost) {

                const exists =
                    loadedPosts.some(
                        post =>
                            String(post.id) ===
                            String(exactPost.id)
                    );

                if (!exists) {

                    loadedPosts.unshift(
                        exactPost
                    );

                }

            }

            /* -------------------------------------------
               SORT
            -------------------------------------------- */

            loadedPosts.sort(
                (a, b) => {

                    return (
                        getPostTime(b) -
                        getPostTime(a)
                    );

                }
            );

            /* -------------------------------------------
               REQUESTED POST FIRST
            -------------------------------------------- */

            if (requestedPostID) {

                const index =
                    loadedPosts.findIndex(
                        post =>
                            String(post.id) ===
                            String(requestedPostID)
                    );

                if (index > 0) {

                    const target =
                        loadedPosts.splice(
                            index,
                            1
                        )[0];

                    loadedPosts.unshift(
                        target
                    );

                }

            }

            renderPosts();

        } catch (error) {

            console.error(
                "Posts load failed:",
                error
            );

            showEmpty(
                "Unable to load posts",
                "Please check your Firebase connection and try again."
            );

        }

    }


    /* =====================================================
       POST TIME
    ===================================================== */

    function getPostTime(post) {

        return safeNumber(
            post?.createdAt ??
            post?.timestamp ??
            post?.time ??
            post?.created ??
            post?.date
        );

    }


    /* =====================================================
       EMPTY STATE
    ===================================================== */

    function showEmpty(title, description) {

        if (!feed) return;

        feed.innerHTML = `

            <section class="state empty-state">

                <div class="state-icon">

                    <i class="fa-regular fa-images"></i>

                </div>

                <strong>
                    ${escapeHTML(title)}
                </strong>

                <span>
                    ${escapeHTML(description)}
                </span>

            </section>

        `;

        if (counter) {
            counter.textContent =
                "0 posts";
        }

    }


    /* =====================================================
       RENDER
    ===================================================== */

    function renderPosts() {

        if (!loadedPosts.length) {

            showEmpty(
                "No posts yet",
                "This profile hasn't posted anything yet."
            );

            return;

        }

        feed.innerHTML = "";

        counter.textContent =
            `${loadedPosts.length} post${loadedPosts.length === 1 ? "" : "s"}`;

        loadedPosts.forEach(
            (post, index) => {

                const article =
                    createPostElement(
                        post,
                        index
                    );

                feed.appendChild(
                    article
                );

                const uid =
                    getAuthorUID(post);

                if (uid) {

                    getUser(uid)
                        .then(user => {

                            applyUserToPost(
                                article,
                                user
                            );

                        });

                }

            }
        );

    }


    /* =====================================================
       CREATE POST
    ===================================================== */

    function createPostElement(
        post,
        index
    ) {

        const article =
            document.createElement(
                "article"
            );

        article.className =
            "post";

        article.dataset.postId =
            String(post.id);

        article.dataset.index =
            String(index);

        const authorUID =
            getAuthorUID(post);

        const mediaURL =
            getMediaURL(post);

        const video =
            isVideo(
                post,
                mediaURL
            );

        const caption =
            post.caption ||
            post.text ||
            post.description ||
            "";

        const likes =
            getLikeCountValue(post);

        const comments =
            getCommentCountValue(post);

        const views =
            safeNumber(
                post.viewsCount ??
                post.viewCount ??
                post.views
            );

        article.innerHTML = `

            <div class="post-header">

                <div
                    class="post-user"
                    data-profile="${escapeHTML(authorUID)}"
                >

                    <img
                        class="post-avatar"
                        src="assets/default-avatar.png"
                        alt=""
                        loading="lazy"
                    >

                    <div class="post-user-info">

                        <div class="post-name">

                            <span class="post-name-text">
                                Viewora User
                            </span>

                            <span
                                class="verified-badge"
                                hidden
                            >
                                <i class="fa-solid fa-circle-check"></i>
                            </span>

                        </div>

                        <div class="post-username">
                            @user
                        </div>

                    </div>

                </div>


                <button
                    class="post-more"
                    type="button"
                    aria-label="Post options"
                >
                    <i class="fa-solid fa-ellipsis"></i>
                </button>

            </div>


            <div class="post-media">

                ${
                    mediaURL

                    ? (

                        video

                        ? `

                            <video
                                class="post-video"
                                src="${escapeHTML(mediaURL)}"
                                playsinline
                                preload="metadata"
                            ></video>

                            <div class="video-play">

                                <i class="fa-solid fa-play"></i>

                            </div>

                        `

                        : `

                            <img
                                class="post-image"
                                src="${escapeHTML(mediaURL)}"
                                alt="Post"
                                loading="lazy"
                            >

                        `

                    )

                    : `

                        <div class="no-media">
                            No media
                        </div>

                    `
                }

            </div>


            <div class="action-row">

                <div class="action-left">

                    <button
                        class="action-btn like-btn"
                        type="button"
                        aria-label="Like"
                    >

                        <i class="fa-regular fa-heart"></i>

                    </button>


                    <button
                        class="action-btn comment-btn"
                        type="button"
                        aria-label="Comment"
                    >

                        <i class="fa-regular fa-comment"></i>

                    </button>


                    <button
                        class="action-btn share-btn"
                        type="button"
                        aria-label="Share"
                    >

                        <i class="fa-regular fa-paper-plane"></i>

                    </button>

                </div>


                <button
                    class="action-btn save-btn"
                    type="button"
                    aria-label="Save"
                >

                    <i class="fa-regular fa-bookmark"></i>

                </button>

            </div>


            <div class="post-details">

                <div class="like-count">
                    ${formatNumber(likes)} likes
                </div>


                <div class="caption">

                    ${
                        caption
                        ? `

                            <strong class="caption-username">
                                @user
                            </strong>

                            <span class="caption-text">
                                ${escapeHTML(caption)}
                            </span>

                        `
                        : ""
                    }

                </div>


                <div class="comment-preview">

                    ${
                        comments > 0
                        ? `View all ${formatNumber(comments)} comments`
                        : "Add a comment..."
                    }

                </div>


                <div class="post-date">

                    ${formatDate(getPostTime(post))}

                    ${
                        views > 0
                        ? " • " +
                          formatNumber(views) +
                          " views"
                        : ""
                    }

                </div>

            </div>

        `;


        bindPostEvents(
            article,
            post
        );

        loadInteractionState(
            article,
            post
        );

        loadLikeCount(
            article,
            post
        );

        return article;

    }


    /* =====================================================
       LIKE / COMMENT COUNT VALUES
    ===================================================== */

    function getLikeCountValue(post) {

        const value =
            post.likesCount ??
            post.likeCount ??
            post.likes;

        if (
            value &&
            typeof value === "object"
        ) {

            return Object.keys(value).length;

        }

        return safeNumber(value);

    }


    function getCommentCountValue(post) {

        const value =
            post.commentsCount ??
            post.commentCount ??
            post.comments;

        if (
            value &&
            typeof value === "object"
        ) {

            return Object.keys(value).length;

        }

        return safeNumber(value);

    }


    /* =====================================================
       APPLY USER
    ===================================================== */

    function applyUserToPost(
        article,
        user
    ) {

        user =
            user || {};

        const name =
            user.name ||
            user.fullName ||
            user.displayName ||
            "Viewora User";

        const username =
            user.username ||
            user.userName ||
            user.handle ||
            "user";

        const photo =
            user.profilePhoto ||
            user.profilePicture ||
            user.photoURL ||
            user.avatar ||
            "assets/default-avatar.png";

        const verified =
            user.verified === true ||
            user.isVerified === true;

        const avatar =
            article.querySelector(
                ".post-avatar"
            );

        const nameEl =
            article.querySelector(
                ".post-name-text"
            );

        const usernameEl =
            article.querySelector(
                ".post-username"
            );

        const captionUser =
            article.querySelector(
                ".caption-username"
            );

        const verifiedEl =
            article.querySelector(
                ".verified-badge"
            );

        if (avatar) {

            avatar.src =
                photo;

            avatar.onerror = () => {

                avatar.onerror = null;

                avatar.src =
                    "assets/default-avatar.png";

            };

        }

        if (nameEl) {
            nameEl.textContent =
                name;
        }

        if (usernameEl) {
            usernameEl.textContent =
                "@" + username;
        }

        if (captionUser) {
            captionUser.textContent =
                "@" + username;
        }

        if (verifiedEl) {
            verifiedEl.hidden =
                !verified;
        }

    }


    /* =====================================================
       DATE
    ===================================================== */

    function formatDate(timestamp) {

        if (!timestamp) {
            return "Just now";
        }

        const date =
            new Date(
                safeNumber(timestamp)
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "Viewora";
        }

        const difference =
            Math.max(
                0,
                Date.now() -
                date.getTime()
            );

        const minute =
            60 * 1000;

        const hour =
            60 * minute;

        const day =
            24 * hour;

        if (difference < minute) {
            return "Just now";
        }

        if (difference < hour) {

            return (
                Math.floor(
                    difference / minute
                ) + "m ago"
            );

        }

        if (difference < day) {

            return (
                Math.floor(
                    difference / hour
                ) + "h ago"
            );

        }

        if (difference < 7 * day) {

            return (
                Math.floor(
                    difference / day
                ) + "d ago"
            );

        }

        return date.toLocaleDateString(
            undefined,
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );

    }


    /* =====================================================
       POST EVENTS
    ===================================================== */

    function bindPostEvents(
        article,
        post
    ) {

        article
            .querySelector(".like-btn")
            ?.addEventListener(
                "click",
                () => toggleLike(
                    article,
                    post
                )
            );

        article
            .querySelector(".comment-btn")
            ?.addEventListener(
                "click",
                () => openComments(post)
            );

        article
            .querySelector(".comment-preview")
            ?.addEventListener(
                "click",
                () => openComments(post)
            );

        article
            .querySelector(".share-btn")
            ?.addEventListener(
                "click",
                () => sharePost(post)
            );

        article
            .querySelector(".save-btn")
            ?.addEventListener(
                "click",
                () => toggleSave(
                    article,
                    post
                )
            );

        article
            .querySelector(".post-more")
            ?.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    openMenu(post);

                }
            );

        article
            .querySelector(".post-user")
            ?.addEventListener(
                "click",
                () => {

                    const uid =
                        getAuthorUID(post);

                    if (!uid) {
                        return;
                    }

                    window.location.href =
                        "profile.html?uid=" +
                        encodeURIComponent(uid);

                }
            );

        bindVideoEvents(
            article
        );

    }


    /* =====================================================
       VIDEO
    ===================================================== */

    function bindVideoEvents(article) {

        const video =
            article.querySelector(
                ".post-video"
            );

        if (!video) {
            return;
        }

        video.addEventListener(
            "click",
            () => {

                if (video.paused) {

                    video.play()
                        .then(() => {

                            article
                                .querySelector(
                                    ".post-media"
                                )
                                ?.classList.add(
                                    "video-playing"
                                );

                        })
                        .catch(() => {});

                } else {

                    video.pause();

                    article
                        .querySelector(
                            ".post-media"
                        )
                        ?.classList.remove(
                            "video-playing"
                        );

                }

            }
        );

        video.addEventListener(
            "ended",
            () => {

                article
                    .querySelector(
                        ".post-media"
                    )
                    ?.classList.remove(
                        "video-playing"
                    );

            }
        );

    }


    /* =====================================================
       LIKE COUNT FROM DATABASE
    ===================================================== */

    async function loadLikeCount(
        article,
        post
    ) {

        try {

            const snapshot =
                await db
                    .ref(
                        "likes/" +
                        post.id
                    )
                    .once("value");

            if (!snapshot.exists()) {
                return;
            }

            const data =
                snapshot.val() || {};

            let count = 0;

            Object.values(data)
                .forEach(value => {

                    if (
                        value === true ||
                        value === 1 ||
                        (
                            value &&
                            typeof value === "object"
                        )
                    ) {

                        count++;

                    }

                });

            const likeText =
                article.querySelector(
                    ".like-count"
                );

            if (likeText) {

                likeText.textContent =
                    `${formatNumber(count)} likes`;

            }

        } catch (error) {

            console.warn(
                "Like count failed:",
                error
            );

        }

    }


    /* =====================================================
       INTERACTION STATE
    ===================================================== */

    async function loadInteractionState(
        article,
        post
    ) {

        if (!currentUser) {
            return;
        }

        const uid =
            currentUser.uid;

        try {

            const [
                likeSnapshot,
                saveSnapshot
            ] = await Promise.all([

                db
                    .ref(
                        "likes/" +
                        post.id +
                        "/" +
                        uid
                    )
                    .once("value"),

                db
                    .ref(
                        "savedPosts/" +
                        uid +
                        "/" +
                        post.id
                    )
                    .once("value")

            ]);

            setLikedUI(
                article,
                likeSnapshot.val() === true ||
                likeSnapshot.val() === 1
            );

            setSavedUI(
                article,
                saveSnapshot.exists()
            );

        } catch (error) {

            console.warn(
                "Interaction state failed:",
                error
            );

        }

    }


    /* =====================================================
       LIKE
    ===================================================== */

    async function toggleLike(
        article,
        post
    ) {

        if (!currentUser) {

            showToast(
                "Please login to like."
            );

            return;

        }

        const uid =
            currentUser.uid;

        const ref =
            db.ref(
                "likes/" +
                post.id +
                "/" +
                uid
            );

        const button =
            article.querySelector(
                ".like-btn"
            );

        if (button) {
            button.disabled = true;
        }

        try {

            const snapshot =
                await ref.once("value");

            const liked =
                snapshot.val() === true ||
                snapshot.val() === 1;

            if (liked) {

                await ref.remove();

                setLikedUI(
                    article,
                    false
                );

            } else {

                await ref.set(true);

                setLikedUI(
                    article,
                    true
                );

            }

            await loadLikeCount(
                article,
                post
            );

        } catch (error) {

            console.error(
                "Like failed:",
                error
            );

            showToast(
                "Like failed."
            );

        } finally {

            if (button) {
                button.disabled = false;
            }

        }

    }


    function setLikedUI(
        article,
        liked
    ) {

        const button =
            article.querySelector(
                ".like-btn"
            );

        if (!button) {
            return;
        }

        button.classList.toggle(
            "liked",
            liked
        );

        button.innerHTML =
            liked
            ? `<i class="fa-solid fa-heart"></i>`
            : `<i class="fa-regular fa-heart"></i>`;

    }


    /* =====================================================
       SAVE
    ===================================================== */

    async function toggleSave(
        article,
        post
    ) {

        if (!currentUser) {

            showToast(
                "Please login to save."
            );

            return;

        }

        const uid =
            currentUser.uid;

        const ref =
            db.ref(
                "savedPosts/" +
                uid +
                "/" +
                post.id
            );

        const button =
            article.querySelector(
                ".save-btn"
            );

        if (button) {
            button.disabled = true;
        }

        try {

            const snapshot =
                await ref.once("value");

            if (snapshot.exists()) {

                await ref.remove();

                setSavedUI(
                    article,
                    false
                );

                showToast(
                    "Removed from saved."
                );

            } else {

                await ref.set({

                    postId:
                        post.id,

                    savedAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                });

                setSavedUI(
                    article,
                    true
                );

                showToast(
                    "Post saved."
                );

            }

        } catch (error) {

            console.error(
                "Save failed:",
                error
            );

            showToast(
                "Save failed."
            );

        } finally {

            if (button) {
                button.disabled = false;
            }

        }

    }


    function setSavedUI(
        article,
        saved
    ) {

        const button =
            article.querySelector(
                ".save-btn"
            );

        if (!button) {
            return;
        }

        button.classList.toggle(
            "saved",
            saved
        );

        button.innerHTML =
            saved
            ? `<i class="fa-solid fa-bookmark"></i>`
            : `<i class="fa-regular fa-bookmark"></i>`;

    }


    /* =====================================================
       SHARE
    ===================================================== */

    async function sharePost(post) {

        const uid =
            getAuthorUID(post);

        const url =
            window.location.origin +
            window.location.pathname +
            "?uid=" +
            encodeURIComponent(uid) +
            "&post=" +
            encodeURIComponent(post.id);

        try {

            if (
                typeof navigator.share ===
                "function"
            ) {

                await navigator.share({

                    title:
                        "Viewora Post",

                    text:
                        "Check out this post on Viewora.",

                    url

                });

            } else {

                await copyText(url);

                showToast(
                    "Post link copied!"
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
       COPY
    ===================================================== */

    async function copyText(text) {

        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {

            await navigator.clipboard.writeText(
                text
            );

            return true;

        }

        const textarea =
            document.createElement(
                "textarea"
            );

        textarea.value =
            text;

        textarea.style.position =
            "fixed";

        textarea.style.left =
            "-9999px";

        document.body.appendChild(
            textarea
        );

        textarea.select();

        let success = false;

        try {

            success =
                document.execCommand(
                    "copy"
                );

        } catch (_) {

            success = false;

        }

        textarea.remove();

        if (!success) {

            throw new Error(
                "Copy failed"
            );

        }

        return true;

    }


    /* =====================================================
       COMMENTS
    ===================================================== */

    function openComments(post) {

        activePost =
            post;

        commentSheet.classList.add(
            "show"
        );

        commentSheet.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "sheet-open"
        );

        loadComments(post);

    }


    function closeComments() {

        commentSheet.classList.remove(
            "show"
        );

        commentSheet.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "sheet-open"
        );

        activePost =
            null;

    }


    async function loadComments(post) {

        commentList.innerHTML = `

            <div class="comment-empty">
                Loading comments...
            </div>

        `;

        try {

            const snapshot =
                await db
                    .ref(
                        "comments/" +
                        post.id
                    )
                    .once("value");

            const data =
                snapshot.exists()
                    ? snapshot.val()
                    : {};

            const comments =
                objectToPosts(data)
                    .sort(
                        (a, b) =>
                            getPostTime(a) -
                            getPostTime(b)
                    );

            if (!comments.length) {

                commentList.innerHTML = `

                    <div class="comment-empty">
                        No comments yet.<br>
                        Be the first to comment.
                    </div>

                `;

                return;

            }

            commentList.innerHTML = "";

            for (const comment of comments) {

                const uid =
                    normalizeUID(
                        comment.uid ||
                        comment.userId ||
                        comment.authorId
                    );

                const user =
                    await getUser(uid);

                const avatar =
                    user.profilePhoto ||
                    user.profilePicture ||
                    user.photoURL ||
                    user.avatar ||
                    "assets/default-avatar.png";

                const author =
                    user.username ||
                    user.userName ||
                    user.name ||
                    user.fullName ||
                    "User";

                const text =
                    comment.text ||
                    comment.comment ||
                    "";

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "comment-item";

                item.innerHTML = `

                    <img
                        class="comment-avatar"
                        src="${escapeHTML(avatar)}"
                        alt=""
                        loading="lazy"
                    >

                    <div class="comment-body">

                        <div class="comment-author">
                            ${escapeHTML(author)}
                        </div>

                        <div class="comment-text">
                            ${escapeHTML(text)}
                        </div>

                    </div>

                `;

                commentList.appendChild(
                    item
                );

            }

        } catch (error) {

            console.error(
                "Comments failed:",
                error
            );

            commentList.innerHTML = `

                <div class="comment-empty">
                    Unable to load comments.
                </div>

            `;

        }

    }


    /* =====================================================
       ADD COMMENT
    ===================================================== */

    async function addComment() {

        if (!activePost) {
            return;
        }

        if (!currentUser) {

            showToast(
                "Please login to comment."
            );

            return;

        }

        const text =
            commentInput.value.trim();

        if (!text) {
            return;
        }

        if (commentSend) {
            commentSend.disabled = true;
        }

        try {

            const ref =
                db
                    .ref(
                        "comments/" +
                        activePost.id
                    )
                    .push();

            await ref.set({

                uid:
                    currentUser.uid,

                userId:
                    currentUser.uid,

                text,

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP

            });

            commentInput.value = "";

            showToast(
                "Comment added."
            );

            await loadComments(
                activePost
            );

        } catch (error) {

            console.error(
                "Comment failed:",
                error
            );

            showToast(
                "Comment failed."
            );

        } finally {

            if (commentSend) {
                commentSend.disabled = false;
            }

        }

    }


    /* =====================================================
       MENU
    ===================================================== */

    function openMenu(post) {

        activePost =
            post;

        menuSheet.classList.add(
            "show"
        );

        menuSheet.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "sheet-open"
        );

        const owner =
            Boolean(
                currentUser &&
                getAuthorUID(post) ===
                currentUser.uid
            );

        if (editPostBtn) {

            editPostBtn.hidden =
                !owner;

        }

        if (deletePostBtn) {

            deletePostBtn.hidden =
                !owner;

        }

    }


    function closeMenu() {

        menuSheet.classList.remove(
            "show"
        );

        menuSheet.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "sheet-open"
        );

    }


    /* =====================================================
       EDIT
    ===================================================== */

    editPostBtn?.addEventListener(
        "click",
        () => {

            if (!activePost) {
                return;
            }

            window.location.href =
                "edit-post.html?post=" +
                encodeURIComponent(
                    activePost.id
                );

        }
    );


    /* =====================================================
       DELETE
    ===================================================== */

    deletePostBtn?.addEventListener(
        "click",
        async () => {

            if (!activePost) {
                return;
            }

            if (
                !currentUser ||
                getAuthorUID(activePost) !==
                currentUser.uid
            ) {

                showToast(
                    "You can't delete this post."
                );

                return;

            }

            const confirmed =
                window.confirm(
                    "Delete this post?"
                );

            if (!confirmed) {
                return;
            }

            const post =
                activePost;

            const postID =
                post.id;

            const authorUID =
                getAuthorUID(post);

            try {

                /* ---------------------------------------
                   GLOBAL POST
                ---------------------------------------- */

                await db
                    .ref(
                        "posts/" +
                        postID
                    )
                    .remove();


                /* ---------------------------------------
                   USER NESTED POST
                ---------------------------------------- */

                if (authorUID) {

                    await db
                        .ref(
                            "users/" +
                            authorUID +
                            "/posts/" +
                            postID
                        )
                        .remove()
                        .catch(() => {});

                }


                /* ---------------------------------------
                   LIKES
                ---------------------------------------- */

                await db
                    .ref(
                        "likes/" +
                        postID
                    )
                    .remove()
                    .catch(() => {});


                /* ---------------------------------------
                   COMMENTS
                ---------------------------------------- */

                await db
                    .ref(
                        "comments/" +
                        postID
                    )
                    .remove()
                    .catch(() => {});


                /* ---------------------------------------
                   SAVED POSTS
                ---------------------------------------- */

                await removeSavedPostReferences(
                    postID
                );


                loadedPosts =
                    loadedPosts.filter(
                        item =>
                            String(item.id) !==
                            String(postID)
                    );

                closeMenu();

                const article =
                    feed.querySelector(
                        `[data-post-id="${cssEscape(String(postID))}"]`
                    );

                article?.remove();

                showToast(
                    "Post deleted."
                );

                if (!loadedPosts.length) {

                    showEmpty(
                        "No posts yet",
                        "This profile has no posts."
                    );

                } else {

                    counter.textContent =
                        `${loadedPosts.length} post${loadedPosts.length === 1 ? "" : "s"}`;

                }

                activePost =
                    null;

            } catch (error) {

                console.error(
                    "Delete failed:",
                    error
                );

                showToast(
                    "Delete failed."
                );

            }

        }
    );


    /* =====================================================
       REMOVE SAVED REFERENCES
    ===================================================== */

    async function removeSavedPostReferences(
        postID
    ) {

        try {

            const snapshot =
                await db
                    .ref("savedPosts")
                    .once("value");

            if (!snapshot.exists()) {
                return;
            }

            const users =
                snapshot.val() || {};

            const updates = {};

            Object.keys(users)
                .forEach(uid => {

                    if (
                        users[uid] &&
                        users[uid][postID]
                    ) {

                        updates[
                            uid +
                            "/" +
                            postID
                        ] = null;

                    }

                });

            if (
                Object.keys(updates).length
            ) {

                await db
                    .ref("savedPosts")
                    .update(
                        updates
                    );

            }

        } catch (error) {

            console.warn(
                "Saved references cleanup failed:",
                error
            );

        }

    }


    /* =====================================================
       COPY POST LINK
    ===================================================== */

    copyLinkBtn?.addEventListener(
        "click",
        async () => {

            if (!activePost) {
                return;
            }

            const uid =
                getAuthorUID(activePost);

            const url =
                window.location.origin +
                window.location.pathname +
                "?uid=" +
                encodeURIComponent(uid) +
                "&post=" +
                encodeURIComponent(
                    activePost.id
                );

            try {

                await copyText(url);

                showToast(
                    "Post link copied!"
                );

                closeMenu();

            } catch (error) {

                console.warn(
                    "Copy link failed:",
                    error
                );

                showToast(
                    "Unable to copy link."
                );

            }

        }
    );


    /* =====================================================
       BACK
    ===================================================== */

    backBtn?.addEventListener(
        "click",
        () => {

            if (
                window.history.length > 1
            ) {

                window.history.back();

            } else {

                window.location.href =
                    profileUID
                    ? "profile.html?uid=" +
                      encodeURIComponent(
                          profileUID
                      )
                    : "profile.html";

            }

        }
    );


    /* =====================================================
       HEADER MORE
    ===================================================== */

    headerMore?.addEventListener(
        "click",
        () => {

            if (activePost) {

                openMenu(
                    activePost
                );

                return;

            }

            if (loadedPosts.length) {

                openMenu(
                    loadedPosts[0]
                );

            }

        }
    );


    /* =====================================================
       COMMENT EVENTS
    ===================================================== */

    closeCommentsBtn?.addEventListener(
        "click",
        closeComments
    );

    commentBackdrop?.addEventListener(
        "click",
        closeComments
    );

    commentSend?.addEventListener(
        "click",
        addComment
    );

    commentInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                addComment();

            }

        }
    );


    /* =====================================================
       MENU EVENTS
    ===================================================== */

    menuBackdrop?.addEventListener(
        "click",
        closeMenu
    );

    
    /* =====================================================
       REPORT → report.html
    ===================================================== */

    document.getElementById("reportPostBtn")?.addEventListener(
        "click",
        () => {

            if (!activePost) {
                return;
            }

            const uid = getAuthorUID(activePost);

            const params = new URLSearchParams();

            params.set("type", "post");

            params.set("id", String(activePost.id));

            if (uid) {
                params.set("uid", uid);
            }

            window.location.href =
                "report.html?" +
                params.toString();

        }
    );


menuCancel?.addEventListener(
        "click",
        closeMenu
    );


    /* =====================================================
       DOUBLE TAP LIKE
    ===================================================== */

    document.addEventListener(
        "dblclick",
        event => {

            const media =
                event.target.closest(
                    ".post-media"
                );

            if (!media) {
                return;
            }

            const article =
                media.closest(
                    ".post"
                );

            if (!article) {
                return;
            }

            const post =
                loadedPosts.find(
                    item =>
                        String(item.id) ===
                        String(
                            article.dataset.postId
                        )
                );

            if (!post) {
                return;
            }

            if (doubleTapLock) {
                return;
            }

            doubleTapLock = true;

            toggleLike(
                article,
                post
            );

            setTimeout(
                () => {
                    doubleTapLock = false;
                },
                500
            );

        }
    );


    /* =====================================================
       ESCAPE KEY
    ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            if (
                commentSheet.classList.contains(
                    "show"
                )
            ) {

                closeComments();

            }

            if (
                menuSheet.classList.contains(
                    "show"
                )
            ) {

                closeMenu();

            }

        }
    );


    /* =====================================================
       CSS ESCAPE FALLBACK
    ===================================================== */

    function cssEscape(value) {

        if (
            window.CSS &&
            typeof CSS.escape ===
            "function"
        ) {

            return CSS.escape(value);

        }

        return String(value)
            .replace(
                /["\\]/g,
                "\\$&"
            );

    }


    /* =====================================================
       INIT
    ===================================================== */

    loadPosts();

})();