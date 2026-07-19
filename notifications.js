/*======================================================
            VIEWORA STUDIO V2.0
              notifications.js
                  PART 1
      Authentication + Initialization
======================================================*/

// ==========================================
// Current User
// ==========================================

let currentUser = null;

// ==========================================
// DOM Elements
// ==========================================

const notificationContainer =
document.getElementById("notificationsList");

const notificationBadge =
document.getElementById("notificationBadge");

// ==========================================
// Firebase Auth
// ==========================================

auth.onAuthStateChanged((user)=>{

    if(!user){

        location.href="login.html";
        return;

    }

    currentUser = user;

    initializeNotifications();

});

// ==========================================
// Initialize
// ==========================================

function initializeNotifications(){

    loadNotifications();

    listenNotificationCount();

    startNotificationListener();

}

// ==========================================
// Check Login
// ==========================================

function isLoggedIn(){

    return currentUser !== null;

}

// ==========================================
// Safe UID
// ==========================================

function getUID(){

    if(!currentUser){

        return null;

    }

    return currentUser.uid;

}

// ==========================================
// Notification Reference
// ==========================================

function notificationRef(){

    return db.ref(
        "notifications/" + getUID()
    );

}

// ==========================================
// Loading Screen
// ==========================================

function showLoading(){

    const loading =
    document.getElementById("loading");

    if(loading){

        loading.style.display="flex";

    }

}

function hideLoading(){

    const loading =
    document.getElementById("loading");

    if(loading){

        loading.style.display="none";

    }

}

// ==========================================
// Empty State
// ==========================================

function showEmpty(){

    if(!notificationContainer) return;

    notificationContainer.innerHTML = `

    <div class="empty-box">

        <div class="empty-icon">🔔</div>

        <h2>No Notifications</h2>

        <p>

        Likes, comments,
        follows and messages
        will appear here.

        </p>

    </div>

    `;

}

// ==========================================
// Error State
// ==========================================

function showError(message){

    if(!notificationContainer) return;

    notificationContainer.innerHTML = `

    <div class="empty-box">

        <div class="empty-icon">⚠️</div>

        <h2>Something Went Wrong</h2>

        <p>${message}</p>

    </div>

    `;

}

// ==========================================
// Clear Container
// ==========================================

function clearNotifications(){

    if(notificationContainer){

        notificationContainer.innerHTML="";

    }

}

// ==========================================
// Console
// ==========================================

console.log(
"✅ Notifications Part 1 Loaded"
);
/*======================================================
            VIEWORA STUDIO V2.0
              notifications.js
                  PART 2
          Load Notifications
======================================================*/

// ==========================================
// Load Notifications
// ==========================================

function loadNotifications(){

    if(!isLoggedIn()) return;

    showLoading();

    notificationRef()

    .orderByChild("time")

    .limitToLast(50)

    .on(

        "value",

        snapshot=>{

            hideLoading();

            clearNotifications();

            if(!snapshot.exists()){

                showEmpty();

                return;

            }

            const list=[];

            snapshot.forEach(child=>{

                list.unshift({

                    id:child.key,

                    ...child.val()

                });

            });

            list.forEach(item=>{

                renderNotification(item);

            });

        },

        error=>{

            hideLoading();

            console.error(error);

            showError("Unable to load notifications.");

        }

    );

}

// ==========================================
// Refresh Notifications
// ==========================================

function refreshNotifications(){

    if(!isLoggedIn()) return;

    loadNotifications();

}

// ==========================================
// Total Notifications
// ==========================================

async function getNotificationCount(){

    if(!isLoggedIn()) return 0;

    const snap=

    await notificationRef()

    .once("value");

    return snap.numChildren();

}

// ==========================================
// Latest Notification
// ==========================================

async function getLatestNotification(){

    if(!isLoggedIn()) return null;

    const snap=

    await notificationRef()

    .orderByChild("time")

    .limitToLast(1)

    .once("value");

    let latest=null;

    snap.forEach(child=>{

        latest={

            id:child.key,

            ...child.val()

        };

    });

    return latest;

}

