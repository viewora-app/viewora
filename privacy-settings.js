// =======================================
// Viewora Privacy Settings
// Part 1
// =======================================

// Current User
let currentUser = null;

// Default Privacy Settings
const defaultPrivacy = {

    privateAccount: false,
    profileVisibility: "everyone",
    onlineStatus: true,
    readReceipts: true,
    lastSeen: "everyone",
    locationSharing: false,
    storyPrivacy: "everyone",
    messagePrivacy: "everyone",
    commentPrivacy: "everyone"

};

// =======================================
// Authentication
// =======================================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    currentUser = user;

    loadPrivacySettings();

});

// =======================================
// Load Privacy Settings
// =======================================

function loadPrivacySettings() {

    if (!currentUser) return;

    db.ref("privacySettings/" + currentUser.uid)

    .once("value")

    .then((snapshot) => {

        const data = snapshot.val() || defaultPrivacy;

        setToggle("privateAccount", data.privateAccount);

        document.getElementById("profileVisibility").value =
            data.profileVisibility;

        setToggle("onlineStatus", data.onlineStatus);

        setToggle("readReceipts", data.readReceipts);

        document.getElementById("lastSeen").value =
            data.lastSeen;

        setToggle("locationSharing", data.locationSharing);

        document.getElementById("storyPrivacy").value =
            data.storyPrivacy;

        document.getElementById("messagePrivacy").value =
            data.messagePrivacy;

        document.getElementById("commentPrivacy").value =
            data.commentPrivacy;

        showToast("🔒 Privacy Settings Loaded");

    })

    .catch((error)=>{

        console.error(error);

    });

}

// =======================================
// Helper Functions
// =======================================

function setToggle(id,value){

    const el=document.getElementById(id);

    if(el){

        el.checked=value;

    }

}

function getToggle(id){

    const el=document.getElementById(id);

    return el ? el.checked : false;

}

// =======================================
// Apply Privacy UI
// =======================================

function applyPrivacyUI(data){

    // Private Account Badge
    const badge=document.querySelector(".privacy-status");

    if(badge){

        badge.innerHTML=data.privateAccount
        ? "🔒 Private Account Enabled"
        : "🌍 Public Account";

    }

}

// =======================================

console.log("✅ Privacy Settings Part 1 Loaded");
// =======================================
// Viewora Privacy Settings
// Part 2
// Save + Live Update
// =======================================

// Save Privacy Settings

