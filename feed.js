/*==========================================================
        VIEWORA V12
        feed.js
        FINAL • PREMIUM FEED SYSTEM

        Firebase:
        • Authentication
        • Realtime Database
        • Likes
        • Comments
        • Saves
        • Views
        • Notifications
        • User Profiles

        Cloudinary:
        • Image URL
        • Video URL
        • Thumbnail URL

==========================================================*/

"use strict";

/*==========================================================
  1. GLOBALS
==========================================================*/

let loggedInUser = null;
let currentUserData = null;

let feedPosts = [];
let feedLoaded = false;

const viewedPosts = new Set();

let activePostId = null;
let commentListener = null;


/*==========================================================
  2. DOM
==========================================================*/

const feedContainer =
    document.getElementById("feedContainer");

const feedSkeleton =
    document.getElementById("feedSkeleton");

const searchInput =
    document.getElementById("searchInput");

const commentModal =
    document.getElementById("commentModal");

const commentsContainer =
    document.getElementById("commentsContainer");

const commentText =
    document.getElementById("commentText");

const closeComment =
    document.getElementById("closeComment");

const sendComment =
    document.getElementById("sendComment");

const notificationCount =
    document.getElementById("notificationCount");

const exploreBtn =
    document.getElementById("exploreBtn");


/*==========================================================
  3. TOAST
==========================================================*/

function feedToast(message, type = "success") {

    const toast =
        document.getElementById("toast");

    const toastText =
        document.getElementById("toastText");

    const toastIcon =
        document.getElementById("toastIcon");

    if (!toast || !toastText)
        return;

    toastText.textContent = message;

    if (toastIcon) {

        if (type === "error") {

            toastIcon.className =
                "fa-solid fa-circle-xmark";

        } else if (type === "warning") {

            toastIcon.className =
                "fa-solid fa-circle-exclamation";

        } else {

            toastIcon.className =
                "fa-solid fa-circle-check";

        }

    }

    toast.classList.remove("hidden");

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    clearTimeout(
        feedToast.timer
    );

    feedToast.timer =
        setTimeout(() => {

            toast.classList.remove("show");

            setTimeout(() => {

                toast.classList.add("hidden");

            }, 250);

        }, 2200);

}


/*==========================================================
  4. LOADING
==========================================================*/

function showFeedLoading() {

    if (feedSkeleton)
        feedSkeleton.classList.remove("hidden");

}


function hideFeedLoading() {

    if (feedSkeleton)
        feedSkeleton.classList.add("hidden");

}


/*==========================================================
  5. AUTHENTICATION
==========================================================*/

auth.onAuthStateChanged(async user => {

    if (!user) {

        location.replace("login.html");

        return;

    }

    loggedInUser = user;

    try {

        const snapshot =
            await userRef(user.uid)
                .once("value");

        currentUserData =
            snapshot.exists()
                ? snapshot.val()
                : {};

        await safeUpdate(
            "users/" + user.uid,
            {
                online: true,
                lastLogin: SERVER_TIME
            }
        );

        userRef(user.uid)
            .child("online")
            .onDisconnect()
            .set(false);

        userRef(user.uid)
            .child("lastSeen")
            .onDisconnect()
            .set(SERVER_TIME);

    } catch (error) {

        console.error(
            "User initialization error:",
            error
        );

    }

    listenNotificationCount();

    loadFeed();

});


/*==========================================================
  6. LOAD FEED
==========================================================*/

function loadFeed(force = false) {

    if (feedLoaded && !force)
        return;

    feedLoaded = true;

    showFeedLoading();

    postsRef()
        .orderByChild("createdAt")
        .limitToLast(50)
        .on(
            "value",
            snapshot => {

                hideFeedLoading();

                feedPosts = [];

                if (!snapshot.exists()) {

                    renderEmptyFeed();

                    return;

                }

                snapshot.forEach(child => {

                    const data =
                        child.val() || {};

                    /*
                        Upload system uses:
                        postId
                        mediaURL
                        mediaType
                        profilePhoto
                    */

                    feedPosts.unshift({

                        id: child.key,

                        ...data

                    });

                });

                renderFeed();

            },

            error => {

                hideFeedLoading();

                console.error(
                    "Feed error:",
                    error
                );

                renderFeedError();

            }
        );

}


/*==========================================================
  7. EMPTY FEED
==========================================================*/

