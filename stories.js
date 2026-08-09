"use strict";

/* =========================================================
   VIEWORA STORIES • PREMIUM V2
   Firebase Compat + Realtime Database + Cloudinary
   Requires:
   firebase.js loaded BEFORE stories.js
========================================================= */

console.log(
    "%cVIEWORA STORIES",
    "color:#00e5ff;font-size:18px;font-weight:800"
);

/* =========================================================
   CONFIG
========================================================= */

const VIEWORA_STORY_CONFIG = Object.freeze({

    cloudinaryCloudName: "z5m6wjdf",

    cloudinaryUploadPreset: "Viewora-upload",

    imageMaxSize: 20 * 1024 * 1024,

    videoMaxSize: 100 * 1024 * 1024,

    imageDuration: 5000,

    videoMaxDuration: 30000,

    storyLifetime: 24 * 60 * 60 * 1000,

    defaultAvatar: "non.jpg"

});

const CLOUDINARY_UPLOAD_URL =
    `https://api.cloudinary.com/v1_1/${VIEWORA_STORY_CONFIG.cloudinaryCloudName}/auto/upload`;


/* =========================================================
   FIREBASE SAFETY CHECK
========================================================= */

function checkStoriesFirebase() {

    if (typeof firebase === "undefined") {

        console.error(
            "❌ Viewora Stories: Firebase SDK missing."
        );

        return false;
    }

    if (
        typeof window.auth === "undefined" ||
        !window.auth
    ) {

        console.error(
            "❌ Viewora Stories: Firebase Auth unavailable."
        );

        return false;
    }

    if (
        typeof window.db === "undefined" ||
        !window.db
    ) {

        console.error(
            "❌ Viewora Stories: Firebase Database unavailable."
        );

        return false;
    }

    return true;
}


/* =========================================================
   DOM
========================================================= */

const storyViewer =
    document.getElementById("storyViewer");

const storyProgress =
    document.getElementById("storyProgress");

const storyProfile =
    document.getElementById("storyProfile");

const storyName =
    document.getElementById("storyName");

const storyTime =
    document.getElementById("storyTime");

const storyImage =
    document.getElementById("storyImage");

const storyVideo =
    document.getElementById("storyVideo");

const storyReplyInput =
    document.getElementById("storyReply");


/* =========================================================
   STATE
========================================================= */

let vieworaStories = [];

let currentStoryIndex = 0;

let currentStoryUser = null;

let currentStoryProfile = {};

let storyTimer = null;

let videoTimer = null;

let storiesDatabaseRef = null;

let storiesValueListener = null;

let authStateListener = null;

let storyViewerOpen = false;


/* =========================================================
   AUTH
========================================================= */

function initVieworaStories() {

    if (!checkStoriesFirebase()) {
        return;
    }

    if (authStateListener) {
        return;
    }

    authStateListener =
        window.auth.onAuthStateChanged(
            async user => {

                currentStoryUser = user || null;

                if (!user) {

                    currentStoryProfile = {};

                    vieworaStories = [];

                    console.log(
                        "👤 Stories: no authenticated user."
                    );

                    return;
                }

                try {

                    await loadStoryProfile();

                } catch (error) {

                    console.warn(
                        "⚠️ Story profile load failed:",
                        error
                    );

                    currentStoryProfile = {};
                }

                loadVieworaStories();
            }
        );
}


/* =========================================================
   PROFILE
========================================================= */

async function loadStoryProfile() {

    if (
        !currentStoryUser ||
        !window.db
    ) {
        return;
    }

    const snapshot =
        await window.db
            .ref(
                `users/${currentStoryUser.uid}`
            )
            .once("value");

    currentStoryProfile =
        snapshot.exists()
            ? snapshot.val() || {}
            : {};
}


/* =========================================================
   LOAD STORIES
========================================================= */

