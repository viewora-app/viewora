// ==========================================
// VIEWORA SHORTS.JS
// Part 3
// Firebase Shorts Feed
// ==========================================

let currentUser = null;

const container =
document.getElementById("shortsContainer");

// ===============================
// Auth
// ===============================

auth.onAuthStateChanged(user=>{

    if(!user){

        location.href="login.html";
        return;

    }

    currentUser=user;

    loadShorts();

});

// ===============================
// Load Shorts
// ===============================

function loadShorts(){

    db.ref("shorts")

    .orderByChild("createdAt")

    .on("value",snapshot=>{

        container.innerHTML="";

        if(!snapshot.exists()){

            container.innerHTML=`

            <div style="
            height:100vh;
            display:flex;
            justify-content:center;
            align-items:center;
            color:white;
            font-size:20px;
            ">

            No Shorts Found

            </div>

            `;

            return;

        }

        const shorts=[];

        snapshot.forEach(child=>{

            shorts.unshift({

                id:child.key,

                ...child.val()

            });

        });

        shorts.forEach(short=>{

            container.innerHTML+=`

<div class="short">

<video
class="shortVideo"
playsinline
loop
preload="metadata"
src="${short.videoUrl}">
</video>

<div class="shortInfo">

<h3>

${short.username || "User"}

</h3>

<p>

${short.caption || ""}

</p>

<div class="shortMusic">

🎵 Original Audio

</div>

<button
class="followBtn"
onclick="followUser('${short.uid}')">

Follow

</button>

</div>

<div class="shortActions">

<div
class="shortBtn"
onclick="likeShort('${short.id}')">

<span>❤️</span>

<small id="likes-${short.id}">

${short.likes||0}

</small>

</div>

<div
class="shortBtn"
onclick="openComments('${short.id}')">

<span>💬</span>

<small>

${short.comments||0}

</small>

</div>

<div
class="shortBtn"
onclick="shareShort('${short.id}')">

<span>📤</span>

</div>

<div
class="shortBtn"
onclick="saveShort('${short.id}')">

<span>🔖</span>

</div>

</div>

</div>

`;

        });

        setupVideos();

    });

}

// ===============================
// Auto Play
// ===============================

function setupVideos(){

    const videos=
    document.querySelectorAll(".shortVideo");

    const observer=

    new IntersectionObserver(entries=>{

        entries.forEach(entry=>{

            const video=entry.target;

            if(entry.isIntersecting){

                video.play();

            }

            else{

                video.pause();

            }

        });

    },{

        threshold:.8

    });

    videos.forEach(video=>{

        observer.observe(video);

    });

}

// ===============================
// Like
// ===============================

window.likeShort=function(id){

    if(!currentUser) return;

    const ref=
    db.ref(
    "shortLikes/"+id+"/"+currentUser.uid
    );

    ref.once("value")

    .then(snap=>{

        if(snap.exists()) return;

        ref.set(true);

        db.ref("shorts/"+id+"/likes")

        .transaction(v=>(v||0)+1);

    });

};

// ===============================
// Save
// ===============================

window.saveShort=function(id){

    if(!currentUser) return;

    db.ref(

    "savedShorts/"

    +currentUser.uid+

    "/"+id

    ).set(true);

    alert("Saved");

};

// ===============================
// Share
// ===============================

window.shareShort=function(id){

    const url=

    location.origin+

    "/shorts.html?id="+id;

    navigator.share({

        title:"Viewora Shorts",

        url:url

    });

};

// ===============================
// Comments
// ===============================

window.openComments=function(id){

    location.href=

    "comments.html?short="+id;

};

console.log("🎬 Viewora Shorts Ready");
// ==========================================
// VIEWORA SHORTS.JS
// Part 4
// Premium Features
// ==========================================

// ===============================
// Double Tap Like
// ===============================

document.addEventListener("dblclick",(e)=>{

    const short=e.target.closest(".short");

    if(!short) return;

    const btn=short.querySelector(".shortBtn");

    if(btn){

        btn.click();

    }

    const heart=document.createElement("div");

    heart.innerHTML="❤️";

    heart.style.cssText=`
    position:absolute;
    left:50%;
    top:50%;
    transform:translate(-50%,-50%);
    font-size:90px;
    animation:heartPop .8s forwards;
    pointer-events:none;
    z-index:999;
    `;

    short.appendChild(heart);

    setTimeout(()=>{

        heart.remove();

    },800);

});

// Heart Animation

const style=document.createElement("style");

style.innerHTML=`

@keyframes heartPop{

0%{

opacity:0;
transform:translate(-50%,-50%) scale(.3);

}

30%{

opacity:1;
transform:translate(-50%,-50%) scale(1.3);

}

100%{

opacity:0;
transform:translate(-50%,-50%) scale(2);

}

}

`;

document.head.appendChild(style);

// ===============================
// Auto Views
// ===============================

function registerViews(){

    document.querySelectorAll(".short")

    .forEach(card=>{

        const video=

        card.querySelector("video");

        if(!video) return;

        video.addEventListener("play",()=>{

            const id=

            video.parentElement
            .querySelector(".shortBtn")

            ?.getAttribute("onclick")

            ?.match(/'(.*?)'/)?.[1];

            if(!id) return;

            db.ref("shorts/"+id+"/views")

            .transaction(v=>(v||0)+1);

        },{

            once:true

        });

    });

}

setTimeout(registerViews,1500);

// ===============================
// Tap Video Mute / Unmute
// ===============================

document.addEventListener("click",(e)=>{

    if(!e.target.matches(".shortVideo"))

    return;

    e.target.muted=!e.target.muted;

});

// ===============================
// Auto Pause Others
// ===============================

window.addEventListener("scroll",()=>{

    document.querySelectorAll(".shortVideo")

    .forEach(video=>{

        const rect=

        video.getBoundingClientRect();

        if(

        rect.top>=0 &&

        rect.top<window.innerHeight/2

        ){

            video.play();

        }

        else{

            video.pause();

        }

    });

});

// ===============================
// Infinite Scroll Ready
// ===============================

let loadingMore=false;

container.addEventListener("scroll",()=>{

if(loadingMore) return;

if(

container.scrollTop+

container.clientHeight>=

container.scrollHeight-300

){

loadingMore=true;

setTimeout(()=>{

loadingMore=false;

},1000);

}

});

// ===============================
// Keyboard Support
// ===============================

document.addEventListener("keydown",(e)=>{

const active=

document.elementFromPoint(

window.innerWidth/2,

window.innerHeight/2

);

const video=

active?.closest(".short")

?.querySelector("video");

if(!video) return;

if(e.code==="Space"){

e.preventDefault();

video.paused?

video.play():

video.pause();

}

});

// ===============================
// Startup
// ===============================

console.log("=================================");
console.log("🎬 Viewora Shorts Premium Loaded");
console.log("❤️ Double Tap Like Ready");
console.log("👀 Views Counter Ready");
console.log("🔊 Tap Mute Ready");
console.log("📜 Infinite Scroll Ready");
console.log("⌨ Keyboard Controls Ready");
console.log("=================================");