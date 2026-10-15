/*==========================================================
        VIEWORA V12 PREMIUM
        signup.js
        FINAL • FIREBASE COMPATIBLE

        IMPORTANT:
        auth          → firebase.js
        db            → firebase.js
        googleProvider → firebase.js
        vieworaServerTime   → firebase.js
        usernamesRef  → firebase.js
==========================================================*/

"use strict";

/*==========================================================
  1. FIREBASE CHECK
==========================================================*/

if (typeof firebase === "undefined") {
    throw new Error("Firebase SDK Missing");
}

/*
 * firebase.js already declares: auth, db, usernamesRef, safeWrite,
 * safeUpdate, vieworaServerTime (let/const). NEVER redeclare those names.
 * Only use unique local aliases below.
 */
var vieworaAuth = (typeof window.auth !== "undefined" && window.auth)
    ? window.auth
    : firebase.auth();
var vieworaDb = (typeof window.db !== "undefined" && window.db)
    ? window.db
    : firebase.database();

if (!vieworaAuth) throw new Error("Firebase Auth Missing");
if (!vieworaDb) throw new Error("Realtime Database Missing");

var vieworaUsernamesRef = (typeof window.usernamesRef === "function")
    ? window.usernamesRef
    : function (u) {
        return vieworaDb.ref("usernames/" + String(u || "").toLowerCase());
      };

var vieworaSafeWrite = (typeof window.safeWrite === "function")
    ? window.safeWrite
    : async function (path, data) {
        await vieworaDb.ref(path).set(data);
      };

var vieworaSafeUpdate = (typeof window.safeUpdate === "function")
    ? window.safeUpdate
    : async function (path, data) {
        await vieworaDb.ref(path).update(data);
      };

var vieworaServerTime = (window.SERVER_TIME != null)
    ? window.SERVER_TIME
    : firebase.database.ServerValue.TIMESTAMP;



/*==========================================================
  2. DOM ELEMENTS
==========================================================*/

const signupForm =
    document.getElementById("signupForm");

const nameInput =
    document.getElementById("name");

const usernameInput =
    document.getElementById("username");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const confirmPasswordInput =
    document.getElementById("confirmPassword");

const signupBtn =
    document.getElementById("signupBtn");

const googleSignupBtn =
    document.getElementById("googleSignup");

const togglePassword =
    document.getElementById("togglePassword");

const toggleConfirmPassword =
    document.getElementById("toggleConfirmPassword");

const usernameStatus =
    document.getElementById("usernameStatus");

const strengthFill =
    document.getElementById("strengthFill");

const strengthText =
    document.getElementById("strengthText");

const loadingOverlay =
    document.getElementById("loadingOverlay");

const toast =
    document.getElementById("toast");

const toastIcon =
    document.getElementById("toastIcon");

const toastText =
    document.getElementById("toastText");

const verifyModal =
    document.getElementById("verifyModal");

const openMailBtn =
    document.getElementById("openMailBtn");

const continueBtn =
    document.getElementById("continueBtn");

const acceptTerms =
    document.getElementById("acceptTerms");


/*==========================================================
  3. STATE
==========================================================*/

let loading = false;
let usernameAvailable = false;

let usernameTimer = null;
let toastTimer = null;


/*==========================================================
  4. LOADING
==========================================================*/

function showLoading(message = "Creating your Viewora account...") {

    loading = true;

    if (loadingOverlay) {

        loadingOverlay.classList.remove("hidden");

        const loadingText =
            loadingOverlay.querySelector(
                ".loadingText"
            );

        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    if (signupBtn) {
        signupBtn.disabled = true;
    }

    if (googleSignupBtn) {
        googleSignupBtn.disabled = true;
    }
}


function hideLoading() {

    loading = false;

    if (loadingOverlay) {
        loadingOverlay.classList.add("hidden");
    }

    if (signupBtn) {
        signupBtn.disabled = false;
    }

    if (googleSignupBtn) {
        googleSignupBtn.disabled = false;
    }
}


/*==========================================================
  5. TOAST
==========================================================*/

function showToast(
    message,
    type = "success"
) {

    if (!toast) return;

    if (toastText) {
        toastText.textContent = message;
    }

    if (toastIcon) {

        if (type === "success") {

            toastIcon.className =
                "fa-solid fa-circle-check";

        } else {

            toastIcon.className =
                "fa-solid fa-circle-xmark";
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

        }, 300);

    }, 3000);
}


/*==========================================================
  6. PASSWORD VISIBILITY
==========================================================*/

