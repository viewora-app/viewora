/* =========================================================
   VIEWORA • PREMIUM PROFILE.JS
   V12 CLEAN PRODUCTION VERSION

   Uses:
   • firebase.js
   • Firebase Auth
   • Firebase Realtime Database
   • stories.js
   • Cloudinary through stories.js

   IMPORTANT:
   firebase.js MUST load before this file.
========================================================= */

"use strict";

/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let profileUserId = null;
let profileData = {};

let database = null;
let firebaseAuth = null;

let profilePosts = [];
let profileShorts = [];
let profileVideos = [];
let profileStories = [];

/* =========================================================
   DEFAULTS
========================================================= */

const DEFAULT_AVATAR =
    "assets/default-avatar.png";

const DEFAULT_BANNER =
    "assets/default-banner.jpg";

/* =========================================================
   DOM HELPER
========================================================= */

const $ = id =>
    document.getElementById(id);

/* =========================================================
   DOM
========================================================= */

const pageLoader =
    $("pageLoader");

const app =
    $("app");

const coverPhoto =
    $("coverPhoto");

const profilePic =
    $("profilePic");

const profileName =
    $("profileName");

const profileUsername =
    $("profileUsername");

const profileBio =
    $("profileBio");

const profileLocation =
    $("profileLocation");

const joinDate =
    $("joinDate");

const verifiedBadge =
    $("verifiedBadge");

const postsCount =
    $("postsCount");

const followersCount =
    $("followersCount");

const followingCount =
    $("followingCount");

const videosCount =
    $("videosCount");

const followBtn =
    $("followBtn");

const editProfileBtn =
    $("editProfileBtn");

const messageBtn =
    $("messageBtn");

const postsList =
    $("postsList");

const shortsList =
    $("shortsList");

const videosList =
    $("videosList");

const savedList =
    $("savedList");

const storyFile =
    $("storyFile");

const storiesWrapper =
    $("storiesWrapper");

const storyRing =
    $("storyRing");

const shareBtn =
    document.querySelector(".shareBtn");

const scrollTopBtn =
    $("scrollTopBtn");

/* =========================================================
   FIREBASE
========================================================= */

function getFirebaseServices() {

    if (
        typeof firebase ===
        "undefined"
    ) {

        console.error(
            "❌ Firebase SDK is missing."
        );

        return false;
    }

    /*
     * firebase.js exports:
     *
     * window.auth
     * window.db
     */

    if (
        !window.auth ||
        !window.db
    ) {

        console.error(
            "❌ Viewora Firebase is not ready. Load firebase.js before profile.js."
        );

        return false;
    }

    firebaseAuth =
        window.auth;

    database =
        window.db;

    console.log(
        "✅ VIEWORA PROFILE: Firebase connected"
    );

    return true;
}

/* =========================================================
   AUTH
========================================================= */

function startProfile() {

    if (
        !getFirebaseServices()
    ) {

        showLoader(false);

        return;
    }

    firebaseAuth.onAuthStateChanged(
        async user => {

            if (!user) {

                currentUser =
                    null;

                console.warn(
                    "👤 No authenticated user."
                );

                showLoader(false);

                /*
                 * Do not automatically redirect.
                 * This prevents profile.js from fighting
                 * with your login system.
                 */

                return;
            }

            currentUser =
                user;

            const params =
                new URLSearchParams(
                    window.location.search
                );

            /*
             * profile.html
             *
             * Own profile:
             * profile.html
             *
             * Other profile:
             * profile.html?uid=OTHER_UID
             */

            profileUserId =
                params.get("uid") ||
                user.uid;

            await loadProfile();
        }
    );
}

/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfile() {

    if (
        !currentUser ||
        !profileUserId ||
        !database
    ) {

        return;
    }

    try {

        showLoader(true);

        const snapshot =
            await database
                .ref(
                    `users/${profileUserId}`
                )
                .once("value");

        profileData =
            snapshot.exists()
                ? snapshot.val() || {}
                : {};

        renderProfile();

        await Promise.all([
            loadPosts(),
            loadShorts(),
            loadVideos(),
            loadSavedPosts(),
            loadStories()
        ]);

        await loadStats();

        updateProfileButtons();

        showLoader(false);

        animateProfile();

    } catch (error) {

        console.error(
            "❌ Profile loading error:",
            error
        );

        showLoader(false);

        showToast(
            "Unable to load profile."
        );
    }
}

/* =========================================================
   RENDER PROFILE
========================================================= */

