"use strict";

/* =========================================================
   VIEWORA MESSAGES — PREMIUM V3
   Realtime • Search • Unread • Long Press Actions
========================================================= */

console.log(
    "%cVIEWORA • MESSAGES V3",
    "color:#00e5ff;font-size:18px;font-weight:800"
);


/* =========================================================
   FIREBASE CHECK
========================================================= */

if (typeof firebase === "undefined") {
    throw new Error("Firebase SDK Not Loaded");
}

if (typeof auth === "undefined") {
    throw new Error("Firebase Auth Missing");
}

if (typeof db === "undefined") {
    throw new Error("Firebase Database Missing");
}


/* =========================================================
   STATE
========================================================= */

let messagesUser = null;
let messagesUID = null;
let messagesUserData = {};

let messagesChats = [];
let messagesFilter = "all";

let messagesInitialized = false;

let messagesChatsRef = null;
let messagesChatsValueListener = null;

let messagesToastTimer = null;

let longPressTimer = null;
let longPressTriggered = false;
let activeActionChat = null;

const LONG_PRESS_TIME = 550;


/* =========================================================
   DOM
========================================================= */

const messagesLoading =
    document.getElementById("loadingOverlay");

const messagesApp =
    document.getElementById("app");

const messagesChatList =
    document.getElementById("chatList");

const messagesSkeleton =
    document.getElementById("chatSkeleton");

const messagesEmpty =
    document.getElementById("emptyChats");

const messagesSearch =
    document.getElementById("searchInput");

const messagesClearSearch =
    document.getElementById("clearSearch");

const messagesUnreadBadge =
    document.getElementById("unreadBadge");

const messagesChatCount =
    document.getElementById("chatCount");

const messagesConnection =
    document.getElementById("connectionStatus");

const messagesRefresh =
    document.getElementById("refreshBtn");

const messagesNewChat =
    document.getElementById("newChatBtn");

const messagesFab =
    document.getElementById("newMessageFab");

const messagesStartChat =
    document.getElementById("startChatBtn");

const messagesModal =
    document.getElementById("newChatModal");

const messagesModalBackdrop =
    document.getElementById("newChatBackdrop");

const messagesModalClose =
    document.getElementById("closeNewChat");

const messagesUserSearch =
    document.getElementById("newChatSearch");

const messagesUserList =
    document.getElementById("newChatUserList");

const messagesUsersLoading =
    document.getElementById("usersLoading");

const messagesEmptyUsers =
    document.getElementById("emptyUsers");


/* =========================================================
   LOADING
========================================================= */

function messagesShowLoading() {

    if (messagesLoading) {
        messagesLoading.classList.remove("hidden");
    }

}

function messagesHideLoading() {

    if (messagesLoading) {
        messagesLoading.classList.add("hidden");
    }

}

function messagesShowSkeleton() {

    if (messagesSkeleton) {
        messagesSkeleton.classList.remove("hidden");
    }

}

function messagesHideSkeleton() {

    if (messagesSkeleton) {
        messagesSkeleton.classList.add("hidden");
    }

}


/* =========================================================
   TOAST
========================================================= */

function messagesToast(text, type = "success") {

    const toast =
        document.getElementById("toast");

    const toastText =
        document.getElementById("toastText");

    const toastIcon =
        toast
            ? toast.querySelector(".toastIcon i")
            : null;

    if (!toast || !toastText) {
        return;
    }

    toastText.textContent = text || "";

    if (toastIcon) {

        toastIcon.className =
            type === "error"
                ? "fa-solid fa-triangle-exclamation"
                : type === "warning"
                    ? "fa-solid fa-circle-exclamation"
                    : "fa-solid fa-check";

    }

    toast.classList.remove("hidden");

    clearTimeout(messagesToastTimer);

    messagesToastTimer =
        setTimeout(function () {

            toast.classList.add("hidden");

        }, 2400);

}


/* =========================================================
   CONNECTION
========================================================= */

function messagesUpdateConnection() {

    if (!messagesConnection) {
        return;
    }

    messagesConnection.textContent =
        navigator.onLine
            ? "🟢 Online"
            : "🔴 Offline";

}

window.addEventListener(
    "online",
    messagesUpdateConnection
);

window.addEventListener(
    "offline",
    messagesUpdateConnection
);


/* =========================================================
   FIREBASE CONNECTION
========================================================= */

function messagesListenConnection() {

    db.ref(".info/connected").on(
        "value",
        function(snapshot) {

            if (!messagesConnection) {
                return;
            }

            if (snapshot.val() === true) {

                messagesConnection.textContent =
                    "🟢 Connected";

            } else {

                messagesConnection.textContent =
                    "🔴 Reconnecting...";

            }

        }
    );

}