function renderEmptyFeed() {

    if (!feedContainer)
        return;

    feedContainer.innerHTML = `

        <div class="emptyFeed premiumEmpty">

            <div class="emptyIcon">
                <i class="fa-solid fa-images"></i>
            </div>

            <h2>No Posts Yet</h2>

            <p>
                Be the first creator to share
                something on Viewora.
            </p>

            <button
                onclick="location.href='upload.html'">

                <i class="fa-solid fa-plus"></i>

                Create Post

            </button>

        </div>

    `;

}


/*==========================================================
  8. FEED ERROR
==========================================================*/

function renderFeedError() {

    if (!feedContainer)
        return;

    feedContainer.innerHTML = `

        <div class="emptyFeed">

            <div class="emptyIcon">
                ⚠️
            </div>

            <h2>Unable to load feed</h2>

            <p>
                Please check your internet connection.
            </p>

            <button
                onclick="refreshFeed()">

                <i class="fa-solid fa-rotate"></i>

                Try Again

            </button>

        </div>

    `;

}


/*==========================================================
  9. RENDER FEED
==========================================================*/

function renderFeed() {

    if (!feedContainer)
        return;

    feedContainer.innerHTML = "";

    if (!feedPosts.length) {

        renderEmptyFeed();

        return;

    }

    const fragment =
        document.createDocumentFragment();

    feedPosts.forEach(post => {

        fragment.appendChild(
            createPostCard(post)
        );

    });

    feedContainer.appendChild(fragment);

    observeFeedMedia();

}


/*==========================================================
  10. CREATE POST CARD
==========================================================*/

function createPostCard(post) {

    const card =
        document.createElement("article");

    card.className =
        "postCard glass";

    card.dataset.postId =
        post.id;


    /*------------------------------------------
      USER
    ------------------------------------------*/

    const profile =
        post.profilePhoto ||
        post.photo ||
        post.profile ||
        "assets/default-avatar.png";

    const username =
        post.username ||
        "Viewora User";

    const fullName =
        post.fullName ||
        post.name ||
        username;


    /*------------------------------------------
      CONTENT
    ------------------------------------------*/

    const title =
        escapeHTML(
            post.title || ""
        );

    const caption =
        escapeHTML(
            post.caption || ""
        );


    /*------------------------------------------
      STATS
    ------------------------------------------*/

    const likes =
        Number(post.likes || 0);

    const comments =
        Number(post.comments || 0);

    const views =
        Number(post.views || 0);

    const shares =
        Number(post.shares || 0);


    /*------------------------------------------
      MEDIA
    ------------------------------------------*/

    const mediaURL =
        post.mediaURL ||
        post.fileURL ||
        "";

    const thumbnail =
        post.thumbnailURL ||
        "";

    let mediaHTML = "";


    if (post.mediaType === "video" ||
        post.type === "video") {

        mediaHTML = `

            <div class="postMediaWrapper">

                <video

                    class="postMedia"

                    data-id="${post.id}"

                    src="${escapeAttribute(mediaURL)}"

                    ${thumbnail
                        ? `poster="${escapeAttribute(thumbnail)}"`
                        : ""}

                    controls

                    playsinline

                    preload="metadata">

                </video>

            </div>

        `;

    } else if (mediaURL) {

        mediaHTML = `

            <div class="postMediaWrapper">

                <img

                    class="postMedia"

                    data-id="${post.id}"

                    src="${escapeAttribute(mediaURL)}"

                    loading="lazy"

                    alt="${escapeAttribute(title || "Viewora Post")}">

            </div>

        `;

    }


    /*------------------------------------------
      VERIFIED
    ------------------------------------------*/

    const verified =
        post.verified === true
            ? `
                <i
                    class="fa-solid fa-circle-check verified">
                </i>
              `
            : "";


    /*------------------------------------------
      CAPTION
    ------------------------------------------*/

    const captionHTML =
        caption
            ? `
                <div class="postCaption">
                    ${caption}
                </div>
              `
            : "";


    /*------------------------------------------
      CATEGORY
    ------------------------------------------*/

    const categoryHTML =
        post.category
            ? `
                <span class="postCategory">
                    ${escapeHTML(post.category)}
                </span>
              `
            : "";


    /*------------------------------------------
      CARD
    ------------------------------------------*/

    card.innerHTML = `

        <div class="postHeader">

            <div
                class="postUser"
                onclick="openProfile('${escapeAttribute(post.uid || "")}')">

                <img

                    src="${escapeAttribute(profile)}"

                    class="profilePic"

                    loading="lazy"

                    alt="Profile">

                <div class="postUserInfo">

                    <h3>

                        ${escapeHTML(username)}

                        ${verified}

                    </h3>

                    <small>

                        ${escapeHTML(fullName)}

                        • ${timeAgo(post.createdAt)}

                    </small>

                </div>

            </div>

            <button
                class="postMenu"
                onclick="openPostMenu('${post.id}')">

                <i class="fa-solid fa-ellipsis"></i>

            </button>

        </div>


        ${categoryHTML}


        ${
            title
            ? `
                <h2 class="postTitle">
                    ${title}
                </h2>
              `
            : ""
        }


        ${captionHTML}


        ${mediaHTML}


        <div class="postStats">

            <span>

                <i class="fa-solid fa-heart"></i>

                ${formatNumber(likes)}

            </span>

            <span>

                <i class="fa-solid fa-comment"></i>

                ${formatNumber(comments)}

            </span>

            <span>

                <i class="fa-solid fa-eye"></i>

                ${formatNumber(views)}

            </span>

            ${
                shares > 0
                ? `
                    <span>

                        <i class="fa-solid fa-share"></i>

                        ${formatNumber(shares)}

                    </span>
                  `
                : ""
            }

        </div>


        <div class="postActions">

            <button
                class="postAction likeButton"
                data-post="${post.id}"
                onclick="likePost('${post.id}')">

                <i class="fa-regular fa-heart"></i>

                <span>Like</span>

            </button>


            <button
                class="postAction"
                onclick="openComments('${post.id}')">

                <i class="fa-regular fa-comment"></i>

                <span>Comment</span>

            </button>


            <button
                class="postAction"
                onclick="sharePost('${post.id}')">

                <i class="fa-solid fa-share"></i>

                <span>Share</span>

            </button>


            <button
                class="postAction"
                onclick="savePost('${post.id}')">

                <i class="fa-regular fa-bookmark"></i>

                <span>Save</span>

            </button>

        </div>

    `;

    return card;

}