function renderProfile() {

    if (!profileData)
        profileData = {};

    const name =
        profileData.name ||
        profileData.fullName ||
        profileData.displayName ||
        currentUser?.displayName ||
        "Viewora User";

    const username =
        profileData.username ||
        profileData.handle ||
        "user";

    const bio =
        profileData.bio ||
        "Welcome to Viewora 🚀";

    const avatar =
        profileData.profilePhoto ||
        profileData.photoURL ||
        profileData.avatar ||
        profileData.profilePic ||
        currentUser?.photoURL ||
        DEFAULT_AVATAR;

    const cover =
        profileData.coverPhoto ||
        profileData.cover ||
        DEFAULT_BANNER;

    /* -------------------------------------------------------
       NAME
    ------------------------------------------------------- */

    if (profileName) {

        profileName.textContent =
            name;

        if (
            profileData.verified === true ||
            profileData.isVerified === true
        ) {

            if (verifiedBadge) {

                verifiedBadge.classList.remove(
                    "hidden"
                );

                profileName.appendChild(
                    verifiedBadge
                );
            }

        } else {

            verifiedBadge?.classList.add(
                "hidden"
            );
        }
    }

    /* -------------------------------------------------------
       USERNAME
    ------------------------------------------------------- */

    if (profileUsername) {

        profileUsername.textContent =
            "@" +
            String(username)
                .replace(/^@/, "");
    }

    /* -------------------------------------------------------
       BIO
    ------------------------------------------------------- */

    if (profileBio) {

        profileBio.textContent =
            bio;
    }

    /* -------------------------------------------------------
       AVATAR
    ------------------------------------------------------- */

    if (profilePic) {

        profilePic.src =
            avatar;

        profilePic.onerror =
            () => {

                profilePic.src =
                    DEFAULT_AVATAR;
            };
    }

    /* -------------------------------------------------------
       COVER
    ------------------------------------------------------- */

    if (coverPhoto) {

        coverPhoto.src =
            cover;

        coverPhoto.onerror =
            () => {

                coverPhoto.src =
                    DEFAULT_BANNER;
            };
    }

    /* -------------------------------------------------------
       LOCATION
    ------------------------------------------------------- */

    const location =
        profileData.location ||
        profileData.city ||
        profileData.country;

    if (profileLocation) {

        if (location) {

            profileLocation.innerHTML =
                `
                <i class="fa-solid fa-location-dot"></i>
                ${escapeHTML(location)}
                `;

        } else {

            profileLocation.innerHTML =
                `
                <i class="fa-solid fa-location-dot"></i>
                India
                `;
        }
    }

    /* -------------------------------------------------------
       JOIN DATE
    ------------------------------------------------------- */

    const createdAt =
        profileData.createdAt ||
        profileData.joinedAt ||
        profileData.timestamp;

    if (
        joinDate &&
        createdAt
    ) {

        const date =
            new Date(
                Number(createdAt)
            );

        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            joinDate.innerHTML =
                `
                <i class="fa-solid fa-calendar"></i>
                Joined ${date.getFullYear()}
                `;
        }
    }
}

/* =========================================================
   STATS
========================================================= */

async function loadStats() {

    if (!database)
        return;

    try {

        /*
         * Followers
         *
         * users/UID/followers/FOLLOWER_UID
         */

        const userSnapshot =
            await database
                .ref(
                    `users/${profileUserId}`
                )
                .once("value");

        const user =
            userSnapshot.val() || {};

        const followers =
            countObject(
                user.followers
            );

        const following =
            countObject(
                user.following
            );

        /*
         * Support both:
         *
         * followersCount
         * actual followers object
         */

        const followerTotal =
            Number(
                user.followersCount
            ) ||
            followers;

        const followingTotal =
            Number(
                user.followingCount
            ) ||
            following;

        if (followersCount) {

            followersCount.textContent =
                formatNumber(
                    followerTotal
                );
        }

        if (followingCount) {

            followingCount.textContent =
                formatNumber(
                    followingTotal
                );
        }

        /* ---------------------------------------------------
           POST + VIDEO COUNT
        --------------------------------------------------- */

        const snapshot =
            await database
                .ref("posts")
                .once("value");

        let posts =
            0;

        let videos =
            0;

        snapshot.forEach(
            child => {

                const post =
                    child.val();

                if (!post)
                    return;

                const owner =
                    post.uid ||
                    post.userId ||
                    post.authorId;

                if (
                    owner !==
                    profileUserId
                ) {

                    return;
                }

                const type =
                    String(
                        post.type ||
                        post.mediaType ||
                        ""
                    ).toLowerCase();

                const isVideo =
                    type.includes("video") ||
                    !!post.videoURL ||
                    !!post.videoUrl ||
                    !!post.video;

                if (isVideo) {

                    videos++;

                } else {

                    posts++;
                }
            }
        );

        if (postsCount) {

            postsCount.textContent =
                formatNumber(posts);
        }

        if (videosCount) {

            videosCount.textContent =
                formatNumber(videos);
        }

    } catch (error) {

        console.error(
            "❌ Stats error:",
            error
        );
    }
}

