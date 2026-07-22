/*=========================================
        VIEWORA V3 PREMIUM
            login.js
            PART 1
 Firebase • DOM • Loader • Toast
=========================================*/

"use strict";

/*=========================================
Firebase Check
=========================================*/

if(typeof firebase==="undefined"){
    throw new Error("Firebase SDK Missing");
}

if(typeof auth==="undefined"){
    throw new Error("Firebase Auth Missing");
}

if(typeof db==="undefined"){
    throw new Error("Realtime Database Missing");
}

/*=========================================
DOM Elements
=========================================*/

const loginForm=document.getElementById("loginForm");

const loginInput=document.getElementById("loginInput");
const passwordInput=document.getElementById("password");

const loginBtn=document.getElementById("loginBtn");
const googleLoginBtn=document.getElementById("googleLogin");

const rememberMe=document.getElementById("rememberMe");

const togglePassword=document.getElementById("togglePassword");

const forgotPassword=document.getElementById("forgotPassword");

const loadingOverlay=document.getElementById("loadingOverlay");

const toast=document.getElementById("toast");
const toastText=document.getElementById("toastText");
const toastIcon=document.getElementById("toastIcon");

const verifyModal=document.getElementById("verifyModal");
const forgotModal=document.getElementById("forgotModal");

const networkBanner=document.getElementById("networkBanner");

/*=========================================
Variables
=========================================*/

let loading=false;
let toastTimer=null;

/*=========================================
Loader
=========================================*/

function showLoading(){

    loading=true;

    if(loadingOverlay){

        loadingOverlay.classList.remove("hidden");

    }

    if(loginBtn){

        loginBtn.disabled=true;

    }

}

function hideLoading(){

    loading=false;

    if(loadingOverlay){

        loadingOverlay.classList.add("hidden");

    }

    if(loginBtn){

        loginBtn.disabled=false;

    }

}

/*=========================================
Toast
=========================================*/

function showToast(message,type="success"){

    if(!toast) return;

    toastText.textContent=message;

    if(type==="success"){

        toastIcon.className=
        "fa-solid fa-circle-check";

        toastIcon.style.color="#00d26a";

    }else{

        toastIcon.className=
        "fa-solid fa-circle-xmark";

        toastIcon.style.color="#ff4d4d";

    }

    toast.classList.remove("hidden");

    requestAnimationFrame(()=>{

        toast.classList.add("show");

    });

    clearTimeout(toastTimer);

    toastTimer=setTimeout(()=>{

        toast.classList.remove("show");

        setTimeout(()=>{

            toast.classList.add("hidden");

        },300);

    },3000);

}

/*=========================================
Password Toggle
=========================================*/

if(togglePassword){

togglePassword.addEventListener("click",()=>{

    if(passwordInput.type==="password"){

        passwordInput.type="text";

        togglePassword.innerHTML=
        '<i class="fa-solid fa-eye-slash"></i>';

    }else{

        passwordInput.type="password";

        togglePassword.innerHTML=
        '<i class="fa-solid fa-eye"></i>';

    }

});

}

/*=========================================
Remember Me
=========================================*/

const savedLogin=

localStorage.getItem("viewora_login");

if(savedLogin){

loginInput.value=savedLogin;

rememberMe.checked=true;

}

/*=========================================
Startup
=========================================*/

document.addEventListener("DOMContentLoaded",()=>{

    hideLoading();

    console.log("================================");
    console.log("🚀 VIEWORA LOGIN READY");
    console.log("Firebase :",!!firebase);
    console.log("Auth :",!!auth);
    console.log("Database :",!!db);
    console.log("================================");

});
/*=========================================
        VIEWORA V3 PREMIUM
            login.js
            PART 2
 Validation • Username/Email Login
 Remember Me
=========================================*/

/*=========================================
Validation
=========================================*/

function isEmail(value){

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

}

function isUsername(value){

    return /^[a-zA-Z0-9_]{3,20}$/.test(value);

}

function validateLogin(){

    const login=loginInput.value.trim();
    const password=passwordInput.value;

    if(login===""){

        showToast("Enter email or username","error");
        loginInput.focus();
        return false;

    }

    if(password===""){

        showToast("Enter password","error");
        passwordInput.focus();
        return false;

    }

    if(password.length<6){

        showToast("Password is too short","error");
        passwordInput.focus();
        return false;

    }

    return true;

}

/*=========================================
Remember Me
=========================================*/

function saveRememberMe(value){

    if(rememberMe.checked){

        localStorage.setItem(
            "viewora_login",
            value
        );

    }else{

        localStorage.removeItem(
            "viewora_login"
        );

    }

}

/*=========================================
Username → Email Lookup
=========================================*/

