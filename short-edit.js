/* ==========================================================
   VIEWORA — SHORT EDIT DETAILS
   short-edit.js
   PREMIUM • PRODUCTION READY

   Features:
   • Short ID detection / recovery
   • Firebase Auth
   • Firebase Realtime Database
   • Short preview
   • Title
   • Description
   • Hashtags
   • Mentions
   • Tags
   • Collaboration
   • Visibility
   • Cover
   • Comments
   • Sharing
   • Remix
   • Advanced settings
   • Save Draft
   • Post Short
   • URL fallback
   • Local/session storage fallback
========================================================== */

"use strict";

(() => {

    /* ======================================================
       PREVENT DOUBLE INITIALIZATION
    ====================================================== */

    if (window.__VIEWORA_SHORT_EDIT_INITIALIZED__) {
        console.warn("VIEWORA short-edit.js already initialized.");
        return;
    }

    window.__VIEWORA_SHORT_EDIT_INITIALIZED__ = true;


    /* ======================================================
       GLOBAL STATE
    ====================================================== */

    let db = null;
    let auth = null;
    let currentUser = null;

    let shortId = null;
    let shortData = null;

    let selectedTags = [];
    let selectedCollaborator = null;

    let selectedVisibility = "public";

    let coverUrl = "";
    let originalCoverUrl = "";

    let saving = false;
    let publishing = false;

    let previewObjectUrl = null;


    /* ======================================================
       DOM HELPER
    ====================================================== */

    const $ = (id) => document.getElementById(id);

    const $$ = (selector) =>
        Array.from(document.querySelectorAll(selector));


    /* ======================================================
       BASIC DOM
    ====================================================== */

    const backBtn = $("backBtn");
    const previewBtn = $("previewBtn");

    const shortPreview = $("shortPreview");
    const previewFallback = $("previewFallback");
    const previewPlayBtn = $("previewPlayBtn");
    const previewDuration = $("previewDuration");
    const previewStatus = $("previewStatus");

    const shortTitle = $("shortTitle");
    const shortDescription = $("shortDescription");

    const titleCount = $("titleCount");
    const descriptionCount = $("descriptionCount");

    const tagInput = $("tagInput");
    const selectedTagsEl = $("selectedTags");

    const commentsToggle = $("commentsToggle");
    const sharingToggle = $("sharingToggle");
    const remixToggle = $("remixToggle");

    const collaborationBtn = $("collaborationBtn");
    const collaborationValue = $("collaborationValue");

    const coverBtn = $("coverBtn");
    const coverValue = $("coverValue");
    const coverPreview = $("coverPreview");
    const coverImage = $("coverImage");

    const advancedBtn = $("advancedBtn");

    const likeCountToggle = $("likeCountToggle");
    const viewCountToggle = $("viewCountToggle");
    const profileToggle = $("profileToggle");

    const saveDraftBtn = $("saveDraftBtn");
    const publishBtn = $("publishBtn");
    const publishButtonText = $("publishButtonText");

    const processingOverlay = $("processingOverlay");
    const processingTitle = $("processingTitle");
    const processingText = $("processingText");

    const toast = $("toast");
    const toastIconElement = $("toastIconElement");
    const toastTitle = $("toastTitle");
    const toastText = $("toastText");

    const collaborationSheet = $("collaborationSheet");
    const collaborationSearch = $("collaborationSearch");
    const collaborationList = $("collaborationList");
    const closeCollaborationBtn = $("closeCollaborationBtn");

    const coverSheet = $("coverSheet");
    const closeCoverBtn = $("closeCoverBtn");
    const chooseCoverBtn = $("chooseCoverBtn");
    const useCurrentFrameBtn = $("useCurrentFrameBtn");
    const coverInput = $("coverInput");

    const advancedSheet = $("advancedSheet");
    const closeAdvancedBtn = $("closeAdvancedBtn");

    const useCurrentFrameButton = $("useCurrentFrameBtn");


    /* ======================================================
       SAFE TEXT
    ====================================================== */

    function safeString(value, fallback = "") {
        if (
            value === undefined ||
            value === null
        ) {
            return fallback;
        }

        return String(value);
    }


    /* ======================================================
       TIME FORMAT
    ====================================================== */

    function formatTime(seconds) {

        seconds = Number(seconds);

        if (!Number.isFinite(seconds) || seconds < 0) {
            seconds = 0;
        }

        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(secs).padStart(2, "0")
        );
    }


    /* ======================================================
       TOAST
    ====================================================== */

    let toastTimer = null;

    function showToast(
        title,
        message,
        type = "success"
    ) {

        if (!toast) return;

        clearTimeout(toastTimer);

        if (toastTitle) {
            toastTitle.textContent = title;
        }

        if (toastText) {
            toastText.textContent = message;
        }

        if (toastIconElement) {

            toastIconElement.className =
                type === "error"
                    ? "fa-solid fa-circle-exclamation"
                    : type === "warning"
                        ? "fa-solid fa-triangle-exclamation"
                        : "fa-solid fa-circle-check";
        }

        toast.classList.remove("hidden");

        toastTimer = setTimeout(() => {

            toast.classList.add("hidden");

        }, 3200);
    }


    /* ======================================================
       PROCESSING UI
    ====================================================== */

    function showProcessing(
        title,
        message
    ) {

        if (processingTitle) {
            processingTitle.textContent = title;
        }

        if (processingText) {
            processingText.textContent = message;
        }

        processingOverlay?.classList.remove("hidden");
    }


    function hideProcessing() {

        processingOverlay?.classList.add("hidden");
    }


    /* ======================================================
       FIREBASE DETECTION
    ====================================================== */

    function initializeFirebase() {

        try {

            if (
                typeof firebase === "undefined"
            ) {
                console.error("Firebase SDK unavailable.");
                return false;
            }


            if (
                window.VIEWORA_FIREBASE &&
                window.VIEWORA_FIREBASE.database
            ) {

                db = window.VIEWORA_FIREBASE.database;

                auth =
                    window.VIEWORA_FIREBASE.auth ||
                    firebase.auth();

                return true;
            }


            if (
                typeof firebase.database === "function"
            ) {
                db = firebase.database();
            }


            if (
                typeof firebase.auth === "function"
            ) {
                auth = firebase.auth();
            }


            return !!db;

        } catch (error) {

            console.error(
                "Firebase initialization error:",
                error
            );

            return false;
        }
    }


    /* ======================================================
       URL PARAM HELPERS
    ====================================================== */

    function getQueryParams() {

        const params = new URLSearchParams(
            window.location.search
        );

        const result = {};

        params.forEach((value, key) => {

            result[key.toLowerCase()] = value;

        });

        return result;
    }


    /* ======================================================
       SHORT ID EXTRACTION
    ====================================================== */

    function detectShortId() {

        const params = getQueryParams();


        /* -----------------------------------------------
           MOST COMMON PARAMS
        ------------------------------------------------ */

        const candidates = [

            params.shortid,
            params.short_id,
            params.short,
            params.id,
            params.videoid,
            params.video_id,
            params.postid,
            params.post_id,

            /* Exact URLSearchParams lookup */
            new URLSearchParams(
                window.location.search
            ).get("shortId"),

            new URLSearchParams(
                window.location.search
            ).get("shortID"),

            new URLSearchParams(
                window.location.search
            ).get("videoId"),

            new URLSearchParams(
                window.location.search
            ).get("postId")
        ];


        /* -----------------------------------------------
           HASH
        ------------------------------------------------ */

        if (window.location.hash) {

            const hash = window.location.hash
                .replace(/^#/, "")
                .trim();

            if (hash) {

                try {

                    const hashParams =
                        new URLSearchParams(hash);

                    candidates.push(
                        hashParams.get("shortId")
                    );

                    candidates.push(
                        hashParams.get("id")
                    );

                } catch (_) {}
            }
        }


        /* -----------------------------------------------
           STORAGE
        ------------------------------------------------ */

        const storageKeys = [

            "vieworaShortId",
            "shortId",
            "shortID",
            "currentShortId",
            "editingShortId",
            "selectedShortId",
            "vieworaEditingShortId",
            "editShortId"
        ];


        for (const key of storageKeys) {

            try {

                const localValue =
                    localStorage.getItem(key);

                if (localValue) {
                    candidates.push(localValue);
                }

            } catch (_) {}


            try {

                const sessionValue =
                    sessionStorage.getItem(key);

                if (sessionValue) {
                    candidates.push(sessionValue);
                }

            } catch (_) {}
        }


        /* -----------------------------------------------
           REFERRER URL
        ------------------------------------------------ */

        if (document.referrer) {

            try {

                const refUrl =
                    new URL(document.referrer);

                const refParams =
                    new URLSearchParams(
                        refUrl.search
                    );

                candidates.push(
                    refParams.get("shortId")
                );

                candidates.push(
                    refParams.get("shortID")
                );

                candidates.push(
                    refParams.get("id")
                );

            } catch (_) {}
        }


        /* -----------------------------------------------
           CLEAN + VALIDATE
        ------------------------------------------------ */

        for (const candidate of candidates) {

            if (
                candidate === undefined ||
                candidate === null
            ) {
                continue;
            }

            const value =
                String(candidate).trim();

            if (!value) continue;

            if (
                value === "null" ||
                value === "undefined" ||
                value === "NaN"
            ) {
                continue;
            }

            return value;
        }


        return null;
    }


    /* ======================================================
       STORE SHORT ID
    ====================================================== */

    function persistShortId(id) {

        if (!id) return;

        const value = String(id);

        const keys = [

            "vieworaShortId",
            "shortId",
            "currentShortId",
            "editingShortId",
            "vieworaEditingShortId",
            "editShortId"
        ];

        keys.forEach((key) => {

            try {
                sessionStorage.setItem(
                    key,
                    value
                );
            } catch (_) {}

        });


        try {

            localStorage.setItem(
                "vieworaShortId",
                value
            );

        } catch (_) {}
    }


    /* ======================================================
       UPDATE URL
    ====================================================== */

    function normalizeUrlWithShortId(id) {

        if (!id) return;

        try {

            const url =
                new URL(
                    window.location.href
                );

            url.searchParams.set(
                "shortId",
                id
            );

            window.history.replaceState(
                {},
                "",
                url.toString()
            );

        } catch (_) {}
    }


    /* ======================================================
       FIND SHORT ID FROM FIREBASE PATH
    ====================================================== */

    async function findShortFromDatabase() {

        if (!db || !currentUser) {
            return null;
        }

        const uid = currentUser.uid;


        const paths = [

            `shorts/${shortId}`,

            `users/${uid}/shorts/${shortId}`,

            `users/${uid}/shortVideos/${shortId}`,

            `users/${uid}/videos/${shortId}`,

            `posts/${shortId}`,

            `videos/${shortId}`

        ];


        for (const path of paths) {

            try {

                const snapshot =
                    await db.ref(path).once("value");

                if (snapshot.exists()) {

                    const data =
                        snapshot.val();

                    return {
                        path,
                        data
                    };
                }

            } catch (error) {

                console.warn(
                    "Short lookup failed:",
                    path,
                    error
                );
            }
        }


        return null;
    }


    /* ======================================================
       LOAD SHORT
    ====================================================== */

    async function loadShort() {

        if (!shortId) {

            showNoShort(
                "Short ID missing. Please open Edit from your Short."
            );

            return false;
        }


        if (!db) {

            showNoShort(
                "Database is not available."
            );

            return false;
        }


        try {

            setStatus(
                "Loading Short..."
            );


            const result =
                await findShortFromDatabase();


            if (!result) {

                showNoShort(
                    "This Short could not be found."
                );

                return false;
            }


            shortData = {
                ...(result.data || {}),
                __dbPath: result.path
            };


            /* ------------------------------------------
               Confirm / recover ID
            ------------------------------------------ */

            if (
                shortData.id &&
                !shortId
            ) {
                shortId = String(
                    shortData.id
                );
            }


            persistShortId(shortId);
            normalizeUrlWithShortId(shortId);


            applyShortData(shortData);


            setStatus(
                "Ready to edit"
            );


            return true;

        } catch (error) {

            console.error(
                "loadShort error:",
                error
            );

            showNoShort(
                "Unable to load this Short."
            );

            return false;
        }
    }


    /* ======================================================
       APPLY SHORT DATA
    ====================================================== */

    function applyShortData(data) {

        if (!data) return;


        /* -----------------------------------------------
           TITLE
        ------------------------------------------------ */

        const title =
            data.title ??
            data.name ??
            data.shortTitle ??
            "";

        if (shortTitle) {
            shortTitle.value =
                safeString(title);
        }


        /* -----------------------------------------------
           DESCRIPTION
        ------------------------------------------------ */

        const description =
            data.description ??
            data.caption ??
            data.shortDescription ??
            "";

        if (shortDescription) {
            shortDescription.value =
                safeString(description);
        }


        /* -----------------------------------------------
           TAGS
        ------------------------------------------------ */

        let tags =
            data.tags ??
            data.hashtags ??
            [];

        if (typeof tags === "string") {

            tags =
                tags
                    .split(/[,\s]+/)
                    .map(v =>
                        v.trim()
                    )
                    .filter(Boolean);
        }

        if (!Array.isArray(tags)) {
            tags = [];
        }

        selectedTags =
            [...new Set(
                tags
                    .map(tag =>
                        safeString(tag)
                            .replace(/^#/, "")
                            .trim()
                    )
                    .filter(Boolean)
            )];


        renderTags();


        /* -----------------------------------------------
           VISIBILITY
        ------------------------------------------------ */

        selectedVisibility =
            data.visibility ||
            data.privacy ||
            "public";

        if (
            ![
                "public",
                "followers",
                "private"
            ].includes(selectedVisibility)
        ) {
            selectedVisibility = "public";
        }

        updateVisibilityUI();


        /* -----------------------------------------------
           COLLABORATOR
        ------------------------------------------------ */

        const collaborator =
            data.collaborator ||
            data.collaboration ||
            data.collaboratorId ||
            null;

        if (collaborator) {

            if (
                typeof collaborator === "object"
            ) {

                selectedCollaborator =
                    collaborator;

            } else {

                selectedCollaborator = {
                    uid: String(
                        collaborator
                    )
                };
            }

        }


        updateCollaborationUI();


        /* -----------------------------------------------
           COMMENTS
        ------------------------------------------------ */

        if (commentsToggle) {

            commentsToggle.checked =
                data.allowComments !== false &&
                data.commentsEnabled !== false;
        }


        /* -----------------------------------------------
           SHARING
        ------------------------------------------------ */

        if (sharingToggle) {

            sharingToggle.checked =
                data.allowSharing !== false &&
                data.sharingEnabled !== false;
        }


        /* -----------------------------------------------
           REMIX
        ------------------------------------------------ */

        if (remixToggle) {

            remixToggle.checked =
                data.allowRemix !== false &&
                data.remixEnabled !== false;
        }


        /* -----------------------------------------------
           ADVANCED
        ------------------------------------------------ */

        if (likeCountToggle) {

            likeCountToggle.checked =
                data.showLikeCount !== false;
        }


        if (viewCountToggle) {

            viewCountToggle.checked =
                data.showViewCount !== false;
        }


        if (profileToggle) {

            profileToggle.checked =
                data.saveToProfile !== false;
        }


        /* -----------------------------------------------
           COVER
        ------------------------------------------------ */

        coverUrl =
            data.coverUrl ||
            data.cover ||
            data.thumbnail ||
            data.thumbnailUrl ||
            "";

        originalCoverUrl = coverUrl;

        updateCoverUI();


        /* -----------------------------------------------
           VIDEO
        ------------------------------------------------ */

        const videoUrl =
            data.videoUrl ||
            data.videoURL ||
            data.mediaUrl ||
            data.mediaURL ||
            data.url ||
            data.video ||
            "";

        if (videoUrl) {

            loadVideo(
                videoUrl
            );

        } else {

            showPreviewFallback(
                "Video URL unavailable."
            );
        }


        updateCounters();
    }


    /* ======================================================
       STATUS
    ====================================================== */

    function setStatus(text) {

        if (previewStatus) {
            previewStatus.textContent =
                text;
        }
    }


    /* ======================================================
       NO SHORT
    ====================================================== */

    function showNoShort(message) {

        setStatus(
            "Short unavailable"
        );

        if (previewFallback) {

            previewFallback.classList.remove(
                "hidden"
            );

            const span =
                previewFallback.querySelector(
                    "span"
                );

            if (span) {
                span.textContent =
                    message;
            }
        }

        if (shortPreview) {
            shortPreview.classList.add(
                "hidden"
            );
        }
    }


    /* ======================================================
       VIDEO
    ====================================================== */

    function loadVideo(url) {

        if (!shortPreview || !url) {
            return;
        }


        shortPreview.classList.remove(
            "hidden"
        );

        previewFallback?.classList.add(
            "hidden"
        );


        if (previewObjectUrl) {

            try {
                URL.revokeObjectURL(
                    previewObjectUrl
                );
            } catch (_) {}

            previewObjectUrl = null;
        }


        shortPreview.src =
            String(url);

        shortPreview.load();


        setStatus(
            "Video ready"
        );
    }


    /* ======================================================
       VIDEO EVENTS
    ====================================================== */

    function setupVideoEvents() {

        if (!shortPreview) return;


        shortPreview.addEventListener(
            "loadedmetadata",
            () => {

                if (previewDuration) {

                    previewDuration.textContent =
                        formatTime(
                            shortPreview.duration
                        );
                }

                if (
                    shortPreview.duration &&
                    $("coverValue") &&
                    !coverUrl
                ) {

                    $("coverValue").textContent =
                        "Choose a thumbnail";
                }
            }
        );


        shortPreview.addEventListener(
            "play",
            () => {

                if (previewPlayBtn) {

                    const icon =
                        previewPlayBtn.querySelector(
                            "i"
                        );

                    if (icon) {

                        icon.className =
                            "fa-solid fa-pause";
                    }
                }
            }
        );


        shortPreview.addEventListener(
            "pause",
            () => {

                if (previewPlayBtn) {

                    const icon =
                        previewPlayBtn.querySelector(
                            "i"
                        );

                    if (icon) {

                        icon.className =
                            "fa-solid fa-play";
                    }
                }
            }
        );


        shortPreview.addEventListener(
            "error",
            () => {

                showPreviewFallback(
                    "Unable to load video preview."
                );
            }
        );
    }


    function showPreviewFallback(message) {

        shortPreview?.classList.add(
            "hidden"
        );

        previewFallback?.classList.remove(
            "hidden"
        );

        const span =
            previewFallback?.querySelector(
                "span"
            );

        if (span) {
            span.textContent =
                message;
        }
    }


    /* ======================================================
       PREVIEW PLAY
    ====================================================== */

    function togglePreview() {

        if (!shortPreview) return;

        if (
            shortPreview.paused
        ) {

            shortPreview.play()
                .catch(() => {});

        } else {

            shortPreview.pause();
        }
    }


    /* ======================================================
       COUNTERS
    ====================================================== */

    function updateCounters() {

        if (shortTitle && titleCount) {

            titleCount.textContent =
                `${shortTitle.value.length}/100`;
        }


        if (
            shortDescription &&
            descriptionCount
        ) {

            descriptionCount.textContent =
                `${shortDescription.value.length}/5000`;
        }
    }


    /* ======================================================
       TAGS
    ====================================================== */

    function renderTags() {

        if (!selectedTagsEl) return;

        selectedTagsEl.innerHTML = "";


        selectedTags.forEach(
            (tag, index) => {

                const item =
                    document.createElement(
                        "span"
                    );

                item.className =
                    "tagChip";


                item.innerHTML = `

                    <span>#${escapeHtml(tag)}</span>

                    <button
                        type="button"
                        class="tagRemove"
                        data-index="${index}"
                        aria-label="Remove tag"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                `;


                selectedTagsEl.appendChild(
                    item
                );
            }
        );
    }


    function addTag(value) {

        let tag =
            safeString(value)
                .trim()
                .replace(/^#/, "")
                .replace(/\s+/g, "");


        if (!tag) return;


        if (
            tag.length > 30
        ) {

            tag =
                tag.substring(
                    0,
                    30
                );
        }


        if (
            selectedTags.includes(tag)
        ) {

            return;
        }


        if (
            selectedTags.length >= 20
        ) {

            showToast(
                "Tag limit",
                "You can add up to 20 tags.",
                "warning"
            );

            return;
        }


        selectedTags.push(
            tag
        );

        renderTags();
    }


    /* ======================================================
       ESCAPE HTML
    ====================================================== */

    function escapeHtml(value) {

        return safeString(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    /* ======================================================
       VISIBILITY UI
    ====================================================== */

    function updateVisibilityUI() {

        $$(".visibilityOption")
            .forEach(button => {

                const value =
                    button.dataset.visibility;

                button.classList.toggle(
                    "active",
                    value ===
                    selectedVisibility
                );
            });
    }


    /* ======================================================
       COLLABORATION UI
    ====================================================== */

    function updateCollaborationUI() {

        if (!collaborationValue) {
            return;
        }


        if (!selectedCollaborator) {

            collaborationValue.textContent =
                "Invite someone to collaborate";

            return;
        }


        const name =
            selectedCollaborator.displayName ||
            selectedCollaborator.username ||
            selectedCollaborator.name;


        if (name) {

            collaborationValue.textContent =
                `@${String(name).replace(/^@/, "")}`;

        } else {

            collaborationValue.textContent =
                "Collaborator selected";
        }
    }


    /* ======================================================
       COVER UI
    ====================================================== */

    function updateCoverUI() {

        if (!coverUrl) {

            coverPreview?.classList.add(
                "hidden"
            );

            if (coverValue) {

                coverValue.textContent =
                    "Choose a thumbnail for your Short";
            }

            return;
        }


        coverPreview?.classList.remove(
            "hidden"
        );


        if (coverImage) {

            coverImage.src =
                coverUrl;
        }


        if (coverValue) {

            coverValue.textContent =
                "Custom cover selected";
        }
    }


    /* ======================================================
       BUILD UPDATE DATA
    ====================================================== */

    function buildUpdateData(
        status = null
    ) {

        const data = {

            title:
                shortTitle
                    ? shortTitle.value.trim()
                    : "",

            description:
                shortDescription
                    ? shortDescription.value.trim()
                    : "",

            tags: [
                ...selectedTags
            ],

            hashtags: [
                ...selectedTags
                    .filter(Boolean)
            ],

            visibility:
                selectedVisibility,

            allowComments:
                commentsToggle
                    ? !!commentsToggle.checked
                    : true,

            allowSharing:
                sharingToggle
                    ? !!sharingToggle.checked
                    : true,

            allowRemix:
                remixToggle
                    ? !!remixToggle.checked
                    : true,

            showLikeCount:
                likeCountToggle
                    ? !!likeCountToggle.checked
                    : true,

            showViewCount:
                viewCountToggle
                    ? !!viewCountToggle.checked
                    : true,

            saveToProfile:
                profileToggle
                    ? !!profileToggle.checked
                    : true,

            updatedAt:
                firebase.database.ServerValue.TIMESTAMP
        };


        if (coverUrl) {

            data.coverUrl =
                coverUrl;

            data.thumbnailUrl =
                coverUrl;
        }


        if (selectedCollaborator) {

            data.collaborator =
                selectedCollaborator;

            data.collaboratorId =
                selectedCollaborator.uid ||
                selectedCollaborator.id ||
                "";
        } else {

            data.collaborator = null;
            data.collaboratorId = "";
        }


        if (status) {

            data.status =
                status;
        }


        return data;
    }


    /* ======================================================
       SAVE TO DATABASE
    ====================================================== */

    async function saveShort(
        status = null
    ) {

        if (!currentUser) {

            showToast(
                "Login required",
                "Please log in to edit this Short.",
                "error"
            );

            return false;
        }


        if (!shortId) {

            showToast(
                "Short ID missing",
                "Open this page from the Short editor.",
                "error"
            );

            return false;
        }


        if (!db) {

            showToast(
                "Database unavailable",
                "Firebase database is not ready.",
                "error"
            );

            return false;
        }


        if (saving || publishing) {
            return false;
        }


        saving = status !== "published";
        publishing = status === "published";


        try {

            showProcessing(
                status === "published"
                    ? "Publishing your Short"
                    : "Saving changes",
                status === "published"
                    ? "Publishing Short details..."
                    : "Updating Short details..."
            );


            const updateData =
                buildUpdateData(status);


            /* ------------------------------------------
               Primary path
            ------------------------------------------ */

            let targetPath =
                shortData?.__dbPath ||
                `shorts/${shortId}`;


            try {

                await db
                    .ref(targetPath)
                    .update(updateData);

            } catch (primaryError) {

                console.warn(
                    "Primary update failed:",
                    primaryError
                );


                /* --------------------------------------
                   Fallback root
                -------------------------------------- */

                targetPath =
                    `shorts/${shortId}`;

                await db
                    .ref(targetPath)
                    .update(updateData);
            }


            /* ------------------------------------------
               Keep local state updated
            ------------------------------------------ */

            shortData = {
                ...(shortData || {}),
                ...updateData
            };


            if (status === "published") {

                setStatus(
                    "Published"
                );

                showToast(
                    "Short posted",
                    "Your Short has been published."
                );


                setTimeout(() => {

                    redirectAfterPublish();

                }, 900);

            } else {

                showToast(
                    "Changes saved",
                    "Your Short details were updated."
                );
            }


            return true;

        } catch (error) {

            console.error(
                "saveShort error:",
                error
            );


            showToast(
                "Save failed",
                firebaseErrorMessage(
                    error
                ),
                "error"
            );


            return false;

        } finally {

            saving = false;
            publishing = false;

            hideProcessing();
        }
    }


    /* ======================================================
       FIREBASE ERROR MESSAGE
    ====================================================== */

    function firebaseErrorMessage(
        error
    ) {

        if (!error) {
            return "Something went wrong.";
        }


        const code =
            error.code ||
            "";


        if (
            code.includes(
                "permission-denied"
            )
        ) {

            return "You don't have permission to edit this Short.";
        }


        if (
            code.includes(
                "network"
            )
        ) {

            return "Network error. Please try again.";
        }


        return (
            error.message ||
            "Unable to save changes."
        );
    }


    /* ======================================================
       SAVE DRAFT
    ====================================================== */

    async function saveDraft() {

        await saveShort(
            "draft"
        );
    }


    /* ======================================================
       PUBLISH
    ====================================================== */

    async function publishShort() {

        const title =
            shortTitle
                ? shortTitle.value.trim()
                : "";


        if (!title) {

            showToast(
                "Add a title",
                "Please add a title before posting.",
                "warning"
            );

            shortTitle?.focus();

            return;
        }


        await saveShort(
            "published"
        );
    }


    /* ======================================================
       REDIRECT
    ====================================================== */

    function redirectAfterPublish() {

        const candidates = [

            `shorts.html?shortId=${encodeURIComponent(shortId)}`,

            `short.html?shortId=${encodeURIComponent(shortId)}`,

            `index.html?shortId=${encodeURIComponent(shortId)}`

        ];


        /*
         * Prefer shorts.html.
         */

        window.location.href =
            candidates[0];
    }


    /* ======================================================
       COLLABORATION SHEET
    ====================================================== */

    function openCollaboration() {

        collaborationSheet?.classList.remove(
            "hidden"
        );

        collaborationSearch?.focus();

        if (currentUser) {

            searchCollaborators("");
        }
    }


    function closeCollaboration() {

        collaborationSheet?.classList.add(
            "hidden"
        );
    }


    /* ======================================================
       SEARCH USERS
    ====================================================== */

    let searchTimer = null;

    async function searchCollaborators(
        query
    ) {

        if (!collaborationList || !db) {
            return;
        }


        clearTimeout(
            searchTimer
        );


        searchTimer =
            setTimeout(
                async () => {

                    try {

                        collaborationList.innerHTML = `

                            <div class="emptyState">

                                <i class="fa-solid fa-spinner fa-spin"></i>

                                <strong>
                                    Searching...
                                </strong>

                                <span>
                                    Finding Viewora users.
                                </span>

                            </div>

                        `;


                        const snapshot =
                            await db
                                .ref("users")
                                .limitToFirst(100)
                                .once("value");


                        const users =
                            snapshot.val() ||
                            {};


                        const normalized =
                            safeString(
                                query
                            )
                                .toLowerCase()
                                .replace(
                                    /^@/,
                                    ""
                                );


                        const results =
                            Object.entries(users)
                                .filter(
                                    ([uid, user]) => {

                                        if (
                                            uid ===
                                            currentUser?.uid
                                        ) {
                                            return false;
                                        }


                                        if (!normalized) {
                                            return true;
                                        }


                                        const name =
                                            safeString(
                                                user.displayName ||
                                                user.name ||
                                                ""
                                            ).toLowerCase();


                                        const username =
                                            safeString(
                                                user.username ||
                                                user.handle ||
                                                ""
                                            )
                                                .toLowerCase()
                                                .replace(
                                                    /^@/,
                                                    ""
                                                );


                                        return (
                                            name.includes(
                                                normalized
                                            ) ||
                                            username.includes(
                                                normalized
                                            )
                                        );
                                    }
                                )
                                .slice(
                                    0,
                                    20
                                );


                        renderCollaborators(
                            results
                        );

                    } catch (error) {

                        console.error(
                            "User search error:",
                            error
                        );


                        collaborationList.innerHTML = `

                            <div class="emptyState">

                                <i class="fa-solid fa-triangle-exclamation"></i>

                                <strong>
                                    Search unavailable
                                </strong>

                                <span>
                                    Please try again.
                                </span>

                            </div>

                        `;
                    }

                },
                250
            );
    }


    function renderCollaborators(
        results
    ) {

        if (!collaborationList) {
            return;
        }


        if (!results.length) {

            collaborationList.innerHTML = `

                <div class="emptyState">

                    <i class="fa-solid fa-user-slash"></i>

                    <strong>
                        No users found
                    </strong>

                    <span>
                        Try another username.
                    </span>

                </div>

            `;

            return;
        }


        collaborationList.innerHTML = "";


        results.forEach(
            ([uid, user]) => {

                const name =
                    safeString(
                        user.displayName ||
                        user.name ||
                        "Viewora User"
                    );


                const username =
                    safeString(
                        user.username ||
                        user.handle ||
                        ""
                    );


                const photo =
                    user.photoURL ||
                    user.photoUrl ||
                    user.avatar ||
                    user.profileImage ||
                    "";


                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.className =
                    "sheetOption collaboratorOption";


                button.innerHTML = `

                    <span class="sheetOptionIcon">

                        ${
                            photo
                                ? `<img src="${escapeHtml(photo)}" alt="">`
                                : `<i class="fa-solid fa-user"></i>`
                        }

                    </span>


                    <span>

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <small>
                            ${
                                username
                                    ? "@" +
                                      escapeHtml(
                                          username.replace(/^@/, "")
                                      )
                                    : "Viewora creator"
                            }
                        </small>

                    </span>


                    <i class="fa-solid fa-plus"></i>

                `;


                button.addEventListener(
                    "click",
                    () => {

                        selectedCollaborator = {

                            uid,

                            displayName:
                                name,

                            username
                        };


                        updateCollaborationUI();

                        closeCollaboration();


                        showToast(
                            "Collaborator added",
                            `${name} selected for collaboration.`
                        );
                    }
                );


                collaborationList.appendChild(
                    button
                );
            }
        );
    }


    /* ======================================================
       COVER SHEET
    ====================================================== */

    function openCover() {

        coverSheet?.classList.remove(
            "hidden"
        );
    }


    function closeCover() {

        coverSheet?.classList.add(
            "hidden"
        );
    }


    /* ======================================================
       CURRENT FRAME COVER
    ====================================================== */

    function useCurrentFrame() {

        if (
            !shortPreview ||
            !shortPreview.videoWidth ||
            !shortPreview.videoHeight
        ) {

            showToast(
                "Frame unavailable",
                "Wait for the video preview to load.",
                "warning"
            );

            return;
        }


        try {

            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                shortPreview.videoWidth;

            canvas.height =
                shortPreview.videoHeight;


            const ctx =
                canvas.getContext(
                    "2d"
                );


            ctx.drawImage(
                shortPreview,
                0,
                0,
                canvas.width,
                canvas.height
            );


            coverUrl =
                canvas.toDataURL(
                    "image/jpeg",
                    0.88
                );


            updateCoverUI();

            closeCover();


            showToast(
                "Cover selected",
                "Current video frame selected as cover."
            );

        } catch (error) {

            console.error(
                "Frame capture error:",
                error
            );


            showToast(
                "Cover failed",
                "Unable to capture the current frame.",
                "error"
            );
        }
    }


    /* ======================================================
       COVER IMAGE UPLOAD
    ====================================================== */

    async function handleCoverUpload(
        file
    ) {

        if (!file) return;


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            showToast(
                "Invalid image",
                "Please choose a valid image.",
                "error"
            );

            return;
        }


        if (
            file.size >
            10 * 1024 * 1024
        ) {

            showToast(
                "Image too large",
                "Cover image must be under 10 MB.",
                "warning"
            );

            return;
        }


        try {

            showProcessing(
                "Preparing cover",
                "Uploading your cover image..."
            );


            let uploadedUrl = null;


            /*
             * ------------------------------------------
             * Cloudinary integration
             * Supports common Viewora cloudinary.js APIs.
             * ------------------------------------------
             */

            if (
                typeof window.uploadToCloudinary ===
                "function"
            ) {

                uploadedUrl =
                    await window.uploadToCloudinary(
                        file
                    );

            } else if (
                typeof window.uploadMediaToCloudinary ===
                "function"
            ) {

                uploadedUrl =
                    await window.uploadMediaToCloudinary(
                        file,
                        "image"
                    );

            } else if (
                typeof window.cloudinaryUpload ===
                "function"
            ) {

                uploadedUrl =
                    await window.cloudinaryUpload(
                        file
                    );
            }


            /*
             * ------------------------------------------
             * If cloudinary.js does not expose a helper,
             * use Firebase Storage as fallback.
             * ------------------------------------------
             */

            if (
                !uploadedUrl &&
                firebase.storage
            ) {

                const storage =
                    firebase.storage();


                const extension =
                    file.name
                        .split(".")
                        .pop()
                        .toLowerCase() ||
                    "jpg";


                const ref =
                    storage
                        .ref()
                        .child(
                            `short-covers/${currentUser.uid}/${shortId}.${extension}`
                        );


                const snapshot =
                    await ref.put(
                        file,
                        {
                            contentType:
                                file.type
                        }
                    );


                uploadedUrl =
                    await snapshot.ref.getDownloadURL();
            }


            if (!uploadedUrl) {

                throw new Error(
                    "No upload URL returned."
                );
            }


            coverUrl =
                typeof uploadedUrl ===
                    "object"
                    ? (
                        uploadedUrl.secure_url ||
                        uploadedUrl.url ||
                        uploadedUrl.downloadURL ||
                        ""
                    )
                    : String(
                        uploadedUrl
                    );


            if (!coverUrl) {

                throw new Error(
                    "Invalid uploaded image URL."
                );
            }


            updateCoverUI();

            closeCover();


            showToast(
                "Cover updated",
                "Your new cover is ready."
            );

        } catch (error) {

            console.error(
                "Cover upload error:",
                error
            );


            showToast(
                "Cover upload failed",
                error.message ||
                "Unable to upload cover.",
                "error"
            );

        } finally {

            hideProcessing();
        }
    }


    /* ======================================================
       ADVANCED SHEET
    ====================================================== */

    function openAdvanced() {

        advancedSheet?.classList.remove(
            "hidden"
        );
    }


    function closeAdvanced() {

        advancedSheet?.classList.add(
            "hidden"
        );
    }


    /* ======================================================
       HASHTAG
    ====================================================== */

    function addHashtag() {

        if (!shortDescription) {
            return;
        }


        const value =
            shortDescription.value;


        const hashtag =
            value.match(
                /#[a-zA-Z0-9_]+$/
            );


        if (hashtag) {

            shortDescription.focus();

            return;
        }


        const addition =
            value.length
                ? " #"
                : "#";


        shortDescription.value +=
            addition;


        shortDescription.focus();

        updateCounters();
    }


    /* ======================================================
       MENTION
    ====================================================== */

    function addMention() {

        if (!shortDescription) {
            return;
        }


        const value =
            shortDescription.value;


        const addition =
            value.length
                ? " @"
                : "@";


        shortDescription.value +=
            addition;


        shortDescription.focus();

        updateCounters();
    }


    /* ======================================================
       EVENT LISTENERS
    ====================================================== */

    function setupEvents() {


        /* -----------------------------------------------
           BACK
        ------------------------------------------------ */

        backBtn?.addEventListener(
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


        /* -----------------------------------------------
           PREVIEW
        ------------------------------------------------ */

        previewBtn?.addEventListener(
            "click",
            () => {

                togglePreview();
            }
        );


        previewPlayBtn?.addEventListener(
            "click",
            togglePreview
        );


        /* -----------------------------------------------
           INPUT COUNTERS
        ------------------------------------------------ */

        shortTitle?.addEventListener(
            "input",
            updateCounters
        );


        shortDescription?.addEventListener(
            "input",
            updateCounters
        );


        /* -----------------------------------------------
           TAG INPUT
        ------------------------------------------------ */

        tagInput?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter" ||
                    event.key === ","
                ) {

                    event.preventDefault();

                    addTag(
                        tagInput.value
                    );

                    tagInput.value =
                        "";
                }


                if (
                    event.key ===
                    "Backspace" &&
                    !tagInput.value &&
                    selectedTags.length
                ) {

                    selectedTags.pop();

                    renderTags();
                }
            }
        );


        tagInput?.addEventListener(
            "blur",
            () => {

                if (
                    tagInput.value.trim()
                ) {

                    addTag(
                        tagInput.value
                    );

                    tagInput.value =
                        "";
                }
            }
        );


        selectedTagsEl?.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".tagRemove"
                    );


                if (!button) return;


                const index =
                    Number(
                        button.dataset.index
                    );


                if (
                    Number.isInteger(index)
                ) {

                    selectedTags.splice(
                        index,
                        1
                    );

                    renderTags();
                }
            }
        );


        /* -----------------------------------------------
           VISIBILITY
        ------------------------------------------------ */

        $$(".visibilityOption")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectedVisibility =
                            button.dataset.visibility ||
                            "public";

                        updateVisibilityUI();
                    }
                );
            });


        /* -----------------------------------------------
           COLLABORATION
        ------------------------------------------------ */

        collaborationBtn?.addEventListener(
            "click",
            openCollaboration
        );


        closeCollaborationBtn?.addEventListener(
            "click",
            closeCollaboration
        );


        collaborationSheet
            ?.querySelector(
                ".overlayBackdrop"
            )
            ?.addEventListener(
                "click",
                closeCollaboration
            );


        collaborationSearch?.addEventListener(
            "input",
            () => {

                searchCollaborators(
                    collaborationSearch.value
                );
            }
        );


        /* -----------------------------------------------
           COVER
        ------------------------------------------------ */

        coverBtn?.addEventListener(
            "click",
            openCover
        );


        closeCoverBtn?.addEventListener(
            "click",
            closeCover
        );


        coverSheet
            ?.querySelector(
                ".overlayBackdrop"
            )
            ?.addEventListener(
                "click",
                closeCover
            );


        useCurrentFrameButton?.addEventListener(
            "click",
            useCurrentFrame
        );


        chooseCoverBtn?.addEventListener(
            "click",
            () => {

                coverInput?.click();
            }
        );


        coverInput?.addEventListener(
            "change",
            () => {

                const file =
                    coverInput.files?.[0];

                if (file) {

                    handleCoverUpload(
                        file
                    );
                }


                coverInput.value =
                    "";
            }
        );


        /* -----------------------------------------------
           ADVANCED
        ------------------------------------------------ */

        advancedBtn?.addEventListener(
            "click",
            openAdvanced
        );


        closeAdvancedBtn?.addEventListener(
            "click",
            closeAdvanced
        );


        advancedSheet
            ?.querySelector(
                ".overlayBackdrop"
            )
            ?.addEventListener(
                "click",
                closeAdvanced
            );


        /* -----------------------------------------------
           HASHTAG / MENTION
        ------------------------------------------------ */

        $("addHashtagBtn")
            ?.addEventListener(
                "click",
                addHashtag
            );


        $("mentionBtn")
            ?.addEventListener(
                "click",
                addMention
            );


        /* -----------------------------------------------
           SAVE
        ------------------------------------------------ */

        saveDraftBtn?.addEventListener(
            "click",
            saveDraft
        );


        /* -----------------------------------------------
           PUBLISH
        ------------------------------------------------ */

        publishBtn?.addEventListener(
            "click",
            publishShort
        );


        /* -----------------------------------------------
           ESCAPE
        ------------------------------------------------ */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }


                closeCollaboration();
                closeCover();
                closeAdvanced();
            }
        );
    }


    /* ======================================================
       AUTH STATE
    ====================================================== */

    function waitForAuth() {

        return new Promise(
            resolve => {

                if (!auth) {

                    resolve(
                        null
                    );

                    return;
                }


                let resolved =
                    false;


                const finish =
                    user => {

                        if (resolved) {
                            return;
                        }

                        resolved = true;

                        resolve(
                            user
                        );
                    };


                try {

                    auth.onAuthStateChanged(
                        user => {

                            finish(
                                user
                            );

                        }
                    );


                    /*
                     * If already available,
                     * don't unnecessarily wait.
                     */

                    if (auth.currentUser) {

                        finish(
                            auth.currentUser
                        );
                    }

                } catch (error) {

                    console.error(
                        "Auth listener error:",
                        error
                    );

                    finish(
                        null
                    );
                }


                setTimeout(
                    () => {

                        finish(
                            auth.currentUser ||
                            null
                        );

                    },
                    4000
                );
            }
        );
    }


    /* ======================================================
       MAIN INIT
    ====================================================== */

    async function init() {

        try {

            setupEvents();

            setupVideoEvents();

            updateCounters();

            updateVisibilityUI();


            /* ------------------------------------------
               Detect ID FIRST
            ------------------------------------------ */

            shortId =
                detectShortId();


            if (shortId) {

                persistShortId(
                    shortId
                );

                normalizeUrlWithShortId(
                    shortId
                );

            } else {

                /*
                 * Don't immediately break the page.
                 * Wait briefly because another page may
                 * have just stored the ID.
                 */

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            250
                        )
                );


                shortId =
                    detectShortId();
            }


            /* ------------------------------------------
               Firebase
            ------------------------------------------ */

            initializeFirebase();


            if (!auth) {

                showNoShort(
                    "Authentication service unavailable."
                );

                return;
            }


            /* ------------------------------------------
               Auth
            ------------------------------------------ */

            currentUser =
                await waitForAuth();


            if (!currentUser) {

                showNoShort(
                    "Please log in to edit this Short."
                );

                showToast(
                    "Login required",
                    "Please log in and open the Short again.",
                    "warning"
                );

                return;
            }


            /* ------------------------------------------
               ID still missing?
            ------------------------------------------ */

            if (!shortId) {

                showNoShort(
                    "Short ID missing. Open Edit Short from your Short."
                );

                showToast(
                    "Short ID missing",
                    "The Short ID was not included in the editor URL.",
                    "error"
                );

                return;
            }


            /* ------------------------------------------
               Load
            ------------------------------------------ */

            await loadShort();

        } catch (error) {

            console.error(
                "SHORT EDIT INIT ERROR:",
                error
            );


            showNoShort(
                "Something went wrong while opening the editor."
            );
        }
    }


    /* ======================================================
       START
    ====================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();
    }


    /* ======================================================
       EXPOSE DEBUG API
    ====================================================== */

    window.VieworaShortEdit = {

        getShortId: () =>
            shortId,

        reload: () =>
            loadShort(),

        save: () =>
            saveShort(),

        publish: () =>
            publishShort,

        state: () => ({
            shortId,
            currentUser:
                currentUser
                    ? currentUser.uid
                    : null,
            shortData,
            selectedTags,
            selectedVisibility,
            selectedCollaborator,
            coverUrl
        })
    };

})();