// ==================== VIEWORATION.JS - FIXED VERSION ====================

document.addEventListener("DOMContentLoaded", () => {
    let currentUserUid = null;

    auth.onAuthStateChanged((user) => {
        if (!user) {
            location.href = "login.html";
            return;
        }
        
        currentUserUid = user.uid;
        console.log("✅ User loaded:", currentUserUid);
        
        loadPosts();
    });

    window.createPost = function() {
        const text = document.getElementById("postText").value.trim();
        const imageUrl = document.getElementById("imageUrl").value.trim();

        if (!text) return alert("Please write something!");

        const user = auth.currentUser;
        if (!user) return alert("Not logged in!");

        db.ref("users/" + user.uid).once("value").then(snap => {
            const u = snap.val() || {};
            const postId = db.ref("posts").push().key;

            db.ref("posts/" + postId).set({
                uid: user.uid,
                name: u.name || "User",
                username: u.username || "@user",
                profilePhoto: u.profilePhoto || "non.jpg",
                text: text,
                imageUrl: imageUrl || null,
                createdAt: Date.now(),
                likes: 0
            }).then(() => {
                document.getElementById("postText").value = "";
                document.getElementById("imageUrl").value = "";
                alert("✅ Post Created Successfully!");
            }).catch(err => {
                console.error("Post error:", err);
                alert("Failed to create post");
            });
        });
    };

    window.loadPosts = function() {
        db.ref("posts").orderByChild("createdAt").on("value", (snapshot) => {
            let html = "";
            
            snapshot.forEach((child) => {
                const post = child.val();
                const postId = child.key;
                const isOwnPost = (post.uid === currentUserUid);

                let imageHTML = post.imageUrl ? 
                    `<img src="${post.imageUrl}" style="width:100%; border-radius:12px; margin:10px 0;">` : "";

                let deleteBtn = isOwnPost ? 
                    `<button onclick="deletePost('${postId}')" style="color:#ff4757; margin-left:10px;">🗑️</button>` : "";

                html += `
                    <div style="margin:15px; padding:18px; background:#1b1b1b; border-radius:16px;">
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                            <img src="${post.profilePhoto || 'non.jpg'}" style="width:45px;height:45px;border-radius:50%;">
                            <div>
                                <strong>${post.name || 'User'}</strong><br>
                                <small style="color:#aaa;">${post.username || '@user'}</small>
                            </div>
                        </div>
                        <p style="margin:12px 0; line-height:1.5;">${post.text || ''}</p>
                        ${imageHTML}
                        <small style="color:#777;">${post.createdAt ? new Date(post.createdAt).toLocaleString() : ''}</small>
                        <br><br>
                        <button onclick="toggleLike('${postId}')" style="font-size:20px; margin-right:15px;">❤️ ${post.likes || 0}</button>
                        <button onclick="showComments('${postId}', false)" style="font-size:20px;">💬 Comment</button>
                        ${deleteBtn}
                    </div>
                `;
            });

            const container = document.getElementById("postsList");
            if (container) {
                container.innerHTML = html || `<p style="text-align:center; padding:80px; color:#666;">No posts yet.<br>Create your first post above!</p>`;
            }
        });
    };

    // Fixed Like Function
    window.toggleLike = function(postId) {
        if (!currentUserUid) return;
        
        const userLikeRef = db.ref(`postLikes/\( {postId}/ \){currentUserUid}`);
        
        userLikeRef.once("value").then(snap => {
            if (snap.exists()) {
                userLikeRef.remove();
                db.ref(`posts/${postId}/likes`).transaction(c => Math.max((c || 0) - 1, 0));
            } else {
                userLikeRef.set(true);
                db.ref(`posts/${postId}/likes`).transaction(c => (c || 0) + 1);
            }
        }).catch(err => console.error("Like error:", err));
    };

    window.deletePost = function(postId) {
        if (confirm("Delete this post?")) {
            db.ref("posts/" + postId).remove();
        }
    };
});