/* =========================================================
   POSTS
========================================================= */

async function loadPosts() {

    if (
        !postsList ||
        !database
    )
        return;

    postsList.innerHTML =
        loadingHTML();

    try {

        const snapshot =
            await database
                .ref("posts")
                .once("value");

        profilePosts = [];

        snapshot.forEach(
            child => {

                const post =
                    child.val();

                if (!post)
                    return;

                const owner =
                    post.uid ||
                    post.userId ||
                    post.authorId;

                if (
                    owner !==
                    profileUserId
                )
                    return;

                const type =
                    String(
                        post.type ||
                        post.mediaType ||
                        ""
                    ).toLowerCase();

                const isVideo =
                    type.includes("video") ||
                    !!post.videoURL ||
                    !!post.videoUrl ||
                    !!post.video;

                if (isVideo)
                    return;

                profilePosts.push({
                    id:
                        child.key,
                    ...post
                });
            }
        );

        sortByNewest(
            profilePosts
        );

        if (
            !profilePosts.length
        ) {

            postsList.innerHTML =
                emptyHTML(
                    "fa-images",
                    "No posts yet"
                );

            return;
        }

        postsList.innerHTML =
            profilePosts
                .map(postCard)
                .join("");

    } catch (error) {

        console.error(
            "❌ Posts error:",
            error
        );

        postsList.innerHTML =
            emptyHTML(
                "fa-triangle-exclamation",
                "Unable to load posts"
            );
    }
}

/* =========================================================
   SHORTS
========================================================= */

async function loadShorts() {

    if (
        !shortsList ||
        !database
    )
        return;

    shortsList.innerHTML =
        loadingHTML();

    try {

        const snapshot =
            await database
                .ref("shorts")
                .once("value");

        profileShorts = [];

        snapshot.forEach(
            child => {

                const short =
                    child.val();

                if (!short)
                    return;

                const owner =
                    short.uid ||
                    short.userId ||
                    short.authorId;

                if (
                    owner !==
                    profileUserId
                )
                    return;

                profileShorts.push({
                    id:
                        child.key,
                    ...short
                });
            }
        );

        sortByNewest(
            profileShorts
        );

        if (
            !profileShorts.length
        ) {

            shortsList.innerHTML =
                emptyHTML(
                    "fa-play",
                    "No shorts yet"
                );

            return;
        }

        shortsList.innerHTML =
            profileShorts
                .map(shortCard)
                .join("");

    } catch (error) {

        console.error(
            "❌ Shorts error:",
            error
        );

        shortsList.innerHTML =
            emptyHTML(
                "fa-play",
                "Unable to load shorts"
            );
    }
}

/* =========================================================
   VIDEOS
========================================================= */

async function loadVideos() {

    if (
        !videosList ||
        !database
    )
        return;

    videosList.innerHTML =
        loadingHTML();

    try {

        const snapshot =
            await database
                .ref("posts")
                .once("value");

        profileVideos = [];

        snapshot.forEach(
            child => {

                const post =
                    child.val();

                if (!post)
                    return;

                const owner =
                    post.uid ||
                    post.userId ||
                    post.authorId;

                if (
                    owner !==
                    profileUserId
                )
                    return;

                const type =
                    String(
                        post.type ||
                        post.mediaType ||
                        ""
                    ).toLowerCase();

                const isVideo =
                    type.includes("video") ||
                    !!post.videoURL ||
                    !!post.videoUrl ||
                    !!post.video;

                if (!isVideo)
                    return;

                profileVideos.push({
                    id:
                        child.key,
                    ...post
                });
            }
        );

        sortByNewest(
            profileVideos
        );

        if (
            !profileVideos.length
        ) {

            videosList.innerHTML =
                emptyHTML(
                    "fa-video",
                    "No videos yet"
                );

            return;
        }

        videosList.innerHTML =
            profileVideos
                .map(videoCard)
                .join("");

    } catch (error) {

        console.error(
            "❌ Videos error:",
            error
        );

        videosList.innerHTML =
            emptyHTML(
                "fa-video",
                "Unable to load videos"
            );
    }
}

/* =========================================================
   SAVED POSTS
========================================================= */

