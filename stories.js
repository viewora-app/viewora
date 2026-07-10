/* ==========================================
   VIEWORA STORIES.JS
   PART 1
   Auth + Story Ring + Load Stories
========================================== */

// ==========================================
// Globals
// ==========================================

// Use currentUser from index.js
let stories = [];
let currentStoryIndex = 0;
let storyTimer = null;

// DOM

const storiesContainer =
document.getElementById("storiesContainer");

const storyViewer =
document.getElementById("storyViewer");

const storyImage =
document.getElementById("storyImage");

const storyVideo =
document.getElementById("storyVideo");

const storyProgress =
document.getElementById("storyProgress");

// ==========================================
// Load Stories
// ==========================================

function loadStories(){

    if(!storiesContainer) return;

    db.ref("stories")

    .orderByChild("createdAt")

    .on("value",snapshot=>{

        stories=[];

        storiesContainer.innerHTML="";

        const now=Date.now();

        // Your Story Button

        storiesContainer.innerHTML+=`

        <div class="story" onclick="openStoryGallery()">

            <div class="storyRing">

                <img src="users.jpg">

            </div>

            <p>Your Story</p>

        </div>

        `;

        if(!snapshot.exists()) return;

        snapshot.forEach(child=>{

            const story=child.val();

            if(!story) return;

            // Expired

            if(story.expiresAt<=now){

                db.ref("stories/"+child.key).remove();

                return;

            }

            stories.push({

                id:child.key,

                ...story

            });

        });

        renderStories();

    });

}

// ==========================================
// Render Story Ring
// ==========================================

function renderStories(){

    stories.forEach((story,index)=>{

        storiesContainer.innerHTML+=`

        <div

        class="story"

        onclick="openStory(${index})">

            <div class="storyRing">

                <img

                src="${
                story.profilePhoto ||
                'users.jpg'
                }"

                onerror="this.src='users.jpg'">

            </div>

            <p>

            ${
            story.username ||
            "User"
            }

            </p>

        </div>

        `;

    });

}

// ==========================================
// Refresh Ring
// ==========================================

window.refreshStoryRing=function(){

    loadStories();

};

// ==========================================
// User Stories
// ==========================================

window.loadUserStories=function(uid){

    db.ref("stories")

    .orderByChild("uid")

    .equalTo(uid)

    .once("value")

    .then(snap=>{

        console.log(

            "Stories :",

            snap.numChildren()

        );

    });

};

// ==========================================

console.log("✅ STORIES PART 1 LOADED");
/* ==========================================
   VIEWORA STORIES.JS
   PART 2A
   Story Viewer
========================================== */

// ==========================================
// Open Story
// ==========================================

window.openStory = function(index){

    if(!stories.length) return;

    currentStoryIndex = index;

    showStory();

};

// ==========================================
// Show Story
// ==========================================

function showStory(){

    if(!storyViewer) return;

    const story = stories[currentStoryIndex];

    if(!story) return;

    clearStoryTimer();

    storyViewer.style.display = "flex";

    resetProgress();

    // Hide Both

    if(storyImage)
        storyImage.style.display="none";

    if(storyVideo){

        storyVideo.pause();

        storyVideo.style.display="none";

    }

    // ==========================
    // IMAGE
    // ==========================

    if(story.type==="image"){

        storyImage.style.display="block";

        storyImage.src =
        story.mediaUrl || story.url;

        startStoryProgress(5000);

    }

    // ==========================
    // VIDEO
    // ==========================

    else{

        storyVideo.style.display="block";

        storyVideo.src =
        story.mediaUrl || story.url;

        storyVideo.load();

        storyVideo.onloadedmetadata=function(){

            const duration =
            (storyVideo.duration || 5) * 1000;

            startStoryProgress(duration);

        };

        storyVideo.play();

    }

    // Mark Seen

    markStorySeen(story.id);

}

// ==========================================
// Reset Progress
// ==========================================

function resetProgress(){

    if(storyProgress){

        storyProgress.style.width="0%";

    }

}

// ==========================================
// Progress Animation
// ==========================================

function startStoryProgress(duration){

    let progress = 0;

    clearStoryTimer();

    const step = 100 / (duration / 50);

    storyTimer = setInterval(()=>{

        progress += step;

        if(storyProgress){

            storyProgress.style.width =
            progress + "%";

        }

        if(progress >= 100){

            clearStoryTimer();

            nextStory();

        }

    },50);

}

// ==========================================
// Clear Timer
// ==========================================

function clearStoryTimer(){

    if(storyTimer){

        clearInterval(storyTimer);

        storyTimer = null;

    }

}

