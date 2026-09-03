/* ==========================================================
   VIEWORA — SHORTS VISUAL EDITOR
   edit-shorts.js
   PREMIUM • PRODUCTION READY

   Works with:
   • edit-shorts.html
   • upload.js (IndexedDB video handoff)
   • short-edit.html (details / publish)

   Features:
   • Load video from IndexedDB (no Short ID required for new shorts)
   • Play / pause / timeline
   • Text overlays
   • Stickers
   • Filters
   • Draw
   • Speed / volume
   • Music selection
   • Trim (UI)
   • Save draft (session)
   • Next → short-edit.html (details)
========================================================== */

"use strict";

(() => {

    if (window.__VIEWORA_EDIT_SHORTS_INITIALIZED__) {
        console.warn("VIEWORA edit-shorts.js already initialized.");
        return;
    }

    window.__VIEWORA_EDIT_SHORTS_INITIALIZED__ = true;


    /* ======================================================
       HELPERS
    ====================================================== */

    const $ = (id) => document.getElementById(id);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));

    const sleep = (ms) =>
        new Promise((resolve) => setTimeout(resolve, ms));


    /* ======================================================
       CONSTANTS / STORAGE
    ====================================================== */

    const VIDEO_DB_NAME = "VIEWORA_MEDIA_DB";
    const VIDEO_DB_VERSION = 1;
    const VIDEO_STORE = "uploads";
    const VIDEO_KEY = "currentVideo";

    const EDITOR_DATA_KEY = "viewora_edit_short_data";
    const EDITOR_SESSION_KEY = "viewora_short_editor";


    /* ======================================================
       DOM
    ====================================================== */

    const shortVideo = $("shortVideo");
    const videoLoader = $("videoLoader");
    const videoLoaderText = $("videoLoaderText");
    const playOverlay = $("playOverlay");
    const playBtn = $("playBtn");
    const timeline = $("timeline");
    const timelineProgress = $("timelineProgress");
    const currentTimeLabel = $("currentTimeLabel");
    const durationLabel = $("durationLabel");
    const timelineDuration = $("timelineDuration");
    const editStatus = $("editStatus");

    const filterLayer = $("filterLayer");
    const drawCanvas = $("drawCanvas");
    const elementLayer = $("elementLayer");

    const toolPanel = $("toolPanel");
    const textInput = $("textInput");
    const addTextBtn = $("addTextBtn");

    const chooseMusicBtn = $("chooseMusicBtn");
    const activeMusicInfo = $("activeMusicInfo");
    const editMusicName = $("editMusicName");
    const editMusicArtist = $("editMusicArtist");
    const removeEditMusicBtn = $("removeEditMusicBtn");

    const brushSize = $("brushSize");
    const clearDrawBtn = $("clearDrawBtn");

    const splitTimeLabel = $("splitTimeLabel");
    const splitBtn = $("splitBtn");

    const trimStart = $("trimStart");
    const trimEnd = $("trimEnd");
    const trimStartLabel = $("trimStartLabel");
    const trimEndLabel = $("trimEndLabel");

    const volumeRange = $("volumeRange");
    const volumeValue = $("volumeValue");

    const clipPlayhead = $("clipPlayhead");

    const backBtn = $("backBtn");
    const undoBtn = $("undoBtn");
    const redoBtn = $("redoBtn");

    const saveDraftBtn = $("saveDraftBtn");
    const nextBtn = $("nextBtn");

    const musicSheet = $("musicSheet");
    const editorMusicSearch = $("editorMusicSearch");
    const editorMusicList = $("editorMusicList");

    const exitDialog = $("exitDialog");
    const cancelExitBtn = $("cancelExitBtn");
    const confirmExitBtn = $("confirmExitBtn");

    const processingOverlay = $("processingOverlay");
    const processingTitle = $("processingTitle");
    const processingMessage = $("processingMessage");

    const toast = $("toast");
    const toastTitle = $("toastTitle");
    const toastText = $("toastText");
    const toastIcon = $("toastIcon");


    /* ======================================================
       STATE
    ====================================================== */

    const state = {
        videoUrl: null,
        videoBlob: null,
        videoObjectUrl: null,
        duration: 0,
        isPlaying: false,
        dirty: false,

        filter: "none",
        speed: 1,
        volume: 1,

        trimStart: 0,
        trimEnd: 1,

        textStyle: "classic",
        elements: [],

        music: {
            id: "original",
            name: "Original audio",
            artist: "Your video"
        },

        drawing: false,
        drawCtx: null,
        lastX: 0,
        lastY: 0,

        history: [],
        historyIndex: -1
    };


    /* ======================================================
       FILTER MAP
    ====================================================== */

    const FILTER_CSS = {
        none: "none",
        contrast: "contrast(1.35) saturate(1.1)",
        mono: "grayscale(1)",
        warm: "sepia(0.35) saturate(1.25)",
        cool: "hue-rotate(28deg) saturate(0.9)",
        vintage: "sepia(0.5) contrast(0.92) saturate(0.85)"
    };


    /* ======================================================
       TOAST
    ====================================================== */

    let toastTimer = null;

    function showToast(title, message, type = "success") {
        if (!toast) return;

        clearTimeout(toastTimer);

        if (toastTitle) toastTitle.textContent = title;
        if (toastText) toastText.textContent = message;

        if (toastIcon) {
            const icon =
                type === "error"
                    ? "fa-circle-exclamation"
                    : type === "warning"
                        ? "fa-triangle-exclamation"
                        : "fa-circle-check";

            toastIcon.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        }

        toast.classList.remove("hidden");

        toastTimer = setTimeout(() => {
            toast.classList.add("hidden");
        }, 3200);
    }


    /* ======================================================
       PROCESSING
    ====================================================== */

    function showProcessing(title, message) {
        if (processingTitle) processingTitle.textContent = title || "Preparing";
        if (processingMessage) processingMessage.textContent = message || "Please wait...";
        processingOverlay?.classList.remove("hidden");
    }

    function hideProcessing() {
        processingOverlay?.classList.add("hidden");
    }


    /* ======================================================
       STATUS
    ====================================================== */

    function setStatus(text) {
        if (editStatus) editStatus.textContent = text;
    }


    /* ======================================================
       TIME FORMAT
    ====================================================== */

    function formatTime(seconds) {
        const value = Math.max(0, Number(seconds) || 0);
        const m = Math.floor(value / 60);
        const s = Math.floor(value % 60);
        return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }


    /* ======================================================
       INDEXED DB — LOAD VIDEO
    ====================================================== */

    function openVideoDB() {
        return new Promise((resolve, reject) => {
            if (!("indexedDB" in window)) {
                reject(new Error("IndexedDB is not supported."));
                return;
            }

            const request = indexedDB.open(VIDEO_DB_NAME, VIDEO_DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(VIDEO_STORE)) {
                    db.createObjectStore(VIDEO_STORE);
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () =>
                reject(request.error || new Error("Could not open media database."));
        });
    }


    async function loadVideoFromIndexedDB() {
        const db = await openVideoDB();

        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(VIDEO_STORE, "readonly");
                const store = tx.objectStore(VIDEO_STORE);
                const request = store.get(VIDEO_KEY);

                request.onsuccess = () => {
                    const value = request.result;
                    if (!value) {
                        resolve(null);
                        return;
                    }
                    resolve(value);
                };

                request.onerror = () => {
                    reject(request.error || new Error("Could not read video."));
                };
            } catch (error) {
                reject(error);
            }
        });
    }


    /* ======================================================
       APPLY VIDEO
    ====================================================== */

    function applyVideoSource(blobOrFile) {
        if (!shortVideo || !blobOrFile) return;

        if (state.videoObjectUrl) {
            try {
                URL.revokeObjectURL(state.videoObjectUrl);
            } catch (_) {}
            state.videoObjectUrl = null;
        }

        state.videoBlob = blobOrFile;
        state.videoObjectUrl = URL.createObjectURL(blobOrFile);
        state.videoUrl = state.videoObjectUrl;

        shortVideo.src = state.videoObjectUrl;
        shortVideo.load();

        videoLoader?.classList.remove("hidden");
        if (videoLoaderText) {
            videoLoaderText.textContent = "Loading your video...";
        }
    }


    /* ======================================================
       VIDEO EVENTS
    ====================================================== */

    function setupVideoEvents() {
        if (!shortVideo) return;

        shortVideo.addEventListener("loadedmetadata", () => {
            state.duration = shortVideo.duration || 0;

            if (durationLabel) durationLabel.textContent = formatTime(state.duration);
            if (timelineDuration) timelineDuration.textContent = formatTime(state.duration);
            if (trimEndLabel) trimEndLabel.textContent = formatTime(state.duration);
            if (splitTimeLabel) splitTimeLabel.textContent = formatTime(0);

            if (trimStart) {
                trimStart.min = "0";
                trimStart.max = String(state.duration || 100);
                trimStart.value = "0";
            }

            if (trimEnd) {
                trimEnd.min = "0";
                trimEnd.max = String(state.duration || 100);
                trimEnd.value = String(state.duration || 100);
            }

            state.trimStart = 0;
            state.trimEnd = state.duration;

            videoLoader?.classList.add("hidden");
            setStatus("Ready");
            markDirty(false);
            updatePlayhead();
        });

        shortVideo.addEventListener("timeupdate", () => {
            updateTimeline();
            if (splitTimeLabel) {
                splitTimeLabel.textContent = formatTime(shortVideo.currentTime);
            }
        });

        shortVideo.addEventListener("play", () => {
            state.isPlaying = true;
            updatePlayIcons(true);
            playOverlay?.classList.add("hidden");
        });

        shortVideo.addEventListener("pause", () => {
            state.isPlaying = false;
            updatePlayIcons(false);
            playOverlay?.classList.remove("hidden");
        });

        shortVideo.addEventListener("ended", () => {
            state.isPlaying = false;
            updatePlayIcons(false);
            playOverlay?.classList.remove("hidden");
        });

        shortVideo.addEventListener("error", () => {
            videoLoader?.classList.remove("hidden");
            if (videoLoaderText) {
                videoLoaderText.textContent = "Unable to load video. Go back and try again.";
            }
            setStatus("Video error");
            showToast(
                "Video failed",
                "Could not load the Short video. Please re-upload or re-record.",
                "error"
            );
        });
    }


    function updatePlayIcons(playing) {
        const iconClass = playing ? "fa-solid fa-pause" : "fa-solid fa-play";

        if (playBtn) {
            const i = playBtn.querySelector("i");
            if (i) i.className = iconClass;
        }

        if (playOverlay) {
            const i = playOverlay.querySelector("i");
            if (i) i.className = iconClass;
        }
    }


    function updateTimeline() {
        if (!shortVideo || !state.duration) return;

        const progress = (shortVideo.currentTime / state.duration) * 100;

        if (timelineProgress) {
            timelineProgress.style.width = Math.min(100, Math.max(0, progress)) + "%";
        }

        if (currentTimeLabel) {
            currentTimeLabel.textContent = formatTime(shortVideo.currentTime);
        }

        updatePlayhead();
    }


    function updatePlayhead() {
        if (!clipPlayhead || !state.duration) return;

        const pct = (shortVideo.currentTime / state.duration) * 100;
        clipPlayhead.style.left = Math.min(100, Math.max(0, pct)) + "%";
    }


    function togglePlay() {
        if (!shortVideo || !shortVideo.src) return;

        if (shortVideo.paused) {
            shortVideo.play().catch(() => {});
        } else {
            shortVideo.pause();
        }
    }


    function seekFromEvent(event) {
        if (!shortVideo || !state.duration || !timeline) return;

        const rect = timeline.getBoundingClientRect();
        const x = (event.clientX ?? event.touches?.[0]?.clientX) - rect.left;
        const ratio = Math.min(1, Math.max(0, x / rect.width));

        shortVideo.currentTime = ratio * state.duration;
        updateTimeline();
    }


    /* ======================================================
       DRAW CANVAS
    ====================================================== */

    function setupDrawCanvas() {
        if (!drawCanvas || !shortVideo) return;

        const resize = () => {
            const stage = $("videoStage");
            if (!stage) return;

            const rect = stage.getBoundingClientRect();
            drawCanvas.width = Math.floor(rect.width);
            drawCanvas.height = Math.floor(rect.height);

            state.drawCtx = drawCanvas.getContext("2d");
            if (state.drawCtx) {
                state.drawCtx.lineCap = "round";
                state.drawCtx.lineJoin = "round";
                state.drawCtx.strokeStyle = "#ffffff";
                state.drawCtx.lineWidth = Number(brushSize?.value) || 6;
            }
        };

        resize();
        window.addEventListener("resize", resize);

        const getPos = (e) => {
            const rect = drawCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const startDraw = (e) => {
            if (!drawCanvas.classList.contains("drawing-active")) return;
            e.preventDefault();
            state.drawing = true;
            const pos = getPos(e);
            state.lastX = pos.x;
            state.lastY = pos.y;
        };

        const moveDraw = (e) => {
            if (!state.drawing || !state.drawCtx) return;
            e.preventDefault();
            const pos = getPos(e);
            state.drawCtx.beginPath();
            state.drawCtx.moveTo(state.lastX, state.lastY);
            state.drawCtx.lineTo(pos.x, pos.y);
            state.drawCtx.stroke();
            state.lastX = pos.x;
            state.lastY = pos.y;
            markDirty(true);
        };

        const endDraw = () => {
            state.drawing = false;
        };

        drawCanvas.addEventListener("mousedown", startDraw);
        drawCanvas.addEventListener("mousemove", moveDraw);
        drawCanvas.addEventListener("mouseup", endDraw);
        drawCanvas.addEventListener("mouseleave", endDraw);

        drawCanvas.addEventListener("touchstart", startDraw, { passive: false });
        drawCanvas.addEventListener("touchmove", moveDraw, { passive: false });
        drawCanvas.addEventListener("touchend", endDraw);
    }


    function clearDrawing() {
        if (!state.drawCtx || !drawCanvas) return;
        state.drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        markDirty(true);
        showToast("Canvas cleared", "Drawing removed.");
    }


    /* ======================================================
       TOOLS
    ====================================================== */

    function setActiveTool(toolName) {
        $$(".editTool").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.tool === toolName);
        });

        $$(".toolPanelContent").forEach((panel) => {
            const isMatch = panel.dataset.panel === toolName;
            panel.classList.toggle("hidden", !isMatch);
        });

        // Drawing only when draw tool is active
        if (drawCanvas) {
            const drawing = toolName === "draw";
            drawCanvas.classList.toggle("drawing-active", drawing);
            drawCanvas.style.pointerEvents = drawing ? "auto" : "none";
        }

        setStatus(toolName ? toolName.charAt(0).toUpperCase() + toolName.slice(1) : "Ready");
    }


    /* ======================================================
       TEXT
    ====================================================== */

    function addTextOverlay() {
        const value = (textInput?.value || "").trim();
        if (!value) {
            showToast("Empty text", "Type something first.", "warning");
            textInput?.focus();
            return;
        }

        if (!elementLayer) return;

        const el = document.createElement("div");
        el.className = "editTextElement " + (state.textStyle || "classic");
        el.textContent = value;
        el.style.left = "50%";
        el.style.top = "42%";
        el.dataset.type = "text";

        makeDraggable(el);
        elementLayer.appendChild(el);

        state.elements.push({
            type: "text",
            text: value,
            style: state.textStyle,
            x: 50,
            y: 42
        });

        if (textInput) textInput.value = "";
        markDirty(true);
        showToast("Text added", "Drag to reposition.");
    }


    /* ======================================================
       STICKERS
    ====================================================== */

    function addSticker(emoji) {
        if (!elementLayer || !emoji) return;

        const el = document.createElement("div");
        el.className = "editStickerElement";
        el.textContent = emoji;
        el.style.left = "50%";
        el.style.top = "48%";
        el.dataset.type = "sticker";

        makeDraggable(el);
        elementLayer.appendChild(el);

        state.elements.push({
            type: "sticker",
            emoji,
            x: 50,
            y: 48
        });

        markDirty(true);
    }


    /* ======================================================
       DRAGGABLE
    ====================================================== */

    function makeDraggable(el) {
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let originLeft = 0;
        let originTop = 0;

        const onStart = (e) => {
            dragging = true;
            const point = e.touches ? e.touches[0] : e;
            startX = point.clientX;
            startY = point.clientY;

            const stage = $("videoStage");
            const rect = stage.getBoundingClientRect();
            originLeft = ((parseFloat(el.style.left) || 50) / 100) * rect.width;
            originTop = ((parseFloat(el.style.top) || 50) / 100) * rect.height;

            e.preventDefault();
        };

        const onMove = (e) => {
            if (!dragging) return;
            const point = e.touches ? e.touches[0] : e;
            const stage = $("videoStage");
            const rect = stage.getBoundingClientRect();

            const dx = point.clientX - startX;
            const dy = point.clientY - startY;

            let left = ((originLeft + dx) / rect.width) * 100;
            let top = ((originTop + dy) / rect.height) * 100;

            left = Math.min(95, Math.max(5, left));
            top = Math.min(95, Math.max(5, top));

            el.style.left = left + "%";
            el.style.top = top + "%";
        };

        const onEnd = () => {
            if (dragging) {
                dragging = false;
                markDirty(true);
            }
        };

        el.addEventListener("mousedown", onStart);
        el.addEventListener("touchstart", onStart, { passive: false });

        window.addEventListener("mousemove", onMove);
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("mouseup", onEnd);
        window.addEventListener("touchend", onEnd);
    }


    /* ======================================================
       FILTERS
    ====================================================== */

    function applyFilter(name) {
        state.filter = name || "none";

        const css = FILTER_CSS[state.filter] || "none";

        if (shortVideo) shortVideo.style.filter = css;
        if (filterLayer) filterLayer.style.filter = css;

        $$(".filterItem").forEach((item) => {
            item.classList.toggle("active", item.dataset.filter === state.filter);
        });

        markDirty(true);
        showToast("Filter applied", name === "none" ? "Original look" : name);
    }


    /* ======================================================
       SPEED / VOLUME
    ====================================================== */

    function setSpeed(value) {
        state.speed = Number(value) || 1;
        if (shortVideo) shortVideo.playbackRate = state.speed;

        $$(".speedChoices button").forEach((btn) => {
            btn.classList.toggle(
                "active",
                Number(btn.dataset.speed) === state.speed
            );
        });

        markDirty(true);
        showToast("Speed", state.speed + "x");
    }


    function setVolume(value) {
        state.volume = Math.min(1, Math.max(0, Number(value) || 0));
        if (shortVideo) shortVideo.volume = state.volume;
        if (volumeValue) {
            volumeValue.textContent = Math.round(state.volume * 100) + "%";
        }
        markDirty(true);
    }


    /* ======================================================
       MUSIC
    ====================================================== */

    function openMusicSheet() {
        musicSheet?.classList.remove("hidden");
    }

    function closeMusicSheet() {
        musicSheet?.classList.add("hidden");
    }

    function selectMusic(id, name, artist) {
        state.music = {
            id: id || "original",
            name: name || "Original audio",
            artist: artist || "Your video"
        };

        if (editMusicName) editMusicName.textContent = state.music.name;
        if (editMusicArtist) editMusicArtist.textContent = state.music.artist;

        activeMusicInfo?.classList.remove("hidden");
        closeMusicSheet();
        markDirty(true);
        showToast("Music selected", state.music.name);
    }

    function removeMusic() {
        state.music = {
            id: "original",
            name: "Original audio",
            artist: "Your video"
        };

        if (editMusicName) editMusicName.textContent = state.music.name;
        if (editMusicArtist) editMusicArtist.textContent = state.music.artist;

        activeMusicInfo?.classList.add("hidden");
        markDirty(true);
        showToast("Music removed", "Original audio restored.");
    }


    /* ======================================================
       TRIM
    ====================================================== */

    function updateTrimUI() {
        if (!state.duration) return;

        const start = Number(trimStart?.value) || 0;
        const end = Number(trimEnd?.value) || state.duration;

        state.trimStart = Math.min(start, end);
        state.trimEnd = Math.max(start, end);

        if (trimStartLabel) trimStartLabel.textContent = formatTime(state.trimStart);
        if (trimEndLabel) trimEndLabel.textContent = formatTime(state.trimEnd);

        markDirty(true);
    }


    /* ======================================================
       DIRTY / HISTORY (simple)
    ====================================================== */

    function markDirty(value = true) {
        state.dirty = value;
        if (undoBtn) undoBtn.disabled = !value;
    }


    /* ======================================================
       BUILD EDITOR PAYLOAD
    ====================================================== */

    function buildEditorPayload() {
        return {
            source: "edit-shorts",
            videoUrl: state.videoUrl || "",
            // blob cannot be JSON-serialized; details page reloads from IndexedDB
            hasLocalVideo: Boolean(state.videoBlob),
            filter: state.filter,
            speed: state.speed,
            volume: state.volume,
            trimStart: state.trimStart,
            trimEnd: state.trimEnd,
            music: { ...state.music },
            elements: state.elements.map((e) => ({ ...e })),
            mode: "shorts",
            updatedAt: Date.now()
        };
    }


    function persistEditorData() {
        const data = buildEditorPayload();

        try {
            sessionStorage.setItem(EDITOR_DATA_KEY, JSON.stringify(data));
            sessionStorage.setItem(EDITOR_SESSION_KEY, JSON.stringify(data));
            sessionStorage.setItem("viewora_current_short", JSON.stringify(data));
        } catch (error) {
            console.warn("Editor data persist failed:", error);
        }

        return data;
    }


    /* ======================================================
       NEXT → DETAILS
    ====================================================== */

    async function goToDetails() {
        if (!state.videoBlob && !state.videoUrl) {
            showToast(
                "No video",
                "Load or record a Short first.",
                "error"
            );
            return;
        }

        showProcessing("Preparing details", "Saving your edits...");

        try {
            // Ensure video is still in IndexedDB for the details page
            if (state.videoBlob) {
                const db = await openVideoDB();
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(VIDEO_STORE, "readwrite");
                    const store = tx.objectStore(VIDEO_STORE);
                    const req = store.put(state.videoBlob, VIDEO_KEY);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
            }

            persistEditorData();

            try {
                sessionStorage.setItem("viewora_pending_new_short", "1");
                // Clear any stale editing id so details page treats this as NEW
                [
                    "vieworaShortId",
                    "viewora_short_id",
                    "currentShortId",
                    "editingShortId",
                    "vieworaEditingShortId"
                ].forEach((key) => {
                    try { sessionStorage.removeItem(key); } catch (_) {}
                    try { localStorage.removeItem(key); } catch (_) {}
                });
            } catch (_) {}

            await sleep(350);

            window.location.href = "short-edit.html?source=editor";

        } catch (error) {
            console.error("goToDetails error:", error);
            hideProcessing();
            showToast(
                "Could not continue",
                error?.message || "Please try again.",
                "error"
            );
        }
    }


    /* ======================================================
       SAVE DRAFT (local)
    ====================================================== */

    function saveDraftLocal() {
        persistEditorData();
        markDirty(false);
        setStatus("Draft saved");
        showToast("Draft saved", "Your edits are stored on this device.");
    }


    /* ======================================================
       EXIT
    ====================================================== */

    function requestExit() {
        if (state.dirty) {
            exitDialog?.classList.remove("hidden");
            return;
        }
        leaveEditor();
    }

    function leaveEditor() {
        if (state.videoObjectUrl) {
            try {
                URL.revokeObjectURL(state.videoObjectUrl);
            } catch (_) {}
        }
        window.location.href = "upload.html";
    }


    /* ======================================================
       EVENTS
    ====================================================== */

    function bindEvents() {

        /* Play */
        playBtn?.addEventListener("click", togglePlay);
        playOverlay?.addEventListener("click", togglePlay);

        /* Timeline seek */
        timeline?.addEventListener("click", seekFromEvent);

        let seeking = false;
        timeline?.addEventListener("mousedown", () => { seeking = true; });
        timeline?.addEventListener("touchstart", () => { seeking = true; }, { passive: true });
        window.addEventListener("mouseup", () => { seeking = false; });
        window.addEventListener("touchend", () => { seeking = false; });
        timeline?.addEventListener("mousemove", (e) => {
            if (seeking) seekFromEvent(e);
        });

        /* Tools */
        $$(".editTool").forEach((btn) => {
            btn.addEventListener("click", () => {
                setActiveTool(btn.dataset.tool);
            });
        });

        $$("[data-close-panel]").forEach((btn) => {
            btn.addEventListener("click", () => {
                setActiveTool("text");
            });
        });

        /* Text */
        addTextBtn?.addEventListener("click", addTextOverlay);
        textInput?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                addTextOverlay();
            }
        });

        $$("[data-text-style]").forEach((chip) => {
            chip.addEventListener("click", () => {
                state.textStyle = chip.dataset.textStyle || "classic";
                $$("[data-text-style]").forEach((c) =>
                    c.classList.toggle("active", c === chip)
                );
            });
        });

        /* Stickers */
        $$(".stickerItem").forEach((item) => {
            item.addEventListener("click", () => {
                addSticker(item.dataset.sticker);
            });
        });

        /* Filters */
        $$(".filterItem").forEach((item) => {
            item.addEventListener("click", () => {
                applyFilter(item.dataset.filter);
            });
        });

        /* Speed */
        $$(".speedChoices button").forEach((btn) => {
            btn.addEventListener("click", () => {
                setSpeed(btn.dataset.speed);
            });
        });

        /* Volume */
        volumeRange?.addEventListener("input", () => {
            setVolume(volumeRange.value);
        });

        /* Brush */
        brushSize?.addEventListener("input", () => {
            if (state.drawCtx) {
                state.drawCtx.lineWidth = Number(brushSize.value) || 6;
            }
        });

        clearDrawBtn?.addEventListener("click", clearDrawing);

        /* Split (placeholder) */
        splitBtn?.addEventListener("click", () => {
            showToast(
                "Split",
                "Clip split is saved for the next step. Position: " +
                    formatTime(shortVideo?.currentTime || 0)
            );
            markDirty(true);
        });

        /* Trim */
        trimStart?.addEventListener("input", updateTrimUI);
        trimEnd?.addEventListener("input", updateTrimUI);

        /* Music */
        chooseMusicBtn?.addEventListener("click", openMusicSheet);
        removeEditMusicBtn?.addEventListener("click", removeMusic);

        $$("[data-close='musicSheet']").forEach((el) => {
            el.addEventListener("click", closeMusicSheet);
        });

        musicSheet?.querySelector(".overlayBackdrop")?.addEventListener("click", closeMusicSheet);

        $$(".musicChoice").forEach((btn) => {
            btn.addEventListener("click", () => {
                selectMusic(
                    btn.dataset.musicId,
                    btn.dataset.musicName,
                    btn.dataset.musicArtist
                );
            });
        });

        editorMusicSearch?.addEventListener("input", () => {
            const q = (editorMusicSearch.value || "").toLowerCase().trim();
            $$(".musicChoice").forEach((btn) => {
                const name = (btn.dataset.musicName || "").toLowerCase();
                const artist = (btn.dataset.musicArtist || "").toLowerCase();
                const match = !q || name.includes(q) || artist.includes(q);
                btn.style.display = match ? "" : "none";
            });
        });

        /* Categories (visual only) */
        $$(".musicCategory").forEach((btn) => {
            btn.addEventListener("click", () => {
                $$(".musicCategory").forEach((c) =>
                    c.classList.toggle("active", c === btn)
                );
            });
        });

        /* Bottom actions */
        nextBtn?.addEventListener("click", goToDetails);
        saveDraftBtn?.addEventListener("click", saveDraftLocal);

        /* Back / exit */
        backBtn?.addEventListener("click", requestExit);
        cancelExitBtn?.addEventListener("click", () => {
            exitDialog?.classList.add("hidden");
        });
        confirmExitBtn?.addEventListener("click", leaveEditor);

        /* Escape */
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeMusicSheet();
                exitDialog?.classList.add("hidden");
            }

            if (e.code === "Space" && e.target === document.body) {
                e.preventDefault();
                togglePlay();
            }
        });
    }


    /* ======================================================
       INIT
    ====================================================== */

    async function init() {
        try {
            setStatus("Loading...");
            videoLoader?.classList.remove("hidden");

            setupVideoEvents();
            setupDrawCanvas();
            bindEvents();
            setActiveTool("text");
            setVolume(1);

            // Prefer IndexedDB video from upload / camera
            let file = null;

            try {
                file = await loadVideoFromIndexedDB();
            } catch (error) {
                console.warn("IndexedDB load failed:", error);
            }

            // Fallback: session/local flags only (no blob)
            if (!file) {
                const params = new URLSearchParams(window.location.search);
                const source = params.get("source") || "";

                if (source === "upload" || source === "camera") {
                    // Video should have been saved; give a clear message
                    videoLoader?.classList.remove("hidden");
                    if (videoLoaderText) {
                        videoLoaderText.textContent =
                            "No video found. Please go back and select or record again.";
                    }
                    setStatus("No video");
                    showToast(
                        "Video missing",
                        "Please upload or record a Short again.",
                        "warning"
                    );
                    return;
                }

                // Editing existing short without local blob is handled by details page
                videoLoader?.classList.remove("hidden");
                if (videoLoaderText) {
                    videoLoaderText.textContent =
                        "No local video. Open Create → Shorts to add a video.";
                }
                setStatus("Waiting for video");
                return;
            }

            applyVideoSource(file);

            // Restore music from create screen if any
            try {
                const raw = sessionStorage.getItem("viewora_selected_music");
                if (raw) {
                    const music = JSON.parse(raw);
                    if (music?.id) {
                        selectMusic(
                            music.id,
                            music.title || music.name,
                            music.artist
                        );
                    }
                }
            } catch (_) {}

            console.log("VIEWORA Shorts Editor ready");

        } catch (error) {
            console.error("EDIT SHORTS INIT ERROR:", error);
            setStatus("Error");
            showToast(
                "Editor error",
                error?.message || "Something went wrong opening the editor.",
                "error"
            );
        }
    }


    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }


    /* ======================================================
       PUBLIC API
    ====================================================== */

    window.VieworaEditShorts = {
        getState: () => ({ ...state }),
        goToDetails,
        saveDraft: saveDraftLocal
    };

})();
