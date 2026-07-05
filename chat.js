// ==================== CHAT.JS - Viewora (Fixed Version) ====================

let currentUser = null;
let otherUserUid = null;
let chatId = null;

// Get other user UID from URL
function getOtherUserUid() {
    const params = new URLSearchParams(window.location.search);
    return params.get("uid");
}

// Generate unique chat ID
function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

// Load other user's name
function loadOtherUserName(uid) {
    const nameEl = document.getElementById("chatUserName");
    
    db.ref("users/" + uid).once("value")
        .then(snapshot => {
            const user = snapshot.val();
            if (user && user.name) {
                nameEl.innerText = user.name;
                document.getElementById("callUserName").innerText = user.name;
            } else {
                nameEl.innerText = "Unknown User";
            }
        })
        .catch(err => {
            console.error("Error loading user name:", err);
            nameEl.innerText = "User";
        });
}

// Load messages in realtime
function loadMessages() {
    const container = document.getElementById("messagesContainer");
    if (!container || !chatId) {
        console.log("Cannot load messages: container or chatId missing");
        return;
    }

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

// Send message
function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();

    console.log("Trying to send message...");
    console.log("currentUser:", currentUser);
    console.log("chatId:", chatId);

    if (!text) {
        console.log("Message is empty");
        return;
    }
    
    if (!currentUser) {
        alert("You are not logged in!");
        return;
    }
    
    if (!chatId) {
        alert("Chat not initialized yet!");
        return;
    }

    const messageData = {
        text: text,
        senderUid: currentUser.uid,
        timestamp: Date.now()
    };

    db.ref("chats/" + chatId + "/messages").push(messageData)
        .then(() => {
            console.log("Message sent successfully");
            input.value = "";
        })
        .catch(err => {
            console.error("Message send error:", err);
            alert("Failed to send message. Check console.");
        });
}

// Start fake call
function startCall() {
    const modal = document.getElementById("callModal");
    if (modal) modal.style.display = "flex";
}

function endCall() {
    const modal = document.getElementById("callModal");
    if (modal) modal.style.display = "none";
    alert("Call ended");
}

// Initialize Chat
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    otherUserUid = getOtherUserUid();

    if (!otherUserUid) {
        alert("Invalid chat user");
        window.location.href = "users.html";
        return;
    }

    chatId = getChatId(currentUser.uid, otherUserUid);
    console.log("Chat initialized. chatId =", chatId);

    // Load user name
    loadOtherUserName(otherUserUid);

    // Load messages
    loadMessages();
});

// Close modal on outside click
document.addEventListener("click", function(e) {
    const modal = document.getElementById("callModal");
    if (modal && e.target.id === "callModal") {
        modal.style.display = "none";
    }
});

