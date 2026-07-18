/*=====================================================
            VIEWORA V1.0 PREMIUM
                 signup.js
                  PART 1
     DOM • Loader • Toast • Password Strength
=====================================================*/

//=====================================
// DOM Elements
//=====================================

const signupForm = document.getElementById("signupForm");

const nameInput = document.getElementById("name");
const username = document.getElementById("username");
const email = document.getElementById("email");

const password = document.getElementById("password");
const confirmPassword =
document.getElementById("confirmPassword");

const signupBtn =
document.getElementById("signupBtn");

const googleSignup =
document.getElementById("googleSignup");

const acceptTerms =
document.getElementById("acceptTerms");

const usernameStatus =
document.getElementById("usernameStatus");

const strengthFill =
document.getElementById("strengthFill");

const strengthText =
document.getElementById("strengthText");

const loading =
document.getElementById("loadingOverlay");

const toast =
document.getElementById("toast");

const toastText =
document.getElementById("toastText");

const toastIcon =
document.getElementById("toastIcon");

const verifyModal =
document.getElementById("verifyModal");

const openMailBtn =
document.getElementById("openMailBtn");

const continueBtn =
document.getElementById("continueBtn");

const togglePassword =
document.getElementById("togglePassword");

const toggleConfirmPassword =
document.getElementById("toggleConfirmPassword");

//=====================================
// Loader
//=====================================

function showLoading(){

if(loading){

loading.classList.remove("hidden");

}

signupBtn.disabled=true;

}

function hideLoading(){

if(loading){

loading.classList.add("hidden");

}

signupBtn.disabled=false;

}

//=====================================
// Premium Toast
//=====================================

