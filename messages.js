// ==========================================
// VIEWORA MESSAGES V4.0
// PART 1
// Authentication + Load Chats
// ==========================================

let currentUser = null;
let currentUserData = null;
let chatList = [];

// ==========================================
// Authentication
// ==========================================

auth.onAuthStateChanged(async (user) => {

    if (!user) {

        location.href = "login.html";
        return;

    }

    currentUser = user;

    await loadCurrentUser();

    loadChats();

});

// ==========================================
// Load Current User
// ==========================================

async function loadCurrentUser() {

    const snap = await db
        .ref("users/" + currentUser.uid)
        .once("value");

    currentUserData = snap.val() || {};

}

// ==========================================
// Load Chats
// ==========================================

function loadChats() {

    const container =
        document.getElementById("messagesList");

    if (!container) return;

    db.ref("chats")

    .orderByChild("lastMessageTime")

    .on("value", (snapshot) => {

        chatList = [];

        container.innerHTML = "";

        if (!snapshot.exists()) {

            container.innerHTML = `

            <div class="empty-chat">

                <h3>No Chats</h3>

                <p>Start chatting with your friends 👋</p>

            </div>

            `;

            return;

        }

        snapshot.forEach((child) => {

            const chat = child.val();

            if (!chat) return;

            // Compatible with Chat.js V4
            if (
                chat.participants &&
                chat.participants[currentUser.uid]
            ) {

                chatList.push({

                    id: child.key,

                    ...chat

                });

            }

        });

        // Latest Chat First
        chatList.sort((a, b) => {

            return (b.lastMessageTime || 0) -
                   (a.lastMessageTime || 0);

        });

        renderChats();

    });

}

console.log("✅ Messages V4 Part 1 Loaded");
// ==========================================
// VIEWORA MESSAGES V4.0
// PART 2
// Render Chats + Online Status + Search
// ==========================================

function renderChats() {

    const container =
        document.getElementById("messagesList");

    if (!container) return;

    container.innerHTML = "";

    chatList.forEach((chat) => {

        // Get Other User UID
        const otherUid =
            Object.keys(chat.participants)
            .find(uid => uid !== currentUser.uid);

        if (!otherUid) return;

        db.ref("users/" + otherUid)

        .once("value")

        .then((snap) => {

            const user = snap.val() || {};

            const card =
                document.createElement("div");

            card.className = "chat-item";

            card.innerHTML = `

            <img
            src="${user.profilePhoto || "non.jpg"}"
            class="chat-avatar"
            data-user="${otherUid}">

            <div class="chat-info">

                <div class="chat-name">

                    ${user.name || "User"}

                </div>

                <div class="chat-last">

                    ${chat.lastMessage || "Say Hi 👋"}

                </div>

            </div>

            <div
            style="text-align:right;">

                <div
                class="chat-time"
                id="time-${otherUid}">

                </div>

                <div
                class="unread-badge"
                id="badge-${chat.id}"
                style="display:none;">

                </div>

            </div>

            `;

            card.onclick = () => {

                location.href =
                    "chat.html?uid=" + otherUid;

            };

            container.appendChild(card);

            updateChatTime(
                otherUid,
                chat.lastMessageTime
            );

            updateOnline(otherUid);

            updateUnread(chat.id);

        });

    });

}

// ==========================================
// Online Status
// ==========================================

function updateOnline(uid){

    db.ref("status/" + uid)

    .on("value",(snap)=>{

        const avatar =
            document.querySelector(
                `img[data-user="${uid}"]`
            );

        if(!avatar) return;

        const data = snap.val() || {};

        avatar.style.border =

            data.online

            ? "3px solid #00ff66"

            : "3px solid #555";

    });

}

// ==========================================
// Search Chats
// ==========================================

const searchInput =
document.getElementById("searchInput");

if(searchInput){

searchInput.addEventListener("input",function(){

const keyword =
this.value
.toLowerCase()
.trim();

document
.querySelectorAll(".chat-item")

.forEach((card)=>{

const name =
card.querySelector(".chat-name")
.innerText
.toLowerCase();

card.style.display =

name.includes(keyword)

? "flex"

: "none";

});

});

}

