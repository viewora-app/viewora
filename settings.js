// ======================================
// Viewora Settings V2.0
// Part 1
// ======================================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    loadUser(user.uid);

});

function loadUser(uid) {

    db.ref("users/" + uid).once("value")

    .then((snapshot) => {

        if (!snapshot.exists()) return;

        const user = snapshot.val();

        document.getElementById("profilePhoto").src =
            user.profilePhoto || "non.jpg";

        document.getElementById("profileName").innerText =
            user.name || "User";

        document.getElementById("profileUsername").innerText =
            user.username || "@user";

        document.getElementById("settingName").innerText =
            user.name || "";

        document.getElementById("settingUsername").innerText =
            user.username || "";

        document.getElementById("settingEmail").innerText =
            user.email || "";

        document.getElementById("settingPhone").innerText =
            user.phone || "Not Added";

        document.getElementById("settingBirthday").innerText =
            user.birthday || "Not Set";

        document.getElementById("settingGender").innerText =
            user.gender || "Not Specified";

        const verify = document.getElementById("verifyStatus");

        if (auth.currentUser.emailVerified) {

            verify.innerHTML = "✅ Verified";

        } else {

            verify.innerHTML = "❌ Not Verified";

        }

    });

}

// =============================
// Edit Profile
// =============================

function editProfile(){

    window.location.href="edit-profile.html";

}

// =============================
// Edit Name
// =============================

function editName(){

    const name=prompt("Enter new name");

    if(!name) return;

    const uid=auth.currentUser.uid;

    db.ref("users/"+uid+"/name").set(name)

    .then(()=>{

        alert("Name Updated");

        loadUser(uid);

    });

}

// =============================
// Edit Username
// =============================

function editUsername(){

    const username=prompt("Enter username");

    if(!username) return;

    const uid=auth.currentUser.uid;

    db.ref("users/"+uid+"/username").set(username)

    .then(()=>{

        alert("Username Updated");

        loadUser(uid);

    });

}
// ======================================
// Viewora Settings V2.0
// Part 2
// Personal Information + Security
// ======================================

// =============================
// Change Email
// =============================

async function changeEmail() {

    const newEmail = prompt("Enter your new email");

    if (!newEmail) return;

    try {

        await auth.currentUser.updateEmail(newEmail);

        await db.ref("users/" + auth.currentUser.uid + "/email")
            .set(newEmail);

        alert("✅ Email updated successfully.");

        loadUser(auth.currentUser.uid);

    } catch (error) {

        alert(error.message);

    }

}

// =============================
// Change Phone Number
// =============================

function changePhone() {

    const phone = prompt("Enter phone number");

    if (!phone) return;

    db.ref("users/" + auth.currentUser.uid + "/phone")
        .set(phone)
        .then(() => {

            alert("✅ Phone number updated.");

            loadUser(auth.currentUser.uid);

        });

}

// =============================
// Birthday
// =============================

function changeBirthday() {

    const birthday = prompt("Enter Birthday (DD/MM/YYYY)");

    if (!birthday) return;

    db.ref("users/" + auth.currentUser.uid + "/birthday")
        .set(birthday)
        .then(() => {

            alert("✅ Birthday updated.");

            loadUser(auth.currentUser.uid);

        });

}

// =============================
// Gender
// =============================

function changeGender() {

    const gender = prompt("Male / Female / Other");

    if (!gender) return;

    db.ref("users/" + auth.currentUser.uid + "/gender")
        .set(gender)
        .then(() => {

            alert("✅ Gender updated.");

            loadUser(auth.currentUser.uid);

        });

}

// =============================
// Change Password
// =============================

function changePassword() {

    auth.sendPasswordResetEmail(auth.currentUser.email)

        .then(() => {

            alert("✅ Password reset email sent.");

        })

        .catch((error) => {

            alert(error.message);

        });

}

// =============================
// Forgot Password
// =============================

function forgotPassword() {

    const email = prompt("Enter your registered email");

    if (!email) return;

    auth.sendPasswordResetEmail(email)

        .then(() => {

            alert("✅ Password reset email sent.");

        })

        .catch((error) => {

            alert(error.message);

        });

}

// =============================
// Verify Email
// =============================

function verifyEmail() {

    const user = auth.currentUser;

    if (user.emailVerified) {

        alert("✅ Your email is already verified.");

        return;

    }

    user.sendEmailVerification()

        .then(() => {

            alert("📧 Verification email has been sent.");

        })

        .catch((error) => {

            alert(error.message);

        });

}