function showToast(
message,
type="success"
){

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

if(toggleConfirmPassword){

toggleConfirmPassword.onclick=()=>{

if(confirmPassword.type==="password"){

confirmPassword.type="text";

toggleConfirmPassword.innerHTML=
'<i class="fa-solid fa-eye-slash"></i>';

}else{

confirmPassword.type="password";

toggleConfirmPassword.innerHTML=
'<i class="fa-solid fa-eye"></i>';

}

};

}

//=====================================
// Password Strength Meter
//=====================================

password.addEventListener(
"input",
()=>{

const value=password.value;

let score=0;

if(value.length>=8) score++;
if(/[A-Z]/.test(value)) score++;
if(/[0-9]/.test(value)) score++;
if(/[!@#$%^&*(),.?":{}|<>]/.test(value)) score++;

switch(score){

case 0:
case 1:

strengthFill.style.width="25%";
strengthFill.style.background="#ff4d4d";
strengthText.innerText="Password Strength: Weak";

break;

case 2:

strengthFill.style.width="50%";
strengthFill.style.background="#ff9800";
strengthText.innerText="Password Strength: Medium";

break;

case 3:

strengthFill.style.width="75%";
strengthFill.style.background="#00aaff";
strengthText.innerText="Password Strength: Good";

break;

case 4:

strengthFill.style.width="100%";
strengthFill.style.background="#00d26a";
strengthText.innerText="Password Strength: Strong";

break;

}

});

//=====================================
// Startup
//=====================================

hideLoading();

console.log("================================");
console.log("🚀 VIEWORA SIGNUP STARTED");
console.log("Firebase :",!!firebase);
console.log("Auth :",!!auth);
console.log("Database :",!!db);
console.log("================================");

console.log("✅ Signup Part 1 Loaded");
/*=====================================================
            VIEWORA V1.0 PREMIUM
                 signup.js
                  PART 2
 Username Check • Validation • Firebase Signup
=====================================================*/

//=====================================
// Username Availability
//=====================================

let usernameAvailable=false;

username.addEventListener("input",async()=>{

let value=username.value
.trim()
.toLowerCase();

value=value.replace(/[^a-z0-9_]/g,"");

username.value=value;

if(value.length<3){

usernameStatus.innerHTML=
"Minimum 3 characters";

usernameStatus.style.color="#ff9800";

usernameAvailable=false;

return;

}

try{

const snap=await db
.ref("usernames/"+value)
.once("value");

if(snap.exists()){

usernameStatus.innerHTML=
"❌ Username already taken";

usernameStatus.style.color="#ff4d4d";

usernameAvailable=false;

}else{

usernameStatus.innerHTML=
"✅ Username available";

usernameStatus.style.color="#00d26a";

usernameAvailable=true;

}

}catch(err){

console.log(err);

}

});

//=====================================
// Signup Submit
//=====================================

signupForm.addEventListener(
"submit",
createAccount
);

async function createAccount(e){

e.preventDefault();

if(signupBtn.disabled) return;

//=====================================
// Form Values
//=====================================

const fullName=
nameInput.value.trim();

const userName=
username.value
.trim()
.toLowerCase();

const userEmail=
email.value
.trim()
.toLowerCase();

const userPassword=
password.value;

const confirm=
confirmPassword.value;

//=====================================
// Validation
//=====================================

if(fullName.length<2){

showToast(
"Enter your full name",
"error"
);

return;

}

if(userName.length<3){

showToast(
"Username is too short",
"error"
);

return;

}

if(!usernameAvailable){

showToast(
"Choose another username",
"error"
);

return;

}

if(userPassword.length<8){

showToast(
"Password must be at least 8 characters",
"error"
);

return;

}

if(userPassword!==confirm){

showToast(
"Passwords do not match",
"error"
);

return;

}

if(!acceptTerms.checked){

showToast(
"Accept Terms & Conditions",
"error"
);

return;

}

showLoading();

try{

//=====================================
// Create Firebase Account
//=====================================

const result=
await auth
.createUserWithEmailAndPassword(
userEmail,
userPassword
);

const user=result.user;

//=====================================
// Save User Database
//=====================================

await db
.ref("users/"+user.uid)
.set({

uid:user.uid,

name:fullName,

username:userName,

email:userEmail,

photo:"assets/default-avatar.png",

bio:"Hey 👋 I'm new on Viewora!",

followers:0,

following:0,

posts:0,

likes:0,

verified:false,

online:true,

createdAt:
firebase.database.ServerValue.TIMESTAMP,

lastLogin:
firebase.database.ServerValue.TIMESTAMP

});

// Username Mapping

await db
.ref("usernames/"+userName)
.set({

uid:user.uid

});

//=====================================
// Email Verification
//=====================================

await user.sendEmailVerification();

hideLoading();

verifyModal.classList.remove("hidden");

showToast(
"Verification email sent"
);

}catch(error){

hideLoading();

console.log(error);

//=====================================
// Firebase Errors
//=====================================

switch(error.code){

case "auth/email-already-in-use":

showToast(
"Email already exists",
"error"
);

break;

case "auth/invalid-email":

showToast(
"Invalid email address",
"error"
);

break;

case "auth/weak-password":

showToast(
"Weak password",
"error"
);

break;

case "auth/network-request-failed":

showToast(
"No internet connection",
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

console.log("✅ Signup Part 2 Loaded");
/*=====================================================
            VIEWORA V1.0 PREMIUM
                 signup.js
                  PART 3
 Google Signup • Verify Email • Final Logic
=====================================================*/

//=====================================
// Google Signup
//=====================================

if(googleSignup){

googleSignup.addEventListener(
"click",
googleRegister
);

}

async function googleRegister(){

showLoading();

try{

const provider =
new firebase.auth.GoogleAuthProvider();

provider.setCustomParameters({

prompt:"select_account"

});

const result =
await auth.signInWithPopup(provider);

const user = result.user;

//=====================================
// Check Existing User
//=====================================

const userRef =
db.ref("users/"+user.uid);

const snap =
await userRef.once("value");

if(!snap.exists()){

let usernameValue =
user.email
.split("@")[0]
.toLowerCase()
.replace(/[^a-z0-9_]/g,"");

let finalUsername = usernameValue;

// Make username unique
let count = 1;

while(true){

const check =
await db
.ref("usernames/"+finalUsername)
.once("value");

if(!check.exists()) break;

finalUsername =
usernameValue + count;

count++;

}

//=====================================
// Save User
//=====================================

await userRef.set({

uid:user.uid,

name:user.displayName || "Viewora User",

username:finalUsername,

email:user.email,

photo:user.photoURL || "assets/default-avatar.png",

bio:"👋 Hello! I'm using Viewora.",

followers:0,

following:0,

posts:0,

likes:0,

verified:user.emailVerified,

online:true,

createdAt:
firebase.database.ServerValue.TIMESTAMP,

lastLogin:
firebase.database.ServerValue.TIMESTAMP

});

// Username Mapping

await db
.ref("usernames/"+finalUsername)
.set({

uid:user.uid

});

}else{

await userRef.update({

online:true,

lastLogin:
firebase.database.ServerValue.TIMESTAMP

});

}

hideLoading();

showToast(
"Welcome to Viewora!"
);

setTimeout(()=>{

location.replace("index.html");

},1000);

}catch(error){

hideLoading();

console.log(error);

showToast(
error.message,
"error"
);

}

}

//=====================================
// Continue Button
//=====================================

if(continueBtn){

continueBtn.onclick = ()=>{

location.replace("login.html");

};

}

//=====================================
// Open Gmail
//=====================================

if(openMailBtn){

openMailBtn.onclick = ()=>{

window.open(
"https://mail.google.com",
"_blank"
);

};

}

//=====================================
// Online Status
//=====================================

auth.onAuthStateChanged(user=>{

if(!user) return;

const statusRef =
db.ref("users/"+user.uid);

statusRef.update({

online:true,

lastLogin:
firebase.database.ServerValue.TIMESTAMP

});

window.addEventListener(
"beforeunload",
()=>{

statusRef.update({

online:false

});

});

});

//=====================================
// Firebase Connection
//=====================================

firebase.database()
.ref(".info/connected")
.on("value",snap=>{

if(
snap.val() &&
auth.currentUser
){

db.ref(
"users/"+
auth.currentUser.uid+
"/online"
)
.onDisconnect()
.set(false);

}

});

//=====================================
// Enter Key Support
//=====================================

[
nameInput,
username,
email,
password,
confirmPassword
].forEach(input=>{

if(!input) return;

input.addEventListener(
"keypress",
e=>{

if(e.key==="Enter"){

signupBtn.click();

}

});

});

//=====================================
// Ripple Effect
//=====================================

document.querySelectorAll(
".signupBtn,.googleBtn"
).forEach(btn=>{

btn.addEventListener(
"click",
function(e){

const ripple =
document.createElement("span");

const rect =
this.getBoundingClientRect();

ripple.className =
"ripple";

ripple.style.left =
(e.clientX-rect.left)+"px";

ripple.style.top =
(e.clientY-rect.top)+"px";

this.appendChild(ripple);

setTimeout(()=>{

ripple.remove();

},600);

});

});

//=====================================
// Finished
//=====================================

console.log("================================");
console.log("🚀 VIEWORA SIGNUP READY");
console.log("✅ Premium Signup Loaded");
console.log("Version : 1.0");
console.log("================================");