function loadVieworaStories() {

    if (!checkStoriesFirebase()) {
        return;
    }

    cleanupStoriesListener();

    storiesDatabaseRef =
        window.db
            .ref("stories")
            .orderByChild("createdAt");

    storiesValueListener =
        snapshot => {

            const now = Date.now();

            const loaded = [];

            snapshot.forEach(
                child => {

                    const raw =
                        child.val() || {};

                    const story =
                        normalizeStory(
                            raw,
                            child.key
                        );

                    if (!story.url) {
                        return;
                    }

                    if (
                        story.expiresAt <= now
                    ) {
                        return;
                    }

                    loaded.push(story);
                }
            );

            loaded.sort(
                (a, b) =>
                    b.createdAt -
                    a.createdAt
            );

            vieworaStories = loaded;

            /*
             * Keep current index safe
             */
            if (
                currentStoryIndex >=
                vieworaStories.length
            ) {

                currentStoryIndex =
                    Math.max(
                        0,
                        vieworaStories.length - 1
                    );
            }

            console.log(
                `📖 Stories loaded: ${vieworaStories.length}`
            );

            /*
             * Optional: refresh currently open story
             */
            if (
                storyViewerOpen &&
                vieworaStories.length
            ) {

                renderCurrentStory();
            }
        };

    storiesDatabaseRef.on(
        "value",
        storiesValueListener,
        error => {

            console.error(
                "❌ Stories database error:",
                error
            );
        }
    );
}


/* =========================================================
   NORMALIZE
========================================================= */

function normalizeStory(
    raw,
    id
) {

    const createdAt =
        Number(
            raw.createdAt || Date.now()
        );

    const expiresAt =
        Number(
            raw.expiresAt ||
            (
                createdAt +
                VIEWORA_STORY_CONFIG.storyLifetime
            )
        );

    const url =
        raw.url ||
        raw.mediaUrl ||
        raw.secure_url ||
        "";

    return {

        id,

        uid:
            raw.uid ||
            raw.userId ||
            "",

        username:
            raw.username ||
            "user",

        name:
            raw.name ||
            raw.fullName ||
            raw.displayName ||
            raw.username ||
            "User",

        profilePhoto:
            raw.profilePhoto ||
            raw.photoURL ||
            raw.avatar ||
            VIEWORA_STORY_CONFIG.defaultAvatar,

        url,

        type:
            raw.type ||
            detectStoryType(url),

        caption:
            raw.caption ||
            "",

        createdAt,

        expiresAt,

        publicId:
            raw.publicId ||
            "",

        resourceType:
            raw.resourceType ||
            ""
    };
}


/* =========================================================
   MEDIA TYPE
========================================================= */

function detectStoryType(url) {

    const clean =
        String(url || "")
            .split("?")[0]
            .toLowerCase();

    if (
        /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(clean)
    ) {

        return "video";
    }

    return "image";
}


/* =========================================================
   OPEN
========================================================= */

function openStory(index = 0) {

    if (!vieworaStories.length) {

        showStoryMessage(
            "No active stories."
        );

        return;
    }

    currentStoryIndex =
        Math.max(
            0,
            Math.min(
                Number(index) || 0,
                vieworaStories.length - 1
            )
        );

    storyViewerOpen = true;

    if (storyViewer) {

        storyViewer.style.display =
            "block";
    }

    document.body.style.overflow =
        "hidden";

    renderCurrentStory();
}


/* =========================================================
   RENDER
========================================================= */

function renderCurrentStory() {

    clearStoryTimers();

    if (!storyViewerOpen) {
        return;
    }

    const story =
        vieworaStories[currentStoryIndex];

    if (!story) {

        closeStoryViewer();

        return;
    }

    updateStoryHeader(story);

    resetStoryMedia();

    renderStoryProgress();

    if (
        story.type === "video"
    ) {

        renderVideoStory(story);

    } else {

        renderImageStory(story);
    }

    markStoryViewed(story);
}


/* =========================================================
   HEADER
========================================================= */

function updateStoryHeader(story) {

    if (storyProfile) {

        storyProfile.src =
            story.profilePhoto ||
            VIEWORA_STORY_CONFIG.defaultAvatar;

        storyProfile.onerror =
            () => {

                storyProfile.src =
                    VIEWORA_STORY_CONFIG.defaultAvatar;
            };
    }

    if (storyName) {

        storyName.textContent =
            story.name ||
            story.username ||
            "User";
    }

    if (storyTime) {

        storyTime.textContent =
            formatStoryTime(
                story.createdAt
            );
    }
}


