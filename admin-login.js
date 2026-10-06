/* =========================================================
   VIEWORA ADMIN LOGIN
   admin-login.js
========================================================= */

"use strict";

/*
 * firebase.js MUST load before this file.
 *
 * Example:
 * <script src="firebase.js"></script>
 * <script src="admin-login.js"></script>
 */

if (typeof firebase === "undefined") {
    console.error("Firebase SDK is not loaded.");
}

/* =========================================================
   FIREBASE INSTANCES
========================================================= */

const adminAuth = firebase.auth();
const adminDB = firebase.database();

/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

function showToast(message, type = "error") {

    const toast = $("loginError");
    const textEl = $("loginErrorText");

    if (toast && textEl) {
        textEl.textContent = message;
        toast.classList.remove("hidden");
        toast.classList.toggle("errorMessage", type === "error" || type === "warning");
        clearTimeout(window.__vieworaLoginToast);
        window.__vieworaLoginToast = setTimeout(() => {
            if (type === "success") {
                toast.classList.add("hidden");
            }
        }, 4000);
        return;
    }

    alert(message);
}

/* =========================================================
   LOADING
========================================================= */

function setLoading(loading) {

    const button =
        $("loginBtn");

    if (!button) return;

    button.disabled = loading;

    if (loading) {

        button.dataset.originalText =
            button.innerHTML;

        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Signing in...
        `;

    } else {

        button.innerHTML =
            button.dataset.originalText ||
            `
                <i class="fa-solid fa-right-to-bracket"></i>
                Sign In
            `;
    }
}

/* =========================================================
   SHOW / HIDE PASSWORD
========================================================= */

const togglePassword =
    $("togglePassword");

if (togglePassword) {

    togglePassword.addEventListener(
        "click",
        () => {

            const password =
                $("adminPassword");

            if (!password) return;

            const isPassword =
                password.type === "password";

            password.type =
                isPassword
                    ? "text"
                    : "password";

            togglePassword.innerHTML =
                isPassword
                    ? `<i class="fa-solid fa-eye-slash"></i>`
                    : `<i class="fa-solid fa-eye"></i>`;
        }
    );
}

/* =========================================================
   CHECK ADMIN
========================================================= */

async function verifyAdmin(user) {

    if (!user) {
        throw new Error(
            "Authentication required."
        );
    }

    const snapshot =
        await adminDB.ref(
            "admins/" + user.uid
        ).once("value");

    if (!snapshot.exists()) {

        throw new Error(
            "This account is not registered as a Viewora administrator."
        );
    }

    const adminData =
        snapshot.val() || {};

    if (adminData.active === false) {

        throw new Error(
            "Administrator access is disabled."
        );
    }

    const role =
        String(
            adminData.role || "admin"
        ).toLowerCase();

    if (
        role !== "admin" &&
        role !== "superadmin"
    ) {

        throw new Error(
            "This account does not have administrator privileges."
        );
    }

    return adminData;
}

/* =========================================================
   ALREADY LOGGED IN
========================================================= */

adminAuth.onAuthStateChanged(
    async (user) => {

        if (!user) return;

        try {

            await verifyAdmin(user);

            window.location.replace(
                "admin-panel.html"
            );

        } catch (error) {

            console.log(
                "No valid admin session:",
                error.message
            );

            try {
                await adminAuth.signOut();
            } catch (_) {}
        }
    }
);

/* =========================================================
   LOGIN
========================================================= */

const loginForm =
    $("adminLoginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const email =
                $("adminEmail")?.value
                    .trim();

            const password =
                $("adminPassword")?.value;

            if (!email) {

                showToast(
                    "Please enter your admin email.",
                    "warning"
                );

                return;
            }

            if (!password) {

                showToast(
                    "Please enter your password.",
                    "warning"
                );

                return;
            }

            setLoading(true);

            try {

                /*
                 * Firebase Authentication
                 */

                const credential =
                    await adminAuth
                        .signInWithEmailAndPassword(
                            email,
                            password
                        );

                const user =
                    credential.user;

                /*
                 * IMPORTANT:
                 * Authentication alone is NOT enough.
                 * Check /admins/{uid}.
                 */

                await verifyAdmin(user);

                showToast(
                    "Admin login successful.",
                    "success"
                );

                setTimeout(() => {

                    window.location.replace(
                        "admin-panel.html"
                    );

                }, 500);

            } catch (error) {

                console.error(
                    "Admin login error:",
                    error
                );

                /*
                 * If Firebase authentication
                 * succeeded but admin verification
                 * failed, sign the user out.
                 */

                try {
                    await adminAuth.signOut();
                } catch (_) {}

                let message =
                    "Unable to sign in.";

                switch (error.code) {

                    case "auth/invalid-email":

                        message =
                            "Please enter a valid email address.";

                        break;

                    case "auth/user-disabled":

                        message =
                            "This account has been disabled.";

                        break;

                    case "auth/user-not-found":

                    case "auth/invalid-credential":

                        message =
                            "Invalid admin email or password.";

                        break;

                    case "auth/wrong-password":

                        message =
                            "Incorrect password.";

                        break;

                    case "PERMISSION_DENIED":

                        message =
                            "Firebase permission denied. Check your Realtime Database rules.";

                        break;

                    default:

                        if (
                            error.message &&
                            error.message
                                .toLowerCase()
                                .includes(
                                    "permission_denied"
                                )
                        ) {

                            message =
                                "Firebase permission denied. Check /admins/{uid} database rules.";

                        } else if (
                            error.message
                        ) {

                            message =
                                error.message;
                        }
                }

                showToast(
                    message,
                    "error"
                );

            } finally {

                setLoading(false);
            }
        }
    );
}

/* =========================================================
   FORGOT PASSWORD MODAL
========================================================= */

const forgotPasswordBtn = $("forgotPasswordBtn");
const forgotModal = $("forgotModal");
const closeForgotModal = $("closeForgotModal");
const sendResetBtn = $("sendResetBtn");
const resetEmailInput = $("resetEmail");
const resetMessage = $("resetMessage");

function openForgotModal() {
    if (!forgotModal) return;
    forgotModal.classList.remove("hidden");
    // Prefill from login form if present
    try {
        const loginEmail = ($("adminEmail") && $("adminEmail").value) || "";
        if (resetEmailInput && loginEmail) {
            resetEmailInput.value = loginEmail.trim();
        }
    } catch (_) {}
    if (resetMessage) {
        resetMessage.classList.add("hidden");
        resetMessage.textContent = "";
    }
    setTimeout(function () {
        try { resetEmailInput && resetEmailInput.focus(); } catch (_) {}
    }, 50);
}

function closeForgotModalFn() {
    if (!forgotModal) return;
    forgotModal.classList.add("hidden");
}

if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openForgotModal();
    });
}

if (closeForgotModal) {
    closeForgotModal.addEventListener("click", function (e) {
        e.preventDefault();
        closeForgotModalFn();
    });
}

if (forgotModal) {
    const overlay = forgotModal.querySelector(".modalOverlay");
    if (overlay) {
        overlay.addEventListener("click", closeForgotModalFn);
    }
}

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && forgotModal && !forgotModal.classList.contains("hidden")) {
        closeForgotModalFn();
    }
});

if (sendResetBtn) {
    sendResetBtn.addEventListener("click", async function () {
        const email = ((resetEmailInput && resetEmailInput.value) || "").trim();
        if (!email) {
            if (typeof showToast === "function") {
                showToast("Enter your admin email.", "warning");
            }
            if (resetMessage) {
                resetMessage.textContent = "Please enter a valid email.";
                resetMessage.classList.remove("hidden");
            }
            return;
        }
        sendResetBtn.disabled = true;
        const prev = sendResetBtn.innerHTML;
        sendResetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Sending…</span>';
        try {
            await adminAuth.sendPasswordResetEmail(email);
            if (resetMessage) {
                resetMessage.textContent = "Reset link sent. Check your inbox.";
                resetMessage.classList.remove("hidden");
            }
            if (typeof showToast === "function") {
                showToast("Password reset email sent.", "success");
            }
            setTimeout(closeForgotModalFn, 1600);
        } catch (error) {
            console.error(error);
            var msg = "Unable to send password reset email.";
            if (error && error.code === "auth/user-not-found") {
                msg = "No account found for this email.";
            } else if (error && error.code === "auth/invalid-email") {
                msg = "Invalid email address.";
            } else if (error && error.code === "auth/too-many-requests") {
                msg = "Too many requests. Try again later.";
            }
            if (resetMessage) {
                resetMessage.textContent = msg;
                resetMessage.classList.remove("hidden");
            }
            if (typeof showToast === "function") {
                showToast(msg, "error");
            }
        } finally {
            sendResetBtn.disabled = false;
            sendResetBtn.innerHTML = prev;
        }
    });
}

/* =========================================================
   ENTER KEY SUPPORT
========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter" &&
            document.activeElement?.id ===
                "adminPassword"
        ) {

            if (loginForm) {
                loginForm.requestSubmit();
            }
        }
    }
);

/* =========================================================
   PREVENT BACK TO ADMIN AFTER LOGOUT
========================================================= */

window.addEventListener(
    "pageshow",
    async () => {

        const user =
            adminAuth.currentUser;

        if (!user) return;

        try {

            await verifyAdmin(user);

        } catch (_) {

            try {
                await adminAuth.signOut();
            } catch (_) {}

        }
    }
);

/* =========================================================
   GLOBAL API
========================================================= */

window.VieworaAdminLogin = {

    verifyAdmin,

    showToast

};

/* =========================================================
   END
========================================================= */