async function loadSavedPosts() {

    if (
        !savedList ||
        !database
    )
        return;

    savedList.innerHTML =
        loadingHTML();

    /*
     * Saved posts are PRIVATE.
     */

    if (
        !currentUser ||
        profileUserId !==
        currentUser.uid
    ) {

        savedList.innerHTML =
            emptyHTML(
                "fa-lock",
                "Saved posts are private"
            );

        return;
    }

    try {

        /*
         * Support:
         *
         * users/UID/saved/POST_ID
         *
         * and:
         *
         * savedPosts/UID/POST_ID
         */

        let snapshot =
            await database
                .ref(
                    `users/${profileUserId}/saved`
                )
                .once("value");

        let saved =
            snapshot.val() || {};

        if (
            !Object.keys(saved).length
        ) {

            snapshot =
                await database
                    .ref(
                        `savedPosts/${profileUserId}`
                    )
                    .once("value");

            saved =
                snapshot.val() || {};
        }

        const ids =
            Object.keys(saved);

        if (!ids.length) {

            savedList.innerHTML =
                emptyHTML(
                    "fa-bookmark",
                    "No saved posts"
                );

            return;
        }

        const cards = [];

        for (
            const id of ids
        ) {

            const postSnapshot =
                await database
                    .ref(
                        `posts/${id}`
                    )
                    .once("value");

            if (
                !postSnapshot.exists()
            )
                continue;

            cards.push({
                id,
                ...(
                    postSnapshot.val() ||
                    {}
                )
            });
        }

        if (!cards.length) {

            savedList.innerHTML =
                emptyHTML(
                    "fa-bookmark",
                    "No saved posts"
                );

            return;
        }

        savedList.innerHTML =
            cards
                .map(postCard)
                .join("");

    } catch (error) {

        console.error(
            "❌ Saved posts error:",
            error
        );

        savedList.innerHTML =
            emptyHTML(
                "fa-bookmark",
                "Unable to load saved posts"
            );
    }
}

/* =========================================================
   STORIES
=========================================================

   IMPORTANT:
   stories.js stores stories like:

   stories/
      STORY_ID/
         uid
         username
         name
         profilePhoto
         url
         type
         createdAt
         expiresAt

========================================================= */

async function loadStories() {

    if (
        !storiesWrapper ||
        !database
    )
        return;

    try {

        const snapshot =
            await database
                .ref("stories")
                .once("value");

        profileStories = [];

        snapshot.forEach(
            child => {

                const story =
                    child.val() || {};

                const owner =
                    story.uid ||
                    story.userId ||
                    "";

                if (
                    owner !==
                    profileUserId
                )
                    return;

                if (
                    isStoryExpired(story)
                )
                    return;

                profileStories.push({
                    id:
                        child.key,
                    ...story
                });
            }
        );

        sortByNewest(
            profileStories
        );

        renderStories();

    } catch (error) {

        console.error(
            "❌ Stories error:",
            error
        );
    }
}

/* =========================================================
   RENDER STORIES
========================================================= */

function renderStories() {

    if (!storiesWrapper)
        return;

    const newStory = `
        <div
            class="storyItem"
            onclick="createProfileStory()"
        >

            <div class="storyCircle addStory">
                <i class="fa-solid fa-plus"></i>
            </div>

            <p>New</p>

        </div>
    `;

    /*
     * Only show New button on own profile.
     */

    const ownProfile =
        currentUser &&
        profileUserId ===
        currentUser.uid;

    const newStoryButton =
        ownProfile
            ? newStory
            : "";

    if (
        !profileStories.length
    ) {

        storiesWrapper.innerHTML =
            newStoryButton;

        storyRing?.classList.remove(
            "hasStory"
        );

        return;
    }

    storyRing?.classList.add(
        "hasStory"
    );

    storiesWrapper.innerHTML =
        newStoryButton +
        profileStories
            .map(
                story =>
                    profileStoryCard(
                        story
                    )
            )
            .join("");
}

/* =========================================================
   PROFILE STORY CARD
========================================================= */

function profileStoryCard(
    story
) {

    const media =
        story.thumbnail ||
        story.thumbnailURL ||
        story.imageURL ||
        story.imageUrl ||
        story.url ||
        story.mediaURL ||
        story.mediaUrl ||
        "";

    return `
        <div
            class="storyItem"
            onclick="openProfileStory('${escapeAttribute(story.id)}')"
        >

            <div class="storyCircle">

                ${
                    media
                        ?
                        `
                        <img
                            src="${escapeAttribute(media)}"
                            alt="Story"
                            loading="lazy"
                        >
                        `
                        :
                        `
                        <div class="storyPlaceholder">
                            <i class="fa-solid fa-play"></i>
                        </div>
                        `
                }

            </div>

            <p>
                ${escapeHTML(
                    story.title ||
                    "Story"
                )}
            </p>

        </div>
    `;
}

/* =========================================================
   FOLLOW SYSTEM
=========================================================

   OWN PROFILE:
   Follow button = HIDDEN

   OTHER PROFILE:
   Follow button = VISIBLE

   Database:

   users/TARGET_UID/followers/CURRENT_UID

   users/CURRENT_UID/following/TARGET_UID

========================================================= */

