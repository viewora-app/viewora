"use strict";

/*
============================================================
 VIEWORA — REPORT SYSTEM
 report.js

 Supports:
 • User reports
 • Post reports
 • Video reports
 • Short reports
 • Story reports
 • Firebase Realtime Database
 • Duplicate report protection
 • Reason selection
 • Optional details
============================================================
*/

(() => {

    /* ======================================================
       PREVENT DOUBLE INITIALIZATION
    ====================================================== */

    if (window.__VIEWORA_REPORT_INITIALIZED__) {
        console.warn("Viewora report.js already initialized.");
        return;
    }

    window.__VIEWORA_REPORT_INITIALIZED__ = true;


    /* ======================================================
       DOM
    ====================================================== */

    const backBtn =
        document.getElementById("backBtn");

    const reasonCards =
        document.querySelectorAll(".reasonCard");

    const reportDetails =
        document.getElementById("reportDetails");

    const characterCount =
        document.getElementById("characterCount");

    const submitReportBtn =
        document.getElementById("submitReportBtn");

    const targetTitle =
        document.getElementById("targetTitle");

    const targetSubtitle =
        document.getElementById("targetSubtitle");

    const targetIcon =
        document.getElementById("targetIcon");

    const successOverlay =
        document.getElementById("successOverlay");

    const successDoneBtn =
        document.getElementById("successDoneBtn");

    const loadingOverlay =
        document.getElementById("loadingOverlay");

    const toast =
        document.getElementById("toast");

    const toastIcon =
        document.getElementById("toastIcon");

    const toastText =
        document.getElementById("toastText");


    /* ======================================================
       STATE
    ====================================================== */

    let selectedReason = "";

    let isSubmitting = false;

    let toastTimer = null;


    /* ======================================================
       URL PARAMETERS
       
       Examples:
       
       report.html?type=post&id=POST_ID&uid=USER_ID
       
       report.html?type=video&id=VIDEO_ID&uid=USER_ID
       
       report.html?type=short&id=SHORT_ID&uid=USER_ID
       
       report.html?type=story&id=STORY_ID&uid=USER_ID
       
       report.html?type=user&uid=USER_ID
    ====================================================== */

    const params =
        new URLSearchParams(window.location.search);

    const reportType =
        normalizeType(
            params.get("type") || "content"
        );

    const contentId =
        cleanValue(
            params.get("id")
        );

    const reportedUserId =
        cleanValue(
            params.get("uid") ||
            params.get("userId") ||
            ""
        );


    /* ======================================================
       HELPERS
    ====================================================== */

    function cleanValue(value) {

        if (!value) {
            return "";
        }

        return String(value).trim().slice(0, 200);
    }


    function normalizeType(type) {

        const value =
            String(type || "")
                .trim()
                .toLowerCase();

        const allowed = [
            "user",
            "post",
            "video",
            "short",
            "story",
            "content"
        ];

        return allowed.includes(value)
            ? value
            : "content";
    }


    function escapeHtml(value) {

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function getFirebaseAuth() {

        if (
            typeof firebase === "undefined" ||
            !firebase.auth
        ) {
            return null;
        }

        try {
            return firebase.auth();
        } catch (error) {
            console.error(
                "Viewora Report: Firebase Auth unavailable.",
                error
            );

            return null;
        }
    }


    function getFirebaseDatabase() {

        if (
            typeof firebase === "undefined" ||
            !firebase.database
        ) {
            return null;
        }

        try {
            return firebase.database();
        } catch (error) {
            console.error(
                "Viewora Report: Firebase Database unavailable.",
                error
            );

            return null;
        }
    }


    /* ======================================================
       TARGET UI
    ====================================================== */

    function setupTarget() {

        const config = {

            user: {
                title: "Account",
                subtitle: "You are reporting this Viewora account.",
                icon: "fa-solid fa-circle-user"
            },

            post: {
                title: "Post",
                subtitle: "You are reporting this Viewora post.",
                icon: "fa-solid fa-image"
            },

            video: {
                title: "Video",
                subtitle: "You are reporting this Viewora video.",
                icon: "fa-solid fa-video"
            },

            short: {
                title: "Short",
                subtitle: "You are reporting this Viewora Short.",
                icon: "fa-solid fa-clapperboard"
            },

            story: {
                title: "Story",
                subtitle: "You are reporting this Viewora Story.",
                icon: "fa-solid fa-circle-play"
            },

            content: {
                title: "Viewora content",
                subtitle: "You are reporting this Viewora content.",
                icon: "fa-solid fa-flag"
            }

        };

        const current =
            config[reportType] || config.content;

        if (targetTitle) {
            targetTitle.textContent =
                current.title;
        }

        if (targetSubtitle) {
            targetSubtitle.textContent =
                current.subtitle;
        }

        if (targetIcon) {
            targetIcon.className =
                current.icon;
        }
    }


    /* ======================================================
       REASON SELECTION
    ====================================================== */

    reasonCards.forEach(card => {

        card.addEventListener("click", () => {

            reasonCards.forEach(item => {
                item.classList.remove("selected");
                item.setAttribute("aria-checked", "false");
            });

            card.classList.add("selected");
            card.setAttribute("aria-checked", "true");

            selectedReason =
                cleanValue(
                    card.dataset.reason
                );

            updateSubmitState();

        });

    });


    /* ======================================================
       CHARACTER COUNT
    ====================================================== */

    if (reportDetails) {

        reportDetails.addEventListener(
            "input",
            () => {

                const length =
                    reportDetails.value.length;

                if (characterCount) {
                    characterCount.textContent =
                        String(length);
                }

            }
        );

    }


    /* ======================================================
       SUBMIT STATE
    ====================================================== */

    function updateSubmitState() {

        if (!submitReportBtn) {
            return;
        }

        submitReportBtn.disabled =
            !selectedReason ||
            isSubmitting;

    }


    /* ======================================================
       TOAST
    ====================================================== */

    function showToast(
        message,
        type = "success"
    ) {

        if (!toast) {
            return;
        }

        clearTimeout(toastTimer);

        toastText.textContent =
            message;

        toast.className =
            "toast show " + type;

        if (type === "error") {

            toastIcon.className =
                "fa-solid fa-circle-exclamation";

        } else {

            toastIcon.className =
                "fa-solid fa-circle-check";

        }

        toastTimer =
            setTimeout(() => {

                toast.classList.remove("show");

            }, 3500);

    }


    /* ======================================================
       LOADING
    ====================================================== */

    function setLoading(loading) {

        isSubmitting = loading;

        if (loadingOverlay) {

            loadingOverlay.classList.toggle(
                "hidden",
                !loading
            );

        }

        updateSubmitState();

    }


    /* ======================================================
       VALIDATE
    ====================================================== */

    function validateReport(user) {

        if (!user) {

            showToast(
                "Please sign in before submitting a report.",
                "error"
            );

            return false;
        }


        if (!selectedReason) {

            showToast(
                "Please select a reason for your report.",
                "error"
            );

            return false;
        }


        if (
            reportType !== "user" &&
            !contentId
        ) {

            showToast(
                "This report link is missing the content ID.",
                "error"
            );

            return false;
        }


        if (
            reportType === "user" &&
            !reportedUserId
        ) {

            showToast(
                "This report link is missing the account ID.",
                "error"
            );

            return false;
        }


        if (
            reportType !== "user" &&
            reportedUserId &&
            reportedUserId.length > 200
        ) {

            showToast(
                "Invalid account information.",
                "error"
            );

            return false;
        }


        return true;
    }


    /* ======================================================
       BUILD REPORT
    ====================================================== */

    function buildReport(user) {

        const now =
            firebase.database.ServerValue.TIMESTAMP;

        const details =
            reportDetails
                ? reportDetails.value.trim().slice(0, 1000)
                : "";

        return {

            reporterId:
                user.uid,

            reporterEmail:
                user.email || null,

            type:
                reportType,

            contentId:
                contentId || null,

            reportedUserId:
                reportedUserId || null,

            reason:
                selectedReason,

            details:
                details || null,

            status:
                "pending",

            createdAt:
                now,

            updatedAt:
                now

        };

    }


    /* ======================================================
       DUPLICATE KEY
    ====================================================== */

    function createDuplicateKey(user) {

        const target =
            reportType === "user"
                ? `user_${reportedUserId}`
                : `${reportType}_${contentId}`;

        return (
            `${user.uid}_${target}`
        )
        .replace(/[.#$[\]/]/g, "_")
        .slice(0, 500);
    }


    /* ======================================================
       SUBMIT REPORT
    ====================================================== */

    async function submitReport() {

        if (isSubmitting) {
            return;
        }

        const auth =
            getFirebaseAuth();

        const database =
            getFirebaseDatabase();

        if (!auth || !database) {

            showToast(
                "Viewora services are currently unavailable.",
                "error"
            );

            return;
        }


        const user =
            auth.currentUser;


        if (!validateReport(user)) {
            return;
        }


        setLoading(true);


        try {

            const duplicateKey =
                createDuplicateKey(user);

            const duplicateRef =
                database
                    .ref("reporterReports")
                    .child(duplicateKey);


            /*
            ==================================================
             DUPLICATE CHECK
            ==================================================
            */

            const duplicateSnapshot =
                await duplicateRef.once("value");


            if (duplicateSnapshot.exists()) {

                setLoading(false);

                showToast(
                    "You have already reported this.",
                    "error"
                );

                return;
            }


            /*
            ==================================================
             CREATE REPORT ID
            ==================================================
            */

            const reportRef =
                database
                    .ref("reports")
                    .push();


            const reportId =
                reportRef.key;


            if (!reportId) {

                throw new Error(
                    "Unable to create report ID."
                );

            }


            /*
            ==================================================
             REPORT DATA
            ==================================================
            */

            const report =
                buildReport(user);

            report.reportId =
                reportId;


            /*
            ==================================================
             MULTI LOCATION WRITE
            ==================================================
            */

            const updates = {};


            updates[
                `/reports/${reportId}`
            ] = report;


            /*
            Reporter-specific index.
            Used to prevent repeated reports and
            show user's own report history later.
            */

            updates[
                `/reporterReports/${duplicateKey}`
            ] = {

                reportId:
                    reportId,

                type:
                    reportType,

                contentId:
                    contentId || null,

                reportedUserId:
                    reportedUserId || null,

                reason:
                    selectedReason,

                createdAt:
                    firebase.database.ServerValue.TIMESTAMP

            };


            await database
                .ref()
                .update(updates);


            /*
            ==================================================
             SUCCESS
            ==================================================
            */

            setLoading(false);

            if (successOverlay) {
                successOverlay.classList.remove("hidden");
            }


        } catch (error) {

            console.error(
                "Viewora Report Submit Error:",
                error
            );

            setLoading(false);


            let message =
                "Unable to submit your report. Please try again.";


            if (
                error &&
                error.code ===
                "PERMISSION_DENIED"
            ) {

                message =
                    "You don't have permission to submit this report.";

            } else if (
                error &&
                error.code ===
                "NETWORK_ERROR"
            ) {

                message =
                    "Network error. Please check your connection.";

            }


            showToast(
                message,
                "error"
            );

        }

    }


    /* ======================================================
       SUBMIT BUTTON
    ====================================================== */

    if (submitReportBtn) {

        submitReportBtn.addEventListener(
            "click",
            submitReport
        );

    }


    /* ======================================================
       SUCCESS DONE
    ====================================================== */

    if (successDoneBtn) {

        successDoneBtn.addEventListener(
            "click",
            () => {

                if (successOverlay) {
                    successOverlay.classList.add("hidden");
                }

                goBack();

            }
        );

    }


    /* ======================================================
       BACK
    ====================================================== */

    function goBack() {

        if (
            window.history.length > 1
        ) {

            window.history.back();

            return;
        }

        window.location.href =
            "index.html";

    }


    if (backBtn) {

        backBtn.addEventListener(
            "click",
            goBack
        );

    }


    /* ======================================================
       AUTH CHECK
    ====================================================== */

    function initAuth() {

        const auth =
            getFirebaseAuth();

        if (!auth) {
            return;
        }


        auth.onAuthStateChanged(user => {

            if (!user) {

                if (submitReportBtn) {
                    submitReportBtn.disabled = true;
                }

                return;
            }

            updateSubmitState();

        });

    }


    /* ======================================================
       PREVENT ACCIDENTAL FORM LEAVE
    ====================================================== */

    window.addEventListener(
        "beforeunload",
        event => {

            if (
                reportDetails &&
                reportDetails.value.trim() &&
                !successOverlay.classList.contains("hidden")
            ) {
                return;
            }

        }
    );


    /* ======================================================
       START
    ====================================================== */

    setupTarget();

    updateSubmitState();

    initAuth();


})();