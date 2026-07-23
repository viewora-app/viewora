/*=========================================
        VIEWORA PROFILE V9
             PART 1
=========================================*/

"use strict";

/* ===========================
        Current User
=========================== */

let currentUser = null;
let currentUID = null;
let profileData = {};

/* ===========================
        DOM Elements
=========================== */

const app = document.getElementById("app");
const loader = document.getElementById("pageLoader");

const profilePic = document.getElementById("profilePic");
const coverPhoto = document.getElementById("coverPhoto");

const profileName = document.getElementById("profileName");
const profileUsername = document.getElementById("profileUsername");
const profileBio = document.getElementById("profileBio");

const verifiedBadge = document.getElementById("verifiedBadge");

const postsCount = document.getElementById("postsCount");
const followersCount = document.getElementById("followersCount");
const followingCount = document.getElementById("followingCount");
const videosCount = document.getElementById("videosCount");

const followBtn = document.getElementById("followBtn");
const messageBtn = document.getElementById("messageBtn");

const storyFile = document.getElementById("storyFile");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
const toastIcon = document.getElementById("toastIcon");

const scrollBtn = document.getElementById("scrollTopBtn");

/* ===========================
      Default Images
=========================== */

const DEFAULT_AVATAR =
"assets/default-avatar.png";

const DEFAULT_BANNER =
"assets/default-banner.jpg";

/* ===========================
      Loader
=========================== */

function hideLoader(){

setTimeout(()=>{

loader.classList.add("hidden");
app.classList.remove("hidden");
app.classList.add("fadeIn");

},700);

}

/* ===========================
      Toast
=========================== */

function showToast(message,success=true){

toast.classList.remove("hidden");

toastText.textContent = message;

toast.style.background =
success ? "#16a34a" : "#ef4444";

toastIcon.className =
success
?
"fa-solid fa-circle-check"
:
"fa-solid fa-circle-xmark";

setTimeout(()=>{

toast.classList.add("hidden");

},2500);

}

/* ===========================
      Number Format
=========================== */

function formatNumber(value){

value = Number(value||0);

if(value>=1000000){

return (value/1000000).toFixed(1)+"M";

}

if(value>=1000){

return (value/1000).toFixed(1)+"K";

}

return value;

}

/* ===========================
      Safe Text
=========================== */

function text(value,fallback=""){

return value ? value : fallback;

}

/* ===========================
      Scroll Button
=========================== */

window.addEventListener("scroll",()=>{

if(window.scrollY>400){

scrollBtn.classList.remove("hidden");

}else{

scrollBtn.classList.add("hidden");

}

});

scrollBtn?.addEventListener("click",()=>{

window.scrollTo({

top:0,
behavior:"smooth"

});

});

/* ===========================
    Firebase Auth State
=========================== */

auth.onAuthStateChanged(user=>{

if(!user){

location.href="login.html";
return;

}

currentUser = user;
currentUID = user.uid;

hideLoader();

/* Load profile in Part 2 */

});
/*=========================================
        VIEWORA PROFILE V9
             PART 2
=========================================*/

/* ===========================
      Load User Profile
=========================== */

function loadUserProfile(){

if(!currentUID) return;

db.ref("users/"+currentUID)
.on("value",snapshot=>{

if(!snapshot.exists()) return;

profileData=snapshot.val()||{};

/* ===========================
      Basic Information
=========================== */

profileName.textContent=
text(profileData.name,"Viewora User");

profileUsername.textContent=
"@"+text(profileData.username,"user");

profileBio.textContent=
text(
profileData.bio,
"Welcome to Viewora 🚀"
);

/* ===========================
      Profile Picture
=========================== */

profilePic.src=
profileData.photoURL ||
DEFAULT_AVATAR;

/* ===========================
      Banner
=========================== */

coverPhoto.src=
profileData.bannerURL ||
DEFAULT_BANNER;

/* ===========================
      Verified Badge
=========================== */

if(profileData.verified){

verifiedBadge.classList.remove("hidden");

}else{

verifiedBadge.classList.add("hidden");

}

/* ===========================
      Join Date
=========================== */

const join=document.getElementById("joinDate");

if(join){

if(profileData.createdAt){

const d=new Date(profileData.createdAt);

join.innerHTML=
`<i class="fa-solid fa-calendar"></i>
Joined ${d.getFullYear()}`;

}else{

join.innerHTML=
`<i class="fa-solid fa-calendar"></i>
Joined 2026`;

}

}

/* ===========================
      Location
=========================== */

const locationBox=
document.getElementById("profileLocation");

if(locationBox){

locationBox.innerHTML=

`<i class="fa-solid fa-location-dot"></i>
${text(profileData.location,"India")}`;

}

/* ===========================
      Stats
=========================== */

postsCount.textContent=
formatNumber(profileData.posts||0);

followersCount.textContent=
formatNumber(profileData.followers||0);

followingCount.textContent=
formatNumber(profileData.following||0);

videosCount.textContent=
formatNumber(profileData.videos||0);

});

}

