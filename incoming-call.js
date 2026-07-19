// ==========================================
// Viewora Incoming Call
// ==========================================

console.log("📲 Incoming Call");

// URL Params
const params = new URLSearchParams(window.location.search);
const callId = params.get("callId");

if (!callId) {

    alert("Invalid Call");

    location.href = "chat.html";

}

// Firebase
const callRef = db.ref("calls/" + callId);

// Elements
const callerPhoto = document.getElementById("callerPhoto");
const callerName = document.getElementById("callerName");
const callType = document.getElementById("callType");

const status = document.getElementById("status");

const acceptBtn = document.getElementById("acceptBtn");
const rejectBtn = document.getElementById("rejectBtn");

const ringtone = document.getElementById("ringtone");

// ==========================================
// Load Call
// ==========================================

let currentCall = null;

callRef.once("value").then(async(snap)=>{

    if(!snap.exists()){

        location.href="chat.html";

        return;

    }

    currentCall = snap.val();

    // Caller Profile
    const userSnap = await db
    .ref("users/"+currentCall.caller)
    .once("value");

    if(userSnap.exists()){

        const user=userSnap.val();

        callerName.textContent=
        user.name || "Unknown";

        if(user.photoURL){

            callerPhoto.src=user.photoURL;

        }

    }

    if(currentCall.type==="video"){

        callType.textContent="🎥 Video Call";

    }else{

        callType.textContent="📞 Voice Call";

    }

});

// ==========================================
// Ringtone
// ==========================================

ringtone.play().catch(()=>{});

// ==========================================
// Vibration
// ==========================================

if(navigator.vibrate){

    navigator.vibrate([600,300,600,300]);

}

// ==========================================
// Accept
// ==========================================

acceptBtn.onclick = async()=>{

    ringtone.pause();

    if(navigator.vibrate){

        navigator.vibrate(0);

    }

    await callRef.update({

        status:"connected",

        acceptedAt:
        firebase.database.ServerValue.TIMESTAMP

    });

    if(currentCall.type==="video"){

        location.href=
        "video-call.html?callId="+callId;

    }else{

        location.href=
        "voice-call.html?callId="+callId;

    }

};

// ==========================================
// Reject
// ==========================================

rejectBtn.onclick = async()=>{

    ringtone.pause();

    if(navigator.vibrate){

        navigator.vibrate(0);

    }

    await callRef.update({

        status:"rejected",

        endedAt:
        firebase.database.ServerValue.TIMESTAMP

    });

    location.href="chat.html";

};

// ==========================================
// Listen Status
// ==========================================

callRef.child("status").on("value",(snap)=>{

    const value=snap.val();

    if(!value) return;

    if(value==="ended"){

        ringtone.pause();

        location.href="chat.html";

    }

});

console.log("✅ Incoming Call Ready");