async function getEmailFromUsername(username){

    try{

        const usernameSnap=
        await db.ref(
            "usernames/"+username.toLowerCase()
        ).once("value");

        if(!usernameSnap.exists()){

            return null;

        }

        const uid=usernameSnap.val();

        const userSnap=
        await db.ref(
            "users/"+uid
        ).once("value");

        if(!userSnap.exists()){

            return null;

        }

        return userSnap.val().email || null;

    }catch(error){

        console.error(error);

        return null;

    }

}

/*=========================================
Prepare Login
=========================================*/

async function prepareLogin(){

    if(!validateLogin()){

        return null;

    }

    let login=

    loginInput.value

    .trim()

    .toLowerCase();

    const password=

    passwordInput.value;

    if(isUsername(login)){

        const email=

        await getEmailFromUsername(login);

        if(!email){

            showToast(
                "Username not found",
                "error"
            );

            return null;

        }

        login=email;

    }

    if(!isEmail(login)){

        showToast(
            "Invalid email or username",
            "error"
        );

        return null;

    }

    saveRememberMe(login);

    return{

        email:login,

        password:password

    };

}

console.log("✅ Login Part 2 Loaded");
/*=========================================
        VIEWORA V3 PREMIUM
            login.js
            PART 3
 Login • Email Verification
 Online Status • Redirect
=========================================*/

/*=========================================
Login Function
=========================================*/

async function loginUser(e){

    if(e) e.preventDefault();

    if(loading) return;

    const data=await prepareLogin();

    if(!data) return;

    showLoading();

    try{

        const result=

        await auth.signInWithEmailAndPassword(

            data.email,

            data.password

        );

        const user=result.user;

        await user.reload();

        /*=============================
        Email Verification
        =============================*/

        if(!user.emailVerified){

            hideLoading();

            if(verifyModal){

                verifyModal.classList.remove("hidden");

            }

            showToast(

                "Please verify your email",

                "error"

            );

            await auth.signOut();

            return;

        }

        /*=============================
        Update User Status
        =============================*/

        await db.ref("users/"+user.uid).update({

            online:true,

            emailVerified:true,

            lastLogin:
            firebase.database.ServerValue.TIMESTAMP

        });

        db.ref("users/"+user.uid)

        .onDisconnect()

        .update({

            online:false

        });

        hideLoading();

        showToast(

            "Login Successful"

        );

        /*=============================
        Redirect
        =============================*/

        setTimeout(()=>{

            location.replace("index.html");

        },1200);

    }

    catch(error){

        hideLoading();

        console.error(error);

        let message="Login Failed";

        switch(error.code){

            case "auth/user-not-found":

                message="Account not found";
                break;

            case "auth/wrong-password":

                message="Incorrect password";
                break;

            case "auth/invalid-credential":

                message="Invalid email or password";
                break;

            case "auth/too-many-requests":

                message="Too many attempts. Try later.";
                break;

            case "auth/network-request-failed":

                message="No Internet Connection";
                break;

            default:

                message=error.message;

        }

        showToast(message,"error");

    }

}

/*=========================================
Login Form
=========================================*/

if(loginForm){

    loginForm.addEventListener(

        "submit",

        loginUser

    );

}

/*=========================================
Enter Key
=========================================*/

passwordInput.addEventListener(

    "keypress",

    function(e){

        if(e.key==="Enter"){

            loginUser(e);

        }

    }

);

console.log("✅ Login Part 3 Loaded");
/*=========================================
        VIEWORA V3 PREMIUM
            login.js
            PART 4
 Google Login • Forgot Password
 Auto Login • Auth State
=========================================*/

/*=========================================
Google Login
=========================================*/

if(googleLoginBtn){

googleLoginBtn.addEventListener("click",async()=>{

    if(loading) return;

    showLoading();

    try{

        const result=

        await auth.signInWithPopup(
            googleProvider
        );

        const user=result.user;

        const userRef=
        db.ref("users/"+user.uid);

        const snap=
        await userRef.once("value");

        if(!snap.exists()){

            const username=
            (user.displayName||"user")
            .toLowerCase()
            .replace(/[^a-z0-9]/g,"")+
            Math.floor(Math.random()*9999);

            await db.ref(
                "usernames/"+username
            ).set(user.uid);

            await userRef.set({

                uid:user.uid,

                fullName:user.displayName||"",

                username:username,

                email:user.email,

                profilePhoto:
                user.photoURL||

                "assets/default-avatar.png",

                verified:false,

                emailVerified:true,

                followers:0,

                following:0,

                posts:0,

                likes:0,

                online:true,

                createdAt:
                firebase.database.ServerValue.TIMESTAMP,

                lastLogin:
                firebase.database.ServerValue.TIMESTAMP

            });

        }else{

            await userRef.update({

                online:true,

                lastLogin:
                firebase.database.ServerValue.TIMESTAMP

            });

        }

        hideLoading();

        showToast("Google Login Successful");

        setTimeout(()=>{

            location.replace("index.html");

        },1000);

    }

    catch(error){

        hideLoading();

        console.error(error);

        showToast(error.message,"error");

    }

});

}

