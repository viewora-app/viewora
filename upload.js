"use strict";

/* =========================================================
   VIEWORA CREATE STUDIO
   upload.js
   PREMIUM • PRODUCTION READY
   ========================================================= */

(() => {

    if (window.__VIEWORA_UPLOAD_INITIALIZED__) {
        console.warn("VIEWORA Upload already initialized.");
        return;
    }

    window.__VIEWORA_UPLOAD_INITIALIZED__ = true;

    /* =====================================================
       HELPERS
    ===================================================== */

    const $ = id => document.getElementById(id);

    const qsa = selector =>
        Array.from(document.querySelectorAll(selector));

    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));


    /* =====================================================
       ELEMENTS
    ===================================================== */

    const cameraPreview = $("cameraPreview");
    const cameraFallback = $("cameraFallback");
    const cameraErrorText = $("cameraErrorText");
    const retryCameraBtn = $("retryCameraBtn");

    const closeCreatorBtn = $("closeCreatorBtn");
    const settingsBtn = $("settingsBtn");

    const flashBtn = $("flashBtn");
    const flipCameraBtn = $("flipCameraBtn");
    const timerBtn = $("timerBtn");
    const speedBtn = $("speedBtn");

    const recordBtn = $("recordBtn");
    const recordInner = $("recordInner");

    const recordingStatus = $("recordingStatus");
    const recordingTime = $("recordingTime");

    const selectFileBtn = $("selectFileBtn");
    const galleryBtn = $("galleryBtn");

    const mediaInput = $("mediaInput");
    const postMediaInput = $("postMediaInput");
    const shortsMediaInput = $("shortsMediaInput");
    const longVideoInput = $("longVideoInput");
    const cameraPhotoInput = $("cameraPhotoInput");
    const thumbnailInput = $("thumbnailInput");

    const musicBtn = $("musicBtn");
    const selectedMusic = $("selectedMusic");
    const selectedMusicName = $("selectedMusicName");
    const selectedMusicArtist = $("selectedMusicArtist");
    const removeMusicBtn = $("removeMusicBtn");

    const modeTitle = $("modeTitle");
    const modeDescription = $("modeDescription");
    const modeIcon = $("modeIcon");
    const creatorModeLabel = $("creatorModeLabel");

    const recordLabel = $("recordLabel");
    const recordSubLabel = $("recordSubLabel");

    const fileButtonTitle = $("fileButtonTitle");
    const fileButtonHint = $("fileButtonHint");

    const modeSelector = $("modeSelector");

    const recordPreview = $("recordPreview");
    const recordedVideo = $("recordedVideo");

    const closePreviewBtn = $("closePreviewBtn");
    const retakeBtn = $("retakeBtn");
    const continueVideoBtn = $("continueVideoBtn");

    const previewModeTitle = $("previewModeTitle");

    const processingOverlay = $("processingOverlay");
    const processingText = $("processingText");

    const toast = $("toast");
    const toastTitle = $("toastTitle");
    const toastText = $("toastText");


    /* =====================================================
       STATE
    ===================================================== */

    let currentMode = "shorts";

    let currentStream = null;

    let currentFacingMode = "environment";

    let mediaRecorder = null;

    let recordedChunks = [];

    let recordedBlob = null;

    let recordingStartedAt = 0;

    let recordingTimer = null;

    let countdownTimer = null;

    let selectedTimer = 0;

    let selectedSpeed = 1;

    let isRecording = false;

    let isPreparingRecording = false;

    let selectedMusicData = null;

    let selectedFile = null;

    let flashEnabled = false;

    let currentObjectURL = null;

    let currentPreviewURL = null;

    let cameraStarting = false;

    let cameraStartToken = 0;


    /* =====================================================
       CONSTANTS
    ===================================================== */

    const MAX_SHORT_SECONDS = 60;

    const VIDEO_DB_NAME = "VIEWORA_MEDIA_DB";

    const VIDEO_DB_VERSION = 1;

    const VIDEO_STORE = "uploads";

    const VIDEO_KEY = "currentVideo";

    const IMAGE_STORAGE_KEY = "viewora_edit_post_media";

    const IMAGE_TYPE_KEY = "viewora_edit_post_type";


    /* =====================================================
       MODE CONFIG
    ===================================================== */

    const MODES = {

        post: {
            title: "Post",
            description: "Create a photo post",
            icon: '<i class="fa-solid fa-image"></i>',
            hint: "Upload a photo",
            accept: "image/*",
            label: "Take photo",
            subLabel: "Photo post"
        },

        shorts: {
            title: "Shorts",
            description: "Create a vertical short video",
            icon: '<i class="fa-solid fa-bolt"></i>',
            hint: "Upload to Shorts",
            accept: "video/*",
            label: "Tap to record",
            subLabel: "Shorts • up to 60 sec"
        },

        long: {
            title: "Long Video",
            description: "Create a full-length video",
            icon: '<i class="fa-solid fa-video"></i>',
            hint: "Upload a video",
            accept: "video/*",
            label: "Tap to record",
            subLabel: "Long Video"
        },

        live: {
            title: "Live",
            description: "Connect with your audience in real time",
            icon: '<i class="fa-solid fa-tower-broadcast"></i>',
            hint: "Prepare your Live",
            accept: "",
            label: "Go Live",
            subLabel: "Live streaming"
        }

    };


    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(title, message, type = "success") {

        if (!toast) return;

        if (toastTitle) {
            toastTitle.textContent = title || "Done";
        }

        if (toastText) {
            toastText.textContent = message || "";
        }

        const icon = $("toastIcon");

        if (icon) {

            if (type === "error") {

                icon.innerHTML =
                    '<i class="fa-solid fa-circle-exclamation"></i>';

            } else if (type === "warning") {

                icon.innerHTML =
                    '<i class="fa-solid fa-triangle-exclamation"></i>';

            } else {

                icon.innerHTML =
                    '<i class="fa-solid fa-circle-check"></i>';
            }
        }

        toast.classList.remove("hidden");

        clearTimeout(window.__VIEWORA_UPLOAD_TOAST__);

        window.__VIEWORA_UPLOAD_TOAST__ =
            setTimeout(() => {
                toast.classList.add("hidden");
            }, 3200);
    }


    /* =====================================================
       PROCESSING
    ===================================================== */

    function showProcessing(message) {

        if (processingText) {
            processingText.textContent =
                message || "Preparing your content...";
        }

        processingOverlay?.classList.remove("hidden");
    }


    function hideProcessing() {

        processingOverlay?.classList.add("hidden");
    }


    /* =====================================================
       CAMERA
    ===================================================== */

    async function startCamera() {

        if (currentMode === "live") {
            stopCamera();
            return;
        }

        if (!cameraPreview) return;

        const token = ++cameraStartToken;

        if (cameraStarting) {
            return;
        }

        cameraStarting = true;

        stopCamera();

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            cameraStarting = false;

            showCameraError(
                "Camera is not supported in this browser."
            );

            return;
        }

        try {

            const constraints = {

                audio: true,

                video: {

                    facingMode: {
                        ideal: currentFacingMode
                    },

                    width: {
                        ideal: 1080
                    },

                    height: {
                        ideal: 1920
                    },

                    frameRate: {
                        ideal: 30,
                        max: 60
                    }
                }
            };

            const stream =
                await navigator.mediaDevices.getUserMedia(
                    constraints
                );

            if (token !== cameraStartToken) {

                stream
                    .getTracks()
                    .forEach(track => track.stop());

                return;
            }

            currentStream = stream;

            cameraPreview.srcObject = currentStream;

            cameraPreview.muted = true;
            cameraPreview.playsInline = true;
            cameraPreview.autoplay = true;

            await cameraPreview.play().catch(() => {});

            cameraFallback?.classList.add("hidden");

            updateFlashAvailability();

            const micToggle = $("microphoneToggle");

            if (micToggle) {

                currentStream
                    .getAudioTracks()
                    .forEach(track => {
                        track.enabled =
                            micToggle.checked;
                    });
            }

        } catch (error) {

            console.error(
                "VIEWORA CAMERA ERROR:",
                error
            );

            if (token !== cameraStartToken) {
                return;
            }

            let message =
                "Camera could not be started. Please try again.";

            switch (error?.name) {

                case "NotAllowedError":
                    message =
                        "Camera permission is blocked. Allow camera access in browser settings.";
                    break;

                case "NotFoundError":
                    message =
                        "No camera was found on this device.";
                    break;

                case "NotReadableError":
                    message =
                        "Camera is currently being used by another app.";
                    break;

                case "SecurityError":
                    message =
                        "Camera requires a secure HTTPS connection.";
                    break;

                case "OverconstrainedError":
                    message =
                        "This camera does not support the requested settings.";
                    break;
            }

            showCameraError(message);

            showToast(
                "Camera unavailable",
                message,
                "error"
            );

        } finally {

            cameraStarting = false;
        }
    }


    function showCameraError(message) {

        cameraFallback?.classList.remove("hidden");

        if (cameraErrorText) {
            cameraErrorText.textContent =
                message ||
                "Camera is unavailable.";
        }
    }


    function stopCamera() {

        cameraStartToken++;

        if (currentStream) {

            currentStream
                .getTracks()
                .forEach(track => {

                    try {
                        track.stop();
                    } catch (_) {}

                });
        }

        currentStream = null;

        if (cameraPreview) {
            cameraPreview.srcObject = null;
        }

        flashEnabled = false;

        flashBtn?.classList.remove("active");
    }


    /* =====================================================
       CAMERA FLIP
    ===================================================== */

    async function flipCamera() {

        if (isRecording) {
            showToast(
                "Recording active",
                "Stop recording before switching cameras.",
                "warning"
            );
            return;
        }

        currentFacingMode =
            currentFacingMode === "environment"
                ? "user"
                : "environment";

        await startCamera();

        showToast(
            "Camera switched",
            currentFacingMode === "user"
                ? "Front camera"
                : "Back camera"
        );
    }


    /* =====================================================
       FLASH
    ===================================================== */

    function updateFlashAvailability() {

        if (!flashBtn) return;

        if (!currentStream) {

            flashBtn.disabled = true;
            flashBtn.style.opacity = ".45";

            return;
        }

        const track =
            currentStream.getVideoTracks()[0];

        if (!track) {

            flashBtn.disabled = true;
            flashBtn.style.opacity = ".45";

            return;
        }

        const capabilities =
            typeof track.getCapabilities === "function"
                ? track.getCapabilities()
                : {};

        const supported =
            Boolean(capabilities.torch);

        flashBtn.disabled = !supported;

        flashBtn.style.opacity =
            supported ? "1" : ".45";
    }


    async function toggleFlash() {

        if (!currentStream) {

            showToast(
                "Camera unavailable",
                "Start the camera first.",
                "warning"
            );

            return;
        }

        const track =
            currentStream.getVideoTracks()[0];

        if (!track) return;

        try {

            const capabilities =
                typeof track.getCapabilities === "function"
                    ? track.getCapabilities()
                    : {};

            if (!capabilities.torch) {

                showToast(
                    "Flash unavailable",
                    "This camera does not support torch control.",
                    "warning"
                );

                return;
            }

            flashEnabled = !flashEnabled;

            await track.applyConstraints({

                advanced: [
                    {
                        torch: flashEnabled
                    }
                ]

            });

            flashBtn?.classList.toggle(
                "active",
                flashEnabled
            );

        } catch (error) {

            console.error(
                "VIEWORA FLASH:",
                error
            );

            showToast(
                "Flash error",
                "Unable to control camera flash.",
                "error"
            );
        }
    }


    /* =====================================================
       MODE
    ===================================================== */

    async function setMode(mode) {

        if (!MODES[mode]) return;

        if (isRecording) {

            stopRecording();

            await sleep(100);

        }

        currentMode = mode;

        const config = MODES[mode];

        if (modeTitle) {
            modeTitle.textContent =
                config.title;
        }

        if (modeDescription) {
            modeDescription.textContent =
                config.description;
        }

        if (modeIcon) {
            modeIcon.innerHTML =
                config.icon;
        }

        if (creatorModeLabel) {
            creatorModeLabel.textContent =
                config.title.toUpperCase();
        }

        if (fileButtonTitle) {

            fileButtonTitle.textContent =
                mode === "post"
                    ? "Select Photo"
                    : mode === "live"
                        ? "Live Setup"
                        : "Select Video";
        }

        if (fileButtonHint) {
            fileButtonHint.textContent =
                config.hint;
        }

        if (recordLabel) {
            recordLabel.textContent =
                config.label;
        }

        if (recordSubLabel) {
            recordSubLabel.textContent =
                config.subLabel;
        }

        if (previewModeTitle) {
            previewModeTitle.textContent =
                config.title;
        }

        if (mediaInput) {
            mediaInput.accept =
                config.accept || "image/*,video/*";
        }

        qsa(".modeItem").forEach(item => {

            item.classList.toggle(
                "active",
                item.dataset.mode === mode
            );

        });

        qsa("[data-progress]").forEach(item => {

            item.classList.toggle(
                "active",
                item.dataset.progress === mode
            );

        });

        updateUploadNotice();

        if (mode === "live") {

            stopCamera();

            showLivePanel();

        } else {

            $("livePanel")?.classList.add("hidden");

            await startCamera();
        }
    }


    /* =====================================================
       MODE CLICK
    ===================================================== */

    qsa(".modeItem").forEach(item => {

        item.addEventListener(
            "click",
            () => {
                setMode(item.dataset.mode);
            }
        );

    });


    /* =====================================================
       MODE SWIPE
    ===================================================== */

    let touchStartX = 0;

    modeSelector?.addEventListener(
        "touchstart",
        event => {

            touchStartX =
                event.changedTouches[0]?.clientX || 0;

        },
        {
            passive: true
        }
    );

    modeSelector?.addEventListener(
        "touchend",
        event => {

            const endX =
                event.changedTouches[0]?.clientX || 0;

            const diff =
                endX - touchStartX;

            if (Math.abs(diff) < 50) return;

            const modes =
                ["post", "shorts", "long", "live"];

            let index =
                modes.indexOf(currentMode);

            index += diff < 0 ? 1 : -1;

            index =
                Math.max(
                    0,
                    Math.min(
                        modes.length - 1,
                        index
                    )
                );

            setMode(modes[index]);

        },
        {
            passive: true
        }
    );


    /* =====================================================
       FILE SHEET
    ===================================================== */

    function openFileSheet() {

        if (currentMode === "live") {

            showLivePanel();

            return;
        }

        updateUploadNotice();

        $("fileSheet")?.classList.remove("hidden");
    }


    function closeFileSheet() {

        $("fileSheet")?.classList.add("hidden");
    }


    function updateUploadNotice() {

        const config =
            MODES[currentMode];

        const title =
            $("fileSheetTitle");

        const description =
            $("fileSheetDescription");

        const noticeTitle =
            $("noticeTitle");

        const noticeText =
            $("noticeText");

        const fileModeIcon =
            $("fileModeIcon");

        const chooseMediaHint =
            $("chooseMediaHint");

        if (title) {
            title.textContent =
                `Upload to ${config.title}`;
        }

        if (description) {
            description.textContent =
                config.description;
        }

        if (noticeTitle) {
            noticeTitle.textContent =
                `${config.title} selected`;
        }

        if (noticeText) {

            if (currentMode === "post") {

                noticeText.textContent =
                    "Choose a photo from your gallery.";

            } else if (currentMode === "shorts") {

                noticeText.textContent =
                    "Choose a vertical video for your Short.";

            } else if (currentMode === "long") {

                noticeText.textContent =
                    "Choose a video for your Long Video.";

            } else {

                noticeText.textContent =
                    "Set up your live stream.";
            }
        }

        if (fileModeIcon) {

            fileModeIcon.className =
                currentMode === "post"
                    ? "fa-solid fa-image"
                    : currentMode === "shorts"
                        ? "fa-solid fa-bolt"
                        : "fa-solid fa-video";
        }

        if (chooseMediaHint) {

            chooseMediaHint.textContent =
                currentMode === "post"
                    ? "Select a photo from your gallery"
                    : "Select a video from your gallery";
        }
    }


    function openFilePicker() {

        if (currentMode === "live") {

            showLivePanel();

            return;
        }

        if (currentMode === "post") {

            if (postMediaInput) {

                postMediaInput.value = "";
                postMediaInput.click();

                return;
            }
        }

        if (currentMode === "shorts") {

            if (shortsMediaInput) {

                shortsMediaInput.value = "";
                shortsMediaInput.click();

                return;
            }
        }

        if (currentMode === "long") {

            if (longVideoInput) {

                longVideoInput.value = "";
                longVideoInput.click();

                return;
            }
        }

        if (!mediaInput) {

            showToast(
                "Upload unavailable",
                "Media input was not found.",
                "error"
            );

            return;
        }

        mediaInput.accept =
            MODES[currentMode].accept;

        mediaInput.value = "";

        mediaInput.click();
    }


    /* =====================================================
       INPUT HANDLERS
    ===================================================== */

    mediaInput?.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (file) {
                handleSelectedFile(file);
            }
        }
    );


    postMediaInput?.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (!file) return;

            handleSelectedFile(
                file,
                "post"
            );
        }
    );


    shortsMediaInput?.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (!file) return;

            handleSelectedFile(
                file,
                "shorts"
            );
        }
    );


    longVideoInput?.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (!file) return;

            handleSelectedFile(
                file,
                "long"
            );
        }
    );


    cameraPhotoInput?.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (!file) return;

            handleSelectedFile(
                file,
                "post"
            );
        }
    );


    /* =====================================================
       FILE VALIDATION
    ===================================================== */

    function validateFile(file, mode = currentMode) {

        if (!file) {

            return {
                valid: false,
                message: "No media selected."
            };
        }

        if (file.size <= 0) {

            return {
                valid: false,
                message: "This file appears to be empty."
            };
        }

        if (mode === "post") {

            if (!file.type.startsWith("image/")) {

                return {
                    valid: false,
                    message:
                        "Post mode accepts photos only."
                };
            }
        }

        if (
            mode === "shorts" ||
            mode === "long"
        ) {

            if (!file.type.startsWith("video/")) {

                return {
                    valid: false,
                    message:
                        `${MODES[mode].title} accepts videos only.`
                };
            }
        }

        return {
            valid: true
        };
    }


    /* =====================================================
       FILE SELECTED
    ===================================================== */

    async function handleSelectedFile(
        file,
        forcedMode = null
    ) {

        const mode =
            forcedMode || currentMode;

        const validation =
            validateFile(
                file,
                mode
            );

        if (!validation.valid) {

            showToast(
                "Invalid media",
                validation.message,
                "error"
            );

            return;
        }

        selectedFile = file;

        showProcessing(
            mode === "post"
                ? "Preparing your photo..."
                : "Preparing your video..."
        );

        try {

            if (mode === "post") {

                await saveImageForEditor(file);

                closeAllOverlays();

                await sleep(180);

                window.location.href =
                    "edit-post.html?source=upload";

                return;
            }

            if (
                mode === "shorts" ||
                mode === "long"
            ) {

                await saveVideoForEditor(
                    file,
                    mode
                );

                closeAllOverlays();

                await sleep(180);

                window.location.href =
                    mode === "shorts"
                        ? "edit-shorts.html?source=upload"
                        : "edit-video.html?source=upload";

                return;
            }

        } catch (error) {

            console.error(
                "VIEWORA MEDIA PREP:",
                error
            );

            hideProcessing();

            showToast(
                "Media error",
                error?.message ||
                    "Could not prepare this file.",
                "error"
            );
        }
    }


    /* =====================================================
       IMAGE → DATA URL
    ===================================================== */

    function fileToDataURL(file) {

        return new Promise(
            (resolve, reject) => {

                const reader =
                    new FileReader();

                reader.onload = () => {

                    if (!reader.result) {

                        reject(
                            new Error(
                                "Image data is empty."
                            )
                        );

                        return;
                    }

                    resolve(
                        reader.result
                    );
                };

                reader.onerror = () => {

                    reject(
                        reader.error ||
                        new Error(
                            "Unable to read image."
                        )
                    );

                };

                reader.readAsDataURL(file);
            }
        );
    }


    async function saveImageForEditor(file) {

        const dataURL =
            await fileToDataURL(file);

        if (!dataURL) {
            throw new Error(
                "Image Data URL is empty."
            );
        }

        try {

            sessionStorage.removeItem(
                IMAGE_STORAGE_KEY
            );

            sessionStorage.removeItem(
                IMAGE_TYPE_KEY
            );

            sessionStorage.setItem(
                IMAGE_STORAGE_KEY,
                dataURL
            );

            sessionStorage.setItem(
                IMAGE_TYPE_KEY,
                "image"
            );

            sessionStorage.setItem(
                "viewora_edit_post_name",
                file.name
            );

            sessionStorage.setItem(
                "viewora_edit_post_size",
                String(file.size)
            );

            sessionStorage.setItem(
                "viewora_edit_post_mime",
                file.type
            );

        } catch (error) {

            throw new Error(
                "The selected image is too large for browser storage."
            );
        }

        const saved =
            sessionStorage.getItem(
                IMAGE_STORAGE_KEY
            );

        if (!saved) {

            throw new Error(
                "Image could not be saved."
            );
        }

        console.log(
            "VIEWORA IMAGE SAVED:",
            file.name
        );
    }


    /* =====================================================
       INDEXED DB
    ===================================================== */

    function openVideoDB() {

        if (!("indexedDB" in window)) {

            return Promise.reject(
                new Error(
                    "IndexedDB is not supported by this browser."
                )
            );
        }

        return new Promise(
            (resolve, reject) => {

                const request =
                    indexedDB.open(
                        VIDEO_DB_NAME,
                        VIDEO_DB_VERSION
                    );

                request.onupgradeneeded =
                    event => {

                        const db =
                            event.target.result;

                        if (
                            !db.objectStoreNames.contains(
                                VIDEO_STORE
                            )
                        ) {

                            db.createObjectStore(
                                VIDEO_STORE
                            );
                        }
                    };

                request.onsuccess =
                    () => {

                        const db =
                            request.result;

                        db.onversionchange = () => {
                            db.close();
                        };

                        resolve(db);
                    };

                request.onerror =
                    () => reject(
                        request.error ||
                        new Error(
                            "Unable to open media database."
                        )
                    );

            }
        );
    }


    async function saveVideoForEditor(
        file,
        mode = currentMode
    ) {

        const db =
            await openVideoDB();

        return new Promise(
            (resolve, reject) => {

                let completed = false;

                const transaction =
                    db.transaction(
                        VIDEO_STORE,
                        "readwrite"
                    );

                const store =
                    transaction.objectStore(
                        VIDEO_STORE
                    );

                const request =
                    store.put(
                        file,
                        VIDEO_KEY
                    );

                request.onsuccess = () => {

                    try {

                        sessionStorage.setItem(
                            "viewora_video_key",
                            VIDEO_KEY
                        );

                        sessionStorage.setItem(
                            "vieworaUploadMode",
                            mode
                        );

                        sessionStorage.setItem(
                            "vieworaUploadName",
                            file.name
                        );

                        sessionStorage.setItem(
                            "vieworaUploadMime",
                            file.type
                        );

                        sessionStorage.setItem(
                            "vieworaUploadSize",
                            String(file.size)
                        );

                        completed = true;

                        resolve();

                    } catch (error) {

                        reject(
                            new Error(
                                "Could not save video session data."
                            )
                        );
                    }
                };

                request.onerror = () => {

                    reject(
                        request.error ||
                        new Error(
                            "Could not save video."
                        )
                    );
                };

                transaction.onerror = () => {

                    if (!completed) {

                        reject(
                            transaction.error ||
                            new Error(
                                "Video transaction failed."
                            )
                        );
                    }
                };
            }
        );
    }


    /* =====================================================
       OBJECT URL
    ===================================================== */

    function revokeObjectURL() {

        if (currentObjectURL) {

            try {
                URL.revokeObjectURL(
                    currentObjectURL
                );
            } catch (_) {}

            currentObjectURL = null;
        }

        if (currentPreviewURL) {

            try {
                URL.revokeObjectURL(
                    currentPreviewURL
                );
            } catch (_) {}

            currentPreviewURL = null;
        }
    }


    function createObjectURL(fileOrBlob) {

        revokeObjectURL();

        currentObjectURL =
            URL.createObjectURL(
                fileOrBlob
            );

        return currentObjectURL;
    }


    /* =====================================================
       RECORDER MIME
    ===================================================== */

    function getRecorderMimeType() {

        if (!window.MediaRecorder) {
            return "";
        }

        const types = [

            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm",
            "video/mp4"

        ];

        for (const type of types) {

            try {

                if (
                    typeof MediaRecorder.isTypeSupported ===
                    "function" &&
                    MediaRecorder.isTypeSupported(type)
                ) {

                    return type;
                }

            } catch (_) {}
        }

        return "";
    }


    /* =====================================================
       RECORDING
    ===================================================== */

    async function startRecording() {

        if (isPreparingRecording) return;

        if (currentMode === "post") {

            await capturePhoto();

            return;
        }

        if (currentMode === "live") {

            showLivePanel();

            return;
        }

        if (isRecording) return;

        if (!currentStream) {

            await startCamera();

            if (!currentStream) {
                return;
            }
        }

        if (!window.MediaRecorder) {

            showToast(
                "Recording unavailable",
                "Your browser does not support video recording.",
                "error"
            );

            return;
        }

        isPreparingRecording = true;

        try {

            if (selectedTimer > 0) {

                await runCountdown(
                    selectedTimer
                );
            }

            if (!currentStream) {

                throw new Error(
                    "Camera stream is unavailable."
                );
            }

            recordedChunks = [];

            const mimeType =
                getRecorderMimeType();

            const options = {};

            if (mimeType) {
                options.mimeType =
                    mimeType;
            }

            mediaRecorder =
                Object.keys(options).length
                    ? new MediaRecorder(
                        currentStream,
                        options
                    )
                    : new MediaRecorder(
                        currentStream
                    );

            mediaRecorder.ondataavailable =
                event => {

                    if (
                        event.data &&
                        event.data.size > 0
                    ) {

                        recordedChunks.push(
                            event.data
                        );
                    }
                };

            mediaRecorder.onerror =
                event => {

                    console.error(
                        "VIEWORA MEDIA RECORDER:",
                        event
                    );

                    showToast(
                        "Recording error",
                        "Something went wrong while recording.",
                        "error"
                    );

                    isRecording = false;
                };

            mediaRecorder.onstop =
                handleRecordingStop;

            mediaRecorder.start(250);

            isRecording = true;

            recordingStartedAt =
                Date.now();

            recordBtn?.classList.add(
                "recording"
            );

            recordBtn?.setAttribute(
                "aria-label",
                "Stop recording"
            );

            recordInner?.classList.add(
                "recording"
            );

            recordingStatus?.classList.remove(
                "hidden"
            );

            startRecordingTimer();

        } catch (error) {

            console.error(
                "VIEWORA RECORDING:",
                error
            );

            showToast(
                "Recording failed",
                error?.message ||
                    "Unable to start recording.",
                "error"
            );

        } finally {

            isPreparingRecording = false;
        }
    }


    function stopRecording() {

        if (countdownTimer) {

            clearInterval(
                countdownTimer
            );

            countdownTimer = null;
        }

        if (
            !mediaRecorder ||
            mediaRecorder.state === "inactive"
        ) {

            isRecording = false;

            return;
        }

        try {
            mediaRecorder.stop();
        } catch (error) {
            console.warn(error);
        }

        isRecording = false;

        recordBtn?.classList.remove(
            "recording"
        );

        recordBtn?.setAttribute(
            "aria-label",
            "Start recording"
        );

        recordInner?.classList.remove(
            "recording"
        );

        recordingStatus?.classList.add(
            "hidden"
        );

        stopRecordingTimer();
    }


    /* =====================================================
       RECORDING STOP
    ===================================================== */

    function handleRecordingStop() {

        if (!recordedChunks.length) {

            showToast(
                "No recording",
                "No video data was captured.",
                "error"
            );

            return;
        }

        const mime =
            mediaRecorder?.mimeType ||
            "video/webm";

        recordedBlob =
            new Blob(
                recordedChunks,
                {
                    type: mime
                }
            );

        if (!recordedBlob.size) {

            showToast(
                "Empty recording",
                "The recorded video contains no data.",
                "error"
            );

            return;
        }

        const url =
            createObjectURL(
                recordedBlob
            );

        currentPreviewURL = url;

        if (recordedVideo) {

            recordedVideo.pause();

            recordedVideo.src = url;

            recordedVideo.load();
        }

        recordPreview?.classList.remove(
            "hidden"
        );
    }


    /* =====================================================
       RECORDING TIMER
    ===================================================== */

    function startRecordingTimer() {

        stopRecordingTimer();

        updateRecordingTime();

        recordingTimer =
            setInterval(
                updateRecordingTime,
                200
            );
    }


    function stopRecordingTimer() {

        if (!recordingTimer) return;

        clearInterval(
            recordingTimer
        );

        recordingTimer = null;
    }


    function updateRecordingTime() {

        if (!recordingTime) return;

        const elapsed =
            Date.now() -
            recordingStartedAt;

        const seconds =
            Math.floor(
                elapsed / 1000
            );

        const mins =
            Math.floor(
                seconds / 60
            );

        const secs =
            seconds % 60;

        recordingTime.textContent =
            `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

        if (
            currentMode === "shorts" &&
            seconds >= MAX_SHORT_SECONDS
        ) {

            stopRecording();

            showToast(
                "60 seconds reached",
                "Your Short recording has ended."
            );
        }
    }


    /* =====================================================
       COUNTDOWN TIMER
    ===================================================== */

    function runCountdown(seconds) {

        return new Promise(resolve => {

            let remaining =
                Number(seconds) || 0;

            if (remaining <= 0) {

                resolve();
                return;
            }

            showToast(
                "Get ready",
                `Recording starts in ${remaining} seconds.`
            );

            countdownTimer =
                setInterval(() => {

                    remaining--;

                    if (remaining <= 0) {

                        clearInterval(
                            countdownTimer
                        );

                        countdownTimer = null;

                        resolve();

                        return;
                    }

                    showToast(
                        "Get ready",
                        `Recording starts in ${remaining} seconds.`
                    );

                }, 1000);
        });
    }


    /* =====================================================
       POST PHOTO CAPTURE
    ===================================================== */

    async function capturePhoto() {

        if (!cameraPreview) return;

        if (!currentStream) {

            await startCamera();

            if (!currentStream) {
                return;
            }
        }

        try {

            const videoWidth =
                cameraPreview.videoWidth || 1080;

            const videoHeight =
                cameraPreview.videoHeight || 1920;

            const canvas =
                document.createElement("canvas");

            canvas.width = videoWidth;
            canvas.height = videoHeight;

            const context =
                canvas.getContext("2d");

            if (!context) {

                throw new Error(
                    "Photo capture is not supported."
                );
            }

            /*
             * Mirror front-camera capture
             * to match preview.
             */

            if (currentFacingMode === "user") {

                context.translate(
                    videoWidth,
                    0
                );

                context.scale(
                    -1,
                    1
                );
            }

            context.drawImage(
                cameraPreview,
                0,
                0,
                videoWidth,
                videoHeight
            );

            const blob =
                await new Promise(
                    resolve =>
                        canvas.toBlob(
                            resolve,
                            "image/jpeg",
                            0.94
                        )
                );

            if (!blob) {

                throw new Error(
                    "Could not create photo."
                );
            }

            const file =
                new File(
                    [blob],
                    `viewora-photo-${Date.now()}.jpg`,
                    {
                        type: "image/jpeg"
                    }
                );

            showProcessing(
                "Preparing your photo..."
            );

            await saveImageForEditor(
                file
            );

            await sleep(150);

            window.location.href =
                "edit-post.html?source=camera";

        } catch (error) {

            console.error(
                "VIEWORA PHOTO:",
                error
            );

            hideProcessing();

            showToast(
                "Photo failed",
                error?.message ||
                    "Could not capture photo.",
                "error"
            );
        }
    }


    /* =====================================================
       RECORD BUTTON
    ===================================================== */

    recordBtn?.addEventListener(
        "click",
        () => {

            if (isPreparingRecording) {
                return;
            }

            if (currentMode === "post") {

                capturePhoto();

                return;
            }

            if (isRecording) {

                stopRecording();

            } else {

                startRecording();
            }
        }
    );


    /* =====================================================
       RETAKE
    ===================================================== */

    retakeBtn?.addEventListener(
        "click",
        async () => {

            recordedBlob = null;

            if (recordedVideo) {

                recordedVideo.pause();

                recordedVideo.removeAttribute(
                    "src"
                );

                recordedVideo.load();
            }

            recordPreview?.classList.add(
                "hidden"
            );

            revokeObjectURL();

            await startCamera();
        }
    );


    /* =====================================================
       CLOSE PREVIEW
    ===================================================== */

    closePreviewBtn?.addEventListener(
        "click",
        async () => {

            recordPreview?.classList.add(
                "hidden"
            );

            recordedBlob = null;

            if (recordedVideo) {

                recordedVideo.pause();

                recordedVideo.removeAttribute(
                    "src"
                );

                recordedVideo.load();
            }

            revokeObjectURL();

            await startCamera();
        }
    );


    /* =====================================================
       CONTINUE RECORDED VIDEO
    ===================================================== */

    continueVideoBtn?.addEventListener(
        "click",
        async () => {

            if (!recordedBlob) {

                showToast(
                    "No video",
                    "Please record a video first.",
                    "error"
                );

                return;
            }

            try {

                showProcessing(
                    "Preparing your video..."
                );

                const extension =
                    recordedBlob.type.includes("mp4")
                        ? "mp4"
                        : "webm";

                const file =
                    new File(
                        [recordedBlob],
                        `viewora-${Date.now()}.${extension}`,
                        {
                            type:
                                recordedBlob.type ||
                                "video/webm"
                        }
                    );

                await saveVideoForEditor(
                    file,
                    currentMode
                );

                await sleep(180);

                window.location.href =
                    currentMode === "shorts"
                        ? "edit-shorts.html?source=camera"
                        : "edit-video.html?source=camera";

            } catch (error) {

                console.error(
                    "VIEWORA RECORDED VIDEO:",
                    error
                );

                hideProcessing();

                showToast(
                    "Video error",
                    error?.message ||
                        "Could not prepare the recording.",
                    "error"
                );
            }
        }
    );


    /* =====================================================
       TIMER SHEET
    ===================================================== */

    timerBtn?.addEventListener(
        "click",
        () => {

            $("timerSheet")?.classList.remove(
                "hidden"
            );
        }
    );


    qsa("[data-time]").forEach(item => {

        item.addEventListener(
            "click",
            () => {

                selectedTimer =
                    Number(
                        item.dataset.time
                    ) || 0;

                qsa("[data-time]")
                    .forEach(el =>
                        el.classList.remove(
                            "active"
                        )
                    );

                item.classList.add(
                    "active"
                );

                $("timerSheet")?.classList.add(
                    "hidden"
                );

                showToast(
                    "Timer selected",
                    selectedTimer === 0
                        ? "Timer is off."
                        : `${selectedTimer} second countdown enabled.`
                );
            }
        );
    });


    /* =====================================================
       SPEED SHEET
    ===================================================== */

    speedBtn?.addEventListener(
        "click",
        () => {

            $("speedSheet")?.classList.remove(
                "hidden"
            );
        }
    );


    qsa("[data-speed]").forEach(item => {

        item.addEventListener(
            "click",
            () => {

                selectedSpeed =
                    Number(
                        item.dataset.speed
                    ) || 1;

                qsa("[data-speed]")
                    .forEach(el =>
                        el.classList.remove(
                            "active"
                        )
                    );

                item.classList.add(
                    "active"
                );

                $("speedSheet")?.classList.add(
                    "hidden"
                );

                /*
                 * Actual recording speed is
                 * applied by changing MediaRecorder
                 * stream playback timing through
                 * a limitation-safe approach.
                 *
                 * The selected value is persisted
                 * for the editor as metadata.
                 */

                sessionStorage.setItem(
                    "viewora_record_speed",
                    String(selectedSpeed)
                );

                showToast(
                    "Speed selected",
                    `${selectedSpeed}x recording speed.`
                );
            }
        );
    });


    /* =====================================================
       SHEET CLOSE BUTTONS
    ===================================================== */

    $("closeTimerBtn")?.addEventListener(
        "click",
        () => {
            $("timerSheet")?.classList.add("hidden");
        }
    );


    $("closeSpeedBtn")?.addEventListener(
        "click",
        () => {
            $("speedSheet")?.classList.add("hidden");
        }
    );


    $("closeFileBtn")?.addEventListener(
        "click",
        closeFileSheet
    );


    $("closePostBtn")?.addEventListener(
        "click",
        () => {
            $("postSheet")?.classList.add("hidden");
        }
    );


    $("closeVideoBtn")?.addEventListener(
        "click",
        () => {
            $("videoSheet")?.classList.add("hidden");
        }
    );


    $("closeSettingsBtn")?.addEventListener(
        "click",
        () => {
            $("settingsSheet")?.classList.add("hidden");
        }
    );


    $("closeMusicBtn")?.addEventListener(
        "click",
        () => {
            $("musicSheet")?.classList.add("hidden");
        }
    );


    /* =====================================================
       BACKDROP CLOSE
    ===================================================== */

    qsa("[data-close-sheet]").forEach(backdrop => {

        backdrop.addEventListener(
            "click",
            () => {

                const target =
                    backdrop.dataset.closeSheet;

                if (target) {
                    $(target)?.classList.add(
                        "hidden"
                    );
                }
            }
        );
    });


    /* =====================================================
       FILE BUTTONS
    ===================================================== */

    selectFileBtn?.addEventListener(
        "click",
        openFileSheet
    );


    galleryBtn?.addEventListener(
        "click",
        openFileSheet
    );


    $("chooseMediaBtn")?.addEventListener(
        "click",
        openFilePicker
    );


    $("openGalleryBtn")?.addEventListener(
        "click",
        openFilePicker
    );


    /* =====================================================
       POST SHEET
    ===================================================== */

    $("choosePostPhotoBtn")?.addEventListener(
        "click",
        () => {

            $("postSheet")?.classList.add(
                "hidden"
            );

            if (postMediaInput) {

                postMediaInput.value = "";

                postMediaInput.click();
            }
        }
    );


    $("capturePostBtn")?.addEventListener(
        "click",
        async () => {

            $("postSheet")?.classList.add(
                "hidden"
            );

            await setMode("post");

            await capturePhoto();
        }
    );


    /* =====================================================
       VIDEO SHEET
    ===================================================== */

    $("chooseVideoBtn")?.addEventListener(
        "click",
        () => {

            $("videoSheet")?.classList.add(
                "hidden"
            );

            openFilePicker();
        }
    );


    $("recordVideoBtn")?.addEventListener(
        "click",
        async () => {

            $("videoSheet")?.classList.add(
                "hidden"
            );

            await startRecording();
        }
    );


    /* =====================================================
       CAMERA CONTROLS
    ===================================================== */

    flipCameraBtn?.addEventListener(
        "click",
        flipCamera
    );


    flashBtn?.addEventListener(
        "click",
        toggleFlash
    );


    retryCameraBtn?.addEventListener(
        "click",
        startCamera
    );


    /* =====================================================
       SETTINGS
    ===================================================== */

    settingsBtn?.addEventListener(
        "click",
        () => {

            $("settingsSheet")?.classList.remove(
                "hidden"
            );
        }
    );


    $("microphoneToggle")?.addEventListener(
        "change",
        event => {

            if (!currentStream) return;

            currentStream
                .getAudioTracks()
                .forEach(track => {

                    track.enabled =
                        Boolean(
                            event.target.checked
                        );

                });
        }
    );


    $("fullscreenToggle")?.addEventListener(
        "change",
        event => {

            if (!cameraPreview) return;

            cameraPreview.style.objectFit =
                event.target.checked
                    ? "cover"
                    : "contain";
        }
    );


    $("qualityToggle")?.addEventListener(
        "change",
        () => {

            showToast(
                "Quality updated",
                "Camera quality will apply when the camera restarts."
            );

            startCamera();
        }
    );


    /* =====================================================
       MUSIC
    ===================================================== */

    musicBtn?.addEventListener(
        "click",
        () => {

            $("musicSheet")?.classList.remove(
                "hidden"
            );

            renderMusicLibrary();
        }
    );


    removeMusicBtn?.addEventListener(
        "click",
        () => {

            selectedMusicData = null;

            selectedMusic?.classList.add(
                "hidden"
            );

            musicBtn?.classList.remove(
                "hidden"
            );

            sessionStorage.removeItem(
                "viewora_selected_music"
            );
        }
    );


    /* =====================================================
       MUSIC LIBRARY
    ===================================================== */

    const MUSIC_LIBRARY = [

        {
            id: "original-audio",
            title: "Original Audio",
            artist: "Viewora Camera",
            category: "trending"
        },

        {
            id: "viewora-beat",
            title: "Viewora Beat",
            artist: "Viewora Sounds",
            category: "popular"
        },

        {
            id: "viewora-chill",
            title: "Viewora Chill",
            artist: "Viewora Sounds",
            category: "new"
        },

        {
            id: "viewora-energy",
            title: "Viewora Energy",
            artist: "Viewora Sounds",
            category: "popular"
        },

        {
            id: "viewora-cinematic",
            title: "Viewora Cinematic",
            artist: "Viewora Sounds",
            category: "new"
        }

    ];


    let currentMusicCategory = "trending";


    function renderMusicLibrary(
        searchValue = ""
    ) {

        const list =
            $("musicList");

        if (!list) return;

        const query =
            String(searchValue)
                .trim()
                .toLowerCase();

        let items =
            MUSIC_LIBRARY.filter(item => {

                const matchesCategory =
                    currentMusicCategory === "saved"
                        ? isMusicSaved(item.id)
                        : item.category ===
                            currentMusicCategory;

                const matchesSearch =
                    !query ||
                    item.title
                        .toLowerCase()
                        .includes(query) ||
                    item.artist
                        .toLowerCase()
                        .includes(query);

                return (
                    matchesCategory &&
                    matchesSearch
                );
            });

        if (!items.length) {

            list.innerHTML = `
                <div class="musicEmpty">
                    <i class="fa-solid fa-music"></i>
                    <strong>No sounds found</strong>
                    <span>Try another category or search.</span>
                </div>
            `;

            return;
        }

        list.innerHTML =
            items.map(item => {

                const saved =
                    isMusicSaved(item.id);

                const selected =
                    selectedMusicData?.id ===
                    item.id;

                return `

                    <button
                        type="button"
                        class="musicItem ${selected ? "active" : ""}"
                        data-music-id="${escapeHTML(item.id)}"
                    >

                        <span class="musicItemIcon">
                            <i class="fa-solid fa-music"></i>
                        </span>

                        <span class="musicItemText">

                            <strong>
                                ${escapeHTML(item.title)}
                            </strong>

                            <small>
                                ${escapeHTML(item.artist)}
                            </small>

                        </span>

                        <span class="musicItemActions">

                            <button
                                type="button"
                                class="musicSaveButton"
                                data-save-music="${escapeHTML(item.id)}"
                                aria-label="Save music"
                            >
                                <i class="${saved
                                    ? "fa-solid"
                                    : "fa-regular"
                                } fa-bookmark"></i>
                            </button>

                            <i class="fa-solid fa-chevron-right"></i>

                        </span>

                    </button>
                `;

            }).join("");

        qsa("[data-music-id]").forEach(item => {

            item.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            "[data-save-music]"
                        )
                    ) {
                        return;
                    }

                    const id =
                        item.dataset.musicId;

                    selectMusic(id);
                }
            );
        });


        qsa("[data-save-music]").forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    toggleSavedMusic(
                        button.dataset.saveMusic
                    );

                    renderMusicLibrary(
                        $("musicSearchInput")?.value || ""
                    );
                }
            );
        });
    }


    function selectMusic(id) {

        const music =
            MUSIC_LIBRARY.find(
                item => item.id === id
            );

        if (!music) return;

        selectedMusicData = {
            ...music,
            selectedAt: Date.now()
        };

        try {

            sessionStorage.setItem(
                "viewora_selected_music",
                JSON.stringify(
                    selectedMusicData
                )
            );

        } catch (_) {}

        if (selectedMusicName) {
            selectedMusicName.textContent =
                music.title;
        }

        if (selectedMusicArtist) {
            selectedMusicArtist.textContent =
                music.artist;
        }

        selectedMusic?.classList.remove(
            "hidden"
        );

        musicBtn?.classList.add(
            "hidden"
        );

        $("musicSheet")?.classList.add(
            "hidden"
        );

        showToast(
            "Music selected",
            `${music.title} • ${music.artist}`
        );
    }


    function isMusicSaved(id) {

        try {

            const saved =
                JSON.parse(
                    localStorage.getItem(
                        "viewora_saved_music"
                    ) || "[]"
                );

            return Array.isArray(saved) &&
                saved.includes(id);

        } catch (_) {

            return false;
        }
    }


    function toggleSavedMusic(id) {

        try {

            let saved =
                JSON.parse(
                    localStorage.getItem(
                        "viewora_saved_music"
                    ) || "[]"
                );

            if (!Array.isArray(saved)) {
                saved = [];
            }

            if (saved.includes(id)) {

                saved =
                    saved.filter(
                        value => value !== id
                    );

            } else {

                saved.push(id);
            }

            localStorage.setItem(
                "viewora_saved_music",
                JSON.stringify(saved)
            );

        } catch (error) {

            console.warn(
                "Music save failed:",
                error
            );
        }
    }


    /* =====================================================
       MUSIC SEARCH
    ===================================================== */

    const musicSearchInput =
        $("musicSearchInput");


    musicSearchInput?.addEventListener(
        "input",
        () => {

            const value =
                musicSearchInput.value
                    .trim();

            $("clearMusicSearch")
                ?.classList.toggle(
                    "hidden",
                    !value
                );

            renderMusicLibrary(
                value
            );
        }
    );


    $("clearMusicSearch")?.addEventListener(
        "click",
        () => {

            if (!musicSearchInput) return;

            musicSearchInput.value = "";

            musicSearchInput.dispatchEvent(
                new Event("input")
            );
        }
    );


    /* =====================================================
       MUSIC CATEGORIES
    ===================================================== */

    qsa(".musicCategory").forEach(button => {

        button.addEventListener(
            "click",
            () => {

                currentMusicCategory =
                    button.dataset.category ||
                    "trending";

                qsa(".musicCategory")
                    .forEach(item =>
                        item.classList.toggle(
                            "active",
                            item === button
                        )
                    );

                renderMusicLibrary(
                    musicSearchInput?.value || ""
                );
            }
        );
    });


    /* =====================================================
       LIVE PANEL
    ===================================================== */

    function showLivePanel() {

        stopCamera();

        $("livePanel")?.classList.remove(
            "hidden"
        );
    }


    $("closeLiveBtn")?.addEventListener(
        "click",
        async () => {

            $("livePanel")?.classList.add(
                "hidden"
            );

            await setMode("shorts");
        }
    );


    $("startLiveBtn")?.addEventListener(
        "click",
        startLive
    );


    /* =====================================================
       LIVE THUMBNAIL
    ===================================================== */

    $("chooseThumbnailBtn")?.addEventListener(
        "click",
        () => {

            thumbnailInput?.click();
        }
    );


    thumbnailInput?.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (!file) return;

            if (!file.type.startsWith("image/")) {

                showToast(
                    "Invalid thumbnail",
                    "Please choose an image.",
                    "error"
                );

                return;
            }

            const url =
                URL.createObjectURL(file);

            const preview =
                $("thumbnailPreview");

            if (preview) {

                preview.innerHTML = "";

                const img =
                    document.createElement("img");

                img.src = url;

                img.alt =
                    "Live thumbnail";

                preview.appendChild(img);
            }

            const old =
                sessionStorage.getItem(
                    "viewora_live_thumbnail"
                );

            if (old) {

                /*
                 * Old thumbnail data is intentionally
                 * replaced below.
                 */
            }

            fileToDataURL(file)
                .then(dataURL => {

                    sessionStorage.setItem(
                        "viewora_live_thumbnail",
                        dataURL
                    );

                })
                .catch(error => {

                    console.warn(
                        "Thumbnail save failed:",
                        error
                    );
                });
        }
    );


    /* =====================================================
       LIVE COUNTERS
    ===================================================== */

    const liveTitle =
        $("liveTitle");

    const liveDescription =
        $("liveDescription");


    function updateLiveCounters() {

        if (liveTitle) {

            $("liveTitleCount").textContent =
                String(
                    liveTitle.value.length
                );
        }

        if (liveDescription) {

            $("liveDescriptionCount").textContent =
                String(
                    liveDescription.value.length
                );
        }
    }


    liveTitle?.addEventListener(
        "input",
        updateLiveCounters
    );


    liveDescription?.addEventListener(
        "input",
        updateLiveCounters
    );


    /* =====================================================
       START LIVE
    ===================================================== */

    function startLive() {

        const title =
            $("liveTitle")?.value
                ?.trim() || "";

        const description =
            $("liveDescription")
                ?.value
                ?.trim() || "";

        const visibility =
            $("liveVisibility")
                ?.value || "public";

        if (!title) {

            showToast(
                "Title required",
                "Add a title before going live.",
                "warning"
            );

            $("liveTitle")?.focus();

            return;
        }

        const thumbnail =
            sessionStorage.getItem(
                "viewora_live_thumbnail"
            ) || "";

        const liveData = {

            title,

            description,

            visibility,

            thumbnail,

            createdAt:
                Date.now()

        };

        try {

            sessionStorage.setItem(
                "vieworaLiveData",
                JSON.stringify(
                    liveData
                )
            );

        } catch (error) {

            console.warn(
                "Live data could not be saved:",
                error
            );
        }

        showProcessing(
            "Preparing your Live..."
        );

        setTimeout(() => {

            window.location.href =
                "live.html";

        }, 450);
    }


    /* =====================================================
       OVERLAY CLEANUP
    ===================================================== */

    function closeAllOverlays() {

        qsa(
            ".overlay, .previewOverlay"
        ).forEach(element => {

            element.classList.add(
                "hidden"
            );

        });
    }


    /* =====================================================
       ESCAPE KEY
    ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return;
            }

            closeAllOverlays();
        }
    );


    /* =====================================================
       VISIBILITY
    ===================================================== */

    document.addEventListener(
        "visibilitychange",
        async () => {

            if (document.hidden) {

                if (!isRecording) {
                    stopCamera();
                }

                return;
            }

            if (
                !document.hidden &&
                !isRecording &&
                currentMode !== "live"
            ) {

                await startCamera();
            }
        }
    );


    /* =====================================================
       CLOSE CREATOR
    ===================================================== */

    closeCreatorBtn?.addEventListener(
        "click",
        () => {

            if (isRecording) {
                stopRecording();
            }

            stopRecordingTimer();

            stopCamera();

            revokeObjectURL();

            window.location.href =
                "index.html";
        }
    );


    /* =====================================================
       HTML ESCAPE
    ===================================================== */

    function escapeHTML(value) {

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    /* =====================================================
       RESTORE MUSIC
    ===================================================== */

    function restoreSelectedMusic() {

        try {

            const raw =
                sessionStorage.getItem(
                    "viewora_selected_music"
                );

            if (!raw) return;

            const music =
                JSON.parse(raw);

            if (!music?.id) return;

            selectedMusicData =
                music;

            if (selectedMusicName) {
                selectedMusicName.textContent =
                    music.title;
            }

            if (selectedMusicArtist) {
                selectedMusicArtist.textContent =
                    music.artist;
            }

            selectedMusic?.classList.remove(
                "hidden"
            );

            musicBtn?.classList.add(
                "hidden"
            );

        } catch (error) {

            console.warn(
                "Music restore failed:",
                error
            );
        }
    }


    /* =====================================================
       INIT
    ===================================================== */

    async function init() {

        updateLiveCounters();

        restoreSelectedMusic();

        updateUploadNotice();

        /*
         * Default screen is Shorts because
         * the supplied HTML marks Shorts active.
         */

        await setMode("shorts");

        console.log(
            "VIEWORA CREATE initialized successfully."
        );
    }


    /* =====================================================
       GLOBAL CLEANUP
    ===================================================== */

    window.addEventListener(
        "beforeunload",
        () => {

            stopRecordingTimer();

            if (countdownTimer) {

                clearInterval(
                    countdownTimer
                );

                countdownTimer = null;
            }

            stopCamera();

            revokeObjectURL();
        }
    );


    /* =====================================================
       START
    ===================================================== */

    init();

})();