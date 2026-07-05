// ==================== PROFILE.JS - FINAL CLEAN VERSION ====================

document.addEventListener("DOMContentLoaded", () => {

    let profileUid = null;

    auth.onAuthStateChanged((user) => {
        if (!user) {
            location.href = "login.html";
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        profileUid = urlParams.get("uid") || user.uid;

        loadProfile();
        loadStats();
        setupButtons(user);
        loadProfilePosts();
    });

    function loadProfile() {
        if (!profileUid) return;

        db.ref("users/" + profileUid).on("value", (snap) => {
            const data = snap.val();
            if (!data) {
                document.getElementById("profileName").innerText = "User Not Found";
                return;
            }

            document.getElementById("profileName").innerText = data.name || "No Name";
            document.getElementById("profileUsername").innerText = "@" + (data.username || "unknown");
            document.getElementById("profileBio").innerText = data.bio || "No bio yet";

            const pic = document.getElementById("profilePic");
            if (pic) pic.src = data.profilePhoto || "non.jpg";
        });
    }

    function loadStats() {
        if (!profileUid) return;

        db.ref("followers/" + profileUid).on("value", (snap) => {
            document.getElementById("followersCount").innerText = snap.numChildren() || 0;
        });

        db.ref("following/" + profileUid).on("value", (snap) => {
            document.getElementById("followingCount").innerText = snap.numChildren() || 0;
        });
    }

    function setupButtons(currentUser) {
        if (!currentUser || !profileUid) return;

        const isOwnProfile = currentUser.uid === profileUid;

        const followBtn = document.getElementById("followBtn");
        const editBtn = document.getElementById("editProfileBtn");
        const messageBtn = document.getElementById("messageBtn");

        if (followBtn) followBtn.style.display = isOwnProfile ? "none" : "inline-block";
        if (editBtn) editBtn.style.display = isOwnProfile ? "inline-block" : "none";
        if (messageBtn) messageBtn.style.display = isOwnProfile ? "none" : "inline-block";
    }

    function loadProfilePosts() {
        const container = document.getElementById("profilePosts");
        if (!container) return;

        db.ref("posts").orderByChild("createdAt").on("value", (snapshot) => {
            let html = "";
            let count = 0;

            snapshot.forEach((child) => {
                const post = child.val();
                if (post.uid === profileUid) {
                    count++;
                    html += `
                        <div class="post" style="margin-bottom:15px; padding:15px; background:#1b1b1b; border-radius:12px;">
                            <p style="margin:8px 0;">${post.text}</p>
                    `;
                    if (post.imageUrl) {
                        html += `<img src="${post.imageUrl}" style="width:100%; border-radius:10px; margin:8px 0;">`;
                    }
                    html += `
                            <small style="color:#777;">${new Date(post.createdAt).toLocaleDateString()}</small>
                        </div>
                    `;
                }
            });

            container.innerHTML = count > 0 ? html : `
                <p style="text-align:center; padding:40px; color:#666;">No posts yet.<br>Go to Vieworation to create one!</p>
            `;
        });
    }

    function toggleFollow(currentUid) {
        const followRef = db.ref("followers/" + profileUid + "/" + currentUid);
        followRef.once("value").then(snap => {
            if (snap.exists()) {
                followRef.remove();
                db.ref("following/" + currentUid + "/" + profileUid).remove();
                document.getElementById("followBtn").innerText = "Follow";
            } else {
                followRef.set(true);
                db.ref("following/" + currentUid + "/" + profileUid).set(true);
                document.getElementById("followBtn").innerText = "Following";
            }
        });
    }

    window.openChat = function() {
        if (profileUid) window.location.href = `chat.html?uid=${profileUid}`;
    };
});