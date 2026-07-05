// ==================== FIREBASE CONFIG + UTILITIES ====================

const firebaseConfig = {
  apiKey: "AIzaSyByS4lox5JHhG2u4qazZSvwecVjzJRP0mc",
  authDomain: "viewora-cc4ac.firebaseapp.com",
  databaseURL: "https://viewora-cc4ac-default-rtdb.firebaseio.com",
  projectId: "viewora-cc4ac",
  storageBucket: "viewora-cc4ac.appspot.com",
  messagingSenderId: "988622911735",
  appId: "1:988622911735:web:e30c97dd88d5ac87c93bf2"
};

// Initialize Firebase only once
if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase Initialized");
} else if (firebase.apps.length) {
    console.log("✅ Firebase Already Initialized");
} else {
    console.error("❌ Firebase SDK not loaded");
}

// Export auth and db for global use
const auth = firebase.auth();
const db = firebase.database();

// ==================== COMMON UTILITIES ====================

// Show loading spinner in a container
window.showLoading = function(containerId) {
    const el = document.getElementById(containerId);
    if (el) {
        el.innerHTML = `
            <div style="text-align:center; padding:60px 20px;">
                <div style="display:inline-block; width:32px; height:32px; border:4px solid #00aaff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                <p style="margin-top:15px; color:#888; font-size:15px;">Loading...</p>
            </div>
        `;
    }
};

// Simple Toast Notification (Better than alert)
window.showToast = function(message, duration = 2800) {
    const toast = document.createElement("div");
    toast.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: #1b1b1b;
        color: white;
        padding: 14px 24px;
        border-radius: 30px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.5);
        z-index: 9999;
        font-size: 15px;
        max-width: 80%;
        text-align: center;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = "all 0.3s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

// Animation for spinner
const style = document.createElement('style');
style.innerHTML = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

console.log("✅ Utilities Loaded");