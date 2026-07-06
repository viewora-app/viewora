// ==================== MESSAGES.JS - Instagram Style ====================

let currentUser = null;

auth.onAuthStateChanged((user) => {
    if (!user) {
        location.href = "login.html";
        return;
    }
    currentUser = user;
    loadAllChats();
});

function loadAllChats() {
    const container = document.getElementById("messagesList");

    db.ref("chats").orderByChild("lastMessageTime").on("value", (snapshot) => {
        container.innerHTML = "";

        if (!snapshot.exists()) {
            container.innerHTML = `
                <div class="no-chats">
                    <p>No messages yet</p>
                    <small>Start chatting from Users page</small>
                </div>`;
            return;
        }

        snapshot.forEach((child) => {
            const chat = child.val();
            const chatId = child.key;

            if (chat.participants && chat.participants.includes(currentUser.uid)) {
                const otherUid = chat.participants.find(uid => uid !== currentUser.uid);

                db.ref("users/" + otherUid).once("value").then((snap) => {
                    const u = snap.val() || {};
                    const lastMsg = chat.lastMessage || "Say hi 👋";

                    const div = document.createElement("div");
                    div.className = "chat-item";
                    div.innerHTML = `
                        <img src="${u.profilePhoto || 'non.jpg'}" class="chat-avatar">
                        <div class="chat-info">
                            <div class="chat-name">${u.name || 'User'}</div>
                            <div class="chat-last">${lastMsg}</div>
                        </div>
                    `;
                    div.onclick = () => {
                        window.location.href = `chat.html?uid=${otherUid}`;
                    };
                    container.appendChild(div);
                });
            }
        });
    });
}

// Search Functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('.chat-item');
    
    items.forEach(item => {
        const name = item.querySelector('.chat-name').textContent.toLowerCase();
        item.style.display = name.includes(term) ? 'flex' : 'none';
    });
});