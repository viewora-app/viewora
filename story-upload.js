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
        uploading: false
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
        state.music = MUSIC_TRACKS[0];
        updateMusicBadge();

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
                state.music = track;
                state.musicStartAt = 0;
                try { updateMusicBadge(); } catch (_) {}
                updateMusicBadge();
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

    function openMusicTrim(track) {
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
            if (box) box.classList.add("hidden");
            updateMusicBadge();
            closeSheet("musicPanel");
            // Keep playing on stage so user can hear before Share
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


    function uploadToCloudinary(file, onProgress) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error("No file selected"));
                return;
            }

            const url = `https://api.cloudinary.com/v1_1/${CONFIG.CLOUD_NAME}/auto/upload`;
            const fd = new FormData();
            fd.append("file", file);
            fd.append("upload_preset", CONFIG.UPLOAD_PRESET);
            fd.append("folder", "viewora/stories");

            const xhr = new XMLHttpRequest();
            xhr.open("POST", url);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && typeof onProgress === "function") {
                    onProgress((e.loaded / e.total) * 90);
                }
            };

            xhr.onload = () => {
                try {
                    const data = JSON.parse(xhr.responseText || "{}");
                    if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
                        resolve(data);
                    } else {
                        reject(new Error(data.error?.message || "Upload failed"));
                    }
                } catch (err) {
                    reject(err);
                }
            };

            xhr.onerror = () => reject(new Error("Network error during upload"));
            xhr.ontimeout = () => reject(new Error("Upload timed out"));
            xhr.timeout = 120000;
            xhr.send(fd);
        });
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
        if (!state.file) {
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
                        stickers: overlays.stickers || []
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
            const uploadResult = await uploadToCloudinary(state.file, function (pct) {
                setUploadProgress(pct);
                showThinShareBar(pct);
                try { sessionStorage.setItem("viewora_story_upload_pct", String(Math.round(pct))); } catch (_) {}
            });
            setUploadProgress(92);
            try { sessionStorage.setItem("viewora_story_upload_pct", "92"); } catch (_) {}

            const mediaURL = uploadResult.secure_url;
            const resourceType = uploadResult.resource_type || state.mediaType;
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
                uploadStatus: "ready"
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