/* ===========================
      Realtime Counts
=========================== */

function loadRealtimeCounts(){

db.ref("followers/"+currentUID)
.on("value",snap=>{

followersCount.textContent=
formatNumber(snap.numChildren());

});

db.ref("following/"+currentUID)
.on("value",snap=>{

followingCount.textContent=
formatNumber(snap.numChildren());

});

db.ref("posts")
.orderByChild("uid")
.equalTo(currentUID)
.on("value",snap=>{

postsCount.textContent=
formatNumber(snap.numChildren());

});

db.ref("videos")
.orderByChild("uid")
.equalTo(currentUID)
.on("value",snap=>{

videosCount.textContent=
formatNumber(snap.numChildren());

});

}

/* ===========================
      Start Loading
=========================== */

auth.onAuthStateChanged(user=>{

if(!user) return;

currentUID=user.uid;

loadUserProfile();

loadRealtimeCounts();

});
/*=========================================
        VIEWORA PROFILE V9
             PART 3
 Profile Photo • Banner • Story Upload
=========================================*/

/* ===========================
      Profile Photo Upload
=========================== */

const profileInput=document.createElement("input");

profileInput.type="file";
profileInput.accept="image/*";

profilePic?.addEventListener("click",()=>{

profileInput.click();

});

profileInput.addEventListener("change",e=>{

const file=e.target.files[0];

if(!file) return;

uploadProfilePhoto(file);

});

async function uploadProfilePhoto(file){

try{

showToast("Uploading profile...",true);

const ref=storage
.ref("profilePhotos/"+currentUID);

await ref.put(file);

const url=await ref.getDownloadURL();

await db.ref("users/"+currentUID).update({

photoURL:url

});

profilePic.src=url;

showToast("Profile updated");

}catch(err){

console.error(err);

showToast("Upload failed",false);

}

}

/* ===========================
      Cover Banner Upload
=========================== */

const bannerInput=document.createElement("input");

bannerInput.type="file";
bannerInput.accept="image/*";

coverPhoto?.addEventListener("click",()=>{

bannerInput.click();

});

bannerInput.addEventListener("change",e=>{

const file=e.target.files[0];

if(!file) return;

uploadBanner(file);

});

async function uploadBanner(file){

try{

showToast("Uploading banner...",true);

const ref=storage
.ref("profileBanner/"+currentUID);

await ref.put(file);

const url=await ref.getDownloadURL();

await db.ref("users/"+currentUID).update({

bannerURL:url

});

coverPhoto.src=url;

showToast("Banner updated");

}catch(err){

console.error(err);

showToast("Upload failed",false);

}

}

/* ===========================
      Story Upload
=========================== */

function createStory(){

storyFile.click();

}

storyFile?.addEventListener("change",e=>{

const file=e.target.files[0];

if(!file) return;

uploadStory(file);

});

async function uploadStory(file){

try{

showToast("Uploading story...",true);

const id=Date.now();

const ref=storage.ref(
"stories/"+currentUID+"/"+id
);

await ref.put(file);

const url=await ref.getDownloadURL();

await db.ref(
"stories/"+currentUID+"/"+id
).set({

uid:currentUID,

url:url,

type:file.type.startsWith("video")
?"video":"image",

createdAt:Date.now(),

expiresAt:Date.now()+86400000

});

showToast("Story uploaded");

}catch(err){

console.error(err);

showToast("Story upload failed",false);

}

}

/* ===========================
      Image Viewer
=========================== */

const imageViewer=
document.getElementById("imageViewer");

const viewerImage=
document.getElementById("viewerImage");

