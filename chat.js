// ==========================================
// CHAT.JS V3.0 - PART 1
// Login + Chat Initialization
// ==========================================

let currentUser = null;
let otherUserUid = null;
let chatId = null;
let otherUser = null;

// ===============================
// Get UID from URL
// ===============================

function getOtherUserUid() {

    const params = new URLSearchParams(window.location.search);

    return params.get("uid");

}

// ===============================
// Generate Chat ID
// ===============================

function createChatId(uid1, uid2) {

    return [uid1, uid2].sort().join("_");

}

// ===============================
// Authentication
// ===============================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href = "login.html";

        return;

    }

    currentUser = user;

    otherUserUid = getOtherUserUid();

    if (!otherUserUid) {

        alert("Invalid User");

        history.back();

        return;

    }

    chatId = createChatId(currentUser.uid, otherUserUid);

    loadChatUser();

});

// ===============================
// Load Other User
// ===============================

function loadChatUser() {

    db.ref("users/" + otherUserUid)
    .on("value",(snapshot)=>{

        otherUser = snapshot.val() || {};

        const name =
        document.getElementById("chatUserName");

        const photo =
        document.getElementById("chatUserPhoto");

        const status =
        document.getElementById("chatStatus");

        if(name){

            name.innerText =
            otherUser.name || "User";

        }

        if(photo){

            photo.src =
            otherUser.profilePhoto || "non.jpg";

        }

        db.ref("status/" + otherUserUid)
        .on("value",(snap)=>{

            if(!status) return;

            if(snap.val()){

                status.innerText="🟢 Online";
                status.style.color="#00ff66";

            }else{

                status.innerText="⚫ Offline";
                status.style.color="#888";

            }

        });

        loadMessages();

        listenTyping();

    });

}

// ===============================
// Auto Online Status
// ===============================

function updateMyStatus(value){

    if(!currentUser) return;

    db.ref("status/" + currentUser.uid)
    .set(value);

}

window.addEventListener("load",()=>{

    updateMyStatus(true);

});

window.addEventListener("beforeunload",()=>{

    updateMyStatus(false);

});

// ==========================================
// END OF PART 1
// ==========================================
// ==========================================
// CHAT.JS V3.0 - PART 2
// Load Messages + Send Messages
// ==========================================

// Realtime Messages
function loadMessages() {

    const container =
        document.getElementById("messagesContainer");

    if (!container || !chatId) return;

    db.ref("chats/" + chatId + "/messages")
        .on("value", (snapshot) => {

            container.innerHTML = "";

            if (!snapshot.exists()) {

                container.innerHTML = `
                <div style="
                    text-align:center;
                    color:#888;
                    margin-top:50px;">
                    Start your conversation 👋
                </div>`;

                return;
            }

            snapshot.forEach((child) => {

                const msg = child.val();

                const isMine =
                    msg.senderUid === currentUser.uid;

                const bubble =
                    document.createElement("div");

                bubble.className =
                    isMine
                    ? "message sent"
                    : "message received";

                bubble.style.margin = "12px";

                const text =
                    document.createElement("div");

                text.innerText =
                    msg.text || "";

                const time =
                    document.createElement("small");

                time.style.opacity = ".7";

                time.innerText =
                    new Date(msg.timestamp)
                    .toLocaleTimeString([], {

                        hour: "2-digit",
                        minute: "2-digit"

                    });

                bubble.appendChild(text);
                bubble.appendChild(time);

                container.appendChild(bubble);

            });

            container.scrollTop =
                container.scrollHeight;

        });

}

// ==========================================
// Send Message
// ==========================================

window.sendMessage = function () {

    const input =
        document.getElementById("messageInput");

    if (!input) return;

    const message =
        input.value.trim();

    if (message === "")
        return;

    const data = {

        text: message,

        senderUid: currentUser.uid,

        timestamp: Date.now(),

        seen: false

    };

    db.ref("chats/" + chatId)
        .update({

            participants: [
                currentUser.uid,
                otherUserUid
            ],

            lastMessage: message,

            lastMessageTime: Date.now()

        })

        .then(() => {

            return db.ref(
                "chats/" +
                chatId +
                "/messages"
            ).push(data);

        })

        .then(() => {

            return db.ref(
                "notifications/" +
                otherUserUid
            ).push({

                type: "message",

                fromUid:
                    currentUser.uid,

                fromName:
                    currentUser.displayName ||
                    "User",

                message,

                time: Date.now(),

                read: false

            });

        })

        .then(() => {

            input.value = "";

            container =
                document.getElementById(
                    "messagesContainer"
                );

            if (container) {

                container.scrollTop =
                    container.scrollHeight;

            }

        })

        .catch((err) => {

            console.error(err);

            alert("Message failed.");

        });

};

// ==========================================
// Enter Key Support
// ==========================================

document.addEventListener(
"DOMContentLoaded",
function(){

    const input =
        document.getElementById(
            "messageInput"
        );

    if(!input) return;

    input.addEventListener(
    "keypress",
    function(e){

        if(e.key==="Enter"){

            e.preventDefault();

            sendMessage();

        }

    });

});

// ==========================================
// END OF PART 2
// ==========================================
// ==========================================
// CHAT.JS V3.0 - PART 3
// Typing + Seen + Online
// ==========================================

// Typing Indicator

