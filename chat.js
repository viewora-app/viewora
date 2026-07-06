// ==================== CHAT.JS - Final with Notification & Last Message ====================

let currentUser = null;
let otherUserUid = null;
let chatId = null;

function getOtherUserUid() {
    const params = new URLSearchParams(window.location.search);
    return params.get("uid");
}

function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

function loadOtherUserName(uid) {
    db.ref("users/" + uid).once("value").then(snapshot => {
        const user = snapshot.val();
        document.getElementById("chatUserName").innerText = user?.name || "User";
    });
}

function loadMessages() {
    const container = document.getElementById("messagesContainer");
    if (!container || !chatId) return;

    db.ref("chats/" + chatId + "/messages").on("value", (snapshot) => {
        container.innerHTML = "";

        if (!snapshot.exists()) {
            container.innerHTML = `<p style="text-align:center; color:#666; margin-top:40px;">No messages yet. Say hi!</p>`;
            return;
        }

        snapshot.forEach(child => {
            const msg = child.val();
            const isSent = msg.senderUid === currentUser.uid;

            const msgDiv = document.createElement("div");
            msgDiv.className = `message ${isSent ? 'sent' : 'received'}`;
            msgDiv.innerHTML = `
                <div>${msg.text}</div>
                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            container.appendChild(msgDiv);
        });

        container.scrollTop = container.scrollHeight;
    });
}

function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();

    if (!text || !currentUser || !chatId) return;

    const messageData = {
        text: text,
        senderUid: currentUser.uid,
        timestamp: Date.now()
    };

    // Create/Update chat + last message
    db.ref("chats/" + chatId).update({
        participants: [currentUser.uid, otherUserUid],
        lastMessage: text,
        lastMessageTime: Date.now()
    }).then(() => {
        // Send message
        db.ref("chats/" + chatId + "/messages").push(messageData).then(() => {
            // Send notification to other user
            db.ref("notifications/" + otherUserUid).push({
                fromName: currentUser.displayName || "Someone",
                message: "Sent you a message",
                type: "message",
                time: Date.now()
            });

            input.value = "";
        });
    }).catch(err => {
        console.error("Send error:", err);
        alert("Failed to send message");
    });
}

// Initialize
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    otherUserUid = getOtherUserUid();

    if (!otherUserUid) {
        alert("Invalid chat user");
        history.back();
        return;
    }

    chatId = getChatId(currentUser.uid, otherUserUid);

    loadOtherUserName(otherUserUid);
    loadMessages();
});