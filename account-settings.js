// ======================================
// Viewora Account Settings
// Part 1
// ======================================

auth.onAuthStateChanged((user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    loadProfile(user.uid);

});

function loadProfile(uid) {

    db.ref("users/" + uid).once("value").then((snapshot) => {

        if (!snapshot.exists()) return;

        const user = snapshot.val();

        document.getElementById("profilePhoto").src =
            user.profilePhoto || "non.jpg";

        document.getElementById("profileName").innerText =
            user.name || "User";

        document.getElementById("profileUsername").innerText =
            "@" + (user.username || "user");

        document.getElementById("fullName").value =
            user.name || "";

        document.getElementById("username").value =
            user.username || "";

        document.getElementById("email").value =
            user.email || "";

        document.getElementById("phone").value =
            user.phone || "";

        document.getElementById("birthday").value =
            user.birthday || "";

        document.getElementById("gender").value =
            user.gender || "";

        document.getElementById("bio").value =
            user.bio || "";

        const counter = document.getElementById("bioCount");
        if (counter) {
            counter.innerText = (user.bio || "").length;
        }

    });

}

// ======================================
// Change Profile Photo
// ======================================

function changeProfilePhoto() {

    const url = prompt("Enter Profile Photo URL");

    if (!url) return;

    document.getElementById("profilePhoto").src = url;

}

// ======================================
// Remove Profile Photo
// ======================================

function removeProfilePhoto() {

    if (!confirm("Remove profile photo?")) return;

    document.getElementById("profilePhoto").src = "users.jpg";

}
// ======================================
// Viewora Account Settings
// Part 2
// Save Profile
// ======================================

async function saveProfile() {

    const user = auth.currentUser;

    if (!user) return;

    const fullName = document.getElementById("fullName").value.trim();
    const username = document.getElementById("username").value.trim().toLowerCase();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const birthday = document.getElementById("birthday").value;
    const gender = document.getElementById("gender").value;
    const bio = document.getElementById("bio").value.trim();
    const profilePhoto = document.getElementById("profilePhoto").src;

    // =============================
    // Validation
    // =============================

    if (fullName.length < 3) {
        return showToast("❌ Name must be at least 3 characters");
    }

    if (username.length < 3) {
        return showToast("❌ Username must be at least 3 characters");
    }

    if (bio.length > 150) {
        return showToast("❌ Bio cannot exceed 150 characters");
    }

    try {

        // Update Email (if changed)
        if (email !== user.email) {

            await user.updateEmail(email);

        }

        // Save Database

        await db.ref("users/" + user.uid).update({

            name: fullName,

            username: username,

            email: email,

            phone: phone,

            birthday: birthday,

            gender: gender,

            bio: bio,

            profilePhoto: profilePhoto,

            updatedAt: firebase.database.ServerValue.TIMESTAMP

        });

        document.getElementById("profileName").innerText = fullName;
        document.getElementById("profileUsername").innerText = "@" + username;

        showToast("✅ Profile Updated Successfully");

    }

    catch (error) {

        alert(error.message);

    }

}

// ======================================
// Reset Form
// ======================================

function resetForm() {

    if (!confirm("Reset all unsaved changes?")) return;

    loadProfile(auth.currentUser.uid);

    showToast("🔄 Form Reset");

}
// ======================================
// Viewora Account Settings
// Part 3
// Security & Validation
// ======================================

// =============================
// Email Verification
// =============================

async function verifyEmail(){

    const user = auth.currentUser;

    if(!user) return;

    try{

        await user.sendEmailVerification();

        showToast("📧 Verification email sent.");

    }

    catch(error){

        alert(error.message);

    }

}

// =============================
// Reset Password
// =============================

async function resetPassword(){

    const user=auth.currentUser;

    if(!user) return;

    try{

        await auth.sendPasswordResetEmail(user.email);

        showToast("🔑 Password reset email sent.");

    }

    catch(error){

        alert(error.message);

    }

}

// =============================
// Username Validation
// =============================

const usernameInput=document.getElementById("username");

if(usernameInput){

usernameInput.addEventListener("input",()=>{

let value=usernameInput.value
.toLowerCase()
.replace(/[^a-z0-9_.]/g,"");

usernameInput.value=value;

});

}

// =============================
// Full Name Validation
// =============================

const nameInput=document.getElementById("fullName");

if(nameInput){

nameInput.addEventListener("input",()=>{

if(nameInput.value.length>40){

nameInput.value=nameInput.value.substring(0,40);

}

});

}

// =============================
// Bio Counter
// =============================

const bio=document.getElementById("bio");

const counter=document.getElementById("bioCount");

if(bio && counter){

bio.addEventListener("input",()=>{

counter.innerText=bio.value.length;

});

}

// =============================
// Auto Save Indicator
// =============================

const formFields=document.querySelectorAll(

"#fullName,#username,#email,#phone,#birthday,#gender,#bio"

);

formFields.forEach(field=>{

field.addEventListener("input",()=>{

document.title="● Unsaved Changes";

});

});

// =============================
// Save Success
// =============================

function profileSaved(){

document.title="👤 Account Settings • Viewora";

showToast("✅ Changes Saved");

}

// ======================================
// End Part 3
// ======================================
// ======================================
// Viewora Account Settings
// Part 4 (Final)
// ======================================

// =============================
// Reload Profile
// =============================

function refreshProfile(){

    const user = auth.currentUser;

    if(!user) return;

    loadProfile(user.uid);

    showToast("🔄 Profile Refreshed");

}

// =============================
// Logout
// =============================

async function logout(){

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
// Internet Status
// =============================

window.addEventListener("online",()=>{

    showToast("🌐 Internet Connected");

});

window.addEventListener("offline",()=>{

    showToast("❌ Internet Disconnected");

});

// =============================
// Page Loaded
// =============================

window.addEventListener("load",()=>{

    console.log("✅ Account Settings Loaded");

});

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
        bottom:35px;
        transform:translateX(-50%);
        background:#00aaff;
        color:#fff;
        padding:14px 22px;
        border-radius:30px;
        font-size:14px;
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
// Profile Photo Click
// =============================

const profileImage=document.getElementById("profilePhoto");

if(profileImage){

    profileImage.addEventListener("click",()=>{

        changeProfilePhoto();

    });

}

// =============================
// Save Shortcut
// Ctrl + S
// =============================

document.addEventListener("keydown",(e)=>{

    if(e.ctrlKey && e.key==="s"){

        e.preventDefault();

        saveProfile();

    }

});

// =============================
// Before Leaving Page
// =============================

window.addEventListener("beforeunload",(e)=>{

    if(document.title==="● Unsaved Changes"){

        e.preventDefault();

        e.returnValue="";

    }

});

// ======================================
// End
// ======================================

console.log("🚀 Viewora Account Settings Ready");