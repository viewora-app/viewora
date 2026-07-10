// ======================================
// Viewora Profile V4.0
// profile.js - Part 1
// Auth + Profile + Stats
// ======================================

// Firebase
let currentUser = null;
let profileUid = null;

// DOM
const profileName = document.getElementById("profileName");
const profileUsername = document.getElementById("profileUsername");
const profileBio = document.getElementById("profileBio");
const profilePic = document.getElementById("profilePic");
const coverPhoto = document.getElementById("coverPhoto");

const followersCount = document.getElementById("followersCount");
const followingCount = document.getElementById("followingCount");
const postsCount = document.getElementById("postsCount");
const videosCount = document.getElementById("videosCount");

// ======================================
// Authentication
// ======================================

auth.onAuthStateChanged(user => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    currentUser = user;

    const params = new URLSearchParams(window.location.search);

    profileUid = params.get("uid") || user.uid;

    loadProfile();
    loadStats();
    setupButtons();

    // Next Parts
    loadPosts();
    loadVideos();
    loadShorts();
    loadSavedPosts();
    loadStories();

});

// ======================================
// Load Profile
// ======================================

function loadProfile(){

    db.ref("users/" + profileUid)

    .on("value", snap => {

        if(!snap.exists()){

            if(profileName){
                profileName.innerText = "User";
            }

            return;

        }

        const user = snap.val();

        // Name + Verified Badge
        if(profileName){

            profileName.innerHTML = `
                ${user.name || "User"}
                ${user.verified ? '<span class="verified-badge">✔</span>' : ''}
            `;

        }

        // Username
        if(profileUsername){

            profileUsername.innerText =
            "@" + (user.username || "user");

        }

        // Bio
        if(profileBio){

            profileBio.innerText =
            user.bio || "No bio added.";

        }

        // Profile Photo
        if(profilePic){

            profilePic.src =
            user.profilePhoto || "users.jpg";

        }

        // Cover Photo
        if(coverPhoto){

            coverPhoto.src =
            user.coverPhoto || "banner.jpg";

        }

    });

}

// ======================================
// Live Stats
// ======================================

function loadStats(){

    // Followers

    db.ref("followers/" + profileUid)

    .on("value", snap => {

        if(followersCount){

            followersCount.innerText =
            snap.numChildren();

        }

    });

    // Following

    db.ref("following/" + profileUid)

    .on("value", snap => {

        if(followingCount){

            followingCount.innerText =
            snap.numChildren();

        }

    });

    // Posts

    db.ref("posts")

    .orderByChild("uid")

    .equalTo(profileUid)

    .on("value", snap => {

        if(postsCount){

            postsCount.innerText =
            snap.numChildren();

        }

    });

    // Videos

    db.ref("videos")

    .orderByChild("uid")

    .equalTo(profileUid)

    .on("value", snap => {

        if(videosCount){

            videosCount.innerText =
            snap.numChildren();

        }

    });

}

// ======================================
// Buttons
// ======================================

function setupButtons(){

    const own =
    currentUser.uid === profileUid;

    const followBtn =
    document.getElementById("followBtn");

    const editBtn =
    document.getElementById("editProfileBtn");

    const messageBtn =
    document.getElementById("messageBtn");

    if(followBtn)
        followBtn.style.display =
        own ? "none" : "inline-flex";

    if(editBtn)
        editBtn.style.display =
        own ? "inline-flex" : "none";

    if(messageBtn)
        messageBtn.style.display =
        own ? "none" : "inline-flex";

}

console.log("✅ Profile Part 1 Loaded");
// ======================================
// Viewora Profile V4.0
// profile.js - Part 2
// Posts • Videos • Shorts • Saved
// ======================================

// ===========================
// Load Posts
// ===========================

function loadPosts(){

    const container =
    document.getElementById("profilePosts");

    if(!container) return;

    db.ref("posts")
    .orderByChild("uid")
    .equalTo(profileUid)

    .on("value",(snapshot)=>{

        container.innerHTML="";

        if(!snapshot.exists()){

            container.innerHTML=`

            <div class="emptyBox">

                📝 No Posts Yet

            </div>

            `;

            return;

        }

        const posts=[];

        snapshot.forEach(child=>{

            posts.unshift(child.val());

        });

        posts.forEach(post=>{

            container.innerHTML+=`

            <div class="post-card">

                ${
                post.mediaUrl ?

                `<img
                src="${post.mediaUrl}"
                class="post-image">`

                :""
                }

                <div class="post-content">

                    <p>

                    ${post.text || post.caption || ""}

                    </p>

                </div>

            </div>

            `;

        });

    });

}

