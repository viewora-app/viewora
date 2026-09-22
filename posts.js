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

    
function isEmptyLiveReplayPost(p) {
    if (!p) return false;
    const t = String(p.type || "").toLowerCase();
    if (p.isLiveReplay || t === "live" || t === "live_replay") {
        const media =
            p.mediaURL ||
            p.videoURL ||
            p.imageURL ||
            p.thumbnailURL ||
            (Array.isArray(p.images) && p.images.length) ||
            (Array.isArray(p.media) && p.media.length);
        return !media;
    }
    return false;
}

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

    

    function toUrlList(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(String).map(function (s) { return s.trim(); }).filter(Boolean);
        if (typeof val === "object") {
            return Object.keys(val).sort(function (a, b) {
                return (Number(a) || 0) - (Number(b) || 0);
            }).map(function (k) {
                const v = val[k];
                if (typeof v === "string") return v.trim();
                if (v && typeof v === "object") return String(v.url || v.mediaURL || v.downloadURL || "").trim();
                return "";
            }).filter(Boolean);
        }
        if (typeof val === "string" && val.trim()) return [val.trim()];
        return [];
    }

    function getMediaList(post) {
        if (!post) return [];
        const out = [];
        const push = function (u) {
            u = String(u || "").trim();
            if (u && out.indexOf(u) === -1) out.push(u);
        };
        toUrlList(post.mediaUrls).forEach(push);
        toUrlList(post.images).forEach(push);
        toUrlList(post.mediaList).forEach(push);
        if (post.media && typeof post.media === "object") {
            toUrlList(post.media.urls).forEach(push);
            push(post.media.url || post.media.mediaURL || post.media.downloadURL);
        }
        ["mediaURL","mediaUrl","imageURL","imageUrl","url","downloadURL"].forEach(function (k) {
            if (typeof post[k] === "string") push(post[k]);
        });
        return out.slice(0, 10);
    }

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

            loadedPosts = (loadedPosts || []).filter(function (post) {
                return !isEmptyLiveReplayPost(post);
            });

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

    
    function wirePostCarousels(root) {
        (root || document).querySelectorAll(".postMediaWrap.hasCarousel").forEach(function (wrap) {
            if (wrap.__carouselWired) return;
            wrap.__carouselWired = true;
            const track = wrap.querySelector(".postCarouselTrack") || wrap.querySelector(".postMediaTrack");
            const imgs = Array.from(wrap.querySelectorAll(".postMedia, .post-image"));
            const dots = wrap.querySelectorAll(".carouselDot");
            const countEl = wrap.querySelector(".carouselCount");
            let i = 0;
            const n = imgs.length || Number(wrap.getAttribute("data-carousel-count") || 0);
            if (n < 2) return;
            if (track) {
                track.style.display = "flex";
                track.style.transition = "transform 0.28s ease";
                track.style.width = "100%";
                imgs.forEach(function (img) {
                    img.style.display = "block";
                    img.style.flex = "0 0 100%";
                    img.style.width = "100%";
                    img.style.minWidth = "100%";
                    img.style.objectFit = "cover";
                });
            }
            function show(to) {
                if (!n) return;
                i = ((to % n) + n) % n;
                if (track) {
                    track.style.transform = "translate3d(-" + (i * 100) + "%,0,0)";
                }
                imgs.forEach(function (img, idx) {
                    img.classList.toggle("isActive", idx === i);
                });
                dots.forEach(function (d, idx) {
                    d.classList.toggle("active", idx === i);
                });
                if (countEl) countEl.textContent = (i + 1) + "/" + n;
            }
            show(0);
            wrap.querySelector(".carouselPrev")?.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                show(i - 1);
            });
            wrap.querySelector(".carouselNext")?.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                show(i + 1);
            });
            dots.forEach(function (d) {
                d.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    show(Number(d.getAttribute("data-dot")) || 0);
                });
            });
            let sx = 0, sy = 0, on = false;
            wrap.addEventListener("touchstart", function (e) {
                if (!e.touches || e.touches.length !== 1) return;
                sx = e.touches[0].clientX;
                sy = e.touches[0].clientY;
                on = true;
            }, { passive: true });
            wrap.addEventListener("touchend", function (e) {
                if (!on) return;
                on = false;
                const t = e.changedTouches && e.changedTouches[0];
                if (!t) return;
                const dx = t.clientX - sx;
                const dy = t.clientY - sy;
                if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
                if (dx < 0) show(i + 1);
                else show(i - 1);
            }, { passive: true });
        });
    }

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
        try { wirePostCarousels(feed); } catch (_) {}

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

        const mediaList = getMediaList(post);
        const mediaURL = mediaList[0] || getMediaURL(post);

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

        const hideLikes =
            post.hideLikes === true ||
            post.hideLikeCount === true ||
            post.likesHidden === true;
        const hideComments =
            post.allowComments === false ||
            post.hideComments === true ||
            post.commentsHidden === true ||
            post.disableComments === true;

        const musicObj = post.music || null;
        const musicUrl =
            (musicObj && (musicObj.audioUrl || musicObj.url || musicObj.previewUrl)) ||
            post.musicUrl ||
            post.audioUrl ||
            "";
        const musicTitle =
            (musicObj && (musicObj.title || musicObj.name)) ||
            post.musicTitle ||
            "Original audio";

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
                    video && mediaURL
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
                    : (mediaList.length
                        ? `<div class="postMediaWrap${mediaList.length > 1 ? " hasCarousel" : ""}" data-carousel-count="${mediaList.length}">
                            <div class="postCarouselTrack postMediaTrack">
                                ${mediaList.map((u, i) =>
                                    `<img src="${escapeHTML(u)}" alt="Post" class="post-image postMedia${i === 0 ? " isActive" : ""}" loading="${i === 0 ? "eager" : "lazy"}" data-carousel-i="${i}" data-view-image="${escapeHTML(u)}">`
                                ).join("")}
                            </div>
                            ${mediaList.length > 1
                                ? `<button type="button" class="carouselPrev" aria-label="Previous"><i class="fa-solid fa-chevron-left"></i></button>
                            <button type="button" class="carouselNext" aria-label="Next"><i class="fa-solid fa-chevron-right"></i></button>
                            <div class="carouselDots">${mediaList.map((_, i) =>
                                `<span class="carouselDot${i === 0 ? " active" : ""}" data-dot="${i}"></span>`
                            ).join("")}</div>
                            <span class="carouselCount">1/${mediaList.length}</span>`
                                : ""}
                        </div>`
                        : `<div class="no-media">No media</div>`)
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

                <div class="like-count" ${hideLikes ? 'hidden style="display:none"' : ""}>
                    ${hideLikes ? "" : formatNumber(likes) + " likes"}
                </div>

                ${
                    musicUrl
                    ? `<div class="post-music-bar" data-music-url="${escapeHTML(musicUrl)}" data-music-start="${Number((musicObj && musicObj.startAt) || post.musicStartAt || 0)}" data-music-duration="${Number((musicObj && musicObj.duration) || post.musicDuration || 15)}">
                            <div class="post-music-left">
                                <i class="fa-solid fa-music"></i>
                                <span class="post-music-title">${escapeHTML(musicTitle)}</span>
                            </div>
                            <button type="button" class="post-music-mute" aria-label="Sound">
                                <i class="fa-solid fa-volume-high"></i>
                            </button>
                       </div>`
                    : ""
                }


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


                <div class="comment-preview" ${hideComments ? 'hidden style="display:none"' : ""}>

                    ${
                        !hideComments && comments > 0
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

        let verified = false;
        let badgeHtml = "";
        if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
            const b = VieworaBadges.resolve(user);
            verified = b.level !== "none";
            badgeHtml = b.html || "";
        } else {
            verified =
                user.verified === true ||
                user.isVerified === true ||
                user.blueTick === true ||
                user.redTick === true;
            if (user.redTick || user.vip) {
                badgeHtml = '<i class="fa-solid fa-certificate vieworaTick redTick" title="VIP"></i>';
            } else if (verified) {
                badgeHtml = '<i class="fa-solid fa-circle-check vieworaTick blueTick verifiedTick"></i>';
            } else if (user.whiteTick) {
                verified = true;
                badgeHtml = '<i class="fa-solid fa-circle-check vieworaTick whiteTick"></i>';
            }
        }

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
            verifiedEl.hidden = !verified;
            if (verified && badgeHtml) {
                verifiedEl.innerHTML = badgeHtml;
                verifiedEl.removeAttribute("hidden");
            }
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

            // Dedupe
            const byFp = {};
            comments.forEach(function (c) {
                const fp =
                    String(c.uid || c.userId || "") +
                    "|" +
                    String(c.text || c.comment || "").trim().toLowerCase() +
                    "|" +
                    String(c.parentId || "root");
                const t = Number(c.createdAt || c.timestamp || 0);
                if (!byFp[fp] || t > Number(byFp[fp].createdAt || byFp[fp].timestamp || 0)) {
                    byFp[fp] = c;
                }
            });
            const deduped = Object.keys(byFp).map(function (k) { return byFp[k]; });
            const roots = deduped.filter(function (c) { return !c.parentId; });
            const kids = {};
            deduped.forEach(function (c) {
                if (c.parentId) {
                    if (!kids[c.parentId]) kids[c.parentId] = [];
                    kids[c.parentId].push(c);
                }
            });
            const ordered = [];
            roots.sort(function (a, b) {
                return Number(b.createdAt || b.timestamp || 0) - Number(a.createdAt || a.timestamp || 0);
            });
            roots.forEach(function (r) {
                ordered.push(r);
                (kids[r.id] || []).forEach(function (k) { ordered.push(k); });
            });

            commentList.innerHTML = "";

            for (const comment of ordered) {
                const uid = normalizeUID(
                    comment.uid || comment.userId || comment.authorId
                );
                const user = await getUser(uid);
                const avatar =
                    comment.profilePhoto ||
                    comment.photoURL ||
                    user.profilePhoto ||
                    user.profilePicture ||
                    user.photoURL ||
                    user.avatar ||
                    "assets/default-avatar.png";
                const author =
                    comment.displayName ||
                    comment.name ||
                    user.username ||
                    user.userName ||
                    user.name ||
                    user.fullName ||
                    "User";
                const text = comment.text || comment.comment || "";
                let tick = "";
                try {
                    if (window.VieworaBadges && VieworaBadges.resolve) {
                        const r = VieworaBadges.resolve(Object.assign({}, user, comment));
                        tick = (r && r.html) ? r.html : "";
                    }
                } catch (_) {}
                const likes = Number(comment.likesCount || comment.likes || 0) || 0;
                const replyHint = comment.replyToName
                    ? '<div class="csReplyLabel">↳ @' + escapeHTML(String(comment.replyToName).replace(/^@/, "")) + "</div>"
                    : "";
                const item = document.createElement("div");
                item.className = "comment-item" + (comment.parentId ? " csReplyItem" : "");
                item.innerHTML =
                    '<img class="comment-avatar" src="' + escapeHTML(avatar) + '" alt="" loading="lazy">' +
                    '<div class="comment-body">' +
                    '<div class="comment-author">' + escapeHTML(author) + (tick ? " " + tick : "") + "</div>" +
                    replyHint +
                    '<div class="comment-text">' + escapeHTML(text) + "</div>" +
                    '<div class="commentMeta">' +
                    '<button type="button" class="cLike" data-id="' + escapeHTML(comment.id) + '">' +
                    '<i class="fa-regular fa-heart"></i> ' + likes + "</button>" +
                    '<button type="button" class="cReply" data-reply-id="' + escapeHTML(comment.id) +
                    '" data-reply-name="' + escapeHTML(author) + '">Reply</button>' +
                    "</div></div>";
                commentList.appendChild(item);
            }

            commentList.querySelectorAll(".cLike").forEach(function (btn) {
                btn.addEventListener("click", async function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!currentUser || !activePost) return;
                    if (btn.dataset.busy === "1") return;
                    btn.dataset.busy = "1";
                    const cid = btn.getAttribute("data-id");
                    try {
                        const ref = db.ref("comments/" + activePost.id + "/" + cid + "/likedBy/" + currentUser.uid);
                        const snap = await ref.once("value");
                        const was = snap.exists();
                        if (was) await ref.remove();
                        else await ref.set(true);
                        const tree = await db.ref("comments/" + activePost.id + "/" + cid + "/likedBy").once("value");
                        const count = tree.exists() ? Object.keys(tree.val() || {}).length : 0;
                        await db.ref("comments/" + activePost.id + "/" + cid).update({ likesCount: count, likes: count });
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
            commentList.querySelectorAll(".cReply").forEach(function (btn) {
                btn.addEventListener("click", function (e) {
                    e.preventDefault();
                    window.__postReplyToId = btn.getAttribute("data-reply-id") || "";
                    window.__postReplyToName = btn.getAttribute("data-reply-name") || "";
                    if (commentInput) {
                        commentInput.focus();
                        commentInput.placeholder = "Reply to @" + window.__postReplyToName + "…";
                    }
                });
            });

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

    let __postCommentInFlight = false;
    async function addComment() {
        if (!activePost) return;
        if (!currentUser) {
            showToast("Please login to comment.");
            return;
        }
        if (__postCommentInFlight) return;
        const text = (commentInput && commentInput.value || "").trim();
        if (!text) return;
        __postCommentInFlight = true;
        if (commentSend) commentSend.disabled = true;
        try {
            let finalText = text;
            const parentId = window.__postReplyToId || null;
            const replyToName = window.__postReplyToName || "";
            if (parentId && replyToName) {
                const m = "@" + String(replyToName).replace(/^@/, "");
                if (finalText.indexOf(m) !== 0) finalText = m + " " + finalText;
            }
            const ref = db.ref("comments/" + activePost.id).push();
            await ref.set({
                uid: currentUser.uid,
                userId: currentUser.uid,
                text: finalText,
                parentId: parentId || null,
                replyToName: replyToName || null,
                likesCount: 0,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                timestamp: Date.now()
            });
            if (commentInput) {
                commentInput.value = "";
                commentInput.placeholder = "Add a comment...";
            }
            window.__postReplyToId = "";
            window.__postReplyToName = "";
            showToast("Comment added.");
            await loadComments(activePost);
        } catch (error) {
            console.error("Comment failed:", error);
            showToast("Comment failed.");
        } finally {
            __postCommentInFlight = false;
            if (commentSend) commentSend.disabled = false;
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


    (function wirePostMusicAndZoom() {
        let audio = null;
        let muted = false;
        try { muted = localStorage.getItem("viewora_post_music_muted") === "1"; } catch (_) {}
        let activeBar = null;

        function stopMusic() {
            try { if (audio) { audio.pause(); audio.src = ""; audio = null; } } catch (_) {}
            document.querySelectorAll(".post-music-bar.isPlaying").forEach((b) => b.classList.remove("isPlaying"));
            activeBar = null;
        }
        function playMusic(url, bar) {
            if (!url) return;
            if (activeBar === bar && audio && !audio.paused) return;
            stopMusic();
            try {
                audio = new Audio(url);
                const startAt = Number(
                    (bar && (bar.getAttribute("data-music-start") || bar.dataset.musicStart)) || 0
                ) || 0;
                const dur = Number(
                    (bar && (bar.getAttribute("data-music-duration") || bar.dataset.musicDuration)) || 15
                ) || 15;
                audio.loop = false;
                audio.muted = muted;
                audio.volume = muted ? 0 : 0.9;
                audio.addEventListener("loadedmetadata", function () {
                    try { audio.currentTime = startAt; } catch (_) {}
                });
                audio.addEventListener("timeupdate", function () {
                    try {
                        if (audio.currentTime >= startAt + dur) {
                            audio.currentTime = startAt;
                            audio.play().catch(function () {});
                        }
                    } catch (_) {}
                });
                audio.play().catch(function () {});
                activeBar = bar || null;
                if (bar) bar.classList.add("isPlaying");
                syncMute();
            } catch (_) {}
        }
        function syncMute() {
            document.querySelectorAll(".post-music-mute i").forEach((icon) => {
                icon.className = muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
            });
        }
        syncMute();

        document.addEventListener("click", function (e) {
            const muteBtn = e.target.closest && e.target.closest(".post-music-mute");
            if (!muteBtn) return;
            e.preventDefault();
            e.stopPropagation();
            muted = !muted;
            try { localStorage.setItem("viewora_post_music_muted", muted ? "1" : "0"); } catch (_) {}
            if (audio) { audio.muted = muted; audio.volume = muted ? 0 : 0.9; }
            syncMute();
        }, true);

        if (window.IntersectionObserver) {
            const obs = new IntersectionObserver(function (entries) {
                let best = null, bestRatio = 0.25;
                entries.forEach(function (en) {
                    if (en.isIntersecting && en.intersectionRatio >= bestRatio) {
                        bestRatio = en.intersectionRatio;
                        best = en.target;
                    }
                });
                if (!best) {
                    // no visible post → stop
                    try { stopMusic(); } catch (_) {}
                    return;
                }
                const bar = best.querySelector(".post-music-bar, .postMusicBar");
                if (!bar) {
                    // visible post has NO music → stop
                    try { stopMusic(); } catch (_) {}
                    return;
                }
                const url = bar.getAttribute("data-music-url") || "";
                if (url) playMusic(url, bar);
                else try { stopMusic(); } catch (_) {}
            }, { root: null, rootMargin: "-15% 0px -35% 0px", threshold: [0.25, 0.4, 0.55, 0.7, 0.85] });

            function observePosts() {
                document.querySelectorAll("article.post, .post, article[data-post-id]").forEach(function (card) {
                    if (card.__musicObs) return;
                    card.__musicObs = true;
                    obs.observe(card);
                });
            }
            observePosts();
            const feed = document.getElementById("postFeed") || document.body;
            try {
                new MutationObserver(observePosts).observe(feed, { childList: true, subtree: true });
            } catch (_) {}
        }

        document.addEventListener("visibilitychange", function () {
            if (document.hidden) { try { audio && audio.pause(); } catch (_) {} }
            else if (audio) { audio.play().catch(function () {}); }
        });

        /* Pinch zoom */
        function enablePinchZoom(target) {
            if (!target || target.__pinchBound) return;
            target.__pinchBound = true;
            var scale = 1, lastScale = 1, startDist = 0, tx = 0, ty = 0, startX = 0, startY = 0, panning = false, lastTap = 0;
            function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
            function apply() { target.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")"; target.style.transformOrigin = "center center"; }
            function reset() { scale = 1; lastScale = 1; tx = 0; ty = 0; target.style.transform = ""; }
            target.addEventListener("touchstart", function (e) {
                if (e.touches.length === 2) { e.preventDefault(); startDist = dist(e.touches); lastScale = scale; panning = false; }
                else if (e.touches.length === 1 && scale > 1.05) { panning = true; startX = e.touches[0].clientX - tx; startY = e.touches[0].clientY - ty; }
            }, { passive: false });
            target.addEventListener("touchmove", function (e) {
                if (e.touches.length === 2 && startDist > 0) { e.preventDefault(); scale = Math.min(4, Math.max(1, lastScale * (dist(e.touches) / startDist))); apply(); }
                else if (e.touches.length === 1 && panning) { e.preventDefault(); tx = e.touches[0].clientX - startX; ty = e.touches[0].clientY - startY; apply(); }
            }, { passive: false });
            target.addEventListener("touchend", function (e) {
                if (e.touches.length < 2) startDist = 0;
                if (e.touches.length === 0) panning = false;
                if (scale < 1.05) reset();
            });
            target.addEventListener("click", function (e) {
                var now = Date.now();
                if (now - lastTap < 280) { e.preventDefault(); e.stopPropagation(); if (scale > 1.2) reset(); else { scale = 2.2; lastScale = 2.2; apply(); } }
                lastTap = now;
            });
        }
        function bindAllImages() {
            document.querySelectorAll(".post-image, .post-media img").forEach(enablePinchZoom);
        }
        bindAllImages();
        try {
            new MutationObserver(bindAllImages).observe(document.getElementById("postFeed") || document.body, { childList: true, subtree: true });
        } catch (_) {}

        if (!document.getElementById("vieworaPostMusicZoomCSS")) {
            var s = document.createElement("style");
            s.id = "vieworaPostMusicZoomCSS";
            s.textContent = `
              .post-music-bar {
                display: flex; align-items: center; justify-content: space-between;
                gap: 10px; margin: 0; padding: 10px 14px 4px; background: transparent;
              }
              .post-music-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
              .post-music-left i { color: #a78bfa; font-size: 13px; }
              .post-music-title {
                min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                color: #c9c9d3; font-size: 12px; font-weight: 600;
              }
              .post-music-bar.isPlaying .post-music-title { color: #fff; }
              .post-music-mute {
                width: 40px; height: 40px; flex: 0 0 40px; margin-left: auto;
                display: grid; place-items: center; border: 0; border-radius: 50%;
                background: rgba(255,255,255,.1); color: #fff; cursor: pointer;
              }
              .post-image, .post-media img { touch-action: none; user-select: none; }
              .post-media { overflow: hidden; }
            `;
            document.head.appendChild(s);
        }
    })();
})();