// ==========================================
// Mark Seen
// ==========================================

function markStorySeen(storyId){

    if(!currentUser) return;

    const ref=db.ref(
        "storyViews/"+storyId+"/"+currentUser.uid
    );

    ref.once("value").then(snap=>{

        if(snap.exists()) return;

        ref.set(true);

        db.ref("stories/"+storyId+"/views")
        .transaction(v=>(v||0)+1);

    });

}

console.log("✅ STORIES PART 2A LOADED");
/* ==========================================
   VIEWORA STORIES.JS
   PART 2B
   Next • Previous • Swipe • Close
========================================== */

// ==========================================
// Next Story
// ==========================================

window.nextStory = function(){

    if(currentStoryIndex < stories.length - 1){

        currentStoryIndex++;

        showStory();

    }else{

        closeStory();

    }

};

// ==========================================
// Previous Story
// ==========================================

window.previousStory = function(){

    if(currentStoryIndex > 0){

        currentStoryIndex--;

        showStory();

    }

};

// ==========================================
// Close Story
// ==========================================

window.closeStory = function(){

    clearStoryTimer();

    if(storyViewer){

        storyViewer.style.display="none";

    }

    if(storyVideo){

        storyVideo.pause();

        storyVideo.currentTime=0;

        storyVideo.removeAttribute("src");

        storyVideo.load();

    }

    if(storyImage){

        storyImage.removeAttribute("src");

    }

    resetProgress();

};

// ==========================================
// Video Finished
// ==========================================

if(storyVideo){

    storyVideo.addEventListener("ended",()=>{

        nextStory();

    });

}

// ==========================================
// Tap Navigation
// ==========================================

if(storyViewer){

    storyViewer.addEventListener("click",(e)=>{

        const width=window.innerWidth;

        if(e.clientX < width/2){

            previousStory();

        }

        else{

            nextStory();

        }

    });

}

// ==========================================
// Keyboard Support
// ==========================================

document.addEventListener("keydown",(e)=>{

    if(!storyViewer) return;

    if(storyViewer.style.display!=="flex") return;

    switch(e.key){

        case "ArrowRight":

            nextStory();

            break;

        case "ArrowLeft":

            previousStory();

            break;

        case "Escape":

            closeStory();

            break;

    }

});

// ==========================================
// Swipe Support
// ==========================================

let touchStartX=0;
let touchEndX=0;

if(storyViewer){

    storyViewer.addEventListener("touchstart",(e)=>{

        touchStartX=e.changedTouches[0].screenX;

    });

    storyViewer.addEventListener("touchend",(e)=>{

        touchEndX=e.changedTouches[0].screenX;

        handleSwipe();

    });

}

function handleSwipe(){

    const distance=touchEndX-touchStartX;

    if(distance>70){

        previousStory();

    }

    else if(distance<-70){

        nextStory();

    }

}

// ==========================================
// Pause / Resume Video
// ==========================================

window.pauseStory=function(){

    clearStoryTimer();

    if(storyVideo &&
       storyVideo.style.display==="block"){

        storyVideo.pause();

    }

};

window.resumeStory=function(){

    const story=stories[currentStoryIndex];

    if(!story) return;

    if(storyVideo &&
       storyVideo.style.display==="block"){

        storyVideo.play();

        startStoryProgress(
            storyVideo.duration*1000
        );

    }else{

        startStoryProgress(5000);

    }

};

// ==========================================
// Visibility API
// ==========================================

document.addEventListener("visibilitychange",()=>{

    if(document.hidden){

        pauseStory();

    }else{

        if(storyViewer &&
           storyViewer.style.display==="flex"){

            resumeStory();

        }

    }

});

// ==========================================

console.log("✅ STORIES PART 2B LOADED");
/* ==========================================
   VIEWORA STORIES.JS
   PART 3A
   Story Upload
========================================== */

// ==========================================
// Globals
// ==========================================

let selectedStoryFile = null;
let uploadTask = null;

// ==========================================
// Open Gallery
// ==========================================

window.openStoryGallery = function(){

    const input =
    document.getElementById("storyFile");

    if(input){

        input.click();

    }

};

// ==========================================
// File Selected
// ==========================================

document.addEventListener("DOMContentLoaded",()=>{

    const input =
    document.getElementById("storyFile");

    if(!input) return;

    input.addEventListener(

        "change",

        selectStoryFile

    );

});

// ==========================================
// Select File
// ==========================================

