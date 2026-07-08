// ============================================
// VIEWORA CHAT V5.0
// PART 1
// Authentication + Initialization
// ============================================

let currentUser = null;
let currentUserData = null;

let otherUserUid = null;
let otherUserData = null;

let chatId = null;

// ============================================
// Get UID From URL
// ============================================

function getOtherUserUid() {

    const params = new URLSearchParams(window.location.search);

    return params.get("uid");

}

// ============================================
// Generate Chat ID
// ============================================

function generateChatId(uid1, uid2) {

    return [uid1, uid2].sort().join("_");

}

// ============================================
// Authentication
// ============================================

auth.onAuthStateChanged(async (user) => {

    if (!user) {

        location.href = "login.html";
        return;

    }

    currentUser = user;

    otherUserUid = getOtherUserUid();

    if (!otherUserUid) {

        alert("Invalid User");

        history.back();

        return;

    }

    chatId = generateChatId(
        currentUser.uid,
        otherUserUid
    );

    await loadCurrentUser();

    await loadOtherUser();

    createChatRoom();

    setupPresence();

    listenOtherUserStatus();

    checkIfBlocked();

    loadMessages();

    listenTyping();

});

// ============================================
// Load Current User
// ============================================

async function loadCurrentUser() {

    const snap = await db
        .ref("users/" + currentUser.uid)
        .once("value");

    currentUserData = snap.val() || {};

}

// ============================================
// Load Other User
// ============================================

async function loadOtherUser() {

    const snap = await db
        .ref("users/" + otherUserUid)
        .once("value");

    otherUserData = snap.val() || {};

    document.getElementById("chatUserPhoto").src =
        otherUserData.profilePhoto || "non.jpg";

    document.getElementById("chatUserName").innerText =
        otherUserData.name || "User";

}

// ============================================
// Create Chat Room
// ============================================

function createChatRoom() {

    db.ref("chats/" + chatId).update({

        participants: {

            [currentUser.uid]: true,
            [otherUserUid]: true

        }

    });

}

// ============================================
// Firebase Presence
// ============================================

function setupPresence() {

    const connectedRef =
        firebase.database().ref(".info/connected");

    connectedRef.on("value", (snap) => {

        if (!snap.val()) return;

        const myStatus =
            db.ref("status/" + currentUser.uid);

        myStatus.onDisconnect().set({

            online: false,
            lastSeen: Date.now()

        });

        myStatus.set({

            online: true,
            lastSeen: Date.now()

        });

    });

}

// ============================================
// Listen Other User Status
// ============================================

function listenOtherUserStatus() {

    const status =
        document.getElementById("chatStatus");

    db.ref("status/" + otherUserUid)

    .on("value", (snap) => {

        if (!snap.exists()) {

            status.innerHTML = "⚫ Offline";
            status.style.color = "#999";
            return;

        }

        const data = snap.val();

        if (data.online) {

            status.innerHTML = "🟢 Online";
            status.style.color = "#00ff66";

        }

        else {

            status.innerHTML =
                "Last seen " +
                new Date(data.lastSeen)
                .toLocaleTimeString([], {

                    hour: "2-digit",
                    minute: "2-digit"

                });

            status.style.color = "#999";

        }

    });

}

// ============================================
// Open User Profile
// ============================================

window.openAboutUser = function () {

    location.href =
        "profile.html?uid=" +
        otherUserUid;

};

// ============================================
// Check Block Status
// ============================================

async function checkIfBlocked() {

    const snap = await db

    .ref("blockedUsers/" +
         otherUserUid +
         "/" +
         currentUser.uid)

    .once("value");

    if (snap.exists()) {

        alert("You are blocked by this user.");

        history.back();

    }

}

// ============================================

console.log("✅ CHAT V5 PART 1 LOADED");
// ============================================
// VIEWORA CHAT V5.0
// PART 2
// Messages + Send + Seen
// ============================================

// ============================================
// Load Messages
// ============================================

function loadMessages() {

    const container =
        document.getElementById("messagesContainer");

    if (!container) return;

    db.ref("chats/" + chatId + "/messages")

    .on("value", (snapshot) => {

        container.innerHTML = "";

        if (!snapshot.exists()) {

            container.innerHTML = `
            <div class="empty-chat">
                👋 Start your conversation
            </div>`;

            return;

        }

        snapshot.forEach((child) => {

            const messageId = child.key;
            const msg = child.val();

            const mine =
                msg.senderUid === currentUser.uid;

            const bubble =
                document.createElement("div");

            bubble.className =
                mine
                ? "message sent"
                : "message received";

            // ===========================
            // Text / Image / Video
            // ===========================

            if (msg.type === "image") {

                bubble.innerHTML += `
                <img
                src="${msg.image}"
                class="chat-image">`;

            }

            else if (msg.type === "video") {

                bubble.innerHTML += `
                <video
                controls
                class="chat-video">
                <source src="${msg.video}">
                </video>`;

            }

            else {

                bubble.innerHTML += `
                <div class="message-text">

                    ${msg.text || ""}

                </div>`;

            }

            // Edited

            if (msg.edited) {

                bubble.innerHTML += `
                <div class="edited-label">

                    Edited

                </div>`;

            }

            // Time + Seen

            let ticks = "";

            if (mine) {

                ticks =
                msg.seen
                ? "✓✓"
                : "✓";

            }

            bubble.innerHTML += `

            <div class="message-info">

                ${formatTime(msg.timestamp)}

                <span class="ticks">

                    ${ticks}

                </span>

            </div>

            `;

            // Long Press

            bubble.oncontextmenu = (e) => {

                e.preventDefault();

                openMessageMenu(
                    messageId,
                    msg
                );

            };

            container.appendChild(bubble);

        });

        scrollMessagesBottom();

        markMessagesSeen();

    });

}

