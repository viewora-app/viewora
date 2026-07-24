/*=========================================
        VIEWORA USERS V8
        users.js (PART 1)
        Firebase + Initialization
=========================================*/

//=========================================
// DOM Elements
//=========================================

const pageLoader = document.getElementById("pageLoader");
const app = document.getElementById("app");

const usersList = document.getElementById("usersList");
const suggestedUsers = document.getElementById("suggestedUsers");
const onlineUsers = document.getElementById("onlineUsers");

const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");

const totalUsers = document.getElementById("totalUsers");
const onlineCount = document.getElementById("onlineCount");

const profileModal = document.getElementById("profileModal");

const skeleton = document.getElementById("usersSkeleton");

const emptyState = document.getElementById("emptyState");

const toast = document.getElementById("toast");
const toastIcon = document.getElementById("toastIcon");
const toastText = document.getElementById("toastText");

const scrollTopBtn = document.getElementById("scrollTopBtn");

//=========================================
// Firebase References
//=========================================

const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

//=========================================
// Variables
//=========================================

let currentUser = null;

let users = [];
let filteredUsers = [];

let following = [];

let onlineUsersList = [];

let isLoading = false;

//=========================================
// Loader
//=========================================

function showLoader(){

isLoading=true;

pageLoader.classList.remove("hidden");

app.classList.add("hidden");

}

function hideLoader(){

setTimeout(()=>{

pageLoader.classList.add("hidden");

app.classList.remove("hidden");

app.classList.add("fadeIn");

isLoading=false;

},600);

}

//=========================================
// Skeleton
//=========================================

function showSkeleton(){

if(skeleton){

skeleton.classList.remove("hidden");

}

if(usersList){

usersList.classList.add("hidden");

}

}

function hideSkeleton(){

if(skeleton){

skeleton.classList.add("hidden");

}

if(usersList){

usersList.classList.remove("hidden");

}

}

//=========================================
// Toast
//=========================================

function showToast(text,success=true){

toastText.textContent=text;

toast.style.background=

success

?

"#16a34a"

:

"#dc2626";

toastIcon.className=

success

?

"fa-solid fa-circle-check"

:

"fa-solid fa-circle-xmark";

toast.classList.remove("hidden");

setTimeout(()=>{

toast.classList.add("hidden");

},2500);

}

//=========================================
// Helpers
//=========================================

function avatar(url){

return url || "assets/default-avatar.png";

}

function formatNumber(number){

number=Number(number)||0;

if(number>=1000000){

return (number/1000000).toFixed(1)+"M";

}

if(number>=1000){

return (number/1000).toFixed(1)+"K";

}

return number;

}

function shuffle(arr){

return [...arr].sort(()=>Math.random()-0.5);

}

//=========================================
// Authentication
//=========================================

auth.onAuthStateChanged(user=>{

if(!user){

location.href="login.html";

return;

}

currentUser=user;

showLoader();

loadCurrentUser();

});

//=========================================
// Current User
//=========================================

function loadCurrentUser(){

db.ref("users/"+currentUser.uid)

.once("value")

.then(snapshot=>{

const data=snapshot.val();

if(!data){

hideLoader();

return;

}

following=data.following || [];

if(!Array.isArray(following)){

following=[];

}

// Next

loadUsers();

listenOnlineUsers();

})

.catch(error=>{

console.error(error);

hideLoader();

showToast("Failed to load profile",false);

});

}

//=========================================
// Online Status
//=========================================

function updateMyStatus(status){

if(!currentUser) return;

db.ref("users/"+currentUser.uid).update({

online:status,

lastSeen:Date.now()

});

}

window.addEventListener("load",()=>{

updateMyStatus(true);

});

window.addEventListener("beforeunload",()=>{

updateMyStatus(false);

});

//=========================================
// Internet Status
//=========================================

window.addEventListener("online",()=>{

showToast("Back Online");

});

window.addEventListener("offline",()=>{

showToast("No Internet",false);

});

//=========================================
// End Part 1
//=========================================

console.log(
"%cUsers.js Part 1 Loaded",
"color:#00AAFF;font-size:16px;font-weight:bold;"
);
/*=========================================
        USERS.JS PART 2
        Load Users + Search + Render
=========================================*/

// ==============================
// Load Users
// ==============================

function loadUsers() {

    showLoader();

    db.ref("users").on("value", snapshot => {

        users = [];

        snapshot.forEach(child => {

            const user = child.val();
            user.uid = child.key;

            if (currentUser && user.uid === currentUser.uid) return;

            users.push(user);

        });

        filteredUsers = [...users];

        renderSuggestedUsers();
        renderUsers(filteredUsers);
        updateCounters();

        observeCards();
        hideLoader();

    });

}

// ==============================
// Counters
// ==============================

function updateCounters() {

    if (totalUsers)
        totalUsers.textContent = users.length + " Users";

    if (onlineCount)
        onlineCount.textContent = onlineUsersList.length + " Online";

}

// ==============================
// Search
// ==============================