function togglePasswordField(input, button) {
    if (!input || !button) return;
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    button.innerHTML = show
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
}

function bindPasswordToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        togglePasswordField(input, btn);
    });
}

bindPasswordToggle(togglePassword, passwordInput);
bindPasswordToggle(toggleConfirmPassword, confirmPasswordInput);


/*==========================================================
  7. VALIDATION HELPERS
==========================================================*/

function validEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}


function validUsername(username) {

    return /^[a-z0-9_]{3,20}$/
        .test(username);
}


/*==========================================================
  8. PASSWORD STRENGTH
==========================================================*/

function updatePasswordStrength() {

    if (!passwordInput) return;

    const password =
        passwordInput.value;

    let score = 0;

    if (password.length >= 8)
        score++;

    if (/[A-Z]/.test(password))
        score++;

    if (/[a-z]/.test(password))
        score++;

    if (/[0-9]/.test(password))
        score++;

    if (
        /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/
            .test(password)
    ) {
        score++;
    }

    let width = "0%";
    let text = "Password Strength: Weak";

    if (score === 1) {

        width = "20%";
        text = "Password Strength: Weak";

    } else if (score === 2) {

        width = "40%";
        text = "Password Strength: Medium";

    } else if (score === 3) {

        width = "60%";
        text = "Password Strength: Good";

    } else if (score === 4) {

        width = "80%";
        text = "Password Strength: Strong";

    } else if (score === 5) {

        width = "100%";
        text = "Password Strength: Very Strong";
    }

    if (strengthFill) {

        strengthFill.style.width =
            width;
    }

    if (strengthText) {

        strengthText.textContent =
            text;
    }
}


passwordInput?.addEventListener(
    "input",
    updatePasswordStrength
);


/*==========================================================
  9. USERNAME AVAILABILITY
==========================================================*/

async function checkUsernameAvailability() {

    if (!usernameInput)
        return;

    let username =
        usernameInput.value
            .trim()
            .toLowerCase()
            .replace(/^@/, "")
            .replace(/[^a-z0-9_]/g, "");

    usernameInput.value =
        username;

    usernameAvailable = false;

    if (username.length < 3) {

        if (usernameStatus) {
            usernameStatus.textContent = "Minimum 3 characters required";
            usernameStatus.style.color = "#f59e0b";
        }

        return;
    }

    if (!validUsername(username)) {

        if (usernameStatus) {
            usernameStatus.textContent = "Only letters, numbers and _ allowed";
            usernameStatus.style.color = "#f59e0b";
        }

        return;
    }

    if (usernameStatus) {
        usernameStatus.textContent = "Checking username...";
        usernameStatus.style.color = "#9ca3af";
    }

    try {
        // Always use direct DB path (do not depend on firebase.js helper)
        // usernames/{name} MUST be publicly readable in Firebase rules
        var ref = vieworaDb.ref("usernames/" + username);
        var snapshot = await ref.once("value");

        if (snapshot.exists()) {
            usernameAvailable = false;
            if (usernameStatus) {
                usernameStatus.textContent = "❌ Username already taken";
                usernameStatus.style.color = "#ff4d67";
            }
        } else {
            usernameAvailable = true;
            if (usernameStatus) {
                usernameStatus.textContent = "✅ Username available";
                usernameStatus.style.color = "#00d26a";
            }
        }
        if (typeof updateSignupButton === "function") updateSignupButton();

    } catch (error) {
        console.error("Username check error:", error && (error.code || error.message || error));

        usernameAvailable = false;

        var msg = "Unable to check username";
        var code = String((error && error.code) || "");
        if (code.indexOf("PERMISSION_DENIED") !== -1 || code === "PERMISSION_DENIED") {
            msg = "⚠️ Username check blocked (Firebase rules) — fix usernames/.read";
        } else if (code.indexOf("network") !== -1 || !navigator.onLine) {
            msg = "No internet — cannot check username";
        }

        if (usernameStatus) {
            usernameStatus.textContent = msg;
            usernameStatus.style.color = "#ff4d67";
        }
        if (typeof updateSignupButton === "function") updateSignupButton();
    }
}


usernameInput?.addEventListener(
    "input",
    () => {

        clearTimeout(usernameTimer);

        usernameAvailable = false;

        usernameTimer =
            setTimeout(
                checkUsernameAvailability,
                500
            );
    }
);


/*==========================================================
  10. FORM VALIDATION
==========================================================*/

