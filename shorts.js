// ==================== SHORTS.JS - FIXED & IMPROVED ====================

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            loadShorts();
        }
    });
});

function loadShorts() {
    const container = document.getElementById("shortsContainer");
    if (!container) return;

    db.ref("shorts").orderByChild("createdAt").on("value", (snapshot) => {
        container.innerHTML = "";

        if (!snapshot.exists()) {
            container.innerHTML = `
                <div class="short">
                    <div class="short-content">
                        <h2>No Shorts Yet</h2>
                        <p>Be the first to upload a short! 🚀</p>
                    </div>
                </div>
            `;
            return;
        }

        snapshot.forEach((child) => {
            const short = child.val();
            const id = child.key;

            const div = document.createElement("div");
            div.className = "short";

            let mediaHTML = '';
            if (short.mediaUrl) {
                if (short.mediaUrl.includes('.mp4') || short.mediaUrl.includes('video')) {
                    mediaHTML = `<video src="${short.mediaUrl}" style="width:100%; max-height:70vh; object-fit:cover;" loop muted autoplay></video>`;
                } else {
                    mediaHTML = `<img src="${short.mediaUrl}" style="width:100%; max-height:70vh; object-fit:cover; border-radius:12px;">`;
                }
            }

            div.innerHTML = `
                <div class="short-content">
                    ${mediaHTML}
                    <h2 class="short-title">${short.title || "Cool Short"}</h2>
                    <p class="short-user">by ${short.user || "Unknown"}</p>
                    
                    <div class="short-actions">
                        <button class="like-btn" onclick="toggleShortLike('${id}', this)">
                            👍 ${short.likes || 0}
                        </button>
                        <button class="comment-btn" onclick="showComments('${id}', true)">
                            💬 Comment
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        setupActiveShorts();
    });
}

// Fixed Like Function
window.toggleShortLike = function(shortId, button) {
    if (!auth.currentUser) {
        alert("You must be logged in to like!");
        return;
    }

    const userLikeRef = db.ref(`shortLikes/\( {shortId}/ \){auth.currentUser.uid}`);
    
    userLikeRef.once("value").then(snap => {
        if (snap.exists()) {
            userLikeRef.remove();
            db.ref(`shorts/${shortId}/likes`).transaction(c => Math.max((c || 0) - 1, 0));
        } else {
            userLikeRef.set(true);
            db.ref(`shorts/${shortId}/likes`).transaction(c => (c || 0) + 1);
        }
    }).catch(err => {
        console.error("Like error:", err);
    });
};

function setupActiveShorts() {
    const container = document.getElementById("shortsContainer");
    if (!container) return;

    container.addEventListener("scroll", () => {
        const shorts = container.querySelectorAll(".short");
        shorts.forEach(short => {
            const rect = short.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
                short.classList.add("active");
            } else {
                short.classList.remove("active");
            }
        });
    });
}