// ============================================
// Send Message
// ============================================

window.sendMessage = async function () {

    const input =
        document.getElementById("messageInput");

    if (!input) return;

    const text =
        input.value.trim();

    if (text === "")
        return;

    const message = {

        senderUid:
            currentUser.uid,

        receiverUid:
            otherUserUid,

        text: text,

        type: "text",

        timestamp:
            Date.now(),

        edited: false,

        seen: false

    };

    try {

        await db
        .ref("chats/" + chatId + "/messages")
        .push(message);

        await db
        .ref("chats/" + chatId)
        .update({

            lastMessage: text,

            lastMessageTime: Date.now()

        });

        input.value = "";

    }

    catch (e) {

        console.error(e);

        alert("Message not sent.");

    }

};

// ============================================
// Mark Messages Seen
// ============================================

function markMessagesSeen() {

    db.ref("chats/" + chatId + "/messages")

    .once("value")

    .then((snapshot) => {

        snapshot.forEach((child) => {

            const msg = child.val();

            if (

                msg.senderUid !== currentUser.uid &&

                !msg.seen

            ) {

                child.ref.update({

                    seen: true

                });

            }

        });

    });

}

// ============================================
// Format Time
// ============================================

function formatTime(time) {

    return new Date(time)

    .toLocaleTimeString([], {

        hour: "2-digit",

        minute: "2-digit"

    });

}

// ============================================
// Auto Scroll
// ============================================

function scrollMessagesBottom() {

    const container =
        document.getElementById("messagesContainer");

    if (!container) return;

    container.scrollTop =
        container.scrollHeight;

}

// ============================================
// Enter Key
// ============================================

document.addEventListener(

"DOMContentLoaded",

() => {

const input =
document.getElementById(
"messageInput"
);

if (!input) return;

input.addEventListener(
"keydown",

(e) => {

if (e.key === "Enter") {

e.preventDefault();

sendMessage();

}

});

});

// ============================================

console.log("✅ CHAT V5 PART 2 LOADED");
// ============================================
// VIEWORA CHAT V5.0
// PART 3
// Typing + Message Actions
// ============================================

// ============================================
// Typing Indicator
// ============================================

let typingTimer = null;

window.updateTyping = function () {

    db.ref("typing/" + chatId + "/" + currentUser.uid)
    .set(true);

    clearTimeout(typingTimer);

    typingTimer = setTimeout(() => {

        db.ref("typing/" + chatId + "/" + currentUser.uid)
        .set(false);

    }, 1200);

};

// Listen Other User Typing

function listenTyping() {

    const status =
        document.getElementById("chatStatus");

    db.ref("typing/" + chatId + "/" + otherUserUid)

    .on("value", (snap) => {

        if (snap.val()) {

            status.innerHTML = "✍️ Typing...";
            status.style.color = "#00aaff";

        } else {

            listenOtherUserStatus();

        }

    });

}

// Input Listener

document.addEventListener("DOMContentLoaded", () => {

    const input =
        document.getElementById("messageInput");

    if (!input) return;

    input.addEventListener("input", updateTyping);

});

// ============================================
// Long Press Menu
// ============================================

window.openMessageMenu = function(messageId, message){

    let option = prompt(

`Message Options

1 = Copy
2 = Edit
3 = Delete
4 = Share`

    );

    switch(option){

        case "1":

            copyMessage(message.text || "");

        break;

        case "2":

            if(message.senderUid === currentUser.uid){

                editMessage(messageId, message.text);

            }

        break;

        case "3":

            if(message.senderUid === currentUser.uid){

                deleteMessage(messageId);

            }

        break;

        case "4":

            shareMessage(message.text || "");

        break;

    }

};

// ============================================
// Copy Message
// ============================================

function copyMessage(text){

    navigator.clipboard.writeText(text)

    .then(()=>{

        showToast("Copied");

    });

}

// ============================================
// Share Message
// ============================================

function shareMessage(text){

    if(navigator.share){

        navigator.share({

            text:text

        });

    }else{

        copyMessage(text);

    }

}

// ============================================
// Edit Message
// ============================================

function editMessage(messageId, oldText){

    const newText = prompt(

        "Edit Message",

        oldText

    );

    if(newText === null) return;

    if(newText.trim() === "") return;

    db.ref("chats/" + chatId + "/messages/" + messageId)

    .update({

        text:newText.trim(),

        edited:true

    });

}

