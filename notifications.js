// ===========================================
// VIEWORA NOTIFICATIONS V4.0
// PART 1
// Authentication + Load Notifications
// ===========================================

let currentUser = null;

auth.onAuthStateChanged((user) => {

    if (!user) {

        location.href = "login.html";
        return;

    }

    currentUser = user;

    loadNotifications();

});

// ===========================================
// Load Notifications
// ===========================================

function loadNotifications() {

    const container =
        document.getElementById("notificationsList");

    if (!container) return;

    db.ref("notifications/" + currentUser.uid)

    .orderByChild("time")

    .limitToLast(50)

    .on("value", (snapshot) => {

        container.innerHTML = "";

        if (!snapshot.exists()) {

            container.innerHTML = `

            <div class="empty-box">

                <div class="empty-icon">🔔</div>

                <h2>No Notifications</h2>

                <p>
                Likes, comments, follows and
                messages will appear here.
                </p>

            </div>

            `;

            return;

        }

        const notifications = [];

        snapshot.forEach((child) => {

            notifications.unshift({

                id: child.key,

                ...child.val()

            });

        });

        notifications.forEach((notif) => {

            renderNotification(notif);

        });

    });

}

console.log("✅ Notifications Part 1 Loaded");
// ===========================================
// VIEWORA NOTIFICATIONS V4.0
// PART 2
// Render Notification
// ===========================================

function renderNotification(notif) {

    const container =
        document.getElementById("notificationsList");

    let icon = "🔔";

    switch (notif.type) {

        case "like":
            icon = "❤️";
            break;

        case "comment":
            icon = "💬";
            break;

        case "follow":
            icon = "👤";
            break;

        case "message":
            icon = "📩";
            break;

        case "mention":
            icon = "📢";
            break;

    }

    const card = document.createElement("div");

    card.className =
        "notif-card " +
        (notif.read ? "" : "unread");

    card.innerHTML = `

    <img
    src="${notif.photo || 'non.jpg'}"
    class="notif-avatar">

    <div class="notif-content">

        <div class="notif-title">

            <strong>
            ${notif.fromName || "Someone"}
            </strong>

            ${notif.message || ""}

        </div>

        <div class="notif-time">

            ${icon}
            ${formatTime(notif.time)}

        </div>

    </div>

    `;

    card.onclick = function () {

        openNotification(notif);

    };

    container.appendChild(card);

}

// ===========================================
// Smart Time
// ===========================================

function formatTime(time) {

    if (!time) return "";

    const diff = Date.now() - time;

    if (diff < 60000)
        return "Just now";

    if (diff < 3600000)
        return Math.floor(diff / 60000) + "m ago";

    if (diff < 86400000)
        return Math.floor(diff / 3600000) + "h ago";

    if (diff < 172800000)
        return "Yesterday";

    return new Date(time).toLocaleDateString();

}

console.log("✅ Notifications Part 2 Loaded");
// ===========================================
// VIEWORA NOTIFICATIONS V4.0
// PART 3
// Click Action + Read Status
// ===========================================

// Open Notification
function openNotification(notif) {

    // Mark as Read
    db.ref(
        "notifications/" +
        currentUser.uid +
        "/" +
        notif.id
    ).update({
        read: true
    });

    // Like / Comment
    if (
        notif.type === "like" ||
        notif.type === "comment"
    ) {

        if (notif.postId) {

            location.href =
                "post.html?id=" +
                notif.postId;

        }

        return;
    }

    // Follow
    if (notif.type === "follow") {

        if (notif.fromUid) {

            location.href =
                "profile.html?uid=" +
                notif.fromUid;

        }

        return;
    }

    // Message
    if (notif.type === "message") {

        if (notif.fromUid) {

            location.href =
                "chat.html?uid=" +
                notif.fromUid;

        }

        return;
    }

    // Mention
    if (notif.type === "mention") {

        if (notif.postId) {

            location.href =
                "post.html?id=" +
                notif.postId;

        }

    }

}

// ===========================================
// Mark All Read
// ===========================================

window.markAllNotificationsRead = function () {

    db.ref("notifications/" + currentUser.uid)

    .once("value")

    .then((snapshot) => {

        if (!snapshot.exists()) return;

        snapshot.forEach((child) => {

            child.ref.update({
                read: true
            });

        });

    });

};

// ===========================================
// Notification Counter
// ===========================================

function listenNotificationCount() {

    db.ref("notifications/" + currentUser.uid)

    .on("value", (snapshot) => {

        let unread = 0;

        snapshot.forEach((child) => {

            const n = child.val();

            if (!n.read) unread++;

        });

        const badge =
            document.getElementById(
                "notificationBadge"
            );

        if (!badge) return;

        if (unread > 0) {

            badge.style.display = "flex";
            badge.innerText = unread;

        } else {

            badge.style.display = "none";

        }

    });

}

// Start Counter
listenNotificationCount();

console.log("✅ Notifications Part 3 Loaded");
// ===========================================
// VIEWORA NOTIFICATIONS V4.0
// PART 4
// Sound + Clear + Delete + Animation
// ===========================================

// ===============================
// Notification Sound
// ===============================

function playNotificationSound(){

    const audio = new Audio("notification.mp3");

    audio.volume = 0.5;

    audio.play().catch(()=>{});

}

// Play sound for new notification

let firstLoad = true;

db.ref("notifications/" + currentUser.uid)

.on("child_added",(snap)=>{

    if(firstLoad) return;

    playNotificationSound();

    animateLatestCard();

});

setTimeout(()=>{

    firstLoad = false;

},1500);

// ===============================
// Delete Notification
// ===============================

window.deleteNotification = function(id){

    if(!confirm("Delete this notification?"))
        return;

    db.ref(
        "notifications/" +
        currentUser.uid +
        "/" +
        id
    )

    .remove()

    .then(()=>{

        showToast("Notification Deleted");

    });

};

// ===============================
// Clear All Notifications
// ===============================

window.clearAllNotifications = function(){

    if(!confirm("Clear all notifications?"))
        return;

    db.ref("notifications/" + currentUser.uid)

    .remove()

    .then(()=>{

        showToast("All Notifications Cleared");

    });

};

// ===============================
// Latest Card Animation
// ===============================

function animateLatestCard(){

    const card =
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

        duration:350

    });

}

// ===============================
// Toast Message
// ===============================

function showToast(text){

    let toast =
    document.getElementById("toast");

    if(!toast){

        toast =
        document.createElement("div");

        toast.id="toast";

        toast.style.cssText=`

        position:fixed;
        bottom:90px;
        left:50%;
        transform:translateX(-50%);
        background:#111;
        color:#fff;
        padding:12px 22px;
        border-radius:30px;
        font-size:14px;
        box-shadow:0 0 20px rgba(0,170,255,.35);
        opacity:0;
        transition:.3s;
        z-index:99999;

        `;

        document.body.appendChild(toast);

    }

    toast.innerText=text;

    toast.style.opacity="1";

    setTimeout(()=>{

        toast.style.opacity="0";

    },1800);

}

// ===============================
// Auto Refresh Time
// ===============================

setInterval(()=>{

    document
    .querySelectorAll(".notif-time")

    .forEach(el=>{

        const time =
        el.dataset.time;

        if(time){

            el.innerText =
            formatTime(Number(time));

        }

    });

},60000);

// ===============================

console.log("✅ Viewora Notifications V4 Loaded Successfully");