function selectStoryFile(e){

    const file=e.target.files[0];

    if(!file) return;

    if(file.size > 100*1024*1024){

        showToast("Maximum size 100MB","error");

        return;

    }

    selectedStoryFile=file;

    previewStory(file);

}

// ==========================================
// Preview
// ==========================================

function previewStory(file){

    const preview=
    document.getElementById("storyPreview");

    if(!preview) return;

    preview.innerHTML="";

    const url=
    URL.createObjectURL(file);

    if(file.type.startsWith("image")){

        preview.innerHTML=`

        <img

        src="${url}"

        style="

        width:100%;

        border-radius:18px;

        max-height:420px;

        object-fit:cover;

        ">

        `;

    }

    else{

        preview.innerHTML=`

        <video

        controls

        autoplay

        muted

        style="

        width:100%;

        border-radius:18px;

        max-height:420px;

        ">

        <source src="${url}">

        </video>

        `;

    }

}

// ==========================================
// Upload Story
// ==========================================

window.uploadStory = async function(){

    if(!selectedStoryFile){

        showToast(

        "Select a story first",

        "warning"

        );

        return;

    }

    if(!currentUser){

        return;

    }

    const ext=
    selectedStoryFile.name
    .split(".")
    .pop();

    const fileName=

    Date.now()+"_"+

    currentUser.uid+

    "."+ext;

    const ref=

    storage.ref(

    "stories/"+fileName

    );

    uploadTask=

    ref.put(selectedStoryFile);

    uploadTask.on(

    "state_changed",

    snapshot=>{

        const percent=Math.floor(

        snapshot.bytesTransferred/

        snapshot.totalBytes*100

        );

        updateUploadProgress(percent);

    },

    error=>{

        console.error(error);

        showToast(

        error.message,

        "error"

        );

    },

    async()=>{

        const url=

        await ref.getDownloadURL();

        saveStory(url);

    });

};

// ==========================================
// Progress
// ==========================================

function updateUploadProgress(percent){

    const bar=

    document.getElementById(

    "storyUploadBar"

    );

    if(bar){

        bar.style.width=

        percent+"%";

    }

}

// ==========================================

console.log("✅ STORIES PART 3A LOADED");
/* ==========================================
   VIEWORA STORIES.JS
   PART 3B
   Save Story + Success + Cancel
========================================== */

// ==========================================
// Save Story
// ==========================================

async function saveStory(downloadURL){

    try{

        const userSnap =
        await db.ref("users/"+currentUser.uid)
        .once("value");

        const user =
        userSnap.val() || {};

        const storyId =
        db.ref("stories").push().key;

        await db.ref("stories/"+storyId).set({

            storyId:storyId,

            uid:currentUser.uid,

            name:user.name || "User",

            username:user.username || "user",

            profilePhoto:
            user.profilePhoto || "users.jpg",

            mediaUrl:downloadURL,

            type:selectedStoryFile.type.startsWith("video")
            ? "video"
            : "image",

            createdAt:Date.now(),

            expiresAt:
            Date.now()+86400000,

            likes:0,

            replies:0,

            views:0

        });

        uploadSuccess();

    }

    catch(error){

        console.error(error);

        showToast(

            "Upload Failed",

            "error"

        );

    }

}

// ==========================================
// Upload Success
// ==========================================

function uploadSuccess(){

    updateUploadProgress(100);

    clearStoryPreview();

    refreshStoryRing();

    showToast(

        "Story Uploaded ✅",

        "success"

    );

}

// ==========================================
// Cancel Upload
// ==========================================

window.cancelStoryUpload=function(){

    if(uploadTask){

        uploadTask.cancel();

        uploadTask=null;

    }

    clearStoryPreview();

    showToast(

        "Upload Cancelled",

        "warning"

    );

};

// ==========================================
// Retry Upload
// ==========================================

window.retryStoryUpload=function(){

    if(selectedStoryFile){

        uploadStory();

    }

};

// ==========================================
// Clear Preview
// ==========================================

function clearStoryPreview(){

    selectedStoryFile=null;

    const input=
    document.getElementById("storyFile");

    if(input){

        input.value="";

    }

    const preview=
    document.getElementById("storyPreview");

    if(preview){

        preview.innerHTML="";

    }

    updateUploadProgress(0);

}

// ==========================================
// Success Animation
// ==========================================

function storySuccessAnimation(){

    const preview=
    document.getElementById("storyPreview");

    if(!preview) return;

    preview.animate(

    [

        {

            transform:"scale(.85)",

            opacity:.3

        },

        {

            transform:"scale(1.08)",

            opacity:1

        },

        {

            transform:"scale(1)"

        }

    ],

    {

        duration:600,

        easing:"ease"

    });

}

