// ============================================
// VIEWORA CHAT V5.1 - FIXED & CLEAN
// ============================================

let currentUser = null;
let otherUserUid = null;
let chatId = null;
let currentUserData = null;
let otherUserData = null;

// ============================================
// Get UID from URL
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
// PART 1: Authentication + Load Users
// ============================================

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        location.href = "login.html";
        return;
    }

    currentUser = user;
    otherUserUid = getOtherUserUid();

    if (!otherUserUid) {
        alert("Invalid Chat Link");
        history.back();
        return;
    }

    chatId = generateChatId(currentUser.uid, otherUserUid);

    await loadCurrentUser();
    await loadOtherUser();

    createChatRoom();
    setupPresence();
    listenOtherUserStatus();
    loadMessages();
    listenTyping();

    console.log("✅ Chat Initialized | Chat ID:", chatId);
});

// ============================================
// Load Current User
// ============================================

async function loadCurrentUser() {
    const snap = await db.ref("users/" + currentUser.uid).once("value");
    currentUserData = snap.val() || {};
}

// ============================================
// Load Other User
// ============================================

async function loadOtherUser() {
    const snap = await db.ref("users/" + otherUserUid).once("value");
    otherUserData = snap.val() || {};

    document.getElementById("chatUserPhoto").src = otherUserData.profilePhoto || "non.jpg";
    document.getElementById("chatUserName").innerText = otherUserData.name || "User";
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
// PART 2: Messages + Send
// ============================================

function loadMessages() {
    const container = document.getElementById("messagesContainer");
    if (!container) return;

    db.ref("chats/" + chatId + "/messages")
    .orderByChild("timestamp")
    .on("value", (snapshot) => {
        container.innerHTML = "";

        if (!snapshot.exists()) {
            container.innerHTML = `<div class="empty-chat" style="text-align:center;padding:60px;color:#777;">Say Hi 👋</div>`;
            return;
        }

        snapshot.forEach((child) => {
            const msg = child.val();
            const isMine = msg.senderUid === currentUser.uid;

            const bubble = document.createElement("div");
            bubble.className = isMine ? "message sent" : "message received";

            if (msg.type === "image") {
                bubble.innerHTML = `<img src="${msg.image}" class="chat-image" style="max-width:100%;border-radius:12px;">`;
            } else {
                bubble.innerHTML = `<div class="message-text">${msg.text || ""}</div>`;
            }

            bubble.innerHTML += `
                <div class="message-info" style="font-size:11px;opacity:0.8;margin-top:5px;">
                    ${formatTime(msg.timestamp)}
                    ${isMine ? (msg.seen ? "✓✓" : "✓") : ""}
                </div>
            `;

            container.appendChild(bubble);
        });

        scrollToBottom();
        markMessagesAsSeen();
    });
}

// ============================================
// Send Message (Fixed)
// ============================================

window.sendMessage = async function () {
    const input = document.getElementById("messageInput");
    if (!input) return;

    const text = input.value.trim();
    if (text === "") return;

    const messageData = {
        senderUid: currentUser.uid,
        text: text,
        type: "text",
        timestamp: Date.now(),
        seen: false
    };

    try {
        await db.ref(`chats/${chatId}/messages`).push(messageData);
        await db.ref(`chats/${chatId}`).update({
            lastMessage: text,
            lastMessageTime: Date.now()
        });

        input.value = "";
        scrollToBottom();
    } catch (err) {
        console.error(err);
        alert("Message not sent");
    }
};

// ============================================
// Helper Functions
// ============================================

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    const container = document.getElementById("messagesContainer");
    if (container) container.scrollTop = container.scrollHeight;
}

function markMessagesAsSeen() {
    db.ref(`chats/${chatId}/messages`).once("value", (snap) => {
        snap.forEach(child => {
            const msg = child.val();
            if (msg.senderUid !== currentUser.uid && !msg.seen) {
                child.ref.update({ seen: true });
            }
        });
    });
}

// ============================================
// Typing Indicator
// ============================================

let typingTimeout;
window.updateTyping = function () {
    db.ref(`typing/\( {chatId}/ \){currentUser.uid}`).set(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        db.ref(`typing/\( {chatId}/ \){currentUser.uid}`).set(false);
    }, 1500);
};

function listenTyping() {
    const statusEl = document.getElementById("chatStatus");
    db.ref(`typing/\( {chatId}/ \){otherUserUid}`).on("value", (snap) => {
        if (snap.val()) {
            statusEl.innerHTML = "✍️ Typing...";
        }
    });
}

// Enter Key Support
document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("messageInput");
    if (input) {
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                sendMessage();
            }
        });
        input.addEventListener("input", updateTyping);
    }
});

// ============================================
// Presence (Online Status)
// ============================================

function setupPresence() {
    const connectedRef = firebase.database().ref(".info/connected");
    connectedRef.on("value", (snap) => {
        if (snap.val() && currentUser) {
            const statusRef = db.ref("status/" + currentUser.uid);
            statusRef.onDisconnect().set({ online: false, lastSeen: Date.now() });
            statusRef.set({ online: true, lastSeen: Date.now() });
        }
    });
}

function listenOtherUserStatus() {
    db.ref("status/" + otherUserUid).on("value", (snap) => {
        const statusEl = document.getElementById("chatStatus");
        if (!snap.exists()) {
            statusEl.innerHTML = "Offline";
            return;
        }
        const data = snap.val();
        statusEl.innerHTML = data.online ? "🟢 Online" : "Last seen recently";
    });
}

// ============================================
// Final Log
// ============================================

console.log("✅ Viewora Chat V5.1 FIXED & LOADED Successfully");