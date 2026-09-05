"use strict";

/* ============================================================
   VIEWORA
   EDIT VIDEO — LONG FORM VIDEO EDITOR
   FINAL • PREMIUM • SAFE • NEW + EXISTING VIDEO SUPPORT

   Supports:
   • Existing video editing
   • New editor video
   • IndexedDB video recovery
   • Firebase Authentication
   • Firebase Realtime Database
   • Firebase Storage
   • Video upload
   • Thumbnail upload
   • Video-frame thumbnail
   • Title
   • Description
   • Hashtags
   • Tags
   • Collaborators
   • Visibility
   • Comments
   • Like count
   • Downloads
   • Sharing
   • Remix
   • Audience
   • Language
   • Category
   • Live preview
   • Fullscreen preview
   • Save draft
   • Publish
   • Existing statistics preservation
   • User video mirror
============================================================ */

(() => {

    if (window.__VIEWORA_EDIT_VIDEO_FINAL__) {
        console.warn("Viewora edit-video.js already initialized.");
        return;
    }

    window.__VIEWORA_EDIT_VIDEO_FINAL__ = true;


    /* =========================================================
       HELPERS
    ========================================================= */

    const $ = id =>
        document.getElementById(id);

    const qs = selector =>
        document.querySelector(selector);

    const qsa = selector =>
        [...document.querySelectorAll(selector)];


    const safeString = value =>
        value == null ? "" : String(value);


    const safeNumber = (value, fallback = 0) => {

        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;

    };


    const clamp = (
        value,
        min,
        max
    ) => Math.min(
        max,
        Math.max(min, value)
    );


    const formatTime = seconds => {

        const value =
            Math.max(
                0,
                Math.floor(
                    safeNumber(seconds)
                )
            );

        const h =
            Math.floor(value / 3600);

        const m =
            Math.floor(
                (value % 3600) / 60
            );

        const s =
            value % 60;

        if (h > 0) {

            return (
                String(h).padStart(2, "0") +
                ":" +
                String(m).padStart(2, "0") +
                ":" +
                String(s).padStart(2, "0")
            );

        }

        return (
            String(m).padStart(2, "0") +
            ":" +
            String(s).padStart(2, "0")
        );

    };


    const escapeHTML = value => {

        return safeString(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    };


    /* =========================================================
       CONFIG
    ========================================================= */

    const CONFIG = {

        MAX_TITLE: 150,

        MAX_DESCRIPTION: 5000,

        MAX_HASHTAGS: 500,

        MAX_TAGS: 500,

        MAX_COLLABORATORS: 20,

        VIDEO_DB_PATH: "videos",

        USER_VIDEO_PATH: "userVideos",

        STORAGE_VIDEO_PATH: "videos",

        STORAGE_THUMBNAIL_PATH: "video-thumbnails"

    };


    /* =========================================================
       STATE
    ========================================================= */

    const state = {

        videoId: "",

        originalVideo: null,

        videoFile: null,

        videoURL: "",

        thumbnailURL: "",

        thumbnailFile: null,

        thumbnailChanged: false,

        videoChanged: false,

        isNewVideo: false,

        source: "",

        title: "",

        description: "",

        hashtags: "",

        tags: "",

        visibility: "public",

        showLikeCount: true,

        allowComments: true,

        showCommentCount: true,

        allowDownload: true,

        allowSharing: true,

        allowRemix: true,

        audience: "general",

        language: "auto",

        category: "people",

        collaborators: [],

        processing: false,

        dirty: false,

        currentObjectURL: "",

        thumbnailObjectURL: "",

        frameObjectURL: "",

        lastSavedAt: 0

    };


    /* =========================================================
       FIREBASE
    ========================================================= */

    function getAuth() {

        if (
            window.firebase &&
            typeof firebase.auth === "function"
        ) {
            return firebase.auth();
        }

        throw new Error(
            "Firebase Authentication is not initialized."
        );

    }


    function getDatabase() {

        if (
            window.firebase &&
            typeof firebase.database === "function"
        ) {
            return firebase.database();
        }

        throw new Error(
            "Firebase Database is not initialized."
        );

    }


    function getStorage() {

        if (
            window.firebase &&
            typeof firebase.storage === "function"
        ) {

            return firebase.storage();

        }

        throw new Error(
            "Firebase Storage is not initialized."
        );

    }


    function getCurrentUser() {

        try {

            return getAuth().currentUser;

        } catch (error) {

            return null;

        }

    }


    function serverTimestamp() {

        return firebase.database.ServerValue.TIMESTAMP;

    }


    /* =========================================================
       AUTH WAIT
    ========================================================= */

    function waitForUser(
        timeout = 12000
    ) {

        return new Promise(
            resolve => {

                const auth = getAuth();

                if (auth.currentUser) {

                    resolve(
                        auth.currentUser
                    );

                    return;

                }

                let finished = false;

                const timer =
                    setTimeout(
                        () => {

                            if (finished) {
                                return;
                            }

                            finished = true;

                            unsubscribe();

                            resolve(null);

                        },
                        timeout
                    );


                const unsubscribe =
                    auth.onAuthStateChanged(
                        user => {

                            if (finished) {
                                return;
                            }

                            if (!user) {
                                return;
                            }

                            finished = true;

                            clearTimeout(timer);

                            unsubscribe();

                            resolve(user);

                        }
                    );

            }
        );

    }


    /* =========================================================
       URL / STORAGE ID
    ========================================================= */

    function getURLParams() {

        return new URLSearchParams(
            window.location.search
        );

    }


    function getVideoIdFromURL() {

        const params =
            getURLParams();

        return (
            params.get("id") ||
            params.get("videoId") ||
            params.get("longId") ||
            params.get("videoID") ||
            params.get("editVideoId") ||
            ""
        ).trim();

    }


    function getSource() {

        const params =
            getURLParams();

        return (
            params.get("source") ||
            ""
        ).trim().toLowerCase();

    }


    function getStoredValue(keys) {

        const stores = [
            window.sessionStorage,
            window.localStorage
        ];

        for (const storage of stores) {

            if (!storage) {
                continue;
            }

            for (const key of keys) {

                try {

                    const value =
                        storage.getItem(key);

                    if (value) {
                        return value;
                    }

                } catch (error) {}

            }

        }

        return "";

    }


    function getStoredVideoId() {

        return getStoredValue([

            "viewora_edit_video_id",

            "vieworaEditVideoId",

            "viewora_video_id",

            "vieworaVideoId",

            "editVideoId",

            "longVideoId",

            "viewora_long_video_id",

            "vieworaLongVideoId"

        ]);

    }


    function getVideoId() {

        return (
            getVideoIdFromURL() ||
            getStoredVideoId() ||
            ""
        );

    }


    function persistVideoId(id) {

        if (!id) {
            return;
        }

        const keys = [

            "viewora_edit_video_id",

            "vieworaEditVideoId",

            "viewora_video_id",

            "vieworaVideoId"

        ];

        for (const key of keys) {

            try {

                sessionStorage.setItem(
                    key,
                    id
                );

            } catch (error) {}

        }

    }


    /* =========================================================
       FIREBASE ID GENERATION
    ========================================================= */

    function generateVideoId() {

        const db =
            getDatabase();

        const ref =
            db.ref("videos").push();

        if (!ref.key) {

            throw new Error(
                "Unable to generate video ID."
            );

        }

        return ref.key;

    }


    /* =========================================================
       DATABASE READ
    ========================================================= */

    async function readVideo(
        uid,
        videoId
    ) {

        const db =
            getDatabase();


        /* -----------------------------------------------------
           PRIMARY
        ----------------------------------------------------- */

        let snapshot =
            await db
                .ref(
                    `videos/${videoId}`
                )
                .once("value");


        if (snapshot.exists()) {

            return snapshot.val();

        }


        /* -----------------------------------------------------
           USER VIDEOS
        ----------------------------------------------------- */

        if (uid) {

            snapshot =
                await db
                    .ref(
                        `userVideos/${uid}/${videoId}`
                    )
                    .once("value");


            if (snapshot.exists()) {

                return snapshot.val();

            }

        }


        /* -----------------------------------------------------
           LONG VIDEOS FALLBACK
        ----------------------------------------------------- */

        snapshot =
            await db
                .ref(
                    `longVideos/${videoId}`
                )
                .once("value");


        if (snapshot.exists()) {

            return snapshot.val();

        }


        /* -----------------------------------------------------
           POSTS FALLBACK
        ----------------------------------------------------- */

        snapshot =
            await db
                .ref(
                    `posts/${videoId}`
                )
                .once("value");


        if (snapshot.exists()) {

            const data =
                snapshot.val();

            const mediaType =
                data.mediaType ||
                data.type ||
                "";

            const hasVideo =
                mediaType === "video" ||
                !!(
                    data.videoUrl ||
                    data.videoURL ||
                    data.video
                );

            if (hasVideo) {

                return data;

            }

        }


        return null;

    }


    /* =========================================================
       OWNERSHIP
    ========================================================= */

    function getOwnerId(data) {

        if (!data) {
            return "";
        }

        return (
            data.uid ||
            data.userId ||
            data.ownerId ||
            data.creatorId ||
            data.authorId ||
            ""
        );

    }


    function verifyOwnership(
        data,
        uid
    ) {

        const owner =
            getOwnerId(data);

        if (!owner) {
            return true;
        }

        return (
            String(owner) ===
            String(uid)
        );

    }


    /* =========================================================
       NORMALIZE VIDEO
    ========================================================= */

    function normalizeVideo(
        data,
        id
    ) {

        const item =
            data || {};


        return {

            ...item,

            id:
                item.id ||
                item.videoId ||
                id,

            videoId:
                item.videoId ||
                item.id ||
                id,

            uid:
                item.uid ||
                item.userId ||
                item.ownerId ||
                item.creatorId ||
                "",

            videoUrl:
                item.videoUrl ||
                item.videoURL ||
                item.video ||
                item.mediaUrl ||
                item.media ||
                item.url ||
                "",

            thumbnail:
                item.thumbnail ||
                item.thumbnailUrl ||
                item.cover ||
                item.coverUrl ||
                item.poster ||
                "",

            title:
                item.title ||
                item.name ||
                "",

            description:
                item.description ||
                item.caption ||
                item.text ||
                "",

            hashtags:
                item.hashtags ||
                item.hashTags ||
                "",

            tags:
                item.tags ||
                "",

            visibility:
                item.visibility ||
                "public",

            allowComments:
                item.allowComments !== false &&
                item.commentsAllowed !== false,

            showLikeCount:
                item.showLikeCount !== false,

            showCommentCount:
                item.showCommentCount !== false,

            allowDownload:
                item.allowDownload !== false,

            allowSharing:
                item.allowSharing !== false &&
                item.sharingAllowed !== false,

            allowRemix:
                item.allowRemix !== false &&
                item.remixAllowed !== false,

            audience:
                item.audience ||
                "general",

            language:
                item.language ||
                "auto",

            category:
                item.category ||
                "people",

            collaborators:
                Array.isArray(
                    item.collaborators
                )
                    ? item.collaborators
                    : (
                        item.collaborators &&
                        typeof item.collaborators === "object"
                            ? Object.values(
                                item.collaborators
                            )
                            : []
                    )

        };

    }


    /* =========================================================
       INDEXED DB
    ========================================================= */

    function isVideoBlob(value) {

        if (
            typeof Blob === "undefined" ||
            !(value instanceof Blob)
        ) {
            return false;
        }

        return (
            value.type &&
            value.type.startsWith("video/")
        );

    }


    function isBlob(value) {

        return (
            typeof Blob !== "undefined" &&
            value instanceof Blob
        );

    }


    function looksLikeVideoRecord(
        record
    ) {

        if (!record) {
            return false;
        }

        if (
            isVideoBlob(record) ||
            isVideoBlob(record.file)
        ) {
            return true;
        }

        if (
            isVideoBlob(record.video) ||
            isVideoBlob(record.blob)
        ) {
            return true;
        }

        if (
            record.file instanceof File
        ) {
            return (
                record.file.type || ""
            )
                .toLowerCase()
                .startsWith("video/");
        }

        if (
            typeof record === "object"
        ) {

            const keys =
                Object.keys(record);

            for (const key of keys) {

                const value =
                    record[key];

                if (isVideoBlob(value)) {
                    return true;
                }

            }

        }

        return false;

    }


    function findVideoBlob(
        record
    ) {

        if (!record) {
            return null;
        }

        if (isVideoBlob(record)) {
            return record;
        }

        if (
            record.file &&
            isVideoBlob(record.file)
        ) {
            return record.file;
        }

        if (
            record.video &&
            isVideoBlob(record.video)
        ) {
            return record.video;
        }

        if (
            record.blob &&
            isVideoBlob(record.blob)
        ) {
            return record.blob;
        }

        if (
            record.file instanceof File
        ) {
            return record.file;
        }

        if (
            typeof record === "object"
        ) {

            const preferredKeys = [

                "videoFile",
                "videoBlob",
                "mediaFile",
                "mediaBlob",
                "sourceFile",
                "sourceBlob"

            ];

            for (
                const key of preferredKeys
            ) {

                if (
                    isVideoBlob(
                        record[key]
                    )
                ) {

                    return record[key];

                }

            }


            for (
                const key of Object.keys(record)
            ) {

                if (
                    isVideoBlob(
                        record[key]
                    )
                ) {

                    return record[key];

                }

            }

        }

        return null;

    }


    function extractVideoURL(
        record
    ) {

        if (!record) {
            return "";
        }

        if (
            typeof record === "string"
        ) {

            if (
                record.startsWith("blob:") ||
                record.startsWith("http:")
            ) {

                return record;

            }

            if (
                record.startsWith("https:")
            ) {

                return record;

            }

        }


        if (
            typeof record === "object"
        ) {

            const keys = [

                "videoUrl",
                "videoURL",
                "video",
                "mediaUrl",
                "media",
                "url",
                "source",
                "src",
                "previewUrl"

            ];

            for (const key of keys) {

                const value =
                    record[key];

                if (
                    typeof value === "string" &&
                    value
                ) {

                    if (
                        value.startsWith("blob:") ||
                        value.startsWith("http")
                    ) {

                        return value;

                    }

                }

            }

        }

        return "";

    }


    async function idbRequest(
        request
    ) {

        return new Promise(
            (resolve, reject) => {

                request.onsuccess =
                    () => resolve(
                        request.result
                    );

                request.onerror =
                    () => reject(
                        request.error
                    );

            }
        );

    }


    async function openDatabase(
        name,
        version
    ) {

        return new Promise(
            (resolve, reject) => {

                let request;

                try {

                    request =
                        version
                            ? indexedDB.open(
                                name,
                                version
                            )
                            : indexedDB.open(name);

                } catch (error) {

                    reject(error);

                    return;

                }


                request.onerror =
                    () => reject(
                        request.error
                    );


                request.onsuccess =
                    () => resolve(
                        request.result
                    );

            }
        );

    }


    async function readIndexedDBStore(
        db,
        storeName
    ) {

        return new Promise(
            (resolve, reject) => {

                let transaction;

                try {

                    transaction =
                        db.transaction(
                            storeName,
                            "readonly"
                        );

                } catch (error) {

                    reject(error);

                    return;

                }


                const store =
                    transaction.objectStore(
                        storeName
                    );


                const request =
                    store.getAll();


                request.onsuccess =
                    () => {

                        resolve(
                            request.result || []
                        );

                    };


                request.onerror =
                    () => {

                        reject(
                            request.error
                        );

                    };

            }
        );

    }


    async function loadVideoFromIndexedDB() {

        if (
            typeof indexedDB ===
            "undefined"
        ) {

            return null;

        }


        /* -----------------------------------------------------
           MODERN DATABASE ENUMERATION
        ----------------------------------------------------- */

        let databases = [];

        try {

            if (
                typeof indexedDB.databases ===
                "function"
            ) {

                databases =
                    await indexedDB.databases();

            }

        } catch (error) {

            console.warn(
                "IndexedDB database enumeration failed:",
                error
            );

        }


        const preferredNames = [

            "Viewora",
            "viewora",
            "VieworaDB",
            "vieworaDB",
            "VieworaUploads",
            "vieworaUploads",
            "VieworaMedia",
            "vieworaMedia",
            "uploads",
            "media"

        ];


        const names = [];


        preferredNames.forEach(
            name => {

                if (
                    !names.includes(name)
                ) {

                    names.push(name);

                }

            }
        );


        databases.forEach(
            item => {

                if (
                    item &&
                    item.name &&
                    !names.includes(
                        item.name
                    )
                ) {

                    names.push(
                        item.name
                    );

                }

            }
        );


        for (
            const name of names
        ) {

            let db = null;

            try {

                db =
                    await openDatabase(
                        name
                    );

            } catch (error) {

                continue;

            }


            if (!db) {
                continue;
            }


            const stores =
                [...db.objectStoreNames];


            const preferredStores = [

                "videos",
                "video",
                "uploads",
                "media",
                "drafts",
                "editor",
                "longVideos",
                "longVideo",
                "videoDrafts"

            ];


            const orderedStores = [

                ...preferredStores.filter(
                    store =>
                        stores.includes(store)
                ),

                ...stores.filter(
                    store =>
                        !preferredStores.includes(
                            store
                        )
                )

            ];


            for (
                const storeName of orderedStores
            ) {

                let records = [];

                try {

                    records =
                        await readIndexedDBStore(
                            db,
                            storeName
                        );

                } catch (error) {

                    continue;

                }


                for (
                    const record of records
                ) {

                    if (
                        !looksLikeVideoRecord(
                            record
                        )
                    ) {
                        continue;
                    }


                    const blob =
                        findVideoBlob(
                            record
                        );


                    const url =
                        extractVideoURL(
                            record
                        );


                    if (
                        blob ||
                        url
                    ) {

                        try {
                            db.close();
                        } catch (error) {}


                        return {

                            record,

                            blob,

                            url

                        };

                    }

                }

            }


            try {
                db.close();
            } catch (error) {}

        }


        return null;

    }


    /* =========================================================
       INDEXEDDB TARGETED LOOKUP
    ========================================================= */

    async function findIndexedDBVideoById(
        targetId
    ) {

        if (
            !targetId ||
            typeof indexedDB ===
            "undefined"
        ) {

            return null;

        }


        if (
            typeof indexedDB.databases !==
            "function"
        ) {

            return null;

        }


        let databases = [];

        try {

            databases =
                await indexedDB.databases();

        } catch (error) {

            return null;

        }


        for (
            const meta of databases
        ) {

            if (
                !meta ||
                !meta.name
            ) {
                continue;
            }


            let db;

            try {

                db =
                    await openDatabase(
                        meta.name
                    );

            } catch (error) {

                continue;

            }


            if (!db) {
                continue;
            }


            for (
                const storeName of
                [...db.objectStoreNames]
            ) {

                let records = [];

                try {

                    records =
                        await readIndexedDBStore(
                            db,
                            storeName
                        );

                } catch (error) {

                    continue;

                }


                for (
                    const record of records
                ) {

                    if (
                        !record ||
                        typeof record !==
                        "object"
                    ) {
                        continue;
                    }


                    const candidate =
                        record.id ||
                        record.videoId ||
                        record.longId ||
                        record.uploadId ||
                        record.key ||
                        "";


                    if (
                        String(candidate) !==
                        String(targetId)
                    ) {

                        continue;

                    }


                    const blob =
                        findVideoBlob(
                            record
                        );


                    const url =
                        extractVideoURL(
                            record
                        );


                    try {
                        db.close();
                    } catch (error) {}


                    return {
                        record,
                        blob,
                        url
                    };

                }

            }


            try {
                db.close();
            } catch (error) {}

        }


        return null;

    }


    /* =========================================================
       UI PROCESSING
    ========================================================= */

    function showProcessing(
        title = "Saving your video",
        message = "Preparing your changes..."
    ) {

        const overlay =
            $("processingOverlay");

        if (!overlay) {
            return;
        }


        overlay.classList.remove(
            "hidden"
        );


        overlay.setAttribute(
            "aria-hidden",
            "false"
        );


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


        setProgress(8);

    }


    function updateProcessing(
        message,
        progress
    ) {

        const messageEl =
            $("processingMessage");

        if (messageEl) {
            messageEl.textContent =
                message;
        }


        if (
            Number.isFinite(
                Number(progress)
            )
        ) {

            setProgress(
                progress
            );

        }

    }


    function setProgress(
        value
    ) {

        const bar =
            $("processingProgressBar");

        if (!bar) {
            return;
        }

        bar.style.width =
            clamp(
                safeNumber(value),
                0,
                100
            ) + "%";

    }


    function hideProcessing() {

        const overlay =
            $("processingOverlay");

        if (!overlay) {
            return;
        }


        overlay.classList.add(
            "hidden"
        );


        overlay.setAttribute(
            "aria-hidden",
            "true"
        );


        setProgress(0);

    }


    /* =========================================================
       TOAST
    ========================================================= */

    let toastTimer = null;


    function showToast(
        title,
        message,
        type = "success"
    ) {

        const toast =
            $("toast");

        if (!toast) {
            return;
        }


        const titleEl =
            $("toastTitle");

        const textEl =
            $("toastText");

        const icon =
            $("toastIcon");


        if (titleEl) {

            titleEl.textContent =
                title;

        }


        if (textEl) {

            textEl.textContent =
                message;

        }


        if (icon) {

            icon.innerHTML =
                type === "error"
                    ? '<i class="fa-solid fa-circle-exclamation"></i>'
                    : type === "warning"
                        ? '<i class="fa-solid fa-triangle-exclamation"></i>'
                        : '<i class="fa-solid fa-circle-check"></i>';

        }


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
                3800
            );

    }


    /* =========================================================
       SAVE STATUS
    ========================================================= */

    function setSaveStatus(
        status
    ) {

        const text =
            $("saveStatusText");

        const box =
            $("saveStatus");


        if (!text) {
            return;
        }


        text.textContent =
            status;


        if (box) {

            box.dataset.status =
                status
                    .toLowerCase()
                    .replace(
                        /\s+/g,
                        "-"
                    );

        }

    }


    /* =========================================================
       VIDEO STATE UI
    ========================================================= */

    function setVideoState(
        text,
        ready = true
    ) {

        const stateText =
            $("videoState");

        const dot =
            $("videoStateDot");

        if (stateText) {

            stateText.textContent =
                text;

        }


        if (dot) {

            dot.classList.toggle(
                "ready",
                ready
            );

        }

    }


    /* =========================================================
       BUTTON LOADING
    ========================================================= */

    function setButtonsLoading(
        loading
    ) {

        const ids = [

            "saveDraftBtn",
            "publishBtn",
            "publishSideBtn",
            "confirmPublishBtn",
            "replaceVideoBtn",
            "uploadVideoBtn",
            "changeThumbnailBtn",
            "captureFrameBtn",
            "addCollaboratorBtn"

        ];


        ids.forEach(
            id => {

                const button =
                    $(id);

                if (!button) {
                    return;
                }


                if (
                    !button.dataset.originalHTML
                ) {

                    button.dataset.originalHTML =
                        button.innerHTML;

                }


                button.disabled =
                    !!loading;


                if (loading) {

                    button.classList.add(
                        "isLoading"
                    );

                } else {

                    button.classList.remove(
                        "isLoading"
                    );

                }

            }
        );

    }


    /* =========================================================
       FORM VALUES
    ========================================================= */

    function getInputValue(
        id,
        fallback = ""
    ) {

        const element =
            $(id);

        if (!element) {
            return fallback;
        }

        return (
            safeString(
                element.value
            ).trim()
        );

    }


    function setInputValue(
        id,
        value
    ) {

        const element =
            $(id);

        if (!element) {
            return;
        }

        element.value =
            value == null
                ? ""
                : value;

    }


    function setChecked(
        id,
        value
    ) {

        const element =
            $(id);

        if (!element) {
            return;
        }

        element.checked =
            value !== false;

    }


    function getChecked(
        id,
        fallback = true
    ) {

        const element =
            $(id);

        if (!element) {
            return fallback;
        }

        return (
            element.checked === true
        );

    }


    /* =========================================================
       COUNTERS
    ========================================================= */

    function updateCounters() {

        const title =
            getInputValue(
                "longTitle"
            );

        const description =
            getInputValue(
                "longDescription"
            );


        const titleCount =
            $("titleCount");

        const descriptionCount =
            $("descriptionCount");


        if (titleCount) {

            titleCount.textContent =
                title.length;

        }


        if (descriptionCount) {

            descriptionCount.textContent =
                description.length;

        }

    }


    /* =========================================================
       COLLECT FORM
    ========================================================= */

    function collectFormData() {

        const visibility =
            state.visibility ||
            "public";

        // Keep state in sync with live form (important for public video edits)
        state.title = getInputValue("longTitle");
        state.description = getInputValue("longDescription");
        state.hashtags = getInputValue("longHashtags");
        state.tags = getInputValue("longTags");
        state.visibility = visibility;


        return {

            title:
                state.title,

            description:
                state.description,

            hashtags:
                getInputValue(
                    "longHashtags"
                ),

            tags:
                getInputValue(
                    "longTags"
                ),

            visibility,

            allowComments:
                getChecked(
                    "allowComments",
                    true
                ),

            showLikeCount:
                getChecked(
                    "showLikeCount",
                    true
                ),

            showCommentCount:
                getChecked(
                    "showCommentCount",
                    true
                ),

            allowDownload:
                getChecked(
                    "allowDownload",
                    true
                ),

            allowSharing:
                getChecked(
                    "allowSharing",
                    true
                ),

            allowRemix:
                getChecked(
                    "allowRemix",
                    true
                ),

            audience:
                $("audienceSetting")
                    ?.value ||
                "general",

            language:
                $("languageSetting")
                    ?.value ||
                "auto",

            category:
                $("categorySetting")
                    ?.value ||
                "people",

            collaborators:
                [...state.collaborators]

        };

    }


    /* =========================================================
       VALIDATION
    ========================================================= */

    function validateForm(
        data,
        publishing = false
    ) {

        if (!state.videoFile && !state.videoURL) {

            showToast(
                "Video required",
                "Please add a video before continuing.",
                "error"
            );

            return false;

        }


        if (!data.title) {

            showToast(
                "Title required",
                "Please add a title for your video.",
                "error"
            );

            $("longTitle")
                ?.focus();

            return false;

        }


        if (
            data.title.length >
            CONFIG.MAX_TITLE
        ) {

            showToast(
                "Title too long",
                `Title can contain up to ${CONFIG.MAX_TITLE} characters.`,
                "error"
            );

            return false;

        }


        if (
            data.description.length >
            CONFIG.MAX_DESCRIPTION
        ) {

            showToast(
                "Description too long",
                `Description can contain up to ${CONFIG.MAX_DESCRIPTION} characters.`,
                "error"
            );

            return false;

        }


        if (
            data.hashtags.length >
            CONFIG.MAX_HASHTAGS
        ) {

            showToast(
                "Hashtags too long",
                "Please shorten your hashtags.",
                "error"
            );

            return false;

        }


        if (
            data.tags.length >
            CONFIG.MAX_TAGS
        ) {

            showToast(
                "Tags too long",
                "Please shorten your tags.",
                "error"
            );

            return false;

        }


        if (
            publishing &&
            !["public", "unlisted", "private"]
                .includes(
                    data.visibility
                )
        ) {

            showToast(
                "Visibility required",
                "Please select a valid visibility.",
                "error"
            );

            return false;

        }


        return true;

    }


    /* =========================================================
       VIDEO URL MANAGEMENT
    ========================================================= */

    function releaseCurrentObjectURL() {

        if (
            state.currentObjectURL
        ) {

            try {

                URL.revokeObjectURL(
                    state.currentObjectURL
                );

            } catch (error) {}

            state.currentObjectURL =
                "";

        }

    }


    /* =========================================================
       LOCAL MEDIA DB (replace previous upload cleanly)
    ========================================================= */

    const LOCAL_VIDEO_DB = "VIEWORA_MEDIA_DB";
    const LOCAL_VIDEO_STORE = "uploads";
    const LOCAL_VIDEO_KEY = "currentVideo";


    function openLocalVideoDB() {

        return new Promise((resolve, reject) => {

            if (!("indexedDB" in window)) {
                reject(new Error("IndexedDB not supported"));
                return;
            }

            const request = indexedDB.open(LOCAL_VIDEO_DB, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(LOCAL_VIDEO_STORE)) {
                    db.createObjectStore(LOCAL_VIDEO_STORE);
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () =>
                reject(request.error || new Error("Could not open media DB"));
        });
    }


    async function saveLocalVideoBlob(blob) {

        if (!blob) return false;

        try {
            const db = await openLocalVideoDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_VIDEO_STORE, "readwrite");
                const store = tx.objectStore(LOCAL_VIDEO_STORE);
                const req = store.put(blob, LOCAL_VIDEO_KEY);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
            try { db.close(); } catch (_) {}
            return true;
        } catch (error) {
            console.warn("Local video save failed:", error);
            return false;
        }
    }


    async function clearLocalVideoBlob() {

        try {
            const db = await openLocalVideoDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_VIDEO_STORE, "readwrite");
                const store = tx.objectStore(LOCAL_VIDEO_STORE);
                const req = store.delete(LOCAL_VIDEO_KEY);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
            try { db.close(); } catch (_) {}
        } catch (error) {
            console.warn("Local video clear failed:", error);
        }

        // Also clear stale session keys so next upload is not stuck on old video id
        [
            "viewora_edit_video_id",
            "vieworaEditVideoId",
            "viewora_video_id",
            "vieworaVideoId",
            "editVideoId",
            "longVideoId",
            "viewora_long_video_id",
            "vieworaLongVideoId",
            "viewora_pending_new_video"
        ].forEach((key) => {
            try { sessionStorage.removeItem(key); } catch (_) {}
            try { localStorage.removeItem(key); } catch (_) {}
        });
    }


    function setVideoSource(
        source
    ) {

        const videos = [

            $("videoPreview"),
            $("previewVideo"),
            $("frameVideo"),
            $("fullPreviewVideo"),
            $("thumbnailVideo")

        ].filter(Boolean);


        videos.forEach(
            video => {

                try {

                    video.pause();

                } catch (error) {}


                video.removeAttribute(
                    "src"
                );

                video.load();


                if (source) {

                    video.src =
                        source;

                    video.load();

                }

            }
        );


        state.videoURL =
            source || "";

        updateVideoMetadata();

        updatePreview();

    }


    function setVideoFromBlob(
        blob
    ) {

        if (!blob) {
            return false;
        }


        releaseCurrentObjectURL();


        const url =
            URL.createObjectURL(
                blob
            );


        state.currentObjectURL =
            url;


        state.videoFile =
            blob instanceof File
                ? blob
                : new File(
                    [blob],
                    `viewora-video-${Date.now()}.mp4`,
                    {
                        type:
                            blob.type ||
                            "video/mp4"
                    }
                );


        state.videoChanged =
            true;

        state.isNewVideo =
            true;

        // Keep IndexedDB in sync with active blob
        saveLocalVideoBlob(state.videoFile).catch(() => {});

        setVideoSource(
            url
        );


        setVideoState(
            "New video ready",
            true
        );


        markDirty();

        return true;

    }


    /* =========================================================
       VIDEO INPUT
    ========================================================= */

    function setupVideoPicker() {

        $("uploadVideoBtn")
            ?.addEventListener(
                "click",
                () => {

                    /*
                     * Existing published video:
                     * video file cannot be replaced.
                     */
                    if (
                        !state.isNewVideo &&
                        state.videoId &&
                        state.originalVideo
                    ) {

                        showToast(
                            "Video locked",
                            "You can edit title, description and settings. The video file cannot be changed.",
                            "warning"
                        );

                        return;

                    }


                    $("videoInput")
                        ?.click();

                }
            );


        $("replaceVideoBtn")
            ?.addEventListener(
                "click",
                () => {

                    if (
                        !state.isNewVideo &&
                        state.videoId &&
                        state.originalVideo
                    ) {

                        showToast(
                            "Video locked",
                            "You can edit title, description and settings. The video file cannot be changed.",
                            "warning"
                        );

                        return;

                    }


                    $("videoInput")
                        ?.click();

                }
            );


        $("videoInput")
            ?.addEventListener(
                "change",
                event => {

                    const file =
                        event.target
                            ?.files?.[0];

                    if (!file) {
                        return;
                    }


                    if (
                        !state.isNewVideo &&
                        state.videoId &&
                        state.originalVideo
                    ) {

                        showToast(
                            "Video locked",
                            "This published video cannot be replaced.",
                            "warning"
                        );

                        event.target.value =
                            "";

                        return;

                    }


                    if (
                        !file.type.startsWith(
                            "video/"
                        )
                    ) {

                        showToast(
                            "Invalid video",
                            "Please choose a valid video file.",
                            "error"
                        );

                        event.target.value =
                            "";

                        return;

                    }


                    if (
                        file.size <= 0
                    ) {

                        showToast(
                            "Empty file",
                            "This video file appears to be empty.",
                            "error"
                        );

                        event.target.value =
                            "";

                        return;

                    }


                    releaseCurrentObjectURL();

                    // New selection always replaces previous local file
                    if (state.thumbnailObjectURL) {
                        try { URL.revokeObjectURL(state.thumbnailObjectURL); } catch (_) {}
                        state.thumbnailObjectURL = "";
                    }

                    const url =
                        URL.createObjectURL(
                            file
                        );


                    state.currentObjectURL =
                        url;

                    state.videoFile =
                        file;

                    state.videoChanged =
                        true;

                    state.videoURL =
                        url;

                    // Selecting a fresh file means this is a NEW video draft
                    // (unless user is on an existing published edit page)
                    if (
                        !state.originalVideo ||
                        state.isNewVideo
                    ) {
                        state.isNewVideo = true;
                        state.originalVideo = null;
                        state.videoId = "";
                        // Clear previous id so second upload is not tied to first
                        [
                            "viewora_edit_video_id",
                            "vieworaEditVideoId",
                            "viewora_video_id",
                            "vieworaVideoId"
                        ].forEach((key) => {
                            try { sessionStorage.removeItem(key); } catch (_) {}
                        });
                    }

                    // Persist replacement so reload does not restore the first file
                    saveLocalVideoBlob(file).catch(() => {});

                    setVideoSource(
                        url
                    );

                    updateVideoPlaceholder();
                    updateVideoMetadata();
                    updatePreview();
                    updateSummary();

                    setVideoState(
                        "New video ready",
                        true
                    );


                    setSaveStatus(
                        "Unsaved changes"
                    );


                    markDirty();


                    showToast(
                        "Video replaced",
                        "Previous file cleared. New video is ready."
                    );


                    event.target.value =
                        "";

                }
            );

    }


    /* =========================================================
       VIDEO METADATA
    ========================================================= */

    function updateVideoMetadata() {

        const video =
            $("videoPreview");

        if (!video) {
            return;
        }


        const update =
            () => {

                const duration =
                    $("videoDuration");

                const resolution =
                    $("videoResolution");

                const format =
                    $("videoFormat");


                if (duration) {

                    duration.textContent =
                        formatTime(
                            video.duration
                        );

                }


                if (
                    resolution &&
                    video.videoWidth &&
                    video.videoHeight
                ) {

                    resolution.textContent =
                        `${video.videoWidth} × ${video.videoHeight}`;

                }


                if (format) {

                    let value =
                        "";

                    if (
                        state.videoFile &&
                        state.videoFile.type
                    ) {

                        value =
                            state.videoFile.type
                                .replace(
                                    "video/",
                                    ""
                                )
                                .toUpperCase();

                    } else {

                        const url =
                            state.videoURL ||
                            "";

                        const match =
                            url.match(
                                /\.([a-z0-9]{2,5})(?:\?|#|$)/i
                            );

                        value =
                            match
                                ? match[1].toUpperCase()
                                : "VIDEO";

                    }


                    format.textContent =
                        value || "VIDEO";

                }


                updateFrameControls();

            };


        video.addEventListener(
            "loadedmetadata",
            update,
            {
                once: true
            }
        );


        if (
            video.readyState >= 1
        ) {

            update();

        }

    }


    /* =========================================================
       VIDEO PLACEHOLDER
    ========================================================= */

    function updateVideoPlaceholder() {

        const placeholder =
            $("videoPlaceholder");

        const video =
            $("videoPreview");


        if (!placeholder) {
            return;
        }


        const hasVideo =
            !!(
                state.videoURL ||
                state.videoFile
            );


        placeholder.classList.toggle(
            "hidden",
            hasVideo
        );


        if (video) {

            video.classList.toggle(
                "hidden",
                !hasVideo
            );

        }

    }


    /* =========================================================
       THUMBNAIL PICKER
    ========================================================= */

    function setupThumbnailPicker() {

        $("changeThumbnailBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("thumbnailInput")
                        ?.click();

                }
            );


        $("thumbnailInput")
            ?.addEventListener(
                "change",
                event => {

                    const file =
                        event.target
                            ?.files?.[0];

                    if (!file) {
                        return;
                    }


                    if (
                        !file.type.startsWith(
                            "image/"
                        )
                    ) {

                        showToast(
                            "Invalid thumbnail",
                            "Please choose an image file.",
                            "error"
                        );

                        event.target.value =
                            "";

                        return;

                    }


                    if (
                        state.thumbnailObjectURL
                    ) {

                        try {

                            URL.revokeObjectURL(
                                state.thumbnailObjectURL
                            );

                        } catch (error) {}

                    }


                    state.thumbnailObjectURL =
                        URL.createObjectURL(
                            file
                        );


                    state.thumbnailFile =
                        file;

                    state.thumbnailChanged =
                        true;


                    applyThumbnail(
                        state.thumbnailObjectURL
                    );


                    markDirty();


                    showToast(
                        "Thumbnail selected",
                        "Your custom thumbnail is ready."
                    );


                    event.target.value =
                        "";

                }
            );

    }


    function applyThumbnail(
        url
    ) {

        state.thumbnailURL =
            url || "";


        const image =
            $("thumbnailImage");

        const video =
            $("thumbnailVideo");

        const placeholder =
            $("thumbnailPlaceholder");


        if (image) {

            if (url) {

                image.src =
                    url;

                image.classList.remove(
                    "hidden"
                );

            } else {

                image.removeAttribute(
                    "src"
                );

                image.classList.add(
                    "hidden"
                );

            }

        }


        if (video) {

            video.classList.toggle(
                "hidden",
                !!url
            );

        }


        if (placeholder) {

            placeholder.classList.toggle(
                "hidden",
                !!url
            );

        }

    }


    /* =========================================================
       FRAME SELECTOR
    ========================================================= */

    function setupFrameSelector() {

        $("captureFrameBtn")
            ?.addEventListener(
                "click",
                openFrameSelector
            );


        $("closeFrameSelectorBtn")
            ?.addEventListener(
                "click",
                closeFrameSelector
            );


        qsa(
            '[data-close-overlay="frameSelector"]'
        )
            .forEach(
                element => {

                    element.addEventListener(
                        "click",
                        closeFrameSelector
                    );

                }
            );


        $("frameRange")
            ?.addEventListener(
                "input",
                event => {

                    const video =
                        $("frameVideo");

                    if (!video) {
                        return;
                    }


                    const duration =
                        safeNumber(
                            video.duration
                        );


                    if (!duration) {
                        return;
                    }


                    const value =
                        safeNumber(
                            event.target.value
                        );


                    video.currentTime =
                        duration *
                        (value / 100);


                    updateFrameTime();

                }
            );


        $("frameVideo")
            ?.addEventListener(
                "loadedmetadata",
                () => {

                    updateFrameControls();

                    updateFrameTime();

                }
            );


        $("frameVideo")
            ?.addEventListener(
                "timeupdate",
                updateFrameTime
            );


        $("useFrameBtn")
            ?.addEventListener(
                "click",
                captureFrame
            );

    }


    function updateFrameControls() {

        const source =
            state.videoURL;

        const video =
            $("frameVideo");

        if (!video) {
            return;
        }


        if (
            source &&
            video.src !== source
        ) {

            video.src =
                source;

            video.load();

        }

    }


    function updateFrameTime() {

        const video =
            $("frameVideo");

        if (!video) {
            return;
        }


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


        const range =
            $("frameRange");


        if (
            range &&
            video.duration
        ) {

            range.value =
                (
                    video.currentTime /
                    video.duration
                ) *
                100;

        }

    }


    function openFrameSelector() {

        if (!state.videoURL) {

            showToast(
                "Video required",
                "Add a video before capturing a frame.",
                "warning"
            );

            return;

        }


        const overlay =
            $("frameSelector");

        if (!overlay) {
            return;
        }


        const video =
            $("frameVideo");


        if (video) {

            video.src =
                state.videoURL;

            video.load();

        }


        overlay.classList.remove(
            "hidden"
        );


        document.body.classList.add(
            "modalOpen"
        );


        updateFrameControls();

    }


    function closeFrameSelector() {

        $("frameSelector")
            ?.classList.add(
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


    async function captureFrame() {

        const video =
            $("frameVideo");

        if (
            !video ||
            !video.videoWidth ||
            !video.videoHeight
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


            const blob =
                await new Promise(
                    resolve =>
                        canvas.toBlob(
                            resolve,
                            "image/jpeg",
                            0.92
                        )
                );


            if (!blob) {

                throw new Error(
                    "Unable to create thumbnail."
                );

            }


            if (
                state.frameObjectURL
            ) {

                try {

                    URL.revokeObjectURL(
                        state.frameObjectURL
                    );

                } catch (error) {}

            }


            state.frameObjectURL =
                URL.createObjectURL(
                    blob
                );


            state.thumbnailFile =
                new File(
                    [blob],
                    `viewora-thumbnail-${Date.now()}.jpg`,
                    {
                        type:
                            "image/jpeg"
                    }
                );


            state.thumbnailChanged =
                true;


            applyThumbnail(
                state.frameObjectURL
            );


            markDirty();

            closeFrameSelector();


            showToast(
                "Frame captured",
                "Video frame is now your thumbnail."
            );

        } catch (error) {

            console.error(
                "FRAME CAPTURE ERROR:",
                error
            );


            showToast(
                "Frame failed",
                "Unable to create the thumbnail frame.",
                "error"
            );

        }

    }


    /* =========================================================
       LOAD THUMBNAIL VIDEO
    ========================================================= */

    function setupThumbnailVideo() {

        const video =
            $("thumbnailVideo");

        if (!video) {
            return;
        }


        if (
            state.videoURL &&
            !state.thumbnailURL
        ) {

            video.src =
                state.videoURL;

            video.load();

        }

    }


    /* =========================================================
       DETAILS EVENTS
    ========================================================= */

    function setupDetails() {

        [

            "longTitle",
            "longDescription",
            "longHashtags",
            "longTags"

        ].forEach(
            id => {

                $(id)
                    ?.addEventListener(
                        "input",
                        () => {

                            updateCounters();

                            updatePreview();

                            markDirty();

                        }
                    );

            }
        );

    }


    /* =========================================================
       VISIBILITY
    ========================================================= */

    function setupVisibility() {

        const options =
            qsa(
                ".visibilityOption"
            );


        options.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const value =
                            button.dataset.visibility ||
                            "public";


                        state.visibility =
                            value;


                        options.forEach(
                            item => {

                                item.classList.toggle(
                                    "active",
                                    item === button
                                );

                            }
                        );


                        updateSummary();

                        updatePreview();

                        markDirty();

                    }
                );

            }
        );

    }


    function renderVisibility() {

        qsa(
            ".visibilityOption"
        )
            .forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.visibility ===
                        state.visibility
                    );

                }
            );

    }


    /* =========================================================
       SETTINGS
    ========================================================= */

    function setupSettings() {

        const ids = [

            "showLikeCount",
            "allowComments",
            "showCommentCount",
            "allowDownload",
            "allowSharing",
            "allowRemix",
            "audienceSetting",
            "languageSetting",
            "categorySetting"

        ];


        ids.forEach(
            id => {

                $(id)
                    ?.addEventListener(
                        "change",
                        () => {

                            updateSummary();

                            updatePreview();

                            markDirty();

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


        if (!toggle || !panel) {
            return;
        }


        toggle.addEventListener(
            "click",
            () => {

                const isHidden =
                    panel.classList.contains(
                        "hidden"
                    );


                panel.classList.toggle(
                    "hidden",
                    !isHidden
                );


                toggle.setAttribute(
                    "aria-expanded",
                    String(isHidden)
                );


                chevron?.classList.toggle(
                    "rotate",
                    isHidden
                );

            }
        );

    }


    /* =========================================================
       COLLABORATORS
    ========================================================= */

    function setupCollaborators() {

        $("addCollaboratorBtn")
            ?.addEventListener(
                "click",
                openCollaboratorModal
            );


        $("closeCollaboratorModalBtn")
            ?.addEventListener(
                "click",
                closeCollaboratorModal
            );


        $("cancelCollaboratorBtn")
            ?.addEventListener(
                "click",
                closeCollaboratorModal
            );


        $("confirmCollaboratorBtn")
            ?.addEventListener(
                "click",
                addCollaborator
            );


        $("collaboratorUsername")
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        addCollaborator();

                    }

                }
            );

    }


    function openCollaboratorModal() {

        const modal =
            $("collaboratorModal");

        if (!modal) {
            return;
        }


        modal.classList.remove(
            "hidden"
        );


        document.body.classList.add(
            "modalOpen"
        );


        setTimeout(
            () => {

                $("collaboratorUsername")
                    ?.focus();

            },
            50
        );

    }


    function closeCollaboratorModal() {

        $("collaboratorModal")
            ?.classList.add(
                "hidden"
            );


        if (
            !document.querySelector(
                ".dialogOverlay:not(.hidden)"
            )
        ) {

            document.body.classList.remove(
                "modalOpen"
            );

        }

    }


    async function findUserByUsername(
        username
    ) {

        const db =
            getDatabase();


        const clean =
            safeString(
                username
            )
                .trim()
                .replace(
                    /^@/,
                    ""
                )
                .toLowerCase();


        if (!clean) {
            return null;
        }


        const snapshot =
            await db
                .ref(
                    `usernames/${clean}`
                )
                .once("value");


        if (snapshot.exists()) {

            const value =
                snapshot.val();


            if (
                typeof value ===
                "string"
            ) {

                const userSnapshot =
                    await db
                        .ref(
                            `users/${value}`
                        )
                        .once("value");


                if (
                    userSnapshot.exists()
                ) {

                    return {
                        uid: value,
                        ...userSnapshot.val()
                    };

                }

            }


            if (
                value &&
                typeof value ===
                "object"
            ) {

                const uid =
                    value.uid ||
                    value.userId ||
                    value.id ||
                    "";


                if (uid) {

                    return {
                        uid,
                        ...value
                    };

                }

            }

        }


        /* -----------------------------------------------------
           FALLBACK USER SCAN
        ----------------------------------------------------- */

        const usersSnapshot =
            await db
                .ref("users")
                .orderByChild(
                    "username"
                )
                .equalTo(
                    clean
                )
                .once("value");


        if (
            usersSnapshot.exists()
        ) {

            const users =
                usersSnapshot.val();


            const uid =
                Object.keys(
                    users
                )[0];


            if (uid) {

                return {
                    uid,
                    ...users[uid]
                };

            }

        }


        return null;

    }


    async function addCollaborator() {

        const input =
            $("collaboratorUsername");

        if (!input) {
            return;
        }


        const username =
            safeString(
                input.value
            )
                .trim()
                .replace(
                    /^@/,
                    ""
                );


        if (!username) {

            showToast(
                "Username required",
                "Enter a Viewora username.",
                "warning"
            );

            input.focus();

            return;

        }


        if (
            state.collaborators.length >=
            CONFIG.MAX_COLLABORATORS
        ) {

            showToast(
                "Limit reached",
                `You can add up to ${CONFIG.MAX_COLLABORATORS} collaborators.`,
                "warning"
            );

            return;

        }


        if (
            state.collaborators.some(
                item =>
                    safeString(
                        item.username
                    )
                        .toLowerCase() ===
                    username.toLowerCase()
            )
        ) {

            showToast(
                "Already added",
                "This collaborator is already on the video.",
                "warning"
            );

            return;

        }


        const user =
            getCurrentUser();


        try {

            const result =
                await findUserByUsername(
                    username
                );


            if (!result) {

                showToast(
                    "User not found",
                    "No Viewora creator with that username was found.",
                    "error"
                );

                return;

            }


            if (
                user &&
                String(result.uid) ===
                String(user.uid)
            ) {

                showToast(
                    "Not allowed",
                    "You cannot add yourself as a collaborator.",
                    "warning"
                );

                return;

            }


            state.collaborators.push({

                uid:
                    result.uid,

                username:
                    result.username ||
                    username,

                name:
                    result.name ||
                    result.fullName ||
                    username,

                profilePhoto:
                    result.profilePhoto ||
                    result.photoURL ||
                    "assets/default-avatar.png"

            });


            input.value =
                "";


            renderCollaborators();

            markDirty();

            closeCollaboratorModal();


            showToast(
                "Collaborator added",
                `@${username} was added to the video.`
            );

        } catch (error) {

            console.error(
                "COLLABORATOR ERROR:",
                error
            );


            showToast(
                "Unable to add",
                "Something went wrong while finding this creator.",
                "error"
            );

        }

    }


    function renderCollaborators() {

        const list =
            $("collaboratorList");

        if (!list) {
            return;
        }


        list.innerHTML =
            "";


        state.collaborators.forEach(
            (person, index) => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "collaboratorItem";


                item.innerHTML = `

                    <img
                        src="${escapeHTML(
                            person.profilePhoto ||
                            "assets/default-avatar.png"
                        )}"
                        alt=""
                    >

                    <div class="collaboratorItemInfo">

                        <strong>
                            ${escapeHTML(
                                person.name ||
                                person.username ||
                                "Creator"
                            )}
                        </strong>

                        <span>
                            @${escapeHTML(
                                person.username ||
                                ""
                            )}
                        </span>

                    </div>

                    <button
                        type="button"
                        class="removeCollaborator"
                        data-index="${index}"
                        aria-label="Remove collaborator"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                `;


                list.appendChild(
                    item
                );

            }
        );


        qsa(
            ".removeCollaborator"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const index =
                                safeNumber(
                                    button.dataset.index,
                                    -1
                                );


                            if (
                                index >= 0 &&
                                index <
                                state.collaborators.length
                            ) {

                                state.collaborators.splice(
                                    index,
                                    1
                                );


                                renderCollaborators();

                                markDirty();

                            }

                        }
                    );

                }
            );

    }


    /* =========================================================
       PREVIEW
    ========================================================= */

    function updatePreview() {

        const title =
            getInputValue(
                "longTitle"
            ) ||
            "Your video title";


        const description =
            getInputValue(
                "longDescription"
            ) ||
            "Your video description will appear here.";


        const hashtags =
            getInputValue(
                "longHashtags"
            ) ||
            "#viewora";


        const previewTitle =
            $("previewTitle");

        const previewDescription =
            $("previewDescription");

        const previewHashtags =
            $("previewHashtags");

        const fullTitle =
            $("fullPreviewTitle");

        const fullDescription =
            $("fullPreviewDescription");


        if (previewTitle) {

            previewTitle.textContent =
                title;

        }


        if (previewDescription) {

            previewDescription.textContent =
                description;

        }


        if (previewHashtags) {

            previewHashtags.textContent =
                hashtags;

        }


        if (fullTitle) {

            fullTitle.textContent =
                title;

        }


        if (fullDescription) {

            fullDescription.textContent =
                description;

        }


        const previewVideo =
            $("previewVideo");

        const fullVideo =
            $("fullPreviewVideo");


        if (
            previewVideo &&
            state.videoURL &&
            previewVideo.src !==
            state.videoURL
        ) {

            previewVideo.src =
                state.videoURL;

            previewVideo.load();

        }


        if (
            fullVideo &&
            state.videoURL &&
            fullVideo.src !==
            state.videoURL
        ) {

            fullVideo.src =
                state.videoURL;

            fullVideo.load();

        }


        updateAvatarPreview();

    }


    async function updateAvatarPreview() {

        const img =
            $("previewAvatar");

        const username =
            $("previewUsername");

        if (!img && !username) {
            return;
        }


        const user =
            getCurrentUser();

        if (!user) {
            return;
        }


        try {

            const db =
                getDatabase();


            const snapshot =
                await db
                    .ref(
                        `users/${user.uid}`
                    )
                    .once("value");


            const data =
                snapshot.val() ||
                {};


            if (img) {

                img.src =
                    data.profilePhoto ||
                    data.photoURL ||
                    "assets/default-avatar.png";

            }


            if (username) {

                const value =
                    data.username ||
                    user.displayName ||
                    "you";


                username.textContent =
                    "@" +
                    safeString(
                        value
                    )
                        .replace(
                            /^@/,
                            ""
                        );

            }

        } catch (error) {

            console.warn(
                "Avatar preview unavailable:",
                error
            );

        }

    }


    /* =========================================================
       SUMMARY
    ========================================================= */

    function updateSummary() {

        const visibility =
            state.visibility ||
            $("audienceSetting")
                ?.value ||
            "public";


        const comments =
            getChecked(
                "allowComments",
                true
            );


        const downloads =
            getChecked(
                "allowDownload",
                true
            );


        const summaryVisibility =
            $("summaryVisibility");

        const summaryComments =
            $("summaryComments");

        const summaryDownloads =
            $("summaryDownloads");


        if (summaryVisibility) {

            summaryVisibility.textContent =
                visibility
                    .charAt(0)
                    .toUpperCase() +
                visibility.slice(1);

        }


        if (summaryComments) {

            summaryComments.textContent =
                comments
                    ? "Enabled"
                    : "Disabled";

        }


        if (summaryDownloads) {

            summaryDownloads.textContent =
                downloads
                    ? "Enabled"
                    : "Disabled";

        }


        const checklist = {

            checkVideo:
                !!(
                    state.videoURL ||
                    state.videoFile
                ),

            checkTitle:
                !!getInputValue(
                    "longTitle"
                ),

            checkThumbnail:
                !!(
                    state.thumbnailURL ||
                    state.thumbnailFile ||
                    state.videoURL
                ),

            checkVisibility:
                !!visibility

        };


        Object.entries(
            checklist
        )
            .forEach(
                ([id, valid]) => {

                    const item =
                        $(id);

                    if (!item) {
                        return;
                    }


                    item.classList.toggle(
                        "complete",
                        valid
                    );

                }
            );


        const summary =
            $("publishSummary");


        if (summary) {

            const missing = [];


            if (!checklist.checkVideo) {
                missing.push("video");
            }

            if (!checklist.checkTitle) {
                missing.push("title");
            }


            if (missing.length) {

                summary.textContent =
                    "Add " +
                    missing.join(
                        " and "
                    ) +
                    " to continue.";

            } else {

                summary.textContent =
                    "Everything looks ready.";

            }

        }


        const rightStatus =
            $("rightStatusText");


        if (rightStatus) {

            rightStatus.textContent =
                checklist.checkVideo
                    ? "Ready to publish"
                    : "Video required";

        }

    }


    /* =========================================================
       FULLSCREEN PREVIEW
    ========================================================= */

    function setupPreview() {

        $("previewBtn")
            ?.addEventListener(
                "click",
                openFullPreview
            );


        $("fullscreenPreviewBtn")
            ?.addEventListener(
                "click",
                openFullPreview
            );


        $("closePreviewBtn")
            ?.addEventListener(
                "click",
                closeFullPreview
            );


        $("videoPlayBtn")
            ?.addEventListener(
                "click",
                () => {

                    const video =
                        $("videoPreview");

                    if (!video) {
                        return;
                    }


                    if (
                        video.paused
                    ) {

                        video.play()
                            .catch(
                                () => {}
                            );

                    } else {

                        video.pause();

                    }

                }
            );

    }


    function openFullPreview() {

        const overlay =
            $("previewOverlay");

        const video =
            $("fullPreviewVideo");


        if (!overlay || !video) {
            return;
        }


        if (!state.videoURL) {

            showToast(
                "Video unavailable",
                "Add a video before opening preview.",
                "warning"
            );

            return;

        }


        video.src =
            state.videoURL;

        video.load();


        overlay.classList.remove(
            "hidden"
        );


        document.body.classList.add(
            "modalOpen"
        );


        updatePreview();

    }


    function closeFullPreview() {

        const overlay =
            $("previewOverlay");

        const video =
            $("fullPreviewVideo");


        overlay?.classList.add(
            "hidden"
        );


        try {

            video?.pause();

        } catch (error) {}


        if (video) {

            video.removeAttribute(
                "src"
            );

            video.load();

        }


        if (
            !document.querySelector(
                ".overlay:not(.hidden), .dialogOverlay:not(.hidden), .previewOverlay:not(.hidden)"
            )
        ) {

            document.body.classList.remove(
                "modalOpen"
            );

        }

    }


    /* =========================================================
       LOAD EXISTING VIDEO
    ========================================================= */

    async function loadExistingVideo(
        uid,
        videoId
    ) {

        updateProcessing(
            "Loading your video...",
            12
        );


        const data =
            await readVideo(
                uid,
                videoId
            );


        if (!data) {

            return false;

        }


        if (
            !verifyOwnership(
                data,
                uid
            )
        ) {

            throw new Error(
                "You can only edit your own video."
            );

        }


        const normalized =
            normalizeVideo(
                data,
                videoId
            );


        state.originalVideo =
            normalized;

        state.videoId =
            videoId;

        state.isNewVideo =
            false;


        state.videoURL =
            normalized.videoUrl;


        state.thumbnailURL =
            normalized.thumbnail;


        state.title =
            normalized.title;


        state.description =
            normalized.description;


        state.hashtags =
            normalized.hashtags;


        state.tags =
            Array.isArray(
                normalized.tags
            )
                ? normalized.tags.join(
                    ", "
                )
                : safeString(
                    normalized.tags
                );


        state.visibility =
            normalized.visibility;


        state.allowComments =
            normalized.allowComments;


        state.showLikeCount =
            normalized.showLikeCount;


        state.showCommentCount =
            normalized.showCommentCount;


        state.allowDownload =
            normalized.allowDownload;


        state.allowSharing =
            normalized.allowSharing;


        state.allowRemix =
            normalized.allowRemix;


        state.audience =
            normalized.audience;


        state.language =
            normalized.language;


        state.category =
            normalized.category;


        state.collaborators =
            Array.isArray(
                normalized.collaborators
            )
                ? normalized.collaborators
                : [];


        renderState();

        // Show existing published video in all players
        if (state.videoURL) {
            setVideoSource(state.videoURL);
        }

        if (state.thumbnailURL) {
            const thumbImg = $("thumbnailImage") || $("thumbnailPreviewImg");
            if (thumbImg) {
                thumbImg.src = state.thumbnailURL;
                thumbImg.classList?.remove?.("hidden");
            }
            const thumbVideo = $("thumbnailVideo");
            if (thumbVideo && !state.thumbnailURL) {
                // leave as is
            }
        }

        updateVideoPlaceholder();
        updateVideoMetadata();
        updatePreview();
        updateSummary();
        updateCounters();

        setVideoState("Ready to edit", true);

        setSaveStatus("Saved");

        state.dirty = false;
        state.videoChanged = false;
        state.isNewVideo = false;


        updateProcessing(
            "Video loaded",
            100
        );


        return true;

    }


    /* =========================================================
       LOAD NEW VIDEO FROM INDEXEDDB
    ========================================================= */

    async function loadNewEditorVideo() {

        updateProcessing(
            "Recovering your new video...",
            12
        );


        let result =
            null;


        const targetId =
            getVideoIdFromURL();


        if (targetId) {

            result =
                await findIndexedDBVideoById(
                    targetId
                );

        }


        if (!result) {

            result =
                await loadVideoFromIndexedDB();

        }


        if (!result) {

            hideProcessing();


            setVideoState(
                "Add a video",
                false
            );


            updateVideoPlaceholder();

            updateSummary();


            return false;

        }


        if (result.blob) {

            setVideoFromBlob(
                result.blob
            );

        } else if (result.url) {

            state.videoURL =
                result.url;

            state.videoFile =
                null;

            state.videoChanged =
                true;


            setVideoSource(
                result.url
            );


            setVideoState(
                "New video ready",
                true
            );

        }


        const record =
            result.record ||
            {};


        state.title =
            record.title ||
            record.name ||
            "";


        state.description =
            record.description ||
            record.caption ||
            "";


        state.hashtags =
            record.hashtags ||
            "";


        state.tags =
            Array.isArray(
                record.tags
            )
                ? record.tags.join(
                    ", "
                )
                : record.tags ||
                    "";


        state.thumbnailURL =
            record.thumbnail ||
            record.thumbnailUrl ||
            record.cover ||
            "";


        state.isNewVideo =
            true;


        state.originalVideo =
            null;


        renderState();


        setSaveStatus(
            "Unsaved changes"
        );


        markDirty();


        updateProcessing(
            "Video ready",
            100
        );


        return true;

    }


    /* =========================================================
       LOAD MAIN
    ========================================================= */

    async function loadEditor() {

        const user =
            await waitForUser();


        if (!user) {

            hideProcessing();


            showToast(
                "Login required",
                "Please login before editing your video.",
                "error"
            );


            setTimeout(
                () => {

                    window.location.href =
                        "login.html";

                },
                900
            );


            return;

        }


        state.source =
            getSource();


        const requestedId =
            getVideoId();


        state.videoId =
            requestedId;


        const editorSource =
            state.source ===
            "editor";


        showProcessing(
            "Opening editor...",
            "Loading your video..."
        );


        try {

            let loaded =
                false;


            if (
                requestedId
            ) {

                loaded =
                    await loadExistingVideo(
                        user.uid,
                        requestedId
                    );


                /*
                 -------------------------------------------------
                 If an ID was supplied by editor but Firebase does
                 not have it yet, treat it as a new IndexedDB video.
                 -------------------------------------------------
                */

                if (
                    !loaded &&
                    editorSource
                ) {

                    loaded =
                        await loadNewEditorVideo();

                }

            } else {

                /*
                 -------------------------------------------------
                 No Firebase ID:
                 editor/new-upload mode.
                 -------------------------------------------------
                */

                loaded =
                    await loadNewEditorVideo();

            }


            if (!loaded) {

                hideProcessing();

                updateVideoPlaceholder();

                setSaveStatus(
                    "Not saved"
                );


                showToast(
                    "No video found",
                    "Please add a video to continue.",
                    "warning"
                );


                return;

            }


            hideProcessing();


            updateVideoPlaceholder();

            updateVideoMetadata();

            setupThumbnailVideo();

            updatePreview();

            updateSummary();

            updateCounters();


            setSaveStatus(
                state.isNewVideo
                    ? "Unsaved changes"
                    : "Saved"
            );


            console.log(
                "VIEWORA edit-video initialized",
                {
                    videoId:
                        state.videoId,
                    isNew:
                        state.isNewVideo
                }
            );

        } catch (error) {

            console.error(
                "LOAD VIDEO ERROR:",
                error
            );


            hideProcessing();


            showToast(
                "Unable to load video",
                getErrorMessage(
                    error
                ),
                "error"
            );

        }

    }


    /* =========================================================
       RENDER STATE
    ========================================================= */

    function renderState() {

        setInputValue(
            "longTitle",
            state.title
        );


        setInputValue(
            "longDescription",
            state.description
        );


        setInputValue(
            "longHashtags",
            state.hashtags
        );


        setInputValue(
            "longTags",
            state.tags
        );


        setChecked(
            "showLikeCount",
            state.showLikeCount
        );


        setChecked(
            "allowComments",
            state.allowComments
        );


        setChecked(
            "showCommentCount",
            state.showCommentCount
        );


        setChecked(
            "allowDownload",
            state.allowDownload
        );


        setChecked(
            "allowSharing",
            state.allowSharing
        );


        setChecked(
            "allowRemix",
            state.allowRemix
        );


        if (
            $("audienceSetting")
        ) {

            $("audienceSetting")
                .value =
                state.audience ||
                "general";

        }


        if (
            $("languageSetting")
        ) {

            $("languageSetting")
                .value =
                state.language ||
                "auto";

        }


        if (
            $("categorySetting")
        ) {

            $("categorySetting")
                .value =
                state.category ||
                "people";

        }


        renderVisibility();

        renderCollaborators();


        if (
            state.videoURL
        ) {

            setVideoSource(
                state.videoURL
            );

        }


        if (
            state.thumbnailURL
        ) {

            applyThumbnail(
                state.thumbnailURL
            );

        } else {

            setupThumbnailVideo();

        }


        updateVideoPlaceholder();

        updateCounters();

        updateSummary();

        updatePreview();

    }


    /* =========================================================
       STORAGE UPLOAD
    ========================================================= */

    /* =========================================================
       CLOUDINARY UPLOAD (primary)
    ========================================================= */

    function getCloudinaryConfig() {

        return {

            cloud:
                (
                    typeof window !== "undefined" &&
                    window.VIEWORA_CLOUDINARY_CLOUD
                ) ||
                "z5m6wjdf",

            preset:
                (
                    typeof window !== "undefined" &&
                    window.VIEWORA_CLOUDINARY_PRESET
                ) ||
                "Viewora-upload"

        };

    }


    function uploadToCloudinary(
        file,
        progressCallback
    ) {

        return new Promise(
            (resolve, reject) => {

                if (!file) {

                    reject(
                        new Error(
                            "No file selected for upload."
                        )
                    );

                    return;

                }


                const cfg =
                    getCloudinaryConfig();


                const url =
                    "https://api.cloudinary.com/v1_1/" +
                    encodeURIComponent(
                        cfg.cloud
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
                    cfg.preset
                );


                const xhr =
                    new XMLHttpRequest();


                let finished =
                    false;


                const timer =
                    setTimeout(
                        () => {

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
                                    "Cloudinary upload timed out."
                                )
                            );

                        },
                        300000
                    );


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
                        timer
                    );

                    cb(value);

                };


                xhr.upload.addEventListener(
                    "progress",
                    event => {

                        if (
                            !event.lengthComputable ||
                            typeof progressCallback !==
                            "function"
                        ) {
                            return;
                        }


                        const percent =
                            (
                                event.loaded /
                                event.total
                            ) * 100;


                        progressCallback(
                            percent
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


                            if (!secure) {

                                done(
                                    reject,
                                    new Error(
                                        "Cloudinary did not return a URL."
                                    )
                                );

                                return;

                            }


                            done(
                                resolve,
                                secure
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
                                "Cloudinary network error."
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


    async function uploadFileToStorage(
        file,
        path,
        progressCallback
    ) {

        if (!file) {

            throw new Error(
                "No file selected for upload."
            );

        }


        /*
         * Prefer Cloudinary (same as Shorts).
         */
        try {

            console.log(
                "VIEWORA: Uploading via Cloudinary...",
                {
                    name:
                        file.name,
                    type:
                        file.type,
                    size:
                        file.size
                }
            );


            return await uploadToCloudinary(
                file,
                progressCallback
            );

        } catch (cloudError) {

            console.warn(
                "VIEWORA Cloudinary failed, trying Firebase Storage:",
                cloudError
            );

        }


        /*
         * Firebase Storage fallback
         */
        let storage;


        try {

            storage =
                getStorage();

        } catch (error) {

            throw new Error(
                "Upload failed. Configure Cloudinary or enable Firebase Storage. " +
                (
                    error.message ||
                    ""
                )
            );

        }


        const ref =
            storage.ref(
                path
            );


        const uploadTask =
            ref.put(
                file,
                {
                    contentType:
                        file.type ||
                        undefined,

                    cacheControl:
                        "public,max-age=31536000"
                }
            );


        return new Promise(
            (resolve, reject) => {

                uploadTask.on(

                    "state_changed",

                    snapshot => {

                        const percent =
                            snapshot.totalBytes
                                ? (
                                    snapshot.bytesTransferred /
                                    snapshot.totalBytes
                                ) * 100
                                : 0;


                        if (
                            typeof progressCallback ===
                            "function"
                        ) {

                            progressCallback(
                                percent
                            );

                        }

                    },

                    error => {

                        reject(
                            error
                        );

                    },

                    async () => {

                        try {

                            const url =
                                await uploadTask
                                    .snapshot
                                    .ref
                                    .getDownloadURL();


                            resolve(
                                url
                            );

                        } catch (error) {

                            reject(
                                error
                            );

                        }

                    }

                );

            }
        );

    }


    /* =========================================================
       VIDEO UPLOAD
    ========================================================= */

    async function uploadVideo() {

        if (
            !state.videoFile
        ) {

            return state.videoURL;

        }


        const user =
            getCurrentUser();


        if (!user) {

            throw new Error(
                "User not logged in."
            );

        }


        if (!state.videoId) {

            state.videoId =
                generateVideoId();

            persistVideoId(
                state.videoId
            );

        }


        updateProcessing(
            "Uploading your video...",
            12
        );


        const safeName =
            safeString(
                state.videoFile.name
            )
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                )
                .slice(
                    -100
                );


        const path =
            `${CONFIG.STORAGE_VIDEO_PATH}/${user.uid}/${state.videoId}/${Date.now()}_${safeName || "video.mp4"}`;


        const url =
            await uploadFileToStorage(
                state.videoFile,
                path,
                percent => {

                    updateProcessing(
                        "Uploading your video...",
                        10 +
                        (
                            safeNumber(
                                percent
                            ) * 0.62
                        )
                    );

                }
            );


        return url;

    }


    /* =========================================================
       THUMBNAIL UPLOAD
    ========================================================= */

    async function uploadThumbnail() {

        if (
            !state.thumbnailFile
        ) {

            return (
                typeof state.thumbnailURL ===
                "string"
                    ? state.thumbnailURL
                    : ""
            );

        }


        const user =
            getCurrentUser();


        if (!user) {

            throw new Error(
                "User not logged in."
            );

        }


        if (!state.videoId) {

            state.videoId =
                generateVideoId();

            persistVideoId(
                state.videoId
            );

        }


        updateProcessing(
            "Uploading thumbnail...",
            76
        );


        const safeName =
            safeString(
                state.thumbnailFile.name
            )
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                )
                .slice(
                    -80
                );


        const path =
            `${CONFIG.STORAGE_THUMBNAIL_PATH}/${user.uid}/${state.videoId}/${Date.now()}_${safeName || "thumbnail.jpg"}`;


        return await uploadFileToStorage(
            state.thumbnailFile,
            path,
            percent => {

                updateProcessing(
                    "Uploading thumbnail...",
                    76 +
                    (
                        safeNumber(
                            percent
                        ) * 0.12
                    )
                );

            }
        );

    }


    /* =========================================================
       AUTOMATIC THUMBNAIL
    ========================================================= */

    async function generateVideoThumbnail() {

        const video =
            $("videoPreview");


        if (
            !video ||
            !state.videoURL
        ) {

            return null;

        }


        if (
            !video.videoWidth ||
            !video.videoHeight
        ) {

            await new Promise(
                resolve => {

                    if (
                        video.readyState >=
                        2
                    ) {

                        resolve();

                        return;

                    }


                    const handler =
                        () => {

                            video.removeEventListener(
                                "loadeddata",
                                handler
                            );

                            resolve();

                        };


                    video.addEventListener(
                        "loadeddata",
                        handler
                    );


                    setTimeout(
                        resolve,
                        5000
                    );

                }
            );

        }


        if (
            !video.videoWidth ||
            !video.videoHeight
        ) {

            return null;

        }


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


        if (!context) {
            return null;
        }


        const originalTime =
            safeNumber(
                video.currentTime
            );


        let captureTime =
            0;


        if (
            Number.isFinite(
                video.duration
            ) &&
            video.duration > 0
        ) {

            captureTime =
                Math.min(
                    1,
                    video.duration * 0.08
                );

        }


        try {

            video.currentTime =
                captureTime;


            await new Promise(
                resolve => {

                    const handler =
                        () => {

                            video.removeEventListener(
                                "seeked",
                                handler
                            );

                            resolve();

                        };


                    video.addEventListener(
                        "seeked",
                        handler
                    );


                    setTimeout(
                        resolve,
                        2500
                    );

                }
            );


            context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );


            const blob =
                await new Promise(
                    resolve =>
                        canvas.toBlob(
                            resolve,
                            "image/jpeg",
                            0.9
                        )
                );


            video.currentTime =
                originalTime;


            return blob;

        } catch (error) {

            try {
                video.currentTime =
                    originalTime;
            } catch (e) {}


            return null;

        }

    }


    async function ensureThumbnail(
        finalVideoURL
    ) {

        if (
            state.thumbnailFile
        ) {

            return await uploadThumbnail();

        }


        if (
            state.thumbnailURL
        ) {

            return state.thumbnailURL;

        }


        if (!finalVideoURL) {

            return "";

        }


        /*
         --------------------------------------------------------
         Generate only when video is loaded.
         --------------------------------------------------------
        */

        try {

            updateProcessing(
                "Creating video thumbnail...",
                88
            );


            const generated =
                await generateVideoThumbnail();


            if (!generated) {

                return "";

            }


            const user =
                getCurrentUser();


            if (!user) {
                return "";
            }


            if (!state.videoId) {

                state.videoId =
                    generateVideoId();

            }


            const path =
                `${CONFIG.STORAGE_THUMBNAIL_PATH}/${user.uid}/${state.videoId}/auto_${Date.now()}.jpg`;


            return await uploadFileToStorage(
                new File(
                    [generated],
                    "thumbnail.jpg",
                    {
                        type:
                            "image/jpeg"
                    }
                ),
                path,
                percent => {

                    updateProcessing(
                        "Saving thumbnail...",
                        88 +
                        (
                            safeNumber(
                                percent
                            ) * 0.08
                        )
                    );

                }
            );

        } catch (error) {

            console.warn(
                "AUTO THUMBNAIL SKIPPED:",
                error
            );


            return "";

        }

    }


    /* =========================================================
       BUILD DATABASE OBJECT
    ========================================================= */

    function buildVideoData(
        existing,
        formData,
        finalVideoURL,
        finalThumbnailURL,
        user
    ) {

        const old =
            existing ||
            {};


        const existingId =
            old.id ||
            old.videoId ||
            state.videoId;


        const data = {

            /*
             ---------------------------------------------------
             Identity
             ---------------------------------------------------
            */

            ...old,

            id:
                existingId,

            videoId:
                old.videoId ||
                existingId,

            type:
                "video",

            mediaType:
                "video",

            uid:
                old.uid ||
                old.userId ||
                user.uid,

            userId:
                old.userId ||
                old.uid ||
                user.uid,

            ownerId:
                old.ownerId ||
                user.uid,

            creatorId:
                old.creatorId ||
                user.uid,

            username:
                old.username ||
                user.displayName ||
                "",

            displayName:
                old.displayName ||
                user.displayName ||
                "",

            creatorName:
                old.creatorName ||
                user.displayName ||
                "",


            /*
             ---------------------------------------------------
             Video
             ---------------------------------------------------
            */

            video:
                finalVideoURL,

            videoUrl:
                finalVideoURL,

            videoURL:
                finalVideoURL,

            media:
                finalVideoURL,

            mediaUrl:
                finalVideoURL,


            /*
             ---------------------------------------------------
             Thumbnail
             ---------------------------------------------------
            */

            thumbnail:
                finalThumbnailURL,

            thumbnailUrl:
                finalThumbnailURL,

            cover:
                finalThumbnailURL,

            coverUrl:
                finalThumbnailURL,


            /*
             ---------------------------------------------------
             Details
             ---------------------------------------------------
            */

            title:
                formData.title,

            description:
                formData.description,

            caption:
                formData.description,

            hashtags:
                formData.hashtags,

            tags:
                formData.tags,


            /*
             ---------------------------------------------------
             Visibility
             ---------------------------------------------------
            */

            visibility:
                formData.visibility,

            audience:
                formData.audience,


            /*
             ---------------------------------------------------
             Interaction
             ---------------------------------------------------
            */

            allowComments:
                formData.allowComments,

            commentsAllowed:
                formData.allowComments,

            showLikeCount:
                formData.showLikeCount,

            showCommentCount:
                formData.showCommentCount,

            allowDownload:
                formData.allowDownload,

            allowSharing:
                formData.allowSharing,

            sharingAllowed:
                formData.allowSharing,

            allowRemix:
                formData.allowRemix,

            remixAllowed:
                formData.allowRemix,


            /*
             ---------------------------------------------------
             Metadata
             ---------------------------------------------------
            */

            language:
                formData.language,

            category:
                formData.category,

            collaborators:
                formData.collaborators,


            /*
             ---------------------------------------------------
             Statistics
             ---------------------------------------------------
             Preserve old values.
             Never write NaN.
             ---------------------------------------------------
            */

            views:
                safeNumber(
                    old.views,
                    0
                ),

            likes:
                safeNumber(
                    old.likes,
                    0
                ),

            comments:
                safeNumber(
                    old.comments,
                    0
                ),

            shares:
                safeNumber(
                    old.shares,
                    0
                ),

            saves:
                safeNumber(
                    old.saves,
                    0
                ),


            /*
             ---------------------------------------------------
             Status
             ---------------------------------------------------
            */

            status:
                formData.visibility ===
                "private"
                    ? "published"
                    : (
                        old.status ||
                        "published"
                    ),

            published:
                formData.visibility !==
                "private",


            /*
             ---------------------------------------------------
             Dates
             ---------------------------------------------------
            */

            updatedAt:
                serverTimestamp(),

            editedAt:
                serverTimestamp()

        };


        /*
         --------------------------------------------------------
         Preserve createdAt if available.
         --------------------------------------------------------
        */

        if (!old.createdAt) {

            data.createdAt =
                serverTimestamp();

        }


        /*
         --------------------------------------------------------
         Published timestamp for new videos.
         --------------------------------------------------------
        */

        if (
            !old.publishedAt &&
            formData.visibility !==
            "private"
        ) {

            data.publishedAt =
                serverTimestamp();

        }


        return data;

    }


    /* =========================================================
       USER MIRROR
    ========================================================= */

    async function saveUserVideoMirror(
        uid,
        videoId,
        data
    ) {

        const db =
            getDatabase();


        const mirror =
            {

                ...data,

                id:
                    videoId,

                videoId:
                    videoId,

                uid:
                    uid

            };


        await db
            .ref(
                `userVideos/${uid}/${videoId}`
            )
            .set(
                mirror
            );

    }


    /* =========================================================
       USER VIDEO COUNT
    ========================================================= */

    async function incrementUserVideoCount(
        uid
    ) {

        if (!uid) {
            return;
        }


        const db =
            getDatabase();


        const ref =
            db.ref(
                `users/${uid}/videos`
            );


        try {

            await ref.transaction(
                current => {

                    const value =
                        safeNumber(
                            current,
                            0
                        );


                    return value + 1;

                }
            );

        } catch (error) {

            console.warn(
                "VIDEO COUNT UPDATE SKIPPED:",
                error
            );

        }

    }


    /* =========================================================
       SAVE DATABASE
    ========================================================= */

    async function persistVideo(
        formData,
        publishMode
    ) {

        const user =
            getCurrentUser();


        if (!user) {

            throw new Error(
                "User not logged in."
            );

        }


        const db =
            getDatabase();


        /*
         --------------------------------------------------------
         NEW VIDEO
         --------------------------------------------------------
        */

        const wasNew =
            state.isNewVideo ||
            !state.videoId;


        if (!state.videoId) {

            state.videoId =
                generateVideoId();

            persistVideoId(
                state.videoId
            );

        }


        updateProcessing(
            "Preparing your video...",
            8
        );


        /*
         --------------------------------------------------------
         Existing database object
         --------------------------------------------------------
        */

        let existing =
            state.originalVideo;


        if (!wasNew) {

            try {

                const snapshot =
                    await db
                        .ref(
                            `videos/${state.videoId}`
                        )
                        .once(
                            "value"
                        );


                if (
                    snapshot.exists()
                ) {

                    existing =
                        snapshot.val();

                }

            } catch (error) {

                console.warn(
                    "Existing video refresh skipped:",
                    error
                );

            }

        }


        if (
            existing &&
            !verifyOwnership(
                existing,
                user.uid
            )
        ) {

            throw new Error(
                "You do not have permission to edit this video."
            );

        }


        /*
         --------------------------------------------------------
         VIDEO
         --------------------------------------------------------
        */

        let finalVideoURL =
            existing?.videoUrl ||
            existing?.videoURL ||
            existing?.video ||
            existing?.mediaUrl ||
            existing?.media ||
            state.videoURL ||
            "";


        /*
         * Existing video edit:
         * never re-upload / replace the video file.
         * Only new videos may upload a local file.
         */
        const allowVideoUpload =
            state.isNewVideo ||
            wasNew ||
            !finalVideoURL ||
            (
                typeof finalVideoURL === "string" &&
                (
                    finalVideoURL.startsWith("blob:") ||
                    finalVideoURL.startsWith("data:")
                )
            );


        if (
            state.videoFile &&
            allowVideoUpload
        ) {

            finalVideoURL =
                await uploadVideo();

        } else if (
            state.videoFile &&
            !allowVideoUpload
        ) {

            console.log(
                "VIEWORA: Skipping video re-upload for existing video."
            );


            state.videoFile =
                null;


            state.videoChanged =
                false;

        }


        if (
            !finalVideoURL ||
            (
                typeof finalVideoURL === "string" &&
                (
                    finalVideoURL.startsWith("blob:") ||
                    finalVideoURL.startsWith("data:")
                )
            )
        ) {

            throw new Error(
                "Video URL is missing."
            );

        }


        /*
         --------------------------------------------------------
         THUMBNAIL
         --------------------------------------------------------
        */

        let finalThumbnailURL =
            existing?.thumbnail ||
            existing?.thumbnailUrl ||
            existing?.cover ||
            existing?.coverUrl ||
            state.thumbnailURL ||
            "";


        if (
            state.thumbnailFile
        ) {

            finalThumbnailURL =
                await uploadThumbnail();

        }


        /*
         --------------------------------------------------------
         Auto thumbnail
         --------------------------------------------------------
        */

        if (
            !finalThumbnailURL
        ) {

            finalThumbnailURL =
                await ensureThumbnail(
                    finalVideoURL
                );

        }


        updateProcessing(
            "Saving video details...",
            92
        );


        const finalData =
            buildVideoData(
                existing,
                formData,
                finalVideoURL,
                finalThumbnailURL,
                user
            );


        /*
         --------------------------------------------------------
         MAIN VIDEO NODE
         --------------------------------------------------------
        */

        await db
            .ref(
                `videos/${state.videoId}`
            )
            .set(
                finalData
            );


        /*
         --------------------------------------------------------
         USER MIRROR
         --------------------------------------------------------
        */

        try {

            await saveUserVideoMirror(
                user.uid,
                state.videoId,
                finalData
            );

        } catch (mirrorError) {

            console.warn(
                "USER VIDEO MIRROR FAILED:",
                mirrorError
            );

        }


        /*
         --------------------------------------------------------
         LONG VIDEOS MIRROR
         --------------------------------------------------------
         Only update if node already exists.
         --------------------------------------------------------
        */

        try {

            const longRef =
                db.ref(
                    `longVideos/${state.videoId}`
                );


            const longSnapshot =
                await longRef.once(
                    "value"
                );


            if (
                longSnapshot.exists()
            ) {

                await longRef.set(
                    finalData
                );

            }

        } catch (longError) {

            console.warn(
                "LONG VIDEOS MIRROR SKIPPED:",
                longError
            );

        }


        /*
         --------------------------------------------------------
         POSTS MIRROR
         --------------------------------------------------------
         Only update if an existing post points to this video.
         --------------------------------------------------------
        */

        try {

            const postRef =
                db.ref(
                    `posts/${state.videoId}`
                );


            const postSnapshot =
                await postRef.once(
                    "value"
                );


            if (
                postSnapshot.exists()
            ) {

                const oldPost =
                    postSnapshot.val() ||
                    {};


                const mediaIsVideo =
                    oldPost.mediaType ===
                    "video" ||
                    !!(
                        oldPost.videoUrl ||
                        oldPost.videoURL ||
                        oldPost.video
                    );


                if (
                    mediaIsVideo
                ) {

                    await postRef.update({

                        video:
                            finalVideoURL,

                        videoUrl:
                            finalVideoURL,

                        videoURL:
                            finalVideoURL,

                        thumbnail:
                            finalThumbnailURL,

                        thumbnailUrl:
                            finalThumbnailURL,

                        title:
                            formData.title,

                        description:
                            formData.description,

                        updatedAt:
                            serverTimestamp()

                    });

                }

            }

        } catch (postError) {

            console.warn(
                "POST MIRROR SKIPPED:",
                postError
            );

        }


        /*
         --------------------------------------------------------
         NEW VIDEO COUNT
         --------------------------------------------------------
        */

        if (wasNew) {

            await incrementUserVideoCount(
                user.uid
            );

        }


        /*
         --------------------------------------------------------
         FINAL STATE
         --------------------------------------------------------
        */

        state.originalVideo =
            finalData;

        state.isNewVideo =
            false;

        state.videoChanged =
            false;

        state.thumbnailChanged =
            false;

        state.videoURL =
            finalVideoURL;

        state.thumbnailURL =
            finalThumbnailURL;

        state.videoFile =
            null;

        state.thumbnailFile =
            null;

        state.lastSavedAt =
            Date.now();

        state.dirty =
            false;

        // After publish, clear local staged video so next upload is not the old file
        if (publishMode === "publish") {
            clearLocalVideoBlob().catch(() => {});
            state.isNewVideo = false;
            state.videoChanged = false;
        }


        setSaveStatus(
            publishMode ===
            "publish"
                ? "Published"
                : "Saved"
        );


        updateProcessing(
            publishMode ===
            "publish"
                ? "Video published"
                : "Changes saved",
            100
        );


        return {

            id:
                state.videoId,

            data:
                finalData,

            wasNew

        };

    }


    /* =========================================================
       SAVE CHANGES
    ========================================================= */

    async function saveChanges(
        mode = "draft"
    ) {

        if (
            state.processing
        ) {
            return;
        }


        const user =
            getCurrentUser();


        if (!user) {

            showToast(
                "Login required",
                "Please login before saving.",
                "error"
            );

            return;

        }


        const formData =
            collectFormData();


        const publishing =
            mode ===
            "publish";


        if (
            !validateForm(
                formData,
                publishing
            )
        ) {

            return;

        }


        state.processing =
            true;


        setButtonsLoading(
            true
        );


        showProcessing(

            publishing
                ? "Publishing your video"
                : "Saving your changes",

            publishing
                ? "Preparing your video..."
                : "Preparing changes..."

        );


        try {

            const result =
                await persistVideo(
                    formData,
                    mode
                );


            hideProcessing();


            setButtonsLoading(
                false
            );


            state.processing =
                false;


            if (
                publishing
            ) {

                showToast(
                    "Video published",
                    "Your long video is now on Viewora."
                );


                setTimeout(
                    () => {

                        redirectAfterSave(
                            result.id
                        );

                    },
                    1000
                );

            } else {

                showToast(
                    "Changes saved",
                    "Your video has been updated successfully."
                );

            }

        } catch (error) {

            console.error(
                "SAVE VIDEO ERROR:",
                error
            );


            hideProcessing();

            setButtonsLoading(
                false
            );


            state.processing =
                false;


            setSaveStatus(
                "Save failed"
            );


            showToast(
                "Save failed",
                getErrorMessage(
                    error
                ),
                "error"
            );

        }

    }


    /* =========================================================
       PUBLISH DIALOG
    ========================================================= */

    function setupPublishing() {

        $("saveDraftBtn")
            ?.addEventListener(
                "click",
                () => {

                    saveChanges(
                        "draft"
                    );

                }
            );


        $("publishBtn")
            ?.addEventListener(
                "click",
                openPublishDialog
            );


        $("publishSideBtn")
            ?.addEventListener(
                "click",
                openPublishDialog
            );


        $("cancelPublishBtn")
            ?.addEventListener(
                "click",
                closePublishDialog
            );


        $("confirmPublishBtn")
            ?.addEventListener(
                "click",
                () => {

                    closePublishDialog();

                    saveChanges(
                        "publish"
                    );

                }
            );

    }


    function openPublishDialog() {

        const formData =
            collectFormData();


        if (
            !validateForm(
                formData,
                true
            )
        ) {

            return;

        }


        const text =
            $("publishDialogText");


        if (text) {

            const visibility =
                formData.visibility
                    .charAt(0)
                    .toUpperCase() +
                formData.visibility.slice(1);


            text.textContent =
                `Your video will be published as ${visibility}. You can change these settings later.`;

        }


        const dialog =
            $("publishDialog");


        if (!dialog) {
            return;
        }


        dialog.classList.remove(
            "hidden"
        );


        document.body.classList.add(
            "modalOpen"
        );

    }


    function closePublishDialog() {

        $("publishDialog")
            ?.classList.add(
                "hidden"
            );


        if (
            !document.querySelector(
                ".overlay:not(.hidden), .dialogOverlay:not(.hidden), .previewOverlay:not(.hidden)"
            )
        ) {

            document.body.classList.remove(
                "modalOpen"
            );

        }

    }


    /* =========================================================
       BACK
    ========================================================= */

    function setupBack() {

        $("backBtn")
            ?.addEventListener(
                "click",
                handleBack
            );

    }


    function handleBack() {

        if (
            state.dirty
        ) {

            const shouldLeave =
                window.confirm(
                    "You have unsaved changes. Leave the editor?"
                );


            if (!shouldLeave) {
                return;
            }

        }


        if (
            document.referrer &&
            document.referrer !==
            window.location.href
        ) {

            window.history.back();

            return;

        }


        window.location.href =
            "profile.html";

    }


    /* =========================================================
       REDIRECT
    ========================================================= */

    function redirectAfterSave(
        videoId
    ) {

        const referrer =
            document.referrer ||
            "";


        if (
            referrer.includes(
                "videos.html"
            )
        ) {

            window.location.href =
                `videos.html?id=${encodeURIComponent(videoId)}`;

            return;

        }


        if (
            referrer.includes(
                "profile.html"
            )
        ) {

            window.location.href =
                referrer;

            return;

        }


        window.location.href =
            `video.html?id=${encodeURIComponent(videoId)}`;

    }


    /* =========================================================
       DIRTY STATE
    ========================================================= */

    function markDirty() {

        if (
            state.processing
        ) {
            return;
        }


        state.dirty =
            true;


        setSaveStatus(
            "Unsaved changes"
        );

    }


    /* =========================================================
       KEYBOARD
    ========================================================= */

    function setupKeyboard() {

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }


                closeFrameSelector();

                closeCollaboratorModal();

                closePublishDialog();

                closeFullPreview();


                qsa(
                    ".overlay:not(.hidden)"
                )
                    .forEach(
                        overlay => {

                            overlay.classList.add(
                                "hidden"
                            );

                        }
                    );


                qsa(
                    ".dialogOverlay:not(.hidden)"
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


        document.addEventListener(
            "keydown",
            event => {

                if (
                    (
                        event.ctrlKey ||
                        event.metaKey
                    ) &&
                    event.key.toLowerCase() ===
                    "s"
                ) {

                    event.preventDefault();

                    saveChanges(
                        "draft"
                    );

                }

            }
        );

    }


    /* =========================================================
       PAGE VISIBILITY
    ========================================================= */

    function setupPageVisibility() {

        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.hidden
                ) {

                    [

                        $("videoPreview"),
                        $("previewVideo"),
                        $("fullPreviewVideo"),
                        $("frameVideo")

                    ]
                        .filter(Boolean)
                        .forEach(
                            video => {

                                try {

                                    video.pause();

                                } catch (error) {}

                            }
                        );

                }

            }
        );

    }


    /* =========================================================
       ERROR MESSAGE
    ========================================================= */

    function getErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Something went wrong. Please try again."
            );

        }


        const code =
            safeString(
                error.code
            );


        const message =
            safeString(
                error.message
            );


        const map = {

            "auth/requires-recent-login":
                "Please login again before saving.",

            "auth/unauthorized":
                "You are not authorized to perform this action.",

            "storage/unauthorized":
                "You do not have permission to upload this file.",

            "storage/canceled":
                "The upload was canceled.",

            "storage/quota-exceeded":
                "Storage quota has been exceeded.",

            "database/permission-denied":
                "You do not have permission to save this video.",

            "PERMISSION_DENIED":
                "You do not have permission to save this video."

        };


        if (
            map[code]
        ) {

            return map[code];

        }


        if (
            message
        ) {

            return message
                .replace(
                    /^Error:\s*/i,
                    ""
                );

        }


        return (
            "Something went wrong. Please try again."
        );

    }


    /* =========================================================
       CLEANUP
    ========================================================= */

    function cleanupObjectURLs() {

        [

            "currentObjectURL",
            "thumbnailObjectURL",
            "frameObjectURL"

        ]
            .forEach(
                key => {

                    const value =
                        state[key];


                    if (value) {

                        try {

                            URL.revokeObjectURL(
                                value
                            );

                        } catch (error) {}


                        state[key] =
                            "";

                    }

                }
            );

    }


    window.addEventListener(
        "beforeunload",
        event => {

            if (
                state.dirty &&
                !state.processing
            ) {

                event.preventDefault();

                event.returnValue =
                    "";

            }


            cleanupObjectURLs();

        }
    );


    /* =========================================================
       INITIALIZATION
    ========================================================= */


    function applyExistingVideoUILock() {

        /*
         * Existing video: hide / disable video replace controls.
         * Title, description, collab, visibility still editable.
         */
        const locked =
            !state.isNewVideo &&
            Boolean(
                state.videoId
            ) &&
            Boolean(
                state.originalVideo
            );


        [
            "uploadVideoBtn",
            "replaceVideoBtn"
        ]
            .forEach(
                id => {

                    const el =
                        $(id);


                    if (!el) {
                        return;
                    }


                    if (locked) {

                        el.classList.add(
                            "hidden"
                        );


                        el.setAttribute(
                            "disabled",
                            "true"
                        );

                    } else {

                        el.classList.remove(
                            "hidden"
                        );


                        el.removeAttribute(
                            "disabled"
                        );

                    }

                }
            );


        const input =
            $("videoInput");


        if (
            input &&
            locked
        ) {

            input.value =
                "";

        }

    }


    async function init() {

        try {

            setupBack();

            setupDetails();

            setupVisibility();

            setupSettings();

            setupAdditionalSettings();

            setupVideoPicker();

            setupThumbnailPicker();

            setupFrameSelector();

            setupCollaborators();

            setupPreview();

            setupPublishing();

            setupKeyboard();

            setupPageVisibility();


            updateCounters();

            updateSummary();


            await loadEditor();


            applyExistingVideoUILock();


            updateVideoPlaceholder();

            updateVideoMetadata();

            updatePreview();

            updateSummary();


            console.log(
                "VIEWORA EDIT VIDEO READY"
            );

        } catch (error) {

            console.error(
                "EDIT VIDEO INIT ERROR:",
                error
            );


            hideProcessing();


            showToast(
                "Editor error",
                getErrorMessage(
                    error
                ),
                "error"
            );

        }

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();

    }

})();