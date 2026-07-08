// =======================================================
// FIREBASE.JS V5.0
// PART 1
// Firebase Initialize + Global Services
// Viewora Premium Edition
// =======================================================

// ==========================================
// Firebase Configuration
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyByS4lox5JHhG2u4qazZSvwecVjzJRP0mc",
  authDomain: "viewora-cc4ac.firebaseapp.com",
  databaseURL: "https://viewora-cc4ac-default-rtdb.firebaseio.com",
  projectId: "viewora-cc4ac",
  storageBucket: "viewora-cc4ac.appspot.com",
  messagingSenderId: "988622911735",
  appId: "1:988622911735:web:e30c97dd88d5ac87c93bf2"
};

// ==========================================
// Initialize Firebase
// ==========================================

if (!firebase.apps.length) {

    firebase.initializeApp(firebaseConfig);

    console.log("✅ Firebase Initialized");

} else {

    firebase.app();

    console.log("✅ Firebase Already Initialized");

}

// ==========================================
// Firebase Services
// ==========================================

const auth = firebase.auth();

const db = firebase.database();

const storage = firebase.storage();

// Make Global

window.auth = auth;

window.db = db;

window.storage = storage;

// ==========================================
// Global Helper Functions
// ==========================================

// Current User

window.getCurrentUser = function () {

    return auth.currentUser;

};

// Current UID

window.getCurrentUid = function () {

    return auth.currentUser
        ? auth.currentUser.uid
        : null;

};

// Database Reference

window.dbRef = function (path) {

    return db.ref(path);

};

// Storage Reference

window.storageRef = function (path) {

    return storage.ref(path);

};

// Firebase Timestamp

window.serverTime = function () {

    return firebase.database.ServerValue.TIMESTAMP;

};

// ==========================================
// App Information
// ==========================================

window.APP = {

    name: "Viewora",

    version: "5.0",

    developer: "Viewora Team"

};

// ==========================================
// Debug Mode
// ==========================================

const DEBUG = true;

function log(...args) {

    if (DEBUG) {

        console.log(...args);

    }

}

log("🚀 Viewora Firebase Ready");

// ==========================================
// End Of Part 1
// ==========================================

console.log("✅ Firebase V5 Part 1 Loaded");
// =======================================================
// FIREBASE.JS V5.0
// PART 2
// Premium Toast + Loading + Alerts
// =======================================================

// ==========================================
// Premium Toast
// ==========================================

window.showToast = function (
    message,
    type = "info"
) {

    let toast =
        document.getElementById("vieworaToast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "vieworaToast";

        toast.style.cssText = `
        position:fixed;
        left:50%;
        bottom:90px;
        transform:translateX(-50%);
        min-width:240px;
        max-width:90%;
        padding:15px 22px;
        border-radius:18px;
        color:#fff;
        font-size:15px;
        font-weight:600;
        text-align:center;
        backdrop-filter:blur(15px);
        z-index:999999;
        opacity:0;
        transition:.35s;
        box-shadow:0 10px 30px rgba(0,0,0,.35);
        `;

        document.body.appendChild(toast);

    }

    if(type==="success"){

        toast.style.background=
        "linear-gradient(135deg,#00d26a,#00a651)";

    }

    else if(type==="error"){

        toast.style.background=
        "linear-gradient(135deg,#ff4b5c,#d90429)";

    }

    else if(type==="warning"){

        toast.style.background=
        "linear-gradient(135deg,#ff9800,#ff6d00)";

    }

    else{

        toast.style.background=
        "linear-gradient(135deg,#00aaff,#0077ff)";

    }

    toast.innerHTML=message;

    toast.style.opacity="1";

    toast.style.bottom="110px";

    setTimeout(()=>{

        toast.style.opacity="0";

        toast.style.bottom="90px";

    },2500);

};

// ==========================================
// Loading Overlay
// ==========================================

window.showLoading=function(text="Loading..."){

    let loader=
    document.getElementById("loadingOverlay");

    if(loader) return;

    loader=document.createElement("div");

    loader.id="loadingOverlay";

    loader.style.cssText=`
    position:fixed;
    inset:0;
    background:rgba(10,10,10,.65);
    backdrop-filter:blur(10px);
    display:flex;
    justify-content:center;
    align-items:center;
    flex-direction:column;
    z-index:999999;
    `;

    loader.innerHTML=`

    <div style="
    width:65px;
    height:65px;
    border-radius:50%;
    border:6px solid rgba(255,255,255,.2);
    border-top:6px solid #00aaff;
    animation:vieworaSpin .8s linear infinite;
    "></div>

    <div style="
    margin-top:20px;
    font-size:16px;
    color:#fff;
    font-weight:bold;
    ">
    ${text}
    </div>

    `;

    document.body.appendChild(loader);

};

// ==========================================
// Hide Loading
// ==========================================

window.hideLoading=function(){

    const loader=
    document.getElementById("loadingOverlay");

    if(loader){

        loader.remove();

    }

};

// ==========================================
// Alert Helpers
// ==========================================

window.showSuccess=function(text){

    showToast("✅ "+text,"success");

};

window.showError=function(text){

    showToast("❌ "+text,"error");

};

window.showWarning=function(text){

    showToast("⚠️ "+text,"warning");

};

window.showInfo=function(text){

    showToast("ℹ️ "+text,"info");

};

// ==========================================
// Spinner Animation
// ==========================================

const spinner=document.createElement("style");

spinner.innerHTML=`

@keyframes vieworaSpin{

0%{

transform:rotate(0deg);

}

100%{

transform:rotate(360deg);

}

}

`;

document.head.appendChild(spinner);

// ==========================================

