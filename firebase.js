// =====================================
// VIEWORA V1.0 PREMIUM
// firebase.js
// =====================================

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyByS4lox5JHhG2u4qazZSvwecVjzJRP0mc",
    authDomain: "viewora-cc4ac.firebaseapp.com",
    databaseURL: "https://viewora-cc4ac-default-rtdb.firebaseio.com",
    projectId: "viewora-cc4ac",
    storageBucket: "viewora-cc4ac.firebasestorage.app",
    messagingSenderId: "988622911735",
    appId: "1:988622911735:web:e30c97dd88d5ac87c93bf2"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("🔥 Firebase Initialized");
} else {
    firebase.app();
    console.log("🔥 Firebase Already Initialized");
}

// Firebase Services
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

// Google Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: "select_account"
});

// Keep User Logged In
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
.catch(err => {
    console.error("Persistence Error:", err);
});

// Server Timestamp
const SERVER_TIME = firebase.database.ServerValue.TIMESTAMP;

// Current UID
function uid() {
    return auth.currentUser ? auth.currentUser.uid : null;
}

// Current Time
function now() {
    return Date.now();
}

// Online / Offline Status
auth.onAuthStateChanged(user => {

    if (!user) return;

    const userRef = db.ref("users/" + user.uid);

    userRef.update({
        online: true,
        lastLogin: SERVER_TIME
    });

    userRef.onDisconnect().update({
        online: false
    });

});

// Connection Check
db.ref(".info/connected").on("value", snap => {

    if (snap.val()) {
        console.log("🟢 Firebase Connected");
    } else {
        console.log("🔴 Firebase Disconnected");
    }

});

// Error Logging
window.addEventListener("error", e => {
    console.error("JS Error:", e.message);
});

// Finished
console.log("=================================");
console.log("🚀 VIEWORA V1.0 PREMIUM");
console.log("✅ Firebase Ready");
console.log("✅ Auth Ready");
console.log("✅ Database Ready");
console.log("✅ Storage Ready");
console.log("=================================");