// =====================================
// Viewora Users.js V2.0 (Premium)
// Part 1
// =====================================

let currentUser = null;
let allUsers = [];
let usersListener = null;

// =============================
// Auth Check
// =============================

auth.onAuthStateChanged((user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    initializeUsers();

});

// =============================
// Initialize
// =============================

function initializeUsers() {

    showLoading();

    loadUsers();

}

// =============================
// Premium Loading
// =============================

function showLoading() {

    const container = document.getElementById("usersList");

    container.innerHTML = "";

    for (let i = 0; i < 6; i++) {

        container.innerHTML += `

        <div class="user-skeleton">

            <div class="skeleton-avatar"></div>

            <div class="skeleton-info">

                <div class="skeleton-line"></div>

                <div class="skeleton-line small"></div>

            </div>

        </div>

        `;

    }

}

// =============================
// Load Users
// =============================

function loadUsers() {

    if (usersListener) {

        db.ref("users").off("value", usersListener);

    }

    usersListener = (snapshot) => {

        allUsers = [];

        if (!snapshot.exists()) {

            showEmpty();

            return;

        }

        snapshot.forEach((child) => {

            const data = child.val() || {};

            if (child.key === currentUser.uid) return;

            allUsers.push({

                uid: child.key,

                name: data.name || "Unknown User",

                username: data.username || "user",

                profilePhoto: data.profilePhoto || "users.jpg",

                verified: data.verified || false,

                bio: data.bio || "",

                online: data.online || false

            });

        });

        allUsers.sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        renderUsers(allUsers);

    };

    db.ref("users").on(

        "value",

        usersListener,

        (error) => {

            console.error(error);

            showError(error.message);

        }

    );

}

// =============================
// Empty State
// =============================

function showEmpty() {

    document.getElementById("usersList").innerHTML = `

    <div style="
        text-align:center;
        padding:80px;
        color:#888;
    ">

        <h2>👥</h2>

        <h3>No Users Found</h3>

        <p>
            Users will appear here.
        </p>

    </div>

    `;

}

// =============================
// Error State
// =============================

function showError(message) {

    document.getElementById("usersList").innerHTML = `

    <div style="
        text-align:center;
        padding:70px;
        color:#ff6666;
    ">

        <h2>⚠️</h2>

        <h3>Failed to Load Users</h3>

        <small>${message}</small>

    </div>

    `;

}
// =====================================
// Viewora Users.js V2.0
// Part 2
// Premium User Cards
// =====================================

function renderUsers(users) {

    const container = document.getElementById("usersList");

    if (!users || users.length === 0) {
        showEmpty();
        return;
    }

    let html = "";

    users.forEach(user => {

        html += `

        <div class="user-card fade-in"
             onclick="viewProfile('${user.uid}')">

            <div class="user-left">

                <img
                    src="${user.profilePhoto}"
                    class="user-avatar"
                    onerror="this.src='non.jpg'">

                <div class="user-info">

                    <h3>

                        ${user.name}

                        ${user.verified
                            ? `<span class="verified">✔</span>`
                            : ""}

                    </h3>

                    <p>@${user.username}</p>

                    <small id="followers-${user.uid}">
                        Loading followers...
                    </small>

                    <div class="online-status">

                        ${user.online
                            ? "🟢 Online"
                            : "⚫ Offline"}

                    </div>

                </div>

            </div>

            <div class="user-actions">

                <button
                    id="followBtn-${user.uid}"
                    class="follow-btn"
                    onclick="event.stopPropagation();toggleFollow('${user.uid}')">

                    Follow

                </button>

                <button
                    class="message-btn"
                    onclick="event.stopPropagation();openChat('${user.uid}')">

                    💬

                </button>

            </div>

        </div>

        `;

    });

    container.innerHTML = html;

    users.forEach(user => {

        loadFollowers(user.uid);

        checkFollowing(user.uid);

    });

}

// =============================
// Followers Count
// =============================

function loadFollowers(uid) {

    db.ref("followers/" + uid)

    .on("value", snap => {

        const total = snap.numChildren();

        const el = document.getElementById("followers-" + uid);

        if (el) {

            el.innerHTML =

                total + (total === 1
                    ? " Follower"
                    : " Followers");

        }

    });

}

// =============================
// Check Following
// =============================

