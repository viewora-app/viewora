/*=========================================
        VIEWORA SIGNUP
        signup.js - PART 1 (FIXED)
=========================================*/

"use strict";

/*=========================================
Global Error Handler
=========================================*/

window.onerror = function (message, source, line, col, error) {

    console.error(error || message);

    hideLoading();

    showToast("Something went wrong.", "error");

    return true;
};

/*=========================================
Firebase Check
=========================================*/

if (typeof firebase === "undefined") {
    throw new Error("Firebase SDK Missing");
}

if (typeof auth === "undefined") {
    throw new Error("Firebase Auth Missing");
}

if (typeof db === "undefined") {
    throw new Error("Realtime Database Missing");
}

/*=========================================
DOM Elements
=========================================*/

const signupForm = document.getElementById("signupForm");

const nameInput = document.getElementById("name");
const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");

const signupBtn = document.getElementById("signupBtn");
const googleSignup = document.getElementById("googleSignup");

const acceptTerms = document.getElementById("acceptTerms");

const usernameStatus = document.getElementById("usernameStatus");

const strengthFill = document.getElementById("strengthFill");
const strengthText = document.getElementById("strengthText");

const loading = document.getElementById("loadingOverlay");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
const toastIcon = document.getElementById("toastIcon");

const verifyModal = document.getElementById("verifyModal");

const openMailBtn = document.getElementById("openMailBtn");
const continueBtn = document.getElementById("continueBtn");

const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

/*=========================================
Variables
=========================================*/

let usernameAvailable = false;
let loadingState = false;
let usernameTimer = null;

/*=========================================
Loader
=========================================*/

function showLoading() {

    if (loadingState) return;

    loadingState = true;

    if (loading) {
        loading.classList.remove("hidden");
    }

    if (signupBtn) {
        signupBtn.disabled = true;
    }

}

function hideLoading() {

    loadingState = false;

    if (loading) {
        loading.classList.add("hidden");
    }

    if (signupBtn) {
        signupBtn.disabled = false;
    }

}

/*=========================================
Toast
=========================================*/

let toastTimer = null;

