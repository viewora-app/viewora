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

        toastTimer: null,

        lastMsgCount: 0,

        isSendingMessage: false,

        blockedByMe: false,

        blockedMe: false

    };

    function playMessageTone() {
        try {
            let src = "assets/message-tone.mp3";
            try {
                const s = localStorage.getItem("viewora_message_sound");
                if (s && s.indexOf("call-ringtone") === -1) src = s;
            } catch (_) {}
            if (!window.__vieworaMsgTone || window.__vieworaMsgToneSrc !== src) {
                window.__vieworaMsgTone = new Audio(src);
                window.__vieworaMsgTone.volume = 0.85;
                window.__vieworaMsgToneSrc = src;
            }
            const a = window.__vieworaMsgTone;
            a.currentTime = 0;
            a.play().catch(() => {});
        } catch (_) {}
    }




    /* ======================================================
       URL PARAMS
    ====================================================== */

    const params =
        new URLSearchParams(
            window.location.search
        );

    let targetUid =
        params.get(CHAT_PARAM) ||
        params.get("uid") ||
        params.get("userId") ||
        params.get("user") ||
        params.get("peer") ||
        params.get("id") ||
        params.get("to") ||
        "";

    // If URL passed chatId (uidA_uidB) instead of peer uid, extract other user
    try {
        const me =
            (firebase.auth().currentUser && firebase.auth().currentUser.uid) ||
            "";
        if (targetUid && targetUid.indexOf("_") !== -1 && me) {
            const parts = targetUid.split("_");
            if (parts.length === 2) {
                if (parts[0] === me) targetUid = parts[1];
                else if (parts[1] === me) targetUid = parts[0];
            }
        }
    } catch (_) {}

    /* ======================================================
       VALIDATE CHAT USER
    ====================================================== */

    if (!targetUid) {

        hideLoading();

        showToast(
            "Chat user not found. Open a chat from Messages.",
            "error"
        );

        console.warn("[VIEWORA CHAT] missing uid in URL", location.href);

        setTimeout(() => {
            try {
                if (document.referrer && document.referrer.indexOf("messages") !== -1) {
                    window.location.href = "messages.html";
                } else if (document.referrer && document.referrer !== window.location.href) {
                    window.history.back();
                } else {
                    window.location.href = "messages.html";
                }
            } catch (_) {
                window.location.href = "messages.html";
            }
        }, 1200);

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
        if (loadingOverlay) {
            loadingOverlay.classList.add("hidden");
            loadingOverlay.style.display = "none";
        }
        if (app) {
            app.classList.remove("hidden");
            app.style.opacity = "1";
            app.style.visibility = "visible";
        }
    }

    function showLoading() {
        /* disabled — open chat instantly */
        hideLoading();
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
                        user.isVerified ||
                        user.blueTick ||
                        user.redTick ||
                        user.whiteTick
                    );
                state.otherUser.blueTick = user.blueTick === true;
                state.otherUser.redTick = user.redTick === true || user.vip === true || user.elite === true;
                state.otherUser.whiteTick = user.whiteTick === true;
                state.otherUser.vip = user.vip === true;
                state.otherUser.elite = user.elite === true;
                state.otherUser.monetizationEnabled = user.monetizationEnabled === true;
                state.otherUser.subscriptionActive = user.subscriptionActive === true;
                state.otherUser.plan = user.plan || "";
                state.otherUser.followersCount = user.followersCount || user.followerCount || 0;
                state.otherUser.totalViews = user.totalViews || 0;
                state.otherUser.verificationStatus = user.verificationStatus || "";

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
            // Prefer VieworaBadges (red > blue > white)
            let badge = null;
            try {
                if (window.VieworaBadges && typeof window.VieworaBadges.resolve === "function") {
                    badge = window.VieworaBadges.resolve(user);
                }
            } catch (_) {}

            function setTickClasses() {
                verifiedBadge.classList.remove(
                    "hidden", "blueTick", "redTick", "whiteTick", "verifiedTick"
                );
            }

            if (badge && badge.level && badge.level !== "none") {
                setTickClasses();
                // className may be "blueTick verifiedTick" — split for classList
                const raw = String(badge.className || badge.level + "Tick");
                raw.split(/\s+/).filter(Boolean).forEach(function (c) {
                    verifiedBadge.classList.add(c);
                });
                verifiedBadge.innerHTML = badge.html || '<i class="fa-solid fa-circle-check"></i>';
                verifiedBadge.title = badge.title || "";
                verifiedBadge.setAttribute("aria-label", badge.title || "Verified");
            } else if (user.redTick || user.vip || user.elite) {
                setTickClasses();
                verifiedBadge.classList.add("redTick");
                verifiedBadge.innerHTML = '<i class="fa-solid fa-certificate"></i>';
                verifiedBadge.title = "VIP Elite";
            } else if (user.blueTick || user.verified || user.isVerified) {
                setTickClasses();
                verifiedBadge.classList.add("blueTick");
                verifiedBadge.classList.add("verifiedTick");
                verifiedBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
                verifiedBadge.title = "Verified";
            } else if (user.whiteTick) {
                setTickClasses();
                verifiedBadge.classList.add("whiteTick");
                verifiedBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
                verifiedBadge.title = "Monetized";
            } else {
                verifiedBadge.classList.add("hidden");
                verifiedBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            }
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

        // Seed inbox rows so chat appears in Messages list
        const myUID = state.currentUser.uid;
        const chatId = state.chatId;

        const myInboxPath =
            `userChats/${myUID}/${chatId}`;
        const otherInboxPath =
            `userChats/${targetUid}/${chatId}`;

        // Only set defaults if missing fields — do not wipe unread/lastMessage
        updates[myInboxPath + "/chatId"] = chatId;
        updates[myInboxPath + "/userId"] = targetUid;
        updates[myInboxPath + "/name"] = state.otherUser.name;
        updates[myInboxPath + "/username"] =
            String(state.otherUser.username || "").replace(/^@/, "");
        updates[myInboxPath + "/photoURL"] =
            state.otherUser.photo || DEFAULT_AVATAR;
        updates[myInboxPath + "/profilePhoto"] =
            state.otherUser.photo || DEFAULT_AVATAR;

        updates[otherInboxPath + "/chatId"] = chatId;
        updates[otherInboxPath + "/userId"] = myUID;

        await db.ref().update(updates);
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

                const prevCount = state.messages.size;
                let gotIncoming = false;

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

                            if (
                                message.senderId &&
                                message.senderId !== state.currentUser.uid
                            ) {
                                // will detect growth below
                            }
                        }
                    );

                if (state.messages.size > prevCount && prevCount > 0) {
                    // New message while chat open
                    const last = sortedMessages().slice(-1)[0];
                    if (
                        last &&
                        last.senderId !== state.currentUser.uid &&
                        !state.muted
                    ) {
                        gotIncoming = true;
                    }
                }

                renderMessages();

                markIncomingAsSeen();

                if (gotIncoming) {
                    playMessageTone();
                }
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

        const t = String(message.type || "").toLowerCase();
        if (
            t === "post" ||
            t === "post_share" ||
            t === "shared_post"
        ) return "post_share";
        if (
            t === "short" ||
            t === "short_share" ||
            t === "shorts_share"
        ) return "short_share";
        if (
            t === "video_share" ||
            t === "long_video" ||
            (t === "video" && (message.contentId || message.videoId || message.postId))
        ) {
            // uploaded video file keeps type video + url; shared feed video has contentId
            if (message.contentId || message.videoId || message.shareUrl) {
                if (t === "video" && message.url && !message.contentId && !message.videoId) {
                    /* native video file */
                } else {
                    return "video_share";
                }
            }
        }
        if (
            t === "story" ||
            t === "story_share"
        ) return "story_share";
        if (
            t === "profile" ||
            t === "profile_share"
        ) return "profile_share";

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
                        <i class="fa-solid fa-microphone"></i>
                    </div>
                    <div class="audioContent">
                        <strong class="audioLabel">Voice message</strong>
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


        } else if (
            kind === "post_share" ||
            kind === "short_share" ||
            kind === "video_share" ||
            kind === "story_share" ||
            kind === "profile_share"
        ) {
            const shareType =
                kind === "post_share"
                    ? "post"
                    : kind === "short_share"
                    ? "short"
                    : kind === "story_share"
                    ? "story"
                    : kind === "profile_share"
                    ? "profile"
                    : "video";
            const contentId =
                message.contentId ||
                message.postId ||
                message.shortId ||
                message.videoId ||
                message.storyId ||
                message.profileUid ||
                message.id ||
                "";
            const thumb =
                message.thumb ||
                message.thumbnail ||
                message.imageUrl ||
                message.mediaUrl ||
                message.cover ||
                "";
            const title =
                message.title ||
                message.caption ||
                message.text ||
                (shareType === "post"
                    ? "Post"
                    : shareType === "short"
                    ? "Short"
                    : shareType === "story"
                    ? "Story"
                    : "Video");
            const author =
                message.authorName ||
                message.username ||
                message.ownerName ||
                "";
            const badge =
                shareType === "post"
                    ? "Post"
                    : shareType === "short"
                    ? "Short"
                    : shareType === "story"
                    ? "Story"
                    : shareType === "profile"
                    ? "Profile"
                    : "Video";
            const thumbClass =
                shareType === "short" || shareType === "video"
                    ? "shareCardThumb videoish"
                    : "shareCardThumb";
            const openHref =
                shareType === "post"
                    ? "post.html?id=" + encodeURIComponent(contentId)
                    : shareType === "short"
                    ? "shorts.html?id=" + encodeURIComponent(contentId)
                    : shareType === "story"
                    ? "stories.html?uid=" +
                      encodeURIComponent(
                          message.ownerId || message.uid || ""
                      ) +
                      "&storyId=" +
                      encodeURIComponent(contentId)
                    : shareType === "profile"
                    ? "profile.html?uid=" + encodeURIComponent(contentId)
                    : "video.html?id=" + encodeURIComponent(contentId);

            if (shareType === "profile") {
                const pName =
                    message.authorName ||
                    message.displayName ||
                    message.name ||
                    message.username ||
                    message.title ||
                    "User";
                const pUser =
                    message.username
                        ? (String(message.username).startsWith("@")
                            ? message.username
                            : "@" + message.username)
                        : "";
                const pPhoto =
                    message.thumb ||
                    message.thumbnail ||
                    message.photoURL ||
                    message.profilePhoto ||
                    message.avatar ||
                    message.imageUrl ||
                    "";
                content = `
                <button
                    type="button"
                    class="shareCard profileShareCard"
                    data-action="open-share"
                    data-share-type="profile"
                    data-content-id="${escapeHTML(contentId)}"
                    data-href="${escapeHTML(openHref)}"
                >
                    <div class="profileShareInner">
                        <div class="profileShareAvatar">
                            ${
                                pPhoto
                                    ? `<img src="${escapeHTML(safeURL(pPhoto))}" alt="" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='grid')">
                                       <span class="profileShareFallback" style="display:none">👤</span>`
                                    : `<span class="profileShareFallback">👤</span>`
                            }
                        </div>
                        <div class="profileShareMeta">
                            <strong>${escapeHTML(pName)}</strong>
                            <span>${escapeHTML(pUser || "View profile")}</span>
                        </div>
                        <i class="fa-solid fa-chevron-right profileShareChev"></i>
                    </div>
                </button>
                `;
            } else {
            content = `
                <button
                    type="button"
                    class="shareCard"
                    data-action="open-share"
                    data-share-type="${shareType}"
                    data-content-id="${escapeHTML(contentId)}"
                    data-href="${escapeHTML(openHref)}"
                >
                    <div class="shareCardMedia">
                        <span class="messageBadge">${badge}</span>
                        ${
                            thumb
                                ? `<img class="${thumbClass}" src="${escapeHTML(
                                      safeURL(thumb)
                                  )}" alt="" loading="lazy"
                                    onerror="this.onerror=null;this.style.display='none';var p=this.parentNode;if(p&&!p.querySelector('.shareFallback')){var f=document.createElement('div');f.className='shareFallback';f.style.cssText='aspect-ratio:9/16;min-height:160px;display:flex;align-items:center;justify-content:center;background:#1a1b22;color:#fff;font-size:28px';f.innerHTML='<i class=\'fa-solid fa-play\'></i>';p.appendChild(f);}">`
                                : `<div class="${thumbClass}" style="display:flex;align-items:center;justify-content:center;background:#222">
                                    <i class="fa-solid fa-${
                                        shareType === "story"
                                            ? "circle-notch"
                                            : shareType === "post"
                                            ? "image"
                                            : "play"
                                    }" style="font-size:28px;opacity:.5"></i>
                                   </div>`
                        }
                    </div>
                    <div class="shareCardBody">
                        <strong>${escapeHTML(
                            String(title).slice(0, 80)
                        )}</strong>
                        ${
                            author
                                ? `<span>@${escapeHTML(
                                      String(author).replace(/^@/, "")
                                  )}</span>`
                                : ""
                        }
                        <div class="shareCardFooter">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            Open ${badge}
                        </div>
                    </div>
                </button>
            `;
            }

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

        // One-tap open shared post / short / video / profile
        messagesList
            .querySelectorAll("[data-action='open-share']")
            .forEach(function (el) {
                if (el.__shareBound) return;
                el.__shareBound = true;
                el.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const href = el.getAttribute("data-href") || "";
                    const type = el.getAttribute("data-share-type") || "";
                    const id = el.getAttribute("data-content-id") || "";
                    if (href) {
                        window.location.href = href;
                        return;
                    }
                    if (type === "short" && id) {
                        window.location.href = "shorts.html?id=" + encodeURIComponent(id);
                    } else if (type === "video" && id) {
                        window.location.href = "video.html?id=" + encodeURIComponent(id);
                    } else if (type === "post" && id) {
                        window.location.href = "post.html?id=" + encodeURIComponent(id);
                    } else if (type === "profile" && id) {
                        window.location.href = "profile.html?uid=" + encodeURIComponent(id);
                    }
                });
            });

        messagesList
            .querySelectorAll(
                ".messageBubble"
            )
            .forEach(
                element => {

                    // Double-tap / double-click → ❤️ like
                    if (!element.__likeTapBound) {
                        element.__likeTapBound = true;
                        var lastTap = 0;
                        function heartMsg(e) {
                            if (e) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                            const id = element.dataset.messageId;
                            if (id) toggleReaction(id, "❤️");
                        }
                        element.addEventListener("dblclick", heartMsg);
                        element.addEventListener("click", function (e) {
                            // ignore share card clicks (they navigate)
                            if (e.target.closest("[data-action='open-share']")) return;
                            if (e.target.closest("a, button, audio, video, input")) return;
                            var now = Date.now();
                            if (now - lastTap < 320) {
                                lastTap = 0;
                                heartMsg(e);
                            } else {
                                lastTap = now;
                            }
                        });
                    }

                    // Swipe left → reply
                    if (!element.__swipeBound) {
                        element.__swipeBound = true;
                        var sx = 0, sy = 0, tracking = false;
                        element.addEventListener("touchstart", function (e) {
                            if (!e.touches || !e.touches[0]) return;
                            sx = e.touches[0].clientX;
                            sy = e.touches[0].clientY;
                            tracking = true;
                            element.style.transition = "none";
                        }, { passive: true });
                        element.addEventListener("touchmove", function (e) {
                            if (!tracking || !e.touches || !e.touches[0]) return;
                            var dx = e.touches[0].clientX - sx;
                            var dy = e.touches[0].clientY - sy;
                            if (Math.abs(dy) > Math.abs(dx)) return; // vertical scroll
                            // only swipe left (negative dx)
                            if (dx < 0 && dx > -90) {
                                element.style.transform = "translateX(" + dx + "px)";
                            }
                        }, { passive: true });
                        element.addEventListener("touchend", function (e) {
                            if (!tracking) return;
                            tracking = false;
                            element.style.transition = "transform .2s ease";
                            var dx = 0;
                            try {
                                var t = e.changedTouches && e.changedTouches[0];
                                if (t) dx = t.clientX - sx;
                            } catch (_) {}
                            element.style.transform = "";
                            // swipe left far enough → reply
                            if (dx < -56) {
                                const id = element.dataset.messageId;
                                const msg = state.messages && state.messages.get
                                    ? state.messages.get(id)
                                    : null;
                                if (msg) startReply(msg);
                            }
                        }, { passive: true });
                    }

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

    /* ======================================================
       INBOX SYNC (userChats) — last message + unread
       Keeps messages.js list updated
    ====================================================== */

    function previewFromMessage(message) {
        if (!message) return "New message";

        if (message.deletedForEveryone) {
            return "Message deleted";
        }

        const type = String(message.type || "text").toLowerCase();

        if (type === "image") return "📷 Photo";
        if (type === "video") return "🎬 Video";
        if (type === "audio") return "🎵 Voice message";
        if (type === "file" || type === "document") {
            return "📎 " + (message.fileName || "File");
        }
        if (type === "post" || type === "post_share" || type === "shared_post") return "Shared a post";
        if (type === "short" || type === "short_share" || type === "shorts_share") return "Shared a short";
        if (type === "video_share" || type === "long_video") return "Shared a video";
        if (type === "story" || type === "story_share") return "Shared a story";
        if (type === "profile" || type === "profile_share") return "Shared a profile";

        const text = String(message.text || message.caption || "").trim();
        if (text) {
            return text.length > 80 ? text.slice(0, 80) + "…" : text;
        }

        return "New message";
    }

    async function syncInboxAfterSend(message) {
        if (!state.currentUser || !targetUid || !state.chatId) {
            return;
        }

        const myUID = state.currentUser.uid;
        const otherUID = targetUid;
        const chatId = state.chatId;
        const preview = previewFromMessage(message);
        const now = serverTimestamp();

        // Current user profile for the other person's inbox entry
        let myName =
            state.currentUser.displayName ||
            "Viewora User";
        let myPhoto = DEFAULT_AVATAR;
        let myUsername = "";

        try {
            const meSnap = await db.ref("users/" + myUID).once("value");
            if (meSnap.exists()) {
                const me = meSnap.val() || {};
                myName =
                    me.name ||
                    me.fullName ||
                    me.displayName ||
                    me.username ||
                    myName;
                myUsername = me.username || "";
                myPhoto =
                    me.profilePhoto ||
                    me.photoURL ||
                    me.avatar ||
                    myPhoto;
            }
        } catch (e) {}

        const otherName = state.otherUser.name || "Viewora User";
        const otherPhoto = state.otherUser.photo || DEFAULT_AVATAR;
        const otherUsername = String(state.otherUser.username || "").replace(/^@/, "");

        const myInbox = {
            chatId,
            userId: otherUID,
            name: otherName,
            username: otherUsername,
            photoURL: otherPhoto,
            profilePhoto: otherPhoto,
            lastMessage: preview,
            lastMessageTime: now,
            lastSenderId: myUID,
            // sender clears own unread
            unread: 0,
            online: Boolean(state.otherUser.online)
        };

        const otherInbox = {
            chatId,
            userId: myUID,
            name: myName,
            username: myUsername,
            photoURL: myPhoto,
            profilePhoto: myPhoto,
            lastMessage: preview,
            lastMessageTime: now,
            lastSenderId: myUID
        };

        try {
            // Request if they don't follow me and haven't accepted
            try {
                const fol = await db.ref("following/" + otherUID + "/" + myUID).once("value");
                const theyFollow = fol.exists();
                if (!theyFollow) {
                    otherInbox.request = true;
                    otherInbox.accepted = false;
                } else {
                    otherInbox.request = false;
                    otherInbox.accepted = true;
                }
            } catch (_) {}

            // Update my inbox entry
            await db.ref("userChats/" + myUID + "/" + chatId).update(myInbox);

            // Update other user's inbox + increment unread
            const otherRef = db.ref("userChats/" + otherUID + "/" + chatId);
            const otherSnap = await otherRef.once("value");
            let unread = 1;
            if (otherSnap.exists()) {
                const prev = otherSnap.val() || {};
                unread = Number(prev.unread || 0) + 1;
            }
            otherInbox.unread = unread;
            otherInbox.unreadCount = unread;
            otherInbox.unreadMessages = unread;
            otherInbox.unread_count = unread;
            // clear read flags so home badge counts this chat again
            otherInbox.read = false;
            otherInbox.seen = false;
            otherInbox.isRead = false;
            otherInbox.updatedAt = now;
            otherInbox.peerId = myUID;

            await otherRef.update(otherInbox);

            // Single canonical key only: sorted uidA_uidB (no dual key = no duplicate rows)

            // Also keep chat meta updated
            await db.ref("vieworaChats/" + chatId).update({
                updatedAt: now,
                lastMessage: preview,
                lastMessageTime: now,
                lastSenderId: myUID
            });
        } catch (err) {
            console.warn("Inbox sync failed:", err);
        }
    }

    async function clearMyUnread() {
        if (!state.currentUser || !state.chatId) return;
        const myUID = state.currentUser.uid;
        const chatId = state.chatId;
        const otherUID =
            state.otherUser?.uid ||
            state.otherUserId ||
            state.peerUid ||
            "";
        const patch = {
            unread: 0,
            unreadCount: 0,
            unreadMessages: 0,
            unread_count: 0,
            read: true,
            seen: true,
            isRead: true,
            lastReadAt: Date.now()
        };
        try {
            await db.ref("userChats/" + myUID + "/" + chatId).update(patch);
        } catch (e) {
            console.warn("Clear unread chatId path:", e);
        }
        // Legacy / alternate inbox key = peer uid
        if (otherUID && otherUID !== chatId) {
            try {
                // legacy bare key cleared via clearMyUnread multi-path
            } catch (_) {}
        }
        // Also zero any duplicate keys that point to same chatId
        try {
            const snap = await db.ref("userChats/" + myUID).once("value");
            const updates = {};
            snap.forEach(function (ch) {
                const v = ch.val() || {};
                const key = ch.key;
                if (
                    key === chatId ||
                    key === otherUID ||
                    v.chatId === chatId ||
                    (otherUID && v.userId === otherUID)
                ) {
                    if (Number(v.unread || v.unreadCount || 0) > 0) {
                        updates[key + "/unread"] = 0;
                        updates[key + "/unreadCount"] = 0;
                        updates[key + "/unreadMessages"] = 0;
                        updates[key + "/unread_count"] = 0;
                        updates[key + "/read"] = true;
                        updates[key + "/seen"] = true;
                    }
                }
            });
            if (Object.keys(updates).length) {
                await db.ref("userChats/" + myUID).update(updates);
            }
        } catch (_) {}
    }

    async function sendText() {
        if (state.isSendingMessage) {
            return; // one message at a time
        }
        if (state.blockedByMe || state.blockedMe) {
            showToast("You cannot message this user.", "error");
            return;
        }


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

        state.isSendingMessage = true;
        if (sendBtn) sendBtn.disabled = true;

        // clear input immediately so double-tap can't resend same text
        const pendingText = text;
        if (messageInput) messageInput.value = "";
        autoResizeInput();

        try {

            await messageRef.set(
                message
            );

            // Update both users' inbox list
            await syncInboxAfterSend(message);

            clearReply();

            setTyping(false);

            updateComposerMode();

            requestAnimationFrame(
                scrollToBottom
            );

        } catch (error) {

            // restore text on failure
            if (messageInput && !messageInput.value) {
                messageInput.value = pendingText;
                autoResizeInput();
            }
            console.error(
                "Send message error:",
                error
            );

            showToast(
                "Message could not be sent.",
                "error"
            );
        } finally {
            state.isSendingMessage = false;
            if (sendBtn) sendBtn.disabled = false;
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

            // Clear inbox unread when messages are seen / opened
            await clearMyUnread();

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
                    deletedForEveryone: true,
                    deletedAt: serverTimestamp(),
                    text: "",
                    caption: "",
                    url: null,
                    mediaUrl: null,
                    imageUrl: null
                });

            // Refresh inbox preview so Messages list is not stuck on old text
            try {
                await refreshInboxAfterDelete(message.id);
            } catch (inboxErr) {
                console.warn("inbox after delete", inboxErr);
            }

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

    async function refreshInboxAfterDelete(deletedId) {
        if (!state.currentUser || !state.chatId) return;
        const myUID = state.currentUser.uid;
        const otherUID =
            state.otherUser?.uid ||
            state.otherUserId ||
            state.peerUid ||
            "";
        const chatId = state.chatId;

        // Find latest non-deleted message for preview
        let preview = "Message deleted";
        let lastTime = Date.now();
        let lastSender = myUID;
        try {
            const snap = await messagesRef().orderByChild("createdAt").limitToLast(40).once("value");
            const list = [];
            if (snap.exists()) {
                snap.forEach(function (c) {
                    const m = c.val() || {};
                    m.id = c.key;
                    list.push(m);
                });
            }
            list.sort(function (a, b) {
                return Number(a.createdAt || 0) - Number(b.createdAt || 0);
            });
            for (let i = list.length - 1; i >= 0; i--) {
                const m = list[i];
                if (m.deletedForEveryone) continue;
                if (m.id === deletedId) continue;
                lastTime = Number(m.createdAt || m.timestamp || Date.now());
                lastSender = m.senderId || myUID;
                if (m.type === "image" || m.imageUrl || m.mediaUrl) {
                    preview = "Photo";
                } else if (m.type === "video") {
                    preview = "Video";
                } else if (m.type === "audio" || m.type === "voice") {
                    preview = "Voice message";
                } else if (m.type === "short" || m.shareType === "short") {
                    preview = "Shared a short";
                } else if (m.type === "post" || m.shareType === "post") {
                    preview = "Shared a post";
                } else if (m.text) {
                    preview = String(m.text).slice(0, 80);
                } else {
                    preview = "Message";
                }
                break;
            }
            // if all deleted
            if (list.length && list.every(function (m) { return m.deletedForEveryone || m.id === deletedId; })) {
                preview = "Message deleted";
            }
        } catch (_) {}

        const patch = {
            lastMessage: preview,
            lastMessageTime: lastTime,
            lastSenderId: lastSender,
            updatedAt: Date.now()
        };

        try {
            await db.ref("userChats/" + myUID + "/" + chatId).update(patch);
        } catch (_) {}
        if (otherUID) {
            try {
                await db.ref("userChats/" + otherUID + "/" + chatId).update(patch);
            } catch (_) {}
        }
        try {
            await db.ref("vieworaChats/" + chatId).update({
                lastMessage: preview,
                lastMessageTime: lastTime,
                lastSenderId: lastSender,
                updatedAt: Date.now()
            });
        } catch (_) {}
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

        state.uploadCancelled = false;

        // Optimistic bubble — no full-screen upload modal / no .jpg text
        const localPreviewUrl = URL.createObjectURL(file);
        const tempId = "local_" + Date.now();
        const optimistic = {
            id: tempId,
            senderId: state.currentUser.uid,
            receiverId: targetUid,
            type: messageType,
            url: localPreviewUrl,
            secure_url: localPreviewUrl,
            caption: caption || "",
            fileName: "",
            fileSize: file.size,
            mimeType: file.type,
            createdAt: Date.now(),
            uploading: true,
            local: true
        };
        try {
            if (state.messages && typeof state.messages.set === "function") {
                state.messages.set(tempId, optimistic);
            } else if (state.messages instanceof Map) {
                state.messages.set(tempId, optimistic);
            } else if (state.messages) {
                state.messages[tempId] = optimistic;
            }
            if (typeof renderMessages === "function") renderMessages();
            requestAnimationFrame(scrollToBottom);
        } catch (_) {}

        showInlineUploadProgress(0);

        try {
            const result = await window.VieworaMediaUpload.upload(file, {
                onProgress: function (percent) {
                    showInlineUploadProgress(percent);
                }
            });

            if (state.uploadCancelled) {
                removeOptimistic(tempId);
                hideInlineUploadProgress();
                try { URL.revokeObjectURL(localPreviewUrl); } catch (_) {}
                return;
            }

            if (!result || !(result.url || result.secure_url)) {
                throw new Error("Upload failed. Try again.");
            }

            const messageRef = messagesRef().push();
            const message = {
                id: messageRef.key,
                senderId: state.currentUser.uid,
                receiverId: targetUid,
                type: messageType,
                url: result.url || result.secure_url,
                secure_url: result.secure_url || result.url,
                publicId: result.public_id || "",
                format: result.format || "",
                fileName: "",
                fileSize: file.size || 0,
                mimeType: file.type || "",
                caption: caption || "",
                width: result.width || null,
                height: result.height || null,
                duration: result.duration || null,
                createdAt: serverTimestamp(),
                deliveredAt: null,
                seenAt: null,
                edited: false,
                pinned: false,
                deletedForEveryone: false
            };

            if (state.replyTo) {
                message.replyTo = { ...state.replyTo };
            }

            await messageRef.set(message);
            try { await syncInboxAfterSend(message); } catch (_) {}
            try { clearReply(); } catch (_) {}

            removeOptimistic(tempId);
            try { URL.revokeObjectURL(localPreviewUrl); } catch (_) {}
            hideInlineUploadProgress();
            requestAnimationFrame(scrollToBottom);

        } catch (error) {
            console.error("Media upload/send error:", error);
            removeOptimistic(tempId);
            hideInlineUploadProgress();
            try { URL.revokeObjectURL(localPreviewUrl); } catch (_) {}
            if (!state.uploadCancelled) {
                showToast(error?.message || "Could not send media.", "error");
            }
        }
    }



    function showInlineUploadProgress(percent) {
        let bar = document.getElementById("chatInlineUpload");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "chatInlineUpload";
            bar.className = "chatInlineUpload";
            bar.innerHTML = '<div class="chatInlineUploadFill"></div>';
            const host = document.querySelector(".composer") || document.querySelector(".chatComposer") || document.body;
            host.appendChild(bar);
        }
        bar.classList.remove("hidden");
        const fill = bar.querySelector(".chatInlineUploadFill");
        if (fill) fill.style.width = Math.max(2, Math.min(100, Number(percent) || 0)) + "%";
        try { hideUploadOverlay(); } catch (_) {}
    }

    function hideInlineUploadProgress() {
        const bar = document.getElementById("chatInlineUpload");
        if (bar) bar.classList.add("hidden");
        try { hideUploadOverlay(); } catch (_) {}
    }

    function removeOptimistic(tempId) {
        try {
            if (state.messages && typeof state.messages.delete === "function") {
                state.messages.delete(tempId);
            } else if (state.messages) {
                delete state.messages[tempId];
            }
            document.querySelector('[data-message-id="' + tempId + '"]')?.remove();
            document.querySelector('[data-id="' + tempId + '"]')?.remove();
            if (typeof renderMessages === "function") renderMessages();
        } catch (_) {}
    }


    /* ======================================================
       UPLOAD UI
    ====================================================== */

    function openUploadOverlay(file) {
        // Full-screen upload modal disabled — use inline progress only
        try { hideUploadOverlay(); } catch (_) {}
        return;
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

        document.getElementById("menuBlockBtn")?.addEventListener(
            "click",
            () => toggleBlockUser()
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


        /* voiceCallBtn bound below */


        /* videoCallBtn bound below */



        function openCall(type) {
            if (state.blockedByMe || state.blockedMe) {
                showToast("Cannot call blocked user.", "error");
                return;
            }
            const uid = String(
                targetUid ||
                state.otherUser.uid ||
                state.otherUser.userId ||
                ""
            ).trim();
            if (!uid) {
                showToast("User ID missing. Open chat from Messages again.", "error");
                return;
            }
            const t = type === "video" ? "video" : "audio";
            const name = encodeURIComponent(state.otherUser.name || "User");
            const photo = encodeURIComponent(state.otherUser.photo || "");
            // ALWAYS direct navigate — do not depend on call.js on this page
            const url =
                "call.html?role=caller" +
                "&type=" + encodeURIComponent(t) +
                "&receiverId=" + encodeURIComponent(uid) +
                "&uid=" + encodeURIComponent(uid) +
                "&name=" + name +
                "&photo=" + photo;
            console.log("[VIEWORA CALL] opening", url);
            window.location.assign(url);
        }

        function bindCallButtons() {
            const vBtn = document.getElementById("voiceCallBtn");
            const vidBtn = document.getElementById("videoCallBtn");
            if (vBtn && !vBtn.__vieworaCallBound) {
                vBtn.__vieworaCallBound = true;
                vBtn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    openCall("audio");
                });
            }
            if (vidBtn && !vidBtn.__vieworaCallBound) {
                vidBtn.__vieworaCallBound = true;
                vidBtn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    openCall("video");
                });
            }
        }
        bindCallButtons();
        // Extra: event delegation in case buttons re-render
        document.addEventListener("click", function (e) {
            const v = e.target.closest("#voiceCallBtn, .voiceCallBtn, [data-call=audio]");
            const vid = e.target.closest("#videoCallBtn, .videoCallBtn, [data-call=video]");
            if (v) {
                e.preventDefault();
                openCall("audio");
            } else if (vid) {
                e.preventDefault();
                openCall("video");
            }
        }, true);

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

    
    async function loadBlockState() {
        if (!state.currentUser || !targetUid) return;
        try {
            const me = state.currentUser.uid;
            const [a, b] = await Promise.all([
                db.ref("blocks/" + me + "/" + targetUid).once("value"),
                db.ref("blocks/" + targetUid + "/" + me).once("value")
            ]);
            state.blockedByMe = a.exists() && a.val() !== null && a.val() !== false;
            state.blockedMe = b.exists() && b.val() !== null && b.val() !== false;
            applyBlockUI();
        } catch (e) {
            console.warn("block state", e);
        }
    }

    function applyBlockUI() {
        const blocked = state.blockedByMe || state.blockedMe;
        const composer = document.querySelector(".composer");
        const bannerId = "blockBanner";
        let banner = document.getElementById(bannerId);

        if (blocked) {
            if (!banner && chatContainer) {
                banner = document.createElement("div");
                banner.id = bannerId;
                banner.className = "blockBanner";
                banner.innerHTML =
                    state.blockedByMe
                        ? '<span>You blocked this user.</span><button type="button" id="unblockChatBtn">Unblock</button>'
                        : '<span>You cannot message this user.</span>';
                const parent = document.querySelector(".app") || document.body;
                const composerEl = document.querySelector(".composer");
                if (composerEl && composerEl.parentNode) {
                    composerEl.parentNode.insertBefore(banner, composerEl);
                } else {
                    parent.appendChild(banner);
                }
                document.getElementById("unblockChatBtn")?.addEventListener("click", () => {
                    toggleBlockUser(false);
                });
            }
            if (composer) {
                composer.style.opacity = "0.45";
                composer.style.pointerEvents = "none";
            }
            voiceCallBtn && (voiceCallBtn.disabled = true);
            videoCallBtn && (videoCallBtn.disabled = true);
            voiceCallBtn?.classList.add("disabled");
            videoCallBtn?.classList.add("disabled");
        } else {
            banner?.remove();
            if (composer) {
                composer.style.opacity = "";
                composer.style.pointerEvents = "";
            }
            voiceCallBtn && (voiceCallBtn.disabled = false);
            videoCallBtn && (videoCallBtn.disabled = false);
            voiceCallBtn?.classList.remove("disabled");
            videoCallBtn?.classList.remove("disabled");
        }

        // Menu label
        const blockMenu = document.getElementById("menuBlockBtn");
        if (blockMenu) {
            const span = blockMenu.querySelector("span");
            if (span) span.textContent = state.blockedByMe ? "Unblock user" : "Block user";
            const icon = blockMenu.querySelector("i");
            if (icon) icon.className = state.blockedByMe ? "fa-solid fa-user-check" : "fa-solid fa-ban";
        }
    }

    async function toggleBlockUser(forceBlock) {
        if (!state.currentUser || !targetUid) return;
        const me = state.currentUser.uid;
        const shouldBlock =
            typeof forceBlock === "boolean" ? forceBlock : !state.blockedByMe;

        if (shouldBlock) {
            const ok = window.confirm(
                "Block " + (state.otherUser.name || "this user") + "? They won't be able to message or call you."
            );
            if (!ok) return;
        }

        try {
            if (shouldBlock) {
                await db.ref("blocks/" + me + "/" + targetUid).set({
                    blockedAt: serverTimestamp(),
                    userId: targetUid,
                    name: state.otherUser.name || "User"
                });
                // mark inbox
                try {
                    await db.ref(
                        "userChats/" + me + "/" + state.chatId
                    ).update({ blocked: true });
                } catch (_) {}
                state.blockedByMe = true;
                showToast("User blocked", "success");
            } else {
                await db.ref("blocks/" + me + "/" + targetUid).remove();
                try {
                    await db.ref(
                        "userChats/" + me + "/" + state.chatId
                    ).update({ blocked: false });
                } catch (_) {}
                state.blockedByMe = false;
                showToast("User unblocked", "success");
            }
            applyBlockUI();
            closeMenus();
        } catch (e) {
            console.error(e);
            showToast("Could not update block", "error");
        }
    }


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

            // Instant open — no blocking loader
            hideLoading();

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

            await loadOtherUser();

            await ensureChat();

            await loadMuteState();

            await loadBlockState();

            setOwnPresence();

            watchPresence();

            listenMessages();

            listenTyping();

            bindEvents();

            bindModalBackdrops();

            autoResizeInput();

            updateComposerMode();

            // Opening chat → clear unread badge (force)
            clearMyUnread();
            setTimeout(clearMyUnread, 400);
            setTimeout(clearMyUnread, 1500);
            document.addEventListener("visibilitychange", function () {
                if (document.visibilityState === "visible") clearMyUnread();
            });

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