/*==========================================================
  11. HTML SAFETY
==========================================================*/

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function escapeAttribute(value) {

    return escapeHTML(value);

}


/*==========================================================
  12. FORMAT NUMBER
==========================================================*/

function formatNumber(number) {

    number =
        Number(number || 0);

    if (number < 1000)
        return String(number);

    if (number < 1000000)
        return (
            (number / 1000)
                .toFixed(number >= 10000 ? 0 : 1)
            + "K"
        );

    if (number < 1000000000)
        return (
            (number / 1000000)
                .toFixed(number >= 10000000 ? 0 : 1)
            + "M"
        );

    return (
        (number / 1000000000)
            .toFixed(1)
        + "B"
    );

}


/*==========================================================
  13. TIME AGO
==========================================================*/

function timeAgo(timestamp) {

    if (!timestamp)
        return "Just now";

    const seconds =
        Math.floor(
            (Date.now() - Number(timestamp)) / 1000
        );

    if (seconds < 60)
        return "Just now";

    if (seconds < 3600)
        return (
            Math.floor(seconds / 60)
            + " min ago"
        );

    if (seconds < 86400)
        return (
            Math.floor(seconds / 3600)
            + " hr ago"
        );

    if (seconds < 604800)
        return (
            Math.floor(seconds / 86400)
            + " days ago"
        );

    return new Date(
        timestamp
    ).toLocaleDateString();

}


/*==========================================================
  14. LIKE SYSTEM
==========================================================*/

