// ======================================
// SETTINGS.JS V2.0 - PART 1
// Login + User Info + Utilities
// ======================================

let currentUser = null;
let currentUserData = null;

// ===============================
// Authentication
// ===============================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    currentUser = user;

    loadUserProfile();

});

// ===============================
// Load User Profile
// ===============================

function loadUserProfile() {

    const userInfo = document.getElementById("userInfo");

    if (!userInfo) return;

    db.ref("users/" + currentUser.uid)
        .once("value")
        .then((snapshot) => {

            currentUserData = snapshot.val() || {};

            userInfo.innerHTML = `

            <div style="text-align:center;">

                <img
                src="${currentUserData.profilePhoto || "non.jpg"}"
                style="
                width:90px;
                height:90px;
                border-radius:50%;
                object-fit:cover;
                border:3px solid #00aaff;
                margin-bottom:12px;">

                <h2 style="margin:5px 0;">
                    ${currentUserData.name || "User"}
                </h2>

                <p style="color:#aaa;">
                    @${currentUserData.username || "unknown"}
                </p>

            </div>

            `;

        })

        .catch(() => {

            userInfo.innerHTML = `
            <h3>Welcome 👋</h3>
            `;

        });

}

// ===============================
// Utility Toast
// ===============================

function showToast(message) {

    let toast = document.getElementById("toast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "toast";

        toast.style.cssText = `
            position:fixed;
            bottom:90px;
            left:50%;
            transform:translateX(-50%);
            background:#222;
            color:#fff;
            padding:12px 20px;
            border-radius:30px;
            font-size:14px;
            z-index:9999;
            opacity:0;
            transition:.3s;
        `;

        document.body.appendChild(toast);

    }

    toast.innerText = message;

    toast.style.opacity = "1";

    setTimeout(() => {

        toast.style.opacity = "0";

    }, 2500);

}

// ===============================
// Edit Profile
// ===============================

window.editProfile = function () {

    window.location.href = "edit-profile.html";

};

// ======================================
// END OF PART 1
// ======================================
// ======================================
// SETTINGS.JS V2.0 - PART 2
// Dark Mode + Settings Actions
// ======================================

// ===============================
// Dark Mode
// ===============================

function applyTheme() {

    const mode = localStorage.getItem("viewora_theme") || "dark";

    if (mode === "light") {

        document.body.style.background = "#f5f5f5";
        document.body.style.color = "#111";

        document.querySelectorAll(".setting-card").forEach(card => {
            card.style.background = "#ffffff";
            card.style.color = "#111";
        });

        showToast("☀️ Light Mode Enabled");

    } else {

        document.body.style.background = "#111";
        document.body.style.color = "#fff";

        document.querySelectorAll(".setting-card").forEach(card => {
            card.style.background = "#1b1b1b";
            card.style.color = "#fff";
        });

        showToast("🌙 Dark Mode Enabled");

    }

}

window.toggleDarkMode = function () {

    const current =
        localStorage.getItem("viewora_theme") || "dark";

    const next =
        current === "dark" ? "light" : "dark";

    localStorage.setItem("viewora_theme", next);

    applyTheme();

};

// Apply theme when page opens
document.addEventListener("DOMContentLoaded", () => {

    applyTheme();

});

// ===============================
// Notifications
// ===============================

window.goToNotifications = function () {

    window.location.href = "notifications.html";

};

// ===============================
// About
// ===============================

window.showAbout = function () {

    showToast("Viewora v1.0 ❤️");

    setTimeout(() => {

        alert(
`Viewora v1.0

A modern social media platform.

Developed with ❤️

© Viewora Team`
        );

    }, 400);

};

// ===============================
// Terms
// ===============================

window.showTerms = function () {

    alert(
`Terms & Conditions

• Respect all users
• No spam
• No harmful content
• Follow community guidelines`
    );

};

// ===============================
// Help
// ===============================

window.showHelp = function () {

    alert(
`Need Help?

Email:
vieworasupport@gmail.com

We'll respond as soon as possible.`
    );

};

// ===============================
// END OF PART 2
// ===============================
// ======================================
// SETTINGS.JS V2.0 - PART 3
// Logout + Animations + Final
// ======================================

// Logout
window.logout = function () {

    if (!currentUser) return;

    const ok = confirm("Are you sure you want to logout?");

    if (!ok) return;

    auth.signOut()
    .then(() => {

        showToast("Logged out successfully");

        setTimeout(() => {

            window.location.href = "login.html";

        },800);

    })
    .catch((err) => {

        console.error(err);

        alert("Logout Failed!");

    });

};

// ===============================
// Card Animation
// ===============================

document.addEventListener("DOMContentLoaded",()=>{

    const cards=document.querySelectorAll(".setting-card");

    cards.forEach((card,index)=>{

        card.style.opacity="0";
        card.style.transform="translateY(25px)";

        setTimeout(()=>{

            card.style.transition=".4s";

            card.style.opacity="1";

            card.style.transform="translateY(0)";

        },index*100);

    });

});

// ===============================
// Button Actions
// ===============================

document.addEventListener("DOMContentLoaded",()=>{

    const cards=document.querySelectorAll(".setting-card");

    if(cards[3]){
        cards[3].onclick=()=>{
            window.open("privacy.html","_blank");
        };
    }

    if(cards[4]){
        cards[4].onclick=showAbout;
    }

    if(cards[5]){
        cards[5].onclick=showTerms;
    }

    if(cards[6]){
        cards[6].onclick=showHelp;
    }

});

// ===============================
// Network Status
// ===============================

window.addEventListener("offline",()=>{

    showToast("📡 No Internet");

});

window.addEventListener("online",()=>{

    showToast("✅ Connected");

});

// ===============================
// Version
// ===============================

console.log("✅ Viewora Settings V2.0 Loaded");