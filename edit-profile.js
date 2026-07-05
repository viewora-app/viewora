// ==================== EDIT-PROFILE.JS - FINAL FIXED ====================

document.addEventListener("DOMContentLoaded", () => {

    const auth = firebase.auth();
    const db = firebase.database();

    let currentUser = null;

    // Auth Check + Load Data
    auth.onAuthStateChanged((user) => {
        if (!user) {
            alert("Please login first!");
            location.href = "login.html";
            return;
        }

        currentUser = user;
        loadCurrentProfile(user);
    });

    function loadCurrentProfile(user) {
        db.ref("users/" + user.uid).once("value").then((snap) => {
            const data = snap.val() || {};

            document.getElementById("nameInput").value = data.name || "";
            document.getElementById("usernameInput").value = data.username || "";
            document.getElementById("bioInput").value = data.bio || "";
            document.getElementById("photoInput").value = data.profilePhoto || "";

            const preview = document.getElementById("previewPhoto");
            if (preview) preview.src = data.profilePhoto || "non.jpg";
        });
    }

    // Live Preview
    const photoInput = document.getElementById("photoInput");
    if (photoInput) {
        photoInput.addEventListener("input", function () {
            document.getElementById("previewPhoto").src = this.value || "non.jpg";
        });
    }

    // Save Function
    window.updateProfile = function () {
        if (!currentUser) {
            alert("You are not logged in!");
            return;
        }

        const name = document.getElementById("nameInput").value.trim();
        const username = document.getElementById("usernameInput").value.trim();
        const bio = document.getElementById("bioInput").value.trim();
        const photoUrl = document.getElementById("photoInput").value.trim();
        const gender = document.getElementById("genderInput").value;

        if (!name) {
            alert("Name is required!");
            return;
        }

        db.ref("users/" + currentUser.uid).update({
            name: name,
            username: username || "@" + name.toLowerCase().replace(/\s/g, ""),
            bio: bio || "Welcome to Viewora 🚀",
            profilePhoto: photoUrl || "non.jpg",
            gender: gender
        })
        .then(() => {
            alert("✅ Profile Saved Successfully!");
            window.location.href = "profile.html";
        })
        .catch((error) => {
            console.error("Update Error:", error);
            alert("Save failed: " + error.message);
        });
    };
});