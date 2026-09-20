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
    /* Disabled — open messages instantly, no full-screen loader */
    if (messagesLoading) {
        messagesLoading.classList.add("hidden");
        messagesLoading.style.display = "none";
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

    // Instant UI — no blocking loader
    if (messagesApp) {
        messagesApp.classList.remove("hidden");
        messagesApp.style.opacity = "1";
    }
    messagesHideLoading();
    // Brief skeleton only while first data loads
    messagesShowSkeleton();

    try {

        await messagesLoadUser();

        messagesListenConnection();
        messagesListenChats();

        messagesInitialized = true;
        try {
          if (typeof loadNotesStrip === "function") loadNotesStrip();
          else if (typeof window.loadNotesStrip === "function") window.loadNotesStrip();
        } catch (_) {}

        console.log(
            "%cVIEWORA MESSAGES READY",
            "color:#00e676;font-size:18px;font-weight:800"
        );

    } catch (error) {

        console.error(
            "MESSAGES INITIALIZATION ERROR:",
            error
        );

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


function messagesCanonicalChatId(uidA, uidB) {
    if (!uidA || !uidB) return "";
    return [String(uidA), String(uidB)].sort().join("_");
}

function messagesPeerFromChat(chat, me) {
    if (!chat) return "";
    const isG = !!(
        chat.isGroup ||
        chat.groupId ||
        chat.chatType === "group" ||
        chat.chatType === "community" ||
        chat.chatType === "podcast" ||
        chat.chatType === "teamwork"
    );
    if (isG) return "";
    let peer =
        chat.userId ||
        chat.peerId ||
        chat.otherUid ||
        chat.otherUserId ||
        chat.uid ||
        "";
    const cid = String(chat.chatId || chat.id || "");
    if ((!peer || peer === me) && cid.indexOf("_") !== -1 && me) {
        const parts = cid.split("_");
        if (parts.length === 2) {
            peer = parts[0] === me ? parts[1] : parts[0];
        }
    }
    // Legacy key was only the other user's uid
    if (!peer && cid && cid.indexOf("_") === -1 && cid !== me) {
        peer = cid;
    }
    return peer || "";
}

/** One row per peer — merge image/video share duplicates */
function messagesDedupeChats(list) {
    const me = messagesUID || "";
    const groups = [];
    const byPeer = new Map();

    (list || []).forEach(function (chat) {
        if (!chat) return;
        const isG = !!(
            chat.isGroup ||
            chat.groupId ||
            chat.chatType === "group" ||
            chat.chatType === "community" ||
            chat.chatType === "podcast" ||
            chat.chatType === "teamwork"
        );
        if (isG) {
            groups.push(chat);
            return;
        }
        const peer = messagesPeerFromChat(chat, me);
        if (!peer) {
            groups.push(chat);
            return;
        }
        // Normalize chatId to sorted pair
        const canonical = messagesCanonicalChatId(me, peer);
        if (canonical) {
            chat.chatId = canonical;
            chat.userId = peer;
            chat.peerId = peer;
        }
        const prev = byPeer.get(peer);
        if (!prev) {
            byPeer.set(peer, chat);
            return;
        }
        // Keep the richer / newer entry
        const tNew = Number(chat.lastMessageTime || chat.updatedAt || 0);
        const tOld = Number(prev.lastMessageTime || prev.updatedAt || 0);
        const winner = tNew >= tOld ? chat : prev;
        const loser = tNew >= tOld ? prev : chat;
        // Merge unread max + best photo/name
        winner.unread = Math.max(
            Number(winner.unread || 0),
            Number(winner.unreadCount || 0),
            Number(loser.unread || 0),
            Number(loser.unreadCount || 0)
        );
        winner.unreadCount = winner.unread;
        if (!winner.photoURL && loser.photoURL) winner.photoURL = loser.photoURL;
        if (!winner.profilePhoto && loser.profilePhoto) winner.profilePhoto = loser.profilePhoto;
        if ((!winner.name || winner.name === "Unknown User") && loser.name) winner.name = loser.name;
        if (!winner.lastMessage && loser.lastMessage) winner.lastMessage = loser.lastMessage;
        byPeer.set(peer, winner);
    });

    return groups.concat(Array.from(byPeer.values()));
}



function messagesCleanupDuplicateKeys(rawList) {
    const me = messagesUID;
    if (!me || !rawList || !rawList.length) return;
    const hasCanonical = {};
    rawList.forEach(function (c) {
        const k = String(c.chatId || c.id || "");
        if (k.indexOf("_") !== -1) hasCanonical[k] = true;
    });
    const del = {};
    rawList.forEach(function (chat) {
        const key = String(chat.chatId || chat.id || "");
        if (!key || key.indexOf("_") !== -1) return;
        const peer = key;
        const canonical = messagesCanonicalChatId(me, peer);
        if (canonical && hasCanonical[canonical]) del[peer] = null;
    });
    if (Object.keys(del).length) {
        db.ref("userChats/" + me).update(del).catch(function () {});
    }
}

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

            messagesChats = messagesDedupeChats(newChats);

            messagesSortChats();

            messagesUpdateUnread();

            // Cleanup legacy dual keys in background (uid-only keys)
            try {
                messagesCleanupDuplicateKeys(newChats);
            } catch (_) {}

            // Enrich photos: groups from groups/, users from users/
            Promise.all(
                messagesChats.map(async (chat) => {
                    try {
                        const isG = !!(
                            chat.isGroup ||
                            chat.groupId ||
                            chat.chatType === "group" ||
                            chat.chatType === "community" ||
                            chat.chatType === "podcast" ||
                            chat.chatType === "teamwork"
                        );
                        if (isG) {
                            const gid = chat.groupId || chat.chatId || "";
                            if (!chat.photoURL && chat.photo) chat.photoURL = chat.photo;
                            if (gid && (!chat.photoURL || !chat.name)) {
                                const roots = ["groups", "teams", "podcasts"];
                                for (let r = 0; r < roots.length; r++) {
                                    const snap = await db.ref(roots[r] + "/" + gid).once("value");
                                    if (!snap.exists()) continue;
                                    const g = snap.val() || {};
                                    if (!chat.photoURL) {
                                        chat.photoURL =
                                            g.photoURL || g.photo || "";
                                        chat.photo = chat.photoURL;
                                        chat.profilePhoto = chat.photoURL;
                                    }
                                    if (!chat.name || chat.name === "Unknown User") {
                                        chat.name = g.name || chat.name;
                                    }
                                    break;
                                }
                            }
                            return;
                        }
                        const uid = chat.userId || chat.uid || "";
                        if (!uid) return;
                        if (
                            messagesIsVerified(chat) &&
                            (chat.photoURL || chat.profilePhoto)
                        )
                            return;
                        const snap = await db.ref("users/" + uid).once("value");
                        if (!snap.exists()) return;
                        const u = snap.val() || {};
                        if (messagesIsVerified(u)) {
                            chat.verified = true;
                            chat.isVerified = true;
                        }
                        if (!chat.photoURL && !chat.profilePhoto) {
                            chat.photoURL =
                                u.profilePhoto ||
                                u.photoURL ||
                                u.avatar ||
                                "";
                            chat.profilePhoto = chat.photoURL;
                        }
                        if (!chat.name || chat.name === "Unknown User") {
                            chat.name =
                                u.displayName ||
                                u.name ||
                                u.username ||
                                chat.name;
                        }
                    } catch (_) {}
                })
            ).then(() => {
                messagesRender();
            });

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

            totalUnread += Math.max(
                0,
                Number(chat.unread || 0),
                Number(chat.unreadCount || 0),
                Number(chat.unreadMessages || 0),
                Number(chat.unread_count || 0)
            );

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

    function isRequestChat(chat) {
        return !!(chat && chat.request === true && chat.accepted !== true && !chat.isGroup && !chat.groupId);
    }

    if (messagesFilter === "requests") {
        result = result.filter(isRequestChat);
    } else {
        result = result.filter(function (chat) {
            return !isRequestChat(chat);
        });
    }

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

    if (messagesFilter === "groups") {
        result = result.filter(function (chat) {
            return !!(
                chat.isGroup ||
                chat.groupId ||
                chat.chatType === "group" ||
                chat.chatType === "community" ||
                chat.chatType === "podcast" ||
                (window.VieworaGroupChat &&
                    VieworaGroupChat.isGroupChat(chat))
            );
        });
    }

    if (messagesFilter === "private") {
        result = result.filter(function (chat) {
            var isG = !!(
                chat.isGroup ||
                chat.groupId ||
                chat.chatType === "group" ||
                chat.chatType === "community" ||
                chat.chatType === "podcast"
            );
            return !isG;
        });
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

    messagesHideSkeleton();

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
            var card = messagesCreateCard(chat);
            if (card) {
                card.classList.add("chatCardEnter");
                messagesChatList.appendChild(card);
            }
        }
    );

}