/* =========================================================
   AUTH
========================================================= */

auth.onAuthStateChanged(
    async function(user) {

        if (!user) {

            location.replace("login.html");

            return;
        }

        messagesUser = user;
        messagesUID = user.uid;

        messagesUpdateConnection();

        await messagesInitialize();

    }
);


/* =========================================================
   INITIALIZE
========================================================= */

async function messagesInitialize() {

    if (messagesInitialized) {
        return;
    }

    messagesShowLoading();
    messagesShowSkeleton();

    try {

        await messagesLoadUser();

        messagesListenConnection();
        messagesListenChats();

        if (messagesApp) {
            messagesApp.classList.remove("hidden");
        }

        messagesInitialized = true;

        console.log(
            "%cVIEWORA MESSAGES READY",
            "color:#00e676;font-size:18px;font-weight:800"
        );

    } catch (error) {

        console.error(
            "MESSAGES INITIALIZATION ERROR:",
            error
        );

        // IMPORTANT:
        // Allow initialization to retry after failure.
        messagesInitialized = false;

        messagesToast(
            "Unable to load messages",
            "error"
        );

        if (messagesApp) {
            messagesApp.classList.remove("hidden");
        }

    } finally {

        messagesHideSkeleton();
        messagesHideLoading();

    }

}


/* =========================================================
   LOAD CURRENT USER
========================================================= */

async function messagesLoadUser() {

    if (!messagesUID) {
        throw new Error("Current UID Missing");
    }

    const userRef =
        db.ref("users/" + messagesUID);

    const snapshot =
        await userRef.once("value");

    messagesUserData =
        snapshot.exists()
            ? snapshot.val() || {}
            : {};

    userRef.update({

        online: true,

        lastSeen:
            firebase.database.ServerValue.TIMESTAMP

    }).catch(function(error) {

        console.warn(
            "Online update failed:",
            error
        );

    });

    userRef.onDisconnect().update({

        online: false,

        lastSeen:
            firebase.database.ServerValue.TIMESTAMP

    }).catch(function(error) {

        console.warn(
            "Disconnect update failed:",
            error
        );

    });

}


/* =========================================================
   REALTIME CHATS
========================================================= */

function messagesListenChats() {

    if (!messagesUID) {
        return;
    }

    messagesRemoveChatListener();

    messagesChatsRef =
        db.ref(
            "userChats/" +
            messagesUID
        );

    messagesChatsValueListener =
        function(snapshot) {

            const newChats = [];

            if (snapshot.exists()) {

                snapshot.forEach(
                    function(child) {

                        const chat =
                            child.val() || {};

                        chat.chatId =
                            child.key;

                        newChats.push(chat);

                    }
                );

            }

            messagesChats = newChats;

            messagesSortChats();

            messagesUpdateUnread();

            messagesRender();

        };

    messagesChatsRef.on(
        "value",
        messagesChatsValueListener
    );

}


/* =========================================================
   REMOVE LISTENER
========================================================= */

function messagesRemoveChatListener() {

    if (
        messagesChatsRef &&
        messagesChatsValueListener
    ) {

        messagesChatsRef.off(
            "value",
            messagesChatsValueListener
        );

    }

    messagesChatsRef = null;
    messagesChatsValueListener = null;

}


/* =========================================================
   SORT
========================================================= */

function messagesSortChats() {

    messagesChats.sort(
        function(a, b) {

            /*
             * Pinned chats first
             */

            if (
                a.pinned === true &&
                b.pinned !== true
            ) {
                return -1;
            }

            if (
                b.pinned === true &&
                a.pinned !== true
            ) {
                return 1;
            }

            return (
                Number(b.lastMessageTime || 0) -
                Number(a.lastMessageTime || 0)
            );

        }
    );

}


/* =========================================================
   UNREAD
========================================================= */

function messagesUpdateUnread() {

    let totalUnread = 0;

    messagesChats.forEach(
        function(chat) {

            if (chat.muted === true) {
                return;
            }

            totalUnread +=
                Number(chat.unread || 0);

        }
    );

    if (messagesUnreadBadge) {

        if (totalUnread > 0) {

            messagesUnreadBadge.textContent =
                totalUnread > 99
                    ? "99+"
                    : String(totalUnread);

            messagesUnreadBadge.classList.remove(
                "hidden"
            );

        } else {

            messagesUnreadBadge.classList.add(
                "hidden"
            );

        }

    }

    const globalBadge =
        document.getElementById(
            "messageBadge"
        );

    if (globalBadge) {

        if (totalUnread > 0) {

            globalBadge.textContent =
                totalUnread > 99
                    ? "99+"
                    : String(totalUnread);

            globalBadge.classList.remove(
                "hidden"
            );

        } else {

            globalBadge.classList.add(
                "hidden"
            );

        }

    }

}


