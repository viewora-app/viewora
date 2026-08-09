/* =========================================================
   VIEWORA CHAT
   chat.js
   CLEAN + FIREBASE + CLOUDINARY
========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       CONFIG
    ===================================================== */

    const CLOUDINARY_CLOUD_NAME = "z5m6wjdf";
    const CLOUDINARY_UPLOAD_PRESET = "Viewora-upload";

    const CLOUDINARY_UPLOAD_URL =
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

    /* =====================================================
       HELPERS
    ===================================================== */

    const $ = id => document.getElementById(id);

    /* =====================================================
       DOM
    ===================================================== */

    const loadingOverlay = $("loadingOverlay");
    const app = $("app");

    const chatContainer = $("chatContainer");
    const messagesList = $("messagesList");

    const messageInput = $("messageInput");
    const sendBtn = $("sendBtn");

    const attachBtn = $("attachBtn");
    const emojiBtn = $("emojiBtn");

    const emojiPanel = $("emojiPanel");
    const attachmentSheet = $("attachmentSheet");

    const scrollBottomBtn = $("scrollBottomBtn");

    const typingIndicator = $("typingIndicator");

    const replyPreview = $("replyPreview");
    const replyUser = $("replyUser");
    const replyText = $("replyText");
    const closeReplyPreview = $("closeReplyPreview");

    const toast = $("toast");
    const toastText = $("toastText");

    /* =====================================================
       STATE
    ===================================================== */

    let currentUser = null;
    let currentProfile = null;

    let selectedMessage = null;
    let replyingTo = null;

    let messagesRef = null;
    let typingTimeout = null;

    let selectedImage = null;

    /* =====================================================
       SAFE TOAST
    ===================================================== */

    function showToast(message) {

        if (!toast || !toastText) {
            console.log(message);
            return;
        }

        toastText.textContent = message;

        toast.classList.remove("hidden");

        setTimeout(() => {
            toast.classList.add("hidden");
        }, 2500);
    }

    /* =====================================================
       LOADING
    ===================================================== */

    function showApp() {

        if (loadingOverlay) {
            loadingOverlay.classList.add("hidden");
        }

        if (app) {
            app.classList.remove("hidden");
        }
    }

    /*
       IMPORTANT:
       Firebase fail hone par bhi app stuck nahi hoga.
    */

    const loadingSafetyTimer = setTimeout(() => {

        console.warn(
            "Viewora Chat: loading safety timeout"
        );

        showApp();

    }, 5000);

    /* =====================================================
       FIREBASE CHECK
    ===================================================== */

    function firebaseReady() {

        return (
            typeof firebase !== "undefined" &&
            typeof auth !== "undefined" &&
            typeof db !== "undefined"
        );
    }

    if (!firebaseReady()) {

        console.error(
            "Firebase/Auth/Database not available."
        );

        showApp();

        showToast(
            "Firebase not connected."
        );

        clearTimeout(loadingSafetyTimer);

        return;
    }

    /* =====================================================
       CURRENT USER
    ===================================================== */

    auth.onAuthStateChanged(async user => {

        currentUser = user;

        if (!user) {

            console.warn(
                "No authenticated user."
            );

            showApp();

            clearTimeout(
                loadingSafetyTimer
            );

            setHeaderData({
                name: "Guest",
                username: "guest",
                photo: "assets/default-avatar.png",
                online: false
            });

            return;
        }

        try {

            await loadUserProfile(user);

            await loadMessages();

        } catch (error) {

            console.error(
                "Chat initialization error:",
                error
            );

            showToast(
                "Unable to load chat."
            );

        } finally {

            showApp();

            clearTimeout(
                loadingSafetyTimer
            );

            scrollToBottom(false);
        }

    });

    /* =====================================================
       LOAD USER PROFILE
    ===================================================== */

    async function loadUserProfile(user) {

        let profile = {};

        try {

            const snapshot =
                await db
                    .ref("users/" + user.uid)
                    .once("value");

            if (snapshot.exists()) {
                profile = snapshot.val() || {};
            }

        } catch (error) {

            console.error(
                "Profile loading error:",
                error
            );
        }

        currentProfile = profile;

        const username =
            profile.username ||
            profile.userName ||
            profile.handle ||
            user.displayName ||
            "user";

        const name =
            profile.name ||
            profile.fullName ||
            profile.displayName ||
            user.displayName ||
            username;

        const photo =
            profile.profilePhoto ||
            profile.photoURL ||
            profile.avatar ||
            user.photoURL ||
            "assets/default-avatar.png";

        setHeaderData({
            name: name,
            username: username,
            photo: photo,
            online: true
        });

        console.log(
            "Viewora user:",
            username
        );
    }

    /* =====================================================
       HEADER USER DATA
    ===================================================== */

    function setHeaderData(data) {

        const chatName = $("chatName");
        const chatStatus = $("chatStatus");

        const chatPhoto = $("chatPhoto");
        const onlineDot = $("onlineDot");

        const profileImage = $("profileImage");
        const profileName = $("profileName");
        const profileUsername = $("profileUsername");
        const profileStatus = $("profileStatus");

        const typingPhoto = $("typingPhoto");

        if (chatName) {
            chatName.textContent =
                data.name || data.username || "User";
        }

        if (chatStatus) {

            chatStatus.textContent =
                data.online
                    ? "Online"
                    : "Offline";
        }

        if (chatPhoto) {
            chatPhoto.src =
                data.photo ||
                "assets/default-avatar.png";
        }

        if (typingPhoto) {
            typingPhoto.src =
                data.photo ||
                "assets/default-avatar.png";
        }

        if (onlineDot) {

            onlineDot.classList.toggle(
                "hidden",
                !data.online
            );
        }

        if (profileImage) {
            profileImage.src =
                data.photo ||
                "assets/default-avatar.png";
        }

        if (profileName) {
            profileName.textContent =
                data.name || "User";
        }

        if (profileUsername) {

            profileUsername.textContent =
                "@" +
                String(
                    data.username || "user"
                ).replace(/^@/, "");
        }

        if (profileStatus) {

            profileStatus.textContent =
                data.online
                    ? "Online"
                    : "Offline";
        }
    }

    /* =====================================================
       CHAT ID
    ===================================================== */

    function getChatId() {

        /*
          Agar tum URL me ?uid=OTHER_UID bhejte ho
        */

        const params =
            new URLSearchParams(
                window.location.search
            );

        const otherUid =
            params.get("uid") ||
            params.get("userId");

        if (!currentUser) {
            return null;
        }

        if (!otherUid) {

            /*
              Demo / fallback chat
            */

            return "general";
        }

        return [
            currentUser.uid,
            otherUid
        ]
            .sort()
            .join("_");
    }

    /* =====================================================
       LOAD MESSAGES
    ===================================================== */

    async function loadMessages() {

        const chatId =
            getChatId();

        if (!chatId) {
            return;
        }

        if (messagesRef) {
            messagesRef.off();
        }

        messagesRef =
            db
                .ref(
                    "chats/" +
                    chatId +
                    "/messages"
                )
                .limitToLast(100);

        messagesRef.on(
            "value",
            snapshot => {

                if (!messagesList) {
                    return;
                }

                messagesList.innerHTML = "";

                const data =
                    snapshot.val() || {};

                Object.keys(data).forEach(
                    key => {

                        renderMessage(
                            data[key],
                            key
                        );

                    }
                );

                scrollToBottom(false);
            },
            error => {

                console.error(
                    "Messages error:",
                    error
                );

                /*
                  Agar Firebase rules ke wajah se
                  messages read nahi ho pa rahe,
                  app phir bhi open rahega.
                */

                showToast(
                    "Unable to load messages."
                );
            }
        );
    }

    /* =====================================================
       RENDER MESSAGE
    ===================================================== */

    function renderMessage(message, messageId) {

        const isMine =
            currentUser &&
            message.uid === currentUser.uid;

        const row =
            document.createElement("div");

        row.className =
            "messageRow " +
            (isMine ? "sent" : "received");

        row.dataset.messageId =
            messageId;

        const content =
            document.createElement("div");

        content.className =
            "messageContent";

        /* Reply */

        if (message.replyTo) {

            const reply =
                document.createElement("div");

            reply.className =
                "replyPreview";

            reply.innerHTML = `
                <strong>
                    ${escapeHTML(
                        message.replyTo.username ||
                        "Reply"
                    )}
                </strong>

                <small>
                    ${escapeHTML(
                        message.replyTo.text ||
                        "[Media]"
                    )}
                </small>
            `;

            content.appendChild(reply);
        }

        /* Media */

        if (message.type === "image") {

            const bubble =
                document.createElement("div");

            bubble.className =
                "imageBubble";

            const img =
                document.createElement("img");

            img.className =
                "chatImage";

            img.src =
                message.url;

            img.alt =
                "Image";

            img.loading =
                "lazy";

            bubble.appendChild(img);

            content.appendChild(
                bubble
            );
        }

        else if (
            message.type === "video"
        ) {

            const bubble =
                document.createElement("div");

            bubble.className =
                "mediaBubble";

            const video =
                document.createElement("video");

            video.src =
                message.url;

            video.controls =
                true;

            video.preload =
                "metadata";

            video.className =
                "chatVideo";

            bubble.appendChild(
                video
            );

            content.appendChild(
                bubble
            );
        }

        else if (
            message.type === "audio"
        ) {

            const bubble =
                document.createElement("div");

            bubble.className =
                "audioBubble";

            const audio =
                document.createElement("audio");

            audio.src =
                message.url;

            audio.controls =
                true;

            audio.preload =
                "metadata";

            bubble.appendChild(
                audio
            );

            content.appendChild(
                bubble
            );
        }

        /* Text */

        if (
            message.text &&
            message.type === "text"
        ) {

            const bubble =
                document.createElement("div");

            bubble.className =
                "messageBubble";

            bubble.textContent =
                message.text;

            content.appendChild(
                bubble
            );
        }

        /* Caption */

        if (
            message.caption
        ) {

            const caption =
                document.createElement("div");

            caption.className =
                "imageCaption";

            caption.textContent =
                message.caption;

            content.appendChild(
                caption
            );
        }

        /* Meta */

        const meta =
            document.createElement("div");

        meta.className =
            "messageMeta";

        const time =
            document.createElement("span");

        time.textContent =
            formatTime(
                message.createdAt
            );

        meta.appendChild(time);

        if (isMine) {

            const check =
                document.createElement("i");

            check.className =
                "fa-solid fa-check";

            meta.appendChild(check);
        }

        content.appendChild(meta);

        /* Reactions */

        if (
            message.reactions
        ) {

            const reactions =
                document.createElement("div");

            reactions.className =
                "messageReactions";

            Object.values(
                message.reactions
            ).forEach(reaction => {

                const span =
                    document.createElement("span");

                span.textContent =
                    reaction;

                reactions.appendChild(
                    span
                );
            });

            content.appendChild(
                reactions
            );
        }

        row.appendChild(content);

        messagesList.appendChild(row);

        enableMessageActions(row);
    }

    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =====================================================
       TIME
    ===================================================== */

    function formatTime(timestamp) {

        if (!timestamp) {
            return getCurrentTime();
        }

        return new Date(
            timestamp
        ).toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function getCurrentTime() {

        return new Date()
            .toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );
    }

    /* =====================================================
       SEND TEXT MESSAGE
    ===================================================== */

    sendBtn?.addEventListener(
        "click",
        sendMessage
    );

    messageInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );

    async function sendMessage() {

        const text =
            messageInput?.value.trim();

        if (!text) {
            return;
        }

        if (!currentUser) {

            showToast(
                "Please login first."
            );

            return;
        }

        const chatId =
            getChatId();

        if (!chatId) {
            return;
        }

        const messageRef =
            db
                .ref(
                    `chats/${chatId}/messages`
                )
                .push();

        const data = {

            uid:
                currentUser.uid,

            type:
                "text",

            text:
                text,

            username:
                currentProfile?.username ||
                currentUser.displayName ||
                "user",

            createdAt:
                firebase.database
                    .ServerValue
                    .TIMESTAMP
        };

        if (replyingTo) {

            data.replyTo = {

                username:
                    replyUser?.textContent ||
                    "Reply",

                text:
                    replyText?.textContent ||
                    ""
            };
        }

        try {

            await messageRef.set(
                data
            );

            messageInput.value = "";

            messageInput.style.height =
                "24px";

            cancelReply();

            scrollToBottom();

        } catch (error) {

            console.error(
                "Send message error:",
                error
            );

            showToast(
                "Message could not be sent."
            );
        }
    }

    /* =====================================================
       AUTO RESIZE
    ===================================================== */

    messageInput?.addEventListener(
        "input",
        () => {

            messageInput.style.height =
                "24px";

            messageInput.style.height =
                messageInput.scrollHeight +
                "px";

            clearTimeout(
                typingTimeout
            );

            typingIndicator?.classList.remove(
                "hidden"
            );

            typingTimeout =
                setTimeout(() => {

                    typingIndicator?.classList.add(
                        "hidden"
                    );

                }, 1200);
        }
    );

    /* =====================================================
       SCROLL
    ===================================================== */

    function scrollToBottom(smooth = true) {

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
                distance <= 250
            );
        }
    );

    scrollBottomBtn?.addEventListener(
        "click",
        () => scrollToBottom()
    );

    /* =====================================================
       EMOJI
    ===================================================== */

    emojiBtn?.addEventListener(
        "click",
        () => {

            emojiPanel?.classList.toggle(
                "hidden"
            );

            attachmentSheet?.classList.add(
                "hidden"
            );
        }
    );

    document
        .querySelectorAll(
            "#emojiPanel .emojiGrid span"
        )
        .forEach(emoji => {

            emoji.addEventListener(
                "click",
                () => {

                    if (!messageInput) {
                        return;
                    }

                    messageInput.value +=
                        emoji.textContent;

                    messageInput.focus();

                    messageInput.dispatchEvent(
                        new Event("input")
                    );
                }
            );
        });

    /* =====================================================
       ATTACHMENT SHEET
    ===================================================== */

    attachBtn?.addEventListener(
        "click",
        () => {

            attachmentSheet?.classList.toggle(
                "hidden"
            );

            emojiPanel?.classList.add(
                "hidden"
            );
        }
    );

    document
        .querySelector(
            ".attachmentOverlay"
        )
        ?.addEventListener(
            "click",
            () => {

                attachmentSheet?.classList.add(
                    "hidden"
                );
            }
        );

    /* =====================================================
       FILE PICKERS
    ===================================================== */

    const imagePicker =
        $("imagePicker");

    const videoPicker =
        $("videoPicker");

    const audioPicker =
        $("audioPicker");

    $("galleryBtn")?.addEventListener(
        "click",
        () => imagePicker?.click()
    );

    $("cameraAttachmentBtn")?.addEventListener(
        "click",
        () => imagePicker?.click()
    );

    $("videoBtn")?.addEventListener(
        "click",
        () => videoPicker?.click()
    );

    $("audioBtn")?.addEventListener(
        "click",
        () => audioPicker?.click()
    );

    /* =====================================================
       CLOUDINARY UPLOAD
    ===================================================== */

    async function uploadToCloudinary(file) {

        if (!file) {
            throw new Error(
                "No file selected."
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

        const response =
            await fetch(
                CLOUDINARY_UPLOAD_URL,
                {
                    method: "POST",
                    body: formData
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result?.error?.message ||
                "Cloudinary upload failed."
            );
        }

        return result;
    }

    /* =====================================================
       SEND MEDIA
    ===================================================== */

    async function handleMediaFile(
        file,
        type
    ) {

        if (!file) {
            return;
        }

        if (!currentUser) {

            showToast(
                "Please login first."
            );

            return;
        }

        try {

            attachmentSheet?.classList.add(
                "hidden"
            );

            showToast(
                "Uploading..."
            );

            const result =
                await uploadToCloudinary(
                    file
                );

            const chatId =
                getChatId();

            const ref =
                db
                    .ref(
                        `chats/${chatId}/messages`
                    )
                    .push();

            await ref.set({

                uid:
                    currentUser.uid,

                username:
                    currentProfile?.username ||
                    currentUser.displayName ||
                    "user",

                type:
                    type,

                url:
                    result.secure_url,

                publicId:
                    result.public_id,

                resourceType:
                    result.resource_type,

                format:
                    result.format || "",

                width:
                    result.width || null,

                height:
                    result.height || null,

                duration:
                    result.duration || null,

                fileName:
                    file.name,

                fileSize:
                    file.size,

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP
            });

            showToast(
                "Sent successfully ✓"
            );

            scrollToBottom();

        } catch (error) {

            console.error(
                "Media upload error:",
                error
            );

            showToast(
                error.message ||
                "Upload failed."
            );
        }
    }

    /* =====================================================
       IMAGE
    ===================================================== */

    imagePicker?.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }

            await handleMediaFile(
                file,
                "image"
            );

            imagePicker.value = "";
        }
    );

    /* =====================================================
       VIDEO
    ===================================================== */

    videoPicker?.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }

            await handleMediaFile(
                file,
                "video"
            );

            videoPicker.value = "";
        }
    );

    /* =====================================================
       AUDIO
    ===================================================== */

    audioPicker?.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }

            await handleMediaFile(
                file,
                "audio"
            );

            audioPicker.value = "";
        }
    );

    /* =====================================================
       IMAGE VIEWER
    ===================================================== */

    const imageViewer =
        $("imageViewer");

    const viewerImage =
        $("viewerImage");

    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.classList.contains(
                    "chatImage"
                )
            ) {
                return;
            }

            if (viewerImage) {
                viewerImage.src =
                    event.target.src;
            }

            imageViewer?.classList.remove(
                "hidden"
            );
        }
    );

    $("closeViewerBtn")?.addEventListener(
        "click",
        () => {

            imageViewer?.classList.add(
                "hidden"
            );
        }
    );

    /* =====================================================
       LONG PRESS / CONTEXT MENU
    ===================================================== */

    function enableMessageActions(message) {

        let timer = null;

        message.addEventListener(
            "touchstart",
            () => {

                timer =
                    setTimeout(() => {

                        openMessageMenu(
                            message
                        );

                    }, 500);
            }
        );

        message.addEventListener(
            "touchend",
            () => {

                clearTimeout(timer);
            }
        );

        message.addEventListener(
            "contextmenu",
            event => {

                event.preventDefault();

                openMessageMenu(
                    message
                );
            }
        );
    }

    function openMessageMenu(message) {

        selectedMessage =
            message;

        $("messageMenu")
            ?.classList.remove(
                "hidden"
            );

        $("reactionBar")
            ?.classList.remove(
                "hidden"
            );
    }

    /* =====================================================
       CLOSE MESSAGE MENU
    ===================================================== */

    document.addEventListener(
        "click",
        event => {

            const menu =
                $("messageMenu");

            const reaction =
                $("reactionBar");

            if (
                menu &&
                !menu.contains(
                    event.target
                )
            ) {

                menu.classList.add(
                    "hidden"
                );

                reaction?.classList.add(
                    "hidden"
                );
            }
        }
    );

    /* =====================================================
       REPLY
    ===================================================== */

    $("replyMessageBtn")?.addEventListener(
        "click",
        () => {

            if (!selectedMessage) {
                return;
            }

            const bubble =
                selectedMessage.querySelector(
                    ".messageBubble"
                );

            const text =
                bubble?.innerText ||
                "[Media]";

            if (replyUser) {
                replyUser.textContent =
                    "Reply";
            }

            if (replyText) {
                replyText.textContent =
                    text;
            }

            replyPreview?.classList.remove(
                "hidden"
            );

            replyingTo =
                true;

            messageInput?.focus();

            closeMessageMenu();
        }
    );

    function cancelReply() {

        replyingTo =
            null;

        replyPreview?.classList.add(
            "hidden"
        );
    }

    closeReplyPreview?.addEventListener(
        "click",
        cancelReply
    );

    /* =====================================================
       COPY
    ===================================================== */

    $("copyMessageBtn")?.addEventListener(
        "click",
        async () => {

            if (!selectedMessage) {
                return;
            }

            const bubble =
                selectedMessage.querySelector(
                    ".messageBubble"
                );

            if (!bubble) {
                return;
            }

            try {

                await navigator.clipboard.writeText(
                    bubble.innerText
                );

                showToast(
                    "Message copied"
                );

            } catch {

                showToast(
                    "Copy failed"
                );
            }

            closeMessageMenu();
        }
    );

    /* =====================================================
       EDIT
    ===================================================== */

    $("editMessageBtn")?.addEventListener(
        "click",
        async () => {

            if (!selectedMessage) {
                return;
            }

            const id =
                selectedMessage.dataset.messageId;

            const bubble =
                selectedMessage.querySelector(
                    ".messageBubble"
                );

            if (!bubble || !id) {
                return;
            }

            const value =
                prompt(
                    "Edit message",
                    bubble.innerText
                );

            if (
                value === null ||
                !value.trim()
            ) {
                return;
            }

            const chatId =
                getChatId();

            await db
                .ref(
                    `chats/${chatId}/messages/${id}/text`
                )
                .set(
                    value.trim()
                );

            await db
                .ref(
                    `chats/${chatId}/messages/${id}/edited`
                )
                .set(true);

            closeMessageMenu();
        }
    );

    /* =====================================================
       DELETE
    ===================================================== */

    $("deleteMessageBtn")?.addEventListener(
        "click",
        () => {

            if (!selectedMessage) {
                return;
            }

            $("deleteModal")
                ?.classList.remove(
                    "hidden"
                );

            closeMessageMenu();
        }
    );

    $("cancelDeleteBtn")?.addEventListener(
        "click",
        () => {

            $("deleteModal")
                ?.classList.add(
                    "hidden"
                );
        }
    );

    $("deleteForMeBtn")?.addEventListener(
        "click",
        async () => {

            await deleteSelectedMessage();

            $("deleteModal")
                ?.classList.add(
                    "hidden"
                );
        }
    );

    $("deleteForEveryoneBtn")?.addEventListener(
        "click",
        async () => {

            if (!selectedMessage) {
                return;
            }

            const id =
                selectedMessage.dataset.messageId;

            const chatId =
                getChatId();

            await db
                .ref(
                    `chats/${chatId}/messages/${id}`
                )
                .update({

                    type: "text",

                    text:
                        "This message was deleted",

                    deleted: true,

                    url: null
                });

            $("deleteModal")
                ?.classList.add(
                    "hidden"
                );

            showToast(
                "Deleted for everyone"
            );
        }
    );

    async function deleteSelectedMessage() {

        if (!selectedMessage) {
            return;
        }

        const id =
            selectedMessage.dataset.messageId;

        if (!id) {
            return;
        }

        const chatId =
            getChatId();

        try {

            await db
                .ref(
                    `chats/${chatId}/messages/${id}`
                )
                .remove();

            showToast(
                "Message deleted"
            );

        } catch (error) {

            console.error(
                error
            );

            showToast(
                "Delete failed"
            );
        }
    }

    /* =====================================================
       REACTIONS
    ===================================================== */

    document
        .querySelectorAll(
            "#reactionBar span"
        )
        .forEach(emoji => {

            emoji.addEventListener(
                "click",
                async () => {

                    if (
                        !selectedMessage ||
                        !currentUser
                    ) {
                        return;
                    }

                    const id =
                        selectedMessage.dataset.messageId;

                    const chatId =
                        getChatId();

                    await db
                        .ref(
                            `chats/${chatId}/messages/${id}/reactions/${currentUser.uid}`
                        )
                        .set(
                            emoji.textContent
                        );

                    closeMessageMenu();
                }
            );
        });

    /* =====================================================
       PIN
    ===================================================== */

    $("pinMessageBtn")?.addEventListener(
        "click",
        async () => {

            if (!selectedMessage) {
                return;
            }

            const id =
                selectedMessage.dataset.messageId;

            const chatId =
                getChatId();

            await db
                .ref(
                    `chats/${chatId}/messages/${id}/pinned`
                )
                .set(true);

            showToast(
                "Message pinned"
            );

            closeMessageMenu();
        }
    );

    /* =====================================================
       MESSAGE INFO
    ===================================================== */

    $("infoMessageBtn")?.addEventListener(
        "click",
        () => {

            const now =
                getCurrentTime();

            $("sentTime").textContent =
                now;

            $("deliveredTime").textContent =
                now;

            $("seenTime").textContent =
                now;

            $("messageInfoModal")
                ?.classList.remove(
                    "hidden"
                );

            closeMessageMenu();
        }
    );

    $("closeInfoBtn")?.addEventListener(
        "click",
        () => {

            $("messageInfoModal")
                ?.classList.add(
                    "hidden"
                );
        }
    );

    /* =====================================================
       PROFILE
    ===================================================== */

    $("profileBtn")?.addEventListener(
        "click",
        () => {

            $("profileModal")
                ?.classList.remove(
                    "hidden"
                );
        }
    );

    $("closeProfileBtn")?.addEventListener(
        "click",
        () => {

            $("profileModal")
                ?.classList.add(
                    "hidden"
                );
        }
    );

    /* =====================================================
       SEARCH
    ===================================================== */

    $("searchBtn")?.addEventListener(
        "click",
        () => {

            $("searchBar")
                ?.classList.remove(
                    "hidden"
                );

            $("searchInput")?.focus();
        }
    );

    $("closeSearch")?.addEventListener(
        "click",
        () => {

            $("searchBar")
                ?.classList.add(
                    "hidden"
                );

            if ($("searchInput")) {
                $("searchInput").value = "";
            }

            filterMessages("");
        }
    );

    $("searchInput")?.addEventListener(
        "input",
        event => {

            filterMessages(
                event.target.value
            );
        }
    );

    function filterMessages(value) {

        const search =
            value.toLowerCase().trim();

        document
            .querySelectorAll(
                ".messageRow"
            )
            .forEach(row => {

                row.style.display =
                    !search ||
                    row.innerText
                        .toLowerCase()
                        .includes(search)
                        ? ""
                        : "none";
            });
    }

    /* =====================================================
       CALLS
    ===================================================== */

    $("voiceCallBtn")?.addEventListener(
        "click",
        () => {

            showToast(
                "Voice calling coming soon."
            );
        }
    );

    $("videoCallBtn")?.addEventListener(
        "click",
        () => {

            showToast(
                "Video calling coming soon."
            );
        }
    );

    /* =====================================================
       VOICE RECORD UI
    ===================================================== */

    $("voiceBtn")?.addEventListener(
        "click",
        () => {

            $("recordOverlay")
                ?.classList.remove(
                    "hidden"
                );
        }
    );

    $("stopRecordingBtn")?.addEventListener(
        "click",
        () => {

            $("recordOverlay")
                ?.classList.add(
                    "hidden"
                );

            showToast(
                "Voice recording stopped."
            );
        }
    );

    /* =====================================================
       CLOSE MESSAGE MENU
    ===================================================== */

    function closeMessageMenu() {

        $("messageMenu")
            ?.classList.add(
                "hidden"
            );

        $("reactionBar")
            ?.classList.add(
                "hidden"
            );
    }

    /* =====================================================
       INITIAL
    ===================================================== */

    console.log(
        "================================="
    );

    console.log(
        "Viewora Chat initialized."
    );

    console.log(
        "Cloudinary:",
        CLOUDINARY_CLOUD_NAME
    );

    console.log(
        "================================="
    );

});