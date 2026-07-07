// ==================== PROFILE.JS ====================

let currentUser = null;
let profileUid = null;

auth.onAuthStateChanged((user) => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    currentUser = user;

    const params = new URLSearchParams(window.location.search);
    profileUid = params.get("uid") || user.uid;

    loadProfile();
    loadStats();
    loadPosts();
    loadStories();
    setupButtons();

});

// ==================== PROFILE ====================

function loadProfile() {

    db.ref("users/" + profileUid).on("value", (snap) => {

        if (!snap.exists()) return;

        const data = snap.val();

        document.getElementById("profileName").innerText =
            data.name || "User";

        document.getElementById("profileUsername").innerText =
            data.username || "@unknown";

        document.getElementById("profileBio").innerText =
            data.bio || "";

        const img = document.getElementById("profilePic");

        if (img) {
            img.src = data.profilePhoto || "non.jpg";
        }

    });

}

// ==================== STATS ====================

function loadStats() {

    db.ref("followers/" + profileUid).on("value", (snap) => {

        document.getElementById("followersCount").innerText =
            snap.numChildren();

    });

    db.ref("following/" + profileUid).on("value", (snap) => {

        document.getElementById("followingCount").innerText =
            snap.numChildren();

    });

    db.ref("posts").orderByChild("uid").equalTo(profileUid).on("value", (snap) => {

        document.getElementById("postsCount").innerText =
            snap.numChildren();

    });

}

// ==================== BUTTONS ====================

function setupButtons() {

    const own = currentUser.uid === profileUid;

    const followBtn = document.getElementById("followBtn");
    const editBtn = document.getElementById("editProfileBtn");
    const msgBtn = document.getElementById("messageBtn");

    if (followBtn)
        followBtn.style.display = own ? "none" : "inline-block";

    if (editBtn)
        editBtn.style.display = own ? "inline-block" : "none";

    if (msgBtn)
        msgBtn.style.display = own ? "none" : "inline-block";

}

// ==================== POSTS ====================

function loadPosts() {

    const container = document.getElementById("profilePosts");

    if (!container) return;

    db.ref("posts").orderByChild("createdAt").on("value", (snapshot) => {

        let html = "";
        let found = false;

        let posts = [];

        snapshot.forEach((child) => {

            posts.push({
                id: child.key,
                ...child.val()
            });

        });

        posts.reverse();

        posts.forEach((post) => {

            if (post.uid !== profileUid) return;

            found = true;

            html += `

            <div class="post-card">

                <p>${post.text || ""}</p>

                ${
                    post.mediaUrl
                    ? `<img src="${post.mediaUrl}" style="width:100%;border-radius:12px;margin-top:10px;">`
                    : ""
                }

                <small>
                    ${new Date(post.createdAt).toLocaleString()}
                </small>

            </div>

            `;

        });

        container.innerHTML = found
            ? html
            : "<p style='text-align:center;padding:40px;'>No Posts Yet</p>";

    });

}

// ==================== STORIES ====================

function loadStories() {

    const ring = document.getElementById("storyRing");

    if (!ring) return;

    db.ref("stories").orderByChild("createdAt").on("value", (snapshot) => {

        let active = false;
        const now = Date.now();

        snapshot.forEach((child) => {

            const story = child.val();

            if (
                story.uid === profileUid &&
                story.expiresAt > now
            ) {

                active = true;

            }

        });

        ring.style.border = active
            ? "4px solid #ff0066"
            : "4px solid #333";

    });

}

// ==================== CHAT ====================

function openChat() {

    location.href = "chat.html?uid=" + profileUid;

}

// ==================== FOLLOW BUTTON ====================

function followUser() {

    if (currentUser.uid === profileUid) return;

    db.ref("followers/" + profileUid + "/" + currentUser.uid).set(true);

    db.ref("following/" + currentUser.uid + "/" + profileUid).set(true);

    alert("Followed");

}

// ==================== UNFOLLOW ====================

function unfollowUser() {

    db.ref("followers/" + profileUid + "/" + currentUser.uid).remove();

    db.ref("following/" + currentUser.uid + "/" + profileUid).remove();

    alert("Unfollowed");

}