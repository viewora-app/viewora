// =====================================
// Viewora Stories V2.0
// Part 1
// =====================================

let stories = [];
let currentStory = 0;
let storyTimer = null;

// ----------------------
// Login Check
// ----------------------

auth.onAuthStateChanged(user=>{

    if(!user){

        location.href="login.html";
        return;

    }

    loadStories();

});

// ----------------------
// Upload Story
// ----------------------

window.createStory=function(){

    const url=prompt("Enter Image / Video URL");

    if(!url) return;

    const user=auth.currentUser;

    db.ref("users/"+user.uid).once("value")

    .then(snap=>{

        const u=snap.val()||{};

        const id=db.ref("stories").push().key;

        db.ref("stories/"+id).set({

            storyId:id,

            uid:user.uid,

            name:u.name||"User",

            username:u.username||"user",

            profilePhoto:u.profilePhoto||"non.jpg",

            media:url,

            type:url.toLowerCase().includes(".mp4")?
            "video":"image",

            createdAt:Date.now(),

            expiresAt:Date.now()+86400000

        }).then(()=>{

            showToast("✅ Story Uploaded");

            loadStories();

        });

    });

};

// ----------------------
// Load Stories
// ----------------------

function loadStories(){

    db.ref("stories")

    .orderByChild("createdAt")

    .once("value")

    .then(snapshot=>{

        stories=[];

        snapshot.forEach(child=>{

            const s=child.val();

            if(s.expiresAt>Date.now()){

                stories.push(s);

            }

        });

        renderStories();

    });

}

// ----------------------
// Story Strip
// ----------------------

function renderStories(){

    const box=document.getElementById("storiesContainer");

    if(!box) return;

    box.innerHTML="";

    // Your Story

    const mine=document.createElement("div");

    mine.className="storyItem";

    mine.innerHTML=`

    <div class="storyRing own"

    onclick="createStory()">

        <img src="${
        auth.currentUser.photoURL||'non.jpg'
        }">

        <span class="plus">+</span>

    </div>

    <small>Your Story</small>

    `;

    box.appendChild(mine);

    // Friends Stories

    stories.forEach((story,index)=>{

        const item=document.createElement("div");

        item.className="storyItem";

        item.innerHTML=`

        <div class="storyRing"

        onclick="openStory(${index})">

            <img src="${
            story.profilePhoto||"non.jpg"
            }">

        </div>

        <small>

        ${story.name}

        </small>

        `;

        box.appendChild(item);

    });

}

console.log("✅ Stories Part 1 Loaded");
// =====================================
// Viewora Stories V2.0
// Part 2
// Story Viewer + Progress
// =====================================

// Open Story
window.openStory = function(index){

    currentStory = index;

    const viewer = document.getElementById("storyViewer");
    const img = document.getElementById("storyImage");
    const video = document.getElementById("storyVideo");

    const profile = document.getElementById("storyProfile");
    const name = document.getElementById("storyName");
    const time = document.getElementById("storyTime");

    const progress = document.getElementById("storyProgress");

    const story = stories[index];

    viewer.style.display = "block";

    // Header

    profile.src = story.profilePhoto || "non.jpg";
    name.innerText = story.name || "User";

    time.innerText = getTimeAgo(story.createdAt);

    // Progress Bars

    progress.innerHTML = "";

    for(let i=0;i<stories.length;i++){

        progress.innerHTML += `
        <div class="progressBar">
            <div class="progressFill"
            id="fill${i}">
            </div>
        </div>
        `;

    }

    // Previous Completed

    for(let i=0;i<index;i++){

        document.getElementById("fill"+i).style.width="100%";

    }

    // Image Story

    if(story.type==="image"){

        video.pause();

        video.style.display="none";

        img.style.display="block";

        img.src=story.media;

    }

    // Video Story

    else{

        img.style.display="none";

        video.style.display="block";

        video.src=story.media;

        video.play();

    }

    animateProgress(index);

}

// -----------------------
// Progress Animation
// -----------------------

function animateProgress(index){

    clearTimeout(storyTimer);

    const fill=document.getElementById("fill"+index);

    fill.style.transition="none";

    fill.style.width="0%";

    setTimeout(()=>{

        fill.style.transition="width 5s linear";

        fill.style.width="100%";

    },50);

    storyTimer=setTimeout(()=>{

        nextStory();

    },5000);

}

// -----------------------
// Time Ago
// -----------------------

function getTimeAgo(time){

    const sec=Math.floor((Date.now()-time)/1000);

    if(sec<60)
        return sec+" sec ago";

    const min=Math.floor(sec/60);

    if(min<60)
        return min+" min ago";

    const hr=Math.floor(min/60);

    if(hr<24)
        return hr+" hr ago";

    const day=Math.floor(hr/24);

    return day+" day ago";

}

console.log("✅ Stories Part 2 Loaded");
// =====================================
// Viewora Stories V2.0
// Part 3
// Navigation + Seen Status
// =====================================

// ----------------------
// Next Story
// ----------------------

window.nextStory = function () {

    clearTimeout(storyTimer);

    const video = document.getElementById("storyVideo");

    if (video) {

        video.pause();

        video.currentTime = 0;

    }

    currentStory++;

    if (currentStory >= stories.length) {

        closeStoryViewer();
        return;

    }

    openStory(currentStory);

};

