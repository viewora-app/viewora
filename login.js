/*=====================================================
            VIEWORA V1.0 FINAL
                login.js
                 PART 1
 DOM • Loader • Toast • Password Toggle • Startup
=====================================================*/

//=====================================
// DOM Elements
//=====================================

const loginForm = document.getElementById("loginForm");

const email =
document.getElementById("email");

const password =
document.getElementById("password");

const loginBtn =
document.getElementById("loginBtn");

const googleBtn =
document.getElementById("googleLogin");

const rememberMe =
document.getElementById("rememberMe");

const forgotPassword =
document.getElementById("forgotPassword");

const loading =
document.getElementById("loadingOverlay");

const toast =
document.getElementById("toast");

const toastText =
document.getElementById("toastText");

const toastIcon =
document.getElementById("toastIcon");

const togglePassword =
document.getElementById("togglePassword");

//=====================================
// Loader
//=====================================

function showLoading(){

if(loading){

loading.classList.remove("hidden");

}

if(loginBtn){

loginBtn.disabled=true;

}

}

function hideLoading(){

if(loading){

loading.classList.add("hidden");

}

if(loginBtn){

loginBtn.disabled=false;

}

}

//=====================================
// Premium Toast
//=====================================

function showToast(message,type="success"){

if(!toast){

alert(message);

return;

}

toastText.innerText=message;

switch(type){

case "success":

toastIcon.className=
"fa-solid fa-circle-check";

toastIcon.style.color="#00d26a";

break;

case "error":

toastIcon.className=
"fa-solid fa-circle-xmark";

toastIcon.style.color="#ff4d4d";

break;

default:

toastIcon.className=
"fa-solid fa-circle-info";

toastIcon.style.color="#00aaff";

}

toast.classList.remove("hidden");

setTimeout(()=>{

toast.classList.add("show");

},50);

setTimeout(()=>{

toast.classList.remove("show");

setTimeout(()=>{

toast.classList.add("hidden");

},300);

},3000);

}

//=====================================
// Password Toggle
//=====================================

if(togglePassword){

togglePassword.onclick=()=>{

if(password.type==="password"){

password.type="text";

togglePassword.innerHTML=
'<i class="fa-solid fa-eye-slash"></i>';

}else{

password.type="password";

togglePassword.innerHTML=
'<i class="fa-solid fa-eye"></i>';

}

};

}

//=====================================
// Remember Me
//=====================================

if(localStorage.getItem("vieworaRemember")==="true"){

rememberMe.checked=true;

}

rememberMe.addEventListener("change",()=>{

localStorage.setItem(
"vieworaRemember",
rememberMe.checked
);

});

//=====================================
// Auto Redirect
//=====================================

auth.onAuthStateChanged(user=>{

if(!user) return;

if(user.emailVerified){

location.replace("index.html");

}

});

//=====================================
// Forgot Password
//=====================================

if(forgotPassword){

forgotPassword.onclick=()=>{

let mail=prompt(
"Enter your registered Email"
);

if(!mail) return;

auth.sendPasswordResetEmail(mail.trim())

.then(()=>{

showToast(
"Password reset email sent"
);

})

.catch(error=>{

showToast(
error.message,
"error"
);

});

};

}

//=====================================
// Startup
//=====================================

hideLoading();

console.log("================================");
console.log("🚀 VIEWORA LOGIN STARTED");
console.log("Firebase :",!!firebase);
console.log("Auth :",!!auth);
console.log("Database :",!!db);
console.log("================================");
console.log("✅ Login Part 1 Loaded");
/*=====================================================
            VIEWORA V1.0 FINAL
                login.js
                 PART 2
   Email • Username • @Username Login (Fixed)
=====================================================*/

//=====================================
// Login Form
//=====================================

if(loginForm){

loginForm.addEventListener(
"submit",
loginUser
);

}

async function loginUser(e){

e.preventDefault();

if(loginBtn.disabled) return;

showLoading();

try{

let loginInput =
email.value
.trim()
.toLowerCase();

const userPassword =
password.value;

//==============================
// Validation
//==============================

if(loginInput===""){

hideLoading();

showToast(
"Enter Email or Username",
"error"
);

return;

}

if(userPassword===""){

hideLoading();

showToast(
"Enter Password",
"error"
);

return;

}

// Remove @
if(loginInput.startsWith("@")){

loginInput =
loginInput.substring(1);

}

let loginEmail = loginInput;

//====================================
// Username Login Support
//====================================

if(!loginInput.includes("@")){

// Method 1
const usernameMap =
await db
.ref("usernames/"+loginInput)
.once("value");

if(usernameMap.exists()){

const uid =
usernameMap.val().uid;

const userData =
await db
.ref("users/"+uid)
.once("value");

if(userData.exists()){

loginEmail =
userData.val().email;

}

}else{

//====================================
// Method 2 (Old Database Support)
//====================================

const users =
await db
.ref("users")
.once("value");

let found = false;

users.forEach(child=>{

const data = child.val();

if(
data.username &&
data.username
.replace("@","")
.toLowerCase()===loginInput
){

loginEmail = data.email;

found = true;

}

});

if(!found){

hideLoading();

showToast(
"Username not found",
"error"
);

return;

}

}

}

//====================================
// Remember Me
//====================================

await auth.setPersistence(

rememberMe.checked
?

firebase.auth.Auth.Persistence.LOCAL

:

firebase.auth.Auth.Persistence.SESSION

);

//====================================
// Firebase Login
//====================================

const result =
await auth
.signInWithEmailAndPassword(
loginEmail,
userPassword
);

const user = result.user;

await user.reload();

//====================================
// Email Verify
//====================================

if(!user.emailVerified){

await auth.signOut();

hideLoading();

showToast(
"Please verify your email first",
"error"
);

return;

}

//====================================
// Update User
//====================================

await db
.ref("users/"+user.uid)
.update({

online:true,

lastLogin:
firebase.database.ServerValue.TIMESTAMP

});

hideLoading();

showToast(
"Welcome Back 🎉"
);

setTimeout(()=>{

location.replace(
"index.html"
);

},1000);

}catch(error){

hideLoading();

console.log(error);

//====================================
// Better Errors
//====================================

switch(error.code){

case "auth/invalid-credential":

case "auth/wrong-password":

case "auth/user-not-found":

showToast(
"Incorrect email/username or password",
"error"
);

break;

case "auth/invalid-email":

showToast(
"Invalid email address",
"error"
);

break;

case "auth/network-request-failed":

showToast(
"Check your internet connection",
"error"
);

break;

case "auth/too-many-requests":

showToast(
"Too many attempts. Try again later.",
"error"
);

break;

default:

showToast(
error.message,
"error"
);

}

}

}

