"use strict";

/* =========================================================
   VIEWORA INDEX.JS
   Home Feed • Posts • Images • Videos • Likes • Comments
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    console.log("🚀 Viewora Index JS Started");

    const feed = document.getElementById("feedContainer");

    if (!feed) {
        console.error("❌ feedContainer not found");
        return;
    }

    /* =====================================================
       HELPERS
    ===================================================== */

    function escapeHTML(value) {

        if (value === null || value === undefined) return "";

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function getMediaURL(post) {

        /*
          Different possible field names supported
        */

        const url =
            post.mediaUrl ||
            post.imageUrl ||
            post.imageURL ||
            post.photoUrl ||
            post.photoURL ||
            post.fileUrl ||
            post.fileURL ||
            post.cloudinaryUrl ||
            post.url ||
            post.image ||
            post.media ||
            "";

        return typeof url === "string" ? url.trim() : "";
    }


    function getPostText(post) {

        return (
            post.caption ||
            post.text ||
            post.content ||
            post.description ||
            post.title ||
            ""
        );
    }


    function getPostType(post) {

        const type =
            post.type ||
            post.postType ||
            post.mediaType ||
            "";

        return String(type).toLowerCase();
    }


    function isVideo(post) {

        const type = getPostType(post);

        if (
            type === "video" ||
            type === "long" ||
            type === "short" ||
            type === "reel"
        ) {
            return true;
        }

        const url = getMediaURL(post).toLowerCase();

        return (
            url.includes(".mp4") ||
            url.includes(".webm") ||
            url.includes(".mov") ||
            url.includes("video/upload")
        );
    }


    function formatTime(timestamp) {

        if (!timestamp) return "Just now";

        let date;

        if (typeof timestamp === "number") {

            date = new Date(timestamp);

        } else {

            date = new Date(timestamp);

        }

        if (isNaN(date.getTime())) {
            return "Just now";
        }

        const now = Date.now();

        const diff = now - date.getTime();

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) {
            return "Just now";
        }

        if (minutes < 60) {
            return `${minutes}m`;
        }

        if (hours < 24) {
            return `${hours}h`;
        }

        if (days < 7) {
            return `${days}d`;
        }

        return date.toLocaleDateString();
    }


    function getUserName(post) {

        return (
            post.username ||
            post.userName ||
            post.authorUsername ||
            post.name ||
            post.fullName ||
            "Viewora User"
        );
    }


    function getUserPhoto(post) {

        return (
            post.profilePhoto ||
            post.profilePhotoURL ||
            post.photoURL ||
            post.avatar ||
            "assets/default-avatar.png"
        );
    }


    /* =====================================================
       LOAD POSTS
    ===================================================== */

    async function loadPosts() {

        feed.innerHTML = `
            <div class="feedLoading">
                <div class="premiumLoader">
                    <div class="loaderRing"></div>
                    <div class="loaderRing"></div>
                    <div class="loaderRing"></div>
                </div>
                <p>Loading Viewora...</p>
            </div>
        `;

        try {

            if (
                typeof db === "undefined" ||
                typeof postsRef !== "function"
            ) {

                throw new Error(
                    "Firebase database is not available"
                );

            }

            const snapshot =
                await postsRef()
                    .orderByChild("createdAt")
                    .once("value");

            const posts = [];

            snapshot.forEach(child => {

                const data = child.val() || {};

                posts.push({

                    id: child.key,

                    ...data

                });

            });


            /* Newest first */

            posts.reverse();


            if (!posts.length) {

                feed.innerHTML = `
                    <div class="emptyFeed glass">

                        <div class="emptyIcon">
                            <i class="fa-regular fa-images"></i>
                        </div>

                        <h2>No posts yet</h2>

                        <p>
                            Be the first person to share something
                            with the Viewora community.
                        </p>

                        <button
                            class="primaryBtn"
                            onclick="location.href='upload.html'"
                        >
                            <i class="fa-solid fa-plus"></i>
                            Create Post
                        </button>

                    </div>
                `;

                return;
            }


            feed.innerHTML = "";

            posts.forEach(post => {

                feed.insertAdjacentHTML(
                    "beforeend",
                    createPostHTML(post)
                );

            });


            attachPostEvents();

            console.log(
                `✅ ${posts.length} posts loaded`
            );

        } catch (error) {

            console.error(
                "❌ Feed loading error:",
                error
            );

            feed.innerHTML = `
                <div class="emptyFeed glass">

                    <div class="emptyIcon error">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>

                    <h2>Unable to load posts</h2>

                    <p>
                        Please check your internet connection
                        and try again.
                    </p>

                    <button
                        class="primaryBtn"
                        id="retryFeed"
                    >
                        <i class="fa-solid fa-rotate"></i>
                        Retry
                    </button>

                </div>
            `;

            const retry =
                document.getElementById("retryFeed");

            if (retry) {

                retry.onclick = loadPosts;

            }

        }

    }


    /* =====================================================
       CREATE POST HTML
    ===================================================== */

    function createPostHTML(post) {

        const mediaURL =
            getMediaURL(post);

        const caption =
            getPostText(post);

        const username =
            getUserName(post);

        const profilePhoto =
            getUserPhoto(post);

        const video =
            isVideo(post);

        const likes =
            Number(post.likesCount || post.likes || 0);

        const comments =
            Number(post.commentsCount || post.comments || 0);

        const views =
            Number(post.views || post.viewCount || 0);

        let mediaHTML = "";


        /* ===============================================
           MEDIA
        =============================================== */

        if (mediaURL) {

            if (video) {

                mediaHTML = `
                    <div class="postMedia videoMedia">

                        <video
                            class="feedVideo"
                            src="${escapeHTML(mediaURL)}"
                            controls
                            playsinline
                            preload="metadata"
                        ></video>

                    </div>
                `;

            } else {

                mediaHTML = `
                    <div class="postMedia imageMedia">

                        <img
                            class="feedImage"
                            src="${escapeHTML(mediaURL)}"
                            alt="Viewora post"
                            loading="lazy"
                            onclick="openVieworaImage('${escapeHTML(mediaURL)}')"
                            onerror="this.style.display='none'; this.parentElement.classList.add('mediaError');"
                        >

                        <div class="mediaErrorMessage">
                            <i class="fa-regular fa-image"></i>
                            <span>Image unavailable</span>
                        </div>

                    </div>
                `;

            }

        }


        /* ===============================================
           USER INFO
        =============================================== */

        return `

        <article
            class="postCard glass"
            data-post-id="${escapeHTML(post.id)}"
        >

            <div class="postHeader">

                <div
                    class="postUser"
                    onclick="location.href='profile.html?uid=${encodeURIComponent(post.uid || post.userId || "")}'"
                >

                    <img
                        class="postAvatar"
                        src="${escapeHTML(profilePhoto)}"
                        alt="${escapeHTML(username)}"
                        onerror="this.src='assets/default-avatar.png'"
                    >

                    <div class="postUserInfo">

                        <h3>
                            ${escapeHTML(username)}

                            ${
                                post.verified === true
                                ? `
                                    <i
                                        class="fa-solid fa-circle-check verifiedBadge"
                                    ></i>
                                  `
                                : ""
                            }

                        </h3>

                        <span>
                            ${formatTime(
                                post.createdAt ||
                                post.timestamp
                            )}
                        </span>

                    </div>

                </div>


                <button
                    class="postMore"
                    data-post-id="${escapeHTML(post.id)}"
                    aria-label="More"
                >

                    <i class="fa-solid fa-ellipsis"></i>

                </button>

            </div>


            ${
                caption
                ? `
                    <div class="postContent">
                        <p>${escapeHTML(caption)}</p>
                    </div>
                  `
                : ""
            }


            ${mediaHTML}


            <div class="postStats">

                <span>
                    <i class="fa-regular fa-heart"></i>
                    <b class="likeCount">${likes}</b>
                </span>

                <span>
                    <i class="fa-regular fa-comment"></i>
                    <b>${comments}</b>
                </span>

                <span>
                    <i class="fa-regular fa-eye"></i>
                    <b>${views}</b>
                </span>

            </div>


            <div class="postActions">

                <button
                    class="postAction likeButton"
                    data-post-id="${escapeHTML(post.id)}"
                >

                    <i class="fa-regular fa-heart"></i>

                    <span>Like</span>

                </button>


                <button
                    class="postAction commentButton"
                    data-post-id="${escapeHTML(post.id)}"
                >

                    <i class="fa-regular fa-comment"></i>

                    <span>Comment</span>

                </button>


                <button
                    class="postAction shareButton"
                    data-post-id="${escapeHTML(post.id)}"
                >

                    <i class="fa-solid fa-share"></i>

                    <span>Share</span>

                </button>


                <button
                    class="postAction saveButton"
                    data-post-id="${escapeHTML(post.id)}"
                >

                    <i class="fa-regular fa-bookmark"></i>

                    <span>Save</span>

                </button>

            </div>

        </article>

        `;

    }


    /* =====================================================
       EVENTS
    ===================================================== */

    function attachPostEvents() {

        /* ===============================================
           LIKE
        =============================================== */

        document
            .querySelectorAll(".likeButton")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async function () {

                        const postId =
                            this.dataset.postId;

                        if (!postId) return;

                        const uid =
                            typeof getUID === "function"
                            ? getUID()
                            : null;

                        if (!uid) {

                            location.href =
                                "login.html";

                            return;

                        }

                        const likeRef =
                            db.ref(
                                `likes/${postId}/${uid}`
                            );

                        try {

                            const snap =
                                await likeRef.once(
                                    "value"
                                );

                            if (snap.exists()) {

                                await likeRef.remove();

                                this.classList.remove(
                                    "liked"
                                );

                                this.querySelector(
                                    "i"
                                ).className =
                                    "fa-regular fa-heart";

                            } else {

                                await likeRef.set({
                                    uid: uid,
                                    createdAt:
                                        SERVER_TIME
                                });

                                this.classList.add(
                                    "liked"
                                );

                                this.querySelector(
                                    "i"
                                ).className =
                                    "fa-solid fa-heart";

                            }

                        } catch (error) {

                            console.error(
                                "Like error:",
                                error
                            );

                        }

                    }
                );

            });


        /* ===============================================
           COMMENTS
        =============================================== */

        document
            .querySelectorAll(".commentButton")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    function () {

                        const postId =
                            this.dataset.postId;

                        openComments(postId);

                    }
                );

            });


        /* ===============================================
           SHARE
        =============================================== */

        document
            .querySelectorAll(".shareButton")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async function () {

                        const postId =
                            this.dataset.postId;

                        const shareURL =
                            `${location.origin}${location.pathname}?post=${encodeURIComponent(postId)}`;

                        try {

                            if (
                                navigator.share
                            ) {

                                await navigator.share({

                                    title:
                                        "Viewora Post",

                                    text:
                                        "Check this post on Viewora",

                                    url:
                                        shareURL

                                });

                            } else {

                                await navigator.clipboard.writeText(
                                    shareURL
                                );

                                showToast(
                                    "Link copied!"
                                );

                            }

                        } catch (error) {

                            console.log(
                                "Share cancelled"
                            );

                        }

                    }
                );

            });


        /* ===============================================
           SAVE
        =============================================== */

        document
            .querySelectorAll(".saveButton")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async function () {

                        const uid =
                            typeof getUID === "function"
                            ? getUID()
                            : null;

                        const postId =
                            this.dataset.postId;

                        if (!uid) {

                            location.href =
                                "login.html";

                            return;

                        }

                        try {

                            const ref =
                                db.ref(
                                    `savedPosts/${uid}/${postId}`
                                );

                            const snap =
                                await ref.once("value");

                            if (snap.exists()) {

                                await ref.remove();

                                this.querySelector(
                                    "i"
                                ).className =
                                    "fa-regular fa-bookmark";

                            } else {

                                await ref.set({

                                    postId:
                                        postId,

                                    savedAt:
                                        SERVER_TIME

                                });

                                this.querySelector(
                                    "i"
                                ).className =
                                    "fa-solid fa-bookmark";

                            }

                        } catch (error) {

                            console.error(
                                "Save error:",
                                error
                            );

                        }

                    }
                );

            });

    }


    /* =====================================================
       IMAGE VIEWER
    ===================================================== */

    window.openVieworaImage =
        function (url) {

            const viewer =
                document.getElementById(
                    "imageViewer"
                );

            const image =
                document.getElementById(
                    "viewerImage"
                );

            if (!viewer || !image) {

                window.open(url, "_blank");

                return;

            }

            image.src = url;

            viewer.classList.remove(
                "hidden"
            );

        };


    const closeViewer =
        document.getElementById(
            "closeViewer"
        );

    if (closeViewer) {

        closeViewer.addEventListener(
            "click",
            () => {

                const viewer =
                    document.getElementById(
                        "imageViewer"
                    );

                const image =
                    document.getElementById(
                        "viewerImage"
                    );

                if (viewer) {
                    viewer.classList.add(
                        "hidden"
                    );
                }

                if (image) {
                    image.src = "";
                }

            }
        );

    }


    /* =====================================================
       COMMENTS MODAL
    ===================================================== */

    async function openComments(postId) {

        const modal =
            document.getElementById(
                "commentModal"
            );

        const container =
            document.getElementById(
                "commentsContainer"
            );

        if (!modal || !container) return;

        modal.classList.remove(
            "hidden"
        );

        container.innerHTML = `
            <div class="commentsLoading">
                Loading comments...
            </div>
        `;

        try {

            const snapshot =
                await commentsRef(postId)
                    .orderByChild("createdAt")
                    .once("value");

            container.innerHTML = "";

            if (!snapshot.exists()) {

                container.innerHTML = `
                    <div class="commentsEmpty">
                        No comments yet.
                        <br>
                        Be the first to comment.
                    </div>
                `;

                return;

            }

            const comments = [];

            snapshot.forEach(child => {

                comments.push({

                    id: child.key,

                    ...child.val()

                });

            });

            comments.forEach(comment => {

                container.insertAdjacentHTML(
                    "beforeend",
                    `
                    <div class="commentItem">

                        <img
                            src="${
                                escapeHTML(
                                    comment.profilePhoto ||
                                    comment.photoURL ||
                                    "assets/default-avatar.png"
                                )
                            }"
                            onerror="this.src='assets/default-avatar.png'"
                        >

                        <div>

                            <b>
                                ${escapeHTML(
                                    comment.username ||
                                    comment.name ||
                                    "Viewora User"
                                )}
                            </b>

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

                        </div>

                    </div>
                    `
                );

            });

        } catch (error) {

            console.error(
                "Comments error:",
                error
            );

            container.innerHTML = `
                <div class="commentsEmpty">
                    Unable to load comments.
                </div>
            `;

        }

    }


    const closeComment =
        document.getElementById(
            "closeComment"
        );

    if (closeComment) {

        closeComment.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "commentModal"
                    )
                    ?.classList.add(
                        "hidden"
                    );

            }
        );

    }


    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(message) {

        const toast =
            document.getElementById(
                "toast"
            );

        const text =
            document.getElementById(
                "toastText"
            );

        if (!toast || !text) return;

        text.textContent =
            message;

        toast.classList.remove(
            "hidden"
        );

        setTimeout(() => {

            toast.classList.add(
                "hidden"
            );

        }, 2200);

    }


    window.vieworaToast =
        showToast;


    /* =====================================================
       SEARCH
    ===================================================== */

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                const query =
                    this.value
                        .trim()
                        .toLowerCase();

                document
                    .querySelectorAll(
                        ".postCard"
                    )
                    .forEach(card => {

                        const text =
                            card.textContent
                                .toLowerCase();

                        card.style.display =
                            !query ||
                            text.includes(query)
                            ? ""
                            : "none";

                    });

            }
        );

    }


    /* =====================================================
       START
    ===================================================== */

    loadPosts();

});