/* =========================================================
   FILTER
========================================================= */

function messagesGetFilteredChats() {

    let result =
        messagesChats.slice();

    const keyword =
        messagesSearch
            ? messagesSearch.value
                .toLowerCase()
                .trim()
            : "";

    if (keyword) {

        result =
            result.filter(
                function(chat) {

                    const name =
                        String(
                            chat.name || ""
                        ).toLowerCase();

                    const username =
                        String(
                            chat.username || ""
                        ).toLowerCase();

                    const lastMessage =
                        String(
                            chat.lastMessage || ""
                        ).toLowerCase();

                    return (
                        name.includes(keyword) ||
                        username.includes(keyword) ||
                        lastMessage.includes(keyword)
                    );

                }
            );

    }

    if (messagesFilter === "unread") {

        result =
            result.filter(
                function(chat) {

                    return Number(
                        chat.unread || 0
                    ) > 0;

                }
            );

    }

    if (messagesFilter === "online") {

        result =
            result.filter(
                function(chat) {

                    return chat.online === true;

                }
            );

    }

    if (messagesFilter === "pinned") {

        result =
            result.filter(
                function(chat) {

                    return chat.pinned === true;

                }
            );

    }

    return result;

}


/* =========================================================
   ESCAPE
========================================================= */

function messagesEscape(value) {

    return String(
        value == null ? "" : value
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   TIME
========================================================= */

function messagesTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    const date =
        new Date(Number(timestamp));

    if (isNaN(date.getTime())) {
        return "";
    }

    const now =
        new Date();

    if (
        date.toDateString() ===
        now.toDateString()
    ) {

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }

    return date.toLocaleDateString(
        [],
        {
            day: "2-digit",
            month: "short"
        }
    );

}


/* =========================================================
   RENDER
========================================================= */

function messagesRender() {

    if (!messagesChatList) {
        return;
    }

    const result =
        messagesGetFilteredChats();

    messagesChatList.innerHTML = "";

    if (messagesChatCount) {

        messagesChatCount.textContent =
            messagesChats.length;

    }

    if (result.length === 0) {

        messagesChatList.classList.add(
            "hidden"
        );

        if (messagesEmpty) {
            messagesEmpty.classList.remove(
                "hidden"
            );
        }

        return;

    }

    if (messagesEmpty) {

        messagesEmpty.classList.add(
            "hidden"
        );

    }

    messagesChatList.classList.remove(
        "hidden"
    );

    result.forEach(
        function(chat) {

            messagesChatList.appendChild(
                messagesCreateCard(chat)
            );

        }
    );

}


/* =========================================================
   CHAT CARD
========================================================= */

function messagesCreateCard(chat) {

    const card =
        document.createElement("div");

    card.className = "chatCard";

    card.dataset.chatid =
        chat.chatId || "";

    card.dataset.userid =
        chat.userId || "";

    const name =
        messagesEscape(
            chat.name || "Unknown User"
        );

    const photo =
        chat.photoURL ||
        chat.profilePhoto ||
        "assets/default-avatar.png";

    const preview =
        messagesEscape(
            chat.lastMessage ||
            "Start chatting..."
        );

    const unread =
        Number(chat.unread || 0);

    const muted =
        chat.muted === true;

    const pinned =
        chat.pinned === true;

    const unreadHTML =
        unread > 0
            ? `
                <div class="unreadBadge">
                    ${
                        unread > 99
                            ? "99+"
                            : unread
                    }
                </div>
              `
            : "";

    const onlineHTML =
        chat.online === true
            ? `<span class="onlineDot"></span>`
            : "";

    const muteHTML =
        muted
            ? `
                <span class="chatMuteIcon"
                      title="Muted">
                    <i class="fa-solid fa-bell-slash"></i>
                </span>
              `
            : "";

    const pinHTML =
        pinned
            ? `
                <span class="chatPinIcon"
                      title="Pinned">
                    <i class="fa-solid fa-thumbtack"></i>
                </span>
              `
            : "";

    card.innerHTML = `

        <div class="chatAvatar">

            <img
                src="${messagesEscape(photo)}"
                alt="${name}"
                loading="lazy"
                onerror="this.src='assets/default-avatar.png'"
            >

            ${onlineHTML}

        </div>

        <div class="chatInfo">

            <div class="chatTop">

                <div class="chatNameWrap">

                    <h3 class="chatName">
                        ${name}
                    </h3>

                    ${pinHTML}
                    ${muteHTML}

                </div>

                <span class="chatTime">
                    ${messagesTime(
                        chat.lastMessageTime
                    )}
                </span>

            </div>

            <div class="chatBottom">

                <p class="chatPreview">
                    ${preview}
                </p>

                ${unreadHTML}

            </div>

        </div>

    `;

    if (unread > 0) {

        card.classList.add("unread");

    }

    if (muted) {

        card.classList.add("muted");

    }

    if (pinned) {

        card.classList.add("pinned");

    }


    /* =====================================================
       NORMAL CLICK
    ================================================== */

    card.addEventListener(
        "click",
        function(event) {

            if (longPressTriggered) {

                longPressTriggered = false;

                event.preventDefault();

                return;

            }

            if (!chat.userId) {

                messagesToast(
                    "User information missing",
                    "error"
                );

                return;

            }

            location.href =
                "chat.html?uid=" +
                encodeURIComponent(
                    chat.userId
                );

        }
    );


    /* =====================================================
       LONG PRESS
    ================================================== */

    messagesAttachLongPress(
        card,
        chat
    );


    /* =====================================================
       RIGHT CLICK DESKTOP
    ================================================== */

    card.addEventListener(
        "contextmenu",
        function(event) {

            event.preventDefault();

            messagesOpenActionSheet(
                chat
            );

        }
    );


    return card;

}


/* =========================================================
   LONG PRESS
========================================================= */

function messagesAttachLongPress(
    element,
    chat
) {

    let startX = 0;
    let startY = 0;

    function start(event) {

        if (
            event.target.closest("button") ||
            event.target.closest("a")
        ) {
            return;
        }

        longPressTriggered = false;

        const point =
            event.touches
                ? event.touches[0]
                : event;

        startX = point.clientX;
        startY = point.clientY;

        clearTimeout(longPressTimer);

        longPressTimer =
            setTimeout(
                function() {

                    longPressTriggered = true;

                    if (navigator.vibrate) {
                        navigator.vibrate(35);
                    }

                    element.classList.add(
                        "longPressed"
                    );

                    messagesOpenActionSheet(
                        chat
                    );

                    setTimeout(
                        function() {

                            element.classList.remove(
                                "longPressed"
                            );

                        },
                        350
                    );

                },
                LONG_PRESS_TIME
            );

    }


    function move(event) {

        const point =
            event.touches
                ? event.touches[0]
                : event;

        const dx =
            Math.abs(
                point.clientX - startX
            );

        const dy =
            Math.abs(
                point.clientY - startY
            );

        if (dx > 12 || dy > 12) {

            clearTimeout(
                longPressTimer
            );

        }

    }


    function end() {

        clearTimeout(
            longPressTimer
        );

    }


    element.addEventListener(
        "touchstart",
        start,
        {
            passive: true
        }
    );

    element.addEventListener(
        "touchmove",
        move,
        {
            passive: true
        }
    );

    element.addEventListener(
        "touchend",
        end,
        {
            passive: true
        }
    );

    element.addEventListener(
        "touchcancel",
        end,
        {
            passive: true
        }
    );

}


/* =========================================================
   PREMIUM ACTION SHEET
========================================================= */

function messagesCreateActionSheet() {

    if (
        document.getElementById(
            "messageActionSheet"
        )
    ) {
        return;
    }

    const sheet =
        document.createElement("div");

    sheet.id =
        "messageActionSheet";

    sheet.className =
        "messageActionSheet hidden";

    sheet.innerHTML = `

        <div
            class="messageActionBackdrop"
            data-action="close"
        ></div>

        <div class="messageActionCard">

            <div class="messageActionHandle"></div>

            <div class="messageActionHeader">

                <div class="messageActionAvatar">
                    <img
                        id="actionUserPhoto"
                        src="assets/default-avatar.png"
                        alt=""
                    >
                </div>

                <div class="messageActionUser">

                    <strong id="actionUserName">
                        User
                    </strong>

                    <span id="actionUserUsername">
                        @user
                    </span>

                </div>

                <button
                    type="button"
                    class="messageActionClose"
                    data-action="close"
                    aria-label="Close"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            </div>


            <div class="messageActionList">

                <button
                    type="button"
                    class="messageActionItem"
                    data-action="pin"
                >
                    <span class="actionIcon">
                        <i class="fa-solid fa-thumbtack"></i>
                    </span>

                    <span class="actionText">
                        <strong id="actionPinText">
                            Pin chat
                        </strong>

                        <small>
                            Keep this conversation at the top
                        </small>
                    </span>
                </button>


                <button
                    type="button"
                    class="messageActionItem"
                    data-action="mute"
                >
                    <span class="actionIcon">
                        <i class="fa-solid fa-bell-slash"></i>
                    </span>

                    <span class="actionText">
                        <strong id="actionMuteText">
                            Mute
                        </strong>

                        <small>
                            Stop notifications for this chat
                        </small>
                    </span>
                </button>


                <button
                    type="button"
                    class="messageActionItem"
                    data-action="mark"
                >
                    <span class="actionIcon">
                        <i class="fa-solid fa-envelope-open"></i>
                    </span>

                    <span class="actionText">
                        <strong id="actionMarkText">
                            Mark as read
                        </strong>

                        <small>
                            Clear unread messages
                        </small>
                    </span>
                </button>


                <button
                    type="button"
                    class="messageActionItem danger"
                    data-action="delete"
                >
                    <span class="actionIcon">
                        <i class="fa-solid fa-trash"></i>
                    </span>

                    <span class="actionText">
                        <strong>
                            Delete chat
                        </strong>

                        <small>
                            Remove this chat from your inbox
                        </small>
                    </span>
                </button>


                <button
                    type="button"
                    class="messageActionItem danger"
                    data-action="block"
                >
                    <span class="actionIcon">
                        <i class="fa-solid fa-ban"></i>
                    </span>

                    <span class="actionText">
                        <strong id="actionBlockText">
                            Block user
                        </strong>

                        <small>
                            Prevent messaging with this user
                        </small>
                    </span>
                </button>

            </div>

        </div>

    `;

    document.body.appendChild(sheet);


    sheet.addEventListener(
        "click",
        function(event) {

            const actionButton =
                event.target.closest(
                    "[data-action]"
                );

            if (!actionButton) {
                return;
            }

            const action =
                actionButton.dataset.action;

            if (action === "close") {

                messagesCloseActionSheet();

                return;

            }

            if (!activeActionChat) {
                return;
            }

            messagesHandleChatAction(
                action,
                activeActionChat
            );

        }
    );

}


function messagesOpenActionSheet(chat) {

    messagesCreateActionSheet();

    activeActionChat = chat;

    const sheet =
        document.getElementById(
            "messageActionSheet"
        );

    if (!sheet) {
        return;
    }

    const photo =
        chat.photoURL ||
        chat.profilePhoto ||
        "assets/default-avatar.png";

    const name =
        document.getElementById(
            "actionUserName"
        );

    const username =
        document.getElementById(
            "actionUserUsername"
        );

    const photoElement =
        document.getElementById(
            "actionUserPhoto"
        );

    const pinText =
        document.getElementById(
            "actionPinText"
        );

    const muteText =
        document.getElementById(
            "actionMuteText"
        );

    const markText =
        document.getElementById(
            "actionMarkText"
        );

    const blockText =
        document.getElementById(
            "actionBlockText"
        );

    if (name) {
        name.textContent =
            chat.name || "Unknown User";
    }

    if (username) {
        username.textContent =
            chat.username
                ? "@" + chat.username
                : "";
    }

    if (photoElement) {
        photoElement.src = photo;

        photoElement.onerror =
            function() {
                this.src =
                    "assets/default-avatar.png";
            };
    }

    if (pinText) {

        pinText.textContent =
            chat.pinned === true
                ? "Unpin chat"
                : "Pin chat";

    }

    if (muteText) {

        muteText.textContent =
            chat.muted === true
                ? "Unmute"
                : "Mute";

    }

    if (markText) {

        markText.textContent =
            Number(chat.unread || 0) > 0
                ? "Mark as read"
                : "Mark as unread";

    }

    if (blockText) {

        blockText.textContent =
            chat.blocked === true
                ? "Unblock user"
                : "Block user";

    }

    sheet.classList.remove("hidden");

    requestAnimationFrame(
        function() {

            sheet.classList.add("show");

        }
    );

}


function messagesCloseActionSheet() {

    const sheet =
        document.getElementById(
            "messageActionSheet"
        );

    if (!sheet) {
        return;
    }

    sheet.classList.remove("show");

    setTimeout(
        function() {

            sheet.classList.add("hidden");

        },
        260
    );

    activeActionChat = null;

}


/* =========================================================
   ACTION HANDLER
========================================================= */

async function messagesHandleChatAction(
    action,
    chat
) {

    if (!messagesUID || !chat.chatId) {
        return;
    }

    switch (action) {

        case "pin":

            await messagesTogglePin(chat);

            break;


        case "mute":

            await messagesToggleMute(chat);

            break;


        case "mark":

            await messagesToggleRead(chat);

            break;


        case "delete":

            await messagesDeleteChat(chat);

            break;


        case "block":

            await messagesToggleBlock(chat);

            break;

    }

}


/* =========================================================
   PIN
========================================================= */

async function messagesTogglePin(chat) {

    const newValue =
        chat.pinned !== true;

    try {

        await db.ref(
            "userChats/" +
            messagesUID +
            "/" +
            chat.chatId
        ).update({

            pinned: newValue

        });

        messagesCloseActionSheet();

        messagesToast(
            newValue
                ? "Chat pinned"
                : "Chat unpinned"
        );

    } catch (error) {

        console.error(
            "Pin error:",
            error
        );

        messagesToast(
            "Unable to update pin",
            "error"
        );

    }

}


/* =========================================================
   MUTE
========================================================= */

async function messagesToggleMute(chat) {

    const newValue =
        chat.muted !== true;

    try {

        await db.ref(
            "userChats/" +
            messagesUID +
            "/" +
            chat.chatId
        ).update({

            muted: newValue

        });

        messagesCloseActionSheet();

        messagesToast(
            newValue
                ? "Chat muted"
                : "Chat unmuted"
        );

    } catch (error) {

        console.error(
            "Mute error:",
            error
        );

        messagesToast(
            "Unable to update mute",
            "error"
        );

    }

}


/* =========================================================
   READ / UNREAD
========================================================= */

async function messagesToggleRead(chat) {

    const currentlyUnread =
        Number(chat.unread || 0) > 0;

    try {

        await db.ref(
            "userChats/" +
            messagesUID +
            "/" +
            chat.chatId
        ).update({

            unread:
                currentlyUnread
                    ? 0
                    : 1

        });

        messagesCloseActionSheet();

        messagesToast(
            currentlyUnread
                ? "Marked as read"
                : "Marked as unread"
        );

    } catch (error) {

        console.error(
            "Read state error:",
            error
        );

        messagesToast(
            "Unable to update message state",
            "error"
        );

    }

}


/* =========================================================
   DELETE CHAT
========================================================= */

async function messagesDeleteChat(chat) {

    const confirmed =
        window.confirm(
            "Delete this conversation from your messages?"
        );

    if (!confirmed) {
        return;
    }

    try {

        messagesCloseActionSheet();

        messagesShowLoading();

        /*
         * Deletes only YOUR inbox entry.
         *
         * The actual chat remains available
         * for the other participant.
         */

        await db.ref(
            "userChats/" +
            messagesUID +
            "/" +
            chat.chatId
        ).remove();

        messagesHideLoading();

        messagesToast(
            "Chat deleted"
        );

    } catch (error) {

        console.error(
            "Delete chat error:",
            error
        );

        messagesHideLoading();

        messagesToast(
            "Unable to delete chat",
            "error"
        );

    }

}


/* =========================================================
   BLOCK / UNBLOCK
========================================================= */

async function messagesToggleBlock(chat) {

    if (!chat.userId) {

        messagesToast(
            "User information missing",
            "error"
        );

        return;

    }

    const currentlyBlocked =
        chat.blocked === true;

    if (!currentlyBlocked) {

        const confirmed =
            window.confirm(
                "Block this user? You can unblock them later."
            );

        if (!confirmed) {
            return;
        }

    }

    try {

        /*
         * Personal block record.
         */

        await db.ref(
            "blocks/" +
            messagesUID +
            "/" +
            chat.userId
        ).set(
            currentlyBlocked
                ? null
                : {
                    blockedAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP,

                    userId:
                        chat.userId,

                    name:
                        chat.name ||
                        "Unknown User"
                }
        );


        /*
         * Local chat state.
         */

        await db.ref(
            "userChats/" +
            messagesUID +
            "/" +
            chat.chatId
        ).update({

            blocked:
                !currentlyBlocked

        });


        messagesCloseActionSheet();

        messagesToast(
            currentlyBlocked
                ? "User unblocked"
                : "User blocked"
        );

    } catch (error) {

        console.error(
            "Block error:",
            error
        );

        messagesToast(
            "Unable to update block",
            "error"
        );

    }

}


/* =========================================================
   SEARCH
========================================================= */

if (messagesSearch) {

    messagesSearch.addEventListener(
        "input",
        function() {

            const value =
                messagesSearch.value.trim();

            if (messagesClearSearch) {

                messagesClearSearch.classList.toggle(
                    "hidden",
                    !value
                );

            }

            messagesRender();

        }
    );

}


if (messagesClearSearch) {

    messagesClearSearch.addEventListener(
        "click",
        function() {

            if (messagesSearch) {
                messagesSearch.value = "";
            }

            messagesClearSearch.classList.add(
                "hidden"
            );

            messagesRender();

        }
    );

}


/* =========================================================
   FILTER BUTTONS
========================================================= */

document
    .querySelectorAll(".filter")
    .forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    document
                        .querySelectorAll(".filter")
                        .forEach(
                            function(item) {

                                item.classList.remove(
                                    "active"
                                );

                            }
                        );

                    button.classList.add(
                        "active"
                    );

                    messagesFilter =
                        button.dataset.filter ||
                        "all";

                    messagesRender();

                }
            );

        }
    );