// ==========================================
// Reload Button
// ==========================================

const reloadBtn=

document.getElementById("reloadNotifications");

if(reloadBtn){

    reloadBtn.onclick=()=>{

        refreshNotifications();

    };

}

// ==========================================
// Console
// ==========================================

console.log(
"✅ Notifications Part 2 Loaded"
);
/*======================================================
            VIEWORA STUDIO V2.0
              notifications.js
                  PART 3
     Render Notification Cards + Smart Time
======================================================*/

// ==========================================
// Render Notification
// ==========================================

function renderNotification(notif){

    if(!notificationContainer) return;

    let icon="🔔";
    let color="#5B8CFF";

    switch(notif.type){

        case "like":
            icon="❤️";
            color="#ff3b5c";
            break;

        case "comment":
            icon="💬";
            color="#00b894";
            break;

        case "follow":
            icon="👤";
            color="#6c5ce7";
            break;

        case "message":
            icon="📩";
            color="#0984e3";
            break;

        case "mention":
            icon="📢";
            color="#f39c12";
            break;

        case "story":
            icon="📸";
            color="#ff006e";
            break;

    }

    const card=document.createElement("div");

    card.className=
    "notif-card "+(notif.read?"":"unread");

    card.dataset.id=notif.id;

    card.innerHTML=`

        <div
        class="notif-left"
        style="background:${color};">

            <img
            src="${notif.photo || 'non.jpg'}"
            class="notif-avatar">

        </div>

        <div class="notif-center">

            <div class="notif-title">

                <strong>

                    ${notif.fromName || "Unknown User"}

                </strong>

                ${notif.message || ""}

            </div>

            <div
            class="notif-time"
            data-time="${notif.time}">

                ${icon}
                ${formatTime(notif.time)}

            </div>

        </div>

        <div class="notif-right">

            ${!notif.read
                ?'<span class="unread-dot"></span>'
                :''}

        </div>

    `;

    card.onclick=()=>{

        openNotification(notif);

    };

    notificationContainer.appendChild(card);

    animateCard(card);

}

// ==========================================
// Card Animation
// ==========================================

function animateCard(card){

    card.animate(

    [

        {

            opacity:0,

            transform:
            "translateY(25px)"

        },

        {

            opacity:1,

            transform:
            "translateY(0)"

        }

    ],

    {

        duration:350,

        easing:"ease-out"

    });

}

// ==========================================
// Smart Time
// ==========================================

function formatTime(time){

    if(!time) return "";

    const diff=
    Date.now()-time;

    const sec=
    Math.floor(diff/1000);

    if(sec<60)
        return "Just now";

    if(sec<3600)
        return Math.floor(sec/60)+" min ago";

    if(sec<86400)
        return Math.floor(sec/3600)+" hr ago";

    if(sec<172800)
        return "Yesterday";

    if(sec<604800)
        return Math.floor(sec/86400)+" days ago";

    return new Date(time)
    .toLocaleDateString();

}

// ==========================================
// Auto Update Time
// ==========================================

setInterval(()=>{

    document

    .querySelectorAll(".notif-time")

    .forEach(el=>{

        const time=
        Number(el.dataset.time);

        el.innerHTML=

        "🕒 "+formatTime(time);

    });

},60000);

// ==========================================
// Console
// ==========================================

console.log(
"✅ Notifications Part 3 Loaded"
);
/*======================================================
            VIEWORA STUDIO V2.0
              notifications.js
                  PART 4
    Open • Read • Counter • Live Listener
======================================================*/

// ==========================================
// Open Notification
// ==========================================

