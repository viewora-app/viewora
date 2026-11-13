"use strict";

    async function countMyActiveStories(uid) {
        if (!uid || typeof firebase === "undefined") return 0;
        try {
            const db = firebase.database();
            const snap = await db.ref("stories").once("value");
            const now = Date.now();
            let n = 0;
            snap.forEach((c) => {
                const d = c.val() || {};
                const owner = String(d.uid || d.userId || d.ownerId || d.creatorId || "");
                if (owner !== String(uid)) return;
                let t = Number(d.createdAt || d.timestamp || d.time || 0);
                if (t > 0 && t < 1e12) t *= 1000;
                const exp = Number(d.expiresAt || 0);
                if (exp && exp < now) return;
                if (!exp && t && now - t > 24 * 60 * 60 * 1000) return;
                n++;
            });
            return n;
        } catch (_) {
            return 0;
        }
    }


/*
============================================================
 VIEWORA — STORY UPLOAD
 story-upload.js

 • Pick photo / video
 • Text · Stickers · Filters · Music
 • Cloudinary upload
 • Firebase Realtime Database (stories/)
 • 24-hour expiry
 • Followers-only visibility
============================================================
*/

(() => {

    if (window.__VIEWORA_STORY_UPLOAD__) return;
    window.__VIEWORA_STORY_UPLOAD__ = true;


    /* =====================================================
       CONFIG
    ===================================================== */

    const CONFIG = {
        STORIES_PATH: "stories",
        USERS_PATH: "users",
        MAX_DURATION_MS: 24 * 60 * 60 * 1000,
        MAX_VIDEO_SEC: 30,
        CLOUD_NAME: (window.VIEWORA_CLOUDINARY_CLOUD) || "z5m6wjdf",
        UPLOAD_PRESET: (window.VIEWORA_CLOUDINARY_PRESET) || "Viewora-upload"
    };


    const STICKERS = [
        "🔥", "❤️", "😂", "😍", "✨",
        "🎉", "👏", "💯", "🙌", "😎",
        "🥳", "💪", "🌟", "🎵", "📸",
        "👀", "💋", "🦋", "🌈", "⚡"
    ];


    const FILTERS = [
        { id: "none", name: "Original", css: "none", overlay: "transparent", opacity: 0 },
        { id: "warm", name: "Warm", css: "sepia(.25) saturate(1.3)", overlay: "#ff9a5a", opacity: .18 },
        { id: "cool", name: "Cool", css: "saturate(1.1) hue-rotate(15deg)", overlay: "#5ab0ff", opacity: .16 },
        { id: "mono", name: "Mono", css: "grayscale(1) contrast(1.05)", overlay: "#888", opacity: .08 },
        { id: "vivid", name: "Vivid", css: "saturate(1.6) contrast(1.1)", overlay: "#ff5a8a", opacity: .12 },
        { id: "fade", name: "Fade", css: "brightness(1.05) contrast(.9) saturate(.85)", overlay: "#fff", opacity: .1 },
        { id: "cinema", name: "Cinema", css: "contrast(1.15) brightness(.95) saturate(.9)", overlay: "#1a0a00", opacity: .15 }
    ];


    const MUSIC_TRACKS = [
        { id: "original", name: "Original audio", artist: "No music" },
        { id: "chill", name: "Chill Vibes", artist: "Viewora Sounds" },
        { id: "hype", name: "Hype Beat", artist: "Viewora Sounds" },
        { id: "lofi", name: "Lo-Fi Night", artist: "Viewora Sounds" },
        { id: "acoustic", name: "Soft Acoustic", artist: "Viewora Sounds" },
        { id: "party", name: "Party Energy", artist: "Viewora Sounds" }
    ];


    /* =====================================================
       STATE
    ===================================================== */

    const state = {
        user: null,
        profile: null,
        file: null,
        objectURL: null,
        mediaType: null, // image | video
        filterId: "none",
        music: MUSIC_TRACKS[0],
        musicStartAt: 0,
        textColor: "#ffffff",
        textStyle: "classic",
        uploading: false,
        remoteMediaURL: null,
        remoteMediaType: null,
        sharedFrom: null,
        ownerCredit: null // { uid, username, avatar }
    };


    /* =====================================================
       DOM
    ===================================================== */

    const $ = (id) => document.getElementById(id);

    const pickScreen = $("pickScreen");
    const editorScreen = $("editorScreen");
    const fileInput = $("fileInput");
    const cameraInput = $("cameraInput");
    const previewImage = $("previewImage");
    const previewVideo = $("previewVideo");
    const filterOverlay = $("filterOverlay");
    const textLayer = $("textLayer");
    const stickerLayer = $("stickerLayer");
    const musicBadge = $("musicBadge");
    const musicBadgeText = $("musicBadgeText");


    /* =====================================================
       HELPERS
    ===================================================== */

    function firebaseReady() {
        return (
            typeof firebase !== "undefined" &&
            typeof firebase.database === "function" &&
            typeof firebase.auth === "function"
        );
    }


    function escapeHTML(v) {
        if (v == null) return "";
        return String(v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function showToast(message, type) {
        const toast = $("toast");
        const text = $("toastText");
        const icon = $("toastIcon");
        if (!toast) return;

        if (text) text.textContent = message;
        if (icon) {
            icon.className =
                type === "error"
                    ? "fa-solid fa-circle-exclamation"
                    : "fa-solid fa-circle-check";
        }

        toast.classList.remove("hidden");
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toast.classList.add("hidden"), 2400);
    }


    function openSheet(id) {
        const el = $(id);
        if (!el) return;
        el.classList.remove("hidden");
        el.setAttribute("aria-hidden", "false");
    }


    function closeSheet(id) {
        const el = $(id);
        if (!el) return;
        el.classList.add("hidden");
        el.setAttribute("aria-hidden", "true");
    }


    function closeAllSheets() {
        ["textPanel", "stickerPanel", "filterPanel", "musicPanel"].forEach(closeSheet);
    }


    /* =====================================================
       AUTH + PROFILE
    ===================================================== */

    async function loadProfile(uid) {
        if (!uid || !firebaseReady()) return null;
        try {
            const snap = await firebase.database().ref(`${CONFIG.USERS_PATH}/${uid}`).once("value");
            return snap.val() || null;
        } catch (e) {
            console.warn("Profile load failed:", e);
            return null;
        }
    }


    function applyUserUI() {
        const p = state.profile || {};
        const u = state.user || {};

        const name =
            p.username ||
            p.userName ||
            p.displayName ||
            u.displayName ||
            "Your Story";

        const avatar =
            p.avatar ||
            p.photoURL ||
            p.profilePhoto ||
            p.profileImage ||
            u.photoURL ||
            "assets/default-avatar.png";

        if ($("shareName")) $("shareName").textContent = name;
        if ($("shareAvatar")) $("shareAvatar").src = avatar;
        if ($("uploadAvatar")) $("uploadAvatar").src = avatar;
    }


    function requireLogin() {
        if (state.user) return true;
        showToast("Login required to post a story", "error");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 900);
        return false;
    }


    /* =====================================================
       FILE PICK
    ===================================================== */

    function onFileSelected(file) {
        if (!file) return;

        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (!isImage && !isVideo) {
            showToast("Only photos or videos allowed", "error");
            return;
        }

        if (state.objectURL) {
            try { URL.revokeObjectURL(state.objectURL); } catch (_) {}
        }

        state.file = file;
        state.objectURL = URL.createObjectURL(file);
        state.mediaType = isVideo ? "video" : "image";

        previewImage.classList.add("hidden");
        previewVideo.classList.add("hidden");
        previewVideo.pause();

        if (isVideo) {
            previewVideo.src = state.objectURL;
            previewVideo.classList.remove("hidden");
            previewVideo.muted = true;
            previewVideo.play().catch(() => {});

            previewVideo.onloadedmetadata = () => {
                if (previewVideo.duration > CONFIG.MAX_VIDEO_SEC + 0.5) {
                    showToast(`Video must be under ${CONFIG.MAX_VIDEO_SEC}s`, "error");
                }
            };
        } else {
            previewImage.src = state.objectURL;
            previewImage.classList.remove("hidden");
        }

        // reset edits
        textLayer.innerHTML = "";
        stickerLayer.innerHTML = "";
        state.filterId = "none";
        applyFilter("none");
        state.music = null; // never auto-pick a track
        try { updateMusicBadge(); } catch (_) {}

        pickScreen.classList.add("hidden");
        editorScreen.classList.remove("hidden");
    }


    /* =====================================================
       FILTERS
    ===================================================== */

    function applyFilter(id) {
        const f = FILTERS.find((x) => x.id === id) || FILTERS[0];
        state.filterId = f.id;

        const media = state.mediaType === "video" ? previewVideo : previewImage;
        if (media) media.style.filter = f.css === "none" ? "" : f.css;

        if (filterOverlay) {
            filterOverlay.style.background = f.overlay;
            filterOverlay.style.opacity = String(f.opacity);
        }

        document.querySelectorAll(".filterChip").forEach((chip) => {
            chip.classList.toggle("active", chip.dataset.filter === f.id);
        });
    }


    function renderFilters() {
        const row = $("filterRow");
        if (!row) return;
        row.innerHTML = "";

        const thumb =
            state.mediaType === "image" && state.objectURL
                ? state.objectURL
                : "";

        FILTERS.forEach((f) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "filterChip" + (f.id === state.filterId ? " active" : "");
            btn.dataset.filter = f.id;
            btn.innerHTML = `
                <div class="filterPreview" style="
                    background-image: ${thumb ? `url('${thumb}')` : "none"};
                    filter: ${f.css === "none" ? "none" : f.css};
                "></div>
                <span>${escapeHTML(f.name)}</span>
            `;
            btn.addEventListener("click", () => applyFilter(f.id));
            row.appendChild(btn);
        });
    }


    /* =========================================================
       TEXT
    ========================================================= */

    function addText() {
        const value = ($("textInput")?.value || "").trim();
        if (!value) {
            showToast("Type some text first", "error");
            return;
        }

        const el = document.createElement("div");
        el.className = `storyText style-${state.textStyle}`;
        el.textContent = value;
        el.style.color = state.textColor;
        if (state.textStyle === "type") el.style.color = "#000";

        makeDraggable(el);
        textLayer.appendChild(el);

        if ($("textInput")) $("textInput").value = "";
        closeSheet("textPanel");
    }


    /* =========================================================
       STICKERS
    ========================================================= */

    let cachedStickerPacks = [];
    let cachedMusicTracks = [];
    let musicPreviewAudio = null;

    function stopMusicPreview() {
        try {
            if (musicPreviewAudio) {
                musicPreviewAudio.pause();
                try { musicPreviewAudio.src = ""; } catch (_) {}
                musicPreviewAudio = null;
            }
        } catch (_) {}
        try {
            document.querySelectorAll("audio.vieworaStageMusic").forEach(function (a) {
                a.pause();
                a.remove();
            });
        } catch (_) {}
    }

    /** Loop music on the story editor so user can hear trim before Share */
    function playStageMusicPreview() {
        stopMusicPreview();
        if (!state.music || state.music.id === "original" || state.music.id === "original-audio") return;
        var url = state.music.audioUrl || state.music.url || state.music.src || "";
        if (!url) return;
        var start = Number(state.musicStartAt || 0) || 0;
        try {
            musicPreviewAudio = new Audio(url);
            musicPreviewAudio.className = "vieworaStageMusic";
            musicPreviewAudio.loop = true;
            musicPreviewAudio.volume = 0.85;
            musicPreviewAudio.addEventListener("loadedmetadata", function () {
                try {
                    var maxStart = Math.max(0, (musicPreviewAudio.duration || 0) - 1.5);
                    musicPreviewAudio.currentTime = Math.min(start, maxStart);
                } catch (_) {}
                musicPreviewAudio.play().catch(function () {});
            }, { once: true });
            musicPreviewAudio.play().catch(function () {});
        } catch (e) {
            console.warn("stage music preview", e);
        }
    }

    function placeStickerOnStage(payload) {
        const el = document.createElement("div");
        el.className = "storySticker";

        if (payload.url) {
            const img = document.createElement("img");
            img.src = payload.url;
            img.alt = payload.name || "sticker";
            img.style.width = "72px";
            img.style.height = "72px";
            img.style.objectFit = "contain";
            img.draggable = false;
            el.appendChild(img);
            el.dataset.stickerUrl = payload.url;
            el.dataset.stickerName = payload.name || "";
        } else {
            el.textContent = payload.emoji || "✨";
            el.dataset.stickerEmoji = payload.emoji || "✨";
        }

        // start roughly center
        el.style.left = "50%";
        el.style.top = "45%";
        el.style.transform = "translate(-50%, -50%)";

        makeDraggable(el);
        stickerLayer.appendChild(el);
        closeSheet("stickerPanel");
    }

    async function loadStickerPacks() {
        try {
            if (window.VieworaStores?.StickerStore) {
                cachedStickerPacks =
                    await VieworaStores.StickerStore.listPacks(40);
                return;
            }
            const snap = await firebase.database()
                .ref("stickerPacks")
                .once("value");
            const data = snap.val() || {};
            cachedStickerPacks = Object.entries(data)
                .map(([id, v]) => ({ id, ...v }))
                .filter((p) => p.active !== false);
        } catch (e) {
            console.warn("Sticker packs load failed:", e);
            cachedStickerPacks = [];
        }
    }

    function renderStickers() {
        const grid = $("stickerGrid");
        if (!grid) return;
        grid.innerHTML = "";

        /* Store packs first */
        if (cachedStickerPacks.length) {
            const packsTitle = document.createElement("div");
            packsTitle.style.cssText =
                "grid-column:1/-1;font-size:11px;font-weight:700;color:rgba(255,255,255,.55);margin:4px 0 2px";
            packsTitle.textContent = "Sticker packs";
            grid.appendChild(packsTitle);

            cachedStickerPacks.forEach((pack) => {
                const stickers = Array.isArray(pack.stickers)
                    ? pack.stickers
                    : [];
                stickers.forEach((s) => {
                    const url = s.url || s;
                    if (!url) return;
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "stickerItem";
                    btn.innerHTML =
                        `<img src="${escapeHTML(url)}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:10px">`;
                    btn.addEventListener("click", () => {
                        placeStickerOnStage({
                            url,
                            name: s.name || pack.name || "Sticker"
                        });
                        if (window.VieworaStores?.StickerStore) {
                            VieworaStores.StickerStore.incrementUse(pack.id);
                        }
                    });
                    grid.appendChild(btn);
                });
            });
        }

        /* Emoji fallback row */
        const emojiTitle = document.createElement("div");
        emojiTitle.style.cssText =
            "grid-column:1/-1;font-size:11px;font-weight:700;color:rgba(255,255,255,.55);margin:10px 0 2px";
        emojiTitle.textContent = "Emojis";
        grid.appendChild(emojiTitle);

        STICKERS.forEach((emoji) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "stickerItem";
            btn.textContent = emoji;
            btn.addEventListener("click", () => {
                placeStickerOnStage({ emoji });
            });
            grid.appendChild(btn);
        });

        /* Link to full store */
        const storeBtn = document.createElement("button");
        storeBtn.type = "button";
        storeBtn.className = "stickerItem";
        storeBtn.style.cssText =
            "grid-column:1/-1;aspect-ratio:auto;min-height:44px;font-size:12px;font-weight:700";
        storeBtn.innerHTML =
            `<i class="fa-solid fa-store"></i>&nbsp; Open Sticker Store`;
        storeBtn.addEventListener("click", () => {
            window.location.href =
                "sticker-store.html?return=story-upload.html";
        });
        grid.appendChild(storeBtn);
    }


    /* =========================================================
       MUSIC
    ========================================================= */

    async function loadMusicTracks() {
        try {
            if (window.VieworaStores?.MusicStore) {
                cachedMusicTracks =
                    await VieworaStores.MusicStore.list(60);
                return;
            }
            const snap = await firebase.database()
                .ref("musicLibrary")
                .once("value");
            const data = snap.val() || {};
            cachedMusicTracks = Object.entries(data)
                .map(([id, v]) => ({ id, ...v }))
                .filter((t) => t.active !== false);
        } catch (e) {
            console.warn("Music load failed:", e);
            cachedMusicTracks = [];
        }
    }

    function normalizeTrack(track) {
        return {
            id: track.id || "track",
            name: track.title || track.name || "Track",
            artist: track.artist || "Unknown",
            audioUrl: track.audioUrl || track.url || "",
            coverUrl: track.coverUrl || ""
        };
    }

    function renderMusic() {
        const list = $("musicList");
        if (!list) return;
        list.innerHTML = "";

        /* Original audio option */
        const original = MUSIC_TRACKS[0];
        const tracks = [
            original,
            ...cachedMusicTracks.map(normalizeTrack)
        ];

        if (!cachedMusicTracks.length) {
            const empty = document.createElement("div");
            empty.style.cssText =
                "padding:12px;color:rgba(255,255,255,.5);font-size:12px;text-align:center";
            empty.textContent =
                "No store music yet — admin can add tracks.";
            list.appendChild(empty);
        }

        tracks.forEach((track) => {
            const active =
                state.music?.id === track.id ||
                (state.music?.name === track.name &&
                    state.music?.id === track.id);

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "musicItem" + (active ? " active" : "");

            const cover = track.coverUrl
                ? `<img src="${escapeHTML(track.coverUrl)}" alt="">`
                : `<i class="fa-solid fa-music"></i>`;

            btn.innerHTML = `
                <span class="musicCover">${cover}</span>
                <span class="musicInfo">
                    <strong>${escapeHTML(track.name)}</strong>
                    <small>${escapeHTML(track.artist || "")}</small>
                </span>
                <i class="fa-solid fa-check"></i>
            `;

            btn.addEventListener("click", () => {
                stopMusicPreview();
                var url = String(track.audioUrl || track.url || track.src || "").trim();
                if (track.id !== "original" && track.id !== "original-audio" && (!url || url.length < 8)) {
                    try { showToast("No audio file on this track", "error"); } catch (_) {}
                    return;
                }
                // Only set music after trim Done inside openMusicTrim / apply — preview selection only
                state.music = null;
                state.musicStartAt = 0;
                try { updateMusicBadge(); } catch (_) {}
                renderMusic();
                openMusicTrim(track);
            });

            list.appendChild(btn);
        });

        /* Open full music store */
        const store = document.createElement("button");
        store.type = "button";
        store.className = "musicItem";
        store.innerHTML = `
            <span class="musicCover"><i class="fa-solid fa-store"></i></span>
            <span class="musicInfo">
                <strong>Open Music Store</strong>
                <small>Browse all tracks</small>
            </span>
            <i class="fa-solid fa-chevron-right"></i>
        `;
        store.addEventListener("click", () => {
            window.location.href =
                "music-store.html?return=story-upload.html";
        });
        list.appendChild(store);
    }



    function fmtMusicTime(sec) {
        sec = Math.max(0, Math.floor(Number(sec) || 0));
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return m + ":" + (s < 10 ? "0" : "") + s;
    }

    let pendingStoryMusic = null;

    function openMusicTrim(track) {
        pendingStoryMusic = track || null;
        const box = $("musicTrimBox");
        const slider = $("musicTrimSlider");
        const timeEl = $("musicTrimTime");
        const titleEl = $("musicTrimTitle");
        if (!box || !slider) {
            // fallback: no trim UI
            closeSheet("musicPanel");
            return;
        }
        box.classList.remove("hidden");
        if (titleEl) titleEl.textContent = (track && (track.name || track.title)) || "Set start";
        const url = track && (track.audioUrl || track.url);
        if (!url) {
            state.musicStartAt = 0;
            if (timeEl) timeEl.textContent = "0:00";
            return;
        }
        stopMusicPreview();
        try {
            musicPreviewAudio = new Audio(url);
            musicPreviewAudio.volume = 0.75;
            musicPreviewAudio.addEventListener("loadedmetadata", () => {
                const dur = Math.max(0, Math.floor(musicPreviewAudio.duration || 0));
                slider.min = 0;
                slider.max = Math.max(0, dur - 1);
                slider.value = state.musicStartAt || 0;
                if (timeEl) timeEl.textContent = fmtMusicTime(slider.value);
                try {
                    musicPreviewAudio.currentTime = Number(slider.value) || 0;
                } catch (_) {}
                musicPreviewAudio.play().catch(() => {});
            }, { once: true });
            musicPreviewAudio.play().catch(() => {});
        } catch (e) {
            console.warn(e);
        }
    }

    function wireMusicTrim() {
        const slider = $("musicTrimSlider");
        const timeEl = $("musicTrimTime");
        const box = $("musicTrimBox");
        $("musicTrimPreview")?.addEventListener("click", () => {
            if (!musicPreviewAudio) {
                if (state.music) {
                    openMusicTrim(state.music);
                }
                return;
            }
            try {
                musicPreviewAudio.currentTime = Number(state.musicStartAt || 0);
                musicPreviewAudio.play().catch(() => {});
            } catch (_) {}
        });
        $("musicTrimDone")?.addEventListener("click", () => {
            const sec = Number(slider && slider.value) || 0;
            state.musicStartAt = sec;
            if (pendingStoryMusic) {
                state.music = pendingStoryMusic;
                pendingStoryMusic = null;
            }
            if (box) box.classList.add("hidden");
            updateMusicBadge();
            closeSheet("musicPanel");
            playStageMusicPreview();
        });
        slider?.addEventListener("input", () => {
            const sec = Number(slider.value) || 0;
            state.musicStartAt = sec;
            if (timeEl) timeEl.textContent = fmtMusicTime(sec);
            if (musicPreviewAudio) {
                try {
                    musicPreviewAudio.currentTime = sec;
                    if (musicPreviewAudio.paused) musicPreviewAudio.play().catch(() => {});
                } catch (_) {}
            }
            updateMusicBadge();
        });
    }

    function updateMusicBadge() {
        if (!musicBadge) return;
        if (!state.music || state.music.id === "original") {
            musicBadge.classList.add("hidden");
            return;
        }
        musicBadge.classList.remove("hidden");
        if (musicBadgeText) {
            const start = Number(state.musicStartAt || 0) || 0;
            const label = state.music.name || state.music.title || "Music";
            musicBadgeText.textContent = start > 0
                ? (label + " · @" + Math.floor(start) + "s")
                : label;
        }
        // Allow moving song badge like stickers
        if (!musicBadge.dataset.dragBound) {
            musicBadge.dataset.dragBound = "1";
            musicBadge.style.position = "absolute";
            musicBadge.style.zIndex = "20";
            musicBadge.style.touchAction = "none";
            musicBadge.style.cursor = "grab";
            if (!musicBadge.style.left) musicBadge.style.left = "24px";
            if (!musicBadge.style.bottom && !musicBadge.style.top) {
                musicBadge.style.bottom = "120px";
            }
            makeDraggable(musicBadge);
        }
    }


    /* =========================================================
       DRAG
    ========================================================= */

    function makeDraggable(el) {
        let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false;

        const onStart = (e) => {
            dragging = true;
            const pt = e.touches ? e.touches[0] : e;
            startX = pt.clientX;
            startY = pt.clientY;
            const parent = el.parentElement || document.body;
            const rect = el.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();
            // Switch from bottom to top/left absolute for free move
            el.style.bottom = "auto";
            el.style.right = "auto";
            origX = rect.left - parentRect.left + rect.width / 2;
            origY = rect.top - parentRect.top + rect.height / 2;
            el.style.left = origX + "px";
            el.style.top = origY + "px";
            el.style.transform = "translate(-50%, -50%)";
            el.style.cursor = "grabbing";
            e.preventDefault();
            e.stopPropagation();
        };

        const onMove = (e) => {
            if (!dragging) return;
            const pt = e.touches ? e.touches[0] : e;
            const dx = pt.clientX - startX;
            const dy = pt.clientY - startY;
            el.style.left = (origX + dx) + "px";
            el.style.top = (origY + dy) + "px";
            el.style.transform = "translate(-50%, -50%)";
            e.preventDefault();
        };

        const onEnd = () => {
            dragging = false;
            el.style.cursor = "grab";
        };

        el.addEventListener("mousedown", onStart);
        el.addEventListener("touchstart", onStart, { passive: false });
        window.addEventListener("mousemove", onMove);
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("mouseup", onEnd);
        window.addEventListener("touchend", onEnd);
    }


    /* =========================================================
       UPLOAD
    ========================================================= */

    function setUploadProgress(pct) {
        const p = Math.max(0, Math.min(100, Math.round(pct)));
        const bar = $("uploadBarFill");
        const label = $("uploadPercent");
        const ring = $("uploadRingProgress");

        if (bar) bar.style.width = p + "%";
        if (label) label.textContent = p + "%";

        if (ring) {
            const circumference = 2 * Math.PI * 34;
            ring.style.strokeDashoffset = String(circumference * (1 - p / 100));
        }
    }


    function showUploadOverlay(show) {
        const el = $("uploadOverlay");
        if (!el) return;
        el.classList.toggle("hidden", !show);
        if (show) {
            setUploadProgress(0);
            if ($("uploadTitle")) $("uploadTitle").textContent = "Uploading story…";
            if ($("uploadSub")) $("uploadSub").textContent = "Only followers will see this";
        }
    }


    function uploadToFirebaseStorage(file, onProgress) {
        return new Promise((resolve, reject) => {
            try {
                if (typeof firebase === "undefined" || typeof firebase.storage !== "function") {
                    reject(new Error("Firebase Storage missing"));
                    return;
                }
                var user = null;
                try { user = firebase.auth().currentUser; } catch (_) {}
                if (!user) {
                    reject(new Error("Login required to upload story"));
                    return;
                }
                var safe = String((file && file.name) || "story")
                    .replace(/[^a-zA-Z0-9._-]/g, "_")
                    .slice(0, 80);
                var path = "viewora/stories/" + user.uid + "/" + Date.now() + "_" + safe;
                var ref = firebase.storage().ref(path);
                var task = ref.put(file, {
                    contentType: (file && file.type) || "application/octet-stream"
                });
                task.on(
                    "state_changed",
                    function (snap) {
                        if (typeof onProgress === "function" && snap.totalBytes) {
                            onProgress((snap.bytesTransferred / snap.totalBytes) * 90);
                        }
                    },
                    function (err) {
                        var msg = (err && err.message) || "Storage upload failed";
                        if (String(err && err.code || "").indexOf("unauthorized") !== -1) {
                            msg = "Storage permission denied — fix Firebase Storage rules";
                        }
                        reject(new Error(msg));
                    },
                    function () {
                        task.snapshot.ref.getDownloadURL().then(function (url) {
                            resolve({
                                secure_url: url,
                                url: url,
                                public_id: path,
                                resource_type: String((file && file.type) || "").indexOf("video") === 0 ? "video" : "image"
                            });
                        }).catch(reject);
                    }
                );
            } catch (e) {
                reject(e);
            }
        });
    }

    function uploadToCloudinary(file, onProgress) {
        // Cloudinary disabled — always Firebase Storage
        return uploadToFirebaseStorage(file, onProgress);
    }

    function collectOverlays() {
        const texts = [];
        textLayer.querySelectorAll(".storyText").forEach((el) => {
            texts.push({
                text: el.textContent,
                color: el.style.color || "#ffffff",
                style: Array.from(el.classList).find((c) => c.startsWith("style-"))?.replace("style-", "") || "classic",
                left: el.style.left || "50%",
                top: el.style.top || "40%"
            });
        });

        const stickers = [];
        stickerLayer.querySelectorAll(".storySticker").forEach((el) => {
            const item = {
                left: el.style.left || "50%",
                top: el.style.top || "50%"
            };
            if (el.dataset.stickerUrl) {
                item.url = el.dataset.stickerUrl;
                item.name = el.dataset.stickerName || "";
            } else {
                item.emoji =
                    el.dataset.stickerEmoji ||
                    (el.textContent || "").trim();
            }
            stickers.push(item);
        });

        return { texts, stickers };
    }



    function showThinShareBar(pct) {
        let bar = document.getElementById("storyThinShare");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "storyThinShare";
            bar.innerHTML = '<div class="storyThinShareInner"><span class="storyThinShareTxt">Sharing story…</span><div class="storyThinShareTrack"><div class="storyThinShareFill"></div></div></div>';
            bar.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:9999;pointer-events:none;";
            document.body.appendChild(bar);
            if (!document.getElementById("storyThinShareStyle")) {
                const st = document.createElement("style");
                st.id = "storyThinShareStyle";
                st.textContent = ".storyThinShareInner{background:rgba(20,20,24,.94);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 14px;box-shadow:0 8px 28px rgba(0,0,0,.45)}.storyThinShareTxt{font-size:13px;font-weight:700;color:#fff}.storyThinShareTrack{margin-top:8px;height:3px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}.storyThinShareFill{height:100%;width:0;background:linear-gradient(90deg,#a78bfa,#60a5fa);transition:width .2s linear}";
                document.head.appendChild(st);
            }
        }
        bar.style.display = "block";
        const fill = bar.querySelector(".storyThinShareFill");
        if (fill) fill.style.width = Math.max(2, Math.min(100, Number(pct) || 0)) + "%";
        const txt = bar.querySelector(".storyThinShareTxt");
        if (txt && pct >= 100) txt.textContent = "Story shared!";
    }
    function hideThinShareBar() {
        const bar = document.getElementById("storyThinShare");
        if (bar) bar.style.display = "none";
    }

    async function shareStory() {
        const MAX_STORIES_PER_USER = 50;
        try {
            const me = (firebase.auth && firebase.auth().currentUser) || null;
            if (me) {
                const cnt = await countMyActiveStories(me.uid);
                if (cnt >= MAX_STORIES_PER_USER) {
                    alert("Story limit reached. You can have maximum 50 active stories. Delete an old one or wait 24h.");
                    return;
                }
            }
        } catch (_) {}

        if (state.uploading) return;
        if (!requireLogin()) return;
        if (!state.file && !state.remoteMediaURL) {
            showToast("Select a photo or video first", "error");
            return;
        }

        state.uploading = true;
        try { stopMusicPreview(); } catch (_) {}
        const btn = $("shareStoryBtn");
        if (btn) btn.disabled = true;

        // Home ring: colorful progress circle while uploading
        try {
            sessionStorage.setItem("viewora_story_uploading", "1");
            sessionStorage.setItem("viewora_story_upload_pct", "8");
        } catch (_) {}

        try { showUploadOverlay(false); } catch (_) {}

        const overlays = collectOverlays();
        const p = state.profile || {};
        const u = state.user;
        const username =
            p.username ||
            p.userName ||
            p.displayName ||
            (u && u.displayName) ||
            (u && u.email && u.email.split("@")[0]) ||
            "User";
        const avatar =
            p.profilePhoto ||
            p.photoURL ||
            p.photoUrl ||
            p.avatar ||
            (u && u.photoURL) ||
            "";

        let musicMeta = null;
        if (state.music && state.music.id && state.music.id !== "original" && state.music.id !== "original-audio") {
            musicMeta = {
                id: state.music.id,
                name: state.music.name || state.music.title || "Music",
                title: state.music.title || state.music.name || "Music",
                artist: state.music.artist || "",
                audioUrl: state.music.audioUrl || state.music.url || state.music.src || "",
                coverUrl: state.music.coverUrl || "",
                startAt: Number(state.musicStartAt != null ? state.musicStartAt : (state.music.startAt || 0)) || 0
            };
            if (!musicMeta.audioUrl) musicMeta = null;
        }

        // Preferred path: queue + leave → ring shows progress on index
        if (window.VieworaUploadQueue && typeof window.VieworaUploadQueue.enqueueAndLeave === "function") {
            try {
                // Instant leave — no linger on this screen
                try {
                    document.body.style.opacity = "0.01";
                    document.body.style.pointerEvents = "none";
                } catch (_) {}
                if (state.remoteMediaURL && !state.file) {
                    // Reshare — no file upload queue; fall through to sync path
                    throw new Error("reshare-sync");
                }
                await window.VieworaUploadQueue.enqueueAndLeave({
                    type: "story",
                    file: state.file,
                    returnUrl: "index.html?story=1&t=" + Date.now(),
                    meta: {
                        caption: (state.caption || "").trim(),
                        username: username,
                        avatar: avatar,
                        music: musicMeta,
                        musicStartAt: musicMeta ? musicMeta.startAt : 0,
                        texts: overlays.texts || [],
                        stickers: overlays.stickers || [],
                        sharedFrom: state.sharedFrom || null,
                        originalOwner: state.ownerCredit || null
                    }
                });
                return;
            } catch (qe) {
                console.warn("[VIEWORA] Story queue failed, sync fallback:", qe);
            }
        }

        // Sync fallback (stay on page until done)
        showThinShareBar(0);
        try {
            let mediaURL = state.remoteMediaURL || null;
            let resourceType = state.remoteMediaType || state.mediaType || "image";
            if (!mediaURL && state.file) {
              const uploadResult = await uploadToCloudinary(state.file, function (pct) {
                  setUploadProgress(pct);
                  showThinShareBar(pct);
                  try { sessionStorage.setItem("viewora_story_upload_pct", String(Math.round(pct))); } catch (_) {}
              });
              mediaURL = uploadResult.secure_url;
              resourceType = uploadResult.resource_type || state.mediaType;
            } else {
              setUploadProgress(70);
              showThinShareBar(70);
            }
            setUploadProgress(92);
            try { sessionStorage.setItem("viewora_story_upload_pct", "92"); } catch (_) {}

            const now = Date.now();
            const expiresAt = now + CONFIG.MAX_DURATION_MS;
            const mediaType = resourceType === "video" || state.mediaType === "video" ? "video" : "image";
            const storyId = db.ref("stories").push().key;
            const ref = db.ref("stories/" + storyId);

            const storyData = {
                id: storyId,
                uid: u.uid,
                userId: u.uid,
                ownerId: u.uid,
                mediaURL: mediaURL,
                mediaUrl: mediaURL,
                url: mediaURL,
                type: mediaType,
                mediaType: mediaType,
                caption: (state.caption || "").trim(),
                username: username,
                userName: username,
                displayName: username,
                avatar: avatar,
                photoURL: avatar,
                profilePhoto: avatar,
                userPhoto: avatar,
                music: musicMeta,
                musicStartAt: musicMeta ? musicMeta.startAt : 0,
                audioName: musicMeta ? (musicMeta.name || "Music") : "Original audio",
                texts: overlays.texts || [],
                stickers: overlays.stickers || [],
                visibility: "followers",
                createdAt: now,
                timestamp: now,
                expiresAt: expiresAt,
                views: 0,
                viewCount: 0,
                viewers: {},
                uploadStatus: "ready",
                sharedFrom: state.sharedFrom || null,
                originalOwner: state.ownerCredit || null,
                originalUsername: (state.ownerCredit && state.ownerCredit.username) || null,
                originalUid: (state.ownerCredit && state.ownerCredit.uid) || null
            };

            await ref.set(storyData);
            try {
                await db.ref(CONFIG.USERS_PATH + "/" + u.uid + "/stories/" + storyId).set({
                    id: storyId,
                    mediaURL: mediaURL,
                    mediaUrl: mediaURL,
                    mediaType: mediaType,
                    type: mediaType,
                    createdAt: now,
                    expiresAt: expiresAt,
                    username: username,
                    avatar: avatar
                });
            } catch (_) {}
            try {
                await db.ref("userStories/" + u.uid + "/" + storyId).set(storyData);
            } catch (_) {}

            setUploadProgress(100);
            showThinShareBar(100);
            try {
                sessionStorage.removeItem("viewora_story_uploading");
                sessionStorage.setItem("viewora_story_upload_pct", "100");
                sessionStorage.setItem("viewora_story_just_posted", "1");
            } catch (_) {}

            try { if (window.vieworaNotifyStoryMentions) await window.vieworaNotifyStoryMentions(storyData); } catch (_) {}
            showToast("Story shared");
            setTimeout(function () {
                window.location.href = "index.html?story=1&t=" + Date.now();
            }, 400);
        } catch (error) {
            console.error("Story upload error:", error);
            try { showUploadOverlay(false); } catch (_) {}
            showToast(error.message || "Could not share story", "error");
            try {
                sessionStorage.removeItem("viewora_story_uploading");
                sessionStorage.removeItem("viewora_story_upload_pct");
            } catch (_) {}
            if (btn) btn.disabled = false;
            state.uploading = false;
        }
    }


    /* =========================================================
       EVENTS
    ========================================================= */

    function setupEvents() {

        $("pickBackBtn")?.addEventListener("click", () => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = "index.html";
        });

        $("pickGalleryBtn")?.addEventListener("click", () => fileInput?.click());
        $("pickCameraBtn")?.addEventListener("click", () => cameraInput?.click());

        fileInput?.addEventListener("change", (e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelected(f);
            e.target.value = "";
        });

        cameraInput?.addEventListener("change", (e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelected(f);
            e.target.value = "";
        });

        $("editorBackBtn")?.addEventListener("click", () => {
            if (state.uploading) return;
            editorScreen.classList.add("hidden");
            pickScreen.classList.remove("hidden");
            previewVideo?.pause();
        });

        $("editorDoneBtn")?.addEventListener("click", () => {
            closeAllSheets();
            showToast("Ready to share");
        });

        // tools
        document.querySelectorAll(".toolBtn").forEach((btn) => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".toolBtn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");

                const tool = btn.dataset.tool;
                closeAllSheets();

                if (tool === "text") openSheet("textPanel");
                if (tool === "sticker") {
                    loadStickerPacks().then(() => {
                        renderStickers();
                        openSheet("stickerPanel");
                    });
                }
                if (tool === "filter") {
                    renderFilters();
                    openSheet("filterPanel");
                }
                if (tool === "music") {
                    stopMusicPreview();
                    loadMusicTracks().then(() => {
                        renderMusic();
                        openSheet("musicPanel");
                    });
                }
            });
        });

        // sheet close
        document.querySelectorAll("[data-close]").forEach((el) => {
            el.addEventListener("click", () => closeSheet(el.dataset.close));
        });

        // text options
        document.querySelectorAll("#textColors .colorDot").forEach((dot) => {
            dot.addEventListener("click", () => {
                document.querySelectorAll("#textColors .colorDot").forEach((d) => d.classList.remove("active"));
                dot.classList.add("active");
                state.textColor = dot.dataset.color || "#ffffff";
            });
        });

        document.querySelectorAll(".styleChip").forEach((chip) => {
            chip.addEventListener("click", () => {
                document.querySelectorAll(".styleChip").forEach((c) => c.classList.remove("active"));
                chip.classList.add("active");
                state.textStyle = chip.dataset.style || "classic";
            });
        });

        $("addTextBtn")?.addEventListener("click", addText);

        $("shareStoryBtn")?.addEventListener("click", shareStory);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeAllSheets();
        });
    }


    /* =========================================================
       INIT
    ========================================================= */

    function applySelectedFromStore() {
        try {
            const musicRaw = sessionStorage.getItem("vieworaSelectedMusic");
            if (musicRaw) {
                const track = JSON.parse(musicRaw);
                if (track) {
                    state.music = normalizeTrack(track);
                    state.musicStartAt = Number(track.startAt || track.musicStartAt || 0) || 0;
                    updateMusicBadge();
                }
                sessionStorage.removeItem("vieworaSelectedMusic");
            }
        } catch (_) {}

        try {
            const stickerRaw = sessionStorage.getItem("vieworaSelectedSticker");
            if (stickerRaw) {
                const data = JSON.parse(stickerRaw);
                if (data?.sticker) {
                    const s = data.sticker;
                    placeStickerOnStage({
                        url: s.url || s,
                        name: s.name || "Sticker"
                    });
                }
                sessionStorage.removeItem("vieworaSelectedSticker");
            }
        } catch (_) {}
    }

    function init() {
        if (!firebaseReady()) {
            showToast("Firebase not available", "error");
            return;
        }

        setupEvents();

        firebase.auth().onAuthStateChanged(async (user) => {
            state.user = user || null;
            if (user) {
                state.profile = await loadProfile(user.uid);
            } else {
                state.profile = null;
            }
            applyUserUI();
        });

        (async () => {
            await Promise.all([
                loadStickerPacks(),
                loadMusicTracks()
            ]);
            renderStickers();
            renderMusic();
            wireMusicTrim();
            applySelectedFromStore();
        })();
    }


    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }


    
    window.__vieworaStorySetRemote = function (payload) {
        try {
            payload = payload || {};
            state.remoteMediaURL = payload.url || payload.mediaURL || null;
            state.remoteMediaType = payload.type || payload.mediaType || "image";
            state.mediaType = state.remoteMediaType;
            state.file = null;
            state.sharedFrom = {
                type: payload.from || "post",
                id: payload.id || null
            };
            state.ownerCredit = {
                uid: payload.ownerUid || "",
                username: (payload.ownerUsername || payload.owner || "").replace(/^@/, ""),
                avatar: payload.ownerAvatar || ""
            };
            state.music = null;
            state.musicStartAt = 0;
        } catch (e) { console.warn(e); }
    };

    window.VieworaStoryUpload = {
        share: shareStory
    };

})();