function validateForm() {

    const fullName =
        nameInput?.value
            .trim() || "";

    const username =
        usernameInput?.value
            .trim()
            .toLowerCase() || "";

    const email =
        emailInput?.value
            .trim()
            .toLowerCase() || "";

    const password =
        passwordInput?.value || "";

    const confirmPassword =
        confirmPasswordInput?.value || "";


    if (fullName.length < 2) {

        showToast(
            "Enter your full name",
            "error"
        );

        nameInput?.focus();

        return null;
    }


    if (!validUsername(username)) {

        showToast(
            "Invalid username",
            "error"
        );

        usernameInput?.focus();

        return null;
    }


    if (!usernameAvailable) {

        showToast(
            "Please choose an available username",
            "error"
        );

        usernameInput?.focus();

        return null;
    }


    if (!validEmail(email)) {

        showToast(
            "Enter a valid email address",
            "error"
        );

        emailInput?.focus();

        return null;
    }


    if (password.length < 8) {

        showToast(
            "Password must be at least 8 characters",
            "error"
        );

        passwordInput?.focus();

        return null;
    }


    if (password !== confirmPassword) {

        showToast(
            "Passwords do not match",
            "error"
        );

        confirmPasswordInput?.focus();

        return null;
    }


    if (
        acceptTerms &&
        !acceptTerms.checked
    ) {

        showToast(
            "Please accept Terms & Conditions",
            "error"
        );

        return null;
    }


    return {

        fullName,
        username,
        email,
        password

    };
}


/*==========================================================
  11. CREATE DEFAULT DATA
==========================================================*/

async function saveNewUser(
    user,
    data
) {

    const userData = {

        uid: user.uid,

        name: data.fullName,

        fullName: data.fullName,

        username: data.username,

        email: data.email,

        profilePhoto:
            "assets/default-avatar.png",

        coverPhoto:
            "assets/default-banner.jpg",

        bio:
            "Welcome to Viewora 🚀",

        verified: false,

        emailVerified:
            user.emailVerified,

        accountType:
            "creator",

        followers: 0,

        following: 0,

        posts: 0,

        videos: 0,

        shorts: 0,

        likes: 0,

        views: 0,

        subscribers: 0,

        online: true,

        createdAt:
            vieworaServerTime,

        lastLogin:
            vieworaServerTime,

        lastSeen:
            vieworaServerTime,

        onboardingComplete: false,

        ageVerified: false
    };


    await vieworaSafeWrite(
        "users/" + user.uid,
        userData
    );


    await vieworaSafeWrite(
        "settings/" + user.uid,
        {

            theme: "dark",

            language: "en",

            autoplay: true,

            notifications: true,

            privateAccount: false,

            showEmail: false,

            showOnlineStatus: true,

            showFollowers: true,

            allowMessages: true,

            downloadQuality: "HD"
        }
    );


    const collections = [

        "followers",

        "following",

        "notifications",

        "savedPosts",

        "history",

        "likes",

        "searchHistory"

    ];


    await Promise.all(

        collections.map(
            collection =>
                vieworaSafeWrite(
                    collection +
                    "/" +
                    user.uid,
                    {}
                )
        )
    );


    return true;
}


/*==========================================================
  12. EMAIL SIGNUP
==========================================================*/

