/* =========================================================
   VIEWORA • SHORTS.JS
   Premium Shorts Feed
   Firebase Realtime Database
========================================================= */

(() => {
    "use strict";

    /* =====================================================
       GLOBAL
    ====================================================== */

    let currentUser = null;
    let shorts = [];
    let currentShareId = null;
    let currentCommentId = null;
    let currentMenuShortId = null;

    const DEFAULT_AVATAR = "assets/default-avatar.png";

    let shortsListener = null;
    let viewObserver = null;


    /* =====================================================
       FIREBASE
    ====================================================== */

    if (
        typeof firebase === "undefined" ||
        !firebase.apps ||
        !firebase.apps.length
    ) {
        console.error("Viewora: Firebase is not initialized.");
        return;
    }

    const auth = firebase.auth();
    const db = firebase.database();


    /* =====================================================
       DOM
    ====================================================== */

    const container = document.getElementById("shortsContainer");
    const skeleton = document.getElementById("shortsSkeleton");
    const emptyState = document.getElementById("emptyState");

    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toastText");

    const heartAnimation =
        document.getElementById("heartAnimation");

    const commentsModal =
        document.getElementById("commentsModal");

    const shareModal =
        document.getElementById("shareModal");

    const reportModal =
        document.getElementById("reportModal");

    const shortMenu =
        document.getElementById("shortMenu");


    /* =====================================================
       TOAST
    ====================================================== */

    function showToast(message) {

        if (!toast || !toastText) return;

        toastText.textContent = message;

        toast.classList.remove("hidden");

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        clearTimeout(window.vieworaToastTimer);

        window.vieworaToastTimer = setTimeout(() => {

            toast.classList.remove("show");

            setTimeout(() => {
                toast.classList.add("hidden");
            }, 250);

        }, 2200);
    }


    /* =====================================================
       ESCAPE HTML
    ====================================================== */

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


    /* =====================================================
       NUMBER FORMAT
    ====================================================== */

    function formatNumber(value) {

        const number = Number(value || 0);

        if (number >= 1000000) {
            return (
                (number / 1000000)
                    .toFixed(1)
                    .replace(".0", "") + "M"
            );
        }

        if (number >= 1000) {
            return (
                (number / 1000)
                    .toFixed(1)
                    .replace(".0", "") + "K"
            );
        }

        return String(number);
    }


    /* =====================================================
       TIME AGO
    ====================================================== */

    function timeAgo(timestamp) {

        if (!timestamp) return "";

        const diff =
            Date.now() - Number(timestamp);

        const seconds =
            Math.floor(diff / 1000);

        if (seconds < 60) {
            return "Just now";
        }

        const minutes =
            Math.floor(seconds / 60);

        if (minutes < 60) {
            return `${minutes}m ago`;
        }

        const hours =
            Math.floor(minutes / 60);

        if (hours < 24) {
            return `${hours}h ago`;
        }

        const days =
            Math.floor(hours / 24);

        if (days < 7) {
            return `${days}d ago`;
        }

        return new Date(
            Number(timestamp)
        ).toLocaleDateString();
    }


    /* =====================================================
       USER HELPERS
    ====================================================== */

    function getCurrentUserName() {

        return (
            currentUser?.displayName ||
            currentUser?.email?.split("@")[0] ||
            "Viewora User"
        );
    }


    function getCurrentUserAvatar() {

        return (
            currentUser?.photoURL ||
            DEFAULT_AVATAR
        );
    }


    /* =====================================================
       GET SHORT USER ID
    ====================================================== */

    function getShortUserId(short) {

        return (
            short.uid ||
            short.userId ||
            short.ownerId ||
            ""
        );
    }


    /* =====================================================
       GET VIDEO URL
    ====================================================== */

    function getVideoURL(short) {

        return (
            short.videoURL ||
            short.videoUrl ||
            short.video ||
            short.url ||
            ""
        );
    }


    /* =====================================================
       GET THUMBNAIL
    ====================================================== */

    function getThumbnail(short) {

        return (
            short.thumbnail ||
            short.thumbnailURL ||
            short.thumbnailUrl ||
            ""
        );
    }


    /* =====================================================
       GET PROFILE
    ====================================================== */

    function getProfile(short) {

        return (
            short.profile ||
            short.profileURL ||
            short.profileUrl ||
            short.avatar ||
            short.photoURL ||
            DEFAULT_AVATAR
        );
    }


    /* =====================================================
       LOAD SHORTS
    ====================================================== */

    function loadShorts() {

        if (!container) return;

        showSkeleton();

        if (shortsListener) {
            db.ref("shorts").off(
                "value",
                shortsListener
            );
        }

        const ref =
            db.ref("shorts")
                .orderByChild("createdAt")
                .limitToLast(100);

        shortsListener = snapshot => {

            shorts = [];

            if (!snapshot.exists()) {

                container.innerHTML = "";

                showEmpty();
                hideSkeleton();

                return;
            }

            snapshot.forEach(child => {

                const data =
                    child.val() || {};

                shorts.push({
                    id: child.key,
                    ...data
                });

            });

            shorts.sort(
                (a, b) =>
                    Number(b.createdAt || 0) -
                    Number(a.createdAt || 0)
            );

            renderShorts();

            hideSkeleton();
        };

        ref.on(
            "value",
            shortsListener,
            error => {

                console.error(
                    "Shorts loading error:",
                    error
                );

                hideSkeleton();

                showToast(
                    "Unable to load Shorts."
                );
            }
        );
    }


    /* =====================================================
       RENDER
    ====================================================== */

    function renderShorts() {

        if (!container) return;

        container.innerHTML = "";

        if (!shorts.length) {

            showEmpty();

            return;
        }

        hideEmpty();

        shorts.forEach(short => {

            container.appendChild(
                createShortCard(short)
            );

        });

        setupVideoObserver();

        refreshAllLikeStates();
        refreshAllSaveStates();
        refreshAllFollowStates();
    }


    /* =====================================================
       CREATE CARD
    ====================================================== */

    function createShortCard(short) {

        const card =
            document.createElement("article");

        card.className = "shortCard";

        card.dataset.id = short.id;

        const videoURL =
            getVideoURL(short);

        const thumbnail =
            getThumbnail(short);

        const profile =
            getProfile(short);

        const username =
            short.username ||
            short.displayName ||
            short.name ||
            "Viewora User";

        const caption =
            short.caption ||
            short.description ||
            "";

        const music =
            short.music ||
            short.audioName ||
            "Original Audio";

        const likes =
            Number(short.likes || 0);

        const comments =
            Number(short.comments || 0);

        const views =
            Number(short.views || 0);

        const uid =
            getShortUserId(short);

        const isOwner =
            Boolean(
                currentUser &&
                uid &&
                uid === currentUser.uid
            );

        card.innerHTML = `

            <video
                class="shortVideo"
                src="${escapeHTML(videoURL)}"
                ${thumbnail
                    ? `poster="${escapeHTML(thumbnail)}"`
                    : ""
                }
                playsinline
                webkit-playsinline
                loop
                preload="metadata"
            ></video>


            <div class="shortGradient"></div>


            <div class="shortOverlay">


                <!-- LEFT INFO -->

                <div class="shortInfo">


                    <div class="userRow">

                        <button
                            class="shortProfileBtn"
                            type="button"
                            data-profile-id="${escapeHTML(uid)}"
                        >

                            <img
                                class="userAvatar"
                                src="${escapeHTML(profile)}"
                                alt="${escapeHTML(username)}"
                                onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'"
                            >


                            <div class="userDetails">

                                <div class="username">

                                    ${escapeHTML(username)}

                                    ${
                                        short.verified
                                            ? `
                                                <i
                                                    class="fa-solid fa-circle-check verified"
                                                ></i>
                                            `
                                            : ""
                                    }

                                </div>


                                <div class="uploadTime">

                                    ${timeAgo(
                                        short.createdAt
                                    )}

                                </div>

                            </div>

                        </button>


                        ${
                            !isOwner && uid
                                ? `
                                    <button
                                        class="followBtn"
                                        type="button"
                                        data-follow-id="${escapeHTML(uid)}"
                                    >
                                        Follow
                                    </button>
                                `
                                : ""
                        }

                    </div>


                    ${
                        caption
                            ? `
                                <div class="shortCaption">
                                    ${escapeHTML(caption)}
                                </div>
                            `
                            : ""
                    }


                    <div class="musicRow">

                        <i class="fa-solid fa-music"></i>

                        <span>
                            ${escapeHTML(music)}
                        </span>

                    </div>

                </div>


                <!-- RIGHT ACTIONS -->

                <div class="shortActions">


                    <button
                        class="actionBtn likeBtn"
                        type="button"
                        data-short-id="${escapeHTML(short.id)}"
                        aria-label="Like"
                    >

                        <i class="fa-regular fa-heart"></i>

                        <span>
                            ${formatNumber(likes)}
                        </span>

                    </button>


                    <button
                        class="actionBtn commentBtn"
                        type="button"
                        data-short-id="${escapeHTML(short.id)}"
                        aria-label="Comments"
                    >

                        <i class="fa-regular fa-comment"></i>

                        <span>
                            ${formatNumber(comments)}
                        </span>

                    </button>


                    <button
                        class="actionBtn shareBtn"
                        type="button"
                        data-short-id="${escapeHTML(short.id)}"
                        aria-label="Share"
                    >

                        <i class="fa-solid fa-share"></i>

                        <span>Share</span>

                    </button>


                    <button
                        class="actionBtn saveBtn"
                        type="button"
                        data-short-id="${escapeHTML(short.id)}"
                        aria-label="Save"
                    >

                        <i class="fa-regular fa-bookmark"></i>

                        <span>Save</span>

                    </button>


                    <button
                        class="actionBtn moreBtn"
                        type="button"
                        data-short-id="${escapeHTML(short.id)}"
                        aria-label="More"
                    >

                        <i class="fa-solid fa-ellipsis"></i>

                        <span>More</span>

                    </button>


                    <span class="viewCount">

                        <i class="fa-solid fa-eye"></i>

                        ${formatNumber(views)}

                    </span>


                    <div class="profileDisc">

                        <img
                            src="${escapeHTML(profile)}"
                            alt=""
                            onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'"
                        >

                    </div>

                </div>

            </div>
        `;

        return card;
    }


    /* =====================================================
       VIDEO OBSERVER
    ====================================================== */

    function setupVideoObserver() {

        if (viewObserver) {
            viewObserver.disconnect();
        }

        const cards =
            document.querySelectorAll(
                ".shortCard"
            );

        if (!cards.length) return;

        viewObserver =
            new IntersectionObserver(
                entries => {

                    entries.forEach(entry => {

                        const video =
                            entry.target.querySelector(
                                ".shortVideo"
                            );

                        if (!video) return;

                        const id =
                            entry.target.dataset.id;

                        if (
                            entry.isIntersecting &&
                            entry.intersectionRatio >= .7
                        ) {

                            pauseOtherVideos(video);

                            video.play()
                                .catch(() => {});

                            increaseView(id);

                        } else {

                            video.pause();
                        }

                    });

                },
                {
                    threshold: [.2, .7]
                }
            );

        cards.forEach(card => {

            viewObserver.observe(card);

            setupDoubleTap(card);
        });
    }


    /* =====================================================
       PAUSE OTHER VIDEOS
    ====================================================== */

    function pauseOtherVideos(currentVideo) {

        document
            .querySelectorAll(".shortVideo")
            .forEach(video => {

                if (video !== currentVideo) {
                    video.pause();
                }

            });
    }


    /* =====================================================
       DOUBLE TAP LIKE
    ====================================================== */

    function setupDoubleTap(card) {

        const video =
            card.querySelector(".shortVideo");

        if (!video) return;

        let lastTap = 0;

        video.addEventListener(
            "click",
            () => {

                const now = Date.now();

                if (
                    now - lastTap < 320
                ) {

                    const id =
                        card.dataset.id;

                    likeShort(id);

                    showHeart();
                }

                lastTap = now;
            }
        );
    }


    /* =====================================================
       LIKE
    ====================================================== */

    async function likeShort(shortId) {

        if (!currentUser) {

            showToast(
                "Please login first."
            );

            return;
        }

        const uid =
            currentUser.uid;

        const likeRef =
            db.ref(
                `shortLikes/${shortId}/${uid}`
            );

        const likesRef =
            db.ref(
                `shorts/${shortId}/likes`
            );

        try {

            const snapshot =
                await likeRef.once("value");

            if (snapshot.exists()) {

                await likeRef.remove();

                await likesRef.transaction(
                    value =>
                        Math.max(
                            Number(value || 0) - 1,
                            0
                        )
                );

                updateLikeUI(
                    shortId,
                    false
                );

            } else {

                await likeRef.set(true);

                await likesRef.transaction(
                    value =>
                        Number(value || 0) + 1
                );

                updateLikeUI(
                    shortId,
                    true
                );

                showHeart();
            }

        } catch (error) {

            console.error(
                "Like error:",
                error
            );

            showToast(
                "Couldn't update like."
            );
        }
    }


    /* =====================================================
       LIKE UI
    ====================================================== */

    function updateLikeUI(shortId, liked) {

        const card =
            document.querySelector(
                `.shortCard[data-id="${CSS.escape(shortId)}"]`
            );

        if (!card) return;

        const button =
            card.querySelector(".likeBtn");

        if (!button) return;

        const icon =
            button.querySelector("i");

        if (!icon) return;

        if (liked) {

            icon.className =
                "fa-solid fa-heart";

            button.classList.add("liked");

        } else {

            icon.className =
                "fa-regular fa-heart";

            button.classList.remove("liked");
        }
    }


    /* =====================================================
       REFRESH LIKES
    ====================================================== */

    async function refreshAllLikeStates() {

        if (!currentUser) return;

        const buttons =
            document.querySelectorAll(".likeBtn");

        await Promise.all(
            [...buttons].map(
                async button => {

                    const id =
                        button.dataset.shortId;

                    try {

                        const snapshot =
                            await db.ref(
                                `shortLikes/${id}/${currentUser.uid}`
                            ).once("value");

                        updateLikeUI(
                            id,
                            snapshot.exists()
                        );

                    } catch (error) {
                        console.warn(
                            "Like state error:",
                            error
                        );
                    }
                }
            )
        );
    }


    /* =====================================================
       SAVE
    ====================================================== */

    async function saveShort(shortId, button) {

        if (!currentUser) {

            showToast(
                "Please login first."
            );

            return;
        }

        const ref =
            db.ref(
                `savedShorts/${currentUser.uid}/${shortId}`
            );

        try {

            const snapshot =
                await ref.once("value");

            const icon =
                button?.querySelector("i");

            if (snapshot.exists()) {

                await ref.remove();

                button?.classList.remove("saved");

                if (icon) {
                    icon.className =
                        "fa-regular fa-bookmark";
                }

                showToast(
                    "Removed from saved"
                );

            } else {

                await ref.set(
                    firebase.database.ServerValue.TIMESTAMP
                );

                button?.classList.add("saved");

                if (icon) {
                    icon.className =
                        "fa-solid fa-bookmark";
                }

                showToast(
                    "Saved to your collection"
                );
            }

        } catch (error) {

            console.error(
                "Save error:",
                error
            );

            showToast(
                "Couldn't save Short."
            );
        }
    }


    /* =====================================================
       REFRESH SAVES
    ====================================================== */

    async function refreshAllSaveStates() {

        if (!currentUser) return;

        const buttons =
            document.querySelectorAll(".saveBtn");

        await Promise.all(
            [...buttons].map(
                async button => {

                    const id =
                        button.dataset.shortId;

                    try {

                        const snapshot =
                            await db.ref(
                                `savedShorts/${currentUser.uid}/${id}`
                            ).once("value");

                        const icon =
                            button.querySelector("i");

                        if (snapshot.exists()) {

                            button.classList.add(
                                "saved"
                            );

                            if (icon) {
                                icon.className =
                                    "fa-solid fa-bookmark";
                            }

                        }

                    } catch (error) {
                        console.warn(
                            "Save state error:",
                            error
                        );
                    }
                }
            )
        );
    }


    /* =====================================================
       FOLLOW
    ====================================================== */

    async function followUser(uid, button) {

        if (!currentUser) {

            showToast(
                "Please login first."
            );

            return;
        }

        if (
            !uid ||
            uid === currentUser.uid
        ) {
            return;
        }

        button.disabled = true;

        const followingRef =
            db.ref(
                `following/${currentUser.uid}/${uid}`
            );

        const followersRef =
            db.ref(
                `followers/${uid}/${currentUser.uid}`
            );

        try {

            const snapshot =
                await followingRef.once("value");

            if (snapshot.exists()) {

                await Promise.all([
                    followingRef.remove(),
                    followersRef.remove()
                ]);

                button.textContent =
                    "Follow";

                button.classList.remove(
                    "following"
                );

                showToast(
                    "Unfollowed"
                );

            } else {

                await Promise.all([
                    followingRef.set(
                        firebase.database.ServerValue.TIMESTAMP
                    ),
                    followersRef.set(
                        firebase.database.ServerValue.TIMESTAMP
                    )
                ]);

                button.textContent =
                    "Following";

                button.classList.add(
                    "following"
                );

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
                "Couldn't update follow."
            );

        } finally {

            button.disabled = false;
        }
    }


    /* =====================================================
       REFRESH FOLLOW
    ====================================================== */

    async function refreshAllFollowStates() {

        if (!currentUser) return;

        const buttons =
            document.querySelectorAll(".followBtn");

        await Promise.all(
            [...buttons].map(
                async button => {

                    const uid =
                        button.dataset.followId;

                    if (!uid) return;

                    try {

                        const snapshot =
                            await db.ref(
                                `following/${currentUser.uid}/${uid}`
                            ).once("value");

                        if (snapshot.exists()) {

                            button.textContent =
                                "Following";

                            button.classList.add(
                                "following"
                            );

                        } else {

                            button.textContent =
                                "Follow";

                            button.classList.remove(
                                "following"
                            );
                        }

                    } catch (error) {
                        console.warn(
                            "Follow state error:",
                            error
                        );
                    }
                }
            )
        );
    }


    /* =====================================================
       VIEWS
    ====================================================== */

    async function increaseView(shortId) {

        if (!currentUser) return;

        const viewRef =
            db.ref(
                `shortViews/${shortId}/${currentUser.uid}`
            );

        try {

            const snapshot =
                await viewRef.once("value");

            if (snapshot.exists()) return;

            await viewRef.set(
                firebase.database.ServerValue.TIMESTAMP
            );

            await db.ref(
                `shorts/${shortId}/views`
            ).transaction(
                value =>
                    Number(value || 0) + 1
            );

            updateViewUI(shortId);

        } catch (error) {

            console.warn(
                "View update error:",
                error
            );
        }
    }


    function updateViewUI(shortId) {

        const short =
            shorts.find(
                item =>
                    item.id === shortId
            );

        if (!short) return;

        const card =
            document.querySelector(
                `.shortCard[data-id="${CSS.escape(shortId)}"]`
            );

        const view =
            card?.querySelector(".viewCount");

        if (!view) return;

        const newViews =
            Number(short.views || 0) + 1;

        short.views = newViews;

        view.innerHTML = `
            <i class="fa-solid fa-eye"></i>
            ${formatNumber(newViews)}
        `;
    }


    /* =====================================================
       COMMENTS
    ====================================================== */

    async function openComments(shortId) {

        if (!commentsModal) return;

        currentCommentId = shortId;

        commentsModal.classList.remove(
            "hidden"
        );

        commentsModal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "modalOpen"
        );

        const commentsContainer =
            document.getElementById(
                "commentsContainer"
            );

        if (!commentsContainer) return;

        commentsContainer.innerHTML = `
            <div class="modalLoading">
                Loading comments...
            </div>
        `;

        try {

            const snapshot =
                await db.ref(
                    `shortComments/${shortId}`
                )
                .orderByChild("time")
                .once("value");

            commentsContainer.innerHTML = "";

            if (!snapshot.exists()) {

                commentsContainer.innerHTML = `
                    <div class="noComments">
                        <i class="fa-regular fa-comment"></i>
                        <p>No comments yet.</p>
                        <span>Be the first to comment.</span>
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

            comments.reverse();

            comments.forEach(comment => {

                commentsContainer.insertAdjacentHTML(
                    "beforeend",
                    createComment(comment)
                );

            });

        } catch (error) {

            console.error(
                "Comments error:",
                error
            );

            commentsContainer.innerHTML = `
                <div class="noComments">
                    Unable to load comments.
                </div>
            `;
        }
    }


    /* =====================================================
       COMMENT HTML
    ====================================================== */

    function createComment(comment) {

        return `
            <div
                class="commentItem"
                data-comment-id="${escapeHTML(comment.id || "")}"
            >

                <img
                    src="${escapeHTML(
                        comment.profile ||
                        DEFAULT_AVATAR
                    )}"
                    alt=""
                    onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'"
                >

                <div class="commentBody">

                    <strong>
                        ${escapeHTML(
                            comment.username ||
                            "User"
                        )}
                    </strong>

                    <p>
                        ${escapeHTML(
                            comment.text ||
                            ""
                        )}
                    </p>

                    <small>
                        ${timeAgo(
                            comment.time
                        )}
                    </small>

                </div>

            </div>
        `;
    }


    /* =====================================================
       SEND COMMENT
    ====================================================== */

    async function sendComment() {

        if (
            !currentUser ||
            !currentCommentId
        ) {

            showToast(
                "Please login first."
            );

            return;
        }

        const input =
            document.getElementById(
                "commentText"
            );

        if (!input) return;

        const text =
            input.value.trim();

        if (!text) return;

        if (text.length > 500) {

            showToast(
                "Comment is too long."
            );

            return;
        }

        try {

            const ref =
                db.ref(
                    `shortComments/${currentCommentId}`
                ).push();

            await ref.set({

                uid:
                    currentUser.uid,

                username:
                    getCurrentUserName(),

                profile:
                    getCurrentUserAvatar(),

                text:
                    text,

                time:
                    firebase.database.ServerValue.TIMESTAMP
            });

            await db.ref(
                `shorts/${currentCommentId}/comments`
            ).transaction(
                value =>
                    Number(value || 0) + 1
            );

            input.value = "";

            showToast(
                "Comment added"
            );

            updateCommentCountUI(
                currentCommentId
            );

            await openComments(
                currentCommentId
            );

        } catch (error) {

            console.error(
                "Comment error:",
                error
            );

            showToast(
                "Couldn't add comment."
            );
        }
    }


    function updateCommentCountUI(shortId) {

        const card =
            document.querySelector(
                `.shortCard[data-id="${CSS.escape(shortId)}"]`
            );

        const short =
            shorts.find(
                item =>
                    item.id === shortId
            );

        if (!card || !short) return;

        const button =
            card.querySelector(".commentBtn");

        const count =
            button?.querySelector("span");

        if (count) {

            count.textContent =
                formatNumber(
                    Number(short.comments || 0) + 1
                );
        }

        short.comments =
            Number(short.comments || 0) + 1;
    }


    /* =====================================================
       SHARE
    ====================================================== */

    function shareShort(shortId) {

        currentShareId = shortId;

        shareModal?.classList.remove(
            "hidden"
        );

        shareModal?.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "modalOpen"
        );
    }


    function getShareURL() {

        const url =
            new URL(
                "shorts.html",
                window.location.href
            );

        if (currentShareId) {

            url.searchParams.set(
                "id",
                currentShareId
            );
        }

        return url.href;
    }


    async function copyShortLink() {

        const url =
            getShareURL();

        try {

            await navigator.clipboard.writeText(
                url
            );

            showToast(
                "Link copied"
            );

        } catch (error) {

            console.warn(
                "Clipboard error:",
                error
            );

            showToast(
                "Couldn't copy link."
            );
        }
    }


    async function nativeShare() {

        const url =
            getShareURL();

        if (
            navigator.share
        ) {

            try {

                await navigator.share({
                    title: "Viewora Short",
                    text: "Watch this Short on Viewora",
                    url
                });

            } catch {
                // User cancelled.
            }

        } else {

            await copyShortLink();
        }
    }


    /* =====================================================
       CLOSE MODALS
    ====================================================== */

    function closeModal(modal) {

        if (!modal) return;

        modal.classList.add("hidden");

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        if (
            document.querySelectorAll(
                ".modal:not(.hidden)"
            ).length === 0
        ) {

            document.body.classList.remove(
                "modalOpen"
            );
        }
    }


    /* =====================================================
       OWNER MENU
    ====================================================== */

    function openOwnerMenu(shortId) {

        if (!shortMenu) return;

        const short =
            shorts.find(
                item =>
                    item.id === shortId
            );

        if (!short) return;

        const uid =
            getShortUserId(short);

        if (
            !currentUser ||
            uid !== currentUser.uid
        ) {

            openReport(shortId);

            return;
        }

        currentMenuShortId =
            shortId;

        shortMenu.classList.remove(
            "hidden"
        );
    }


    function closeOwnerMenu() {

        currentMenuShortId = null;

        shortMenu?.classList.add(
            "hidden"
        );
    }


    /* =====================================================
       DELETE OWN SHORT
    ====================================================== */

    async function deleteOwnShort() {

        const shortId =
            currentMenuShortId;

        if (
            !shortId ||
            !currentUser
        ) return;

        const short =
            shorts.find(
                item =>
                    item.id === shortId
            );

        if (!short) return;

        if (
            getShortUserId(short) !==
            currentUser.uid
        ) {

            showToast(
                "You can't delete this Short."
            );

            return;
        }

        const confirmed =
            window.confirm(
                "Delete this Short permanently?"
            );

        if (!confirmed) return;

        try {

            await db.ref(
                `shorts/${shortId}`
            ).remove();

            await db.ref(
                `shortComments/${shortId}`
            ).remove();

            await db.ref(
                `shortLikes/${shortId}`
            ).remove();

            await db.ref(
                `shortViews/${shortId}`
            ).remove();

            closeOwnerMenu();

            showToast(
                "Short deleted"
            );

        } catch (error) {

            console.error(
                "Delete error:",
                error
            );

            showToast(
                "Couldn't delete Short."
            );
        }
    }


    /* =====================================================
       HIDE COMMENTS
    ====================================================== */

    async function hideComments() {

        const shortId =
            currentMenuShortId;

        if (!shortId || !currentUser) return;

        const short =
            shorts.find(
                item =>
                    item.id === shortId
            );

        if (!short) return;

        if (
            getShortUserId(short) !==
            currentUser.uid
        ) {

            showToast(
                "Only the owner can change this."
            );

            return;
        }

        try {

            const newValue =
                !Boolean(
                    short.commentsHidden
                );

            await db.ref(
                `shorts/${shortId}/commentsHidden`
            ).set(newValue);

            short.commentsHidden =
                newValue;

            closeOwnerMenu();

            showToast(
                newValue
                    ? "Comments hidden"
                    : "Comments enabled"
            );

        } catch (error) {

            console.error(
                "Hide comments error:",
                error
            );

            showToast(
                "Couldn't update comments."
            );
        }
    }


    /* =====================================================
       HIDE OWN SHORT
    ====================================================== */

    async function hideOwnShort() {

        const shortId =
            currentMenuShortId;

        if (!shortId || !currentUser) return;

        const short =
            shorts.find(
                item =>
                    item.id === shortId
            );

        if (!short) return;

        if (
            getShortUserId(short) !==
            currentUser.uid
        ) {

            showToast(
                "Only the owner can hide this."
            );

            return;
        }

        try {

            const newValue =
                !Boolean(
                    short.hidden
                );

            await db.ref(
                `shorts/${shortId}/hidden`
            ).set(newValue);

            short.hidden =
                newValue;

            closeOwnerMenu();

            showToast(
                newValue
                    ? "Short hidden"
                    : "Short visible"
            );

        } catch (error) {

            console.error(
                "Hide short error:",
                error
            );

            showToast(
                "Couldn't update Short."
            );
        }
    }


    /* =====================================================
       EDIT SHORT
    ====================================================== */

    function editShort() {

        const shortId =
            currentMenuShortId;

        if (!shortId) return;

        closeOwnerMenu();

        window.location.href =
            `short_upload.html?edit=${encodeURIComponent(shortId)}`;
    }


    /* =====================================================
       REPORT
    ====================================================== */

    function openReport(shortId) {

        currentMenuShortId =
            shortId;

        reportModal?.classList.remove(
            "hidden"
        );

        reportModal?.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "modalOpen"
        );
    }


    async function submitReport(type) {

        if (
            !currentUser ||
            !currentMenuShortId
        ) {

            showToast(
                "Please login first."
            );

            return;
        }

        try {

            await db.ref(
                `shortReports/${currentMenuShortId}/${currentUser.uid}`
            ).set({

                type,
                time:
                    firebase.database.ServerValue.TIMESTAMP

            });

            closeModal(reportModal);

            currentMenuShortId = null;

            showToast(
                "Report submitted"
            );

        } catch (error) {

            console.error(
                "Report error:",
                error
            );

            showToast(
                "Couldn't submit report."
            );
        }
    }


    /* =====================================================
       HEART
    ====================================================== */

    function showHeart() {

        if (!heartAnimation) return;

        heartAnimation.classList.remove(
            "hidden"
        );

        heartAnimation.classList.remove(
            "heartPop"
        );

        void heartAnimation.offsetWidth;

        heartAnimation.classList.add(
            "heartPop"
        );

        setTimeout(() => {

            heartAnimation.classList.add(
                "hidden"
            );

        }, 700);
    }


    /* =====================================================
       EMPTY / SKELETON
    ====================================================== */

    function showSkeleton() {
        skeleton?.classList.remove(
            "hidden"
        );
    }

    function hideSkeleton() {
        skeleton?.classList.add(
            "hidden"
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


    /* =====================================================
       EVENT DELEGATION
    ====================================================== */

    document.addEventListener(
        "click",
        event => {

            /* LIKE */

            const like =
                event.target.closest(
                    ".likeBtn"
                );

            if (like) {

                likeShort(
                    like.dataset.shortId
                );

                return;
            }


            /* COMMENT */

            const comment =
                event.target.closest(
                    ".commentBtn"
                );

            if (comment) {

                const short =
                    shorts.find(
                        item =>
                            item.id ===
                            comment.dataset.shortId
                    );

                if (
                    short?.commentsHidden
                ) {

                    showToast(
                        "Comments are disabled."
                    );

                    return;
                }

                openComments(
                    comment.dataset.shortId
                );

                return;
            }


            /* SHARE */

            const share =
                event.target.closest(
                    ".shareBtn"
                );

            if (share) {

                shareShort(
                    share.dataset.shortId
                );

                return;
            }


            /* SAVE */

            const save =
                event.target.closest(
                    ".saveBtn"
                );

            if (save) {

                saveShort(
                    save.dataset.shortId,
                    save
                );

                return;
            }


            /* FOLLOW */

            const follow =
                event.target.closest(
                    ".followBtn"
                );

            if (follow) {

                followUser(
                    follow.dataset.followId,
                    follow
                );

                return;
            }


            /* MORE */

            const more =
                event.target.closest(
                    ".moreBtn"
                );

            if (more) {

                if (
                    shortMenu &&
                    !shortMenu.classList.contains(
                        "hidden"
                    )
                ) {

                    closeOwnerMenu();

                } else {

                    openOwnerMenu(
                        more.dataset.shortId
                    );
                }

                return;
            }


            /* PROFILE */

            const profile =
                event.target.closest(
                    ".shortProfileBtn"
                );

            if (profile) {

                const uid =
                    profile.dataset.profileId;

                if (uid) {

                    window.location.href =
                        `profile.html?uid=${encodeURIComponent(uid)}`;
                }

                return;
            }


            /* SHARE OPTIONS */

            const shareItem =
                event.target.closest(
                    ".shareItem"
                );

            if (shareItem) {

                const id =
                    shareItem.id;

                if (
                    id === "shareWhatsApp"
                ) {

                    const url =
                        getShareURL();

                    window.open(
                        "https://wa.me/?text=" +
                        encodeURIComponent(
                            url
                        ),
                        "_blank"
                    );

                } else if (
                    id === "shareFacebook"
                ) {

                    const url =
                        getShareURL();

                    window.open(
                        "https://www.facebook.com/sharer/sharer.php?u=" +
                        encodeURIComponent(
                            url
                        ),
                        "_blank"
                    );

                } else if (
                    id === "shareX"
                ) {

                    const url =
                        getShareURL();

                    window.open(
                        "https://twitter.com/intent/tweet?url=" +
                        encodeURIComponent(
                            url
                        ),
                        "_blank"
                    );

                } else if (
                    id === "copyShortLink"
                ) {

                    copyShortLink();
                }

                return;
            }


            /* REPORT */

            const report =
                event.target.closest(
                    ".reportBtn"
                );

            if (report) {

                submitReport(
                    report.dataset.report
                );

                return;
            }


            /* OWNER MENU */

            if (
                event.target.closest(
                    "#editShortBtn"
                )
            ) {

                editShort();
                return;
            }


            if (
                event.target.closest(
                    "#hideCommentsBtn"
                )
            ) {

                hideComments();
                return;
            }


            if (
                event.target.closest(
                    "#hideShortBtn"
                )
            ) {

                hideOwnShort();
                return;
            }


            if (
                event.target.closest(
                    "#deleteShortBtn"
                )
            ) {

                deleteOwnShort();
                return;
            }


            /* CLOSE OWNER MENU */

            if (
                shortMenu &&
                !shortMenu.classList.contains(
                    "hidden"
                ) &&
                !event.target.closest(
                    "#shortMenu"
                ) &&
                !event.target.closest(
                    ".moreBtn"
                )
            ) {

                closeOwnerMenu();
            }

        }
    );


    /* =====================================================
       COMMENT SEND
    ====================================================== */

    document
        .getElementById("sendComment")
        ?.addEventListener(
            "click",
            sendComment
        );


    document
        .getElementById("commentText")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendComment();
                }

            }
        );


    /* =====================================================
       CLOSE COMMENTS
    ====================================================== */

    document
        .getElementById("closeComments")
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    commentsModal
                );

                currentCommentId = null;
            }
        );


    document
        .getElementById("commentsOverlay")
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    commentsModal
                );

                currentCommentId = null;
            }
        );


    /* =====================================================
       CLOSE SHARE
    ====================================================== */

    document
        .getElementById("closeShare")
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    shareModal
                );

                currentShareId = null;
            }
        );


    document
        .getElementById("shareOverlay")
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    shareModal
                );

                currentShareId = null;
            }
        );


    /* =====================================================
       CLOSE REPORT
    ====================================================== */

    document
        .getElementById("closeReport")
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    reportModal
                );

                currentMenuShortId = null;
            }
        );


    document
        .getElementById("reportOverlay")
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    reportModal
                );

                currentMenuShortId = null;
            }
        );


    /* =====================================================
       SEARCH
    ====================================================== */

    document
        .getElementById("shortSearchInput")
        ?.addEventListener(
            "input",
            event => {

                const query =
                    event.target.value
                        .trim()
                        .toLowerCase();

                document
                    .querySelectorAll(
                        ".shortCard"
                    )
                    .forEach(card => {

                        const short =
                            shorts.find(
                                item =>
                                    item.id ===
                                    card.dataset.id
                            );

                        if (!short) return;

                        const text = [

                            short.caption,
                            short.username,
                            short.displayName,
                            short.music,
                            short.audioName

                        ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                        card.style.display =
                            !query ||
                            text.includes(query)
                                ? ""
                                : "none";
                    });
            }
        );


    /* =====================================================
       URL OPENED SHORT
    ====================================================== */

    function openShortFromURL() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const id =
            params.get("id");

        if (!id) return;

        setTimeout(() => {

            const card =
                document.querySelector(
                    `.shortCard[data-id="${CSS.escape(id)}"]`
                );

            if (card) {

                card.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }

        }, 700);
    }


    /* =====================================================
       ONLINE / OFFLINE
    ====================================================== */

    window.addEventListener(
        "offline",
        () => {

            showToast(
                "No Internet Connection"
            );
        }
    );


    window.addEventListener(
        "online",
        () => {

            showToast(
                "Back online"
            );
        }
    );


    /* =====================================================
       VISIBILITY
    ====================================================== */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (document.hidden) {

                document
                    .querySelectorAll(
                        ".shortVideo"
                    )
                    .forEach(video => {
                        video.pause();
                    });

            } else {

                const visible =
                    [...document.querySelectorAll(
                        ".shortCard"
                    )]
                    .find(
                        card => {

                            const rect =
                                card.getBoundingClientRect();

                            return (
                                rect.top >= -100 &&
                                rect.top <=
                                    window.innerHeight * .35
                            );
                        }
                    );

                visible
                    ?.querySelector(".shortVideo")
                    ?.play()
                    .catch(() => {});
            }
        }
    );


    /* =====================================================
       AUTH
    ====================================================== */

    auth.onAuthStateChanged(
        user => {

            if (!user) {

                currentUser = null;

                window.location.href =
                    "login.html";

                return;
            }

            currentUser = user;

            loadShorts();

            setTimeout(
                openShortFromURL,
                900
            );
        }
    );


    /* =====================================================
       CLEANUP
    ====================================================== */

    window.addEventListener(
        "beforeunload",
        () => {

            if (shortsListener) {

                db.ref("shorts").off(
                    "value",
                    shortsListener
                );
            }

            if (viewObserver) {
                viewObserver.disconnect();
            }
        }
    );


    /* =====================================================
       READY
    ====================================================== */

    console.log(
        "===================================="
    );

    console.log(
        " VIEWORA SHORTS READY"
    );

    console.log(
        " Firebase ✔"
    );

    console.log(
        " Feed ✔"
    );

    console.log(
        " Autoplay ✔"
    );

    console.log(
        " Likes ✔"
    );

    console.log(
        " Comments ✔"
    );

    console.log(
        " Share ✔"
    );

    console.log(
        " Save ✔"
    );

    console.log(
        " Follow / Unfollow ✔"
    );

    console.log(
        " Views ✔"
    );

    console.log(
        " Owner Menu ✔"
    );

    console.log(
        " Delete / Hide ✔"
    );

    console.log(
        " Report ✔"
    );

    console.log(
        "===================================="
    );

})();