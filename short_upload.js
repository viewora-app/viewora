/* =========================================================
   VIEWORA • SHORT UPLOAD.JS
   Cloudinary + Firebase Realtime Database
========================================================= */

(() => {

    "use strict";

    /* =====================================================
       CLOUDINARY
    ====================================================== */

    const CLOUDINARY_CLOUD_NAME = "z5m6wjdf";
    const CLOUDINARY_UPLOAD_PRESET = "Viewora-upload";

    const CLOUDINARY_UPLOAD_URL =
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;


    /* =====================================================
       FIREBASE
    ====================================================== */

    const db =
        typeof firebase !== "undefined" &&
        firebase.apps &&
        firebase.apps.length
            ? firebase.database()
            : null;

    const auth =
        typeof firebase !== "undefined" &&
        firebase.apps &&
        firebase.apps.length
            ? firebase.auth()
            : null;


    /* =====================================================
       STATE
    ====================================================== */

    let currentUser = null;
    let selectedVideo = null;
    let selectedThumbnail = null;
    let uploading = false;


    /* =====================================================
       DOM
    ====================================================== */

    const videoInput =
        document.getElementById("videoInput");

    const videoDropZone =
        document.getElementById("videoDropZone");

    const videoPlaceholder =
        document.getElementById("videoPlaceholder");

    const videoPreview =
        document.getElementById("videoPreview");

    const previewVideo =
        document.getElementById("previewVideo");

    const removeVideoBtn =
        document.getElementById("removeVideoBtn");

    const videoInfo =
        document.getElementById("videoInfo");

    const videoName =
        document.getElementById("videoName");

    const videoSize =
        document.getElementById("videoSize");


    const thumbnailInput =
        document.getElementById("thumbnailInput");

    const thumbnailDropZone =
        document.getElementById("thumbnailDropZone");

    const thumbnailPlaceholder =
        document.getElementById("thumbnailPlaceholder");

    const thumbnailPreview =
        document.getElementById("thumbnailPreview");

    const previewThumbnail =
        document.getElementById("previewThumbnail");

    const removeThumbnailBtn =
        document.getElementById("removeThumbnailBtn");


    const captionInput =
        document.getElementById("captionInput");

    const musicInput =
        document.getElementById("musicInput");

    const publishBtn =
        document.getElementById("publishBtn");


    const uploadProgress =
        document.getElementById("uploadProgress");

    const progressTitle =
        document.getElementById("progressTitle");

    const progressStatus =
        document.getElementById("progressStatus");

    const progressPercent =
        document.getElementById("progressPercent");

    const progressBar =
        document.getElementById("progressBar");


    const toast =
        document.getElementById("toast");

    const toastText =
        document.getElementById("toastText");

    const toastIcon =
        document.getElementById("toastIcon");


    /* =====================================================
       TOAST
    ====================================================== */

    function showToast(message, success = true) {

        if (!toast || !toastText) return;

        toastText.textContent = message;

        if (toastIcon) {

            toastIcon.className = success
                ? "fa-solid fa-circle-check"
                : "fa-solid fa-circle-exclamation";

        }

        toast.classList.remove("hidden");
        toast.classList.add("show");

        clearTimeout(window.vieworaUploadToast);

        window.vieworaUploadToast =
            setTimeout(() => {

                toast.classList.remove("show");

                setTimeout(() => {
                    toast.classList.add("hidden");
                }, 300);

            }, 2500);
    }


    /* =====================================================
       FORMAT SIZE
    ====================================================== */

    function formatFileSize(bytes) {

        if (!bytes) return "0 MB";

        const mb =
            bytes / (1024 * 1024);

        if (mb < 1) {

            return (
                Math.round(bytes / 1024) +
                " KB"
            );

        }

        return mb.toFixed(2) + " MB";
    }


    /* =====================================================
       VIDEO SELECT
    ====================================================== */

    function openVideoPicker() {

        if (!videoInput) return;

        videoInput.click();

    }


    if (videoDropZone) {

        videoDropZone.addEventListener(
            "click",
            event => {

                if (
                    event.target.closest(
                        "#removeVideoBtn"
                    )
                ) {
                    return;
                }

                openVideoPicker();

            }
        );

    }


    if (videoInput) {

        videoInput.addEventListener(
            "change",
            event => {

                const file =
                    event.target.files?.[0];

                if (!file) return;

                handleVideo(file);

            }
        );

    }


    function handleVideo(file) {

        if (!file.type.startsWith("video/")) {

            showToast(
                "Please select a video file.",
                false
            );

            return;

        }


        selectedVideo = file;


        /* Preview */

        const videoURL =
            URL.createObjectURL(file);

        if (previewVideo) {

            previewVideo.src = videoURL;

            previewVideo.load();

        }


        /* UI */

        videoPlaceholder?.classList.add(
            "hidden"
        );

        videoPreview?.classList.remove(
            "hidden"
        );

        videoInfo?.classList.remove(
            "hidden"
        );


        if (videoName) {

            videoName.textContent =
                file.name;

        }


        if (videoSize) {

            videoSize.textContent =
                formatFileSize(file.size);

        }


        showToast("Video selected ✓");

    }


    /* =====================================================
       REMOVE VIDEO
    ====================================================== */

    if (removeVideoBtn) {

        removeVideoBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                selectedVideo = null;

                if (previewVideo) {

                    previewVideo.pause();
                    previewVideo.removeAttribute(
                        "src"
                    );
                    previewVideo.load();

                }

                if (videoInput) {
                    videoInput.value = "";
                }

                videoPreview?.classList.add(
                    "hidden"
                );

                videoPlaceholder?.classList.remove(
                    "hidden"
                );

                videoInfo?.classList.add(
                    "hidden"
                );

            }
        );

    }


    /* =====================================================
       THUMBNAIL SELECT
    ====================================================== */

    function openThumbnailPicker() {

        thumbnailInput?.click();

    }


    if (thumbnailDropZone) {

        thumbnailDropZone.addEventListener(
            "click",
            event => {

                if (
                    event.target.closest(
                        "#removeThumbnailBtn"
                    )
                ) {
                    return;
                }

                openThumbnailPicker();

            }
        );

    }


    if (thumbnailInput) {

        thumbnailInput.addEventListener(
            "change",
            event => {

                const file =
                    event.target.files?.[0];

                if (!file) return;

                if (!file.type.startsWith("image/")) {

                    showToast(
                        "Please select an image.",
                        false
                    );

                    return;

                }

                selectedThumbnail = file;

                const imageURL =
                    URL.createObjectURL(file);

                if (previewThumbnail) {

                    previewThumbnail.src =
                        imageURL;

                }

                thumbnailPlaceholder?.classList.add(
                    "hidden"
                );

                thumbnailPreview?.classList.remove(
                    "hidden"
                );

                showToast(
                    "Thumbnail selected ✓"
                );

            }
        );

    }


    /* =====================================================
       REMOVE THUMBNAIL
    ====================================================== */

    if (removeThumbnailBtn) {

        removeThumbnailBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                selectedThumbnail = null;

                if (thumbnailInput) {
                    thumbnailInput.value = "";
                }

                if (previewThumbnail) {
                    previewThumbnail.src = "";
                }

                thumbnailPreview?.classList.add(
                    "hidden"
                );

                thumbnailPlaceholder?.classList.remove(
                    "hidden"
                );

            }
        );

    }


    /* =====================================================
       DRAG & DROP VIDEO
    ====================================================== */

    if (videoDropZone) {

        [
            "dragenter",
            "dragover"
        ].forEach(type => {

            videoDropZone.addEventListener(
                type,
                event => {

                    event.preventDefault();

                    videoDropZone.classList.add(
                        "dragging"
                    );

                }
            );

        });


        [
            "dragleave",
            "drop"
        ].forEach(type => {

            videoDropZone.addEventListener(
                type,
                event => {

                    event.preventDefault();

                    videoDropZone.classList.remove(
                        "dragging"
                    );

                }
            );

        });


        videoDropZone.addEventListener(
            "drop",
            event => {

                const file =
                    event.dataTransfer.files?.[0];

                if (!file) return;

                if (
                    file.type.startsWith(
                        "video/"
                    )
                ) {

                    handleVideo(file);

                } else {

                    showToast(
                        "Drop a video file.",
                        false
                    );

                }

            }
        );

    }


    /* =====================================================
       GET VISIBILITY
    ====================================================== */

    function getVisibility() {

        const selected =
            document.querySelector(
                'input[name="visibility"]:checked'
            );

        return selected
            ? selected.value
            : "public";
    }


    /* =====================================================
       CLOUDINARY UPLOAD
    ====================================================== */

    function uploadToCloudinary(
        file,
        type = "video"
    ) {

        return new Promise(
            (resolve, reject) => {

                if (!file) {

                    reject(
                        new Error(
                            "No file selected."
                        )
                    );

                    return;

                }


                const xhr =
                    new XMLHttpRequest();


                xhr.open(
                    "POST",
                    CLOUDINARY_UPLOAD_URL,
                    true
                );


                xhr.upload.onprogress =
                    event => {

                        if (!event.lengthComputable) {
                            return;
                        }

                        const percent =
                            Math.round(
                                (
                                    event.loaded /
                                    event.total
                                ) * 100
                            );

                        updateProgress(
                            percent,
                            type === "video"
                                ? "Uploading video"
                                : "Uploading thumbnail"
                        );

                    };


                xhr.onload = () => {

                    if (
                        xhr.status >= 200 &&
                        xhr.status < 300
                    ) {

                        try {

                            const data =
                                JSON.parse(
                                    xhr.responseText
                                );

                            resolve(data);

                        } catch (error) {

                            reject(
                                new Error(
                                    "Invalid Cloudinary response."
                                )
                            );

                        }

                    } else {

                        let message =
                            "Cloudinary upload failed.";

                        try {

                            const data =
                                JSON.parse(
                                    xhr.responseText
                                );

                            message =
                                data?.error?.message ||
                                message;

                        } catch (_) {}

                        reject(
                            new Error(message)
                        );

                    }

                };


                xhr.onerror = () => {

                    reject(
                        new Error(
                            "Network error during upload."
                        )
                    );

                };


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


                xhr.send(formData);

            }
        );

    }


    /* =====================================================
       PROGRESS
    ====================================================== */

    function updateProgress(
        percent,
        status
    ) {

        uploadProgress?.classList.remove(
            "hidden"
        );


        if (progressPercent) {

            progressPercent.textContent =
                `${percent}%`;

        }


        if (progressBar) {

            progressBar.style.width =
                `${percent}%`;

        }


        if (progressStatus) {

            progressStatus.textContent =
                status;

        }

    }


    /* =====================================================
       PUBLISH
    ====================================================== */

    if (publishBtn) {

        publishBtn.addEventListener(
            "click",
            publishShort
        );

    }


    async function publishShort() {

        if (uploading) return;


        /* Login */

        if (!currentUser) {

            showToast(
                "Please login first.",
                false
            );

            return;

        }


        /* Video Required */

        if (!selectedVideo) {

            showToast(
                "Please choose a video first.",
                false
            );

            videoDropZone?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            return;

        }


        /* Video Size */

        const maxSize =
            200 * 1024 * 1024;

        if (selectedVideo.size > maxSize) {

            showToast(
                "Video must be smaller than 200 MB.",
                false
            );

            return;

        }


        uploading = true;

        publishBtn.disabled = true;

        publishBtn.classList.add(
            "uploading"
        );


        try {

            updateProgress(
                0,
                "Preparing video..."
            );


            /* =========================================
               VIDEO → CLOUDINARY
            ========================================== */

            const videoData =
                await uploadToCloudinary(
                    selectedVideo,
                    "video"
                );


            if (!videoData.secure_url) {

                throw new Error(
                    "Video URL was not returned."
                );

            }


            updateProgress(
                100,
                "Video uploaded ✓"
            );


            /* =========================================
               THUMBNAIL → CLOUDINARY
            ========================================== */

            let thumbnailURL = "";


            if (selectedThumbnail) {

                updateProgress(
                    0,
                    "Uploading thumbnail..."
                );


                const thumbnailData =
                    await uploadToCloudinary(
                        selectedThumbnail,
                        "thumbnail"
                    );


                thumbnailURL =
                    thumbnailData.secure_url ||
                    "";

            }


            /* =========================================
               USER DATA
            ========================================== */

            const username =
                currentUser.displayName ||
                currentUser.email?.split("@")[0] ||
                "Viewora User";


            const profile =
                currentUser.photoURL ||
                "assets/default-avatar.png";


            /* =========================================
               SHORT DATA
            ========================================== */

            const shortData = {

                uid:
                    currentUser.uid,

                username:
                    username,

                profile:
                    profile,

                videoURL:
                    videoData.secure_url,

                videoPublicId:
                    videoData.public_id ||
                    "",

                thumbnail:
                    thumbnailURL,

                caption:
                    captionInput?.value.trim() ||
                    "",

                music:
                    musicInput?.value.trim() ||
                    "Original Audio",

                visibility:
                    getVisibility(),

                createdAt:
                    firebase.database.ServerValue.TIMESTAMP,

                likes:
                    0,

                comments:
                    0,

                views:
                    0,

                saves:
                    0,

                verified:
                    false

            };


            /* =========================================
               FIREBASE
            ========================================== */

            updateProgress(
                100,
                "Publishing Short..."
            );


            const newShortRef =
                db.ref("shorts").push();


            await newShortRef.set(
                shortData
            );


            /* =========================================
               SUCCESS
            ========================================== */

            updateProgress(
                100,
                "Published successfully ✓"
            );


            showToast(
                "🎉 Your Short is live!"
            );


            setTimeout(() => {

                location.href =
                    "shorts.html";

            }, 1200);


        } catch (error) {

            console.error(
                "Viewora Short Upload Error:",
                error
            );


            showToast(
                error.message ||
                "Upload failed. Please try again.",
                false
            );


            if (progressStatus) {

                progressStatus.textContent =
                    "Upload failed";

            }

        } finally {

            uploading = false;

            publishBtn.disabled = false;

            publishBtn.classList.remove(
                "uploading"
            );

        }

    }


    /* =====================================================
       AUTH
    ====================================================== */

    function initializeAuth() {

        if (!auth) {

            showToast(
                "Firebase is not configured.",
                false
            );

            return;

        }


        auth.onAuthStateChanged(
            user => {

                currentUser = user;

                if (!user) {

                    showToast(
                        "Please login first.",
                        false
                    );

                }

            }
        );

    }


    /* =====================================================
       START
    ====================================================== */

    initializeAuth();


    console.log(
        "✅ Viewora Short Upload JS Loaded"
    );

})();