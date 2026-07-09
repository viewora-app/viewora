// =======================================
// Viewora Support Settings
// Part 1
// Firebase + Authentication
// =======================================

// Current User
let currentUser = null;

// Firebase References
let supportRef = null;
let feedbackRef = null;

// =======================================
// Authentication
// =======================================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    currentUser = user;

    supportRef = db.ref("support");
    feedbackRef = db.ref("feedback/" + currentUser.uid);

    loadSupportProfile();

});

// =======================================
// Load User Profile
// =======================================

function loadSupportProfile() {

    db.ref("users/" + currentUser.uid)

    .once("value")

    .then((snapshot) => {

        const user = snapshot.val() || {};

        console.log("Support User Loaded");

        showToast(
            "👋 Welcome " +
            (user.name || "User")
        );

    })

    .catch((error) => {

        console.error(error);

    });

}

// =======================================
// Support Functions
// =======================================

// Contact Support

function contactSupport() {

    window.location.href =
    "mailto:vieworasupport@gmail.com?subject=Viewora Support";

}

// Help Center

function openHelpCenter() {

    showToast("📚 Opening Help Center...");

    setTimeout(() => {

        window.open(
            "help-center.html",
            "_blank"
        );

    }, 500);

}

// Live Chat

function openLiveChat() {

    showToast("💬 Live Chat Coming Soon");

}

// =======================================
// Utility
// =======================================

function getCurrentTime() {

    return new Date().toLocaleString();

}

console.log("✅ Support Settings Part 1 Loaded");
// =======================================
// Viewora Support Settings
// Part 2
// Feedback + Bug Report + FAQ
// =======================================

// =============================
// Send Feedback
// =============================

async function sendFeedback() {

    if (!currentUser) return;

    const message = prompt("💡 Enter your feedback:");

    if (!message || message.trim() === "") {

        showToast("⚠️ Feedback cancelled");

        return;

    }

    try {

        await feedbackRef.push({

            message: message.trim(),

            createdAt: firebase.database.ServerValue.TIMESTAMP,

            userId: currentUser.uid,

            email: currentUser.email || ""

        });

        showToast("✅ Feedback Sent Successfully");

    }

    catch (error) {

        console.error(error);

        showToast("❌ Failed to send feedback");

    }

}

// =============================
// Report Bug
// =============================

async function reportBug() {

    if (!currentUser) return;

    const bug = prompt("🐞 Describe the bug:");

    if (!bug || bug.trim() === "") {

        showToast("⚠️ Bug report cancelled");

        return;

    }

    try {

        await supportRef.child("bugReports").push({

            userId: currentUser.uid,

            email: currentUser.email || "",

            message: bug.trim(),

            createdAt: firebase.database.ServerValue.TIMESTAMP,

            status: "Open"

        });

        showToast("🐞 Bug Report Submitted");

    }

    catch (error) {

        console.error(error);

        showToast("❌ Failed to submit bug");

    }

}

// =============================
// FAQ
// =============================

function openFAQ() {

    alert(
`❓ Frequently Asked Questions

• How do I reset my password?
→ Open Security Settings.

• How do I delete my account?
→ Open Account Settings.

• How do I contact support?
→ Tap Email Support.

• How do I report bugs?
→ Use the Report Bug option.

• Where are downloads stored?
→ Downloads section in Settings.`
    );

}

// =============================
// Rate App
// =============================

function rateApp() {

    showToast("⭐ Thanks for supporting Viewora!");

    // Replace with your Play Store/App Store URL
    window.open(
        "https://play.google.com/store",
        "_blank"
    );

}

// =============================
// Visit Website
// =============================

function visitWebsite() {

    window.open(
        "https://example.com",
        "_blank"
    );

}

// =============================

console.log("✅ Support Settings Part 2 Loaded");
// =======================================
// Viewora Support Settings
// Part 3
// Analytics + History + Auto Refresh
// =======================================