function checkFollowing(uid) {

    db.ref(

        "following/" +

        currentUser.uid +

        "/" +

        uid

    )

    .once("value")

    .then(snap => {

        const btn =

        document.getElementById(

            "followBtn-" + uid

        );

        if (!btn) return;

        if (snap.exists()) {

            btn.innerHTML = "Following";

            btn.style.background = "#444";

        } else {

            btn.innerHTML = "Follow";

            btn.style.background = "#00aaff";

        }

    });

}

// =============================
// Open Chat
// =============================

function openChat(uid) {

    window.location.href =

    "chat.html?uid=" + uid;

}
// =====================================
// Viewora Users.js V2.0
// Part 3
// Follow + Search + Refresh
// =====================================

// =============================
// Follow / Unfollow
// =============================

window.toggleFollow = async function(uid){

    if(!currentUser) return;

    const followingRef = db.ref(
        "following/" + currentUser.uid + "/" + uid
    );

    const followerRef = db.ref(
        "followers/" + uid + "/" + currentUser.uid
    );

    try{

        const snap = await followingRef.once("value");

        if(snap.exists()){

            await followingRef.remove();
            await followerRef.remove();

            showToast("👋 Unfollowed");

        }else{

            await followingRef.set({

                followedAt:
                firebase.database.ServerValue.TIMESTAMP

            });

            await followerRef.set({

                followedAt:
                firebase.database.ServerValue.TIMESTAMP

            });

            showToast("❤️ Following");

        }

        checkFollowing(uid);

    }catch(error){

        console.error(error);

        showToast("❌ Follow Failed");

    }

};

// =============================
// Live Search
// =============================

const searchBox =
document.getElementById("search");

if(searchBox){

searchBox.addEventListener("input",()=>{

const keyword =

searchBox.value
.toLowerCase()
.trim();

if(keyword===""){

renderUsers(allUsers);

return;

}

const filtered =

allUsers.filter(user=>{

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

renderUsers(filtered);

});

}

// =============================
// Pull Refresh
// =============================

window.refreshUsers=function(){

showLoading();

setTimeout(()=>{

loadUsers();

showToast("🔄 Refreshed");

},500);

};

// =============================
// View Profile
// =============================

window.viewProfile=function(uid){

window.location.href=

"profile.html?uid="+uid;

};

// =============================
// Animation
// =============================

document.addEventListener("click",(e)=>{

const card=

e.target.closest(".user-card");

if(card){

card.style.transform="scale(.98)";

setTimeout(()=>{

card.style.transform="scale(1)";

},120);

}

});
// =====================================
// Viewora Users.js V2.0
// Part 4 (Final)
// Premium Finish
// =====================================

// =============================
// Toast Notification
// =============================

function showToast(message){

    let toast=document.getElementById("vieworaToast");

    if(!toast){

        toast=document.createElement("div");

        toast.id="vieworaToast";

        toast.style.cssText=`
        position:fixed;
        left:50%;
        bottom:90px;
        transform:translateX(-50%);
        background:linear-gradient(135deg,#00aaff,#0066ff);
        color:#fff;
        padding:14px 24px;
        border-radius:30px;
        font-size:14px;
        font-weight:bold;
        box-shadow:0 8px 30px rgba(0,170,255,.35);
        z-index:99999;
        opacity:0;
        transition:.35s;
        `;

        document.body.appendChild(toast);

    }

    toast.innerHTML=message;

    toast.style.opacity="1";

    setTimeout(()=>{

        toast.style.opacity="0";

    },2500);

}

// =============================
// Online Status
// =============================

function updateOnlineStatus(status){

    if(!currentUser) return;

    db.ref("status/"+currentUser.uid).set({

        online:status,

        lastSeen:firebase.database.ServerValue.TIMESTAMP

    });

}

window.addEventListener("load",()=>{

    updateOnlineStatus(true);

});

window.addEventListener("beforeunload",()=>{

    updateOnlineStatus(false);

});

// =============================
// Cleanup Firebase Listeners
// =============================

window.addEventListener("beforeunload",()=>{

    if(usersListener){

        db.ref("users").off("value",usersListener);

    }

});

// =============================
// Retry Loading
// =============================

window.retryLoadUsers=function(){

    showLoading();

    loadUsers();

};

// =============================
// Page Ready
// =============================

window.addEventListener("load",()=>{

    console.log("✅ Viewora Users V2.0 Loaded");

});

// =============================
// Internet Status
// =============================

window.addEventListener("online",()=>{

    showToast("🌐 Internet Connected");

});

window.addEventListener("offline",()=>{

    showToast("📡 Internet Disconnected");

});

// =============================
// End
// =============================

console.log("🚀 Users.js Premium Ready");