const closeViewer=
document.getElementById("closeViewer");

profilePic?.addEventListener("dblclick",()=>{

viewerImage.src=profilePic.src;

imageViewer.classList.remove("hidden");

});

coverPhoto?.addEventListener("dblclick",()=>{

viewerImage.src=coverPhoto.src;

imageViewer.classList.remove("hidden");

});

closeViewer?.addEventListener("click",()=>{

imageViewer.classList.add("hidden");

});

imageViewer?.addEventListener("click",e=>{

if(e.target===imageViewer){

imageViewer.classList.add("hidden");

}

});
/*=========================================
        VIEWORA PROFILE V9
             PART 4
 Follow • Message • Share • Tabs • Content
=========================================*/

/* ===========================
      Follow / Unfollow
=========================== */

let isFollowing = false;

function checkFollowStatus(profileUID){

if(!profileUID || profileUID===currentUID){

followBtn.style.display="none";
return;

}

db.ref("following/"+currentUID+"/"+profileUID)
.on("value",snap=>{

isFollowing=snap.exists();

updateFollowButton();

});

}

function updateFollowButton(){

if(isFollowing){

followBtn.innerHTML=`
<i class="fa-solid fa-user-check"></i>
Following`;

followBtn.classList.add("following");

}else{

followBtn.innerHTML=`
<i class="fa-solid fa-user-plus"></i>
Follow`;

followBtn.classList.remove("following");

}

}

followBtn?.addEventListener("click",async()=>{

const profileUID=
profileData.uid || currentUID;

if(profileUID===currentUID) return;

try{

if(isFollowing){

await db.ref(
"following/"+currentUID+"/"+profileUID
).remove();

await db.ref(
"followers/"+profileUID+"/"+currentUID
).remove();

showToast("Unfollowed");

}else{

await db.ref(
"following/"+currentUID+"/"+profileUID
).set(true);

await db.ref(
"followers/"+profileUID+"/"+currentUID
).set(true);

showToast("Following");

}

}catch(err){

console.error(err);

showToast("Action failed",false);

}

});

/* ===========================
      Message Button
=========================== */

messageBtn?.addEventListener("click",()=>{

const profileUID=
profileData.uid || currentUID;

if(profileUID===currentUID){

location.href="messages.html";

}else{

location.href=
`chat.html?uid=${profileUID}`;

}

});

/* ===========================
      Share Profile
=========================== */

const shareBtn=
document.querySelector(".shareBtn");

shareBtn?.addEventListener("click",async()=>{

const shareURL=
location.origin+
"/profile.html?uid="+
(currentUID);

if(navigator.share){

try{

await navigator.share({

title:profileData.name,

text:"Check out my Viewora profile",

url:shareURL

});

}catch(e){}

}else{

navigator.clipboard.writeText(shareURL);

showToast("Profile link copied");

}

});

/* ===========================
      Tabs
=========================== */

const tabs=
document.querySelectorAll(".tabBtn");

const contents=
document.querySelectorAll(".tabContent");

tabs.forEach(tab=>{

tab.addEventListener("click",()=>{

tabs.forEach(t=>
t.classList.remove("active"));

contents.forEach(c=>
c.classList.remove("active"));

tab.classList.add("active");

const id=
tab.dataset.tab+"Tab";

document
.getElementById(id)
.classList.add("active");

});

});

/* ===========================
      Videos
=========================== */

function loadVideos(){

const list=
document.getElementById("videosList");

db.ref("videos")
.orderByChild("uid")
.equalTo(currentUID)
.on("value",snap=>{

list.innerHTML="";

snap.forEach(item=>{

const v=item.val();

list.innerHTML+=`

<div class="videoCard">

<div class="videoThumb">

<img src="${
v.thumbnail ||
DEFAULT_BANNER
}">

<div class="playIcon">

<i class="fa-solid fa-play"></i>

</div>

</div>

<div class="videoInfo">

<h3 class="videoTitle">

${text(v.title,"Untitled")}

</h3>

<p class="videoDesc">

${text(v.description,"")}

</p>

</div>

</div>

`;

});

});

}

/* ===========================
      Posts
=========================== */

