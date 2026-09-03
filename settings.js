/* =========================================================
   VIEWORA SETTINGS — Clean & Firebase Safe
========================================================= */

(function () {
    "use strict";

    const loader = document.getElementById("settingsLoader");
    const profilePhoto = document.getElementById("profilePhoto");
    const profileName = document.getElementById("profileName");
    const profileUsername = document.getElementById("profileUsername");
    const toast = document.getElementById("vieworaToast");
    const toastMessage = document.getElementById("toastMessage");
    const toastIcon = document.getElementById("toastIcon");

    let loaderHidden = false;

    function hideLoader() {
        if (loaderHidden) return;
        loaderHidden = true;
        if (loader) {
            loader.classList.add("hidden");
            setTimeout(() => {
                if (loader) loader.style.display = "none";
            }, 300);
        }
    }

    // Safety timeout so page never stays stuck
    setTimeout(() => {
        if (!loaderHidden) hideLoader();
    }, 7000);

    /* Toast */
    window.showToast = function (message, icon = "✓") {
        if (!toast) return;
        if (toastMessage) toastMessage.textContent = message;
        if (toastIcon) toastIcon.textContent = icon;
        toast.classList.add("show");
        clearTimeout(window.__toastTimer);
        window.__toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2600);
    };

    /* Navigation */
    window.goBack = function () {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = "index.html";
        }
    };

    window.openPage = function (page) {
        if (page) window.location.href = page;
    };

    /* Profile helpers */
    function setDefaultProfile() {
        if (profileName) profileName.textContent = "Viewora User";
        if (profileUsername) profileUsername.textContent = "@user";
        if (profilePhoto) profilePhoto.src = "non.jpg";
    }

    function loadProfile(uid) {
        if (!uid || !window.db || typeof window.db.ref !== "function") {
            setDefaultProfile();
            hideLoader();
            return;
        }

        window.db.ref("users/" + uid).once("value")
            .then((snap) => {
                if (!snap.exists()) {
                    setDefaultProfile();
                    hideLoader();
                    return;
                }

                const user = snap.val() || {};

                if (profileName) {
                    profileName.textContent = user.name || user.displayName || "Viewora User";
                }

                if (profileUsername) {
                    let uname = user.username || user.userName || "user";
                    uname = String(uname);
                    if (!uname.startsWith("@")) uname = "@" + uname;
                    profileUsername.textContent = uname;
                }

                if (profilePhoto) {
                    const photo = user.profilePhoto || user.photoURL || user.photoUrl || "non.jpg";
                    profilePhoto.src = photo;
                    profilePhoto.onerror = function () {
                        this.onerror = null;
                        this.src = "non.jpg";
                    };
                }

                hideLoader();
            })
            .catch(() => {
                setDefaultProfile();
                showToast("Could not load profile", "⚠️");
                hideLoader();
            });
    }

    /* Auth */
    function startAuth() {
        if (!window.auth || typeof window.auth.onAuthStateChanged !== "function") {
            setDefaultProfile();
            showToast("Firebase unavailable", "⚠️");
            hideLoader();
            return;
        }

        window.auth.onAuthStateChanged((user) => {
            if (!user) {
                hideLoader();
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 400);
                return;
            }
            loadProfile(user.uid);
        });
    }

    /* Actions */
    window.changeLanguage = function () {
        showToast("English selected", "🌐");
    };

    window.shareApp = async function () {
        const data = {
            title: "Viewora",
            text: "Join me on Viewora",
            url: window.location.origin
        };
        try {
            if (navigator.share) {
                await navigator.share(data);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(window.location.origin);
                showToast("Link copied", "📋");
            } else {
                window.prompt("Copy link:", window.location.origin);
            }
        } catch (e) {}
    };

    window.clearCache = function () {
        if (!confirm("Clear temporary Viewora data?")) return;
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith("viewora_") || k.startsWith("Viewora_"))) {
                    keys.push(k);
                }
            }
            keys.forEach(k => localStorage.removeItem(k));
            showToast("Cache cleared", "🧹");
        } catch (e) {
            showToast("Unable to clear cache", "⚠️");
        }
    };

    window.showHelp = function () {
        window.location.href = "support-settings.html";
    };

    window.showAbout = function () {
        alert("Viewora\nVersion 1.0.0\n\nPremium Social Platform\n© 2026 Viewora");
    };

    window.logout = async function () {
        if (!confirm("Log out of Viewora?")) return;
        try {
            if (window.auth) await window.auth.signOut();
            showToast("Logged out", "👋");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 600);
        } catch (e) {
            showToast("Logout failed", "⚠️");
        }
    };

    window.deleteAccount = function () {
        window.location.href = "delete-account.html";
    };

    /* Init */
    function init() {
        if (typeof window.firebase === "undefined") {
            setDefaultProfile();
            hideLoader();
            return;
        }

        let tries = 0;
        const timer = setInterval(() => {
            tries++;
            const authOk = window.auth && typeof window.auth.onAuthStateChanged === "function";
            const dbOk = window.db && typeof window.db.ref === "function";

            if (authOk && dbOk) {
                clearInterval(timer);
                startAuth();
                return;
            }

            if (tries >= 25) {
                clearInterval(timer);
                setDefaultProfile();
                showToast("Could not connect", "⚠️");
                hideLoader();
            }
        }, 120);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
