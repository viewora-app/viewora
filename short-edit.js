"use strict";

/*
==============================================================
 VIEWORA — SHORT DETAILS ENGINE
 short-edit.js
 PREMIUM • SAFE • FINAL
==============================================================

 PURPOSE
 --------------------------------------------------------------
 • Existing Short edit
 • New Short from IndexedDB
 • Reliable Short ID recovery
 • Firebase Storage upload
 • Firebase Realtime Database save
 • Existing video URL preservation
 • Thumbnail upload
 • Video frame thumbnail
 • Draft
 • Publish
 • Preview
 • Visibility
 • Comments / likes / remix / download / sharing
 • Collaboration / mentions / music preservation

 IMPORTANT
 --------------------------------------------------------------
 Existing Short:
    video is NEVER re-uploaded.

 New Short:
    IndexedDB Blob
        ↓
    Firebase Storage
        ↓
    downloadURL
        ↓
    Realtime Database

==============================================================
*/

(() => {

    /* =========================================================
       DOUBLE INIT GUARD
    ========================================================= */

    if (window.__VIEWORA_SHORT_DETAILS__) {
        console.warn(
            "VIEWORA Short Details already initialized."
        );
        return;
    }

    window.__VIEWORA_SHORT_DETAILS__ = true;


    /* =========================================================
       DOM HELPERS
    ========================================================= */

    const $ = id =>
        document.getElementById(id);

    const qs = (
        selector,
        root = document
    ) =>
        root.querySelector(selector);

    const qsa = (
        selector,
        root = document
    ) =>
        Array.from(
            root.querySelectorAll(selector)
        );


    /* =========================================================
       BASIC HELPERS
    ========================================================= */

    const validString = value =>
        typeof value === "string" &&
        value.trim().length > 0;


    const safeString = (
        value,
        fallback = ""
    ) => {

        if (
            value === null ||
            value === undefined
        ) {
            return fallback;
        }

        return String(value);
    };


    const cleanText = (
        value,
        fallback = ""
    ) => {

        const text =
            safeString(value).trim();

        return text || fallback;
    };


    const validId = value => {

        if (
            value === null ||
            value === undefined
        ) {
            return false;
        }

        const id =
            String(value).trim();

        if (!id) {
            return false;
        }

        const invalidIds = [
            "undefined",
            "null",
            "nan",
            "NaN"
        ];

        return !invalidIds.includes(id);
    };


    const isFiniteNumber = value => {

        const number =
            Number(value);

        return Number.isFinite(number);
    };


    const formatTime = seconds => {

        let value =
            Number(seconds);

        if (
            !Number.isFinite(value) ||
            value < 0
        ) {
            value = 0;
        }

        const minutes =
            Math.floor(
                value / 60
            );

        const secs =
            Math.floor(
                value % 60
            );

        return (
            String(minutes)
                .padStart(2, "0") +
            ":" +
            String(secs)
                .padStart(2, "0")
        );
    };


    /* =========================================================
       FIREBASE READY
    ========================================================= */

    function firebaseReady() {

        return (
            typeof firebase !== "undefined" &&
            Array.isArray(firebase.apps) &&
            firebase.apps.length > 0
        );
    }


    let db = null;
    let storage = null;


    if (firebaseReady()) {

        try {
            db =
                firebase.database();
        } catch (error) {

            console.warn(
                "VIEWORA Database unavailable:",
                error
            );
        }


        try {
            storage =
                firebase.storage();
        } catch (error) {

            console.warn(
                "VIEWORA Storage unavailable:",
                error
            );
        }
    }


    /* =========================================================
       CLOUDINARY MEDIA UPLOAD
       ---------------------------------------------------------
       Set these once (firebase.js / any global script):

         window.VIEWORA_CLOUDINARY_CLOUD  = "your_cloud_name";
         window.VIEWORA_CLOUDINARY_PRESET = "your_unsigned_preset";

       Or edit the defaults below.
       Prefer Cloudinary for video + thumbnail (more reliable
       than Firebase Storage on many mobile browsers).
    ========================================================= */

    const CLOUDINARY_CLOUD =
        (
            typeof window !== "undefined" &&
            window.VIEWORA_CLOUDINARY_CLOUD
        ) ||
        "z5m6wjdf";

    const CLOUDINARY_PRESET =
        (
            typeof window !== "undefined" &&
            window.VIEWORA_CLOUDINARY_PRESET
        ) ||
        "Viewora-upload";

    const CLOUDINARY_FOLDER =
        (
            typeof window !== "undefined" &&
            window.VIEWORA_CLOUDINARY_FOLDER
        ) ||
        "";


    function cloudinaryReady() {

        return (
            validString(CLOUDINARY_CLOUD) &&
            validString(CLOUDINARY_PRESET) &&
            CLOUDINARY_CLOUD !== "YOUR_CLOUD_NAME"
        );
    }


    function uploadToCloudinary(
        file,
        resourceType = "auto",
        onProgress
    ) {

        return new Promise(
            (resolve, reject) => {

                if (!file) {

                    reject(
                        new Error(
                            "Upload file is missing."
                        )
                    );

                    return;
                }


                if (!cloudinaryReady()) {

                    reject(
                        new Error(
                            "Cloudinary is not configured. Set window.VIEWORA_CLOUDINARY_CLOUD and window.VIEWORA_CLOUDINARY_PRESET."
                        )
                    );

                    return;
                }


                /*
                 * Always use /auto/upload — Cloudinary
                 * detects image vs video from the file.
                 * Matches Viewora upload preset setup.
                 */
                const url =
                    "https://api.cloudinary.com/v1_1/" +
                    encodeURIComponent(
                        CLOUDINARY_CLOUD
                    ) +
                    "/auto/upload";


                const form =
                    new FormData();


                form.append(
                    "file",
                    file
                );


                form.append(
                    "upload_preset",
                    CLOUDINARY_PRESET
                );


                /*
                 * Only send folder if preset allows it.
                 * Some unsigned presets reject unknown fields.
                 */
                if (
                    validString(
                        CLOUDINARY_FOLDER
                    )
                ) {

                    form.append(
                        "folder",
                        CLOUDINARY_FOLDER
                    );
                }


                const xhr =
                    new XMLHttpRequest();


                let finished =
                    false;


                const timeout =
                    setTimeout(() => {

                        if (finished) {
                            return;
                        }

                        finished =
                            true;

                        try {
                            xhr.abort();
                        } catch (_) {}


                        reject(
                            new Error(
                                "Cloudinary upload timed out. Check your internet connection."
                            )
                        );

                    }, resourceType === "image" ? 60000 : 300000);


                const done = (
                    cb,
                    value
                ) => {

                    if (finished) {
                        return;
                    }

                    finished =
                        true;

                    clearTimeout(
                        timeout
                    );

                    cb(value);
                };


                xhr.upload.addEventListener(
                    "progress",
                    event => {

                        if (
                            !event.lengthComputable ||
                            typeof onProgress !==
                            "function"
                        ) {
                            return;
                        }


                        const percent =
                            Math.round(
                                (
                                    event.loaded /
                                    event.total
                                ) * 100
                            );


                        onProgress(
                            Math.max(
                                0,
                                Math.min(
                                    100,
                                    percent
                                )
                            )
                        );
                    }
                );


                xhr.addEventListener(
                    "load",
                    () => {

                        if (
                            xhr.status < 200 ||
                            xhr.status >= 300
                        ) {

                            let message =
                                "Cloudinary upload failed (" +
                                xhr.status +
                                ").";


                            try {

                                const json =
                                    JSON.parse(
                                        xhr.responseText
                                    );


                                if (
                                    json?.error?.message
                                ) {

                                    message =
                                        json.error.message;
                                }

                            } catch (_) {}


                            done(
                                reject,
                                new Error(
                                    message
                                )
                            );

                            return;
                        }


                        try {

                            const json =
                                JSON.parse(
                                    xhr.responseText
                                );


                            const secure =
                                json.secure_url ||
                                json.url ||
                                "";


                            if (
                                !validString(
                                    secure
                                )
                            ) {

                                done(
                                    reject,
                                    new Error(
                                        "Cloudinary did not return a media URL."
                                    )
                                );

                                return;
                            }


                            done(
                                resolve,
                                {
                                    url:
                                        secure.trim(),

                                    publicId:
                                        json.public_id ||
                                        "",

                                    resourceType:
                                        json.resource_type ||
                                        resourceType,

                                    bytes:
                                        json.bytes ||
                                        0,

                                    format:
                                        json.format ||
                                        "",

                                    width:
                                        json.width ||
                                        0,

                                    height:
                                        json.height ||
                                        0,

                                    duration:
                                        json.duration ||
                                        0,

                                    raw:
                                        json
                                }
                            );

                        } catch (error) {

                            done(
                                reject,
                                error
                            );
                        }
                    }
                );


                xhr.addEventListener(
                    "error",
                    () => {

                        done(
                            reject,
                            new Error(
                                "Cloudinary network error. Check internet / CORS / preset settings."
                            )
                        );
                    }
                );


                xhr.addEventListener(
                    "abort",
                    () => {

                        done(
                            reject,
                            new Error(
                                "Cloudinary upload aborted."
                            )
                        );
                    }
                );


                xhr.open(
                    "POST",
                    url
                );


                xhr.send(
                    form
                );
            }
        );
    }


    /*
     * Unified media upload:
     * 1) Cloudinary (preferred)
     * 2) Firebase Storage (fallback)
     */
    async function uploadMediaFile(
        file,
        options = {}
    ) {

        const resourceType =
            options.resourceType ||
            (
                file?.type?.startsWith(
                    "image/"
                )
                    ? "image"
                    : "video"
            );


        const onProgress =
            options.onProgress;


        const preferCloudinary =
            options.preferCloudinary !== false;


        if (
            preferCloudinary &&
            cloudinaryReady()
        ) {

            console.log(
                "VIEWORA: Uploading via Cloudinary...",
                {
                    cloud:
                        CLOUDINARY_CLOUD,

                    preset:
                        CLOUDINARY_PRESET,

                    resourceType,
                    size:
                        file?.size,
                    type:
                        file?.type
                }
            );


            const result =
                await uploadToCloudinary(
                    file,
                    resourceType,
                    onProgress
                );


            return result.url;
        }


        /*
         * Firebase Storage fallback
         */
        if (!storage) {

            try {

                storage =
                    firebase.storage();

            } catch (_) {}
        }


        if (!storage) {

            throw new Error(
                "No upload backend ready. Configure Cloudinary (VIEWORA_CLOUDINARY_CLOUD + VIEWORA_CLOUDINARY_PRESET) or enable Firebase Storage."
            );
        }


        const user =
            options.user ||
            getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in before uploading."
            );
        }


        await ensureShortId();


        const ext =
            resourceType === "image"
                ? "jpg"
                : (
                    String(
                        file.type ||
                        ""
                    ).includes(
                        "webm"
                    )
                        ? "webm"
                        : "mp4"
                );


        const path =
            options.path ||
            `shorts/${user.uid}/${state.shortId}/${resourceType}_${Date.now()}.${ext}`;


        const ref =
            storage
                .ref()
                .child(
                    path
                );


        console.log(
            "VIEWORA: Uploading via Firebase Storage...",
            path
        );


        return await putFileWithProgress(
            ref,
            file,
            onProgress,
            {
                timeoutMs:
                    resourceType ===
                    "image"
                        ? 45000
                        : 300000
            }
        );
    }


    /* =========================================================
       STATE
    ========================================================= */

    const state = {

        shortId: null,

        uid: null,

        data: {},

        videoUrl: "",

        thumbnailUrl: "",

        /*
         * Pending local thumbnail (deferred upload)
         */
        thumbnailFile: null,

        thumbnailObjectUrl: "",

        /*
         * New Short / IndexedDB
         */
        isNew: false,

        videoBlob: null,

        videoObjectUrl: "",

        editorMeta: null,

        /*
         * Settings
         */
        visibility: "public",

        showLikeCount: true,

        allowComments: true,

        showCommentCount: true,

        allowRemix: true,

        allowDownload: true,

        allowSharing: true,

        audience: "general",

        language: "auto",

        /*
         * UI state
         */
        dirty: false,

        saving: false,

        publishing: false,

        loaded: false
    };


    /* =========================================================
       INDEXED DB
    ========================================================= */

    const VIDEO_DB_NAME =
        "VIEWORA_MEDIA_DB";

    const VIDEO_DB_VERSION =
        1;

    const VIDEO_STORE =
        "uploads";

    const VIDEO_KEY =
        "currentVideo";


    const EDITOR_DATA_KEY =
        "viewora_edit_short_data";

    const EDITOR_SESSION_KEY =
        "viewora_short_editor";

    const PENDING_NEW_SHORT_KEY =
        "viewora_pending_new_short";


    /* =========================================================
       TOAST
    ========================================================= */

    function toast(
        title = "Done",
        message = "",
        type = "success"
    ) {

        const box =
            $("toast");

        if (!box) {
            return;
        }


        const titleEl =
            $("toastTitle");

        const textEl =
            $("toastText");

        const iconEl =
            $("toastIcon");


        if (titleEl) {
            titleEl.textContent =
                title;
        }


        if (textEl) {
            textEl.textContent =
                message;
        }


        if (iconEl) {

            const icon =
                iconEl.querySelector("i");

            if (icon) {

                icon.className =
                    type === "error"
                        ? "fa-solid fa-circle-exclamation"
                        : type === "warning"
                            ? "fa-solid fa-triangle-exclamation"
                            : "fa-solid fa-circle-check";
            }
        }


        box.classList.remove(
            "hidden"
        );


        clearTimeout(
            window.__VIEWORA_TOAST_TIMER__
        );


        window.__VIEWORA_TOAST_TIMER__ =
            setTimeout(() => {

                box.classList.add(
                    "hidden"
                );

            }, 3200);
    }


    /* =========================================================
       PROCESSING OVERLAY
    ========================================================= */

    function showProcessing(
        title = "Please wait",
        message = "Preparing..."
    ) {

        const overlay =
            $("processingOverlay");

        if (!overlay) {
            return;
        }


        const titleEl =
            $("processingTitle");

        const messageEl =
            $("processingMessage");


        if (titleEl) {
            titleEl.textContent =
                title;
        }


        if (messageEl) {
            messageEl.textContent =
                message;
        }


        overlay.classList.remove(
            "hidden"
        );


        setProgress(0);
    }


    function hideProcessing() {

        const overlay =
            $("processingOverlay");

        if (overlay) {

            overlay.classList.add(
                "hidden"
            );
        }
    }


    function setProgress(percent) {

        const bar =
            $("processingProgressBar");

        if (!bar) {
            return;
        }


        const value =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(percent) || 0
                )
            );


        bar.style.width =
            `${value}%`;
    }


    /* =========================================================
       CURRENT USER
    ========================================================= */

    function getCurrentUser() {

        try {

            if (
                typeof firebase !== "undefined" &&
                typeof firebase.auth === "function"
            ) {

                return (
                    firebase.auth()
                        .currentUser ||
                    null
                );
            }

        } catch (error) {

            console.warn(
                "Could not get Firebase user:",
                error
            );
        }

        return null;
    }


    /* =========================================================
       WAIT FOR AUTH
    ========================================================= */

    function waitForSignedInUser(
        timeoutMs = 15000
    ) {

        return new Promise(
            (resolve, reject) => {

                const existing =
                    getCurrentUser();


                if (existing) {

                    state.uid =
                        existing.uid;

                    resolve(
                        existing
                    );

                    return;
                }


                if (
                    typeof firebase === "undefined" ||
                    typeof firebase.auth !== "function"
                ) {

                    reject(
                        new Error(
                            "Firebase Authentication is not available."
                        )
                    );

                    return;
                }


                let finished =
                    false;

                let unsubscribe =
                    null;


                const timer =
                    setTimeout(() => {

                        if (finished) {
                            return;
                        }

                        finished =
                            true;

                        try {

                            if (
                                typeof unsubscribe ===
                                "function"
                            ) {
                                unsubscribe();
                            }

                        } catch (_) {}


                        reject(
                            new Error(
                                "Authentication is taking too long. Please sign in again and retry."
                            )
                        );

                    }, timeoutMs);


                const finish = (
                    callback,
                    value
                ) => {

                    if (finished) {
                        return;
                    }

                    finished =
                        true;

                    clearTimeout(
                        timer
                    );


                    try {

                        if (
                            typeof unsubscribe ===
                            "function"
                        ) {
                            unsubscribe();
                        }

                    } catch (_) {}


                    callback(
                        value
                    );
                };


                try {

                    unsubscribe =
                        firebase.auth()
                            .onAuthStateChanged(
                                user => {

                                    if (!user) {
                                        return;
                                    }


                                    state.uid =
                                        user.uid;


                                    finish(
                                        resolve,
                                        user
                                    );
                                }
                            );

                } catch (error) {

                    finish(
                        reject,
                        error
                    );
                }
            }
        );
    }


    /* =========================================================
       INDEXED DB OPEN
    ========================================================= */

    function openVideoDB() {

        return new Promise(
            (resolve, reject) => {

                if (
                    !("indexedDB" in window)
                ) {

                    reject(
                        new Error(
                            "IndexedDB is not supported."
                        )
                    );

                    return;
                }


                const request =
                    indexedDB.open(
                        VIDEO_DB_NAME,
                        VIDEO_DB_VERSION
                    );


                request.onupgradeneeded =
                    event => {

                        const database =
                            event.target.result;


                        if (
                            !database.objectStoreNames
                                .contains(
                                    VIDEO_STORE
                                )
                        ) {

                            database.createObjectStore(
                                VIDEO_STORE
                            );
                        }
                    };


                request.onsuccess =
                    () => {

                        resolve(
                            request.result
                        );
                    };


                request.onerror =
                    () => {

                        reject(
                            request.error ||
                            new Error(
                                "Could not open media database."
                            )
                        );
                    };
            }
        );
    }


    /* =========================================================
       LOAD VIDEO FROM INDEXED DB
    ========================================================= */

    async function loadVideoBlobFromIndexedDB() {

        let database = null;

        try {

            database =
                await openVideoDB();


            return await new Promise(
                (resolve, reject) => {

                    try {

                        const tx =
                            database.transaction(
                                VIDEO_STORE,
                                "readonly"
                            );


                        const store =
                            tx.objectStore(
                                VIDEO_STORE
                            );


                        const request =
                            store.get(
                                VIDEO_KEY
                            );


                        request.onsuccess =
                            () => {

                                const value =
                                    request.result ||
                                    null;

                                resolve(
                                    value
                                );
                            };


                        request.onerror =
                            () => {

                                reject(
                                    request.error ||
                                    new Error(
                                        "Could not read video from IndexedDB."
                                    )
                                );
                            };

                    } catch (error) {

                        reject(
                            error
                        );
                    }
                }
            );

        } catch (error) {

            console.warn(
                "VIEWORA IndexedDB video load failed:",
                error
            );

            return null;

        } finally {

            /*
             * Closing the database is safe and avoids
             * keeping unnecessary IndexedDB connections alive.
             */
            try {

                if (database) {
                    database.close();
                }

            } catch (_) {}
        }
    }


    /* =========================================================
       READ EDITOR SESSION
    ========================================================= */

    function readEditorSessionData() {

        const keys = [

            EDITOR_DATA_KEY,

            EDITOR_SESSION_KEY,

            "viewora_current_short",

            PENDING_NEW_SHORT_KEY
        ];


        for (const key of keys) {

            try {

                const raw =
                    sessionStorage.getItem(
                        key
                    );


                if (!raw) {
                    continue;
                }


                /*
                 * pending key may simply be "1"
                 */
                if (raw === "1") {
                    continue;
                }


                const data =
                    JSON.parse(
                        raw
                    );


                if (
                    data &&
                    typeof data === "object"
                ) {

                    return data;
                }

            } catch (_) {}
        }


        return null;
    }


    /* =========================================================
       DETECT EDITOR SOURCE
    ========================================================= */

    function isFromEditor() {

        try {

            const params =
                new URLSearchParams(
                    window.location.search
                );


            const source =
                (
                    params.get("source") ||
                    ""
                ).toLowerCase();


            if (
                [
                    "editor",
                    "upload",
                    "camera",
                    "create",
                    "shorts"
                ].includes(source)
            ) {
                return true;
            }

        } catch (_) {}


        try {

            if (
                sessionStorage.getItem(
                    PENDING_NEW_SHORT_KEY
                ) === "1"
            ) {
                return true;
            }


            if (
                sessionStorage.getItem(
                    EDITOR_DATA_KEY
                )
            ) {
                return true;
            }


            if (
                sessionStorage.getItem(
                    EDITOR_SESSION_KEY
                )
            ) {
                return true;
            }


            if (
                sessionStorage.getItem(
                    "viewora_current_short"
                )
            ) {
                return true;
            }

        } catch (_) {}


        return false;
    }


    /* =========================================================
       APPLY LOCAL VIDEO
    ========================================================= */

    function applyLocalVideoBlob(
        blob
    ) {

        if (!blob) {
            return false;
        }


        /*
         * Remove old object URL
         */
        if (state.videoObjectUrl) {

            try {

                URL.revokeObjectURL(
                    state.videoObjectUrl
                );

            } catch (_) {}

            state.videoObjectUrl =
                "";
        }


        state.videoBlob =
            blob;


        state.videoObjectUrl =
            URL.createObjectURL(
                blob
            );


        state.videoUrl =
            state.videoObjectUrl;


        state.isNew =
            true;


        loadAllVideos(
            state.videoUrl
        );


        showThumbnail(
            state.thumbnailUrl
        );


        updateChecklist();


        return true;
    }


    /* =========================================================
       GENERATE SHORT ID
    ========================================================= */

    function generateShortId() {

        try {

            if (db) {

                const key =
                    db.ref(
                        "shorts"
                    ).push().key;


                if (
                    validId(key)
                ) {
                    return key;
                }
            }

        } catch (error) {

            console.warn(
                "Could not generate Firebase key:",
                error
            );
        }


        return (
            "short_" +
            Date.now().toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }


    /* =========================================================
       ENSURE SHORT ID
    ========================================================= */

    async function ensureShortId() {

        if (
            validId(
                state.shortId
            )
        ) {

            return state.shortId;
        }


        const id =
            generateShortId();


        if (!validId(id)) {

            throw new Error(
                "Could not create a Short ID."
            );
        }


        state.shortId =
            id;


        persistShortId(
            id
        );


        return id;
    }


    /* =========================================================
       URL SHORT ID
    ========================================================= */

    function getIdFromUrl() {

        try {

            const params =
                new URLSearchParams(
                    window.location.search
                );


            const keys = [

                "shortId",
                "shortID",
                "shortid",

                "short",

                "id",

                "postId",
                "postID",

                "videoId",
                "videoID",

                "mediaId",
                "mediaID"
            ];


            for (const key of keys) {

                const value =
                    params.get(
                        key
                    );


                if (
                    validId(value)
                ) {

                    return value.trim();
                }
            }

        } catch (error) {

            console.warn(
                "Could not read Short ID from URL:",
                error
            );
        }


        return null;
    }


    /* =========================================================
       STORAGE SHORT ID
    ========================================================= */

    function getIdFromStorage() {

        const keys = [

            "vieworaShortId",

            "viewora_short_id",

            "shortId",

            "shortID",

            "currentShortId",

            "currentShortID",

            "editingShortId",

            "editingShortID",

            "vieworaEditingShortId",

            "currentVideoId",

            "editingVideoId"
        ];


        for (const key of keys) {

            try {

                const sessionValue =
                    sessionStorage.getItem(
                        key
                    );


                if (
                    validId(
                        sessionValue
                    )
                ) {

                    return sessionValue.trim();
                }

            } catch (_) {}


            try {

                const localValue =
                    localStorage.getItem(
                        key
                    );


                if (
                    validId(
                        localValue
                    )
                ) {

                    return localValue.trim();
                }

            } catch (_) {}
        }


        return null;
    }


    /* =========================================================
       GET SHORT ID
    ========================================================= */

    function getShortId() {

        const urlId =
            getIdFromUrl();


        if (urlId) {
            return urlId;
        }


        const storageId =
            getIdFromStorage();


        if (storageId) {
            return storageId;
        }


        return null;
    }


    /* =========================================================
       PERSIST SHORT ID
    ========================================================= */

    function persistShortId(
        id
    ) {

        if (
            !validId(id)
        ) {
            return;
        }


        const value =
            String(id).trim();


        const keys = [

            "vieworaShortId",

            "viewora_short_id",

            "currentShortId",

            "editingShortId",

            "vieworaEditingShortId"
        ];


        keys.forEach(
            key => {

                try {

                    sessionStorage.setItem(
                        key,
                        value
                    );

                } catch (_) {}


                try {

                    localStorage.setItem(
                        key,
                        value
                    );

                } catch (_) {}
            }
        );
    }


    /* =========================================================
       DEEP URL FINDER
    ========================================================= */

    function findUrlDeep(
        object,
        keys,
        depth = 0
    ) {

        if (
            !object ||
            typeof object !== "object" ||
            depth > 6
        ) {
            return "";
        }


        /*
         * Direct fields
         */
        for (const key of keys) {

            const value =
                object[key];


            if (
                validString(value)
            ) {

                return value.trim();
            }
        }


        /*
         * Nested fields
         */
        for (
            const key of Object.keys(object)
        ) {

            const value =
                object[key];


            if (
                value &&
                typeof value === "object"
            ) {

                const found =
                    findUrlDeep(
                        value,
                        keys,
                        depth + 1
                    );


                if (found) {
                    return found;
                }
            }
        }


        return "";
    }


    /* =========================================================
       FIND VIDEO URL
    ========================================================= */

    function findVideoUrl(
        data
    ) {

        if (
            !data ||
            typeof data !== "object"
        ) {
            return "";
        }


        const keys = [

            "videoUrl",
            "videoURL",
            "video_url",

            "videoSrc",
            "videoSource",

            "mediaUrl",
            "mediaURL",
            "media_url",

            "fileUrl",
            "fileURL",

            "downloadURL",
            "downloadUrl",

            "secureUrl",
            "secure_url",

            "cloudinaryUrl",
            "cloudinaryURL",

            "playbackUrl",
            "playbackURL",

            "streamUrl",
            "streamURL",

            "sourceUrl",
            "sourceURL"
        ];


        const found =
            findUrlDeep(
                data,
                keys
            );


        if (found) {
            return found;
        }


        /*
         * video can itself be URL
         */
        if (
            validString(
                data.video
            )
        ) {

            const video =
                data.video.trim();


            if (
                /^https?:\/\//i.test(
                    video
                )
            ) {

                return video;
            }
        }


        /*
         * media can itself be URL
         */
        if (
            validString(
                data.media
            )
        ) {

            const media =
                data.media.trim();


            if (
                /^https?:\/\//i.test(
                    media
                )
            ) {

                return media;
            }
        }


        return "";
    }


    /* =========================================================
       FIND THUMBNAIL
    ========================================================= */

    function findThumbnailUrl(
        data
    ) {

        if (
            !data ||
            typeof data !== "object"
        ) {
            return "";
        }


        const keys = [

            "thumbnailUrl",
            "thumbnailURL",
            "thumbnail_url",

            "thumbnail",

            "coverUrl",
            "coverURL",
            "cover_url",

            "cover",

            "posterUrl",
            "posterURL",

            "poster",

            "thumbUrl",
            "thumbURL",

            "imageUrl",
            "imageURL",

            "image"
        ];


        return findUrlDeep(
            data,
            keys
        );
    }


    /* =========================================================
       COLLABORATION
    ========================================================= */

    function getCollaborationData(
        data
    ) {

        if (
            !data ||
            typeof data !== "object"
        ) {
            return null;
        }


        const keys = [

            "collaboration",
            "collab",
            "collaborators",

            "collaborationData",
            "collabData",

            "taggedUsers",
            "taggedUserIds",

            "mentions",
            "mentionedUsers"
        ];


        for (const key of keys) {

            if (
                data[key] !== undefined &&
                data[key] !== null
            ) {

                return data[key];
            }
        }


        return null;
    }


    /* =========================================================
       EXISTING VIDEO
    ========================================================= */

    function getExistingVideoUrl() {

        /*
         * Remote URL
         */
        if (
            validString(
                state.videoUrl
            )
        ) {

            return state.videoUrl.trim();
        }


        /*
         * Local object URL
         */
        if (
            state.videoBlob &&
            validString(
                state.videoObjectUrl
            )
        ) {

            return state.videoObjectUrl;
        }


        /*
         * Loaded database data
         */
        const found =
            findVideoUrl(
                state.data
            );


        if (found) {
            return found;
        }


        return "";
    }


    /* =========================================================
       VIDEO SOURCE
    ========================================================= */

    function setVideoSource(
        video,
        url
    ) {

        if (
            !video ||
            !validString(url)
        ) {
            return false;
        }


        try {

            video.pause();


            /*
             * Clear old source
             */
            video.removeAttribute(
                "src"
            );


            while (
                video.firstChild
            ) {

                video.removeChild(
                    video.firstChild
                );
            }


            /*
             * Set new source
             */
            video.src =
                url.trim();


            video.preload =
                "metadata";

            video.muted =
                true;

            video.playsInline =
                true;


            video.setAttribute(
                "playsinline",
                ""
            );


            video.setAttribute(
                "webkit-playsinline",
                ""
            );


            video.load();


            return true;

        } catch (error) {

            console.error(
                "VIEWORA setVideoSource failed:",
                error
            );

            return false;
        }
    }


    /* =========================================================
       LOAD ALL VIDEO PREVIEWS
    ========================================================= */

    function loadAllVideos(
        url
    ) {

        if (
            !validString(url)
        ) {
            return false;
        }


        const videos = [

            $("thumbnailVideo"),

            $("previewVideo"),

            $("frameVideo"),

            $("fullPreviewVideo")
        ];


        let loaded =
            false;


        videos.forEach(
            video => {

                if (!video) {
                    return;
                }


                if (
                    setVideoSource(
                        video,
                        url
                    )
                ) {

                    loaded =
                        true;
                }
            }
        );


        return loaded;
    }


    /* =========================================================
       VIDEO EVENTS
    ========================================================= */

    function attachVideoEvents(
        video
    ) {

        if (!video) {
            return;
        }


        video.addEventListener(
            "loadedmetadata",
            () => {

                updatePreview();

                updateChecklist();

                updateFrameControls();
            }
        );


        video.addEventListener(
            "canplay",
            () => {

                updateChecklist();
            }
        );


        video.addEventListener(
            "error",
            () => {

                const error =
                    video.error;


                console.error(
                    "VIEWORA video playback error:",
                    {
                        code:
                            error?.code,

                        message:
                            error?.message,

                        src:
                            video.currentSrc ||
                            video.src
                    }
                );


                /*
                 * Only show one user-facing error.
                 */
                if (
                    video ===
                    $("previewVideo")
                ) {

                    toast(
                        "Video cannot play",
                        "The video URL is unavailable or the format is not supported.",
                        "error"
                    );
                }
            }
        );
    }


    /* =========================================================
       THUMBNAIL DISPLAY
    ========================================================= */

    function showThumbnail(
        url
    ) {

        state.thumbnailUrl =
            validString(url)
                ? url.trim()
                : "";


        const image =
            $("thumbnailImage");

        const video =
            $("thumbnailVideo");

        const placeholder =
            $("thumbnailPlaceholder");


        /*
         * Custom thumbnail
         */
        if (
            image &&
            state.thumbnailUrl
        ) {

            image.src =
                state.thumbnailUrl;


            image.classList.remove(
                "hidden"
            );


            if (video) {

                video.classList.add(
                    "hidden"
                );
            }


            if (placeholder) {

                placeholder.classList.add(
                    "hidden"
                );
            }


            return;
        }


        /*
         * Video fallback
         */
        if (
            video &&
            state.videoUrl
        ) {

            video.classList.remove(
                "hidden"
            );


            if (image) {

                image.classList.add(
                    "hidden"
                );
            }


            if (placeholder) {

                placeholder.classList.add(
                    "hidden"
                );
            }


            return;
        }


        /*
         * Nothing available
         */
        if (image) {

            image.classList.add(
                "hidden"
            );
        }


        if (video) {

            video.classList.add(
                "hidden"
            );
        }


        if (placeholder) {

            placeholder.classList.remove(
                "hidden"
            );
        }
    }


    /* =========================================================
       THUMBNAIL PICKER
    ========================================================= */

    function openThumbnailPicker() {

        const input =
            $("thumbnailInput");


        if (input) {

            input.click();
        }
    }


    /* =========================================================
       STORAGE UPLOAD WITH PROGRESS
    ========================================================= */

    function putFileWithProgress(
        ref,
        file,
        onProgress,
        options = {}
    ) {

        return new Promise(
            (resolve, reject) => {

                if (!ref) {

                    reject(
                        new Error(
                            "Firebase Storage reference is missing."
                        )
                    );

                    return;
                }


                if (!file) {

                    reject(
                        new Error(
                            "Upload file is missing."
                        )
                    );

                    return;
                }


                let task = null;

                let finished =
                    false;


                const isImage =
                    Boolean(
                        file.type &&
                        file.type.startsWith(
                            "image/"
                        )
                    );


                /*
                 * Images: 90s timeout
                 * Videos: 5 minutes
                 */
                const timeoutMs =
                    Number(
                        options.timeoutMs
                    ) ||
                    (
                        isImage
                            ? 90000
                            : 300000
                    );


                const timeout =
                    setTimeout(() => {

                        if (finished) {
                            return;
                        }


                        try {

                            if (task) {
                                task.cancel();
                            }

                        } catch (_) {}


                        finished =
                            true;


                        reject(
                            new Error(
                                isImage
                                    ? "Thumbnail upload timed out. Check your internet and Firebase Storage rules."
                                    : "Video upload timed out. Please check your internet connection and try again."
                            )
                        );

                    }, timeoutMs);


                const finish = (
                    callback,
                    value
                ) => {

                    if (finished) {
                        return;
                    }


                    finished =
                        true;


                    clearTimeout(
                        timeout
                    );


                    try {

                        if (typeof stallTimer !== "undefined" && stallTimer) {
                            clearTimeout(stallTimer);
                        }

                    } catch (_) {}


                    callback(
                        value
                    );
                };


                try {

                    const contentType =
                        file.type ||
                        (
                            isImage
                                ? "image/jpeg"
                                : "video/mp4"
                        );


                    task =
                        ref.put(
                            file,
                            {
                                contentType
                            }
                        );

                } catch (error) {

                    finish(
                        reject,
                        error
                    );

                    return;
                }


                let lastTransferred = 0;
                let stallTimer = null;

                const stallMs =
                    isImage ? 15000 : 25000;

                const armStallWatch = () => {

                    if (stallTimer) {
                        clearTimeout(stallTimer);
                    }

                    stallTimer =
                        setTimeout(() => {

                            if (finished) {
                                return;
                            }

                            if (
                                lastTransferred > 0
                            ) {
                                return;
                            }

                            try {

                                if (task) {
                                    task.cancel();
                                }

                            } catch (_) {}

                            finished =
                                true;

                            clearTimeout(
                                timeout
                            );

                            reject(
                                new Error(
                                    "Upload did not start. Check Firebase Storage is enabled and rules allow authenticated write to shorts/{userId}/..."
                                )
                            );

                        }, stallMs);
                };

                armStallWatch();

                task.on(
                    "state_changed",

                    snapshot => {

                        const total =
                            Number(
                                snapshot.totalBytes
                            ) || 0;


                        const transferred =
                            Number(
                                snapshot.bytesTransferred
                            ) || 0;


                        lastTransferred =
                            transferred;


                        if (transferred > 0 && stallTimer) {

                            clearTimeout(
                                stallTimer
                            );

                            stallTimer =
                                null;
                        }


                        if (
                            total > 0 &&
                            typeof onProgress ===
                            "function"
                        ) {

                            const percent =
                                Math.round(
                                    (
                                        transferred /
                                        total
                                    ) * 100
                                );


                            onProgress(
                                Math.max(
                                    0,
                                    Math.min(
                                        100,
                                        percent
                                    )
                                )
                            );
                        }
                    },


                    error => {

                        console.error(
                            "VIEWORA Firebase Storage upload error:",
                            error
                        );


                        let message =
                            error?.message ||
                            (
                                isImage
                                    ? "Thumbnail upload failed."
                                    : "Video upload failed."
                            );


                        switch (
                            error?.code
                        ) {

                            case "storage/unauthorized":

                                message =
                                    "Firebase Storage permission denied. Please check your Storage rules (allow authenticated uploads to shorts/).";

                                break;


                            case "storage/canceled":

                                message =
                                    "Upload was canceled.";

                                break;


                            case "storage/retry-limit-exceeded":

                                message =
                                    "Upload retry limit reached. Check your internet connection.";

                                break;


                            case "storage/quota-exceeded":

                                message =
                                    "Firebase Storage quota has been exceeded.";

                                break;


                            case "storage/unknown":

                                message =
                                    "Firebase Storage returned an unknown error. Check Storage is enabled and rules allow write.";

                                break;
                        }


                        finish(
                            reject,
                            new Error(
                                message
                            )
                        );
                    },


                    async () => {

                        try {

                            const url =
                                await task
                                    .snapshot
                                    .ref
                                    .getDownloadURL();


                            if (
                                !validString(url)
                            ) {

                                throw new Error(
                                    "Upload completed but Firebase did not return a download URL."
                                );
                            }


                            finish(
                                resolve,
                                url
                            );

                        } catch (error) {

                            finish(
                                reject,
                                error
                            );
                        }
                    }
                );
            }
        );
    }


    /* =========================================================
       UPLOAD LOCAL VIDEO
    ========================================================= */

    async function uploadLocalVideoIfNeeded() {

        /*
         * Existing remote URL
         *
         * NEVER upload it again.
         */
        if (
            validString(state.videoUrl) &&
            /^https?:\/\//i.test(
                state.videoUrl
            )
        ) {

            console.log(
                "VIEWORA: Existing remote video found. Upload skipped."
            );

            return state.videoUrl;
        }


        /*
         * Load IndexedDB Blob
         */
        if (!state.videoBlob) {

            console.log(
                "VIEWORA: Loading local video from IndexedDB..."
            );


            const blob =
                await loadVideoBlobFromIndexedDB();


            if (blob) {

                state.videoBlob =
                    blob;
            }
        }


        /*
         * Still missing
         */
        if (!state.videoBlob) {

            throw new Error(
                "Local Short video is missing. Please go back to the editor and upload or record the video again."
            );
        }


        console.log(
            "VIEWORA: Local video ready:",
            {
                size:
                    state.videoBlob.size,

                type:
                    state.videoBlob.type
            }
        );


        /*
         * Auth
         */
        const user =
            await waitForSignedInUser();


        if (!user) {

            throw new Error(
                "Please sign in before saving your Short."
            );
        }


        state.uid =
            user.uid;


        /*
         * Upload backend: Cloudinary preferred.
         * Firebase Storage is only a fallback.
         */
        if (!storage) {

            try {

                if (
                    typeof firebase !== "undefined" &&
                    typeof firebase.storage ===
                    "function"
                ) {

                    storage =
                        firebase.storage();
                }

            } catch (error) {

                console.error(
                    "VIEWORA Storage initialization failed:",
                    error
                );
            }
        }


        if (
            !cloudinaryReady() &&
            !storage
        ) {

            throw new Error(
                "No upload backend ready. Set Cloudinary (VIEWORA_CLOUDINARY_CLOUD + VIEWORA_CLOUDINARY_PRESET) or enable Firebase Storage."
            );
        }


        /*
         * Short ID BEFORE upload
         */
        await ensureShortId();


        /*
         * Extension
         */
        let extension =
            "mp4";


        const mime =
            String(
                state.videoBlob.type ||
                ""
            ).toLowerCase();


        if (
            mime.includes(
                "webm"
            )
        ) {

            extension =
                "webm";

        } else if (
            mime.includes(
                "quicktime"
            )
        ) {

            extension =
                "mov";

        } else if (
            mime.includes(
                "mp4"
            )
        ) {

            extension =
                "mp4";
        }


        /*
         * Storage path
         */
        const path =
            `shorts/${user.uid}/${state.shortId}/video_${Date.now()}.${extension}`;


        console.log(
            "VIEWORA: Starting video upload:",
            {
                path,
                shortId:
                    state.shortId,
                uid:
                    user.uid,
                size:
                    state.videoBlob.size,
                type:
                    state.videoBlob.type
            }
        );


        const ref =
            storage
                .ref()
                .child(
                    path
                );


        setProgress(
            10
        );


        /*
         * Upload (Cloudinary preferred, Storage fallback)
         */
        const url =
            await uploadMediaFile(
                state.videoBlob,
                {
                    resourceType:
                        "video",

                    user,

                    path,

                    onProgress:
                        percent => {

                            const progress =
                                10 +
                                Math.round(
                                    percent * 0.70
                                );


                            setProgress(
                                progress
                            );
                        }
                }
            );


        if (
            !validString(url)
        ) {

            throw new Error(
                "Video upload completed but the URL is empty."
            );
        }


        /*
         * Firebase URL becomes source of truth
         */
        state.videoUrl =
            url;


        state.isNew =
            false;


        setProgress(
            85
        );


        /*
         * Refresh previews
         */
        loadAllVideos(
            url
        );


        updateChecklist();


        console.log(
            "VIEWORA: Video upload completed successfully."
        );


        return url;
    }


    /* =========================================================
       THUMBNAIL UPLOAD
    ========================================================= */

    async function uploadThumbnail(
        file
    ) {

        if (!file) {
            return false;
        }


        if (
            !file.type ||
            !file.type.startsWith(
                "image/"
            )
        ) {

            toast(
                "Invalid image",
                "Please select an image file.",
                "error"
            );

            return false;
        }


        /*
         * Always show local preview instantly.
         * This avoids "stuck on Uploading thumbnail"
         * when Firebase Storage is slow / blocked.
         */
        try {

            if (state.thumbnailObjectUrl) {

                try {

                    URL.revokeObjectURL(
                        state.thumbnailObjectUrl
                    );

                } catch (_) {}
            }


            state.thumbnailFile =
                file;


            state.thumbnailObjectUrl =
                URL.createObjectURL(
                    file
                );


            showThumbnail(
                state.thumbnailObjectUrl
            );


            markDirty();

        } catch (previewError) {

            console.warn(
                "VIEWORA local thumbnail preview failed:",
                previewError
            );
        }


        const hasRemoteVideo =
            validString(
                state.videoUrl
            ) &&
            /^https?:\/\//i.test(
                state.videoUrl
            );


        /*
         * NEW Short / local-only video:
         * keep thumbnail local until Publish / Save draft.
         * No Firebase Storage call here → no hang.
         */
        if (
            state.isNew ||
            !hasRemoteVideo
        ) {

            toast(
                "Thumbnail ready",
                "Cover selected. It will upload when you publish."
            );


            return true;
        }


        /*
         * Existing published Short with remote video:
         * upload thumbnail to Storage + save DB.
         */
        let user =
            getCurrentUser();


        if (!user) {

            try {

                user =
                    await waitForSignedInUser(
                        10000
                    );

            } catch (error) {

                toast(
                    "Sign in required",
                    error.message ||
                    "Please sign in first.",
                    "error"
                );

                return false;
            }
        }


        if (!user) {

            toast(
                "Sign in required",
                "Please sign in before changing your thumbnail.",
                "error"
            );

            return false;
        }


        state.uid =
            user.uid;


        if (
            !validId(
                state.shortId
            )
        ) {

            try {

                await ensureShortId();

            } catch (error) {

                toast(
                    "Short ID error",
                    error.message,
                    "error"
                );

                return false;
            }
        }


        if (!storage) {

            try {

                if (
                    typeof firebase !== "undefined" &&
                    typeof firebase.storage ===
                    "function"
                ) {

                    storage =
                        firebase.storage();
                }

            } catch (_) {}
        }


        if (
            !cloudinaryReady() &&
            !storage
        ) {

            toast(
                "Upload backend unavailable",
                "Cloudinary / Storage not ready. Cover kept locally.",
                "warning"
            );

            return true;
        }


        try {

            showProcessing(
                "Uploading thumbnail",
                "Saving your cover image..."
            );


            setProgress(
                10
            );


            const path =
                `shorts/${user.uid}/${state.shortId}/thumbnail_${Date.now()}.jpg`;


            const url =
                await uploadMediaFile(
                    file,
                    {
                        resourceType:
                            "image",

                        user,

                        path,

                        onProgress:
                            percent => {

                                setProgress(
                                    10 +
                                    Math.round(
                                        percent * 0.80
                                    )
                                );
                            }
                    }
                );


            if (
                !validString(url)
            ) {

                throw new Error(
                    "Thumbnail URL is empty."
                );
            }


            state.thumbnailUrl =
                url;


            state.thumbnailFile =
                null;


            showThumbnail(
                url
            );


            setProgress(
                90
            );


            await saveData(
                {
                    thumbnailUrl:
                        url
                },
                false
            );


            setProgress(
                100
            );


            hideProcessing();


            toast(
                "Thumbnail updated",
                "Your Short cover has been saved."
            );


            return true;

        } catch (error) {

            console.error(
                "VIEWORA thumbnail upload failed:",
                error
            );


            hideProcessing();


            /*
             * Keep local preview even if Storage failed.
             */
            toast(
                "Upload delayed",
                (
                    error.message ||
                    "Could not upload thumbnail now."
                ) +
                " Cover is saved on this device and will retry on publish.",
                "warning"
            );


            return true;
        }
    }


    /* =========================================================
       UPLOAD PENDING THUMBNAIL (on publish / draft)
    ========================================================= */

    async function uploadPendingThumbnailIfNeeded(
        user
    ) {

        /*
         * Already have remote https thumbnail.
         */
        if (
            validString(
                state.thumbnailUrl
            ) &&
            /^https?:\/\//i.test(
                state.thumbnailUrl
            )
        ) {

            return state.thumbnailUrl;
        }


        const file =
            state.thumbnailFile;


        if (!file) {
            return "";
        }


        if (!user) {

            user =
                await waitForSignedInUser(
                    10000
                );
        }


        if (!storage) {

            try {

                storage =
                    firebase.storage();

            } catch (_) {}
        }


        if (
            !cloudinaryReady() &&
            !storage
        ) {

            console.warn(
                "VIEWORA: No Cloudinary / Storage — thumbnail skipped."
            );

            return "";
        }


        await ensureShortId();


        const path =
            `shorts/${user.uid}/${state.shortId}/thumbnail_${Date.now()}.jpg`;


        showProcessing(
            "Uploading thumbnail",
            "Saving your cover image..."
        );


        const url =
            await uploadMediaFile(
                file,
                {
                    resourceType:
                        "image",

                    user,

                    path,

                    onProgress:
                        percent => {

                            setProgress(
                                82 +
                                Math.round(
                                    percent * 0.10
                                )
                            );
                        }
                }
            );


        if (
            validString(url)
        ) {

            state.thumbnailUrl =
                url;


            state.thumbnailFile =
                null;


            showThumbnail(
                url
            );
        }


        return url || "";
    }


    /* =========================================================
       FRAME SELECTOR
    ========================================================= */

    function openFrameSelector() {

        const url =
            getExistingVideoUrl();


        if (!url) {

            toast(
                "Video unavailable",
                "The Short video could not be loaded.",
                "error"
            );

            return;
        }


        const overlay =
            $("frameSelector");


        const video =
            $("frameVideo");


        if (
            !overlay ||
            !video
        ) {
            return;
        }


        setVideoSource(
            video,
            url
        );


        overlay.classList.remove(
            "hidden"
        );


        setTimeout(
            () => {

                if (
                    Number.isFinite(
                        video.duration
                    ) &&
                    video.duration > 0
                ) {

                    video.currentTime =
                        0;

                    updateFrameControls();
                }

            },
            300
        );
    }


    function closeFrameSelector() {

        const overlay =
            $("frameSelector");


        if (overlay) {

            overlay.classList.add(
                "hidden"
            );
        }
    }


    /* =========================================================
       FRAME CONTROLS
    ========================================================= */

    function updateFrameControls() {

        const video =
            $("frameVideo");


        const range =
            $("frameRange");


        if (
            !video ||
            !range
        ) {
            return;
        }


        if (
            !Number.isFinite(
                video.duration
            ) ||
            video.duration <= 0
        ) {
            return;
        }


        range.value =
            (
                video.currentTime /
                video.duration
            ) * 100;


        const current =
            $("frameCurrentTime");


        const duration =
            $("frameDuration");


        if (current) {

            current.textContent =
                formatTime(
                    video.currentTime
                );
        }


        if (duration) {

            duration.textContent =
                formatTime(
                    video.duration
                );
        }
    }


    /* =========================================================
       CAPTURE FRAME
    ========================================================= */

    async function captureVideoFrame() {

        const video =
            $("frameVideo");


        if (!video) {
            return;
        }


        if (
            !video.videoWidth ||
            !video.videoHeight
        ) {

            toast(
                "Frame unavailable",
                "Wait until the video has loaded.",
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
                video.videoWidth;


            canvas.height =
                video.videoHeight;


            const ctx =
                canvas.getContext(
                    "2d"
                );


            if (!ctx) {

                throw new Error(
                    "Canvas is unavailable."
                );
            }


            ctx.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );


            const blob =
                await new Promise(
                    resolve => {

                        canvas.toBlob(
                            resolve,
                            "image/jpeg",
                            0.90
                        );
                    }
                );


            if (!blob) {

                throw new Error(
                    "Could not create thumbnail."
                );
            }


            /*
             * Close frame selector
             */
            closeFrameSelector();


            /*
             * Upload
             */
            const file =
                new File(
                    [blob],
                    "thumbnail.jpg",
                    {
                        type:
                            "image/jpeg"
                    }
                );


            await uploadThumbnail(
                file
            );

        } catch (error) {

            console.error(
                "VIEWORA frame capture failed:",
                error
            );


            toast(
                "Frame failed",
                error.message ||
                "Could not create thumbnail.",
                "error"
            );
        }
    }


    /* =========================================================
       READ FORM
    ========================================================= */

    function readForm() {

        const title =
            $("shortTitle")
                ?.value ||
            "";


        const description =
            $("shortDescription")
                ?.value ||
            "";


        const hashtags =
            $("shortHashtags")
                ?.value ||
            "";


        /*
         * Visibility
         */
        const activeVisibility =
            qs(
                ".visibilityOption.active"
            );


        if (activeVisibility) {

            state.visibility =
                activeVisibility.dataset
                    .visibility ||
                "public";
        }


        /*
         * Settings
         */
        if (
            $("showLikeCount")
        ) {

            state.showLikeCount =
                $("showLikeCount")
                    .checked;
        }


        if (
            $("allowComments")
        ) {

            state.allowComments =
                $("allowComments")
                    .checked;
        }


        if (
            $("showCommentCount")
        ) {

            state.showCommentCount =
                $("showCommentCount")
                    .checked;
        }


        if (
            $("allowRemix")
        ) {

            state.allowRemix =
                $("allowRemix")
                    .checked;
        }


        if (
            $("allowDownload")
        ) {

            state.allowDownload =
                $("allowDownload")
                    .checked;
        }


        if (
            $("allowSharing")
        ) {

            state.allowSharing =
                $("allowSharing")
                    .checked;
        }


        if (
            $("audienceSetting")
        ) {

            state.audience =
                $("audienceSetting")
                    .value ||
                "general";
        }


        if (
            $("languageSetting")
        ) {

            state.language =
                $("languageSetting")
                    .value ||
                "auto";
        }


        return {

            title:
                title.trim(),

            description:
                description.trim(),

            hashtags:
                hashtags.trim(),

            visibility:
                state.visibility,

            showLikeCount:
                state.showLikeCount,

            allowComments:
                state.allowComments,

            showCommentCount:
                state.showCommentCount,

            allowRemix:
                state.allowRemix,

            allowDownload:
                state.allowDownload,

            allowSharing:
                state.allowSharing,

            audience:
                state.audience,

            language:
                state.language
        };
    }


    /* =========================================================
       PRESERVE METADATA
    ========================================================= */

    function buildPreservedMetadata() {

        const data =
            state.data || {};


        const payload =
            {};


        /*
         * Collaboration
         */
        const collaboration =
            getCollaborationData(
                data
            );


        if (
            collaboration !== null
        ) {

            payload.collaboration =
                collaboration;
        }


        /*
         * Tags / mentions
         */
        const tagKeys = [

            "tags",

            "taggedUsers",

            "taggedUserIds",

            "mentions",

            "mentionedUsers"
        ];


        tagKeys.forEach(
            key => {

                if (
                    data[key] !== undefined
                ) {

                    payload[key] =
                        data[key];
                }
            }
        );


        /*
         * Music / audio
         */
        const musicKeys = [

            "music",

            "musicName",

            "musicTitle",

            "musicId",

            "audio",

            "audioUrl",

            "soundId",

            "soundName"
        ];


        musicKeys.forEach(
            key => {

                if (
                    data[key] !== undefined
                ) {

                    payload[key] =
                        data[key];
                }
            }
        );


        return payload;
    }


    /* =========================================================
       POPULATE FORM
    ========================================================= */

    function populateForm(
        data
    ) {

        if (!data) {
            return;
        }


        /*
         * TITLE
         */
        if (
            $("shortTitle")
        ) {

            $("shortTitle").value =
                cleanText(
                    data.title ||
                    data.shortTitle ||
                    data.name
                );
        }


        /*
         * DESCRIPTION
         */
        if (
            $("shortDescription")
        ) {

            $("shortDescription").value =
                safeString(
                    data.description ||
                    data.shortDescription
                );
        }


        /*
         * HASHTAGS
         */
        if (
            $("shortHashtags")
        ) {

            let tags =
                data.hashtags;


            if (
                tags === undefined ||
                tags === null
            ) {

                tags =
                    data.tags;
            }


            if (
                Array.isArray(tags)
            ) {

                tags =
                    tags
                        .map(
                            item =>
                                String(item)
                        )
                        .join(" ");
            }


            $("shortHashtags").value =
                safeString(
                    tags
                );
        }


        /*
         * VISIBILITY
         */
        const visibility =
            data.visibility ||
            "public";


        qsa(
            ".visibilityOption"
        ).forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .visibility ===
                    visibility
                );
            }
        );


        state.visibility =
            visibility;


        /*
         * CHECKBOX HELPER
         */
        const setCheck =
            (
                id,
                value
            ) => {

                const element =
                    $(id);


                if (!element) {
                    return;
                }


                element.checked =
                    value !== false;
            };


        setCheck(
            "showLikeCount",
            data.showLikeCount
        );


        setCheck(
            "allowComments",
            data.allowComments
        );


        setCheck(
            "showCommentCount",
            data.showCommentCount
        );


        setCheck(
            "allowRemix",
            data.allowRemix
        );


        setCheck(
            "allowDownload",
            data.allowDownload
        );


        setCheck(
            "allowSharing",
            data.allowSharing
        );


        /*
         * SELECTS
         */
        if (
            $("audienceSetting")
        ) {

            $("audienceSetting").value =
                data.audience ||
                data.audienceSetting ||
                "general";
        }


        if (
            $("languageSetting")
        ) {

            $("languageSetting").value =
                data.language ||
                data.languageSetting ||
                "auto";
        }


        updateCounters();

        updatePreview();

        updateChecklist();
    }


    /* =========================================================
       COUNTERS
    ========================================================= */

    function updateCounters() {

        const title =
            $("shortTitle");


        const description =
            $("shortDescription");


        const titleCount =
            $("titleCount");


        const descriptionCount =
            $("descriptionCount");


        if (
            title &&
            titleCount
        ) {

            titleCount.textContent =
                title.value.length;
        }


        if (
            description &&
            descriptionCount
        ) {

            descriptionCount.textContent =
                description.value.length;
        }
    }


    /* =========================================================
       PREVIEW
    ========================================================= */

    function updatePreview() {

        const title =
            cleanText(
                $("shortTitle")
                    ?.value,
                "Your Short title"
            );


        const description =
            cleanText(
                $("shortDescription")
                    ?.value,
                "Your description will appear here."
            );


        /*
         * Titles
         */
        if (
            $("previewTitle")
        ) {

            $("previewTitle")
                .textContent =
                title;
        }


        if (
            $("previewDescription")
        ) {

            $("previewDescription")
                .textContent =
                description;
        }


        if (
            $("fullPreviewTitle")
        ) {

            $("fullPreviewTitle")
                .textContent =
                title;
        }


        if (
            $("fullPreviewDescription")
        ) {

            $("fullPreviewDescription")
                .textContent =
                description;
        }


        /*
         * Counts
         */
        const rawLikes =
            state.data?.likes ??
            state.data?.likeCount ??
            0;


        const rawComments =
            state.data?.comments ??
            state.data?.commentCount ??
            0;


        const likes =
            Number(rawLikes);


        const comments =
            Number(rawComments);


        if (
            $("previewLikes")
        ) {

            $("previewLikes")
                .textContent =
                state.showLikeCount
                    ? String(
                        Number.isFinite(
                            likes
                        )
                            ? likes
                            : 0
                    )
                    : "Like";
        }


        if (
            $("previewComments")
        ) {

            $("previewComments")
                .textContent =
                state.showCommentCount
                    ? String(
                        Number.isFinite(
                            comments
                        )
                            ? comments
                            : 0
                    )
                    : "Comment";
        }


        /*
         * Comment action
         */
        const commentAction =
            $("previewCommentAction");


        if (commentAction) {

            commentAction.style.display =
                state.allowComments
                    ? ""
                    : "none";
        }


        /*
         * Music
         */
        const music =
            $("previewMusic");


        if (music) {

            const name =
                state.data?.musicName ||
                state.data?.musicTitle ||
                state.data?.soundName ||
                "Original audio";


            const span =
                music.querySelector(
                    "span"
                );


            if (span) {

                span.textContent =
                    name;
            }
        }
    }


    /* =========================================================
       CHECKLIST
    ========================================================= */

    function updateChecklist() {

        const videoCheck =
            $("checkVideo");


        const titleCheck =
            $("checkTitle");


        const visibilityCheck =
            $("checkVisibility");


        if (videoCheck) {

            videoCheck.classList.toggle(
                "complete",
                Boolean(
                    getExistingVideoUrl()
                )
            );
        }


        if (titleCheck) {

            const title =
                $("shortTitle")
                    ?.value
                    ?.trim() ||
                "";


            titleCheck.classList.toggle(
                "complete",
                Boolean(title)
            );
        }


        if (visibilityCheck) {

            visibilityCheck.classList.toggle(
                "complete",
                Boolean(
                    state.visibility
                )
            );
        }


        const summary =
            $("publishSummary");


        if (summary) {

            if (
                state.visibility ===
                "public"
            ) {

                summary.textContent =
                    "Your Short will be public.";

            } else if (
                state.visibility ===
                "unlisted"
            ) {

                summary.textContent =
                    "Your Short will be unlisted.";

            } else {

                summary.textContent =
                    "Your Short will be private.";
            }
        }
    }


    /* =========================================================
       BUILD SAVE PAYLOAD
    ========================================================= */

    function buildSavePayload(
        extra = {}
    ) {

        const form =
            readForm();


        /*
         * IMPORTANT:
         *
         * Existing REMOTE video URL is preserved.
         * blob: / local object URLs must NEVER be written
         * to Firebase (they are device-local only).
         * Empty videoUrl is NEVER intentionally written.
         */
        let existingVideo =
            getExistingVideoUrl();


        if (
            validString(existingVideo) &&
            (
                existingVideo.startsWith(
                    "blob:"
                ) ||
                existingVideo.startsWith(
                    "data:"
                )
            )
        ) {

            existingVideo =
                "";
        }


        if (
            !validString(existingVideo) ||
            !/^https?:\/\//i.test(
                existingVideo
            )
        ) {

            existingVideo =
                "";
        }


        let existingThumbnail =
            state.thumbnailUrl ||
            findThumbnailUrl(
                state.data
            ) ||
            "";


        if (
            validString(existingThumbnail) &&
            (
                existingThumbnail.startsWith(
                    "blob:"
                ) ||
                existingThumbnail.startsWith(
                    "data:"
                )
            )
        ) {

            existingThumbnail =
                "";
        }


        if (
            validString(existingThumbnail) &&
            !/^https?:\/\//i.test(
                existingThumbnail
            )
        ) {

            existingThumbnail =
                "";
        }


        const payload = {

            /*
             * Editable fields
             */
            ...form,


            /*
             * Existing metadata
             */
            ...buildPreservedMetadata(),


            /*
             * ID
             */
            shortId:
                state.shortId,


            /*
             * Video
             *
             * Only include real https URLs.
             */
            ...(existingVideo
                ? {
                    videoUrl:
                        existingVideo
                }
                : {}),


            /*
             * Thumbnail
             */
            ...(existingThumbnail
                ? {
                    thumbnailUrl:
                        existingThumbnail
                }
                : {}),


            /*
             * User
             */
            ...(state.uid
                ? {
                    uid:
                        state.uid
                }
                : {}),


            /*
             * Extra fields
             */
            ...extra,


            /*
             * Timestamp
             */
            updatedAt:
                firebase.database
                    .ServerValue
                    .TIMESTAMP
        };


        /*
         * Remove undefined / NaN
         */
        Object.keys(
            payload
        ).forEach(
            key => {

                const value =
                    payload[key];


                if (
                    value === undefined
                ) {

                    delete payload[key];

                    return;
                }


                if (
                    typeof value ===
                    "number" &&
                    !Number.isFinite(
                        value
                    )
                ) {

                    delete payload[key];
                }
            }
        );


        return payload;
    }


    /* =========================================================
       SAVE DATA
    ========================================================= */

    async function saveData(
        extra = {},
        showToast = true
    ) {

        if (state.saving) {

            console.warn(
                "VIEWORA save already running."
            );

            return false;
        }


        if (!firebaseReady()) {

            hideProcessing();

            if (showToast) {

                toast(
                    "Firebase unavailable",
                    "Firebase has not been initialized.",
                    "error"
                );
            }

            return false;
        }


        /*
         * Refresh DB reference if necessary
         */
        if (!db) {

            try {

                db =
                    firebase.database();

            } catch (_) {}
        }


        if (!db) {

            hideProcessing();

            if (showToast) {

                toast(
                    "Database unavailable",
                    "Firebase Realtime Database is not ready.",
                    "error"
                );
            }

            return false;
        }


        try {

            state.saving =
                true;


            /*
             * Determine video state.
             */
            const hasRemoteVideo =
                validString(
                    state.videoUrl
                ) &&
                /^https?:\/\//i.test(
                    state.videoUrl
                );


            const hasLocalVideo =
                Boolean(
                    state.videoBlob
                ) ||
                (
                    validString(
                        state.videoUrl
                    ) &&
                    state.videoUrl
                        .startsWith(
                            "blob:"
                        )
                );


            const needsUpload =
                !hasRemoteVideo &&
                (
                    state.isNew ||
                    hasLocalVideo
                );


            console.log(
                "VIEWORA save:",
                {
                    shortId:
                        state.shortId,

                    uid:
                        state.uid,

                    isNew:
                        state.isNew,

                    hasRemoteVideo,

                    hasLocalVideo,

                    needsUpload
                }
            );


            /*
             * NEW SHORT:
             * upload IndexedDB video.
             */
            if (needsUpload) {

                showProcessing(
                    "Uploading Short",
                    "Uploading your video to Viewora..."
                );


                setProgress(
                    5
                );


                let remoteUrl = "";


                try {

                    remoteUrl =
                        await uploadLocalVideoIfNeeded();

                } catch (uploadError) {

                    console.error(
                        "VIEWORA video upload error in saveData:",
                        uploadError
                    );


                    throw new Error(
                        uploadError?.message ||
                        "Video upload failed. Check Firebase Storage rules and your internet connection."
                    );
                }


                if (
                    !validString(
                        remoteUrl
                    ) ||
                    !/^https?:\/\//i.test(
                        remoteUrl
                    )
                ) {

                    throw new Error(
                        "Video upload failed because no valid video URL was returned."
                    );
                }


                state.videoUrl =
                    remoteUrl;


                state.isNew =
                    false;


                setProgress(
                    82
                );


                showProcessing(
                    "Saving details",
                    "Writing your Short to the database..."
                );
            }


            /*
             * Existing Short should NEVER lose ID.
             */
            await ensureShortId();


            /*
             * Deferred thumbnail (selected while video was local).
             */
            if (
                state.thumbnailFile &&
                !(
                    validString(
                        state.thumbnailUrl
                    ) &&
                    /^https?:\/\//i.test(
                        state.thumbnailUrl
                    )
                )
            ) {

                try {

                    const thumbUser =
                        getCurrentUser() ||
                        await waitForSignedInUser(
                            10000
                        );


                    await uploadPendingThumbnailIfNeeded(
                        thumbUser
                    );

                } catch (thumbError) {

                    console.warn(
                        "VIEWORA pending thumbnail upload failed:",
                        thumbError
                    );


                    /*
                     * Non-fatal: Short can still publish
                     * without custom thumbnail.
                     */
                }
            }


            if (
                !validId(
                    state.shortId
                )
            ) {

                throw new Error(
                    "This Short could not be identified."
                );
            }


            /*
             * Ensure UID where possible.
             */
            if (!state.uid) {

                const user =
                    getCurrentUser();


                if (user) {

                    state.uid =
                        user.uid;
                }
            }


            /*
             * Build final payload.
             */
            const payload =
                buildSavePayload(
                    extra
                );


            /*
             * New Short metadata.
             */
            const isFirstDatabaseWrite =
                state.isNew ||
                !state.data?.createdAt;


            if (
                isFirstDatabaseWrite
            ) {

                if (
                    payload.createdAt ===
                    undefined
                ) {

                    payload.createdAt =
                        firebase.database
                            .ServerValue
                            .TIMESTAMP;
                }


                if (!payload.type) {

                    payload.type =
                        "short";
                }


                if (!payload.mode) {

                    payload.mode =
                        "shorts";
                }
            }


            /*
             * PRIMARY DATABASE
             */
            console.log(
                "VIEWORA: Saving:",
                `shorts/${state.shortId}`
            );


            await db
                .ref(
                    `shorts/${state.shortId}`
                )
                .update(
                    payload
                );


            /*
             * USER MIRROR
             */
            if (state.uid) {

                try {

                    await db
                        .ref(
                            `users/${state.uid}/shorts/${state.shortId}`
                        )
                        .update(
                            payload
                        );

                } catch (mirrorError) {

                    console.warn(
                        "VIEWORA user mirror skipped:",
                        mirrorError
                    );
                }
            }


            /*
             * FEED INDEX
             *
             * Only published Shorts.
             */
            try {

                const isPublished =
                    payload.published ===
                        true ||
                    payload.status ===
                        "published";


                if (
                    isPublished &&
                    state.shortId
                ) {

                    const feedItem = {

                        shortId:
                            state.shortId,

                        uid:
                            state.uid ||
                            payload.uid ||
                            null,

                        videoUrl:
                            payload.videoUrl ||
                            state.videoUrl ||
                            "",

                        thumbnailUrl:
                            payload.thumbnailUrl ||
                            state.thumbnailUrl ||
                            "",

                        title:
                            payload.title ||
                            "",

                        description:
                            payload.description ||
                            "",

                        hashtags:
                            payload.hashtags ||
                            "",

                        visibility:
                            payload.visibility ||
                            "public",

                        publishedAt:
                            payload.publishedAt ||
                            firebase.database
                                .ServerValue
                                .TIMESTAMP,

                        type:
                            "short"
                    };


                    await db
                        .ref(
                            `feeds/shorts/${state.shortId}`
                        )
                        .update(
                            feedItem
                        );


                    if (state.uid) {

                        await db
                            .ref(
                                `feeds/users/${state.uid}/shorts/${state.shortId}`
                            )
                            .update(
                                feedItem
                            );
                    }
                }

            } catch (feedError) {

                console.warn(
                    "VIEWORA feed index skipped:",
                    feedError
                );
            }


            /*
             * Merge local state.
             */
            state.data = {

                ...state.data,

                ...payload
            };


            /*
             * Keep media alive.
             */
            if (
                validString(
                    payload.videoUrl
                )
            ) {

                state.videoUrl =
                    payload.videoUrl;
            }


            if (
                validString(
                    payload.thumbnailUrl
                )
            ) {

                state.thumbnailUrl =
                    payload.thumbnailUrl;
            }


            state.dirty =
                false;


            state.isNew =
                false;


            try {

                sessionStorage.removeItem(
                    PENDING_NEW_SHORT_KEY
                );

            } catch (_) {}


            const status =
                $("saveStatus");


            if (status) {

                status.textContent =
                    extra.status ===
                        "published"
                        ? "Published"
                        : extra.status ===
                            "draft"
                            ? "Draft saved"
                            : "Saved";
            }


            setProgress(
                100
            );


            hideProcessing();


            if (showToast) {

                toast(
                    "Saved",
                    "Your Short details have been saved."
                );
            }


            console.log(
                "VIEWORA: Short saved successfully.",
                state.shortId
            );


            return true;

        } catch (error) {

            console.error(
                "VIEWORA Short save failed:",
                error
            );


            hideProcessing();


            if (showToast) {

                toast(
                    "Save failed",
                    error?.message ||
                    "Could not save your Short.",
                    "error"
                );
            }


            return false;

        } finally {

            state.saving =
                false;

            /*
             * Safety: never leave the processing overlay stuck
             * if a caller forgot to hide it after saveData.
             */
            try {

                const overlay =
                    $("processingOverlay");


                if (
                    overlay &&
                    !overlay.classList.contains(
                        "hidden"
                    ) &&
                    !state.publishing
                ) {

                    hideProcessing();
                }

            } catch (_) {}
        }
    }


    /* =========================================================
       LOAD NEW SHORT FROM LOCAL
    ========================================================= */

    async function loadNewShortFromLocal() {

        setPageLoading(
            true
        );


        try {

            /*
             * User
             */
            const user =
                getCurrentUser();


            if (user) {

                state.uid =
                    user.uid;
            }


            /*
             * Editor metadata
             */
            const editorMeta =
                readEditorSessionData();


            state.editorMeta =
                editorMeta;


            if (editorMeta) {

                state.data = {

                    ...state.data,

                    ...editorMeta
                };


                /*
                 * Music compatibility
                 */
                if (
                    editorMeta.music
                ) {

                    state.data.music =
                        editorMeta.music;


                    state.data.musicName =
                        editorMeta.music.name ||
                        editorMeta.music.title ||
                        "Original audio";
                }


                populateForm({

                    title:
                        editorMeta.title ||
                        "",

                    description:
                        editorMeta.description ||
                        "",

                    hashtags:
                        editorMeta.hashtags ||
                        "",

                    visibility:
                        editorMeta.visibility ||
                        "public",

                    showLikeCount:
                        editorMeta.showLikeCount,

                    allowComments:
                        editorMeta.allowComments,

                    showCommentCount:
                        editorMeta.showCommentCount,

                    allowRemix:
                        editorMeta.allowRemix,

                    allowDownload:
                        editorMeta.allowDownload,

                    allowSharing:
                        editorMeta.allowSharing,

                    audience:
                        editorMeta.audience,

                    language:
                        editorMeta.language,

                    musicName:
                        editorMeta.music?.name ||
                        editorMeta.music?.title ||
                        "Original audio"
                });
            }


            /*
             * IndexedDB video
             */
            const blob =
                await loadVideoBlobFromIndexedDB();


            if (!blob) {

                toast(
                    "Video missing",
                    "No local Short video was found. Please go back to the editor and upload or record again.",
                    "error"
                );


                return false;
            }


            /*
             * Apply local video
             */
            applyLocalVideoBlob(
                blob
            );


            state.isNew =
                true;


            /*
             * New Short does NOT need Firebase ID
             * until save/upload.
             */
            state.shortId =
                null;


            state.loaded =
                true;


            state.dirty =
                false;


            const status =
                $("saveStatus");


            if (status) {

                status.textContent =
                    "Draft";
            }


            updatePreview();

            updateChecklist();


            console.log(
                "VIEWORA: New Short loaded from IndexedDB."
            );


            return true;

        } catch (error) {

            console.error(
                "VIEWORA new Short loading failed:",
                error
            );


            toast(
                "Loading failed",
                error.message ||
                "Could not load the local Short video.",
                "error"
            );


            return false;

        } finally {

            setPageLoading(
                false
            );
        }
    }


    /* =========================================================
       LOAD EXISTING SHORT
    ========================================================= */

    async function loadShort() {

        /*
         * Recover ID.
         */
        const recoveredId =
            getShortId();


        /*
         * User.
         */
        const user =
            getCurrentUser();


        if (user) {

            state.uid =
                user.uid;
        }


        /*
         * =====================================================
         * NEW SHORT PATH
         * =====================================================
         *
         * No ID + local IndexedDB video
         */
        if (
            !validId(
                recoveredId
            )
        ) {

            const blob =
                await loadVideoBlobFromIndexedDB();


            if (
                blob ||
                isFromEditor()
            ) {

                return await loadNewShortFromLocal();
            }


            toast(
                "No Short loaded",
                "Open Create → Shorts, add a video, then continue to Details.",
                "warning"
            );


            return false;
        }


        /*
         * =====================================================
         * EXISTING SHORT
         * =====================================================
         */
        state.shortId =
            recoveredId;


        persistShortId(
            state.shortId
        );


        if (!db) {

            try {

                db =
                    firebase.database();

            } catch (_) {}
        }


        if (!db) {

            toast(
                "Firebase unavailable",
                "Could not connect to Viewora database.",
                "error"
            );


            return false;
        }


        try {

            setPageLoading(
                true
            );


            /*
             * Primary path
             */
            let snapshot =
                await db
                    .ref(
                        `shorts/${state.shortId}`
                    )
                    .once(
                        "value"
                    );


            let data =
                snapshot.val();


            /*
             * User fallback
             */
            if (
                !data &&
                state.uid
            ) {

                snapshot =
                    await db
                        .ref(
                            `users/${state.uid}/shorts/${state.shortId}`
                        )
                        .once(
                            "value"
                        );


                data =
                    snapshot.val();
            }


            /*
             * Other legacy locations
             */
            if (
                !data &&
                state.uid
            ) {

                const locations = [

                    `users/${state.uid}/videos/${state.shortId}`,

                    `users/${state.uid}/shortVideos/${state.shortId}`,

                    `videos/${state.shortId}`
                ];


                for (
                    const path of locations
                ) {

                    try {

                        const snap =
                            await db
                                .ref(
                                    path
                                )
                                .once(
                                    "value"
                                );


                        const value =
                            snap.val();


                        if (value) {

                            data =
                                value;

                            break;
                        }

                    } catch (_) {}
                }
            }


            /*
             * ID exists but database row does not.
             *
             * If local video exists, use it as new Short.
             */
            if (!data) {

                const blob =
                    await loadVideoBlobFromIndexedDB();


                if (
                    blob ||
                    isFromEditor()
                ) {

                    state.isNew =
                        true;


                    return await loadNewShortFromLocal();
                }


                toast(
                    "Short not found",
                    `Short "${state.shortId}" could not be found.`,
                    "error"
                );


                return false;
            }


            /*
             * Store database data.
             */
            state.data =
                data;


            state.isNew =
                false;


            /*
             * VIDEO
             */
            const videoUrl =
                findVideoUrl(
                    data
                );


            if (
                validString(videoUrl)
            ) {

                state.videoUrl =
                    videoUrl.trim();

            } else {

                state.videoUrl =
                    "";


                /*
                 * Local fallback.
                 */
                const blob =
                    await loadVideoBlobFromIndexedDB();


                if (blob) {

                    applyLocalVideoBlob(
                        blob
                    );
                }
            }


            /*
             * THUMBNAIL
             */
            state.thumbnailUrl =
                findThumbnailUrl(
                    data
                );


            /*
             * FORM
             */
            populateForm(
                data
            );


            /*
             * VIDEO PREVIEW
             */
            if (
                state.videoUrl
            ) {

                loadAllVideos(
                    state.videoUrl
                );

            } else {

                console.warn(
                    "VIEWORA: Existing Short has no video URL.",
                    data
                );
            }


            /*
             * THUMBNAIL
             */
            showThumbnail(
                state.thumbnailUrl
            );


            updatePreview();

            updateChecklist();


            state.loaded =
                true;


            state.dirty =
                false;


            const status =
                $("saveStatus");


            if (status) {

                status.textContent =
                    "Saved";
            }


            console.log(
                "VIEWORA: Existing Short loaded:",
                state.shortId
            );


            return true;

        } catch (error) {

            console.error(
                "VIEWORA Short loading failed:",
                error
            );


            toast(
                "Loading failed",
                error.message ||
                "Could not load this Short.",
                "error"
            );


            return false;

        } finally {

            setPageLoading(
                false
            );
        }
    }


    /* =========================================================
       PAGE LOADING
    ========================================================= */

    function setPageLoading(
        loading
    ) {

        const app =
            $("app");


        if (!app) {
            return;
        }


        app.classList.toggle(
            "is-loading",
            Boolean(loading)
        );
    }


    /* =========================================================
       VISIBILITY
    ========================================================= */

    function setupVisibility() {

        qsa(
            ".visibilityOption"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        qsa(
                            ".visibilityOption"
                        ).forEach(
                            item => {

                                item.classList.remove(
                                    "active"
                                );
                            }
                        );


                        button.classList.add(
                            "active"
                        );


                        state.visibility =
                            button.dataset
                                .visibility ||
                            "public";


                        markDirty();

                        updateChecklist();

                        updatePreview();
                    }
                );
            }
        );
    }


    /* =========================================================
       ADDITIONAL SETTINGS
    ========================================================= */

    function setupAdditionalSettings() {

        const toggle =
            $("additionalSettingsToggle");


        const panel =
            $("additionalSettings");


        const chevron =
            $("additionalChevron");


        if (
            !toggle ||
            !panel
        ) {
            return;
        }


        toggle.addEventListener(
            "click",
            () => {

                const hidden =
                    panel.classList.toggle(
                        "hidden"
                    );


                toggle.setAttribute(
                    "aria-expanded",
                    hidden
                        ? "false"
                        : "true"
                );


                if (chevron) {

                    chevron.classList.toggle(
                        "rotate",
                        !hidden
                    );
                }
            }
        );
    }


    /* =========================================================
       INPUTS
    ========================================================= */

    function setupInputs() {

        qsa(
            "input, textarea, select"
        ).forEach(
            input => {

                input.addEventListener(
                    "input",
                    () => {

                        markDirty();

                        updateCounters();

                        readForm();

                        updatePreview();

                        updateChecklist();
                    }
                );


                input.addEventListener(
                    "change",
                    () => {

                        markDirty();

                        readForm();

                        updatePreview();

                        updateChecklist();
                    }
                );
            }
        );
    }


    function markDirty() {

        state.dirty =
            true;


        const status =
            $("saveStatus");


        if (status) {

            status.textContent =
                "Unsaved";
        }
    }


    /* =========================================================
       PREVIEW OVERLAY
    ========================================================= */

    function openPreview() {

        const overlay =
            $("previewOverlay");


        const video =
            $("fullPreviewVideo");


        if (!overlay) {
            return;
        }


        const url =
            getExistingVideoUrl();


        if (
            video &&
            url
        ) {

            setVideoSource(
                video,
                url
            );
        }


        updatePreview();


        overlay.classList.remove(
            "hidden"
        );


        if (video) {

            video.muted =
                true;


            video.play()
                .catch(
                    error => {

                        console.warn(
                            "VIEWORA preview autoplay blocked:",
                            error
                        );
                    }
                );
        }
    }


    function closePreview() {

        const overlay =
            $("previewOverlay");


        const video =
            $("fullPreviewVideo");


        if (video) {

            video.pause();
        }


        if (overlay) {

            overlay.classList.add(
                "hidden"
            );
        }
    }


    /* =========================================================
       SAVE DRAFT
    ========================================================= */

    async function saveDraft() {

        const saved =
            await saveData(
                {
                    status:
                        "draft",

                    published:
                        false
                },
                true
            );


        if (saved) {

            const status =
                $("saveStatus");


            if (status) {

                status.textContent =
                    "Draft saved";
            }
        }
    }


    /* =========================================================
       PUBLISH DIALOG
    ========================================================= */

    function openPublishDialog() {

        const video =
            getExistingVideoUrl();


        const title =
            $("shortTitle")
                ?.value
                ?.trim() ||
            "";


        if (!video) {

            toast(
                "Video missing",
                "The Short video could not be found.",
                "error"
            );


            return;
        }


        if (!title) {

            toast(
                "Title required",
                "Please add a title before publishing.",
                "warning"
            );


            $("shortTitle")
                ?.focus();


            return;
        }


        const dialog =
            $("publishDialog");


        if (!dialog) {
            return;
        }


        const text =
            $("publishDialogText");


        if (text) {

            if (
                state.visibility ===
                "public"
            ) {

                text.textContent =
                    "Your Short will be published publicly.";

            } else if (
                state.visibility ===
                "unlisted"
            ) {

                text.textContent =
                    "Your Short will be published as unlisted.";

            } else {

                text.textContent =
                    "Your Short will be published privately.";
            }
        }


        dialog.classList.remove(
            "hidden"
        );
    }


    function closePublishDialog() {

        const dialog =
            $("publishDialog");


        if (dialog) {

            dialog.classList.add(
                "hidden"
            );
        }
    }


    /* =========================================================
       PUBLISH SHORT
    ========================================================= */

    async function publishShort() {

        if (
            state.publishing
        ) {
            return;
        }


        const video =
            getExistingVideoUrl();


        if (!video) {

            toast(
                "Video missing",
                "The uploaded video could not be found. Go back to the editor and try again.",
                "error"
            );


            return;
        }


        const title =
            $("shortTitle")
                ?.value
                ?.trim() ||
            "";


        if (!title) {

            toast(
                "Title required",
                "Add a title before publishing.",
                "warning"
            );


            $("shortTitle")
                ?.focus();


            return;
        }


        try {

            state.publishing =
                true;


            closePublishDialog();


            const needsVideoUpload =
                !(
                    validString(
                        state.videoUrl
                    ) &&
                    /^https?:\/\//i.test(
                        state.videoUrl
                    )
                );


            showProcessing(
                "Publishing your Short",
                needsVideoUpload
                    ? "Uploading your video..."
                    : "Saving your details..."
            );


            setProgress(
                8
            );


            /*
             * Ensure auth is ready before upload / write.
             */
            try {

                await waitForSignedInUser(
                    12000
                );

            } catch (authError) {

                throw new Error(
                    authError?.message ||
                    "Please sign in before publishing."
                );
            }


            setProgress(
                12
            );


            const saved =
                await saveData(
                    {
                        status:
                            "published",

                        published:
                            true,

                        publishedAt:
                            firebase.database
                                .ServerValue
                                .TIMESTAMP
                    },
                    false
                );


            if (!saved) {

                hideProcessing();


                toast(
                    "Publish failed",
                    "Could not save your Short. Check console for Storage / Database errors.",
                    "error"
                );


                return;
            }


            setProgress(
                95
            );


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        200
                    )
            );


            setProgress(
                100
            );


            hideProcessing();


            const status =
                $("saveStatus");


            if (status) {

                status.textContent =
                    "Published";
            }


            /*
             * Remember published Short.
             */
            try {

                sessionStorage.removeItem(
                    PENDING_NEW_SHORT_KEY
                );


                sessionStorage.setItem(
                    "viewora_just_published_short",
                    state.shortId ||
                    ""
                );

            } catch (_) {}


            toast(
                "Short published",
                "Your Short is live. Opening Home..."
            );


            /*
             * Go Home
             */
            setTimeout(
                () => {

                    window.location.href =
                        "index.html";

                },
                800
            );

        } catch (error) {

            console.error(
                "VIEWORA publish failed:",
                error
            );


            hideProcessing();


            toast(
                "Publish failed",
                error.message ||
                "Could not publish your Short.",
                "error"
            );

        } finally {

            state.publishing =
                false;

            hideProcessing();
        }
    }


    /* =========================================================
       BACK TO EDITOR
    ========================================================= */

    function backToEditor() {

        const id =
            state.shortId ||
            getShortId();


        /*
         * New Short
         */
        if (
            !validId(id)
        ) {

            if (
                state.dirty
            ) {

                const leave =
                    window.confirm(
                        "You have unsaved changes. Leave the editor?"
                    );


                if (!leave) {
                    return;
                }
            }


            window.location.href =
                "edit-shorts.html";


            return;
        }


        /*
         * Existing Short
         */
        const target =
            `edit-shorts.html?shortId=${encodeURIComponent(
                id
            )}`;


        if (
            !state.dirty
        ) {

            window.location.href =
                target;


            return;
        }


        const leave =
            window.confirm(
                "You have unsaved changes. Leave the editor?"
            );


        if (!leave) {
            return;
        }


        window.location.href =
            target;
    }


    /* =========================================================
       VIDEO EVENTS
    ========================================================= */

    function setupVideoEvents() {

        const preview =
            $("previewVideo");


        if (preview) {

            attachVideoEvents(
                preview
            );


            preview.addEventListener(
                "click",
                () => {

                    if (
                        preview.paused
                    ) {

                        preview.play()
                            .catch(
                                () => {}
                            );

                    } else {

                        preview.pause();
                    }
                }
            );
        }


        attachVideoEvents(
            $("thumbnailVideo")
        );


        attachVideoEvents(
            $("frameVideo")
        );


        attachVideoEvents(
            $("fullPreviewVideo")
        );
    }


    /* =========================================================
       FRAME RANGE
    ========================================================= */

    function setupFrameRange() {

        const range =
            $("frameRange");


        const video =
            $("frameVideo");


        if (
            !range ||
            !video
        ) {
            return;
        }


        range.addEventListener(
            "input",
            () => {

                if (
                    !Number.isFinite(
                        video.duration
                    ) ||
                    video.duration <= 0
                ) {
                    return;
                }


                const percent =
                    Number(
                        range.value
                    ) || 0;


                video.currentTime =
                    (
                        percent /
                        100
                    ) *
                    video.duration;


                updateFrameControls();
            }
        );


        video.addEventListener(
            "timeupdate",
            updateFrameControls
        );


        video.addEventListener(
            "loadedmetadata",
            updateFrameControls
        );
    }


    /* =========================================================
       THUMBNAIL EVENTS
    ========================================================= */

    function setupThumbnail() {

        const change =
            $("changeThumbnailBtn");


        const capture =
            $("captureFrameBtn");


        const input =
            $("thumbnailInput");


        if (change) {

            change.addEventListener(
                "click",
                openThumbnailPicker
            );
        }


        if (capture) {

            capture.addEventListener(
                "click",
                openFrameSelector
            );
        }


        if (input) {

            input.addEventListener(
                "change",
                event => {

                    const file =
                        event.target
                            ?.files
                            ?.[0];


                    if (file) {

                        uploadThumbnail(
                            file
                        );
                    }


                    input.value =
                        "";
                }
            );
        }


        const close =
            $("closeFrameSelectorBtn");


        if (close) {

            close.addEventListener(
                "click",
                closeFrameSelector
            );
        }


        qsa(
            '[data-close-overlay="frameSelector"]'
        ).forEach(
            element => {

                element.addEventListener(
                    "click",
                    closeFrameSelector
                );
            }
        );


        const useFrame =
            $("useFrameBtn");


        if (useFrame) {

            useFrame.addEventListener(
                "click",
                captureVideoFrame
            );
        }
    }


    /* =========================================================
       PREVIEW EVENTS
    ========================================================= */

    function setupPreview() {

        const top =
            $("previewBtn");


        const fullscreen =
            $("fullscreenPreviewBtn");


        const close =
            $("closePreviewOverlayBtn");


        if (top) {

            top.addEventListener(
                "click",
                openPreview
            );
        }


        if (fullscreen) {

            fullscreen.addEventListener(
                "click",
                openPreview
            );
        }


        if (close) {

            close.addEventListener(
                "click",
                closePreview
            );
        }


        /*
         * Click outside preview
         */
        const overlay =
            $("previewOverlay");


        if (overlay) {

            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        closePreview();
                    }
                }
            );
        }
    }


    /* =========================================================
       ACTION EVENTS
    ========================================================= */

    function setupActions() {

        const draft =
            $("saveDraftBtn");


        const publish =
            $("publishBtn");


        const cancelPublish =
            $("cancelPublishBtn");


        const confirmPublish =
            $("confirmPublishBtn");


        if (draft) {

            draft.addEventListener(
                "click",
                saveDraft
            );
        }


        if (publish) {

            publish.addEventListener(
                "click",
                openPublishDialog
            );
        }


        if (cancelPublish) {

            cancelPublish.addEventListener(
                "click",
                closePublishDialog
            );
        }


        if (confirmPublish) {

            confirmPublish.addEventListener(
                "click",
                publishShort
            );
        }
    }


    /* =========================================================
       BACK EVENT
    ========================================================= */

    function setupBack() {

        const button =
            $("backToEditorBtn");


        if (button) {

            button.addEventListener(
                "click",
                backToEditor
            );
        }
    }


    /* =========================================================
       BEFORE UNLOAD
    ========================================================= */

    window.addEventListener(
        "beforeunload",
        event => {

            if (
                !state.dirty
            ) {
                return;
            }


            event.preventDefault();


            event.returnValue =
                "";
        }
    );


    /* =========================================================
       CLEANUP OBJECT URL
    ========================================================= */

    window.addEventListener(
        "pagehide",
        () => {

            if (
                state.videoObjectUrl
            ) {

                try {

                    URL.revokeObjectURL(
                        state.videoObjectUrl
                    );

                } catch (_) {}
            }


            if (
                state.thumbnailObjectUrl
            ) {

                try {

                    URL.revokeObjectURL(
                        state.thumbnailObjectUrl
                    );

                } catch (_) {}
            }
        }
    );


    /* =========================================================
       AUTH + LOAD
    ========================================================= */

    function waitForAuthAndLoad() {

        /*
         * Initial load.
         */
        loadShort();


        /*
         * Auth listener.
         */
        if (
            typeof firebase !== "undefined" &&
            typeof firebase.auth ===
            "function"
        ) {

            try {

                firebase.auth()
                    .onAuthStateChanged(
                        user => {

                            if (!user) {
                                return;
                            }


                            state.uid =
                                user.uid;


                            /*
                             * Retry if first load happened
                             * before auth became ready.
                             */
                            if (
                                !state.loaded
                            ) {

                                loadShort();
                            }
                        }
                    );

            } catch (error) {

                console.warn(
                    "VIEWORA auth listener unavailable:",
                    error
                );
            }
        }
    }


    /* =========================================================
       INIT
    ========================================================= */

    async function init() {

        setupVisibility();

        setupAdditionalSettings();

        setupInputs();

        setupVideoEvents();

        setupFrameRange();

        setupThumbnail();

        setupPreview();

        setupActions();

        setupBack();


        updateCounters();

        readForm();

        updatePreview();

        updateChecklist();


        waitForAuthAndLoad();


        console.log(
            "VIEWORA Short Details initialized successfully."
        );
    }


    /* =========================================================
       DOM READY
    ========================================================= */

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


    /* =========================================================
       PUBLIC DEBUG API
    ========================================================= */

    window.VieworaShortDetails = {

        getState: () => ({
            ...state
        }),

        getShortId: () =>
            state.shortId,

        getVideoUrl: () =>
            state.videoUrl,

        reload: () =>
            loadShort(),

        save: () =>
            saveData(),

        saveDraft: () =>
            saveDraft(),

        publish: () =>
            publishShort(),

        uploadThumbnail: file =>
            uploadThumbnail(file)
    };


})();