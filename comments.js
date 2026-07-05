// ==================== COMMENTS.JS - FIXED & CLEAN ====================

// Global auth & db from firebase.js use kar rahe hain

window.showComments = function(postId, isShort = false) {
    const existing = document.getElementById("commentsModal");
    if (existing) existing.remove();

    const modalHTML = `
        <div id="commentsModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.95); z-index: 3000; display: flex; align-items: flex-end;">
            
            <div style="background: #1b1b1b; width: 100%; max-width: 500px; margin: 0 auto; 
                height: 85%; border-radius: 20px 20px 0 0; display: flex; flex-direction: column; overflow: hidden;">
                
                <div style="padding: 16px 20px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0;">💬 Comments</h3>
                    <span onclick="closeComments()" style="font-size: 30px; cursor: pointer; color: #aaa;">×</span>
                </div>

                <div id="commentsList" style="flex: 1; overflow-y: auto; padding: 15px; background: #111;"></div>

                <div style="padding: 15px; border-top: 1px solid #333; background: #1b1b1b;">
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="newCommentInput" placeholder="Write your comment..." 
                               style="flex: 1; padding: 14px 18px; border: none; border-radius: 30px; background: #2a2a2a; color: white; font-size: 15px;">
                        <button onclick="postComment('${postId}', ${isShort})" 
                                style="padding: 0 28px; background: #00aaff; color: white; border: none; border-radius: 30px; font-weight: 600;">
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    loadComments(postId, isShort);
};

function loadComments(postId, isShort) {
    const container = document.getElementById("commentsList");
    const path = isShort ? `shorts/\( {postId}/comments` : `posts/ \){postId}/comments`;

    db.ref(path).orderByChild("timestamp").on("value", (snapshot) => {
        container.innerHTML = "";

        if (!snapshot.exists()) {
            container.innerHTML = `<p style="text-align: center; padding: 80px 20px; color: #777;">No comments yet.<br>Be the first!</p>`;
            return;
        }

        snapshot.forEach((child) => {
            const c = child.val();
            const commentHTML = `
                <div style="margin-bottom: 18px; padding: 14px; background: #222; border-radius: 12px;">
                    <strong style="color: #00aaff;">${c.username || 'Anonymous'}</strong>
                    <p style="margin: 8px 0 6px 0; line-height: 1.4;">${c.text}</p>
                    <small style="color: #666;">${new Date(c.timestamp).toLocaleString()}</small>
                </div>
            `;
            container.innerHTML += commentHTML;
        });

        container.scrollTop = container.scrollHeight;
    });
}

window.postComment = function(postId, isShort) {
    const input = document.getElementById("newCommentInput");
    const text = input.value.trim();

    if (!text) return;

    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in!");
        return;
    }

    db.ref("users/" + user.uid).once("value").then((snap) => {
        const u = snap.val() || {};

        const commentData = {
            text: text,
            username: u.name || "User",
            uid: user.uid,
            timestamp: Date.now()
        };

        const path = isShort ? `shorts/\( {postId}/comments` : `posts/ \){postId}/comments`;
        
        db.ref(path).push(commentData).then(() => {
            input.value = "";
        }).catch(err => {
            console.error("Comment error:", err);
            alert("Failed to post comment");
        });
    });
};

window.closeComments = function() {
    const modal = document.getElementById("commentsModal");
    if (modal) modal.remove();
};