window.likePost =
async function(postId) {

    if (!loggedInUser) {

        feedToast(
            "Please login first",
            "warning"
        );

        return;

    }

    try {

        const likeRef =
            likesRef(postId)
                .child(loggedInUser.uid);

        const postDatabaseRef =
            postRef(postId);

        const postSnapshot =
            await postDatabaseRef
                .once("value");

        if (!postSnapshot.exists())
            return;

        const post =
            postSnapshot.val();

        const alreadyLiked =
            await likeRef
                .once("value");

        let currentLikes =
            Number(post.likes || 0);


        if (alreadyLiked.exists()) {

            await likeRef.remove();

            currentLikes =
                Math.max(
                    0,
                    currentLikes - 1
                );

            await postDatabaseRef.update({

                likes: currentLikes

            });

            feedToast("Like removed");

        } else {

            await likeRef.set({

                uid: loggedInUser.uid,

                createdAt:
                    SERVER_TIME

            });

            currentLikes++;

            await postDatabaseRef.update({

                likes: currentLikes

            });


            /* Notification */

            if (
                post.uid &&
                post.uid !== loggedInUser.uid
            ) {

                await notificationsRef(post.uid)
                    .push({

                        type: "like",

                        from:
                            loggedInUser.uid,

                        postId,

                        read: false,

                        createdAt:
                            SERVER_TIME

                    });

            }

            feedToast("❤️ Liked");

        }

        updatePostStats(
            postId,
            "likes",
            currentLikes
        );

    } catch (error) {

        console.error(
            "Like error:",
            error
        );

        feedToast(
            "Unable to like post",
            "error"
        );

    }

};


/*==========================================================
  15. SAVE POST
==========================================================*/

window.savePost =
async function(postId) {

    if (!loggedInUser)
        return;

    try {

        const ref =
            savedPostsRef(
                loggedInUser.uid
            ).child(postId);

        const snapshot =
            await ref.once("value");

        if (snapshot.exists()) {

            await ref.remove();

            feedToast("🔖 Removed from saved");

        } else {

            await ref.set({

                postId,

                savedAt:
                    SERVER_TIME

            });

            feedToast("🔖 Post Saved");

        }

    } catch (error) {

        console.error(
            "Save error:",
            error
        );

        feedToast(
            "Unable to save post",
            "error"
        );

    }

};


/*==========================================================
  16. SHARE POST
==========================================================*/

