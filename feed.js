/*=========================================
        VIEWORA V2.0 FINAL
            feed.js
            PART 1
 Authentication • Load Feed • Render
=========================================*/

// ======================================
// Global
// ======================================

let currentUser = null;
let feedPosts = [];

// ======================================
// DOM
// ======================================

const feedContainer =
document.getElementById("feedContainer");

const skeleton =
document.getElementById("feedSkeleton");

// ======================================
// Auth
// ======================================

auth.onAuthStateChanged(user=>{

    if(!user){

        location.href="login.html";
        return;

    }

    currentUser=user;

    loadFeed();

});

// ======================================
// Loading
// ======================================

function showLoading(){

    if(skeleton)
        skeleton.classList.remove("hidden");

}

function hideLoading(){

    if(skeleton)
        skeleton.classList.add("hidden");

}

// ======================================
// Load Feed
// ======================================

function loadFeed(){

    showLoading();

    db.ref("posts")

    .orderByChild("createdAt")

    .limitToLast(50)

    .on("value",snapshot=>{

        hideLoading();

        feedPosts=[];

        if(!snapshot.exists()){

            feedContainer.innerHTML=`

            <div class="emptyFeed">

                <h2>📭 No Posts Yet</h2>

                <p>Be the first creator to upload.</p>

            </div>

            `;

            return;

        }

        snapshot.forEach(child=>{

            feedPosts.unshift({

                id:child.key,

                ...child.val()

            });

        });

        renderFeed();

    },error=>{

        hideLoading();

        console.error(error);

        feedContainer.innerHTML=`

        <div class="emptyFeed">

            <h2>⚠ Feed Error</h2>

            <p>Unable to load posts.</p>

        </div>

        `;

    });

}

// ======================================
// Render Feed
// ======================================

function renderFeed(){

    feedContainer.innerHTML="";

    feedPosts.forEach(post=>{

        feedContainer.appendChild(

            createPost(post)

        );

    });

}

// ======================================
// Create Post
// ======================================

function createPost(post){

    const card=document.createElement("article");

    card.className="postCard glass";

    const media=

    post.type==="image"

    ?

    `<img class="postMedia"
    src="${post.fileURL}">`

    :

    `<video
    class="postMedia"
    src="${post.fileURL}"
    controls
    playsinline>
    </video>`;

    card.innerHTML=`

    <div class="postHeader">

        <div class="userInfo">

            <img
            src="${post.profile || "assets/default-avatar.png"}"
            class="profilePic">

            <div>

                <h3>

                    ${post.username || "Unknown"}

                </h3>

                <span>

                    ${timeAgo(post.createdAt)}

                </span>

            </div>

        </div>

    </div>

    <div class="postContent">

        ${post.title || ""}

    </div>

    ${media}

    <div class="postStats">

        ❤️ ${post.likes || 0}
        •
        💬 ${post.comments || 0}
        •
        👁 ${post.views || 0}

    </div>

    <div class="postActions">

        <button
        onclick="likePost('${post.id}')">

        ❤️ Like

        </button>

        <button
        onclick="openComments('${post.id}')">

        💬 Comment

        </button>

        <button
        onclick="sharePost('${post.id}')">

        📤 Share

        </button>

        <button
        onclick="savePost('${post.id}')">

        🔖 Save

        </button>

    </div>

    `;

    return card;

}

// ======================================
// Time Ago
// ======================================

function timeAgo(time){

    const sec=Math.floor(

        (Date.now()-time)/1000

    );

    if(sec<60)
        return "Just now";

    if(sec<3600)
        return Math.floor(sec/60)+" min ago";

    if(sec<86400)
        return Math.floor(sec/3600)+" hr ago";

    if(sec<604800)
        return Math.floor(sec/86400)+" days ago";

    return new Date(time)
    .toLocaleDateString();

}

console.log("✅ Feed Part 1 Loaded");
/*=========================================
        VIEWORA V2.0 FINAL
            feed.js
            PART 2
 Like • Save • Share • Views
=========================================*/

// ======================================
// Like / Unlike
// ======================================

