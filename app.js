// ==========================================
// VIEWORA APP.JS V5.0
// PART 1
// Authentication + Premium Signup
// ==========================================

// ==========================================
// Current User
// ==========================================

let currentUser = null;

// ==========================================
// Auth State Listener
// ==========================================

auth.onAuthStateChanged((user)=>{

    if(user){

        currentUser = user;

        console.log("✅ Logged In :",user.uid);

    }else{

        currentUser = null;

        console.log("❌ No User Logged In");

    }

});

// ==========================================
// Premium Signup
// ==========================================

window.signup = async function(){

    const name =
    document.getElementById("name")?.value.trim();

    const email =
    document.getElementById("email")?.value
    .trim()
    .toLowerCase();

    const password =
    document.getElementById("password")?.value;

    if(!name || !email || !password){

        alert("Please fill all fields.");
        return;

    }

    if(password.length < 6){

        alert("Password must be at least 6 characters.");
        return;

    }

    try{

        // Loading

        if(window.showLoading)
            showLoading("Creating account...");

        // Create Account

        const result =

        await auth.createUserWithEmailAndPassword(

            email,
            password

        );

        const user = result.user;

        // Username Generate

        const username =
        "@" +
        name
        .toLowerCase()
        .replace(/\s+/g,"");

        // Save User

        await db.ref("users/"+user.uid).set({

            uid:user.uid,

            name:name,

            username:username,

            email:email,

            bio:"Welcome to Viewora 🚀",

            profilePhoto:"users.jpg",

            coverPhoto:"banner.jpg",

            verified:false,

            premium:false,

            followers:0,

            following:0,

            posts:0,

            createdAt:Date.now(),

            lastLogin:Date.now()

        });

        // Send Email Verification

        await user.sendEmailVerification();

        if(window.hideLoading)
            hideLoading();

        alert(

`🎉 Account Created Successfully!

Verification email sent to:

${email}

Please verify your email before login.`

        );

        await auth.signOut();

        location.href="login.html";

    }

    catch(error){

        if(window.hideLoading)
            hideLoading();

        console.error(error);

        switch(error.code){

            case "auth/email-already-in-use":

                alert("Email already registered.");

                break;

            case "auth/invalid-email":

                alert("Invalid email.");

                break;

            case "auth/weak-password":

                alert("Weak password.");

                break;

            default:

                alert(error.message);

        }

    }

};

console.log("✅ APP Part 1 Loaded");
// ==========================================
// VIEWORA APP.JS V5.0
// PART 2
// Login + Forgot Password + Logout
// ==========================================

// ==========================================
// LOGIN
// ==========================================

window.login = async function () {

    const email = document
        .getElementById("email")
        ?.value.trim()
        .toLowerCase();

    const password = document
        .getElementById("password")
        ?.value;

    if (!email || !password) {

        showError("Enter email and password.");
        return;

    }

    try {

        showLoading("Logging in...");

        const result =
            await auth.signInWithEmailAndPassword(
                email,
                password
            );

        const user = result.user;

        // Reload latest auth data
        await user.reload();

        // Email verification check
        if (!user.emailVerified) {

            hideLoading();

            await auth.signOut();

            showWarning(
                "Please verify your email before login."
            );

            return;

        }

        // Update user info
        await db.ref("users/" + user.uid).update({

            verified: true,

            lastLogin: Date.now()

        });

        hideLoading();

        showSuccess("Welcome to Viewora!");

        setTimeout(() => {

            location.href = "index.html";

        }, 700);

    }

    catch (error) {

        hideLoading();

        switch (error.code) {

            case "auth/user-not-found":

                showError("Account not found.");
                break;

            case "auth/wrong-password":

                showError("Incorrect password.");
                break;

            case "auth/invalid-email":

                showError("Invalid email.");
                break;

            case "auth/too-many-requests":

                showError(
                    "Too many attempts. Try again later."
                );
                break;

            default:

                showError(error.message);

        }

    }

};

// ==========================================
// FORGOT PASSWORD
// ==========================================

window.forgotPassword = async function () {

    const email = prompt(
        "Enter your registered email"
    );

    if (!email) return;

    try {

        await auth.sendPasswordResetEmail(
            email.trim().toLowerCase()
        );

        showSuccess(
            "Password reset email sent."
        );

    }

    catch (error) {

        showError(error.message);

    }

};

// ==========================================
// RESEND EMAIL VERIFICATION
// ==========================================

window.resendVerification = async function () {

    if (!auth.currentUser) {

        showError("Please login first.");
        return;

    }

    try {

        await auth.currentUser.sendEmailVerification();

        showSuccess(
            "Verification email sent."
        );

    }

    catch (error) {

        showError(error.message);

    }

};

// ==========================================
// LOGOUT
// ==========================================

window.logout = async function () {

    if (!confirm("Logout from Viewora?"))
        return;

    try {

        showLoading("Logging out...");

        if (auth.currentUser) {

            await db.ref(
                "status/" + auth.currentUser.uid
            ).update({

                online: false,

                lastSeen: Date.now()

            });

        }

        await auth.signOut();

        hideLoading();

        location.href = "login.html";

    }

    catch (error) {

        hideLoading();

        showError(error.message);

    }

};

console.log("✅ APP Part 2 Loaded");
// ==========================================
// VIEWORA APP.JS V5
// PART 3
// User Session + Common Helpers
// ==========================================

let currentUserData = null;

