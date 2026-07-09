// ======================================
// Viewora Appearance Settings
// Part 1
// ======================================

// Current User
let currentUser = null;

// Default Appearance Settings
const defaultAppearance = {

    theme: "dark",
    accentColor: "#00aaff",
    themeColor: "#7c3aed",
    fontSize: "medium",
    animations: true,
    blur: true,
    compact: false,
    background: "default",
    rounded: true

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

    loadAppearanceSettings();

});

// ======================================
// Load Settings
// ======================================

function loadAppearanceSettings() {

    if (!currentUser) return;

    db.ref("appearanceSettings/" + currentUser.uid)
    .once("value")
    .then((snapshot) => {

        const data = snapshot.val() || defaultAppearance;

        setToggle("darkMode", data.theme === "dark");
        setToggle("lightMode", data.theme === "light");

        document.getElementById("accentColor").value =
            data.accentColor;

        document.getElementById("themeColor").value =
            data.themeColor;

        document.getElementById("fontSize").value =
            data.fontSize;

        setToggle("uiAnimations", data.animations);

        setToggle("blurEffects", data.blur);

        setToggle("compactMode", data.compact);

        document.getElementById("chatBackground").value =
            data.background;

        setToggle("roundedCorners", data.rounded);

        applyAppearance(data);

        showToast("🎨 Appearance Loaded");

    });

}

// ======================================
// Helpers
// ======================================

function setToggle(id, value) {

    const el = document.getElementById(id);

    if (el) el.checked = value;

}

function getToggle(id) {

    const el = document.getElementById(id);

    return el ? el.checked : false;

}

// ======================================
// Apply Theme
// ======================================

function applyAppearance(data) {

    document.body.style.fontSize =

        data.fontSize === "small" ? "14px" :
        data.fontSize === "large" ? "18px" :
        data.fontSize === "xlarge" ? "20px" :
        "16px";

    document.documentElement.style.setProperty(
        "--accent-color",
        data.accentColor
    );

    document.documentElement.style.setProperty(
        "--theme-color",
        data.themeColor
    );

    if (data.theme === "light") {

        document.body.style.background = "#f5f5f5";
        document.body.style.color = "#111";

    } else {

        document.body.style.background = "#0d1117";
        document.body.style.color = "#fff";

    }

}

// ======================================

console.log("✅ Appearance Settings Part 1 Loaded");
// ======================================
// Viewora Appearance Settings
// Part 2
// Save + Live Preview
// ======================================

// Save Appearance Settings

