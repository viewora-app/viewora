// @ts-nocheck
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
        mediaFiles: [],
        mediaUrls: [],

        location: "",

        collaborator: null,

        tags: [],

        audience: "Everyone",
        ratio: "portrait",

        allowComments: true,

        hideLikes: false,

        allowSaves: true,

        publishing: false,
        isEditMode: false,
        editPostId: ""

    };


    /* ======================================================
       INIT
    ====================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        init
    );


    
    function getPreviewImg() {
        return document.getElementById("postPreview") ||
               document.getElementById("previewImage") ||
               document.querySelector(".postPreview");
    }
    function getMediaStage() {
        return document.getElementById("mediaCanvas") ||
               document.querySelector(".mediaCanvas") ||
               document.querySelector(".mediaStage") ||
               document.querySelector(".previewCard") ||
               (getPreviewImg() && getPreviewImg().parentElement);
    }

    async function init() {

        // Existing post edit → caption/settings only (no media change)
        try {
            const p = new URLSearchParams(location.search);
            state.editPostId = p.get("postId") || p.get("id") || p.get("edit") || "";
            state.isEditMode = !!state.editPostId;
            if (state.isEditMode) {
                document.body.classList.add("editMode");
                const pub = document.getElementById("publishBtn");
                if (pub) {
                    const t = pub.querySelector("span") || pub;
                    if (t) t.textContent = "Save";
                }
            }
        } catch (_) {}

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

        try { setupMusicTrim(); } catch (e) { console.warn("music trim setup", e); }
        try { setupRatio(); } catch (e) { console.warn("ratio setup", e); }
        try { updatePhotoCounter(); } catch (_) {}
        try { setupMediaSwipe(); } catch (e) { console.warn("swipe init", e); }

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

    
    async function loadMultiFromIDB() {
        try {
            const multi =
                sessionStorage.getItem("viewora_post_multi_ready") ||
                sessionStorage.getItem("viewora_post_multi") ||
                (new URLSearchParams(location.search).get("multi") ? "1" : "");
            if (!multi) return false;
            const dbp = indexedDB.open("VIEWORA_POST_IMAGES_DB", 3);
            const db = await new Promise((resolve, reject) => {
                dbp.onsuccess = () => resolve(dbp.result);
                dbp.onerror = () => reject(dbp.error);
                dbp.onupgradeneeded = () => {
                    const d = dbp.result;
                    if (!d.objectStoreNames.contains("images")) {
                        d.createObjectStore("images");
                    }
                };
            });
            const count = await new Promise((resolve) => {
                try {
                    const tx = db.transaction("images", "readonly");
                    const req = tx.objectStore("images").get("count");
                    req.onsuccess = () => resolve(Number(req.result) || 0);
                    req.onerror = () => resolve(0);
                } catch (_) {
                    resolve(0);
                }
            });
            if (!count) return false;
            const files = [];
            for (let i = 0; i < count && i < 10; i++) {
                const raw = await new Promise((resolve) => {
                    try {
                        const tx = db.transaction("images", "readonly");
                        const req = tx.objectStore("images").get("img_" + i);
                        req.onsuccess = () => resolve(req.result || null);
                        req.onerror = () => resolve(null);
                    } catch (_) {
                        resolve(null);
                    }
                });
                if (!raw) continue;
                try {
                    if (raw instanceof Blob) {
                        files.push(raw);
                    } else if (raw.buffer) {
                        // ArrayBuffer pack from upload.js
                        const buf = raw.buffer instanceof ArrayBuffer
                            ? raw.buffer
                            : raw.buffer;
                        files.push(
                            new File([buf], raw.name || ("photo_" + (i + 1) + ".jpg"), {
                                type: raw.type || "image/jpeg"
                            })
                        );
                    } else if (raw.blob instanceof Blob) {
                        files.push(
                            new File([raw.blob], raw.name || ("photo_" + (i + 1) + ".jpg"), {
                                type: raw.type || raw.blob.type || "image/jpeg"
                            })
                        );
                    }
                } catch (e) {
                    console.warn("img restore", i, e);
                }
            }
            if (!files.length) return false;
            state.mediaFiles = files;
            state.media = files[0];
            state.mediaType = "image";
            state.mediaIndex = 0;
            const preview = getPreviewImg();
            if (preview) {
                preview.src = URL.createObjectURL(files[0]);
                preview.classList.add("loaded");
            }
            try {
                document.getElementById("mediaLoader")?.classList.add("hidden");
                document.getElementById("mediaLoading")?.classList.add("hidden");
            } catch (_) {}
            try { renderMediaStrip(); } catch (_) {}
            console.log("[VIEWORA] multi photos loaded:", files.length);
            try { updatePhotoCounter(); } catch(_){}
            try {
                const pc = document.getElementById("photoCounter");
                if (pc) {
                    pc.classList.remove("hidden");
                    pc.innerHTML = '<i class="fa-regular fa-images"></i><span>1 / ' + files.length + '</span>';
                }
            } catch (_) {}
            try { setupMediaSwipe(); } catch (e) { console.warn("swipe", e); }
            try { showMediaAt(0); } catch (_) {}
            return true;
        } catch (e) {
            console.warn("loadMultiFromIDB", e);
            return false;
        }
    }


    async function loadMedia() {
        try {
            if (await loadMultiFromIDB()) return;
        } catch (_) {}
        // One more delayed retry for slow IDB after navigation
        try {
            const multi =
                new URLSearchParams(location.search).get("multi") ||
                sessionStorage.getItem("viewora_post_multi_ready");
            if (multi) {
                await new Promise((r) => setTimeout(r, 350));
                if (await loadMultiFromIDB()) return;
            }
        } catch (_) {}


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


        state.media = media;
        state.mediaType = type;
        // Multi-post support (max 10)
        if (!Array.isArray(state.mediaFiles)) state.mediaFiles = [];
        if (state.mediaFiles.length === 0 && media) {
            // convert dataURL → Blob for queue
            try {
                if (typeof media === "string" && media.indexOf("data:") === 0) {
                    state.mediaFiles = [dataURLtoBlob(media, "image/jpeg")];
                    state.media = state.mediaFiles[0];
                } else if (media instanceof Blob) {
                    state.mediaFiles = [media];
                }
            } catch (_) {}
        }
        renderMediaStrip();


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
            console.error("Media preview failed.");
            // If multi files exist, try next — don't bounce to upload
            if (state.mediaFiles && state.mediaFiles.length > 1) {
                try {
                    preview.src = URL.createObjectURL(state.mediaFiles[0]);
                } catch (_) {}
                return;
            }
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


        // Crop/Adjust handled by setupCropAdjust()
        try { setupCropAdjust(); } catch (_) {}
        try { setupMediaSwipe(); } catch (_) {}

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

    let postMusicTracks = [];
    let postMusicPreview = null;

    function setupMusic() {

        $("musicBtn")?.addEventListener(
            "click",
            async () => {
                openSheet("musicSheet");
                const list = $("musicList");
                if (list) {
                    list.innerHTML = `
                        <div class="emptyState">
                            <i class="fa-solid fa-spinner fa-spin"></i>
                            <strong>Loading music…</strong>
                        </div>`;
                }
                await loadPostMusicTracks();
                renderMusic();
            }
        );

        $("musicSearch")?.addEventListener(
            "input",
            () => renderMusic()
        );
    }

    async function loadPostMusicTracks() {
        const database = (() => {
            try { return getDatabase(); } catch (_) { return null; }
        })();

        const rows = [
            {
                id: "original",
                title: "Original audio",
                artist: "Your post",
                audioUrl: "",
                icon: "fa-music"
            }
        ];

        if (!database) {
            postMusicTracks = rows;
            return;
        }

        try {
            const snap = await database.ref("musicLibrary").once("value");
            if (snap.exists()) {
                snap.forEach((c) => {
                    const v = c.val() || {};
                    if (v.active === false) return;
                    rows.push({
                        id: c.key,
                        title: v.title || v.name || "Untitled",
                        artist: v.artist || v.singer || "Unknown",
                        audioUrl: v.audioUrl || v.url || v.src || "",
                        coverUrl: v.coverUrl || v.cover || "",
                        uses: Number(v.uses || 0),
                        icon: "fa-music"
                    });
                });
            }
        } catch (e) {
            console.warn("post music load", e);
        }

        postMusicTracks = rows;
    }

    function stopPostMusicPreview() {
        if (postMusicPreview) {
            try { postMusicPreview.pause(); } catch (_) {}
            postMusicPreview = null;
        }
    }

    function renderMusic() {

        const list = $("musicList");
        if (!list) return;

        const search = ($("musicSearch")?.value || "").trim().toLowerCase();

        const filtered = postMusicTracks.filter((item) =>
            `${item.title} ${item.artist}`.toLowerCase().includes(search)
        );

        list.innerHTML = "";

        if (!filtered.length) {
            list.innerHTML = `
                <div class="emptyState">
                    <i class="fa-solid fa-music"></i>
                    <strong>No music found</strong>
                    <span>Add tracks in Admin → Music, or try another search.</span>
                </div>`;
            return;
        }

        filtered.forEach((item) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "musicItem";

            const art = item.coverUrl
                ? `<img src="${escapeHTML(item.coverUrl)}" alt="" onerror="this.parentElement.innerHTML='<i class=\'fa-solid fa-music\'></i>'">`
                : `<i class="fa-solid ${item.icon || "fa-music"}"></i>`;

            button.innerHTML = `
                <span class="musicArtwork">${art}</span>
                <span class="musicMeta">
                    <strong>${escapeHTML(item.title)}</strong>
                    <span>${escapeHTML(item.artist)}${item.uses ? " · " + item.uses + " uses" : ""}</span>
                </span>
                <span class="musicPlay"><i class="fa-solid fa-play"></i></span>
            `;

            button.addEventListener("click", () => {
                // Open trim / clip picker — not instant select
                openMusicTrim({
                    id: item.id,
                    title: item.title,
                    name: item.title,
                    artist: item.artist,
                    audioUrl: item.audioUrl || "",
                    coverUrl: item.coverUrl || ""
                });
            });

            list.appendChild(button);
        });
    }


    
    let pendingMusic = null;

        function openMusicTrim(item) {
        pendingMusic = item;
        stopPostMusicPreview();
        closeSheet("musicSheet");

        // Original audio with no URL → apply directly
        if (!item.audioUrl && item.id === "original") {
            applyMusicClip(item, 0, 15);
            return;
        }
        if (!item.audioUrl) {
            applyMusicClip(item, 0, 15);
            showToast("Music set", item.title || "Track");
            return;
        }

        const sheet = $("musicTrimSheet");
        if (!sheet) {
            applyMusicClip(item, 0, 15);
            return;
        }

        if ($("musicTrimTitle")) {
            $("musicTrimTitle").textContent =
                (item.title || "Track") + (item.artist ? " · " + item.artist : "");
        }

        const startR = $("musicStartRange");
        const lenR = $("musicLenRange");
        if (startR) {
            startR.min = "0";
            startR.max = "300";
            startR.step = "0.5";
            startR.value = "0";
        }
        if (lenR) {
            lenR.min = "5";
            lenR.max = "60";
            lenR.value = "15";
        }
        try { updateMusicTrimLabels(); } catch (_) {}

        // Open as proper overlay (same as music sheet)
        sheet.classList.remove("hidden");
        sheet.hidden = false;
        sheet.style.display = "";
        document.body.classList.add("sheetOpen");

        if (item.audioUrl) {
            try {
                const a = new Audio();
                a.preload = "metadata";
                a.src = item.audioUrl;
                a.addEventListener("loadedmetadata", function () {
                    const dur = Math.max(15, Math.floor(a.duration || 0));
                    if (startR) startR.max = String(Math.max(0, dur - 5));
                    if (lenR) lenR.max = String(Math.min(60, dur));
                    try { updateMusicTrimLabels(); } catch (_) {}
                });
            } catch (_) {}
        }
    }


    function applyMusicClip(item, startAt, duration) {
        state.music = {
            id: item.id,
            title: item.title,
            name: item.title,
            artist: item.artist,
            audioUrl: item.audioUrl || "",
            coverUrl: item.coverUrl || "",
            startAt: Number(startAt) || 0,
            duration: Number(duration) || 15,
            endAt: (Number(startAt) || 0) + (Number(duration) || 15)
        };
        try {
            const small = $("musicBtn")?.querySelector(".toolText small");
            if (small) small.textContent = item.title + " (" + Math.round(state.music.startAt) + "s)";
        } catch (_) {}
        showToast("Music clip set", item.title);
        closeSheet("musicTrimSheet");
        const sheet = $("musicTrimSheet");
        if (sheet) {
            sheet.hidden = true;
            sheet.classList.add("hidden");
            sheet.classList.remove("open");
            sheet.style.display = "";
        }
        stopPostMusicPreview();
    }

    function setupMusicTrim() {
        if (window.__musicTrimWired) return;
        window.__musicTrimWired = true;

        function readTrim() {
            const start = Number($("musicStartRange")?.value || 0);
            const len = Number($("musicLenRange")?.value || 15);
            return { start: isFinite(start) ? start : 0, len: isFinite(len) && len > 0 ? len : 15 };
        }

        document.addEventListener("input", function (e) {
            const t = e.target;
            if (!t || !t.id) return;
            if (t.id === "musicStartRange" || t.id === "musicLenRange") {
                updateMusicTrimLabels();
            }
        });

        document.addEventListener("click", function (e) {
            const t = e.target;
            if (!t) return;
            const btn = t.closest ? t.closest("button, [role=button], a") : t;

            // Preview
            if (btn && (btn.id === "musicPreviewBtn" || (btn.textContent || "").trim() === "Preview")) {
                if (!pendingMusic || !pendingMusic.audioUrl) return;
                e.preventDefault();
                e.stopPropagation();
                stopPostMusicPreview();
                const { start, len } = readTrim();
                try {
                    postMusicPreview = new Audio(pendingMusic.audioUrl);
                    postMusicPreview.currentTime = start;
                    postMusicPreview.volume = 0.8;
                    postMusicPreview.play().catch(function () {});
                    clearTimeout(window.__musicTrimStop);
                    window.__musicTrimStop = setTimeout(function () {
                        stopPostMusicPreview();
                    }, len * 1000);
                } catch (_) {}
                return;
            }

            // Use this clip
            if (btn && (btn.id === "musicTrimConfirm" || /use this clip/i.test(btn.textContent || ""))) {
                e.preventDefault();
                e.stopPropagation();
                if (!pendingMusic) {
                    showToast("No track", "Select a song first");
                    return;
                }
                const { start, len } = readTrim();
                applyMusicClip(pendingMusic, start, len);
                return;
            }

            // Close sheet
            const closer = t.closest ? t.closest('[data-close="musicTrimSheet"]') : null;
            if (closer || (btn && btn.getAttribute && btn.getAttribute("data-close") === "musicTrimSheet")) {
                closeSheet("musicTrimSheet");
                const sheet = $("musicTrimSheet");
                if (sheet) {
                    sheet.hidden = true;
                    sheet.classList.add("hidden");
                    sheet.classList.remove("open");
                }
                stopPostMusicPreview();
            }
        }, true);
    }


    
    function dataURLtoBlob(dataURL, mime) {
        try {
            const parts = String(dataURL).split(",");
            const meta = parts[0] || "";
            const b64 = parts[1] || "";
            const m = /data:([^;]+)/.exec(meta);
            const type = (m && m[1]) || mime || "image/jpeg";
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], { type: type });
        } catch (e) {
            console.warn("dataURLtoBlob", e);
            return null;
        }
    }

    function renderMediaStrip() {
        let strip = document.getElementById("postMediaStrip");
        if (!strip) {
            const canvas = document.getElementById("mediaCanvas");
            const host = document.querySelector(".mediaSection");
            if (!host) return;
            strip = document.createElement("div");
            strip.id = "postMediaStrip";
            strip.className = "postMediaStrip";
            // Place UNDER the photo (Instagram style), never beside
            if (canvas && canvas.parentElement === host) {
                canvas.insertAdjacentElement("afterend", strip);
            } else {
                host.appendChild(strip);
            }
        }
        const files = state.mediaFiles || [];
        let html = "";
        files.forEach((f, i) => {
            const url =
                typeof f === "string"
                    ? f
                    : URL.createObjectURL(f);
            html +=
                '<button type="button" class="stripItem' +
                (i === (state.mediaIndex || 0) ? " active" : "") +
                '" data-strip-i="' +
                i +
                '"><img src="' +
                url +
                '" alt=""><span class="stripNum">' +
                (i + 1) +
                "</span></button>";
        });
        if (!state.isEditMode && files.length < 10) {
            html +=
                '<button type="button" class="stripAdd" id="postAddMediaBtn" title="Add photo (max 10)"><i class="fa-solid fa-plus"></i><small>' +
                files.length +
                "/10</small></button>";
        }
        strip.innerHTML = html;
        strip.querySelectorAll("[data-strip-i]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const i = Number(btn.getAttribute("data-strip-i"));
                showMediaAt(i);
            });
        });
        const addBtn = document.getElementById("postAddMediaBtn");
        if (addBtn) {
            addBtn.onclick = () => {
                let input = document.getElementById("multiPostInput");
                if (!input) {
                    input = document.createElement("input");
                    input.type = "file";
                    input.id = "multiPostInput";
                    input.accept = "image/*";
                    input.multiple = true;
                    input.hidden = true;
                    document.body.appendChild(input);
                    input.addEventListener("change", onMultiPostPick);
                }
                input.value = "";
                input.click();
            };
        }
    }


    function showMediaAt(index) {
        const files = state.mediaFiles || [];
        if (!files.length) return;
        let i = Number(index) || 0;
        if (i < 0) i = 0;
        if (i >= files.length) i = files.length - 1;
        state.mediaIndex = i;
        state.media = files[i];
        const preview = getPreviewImg();
        if (preview && files[i]) {
            const f = files[i];
            // revoke old blob URL to avoid leaks
            try {
                if (preview.dataset.blobUrl) URL.revokeObjectURL(preview.dataset.blobUrl);
            } catch (_) {}
            if (typeof f === "string") {
                preview.src = f;
            } else {
                const url = URL.createObjectURL(f);
                preview.dataset.blobUrl = url;
                preview.src = url;
            }
            preview.classList.add("loaded");
        }
        const pc = document.getElementById("photoCounter");
        if (pc) {
            pc.classList.remove("hidden");
            const span = pc.querySelector("span") || pc;
            if (span.tagName === "SPAN" || span !== pc) {
                span.textContent = (i + 1) + " / " + files.length;
            } else {
                pc.innerHTML = '<i class="fa-regular fa-images"></i><span>' + (i + 1) + " / " + files.length + "</span>";
            }
        }
        try { renderMediaStrip(); } catch (_) {}
        try { setupMediaSwipe(); } catch (_) {}
        const nav = document.getElementById("multiNav");
        if (nav) nav.style.display = (files.length > 1) ? "flex" : "none";
        try { updatePhotoCounter(); } catch (_) {}
    }

    function setupMediaSwipe() {
        const img = getPreviewImg();
        const stage = getMediaStage();
        if (!stage) {
            console.warn("[VIEWORA] no media stage for swipe");
            return;
        }

        stage.style.position = "relative";
        stage.style.touchAction = "pan-y";
        stage.style.userSelect = "none";
        stage.style.webkitUserSelect = "none";

        let nav = document.getElementById("multiNav");
        if (!nav) {
            nav = document.createElement("div");
            nav.id = "multiNav";
            nav.className = "multiNav";
            nav.innerHTML =
                '<button type="button" id="multiPrev" class="multiNavBtn" aria-label="Previous"><i class="fa-solid fa-chevron-left"></i></button>' +
                '<button type="button" id="multiNext" class="multiNavBtn" aria-label="Next"><i class="fa-solid fa-chevron-right"></i></button>';
            stage.appendChild(nav);
        }

        const prev = document.getElementById("multiPrev");
        const next = document.getElementById("multiNext");
        if (prev && !prev.__bound) {
            prev.__bound = true;
            prev.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                showMediaAt((state.mediaIndex || 0) - 1);
            });
        }
        if (next && !next.__bound) {
            next.__bound = true;
            next.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                showMediaAt((state.mediaIndex || 0) + 1);
            });
        }

        function syncNav() {
            const n = (state.mediaFiles || []).length;
            if (nav) nav.style.display = n > 1 ? "flex" : "none";
        }
        syncNav();

        if (stage.__swipeBound) {
            syncNav();
            return;
        }
        stage.__swipeBound = true;

        let startX = 0, startY = 0, tracking = false;

        function onStart(clientX, clientY) {
            if ((state.mediaFiles || []).length < 2) return false;
            startX = clientX;
            startY = clientY;
            tracking = true;
            return true;
        }
        function onEnd(clientX, clientY) {
            if (!tracking) return;
            tracking = false;
            const dx = clientX - startX;
            const dy = clientY - startY;
            if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy) * 0.65) return;
            const i = state.mediaIndex || 0;
            if (dx < 0) showMediaAt(i + 1);
            else showMediaAt(i - 1);
            syncNav();
        }

        stage.addEventListener("touchstart", function (e) {
            if (!e.touches || e.touches.length !== 1) return;
            onStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        stage.addEventListener("touchend", function (e) {
            const t = e.changedTouches && e.changedTouches[0];
            if (!t) return;
            onEnd(t.clientX, t.clientY);
        }, { passive: true });

        // Also on the image itself
        if (img) {
            img.style.pointerEvents = "none"; // let stage receive touches
        }

        let md = false;
        stage.addEventListener("mousedown", function (e) {
            if (e.target && e.target.closest && e.target.closest("button")) return;
            md = onStart(e.clientX, e.clientY);
        });
        stage.addEventListener("mouseup", function (e) {
            if (!md) return;
            md = false;
            onEnd(e.clientX, e.clientY);
        });

        document.addEventListener("keydown", function (e) {
            if ((state.mediaFiles || []).length < 2) return;
            if (e.key === "ArrowLeft") showMediaAt((state.mediaIndex || 0) - 1);
            if (e.key === "ArrowRight") showMediaAt((state.mediaIndex || 0) + 1);
        });

        console.log("[VIEWORA] multi swipe ready, photos:", (state.mediaFiles || []).length);
    }

    function setupCropAdjust() {
        const btn = document.getElementById("adjustBtn");
        if (!btn || btn.__cropBound) return;
        btn.__cropBound = true;

        // Build crop sheet once
        let sheet = document.getElementById("cropSheet");
        if (!sheet) {
            sheet = document.createElement("div");
            sheet.id = "cropSheet";
            sheet.className = "cropSheet hidden";
            sheet.innerHTML =
                '<div class="cropSheetInner">' +
                '<div class="cropHead"><strong>Adjust &amp; Crop</strong>' +
                '<button type="button" id="cropCloseBtn" class="cropClose"><i class="fa-solid fa-xmark"></i></button></div>' +
                '<div class="cropStage"><img id="cropImage" alt=""></div>' +
                '<div class="cropAspects">' +
                '<button type="button" data-aspect="free" class="aspectBtn active">Free</button>' +
                '<button type="button" data-aspect="1" class="aspectBtn">1:1</button>' +
                '<button type="button" data-aspect="4/5" class="aspectBtn">4:5</button>' +
                '<button type="button" data-aspect="16/9" class="aspectBtn">16:9</button>' +
                '</div>' +
                '<div class="cropActions">' +
                '<button type="button" id="cropRotateBtn" class="cropAct"><i class="fa-solid fa-rotate"></i> Rotate</button>' +
                '<button type="button" id="cropApplyBtn" class="cropAct primary">Apply</button>' +
                '</div></div>';
            document.body.appendChild(sheet);
        }

        let cropRotation = 0;
        let cropAspect = "free";

        function openCrop() {
            const files = state.mediaFiles || [];
            const i = state.mediaIndex || 0;
            const f = files[i] || state.media;
            if (!f) {
                showToast("No photo", "Select a photo first");
                return;
            }
            const img = document.getElementById("cropImage");
            if (img) {
                img.src = typeof f === "string" ? f : URL.createObjectURL(f);
                img.style.transform = "rotate(0deg)";
            }
            cropRotation = 0;
            cropAspect = "free";
            sheet.querySelectorAll(".aspectBtn").forEach(function (b) {
                b.classList.toggle("active", b.getAttribute("data-aspect") === "free");
            });
            sheet.classList.remove("hidden");
        }

        function closeCrop() {
            sheet.classList.add("hidden");
        }

        btn.addEventListener("click", openCrop);
        sheet.querySelector("#cropCloseBtn")?.addEventListener("click", closeCrop);

        sheet.querySelectorAll(".aspectBtn").forEach(function (b) {
            b.addEventListener("click", function () {
                sheet.querySelectorAll(".aspectBtn").forEach(function (x) { x.classList.remove("active"); });
                b.classList.add("active");
                cropAspect = b.getAttribute("data-aspect") || "free";
                const stage = sheet.querySelector(".cropStage");
                if (stage) {
                    stage.setAttribute("data-aspect", cropAspect);
                }
            });
        });

        sheet.querySelector("#cropRotateBtn")?.addEventListener("click", function () {
            cropRotation = (cropRotation + 90) % 360;
            const img = document.getElementById("cropImage");
            if (img) img.style.transform = "rotate(" + cropRotation + "deg)";
        });

        sheet.querySelector("#cropApplyBtn")?.addEventListener("click", function () {
            const img = document.getElementById("cropImage");
            if (!img || !img.naturalWidth) {
                closeCrop();
                return;
            }
            try {
                const canvas = document.createElement("canvas");
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                let cw = w, ch = h;
                // aspect crop center
                if (cropAspect === "1") {
                    const s = Math.min(w, h);
                    cw = s; ch = s;
                } else if (cropAspect === "4/5") {
                    if (w / h > 4 / 5) { ch = h; cw = Math.round(h * 4 / 5); }
                    else { cw = w; ch = Math.round(w * 5 / 4); }
                } else if (cropAspect === "16/9") {
                    if (w / h > 16 / 9) { ch = h; cw = Math.round(h * 16 / 9); }
                    else { cw = w; ch = Math.round(w * 9 / 16); }
                }
                const sx = Math.floor((w - cw) / 2);
                const sy = Math.floor((h - ch) / 2);
                canvas.width = cw;
                canvas.height = ch;
                const ctx = canvas.getContext("2d");
                ctx.save();
                if (cropRotation) {
                    // simple rotate: redraw full then crop is complex — apply rotation on output
                    canvas.width = (cropRotation % 180 === 0) ? cw : ch;
                    canvas.height = (cropRotation % 180 === 0) ? ch : cw;
                    ctx.translate(canvas.width / 2, canvas.height / 2);
                    ctx.rotate((cropRotation * Math.PI) / 180);
                    ctx.drawImage(img, sx, sy, cw, ch, -cw / 2, -ch / 2, cw, ch);
                } else {
                    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
                }
                ctx.restore();
                canvas.toBlob(function (blob) {
                    if (!blob) { closeCrop(); return; }
                    const file = new File([blob], "crop-" + Date.now() + ".jpg", { type: "image/jpeg" });
                    const i = state.mediaIndex || 0;
                    if (!Array.isArray(state.mediaFiles)) state.mediaFiles = [];
                    state.mediaFiles[i] = file;
                    state.media = file;
                    showMediaAt(i);
                    closeCrop();
                    showToast("Applied", "Photo adjusted");
                }, "image/jpeg", 0.92);
            } catch (err) {
                console.error(err);
                closeCrop();
                showToast("Crop failed", "Try again");
            }
        });
    }


    function onMultiPostPick(e) {
        const list = Array.from(e.target.files || []);
        if (!list.length) return;
        if (!Array.isArray(state.mediaFiles)) state.mediaFiles = [];
        const room = 10 - state.mediaFiles.length;
        const take = list.slice(0, room);
        take.forEach((f) => {
            if (f && f.type && f.type.indexOf("image") === 0) {
                state.mediaFiles.push(f);
            }
        });
        if (state.mediaFiles.length) {
            state.media = state.mediaFiles[state.mediaFiles.length - 1];
            state.mediaIndex = state.mediaFiles.length - 1;
            const preview = document.getElementById("previewImage");
            if (preview) {
                preview.src = URL.createObjectURL(state.media);
            }
        }
        renderMediaStrip();
        if (list.length > room) {
            showToast("Max 10", "Only 10 photos allowed per post");
        }
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

    
    function applyPreviewRatio(ratio) {
        const stage = getMediaStage();
        const img = getPreviewImg();
        const r = ratio || state.ratio || "portrait";
        if (stage) {
            stage.classList.remove("ratio-portrait", "ratio-square", "ratio-mixed");
            stage.classList.add("ratio-" + r);
        }
        if (img) {
            img.style.width = "100%";
            img.style.height = "auto";
            img.style.maxHeight = "70vh";
            if (r === "square") {
                img.style.objectFit = "cover";
                img.style.aspectRatio = "1 / 1";
            } else if (r === "portrait") {
                img.style.objectFit = "cover";
                img.style.aspectRatio = "4 / 5";
            } else {
                img.style.objectFit = "contain";
                img.style.aspectRatio = "auto";
            }
        }
        const label = $("ratioValue");
        if (label) {
            label.textContent = r === "square" ? "Square" : r === "mixed" ? "Mixed" : "Portrait";
        }
        // Also update any other preview refs
        try {
            state.ratio = r;
        } catch (_) {}
    }

    function setupRatio() {
        if (window.__ratioWired) return;
        window.__ratioWired = true;
        $("ratioBtn")?.addEventListener("click", function () {
            openSheet("ratioSheet");
            qsa(".ratioOption").forEach(function (b) {
                b.classList.toggle("active", (b.getAttribute("data-ratio") || "") === (state.ratio || "portrait"));
            });
        });
        qsa(".ratioOption").forEach(function (btn) {
            btn.addEventListener("click", function () {
                qsa(".ratioOption").forEach(function (b) { b.classList.remove("active"); });
                btn.classList.add("active");
                state.ratio = btn.getAttribute("data-ratio") || "portrait";
                applyPreviewRatio(state.ratio);
            });
        });
        $("ratioDoneBtn")?.addEventListener("click", function () {
            closeSheet("ratioSheet");
            applyPreviewRatio(state.ratio);
        });
        document.querySelectorAll('[data-close="ratioSheet"]').forEach(function (el) {
            el.addEventListener("click", function () {
                closeSheet("ratioSheet");
            });
        });
        applyPreviewRatio(state.ratio || "portrait");
    }

    
    function updatePhotoCounter() {
        const el = document.querySelector(".photoCounter");
        if (!el) return;
        const n = (state.mediaFiles && state.mediaFiles.length) || (state.media ? 1 : 0);
        const i = (state.mediaIndex || 0) + 1;
        if (n > 1) {
            el.classList.remove("hidden");
            el.innerHTML = '<i class="fa-regular fa-images"></i><span>' + i + ' / ' + n + '</span>';
        } else {
            el.classList.add("hidden");
        }
    }

    function setupPublish() {
        function oncePublish(e) {
            try { e && e.preventDefault && e.preventDefault(); } catch (_) {}
            if (state.publishing || window.__vieworaPublishingLock) {
                try { showToast("Please wait", "Publishing…"); } catch (_) {}
                return;
            }
            publishPost().catch(function (err) {
                console.error("publish", err);
                try { showToast("Error", (err && err.message) || "Failed"); } catch (_) {}
                state.publishing = false;
                window.__vieworaPublishingLock = false;
                try { setPublishState(false); } catch (_) {}
            });
        }
        const pub = $("publishBtn");
        if (pub && !pub.__pubBound) {
            pub.__pubBound = true;
            pub.addEventListener("click", oncePublish);
        }
        // Fallback: any button that says Share Post
        document.querySelectorAll("button").forEach(function (btn) {
            const t = (btn.textContent || "").trim().toLowerCase();
            if ((t === "share post" || t === "share" || t === "save") && !btn.__pubBound) {
                btn.__pubBound = true;
                btn.addEventListener("click", oncePublish);
            }
        });
        const next = $("nextBtn");
        if (next && !next.__pubBound) {
            next.__pubBound = true;
            next.addEventListener("click", function (e) {
                e.preventDefault();
                try { $("captionInput")?.focus(); } catch (_) {}
            });
        }
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
        if (state.publishing || window.__vieworaPublishingLock) {
            try { showToast("Please wait", "Already publishing…"); } catch (_) {}
            return;
        }

        // Apply pending music clip if any
        try {
            if (pendingMusic && !state.music) {
                const start = Number($("musicStartRange")?.value || 0);
                const len = Number($("musicLenRange")?.value || 15);
                applyMusicClip(pendingMusic, start, len);
            }
        } catch (_) {}

        // EDIT existing post → only caption + settings
        if (state.isEditMode && state.editPostId) {
            return saveExistingPost();
        }

        var user = getAuthUser();
        if (!user) {
            // wait briefly for auth
            try {
                await new Promise(function (r) { setTimeout(r, 400); });
                user = getAuthUser();
            } catch (_) {}
        }
        if (!user) {
            showToast("Login required", "Please login before publishing.");
            setTimeout(function () { location.href = "login.html"; }, 900);
            return;
        }

        window.__vieworaPublishingLock = true;
        state.publishing = true;
        setTimeout(function () {
            try { window.__vieworaPublishingLock = false; } catch (_) {}
        }, 45000);
        try { setPublishState(true); } catch (_) {}

        var caption = "";
        try {
            var el = document.getElementById("captionInput") || document.getElementById("postCaption");
            caption = ((el && el.value) || state.caption || "").trim();
        } catch (_) {}

        // Collect files (File or Blob)
        var files = [];
        try {
            if (state.mediaFiles && state.mediaFiles.length) {
                files = state.mediaFiles.slice(0, 10);
            } else if (state.media) {
                files = [state.media];
            }
        } catch (_) {}
        files = files.filter(function (f) {
            return f && (f instanceof Blob);
        });

        // Reload from IDB if empty
        if (!files.length) {
            try {
                var ok = await loadMultiFromIDB();
                if (ok && state.mediaFiles && state.mediaFiles.length) {
                    files = state.mediaFiles.filter(function (f) { return f instanceof Blob; }).slice(0, 10);
                }
            } catch (e) {
                console.warn("IDB reload", e);
            }
        }
        if (!files.length && typeof state.media === "string" && state.media.indexOf("data:") === 0) {
            try {
                var b = dataURLtoBlob(state.media, "image/jpeg");
                if (b) files = [b];
            } catch (_) {}
        }

        if (!files.length) {
            showToast("No photo", "Photos missing. Go back and choose again.");
            state.publishing = false;
            window.__vieworaPublishingLock = false;
            try { setPublishState(false); } catch (_) {}
            return;
        }

        console.log("[VIEWORA] Share Post files:", files.length, files.map(function (f) { return f.type + " " + f.size; }));

        var meta = {
            mediaCount: files.length,
            caption: caption,
            description: caption,
            title: caption || ("Post " + new Date().toLocaleDateString()),
            username: (user.displayName || user.email || "User"),
            userPhoto: user.photoURL || "",
            music: state.music || null,
            musicStartAt: state.music ? Number(state.music.startAt || 0) : 0,
            musicDuration: state.music ? Number(state.music.duration || 15) : 0,
            category: state.category || "",
            tags: state.tags || [],
            location: state.location || "",
            text: state.text || "",
            textStyle: state.textStyle || "clean",
            audience: state.audience || "Everyone",
            ratio: state.ratio || "portrait",
            allowComments: state.allowComments !== false,
            hideLikes: state.hideLikes === true,
            allowSaves: state.allowSaves !== false,
            collaborator: state.collaborator || null,
            hideLikeCount: state.hideLikes === true,
            commentsDisabled: state.allowComments === false,
            clientPostKey: "post_" + String(user.uid || "u") + "_" + files.length + "_" + Date.now()
        };
        if (state.music) {
            meta.music = Object.assign({}, state.music, {
                startAt: Number(state.music.startAt || 0),
                duration: Number(state.music.duration || 15),
                audioUrl: state.music.audioUrl || state.music.url || ""
            });
        }

        try {
            if (!window.VieworaUploadQueue || typeof window.VieworaUploadQueue.enqueueAndLeave !== "function") {
                throw new Error("Upload queue not loaded");
            }
            showToast("Uploading", "Post uploading in background…");
            await window.VieworaUploadQueue.enqueueAndLeave({
                type: "post",
                file: files[0],
                files: files,
                returnUrl: "index.html",
                meta: meta
            });
            // enqueueAndLeave navigates away
            return;
        } catch (err) {
            console.error("[VIEWORA] Share failed", err);
            showToast("Upload error", (err && err.message) || "Try again");
            state.publishing = false;
            window.__vieworaPublishingLock = false;
            try { setPublishState(false); } catch (_) {}
        }
    }

    async function saveExistingPost() {
        var user = getAuthUser();
        if (!user) {
            showToast("Login required", "Please login.");
            return;
        }
        window.__vieworaPublishingLock = true;
        state.publishing = true;
        try { setPublishState(true); } catch (_) {}

        var caption = "";
        try {
            var el = document.getElementById("captionInput") || document.getElementById("postCaption");
            caption = ((el && el.value) || state.caption || "").trim();
        } catch (_) {}

        try {
            var db = null;
            try { db = getDatabase(); } catch (_) {}
            if (!db && window.firebase) db = firebase.database();
            if (!db) throw new Error("Database unavailable");

            var updates = {
                caption: caption,
                description: caption,
                title: caption || "",
                allowComments: state.allowComments !== false,
                hideLikes: state.hideLikes === true,
                hideLikeCount: state.hideLikes === true,
                commentsDisabled: state.allowComments === false,
                allowSaves: state.allowSaves !== false,
                audience: state.audience || "Everyone",
                location: state.location || "",
                updatedAt: Date.now()
            };
            await db.ref("posts/" + state.editPostId).update(updates);
            showToast("Saved", "Post updated");
            setTimeout(function () {
                location.href = "post.html?id=" + encodeURIComponent(state.editPostId);
            }, 500);
        } catch (err) {
            console.error("saveExistingPost", err);
            showToast("Error", (err && err.message) || "Could not save");
            state.publishing = false;
            window.__vieworaPublishingLock = false;
            try { setPublishState(false); } catch (_) {}
        }
    }

    /* ======================================================
       PROCESSING UI
    ====================================================== */

    function showProcessing(message) {
        // Full-screen overlay disabled — background banner only
        try {
            showToast(message || "Uploading", "In background…");
        } catch (_) {}
        try {
            const overlay = $("processingOverlay");
            if (overlay) overlay.classList.add("hidden");
        } catch (_) {}
    }


    function updateProcessing(message) {
        try {
            const overlay = $("processingOverlay");
            if (overlay) overlay.classList.add("hidden");
        } catch (_) {}


    }


    function hideProcessing() {
        try { clearTimeout(window.__processTimeout); } catch (_) {}


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