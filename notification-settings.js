// ======================================
// Viewora Notification Settings
// Part 1
// ======================================

// Current User
let currentUser = null;

// Default Settings
const defaultSettings = {

    likes: true,
    comments: true,
    followers: true,
    messages: true,
    mentions: true,
    stories: true,
    live: false,
    email: false,
    sound: true,
    vibration: true,
    dnd: false

};

// ======================================
// Authentication
// ======================================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    currentUser = user;

    loadNotificationSettings();

});

// ======================================
// Load Notification Settings
// ======================================

function loadNotificationSettings() {

    if (!currentUser) return;

    db.ref("notificationSettings/" + currentUser.uid)
    .once("value")
    .then((snapshot) => {

        const data = snapshot.val() || defaultSettings;

        setToggle("likesNotify", data.likes);
        setToggle("commentsNotify", data.comments);
        setToggle("followersNotify", data.followers);
        setToggle("messagesNotify", data.messages);
        setToggle("mentionsNotify", data.mentions);
        setToggle("storiesNotify", data.stories);
        setToggle("liveNotify", data.live);
        setToggle("emailNotify", data.email);
        setToggle("soundNotify", data.sound);
        setToggle("vibrationNotify", data.vibration);
        setToggle("dndNotify", data.dnd);

        showToast("🔔 Notification settings loaded");

    });

}

// ======================================
// Toggle Helper
// ======================================

function setToggle(id, value) {

    const element = document.getElementById(id);

    if (element) {

        element.checked = value;

    }

}

function getToggle(id) {

    const element = document.getElementById(id);

    return element ? element.checked : false;

}

// ======================================
// Refresh Settings
// ======================================

function refreshNotificationSettings() {

    loadNotificationSettings();

    showToast("🔄 Settings refreshed");

}

// ======================================
// Auto Refresh
// ======================================

setInterval(() => {

    if (currentUser) {

        loadNotificationSettings();

    }

}, 300000); // Every 5 minutes

console.log("✅ Notification Settings Part 1 Loaded");
// ======================================
// Viewora Notification Settings
// Part 2
// Save Settings
// ======================================

// Save Notification Settings