// ===========================
// Load Videos
// ===========================

function loadVideos(){

    const container=
    document.getElementById("videosList");

    if(!container) return;

    db.ref("videos")
    .orderByChild("uid")
    .equalTo(profileUid)

    .on("value",(snapshot)=>{

        container.innerHTML="";

        if(!snapshot.exists()){

            container.innerHTML=`

            <div class="emptyBox">

                🎥 No Videos Uploaded

            </div>

            `;

            return;

        }

        snapshot.forEach(child=>{

            const video=child.val();

            container.innerHTML+=`

            <div class="video-card">

                <video

                controls

                playsinline

                preload="metadata"

                class="profile-video"

                src="${video.videoUrl}">

                </video>

                <h3>

                ${video.title || "Untitled"}

                </h3>

                <p>

                ${video.description || ""}

                </p>

            </div>

            `;

        });

    });

}

// ===========================
// Load Shorts
// ===========================

function loadShorts(){

    const container=
    document.getElementById("shortsList");

    if(!container) return;

    db.ref("shorts")
    .orderByChild("uid")
    .equalTo(profileUid)

    .on("value",(snapshot)=>{

        container.innerHTML="";

        if(!snapshot.exists()){

            container.innerHTML=`

            <div class="emptyBox">

                ▶ No Shorts Uploaded

            </div>

            `;

            return;

        }

        snapshot.forEach(child=>{

            const short=child.val();

            container.innerHTML+=`

            <div class="short-card">

                <video

                controls

                playsinline

                preload="metadata"

                class="profile-short"

                src="${short.videoUrl}">

                </video>

                <p>

                ${short.caption || ""}

                </p>

            </div>

            `;

        });

    });

}

// ===========================
// Saved Posts
// ===========================

function loadSavedPosts(){

    const container=
    document.getElementById("savedPosts");

    if(!container) return;

    if(!currentUser) return;

    db.ref("savedPosts/"+currentUser.uid)

    .on("value",(snapshot)=>{

        if(!snapshot.exists()){

            container.innerHTML=`

            <div class="emptyBox">

                ❤️ No Saved Posts

            </div>

            `;

            return;

        }

        container.innerHTML=`

        <div class="successBox">

            ✅ Saved Posts Loaded

        </div>

        `;

    });

}

console.log("✅ Profile Part 2 Loaded");
// ======================================
// Viewora Profile V4.0
// profile.js - Part 3
// Stories System
// ======================================

// Story Elements

const storyRing = document.getElementById("storyRing");
const storyViewer = document.getElementById("storyViewer");
const storyImage = document.getElementById("storyImage");
const storyVideo = document.getElementById("storyVideo");
const storyProgress = document.getElementById("storyProgress");
const storyFile = document.getElementById("storyFile");
const storiesContainer = document.getElementById("storiesContainer");

// ======================================
// Load Stories
// ======================================

function loadStories(){

    if(!storiesContainer) return;

    db.ref("stories")

    .orderByChild("createdAt")

    .on("value",(snapshot)=>{

        storiesContainer.innerHTML="";

        const now = Date.now();

        snapshot.forEach(child=>{

            const story = child.val();

            if(!story) return;

            if(story.expiresAt < now) return;

            const div = document.createElement("div");

            div.className = "storyItem";

            div.innerHTML = `

                <div class="storyRingMini">

                    <img src="${story.profilePhoto || "users.jpg"}">

                </div>

                <small>

                    ${story.username || "User"}

                </small>

            `;

            div.onclick = ()=>{

                openStory(child.key);

            };

            storiesContainer.appendChild(div);

        });

    });

}

// ======================================
// Story Ring Animation
// ======================================

db.ref("stories")

.orderByChild("uid")

.equalTo(profileUid)

.on("value",(snapshot)=>{

    let active = false;

    const now = Date.now();

    snapshot.forEach(child=>{

        const story = child.val();

        if(story.expiresAt > now){

            active = true;

        }

    });

    if(storyRing){

        storyRing.style.border = active

        ? "4px solid #ff0077"

        : "4px solid #444";

    }

});

// ======================================
// Open Story
// ======================================