async function createAccount(event) {

    if (event) {
        event.preventDefault();
    }

    if (loading)
        return;


    const data =
        validateForm();

    if (!data)
        return;


    showLoading(
        "Creating your Viewora account..."
    );


    let createdUser = null;


    try {

        /*------------------------------------------
          Create Firebase Auth Account
        ------------------------------------------*/

        const credential =
            await vieworaAuth.createUserWithEmailAndPassword(
                    data.email,
                    data.password
                );


        createdUser =
            credential.user;


        /*------------------------------------------
          Firebase Profile
        ------------------------------------------*/

        await createdUser.updateProfile({

            displayName:
                data.fullName,

            photoURL:
                "assets/default-avatar.png"

        });


        /*------------------------------------------
          Reserve Username
        ------------------------------------------*/

        const usernameSnapshot =
            await vieworaUsernamesRef(
                data.username
            ).once("value");


        if (usernameSnapshot.exists()) {

            throw new Error(
                "Username was just taken. Please choose another."
            );
        }


        await vieworaSafeWrite(
            "usernames/" + data.username,
            createdUser.uid
        );


        /*------------------------------------------
          Save User Data
        ------------------------------------------*/

        await saveNewUser(
            createdUser,
            data
        );


        /*------------------------------------------
          Verification Email
        ------------------------------------------*/

        await createdUser
            .sendEmailVerification();

        try {
            if (window.VieworaAccounts && typeof VieworaAccounts.saveCredentials === "function") {
                VieworaAccounts.saveCredentials(data.email, data.password, createdUser.uid);
            }
        } catch (_) {}

        hideLoading();

        showToast(
            "Account created successfully"
        );

        try { localStorage.removeItem("viewora_onboarding_done"); } catch (_) {}

        /* Show verify modal + always allow Continue → onboarding */
        if (verifyModal) {
            verifyModal.classList.remove("hidden");
            verifyModal.setAttribute("aria-hidden", "false");
            // Safety: auto-continue after 12s if user doesn't click
            setTimeout(function () {
                if (verifyModal && !verifyModal.classList.contains("hidden")) {
                    window.location.href = "onboarding.html";
                }
            }, 12000);
        } else {
            setTimeout(function () {
                window.location.href = "onboarding.html";
            }, 700);
        }


    } catch (error) {

        console.error(
            "Signup error:",
            error
        );


        /*
         * Do not automatically delete an Auth
         * account here because database operations
         * may fail independently.
         */

        hideLoading();


        let message =
            "Signup failed";


        switch (error.code) {

            case "auth/email-already-in-use":

                message =
                    "Email is already registered";

                break;


            case "auth/invalid-email":

                message =
                    "Invalid email address";

                break;


            case "auth/weak-password":

                message =
                    "Password is too weak";

                break;


            case "auth/network-request-failed":

                message =
                    "No Internet Connection";

                break;


            case "auth/operation-not-allowed":

                message =
                    "Email signup is disabled in Firebase";

                break;


            default:

                message =
                    error.message ||
                    "Signup failed";
        }


        showToast(
            message,
            "error"
        );
    }
}


signupForm?.addEventListener(
    "submit",
    createAccount
);


/*==========================================================
  13. GOOGLE SIGNUP / LOGIN
==========================================================*/


/* Social signup removed by request */

/*==========================================================
  14. EMAIL VERIFICATION MODAL
==========================================================*/

openMailBtn?.addEventListener(
    "click",
    () => {

        window.open(
            "https://mail.google.com",
            "_blank"
        );

    }
);


continueBtn?.addEventListener(
    "click",
    async function () {
        var user = vieworaAuth.currentUser;
        if (!user) {
            showToast("Please sign in again", "error");
            return;
        }

        continueBtn.disabled = true;
        try {
            await user.reload();
            if (user.emailVerified) {
                try {
                    await vieworaSafeUpdate("users/" + user.uid, {
                        emailVerified: true,
                        online: true,
                        lastLogin: vieworaServerTime
                    });
                } catch (_) {}
                showToast("Email verified — continuing setup");
            } else {
                showToast("Continuing setup — verify email anytime");
            }
        } catch (error) {
            console.warn("verify check", error);
            showToast("Continuing to setup…");
        }

        try { localStorage.removeItem("viewora_onboarding_done"); } catch (_) {}

        // Always leave signup — onboarding required for new accounts
        setTimeout(function () {
            window.location.href = "onboarding.html";
        }, 400);
    }
);

/* Auto-open setup if modal is showing and user clicks overlay (optional safety) */
verifyModal?.querySelector(".modalOverlay")?.addEventListener("click", function () {
    /* do not close — force explicit Continue */
});


/*==========================================================
  15. EMAIL VERIFICATION CHECK
==========================================================*/

async function checkEmailVerification() {

    const user =
        vieworaAuth.currentUser;


    if (!user)
        return false;


    try {

        await user.reload();


        if (
            user.emailVerified
        ) {

            await vieworaSafeUpdate(

                "users/" +
                user.uid,

                {

                    emailVerified: true
                }
            );


            return true;
        }


    } catch (error) {

        console.error(
            "Verification check:",
            error
        );
    }


    return false;
}


document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            await checkEmailVerification();
        }
    }
);


/*==========================================================
  16. AUTO FORMAT
==========================================================*/

usernameInput?.addEventListener(
    "input",
    () => {

        let value =
            usernameInput.value
                .toLowerCase()
                .replace(/\s+/g, "")
                .replace(/^@/, "")
                .replace(
                    /[^a-z0-9_]/g,
                    ""
                )
                .substring(0, 20);


        usernameInput.value =
            value;
    }
);


emailInput?.addEventListener(
    "blur",
    () => {

        emailInput.value =
            emailInput.value
                .trim()
                .toLowerCase();
    }
);


