/*=========================================
        VIEWORA USERS V9
        users.js - PART 1
 Firebase • Authentication • Variables
=========================================*/

"use strict";

console.log("=================================");
console.log(" VIEWORA USERS V9 ");
console.log(" Part 1 Loaded");
console.log("=================================");

/*=========================================
DOM Elements
=========================================*/

const pageLoader=document.getElementById("pageLoader");
const app=document.getElementById("app");

const usersList=document.getElementById("usersList");
const suggestedUsers=document.getElementById("suggestedUsers");
const onlineUsers=document.getElementById("onlineUsers");

const searchInput=document.getElementById("searchInput");
const clearSearch=document.getElementById("clearSearch");

const totalUsers=document.getElementById("totalUsers");
const onlineCount=document.getElementById("onlineCount");

const profileModal=document.getElementById("profileModal");

const skeleton=document.getElementById("usersSkeleton");
const emptyState=document.getElementById("emptyState");

const toast=document.getElementById("toast");
const toastText=document.getElementById("toastText");
const toastIcon=document.getElementById("toastIcon");

const scrollTopBtn=document.getElementById("scrollTopBtn");

const refreshBtn=document.getElementById("refreshBtn");
const backBtn=document.getElementById("backBtn");

/*=========================================
Variables
=========================================*/

let currentUser=null;
let currentProfile=null;

let users=[];
let filteredUsers=[];

let following=[];
let followers=[];

let onlineUsersList=[];

let usersListener=null;
let onlineListener=null;

let initialized=false;

/*=========================================
Loader
=========================================*/

function showLoader(){

    pageLoader?.classList.remove("hidden");
    app?.classList.add("hidden");

}

function hideLoader(){

    pageLoader?.classList.add("hidden");
    app?.classList.remove("hidden");
    app?.classList.add("fadeIn");

}

/*=========================================
Skeleton
=========================================*/

function showSkeleton(){

    skeleton?.classList.remove("hidden");
    usersList?.classList.add("hidden");

}

function hideSkeleton(){

    skeleton?.classList.add("hidden");
    usersList?.classList.remove("hidden");

}

/*=========================================
Toast
=========================================*/

function showToast(text,success=true){

    if(!toast) return;

    toastText.textContent=text;

    toastIcon.className=
    success
    ?
    "fa-solid fa-circle-check"
    :
    "fa-solid fa-circle-xmark";

    toast.style.background=
    success
    ?
    "#16a34a"
    :
    "#dc2626";

    toast.classList.remove("hidden");

    clearTimeout(window.toastTimer);

    window.toastTimer=setTimeout(()=>{

        toast.classList.add("hidden");

    },2500);

}

/*=========================================
Helpers
=========================================*/

function avatar(url){

    return url || "assets/default-avatar.png";

}

function formatNumber(value){

    value=Number(value)||0;

    if(value>=1000000){

        return (value/1000000).toFixed(1)+"M";

    }

    if(value>=1000){

        return (value/1000).toFixed(1)+"K";

    }

    return value;

}

function shuffle(array){

    return [...array].sort(()=>Math.random()-0.5);

}

/*=========================================
Authentication
=========================================*/

auth.onAuthStateChanged(async(user)=>{

    if(!user){

        location.href="login.html";
        return;

    }

    currentUser=user;

    showLoader();
    showSkeleton();

    try{

        await loadCurrentUser();

        initializeUsers();

    }

    catch(error){

        console.error(error);

        hideLoader();

        showToast("Unable to load profile",false);

    }

});

/*=========================================
Load Current User
=========================================*/

async function loadCurrentUser(){

    const snap=
    await db.ref("users/"+currentUser.uid)
    .once("value");

    if(!snap.exists()){

        throw new Error("User profile not found");

    }

    currentProfile=snap.val();

    following=currentProfile.following || [];

    followers=currentProfile.followers || [];

    if(!Array.isArray(following)){

        following=[];

    }

    if(!Array.isArray(followers)){

        followers=[];

    }

}

/*=========================================
Online Status
=========================================*/

function updateMyStatus(status){

    if(!currentUser) return;

    db.ref("users/"+currentUser.uid).update({

        online:status,

        lastSeen:Date.now()

    });

}

window.addEventListener("load",()=>{

    updateMyStatus(true);

});

window.addEventListener("beforeunload",()=>{

    updateMyStatus(false);

});

/*=========================================
Internet Status
=========================================*/

window.addEventListener("online",()=>{

    showToast("Back Online");

});

window.addEventListener("offline",()=>{

    showToast("No Internet",false);

});

/*=========================================
Initialize
=========================================*/

