/*=========================================
        VIEWORA SHORTS V1.0
            shorts.js
              PART 1
=========================================*/

// =====================================
// Global Variables
// =====================================

let currentUser = null;
let shorts = [];
let currentIndex = 0;

// =====================================
// DOM
// =====================================

const shortsContainer =
document.getElementById("shortsContainer");

const loader =
document.getElementById("pageLoader");

// =====================================
// Authentication
// =====================================

auth.onAuthStateChanged(user=>{

    if(!user){

        location.href="login.html";
        return;

    }

    currentUser=user;

    initializeShorts();

});

// =====================================
// Initialize
// =====================================

function initializeShorts(){

    loadShorts();

    listenForNewShorts();

}

// =====================================
// Firebase Reference
// =====================================

function shortsRef(){

    return db.ref("shorts");

}

// =====================================
// Load Shorts
// =====================================

function loadShorts(){

    shortsRef()

    .orderByChild("createdAt")

    .limitToLast(100)

    .on("value",snapshot=>{

        shorts=[];

        if(!snapshot.exists()){

            showEmpty();

            return;

        }

        snapshot.forEach(child=>{

            shorts.unshift({

                id:child.key,

                ...child.val()

            });

        });

        renderShorts();

    });

}

// =====================================
// Render
// =====================================

function renderShorts(){

    shortsContainer.innerHTML="";

    shorts.forEach(short=>{

        shortsContainer.appendChild(

            createShortCard(short)

        );

    });

}

// =====================================
// Empty
// =====================================

function showEmpty(){

    shortsContainer.innerHTML=`

    <div class="emptyShorts">

        <h2>

        No Shorts Yet

        </h2>

        <p>

        Upload your first short.

        </p>

    </div>

    `;

}

// =====================================
// Live Update
// =====================================

function listenForNewShorts(){

    let first=true;

    shortsRef()

    .limitToLast(1)

    .on("child_added",snap=>{

        if(first){

            first=false;

            return;

        }

        loadShorts();

        showToast("🔥 New Short Uploaded");

    });

}

console.log("✅ Shorts Part 1 Loaded");
/*=========================================
        VIEWORA SHORTS V1.0
            shorts.js
              PART 2
      Create Short Card + UI
=========================================*/

// =====================================
// Create Short Card
// =====================================

function createShortCard(short){

const card=document.createElement("div");

card.className="shortCard";

card.dataset.id=short.id;

card.innerHTML=`

<video
class="shortVideo"
src="${short.videoURL}"
poster="${short.thumbnail || ''}"
playsinline
loop
preload="metadata">
</video>

<div class="shortOverlay">

<div class="shortInfo">

<div class="userRow">

<img
class="userAvatar"
src="${short.profile || 'assets/default-avatar.png'}">

<div class="userDetails">

<div class="username">

${short.username || "Unknown"}

${short.verified ? '<i class="fa-solid fa-circle-check verified"></i>' : ''}

</div>

<div class="uploadTime">

${timeAgo(short.createdAt)}

</div>

</div>

<button
class="followBtn"
onclick="followUser('${short.uid}')">

Follow

</button>

</div>

<div class="shortCaption">

${short.caption || ""}

</div>

<div class="musicRow">

<i class="fa-solid fa-music"></i>

<span>

${short.music || "Original Audio"}

</span>

</div>

</div>

<div class="shortActions">

<button
class="actionBtn"
onclick="likeShort('${short.id}')">

<i class="fa-regular fa-heart"></i>

<span id="likes-${short.id}">

${short.likes || 0}

</span>

</button>

<button
class="actionBtn"
onclick="openComments('${short.id}')">

<i class="fa-regular fa-comment"></i>

<span>

${short.comments || 0}

</span>

</button>

<button
class="actionBtn"
onclick="shareShort('${short.id}')">

<i class="fa-solid fa-share"></i>

<span>

Share

</span>

</button>

<button
class="actionBtn"
onclick="saveShort('${short.id}')">

<i class="fa-regular fa-bookmark"></i>

<span>

Save

</span>

</button>

<div class="profileDisc">

<img
src="${short.profile || 'assets/default-avatar.png'}">

</div>

</div>

</div>

`;

const video=card.querySelector(".shortVideo");

// Auto Play
const observer=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

video.play().catch(()=>{});

increaseView(short.id);

}else{

video.pause();

}

});

},{threshold:0.75});

observer.observe(card);

// Double Tap Like
let lastTap=0;

video.addEventListener("click",()=>{

const now=Date.now();

if(now-lastTap<300){

likeShort(short.id);

showHeart();

}

lastTap=now;

});

