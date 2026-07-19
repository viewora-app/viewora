/*=========================================
        VIEWORA V1.0
        stories.js
        PART 1
=========================================*/

// Firebase
const storyDB = firebase.database();
const storyStorage = firebase.storage();

// DOM
const storiesContainer = document.getElementById("storiesContainer");

let stories = [];
let currentStoryIndex = 0;

// 24 Hours
const STORY_DURATION = 24 * 60 * 60 * 1000;

// =========================================
// Load Stories
// =========================================

async function loadStories(){

    try{

        const snap = await storyDB
            .ref("stories")
            .once("value");

        stories = [];

        const now = Date.now();

        snap.forEach(user=>{

            user.forEach(story=>{

                const data = story.val();

                data.storyId = story.key;
                data.uid = user.key;

                if(now - data.time < STORY_DURATION){

                    stories.push(data);

                }

            });

        });

        stories.sort((a,b)=>b.time-a.time);

        renderStories();

    }catch(err){

        console.error(err);

        showToast("Story Load Failed","fa-circle-xmark");

    }

}

// =========================================
// Render Stories
// =========================================

function renderStories(){

    if(!storiesContainer) return;

    storiesContainer.innerHTML = "";

    stories.forEach((story,index)=>{

        const div = document.createElement("div");

        div.className = "story";

        div.innerHTML = `

        <div class="storyRing">

            <img src="${story.photoURL || "assets/default-avatar.png"}">

        </div>

        <p>${story.name || "User"}</p>

        `;

        div.onclick = ()=>{

            openStory(index);

        };

        storiesContainer.appendChild(div);

    });

}

// =========================================
// Open Story
// =========================================

function openStory(index){

    currentStoryIndex = index;

    if(typeof showStory==="function"){

        showStory();

    }

}

// =========================================
// Refresh Every Minute
// =========================================

setInterval(()=>{

    loadStories();

},60000);

// =========================================
// Start
// =========================================

loadStories();
/*=========================================
        VIEWORA V1.0
        stories.js
        PART 2
 Story Viewer
=========================================*/

// =========================================
// DOM
// =========================================

const storyViewer =
document.getElementById("storyViewer");

const storyImage =
document.getElementById("storyImage");

const storyVideo =
document.getElementById("storyVideo");

const progressFill =
document.querySelector(".progressFill");

const closeStoryBtn =
document.getElementById("closeStory");

let storyTimer = null;

// =========================================
// Show Story
// =========================================

function showStory(){

    if(stories.length===0) return;

    const story = stories[currentStoryIndex];

    storyViewer.classList.remove("hidden");

    progressFill.style.animation="none";

    progressFill.offsetHeight;

    progressFill.style.animation=
    "storyProgress 8s linear forwards";

    if(story.type==="video"){

        storyImage.hidden=true;

        storyVideo.hidden=false;

        storyVideo.src=story.url;

        storyVideo.play();

    }else{

        storyVideo.pause();

        storyVideo.hidden=true;

        storyImage.hidden=false;

        storyImage.src=story.url;

    }

    clearTimeout(storyTimer);

    storyTimer=setTimeout(()=>{

        nextStory();

    },8000);

}

// =========================================
// Next Story
// =========================================

function nextStory(){

    if(currentStoryIndex<stories.length-1){

        currentStoryIndex++;

        showStory();

    }else{

        closeStory();

    }

}

// =========================================
// Previous Story
// =========================================

function previousStory(){

    if(currentStoryIndex>0){

        currentStoryIndex--;

        showStory();

    }

}

// =========================================
// Close Story
// =========================================

function closeStory(){

    clearTimeout(storyTimer);

    storyVideo.pause();

    storyViewer.classList.add("hidden");

}

closeStoryBtn.onclick=closeStory;

// =========================================
// Navigation
// =========================================

storyViewer.addEventListener("click",(e)=>{

    const x=e.clientX;

    if(x<window.innerWidth/2){

        previousStory();

    }else{

        nextStory();

    }

});

// =========================================
// Keyboard Support
// =========================================

document.addEventListener("keydown",(e)=>{

    if(storyViewer.classList.contains("hidden"))
    return;

    if(e.key==="ArrowRight")
        nextStory();

    if(e.key==="ArrowLeft")
        previousStory();

    if(e.key==="Escape")
        closeStory();

});