function initializeUsers(){

    if(initialized) return;

    initialized=true;

    loadUsers();

    listenOnlineUsers();

    hideSkeleton();

    hideLoader();

}

console.log("✅ users.js Part 1 Ready");
/*=========================================
        VIEWORA USERS V9
        users.js - PART 2
 Load Users • Search • Suggested Users
=========================================*/

/*=========================================
Load Users
=========================================*/

function loadUsers(){

    if(usersListener){

        db.ref("users").off("value",usersListener);

    }

    showLoader();
    showSkeleton();

    usersListener=(snapshot)=>{

        users=[];

        snapshot.forEach(child=>{

            const user=child.val()||{};

            user.uid=child.key;

            if(currentUser && user.uid===currentUser.uid){

                return;

            }

            users.push(user);

        });

        users.sort((a,b)=>{

            return (Number(b.followers)||0)-
                   (Number(a.followers)||0);

        });

        filteredUsers=[...users];

        renderSuggestedUsers();

        renderUsers(filteredUsers);

        updateCounters();

        hideSkeleton();

        hideLoader();

    };

    db.ref("users").on("value",usersListener);

}

/*=========================================
Update Counters
=========================================*/

function updateCounters(){

    if(totalUsers){

        totalUsers.textContent=

        users.length+" Users";

    }

    if(onlineCount){

        onlineCount.textContent=

        onlineUsersList.length+" Online";

    }

}

/*=========================================
Search Users
=========================================*/

searchInput?.addEventListener("input",()=>{

    const keyword=

    searchInput.value
    .trim()
    .toLowerCase();

    if(keyword===""){

        filteredUsers=[...users];

    }

    else{

        filteredUsers=users.filter(user=>{

            return(

                (user.name||"")
                .toLowerCase()
                .includes(keyword)

                ||

                (user.username||"")
                .toLowerCase()
                .includes(keyword)

                ||

                (user.bio||"")
                .toLowerCase()
                .includes(keyword)

            );

        });

    }

    renderUsers(filteredUsers);

});

/*=========================================
Clear Search
=========================================*/

clearSearch?.addEventListener("click",()=>{

    searchInput.value="";

    filteredUsers=[...users];

    renderUsers(filteredUsers);

});

/*=========================================
Suggested Users
=========================================*/

function renderSuggestedUsers(){

    if(!suggestedUsers) return;

    suggestedUsers.innerHTML="";

    shuffle(users)

    .slice(0,8)

    .forEach(user=>{

        suggestedUsers.innerHTML+=`

<div class="suggestCard fadeIn"

onclick="openProfile('${user.uid}')">

<img

src="${avatar(user.photoURL)}"

onerror="this.src='assets/default-avatar.png'">

<h4>

${user.name||"Unknown"}

${user.verified?

'<i class="fa-solid fa-circle-check verified"></i>'

:""}

</h4>

<p>

@${user.username||"user"}

</p>

<button

onclick="event.stopPropagation();
followUser('${user.uid}')">

${following.includes(user.uid)

?

"Following"

:

"Follow"}

</button>

</div>

`;

    });

}

/*=========================================
Render Users
=========================================*/

function renderUsers(list){

    if(!usersList) return;

    usersList.innerHTML="";

    if(list.length===0){

        emptyState?.classList.remove("hidden");

        return;

    }

    emptyState?.classList.add("hidden");

    list.forEach(user=>{

        const isFollowing=

        following.includes(user.uid);

        usersList.innerHTML+=`

<div class="userCard fadeIn"

onclick="openProfile('${user.uid}')">

<img

src="${avatar(user.photoURL)}"

onerror="this.src='assets/default-avatar.png'">

<div class="userInfo">

<h3>

${user.name||"Unknown"}

${user.verified?

'<i class="fa-solid fa-circle-check verified"></i>'

:""}

</h3>

<p>

@${user.username||"user"}

</p>

<div class="userStats">

<span>

${formatNumber(user.followers||0)}

Followers

</span>

<span>

${formatNumber(user.posts||0)}

Posts

</span>

</div>

</div>

<button

class="followBtn"

onclick="event.stopPropagation();
followUser('${user.uid}')">

${isFollowing

?

"Following"

:

"Follow"}

</button>

</div>

`;

    });

    observeCards();

    lazyLoadImages();

}

/*=========================================
Refresh List
=========================================*/

function refreshUsers(){

    renderSuggestedUsers();

    renderUsers(filteredUsers);

    updateCounters();

}

console.log("✅ users.js Part 2 Ready");
/*=========================================
        VIEWORA USERS V9
        users.js - PART 3
 Online Users • Follow • Profile Modal
=========================================*/

/*=========================================
Realtime Online Users
=========================================*/

