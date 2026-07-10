// ==========================================
// VIEWORA HOME V6.0
// INDEX.JS PART 1
// Auth + Loader + Feed
// ==========================================

// Current User
let currentUser = null;

// Feed Container
const feedContainer = document.getElementById("feedContainer");

// ==========================================
// Authentication
// ==========================================

auth.onAuthStateChanged((user) => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    currentUser = user;

    hidePageLoader();

    loadHomeFeed();

    if (typeof loadStories === "function") {
        loadStories();
    }

});

// ==========================================
// Hide Page Loader
// ==========================================

function hidePageLoader() {

    const loader = document.getElementById("pageLoader");

    if (!loader) return;

    setTimeout(() => {

        loader.style.opacity = "0";

        loader.style.visibility = "hidden";

        setTimeout(() => {

            loader.remove();

        }, 500);

    }, 600);

}

// ==========================================
// Load Home Feed
// ==========================================

function loadHomeFeed() {

    if (!feedContainer) return;

    db.ref("posts")

    .orderByChild("createdAt")

    .limitToLast(50)

    .on("value", (snapshot) => {

        feedContainer.innerHTML = "";

        if (!snapshot.exists()) {

            feedContainer.innerHTML = `

            <div class="emptyFeed">

                <h2>📭 No Posts Yet</h2>

                <p>Be the first to share something.</p>

            </div>

            `;

            return;

        }

        const posts = [];

        snapshot.forEach(child => {

            posts.unshift({

                id: child.key,

                ...child.val()

            });

        });

        posts.forEach(post => {

            feedContainer.innerHTML += createPost(post);

        });

    });

}

// ==========================================
// Search Posts
// ==========================================

const searchInput = document.getElementById("searchInput");

if (searchInput) {

    searchInput.addEventListener("keyup", () => {

        const value = searchInput.value.toLowerCase();

        document.querySelectorAll(".post-card").forEach(card => {

            const text = card.innerText.toLowerCase();

            card.style.display =
                text.includes(value)
                ? "block"
                : "none";

        });

    });

}

console.log("✅ Index Part 1 Loaded");
// ==========================================
// VIEWORA HOME V6.0
// INDEX.JS PART 2
// Create Posts + Like + Profile
// ==========================================

// ==========================================
// Create Post Card
// ==========================================

function createPost(post){

return `

<div class="post-card">

<div class="post-header">

<img

class="post-avatar"

src="${post.profilePhoto || 'users.jpg'}"

onclick="openProfile('${post.uid}')"

onerror="this.src='users.jpg'">

<div class="post-user">

<h3>

${post.name || "User"}

</h3>

<p>

@${post.username || "user"}

</p>

</div>

<div class="post-menu">

⋮

</div>

</div>

<div class="post-text">

${post.text || ""}

</div>

${post.mediaUrl ?

`

<img

class="post-image"

src="${post.mediaUrl}"

loading="lazy"

onerror="this.style.display='none'">

`

: ""}

<div class="post-footer">

<span>

${formatTime(post.createdAt)}

</span>

</div>

<div class="post-actions">

<div

class="action-btn"

onclick="likePost('${post.id}')">

<span>❤️</span>

<b id="likes-${post.id}">

${post.likes || 0}

</b>

</div>

<div

class="action-btn"

onclick="showComments('${post.id}')">

<span>💬</span>

Comment

</div>

<div

class="action-btn"

onclick="sharePost('${post.id}')">

<span>📤</span>

Share

</div>

</div>

</div>

`;

}

// ==========================================
// Like Post
// ==========================================

window.likePost = function(postId){

if(!currentUser) return;

const likeRef=

db.ref(

"postLikes/"+

postId+"/"+
currentUser.uid

);

likeRef.once("value")

.then(snap=>{

if(snap.exists()){

likeRef.remove();

db.ref(

"posts/"+

postId+

"/likes"

)

.transaction(v=>

Math.max(

(v||1)-1,

0

)

);

}

else{

likeRef.set(true);

db.ref(

"posts/"+

postId+

"/likes"

)

.transaction(v=>

(v||0)+1

);

}

});

};

// ==========================================
// Open Profile
// ==========================================

window.openProfile=function(uid){

location.href=

"profile.html?uid="+uid;

};

// ==========================================
// Share Post
// ==========================================

window.sharePost=function(postId){

const url=

location.origin+

"/post.html?id="+

postId;

if(navigator.share){

navigator.share({

title:"Viewora",

text:"Check this post",

url:url

});

}else{

navigator.clipboard.writeText(url);

alert("Link Copied");

}

};

// ==========================================
// Time Format
// ==========================================

function formatTime(time){

if(!time)

return "";

const diff=

Date.now()-time;

const sec=

Math.floor(diff/1000);

const min=

Math.floor(sec/60);

const hr=

Math.floor(min/60);

const day=

Math.floor(hr/24);

if(sec<60)

return "Just now";

if(min<60)

return min+" min";

if(hr<24)

return hr+" hr";

if(day<7)

return day+" day";

return new Date(time)

.toLocaleDateString();

}