function updateProfileButtons() {

    if (!currentUser)
        return;

    const isOwnProfile =
        profileUserId ===
        currentUser.uid;

    /* -------------------------------------------------------
       OWN PROFILE
    ------------------------------------------------------- */

    if (isOwnProfile) {

        if (followBtn) {

            followBtn.style.display =
                "none";

            followBtn.disabled =
                false;
        }

        if (editProfileBtn) {

            editProfileBtn.style.display =
                "flex";
        }

        if (messageBtn) {

            messageBtn.style.display =
                "none";
        }

        return;
    }

    /* -------------------------------------------------------
       OTHER PROFILE
    ------------------------------------------------------- */

    if (followBtn) {

        followBtn.style.display =
            "flex";

        followBtn.disabled =
            false;
    }

    if (editProfileBtn) {

        editProfileBtn.style.display =
            "none";
    }

    if (messageBtn) {

        messageBtn.style.display =
            "flex";
    }

    checkFollowing();
}

/* =========================================================
   CHECK FOLLOWING
========================================================= */

async function checkFollowing() {

    if (
        !currentUser ||
        !profileUserId ||
        !database ||
        !followBtn
    )
        return;

    if (
        profileUserId ===
        currentUser.uid
    ) {

        followBtn.style.display =
            "none";

        return;
    }

    try {

        const snapshot =
            await database
                .ref(
                    `users/${profileUserId}/followers/${currentUser.uid}`
                )
                .once("value");

        setFollowButton(
            snapshot.exists()
        );

    } catch (error) {

        console.error(
            "❌ Check following error:",
            error
        );

        setFollowButton(
            false
        );
    }
}

/* =========================================================
   TOGGLE FOLLOW
========================================================= */

async function toggleFollow() {

    if (
        !currentUser ||
        !database ||
        !followBtn
    )
        return;

    /*
     * NEVER allow following yourself.
     */

    if (
        profileUserId ===
        currentUser.uid
    ) {

        return;
    }

    if (
        followBtn.disabled
    )
        return;

    followBtn.disabled =
        true;

    try {

        const followerPath =
            `users/${profileUserId}/followers/${currentUser.uid}`;

        const followingPath =
            `users/${currentUser.uid}/following/${profileUserId}`;

        const targetUserPath =
            `users/${profileUserId}`;

        const currentUserPath =
            `users/${currentUser.uid}`;

        const snapshot =
            await database
                .ref(followerPath)
                .once("value");

        const alreadyFollowing =
            snapshot.exists();

        const updates = {};

        if (
            alreadyFollowing
        ) {

            /*
             * UNFOLLOW
             */

            updates[followerPath] =
                null;

            updates[followingPath] =
                null;

        } else {

            /*
             * FOLLOW
             */

            updates[followerPath] = {

                uid:
                    currentUser.uid,

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP
            };

            updates[followingPath] = {

                uid:
                    profileUserId,

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP
            };
        }

        /*
         * Atomic Firebase update.
         */

        await database
            .ref()
            .update(updates);

        const nowFollowing =
            !alreadyFollowing;

        setFollowButton(
            nowFollowing
        );

        /*
         * Refresh counts.
         */

        await updateFollowCounts(
            nowFollowing
        );

        showToast(
            nowFollowing
                ? "Following ✓"
                : "Unfollowed"
        );

    } catch (error) {

        console.error(
            "❌ Follow error:",
            error
        );

        showToast(
            "Unable to update follow."
        );

    } finally {

        followBtn.disabled =
            false;
    }
}

/* =========================================================
   UPDATE FOLLOW COUNTS
========================================================= */

async function updateFollowCounts(
    isFollowing
) {

    if (
        !database ||
        !profileUserId
    )
        return;

    try {

        const targetSnapshot =
            await database
                .ref(
                    `users/${profileUserId}/followers`
                )
                .once("value");

        const currentSnapshot =
            await database
                .ref(
                    `users/${currentUser.uid}/following`
                )
                .once("value");

        const targetFollowers =
            countObject(
                targetSnapshot.val()
            );

        const currentFollowing =
            countObject(
                currentSnapshot.val()
            );

        /*
         * Keep explicit counters synced too.
         */

        await database
            .ref(
                `users/${profileUserId}`
            )
            .update({

                followersCount:
                    targetFollowers
            });

        await database
            .ref(
                `users/${currentUser.uid}`
            )
            .update({

                followingCount:
                    currentFollowing
            });

        if (followersCount) {

            followersCount.textContent =
                formatNumber(
                    targetFollowers
                );
        }

        if (followingCount) {

            /*
             * Only update following count
             * if viewing own profile.
             */

            if (
                profileUserId ===
                currentUser.uid
            ) {

                followingCount.textContent =
                    formatNumber(
                        currentFollowing
                    );
            }
        }

    } catch (error) {

        console.error(
            "❌ Follow count update error:",
            error
        );
    }
}

/* =========================================================
   FOLLOW BUTTON UI
========================================================= */

