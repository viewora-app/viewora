// ==================== UPLOAD.JS - Improved ====================

window.uploadContent = function() {
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const mediaUrl = document.getElementById("mediaUrl").value.trim();

    if (!title) {
        alert("Title is required!");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert("You are not logged in!");
        return;
    }

    db.ref("users/" + user.uid).once("value").then((snap) => {
        const u = snap.val() || {};

        const postId = db.ref("posts").push().key;

        db.ref("posts/" + postId).set({
            uid: user.uid,
            name: u.name || "User",
            username: u.username || "@user",
            profilePhoto: u.profilePhoto || "non.jpg",
            title: title,
            description: description || "",
            mediaUrl: mediaUrl || null,
            createdAt: Date.now(),
            likes: 0
        }).then(() => {
            alert("✅ Content Uploaded Successfully!");
            
            // Clear form
            document.getElementById("title").value = "";
            document.getElementById("description").value = "";
            document.getElementById("mediaUrl").value = "";

            // Redirect to feed
            window.location.href = "vieworation.html";
        }).catch((error) => {
            console.error("Upload Error:", error);
            alert("Failed to upload: " + error.message);
        });
    });
};

// Optional: Add preview for image URL
document.getElementById("mediaUrl").addEventListener("input", function() {
    const previewContainer = document.getElementById("mediaPreview");
    if (!previewContainer) return;

    if (this.value) {
        previewContainer.innerHTML = `<img src="${this.value}" style="max-width:100%; border-radius:12px; margin-top:10px;">`;
    } else {
        previewContainer.innerHTML = "";
    }
});