async function savePrivacySettings() {

    if (!currentUser) return;

    const settings = {

        privateAccount: getToggle("privateAccount"),

        profileVisibility:
        document.getElementById("profileVisibility").value,

        onlineStatus:
        getToggle("onlineStatus"),

        readReceipts:
        getToggle("readReceipts"),

        lastSeen:
        document.getElementById("lastSeen").value,

        locationSharing:
        getToggle("locationSharing"),

        storyPrivacy:
        document.getElementById("storyPrivacy").value,

        messagePrivacy:
        document.getElementById("messagePrivacy").value,

        commentPrivacy:
        document.getElementById("commentPrivacy").value,

        updatedAt:
        firebase.database.ServerValue.TIMESTAMP

    };

    try{

        await db.ref("privacySettings/" + currentUser.uid)
        .set(settings);

        applyPrivacyUI(settings);

        document.title = "🔒 Privacy • Viewora";

        showToast("✅ Privacy Settings Saved");

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

}

// =======================================
// Live Update
// =======================================

function previewPrivacySettings(){

    const data={

        privateAccount:
        getToggle("privateAccount"),

        profileVisibility:
        document.getElementById("profileVisibility").value,

        onlineStatus:
        getToggle("onlineStatus"),

        readReceipts:
        getToggle("readReceipts"),

        lastSeen:
        document.getElementById("lastSeen").value,

        locationSharing:
        getToggle("locationSharing"),

        storyPrivacy:
        document.getElementById("storyPrivacy").value,

        messagePrivacy:
        document.getElementById("messagePrivacy").value,

        commentPrivacy:
        document.getElementById("commentPrivacy").value

    };

    applyPrivacyUI(data);

    showToast("👀 Live Preview Updated");

}

// =======================================
// Unsaved Changes
// =======================================

const privacyControls=[

"privateAccount",
"profileVisibility",
"onlineStatus",
"readReceipts",
"lastSeen",
"locationSharing",
"storyPrivacy",
"messagePrivacy",
"commentPrivacy"

];

privacyControls.forEach(id=>{

    const el=document.getElementById(id);

    if(!el) return;

    el.addEventListener("change",()=>{

        document.title="● Unsaved Privacy";

        previewPrivacySettings();

    });

});

// =======================================
// Ctrl + S Shortcut
// =======================================

document.addEventListener("keydown",(e)=>{

    if(e.ctrlKey && e.key.toLowerCase()==="s"){

        e.preventDefault();

        savePrivacySettings();

    }

});

console.log("✅ Privacy Settings Part 2 Loaded");
// =======================================
// Viewora Privacy Settings
// Part 3
// Reset + Auto Save + Firebase Sync
// =======================================

// =============================
// Reset Privacy Settings
// =============================

function resetPrivacySettings() {

    if (!confirm("Reset all privacy settings to default?")) return;

    setToggle("privateAccount", defaultPrivacy.privateAccount);

    document.getElementById("profileVisibility").value =
        defaultPrivacy.profileVisibility;

    setToggle("onlineStatus", defaultPrivacy.onlineStatus);

    setToggle("readReceipts", defaultPrivacy.readReceipts);

    document.getElementById("lastSeen").value =
        defaultPrivacy.lastSeen;

    setToggle("locationSharing", defaultPrivacy.locationSharing);

    document.getElementById("storyPrivacy").value =
        defaultPrivacy.storyPrivacy;

    document.getElementById("messagePrivacy").value =
        defaultPrivacy.messagePrivacy;

    document.getElementById("commentPrivacy").value =
        defaultPrivacy.commentPrivacy;

    applyPrivacyUI(defaultPrivacy);

    document.title = "● Unsaved Privacy";

    showToast("🔄 Privacy Reset");

}

// =============================
// Auto Save
// =============================

let privacyAutoSaveTimer;

privacyControls.forEach(id => {

    const element = document.getElementById(id);

    if (!element) return;

    element.addEventListener("change", () => {

        clearTimeout(privacyAutoSaveTimer);

        privacyAutoSaveTimer = setTimeout(() => {

            savePrivacySettings();

        }, 1500);

    });

});

// =============================
// Download My Data
// =============================

function downloadMyData() {

    if (!currentUser) return;

    db.ref("users/" + currentUser.uid)
    .once("value")
    .then((snapshot) => {

        const data = snapshot.val() || {};

        const file = new Blob(
            [JSON.stringify(data, null, 2)],
            { type: "application/json" }
        );

        const link = document.createElement("a");

        link.href = URL.createObjectURL(file);

        link.download = "viewora-data.json";

        link.click();

        showToast("📥 Data Downloaded");

    });

}

// =============================
// Delete My Data
// =============================

async function deleteMyData() {

    if (!currentUser) return;

    const confirmDelete = confirm(
        "Delete all your Viewora data? This action cannot be undone."
    );

    if (!confirmDelete) return;

    try {

        await db.ref("users/" + currentUser.uid).remove();

        await db.ref("privacySettings/" + currentUser.uid).remove();

        showToast("🗑️ Data Deleted");

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Live Firebase Sync
// =============================

function enablePrivacySync() {

    if (!currentUser) return;

    db.ref("privacySettings/" + currentUser.uid)

    .on("value", (snapshot) => {

        if (!snapshot.exists()) return;

        applyPrivacyUI(snapshot.val());

    });

}

enablePrivacySync();

console.log("✅ Privacy Settings Part 3 Loaded");
// =======================================
// Viewora Privacy Settings
// Part 4 (Final)
// =======================================

// =============================
// Premium Toast
// =============================

function showToast(message){

    let toast=document.getElementById("vieworaToast");

    if(!toast){

        toast=document.createElement("div");

        toast.id="vieworaToast";

        toast.style.cssText=`
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
        `;

        document.body.appendChild(toast);

    }

    toast.textContent=message;

    toast.style.opacity="1";

    clearTimeout(toast.hideTimer);

    toast.hideTimer=setTimeout(()=>{

        toast.style.opacity="0";

    },2500);

}

// =============================
// Refresh Settings
// =============================

function refreshPrivacySettings(){

    loadPrivacySettings();

    showToast("🔄 Privacy Settings Refreshed");

}

// =============================
// Internet Status
// =============================

window.addEventListener("online",()=>{

    showToast("🌐 Internet Connected");

});

window.addEventListener("offline",()=>{

    showToast("📡 No Internet Connection");

});

// =============================
// Unsaved Changes Warning
// =============================

window.addEventListener("beforeunload",(e)=>{

    if(document.title==="● Unsaved Privacy"){

        e.preventDefault();

        e.returnValue="";

    }

});

// =============================
// Logout Helper
// =============================

async function logout(){

    if(!confirm("Logout from Viewora?")) return;

    try{

        await auth.signOut();

        showToast("👋 Logged Out");

        setTimeout(()=>{

            window.location.href="login.html";

        },800);

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Startup
// =============================

window.addEventListener("load",()=>{

    refreshPrivacySettings();

    console.log("🔒 Privacy Settings Ready");

});

// =============================
// Final
// =============================

console.log("✅ privacy-settings.js Loaded Successfully");