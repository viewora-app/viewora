<!-- ==================== SHORTS.JS - FIXED & CLEAN (V1.2) ==================== -->

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            loadShorts();
        } else {
            location.href = "login.html";
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
            const shortId = child.key;

            const div = document.createElement("div");
            div.className = "short";

            let mediaHTML = '';
            if (short.mediaUrl) {
                if (short.mediaUrl.includes('.mp4') || short.mediaUrl.toLowerCase().includes('video')) {
                    mediaHTML = `<video src="${short.mediaUrl}" style="width:100%; height:100%; object-fit:cover;" loop muted autoplay playsinline></video>`;
                } else {
                    mediaHTML = `<img src="${short.mediaUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                }
            } else {
                mediaHTML = `<div style="height:60vh; background:#222; display:flex; align-items:center; justify-content:center; color:#777;">
                    <h3>No Media Available</h3>
                </div>`;
            }

            div.innerHTML = `
                <div style="position:relative; height:100%;">
                    ${mediaHTML}
                    <div class="short-content" style="position:absolute; bottom:80px; left:0; right:0; padding:20px; background:linear-gradient(transparent, rgba(0,0,0,0.85));">
                        <h2 class="short-title">${short.title || "Amazing Short"}</h2>
                        <p class="short-user">by ${short.name || "Unknown"}</p>
                        
                        <div class="short-actions" style="margin-top:15px;">
                            <button class="like-btn" onclick="toggleShortLike('${shortId}', this)">
                                ❤️ ${short.likes || 0}
                            </button>
                            <button class="comment-btn" onclick="showComments('${shortId}', true)">
                                💬 Comment
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        setupActiveShorts();
    });
}

// ==================== FIXED LIKE FUNCTION ====================
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
        alert("Something went wrong");
    });
};

function setupActiveShorts() {
    const container = document.getElementById("shortsContainer");
    if (!container) return;

    let timeout;
    container.addEventListener("scroll", () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const shorts = container.querySelectorAll(".short");
            shorts.forEach(short => {
                const rect = short.getBoundingClientRect();
                if (rect.top >= 0 && rect.top < window.innerHeight * 0.5) {
                    short.classList.add("active");
                } else {
                    short.classList.remove("active");
                }
            });
        }, 80);
    });
}