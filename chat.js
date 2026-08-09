/* =========================================================
   VIEWORA PREMIUM CHAT V3
   Firebase Realtime Database - Firebase v8 Compatible
   Cloudinary Media Upload
   Clean / Scoped / Duplicate-Safe
========================================================= */

(function VIEWORA_CHAT_BOOT() {

    /* =====================================================
       DUPLICATE SCRIPT LOAD PROTECTION
    ===================================================== */

    if (window.__VIEWORA_CHAT_V3_LOADED__) {
        console.warn(
            "%cVIEWORA CHAT: duplicate script ignored.",
            "color:#ff9800;font-weight:800"
        );
        return;
    }

    window.__VIEWORA_CHAT_V3_LOADED__ = true;

    "use strict";

    console.clear();

    console.log(
        "%cVIEWORA CHAT V3",
        "color:#00e5ff;font-size:18px;font-weight:800"
    );

    /* =====================================================
       CLOUDINARY
    ===================================================== */

    const CLOUDINARY_CLOUD_NAME = "z5m6wjdf";
    const CLOUDINARY_UPLOAD_PRESET = "Viewora-upload";

    const CLOUDINARY_UPLOAD_URL =
        "https://api.cloudinary.com/v1_1/" +
        CLOUDINARY_CLOUD_NAME +
        "/auto/upload";

    /* =====================================================
       FIREBASE CHECK
    ===================================================== */

    if (typeof firebase === "undefined") {
        console.error("Viewora Chat: Firebase SDK missing.");
        return;
    }

    if (
        typeof auth === "undefined" ||
        typeof db === "undefined"
    ) {
        console.error(
            "Viewora Chat: Firebase Auth/Database missing."
        );
        return;
    }

    /* =====================================================
       DOM HELPER
    ===================================================== */

    const $ = id =>
        document.getElementById(id);

    /* =====================================================
       DOM
    ===================================================== */

    const loadingOverlay = $("loadingOverlay");
    const loadingText = $("loadingText");
    const app = $("app");

    const backBtn = $("backBtn");
    const profileBtn = $("profileBtn");

    const chatName = $("chatName");
    const chatStatus = $("chatStatus");
    const chatPhoto = $("chatPhoto");
    const onlineDot = $("onlineDot");

    const searchBtn = $("searchBtn");
    const searchBar = $("searchBar");
    const searchInput = $("searchInput");
    const closeSearch = $("closeSearch");

    const voiceCallBtn = $("voiceCallBtn");
    const videoCallBtn = $("videoCallBtn");
    const menuBtn = $("menuBtn");
    const chatMenu = $("chatMenu");

    const chatContainer = $("chatContainer");
    const messagesList = $("messagesList");

    const typingIndicator = $("typingIndicator");
    const typingPhoto = $("typingPhoto");
    const typingText = $("typingText");

    const scrollBottomBtn = $("scrollBottomBtn");

    const replyPreview = $("replyPreview");
    const replyUser = $("replyUser");
    const replyText = $("replyText");
    const closeReplyPreview = $("closeReplyPreview");

    const reactionBar = $("reactionBar");
    const messageMenu = $("messageMenu");

    const messageInput = $("messageInput");
    const sendBtn = $("sendBtn");
    const attachBtn = $("attachBtn");
    const emojiBtn = $("emojiBtn");
    const cameraBtn = $("cameraBtn");
    const voiceBtn = $("voiceBtn");

    const emojiPanel = $("emojiPanel");

    const attachmentSheet = $("attachmentSheet");
    const closeAttachmentBtn = $("closeAttachmentBtn");

    const galleryBtn = $("galleryBtn");
    const cameraAttachmentBtn = $("cameraAttachmentBtn");
    const videoBtn = $("videoBtn");
    const audioBtn = $("audioBtn");
    const documentBtn = $("documentBtn");

    const imagePicker = $("imagePicker");
    const videoPicker = $("videoPicker");
    const audioPicker = $("audioPicker");
    const documentPicker = $("documentPicker");
    const cameraPicker = $("cameraPicker");

    const mediaPreviewModal = $("mediaPreviewModal");
    const previewImage = $("previewImage");
    const previewVideo = $("previewVideo");
    const previewAudioBox = $("previewAudioBox");
    const previewAudio = $("previewAudio");
    const previewAudioName = $("previewAudioName");
    const previewFileBox = $("previewFileBox");
    const previewFileName = $("previewFileName");
    const previewFileSize = $("previewFileSize");
    const mediaCaption = $("mediaCaption");

    const closePreviewBtn = $("closePreviewBtn");
    const cancelMediaBtn = $("cancelMediaBtn");
    const sendMediaBtn = $("sendMediaBtn");

    const imageViewer = $("imageViewer");
    const viewerImage = $("viewerImage");

    const videoViewer = $("videoViewer");
    const viewerVideo = $("viewerVideo");
    const closeViewerBtn = $("closeViewerBtn");
    const closeVideoViewerBtn = $("closeVideoViewerBtn");

    const profileModal = $("profileModal");
    const profileImage = $("profileImage");
    const profileName = $("profileName");
    const profileUsername = $("profileUsername");
    const profileStatus = $("profileStatus");
    const closeProfileBtn = $("closeProfileBtn");

    const deleteModal = $("deleteModal");
    const deleteForMeBtn = $("deleteForMeBtn");
    const deleteForEveryoneBtn = $("deleteForEveryoneBtn");
    const cancelDeleteBtn = $("cancelDeleteBtn");

    const messageInfoModal = $("messageInfoModal");
    const sentTime = $("sentTime");
    const deliveredTime = $("deliveredTime");
    const seenTime = $("seenTime");
    const closeInfoBtn = $("closeInfoBtn");

    const recordOverlay = $("recordOverlay");
    const recordTime = $("recordTime");
    const cancelRecordingBtn = $("cancelRecordingBtn");
    const stopRecordingBtn = $("stopRecordingBtn");

    const uploadOverlay = $("uploadOverlay");
    const uploadFileName = $("uploadFileName");
    const uploadProgressBar = $("uploadProgressBar");
    const uploadPercent = $("uploadPercent");
    const uploadSpeed = $("uploadSpeed");
    const cancelUploadBtn = $("cancelUploadBtn");

    const toast = $("toast");
    const toastIcon = $("toastIcon");
    const toastText = $("toastText");

    /* =====================================================
       STATE
    ===================================================== */

    let currentUser = null;
    let currentProfile = {};

    let otherUID = null;
    let otherProfile = {};

    let chatId = null;

    let messagesRef = null;
    let messagesListener = null;

    let otherUserRef = null;
    let otherUserListener = null;

    let typingRef = null;
    let typingListener = null;

    /*
       IMPORTANT:
       These variables are now inside the private IIFE.
       They cannot collide with another global blockedRef.
    */
    let blockedRef = null;
    let blockedListener = null;

    let selectedMessageId = null;
    let selectedMessageData = null;

    let replyingTo = null;

    let selectedMediaFile = null;
    let selectedMediaType = null;
    let selectedMediaObjectURL = null;

    let uploadXHR = null;

    let mediaRecorder = null;
    let recordedChunks = [];
    let recordingTimer = null;
    let recordingSeconds = 0;

    let typingTimer = null;

    let initialized = false;
    let lastNotificationMessageId = null;
let notificationAudioContext = null;
let notificationUnlocked = false;

    /* =====================================================
       GLOBAL LOCAL STATE
    ===================================================== */

    function setBlockedState(value) {
        window.vieworaBlocked = value === true;
    }

    function getBlockedState() {
        return window.vieworaBlocked === true;
    }

    /* =====================================================
       URL
    ===================================================== */

    function getOtherUID() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return (
            params.get("uid") ||
            params.get("userId") ||
            params.get("to") ||
            null
        );
    }

    /* =====================================================
       CHAT ID
    ===================================================== */

    function makeChatId(uid1, uid2) {

        return [
            String(uid1),
            String(uid2)
        ]
            .sort()
            .join("_");
    }

    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(
        message,
        type = "success"
    ) {

        if (!toast || !toastText) {
            console.log(message);
            return;
        }

        toastText.textContent =
            String(message);

        if (toastIcon) {

            toastIcon.className =
                type === "error"
                    ? "fa-solid fa-circle-exclamation"
                    : type === "warning"
                        ? "fa-solid fa-triangle-exclamation"
                        : "fa-solid fa-circle-check";
        }

        toast.classList.remove(
            "hidden"
        );

        clearTimeout(
            window.__vieworaToastTimer
        );

        window.__vieworaToastTimer =
            setTimeout(() => {

                toast.classList.add(
                    "hidden"
                );

            }, 2500);
    }

    /* =====================================================
       LOADING
    ===================================================== */

    function showLoading(
        text = "Loading chat..."
    ) {

        if (loadingText) {
            loadingText.textContent =
                text;
        }

        loadingOverlay?.classList.remove(
            "hidden"
        );
    }

    function hideLoading() {

        loadingOverlay?.classList.add(
            "hidden"
        );

        app?.classList.remove(
            "hidden"
        );
    }

    /* =====================================================
       AUTH
    ===================================================== */

    auth.onAuthStateChanged(
        async user => {

            if (!user) {

                location.replace(
                    "login.html"
                );

                return;
            }

            currentUser = user;

            otherUID =
                getOtherUID();

            if (!otherUID) {

                hideLoading();

                showToast(
                    "Chat user not found.",
                    "error"
                );

                return;
            }

            if (
                otherUID ===
                currentUser.uid
            ) {

                hideLoading();

                showToast(
                    "You cannot chat with yourself.",
                    "warning"
                );

                return;
            }

            chatId =
                makeChatId(
                    currentUser.uid,
                    otherUID
                );

            try {

                showLoading(
                    "Connecting to chat..."
                );

                await loadCurrentUser();

                await loadOtherUser();

                await ensureChatExists();

                setupOtherUserListener();

                setupTypingListener();

                setupBlockedListener();

                setupMessagesListener();

                setupPresence();

                await markChatAsRead();

                setupBrowserNotifications();

                addSafetyMenuItems();

                hideLoading();

                initialized = true;

                console.log(
                    "%cViewora Chat Ready",
                    "color:#00e676;font-weight:bold"
                );

            } catch (error) {

                console.error(
                    "CHAT INIT ERROR:",
                    error
                );

                hideLoading();

                showToast(
                    "Unable to load chat.",
                    "error"
                );
            }
        }
    );

    /* =====================================================
       LOAD CURRENT USER
    ===================================================== */

    async function loadCurrentUser() {

        const snapshot =
            await db
                .ref(
                    "users/" +
                    currentUser.uid
                )
                .once("value");

        currentProfile =
            snapshot.exists()
                ? snapshot.val() || {}
                : {};
    }

    /* =====================================================
       LOAD OTHER USER
    ===================================================== */

    async function loadOtherUser() {

        const snapshot =
            await db
                .ref(
                    "users/" +
                    otherUID
                )
                .once("value");

        if (!snapshot.exists()) {
            throw new Error(
                "Other user does not exist"
            );
        }

        otherProfile =
            snapshot.val() || {};

        renderOtherUser();
    }

    /* =====================================================
       OTHER USER HEADER
    ===================================================== */

    function renderOtherUser() {

        const name =
            otherProfile.name ||
            otherProfile.fullName ||
            otherProfile.displayName ||
            otherProfile.username ||
            "User";

        const username =
            otherProfile.username ||
            "user";

        const photo =
            otherProfile.profilePhoto ||
            otherProfile.photoURL ||
            otherProfile.avatar ||
            "assets/default-avatar.png";

        if (chatName) {
            chatName.textContent =
                name;
        }

        if (chatPhoto) {
            chatPhoto.src =
                photo;
        }

        if (typingPhoto) {
            typingPhoto.src =
                photo;
        }

        if (profileImage) {
            profileImage.src =
                photo;
        }

        if (profileName) {
            profileName.textContent =
                name;
        }

        if (profileUsername) {

            profileUsername.textContent =
                "@" +
                String(username)
                    .replace(/^@/, "");
        }

        updatePresenceUI(
            otherProfile.online === true,
            otherProfile.lastSeen
        );
    }

    /* =====================================================
       OTHER USER LISTENER
    ===================================================== */

    function setupOtherUserListener() {

        cleanupOtherUserListener();

        otherUserRef =
            db.ref(
                "users/" +
                otherUID
            );

        otherUserListener =
            snapshot => {

                if (!snapshot.exists()) {
                    return;
                }

                otherProfile =
                    snapshot.val() || {};

                renderOtherUser();
            };

        otherUserRef.on(
            "value",
            otherUserListener
        );
    }

    function cleanupOtherUserListener() {

        if (
            otherUserRef &&
            otherUserListener
        ) {

            otherUserRef.off(
                "value",
                otherUserListener
            );
        }

        otherUserRef = null;
        otherUserListener = null;
    }

    /* =====================================================
       PRESENCE
    ===================================================== */

    function setupPresence() {

        const userRef =
            db.ref(
                "users/" +
                currentUser.uid
            );

        userRef.update({

            online: true,

            lastSeen:
                firebase.database
                    .ServerValue
                    .TIMESTAMP

        }).catch(
            console.error
        );

        userRef
            .onDisconnect()
            .update({

                online: false,

                lastSeen:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP
            });
    }

    function updatePresenceUI(
        online,
        lastSeen
    ) {

        if (chatStatus) {

            chatStatus.textContent =
                online
                    ? "Online"
                    : formatLastSeen(lastSeen);
        }

        onlineDot?.classList.toggle(
            "hidden",
            !online
        );

        if (profileStatus) {

            profileStatus.textContent =
                online
                    ? "Online"
                    : formatLastSeen(lastSeen);
        }
    }

    function formatLastSeen(
        timestamp
    ) {

        if (!timestamp) {
            return "Offline";
        }

        const diff =
            Date.now() -
            Number(timestamp);

        if (diff < 60000) {
            return "Last seen just now";
        }

        if (diff < 3600000) {

            return (
                "Last seen " +
                Math.floor(
                    diff / 60000
                ) +
                "m ago"
            );
        }

        return (
            "Last seen " +
            new Date(timestamp)
                .toLocaleTimeString(
                    [],
                    {
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                )
        );
    }

    /* =====================================================
       ENSURE CHAT
    ===================================================== */

    async function ensureChatExists() {

        const ref =
            db.ref(
                "chats/" +
                chatId
            );

        const snapshot =
            await ref.once(
                "value"
            );

        if (!snapshot.exists()) {

            await ref.set({

                type: "private",

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP,

                members: {

                    [currentUser.uid]: true,

                    [otherUID]: true
                }
            });
        }
    }

    /* =====================================================
       MESSAGE LISTENER
    ===================================================== */

/* =====================================================
   MESSAGE LISTENER + NEW MESSAGE NOTIFICATION
===================================================== */

function setupMessagesListener() {

    cleanupMessagesListener();

    messagesRef =
        db
            .ref(
                "chats/" +
                chatId +
                "/messages"
            )
            .limitToLast(200);

    /*
       First snapshot ko old messages maana jayega.
       Isse chat open karte hi purane messages ki
       notification nahi aayegi.
    */

    let firstSnapshot = true;

    messagesListener =
        snapshot => {

            if (!messagesList) {
                return;
            }

            messagesList.innerHTML = "";

            if (!snapshot.exists()) {

                renderEmptyChat();

                firstSnapshot = false;

                return;
            }

            snapshot.forEach(
                child => {

                    const message =
                        child.val() || {};

                    /*
                       Deleted only-for-me messages
                       hide karo.
                    */

                    if (
                        message.deletedFor &&
                        message.deletedFor[
                            currentUser.uid
                        ]
                    ) {
                        return;
                    }

                    renderMessage(
                        child.key,
                        message
                    );
                }
            );

            /*
               New incoming message detect karo.
            */

            if (!firstSnapshot) {

                const lastChild =
                    snapshot.val();

                /*
                   Firebase snapshot ko children me
                   iterate karke latest message nikalo.
                */

                let latestId = null;
                let latestMessage = null;

                snapshot.forEach(
                    child => {

                        latestId =
                            child.key;

                        latestMessage =
                            child.val() || {};
                    }
                );

                if (
                    latestId &&
                    latestMessage &&
                    latestMessage.uid !==
                        currentUser.uid
                ) {

                    handleIncomingMessageNotification(
                        latestId,
                        latestMessage
                    );
                }
            }

            firstSnapshot = false;

            markIncomingMessagesSeen(
                snapshot
            );

            requestAnimationFrame(
                () => {
                    scrollToBottom(false);
                }
            );
        };

    messagesRef.on(
        "value",
        messagesListener,
        error => {

            console.error(
                "Messages listener:",
                error
            );

            showToast(
                "Unable to sync messages.",
                "error"
            );
        }
    );
}
    /* =====================================================
       EMPTY CHAT
    ===================================================== */

    function renderEmptyChat() {

        if (!messagesList) {
            return;
        }

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "vieworaEmptyChat";

        empty.innerHTML = `
            <div class="emptyChatIcon">
                <i class="fa-regular fa-comments"></i>
            </div>

            <strong>Start the conversation</strong>

            <span>
                Send a message to
                ${escapeHTML(
                    otherProfile.name ||
                    otherProfile.username ||
                    "this user"
                )}
            </span>
        `;

        messagesList.appendChild(
            empty
        );
    }

    /* =====================================================
       RENDER MESSAGE
    ===================================================== */

    function renderMessage(
        messageId,
        message
    ) {

        if (!messagesList) {
            return;
        }

        const mine =
            message.uid ===
            currentUser.uid;

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "messageRow " +
            (mine
                ? "sent"
                : "received");

        row.dataset.messageId =
            messageId;

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "messageWrapper";

        /* REPLY */

        if (message.replyTo) {

            const reply =
                document.createElement(
                    "div"
                );

            reply.className =
                "messageReply";

            reply.innerHTML = `
                <strong>
                    ${escapeHTML(
                        message.replyTo.username ||
                        "Reply"
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        message.replyTo.text ||
                        "[Media]"
                    )}
                </span>
            `;

            wrapper.appendChild(
                reply
            );
        }

        /* DELETED */

        if (message.deleted) {

            const bubble =
                document.createElement(
                    "div"
                );

            bubble.className =
                "messageBubble deletedMessage";

            bubble.textContent =
                "Message deleted";

            wrapper.appendChild(
                bubble
            );

        } else {

            /* TEXT */

            if (
                message.type === "text" &&
                message.text
            ) {

                const bubble =
                    document.createElement(
                        "div"
                    );

                bubble.className =
                    "messageBubble";

                bubble.textContent =
                    message.text;

                if (message.edited) {

                    const edited =
                        document.createElement(
                            "small"
                        );

                    edited.className =
                        "editedLabel";

                    edited.textContent =
                        "edited";

                    bubble.appendChild(
                        edited
                    );
                }

                wrapper.appendChild(
                    bubble
                );
            }

            /* IMAGE */

            if (
                message.type === "image" &&
                message.url
            ) {

                const media =
                    document.createElement(
                        "div"
                    );

                media.className =
                    "messageMedia";

                const image =
                    document.createElement(
                        "img"
                    );

                image.src =
                    message.url;

                image.loading =
                    "lazy";

                image.alt =
                    "Image";

                image.addEventListener(
                    "click",
                    () => openImage(
                        message.url
                    )
                );

                media.appendChild(
                    image
                );

                wrapper.appendChild(
                    media
                );
            }

            /* VIDEO */

            if (
                message.type === "video" &&
                message.url
            ) {

                const media =
                    document.createElement(
                        "div"
                    );

                media.className =
                    "messageMedia";

                const video =
                    document.createElement(
                        "video"
                    );

                video.src =
                    message.url;

                video.controls =
                    true;

                video.playsInline =
                    true;

                video.preload =
                    "metadata";

                media.appendChild(
                    video
                );

                wrapper.appendChild(
                    media
                );
            }

            /* AUDIO */

            if (
                message.type === "audio" &&
                message.url
            ) {

                const audio =
                    document.createElement(
                        "audio"
                    );

                audio.src =
                    message.url;

                audio.controls =
                    true;

                wrapper.appendChild(
                    audio
                );
            }

            /* FILE */

            if (
                message.type === "file" &&
                message.url
            ) {

                const file =
                    document.createElement(
                        "a"
                    );

                file.href =
                    message.url;

                file.target =
                    "_blank";

                file.rel =
                    "noopener noreferrer";

                file.className =
                    "messageFile";

                file.innerHTML = `
                    <i class="fa-solid fa-file"></i>
                    <span>
                        ${escapeHTML(
                            message.fileName ||
                            "File"
                        )}
                    </span>
                `;

                wrapper.appendChild(
                    file
                );
            }
        }

        /* CAPTION */

        if (
            message.caption &&
            !message.deleted
        ) {

            const caption =
                document.createElement(
                    "div"
                );

            caption.className =
                "messageCaption";

            caption.textContent =
                message.caption;

            wrapper.appendChild(
                caption
            );
        }

        /* META */

        const meta =
            document.createElement(
                "div"
            );

        meta.className =
            "messageMeta";

        const time =
            document.createElement(
                "span"
            );

        time.textContent =
            formatTime(
                message.createdAt
            );

        meta.appendChild(
            time
        );

        if (mine) {

            const status =
                document.createElement(
                    "span"
                );

            status.className =
                "messageStatus";

            status.innerHTML =
                message.seen
                    ? '<i class="fa-solid fa-check-double"></i>'
                    : '<i class="fa-solid fa-check"></i>';

            meta.appendChild(
                status
            );
        }

        wrapper.appendChild(
            meta
        );

        /* REACTIONS */

        if (message.reactions) {

            const reactions =
                document.createElement(
                    "div"
                );

            reactions.className =
                "messageReactions";

            Object.entries(
                message.reactions
            ).forEach(
                ([uid, emoji]) => {

                    const chip =
                        document.createElement(
                            "button"
                        );

                    chip.type =
                        "button";

                    chip.textContent =
                        emoji;

                    chip.addEventListener(
                        "click",
                        () => reactToMessage(
                            messageId,
                            emoji
                        )
                    );

                    reactions.appendChild(
                        chip
                    );
                }
            );

            wrapper.appendChild(
                reactions
            );
        }

        row.appendChild(
            wrapper
        );

        messagesList.appendChild(
            row
        );

        /* RIGHT CLICK */

        row.addEventListener(
            "contextmenu",
            event => {

                event.preventDefault();

                openMessageMenu(
                    messageId,
                    message,
                    event.clientX,
                    event.clientY
                );
            }
        );

        /* LONG PRESS */

        let pressTimer = null;

        row.addEventListener(
            "touchstart",
            () => {

                clearTimeout(
                    pressTimer
                );

                pressTimer =
                    setTimeout(
                        () => {

                            const rect =
                                row.getBoundingClientRect();

                            openMessageMenu(
                                messageId,
                                message,
                                rect.left +
                                rect.width / 2,
                                rect.top
                            );

                        },
                        550
                    );
            },
            {
                passive: true
            }
        );

        row.addEventListener(
            "touchend",
            () => {

                clearTimeout(
                    pressTimer
                );
            },
            {
                passive: true
            }
        );

        row.addEventListener(
            "touchmove",
            () => {

                clearTimeout(
                    pressTimer
                );
            },
            {
                passive: true
            }
        );
    }

    /* =====================================================
       SEND TEXT
    ===================================================== */

    sendBtn?.addEventListener(
        "click",
        sendTextMessage
    );

    messageInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendTextMessage();
            }
        }
    );

    async function sendTextMessage() {

        const text =
            messageInput?.value
                ?.trim() || "";

        if (!text) {
            return;
        }

        if (
            !currentUser ||
            !chatId
        ) {
            return;
        }

        if (getBlockedState()) {

            showToast(
                "You cannot message this user.",
                "warning"
            );

            return;
        }

        try {

            const messageRef =
                db
                    .ref(
                        `chats/${chatId}/messages`
                    )
                    .push();

            const message = {

                uid:
                    currentUser.uid,

                username:
                    currentProfile.username ||
                    currentUser.displayName ||
                    "user",

                type:
                    "text",

                text:
                    text,

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP,

                seen:
                    false
            };

            addReplyData(
                message
            );

            await messageRef.set(
                message
            );

            await updateChatList(
                getMessagePreview(
                    message
                )
            );

            if (messageInput) {
                messageInput.value = "";
            }

            autoResizeInput();

            cancelReply();

            stopTyping();

            scrollToBottom();

        } catch (error) {

            console.error(
                "SEND ERROR:",
                error
            );

            showToast(
                "Message could not be sent.",
                "error"
            );
        }
    }

    /* =====================================================
       REPLY
    ===================================================== */

    function addReplyData(
        message
    ) {

        if (!replyingTo) {
            return;
        }

        message.replyTo = {

            messageId:
                replyingTo.id,

            username:
                replyingTo.username ||
                "User",

            text:
                replyingTo.text ||
                "[Media]"
        };
    }

    function startReply(
        messageId,
        message
    ) {

        replyingTo = {

            id:
                messageId,

            username:
                message.username ||
                (
                    message.uid ===
                    currentUser.uid
                        ? "You"
                        : otherProfile.name ||
                          "User"
                ),

            text:
                message.text ||
                getMessagePreview(message)
        };

        if (replyUser) {
            replyUser.textContent =
                replyingTo.username;
        }

        if (replyText) {
            replyText.textContent =
                replyingTo.text;
        }

        replyPreview?.classList.remove(
            "hidden"
        );

        messageInput?.focus();

        closeMessageMenu();
    }

    function cancelReply() {

        replyingTo = null;

        replyPreview?.classList.add(
            "hidden"
        );
    }

    closeReplyPreview?.addEventListener(
        "click",
        cancelReply
    );

    /* =====================================================
       CHAT LIST
    ===================================================== */

    async function updateChatList(
        preview
    ) {

        const timestamp =
            firebase.database
                .ServerValue
                .TIMESTAMP;

        const myProfile =
            currentProfile || {};

        const other =
            otherProfile || {};

        const updates = {};

        const otherName =
            other.name ||
            other.displayName ||
            other.username ||
            "User";

        const myName =
            myProfile.name ||
            myProfile.displayName ||
            myProfile.username ||
            "User";

        const otherPhoto =
            other.profilePhoto ||
            other.photoURL ||
            other.avatar ||
            "";

        const myPhoto =
            myProfile.profilePhoto ||
            myProfile.photoURL ||
            myProfile.avatar ||
            "";

        /* SENDER */

        updates[
            `userChats/${currentUser.uid}/${chatId}`
        ] = {

            chatId:
                chatId,

            userId:
                otherUID,

            name:
                otherName,

            username:
                other.username || "",

            photoURL:
                otherPhoto,

            lastMessage:
                preview,

            lastMessageTime:
                timestamp,

            unread:
                0,

            online:
                other.online === true
        };

        /* RECEIVER */

        const receiverRef =
            db.ref(
                `userChats/${otherUID}/${chatId}`
            );

        const receiverSnapshot =
            await receiverRef.once(
                "value"
            );

        const oldReceiver =
            receiverSnapshot.val() || {};

        updates[
            `userChats/${otherUID}/${chatId}`
        ] = {

            chatId:
                chatId,

            userId:
                currentUser.uid,

            name:
                myName,

            username:
                myProfile.username ||
                "",

            photoURL:
                myPhoto,

            lastMessage:
                preview,

            lastMessageTime:
                timestamp,

            unread:
                Number(
                    oldReceiver.unread || 0
                ) + 1,

            online:
                currentUser.online === true
        };

        await db
            .ref()
            .update(
                updates
            );
    }

    /* =====================================================
       MESSAGE PREVIEW
    ===================================================== */

    function getMessagePreview(
        message
    ) {

        switch (
            message.type
        ) {

            case "text":
                return (
                    message.text ||
                    "New message"
                );

            case "image":
                return "📷 Photo";

            case "video":
                return "🎥 Video";

            case "audio":
                return "🎵 Audio";

            case "file":
                return "📎 File";

            default:
                return "New message";
        }
    }

    /* =====================================================
       MARK CHAT READ
    ===================================================== */

    async function markChatAsRead() {

        if (
            !currentUser ||
            !chatId
        ) {
            return;
        }

        try {

            await db
                .ref(
                    `userChats/${currentUser.uid}/${chatId}/unread`
                )
                .set(0);

        } catch (error) {

            console.warn(
                "markChatAsRead:",
                error
            );
        }
    }

    /* =====================================================
       MARK INCOMING SEEN
    ===================================================== */

    function markIncomingMessagesSeen(
        snapshot
    ) {

        if (!currentUser) {
            return;
        }

        const updates = {};

        snapshot.forEach(
            child => {

                const message =
                    child.val() || {};

                if (
                    message.uid !==
                        currentUser.uid &&
                    !message.seen &&
                    !message.deleted
                ) {

                    updates[
                        `chats/${chatId}/messages/${child.key}/seen`
                    ] = true;
                }
            }
        );

        if (
            Object.keys(updates).length
        ) {

            db.ref()
                .update(updates)
                .catch(
                    console.error
                );
        }
    }

    /* =====================================================
       TYPING
    ===================================================== */

    function setupTypingListener() {

        cleanupTypingListener();

        typingRef =
            db.ref(
                `typing/${chatId}/${otherUID}`
            );

        typingListener =
            snapshot => {

                const data =
                    snapshot.val();

                if (
                    data &&
                    data.typing === true
                ) {

                    if (typingText) {

                        typingText.textContent =
                            (
                                otherProfile.name ||
                                otherProfile.username ||
                                "User"
                            ) +
                            " is typing...";
                    }

                    typingIndicator?.classList.remove(
                        "hidden"
                    );

                } else {

                    typingIndicator?.classList.add(
                        "hidden"
                    );
                }
            };

        typingRef.on(
            "value",
            typingListener
        );
    }

    function cleanupTypingListener() {

        if (
            typingRef &&
            typingListener
        ) {

            typingRef.off(
                "value",
                typingListener
            );
        }

        typingRef = null;
        typingListener = null;
    }

    messageInput?.addEventListener(
        "input",
        () => {

            autoResizeInput();

            if (
                currentUser &&
                chatId &&
                !getBlockedState()
            ) {

                setTyping(true);

                clearTimeout(
                    typingTimer
                );

                typingTimer =
                    setTimeout(
                        stopTyping,
                        1400
                    );
            }
        }
    );

    function setTyping(
        value
    ) {

        if (
            !currentUser ||
            !chatId
        ) {
            return;
        }

        db.ref(
            `typing/${chatId}/${currentUser.uid}`
        ).set({

            typing:
                value,

            username:
                currentProfile.username ||
                currentUser.displayName ||
                "user",

            timestamp:
                firebase.database
                    .ServerValue
                    .TIMESTAMP

        }).catch(
            console.error
        );
    }

    function stopTyping() {

        clearTimeout(
            typingTimer
        );

        if (
            currentUser &&
            chatId
        ) {

            db.ref(
                `typing/${chatId}/${currentUser.uid}`
            )
                .remove()
                .catch(
                    console.error
                );
        }
    }

    /* =====================================================
       BLOCK SYSTEM
    ===================================================== */

    function setupBlockedListener() {

        cleanupBlockedListener();

        blockedRef =
            db.ref(
                `blocks/${currentUser.uid}/${otherUID}`
            );

        blockedListener =
            snapshot => {

                const blocked =
                    snapshot.val() === true;

                updateBlockedUI(
                    blocked
                );
            };

        blockedRef.on(
            "value",
            blockedListener,
            error => {

                console.error(
                    "Block listener:",
                    error
                );
            }
        );
    }

    function cleanupBlockedListener() {

        if (
            blockedRef &&
            blockedListener
        ) {

            blockedRef.off(
                "value",
                blockedListener
            );
        }

        blockedRef = null;
        blockedListener = null;
    }

    function isBlocked() {
        return getBlockedState();
    }

    function updateBlockedUI(
        blocked
    ) {

        setBlockedState(
            blocked
        );

        if (messageInput) {

            messageInput.disabled =
                blocked;

            messageInput.placeholder =
                blocked
                    ? "You blocked this user"
                    : "Message...";
        }

        if (sendBtn) {
            sendBtn.disabled =
                blocked;
        }

        if (attachBtn) {
            attachBtn.disabled =
                blocked;
        }

        if (cameraBtn) {
            cameraBtn.disabled =
                blocked;
        }

        if (voiceBtn) {
            voiceBtn.disabled =
                blocked;
        }

        const blockButton =
            $("dynamicBlockBtn");

        if (blockButton) {

            blockButton.innerHTML =
                blocked
                    ? '<i class="fa-solid fa-unlock"></i><span>Unblock User</span>'
                    : '<i class="fa-solid fa-ban"></i><span>Block User</span>';
        }
    }

    async function toggleBlock() {

        if (
            !currentUser ||
            !otherUID
        ) {
            return;
        }

        try {

            const myBlockRef =
                db.ref(
                    `blocks/${currentUser.uid}/${otherUID}`
                );

            const snapshot =
                await myBlockRef.once(
                    "value"
                );

            const blocked =
                snapshot.val() === true;

            if (blocked) {

                await myBlockRef.remove();

                await db
                    .ref(
                        `blocks/${otherUID}/${currentUser.uid}`
                    )
                    .remove();

                showToast(
                    "User unblocked"
                );

            } else {

                await myBlockRef.set(
                    true
                );

                await db
                    .ref(
                        `blocks/${otherUID}/${currentUser.uid}`
                    )
                    .set(true);

                stopTyping();

                showToast(
                    "User blocked"
                );
            }

            closeChatMenu();

        } catch (error) {

            console.error(
                "BLOCK ERROR:",
                error
            );

            showToast(
                "Unable to update block status.",
                "error"
            );
        }
    }

    /* =====================================================
       REPORT
    ===================================================== */

    async function reportUser() {

        const reason =
            window.prompt(
                "Why do you want to report this user?"
            );

        if (
            !reason ||
            !reason.trim()
        ) {
            return;
        }

        try {

            const reportRef =
                db
                    .ref("reports")
                    .push();

            await reportRef.set({

                reporter:
                    currentUser.uid,

                reportedUser:
                    otherUID,

                chatId:
                    chatId,

                reason:
                    reason.trim(),

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP,

                status:
                    "pending"
            });

            showToast(
                "Report submitted"
            );

            closeChatMenu();

        } catch (error) {

            console.error(
                "REPORT ERROR:",
                error
            );

            showToast(
                "Could not submit report.",
                "error"
            );
        }
    }

    /* =====================================================
       SAFETY MENU
    ===================================================== */

    function addSafetyMenuItems() {

        if (!chatMenu) {
            return;
        }

        let block =
            $("dynamicBlockBtn");

        if (!block) {

            block =
                document.createElement(
                    "button"
                );

            block.id =
                "dynamicBlockBtn";

            block.className =
                "menuItem danger";

            block.type =
                "button";

            block.addEventListener(
                "click",
                toggleBlock
            );

            chatMenu.appendChild(
                block
            );
        }

        let report =
            $("dynamicReportBtn");

        if (!report) {

            report =
                document.createElement(
                    "button"
                );

            report.id =
                "dynamicReportBtn";

            report.className =
                "menuItem danger";

            report.type =
                "button";

            report.innerHTML =
                '<i class="fa-solid fa-flag"></i>' +
                '<span>Report User</span>';

            report.addEventListener(
                "click",
                reportUser
            );

            chatMenu.appendChild(
                report
            );
        }

        updateBlockedUI(
            isBlocked()
        );
    }

    /* =====================================================
       MESSAGE MENU
    ===================================================== */

    function openMessageMenu(
        id,
        message,
        x,
        y
    ) {

        selectedMessageId =
            id;

        selectedMessageData =
            message;

        if (!messageMenu) {
            return;
        }

        messageMenu.classList.remove(
            "hidden"
        );

        const width =
            messageMenu.offsetWidth ||
            220;

        const height =
            messageMenu.offsetHeight ||
            300;

        let left =
            Math.min(
                x,
                window.innerWidth -
                width -
                12
            );

        let top =
            Math.min(
                y,
                window.innerHeight -
                height -
                12
            );

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
            left + "px";

        messageMenu.style.top =
            top + "px";
    }

    function closeMessageMenu() {

        messageMenu?.classList.add(
            "hidden"
        );
    }

    /* =====================================================
       MESSAGE MENU ACTIONS
    ===================================================== */

    $("replyMessageBtn")?.addEventListener(
        "click",
        () => {

            if (
                selectedMessageId &&
                selectedMessageData
            ) {

                startReply(
                    selectedMessageId,
                    selectedMessageData
                );
            }
        }
    );

    $("copyMessageBtn")?.addEventListener(
        "click",
        async () => {

            const text =
                selectedMessageData?.text;

            if (!text) {

                showToast(
                    "Nothing to copy.",
                    "warning"
                );

                closeMessageMenu();

                return;
            }

            try {

                await navigator.clipboard.writeText(
                    text
                );

                showToast(
                    "Message copied"
                );

            } catch (error) {

                console.error(
                    error
                );

                showToast(
                    "Copy failed.",
                    "error"
                );
            }

            closeMessageMenu();
        }
    );

    $("reactMessageBtn")?.addEventListener(
        "click",
        () => {

            reactionBar?.classList.remove(
                "hidden"
            );

            closeMessageMenu();
        }
    );

    $("editMessageBtn")?.addEventListener(
        "click",
        editSelectedMessage
    );

    $("deleteMessageBtn")?.addEventListener(
        "click",
        () => {

            deleteModal?.classList.remove(
                "hidden"
            );

            closeMessageMenu();
        }
    );

    $("pinMessageBtn")?.addEventListener(
        "click",
        pinSelectedMessage
    );

    $("infoMessageBtn")?.addEventListener(
        "click",
        showMessageInfo
    );

    /* =====================================================
       REACTIONS
    ===================================================== */

    reactionBar?.querySelectorAll(
        "button"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const emoji =
                        button.textContent
                            .trim();

                    if (
                        selectedMessageId
                    ) {

                        reactToMessage(
                            selectedMessageId,
                            emoji
                        );
                    }

                    reactionBar.classList.add(
                        "hidden"
                    );
                }
            );
        }
    );

    async function reactToMessage(
        messageId,
        emoji
    ) {

        if (
            !currentUser ||
            !chatId
        ) {
            return;
        }

        try {

            const ref =
                db.ref(
                    `chats/${chatId}/messages/${messageId}/reactions/${currentUser.uid}`
                );

            const snapshot =
                await ref.once(
                    "value"
                );

            if (
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
                "REACTION ERROR:",
                error
            );
        }
    }

    /* =====================================================
       EDIT MESSAGE
    ===================================================== */

    async function editSelectedMessage() {

        closeMessageMenu();

        if (
            !selectedMessageId ||
            !selectedMessageData
        ) {
            return;
        }

        if (
            selectedMessageData.uid !==
            currentUser.uid
        ) {

            showToast(
                "You can edit only your messages.",
                "warning"
            );

            return;
        }

        if (
            selectedMessageData.type !==
            "text"
        ) {

            showToast(
                "Only text messages can be edited.",
                "warning"
            );

            return;
        }

        const newText =
            window.prompt(
                "Edit message:",
                selectedMessageData.text ||
                ""
            );

        if (
            newText === null ||
            !newText.trim()
        ) {
            return;
        }

        try {

            const cleanText =
                newText.trim();

            await db
                .ref(
                    `chats/${chatId}/messages/${selectedMessageId}`
                )
                .update({

                    text:
                        cleanText,

                    edited:
                        true,

                    editedAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP
                });

            await db
                .ref(
                    `userChats/${currentUser.uid}/${chatId}/lastMessage`
                )
                .set(
                    cleanText
                );

            await db
                .ref(
                    `userChats/${otherUID}/${chatId}/lastMessage`
                )
                .set(
                    cleanText
                );

            showToast(
                "Message edited"
            );

        } catch (error) {

            console.error(
                "EDIT ERROR:",
                error
            );

            showToast(
                "Unable to edit message.",
                "error"
            );
        }
    }

    /* =====================================================
       PIN
    ===================================================== */

    async function pinSelectedMessage() {

        closeMessageMenu();

        if (!selectedMessageId) {
            return;
        }

        try {

            await db
                .ref(
                    `chats/${chatId}/messages/${selectedMessageId}/pinned`
                )
                .set(true);

            showToast(
                "Message pinned"
            );

        } catch (error) {

            console.error(
                "PIN ERROR:",
                error
            );

            showToast(
                "Unable to pin message.",
                "error"
            );
        }
    }

    /* =====================================================
       MESSAGE INFO
    ===================================================== */

    function showMessageInfo() {

        closeMessageMenu();

        if (
            !selectedMessageData
        ) {
            return;
        }

        if (sentTime) {

            sentTime.textContent =
                formatDateTime(
                    selectedMessageData.createdAt
                );
        }

        if (deliveredTime) {
            deliveredTime.textContent =
                "Delivered";
        }

        if (seenTime) {

            seenTime.textContent =
                selectedMessageData.seen
                    ? "Seen"
                    : "Not seen";
        }

        messageInfoModal?.classList.remove(
            "hidden"
        );
    }

    closeInfoBtn?.addEventListener(
        "click",
        () => {

            messageInfoModal?.classList.add(
                "hidden"
            );
        }
    );

    /* =====================================================
       DELETE FOR ME
    ===================================================== */

    deleteForMeBtn?.addEventListener(
        "click",
        async () => {

            if (!selectedMessageId) {
                return;
            }

            try {

                await db
                    .ref(
                        `chats/${chatId}/messages/${selectedMessageId}/deletedFor/${currentUser.uid}`
                    )
                    .set(true);

                deleteModal?.classList.add(
                    "hidden"
                );

                showToast(
                    "Deleted for you"
                );

            } catch (error) {

                console.error(
                    "DELETE FOR ME:",
                    error
                );

                showToast(
                    "Unable to delete message.",
                    "error"
                );
            }
        }
    );

    /* =====================================================
       DELETE FOR EVERYONE
    ===================================================== */

    deleteForEveryoneBtn?.addEventListener(
        "click",
        async () => {

            if (
                !selectedMessageId ||
                !selectedMessageData
            ) {
                return;
            }

            if (
                selectedMessageData.uid !==
                currentUser.uid
            ) {

                showToast(
                    "You can delete only your messages.",
                    "warning"
                );

                return;
            }

            try {

                await db
                    .ref(
                        `chats/${chatId}/messages/${selectedMessageId}`
                    )
                    .update({

                        deleted:
                            true,

                        text:
                            "Message deleted",

                        url:
                            null,

                        deletedAt:
                            firebase.database
                                .ServerValue
                                .TIMESTAMP
                    });

                deleteModal?.classList.add(
                    "hidden"
                );

                showToast(
                    "Message deleted"
                );

            } catch (error) {

                console.error(
                    "DELETE ERROR:",
                    error
                );

                showToast(
                    "Unable to delete message.",
                    "error"
                );
            }
        }
    );

    cancelDeleteBtn?.addEventListener(
        "click",
        () => {

            deleteModal?.classList.add(
                "hidden"
            );
        }
    );

    /* =====================================================
       SEARCH
    ===================================================== */

    searchBtn?.addEventListener(
        "click",
        () => {

            searchBar?.classList.toggle(
                "hidden"
            );

            if (
                !searchBar?.classList.contains(
                    "hidden"
                )
            ) {

                searchInput?.focus();
            }
        }
    );

    closeSearch?.addEventListener(
        "click",
        () => {

            searchBar?.classList.add(
                "hidden"
            );

            if (searchInput) {
                searchInput.value = "";
            }

            clearMessageSearch();
        }
    );

    searchInput?.addEventListener(
        "input",
        () => {

            const keyword =
                searchInput.value
                    .toLowerCase()
                    .trim();

            document
                .querySelectorAll(
                    ".messageRow"
                )
                .forEach(
                    row => {

                        const text =
                            row.textContent
                                .toLowerCase();

                        row.style.display =
                            !keyword ||
                            text.includes(
                                keyword
                            )
                                ? ""
                                : "none";
                    }
                );
        }
    );

    function clearMessageSearch() {

        document
            .querySelectorAll(
                ".messageRow"
            )
            .forEach(
                row => {
                    row.style.display =
                        "";
                }
            );
    }

    /* =====================================================
       EMOJI
    ===================================================== */

    emojiBtn?.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            emojiPanel?.classList.toggle(
                "hidden"
            );
        }
    );

    emojiPanel?.querySelectorAll(
        "button"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    if (!messageInput) {
                        return;
                    }

                    const start =
                        messageInput.selectionStart ??
                        messageInput.value.length;

                    const end =
                        messageInput.selectionEnd ??
                        start;

                    const value =
                        messageInput.value;

                    const emoji =
                        button.textContent;

                    messageInput.value =
                        value.slice(
                            0,
                            start
                        ) +
                        emoji +
                        value.slice(
                            end
                        );

                    messageInput.focus();

                    const position =
                        start +
                        emoji.length;

                    messageInput.selectionStart =
                        position;

                    messageInput.selectionEnd =
                        position;

                    autoResizeInput();
                }
            );
        }
    );

    /* =====================================================
       ATTACHMENT SHEET
    ===================================================== */

    attachBtn?.addEventListener(
        "click",
        () => {

            if (getBlockedState()) {
                return;
            }

            attachmentSheet?.classList.remove(
                "hidden"
            );
        }
    );

    closeAttachmentBtn?.addEventListener(
        "click",
        closeAttachmentSheet
    );

    document
        .querySelector(
            ".attachmentOverlay"
        )
        ?.addEventListener(
            "click",
            closeAttachmentSheet
        );

    function closeAttachmentSheet() {

        attachmentSheet?.classList.add(
            "hidden"
        );
    }

    /* =====================================================
       MEDIA PICKERS
    ===================================================== */

    galleryBtn?.addEventListener(
        "click",
        () => {

            closeAttachmentSheet();

            imagePicker?.click();
        }
    );

    cameraBtn?.addEventListener(
        "click",
        () => {

            if (getBlockedState()) {
                return;
            }

            cameraPicker?.click();
        }
    );

    cameraAttachmentBtn?.addEventListener(
        "click",
        () => {

            closeAttachmentSheet();

            cameraPicker?.click();
        }
    );

    videoBtn?.addEventListener(
        "click",
        () => {

            closeAttachmentSheet();

            videoPicker?.click();
        }
    );

    audioBtn?.addEventListener(
        "click",
        () => {

            closeAttachmentSheet();

            audioPicker?.click();
        }
    );

    documentBtn?.addEventListener(
        "click",
        () => {

            closeAttachmentSheet();

            documentPicker?.click();
        }
    );

    imagePicker?.addEventListener(
        "change",
        () => {

            prepareMedia(
                imagePicker.files?.[0],
                "image"
            );

            imagePicker.value = "";
        }
    );

    cameraPicker?.addEventListener(
        "change",
        () => {

            prepareMedia(
                cameraPicker.files?.[0],
                "image"
            );

            cameraPicker.value = "";
        }
    );

    videoPicker?.addEventListener(
        "change",
        () => {

            prepareMedia(
                videoPicker.files?.[0],
                "video"
            );

            videoPicker.value = "";
        }
    );

    audioPicker?.addEventListener(
        "change",
        () => {

            prepareMedia(
                audioPicker.files?.[0],
                "audio"
            );

            audioPicker.value = "";
        }
    );

    documentPicker?.addEventListener(
        "change",
        () => {

            prepareMedia(
                documentPicker.files?.[0],
                "file"
            );

            documentPicker.value = "";
        }
    );

    /* =====================================================
       MEDIA PREVIEW
    ===================================================== */

    function prepareMedia(
        file,
        type
    ) {

        if (!file) {
            return;
        }

        if (getBlockedState()) {

            showToast(
                "You blocked this user.",
                "warning"
            );

            return;
        }

        /*
           Basic safety limits.
        */

        const maxImage =
            20 * 1024 * 1024;

        const maxVideo =
            1024 * 1024 * 1024;

        const maxAudio =
            100 * 1024 * 1024;

        const maxFile =
            100 * 1024 * 1024;

        if (
            type === "image" &&
            file.size > maxImage
        ) {

            showToast(
                "Image must be under 20 MB.",
                "warning"
            );

            return;
        }

        if (
            type === "video" &&
            file.size > maxVideo
        ) {

            showToast(
                "Video must be under 1 GB.",
                "warning"
            );

            return;
        }

        if (
            type === "audio" &&
            file.size > maxAudio
        ) {

            showToast(
                "Audio file is too large.",
                "warning"
            );

            return;
        }

        if (
            type === "file" &&
            file.size > maxFile
        ) {

            showToast(
                "File must be under 100 MB.",
                "warning"
            );

            return;
        }

        selectedMediaFile =
            file;

        selectedMediaType =
            type;

        releaseMediaObjectURL();

        hideAllPreviews();

        selectedMediaObjectURL =
            URL.createObjectURL(
                file
            );

        if (
            type === "image" &&
            previewImage
        ) {

            previewImage.src =
                selectedMediaObjectURL;

            previewImage.classList.remove(
                "hidden"
            );
        }

        if (
            type === "video" &&
            previewVideo
        ) {

            previewVideo.src =
                selectedMediaObjectURL;

            previewVideo.classList.remove(
                "hidden"
            );
        }

        if (type === "audio") {

            previewAudioBox?.classList.remove(
                "hidden"
            );

            if (previewAudio) {
                previewAudio.src =
                    selectedMediaObjectURL;
            }

            if (previewAudioName) {
                previewAudioName.textContent =
                    file.name;
            }
        }

        if (type === "file") {

            previewFileBox?.classList.remove(
                "hidden"
            );

            if (previewFileName) {
                previewFileName.textContent =
                    file.name;
            }

            if (previewFileSize) {
                previewFileSize.textContent =
                    formatBytes(
                        file.size
                    );
            }
        }

        if (mediaCaption) {
            mediaCaption.value = "";
        }

        mediaPreviewModal?.classList.remove(
            "hidden"
        );
    }

    function hideAllPreviews() {

        previewImage?.classList.add(
            "hidden"
        );

        previewVideo?.classList.add(
            "hidden"
        );

        previewAudioBox?.classList.add(
            "hidden"
        );

        previewFileBox?.classList.add(
            "hidden"
        );
    }

    function releaseMediaObjectURL() {

        if (
            selectedMediaObjectURL
        ) {

            try {

                URL.revokeObjectURL(
                    selectedMediaObjectURL
                );

            } catch (error) {
                console.warn(error);
            }
        }

        selectedMediaObjectURL =
            null;
    }

    function closeMediaPreview() {

        mediaPreviewModal?.classList.add(
            "hidden"
        );

        if (previewVideo) {
            previewVideo.pause();
            previewVideo.src = "";
        }

        if (previewAudio) {
            previewAudio.pause();
            previewAudio.src = "";
        }

        if (previewImage) {
            previewImage.src = "";
        }

        releaseMediaObjectURL();

        selectedMediaFile =
            null;

        selectedMediaType =
            null;

        hideAllPreviews();
    }

    closePreviewBtn?.addEventListener(
        "click",
        closeMediaPreview
    );

    cancelMediaBtn?.addEventListener(
        "click",
        closeMediaPreview
    );

    /* =====================================================
       CLOUDINARY MEDIA SEND
    ===================================================== */

    sendMediaBtn?.addEventListener(
        "click",
        sendSelectedMedia
    );

    async function sendSelectedMedia() {

        if (
            !selectedMediaFile ||
            !selectedMediaType
        ) {
            return;
        }

        if (getBlockedState()) {

            showToast(
                "You blocked this user.",
                "warning"
            );

            return;
        }

        try {

            const file =
                selectedMediaFile;

            const type =
                selectedMediaType;

            const caption =
                mediaCaption?.value
                    ?.trim() || "";

            closeMediaPreview();

            showUpload(
                file.name
            );

            const result =
                await uploadToCloudinary(
                    file
                );

            if (
                !result ||
                !result.secure_url
            ) {
                throw new Error(
                    "Cloudinary did not return a secure URL."
                );
            }

            const messageRef =
                db
                    .ref(
                        `chats/${chatId}/messages`
                    )
                    .push();

            const message = {

                uid:
                    currentUser.uid,

                username:
                    currentProfile.username ||
                    currentUser.displayName ||
                    "user",

                type:
                    type,

                url:
                    result.secure_url,

                publicId:
                    result.public_id ||
                    "",

                resourceType:
                    result.resource_type ||
                    "",

                fileName:
                    file.name,

                fileSize:
                    file.size,

                caption:
                    caption,

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP,

                seen:
                    false
            };

            addReplyData(
                message
            );

            await messageRef.set(
                message
            );

            await updateChatList(
                getMessagePreview(
                    message
                )
            );

            hideUpload();

            showToast(
                "Media sent"
            );

            scrollToBottom();

        } catch (error) {

            console.error(
                "MEDIA SEND ERROR:",
                error
            );

            hideUpload();

            showToast(
                error?.message ||
                "Media upload failed.",
                "error"
            );
        }
    }

    /* =====================================================
       CLOUDINARY UPLOAD
    ===================================================== */

    function uploadToCloudinary(
        file
    ) {

        return new Promise(
            (resolve, reject) => {

                const xhr =
                    new XMLHttpRequest();

                uploadXHR =
                    xhr;

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

                xhr.open(
                    "POST",
                    CLOUDINARY_UPLOAD_URL,
                    true
                );

                const started =
                    Date.now();

                xhr.upload.onprogress =
                    event => {

                        if (
                            !event.lengthComputable
                        ) {
                            return;
                        }

                        const percent =
                            Math.round(
                                (
                                    event.loaded /
                                    event.total
                                ) *
                                100
                            );

                        const elapsed =
                            (
                                Date.now() -
                                started
                            ) / 1000;

                        const speed =
                            elapsed > 0
                                ? event.loaded /
                                  elapsed
                                : 0;

                        if (uploadProgressBar) {

                            uploadProgressBar.style.width =
                                percent +
                                "%";
                        }

                        if (uploadPercent) {

                            uploadPercent.textContent =
                                percent +
                                "%";
                        }

                        if (uploadSpeed) {

                            uploadSpeed.textContent =
                                formatBytes(
                                    speed
                                ) +
                                "/s";
                        }
                    };

                xhr.onload =
                    () => {

                        uploadXHR =
                            null;

                        if (
                            xhr.status >= 200 &&
                            xhr.status < 300
                        ) {

                            try {

                                const data =
                                    JSON.parse(
                                        xhr.responseText
                                    );

                                resolve(
                                    data
                                );

                            } catch (error) {

                                reject(
                                    new Error(
                                        "Invalid Cloudinary response."
                                    )
                                );
                            }

                        } else {

                            let message =
                                "Cloudinary HTTP " +
                                xhr.status;

                            try {

                                const data =
                                    JSON.parse(
                                        xhr.responseText
                                    );

                                message =
                                    data?.error?.message ||
                                    message;

                            } catch (_) {}

                            reject(
                                new Error(
                                    message
                                )
                            );
                        }
                    };

                xhr.onerror =
                    () => {

                        uploadXHR =
                            null;

                        reject(
                            new Error(
                                "Network error during upload."
                            )
                        );
                    };

                xhr.onabort =
                    () => {

                        uploadXHR =
                            null;

                        reject(
                            new Error(
                                "Upload cancelled."
                            )
                        );
                    };

                xhr.send(
                    formData
                );
            }
        );
    }

    /* =====================================================
       UPLOAD UI
    ===================================================== */

    function showUpload(
        fileName
    ) {

        uploadOverlay?.classList.remove(
            "hidden"
        );

        if (uploadFileName) {
            uploadFileName.textContent =
                fileName;
        }

        if (uploadProgressBar) {
            uploadProgressBar.style.width =
                "0%";
        }

        if (uploadPercent) {
            uploadPercent.textContent =
                "0%";
        }

        if (uploadSpeed) {
            uploadSpeed.textContent =
                "0 B/s";
        }
    }

    function hideUpload() {

        uploadOverlay?.classList.add(
            "hidden"
        );
    }

    cancelUploadBtn?.addEventListener(
        "click",
        () => {

            if (uploadXHR) {
                uploadXHR.abort();
            }

            hideUpload();

            showToast(
                "Upload cancelled",
                "warning"
            );
        }
    );

    /* =====================================================
       CAMERA
    ===================================================== */

    function cameraSupported() {

        return (
            "mediaDevices" in navigator &&
            "getUserMedia" in
                navigator.mediaDevices
        );
    }

    console.log(
        "Camera input:",
        !!cameraPicker,
        "MediaDevices:",
        cameraSupported()
    );

    /* =====================================================
       VOICE RECORDING
    ===================================================== */

    voiceBtn?.addEventListener(
        "click",
        startRecording
    );

    async function startRecording() {

        if (getBlockedState()) {

            showToast(
                "You blocked this user.",
                "warning"
            );

            return;
        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            showToast(
                "Microphone not supported.",
                "error"
            );

            return;
        }

        try {

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            recordedChunks = [];

            let mimeType =
                "audio/webm";

            if (
                window.MediaRecorder &&
                MediaRecorder.isTypeSupported(
                    "audio/webm;codecs=opus"
                )
            ) {

                mimeType =
                    "audio/webm;codecs=opus";
            }

            mediaRecorder =
                new MediaRecorder(
                    stream,
                    {
                        mimeType:
                            mimeType
                    }
                );

            mediaRecorder.ondataavailable =
                event => {

                    if (
                        event.data &&
                        event.data.size
                    ) {

                        recordedChunks.push(
                            event.data
                        );
                    }
                };

            mediaRecorder.onerror =
                event => {

                    console.error(
                        "Recorder error:",
                        event
                    );

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    hideRecording();

                    showToast(
                        "Voice recording failed.",
                        "error"
                    );
                };

            mediaRecorder.onstop =
                async () => {

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    const finalType =
                        mediaRecorder.mimeType ||
                        "audio/webm";

                    const blob =
                        new Blob(
                            recordedChunks,
                            {
                                type:
                                    finalType
                            }
                        );

                    hideRecording();

                    if (
                        blob.size > 0
                    ) {

                        await sendRecordedAudio(
                            blob
                        );
                    }
                };

            mediaRecorder.start();

            recordingSeconds =
                0;

            updateRecordingTime();

            recordingTimer =
                setInterval(
                    () => {

                        recordingSeconds++;

                        updateRecordingTime();

                    },
                    1000
                );

            recordOverlay?.classList.remove(
                "hidden"
            );

        } catch (error) {

            console.error(
                "MIC ERROR:",
                error
            );

            showToast(
                "Microphone permission denied.",
                "error"
            );
        }
    }

    function stopRecording() {

        if (
            mediaRecorder &&
            mediaRecorder.state !==
            "inactive"
        ) {

            mediaRecorder.stop();
        }
    }

    function hideRecording() {

        clearInterval(
            recordingTimer
        );

        recordingTimer =
            null;

        recordOverlay?.classList.add(
            "hidden"
        );
    }

    function updateRecordingTime() {

        const minutes =
            Math.floor(
                recordingSeconds /
                60
            )
                .toString()
                .padStart(
                    2,
                    "0"
                );

        const seconds =
            (
                recordingSeconds %
                60
            )
                .toString()
                .padStart(
                    2,
                    "0"
                );

        if (recordTime) {

            recordTime.textContent =
                minutes +
                ":" +
                seconds;
        }
    }

    stopRecordingBtn?.addEventListener(
        "click",
        stopRecording
    );

    cancelRecordingBtn?.addEventListener(
        "click",
        cancelRecording
    );

    function cancelRecording() {

        clearInterval(
            recordingTimer
        );

        if (
            mediaRecorder &&
            mediaRecorder.state !==
            "inactive"
        ) {

            const recorder =
                mediaRecorder;

            recorder.onstop =
                () => {

                    try {

                        recorder.stream
                            ?.getTracks()
                            .forEach(
                                track =>
                                    track.stop()
                            );

                    } catch (error) {

                        console.warn(
                            error
                        );
                    }
                };

            recorder.stop();

        } else {

            hideRecording();
        }

        recordedChunks = [];

        hideRecording();

        showToast(
            "Recording cancelled",
            "warning"
        );
    }

    async function sendRecordedAudio(
        blob
    ) {

        if (getBlockedState()) {
            return;
        }

        try {

            showUpload(
                "Voice message"
            );

            const file =
                new File(
                    [blob],
                    "voice-message.webm",
                    {
                        type:
                            blob.type ||
                            "audio/webm"
                    }
                );

            const result =
                await uploadToCloudinary(
                    file
                );

            if (
                !result?.secure_url
            ) {
                throw new Error(
                    "Voice upload failed."
                );
            }

            const message = {

                uid:
                    currentUser.uid,

                username:
                    currentProfile.username ||
                    currentUser.displayName ||
                    "user",

                type:
                    "audio",

                url:
                    result.secure_url,

                publicId:
                    result.public_id ||
                    "",

                resourceType:
                    result.resource_type ||
                    "",

                fileName:
                    file.name,

                fileSize:
                    file.size,

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP,

                seen:
                    false
            };

            addReplyData(
                message
            );

            const ref =
                db
                    .ref(
                        `chats/${chatId}/messages`
                    )
                    .push();

            await ref.set(
                message
            );

            await updateChatList(
                "🎵 Voice message"
            );

            hideUpload();

            showToast(
                "Voice message sent"
            );

            scrollToBottom();

        } catch (error) {

            console.error(
                "VOICE SEND ERROR:",
                error
            );

            hideUpload();

            showToast(
                "Voice message failed.",
                "error"
            );
        }
    }

    /* =====================================================
       IMAGE VIEWER
    ===================================================== */

    function openImage(
        url
    ) {

        if (
            !imageViewer ||
            !viewerImage
        ) {
            return;
        }

        viewerImage.src =
            url;

        imageViewer.classList.remove(
            "hidden"
        );
    }

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

    function closeImageViewer() {

        imageViewer?.classList.add(
            "hidden"
        );

        if (viewerImage) {
            viewerImage.src = "";
        }
    }

    /* =====================================================
       VIDEO VIEWER
    ===================================================== */

    function openVideo(
        url
    ) {

        if (
            !videoViewer ||
            !viewerVideo
        ) {
            return;
        }

        viewerVideo.src =
            url;

        videoViewer.classList.remove(
            "hidden"
        );

        viewerVideo.play()
            .catch(
                () => {}
            );
    }

    closeVideoViewerBtn?.addEventListener(
        "click",
        closeVideoViewer
    );

    function closeVideoViewer() {

        videoViewer?.classList.add(
            "hidden"
        );

        if (viewerVideo) {

            viewerVideo.pause();

            viewerVideo.removeAttribute(
                "src"
            );

            viewerVideo.load();
        }
    }

    /* =====================================================
       SCROLL
    ===================================================== */

    function scrollToBottom(
        smooth = true
    ) {

        if (!chatContainer) {
            return;
        }

        chatContainer.scrollTo({

            top:
                chatContainer.scrollHeight,

            behavior:
                smooth
                    ? "smooth"
                    : "auto"
        });
    }

    chatContainer?.addEventListener(
        "scroll",
        () => {

            const distance =
                chatContainer.scrollHeight -
                chatContainer.scrollTop -
                chatContainer.clientHeight;

            scrollBottomBtn?.classList.toggle(
                "hidden",
                distance < 300
            );
        }
    );

    scrollBottomBtn?.addEventListener(
        "click",
        () => {

            scrollToBottom();
        }
    );

    /* =====================================================
       INPUT RESIZE
    ===================================================== */

    function autoResizeInput() {

        if (!messageInput) {
            return;
        }

        messageInput.style.height =
            "auto";

        messageInput.style.height =
            Math.min(
                messageInput.scrollHeight,
                140
            ) +
            "px";
    }

    /* =====================================================
       PROFILE
    ===================================================== */

    profileBtn?.addEventListener(
        "click",
        () => {

            renderOtherUser();

            profileModal?.classList.remove(
                "hidden"
            );
        }
    );

    closeProfileBtn?.addEventListener(
        "click",
        () => {

            profileModal?.classList.add(
                "hidden"
            );
        }
    );

    /* =====================================================
       CHAT MENU
    ===================================================== */

    menuBtn?.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            addSafetyMenuItems();

            chatMenu?.classList.toggle(
                "hidden"
            );
        }
    );

    function closeChatMenu() {

        chatMenu?.classList.add(
            "hidden"
        );
    }

    document.addEventListener(
        "click",
        event => {

            if (
                chatMenu &&
                !chatMenu.contains(
                    event.target
                ) &&
                event.target !== menuBtn
            ) {

                closeChatMenu();
            }

            if (
                messageMenu &&
                !messageMenu.contains(
                    event.target
                )
            ) {

                closeMessageMenu();
            }

            if (
                emojiPanel &&
                !emojiPanel.contains(
                    event.target
                ) &&
                event.target !== emojiBtn
            ) {

                emojiPanel.classList.add(
                    "hidden"
                );
            }
        }
    );

    /* =====================================================
       MUTE
    ===================================================== */

    $("menuMuteBtn")?.addEventListener(
        "click",
        async () => {

            if (
                !currentUser ||
                !chatId
            ) {
                return;
            }

            try {

                const ref =
                    db.ref(
                        `userChats/${currentUser.uid}/${chatId}/muted`
                    );

                const snapshot =
                    await ref.once(
                        "value"
                    );

                const muted =
                    snapshot.val() === true;

                await ref.set(
                    !muted
                );

                showToast(
                    muted
                        ? "Chat unmuted"
                        : "Chat muted"
                );

                closeChatMenu();

            } catch (error) {

                console.error(
                    "MUTE ERROR:",
                    error
                );

                showToast(
                    "Unable to update mute status.",
                    "error"
                );
            }
        }
    );

    /* =====================================================
       DELETE CHAT
    ===================================================== */

    $("menuDeleteChatBtn")?.addEventListener(
        "click",
        async () => {

            const ok =
                window.confirm(
                    "Delete this conversation from your chat list?"
                );

            if (!ok) {
                return;
            }

            try {

                await db
                    .ref(
                        `userChats/${currentUser.uid}/${chatId}`
                    )
                    .remove();

                showToast(
                    "Chat removed"
                );

                setTimeout(
                    () => {

                        location.href =
                            "messages.html";

                    },
                    600
                );

            } catch (error) {

                console.error(
                    "DELETE CHAT:",
                    error
                );

                showToast(
                    "Unable to delete chat.",
                    "error"
                );
            }
        }
    );

    /* =====================================================
       BACK
    ===================================================== */

    backBtn?.addEventListener(
        "click",
        () => {

            if (
                document.referrer
            ) {

                history.back();

            } else {

                location.href =
                    "messages.html";
            }
        }
    );

    /* =====================================================
       CALL BUTTONS
    ===================================================== */

    voiceCallBtn?.addEventListener(
        "click",
        () => {

            showToast(
                "Voice calling is coming soon.",
                "warning"
            );
        }
    );

    videoCallBtn?.addEventListener(
        "click",
        () => {

            showToast(
                "Video calling is coming soon.",
                "warning"
            );
        }
    );

    /* =====================================================
       FORWARD
    ===================================================== */

    $("forwardMessageBtn")?.addEventListener(
        "click",
        () => {

            showToast(
                "Forward system is coming soon.",
                "warning"
            );

            closeMessageMenu();
        }
    );

    /* =====================================================
       FORMAT
    ===================================================== */

    function formatTime(
        timestamp
    ) {

        if (!timestamp) {
            return "";
        }

        return new Date(
            Number(timestamp)
        ).toLocaleTimeString(
            [],
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );
    }

    function formatDateTime(
        timestamp
    ) {

        if (!timestamp) {
            return "--";
        }

        return new Date(
            Number(timestamp)
        ).toLocaleString(
            [],
            {
                dateStyle:
                    "medium",

                timeStyle:
                    "short"
            }
        );
    }

    function formatBytes(
        bytes
    ) {

        if (
            !Number.isFinite(bytes) ||
            bytes <= 0
        ) {

            return "0 B";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        const index =
            Math.min(
                Math.floor(
                    Math.log(bytes) /
                    Math.log(1024)
                ),
                units.length - 1
            );

        const value =
            bytes /
            Math.pow(
                1024,
                index
            );

        return (
            value.toFixed(
                index === 0
                    ? 0
                    : 2
            ) +
            " " +
            units[index]
        );
    }

    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
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

/* =====================================================
   BROWSER NOTIFICATIONS + SOUND
===================================================== */

function setupBrowserNotifications() {

    /*
       Notification API supported nahi hai
       to silently skip.
    */

    if (
        !("Notification" in window)
    ) {
        return;
    }

    /*
       User ke first interaction par permission
       request karenge.
    */

    if (
        Notification.permission ===
        "default"
    ) {

        document.addEventListener(
            "click",
            unlockNotificationSystem,
            {
                once: true
            }
        );
    }

    /*
       Agar permission pehle se granted hai,
       sound system ko unlock karne ki
       koshish karo.
    */

    if (
        Notification.permission ===
        "granted"
    ) {

        unlockNotificationSound();
    }
}


/* =====================================================
   NOTIFICATION PERMISSION
===================================================== */

async function requestNotificationPermission() {

    try {

        if (
            !("Notification" in window)
        ) {
            return;
        }

        if (
            Notification.permission ===
            "default"
        ) {

            const permission =
                await Notification.requestPermission();

            if (
                permission ===
                "granted"
            ) {

                unlockNotificationSound();

                console.log(
                    "Viewora notifications enabled."
                );
            }
        }

    } catch (error) {

        console.warn(
            "Notification permission:",
            error
        );
    }
}


/* =====================================================
   UNLOCK NOTIFICATION SYSTEM
===================================================== */

async function unlockNotificationSystem() {

    try {

        if (
            "Notification" in window &&
            Notification.permission ===
            "default"
        ) {

            const permission =
                await Notification.requestPermission();

            if (
                permission !==
                "granted"
            ) {
                return;
            }
        }

        unlockNotificationSound();

    } catch (error) {

        console.warn(
            "Notification unlock:",
            error
        );
    }
}


/* =====================================================
   NOTIFICATION SOUND
===================================================== */

function unlockNotificationSound() {

    if (notificationUnlocked) {
        return;
    }

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {
            return;
        }

        notificationAudioContext =
            notificationAudioContext ||
            new AudioContext();

        /*
           Browser ke autoplay restriction ko
           user interaction ke waqt unlock karte hain.
        */

        if (
            notificationAudioContext.state ===
            "suspended"
        ) {

            notificationAudioContext
                .resume()
                .catch(
                    () => {}
                );
        }

        notificationUnlocked =
            true;

    } catch (error) {

        console.warn(
            "Notification sound unavailable:",
            error
        );
    }
}


