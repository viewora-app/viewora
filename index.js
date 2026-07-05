// ==================== INDEX.JS - Home Feed (Fixed) ====================

// No duplicate auth/db declaration - Use global from firebase.js

let currentUser = null;

auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    console.log("✅ Home - User loaded:", user.uid);
    loadHomeFeed();
});

function loadHomeFeed() {
    const container = document.getElementById("feedContainer");
    if (!container) return console.error("feedContainer not found");

    db.ref("posts").orderByChild("createdAt").limitToLast(50).on("value", (snapshot) => {
        console.log("📡 Home Feed: Received", snapshot.numChildren(), "posts");
        container.innerHTML = "";

        if (!snapshot.exists()) {
            container.innerHTML = `<p style="text-align:center; padding:80px; color:#666;">No posts yet. Be the first!</p>`;
            return;
        }

        let postsArray = [];
        snapshot.forEach(child => {
            postsArray.push({id: child.key, ...child.val()});
        });

        postsArray.reverse();

        postsArray.forEach(post => {
            const div = document.createElement("div");
            div.className = "post-card";
            div.innerHTML = `
                <div class="post-header">
                    <img src="${post.profilePhoto || 'non.jpg'}" class="post-avatar" onerror="this.src='non.jpg'">
                    <div>
                        <strong>${post.name || 'User'}</strong><br>
                        <small>@${post.username || 'unknown'}</small>
                    </div>
                </div>
                <p style="margin:10px 0; line-height:1.5;">${post.text || post.description || ''}</p>
                ${post.mediaUrl || post.imageUrl ? 
                    `<img src="${post.mediaUrl || post.imageUrl}" style="width:100%; border-radius:12px; margin:10px 0;">` : ''}
                <small style="color:#777;">${new Date(post.createdAt).toLocaleString()}</small>
                
                <div style="margin-top:15px; display:flex; gap:25px; font-size:22px; color:#aaa;">
                    <span onclick="likePost('${post.id}')" style="cursor:pointer;">❤️ ${post.likes || 0}</span>
                    <span onclick="showComments('${post.id}', false)" style="cursor:pointer;">💬</span>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

// Fixed Like Function
window.likePost = function(id) {
    if (!currentUser) return;
    
    const userLikeRef = db.ref(`postLikes/\( {id}/ \){currentUser.uid}`);
    
    userLikeRef.once("value").then(snap => {
        if (snap.exists()) {
            userLikeRef.remove();
            db.ref(`posts/${id}/likes`).transaction(c => Math.max((c || 0) - 1, 0));
        } else {
            userLikeRef.set(true);
            db.ref(`posts/${id}/likes`).transaction(c => (c || 0) + 1);
        }
    }).catch(err => {
        console.error("Like error:", err);
    });
};

// Search Functionality
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.post-card');
        cards.forEach(card => {
            card.style.display = card.textContent.toLowerCase().includes(term) ? 'block' : 'none';
        });
    });
}