/* =========================================================
   VIEWORA • PREMIUM LOGIN.JS
   Firebase Auth
   Email • Username • Google • Facebook • X
   Password Reset • Verification • Remember Me
   Network • Toast • Premium UX

   IMPORTANT:
   firebase.js MUST initialize:
   window.auth / auth
   window.db / db
   window.googleProvider
   window.facebookProvider
   window.twitterProvider
========================================================= */

"use strict";

(() => {

    /* =====================================================
       GLOBAL SAFETY
    ====================================================== */

    if (typeof firebase === "undefined") {
        console.error("Viewora: Firebase SDK missing.");
        return;
    }

    /*
       DO NOT DECLARE:
       const auth = ...
       const db = ...

       They are already created by firebase.js.
    */

    const loginAuth =
        typeof auth !== "undefined"
            ? auth
            : firebase.auth();

    const loginDB =
        typeof db !== "undefined"
            ? db
            : firebase.database();


    /* =====================================================
       DOM
    ====================================================== */

    const loginForm =
        document.getElementById("loginForm");

    const loginInput =
        document.getElementById("loginInput");

    const passwordInput =
        document.getElementById("password");

    const loginBtn =
        document.getElementById("loginBtn");

    const googleLoginBtn =
        document.getElementById("googleLogin");

    const facebookLoginBtn =
        document.getElementById("facebookLogin");

    const xLoginBtn =
        document.getElementById("xLogin");

    const rememberMe =
        document.getElementById("rememberMe");

    const togglePassword =
        document.getElementById("togglePassword");

    const forgotPassword =
        document.getElementById("forgotPassword");

    const loadingOverlay =
        document.getElementById("loadingOverlay");

    const toast =
        document.getElementById("toast");

    const toastText =
        document.getElementById("toastText");

    const toastIcon =
        document.getElementById("toastIcon");

    const verifyModal =
        document.getElementById("verifyModal");

    const forgotModal =
        document.getElementById("forgotModal");

    const networkBanner =
        document.getElementById("networkBanner");


    /* =====================================================
       VARIABLES
    ====================================================== */

    let loginLoading = false;
    let toastTimer = null;
    let authRedirecting = false;


    /* =====================================================
       TOAST
    ====================================================== */

    function showToast(
        message,
        type = "success"
    ) {

        if (!toast) {
            return;
        }

        if (toastText) {
            toastText.textContent = message;
        }

        if (toastIcon) {

            if (type === "success") {

                toastIcon.className =
                    "fa-solid fa-circle-check";

            } else if (type === "error") {

                toastIcon.className =
                    "fa-solid fa-circle-xmark";

            } else {

                toastIcon.className =
                    "fa-solid fa-circle-info";

            }

        }

        toast.classList.remove("hidden");

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {

            toast.classList.remove("show");

            setTimeout(() => {

                toast.classList.add("hidden");

            }, 250);

        }, 2800);

    }


    /* =====================================================
       LOADING
    ====================================================== */

    function showLoading() {

        loginLoading = true;

        if (loadingOverlay) {
            loadingOverlay.classList.remove("hidden");
        }

        document
            .querySelectorAll(
                "#loginBtn, #googleLogin, #facebookLogin, #xLogin"
            )
            .forEach(button => {

                button.disabled = true;

            });

    }


    function hideLoading() {

        loginLoading = false;

        if (loadingOverlay) {
            loadingOverlay.classList.add("hidden");
        }

        document
            .querySelectorAll(
                "#loginBtn, #googleLogin, #facebookLogin, #xLogin"
            )
            .forEach(button => {

                button.disabled = false;

            });

    }


    /* =====================================================
       PASSWORD TOGGLE
    ====================================================== */

    togglePassword?.addEventListener(
        "click",
        () => {

            if (!passwordInput) {
                return;
            }

            const showing =
                passwordInput.type === "text";

            passwordInput.type =
                showing
                    ? "password"
                    : "text";

            togglePassword.innerHTML =
                showing
                    ? '<i class="fa-solid fa-eye"></i>'
                    : '<i class="fa-solid fa-eye-slash"></i>';

        }
    );


    /* =====================================================
       REMEMBER ME
    ====================================================== */

    function loadRememberedLogin() {

        const saved =
            localStorage.getItem(
                "viewora_login"
            );

        if (
            saved &&
            loginInput
        ) {

            loginInput.value = saved;

            if (rememberMe) {
                rememberMe.checked = true;
            }

        }

    }


    function saveRememberedLogin(
        value
    ) {

        if (!rememberMe) {
            return;
        }

        if (rememberMe.checked) {

            localStorage.setItem(
                "viewora_login",
                value
            );

        } else {

            localStorage.removeItem(
                "viewora_login"
            );

        }

    }


    /* =====================================================
       VALIDATION
    ====================================================== */

    function isEmail(value) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(value);

    }


    function isUsername(value) {

        return /^[a-zA-Z0-9_]{3,20}$/
            .test(value);

    }


    function validateLogin() {

        const login =
            loginInput?.value.trim() || "";

        const password =
            passwordInput?.value || "";

        if (!login) {

            showToast(
                "Enter your email or username.",
                "error"
            );

            loginInput?.focus();

            return false;
        }

        if (!password) {

            showToast(
                "Enter your password.",
                "error"
            );

            passwordInput?.focus();

            return false;
        }

        if (password.length < 6) {

            showToast(
                "Password must be at least 6 characters.",
                "error"
            );

            passwordInput?.focus();

            return false;
        }

        return true;

    }


    /* =====================================================
       USERNAME → EMAIL
    ====================================================== */

    async function getEmailFromUsername(
        username
    ) {

        try {

            const usernameSnapshot =
                await loginDB
                    .ref(
                        "usernames/" +
                        username.toLowerCase()
                    )
                    .once("value");

            if (
                !usernameSnapshot.exists()
            ) {

                return null;

            }

            const uid =
                usernameSnapshot.val();

            const userSnapshot =
                await loginDB
                    .ref(
                        "users/" + uid
                    )
                    .once("value");

            if (
                !userSnapshot.exists()
            ) {

                return null;

            }

            const data =
                userSnapshot.val();

            return data.email || null;

        } catch (error) {

            console.error(
                "Username lookup error:",
                error
            );

            return null;

        }

    }


    /* =====================================================
       PREPARE EMAIL LOGIN
    ====================================================== */

    async function prepareLogin() {

        if (!validateLogin()) {
            return null;
        }

        let login =
            loginInput.value
                .trim()
                .toLowerCase();

        const password =
            passwordInput.value;

        if (
            !isEmail(login) &&
            isUsername(login)
        ) {

            const email =
                await getEmailFromUsername(
                    login
                );

            if (!email) {

                showToast(
                    "Username not found.",
                    "error"
                );

                return null;

            }

            login =
                email.toLowerCase();

        }

        if (!isEmail(login)) {

            showToast(
                "Enter a valid email or username.",
                "error"
            );

            return null;

        }

        saveRememberedLogin(login);

        return {
            email: login,
            password: password
        };

    }


    /* =====================================================
       UPDATE USER PROFILE
    ====================================================== */

    async function updateUserRecord(
        user,
        providerName = "email"
    ) {

        if (!user) {
            return;
        }

        const userRef =
            loginDB.ref(
                "users/" + user.uid
            );

        const snapshot =
            await userRef.once("value");

        const existing =
            snapshot.exists()
                ? snapshot.val()
                : {};

        let username =
            existing.username ||
            "";

        if (!username) {

            const base =
                (
                    user.displayName ||
                    user.email?.split("@")[0] ||
                    "user"
                )
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "")
                    .slice(0, 14) ||
                "user";

            username =
                base +
                Math.floor(
                    1000 +
                    Math.random() * 9000
                );

            let usernameCheck =
                await loginDB
                    .ref(
                        "usernames/" +
                        username
                    )
                    .once("value");

            let attempt = 0;

            while (
                usernameCheck.exists() &&
                attempt < 20
            ) {

                username =
                    base +
                    Math.floor(
                        1000 +
                        Math.random() * 9000
                    );

                usernameCheck =
                    await loginDB
                        .ref(
                            "usernames/" +
                            username
                        )
                        .once("value");

                attempt++;

            }

            await loginDB
                .ref(
                    "usernames/" +
                    username
                )
                .set(user.uid);

        }

        const profilePhoto =
            user.photoURL ||
            existing.profilePhoto ||
            "assets/default-avatar.png";

        await userRef.update({

            uid: user.uid,

            fullName:
                user.displayName ||
                existing.fullName ||
                "",

            username: username,

            email:
                user.email ||
                existing.email ||
                "",

            profilePhoto:

                profilePhoto,

            provider:
                providerName,

            emailVerified:
                user.emailVerified || false,

            online: true,

            lastLogin:
                firebase.database.ServerValue.TIMESTAMP

        });

        userRef
            .onDisconnect()
            .update({

                online: false,

                lastSeen:
                    firebase.database.ServerValue.TIMESTAMP

            });

    }


    /* =====================================================
       EMAIL LOGIN
    ====================================================== */

    async function loginUser(
        event
    ) {

        event?.preventDefault();

        if (loginLoading) {
            return;
        }

        const data =
            await prepareLogin();

        if (!data) {
            return;
        }

        showLoading();

        try {

            const result =
                await loginAuth
                    .signInWithEmailAndPassword(
                        data.email,
                        data.password
                    );

            const user =
                result.user;

            await user.reload();

            /*
              Verification check
            */

            if (!user.emailVerified) {

                hideLoading();

                if (verifyModal) {
                    verifyModal.classList.remove(
                        "hidden"
                    );
                }

                showToast(
                    "Please verify your email first.",
                    "error"
                );

                await loginAuth.signOut();

                return;

            }

            await updateUserRecord(
                user,
                "email"
            );

            showToast(
                "Welcome back to Viewora!"
            );

            authRedirecting = true;

            setTimeout(() => {

                location.replace(
                    "index.html"
                );

            }, 900);

        } catch (error) {

            console.error(
                "Email login error:",
                error
            );

            hideLoading();

            showAuthError(error);

        }

    }


    loginForm?.addEventListener(
        "submit",
        loginUser
    );


    /* =====================================================
       SOCIAL PROVIDER HELPER
    ====================================================== */

    async function socialLogin(
        provider,
        providerName
    ) {

        if (loginLoading) {
            return;
        }

        if (!provider) {

            showToast(
                `${providerName} login is not configured yet.`,
                "error"
            );

            console.error(
                `${providerName} provider missing in firebase.js`
            );

            return;

        }

        showLoading();

        try {

            const result =
                await loginAuth
                    .signInWithPopup(
                        provider
                    );

            const user =
                result.user;

            await updateUserRecord(
                user,
                providerName.toLowerCase()
            );

            showToast(
                `${providerName} Login Successful`
            );

            authRedirecting = true;

            setTimeout(() => {

                location.replace(
                    "index.html"
                );

            }, 900);

        } catch (error) {

            console.error(
                `${providerName} login error:`,
                error
            );

            hideLoading();

            /*
              User closing popup is not really
              an error for the UI.
            */

            if (
                error.code ===
                "auth/popup-closed-by-user"
            ) {

                return;

            }

            if (
                error.code ===
                "auth/cancelled-popup-request"
            ) {

                return;

            }

            showAuthError(error);

        }

    }


    /* =====================================================
       GOOGLE
    ====================================================== */

    googleLoginBtn?.addEventListener(
        "click",
        () => {

            const provider =
                typeof googleProvider !== "undefined"
                    ? googleProvider
                    : null;

            socialLogin(
                provider,
                "Google"
            );

        }
    );


    /* =====================================================
       FACEBOOK
    ====================================================== */

    facebookLoginBtn?.addEventListener(
        "click",
        () => {

            const provider =
                typeof facebookProvider !== "undefined"
                    ? facebookProvider
                    : null;

            socialLogin(
                provider,
                "Facebook"
            );

        }
    );


    /* =====================================================
       X / TWITTER
    ====================================================== */

    xLoginBtn?.addEventListener(
        "click",
        () => {

            const provider =
                typeof twitterProvider !== "undefined"
                    ? twitterProvider
                    : (
                        typeof xProvider !== "undefined"
                            ? xProvider
                            : null
                    );

            socialLogin(
                provider,
                "X"
            );

        }
    );


    /* =====================================================
       AUTH ERROR
    ====================================================== */

    function showAuthError(
        error
    ) {

        let message =
            "Login failed. Please try again.";

        switch (error?.code) {

            case "auth/user-not-found":
                message =
                    "Account not found.";
                break;

            case "auth/wrong-password":
                message =
                    "Incorrect password.";
                break;

            case "auth/invalid-credential":
                message =
                    "Invalid email or password.";
                break;

            case "auth/invalid-email":
                message =
                    "Invalid email address.";
                break;

            case "auth/user-disabled":
                message =
                    "This account has been disabled.";
                break;

            case "auth/popup-blocked":
                message =
                    "Popup blocked. Allow popups and try again.";
                break;

            case "auth/account-exists-with-different-credential":
                message =
                    "This email is already linked to another login method.";
                break;

            case "auth/too-many-requests":
                message =
                    "Too many attempts. Please try again later.";
                break;

            case "auth/network-request-failed":
                message =
                    "No internet connection.";
                break;

            default:

                if (
                    error?.message
                ) {

                    message =
                        error.message;

                }

        }

        showToast(
            message,
            "error"
        );

    }


    /* =====================================================
       FORGOT PASSWORD
    ====================================================== */

    const sendResetBtn =
        document.getElementById(
            "sendResetBtn"
        );

    const closeForgotBtn =
        document.getElementById(
            "closeForgotBtn"
        );

    const resetEmail =
        document.getElementById(
            "resetEmail"
        );


    forgotPassword?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            forgotModal?.classList.remove(
                "hidden"
            );

            resetEmail?.focus();

        }
    );


    closeForgotBtn?.addEventListener(
        "click",
        () => {

            forgotModal?.classList.add(
                "hidden"
            );

        }
    );


    sendResetBtn?.addEventListener(
        "click",
        async () => {

            const email =
                resetEmail?.value
                    .trim()
                    .toLowerCase() || "";

            if (!isEmail(email)) {

                showToast(
                    "Enter a valid email.",
                    "error"
                );

                resetEmail?.focus();

                return;

            }

            try {

                sendResetBtn.disabled =
                    true;

                await loginAuth
                    .sendPasswordResetEmail(
                        email
                    );

                showToast(
                    "Password reset email sent."
                );

                forgotModal?.classList.add(
                    "hidden"
                );

                if (resetEmail) {
                    resetEmail.value = "";
                }

            } catch (error) {

                console.error(
                    "Password reset error:",
                    error
                );

                showAuthError(error);

            } finally {

                sendResetBtn.disabled =
                    false;

            }

        }
    );


    /* =====================================================
       EMAIL VERIFICATION
    ====================================================== */

    const resendVerificationBtn =
        document.getElementById(
            "resendVerificationBtn"
        );

    const closeVerifyBtn =
        document.getElementById(
            "closeVerifyBtn"
        );


    closeVerifyBtn?.addEventListener(
        "click",
        () => {

            verifyModal?.classList.add(
                "hidden"
            );

        }
    );


    resendVerificationBtn?.addEventListener(
        "click",
        async () => {

            const user =
                loginAuth.currentUser;

            if (!user) {

                showToast(
                    "Please login again.",
                    "error"
                );

                return;

            }

            try {

                resendVerificationBtn.disabled =
                    true;

                await user
                    .sendEmailVerification();

                showToast(
                    "Verification email sent."
                );

            } catch (error) {

                console.error(
                    error
                );

                showAuthError(error);

            } finally {

                resendVerificationBtn.disabled =
                    false;

            }

        }
    );


    /* =====================================================
       MODAL BACKDROP
    ====================================================== */

    window.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                forgotModal
            ) {

                forgotModal.classList.add(
                    "hidden"
                );

            }

            if (
                event.target ===
                verifyModal
            ) {

                verifyModal.classList.add(
                    "hidden"
                );

            }

        }
    );


    /* =====================================================
       NETWORK
    ====================================================== */

    function updateNetworkStatus() {

        if (!networkBanner) {
            return;
        }

        if (navigator.onLine) {

            networkBanner.classList.add(
                "hidden"
            );

        } else {

            networkBanner.classList.remove(
                "hidden"
            );

            showToast(
                "No Internet Connection",
                "error"
            );

        }

    }


    window.addEventListener(
        "online",
        () => {

            updateNetworkStatus();

            showToast(
                "Internet Connected"
            );

        }
    );


    window.addEventListener(
        "offline",
        updateNetworkStatus
    );


    /* =====================================================
       RIPPLE
    ====================================================== */

    document
        .querySelectorAll("button")
        .forEach(button => {

            button.addEventListener(
                "click",
                function(event) {

                    const ripple =
                        document.createElement(
                            "span"
                        );

                    ripple.className =
                        "ripple";

                    const rect =
                        this.getBoundingClientRect();

                    ripple.style.left =
                        (
                            event.clientX -
                            rect.left
                        ) + "px";

                    ripple.style.top =
                        (
                            event.clientY -
                            rect.top
                        ) + "px";

                    this.appendChild(
                        ripple
                    );

                    setTimeout(
                        () => ripple.remove(),
                        600
                    );

                }
            );

        });


    /* =====================================================
       AUTH STATE
       Prevent duplicate redirect
    ====================================================== */

    loginAuth.onAuthStateChanged(
        async user => {

            if (
                !user ||
                authRedirecting
            ) {

                return;

            }

            try {

                await user.reload();

                /*
                  Verified email accounts can continue.
                  Google/Facebook/X accounts are normally
                  treated as verified by their provider.
                */

                if (
                    user.emailVerified ||
                    user.providerData?.some(
                        provider =>
                            provider.provider !==
                            "password"
                    )
                ) {

                    authRedirecting = true;

                    location.replace(
                        "index.html"
                    );

                }

            } catch (error) {

                console.warn(
                    "Auth state error:",
                    error
                );

            }

        }
    );


    /* =====================================================
       INITIALIZE
    ====================================================== */

    loadRememberedLogin();

    window.addEventListener(
        "load",
        () => {

            hideLoading();

            updateNetworkStatus();

            console.log(
                "================================"
            );

            console.log(
                "🚀 VIEWORA PREMIUM LOGIN READY"
            );

            console.log(
                "Email Login ✔"
            );

            console.log(
                "Google Login ✔"
            );

            console.log(
                "Facebook Login ✔"
            );

            console.log(
                "X Login ✔"
            );

            console.log(
                "Password Reset ✔"
            );

            console.log(
                "Email Verification ✔"
            );

            console.log(
                "Remember Me ✔"
            );

            console.log(
                "Network Status ✔"
            );

            console.log(
                "================================"
            );

        }
    );


})();