/*=========================================
        VIEWORA V10 PREMIUM
            signup.js
            PART 1
 DOM • Variables • Loader • Toast
=========================================*/

"use strict";

/*=========================================
Firebase Check
=========================================*/

if (typeof firebase === "undefined")
    throw new Error("Firebase SDK Missing");

if (typeof auth === "undefined")
    throw new Error("Firebase Auth Missing");

if (typeof db === "undefined")
    throw new Error("Realtime Database Missing");

/*=========================================
DOM Elements
=========================================*/

const signupForm =
document.getElementById("signupForm");

const nameInput =
document.getElementById("name");

const usernameInput =
document.getElementById("username");

const emailInput =
document.getElementById("email");

const passwordInput =
document.getElementById("password");

const confirmPasswordInput =
document.getElementById("confirmPassword");

const signupBtn =
document.getElementById("signupBtn");

const googleSignupBtn =
document.getElementById("googleSignup");

const togglePassword =
document.getElementById("togglePassword");

const toggleConfirmPassword =
document.getElementById("toggleConfirmPassword");

const usernameStatus =
document.getElementById("usernameStatus");

const strengthFill =
document.getElementById("strengthFill");

const strengthText =
document.getElementById("strengthText");

const loadingOverlay =
document.getElementById("loadingOverlay");

const toast =
document.getElementById("toast");

const toastIcon =
document.getElementById("toastIcon");

const toastText =
document.getElementById("toastText");

const verifyModal =
document.getElementById("verifyModal");

const openMailBtn =
document.getElementById("openMailBtn");

const continueBtn =
document.getElementById("continueBtn");

const acceptTerms =
document.getElementById("acceptTerms");

/*=========================================
Variables
=========================================*/

let usernameAvailable = false;

let loading = false;

let usernameTimer = null;

let toastTimer = null;

/*=========================================
Loader
=========================================*/

function showLoading(){

    loading = true;

    if(loadingOverlay)
        loadingOverlay.classList.remove("hidden");

    if(signupBtn)
        signupBtn.disabled = true;

}

function hideLoading(){

    loading = false;

    if(loadingOverlay)
        loadingOverlay.classList.add("hidden");

    if(signupBtn)
        signupBtn.disabled = false;

}

/*=========================================
Toast
=========================================*/