function openNotification(notif){

    if(!currentUser) return;

    // Mark Read

    notificationRef()

    .child(notif.id)

    .update({

        read:true

    });

    // Open Page

    switch(notif.type){

        case "like":

        case "comment":

        case "mention":

            if(notif.postId){

                location.href=

                "post.html?id="+

                notif.postId;

            }

        break;

        case "follow":

            if(notif.fromUid){

                location.href=

                "profile.html?uid="+

                notif.fromUid;

            }

        break;

        case "message":

            if(notif.fromUid){

                location.href=

                "chat.html?uid="+

                notif.fromUid;

            }

        break;

        case "story":

            if(notif.storyId){

                location.href=

                "story.html?id="+

                notif.storyId;

            }

        break;

    }

}

// ==========================================
// Notification Counter
// ==========================================

function listenNotificationCount(){

    if(!currentUser) return;

    notificationRef()

    .on("value",snapshot=>{

        let unread=0;

        snapshot.forEach(child=>{

            if(!child.val().read){

                unread++;

            }

        });

        if(!notificationBadge) return;

        if(unread>0){

            notificationBadge.style.display="flex";

            notificationBadge.innerText=

            unread>99

            ?"99+"

            :unread;

        }else{

            notificationBadge.style.display="none";

        }

    });

}

// ==========================================
// Notification Sound
// ==========================================

function playNotificationSound(){

    const audio=

    new Audio("notification.mp3");

    audio.volume=.5;

    audio.play().catch(()=>{});

}

// ==========================================
// Live Notification Listener
// ==========================================

function startNotificationListener(){

    if(!currentUser) return;

    let firstLoad=true;

    notificationRef()

    .limitToLast(1)

    .on("child_added",snap=>{

        if(firstLoad){

            return;

        }

        playNotificationSound();

        animateLatestCard();

        showToast("🔔 New Notification");

    });

    setTimeout(()=>{

        firstLoad=false;

    },1500);

}

// ==========================================
// Animate Latest Card
// ==========================================

function animateLatestCard(){

    const card=

    document.querySelector(".notif-card");

    if(!card) return;

    card.animate([

        {

            transform:"scale(.92)",

            opacity:.3

        },

        {

            transform:"scale(1)",

            opacity:1

        }

    ],{

        duration:350,

        easing:"ease-out"

    });

}

// ==========================================

console.log(
"✅ Notifications Part 4 Loaded"
);
/*======================================================
            VIEWORA STUDIO V2.0
              notifications.js
                  PART 5
 Delete • Clear • Search • Filter • Toast
======================================================*/

// ==========================================
// Delete Notification
// ==========================================

window.deleteNotification = function(id){

    if(!currentUser) return;

    if(!confirm("Delete this notification?"))
        return;

    notificationRef()

    .child(id)

    .remove()

    .then(()=>{

        showToast("🗑 Notification Deleted");

    })

    .catch(()=>{

        showToast("❌ Delete Failed");

    });

};

// ==========================================
// Clear All Notifications
// ==========================================

window.clearAllNotifications = function(){

    if(!currentUser) return;

    if(!confirm("Clear all notifications?"))
        return;

    notificationRef()

    .remove()

    .then(()=>{

        showToast("🧹 All Notifications Cleared");

        showEmpty();

    })

    .catch(()=>{

        showToast("❌ Failed");

    });

};

// ==========================================
// Mark All Read
// ==========================================

window.markAllNotificationsRead = async function(){

    if(!currentUser) return;

    const snap = await notificationRef().once("value");

    if(!snap.exists()) return;

    const updates={};

    snap.forEach(child=>{

        updates[child.key+"/read"]=true;

    });

    await notificationRef().update(updates);

    showToast("✅ All Marked Read");

};

// ==========================================
// Search Notification
// ==========================================

function searchNotifications(text){

    text=text.toLowerCase();

    document

    .querySelectorAll(".notif-card")

    .forEach(card=>{

        const value=

        card.innerText.toLowerCase();

        card.style.display=

        value.includes(text)

        ?"flex"

        :"none";

    });

}

const searchBox=

document.getElementById("notificationSearch");

if(searchBox){

    searchBox.oninput=(e)=>{

        searchNotifications(e.target.value);

    };

}

// ==========================================
// Filter Notification
// ==========================================

