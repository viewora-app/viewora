// ==========================================
// VIEWORA STORIES V2.0 PREMIUM
// PART 1
// Authentication + Upload + Story Ring
// ==========================================

// Current User
let currentUser = null;

// Story List
let storyList = [];

// Current Story
let currentStoryIndex = 0;

// Story Timer
let storyTimer = null;

// Story Duration
const STORY_DURATION = 5000;

// ==========================================
// Auth
// ==========================================

auth.onAuthStateChanged(async (user) => {

    if (!user) {

        location.href = "login.html";

        return;

    }

    currentUser = user;

    loadMyStoryRing();

});

// ==========================================
// Create Story
// ==========================================

window.createStory = async function () {

    const mediaUrl = prompt("Enter Image / Video URL");

    if (!mediaUrl) return;

    try {

        const snap = await db
        .ref("users/" + currentUser.uid)
        .once("value");

        const user = snap.val() || {};

        const ext =
        mediaUrl
        .split(".")
        .pop()
        .toLowerCase();

        const type =
        ["mp4","mov","webm","mkv"]
        .includes(ext)
        ? "video"
        : "image";

        const storyId =
        db.ref("stories").push().key;

        await db.ref("stories/" + storyId).set({

            storyId:storyId,

            uid:currentUser.uid,

            name:user.name || "User",

            username:user.username || "",

            profilePhoto:
            user.profilePhoto || "non.jpg",

            mediaUrl:mediaUrl,

            type:type,

            createdAt:Date.now(),

            expiresAt:
            Date.now()+86400000

        });

        showToast("Story Uploaded");

        loadMyStoryRing();

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

};

// ==========================================
// Load My Story Ring
// ==========================================

function loadMyStoryRing(){

    const ring =
    document.getElementById("storyRing");

    if(!ring) return;

    db.ref("stories")

    .orderByChild("uid")

    .equalTo(currentUser.uid)

    .once("value")

    .then((snapshot)=>{

        let active=false;

        snapshot.forEach((child)=>{

            const story=child.val();

            if(
                story.expiresAt>Date.now()
            ){

                active=true;

            }

        });

        if(active){

            ring.style.background=`
            linear-gradient(
            45deg,
            #ff0066,
            #ffcc00,
            #00aaff,
            #00ff99
            )`;

            ring.style.boxShadow=
            "0 0 20px #00aaff";

        }

        else{

            ring.style.background="#444";

            ring.style.boxShadow="none";

        }

    });

}

// ==========================================
// Refresh Story Ring
// ==========================================

window.refreshStoryRing=function(){

    loadMyStoryRing();

};

// ==========================================

console.log("✅ Stories V2 Part 1 Loaded");
// ==========================================
// VIEWORA STORIES V2.0 PREMIUM
// PART 2
// Story Viewer
// ==========================================

// Open Stories
window.viewStories = async function () {

    storyList = [];

    const snap = await db.ref("stories")
    .orderByChild("createdAt")
    .once("value");

    snap.forEach((child)=>{

        const story = child.val();

        if(story.expiresAt > Date.now()){

            storyList.push(story);

        }

    });

    if(storyList.length===0){

        showToast("No Active Stories");

        return;

    }

    currentStoryIndex = 0;

    openStory(currentStoryIndex);

};

// ==========================================
// Open Story
// ==========================================

function openStory(index){

    clearTimeout(storyTimer);

    const viewer =
    document.getElementById("storyViewer");

    const image =
    document.getElementById("storyImage");

    const video =
    document.getElementById("storyVideo");

    const progress =
    document.getElementById("storyProgress");

    const userName =
    document.getElementById("storyUserName");

    viewer.style.display="flex";

    const story =
    storyList[index];

    userName.innerText =
    story.name;

    progress.innerHTML=`
    <div id="storyFill"
    style="
    height:4px;
    width:0%;
    background:#fff;
    border-radius:20px;
    transition:${STORY_DURATION}ms linear;
    ">
    </div>`;

    setTimeout(()=>{

        document
        .getElementById("storyFill")
        .style.width="100%";

    },100);

    if(story.type==="video"){

        image.style.display="none";

        video.style.display="block";

        video.src=story.mediaUrl;

        video.load();

        video.play();

    }

    else{

        video.pause();

        video.style.display="none";

        image.style.display="block";

        image.src=story.mediaUrl;

    }

    storyTimer=setTimeout(()=>{

        nextStory();

    },STORY_DURATION);

}

// ==========================================
// Next Story
// ==========================================

window.nextStory=function(){

    currentStoryIndex++;

    if(currentStoryIndex>=storyList.length){

        closeStoryViewer();

        return;

    }

    openStory(currentStoryIndex);

};

// ==========================================
// Previous Story
// ==========================================

window.prevStory=function(){

    if(currentStoryIndex===0){

        return;

    }

    currentStoryIndex--;

    openStory(currentStoryIndex);

};

// ==========================================
// Close Viewer
// ==========================================

window.closeStoryViewer=function(){

    clearTimeout(storyTimer);

    const viewer=
    document.getElementById("storyViewer");

    const video=
    document.getElementById("storyVideo");

    if(video){

        video.pause();

        video.currentTime=0;

    }

    viewer.style.display="none";

};

// ==========================================

console.log("✅ Stories V2 Part 2 Loaded");
// ==========================================
// VIEWORA STORIES V2.0 PREMIUM
// PART 3
// Seen + Navigation + Auto Cleanup
// ==========================================

// ==========================================
// Mark Story Seen
// ==========================================

async function markStorySeen(story){

    if(!currentUser) return;

    await db.ref(
        "storySeen/" +
        story.storyId + "/" +
        currentUser.uid
    ).set({

        seen:true,

        seenAt:Date.now()

    });

}

// ==========================================
// Override Open Story
// ==========================================

const originalOpenStory = openStory;

openStory = function(index){

    originalOpenStory(index);

    markStorySeen(
        storyList[index]
    );

};

// ==========================================
// Auto Delete Expired Stories
// ==========================================

function removeExpiredStories(){

    db.ref("stories")

    .once("value")

    .then((snapshot)=>{

        snapshot.forEach((child)=>{

            const story = child.val();

            if(
                story.expiresAt <= Date.now()
            ){

                child.ref.remove();

            }

        });

    });

}

setInterval(

removeExpiredStories,

60000

);

// ==========================================
// Keyboard Navigation
// ==========================================

document.addEventListener(

"keydown",

(e)=>{

    const viewer =
    document.getElementById(
        "storyViewer"
    );

    if(
        !viewer ||
        viewer.style.display!=="flex"
    ) return;

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

// ==========================================
// Tap Navigation
// ==========================================

const viewer =
document.getElementById(
    "storyViewer"
);

if(viewer){

viewer.addEventListener(

"click",

(e)=>{

const x=e.clientX;

if(

x < window.innerWidth/2

){

prevStory();

}

else{

nextStory();

}

});

}

// ==========================================
// Swipe Navigation
// ==========================================

let touchStart=0;

if(viewer){

viewer.addEventListener(

"touchstart",

(e)=>{

touchStart=

e.touches[0].clientX;

});

viewer.addEventListener(

"touchend",

(e)=>{

const end=

e.changedTouches[0].clientX;

if(

touchStart-end>80

){

nextStory();

}

else if(

end-touchStart>80

){

prevStory();

}

});

}

// ==========================================
// Pause Story
// ==========================================

window.pauseStory=function(){

    clearTimeout(storyTimer);

    const video=

    document.getElementById(
        "storyVideo"
    );

    if(video){

        video.pause();

    }

};

// ==========================================
// Resume Story
// ==========================================

window.resumeStory=function(){

    const story=

    storyList[currentStoryIndex];

    if(story.type==="video"){

        document
        .getElementById(
            "storyVideo"
        )
        .play();

    }

    storyTimer=setTimeout(

        nextStory,

        STORY_DURATION

    );

};

// ==========================================

console.log("✅ Stories Premium Part 3 Loaded");
// ==========================================
// VIEWORA STORIES V2.0 PREMIUM
// PART 4
// Reactions + Replies + Analytics
// ==========================================

// ==========================================
// Story Reaction
// ==========================================

window.reactToStory = async function (emoji) {

    if (!currentUser) return;

    const story = storyList[currentStoryIndex];

    await db.ref(
        "storyReactions/" +
        story.storyId + "/" +
        currentUser.uid
    ).set({

        emoji: emoji,

        uid: currentUser.uid,

        time: Date.now()

    });

    showToast("Reaction Sent");

};

// ==========================================
// Reply Story
// ==========================================

window.replyStory = async function () {

    if (!currentUser) return;

    const text = prompt("Reply");

    if (!text) return;

    const story = storyList[currentStoryIndex];

    await db.ref("storyReplies").push({

        storyId: story.storyId,

        ownerUid: story.uid,

        fromUid: currentUser.uid,

        message: text,

        time: Date.now()

    });

    // Notification

    await db.ref(
        "notifications/" +
        story.uid
    ).push({

        type: "story_reply",

        fromUid: currentUser.uid,

        fromName: currentUser.displayName || "User",

        message: "replied to your story",

        time: Date.now()

    });

    showToast("Reply Sent");

};

// ==========================================
// Seen Count
// ==========================================

window.loadStorySeenCount = function () {

    const story = storyList[currentStoryIndex];

    db.ref("storySeen/" + story.storyId)

    .once("value")

    .then((snapshot) => {

        const box =
        document.getElementById("storySeenCount");

        if (!box) return;

        box.innerHTML =
            "👁 " + snapshot.numChildren();

    });

};

// ==========================================
// Reaction Count
// ==========================================

window.loadReactionCount = function () {

    const story = storyList[currentStoryIndex];

    db.ref(
        "storyReactions/" +
        story.storyId
    )

    .once("value")

    .then((snapshot) => {

        const box =
        document.getElementById("storyReactionCount");

        if (!box) return;

        box.innerHTML =
            "❤️ " + snapshot.numChildren();

    });

};

// ==========================================
// Improve openStory()
// ==========================================

const premiumOpenStory = openStory;

openStory = function (index) {

    premiumOpenStory(index);

    loadStorySeenCount();

    loadReactionCount();

};

// ==========================================
// Auto Close Video
// ==========================================

const video =
document.getElementById("storyVideo");

if (video) {

    video.addEventListener("ended", () => {

        nextStory();

    });

}

// ==========================================
// Preload Next Story
// ==========================================

function preloadNextStory() {

    if (
        currentStoryIndex + 1 >=
        storyList.length
    ) return;

    const next =
    storyList[currentStoryIndex + 1];

    if (next.type === "image") {

        const img = new Image();

        img.src = next.mediaUrl;

    }

}

const oldNextStory = nextStory;

nextStory = function () {

    preloadNextStory();

    oldNextStory();

};

// ==========================================
// Story Statistics
// ==========================================

window.getStoryStats = function () {

    const story =
    storyList[currentStoryIndex];

    Promise.all([

        db.ref(
            "storySeen/" +
            story.storyId
        ).once("value"),

        db.ref(
            "storyReactions/" +
            story.storyId
        ).once("value")

    ]).then(([seen, react]) => {

        console.log({

            seen: seen.numChildren(),

            reactions: react.numChildren()

        });

    });

};

// ==========================================
// Auto Refresh Ring
// ==========================================

setInterval(() => {

    refreshStoryRing();

}, 300000);

// ==========================================

console.log("✅ VIEWORA STORIES V2.0 PREMIUM FINAL LOADED");