/* =========================================================
   REFRESH
========================================================= */

if (messagesRefresh) {

    messagesRefresh.addEventListener(
        "click",
        async function() {

            if (!messagesUID) {
                return;
            }

            messagesRefresh.classList.add(
                "loading"
            );

            try {

                const snapshot =
                    await db.ref(
                        "userChats/" +
                        messagesUID
                    ).once("value");

                const newChats = [];

                if (snapshot.exists()) {

                    snapshot.forEach(
                        function(child) {

                            const chat =
                                child.val() || {};

                            chat.chatId =
                                child.key;

                            newChats.push(chat);

                        }
                    );

                }

                messagesChats = newChats;

                messagesSortChats();

                messagesUpdateUnread();

                messagesRender();

                messagesToast(
                    "Messages refreshed"
                );

            } catch (error) {

                console.error(error);

                messagesToast(
                    "Refresh failed",
                    "error"
                );

            } finally {

                messagesRefresh.classList.remove(
                    "loading"
                );

            }

        }
    );

}


/* =========================================================
   NEW CHAT MODAL
========================================================= */

function messagesOpenModal() {

    if (!messagesModal) {
        return;
    }

    messagesModal.classList.remove(
        "hidden"
    );

    requestAnimationFrame(
        function() {

            messagesModal.classList.add(
                "show"
            );

        }
    );

    messagesLoadUsers("");

}


