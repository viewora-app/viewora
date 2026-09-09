/* ==========================================================
   VIEWORA V12
   CLOUDINARY.JS
   Premium Media Upload Core
   ----------------------------------------------------------
   Used by:
   • Posts
   • Shorts
   • Videos
   • Profile Media
   • Stories
   • Chat Media
========================================================== */

"use strict";

(() => {

    /* ======================================================
       PREVENT DOUBLE INITIALIZATION
    ====================================================== */

    if (window.__VIEWORA_CLOUDINARY_INITIALIZED__) {
        console.warn("Viewora Cloudinary already initialized.");
        return;
    }

    window.__VIEWORA_CLOUDINARY_INITIALIZED__ = true;


    /* ======================================================
       CLOUDINARY CONFIG
    ====================================================== */

    const CLOUD_NAME = "z5m6wjdf";

    const UPLOAD_PRESET = "Viewora-upload";

    const UPLOAD_URL =
        "https://api.cloudinary.com/v1_1/" +
        CLOUD_NAME +
        "/auto/upload";


    /* ======================================================
       EXPOSE CONFIG
    ====================================================== */

    window.CLOUDINARY_CLOUD_NAME = CLOUD_NAME;

    window.CLOUDINARY_UPLOAD_PRESET = UPLOAD_PRESET;

    window.CLOUDINARY_UPLOAD_URL = UPLOAD_URL;


    /* ======================================================
       GET CONFIG
    ====================================================== */

    function getCloudinaryConfig() {

        if (!CLOUD_NAME) {
            throw new Error(
                "Cloudinary cloud name is missing."
            );
        }

        if (!UPLOAD_PRESET) {
            throw new Error(
                "Cloudinary upload preset is missing."
            );
        }

        return {
            cloudName: CLOUD_NAME,
            uploadPreset: UPLOAD_PRESET,
            uploadUrl: UPLOAD_URL
        };
    }


    /* ======================================================
       VALIDATE FILE
    ====================================================== */

    function validateFile(file) {

        if (!file) {
            throw new Error("No file selected.");
        }

        if (!(file instanceof File)) {
            throw new Error("Invalid file.");
        }

        if (file.size <= 0) {
            throw new Error("Selected file is empty.");
        }

        return true;
    }


    /* ======================================================
       UPLOAD FILE
    ====================================================== */

    async function uploadToCloudinary(
        file,
        options = {}
    ) {

        validateFile(file);

        const config = getCloudinaryConfig();

        const formData = new FormData();

        formData.append(
            "file",
            file
        );

        formData.append(
            "upload_preset",
            config.uploadPreset
        );


        /* --------------------------------------------------
           Optional folder
        -------------------------------------------------- */

        if (options.folder) {

            formData.append(
                "folder",
                options.folder
            );

        }


        /* --------------------------------------------------
           Optional public ID
        -------------------------------------------------- */

        if (options.publicId) {

            formData.append(
                "public_id",
                options.publicId
            );

        }


        /* --------------------------------------------------
           Upload progress
        -------------------------------------------------- */

        return new Promise((resolve, reject) => {

            const xhr = new XMLHttpRequest();


            xhr.open(
                "POST",
                config.uploadUrl,
                true
            );


            /* =================================================
               PROGRESS
            ================================================= */

            xhr.upload.addEventListener(
                "progress",
                event => {

                    if (
                        event.lengthComputable &&
                        typeof options.onProgress === "function"
                    ) {

                        const percent =
                            Math.round(
                                (event.loaded / event.total) * 100
                            );

                        options.onProgress(percent);

                    }

                }
            );


            /* =================================================
               COMPLETE
            ================================================= */

            xhr.onload = () => {

                let result = null;

                try {

                    result =
                        JSON.parse(
                            xhr.responseText
                        );

                } catch (error) {

                    reject(
                        new Error(
                            "Invalid Cloudinary response."
                        )
                    );

                    return;
                }


                if (
                    xhr.status >= 200 &&
                    xhr.status < 300 &&
                    result &&
                    result.secure_url
                ) {

                    resolve(result);

                    return;
                }


                reject(
                    new Error(
                        result?.error?.message ||
                        "Cloudinary upload failed."
                    )
                );

            };


            /* =================================================
               NETWORK ERROR
            ================================================= */

            xhr.onerror = () => {

                reject(
                    new Error(
                        "Cloudinary network error."
                    )
                );

            };


            /* =================================================
               ABORT
            ================================================= */

            xhr.onabort = () => {

                reject(
                    new Error(
                        "Cloudinary upload cancelled."
                    )
                );

            };


            xhr.send(formData);

        });

    }


    /* ======================================================
       UPLOAD IMAGE
    ====================================================== */

    async function uploadImage(
        file,
        options = {}
    ) {

        validateFile(file);

        if (
            file.type &&
            !file.type.startsWith("image/")
        ) {

            throw new Error(
                "Please select an image file."
            );

        }

        return uploadToCloudinary(
            file,
            {
                ...options,
                resourceType: "image"
            }
        );

    }


    /* ======================================================
       UPLOAD VIDEO
    ====================================================== */

    async function uploadVideo(
        file,
        options = {}
    ) {

        validateFile(file);

        if (
            file.type &&
            !file.type.startsWith("video/")
        ) {

            throw new Error(
                "Please select a video file."
            );

        }

        return uploadToCloudinary(
            file,
            {
                ...options,
                resourceType: "video"
            }
        );

    }


    /* ======================================================
       GET SECURE URL
    ====================================================== */

    function getSecureUrl(result) {

        if (
            !result ||
            typeof result.secure_url !== "string"
        ) {

            return "";

        }

        return result.secure_url;

    }


    /* ======================================================
       GET PUBLIC ID
    ====================================================== */

    function getPublicId(result) {

        if (
            !result ||
            typeof result.public_id !== "string"
        ) {

            return "";

        }

        return result.public_id;

    }


    /* ======================================================
       EXPORT API
    ====================================================== */

    window.VieworaCloudinary = {

        getConfig:
            getCloudinaryConfig,

        validateFile,

        upload:
            uploadToCloudinary,

        uploadImage,

        uploadVideo,

        getSecureUrl,

        getPublicId

    };


    /* ======================================================
       BACKWARD COMPATIBILITY
    ====================================================== */

    window.getCloudinaryConfig =
        getCloudinaryConfig;

    window.uploadToCloudinary =
        uploadToCloudinary;

    window.uploadImageToCloudinary =
        uploadImage;

    window.uploadVideoToCloudinary =
        uploadVideo;


    /* ======================================================
       READY
    ====================================================== */

    console.log(
        "Viewora Cloudinary initialized."
    );

})();