async function saveAppearanceSettings() {

    if (!currentUser) return;

    const settings = {

        theme: getToggle("darkMode") ? "dark" : "light",

        accentColor: document.getElementById("accentColor").value,

        themeColor: document.getElementById("themeColor").value,

        fontSize: document.getElementById("fontSize").value,

        animations: getToggle("uiAnimations"),

        blur: getToggle("blurEffects"),

        compact: getToggle("compactMode"),

        background: document.getElementById("chatBackground").value,

        rounded: getToggle("roundedCorners"),

        updatedAt: firebase.database.ServerValue.TIMESTAMP

    };

    try {

        await db.ref("appearanceSettings/" + currentUser.uid)
        .set(settings);

        applyAppearance(settings);

        document.title = "🎨 Appearance • Viewora";

        showToast("✅ Appearance Saved");

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

}

// ======================================
// Live Preview
// ======================================

function previewAppearance(){

    const settings={

        theme:getToggle("darkMode") ? "dark":"light",

        accentColor:document.getElementById("accentColor").value,

        themeColor:document.getElementById("themeColor").value,

        fontSize:document.getElementById("fontSize").value,

        animations:getToggle("uiAnimations"),

        blur:getToggle("blurEffects"),

        compact:getToggle("compactMode"),

        background:document.getElementById("chatBackground").value,

        rounded:getToggle("roundedCorners")

    };

    applyAppearance(settings);

    showToast("👀 Live Preview Updated");

}

// ======================================
// Unsaved Changes
// ======================================

const appearanceControls=[

"darkMode",
"lightMode",
"accentColor",
"themeColor",
"fontSize",
"uiAnimations",
"blurEffects",
"compactMode",
"chatBackground",
"roundedCorners"

];

appearanceControls.forEach(id=>{

    const el=document.getElementById(id);

    if(!el) return;

    el.addEventListener("change",()=>{

        document.title="● Unsaved Appearance";

        previewAppearance();

    });

});

// ======================================
// Theme Selection Logic
// ======================================

document.getElementById("darkMode")
.addEventListener("change",function(){

    if(this.checked){

        document.getElementById("lightMode").checked=false;

    }

});

document.getElementById("lightMode")
.addEventListener("change",function(){

    if(this.checked){

        document.getElementById("darkMode").checked=false;

    }

});

// ======================================
// Ctrl + S Shortcut
// ======================================

document.addEventListener("keydown",(e)=>{

    if(e.ctrlKey && e.key.toLowerCase()==="s"){

        e.preventDefault();

        saveAppearanceSettings();

    }

});

console.log("✅ Appearance Settings Part 2 Loaded");
// ======================================
// Viewora Appearance Settings
// Part 3
// Reset + Auto Save + Live Sync
// ======================================

// =============================
// Reset Appearance
// =============================

function resetAppearance() {

    if (!confirm("Reset appearance settings to default?")) return;

    setToggle("darkMode", true);
    setToggle("lightMode", false);

    document.getElementById("accentColor").value =
        defaultAppearance.accentColor;

    document.getElementById("themeColor").value =
        defaultAppearance.themeColor;

    document.getElementById("fontSize").value =
        defaultAppearance.fontSize;

    setToggle("uiAnimations",
        defaultAppearance.animations);

    setToggle("blurEffects",
        defaultAppearance.blur);

    setToggle("compactMode",
        defaultAppearance.compact);

    document.getElementById("chatBackground").value =
        defaultAppearance.background;

    setToggle("roundedCorners",
        defaultAppearance.rounded);

    applyAppearance(defaultAppearance);

    document.title = "● Unsaved Appearance";

    showToast("🔄 Appearance Reset");

}

// =============================
// Auto Save
// =============================

let appearanceTimer;

appearanceControls.forEach(id => {

    const element = document.getElementById(id);

    if (!element) return;

    element.addEventListener("change", () => {

        clearTimeout(appearanceTimer);

        appearanceTimer = setTimeout(() => {

            saveAppearanceSettings();

        }, 1500);

    });

});

// =============================
// Live Firebase Sync
// =============================

function enableAppearanceSync() {

    if (!currentUser) return;

    db.ref("appearanceSettings/" + currentUser.uid)

    .on("value", (snapshot) => {

        if (!snapshot.exists()) return;

        const data = snapshot.val();

        applyAppearance(data);

    });

}

enableAppearanceSync();

// =============================
// Apply Extra UI Options
// =============================

function applyExtraAppearance(data) {

    // Blur Effects
    document.querySelectorAll(".setting-card,.preview-card")
    .forEach(card => {

        card.style.backdropFilter =
            data.blur ? "blur(16px)" : "none";

    });

    // Compact Mode
    document.body.classList.toggle(
        "compact-mode",
        data.compact
    );

    // Rounded Corners
    document.querySelectorAll(".setting-card,button")
    .forEach(item => {

        item.style.borderRadius =
            data.rounded ? "18px" : "6px";

    });

    // Chat Background Preview
    const preview = document.querySelector(".phone-preview");

    if (preview) {

        switch (data.background) {

            case "blue":
                preview.style.background =
                    "#0f3d91";
                break;

            case "purple":
                preview.style.background =
                    "#4b1d95";
                break;

            case "green":
                preview.style.background =
                    "#14532d";
                break;

            case "dark":
                preview.style.background =
                    "#111";
                break;

            default:
                preview.style.background =
                    "#1b1b1b";

        }

    }

}

// Override applyAppearance
const oldApplyAppearance = applyAppearance;

applyAppearance = function(data){

    oldApplyAppearance(data);

    applyExtraAppearance(data);

};

console.log("✅ Appearance Settings Part 3 Loaded");
// ======================================
// Viewora Appearance Settings
// Part 4 (Final)
// ======================================

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

    setTimeout(()=>{

        toast.style.opacity="0";

    },2500);

}

// =============================
// Refresh Settings
// =============================

function refreshAppearance(){

    loadAppearanceSettings();

    showToast("🔄 Appearance Refreshed");

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
// Before Exit Warning
// =============================

window.addEventListener("beforeunload",(e)=>{

    if(document.title==="● Unsaved Appearance"){

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

    refreshAppearance();

    console.log("🎨 Appearance Ready");

});

// =============================
// Final
// =============================

console.log("✅ appearance-settings.js Loaded Successfully");