/* =========================================================
   CHAT CARD
========================================================= */


function messagesIsVerified(data) {
    if (!data || typeof data !== "object") return false;
    return (
        data.verified === true ||
        data.isVerified === true ||
        data.blueTick === true ||
        data.badge === "verified" ||
        data.verification === true ||
        data.verificationStatus === "verified"
    );
}

function messagesVerifiedHTML(data) {
    if (!messagesIsVerified(data)) return "";
    return '<span class="verifiedTick" title="Verified"><i class="fa-solid fa-circle-check"></i></span>';
}

function messagesCreateCard(chat) {

    const card =
        document.createElement("div");

    card.className = "chatCard";
    try {
        const isG = !!(chat.isGroup || chat.groupId || chat.chatType === "group" || chat.chatType === "community" || chat.chatType === "podcast" || chat.chatType === "teamwork");
        if (isG) {
            card.classList.add("isGroup");
            card.dataset.group = "1";
            if (chat.chatType === "community") card.classList.add("community");
        }
    } catch (_) {}

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

    const unread = Math.max(
        0,
        Number(chat.unread || 0),
        Number(chat.unreadCount || 0),
        Number(chat.unreadMessages || 0),
        Number(chat.unread_count || 0)
    );

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

    const isReq = chat.request === true && chat.accepted !== true && !chat.isGroup;
    if (isReq) card.classList.add("requestCard");
    const requestHTML = isReq
        ? `<div class="requestActions">
                <button type="button" class="reqBtn accept" data-req="accept">Accept</button>
                <button type="button" class="reqBtn decline" data-req="decline">Decline</button>
                <button type="button" class="reqBtn block" data-req="block">Block</button>
           </div>`
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
                        ${name}${messagesVerifiedHTML(chat)}
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

    card.querySelectorAll("[data-req]").forEach(function (btn) {
        btn.addEventListener("click", async function (event) {
            event.preventDefault();
            event.stopPropagation();
            var act = btn.getAttribute("data-req");
            try {
                if (act === "accept") await acceptMessageRequest(chat);
                else if (act === "decline") await declineMessageRequest(chat);
                else if (act === "block") await blockMessageRequest(chat);
            } catch (e) {
                console.error(e);
                messagesToast("Could not update request", "error");
            }
        });
    });

    card.addEventListener(
        "click",
        function(event) {
            if (event.target.closest("[data-req]")) return;
            if (chat.request === true && chat.accepted !== true && !chat.isGroup) {
                // stay on requests until accepted
                return;
            }

            if (longPressTriggered) {

                longPressTriggered = false;

                event.preventDefault();

                return;

            }

            // Group / community / podcast → dedicated room page
            const isGroup =
                !!(chat.isGroup ||
                    chat.groupId ||
                    chat.chatType === "group" ||
                    chat.chatType === "community" ||
                    chat.chatType === "podcast" ||
                    (window.VieworaGroupChat &&
                        VieworaGroupChat.isGroupChat(chat)));
            if (isGroup) {
                const gid = chat.groupId || chat.chatId || chat.id || "";
                if (!gid) {
                    messagesToast("Group information missing", "error");
                    return;
                }
                let page = "group.html";
                const t = chat.chatType || chat.type || "group";
                if (t === "podcast") page = "podcast.html";
                else if (t === "community" || t === "teamwork") page = "teamwork.html";
                location.href = page + "?id=" + encodeURIComponent(gid);
                return;
            }

            // Resolve peer uid (userId or other half of chatId)
            let peerUid = chat.userId || chat.uid || chat.peerId || "";
            if (!peerUid) {
                const cid = String(chat.chatId || chat.id || "");
                const me =
                    (window.auth && auth.currentUser && auth.currentUser.uid) ||
                    (firebase.auth && firebase.auth().currentUser && firebase.auth().currentUser.uid) ||
                    messagesUID ||
                    "";
                if (cid.indexOf("_") !== -1 && me) {
                    const parts = cid.split("_");
                    peerUid = parts[0] === me ? parts[1] : parts[0];
                }
            }
            if (!peerUid) {
                messagesToast(
                    "User information missing",
                    "error"
                );
                return;
            }

            // Click = read — clear all unread keys for this peer
            try {
                const me =
                    (typeof getCurrentUID === "function" && getCurrentUID()) ||
                    (window.auth && auth.currentUser && auth.currentUser.uid) ||
                    (firebase.auth && firebase.auth().currentUser && firebase.auth().currentUser.uid) ||
                    messagesUID ||
                    "";
                const peer = messagesPeerFromChat(chat, me);
                const cid = chat.chatId || chat.id || (peer ? messagesCanonicalChatId(me, peer) : "");
                const patch = {
                    unread: 0,
                    unreadCount: 0,
                    unreadMessages: 0,
                    unread_count: 0,
                    read: true,
                    seen: true,
                    isRead: true
                };
                if (me && cid) {
                    db.ref("userChats/" + me + "/" + cid).update(patch);
                }
                // also clear legacy bare-peer key
                if (me && peer && peer !== cid) {
                    db.ref("userChats/" + me + "/" + peer).update(patch).catch(function () {});
                }
                // optimistic UI
                chat.unread = 0;
                chat.unreadCount = 0;
                try {
                    const badge = card.querySelector(".unreadBadge");
                    if (badge) badge.remove();
                    card.classList.remove("unread");
                } catch (_) {}
                try { messagesUpdateUnread(); } catch (_) {}
            } catch (_) {}
            location.href =
                "chat.html?uid=" +
                encodeURIComponent(peerUid);

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

        /*
         * Deletes only YOUR inbox entry.
         * The actual chat remains available
         * for the other participant.
         */

        await db.ref(
            "userChats/" +
            messagesUID +
            "/" +
            chat.chatId
        ).remove();

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
    location.href = "users.html";
    return;

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
                )}${messagesVerifiedHTML(user)}
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


/* =========================================================
   VIEWORA — Group / Community / Podcast create
========================================================= */
(function wireGroupCreate() {
  "use strict";

  const TYPE_META = {
    group: { title: "New group", nameLabel: "Group name", pill: "Group" },
    community: { title: "New community", nameLabel: "Community name", pill: "Community" },
    podcast: { title: "New podcast room", nameLabel: "Podcast name", pill: "Podcast" },
    teamwork: { title: "New teamwork", nameLabel: "Team name", pill: "Teamwork" }
  };

  let createType = "group";
  let selected = new Set();
  let peopleCache = [];
  let photoDataUrl = "";

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    if (typeof showToast === "function") showToast(msg);
    else try {
      const t = $("toast");
      const tx = $("toastText");
      if (tx) tx.textContent = msg;
      if (t) {
        t.classList.remove("hidden");
        setTimeout(() => t.classList.add("hidden"), 2200);
      }
    } catch (_) {}
  }

  function getUid() {
    try {
      if (typeof currentUser !== "undefined" && currentUser && currentUser.uid)
        return currentUser.uid;
      if (firebase.auth().currentUser) return firebase.auth().currentUser.uid;
    } catch (_) {}
    return null;
  }

  function openCreateSheet(type) {
    type = type || "group";
    if (type !== "group" && typeof canCreateRoomType === "function" && !canCreateRoomType(type)) {
      toast(type === "teamwork"
        ? "Teamwork unlocks at 10k followers"
        : "Community & Podcast need Blue tick / monetization");
      return;
    }

    createType = type || "group";
    selected = new Set();
    photoDataUrl = "";
    const meta = TYPE_META[createType] || TYPE_META.group;
    const sheet = $("createGroupSheet");
    if (!sheet) return;
    const title = $("createGroupTitle");
    const nameLabel = $("createNameLabel");
    if (title) title.textContent = meta.title;
    if (nameLabel) nameLabel.textContent = meta.nameLabel;
    const nameIn = $("groupNameInput");
    const descIn = $("groupDescInput");
    if (nameIn) nameIn.value = "";
    if (descIn) descIn.value = "";
    const prev = $("groupPhotoPreview");
    const btn = $("groupPhotoBtn");
    if (prev) {
      prev.src = "";
      prev.classList.add("hidden");
    }
    if (btn) btn.classList.remove("hidden");
    $("createGroupSubmit") && ($("createGroupSubmit").disabled = true);
    $("selectedMembersCount") &&
      ($("selectedMembersCount").textContent = "0 selected");
    sheet.classList.remove("hidden");
    sheet.setAttribute("aria-hidden", "false");
    document.body.classList.add("modalOpen");
    loadMemberCandidates();
  }

  function closeCreateSheet() {
    const sheet = $("createGroupSheet");
    if (!sheet) return;
    sheet.classList.add("hidden");
    sheet.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modalOpen");
  }

  async function loadMemberCandidates() {
    const list = $("createMemberList");
    if (!list) return;
    list.innerHTML = '<div class="vssLoading" style="padding:20px;text-align:center;color:rgba(255,255,255,.45)">Loading friends…</div>';
    const me = getUid();
    peopleCache = [];
    try {
      const db = firebase.database();
      let following = {};
      try {
        const fs = await db.ref("following/" + me).once("value");
        following = fs.val() || {};
      } catch (_) {
        try {
          const fs2 = await db.ref("users/" + me + "/following").once("value");
          following = fs2.val() || {};
        } catch (__) {}
      }
      const ids = Object.keys(following).filter((k) => {
        const v = following[k];
        return v === true || v === 1 || (v && typeof v === "object");
      }).slice(0, 40);

      // also people from existing chats
      try {
        const uc = await db.ref("userChats/" + me).once("value");
        if (uc.exists()) {
          uc.forEach((c) => {
            const v = c.val() || {};
            const other = v.uid || v.userId || v.peerId;
            if (other && other !== me && ids.indexOf(other) === -1) ids.push(other);
          });
        }
      } catch (_) {}

      await Promise.all(
        ids.slice(0, 50).map(async (uid) => {
          try {
            const us = await db.ref("users/" + uid).once("value");
            const u = us.val() || {};
            const name =
              u.username || u.userName || u.displayName || u.name || "user";
            const photo =
              u.profilePhoto ||
              u.photoURL ||
              u.avatar ||
              "assets/default-avatar.png";
            peopleCache.push({
              uid,
              username: name,
              displayName: u.displayName || u.name || name,
              photo
            });
          } catch (_) {}
        })
      );
    } catch (e) {
      console.warn(e);
    }
    renderMembers("");
  }

  function renderMembers(q) {
    const list = $("createMemberList");
    if (!list) return;
    const query = (q || "").toLowerCase().trim();
    const filtered = !query
      ? peopleCache
      : peopleCache.filter(
          (p) =>
            String(p.username).toLowerCase().includes(query) ||
            String(p.displayName).toLowerCase().includes(query)
        );
    if (!filtered.length) {
      list.innerHTML =
        '<div style="padding:24px;text-align:center;color:rgba(255,255,255,.4);font-size:13px">No friends found. Follow people first.</div>';
      return;
    }
    list.innerHTML = filtered
      .map((p) => {
        const sel = selected.has(p.uid) ? " selected" : "";
        return (
          '<button type="button" class="memberRow' +
          sel +
          '" data-uid="' +
          p.uid +
          '">' +
          '<img src="' +
          p.photo +
          '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
          '<span class="memberInfo"><strong>' +
          escapeHtml(p.displayName) +
          "</strong><span>@" +
          escapeHtml(p.username) +
          "</span></span>" +
          '<span class="memberCheck"><i class="fa-solid fa-check"></i></span>' +
          "</button>"
        );
      })
      .join("");

    list.querySelectorAll(".memberRow").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = btn.getAttribute("data-uid");
        if (selected.has(uid)) selected.delete(uid);
        else selected.add(uid);
        btn.classList.toggle("selected", selected.has(uid));
        updateCreateState();
      });
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateCreateState() {
    const name = (($("groupNameInput") && $("groupNameInput").value) || "").trim();
    const count = selected.size;
    const el = $("selectedMembersCount");
    if (el) el.textContent = count + " selected";
    const sub = $("createGroupSubmit");
    if (sub) sub.disabled = !(name.length >= 2 && count >= 1);
  }

  async function submitCreate() {
    const me = getUid();
    if (!me) {
      toast("Please login");
      return;
    }
    const name = (($("groupNameInput") && $("groupNameInput").value) || "").trim();
    const desc = (($("groupDescInput") && $("groupDescInput").value) || "").trim();
    if (name.length < 2 || selected.size < 1) {
      toast("Name + at least 1 member required");
      return;
    }
    const sub = $("createGroupSubmit");
    if (sub) {
      sub.disabled = true;
      sub.textContent = "Creating…";
    }
    try {
      const db = firebase.database();
      const ref = db.ref("groups").push();
      const gid = ref.key;
      const members = {};
      function memberMeta(uid, role) {
        var p = null;
        try {
          if (typeof peopleCache !== "undefined" && peopleCache) {
            p = peopleCache.find(function (x) { return x.uid === uid || x.id === uid; });
          }
        } catch (_) {}
        return {
          role: role,
          joinedAt: Date.now(),
          name: (p && (p.name || p.displayName || p.username)) || "",
          username: (p && p.username) || "",
          photoURL: (p && (p.photo || p.photoURL || p.avatar)) || ""
        };
      }
      members[me] = memberMeta(me, "owner");
      selected.forEach(function (uid) {
        members[uid] = memberMeta(uid, "member");
      });

      // Avoid huge base64 in RTDB (causes write failures / not found)
      var safePhoto = "";
      if (photoDataUrl && photoDataUrl.length < 180000) {
        safePhoto = photoDataUrl;
      } else if (photoDataUrl) {
        toast("Photo skipped (too large) — group still created");
      }
      const payload = {
        id: gid,
        name,
        description: desc,
        type: createType,
        photo: safePhoto,
        photoURL: safePhoto,
        ownerId: me,
        createdBy: me,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        members,
        memberCount: Object.keys(members).length,
        lastMessage: "Group created",
        lastMessageAt: Date.now(),
        background: ""
      };
      try {
        await ref.set(payload);
      } catch (ge) {
        console.warn("groups/ write failed, using userChats only", ge);
      }

      const chatMeta = {
        chatId: gid,
        groupId: gid,
        isGroup: true,
        chatType: createType,
        name: name,
        photo: safePhoto || "",
        photoURL: safePhoto || "",
        ownerId: me,
        updatedAt: Date.now(),
        lastMessage: "Group created",
        lastMessageAt: Date.now(),
        unread: 0
      };
      const updates = {};
      Object.keys(members).forEach((uid) => {
        updates["userChats/" + uid + "/" + gid] = Object.assign({}, chatMeta, {
          unread: uid === me ? 0 : 1
        });
      });
      updates["chats/" + gid + "/meta"] = {
        isGroup: true,
        type: createType,
        name: name,
        photo: safePhoto || "",
        createdBy: me
      };
      var sysKey = db.ref("chats/" + gid + "/messages").push().key;
      updates["chats/" + gid + "/messages/" + sysKey] = {
        type: "system",
        text: name + " was created",
        senderId: me,
        createdAt: Date.now()
      };
      await db.ref().update(updates);

      toast(
        ((TYPE_META[createType] || TYPE_META.group).pill || "Room") + " created"
      );
      closeCreateSheet();
      try {
        var page = "group.html";
        if (createType === "podcast") page = "podcast.html";
        else if (createType === "community" || createType === "teamwork") page = "teamwork.html";
        setTimeout(function () {
          location.href = page + "?id=" + encodeURIComponent(gid);
        }, 400);
      } catch (_) {
        setTimeout(function () {
          try {
            if (typeof loadChats === "function") loadChats();
            else if (typeof refreshChats === "function") refreshChats();
            else location.reload();
          } catch (__) {
            location.reload();
          }
        }, 500);
      }
    } catch (e) {
      console.error("[VIEWORA] create group", e);
      var msg = (e && e.message) ? String(e.message) : "Could not create";
      if (/permission|PERMISSION/i.test(msg)) {
        msg = "Permission denied — check Firebase rules for groups/";
      } else if (/not found|404/i.test(msg)) {
        msg = "Create failed — rules or network issue";
      }
      toast(msg);
      if (sub) {
        sub.disabled = false;
        sub.textContent = "Create";
      }
    }
  }


  async function loadMyPrivileges() {
    var out = {
      blue: false,
      red: false,
      white: false,
      monetized: false,
      influencer: false,
      followers: 0,
      photo: "",
      name: ""
    };
    try {
      var uid = me || (firebase.auth().currentUser && firebase.auth().currentUser.uid);
      if (!uid) return out;
      var s = await firebase.database().ref("users/" + uid).once("value");
      var u = s.val() || {};
      out.blue = !!(u.verified || u.blueTick || u.tick === "blue" || u.badge === "blue");
      out.red = !!(u.redTick || u.tick === "red" || u.vip);
      out.white = !!(u.whiteTick || u.tick === "white");
      out.monetized = !!(u.monetized || u.monetization || u.monetizationEnabled);
      out.influencer = !!(u.influencer || u.role === "influencer" || u.creator);
      out.followers = Number(u.followersCount || u.followers || 0) || 0;
      if (!out.followers) {
        try {
          var fs = await firebase.database().ref("followers/" + uid).once("value");
          if (fs.exists()) out.followers = fs.numChildren();
        } catch (_) {}
      }
      out.photo = u.profilePhoto || u.photoURL || u.avatar || "";
      out.name = u.displayName || u.name || u.username || "";
    } catch (e) {
      console.warn("priv", e);
    }
    window.__vieworaPriv = out;
    return out;
  }

  function canCreateRoomType(type) {
    var p = window.__vieworaPriv || {};
    var creator = !!(p.blue || p.red || p.monetized || p.influencer);
    if (type === "group") return true;
    if (type === "teamwork") return creator || Number(p.followers || 0) >= 10000;
    if (type === "community" || type === "podcast") return creator;
    return false;
  }

  function applyCreateGates() {
    document.querySelectorAll(".gatedType, [data-need]").forEach(function (btn) {
      var type = btn.getAttribute("data-create") || "";
      var ok = canCreateRoomType(type);
      btn.classList.toggle("hidden", !ok);
      btn.style.display = ok ? "" : "none";
    });
  }


  function openMyNoteEditor() {
    var cur = "";
    try { cur = ($("myNoteLabel") && $("myNoteLabel").dataset.text) || ""; } catch (_) {}
    openNoteSheet(cur);
  }

  function openNoteSheet(cur) {
    var sheet = document.getElementById("createSheet") || document.getElementById("newChatModal");
    // lightweight overlay
    var wrap = document.getElementById("noteEditor");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "noteEditor";
      wrap.className = "noteEditor";
      wrap.innerHTML =
        '<div class="noteEditorCard">' +
        '<div class="noteEditorHead"><img id="noteEditorAvatar" src="assets/default-avatar.png" alt=""><h3>Your note</h3></div>' +
        '<textarea id="noteTextInput" maxlength="60" placeholder="Share a thought…"></textarea>' +
        '<div class="noteEditorActions">' +
        '<button type="button" id="noteSaveBtn">Share</button>' +
        '<button type="button" id="noteClearBtn">Remove</button>' +
        '<button type="button" id="noteCancelBtn">Cancel</button>' +
        "</div></div>";
      document.body.appendChild(wrap);
      wrap.addEventListener("click", function (e) {
        if (e.target === wrap) wrap.classList.add("hidden");
      });
      document.getElementById("noteCancelBtn").onclick = function () {
        wrap.classList.add("hidden");
      };
      document.getElementById("noteClearBtn").onclick = async function () {
        await saveNote("");
        wrap.classList.add("hidden");
      };
      document.getElementById("noteSaveBtn").onclick = async function () {
        var t = (document.getElementById("noteTextInput").value || "").trim();
        await saveNote(t);
        wrap.classList.add("hidden");
      };
    }
    wrap.classList.remove("hidden");
    var ta = document.getElementById("noteTextInput");
    if (ta) {
      ta.value = cur || "";
      ta.focus();
    }
    var av = document.getElementById("noteEditorAvatar") || document.getElementById("myNoteAvatar");
    var src = (document.getElementById("myNoteAvatar") && document.getElementById("myNoteAvatar").src) || "";
    if (document.getElementById("noteEditorAvatar") && src) {
      document.getElementById("noteEditorAvatar").src = src;
    }
    try {
      var uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
      if (uid) {
        firebase.database().ref("users/" + uid).once("value").then(function (s) {
          var u = s.val() || {};
          var ph = u.profilePhoto || u.photoURL || u.avatar || "";
          if (ph) {
            if (document.getElementById("noteEditorAvatar")) document.getElementById("noteEditorAvatar").src = ph;
            if (document.getElementById("myNoteAvatar")) document.getElementById("myNoteAvatar").src = ph;
          }
        });
      }
    } catch (_) {}
  }

  async function saveNote(text) {
    var uid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) || me || messagesUID || "";
    if (!uid) {
      toast("Login required");
      return;
    }
    var db = firebase.database();
    var p = window.__vieworaPriv || {};
    var photo = p.photo || "";
    try {
      if (!photo) {
        var us = await db.ref("users/" + uid).once("value");
        var u = us.val() || {};
        photo = u.profilePhoto || u.photoURL || u.avatar || "";
        p.name = p.name || u.displayName || u.name || u.username || "";
      }
    } catch (_) {}
    try {
      if (!text) {
        await db.ref("userNotes/" + uid).remove();
        await db.ref("users/" + uid + "/note").remove();
        toast("Note removed");
      } else {
        var payload = {
          text: text.slice(0, 60),
          updatedAt: Date.now(),
          name: p.name || "",
          photo: photo || ""
        };
        await db.ref("userNotes/" + uid).set(payload);
        await db.ref("users/" + uid + "/note").set(payload);
        toast("Note shared");
      }
      var av = document.getElementById("myNoteAvatar");
      if (av && photo) av.src = photo;
    } catch (e) {
      console.error("saveNote", e);
      toast("Note not saved — check login / rules");
    }
    loadNotesStrip();
  }

  async function loadNotesStrip() {
    // notes strip
    var box = document.getElementById("friendsNotes");
    var uid =
      (firebase.auth().currentUser && firebase.auth().currentUser.uid) ||
      me ||
      (typeof messagesUID !== "undefined" ? messagesUID : "") ||
      "";
    if (!uid) return;
    var db = firebase.database();

    // My note + avatar (24h)
    try {
      var mine = await db.ref("userNotes/" + uid).once("value");
      var mv = mine.val();
      if (!mv || !mv.text) {
        var mn = await db.ref("users/" + uid + "/note").once("value");
        mv = mn.val();
      }
      var lab = document.getElementById("myNoteLabel");
      var expired =
        mv &&
        mv.updatedAt &&
        Date.now() - Number(mv.updatedAt) > 24 * 60 * 60 * 1000;
      var myBtn = document.getElementById("createNoteBtn");
      var existingBubble = myBtn && myBtn.querySelector(".noteBubble.myNoteBubble");
      if (existingBubble) existingBubble.remove();
      if (lab) {
        if (mv && mv.text && !expired) {
          lab.textContent = "Your note";
          lab.dataset.text = String(mv.text);
          if (myBtn) {
            var b = document.createElement("span");
            b.className = "noteBubble myNoteBubble";
            b.textContent = String(mv.text).slice(0, 40);
            myBtn.insertBefore(b, myBtn.firstChild);
          }
        } else {
          lab.textContent = "Your note";
          lab.dataset.text = "";
          if (expired) {
            try {
              await db.ref("userNotes/" + uid).remove();
              await db.ref("users/" + uid + "/note").remove();
            } catch (_) {}
          }
        }
      }
      var us = await db.ref("users/" + uid).once("value");
      var meU = us.val() || {};
      var ph =
        meU.profilePhoto ||
        meU.photoURL ||
        meU.avatar ||
        (mv && mv.photo) ||
        "";
      var av = document.getElementById("myNoteAvatar");
      if (av) {
        if (ph) av.src = ph;
        av.style.display = "block";
        av.onerror = function () {
          this.src = "assets/default-avatar.png";
        };
      }
    } catch (e) {
      console.warn("my note", e);
    }

    if (!box) return;

    // Only: following + people you already chat with
    var idSet = {};
    try {
      var fs = await db.ref("following/" + uid).once("value");
      Object.keys(fs.val() || {}).forEach(function (k) {
        if (k && k !== uid) idSet[k] = true;
      });
    } catch (_) {}
    try {
      var chats = await db.ref("userChats/" + uid).once("value");
      chats.forEach(function (c) {
        var ch = c.val() || {};
        if (ch.isGroup || ch.groupId) return;
        var peer = ch.userId || ch.uid || ch.peerId || "";
        if (peer && peer !== uid) idSet[peer] = true;
      });
    } catch (_) {}

    var ids = Object.keys(idSet).slice(0, 40);
    var notes = [];

    for (var i = 0; i < ids.length; i++) {
      try {
        var fid = ids[i];
        var n = null;
        var ns = await db.ref("userNotes/" + fid).once("value");
        n = ns.val();
        if (!n || !n.text) {
          var n2 = await db.ref("users/" + fid + "/note").once("value");
          n = n2.val();
        }
        if (!n || !n.text) continue;
        if (n.updatedAt && Date.now() - Number(n.updatedAt) > 24 * 60 * 60 * 1000)
          continue;
        var u = {};
        try {
          var us2 = await db.ref("users/" + fid).once("value");
          u = us2.val() || {};
        } catch (_) {}
        var myReact = "";
        try {
          var rs = await db
            .ref("userNotes/" + fid + "/reactions/" + uid)
            .once("value");
          if (rs.exists()) myReact = rs.val().emoji || rs.val() || "";
        } catch (_) {}
        notes.push({
          uid: fid,
          text: String(n.text).slice(0, 60),
          photo:
            u.profilePhoto ||
            u.photoURL ||
            u.avatar ||
            n.photo ||
            "assets/default-avatar.png",
          name: u.displayName || u.name || u.username || n.name || "User",
          username: u.username || "",
          at: Number(n.updatedAt || 0),
          myReact: typeof myReact === "string" ? myReact : ""
        });
      } catch (_) {}
    }

    notes.sort(function (a, b) {
      return b.at - a.at;
    });

    box.innerHTML = notes
      .map(function (n) {
        return (
          '<button type="button" class="noteItem friendNote" data-uid="' +
          n.uid +
          '" data-text="' +
          String(n.text).replace(/"/g, "&quot;") +
          '" data-name="' +
          String(n.name).replace(/"/g, "&quot;") +
          '">' +
          '<span class="noteAvatar"><img src="' +
          String(n.photo).replace(/"/g, "") +
          '" alt="" onerror="this.src=\'assets/default-avatar.png\'"></span>' +
          '<span class="noteBubble">' +
          String(n.text).replace(/</g, "&lt;") +
          (n.myReact
            ? '<span class="noteReactBadge">' + n.myReact + "</span>"
            : "") +
          "</span>" +
          '<span class="noteLabel">' +
          String(n.username || n.name).replace(/</g, "&lt;") +
          "</span></button>"
        );
      })
      .join("");

    box.querySelectorAll(".friendNote").forEach(function (btn) {
      var lastTap = 0;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var now = Date.now();
        var uid = btn.getAttribute("data-uid");
        var text = btn.getAttribute("data-text") || "";
        var name = btn.getAttribute("data-name") || "User";
        if (now - lastTap < 320) {
          lastTap = 0;
          clearTimeout(btn.__noteTapTimer);
          reactToNote(uid, "❤️");
          return;
        }
        lastTap = now;
        clearTimeout(btn.__noteTapTimer);
        btn.__noteTapTimer = setTimeout(function () {
          openNoteActionSheet(uid, text, name);
        }, 300);
      });
    });
  }

  function openNoteActionSheet(targetUid, noteText, name) {
    if (!targetUid) return;
    var wrap = document.getElementById("noteActionSheet");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "noteActionSheet";
      wrap.className = "noteActionSheet";
      wrap.innerHTML =
        '<div class="noteActionCard">' +
        '<div class="noteActionHead">' +
        '<strong id="noteActName">Note</strong>' +
        '<p id="noteActText" class="muted"></p></div>' +
        '<div class="noteEmojiRow" id="noteEmojiRow">' +
        ["❤️", "😂", "🔥", "👏", "😍", "😮", "👍", "🙌"]
          .map(function (e) {
            return (
              '<button type="button" class="noteEmojiBtn" data-emoji="' +
              e +
              '">' +
              e +
              "</button>"
            );
          })
          .join("") +
        "</div>" +
        '<div class="noteReplyRow">' +
        '<input type="text" id="noteReplyInput" maxlength="200" placeholder="Reply to note…">' +
        '<button type="button" id="noteReplySend"><i class="fa-solid fa-paper-plane"></i></button>' +
        "</div>" +
        '<button type="button" class="noteMsgChatBtn" id="noteMsgChatBtn">Message</button>' +
        '<button type="button" class="noteActionCancel" id="noteActCancel">Close</button>' +
        "</div>";
      document.body.appendChild(wrap);
      wrap.addEventListener("click", function (e) {
        if (e.target === wrap) wrap.classList.add("hidden");
      });
      document.getElementById("noteActCancel").onclick = function () {
        wrap.classList.add("hidden");
      };
      document.getElementById("noteMsgChatBtn").onclick = function () {
        var u = wrap.dataset.uid;
        if (u) location.href = "chat.html?uid=" + encodeURIComponent(u);
      };
    }
    wrap.classList.remove("hidden");
    wrap.dataset.uid = targetUid;
    var msgBtn = document.getElementById("noteMsgChatBtn");
    if (msgBtn) {
      msgBtn.onclick = function () {
        location.href = "chat.html?uid=" + encodeURIComponent(targetUid);
      };
    }
    var nm = document.getElementById("noteActName");
    var tx = document.getElementById("noteActText");
    if (nm) nm.textContent = name || "Note";
    if (tx) tx.textContent = noteText || "";

    document.querySelectorAll(".noteEmojiBtn").forEach(function (btn) {
      btn.onclick = async function () {
        await reactToNote(targetUid, btn.getAttribute("data-emoji"));
        wrap.classList.add("hidden");
      };
    });
    document.getElementById("noteReplySend").onclick = async function () {
      var input = document.getElementById("noteReplyInput");
      var text = (input && input.value.trim()) || "";
      if (!text) return;
      await replyToNote(targetUid, noteText, text);
      if (input) input.value = "";
      wrap.classList.add("hidden");
    };
  }

  async function reactToNote(targetUid, emoji) {
    var myUid =
      (firebase.auth().currentUser && firebase.auth().currentUser.uid) || "";
    if (!myUid || !targetUid || !emoji) return;
    try {
      await firebase
        .database()
        .ref("userNotes/" + targetUid + "/reactions/" + myUid)
        .set({ emoji: emoji, at: Date.now() });
      // also lightweight activity for owner
      try {
        await firebase
          .database()
          .ref("activity/" + targetUid)
          .push({
            type: "note_react",
            from: myUid,
            emoji: emoji,
            createdAt: Date.now()
          });
      } catch (_) {}
      toast(emoji + " reacted");
      loadNotesStrip();
    } catch (e) {
      console.error(e);
      toast("Could not react");
    }
  }

  async function replyToNote(targetUid, noteText, replyText) {
    var myUid =
      (firebase.auth().currentUser && firebase.auth().currentUser.uid) || "";
    if (!myUid || !targetUid) return;
    var db = firebase.database();
    try {
      // open/send as normal chat message so it lands in chat
      var ids = [myUid, targetUid].sort();
      var chatId = ids[0] + "_" + ids[1];
      var preview = "Note reply: " + replyText.slice(0, 80);
      var msg = {
        type: "note_reply",
        text: replyText.slice(0, 200),
        noteText: String(noteText || "").slice(0, 60),
        senderId: myUid,
        createdAt: Date.now()
      };
      await db.ref("vieworaChats/" + chatId + "/messages").push(msg);
      try {
        await db.ref("chats/" + chatId + "/messages").push(msg);
      } catch (_) {}
      var myName = "";
      var myPhoto = "";
      try {
        var us = await db.ref("users/" + myUid).once("value");
        var u = us.val() || {};
        myName = u.displayName || u.name || u.username || "User";
        myPhoto = u.profilePhoto || u.photoURL || "";
      } catch (_) {}
      await db.ref("userChats/" + targetUid + "/" + chatId).update({
        chatId: chatId,
        userId: myUid,
        name: myName,
        photoURL: myPhoto,
        lastMessage: preview,
        lastMessageTime: Date.now(),
        unread: firebase.database.ServerValue.increment
          ? firebase.database.ServerValue.increment(1)
          : 1
      });
      await db.ref("userChats/" + myUid + "/" + chatId).update({
        chatId: chatId,
        userId: targetUid,
        lastMessage: preview,
        lastMessageTime: Date.now(),
        unread: 0
      });
      toast("Reply sent");
      // optional: stay on messages; user can open chat
    } catch (e) {
      console.error(e);
      toast("Reply failed");
    }
  }


  function bind() {
    // note strip + modal create type buttons
    document.querySelectorAll("[data-create]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const type = btn.getAttribute("data-create") || "group";
        // close new chat modal if open
        const modal = $("newChatModal");
        if (modal) modal.classList.add("hidden");
        openCreateSheet(type);
      });
    });

    document.querySelectorAll("[data-close-create]").forEach((el) => {
      el.addEventListener("click", closeCreateSheet);
    });

    $("groupNameInput")?.addEventListener("input", updateCreateState);
    $("memberSearchInput")?.addEventListener("input", function () {
      renderMembers(this.value);
    });
    $("createGroupSubmit")?.addEventListener("click", submitCreate);

    $("groupPhotoBtn")?.addEventListener("click", () => {
      $("groupPhotoInput")?.click();
    });
    $("groupPhotoInput")?.addEventListener("change", function () {
      const file = this.files && this.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast("Image max 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        photoDataUrl = String(reader.result || "");
        const prev = $("groupPhotoPreview");
        const btn = $("groupPhotoBtn");
        if (prev) {
          prev.src = photoDataUrl;
          prev.classList.remove("hidden");
        }
        if (btn) btn.classList.add("hidden");
      };
      reader.readAsDataURL(file);
    });
    $("groupPhotoPreview")?.addEventListener("click", () => {
      $("groupPhotoInput")?.click();
    });

    $("requestsBtn")?.addEventListener("click", () => {
      location.href = "request.html";
    });

    $("createNoteBtn")?.addEventListener("click", openMyNoteEditor);
    loadNotesStrip();
    loadMyPrivileges().then(function (p) {
      applyCreateGates();
      var av = $("myNoteAvatar");
      if (av && p.photo) av.src = p.photo;
    });
    const openNew = () => {
      location.href = "users.html";
    };
    $("newChatBtnSearch")?.addEventListener("click", function (e) {
        e.preventDefault();
        location.href = "users.html";
    });
    // findUsersBtn is an <a href="users.html"> — no blur modal
    $("newChatBtn")?.addEventListener("click", openNew);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }

  // Expose for list rendering of group chats
  window.loadNotesStrip = loadNotesStrip;
  window.VieworaGroupChat = {
    openCreate: openCreateSheet,
    isGroupChat: function (data) {
      return !!(data && (data.isGroup || data.groupId || data.chatType === "group" || data.chatType === "community" || data.chatType === "podcast"));
    },
    typeLabel: function (t) {
      return (TYPE_META[t] || {}).pill || "Group";
    }
  };
})();
