// ==================== USER.JS - FINAL FIXED VERSION ====================

console.log("✅ user.js loaded successfully");

// Remove duplicate declarations - firebase.js already defines them
// const auth = firebase.auth();  ←← Yeh line mat likho
// const db = firebase.database(); ←← Yeh bhi mat likho

let profileUid = null;
let currentUser = null;

// Get UID from URL
const params = new URLSearchParams(window.location.search);
profileUid = params.get("uid");

console.log("🔍 Profile UID:", profileUid);

auth.onAuthStateChanged((user) => {
    console.log("🔐 Auth State:", user ? user.uid : "No user");

    if (!user) {
        location.href = "login.html";
        return;
    }

    currentUser = user;

    if (!profileUid) {
        alert("No User ID found!");
        return;
    }

    loadUserProfile();
    loadFollowersCount();
    loadFollowingCount();
    checkFollowStatus();
});

function loadUserProfile() {
    console.log("📡 Fetching user:", profileUid);
    db.ref("users/" + profileUid).once("value").then((snap) => {
        console.log("User Data:", snap.val());
        if (!snap.exists()) {
            document.getElementById("profileName").innerText = "User Not Found";
            return;
        }

        const u = snap.val();
        document.getElementById("profileName").innerText = u.name || "No Name";
        document.getElementById("profileUsername").innerText = "@" + (u.username || "unknown");
        document.getElementById("profileBio").innerText = u.bio || "No bio yet";

        if (u.profilePhoto) document.getElementById("profilePic").src = u.profilePhoto;
    }).catch(err => console.error("Load error:", err));
}

function loadFollowersCount() {
    db.ref("followers/" + profileUid).on("value", (snap) => {
        document.getElementById("followersCount").innerText = snap.numChildren() || 0;
    });
}

function loadFollowingCount() {
    db.ref("following/" + profileUid).on("value", (snap) => {
        document.getElementById("followingCount").innerText = snap.numChildren() || 0;
    });
}

function checkFollowStatus() {
    if (currentUser.uid === profileUid) {
        document.getElementById("followBtn").style.display = "none";
        return;
    }

    db.ref("followers/" + profileUid + "/" + currentUser.uid).once("value").then((snap) => {
        const btn = document.getElementById("followBtn");
        btn.innerText = snap.exists() ? "Following" : "Follow";
        btn.onclick = toggleFollow;
    });
}

function toggleFollow() {
    const btn = document.getElementById("followBtn");
    const followRef = db.ref("followers/" + profileUid + "/" + currentUser.uid);

    followRef.once("value").then((snap) => {
        if (snap.exists()) {
            followRef.remove();
            db.ref("following/" + currentUser.uid + "/" + profileUid).remove();
            btn.innerText = "Follow";
        } else {
            followRef.set(true);
            db.ref("following/" + currentUser.uid + "/" + profileUid).set(true);
            btn.innerText = "Following";
        }
    });
}

// Global function for Message button
window.openChat = function() {
    console.log("💬 openChat called for UID:", profileUid);
    if (profileUid) {
        window.location.href = `chat.html?uid=${profileUid}`;
    } else {
        alert("Cannot open chat");
    }
};