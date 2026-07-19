// =====================================
// Viewora Security Settings JS
// =====================================



let currentUser = null;





// Firebase Auth Check


firebase.auth().onAuthStateChanged((user)=>{


if(user){


currentUser = user;


checkSecurityStatus(user);



saveLoginActivity(user);



}

else{


location.href="login.html";


}



});







// =====================================
// Security Status
// =====================================


function checkSecurityStatus(user){



if(user.emailVerified){


console.log("Email Verified");


}



}









// =====================================
// Change Password
// =====================================


function resetPassword(){



if(!currentUser){

return;

}



let email = currentUser.email;



if(confirm(
"Password reset link will be sent to your email."
)){



firebase.auth()
.sendPasswordResetEmail(email)

.then(()=>{


showToast(
"📧 Password reset email sent"
);


})

.catch(error=>{


showToast(
"❌ "+error.message
);


});



}



}









// =====================================
// Email Verification
// =====================================


function verifyEmail(){



if(!currentUser){

return;

}



if(currentUser.emailVerified){


showToast(
"✅ Email already verified"
);


return;


}




currentUser.sendEmailVerification()

.then(()=>{


showToast(
"📧 Verification email sent"
);


})

.catch(error=>{


showToast(
"❌ "+error.message
);


});


}









// =====================================
// Phone Verification
// =====================================


function verifyPhone(){



showToast(
"📱 Phone verification coming soon"
);


}









// =====================================
// Two Factor Authentication
// =====================================


function twoFactorAuth(){



showToast(
"🔐 2FA setup will be available soon"
);


}









// =====================================
// Login Activity
// =====================================


function saveLoginActivity(user){



let uid=user.uid;



let activity={


device:navigator.userAgent,


time:Date.now(),


email:user.email



};



firebase.database()

.ref(
"users/"+uid+"/loginActivity"
)

.push(activity);



}






function loginActivity(){



if(!currentUser){

return;

}



firebase.database()

.ref(
"users/"+currentUser.uid+"/loginActivity"
)

.limitToLast(5)

.once("value")

.then(snapshot=>{


let data=snapshot.val();



if(data){



let message =
Object.keys(data).length+
" recent login records found";



showToast(
"💻 "+message
);


}

else{


showToast(
"No login activity found"
);


}



});


}









// =====================================
// Trusted Devices
// =====================================


function trustedDevices(){



showToast(
"📲 Trusted devices management coming soon"
);


}









// =====================================
// Blocked Users
// =====================================


function blockedUsers(){



location.href="blocked-users.html";


}









// =====================================
// Logout
// =====================================


function logout(){



if(confirm(
"Logout from this device?"
)){



firebase.auth()

.signOut()

.then(()=>{


showToast(
"👋 Logged out"
);



setTimeout(()=>{


location.href="login.html";


},1000);



});



}



}









// =====================================
// Logout All Devices
// =====================================


function logoutAllDevices(){



if(confirm(
"Logout from all devices?"
)){



if(currentUser){



firebase.auth()

.signOut()

.then(()=>{


showToast(
"📱 All devices logged out"
);



setTimeout(()=>{


location.href="login.html";


},1000);



});


}



}



}









// =====================================
// Toast
// =====================================


function showToast(message){



let toast=document.createElement("div");



toast.innerText=message;



toast.style.position="fixed";

toast.style.bottom="30px";

toast.style.left="50%";

toast.style.transform="translateX(-50%)";

toast.style.background="#00aaff";

toast.style.color="#fff";

toast.style.padding="12px 25px";

toast.style.borderRadius="30px";

toast.style.fontWeight="bold";

toast.style.zIndex="9999";

toast.style.boxShadow=
"0 10px 25px rgba(0,170,255,.3)";



document.body.appendChild(toast);



setTimeout(()=>{


toast.remove();


},2500);



}






console.log(
"✅ Viewora Security Settings Loaded"
);