/* =========================================================
   VIEWORA SETTINGS V3.0
   Premium • Firebase Safe • Loading Fixed
========================================================= */

(function () {

    "use strict";

    console.log("⚙️ Viewora Settings JS starting...");

    /* =====================================================
       ELEMENTS
    ===================================================== */

    const loader = document.getElementById("settingsLoader");
    const profilePhoto = document.getElementById("profilePhoto");
    const profileName = document.getElementById("profileName");
    const profileUsername = document.getElementById("profileUsername");
    const toast = document.getElementById("vieworaToast");
    const toastMessage = document.getElementById("toastMessage");
    const toastIcon = document.getElementById("toastIcon");


    /* =====================================================
       LOADER
    ===================================================== */

    let loaderHidden = false;

    function hideLoader() {

        if (loaderHidden) return;

        loaderHidden = true;

        if (loader) {

            loader.classList.add("hidden");

            setTimeout(() => {

                loader.style.display = "none";

            }, 450);

        }

        document.body.classList.add("settings-loaded");

        console.log("✅ Settings loader hidden");

    }


    /*
       IMPORTANT:
       Even if Firebase has an error, the page must
       not remain stuck on Loading Viewora forever.
    */

    setTimeout(() => {

        if (!loaderHidden) {

            console.warn(
                "⚠️ Settings loader timeout. Continuing without profile."
            );

            hideLoader();

        }

    }, 8000);


    /* =====================================================
       TOAST
    ===================================================== */

    window.showToast = function (message, icon = "✓") {

        if (!toast) return;

        if (toastMessage) {
            toastMessage.textContent = message;
        }

        if (toastIcon) {
            toastIcon.textContent = icon;
        }

        toast.classList.add("show");

        clearTimeout(window.__vieworaToastTimer);

        window.__vieworaToastTimer = setTimeout(() => {

            toast.classList.remove("show");

        }, 2800);

    };


    /* =====================================================
       PAGE NAVIGATION
    ===================================================== */

    window.goBack = function () {

        if (window.history.length > 1) {

            window.history.back();

        } else {

            window.location.href = "index.html";

        }

    };


    window.openPage = function (page) {

        if (!page) return;

        window.location.href = page;

    };


    /* =====================================================
       PROFILE
    ===================================================== */

    function setDefaultProfile() {

        if (profileName) {
            profileName.textContent = "Viewora User";
        }

        if (profileUsername) {
            profileUsername.textContent = "@user";
        }

        if (profilePhoto) {
            profilePhoto.src = "non.jpg";
        }

    }


    function loadProfile(uid) {

        if (!uid) {

            setDefaultProfile();
            hideLoader();
            return;

        }


        /*
           Check database safely.
        */

        if (
            typeof window.db === "undefined" ||
            !window.db ||
            typeof window.db.ref !== "function"
        ) {

            console.error(
                "❌ Firebase Database (db) is not available."
            );

            setDefaultProfile();
            hideLoader();

            return;

        }


        window.db
            .ref("users/" + uid)
            .once("value")

            .then((snapshot) => {

                if (!snapshot.exists()) {

                    console.warn(
                        "⚠️ User profile not found."
                    );

                    setDefaultProfile();

                    hideLoader();

                    return;

                }


                const user = snapshot.val() || {};


                /* -----------------------------
                   NAME
                ----------------------------- */

                if (profileName) {

                    profileName.textContent =
                        user.name ||
                        user.displayName ||
                        "Viewora User";

                }


                /* -----------------------------
                   USERNAME
                ----------------------------- */

                if (profileUsername) {

                    let username =
                        user.username ||
                        user.userName ||
                        "user";

                    username = String(username);

                    if (!username.startsWith("@")) {

                        username = "@" + username;

                    }

                    profileUsername.textContent =
                        username;

                }


                /* -----------------------------
                   PROFILE PHOTO
                ----------------------------- */

                if (profilePhoto) {

                    const photo =
                        user.profilePhoto ||
                        user.photoURL ||
                        user.photoUrl ||
                        "non.jpg";

                    profilePhoto.src = photo;

                    profilePhoto.onerror = function () {

                        this.onerror = null;

                        this.src = "non.jpg";

                    };

                }


                console.log(
                    "✅ Profile loaded:",
                    user.username || user.name || "User"
                );


                hideLoader();

            })

            .catch((error) => {

                console.error(
                    "❌ Profile loading error:",
                    error
                );

                setDefaultProfile();

                showToast(
                    "Could not load profile",
                    "⚠️"
                );

                hideLoader();

            });

    }


    /* =====================================================
       AUTH STATE
    ===================================================== */

    function startAuthentication() {

        /*
           Firebase Auth may not have loaded yet.
        */

        if (
            typeof window.auth === "undefined" ||
            !window.auth ||
            typeof window.auth.onAuthStateChanged !== "function"
        ) {

            console.error(
                "❌ Firebase Auth (auth) is not available."
            );

            setDefaultProfile();

            showToast(
                "Firebase connection unavailable",
                "⚠️"
            );

            hideLoader();

            return;

        }


        console.log(
            "🔐 Waiting for Firebase authentication..."
        );


        window.auth.onAuthStateChanged((user) => {

            console.log(
                "🔐 Auth state:",
                user ? "Logged in" : "Logged out"
            );


            /* -----------------------------
               NOT LOGGED IN
            ----------------------------- */

            if (!user) {

                hideLoader();

                setTimeout(() => {

                    window.location.href =
                        "login.html";

                }, 500);

                return;

            }


            /* -----------------------------
               LOGGED IN
            ----------------------------- */

            loadProfile(user.uid);

        });

    }


    /* =====================================================
       EDIT PROFILE
    ===================================================== */

    window.editProfile = function () {

        window.location.href =
            "account-settings.html";

    };


    /* =====================================================
       LANGUAGE
    ===================================================== */

    window.changeLanguage = function () {

        showToast(
            "🌐 English selected",
            "✓"
        );

    };


    /* =====================================================
       SHARE APP
    ===================================================== */

    window.shareApp = async function () {

        const shareData = {

            title: "Viewora",

            text:
                "Join me on Viewora 🚀",

            url:
                window.location.origin

        };


        try {

            if (
                navigator.share
            ) {

                await navigator.share(
                    shareData
                );

                return;

            }


            if (
                navigator.clipboard &&
                navigator.clipboard.writeText
            ) {

                await navigator.clipboard.writeText(
                    window.location.origin
                );

                showToast(
                    "Viewora link copied",
                    "📋"
                );

                return;

            }


            window.prompt(
                "Copy Viewora link:",
                window.location.origin
            );

        }

        catch (error) {

            console.log(
                "Share cancelled:",
                error
            );

        }

    };


    /* =====================================================
       CLEAR CACHE
    ===================================================== */

    window.clearCache = function () {

        const confirmed =
            window.confirm(
                "Clear temporary Viewora data?"
            );

        if (!confirmed) return;


        try {

            /*
               Don't clear Firebase auth/session data.
               Only clear Viewora local cache keys.
            */

            const keysToRemove = [];

            for (
                let i = 0;
                i < localStorage.length;
                i++
            ) {

                const key =
                    localStorage.key(i);

                if (!key) continue;

                if (
                    key.startsWith("viewora_") ||
                    key.startsWith("Viewora_")
                ) {

                    keysToRemove.push(key);

                }

            }


            keysToRemove.forEach(
                key => localStorage.removeItem(key)
            );


            showToast(
                "Cache cleared successfully",
                "🧹"
            );

        }

        catch (error) {

            console.error(
                "Cache error:",
                error
            );

            showToast(
                "Unable to clear cache",
                "⚠️"
            );

        }

    };


    /* =====================================================
       DOWNLOADS
    ===================================================== */

    window.manageDownloads = function () {

        showToast(
            "📥 Downloads manager coming soon",
            "🚀"
        );

    };


    /* =====================================================
       PERMISSIONS
    ===================================================== */

    window.managePermissions = function () {

        showToast(
            "🔑 Manage permissions from device settings",
            "ℹ️"
        );

    };


    /* =====================================================
       HELP
    ===================================================== */

    window.showHelp = function () {

        window.location.href =
            "support-settings.html";

    };


    /* =====================================================
       ABOUT
    ===================================================== */

    window.showAbout = function () {

        alert(
`Viewora

Version 1.0.0

Premium Social Platform

Made with ❤️

© 2026 Viewora`
        );

    };


    /* =====================================================
       LOGOUT
    ===================================================== */

    window.logout = async function () {

        const confirmed =
            window.confirm(
                "Do you want to logout from Viewora?"
            );

        if (!confirmed) return;


        if (
            typeof window.auth === "undefined" ||
            !window.auth
        ) {

            window.location.href =
                "login.html";

            return;

        }


        try {

            await window.auth.signOut();

            showToast(
                "Logged out successfully",
                "👋"
            );


            setTimeout(() => {

                window.location.href =
                    "login.html";

            }, 700);

        }

        catch (error) {

            console.error(
                "Logout error:",
                error
            );

            showToast(
                "Logout failed",
                "⚠️"
            );

        }

    };


    /* =====================================================
       DELETE ACCOUNT
    ===================================================== */

    window.deleteAccount = function () {

        window.location.href =
            "delete-account.html";

    };


    /* =====================================================
       PROFILE IMAGE CLICK
    ===================================================== */

    if (profilePhoto) {

        profilePhoto.addEventListener(
            "error",
            function () {

                this.onerror = null;

                this.src = "non.jpg";

            }
        );

    }


    /* =====================================================
       ONLINE / OFFLINE
    ===================================================== */

    window.addEventListener(
        "online",
        () => {

            showToast(
                "Internet connected",
                "🌐"
            );

        }
    );


    window.addEventListener(
        "offline",
        () => {

            showToast(
                "You're offline",
                "⚠️"
            );

        }
    );


    /* =====================================================
       START
    ===================================================== */

    function initializeSettings() {

        console.log(
            "🚀 Initializing Viewora Settings..."
        );


        /*
           Firebase.js must be loaded before settings.js.
        */

        if (
            typeof window.firebase === "undefined"
        ) {

            console.error(
                "❌ Firebase SDK not loaded."
            );

            setDefaultProfile();
            hideLoader();

            return;

        }


        /*
           Give firebase.js a tiny amount of time
           to create auth/db if needed.
        */

        let attempts = 0;

        const waitForFirebase = setInterval(() => {

            attempts++;


            const authReady =
                typeof window.auth !== "undefined" &&
                window.auth &&
                typeof window.auth.onAuthStateChanged === "function";


            const dbReady =
                typeof window.db !== "undefined" &&
                window.db &&
                typeof window.db.ref === "function";


            if (authReady && dbReady) {

                clearInterval(
                    waitForFirebase
                );

                console.log(
                    "✅ Firebase Auth + Database ready"
                );

                startAuthentication();

                return;

            }


            if (attempts >= 30) {

                clearInterval(
                    waitForFirebase
                );

                console.error(
                    "❌ Firebase initialization timeout."
                );

                setDefaultProfile();

                showToast(
                    "Firebase could not connect",
                    "⚠️"
                );

                hideLoader();

            }

        }, 100);

    }


    /* =====================================================
       DOM READY
    ===================================================== */

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeSettings
        );

    } else {

        initializeSettings();

    }


})();