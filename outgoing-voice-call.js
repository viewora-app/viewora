// ========================================
// Viewora Outgoing Voice Call
// outgoing-voice-call.js
// ========================================

console.log("📞 Outgoing Voice Call Loaded");

// Firebase
const db = firebase.database();
const auth = firebase.auth();

// Get Call ID
const params = new URLSearchParams(window.location.search);
const callId = params.get("callId");

if (!callId) {
    alert("Invalid Call");
    history.back();
}

// Elements
const receiverName = document.getElementById("receiverName");
const receiverPhoto = document.getElementById("receiverPhoto");
const cancelBtn = document.getElementById("cancelCall");

const callRef = db.ref("calls/" + callId);

// ========================================
// Load Receiver Info
// ========================================

async function loadReceiver() {

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

}

loadReceiver();

// ========================================
// Listen Call Status
// ========================================

callRef.child("status").on("value", (snap) => {

    if (!snap.exists()) return;

    const status = snap.val();

    console.log("Call Status:", status);

    switch (status) {

        case "accepted":

            location.href =
            "voice-call.html?callId=" + callId;

            break;

        case "rejected":

            alert("Call Rejected");

            location.href = "chat.html";

            break;

        case "cancelled":

            location.href = "chat.html";

            break;

        case "ended":

            location.href = "chat.html";

            break;

    }

});

// ========================================
// Cancel Call
// ========================================

cancelBtn.onclick = async () => {

    try {

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

    location.href = "chat.html";

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

console.log("✅ Outgoing Voice Call Ready");