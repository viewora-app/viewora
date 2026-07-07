<!-- ==================== INDEX.JS - FIXED & CLEAN (V1.2) ==================== -->

let currentUser = null;

auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    loadHomeFeed();
});

function loadHomeFeed() {
    const container = document.getElementById("feedContainer");
    if (!container) return;

    db.ref("posts").orderByChild("createdAt").limitToLast(50).on("value", (snapshot) => {

        if (!snapshot.exists()) {
            container.innerHTML = `
                <p style="text-align:center;padding:80px;color:#666;">
                    No posts yet. Be the first!
                </p>`;
            return;
        }

        let posts = [];

        snapshot.forEach(child => {
            posts.push({
                id: child.key,
                ...child.val()
            });
        });

        // Latest post first
        posts.reverse();

        let html = "";

        posts.forEach(post => {

            const imageHTML = (post.mediaUrl || post.imageUrl)
                ? `
                    <img
                        src="${post.mediaUrl || post.imageUrl}"
                        style="width:100%;border-radius:12px;margin:10px 0;"
                        onerror="this.style.display='none'">
                  `
                : "";

            html += `
                <div class="post-card">

                    <div class="post-header">

                        <img
                            src="${post.profilePhoto || 'non.jpg'}"
                            class="post-avatar"
                            onerror="this.src='non.jpg'">

                        <div>
                            <strong>${post.name || "User"}</strong><br>
                            <small>@${post.username || "unknown"}</small>
                        </div>

                    </div>

                    <p style="margin:10px 0;line-height:1.5;">
                        ${post.text || ""}
                    </p>

                    ${imageHTML}

                    <small style="color:#777;">
                        ${new Date(post.createdAt).toLocaleString()}
                    </small>

                    <div style="margin-top:15px;display:flex;gap:25px;font-size:22px;color:#aaa;">

                        <span onclick="likePost('${post.id}')" style="cursor:pointer;">
                            ❤️
                            <span class="like-count">${post.likes || 0}</span>
                        </span>

                        <span onclick="showComments('${post.id}', false)" style="cursor:pointer;">
                            💬
                        </span>

                    </div>

                </div>
            `;
        });

        container.innerHTML = html;

    });
}

// ==================== FIXED LIKE FUNCTION ====================
window.likePost = function(postId) {

    if (!currentUser) {
        alert("Please login!");
        return;
    }

    const likeRef = db.ref(`postLikes/${postId}/${currentUser.uid}`);

    likeRef.once("value").then((snap) => {

        if (snap.exists()) {

            likeRef.remove();

            db.ref("posts/" + postId + "/likes")
              .transaction(count => Math.max((count || 0) - 1, 0));

        } else {

            likeRef.set(true);

            db.ref("posts/" + postId + "/likes")
              .transaction(count => (count || 0) + 1);

        }

    });

};