async function likePost(postId){

    if(!currentUser) return;

    const likeRef = db.ref(
        "postLikes/"+postId+"/"+currentUser.uid
    );

    const postRef = db.ref(
        "posts/"+postId+"/likes"
    );

    const liked = await likeRef.once("value");

    let likes = 0;

    const likeSnap = await postRef.once("value");

    if(likeSnap.exists()){

        likes = likeSnap.val();

    }

    if(liked.exists()){

        await likeRef.remove();

        likes = Math.max(0, likes-1);

        await postRef.set(likes);

        showToast("💔 Like Removed");

    }else{

        await likeRef.set(true);

        likes++;

        await postRef.set(likes);

        showToast("❤️ Liked");

    }

}

// ======================================
// Save Post
// ======================================

async function savePost(postId){

    if(!currentUser) return;

    const ref = db.ref(
        "savedPosts/"+currentUser.uid+"/"+postId
    );

    const snap = await ref.once("value");

    if(snap.exists()){

        await ref.remove();

        showToast("🗑 Removed from Saved");

    }else{

        await ref.set({

            savedAt:Date.now()

        });

        showToast("🔖 Saved");

    }

}

// ======================================
// Share Post
// ======================================

function sharePost(postId){

    const url =
    location.origin+
    "/post.html?id="+postId;

    if(navigator.share){

        navigator.share({

            title:"Viewora",

            text:"Check this post",

            url:url

        }).catch(()=>{});

    }else{

        navigator.clipboard

        .writeText(url)

        .then(()=>{

            showToast("🔗 Link Copied");

        });

    }

}

// ======================================
// View Counter
// ======================================

const viewedPosts = new Set();

async function addView(postId){

    if(viewedPosts.has(postId))
        return;

    viewedPosts.add(postId);

    const ref =
    db.ref("posts/"+postId+"/views");

    const snap =
    await ref.once("value");

    let views = 0;

    if(snap.exists()){

        views = snap.val();

    }

    await ref.set(views+1);

}

// ======================================
// Observe Videos
// ======================================

const observer =
new IntersectionObserver(entries=>{

    entries.forEach(entry=>{

        if(entry.isIntersecting){

            const id =
            entry.target.dataset.id;

            if(id){

                addView(id);

            }

        }

    });

},{
    threshold:0.6
});

// ======================================
// Attach Observer
// ======================================

function observePosts(){

    document

    .querySelectorAll(".postMedia")

    .forEach(media=>{

        observer.observe(media);

    });

}

// ======================================
// Update Render
// ======================================

const oldRender = renderFeed;

renderFeed = function(){

    oldRender();

    observePosts();

}

console.log("✅ Feed Part 2 Loaded");
/*=========================================
        VIEWORA V2.0 FINAL
            feed.js
            PART 3
 Comments • Delete • Edit • Profile
=========================================*/

// ======================================
// Current Post
// ======================================

let currentPostId = null;

// ======================================
// Open Comments
// ======================================

window.openComments = async function(postId){

    currentPostId = postId;

    const modal =
    document.getElementById("commentModal");

    const container =
    document.getElementById("commentsContainer");

    if(!modal || !container) return;

    modal.classList.remove("hidden");

    container.innerHTML =
    "<p style='text-align:center'>Loading...</p>";

    db.ref("comments/"+postId)

    .orderByChild("createdAt")

    .on("value",snap=>{

        container.innerHTML="";

        if(!snap.exists()){

            container.innerHTML=`

            <div class="emptyComments">

                No comments yet.

            </div>

            `;

            return;

        }

        snap.forEach(child=>{

            const c = child.val();

            container.innerHTML += `

            <div class="commentCard">

                <img
                src="${c.photo || "assets/default-avatar.png"}"
                class="commentAvatar">

                <div>

                    <b>

                    ${c.username || "Unknown"}

                    </b>

                    <p>

                    ${c.text}

                    </p>

                    <small>

                    ${timeAgo(c.createdAt)}

                    </small>

                </div>

            </div>

            `;

        });

    });

};

// ======================================
// Close Comment
// ======================================

const closeComment =
document.getElementById("closeComment");

if(closeComment){

closeComment.onclick=()=>{

document

.getElementById("commentModal")

.classList.add("hidden");

};

}