function listenOnlineUsers(){

    if(onlineListener){

        db.ref("users").off("value",onlineListener);

    }

    onlineListener=(snapshot)=>{

        onlineUsersList=[];

        if(onlineUsers){

            onlineUsers.innerHTML="";

        }

        snapshot.forEach(child=>{

            const user=child.val()||{};

            user.uid=child.key;

            if(currentUser && user.uid===currentUser.uid){

                return;

            }

            if(user.online===true){

                onlineUsersList.push(user);

            }

        });

        onlineUsersList.sort((a,b)=>

            (b.lastSeen||0)-(a.lastSeen||0)

        );

        if(onlineUsersList.length===0){

            onlineUsers.innerHTML=`

            <div class="emptyOnline">

                <i class="fa-solid fa-user-slash"></i>

                <p>No users online</p>

            </div>

            `;

        }

        else{

            onlineUsersList.forEach(user=>{

                onlineUsers.innerHTML+=`

<div class="onlineUser fadeIn"

onclick="openProfile('${user.uid}')">

<div class="onlineAvatar">

<img

src="${avatar(user.photoURL)}"

onerror="this.src='assets/default-avatar.png'">

<span class="onlineDot"></span>

</div>

<h5>

${user.name||"User"}

</h5>

</div>

`;

            });

        }

        updateCounters();

    };

    db.ref("users").on("value",onlineListener);

}

/*=========================================
Follow / Unfollow
=========================================*/

async function followUser(uid){

    try{

        const myRef=db.ref("users/"+currentUser.uid);

        const targetRef=db.ref("users/"+uid);

        const mySnap=await myRef.once("value");
        const me=mySnap.val()||{};

        let myFollowing=me.following||[];

        if(!Array.isArray(myFollowing)){

            myFollowing=[];

        }

        const targetSnap=await targetRef.once("value");
        const target=targetSnap.val()||{};

        if(myFollowing.includes(uid)){

            myFollowing=myFollowing.filter(id=>id!==uid);

            await myRef.update({

                following:myFollowing

            });

            await targetRef.update({

                followers:Math.max(

                    0,

                    (target.followers||0)-1

                )

            });

            showToast("Unfollowed");

        }

        else{

            myFollowing.push(uid);

            await myRef.update({

                following:myFollowing

            });

            await targetRef.update({

                followers:

                (target.followers||0)+1

            });

            showToast("Following");

        }

        following=myFollowing;

        refreshUsers();

    }

    catch(error){

        console.error(error);

        showToast("Something went wrong",false);

    }

}

/*=========================================
Open Profile Modal
=========================================*/

function openProfile(uid){

    const user=

    users.find(item=>item.uid===uid);

    if(!user) return;

    profileModal?.classList.remove("hidden");

    document.getElementById("modalAvatar").src=

    avatar(user.photoURL);

    document.getElementById("modalName").textContent=

    user.name||"Unknown";

    document.getElementById("modalUsername").textContent=

    "@"+(user.username||"user");

    document.getElementById("modalBio").textContent=

    user.bio||"No bio available.";

    document.getElementById("modalPosts").textContent=

    formatNumber(user.posts||0);

    document.getElementById("modalFollowers").textContent=

    formatNumber(user.followers||0);

    document.getElementById("modalFollowing").textContent=

    formatNumber(user.followingCount||0);

    const followBtn=document.getElementById("followBtn");

    if(following.includes(uid)){

        followBtn.innerHTML=

        '<i class="fa-solid fa-user-check"></i> Following';

    }

    else{

        followBtn.innerHTML=

        '<i class="fa-solid fa-user-plus"></i> Follow';

    }

    followBtn.onclick=()=>{

        followUser(uid);

    };

    document.getElementById("messageBtn").onclick=()=>{

        location.href="chat.html?uid="+uid;

    };

}

/*=========================================
Close Modal
=========================================*/

document.getElementById("closeModal")

?.addEventListener("click",()=>{

    profileModal?.classList.add("hidden");

});

document.querySelector(".modalOverlay")

?.addEventListener("click",()=>{

    profileModal?.classList.add("hidden");

});

/*=========================================
ESC Key Close
=========================================*/

document.addEventListener("keydown",e=>{

    if(e.key==="Escape"){

        profileModal?.classList.add("hidden");

    }

});

console.log("✅ users.js Part 3 Ready");
/*=========================================
        VIEWORA USERS V9
        users.js - PART 4 FINAL
 Premium Effects • Performance • Initialize
=========================================*/

/*=========================================
Back Button
=========================================*/

backBtn?.addEventListener("click",()=>{

    history.back();

});

/*=========================================
Refresh Button
=========================================*/