// ==========================================
// Refresh Stories
// ==========================================

setInterval(()=>{

    loadStories();

},60000);

// ==========================================

console.log("✅ STORIES PART 3B LOADED");
/* ==========================================
   VIEWORA STORIES.JS
   PART 4 (FINAL)
   Likes • Replies • Views • Auto Delete
========================================== */

// ==========================================
// Like Story
// ==========================================

window.likeStory = async function(){

    if(!currentUser) return;

    const story = stories[currentStoryIndex];

    if(!story) return;

    const likeRef =
    db.ref(
        "storyLikes/" +
        story.id +
        "/" +
        currentUser.uid
    );

    const snap =
    await likeRef.once("value");

    if(snap.exists()){

        await likeRef.remove();

        db.ref("stories/"+story.id+"/likes")
        .transaction(v=>(v||1)-1);

    }else{

        await likeRef.set(true);

        db.ref("stories/"+story.id+"/likes")
        .transaction(v=>(v||0)+1);

    }

};

// ==========================================
// Reply Story
// ==========================================

window.replyStory = function(){

    const story =
    stories[currentStoryIndex];

    if(!story) return;

    const message =
    prompt("Reply to story");

    if(!message) return;

    const id =
    db.ref("storyReplies")
    .push().key;

    db.ref(
        "storyReplies/" +
        story.id +
        "/" +
        id

    ).set({

        uid:currentUser.uid,

        text:message,

        createdAt:Date.now()

    });

    db.ref(
        "stories/" +
        story.id +
        "/replies"

    ).transaction(v=>(v||0)+1);

    showToast(
        "Reply Sent",
        "success"
    );

};

// ==========================================
// View Counter
// ==========================================

function addStoryView(storyId){

    if(!currentUser) return;

    const ref=
    db.ref(

    "storyViews/"+

    storyId+"/"+
    currentUser.uid

    );

    ref.once("value")

    .then(snap=>{

        if(snap.exists()) return;

        ref.set(true);

        db.ref(
            "stories/"+storyId+"/views"
        ).transaction(

            v=>(v||0)+1

        );

    });

}

// ==========================================
// Override Seen
// ==========================================

const oldSeen =
markStorySeen;

markStorySeen=function(id){

    oldSeen(id);

    addStoryView(id);

};

// ==========================================
// Auto Delete
// ==========================================

function cleanExpiredStories(){

    db.ref("stories")

    .once("value")

    .then(snapshot=>{

        if(!snapshot.exists()) return;

        const now=Date.now();

        snapshot.forEach(child=>{

            const story=child.val();

            if(

                story.expiresAt

                <

                now

            ){

                db.ref(
                "stories/"+child.key
                ).remove();

            }

        });

    });

}

cleanExpiredStories();

setInterval(

cleanExpiredStories,

300000

);

// ==========================================
// Long Press Pause
// ==========================================

let hold=false;

if(storyViewer){

storyViewer.addEventListener(

"touchstart",

()=>{

hold=true;

pauseStory();

}

);

storyViewer.addEventListener(

"touchend",

()=>{

if(hold){

resumeStory();

hold=false;

}

}

);

}

// ==========================================
// Refresh
// ==========================================

window.refreshStories=function(){

loadStories();

};

// ==========================================
// Story Count
// ==========================================

window.getStoryCount=function(){

return stories.length;

};

// ==========================================
// Current Story
// ==========================================

window.getCurrentStory=function(){

return stories[currentStoryIndex];

};

// ==========================================
// Preload Next
// ==========================================

function preloadNextStory(){

const next=

stories[currentStoryIndex+1];

if(!next) return;

if(next.type==="image"){

const img=new Image();

img.src=

next.mediaUrl||

next.url;

}

}

const oldShow=

showStory;

showStory=function(){

oldShow();

preloadNextStory();

};

// ==========================================
// Network
// ==========================================

window.addEventListener(

"offline",

()=>{

showToast(

"Offline Mode",

"warning"

);

}

);

window.addEventListener(

"online",

()=>{

showToast(

"Back Online",

"success"

);

refreshStories();

}

);

// ==========================================
// Final
// ==========================================

console.log("=================================");
console.log("📖 Viewora Stories Loaded");
console.log("🖼 Image Stories Ready");
console.log("🎥 Video Stories Ready");
console.log("❤️ Story Likes Ready");
console.log("💬 Story Replies Ready");
console.log("👀 Story Views Ready");
console.log("🔥 Premium Version Active");
console.log("=================================");