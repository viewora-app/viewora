// ==================== USERS.JS - CLEAN & FIXED ====================

function loadAllUsers() {
    const usersList = document.getElementById("usersList");
    if (!usersList) return;

    usersList.innerHTML = "<p style='text-align:center; padding:40px; color:#888;'>Loading users...</p>";

    db.ref("users").once("value").then((snapshot) => {
        usersList.innerHTML = "";

        if (!snapshot.exists()) {
            usersList.innerHTML = `<p style="text-align:center; color:#888; padding:50px;">No users found</p>`;
            return;
        }

        snapshot.forEach((child) => {
            const user = child.val();
            const uid = child.key;

            usersList.innerHTML += `
                <div class="user-card">
                    <div>
                        <h3>${user.name || 'No Name'}</h3>
                        <p>${user.username || '@unknown'}</p>
                    </div>
                    <button onclick="viewProfile('${uid}')">View Profile</button>
                </div>
            `;
        });
    }).catch(err => {
        console.error("Error loading users:", err);
        usersList.innerHTML = `<p style='color:red; text-align:center; padding:30px;'>Error: ${err.message}</p>`;
    });
}

function searchUsers() {
    const keyword = document.getElementById("search").value.toLowerCase().trim();
    const usersList = document.getElementById("usersList");

    if (!keyword) {
        loadAllUsers();
        return;
    }

    usersList.innerHTML = "<p style='text-align:center; padding:40px; color:#888;'>Searching...</p>";

    db.ref("users").once("value").then((snapshot) => {
        usersList.innerHTML = "";
        let found = false;

        snapshot.forEach((child) => {
            const user = child.val();
            const uid = child.key;

            if ((user.name && user.name.toLowerCase().includes(keyword)) || 
                (user.username && user.username.toLowerCase().includes(keyword))) {
                
                found = true;
                usersList.innerHTML += `
                    <div class="user-card">
                        <div>
                            <h3>${user.name || 'No Name'}</h3>
                            <p>${user.username || '@unknown'}</p>
                        </div>
                        <button onclick="viewProfile('${uid}')">View Profile</button>
                    </div>
                `;
            }
        });

        if (!found) {
            usersList.innerHTML = `<p style="text-align:center; color:#888; padding:50px;">No users found for "${keyword}"</p>`;
        }
    });
}

window.viewProfile = function(uid) {
    if (!uid) return alert("Invalid user");
    window.location.href = "user.html?uid=" + uid;
};

// Auto load
document.addEventListener("DOMContentLoaded", () => {
    loadAllUsers();
});