/*=========================================
Forgot Password
=========================================*/

const sendResetBtn=
document.getElementById("sendResetBtn");

const closeForgotBtn=
document.getElementById("closeForgotBtn");

const resetEmail=
document.getElementById("resetEmail");

if(forgotPassword){

forgotPassword.onclick=(e)=>{

    e.preventDefault();

    forgotModal.classList.remove("hidden");

};

}

if(closeForgotBtn){

closeForgotBtn.onclick=()=>{

    forgotModal.classList.add("hidden");

};

}

if(sendResetBtn){

sendResetBtn.onclick=async()=>{

    const email=

    resetEmail.value.trim();

    if(email===""){

        showToast(
            "Enter your email",
            "error"
        );

        return;

    }

    try{

        await auth.sendPasswordResetEmail(email);

        showToast(
            "Password reset email sent"
        );

        forgotModal.classList.add("hidden");

        resetEmail.value="";

    }

    catch(error){

        console.error(error);

        showToast(error.message,"error");

    }

};

}

/*=========================================
Resend Verification
=========================================*/

const resendVerificationBtn=
document.getElementById(
"resendVerificationBtn"
);

const closeVerifyBtn=
document.getElementById(
"closeVerifyBtn"
);

if(closeVerifyBtn){

closeVerifyBtn.onclick=()=>{

    verifyModal.classList.add("hidden");

};

}

if(resendVerificationBtn){

resendVerificationBtn.onclick=async()=>{

    const user=auth.currentUser;

    if(!user){

        showToast("Login again","error");

        return;

    }

    try{

        await user.sendEmailVerification();

        showToast(
            "Verification email sent"
        );

    }

    catch(error){

        console.error(error);

        showToast(error.message,"error");

    }

};

}

/*=========================================
Auto Login
=========================================*/

auth.onAuthStateChanged(async(user)=>{

    if(!user) return;

    await user.reload();

    if(user.emailVerified){

        location.replace("index.html");

    }

});

console.log("✅ Login Part 4 Loaded");
/*=========================================
        VIEWORA V3 PREMIUM
            login.js
            PART 5 FINAL
 Ripple • Network • Cleanup
=========================================*/

/*=========================================
Ripple Effect
=========================================*/

document.querySelectorAll("button").forEach(button=>{

    button.addEventListener("click",function(e){

        const ripple=document.createElement("span");

        ripple.className="ripple";

        const rect=this.getBoundingClientRect();

        ripple.style.left=
        (e.clientX-rect.left)+"px";

        ripple.style.top=
        (e.clientY-rect.top)+"px";

        this.appendChild(ripple);

        setTimeout(()=>{

            ripple.remove();

        },600);

    });

});

/*=========================================
Network Status
=========================================*/

function updateNetworkStatus(){

    if(!networkBanner) return;

    if(navigator.onLine){

        networkBanner.classList.add("hidden");

        showToast("Internet Connected");

    }else{

        networkBanner.classList.remove("hidden");

        showToast("No Internet Connection","error");

    }

}

window.addEventListener(

"online",

updateNetworkStatus

);

window.addEventListener(

"offline",

updateNetworkStatus

);

/*=========================================
Online / Offline User
=========================================*/

window.addEventListener(

"beforeunload",

()=>{

    const user=auth.currentUser;

    if(user){

        db.ref("users/"+user.uid).update({

            online:false,

            lastSeen:
            firebase.database.ServerValue.TIMESTAMP

        });

    }

});

/*=========================================
Close Modal
=========================================*/

window.addEventListener("click",e=>{

    if(e.target===forgotModal){

        forgotModal.classList.add("hidden");

    }

    if(e.target===verifyModal){

        verifyModal.classList.add("hidden");

    }

});

/*=========================================
Page Startup
=========================================*/

window.addEventListener("load",()=>{

    hideLoading();

    updateNetworkStatus();

    console.log("================================");
    console.log("🚀 VIEWORA LOGIN SYSTEM");
    console.log("✅ Firebase Ready");
    console.log("✅ Login Ready");
    console.log("✅ Google Login Ready");
    console.log("✅ Password Reset Ready");
    console.log("✅ Network Ready");
    console.log("================================");

});

/*=========================================
Cleanup
=========================================*/

window.addEventListener("unload",()=>{

    try{

        db.ref().off();

    }catch(e){

        console.log(e);

    }

});

console.log("✅ Login Part 5 Loaded");