/* Stories Live — vertical 9:16 */
(function () {
  function goStoryLive() {
    location.href =
      "live.html?start=1&format=story&aspect=9x16&title=" +
      encodeURIComponent("Story Live");
  }
  function bind() {
    var btn = document.getElementById("storyGoLiveBtn");
    if (btn) btn.addEventListener("click", goStoryLive);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else bind();
})();



/* VIEWORA_STORY_MENTION + SHARE_POST */
(function () {
  function db() {
    try { return firebase.database(); } catch (_) { return null; }
  }
  function authUser() {
    try { return firebase.auth().currentUser; } catch (_) { return null; }
  }

  // Parse @username mentions from caption/text overlays
  function extractMentions(text) {
    var out = [];
    String(text || "").replace(/@([a-zA-Z0-9._]{2,30})/g, function (_, u) {
      out.push(u.toLowerCase());
      return _;
    });
    return Array.from(new Set(out));
  }

  async function resolveUsernameToUid(username) {
    var d = db();
    if (!d || !username) return null;
    try {
      var q = await d.ref("users").orderByChild("username").equalTo(username).limitToFirst(1).once("value");
      var uid = null;
      q.forEach(function (c) { uid = c.key; });
      if (uid) return uid;
    } catch (_) {}
    try {
      var q2 = await d.ref("usernames/" + username).once("value");
      if (q2.exists()) {
        var v = q2.val();
        return (typeof v === "string") ? v : (v && (v.uid || v.userId)) || null;
      }
    } catch (_) {}
    return null;
  }

  // After story is published, notify mentioned users (Instagram-style)
  window.vieworaNotifyStoryMentions = async function (storyData) {
    try {
      var me = authUser();
      var d = db();
      if (!me || !d || !storyData) return;
      var texts = [];
      texts.push(storyData.caption || "");
      (storyData.texts || []).forEach(function (t) {
        texts.push((t && (t.text || t.value || t.content)) || "");
      });
      var names = extractMentions(texts.join(" "));
      if (!names.length) return;
      var myName = storyData.username || storyData.displayName || "Someone";
      for (var i = 0; i < names.length; i++) {
        var uname = names[i];
        var targetUid = await resolveUsernameToUid(uname);
        if (!targetUid || targetUid === me.uid) continue;
        // Activity / notification
        try {
          await d.ref("activity/" + targetUid).push({
            type: "story_mention",
            fromUid: me.uid,
            fromUsername: myName,
            fromAvatar: storyData.avatar || storyData.profilePhoto || "",
            storyId: storyData.id,
            mediaURL: storyData.mediaURL || storyData.mediaUrl || "",
            text: myName + " mentioned you in their story",
            preview: "@" + uname,
            read: false,
            createdAt: firebase.database.ServerValue.TIMESTAMP
          });
        } catch (e) { console.warn("mention activity", e); }
        // Chat system message + Add to story CTA
        try {
          var chatId = [me.uid, targetUid].sort().join("_");
          var msgRef = d.ref("chats/" + chatId + "/messages").push();
          await msgRef.set({
            type: "story_mention",
            kind: "mention",
            storyId: storyData.id,
            mediaURL: storyData.mediaURL || storyData.mediaUrl || "",
            mediaType: storyData.mediaType || storyData.type || "image",
            text: myName + " mentioned you in their story",
            senderId: me.uid,
            receiverId: targetUid,
            fromUsername: myName,
            fromAvatar: storyData.avatar || "",
            canAddToStory: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP
          });
          var inbox = {
            lastMessage: myName + " mentioned you in their story",
            lastMessageType: "story_mention",
            updatedAt: firebase.database.ServerValue.TIMESTAMP,
            chatId: chatId,
            unread: true
          };
          await d.ref("userChats/" + targetUid + "/" + chatId).update(inbox);
          await d.ref("userChats/" + me.uid + "/" + chatId).update({
            lastMessage: "You mentioned @" + uname + " in your story",
            lastMessageType: "story_mention",
            updatedAt: firebase.database.ServerValue.TIMESTAMP,
            chatId: chatId
          });
        } catch (e2) { console.warn("mention chat", e2); }
      }
    } catch (err) {
      console.warn("vieworaNotifyStoryMentions", err);
    }
  };

  // Load sharePost / shareShort into editor if URL has param
  async function tryLoadShareMedia() {
    try {
      var params = new URLSearchParams(location.search || "");
      var shareKind = (params.get("share") || "").toLowerCase();
      var postId = params.get("sharePost") || params.get("post") || "";
      var shortId = params.get("shareShort") || params.get("short") || "";
      var videoId = params.get("shareVideo") || params.get("video") || "";
      var genericId = params.get("id") || params.get("shareId") || "";
      var thumbParam = params.get("thumb") || params.get("media") || "";
      if (shareKind === "post" || shareKind === "posts") postId = postId || genericId;
      else if (shareKind === "short" || shareKind === "shorts") shortId = shortId || genericId;
      else if (shareKind === "video" || shareKind === "long" || shareKind === "longvideo") videoId = videoId || genericId;
      else if (genericId && !postId && !shortId && !videoId) postId = genericId;
      if (!postId && !shortId && !videoId && !thumbParam) return;
      var d = db();
      if (!d) return;
      var mediaURL = "";
      var mediaType = "image";
      if (postId) {
        var snap = await d.ref("posts/" + postId).once("value");
        var p = snap.val() || {};
        mediaURL = p.mediaURL || p.mediaUrl || p.imageUrl || p.image || p.photo || p.videoURL || p.videoUrl || p.url || "";
        mediaType = p.mediaType || p.type || "image";
      } else if (shortId) {
        var s = await d.ref("shorts/" + shortId).once("value");
        var sh = s.val() || {};
        mediaURL = sh.videoUrl || sh.videoURL || sh.mediaURL || sh.url || sh.thumbnail || "";
        mediaType = "video";
      } else if (videoId) {
        var v = await d.ref("videos/" + videoId).once("value");
        var vd = v.val() || {};
        mediaURL = vd.videoUrl || vd.videoURL || vd.mediaURL || vd.url || "";
        mediaType = "video";
      }
      if (!mediaURL && thumbParam) { mediaURL = thumbParam; mediaType = /mp4|webm|video/i.test(thumbParam) ? "video" : "image"; }
      if (!mediaURL) return;
      // Store for editor if available
      try {
        sessionStorage.setItem("viewora_story_share_media", JSON.stringify({
          url: mediaURL,
          type: /video/i.test(String(mediaType)) || /\.mp4|\.webm/i.test(mediaURL) ? "video" : "image",
          from: postId ? "post" : shortId ? "short" : "video",
          id: postId || shortId || videoId
        }));
      } catch (_) {}
      // If page has preview elements, set them
      var img = document.getElementById("previewImage") || document.querySelector(".previewImage, #storyPreviewImg");
      var vid = document.getElementById("previewVideo") || document.querySelector(".previewVideo, #storyPreviewVideo");
      if (/video/i.test(mediaType) || /\.mp4|\.webm/i.test(mediaURL)) {
        if (vid) {
          vid.src = mediaURL;
          vid.classList.remove("hidden");
          if (img) img.classList.add("hidden");
        }
      } else if (img) {
        img.src = mediaURL;
        img.classList.remove("hidden");
        if (vid) vid.classList.add("hidden");
      }
      var pick = document.getElementById("pickScreen") || document.querySelector(".pickScreen");
      var editor = document.getElementById("editorScreen") || document.querySelector(".editorScreen");
      if (pick) pick.classList.add("hidden");
      if (editor) editor.classList.remove("hidden");
      if (window.VieworaStoryUpload && typeof window.VieworaStoryUpload.share === "function") {
        // optional
      }
    } catch (e) {
      console.warn("tryLoadShareMedia", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(tryLoadShareMedia, 400); });
  } else {
    setTimeout(tryLoadShareMedia, 400);
  }
})();





/* VIEWORA_STORY_EDITOR_FROM_SHARE_V2 — force media visible, no black screen */
(function () {
  function $(id) { return document.getElementById(id); }

  function showOwnerCredit(owner) {
    if (!owner || !owner.username) return;
    var existing = document.getElementById("storyOwnerCredit");
    if (existing) existing.remove();
    var el = document.createElement("div");
    el.id = "storyOwnerCredit";
    el.innerHTML =
      '<span style="opacity:.75">From</span> ' +
      '<strong>@' + String(owner.username).replace(/^@/, "") + '</strong>';
    el.style.cssText =
      "position:absolute;left:12px;top:calc(56px + env(safe-area-inset-top));z-index:40;" +
      "padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.5);color:#fff;" +
      "font-size:12px;font-weight:600;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;";
    var stage = $("stage") || $("editorScreen") || document.body;
    if (getComputedStyle(stage).position === "static") stage.style.position = "relative";
    stage.appendChild(el);
  }

  function enableMediaGestures(target) {
    if (!target || target.__gestures) return;
    target.__gestures = true;
    var scale = 1, panX = 0, panY = 0;
    var startDist = 0, startScale = 1, lastX = 0, lastY = 0, mode = null;
    function apply() {
      target.style.transform = "translate(" + panX + "px," + panY + "px) scale(" + scale + ")";
      target.style.transformOrigin = "center center";
    }
    function dist(t) {
      var dx = t[0].clientX - t[1].clientX;
      var dy = t[0].clientY - t[1].clientY;
      return Math.hypot(dx, dy);
    }
    target.style.pointerEvents = "auto";
    target.style.touchAction = "none";
    target.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        mode = "pinch";
        startDist = dist(e.touches);
        startScale = scale;
      } else if (e.touches.length === 1) {
        mode = "pan";
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    }, { passive: true });
    target.addEventListener("touchmove", function (e) {
      if (mode === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        var d = dist(e.touches);
        scale = Math.max(1, Math.min(4, startScale * (d / (startDist || 1))));
        apply();
      } else if (mode === "pan" && e.touches.length === 1 && scale > 1) {
        e.preventDefault();
        var x = e.touches[0].clientX, y = e.touches[0].clientY;
        panX += x - lastX;
        panY += y - lastY;
        lastX = x; lastY = y;
        apply();
      }
    }, { passive: false });
    target.addEventListener("touchend", function () {
      if (scale <= 1.05) { scale = 1; panX = 0; panY = 0; apply(); }
      mode = null;
    });
  }

  function forceShow(el) {
    if (!el) return;
    el.classList.remove("hidden");
    el.style.display = "block";
    el.style.visibility = "visible";
    el.style.opacity = "1";
    el.style.zIndex = "2";
  }

  function forceHide(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.style.display = "none";
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(url); };
      img.onerror = function () { reject(new Error("image load fail")); };
      img.referrerPolicy = "no-referrer";
      img.crossOrigin = "anonymous";
      img.src = url;
      // also try without crossOrigin if fails later
      setTimeout(function () {
        if (!img.complete) {
          var img2 = new Image();
          img2.onload = function () { resolve(url); };
          img2.onerror = function () { reject(new Error("image load fail")); };
          img2.src = url;
        }
      }, 2500);
    });
  }

  async function openEditorWithRemote(payload) {
    payload = payload || {};
    var url = String(payload.url || payload.mediaURL || payload.mediaUrl || "").trim();
    var mediaType = payload.type || payload.mediaType || "image";
    if (!url) {
      console.warn("[story] no media url in payload", payload);
      return false;
    }

    try {
      if (window.__vieworaStorySetRemote) window.__vieworaStorySetRemote(payload);
    } catch (_) {}

    var pick = $("pickScreen");
    var editor = $("editorScreen");
    var img = $("previewImage");
    var vid = $("previewVideo");
    var mediaWrap = $("mediaWrap");

    if (pick) {
      pick.classList.add("hidden");
      pick.style.display = "none";
    }
    if (editor) {
      editor.classList.remove("hidden");
      editor.style.display = "flex";
      editor.style.visibility = "visible";
      editor.style.opacity = "1";
    }
    if (mediaWrap) {
      mediaWrap.style.background = "#111";
    }

    var isVideo = /video/i.test(String(mediaType)) || /\.(mp4|webm|mov)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url);

    if (isVideo) {
      forceHide(img);
      if (vid) {
        forceShow(vid);
        try { vid.pause(); } catch (_) {}
        vid.removeAttribute("hidden");
        vid.muted = true;
        vid.loop = true;
        vid.setAttribute("playsinline", "");
        vid.setAttribute("webkit-playsinline", "");
        vid.src = url;
        vid.load();
        var playTry = function () {
          vid.play().catch(function () {});
        };
        vid.onloadeddata = playTry;
        setTimeout(playTry, 400);
        enableMediaGestures(vid);
      }
    } else {
      forceHide(vid);
      if (img) {
        forceShow(img);
        img.removeAttribute("hidden");
        img.alt = "Story";
        img.referrerPolicy = "no-referrer";
        // Prefer direct src — works for Cloudinary / most CDNs
        img.onload = function () {
          forceShow(img);
          if (mediaWrap) mediaWrap.style.background = "#000";
        };
        img.onerror = function () {
          console.warn("[story] img error, retry without crossOrigin");
          img.removeAttribute("crossorigin");
          img.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + Date.now();
        };
        img.src = url;
        enableMediaGestures(img);
        // Fallback: background-image on mediaWrap if img still fails
        setTimeout(function () {
          if (img.naturalWidth === 0 && mediaWrap) {
            mediaWrap.style.backgroundImage = "url('" + url.replace(/'/g, "%27") + "')";
            mediaWrap.style.backgroundSize = "cover";
            mediaWrap.style.backgroundPosition = "center";
            forceShow(img);
            img.style.opacity = "0";
          }
        }, 1800);
      }
    }

    var owner = {
      uid: payload.ownerUid || "",
      username: String(payload.ownerUsername || payload.owner || "").replace(/^@/, ""),
      avatar: payload.ownerAvatar || ""
    };
    showOwnerCredit(owner);
    console.log("[story] editor opened with", isVideo ? "video" : "image", url.slice(0, 80));
    return true;
  }

  window.vieworaOpenStoryEditorWithMedia = openEditorWithRemote;

  async function resolvePayload() {
    var params = new URLSearchParams(location.search || "");
    var payload = null;
    try {
      var raw = sessionStorage.getItem("viewora_story_share_media");
      if (raw) payload = JSON.parse(raw);
    } catch (_) {}
    if (!payload) payload = {};

    var mediaParam = params.get("media") || params.get("thumb") || "";
    if (mediaParam) payload.url = payload.url || mediaParam;
    payload.type = payload.type || params.get("mediaType") || payload.mediaType || "";
    payload.ownerUsername = payload.ownerUsername || params.get("owner") || "";
    payload.ownerUid = payload.ownerUid || params.get("ownerUid") || "";
    payload.from = payload.from || (params.get("share") || "").toLowerCase() || "post";
    payload.id = payload.id || params.get("id") || params.get("shareId") || params.get("sharePost") || "";

    if (!payload.url && payload.id && typeof firebase !== "undefined" && firebase.database) {
      var db = firebase.database();
      var t = (payload.from || "post").toLowerCase();
      var paths = [];
      if (t === "short" || t === "shorts") paths = ["shorts/" + payload.id, "short/" + payload.id];
      else if (t === "video" || t === "long") paths = ["videos/" + payload.id, "longVideos/" + payload.id, "posts/" + payload.id];
      else paths = ["posts/" + payload.id, "feed/" + payload.id, "shorts/" + payload.id];
      for (var i = 0; i < paths.length; i++) {
        try {
          var snap = await db.ref(paths[i]).once("value");
          if (!snap.exists()) continue;
          var v = snap.val() || {};
          payload.url =
            v.mediaURL || v.mediaUrl || v.imageUrl || v.imageURL || v.image ||
            v.photo || v.thumbnail || v.thumb || v.videoUrl || v.videoURL || v.url || "";
          // multi-image posts
          if (!payload.url && Array.isArray(v.images) && v.images[0]) {
            payload.url = typeof v.images[0] === "string" ? v.images[0] : (v.images[0].url || v.images[0].src || "");
          }
          if (!payload.url && v.media && (v.media.url || v.media.src)) payload.url = v.media.url || v.media.src;
          payload.type = payload.type || v.mediaType || v.type || "image";
          payload.ownerUid = payload.ownerUid || v.uid || v.userId || v.ownerId || "";
          payload.ownerUsername = payload.ownerUsername || v.username || v.userName || v.displayName || "";
          if (!payload.ownerUsername && payload.ownerUid) {
            try {
              var us = await db.ref("users/" + payload.ownerUid).once("value");
              var u = us.val() || {};
              payload.ownerUsername = u.username || u.displayName || u.name || "";
              payload.ownerAvatar = u.profilePhoto || u.photoURL || "";
            } catch (_) {}
          }
          break;
        } catch (e) {
          console.warn("[story] path fail", paths[i], e);
        }
      }
    }
    return payload;
  }

  async function tryLoadShareMedia(attempt) {
    attempt = attempt || 0;
    try {
      if (!location.search && !sessionStorage.getItem("viewora_story_share_media")) return;
      var fromShare = /fromShare=1|share=|sharePost=|id=/.test(location.search || "") ||
        !!sessionStorage.getItem("viewora_story_share_media");
      if (!fromShare && attempt === 0) return;

      var payload = await resolvePayload();
      if (!payload.url) {
        if (attempt < 8) {
          // wait for firebase auth / db
          setTimeout(function () { tryLoadShareMedia(attempt + 1); }, 400);
          return;
        }
        console.warn("[story] still no media url", payload);
        return;
      }
      try { sessionStorage.removeItem("viewora_story_share_media"); } catch (_) {}
      await openEditorWithRemote(payload);
      try {
        if (window.__vieworaStorySetRemote) window.__vieworaStorySetRemote(payload);
      } catch (_) {}
    } catch (e) {
      console.warn("tryLoadShareMedia", e);
      if (attempt < 5) setTimeout(function () { tryLoadShareMedia(attempt + 1); }, 500);
    }
  }

  function boot() {
    setTimeout(function () { tryLoadShareMedia(0); }, 200);
    setTimeout(function () { tryLoadShareMedia(1); }, 900);
    setTimeout(function () { tryLoadShareMedia(2); }, 1800);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
  // Firebase ready
  try {
    if (firebase && firebase.auth) {
      firebase.auth().onAuthStateChanged(function () {
        setTimeout(function () { tryLoadShareMedia(3); }, 300);
      });
    }
  } catch (_) {}
})();