// =============================
// Login Activity
// =============================

function manageDevices() {

    alert(
`Login Activity

Current Device:
✔ This Device

More device management will be available in a future update.`
    );

}
// ======================================
// Viewora Settings V2.0
// Part 3
// Notifications • Appearance • Privacy
// ======================================

// =============================
// Push Notifications
// =============================

function notificationSettings(){

    alert(
`🔔 Notifications

• Likes
• Comments
• Followers
• Messages

Notification settings will be added in the next update.`
    );

}

// =============================
// Story Notifications
// =============================

function storyNotifications(){

    alert("📸 Story notifications are enabled.");

}

// =============================
// Message Notifications
// =============================

function messageNotifications(){

    alert("💬 Message notifications are enabled.");

}

// =============================
// Dark / Light Mode
// =============================

function toggleDarkMode(){

    const body=document.body;

    body.classList.toggle("light-mode");

    if(body.classList.contains("light-mode")){

        localStorage.setItem("theme","light");

        showToast("☀️ Light Mode Enabled");

    }else{

        localStorage.setItem("theme","dark");

        showToast("🌙 Dark Mode Enabled");

    }

}

// Restore Theme

window.addEventListener("load",()=>{

    const theme=localStorage.getItem("theme");

    if(theme==="light"){

        document.body.classList.add("light-mode");

    }

});

// =============================
// Language
// =============================

function changeLanguage(){

    alert(
`🌍 Languages

English ✅

Hindi (Coming Soon)

More languages will be available soon.`
    );

}

// =============================
// Privacy Settings
// =============================

function privacySettings(){

    window.location.href="privacy.html";

}

// =============================
// Blocked Users
// =============================

function blockedUsers(){

    alert(
`🚫 Blocked Users

No blocked users found.`
    );

}

// =============================
// App Permissions
// =============================

function managePermissions(){

    alert(
`📷 Camera
🎤 Microphone
💾 Storage

Manage permissions from your device settings.`
    );

}

// =============================
// Share App
// =============================

function shareApp(){

    if(navigator.share){

        navigator.share({

            title:"Viewora",

            text:"Join me on Viewora 🚀",

            url:location.origin

        });

    }else{

        prompt(
            "Copy this link:",
            location.origin
        );

    }

}

// =============================
// About Viewora
// =============================

function showAbout(){

    alert(
`Viewora

Version : 1.0.0

Made with ❤️

© Viewora

All Rights Reserved.`
    );

}

// =============================
// Help Center
// =============================

function showHelp(){

    alert(
`Need Help?

Email:
vieworasupport@gmail.com

Response Time:
24-48 Hours`
    );

}
// ======================================
// Viewora Settings V2.0
// Part 4 (Final)
// Storage • Logout • Delete • Utilities
// ======================================

// =============================
// Clear Cache
// =============================

function clearCache(){

    if(confirm("Clear app cache?")){

        localStorage.clear();

        showToast("🧹 Cache Cleared");

    }

}

// =============================
// Downloads
// =============================

function manageDownloads(){

    alert(
`📥 Downloads

Downloaded media management

Coming Soon 🚀`
    );

}

// =============================
// Logout
// =============================

async function logout(){

    const ok=confirm("Do you want to logout?");

    if(!ok) return;

    try{

        await auth.signOut();

        showToast("👋 Logged Out");

        setTimeout(()=>{

            window.location.href="login.html";

        },800);

    }

    catch(error){

        alert(error.message);

    }

}

// =============================
// Delete Account
// =============================

function deleteAccount(){

    window.location.href="delete-account.html";

}

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

        background:#00aaff;

        color:#fff;

        padding:14px 22px;

        border-radius:30px;

        font-size:14px;

        font-weight:bold;

        z-index:99999;

        opacity:0;

        transition:.35s;

        box-shadow:0 8px 25px rgba(0,170,255,.35);

        `;

        document.body.appendChild(toast);

    }

    toast.innerHTML=message;

    toast.style.opacity="1";

    setTimeout(()=>{

        toast.style.opacity="0";

    },2500);

}

// =============================
// Internet Status
// =============================

window.addEventListener("online",()=>{

    showToast("🌐 Internet Connected");

});

window.addEventListener("offline",()=>{

    showToast("❌ No Internet");

});

// =============================
// Page Loaded
// =============================

window.addEventListener("load",()=>{

    console.log("✅ Viewora Settings Loaded");

});

// ======================================
// End
// ======================================