console.log("✅ Index Part 2 Loaded");
// ==========================================
// VIEWORA HOME V6.0
// INDEX.JS PART 3
// Refresh + Animation + Image Preview
// ==========================================

// ==========================================
// Auto Refresh Feed
// ==========================================

setInterval(() => {

    if (currentUser) {

        loadHomeFeed();

    }

}, 60000);

// ==========================================
// Feed Animation
// ==========================================

const observer = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

        if (entry.isIntersecting) {

            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";

        }

    });

}, {
    threshold: 0.15
});

function animatePosts() {

    document.querySelectorAll(".post-card").forEach(card => {

        card.style.opacity = "0";
        card.style.transform = "translateY(30px)";
        card.style.transition = ".4s";

        observer.observe(card);

    });

}

setTimeout(animatePosts, 800);

// ==========================================
// Image Preview
// ==========================================

document.addEventListener("click", (e) => {

    if (!e.target.classList.contains("post-image")) return;

    const overlay = document.createElement("div");

    overlay.style.cssText = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.9);
    display:flex;
    justify-content:center;
    align-items:center;
    z-index:999999;
    cursor:pointer;
    `;

    overlay.innerHTML = `
    <img
    src="${e.target.src}"
    style="
    max-width:95%;
    max-height:95%;
    border-radius:15px;
    object-fit:contain;
    ">
    `;

    overlay.onclick = () => overlay.remove();

    document.body.appendChild(overlay);

});

// ==========================================
// Pull Down Refresh
// ==========================================

let startY = 0;

window.addEventListener("touchstart", (e) => {

    startY = e.touches[0].clientY;

});

window.addEventListener("touchend", (e) => {

    const endY = e.changedTouches[0].clientY;

    if (window.scrollY === 0 && endY - startY > 120) {

        loadHomeFeed();

        showToast("🔄 Feed Refreshed");

    }

});

// ==========================================
// Empty Feed Check
// ==========================================

function checkFeedEmpty() {

    if (!feedContainer) return;

    if (feedContainer.children.length === 0) {

        feedContainer.innerHTML = `
        <div class="emptyFeed">
            <h2>📭 No Posts Available</h2>
            <p>Follow creators to see posts here.</p>
        </div>
        `;

    }

}

setTimeout(checkFeedEmpty, 1500);

// ==========================================
// Scroll To Top Button
// ==========================================

window.scrollToTop = function () {

    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

};

console.log("✅ Index Part 3 Loaded");
// ==========================================
// VIEWORA HOME V6.0
// INDEX.JS PART 4 (FINAL)
// Buttons + Online + Premium Finish
// ==========================================

// ==========================================
// Upload Button
// ==========================================

const uploadBtn = document.getElementById("uploadBtn");

if (uploadBtn) {

    uploadBtn.onclick = () => {

        location.href = "upload.html";

    };

}

// ==========================================
// Notification Button
// ==========================================

const notificationBtn =
document.getElementById("notificationBtn");

if (notificationBtn) {

    notificationBtn.onclick = () => {

        location.href = "notifications.html";

    };

}

// ==========================================
// Floating Chat
// ==========================================

const floatingChat =
document.getElementById("floatingChat");

if (floatingChat) {

    floatingChat.onclick = () => {

        location.href = "messages.html";

    };

}

// ==========================================
// Story Upload
// ==========================================

window.createStory = function () {

    const picker =
    document.getElementById("storyFile");

    if (picker) {

        picker.click();

    }

};

// ==========================================
// Refresh Stories
// ==========================================

setInterval(() => {

    if (typeof loadStories === "function") {

        loadStories();

    }

}, 300000); // 5 Minutes

// ==========================================
// Network Status
// ==========================================

window.addEventListener("online", () => {

    if (typeof showToast === "function") {

        showToast("🌐 Internet Connected");

    }

});

window.addEventListener("offline", () => {

    if (typeof showToast === "function") {

        showToast("📴 No Internet");

    }

});

// ==========================================
// Page Visibility
// ==========================================

document.addEventListener("visibilitychange", () => {

    if (!document.hidden && currentUser) {

        loadHomeFeed();

        if (typeof loadStories === "function") {

            loadStories();

        }

    }

});

// ==========================================
// Double Tap Home
// ==========================================

let lastTap = 0;

document.addEventListener("touchend", () => {

    const now = Date.now();

    if (now - lastTap < 300) {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

    lastTap = now;

});

// ==========================================
// Welcome
// ==========================================

setTimeout(() => {

    if (currentUser && typeof showToast === "function") {

        showToast("👋 Welcome to Viewora");

    }

}, 1200);

// ==========================================
// Finish
// ==========================================

console.log("================================");
console.log("🏠 Viewora Home Ready");
console.log("📰 Feed Loaded");
console.log("📖 Stories Ready");
console.log("❤️ Like System Ready");
console.log("💬 Comments Ready");
console.log("🚀 Viewora V6 Loaded");
console.log("================================");