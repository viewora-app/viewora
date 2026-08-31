"use strict";

/*
===========================================================
 VIEWORA — EDIT SHORT
 edit-shorts.js
 PREMIUM • FIREBASE REALTIME DATABASE
===========================================================

SUPPORTED URLS:

edit-shorts.html?shortId=SHORT_ID
edit-shorts.html?edit=SHORT_ID

ID FALLBACK:

1. URL ?shortId=
2. URL ?edit=
3. sessionStorage
4. localStorage

FIREBASE:

shorts/{shortId}

FEATURES:

• Load existing Short
• Load video preview
• Load title
• Load description
• Load tags
• Load visibility
• Load comments/sharing/remix settings
• Load advanced settings
• Change cover
• Save Draft
• Update Short
• Retry
• Preview
===========================================================
*/

(() => {

    /* =====================================================
       PREVENT DOUBLE INIT
    ====================================================== */

    if (window.__VIEWORA_EDIT_SHORT_INITIALIZED__) {
        console.warn("Viewora Edit Short already initialized.");
        return;
    }

    window.__VIEWORA_EDIT_SHORT_INITIALIZED__ = true;


    /* =====================================================
       CONFIG
    ====================================================== */

    const CONFIG = {

        SHORTS_PATH: "shorts",

        USERS_PATH: "users",

        STORAGE_KEY:
            "viewora_edit_short_id",

        SESSION_KEY:
            "viewora_edit_short_id",

        MAX_TITLE:
            100,

        MAX_DESCRIPTION:
            5000

    };


    /* =====================================================
       STATE
    ====================================================== */

    const state = {

        shortId: null,

        short: null,

        currentUser: null,

        initialized: false,

        loading: false,

        saving: false,

        selectedVisibility: "public",

        selectedTags: [],

        coverURL: "",

        coverChanged: false,

        originalVideoURL: "",

        videoObjectURL: "",

        retrying: false

    };


    /* =====================================================
       DOM HELPER
    ====================================================== */

    const $ = id =>
        document.getElementById(id);


    /* =====================================================
       FIREBASE CHECK
    ====================================================== */

    function firebaseReady() {

        return (
            typeof firebase !== "undefined" &&
            firebase.database &&
            firebase.auth
        );

    }


    if (!firebaseReady()) {

        console.error(
            "Viewora Edit Short: Firebase is not loaded."
        );

        showToast(
            "Firebase is not available",
            "error"
        );

        return;

    }


    /* =====================================================
       FIREBASE
    ====================================================== */

    const db =
        firebase.database();

    const auth =
        firebase.auth();


    /* =====================================================
       BASIC HELPERS
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


    function getFirstValue(
        object,
        keys,
        fallback = ""
    ) {

        if (!object) {
            return fallback;
        }

        for (const key of keys) {

            const value =
                object[key];

            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                return value;
            }

        }

        return fallback;

    }


    function normalizeBoolean(
        value,
        fallback = true
    ) {

        if (
            value === undefined ||
            value === null
        ) {
            return fallback;
        }

        if (
            value === false ||
            value === "false" ||
            value === 0
        ) {
            return false;
        }

        return true;

    }


    /* =====================================================
       TOAST
    ====================================================== */

    function showToast(
        message,
        type = "success"
    ) {

        const toast =
            $("toast");

        const toastText =
            $("toastText");

        const toastIcon =
            $("toastIconElement");

        if (!toast) {
            return;
        }

        if (toastText) {
            toastText.textContent =
                message;
        }

        if (toastIcon) {

            toastIcon.className =
                type === "error"
                    ? "fa-solid fa-circle-exclamation"
                    : "fa-solid fa-circle-check";

        }

        toast.classList.remove(
            "hidden"
        );

        clearTimeout(
            showToast.timer
        );

        showToast.timer =
            setTimeout(() => {

                toast.classList.add(
                    "hidden"
                );

            }, 2600);

    }


    /* =====================================================
       PROCESSING UI
    ====================================================== */

    function showProcessing(
        title,
        text
    ) {

        const overlay =
            $("processingOverlay");

        if (!overlay) {
            return;
        }

        $("processingTitle").textContent =
            title || "Saving your Short";

        $("processingText").textContent =
            text || "Please wait...";

        overlay.classList.remove(
            "hidden"
        );

        const progress =
            overlay.querySelector(
                ".processingProgress span"
            );

        if (progress) {

            progress.style.width =
                "20%";

            setTimeout(() => {

                progress.style.width =
                    "55%";

            }, 250);

        }

    }


    function hideProcessing() {

        const overlay =
            $("processingOverlay");

        if (!overlay) {
            return;
        }

        const progress =
            overlay.querySelector(
                ".processingProgress span"
            );

        if (progress) {
            progress.style.width =
                "100%";
        }

        setTimeout(() => {

            overlay.classList.add(
                "hidden"
            );

            if (progress) {
                progress.style.width =
                    "0%";
            }

        }, 300);

    }


    /* =====================================================
       GET SHORT ID
    ====================================================== */

    function getShortId() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        /* ---------------------------------------------
           NEW FLOW
        --------------------------------------------- */

        const shortId =
            params.get("shortId");


        if (
            shortId &&
            shortId.trim()
        ) {

            const id =
                shortId.trim();

            saveShortId(id);

            return id;

        }


        /* ---------------------------------------------
           OLD FLOW
        --------------------------------------------- */

        const editId =
            params.get("edit");


        if (
            editId &&
            editId.trim()
        ) {

            const id =
                editId.trim();

            saveShortId(id);

            return id;

        }


        /* ---------------------------------------------
           SESSION STORAGE
        --------------------------------------------- */

        try {

            const sessionId =
                sessionStorage.getItem(
                    CONFIG.SESSION_KEY
                );

            if (
                sessionId &&
                sessionId.trim()
            ) {

                return sessionId.trim();

            }

        } catch (error) {

            console.warn(
                "SessionStorage unavailable:",
                error
            );

        }


        /* ---------------------------------------------
           LOCAL STORAGE
        --------------------------------------------- */

        try {

            const localId =
                localStorage.getItem(
                    CONFIG.STORAGE_KEY
                );

            if (
                localId &&
                localId.trim()
            ) {

                return localId.trim();

            }

        } catch (error) {

            console.warn(
                "LocalStorage unavailable:",
                error
            );

        }


        return null;

    }


    /* =====================================================
       SAVE SHORT ID
    ====================================================== */

    function saveShortId(
        id
    ) {

        if (!id) {
            return;
        }

        try {

            sessionStorage.setItem(
                CONFIG.SESSION_KEY,
                id
            );

        } catch (error) {

            console.warn(
                "Could not save session ID:",
                error
            );

        }


        try {

            localStorage.setItem(
                CONFIG.STORAGE_KEY,
                id
            );

        } catch (error) {

            console.warn(
                "Could not save local ID:",
                error
            );

        }

    }


    /* =====================================================
       CLEAR SHORT ID
    ====================================================== */

    function clearStoredShortId() {

        try {

            sessionStorage.removeItem(
                CONFIG.SESSION_KEY
            );

        } catch (error) {}


        try {

            localStorage.removeItem(
                CONFIG.STORAGE_KEY
            );

        } catch (error) {}

    }


    /* =====================================================
       AUTH
    ====================================================== */

    auth.onAuthStateChanged(
        user => {

            state.currentUser =
                user || null;

            initializePage();

        }
    );


    /* =====================================================
       INITIALIZE
    ====================================================== */

    async function initializePage() {

        if (state.initialized) {
            return;
        }

        state.initialized = true;

        state.shortId =
            getShortId();


        if (!state.shortId) {

            showUnavailable(
                "This editor needs a Short ID or video URL."
            );

            return;

        }


        await loadShort();

    }


    /* =====================================================
       LOAD SHORT
    ====================================================== */

    async function loadShort() {

        if (
            !state.shortId ||
            state.loading
        ) {
            return;
        }

        state.loading = true;

        setLoadingState(
            true
        );


        try {

            const snapshot =
                await db
                    .ref(
                        `${CONFIG.SHORTS_PATH}/${state.shortId}`
                    )
                    .once("value");


            if (!snapshot.exists()) {

                console.warn(
                    "Short not found:",
                    state.shortId
                );

                showUnavailable(
                    "This Short could not be found."
                );

                return;

            }


            const short =
                snapshot.val();


            if (
                !short ||
                typeof short !== "object"
            ) {

                showUnavailable(
                    "Invalid Short data."
                );

                return;

            }


            state.short =
                short;


            /* -----------------------------------------
               OWNER CHECK
            ------------------------------------------ */

            const ownerId =
                getFirstValue(
                    short,
                    [
                        "uid",
                        "userId",
                        "authorId",
                        "creatorId"
                    ],
                    ""
                );


            if (
                state.currentUser &&
                ownerId &&
                ownerId !==
                state.currentUser.uid
            ) {

                showUnavailable(
                    "You can only edit your own Short."
                );

                return;

            }


            /* -----------------------------------------
               VIDEO
            ------------------------------------------ */

            const videoURL =
                getVideoURL(
                    short
                );


            if (!videoURL) {

                showUnavailable(
                    "This Short does not have a valid video."
                );

                return;

            }


            state.originalVideoURL =
                videoURL;


            /* -----------------------------------------
               POPULATE FORM
            ------------------------------------------ */

            populateForm(
                short
            );


            /* -----------------------------------------
               VIDEO
            ------------------------------------------ */

            loadVideo(
                videoURL
            );


            hideUnavailable();

            updateStatus(
                "Ready to edit"
            );

        } catch (error) {

            console.error(
                "Load Short error:",
                error
            );

            showUnavailable(
                "Unable to load this Short. Tap Retry."
            );

            showToast(
                "Could not load Short",
                "error"
            );

        } finally {

            state.loading =
                false;

            setLoadingState(
                false
            );

        }

    }


    /* =====================================================
       VIDEO URL
    ====================================================== */

    function getVideoURL(
        short
    ) {

        return getFirstValue(
            short,
            [
                "videoURL",
                "videoUrl",
                "video_url",
                "mediaURL",
                "mediaUrl",
                "media_url",
                "video",
                "url",
                "src"
            ],
            ""
        );

    }


    /* =====================================================
       LOAD VIDEO
    ====================================================== */

    function loadVideo(
        url
    ) {

        const video =
            $("shortPreview");

        if (!video || !url) {
            return;
        }


        video.pause();

        video.removeAttribute(
            "src"
        );

        video.load();


        video.src =
            url;


        video.load();


        video.addEventListener(
            "loadedmetadata",
            handleVideoMetadata,
            {
                once: true
            }
        );


        video.addEventListener(
            "error",
            () => {

                console.error(
                    "Video preview failed:",
                    url
                );

                updateStatus(
                    "Video preview unavailable"
                );

            },
            {
                once: true
            }
        );

    }


    /* =====================================================
       VIDEO METADATA
    ====================================================== */

    function handleVideoMetadata() {

        const video =
            $("shortPreview");

        if (!video) {
            return;
        }


        const duration =
            video.duration;


        const durationElement =
            $("previewDuration");


        if (
            durationElement &&
            Number.isFinite(duration)
        ) {

            durationElement.textContent =
                formatDuration(
                    duration
                );

        }


        updateStatus(
            "Ready to edit"
        );

    }


    /* =====================================================
       FORMAT DURATION
    ====================================================== */

    function formatDuration(
        seconds
    ) {

        seconds =
            Math.max(
                0,
                Math.floor(
                    Number(seconds || 0)
                )
            );


        const minutes =
            Math.floor(
                seconds / 60
            );


        const remaining =
            seconds % 60;


        return (
            String(minutes).padStart(
                2,
                "0"
            ) +
            ":" +
            String(remaining).padStart(
                2,
                "0"
            )
        );

    }


    /* =====================================================
       POPULATE FORM
    ====================================================== */

    function populateForm(
        short
    ) {

        /* ---------------------------------------------
           TITLE
        ------------------------------------------ */

        const title =
            getFirstValue(
                short,
                [
                    "title",
                    "shortTitle",
                    "name"
                ],
                ""
            );


        const titleInput =
            $("shortTitle");


        if (titleInput) {

            titleInput.value =
                String(title);

            updateTitleCount();

        }


        /* ---------------------------------------------
           DESCRIPTION
        ------------------------------------------ */

        const description =
            getFirstValue(
                short,
                [
                    "description",
                    "caption",
                    "text"
                ],
                ""
            );


        const descriptionInput =
            $("shortDescription");


        if (descriptionInput) {

            descriptionInput.value =
                String(description);

            updateDescriptionCount();

        }


        /* ---------------------------------------------
           TAGS
        ------------------------------------------ */

        state.selectedTags =
            normalizeTags(
                short.tags ||
                short.hashtags ||
                short.tagList
            );


        renderTags();


        /* ---------------------------------------------
           VISIBILITY
        ------------------------------------------ */

        const visibility =
            getFirstValue(
                short,
                [
                    "visibility",
                    "privacy"
                ],
                "public"
            );


        state.selectedVisibility =
            normalizeVisibility(
                visibility
            );


        updateVisibilityUI();


        /* ---------------------------------------------
           COMMENTS
        ------------------------------------------ */

        const commentsToggle =
            $("commentsToggle");


        if (commentsToggle) {

            commentsToggle.checked =
                normalizeBoolean(
                    getFirstValue(
                        short,
                        [
                            "allowComments",
                            "commentsAllowed",
                            "comments"
                        ],
                        true
                    ),
                    true
                );

        }


        /* ---------------------------------------------
           SHARING
        ------------------------------------------ */

        const sharingToggle =
            $("sharingToggle");


        if (sharingToggle) {

            sharingToggle.checked =
                normalizeBoolean(
                    getFirstValue(
                        short,
                        [
                            "allowSharing",
                            "sharingAllowed",
                            "shareAllowed"
                        ],
                        true
                    ),
                    true
                );

        }


        /* ---------------------------------------------
           REMIX
        ------------------------------------------ */

        const remixToggle =
            $("remixToggle");


        if (remixToggle) {

            remixToggle.checked =
                normalizeBoolean(
                    getFirstValue(
                        short,
                        [
                            "allowRemix",
                            "remixAllowed"
                        ],
                        true
                    ),
                    true
                );

        }


        /* ---------------------------------------------
           ADVANCED
        ------------------------------------------ */

        const likeCountToggle =
            $("likeCountToggle");


        if (likeCountToggle) {

            likeCountToggle.checked =
                normalizeBoolean(
                    getFirstValue(
                        short,
                        [
                            "showLikeCount",
                            "likeCountVisible"
                        ],
                        true
                    ),
                    true
                );

        }


        const viewCountToggle =
            $("viewCountToggle");


        if (viewCountToggle) {

            viewCountToggle.checked =
                normalizeBoolean(
                    getFirstValue(
                        short,
                        [
                            "showViewCount",
                            "viewCountVisible"
                        ],
                        true
                    ),
                    true
                );

        }


        const profileToggle =
            $("profileToggle");


        if (profileToggle) {

            profileToggle.checked =
                normalizeBoolean(
                    getFirstValue(
                        short,
                        [
                            "saveToProfile",
                            "profileVisible"
                        ],
                        true
                    ),
                    true
                );

        }


        /* ---------------------------------------------
           MUSIC
        ------------------------------------------ */

        updateMusicText(
            short
        );


        /* ---------------------------------------------
           COVER
        ------------------------------------------ */

        const cover =
            getFirstValue(
                short,
                [
                    "coverURL",
                    "coverUrl",
                    "thumbnailURL",
                    "thumbnailUrl",
                    "thumbnail",
                    "cover"
                ],
                ""
            );


        if (cover) {

            state.coverURL =
                cover;

            state.coverChanged =
                false;

            setCoverPreview(
                cover
            );

        }


        /* ---------------------------------------------
           COLLABORATION
        ------------------------------------------ */

        const collaborator =
            getFirstValue(
                short,
                [
                    "collaboratorName",
                    "collaboratorUsername"
                ],
                ""
            );


        const collaborationValue =
            $("collaborationValue");


        if (
            collaborationValue &&
            collaborator
        ) {

            collaborationValue.textContent =
                collaborator;

        }

    }


    /* =====================================================
       NORMALIZE TAGS
    ====================================================== */

    function normalizeTags(
        value
    ) {

        if (Array.isArray(value)) {

            return value
                .map(
                    tag =>
                        String(tag)
                            .trim()
                )
                .filter(Boolean);

        }


        if (
            value &&
            typeof value === "object"
        ) {

            return Object.values(value)
                .map(
                    tag =>
                        String(tag)
                            .trim()
                )
                .filter(Boolean);

        }


        if (typeof value === "string") {

            return value
                .split(/[,\s]+/)
                .map(
                    tag =>
                        tag.trim()
                )
                .filter(Boolean);

        }


        return [];

    }


    /* =====================================================
       VISIBILITY
    ====================================================== */

    function normalizeVisibility(
        value
    ) {

        const visibility =
            String(
                value || "public"
            ).toLowerCase();


        if (
            visibility === "followers" ||
            visibility === "friends"
        ) {

            return "followers";

        }


        if (
            visibility === "private"
        ) {

            return "private";

        }


        return "public";

    }


    function updateVisibilityUI() {

        document
            .querySelectorAll(
                ".visibilityOption"
            )
            .forEach(option => {

                option.classList.toggle(
                    "active",
                    option.dataset.visibility ===
                    state.selectedVisibility
                );

            });

    }


    /* =====================================================
       TAGS UI
    ====================================================== */

    function renderTags() {

        const container =
            $("selectedTags");

        if (!container) {
            return;
        }


        container.innerHTML =
            state.selectedTags
                .map(
                    (tag, index) => `

                        <span
                            class="tagChip"
                            data-index="${index}"
                        >

                            <span>
                                ${escapeHTML(tag)}
                            </span>

                            <button
                                type="button"
                                class="removeTag"
                                aria-label="Remove tag"
                            >
                                <i class="fa-solid fa-xmark"></i>
                            </button>

                        </span>

                    `
                )
                .join("");


        container
            .querySelectorAll(
                ".removeTag"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();

                        const chip =
                            button.closest(
                                ".tagChip"
                            );

                        const index =
                            Number(
                                chip?.dataset.index
                            );


                        if (
                            Number.isInteger(index)
                        ) {

                            state.selectedTags
                                .splice(
                                    index,
                                    1
                                );

                            renderTags();

                        }

                    }
                );

            });

    }


    /* =====================================================
       MUSIC
    ====================================================== */

    function updateMusicText(
        short
    ) {

        const music =
            getFirstValue(
                short,
                [
                    "music",
                    "audioName",
                    "musicName",
                    "soundName"
                ],
                "Original sound"
            );


        const musicElement =
            document.querySelector(
                ".shortMusic"
            );


        if (musicElement) {

            const span =
                musicElement.querySelector(
                    "span"
                );

            if (span) {
                span.textContent =
                    music;
            }

        }

    }


    /* =====================================================
       COVER
    ====================================================== */

    function setCoverPreview(
        url
    ) {

        const preview =
            $("coverPreview");

        const image =
            $("coverImage");

        const value =
            $("coverValue");


        if (
            !preview ||
            !image
        ) {
            return;
        }


        image.src =
            url;


        preview.classList.remove(
            "hidden"
        );


        if (value) {

            value.textContent =
                "Custom cover selected";

        }

    }


    /* =====================================================
       USE CURRENT VIDEO FRAME
    ====================================================== */

    function useCurrentFrame() {

        const video =
            $("shortPreview");

        if (
            !video ||
            !video.videoWidth ||
            !video.videoHeight
        ) {

            showToast(
                "Video frame is not ready",
                "error"
            );

            return;

        }


        try {

            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                video.videoWidth;

            canvas.height =
                video.videoHeight;


            const context =
                canvas.getContext(
                    "2d"
                );


            context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );


            const dataURL =
                canvas.toDataURL(
                    "image/jpeg",
                    0.88
                );


            state.coverURL =
                dataURL;

            state.coverChanged =
                true;


            setCoverPreview(
                dataURL
            );


            closeSheet(
                "coverSheet"
            );


            showToast(
                "Current frame selected"
            );

        } catch (error) {

            console.error(
                "Cover frame error:",
                error
            );

            showToast(
                "Could not create cover",
                "error"
            );

        }

    }


    /* =====================================================
       COVER FILE
    ====================================================== */

    function handleCoverFile(
        file
    ) {

        if (!file) {
            return;
        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            showToast(
                "Please select an image",
                "error"
            );

            return;

        }


        if (
            file.size >
            10 * 1024 * 1024
        ) {

            showToast(
                "Cover image must be under 10 MB",
                "error"
            );

            return;

        }


        if (
            state.coverObjectURL
        ) {

            URL.revokeObjectURL(
                state.coverObjectURL
            );

        }


        const objectURL =
            URL.createObjectURL(
                file
            );


        state.coverObjectURL =
            objectURL;


        state.coverFile =
            file;


        state.coverChanged =
            true;


        setCoverPreview(
            objectURL
        );


        closeSheet(
            "coverSheet"
        );


        showToast(
            "Cover selected"
        );

    }


    /* =====================================================
       SHEETS
    ====================================================== */

    function openSheet(
        id
    ) {

        const sheet =
            $(id);

        if (!sheet) {
            return;
        }

        sheet.classList.remove(
            "hidden"
        );

        document.body.classList.add(
            "modalOpen"
        );

    }


    function closeSheet(
        id
    ) {

        const sheet =
            $(id);

        if (!sheet) {
            return;
        }

        sheet.classList.add(
            "hidden"
        );

        if (
            !document.querySelector(
                ".overlay:not(.hidden)"
            )
        ) {

            document.body.classList.remove(
                "modalOpen"
            );

        }

    }


    /* =====================================================
       SAVE COVER TO STORAGE / CLOUDINARY
       OPTIONAL
    ====================================================== */

    async function uploadCoverIfNeeded() {

        if (
            !state.coverChanged ||
            !state.coverFile
        ) {

            return state.coverURL || "";

        }


        const file =
            state.coverFile;


        /* ---------------------------------------------
           CLOUDINARY SUPPORT
        ------------------------------------------ */

        try {

            if (
                typeof window.uploadToCloudinary ===
                "function"
            ) {

                const result =
                    await window.uploadToCloudinary(
                        file
                    );


                if (
                    typeof result === "string"
                ) {

                    return result;

                }


                if (result?.secure_url) {

                    return result.secure_url;

                }


                if (result?.url) {

                    return result.url;

                }

            }

        } catch (error) {

            console.warn(
                "Cloudinary cover upload failed:",
                error
            );

        }


        /* ---------------------------------------------
           FIREBASE STORAGE FALLBACK
        ------------------------------------------ */

        try {

            if (
                firebase.storage &&
                firebase.storage()
            ) {

                const path =
                    `shorts/${state.shortId}/cover_${Date.now()}`;

                const ref =
                    firebase
                        .storage()
                        .ref(path);


                const snapshot =
                    await ref.put(
                        file
                    );


                return await snapshot.ref
                    .getDownloadURL();

            }

        } catch (error) {

            console.warn(
                "Firebase cover upload failed:",
                error
            );

        }


        return state.coverURL || "";

    }


    /* =====================================================
       SAVE DATA
    ====================================================== */

    function collectFormData() {

        const title =
            $("shortTitle")
                ?.value
                ?.trim() || "";


        const description =
            $("shortDescription")
                ?.value
                ?.trim() || "";


        const comments =
            $("commentsToggle")
                ?.checked !== false;


        const sharing =
            $("sharingToggle")
                ?.checked !== false;


        const remix =
            $("remixToggle")
                ?.checked !== false;


        const showLikeCount =
            $("likeCountToggle")
                ?.checked !== false;


        const showViewCount =
            $("viewCountToggle")
                ?.checked !== false;


        const saveToProfile =
            $("profileToggle")
                ?.checked !== false;


        return {

            title,

            description,

            caption:
                description,

            tags:
                [...state.selectedTags],

            visibility:
                state.selectedVisibility,

            allowComments:
                comments,

            commentsAllowed:
                comments,

            allowSharing:
                sharing,

            sharingAllowed:
                sharing,

            allowRemix:
                remix,

            remixAllowed:
                remix,

            showLikeCount,

            showViewCount,

            saveToProfile,

            updatedAt:
                firebase.database.ServerValue.TIMESTAMP

        };

    }


    /* =====================================================
       VALIDATE
    ====================================================== */

    function validateForm(
        data
    ) {

        if (!data.title) {

            showToast(
                "Please add a title",
                "error"
            );

            $("shortTitle")
                ?.focus();

            return false;

        }


        if (
            data.title.length >
            CONFIG.MAX_TITLE
        ) {

            showToast(
                "Title is too long",
                "error"
            );

            return false;

        }


        if (
            data.description.length >
            CONFIG.MAX_DESCRIPTION
        ) {

            showToast(
                "Description is too long",
                "error"
            );

            return false;

        }


        return true;

    }


    /* =====================================================
       UPDATE SHORT
    ====================================================== */

    async function saveChanges(
        mode = "publish"
    ) {

        if (
            !state.shortId ||
            state.saving
        ) {
            return;
        }


        const data =
            collectFormData();


        if (
            !validateForm(
                data
            )
        ) {
            return;
        }


        state.saving =
            true;


        const publishButton =
            $("publishBtn");


        const draftButton =
            $("saveDraftBtn");


        if (publishButton) {
            publishButton.disabled =
                true;
        }


        if (draftButton) {
            draftButton.disabled =
                true;
        }


        showProcessing(
            mode === "draft"
                ? "Saving your draft"
                : "Saving your Short",
            "Updating Short details..."
        );


        try {

            /* -----------------------------------------
               COVER
            ------------------------------------------ */

            const coverURL =
                await uploadCoverIfNeeded();


            if (coverURL) {

                data.coverURL =
                    coverURL;

                data.coverUrl =
                    coverURL;

                data.thumbnailURL =
                    coverURL;

            }


            /* -----------------------------------------
               KEEP VIDEO URL
            ------------------------------------------ */

            if (
                state.originalVideoURL
            ) {

                data.videoURL =
                    state.originalVideoURL;

            }


            /* -----------------------------------------
               DRAFT / PUBLISHED STATUS
            ------------------------------------------ */

            if (
                mode === "draft"
            ) {

                data.status =
                    "draft";

                data.isDraft =
                    true;

            } else {

                data.status =
                    "published";

                data.isDraft =
                    false;

            }


            /* -----------------------------------------
               UPDATE FIREBASE
            ------------------------------------------ */

            await db
                .ref(
                    `${CONFIG.SHORTS_PATH}/${state.shortId}`
                )
                .update(
                    data
                );


            /* -----------------------------------------
               UPDATE LOCAL STATE
            ------------------------------------------ */

            state.short =
                {
                    ...state.short,
                    ...data
                };


            state.coverURL =
                coverURL ||
                state.coverURL;


            updateStatus(
                mode === "draft"
                    ? "Draft saved"
                    : "Changes saved"
            );


            showToast(
                mode === "draft"
                    ? "Draft saved successfully"
                    : "Short updated successfully"
            );


            /* -----------------------------------------
               RETURN TO SHORTS
            ------------------------------------------ */

            setTimeout(() => {

                const params =
                    new URLSearchParams(
                        window.location.search
                    );


                const from =
                    params.get(
                        "from"
                    );


                if (from) {

                    window.location.href =
                        from;

                    return;

                }


                window.location.href =
                    `shorts.html?short=${encodeURIComponent(
                        state.shortId
                    )}`;

            }, 800);

        } catch (error) {

            console.error(
                "Save Short error:",
                error
            );

            showToast(
                "Could not save changes",
                "error"
            );

        } finally {

            state.saving =
                false;

            hideProcessing();


            if (publishButton) {
                publishButton.disabled =
                    false;
            }


            if (draftButton) {
                draftButton.disabled =
                    false;
            }

        }

    }


    /* =====================================================
       COUNTERS
    ====================================================== */

    function updateTitleCount() {

        const input =
            $("shortTitle");

        const counter =
            $("titleCount");

        if (
            !input ||
            !counter
        ) {
            return;
        }

        counter.textContent =
            `${input.value.length}/${CONFIG.MAX_TITLE}`;

    }


    function updateDescriptionCount() {

        const input =
            $("shortDescription");

        const counter =
            $("descriptionCount");

        if (
            !input ||
            !counter
        ) {
            return;
        }

        counter.textContent =
            `${input.value.length}/${CONFIG.MAX_DESCRIPTION}`;

    }


    /* =====================================================
       STATUS
    ====================================================== */

    function updateStatus(
        text
    ) {

        const status =
            $("previewStatus");

        if (status) {
            status.textContent =
                text;
        }

    }


    /* =====================================================
       UNAVAILABLE
    ====================================================== */

    function showUnavailable(
        message
    ) {

        const fallback =
            $("previewFallback");


        const video =
            $("shortPreview");


        if (video) {

            video.pause();

            video.removeAttribute(
                "src"
            );

            video.load();

        }


        if (fallback) {

            fallback.classList.remove(
                "hidden"
            );


            const span =
                fallback.querySelector(
                    "span"
                );


            if (span) {
                span.textContent =
                    message ||
                    "Preview unavailable";
            }

        }


        updateStatus(
            "Short unavailable"
        );

    }


    function hideUnavailable() {

        const fallback =
            $("previewFallback");

        if (fallback) {

            fallback.classList.add(
                "hidden"
            );

        }

    }


    /* =====================================================
       LOADING STATE
    ====================================================== */

    function setLoadingState(
        loading
    ) {

        const status =
            $("previewStatus");

        if (!status) {
            return;
        }


        status.textContent =
            loading
                ? "Loading Short..."
                : status.textContent;

    }


    /* =====================================================
       RETRY
    ====================================================== */

    async function retryLoad() {

        if (state.retrying) {
            return;
        }

        state.retrying =
            true;


        const button =
            $("retryBtn");


        if (button) {
            button.disabled =
                true;
        }


        try {

            state.shortId =
                getShortId();


            if (!state.shortId) {

                showUnavailable(
                    "Short ID is missing."
                );

                return;

            }


            await loadShort();

        } finally {

            state.retrying =
                false;


            if (button) {
                button.disabled =
                    false;
            }

        }

    }


    /* =====================================================
       PREVIEW
    ====================================================== */

    function togglePreview() {

        const video =
            $("shortPreview");

        if (!video) {
            return;
        }


        if (
            video.paused
        ) {

            video.play()
                .then(() => {

                    updatePreviewPlayIcon(
                        true
                    );

                })
                .catch(() => {

                    showToast(
                        "Could not play preview",
                        "error"
                    );

                });

        } else {

            video.pause();

            updatePreviewPlayIcon(
                false
            );

        }

    }


    function updatePreviewPlayIcon(
        playing
    ) {

        const button =
            $("previewPlayBtn");

        if (!button) {
            return;
        }


        const icon =
            button.querySelector(
                "i"
            );


        if (icon) {

            icon.className =
                playing
                    ? "fa-solid fa-pause"
                    : "fa-solid fa-play";

        }

    }


    /* =====================================================
       GLOBAL EVENTS
    ====================================================== */

    function setupEvents() {

        /* ---------------------------------------------
           BACK
        ------------------------------------------ */

        $("backBtn")
            ?.addEventListener(
                "click",
                () => {

                    if (
                        window.history.length >
                        1
                    ) {

                        window.history.back();

                    } else {

                        window.location.href =
                            "shorts.html";

                    }

                }
            );


        /* ---------------------------------------------
           RETRY
        ------------------------------------------ */

        $("retryBtn")
            ?.addEventListener(
                "click",
                retryLoad
            );


        /* ---------------------------------------------
           PREVIEW
        ------------------------------------------ */

        $("previewPlayBtn")
            ?.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    togglePreview();

                }
            );


        $("previewBtn")
            ?.addEventListener(
                "click",
                togglePreview
            );


        $("shortPreview")
            ?.addEventListener(
                "click",
                togglePreview
            );


        $("shortPreview")
            ?.addEventListener(
                "play",
                () => {

                    updatePreviewPlayIcon(
                        true
                    );

                }
            );


        $("shortPreview")
            ?.addEventListener(
                "pause",
                () => {

                    updatePreviewPlayIcon(
                        false
                    );

                }
            );


        /* ---------------------------------------------
           COUNTERS
        ------------------------------------------ */

        $("shortTitle")
            ?.addEventListener(
                "input",
                updateTitleCount
            );


        $("shortDescription")
            ?.addEventListener(
                "input",
                updateDescriptionCount
            );


        /* ---------------------------------------------
           TAG INPUT
        ------------------------------------------ */

        $("tagInput")
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter" ||
                        event.key === ","
                    ) {

                        event.preventDefault();

                        addTag(
                            event.target.value
                        );

                    }

                }
            );


        /* ---------------------------------------------
           VISIBILITY
        ------------------------------------------ */

        document
            .querySelectorAll(
                ".visibilityOption"
            )
            .forEach(option => {

                option.addEventListener(
                    "click",
                    () => {

                        state.selectedVisibility =
                            normalizeVisibility(
                                option.dataset.visibility
                            );

                        updateVisibilityUI();

                    }
                );

            });


        /* ---------------------------------------------
           COVER
        ------------------------------------------ */

        $("coverBtn")
            ?.addEventListener(
                "click",
                () => {

                    openSheet(
                        "coverSheet"
                    );

                }
            );


        $("closeCoverBtn")
            ?.addEventListener(
                "click",
                () => {

                    closeSheet(
                        "coverSheet"
                    );

                }
            );


        $("useCurrentFrameBtn")
            ?.addEventListener(
                "click",
                useCurrentFrame
            );


        $("chooseCoverBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("coverInput")
                        ?.click();

                }
            );


        $("coverInput")
            ?.addEventListener(
                "change",
                event => {

                    const file =
                        event.target.files?.[0];

                    handleCoverFile(
                        file
                    );

                }
            );


        /* ---------------------------------------------
           ADVANCED
        ------------------------------------------ */

        $("advancedBtn")
            ?.addEventListener(
                "click",
                () => {

                    openSheet(
                        "advancedSheet"
                    );

                }
            );


        $("closeAdvancedBtn")
            ?.addEventListener(
                "click",
                () => {

                    closeSheet(
                        "advancedSheet"
                    );

                }
            );


        /* ---------------------------------------------
           COLLABORATION
        ------------------------------------------ */

        $("collaborationBtn")
            ?.addEventListener(
                "click",
                () => {

                    openSheet(
                        "collaborationSheet"
                    );

                }
            );


        $("closeCollaborationBtn")
            ?.addEventListener(
                "click",
                () => {

                    closeSheet(
                        "collaborationSheet"
                    );

                }
            );


        /* ---------------------------------------------
           OVERLAY BACKDROPS
        ------------------------------------------ */

        document
            .querySelectorAll(
                ".overlayBackdrop"
            )
            .forEach(backdrop => {

                backdrop.addEventListener(
                    "click",
                    () => {

                        const overlay =
                            backdrop.closest(
                                ".overlay"
                            );

                        if (overlay) {

                            overlay.classList.add(
                                "hidden"
                            );

                        }

                        if (
                            !document.querySelector(
                                ".overlay:not(.hidden)"
                            )
                        ) {

                            document.body.classList.remove(
                                "modalOpen"
                            );

                        }

                    }
                );

            });


        /* ---------------------------------------------
           SAVE DRAFT
        ------------------------------------------ */

        $("saveDraftBtn")
            ?.addEventListener(
                "click",
                () => {

                    saveChanges(
                        "draft"
                    );

                }
            );


        /* ---------------------------------------------
           POST / SAVE
        ------------------------------------------ */

        $("publishBtn")
            ?.addEventListener(
                "click",
                () => {

                    saveChanges(
                        "publish"
                    );

                }
            );


        /* ---------------------------------------------
           ESCAPE
        ------------------------------------------ */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }


                document
                    .querySelectorAll(
                        ".overlay:not(.hidden)"
                    )
                    .forEach(
                        overlay => {

                            overlay.classList.add(
                                "hidden"
                            );

                        }
                    );


                document.body.classList.remove(
                    "modalOpen"
                );

            }
        );

    }


    /* =====================================================
       ADD TAG
    ====================================================== */

    function addTag(
        value
    ) {

        let tag =
            String(
                value || ""
            )
            .trim()
            .replace(/^#+/, "");


        if (!tag) {
            return;
        }


        if (
            tag.length >
            30
        ) {

            tag =
                tag.substring(
                    0,
                    30
                );

        }


        const exists =
            state.selectedTags.some(
                existing =>
                    existing.toLowerCase() ===
                    tag.toLowerCase()
            );


        if (exists) {

            $("tagInput").value =
                "";

            return;

        }


        if (
            state.selectedTags.length >=
            20
        ) {

            showToast(
                "Maximum 20 tags",
                "error"
            );

            return;

        }


        state.selectedTags.push(
            tag
        );


        $("tagInput").value =
            "";


        renderTags();

    }


    /* =====================================================
       PAGE VISIBILITY
    ====================================================== */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.hidden
            ) {

                $("shortPreview")
                    ?.pause();

            }

        }
    );


    /* =====================================================
       INIT
    ====================================================== */

    setupEvents();

})();