return card;

}

// =====================================
// Time Ago
// =====================================

function timeAgo(time){

if(!time) return "";

const diff=Date.now()-time;

const sec=Math.floor(diff/1000);

if(sec<60)
return"Just now";

if(sec<3600)
return Math.floor(sec/60)+" min ago";

if(sec<86400)
return Math.floor(sec/3600)+" hr ago";

if(sec<604800)
return Math.floor(sec/86400)+" days ago";

return new Date(time).toLocaleDateString();

}

console.log("✅ Shorts Part 2 Loaded");
/*=========================================
        VIEWORA SHORTS V1.0
            shorts.js
              PART 3
     Like • View • Save • Follow
=========================================*/

// =====================================
// Like Short
// =====================================

window.likeShort = async function(shortId){

if(!currentUser) return;

const uid=currentUser.uid;

const likeRef=db.ref(
`shortLikes/${shortId}/${uid}`
);

const snap=await likeRef.once("value");

const totalRef=db.ref(
`shorts/${shortId}/likes`
);

if(snap.exists()){

await likeRef.remove();

const total=await totalRef.once("value");

await totalRef.set(
Math.max((total.val()||1)-1,0)
);

}else{

await likeRef.set(true);

const total=await totalRef.once("value");

await totalRef.set(
(total.val()||0)+1
);

showHeart();

}

};

// =====================================
// Increase View
// =====================================

window.increaseView=async function(shortId){

if(!currentUser) return;

const uid=currentUser.uid;

const viewRef=db.ref(
`shortViews/${shortId}/${uid}`
);

const viewed=await viewRef.once("value");

if(viewed.exists()) return;

await viewRef.set(Date.now());

const totalRef=db.ref(
`shorts/${shortId}/views`
);

const total=await totalRef.once("value");

await totalRef.set(
(total.val()||0)+1
);

};

// =====================================
// Save Short
// =====================================

window.saveShort=async function(shortId){

if(!currentUser) return;

await db.ref(

`savedShorts/${currentUser.uid}/${shortId}`

).set(true);

showToast("🔖 Saved");

};

// =====================================
// Follow User
// =====================================

window.followUser=async function(uid){

if(!currentUser) return;

if(uid===currentUser.uid){

showToast("You can't follow yourself");

return;

}

await db.ref(

`followers/${uid}/${currentUser.uid}`

).set(true);

await db.ref(

`following/${currentUser.uid}/${uid}`

).set(true);

showToast("✅ Following");

};

// =====================================
// Heart Animation
// =====================================

function showHeart(){

const heart=document.getElementById(

"heartAnimation"

);

if(!heart) return;

heart.classList.remove("hidden");

setTimeout(()=>{

heart.classList.add("hidden");

},700);

}

console.log("✅ Shorts Part 3 Loaded");
/*=========================================
        VIEWORA SHORTS V1.0
            shorts.js
              PART 4
   Comments • Share • Copy Link
=========================================*/

// =====================================
// Open Comments
// =====================================

window.openComments = async function(shortId){

const modal=document.getElementById("commentModal");
const container=document.getElementById("commentsContainer");

if(!modal||!container) return;

modal.classList.remove("hidden");
container.innerHTML="<p>Loading...</p>";

db.ref("shortComments/"+shortId)

.orderByChild("time")

.on("value",snapshot=>{

container.innerHTML="";

if(!snapshot.exists()){

container.innerHTML="<p>No comments yet.</p>";
return;

}

snapshot.forEach(item=>{

const c=item.val();

container.innerHTML+=`

<div class="commentItem">

<img src="${c.profile || 'assets/default-avatar.png'}">

<div>

<b>${c.username || "Unknown"}</b>

<p>${c.text}</p>

<small>${timeAgo(c.time)}</small>

</div>

</div>

`;

});

});

document.getElementById("sendComment").onclick=()=>{

sendComment(shortId);

};

};

// =====================================
// Send Comment
// =====================================

async function sendComment(shortId){

const input=document.getElementById("commentText");

const text=input.value.trim();

if(text==="") return;

const ref=db.ref("shortComments/"+shortId).push();

await ref.set({

uid:currentUser.uid,

username:currentUser.displayName||"User",

profile:currentUser.photoURL||"assets/default-avatar.png",

text:text,

time:Date.now()

});

const countRef=db.ref("shorts/"+shortId+"/comments");

const snap=await countRef.once("value");

await countRef.set((snap.val()||0)+1);

input.value="";

showToast("💬 Comment Added");

}

// =====================================
// Share Short
// =====================================

