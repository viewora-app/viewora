// ===============================
// MESSAGES.JS V2.0 - PART 1
// Login + Load Chats
// ===============================

let currentUser = null;
let chatList = [];

auth.onAuthStateChanged((user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    loadChats();

});

// ===============================
// Load Chats
// ===============================

function loadChats() {

    const container = document.getElementById("messagesList");

    if (!container) return;

    db.ref("chats")
        .orderByChild("lastMessageTime")
        .on("value", (snapshot) => {

            chatList = [];

            if (!snapshot.exists()) {

                container.innerHTML = `
                <div class="empty-chat">
                    <h3>No Messages</h3>
                    <p>Start chatting with your friends.</p>
                </div>
                `;

                return;
            }

            snapshot.forEach((child) => {

                const chat = child.val();

                if (
                    chat.participants &&
                    chat.participants.includes(currentUser.uid)
                ) {

                    chatList.push({

                        id: child.key,

                        ...chat

                    });

                }

            });

            chatList.sort((a, b) => {

                return (b.lastMessageTime || 0) -
                       (a.lastMessageTime || 0);

            });

            renderChats();

        });

}

// ===============================
// Render Chats
// ===============================

function renderChats() {

    const container = document.getElementById("messagesList");

    if (!container) return;

    container.innerHTML = "";

    chatList.forEach((chat) => {

        const otherUid =
            chat.participants.find(uid => uid !== currentUser.uid);

        db.ref("users/" + otherUid)
            .once("value")
            .then((snap) => {

                const user = snap.val() || {};

                const card = document.createElement("div");

                card.className = "chat-item";

                card.innerHTML = `

                <img
                src="${user.profilePhoto || "non.jpg"}"
                class="chat-avatar">

                <div class="chat-info">

                    <div class="chat-name">
                        ${user.name || "User"}
                    </div>

                    <div class="chat-last">
                        ${chat.lastMessage || "Say Hi 👋"}
                    </div>

                </div>

                <div class="chat-time"
                     id="time-${otherUid}">
                </div>

                `;

                card.onclick = function () {

                    window.location.href =
                    "chat.html?uid=" + otherUid;

                };

                container.appendChild(card);

            });

    });

}
// ===============================
// MESSAGES.JS V2.0 - PART 2
// Search + Time + Unread + Online
// ===============================

// Search Chats
const searchInput = document.getElementById("searchInput");

if (searchInput) {

    searchInput.addEventListener("input", function () {

        const keyword = this.value.toLowerCase().trim();

        document.querySelectorAll(".chat-item").forEach((item) => {

            const name =
                item.querySelector(".chat-name")
                .innerText
                .toLowerCase();

            item.style.display =
                name.includes(keyword)
                    ? "flex"
                    : "none";

        });

    });

}

// ===============================
// Format Time
// ===============================

function formatTime(time) {

    if (!time) return "";

    const date = new Date(time);

    const now = new Date();

    const diff = now - date;

    if (diff < 60000)
        return "Now";

    if (diff < 3600000)
        return Math.floor(diff / 60000) + "m";

    if (diff < 86400000)
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

    return date.toLocaleDateString();

}

// ===============================
// Update Chat Time
// ===============================

function updateChatTime(uid, time) {

    const el =
        document.getElementById("time-" + uid);

    if (el) {

        el.innerText = formatTime(time);

    }

}

// ===============================
// Unread Badge
// ===============================

function showUnread(uid, count) {

    const card =
        document.querySelector(
            `[onclick="window.location.href='chat.html?uid=${uid}'"]`
        );

    if (!card) return;

    let badge = card.querySelector(".unread-badge");

    if (!badge) {

        badge = document.createElement("div");

        badge.className = "unread-badge";

        badge.style.cssText = `
            background:#00aaff;
            color:#fff;
            width:22px;
            height:22px;
            border-radius:50%;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:12px;
            font-weight:bold;
            margin-left:8px;
        `;

        card.appendChild(badge);

    }

    badge.innerText = count;

}

// ===============================
// Online Status
// ===============================

function updateOnline(uid) {

    db.ref("status/" + uid)
        .on("value", (snap) => {

            const online = snap.val();

            const avatar =
                document.querySelector(
                    `img[data-user="${uid}"]`
                );

            if (!avatar) return;

            avatar.style.border =
                online
                ? "3px solid #00ff66"
                : "3px solid #555";

        });

}

// ===============================
// Auto Refresh Time
// ===============================

setInterval(() => {

    chatList.forEach((chat) => {

        const uid =
            chat.participants.find(
                u => u !== currentUser.uid
            );

        updateChatTime(
            uid,
            chat.lastMessageTime
        );

    });

}, 30000);
// ===============================
// MESSAGES.JS V2.0 - PART 3
// Final Features
// ===============================

// Realtime Refresh
db.ref("chats").on("child_changed", () => {

    loadChats();

});

// ===============================
// Delete Chat
// ===============================

window.deleteChat = function(chatId){

    if(!confirm("Delete this chat?"))
        return;

    db.ref("chats/" + chatId)
        .remove()
        .then(()=>{

            alert("Chat Deleted");

        });

};

// ===============================
// Pin Chat
// ===============================

window.pinChat = function(chatId){

    db.ref("chats/" + chatId + "/pinned")
        .set(true);

    loadChats();

};

// ===============================
// Archive Chat
// ===============================

window.archiveChat = function(chatId){

    db.ref("chats/" + chatId + "/archived")
        .set(true);

    loadChats();

};

// ===============================
// Typing Indicator
// ===============================

window.setTyping = function(uid,state){

    if(!currentUser) return;

    db.ref("typing/" + uid + "/" + currentUser.uid)
        .set(state);

};

window.listenTyping = function(uid){

    db.ref("typing/" + currentUser.uid + "/" + uid)
        .on("value",(snap)=>{

            const box =
                document.getElementById("typingStatus");

            if(!box) return;

            box.innerText =
                snap.val()
                ? "Typing..."
                : "";

        });

};

// ===============================
// Mark Messages Read
// ===============================

window.markAsRead = function(chatId){

    db.ref("chats/" + chatId + "/unread/" + currentUser.uid)
        .set(0);

};

// ===============================
// User Presence
// ===============================

window.addEventListener("beforeunload",()=>{

    if(currentUser){

        db.ref("status/" + currentUser.uid)
            .set(false);

    }

});

if(currentUser){

    db.ref("status/" + currentUser.uid)
        .set(true);

}

// ===============================
// Network Status
// ===============================

window.addEventListener("offline",()=>{

    alert("No Internet Connection");

});

window.addEventListener("online",()=>{

    console.log("Internet Connected");

});

// ===============================
// End
// ===============================

console.log("✅ Messages V2.0 Loaded Successfully");