function messagesCloseModal() {

    if (!messagesModal) {
        return;
    }

    messagesModal.classList.remove(
        "show"
    );

    setTimeout(
        function() {

            messagesModal.classList.add(
                "hidden"
            );

        },
        280
    );

}


if (messagesNewChat) {

    messagesNewChat.addEventListener(
        "click",
        messagesOpenModal
    );

}

if (messagesFab) {

    messagesFab.addEventListener(
        "click",
        messagesOpenModal
    );

}

if (messagesStartChat) {

    messagesStartChat.addEventListener(
        "click",
        messagesOpenModal
    );

}

if (messagesModalClose) {

    messagesModalClose.addEventListener(
        "click",
        messagesCloseModal
    );

}

if (messagesModalBackdrop) {

    messagesModalBackdrop.addEventListener(
        "click",
        messagesCloseModal
    );

}


/* =========================================================
   USER SEARCH
========================================================= */

let messagesUserSearchTimer = null;

if (messagesUserSearch) {

    messagesUserSearch.addEventListener(
        "input",
        function() {

            clearTimeout(
                messagesUserSearchTimer
            );

            messagesUserSearchTimer =
                setTimeout(
                    function() {

                        messagesLoadUsers(
                            messagesUserSearch.value
                                .trim()
                        );

                    },
                    250
                );

        }
    );

}