/* =====================================================
   PLAY MESSAGE SOUND
===================================================== */

function playMessageNotificationSound() {

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {
            return;
        }

        notificationAudioContext =
            notificationAudioContext ||
            new AudioContext();

        const ctx =
            notificationAudioContext;

        if (
            ctx.state ===
            "suspended"
        ) {

            ctx.resume()
                .catch(
                    () => {}
                );
        }

        const now =
            ctx.currentTime;

        /*
           Premium two-tone notification sound.
        */

        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();

        oscillator.type =
            "sine";

        oscillator.frequency.setValueAtTime(
            880,
            now
        );

        oscillator.frequency.setValueAtTime(
            1174,
            now + 0.09
        );

        gain.gain.setValueAtTime(
            0.0001,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.16,
            now + 0.015
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.32
        );

        oscillator.connect(
            gain
        );

        gain.connect(
            ctx.destination
        );

        oscillator.start(
            now
        );

        oscillator.stop(
            now + 0.34
        );

    } catch (error) {

        console.warn(
            "Notification sound error:",
            error
        );
    }
}


/* =====================================================
   MESSAGE PREVIEW FOR NOTIFICATION
===================================================== */

function getNotificationPreview(
    message
) {

    if (!message) {
        return "New message";
    }

    if (
        message.deleted
    ) {
        return "Message deleted";
    }

    switch (
        message.type
    ) {

        case "text":
            return (
                message.text ||
                "New message"
            );

        case "image":
            return "📷 Photo";

        case "video":
            return "🎥 Video";

        case "audio":
            return "🎵 Voice message";

        case "file":
            return (
                "📎 " +
                (
                    message.fileName ||
                    "File"
                )
            );

        default:
            return "New message";
    }
}


