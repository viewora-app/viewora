/*=========================================
        VIEWORA V3 PREMIUM
            signup.js
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

const signupForm=document.getElementById("signupForm");

const nameInput=document.getElementById("name");
const usernameInput=document.getElementById("username");
const emailInput=document.getElementById("email");
const passwordInput=document.getElementById("password");
const confirmPasswordInput=document.getElementById("confirmPassword");

const signupBtn=document.getElementById("signupBtn");
const googleSignupBtn=document.getElementById("googleSignup");

const togglePassword=document.getElementById("togglePassword");
const toggleConfirmPassword=document.getElementById("toggleConfirmPassword");

const usernameStatus=document.getElementById("usernameStatus");

const strengthFill=document.getElementById("strengthFill");
const strengthText=document.getElementById("strengthText");

const loadingOverlay=document.getElementById("loadingOverlay");

const toast=document.getElementById("toast");
const toastText=document.getElementById("toastText");
const toastIcon=document.getElementById("toastIcon");

const verifyModal=document.getElementById("verifyModal");
const openMailBtn=document.getElementById("openMailBtn");
const continueBtn=document.getElementById("continueBtn");

const acceptTerms=document.getElementById("acceptTerms");

/*=========================================
Variables
=========================================*/

let usernameAvailable=false;
let loadingState=false;
let usernameTimer=null;
let toastTimer=null;

/*=========================================
Loader
=========================================*/

function showLoading(){

    loadingState=true;

    loadingOverlay.classList.remove("hidden");

    signupBtn.disabled=true;

}

function hideLoading(){

    loadingState=false;

    loadingOverlay.classList.add("hidden");

    signupBtn.disabled=false;

}

/*=========================================
Toast
=========================================*/

function showToast(message,type="success"){

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

function toggleField(input,button){

    if(input.type==="password"){

        input.type="text";

        button.innerHTML=
        '<i class="fa-solid fa-eye-slash"></i>';

    }else{

        input.type="password";

        button.innerHTML=
        '<i class="fa-solid fa-eye"></i>';

    }

}

togglePassword.addEventListener("click",()=>{

    toggleField(passwordInput,togglePassword);

});

toggleConfirmPassword.addEventListener("click",()=>{

    toggleField(
        confirmPasswordInput,
        toggleConfirmPassword
    );

});

/*=========================================
Startup
=========================================*/

document.addEventListener("DOMContentLoaded",()=>{

    hideLoading();

    console.log("================================");
    console.log("🚀 VIEWORA SIGNUP READY");
    console.log("Firebase :",!!firebase);
    console.log("Auth :",!!auth);
    console.log("Database :",!!db);
    console.log("================================");

});
/*=========================================
        VIEWORA V3 PREMIUM
            signup.js
            PART 2
Validation • Password Strength
Username Availability
=========================================*/

/*=========================================
Password Strength
=========================================*/

function updatePasswordStrength(){

    const value=passwordInput.value.trim();

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
            strengthText.textContent="Password Strength : Weak";

        break;

        case 2:

            strengthFill.style.width="50%";
            strengthFill.style.background="#ff9800";
            strengthText.textContent="Password Strength : Medium";

        break;

        case 3:

            strengthFill.style.width="75%";
            strengthFill.style.background="#00AAFF";
            strengthText.textContent="Password Strength : Good";

        break;

        case 4:

            strengthFill.style.width="100%";
            strengthFill.style.background="#00d26a";
            strengthText.textContent="Password Strength : Strong";

        break;

    }

}

passwordInput.addEventListener(
"input",
updatePasswordStrength
);

/*=========================================
Validation Helpers
=========================================*/

function validEmail(email){

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}

function validUsername(username){

    return /^[a-z0-9_]{3,20}$/.test(username);

}

/*=========================================
Debounce
=========================================*/

function debounce(callback,delay=500){

    return (...args)=>{

        clearTimeout(usernameTimer);

        usernameTimer=setTimeout(()=>{

            callback(...args);

        },delay);

    };

}

/*=========================================
Username Availability
=========================================*/

