/*=========================================
        VIEWORA USERS V7
        users.js (PART 1)
        Firebase Initialization
=========================================*/

//==============================
// Firebase References
//==========

//==============================
// DOM Elements
//==============================

const pageLoader = document.getElementById("pageLoader");
const app = document.getElementById("app");

const usersList = document.getElementById("usersList");
const suggestedUsers = document.getElementById("suggestedUsers");
const onlineUsers = document.getElementById("onlineUsers");

const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");

const totalUsers = document.getElementById("totalUsers");
const onlineCount = document.getElementById("onlineCount");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
const toastIcon = document.getElementById("toastIcon");

const emptyState = document.getElementById("emptyState");

const skeleton = document.getElementById("usersSkeleton");

const scrollTopBtn = document.getElementById("scrollTopBtn");

const profileModal = document.getElementById("profileModal");

//==============================
// Variables
//==============================

let currentUser = null;

let users = [];

let filteredUsers = [];

let following = [];

let onlineUsersList = [];

//==============================
// Authentication
//==============================

auth.onAuthStateChanged(user=>{

if(!user){

location.href="login.html";

return;

}

currentUser=user;

loadCurrentUser();

loadUsers();

listenOnlineUsers();

});

//==============================
// Current User
//==============================

function loadCurrentUser(){

db.ref("users/"+currentUser.uid)

.once("value")

.then(snapshot=>{

const data=snapshot.val();

if(!data)return;

following=data.following || [];

});

}

//==============================
// Show Loader
//==============================

function showLoader(){

pageLoader.classList.remove("hidden");

app.classList.add("hidden");

}

//==============================
// Hide Loader
//==============================

function hideLoader(){

setTimeout(()=>{

pageLoader.classList.add("hidden");

app.classList.remove("hidden");

app.classList.add("fadeIn");

},700);

}

//==============================
// Toast
//==============================

function showToast(text,success=true){

toastText.textContent=text;

toastIcon.className=success
?
"fa-solid fa-circle-check"
:
"fa-solid fa-circle-xmark";

toast.style.background=
success
?
"#16a34a"
:
"#dc2626";

toast.classList.remove("hidden");

setTimeout(()=>{

toast.classList.add("hidden");

},2500);

}

//==============================
// Number Formatter
//==============================

function formatNumber(num){

if(num>=1000000){

return (num/1000000).toFixed(1)+"M";

}

if(num>=1000){

return (num/1000).toFixed(1)+"K";

}

return num;

}

//==============================
// Avatar
//==============================

function avatar(url){

return url || "assets/default-avatar.png";

}

//==============================
// Random Suggestions
//==============================

function shuffle(array){

return [...array]

.sort(()=>Math.random()-0.5);

}
/*=========================================
        USERS.JS PART 2
        Load Users + Search + Render
=========================================*/

//==============================
// Load All Users
//==============================

function loadUsers(){

showLoader();

db.ref("users").on("value",snapshot=>{

users=[];

snapshot.forEach(child=>{

const user=child.val();

user.uid=child.key;

// Skip current user
if(user.uid===currentUser.uid) return;

users.push(user);

});

filteredUsers=[...users];

renderSuggestedUsers();

renderUsers(filteredUsers);

updateCounters();

hideLoader();

});

}

//==============================
// Update Counters
//==============================

function updateCounters(){

totalUsers.textContent=
users.length+" Users";

onlineCount.textContent=
onlineUsersList.length+" Online";

}

//==============================
// Live Search
//==============================

searchInput.addEventListener("input",()=>{

const keyword=
searchInput.value
.trim()
.toLowerCase();

if(keyword===""){

filteredUsers=[...users];

}else{

filteredUsers=users.filter(user=>{

const name=
(user.name||"")
.toLowerCase();

const username=
(user.username||"")
.toLowerCase();

const bio=
(user.bio||"")
.toLowerCase();

return(

name.includes(keyword) ||

username.includes(keyword) ||

bio.includes(keyword)

);

});

}

renderUsers(filteredUsers);

});

//==============================
// Clear Search
//==============================

clearSearch.onclick=()=>{

searchInput.value="";

filteredUsers=[...users];

renderUsers(filteredUsers);

};

//==============================
// Suggested Users
//==============================

function renderSuggestedUsers(){

suggestedUsers.innerHTML="";

const randomUsers=
shuffle(users)
.slice(0,8);

randomUsers.forEach(user=>{

suggestedUsers.innerHTML+=`

<div class="suggestCard fadeIn">

<img src="${avatar(user.photoURL)}">

<h4>

${user.name||"Unknown"}

${user.verified?'<i class="fa-solid fa-circle-check"></i>':''}

</h4>

<p>

@${user.username||"user"}

</p>

<button

onclick="followUser('${user.uid}')">

Follow

</button>

</div>

`;

});

}