function setFollowButton(
    isFollowing
) {

    if (!followBtn)
        return;

    /*
     * Own profile = NEVER show Follow.
     */

    if (
        currentUser &&
        profileUserId ===
        currentUser.uid
    ) {

        followBtn.style.display =
            "none";

        return;
    }

    followBtn.style.display =
        "flex";

    followBtn.classList.toggle(
        "following",
        !!isFollowing
    );

    followBtn.innerHTML =
        isFollowing
            ?
            `
            <i class="fa-solid fa-user-check"></i>
            <span>Following</span>
            `
            :
            `
            <i class="fa-solid fa-user-plus"></i>
            <span>Follow</span>
            `;
}

/* =========================================================
   MESSAGE
========================================================= */

function openMessage() {

    if (
        !currentUser ||
        !profileUserId
    )
        return;

    if (
        profileUserId ===
        currentUser.uid
    )
        return;

    window.location.href =
        `chat.html?uid=${encodeURIComponent(profileUserId)}`;
}

/* =========================================================
   SHARE PROFILE
========================================================= */

async function shareProfile() {

    if (!profileUserId)
        return;

    const username =
        profileData.username ||
        "user";

    const name =
        profileData.name ||
        profileData.fullName ||
        "Viewora User";

    const shareUrl =
        `${window.location.origin}${window.location.pathname}?uid=${encodeURIComponent(profileUserId)}`;

    const shareData = {

        title:
            `${name} • Viewora`,

        text:
            `Check out @${username} on Viewora.`,

        url:
            shareUrl
    };

    try {

        if (
            navigator.share &&
            window.isSecureContext
        ) {

            await navigator.share(
                shareData
            );

            return;
        }

        if (
            navigator.clipboard
        ) {

            await navigator.clipboard.writeText(
                shareUrl
            );

            showToast(
                "Profile link copied ✓"
            );

            return;
        }

        showToast(
            "Copy this profile link manually."
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

/* =========================================================
   CREATE STORY
========================================================= */

function createProfileStory() {

    if (!currentUser) {

        showToast(
            "Please login first."
        );

        return;
    }

    if (
        profileUserId !==
        currentUser.uid
    ) {

        showToast(
            "You can only create stories on your profile."
        );

        return;
    }

    if (storyFile) {

        storyFile.value =
            "";

        storyFile.click();

        return;
    }

    /*
     * Fallback:
     * stories.js creates its own file picker.
     */

    if (
        typeof window.createStory ===
        "function"
    ) {

        window.createStory();

        return;
    }

    showToast(
        "Story system is not loaded."
    );
}

/* =========================================================
   STORY UPLOAD
========================================================= */

async function handleStoryUpload(
    event
) {

    const file =
        event.target.files?.[0];

    if (!file)
        return;

    if (!currentUser)
        return;

    if (
        profileUserId !==
        currentUser.uid
    ) {

        showToast(
            "You can only upload stories to your own profile."
        );

        return;
    }

    /*
     * stories.js owns the actual Cloudinary upload.
     */

    if (
        typeof window.uploadStory ===
        "function"
    ) {

        try {

            await window.uploadStory(
                file
            );

            await loadStories();

            showToast(
                "Story uploaded ✓"
            );

        } catch (error) {

            console.error(
                "❌ Story upload error:",
                error
            );

            showToast(
                "Story upload failed."
            );
        }

        return;
    }

    showToast(
        "stories.js upload system is not loaded."
    );
}

/* =========================================================
   OPEN PROFILE STORY
========================================================= */

function openProfileStory(
    storyId
) {

    if (!storyId)
        return;

    /*
     * stories.js viewer uses story INDEX.
     */

    if (
        typeof window.openStory ===
        "function"
    ) {

        const index =
            profileStories.findIndex(
                story =>
                    story.id ===
                    storyId
            );

        if (index >= 0) {

            window.openStory(
                index
            );

            return;
        }
    }

    /*
     * Fallback.
     */

    window.location.href =
        `stories.html?uid=${encodeURIComponent(profileUserId)}&story=${encodeURIComponent(storyId)}`;
}

/* =========================================================
   TABS
========================================================= */

function setupTabs() {

    const tabs =
        document.querySelectorAll(
            ".tabBtn"
        );

    tabs.forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    const target =
                        tab.dataset.tab;

                    tabs.forEach(
                        item => {

                            item.classList.toggle(
                                "active",
                                item === tab
                            );
                        }
                    );

                    document
                        .querySelectorAll(
                            ".tabContent"
                        )
                        .forEach(
                            content => {

                                content.classList.toggle(
                                    "active",
                                    content.id ===
                                    `${target}Tab`
                                );
                            }
                        );
                }
            );
        }
    );
}

/* =========================================================
   SCROLL TOP
========================================================= */