console.log("✅ Firebase V5 Part 2 Loaded");
// =======================================================
// FIREBASE.JS V5.0
// PART 3
// Auth + Presence + Network
// =======================================================

// ==========================================
// Auth State Listener
// ==========================================

auth.onAuthStateChanged((user) => {

    if (user) {

        log("✅ Logged In :", user.uid);

        updateUserPresence(true);

    } else {

        log("❌ User Not Logged In");

    }

});

// ==========================================
// User Presence
// ==========================================

function updateUserPresence(isOnline) {

    const user = auth.currentUser;

    if (!user) return;

    db.ref("status/" + user.uid).update({

        online: isOnline,

        lastSeen: Date.now()

    });

}

// ==========================================
// Firebase Connection Status
// ==========================================

const connectedRef =
firebase.database().ref(".info/connected");

connectedRef.on("value", (snap) => {

    const user = auth.currentUser;

    if (!user) return;

    if (snap.val() === true) {

        const statusRef =
        db.ref("status/" + user.uid);

        statusRef.onDisconnect().set({

            online: false,

            lastSeen: Date.now()

        });

        statusRef.set({

            online: true,

            lastSeen: Date.now()

        });

        log("🟢 Connected");

    } else {

        log("🔴 Disconnected");

    }

});

// ==========================================
// Browser Online
// ==========================================

window.addEventListener("online", () => {

    showSuccess("Internet Connected");

    updateUserPresence(true);

    log("🌐 Browser Online");

});

// ==========================================
// Browser Offline
// ==========================================

window.addEventListener("offline", () => {

    showWarning("No Internet Connection");

    updateUserPresence(false);

    log("📴 Browser Offline");

});

// ==========================================
// Before Close
// ==========================================

window.addEventListener("beforeunload", () => {

    updateUserPresence(false);

});

// ==========================================
// Listen Any User Status
// ==========================================

window.listenUserStatus = function(uid, callback){

    db.ref("status/" + uid)

    .on("value",(snap)=>{

        if(!snap.exists()){

            callback({

                online:false,

                lastSeen:null

            });

            return;

        }

        callback(snap.val());

    });

};

// ==========================================
// Get Current Status
// ==========================================

window.getMyStatus = async function(){

    const uid=getCurrentUid();

    if(!uid) return null;

    const snap=

    await db.ref("status/"+uid)

    .once("value");

    return snap.val();

};

// ==========================================
// Refresh Presence Every Minute
// ==========================================

setInterval(()=>{

    if(auth.currentUser){

        updateUserPresence(true);

    }

},60000);

// ==========================================

console.log("✅ Firebase V5 Part 3 Loaded");
// =======================================================
// FIREBASE.JS V5.0
// PART 4
// Premium Helpers + Security
// =======================================================

// ==========================================
// Logout
// ==========================================

window.logoutUser = function () {

    showLoading("Logging out...");

    auth.signOut()

    .then(() => {

        hideLoading();

        location.href = "login.html";

    })

    .catch((error) => {

        hideLoading();

        showError(error.message);

    });

};

// ==========================================
// Send Email Verification
// ==========================================

window.sendVerificationEmail = function () {

    const user = auth.currentUser;

    if (!user) return;

    user.sendEmailVerification()

    .then(() => {

        showSuccess(
            "Verification email sent."
        );

    })

    .catch((error) => {

        showError(error.message);

    });

};

// ==========================================
// Forgot Password
// ==========================================

window.forgotPassword = function () {

    const email = prompt(
        "Enter your registered email"
    );

    if (!email) return;

    auth.sendPasswordResetEmail(email)

    .then(() => {

        showSuccess(
            "Password reset email sent."
        );

    })

    .catch((error) => {

        showError(error.message);

    });

};

// ==========================================
// Update User Profile
// ==========================================

window.updateProfileData = async function (data) {

    const uid = getCurrentUid();

    if (!uid) return;

    try {

        await db.ref("users/" + uid)
        .update(data);

        showSuccess("Profile Updated");

    }

    catch (error) {

        showError(error.message);

    }

};

// ==========================================
// Delete Account
// ==========================================

window.deleteMyAccount = async function () {

    const user = auth.currentUser;

    if (!user) return;

    if (!confirm(
        "Delete your account permanently?"
    )) return;

    try {

        await db.ref("users/" + user.uid)
        .remove();

        await user.delete();

        showSuccess("Account Deleted");

        location.href = "signup.html";

    }

    catch (error) {

        showError(error.message);

    }

};

// ==========================================
// Firebase Error Handler
// ==========================================

window.firebaseError = function (error) {

    console.error(error);

    showError(

        error.message ||

        "Something went wrong."

    );

};

// ==========================================
// Safe Database Read
// ==========================================

window.readData = async function (path) {

    try {

        const snap = await db.ref(path).once("value");

        return snap.val();

    }

    catch (error) {

        firebaseError(error);

        return null;

    }

};

// ==========================================
// Safe Database Write
// ==========================================

window.writeData = async function (path, data) {

    try {

        await db.ref(path).set(data);

        return true;

    }

    catch (error) {

        firebaseError(error);

        return false;

    }

};

// ==========================================
// Safe Database Update
// ==========================================

window.updateData = async function (path, data) {

    try {

        await db.ref(path).update(data);

        return true;

    }

    catch (error) {

        firebaseError(error);

        return false;

    }

};

// ==========================================
// Safe Database Delete
// ==========================================

window.deleteData = async function (path) {

    try {

        await db.ref(path).remove();

        return true;

    }

    catch (error) {

        firebaseError(error);

        return false;

    }

};

// ==========================================
// Final
// ==========================================

log("🔥 Viewora Firebase V5 Premium Loaded");

console.log("✅ Firebase.js Ready");