/* =========================================================
   IMAGE
========================================================= */

function renderImageStory(story) {

    if (!storyImage) {
        return;
    }

    storyImage.style.display =
        "block";

    storyImage.src =
        story.url;

    storyImage.onload =
        () => {

            startProgress(
                VIEWORA_STORY_CONFIG.imageDuration
            );
        };

    storyImage.onerror =
        () => {

            console.error(
                "❌ Story image failed:",
                story.url
            );

            showStoryMessage(
                "Unable to load this story."
            );

            setTimeout(
                nextStory,
                1000
            );
        };
}


/* =========================================================
   VIDEO
========================================================= */

function renderVideoStory(story) {

    if (!storyVideo) {
        return;
    }

    storyVideo.style.display =
        "block";

    storyVideo.muted =
        false;

    storyVideo.playsInline =
        true;

    storyVideo.src =
        story.url;

    storyVideo.onloadedmetadata =
        async () => {

            const duration =
                Number(
                    storyVideo.duration
                );

            if (
                !duration ||
                !Number.isFinite(duration)
            ) {

                startProgress(
                    VIEWORA_STORY_CONFIG.imageDuration
                );

            } else {

                const durationMs =
                    Math.min(
                        duration * 1000,
                        VIEWORA_STORY_CONFIG.videoMaxDuration
                    );

                startProgress(
                    durationMs
                );

                if (
                    durationMs <
                    duration * 1000
                ) {

                    videoTimer =
                        setTimeout(
                            nextStory,
                            durationMs
                        );
                    }
            }

            try {

                await storyVideo.play();

            } catch {

                /*
                 * Mobile browsers may block
                 * unmuted autoplay.
                 */

                storyVideo.muted =
                    true;

                try {

                    await storyVideo.play();

                } catch {

                    console.warn(
                        "⚠️ Video autoplay blocked."
                    );
                }
            }
        };

    storyVideo.onended =
        () => {

            if (
                storyVideo.duration * 1000 <=
                VIEWORA_STORY_CONFIG.videoMaxDuration
            ) {

                nextStory();
            }
        };

    storyVideo.onerror =
        () => {

            console.error(
                "❌ Story video failed:",
                story.url
            );

            showStoryMessage(
                "Unable to play this story."
            );

            setTimeout(
                nextStory,
                1000
            );
        };
}


/* =========================================================
   MEDIA RESET
========================================================= */

function resetStoryMedia() {

    if (storyImage) {

        storyImage.onload =
            null;

        storyImage.onerror =
            null;

        storyImage.style.display =
            "none";

        storyImage.removeAttribute(
            "src"
        );
    }

    if (storyVideo) {

        storyVideo.pause();

        storyVideo.onloadedmetadata =
            null;

        storyVideo.onended =
            null;

        storyVideo.onerror =
            null;

        storyVideo.style.display =
            "none";

        storyVideo.removeAttribute(
            "src"
        );

        storyVideo.load();
    }
}


/* =========================================================
   PROGRESS
========================================================= */

function renderStoryProgress() {

    if (!storyProgress) {
        return;
    }

    storyProgress.innerHTML =
        "";

    vieworaStories.forEach(
        (_, index) => {

            const track =
                document.createElement(
                    "div"
                );

            track.className =
                "storyProgressItem";

            const fill =
                document.createElement(
                    "div"
                );

            fill.className =
                "storyProgressFill";

            if (
                index <
                currentStoryIndex
            ) {

                fill.style.width =
                    "100%";
            }

            storyProgress.appendChild(
                track
            );

            track.appendChild(
                fill
            );
        }
    );
}


/* =========================================================
   START PROGRESS
========================================================= */

function startProgress(duration) {

    const fill =
        getCurrentProgressFill();

    if (!fill) {
        return;
    }

    fill.style.transition =
        "none";

    fill.style.width =
        "0%";

    requestAnimationFrame(
        () => {

            requestAnimationFrame(
                () => {

                    fill.style.transition =
                        `width ${duration}ms linear`;

                    fill.style.width =
                        "100%";
                }
            );
        }
    );

    storyTimer =
        setTimeout(
            nextStory,
            duration
        );
}


/* =========================================================
   CURRENT PROGRESS
========================================================= */

