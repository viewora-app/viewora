let currentUser = null;

auth.onAuthStateChanged((user) => {
    if (!user) {
        location.href = "login.html";
        return;
    }
    currentUser = user;
    loadBlockedUsers();
});

function loadBlockedUsers() {
    const list = document.getElementById("blockedUsersList");
    const empty = document.getElementById("emptyState");

    db.ref("blockedUsers/" + currentUser.uid).once("value").then(snapshot => {
        list.innerHTML = "";

        if (!snapshot.exists()) {
            empty.style.display = "block";
            return;
        }

        empty.style.display = "none";

        snapshot.forEach(child => {
            const blockedUid = child.key;

            db.ref("users/" + blockedUid).once("value").then(userSnap => {
                const user = userSnap.val();
                if (!user) return;

                const card = document.createElement("div");
                card.className = "user-card";
                card.innerHTML = `
                    <img class="user-avatar" src="${user.profilePhoto || 'users.jpg'}">
                    <div class="user-info">
                        <h3>${user.name || "Unknown"}</h3>
                        <p>@${user.username || "user"}</p>
                    </div>
                    <button class="unblock-btn" onclick="unblockUser('${blockedUid}')">Unblock</button>
                `;
                list.appendChild(card);
            });
        });
    });
}

window.unblockUser = async function (uid) {
    if (!confirm("Unblock this user?")) return;

    await db.ref("blockedUsers/" + currentUser.uid + "/" + uid).remove();
    showToast("✅ User Unblocked");
    loadBlockedUsers();
};

function showToast(msg) {
    const toast = document.createElement("div");
    toast.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#00aaff;color:white;padding:12px 24px;border-radius:30px;font-weight:bold;z-index:99999`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}