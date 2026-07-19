/*=========================================
        VIEWORA V1.0
        index.js
        PART 1
=========================================*/

// =========================================
// Current User
// =========================================

let currentUser = null;
let currentUserData = null;

// =========================================
// DOM
// =========================================

const app = document.getElementById("app");
const pageLoader = document.getElementById("pageLoader");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
const toastIcon = document.getElementById("toastIcon");

const feedContainer =
document.getElementById("feedContainer");

const notificationCount =
document.getElementById("notificationCount");

const searchInput =
document.getElementById("searchInput");

// =========================================
// Toast
// =========================================

function showToast(
text,
icon="fa-circle-check"
){

toastText.textContent=text;

toastIcon.className=
"fa-solid "+icon;

toast.classList.remove("hidden");

clearTimeout(window.toastTimer);

window.toastTimer=setTimeout(()=>{

toast.classList.add("hidden");

},2500);

}

// =========================================
// Loader
// =========================================

function hideLoader(){

pageLoader.style.opacity="0";

setTimeout(()=>{

pageLoader.remove();

app.classList.remove("hidden");

app.classList.add("fadeIn");

},500);

}

// =========================================
// Auth Check
// =========================================

auth.onAuthStateChanged(async(user)=>{

if(!user){

location.href="login.html";

return;

}

currentUser=user;

await loadCurrentUser();

hideLoader();

initApp();

});

// =========================================
// Load Current User
// =========================================

async function loadCurrentUser(){

try{

const snap=
await db
.ref("users/"+currentUser.uid)
.once("value");

currentUserData=snap.val()||{};

console.log(currentUserData);

}
catch(e){

console.error(e);

showToast(
"User Load Failed",
"fa-circle-xmark"
);

}

}

// =========================================
// Logout
// =========================================

async function logout(){

await auth.signOut();

location.href="login.html";

}

// =========================================
// App Start
// =========================================

function initApp(){

console.log("Viewora Started");

loadFeed();

loadStories();

loadNotifications();

}
/*=========================================
        VIEWORA V1.0
        PART 2
 Feed Loading + Infinite Scroll
=========================================*/

// =========================================
// Feed Variables
// =========================================

let feedPosts = [];
let feedLoading = false;
let lastPostKey = null;

// =========================================
// Feed
// =========================================

async function loadFeed() {

    if (feedLoading) return;

    feedLoading = true;

    showSkeleton(true);

    try {

        const snap = await db
            .ref("posts")
            .orderByChild("time")
            .limitToLast(10)
            .once("value");

        feedPosts = [];

        feedContainer.innerHTML = "";

        snap.forEach(post => {

            const data = post.val();

            data.id = post.key;

            feedPosts.unshift(data);

        });

        feedPosts.forEach(createPostCard);

        if (feedPosts.length) {

            lastPostKey =
            feedPosts[feedPosts.length-1].id;

        }

    }

    catch(e){

        console.error(e);

        showToast(
        "Feed Load Failed",
        "fa-circle-xmark"
        );

    }

    finally{

        showSkeleton(false);

        feedLoading = false;

    }

}

// =========================================
// Skeleton
// =========================================

function showSkeleton(show){

const skeleton =
document.getElementById("feedSkeleton");

if(!skeleton) return;

if(show){

skeleton.classList.remove("hidden");

}else{

skeleton.classList.add("hidden");

}

}

// =========================================
// Create Post
// =========================================

function createPostCard(post){

const card =
document.createElement("article");

card.className="postCard glass";

card.innerHTML=`

<div class="postHeader">

<div class="userInfo">

<img
class="profilePic"
src="${post.photoURL||'assets/default-avatar.png'}">

<div>

<h3>

${post.name||"Unknown"}

${post.verified?
'<i class="fa-solid fa-circle-check verified"></i>'
:''}

</h3>

<span>

${timeAgo(post.time)}

</span>

</div>

</div>

<button class="postMenu">

<i class="fa-solid fa-ellipsis"></i>

</button>

</div>

<div class="postContent">

${post.text||""}

</div>

${post.image?

`<div class="postMedia">

<img
src="${post.image}">

</div>`

:""}

<div class="postActions">

<button>

❤️ ${post.likes||0}

</button>

<button>

💬 ${post.comments||0}

</button>

<button>

📤 Share

</button>

<button>

🔖 Save

</button>

</div>

`;

feedContainer.appendChild(card);

}