/* =====================================================
   HANDLE INCOMING MESSAGE
===================================================== */

async function handleIncomingMessageNotification(
    messageId,
    message
) {

    if (
        !currentUser ||
        !message ||
        !messageId
    ) {
        return;
    }

    /*
       Apne message ko ignore karo.
    */

    if (
        message.uid ===
        currentUser.uid
    ) {
        return;
    }

    /*
       Duplicate notification protection.
    */

    if (
        lastNotificationMessageId ===
        messageId
    ) {
        return;
    }

    lastNotificationMessageId =
        messageId;

    /*
       Chat muted hai ya nahi check karo.
    */

    let muted = false;

    try {

        const muteSnapshot =
            await db
                .ref(
                    `userChats/${currentUser.uid}/${chatId}/muted`
                )
                .once(
                    "value"
                );

        muted =
            muteSnapshot.val() === true;

    } catch (error) {

        console.warn(
            "Mute check failed:",
            error
        );
    }

    if (muted) {
        return;
    }

    /*
       Agar user isi chat me actively present hai,
       notification mat dikhao.
    */

    const chatIsActive =
        document.visibilityState ===
            "visible" &&
        document.hasFocus();

    if (chatIsActive) {
        return;
    }

    /*
       Sound
    */

    playMessageNotificationSound();

    /*
       Browser notification
    */

    showIncomingBrowserNotification(
        message
    );
}