/* =========================================================
   LOAD USERS
========================================================= */

async function messagesLoadUsers(keyword) {

    keyword =
        keyword || "";

    if (messagesUsersLoading) {

        messagesUsersLoading.classList.remove(
            "hidden"
        );

    }

    if (messagesEmptyUsers) {

        messagesEmptyUsers.classList.add(
            "hidden"
        );

    }

    if (messagesUserList) {

        messagesUserList.innerHTML = "";

    }

    try {

        const snapshot =
            await db.ref("users").once("value");

        if (messagesUsersLoading) {

            messagesUsersLoading.classList.add(
                "hidden"
            );

        }

        if (!snapshot.exists()) {

            if (messagesEmptyUsers) {
                messagesEmptyUsers.classList.remove(
                    "hidden"
                );
            }

            return;

        }

        let found = 0;

        const search =
            keyword.toLowerCase();

        snapshot.forEach(
            function(child) {

                const uid = child.key;

                const user =
                    child.val() || {};

                if (uid === messagesUID) {
                    return;
                }

                const name =
                    String(
                        user.name || ""
                    ).toLowerCase();

                const username =
                    String(
                        user.username || ""
                    ).toLowerCase();

                if (
                    search &&
                    !name.includes(search) &&
                    !username.includes(search)
                ) {

                    return;

                }

                found++;

                if (messagesUserList) {

                    messagesUserList.appendChild(
                        messagesCreateUserCard(
                            uid,
                            user
                        )
                    );

                }

            }
        );

        if (
            found === 0 &&
            messagesEmptyUsers
        ) {

            messagesEmptyUsers.classList.remove(
                "hidden"
            );

        }

    } catch (error) {

        console.error(
            "User loading error:",
            error
        );

        if (messagesUsersLoading) {

            messagesUsersLoading.classList.add(
                "hidden"
            );

        }

        messagesToast(
            "Unable to load users",
            "error"
        );

    }

}


