// ========================================
// Viewora Incoming Video Call
// Part 1
// ========================================

console.log("🎥 Incoming Video Call");

// Firebase
const db = firebase.database();
const auth = firebase.auth();

// Elements
const callerName = document.getElementById("callerName");
const callerPhoto = document.getElementById("callerPhoto");

const acceptBtn = document.getElementById("acceptCall");
const rejectBtn = document.getElementById("rejectCall");

const ringtone = document.getElementById("ringtone");

// Current Call
let currentCallId = null;

// ========================================
// Ringtone
// ========================================

function playRingtone(){

    ringtone.currentTime = 0;

    ringtone.play().catch(()=>{});

}

function stopRingtone(){

    ringtone.pause();

    ringtone.currentTime = 0;

}

// ========================================
// Vibration
// ========================================

function startVibration(){

    if(navigator.vibrate){

        navigator.vibrate([500,300,500,300]);

    }

}

function stopVibration(){

    if(navigator.vibrate){

        navigator.vibrate(0);

    }

}

console.log("✅ Incoming Video Part 1 Ready");
// ========================================
// Viewora Incoming Video Call
// Part 2
// ========================================

// Listen Incoming Video Call
auth.onAuthStateChanged((user) => {

    if (!user) {

        location.href = "login.html";
        return;

    }

    db.ref("calls")
        .orderByChild("receiver")
        .equalTo(user.uid)
        .on("child_added", async (snap) => {

            const call = snap.val();

            if (!call) return;

            if (call.type !== "video") return;

            if (call.status !== "ringing") return;

            currentCallId = snap.key;

            // Load Caller Profile
            const userSnap = await db
                .ref("users/" + call.caller)
                .once("value");

            const profile = userSnap.val() || {};

            callerName.textContent =
                profile.name || "Viewora User";

            callerPhoto.src =
                profile.profilePhoto || "assets/avatar.png";

            playRingtone();

            startVibration();

            console.log("📞 Incoming Video Call");

        });

});

// ========================================
// Accept Video Call
// ========================================

acceptBtn.onclick = async () => {

    if (!currentCallId) return;

    stopRingtone();

    stopVibration();

    await db.ref("calls/" + currentCallId).update({

        status: "accepted",

        acceptedAt:
        firebase.database.ServerValue.TIMESTAMP

    });

    // Open Video Call Screen
    window.location.href =
        "call.html?callId=" + currentCallId;

};

// ========================================
// Reject Video Call
// ========================================

rejectBtn.onclick = async () => {

    if (!currentCallId) return;

    stopRingtone();

    stopVibration();

    await db.ref("calls/" + currentCallId).update({

        status: "rejected",

        rejectedAt:
        firebase.database.ServerValue.TIMESTAMP

    });

    history.back();

};

console.log("✅ Incoming Video Part 2 Ready");
// ========================================
// Viewora Incoming Video Call
// Part 3 - Timeout + Cleanup
// ========================================

let callTimeout = null;

// ========================================
// Auto Timeout (45 Seconds)
// ========================================

function startCallTimeout() {

    clearTimeout(callTimeout);

    callTimeout = setTimeout(async () => {

        if (!currentCallId) return;

        try {

            await db.ref("calls/" + currentCallId).update({

                status: "missed",

                missedAt: firebase.database.ServerValue.TIMESTAMP

            });

        } catch (e) {

            console.error(e);

        }

        stopRingtone();
        stopVibration();

        alert("Missed Call");

        history.back();

    }, 45000);

}

startCallTimeout();

// ========================================
// Listen Call Status
// ========================================

function listenCallStatus() {

    if (!currentCallId) return;

    db.ref("calls/" + currentCallId + "/status")
        .on("value", (snap) => {

            if (!snap.exists()) return;

            const status = snap.val();

            switch (status) {

                case "cancelled":

                    clearTimeout(callTimeout);

                    stopRingtone();

                    stopVibration();

                    alert("Caller cancelled the call");

                    history.back();

                    break;

                case "ended":

                    clearTimeout(callTimeout);

                    stopRingtone();

                    stopVibration();

                    history.back();

                    break;

                case "accepted":

                    clearTimeout(callTimeout);

                    stopRingtone();

                    stopVibration();

                    break;

            }

        });

}

// Wait until currentCallId is available
const waitForCall = setInterval(() => {

    if (currentCallId) {

        clearInterval(waitForCall);

        listenCallStatus();

    }

}, 500);

// ========================================
// Cleanup
// ========================================

window.addEventListener("beforeunload", () => {

    clearTimeout(callTimeout);

    stopRingtone();

    stopVibration();

});

console.log("✅ Incoming Video Call Part 3 Ready");
// ========================================
// Viewora Incoming Video Call
// Part 4 - Final
// ========================================

console.log("🎥 Incoming Video Part 4 Loaded");

// ========================================
// Update User Call Status
// ========================================

async function updateCallStatus(status) {

    const user = auth.currentUser;

    if (!user) return;

    try {

        await db
            .ref("users/" + user.uid + "/callStatus")
            .set(status);

    } catch (e) {

        console.error(e);

    }

}

// ========================================
// When Accepted
// ========================================

acceptBtn.onclick = async () => {

    if (!currentCallId) return;

    stopRingtone();

    stopVibration();

    clearTimeout(callTimeout);

    await updateCallStatus("busy");

    await db.ref("calls/" + currentCallId).update({

        status: "accepted",

        acceptedAt:
        firebase.database.ServerValue.TIMESTAMP

    });

    window.location.href =
        "call.html?callId=" + currentCallId;

};

// ========================================
// When Rejected
// ========================================

rejectBtn.onclick = async () => {

    if (!currentCallId) return;

    stopRingtone();

    stopVibration();

    clearTimeout(callTimeout);

    await updateCallStatus("online");

    await db.ref("calls/" + currentCallId).update({

        status: "rejected",

        rejectedAt:
        firebase.database.ServerValue.TIMESTAMP

    });

    window.location.href = "chat.html";

};

// ========================================
// Remove Firebase Listeners
// ========================================

window.addEventListener("pagehide", () => {

    stopRingtone();

    stopVibration();

    clearTimeout(callTimeout);

    if (currentCallId) {

        db.ref("calls/" + currentCallId + "/status").off();

    }

});

// ========================================
// Online when Page Closed
// ========================================

window.addEventListener("unload", async () => {

    try {

        await updateCallStatus("online");

    } catch (e) {

        console.error(e);

    }

});

console.log("✅ Incoming Video Call Ready");