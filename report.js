"use strict";

/*
============================================================
 VIEWORA — REPORT SYSTEM
 Premium Safety & Moderation Report Handler

 Firebase:
 • Existing Firebase initialization
 • Authentication
 • Realtime Database
 • /reports/{reportId}

 IMPORTANT:
 firebase.js should initialize Firebase BEFORE this file.
 This file does NOT initialize Firebase again.
============================================================
*/

(() => {

    /* =====================================================
       PREVENT DOUBLE INITIALIZATION
    ===================================================== */

    if (window.__VIEWORA_REPORT_INITIALIZED__) {
        console.warn("Viewora report.js already initialized.");
        return;
    }

    window.__VIEWORA_REPORT_INITIALIZED__ = true;


    /* =====================================================
       DOM
    ===================================================== */

    const form = document.getElementById("reportForm");

    if (!form) {
        console.warn("Viewora Report: form not found.");
        return;
    }

    const backBtn =
        document.getElementById("backBtn");

    const targetCards =
        document.querySelectorAll(".target-card");

    const targetIdInput =
        document.getElementById("targetId");

    const targetUrlInput =
        document.getElementById("targetUrl");

    const descriptionInput =
        document.getElementById("description");

    const charCount =
        document.getElementById("charCount");

    const submitBtn =
        document.getElementById("submitBtn");

    const formError =
        document.getElementById("formError");

    const successModal =
        document.getElementById("successModal");

    const reportIdText =
        document.getElementById("reportIdText");

    const doneBtn =
        document.getElementById("doneBtn");


    /* =====================================================
       STATE
    ===================================================== */

    let selectedTarget = "post";

    let submitting = false;


    /* =====================================================
       HELPERS
    ===================================================== */

    function showError(message) {

        if (!formError) return;

        formError.textContent = message;
        formError.classList.add("show");

        formError.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }


    function clearError() {

        if (!formError) return;

        formError.textContent = "";
        formError.classList.remove("show");
    }


    function setLoading(state) {

        submitting = state;

        if (!submitBtn) return;

        submitBtn.disabled = state;
        submitBtn.classList.toggle("loading", state);
    }


    function getFirebaseAuth() {

        /*
         * Supports common Firebase Compat setup:
         *
         * firebase.auth()
         */

        try {

            if (
                window.firebase &&
                typeof window.firebase.auth === "function"
            ) {
                return window.firebase.auth();
            }

        } catch (error) {
            console.warn(
                "Viewora Report: Firebase Auth unavailable.",
                error
            );
        }

        return null;
    }


    function getFirebaseDatabase() {

        /*
         * Supports common Firebase Compat setup:
         *
         * firebase.database()
         *
         * Also supports a globally exposed:
         *
         * window.db
         */

        try {

            if (
                window.firebase &&
                typeof window.firebase.database === "function"
            ) {
                return window.firebase.database();
            }

            if (window.db) {
                return window.db;
            }

        } catch (error) {

            console.warn(
                "Viewora Report: Firebase Database unavailable.",
                error
            );

        }

        return null;
    }


    function getCurrentUser() {

        const auth = getFirebaseAuth();

        if (!auth) {
            return null;
        }

        return auth.currentUser || null;
    }


    function createReportId() {

        const timestamp =
            Date.now().toString(36).toUpperCase();

        const random =
            Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();

        return `RPT-${timestamp}-${random}`;
    }


    function sanitizeText(value, maxLength) {

        if (typeof value !== "string") {
            return "";
        }

        return value
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, maxLength);
    }


    function isValidUrl(value) {

        if (!value) {
            return true;
        }

        try {

            const url = new URL(value);

            return (
                url.protocol === "http:" ||
                url.protocol === "https:"
            );

        } catch {
            return false;
        }
    }


    /* =====================================================
       TARGET SELECTOR
    ===================================================== */

    targetCards.forEach(card => {

        card.addEventListener("click", () => {

            targetCards.forEach(item => {
                item.classList.remove("active");
            });

            card.classList.add("active");

            selectedTarget =
                card.dataset.target || "other";

            clearError();

        });

    });


    /* =====================================================
       CHARACTER COUNTER
    ===================================================== */

    if (descriptionInput && charCount) {

        const updateCounter = () => {

            charCount.textContent =
                descriptionInput.value.length;

        };

        descriptionInput.addEventListener(
            "input",
            updateCounter
        );

        updateCounter();

    }


    /* =====================================================
       BACK BUTTON
    ===================================================== */

    if (backBtn) {

        backBtn.addEventListener("click", () => {

            if (
                window.history.length > 1
            ) {

                window.history.back();

                return;
            }

            window.location.href =
                "settings.html";

        });

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validateForm() {

        clearError();

        const reason =
            form.querySelector(
                'input[name="reason"]:checked'
            );

        const description =
            sanitizeText(
                descriptionInput?.value || "",
                1000
            );

        const targetId =
            sanitizeText(
                targetIdInput?.value || "",
                120
            );

        const targetUrl =
            sanitizeText(
                targetUrlInput?.value || "",
                500
            );


        if (!reason) {

            showError(
                "Please select a reason for your report."
            );

            return null;
        }


        if (description.length < 10) {

            showError(
                "Please provide a little more detail. Your description should be at least 10 characters."
            );

            descriptionInput?.focus();

            return null;
        }


        if (!isValidUrl(targetUrl)) {

            showError(
                "Please enter a valid HTTP or HTTPS content URL."
            );

            targetUrlInput?.focus();

            return null;
        }


        /*
         * A report should identify something whenever possible.
         * For profile reports, an ID is especially useful.
         */

        if (
            !targetId &&
            !targetUrl
        ) {

            showError(
                "Please provide a content or user ID, or paste the content URL so we can identify what you are reporting."
            );

            targetIdInput?.focus();

            return null;
        }


        return {

            targetType:
                selectedTarget,

            targetId,

            targetUrl,

            reason:
                reason.value,

            description

        };

    }


    /* =====================================================
       SUBMIT TO FIREBASE
    ===================================================== */

    async function submitReport(data) {

        const database =
            getFirebaseDatabase();

        if (!database) {

            throw new Error(
                "Firebase database is not available."
            );
        }


        const reportId =
            createReportId();


        /*
         * Authenticated user information.
         *
         * We store only the minimum account identifiers
         * needed for moderation.
         */

        const user =
            getCurrentUser();


        const report = {

            reportId,

            status: "pending",

            targetType:
                data.targetType,

            targetId:
                data.targetId || null,

            targetUrl:
                data.targetUrl || null,

            reason:
                data.reason,

            description:
                data.description,

            reporterUid:
                user?.uid || null,

            reporterEmail:
                user?.email || null,

            createdAt:
                Date.now(),

            updatedAt:
                Date.now(),

            source:
                "viewora-web",

            version:
                "1.0"

        };


        /*
         * Firebase Realtime Database:
         *
         * /reports/{reportId}
         */

        await database
            .ref(`reports/${reportId}`)
            .set(report);


        return reportId;
    }


    /* =====================================================
       SUCCESS MODAL
    ===================================================== */

    function showSuccess(reportId) {

        if (!successModal) return;

        if (reportIdText) {
            reportIdText.textContent =
                reportId || "—";
        }

        successModal.classList.add("show");

        successModal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.style.overflow = "hidden";

    }


    function closeSuccess() {

        if (!successModal) return;

        successModal.classList.remove("show");

        successModal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.style.overflow = "";

        /*
         * Return to the previous page after completion.
         */

        if (
            window.history.length > 1
        ) {

            window.history.back();

        } else {

            window.location.href =
                "settings.html";

        }

    }


    if (doneBtn) {

        doneBtn.addEventListener(
            "click",
            closeSuccess
        );

    }


    if (successModal) {

        successModal.addEventListener(
            "click",
            event => {

                if (
                    event.target === successModal
                ) {
                    closeSuccess();
                }

            }
        );

    }


    /* =====================================================
       ESCAPE MODAL
    ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                successModal?.classList.contains("show")
            ) {

                closeSuccess();

            }

        }
    );


    /* =====================================================
       FORM SUBMIT
    ===================================================== */

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            if (submitting) {
                return;
            }


            const data =
                validateForm();

            if (!data) {
                return;
            }


            setLoading(true);


            try {

                /*
                 * Give the UI a tiny moment to enter
                 * loading state smoothly.
                 */

                await new Promise(
                    resolve =>
                        requestAnimationFrame(resolve)
                );


                const reportId =
                    await submitReport(data);


                /*
                 * Reset form after successful
                 * Firebase submission.
                 */

                form.reset();


                targetCards.forEach(card => {
                    card.classList.remove("active");
                });


                const defaultTarget =
                    document.querySelector(
                        '.target-card[data-target="post"]'
                    );

                if (defaultTarget) {
                    defaultTarget.classList.add("active");
                }

                selectedTarget = "post";


                if (charCount) {
                    charCount.textContent = "0";
                }


                showSuccess(reportId);


            } catch (error) {

                console.error(
                    "Viewora Report Submission Error:",
                    error
                );


                /*
                 * Do not expose internal Firebase
                 * errors to the user.
                 */

                showError(
                    "We couldn't submit your report right now. Please check your connection and try again."
                );


            } finally {

                setLoading(false);

            }

        }
    );


    /* =====================================================
       INITIAL STATE
    ===================================================== */

    const defaultTarget =
        document.querySelector(
            '.target-card[data-target="post"]'
        );

    if (defaultTarget) {
        defaultTarget.classList.add("active");
    }


    console.log(
        "Viewora Report System initialized."
    );

})();