if (searchInput) {

searchInput.addEventListener("input", () => {

    const keyword = searchInput.value
        .trim()
        .toLowerCase();

    if (!keyword) {

        filteredUsers = [...users];

    } else {

        filteredUsers = users.filter(user => {

            return (

                (user.name || "")
                .toLowerCase()
                .includes(keyword)

                ||

                (user.username || "")
                .toLowerCase()
                .includes(keyword)

                ||

                (user.bio || "")
                .toLowerCase()
                .includes(keyword)

            );

        });

    }

    renderUsers(filteredUsers);

});

}

// ==============================
// Clear Search
// ==============================

if (clearSearch) {

clearSearch.onclick = () => {

    searchInput.value = "";

    filteredUsers = [...users];

    renderUsers(filteredUsers);

};

}

// ==============================
// Suggested Users
// ==============================

function renderSuggestedUsers() {

    if (!suggestedUsers) return;

    suggestedUsers.innerHTML = "";

    shuffle(users)
        .slice(0, 8)
        .forEach(user => {

            suggestedUsers.innerHTML += `

<div class="suggestCard">

<img src="${avatar(user.photoURL)}">

<h4>
${user.name || "Unknown"}

${user.verified
?
'<i class="fa-solid fa-circle-check"></i>'
:
''
}

</h4>

<p>

@${user.username || "user"}

</p>

<button onclick="followUser('${user.uid}')">

Follow

</button>

</div>

`;

        });

}

// ==============================
// Render Users
// ==============================

function renderUsers(data) {

    if (!usersList) return;

    usersList.innerHTML = "";

    if (data.length === 0) {

        emptyState.classList.remove("hidden");
        return;

    }

    emptyState.classList.add("hidden");

    data.forEach(user => {

        const isFollowing =
            following.includes(user.uid);

        usersList.innerHTML += `

<div class="userCard"
onclick="openProfile('${user.uid}')">

<img src="${avatar(user.photoURL)}">

<div class="userInfo">

<h4>

${user.name || "Unknown"}

${user.verified
?
'<i class="fa-solid fa-circle-check"></i>'
:
''
}

</h4>

<p>

@${user.username || "user"}

</p>

<div class="userStats">

<span>

${formatNumber(user.followers || 0)}
 Followers

</span>

<span>

${formatNumber(user.posts || 0)}
 Posts

</span>

</div>

</div>

<button
class="followBtn"

onclick="
event.stopPropagation();
followUser('${user.uid}');
">

${isFollowing ? "Following" : "Follow"}

</button>

</div>

`;

    });

    observeCards();

}
/*=========================================
        USERS.JS PART 3
   Online Users • Follow • Profile Modal
=========================================*/

// ==============================
// Online Users
// ==============================

function listenOnlineUsers() {

    db.ref("users").on("value", snapshot => {

        onlineUsers.innerHTML = "";
        onlineUsersList = [];

        snapshot.forEach(child => {

            const user = child.val();
            user.uid = child.key;

            if (currentUser && user.uid === currentUser.uid) return;

            if (user.online) {

                onlineUsersList.push(user);

                onlineUsers.innerHTML += `

<div class="onlineUser"
onclick="openProfile('${user.uid}')">

<img src="${avatar(user.photoURL)}">

<div class="onlineDot"></div>

<h5>${user.name || "User"}</h5>

</div>

`;

            }

        });

        updateCounters();

    });

}

// ==============================
// Follow / Unfollow
// ==============================

async function followUser(uid) {

    if (!currentUser) return;

    const myRef = db.ref("users/" + currentUser.uid);
    const targetRef = db.ref("users/" + uid);

    const mySnap = await myRef.once("value");
    const me = mySnap.val();

    let list = me.following || [];

    if (list.includes(uid)) {

        list = list.filter(id => id !== uid);

        await myRef.update({
            following: list
        });

        const targetSnap = await targetRef.once("value");
        const target = targetSnap.val();

        await targetRef.update({
            followers: Math.max(0, (target.followers || 1) - 1)
        });

        showToast("Unfollowed");

    } else {

        list.push(uid);

        await myRef.update({
            following: list
        });

        const targetSnap = await targetRef.once("value");
        const target = targetSnap.val();

        await targetRef.update({
            followers: (target.followers || 0) + 1
        });

        showToast("Following");

    }

    following = list;

    renderUsers(filteredUsers);
    renderSuggestedUsers();

}

// ==============================
// Open Profile Modal
// ==============================

function openProfile(uid) {

    const user = users.find(u => u.uid === uid);

    if (!user) return;

    profileModal.classList.remove("hidden");

    document.getElementById("modalAvatar").src =
        avatar(user.photoURL);

    document.getElementById("modalName").textContent =
        user.name || "Unknown";

    document.getElementById("modalUsername").textContent =
        "@" + (user.username || "user");

    document.getElementById("modalBio").textContent =
        user.bio || "No bio available.";

    document.getElementById("modalPosts").textContent =
        formatNumber(user.posts || 0);

    document.getElementById("modalFollowers").textContent =
        formatNumber(user.followers || 0);

    document.getElementById("modalFollowing").textContent =
        formatNumber(user.followingCount || 0);

    const followBtn =
        document.getElementById("followBtn");

    if (following.includes(uid)) {

        followBtn.innerHTML =
            '<i class="fa-solid fa-user-check"></i> Following';

    } else {

        followBtn.innerHTML =
            '<i class="fa-solid fa-user-plus"></i> Follow';

    }

    followBtn.onclick = () => {

        followUser(uid);

    };

    document.getElementById("messageBtn").onclick = () => {

        location.href = "chat.html?uid=" + uid;

    };

}

