/* =========================================================
VIEWORA • ACCOUNT SETTINGS
Premium Account Management
========================================================= */

(function () {

"use strict";

let currentUser = null;
let originalData = {};

/* =====================================================
   DOM READY
===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    console.log(
        "%cVIEWORA ACCOUNT SETTINGS READY",
        "color:#00c6ff;font-size:16px;font-weight:800"
    );

    initAccountSettings();

});


/* =====================================================
   FIREBASE AUTH
===================================================== */

function initAccountSettings() {

    if (
        typeof firebase === "undefined" ||
        typeof auth === "undefined" ||
        typeof db === "undefined"
    ) {

        console.error(
            "Firebase/Auth/Database is not available."
        );

        showToast(
            "❌ Firebase connection unavailable",
            "error"
        );

        return;

    }


    auth.onAuthStateChanged(function (user) {

        if (!user) {

            console.warn(
                "No authenticated user."
            );

            window.location.href = "login.html";

            return;

        }


        currentUser = user;


        console.log(
            "Viewora User Authenticated:",
            user.uid
        );


        loadAccountData(user);

    });

}


/* =====================================================
   LOAD ACCOUNT DATA
===================================================== */

async function loadAccountData(user) {

    try {

        const snapshot = await db
            .ref("users/" + user.uid)
            .once("value");


        const data = snapshot.exists()
            ? snapshot.val()
            : {};


        originalData = {

            email:
                user.email ||
                data.email ||
                "",

            phone:
                data.phone ||
                "",

            birthday:
                data.birthday ||
                ""

        };


        /* Email */

        const emailInput =
            document.getElementById("email");

        if (emailInput) {

            emailInput.value =
                originalData.email;

        }


        /* Phone */

        const phoneInput =
            document.getElementById("phone");

        if (phoneInput) {

            phoneInput.value =
                originalData.phone;

        }


        /* Birthday */

        const birthdayInput =
            document.getElementById("birthday");

        if (birthdayInput) {

            birthdayInput.value =
                normalizeBirthday(
                    originalData.birthday
                );

        }


        updateVerificationStatus(user);


        console.log(
            "Account profile loaded"
        );

    }

    catch (error) {

        console.error(
            "Account loading error:",
            error
        );

        showToast(
            "❌ Could not load account",
            "error"
        );

    }

}


/* =====================================================
   BIRTHDAY NORMALIZER
===================================================== */

function normalizeBirthday(value) {

    if (!value) return "";

    /*
     Supports:
     YYYY-MM-DD
     DD/MM/YYYY
     DD-MM-YYYY
    */

    if (
        /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {

        return value;

    }


    if (
        /^\d{2}\/\d{2}\/\d{4}$/.test(value)
    ) {

        const parts =
            value.split("/");

        return (
            parts[2] +
            "-" +
            parts[1] +
            "-" +
            parts[0]
        );

    }


    if (
        /^\d{2}-\d{2}-\d{4}$/.test(value)
    ) {

        const parts =
            value.split("-");

        return (
            parts[2] +
            "-" +
            parts[1] +
            "-" +
            parts[0]
        );

    }


    return value;

}


/* =====================================================
   SAVE ACCOUNT
   FIXES:
   saveAccount is not defined
===================================================== */

window.saveAccount = async function () {

    if (!currentUser) {

        showToast(
            "❌ Please login first",
            "error"
        );

        return;

    }


    const emailInput =
        document.getElementById("email");

    const phoneInput =
        document.getElementById("phone");

    const birthdayInput =
        document.getElementById("birthday");


    const email =
        emailInput
            ? emailInput.value.trim()
            : "";


    const phone =
        phoneInput
            ? phoneInput.value.trim()
            : "";


    const birthday =
        birthdayInput
            ? birthdayInput.value
            : "";


    /* Email validation */

    if (!email) {

        showToast(
            "📧 Enter your email",
            "error"
        );

        return;

    }


    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!emailPattern.test(email)) {

        showToast(
            "❌ Enter a valid email",
            "error"
        );

        return;

    }


    try {

        showToast(
            "⏳ Saving changes..."
        );


        /*
         * Update Realtime Database
         */

        await db
            .ref("users/" + currentUser.uid)
            .update({

                email: email,
                phone: phone,
                birthday: birthday

            });


        /*
         * Update Firebase Authentication email
         * only if it changed.
         */

        if (
            currentUser.email &&
            currentUser.email !== email
        ) {

            try {

                await currentUser.updateEmail(
                    email
                );


            }
            catch (emailError) {

                console.warn(
                    "Authentication email update failed:",
                    emailError
                );


                /*
                 * Firebase may require
                 * recent authentication.
                 */

                showToast(
                    "⚠️ Re-login required to change email",
                    "error"
                );

                return;

            }

        }


        originalData = {

            email: email,
            phone: phone,
            birthday: birthday

        };


        showToast(
            "✅ Account updated successfully"
        );


        updateVerificationStatus(
            currentUser
        );

    }

    catch (error) {

        console.error(
            "Save account error:",
            error
        );


        showToast(
            "❌ " +
            getFirebaseErrorMessage(error),
            "error"
        );

    }

};


/* =====================================================
   RESET ACCOUNT
   FIXES:
   resetAccount is not defined
===================================================== */

window.resetAccount = function () {

    const emailInput =
        document.getElementById("email");

    const phoneInput =
        document.getElementById("phone");

    const birthdayInput =
        document.getElementById("birthday");


    if (emailInput) {

        emailInput.value =
            originalData.email || "";

    }


    if (phoneInput) {

        phoneInput.value =
            originalData.phone || "";

    }


    if (birthdayInput) {

        birthdayInput.value =
            normalizeBirthday(
                originalData.birthday || ""
            );

    }


    showToast(
        "↩️ Changes reset"
    );

};


/* =====================================================
   CHANGE PASSWORD
===================================================== */

window.changePassword = async function () {

    if (!currentUser) {

        showToast(
            "❌ Please login first",
            "error"
        );

        return;

    }


    if (!currentUser.email) {

        showToast(
            "❌ No email linked to this account",
            "error"
        );

        return;

    }


    try {

        await auth.sendPasswordResetEmail(
            currentUser.email
        );


        showToast(
            "📧 Password reset email sent"
        );

    }

    catch (error) {

        console.error(
            "Password reset error:",
            error
        );


        showToast(
            "❌ " +
            getFirebaseErrorMessage(error),
            "error"
        );

    }

};


/* =====================================================
   EMAIL VERIFICATION
===================================================== */

window.verifyEmail = async function () {

    if (!currentUser) {

        showToast(
            "❌ Please login first",
            "error"
        );

        return;

    }


    /*
     Refresh Firebase user state.
     */

    try {

        await currentUser.reload();

    }
    catch (error) {

        console.warn(
            "User reload failed:",
            error
        );

    }


    if (currentUser.emailVerified) {

        showToast(
            "✅ Email already verified"
        );

        updateVerificationStatus(
            currentUser
        );

        return;

    }


    try {

        await currentUser.sendEmailVerification();


        showToast(
            "📧 Verification email sent"
        );


    }
    catch (error) {

        console.error(
            "Verification error:",
            error
        );


        showToast(
            "❌ " +
            getFirebaseErrorMessage(error),
            "error"
        );

    }

};


/* =====================================================
   VERIFICATION STATUS
===================================================== */

function updateVerificationStatus(user) {

    const text =
        document.getElementById(
            "verificationText"
        );


    const badge =
        document.getElementById(
            "verificationBadge"
        );


    const emailStatus =
        document.getElementById(
            "emailStatus"
        );


    if (!user) return;


    if (user.emailVerified) {

        if (text) {

            text.textContent =
                "Your email address is verified";

        }


        if (badge) {

            badge.textContent =
                "✓ Verified";

            badge.classList.add(
                "verified"
            );

        }


        if (emailStatus) {

            emailStatus.textContent =
                "✓ Verified email address";

        }

    }

    else {

        if (text) {

            text.textContent =
                "Your email address is not verified";

        }


        if (badge) {

            badge.textContent =
                "Verify";

            badge.classList.remove(
                "verified"
            );

        }


        if (emailStatus) {

            emailStatus.textContent =
                "⚠ Email verification required";

        }

    }

}


/* =====================================================
   BACK
===================================================== */

window.goBack = function () {

    if (
        document.referrer &&
        document.referrer !== location.href
    ) {

        history.back();

    }
    else {

        window.location.href =
            "settings.html";

    }

};


/* =====================================================
   FIREBASE ERROR MESSAGE
===================================================== */

function getFirebaseErrorMessage(error) {

    if (!error) {

        return "Something went wrong";

    }


    const code =
        error.code || "";


    switch (code) {

        case "auth/invalid-email":

            return "Invalid email address";


        case "auth/email-already-in-use":

            return "This email is already in use";


        case "auth/requires-recent-login":

            return "Please login again and try";


        case "auth/too-many-requests":

            return "Too many attempts. Try again later";


        case "auth/network-request-failed":

            return "Network error. Check your internet";


        case "permission-denied":

            return "Database permission denied";


        default:

            return (
                error.message ||
                "Something went wrong"
            );

    }

}


/* =====================================================
   TOAST
===================================================== */

window.showToast = function (
    message,
    type = "success"
) {

    const toast =
        document.getElementById(
            "vieworaToast"
        );


    const toastMessage =
        document.getElementById(
            "toastMessage"
        );


    const toastIcon =
        document.getElementById(
            "toastIcon"
        );


    if (!toast) {

        console.log(
            message
        );

        return;

    }


    if (toastMessage) {

        toastMessage.textContent =
            message;

    }


    if (toastIcon) {

        toastIcon.textContent =
            type === "error"
                ? "!"
                : "✓";

    }


    toast.classList.remove(
        "show",
        "error"
    );


    if (type === "error") {

        toast.classList.add(
            "error"
        );

    }


    requestAnimationFrame(() => {

        toast.classList.add(
            "show"
        );

    });


    clearTimeout(
        window.__vieworaToastTimer
    );


    window.__vieworaToastTimer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 2800);

};


/* =====================================================
   AUTO HIDE / PAGE READY
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        document.body.classList.add(
            "page-ready"
        );

    }
);

})();