refreshBtn?.addEventListener("click",()=>{

    showToast("Refreshing...");

    loadUsers();

});

/*=========================================
Ripple Effect
=========================================*/

document.addEventListener("click",e=>{

    const target=e.target.closest("button,a");

    if(!target) return;

    const ripple=document.createElement("span");

    ripple.className="ripple";

    const size=Math.max(

        target.clientWidth,

        target.clientHeight

    );

    const rect=target.getBoundingClientRect();

    ripple.style.width=size+"px";
    ripple.style.height=size+"px";

    ripple.style.left=

    (e.clientX-rect.left-size/2)+"px";

    ripple.style.top=

    (e.clientY-rect.top-size/2)+"px";

    target.appendChild(ripple);

    setTimeout(()=>{

        ripple.remove();

    },600);

});

/*=========================================
Pull To Refresh
=========================================*/

let touchStart=0;
let pullDistance=0;

window.addEventListener("touchstart",e=>{

    if(window.scrollY===0){

        touchStart=e.touches[0].clientY;

    }

});

window.addEventListener("touchmove",e=>{

    pullDistance=

    e.touches[0].clientY-touchStart;

});

window.addEventListener("touchend",()=>{

    if(pullDistance>120){

        showToast("Refreshing...");

        loadUsers();

    }

    pullDistance=0;

});

/*=========================================
Lazy Image Loading
=========================================*/

function lazyLoadImages(){

    const images=document.querySelectorAll("img[data-src]");

    if(images.length===0) return;

    const observer=new IntersectionObserver(entries=>{

        entries.forEach(entry=>{

            if(entry.isIntersecting){

                const img=entry.target;

                img.src=img.dataset.src;

                img.removeAttribute("data-src");

                observer.unobserve(img);

            }

        });

    });

    images.forEach(img=>observer.observe(img));

}

/*=========================================
Card Animation
=========================================*/

const cardObserver=

new IntersectionObserver(entries=>{

    entries.forEach(entry=>{

        if(entry.isIntersecting){

            entry.target.classList.add("fadeIn");

            cardObserver.unobserve(entry.target);

        }

    });

},{
    threshold:.15
});

function observeCards(){

    document.querySelectorAll(

        ".userCard,.suggestCard,.onlineUser"

    ).forEach(card=>{

        cardObserver.observe(card);

    });

}

/*=========================================
Scroll To Top
=========================================*/

window.addEventListener("scroll",()=>{

    if(window.scrollY>350){

        scrollTopBtn?.classList.remove("hidden");

    }

    else{

        scrollTopBtn?.classList.add("hidden");

    }

});

scrollTopBtn?.addEventListener("click",()=>{

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

});

/*=========================================
Search Animation
=========================================*/

searchInput?.addEventListener("focus",()=>{

    document.querySelector(".searchBox")

    ?.classList.add("focused");

});

searchInput?.addEventListener("blur",()=>{

    document.querySelector(".searchBox")

    ?.classList.remove("focused");

});

/*=========================================
Keyboard Shortcuts
=========================================*/

document.addEventListener("keydown",e=>{

    if(e.key==="/"){

        e.preventDefault();

        searchInput?.focus();

    }

});

/*=========================================
Online / Offline
=========================================*/

window.addEventListener("online",()=>{

    showToast("Internet Connected");

    loadUsers();

});

window.addEventListener("offline",()=>{

    showToast("No Internet",false);

});

/*=========================================
Vibration
=========================================*/

document.addEventListener("click",e=>{

    if(

        navigator.vibrate &&

        e.target.closest("button,a")

    ){

        navigator.vibrate(10);

    }

});

/*=========================================
Floating Button
=========================================*/

document.getElementById("addFriendBtn")

?.addEventListener("click",()=>{

    showToast("Coming Soon",false);

});

/*=========================================
Cleanup
=========================================*/

window.addEventListener("beforeunload",()=>{

    if(usersListener){

        db.ref("users")

        .off("value",usersListener);

    }

    if(onlineListener){

        db.ref("users")

        .off("value",onlineListener);

    }

});

/*=========================================
Initialize Premium Effects
=========================================*/

window.addEventListener("load",()=>{

    lazyLoadImages();

    observeCards();

    updateMyStatus(true);

    console.log(

        "%cVIEWORA USERS V9 READY",

        "color:#00AAFF;font-size:18px;font-weight:bold"

    );

});

/*=========================================
Auto Refresh Every 30 Seconds
=========================================*/

setInterval(()=>{

    if(currentUser){

        loadUsers();

    }

},30000);

/*=========================================
Finish
=========================================*/

console.log("✅ Viewora Users V9 Loaded Successfully");