window.shareShort=function(shortId){

const modal=document.getElementById("shareModal");

if(modal){

modal.classList.remove("hidden");

}

window.currentShareId=shortId;

};

// =====================================
// Copy Link
// =====================================

window.copyShortLink=function(){

const link=

location.origin+

"/shorts.html?id="+

window.currentShareId;

navigator.clipboard.writeText(link);

showToast("🔗 Link Copied");

};

// =====================================
// WhatsApp Share
// =====================================

window.shareWhatsApp=function(){

const url=

location.origin+

"/shorts.html?id="+

window.currentShareId;

window.open(

"https://wa.me/?text="+

encodeURIComponent(url),

"_blank"

);

};

// =====================================
// Close Modals
// =====================================

document.getElementById("closeComment")?.addEventListener(

"click",

()=>{

document.getElementById("commentModal")

.classList.add("hidden");

}

);

document.getElementById("closeShare")?.addEventListener(

"click",

()=>{

document.getElementById("shareModal")

.classList.add("hidden");

}

);

console.log("✅ Shorts Part 4 Loaded");
/*=========================================
        VIEWORA SHORTS V1.0
            shorts.js
           PART 5 FINAL
=========================================*/

// =====================================
// Auto Refresh
// =====================================

setInterval(() => {

    if (currentUser) {

        loadShorts();

    }

}, 60000);

// =====================================
// Offline / Online
// =====================================

window.addEventListener("offline", () => {

    showToast("📡 You are Offline");

});

window.addEventListener("online", () => {

    showToast("🌐 Back Online");

    loadShorts();

});

// =====================================
// Page Visibility
// =====================================

document.addEventListener("visibilitychange", () => {

    if (!document.hidden) {

        loadShorts();

    }

});

// =====================================
// Scroll Top Button
// =====================================

const scrollTopButton = document.getElementById("scrollTopBtn");

if (topBtn) {

window.addEventListener("scroll", () => {

    if (window.scrollY > 500) {

        topBtn.classList.add("show");

    } else {

        topBtn.classList.remove("show");

    }

});

topBtn.onclick = () => {

    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

};

}

// =====================================
// Upload Button
// =====================================

const uploadBtn = document.getElementById("uploadShortBtn");

if(uploadBtn){

uploadBtn.onclick=()=>{

location.href="upload.html";

};

}

// =====================================
// Cleanup
// =====================================

window.addEventListener("beforeunload",()=>{

db.ref("shorts").off();

});

// =====================================
// Hide Loader
// =====================================

window.addEventListener("load",()=>{

const loader=document.getElementById("pageLoader");

if(loader){

setTimeout(()=>{

loader.style.opacity="0";

setTimeout(()=>{

loader.style.display="none";

},400);

},700);

}

});

// =====================================
// Keyboard Shortcuts
// =====================================

document.addEventListener("keydown",e=>{

// Space = Play/Pause

if(e.code==="Space"){

e.preventDefault();

const video=document.querySelector(".shortVideo");

if(video){

if(video.paused){

video.play();

}else{

video.pause();

}

}

}

// Arrow Down

if(e.key==="ArrowDown"){

window.scrollBy({

top:window.innerHeight,

behavior:"smooth"

});

}

// Arrow Up

if(e.key==="ArrowUp"){

window.scrollBy({

top:-window.innerHeight,

behavior:"smooth"

});

}

});

// =====================================
// Ripple Effect
// =====================================

document.addEventListener("click",e=>{

const btn=e.target.closest("button");

if(!btn) return;

const ripple=document.createElement("span");

ripple.style.cssText=`

position:absolute;
width:12px;
height:12px;
border-radius:50%;
background:rgba(255,255,255,.4);
left:${e.offsetX}px;
top:${e.offsetY}px;
transform:scale(0);
transition:.6s;
pointer-events:none;

`;

btn.style.position="relative";

btn.style.overflow="hidden";

btn.appendChild(ripple);

requestAnimationFrame(()=>{

ripple.style.transform="scale(25)";

ripple.style.opacity="0";

});

setTimeout(()=>{

ripple.remove();

},600);

});

// =====================================
// Version
// =====================================

console.log("====================================");
console.log(" VIEWORA SHORTS V1.0 FINAL LOADED ");
console.log(" Firebase ✔");
console.log(" Likes ✔");
console.log(" Comments ✔");
console.log(" Shares ✔");
console.log(" Saves ✔");
console.log(" Follow ✔");
console.log(" Views ✔");
console.log(" Auto Play ✔");
console.log(" Premium Animation ✔");
console.log("====================================");