nameInput?.addEventListener(
    "blur",
    () => {

        const words =
            nameInput.value
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map(
                    word =>
                        word.charAt(0)
                            .toUpperCase() +
                        word.slice(1)
                            .toLowerCase()
                );


        nameInput.value =
            words.join(" ");
    }
);


/*==========================================================
  17. CONFIRM PASSWORD
==========================================================*/

confirmPasswordInput?.addEventListener(
    "input",
    () => {

        if (
            !confirmPasswordInput.value
        ) {

            confirmPasswordInput
                .classList.remove(
                    "passwordMatch",
                    "passwordMismatch"
                );

            return;
        }


        if (
            passwordInput.value ===
            confirmPasswordInput.value
        ) {

            confirmPasswordInput
                .classList.add(
                    "passwordMatch"
                );

            confirmPasswordInput
                .classList.remove(
                    "passwordMismatch"
                );

        } else {

            confirmPasswordInput
                .classList.add(
                    "passwordMismatch"
                );

            confirmPasswordInput
                .classList.remove(
                    "passwordMatch"
                );
        }
    }
);


/*==========================================================
  18. SIGNUP BUTTON STATE
==========================================================*/

function updateSignupButton() {

    if (!signupBtn)
        return;


    const ready =

        nameInput?.value.trim() !== "" &&

        usernameInput?.value.trim().length >= 3 &&

        usernameAvailable === true &&

        emailInput?.value.trim() !== "" &&

        passwordInput?.value !== "" &&

        confirmPasswordInput?.value !== "" &&

        (
            !acceptTerms ||
            acceptTerms.checked
        );


    signupBtn.disabled =
        !ready;
}


[
    nameInput,
    usernameInput,
    emailInput,
    passwordInput,
    confirmPasswordInput
].forEach(input => {

    input?.addEventListener(
        "input",
        updateSignupButton
    );

});


acceptTerms?.addEventListener(
    "change",
    updateSignupButton
);


/*==========================================================
  19. RIPPLE
==========================================================*/

document
    .querySelectorAll("button")
    .forEach(button => {

        button.addEventListener(
            "click",
            function (event) {

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
                    () => {

                        ripple.remove();

                    },
                    600
                );
            }
        );
    });


/*==========================================================
  20. NETWORK STATUS
==========================================================*/

function updateNetworkStatus() {

    if (!navigator.onLine) {

        showToast(
            "No Internet Connection",
            "error"
        );

    }
}


window.addEventListener(
    "offline",
    updateNetworkStatus
);


/*==========================================================
  21. AUTH STATE
==========================================================*/

vieworaAuth.onAuthStateChanged(
    async user => {

        if (!user) {

            return;
        }


        try {

            await user.reload();


            if (
                user.emailVerified
            ) {

                await vieworaSafeUpdate(

                    "users/" +
                    user.uid,

                    {

                        online: true,

                        emailVerified:
                            true,

                        lastLogin:
                            vieworaServerTime
                    }
                );
            }

        } catch (error) {

            console.error(
                "Auth state error:",
                error
            );
        }
    }
);


/*==========================================================
  22. PAGE STARTUP
==========================================================*/

window.addEventListener(
    "load",
    () => {

        hideLoading();

        updatePasswordStrength();

        updateSignupButton();


        console.log(
            "================================"
        );

        console.log(
            "🚀 VIEWORA V12 SIGNUP READY"
        );

        console.log(
            "✅ Firebase Auth"
        );

        console.log(
            "✅ Email Signup"
        );

        console.log(
            "✅ Google Signup"
        );

        console.log(
            "✅ Username System"
        );

        console.log(
            "✅ Password Strength"
        );

        console.log(
            "✅ Email Verification"
        );

        console.log(
            "================================"
        );
    }
);


/*==========================================================
  23. GLOBAL EXPORTS
==========================================================*/

window.showLoading =
    showLoading;

window.hideLoading =
    hideLoading;

window.showToast =
    showToast;

window.checkEmailVerification =
    checkEmailVerification;

window.updatePasswordStrength =
    updatePasswordStrength;

window.resetSignupForm =
    function () {

        signupForm?.reset();

        usernameAvailable =
            false;

        if (strengthFill) {

            strengthFill.style.width =
                "0%";
        }

        if (strengthText) {

            strengthText.textContent =
                "Password Strength: Weak";
        }

        if (usernameStatus) {

            usernameStatus.textContent =
                "Username must be unique";
        }

        updateSignupButton();
    };





console.log("✅ Viewora signup.js loaded successfully");
