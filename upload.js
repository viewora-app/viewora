/* =========================================================
   VIEWORA V12
   upload.js
   FINAL
   Photo Post + Short + Long Video
   Cloudinary Unsigned Upload + Firebase Realtime Database
========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       CONFIG
    ===================================================== */

    const CLOUDINARY_CLOUD_NAME = "z5m6wjdf";
    const CLOUDINARY_UPLOAD_PRESET = "Viewora-upload";

    const CLOUDINARY_UPLOAD_URL =
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

    /*
       VIDEO CLASSIFICATION
       <= 60 seconds = Short
       > 60 seconds  = Long Video
    */
    const SHORT_MAX_DURATION = 60;

    /* =====================================================
       ELEMENT HELPERS
    ===================================================== */

    const $ = (id) => document.getElementById(id);

    const mediaInput = $("mediaInput");
    const browseBtn = $("browseBtn");
    const dropZone = $("dropZone");

    const previewSection = $("previewSection");
    const previewImage = $("previewImage");
    const previewVideo = $("previewVideo");

    const fileName = $("fileName");
    const titleInput = $("title");
    const captionInput = $("caption");
    const hashtagsInput = $("hashtags");
    const mentionsInput = $("mentions");

    const categoryInput = $("category");
    const visibilityInput = $("visibility");
    const audienceInput = $("audience");
    const languageInput = $("language");

    const allowComments = $("allowComments");
    const allowDownload = $("allowDownload");
    const notifyFollowers = $("notifyFollowers");
    const ageRestricted = $("ageRestricted");
    const allowRemix = $("allowRemix");
    const allowShare = $("allowShare");

    const thumbnailInput = $("thumbnailInput");
    const chooseThumbnailBtn = $("chooseThumbnailBtn");
    const removeThumbnailBtn = $("removeThumbnailBtn");
    const thumbnailImage = $("thumbnailImage");

    const locationInput = $("location");
    const scheduleDate = $("scheduleDate");

    const uploadPostBtn = $("uploadPostBtn");
    const saveDraftBtn = $("saveDraftBtn");
    const cancelUploadBtn = $("cancelUploadBtn");

    const progressSection = $("progressSection");
    const progressFill = $("progressFill");
    const progressPercent = $("progressPercent");
    const uploadSpeed = $("uploadSpeed");
    const remainingTime = $("remainingTime");

    const loadingOverlay = $("loadingOverlay");

    const toast = $("toast");
    const toastIcon = $("toastIcon");
    const toastText = $("toastText");

    const successModal = $("successModal");
    const failedModal = $("failedModal");
    const uploadErrorMessage = $("uploadErrorMessage");

    const retryUploadBtn = $("retryUploadBtn");
    const closeFailedBtn = $("closeFailedBtn");

    const uploadAnotherBtn = $("uploadAnotherBtn");
    const viewPostBtn = $("viewPostBtn");

    const titleCounter = $("titleCounter");
    const captionCounter = $("captionCounter");

    /* =====================================================
       STATE
    ===================================================== */

    let selectedFile = null;
    let selectedThumbnail = null;

    let uploadedMedia = null;
    let uploadedThumbnail = null;

    let detectedMediaType = null;
    let detectedDuration = 0;

    let lastUploadData = null;
    let uploadXHR = null;

    /* =====================================================
       BASIC CHECK
    ===================================================== */

    if (!mediaInput) {
        console.error("❌ Viewora Upload: mediaInput not found");
        return;
    }

    console.log("==========================================");
    console.log("🚀 VIEWORA UPLOAD V12");
    console.log("☁️ Cloudinary:", CLOUDINARY_CLOUD_NAME);
    console.log("📦 Preset:", CLOUDINARY_UPLOAD_PRESET);
    console.log("==========================================");

    /* =====================================================
       CLOUDINARY CHECK
    ===================================================== */

    function checkCloudinaryConfig() {

        if (!CLOUDINARY_CLOUD_NAME) {
            throw new Error(
                "Cloudinary Cloud Name is not configured."
            );
        }

        if (!CLOUDINARY_UPLOAD_PRESET) {
            throw new Error(
                "Cloudinary Upload Preset is not configured."
            );
        }

        if (
            CLOUDINARY_CLOUD_NAME.includes("<") ||
            CLOUDINARY_UPLOAD_PRESET.includes("<")
        ) {
            throw new Error(
                "Cloudinary configuration is incomplete."
            );
        }
    }

    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(message, type = "success") {

        if (!toast || !toastText) return;

        toastText.textContent = message;

        if (toastIcon) {

            toastIcon.className =
                type === "error"
                    ? "fa-solid fa-circle-xmark"
                    : "fa-solid fa-circle-check";
        }

        toast.classList.remove("hidden");

        setTimeout(() => {
            toast.classList.add("hidden");
        }, 3500);
    }

    /* =====================================================
       ERROR MODAL
    ===================================================== */

    function showUploadError(message) {

        console.error("❌ Upload Error:", message);

        if (uploadErrorMessage) {
            uploadErrorMessage.textContent = message;
        }

        if (failedModal) {
            failedModal.classList.remove("hidden");
        }

        hideLoading();
    }

    function closeUploadError() {

        if (failedModal) {
            failedModal.classList.add("hidden");
        }
    }

    /* =====================================================
       LOADING
    ===================================================== */

    function showLoading(text = "Uploading...") {

        if (!loadingOverlay) return;

        const heading =
            loadingOverlay.querySelector("h3");

        if (heading) {
            heading.textContent = text;
        }

        loadingOverlay.classList.remove("hidden");
    }

    function hideLoading() {

        if (loadingOverlay) {
            loadingOverlay.classList.add("hidden");
        }
    }

    /* =====================================================
       PROGRESS
    ===================================================== */

    function updateProgress(percent, speed = "0 MB/s", remaining = "Calculating...") {

        percent = Math.max(
            0,
            Math.min(100, Math.round(percent))
        );

        if (progressSection) {
            progressSection.classList.remove("hidden");
        }

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }

        if (progressPercent) {
            progressPercent.textContent = `${percent}%`;
        }

        if (uploadSpeed) {
            uploadSpeed.textContent = speed;
        }

        if (remainingTime) {
            remainingTime.textContent = remaining;
        }
    }

    function resetProgress() {

        if (progressSection) {
            progressSection.classList.add("hidden");
        }

        updateProgress(0);
    }

    /* =====================================================
       FILE SIZE
    ===================================================== */

    function formatBytes(bytes) {

        if (!bytes) return "0 MB";

        const units = [
            "Bytes",
            "KB",
            "MB",
            "GB"
        ];

        const index =
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            );

        return (
            parseFloat(
                (bytes /
                    Math.pow(1024, index))
                    .toFixed(2)
            ) +
            " " +
            units[index]
        );
    }

    /* =====================================================
       TIME
    ===================================================== */

    function formatDuration(seconds) {

        if (!seconds || !isFinite(seconds)) {
            return "00:00";
        }

        seconds = Math.floor(seconds);

        const minutes =
            Math.floor(seconds / 60);

        const secs =
            seconds % 60;

        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(secs).padStart(2, "0")
        );
    }

    /* =====================================================
       MEDIA TYPE
    ===================================================== */

    function detectType(file) {

        if (!file) {
            return "unknown";
        }

        if (file.type.startsWith("image/")) {
            return "photo";
        }

        if (file.type.startsWith("video/")) {
            return "video";
        }

        return "unknown";
    }

    /* =====================================================
       VIDEO DURATION
    ===================================================== */

    function getVideoDuration(file) {

        return new Promise((resolve, reject) => {

            const video =
                document.createElement("video");

            const objectURL =
                URL.createObjectURL(file);

            video.preload = "metadata";

            video.onloadedmetadata = () => {

                const duration =
                    video.duration;

                URL.revokeObjectURL(objectURL);

                resolve(duration);
            };

            video.onerror = () => {

                URL.revokeObjectURL(objectURL);

                reject(
                    new Error(
                        "Unable to read video duration."
                    )
                );
            };

            video.src = objectURL;
        });
    }

    /* =====================================================
       CLASSIFY MEDIA
    ===================================================== */

    async function classifyMedia(file) {

        const type =
            detectType(file);

        if (type === "photo") {

            detectedMediaType =
                "photo_post";

            detectedDuration = 0;

            return;
        }

        if (type === "video") {

            const duration =
                await getVideoDuration(file);

            detectedDuration =
                duration;

            if (duration <= SHORT_MAX_DURATION) {

                detectedMediaType =
                    "short";

            } else {

                detectedMediaType =
                    "video";
            }

            return;
        }

        throw new Error(
            "Unsupported file type. Please select an image or video."
        );
    }

    /* =====================================================
       MEDIA LABEL
    ===================================================== */

    function getMediaLabel() {

        switch (detectedMediaType) {

            case "photo_post":
                return "PHOTO POST";

            case "short":
                return "SHORT";

            case "video":
                return "LONG VIDEO";

            default:
                return "UNKNOWN";
        }
    }

    /* =====================================================
       PREVIEW
    ===================================================== */

    async function previewFile(file) {

        if (!file) return;

        selectedFile = file;

        try {

            await classifyMedia(file);

            const mediaType =
                detectType(file);

            if (previewSection) {
                previewSection.classList.remove("hidden");
            }

            if (previewImage) {
                previewImage.classList.add("hidden");
                previewImage.removeAttribute("src");
            }

            if (previewVideo) {
                previewVideo.classList.add("hidden");
                previewVideo.removeAttribute("src");
                previewVideo.load();
            }

            if (mediaType === "photo") {

                const url =
                    URL.createObjectURL(file);

                if (previewImage) {

                    previewImage.src = url;

                    previewImage.classList.remove(
                        "hidden"
                    );
                }

            } else if (mediaType === "video") {

                const url =
                    URL.createObjectURL(file);

                if (previewVideo) {

                    previewVideo.src = url;

                    previewVideo.classList.remove(
                        "hidden"
                    );
                }
            }

            if (fileName) {
                fileName.textContent =
                    file.name;
            }

            /*
               First matching elements because
               current HTML contains duplicate IDs.
            */

            const sizeElements =
                document.querySelectorAll(
                    "#videoSize"
                );

            sizeElements.forEach(el => {
                el.textContent =
                    formatBytes(file.size);
            });

            const typeElements =
                document.querySelectorAll(
                    "#fileTypeBadge"
                );

            typeElements.forEach(el => {
                el.textContent =
                    getMediaLabel();
            });

            const durationElements =
                document.querySelectorAll(
                    "#videoDuration"
                );

            durationElements.forEach(el => {

                el.textContent =
                    detectedDuration
                        ? formatDuration(
                            detectedDuration
                        )
                        : "--";
            });

            if (
                detectedMediaType ===
                "photo_post"
            ) {

                showToast(
                    "Photo detected — it will be published as a Post."
                );

            } else if (
                detectedMediaType ===
                "short"
            ) {

                showToast(
                    "Short detected — this will be published as a Short."
                );

            } else {

                showToast(
                    "Long video detected — this will be published as a Video."
                );
            }

        } catch (error) {

            console.error(
                "Preview error:",
                error
            );

            selectedFile = null;

            showUploadError(
                error.message ||
                "Unable to process this file."
            );
        }
    }

    /* =====================================================
       FILE INPUT
    ===================================================== */

    browseBtn?.addEventListener(
        "click",
        () => mediaInput.click()
    );

    mediaInput.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files?.[0];

            if (file) {
                await previewFile(file);
            }
        }
    );

    /* =====================================================
       DRAG & DROP
    ===================================================== */

    if (dropZone) {

        [
            "dragenter",
            "dragover"
        ].forEach(eventName => {

            dropZone.addEventListener(
                eventName,
                event => {

                    event.preventDefault();

                    dropZone.classList.add(
                        "dragging"
                    );
                }
            );
        });

        [
            "dragleave",
            "drop"
        ].forEach(eventName => {

            dropZone.addEventListener(
                eventName,
                event => {

                    event.preventDefault();

                    dropZone.classList.remove(
                        "dragging"
                    );
                }
            );
        });

        dropZone.addEventListener(
            "drop",
            async event => {

                const file =
                    event.dataTransfer
                        ?.files?.[0];

                if (file) {
                    await previewFile(file);
                }
            }
        );
    }

    /* =====================================================
       CHANGE FILE
    ===================================================== */

    $("changeFileBtn")?.addEventListener(
        "click",
        () => mediaInput.click()
    );

    /* =====================================================
       REMOVE FILE
    ===================================================== */

    $("removeFileBtn")?.addEventListener(
        "click",
        () => {

            selectedFile = null;
            uploadedMedia = null;
            detectedMediaType = null;
            detectedDuration = 0;

            mediaInput.value = "";

            if (previewSection) {
                previewSection.classList.add(
                    "hidden"
                );
            }

            if (previewImage) {
                previewImage.src = "";
                previewImage.classList.add(
                    "hidden"
                );
            }

            if (previewVideo) {
                previewVideo.pause();
                previewVideo.src = "";
                previewVideo.classList.add(
                    "hidden"
                );
            }

            showToast(
                "File removed."
            );
        }
    );

    /* =====================================================
       THUMBNAIL
    ===================================================== */

    chooseThumbnailBtn?.addEventListener(
        "click",
        () => thumbnailInput?.click()
    );

    thumbnailInput?.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (!file) return;

            if (!file.type.startsWith("image/")) {

                showToast(
                    "Please select an image thumbnail.",
                    "error"
                );

                return;
            }

            selectedThumbnail = file;

            const url =
                URL.createObjectURL(file);

            if (thumbnailImage) {
                thumbnailImage.src = url;
            }

            showToast(
                "Thumbnail selected."
            );
        }
    );

    removeThumbnailBtn?.addEventListener(
        "click",
        () => {

            selectedThumbnail = null;

            if (thumbnailInput) {
                thumbnailInput.value = "";
            }

            if (thumbnailImage) {

                thumbnailImage.src =
                    "assets/default-thumbnail.png";
            }

            showToast(
                "Thumbnail removed."
            );
        }
    );

    /* =====================================================
       COUNTERS
    ===================================================== */

    titleInput?.addEventListener(
        "input",
        () => {

            if (titleCounter) {

                titleCounter.textContent =
                    titleInput.value.length;
            }
        }
    );

    captionInput?.addEventListener(
        "input",
        () => {

            if (captionCounter) {

                captionCounter.textContent =
                    captionInput.value.length;
            }
        }
    );

    /* =====================================================
       HASHTAGS
    ===================================================== */

    hashtagsInput?.addEventListener(
        "input",
        () => {

            const preview =
                $("hashtagPreview");

            if (!preview) return;

            const tags =
                hashtagsInput.value
                    .split(/[\s,]+/)
                    .filter(Boolean)
                    .map(tag =>
                        tag.startsWith("#")
                            ? tag
                            : "#" + tag
                    );

            preview.innerHTML =
                tags
                    .map(tag =>
                        `<span>${escapeHTML(tag)}</span>`
                    )
                    .join("");
        }
    );

    /* =====================================================
       MENTIONS
    ===================================================== */

    mentionsInput?.addEventListener(
        "input",
        () => {

            const preview =
                $("mentionPreview");

            if (!preview) return;

            const mentions =
                mentionsInput.value
                    .split(/[\s,]+/)
                    .filter(Boolean)
                    .map(username =>
                        username.startsWith("@")
                            ? username
                            : "@" + username
                    );

            preview.innerHTML =
                mentions
                    .map(username =>
                        `<span>${escapeHTML(username)}</span>`
                    )
                    .join("");
        }
    );

    /* =====================================================
       HTML ESCAPE
    ===================================================== */

    function escapeHTML(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =====================================================
       CLOUDINARY UPLOAD
    ===================================================== */

    function uploadToCloudinary(file) {

        return new Promise(
            (resolve, reject) => {

                try {

                    checkCloudinaryConfig();

                    const formData =
                        new FormData();

                    formData.append(
                        "file",
                        file
                    );

                    formData.append(
                        "upload_preset",
                        CLOUDINARY_UPLOAD_PRESET
                    );

                    const xhr =
                        new XMLHttpRequest();

                    uploadXHR = xhr;

                    const startedAt =
                        Date.now();

                    xhr.open(
                        "POST",
                        CLOUDINARY_UPLOAD_URL
                    );

                    xhr.upload.onprogress =
                        event => {

                            if (!event.lengthComputable)
                                return;

                            const percent =
                                (
                                    event.loaded /
                                    event.total
                                ) * 100;

                            const elapsed =
                                (
                                    Date.now() -
                                    startedAt
                                ) / 1000;

                            const speed =
                                elapsed > 0
                                    ? event.loaded /
                                      elapsed
                                    : 0;

                            const remainingBytes =
                                event.total -
                                event.loaded;

                            const remaining =
                                speed > 0
                                    ? remainingBytes /
                                      speed
                                    : 0;

                            updateProgress(
                                percent,
                                formatBytes(
                                    speed
                                ) + "/s",
                                remaining > 0
                                    ? Math.ceil(
                                        remaining
                                    ) + " sec"
                                    : "Finishing..."
                            );
                        };

                    xhr.onload = () => {

                        uploadXHR = null;

                        let response = null;

                        try {
                            response =
                                JSON.parse(
                                    xhr.responseText
                                );
                        } catch {
                            response = null;
                        }

                        if (
                            xhr.status >= 200 &&
                            xhr.status < 300 &&
                            response
                        ) {

                            resolve(response);

                        } else {

                            console.error(
                                "Cloudinary response:",
                                response
                            );

                            reject(
                                new Error(
                                    response?.error?.message ||
                                    "Cloudinary upload failed."
                                )
                            );
                        }
                    };

                    xhr.onerror = () => {

                        uploadXHR = null;

                        reject(
                            new Error(
                                "Network error while uploading to Cloudinary."
                            )
                        );
                    };

                    xhr.onabort = () => {

                        uploadXHR = null;

                        reject(
                            new Error(
                                "Upload cancelled."
                            )
                        );
                    };

                    xhr.send(formData);

                } catch (error) {

                    reject(error);
                }
            }
        );
    }

    /* =====================================================
       UPLOAD THUMBNAIL
    ===================================================== */

    async function uploadThumbnailIfNeeded() {

        if (!selectedThumbnail) {
            return null;
        }

        showLoading(
            "Uploading thumbnail..."
        );

        const result =
            await uploadToCloudinary(
                selectedThumbnail
            );

        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    }

    /* =====================================================
       GET CURRENT USER
    ===================================================== */

    async function getUserForPost() {

        if (
            typeof auth === "undefined" ||
            typeof db === "undefined"
        ) {

            throw new Error(
                "Firebase is not loaded. Check firebase.js."
            );
        }

        const user =
            auth.currentUser;

        if (!user) {

            throw new Error(
                "Please login before publishing."
            );
        }

        let profile = {};

        try {

            const snapshot =
                await db
                    .ref("users/" + user.uid)
                    .once("value");

            if (snapshot.exists()) {
                profile = snapshot.val() || {};
            }

        } catch (error) {

            console.warn(
                "Could not read user profile:",
                error
            );
        }

        return {
            uid: user.uid,
            email: user.email || "",
            username:
                profile.username ||
                user.displayName ||
                "user",
            name:
                profile.name ||
                profile.fullName ||
                user.displayName ||
                "Viewora User",
            profilePhoto:
                profile.profilePhoto ||
                user.photoURL ||
                "assets/default-avatar.png"
        };
    }

    /* =====================================================
       CREATE POST DATA
    ===================================================== */

    function createPostData(
        user,
        media,
        thumbnail
    ) {

        const postId =
            db.ref("posts").push().key;

        return {
            id: postId,

            uid: user.uid,

            username: user.username,

            userName: user.name,

            profilePhoto: user.profilePhoto,

            title:
                titleInput?.value.trim() ||
                "Untitled",

            caption:
                captionInput?.value.trim() ||
                "",

            hashtags:
                parseTags(
                    hashtagsInput?.value || "",
                    "#"
                ),

            mentions:
                parseTags(
                    mentionsInput?.value || "",
                    "@"
                ),

            category:
                categoryInput?.value ||
                "general",

            visibility:
                visibilityInput?.value ||
                "public",

            audience:
                audienceInput?.value ||
                "everyone",

            language:
                languageInput?.value ||
                "english",

            mediaType:
                "photo",

            contentType:
                "post",

            mediaUrl:
                media.url,

            secureUrl:
                media.url,

            publicId:
                media.publicId,

            resourceType:
                media.resourceType ||
                "image",

            format:
                media.format ||
                "",

            width:
                media.width ||
                null,

            height:
                media.height ||
                null,

            duration: 0,

            thumbnailUrl:
                thumbnail?.url ||
                media.url,

            thumbnailPublicId:
                thumbnail?.publicId ||
                media.publicId,

            location:
                locationInput?.value.trim() ||
                "",

            scheduledAt:
                scheduleDate?.value ||
                null,

            settings: {
                allowComments:
                    !!allowComments?.checked,

                allowDownload:
                    !!allowDownload?.checked,

                notifyFollowers:
                    !!notifyFollowers?.checked,

                ageRestricted:
                    !!ageRestricted?.checked,

                allowRemix:
                    !!allowRemix?.checked,

                allowShare:
                    !!allowShare?.checked
            },

            likes: 0,

            comments: 0,

            shares: 0,

            views: 0,

            saved: 0,

            createdAt:
                firebase.database
                    .ServerValue
                    .TIMESTAMP
        };
    }

    /* =====================================================
       CREATE SHORT DATA
    ===================================================== */

    function createShortData(
        user,
        media,
        thumbnail
    ) {

        const shortId =
            db.ref("shorts").push().key;

        return {
            id: shortId,

            uid: user.uid,

            username: user.username,

            userName: user.name,

            profilePhoto: user.profilePhoto,

            title:
                titleInput?.value.trim() ||
                "Untitled Short",

            caption:
                captionInput?.value.trim() ||
                "",

            hashtags:
                parseTags(
                    hashtagsInput?.value || "",
                    "#"
                ),

            mentions:
                parseTags(
                    mentionsInput?.value || "",
                    "@"
                ),

            category:
                categoryInput?.value ||
                "shorts",

            visibility:
                visibilityInput?.value ||
                "public",

            audience:
                audienceInput?.value ||
                "everyone",

            language:
                languageInput?.value ||
                "english",

            mediaType:
                "video",

            contentType:
                "short",

            mediaUrl:
                media.url,

            secureUrl:
                media.url,

            publicId:
                media.publicId,

            resourceType:
                "video",

            format:
                media.format ||
                "",

            width:
                media.width ||
                null,

            height:
                media.height ||
                null,

            duration:
                detectedDuration,

            thumbnailUrl:
                thumbnail?.url ||
                media.thumbnail_url ||
                "",

            thumbnailPublicId:
                thumbnail?.publicId ||
                "",

            location:
                locationInput?.value.trim() ||
                "",

            settings: {
                allowComments:
                    !!allowComments?.checked,

                allowDownload:
                    !!allowDownload?.checked,

                notifyFollowers:
                    !!notifyFollowers?.checked,

                ageRestricted:
                    !!ageRestricted?.checked,

                allowRemix:
                    !!allowRemix?.checked,

                allowShare:
                    !!allowShare?.checked
            },

            likes: 0,

            comments: 0,

            shares: 0,

            views: 0,

            createdAt:
                firebase.database
                    .ServerValue
                    .TIMESTAMP
        };
    }

    /* =====================================================
       CREATE LONG VIDEO DATA
    ===================================================== */

    function createVideoData(
        user,
        media,
        thumbnail
    ) {

        const videoId =
            db.ref("videos").push().key;

        return {
            id: videoId,

            uid: user.uid,

            username: user.username,

            userName: user.name,

            profilePhoto: user.profilePhoto,

            title:
                titleInput?.value.trim() ||
                "Untitled Video",

            caption:
                captionInput?.value.trim() ||
                "",

            hashtags:
                parseTags(
                    hashtagsInput?.value || "",
                    "#"
                ),

            mentions:
                parseTags(
                    mentionsInput?.value || "",
                    "@"
                ),

            category:
                categoryInput?.value ||
                "general",

            visibility:
                visibilityInput?.value ||
                "public",

            audience:
                audienceInput?.value ||
                "everyone",

            language:
                languageInput?.value ||
                "english",

            mediaType:
                "video",

            contentType:
                "video",

            mediaUrl:
                media.url,

            secureUrl:
                media.url,

            publicId:
                media.publicId,

            resourceType:
                "video",

            format:
                media.format ||
                "",

            width:
                media.width ||
                null,

            height:
                media.height ||
                null,

            duration:
                detectedDuration,

            thumbnailUrl:
                thumbnail?.url ||
                media.thumbnail_url ||
                "",

            thumbnailPublicId:
                thumbnail?.publicId ||
                "",

            location:
                locationInput?.value.trim() ||
                "",

            scheduledAt:
                scheduleDate?.value ||
                null,

            settings: {
                allowComments:
                    !!allowComments?.checked,

                allowDownload:
                    !!allowDownload?.checked,

                notifyFollowers:
                    !!notifyFollowers?.checked,

                ageRestricted:
                    !!ageRestricted?.checked,

                allowRemix:
                    !!allowRemix?.checked,

                allowShare:
                    !!allowShare?.checked
            },

            likes: 0,

            comments: 0,

            shares: 0,

            views: 0,

            createdAt:
                firebase.database
                    .ServerValue
                    .TIMESTAMP
        };
    }

    /* =====================================================
       TAG PARSER
    ===================================================== */

    function parseTags(value, prefix) {

        return value
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(tag =>
                tag.startsWith(prefix)
                    ? tag.substring(1)
                    : tag
            )
            .filter(Boolean);
    }

    /* =====================================================
       SAVE TO FIREBASE
    ===================================================== */

    async function saveToFirebase(
        user,
        media,
        thumbnail
    ) {

        let data;
        let path;

        /* ================================================
           PHOTO
        ================================================= */

        if (
            detectedMediaType ===
            "photo_post"
        ) {

            data =
                createPostData(
                    user,
                    media,
                    thumbnail
                );

            path =
                "posts/" + data.id;
        }

        /* ================================================
           SHORT
        ================================================= */

        else if (
            detectedMediaType ===
            "short"
        ) {

            data =
                createShortData(
                    user,
                    media,
                    thumbnail
                );

            path =
                "shorts/" + data.id;
        }

        /* ================================================
           LONG VIDEO
        ================================================= */

        else if (
            detectedMediaType ===
            "video"
        ) {

            data =
                createVideoData(
                    user,
                    media,
                    thumbnail
                );

            path =
                "videos/" + data.id;
        }

        else {

            throw new Error(
                "Unable to determine content type."
            );
        }

        await db
            .ref(path)
            .set(data);

        /*
           Also create a universal feed entry.
           This allows home feed to show all content.
        */

        await db
            .ref("feed/" + data.id)
            .set({
                id: data.id,

                contentType:
                    data.contentType,

                uid:
                    data.uid,

                username:
                    data.username,

                title:
                    data.title,

                thumbnailUrl:
                    data.thumbnailUrl ||
                    data.mediaUrl,

                mediaUrl:
                    data.mediaUrl,

                createdAt:
                    data.createdAt
            });

        return {
            id: data.id,
            type: data.contentType,
            data
        };
    }

    /* =====================================================
       UPDATE USER COUNTERS
    ===================================================== */

    async function updateUserCounters(
        user,
        type
    ) {

        const updates = {};

        if (type === "post") {

            updates[
                `users/${user.uid}/posts`
            ] =
                firebase.database.ServerValue
                    .increment(1);
        }

        if (type === "short") {

            updates[
                `users/${user.uid}/shorts`
            ] =
                firebase.database.ServerValue
                    .increment(1);
        }

        if (type === "video") {

            updates[
                `users/${user.uid}/videos`
            ] =
                firebase.database.ServerValue
                    .increment(1);
        }

        if (
            Object.keys(updates).length
        ) {

            await db
                .ref()
                .update(updates);
        }
    }

    /* =====================================================
       MAIN PUBLISH
    ===================================================== */

    async function publishPost() {

        if (!navigator.onLine) {

            throw new Error(
                "No internet connection."
            );
        }

        if (!selectedFile) {

            throw new Error(
                "Please select a photo or video first."
            );
        }

        if (!titleInput?.value.trim()) {

            throw new Error(
                "Please enter a title."
            );
        }

        checkCloudinaryConfig();

        const user =
            await getUserForPost();

        /* ================================================
           MEDIA UPLOAD
        ================================================= */

        showLoading(
            "Uploading media..."
        );

        updateProgress(
            0,
            "Starting...",
            "Calculating..."
        );

        const cloudinaryResult =
            await uploadToCloudinary(
                selectedFile
            );

        uploadedMedia = {

            url:
                cloudinaryResult.secure_url,

            publicId:
                cloudinaryResult.public_id,

            resourceType:
                cloudinaryResult.resource_type,

            format:
                cloudinaryResult.format,

            width:
                cloudinaryResult.width,

            height:
                cloudinaryResult.height,

            duration:
                cloudinaryResult.duration
        };

        updateProgress(
            100,
            "Uploaded",
            "Complete"
        );

        /* ================================================
           THUMBNAIL
        ================================================= */

        let thumbnail = null;

        if (
            detectedMediaType === "video" ||
            detectedMediaType === "short"
        ) {

            if (selectedThumbnail) {

                thumbnail =
                    await uploadThumbnailIfNeeded();
            }
        }

        /* ================================================
           FIREBASE
        ================================================= */

        showLoading(
            "Publishing to Viewora..."
        );

        const result =
            await saveToFirebase(
                user,
                uploadedMedia,
                thumbnail
            );

        await updateUserCounters(
            user,
            result.type
        );

        lastUploadData = result;

        hideLoading();

        /* ================================================
           SUCCESS
        ================================================= */

        if (successModal) {
            successModal.classList.remove(
                "hidden"
            );
        }

        showToast(
            result.type === "post"
                ? "Photo Post published!"
                : result.type === "short"
                    ? "Short published!"
                    : "Long Video published!"
        );

        console.log(
            "✅ Published:",
            result
        );
    }

    /* =====================================================
       PUBLISH BUTTON
    ===================================================== */

    uploadPostBtn?.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            if (
                uploadPostBtn.disabled
            ) {
                return;
            }

            uploadPostBtn.disabled =
                true;

            try {

                await publishPost();

            } catch (error) {

                console.error(
                    error
                );

                if (
                    error.message ===
                    "Upload cancelled."
                ) {

                    showToast(
                        "Upload cancelled.",
                        "error"
                    );

                } else {

                    showUploadError(
                        error.message ||
                        "Upload failed."
                    );
                }

            } finally {

                uploadPostBtn.disabled =
                    false;
            }
        }
    );

    /* =====================================================
       CANCEL UPLOAD
    ===================================================== */

    cancelUploadBtn?.addEventListener(
        "click",
        () => {

            if (uploadXHR) {

                uploadXHR.abort();

                uploadXHR = null;
            }

            hideLoading();

            resetProgress();

            showToast(
                "Upload cancelled.",
                "error"
            );
        }
    );

    /* =====================================================
       RETRY
    ===================================================== */

    retryUploadBtn?.addEventListener(
        "click",
        async () => {

            closeUploadError();

            if (!selectedFile) {

                showToast(
                    "Please select a file again.",
                    "error"
                );

                return;
            }

            uploadPostBtn?.click();
        }
    );

    /* =====================================================
       CLOSE ERROR
    ===================================================== */

    closeFailedBtn?.addEventListener(
        "click",
        closeUploadError
    );

    /* =====================================================
       UPLOAD ANOTHER
    ===================================================== */

    uploadAnotherBtn?.addEventListener(
        "click",
        () => {

            if (successModal) {
                successModal.classList.add(
                    "hidden"
                );
            }

            selectedFile = null;
            selectedThumbnail = null;
            uploadedMedia = null;
            detectedMediaType = null;
            detectedDuration = 0;

            mediaInput.value = "";

            if (thumbnailInput) {
                thumbnailInput.value = "";
            }

            if (previewSection) {
                previewSection.classList.add(
                    "hidden"
                );
            }

            if (previewImage) {
                previewImage.src = "";
                previewImage.classList.add(
                    "hidden"
                );
            }

            if (previewVideo) {
                previewVideo.pause();
                previewVideo.src = "";
                previewVideo.classList.add(
                    "hidden"
                );
            }

            if (titleInput) {
                titleInput.value = "";
            }

            if (captionInput) {
                captionInput.value = "";
            }

            resetProgress();

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    );

    /* =====================================================
       VIEW POST
    ===================================================== */

    viewPostBtn?.addEventListener(
        "click",
        () => {

            if (!lastUploadData) {
                return;
            }

            const type =
                lastUploadData.type;

            const id =
                lastUploadData.id;

            if (type === "post") {

                location.href =
                    `post.html?id=${encodeURIComponent(id)}`;

            } else if (
                type === "short"
            ) {

                location.href =
                    `shorts.html?id=${encodeURIComponent(id)}`;

            } else {

                location.href =
                    `video.html?id=${encodeURIComponent(id)}`;
            }
        }
    );

    /* =====================================================
       SAVE DRAFT
    ===================================================== */

    saveDraftBtn?.addEventListener(
        "click",
        async () => {

            try {

                if (
                    typeof auth === "undefined" ||
                    !auth.currentUser
                ) {

                    throw new Error(
                        "Please login first."
                    );
                }

                const user =
                    auth.currentUser;

                const draftId =
                    db.ref("drafts").push().key;

                const draft = {

                    id: draftId,

                    uid: user.uid,

                    title:
                        titleInput?.value.trim() ||
                        "",

                    caption:
                        captionInput?.value.trim() ||
                        "",

                    hashtags:
                        hashtagsInput?.value.trim() ||
                        "",

                    mentions:
                        mentionsInput?.value.trim() ||
                        "",

                    category:
                        categoryInput?.value ||
                        "general",

                    visibility:
                        visibilityInput?.value ||
                        "public",

                    createdAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP
                };

                await db
                    .ref(
                        `drafts/${user.uid}/${draftId}`
                    )
                    .set(draft);

                showToast(
                    "Draft saved successfully."
                );

            } catch (error) {

                showToast(
                    error.message ||
                    "Unable to save draft.",
                    "error"
                );
            }
        }
    );

    /* =====================================================
       NETWORK
    ===================================================== */

    window.addEventListener(
        "offline",
        () => {

            showToast(
                "Internet connection lost.",
                "error"
            );
        }
    );

    window.addEventListener(
        "online",
        () => {

            showToast(
                "Internet connection restored."
            );
        }
    );

    /* =====================================================
       INITIAL STATE
    ===================================================== */

    resetProgress();

    console.log(
        "✅ Viewora Upload V12 Ready"
    );

});