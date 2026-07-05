// ==================== SETTINGS.JS - FIXED (No Re-declaration) ====================

// No new auth/db declaration - firebase.js se use kar rahe hain

let currentUser = null;

auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    loadUserInfo();
});

function loadUserInfo() {
    db.ref("users/" + currentUser.uid).once("value").then((snap) => {
        const userData = snap.val();
        const userInfoEl = document.getElementById("userInfo");
        
        if (userData) {
            userInfoEl.innerHTML = `
                <strong>${userData.name || 'User'}</strong><br>
                <small>@${userData.username || 'unknown'}</small>
            `;
        } else {
            userInfoEl.innerText = "Hello, User!";
        }
    }).catch(() => {
        document.getElementById("userInfo").innerText = "Welcome!";
    });
}

// ==================== BUTTON FUNCTIONS ====================

function editProfile() {
    window.location.href = "edit-profile.html";
}

function goToNotifications() {
    window.location.href = "notifications.html";
}

function toggleDarkMode() {
    alert("🌙 Dark Mode is already enabled in Viewora.\n\nLight mode coming soon! ✨");
}

function showAbout() {
    alert("Viewora v1.0\n\nConnecting Creators with the World\nMade with ❤️");
}

// Logout
function logout() {
    if (confirm("Are you sure you want to logout?")) {
        auth.signOut().then(() => {
            window.location.href = "login.html";
        }).catch((error) => {
            console.error("Logout error:", error);
            alert("Logout failed! Please try again.");
        });
    }
}

// Extra buttons
document.addEventListener("DOMContentLoaded", () => {
    const aboutBtn = document.querySelectorAll(".setting-card")[4]; // About
    if (aboutBtn) aboutBtn.onclick = showAbout;

    const termsBtn = document.querySelectorAll(".setting-card")[5];
    if (termsBtn) termsBtn.onclick = () => alert("Terms & Conditions\n\nComing soon...");

    const helpBtn = document.querySelectorAll(".setting-card")[6];
    if (helpBtn) helpBtn.onclick = () => alert("Help & Support\n\nContact: your.email@gmail.com");
});