function showToast(message,type="success"){

    if(!toast) return;

    toastText.textContent = message;

    if(type==="success"){

        toastIcon.className =
        "fa-solid fa-circle-check";

        toastIcon.style.color = "#00d26a";

    }else{

        toastIcon.className =
        "fa-solid fa-circle-xmark";

        toastIcon.style.color = "#ff4d4d";

    }

    toast.classList.remove("hidden");

    requestAnimationFrame(()=>{

        toast.classList.add("show");

    });

    clearTimeout(toastTimer);

    toastTimer = setTimeout(()=>{

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

    if(!input || !button) return;

    if(input.type==="password"){

        input.type="text";

        button.innerHTML =
        '<i class="fa-solid fa-eye-slash"></i>';

    }else{

        input.type="password";

        button.innerHTML =
        '<i class="fa-solid fa-eye"></i>';

    }

}

togglePassword?.addEventListener("click",()=>{

    toggleField(
        passwordInput,
        togglePassword
    );

});

toggleConfirmPassword?.addEventListener("click",()=>{

    toggleField(
        confirmPasswordInput,
        toggleConfirmPassword
    );

});

/*=========================================
Startup
=========================================*/

window.addEventListener("load",()=>{

    hideLoading();

    console.log("================================");
    console.log("🚀 VIEWORA V10 SIGNUP");
    console.log("✅ Firebase Ready");
    console.log("✅ Signup Ready");
    console.log("================================");

});
/*=========================================
        VIEWORA V10 PREMIUM
            signup.js
            PART 2
 Validation • Password Strength
 Username Availability
=========================================*/

/*=========================================
Email Validation
=========================================*/

function validEmail(email){

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}

/*=========================================
Username Validation
=========================================*/

function validUsername(username){

    return /^[a-z0-9_]{3,20}$/.test(username);

}

/*=========================================
Password Strength
=========================================*/

function updatePasswordStrength(){

    const password=passwordInput.value.trim();

    let score=0;

    if(password.length>=8) score++;

    if(/[A-Z]/.test(password)) score++;

    if(/[a-z]/.test(password)) score++;

    if(/[0-9]/.test(password)) score++;

    if(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;

    let width="0%";
    let color="#ff4d4d";
    let text="Weak";

    if(score===1){

        width="20%";

    }

    if(score===2){

        width="40%";

        color="#ff9800";

        text="Medium";

    }

    if(score===3){

        width="60%";

        color="#ffc107";

        text="Good";

    }

    if(score===4){

        width="80%";

        color="#00aaff";

        text="Strong";

    }

    if(score===5){

        width="100%";

        color="#00d26a";

        text="Very Strong";

    }

    strengthFill.style.width=width;

    strengthFill.style.background=color;

    strengthText.textContent=

    "Password Strength : "+text;

}

passwordInput.addEventListener(

    "input",

    updatePasswordStrength

);

/*=========================================
Username Availability
=========================================*/

async function checkUsernameAvailability(){

    let username=

    usernameInput.value

    .trim()

    .toLowerCase()

    .replace(/^@/,"")

    .replace(/[^a-z0-9_]/g,"");

    usernameInput.value=username;

    usernameAvailable=false;

    if(username.length<3){

        usernameStatus.textContent=

        "Minimum 3 characters required";

        usernameStatus.style.color="#ff9800";

        return;

    }

    usernameStatus.textContent="Checking...";

    usernameStatus.style.color="#00AAFF";

    try{

        const snap=

        await usernameRef(username)

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

    }

    catch(error){

        console.error(error);

        usernameStatus.textContent=

        "Unable to check username";

        usernameStatus.style.color="#ff9800";

    }

}

/*=========================================
Debounce
=========================================*/

usernameInput.addEventListener(

    "input",

    ()=>{

        clearTimeout(usernameTimer);

        usernameTimer=setTimeout(

            checkUsernameAvailability,

            500

        );

    }

);

/*=========================================
Form Validation
=========================================*/

function validateForm(){

    const fullName=

    nameInput.value.trim();

    const username=

    usernameInput.value

    .trim()

    .toLowerCase();

    const email=

    emailInput.value

    .trim()

    .toLowerCase();

    const password=

    passwordInput.value;

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

            "Username unavailable",

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

console.log("✅ Signup Part 2 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            signup.js
            PART 3
 Create Account • Save User Data
 Email Verification • Realtime Database
=========================================*/

/*=========================================
Create Account
=========================================*/

async function createAccount(e){

    e.preventDefault();

    if(loading) return;

    const data = validateForm();

    if(!data) return;

    showLoading();

    try{

        /*=============================
        Create Firebase Account
        =============================*/

        const credential =
        await auth.createUserWithEmailAndPassword(

            data.email,

            data.password

        );

        const user = credential.user;

        /*=============================
        Update Auth Profile
        =============================*/

        await user.updateProfile({

            displayName: data.fullName,

            photoURL: "assets/default-avatar.png"

        });

        /*=============================
        Send Verification Email
        =============================*/

        await user.sendEmailVerification();

        /*=============================
        Reserve Username
        =============================*/

        await safeWrite(

            "usernames/" + data.username,

            user.uid

        );

        /*=============================
        Default User Object
        =============================*/

        const userData = {

            uid: user.uid,

            fullName: data.fullName,

            username: data.username,

            email: data.email,

            profilePhoto:
            "assets/default-avatar.png",

            coverPhoto:
            "assets/default-banner.jpg",

            bio: "Welcome to Viewora 🚀",

            verified: false,

            emailVerified: false,

            followers: 0,

            following: 0,

            posts: 0,

            videos: 0,

            shorts: 0,

            likes: 0,

            online: true,

            accountType: "creator",

            createdAt: serverTime(),

            lastLogin: serverTime(),

            lastSeen: serverTime()

        };

        /*=============================
        Save User
        =============================*/

        await safeWrite(

            "users/" + user.uid,

            userData

        );

        /*=============================
        Default Settings
        =============================*/

        await safeWrite(

            "settings/" + user.uid,

            {

                theme: "dark",

                language: "en",

                privateAccount: false,

                notifications: true,

                autoplay: true,

                downloadQuality: "HD"

            }

        );

        /*=============================
        Create Empty Collections
        =============================*/

        await Promise.all([

            safeWrite(

                "followers/" + user.uid,

                {}

            ),

            safeWrite(

                "following/" + user.uid,

                {}

            ),

            safeWrite(

                "savedPosts/" + user.uid,

                {}

            ),

            safeWrite(

                "notifications/" + user.uid,

                {}

            )

        ]);

        hideLoading();

        showToast(

            "Account Created Successfully"

        );

        verifyModal?.classList.remove("hidden");

    }

    catch(error){

        hideLoading();

        console.error(error);

        let message = "Signup Failed";

        switch(error.code){

            case "auth/email-already-in-use":

                message =
                "Email already registered";
                break;

            case "auth/invalid-email":

                message =
                "Invalid email address";
                break;

            case "auth/weak-password":

                message =
                "Password is too weak";
                break;

            case "auth/network-request-failed":

                message =
                "No Internet Connection";
                break;

            default:

                message = error.message;

        }

        showToast(message,"error");

    }

}

/*=========================================
Bind Form
=========================================*/

signupForm?.addEventListener(

    "submit",

    createAccount

);

console.log("✅ Signup Part 3 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            signup.js
            PART 4
 Google Signup • Email Verification
 Verify Modal • Rollback System
=========================================*/

/*=========================================
Google Signup
=========================================*/

googleSignupBtn?.addEventListener("click", async()=>{

    if(loading) return;

    showLoading();

    try{

        const result =
        await auth.signInWithPopup(
            googleProvider
        );

        const user = result.user;

        let username =
        (user.displayName || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]/g,"")
        .substring(0,15);

        if(username.length<3){

            username="user";

        }

        /*=========================
        Find Unique Username
        =========================*/

        let finalUsername=username;

        let count=1;

        while(true){

            const snap=

            await usernameRef(finalUsername)

            .once("value");

            if(!snap.exists()){

                break;

            }

            finalUsername=

            username+count;

            count++;

        }

        /*=========================
        Save Username
        =========================*/

        await safeWrite(

            "usernames/"+finalUsername,

            user.uid

        );

        /*=========================
        Save User
        =========================*/

        await safeWrite(

            "users/"+user.uid,

            {

                uid:user.uid,

                fullName:
                user.displayName||"",

                username:finalUsername,

                email:user.email,

                profilePhoto:
                user.photoURL||
                "assets/default-avatar.png",

                coverPhoto:
                "assets/default-banner.jpg",

                bio:"Welcome to Viewora 🚀",

                verified:false,

                emailVerified:true,

                followers:0,

                following:0,

                posts:0,

                videos:0,

                shorts:0,

                likes:0,

                online:true,

                accountType:"creator",

                createdAt:serverTime(),

                lastLogin:serverTime(),

                lastSeen:serverTime()

            }

        );

        hideLoading();

        showToast(

            "Google Signup Successful"

        );

        setTimeout(()=>{

            location.replace("index.html");

        },1000);

    }

    catch(error){

        hideLoading();

        console.error(error);

        showToast(

            error.message,

            "error"

        );

    }

});

/*=========================================
Open Mail
=========================================*/

openMailBtn?.addEventListener("click",()=>{

    window.open(

        "https://mail.google.com",

        "_blank"

    );

});

/*=========================================
Continue Button
=========================================*/

continueBtn?.addEventListener(

    "click",

    async()=>{

        const user=

        auth.currentUser;

        if(!user){

            showToast(

                "Login again",

                "error"

            );

            return;

        }

        await user.reload();

        if(user.emailVerified){

            await safeUpdate(

                "users/"+user.uid,

                {

                    emailVerified:true

                }

            );

            showToast(

                "Email Verified"

            );

            setTimeout(()=>{

                location.replace(

                    "login.html"

                );

            },1000);

        }else{

            showToast(

                "Please verify your email first",

                "error"

            );

        }

    }

);

/*=========================================
Rollback (Production Safety)
If signup fails after account creation,
delete the Firebase Auth user.
=========================================*/

async function rollbackSignup(){

    try{

        const user=

        auth.currentUser;

        if(user){

            await user.delete();

            console.log(

                "🗑️ Rollback Complete"

            );

        }

    }

    catch(error){

        console.error(

            "Rollback Failed:",

            error

        );

    }

}

console.log("✅ Signup Part 4 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            signup.js
            PART 5
 Default Profile • User Settings
 Followers • Notifications
 Database Structure
=========================================*/

/*=========================================
Create Default User Data
=========================================*/

async function createDefaultUser(uid,userData){

    try{

        /*=========================
        User Profile
        =========================*/

        await safeWrite(

            "users/"+uid,

            {

                uid:uid,

                fullName:userData.fullName,

                username:userData.username,

                email:userData.email,

                profilePhoto:
                "assets/default-avatar.png",

                coverPhoto:
                "assets/default-banner.jpg",

                bio:
                "Welcome to Viewora 🚀",

                verified:false,

                emailVerified:false,

                accountType:"creator",

                gender:"",

                website:"",

                location:"",

                followers:0,

                following:0,

                posts:0,

                videos:0,

                shorts:0,

                likes:0,

                views:0,

                subscribers:0,

                online:true,

                createdAt:serverTime(),

                lastLogin:serverTime(),

                lastSeen:serverTime()

            }

        );

        /*=========================
        User Settings
        =========================*/

        await safeWrite(

            "settings/"+uid,

            {

                theme:"dark",

                language:"en",

                autoplay:true,

                notifications:true,

                privateAccount:false,

                showEmail:false,

                showOnlineStatus:true,

                showFollowers:true,

                allowMessages:true,

                downloadQuality:"HD"

            }

        );

        /*=========================
        Followers
        =========================*/

        await safeWrite(

            "followers/"+uid,

            {}

        );

        /*=========================
        Following
        =========================*/

        await safeWrite(

            "following/"+uid,

            {}

        );

        /*=========================
        Notifications
        =========================*/

        await safeWrite(

            "notifications/"+uid,

            {}

        );

        /*=========================
        Saved Posts
        =========================*/

        await safeWrite(

            "savedPosts/"+uid,

            {}

        );

        /*=========================
        Watch History
        =========================*/

        await safeWrite(

            "history/"+uid,

            {}

        );

        /*=========================
        User Likes
        =========================*/

        await safeWrite(

            "likes/"+uid,

            {}

        );

        /*=========================
        Search History
        =========================*/

        await safeWrite(

            "searchHistory/"+uid,

            {}

        );

        console.log("✅ Default User Created");

        return true;

    }

    catch(error){

        console.error(error);

        return false;

    }

}

/*=========================================
Production Database Structure

users/
settings/
followers/
following/
notifications/
savedPosts/
history/
likes/
searchHistory/
posts/
videos/
shorts/
comments/
messages/
chatList/
calls/
story/
reports/
=========================================*/

/*=========================================
Global Export
=========================================*/

window.createDefaultUser =
createDefaultUser;

console.log("✅ Signup Part 5 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            signup.js
            PART 6
 Ripple Effects • Input Animations
 Auto Username • Live Form Events
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
Floating Labels
=========================================*/

document.querySelectorAll("input").forEach(input=>{

    function update(){

        if(input.value.trim()!==""){

            input.classList.add("filled");

        }else{

            input.classList.remove("filled");

        }

    }

    input.addEventListener("input",update);

    input.addEventListener("blur",update);

    update();

});

/*=========================================
Auto Username Formatter
=========================================*/

usernameInput?.addEventListener("input",()=>{

    let value=usernameInput.value
    .toLowerCase()
    .replace(/\s+/g,"")
    .replace(/^@/,"")
    .replace(/[^a-z0-9_]/g,"");

    if(value.length>20){

        value=value.substring(0,20);

    }

    usernameInput.value=value;

});

/*=========================================
Auto Email Formatter
=========================================*/

emailInput?.addEventListener("blur",()=>{

    emailInput.value=

    emailInput.value

    .trim()

    .toLowerCase();

});

/*=========================================
Auto Name Formatter
=========================================*/

nameInput?.addEventListener("blur",()=>{

    const words=

    nameInput.value

    .trim()

    .split(/\s+/)

    .map(word=>

        word.charAt(0).toUpperCase()+

        word.slice(1).toLowerCase()

    );

    nameInput.value=

    words.join(" ");

});

/*=========================================
Confirm Password Check
=========================================*/

confirmPasswordInput?.addEventListener(

    "input",

    ()=>{

        if(

            confirmPasswordInput.value==="" ||

            passwordInput.value===""

        ){

            return;

        }

        if(

            passwordInput.value===

            confirmPasswordInput.value

        ){

            confirmPasswordInput.style.borderColor=

            "#00d26a";

        }else{

            confirmPasswordInput.style.borderColor=

            "#ff4d4d";

        }

    }

);

/*=========================================
Enable / Disable Signup Button
=========================================*/

function updateSignupButton(){

    const ready=

    nameInput.value.trim()!=="" &&

    usernameInput.value.trim()!=="" &&

    emailInput.value.trim()!=="" &&

    passwordInput.value!=="" &&

    confirmPasswordInput.value!=="" &&

    acceptTerms.checked;

    signupBtn.disabled=!ready;

}

document.querySelectorAll(

    "#name,#username,#email,#password,#confirmPassword"

).forEach(input=>{

    input.addEventListener(

        "input",

        updateSignupButton

    );

});

acceptTerms?.addEventListener(

    "change",

    updateSignupButton

);

/*=========================================
Initial State
=========================================*/

updateSignupButton();

console.log("✅ Signup Part 6 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            signup.js
            PART 7
 Auth State • Network Status
 Cleanup • Production Security
=========================================*/

/*=========================================
Network Status
=========================================*/

function updateNetworkStatus(){

    if(navigator.onLine){

        showToast("Internet Connected");

    }else{

        showToast(
            "No Internet Connection",
            "error"
        );

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
Auth State
=========================================*/

auth.onAuthStateChanged(async(user)=>{

    if(!user){

        console.log("👤 User Signed Out");

        return;

    }

    try{

        await user.reload();

        await safeUpdate(

            "users/"+user.uid,

            {

                online:true,

                lastLogin:serverTime(),

                emailVerified:user.emailVerified

            }

        );

        console.log(

            "✅ Logged In:",

            user.email

        );

    }

    catch(error){

        console.error(error);

    }

});

/*=========================================
Email Verification Checker
=========================================*/

async function checkEmailVerification(){

    const user=auth.currentUser;

    if(!user) return false;

    await user.reload();

    if(user.emailVerified){

        await safeUpdate(

            "users/"+user.uid,

            {

                emailVerified:true

            }

        );

        return true;

    }

    return false;

}

/*=========================================
Auto Verification Check
=========================================*/

document.addEventListener(

    "visibilitychange",

    async()=>{

        if(document.visibilityState==="visible"){

            await checkEmailVerification();

        }

    }

);

/*=========================================
Before Unload
=========================================*/

window.addEventListener(

    "beforeunload",

    async()=>{

        const user=auth.currentUser;

        if(user){

            try{

                await safeUpdate(

                    "users/"+user.uid,

                    {

                        online:false,

                        lastSeen:serverTime()

                    }

                );

            }catch(error){

                console.error(error);

            }

        }

    }

);

/*=========================================
Security
=========================================*/

window.addEventListener(

    "contextmenu",

    e=>{

        e.preventDefault();

    }

);

window.addEventListener(

    "keydown",

    e=>{

        if(

            e.key==="F12" ||

            (e.ctrlKey && e.shiftKey &&
            ["I","J","C"].includes(e.key.toUpperCase())) ||

            (e.ctrlKey && e.key.toUpperCase()==="U")

        ){

            e.preventDefault();

        }

    }

);

/*=========================================
Cleanup
=========================================*/

window.addEventListener(

    "unload",

    ()=>{

        try{

            db.ref().off();

        }

        catch(error){

            console.error(error);

        }

    }

);

/*=========================================
Startup
=========================================*/

window.addEventListener("load",()=>{

    updateNetworkStatus();

    console.log("================================");
    console.log("🚀 VIEWORA SIGNUP");
    console.log("✅ Auth State Ready");
    console.log("✅ Network Ready");
    console.log("✅ Email Verification Ready");
    console.log("✅ Production Security Ready");
    console.log("================================");

});

console.log("✅ Signup Part 7 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            signup.js
            PART 8 FINAL
 Production Utilities • Auto Redirect
 Reset • Cleanup • Startup
=========================================*/

/*=========================================
Reset Signup Form
=========================================*/

function resetSignupForm(){

    signupForm?.reset();

    usernameAvailable=false;

    if(strengthFill){

        strengthFill.style.width="0%";

        strengthFill.style.background="#ff4d4d";

    }

    if(strengthText){

        strengthText.textContent=

        "Password Strength : Weak";

    }

    if(usernameStatus){

        usernameStatus.textContent=

        "Username must be unique";

        usernameStatus.style.color="#9fb7ff";

    }

    updateSignupButton();

}

/*=========================================
Prevent Double Submit
=========================================*/

signupForm?.addEventListener(

    "submit",

    ()=>{

        signupBtn.disabled=true;

        setTimeout(()=>{

            signupBtn.disabled=false;

        },3000);

    }

);

/*=========================================
Auto Redirect
=========================================*/

auth.onAuthStateChanged(async(user)=>{

    if(!user) return;

    try{

        await user.reload();

        if(user.emailVerified){

            await safeUpdate(

                "users/"+user.uid,

                {

                    emailVerified:true,

                    online:true,

                    lastLogin:serverTime()

                }

            );

            console.log("✅ Verified User");

        }

    }

    catch(error){

        console.error(error);

    }

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

window.addEventListener(

    "unload",

    ()=>{

        try{

            db.ref().off();

            clearTimeout(usernameTimer);

            clearTimeout(toastTimer);

        }

        catch(error){

            console.error(error);

        }

    }

);

/*=========================================
Global Utilities
=========================================*/

window.showLoading=showLoading;
window.hideLoading=hideLoading;
window.showToast=showToast;
window.resetSignupForm=resetSignupForm;
window.checkEmailVerification=checkEmailVerification;

/*=========================================
Final Startup
=========================================*/

(async()=>{

    try{

        hideLoading();

        updateSignupButton();

        console.log("================================");
        console.log("🚀 VIEWORA V10 PREMIUM");
        console.log("✅ Signup System Loaded");
        console.log("✅ Firebase Connected");
        console.log("✅ Username System Ready");
        console.log("✅ Email Verification Ready");
        console.log("✅ Google Signup Ready");
        console.log("✅ Production Ready");
        console.log("================================");

    }

    catch(error){

        console.error(error);

    }

})();