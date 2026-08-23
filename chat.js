"use strict";

/*
============================================================
 VIEWORA CHAT — PREMIUM PRODUCTION CHAT ENGINE
 -----------------------------------------------------------
 Firebase Realtime Database
 Firebase Auth
 Cloudinary via media-upload.js

 Compatible with:
    chat.html
    firebase.js
    media-upload.js
    call.js

 Features:
    • Realtime 1-to-1 messaging
    • Text messages
    • Image / Video / Audio / Document
    • Cloudinary upload
    • Upload progress + speed
    • Reply
    • Edit
    • Delete for me
    • Delete for everyone
    • Reactions
    • Pin
    • Copy
    • Message info
    • Search
    • Typing indicator
    • Online status
    • Read receipts
    • Emoji
    • Voice recording
    • Profile
    • Media viewer
    • Toasts
    • Premium UI hooks

 IMPORTANT:
    firebase.js must expose:
        auth
        db

 URL PARAMETERS:
    chat.html?uid=OTHER_USER_UID

 Optional:
    chat.html?uid=OTHER_USER_UID&name=John&photo=URL
============================================================
*/

(() => {

    /* ======================================================
       DOUBLE INITIALIZATION PROTECTION
    ====================================================== */

    if (window.__VIEWORA_CHAT_INITIALIZED__) {
        console.warn("VIEWORA Chat already initialized.");
        return;
    }

    window.__VIEWORA_CHAT_INITIALIZED__ = true;


    /* ======================================================
       FIREBASE CHECK
    ====================================================== */

    if (
        typeof window.auth === "undefined" ||
        typeof window.db === "undefined"
    ) {
        console.error(
            "Viewora Chat: Firebase auth/db not found."
        );

        showEarlyError(
            "Firebase is not connected."
        );

        return;
    }


    /* ======================================================
       DOM HELPERS
    ====================================================== */

    const $ = id =>
        document.getElementById(id);

    const qs = selector =>
        document.querySelector(selector);


    /* ======================================================
       DOM REFERENCES
    ====================================================== */

    const loadingOverlay =
        $("loadingOverlay");

    const loadingText =
        $("loadingText");

    const app =
        $("app");

    const backBtn =
        $("backBtn");

    const profileBtn =
        $("profileBtn");

    const chatPhoto =
        $("chatPhoto");

    const chatName =
        $("chatName");

    const chatStatus =
        $("chatStatus");

    const onlineDot =
        $("onlineDot");

    const verifiedBadge =
        $("verifiedBadge");

    const searchBtn =
        $("searchBtn");

    const menuBtn =
        $("menuBtn");

    const voiceCallBtn =
        $("voiceCallBtn");

    const videoCallBtn =
        $("videoCallBtn");

    const searchBar =
        $("searchBar");

    const searchInput =
        $("searchInput");

    const closeSearch =
        $("closeSearch");

    const chatMenu =
        $("chatMenu");

    const menuMuteBtn =
        $("menuMuteBtn");

    const menuSearchBtn =
        $("menuSearchBtn");

    const menuDeleteChatBtn =
        $("menuDeleteChatBtn");

    const chatContainer =
        $("chatContainer");

    const messagesList =
        $("messagesList");

    const typingIndicator =
        $("typingIndicator");

    const typingPhoto =
        $("typingPhoto");

    const typingText =
        $("typingText");

    const scrollBottomBtn =
        $("scrollBottomBtn");

    const reactionBar =
        $("reactionBar");

    const replyPreview =
        $("replyPreview");

    const replyUser =
        $("replyUser");

    const replyText =
        $("replyText");

    const closeReplyPreview =
        $("closeReplyPreview");

    const attachBtn =
        $("attachBtn");

    const messageInput =
        $("messageInput");

    const emojiBtn =
        $("emojiBtn");

    const cameraBtn =
        $("cameraBtn");

    const voiceBtn =
        $("voiceBtn");

    const sendBtn =
        $("sendBtn");

    const emojiPanel =
        $("emojiPanel");

    const attachmentSheet =
        $("attachmentSheet");

    const attachmentOverlay =
        qs(".attachmentOverlay");

    const closeAttachmentBtn =
        $("closeAttachmentBtn");

    const galleryBtn =
        $("galleryBtn");

    const cameraAttachmentBtn =
        $("cameraAttachmentBtn");

    const videoBtn =
        $("videoBtn");

    const audioBtn =
        $("audioBtn");

    const documentBtn =
        $("documentBtn");

    const imagePicker =
        $("imagePicker");

    const videoPicker =
        $("videoPicker");

    const audioPicker =
        $("audioPicker");

    const documentPicker =
        $("documentPicker");

    const cameraPicker =
        $("cameraPicker");

    const mediaPreviewModal =
        $("mediaPreviewModal");

    const previewImage =
        $("previewImage");

    const previewVideo =
        $("previewVideo");

    const previewAudioBox =
        $("previewAudioBox");

    const previewAudio =
        $("previewAudio");

    const previewAudioName =
        $("previewAudioName");

    const previewFileBox =
        $("previewFileBox");

    const previewFileName =
        $("previewFileName");

    const previewFileSize =
        $("previewFileSize");

    const mediaCaption =
        $("mediaCaption");

    const closePreviewBtn =
        $("closePreviewBtn");

    const cancelMediaBtn =
        $("cancelMediaBtn");

    const sendMediaBtn =
        $("sendMediaBtn");

    const imageViewer =
        $("imageViewer");

    const viewerImage =
        $("viewerImage");

    const closeViewerBtn =
        $("closeViewerBtn");

    const videoViewer =
        $("videoViewer");

    const viewerVideo =
        $("viewerVideo");

    const closeVideoViewerBtn =
        $("closeVideoViewerBtn");

    const profileModal =
        $("profileModal");

    const profileImage =
        $("profileImage");

    const profileName =
        $("profileName");

    const profileUsername =
        $("profileUsername");

    const profileStatus =
        $("profileStatus");

    const closeProfileBtn =
        $("closeProfileBtn");

    const deleteModal =
        $("deleteModal");

    const deleteForMeBtn =
        $("deleteForMeBtn");

    const deleteForEveryoneBtn =
        $("deleteForEveryoneBtn");

    const cancelDeleteBtn =
        $("cancelDeleteBtn");

    const messageInfoModal =
        $("messageInfoModal");

    const closeInfoBtn =
        $("closeInfoBtn");

    const sentTime =
        $("sentTime");

    const deliveredTime =
        $("deliveredTime");

    const seenTime =
        $("seenTime");

    const messageMenu =
        $("messageMenu");

    const replyMessageBtn =
        $("replyMessageBtn");

    const copyMessageBtn =
        $("copyMessageBtn");

    const reactMessageBtn =
        $("reactMessageBtn");

    const editMessageBtn =
        $("editMessageBtn");

    const pinMessageBtn =
        $("pinMessageBtn");

    const infoMessageBtn =
        $("infoMessageBtn");

    const deleteMessageBtn =
        $("deleteMessageBtn");

    const recordOverlay =
        $("recordOverlay");

    const recordTime =
        $("recordTime");

    const cancelRecordingBtn =
        $("cancelRecordingBtn");

    const stopRecordingBtn =
        $("stopRecordingBtn");

    const uploadOverlay =
        $("uploadOverlay");

    const uploadFileName =
        $("uploadFileName");

    const uploadProgressBar =
        $("uploadProgressBar");

    const uploadPercent =
        $("uploadPercent");

    const uploadSpeed =
        $("uploadSpeed");

    const cancelUploadBtn =
        $("cancelUploadBtn");

    const toast =
        $("toast");

    const toastIcon =
        $("toastIcon");

    const toastText =
        $("toastText");


    /* ======================================================
       CONSTANTS
    ====================================================== */

    const DEFAULT_AVATAR =
        "assets/default-avatar.png";

    const MAX_MESSAGE_LENGTH =
        5000;

    const TYPING_TIMEOUT =
        2500;

    const SCROLL_THRESHOLD =
        180;

    const CHAT_PARAM =
        "uid";


    /* ======================================================
       STATE
    ====================================================== */

    const state = {

        currentUser: null,

        otherUser: {
            uid: "",
            name: "Viewora User",
            username: "@user",
            photo: DEFAULT_AVATAR,
            verified: false,
            online: false,
            lastSeen: null
        },

        chatId: "",

        messages: new Map(),

        currentMessageId: null,

        selectedMessage: null,

        replyTo: null,

        editingMessageId: null,

        pendingMedia: null,

        uploadTask: null,

        uploadCancelled: false,

        typingTimer: null,

        typingActive: false,

        recording: false,

        mediaRecorder: null,

        recordChunks: [],

        recordStartedAt: 0,

        recordTimer: null,

        isNearBottom: true,

        searchTerm: "",

        muted: false,

        listeners: [],

        userListener: null,

        presenceListener: null,

        typingListener: null,

        messagesListener: null,

        toastTimer: null

    };


    /* ======================================================
       URL PARAMS
    ====================================================== */

    const params =
        new URLSearchParams(
            window.location.search
        );

    const targetUid =
        params.get(CHAT_PARAM);


    /* ======================================================
       VALIDATE CHAT USER
    ====================================================== */

    if (!targetUid) {

        hideLoading();

        showToast(
            "Chat user not found.",
            "error"
        );

        setTimeout(() => {

            if (
                document.referrer &&
                document.referrer !== window.location.href
            ) {
                window.history.back();
            }

        }, 1000);

        return;
    }


    /* ======================================================
       UTILITY FUNCTIONS
    ====================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function safeURL(url) {

        const value =
            String(url || "").trim();

        if (!value) {
            return "";
        }

        if (
            value.startsWith("https://") ||
            value.startsWith("http://")
        ) {
            return value;
        }

        return "";
    }


    function formatTime(timestamp) {

        if (!timestamp) {
            return "";
        }

        const date =
            new Date(timestamp);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    function formatDate(timestamp) {

        if (!timestamp) {
            return "";
        }

        const date =
            new Date(timestamp);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleDateString(
            [],
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );
    }


    function formatFileSize(bytes) {

        const size =
            Number(bytes || 0);

        if (size <= 0) {
            return "0 KB";
        }

        if (size < 1024) {
            return `${size} B`;
        }

        if (size < 1024 * 1024) {
            return `${(
                size / 1024
            ).toFixed(1)} KB`;
        }

        if (size < 1024 * 1024 * 1024) {
            return `${(
                size /
                1024 /
                1024
            ).toFixed(1)} MB`;
        }

        return `${(
            size /
            1024 /
            1024 /
            1024
        ).toFixed(1)} GB`;
    }


    function normalizeUsername(value) {

        const text =
            String(value || "").trim();

        if (!text) {
            return "@user";
        }

        return text.startsWith("@")
            ? text
            : `@${text}`;
    }


    function getChatId(uid1, uid2) {

        return [
            String(uid1),
            String(uid2)
        ]
            .sort()
            .join("_");
    }


    function showEarlyError(message) {

        const text =
            document.createElement("div");

        text.style.cssText = `
            position:fixed;
            inset:0;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:24px;
            background:#08090d;
            color:#fff;
            font-family:Inter,Arial,sans-serif;
            text-align:center;
            z-index:999999;
        `;

        text.textContent =
            message;

        document.body.appendChild(text);
    }


    function hideLoading() {

        if (!loadingOverlay) {
            return;
        }

        loadingOverlay.classList.add(
            "hidden"
        );

        if (app) {
            app.classList.remove(
                "hidden"
            );
        }
    }


    function setLoadingText(text) {

        if (loadingText) {
            loadingText.textContent =
                text;
        }
    }


    /* ======================================================
       TOAST
    ====================================================== */

    function showToast(
        message,
        type = "success"
    ) {

        if (!toast) {
            return;
        }

        if (state.toastTimer) {
            clearTimeout(
                state.toastTimer
            );
        }

        if (toastText) {
            toastText.textContent =
                message;
        }

        if (toastIcon) {

            const icon =
                toastIcon.querySelector("i");

            if (icon) {

                icon.className =
                    type === "error"
                        ? "fa-solid fa-circle-exclamation"
                        : type === "warning"
                            ? "fa-solid fa-triangle-exclamation"
                            : "fa-solid fa-circle-check";
            }
        }

        toast.classList.remove(
            "hidden"
        );

        state.toastTimer =
            setTimeout(() => {

                toast.classList.add(
                    "hidden"
                );

            }, 2800);
    }


    /* ======================================================
       FIREBASE SERVER TIME
    ====================================================== */

    function serverTimestamp() {

        if (
            window.firebase &&
            firebase.database &&
            firebase.database.ServerValue
        ) {
            return firebase.database.ServerValue.TIMESTAMP;
        }

        return Date.now();
    }


    /* ======================================================
       DATABASE PATHS
    ====================================================== */

    function messagesRef() {

        return db.ref(
            `vieworaChats/${state.chatId}/messages`
        );
    }


    function chatRef() {

        return db.ref(
            `vieworaChats/${state.chatId}`
        );
    }


    function typingRef(uid) {

        return db.ref(
            `vieworaChats/${state.chatId}/typing/${uid}`
        );
    }


    /* ======================================================
       LOAD OTHER USER
    ====================================================== */

    async function loadOtherUser() {

        const fallbackName =
            params.get("name");

        const fallbackPhoto =
            params.get("photo");

        if (fallbackName) {
            state.otherUser.name =
                fallbackName;
        }

        if (fallbackPhoto) {
            state.otherUser.photo =
                safeURL(fallbackPhoto) ||
                DEFAULT_AVATAR;
        }

        try {

            const snapshot =
                await db.ref(
                    `users/${targetUid}`
                ).once("value");

            const user =
                snapshot.val();

            if (user) {

                state.otherUser.uid =
                    targetUid;

                state.otherUser.name =
                    user.displayName ||
                    user.name ||
                    user.fullName ||
                    fallbackName ||
                    "Viewora User";

                state.otherUser.username =
                    normalizeUsername(
                        user.username ||
                        user.userName ||
                        user.handle
                    );

                state.otherUser.photo =
                    safeURL(
                        user.photoURL ||
                        user.photo ||
                        user.profilePhoto ||
                        user.avatar
                    ) ||
                    fallbackPhoto ||
                    DEFAULT_AVATAR;

                state.otherUser.verified =
                    Boolean(
                        user.verified ||
                        user.isVerified
                    );

                state.otherUser.online =
                    Boolean(
                        user.online ||
                        user.isOnline
                    );

                state.otherUser.lastSeen =
                    user.lastSeen ||
                    null;

            } else {

                state.otherUser.uid =
                    targetUid;
            }

        } catch (error) {

            console.warn(
                "Unable to load user profile:",
                error
            );

            state.otherUser.uid =
                targetUid;
        }

        renderHeader();
    }


    /* ======================================================
       RENDER HEADER
    ====================================================== */

    function renderHeader() {

        const user =
            state.otherUser;

        if (chatName) {
            chatName.textContent =
                user.name;
        }

        if (chatPhoto) {
            chatPhoto.src =
                user.photo ||
                DEFAULT_AVATAR;
        }

        if (typingPhoto) {
            typingPhoto.src =
                user.photo ||
                DEFAULT_AVATAR;
        }

        if (profileImage) {
            profileImage.src =
                user.photo ||
                DEFAULT_AVATAR;
        }

        if (profileName) {
            profileName.textContent =
                user.name;
        }

        if (profileUsername) {
            profileUsername.textContent =
                user.username;
        }

        if (verifiedBadge) {

            verifiedBadge.classList.toggle(
                "hidden",
                !user.verified
            );
        }

        updatePresenceUI();
    }


    /* ======================================================
       PRESENCE
    ====================================================== */

    function updatePresenceUI() {

        const online =
            Boolean(
                state.otherUser.online
            );

        if (onlineDot) {
            onlineDot.classList.toggle(
                "hidden",
                !online
            );
        }

        if (chatStatus) {

            if (online) {

                chatStatus.textContent =
                    "Active now";

            } else if (
                state.otherUser.lastSeen
            ) {

                chatStatus.textContent =
                    `Last seen ${formatTime(
                        state.otherUser.lastSeen
                    )}`;

            } else {

                chatStatus.textContent =
                    "Offline";
            }
        }

        if (profileStatus) {

            profileStatus.textContent =
                online
                    ? "Active now"
                    : state.otherUser.lastSeen
                        ? `Last seen ${formatDate(
                            state.otherUser.lastSeen
                        )}`
                        : "Offline";
        }
    }


    /* ======================================================
       WATCH PRESENCE
    ====================================================== */

    function watchPresence() {

        const ref =
            db.ref(
                `users/${targetUid}`
            );

        const callback =
            snapshot => {

                const user =
                    snapshot.val();

                if (!user) {
                    return;
                }

                state.otherUser.online =
                    Boolean(
                        user.online ||
                        user.isOnline
                    );

                state.otherUser.lastSeen =
                    user.lastSeen ||
                    state.otherUser.lastSeen;

                updatePresenceUI();
            };

        ref.on(
            "value",
            callback
        );

        state.presenceListener = {
            ref,
            callback
        };
    }


    /* ======================================================
       OWN PRESENCE
    ====================================================== */

    function setOwnPresence() {

        if (!state.currentUser) {
            return;
        }

        const uid =
            state.currentUser.uid;

        const ref =
            db.ref(
                `users/${uid}`
            );

        const connectedRef =
            db.ref(".info/connected");

        const callback =
            snapshot => {

                if (
                    snapshot.val() !== true
                ) {
                    return;
                }

                const presenceRef =
                    ref;

                presenceRef.update({
                    online: true,
                    isOnline: true
                });

                presenceRef.onDisconnect()
                    .update({
                        online: false,
                        isOnline: false,
                        lastSeen:
                            serverTimestamp()
                    });
            };

        connectedRef.on(
            "value",
            callback
        );

        state.userListener = {
            ref: connectedRef,
            callback
        };
    }


    /* ======================================================
       CREATE CHAT META
    ====================================================== */

    async function ensureChat() {

        const now =
            serverTimestamp();

        const updates = {};

        updates[
            `vieworaChats/${state.chatId}/participants/${state.currentUser.uid}`
        ] = true;

        updates[
            `vieworaChats/${state.chatId}/participants/${targetUid}`
        ] = true;

        updates[
            `vieworaChats/${state.chatId}/updatedAt`
        ] = now;

        updates[
            `vieworaChats/${state.chatId}/participantData/${state.currentUser.uid}/name`
        ] =
            state.currentUser.displayName ||
            state.currentUser.email ||
            "Viewora User";

        updates[
            `vieworaChats/${state.chatId}/participantData/${targetUid}/name`
        ] =
            state.otherUser.name;

        await db.ref().update(
            updates
        );
    }


    /* ======================================================
       MESSAGE LISTENER
    ====================================================== */

    function listenMessages() {

        const ref =
            messagesRef();

        const callback =
            snapshot => {

                const data =
                    snapshot.val();

                if (!data) {

                    state.messages.clear();

                    renderMessages();

                    return;
                }

                state.messages.clear();

                Object.entries(data)
                    .forEach(
                        ([id, message]) => {

                            if (!message) {
                                return;
                            }

                            state.messages.set(
                                id,
                                {
                                    ...message,
                                    id
                                }
                            );
                        }
                    );

                renderMessages();

                markIncomingAsSeen();
            };

        ref.on(
            "value",
            callback
        );

        state.messagesListener = {
            ref,
            callback
        };
    }


    /* ======================================================
       SORT MESSAGES
    ====================================================== */

    function sortedMessages() {

        return Array.from(
            state.messages.values()
        )
            .sort(
                (a, b) =>
                    Number(
                        a.createdAt || 0
                    ) -
                    Number(
                        b.createdAt || 0
                    )
            );
    }


    /* ======================================================
       MESSAGE TYPE
    ====================================================== */

    function messageKind(message) {

        if (
            message.deletedForEveryone
        ) {
            return "deleted";
        }

        if (
            message.type === "image"
        ) {
            return "image";
        }

        if (
            message.type === "video"
        ) {
            return "video";
        }

        if (
            message.type === "audio"
        ) {
            return "audio";
        }

        if (
            message.type === "file" ||
            message.type === "document"
        ) {
            return "file";
        }

        return "text";
    }


    /* ======================================================
       RENDER MESSAGES
    ====================================================== */

    function renderMessages() {

        if (!messagesList) {
            return;
        }

        const wasNearBottom =
            isNearBottom();

        const previousScroll =
            chatContainer
                ? chatContainer.scrollTop
                : 0;

        const list =
            sortedMessages();

        if (!list.length) {

            messagesList.innerHTML = `
                <div class="emptyChatState">
                    <div class="emptyChatIcon">
                        <i class="fa-regular fa-comments"></i>
                    </div>
                    <h3>Start a conversation</h3>
                    <p>Send a message to ${escapeHTML(
                        state.otherUser.name
                    )}</p>
                </div>
            `;

            return;
        }

        let html = "";

        let previousDate = "";

        list.forEach(
            message => {

                const dateKey =
                    message.createdAt
                        ? formatDate(
                            message.createdAt
                        )
                        : "";

                if (
                    dateKey &&
                    dateKey !== previousDate
                ) {

                    html += `
                        <div class="messageDateDivider">
                            <span>${escapeHTML(
                                dateKey
                            )}</span>
                        </div>
                    `;

                    previousDate =
                        dateKey;
                }

                html +=
                    renderMessage(
                        message
                    );
            }
        );

        messagesList.innerHTML =
            html;

        bindMessageElements();

        applySearchHighlight();

        if (wasNearBottom) {

            requestAnimationFrame(
                scrollToBottom
            );

        } else if (chatContainer) {

            chatContainer.scrollTop =
                previousScroll;
        }
    }


    /* ======================================================
       RENDER SINGLE MESSAGE
    ====================================================== */

    function renderMessage(message) {

        const mine =
            message.senderId ===
            state.currentUser.uid;

        const kind =
            messageKind(message);

        const deleted =
            kind === "deleted";

        const edited =
            Boolean(message.edited);

        const pinned =
            Boolean(message.pinned);

        const time =
            formatTime(
                message.createdAt
            );

        const status =
            mine
                ? renderStatus(
                    message
                )
                : "";

        const reactionHTML =
            renderReactions(
                message
            );

        const replyHTML =
            renderReplyPreview(
                message.replyTo
            );

        let content = "";

        if (deleted) {

            content = `
                <div class="deletedMessage">
                    <i class="fa-solid fa-ban"></i>
                    <span>
                        This message was deleted
                    </span>
                </div>
            `;

        } else if (kind === "image") {

            content = `
                <button
                    class="mediaMessage imageMessage"
                    data-action="image"
                    data-id="${escapeHTML(message.id)}"
                    type="button"
                >
                    <img
                        src="${escapeHTML(
                            safeURL(message.url)
                        )}"
                        alt="${escapeHTML(
                            message.caption ||
                            "Image"
                        )}"
                        loading="lazy"
                    >
                    ${
                        message.caption
                            ? `<span class="mediaCaption">
                                ${formatText(
                                    message.caption
                                )}
                               </span>`
                            : ""
                    }
                </button>
            `;

        } else if (kind === "video") {

            content = `
                <button
                    class="mediaMessage videoMessage"
                    data-action="video"
                    data-id="${escapeHTML(message.id)}"
                    type="button"
                >
                    <div class="videoThumb">
                        <video
                            src="${escapeHTML(
                                safeURL(message.url)
                            )}"
                            preload="metadata"
                            muted
                            playsinline
                        ></video>
                        <span class="playOverlay">
                            <i class="fa-solid fa-play"></i>
                        </span>
                    </div>

                    ${
                        message.caption
                            ? `<span class="mediaCaption">
                                ${formatText(
                                    message.caption
                                )}
                               </span>`
                            : ""
                    }
                </button>
            `;

        } else if (kind === "audio") {

            content = `
                <div class="audioMessage">
                    <div class="audioIcon">
                        <i class="fa-solid fa-music"></i>
                    </div>
                    <div class="audioContent">
                        <strong>
                            ${escapeHTML(
                                message.fileName ||
                                "Voice message"
                            )}
                        </strong>
                        <audio
                            controls
                            preload="metadata"
                            src="${escapeHTML(
                                safeURL(message.url)
                            )}"
                        ></audio>
                    </div>
                </div>
            `;

        } else if (kind === "file") {

            content = `
                <a
                    class="fileMessage"
                    href="${escapeHTML(
                        safeURL(message.url)
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <span class="fileMessageIcon">
                        <i class="fa-solid fa-file"></i>
                    </span>

                    <span class="fileMessageInfo">
                        <strong>
                            ${escapeHTML(
                                message.fileName ||
                                "Document"
                            )}
                        </strong>

                        <small>
                            ${escapeHTML(
                                formatFileSize(
                                    message.fileSize
                                )
                            )}
                        </small>
                    </span>

                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            `;

        } else {

            content = `
                <div class="textMessage">
                    ${formatText(
                        message.text || ""
                    )}
                </div>
            `;
        }

        return `
            <article
                class="messageRow ${
                    mine
                        ? "mine"
                        : "theirs"
                } ${
                    pinned
                        ? "isPinned"
                        : ""
                }"
                data-message-id="${escapeHTML(
                    message.id
                )}"
            >

                <div
                    class="messageBubble"
                    data-message-id="${escapeHTML(
                        message.id
                    )}"
                    data-mine="${mine ? "1" : "0"}"
                >

                    ${
                        pinned
                            ? `
                                <div class="pinnedLabel">
                                    <i class="fa-solid fa-thumbtack"></i>
                                    Pinned
                                </div>
                              `
                            : ""
                    }

                    ${replyHTML}

                    ${content}

                    ${
                        edited
                            ? `
                                <span class="editedLabel">
                                    edited
                                </span>
                              `
                            : ""
                    }

                    <div class="messageMeta">

                        <time>
                            ${escapeHTML(time)}
                        </time>

                        ${status}

                    </div>

                    ${reactionHTML}

                </div>

            </article>
        `;
    }


    /* ======================================================
       FORMAT TEXT
    ====================================================== */

    function formatText(text) {

        let safe =
            escapeHTML(text);

        if (state.searchTerm) {

            const term =
                escapeRegExp(
                    state.searchTerm
                );

            if (term) {

                const regex =
                    new RegExp(
                        `(${term})`,
                        "gi"
                    );

                safe =
                    safe.replace(
                        regex,
                        "<mark>$1</mark>"
                    );
            }
        }

        return safe
            .replace(/\n/g, "<br>");
    }


    function escapeRegExp(value) {

        return String(value)
            .replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );
    }


    /* ======================================================
       REPLY PREVIEW
    ====================================================== */

    function renderReplyPreview(reply) {

        if (!reply) {
            return "";
        }

        return `
            <div class="messageReplyPreview">

                <strong>
                    ${escapeHTML(
                        reply.senderName ||
                        "Message"
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        reply.text ||
                        reply.fileName ||
                        "Media"
                    )}
                </span>

            </div>
        `;
    }


    /* ======================================================
       MESSAGE STATUS
    ====================================================== */

    function renderStatus(message) {

        if (message.seenAt) {

            return `
                <span
                    class="messageStatus seen"
                    title="Seen"
                >
                    <i class="fa-solid fa-check-double"></i>
                </span>
            `;
        }

        if (message.deliveredAt) {

            return `
                <span
                    class="messageStatus delivered"
                    title="Delivered"
                >
                    <i class="fa-solid fa-check-double"></i>
                </span>
            `;
        }

        return `
            <span
                class="messageStatus sent"
                title="Sent"
            >
                <i class="fa-solid fa-check"></i>
            </span>
        `;
    }


    /* ======================================================
       REACTIONS
    ====================================================== */

    function renderReactions(message) {

        const reactions =
            message.reactions;

        if (
            !reactions ||
            typeof reactions !== "object"
        ) {
            return "";
        }

        const counts = {};

        Object.values(reactions)
            .forEach(reaction => {

                if (!reaction) {
                    return;
                }

                counts[reaction] =
                    (counts[reaction] || 0) + 1;
            });

        const entries =
            Object.entries(counts);

        if (!entries.length) {
            return "";
        }

        return `
            <div class="messageReactions">

                ${entries
                    .map(
                        ([emoji, count]) => `
                            <button
                                type="button"
                                class="reactionChip"
                                data-reaction="${escapeHTML(
                                    emoji
                                )}"
                            >
                                <span>${escapeHTML(
                                    emoji
                                )}</span>
                                <small>${count}</small>
                            </button>
                        `
                    )
                    .join("")}

            </div>
        `;
    }


    /* ======================================================
       BIND MESSAGE EVENTS
    ====================================================== */

    function bindMessageElements() {

        if (!messagesList) {
            return;
        }

        messagesList
            .querySelectorAll(
                ".messageBubble"
            )
            .forEach(
                element => {

                    element.addEventListener(
                        "contextmenu",
                        event => {

                            event.preventDefault();

                            const id =
                                element.dataset.messageId;

                            openMessageMenu(
                                id,
                                event.clientX,
                                event.clientY
                            );
                        }
                    );

                    let pressTimer =
                        null;

                    element.addEventListener(
                        "touchstart",
                        event => {

                            const touch =
                                event.touches[0];

                            pressTimer =
                                setTimeout(
                                    () => {

                                        openMessageMenu(
                                            element.dataset.messageId,
                                            touch.clientX,
                                            touch.clientY
                                        );

                                    },
                                    550
                                );
                        },
                        {
                            passive: true
                        }
                    );

                    element.addEventListener(
                        "touchend",
                        () => {

                            if (pressTimer) {
                                clearTimeout(
                                    pressTimer
                                );
                            }
                        }
                    );

                    element.addEventListener(
                        "touchmove",
                        () => {

                            if (pressTimer) {
                                clearTimeout(
                                    pressTimer
                                );
                            }
                        },
                        {
                            passive: true
                        }
                    );
                }
            );


        messagesList
            .querySelectorAll(
                "[data-action='image']"
            )
            .forEach(
                element => {

                    element.addEventListener(
                        "click",
                        () => {

                            const message =
                                state.messages.get(
                                    element.dataset.id
                                );

                            if (message) {
                                openImageViewer(
                                    message.url
                                );
                            }
                        }
                    );
                }
            );


        messagesList
            .querySelectorAll(
                "[data-action='video']"
            )
            .forEach(
                element => {

                    element.addEventListener(
                        "click",
                        () => {

                            const message =
                                state.messages.get(
                                    element.dataset.id
                                );

                            if (message) {
                                openVideoViewer(
                                    message.url
                                );
                            }
                        }
                    );
                }
            );


        messagesList
            .querySelectorAll(
                ".reactionChip"
            )
            .forEach(
                element => {

                    element.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            const bubble =
                                element.closest(
                                    ".messageBubble"
                                );

                            if (!bubble) {
                                return;
                            }

                            toggleReaction(
                                bubble.dataset.messageId,
                                element.dataset.reaction
                            );
                        }
                    );
                }
            );
    }


    /* ======================================================
       MESSAGE MENU
    ====================================================== */

    function openMessageMenu(
        messageId,
        x,
        y
    ) {

        const message =
            state.messages.get(
                messageId
            );

        if (!message) {
            return;
        }

        state.selectedMessage =
            message;

        state.currentMessageId =
            messageId;

        if (!messageMenu) {
            return;
        }

        const mine =
            message.senderId ===
            state.currentUser.uid;

        if (editMessageBtn) {

            editMessageBtn.classList.toggle(
                "hidden",
                !mine ||
                message.type !== "text" ||
                Boolean(
                    message.deletedForEveryone
                )
            );
        }

        if (deleteMessageBtn) {
            deleteMessageBtn.classList.remove(
                "hidden"
            );
        }

        if (messageMenu.style.position !== "fixed") {

            messageMenu.style.position =
                "fixed";
        }

        const width =
            220;

        const height =
            Math.min(
                messageMenu.scrollHeight || 400,
                420
            );

        let left =
            Number(x || 0);

        let top =
            Number(y || 0);

        if (
            left + width >
            window.innerWidth - 12
        ) {
            left =
                window.innerWidth -
                width -
                12;
        }

        if (
            top + height >
            window.innerHeight - 12
        ) {
            top =
                window.innerHeight -
                height -
                12;
        }

        left =
            Math.max(
                12,
                left
            );

        top =
            Math.max(
                12,
                top
            );

        messageMenu.style.left =
            `${left}px`;

        messageMenu.style.top =
            `${top}px`;

        messageMenu.classList.remove(
            "hidden"
        );
    }


    function closeMessageMenu() {

        if (messageMenu) {
            messageMenu.classList.add(
                "hidden"
            );
        }
    }


    /* ======================================================
       REPLY
    ====================================================== */

    function startReply(message) {

        if (!message) {
            return;
        }

        state.replyTo = {
            id: message.id,
            senderId: message.senderId,
            senderName:
                message.senderId ===
                state.currentUser.uid
                    ? "You"
                    : state.otherUser.name,
            text:
                message.text ||
                message.caption ||
                message.fileName ||
                "Media",
            type:
                message.type ||
                "text"
        };

        state.editingMessageId =
            null;

        if (replyUser) {
            replyUser.textContent =
                state.replyTo.senderName;
        }

        if (replyText) {
            replyText.textContent =
                state.replyTo.text;
        }

        if (replyPreview) {
            replyPreview.classList.remove(
                "hidden"
            );
        }

        closeMessageMenu();

        messageInput?.focus();
    }


    function clearReply() {

        state.replyTo =
            null;

        if (replyPreview) {
            replyPreview.classList.add(
                "hidden"
            );
        }
    }


    /* ======================================================
       EDIT
    ====================================================== */

    function startEdit(message) {

        if (!message) {
            return;
        }

        if (
            message.senderId !==
            state.currentUser.uid
        ) {
            return;
        }

        if (
            message.type &&
            message.type !== "text"
        ) {
            showToast(
                "Only text messages can be edited.",
                "warning"
            );

            return;
        }

        state.editingMessageId =
            message.id;

        state.replyTo =
            null;

        if (replyPreview) {
            replyPreview.classList.add(
                "hidden"
            );
        }

        if (messageInput) {

            messageInput.value =
                message.text || "";

            messageInput.focus();

            autoResizeInput();

            try {
                messageInput.setSelectionRange(
                    messageInput.value.length,
                    messageInput.value.length
                );
            } catch (_) {}
        }

        closeMessageMenu();
    }


    async function saveEditedMessage() {

        const id =
            state.editingMessageId;

        if (!id) {
            return false;
        }

        const message =
            state.messages.get(id);

        if (!message) {
            return false;
        }

        const text =
            String(
                messageInput?.value || ""
            ).trim();

        if (!text) {
            showToast(
                "Message cannot be empty.",
                "warning"
            );

            return false;
        }

        if (
            text.length >
            MAX_MESSAGE_LENGTH
        ) {
            showToast(
                "Message is too long.",
                "warning"
            );

            return false;
        }

        try {

            await messagesRef()
                .child(id)
                .update({
                    text,
                    edited: true,
                    editedAt:
                        serverTimestamp()
                });

            state.editingMessageId =
                null;

            messageInput.value = "";

            autoResizeInput();

            updateComposerMode();

            showToast(
                "Message edited."
            );

            return true;

        } catch (error) {

            console.error(
                "Edit message error:",
                error
            );

            showToast(
                "Unable to edit message.",
                "error"
            );

            return false;
        }
    }


    /* ======================================================
       SEND TEXT
    ====================================================== */

    async function sendText() {

        if (!state.currentUser) {
            return;
        }

        if (state.editingMessageId) {

            await saveEditedMessage();

            return;
        }

        const text =
            String(
                messageInput?.value || ""
            ).trim();

        if (!text) {
            return;
        }

        if (
            text.length >
            MAX_MESSAGE_LENGTH
        ) {
            showToast(
                "Message is too long.",
                "warning"
            );

            return;
        }

        const messageRef =
            messagesRef().push();

        const message = {

            id:
                messageRef.key,

            senderId:
                state.currentUser.uid,

            receiverId:
                targetUid,

            type:
                "text",

            text,

            createdAt:
                serverTimestamp(),

            deliveredAt:
                null,

            seenAt:
                null,

            edited:
                false,

            pinned:
                false,

            deletedForEveryone:
                false

        };

        if (state.replyTo) {

            message.replyTo =
                {
                    ...state.replyTo
                };
        }

        try {

            await messageRef.set(
                message
            );

            messageInput.value =
                "";

            autoResizeInput();

            clearReply();

            setTyping(false);

            updateComposerMode();

            requestAnimationFrame(
                scrollToBottom
            );

        } catch (error) {

            console.error(
                "Send message error:",
                error
            );

            showToast(
                "Message could not be sent.",
                "error"
            );
        }
    }


    /* ======================================================
       MARK DELIVERED / SEEN
    ====================================================== */

    async function markIncomingAsSeen() {

        if (!state.currentUser) {
            return;
        }

        const updates = {};

        state.messages.forEach(
            message => {

                if (
                    message.senderId ===
                    state.currentUser.uid
                ) {
                    return;
                }

                if (
                    message.seenAt
                ) {
                    return;
                }

                updates[
                    `${message.id}/deliveredAt`
                ] =
                    message.deliveredAt ||
                    serverTimestamp();

                if (
                    state.isNearBottom
                ) {
                    updates[
                        `${message.id}/seenAt`
                    ] =
                        serverTimestamp();
                }
            }
        );

        if (!Object.keys(updates).length) {
            return;
        }

        try {

            await messagesRef()
                .update(
                    updates
                );

        } catch (error) {

            console.warn(
                "Read receipt error:",
                error
            );
        }
    }


    /* ======================================================
       DELETE MESSAGE
    ====================================================== */

    function openDeleteModal() {

        if (!state.selectedMessage) {
            return;
        }

        closeMessageMenu();

        if (deleteModal) {
            deleteModal.classList.remove(
                "hidden"
            );
        }
    }


    function closeDeleteModal() {

        if (deleteModal) {
            deleteModal.classList.add(
                "hidden"
            );
        }
    }


    async function deleteForMe() {

        const message =
            state.selectedMessage;

        if (!message) {
            return;
        }

        try {

            await db.ref(
                `vieworaChats/${state.chatId}/userDeleted/${state.currentUser.uid}/${message.id}`
            ).set(
                true
            );

            closeDeleteModal();

            showToast(
                "Message deleted for you."
            );

            await loadUserDeleted();

        } catch (error) {

            console.error(
                "Delete for me error:",
                error
            );

            showToast(
                "Unable to delete message.",
                "error"
            );
        }
    }


    async function deleteForEveryone() {

        const message =
            state.selectedMessage;

        if (!message) {
            return;
        }

        if (
            message.senderId !==
            state.currentUser.uid
        ) {
            showToast(
                "You can only delete your own message for everyone.",
                "warning"
            );

            closeDeleteModal();

            return;
        }

        try {

            await messagesRef()
                .child(message.id)
                .update({
                    deletedForEveryone:
                        true,

                    deletedAt:
                        serverTimestamp(),

                    text:
                        "",

                    caption:
                        ""
                });

            closeDeleteModal();

            showToast(
                "Message deleted for everyone."
            );

        } catch (error) {

            console.error(
                "Delete for everyone error:",
                error
            );

            showToast(
                "Unable to delete message.",
                "error"
            );
        }
    }


    /* ======================================================
       USER DELETED MESSAGES
    ====================================================== */

    async function loadUserDeleted() {

        if (!state.currentUser) {
            return;
        }

        try {

            const snapshot =
                await db.ref(
                    `vieworaChats/${state.chatId}/userDeleted/${state.currentUser.uid}`
                ).once("value");

            const deleted =
                snapshot.val() || {};

            deleted &&
                Object.keys(deleted)
                    .forEach(id => {
                        state.messages.delete(
                            id
                        );
                    });

            renderMessages();

        } catch (error) {

            console.warn(
                "User deleted messages error:",
                error
            );
        }
    }


    /* ======================================================
       COPY MESSAGE
    ====================================================== */

    async function copySelectedMessage() {

        const message =
            state.selectedMessage;

        closeMessageMenu();

        if (!message) {
            return;
        }

        const text =
            message.text ||
            message.caption ||
            message.fileName ||
            message.url ||
            "";

        if (!text) {

            showToast(
                "Nothing to copy.",
                "warning"
            );

            return;
        }

        try {

            if (
                navigator.clipboard &&
                navigator.clipboard.writeText
            ) {

                await navigator.clipboard
                    .writeText(
                        text
                    );

            } else {

                const textarea =
                    document.createElement(
                        "textarea"
                    );

                textarea.value =
                    text;

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
            }

            showToast(
                "Copied to clipboard."
            );

        } catch (error) {

            console.warn(
                "Copy error:",
                error
            );

            showToast(
                "Could not copy message.",
                "error"
            );
        }
    }


    /* ======================================================
       REACTION
    ====================================================== */

    async function toggleReaction(
        messageId,
        emoji
    ) {

        if (
            !state.currentUser ||
            !messageId ||
            !emoji
        ) {
            return;
        }

        const uid =
            state.currentUser.uid;

        const ref =
            messagesRef()
                .child(messageId)
                .child("reactions")
                .child(uid);

        try {

            const snapshot =
                await ref.once(
                    "value"
                );

            if (
                snapshot.exists() &&
                snapshot.val() === emoji
            ) {

                await ref.remove();

            } else {

                await ref.set(
                    emoji
                );
            }

        } catch (error) {

            console.error(
                "Reaction error:",
                error
            );

            showToast(
                "Unable to react.",
                "error"
            );
        }
    }


    /* ======================================================
       PIN MESSAGE
    ====================================================== */

    async function togglePin() {

        const message =
            state.selectedMessage;

        closeMessageMenu();

        if (!message) {
            return;
        }

        try {

            await messagesRef()
                .child(message.id)
                .update({
                    pinned:
                        !message.pinned,

                    pinnedBy:
                        !message.pinned
                            ? state.currentUser.uid
                            : null,

                    pinnedAt:
                        !message.pinned
                            ? serverTimestamp()
                            : null
                });

            showToast(
                message.pinned
                    ? "Message unpinned."
                    : "Message pinned."
            );

        } catch (error) {

            console.error(
                "Pin error:",
                error
            );

            showToast(
                "Unable to pin message.",
                "error"
            );
        }
    }


    /* ======================================================
       MESSAGE INFO
    ====================================================== */

    function openMessageInfo() {

        const message =
            state.selectedMessage;

        closeMessageMenu();

        if (!message) {
            return;
        }

        if (sentTime) {
            sentTime.textContent =
                message.createdAt
                    ? `${formatDate(
                        message.createdAt
                    )} ${formatTime(
                        message.createdAt
                    )}`
                    : "—";
        }

        if (deliveredTime) {
            deliveredTime.textContent =
                message.deliveredAt
                    ? `${formatDate(
                        message.deliveredAt
                    )} ${formatTime(
                        message.deliveredAt
                    )}`
                    : "Not delivered";
        }

        if (seenTime) {
            seenTime.textContent =
                message.seenAt
                    ? `${formatDate(
                        message.seenAt
                    )} ${formatTime(
                        message.seenAt
                    )}`
                    : "Not seen";
        }

        messageInfoModal?.classList.remove(
            "hidden"
        );
    }


    /* ======================================================
       SEARCH
    ====================================================== */

    function openSearch() {

        closeMenus();

        searchBar?.classList.remove(
            "hidden"
        );

        searchInput?.focus();
    }


    function closeSearchBar() {

        searchBar?.classList.add(
            "hidden"
        );

        if (searchInput) {
            searchInput.value = "";
        }

        state.searchTerm =
            "";

        renderMessages();
    }


    function applySearchHighlight() {

        if (!state.searchTerm) {
            return;
        }

        const term =
            state.searchTerm
                .toLowerCase();

        if (!messagesList) {
            return;
        }

        const rows =
            messagesList.querySelectorAll(
                ".messageRow"
            );

        let firstMatch =
            null;

        rows.forEach(
            row => {

                const message =
                    state.messages.get(
                        row.dataset.messageId
                    );

                if (!message) {
                    return;
                }

                const text =
                    (
                        message.text ||
                        message.caption ||
                        message.fileName ||
                        ""
                    )
                        .toLowerCase();

                const match =
                    text.includes(term);

                row.classList.toggle(
                    "searchMatch",
                    match
                );

                if (
                    match &&
                    !firstMatch
                ) {
                    firstMatch =
                        row;
                }
            }
        );

        if (firstMatch) {

            firstMatch.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }


    /* ======================================================
       TYPING
    ====================================================== */

    function setTyping(active) {

        if (!state.currentUser) {
            return;
        }

        if (
            state.typingActive ===
            active
        ) {
            return;
        }

        state.typingActive =
            active;

        typingRef(
            state.currentUser.uid
        ).set(
            active
                ? {
                    active: true,
                    updatedAt:
                        serverTimestamp()
                }
                : null
        ).catch(
            error => console.warn(
                "Typing update error:",
                error
            )
        );
    }


    function handleTyping() {

        setTyping(true);

        if (state.typingTimer) {
            clearTimeout(
                state.typingTimer
            );
        }

        state.typingTimer =
            setTimeout(
                () => {
                    setTyping(false);
                },
                TYPING_TIMEOUT
            );
    }


    function listenTyping() {

        const ref =
            typingRef(
                targetUid
            );

        const callback =
            snapshot => {

                const value =
                    snapshot.val();

                const active =
                    Boolean(
                        value &&
                        value.active
                    );

                if (typingIndicator) {
                    typingIndicator.classList.toggle(
                        "hidden",
                        !active
                    );
                }

                if (
                    active &&
                    typingText
                ) {
                    typingText.textContent =
                        `${state.otherUser.name} is typing...`;
                }
            };

        ref.on(
            "value",
            callback
        );

        state.typingListener = {
            ref,
            callback
        };
    }


    /* ======================================================
       EMOJI
    ====================================================== */

    function toggleEmojiPanel() {

        emojiPanel?.classList.toggle(
            "hidden"
        );
    }


    function insertEmoji(emoji) {

        if (!messageInput) {
            return;
        }

        const start =
            messageInput.selectionStart ??
            messageInput.value.length;

        const end =
            messageInput.selectionEnd ??
            messageInput.value.length;

        const value =
            messageInput.value;

        messageInput.value =
            value.slice(
                0,
                start
            ) +
            emoji +
            value.slice(
                end
            );

        const cursor =
            start +
            emoji.length;

        messageInput.focus();

        try {

            messageInput.setSelectionRange(
                cursor,
                cursor
            );

        } catch (_) {}

        autoResizeInput();
        handleTyping();
    }


    /* ======================================================
       ATTACHMENT SHEET
    ====================================================== */

    function openAttachmentSheet() {

        closeMenus();

        attachmentSheet?.classList.remove(
            "hidden"
        );
    }


    function closeAttachmentSheet() {

        attachmentSheet?.classList.add(
            "hidden"
        );
    }


    /* ======================================================
       FILE PICKERS
    ====================================================== */

    function openPicker(
        picker
    ) {

        if (!picker) {
            return;
        }

        closeAttachmentSheet();

        picker.value =
            "";

        picker.click();
    }


    /* ======================================================
       FILE SELECTED
    ====================================================== */

    function handleFileSelected(
        event
    ) {

        const input =
            event.target;

        const file =
            input?.files?.[0];

        if (!file) {
            return;
        }

        openMediaPreview(
            file
        );
    }


    /* ======================================================
       MEDIA PREVIEW
    ====================================================== */

    function openMediaPreview(file) {

        state.pendingMedia =
            file;

        hidePreviewElements();

        const type =
            String(
                file.type || ""
            ).toLowerCase();

        if (
            type.startsWith(
                "image/"
            )
        ) {

            const url =
                URL.createObjectURL(
                    file
                );

            previewImage.src =
                url;

            previewImage.dataset.objectUrl =
                url;

            previewImage.classList.remove(
                "hidden"
            );

        } else if (
            type.startsWith(
                "video/"
            )
        ) {

            const url =
                URL.createObjectURL(
                    file
                );

            previewVideo.src =
                url;

            previewVideo.dataset.objectUrl =
                url;

            previewVideo.classList.remove(
                "hidden"
            );

        } else if (
            type.startsWith(
                "audio/"
            )
        ) {

            const url =
                URL.createObjectURL(
                    file
                );

            previewAudio.src =
                url;

            previewAudioName.textContent =
                file.name;

            previewAudioBox.classList.remove(
                "hidden"
            );

        } else {

            previewFileName.textContent =
                file.name;

            previewFileSize.textContent =
                formatFileSize(
                    file.size
                );

            previewFileBox.classList.remove(
                "hidden"
            );
        }

        if (mediaCaption) {
            mediaCaption.value =
                "";
        }

        mediaPreviewModal?.classList.remove(
            "hidden"
        );
    }


    function hidePreviewElements() {

        [
            previewImage,
            previewVideo,
            previewAudioBox,
            previewFileBox
        ]
            .forEach(
                element => {

                    if (!element) {
                        return;
                    }

                    element.classList.add(
                        "hidden"
                    );
                }
            );

        if (previewImage) {
            previewImage.src =
                "";
        }

        if (previewVideo) {
            previewVideo.pause();

            previewVideo.src =
                "";
        }

        if (previewAudio) {
            previewAudio.pause();

            previewAudio.src =
                "";
        }
    }


    function closeMediaPreview() {

        if (
            previewImage?.dataset.objectUrl
        ) {

            URL.revokeObjectURL(
                previewImage.dataset.objectUrl
            );

            delete previewImage.dataset.objectUrl;
        }

        if (
            previewVideo?.dataset.objectUrl
        ) {

            URL.revokeObjectURL(
                previewVideo.dataset.objectUrl
            );

            delete previewVideo.dataset.objectUrl;
        }

        previewAudio?.pause();

        previewVideo?.pause();

        hidePreviewElements();

        state.pendingMedia =
            null;

        mediaPreviewModal?.classList.add(
            "hidden"
        );
    }


    /* ======================================================
       SEND MEDIA
    ====================================================== */

    async function sendPendingMedia() {

        const file =
            state.pendingMedia;

        if (!file) {
            return;
        }

        if (
            !window.VieworaMediaUpload ||
            typeof window.VieworaMediaUpload.upload !==
            "function"
        ) {

            showToast(
                "Media uploader is not loaded.",
                "error"
            );

            return;
        }

        const caption =
            String(
                mediaCaption?.value || ""
            ).trim();

        const size =
            Number(
                file.size || 0
            );

        /*
         * Basic practical limits.
         * Cloudinary itself may allow more depending
         * on the account, but this keeps chat stable.
         */

        const maxSize =
            100 * 1024 * 1024;

        if (size > maxSize) {

            showToast(
                "File is larger than 100 MB.",
                "warning"
            );

            return;
        }

        const type =
            String(
                file.type || ""
            ).toLowerCase();

        let messageType =
            "file";

        if (
            type.startsWith("image/")
        ) {
            messageType =
                "image";

        } else if (
            type.startsWith("video/")
        ) {
            messageType =
                "video";

        } else if (
            type.startsWith("audio/")
        ) {
            messageType =
                "audio";
        }

        closeMediaPreview();

        openUploadOverlay(
            file
        );

        state.uploadCancelled =
            false;

        try {

            const result =
                await window.VieworaMediaUpload
                    .upload(
                        file,
                        {
                            onProgress:
                                percent => {

                                    updateUploadProgress(
                                        percent
                                    );
                                },

                            onSpeed:
                                speed => {

                                    if (
                                        uploadSpeed
                                    ) {
                                        uploadSpeed.textContent =
                                            speed;
                                    }
                                }
                        }
                    );

            if (
                state.uploadCancelled
            ) {
                return;
            }

            if (
                !result ||
                !result.url
            ) {
                throw new Error(
                    "Cloudinary did not return a valid URL."
                );
            }

            const messageRef =
                messagesRef().push();

            const message = {

                id:
                    messageRef.key,

                senderId:
                    state.currentUser.uid,

                receiverId:
                    targetUid,

                type:
                    messageType,

                url:
                    result.url,

                secure_url:
                    result.secure_url ||
                    result.url,

                publicId:
                    result.public_id ||
                    "",

                format:
                    result.format ||
                    "",

                fileName:
                    file.name,

                fileSize:
                    file.size,

                mimeType:
                    file.type,

                caption,

                width:
                    result.width ||
                    null,

                height:
                    result.height ||
                    null,

                duration:
                    result.duration ||
                    null,

                createdAt:
                    serverTimestamp(),

                deliveredAt:
                    null,

                seenAt:
                    null,

                edited:
                    false,

                pinned:
                    false,

                deletedForEveryone:
                    false
            };

            if (state.replyTo) {

                message.replyTo =
                    {
                        ...state.replyTo
                    };
            }

            await messageRef.set(
                message
            );

            clearReply();

            hideUploadOverlay();

            showToast(
                "Media sent."
            );

            requestAnimationFrame(
                scrollToBottom
            );

        } catch (error) {

            console.error(
                "Media upload/send error:",
                error
            );

            hideUploadOverlay();

            if (
                !state.uploadCancelled
            ) {

                showToast(
                    error?.message ||
                    "Media upload failed.",
                    "error"
                );
            }
        } finally {

            state.uploadTask =
                null;
        }
    }


    /* ======================================================
       UPLOAD UI
    ====================================================== */

    function openUploadOverlay(file) {

        if (uploadOverlay) {
            uploadOverlay.classList.remove(
                "hidden"
            );
        }

        if (uploadFileName) {
            uploadFileName.textContent =
                file?.name ||
                "Preparing file...";
        }

        updateUploadProgress(
            0
        );

        if (uploadSpeed) {
            uploadSpeed.textContent =
                "—";
        }
    }


    function updateUploadProgress(
        percent
    ) {

        const value =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(percent || 0)
                )
            );

        if (uploadProgressBar) {
            uploadProgressBar.style.width =
                `${value}%`;
        }

        if (uploadPercent) {
            uploadPercent.textContent =
                `${Math.round(value)}%`;
        }
    }


    function hideUploadOverlay() {

        uploadOverlay?.classList.add(
            "hidden"
        );
    }


    function cancelUpload() {

        /*
         * Current media-upload.js returns a Promise
         * and does not expose its internal XHR task.
         *
         * So we safely mark the current operation as
         * cancelled. The upload itself cannot be aborted
         * by this version of media-upload.js.
         */

        state.uploadCancelled =
            true;

        hideUploadOverlay();

        showToast(
            "Upload cancelled.",
            "warning"
        );
    }


    /* ======================================================
       VOICE RECORDING
    ====================================================== */

    async function startRecording() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            showToast(
                "Microphone is not supported.",
                "error"
            );

            return;
        }

        if (state.recording) {
            return;
        }

        try {

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            let mimeType =
                "";

            if (
                window.MediaRecorder &&
                MediaRecorder.isTypeSupported
            ) {

                const candidates = [
                    "audio/webm;codecs=opus",
                    "audio/webm",
                    "audio/mp4"
                ];

                mimeType =
                    candidates.find(
                        type =>
                            MediaRecorder.isTypeSupported(
                                type
                            )
                    ) || "";
            }

            const recorder =
                mimeType
                    ? new MediaRecorder(
                        stream,
                        {
                            mimeType
                        }
                    )
                    : new MediaRecorder(
                        stream
                    );

            state.mediaRecorder =
                recorder;

            state.recordChunks =
                [];

            state.recording =
                true;

            state.recordStartedAt =
                Date.now();

            recorder.ondataavailable =
                event => {

                    if (
                        event.data &&
                        event.data.size > 0
                    ) {

                        state.recordChunks
                            .push(
                                event.data
                            );
                    }
                };

            recorder.onstop =
                async () => {

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    if (
                        !state.recordChunks.length
                    ) {
                        resetRecording();
                        return;
                    }

                    const blob =
                        new Blob(
                            state.recordChunks,
                            {
                                type:
                                    recorder.mimeType ||
                                    "audio/webm"
                            }
                        );

                    resetRecording();

                    const extension =
                        blob.type.includes(
                            "mp4"
                        )
                            ? "m4a"
                            : "webm";

                    const file =
                        new File(
                            [
                                blob
                            ],
                            `viewora-voice-${Date.now()}.${extension}`,
                            {
                                type:
                                    blob.type
                            }
                        );

                    openMediaPreview(
                        file
                    );
                };

            recorder.onerror =
                error => {

                    console.error(
                        "Recorder error:",
                        error
                    );

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    resetRecording();

                    showToast(
                        "Voice recording failed.",
                        "error"
                    );
                };

            recorder.start(
                250
            );

            openRecordingUI();

        } catch (error) {

            console.error(
                "Microphone error:",
                error
            );

            showToast(
                "Microphone permission is required.",
                "error"
            );
        }
    }


    function stopRecording() {

        const recorder =
            state.mediaRecorder;

        if (
            !recorder ||
            recorder.state ===
            "inactive"
        ) {
            return;
        }

        recorder.stop();
    }


    function cancelRecording() {

        const recorder =
            state.mediaRecorder;

        if (recorder) {

            try {

                if (
                    recorder.state !==
                    "inactive"
                ) {
                    recorder.ondataavailable =
                        null;

                    recorder.onstop =
                        null;

                    recorder.stop();
                }

            } catch (_) {}
        }

        resetRecording();

        showToast(
            "Recording cancelled.",
            "warning"
        );
    }


    function resetRecording() {

        state.recording =
            false;

        state.mediaRecorder =
            null;

        state.recordChunks =
            [];

        if (state.recordTimer) {

            clearInterval(
                state.recordTimer
            );

            state.recordTimer =
                null;
        }

        if (recordTime) {
            recordTime.textContent =
                "00:00";
        }

        recordOverlay?.classList.add(
            "hidden"
        );
    }


    function openRecordingUI() {

        recordOverlay?.classList.remove(
            "hidden"
        );

        updateRecordingTime();

        state.recordTimer =
            setInterval(
                updateRecordingTime,
                1000
            );
    }


    function updateRecordingTime() {

        if (
            !state.recording ||
            !recordTime
        ) {
            return;
        }

        const seconds =
            Math.floor(
                (
                    Date.now() -
                    state.recordStartedAt
                ) / 1000
            );

        const mins =
            Math.floor(
                seconds / 60
            );

        const secs =
            seconds % 60;

        recordTime.textContent =
            `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }


    /* ======================================================
       IMAGE VIEWER
    ====================================================== */

    function openImageViewer(url) {

        const safe =
            safeURL(url);

        if (!safe) {
            return;
        }

        viewerImage.src =
            safe;

        imageViewer?.classList.remove(
            "hidden"
        );
    }


    function closeImageViewer() {

        if (viewerImage) {
            viewerImage.src =
                "";
        }

        imageViewer?.classList.add(
            "hidden"
        );
    }


    /* ======================================================
       VIDEO VIEWER
    ====================================================== */

    function openVideoViewer(url) {

        const safe =
            safeURL(url);

        if (!safe) {
            return;
        }

        viewerVideo.src =
            safe;

        videoViewer?.classList.remove(
            "hidden"
        );

        viewerVideo.play()
            .catch(
                () => {}
            );
    }


    function closeVideoViewer() {

        viewerVideo?.pause();

        if (viewerVideo) {
            viewerVideo.src =
                "";
        }

        videoViewer?.classList.add(
            "hidden"
        );
    }


    /* ======================================================
       PROFILE
    ====================================================== */

    function openProfile() {

        renderHeader();

        profileModal?.classList.remove(
            "hidden"
        );
    }


    function closeProfile() {

        profileModal?.classList.add(
            "hidden"
        );
    }


    /* ======================================================
       MENU
    ====================================================== */

    function toggleChatMenu() {

        if (!chatMenu) {
            return;
        }

        chatMenu.classList.toggle(
            "hidden"
        );
    }


    function closeMenus() {

        chatMenu?.classList.add(
            "hidden"
        );

        closeMessageMenu();

        reactionBar?.classList.add(
            "hidden"
        );
    }


    /* ======================================================
       CHAT DELETE
    ====================================================== */

    async function deleteChat() {

        const confirmed =
            window.confirm(
                "Delete this chat for you?"
            );

        if (!confirmed) {
            return;
        }

        try {

            await db.ref(
                `vieworaChats/${state.chatId}/userDeleted/${state.currentUser.uid}/chat`
            ).set(
                true
            );

            showToast(
                "Chat removed for you."
            );

            setTimeout(
                () => {

                    if (
                        document.referrer
                    ) {
                        window.history.back();
                    }

                },
                700
            );

        } catch (error) {

            console.error(
                "Delete chat error:",
                error
            );

            showToast(
                "Unable to delete chat.",
                "error"
            );
        }
    }


    /* ======================================================
       MUTE
    ====================================================== */

    async function toggleMute() {

        state.muted =
            !state.muted;

        if (menuMuteBtn) {

            const span =
                menuMuteBtn.querySelector(
                    "span"
                );

            const icon =
                menuMuteBtn.querySelector(
                    "i"
                );

            if (span) {
                span.textContent =
                    state.muted
                        ? "Unmute notifications"
                        : "Mute notifications";
            }

            if (icon) {
                icon.className =
                    state.muted
                        ? "fa-solid fa-bell"
                        : "fa-solid fa-bell-slash";
            }
        }

        try {

            await db.ref(
                `vieworaChats/${state.chatId}/muted/${state.currentUser.uid}`
            ).set(
                state.muted
            );

            showToast(
                state.muted
                    ? "Notifications muted."
                    : "Notifications unmuted."
            );

        } catch (error) {

            console.warn(
                "Mute save error:",
                error
            );
        }
    }


    /* ======================================================
       SCROLL
    ====================================================== */

    function isNearBottom() {

        if (!chatContainer) {
            return true;
        }

        const distance =
            chatContainer.scrollHeight -
            chatContainer.scrollTop -
            chatContainer.clientHeight;

        return (
            distance <=
            SCROLL_THRESHOLD
        );
    }


    function scrollToBottom() {

        if (!chatContainer) {
            return;
        }

        chatContainer.scrollTo({
            top:
                chatContainer.scrollHeight,
            behavior:
                "smooth"
        });

        state.isNearBottom =
            true;

        scrollBottomBtn?.classList.add(
            "hidden"
        );

        markIncomingAsSeen();
    }


    function handleScroll() {

        state.isNearBottom =
            isNearBottom();

        if (scrollBottomBtn) {

            scrollBottomBtn.classList.toggle(
                "hidden",
                state.isNearBottom
            );
        }

        if (state.isNearBottom) {
            markIncomingAsSeen();
        }
    }


    /* ======================================================
       INPUT
    ====================================================== */

    function autoResizeInput() {

        if (!messageInput) {
            return;
        }

        messageInput.style.height =
            "auto";

        messageInput.style.height =
            `${Math.min(
                messageInput.scrollHeight,
                140
            )}px`;
    }


    function updateComposerMode() {

        if (!sendBtn) {
            return;
        }

        if (state.editingMessageId) {

            sendBtn.innerHTML =
                `<i class="fa-solid fa-check"></i>`;

            sendBtn.setAttribute(
                "aria-label",
                "Save edit"
            );

        } else {

            sendBtn.innerHTML =
                `<i class="fa-solid fa-paper-plane"></i>`;

            sendBtn.setAttribute(
                "aria-label",
                "Send message"
            );
        }
    }


    /* ======================================================
       KEYBOARD
    ====================================================== */

    function handleInputKeydown(
        event
    ) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendText();
        }
    }


    /* ======================================================
       GLOBAL CLICK
    ====================================================== */

    function handleDocumentClick(
        event
    ) {

        const target =
            event.target;

        if (
            messageMenu &&
            !messageMenu.contains(target) &&
            !target.closest(".messageBubble")
        ) {
            closeMessageMenu();
        }

        if (
            chatMenu &&
            !chatMenu.contains(target) &&
            !target.closest("#menuBtn")
        ) {
            chatMenu.classList.add(
                "hidden"
            );
        }
    }


    /* ======================================================
       EVENT BINDINGS
    ====================================================== */

    function bindEvents() {

        backBtn?.addEventListener(
            "click",
            () => {
                window.history.back();
            }
        );


        profileBtn?.addEventListener(
            "click",
            openProfile
        );


        closeProfileBtn?.addEventListener(
            "click",
            closeProfile
        );


        searchBtn?.addEventListener(
            "click",
            openSearch
        );


        closeSearch?.addEventListener(
            "click",
            closeSearchBar
        );


        menuSearchBtn?.addEventListener(
            "click",
            () => {

                chatMenu?.classList.add(
                    "hidden"
                );

                openSearch();
            }
        );


        searchInput?.addEventListener(
            "input",
            () => {

                state.searchTerm =
                    String(
                        searchInput.value ||
                        ""
                    ).trim();

                renderMessages();
            }
        );


        menuBtn?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleChatMenu();
            }
        );


        menuMuteBtn?.addEventListener(
            "click",
            toggleMute
        );


        menuDeleteChatBtn?.addEventListener(
            "click",
            deleteChat
        );


        attachBtn?.addEventListener(
            "click",
            openAttachmentSheet
        );


        attachmentOverlay?.addEventListener(
            "click",
            closeAttachmentSheet
        );


        closeAttachmentBtn?.addEventListener(
            "click",
            closeAttachmentSheet
        );


        galleryBtn?.addEventListener(
            "click",
            () => openPicker(
                imagePicker
            )
        );


        cameraAttachmentBtn?.addEventListener(
            "click",
            () => openPicker(
                cameraPicker
            )
        );


        cameraBtn?.addEventListener(
            "click",
            () => openPicker(
                cameraPicker
            )
        );


        videoBtn?.addEventListener(
            "click",
            () => openPicker(
                videoPicker
            )
        );


        audioBtn?.addEventListener(
            "click",
            () => openPicker(
                audioPicker
            )
        );


        documentBtn?.addEventListener(
            "click",
            () => openPicker(
                documentPicker
            )
        );


        imagePicker?.addEventListener(
            "change",
            handleFileSelected
        );


        videoPicker?.addEventListener(
            "change",
            handleFileSelected
        );


        audioPicker?.addEventListener(
            "change",
            handleFileSelected
        );


        documentPicker?.addEventListener(
            "change",
            handleFileSelected
        );


        cameraPicker?.addEventListener(
            "change",
            handleFileSelected
        );


        closePreviewBtn?.addEventListener(
            "click",
            closeMediaPreview
        );


        cancelMediaBtn?.addEventListener(
            "click",
            closeMediaPreview
        );


        sendMediaBtn?.addEventListener(
            "click",
            sendPendingMedia
        );


        emojiBtn?.addEventListener(
            "click",
            toggleEmojiPanel
        );


        emojiPanel?.querySelectorAll(
            ".emojiGrid span"
        ).forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        insertEmoji(
                            element.textContent
                        );
                    }
                );
            }
        );


        messageInput?.addEventListener(
            "input",
            () => {

                autoResizeInput();

                if (
                    messageInput.value.trim()
                ) {
                    handleTyping();
                } else {
                    setTyping(false);
                }
            }
        );


        messageInput?.addEventListener(
            "keydown",
            handleInputKeydown
        );


        sendBtn?.addEventListener(
            "click",
            sendText
        );


        voiceBtn?.addEventListener(
            "click",
            () => {

                if (state.recording) {
                    stopRecording();
                } else {
                    startRecording();
                }
            }
        );


        cancelRecordingBtn?.addEventListener(
            "click",
            cancelRecording
        );


        stopRecordingBtn?.addEventListener(
            "click",
            stopRecording
        );


        scrollBottomBtn?.addEventListener(
            "click",
            scrollToBottom
        );


        chatContainer?.addEventListener(
            "scroll",
            handleScroll,
            {
                passive: true
            }
        );


        closeViewerBtn?.addEventListener(
            "click",
            closeImageViewer
        );


        imageViewer?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    imageViewer
                ) {
                    closeImageViewer();
                }
            }
        );


        closeVideoViewerBtn?.addEventListener(
            "click",
            closeVideoViewer
        );


        videoViewer?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    videoViewer
                ) {
                    closeVideoViewer();
                }
            }
        );


        closeReplyPreview?.addEventListener(
            "click",
            clearReply
        );


        closeDeleteModal?.addEventListener?.(
            "click",
            closeDeleteModal
        );


        cancelDeleteBtn?.addEventListener(
            "click",
            closeDeleteModal
        );


        deleteForMeBtn?.addEventListener(
            "click",
            deleteForMe
        );


        deleteForEveryoneBtn?.addEventListener(
            "click",
            deleteForEveryone
        );


        closeInfoBtn?.addEventListener(
            "click",
            () => {
                messageInfoModal?.classList.add(
                    "hidden"
                );
            }
        );


        replyMessageBtn?.addEventListener(
            "click",
            () => {

                const message =
                    state.selectedMessage;

                closeMessageMenu();

                startReply(
                    message
                );
            }
        );


        copyMessageBtn?.addEventListener(
            "click",
            copySelectedMessage
        );


        reactMessageBtn?.addEventListener(
            "click",
            () => {

                const rect =
                    messageMenu?.getBoundingClientRect();

                closeMessageMenu();

                if (reactionBar) {

                    reactionBar.style.position =
                        "fixed";

                    if (rect) {

                        reactionBar.style.left =
                            `${Math.max(
                                10,
                                Math.min(
                                    rect.left,
                                    window.innerWidth - 310
                                )
                            )}px`;

                        reactionBar.style.top =
                            `${Math.max(
                                10,
                                rect.top - 60
                            )}px`;
                    }

                    reactionBar.classList.remove(
                        "hidden"
                    );
                }
            }
        );


        reactionBar?.querySelectorAll(
            "button"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        if (
                            state.currentMessageId
                        ) {

                            toggleReaction(
                                state.currentMessageId,
                                button.textContent.trim()
                            );
                        }

                        reactionBar.classList.add(
                            "hidden"
                        );
                    }
                );
            }
        );


        editMessageBtn?.addEventListener(
            "click",
            () => {

                const message =
                    state.selectedMessage;

                closeMessageMenu();

                startEdit(
                    message
                );
            }
        );


        pinMessageBtn?.addEventListener(
            "click",
            togglePin
        );


        infoMessageBtn?.addEventListener(
            "click",
            openMessageInfo
        );


        deleteMessageBtn?.addEventListener(
            "click",
            openDeleteModal
        );


        cancelUploadBtn?.addEventListener(
            "click",
            cancelUpload
        );


        voiceCallBtn?.addEventListener(
            "click",
            () => {

                if (
                    typeof window.VieworaStartVoiceCall ===
                    "function"
                ) {

                    window.VieworaStartVoiceCall(
                        targetUid
                    );

                } else if (
                    typeof window.startVoiceCall ===
                    "function"
                ) {

                    window.startVoiceCall(
                        targetUid
                    );

                } else {

                    showToast(
                        "Voice call module is not ready.",
                        "warning"
                    );
                }
            }
        );


        videoCallBtn?.addEventListener(
            "click",
            () => {

                if (
                    typeof window.VieworaStartVideoCall ===
                    "function"
                ) {

                    window.VieworaStartVideoCall(
                        targetUid
                    );

                } else if (
                    typeof window.startVideoCall ===
                    "function"
                ) {

                    window.startVideoCall(
                        targetUid
                    );

                } else {

                    showToast(
                        "Video call module is not ready.",
                        "warning"
                    );
                }
            }
        );


        document.addEventListener(
            "click",
            handleDocumentClick
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape"
                ) {

                    closeMessageMenu();

                    chatMenu?.classList.add(
                        "hidden"
                    );

                    reactionBar?.classList.add(
                        "hidden"
                    );
                }
            }
        );
    }


    /* ======================================================
       FIX: CLOSE DELETE MODAL
    ====================================================== */

    function bindModalBackdrops() {

        document
            .querySelectorAll(
                ".modalBackdrop"
            )
            .forEach(
                backdrop => {

                    backdrop.addEventListener(
                        "click",
                        () => {

                            const modal =
                                backdrop.closest(
                                    ".modal"
                                );

                            modal?.classList.add(
                                "hidden"
                            );
                        }
                    );
                }
            );
    }


    /* ======================================================
       LOAD MUTE STATE
    ====================================================== */

    async function loadMuteState() {

        try {

            const snapshot =
                await db.ref(
                    `vieworaChats/${state.chatId}/muted/${state.currentUser.uid}`
                ).once("value");

            state.muted =
                Boolean(
                    snapshot.val()
                );

            if (menuMuteBtn) {

                const span =
                    menuMuteBtn.querySelector(
                        "span"
                    );

                const icon =
                    menuMuteBtn.querySelector(
                        "i"
                    );

                if (span) {
                    span.textContent =
                        state.muted
                            ? "Unmute notifications"
                            : "Mute notifications";
                }

                if (icon) {
                    icon.className =
                        state.muted
                            ? "fa-solid fa-bell"
                            : "fa-solid fa-bell-slash";
                }
            }

        } catch (error) {

            console.warn(
                "Mute state error:",
                error
            );
        }
    }


    /* ======================================================
       AUTH INITIALIZATION
    ====================================================== */

    function waitForAuth() {

        return new Promise(
            resolve => {

                let finished =
                    false;

                const unsubscribe =
                    auth.onAuthStateChanged(
                        user => {

                            if (finished) {
                                return;
                            }

                            finished =
                                true;

                            try {
                                unsubscribe();
                            } catch (_) {}

                            resolve(
                                user
                            );
                        }
                    );
            }
        );
    }


    /* ======================================================
       INITIALIZE
    ====================================================== */

    async function initialize() {

        try {

            setLoadingText(
                "Checking account..."
            );

            const user =
                await waitForAuth();

            if (!user) {

                hideLoading();

                showToast(
                    "Please login to use chat.",
                    "warning"
                );

                return;
            }

            state.currentUser =
                user;

            state.chatId =
                getChatId(
                    user.uid,
                    targetUid
                );

            setLoadingText(
                "Loading conversation..."
            );

            await loadOtherUser();

            await ensureChat();

            await loadMuteState();

            setOwnPresence();

            watchPresence();

            listenMessages();

            listenTyping();

            bindEvents();

            bindModalBackdrops();

            autoResizeInput();

            updateComposerMode();

            hideLoading();

            setTimeout(
                () => {

                    scrollToBottom();

                },
                120
            );

            console.log(
                "Viewora Chat initialized.",
                {
                    chatId:
                        state.chatId,
                    user:
                        user.uid,
                    otherUser:
                        targetUid
                }
            );

        } catch (error) {

            console.error(
                "Viewora Chat initialization error:",
                error
            );

            hideLoading();

            showToast(
                error?.message ||
                "Unable to open chat.",
                "error"
            );
        }
    }


    /* ======================================================
       CLEANUP
    ====================================================== */

    function cleanup() {

        try {

            if (
                state.messagesListener
            ) {

                state.messagesListener.ref.off(
                    "value",
                    state.messagesListener.callback
                );
            }

            if (
                state.typingListener
            ) {

                state.typingListener.ref.off(
                    "value",
                    state.typingListener.callback
                );
            }

            if (
                state.presenceListener
            ) {

                state.presenceListener.ref.off(
                    "value",
                    state.presenceListener.callback
                );
            }

            if (
                state.userListener
            ) {

                state.userListener.ref.off(
                    "value",
                    state.userListener.callback
                );
            }

            if (
                state.typingTimer
            ) {

                clearTimeout(
                    state.typingTimer
                );
            }

            if (
                state.recordTimer
            ) {

                clearInterval(
                    state.recordTimer
                );
            }

            if (
                state.typingActive &&
                state.currentUser
            ) {

                typingRef(
                    state.currentUser.uid
                ).remove();
            }

        } catch (error) {

            console.warn(
                "Chat cleanup error:",
                error
            );
        }
    }


    window.addEventListener(
        "beforeunload",
        cleanup
    );


    /* ======================================================
       PUBLIC API
    ====================================================== */

    window.VieworaChat = {

        state,

        sendText,

        openSearch,

        openAttachmentSheet,

        openProfile,

        startReply,

        startEdit,

        scrollToBottom,

        showToast,

        getChatId

    };


    /* ======================================================
       START
    ====================================================== */

    initialize();

})();