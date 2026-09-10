"use strict";

/*
============================================================
 VIEWORA — INDEX.JS
 Premium Home Feed
 Firebase Realtime Database
 Cloudinary Media URLs
============================================================
*/

(() => {

    /* ======================================================
       PREVENT DOUBLE INITIALIZATION
    ====================================================== */

    if (window.__VIEWORA_INDEX_INITIALIZED__) {
        console.warn("Viewora index.js already initialized.");
        return;
    }

    window.__VIEWORA_INDEX_INITIALIZED__ = true;


    /* ======================================================
       HELPERS
    ====================================================== */

    const $ = (id) => document.getElementById(id);

    const escapeHTML = (value) => {
        if (value === null || value === undefined) return "";

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };


    const safeURL = (value) => {
        if (!value) return "";

        try {
            const url = new URL(value, window.location.href);

            if (
                url.protocol === "https:" ||
                url.protocol === "http:"
            ) {
                return url.href;
            }

            return "";
        } catch {
            return "";
        }
    };


    const formatCount = (number) => {

        number = Number(number || 0);

        if (number >= 1000000) {
            return (number / 1000000).toFixed(1).replace(".0", "") + "M";
        }

        if (number >= 1000) {
            return (number / 1000).toFixed(1).replace(".0", "") + "K";
        }

        return String(number);
    };


    const formatTime = (timestamp) => {

        if (!timestamp) return "Just now";

        const time = Number(timestamp);

        if (!time) return "Just now";

        const diff = Date.now() - time;

        const minute = 60000;
        const hour = minute * 60;
        const day = hour * 24;

        if (diff < minute) {
            return "Just now";
        }

        if (diff < hour) {
            return Math.floor(diff / minute) + "m";
        }

        if (diff < day) {
            return Math.floor(diff / hour) + "h";
        }

        if (diff < day * 7) {
            return Math.floor(diff / day) + "d";
        }

        return new Date(time).toLocaleDateString();
    };


    const getAvatar = (data) => {
        if (!data || typeof data !== "object") {
            return "assets/default-avatar.png";
        }

        const url =
            data.userPhoto ||
            data.profilePhoto ||
            data.photoURL ||
            data.avatar ||
            data.profilePic ||
            data.profile_image ||
            data.image ||
            data.dp ||
            "";

        return safeURL(url) || "assets/default-avatar.png";
    };

    const isVerifiedUser = (data) => {
        if (!data || typeof data !== "object") return false;
        if (window.VieworaBadges && typeof VieworaBadges.isVerified === "function") {
            return VieworaBadges.isVerified(data);
        }
        return (
            data.redTick === true ||
            data.vip === true ||
            data.verified === true ||
            data.isVerified === true ||
            data.blueTick === true ||
            data.whiteTick === true ||
            data.badge === "verified" ||
            data.verification === true ||
            data.verificationStatus === "verified"
        );
    };

    const verifiedBadgeHTML = (data) => {
        if (!data || typeof data !== "object") return "";
        if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
            return VieworaBadges.resolve(data).html || "";
        }
        if (!isVerifiedUser(data)) return "";
        // Prefer blue over white when flags mixed
        if (data.redTick || data.vip) {
            return `<i class="fa-solid fa-certificate vieworaTick redTick" title="VIP Elite"></i>`;
        }
        if (data.verified || data.isVerified || data.blueTick) {
            return `<i class="fa-solid fa-circle-check vieworaTick blueTick verifiedTick" title="Verified"></i>`;
        }
        if (data.whiteTick) {
            return `<i class="fa-solid fa-circle-check vieworaTick whiteTick" title="Monetized"></i>`;
        }
        return `<i class="fa-solid fa-circle-check vieworaTick blueTick verifiedTick" title="Verified"></i>`;
    };

    /* Cache users node for avatar / verified / name */
    const userNodeCache = {};

    async function fetchUserNode(uid) {
        if (!uid) return null;
        if (userNodeCache[uid]) return userNodeCache[uid];
        try {
            const snap = await db.ref("users/" + uid).once("value");
            if (!snap.exists()) {
                userNodeCache[uid] = null;
                return null;
            }
            const data = snap.val() || {};
            userNodeCache[uid] = data;
            return data;
        } catch (e) {
            return null;
        }
    }


    const getMediaURL = (data) => {

        return safeURL(
            data?.imageUrl ||
            data?.mediaUrl ||
            data?.image ||
            data?.photoURL ||
            data?.photo ||
            ""
        );
    };


    const getVideoURL = (data) => {

        return safeURL(
            data?.videoUrl ||
            data?.videoURL ||
            data?.mediaUrl ||
            data?.mediaURL ||
            ""
        );
    };


    const getThumbnailURL = (data) => {

        return safeURL(
            data?.thumbnailUrl ||
            data?.thumbnailURL ||
            data?.thumbnail ||
            data?.coverUrl ||
            data?.imageUrl ||
            ""
        );
    };


    /* ======================================================
       FIREBASE
    ====================================================== */

    function getDatabase() {

        if (window.firebaseDB) {
            return window.firebaseDB;
        }

        if (typeof firebase !== "undefined") {

            try {
                return firebase.database();
            } catch (error) {
                console.error(
                    "Firebase database unavailable:",
                    error
                );
            }

        }

        return null;
    }


    const db = getDatabase();


    if (!db) {

        console.error(
            "Viewora: Firebase Database not found."
        );

        return;
    }


    /* ======================================================
       DOM
    ====================================================== */

    const feedContainer = $("feedContainer");
    const feedSkeleton = $("feedSkeleton");

    const longVideoContainer =
        $("longVideoContainer");

    const videoSkeleton =
        $("videoSkeleton");

    const searchInput =
        $("searchInput");

    const searchResults =
        $("searchResults");


    /* ======================================================
       LOADING
    ====================================================== */

    function hideSkeleton(element) {

        if (!element) return;

        element.style.display = "none";
    }


    function showEmpty(container, icon, title, text) {

        if (!container) return;

        container.innerHTML = `

            <div class="emptyState">

                <i class="${escapeHTML(icon)}"></i>

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
                    ${escapeHTML(text)}
                </p>

            </div>

        `;
    }


    /* ======================================================
       POST CARD
    ====================================================== */

    function createPostCard(id, data) {

        const avatar =
            getAvatar(data);

        const media =
            getMediaURL(data);

        const username =
            escapeHTML(
                data.username ||
                data.displayName ||
                data.name ||
                data.fullName ||
                "Viewora User"
            );

        const verifiedIcon = verifiedBadgeHTML(data);

        const caption =
            escapeHTML(
                data.caption ||
                data.description ||
                ""
            );

        const likes =
            formatCount(
                data.likesCount ||
                data.likes ||
                0
            );

        const comments =
            formatCount(
                data.commentsCount ||
                data.comments ||
                0
            );

        const views =
            formatCount(
                data.views ||
                0
            );

        const time =
            formatTime(
                data.createdAt ||
                data.timestamp ||
                data.time
            );


        const article =
            document.createElement("article");


        article.className =
            "vieworaPostCard";


        article.dataset.postId =
            id;
        const cat = String(
            data.category || data.topic || data.genre || data.tag || ""
        ).toLowerCase();
        if (cat) article.dataset.category = cat;
        const tags = data.tags || data.hashtags || "";
        if (tags) article.dataset.tags = Array.isArray(tags) ? tags.join(",") : String(tags);



        article.innerHTML = `

            <div class="postHeader">

                <button
                    class="postUser"
                    type="button"
                    data-user-id="${escapeHTML(
                        data.uid ||
                        data.userId ||
                        ""
                    )}"
                >

                    <img
                        src="${escapeHTML(avatar)}"
                        alt="${escapeHTML(username)}"
                        class="postAvatar"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='assets/default-avatar.png'"
                    >

                    <span class="postUserInfo">

                        <strong>
                            ${username}${verifiedIcon}
                        </strong>

                        <small>
                            ${escapeHTML(time)}
                        </small>

                    </span>

                </button>

                <button
                    class="postMore"
                    type="button"
                    aria-label="More options"
                >
                    <i class="fa-solid fa-ellipsis"></i>
                </button>

            </div>


            ${
                media
                    ? `
                        <div class="postMediaWrap">

                            <img
                                src="${escapeHTML(media)}"
                                alt="Viewora post"
                                class="postMedia"
                                loading="lazy"
                                data-view-image="${escapeHTML(media)}"
                            >

                        </div>
                      `
                    : ""
            }


            ${
                caption
                    ? `
                        <div class="postCaption">

                            ${caption}

                        </div>
                      `
                    : ""
            }


            <div class="postActions">

                <button
                    type="button"
                    class="postAction"
                    data-action="like"
                >
                    <i class="fa-regular fa-heart"></i>

                    <span>
                        ${likes}
                    </span>
                </button>


                <button
                    type="button"
                    class="postAction"
                    data-action="comment"
                >
                    <i class="fa-regular fa-comment"></i>

                    <span>
                        ${comments}
                    </span>
                </button>


                <button
                    type="button"
                    class="postAction"
                    data-action="share"
                >
                    <i class="fa-regular fa-paper-plane"></i>
                </button>


                <button
                    type="button"
                    class="postAction saveAction"
                    data-action="save"
                >
                    <i class="fa-regular fa-bookmark"></i>
                </button>

            </div>


            <div class="postStats">

                <span>
                    ${views} views
                </span>

            </div>

        `;


        return article;
    }


    /* ======================================================
       RENDER POSTS
    ====================================================== */

    async function renderPosts(snapshot) {

        if (!feedContainer) return;

        feedContainer.innerHTML = "";

        const posts = [];

        snapshot.forEach((child) => {
            const data = child.val() || {};

            /*
             * Only normal posts.
             * Videos/shorts are ignored here.
             */
            const type = String(data.type || "post").toLowerCase();

            if (
                type === "post" ||
                type === "image" ||
                type === "photo" ||
                !data.type
            ) {
                posts.push({
                    id: child.key,
                    data
                });
            }
        });

        posts.sort((a, b) => {
            const timeA = Number(a.data.createdAt || a.data.timestamp || 0);
            const timeB = Number(b.data.createdAt || b.data.timestamp || 0);
            return timeB - timeA;
        });

        // Private account posts: only own + following
        if (getCurrentUID()) {
            if (!followingSet.size) {
                await loadFollowingSet(getCurrentUID());
            }
            const visible = [];
            for (const post of posts) {
                const owner =
                    post.data.uid ||
                    post.data.userId ||
                    post.data.ownerId ||
                    "";
                if (await canViewUserContent(owner)) {
                    visible.push(post);
                }
            }
            posts.length = 0;
            posts.push(...visible);
        }

        hideSkeleton(feedSkeleton);

        if (!posts.length) {
            showEmpty(
                feedContainer,
                "fa-regular fa-images",
                "No posts yet",
                "When people share posts, they will appear here."
            );
            return;
        }

        // Enrich from users/ for avatar, name, verified
        await Promise.all(
            posts.map(async (post) => {
                const uid =
                    post.data.uid ||
                    post.data.userId ||
                    post.data.ownerId ||
                    "";
                if (!uid) return;

                const user = await fetchUserNode(uid);
                if (!user) return;

                // Fill missing profile photo
                if (
                    !post.data.userPhoto &&
                    !post.data.profilePhoto &&
                    !post.data.photoURL &&
                    !post.data.avatar
                ) {
                    post.data.profilePhoto =
                        user.profilePhoto ||
                        user.photoURL ||
                        user.avatar ||
                        "";
                    post.data.photoURL = post.data.profilePhoto;
                    post.data.userPhoto = post.data.profilePhoto;
                }

                // Fill missing name
                if (
                    !post.data.username &&
                    !post.data.displayName &&
                    !post.data.name
                ) {
                    post.data.username =
                        user.username ||
                        user.displayName ||
                        user.name ||
                        "";
                    post.data.displayName =
                        user.displayName ||
                        user.name ||
                        user.username ||
                        "";
                    post.data.name = user.name || user.fullName || "";
                }

                // Copy full badge / subscription flags from users node
                [
                    "verified","isVerified","blueTick","redTick","vip","elite",
                    "whiteTick","monetized","monetization","monetizationStatus",
                    "verificationStatus","badge","role","premium","isPremium","plan",
                    "subscription","subscriptionActive","followers","followersCount"
                ].forEach((k) => {
                    if (user[k] !== undefined && user[k] !== null) {
                        post.data[k] = user[k];
                    }
                });
                if (isVerifiedUser(user)) {
                    post.data.verified = true;
                }
            })
        );

        const fragment = document.createDocumentFragment();

        posts.forEach((post) => {
            fragment.appendChild(
                createPostCard(post.id, post.data)
            );
        });

        feedContainer.appendChild(fragment);

        bindPostEvents();
        // Show red heart if already liked + correct count
        hydratePostLikes();
    }


    /* ======================================================
       LOAD POSTS
    ====================================================== */

    function loadPosts() {

        if (!feedContainer) return;


        if (feedSkeleton) {
            feedSkeleton.style.display = "";
        }


        db.ref("posts")
            .on(
                "value",
                renderPosts,
                (error) => {

                    console.error(
                        "Viewora posts error:",
                        error
                    );

                    hideSkeleton(feedSkeleton);

                    showEmpty(
                        feedContainer,
                        "fa-solid fa-triangle-exclamation",
                        "Unable to load posts",
                        "Please check your Firebase connection."
                    );

                }
            );

    }


    /* ======================================================
       LONG VIDEO CARD
    ====================================================== */

    function createVideoCard(id, data) {

        const video =
            getVideoURL(data);

        const thumbnail =
            getThumbnailURL(data);

        const avatar =
            getAvatar(data);

        const title =
            escapeHTML(
                data.title ||
                data.caption ||
                "Untitled video"
            );

        const username =
            escapeHTML(
                data.username ||
                data.displayName ||
                data.name ||
                data.fullName ||
                data.userName ||
                "Viewora User"
            );

        const views =
            formatCount(
                data.views ||
                0
            );

        const time =
            formatTime(
                data.createdAt ||
                data.timestamp ||
                data.time
            );


        const card =
            document.createElement("article");


        card.className =
            "longVideoCard";


        card.dataset.videoId =
            id;

        card.dataset.uid =
            data.uid ||
            data.userId ||
            data.ownerId ||
            data.creatorId ||
            "";


        card.innerHTML = `

            <div
                class="videoThumbnailWrap"
                data-video-id="${escapeHTML(id)}"
            >

                ${
                    thumbnail
                        ? `
                            <img
                                src="${escapeHTML(thumbnail)}"
                                class="videoThumbnail"
                                alt="${title}"
                                loading="lazy"
                            >
                          `
                        : `
                            <div class="videoThumbnailFallback">
                                <i class="fa-solid fa-play"></i>
                            </div>
                          `
                }


                <span class="videoPlayButton">

                    <i class="fa-solid fa-play"></i>

                </span>

            </div>


            <div class="videoInfo">

                <img
                    src="${escapeHTML(avatar)}"
                    alt="${username}"
                    class="videoAvatar"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='assets/default-avatar.png'"
                >


                <div class="videoMeta">

                    <h3>
                        ${title}
                    </h3>

                    <div class="videoSubMeta">

                        <span>
                            ${username}${verifiedBadgeHTML(data)}
                        </span>

                        <span>•</span>

                        <span>
                            ${views} views
                        </span>

                        <span>•</span>

                        <span>
                            ${escapeHTML(time)}
                        </span>

                    </div>

                </div>


                <button
                    class="videoMore"
                    type="button"
                    aria-label="More"
                >

                    <i class="fa-solid fa-ellipsis-vertical"></i>

                </button>

            </div>

        `;


        return card;
    }


    /* ======================================================
       RENDER LONG VIDEOS
    ====================================================== */

    function renderLongVideos(snapshot) {

        if (!longVideoContainer) return;

        longVideoContainer.innerHTML = "";

        const videos = [];


        snapshot.forEach((child) => {

            const data =
                child.val() || {};


            const type =
                String(
                    data.type ||
                    ""
                ).toLowerCase();


            if (
                type === "video" ||
                type === "long_video" ||
                type === "long-video" ||
                Boolean(
                    data.videoUrl ||
                    data.videoURL
                )
            ) {

                videos.push({
                    id: child.key,
                    data
                });

            }

        });


        videos.sort((a, b) => {

            const timeA =
                Number(
                    a.data.createdAt ||
                    a.data.timestamp ||
                    0
                );

            const timeB =
                Number(
                    b.data.createdAt ||
                    b.data.timestamp ||
                    0
                );

            return timeB - timeA;

        });


        hideSkeleton(videoSkeleton);


        if (!videos.length) {

            showEmpty(
                longVideoContainer,
                "fa-solid fa-video",
                "No long videos yet",
                "Long videos will appear here."
            );

            return;
        }


        // Enrich creators from users/
        Promise.all(
            videos.map(async (video) => {
                const uid =
                    video.data.uid ||
                    video.data.userId ||
                    video.data.ownerId ||
                    video.data.creatorId ||
                    "";
                if (!uid) return;
                const user = await fetchUserNode(uid);
                if (!user) return;

                if (
                    !video.data.userPhoto &&
                    !video.data.profilePhoto &&
                    !video.data.photoURL &&
                    !video.data.avatar
                ) {
                    video.data.profilePhoto =
                        user.profilePhoto ||
                        user.photoURL ||
                        "";
                    video.data.photoURL = video.data.profilePhoto;
                    video.data.userPhoto = video.data.profilePhoto;
                }

                if (
                    !video.data.username &&
                    !video.data.displayName &&
                    !video.data.name
                ) {
                    video.data.username =
                        user.username ||
                        user.displayName ||
                        user.name ||
                        "";
                    video.data.displayName =
                        user.displayName ||
                        user.name ||
                        user.username ||
                        "";
                    video.data.name =
                        user.name || user.fullName || "";
                }

                [
                    "verified","isVerified","blueTick","redTick","vip","elite",
                    "whiteTick","monetized","monetization","monetizationStatus",
                    "verificationStatus","badge","role","premium","isPremium","plan",
                    "subscription","subscriptionActive","followers","followersCount"
                ].forEach((k) => {
                    if (user[k] !== undefined && user[k] !== null) {
                        video.data[k] = user[k];
                    }
                });
                if (isVerifiedUser(user)) {
                    video.data.verified = true;
                }
            })
        ).then(async () => {
            if (getCurrentUID()) {
                if (!followingSet.size) {
                    await loadFollowingSet(getCurrentUID());
                }
                const visible = [];
                for (const video of videos) {
                    const owner =
                        video.data.uid ||
                        video.data.userId ||
                        video.data.ownerId ||
                        video.data.creatorId ||
                        "";
                    if (await canViewUserContent(owner)) {
                        visible.push(video);
                    }
                }
                videos.length = 0;
                videos.push(...visible);
            }

            if (!videos.length) {
                showEmpty(
                    longVideoContainer,
                    "fa-solid fa-video",
                    "No long videos yet",
                    "Long videos will appear here."
                );
                return;
            }

            const fragment = document.createDocumentFragment();

            videos.forEach((video) => {
                fragment.appendChild(
                    createVideoCard(video.id, video.data)
                );
            });

            longVideoContainer.appendChild(fragment);
            bindVideoEvents();
        });

    }


    /* ======================================================
       LOAD LONG VIDEOS
    ====================================================== */

    function loadLongVideos() {

        if (!longVideoContainer) return;


        /*
         * Long videos are stored under /videos
         * (edit-video.js / video.js). Also merge
         * any video-type posts under /posts.
         */
        const videoMap = new Map();


        const mergeAndRender = () => {

            const fakeSnapshot = {
                forEach: (cb) => {
                    videoMap.forEach((data, id) => {
                        cb({
                            key: id,
                            val: () => data
                        });
                    });
                }
            };

            renderLongVideos(fakeSnapshot);
        };


        const ingest = (snapshot) => {

            snapshot.forEach((child) => {

                const data =
                    child.val() || {};

                const type =
                    String(
                        data.type ||
                        ""
                    ).toLowerCase();

                const hasVideo =
                    Boolean(
                        data.videoUrl ||
                        data.videoURL ||
                        data.video ||
                        data.mediaUrl
                    );

                if (
                    type === "video" ||
                    type === "long_video" ||
                    type === "long-video" ||
                    type === "long" ||
                    hasVideo
                ) {

                    /*
                     * Prefer published / public when flag exists
                     */
                    const vis =
                        String(
                            data.visibility ||
                            "public"
                        ).toLowerCase();

                    if (
                        vis === "private" ||
                        data.deleted === true ||
                        data.archived === true
                    ) {
                        return;
                    }

                    videoMap.set(
                        child.key,
                        data
                    );

                }

            });

            mergeAndRender();
        };


        db.ref("videos")
            .on(
                "value",
                ingest,
                (error) => {

                    console.error(
                        "Viewora /videos error:",
                        error
                    );

                    hideSkeleton(videoSkeleton);

                }
            );


        db.ref("posts")
            .on(
                "value",
                ingest,
                (error) => {

                    console.error(
                        "Viewora /posts video merge error:",
                        error
                    );

                }
            );

    }


    /* ======================================================
       3-DOT MENU (posts + videos)
    ====================================================== */

    let menuTarget = null; // { type, id, uid, card }

    function ensureHomeMenu() {
        let menu = document.getElementById("homeContentMenu");
        if (menu) return menu;

        menu = document.createElement("div");
        menu.id = "homeContentMenu";
        menu.className = "homeContentMenu hidden";
        menu.innerHTML = `
            <div class="homeMenuBackdrop" data-close="1"></div>
            <div class="homeMenuSheet">
                <div class="homeMenuHandle"></div>
                <div class="homeMenuTitle">Options</div>
                <div class="homeMenuBody" id="homeMenuBody"></div>
                <button type="button" class="homeMenuCancel" data-close="1">Cancel</button>
            </div>
        `;
        document.body.appendChild(menu);

        menu.addEventListener("click", (e) => {
            if (e.target.closest("[data-close]")) {
                closeHomeMenu();
            }
        });

        return menu;
    }

    function closeHomeMenu() {
        const menu = document.getElementById("homeContentMenu");
        menu?.classList.add("hidden");
        menuTarget = null;
    }

    function openHomeMenu(target) {
        menuTarget = target;
        const menu = ensureHomeMenu();
        const body = document.getElementById("homeMenuBody");
        if (!body) return;

        const myUID = getCurrentUID();
        const isOwner =
            myUID &&
            target.uid &&
            String(myUID) === String(target.uid);

        let items = [];

        if (isOwner) {
            items = [
                { action: "edit", icon: "fa-solid fa-pen", label: "Edit", sub: "Edit this content" },
                { action: "hide", icon: "fa-regular fa-eye-slash", label: "Hide", sub: "Hide from your profile" },
                { action: "hide_likes", icon: "fa-regular fa-heart", label: "Hide like count", sub: "Hide number of likes" },
                { action: "hide_comments", icon: "fa-regular fa-comment-slash", label: "Turn off comments", sub: "Stop new comments" },
                { action: "delete", icon: "fa-regular fa-trash-can", label: "Delete", sub: "Permanently remove", danger: true }
            ];
        } else {
            items = [
                { action: "not_interested", icon: "fa-solid fa-ban", label: "Not interested", sub: "See fewer like this" },
                { action: "report", icon: "fa-regular fa-flag", label: "Report", sub: "Report this content", danger: true },
                { action: "copy", icon: "fa-solid fa-link", label: "Copy link", sub: "Copy share link" }
            ];
        }

        body.innerHTML = items
            .map(
                (it) => `
            <button type="button" class="homeMenuItem${it.danger ? " danger" : ""}" data-menu-action="${it.action}">
                <span class="homeMenuIcon"><i class="${it.icon}"></i></span>
                <span class="homeMenuText">
                    <strong>${it.label}</strong>
                    <small>${it.sub}</small>
                </span>
            </button>
        `
            )
            .join("");

        body.querySelectorAll("[data-menu-action]").forEach((btn) => {
            btn.addEventListener("click", () => {
                handleHomeMenuAction(btn.dataset.menuAction);
            });
        });

        menu.classList.remove("hidden");
    }

    async function handleHomeMenuAction(action) {
        if (!menuTarget) return;
        const { type, id, uid, card } = menuTarget;
        const myUID = getCurrentUID();

        const path =
            type === "video"
                ? "videos/" + id
                : "posts/" + id;

        try {
            if (action === "copy") {
                const url =
                    location.origin +
                    (type === "video"
                        ? "/video.html?id="
                        : "/post.html?id=") +
                    encodeURIComponent(id);
                await navigator.clipboard.writeText(url);
                showToast("Link copied");
            } else if (action === "edit") {
                window.location.href =
                    (type === "video"
                        ? "upload.html?edit="
                        : "edit-post.html?id=") +
                    encodeURIComponent(id);
            } else if (action === "hide") {
                await db.ref(path).update({
                    hidden: true,
                    archived: true
                });
                card?.remove();
                showToast("Hidden");
            } else if (action === "hide_likes") {
                await db.ref(path).update({ hideLikeCount: true });
                showToast("Like count hidden");
            } else if (action === "hide_comments") {
                await db.ref(path).update({ commentsDisabled: true });
                showToast("Comments turned off");
            } else if (action === "delete") {
                if (!confirm("Delete permanently?")) {
                    closeHomeMenu();
                    return;
                }
                await db.ref(path).update({
                    deleted: true,
                    deletedAt: Date.now()
                });
                card?.remove();
                showToast("Deleted");
            } else if (action === "not_interested") {
                if (myUID) {
                    await db
                        .ref(
                            "notInterested/" +
                            myUID +
                            "/" +
                            id
                        )
                        .set(true);
                }
                card?.remove();
                showToast("We'll show fewer like this");
            } else if (action === "report") {
                const params = new URLSearchParams();
                params.set("type", type || "post");
                if (id) params.set("id", id);
                if (target.uid) params.set("uid", target.uid);
                window.location.href = "report.html?" + params.toString();
                return;
            }
        } catch (err) {
            console.error("Menu action failed:", err);
            showToast("Action failed");
        }

        closeHomeMenu();
    }

    /* ======================================================
       POST EVENTS
    ====================================================== */

    function bindPostEvents() {

        if (!feedContainer) return;

        // Image lightbox
        feedContainer
            .querySelectorAll("[data-view-image]")
            .forEach((image) => {
                image.addEventListener("click", () => {
                    const url = image.dataset.viewImage;
                    const viewer = $("imageViewer");
                    const viewerImage = $("viewerImage");
                    if (viewer && viewerImage && url) {
                        viewerImage.src = url;
                        viewer.classList.remove("hidden");
                    }
                });
            });

        // 3-dot menu
        feedContainer
            .querySelectorAll(".postMore")
            .forEach((button) => {
                button.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const card = button.closest(".vieworaPostCard");
                    if (!card) return;
                    const id = card.dataset.postId || "";
                    const userBtn = card.querySelector("[data-user-id]");
                    const uid = userBtn?.dataset.userId || "";
                    openHomeMenu({
                        type: "post",
                        id,
                        uid,
                        card
                    });
                });
            });

        // Profile click
        feedContainer
            .querySelectorAll(".postUser[data-user-id]")
            .forEach((btn) => {
                btn.addEventListener("click", () => {
                    const uid = btn.dataset.userId;
                    if (!uid) return;
                    window.location.href =
                        "profile.html?uid=" +
                        encodeURIComponent(uid);
                });
            });

        // All post actions (like / comment / share / save)
        feedContainer
            .querySelectorAll("[data-action]")
            .forEach((button) => {
                // avoid double-binding
                if (button.dataset.bound === "1") return;
                button.dataset.bound = "1";

                button.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const action = button.dataset.action;
                    const card = button.closest(".vieworaPostCard");
                    if (!card) return;
                    const postId = card.dataset.postId;
                    if (!postId) return;

                    if (action === "like") {
                        await togglePostLike(card, postId, button);
                    } else if (action === "comment") {
                        openPostComments(postId);
                    } else if (action === "share") {
                        await sharePost(postId);
                    } else if (action === "save") {
                        await togglePostSave(card, postId, button);
                    }
                });
            });
    }

    function getMyUID() {
        try {
            return (
                getCurrentUID() ||
                window.auth?.currentUser?.uid ||
                (typeof firebase !== "undefined"
                    ? firebase.auth()?.currentUser?.uid
                    : null) ||
                null
            );
        } catch (e) {
            return null;
        }
    }

    /* Resolve numeric like count safely (never use object as number) */
    function resolveLikeCount(pdata, fallback) {
        if (!pdata || typeof pdata !== "object") {
            return Math.max(0, Number(fallback) || 0);
        }
        const a = pdata.likesCount;
        const b = pdata.likeCount;
        const c = pdata.likes;
        if (typeof a === "number" && Number.isFinite(a)) return Math.max(0, a);
        if (typeof b === "number" && Number.isFinite(b)) return Math.max(0, b);
        if (typeof c === "number" && Number.isFinite(c)) return Math.max(0, c);
        if (c && typeof c === "object") return Object.keys(c).length;
        if (a && typeof a === "object") return Object.keys(a).length;
        return Math.max(0, Number(fallback) || 0);
    }

    function setPostLikedUI(button, liked, count) {
        if (!button) return;
        const icon = button.querySelector("i");
        const label = button.querySelector("span");
        button.classList.toggle("liked", !!liked);
        if (icon) {
            icon.className = liked
                ? "fa-solid fa-heart"
                : "fa-regular fa-heart";
        }
        if (label && count !== undefined && count !== null) {
            label.textContent = formatCount(count);
        }
    }

    /* Load liked + accurate count for visible post cards */
    async function hydratePostLikes() {
        if (!feedContainer) return;
        const uid = getMyUID();
        const cards = feedContainer.querySelectorAll(".vieworaPostCard[data-post-id]");
        if (!cards.length) return;

        await Promise.all(
            Array.from(cards).map(async (card) => {
                const postId = card.dataset.postId;
                if (!postId) return;
                const button = card.querySelector('[data-action="like"]');
                if (!button) return;

                try {
                    // Prefer postLikes, fallback to likes (posts.js path)
                    let liked = false;
                    if (uid) {
                        const [a, b] = await Promise.all([
                            db.ref("postLikes/" + postId + "/" + uid).once("value"),
                            db.ref("likes/" + postId + "/" + uid).once("value")
                        ]);
                        liked =
                            a.exists() ||
                            b.val() === true ||
                            b.val() === 1 ||
                            (b.exists() && b.val() !== false && b.val() !== null);
                    }

                    // Count from like nodes (source of truth)
                    let count = 0;
                    try {
                        const [c1, c2] = await Promise.all([
                            db.ref("postLikes/" + postId).once("value"),
                            db.ref("likes/" + postId).once("value")
                        ]);
                        const keys = new Set();
                        if (c1.exists()) {
                            Object.keys(c1.val() || {}).forEach((k) => keys.add(k));
                        }
                        if (c2.exists()) {
                            const v = c2.val() || {};
                            Object.keys(v).forEach((k) => {
                                const item = v[k];
                                if (
                                    item === true ||
                                    item === 1 ||
                                    (item && typeof item === "object")
                                ) {
                                    keys.add(k);
                                }
                            });
                        }
                        count = keys.size;
                    } catch (_) {
                        const label = button.querySelector("span");
                        const parsed = Number(
                            (label && label.textContent.replace(/[^\d.KM]/gi, "")) || 0
                        );
                        count = Number.isFinite(parsed) ? parsed : 0;
                    }

                    setPostLikedUI(button, liked, count);
                    // Keep posts node count in sync (non-blocking)
                    if (count >= 0) {
                        db.ref("posts/" + postId)
                            .update({ likes: count, likesCount: count })
                            .catch(() => {});
                    }
                } catch (err) {
                    console.warn("hydrate like failed:", postId, err);
                }
            })
        );
    }

    /* Like locks + spam for posts */
    const postLikeInFlight = new Set();
    const postLikeSpam = {};
    const POST_LIKE_SPAM_LIMIT = 6;
    const POST_LIKE_SPAM_WINDOW = 12000;

    function trackPostLikeSpam(postId) {
        const now = Date.now();
        const arr = (postLikeSpam[postId] || []).filter(
            (t) => now - t < POST_LIKE_SPAM_WINDOW
        );
        arr.push(now);
        postLikeSpam[postId] = arr;
        return arr.length;
    }

    function showPostLikeSpamWarning() {
        const msg =
            "Please do not spam likes. Rapid like / unlike is against Viewora Community Guidelines. Repeated abuse may lead to account suspension.";
        try {
            window.alert(msg);
        } catch (_) {
            showToast(msg);
        }
    }

    function setPostLikedUI(button, liked, count) {
        if (!button) return;
        const icon = button.querySelector("i");
        const label = button.querySelector("span");
        button.classList.toggle("liked", !!liked);
        if (icon) {
            icon.className = liked
                ? "fa-solid fa-heart"
                : "fa-regular fa-heart";
        }
        if (label && count !== undefined && count !== null) {
            label.textContent = formatCount(count);
        }
    }

    async function togglePostLike(card, postId, button) {
        const uid = getMyUID();
        if (!uid) {
            showToast("Login required to like");
            return;
        }
        if (!postId) return;

        const lockKey = postId + ":" + uid;
        if (typeof postLikeInFlight !== "undefined" && postLikeInFlight.has(lockKey)) {
            return;
        }
        if (button && button.dataset.liking === "1") return;

        // Spam guard
        try {
            if (typeof trackPostLikeSpam === "function") {
                const taps = trackPostLikeSpam(postId);
                if (taps >= (POST_LIKE_SPAM_LIMIT || 6)) {
                    if (typeof showPostLikeSpamWarning === "function") {
                        showPostLikeSpamWarning();
                    } else {
                        alert(
                            "Please do not spam likes. Rapid like / unlike is against Viewora Community Guidelines. Repeated abuse may lead to account suspension."
                        );
                    }
                    return;
                }
            }
        } catch (_) {}

        if (typeof postLikeInFlight !== "undefined") postLikeInFlight.add(lockKey);
        if (button) {
            button.dataset.liking = "1";
            button.disabled = true;
            button.style.pointerEvents = "none";
        }

        const likeRefA = db.ref("postLikes/" + postId + "/" + uid);
        const likeRefB = db.ref("likes/" + postId + "/" + uid);

        try {
            let wasLiked = false;
            // Membership from either path
            const [a0, b0] = await Promise.all([
                likeRefA.once("value"),
                likeRefB.once("value")
            ]);
            wasLiked =
                a0.exists() ||
                b0.val() === true ||
                b0.val() === 1 ||
                (b0.exists() && b0.val() !== false && b0.val() !== null);

            // Atomic toggle on primary
            await likeRefA.transaction((cur) => {
                if (cur === null) return true;
                return null;
            });

            const after = await likeRefA.once("value");
            const isLiked = after.exists();

            // Mirror secondary
            try {
                if (isLiked) await likeRefB.set(true);
                else await likeRefB.remove();
            } catch (_) {}

            // Count = unique keys in postLikes (source of truth)
            let finalCount = 0;
            try {
                const tree = await db.ref("postLikes/" + postId).once("value");
                if (tree.exists()) {
                    finalCount = Object.keys(tree.val() || {}).length;
                }
            } catch (_) {}

            if (!finalCount) {
                try {
                    const tree2 = await db.ref("likes/" + postId).once("value");
                    if (tree2.exists()) {
                        const v = tree2.val() || {};
                        finalCount = Object.keys(v).filter((k) => {
                            const item = v[k];
                            return (
                                item === true ||
                                item === 1 ||
                                (item && typeof item === "object")
                            );
                        }).length;
                    }
                } catch (_) {}
            }

            // Persist aggregate (numbers only — never object)
            try {
                await db.ref("posts/" + postId).update({
                    likes: finalCount,
                    likesCount: finalCount,
                    likeCount: finalCount
                });
            } catch (_) {}

            setPostLikedUI(button, isLiked, finalCount);
            if (card) {
                card.dataset.likeCount = String(finalCount);
            }
        } catch (err) {
            console.error("Like failed:", err);
            showToast("Like failed");
        } finally {
            if (typeof postLikeInFlight !== "undefined") {
                postLikeInFlight.delete(lockKey);
            }
            if (button) {
                button.dataset.liking = "0";
                button.disabled = false;
                button.style.pointerEvents = "";
            }
        }
    }


    async function togglePostSave(card, postId, button) {
        const uid = getMyUID();
        if (!uid) {
            showToast("Login required to save");
            return;
        }

        const ref = db.ref("savedPosts/" + uid + "/" + postId);
        const icon = button.querySelector("i");

        try {
            const snap = await ref.once("value");
            if (snap.exists()) {
                await ref.remove();
                if (icon) icon.className = "fa-regular fa-bookmark";
                button.classList.remove("saved");
                showToast("Removed from saved");
            } else {
                await ref.set({
                    postId,
                    createdAt: Date.now()
                });
                if (icon) icon.className = "fa-solid fa-bookmark";
                button.classList.add("saved");
                showToast("Post saved");
            }
        } catch (err) {
            console.error("Save failed:", err);
            showToast("Save failed");
        }
    }

    async function sharePost(postId) {
        const shareURL =
            location.origin +
            location.pathname +
            "?post=" +
            encodeURIComponent(postId || "");

        try {
            if (navigator.share) {
                await navigator.share({
                    title: "Viewora Post",
                    url: shareURL
                });
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareURL);
                showToast("Post link copied");
            }
        } catch (error) {
            console.log("Share cancelled.");
        }
    }

    function openPostComments(postId) {
        // Prefer dedicated page if present, else simple prompt fallback
        if (!postId) return;

        // If comments modal exists in HTML, use it
        const modal = $("commentsModal") || $("postCommentsModal");
        if (modal) {
            modal.classList.remove("hidden");
            modal.dataset.postId = postId;
            loadPostComments(postId);
            return;
        }

        // Lightweight inline sheet
        ensurePostCommentSheet(postId);
    }

    function ensurePostCommentSheet(postId) {
        let sheet = document.getElementById("homePostComments");
        if (!sheet) {
            sheet = document.createElement("div");
            sheet.id = "homePostComments";
            sheet.className = "homeContentMenu";
            sheet.innerHTML = `
                <div class="homeMenuBackdrop" data-close-comments="1"></div>
                <div class="homeMenuSheet" style="max-height:70vh;display:flex;flex-direction:column;">
                    <div class="homeMenuHandle"></div>
                    <div class="homeMenuTitle">Comments</div>
                    <div id="homeCommentsList" style="flex:1;overflow:auto;padding:4px 4px 12px;min-height:120px;"></div>
                    <div style="display:flex;gap:8px;padding:8px 4px 4px;">
                        <input id="homeCommentInput" type="text" placeholder="Add a comment..."
                            style="flex:1;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;padding:0 14px;outline:none;" />
                        <button type="button" id="homeCommentSend"
                            style="height:44px;padding:0 16px;border:0;border-radius:14px;background:linear-gradient(135deg,#7c5cff,#a855f7);color:#fff;font-weight:700;">
                            Send
                        </button>
                    </div>
                    <button type="button" class="homeMenuCancel" data-close-comments="1">Close</button>
                </div>
            `;
            document.body.appendChild(sheet);

            sheet.addEventListener("click", (e) => {
                if (e.target.closest("[data-close-comments]")) {
                    sheet.classList.add("hidden");
                }
            });

            sheet
                .querySelector("#homeCommentSend")
                ?.addEventListener("click", () => {
                    submitHomeComment(sheet.dataset.postId);
                });

            sheet
                .querySelector("#homeCommentInput")
                ?.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        submitHomeComment(sheet.dataset.postId);
                    }
                });
        }

        sheet.dataset.postId = postId;
        sheet.classList.remove("hidden");
        loadPostComments(postId);
    }

    async function loadPostComments(postId) {
        const list = document.getElementById("homeCommentsList");
        if (!list) return;

        list.innerHTML =
            '<div style="padding:20px;text-align:center;color:#8b8b9a;font-size:12px;">Loading...</div>';

        try {
            const [snapA, snapB] = await Promise.all([
                db.ref("comments/" + postId).once("value"),
                db.ref("posts/" + postId + "/comments").once("value")
            ]);
            const merged = {};
            const a = snapA.val() || {};
            const b = snapB.val() || {};
            Object.keys(a).forEach((k) => { merged[k] = a[k]; });
            Object.keys(b).forEach((k) => { if (!merged[k]) merged[k] = b[k]; });
            const val = merged;

            if (!Object.keys(val).length) {
                list.innerHTML =
                    '<div style="padding:24px;text-align:center;color:#8b8b9a;font-size:13px;">No comments yet. Be the first.</div>';
                return;
            }

            const items = Object.entries(val)
                .map(([id, data]) => ({ id, ...(data || {}) }))
                .sort(
                    (a, b) =>
                        Number(a.createdAt || a.timestamp || 0) -
                        Number(b.createdAt || b.timestamp || 0)
                );

            // Enrich comment authors for verified + avatar
            for (const c of items) {
                const cuid = c.uid || c.userId || "";
                if (!cuid) continue;
                const user = await fetchUserNode(cuid);
                if (!user) continue;
                if (!c.profilePhoto && !c.photoURL) {
                    c.profilePhoto =
                        user.profilePhoto ||
                        user.photoURL ||
                        "";
                }
                if (!c.name && !c.username) {
                    c.name =
                        user.name ||
                        user.displayName ||
                        user.username ||
                        "";
                }
                if (isVerifiedUser(user)) {
                    c.verified = true;
                }
            }

            list.innerHTML = items
                .map((c) => {
                    const name = escapeHTML(
                        c.name ||
                        c.username ||
                        c.displayName ||
                        "User"
                    );
                    const text = escapeHTML(c.text || c.comment || "");
                    const avatar = escapeHTML(
                        c.profilePhoto ||
                        c.photoURL ||
                        "assets/default-avatar.png"
                    );
                    const tick = isVerifiedUser(c)
                        ? '<i class="fa-solid fa-circle-check verifiedTick" style="color:#27cfff;font-size:11px;margin-left:4px;"></i>'
                        : "";
                    return `
                        <div style="display:flex;gap:10px;padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.05);">
                            <img src="${avatar}" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover;background:#1a1a24;" onerror="this.src='assets/default-avatar.png'">
                            <div style="min-width:0;flex:1;">
                                <strong style="font-size:12px;">${name}${tick}</strong>
                                <p style="margin-top:3px;font-size:13px;color:#ddd;line-height:1.4;word-break:break-word;">${text}</p>
                            </div>
                        </div>
                    `;
                })
                .join("");
        } catch (err) {
            console.error("Comments load failed:", err);
            list.innerHTML =
                '<div style="padding:20px;text-align:center;color:#ff5b75;font-size:12px;">Unable to load comments</div>';
        }
    }

    async function submitHomeComment(postId) {
        const uid = getMyUID();
        if (!uid) {
            showToast("Login required to comment");
            return;
        }
        if (!postId) return;

        const input = document.getElementById("homeCommentInput");
        const text = String(input?.value || "").trim();
        if (!text) return;

        try {
            let name = "Viewora User";
            let photo = "assets/default-avatar.png";
            try {
                const us = await db.ref("users/" + uid).once("value");
                if (us.exists()) {
                    const u = us.val() || {};
                    name =
                        u.name ||
                        u.fullName ||
                        u.displayName ||
                        u.username ||
                        name;
                    photo =
                        u.profilePhoto ||
                        u.photoURL ||
                        photo;
                }
            } catch (e) {}

            const payload = {
                uid,
                userId: uid,
                text,
                name,
                profilePhoto: photo,
                createdAt:
                    (typeof firebase !== "undefined" &&
                        firebase.database &&
                        firebase.database.ServerValue &&
                        firebase.database.ServerValue.TIMESTAMP) ||
                    Date.now(),
                timestamp: Date.now()
            };

            const pushRef = db.ref("comments/" + postId).push();
            await pushRef.set(payload);
            try {
                await db
                    .ref("posts/" + postId + "/comments/" + pushRef.key)
                    .set(payload);
            } catch (e) {}

            // bump comment count (transaction-safe)
            try {
                const countRef = db.ref("posts/" + postId + "/commentsCount");
                const tx = await countRef.transaction((cur) => {
                    const n =
                        typeof cur === "number" && Number.isFinite(cur)
                            ? cur
                            : 0;
                    return n + 1;
                });
                const n =
                    tx.committed && tx.snapshot
                        ? Number(tx.snapshot.val()) || 0
                        : 0;
                await db.ref("posts/" + postId).update({
                    comments: n,
                    commentsCount: n
                });

                // Update card UI
                const card = feedContainer?.querySelector(
                    `.vieworaPostCard[data-post-id="${CSS.escape(postId)}"]`
                );
                const label = card?.querySelector(
                    '[data-action="comment"] span'
                );
                if (label && n) label.textContent = formatCount(n);
            } catch (e) {}

            if (input) input.value = "";
            showToast("Comment added");
            await loadPostComments(postId);
        } catch (err) {
            console.error("Comment failed:", err);
            showToast("Comment failed");
        }
    }

    /* ======================================================
       VIDEO EVENTS
    ====================================================== */

    function bindVideoEvents() {

        if (!longVideoContainer) return;


        longVideoContainer
            .querySelectorAll(".videoMore")
            .forEach((button) => {
                button.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const card = button.closest(".longVideoCard");
                    if (!card) return;
                    const id = card.dataset.videoId || "";
                    const uid =
                        card.dataset.uid ||
                        card.getAttribute("data-uid") ||
                        "";
                    openHomeMenu({
                        type: "video",
                        id,
                        uid,
                        card
                    });
                });
            });


        longVideoContainer
            .querySelectorAll(".videoThumbnailWrap")
            .forEach((thumbnail) => {
                thumbnail.addEventListener("click", () => {
                    const card = thumbnail.closest(".longVideoCard");
                    if (!card) return;
                    const id = card.dataset.videoId;
                    window.location.href =
                        "video.html?id=" + encodeURIComponent(id);
                });
            });

        // Avatar / username row → open profile
        longVideoContainer
            .querySelectorAll(".longVideoCard")
            .forEach((card) => {
                const uid =
                    card.dataset.uid ||
                    card.getAttribute("data-uid") ||
                    "";
                if (!uid) return;

                const openProfile = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href =
                        "profile.html?uid=" + encodeURIComponent(uid);
                };

                const av = card.querySelector(".videoAvatar");
                if (av) {
                    av.style.cursor = "pointer";
                    av.addEventListener("click", openProfile);
                }
                const sub = card.querySelector(".videoSubMeta");
                if (sub) {
                    const nameSpan = sub.querySelector("span");
                    if (nameSpan) {
                        nameSpan.style.cursor = "pointer";
                        nameSpan.addEventListener("click", openProfile);
                    }
                }
            });

    }


    /* ======================================================
       IMAGE VIEWER CLOSE
    ====================================================== */

    const closeViewer =
        $("closeViewer");


    const imageViewer =
        $("imageViewer");


    if (
        closeViewer &&
        imageViewer
    ) {

        closeViewer.addEventListener(
            "click",
            () => {

                imageViewer.classList.add(
                    "hidden"
                );

                const image =
                    $("viewerImage");

                if (image) {
                    image.src = "";
                }

            }
        );

    }


    /* ======================================================
       VIDEO VIEWER CLOSE
    ====================================================== */

    const closeVideo =
        $("closeVideo");


    const videoViewer =
        $("videoViewer");


    const viewerVideo =
        $("viewerVideo");


    if (
        closeVideo &&
        videoViewer
    ) {

        closeVideo.addEventListener(
            "click",
            () => {

                videoViewer.classList.add(
                    "hidden"
                );

                if (viewerVideo) {

                    viewerVideo.pause();

                    viewerVideo.removeAttribute(
                        "src"
                    );

                    viewerVideo.load();

                }

            }
        );

    }


    /* ======================================================
       TOAST
    ====================================================== */

    let toastTimer = null;


    function showToast(message) {

        const toast =
            $("toast");

        const toastText =
            $("toastText");


        if (!toast || !toastText) return;


        toastText.textContent =
            message;


        toast.classList.remove(
            "hidden"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {

                    toast.classList.add(
                        "hidden"
                    );

                },
                2200
            );

    }



    /* ======================================================
       CATEGORY FILTER
       Sends event to feed.
    ====================================================== */

    window.addEventListener(
        "viewora:category-change",
        (event) => {

            const category =
                event.detail?.category ||
                "all";


            document
                .querySelectorAll(
                    ".vieworaPostCard, .longVideoCard"
                )
                .forEach((card) => {

                    if (
                        category === "all"
                    ) {

                        card.style.display =
                            "";

                        return;
                    }


                    /*
                     * Category filtering is handled
                     * from dataset when available.
                     */

                    const itemCategory =
                        String(
                            card.dataset.category ||
                            card.getAttribute("data-category") ||
                            ""
                        ).toLowerCase();
                    const tags = String(
                        card.dataset.tags ||
                        card.getAttribute("data-tags") ||
                        ""
                    ).toLowerCase();
                    const caption = String(
                        card.querySelector(".postCaption, .caption, .videoTitle, h3")?.textContent ||
                        ""
                    ).toLowerCase();
                    const hay = itemCategory + " " + tags + " " + caption;

                    if (
                        itemCategory === category ||
                        tags.split(/[,\s]+/).includes(category) ||
                        hay.includes(category)
                    ) {
                        card.style.display = "";
                    } else if (!itemCategory && !tags) {
                        // no category data → hide on specific filters (except all)
                        card.style.display = "none";
                    } else {
                        card.style.display = "none";
                    }

                });

        }
    );

  /* ======================================================
   STORIES
   Instagram-style: 1 user = 1 ring
   Only own + people you follow
   All stories of that user open together
====================================================== */

    let currentUserUID = null;
    let followingSet = new Set();
    const privateUserCache = {};

    async function isPrivateAccount(uid) {
        if (!uid) return false;
        if (privateUserCache[uid] !== undefined) return privateUserCache[uid];
        try {
            const snap = await db.ref("users/" + uid).once("value");
            if (!snap.exists()) {
                privateUserCache[uid] = false;
                return false;
            }
            const u = snap.val() || {};
            const priv = !!(
                u.privateAccount === true ||
                u.isPrivate === true ||
                String(u.privacy || "").toLowerCase() === "private" ||
                String(u.accountType || "").toLowerCase() === "private"
            );
            privateUserCache[uid] = priv;
            return priv;
        } catch (_) {
            privateUserCache[uid] = false;
            return false;
        }
    }

    async function canViewUserContent(ownerUid) {
        if (!ownerUid) return true;
        const me = getCurrentUID();
        if (me && String(me) === String(ownerUid)) return true;
        if (followingSet.has(String(ownerUid))) return true;
        // Not following → only if public
        const priv = await isPrivateAccount(ownerUid);
        return !priv;
    }


    function getCurrentUID() {
        try {
            if (typeof window.getUID === "function") {
                return window.getUID() || null;
            }
            return (
                window.auth?.currentUser?.uid ||
                (typeof firebase !== "undefined"
                    ? firebase.auth()?.currentUser?.uid
                    : null) ||
                null
            );
        } catch {
            return null;
        }
    }

    async function loadFollowingSet(uid) {
        followingSet = new Set();
        if (!uid) return;

        const paths = [
            "following/" + uid,
            "users/" + uid + "/following"
        ];

        for (const path of paths) {
            try {
                const snap = await db.ref(path).once("value");
                if (!snap.exists()) continue;
                const val = snap.val() || {};
                Object.keys(val).forEach((targetId) => {
                    const item = val[targetId];
                    if (
                        item === true ||
                        item === 1 ||
                        item === "true" ||
                        (item && typeof item === "object")
                    ) {
                        followingSet.add(String(targetId));
                    }
                });
            } catch (err) {
                console.warn("Following load failed:", path, err);
            }
        }
    }

    function isStoryActive(data, createdAt) {
        if (data.deleted === true || data.archived === true) {
            return false;
        }

        const now = Date.now();
        let expiry = Number(data.expiresAt || 0);

        // expiresAt in seconds → ms
        if (expiry > 0 && expiry < 1e12) {
            expiry = expiry * 1000;
        }

        if (expiry && expiry <= now) {
            return false; // expired (24h done)
        }

        // If no expiresAt, treat as active only within 24h of createdAt
        if (!expiry && createdAt) {
            let ts = createdAt;
            if (ts < 1e12) ts = ts * 1000;
            if (now - ts > 24 * 60 * 60 * 1000) {
                return false;
            }
        }

        return true;
    }

    /* Seen stories – localStorage per user */
    function getSeenStoryMap() {
        try {
            const key =
                "viewora_seen_stories_" +
                (currentUserUID || "guest");
            return JSON.parse(
                localStorage.getItem(key) || "{}"
            );
        } catch (e) {
            return {};
        }
    }

    function markStoryUserSeen(uid) {
        if (!uid) return;
        try {
            const key =
                "viewora_seen_stories_" +
                (currentUserUID || "guest");
            const map = getSeenStoryMap();
            map[uid] = Date.now();
            localStorage.setItem(key, JSON.stringify(map));
        } catch (e) { /* ignore */ }
    }

    function isStoryUserSeen(uid, latestAt) {
        if (!uid) return false;
        const map = getSeenStoryMap();
        const seenAt = Number(map[uid] || 0);
        if (!seenAt) return false;
        // New story after last view → unseen again
        return seenAt >= (latestAt || 0);
    }

    function loadStories() {

        const container = $("firebaseStories");
        if (!container) return;

        currentUserUID = getCurrentUID();

        // Wait for auth if needed so following (friends) list is ready
        const ensureAuth = () =>
            new Promise((resolve) => {
                if (currentUserUID) {
                    resolve(currentUserUID);
                    return;
                }
                if (typeof firebase === "undefined" || !firebase.auth) {
                    resolve(null);
                    return;
                }
                const unsub = firebase.auth().onAuthStateChanged((user) => {
                    try { unsub(); } catch (_) {}
                    currentUserUID = user ? user.uid : null;
                    resolve(currentUserUID);
                });
                setTimeout(() => {
                    try { unsub(); } catch (_) {}
                    currentUserUID = getCurrentUID();
                    resolve(currentUserUID);
                }, 5000);
            });

        // Load following list first, then stories of friends only
        Promise.resolve()
            .then(async () => {
                currentUserUID = await ensureAuth();
                if (currentUserUID) {
                    await loadFollowingSet(currentUserUID);
                }

                if (!window.__vieworaLiveStoriesBound) {
                    window.__vieworaLiveStoriesBound = true;
                    try {
                        db.ref("live").on("value", () => {
                            // Force stories value handler by touching a local flag via once + rebuild
                            db.ref("stories").once("value").then((snap) => {
                                // dispatch fake by re-assigning - the on("value") already will not re-fire
                                // so manually trigger rebuild through shared function if set
                                if (window.__vieworaStoriesHandler) {
                                    window.__vieworaStoriesHandler(snap);
                                }
                            }).catch(() => {});
                        });
                    } catch (_) {}
                }

                const storiesHandler = async (snapshot) => {

                        container.innerHTML = "";

                        /*
                         * Group by user:
                         * { uid: { stories: [], latest, avatar, name } }
                         */
                        const byUser = {};

                        snapshot.forEach((child) => {
                            const data = child.val() || {};
                            const uid = String(
                                data.uid ||
                                data.userId ||
                                data.ownerId ||
                                data.creatorId ||
                                ""
                            ).trim();

                            if (!uid) return;

                            let createdAt = Number(
                                data.createdAt ||
                                data.timestamp ||
                                data.time ||
                                0
                            );
                            if (createdAt > 0 && createdAt < 1e12) {
                                createdAt = createdAt * 1000;
                            }

                            if (!isStoryActive(data, createdAt)) {
                                return;
                            }

                            // Home: ONLY own + people you follow (never random users)
                            const isOwn =
                                currentUserUID &&
                                String(uid) === String(currentUserUID);
                            const isFollowed =
                                followingSet.has(String(uid));

                            if (!currentUserUID) {
                                // Not logged in → no stories on home
                                return;
                            }
                            if (!isOwn && !isFollowed) {
                                return;
                            }

                            if (!byUser[uid]) {
                                byUser[uid] = {
                                    uid,
                                    stories: [],
                                    latestAt: 0,
                                    avatar: "",
                                    name: "",
                                    username: ""
                                };
                            }

                            byUser[uid].stories.push({
                                id: child.key,
                                data,
                                createdAt
                            });

                            if (createdAt > byUser[uid].latestAt) {
                                byUser[uid].latestAt = createdAt;
                            }

                            // Prefer latest story's profile info
                            if (
                                !byUser[uid].avatar ||
                                createdAt >= byUser[uid].latestAt
                            ) {
                                byUser[uid].avatar = getAvatar(data);
                                byUser[uid].name =
                                    data.name ||
                                    data.fullName ||
                                    data.displayName ||
                                    data.username ||
                                    "User";
                                byUser[uid].username =
                                    data.username ||
                                    data.displayName ||
                                    "User";
                            }
                        });

                        // ---- LIVE: following users who are live appear as red rings first ----
                        try {
                            const liveSnap = await db.ref("live").once("value");
                            if (liveSnap.exists()) {
                                liveSnap.forEach((ch) => {
                                    const lv = ch.val() || {};
                                    const luid = ch.key;
                                    if (!lv || lv.active !== true) return;
                                    if (!currentUserUID) return;
                                    const isOwnLive = String(luid) === String(currentUserUID);
                                    const isFollowedLive = followingSet.has(String(luid));
                                    if (!isOwnLive && !isFollowedLive) return;

                                    if (!byUser[luid]) {
                                        byUser[luid] = {
                                            uid: luid,
                                            stories: [],
                                            latestAt: Date.now(),
                                            avatar: lv.hostPhoto || "",
                                            name: lv.hostName || "Live",
                                            username: lv.hostName || "Live",
                                            isLive: true,
                                            liveTitle: lv.title || "Live"
                                        };
                                    } else {
                                        byUser[luid].isLive = true;
                                        byUser[luid].liveTitle = lv.title || "Live";
                                        byUser[luid].latestAt = Math.max(
                                            byUser[luid].latestAt || 0,
                                            Date.now()
                                        );
                                        if (lv.hostPhoto) byUser[luid].avatar = lv.hostPhoto;
                                        if (lv.hostName) {
                                            byUser[luid].name = lv.hostName;
                                            byUser[luid].username = lv.hostName;
                                        }
                                    }
                                });
                            }
                        } catch (liveErr) {
                            console.warn("live stories merge", liveErr);
                        }

                        // Enrich from users node if name still generic
                        const userIds = Object.keys(byUser);
                        await Promise.all(
                            userIds.map(async (uid) => {
                                const group = byUser[uid];
                                if (
                                    group.name &&
                                    group.name !== "User" &&
                                    group.name !== "Viewora User"
                                ) {
                                    return;
                                }
                                try {
                                    const us = await db
                                        .ref("users/" + uid)
                                        .once("value");
                                    if (!us.exists()) return;
                                    const u = us.val() || {};
                                    group.name =
                                        u.name ||
                                        u.fullName ||
                                        u.displayName ||
                                        u.username ||
                                        group.name;
                                    group.username =
                                        u.username ||
                                        group.username;
                                    if (!group.avatar || group.avatar.includes("default-avatar")) {
                                        group.avatar =
                                            u.profilePhoto ||
                                            u.photoURL ||
                                            group.avatar;
                                    }
                                } catch (e) {
                                    /* ignore */
                                }
                            })
                        );

                        // Sort: own first, then UNSEEN, then seen last
                        // Dedupe: same uid OR same username+name (avoid double rings)
                        let groups = Object.values(byUser);
                        const seenKeys = new Set();
                        groups = groups.filter((g) => {
                            const idKey = String(g.uid || "").toLowerCase();
                            if (idKey && seenKeys.has("id:" + idKey)) return false;
                            if (idKey) seenKeys.add("id:" + idKey);
                            const nameKey = String(g.username || g.name || "").toLowerCase().trim();
                            if (nameKey && nameKey !== "user" && nameKey !== "viewora user") {
                                if (seenKeys.has("name:" + nameKey)) return false;
                                seenKeys.add("name:" + nameKey);
                            }
                            return true;
                        });
                        groups = groups.map((g) => {
                            g.seen = isStoryUserSeen(g.uid, g.latestAt);
                            return g;
                        }).sort((a, b) => {
                            if (currentUserUID && a.uid === currentUserUID) return -1;
                            if (currentUserUID && b.uid === currentUserUID) return 1;
                            // Live first
                            if (!!a.isLive !== !!b.isLive) return a.isLive ? -1 : 1;
                            // Unseen before seen
                            if (a.seen !== b.seen) return a.seen ? 1 : -1;
                            return b.latestAt - a.latestAt;
                        });

                        // Max 25 user rings — own goes to "Your Story" button, others beside it
                        groups
                            .filter((g) => {
                                if (
                                    currentUserUID &&
                                    String(g.uid) === String(currentUserUID)
                                ) {
                                    return false; // own ring = left "Your Story"
                                }
                                return true;
                            })
                            .slice(0, 25)
                            .forEach((group) => {
                            // Sort this user's stories newest first
                            group.stories.sort(
                                (a, b) => b.createdAt - a.createdAt
                            );

                            const isOwn =
                                currentUserUID &&
                                group.uid === currentUserUID;

                            const label = isOwn
                                ? "Your Story"
                                : escapeHTML(
                                      group.username ||
                                      group.name ||
                                      "User"
                                  );

                            const avatar =
                                group.avatar ||
                                "assets/default-avatar.png";

                            // First (newest) story id for deep link
                            const firstStoryId =
                                group.stories[0]?.id || "";

                            const button =
                                document.createElement("button");
                            button.type = "button";

                            // Unseen = colored ring, seen = white/gray ring
                            const isLive = !!group.isLive;
                            const ringClass = isLive
                                ? "storyCard storyLive live"
                                : group.seen
                                    ? "storyCard storySeen"
                                    : "storyCard storyUnseen";

                            button.className =
                                ringClass +
                                (isOwn ? " ownStory" : "");
                            button.dataset.uid = group.uid;
                            button.dataset.storyId = firstStoryId;
                            button.dataset.count = String(
                                group.stories.length
                            );
                            button.dataset.seen = group.seen
                                ? "1"
                                : "0";
                            if (isLive) button.dataset.live = "1";

                            button.innerHTML = `
                                <div class="storyImageWrap${isLive ? " live-ring" : ""}">
                                    <img
                                        src="${escapeHTML(avatar)}"
                                        alt="${label}"
                                        class="storyImage"
                                        loading="lazy"
                                        onerror="this.src='assets/default-avatar.png'"
                                    >
                                    ${isLive ? '<span class="liveBadge">LIVE</span>' : ""}
                                </div>
                                <span class="storyName">
                                    ${isLive ? "🔴 " : ""}${label}
                                </span>
                            `;

                            button.addEventListener("click", () => {
                                if (isLive) {
                                    window.location.href =
                                        "live.html?uid=" +
                                        encodeURIComponent(group.uid);
                                    return;
                                }
                                markStoryUserSeen(group.uid);
                                const params = new URLSearchParams();
                                if (group.uid) params.set("uid", group.uid);
                                params.set("from", "home");
                                if (firstStoryId) {
                                    params.set("story", firstStoryId);
                                    params.set("storyId", firstStoryId);
                                }
                                window.location.href =
                                    "stories.html?" + params.toString();
                            });

                            // Long press / name → open profile
                            let lpTimer = null;
                            button.addEventListener("touchstart", (e) => {
                                lpTimer = setTimeout(() => {
                                    if (group.uid) {
                                        window.location.href =
                                            "profile.html?uid=" +
                                            encodeURIComponent(group.uid);
                                    }
                                }, 550);
                            }, { passive: true });
                            button.addEventListener("touchend", () => clearTimeout(lpTimer));
                            button.addEventListener("touchmove", () => clearTimeout(lpTimer));
                            button.addEventListener("contextmenu", (e) => {
                                e.preventDefault();
                                if (group.uid) {
                                    window.location.href =
                                        "profile.html?uid=" +
                                        encodeURIComponent(group.uid);
                                }
                            });

                            container.appendChild(button);
                        });

                        // "Your Story" ring — profile pic + view own / plus = upload
                        (async function wireYourStoryRing() {
                            const addBtn = document.getElementById("addStoryBtn");
                            if (!addBtn) return;

                            const av = document.getElementById("myStoryAvatar");
                            const plus = addBtn.querySelector(".yourStoryPlus");
                            const myUid = currentUserUID || getCurrentUID();

                            // --- Own active stories (from groups OR direct query) ---
                            let ownStories = [];
                            const ownGroup = (groups || []).find(
                                (g) => myUid && String(g.uid) === String(myUid)
                            );
                            if (ownGroup && ownGroup.stories && ownGroup.stories.length) {
                                ownStories = ownGroup.stories.slice();
                            } else if (myUid) {
                                try {
                                    const snap = await db.ref("stories").once("value");
                                    snap.forEach((child) => {
                                        const d = child.val() || {};
                                        const uid =
                                            d.uid || d.userId || d.ownerId || d.creatorId || "";
                                        if (String(uid) !== String(myUid)) return;
                                        let createdAt = Number(
                                            d.createdAt || d.timestamp || d.time || 0
                                        );
                                        if (createdAt > 0 && createdAt < 1e12) createdAt *= 1000;
                                        if (!isStoryActive(d, createdAt)) return;
                                        ownStories.push({ id: child.key, data: d, createdAt });
                                    });
                                    ownStories.sort((a, b) => b.createdAt - a.createdAt);
                                } catch (e) {
                                    console.warn("own stories query", e);
                                }
                            }

                            const hasOwnStory = ownStories.length > 0;

                            // --- Avatar: users/ → auth → story data ---
                            if (av) {
                                let photo = "";
                                try {
                                    if (myUid) {
                                        const us = await db.ref("users/" + myUid).once("value");
                                        if (us.exists()) {
                                            const u = us.val() || {};
                                            photo =
                                                u.profilePhoto ||
                                                u.photoURL ||
                                                u.avatar ||
                                                u.profilePicture ||
                                                u.profile_image ||
                                                u.dp ||
                                                "";
                                        }
                                    }
                                } catch (_) {}
                                if (!photo) {
                                    try {
                                        const cu =
                                            (typeof firebase !== "undefined" &&
                                                firebase.auth &&
                                                firebase.auth().currentUser) ||
                                            null;
                                        if (cu && cu.photoURL) photo = cu.photoURL;
                                    } catch (_) {}
                                }
                                if (!photo && ownGroup && ownGroup.avatar) {
                                    photo = ownGroup.avatar;
                                }
                                if (photo && !String(photo).includes("default-avatar")) {
                                    av.src = photo;
                                }
                                av.onerror = function () {
                                    this.onerror = null;
                                    this.src = "assets/default-avatar.png";
                                };
                                av.alt = "Your Story";
                            }

                            // Ring state
                            addBtn.classList.toggle("hasActiveStory", hasOwnStory);
                            addBtn.classList.toggle("storyUnseen", hasOwnStory);
                            if (!hasOwnStory) addBtn.classList.remove("storySeen");

                            addBtn.removeAttribute("onclick");

                            // Ring click → view own story (if any), else upload
                            addBtn.onclick = function (e) {
                                if (e.target && e.target.closest && e.target.closest(".yourStoryPlus")) {
                                    return;
                                }
                                e.preventDefault();
                                e.stopPropagation();
                                if (hasOwnStory && myUid) {
                                    markStoryUserSeen(myUid);
                                    const first = ownStories[0];
                                    const params = new URLSearchParams();
                                    params.set("uid", myUid);
                                    // Home: start at own, then continue to friends
                                    params.set("from", "home");
                                    if (first && first.id) {
                                        params.set("story", first.id);
                                        params.set("storyId", first.id);
                                    }
                                    window.location.href = "stories.html?" + params.toString();
                                } else {
                                    window.location.href = "story-upload.html";
                                }
                            };

                            // Plus → always upload
                            if (plus) {
                                plus.onclick = function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = "story-upload.html";
                                };
                            }
                        })();
                };

                window.__vieworaStoriesHandler = storiesHandler;
                try {
                    if (window.__vieworaStoriesRef) {
                        window.__vieworaStoriesRef.off("value");
                    }
                } catch (_) {}
                window.__vieworaStoriesRef = db.ref("stories");
                window.__vieworaStoriesRef.on(
                    "value",
                    storiesHandler,
                    (error) => {
                        console.error(
                            "Viewora Stories error:",
                            error
                        );
                    }
                );
            })
            .catch((err) => {
                console.error("Stories init failed:", err);
            });
    }

    /* ======================================================
       START
    ====================================================== */

    function injectHomeStyles() {
        if (document.getElementById("vieworaHomeExtraCSS")) return;
        const style = document.createElement("style");
        style.id = "vieworaHomeExtraCSS";
        style.textContent = `
            /* Unseen story = bright gradient ring */
            .storyCard.storyUnseen .storyImageWrap,
            .storyCard.storyUnseen {
                /* ring via image wrap if present */
            }
            .storyCard.storyUnseen .storyImageWrap {
                background: conic-gradient(#7067ff, #00d9ff, #ff4fd8, #7067ff) !important;
                padding: 3px;
                border-radius: 50%;
            }
            .storyCard.storyUnseen .storyImage {
                border: 2px solid #0a0b10;
                border-radius: 50%;
            }
            /* Seen story = white / muted ring */
            .storyCard.storySeen .storyImageWrap {
                background: rgba(255,255,255,.35) !important;
                padding: 3px;
                border-radius: 50%;
            }
            .storyCard.storySeen .storyImage {
                border: 2px solid #0a0b10;
                border-radius: 50%;
                opacity: .92;
            }
            .storyCard.storySeen .storyName {
                color: #9aa0b0;
            }

            /* Search suggestions */
            .searchSuggestBlock { padding: 8px 4px 12px; }
            .searchSuggestTitle {
                font-size: 11px; font-weight: 700; color: #8b93a5;
                padding: 6px 10px; text-transform: uppercase; letter-spacing: .4px;
            }
            .searchSuggestItem {
                width: 100%; display: flex; align-items: center; gap: 12px;
                padding: 12px 12px; border: 0; background: transparent;
                color: #fff; text-align: left; cursor: pointer; border-radius: 12px;
                font-size: 14px;
            }
            .searchSuggestItem:hover { background: rgba(255,255,255,.06); }
            .searchSuggestItem i { color: #8b93a5; width: 18px; text-align: center; }

            /* Home 3-dot menu sheet */
            .homeContentMenu {
                position: fixed; inset: 0; z-index: 9999;
            }
            .homeContentMenu.hidden { display: none !important; }
            .homeMenuBackdrop {
                position: absolute; inset: 0; background: rgba(0,0,0,.55);
            }
            .homeMenuSheet {
                position: absolute; left: 0; right: 0; bottom: 0;
                max-height: 80vh; overflow: auto;
                background: #14151d;
                border-radius: 22px 22px 0 0;
                padding: 10px 12px calc(16px + env(safe-area-inset-bottom));
                box-shadow: 0 -20px 60px rgba(0,0,0,.5);
            }
            .homeMenuHandle {
                width: 40px; height: 4px; border-radius: 99px;
                background: rgba(255,255,255,.2); margin: 4px auto 10px;
            }
            .homeMenuTitle {
                font-size: 14px; font-weight: 800; padding: 4px 8px 12px;
            }
            .homeMenuItem {
                width: 100%; display: flex; align-items: center; gap: 12px;
                padding: 12px 10px; border: 0; border-radius: 14px;
                background: transparent; color: #fff; text-align: left; cursor: pointer;
            }
            .homeMenuItem:hover { background: rgba(255,255,255,.06); }
            .homeMenuItem.danger { color: #ff5b75; }
            .homeMenuIcon {
                width: 40px; height: 40px; border-radius: 12px;
                display: grid; place-items: center;
                background: rgba(255,255,255,.08); flex: 0 0 40px;
            }
            .homeMenuText { display: flex; flex-direction: column; gap: 2px; }
            .homeMenuText strong { font-size: 13px; }
            .homeMenuText small { font-size: 10px; color: #8b93a5; }
            .homeMenuItem.danger .homeMenuText small { color: rgba(255,91,117,.7); }
            .homeMenuCancel {
                width: 100%; margin-top: 8px; min-height: 44px;
                border: 0; border-radius: 14px; color: #fff;
                background: rgba(255,255,255,.08); font-weight: 700; cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }

    function wireSearchOpen() {
        // Header search icon → open search-page.html
        const candidates = [
            $("searchBtn"),
            $("headerSearchBtn"),
            $("openSearch"),
            document.querySelector("[data-action='search']"),
            document.querySelector(".headerIcon[aria-label*='earch' i]"),
            document.querySelector(".headerActions .headerIcon")
        ].filter(Boolean);

        // Prefer icon that looks like search
        let searchIcon = $("searchBtn") || $("headerSearchBtn") || $("openSearch");

        if (!searchIcon) {
            document.querySelectorAll(".headerIcon, .headerActions button, .headerActions a").forEach((el) => {
                const icon = el.querySelector("i");
                const cls = (icon && icon.className) || "";
                if (/fa-magnifying|fa-search|search/i.test(cls + " " + (el.id || "") + " " + (el.className || ""))) {
                    searchIcon = el;
                }
            });
        }

        if (searchIcon) {
            searchIcon.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = "search-page.html";
            });
        }

        // Also: if search section toggle exists, still allow expand but Enter goes to page
        const toggle = $("toggleSearch");
        if (toggle) {
            toggle.addEventListener("click", (e) => {
                // open full page instead of inline only
                e.preventDefault();
                window.location.href = "search-page.html";
            });
        }
    }

    
    /* ======================================================
       MESSAGE UNREAD BADGE (header paper-plane)
    ====================================================== */

    function updateMessageBadge(count) {
        const badge = document.getElementById("messageCount");
        if (!badge) return;
        const n = Number(count) || 0;
        if (n > 0) {
            badge.textContent = n > 99 ? "99+" : String(n);
            badge.classList.remove("hidden");
            badge.style.display = "grid";
        } else {
            badge.textContent = "0";
            badge.classList.add("hidden");
        }
    }

    function wireMessageBadge() {
        const badge = document.getElementById("messageCount");
        const btn = document.getElementById("messageBtn");
        if (!badge && !btn) return;

        // Always keep badge in DOM; only hide via class
        if (badge) {
            badge.classList.add("notificationBadge");
        }

        let uid = null;
        try {
            uid = getCurrentUID();
        } catch (_) {}

        const attach = (myUid) => {
            if (!myUid || !db) return;

            // Sum unread from userChats/{uid}/* 
            // supports: unread, unreadCount, unreadMessages
            const ref = db.ref("userChats/" + myUid);
            if (wireMessageBadge._ref) {
                try { wireMessageBadge._ref.off(); } catch (_) {}
            }
            wireMessageBadge._ref = ref;
            ref.on("value", (snap) => {
                let total = 0;
                if (snap.exists()) {
                    snap.forEach((child) => {
                        const v = child.val() || {};
                        // ONLY explicit unread counters (after read, messages.js sets unread: 0)
                        let n = Number(
                            v.unread != null ? v.unread :
                            v.unreadCount != null ? v.unreadCount :
                            v.unreadMessages != null ? v.unreadMessages :
                            v.unread_count != null ? v.unread_count :
                            0
                        );
                        if (!Number.isFinite(n) || n < 0) n = 0;
                        // Do NOT invent unread from lastMessage — that keeps badge stuck
                        if (v.read === true || v.seen === true || v.isRead === true) {
                            n = 0;
                        }
                        if (n > 0) total += n;
                    });
                }
                updateMessageBadge(total);
            }, (err) => {
                console.warn("Message badge listener:", err);
            });

            // Fallback / alternate path: chats inbox
            try {
                db.ref("chats").orderByChild("updatedAt").limitToLast(40).on("value", () => {});
            } catch (_) {}
        };

        if (uid) {
            attach(uid);
        } else if (typeof firebase !== "undefined" && firebase.auth) {
            firebase.auth().onAuthStateChanged((user) => {
                if (user) attach(user.uid);
                else updateMessageBadge(0);
            });
        }

        // Ensure button goes to messages
        if (btn && !btn.getAttribute("data-wired-msg")) {
            btn.setAttribute("data-wired-msg", "1");
            btn.addEventListener("click", (e) => {
                // allow default onclick if set, else go messages
                if (!btn.getAttribute("onclick")) {
                    e.preventDefault();
                    window.location.href = "messages.html";
                }
            });
        }
    }

    function loadMyStoryAvatarEarly() {
        const av = document.getElementById("myStoryAvatar");
        if (!av) return;
        const apply = (photo) => {
            if (!photo) return;
            av.src = photo;
            av.onerror = function () {
                this.onerror = null;
                this.src = "assets/default-avatar.png";
            };
        };
        try {
            const cu =
                (typeof firebase !== "undefined" &&
                    firebase.auth &&
                    firebase.auth().currentUser) ||
                null;
            if (cu && cu.photoURL) apply(cu.photoURL);
            const uid = (cu && cu.uid) || getCurrentUID();
            if (!uid || !db) return;
            db.ref("users/" + uid).once("value").then((snap) => {
                if (!snap.exists()) return;
                const u = snap.val() || {};
                const photo =
                    u.profilePhoto ||
                    u.photoURL ||
                    u.avatar ||
                    u.profilePicture ||
                    u.profile_image ||
                    u.dp ||
                    "";
                if (photo) apply(photo);
            }).catch(() => {});
        } catch (_) {}
    }

    function unlockPageScroll() {
        try {
            const html = document.documentElement;
            const body = document.body;
            html.style.setProperty("overflow-y", "auto", "important");
            html.style.setProperty("height", "auto", "important");
            html.style.setProperty("max-height", "none", "important");
            body.style.setProperty("overflow-y", "auto", "important");
            body.style.setProperty("height", "auto", "important");
            body.style.setProperty("max-height", "none", "important");
            body.style.setProperty("position", "relative", "important");
            body.style.setProperty("touch-action", "pan-y", "important");
            const app = document.getElementById("app");
            if (app) {
                app.classList.remove("hidden");
                app.style.setProperty("overflow", "visible", "important");
                app.style.setProperty("height", "auto", "important");
                app.style.setProperty("max-height", "none", "important");
            }
            // Kill stuck full-screen loaders
            document.querySelectorAll("#pageLoader, .pageLoader").forEach((el) => {
                el.classList.add("hidden", "loaderHide");
                el.style.display = "none";
                el.style.pointerEvents = "none";
            });
        } catch (_) {}
    }

    function initialize() {

        console.log(
            "Viewora Index initialized."
        );

        unlockPageScroll();
        setTimeout(unlockPageScroll, 300);
        setTimeout(unlockPageScroll, 1200);

        injectHomeStyles();
        wireSearchOpen();
        wireMessageBadge();
        loadMyStoryAvatarEarly();

        loadPosts();

        loadLongVideos();

        loadStories();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();

    }

})();