window.sharePost =
async function(postId) {

    const url =
        new URL(
            "post.html",
            location.href
        );

    url.searchParams.set(
        "id",
        postId
    );


    try {

        if (
            navigator.share
        ) {

            await navigator.share({

                title:
                    "Viewora Post",

                text:
                    "Check out this post on Viewora",

                url:
                    url.href

            });

        } else {

            await navigator.clipboard
                .writeText(url.href);

            feedToast(
                "🔗 Link Copied"
            );

        }


        /* Share Counter */

        const ref =
            postRef(postId)
                .child("shares");

        const snapshot =
            await ref.once("value");

        await ref.set(
            Number(snapshot.val() || 0) + 1
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

};


/*==========================================================
  17. VIEW COUNTER
==========================================================*/

async function addPostView(postId) {

    if (!postId)
        return;

    if (
        viewedPosts.has(postId)
    )
        return;

    viewedPosts.add(postId);

    try {

        const ref =
            postRef(postId)
                .child("views");

        const snapshot =
            await ref.once("value");

        const views =
            Number(snapshot.val() || 0);

        await ref.set(
            views + 1
        );

        updatePostStats(
            postId,
            "views",
            views + 1
        );

    } catch (error) {

        console.error(
            "View error:",
            error
        );

    }

}


/*==========================================================
  18. INTERSECTION OBSERVER
==========================================================*/

let feedObserver = null;


function createFeedObserver() {

    if (
        !("IntersectionObserver" in window)
    )
        return null;

    return new IntersectionObserver(

        entries => {

            entries.forEach(entry => {

                if (!entry.isIntersecting)
                    return;

                const media =
                    entry.target;

                const postId =
                    media.dataset.id;

                if (postId) {

                    addPostView(
                        postId
                    );

                }


                /* Video autoplay */

                if (
                    media.tagName ===
                    "VIDEO"
                ) {

                    media
                        .play()
                        .catch(() => {});

                }

            });

        },

        {
            threshold: 0.65
        }

    );

}


feedObserver =
    createFeedObserver();


function observeFeedMedia() {

    if (!feedObserver)
        return;

    document
        .querySelectorAll(
            ".postMedia"
        )
        .forEach(media => {

            feedObserver.observe(
                media
            );

        });

}


/*==========================================================
  19. PAUSE VIDEO WHEN OUT OF VIEW
==========================================================*/

if ("IntersectionObserver" in window) {

    const videoObserver =
        new IntersectionObserver(

            entries => {

                entries.forEach(entry => {

                    const video =
                        entry.target;

                    if (
                        video.tagName !==
                        "VIDEO"
                    )
                        return;

                    if (
                        entry.isIntersecting
                    ) {

                        video
                            .play()
                            .catch(() => {});

                    } else {

                        video.pause();

                    }

                });

            },

            {
                threshold: 0.5
            }

        );


    document.addEventListener(
        "DOMContentLoaded",
        () => {

            document
                .querySelectorAll(
                    "video.postMedia"
                )
                .forEach(video => {

                    videoObserver
                        .observe(video);

                });

        }
    );

}


/*==========================================================
  20. UPDATE POST STATS UI
==========================================================*/

function updatePostStats(
    postId,
    field,
    value
) {

    const card =
        document.querySelector(
            `[data-post-id="${CSS.escape(postId)}"]`
        );

    if (!card)
        return;

    const stats =
        card.querySelectorAll(
            ".postStats span"
        );

    if (!stats.length)
        return;


    if (field === "likes") {

        const icon =
            stats[0]
                ?.querySelector("i");

        if (icon) {

            stats[0].lastChild.textContent =
                " " + formatNumber(value);

        }

    }


    if (field === "comments") {

        if (stats[1]) {

            stats[1].lastChild.textContent =
                " " + formatNumber(value);

        }

    }


    if (field === "views") {

        if (stats[2]) {

            stats[2].lastChild.textContent =
                " " + formatNumber(value);

        }

    }

}


/*==========================================================
  21. COMMENTS
==========================================================*/

window.openComments =
async function(postId) {

    if (!commentModal ||
        !commentsContainer)
        return;

    activePostId =
        postId;


    commentModal
        .classList
        .remove("hidden");


    commentsContainer.innerHTML = `

        <div class="commentLoading">

            <i class="fa-solid fa-spinner fa-spin"></i>

            Loading comments...

        </div>

    `;


    if (commentListener) {

        commentsRef(activePostId)
            .off(
                "value",
                commentListener
            );

    }


    commentListener =
        snapshot => {

            commentsContainer
                .innerHTML = "";


            if (!snapshot.exists()) {

                commentsContainer.innerHTML = `

                    <div class="emptyComments">

                        <i class="fa-regular fa-comment"></i>

                        <p>No comments yet.</p>

                        <small>
                            Be the first to comment.
                        </small>

                    </div>

                `;

                return;

            }


            snapshot.forEach(child => {

                const comment =
                    child.val() || {};

                const commentElement =
                    createCommentElement(
                        comment
                    );

                commentsContainer
                    .appendChild(
                        commentElement
                    );

            });

            commentsContainer.scrollTop =
                commentsContainer.scrollHeight;

        };


    commentsRef(postId)
        .orderByChild("createdAt")
        .on(
            "value",
            commentListener
        );

};


function createCommentElement(comment) {

    const element =
        document.createElement("div");

    element.className =
        "commentCard";


    const photo =
        comment.photo ||
        comment.profilePhoto ||
        "assets/default-avatar.png";


    element.innerHTML = `

        <img

            src="${escapeAttribute(photo)}"

            class="commentAvatar"

            loading="lazy">

        <div class="commentContent">

            <b>
                ${escapeHTML(
                    comment.username ||
                    "User"
                )}
            </b>

            <p>
                ${escapeHTML(
                    comment.text ||
                    ""
                )}
            </p>

            <small>
                ${timeAgo(
                    comment.createdAt
                )}
            </small>

        </div>

    `;

    return element;

}


/*==========================================================
  22. CLOSE COMMENTS
==========================================================*/

if (closeComment) {

    closeComment.addEventListener(
        "click",
        closeComments
    );

}


function closeComments() {

    if (!commentModal)
        return;

    commentModal
        .classList
        .add("hidden");


    if (
        commentListener &&
        activePostId
    ) {

        commentsRef(activePostId)
            .off(
                "value",
                commentListener
            );

    }

    activePostId = null;

}


/*==========================================================
  23. SEND COMMENT
==========================================================*/

if (sendComment) {

    sendComment.addEventListener(
        "click",
        submitComment
    );

}


if (commentText) {

    commentText.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                submitComment();

            }

        }
    );

}


