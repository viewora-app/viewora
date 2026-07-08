// ==========================================
// VIEWORA MESSAGES V5.0 - FIXED
// ==========================================

let currentUser = null;

// ==========================================
// Authentication
// ==========================================

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        location.href = "login.html";
        return;
    }

    currentUser = user;
    loadAllChats();
});

console.log("✅ Messages V5 Loaded");

// ==========================================
// Main Function - Load All Chats
// ==========================================

function loadAllChats() {
    const container = document.getElementById("messagesList");
    if (!container) return;

    container.innerHTML = `<div class="loading">Loading chats...</div>`;

    // Listen to all chats where current user is a participant
    db.ref("chats")
      .orderByChild("lastMessageTime")
      .on("value", async (snapshot) => {

        container.innerHTML = "";

        if (!snapshot.exists()) {
            container.innerHTML = `
                <div class="empty-chat">
                    <h3>No Chats Yet</h3>
                    <p>Start a new conversation from Users list</p>
                </div>`;
            return;
        }

        let chatsArray = [];

        snapshot.forEach((child) => {
            const chat = child.val();
            if (!chat || !chat.participants) return;

            if (chat.participants[currentUser.uid]) {
                chatsArray.push({
                    chatId: child.key,
                    ...chat
                });
            }
        });

        // Sort by latest message
        chatsArray.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

        if (chatsArray.length === 0) {
            container.innerHTML = `<div class="empty-chat">No chats yet</div>`;
            return;
        }

        // Render each chat
        for (let chat of chatsArray) {
            const otherUid = Object.keys(chat.participants).find(uid => uid !== currentUser.uid);
            if (!otherUid) continue;

            await renderChatCard(container, chat, otherUid);
        }
    });
}

// ==========================================
// Render Single Chat Card
// ==========================================

async function renderChatCard(container, chat, otherUid) {
    const snap = await db.ref("users/" + otherUid).once("value");
    const user = snap.val() || {};

    const card = document.createElement("div");
    card.className = "chat-item";
    card.innerHTML = `
        <div style="position:relative;">
            <img src="${user.profilePhoto || 'non.jpg'}" 
                 class="chat-avatar" 
                 style="width:58px;height:58px;border-radius:50%;object-fit:cover;">
            <div class="online-dot" id="online-${otherUid}"></div>
        </div>

        <div class="chat-info">
            <div class="chat-name">${user.name || "Unknown User"}</div>
            <div class="chat-last">${chat.lastMessage || "Say Hi 👋"}</div>
        </div>

        <div style="text-align:right; min-width:60px;">
            <div class="chat-time" id="time-${chat.chatId}">
                ${formatTime(chat.lastMessageTime)}
            </div>
        </div>
    `;

    card.onclick = () => {
        location.href = `chat.html?uid=${otherUid}`;
    };

    container.appendChild(card);

    // Update online status
    updateOnlineStatus(otherUid);
}

// ==========================================
// Helper Functions
// ==========================================

function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateOnlineStatus(uid) {
    db.ref("status/" + uid).on("value", (snap) => {
        const dot = document.getElementById(`online-${uid}`);
        if (dot) {
            dot.style.background = snap.val() && snap.val().online ? "#00ff66" : "#555";
        }
    });
}

// Search Functionality
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const term = searchInput.value.toLowerCase().trim();
            document.querySelectorAll(".chat-item").forEach(card => {
                const name = card.querySelector(".chat-name").innerText.toLowerCase();
                card.style.display = name.includes(term) ? "flex" : "none";
            });
        });
    }
});

// Auto Refresh
setInterval(() => {
    if (typeof loadAllChats === "function") loadAllChats();
}, 45000);

console.log("✅ Messages V5.0 Fixed & Ready");