function openStory(id){

    if(!storyViewer) return;

    db.ref("stories/"+id)

    .once("value")

    .then(snap=>{

        if(!snap.exists()) return;

        const story = snap.val();

        storyViewer.style.display="flex";

        storyProgress.style.width="0%";

        if(story.type==="video"){

            storyImage.style.display="none";

            storyVideo.style.display="block";

            storyVideo.src = story.url;

            storyVideo.play();

        }else{

            storyVideo.pause();

            storyVideo.style.display="none";

            storyImage.style.display="block";

            storyImage.src = story.url;

        }

        animateStory();

    });

}

// ======================================
// Close Story
// ======================================

window.closeStoryViewer=function(){

    if(storyViewer)

        storyViewer.style.display="none";

    if(storyVideo){

        storyVideo.pause();

        storyVideo.currentTime=0;

    }

};

// ======================================
// Progress Animation
// ======================================

function animateStory(){

    if(!storyProgress) return;

    storyProgress.style.width="0%";

    let progress=0;

    const timer=setInterval(()=>{

        progress++;

        storyProgress.style.width=progress+"%";

        if(progress>=100){

            clearInterval(timer);

            closeStoryViewer();

        }

    },70);

}

// ======================================
// Story Upload
// ======================================

window.createStory=function(){

    if(storyFile)

        storyFile.click();

};

if(storyFile){

    storyFile.addEventListener("change",()=>{

        if(!storyFile.files.length) return;

        uploadStory(storyFile.files[0]);

    });

}

console.log("✅ Profile Part 3 Loaded");
// ======================================
// Viewora Profile V4.0
// profile.js - Part 4 (Final)
// Story Upload • Follow • Chat
// ======================================

// ===========================
// Upload Story
// ===========================

async function uploadStory(file){

    if(!file || !currentUser) return;

    try{

        const storyId = db.ref("stories").push().key;

        const ext = file.name.split(".").pop();

        const storageRef = storage
        .ref("stories/"+currentUser.uid+"/"+storyId+"."+ext);

        await storageRef.put(file);

        const downloadURL =
        await storageRef.getDownloadURL();

        const userSnap =
        await db.ref("users/"+currentUser.uid).once("value");

        const user = userSnap.val() || {};

        await db.ref("stories/"+storyId).set({

            storyId:storyId,

            uid:currentUser.uid,

            username:user.username || "User",

            name:user.name || "User",

            profilePhoto:user.profilePhoto || "users.jpg",

            url:downloadURL,

            type:file.type.startsWith("video")
            ? "video"
            : "image",

            createdAt:Date.now(),

            expiresAt:Date.now()+86400000

        });

        alert("✅ Story Uploaded");

    }catch(err){

        console.error(err);

        alert("Story Upload Failed");

    }

}

// ===========================
// Follow User
// ===========================

window.followUser=function(){

    if(currentUser.uid===profileUid) return;

    db.ref("followers/"+profileUid+"/"+currentUser.uid)

    .set(true);

    db.ref("following/"+currentUser.uid+"/"+profileUid)

    .set(true);

    alert("Followed Successfully");

};

// ===========================
// Unfollow
// ===========================

window.unfollowUser=function(){

    db.ref("followers/"+profileUid+"/"+currentUser.uid)

    .remove();

    db.ref("following/"+currentUser.uid+"/"+profileUid)

    .remove();

    alert("Unfollowed");

};

// ===========================
// Message
// ===========================

window.openChat=function(){

    location.href="chat.html?uid="+profileUid;

};

// ===========================
// Settings
// ===========================

window.goToSettings=function(){

    location.href="settings.html";

};

// ===========================
// Auto Refresh Story Ring
// ===========================

setInterval(()=>{

    if(currentUser){

        loadStories();

    }

},60000);

// ===========================
// Floating Animation
// ===========================

setInterval(()=>{

    if(profilePic){

        profilePic.style.transform="scale(1.03)";

        setTimeout(()=>{

            profilePic.style.transform="scale(1)";

        },300);

    }

},5000);

// ===========================
// Finish
// ===========================

console.log("================================");
console.log("👤 Viewora Profile Loaded");
console.log("📖 Stories Ready");
console.log("🎥 Videos Ready");
console.log("▶ Shorts Ready");
console.log("📝 Posts Ready");
console.log("❤️ Follow System Ready");
console.log("================================");