function showToast(message, type = "success") {

    if (!toast) {
        alert(message);
        return;
    }

    toastText.textContent = message;

    switch (type) {

        case "success":
            toastIcon.className = "fa-solid fa-circle-check";
            toastIcon.style.color = "#00d26a";
            break;

        case "error":
            toastIcon.className = "fa-solid fa-circle-xmark";
            toastIcon.style.color = "#ff4d4d";
            break;

        default:
            toastIcon.className = "fa-solid fa-circle-info";
            toastIcon.style.color = "#00aaff";

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

/*=========================================
Startup
=========================================*/

document.addEventListener("DOMContentLoaded", () => {

    hideLoading();

    console.log("================================");
    console.log("VIEWORA SIGNUP READY");
    console.log("Firebase :", !!firebase);
    console.log("Auth :", !!auth);
    console.log("Database :", !!db);
    console.log("================================");

});
/*=========================================
        VIEWORA SIGNUP
        signup.js - PART 2 (FIXED)
=========================================*/

/*=========================================
Password Toggle
=========================================*/

function togglePasswordField(input, button) {

    if (!input || !button) return;

    if (input.type === "password") {

        input.type = "text";
        button.innerHTML =
            '<i class="fa-solid fa-eye-slash"></i>';

    } else {

        input.type = "password";
        button.innerHTML =
            '<i class="fa-solid fa-eye"></i>';

    }

}

if (togglePassword) {

    togglePassword.addEventListener("click", () => {

        togglePasswordField(
            password,
            togglePassword
        );

    });

}

if (toggleConfirmPassword) {

    toggleConfirmPassword.addEventListener("click", () => {

        togglePasswordField(
            confirmPassword,
            toggleConfirmPassword
        );

    });

}

/*=========================================
Password Strength
=========================================*/

function updatePasswordStrength() {

    const value = password.value.trim();

    let score = 0;

    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(value)) score++;

    switch (score) {

        case 0:
        case 1:

            strengthFill.style.width = "25%";
            strengthFill.style.background = "#ff4d4d";
            strengthText.textContent = "Password Strength : Weak";

            break;

        case 2:

            strengthFill.style.width = "50%";
            strengthFill.style.background = "#ff9800";
            strengthText.textContent = "Password Strength : Medium";

            break;

        case 3:

            strengthFill.style.width = "75%";
            strengthFill.style.background = "#00aaff";
            strengthText.textContent = "Password Strength : Good";

            break;

        case 4:

            strengthFill.style.width = "100%";
            strengthFill.style.background = "#00d26a";
            strengthText.textContent = "Password Strength : Strong";

            break;

    }

}

if (password) {

    password.addEventListener(
        "input",
        updatePasswordStrength
    );

}

/*=========================================
Debounce Helper
=========================================*/

function debounce(callback, delay = 500) {

    return (...args) => {

        clearTimeout(usernameTimer);

        usernameTimer = setTimeout(() => {

            callback(...args);

        }, delay);

    };

}

/*=========================================
Username Availability
=========================================*/

const checkUsername = debounce(async () => {

    let value = username.value
        .trim()
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/[^a-z0-9_]/g, "");

    username.value = value;

    usernameAvailable = false;

    if (value.length < 3) {

        usernameStatus.textContent =
            "Minimum 3 characters";

        usernameStatus.style.color = "#ff9800";

        return;

    }

    usernameStatus.textContent = "Checking...";
    usernameStatus.style.color = "#00aaff";

    try {

        const snap = await db
            .ref("usernames/" + value)
            .once("value");

        if (snap.exists()) {

            usernameStatus.textContent =
                "❌ Username already taken";

            usernameStatus.style.color = "#ff4d4d";

            usernameAvailable = false;

        } else {

            usernameStatus.textContent =
                "✅ Username available";

            usernameStatus.style.color = "#00d26a";

            usernameAvailable = true;

        }

    } catch (error) {

        console.error(error);

        usernameStatus.textContent =
            "Unable to check username";

        usernameStatus.style.color = "#ff9800";

        usernameAvailable = false;

    }

}, 500);

if (username) {

    username.addEventListener(
        "input",
        checkUsername
    );

}

/*=========================================
Validation Helpers
=========================================*/

function validEmail(emailValue) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

}

function validUsername(usernameValue) {

    return /^[a-z0-9_]{3,20}$/.test(usernameValue);

}

console.log("✅ Signup Part 2 Loaded");
/*=========================================
        VIEWORA SIGNUP
        signup.js - PART 3 (FIXED)
        
/* Send verification email */

try {

    await user.sendEmailVerification();

    console.log("✅ Verification email sent successfully");

    hideLoading();

    showToast("Verification email sent.");

    if (verifyModal) {
        verifyModal.classList.remove("hidden");
    }

    await auth.signOut();

} catch (error) {

    console.error("Verification Error:", error);

    hideLoading();

    showToast(error.message, "error");

}
    } catch (error) {

        console.error(error);

        hideLoading();

        switch (error.code) {

            case "auth/email-already-in-use":
                showToast("Email already exists", "error");
                break;

            case "auth/invalid-email":
                showToast("Invalid email address", "error");
                break;

            case "auth/weak-password":
                showToast("Weak password", "error");
                break;

            case "auth/network-request-failed":
                showToast("Check your internet connection", "error");
                break;

            default:
                showToast(error.message, "error");

        }

    }

}
/*=========================================
Form Validation
=========================================*/

function validateForm() {

    const fullName = nameInput.value.trim();

    const userName = username.value
        .trim()
        .toLowerCase();

    const userEmail = email.value
        .trim()
        .toLowerCase();

    const userPassword = password.value;
    const confirm = confirmPassword.value;

    if (fullName.length < 2) {
        showToast("Enter your full name", "error");
        return null;
    }

    if (!validUsername(userName)) {
        showToast("Invalid username", "error");
        return null;
    }

    if (!usernameAvailable) {
    showToast("Please choose an available username.", "error");
    return null;
}

    if (!validEmail(userEmail)) {
        showToast("Invalid email address", "error");
        return null;
    }

    if (userPassword.length < 8) {
        showToast("Password must be at least 8 characters", "error");
        return null;
    }

    if (userPassword !== confirm) {
        showToast("Passwords do not match", "error");
        return null;
    }

    if (!acceptTerms.checked) {
        showToast("Accept Terms & Conditions", "error");
        return null;
    }

    return {
        fullName,
        userName,
        userEmail,
        userPassword
    };

}