console.log("✅ Messages V4 Part 2 Loaded");
// ======================================
// MESSAGES.JS V3.0
// PART 3
// Realtime + Presence + Notifications
// ======================================

// Realtime refresh
db.ref("chats").on("child_changed", () => {
    loadChats();
});

// -------------------------
// User Presence
// -------------------------

const connectedRef = firebase.database().ref(".info/connected");

connectedRef.on("value", (snap) => {

    if (!currentUser || !snap.val()) return;

    const statusRef = db.ref("status/" + currentUser.uid);

    statusRef.onDisconnect().set({
        online: false,
        lastSeen: Date.now()
    });

    statusRef.set({
        online: true,
        lastSeen: Date.now()
    });

});

// -------------------------
// Notification Sound
// -------------------------

let firstLoad = true;

db.ref("chats").on("child_added", (snap) => {

    if (firstLoad) return;

    const chat = snap.val();

    if (!chat || !chat.participants) return;

    const participants = Array.isArray(chat.participants)
        ? chat.participants
        : Object.keys(chat.participants);

    if (!participants.includes(currentUser.uid)) return;

    const audio = new Audio("notification.mp3");
    audio.play().catch(() => {});

});

setTimeout(() => {
    firstLoad = false;
}, 1500);

// -------------------------
// Auto Refresh Every Minute
// -------------------------

setInterval(() => {

    chatList.forEach(chat => {

        const participants = Array.isArray(chat.participants)
            ? chat.participants
            : Object.keys(chat.participants);

        const otherUid = participants.find(
            uid => uid !== currentUser.uid
        );

        updateChatTime(otherUid, chat.lastMessageTime);

    });

}, 60000);

// -------------------------
// Network Status
// -------------------------

window.addEventListener("offline", () => {

    console.log("Offline");

});

window.addEventListener("online", () => {

    console.log("Online");

    loadChats();

});

// -------------------------
// Search Refresh
// -------------------------

window.refreshMessages = function () {

    loadChats();

};

// ======================================

console.log("✅ Messages V3.0 Loaded Successfully");
// ======================================
// MESSAGES.JS V3.0
// PART 4
// Chat Actions + Final
// ======================================

// -------------------------
// Delete Chat
// -------------------------

window.deleteChat = function (chatId) {

    if (!confirm("Delete this chat?")) return;

    db.ref("chats/" + chatId)
        .remove()
        .then(() => {

            alert("Chat Deleted");

        });

};

// -------------------------
// Pin Chat
// -------------------------

window.pinChat = function (chatId) {

    db.ref("chats/" + chatId + "/pinned")
        .set(true)
        .then(loadChats);

};

// -------------------------
// Unpin Chat
// -------------------------

window.unpinChat = function (chatId) {

    db.ref("chats/" + chatId + "/pinned")
        .remove()
        .then(loadChats);

};

// -------------------------
// Archive Chat
// -------------------------

window.archiveChat = function (chatId) {

    db.ref("chats/" + chatId + "/archived")
        .set(true)
        .then(loadChats);

};

// -------------------------
// Unarchive Chat
// -------------------------

window.unarchiveChat = function (chatId) {

    db.ref("chats/" + chatId + "/archived")
        .remove()
        .then(loadChats);

};

// -------------------------
// Check Block
// -------------------------

async function isBlocked(otherUid) {

    const snap = await db
        .ref("blockedUsers/" + currentUser.uid + "/" + otherUid)
        .once("value");

    return snap.exists();

}

// -------------------------
// Logout Presence
// -------------------------

window.addEventListener("beforeunload", () => {

    if (!currentUser) return;

    db.ref("status/" + currentUser.uid)
        .update({

            online: false,
            lastSeen: Date.now()

        });

});

// -------------------------
// Refresh
// -------------------------

window.refreshChats = function () {

    loadChats();

};

// -------------------------
// Utility
// -------------------------

function getOtherUid(chat) {

    const participants = Array.isArray(chat.participants)
        ? chat.participants
        : Object.keys(chat.participants || {});

    return participants.find(uid => uid !== currentUser.uid);

}

// -------------------------
// Version
// -------------------------

console.log("✅ Messages.js V3.0 Final Loaded");