function setupScrollTop() {

    if (!scrollTopBtn)
        return;

    window.addEventListener(
        "scroll",
        () => {

            scrollTopBtn.classList.toggle(
                "hidden",
                window.scrollY < 400
            );
        },
        {
            passive: true
        }
    );

    scrollTopBtn.addEventListener(
        "click",
        () => {

            window.scrollTo({

                top:
                    0,

                behavior:
                    "smooth"
            });
        }
    );
}

/* =========================================================
   ANIMATION
========================================================= */

function animateProfile() {

    const elements =
        document.querySelectorAll(
            ".profileBanner, .profileCard, .storySection, .profileTabs"
        );

    elements.forEach(
        (element, index) => {

            element.style.opacity =
                "0";

            element.style.transform =
                "translateY(20px)";

            setTimeout(
                () => {

                    element.style.transition =
                        "opacity .55s ease, transform .55s cubic-bezier(.2,.8,.2,1)";

                    element.style.opacity =
                        "1";

                    element.style.transform =
                        "translateY(0)";

                },
                index * 80
            );
        }
    );
}

/* =========================================================
   POST CARD
========================================================= */

function postCard(
    post
) {

    const image =
        post.thumbnail ||
        post.imageURL ||
        post.imageUrl ||
        post.mediaURL ||
        post.mediaUrl;

    if (!image) {

        return `
            <article
                class="profilePostCard noMedia"
                onclick="openPost('${escapeAttribute(post.id)}')"
            >
                <i class="fa-solid fa-image"></i>
            </article>
        `;
    }

    return `
        <article
            class="profilePostCard"
            onclick="openPost('${escapeAttribute(post.id)}')"
        >

            <img
                src="${escapeAttribute(image)}"
                alt="Post"
                loading="lazy"
                onerror="this.style.display='none'"
            >

            <div class="postOverlay">

                <span>
                    <i class="fa-solid fa-heart"></i>
                    ${formatNumber(
                        post.likesCount ||
                        countObject(post.likes)
                    )}
                </span>

                <span>
                    <i class="fa-solid fa-comment"></i>
                    ${formatNumber(
                        post.commentsCount ||
                        countObject(post.comments)
                    )}
                </span>

            </div>

        </article>
    `;
}

/* =========================================================
   SHORT CARD
========================================================= */

function shortCard(
    short
) {

    const thumbnail =
        short.thumbnail ||
        short.thumbnailURL ||
        short.cover ||
        short.imageURL ||
        short.imageUrl;

    return `
        <article
            class="shortCard"
            onclick="openShort('${escapeAttribute(short.id)}')"
        >

            ${
                thumbnail
                    ?
                    `
                    <img
                        src="${escapeAttribute(thumbnail)}"
                        alt="Short"
                        loading="lazy"
                    >
                    `
                    :
                    `
                    <div class="shortPlaceholder">
                        <i class="fa-solid fa-play"></i>
                    </div>
                    `
            }

            <div class="shortPlay">
                <i class="fa-solid fa-play"></i>
            </div>

        </article>
    `;
}

/* =========================================================
   VIDEO CARD
========================================================= */

function videoCard(
    video
) {

    const thumbnail =
        video.thumbnail ||
        video.thumbnailURL ||
        video.imageURL ||
        video.imageUrl;

    return `
        <article
            class="videoCard"
            onclick="openPost('${escapeAttribute(video.id)}')"
        >

            ${
                thumbnail
                    ?
                    `
                    <img
                        src="${escapeAttribute(thumbnail)}"
                        alt="Video"
                        loading="lazy"
                    >
                    `
                    :
                    `
                    <div class="videoPlaceholder">
                        <i class="fa-solid fa-video"></i>
                    </div>
                    `
            }

            <div class="videoInfo">

                <h3>
                    ${escapeHTML(
                        video.title ||
                        video.caption ||
                        "Viewora Video"
                    )}
                </h3>

                <span>
                    <i class="fa-solid fa-play"></i>
                    ${formatNumber(
                        video.views ||
                        video.viewsCount ||
                        0
                    )}
                </span>

            </div>

        </article>
    `;
}

/* =========================================================
   OPEN POST
========================================================= */

function openPost(
    id
) {

    if (!id)
        return;

    window.location.href =
        `post.html?id=${encodeURIComponent(id)}`;
}

/* =========================================================
   OPEN SHORT
========================================================= */

function openShort(
    id
) {

    if (!id)
        return;

    window.location.href =
        `shorts.html?id=${encodeURIComponent(id)}`;
}

/* =========================================================
   HELPERS
========================================================= */

function countObject(
    value
) {

    if (!value)
        return 0;

    if (
        typeof value ===
        "number"
    )
        return value;

    if (
        typeof value ===
        "object"
    )
        return Object.keys(value).length;

    return 0;
}

