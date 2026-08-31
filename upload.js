"use strict";

/* =========================================================
   VIEWORA CREATE / UPLOAD ENGINE
   upload.js
   FIXED:
   - Selected media persists across page navigation
   - edit-post.html receives image correctly
   - Shorts / Long Video receive media
   - Camera recording support
   - File validation
   - Session storage bridge
   - Clean initialization
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
        [...document.querySelectorAll(selector)];


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

    const recordingStatus = $("recordingStatus");
    const recordingTime = $("recordingTime");

    const selectFileBtn = $("selectFileBtn");
    const galleryBtn = $("galleryBtn");

    const mediaInput = $("mediaInput");

    const musicBtn = $("musicBtn");
    const selectedMusic = $("selectedMusic");
    const removeMusicBtn = $("removeMusicBtn");

    const modeTitle = $("modeTitle");
    const modeDescription = $("modeDescription");
    const modeIcon = $("modeIcon");

    const recordLabel = $("recordLabel");
    const recordSubLabel = $("recordSubLabel");

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

    let selectedTimer = 0;

    let selectedSpeed = 1;

    let isRecording = false;

    let selectedMusicData = null;

    let selectedFile = null;

    let flashEnabled = false;

    let currentObjectURL = null;


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
            toastTitle.textContent = title;
        }

        if (toastText) {
            toastText.textContent = message;
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

            }, 3000);
    }


    /* =====================================================
       CAMERA
    ===================================================== */

    async function startCamera() {

        if (!cameraPreview) return;

        stopCamera();

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

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


            currentStream =
                await navigator.mediaDevices.getUserMedia(
                    constraints
                );


            cameraPreview.srcObject =
                currentStream;


            cameraPreview.muted = true;

            cameraPreview.playsInline = true;

            await cameraPreview.play();


            if (cameraFallback) {
                cameraFallback.classList.add("hidden");
            }


            updateFlashAvailability();

        } catch (error) {

            console.error(
                "VIEWORA CAMERA:",
                error
            );

            let message =
                "Camera could not be started. Please try again.";

            if (error.name === "NotAllowedError") {

                message =
                    "Camera permission is blocked. Allow camera access in browser settings.";

            } else if (error.name === "NotFoundError") {

                message =
                    "No camera was found on this device.";

            } else if (error.name === "NotReadableError") {

                message =
                    "Camera is currently being used by another app.";

            }

            showCameraError(message);

            showToast(
                "Camera unavailable",
                message,
                "error"
            );
        }
    }


    function showCameraError(message) {

        if (cameraFallback) {
            cameraFallback.classList.remove("hidden");
        }

        if (cameraErrorText) {
            cameraErrorText.textContent = message;
        }
    }


    function stopCamera() {

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
    }


    /* =====================================================
       CAMERA FLIP
    ===================================================== */

    async function flipCamera() {

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

        if (!flashBtn || !currentStream) return;

        const track =
            currentStream.getVideoTracks()[0];

        if (!track) return;

        const capabilities =
            track.getCapabilities
                ? track.getCapabilities()
                : {};

        const supported =
            !!capabilities.torch;

        flashBtn.disabled = !supported;

        flashBtn.style.opacity =
            supported ? "1" : ".45";
    }


    async function toggleFlash() {

        if (!currentStream) return;

        const track =
            currentStream.getVideoTracks()[0];

        if (!track) return;

        try {

            const capabilities =
                track.getCapabilities
                    ? track.getCapabilities()
                    : {};

            if (!capabilities.torch) {

                showToast(
                    "Flash unavailable",
                    "This camera does not support flash.",
                    "warning"
                );

                return;
            }

            flashEnabled =
                !flashEnabled;

            await track.applyConstraints({

                advanced: [
                    {
                        torch: flashEnabled
                    }
                ]

            });

            flashBtn.classList.toggle(
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
                "Unable to control flash.",
                "error"
            );
        }
    }


    /* =====================================================
       MODE
    ===================================================== */

    function setMode(mode) {

        if (!MODES[mode]) return;

        currentMode = mode;

        const config =
            MODES[mode];


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

        if (mediaInput) {
            mediaInput.accept =
                config.accept ||
                "image/*,video/*";
        }

        if (previewModeTitle) {
            previewModeTitle.textContent =
                config.title;
        }


        qsa(".modeItem").forEach(item => {

            item.classList.toggle(
                "active",
                item.dataset.mode === mode
            );

        });


        updateUploadNotice();


        if (mode === "live") {

            stopCamera();

            showLivePanel();

        } else {

            startCamera();

        }
    }


    /* =====================================================
       MODE CLICK
    ===================================================== */

    qsa(".modeItem").forEach(item => {

        item.addEventListener(
            "click",
            () => {

                setMode(
                    item.dataset.mode
                );

            }
        );

    });


    /* =====================================================
       SWIPE MODE
    ===================================================== */

    let touchStartX = 0;

    modeSelector?.addEventListener(
        "touchstart",
        event => {

            touchStartX =
                event.changedTouches[0].clientX;

        },
        {
            passive: true
        }
    );


    modeSelector?.addEventListener(
        "touchend",
        event => {

            const endX =
                event.changedTouches[0].clientX;

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

        const sheet =
            $("fileSheet");

        if (!sheet) {

            openFilePicker();

            return;
        }

        updateUploadNotice();

        sheet.classList.remove(
            "hidden"
        );
    }


    function closeFileSheet() {

        $("fileSheet")?.classList.add(
            "hidden"
        );
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
                    "Choose a photo for your post.";

            } else if (currentMode === "shorts") {

                noticeText.textContent =
                    "Choose a vertical video for your Short.";

            } else if (currentMode === "long") {

                noticeText.textContent =
                    "Choose a video for your Long Video.";

            } else {

                noticeText.textContent =
                    "Live setup will open next.";
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

        if (!mediaInput) {

            showToast(
                "Upload unavailable",
                "Media input was not found.",
                "error"
            );

            return;
        }


        if (currentMode === "live") {

            showLivePanel();

            return;
        }


        mediaInput.accept =
            MODES[currentMode].accept;

        mediaInput.value = "";

        mediaInput.click();
    }


    /* =====================================================
       MEDIA INPUT
    ===================================================== */

    mediaInput?.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files?.[0];

            if (!file) return;

            await handleSelectedFile(file);

        }
    );


    /* =====================================================
       FILE VALIDATION
    ===================================================== */

    function validateFile(file) {

        if (!file) {

            return {
                valid: false,
                message: "No file selected."
            };
        }


        if (currentMode === "post") {

            if (!file.type.startsWith("image/")) {

                return {
                    valid: false,
                    message:
                        "Post mode accepts photos only."
                };
            }
        }


        if (
            currentMode === "shorts" ||
            currentMode === "long"
        ) {

            if (!file.type.startsWith("video/")) {

                return {
                    valid: false,
                    message:
                        `${MODES[currentMode].title} accepts videos only.`
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

    async function handleSelectedFile(file) {

        const validation =
            validateFile(file);

        if (!validation.valid) {

            showToast(
                "Invalid media",
                validation.message,
                "error"
            );

            return;
        }


        selectedFile = file;


        /*
         * IMPORTANT:
         *
         * Object URLs do NOT survive navigation.
         *
         * Therefore we convert the selected image
         * into a Data URL and save it in sessionStorage.
         *
         * edit-post.js reads:
         * viewora_edit_post_media
         * viewora_edit_post_type
         */

        showProcessing(
            currentMode === "post"
                ? "Preparing your photo..."
                : "Preparing your video..."
        );


        try {

            if (currentMode === "post") {

                await saveImageForEditor(file);

                closeFileSheet();

                navigateToPostEditor();

                return;
            }


            if (
                currentMode === "shorts" ||
                currentMode === "long"
            ) {

                /*
                 * Videos can be too large for sessionStorage.
                 * Store the file temporarily in IndexedDB.
                 */

                await saveVideoForEditor(file);

                closeFileSheet();

                navigateToVideoEditor();

                return;
            }


        } catch (error) {

            console.error(
                "VIEWORA MEDIA PREP ERROR:",
                error
            );

            hideProcessing();

            showToast(
                "Media error",
                "Could not prepare this file. Please try another file.",
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

                reader.onload = () =>
                    resolve(
                        reader.result
                    );

                reader.onerror = () =>
                    reject(
                        reader.error ||
                        new Error(
                            "File could not be read."
                        )
                    );

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


        /*
         * Clear old media first.
         */

        sessionStorage.removeItem(
            "viewora_edit_post_media"
        );

        sessionStorage.removeItem(
            "viewora_edit_post_type"
        );


        /*
         * Save NEW media.
         */

        sessionStorage.setItem(
            "viewora_edit_post_media",
            dataURL
        );

        sessionStorage.setItem(
            "viewora_edit_post_type",
            "image"
        );


        /*
         * Extra metadata.
         */

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


        /*
         * Verify save.
         */

        const saved =
            sessionStorage.getItem(
                "viewora_edit_post_media"
            );

        if (!saved) {

            throw new Error(
                "Image was not saved to sessionStorage."
            );
        }


        console.log(
            "VIEWORA POST MEDIA SAVED:",
            file.name,
            file.type,
            file.size
        );
    }


    /* =====================================================
       POST EDITOR NAVIGATION
    ===================================================== */

    function navigateToPostEditor() {

        showProcessing(
            "Opening post editor..."
        );


        setTimeout(() => {

            window.location.href =
                "edit-post.html?source=upload";

        }, 250);
    }


    /* =====================================================
       VIDEO INDEXED DB
    ===================================================== */

    const VIDEO_DB_NAME =
        "VIEWORA_MEDIA_DB";

    const VIDEO_STORE =
        "uploads";


    function openVideoDB() {

        return new Promise(
            (resolve, reject) => {

                const request =
                    indexedDB.open(
                        VIDEO_DB_NAME,
                        1
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


    async function saveVideoForEditor(file) {

        const db =
            await openVideoDB();


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        VIDEO_STORE,
                        "readwrite"
                    );

                const store =
                    transaction.objectStore(
                        VIDEO_STORE
                    );


                const key =
                    "currentVideo";


                const request =
                    store.put(
                        file,
                        key
                    );


                request.onsuccess =
                    () => {

                        sessionStorage.setItem(
                            "viewora_video_key",
                            key
                        );

                        sessionStorage.setItem(
                            "vieworaUploadMode",
                            currentMode
                        );

                        sessionStorage.setItem(
                            "vieworaUploadName",
                            file.name
                        );

                        sessionStorage.setItem(
                            "vieworaUploadMime",
                            file.type
                        );

                        resolve();

                    };


                request.onerror =
                    () => reject(
                        request.error
                    );

            }
        );
    }


    /* =====================================================
       VIDEO EDITOR NAVIGATION
    ===================================================== */

    function navigateToVideoEditor() {

        showProcessing(
            "Opening video editor..."
        );


        const editor =
            currentMode === "shorts"
                ? "edit-shorts.html"
                : "edit-video.html";


        setTimeout(() => {

            window.location.href =
                `${editor}?source=upload`;

        }, 250);
    }


    /* =====================================================
       OBJECT URL
    ===================================================== */

    function createObjectURL(file) {

        if (currentObjectURL) {

            try {

                URL.revokeObjectURL(
                    currentObjectURL
                );

            } catch (_) {}
        }


        currentObjectURL =
            URL.createObjectURL(file);


        return currentObjectURL;
    }


    /* =====================================================
       RECORDING
    ===================================================== */

    function getRecorderMimeType() {

        const types = [

            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm",
            "video/mp4"

        ];


        if (!window.MediaRecorder) {
            return "";
        }


        for (const type of types) {

            if (
                MediaRecorder.isTypeSupported &&
                MediaRecorder.isTypeSupported(type)
            ) {

                return type;
            }
        }


        return "";
    }


    async function startRecording() {

        if (currentMode === "live") {

            showLivePanel();

            return;
        }


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


        recordedChunks = [];


        const mimeType =
            getRecorderMimeType();


        try {

            mediaRecorder =
                mimeType
                    ? new MediaRecorder(
                        currentStream,
                        {
                            mimeType
                        }
                    )
                    : new MediaRecorder(
                        currentStream
                    );

        } catch (error) {

            console.error(error);

            showToast(
                "Recorder error",
                "Could not start recording.",
                "error"
            );

            return;
        }


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


        mediaRecorder.onstop =
            handleRecordingStop;


        mediaRecorder.onerror =
            error => {

                console.error(
                    "MediaRecorder:",
                    error
                );

                showToast(
                    "Recording error",
                    "Something went wrong while recording.",
                    "error"
                );
            };


        try {

            mediaRecorder.start(250);

            isRecording = true;

            recordingStartedAt =
                Date.now();


            recordBtn?.classList.add(
                "recording"
            );


            recordingStatus?.classList.remove(
                "hidden"
            );


            startRecordingTimer();

        } catch (error) {

            console.error(error);

            showToast(
                "Recording failed",
                "Unable to start recording.",
                "error"
            );
        }
    }


    function stopRecording() {

        if (
            !mediaRecorder ||
            mediaRecorder.state === "inactive"
        ) {
            return;
        }


        try {

            mediaRecorder.stop();

        } catch (_) {}


        isRecording = false;


        recordBtn?.classList.remove(
            "recording"
        );


        recordingStatus?.classList.add(
            "hidden"
        );


        stopRecordingTimer();
    }


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


        const url =
            createObjectURL(
                recordedBlob
            );


        if (recordedVideo) {

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
                250
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
            seconds >= 60
        ) {

            stopRecording();

            showToast(
                "60 seconds reached",
                "Your Short recording has ended."
            );
        }
    }


    /* =====================================================
       RECORD BUTTON
    ===================================================== */

    recordBtn?.addEventListener(
        "click",
        () => {

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
        () => {

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


            startCamera();

        }
    );


    /* =====================================================
       CLOSE PREVIEW
    ===================================================== */

    closePreviewBtn?.addEventListener(
        "click",
        () => {

            recordPreview?.classList.add(
                "hidden"
            );

            startCamera();

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

                await saveVideoForEditor(
                    new File(
                        [recordedBlob],
                        `viewora-${Date.now()}.webm`,
                        {
                            type:
                                recordedBlob.type ||
                                "video/webm"
                        }
                    )
                );


                showProcessing(
                    "Preparing your video..."
                );


                setTimeout(() => {

                    window.location.href =
                        currentMode === "shorts"
                            ? "edit-shorts.html?source=camera"
                            : "edit-video.html?source=camera";

                }, 250);


            } catch (error) {

                console.error(error);

                showToast(
                    "Video error",
                    "Could not prepare the recording.",
                    "error"
                );
            }
        }
    );


    /* =====================================================
       TIMER
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
                    );


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
                        ? "Timer off"
                        : `${selectedTimer} second timer`
                );

            }
        );

    });


    /* =====================================================
       SPEED
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
                    );


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


                showToast(
                    "Speed selected",
                    `${selectedSpeed}x recording speed`
                );

            }
        );

    });


    /* =====================================================
       SHEET CLOSE
    ===================================================== */

    $("closeTimerBtn")?.addEventListener(
        "click",
        () =>
            $("timerSheet")?.classList.add(
                "hidden"
            )
    );


    $("closeSpeedBtn")?.addEventListener(
        "click",
        () =>
            $("speedSheet")?.classList.add(
                "hidden"
            )
    );


    $("closeFileBtn")?.addEventListener(
        "click",
        closeFileSheet
    );


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


    $("closeSettingsBtn")?.addEventListener(
        "click",
        () => {

            $("settingsSheet")?.classList.add(
                "hidden"
            );

        }
    );


    /* =====================================================
       MICROPHONE
    ===================================================== */

    $("microphoneToggle")?.addEventListener(
        "change",
        event => {

            if (!currentStream) return;

            currentStream
                .getAudioTracks()
                .forEach(
                    track =>
                        track.enabled =
                            event.target.checked
                );

        }
    );


    /* =====================================================
       FULLSCREEN
    ===================================================== */

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


    /* =====================================================
       QUALITY
    ===================================================== */

    $("qualityToggle")?.addEventListener(
        "change",
        () => {

            showToast(
                "Quality updated",
                "Restart camera to apply the new quality."
            );

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

        }
    );


    $("closeMusicBtn")?.addEventListener(
        "click",
        () => {

            $("musicSheet")?.classList.add(
                "hidden"
            );

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

        }
    );


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
                    .trim()
                    .toLowerCase();


            const clearBtn =
                $("clearMusicSearch");


            clearBtn?.classList.toggle(
                "hidden",
                !value
            );


            qsa(".musicItem").forEach(item => {

                const text =
                    item.textContent
                        .toLowerCase();


                item.style.display =
                    !value ||
                    text.includes(value)
                        ? ""
                        : "none";

            });

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
       LIVE
    ===================================================== */

    function showLivePanel() {

        const panel =
            $("livePanel");

        if (!panel) {

            showToast(
                "Live",
                "Live setup is ready."
            );

            return;
        }

        panel.classList.remove(
            "hidden"
        );
    }


    $("closeLiveBtn")?.addEventListener(
        "click",
        () => {

            $("livePanel")?.classList.add(
                "hidden"
            );

            setMode("shorts");

        }
    );


    $("startLiveBtn")?.addEventListener(
        "click",
        startLive
    );


    function startLive() {

        const title =
            $("liveTitle")?.value?.trim() ||
            $("liveTitleInput")?.value?.trim() ||
            "";


        const description =
            $("liveDescription")?.value?.trim() ||
            $("liveDescriptionInput")?.value?.trim() ||
            "";


        if (!title) {

            showToast(
                "Title required",
                "Add a title before going live.",
                "warning"
            );

            return;
        }


        const thumbnail =
            $("liveThumbnailPreview")?.src ||
            "";


        try {

            sessionStorage.setItem(
                "vieworaLiveData",
                JSON.stringify({
                    title,
                    description,
                    thumbnail,
                    createdAt: Date.now()
                })
            );

        } catch (error) {

            console.warn(
                "Live data could not be saved.",
                error
            );
        }


        showProcessing(
            "Preparing your Live..."
        );


        setTimeout(() => {

            window.location.href =
                "live.html";

        }, 500);
    }


    /* =====================================================
       PROCESSING
    ===================================================== */

    function showProcessing(message) {

        if (processingText) {
            processingText.textContent =
                message;
        }

        processingOverlay?.classList.remove(
            "hidden"
        );
    }


    function hideProcessing() {

        processingOverlay?.classList.add(
            "hidden"
        );
    }


    /* =====================================================
       CLOSE CREATOR
    ===================================================== */

    closeCreatorBtn?.addEventListener(
        "click",
        () => {

            stopRecordingTimer();

            if (isRecording) {
                stopRecording();
            }

            stopCamera();

            window.location.href =
                "index.html";

        }
    );


    /* =====================================================
       VISIBILITY
    ===================================================== */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.hidden &&
                !isRecording
            ) {

                stopCamera();

            }


            if (
                !document.hidden &&
                !isRecording &&
                currentMode !== "live"
            ) {

                startCamera();

            }

        }
    );


    /* =====================================================
       CLEANUP
    ===================================================== */

    window.addEventListener(
        "beforeunload",
        () => {

            stopRecordingTimer();

            stopCamera();

            if (currentObjectURL) {

                try {

                    URL.revokeObjectURL(
                        currentObjectURL
                    );

                } catch (_) {}
            }

        }
    );


    /* =====================================================
       INIT
    ===================================================== */

    function init() {

        setMode("post");

        console.log(
            "VIEWORA CREATE initialized successfully."
        );

    }


    init();

})();