// ----------------------
// Previous Story
// ----------------------

window.prevStory = function () {

    clearTimeout(storyTimer);

    if (currentStory <= 0) {

        currentStory = 0;
        return;

    }

    currentStory--;

    openStory(currentStory);

};

// ----------------------
// Close Viewer
// ----------------------

window.closeStoryViewer = function () {

    clearTimeout(storyTimer);

    const viewer = document.getElementById("storyViewer");
    const video = document.getElementById("storyVideo");

    if (video) {

        video.pause();
        video.currentTime = 0;

    }

    viewer.style.display = "none";

};

// ----------------------
// Seen Status
// ----------------------

function markSeen(story) {

    const user = auth.currentUser;

    if (!user) return;

    db.ref("storySeen/" + story.storyId + "/" + user.uid).set({

        uid: user.uid,

        seenAt: firebase.database.ServerValue.TIMESTAMP

    });

}

// ----------------------
// Override Open Story
// ----------------------

const oldOpenStory = openStory;

openStory = function(index){

    oldOpenStory(index);

    markSeen(stories[index]);

};

// ----------------------
// Video End
// ----------------------

const video = document.getElementById("storyVideo");

if(video){

    video.addEventListener("ended",()=>{

        nextStory();

    });

}

// ----------------------
// Keyboard Navigation
// ----------------------

document.addEventListener("keydown",(e)=>{

    if(document.getElementById("storyViewer").style.display!="block")
        return;

    if(e.key==="ArrowRight"){

        nextStory();

    }

    if(e.key==="ArrowLeft"){

        prevStory();

    }

    if(e.key==="Escape"){

        closeStoryViewer();

    }

});

// ----------------------
// Touch Navigation
// ----------------------

let touchStartX = 0;

document.addEventListener("touchstart",(e)=>{

    touchStartX = e.changedTouches[0].clientX;

});

document.addEventListener("touchend",(e)=>{

    if(document.getElementById("storyViewer").style.display!="block")
        return;

    const endX = e.changedTouches[0].clientX;

    const diff = touchStartX - endX;

    if(diff > 60){

        nextStory();

    }

    if(diff < -60){

        prevStory();

    }

});

console.log("✅ Stories Part 3 Loaded");
// =====================================
// Viewora Stories V2.0
// Part 4 (Final)
// Replies • Likes • Cleanup
// =====================================

// ----------------------
// Reply Story
// ----------------------

window.replyStory = function(){

    const input = document.getElementById("storyReply");

    const text = input.value.trim();

    if(!text) return;

    const user = auth.currentUser;

    const story = stories[currentStory];

    const id = db.ref("storyReplies").push().key;

    db.ref("storyReplies/"+story.storyId+"/"+id).set({

        uid:user.uid,

        message:text,

        time:firebase.database.ServerValue.TIMESTAMP

    });

    // Notification to Story Owner

    if(user.uid!==story.uid){

        const nid=db.ref("notifications/"+story.uid).push().key;

        db.ref("notifications/"+story.uid+"/"+nid).set({

            fromUid:user.uid,

            fromName:user.displayName||"Someone",

            message:"replied to your story 💬",

            time:firebase.database.ServerValue.TIMESTAMP

        });

    }

    input.value="";

    showToast("💬 Reply Sent");

};

// ----------------------
// Like Story
// ----------------------

window.likeStory=function(){

    const user=auth.currentUser;

    const story=stories[currentStory];

    db.ref("storyLikes/"+story.storyId+"/"+user.uid)

    .set(true);

    if(user.uid!==story.uid){

        const id=db.ref("notifications/"+story.uid).push().key;

        db.ref("notifications/"+story.uid+"/"+id).set({

            fromUid:user.uid,

            fromName:user.displayName||"Someone",

            message:"liked your story ❤️",

            time:firebase.database.ServerValue.TIMESTAMP

        });

    }

    showToast("❤️ Liked");

};

// ----------------------
// Auto Delete Expired
// ----------------------

function cleanStories(){

    db.ref("stories").once("value")

    .then(snapshot=>{

        snapshot.forEach(child=>{

            const story=child.val();

            if(story.expiresAt<Date.now()){

                child.ref.remove();

            }

        });

    });

}

setInterval(cleanStories,60000);

// ----------------------
// Story Count
// ----------------------

function updateStoryCount(){

    const badge=document.getElementById("storyCount");

    if(!badge) return;

    badge.innerText=stories.length;

}

// ----------------------
// Refresh
// ----------------------

const oldLoadStories=loadStories;

loadStories=function(){

    oldLoadStories();

    setTimeout(updateStoryCount,500);

};

// ----------------------
// Preload Next Story
// ----------------------

function preloadStory(){

    if(currentStory+1>=stories.length) return;

    const s=stories[currentStory+1];

    if(s.type==="image"){

        const img=new Image();

        img.src=s.media;

    }

}

const oldNext=nextStory;

nextStory=function(){

    preloadStory();

    oldNext();

};

// ----------------------
// Auto Refresh Stories
// ----------------------

setInterval(()=>{

    loadStories();

},30000);

// ----------------------
// Finish
// ----------------------

console.log("✅ Viewora Stories V2.0 Loaded");