/*=========================================
Signup Submit
=========================================*/

if (signupForm) {
    signupForm.addEventListener("submit", createAccount);
}

/*=========================================
Create Account
=========================================*/

async function createAccount(e) {

    e.preventDefault();

    if (loadingState) return;

    const form = validateForm();

    if (!form) return;

    showLoading();

    try {

        const result =
            await auth.createUserWithEmailAndPassword(
                form.userEmail,
                form.userPassword
            );

        const user = result.user;

        await db.ref("users/" + user.uid).set({

            uid: user.uid,

            name: form.fullName,

            username: form.userName,

            email: form.userEmail,

            photo: "assets/default-avatar.png",

            bio: "👋 Hello! I'm new on Viewora.",

            followers: 0,
            following: 0,
            posts: 0,
            likes: 0,

            verified: false,

            online: true,

            createdAt:
            firebase.database.ServerValue.TIMESTAMP,

            lastLogin:
            firebase.database.ServerValue.TIMESTAMP

        });

        await db.ref("usernames/" + form.userName).set({

            uid: user.uid

        });

        /* Send verification email immediately */

        await user.sendEmailVerification();

        await auth.signOut();

        hideLoading();

        showToast("Verification email sent.");

        if (verifyModal) {

            verifyModal.classList.remove("hidden");

        }

    } catch (error) {

        console.error(error);

        hideLoading();

        switch (error.code) {

            case "auth/email-already-in-use":
                showToast("Email already exists", "error");
                break;

            case "auth/invalid-email":
                showToast("Invalid email address", "error");
                break;

            case "auth/weak-password":
                showToast("Weak password", "error");
                break;

            case "auth/network-request-failed":
                showToast("Check your internet connection", "error");
                break;

            default:
                showToast(error.message, "error");

        }

    }

}

/*=========================================
Buttons
=========================================*/

if (continueBtn) {

    continueBtn.addEventListener("click", () => {

        location.replace("login.html");

    });

}

if (openMailBtn) {

    openMailBtn.addEventListener("click", () => {

        window.open(
            "https://mail.google.com",
            "_blank"
        );

    });

}

console.log("✅ Signup Part 3 Loaded");
/*=========================================
        VIEWORA SIGNUP
        signup.js - PART 4 (FIXED)
Google Signup • Online Status
=========================================*/

/*=========================================
Google Signup
=========================================*/

if (googleSignup) {

    googleSignup.addEventListener("click", googleSignUp);

}

async function googleSignUp() {

    if (loadingState) return;

    showLoading();

    try {

        const provider = new firebase.auth.GoogleAuthProvider();

        provider.setCustomParameters({
            prompt: "select_account"
        });

        const result =
        await auth.signInWithPopup(provider);

        const user = result.user;

        const userRef =
        db.ref("users/" + user.uid);

        const snap =
        await userRef.once("value");

        if (!snap.exists()) {

            let username =
            (user.email || "user")
            .split("@")[0]
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "");

            let finalUsername = username;
            let count = 1;

            while (true) {

                const check =
                await db.ref(
                    "usernames/" + finalUsername
                ).once("value");

                if (!check.exists()) break;

                finalUsername = username + count;
                count++;

            }

            await userRef.set({

                uid: user.uid,

                name: user.displayName || "Viewora User",

                username: finalUsername,

                email: user.email,

                photo:
                user.photoURL ||
                "assets/default-avatar.png",

                bio: "👋 Hello! I'm using Viewora.",

                followers: 0,
                following: 0,
                posts: 0,
                likes: 0,

                verified: true,

                online: true,

                createdAt:
                firebase.database.ServerValue.TIMESTAMP,

                lastLogin:
                firebase.database.ServerValue.TIMESTAMP

            });

            await db.ref(
                "usernames/" + finalUsername
            ).set({

                uid: user.uid

            });

        } else {

            await userRef.update({

                online: true,

                lastLogin:
                firebase.database.ServerValue.TIMESTAMP

            });

        }

        hideLoading();

        showToast("Welcome to Viewora 🎉");

        setTimeout(() => {

            location.replace("index.html");

        }, 1000);

    }

    catch (error) {

        console.error(error);

        hideLoading();

        switch (error.code) {

            case "auth/popup-closed-by-user":
                showToast(
                    "Google Sign-in cancelled",
                    "error"
                );
                break;

            case "auth/network-request-failed":
                showToast(
                    "Check your internet connection",
                    "error"
                );
                break;

            default:
                showToast(
                    error.message,
                    "error"
                );

        }

    }

}

