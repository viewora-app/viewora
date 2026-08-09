"use strict";

/* =========================================================
   VIEWORA MESSAGES V2 FINAL
   Clean Realtime Chat List + Unread System
========================================================= */

console.clear();

console.log(
    "%cVIEWORA • MESSAGES V2 FINAL",
    "color:#00E5FF;font-size:18px;font-weight:800"
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
    throw new Error("Firebase Realtime Database Missing");
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

let messagesToastTimer = null;

function messagesToast(text) {

    const toast =
        document.getElementById("toast");

    const toastText =
        document.getElementById("toastText");

    if (!toast || !toastText) {
        return;
    }

    toastText.textContent =
        text || "";

    toast.classList.remove("hidden");

    clearTimeout(
        messagesToastTimer
    );

    messagesToastTimer =
        setTimeout(function () {

            toast.classList.add("hidden");

        }, 2500);

}


/* =========================================================
   CONNECTION
========================================================= */

function messagesUpdateConnection() {

    if (!messagesConnection) {
        return;
    }

    if (navigator.onLine) {

        messagesConnection.textContent =
            "🟢 Online";

    } else {

        messagesConnection.textContent =
            "🔴 Offline";

    }

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

            location.replace(
                "login.html"
            );

            return;
        }

        messagesUser =
            user;

        messagesUID =
            user.uid;

        console.log(
            "VIEWORA USER:",
            messagesUID
        );

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

    messagesInitialized = true;

    messagesShowLoading();
    messagesShowSkeleton();

    try {

        console.log(
            "Loading Viewora messages..."
        );


        await messagesLoadUser();


        messagesListenConnection();


        messagesListenChats();


        /*
         * IMPORTANT:
         * Page should never remain stuck
         * on loading.
         */

        messagesHideSkeleton();
        messagesHideLoading();


        if (messagesApp) {

            messagesApp.classList.remove(
                "hidden"
            );

        }


        console.log(
            "%cVIEWORA MESSAGES READY",
            "color:#00E676;font-size:18px;font-weight:800"
        );


    } catch (error) {

        console.error(
            "MESSAGES ERROR:",
            error
        );


        messagesHideSkeleton();
        messagesHideLoading();


        if (messagesApp) {

            messagesApp.classList.remove(
                "hidden"
            );

        }


        messagesToast(
            "Unable to load messages"
        );

    }

}


/* =========================================================
   LOAD USER
========================================================= */

async function messagesLoadUser() {

    if (!messagesUID) {
        throw new Error(
            "Current UID Missing"
        );
    }


    const userRef =
        db.ref(
            "users/" +
            messagesUID
        );


    const snapshot =
        await userRef.once(
            "value"
        );


    if (snapshot.exists()) {

        messagesUserData =
            snapshot.val() || {};

    } else {

        messagesUserData = {};

    }


    /*
     * Online status
     */

    userRef.update({

        online: true,

        lastSeen:
            firebase.database
                .ServerValue
                .TIMESTAMP

    }).catch(function(error) {

        console.warn(
            "Online update failed:",
            error
        );

    });


    /*
     * Offline status
     */

    userRef.onDisconnect().update({

        online: false,

        lastSeen:
            firebase.database
                .ServerValue
                .TIMESTAMP

    }).catch(function(error) {

        console.warn(
            "onDisconnect failed:",
            error
        );

    });


    console.log(
        "User loaded"
    );

}


/* =========================================================
   REALTIME USER CHATS
========================================================= */

function messagesListenChats() {

    if (!messagesUID) {
        return;
    }


    /*
     * Remove old listener if any
     */

    messagesRemoveChatListener();


    /*
     * EXACT DATABASE PATH
     *
     * userChats/
     *     CURRENT_UID/
     *         CHAT_ID/
     */

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


                        newChats.push(
                            chat
                        );

                    }
                );

            }


            messagesChats =
                newChats;


            messagesSortChats();


            messagesUpdateUnread();


            messagesRender();

        };


    /*
     * ONE VALUE LISTENER
     *
     * This is enough for:
     * - new messages
     * - unread count
     * - latest message
     * - online state
     * - new conversations
     */

    messagesChatsRef.on(
        "value",
        messagesChatsValueListener
    );


    console.log(
        "Realtime userChats listener started"
    );

}


/* =========================================================
   REMOVE CHAT LISTENER
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

            return (
                Number(
                    b.lastMessageTime || 0
                ) -
                Number(
                    a.lastMessageTime || 0
                )
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

            totalUnread +=
                Number(
                    chat.unread || 0
                );

        }
    );


    /*
     * Unread filter badge
     */

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


    /*
     * Optional global badge.
     * Works if HTML has messageBadge.
     */

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
   SEARCH + FILTER
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


    /*
     * Search
     */

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


    /*
     * Filter
     */

    if (
        messagesFilter ===
        "unread"
    ) {

        result =
            result.filter(
                function(chat) {

                    return Number(
                        chat.unread || 0
                    ) > 0;

                }
            );

    }


    if (
        messagesFilter ===
        "online"
    ) {

        result =
            result.filter(
                function(chat) {

                    return (
                        chat.online === true
                    );

                }
            );

    }


    if (
        messagesFilter ===
        "pinned"
    ) {

        result =
            result.filter(
                function(chat) {

                    return (
                        chat.pinned === true
                    );

                }
            );

    }


    return result;

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


    messagesChatList.innerHTML =
        "";


    /*
     * Count
     */

    if (messagesChatCount) {

        messagesChatCount.textContent =
            messagesChats.length;

    }


    /*
     * Empty
     */

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


    messagesAnimateCards();

}