// ==========================================
// Auth Listener
// ==========================================

auth.onAuthStateChanged(async (user) => {

    if (!user) {

        currentUser = null;
        currentUserData = null;
        return;

    }

    currentUser = user;

    try {

        const snap = await db
            .ref("users/" + user.uid)
            .once("value");

        currentUserData = snap.val() || {};

        window.currentUser = currentUser;
        window.currentUserData = currentUserData;

        console.log("✅ User Loaded");

    } catch (e) {

        console.error(e);

    }

});

// ==========================================
// Get Current User Data
// ==========================================

window.getCurrentUserData = async function () {

    if (!auth.currentUser) return null;

    const snap = await db
        .ref("users/" + auth.currentUser.uid)
        .once("value");

    return snap.val();

};

// ==========================================
// Update Profile
// ==========================================

window.updateProfile = async function (data) {

    if (!auth.currentUser) return;

    try {

        await db
            .ref("users/" + auth.currentUser.uid)
            .update(data);

        alert("Profile Updated");

    }

    catch (err) {

        alert(err.message);

    }

};

// ==========================================
// Online Status
// ==========================================

window.setOnlineStatus = function (status) {

    if (!auth.currentUser) return;

    db.ref("status/" + auth.currentUser.uid)
    .set({

        online: status,

        lastSeen: Date.now()

    });

};

// ==========================================
// Auto Presence
// ==========================================

window.addEventListener("load", () => {

    if (!auth.currentUser) return;

    const ref =
    firebase.database().ref(".info/connected");

    ref.on("value", (snap) => {

        if (!snap.val()) return;

        const statusRef =
        db.ref("status/" + auth.currentUser.uid);

        statusRef.onDisconnect().set({

            online: false,

            lastSeen: Date.now()

        });

        statusRef.set({

            online: true,

            lastSeen: Date.now()

        });

    });

});

// ==========================================
// Before Close
// ==========================================

window.addEventListener("beforeunload", () => {

    if (!auth.currentUser) return;

    db.ref("status/" + auth.currentUser.uid)
    .update({

        online: false,

        lastSeen: Date.now()

    });

});

// ==========================================
// Helper Functions
// ==========================================

window.goProfile = function () {

    location.href = "profile.html";

};

window.goHome = function () {

    location.href = "index.html";

};

window.goUsers = function () {

    location.href = "users.html";

};

window.goShorts = function () {

    location.href = "shorts.html";

};

window.goSettings = function () {

    location.href = "settings.html";

};

// ==========================================

console.log("✅ APP Part 3 Loaded");
// ==========================================
// VIEWORA APP.JS V5
// PART 4
// Global Helpers + Auto Init
// ==========================================

// ==========================================
// Open Page
// ==========================================

window.openPage = function(page){

    location.href = page;

};

// ==========================================
// Open Profile By UID
// ==========================================

window.openProfile = function(uid){

    location.href =
    "profile.html?uid="+uid;

};

// ==========================================
// Copy Text
// ==========================================

window.copyText = async function(text){

    try{

        await navigator.clipboard.writeText(text);

        if(window.showSuccess){

            showSuccess("Copied");

        }

    }

    catch{

        alert("Copied");

    }

};

// ==========================================
// Share
// ==========================================

window.shareContent = async function(title,url){

    if(navigator.share){

        try{

            await navigator.share({

                title:title,

                url:url

            });

        }catch(e){}

    }else{

        copyText(url);

    }

};

// ==========================================
// Format Time
// ==========================================

window.formatTime=function(time){

    const diff=

    Math.floor(

    (Date.now()-time)/1000

    );

    if(diff<60)

        return diff+"s";

    if(diff<3600)

        return Math.floor(diff/60)+"m";

    if(diff<86400)

        return Math.floor(diff/3600)+"h";

    if(diff<604800)

        return Math.floor(diff/86400)+"d";

    return new Date(time)

    .toLocaleDateString();

};

// ==========================================
// Format Number
// ==========================================

window.formatNumber=function(num){

    num=Number(num)||0;

    if(num>=1000000)

        return (num/1000000)

        .toFixed(1)+"M";

    if(num>=1000)

        return (num/1000)

        .toFixed(1)+"K";

    return num;

};

// ==========================================
// Auto Active Navigation
// ==========================================

window.addEventListener("load",()=>{

const page=

location.pathname

.split("/")

.pop();

document

.querySelectorAll(".bottomNav a")

.forEach(link=>{

const href=

link.getAttribute("href");

if(href===page){

link.classList.add("active");

}

});

});

// ==========================================
// Double Tap Prevention
// ==========================================

let lastTap=0;

document.addEventListener("touchend",()=>{

const now=Date.now();

if(now-lastTap<250){

event.preventDefault();

}

lastTap=now;

},{passive:false});

// ==========================================
// Internet Status
// ==========================================

window.addEventListener(

"online",

()=>{

if(window.showSuccess)

showSuccess("Internet Connected");

}

);

window.addEventListener(

"offline",

()=>{

if(window.showWarning)

showWarning("No Internet");

}

);

// ==========================================
// App Version
// ==========================================

window.APP_VERSION="5.0";

// ==========================================

console.log("=================================");
console.log("🚀 Viewora APP Loaded");
console.log("🔐 Authentication Ready");
console.log("👤 Session Ready");
console.log("🛠 Helpers Ready");
console.log("📱 Navigation Ready");
console.log("=================================");