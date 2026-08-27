"use strict";

/*
===========================================================
 VIEWORA V12 — PREMIUM STORIES
 Instagram / Snapchat inspired Stories system

 FEATURES
 ----------------------------------------------------------
 • Photo Stories
 • Video Stories
 • Text Stories
 • Stickers
 • Emoji Stickers
 • Music / Audio
 • Drawing
 • Mentions
 • Story Views
 • Story Replies
 • 24 Hour Expiry
 • Story Navigation
 • Profile Story Options (View Stories / View Pic)
 • Firebase Realtime Database
 • Cloudinary Upload
 • createStoryFromFile() for Profile page
===========================================================
*/

(() => {

    /* =====================================================
       CONFIG
    ===================================================== */

    const CLOUDINARY_CLOUD_NAME = "z5m6wjdf";
    const CLOUDINARY_UPLOAD_PRESET = "Viewora-upload";

    const CLOUDINARY_UPLOAD_URL =
        "https://api.cloudinary.com/v1_1/" +
        CLOUDINARY_CLOUD_NAME +
        "/auto/upload";

    const STORY_DURATION = 24 * 60 * 60 * 1000;

    let db = null;
    let auth = null;
    let currentUser = null;

    let storyGroups = [];
    let currentGroupIndex = 0;
    let currentStoryIndex = 0;

    let storyTimer = null;
    let progressTimer = null;

    let storyStartTime = 0;
    let storyPaused = false;

    /* =====================================================
       FIREBASE
    ===================================================== */

    function initFirebase() {

        try {

            if (typeof firebase === "undefined") {
                console.error("Firebase SDK not loaded.");
                return false;
            }

            auth = firebase.auth();
            db = firebase.database();

            auth.onAuthStateChanged(user => {

                currentUser = user || null;

                if (currentUser) {
                    loadStories();
                }

            });

            return true;

        } catch (error) {

            console.error(
                "Stories Firebase initialization failed:",
                error
            );

            return false;
        }
    }

    /* =====================================================
       DOM
    ===================================================== */

    function $(id) {
        return document.getElementById(id);
    }

    function createElement(tag, className) {

        const el = document.createElement(tag);

        if (className) {
            el.className = className;
        }

        return el;
    }

    /* =====================================================
       ENSURE STORY VIEWER HTML EXISTS
    ===================================================== */

    function ensureStoryViewer() {

        if ($("storyViewer")) return;

        const viewer = createElement("div");
        viewer.id = "storyViewer";
        viewer.style.display = "none";
        viewer.innerHTML = `
            <div id="storyProgress" class="story-progress-bars"></div>

            <button id="closeStory" class="closeBtn" type="button" aria-label="Close">✕</button>

            <div class="story-header">
                <img id="storyProfile" src="assets/default-avatar.png" alt="">
                <div>
                    <strong id="storyName">User</strong>
                    <small id="storyTime"></small>
                </div>
            </div>

            <img id="storyImage" alt="Story" style="display:none;">
            <video id="storyVideo" playsinline style="display:none;"></video>

            <div class="story-nav left" id="storyNavPrev"></div>
            <div class="story-nav right" id="storyNavNext"></div>

            <div id="storyBottom" class="storyBottom">
                <input id="storyReply" type="text" placeholder="Reply..." maxlength="200">
                <button type="button" onclick="window.replyStory && window.replyStory()">Send</button>
            </div>
        `;

        document.body.appendChild(viewer);

        $("closeStory")?.addEventListener("click", closeStoryViewer);
        $("storyNavPrev")?.addEventListener("click", prevStory);
        $("storyNavNext")?.addEventListener("click", nextStory);
    }

    /* =====================================================
       STORY DATA
    ===================================================== */

    function normalizeStory(key, data) {

        if (!data) return null;

        const createdAt =
            Number(data.createdAt || data.timestamp || Date.now());

        if (Date.now() - createdAt > STORY_DURATION) {
            return null;
        }

        return {
            id: key,
            uid: data.uid || "",
            name: data.name || "User",
            username: data.username || "",
            photoURL:
                data.photoURL ||
                data.profilePic ||
                "assets/default-avatar.png",

            type: data.type || "image",

            mediaURL:
                data.mediaURL ||
                data.url ||
                "",

            text: data.text || "",
            textColor: data.textColor || "#ffffff",
            textBackground: data.textBackground || "",
            font: data.font || "Arial",
            sticker: data.sticker || "",
            musicURL: data.musicURL || "",
            musicName: data.musicName || "",
            mentions: data.mentions || [],
            drawing: data.drawing || "",
            createdAt,
            views: data.views || {},
            replies: data.replies || {}
        };
    }

    /* =====================================================
       LOAD STORIES
    ===================================================== */

    function loadStories() {

        if (!db) return;

        db.ref("stories")
            .on("value", snapshot => {

                const grouped = {};

                snapshot.forEach(child => {

                    const story =
                        normalizeStory(
                            child.key,
                            child.val()
                        );

                    if (!story) return;

                    if (!grouped[story.uid]) {

                        grouped[story.uid] = {
                            uid: story.uid,
                            name: story.name,
                            username: story.username,
                            photoURL: story.photoURL,
                            stories: []
                        };
                    }

                    grouped[story.uid].stories.push(story);

                });

                storyGroups = Object.values(grouped);

                storyGroups.forEach(group => {

                    group.stories.sort(
                        (a, b) => a.createdAt - b.createdAt
                    );

                });

                renderStoryList();
                updateProfileStoryRing();

            });
    }

    /* =====================================================
       UPDATE PROFILE PAGE STORY RING
    ===================================================== */

    function updateProfileStoryRing() {

        const ring = $("storyRing");
        if (!ring) return;

        const profileUID =
            window.profileUID ||
            new URLSearchParams(window.location.search).get("uid") ||
            new URLSearchParams(window.location.search).get("user") ||
            currentUser?.uid ||
            "";

        if (!profileUID) return;

        const group = storyGroups.find(g => g.uid === profileUID);

        if (group && group.stories.length > 0) {
            ring.dataset.hasStory = "true";
            ring.classList.add("has-story");
        } else {
            ring.dataset.hasStory = "false";
            ring.classList.remove("has-story");
        }
    }

    /* =====================================================
       STORY LIST (home feed style)
    ===================================================== */

    function renderStoryList() {

        let container = document.getElementById("storiesContainer");

        if (!container) {
            // Profile page uses #storiesWrapper instead
            container = document.getElementById("storiesWrapper");
        }

        if (!container) return;

        // Keep the "New" button if it exists (owner)
        const newItem = document.getElementById("newStoryItem");
        const keepNew = newItem ? newItem.cloneNode(true) : null;

        container.innerHTML = "";

        if (keepNew && document.body.classList.contains("is-owner")) {
            container.appendChild(keepNew);
            // re-bind click
            keepNew.addEventListener("click", () => {
                if (typeof window.createStory === "function") {
                    window.createStory();
                }
            });
        }

        if (!storyGroups.length && !keepNew) {
            const empty = createElement("div", "viewora-story-empty");
            empty.textContent = "No stories yet";
            container.appendChild(empty);
            return;
        }

        storyGroups.forEach((group, index) => {

            const item = createElement("div", "storyItem");

            const ring = createElement("div", "storyCircle");

            const img = document.createElement("img");
            img.src = group.photoURL || "assets/default-avatar.png";
            img.onerror = () => {
                img.src = "assets/default-avatar.png";
            };

            ring.appendChild(img);

            const name = createElement("p");
            name.textContent = group.name || "User";

            item.appendChild(ring);
            item.appendChild(name);

            item.onclick = () => {
                openStoryGroup(index);
            };

            container.appendChild(item);
        });
    }

    /* =====================================================
       OPEN STORY
    ===================================================== */

    function openStoryGroup(index) {

        ensureStoryViewer();

        if (index < 0 || index >= storyGroups.length) {
            return;
        }

        currentGroupIndex = index;
        currentStoryIndex = 0;

        const viewer = $("storyViewer");
        if (!viewer) return;

        viewer.style.display = "flex";
        document.body.style.overflow = "hidden";

        renderCurrentStory();
    }

    /* Open by UID (for profile page) */
    function openStoryByUID(uid) {

        const index = storyGroups.findIndex(g => g.uid === uid);

        if (index >= 0) {
            openStoryGroup(index);
        } else {
            if (typeof window.vieworaProfileToast === "function") {
                window.vieworaProfileToast("No active stories.");
            } else {
                alert("No active stories.");
            }
        }
    }

    window.openStoryViewer = openStoryByUID;

    /* =====================================================
       CURRENT STORY
    ===================================================== */

    function renderCurrentStory() {

        clearTimers();
        ensureStoryViewer();

        const group = storyGroups[currentGroupIndex];

        if (!group) {
            closeStoryViewer();
            return;
        }

        const story = group.stories[currentStoryIndex];

        if (!story) {
            nextStory();
            return;
        }

        const image = $("storyImage");
        const video = $("storyVideo");
        const profile = $("storyProfile");
        const name = $("storyName");
        const time = $("storyTime");
        const progress = $("storyProgress");

        if (!image || !video || !profile || !name || !time || !progress) {
            return;
        }

        image.style.display = "none";
        video.style.display = "none";

        video.pause();
        video.removeAttribute("src");
        video.load();

        profile.src = story.photoURL || "assets/default-avatar.png";
        profile.onerror = () => {
            profile.src = "assets/default-avatar.png";
        };

        name.textContent = story.name || "User";
        time.textContent = timeAgo(story.createdAt);

        renderProgress(group.stories.length);
        applyStoryContent(story);
        markStoryViewed(story);

        if (story.musicURL) {
            playStoryMusic(story.musicURL);
        }

        if (story.type === "video") {

            video.onloadedmetadata = () => {

                const duration = Math.min(video.duration * 1000, 60000);
                startStoryTimer(duration);
            };

            video.onended = () => {
                nextStory();
            };

        } else {
            startStoryTimer(5000);
        }
    }

    /* =====================================================
       STORY CONTENT
    ===================================================== */

    function applyStoryContent(story) {

        const viewer = $("storyViewer");
        const image = $("storyImage");
        const video = $("storyVideo");

        removeStoryCanvas();

        if (story.type === "image") {

            image.src = story.mediaURL;
            image.style.display = "block";

        } else if (story.type === "video") {

            video.src = story.mediaURL;
            video.style.display = "block";
            video.currentTime = 0;
            video.play().catch(() => {});

        } else if (story.type === "text") {

            createTextStory(story);
        }

        if (story.drawing) {
            renderDrawing(story.drawing);
        }

        if (story.sticker) {
            createSticker(story.sticker);
        }

        if (Array.isArray(story.mentions)) {
            renderMentions(story.mentions);
        }
    }

    /* =====================================================
       TEXT STORY
    ===================================================== */

    function createTextStory(story) {

        const viewer = $("storyViewer");

        const text = createElement("div", "viewora-text-story");
        text.textContent = story.text || "";
        text.style.color = story.textColor || "#fff";
        text.style.fontFamily = story.font || "Arial";

        if (story.textBackground) {
            text.style.background = story.textBackground;
        }

        viewer.appendChild(text);
    }

    /* =====================================================
       STICKER
    ===================================================== */

    function createSticker(sticker) {

        const viewer = $("storyViewer");
        const el = createElement("div", "viewora-story-sticker");
        el.textContent = sticker;
        viewer.appendChild(el);
    }

    /* =====================================================
       MENTIONS
    ===================================================== */

    function renderMentions(mentions) {

        const viewer = $("storyViewer");

        mentions.forEach(mention => {

            const tag = createElement("div", "viewora-story-mention");
            tag.textContent = "@" + String(mention).replace(/^@/, "");
            viewer.appendChild(tag);

        });
    }

    /* =====================================================
       DRAWING
    ===================================================== */

    function renderDrawing(dataURL) {

        const viewer = $("storyViewer");

        const canvas = document.createElement("canvas");
        canvas.id = "vieworaStoryDrawing";
        canvas.className = "viewora-story-drawing";
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };

        img.src = dataURL;
        viewer.appendChild(canvas);
    }

    function removeStoryCanvas() {

        const old = document.getElementById("vieworaStoryDrawing");
        if (old) old.remove();

        document
            .querySelectorAll(
                ".viewora-text-story,.viewora-story-sticker,.viewora-story-mention"
            )
            .forEach(el => el.remove());
    }

    /* =====================================================
       PROGRESS
    ===================================================== */

    function renderProgress(total) {

        const container = $("storyProgress");
        if (!container) return;

        container.innerHTML = "";

        for (let i = 0; i < total; i++) {

            const bar = createElement("div", "story-progress-segment");
            const fill = createElement("div", "story-progress-fill");

            if (i < currentStoryIndex) {
                fill.style.width = "100%";
            }

            bar.appendChild(fill);
            container.appendChild(bar);
        }
    }

    function startStoryTimer(duration) {

        clearTimers();

        const progress = document.querySelectorAll(".story-progress-fill");
        const active = progress[currentStoryIndex];

        if (!active) return;

        const start = performance.now();
        storyStartTime = Date.now();

        progressTimer = requestAnimationFrame(function update(now) {

            if (storyPaused) {
                progressTimer = requestAnimationFrame(update);
                return;
            }

            const elapsed = now - start;
            const percent = Math.min(elapsed / duration, 1);

            active.style.width = (percent * 100) + "%";

            if (percent >= 1) {
                nextStory();
                return;
            }

            progressTimer = requestAnimationFrame(update);

        });

        storyTimer = setTimeout(() => nextStory(), duration);
    }

    function clearTimers() {

        if (storyTimer) {
            clearTimeout(storyTimer);
            storyTimer = null;
        }

        if (progressTimer) {
            cancelAnimationFrame(progressTimer);
            progressTimer = null;
        }

        stopStoryMusic();
    }

    /* =====================================================
       NEXT / PREV
    ===================================================== */

    function nextStory() {

        clearTimers();

        const group = storyGroups[currentGroupIndex];
        if (!group) return;

        if (currentStoryIndex < group.stories.length - 1) {
            currentStoryIndex++;
            renderCurrentStory();
            return;
        }

        if (currentGroupIndex < storyGroups.length - 1) {
            currentGroupIndex++;
            currentStoryIndex = 0;
            renderCurrentStory();
            return;
        }

        closeStoryViewer();
    }

    function prevStory() {

        clearTimers();

        if (currentStoryIndex > 0) {
            currentStoryIndex--;
            renderCurrentStory();
            return;
        }

        if (currentGroupIndex > 0) {
            currentGroupIndex--;
            const group = storyGroups[currentGroupIndex];
            currentStoryIndex = group.stories.length - 1;
            renderCurrentStory();
            return;
        }

        renderCurrentStory();
    }

    /* =====================================================
       CLOSE
    ===================================================== */

    function closeStoryViewer() {

        clearTimers();

        const viewer = $("storyViewer");

        if (viewer) {
            viewer.style.display = "none";
        }

        document.body.style.overflow = "";

        const video = $("storyVideo");

        if (video) {
            video.pause();
            video.removeAttribute("src");
            video.load();
        }
    }

    /* =====================================================
       STORY VIEW
    ===================================================== */

    function markStoryViewed(story) {

        if (!currentUser || !story || !story.id) return;
        if (story.uid === currentUser.uid) return;

        const viewRef =
            db.ref(
                "stories/" +
                story.id +
                "/views/" +
                currentUser.uid
            );

        viewRef.set({
            uid: currentUser.uid,
            viewedAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(error => {
            console.warn("Story view failed:", error);
        });
    }

    /* =====================================================
       REPLY
    ===================================================== */

    window.replyStory = async function () {

        if (!currentUser) {
            alert("Please login to reply.");
            return;
        }

        const input = $("storyReply");
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        const group = storyGroups[currentGroupIndex];
        if (!group) return;

        const story = group.stories[currentStoryIndex];
        if (!story) return;

        try {

            const replyRef =
                db.ref("stories/" + story.id + "/replies").push();

            await replyRef.set({
                uid: currentUser.uid,
                name: currentUser.displayName || "User",
                photoURL: currentUser.photoURL || "assets/default-avatar.png",
                text: message,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });

            input.value = "";
            input.placeholder = "Sent ✓";

            setTimeout(() => {
                input.placeholder = "Reply...";
            }, 1500);

        } catch (error) {

            console.error("Story reply failed:", error);
            alert("Reply failed.");
        }
    };

    /* =====================================================
       CREATE STORY (opens full composer)
    ===================================================== */

    window.createStory = function (optionalFile) {

        if (!currentUser) {
            alert("Please login to create a story.");
            return;
        }

        openStoryComposer(optionalFile);
    };

    /* =====================================================
       CREATE STORY FROM FILE (Profile page uses this)
    ===================================================== */

    window.createStoryFromFile = async function (file) {

        if (!currentUser) {
            alert("Please login to create a story.");
            return;
        }

        if (!file) return;

        // Open composer with the selected file pre-loaded
        openStoryComposer(file);
    };

    /* =====================================================
       STORY COMPOSER
    ===================================================== */

    function openStoryComposer(preselectedFile) {

        if (document.getElementById("vieworaStoryComposer")) return;

        const overlay = createElement("div", "viewora-composer-overlay");
        overlay.id = "vieworaStoryComposer";

        overlay.innerHTML = `
            <div class="viewora-composer">

                <div class="composer-header">
                    <strong>Create Story</strong>
                    <button id="closeStoryComposer" type="button">✕</button>
                </div>

                <div id="storyPreviewArea" class="story-preview-area">
                    <div class="preview-placeholder">Select a photo / video or add text</div>
                    <canvas id="storyDrawCanvas"></canvas>
                    <div id="storyTextPreview"></div>
                    <div id="storyStickerPreview"></div>
                    <div id="storyMentionPreview"></div>
                </div>

                <div class="composer-tools">
                    <button type="button" data-tool="media">📷 Media</button>
                    <button type="button" data-tool="text">Aa Text</button>
                    <button type="button" data-tool="sticker">😀 Sticker</button>
                    <button type="button" data-tool="music">🎵 Music</button>
                    <button type="button" data-tool="draw">🖌️ Draw</button>
                    <button type="button" data-tool="mention">@ Mention</button>
                </div>

                <input id="storyMediaInput" type="file" accept="image/*,video/*" hidden>
                <input id="storyMusicInput" type="file" accept="audio/*" hidden>

                <div id="storyEditorPanel" class="story-editor-panel"></div>

                <button id="publishStoryBtn" class="publish-story-btn" type="button">
                    Share to Story
                </button>

            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";

        setupComposer();

        // If a file was passed from profile page
        if (preselectedFile) {
            applyPreselectedFile(preselectedFile);
        }
    }

    function applyPreselectedFile(file) {

        composerData.file = file;
        composerData.type = file.type.startsWith("video/") ? "video" : "image";

        const preview = $("storyPreviewArea");
        if (!preview) return;

        const placeholder = preview.querySelector(".preview-placeholder");
        if (placeholder) placeholder.remove();

        const old = preview.querySelector(".composer-media-preview");
        if (old) old.remove();

        const element = document.createElement(
            composerData.type === "video" ? "video" : "img"
        );

        element.className = "composer-media-preview";
        element.src = URL.createObjectURL(file);

        if (composerData.type === "video") {
            element.controls = true;
            element.muted = true;
            element.playsInline = true;
        }

        preview.prepend(element);
    }

    /* =====================================================
       COMPOSER STATE
    ===================================================== */

    let composerData = {
        type: null,
        file: null,
        mediaURL: "",
        musicURL: "",
        musicName: "",
        musicFile: null,
        text: "",
        textColor: "#ffffff",
        textBackground: "",
        sticker: "",
        mentions: [],
        drawing: ""
    };

    function setupComposer() {

        $("closeStoryComposer").onclick = closeComposer;

        document
            .querySelectorAll(".composer-tools button")
            .forEach(button => {

                button.onclick = () => {
                    openComposerTool(button.dataset.tool);
                };

            });

        $("storyMediaInput").onchange = handleMediaSelect;
        $("storyMusicInput").onchange = handleMusicSelect;
        $("publishStoryBtn").onclick = publishStory;
    }

    function closeComposer() {

        const composer = $("vieworaStoryComposer");
        if (composer) composer.remove();

        document.body.style.overflow = "";
        stopComposerMusic();

        composerData = {
            type: null,
            file: null,
            mediaURL: "",
            musicURL: "",
            musicName: "",
            musicFile: null,
            text: "",
            textColor: "#ffffff",
            textBackground: "",
            sticker: "",
            mentions: [],
            drawing: ""
        };
    }

    /* =====================================================
       MEDIA
    ===================================================== */

    function handleMediaSelect(event) {

        const file = event.target.files[0];
        if (!file) return;

        applyPreselectedFile(file);
    }

    /* =====================================================
       MUSIC
    ===================================================== */

    function handleMusicSelect(event) {

        const file = event.target.files[0];
        if (!file) return;

        composerData.musicFile = file;
        composerData.musicName = file.name;

        const panel = $("storyEditorPanel");
        panel.innerHTML = `
            <div class="music-selected">
                🎵 ${escapeHTML(file.name)}
            </div>
        `;
    }

    /* =====================================================
       TOOLS
    ===================================================== */

    function openComposerTool(tool) {

        const panel = $("storyEditorPanel");
        panel.innerHTML = "";

        if (tool === "media") {
            $("storyMediaInput").click();
            return;
        }

        if (tool === "text") {

            panel.innerHTML = `
                <textarea id="storyTextInput" placeholder="Write something..." maxlength="300"></textarea>
                <div class="editor-row">
                    <button type="button" class="text-color-btn" data-color="#ffffff">White</button>
                    <button type="button" class="text-color-btn" data-color="#00aaff">Blue</button>
                    <button type="button" class="text-color-btn" data-color="#ff66cc">Pink</button>
                    <button type="button" class="text-color-btn" data-color="#00ff9d">Green</button>
                </div>
                <button type="button" id="applyTextBtn">Add Text</button>
            `;

            $("applyTextBtn").onclick = applyText;

            panel.querySelectorAll(".text-color-btn").forEach(btn => {
                btn.onclick = () => {
                    composerData.textColor = btn.dataset.color;
                };
            });

            return;
        }

        if (tool === "sticker") {

            panel.innerHTML = `
                <div class="sticker-grid">
                    <button type="button">❤️</button>
                    <button type="button">🔥</button>
                    <button type="button">😂</button>
                    <button type="button">😍</button>
                    <button type="button">😎</button>
                    <button type="button">🎉</button>
                    <button type="button">✨</button>
                    <button type="button">👍</button>
                    <button type="button">💯</button>
                    <button type="button">🌟</button>
                    <button type="button">🎵</button>
                    <button type="button">📍</button>
                    <button type="button">🚀</button>
                    <button type="button">👑</button>
                    <button type="button">💜</button>
                    <button type="button">🦋</button>
                </div>
            `;

            panel.querySelectorAll(".sticker-grid button").forEach(btn => {
                btn.onclick = () => {
                    composerData.sticker = btn.textContent;
                    $("storyStickerPreview").textContent = composerData.sticker;
                };
            });

            return;
        }

        if (tool === "music") {

            panel.innerHTML = `
                <p style="color:#aeb4c3;font-size:13px;margin-bottom:10px;">
                    Select an audio file from your device.
                </p>
                <button type="button" id="chooseMusicBtn">Choose Music</button>
            `;

            $("chooseMusicBtn").onclick = () => $("storyMusicInput").click();
            return;
        }

        if (tool === "mention") {

            panel.innerHTML = `
                <input id="mentionInput" placeholder="@username">
                <button type="button" id="addMentionBtn">Add Mention</button>
            `;

            $("addMentionBtn").onclick = addMention;
            return;
        }

        if (tool === "draw") {
            createDrawingEditor();
            return;
        }
    }

    /* =====================================================
       TEXT
    ===================================================== */

    function applyText() {

        const input = $("storyTextInput");
        if (!input) return;

        composerData.text = input.value.trim();

        const preview = $("storyTextPreview");
        preview.textContent = composerData.text;
        preview.style.color = composerData.textColor;

        if (!composerData.type) {
            composerData.type = "text";
        }
    }

    /* =====================================================
       MENTION
    ===================================================== */

    function addMention() {

        const input = $("mentionInput");
        if (!input) return;

        let value = input.value.trim();
        if (!value) return;

        value = value.replace(/^@/, "");

        if (!composerData.mentions.includes(value)) {
            composerData.mentions.push(value);
        }

        $("storyMentionPreview").textContent =
            composerData.mentions.map(x => "@" + x).join(" ");

        input.value = "";
    }

    /* =====================================================
       DRAW
    ===================================================== */

    function createDrawingEditor() {

        const panel = $("storyEditorPanel");

        panel.innerHTML = `
            <div class="draw-controls">
                <button type="button" id="clearDraw">Clear</button>
                <button type="button" id="finishDraw">Done</button>
            </div>
        `;

        const canvas = $("storyDrawCanvas");
        const preview = $("storyPreviewArea");

        canvas.width = preview.clientWidth || 300;
        canvas.height = preview.clientHeight || 400;
        canvas.style.display = "block";

        const ctx = canvas.getContext("2d");
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#ffffff";

        let drawing = false;

        function position(event) {

            const rect = canvas.getBoundingClientRect();
            const touch = event.touches ? event.touches[0] : event;

            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        }

        function start(event) {
            drawing = true;
            const p = position(event);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            event.preventDefault();
        }

        function move(event) {
            if (!drawing) return;
            const p = position(event);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            event.preventDefault();
        }

        function stop() {
            drawing = false;
            ctx.closePath();
        }

        canvas.onmousedown = start;
        canvas.onmousemove = move;
        canvas.onmouseup = stop;
        canvas.ontouchstart = start;
        canvas.ontouchmove = move;
        canvas.ontouchend = stop;

        $("clearDraw").onclick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        };

        $("finishDraw").onclick = () => {
            composerData.drawing = canvas.toDataURL("image/png");
            canvas.style.display = "none";
        };
    }

    /* =====================================================
       PUBLISH STORY
    ===================================================== */

    async function publishStory() {

        if (!currentUser) {
            alert("Please login first.");
            return;
        }

        const button = $("publishStoryBtn");
        button.disabled = true;
        button.textContent = "Uploading...";

        try {

            let mediaURL = composerData.mediaURL;
            let musicURL = composerData.musicURL;

            if (composerData.file) {
                mediaURL = await uploadToCloudinary(composerData.file);
            }

            if (composerData.musicFile) {
                musicURL = await uploadToCloudinary(composerData.musicFile);
            }

            if (!mediaURL && !composerData.text) {
                throw new Error("Add photo, video or text first.");
            }

            const storyRef = db.ref("stories").push();

            const story = {
                uid: currentUser.uid,
                name: currentUser.displayName || "User",
                username: currentUser.email
                    ? currentUser.email.split("@")[0]
                    : "",
                photoURL: currentUser.photoURL || "assets/default-avatar.png",
                type: composerData.type || (composerData.text ? "text" : "image"),
                mediaURL: mediaURL || "",
                text: composerData.text || "",
                textColor: composerData.textColor,
                textBackground: composerData.textBackground,
                sticker: composerData.sticker,
                musicURL: musicURL || "",
                musicName: composerData.musicName,
                mentions: composerData.mentions,
                drawing: composerData.drawing,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                expiresAt: Date.now() + STORY_DURATION
            };

            await storyRef.set(story);

            button.textContent = "Story Shared ✓";

            if (typeof window.vieworaProfileToast === "function") {
                window.vieworaProfileToast("Story uploaded!");
            }

            setTimeout(closeComposer, 700);

        } catch (error) {

            console.error("Story upload failed:", error);
            alert(error.message || "Story upload failed.");
            button.disabled = false;
            button.textContent = "Share to Story";
        }
    }

    /* =====================================================
       CLOUDINARY
    ===================================================== */

    async function uploadToCloudinary(file) {

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const response = await fetch(CLOUDINARY_UPLOAD_URL, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error?.message || "Cloudinary upload failed."
            );
        }

        return result.secure_url;
    }

    /* =====================================================
       STORY MUSIC PLAYER
    ===================================================== */

    let storyAudio = null;

    function playStoryMusic(url) {

        stopStoryMusic();
        storyAudio = new Audio(url);
        storyAudio.loop = true;
        storyAudio.volume = 0.8;
        storyAudio.play().catch(() => {});
    }

    function stopStoryMusic() {

        if (storyAudio) {
            storyAudio.pause();
            storyAudio.src = "";
            storyAudio = null;
        }
    }

    function stopComposerMusic() {
        stopStoryMusic();
    }

    /* =====================================================
       PROFILE STORY OPTIONS — Instagram style
       View Stories / View Pic
    ===================================================== */

    window.openProfileStoryOptions = function (user) {

        if (!user) return;

        const old = document.getElementById("profileStoryOptions");
        if (old) old.remove();

        const overlay = createElement("div", "profile-story-options");
        overlay.id = "profileStoryOptions";

        const hasStories =
            storyGroups.some(g => g.uid === user.uid && g.stories.length > 0);

        overlay.innerHTML = `
            <div class="profile-story-sheet">
                <div class="sheet-handle"></div>

                <img class="sheet-profile-image"
                     src="${escapeAttr(user.photoURL || "assets/default-avatar.png")}"
                     alt="">

                <h3>${escapeHTML(user.name || "User")}</h3>

                ${hasStories ? `
                <button type="button" id="viewProfileStoriesBtn">
                    <span>◉</span> View Stories
                </button>
                ` : `
                <button type="button" id="viewProfileStoriesBtn" disabled style="opacity:.4">
                    <span>◉</span> No Stories
                </button>
                `}

                <button type="button" id="viewProfilePicBtn">
                    <span>◎</span> View Pic
                </button>

                <button type="button" id="closeProfileOptions">
                    Cancel
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        $("closeProfileOptions").onclick = () => overlay.remove();

        $("viewProfileStoriesBtn").onclick = () => {
            overlay.remove();
            openStoryByUID(user.uid);
        };

        $("viewProfilePicBtn").onclick = () => {
            overlay.remove();

            if (typeof window.openProfilePhotoViewer === "function") {
                window.openProfilePhotoViewer(
                    user.photoURL || "assets/default-avatar.png"
                );
            } else {
                openSimplePhotoViewer(
                    user.photoURL || "assets/default-avatar.png"
                );
            }
        };

        overlay.onclick = event => {
            if (event.target === overlay) {
                overlay.remove();
            }
        };
    };

    /* =====================================================
       SIMPLE PROFILE PIC VIEWER
    ===================================================== */

    function openSimplePhotoViewer(url) {

        const overlay = createElement("div", "simple-photo-viewer");

        overlay.innerHTML = `
            <button type="button">✕</button>
            <img src="${escapeAttr(url)}" alt="Profile">
        `;

        document.body.appendChild(overlay);

        overlay.querySelector("button").onclick = () => overlay.remove();

        overlay.onclick = event => {
            if (event.target === overlay) {
                overlay.remove();
            }
        };
    }

    /* =====================================================
       TIME AGO
    ===================================================== */

    function timeAgo(timestamp) {

        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return "Just now";

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes + "m";

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + "h";

        return "1d";
    }

    /* =====================================================
       ESCAPE
    ===================================================== */

    function escapeHTML(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttr(value) {
        return escapeHTML(value);
    }

    /* =====================================================
       TOUCH HOLD TO PAUSE
    ===================================================== */

    document.addEventListener("DOMContentLoaded", () => {

        ensureStoryViewer();

        const viewer = $("storyViewer");
        if (!viewer) return;

        let holdTimer;

        viewer.addEventListener("touchstart", event => {

            if (
                event.target.closest(".storyBottom") ||
                event.target.closest(".closeBtn")
            ) {
                return;
            }

            holdTimer = setTimeout(() => {
                storyPaused = true;
            }, 250);

        }, { passive: true });

        viewer.addEventListener("touchend", () => {
            clearTimeout(holdTimer);
            storyPaused = false;
        }, { passive: true });

        viewer.addEventListener("mousedown", () => {
            storyPaused = true;
        });

        viewer.addEventListener("mouseup", () => {
            storyPaused = false;
        });
    });

    /* =====================================================
       KEYBOARD
    ===================================================== */

    document.addEventListener("keydown", event => {

        const viewer = $("storyViewer");

        if (!viewer || viewer.style.display === "none") {
            return;
        }

        if (event.key === "ArrowRight") nextStory();
        if (event.key === "ArrowLeft") prevStory();
        if (event.key === "Escape") closeStoryViewer();
    });

    /* =====================================================
       GLOBALS
    ===================================================== */

    window.nextStory = nextStory;
    window.prevStory = prevStory;
    window.closeStoryViewer = closeStoryViewer;

    /* =====================================================
       INIT
    ===================================================== */

    initFirebase();

})();