const checkUsername=debounce(async()=>{

    let value=usernameInput.value

    .trim()

    .toLowerCase()

    .replace(/^@/,"")

    .replace(/[^a-z0-9_]/g,"");

    usernameInput.value=value;

    usernameAvailable=false;

    if(value.length<3){

        usernameStatus.textContent=
        "Minimum 3 characters";

        usernameStatus.style.color="#ff9800";

        return;

    }

    usernameStatus.textContent="Checking...";
    usernameStatus.style.color="#00AAFF";

    try{

        const snap=await db
        .ref("usernames/"+value)
        .once("value");

        if(snap.exists()){

            usernameStatus.textContent=
            "❌ Username already taken";

            usernameStatus.style.color="#ff4d4d";

            usernameAvailable=false;

        }else{

            usernameStatus.textContent=
            "✅ Username available";

            usernameStatus.style.color="#00d26a";

            usernameAvailable=true;

        }

    }catch(error){

        console.error(error);

        usernameStatus.textContent=
        "Unable to check username";

        usernameStatus.style.color="#ff9800";

    }

},500);

usernameInput.addEventListener(
"input",
checkUsername
);

/*=========================================
Form Validation
=========================================*/

function validateForm(){

    const fullName=nameInput.value.trim();

    const username=usernameInput.value
    .trim()
    .toLowerCase();

    const email=emailInput.value
    .trim()
    .toLowerCase();

    const password=passwordInput.value;

    const confirm=
    confirmPasswordInput.value;

    if(fullName.length<2){

        showToast(
        "Enter your full name",
        "error"
        );

        return null;

    }

    if(!validUsername(username)){

        showToast(
        "Invalid username",
        "error"
        );

        return null;

    }

    if(!usernameAvailable){

        showToast(
        "Username not available",
        "error"
        );

        return null;

    }

    if(!validEmail(email)){

        showToast(
        "Invalid email",
        "error"
        );

        return null;

    }

    if(password.length<8){

        showToast(
        "Password must be at least 8 characters",
        "error"
        );

        return null;

    }

    if(password!==confirm){

        showToast(
        "Passwords do not match",
        "error"
        );

        return null;

    }

    if(!acceptTerms.checked){

        showToast(
        "Accept Terms & Conditions",
        "error"
        );

        return null;

    }

    return{

        fullName,
        username,
        email,
        password

    };

}

signupForm.addEventListener(
"submit",
createAccount
);

console.log("✅ Signup Part 2 Loaded");
/*=========================================
        VIEWORA V3 PREMIUM
            signup.js
            PART 3
 Signup • Save User • Email Verification
=========================================*/

async function createAccount(e){

    e.preventDefault();

    if(loadingState) return;

    const data=validateForm();

    if(!data) return;

    showLoading();

    try{

        // ==========================
        // Create Firebase Account
        // ==========================

        const result=

        await auth.createUserWithEmailAndPassword(

            data.email,

            data.password

        );

        const user=result.user;

        // ==========================
        // Update Profile
        // ==========================

        await user.updateProfile({

            displayName:data.fullName

        });

        // ==========================
        // Send Verification Email
        // ==========================

        await user.sendEmailVerification();

        // ==========================
        // Save Username
        // ==========================

        await db

        .ref("usernames/"+data.username)

        .set(user.uid);

        // ==========================
        // Save User Data
        // ==========================

        await db

        .ref("users/"+user.uid)

        .set({

            uid:user.uid,

            fullName:data.fullName,

            username:data.username,

            email:data.email,

            profilePhoto:"assets/default-avatar.png",

            coverPhoto:"",

            bio:"",

            verified:false,

            emailVerified:false,

            followers:0,

            following:0,

            posts:0,

            likes:0,

            online:true,

            createdAt:firebase.database.ServerValue.TIMESTAMP,

            lastLogin:firebase.database.ServerValue.TIMESTAMP

        });

        // ==========================
        // User Settings
        // ==========================

        await db

        .ref("settings/"+user.uid)

        .set({

            theme:"dark",

            language:"en",

            notifications:true,

            privateAccount:false

        });

        hideLoading();

        showToast(

            "Account Created Successfully"

        );

        verifyModal.classList.remove("hidden");

    }

    catch(error){

        hideLoading();

        let message="Signup Failed";

        switch(error.code){

            case "auth/email-already-in-use":

                message="Email already exists";

            break;

            case "auth/invalid-email":

                message="Invalid email address";

            break;

            case "auth/weak-password":

                message="Weak password";

            break;

            case "auth/network-request-failed":

                message="No Internet Connection";

            break;

            default:

                message=error.message;

        }

        showToast(message,"error");

        console.error(error);

    }

}

console.log("✅ Signup Part 3 Loaded")
/*=========================================
        VIEWORA V3 PREMIUM
            signup.js
            PART 4
 Google Signup • Verify Modal
 Auth State • Network
=========================================*/

/*=========================================
Google Signup
=========================================*/

