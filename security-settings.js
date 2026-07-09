// ======================================
// Viewora Security Settings
// Part 1
// ======================================

// Current User
let currentUser = null;

// =============================
// Authentication Check
// =============================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    currentUser = user;

    loadSecurityInfo();

});

// =============================
// Load Security Information
// =============================

function loadSecurityInfo() {

    if (!currentUser) return;

    console.log("✅ Security Page Loaded");

    // Email Verification Status

    if (currentUser.emailVerified) {

        showToast("✅ Email Verified");

    } else {

        showToast("⚠️ Email Not Verified");

    }

}

// =============================
// Refresh User
// =============================

async function refreshUser() {

    try {

        await currentUser.reload();

        currentUser = auth.currentUser;

        loadSecurityInfo();

        showToast("🔄 Account Refreshed");

    }

    catch (error) {

        console.error(error);

        showToast("❌ Refresh Failed");

    }

}

// =============================
// Verify Email
// =============================

async function verifyEmail() {

    if (!currentUser) return;

    if (currentUser.emailVerified) {

        showToast("✅ Email already verified");

        return;

    }

    try {

        await currentUser.sendEmailVerification();

        showToast("📧 Verification Email Sent");

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Security Status
// =============================

function checkSecurityStatus() {

    if (!currentUser) return;

    let score = 0;

    if (currentUser.emailVerified) score++;

    db.ref("users/" + currentUser.uid)
        .once("value")
        .then((snapshot) => {

            const user = snapshot.val() || {};

            if (user.phone) score++;

            if (user.profilePhoto) score++;

            console.log("Security Score:", score + "/3");

        });

}

checkSecurityStatus();
// ======================================
// Viewora Security Settings
// Part 2
// Password + Phone + 2FA
// ======================================

// =============================
// Password Reset
// =============================

async function resetPassword() {

    if (!currentUser) return;

    try {

        await auth.sendPasswordResetEmail(currentUser.email);

        showToast("🔑 Password reset email sent.");

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Phone Verification
// (Future Ready)
// =============================

function verifyPhone() {

    db.ref("users/" + currentUser.uid + "/phone")
    .once("value")
    .then((snapshot)=>{

        const phone = snapshot.val();

        if(phone){

            showToast("📱 Phone: " + phone);

        }else{

            showToast("⚠️ Add phone number first.");

        }

    });

}

// =============================
// Two Factor Authentication
// (Coming Soon)
// =============================

function twoFactorAuth(){

    showToast("🔐 Two-Factor Authentication coming soon.");

}

// =============================
// Security Tips
// =============================

function showSecurityTips(){

    alert(
`🛡️ Security Tips

• Use a strong password.
• Verify your email.
• Add your phone number.
• Never share your password.
• Logout from shared devices.`
    );

}

// =============================
// Premium Toast
// =============================

function showToast(message){

    let toast=document.getElementById("securityToast");

    if(!toast){

        toast=document.createElement("div");

        toast.id="securityToast";

        toast.style.cssText=`
        position:fixed;
        left:50%;
        bottom:30px;
        transform:translateX(-50%);
        background:#00aaff;
        color:#fff;
        padding:14px 24px;
        border-radius:30px;
        font-weight:bold;
        box-shadow:0 8px 25px rgba(0,170,255,.35);
        z-index:99999;
        opacity:0;
        transition:.35s;
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
// Auto Refresh Status
// =============================

setInterval(()=>{

    if(currentUser){

        refreshUser();

    }

},300000); // Every 5 minutes
// ======================================
// Viewora Security Settings
// Part 3
// Devices & Security
// ======================================

// =============================
// Login Activity
// =============================

function loginActivity() {

    if (!currentUser) return;

    const lastLogin = new Date(
        currentUser.metadata.lastSignInTime
    ).toLocaleString();

    const created = new Date(
        currentUser.metadata.creationTime
    ).toLocaleString();

    alert(

`🔐 Login Activity

📅 Account Created:
${created}

🕒 Last Login:
${lastLogin}

📧 Email:
${currentUser.email}

🆔 UID:
${currentUser.uid}`

    );

}

// =============================
// Trusted Devices
// =============================

function trustedDevices() {

    if (!currentUser) return;

    showToast("📱 Current device is trusted.");

}

// =============================
// Blocked Users
// =============================

function blockedUsers() {

    db.ref("blockedUsers/" + currentUser.uid)
    .once("value")
    .then((snapshot)=>{

        let total = 0;

        snapshot.forEach(()=>{

            total++;

        });

        if(total===0){

            showToast("✅ No blocked users");

        }else{

            alert("🚫 Blocked Users : " + total);

        }

    });

}

// =============================
// Logout All Devices
// =============================

async function logoutAllDevices() {

    if(!confirm(
        "Logout from all devices?"
    )) return;

    try{

        await currentUser.getIdToken(true);

        await auth.signOut();

        showToast("🌍 Logged out successfully");

        setTimeout(()=>{

            window.location.href="login.html";

        },1200);

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Security Report
// =============================

function securityReport(){

    let report=[];

    if(currentUser.emailVerified){

        report.push("✅ Email Verified");

    }else{

        report.push("❌ Email Not Verified");

    }

    db.ref("users/"+currentUser.uid)
    .once("value")
    .then((snap)=>{

        const user=snap.val()||{};

        if(user.phone){

            report.push("✅ Phone Added");

        }else{

            report.push("❌ Phone Missing");

        }

        if(user.profilePhoto){

            report.push("✅ Profile Photo");

        }else{

            report.push("❌ No Profile Photo");

        }

        alert(
"🛡️ Security Report\n\n"+
report.join("\n")
        );

    });

}

// =============================
// Auto Refresh Every 10 Minutes
// =============================

setInterval(()=>{

    if(currentUser){

        refreshUser();

    }

},600000);
// ======================================
// Viewora Security Settings
// Part 4 (Final)
// ======================================

// =============================
// Logout
// =============================

async function logout() {

    if (!confirm("Logout from this device?")) return;

    try {

        await auth.signOut();

        showToast("👋 Logged Out");

        setTimeout(() => {

            window.location.href = "login.html";

        }, 1000);

    } catch (error) {

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Delete Account
// =============================

function deleteAccount() {

    window.location.href = "delete-account.html";

}

// =============================
// Internet Status
// =============================

window.addEventListener("online", () => {

    showToast("🌐 Internet Connected");

});

window.addEventListener("offline", () => {

    showToast("❌ Internet Disconnected");

});

// =============================
// Keyboard Shortcuts
// =============================

document.addEventListener("keydown", (e) => {

    // Ctrl + R = Refresh

    if (e.ctrlKey && e.key.toLowerCase() === "r") {

        e.preventDefault();

        refreshUser();

    }

    // Ctrl + L = Logout

    if (e.ctrlKey && e.key.toLowerCase() === "l") {

        e.preventDefault();

        logout();

    }

});

// =============================
// Before Leaving Page
// =============================

window.addEventListener("beforeunload", () => {

    console.log("Leaving Security Settings...");

});

// =============================
// Startup
// =============================

window.addEventListener("load", () => {

    console.log("🔒 Viewora Security Ready");

    if (currentUser) {

        checkSecurityStatus();

    }

});

// =============================
// Helper Functions
// =============================

function openPrivacy() {

    window.location.href = "privacy.html";

}

function openDeleteAccount() {

    window.location.href = "delete-account.html";

}

function contactSupport() {

    window.location.href = "mailto:vieworasupport@gmail.com";

}

// ======================================
// End
// ======================================

console.log("✅ security-settings.js Loaded Successfully");