async function submitComment() {

    if (!loggedInUser)
        return;

    if (!activePostId)
        return;


    const text =
        commentText
            ?.value
            ?.trim();


    if (!text)
        return;


    if (text.length > 1000) {

        feedToast(
            "Comment is too long",
            "warning"
        );

        return;

    }


    try {

        const commentRef =
            commentsRef(
                activePostId
            ).push();


        const commentId =
            commentRef.key;


        await commentRef.set({

            id:
                commentId,

            uid:
                loggedInUser.uid,

            username:
                currentUserData?.username ||
                loggedInUser.displayName ||
                "User",

            photo:
                currentUserData?.profilePhoto ||
                loggedInUser.photoURL ||
                "assets/default-avatar.png",

            text,

            createdAt:
                SERVER_TIME

        });


        /* Update comment count */

        const countRef =
            postRef(activePostId)
                .child("comments");


        const countSnapshot =
            await countRef.once("value");


        const newCount =
            Number(
                countSnapshot.val() || 0
            ) + 1;


        await countRef.set(
            newCount
        );


        /* Notification */

        const postSnapshot =
            await postRef(activePostId)
                .once("value");


        if (postSnapshot.exists()) {

            const post =
                postSnapshot.val();


            if (
                post.uid &&
                post.uid !==
                loggedInUser.uid
            ) {

                await notificationsRef(
                    post.uid
                ).push({

                    type:
                        "comment",

                    from:
                        loggedInUser.uid,

                    postId:
                        activePostId,

                    read:
                        false,

                    createdAt:
                        SERVER_TIME

                });

            }

        }


        commentText.value = "";

        updatePostStats(
            activePostId,
            "comments",
            newCount
        );

        feedToast(
            "💬 Comment Added"
        );

    } catch (error) {

        console.error(
            "Comment error:",
            error
        );

        feedToast(
            "Unable to add comment",
            "error"
        );

    }

}


/*==========================================================
  24. PROFILE
==========================================================*/

window.openProfile =
function(uid) {

    if (!uid)
        return;

    location.href =
        "profile.html?uid=" +
        encodeURIComponent(uid);

};


/*==========================================================
  25. POST MENU
==========================================================*/

window.openPostMenu =
function(postId) {

    const post =
        feedPosts.find(
            item =>
                item.id === postId
        );

    if (!post)
        return;


    if (
        loggedInUser &&
        post.uid ===
        loggedInUser.uid
    ) {

        const action =
            confirm(
                "Edit this post?\n\nOK = Edit\nCancel = Delete"
            );


        if (action) {

            editPost(postId);

        } else {

            deletePost(postId);

        }

    } else {

        feedToast(
            "Post options coming soon",
            "info"
        );

    }

};


/*==========================================================
  26. EDIT POST
==========================================================*/

window.editPost =
async function(postId) {

    const post =
        feedPosts.find(
            item =>
                item.id === postId
        );


    if (!post)
        return;


    if (
        post.uid !==
        loggedInUser?.uid
    ) {

        feedToast(
            "You cannot edit this post",
            "error"
        );

        return;

    }


    const newTitle =
        prompt(
            "Edit post title:",
            post.title || ""
        );


    if (newTitle === null)
        return;


    try {

        await postRef(postId)
            .update({

                title:
                    newTitle.trim(),

                updatedAt:
                    SERVER_TIME

            });


        feedToast(
            "✏️ Post Updated"
        );

    } catch (error) {

        console.error(error);

        feedToast(
            "Update failed",
            "error"
        );

    }

};


/*==========================================================
  27. DELETE POST
==========================================================*/

window.deletePost =
async function(postId) {

    const post =
        feedPosts.find(
            item =>
                item.id === postId
        );


    if (!post)
        return;


    if (
        post.uid !==
        loggedInUser?.uid
    ) {

        feedToast(
            "You cannot delete this post",
            "error"
        );

        return;

    }


    if (
        !confirm(
            "Are you sure you want to delete this post?"
        )
    )
        return;


    try {

        /*
          Firebase metadata is removed.

          Cloudinary file is NOT deleted here
          because Cloudinary deletion requires
          a secure server-side API.
        */

        await postRef(
            postId
        ).remove();


        await safeRemove(
            "userPosts/" +
            loggedInUser.uid +
            "/" +
            postId
        );


        await safeRemove(
            "feeds/home/" +
            postId
        );


        await safeRemove(
            "feeds/shorts/" +
            postId
        );


        await safeRemove(
            "feeds/trending/" +
            postId
        );


        feedToast(
            "🗑 Post Deleted"
        );

    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        feedToast(
            "Delete failed",
            "error"
        );

    }

};


