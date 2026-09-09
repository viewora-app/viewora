// ======================================
// VIEWORA APPEARANCE SETTINGS - FINAL CLEAN VERSION
// ======================================

let currentUser = null;

// Default Settings
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
// Auth Check
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
// Load Settings from Firebase
// ======================================
function loadAppearanceSettings() {
    if (!currentUser) return;

    db.ref("appearanceSettings/" + currentUser.uid)
        .once("value")
        .then((snapshot) => {
            const data = snapshot.val() || defaultAppearance;
            applySettingsToUI(data);
            applyFullTheme(data);
            showToast("🎨 Appearance Loaded");
        });
}

// ======================================
// Apply Settings to UI Inputs
// ======================================
function applySettingsToUI(data) {
    setToggle("darkMode", data.theme === "dark");
    setToggle("lightMode", data.theme === "light");
    document.getElementById("accentColor").value = data.accentColor;
    document.getElementById("themeColor").value = data.themeColor;
    document.getElementById("fontSize").value = data.fontSize;
    setToggle("uiAnimations", data.animations);
    setToggle("blurEffects", data.blur);
    setToggle("compactMode", data.compact);
    document.getElementById("chatBackground").value = data.background;
    setToggle("roundedCorners", data.rounded);
}

// ======================================
// Save Settings to Firebase
// ======================================
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
        await db.ref("appearanceSettings/" + currentUser.uid).set(settings);
        applyFullTheme(settings);
        showToast("✅ Theme Saved Successfully");
    } catch (error) {
        console.error(error);
        showToast("❌ Failed to save");
    }
}

// ======================================
// Apply Full Theme (Global + Local)
// ======================================
function applyFullTheme(data) {
    const root = document.documentElement;
    const body = document.body;

    // Theme Mode
    if (data.theme === "light") {
        body.style.background = "#f5f5f5";
        body.style.color = "#111111";
        root.style.setProperty("--bg-color", "#f5f5f5");
        root.style.setProperty("--text-color", "#111111");
        root.style.setProperty("--card-bg", "#ffffff");
    } else {
        body.style.background = "#0d1117";
        body.style.color = "#ffffff";
        root.style.setProperty("--bg-color", "#0d1117");
        root.style.setProperty("--text-color", "#ffffff");
        root.style.setProperty("--card-bg", "#1d1f27");
    }

    // Colors
    root.style.setProperty("--accent-color", data.accentColor);
    root.style.setProperty("--theme-color", data.themeColor);

    // Font Size
    let size = "16px";
    if (data.fontSize === "small") size = "14px";
    if (data.fontSize === "large") size = "18px";
    if (data.fontSize === "xlarge") size = "20px";
    body.style.fontSize = size;

    // Blur Effects
    document.querySelectorAll(".setting-card, .preview-card")
        .forEach(card => {
            card.style.backdropFilter = data.blur ? "blur(16px)" : "none";
        });

    // Compact Mode
    body.classList.toggle("compact-mode", data.compact);

    // Rounded Corners
    const roundedEls = document.querySelectorAll(".setting-card, button, input, textarea");
    roundedEls.forEach(el => {
        el.style.borderRadius = data.rounded ? "18px" : "8px";
    });

    // Chat Background Preview
    const preview = document.querySelector(".phone-preview");
    if (preview) {
        switch (data.background) {
            case "blue": preview.style.background = "#0f3d91"; break;
            case "purple": preview.style.background = "#4b1d95"; break;
            case "green": preview.style.background = "#14532d"; break;
            case "dark": preview.style.background = "#111"; break;
            default: preview.style.background = "#1b1b1b";
        }
    }
}

// ======================================
// Live Preview
// ======================================
function previewAppearance() {
    const settings = {
        theme: getToggle("darkMode") ? "dark" : "light",
        accentColor: document.getElementById("accentColor").value,
        themeColor: document.getElementById("themeColor").value,
        fontSize: document.getElementById("fontSize").value,
        animations: getToggle("uiAnimations"),
        blur: getToggle("blurEffects"),
        compact: getToggle("compactMode"),
        background: document.getElementById("chatBackground").value,
        rounded: getToggle("roundedCorners")
    };

    applyFullTheme(settings);
    document.title = "● Unsaved Changes";
}

// ======================================
// Reset to Default
// ======================================
function resetAppearance() {
    if (!confirm("Reset all appearance settings to default?")) return;

    setToggle("darkMode", true);
    setToggle("lightMode", false);
    document.getElementById("accentColor").value = defaultAppearance.accentColor;
    document.getElementById("themeColor").value = defaultAppearance.themeColor;
    document.getElementById("fontSize").value = defaultAppearance.fontSize;
    setToggle("uiAnimations", defaultAppearance.animations);
    setToggle("blurEffects", defaultAppearance.blur);
    setToggle("compactMode", defaultAppearance.compact);
    document.getElementById("chatBackground").value = defaultAppearance.background;
    setToggle("roundedCorners", defaultAppearance.rounded);

    applyFullTheme(defaultAppearance);
    showToast("🔄 Appearance Reset");
}

// ======================================
// Helper Functions
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
// Toast Notification
// ======================================
function showToast(message) {
    let toast = document.getElementById("vieworaToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "vieworaToast";
        toast.style.cssText = `
            position:fixed; left:50%; bottom:30px; transform:translateX(-50%);
            background:linear-gradient(135deg,#00aaff,#7c3aed); color:white;
            padding:14px 24px; border-radius:30px; font-weight:bold;
            box-shadow:0 10px 30px rgba(0,170,255,.35); z-index:99999;
            transition:0.35s; opacity:0;
        `;
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = "1";
    setTimeout(() => toast.style.opacity = "0", 2500);
}

// ======================================
// Auto Save + Live Preview on Change
// ======================================
const controls = [
    "darkMode", "lightMode", "accentColor", "themeColor",
    "fontSize", "uiAnimations", "blurEffects", "compactMode",
    "chatBackground", "roundedCorners"
];

controls.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("change", () => {
        previewAppearance();
        document.title = "● Unsaved Appearance";

        // Auto Save after 1.5 seconds
        clearTimeout(window.autoSaveTimer);
        window.autoSaveTimer = setTimeout(() => {
            saveAppearanceSettings();
        }, 1500);
    });
});

// Dark/Light Mode Mutual Exclusive
document.getElementById("darkMode")?.addEventListener("change", function () {
    if (this.checked) document.getElementById("lightMode").checked = false;
});

document.getElementById("lightMode")?.addEventListener("change", function () {
    if (this.checked) document.getElementById("darkMode").checked = false;
});

// ======================================
// Keyboard Shortcut (Ctrl + S)
// ======================================
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveAppearanceSettings();
    }
});

// ======================================
// Final Init
// ======================================
console.log("✅ Appearance Settings JS Fully Loaded");