function loadPosts(){

const list=
document.getElementById("postsList");

db.ref("posts")
.orderByChild("uid")
.equalTo(currentUID)
.on("value",snap=>{

list.innerHTML="";

snap.forEach(item=>{

const p=item.val();

list.innerHTML+=`

<div class="postCard">

<img src="${
p.image ||
DEFAULT_BANNER
}">

<div class="postInfo">

<div class="postTitle">

${text(p.title,"Post")}

</div>

<div class="postMeta">

<span>

❤️ ${p.likes||0}

</span>

<span>

💬 ${p.comments||0}

</span>

</div>

</div>

</div>

`;

});

});

}

/* ===========================
      Shorts
=========================== */

function loadShorts(){

const list=
document.getElementById("shortsList");

db.ref("shorts")
.orderByChild("uid")
.equalTo(currentUID)
.on("value",snap=>{

list.innerHTML="";

snap.forEach(item=>{

const s=item.val();

list.innerHTML+=`

<div class="shortCard">

<img src="${
s.thumbnail ||
DEFAULT_BANNER
}">

<div class="shortOverlay">

<div class="shortTitle">

${text(s.title,"Short")}

</div>

</div>

</div>

`;

});

});

}

/* ===========================
      Initialize
=========================== */

auth.onAuthStateChanged(user=>{

if(!user) return;

currentUID=user.uid;

loadVideos();

loadPosts();

loadShorts();

checkFollowStatus(currentUID);

});
/*=========================================
        VIEWORA PROFILE V9
             PART 5
 Saved • Online • Scroll • Logout
=========================================*/

/* ===========================
      Saved Posts
=========================== */

function loadSavedPosts(){

const list=document.getElementById("savedList");

if(!list) return;

db.ref("saved/"+currentUID)
.on("value",snap=>{

list.innerHTML="";

if(!snap.exists()){

list.innerHTML=`

<div class="emptyState">

<i class="fa-solid fa-bookmark"></i>

<h3>No Saved Posts</h3>

<p>Save posts to view them here.</p>

</div>

`;

return;

}

snap.forEach(item=>{

const post=item.val();

list.innerHTML+=`

<div class="savedCard">

<img src="${post.image || DEFAULT_BANNER}">

<div class="savedInfo">

<h3>${text(post.title,"Saved Post")}</h3>

<p>${text(post.creator,"Unknown")}</p>

</div>

</div>

`;

});

});

}

/* ===========================
      Online Status
=========================== */

const onlineRef=
db.ref("status/"+currentUID);

firebase.database()
.ref(".info/connected")
.on("value",snap=>{

if(snap.val()){

onlineRef.set({

online:true,

lastSeen:firebase.database.ServerValue.TIMESTAMP

});

onlineRef.onDisconnect().set({

online:false,

lastSeen:firebase.database.ServerValue.TIMESTAMP

});

}

});

/* ===========================
      Offline / Online Toast
=========================== */

window.addEventListener("offline",()=>{

showToast("No Internet Connection",false);

});

window.addEventListener("online",()=>{

showToast("Back Online");

});

/* ===========================
      Scroll Animation
=========================== */

window.addEventListener("scroll",()=>{

document
.querySelectorAll(".videoCard,.postCard,.shortCard,.savedCard")
.forEach(card=>{

const top=
card.getBoundingClientRect().top;

if(top<window.innerHeight-80){

card.classList.add("fadeIn");

}

});

});

/* ===========================
      Ripple Effect
=========================== */

document
.querySelectorAll("button")
.forEach(btn=>{

btn.addEventListener("click",e=>{

const ripple=
document.createElement("span");

ripple.className="ripple";

const rect=
btn.getBoundingClientRect();

ripple.style.left=
(e.clientX-rect.left)+"px";

ripple.style.top=
(e.clientY-rect.top)+"px";

btn.appendChild(ripple);

setTimeout(()=>{

ripple.remove();

},600);

});

});

/* ===========================
      Logout
=========================== */

function logout(){

if(!confirm("Logout from Viewora?"))
return;

auth.signOut()

.then(()=>{

showToast("Logged Out");

setTimeout(()=>{

location.href="login.html";

},700);

})

.catch(()=>{

showToast("Logout Failed",false);

});

}

/* ===========================
      Settings Button
=========================== */

document
.querySelector(".settingsBtn")
?.addEventListener("click",()=>{

location.href="settings.html";

});