async function saveNotificationSettings() {

    if (!currentUser) return;

    const settings = {

        likes: getToggle("likesNotify"),
        comments: getToggle("commentsNotify"),
        followers: getToggle("followersNotify"),
        messages: getToggle("messagesNotify"),
        mentions: getToggle("mentionsNotify"),
        stories: getToggle("storiesNotify"),
        live: getToggle("liveNotify"),
        email: getToggle("emailNotify"),
        sound: getToggle("soundNotify"),
        vibration: getToggle("vibrationNotify"),
        dnd: getToggle("dndNotify"),

        updatedAt: firebase.database.ServerValue.TIMESTAMP

    };

    try{

        await db.ref("notificationSettings/" + currentUser.uid)
        .set(settings);

        showToast("✅ Notification Settings Saved");

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

}

// ======================================
// Live Toggle Events
// ======================================

const toggleIds=[

"likesNotify",
"commentsNotify",
"followersNotify",
"messagesNotify",
"mentionsNotify",
"storiesNotify",
"liveNotify",
"emailNotify",
"soundNotify",
"vibrationNotify",
"dndNotify"

];

toggleIds.forEach(id=>{

    const element=document.getElementById(id);

    if(!element) return;

    element.addEventListener("change",()=>{

        document.title="● Unsaved Notification Settings";

    });

});

// ======================================
// Notification Schedule
// ======================================

function openNotificationSchedule(){

    showToast("🕒 Notification Schedule coming soon");

}

// ======================================
// Save Shortcut
// Ctrl + S
// ======================================

document.addEventListener("keydown",(e)=>{

    if(e.ctrlKey && e.key.toLowerCase()==="s"){

        e.preventDefault();

        saveNotificationSettings();

    }

});

// ======================================
// Save Success
// ======================================

function notificationSaved(){

    document.title="🔔 Notification Settings • Viewora";

    showToast("💾 Settings Updated");

}

console.log("✅ Notification Settings Part 2 Loaded");
// ======================================
// Viewora Notification Settings
// Part 3
// Reset + Clear + Toast + Live Sync
// ======================================

// =============================
// Reset Notification Settings
// =============================

function resetNotificationSettings() {

    if (!confirm("Reset all notification settings to default?")) return;

    Object.keys(defaultSettings).forEach(key => {

        const map = {
            likes: "likesNotify",
            comments: "commentsNotify",
            followers: "followersNotify",
            messages: "messagesNotify",
            mentions: "mentionsNotify",
            stories: "storiesNotify",
            live: "liveNotify",
            email: "emailNotify",
            sound: "soundNotify",
            vibration: "vibrationNotify",
            dnd: "dndNotify"
        };

        setToggle(map[key], defaultSettings[key]);

    });

    document.title = "● Unsaved Notification Settings";

    showToast("🔄 Settings Reset");

}

// =============================
// Clear Notifications
// =============================

async function clearNotifications() {

    if (!currentUser) return;

    if (!confirm("Clear all notifications?")) return;

    try {

        await db.ref("notifications/" + currentUser.uid).remove();

        showToast("🧹 Notifications Cleared");

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Live Firebase Sync
// =============================

function enableLiveSync() {

    if (!currentUser) return;

    db.ref("notificationSettings/" + currentUser.uid)
    .on("value", (snapshot) => {

        if (!snapshot.exists()) return;

        const data = snapshot.val();

        setToggle("likesNotify", data.likes);
        setToggle("commentsNotify", data.comments);
        setToggle("followersNotify", data.followers);
        setToggle("messagesNotify", data.messages);
        setToggle("mentionsNotify", data.mentions);
        setToggle("storiesNotify", data.stories);
        setToggle("liveNotify", data.live);
        setToggle("emailNotify", data.email);
        setToggle("soundNotify", data.sound);
        setToggle("vibrationNotify", data.vibration);
        setToggle("dndNotify", data.dnd);

    });

}

// =============================
// Auto Save (Optional)
// =============================

let autoSaveTimer;

toggleIds.forEach(id => {

    const element = document.getElementById(id);

    if (!element) return;

    element.addEventListener("change", () => {

        clearTimeout(autoSaveTimer);

        autoSaveTimer = setTimeout(() => {

            saveNotificationSettings();

        }, 1500);

    });

});

// =============================
// Start Live Sync
// =============================

enableLiveSync();

console.log("✅ Notification Settings Part 3 Loaded");
// ======================================
// Viewora Notification Settings
// Part 4 (Final)
// ======================================

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
// Before Leaving Page
// =============================

window.addEventListener("beforeunload", (e) => {

    if (document.title === "● Unsaved Notification Settings") {

        e.preventDefault();

        e.returnValue = "";

    }

});

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
            background:linear-gradient(135deg,#00aaff,#0066ff);
            color:#fff;
            padding:14px 24px;
            border-radius:30px;
            font-size:15px;
            font-weight:bold;
            box-shadow:0 10px 30px rgba(0,170,255,.35);
            z-index:99999;
            opacity:0;
            transition:.35s;
        `;

        document.body.appendChild(toast);

    }

    toast.innerHTML = message;

    toast.style.opacity = "1";

    setTimeout(() => {

        toast.style.opacity = "0";

    }, 2500);

}

// =============================
// Logout
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
// Refresh Settings
// =============================

function refreshSettings() {

    loadNotificationSettings();

    showToast("🔄 Notification Settings Refreshed");

}

// =============================
// Startup
// =============================

window.addEventListener("load", () => {

    console.log("🔔 Notification Settings Ready");

    refreshSettings();

});

// =============================
// Final
// =============================

console.log("✅ notification-settings.js Loaded Successfully");