// ======================================
// Send Comment
// ======================================

const sendBtn =
document.getElementById("sendComment");

if(sendBtn){

sendBtn.onclick = async()=>{

const input =
document.getElementById("commentText");

const text =
input.value.trim();

if(text==="") return;

const id =
db.ref().push().key;

await db.ref(

"comments/"+

currentPostId+

"/"+id

)

.set({

id,

uid:currentUser.uid,

username:

currentUser.displayName ||

"User",

photo:

currentUser.photoURL ||

"assets/default-avatar.png",

text,

createdAt:Date.now()

});

const ref =
db.ref(

"posts/"+

currentPostId+

"/comments"

);

const snap =
await ref.once("value");

await ref.set(

(snap.val()||0)+1

);

input.value="";

showToast("💬 Comment Added");

};

}

// ======================================
// Delete Post
// ======================================

window.deletePost =
async function(postId){

if(!confirm(

"Delete this post?"

))

return;

await db.ref(

"posts/"+postId

).remove();

showToast(

"🗑 Post Deleted"

);

};

// ======================================
// Edit Post
// ======================================

window.editPost =
async function(postId){

const title = prompt(

"Edit Title"

);

if(title===null) return;

await db.ref(

"posts/"+postId

)

.update({

title

});

showToast(

"✏️ Updated"

);

};

// ======================================
// Open Profile
// ======================================

window.openProfile =
function(uid){

location.href=

"profile.html?uid="+uid;

};

// ======================================
// Double Tap Like
// ======================================

document.addEventListener(

"dblclick",

e=>{

const media =
e.target.closest(".postMedia");

if(!media) return;

const id =
media.dataset.id;

if(id){

likePost(id);

}

});

// ======================================
// Premium Animation
// ======================================

function animateLike(target){

const heart =
document.createElement("div");

heart.innerHTML="❤️";

heart.style.cssText=`

position:absolute;
font-size:70px;
left:50%;
top:50%;
transform:translate(-50%,-50%);
pointer-events:none;
animation:pop .8s forwards;
z-index:1000;

`;

target.parentElement.appendChild(heart);

setTimeout(()=>{

heart.remove();

},800);

}

// ======================================
// Like Animation Trigger
// ======================================

document.addEventListener(

"dblclick",

e=>{

const media =
e.target.closest(".postMedia");

if(media){

animateLike(media);

}

});

console.log("✅ Feed Part 3 Loaded");
/*=========================================
        VIEWORA V1.0
            feed.js
             PART 4 FINAL
=========================================*/

// ===============================
// Like Post
// ===============================

window.likePost = async function(postId){

    if(!currentUser) return;

    const likeRef =
    db.ref("likes/"+postId+"/"+currentUser.uid);

    const likeSnap =
    await likeRef.once("value");

    const postRef =
    db.ref("posts/"+postId);

    const postSnap =
    await postRef.once("value");

    if(!postSnap.exists()) return;

    let likes =
    postSnap.val().likes || 0;

    if(likeSnap.exists()){

        await likeRef.remove();

        likes=Math.max(0,likes-1);

    }else{

        await likeRef.set(true);

        likes++;

    }

    await postRef.update({
        likes:likes
    });

};

// ===============================
// Share
// ===============================

window.sharePost=function(postId){

    const url=
    location.origin+
    "/post.html?id="+postId;

    if(navigator.share){

        navigator.share({

            title:"Viewora",

            text:"Check this post",

            url:url

        });

    }else{

        navigator.clipboard.writeText(url);

        showToast("Link Copied");

    }

};

// ===============================
// Comments
// ===============================

window.openComments=function(postId){

    location.href=
    "post.html?id="+postId;

};

// ===============================
// Notification Button
// ===============================

const notificationBtn=
document.getElementById("notificationBtn");

if(notificationBtn){

notificationBtn.onclick=()=>{

location.href="notifications.html";

};

}

// ===============================
// Message Button
// ===============================

const messageBtn=
document.getElementById("messageBtn");

if(messageBtn){

messageBtn.onclick=()=>{

location.href="chatlist.html";

};

}