/* ===========================
      Start
=========================== */

auth.onAuthStateChanged(user=>{

if(!user) return;

currentUID=user.uid;

loadSavedPosts();

});
/*=========================================
        VIEWORA PROFILE V9
             PART 6
 Premium • Performance • Init
=========================================*/

/* ===========================
      Share Profile
=========================== */

function shareProfile(){

const url=location.href;

if(navigator.share){

navigator.share({

title:"Viewora Profile",

text:"Check out my Viewora profile!",

url:url

}).catch(()=>{});

}else{

navigator.clipboard.writeText(url);

showToast("Profile link copied");

}

}

/* ===========================
      Pull To Refresh
=========================== */

let startY=0;

window.addEventListener("touchstart",e=>{

startY=e.touches[0].clientY;

});

window.addEventListener("touchend",e=>{

const endY=e.changedTouches[0].clientY;

if(window.scrollY===0 && endY-startY>120){

location.reload();

}

});

/* ===========================
      Lazy Images
=========================== */

document.querySelectorAll("img").forEach(img=>{

img.loading="lazy";

img.decoding="async";

});

/* ===========================
      Keyboard Shortcuts
=========================== */

document.addEventListener("keydown",e=>{

if(e.key==="Home"){

window.scrollTo({

top:0,

behavior:"smooth"

});

}

if(e.key==="Escape"){

document
.getElementById("imageViewer")
?.classList.add("hidden");

}

});

/* ===========================
      Profile Search
=========================== */

function searchProfile(keyword){

keyword=keyword.toLowerCase();

document
.querySelectorAll(".videoCard,.postCard,.savedCard")
.forEach(card=>{

const text=card.innerText.toLowerCase();

card.style.display=

text.includes(keyword)

?

"block"

:

"none";

});

}

/* ===========================
      Performance
=========================== */

window.addEventListener("load",()=>{

document.body.classList.add("loaded");

});

/* ===========================
      Network Monitor
=========================== */

setInterval(()=>{

db.ref("status/"+currentUID).update({

lastActive:firebase.database.ServerValue.TIMESTAMP

});

},60000);

/* ===========================
      Premium Animations
=========================== */

document
.querySelectorAll(".profileCard,.videoCard,.postCard")
.forEach(card=>{

card.addEventListener("mouseenter",()=>{

card.style.transform="translateY(-5px)";

});

card.addEventListener("mouseleave",()=>{

card.style.transform="";

});

});

/* ===========================
      Final Initialize
=========================== */

window.addEventListener("load",()=>{

hideLoader();

loadUserProfile();

loadRealtimeCounts();

loadVideos();

loadPosts();

loadShorts();

loadSavedPosts();

showToast("Welcome to Viewora");

});

console.log(
"%cViewora Profile V9 Loaded",
"color:#6366f1;font-size:16px;font-weight:bold;"
);
/*=========================================
        VIEWORA PROFILE V9
             PART 7
 Story • Verification • Cleanup
=========================================*/

/* ===========================
      Story Highlights
=========================== */

function loadStoryHighlights(){

const container=document.querySelector(".storiesWrapper");

if(!container) return;

db.ref("stories/"+currentUID)
.orderByChild("createdAt")
.limitToLast(20)
.on("value",snap=>{

container.innerHTML="";

if(!snap.exists()){

container.innerHTML=`
<div class="storyItem">
<div class="storyCircle addStory">
<i class="fa-solid fa-plus"></i>
</div>
<p>New</p>
</div>`;
return;

}

snap.forEach(item=>{

const story=item.val();

container.innerHTML+=`

<div class="storyItem">

<div class="storyCircle">

<img src="${story.url}">

</div>

<p>Story</p>

</div>

`;

});

});

}

/* ===========================
      Followers Popup
=========================== */

function showFollowers(type){

location.href=
`${type}.html?uid=${currentUID}`;

}

/* ===========================
      Verification
=========================== */

function checkVerification(){

db.ref("users/"+currentUID+"/verified")

.on("value",snap=>{

if(snap.val()){

verifiedBadge.classList.remove("hidden");

}else{

verifiedBadge.classList.add("hidden");

}

});

}

/* ===========================
      Compress Image
=========================== */