/* =========================================================
   ESCAPE
========================================================= */

function messagesEscape(value) {

    return String(
        value == null
            ? ""
            : value
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


/* =========================================================
   TIME
========================================================= */

function messagesTime(timestamp) {

    if (!timestamp) {
        return "";
    }


    const date =
        new Date(
            Number(timestamp)
        );


    if (
        isNaN(
            date.getTime()
        )
    ) {

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
   CHAT CARD
========================================================= */

function messagesCreateCard(chat) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "chatCard";


    card.dataset.chatid =
        chat.chatId || "";


    card.dataset.userid =
        chat.userId || "";


    const name =
        messagesEscape(
            chat.name ||
            "Unknown User"
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
        Number(
            chat.unread || 0
        );


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

            ? `
                <span class="onlineDot"></span>
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

                <h3 class="chatName">
                    ${name}
                </h3>

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


    /*
     * UNREAD VISUAL
     */

    if (unread > 0) {

        card.classList.add(
            "unread"
        );

    }


    /*
     * OPEN CHAT
     */

    card.addEventListener(
        "click",
        function() {

            if (!chat.userId) {

                messagesToast(
                    "User information missing"
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


    return card;

}


/* =========================================================
   CARD ANIMATION
========================================================= */

let messagesFirstRender = true;

function messagesAnimateCards() {

    const cards =
        document.querySelectorAll(
            ".chatCard"
        );


    if (!messagesFirstRender) {

        cards.forEach(
            function(card) {

                card.classList.add(
                    "show"
                );

            }
        );

        return;

    }


    messagesFirstRender =
        false;


    cards.forEach(
        function(card, index) {

            setTimeout(
                function() {

                    card.classList.add(
                        "show"
                    );

                },
                index * 45
            );

        }
    );

}


/* =========================================================
   SEARCH EVENTS
========================================================= */

if (messagesSearch) {

    messagesSearch.addEventListener(
        "input",
        function() {

            const value =
                messagesSearch.value
                    .trim();


            if (messagesClearSearch) {

                if (value) {

                    messagesClearSearch.classList.remove(
                        "hidden"
                    );

                } else {

                    messagesClearSearch.classList.add(
                        "hidden"
                    );

                }

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

                messagesSearch.value =
                    "";

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
    .querySelectorAll(
        ".filter"
    )
    .forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    document
                        .querySelectorAll(
                            ".filter"
                        )
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
                    await db
                        .ref(
                            "userChats/" +
                            messagesUID
                        )
                        .once(
                            "value"
                        );


                const newChats = [];


                if (snapshot.exists()) {

                    snapshot.forEach(
                        function(child) {

                            const chat =
                                child.val() || {};


                            chat.chatId =
                                child.key;


                            newChats.push(
                                chat
                            );

                        }
                    );

                }


                messagesChats =
                    newChats;


                messagesSortChats();

                messagesUpdateUnread();

                messagesRender();


                messagesToast(
                    "Messages refreshed"
                );


            } catch (error) {

                console.error(
                    error
                );

                messagesToast(
                    "Refresh failed"
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

async function messagesLoadUsers(
    keyword
) {

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

        messagesUserList.innerHTML =
            "";

    }


    try {

        const snapshot =
            await db
                .ref("users")
                .once("value");


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


        let found =
            0;


        snapshot.forEach(
            function(child) {

                const uid =
                    child.key;

                const user =
                    child.val() || {};


                if (
                    uid === messagesUID
                ) {

                    return;

                }


                const search =
                    keyword.toLowerCase();


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
            "Unable to load users"
        );

    }

}


/* =========================================================
   USER CARD
========================================================= */

function messagesCreateUserCard(
    uid,
    user
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "userCard";


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
                    user.name ||
                    "Unknown"
                )}
            </h3>

            <p>
                @${messagesEscape(
                    user.username ||
                    "user"
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

    if (
        !messagesUID ||
        !otherUID
    ) {

        return;

    }


    try {

        messagesShowLoading();


        /*
         * SAME CHAT ID
         */

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
            await chatRef.once(
                "value"
            );


        /*
         * MAIN CHAT
         */

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


        /*
         * MY CHAT ENTRY
         */

        await db
            .ref(
                "userChats/" +
                messagesUID +
                "/" +
                chatID
            )
            .update({

                chatId:
                    chatID,

                userId:
                    otherUID,

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

                lastMessage:
                    "",

                lastMessageTime:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP,

                unread:
                    0,

                online:
                    otherUser.online === true

            });


        /*
         * MY USER DATA
         */

        const mySnapshot =
            await db
                .ref(
                    "users/" +
                    messagesUID
                )
                .once(
                    "value"
                );


        const me =
            mySnapshot.val() || {};


        /*
         * RECEIVER CHAT ENTRY
         */

        await db
            .ref(
                "userChats/" +
                otherUID +
                "/" +
                chatID
            )
            .update({

                chatId:
                    chatID,

                userId:
                    messagesUID,

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

                lastMessage:
                    "",

                lastMessageTime:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP,

                unread:
                    0,

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
            200
        );


    } catch (error) {

        console.error(
            "Create chat error:",
            error
        );


        messagesHideLoading();


        messagesToast(
            "Failed to create chat"
        );

    }

}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function() {

        messagesRemoveChatListener();

    }
);


/* =========================================================
   FINAL
========================================================= */

console.log(
    "%cVIEWORA MESSAGES V2 FINAL LOADED",
    "color:#00E676;font-size:18px;font-weight:800"
);