/*==========================================================
  28. NOTIFICATION COUNT
==========================================================*/

function listenNotificationCount() {

    if (
        !loggedInUser ||
        !notificationCount
    )
        return;


    notificationsRef(
        loggedInUser.uid
    ).on(
        "value",
        snapshot => {

            let unread = 0;


            snapshot.forEach(child => {

                const data =
                    child.val() || {};

                if (
                    data.read === false ||
                    data.seen === false
                ) {

                    unread++;

                }

            });


            if (unread > 0) {

                notificationCount
                    .style
                    .display = "flex";

                notificationCount
                    .textContent =
                    unread > 99
                        ? "99+"
                        : unread;

            } else {

                notificationCount
                    .style
                    .display = "none";

            }

        }
    );

}


/*==========================================================
  29. SEARCH
==========================================================*/

if (searchInput) {

    searchInput.addEventListener(
        "input",
        event => {

            const query =
                event.target.value
                    .trim()
                    .toLowerCase();


            document
                .querySelectorAll(
                    ".postCard"
                )
                .forEach(card => {

                    const text =
                        card.innerText
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


/*==========================================================
  30. EXPLORE
==========================================================*/

if (exploreBtn) {

    exploreBtn.addEventListener(
        "click",
        () => {

            location.href =
                "explore.html";

        }
    );

}


/*==========================================================
  31. REFRESH
==========================================================*/

window.refreshFeed =
function() {

    feedLoaded = false;

    loadFeed(true);

    feedToast(
        "🔄 Feed Refreshed"
    );

};


/*==========================================================
  32. PULL TO REFRESH
==========================================================*/

let touchStartY = 0;


window.addEventListener(
    "touchstart",
    event => {

        if (
            window.scrollY === 0 &&
            event.touches.length
        ) {

            touchStartY =
                event.touches[0].clientY;

        }

    },
    {
        passive: true
    }
);


window.addEventListener(
    "touchend",
    event => {

        if (!touchStartY)
            return;


        const endY =
            event.changedTouches[0]
                .clientY;


        const distance =
            endY - touchStartY;


        touchStartY = 0;


        if (
            distance > 130 &&
            window.scrollY === 0
        ) {

            refreshFeed();

        }

    },
    {
        passive: true
    }
);


/*==========================================================
  33. SCROLL TO TOP
==========================================================*/

const scrollTopBtn =
    document.getElementById(
        "scrollTopBtn"
    );


if (scrollTopBtn) {

    window.addEventListener(
        "scroll",
        () => {

            scrollTopBtn.style.display =
                window.scrollY > 500
                    ? "flex"
                    : "none";

        }
    );


    scrollTopBtn.addEventListener(
        "click",
        () => {

            window.scrollTo({

                top: 0,

                behavior: "smooth"

            });

        }
    );

}


/*==========================================================
  34. NETWORK STATUS
==========================================================*/

window.addEventListener(
    "offline",
    () => {

        feedToast(
            "📡 No Internet Connection",
            "warning"
        );

    }
);


window.addEventListener(
    "online",
    () => {

        feedToast(
            "🟢 Internet Connected"
        );

    }
);


/*==========================================================
  35. CLEANUP
==========================================================*/

window.addEventListener(
    "beforeunload",
    () => {

        if (loggedInUser) {

            userRef(
                loggedInUser.uid
            )
            .update({

                online: false,

                lastSeen:
                    SERVER_TIME

            });

        }

    }
);


/*==========================================================
  36. STARTUP
==========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "=========================================="
        );

        console.log(
            "🚀 VIEWORA V12 FEED"
        );

        console.log(
            "✅ Firebase Connected"
        );

        console.log(
            "✅ Realtime Feed Ready"
        );

        console.log(
            "✅ Like System Ready"
        );

        console.log(
            "✅ Comment System Ready"
        );

        console.log(
            "✅ Save System Ready"
        );

        console.log(
            "✅ Share System Ready"
        );

        console.log(
            "✅ View Counter Ready"
        );

        console.log(
            "✅ Premium Video Autoplay Ready"
        );

        console.log(
            "=========================================="
        );

    }
);


/*==========================================================
  END
==========================================================*/