/* =========================================================
   NUMBER FORMAT
========================================================= */

function formatNumber(
    number
) {

    const value =
        Number(number) || 0;

    if (
        value >= 1000000
    ) {

        return (
            (value / 1000000)
                .toFixed(1)
                .replace(".0", "") +
            "M"
        );
    }

    if (
        value >= 1000
    ) {

        return (
            (value / 1000)
                .toFixed(1)
                .replace(".0", "") +
            "K"
        );
    }

    return String(value);
}

/* =========================================================
   SORT
========================================================= */

function sortByNewest(
    array
) {

    array.sort(
        (a, b) =>
            Number(
                b.createdAt ||
                b.timestamp ||
                0
            ) -
            Number(
                a.createdAt ||
                a.timestamp ||
                0
            )
    );
}

/* =========================================================
   STORY EXPIRY
========================================================= */

function isStoryExpired(
    story
) {

    const expiresAt =
        Number(
            story.expiresAt ||
            story.expireAt ||
            0
        );

    if (!expiresAt)
        return false;

    return (
        Date.now() >
        expiresAt
    );
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        char =>
            ({
                "&":
                    "&amp;",

                "<":
                    "&lt;",

                ">":
                    "&gt;",

                '"':
                    "&quot;",

                "'":
                    "&#039;"
            })[char]
    );
}

/* =========================================================
   ESCAPE ATTRIBUTE
========================================================= */

function escapeAttribute(
    value
) {

    return escapeHTML(
        value
    ).replace(
        /`/g,
        "&#096;"
    );
}

/* =========================================================
   LOADING
========================================================= */

function loadingHTML() {

    return `
        <div class="profileLoading">

            <div class="loadingSpinner"></div>

            <span>
                Loading...
            </span>

        </div>
    `;
}

/* =========================================================
   EMPTY
========================================================= */

function emptyHTML(
    icon,
    text
) {

    return `
        <div class="profileEmpty">

            <div class="emptyIcon">

                <i class="fa-solid ${escapeAttribute(icon)}"></i>

            </div>

            <h3>
                ${escapeHTML(text)}
            </h3>

        </div>
    `;
}

/* =========================================================
   LOADER
========================================================= */

function showLoader(
    show
) {

    if (!pageLoader)
        return;

    if (show) {

        pageLoader.classList.remove(
            "hidden"
        );

        app?.classList.add(
            "hidden"
        );

    } else {

        pageLoader.classList.add(
            "hidden"
        );

        app?.classList.remove(
            "hidden"
        );

        app?.classList.add(
            "fadeIn"
        );
    }
}

/* =========================================================
   TOAST
========================================================= */

function showToast(
    message
) {

    let toast =
        document.getElementById(
            "vieworaToast"
        );

    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "vieworaToast";

        toast.style.cssText = `
            position:fixed;
            left:50%;
            bottom:100px;
            transform:translateX(-50%) translateY(20px);
            padding:12px 18px;
            border-radius:999px;
            background:rgba(15,18,28,.95);
            color:#fff;
            font-size:14px;
            font-weight:700;
            z-index:99999;
            opacity:0;
            pointer-events:none;
            backdrop-filter:blur(18px);
            box-shadow:0 12px 40px rgba(0,0,0,.35);
            transition:.3s ease;
        `;

        document.body.appendChild(
            toast
        );
    }

    toast.textContent =
        message;

    requestAnimationFrame(
        () => {

            toast.style.opacity =
                "1";

            toast.style.transform =
                "translateX(-50%) translateY(0)";
        }
    );

    clearTimeout(
        toast._timer
    );

    toast._timer =
        setTimeout(
            () => {

                toast.style.opacity =
                    "0";

                toast.style.transform =
                    "translateX(-50%) translateY(20px)";

            },
            2500
        );
}

/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    if (followBtn) {

        followBtn.addEventListener(
            "click",
            toggleFollow
        );
    }

    if (messageBtn) {

        messageBtn.addEventListener(
            "click",
            openMessage
        );
    }

    if (shareBtn) {

        shareBtn.addEventListener(
            "click",
            shareProfile
        );
    }

    if (storyFile) {

        storyFile.addEventListener(
            "change",
            handleStoryUpload
        );
    }

    setupTabs();

    setupScrollTop();
}

/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        startProfile();

    }
);

/* =========================================================
   GLOBAL API
========================================================= */

window.createProfileStory =
    createProfileStory;

window.openProfileStory =
    openProfileStory;

window.openPost =
    openPost;

window.openShort =
    openShort;

window.toggleFollow =
    toggleFollow;

window.shareProfile =
    shareProfile;

window.loadProfile =
    loadProfile;

console.log(
    "%cVIEWORA PROFILE READY",
    "color:#00e5ff;font-size:18px;font-weight:800"
);