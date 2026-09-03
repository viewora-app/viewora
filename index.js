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
        return (
            data.verified === true ||
            data.isVerified === true ||
            data.blueTick === true ||
            data.badge === "verified" ||
            data.verification === true ||
            data.verificationStatus === "verified"
        );
    };

    const verifiedBadgeHTML = (data) => {
        if (!isVerifiedUser(data)) return "";
        return `<i class="fa-solid fa-circle-check verifiedTick" title="Verified" aria-label="Verified"></i>`;
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

                // Verified flag from users node
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

                if (isVerifiedUser(user)) {
                    video.data.verified = true;
                }
            })
        ).then(() => {
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
                if (myUID) {
                    await db.ref("reports").push({
                        type: type || "post",
                        contentId: id,
                        fromUID: myUID,
                        reason: "other",
                        createdAt: Date.now()
                    });
                }
                showToast("Report submitted");
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

    async function togglePostLike(card, postId, button) {
        const uid = getMyUID();
        if (!uid) {
            showToast("Login required to like");
            return;
        }

        const likeRef = db.ref("postLikes/" + postId + "/" + uid);
        const postRef = db.ref("posts/" + postId);
        const icon = button.querySelector("i");
        const label = button.querySelector("span");

        try {
            const snap = await likeRef.once("value");
            let count = Number(
                (label && label.textContent.replace(/[^\d.]/g, "")) || 0
            );
            // Prefer live field if present
            const postSnap = await postRef.once("value");
            const pdata = postSnap.val() || {};
            count = Number(
                pdata.likesCount ||
                pdata.likes ||
                count ||
                0
            );

            if (snap.exists()) {
                await likeRef.remove();
                count = Math.max(0, count - 1);
                if (icon) icon.className = "fa-regular fa-heart";
                button.classList.remove("liked");
            } else {
                await likeRef.set(true);
                count = count + 1;
                if (icon) icon.className = "fa-solid fa-heart";
                button.classList.add("liked");
            }

            await postRef.update({
                likes: count,
                likesCount: count
            });

            if (label) label.textContent = formatCount(count);
        } catch (err) {
            console.error("Like failed:", err);
            showToast("Like failed");
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
            const snap = await db.ref("comments/" + postId).once("value");
            const val = snap.val();

            if (!val) {
                list.innerHTML =
                    '<div style="padding:24px;text-align:center;color:#8b8b9a;font-size:13px;">No comments yet. Be the first.</div>';
                return;
            }

            const items = Object.entries(val)
                .map(([id, data]) => ({ id, ...(data || {}) }))
                .sort(
                    (a, b) =>
                        Number(a.createdAt || 0) -
                        Number(b.createdAt || 0)
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

            await db.ref("comments/" + postId).push({
                uid,
                text,
                name,
                profilePhoto: photo,
                createdAt:
                    (typeof firebase !== "undefined" &&
                        firebase.database?.ServerValue?.TIMESTAMP) ||
                    Date.now()
            });

            // bump comment count
            try {
                const pref = db.ref("posts/" + postId);
                const ps = await pref.once("value");
                const p = ps.val() || {};
                const n =
                    Number(p.commentsCount || p.comments || 0) + 1;
                await pref.update({
                    comments: n,
                    commentsCount: n
                });
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
                    // uid may be missing on card – try data
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
            .querySelectorAll(
                ".videoThumbnailWrap"
            )
            .forEach((thumbnail) => {

                thumbnail.addEventListener(
                    "click",
                    () => {

                        const card =
                            thumbnail.closest(
                                ".longVideoCard"
                            );

                        if (!card) return;

                        const id =
                            card.dataset.videoId;

                        const videoViewer =
                            $("videoViewer");

                        const viewerVideo =
                            $("viewerVideo");


                        if (
                            !videoViewer ||
                            !viewerVideo
                        ) {
                            return;
                        }


                        /*
                         * Open full video page (YouTube-style).
                         * Falls back to inline viewer if page missing.
                         */
                        window.location.href =
                            "video.html?id=" +
                            encodeURIComponent(id);

                    }
                );

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
                            ""
                        )
                        .toLowerCase();


                    if (
                        itemCategory &&
                        itemCategory !== category
                    ) {

                        card.style.display =
                            "none";

                    } else {

                        card.style.display =
                            "";

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

        try {
            const snap = await db.ref("following/" + uid).once("value");
            if (!snap.exists()) return;

            const val = snap.val() || {};
            Object.keys(val).forEach((targetId) => {
                const item = val[targetId];
                if (
                    item === true ||
                    item === 1 ||
                    item === "true" ||
                    (item && typeof item === "object")
                ) {
                    followingSet.add(targetId);
                }
            });
        } catch (err) {
            console.warn("Following load failed:", err);
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

        // Load following list first, then stories
        Promise.resolve()
            .then(async () => {
                if (currentUserUID) {
                    await loadFollowingSet(currentUserUID);
                }

                db.ref("stories").on(
                    "value",
                    async (snapshot) => {

                        container.innerHTML = "";

                        /*
                         * Group by user:
                         * { uid: { stories: [], latest, avatar, name } }
                         */
                        const byUser = {};

                        snapshot.forEach((child) => {
                            const data = child.val() || {};
                            const uid =
                                data.uid ||
                                data.userId ||
                                data.ownerId ||
                                data.creatorId ||
                                "";

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

                            // Only own + followed users
                            const isOwn =
                                currentUserUID &&
                                uid === currentUserUID;
                            const isFollowed =
                                followingSet.has(uid);

                            if (!isOwn && !isFollowed) {
                                // If not logged in, still show all active (optional)
                                // For stricter feed: skip non-followed
                                if (currentUserUID) {
                                    return;
                                }
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
                        const groups = Object.values(byUser).map((g) => {
                            g.seen = isStoryUserSeen(g.uid, g.latestAt);
                            return g;
                        }).sort((a, b) => {
                            if (currentUserUID && a.uid === currentUserUID) return -1;
                            if (currentUserUID && b.uid === currentUserUID) return 1;
                            // Unseen before seen
                            if (a.seen !== b.seen) return a.seen ? 1 : -1;
                            return b.latestAt - a.latestAt;
                        });

                        // Max 25 user rings
                        groups.slice(0, 25).forEach((group) => {
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
                            const ringClass = group.seen
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

                            button.innerHTML = `
                                <div class="storyImageWrap">
                                    <img
                                        src="${escapeHTML(avatar)}"
                                        alt="${label}"
                                        class="storyImage"
                                        loading="lazy"
                                        onerror="this.src='assets/default-avatar.png'"
                                    >
                                </div>
                                <span class="storyName">
                                    ${label}
                                </span>
                            `;

                            button.addEventListener("click", () => {
                                // Mark as seen before opening
                                markStoryUserSeen(group.uid);

                                const params =
                                    new URLSearchParams();

                                // Open ALL stories of this user
                                if (group.uid) {
                                    params.set("uid", group.uid);
                                }
                                if (firstStoryId) {
                                    params.set(
                                        "storyId",
                                        firstStoryId
                                    );
                                }

                                window.location.href =
                                    "stories.html?" +
                                    params.toString();
                            });

                            container.appendChild(button);
                        });
                    },
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

            ref.on("value", (snap) => {
                let total = 0;
                if (snap.exists()) {
                    snap.forEach((child) => {
                        const v = child.val() || {};
                        const n =
                            Number(v.unreadCount) ||
                            Number(v.unread) ||
                            Number(v.unreadMessages) ||
                            0;
                        if (n > 0) total += n;
                        // also if last message from other and not read
                        else if (
                            v.lastMessage &&
                            v.lastSenderId &&
                            String(v.lastSenderId) !== String(myUid) &&
                            v.read !== true &&
                            v.seen !== true
                        ) {
                            total += 1;
                        }
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

    function initialize() {

        console.log(
            "Viewora Index initialized."
        );

        injectHomeStyles();
        wireSearchOpen();
        wireMessageBadge();

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