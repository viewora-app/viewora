// ===========================================
// Viewora Outgoing Call
// ===========================================

console.log("📤 Outgoing Call Started");

// URL Params
const params = new URLSearchParams(window.location.search);

const callId = params.get("callId");

if (!callId) {

    alert("Invalid Call");

    location.href = "chat.html";

}

// Firebase
const callRef = db.ref("calls/" + callId);

// HTML
const callerPhoto = document.getElementById("callerPhoto");
const callerName = document.getElementById("callerName");
const callType = document.getElementById("callType");
const statusText = document.getElementById("status");
const cancelBtn = document.getElementById("cancelBtn");
const ringtone = document.getElementById("ringtone");

// ===========================================
// Load Call Data
// ===========================================

callRef.once("value").then(async(snap)=>{

    const call = snap.val();

    if(!call){

        showError("Call not found");

        location.href="chat.html";

        return;

    }

    callType.textContent =
    call.type==="video"
    ? "🎥 Video Call"
    : "📞 Voice Call";

    // Receiver Profile
    const userSnap =
    await db.ref("users/"+call.receiver)
    .once("value");

    if(userSnap.exists()){

        const user=userSnap.val();

        callerName.textContent =
        user.name || "Unknown";

        if(user.photoURL){

            callerPhoto.src =
            user.photoURL;

        }

    }

});

// ===========================================
// Listen Status
// ===========================================

callRef.child("status").on("value",(snap)=>{

    const status=snap.val();

    if(!status) return;

    switch(status){

        case "ringing":

            statusText.textContent=
            "Ringing...";

            break;

        case "connected":

            ringtone.pause();

            ringtone.currentTime=0;

            if(callType.textContent
            .includes("Video")){

                location.href=
                "video-call.html?callId="+callId;

            }else{

                location.href=
                "voice-call.html?callId="+callId;

            }

            break;

        case "rejected":

            ringtone.pause();

            alert("Call Rejected");

            location.href="chat.html";

            break;

        case "ended":

            ringtone.pause();

            location.href="chat.html";

            break;

    }

});

// ===========================================
// Cancel Call
// ===========================================

cancelBtn.onclick = async()=>{

    ringtone.pause();

    await callRef.update({

        status:"ended",

        endedAt:firebase.database.ServerValue.TIMESTAMP

    });

    location.href="chat.html";

};

console.log("✅ Outgoing Call Ready");