// =========================================
// Infinite Scroll
// =========================================

window.addEventListener("scroll",()=>{

if(feedLoading) return;

if(

window.innerHeight+

window.scrollY>

document.body.offsetHeight-500

){

loadMorePosts();

}

});

// =========================================
// Load More
// =========================================

async function loadMorePosts(){

if(!lastPostKey) return;

feedLoading=true;

try{

const snap=

await db.ref("posts")

.orderByKey()

.endBefore(lastPostKey)

.limitToLast(10)

.once("value");

const arr=[];

snap.forEach(post=>{

const data=post.val();

data.id=post.key;

arr.unshift(data);

});

arr.forEach(p=>{

createPostCard(p);

lastPostKey=p.id;

});

}

catch(e){

console.error(e);

}

finally{

feedLoading=false;

}

}

// =========================================
// Time Ago
// =========================================

function timeAgo(time){

const diff=

(Date.now()-time)/1000;

if(diff<60)
return Math.floor(diff)+" sec";

if(diff<3600)
return Math.floor(diff/60)+" min";

if(diff<86400)
return Math.floor(diff/3600)+" hr";

return Math.floor(diff/86400)+" d";

}

// =========================================
// Pull Refresh
// =========================================

window.addEventListener("focus",()=>{

loadFeed();

});
/*=========================================
        VIEWORA V1.0
        PART 3
 Like • Save • Share • Views
=========================================*/

// =========================================
// Like / Unlike
// =========================================

async function toggleLike(postId){

    if(!currentUser) return;

    const likeRef =
    db.ref(
        "likes/" +
        postId +
        "/" +
        currentUser.uid
    );

    const snap =
    await likeRef.once("value");

    if(snap.exists()){

        await likeRef.remove();

        showToast("Like Removed");

    }else{

        await likeRef.set(true);

        showToast("Liked ❤️");

    }

}

// =========================================
// Save Post
// =========================================

async function toggleSave(postId){

    const saveRef =
    db.ref(
        "saved/" +
        currentUser.uid +
        "/" +
        postId
    );

    const snap =
    await saveRef.once("value");

    if(snap.exists()){

        await saveRef.remove();

        showToast("Removed from Saved");

    }else{

        await saveRef.set(true);

        showToast("Saved 🔖");

    }

}

// =========================================
// Share
// =========================================

async function sharePost(post){

    const url =
    location.origin +
    "/post.html?id=" +
    post.id;

    if(navigator.share){

        try{

            await navigator.share({

                title:"Viewora",

                text:post.text||"",

                url

            });

        }catch(e){}

    }else{

        await navigator.clipboard.writeText(url);

        showToast("Link Copied");

    }

}

// =========================================
// View Counter
// =========================================

async function addView(postId){

    const ref =
    db.ref(
        "views/" +
        postId +
        "/" +
        currentUser.uid
    );

    const snap =
    await ref.once("value");

    if(!snap.exists()){

        await ref.set(Date.now());

    }

}

// =========================================
// Double Tap Like
// =========================================

function enableDoubleTap(
element,
postId
){

let lastTap=0;

element.addEventListener(
"touchend",
()=>{

const now=Date.now();

if(now-lastTap<300){

toggleLike(postId);

heartAnimation(element);

}

lastTap=now;

});

}

// =========================================
// Heart Animation
// =========================================

function heartAnimation(card){

const heart =
document.createElement("div");

heart.innerHTML="❤️";

heart.style.position="absolute";

heart.style.left="50%";

heart.style.top="50%";

heart.style.transform=
"translate(-50%,-50%)";

heart.style.fontSize="90px";

heart.style.pointerEvents="none";

heart.style.animation=
"heartPop .7s ease";

card.appendChild(heart);

setTimeout(()=>{

heart.remove();

},700);

}

