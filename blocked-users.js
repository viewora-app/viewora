// =======================================
// Viewora Blocked Users
// Part 1
// =======================================

// Current User
let currentUser = null;

// Firebase References
let blockedRef = null;

// =======================================
// Authentication
// =======================================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    currentUser = user;

    blockedRef = db.ref("blockedUsers/" + currentUser.uid);

    loadBlockedUsers();

});

// =======================================
// Load Blocked Users
// =======================================

function loadBlockedUsers() {

    if (!currentUser) return;

    blockedRef.once("value")

    .then((snapshot) => {

        const container =
        document.getElementById("blockedUsersList");

        const empty =
        document.getElementById("emptyState");

        container.innerHTML = "";

        if (!snapshot.exists()) {

            empty.style.display = "block";

            return;

        }

        empty.style.display = "none";

        snapshot.forEach((child) => {

            const user = child.val();

            const card = createUserCard(
                child.key,
                user
            );

            container.appendChild(card);

        });

        showToast("🚫 Blocked Users Loaded");

    })

    .catch((error) => {

        console.error(error);

        showToast("❌ Failed to load users");

    });

}

// =======================================
// Create User Card
// =======================================

function createUserCard(uid, user) {

    const card = document.createElement("div");

    card.className = "user-card";

    card.dataset.uid = uid;

    card.dataset.name =
        (user.name || "").toLowerCase();

    card.innerHTML = `

        <img
        class="user-avatar"
        src="${user.photoURL || 'default-avatar.png'}">

        <div class="user-info">

            <h3>${user.name || "Unknown User"}</h3>

            <p>@${user.username || "unknown"}</p>

        </div>

        <button
        class="unblock-btn"
        onclick="unblockUser('${uid}')">

            🔓 Unblock

        </button>

    `;

    return card;

}

// =======================================

console.log("✅ Blocked Users Part 1 Loaded");
// =======================================
// Viewora Blocked Users
// Part 2
// Unblock + Search + Live Sync
// =======================================

// =============================
// Unblock User
// =============================

async function unblockUser(uid) {

    if (!currentUser) return;

    const ok = confirm("Unblock this user?");

    if (!ok) return;

    try {

        await blockedRef.child(uid).remove();

        // Optional: Save unblock status
        await db.ref("users/" + currentUser.uid + "/unblocked/" + uid)
            .set({

                unblockedAt: firebase.database.ServerValue.TIMESTAMP

            });

        showToast("✅ User Unblocked");

        loadBlockedUsers();

    }

    catch (error) {

        console.error(error);

        showToast("❌ Unable to unblock");

    }

}

// =============================
// Search Users
// =============================

const searchBox = document.getElementById("searchUser");

if (searchBox) {

    searchBox.addEventListener("input", function () {

        const keyword = this.value
            .toLowerCase()
            .trim();

        const cards =
            document.querySelectorAll(".user-card");

        let visible = 0;

        cards.forEach(card => {

            const name =
                card.dataset.name || "";

            if (name.includes(keyword)) {

                card.style.display = "flex";

                visible++;

            } else {

                card.style.display = "none";

            }

        });

        const empty =
            document.getElementById("emptyState");

        if (cards.length > 0 && visible === 0) {

            empty.style.display = "block";

            empty.querySelector("h2").innerText =
                "No Results";

            empty.querySelector("p").innerText =
                "No blocked user matched your search.";

        }
        else if (cards.length > 0) {

            empty.style.display = "none";

        }

    });

}

// =============================
// Live Firebase Sync
// =============================

function enableBlockedSync() {

    if (!blockedRef) return;

    blockedRef.on("value", () => {

        loadBlockedUsers();

    });

}

enableBlockedSync();

// =============================
// Refresh List
// =============================

function refreshBlockedUsers() {

    loadBlockedUsers();

    showToast("🔄 List Refreshed");

}

// =============================
// Total Blocked Users
// =============================

function updateBlockedCount() {

    const total =
        document.querySelectorAll(".user-card").length;

    console.log("Blocked Users:", total);

}

// Update count after every refresh

setTimeout(updateBlockedCount,1000);

console.log("✅ Blocked Users Part 2 Loaded");
// =======================================
// Viewora Blocked Users
// Part 3
// Export + Clear All + Auto Refresh
// =======================================