function getCurrentProgressFill() {

    if (!storyProgress) {
        return null;
    }

    const items =
        storyProgress.querySelectorAll(
            ".storyProgressItem"
        );

    const current =
        items[currentStoryIndex];

    return current
        ? current.querySelector(
            ".storyProgressFill"
        )
        : null;
}


/* =========================================================
   NEXT
========================================================= */

function nextStory() {

    clearStoryTimers();

    if (
        currentStoryIndex <
        vieworaStories.length - 1
    ) {

        currentStoryIndex++;

        renderCurrentStory();

    } else {

        closeStoryViewer();
    }
}


/* =========================================================
   PREVIOUS
========================================================= */

function prevStory() {

    clearStoryTimers();

    if (
        currentStoryIndex > 0
    ) {

        currentStoryIndex--;

        renderCurrentStory();

    } else {

        renderCurrentStory();
    }
}


/* =========================================================
   CLOSE
========================================================= */

function closeStoryViewer() {

    clearStoryTimers();

    storyViewerOpen =
        false;

    resetStoryMedia();

    if (storyViewer) {

        storyViewer.style.display =
            "none";
    }

    document.body.style.overflow =
        "";

    if (storyReplyInput) {

        storyReplyInput.value =
            "";
    }
}


/* =========================================================
   TIMER CLEANUP
========================================================= */

function clearStoryTimers() {

    if (storyTimer) {

        clearTimeout(
            storyTimer
        );

        storyTimer =
            null;
    }

    if (videoTimer) {

        clearTimeout(
            videoTimer
        );

        videoTimer =
            null;
    }
}


/* =========================================================
   REPLY
========================================================= */

async function replyStory() {

    if (!currentStoryUser) {

        showStoryMessage(
            "Please login to reply."
        );

        return;
    }

    if (
        !window.db ||
        typeof firebase === "undefined"
    ) {
        return;
    }

    const text =
        storyReplyInput?.value
            ?.trim();

    if (!text) {
        return;
    }

    const story =
        vieworaStories[currentStoryIndex];

    if (!story) {
        return;
    }

    if (
        story.uid ===
        currentStoryUser.uid
    ) {

        showStoryMessage(
            "You cannot reply to your own story."
        );

        return;
    }

    try {

        const reply =
            window.db
                .ref("storyReplies")
                .push();

        await reply.set({

            storyId:
                story.id,

            storyOwner:
                story.uid,

            senderId:
                currentStoryUser.uid,

            senderUsername:
                currentStoryProfile.username ||
                currentStoryUser.displayName ||
                "user",

            senderName:
                currentStoryProfile.name ||
                currentStoryProfile.fullName ||
                currentStoryUser.displayName ||
                "User",

            text,

            createdAt:
                firebase.database
                    .ServerValue
                    .TIMESTAMP
        });

        storyReplyInput.value =
            "";

        showStoryMessage(
            "Reply sent ✓"
        );

    } catch (error) {

        console.error(
            "❌ Story reply failed:",
            error
        );

        showStoryMessage(
            "Reply failed."
        );
    }
}


/* =========================================================
   STORY VIEW
========================================================= */

async function markStoryViewed(story) {

    if (
        !currentStoryUser ||
        !story ||
        !story.id ||
        !window.db
    ) {
        return;
    }

    if (
        story.uid ===
        currentStoryUser.uid
    ) {
        return;
    }

    try {

        await window.db
            .ref(
                `storyViews/${story.id}/${currentStoryUser.uid}`
            )
            .set({

                uid:
                    currentStoryUser.uid,

                viewedAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP
            });

    } catch (error) {

        console.warn(
            "⚠️ Story view failed:",
            error
        );
    }
}


/* =========================================================
   CREATE STORY
========================================================= */

function createStory() {

    if (!currentStoryUser) {

        showStoryMessage(
            "Please login first."
        );

        return;
    }

    const input =
        document.createElement(
            "input"
        );

    input.type =
        "file";

    input.accept =
        "image/*,video/*";

    input.style.display =
        "none";

    document.body.appendChild(
        input
    );

    input.addEventListener(
        "change",
        async () => {

            const file =
                input.files?.[0];

            if (!file) {

                input.remove();

                return;
            }

            try {

                await uploadStory(
                    file
                );

            } catch (error) {

                console.error(
                    "❌ Story upload failed:",
                    error
                );

                showStoryMessage(
                    "Story upload failed."
                );

            } finally {

                input.remove();
            }
        }
    );

    input.click();
}


