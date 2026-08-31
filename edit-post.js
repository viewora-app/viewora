"use strict";

/*
============================================================
 VIEWORA V12
 EDIT-POST.JS
 FINAL • CLOUDINARY + FIREBASE PUBLISH ENGINE
============================================================

 FLOW:
  1. Read selected media from session/localStorage
  2. Preview media
  3. Edit caption/text/settings
  4. Upload image to Cloudinary
  5. Create post in Firebase Realtime Database
  6. Create userPosts index
  7. Cleanup temporary media
  8. Redirect to index.html

 IMPORTANT:
 Cloudinary is used for media upload.
 Firebase Realtime Database is used for post data.

 Requires:
   firebase-app-compat.js
   firebase-auth-compat.js
   firebase-database-compat.js
   firebase.js

 Cloudinary:
   cloudinary.js is optional if constants are already global.
============================================================
*/

(() => {

    if (window.__VIEWORA_EDIT_POST_FINAL__) {
        console.warn("VIEWORA Edit Post already initialized.");
        return;
    }

    window.__VIEWORA_EDIT_POST_FINAL__ = true;


    /* ======================================================
       DOM HELPERS
    ====================================================== */

    const $ = id =>
        document.getElementById(id);

    const qsa = selector =>
        [...document.querySelectorAll(selector)];


    /* ======================================================
       STATE
    ====================================================== */

    const state = {

        media: null,

        mediaType: "image",

        mediaURL: "",

        rotation: 0,

        fit: "cover",

        caption: "",

        text: "",

        textStyle: "clean",

        music: null,

        location: "",

        collaborator: null,

        tags: [],

        audience: "Everyone",

        allowComments: true,

        hideLikes: false,

        allowSaves: true,

        publishing: false

    };


    /* ======================================================
       INIT
    ====================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        init
    );


    async function init() {

        loadMedia();

        setupButtons();

        setupCaption();

        setupText();

        setupAudience();

        setupToggles();

        setupSheets();

        setupMusic();

        setupCollaboration();

        setupLocation();

        setupTagPeople();

        setupBack();

        setupPublish();

        setupFilter();

        console.log(
            "🚀 VIEWORA EDIT POST READY"
        );

    }


    /* ======================================================
       FIREBASE
    ====================================================== */

    function getDatabase() {

        if (
            window.db &&
            typeof window.db.ref === "function"
        ) {
            return window.db;
        }


        if (
            window.firebase &&
            typeof firebase.database === "function"
        ) {
            return firebase.database();
        }


        throw new Error(
            "Firebase Database is not initialized."
        );

    }


    function getAuthUser() {

        if (
            window.auth &&
            window.auth.currentUser
        ) {
            return window.auth.currentUser;
        }


        if (
            window.firebase &&
            typeof firebase.auth === "function"
        ) {
            return firebase.auth().currentUser;
        }


        return null;

    }


    /* ======================================================
       LOAD MEDIA
    ====================================================== */

    function loadMedia() {

        const loader =
            $("mediaLoading");

        const preview =
            $("postPreview");


        if (!preview) {

            console.error(
                "postPreview element missing."
            );

            return;

        }


        let media =
            sessionStorage.getItem(
                "viewora_edit_post_media"
            ) ||
            localStorage.getItem(
                "viewora_edit_post_media"
            );


        let type =
            sessionStorage.getItem(
                "viewora_edit_post_type"
            ) ||
            localStorage.getItem(
                "viewora_edit_post_type"
            ) ||
            "image";


        /*
         FALLBACK STORAGE KEYS
        */

        if (!media) {

            media =
                sessionStorage.getItem(
                    "vieworaUploadMedia"
                ) ||
                localStorage.getItem(
                    "vieworaUploadMedia"
                );

        }


        if (!media) {

            media =
                sessionStorage.getItem(
                    "viewora_media"
                ) ||
                localStorage.getItem(
                    "viewora_media"
                );

        }


        if (!media) {

            showMediaError();

            return;

        }


        state.media =
            media;

        state.mediaType =
            type;


        if (loader) {

            loader.innerHTML = `
                <div class="loadingSpinner"></div>
                <span>Loading your photo...</span>
            `;

            loader.classList.remove(
                "hidden"
            );

        }


        preview.onload = () => {

            loader?.classList.add(
                "hidden"
            );

            preview.classList.add(
                "loaded"
            );

        };


        preview.onerror = () => {

            console.error(
                "Media preview failed."
            );

            showMediaError();

        };


        preview.src =
            media;


        /*
         Cached image
        */

        setTimeout(() => {

            if (
                preview.complete &&
                preview.naturalWidth > 0
            ) {

                loader?.classList.add(
                    "hidden"
                );

                preview.classList.add(
                    "loaded"
                );

            }

        }, 200);

    }


    /* ======================================================
       MEDIA ERROR
    ====================================================== */

    function showMediaError() {

        const loader =
            $("mediaLoading");


        if (!loader) {
            return;
        }


        loader.classList.remove(
            "hidden"
        );


        loader.innerHTML = `
            <i class="fa-solid fa-image"
               style="font-size:32px;margin-bottom:10px;">
            </i>

            <strong>
                No media selected
            </strong>

            <span>
                Please select your photo again.
            </span>

            <button
                type="button"
                id="selectMediaAgain"
                class="sheetPrimaryButton"
            >
                <i class="fa-solid fa-image"></i>
                Select Photo
            </button>
        `;


        $("selectMediaAgain")?.addEventListener(
            "click",
            () => {

                window.location.href =
                    "upload.html";

            }
        );

    }


    /* ======================================================
       MEDIA CONTROLS
    ====================================================== */

    function setupButtons() {

        $("rotateBtn")?.addEventListener(
            "click",
            () => {

                state.rotation += 90;

                if (
                    state.rotation >= 360
                ) {
                    state.rotation = 0;
                }

                applyMediaTransform();

            }
        );


        $("fitBtn")?.addEventListener(
            "click",
            () => {

                state.fit =
                    state.fit === "cover"
                        ? "contain"
                        : "cover";

                applyMediaFit();

            }
        );


        $("adjustBtn")?.addEventListener(
            "click",
            () => {

                showToast(
                    "Adjust",
                    "Photo adjustment tools are coming soon."
                );

            }
        );

    }


    function applyMediaTransform() {

        const preview =
            $("postPreview");


        if (!preview) {
            return;
        }


        preview.style.transform =
            `rotate(${state.rotation}deg)`;

    }


    function applyMediaFit() {

        const preview =
            $("postPreview");


        if (!preview) {
            return;
        }


        preview.style.objectFit =
            state.fit;

    }


    /* ======================================================
       CAPTION
    ====================================================== */

    function setupCaption() {

        const input =
            $("captionInput");

        const counter =
            $("captionCount");


        if (!input) {
            return;
        }


        input.addEventListener(
            "input",
            () => {

                state.caption =
                    input.value;


                if (counter) {

                    counter.textContent =
                        `${input.value.length} / 2200`;

                }

            }
        );


        $("emojiBtn")?.addEventListener(
            "click",
            () => {

                insertText(
                    " 😊"
                );

            }
        );


        $("hashtagBtn")?.addEventListener(
            "click",
            () => {

                insertText(
                    "#"
                );

            }
        );


        $("mentionBtn")?.addEventListener(
            "click",
            () => {

                insertText(
                    "@"
                );

            }
        );

    }


    function insertText(text) {

        const input =
            $("captionInput");


        if (!input) {
            return;
        }


        const start =
            input.selectionStart ??
            input.value.length;


        const end =
            input.selectionEnd ??
            input.value.length;


        input.value =
            input.value.substring(
                0,
                start
            ) +
            text +
            input.value.substring(
                end
            );


        input.focus();


        input.selectionStart =
            input.selectionEnd =
                start + text.length;


        input.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles: true
                }
            )
        );

    }


    /* ======================================================
       TEXT
    ====================================================== */

    function setupText() {

        $("textBtn")?.addEventListener(
            "click",
            () => {

                openSheet(
                    "textSheet"
                );

            }
        );


        qsa(".textStyle")
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            qsa(".textStyle")
                                .forEach(
                                    item =>
                                        item.classList.remove(
                                            "active"
                                        )
                                );


                            button.classList.add(
                                "active"
                            );


                            state.textStyle =
                                button.dataset.style ||
                                "clean";

                        }
                    );

                }
            );


        $("applyTextBtn")?.addEventListener(
            "click",
            () => {

                const input =
                    $("overlayTextInput");


                state.text =
                    input?.value?.trim() ||
                    "";


                updateTextOverlay();


                closeSheet(
                    "textSheet"
                );

            }
        );

    }


    function updateTextOverlay() {

        const overlay =
            $("textOverlay");


        if (!overlay) {
            return;
        }


        if (!state.text) {

            overlay.classList.add(
                "hidden"
            );

            return;

        }


        overlay.textContent =
            state.text;


        overlay.dataset.style =
            state.textStyle;


        overlay.classList.remove(
            "hidden"
        );

    }


    /* ======================================================
       SHEETS
    ====================================================== */

    function setupSheets() {

        qsa("[data-close]")
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            closeSheet(
                                button.dataset.close
                            );

                        }
                    );

                }
            );


        qsa(".overlayBackdrop")
            .forEach(
                backdrop => {

                    backdrop.addEventListener(
                        "click",
                        () => {

                            const overlay =
                                backdrop.closest(
                                    ".overlay"
                                );


                            overlay?.classList.add(
                                "hidden"
                            );


                            if (
                                !document.querySelector(
                                    ".overlay:not(.hidden)"
                                )
                            ) {

                                document.body.classList.remove(
                                    "sheetOpen"
                                );

                            }

                        }
                    );

                }
            );

    }


    function openSheet(id) {

        const sheet =
            $(id);


        if (!sheet) {
            return;
        }


        sheet.classList.remove(
            "hidden"
        );


        document.body.classList.add(
            "sheetOpen"
        );

    }


    function closeSheet(id) {

        const sheet =
            $(id);


        if (!sheet) {
            return;
        }


        sheet.classList.add(
            "hidden"
        );


        if (
            !document.querySelector(
                ".overlay:not(.hidden)"
            )
        ) {

            document.body.classList.remove(
                "sheetOpen"
            );

        }

    }


    /* ======================================================
       MUSIC
    ====================================================== */

    function setupMusic() {

        $("musicBtn")?.addEventListener(
            "click",
            () => {

                openSheet(
                    "musicSheet"
                );

                renderMusic();

            }
        );


        $("musicSearch")?.addEventListener(
            "input",
            renderMusic
        );

    }


    function renderMusic() {

        const list =
            $("musicList");


        if (!list) {
            return;
        }


        const search =
            (
                $("musicSearch")?.value ||
                ""
            )
            .trim()
            .toLowerCase();


        const music = [

            {
                id: "viewora-original",
                title: "Viewora Original",
                artist: "Viewora",
                icon: "fa-music"
            },

            {
                id: "trending-sound",
                title: "Trending Sound",
                artist: "Viewora Sounds",
                icon: "fa-fire"
            },

            {
                id: "creator-energy",
                title: "Creator Energy",
                artist: "Viewora Music",
                icon: "fa-bolt"
            },

            {
                id: "dreamy-moments",
                title: "Dreamy Moments",
                artist: "Viewora Sounds",
                icon: "fa-star"
            }

        ];


        const filtered =
            music.filter(
                item =>
                    `${item.title} ${item.artist}`
                        .toLowerCase()
                        .includes(search)
            );


        list.innerHTML = "";


        if (!filtered.length) {

            list.innerHTML = `
                <div class="emptyState">
                    <i class="fa-solid fa-music"></i>
                    <strong>No music found</strong>
                    <span>Try another search.</span>
                </div>
            `;

            return;

        }


        filtered.forEach(
            item => {

                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.className =
                    "musicItem";


                button.innerHTML = `
                    <span class="musicItemIcon">
                        <i class="fa-solid ${item.icon}"></i>
                    </span>

                    <span>
                        <strong>
                            ${escapeHTML(item.title)}
                        </strong>

                        <small>
                            ${escapeHTML(item.artist)}
                        </small>
                    </span>

                    <i class="fa-solid fa-plus"></i>
                `;


                button.addEventListener(
                    "click",
                    () => {

                        state.music =
                            item;


                        showToast(
                            "Music added",
                            `${item.title} selected`
                        );


                        closeSheet(
                            "musicSheet"
                        );

                    }
                );


                list.appendChild(
                    button
                );

            }
        );

    }


    /* ======================================================
       COLLABORATION
    ====================================================== */

    function setupCollaboration() {

        $("collabBtn")?.addEventListener(
            "click",
            () => {

                openSheet(
                    "collabSheet"
                );

            }
        );


        $("collabSearch")?.addEventListener(
            "input",
            event => {

                const value =
                    event.target.value
                        .trim();


                const list =
                    $("creatorList");


                if (!list) {
                    return;
                }


                if (!value) {

                    list.innerHTML = `
                        <div class="emptyState">
                            <i class="fa-solid fa-user-group"></i>

                            <strong>
                                Find a creator
                            </strong>

                            <span>
                                Search for someone to collaborate with
                            </span>
                        </div>
                    `;

                    return;

                }


                list.innerHTML = `
                    <button
                        type="button"
                        class="creatorItem"
                    >

                        <span class="creatorAvatar">
                            <i class="fa-solid fa-user"></i>
                        </span>

                        <span>
                            <strong>
                                ${escapeHTML(value)}
                            </strong>

                            <small>
                                Viewora creator
                            </small>
                        </span>

                        <i class="fa-solid fa-plus"></i>

                    </button>
                `;


                list.querySelector(
                    ".creatorItem"
                )?.addEventListener(
                    "click",
                    () => {

                        state.collaborator =
                            value;


                        const valueEl =
                            $("collabValue");


                        if (valueEl) {

                            valueEl.textContent =
                                `@${value}`;

                        }


                        closeSheet(
                            "collabSheet"
                        );

                    }
                );

            }
        );

    }


    /* ======================================================
       LOCATION
    ====================================================== */

    function setupLocation() {

        $("locationBtn")?.addEventListener(
            "click",
            () => {

                openSheet(
                    "locationSheet"
                );

            }
        );


        qsa(".locationOption")
            .forEach(
                option => {

                    option.addEventListener(
                        "click",
                        () => {

                            const title =
                                option.querySelector(
                                    "strong"
                                );


                            if (!title) {
                                return;
                            }


                            state.location =
                                title.textContent
                                    .trim();


                            const small =
                                $("locationBtn")
                                    ?.querySelector(
                                        ".detailContent small"
                                    );


                            if (small) {

                                small.textContent =
                                    state.location;

                            }


                            closeSheet(
                                "locationSheet"
                            );

                        }
                    );

                }
            );

    }


    /* ======================================================
       AUDIENCE
    ====================================================== */

    function setupAudience() {

        $("audienceBtn")?.addEventListener(
            "click",
            () => {

                openSheet(
                    "audienceSheet"
                );

            }
        );


        qsa(".audienceOption")
            .forEach(
                option => {

                    option.addEventListener(
                        "click",
                        () => {

                            qsa(".audienceOption")
                                .forEach(
                                    item =>
                                        item.classList.remove(
                                            "active"
                                        )
                                );


                            option.classList.add(
                                "active"
                            );


                            state.audience =
                                option.dataset.audience ||
                                "Everyone";


                            const value =
                                $("audienceValue");


                            if (value) {

                                value.textContent =
                                    state.audience;

                            }


                            closeSheet(
                                "audienceSheet"
                            );

                        }
                    );

                }
            );

    }


    /* ======================================================
       TOGGLES
    ====================================================== */

    function setupToggles() {

        const comments =
            $("commentsToggle");

        const likes =
            $("hideLikesToggle");

        const saves =
            $("allowSavesToggle");


        if (comments) {

            state.allowComments =
                comments.checked;


            comments.addEventListener(
                "change",
                () => {

                    state.allowComments =
                        comments.checked;

                }
            );

        }


        if (likes) {

            state.hideLikes =
                likes.checked;


            likes.addEventListener(
                "change",
                () => {

                    state.hideLikes =
                        likes.checked;

                }
            );

        }


        if (saves) {

            state.allowSaves =
                saves.checked;


            saves.addEventListener(
                "change",
                () => {

                    state.allowSaves =
                        saves.checked;

                }
            );

        }

    }


    /* ======================================================
       TAG PEOPLE
    ====================================================== */

    function setupTagPeople() {

        $("tagPeopleBtn")?.addEventListener(
            "click",
            () => {

                showToast(
                    "Tag people",
                    "People tagging can be connected to creator search next."
                );

            }
        );

    }


    /* ======================================================
       FILTER
    ====================================================== */

    function setupFilter() {

        $("filterBtn")?.addEventListener(
            "click",
            () => {

                showToast(
                    "Filters",
                    "Photo filters are coming soon."
                );

            }
        );

    }


    /* ======================================================
       BACK
    ====================================================== */

    function setupBack() {

        $("backBtn")?.addEventListener(
            "click",
            () => {

                window.location.href =
                    "upload.html";

            }
        );

    }


    /* ======================================================
       PUBLISH BUTTONS
    ====================================================== */

    function setupPublish() {

        $("nextBtn")?.addEventListener(
            "click",
            publishPost
        );


        $("publishBtn")?.addEventListener(
            "click",
            publishPost
        );

    }


    /* ======================================================
       CREATE FIREBASE ID
    ====================================================== */

    function createPostId() {

        const database =
            getDatabase();


        const key =
            database
                .ref()
                .push()
                .key;


        if (key) {
            return key;
        }


        return (
            "post_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );

    }


    /* ======================================================
   CLOUDINARY CONFIG
====================================================== */

const CLOUDINARY_CLOUD_NAME = "z5m6wjdf";

const CLOUDINARY_UPLOAD_PRESET = "Viewora-upload";

const CLOUDINARY_UPLOAD_URL =
    "https://api.cloudinary.com/v1_1/" +
    CLOUDINARY_CLOUD_NAME +
    "/auto/upload";


function getCloudinaryConfig() {

    return {
        cloudName:
            CLOUDINARY_CLOUD_NAME,

        uploadPreset:
            CLOUDINARY_UPLOAD_PRESET,

        uploadUrl:
            CLOUDINARY_UPLOAD_URL
    };

}


    /* ======================================================
       DATA URL → BLOB
    ====================================================== */

    function dataURLToBlob(dataURL) {

        const parts =
            dataURL.split(",");


        if (
            parts.length < 2
        ) {

            throw new Error(
                "Invalid image data."
            );

        }


        const mime =
            parts[0]
                .match(
                    /:(.*?);/
                )?.[1] ||
            "image/jpeg";


        const binary =
            atob(
                parts[1]
            );


        const bytes =
            new Uint8Array(
                binary.length
            );


        for (
            let i = 0;
            i < binary.length;
            i++
        ) {

            bytes[i] =
                binary.charCodeAt(i);

        }


        return new Blob(
            [
                bytes
            ],
            {
                type:
                    mime
            }
        );

    }


    /* ======================================================
       CLOUDINARY UPLOAD
    ====================================================== */

    async function uploadMediaToCloudinary(
        media
    ) {

        /*
         -----------------------------------------------
         ALREADY HOSTED URL
         -----------------------------------------------
        */

        if (
            typeof media === "string" &&
            (
                media.startsWith("https://") ||
                media.startsWith("http://")
            )
        ) {

            return media;

        }


        /*
         -----------------------------------------------
         CLOUDINARY CONFIG
         -----------------------------------------------
        */

        const {
            cloudName,
            uploadPreset
        } =
            getCloudinaryConfig();


        /*
         -----------------------------------------------
         CONVERT DATA URL
         -----------------------------------------------
        */

        let file;


        if (
            typeof media === "string" &&
            media.startsWith("data:")
        ) {

            file =
                dataURLToBlob(
                    media
                );

        } else {

            throw new Error(
                "Invalid media. Please select the photo again."
            );

        }


        /*
         -----------------------------------------------
         CLOUDINARY UPLOAD URL
         -----------------------------------------------
        */

        const uploadURL =
            `https://api.cloudinary.com/v1_1/${encodeURIComponent(
                cloudName
            )}/image/upload`;


        /*
         -----------------------------------------------
         FORM DATA
         -----------------------------------------------
        */

        const formData =
            new FormData();


        formData.append(
            "file",
            file,
            "viewora-post.jpg"
        );


        formData.append(
            "upload_preset",
            uploadPreset
        );


        /*
         -----------------------------------------------
         UPLOAD
         -----------------------------------------------
        */

        const response =
            await fetch(
                uploadURL,
                {
                    method:
                        "POST",

                    body:
                        formData
                }
            );


        let result = null;


        try {

            result =
                await response.json();

        } catch (jsonError) {

            throw new Error(
                "Cloudinary returned an invalid response."
            );

        }


        if (!response.ok) {

            console.error(
                "Cloudinary error:",
                result
            );


            throw new Error(
                result?.error?.message ||
                `Cloudinary upload failed (${response.status}).`
            );

        }


        if (
            !result?.secure_url
        ) {

            console.error(
                "Cloudinary response:",
                result
            );


            throw new Error(
                "Cloudinary did not return an image URL."
            );

        }


        return result.secure_url;

    }


    /* ======================================================
       GET USER PROFILE
    ====================================================== */

    async function getUserProfile(uid) {

        const fallback = {

            username:
                "user",

            displayName:
                "Viewora User",

            avatar:
                "assets/default-avatar.png"

        };


        try {

            const database =
                getDatabase();


            const snapshot =
                await database
                    .ref(
                        `users/${uid}`
                    )
                    .once(
                        "value"
                    );


            const data =
                snapshot.val() ||
                {};


            return {

                username:
                    data.username ||
                    data.userName ||
                    data.handle ||
                    "user",

                displayName:
                    data.displayName ||
                    data.name ||
                    data.fullName ||
                    data.username ||
                    "Viewora User",

                avatar:
                    data.avatar ||
                    data.profilePhoto ||
                    data.profileImage ||
                    data.photoURL ||
                    "assets/default-avatar.png"

            };

        } catch (error) {

            console.warn(
                "Profile loading failed:",
                error
            );


            return fallback;

        }

    }


    /* ======================================================
       PUBLISH POST
    ====================================================== */

    async function publishPost() {

        if (state.publishing) {
            return;
        }


        /*
         -----------------------------------------------
         MEDIA CHECK
         -----------------------------------------------
        */

        if (!state.media) {

            showToast(
                "No media",
                "Please select a photo first."
            );

            return;

        }


        /*
         -----------------------------------------------
         AUTH CHECK
         -----------------------------------------------
        */

        const user =
            getAuthUser();


        if (!user) {

            showToast(
                "Login required",
                "Please login before publishing."
            );


            setTimeout(
                () => {

                    window.location.href =
                        "login.html";

                },
                1200
            );


            return;

        }


        /*
         -----------------------------------------------
         START
         -----------------------------------------------
        */

        state.publishing =
            true;


        setPublishState(
            true
        );


        showProcessing(
            "Preparing your post"
        );


        try {

            const database =
                getDatabase();


            /*
             --------------------------------------------
             CREATE POST ID
             --------------------------------------------
            */

            const postId =
                createPostId();


            /*
             --------------------------------------------
             UPLOAD IMAGE
             --------------------------------------------
            */

            updateProcessing(
                "Uploading your photo..."
            );


            const mediaURL =
                await uploadMediaToCloudinary(
                    state.media
                );


            state.mediaURL =
                mediaURL;


            /*
             --------------------------------------------
             USER PROFILE
             --------------------------------------------
            */

            updateProcessing(
                "Loading your profile..."
            );


            const profile =
                await getUserProfile(
                    user.uid
                );


            /*
             --------------------------------------------
             CAPTION
             --------------------------------------------
            */

            const caption =
                (
                    $("captionInput")?.value ||
                    state.caption ||
                    ""
                ).trim();


            /*
             --------------------------------------------
             POST DATA
             --------------------------------------------
            */

            const postData = {

                /*
                 ID
                */

                id:
                    postId,


                /*
                 TYPE
                */

                type:
                    "post",


                postType:
                    "photo",


                /*
                 MEDIA
                */

                media:
                    mediaURL,

                mediaUrl:
                    mediaURL,

                mediaURL:
                    mediaURL,

                mediaType:
                    state.mediaType,


                /*
                 CONTENT
                */

                caption:
                    caption,

                text:
                    state.text || "",

                textStyle:
                    state.textStyle || "clean",


                /*
                 MUSIC
                */

                music:
                    state.music || null,


                /*
                 LOCATION
                */

                location:
                    state.location || "",


                /*
                 COLLABORATOR
                */

                collaborator:
                    state.collaborator || null,


                /*
                 TAGS
                */

                tags:
                    Array.isArray(state.tags)
                        ? state.tags
                        : [],


                /*
                 AUDIENCE
                */

                audience:
                    state.audience || "Everyone",


                /*
                 SETTINGS
                */

                allowComments:
                    state.allowComments === true,

                hideLikes:
                    state.hideLikes === true,

                allowSaves:
                    state.allowSaves === true,


                /*
                 CREATOR IDS
                */

                uid:
                    user.uid,

                userId:
                    user.uid,

                ownerId:
                    user.uid,

                creatorId:
                    user.uid,


                /*
                 CREATOR PROFILE
                */

                username:
                    profile.username,

                displayName:
                    profile.displayName,

                userName:
                    profile.displayName,

                avatar:
                    profile.avatar,


                /*
                 STATS
                */

                likes:
                    0,

                comments:
                    0,

                shares:
                    0,

                saves:
                    0,

                views:
                    0,


                /*
                 EXTRA STATE
                */

                rotation:
                    state.rotation,

                fit:
                    state.fit,


                /*
                 TIMESTAMPS
                */

                createdAt:
                    firebase.database.ServerValue.TIMESTAMP,

                updatedAt:
                    firebase.database.ServerValue.TIMESTAMP

            };


            /*
             --------------------------------------------
             WRITE POST
             --------------------------------------------
            */

            updateProcessing(
                "Publishing your post..."
            );


            await database
                .ref(
                    `posts/${postId}`
                )
                .set(
                    postData
                );


            /*
             --------------------------------------------
             USER POST INDEX
             --------------------------------------------
            */

            updateProcessing(
                "Updating your profile..."
            );


            await database
                .ref(
                    `userPosts/${user.uid}/${postId}`
                )
                .set({

                    postId:
                        postId,

                    type:
                        "post",

                    createdAt:
                        firebase.database.ServerValue.TIMESTAMP

                });


            /*
             --------------------------------------------
             UPDATE USER POST COUNT
             --------------------------------------------
            */

            try {

                const userRef =
                    database.ref(
                        `users/${user.uid}`
                    );


                const userSnapshot =
                    await userRef.once(
                        "value"
                    );


                const userData =
                    userSnapshot.val() ||
                    {};


                const currentPosts =
                    Number(
                        userData.posts || 0
                    );


                await userRef.update({

                    posts:
                        currentPosts + 1,

                    updatedAt:
                        firebase.database.ServerValue.TIMESTAMP

                });

            } catch (countError) {

                /*
                 Do not fail the post if
                 only the counter update fails.
                */

                console.warn(
                    "Post count update skipped:",
                    countError
                );

            }


            /*
             --------------------------------------------
             CLEAN TEMP MEDIA
             --------------------------------------------
            */

            cleanupMediaStorage();


            /*
             --------------------------------------------
             SUCCESS
             --------------------------------------------
            */

            hideProcessing();


            showToast(
                "Post published",
                "Your post is now live on Viewora."
            );


            /*
             Prevent second click
             */

            setPublishState(
                true
            );


            /*
             Redirect
             */

            setTimeout(
                () => {

                    window.location.replace(
                        "index.html"
                    );

                },
                1000
            );


        } catch (error) {

            console.error(
                "❌ VIEWORA PUBLISH ERROR:",
                error
            );


            hideProcessing();


            state.publishing =
                false;


            setPublishState(
                false
            );


            showToast(
                "Publish failed",
                getFriendlyError(
                    error
                )
            );

        }

    }


    /* ======================================================
       PROCESSING UI
    ====================================================== */

    function showProcessing(
        message
    ) {

        const overlay =
            $("processingOverlay");


        if (!overlay) {
            return;
        }


        const heading =
            overlay.querySelector(
                "h2"
            );


        const text =
            overlay.querySelector(
                "p"
            );


        if (heading) {

            heading.textContent =
                message ||
                "Preparing your post";

        }


        if (text) {

            text.textContent =
                "Please wait...";

        }


        overlay.classList.remove(
            "hidden"
        );

    }


    function updateProcessing(
        message
    ) {

        const overlay =
            $("processingOverlay");


        if (!overlay) {
            return;
        }


        const heading =
            overlay.querySelector(
                "h2"
            );


        if (heading) {

            heading.textContent =
                message;

        }

    }


    function hideProcessing() {

        $("processingOverlay")
            ?.classList.add(
                "hidden"
            );

    }


    /* ======================================================
       PUBLISH BUTTON STATE
    ====================================================== */

    function setPublishState(
        loading
    ) {

        const next =
            $("nextBtn");

        const publish =
            $("publishBtn");


        if (next) {

            next.disabled =
                loading;


            next.innerHTML =
                loading
                    ? `
                        Publishing...
                        <i class="fa-solid fa-spinner fa-spin"></i>
                      `
                    : `
                        Next
                        <i class="fa-solid fa-arrow-right"></i>
                      `;

        }


        if (publish) {

            publish.disabled =
                loading;


            publish.innerHTML =
                loading
                    ? `
                        <span>
                            Publishing...
                        </span>

                        <i class="fa-solid fa-spinner fa-spin"></i>
                      `
                    : `
                        <span>
                            Share Post
                        </span>

                        <i class="fa-solid fa-arrow-up"></i>
                      `;

        }

    }


    /* ======================================================
       CLEANUP
    ====================================================== */

    function cleanupMediaStorage() {

        const keys = [

            "viewora_edit_post_media",

            "viewora_edit_post_type",

            "vieworaUploadMedia",

            "viewora_media"

        ];


        keys.forEach(
            key => {

                try {

                    sessionStorage.removeItem(
                        key
                    );

                } catch (_) {}


                try {

                    localStorage.removeItem(
                        key
                    );

                } catch (_) {}

            }
        );

    }


    /* ======================================================
       FRIENDLY ERROR
    ====================================================== */

    function getFriendlyError(
        error
    ) {

        if (!error) {

            return "Something went wrong.";

        }


        const code =
            error.code ||
            "";


        const message =
            String(
                error.message ||
                ""
            );


        if (
            code ===
            "database/permission-denied"
        ) {

            return (
                "Firebase Database permission denied."
            );

        }


        if (
            code ===
            "auth/network-request-failed"
        ) {

            return (
                "Network error. Check your internet connection."
            );

        }


        if (
            message
                .toLowerCase()
                .includes(
                    "cloudinary"
                )
        ) {

            return message;

        }


        if (
            message
                .toLowerCase()
                .includes(
                    "upload preset"
                )
        ) {

            return (
                "Cloudinary upload preset is missing or invalid."
            );

        }


        if (
            message
                .toLowerCase()
                .includes(
                    "cloud name"
                )
        ) {

            return (
                "Cloudinary cloud name is missing."
            );

        }


        return (
            message ||
            "Unable to publish your post."
        );

    }


    /* ======================================================
       TOAST
    ====================================================== */

    function showToast(
        title,
        text
    ) {

        const toast =
            $("toast");


        if (!toast) {
            return;
        }


        const titleEl =
            $("toastTitle");

        const textEl =
            $("toastText");


        if (titleEl) {

            titleEl.textContent =
                title;

        }


        if (textEl) {

            textEl.textContent =
                text;

        }


        toast.classList.remove(
            "hidden"
        );


        clearTimeout(
            window.__VIEWORA_EDIT_TOAST__
        );


        window.__VIEWORA_EDIT_TOAST__ =
            setTimeout(
                () => {

                    toast.classList.add(
                        "hidden"
                    );

                },
                3500
            );

    }


    /* ======================================================
       ESCAPE HTML
    ====================================================== */

    function escapeHTML(
        value
    ) {

        return String(
            value
        )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

    }


})();