// =============================
// Load Support Analytics
// =============================

function loadSupportAnalytics() {

    if (!currentUser) return;

    feedbackRef.once("value")

    .then((snapshot) => {

        const total = snapshot.numChildren();

        console.log("📊 Total Feedback:", total);

    })

    .catch((error) => {

        console.error(error);

    });

}

// =============================
// Load Contact History
// =============================

function loadContactHistory() {

    if (!currentUser) return;

    supportRef.child("bugReports")

    .orderByChild("userId")

    .equalTo(currentUser.uid)

    .once("value")

    .then((snapshot) => {

        console.log("📩 Contact History Loaded");

        snapshot.forEach((child) => {

            console.log(child.val());

        });

    })

    .catch((error) => {

        console.error(error);

    });

}

// =============================
// Auto Refresh
// =============================

let supportRefreshTimer = null;

function startSupportRefresh() {

    stopSupportRefresh();

    supportRefreshTimer = setInterval(() => {

        loadSupportAnalytics();

        loadContactHistory();

    }, 30000);

}

function stopSupportRefresh() {

    if (supportRefreshTimer) {

        clearInterval(supportRefreshTimer);

        supportRefreshTimer = null;

    }

}

startSupportRefresh();

// =============================
// Internet Status
// =============================

window.addEventListener("online", () => {

    showToast("🌐 Internet Connected");

});

window.addEventListener("offline", () => {

    showToast("📡 No Internet Connection");

});

// =============================
// Page Visibility
// =============================

document.addEventListener("visibilitychange", () => {

    if (document.hidden) {

        stopSupportRefresh();

    } else {

        startSupportRefresh();

        loadSupportAnalytics();

        loadContactHistory();

    }

});

// =============================
// Realtime Feedback Updates
// =============================

feedbackRef.on("value", () => {

    console.log("🔄 Feedback Updated");

});

// =============================

console.log("✅ Support Settings Part 3 Loaded");
// =======================================
// Viewora Support Settings
// Part 4 (Final)
// =======================================

// =============================
// Premium Toast
// =============================

function showToast(message) {

    let toast = document.getElementById("vieworaToast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "vieworaToast";

        toast.style.cssText = `
            position:fixed;
            left:50%;
            bottom:30px;
            transform:translateX(-50%);
            background:linear-gradient(135deg,#00aaff,#7c3aed);
            color:#fff;
            padding:14px 24px;
            border-radius:30px;
            font-size:15px;
            font-weight:bold;
            box-shadow:0 12px 30px rgba(0,170,255,.35);
            z-index:99999;
            opacity:0;
            transition:.35s;
            pointer-events:none;
        `;

        document.body.appendChild(toast);

    }

    toast.textContent = message;
    toast.style.opacity = "1";

    clearTimeout(toast.hideTimer);

    toast.hideTimer = setTimeout(() => {

        toast.style.opacity = "0";

    }, 2500);

}

// =============================
// Logout Helper
// =============================

async function logout() {

    if (!confirm("Logout from Viewora?")) return;

    try {

        await auth.signOut();

        showToast("👋 Logged Out");

        setTimeout(() => {

            window.location.href = "login.html";

        }, 800);

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Cleanup
// =============================

window.addEventListener("beforeunload", () => {

    stopSupportRefresh();

    if (feedbackRef) {

        feedbackRef.off();

    }

});

// =============================
// Startup
// =============================

window.addEventListener("load", () => {

    startSupportRefresh();

    loadSupportAnalytics();

    loadContactHistory();

    showToast("🛟 Support Center Ready");

});

// =============================
// Final Debug Logs
// =============================

console.log("==================================");
console.log("🛟 Viewora Support Center Loaded");
console.log("✅ Firebase Connected");
console.log("✅ Support Ready");
console.log("✅ Feedback System Ready");
console.log("✅ Bug Reporting Ready");
console.log("✅ Auto Refresh Enabled");
console.log("==================================");