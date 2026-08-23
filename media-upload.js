"use strict";

/*
============================================================
 VIEWORA MEDIA UPLOAD
 -----------------------------------------------------------
 Cloudinary unsigned upload
 Compatible with Viewora Chat
 Image / Video / Audio / Documents
 Progress / Speed / Cancel
============================================================
*/

(() => {

    if (window.__VIEWORA_MEDIA_UPLOAD_INITIALIZED__) {
        console.warn("Viewora Media Upload already initialized.");
        return;
    }

    window.__VIEWORA_MEDIA_UPLOAD_INITIALIZED__ = true;


    /* ======================================================
       CLOUDINARY
    ====================================================== */

    const CLOUD_NAME = "z5m6wjdf";

    const UPLOAD_PRESET = "Viewora-upload";

    const UPLOAD_URL =
        "https://api.cloudinary.com/v1_1/" +
        CLOUD_NAME +
        "/auto/upload";


    let activeXHR = null;


    /* ======================================================
       SPEED FORMAT
    ====================================================== */

    function formatSpeed(bytes) {

        bytes = Number(bytes) || 0;

        if (bytes <= 0) {
            return "—";
        }

        if (bytes < 1024) {
            return Math.round(bytes) + " B/s";
        }

        if (bytes < 1024 * 1024) {
            return (
                bytes / 1024
            ).toFixed(1) + " KB/s";
        }

        return (
            bytes / 1024 / 1024
        ).toFixed(1) + " MB/s";
    }


    /* ======================================================
       RESOURCE TYPE
    ====================================================== */

    function getResourceType(file) {

        const type =
            String(file?.type || "").toLowerCase();

        if (type.startsWith("image/")) {
            return "image";
        }

        if (type.startsWith("video/")) {
            return "video";
        }

        /*
         * Cloudinary auto upload uses "video"
         * for audio resources.
         */

        if (type.startsWith("audio/")) {
            return "video";
        }

        return "raw";
    }


    /* ======================================================
       UPLOAD
    ====================================================== */

    function upload(file, callbacks = {}) {

        return new Promise((resolve, reject) => {

            if (!file) {
                reject(
                    new Error("No file selected.")
                );
                return;
            }


            if (!(file instanceof File)) {
                reject(
                    new Error("Invalid file.")
                );
                return;
            }


            if (!CLOUD_NAME) {
                reject(
                    new Error(
                        "Cloudinary cloud name is missing."
                    )
                );
                return;
            }


            if (!UPLOAD_PRESET) {
                reject(
                    new Error(
                        "Cloudinary upload preset is missing."
                    )
                );
                return;
            }


            const formData =
                new FormData();


            formData.append(
                "file",
                file
            );


            formData.append(
                "upload_preset",
                UPLOAD_PRESET
            );


            /*
             * Folder is optional.
             * If your preset doesn't allow it,
             * remove this line.
             */

            formData.append(
                "folder",
                "viewora/chat"
            );


            const xhr =
                new XMLHttpRequest();


            activeXHR =
                xhr;


            let startTime =
                Date.now();


            let lastTime =
                startTime;


            let lastLoaded =
                0;


            let finished =
                false;


            /* ==================================================
               PROGRESS
            ================================================== */

            xhr.upload.onprogress =
                event => {

                    if (!event.lengthComputable) {
                        return;
                    }


                    const now =
                        Date.now();


                    const loaded =
                        event.loaded;


                    const total =
                        event.total;


                    const percent =
                        total > 0
                            ? (
                                loaded /
                                total
                            ) * 100
                            : 0;


                    const elapsed =
                        Math.max(
                            (
                                now -
                                lastTime
                            ) / 1000,
                            0.001
                        );


                    const speed =
                        (
                            loaded -
                            lastLoaded
                        ) / elapsed;


                    lastLoaded =
                        loaded;


                    lastTime =
                        now;


                    if (
                        typeof callbacks.onProgress ===
                        "function"
                    ) {

                        callbacks.onProgress(
                            Math.round(percent)
                        );
                    }


                    if (
                        typeof callbacks.onSpeed ===
                        "function"
                    ) {

                        callbacks.onSpeed(
                            formatSpeed(speed)
                        );
                    }

                };


            /* ==================================================
               SUCCESS
            ================================================== */

            xhr.onload =
                () => {

                    if (finished) {
                        return;
                    }


                    if (
                        xhr.status < 200 ||
                        xhr.status >= 300
                    ) {

                        finished =
                            true;

                        let message =
                            "Cloudinary upload failed.";


                        try {

                            const data =
                                JSON.parse(
                                    xhr.responseText ||
                                    "{}"
                                );


                            message =
                                data?.error?.message ||
                                message;

                        } catch (_) {}


                        reject(
                            new Error(message)
                        );

                        return;
                    }


                    let data;


                    try {

                        data =
                            JSON.parse(
                                xhr.responseText
                            );

                    } catch (_) {

                        finished =
                            true;

                        reject(
                            new Error(
                                "Invalid Cloudinary response."
                            )
                        );

                        return;
                    }


                    finished =
                        true;


                    if (
                        typeof callbacks.onProgress ===
                        "function"
                    ) {

                        callbacks.onProgress(
                            100
                        );
                    }


                    if (
                        typeof callbacks.onSpeed ===
                        "function"
                    ) {

                        callbacks.onSpeed(
                            "Complete"
                        );
                    }


                    const result = {

                        url:
                            data.secure_url ||
                            data.url ||
                            "",

                        secure_url:
                            data.secure_url ||
                            data.url ||
                            "",

                        public_id:
                            data.public_id ||
                            "",

                        resource_type:
                            data.resource_type ||
                            getResourceType(file),

                        format:
                            data.format ||
                            "",

                        bytes:
                            data.bytes ||
                            file.size,

                        original_filename:
                            data.original_filename ||
                            file.name,

                        width:
                            data.width ||
                            null,

                        height:
                            data.height ||
                            null,

                        duration:
                            data.duration ||
                            null,

                        raw:
                            data

                    };


                    activeXHR =
                        null;


                    resolve(
                        result
                    );

                };


            /* ==================================================
               ERROR
            ================================================== */

            xhr.onerror =
                () => {

                    if (finished) {
                        return;
                    }


                    finished =
                        true;

                    activeXHR =
                        null;


                    reject(
                        new Error(
                            "Network error. Check your internet connection."
                        )
                    );

                };


            /* ==================================================
               ABORT
            ================================================== */

            xhr.onabort =
                () => {

                    if (finished) {
                        return;
                    }


                    finished =
                        true;

                    activeXHR =
                        null;


                    const error =
                        new Error(
                            "Upload cancelled."
                        );


                    error.code =
                        "UPLOAD_CANCELLED";


                    reject(
                        error
                    );

                };


            /* ==================================================
               TIMEOUT
            ================================================== */

            xhr.timeout =
                10 * 60 * 1000;


            xhr.ontimeout =
                () => {

                    if (finished) {
                        return;
                    }


                    finished =
                        true;

                    activeXHR =
                        null;


                    reject(
                        new Error(
                            "Upload timed out."
                        )
                    );

                };


            /* ==================================================
               START
            ================================================== */

            try {

                xhr.open(
                    "POST",
                    UPLOAD_URL,
                    true
                );


                xhr.send(
                    formData
                );

            } catch (error) {

                finished =
                    true;

                activeXHR =
                    null;


                reject(
                    error
                );
            }

        });

    }


    /* ======================================================
       CANCEL
    ====================================================== */

    function cancel() {

        if (
            activeXHR &&
            activeXHR.readyState !==
            XMLHttpRequest.DONE
        ) {

            try {
                activeXHR.abort();
            } catch (_) {}

            return true;
        }

        return false;
    }


    /* ======================================================
       PUBLIC API
    ====================================================== */

    window.VieworaMediaUpload = {

        upload,

        cancel,

        formatSpeed,

        getResourceType,

        cloudName:
            CLOUD_NAME,

        uploadPreset:
            UPLOAD_PRESET,

        uploadUrl:
            UPLOAD_URL

    };


    console.log(
        "✓ Viewora Media Upload ready."
    );

})();