//==============================
// Render Users
//==============================

function renderUsers(data){

usersList.innerHTML="";

if(data.length===0){

emptyState.classList.remove("hidden");

return;

}

emptyState.classList.add("hidden");

data.forEach(user=>{

const isFollowing=
following.includes(user.uid);

usersList.innerHTML+=`

<div

class="userCard"

onclick="openProfile('${user.uid}')">

<img src="${avatar(user.photoURL)}">

<div class="userInfo">

<h4>

${user.name||"Unknown"}

${user.verified?

'<i class="fa-solid fa-circle-check"></i>'

:''}

</h4>

<p>

@${user.username||"user"}

</p>

<div class="userStats">

<span>

${formatNumber(user.followers||0)}

Followers

</span>

<span>

${formatNumber(user.posts||0)}

Posts

</span>

</div>

</div>

<button

class="followBtn"

onclick="event.stopPropagation();

followUser('${user.uid}')">

${isFollowing

?

"Following"

:

"Follow"

}

</button>

</div>

`;

});

}
/*=========================================
        USERS.JS PART 3
  Online Users • Follow System • Modal
=========================================*/

//==============================
// Listen Online Users
//==============================

function listenOnlineUsers(){

db.ref("users").on("value",snapshot=>{

onlineUsers.innerHTML="";

onlineUsersList=[];

snapshot.forEach(child=>{

const user=child.val();
user.uid=child.key;

if(user.uid===currentUser.uid) return;

if(user.online){

onlineUsersList.push(user);

onlineUsers.innerHTML+=`

<div
class="onlineUser"
onclick="openProfile('${user.uid}')">

<img src="${avatar(user.photoURL)}">

<div class="onlineDot"></div>

<h5>

${user.name||"User"}

</h5>

</div>

`;

}

});

updateCounters();

});

}

//==============================
// Follow User
//==============================

async function followUser(uid){

if(uid===currentUser.uid) return;

const ref=db.ref("users/"+currentUser.uid);

const target=db.ref("users/"+uid);

const snap=await ref.once("value");

const me=snap.val();

let list=me.following||[];

if(list.includes(uid)){

list=list.filter(id=>id!==uid);

await ref.update({

following:list

});

const targetSnap=
await target.once("value");

const targetUser=
targetSnap.val();

await target.update({

followers:
Math.max(
0,
(targetUser.followers||1)-1
)

});

showToast("Unfollowed");

}else{

list.push(uid);

await ref.update({

following:list

});

const targetSnap=
await target.once("value");

const targetUser=
targetSnap.val();

await target.update({

followers:
(targetUser.followers||0)+1

});

showToast("Following");

}

following=list;

renderUsers(filteredUsers);

renderSuggestedUsers();

}

//==============================
// Open Profile Modal
//==============================

function openProfile(uid){

const user=

users.find(u=>u.uid===uid);

if(!user) return;

profileModal.classList.remove("hidden");

document.getElementById("modalAvatar").src=
avatar(user.photoURL);

document.getElementById("modalName").textContent=
user.name||"Unknown";

document.getElementById("modalUsername").textContent=
"@"+(user.username||"user");

document.getElementById("modalBio").textContent=
user.bio||"No bio yet.";

document.getElementById("modalPosts").textContent=
formatNumber(user.posts||0);

document.getElementById("modalFollowers").textContent=
formatNumber(user.followers||0);

document.getElementById("modalFollowing").textContent=
formatNumber(user.followingCount||0);

const btn=
document.getElementById("followBtn");

btn.innerHTML=
following.includes(uid)

?

'<i class="fa-solid fa-user-check"></i> Following'

:

'<i class="fa-solid fa-user-plus"></i> Follow';

btn.onclick=()=>{

followUser(uid);

};

document.getElementById("messageBtn").onclick=()=>{

location.href=

"chat.html?uid="+uid;

};

}

//==============================
// Close Modal
//==============================

document
.getElementById("closeModal")
.onclick=()=>{

profileModal.classList.add("hidden");

};

document
.querySelector(".modalOverlay")
.onclick=()=>{

profileModal.classList.add("hidden");

};

//==============================
// Scroll To Top
//==============================

window.addEventListener("scroll",()=>{

if(window.scrollY>350){

scrollTopBtn.classList.remove("hidden");

}else{

scrollTopBtn.classList.add("hidden");

}

});

scrollTopBtn.onclick=()=>{

window.scrollTo({

top:0,

behavior:"smooth"

});

};