// ==============================
// Close Modal
// ==============================

document.getElementById("closeModal").onclick = () => {

    profileModal.classList.add("hidden");

};

document.querySelector(".modalOverlay").onclick = () => {

    profileModal.classList.add("hidden");

};

// ==============================
// Scroll To Top
// ==============================

window.addEventListener("scroll", () => {

    if (window.scrollY > 350) {

        scrollTopBtn.classList.remove("hidden");

    } else {

        scrollTopBtn.classList.add("hidden");

    }

});

scrollTopBtn.onclick = () => {

    window.scrollTo({

        top: 0,
        behavior: "smooth"

    });

};
/*=========================================
        USERS.JS PART 4 FINAL
 Premium Effects • Performance • Initialize
=========================================*/

//==============================
// Ripple Effect
//==============================

document.addEventListener("click",e=>{

const btn=e.target.closest("button,a");

if(!btn) return;

const ripple=document.createElement("span");

const size=Math.max(btn.clientWidth,btn.clientHeight);

const rect=btn.getBoundingClientRect();

ripple.className="ripple";

ripple.style.width=size+"px";
ripple.style.height=size+"px";

ripple.style.left=
(e.clientX-rect.left-size/2)+"px";

ripple.style.top=
(e.clientY-rect.top-size/2)+"px";

btn.appendChild(ripple);

setTimeout(()=>{

ripple.remove();

},600);

});

//==============================
// Pull To Refresh
//==============================

let touchStart=0;
let pullDistance=0;

window.addEventListener("touchstart",e=>{

if(window.scrollY===0){

touchStart=e.touches[0].clientY;

}

});

window.addEventListener("touchmove",e=>{

pullDistance=e.touches[0].clientY-touchStart;

});

window.addEventListener("touchend",()=>{

if(pullDistance>120){

showToast("Refreshing...");

loadUsers();

}

pullDistance=0;

});

//==============================
// Lazy Load Images
//==============================

function lazyLoadImages(){

const images=document.querySelectorAll("img[data-src]");

const observer=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

const img=entry.target;

img.src=img.dataset.src;

img.removeAttribute("data-src");

observer.unobserve(img);

}

});

});

images.forEach(img=>observer.observe(img));

}

//==============================
// Observe Cards
//==============================

const cardObserver=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add("fadeIn");

cardObserver.unobserve(entry.target);

}

});

},{threshold:.15});

function observeCards(){

document.querySelectorAll(

".userCard,.suggestCard,.onlineUser"

).forEach(card=>{

cardObserver.observe(card);

});

}

//==============================
// Keyboard Shortcuts
//==============================

document.addEventListener("keydown",e=>{

if(e.key==="/"){

e.preventDefault();

searchInput.focus();

}

if(e.key==="Escape"){

profileModal.classList.add("hidden");

}

});

//==============================
// Online / Offline
//==============================

window.addEventListener("online",()=>{

showToast("Internet Connected");

loadUsers();

});

window.addEventListener("offline",()=>{

showToast("No Internet",false);

});

//==============================
// Online Status
//==============================

window.addEventListener("load",()=>{

if(currentUser){

db.ref("users/"+currentUser.uid).update({

online:true,

lastSeen:Date.now()

});

}

});

window.addEventListener("beforeunload",()=>{

if(currentUser){

db.ref("users/"+currentUser.uid).update({

online:false,

lastSeen:Date.now()

});

}

});

//==============================
// Search Animation
//==============================

if(searchInput){

searchInput.addEventListener("focus",()=>{

document.querySelector(".searchBox")

.style.transform="scale(1.02)";

});

searchInput.addEventListener("blur",()=>{

document.querySelector(".searchBox")

.style.transform="scale(1)";

});

}

//==============================
// Button Vibration
//==============================

document.addEventListener("click",e=>{

if(

navigator.vibrate &&

e.target.closest("button,a")

){

navigator.vibrate(10);

}

});

//==============================
// Floating Button
//==============================

if(document.getElementById("addFriendBtn")){

document.getElementById("addFriendBtn")

.onclick=()=>{

showToast("Coming Soon",false);

};

}

//==============================
// Initialize
//==============================

function initializeUsersPage(){

showLoader();

loadUsers();

listenOnlineUsers();

lazyLoadImages();

observeCards();

hideLoader();

console.log(

"%cVIEWORA USERS V8 LOADED",

"color:#00aaff;font-size:18px;font-weight:bold"

);

}

window.addEventListener("load",initializeUsersPage);

//==============================
// Finish
//==============================

console.log("✅ Users.js Loaded Successfully");