/* =========================================================
   UPLOAD STORY
========================================================= */

async function uploadStory(file) {

    if (!checkStoriesFirebase()) {
        return;
    }

    const isImage =
        file.type.startsWith(
            "image/"
        );

    const isVideo =
        file.type.startsWith(
            "video/"
        );

    if (
        !isImage &&
        !isVideo
    ) {

        showStoryMessage(
            "Only images and videos are allowed."
        );

        return;
    }

    const maxSize =
        isImage
            ? VIEWORA_STORY_CONFIG.imageMaxSize
            : VIEWORA_STORY_CONFIG.videoMaxSize;

    if (
        file.size >
        maxSize
    ) {

        showStoryMessage(
            isImage
                ? "Image must be under 20 MB."
                : "Video must be under 100 MB."
        );

        return;
    }

    showStoryMessage(
        "Uploading story..."
    );

    const cloudinary =
        await uploadToCloudinary(
            file
        );

    const createdAt =
        Date.now();

    const newStoryRef =
        window.db
            .ref("stories")
            .push();

    const storyData = {

        uid:
            currentStoryUser.uid,

        username:
            currentStoryProfile.username ||
            currentStoryUser.displayName ||
            "user",

        name:
            currentStoryProfile.name ||
            currentStoryProfile.fullName ||
            currentStoryProfile.displayName ||
            currentStoryProfile.username ||
            currentStoryUser.displayName ||
            "User",

        profilePhoto:
            currentStoryProfile.profilePhoto ||
            currentStoryProfile.photoURL ||
            currentStoryUser.photoURL ||
            VIEWORA_STORY_CONFIG.defaultAvatar,

        url:
            cloudinary.secure_url,

        publicId:
            cloudinary.public_id ||
            "",

        resourceType:
            cloudinary.resource_type ||
            "",

        type:
            isVideo
                ? "video"
                : "image",

        fileName:
            file.name,

        fileSize:
            file.size,

        createdAt:
            firebase.database
                .ServerValue
                .TIMESTAMP,

        expiresAt:
            createdAt +
            VIEWORA_STORY_CONFIG.storyLifetime
    };

    await newStoryRef.set(
        storyData
    );

    showStoryMessage(
        "Story uploaded ✓"
    );
}


/* =========================================================
   CLOUDINARY UPLOAD
========================================================= */

function uploadToCloudinary(file) {

    return new Promise(
        (resolve, reject) => {

            const xhr =
                new XMLHttpRequest();

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            formData.append(
                "upload_preset",
                VIEWORA_STORY_CONFIG.cloudinaryUploadPreset
            );

            xhr.open(
                "POST",
                CLOUDINARY_UPLOAD_URL,
                true
            );

            xhr.onload =
                () => {

                    if (
                        xhr.status >= 200 &&
                        xhr.status < 300
                    ) {

                        try {

                            const result =
                                JSON.parse(
                                    xhr.responseText
                                );

                            if (
                                !result.secure_url
                            ) {

                                reject(
                                    new Error(
                                        "Cloudinary returned no secure URL."
                                    )
                                );

                                return;
                            }

                            resolve(
                                result
                            );

                        } catch {

                            reject(
                                new Error(
                                    "Invalid Cloudinary response."
                                )
                            );
                        }

                    } else {

                        reject(
                            new Error(
                                `Cloudinary HTTP ${xhr.status}`
                            )
                        );
                    }
                };

            xhr.onerror =
                () => {

                    reject(
                        new Error(
                            "Cloudinary network error."
                        )
                    );
                };

            xhr.ontimeout =
                () => {

                    reject(
                        new Error(
                            "Cloudinary upload timeout."
                        )
                    );
                };

            xhr.timeout =
                120000;

            xhr.send(
                formData
            );
        }
    );
}


/* =========================================================
   STORY TIME
========================================================= */