// =============================
// Export Blocked Users
// =============================

async function exportBlockedUsers() {

    if (!currentUser) return;

    try {

        const snapshot = await blockedRef.once("value");

        const data = snapshot.val() || {};

        const blob = new Blob(
            [JSON.stringify(data, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;

        a.download = "blocked-users.json";

        a.click();

        URL.revokeObjectURL(url);

        showToast("📥 Blocked Users Exported");

    }

    catch (error) {

        console.error(error);

        showToast("❌ Export Failed");

    }

}

// =============================
// Clear All Blocked Users
// =============================

async function clearAllBlockedUsers() {

    if (!currentUser) return;

    const ok = confirm(
        "Remove ALL blocked users?"
    );

    if (!ok) return;

    try {

        await blockedRef.remove();

        loadBlockedUsers();

        showToast("🗑️ All Users Unblocked");

    }

    catch (error) {

        console.error(error);

        showToast("❌ Failed");

    }

}

// =============================
// Auto Refresh
// =============================

let refreshTimer = null;

function startAutoRefresh() {

    stopAutoRefresh();

    refreshTimer = setInterval(() => {

        loadBlockedUsers();

    }, 30000);

}

function stopAutoRefresh() {

    if (refreshTimer) {

        clearInterval(refreshTimer);

        refreshTimer = null;

    }

}

startAutoRefresh();

// =============================
// Internet Status
// =============================

window.addEventListener("online", () => {

    showToast("🌐 Internet Connected");

});

window.addEventListener("offline", () => {

    showToast("📡 No Internet Connection");

});

// =============================
// Pull To Refresh
// =============================

let touchStartY = 0;

window.addEventListener("touchstart", (e) => {

    touchStartY = e.touches[0].clientY;

});

window.addEventListener("touchend", (e) => {

    const endY = e.changedTouches[0].clientY;

    if (endY - touchStartY > 120) {

        loadBlockedUsers();

        showToast("🔄 Refreshing...");

    }

});

// =============================

console.log("✅ Blocked Users Part 3 Loaded");
// =======================================
// Viewora Blocked Users
// Part 4 (Final)
// =======================================

// =============================
// Premium Toast
// =============================

function showToast(message){

    let toast=document.getElementById("vieworaToast");

    if(!toast){

        toast=document.createElement("div");

        toast.id="vieworaToast";

        toast.style.cssText=`
            position:fixed;
            left:50%;
            bottom:30px;
            transform:translateX(-50%);
            background:linear-gradient(135deg,#ff1744,#7c3aed);
            color:#fff;
            padding:14px 24px;
            border-radius:30px;
            font-size:15px;
            font-weight:bold;
            box-shadow:0 12px 30px rgba(255,23,68,.35);
            z-index:99999;
            opacity:0;
            transition:.35s;
        `;

        document.body.appendChild(toast);

    }

    toast.textContent=message;

    toast.style.opacity="1";

    clearTimeout(toast.timer);

    toast.timer=setTimeout(()=>{

        toast.style.opacity="0";

    },2500);

}

// =============================
// Logout Helper
// =============================

async function logout(){

    if(!confirm("Logout from Viewora?")) return;

    try{

        await auth.signOut();

        showToast("👋 Logged Out");

        setTimeout(()=>{

            window.location.href="login.html";

        },800);

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Before Leave Cleanup
// =============================

window.addEventListener("beforeunload",()=>{

    stopAutoRefresh();

    if(blockedRef){

        blockedRef.off();

    }

});

// =============================
// Page Visibility
// =============================

document.addEventListener("visibilitychange",()=>{

    if(document.hidden){

        stopAutoRefresh();

    }else{

        startAutoRefresh();

        loadBlockedUsers();

    }

});

// =============================
// Startup
// =============================

window.addEventListener("load",()=>{

    startAutoRefresh();

    loadBlockedUsers();

    showToast("🚫 Blocked Users Ready");

});

// =============================
// Final
// =============================

console.log("================================");
console.log("🚫 Viewora Blocked Users Loaded");
console.log("✅ Firebase Connected");
console.log("✅ Search Enabled");
console.log("✅ Realtime Sync Enabled");
console.log("✅ Auto Refresh Enabled");
console.log("================================");