/* ======================================================
   SHARE POST / SHORT / VIDEO / STORY IN CHAT
====================================================== */
(function () {
  let shareKind = "post";
  let shareTab = "mine";

  function closePicker() {
    const el = document.getElementById("contentShareSheet");
    if (el) {
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
    }
  }

  function openPicker(kind) {
    shareKind = kind || "post";
    shareTab = "mine";
    const el = document.getElementById("contentShareSheet");
    const title = document.getElementById("contentShareTitle");
    if (title) {
      title.textContent =
        shareKind === "post"
          ? "Share a post"
          : shareKind === "short"
          ? "Share a short"
          : shareKind === "story"
          ? "Share a story"
          : "Share a video";
    }
    if (el) {
      el.classList.remove("hidden");
      el.setAttribute("aria-hidden", "false");
    }
    // close attachment sheet
    try {
      document.getElementById("attachmentSheet")?.classList.add("hidden");
    } catch (_) {}
    document.querySelectorAll(".contentShareTab").forEach((t) => {
      t.classList.toggle("active", t.getAttribute("data-cs-tab") === shareTab);
    });
    loadContentItems();
  }

  async function loadContentItems() {
    const list = document.getElementById("contentShareList");
    if (!list) return;
    list.innerHTML = '<div class="contentShareLoading">Loading…</div>';
    const me =
      (window.state && state.currentUser && state.currentUser.uid) ||
      (firebase.auth().currentUser && firebase.auth().currentUser.uid);
    if (!me) {
      list.innerHTML = '<div class="contentShareEmpty">Login required</div>';
      return;
    }
    const root =
      shareKind === "post"
        ? "posts"
        : shareKind === "short"
        ? "shorts"
        : shareKind === "story"
        ? "stories"
        : "videos";
    const items = [];
    try {
      const snap = await firebase.database().ref(root).limitToLast(80).once("value");
      const val = snap.val() || {};
      let following = {};
      if (shareTab === "following") {
        try {
          const fs = await firebase
            .database()
            .ref("following/" + me)
            .once("value");
          following = fs.val() || {};
        } catch (_) {}
      }
      Object.keys(val).forEach((id) => {
        const d = val[id] || {};
        if (d.deleted === true) return;
        const owner = String(
          d.uid || d.userId || d.ownerId || d.authorId || ""
        );
        if (shareTab === "mine" && owner !== String(me)) return;
        if (
          shareTab === "following" &&
          owner === String(me) &&
          !following[owner]
        ) {
          // following tab: others I follow
        }
        if (shareTab === "following") {
          if (owner === String(me)) return;
          if (!(following[owner] === true || following[owner])) return;
        }
        // stories: only recent 24h
        if (shareKind === "story") {
          const created = Number(d.createdAt || d.timestamp || 0);
          if (created && Date.now() - created > 24 * 3600 * 1000) return;
        }
        const thumb =
          d.thumbnail ||
          d.thumb ||
          d.cover ||
          d.imageUrl ||
          (Array.isArray(d.mediaUrls) && d.mediaUrls[0]) ||
          d.mediaUrl ||
          d.videoUrl ||
          d.url ||
          "";
        items.push({
          id,
          owner,
          thumb,
          title:
            d.caption ||
            d.title ||
            d.text ||
            (shareKind === "story" ? "Story" : shareKind),
          username: d.username || d.userName || d.authorName || "",
          createdAt: Number(d.createdAt || d.timestamp || 0)
        });
      });
      items.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.error(e);
      list.innerHTML =
        '<div class="contentShareEmpty">Could not load content</div>';
      return;
    }
    if (!items.length) {
      list.innerHTML =
        '<div class="contentShareEmpty">No ' +
        shareKind +
        "s found</div>";
      return;
    }
    list.innerHTML = items
      .slice(0, 48)
      .map((it) => {
        return (
          '<button type="button" class="contentShareItem" data-id="' +
          it.id +
          '" data-owner="' +
          it.owner +
          '" data-thumb="' +
          (it.thumb || "").replace(/"/g, "") +
          '" data-title="' +
          String(it.title || "")
            .replace(/"/g, "&quot;")
            .slice(0, 80) +
          '" data-user="' +
          String(it.username || "").replace(/"/g, "") +
          '">' +
          (it.thumb
            ? '<img src="' +
              it.thumb +
              '" alt="" loading="lazy" onerror="this.parentNode.style.background=\'#333\'">'
            : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#666"><i class="fa-solid fa-image"></i></div>') +
          '<span class="csiBadge">' +
          shareKind +
          "</span></button>"
        );
      })
      .join("");

    list.querySelectorAll(".contentShareItem").forEach((btn) => {
      btn.addEventListener("click", () => {
        sendSharedContent({
          id: btn.getAttribute("data-id"),
          owner: btn.getAttribute("data-owner"),
          thumb: btn.getAttribute("data-thumb"),
          title: btn.getAttribute("data-title"),
          username: btn.getAttribute("data-user")
        });
      });
    });
  }

  async function sendSharedContent(item) {
    if (!item || !item.id) return;
    const me =
      (window.state && state.currentUser && state.currentUser.uid) ||
      (firebase.auth().currentUser && firebase.auth().currentUser.uid);
    if (!me || !state.chatId) {
      if (typeof showToast === "function") showToast("Chat not ready");
      return;
    }
    closePicker();
    const typeMap = {
      post: "post_share",
      short: "short_share",
      video: "video_share",
      story: "story_share"
    };
    const msgType = typeMap[shareKind] || "post_share";
    const origin = location.origin || "";
    const shareUrl =
      shareKind === "post"
        ? origin + "/post.html?id=" + encodeURIComponent(item.id)
        : shareKind === "short"
        ? origin + "/shorts.html?id=" + encodeURIComponent(item.id)
        : shareKind === "story"
        ? origin +
          "/stories.html?uid=" +
          encodeURIComponent(item.owner || "") +
          "&storyId=" +
          encodeURIComponent(item.id)
        : origin + "/video.html?id=" + encodeURIComponent(item.id);

    const message = {
      type: msgType,
      contentId: item.id,
      postId: shareKind === "post" ? item.id : null,
      shortId: shareKind === "short" ? item.id : null,
      videoId: shareKind === "video" ? item.id : null,
      storyId: shareKind === "story" ? item.id : null,
      thumb: item.thumb || "",
      thumbnail: item.thumb || "",
      title: item.title || "",
      caption: item.title || "",
      text:
        shareKind === "post"
          ? "Shared a post"
          : shareKind === "short"
          ? "Shared a short"
          : shareKind === "story"
          ? "Shared a story"
          : "Shared a video",
      authorName: item.username || "",
      username: item.username || "",
      ownerId: item.owner || "",
      uid: item.owner || "",
      shareUrl,
      senderId: me,
      createdAt: Date.now()
    };

    try {
      if (typeof sendChatMessage === "function") {
        await sendChatMessage(message);
      } else {
        const ref = firebase
          .database()
          .ref("vieworaChats/" + state.chatId + "/messages")
          .push();
        message.id = ref.key;
        await ref.set(message);
        if (typeof syncInboxAfterSend === "function") {
          await syncInboxAfterSend(message);
        }
      }
      if (typeof showToast === "function") showToast("Shared");
    } catch (e) {
      console.error(e);
      if (typeof showToast === "function") showToast("Could not share");
    }
  }

  function bindShareUI() {
    document.querySelectorAll("[data-share-kind]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openPicker(btn.getAttribute("data-share-kind") || "post");
      });
    });
    document
      .getElementById("closeContentShareBtn")
      ?.addEventListener("click", closePicker);
    document.querySelectorAll("[data-close-content-share]").forEach((el) => {
      el.addEventListener("click", closePicker);
    });
    document.querySelectorAll(".contentShareTab").forEach((tab) => {
      tab.addEventListener("click", () => {
        shareTab = tab.getAttribute("data-cs-tab") || "mine";
        document.querySelectorAll(".contentShareTab").forEach((t) => {
          t.classList.toggle(
            "active",
            t.getAttribute("data-cs-tab") === shareTab
          );
        });
        loadContentItems();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindShareUI, { once: true });
  } else {
    bindShareUI();
  }

  window.VieworaChatShare = { open: openPicker, send: sendSharedContent };
})();