function formatStoryTime(timestamp) {

    const time =
        Number(timestamp);

    if (!time) {
        return "Just now";
    }

    const difference =
        Date.now() -
        time;

    if (
        difference < 60 * 1000
    ) {

        return "Just now";
    }

    if (
        difference < 60 * 60 * 1000
    ) {

        return (
            Math.floor(
                difference /
                (60 * 1000)
            ) +
            "m ago"
        );
    }

    if (
        difference < 24 * 60 * 60 * 1000
    ) {

        return (
            Math.floor(
                difference /
                (60 * 60 * 1000)
            ) +
            "h ago"
        );
    }

    return new Date(time)
        .toLocaleDateString(
            [],
            {
                day: "numeric",
                month: "short"
            }
        );
}


/* =========================================================
   MESSAGE / TOAST
========================================================= */

function showStoryMessage(message) {

    console.log(
        `[VIEWORA STORY] ${message}`
    );

    const toast =
        document.getElementById(
            "toast"
        );

    const toastText =
        document.getElementById(
            "toastText"
        );

    if (
        toast &&
        toastText
    ) {

        toastText.textContent =
            message;

        toast.classList.remove(
            "hidden"
        );

        clearTimeout(
            window.vieworaStoryToastTimer
        );

        window.vieworaStoryToastTimer =
            setTimeout(
                () => {

                    toast.classList.add(
                        "hidden"
                    );

                },
                2500
            );

        return;
    }

    /*
     * Avoid blocking alert() for
     * normal story notifications.
     */

    console.log(
        "ℹ️",
        message
    );
}


/* =========================================================
   LISTENER CLEANUP
========================================================= */

function cleanupStoriesListener() {

    if (
        storiesDatabaseRef &&
        storiesValueListener
    ) {

        storiesDatabaseRef.off(
            "value",
            storiesValueListener
        );
    }

    storiesDatabaseRef =
        null;

    storiesValueListener =
        null;
}


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (!storyViewerOpen) {
            return;
        }

        if (
            event.key === "Escape"
        ) {

            closeStoryViewer();

        } else if (
            event.key === "ArrowRight"
        ) {

            nextStory();

        } else if (
            event.key === "ArrowLeft"
        ) {

            prevStory();
        }
    }
);


/* =========================================================
   TOUCH SWIPE
========================================================= */

let storyTouchStartX = 0;

let storyTouchStartY = 0;

if (storyViewer) {

    storyViewer.addEventListener(
        "touchstart",
        event => {

            const touch =
                event.touches[0];

            if (!touch) {
                return;
            }

            storyTouchStartX =
                touch.clientX;

            storyTouchStartY =
                touch.clientY;

        },
        {
            passive: true
        }
    );

    storyViewer.addEventListener(
        "touchend",
        event => {

            const touch =
                event.changedTouches[0];

            if (!touch) {
                return;
            }

            const deltaX =
                touch.clientX -
                storyTouchStartX;

            const deltaY =
                touch.clientY -
                storyTouchStartY;

            if (
                Math.abs(deltaX) < 50
            ) {
                return;
            }

            if (
                Math.abs(deltaX) <
                Math.abs(deltaY)
            ) {
                return;
            }

            if (
                deltaX < 0
            ) {

                nextStory();

            } else {

                prevStory();
            }
        },
        {
            passive: true
        }
    );
}


/* =========================================================
   VISIBILITY
========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden
        ) {

            clearStoryTimers();

            if (
                storyVideo &&
                !storyVideo.paused
            ) {

                storyVideo.pause();
            }

            return;
        }

        if (
            storyViewerOpen
        ) {

            renderCurrentStory();
        }
    }
);


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        clearStoryTimers();

        cleanupStoriesListener();

        if (authStateListener) {

            authStateListener();
        }
    }
);


/* =========================================================
   GLOBAL API
========================================================= */

window.openStory =
    openStory;

window.nextStory =
    nextStory;

window.prevStory =
    prevStory;

window.closeStoryViewer =
    closeStoryViewer;

window.replyStory =
    replyStory;

window.createStory =
    createStory;


/* =========================================================
   START
========================================================= */

initVieworaStories();

console.log(
    "%cVIEWORA STORIES READY",
    "color:#00e676;font-size:18px;font-weight:800"
);