// ============================================
// Delete Message
// ============================================

function deleteMessage(messageId){

    if(!confirm("Delete this message?"))

        return;

    db.ref("chats/" + chatId + "/messages/" + messageId)

    .remove()

    .then(()=>{

        showToast("Message Deleted");

    });

}

// ============================================
// Notification Sound
// ============================================

let firstLoad = true;

db.ref("chats/" + chatId + "/messages")

.on("child_added",(snap)=>{

    if(firstLoad) return;

    const msg = snap.val();

    if(msg.senderUid !== currentUser.uid){

        playNotification();

    }

});

setTimeout(()=>{

    firstLoad = false;

},1000);

function playNotification(){

    const audio = new Audio("notification.mp3");

    audio.volume = 0.5;

    audio.play().catch(()=>{});

}

// ============================================
// Toast
// ============================================

function showToast(text){

    let toast = document.getElementById("toast");

    if(!toast){

        toast = document.createElement("div");

        toast.id = "toast";

        toast.style.cssText = `
            position:fixed;
            bottom:90px;
            left:50%;
            transform:translateX(-50%);
            background:#222;
            color:#fff;
            padding:12px 20px;
            border-radius:30px;
            font-size:14px;
            z-index:9999;
            opacity:0;
            transition:.3s;
        `;

        document.body.appendChild(toast);

    }

    toast.innerText = text;

    toast.style.opacity = "1";

    setTimeout(()=>{

        toast.style.opacity = "0";

    },1800);

}

// ============================================

console.log("✅ CHAT V5 PART 3 LOADED");
// ============================================
// VIEWORA CHAT V5.0
// PART 4
// About + Report + Block + Media
// ============================================

// ============================================
// Open About User
// ============================================

window.openAboutUser = function () {

    location.href = "profile.html?uid=" + otherUserUid;

};

// ============================================
// Report User
// ============================================

window.reportUser = async function () {

    const reason = prompt(

`Report User

Spam
Harassment
Fake Account
Abuse
Other`

    );

    if (!reason) return;

    await db.ref("reports").push({

        reportedUid: otherUserUid,
        reportedBy: currentUser.uid,
        reason: reason.trim(),
        time: Date.now()

    });

    showToast("Report submitted");

};

// ============================================
// Block User
// ============================================

window.blockUser = async function () {

    if (!confirm("Block this user?")) return;

    await db.ref(
        "blockedUsers/" +
        currentUser.uid +
        "/" +
        otherUserUid
    ).set({

        blockedAt: Date.now()

    });

    showToast("User blocked");

};

// ============================================
// Unblock User
// ============================================

window.unblockUser = async function () {

    if (!confirm("Unblock this user?")) return;

    await db.ref(
        "blockedUsers/" +
        currentUser.uid +
        "/" +
        otherUserUid
    ).remove();

    showToast("User unblocked");

};

// ============================================
// Dynamic 3 Dot Menu
// ============================================

window.showChatMenu = async function () {

    const snap = await db.ref(

        "blockedUsers/" +
        currentUser.uid +
        "/" +
        otherUserUid

    ).once("value");

    if (snap.exists()) {

        const option = prompt(

`Chat Menu

1 = About User
2 = Report User
3 = Unblock User`

        );

        switch (option) {

            case "1":
                openAboutUser();
                break;

            case "2":
                reportUser();
                break;

            case "3":
                unblockUser();
                break;

        }

    } else {

        const option = prompt(

`Chat Menu

1 = About User
2 = Report User
3 = Block User`

        );

        switch (option) {

            case "1":
                openAboutUser();
                break;

            case "2":
                reportUser();
                break;

            case "3":
                blockUser();
                break;

        }

    }

};

// ============================================
// Check Block Before Send
// ============================================

async function canSendMessage() {

    const blocked = await db.ref(

        "blockedUsers/" +
        otherUserUid +
        "/" +
        currentUser.uid

    ).once("value");

    if (blocked.exists()) {

        alert("You are blocked by this user.");

        return false;

    }

    return true;

}

// Replace sendMessage

const originalSendMessage = window.sendMessage;

window.sendMessage = async function () {

    const allow = await canSendMessage();

    if (!allow) return;

    originalSendMessage();

};

// ============================================
// Send Image
// ============================================

window.sendImage = function (imageUrl) {

    if (!imageUrl) return;

    db.ref("chats/" + chatId + "/messages")

    .push({

        senderUid: currentUser.uid,
        receiverUid: otherUserUid,

        image: imageUrl,
        type: "image",

        timestamp: Date.now(),

        seen: false,
        edited: false

    });

};

// ============================================
// Send Video
// ============================================

window.sendVideo = function (videoUrl) {

    if (!videoUrl) return;

    db.ref("chats/" + chatId + "/messages")

    .push({

        senderUid: currentUser.uid,
        receiverUid: otherUserUid,

        video: videoUrl,
        type: "video",

        timestamp: Date.now(),

        seen: false,
        edited: false

    });

};

// ============================================
// Version
// ============================================

console.log("✅ VIEWORA CHAT V5.0 FINAL LOADED");