"use strict";

/* =========================================================
   VIEWORA • EDIT PROFILE JS
   Profile Photo • Banner • Name • Username • URL
   Gender • Bio • Firebase Realtime Database
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    console.log("🚀 Viewora Edit Profile JS Started");

    /* =====================================================
       DOM
    ===================================================== */

    const profilePhotoButton =
        document.getElementById("profilePhotoButton");

    const profilePhotoInput =
        document.getElementById("profilePhotoInput");

    const profilePreview =
        document.getElementById("profilePreview");

    const bannerArea =
        document.getElementById("bannerArea");

    const bannerInput =
        document.getElementById("bannerInput");

    const bannerPreview =
        document.getElementById("bannerPreview");

    const nameInput =
        document.getElementById("nameInput");

    const usernameInput =
        document.getElementById("usernameInput");

    const profileUrlInput =
        document.getElementById("profileUrlInput");

    const genderInput =
        document.getElementById("genderInput");

    const bioInput =
        document.getElementById("bioInput");

    const previewName =
        document.getElementById("previewName");

    const previewUsername =
        document.getElementById("previewUsername");

    const previewBio =
        document.getElementById("previewBio");

    const nameCounter =
        document.getElementById("nameCounter");

    const usernameCounter =
        document.getElementById("usernameCounter");

    const bioCounter =
        document.getElementById("bioCounter");

    const usernameStatus =
        document.getElementById("usernameStatus");

    const profileUrlPreview =
        document.getElementById("profileUrlPreview");

    const publicProfileLink =
        document.getElementById("publicProfileLink");

    const copyProfileUrl =
        document.getElementById("copyProfileUrl");

    const saveProfileBtn =
        document.getElementById("saveProfileBtn");

    const saveTopBtn =
        document.getElementById("saveTopBtn");

    const backBtn =
        document.getElementById("backBtn");

    const toast =
        document.getElementById("toast");

    const toastText =
        document.getElementById("toastText");

    const toastIcon =
        document.getElementById("toastIcon");

    const loadingOverlay =
        document.getElementById("loadingOverlay");

    const loadingTitle =
        document.getElementById("loadingTitle");

    const loadingText =
        document.getElementById("loadingText");


    /* =====================================================
       DEFAULTS
    ===================================================== */

    const DEFAULT_AVATAR =
        "assets/default-avatar.png";

    const DEFAULT_BANNER =
        "assets/default-banner.jpg";


    let currentUID = null;

    let currentProfile = {};

    let selectedProfileFile = null;

    let selectedBannerFile = null;

    let originalUsername = "";

    let saving = false;


    /* =====================================================
       HELPERS
    ===================================================== */

    function showToast(message, type = "success") {

        if (!toast || !toastText) return;

        toastText.textContent = message;

        if (toastIcon) {

            toastIcon.className =
                type === "error"
                    ? "fa-solid fa-circle-exclamation"
                    : "fa-solid fa-circle-check";

        }

        toast.classList.remove("hidden");

        clearTimeout(showToast.timer);

        showToast.timer =
            setTimeout(() => {

                toast.classList.add("hidden");

            }, 3000);
    }


    function showLoading(title, message) {

        if (!loadingOverlay) return;

        if (loadingTitle) {
            loadingTitle.textContent =
                title || "Saving profile";
        }

        if (loadingText) {
            loadingText.textContent =
                message || "Please wait...";
        }

        loadingOverlay.classList.remove("hidden");
    }


    function hideLoading() {

        if (!loadingOverlay) return;

        loadingOverlay.classList.add("hidden");
    }


    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function getCurrentUser() {

        if (
            typeof firebase !== "undefined" &&
            firebase.auth
        ) {

            return firebase.auth().currentUser;

        }

        return null;
    }


    function getDatabase() {

        if (
            typeof db !== "undefined" &&
            db
        ) {

            return db;

        }

        if (
            typeof firebase !== "undefined" &&
            firebase.database
        ) {

            return firebase.database();

        }

        return null;
    }


    function normalizeUsername(value) {

        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/^@+/, "")
            .replace(/\s+/g, "");
    }


    function normalizeProfileURL(value) {

        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\/[^/]+\//i, "")
            .replace(/^\/+/, "")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9._-]/g, "")
            .substring(0, 40);
    }


    /* =====================================================
       COUNTERS
    ===================================================== */

    function updateCounters() {

        if (nameCounter && nameInput) {

            nameCounter.textContent =
                `${nameInput.value.length}/50`;

        }

        if (
            usernameCounter &&
            usernameInput
        ) {

            usernameCounter.textContent =
                `${usernameInput.value.length}/30`;

        }

        if (bioCounter && bioInput) {

            bioCounter.textContent =
                `${bioInput.value.length}/160`;

        }

    }


    /* =====================================================
       LIVE PREVIEW
    ===================================================== */

    function updatePreview() {

        const name =
            nameInput?.value.trim() ||
            "Your Name";

        const username =
            normalizeUsername(
                usernameInput?.value
            ) ||
            "username";

        const bio =
            bioInput?.value.trim() ||
            "Your bio will appear here.";

        const profileURL =
            normalizeProfileURL(
                profileUrlInput?.value
            ) ||
            username;


        if (previewName) {

            previewName.textContent =
                name;

        }


        if (previewUsername) {

            previewUsername.textContent =
                `@${username}`;

        }


        if (previewBio) {

            previewBio.textContent =
                bio;

        }


        if (profileUrlPreview) {

            profileUrlPreview.textContent =
                profileURL;

        }


        if (publicProfileLink) {

            publicProfileLink.textContent =
                `viewora.app/${profileURL}`;

        }


        updateCounters();

    }


    /* =====================================================
       PROFILE PHOTO
    ===================================================== */

    if (profilePhotoButton) {

        profilePhotoButton.addEventListener(
            "click",
            () => {

                if (profilePhotoInput) {

                    profilePhotoInput.click();

                }

            }
        );

    }


    if (profilePhotoInput) {

        profilePhotoInput.addEventListener(
            "change",
            event => {

                const file =
                    event.target.files?.[0];

                if (!file) return;


                if (!file.type.startsWith("image/")) {

                    showToast(
                        "Please select an image.",
                        "error"
                    );

                    return;

                }


                if (
                    file.size >
                    10 * 1024 * 1024
                ) {

                    showToast(
                        "Profile photo must be under 10 MB.",
                        "error"
                    );

                    profilePhotoInput.value = "";

                    return;

                }


                selectedProfileFile =
                    file;


                const reader =
                    new FileReader();

                reader.onload =
                    e => {

                        if (profilePreview) {

                            profilePreview.src =
                                e.target.result;

                        }

                    };

                reader.readAsDataURL(file);

            }
        );

    }


    /* =====================================================
       BANNER
    ===================================================== */

    if (bannerArea) {

        bannerArea.addEventListener(
            "click",
            () => {

                if (bannerInput) {

                    bannerInput.click();

                }

            }
        );

        bannerArea.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {

                    event.preventDefault();

                    bannerInput?.click();

                }

            }
        );

    }


    if (bannerInput) {

        bannerInput.addEventListener(
            "change",
            event => {

                const file =
                    event.target.files?.[0];

                if (!file) return;


                if (!file.type.startsWith("image/")) {

                    showToast(
                        "Please select an image.",
                        "error"
                    );

                    return;

                }


                if (
                    file.size >
                    15 * 1024 * 1024
                ) {

                    showToast(
                        "Banner must be under 15 MB.",
                        "error"
                    );

                    bannerInput.value = "";

                    return;

                }


                selectedBannerFile =
                    file;


                const reader =
                    new FileReader();

                reader.onload =
                    e => {

                        if (bannerPreview) {

                            bannerPreview.src =
                                e.target.result;

                        }

                    };

                reader.readAsDataURL(file);

            }
        );

    }


    /* =====================================================
       INPUT EVENTS
    ===================================================== */

    [
        nameInput,
        usernameInput,
        profileUrlInput,
        bioInput
    ]
    .filter(Boolean)
    .forEach(input => {

        input.addEventListener(
            "input",
            updatePreview
        );

    });


    if (usernameInput) {

        usernameInput.addEventListener(
            "input",
            () => {

                usernameInput.value =
                    usernameInput.value
                        .replace(/\s/g, "")
                        .replace(/[^a-zA-Z0-9._]/g, "");

            }
        );

    }


    if (profileUrlInput) {

        profileUrlInput.addEventListener(
            "input",
            () => {

                profileUrlInput.value =
                    normalizeProfileURL(
                        profileUrlInput.value
                    );

            }
        );

    }


    /* =====================================================
       USERNAME VALIDATION
    ===================================================== */

    function validateUsername(username) {

        if (!username) {

            return {
                valid: false,
                message: "Username is required."
            };

        }


        if (username.length < 3) {

            return {
                valid: false,
                message: "Minimum 3 characters."
            };

        }


        if (username.length > 30) {

            return {
                valid: false,
                message: "Maximum 30 characters."
            };

        }


        if (
            !/^[a-zA-Z0-9._]+$/.test(
                username
            )
        ) {

            return {
                valid: false,
                message: "Only letters, numbers, dots and underscores."
            };

        }


        return {
            valid: true,
            message: "Valid username"
        };

    }


    function setUsernameStatus(
        message,
        valid
    ) {

        if (!usernameStatus) return;

        usernameStatus.textContent =
            message;

        usernameStatus.classList.remove(
            "valid",
            "invalid"
        );

        usernameStatus.classList.add(
            valid
                ? "valid"
                : "invalid"
        );

    }


    async function checkUsernameAvailable(
        username
    ) {

        if (
            username === originalUsername
        ) {

            return true;

        }


        const database =
            getDatabase();

        if (!database) {

            return true;

        }


        try {

            const snapshot =
                await database
                    .ref("users")
                    .orderByChild("username")
                    .equalTo(username)
                    .once("value");


            if (!snapshot.exists()) {

                return true;

            }


            let foundOtherUser = false;

            snapshot.forEach(child => {

                if (
                    child.key !== currentUID
                ) {

                    foundOtherUser = true;

                }

            });

            return !foundOtherUser;

        } catch (error) {

            console.error(
                "Username check error:",
                error
            );

            return true;

        }

    }


    let usernameCheckTimer = null;


    if (usernameInput) {

        usernameInput.addEventListener(
            "blur",
            async () => {

                const username =
                    normalizeUsername(
                        usernameInput.value
                    );

                const result =
                    validateUsername(
                        username
                    );


                if (!result.valid) {

                    setUsernameStatus(
                        result.message,
                        false
                    );

                    return;

                }


                setUsernameStatus(
                    "Checking...",
                    true
                );


                clearTimeout(
                    usernameCheckTimer
                );


                usernameCheckTimer =
                    setTimeout(
                        async () => {

                            const available =
                                await checkUsernameAvailable(
                                    username
                                );


                            if (available) {

                                setUsernameStatus(
                                    "✓ Available",
                                    true
                                );

                            } else {

                                setUsernameStatus(
                                    "✕ Username already taken",
                                    false
                                );

                            }

                        },
                        150
                    );

            }
        );

    }


    /* =====================================================
       LOAD PROFILE
    ===================================================== */

    async function loadProfile() {

        const user =
            getCurrentUser();

        if (!user) {

            showToast(
                "Please login first.",
                "error"
            );

            setTimeout(() => {

                location.href =
                    "login.html";

            }, 1000);

            return;

        }


        currentUID =
            user.uid;


        const database =
            getDatabase();

        if (!database) {

            showToast(
                "Firebase database unavailable.",
                "error"
            );

            return;

        }


        try {

            const snapshot =
                await database
                    .ref(`users/${currentUID}`)
                    .once("value");


            currentProfile =
                snapshot.val() || {};


            fillProfile(
                currentProfile,
                user
            );


            console.log(
                "✅ Profile loaded"
            );


        } catch (error) {

            console.error(
                "Profile loading error:",
                error
            );

            showToast(
                "Unable to load profile.",
                "error"
            );

        }

    }


    function fillProfile(
        profile,
        user
    ) {

        const name =
            profile.name ||
            profile.fullName ||
            user.displayName ||
            "";


        const username =
            normalizeUsername(
                profile.username ||
                profile.userName ||
                ""
            );


        const profileURL =
            normalizeProfileURL(
                profile.profileUrl ||
                profile.profileURL ||
                profile.slug ||
                username
            );


        const gender =
            profile.gender ||
            "";


        const bio =
            profile.bio ||
            "";


        originalUsername =
            username;


        if (nameInput) {

            nameInput.value =
                name;

        }


        if (usernameInput) {

            usernameInput.value =
                username;

        }


        if (profileUrlInput) {

            profileUrlInput.value =
                profileURL;

        }


        if (genderInput) {

            genderInput.value =
                gender;

        }


        if (bioInput) {

            bioInput.value =
                bio;

        }


        const photo =
            profile.profilePhoto ||
            profile.profilePhotoURL ||
            profile.photoURL ||
            profile.avatar ||
            user.photoURL ||
            DEFAULT_AVATAR;


        const banner =
            profile.banner ||
            profile.bannerUrl ||
            profile.bannerURL ||
            DEFAULT_BANNER;


        if (profilePreview) {

            profilePreview.src =
                photo;

        }


        if (bannerPreview) {

            bannerPreview.src =
                banner;

        }


        updatePreview();

    }


    /* =====================================================
       CLOUDINARY UPLOAD
       ===================================================== */

    /*
       IMPORTANT:
       If your firebase.js already has a Cloudinary
       upload helper, this function can use it.

       Otherwise configure these values.
    */

    const CLOUDINARY_CLOUD_NAME =
        window.VIEWORA_CLOUDINARY_CLOUD_NAME ||
        "";

    const CLOUDINARY_UPLOAD_PRESET =
        window.VIEWORA_CLOUDINARY_UPLOAD_PRESET ||
        "Viewora-upload";


    async function uploadToCloudinary(
        file,
        folder
    ) {

        if (!file) return null;


        /*
          If another Viewora helper exists,
          use it automatically.
        */

        if (
            typeof window.uploadToCloudinary ===
            "function" &&
            window.uploadToCloudinary !==
            uploadToCloudinary
        ) {

            return await window.uploadToCloudinary(
                file,
                folder
            );

        }


        if (!CLOUDINARY_CLOUD_NAME) {

            throw new Error(
                "Cloudinary cloud name is not configured."
            );

        }


        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        formData.append(
            "upload_preset",
            CLOUDINARY_UPLOAD_PRESET
        );

        formData.append(
            "folder",
            folder
        );


        const response =
            await fetch(
                `https://api.cloudinary.com/v1_1/${encodeURIComponent(
                    CLOUDINARY_CLOUD_NAME
                )}/image/upload`,
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!response.ok) {

            throw new Error(
                "Cloudinary upload failed."
            );

        }


        const data =
            await response.json();


        if (!data.secure_url) {

            throw new Error(
                "Cloudinary did not return an image URL."
            );

        }


        return data.secure_url;

    }


    /* =====================================================
       SAVE PROFILE
    ===================================================== */

    async function saveProfile() {

        if (saving) return;


        const user =
            getCurrentUser();


        if (!user) {

            showToast(
                "Please login first.",
                "error"
            );

            return;

        }


        const database =
            getDatabase();


        if (!database) {

            showToast(
                "Firebase database unavailable.",
                "error"
            );

            return;

        }


        const name =
            nameInput?.value.trim() || "";


        const username =
            normalizeUsername(
                usernameInput?.value
            );


        const profileURL =
            normalizeProfileURL(
                profileUrlInput?.value
            ) ||
            username;


        const gender =
            genderInput?.value || "";


        const bio =
            bioInput?.value.trim() || "";


        /* ===============================================
           VALIDATION
        =============================================== */

        if (!name) {

            showToast(
                "Please enter your name.",
                "error"
            );

            nameInput?.focus();

            return;

        }


        const usernameValidation =
            validateUsername(username);


        if (!usernameValidation.valid) {

            showToast(
                usernameValidation.message,
                "error"
            );

            usernameInput?.focus();

            return;

        }


        if (!profileURL) {

            showToast(
                "Please enter a profile URL.",
                "error"
            );

            profileUrlInput?.focus();

            return;

        }


        if (
            !/^[a-zA-Z0-9._-]+$/.test(
                profileURL
            )
        ) {

            showToast(
                "Invalid profile URL.",
                "error"
            );

            profileUrlInput?.focus();

            return;

        }


        saving = true;


        if (saveProfileBtn) {

            saveProfileBtn.disabled =
                true;

        }

        if (saveTopBtn) {

            saveTopBtn.disabled =
                true;

        }


        try {

            showLoading(
                "Saving profile",
                "Preparing your changes..."
            );


            /* =========================================
               CHECK USERNAME
            ========================================= */

            const usernameAvailable =
                await checkUsernameAvailable(
                    username
                );


            if (!usernameAvailable) {

                throw new Error(
                    "This username is already taken."
                );

            }


            let profilePhotoURL =
                currentProfile.profilePhoto ||
                currentProfile.profilePhotoURL ||
                currentProfile.photoURL ||
                user.photoURL ||
                DEFAULT_AVATAR;


            let bannerURL =
                currentProfile.banner ||
                currentProfile.bannerUrl ||
                currentProfile.bannerURL ||
                DEFAULT_BANNER;


            /* =========================================
               PROFILE PHOTO UPLOAD
            ========================================= */

            if (selectedProfileFile) {

                showLoading(
                    "Uploading profile photo",
                    "Almost there..."
                );


                const uploadedPhoto =
                    await uploadToCloudinary(
                        selectedProfileFile,
                        `viewora/users/${currentUID}/profile`
                    );


                if (uploadedPhoto) {

                    profilePhotoURL =
                        uploadedPhoto;

                }

            }


            /* =========================================
               BANNER UPLOAD
            ========================================= */

            if (selectedBannerFile) {

                showLoading(
                    "Uploading banner",
                    "Updating your profile cover..."
                );


                const uploadedBanner =
                    await uploadToCloudinary(
                        selectedBannerFile,
                        `viewora/users/${currentUID}/banner`
                    );


                if (uploadedBanner) {

                    bannerURL =
                        uploadedBanner;

                }

            }


            /* =========================================
               PROFILE DATA
            ========================================= */

            showLoading(
                "Saving profile",
                "Updating your Viewora profile..."
            );


            const now =
                firebase.database.ServerValue.TIMESTAMP;


            const profileData = {

                ...currentProfile,

                uid:
                    currentUID,

                name:
                    name,

                fullName:
                    name,

                username:
                    username,

                profileUrl:
                    profileURL,

                profileURL:
                    profileURL,

                slug:
                    profileURL,

                gender:
                    gender,

                bio:
                    bio,

                profilePhoto:
                    profilePhotoURL,

                profilePhotoURL:
                    profilePhotoURL,

                photoURL:
                    profilePhotoURL,

                avatar:
                    profilePhotoURL,

                banner:
                    bannerURL,

                bannerUrl:
                    bannerURL,

                bannerURL:
                    bannerURL,

                updatedAt:
                    now

            };


            /* =========================================
               UPDATE USER PROFILE
            ========================================= */

            await database
                .ref(`users/${currentUID}`)
                .update(profileData);


            /* =========================================
               OPTIONAL PUBLIC PROFILE INDEX
            ========================================= */

            await database
                .ref(
                    `profileUrls/${profileURL}`
                )
                .set({
                    uid:
                        currentUID,

                    username:
                        username,

                    updatedAt:
                        now
                });


            /* =========================================
               USERNAME INDEX
            ========================================= */

            await database
                .ref(
                    `usernames/${username}`
                )
                .set(
                    currentUID
                );


            currentProfile =
                {
                    ...profileData
                };


            originalUsername =
                username;


            selectedProfileFile =
                null;

            selectedBannerFile =
                null;


            if (profilePhotoInput) {

                profilePhotoInput.value =
                    "";

            }

            if (bannerInput) {

                bannerInput.value =
                    "";

            }


            hideLoading();


            showToast(
                "Profile updated successfully!"
            );


            setTimeout(() => {

                location.href =
                    `profile.html?uid=${encodeURIComponent(
                        currentUID
                    )}`;

            }, 900);


        } catch (error) {

            console.error(
                "❌ Save profile error:",
                error
            );


            hideLoading();


            showToast(
                error.message ||
                "Unable to save profile.",
                "error"
            );

        } finally {

            saving = false;


            if (saveProfileBtn) {

                saveProfileBtn.disabled =
                    false;

            }


            if (saveTopBtn) {

                saveTopBtn.disabled =
                    false;

            }

        }

    }


    /* =====================================================
       SAVE BUTTONS
    ===================================================== */

    if (saveProfileBtn) {

        saveProfileBtn.addEventListener(
            "click",
            saveProfile
        );

    }


    if (saveTopBtn) {

        saveTopBtn.addEventListener(
            "click",
            saveProfile
        );

    }


    /* =====================================================
       COPY PROFILE URL
    ===================================================== */

    if (copyProfileUrl) {

        copyProfileUrl.addEventListener(
            "click",
            async () => {

                const slug =
                    normalizeProfileURL(
                        profileUrlInput?.value
                    ) ||
                    normalizeUsername(
                        usernameInput?.value
                    );


                const url =
                    `${location.origin}/profile.html?user=${encodeURIComponent(
                        slug
                    )}`;


                try {

                    await navigator.clipboard.writeText(
                        url
                    );


                    showToast(
                        "Profile link copied!"
                    );


                } catch (error) {

                    /* Fallback */

                    const textarea =
                        document.createElement(
                            "textarea"
                        );

                    textarea.value =
                        url;

                    textarea.style.position =
                        "fixed";

                    textarea.style.opacity =
                        "0";

                    document.body.appendChild(
                        textarea
                    );

                    textarea.select();

                    document.execCommand(
                        "copy"
                    );

                    textarea.remove();


                    showToast(
                        "Profile link copied!"
                    );

                }

            }
        );

    }


    /* =====================================================
       BACK
    ===================================================== */

    if (backBtn) {

        backBtn.addEventListener(
            "click",
            () => {

                if (
                    document.referrer &&
                    document.referrer.includes(
                        location.hostname
                    )
                ) {

                    history.back();

                } else {

                    location.href =
                        "profile.html";

                }

            }
        );

    }


    /* =====================================================
       BEFORE LEAVING
    ===================================================== */

    window.addEventListener(
        "beforeunload",
        event => {

            if (
                selectedProfileFile ||
                selectedBannerFile
            ) {

                event.preventDefault();

                event.returnValue = "";

            }

        }
    );


    /* =====================================================
       FIREBASE AUTH READY
    ===================================================== */

    function waitForAuth() {

        if (
            typeof firebase === "undefined" ||
            !firebase.auth
        ) {

            setTimeout(
                waitForAuth,
                300
            );

            return;

        }


        firebase
            .auth()
            .onAuthStateChanged(
                user => {

                    if (user) {

                        loadProfile();

                    } else {

                        location.href =
                            "login.html";

                    }

                }
            );

    }


    waitForAuth();


    console.log(
        "✅ Viewora Edit Profile JS Ready"
    );

});