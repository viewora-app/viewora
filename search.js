// ==================== SEARCH.JS - FIXED (No duplicate auth) ====================

document.addEventListener("DOMContentLoaded", () => {
    // No re-declaration of auth/db
    loadRecentVideos();
});

// Search Function
window.search = function() {
    const term = document.getElementById("searchInput").value.toLowerCase().trim();
    if (!term) {
        loadRecentVideos();
        return;
    }

    const resultsContainer = document.getElementById("searchResults");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "<p style='text-align:center; padding:40px;'>Searching...</p>";

    firebase.database().ref("users").once("value").then(snapshot => {
        let html = "";
        let found = false;

        snapshot.forEach(child => {
            const user = child.val();
            const uid = child.key;

            if ((user.name && user.name.toLowerCase().includes(term)) || 
                (user.username && user.username.toLowerCase().includes(term))) {
                
                found = true;
                html += `
                    <div class="user-card">
                        <div>
                            <h3>${user.name || 'No Name'}</h3>
                            <p>${user.username || '@unknown'}</p>
                        </div>
                        <button onclick="viewProfile('${uid}')">View</button>
                    </div>
                `;
            }
        });

        resultsContainer.innerHTML = found ? html : `<p style="text-align:center; padding:60px; color:#888;">No results for "${term}"</p>`;
    });
};

function loadRecentVideos() {
    const container = document.getElementById("recentVideos");
    if (!container) return;

    firebase.database().ref("posts").orderByChild("createdAt").limitToLast(8).on("value", (snapshot) => {
        let html = "";
        snapshot.forEach(child => {
            const post = child.val();
            html += `
                <div class="video-card" onclick="viewPost('${child.key}')">
                    <img src="${post.mediaUrl || 'non.jpg'}" class="thumbnail">
                    <div class="video-info">
                        <h3>${post.title || 'Untitled'}</h3>
                        <p>${post.name || 'User'}</p>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || "<p style='text-align:center; color:#666; padding:30px;'>No posts yet</p>";
    });
}

window.viewProfile = function(uid) {
    window.location.href = `user.html?uid=${uid}`;
};

window.viewPost = function(postId) {
    alert("Full post viewer coming soon!\nPost ID: " + postId);
};