// ===============================
// Floating Upload
// ===============================

const fab=
document.getElementById("fab");

if(fab){

fab.onclick=()=>{

location.href="upload.html";

};

}

// ===============================
// Search
// ===============================

const searchInput=
document.getElementById("searchInput");

if(searchInput){

searchInput.addEventListener(

"input",

e=>{

const q=e.target.value.toLowerCase();

document
.querySelectorAll(".post")

.forEach(post=>{

post.style.display=

post.innerText
.toLowerCase()
.includes(q)

?"block"

:"none";

});

});

}

// ===============================
// Scroll Button
// ===============================

const topBtn=
document.getElementById("scrollTopBtn");

window.addEventListener(

"scroll",

()=>{

if(!topBtn) return;

topBtn.style.display=

window.scrollY>500

?"flex"

:"none";

});

if(topBtn){

topBtn.onclick=()=>{

window.scrollTo({

top:0,

behavior:"smooth"

});

};

}

// ===============================
// Network
// ===============================

window.addEventListener(

"offline",

()=>{

showToast("No Internet");

});

window.addEventListener(

"online",

()=>{

showToast("Connected");

});

// ===============================
// Cleanup
// ===============================

window.addEventListener(

"beforeunload",

()=>{

db.ref("posts").off();

});

// ===============================

console.log("✅ Feed Part 4 Loaded");
/*=========================================
        VIEWORA V2.0
            feed.js
             PART 5
=========================================*/

// ===============================
// Live Notification Count
// ===============================

function listenNotificationCount(){

    if(!currentUser) return;

    db.ref("notifications/"+currentUser.uid)

    .on("value",snapshot=>{

        let count=0;

        snapshot.forEach(item=>{

            const data=item.val();

            if(!data.read){

                count++;

            }

        });

        const badge=
        document.getElementById("notificationCount");

        if(!badge) return;

        if(count>0){

            badge.style.display="flex";
            badge.innerText=
            count>99?"99+":count;

        }else{

            badge.style.display="none";

        }

    });

}

// ===============================
// Explore Button
// ===============================

const exploreBtn=
document.getElementById("exploreBtn");

if(exploreBtn){

exploreBtn.onclick=()=>{

location.href="explore.html";

};

}

// ===============================
// Auto Play Videos
// ===============================

const observer=

new IntersectionObserver(

entries=>{

entries.forEach(entry=>{

const video=

entry.target;

if(entry.isIntersecting){

video.play().catch(()=>{});

}else{

video.pause();

}

});

},

{

threshold:.7

}

);

function observeVideos(){

document

.querySelectorAll("video")

.forEach(video=>{

observer.observe(video);

});

}

// ===============================
// Infinite Scroll
// ===============================

let loadingMore=false;

window.addEventListener(

"scroll",

()=>{

if(loadingMore) return;

if(

window.innerHeight+

window.scrollY>=

document.body.offsetHeight-300

){

loadingMore=true;

loadMorePosts();

}

});

function loadMorePosts(){

setTimeout(()=>{

loadingMore=false;

},1000);

}

// ===============================
// Pull To Refresh
// ===============================

let startY=0;

window.addEventListener(

"touchstart",

e=>{

startY=

e.touches[0].clientY;

});

window.addEventListener(

"touchend",

e=>{

const endY=

e.changedTouches[0].clientY;

if(endY-startY>120){

loadFeed();

showToast(

"Feed Updated"

);

}

});

// ===============================
// Empty Feed Animation
// ===============================

function animateFeed(){

document

.querySelectorAll(".post")

.forEach((post,index)=>{

post.animate([

{

opacity:0,

transform:

"translateY(20px)"

},

{

opacity:1,

transform:

"translateY(0)"

}

],{

duration:400,

delay:index*80,

fill:"forwards"

});

});

}

// ===============================
// Refresh Feed
// ===============================

window.refreshFeed=function(){

loadFeed();

showToast("Refreshing...");

};

// ===============================
// Feed Loaded
// ===============================

document.addEventListener(

"DOMContentLoaded",

()=>{

listenNotificationCount();

observeVideos();

});

// ===============================

console.log("✅ Feed Part 5 Loaded");