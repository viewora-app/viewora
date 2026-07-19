// =====================================
// Viewora Privacy Settings JS
// =====================================


let currentUser = null;



const defaultPrivacy = {

    privateAccount:false,

    profileVisibility:"everyone",

    onlineStatus:true,

    readReceipts:true,

    lastSeen:"everyone",

    locationSharing:false,

    storyPrivacy:"everyone",

    messagePrivacy:"everyone",

    commentPrivacy:"everyone"

};








// =====================================
// Firebase Auth Check
// =====================================


firebase.auth().onAuthStateChanged((user)=>{


if(user){


currentUser = user;


loadProfile(user);


loadPrivacySettings(user.uid);


}

else{


window.location.href="login.html";


}


});









// =====================================
// Load Profile
// =====================================


function loadProfile(user){



if(user.photoURL){


document.getElementById("profilePhoto").src=user.photoURL;


}



document.getElementById("profileName").innerText =

user.displayName || "Viewora User";



document.getElementById("profileUsername").innerText =

"@"+(
user.email
?
user.email.split("@")[0]
:
"username"
);



}









// =====================================
// Load Privacy Settings
// =====================================


function loadPrivacySettings(uid){



firebase.database()

.ref("users/"+uid+"/privacy")

.once("value")

.then(snapshot=>{


let data=snapshot.val();



if(!data){


data=defaultPrivacy;


}



applySettings(data);



});


}








// =====================================
// Apply Settings To UI
// =====================================


function applySettings(data){



document.getElementById("privateAccount").checked =
data.privateAccount;



document.getElementById("onlineStatus").checked =
data.onlineStatus;



document.getElementById("readReceipts").checked =
data.readReceipts;



document.getElementById("locationSharing").checked =
data.locationSharing;





document.getElementById("profileVisibility").value =
data.profileVisibility;



document.getElementById("lastSeen").value =
data.lastSeen;



document.getElementById("storyPrivacy").value =
data.storyPrivacy;



document.getElementById("messagePrivacy").value =
data.messagePrivacy;



document.getElementById("commentPrivacy").value =
data.commentPrivacy;



}









// =====================================
// Save Privacy
// =====================================


function savePrivacySettings(){



if(!currentUser){

return;

}



let privacyData = {


privateAccount:

document.getElementById("privateAccount").checked,



profileVisibility:

document.getElementById("profileVisibility").value,



onlineStatus:

document.getElementById("onlineStatus").checked,



readReceipts:

document.getElementById("readReceipts").checked,



lastSeen:

document.getElementById("lastSeen").value,



locationSharing:

document.getElementById("locationSharing").checked,



storyPrivacy:

document.getElementById("storyPrivacy").value,



messagePrivacy:

document.getElementById("messagePrivacy").value,



commentPrivacy:

document.getElementById("commentPrivacy").value



};





firebase.database()

.ref(
"users/"+currentUser.uid+"/privacy"
)

.set(privacyData)

.then(()=>{


showToast(
"✅ Privacy settings saved"
);



})

.catch(error=>{


showToast(
"❌ "+error.message
);



});



}









// =====================================
// Reset Privacy
// =====================================


function resetPrivacySettings(){



if(confirm(
"Reset all privacy settings?"
)){



applySettings(defaultPrivacy);



showToast(
"🔄 Privacy reset"
);



}



}









// =====================================
// Blocked Users
// =====================================


function openBlockedUsers(){


window.location.href="blocked-users.html";


}









// =====================================
// Download User Data
// =====================================


function downloadMyData(){



if(!currentUser){

return;

}



firebase.database()

.ref("users/"+currentUser.uid)

.once("value")

.then(snapshot=>{


let data=snapshot.val();



let file = new Blob(

[
JSON.stringify(data,null,2)
],

{
type:"application/json"
}

);



let url =
URL.createObjectURL(file);



let a =
document.createElement("a");



a.href=url;


a.download="Viewora-Data.json";


a.click();



URL.revokeObjectURL(url);



showToast(
"📥 Data downloaded"
);



});



}









// =====================================
// Delete Data
// =====================================


function deleteMyData(){



if(!currentUser){

return;

}



let confirmDelete = confirm(

"Delete all Viewora data permanently?"

);



if(confirmDelete){



firebase.database()

.ref("users/"+currentUser.uid)

.remove()

.then(()=>{


showToast(
"🗑 Data deleted"
);



});



}



}









// =====================================
// Back Button
// =====================================


function goBackSettings(){


window.location.href="settings.html";


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

"0 10px 25px rgba(0,170,255,.35)";



document.body.appendChild(toast);



setTimeout(()=>{


toast.remove();


},2500);



}








// =====================================
// Internet Status
// =====================================


window.addEventListener("online",()=>{


showToast(
"🌐 Internet Connected"
);


});



window.addEventListener("offline",()=>{


showToast(
"📡 No Internet Connection"
);


});






console.log(
"🔒 Viewora Privacy Settings Loaded"
);