function compressImage(file,callback){

const reader=new FileReader();

reader.onload=e=>{

const img=new Image();

img.onload=()=>{

const canvas=
document.createElement("canvas");

const ctx=
canvas.getContext("2d");

const max=1200;

let w=img.width;
let h=img.height;

if(w>max){

h*=max/w;
w=max;

}

canvas.width=w;
canvas.height=h;

ctx.drawImage(img,0,0,w,h);

canvas.toBlob(blob=>{

callback(blob);

},"image/jpeg",0.85);

};

img.src=e.target.result;

};

reader.readAsDataURL(file);

}

/* ===========================
      Auto Refresh
=========================== */

setInterval(()=>{

loadRealtimeCounts();

},30000);

/* ===========================
      Cleanup
=========================== */

window.addEventListener("beforeunload",()=>{

db.ref("status/"+currentUID).update({

online:false,

lastSeen:
firebase.database.ServerValue.TIMESTAMP

});

});

/* ===========================
      Error Handler
=========================== */

window.onerror=function(){

showToast("Unexpected Error",false);

return false;

};

/* ===========================
      Start Part 7
=========================== */

window.addEventListener("load",()=>{

loadStoryHighlights();

checkVerification();

});
/*=========================================
        VIEWORA PROFILE V9
             PART 8
      Final Features & Optimization
=========================================*/

/* ===========================
      Theme Preference
=========================== */

const savedTheme = localStorage.getItem("viewora-theme");

if(savedTheme){

document.body.setAttribute("data-theme",savedTheme);

}

/* ===========================
      Notification Badge
=========================== */

function updateNotificationBadge(){

const badge=document.getElementById("notificationBadge");

if(!badge) return;

db.ref("notifications/"+currentUID)
.orderByChild("read")
.equalTo(false)
.on("value",snap=>{

const count=snap.numChildren();

if(count>0){

badge.textContent=count>99?"99+":count;

badge.classList.remove("hidden");

}else{

badge.classList.add("hidden");

}

});

}

/* ===========================
      Profile Cache
=========================== */

function saveProfileCache(){

localStorage.setItem(

"viewora-profile",

JSON.stringify(profileData)

);

}

function loadProfileCache(){

const cache=

localStorage.getItem("viewora-profile");

if(!cache) return;

try{

const data=JSON.parse(cache);

profileName.textContent=data.name||"";

profileUsername.textContent="@"+(data.username||"");

profileBio.textContent=data.bio||"";

profilePic.src=data.photoURL||DEFAULT_AVATAR;

coverPhoto.src=data.bannerURL||DEFAULT_BANNER;

}catch(e){}

}

/* ===========================
      Auto Save Cache
=========================== */

setInterval(()=>{

saveProfileCache();

},10000);

/* ===========================
      Smooth Card Animation
=========================== */

const observer=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add("fadeIn");

}

});

},{

threshold:.2

});

document.querySelectorAll(

".videoCard,.postCard,.savedCard,.shortCard"

).forEach(card=>{

observer.observe(card);

});

/* ===========================
      Image Error Fallback
=========================== */

document.querySelectorAll("img")

.forEach(img=>{

img.onerror=()=>{

img.src=DEFAULT_AVATAR;

};

});

/* ===========================
      App Visibility
=========================== */

document.addEventListener(

"visibilitychange",

()=>{

if(document.hidden){

db.ref("status/"+currentUID)

.update({

online:false

});

}else{

db.ref("status/"+currentUID)

.update({

online:true,

lastSeen:

firebase.database.ServerValue.TIMESTAMP

});

}

});

/* ===========================
      Welcome Animation
=========================== */

window.addEventListener("load",()=>{

setTimeout(()=>{

document.body.classList.add("loaded");

},300);

});

/* ===========================
      Version
=========================== */

const PROFILE_VERSION="Viewora V9 Premium";

console.log(PROFILE_VERSION);

/* ===========================
      Initialize Everything
=========================== */

window.addEventListener("load",()=>{

loadProfileCache();

updateNotificationBadge();

showToast("Profile Ready");

});

/* ===========================
      Performance Cleanup
=========================== */

window.addEventListener("beforeunload",()=>{

observer.disconnect();

});

/* ===========================
      End of File
=========================== */

console.log(

"%c✔ Viewora Profile.js V9 Loaded Successfully",

"color:#00aaff;font-size:16px;font-weight:bold;"

);