// =========================================
// Realtime Like Count
// =========================================

function listenLikes(
postId,
button
){

db.ref("likes/"+postId)

.on("value",snap=>{

button.innerHTML=
"❤️ "+
snap.numChildren();

});

}

// =========================================
// Realtime Views
// =========================================

function listenViews(
postId,
element
){

db.ref("views/"+postId)

.on("value",snap=>{

element.textContent=
snap.numChildren()+
" Views";

});

}
/*=========================================
        VIEWORA V1.0
        PART 4
 Comments • Notifications • Search
=========================================*/

// =========================================
// Current Post
// =========================================

let currentPostId = null;

// =========================================
// Open Comments
// =========================================

function openComments(postId){

    currentPostId = postId;

    document
    .getElementById("commentModal")
    .classList.remove("hidden");

    loadComments(postId);

}

// =========================================
// Close Comments
// =========================================

document
.getElementById("closeComment")
.onclick=()=>{

document
.getElementById("commentModal")
.classList.add("hidden");

};

// =========================================
// Load Comments
// =========================================

function loadComments(postId){

const container =
document.getElementById("commentsContainer");

container.innerHTML="";

db.ref("comments/"+postId)
.limitToLast(50)
.on("child_added",snap=>{

const c=snap.val();

const div=document.createElement("div");

div.className="commentItem";

div.innerHTML=`

<img
class="commentAvatar"
src="${c.photoURL||'assets/default-avatar.png'}">

<div class="commentBubble">

<h4>${c.name}</h4>

<p>${c.text}</p>

</div>

`;

container.appendChild(div);

container.scrollTop=
container.scrollHeight;

});

}

// =========================================
// Send Comment
// =========================================

document
.getElementById("sendComment")
.onclick=async()=>{

const input=
document.getElementById("commentText");

const text=input.value.trim();

if(!text) return;

const id=db.ref().push().key;

await db
.ref("comments/"+currentPostId+"/"+id)
.set({

uid:currentUser.uid,

name:currentUserData.name,

photoURL:currentUserData.photoURL||"",

text,

time:Date.now()

});

input.value="";

showToast("Comment Added");

};

// =========================================
// Notifications
// =========================================

function loadNotifications(){

db.ref("notifications/"+currentUser.uid)

.limitToLast(30)

.on("value",snap=>{

const list=
document.getElementById("notificationList");

list.innerHTML="";

let count=0;

snap.forEach(item=>{

count++;

const n=item.val();

const div=
document.createElement("div");

div.className="notificationItem";

div.innerHTML=`

<img
src="${n.photoURL||'assets/default-avatar.png'}">

<div>

<h4>${n.title}</h4>

<p>${n.body}</p>

</div>

`;

list.prepend(div);

});

notificationCount.textContent=count;

});

}

// =========================================
// Live Search
// =========================================

searchInput.addEventListener(
"input",
searchUsers
);

async function searchUsers(){

const keyword=
searchInput.value
.toLowerCase()
.trim();

if(keyword.length<2) return;

const snap=
await db.ref("users")
.once("value");

const results=[];

snap.forEach(user=>{

const u=user.val();

if(

u.name &&
u.name
.toLowerCase()
.includes(keyword)

){

results.push({

id:user.key,

...u

});

}

});

showSearchResults(results);

}

// =========================================
// Search Results
// =========================================

function showSearchResults(users){

console.log(users);

// Next Part:
// Beautiful Search UI

}

// =========================================
// Suggested Users
// =========================================

async function loadSuggestedUsers(){

const snap=
await db.ref("users")
.limitToFirst(10)
.once("value");

const arr=[];

snap.forEach(u=>{

arr.push({

id:u.key,

...u.val()

});

});

console.log(arr);

}

// =========================================
// Trending
// =========================================

async function loadTrending(){

const snap=
await db.ref("posts")
.orderByChild("likes")
.limitToLast(5)
.once("value");

console.log("Trending Loaded");

}
firebase.auth().onAuthStateChanged(user => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    currentUser = user;

    loadChat();

});