function listenTyping() {

    const status =
        document.getElementById("chatStatus");

    if (!status) return;

    db.ref("typing/" + chatId + "/" + otherUserUid)
    .on("value",(snap)=>{

        if(snap.val()){

            status.innerText="✍️ Typing...";
            status.style.color="#00aaff";

        }else{

            db.ref("status/" + otherUserUid)
            .once("value")
            .then((online)=>{

                if(online.val()){

                    status.innerText="🟢 Online";
                    status.style.color="#00ff66";

                }else{

                    status.innerText="⚫ Offline";
                    status.style.color="#888";

                }

            });

        }

    });

}

// ===============================
// Send Typing Status
// ===============================

window.updateTyping=function(){

    if(!currentUser) return;

    db.ref("typing/" + chatId + "/" + currentUser.uid)
    .set(true);

    clearTimeout(window.typingTimer);

    window.typingTimer=setTimeout(()=>{

        db.ref("typing/" + chatId + "/" + currentUser.uid)
        .set(false);

    },1200);

};

// ===============================
// Attach Input Listener
// ===============================

document.addEventListener("DOMContentLoaded",()=>{

    const input=
    document.getElementById("messageInput");

    if(!input) return;

    input.addEventListener("input",updateTyping);

});

// ===============================
// Seen Status
// ===============================

function markMessagesSeen(){

    db.ref("chats/" + chatId + "/messages")
    .once("value")
    .then((snapshot)=>{

        snapshot.forEach((child)=>{

            const msg=child.val();

            if(
                msg.senderUid!==currentUser.uid &&
                !msg.seen
            ){

                child.ref.update({

                    seen:true

                });

            }

        });

    });

}

setTimeout(markMessagesSeen,1000);

// ===============================
// Live Seen Update
// ===============================

db.ref("chats/" + chatId + "/messages")
.on("child_changed",(snap)=>{

    const msg=snap.val();

    if(
        msg.senderUid===currentUser.uid &&
        msg.seen
    ){

        console.log("✅ Seen");

    }

});

// ===============================
// Update Presence
// ===============================

document.addEventListener(
"visibilitychange",
()=>{

    if(document.hidden){

        updateMyStatus(false);

    }else{

        updateMyStatus(true);

        markMessagesSeen();

    }

});

// ==========================================
// END OF PART 3
// ==========================================
// ==========================================
// CHAT.JS V3.0 - PART 4
// Delete + Edit + Reactions + Final
// ==========================================

// Delete Message
window.deleteMessage = function(messageId){

    if(!confirm("Delete this message?"))
        return;

    db.ref("chats/" + chatId + "/messages/" + messageId)
    .remove()
    .then(()=>{

        showToast("Message Deleted");

    });

};

// ===============================
// Edit Message
// ===============================

window.editMessage = function(messageId,oldText){

    const newText = prompt("Edit Message",oldText);

    if(newText===null) return;

    if(newText.trim()==="") return;

    db.ref("chats/" + chatId + "/messages/" + messageId)
    .update({

        text:newText.trim(),
        edited:true

    });

};

// ===============================
// Message Reaction
// ===============================

window.reactMessage=function(messageId,reaction){

    db.ref("chats/" + chatId +
    "/messages/" + messageId +
    "/reaction")

    .set(reaction);

};

// ===============================
// Image Message
// ===============================

window.sendImage=function(url){

    if(!url) return;

    db.ref("chats/" + chatId + "/messages")
    .push({

        senderUid:currentUser.uid,

        image:url,

        type:"image",

        timestamp:Date.now(),

        seen:false

    });

};

// ===============================
// Video Message
// ===============================

window.sendVideo=function(url){

    if(!url) return;

    db.ref("chats/" + chatId + "/messages")
    .push({

        senderUid:currentUser.uid,

        video:url,

        type:"video",

        timestamp:Date.now(),

        seen:false

    });

};

// ===============================
// Copy Message
// ===============================

window.copyMessage=function(text){

    navigator.clipboard
    .writeText(text)
    .then(()=>{

        showToast("Copied");

    });

};

// ===============================
// Share Message
// ===============================

window.shareMessage=function(text){

    if(navigator.share){

        navigator.share({

            text:text

        });

    }else{

        copyMessage(text);

    }

};

// ===============================
// Notification Sound
// ===============================

function playNotification(){

    const audio=new Audio(
    "notification.mp3"
    );

    audio.play().catch(()=>{});

}

// Play sound when new message comes

db.ref("chats/" + chatId + "/messages")
.on("child_added",(snap)=>{

    const msg=snap.val();

    if(
        msg.senderUid!==currentUser.uid
    ){

        playNotification();

    }

});

// ===============================
// Toast
// ===============================

function showToast(text){

    let t=document.getElementById("toast");

    if(!t){

        t=document.createElement("div");

        t.id="toast";

        t.style.cssText=`
        position:fixed;
        bottom:90px;
        left:50%;
        transform:translateX(-50%);
        background:#222;
        color:#fff;
        padding:12px 20px;
        border-radius:30px;
        z-index:9999;
        opacity:0;
        transition:.3s;
        `;

        document.body.appendChild(t);

    }

    t.innerText=text;

    t.style.opacity="1";

    setTimeout(()=>{

        t.style.opacity="0";

    },1800);

}

// ==========================================
// Version
// ==========================================

console.log("✅ CHAT V3.0 Loaded Successfully");