//==============================
// Refresh Button
//==============================

document
.getElementById("refreshBtn")
.onclick=()=>{

showToast("Refreshing...");

loadUsers();

};

//==============================
// Add Friend Button
//==============================

document
.getElementById("addFriendBtn")
.onclick=()=>{

showToast("Feature Coming Soon",false);

};

//==============================
// Back Button
//==============================

document
.getElementById("backBtn")
.onclick=()=>{

history.back();

};

//==============================
// Update Online Status
//==============================

window.addEventListener("load",()=>{

if(currentUser){

db.ref("users/"+currentUser.uid)
.update({

online:true,

lastSeen:Date.now()

});

}

});

window.addEventListener("beforeunload",()=>{

if(currentUser){

db.ref("users/"+currentUser.uid)
.update({

online:false,

lastSeen:Date.now()

});

}

});
/*=========================================
        USERS.JS PART 4 (FINAL)
 Premium Effects • Optimization • Init
=========================================*/

//==============================
// Ripple Animation
//==============================

document.addEventListener("click",e=>{

const target=e.target.closest("button");

if(!target) return;

const ripple=document.createElement("span");

const size=Math.max(
target.clientWidth,
target.clientHeight
);

const rect=target.getBoundingClientRect();

ripple.style.width=size+"px";
ripple.style.height=size+"px";

ripple.style.left=
(e.clientX-rect.left-size/2)+"px";

ripple.style.top=
(e.clientY-rect.top-size/2)+"px";

ripple.className="ripple";

target.appendChild(ripple);

setTimeout(()=>{

ripple.remove();

},600);

});

//==============================
// Pull To Refresh
//==============================

let startY=0;
let distance=0;

window.addEventListener("touchstart",e=>{

if(window.scrollY===0){

startY=e.touches[0].clientY;

}

});

window.addEventListener("touchmove",e=>{

distance=e.touches[0].clientY-startY;

});

window.addEventListener("touchend",()=>{

if(distance>140){

showToast("Refreshing Users");

loadUsers();

}

distance=0;

});

//==============================
// Skeleton Control
//==============================

function showSkeleton(){

skeleton.classList.remove("hidden");

usersList.classList.add("hidden");

}

function hideSkeleton(){

skeleton.classList.add("hidden");

usersList.classList.remove("hidden");

}

//==============================
// Lazy Images
//==============================

function lazyLoadImages(){

const imgs=document.querySelectorAll("img");

const observer=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

const img=entry.target;

if(img.dataset.src){

img.src=img.dataset.src;

img.removeAttribute("data-src");

}

observer.unobserve(img);

}

});

});

imgs.forEach(img=>observer.observe(img));

}

//==============================
// Keyboard Shortcuts
//==============================

document.addEventListener("keydown",e=>{

// Search
if(e.key==="/"){

e.preventDefault();

searchInput.focus();

}

// ESC close modal
if(e.key==="Escape"){

profileModal.classList.add("hidden");

}

// Refresh
if(e.key==="F5"){

e.preventDefault();

loadUsers();

showToast("Refreshing");

}

});

//==============================
// Auto Reconnect
//==============================

window.addEventListener("online",()=>{

showToast("Back Online");

loadUsers();

});

window.addEventListener("offline",()=>{

showToast("No Internet",false);

});

//==============================
// Auto Hide Loader
//==============================

setTimeout(()=>{

hideLoader();

},2000);

//==============================
// Scroll Animation
//==============================

const observer=

new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add("fadeIn");

}

});

},{
threshold:.15
});

function observeCards(){

document
.querySelectorAll(
".userCard,.suggestCard,.onlineUser"
)
.forEach(card=>{

observer.observe(card);

});

}

//==============================
// Search Focus Animation
//==============================

searchInput.addEventListener("focus",()=>{

document
.querySelector(".searchBox")
.style.transform="scale(1.02)";

});

searchInput.addEventListener("blur",()=>{

document
.querySelector(".searchBox")
.style.transform="scale(1)";

});

//==============================
// Vibration
//==============================

document.addEventListener("click",e=>{

if(

navigator.vibrate &&

e.target.closest("button")

){

navigator.vibrate(10);

}

});

//==============================
// Initialize
//==============================

function initializeUsersPage(){

showSkeleton();

loadUsers();

listenOnlineUsers();

lazyLoadImages();

observeCards();

hideSkeleton();

console.log(

"%cViewora Users V7 Loaded",

"color:#6366f1;font-size:18px;font-weight:bold"

);

}

window.onload=()=>{

initializeUsersPage();

};

//==============================
// End
//==============================

console.log("Users.js Loaded Successfully");