/* =========================================================
   USER CARD
========================================================= */

function messagesCreateUserCard(uid, user) {

    const card =
        document.createElement("div");

    card.className = "userCard";

    const photo =
        user.photoURL ||
        user.profilePhoto ||
        "assets/default-avatar.png";

    card.innerHTML = `

        <div class="userAvatar">

            <img
                src="${messagesEscape(photo)}"
                alt="User"
                loading="lazy"
                onerror="this.src='assets/default-avatar.png'"
            >

            ${
                user.online === true
                    ? '<span class="onlineDot"></span>'
                    : ''
            }

        </div>

        <div class="userDetails">

            <h3>
                ${messagesEscape(
                    user.name || "Unknown"
                )}
            </h3>

            <p>
                @${messagesEscape(
                    user.username || "user"
                )}
            </p>

        </div>

        <button
            class="startChatBtn"
            type="button"
        >
            Chat
        </button>

    `;

    card.addEventListener(
        "click",
        function() {

            messagesCreateChat(
                uid,
                user
            );

        }
    );

    return card;

}


/* =========================================================
   CREATE CHAT
========================================================= */

async function messagesCreateChat(
    otherUID,
    otherUser
) {

    if (!messagesUID || !otherUID) {
        return;
    }

    try {

        messagesShowLoading();

        const chatID =
            [
                messagesUID,
                otherUID
            ]
                .sort()
                .join("_");

        const chatRef =
            db.ref(
                "chats/" +
                chatID
            );

        const chatSnapshot =
            await chatRef.once("value");

        if (!chatSnapshot.exists()) {

            await chatRef.set({

                type: "private",

                createdAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP,

                members: {

                    [messagesUID]: true,

                    [otherUID]: true

                }

            });

        }

        await db.ref(
            "userChats/" +
            messagesUID +
            "/" +
            chatID
        ).update({

            chatId: chatID,

            userId: otherUID,

            name:
                otherUser.name ||
                "Unknown",

            username:
                otherUser.username ||
                "",

            photoURL:
                otherUser.photoURL ||
                otherUser.profilePhoto ||
                "",

            lastMessage: "",

            lastMessageTime:
                firebase.database
                    .ServerValue
                    .TIMESTAMP,

            unread: 0,

            online:
                otherUser.online === true,

            pinned: false,

            muted: false,

            blocked: false

        });


        const mySnapshot =
            await db.ref(
                "users/" +
                messagesUID
            ).once("value");

        const me =
            mySnapshot.val() || {};


        await db.ref(
            "userChats/" +
            otherUID +
            "/" +
            chatID
        ).update({

            chatId: chatID,

            userId: messagesUID,

            name:
                me.name ||
                "Unknown",

            username:
                me.username ||
                "",

            photoURL:
                me.photoURL ||
                me.profilePhoto ||
                "",

            lastMessage: "",

            lastMessageTime:
                firebase.database
                    .ServerValue
                    .TIMESTAMP,

            unread: 0,

            online:
                me.online === true

        });


        messagesCloseModal();

        messagesHideLoading();

        setTimeout(
            function() {

                location.href =
                    "chat.html?uid=" +
                    encodeURIComponent(
                        otherUID
                    );

            },
            180
        );

    } catch (error) {

        console.error(
            "Create chat error:",
            error
        );

        messagesHideLoading();

        messagesToast(
            "Failed to create chat",
            "error"
        );

    }

}


/* =========================================================
   ACTION SHEET ESC / BACKDROP
========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Escape") {

            messagesCloseActionSheet();

            messagesCloseModal();

        }

    }
);


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function() {

        messagesRemoveChatListener();

        clearTimeout(
            longPressTimer
        );

    }
);


/* =========================================================
   FINAL
========================================================= */

console.log(
    "%cVIEWORA MESSAGES V3 LOADED",
    "color:#00e676;font-size:18px;font-weight:800"
);