/*=========================================
Online Status
=========================================*/

auth.onAuthStateChanged(async user => {

    if (!user) return;

    const ref =
    db.ref("users/" + user.uid);

    await ref.update({

        online: true,

        lastLogin:
        firebase.database.ServerValue.TIMESTAMP

    });

const onlineRef = db.ref("users/" + user.uid + "/online");

onlineRef.onDisconnect().set(false).catch(error => {
    console.error("onDisconnect Error:", error);
});

});

/*=========================================
Auto Redirect
=========================================*/

auth.onAuthStateChanged(user => {

    if (!user) return;

    if (
        user.providerData[0].providerId === "google.com" ||
        user.emailVerified
    ) {

        location.replace("index.html");

    }

});

/*=========================================
Ripple Effect
=========================================*/

document.querySelectorAll(
".signupBtn,.googleBtn"
).forEach(btn => {

    btn.addEventListener("click", function (e) {

        const ripple =
        document.createElement("span");

        ripple.className = "ripple";

        const rect =
        this.getBoundingClientRect();

        ripple.style.left =
        (e.clientX - rect.left) + "px";

        ripple.style.top =
        (e.clientY - rect.top) + "px";

        this.appendChild(ripple);

        setTimeout(() => {

            ripple.remove();

        }, 600);

    });

});

console.log("================================");
console.log("🚀 VIEWORA SIGNUP READY");
console.log("Version : 2.0 FIXED");
console.log("================================");
/*=========================================
        VIEWORA SIGNUP
        signup.js - PART 5 (FINAL)
Cleanup • BeforeUnload • Utilities
=========================================*/

/*=========================================
Reset Form After Success
=========================================*/

function resetSignupForm() {

    if (!signupForm) return;

    signupForm.reset();

    usernameAvailable = false;

    if (usernameStatus) {

        usernameStatus.textContent =
        "Username must be unique";

        usernameStatus.style.color = "#9fb7ff";

    }

    if (strengthFill) {

        strengthFill.style.width = "25%";
        strengthFill.style.background = "#ff4d4d";

    }

    if (strengthText) {

        strengthText.textContent =
        "Password Strength : Weak";

    }

}

/*=========================================
Close Verify Modal
=========================================*/

if (verifyModal) {

    verifyModal.addEventListener("click", e => {

        if (e.target === verifyModal) {

            verifyModal.classList.add("hidden");

        }

    });

}

/*=========================================
Escape Key Support
=========================================*/

document.addEventListener("keydown", e => {

    if (e.key === "Escape" && verifyModal) {

        verifyModal.classList.add("hidden");

    }

});

/*=========================================
Network Status
=========================================*/

window.addEventListener("offline", () => {

    showToast(
        "No Internet Connection",
        "error"
    );

});

window.addEventListener("online", () => {

    showToast(
        "Internet Connected"
    );

});

/*=========================================
Version
=========================================*/

console.log("================================");
console.log("VIEWORA SIGNUP");
console.log("Version : 2.0 FINAL");
console.log("================================");