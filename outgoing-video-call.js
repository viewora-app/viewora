// ========================================
// Viewora Outgoing Video Call
// outgoing-video-call.js
// ========================================

console.log("🎥 Outgoing Video Call Loaded");

// Firebase
const db = firebase.database();
const auth = firebase.auth();

// Call ID
const params = new URLSearchParams(window.location.search);
const callId = params.get("callId");

if (!callId) {
    alert("Invalid Call");
    history.back();
}

// Firebase Reference
const callRef = db.ref("calls/" + callId);

// HTML Elements
const receiverName = document.getElementById("receiverName");
const receiverPhoto = document.getElementById("receiverPhoto");
const cancelBtn = document.getElementById("cancelCall");
const cameraBtn = document.getElementById("cameraBtn");

// ========================================
// Load Receiver Details
// ========================================

async function loadReceiver() {

    try {

        const snap = await callRef.once("value");

        if (!snap.exists()) return;

        const call = snap.val();

        const userSnap = await db
            .ref("users/" + call.receiver)
            .once("value");

        const user = userSnap.val() || {};

        receiverName.textContent =
            user.name || "Viewora User";

        receiverPhoto.src =
            user.profilePhoto || "assets/avatar.png";

    } catch (e) {

        console.error(e);

    }

}

loadReceiver();

// ========================================
// Camera Preview (Optional)
// ========================================

let localStream = null;

cameraBtn.onclick = async () => {

    try {

        if (!localStream) {

            localStream =
                await navigator.mediaDevices.getUserMedia({

                    video: true,
                    audio: false

                });

            cameraBtn.innerHTML = "📷";

        } else {

            localStream.getTracks().forEach(track => track.stop());

            localStream = null;

            cameraBtn.innerHTML = "🚫";

        }

    } catch (e) {

        console.error(e);

        alert("Camera Permission Denied");

    }

};

// ========================================
// Listen Call Status
// ========================================

callRef.child("status").on("value", async (snap) => {

    if (!snap.exists()) return;

    const status = snap.val();

    console.log("Status:", status);

    switch (status) {

        case "accepted":

            window.location.href =
                "call.html?callId=" + callId;

            break;

        case "rejected":

            alert("Video Call Rejected");

            window.location.href = "chat.html";

            break;

        case "cancelled":

            window.location.href = "chat.html";

            break;

        case "ended":

            window.location.href = "chat.html";

            break;

    }

});

// ========================================
// Cancel Call
// ========================================

cancelBtn.onclick = async () => {

    try {

        if (localStream) {

            localStream.getTracks().forEach(track => track.stop());

        }

        await callRef.update({

            status: "cancelled",

            endedAt:
            firebase.database.ServerValue.TIMESTAMP

        });

        const user = auth.currentUser;

        if (user) {

            await db
                .ref("users/" + user.uid + "/callStatus")
                .set("online");

        }

    } catch (e) {

        console.error(e);

    }

    window.location.href = "chat.html";

};

// ========================================
// Cleanup
// ========================================

window.addEventListener("beforeunload", async () => {

    try {

        const snap = await callRef.child("status").once("value");

        if (snap.val() === "ringing") {

            await callRef.update({

                status: "cancelled"

            });

        }

    } catch (e) {

        console.error(e);

    }

});

console.log("✅ Outgoing Video Call Ready");