console.log("✅ Login Part 2 Loaded");
/*=====================================================
            VIEWORA V1.0 FINAL
                login.js
                 PART 3
 Google Login • Password Reset • Online Status
=====================================================*/

//=====================================
// Google Login
//=====================================

if (googleBtn) {

    googleBtn.addEventListener("click", googleLogin);

}

async function googleLogin() {

    showLoading();

    try {

        const provider = new firebase.auth.GoogleAuthProvider();

        provider.setCustomParameters({
            prompt: "select_account"
        });

        const result =
        await auth.signInWithPopup(provider);

        const user = result.user;

        const userRef =
        db.ref("users/" + user.uid);

        const snap =
        await userRef.once("value");

        if (!snap.exists()) {

            let username =
            (user.email || "user")
            .split("@")[0]
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "");

            // Username unique
            let finalUsername = username;
            let count = 1;

            while (true) {

                const check =
                await db.ref("usernames/" + finalUsername)
                .once("value");

                if (!check.exists()) break;

                finalUsername = username + count;
                count++;

            }

            // Save User

            await userRef.set({

                uid: user.uid,

                name: user.displayName || "Viewora User",

                username: "@" + finalUsername,

                email: user.email,

                photo: user.photoURL || "assets/default-avatar.png",

                bio: "👋 Hello! I'm using Viewora.",

                followers: 0,

                following: 0,

                posts: 0,

                likes: 0,

                verified: true,

                online: true,

                createdAt:
                firebase.database.ServerValue.TIMESTAMP,

                lastLogin:
                firebase.database.ServerValue.TIMESTAMP

            });

            // Username Mapping

            await db.ref("usernames/" + finalUsername)
            .set({

                uid: user.uid

            });

        } else {

            await userRef.update({

                online: true,

                lastLogin:
                firebase.database.ServerValue.TIMESTAMP

            });

        }

        hideLoading();

        showToast("Welcome to Viewora 🎉");

        setTimeout(() => {

            location.replace("index.html");

        }, 800);

    } catch (error) {

        hideLoading();

        console.log(error);

        showToast(error.message, "error");

    }

}

//=====================================
// Forgot Password
//=====================================

if (forgotPassword) {

    forgotPassword.onclick = async () => {

        const mail = prompt(
            "Enter your registered email"
        );

        if (!mail) return;

        try {

            await auth.sendPasswordResetEmail(
                mail.trim()
            );

            showToast(
                "Password reset email sent"
            );

        } catch (error) {

            showToast(
                error.message,
                "error"
            );

        }

    };

}

//=====================================
// Online Status
//=====================================

auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    const ref =
    db.ref("users/" + user.uid);

    await ref.update({

        online: true,

        lastLogin:
        firebase.database.ServerValue.TIMESTAMP

    });

    ref.child("online")
    .onDisconnect()
    .set(false);

});

//=====================================
// Enter Key Support
//=====================================

[email, password].forEach(input => {

    if (!input) return;

    input.addEventListener("keypress", e => {

        if (e.key === "Enter") {

            loginBtn.click();

        }

    });

});

//=====================================
// Ripple Effect
//=====================================

document.querySelectorAll(
".loginBtn,.googleBtn"
).forEach(btn => {

    btn.addEventListener("click", function (e) {

        const ripple =
        document.createElement("span");

        ripple.className = "ripple";

        const rect =
        this.getBoundingClientRect();

        ripple.style.left =
        (e.clientX - rect.left) + "px";

        ripple.style.top =
        (e.clientY - rect.top) + "px";

        this.appendChild(ripple);

        setTimeout(() => {

            ripple.remove();

        }, 600);

    });

});

//=====================================
// Auto Redirect
//=====================================

auth.onAuthStateChanged(user => {

    if (!user) return;

    if (user.emailVerified) {

        location.replace("index.html");

    }

});

//=====================================
// Startup
//=====================================

console.log("================================");
console.log("🚀 VIEWORA LOGIN READY");
console.log("✅ Premium Login Loaded");
console.log("Version : 1.0 FINAL");
console.log("================================");