googleSignupBtn.addEventListener("click", async()=>{

    if(loadingState) return;

    showLoading();

    try{

        const result =
        await auth.signInWithPopup(
            googleProvider
        );

        const user = result.user;

        const username =
        (user.displayName || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]/g,"") +
        Math.floor(Math.random()*9999);

        const userRef =
        db.ref("users/"+user.uid);

        const snap =
        await userRef.once("value");

        if(!snap.exists()){

            await db.ref(
            "usernames/"+username
            ).set(user.uid);

            await userRef.set({

                uid:user.uid,

                fullName:
                user.displayName || "",

                username:username,

                email:user.email,

                profilePhoto:
                user.photoURL || "assets/default-avatar.png",

                coverPhoto:"",

                bio:"",

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

        }

        hideLoading();

        showToast(
        "Google Sign Up Successful"
        );

        setTimeout(()=>{

            location.href="index.html";

        },1000);

    }catch(error){

        hideLoading();

        console.error(error);

        showToast(
        error.message,
        "error"
        );

    }

});

/*=========================================
Verify Email Modal
=========================================*/

if(openMailBtn){

openMailBtn.onclick=()=>{

window.open(
"https://mail.google.com",
"_blank"
);

};

}

if(continueBtn){

continueBtn.onclick=async()=>{

const user=auth.currentUser;

if(!user) return;

await user.reload();

if(user.emailVerified){

await db.ref(
"users/"+user.uid
).update({

emailVerified:true

});

showToast(
"Email Verified"
);

location.href="login.html";

}else{

showToast(
"Please verify your email first",
"error"
);

}

};

}

/*=========================================
Auth State
=========================================*/

auth.onAuthStateChanged(user=>{

if(user){

console.log(
"Logged In:",
user.uid
);

}else{

console.log(
"Not Logged In"
);

}

});

/*=========================================
Network Status
=========================================*/

window.addEventListener(
"online",
()=>{

showToast(
"Internet Connected"
);

});

window.addEventListener(
"offline",
()=>{

showToast(
"No Internet Connection",
"error"
);

});

console.log("✅ Signup Part 4 Loaded");
/*=========================================
        VIEWORA V3 PREMIUM
            signup.js
            PART 5 FINAL
 Ripple • Cleanup • Startup
=========================================*/

/*=========================================
Ripple Effect
=========================================*/

document.querySelectorAll("button").forEach(button=>{

    button.addEventListener("click",e=>{

        const ripple=document.createElement("span");

        ripple.className="ripple";

        const rect=button.getBoundingClientRect();

        ripple.style.left=(e.clientX-rect.left)+"px";
        ripple.style.top=(e.clientY-rect.top)+"px";

        button.appendChild(ripple);

        setTimeout(()=>{

            ripple.remove();

        },600);

    });

});

/*=========================================
Auto Redirect
=========================================*/

auth.onAuthStateChanged(async user=>{

    if(!user) return;

    await user.reload();

    if(user.emailVerified){

        db.ref("users/"+user.uid).update({

            online:true,

            lastLogin:firebase.database.ServerValue.TIMESTAMP

        });

    }

});

/*=========================================
Before Unload
=========================================*/

window.addEventListener("beforeunload",()=>{

    const user=auth.currentUser;

    if(user){

        db.ref("users/"+user.uid).update({

            online:false

        });

    }

});

/*=========================================
Reset Form
=========================================*/

function resetSignupForm(){

    signupForm.reset();

    usernameAvailable=false;

    strengthFill.style.width="0%";

    strengthText.textContent="Password Strength : Weak";

    usernameStatus.textContent=
    "Username must be unique";

    usernameStatus.style.color="#9fb7ff";

}

/*=========================================
Prevent Double Submit
=========================================*/

signupForm.addEventListener("submit",()=>{

    signupBtn.disabled=true;

    setTimeout(()=>{

        signupBtn.disabled=false;

    },3000);

});

/*=========================================
Page Animation
=========================================*/

window.addEventListener("load",()=>{

    document.body.classList.add("fadeIn");

});

/*=========================================
Cleanup
=========================================*/

window.addEventListener("unload",()=>{

    db.ref().off();

});

/*=========================================
Console
=========================================*/

console.log("================================");
console.log("🚀 VIEWORA V3 PREMIUM");
console.log("✅ Signup System Loaded");
console.log("✅ Firebase Connected");
console.log("✅ Realtime Database Ready");
console.log("✅ Google Signup Ready");
console.log("✅ Email Verification Ready");
console.log("================================");