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

        const url =
            data?.userPhoto ||
            data?.photoURL ||
            data?.avatar ||
            data?.profilePhoto ||
            "assets/default-avatar.png";

        return safeURL(url) || "assets/default-avatar.png";
    };


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
                "Viewora User"
            );

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
                    >

                    <span class="postUserInfo">

                        <strong>
                            ${username}
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

    function renderPosts(snapshot) {

        if (!feedContainer) return;

        feedContainer.innerHTML = "";

        const posts = [];


        snapshot.forEach((child) => {

            const data =
                child.val() || {};


            /*
             * Only normal posts.
             * Videos/shorts are ignored here.
             */

            const type =
                String(
                    data.type ||
                    "post"
                ).toLowerCase();


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


        const fragment =
            document.createDocumentFragment();


        posts.forEach((post) => {

            fragment.appendChild(
                createPostCard(
                    post.id,
                    post.data
                )
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
                >


                <div class="videoMeta">

                    <h3>
                        ${title}
                    </h3>

                    <div class="videoSubMeta">

                        <span>
                            ${username}
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


        const fragment =
            document.createDocumentFragment();


        videos.forEach((video) => {

            fragment.appendChild(
                createVideoCard(
                    video.id,
                    video.data
                )
            );

        });


        longVideoContainer.appendChild(fragment);


        bindVideoEvents();

    }


    /* ======================================================
       LOAD LONG VIDEOS
    ====================================================== */

    function loadLongVideos() {

        if (!longVideoContainer) return;


        db.ref("posts")
            .on(
                "value",
                renderLongVideos,
                (error) => {

                    console.error(
                        "Viewora videos error:",
                        error
                    );

                    hideSkeleton(videoSkeleton);

                }
            );

    }


    /* ======================================================
       POST EVENTS
    ====================================================== */

    function bindPostEvents() {

        if (!feedContainer) return;


        feedContainer
            .querySelectorAll(
                "[data-view-image]"
            )
            .forEach((image) => {

                image.addEventListener(
                    "click",
                    () => {

                        const url =
                            image.dataset.viewImage;

                        const viewer =
                            $("imageViewer");

                        const viewerImage =
                            $("viewerImage");

                        if (
                            viewer &&
                            viewerImage &&
                            url
                        ) {

                            viewerImage.src =
                                url;

                            viewer.classList.remove(
                                "hidden"
                            );

                        }

                    }
                );

            });


        feedContainer
            .querySelectorAll(
                '[data-action="share"]'
            )
            .forEach((button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        const card =
                            button.closest(
                                ".vieworaPostCard"
                            );

                        const postId =
                            card?.dataset.postId;

                        const shareURL =
                            `${location.origin}${location.pathname}?post=${encodeURIComponent(postId || "")}`;


                        try {

                            if (
                                navigator.share
                            ) {

                                await navigator.share({
                                    title:
                                        "Viewora Post",
                                    url:
                                        shareURL
                                });

                            } else if (
                                navigator.clipboard
                            ) {

                                await navigator.clipboard.writeText(
                                    shareURL
                                );

                                showToast(
                                    "Post link copied"
                                );

                            }

                        } catch (error) {

                            console.log(
                                "Share cancelled."
                            );

                        }

                    }
                );

            });

    }


    /* ======================================================
       VIDEO EVENTS
    ====================================================== */

    function bindVideoEvents() {

        if (!longVideoContainer) return;


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


                        db.ref(
                            "posts/" + id
                        )
                        .once("value")
                        .then((snapshot) => {

                            const data =
                                snapshot.val() ||
                                {};

                            const url =
                                getVideoURL(data);


                            if (!url) {

                                showToast(
                                    "Video unavailable"
                                );

                                return;
                            }


                            viewerVideo.src =
                                url;

                            videoViewer.classList.remove(
                                "hidden"
                            );

                            viewerVideo.play()
                                .catch(() => {});

                        })
                        .catch((error) => {

                            console.error(
                                "Video open error:",
                                error
                            );

                        });

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
       SEARCH
    ====================================================== */

    let allUsersCache = null;


    function loadUsersForSearch() {

        if (allUsersCache) {
            return Promise.resolve(
                allUsersCache
            );
        }


        return db.ref("users")
            .once("value")
            .then((snapshot) => {

                const users = [];


                snapshot.forEach((child) => {

                    users.push({
                        id: child.key,
                        data:
                            child.val() || {}
                    });

                });


                allUsersCache =
                    users;


                return users;

            });

    }


    function renderSearchResults(query) {

        if (!searchResults) return;


        query =
            String(query || "")
                .trim()
                .toLowerCase();


        if (!query) {

            searchResults.innerHTML =
                "";

            return;
        }


        loadUsersForSearch()
            .then((users) => {

                const matches =
                    users
                        .filter((item) => {

                            const name =
                                String(
                                    item.data.username ||
                                    item.data.displayName ||
                                    ""
                                )
                                .toLowerCase();

                            return name.includes(
                                query
                            );

                        })
                        .slice(0, 10);


                if (!matches.length) {

                    searchResults.innerHTML = `

                        <div class="emptyState">

                            <i class="fa-solid fa-user-slash"></i>

                            <p>
                                No users found
                            </p>

                        </div>

                    `;

                    return;
                }


                searchResults.innerHTML =
                    matches
                        .map((item) => {

                            const name =
                                escapeHTML(
                                    item.data.username ||
                                    item.data.displayName ||
                                    "User"
                                );

                            const avatar =
                                getAvatar(
                                    item.data
                                );


                            return `

                                <a
                                    href="profile.html?uid=${encodeURIComponent(item.id)}"
                                    class="searchUser"
                                >

                                    <img
                                        src="${escapeHTML(avatar)}"
                                        alt="${name}"
                                    >

                                    <span>
                                        ${name}
                                    </span>

                                </a>

                            `;

                        })
                        .join("");

            })
            .catch((error) => {

                console.error(
                    "Search error:",
                    error
                );

            });

    }


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                renderSearchResults(
                    searchInput.value
                );

            }
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
    ====================================================== */

    function loadStories() {

        const container =
            $("firebaseStories");


        if (!container) return;


        db.ref("stories")
            .on(
                "value",
                (snapshot) => {

                    container.innerHTML =
                        "";


                    const stories = [];


                    snapshot.forEach((child) => {

                        const data =
                            child.val() ||
                            {};


                        stories.push({
                            id: child.key,
                            data
                        });

                    });


                    stories.sort(
                        (a, b) =>
                            Number(
                                b.data.createdAt ||
                                b.data.timestamp ||
                                0
                            ) -
                            Number(
                                a.data.createdAt ||
                                a.data.timestamp ||
                                0
                            )
                    );


                    stories
                        .slice(0, 20)
                        .forEach((story) => {

                            const data =
                                story.data;


                            const avatar =
                                getAvatar(
                                    data
                                );


                            const username =
                                escapeHTML(
                                    data.username ||
                                    data.displayName ||
                                    "User"
                                );


                            const button =
                                document.createElement(
                                    "button"
                                );


                            button.type =
                                "button";


                            button.className =
                                "storyCard";


                            button.innerHTML = `

                                <div class="storyImageWrap">

                                    <img
                                        src="${escapeHTML(avatar)}"
                                        alt="${username}"
                                        class="storyImage"
                                        loading="lazy"
                                    >

                                </div>

                                <span class="storyName">
                                    ${username}
                                </span>

                            `;


                            container.appendChild(
                                button
                            );

                        });

                },
                (error) => {

                    console.error(
                        "Stories error:",
                        error
                    );

                }
            );

    }


    /* ======================================================
       START
    ====================================================== */

    function initialize() {

        console.log(
            "Viewora Index initialized."
        );


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