/* =====================================================
   SHOW BROWSER NOTIFICATION
===================================================== */

function showIncomingBrowserNotification(
    message
) {

    if (
        !("Notification" in window)
    ) {
        return;
    }

    if (
        Notification.permission !==
        "granted"
    ) {
        return;
    }

    const senderName =
        otherProfile.name ||
        otherProfile.fullName ||
        otherProfile.displayName ||
        otherProfile.username ||
        "Viewora User";

    const preview =
        getNotificationPreview(
            message
        );

    try {

        const notification =
            new Notification(
                senderName,
                {
                    body:
                        preview,

                    icon:
                        otherProfile.profilePhoto ||
                        otherProfile.photoURL ||
                        otherProfile.avatar ||
                        "assets/logo.png",

                    badge:
                        "assets/logo.png",

                    tag:
                        "viewora-chat-" +
                        chatId,

                    renotify:
                        true,

                    silent:
                        true
                }
            );

        /*
           Notification click →
           Viewora chat window active.
        */

        notification.onclick =
            () => {

                window.focus();

                notification.close();
            };

        /*
           Auto close
        */

        setTimeout(
            () => {

                try {
                    notification.close();
                } catch (_) {}

            },
            6000
        );

    } catch (error) {

        console.warn(
            "Browser notification failed:",
            error
        );
    }
}
    /* =====================================================
       CLEANUP
    ===================================================== */

    function cleanup() {

        stopTyping();

        cleanupMessagesListener();

        cleanupOtherUserListener();

        cleanupTypingListener();

        cleanupBlockedListener();

        releaseMediaObjectURL();

        if (uploadXHR) {

            try {
                uploadXHR.abort();
            } catch (_) {}
        }

        if (
            currentUser &&
            currentUser.uid
        ) {

            db.ref(
                `users/${currentUser.uid}`
            )
                .update({

                    online:
                        false,

                    lastSeen:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                })
                .catch(
                    console.error
                );
        }
    }

    window.addEventListener(
        "beforeunload",
        cleanup
    );

    /* =====================================================
       SAFETY TIMEOUT
    ===================================================== */

    setTimeout(
        () => {

            if (!initialized) {

                hideLoading();

                console.warn(
                    "Viewora Chat safety timeout."
                );
            }

        },
        8000
    );

    /* =====================================================
       INITIAL UI
    ===================================================== */

    hideAllPreviews();

    closeChatMenu();

    closeMessageMenu();

    console.log(
        "%cVIEWORA CHAT V3 READY",
        "color:#00e676;font-size:18px;font-weight:800"
    );

})();