function filterNotifications(type){

    document

    .querySelectorAll(".notif-card")

    .forEach(card=>{

        if(type==="all"){

            card.style.display="flex";

            return;

        }

        card.style.display=

        card.innerHTML

        .toLowerCase()

        .includes(type)

        ?"flex"

        :"none";

    });

}

// ==========================================
// Premium Toast
// ==========================================

function showToast(text){

    let toast=

    document.getElementById("toast");

    if(!toast){

        toast=

        document.createElement("div");

        toast.id="toast";

        toast.style.cssText=`

        position:fixed;
        left:50%;
        bottom:90px;
        transform:translateX(-50%);
        background:rgba(25,25,25,.95);
        color:#fff;
        padding:14px 24px;
        border-radius:40px;
        font-size:15px;
        backdrop-filter:blur(20px);
        box-shadow:0 10px 40px rgba(0,0,0,.35);
        opacity:0;
        transition:.35s;
        z-index:999999;

        `;

        document.body.appendChild(toast);

    }

    toast.innerHTML=text;

    toast.style.opacity="1";

    toast.style.bottom="100px";

    setTimeout(()=>{

        toast.style.opacity="0";

        toast.style.bottom="90px";

    },2200);

}

// ==========================================
// Keyboard Shortcut
// Ctrl + R = Mark Read
// ==========================================

document.addEventListener(

"keydown",

e=>{

    if(e.ctrlKey && e.key==="r"){

        e.preventDefault();

        markAllNotificationsRead();

    }

});

// ==========================================

console.log(
"✅ Notifications Part 5 Loaded"
);
/*======================================================
            VIEWORA STUDIO V2.0
              notifications.js
                  PART 6 FINAL
    Offline • Pull Refresh • Pin • Cleanup
======================================================*/

// ==========================================
// Offline Status
// ==========================================

window.addEventListener("offline",()=>{

    showToast("📡 You are Offline");

});

window.addEventListener("online",()=>{

    showToast("🌐 Back Online");

    refreshNotifications();

});

// ==========================================
// Pull To Refresh
// ==========================================

let startY = 0;

window.addEventListener("touchstart",(e)=>{

    startY = e.touches[0].clientY;

});

window.addEventListener("touchend",(e)=>{

    const endY = e.changedTouches[0].clientY;

    if(endY-startY>150){

        refreshNotifications();

        showToast("🔄 Notifications Updated");

    }

});

// ==========================================
// Pin Notification
// ==========================================

window.pinNotification = async function(id){

    if(!currentUser) return;

    await notificationRef()

    .child(id)

    .update({

        pinned:true

    });

    showToast("📌 Notification Pinned");

};

// ==========================================
// Remove Pin
// ==========================================

window.unpinNotification = async function(id){

    if(!currentUser) return;

    await notificationRef()

    .child(id)

    .update({

        pinned:false

    });

    showToast("✅ Pin Removed");

};

// ==========================================
// Auto Scroll Top Button
// ==========================================

const topBtn =
document.getElementById("scrollTopBtn");

if(topBtn){

window.addEventListener("scroll",()=>{

    topBtn.style.display=

    window.scrollY>500

    ?"flex"

    :"none";

});

topBtn.onclick=()=>{

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

};

}

// ==========================================
// Page Visibility
// ==========================================

document.addEventListener(

"visibilitychange",

()=>{

    if(!document.hidden){

        refreshNotifications();

    }

});

// ==========================================
// Auto Refresh
// ==========================================

setInterval(()=>{

    if(currentUser){

        refreshNotifications();

    }

},60000);

// ==========================================
// Performance
// ==========================================

window.addEventListener("beforeunload",()=>{

    notificationRef().off();

});

// ==========================================
// Version
// ==========================================

console.log("==================================");
console.log(" Viewora Notifications V2.0");
console.log(" Status : Production Ready");
console.log(" Realtime : Enabled");
console.log(" Offline : Enabled");
console.log(" Refresh : Enabled");
console.log("==================================");