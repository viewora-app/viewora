// ============================================
// Viewora Video Call
// Part 1 - Initialization
// ============================================

console.log("🎥 Video Call Started");

// --------------------------------------------
// URL Params
// --------------------------------------------

const params = new URLSearchParams(window.location.search);
const callId = params.get("callId");

if (!callId) {

    alert("Invalid Call");

    location.href = "chat.html";

}

// --------------------------------------------
// Firebase
// --------------------------------------------

const callRef = db.ref("calls/" + callId);

// --------------------------------------------
// HTML Elements
// --------------------------------------------

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const callerName = document.getElementById("callerName");
const callTimer = document.getElementById("callTimer");

const micBtn = document.getElementById("micBtn");
const cameraBtn = document.getElementById("cameraBtn");
const switchBtn = document.getElementById("switchBtn");
const endBtn = document.getElementById("endBtn");

// --------------------------------------------
// Streams
// --------------------------------------------

let localStream = null;
let remoteStream = new MediaStream();

let timerInterval = null;
let seconds = 0;

let micEnabled = true;
let cameraEnabled = true;

let currentFacingMode = "user";

// --------------------------------------------
// Peer Connection
// --------------------------------------------

const peerConnection = new RTCPeerConnection({

    iceServers: [

        {

            urls: "stun:stun.l.google.com:19302"

        }

    ]

});

// --------------------------------------------
// Load Call
// --------------------------------------------

async function loadCall() {

    const snap = await callRef.once("value");

    if (!snap.exists()) {

        location.href = "chat.html";

        return;

    }

    const call = snap.val();

    const otherUser =
        auth.currentUser.uid === call.caller
        ? call.receiver
        : call.caller;

    const userSnap =
        await db.ref("users/" + otherUser)
        .once("value");

    if (userSnap.exists()) {

        const user = userSnap.val();

        callerName.textContent =
            user.name || "Unknown";

    }

}

// --------------------------------------------
// Camera + Microphone
// --------------------------------------------

async function initMedia() {

    try {

        localStream =
            await navigator.mediaDevices.getUserMedia({

                audio: true,

                video: {

                    facingMode: currentFacingMode,

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }

                }

            });

        localVideo.srcObject = localStream;

        localStream.getTracks().forEach(track => {

            peerConnection.addTrack(

                track,

                localStream

            );

        });

        console.log("📷 Camera Ready");

    } catch (err) {

        console.error(err);

        alert("Camera Permission Denied");

    }

}

// --------------------------------------------
// Remote Stream
// --------------------------------------------

peerConnection.ontrack = (event) => {

    event.streams[0]
    .getTracks()
    .forEach(track => {

        remoteStream.addTrack(track);

    });

    remoteVideo.srcObject = remoteStream;

};

// --------------------------------------------
// Start
// --------------------------------------------

auth.onAuthStateChanged(async (user) => {

    if (!user) {

        location.href = "login.html";

        return;

    }

    await loadCall();

    await initMedia();

});

console.log("✅ Video Call Part 1 Ready");
// ============================================
// Viewora Video Call
// Part 2 - WebRTC Signaling
// ============================================

// --------------------------------------------
// ICE Candidate
// --------------------------------------------

peerConnection.onicecandidate = async (event) => {

    if (!event.candidate) return;

    const call = (await callRef.once("value")).val();

    const candidate = event.candidate.toJSON();

    if (auth.currentUser.uid === call.caller) {

        await callRef
            .child("callerCandidates")
            .push(candidate);

    } else {

        await callRef
            .child("receiverCandidates")
            .push(candidate);

    }

};

// --------------------------------------------
// Create Offer (Caller)
// --------------------------------------------

async function createOffer() {

    const offer = await peerConnection.createOffer({

        offerToReceiveAudio: true,
        offerToReceiveVideo: true

    });

    await peerConnection.setLocalDescription(offer);

    await callRef.child("offer").set({

        type: offer.type,
        sdp: offer.sdp

    });

    console.log("📤 Offer Created");

}

// --------------------------------------------
// Create Answer (Receiver)
// --------------------------------------------

async function createAnswer() {

    const offerSnap = await callRef
        .child("offer")
        .once("value");

    if (!offerSnap.exists()) return;

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(
            offerSnap.val()
        )
    );

    const answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    await callRef.child("answer").set({

        type: answer.type,
        sdp: answer.sdp

    });

    await callRef.update({

        status: "connected"

    });

    console.log("📥 Answer Created");

}

// --------------------------------------------
// Listen Answer (Caller)
// --------------------------------------------

callRef.child("answer").on("value", async (snap) => {

    if (!snap.exists()) return;

    if (peerConnection.currentRemoteDescription) return;

    await peerConnection.setRemoteDescription(

        new RTCSessionDescription(
            snap.val()

        )

    );

    console.log("✅ Remote Description Added");

});

// --------------------------------------------
// Caller ICE
// --------------------------------------------

callRef.child("callerCandidates")
.on("child_added", async (snap) => {

    if (!snap.exists()) return;

    try {

        await peerConnection.addIceCandidate(

            new RTCIceCandidate(
                snap.val()
            )

        );

    } catch (e) {

        console.error(e);

    }

});

// --------------------------------------------
// Receiver ICE
// --------------------------------------------

callRef.child("receiverCandidates")
.on("child_added", async (snap) => {

    if (!snap.exists()) return;

    try {

        await peerConnection.addIceCandidate(

            new RTCIceCandidate(
                snap.val()
            )

        );

    } catch (e) {

        console.error(e);

    }

});

// --------------------------------------------
// Start Signaling
// --------------------------------------------

async function startSignaling() {

    const snap = await callRef.once("value");

    const call = snap.val();

    if (!call) return;

    if (auth.currentUser.uid === call.caller) {

        await createOffer();

    } else {

        await createAnswer();

    }

}

startSignaling();

console.log("✅ Video Call Part 2 Ready");
// ============================================
// Viewora Video Call
// Part 3 - Controls & Timer
// ============================================

// --------------------------------------------
// Connection State
// --------------------------------------------

peerConnection.onconnectionstatechange = () => {

    console.log("Connection:", peerConnection.connectionState);

    switch (peerConnection.connectionState) {

        case "connecting":

            callerName.textContent = "Connecting...";
            break;

        case "connected":

            callerName.textContent = "Connected";
            startTimer();
            break;

        case "disconnected":

            callerName.textContent = "Disconnected";
            break;

        case "failed":

            callerName.textContent = "Connection Failed";
            break;

        case "closed":

            callerName.textContent = "Call Ended";
            break;

    }

};

// --------------------------------------------
// Call Timer
// --------------------------------------------

function startTimer() {

    if (timerInterval) return;

    timerInterval = setInterval(() => {

        seconds++;

        const min = String(Math.floor(seconds / 60))
            .padStart(2, "0");

        const sec = String(seconds % 60)
            .padStart(2, "0");

        callTimer.textContent = `${min}:${sec}`;

    }, 1000);

}

// --------------------------------------------
// Mic Button
// --------------------------------------------

micBtn.onclick = () => {

    if (!localStream) return;

    micEnabled = !micEnabled;

    localStream.getAudioTracks().forEach(track => {

        track.enabled = micEnabled;

    });

    micBtn.textContent =
        micEnabled ? "🎤" : "🔇";

};

// --------------------------------------------
// Camera Button
// --------------------------------------------

cameraBtn.onclick = () => {

    if (!localStream) return;

    cameraEnabled = !cameraEnabled;

    localStream.getVideoTracks().forEach(track => {

        track.enabled = cameraEnabled;

    });

    cameraBtn.textContent =
        cameraEnabled ? "📷" : "🚫";

};

// --------------------------------------------
// Switch Camera
// --------------------------------------------

switchBtn.onclick = async () => {

    try {

        currentFacingMode =
            currentFacingMode === "user"
            ? "environment"
            : "user";

        const newStream =
            await navigator.mediaDevices.getUserMedia({

                audio: true,

                video: {

                    facingMode: currentFacingMode

                }

            });

        const videoTrack =
            newStream.getVideoTracks()[0];

        const sender =
            peerConnection
            .getSenders()
            .find(sender =>
                sender.track &&
                sender.track.kind === "video"
            );

        if (sender) {

            await sender.replaceTrack(videoTrack);

        }

        localStream
            .getVideoTracks()
            .forEach(track => track.stop());

        localStream.removeTrack(
            localStream.getVideoTracks()[0]
        );

        localStream.addTrack(videoTrack);

        localVideo.srcObject = localStream;

    } catch (err) {

        console.error("Camera Switch Error", err);

    }

};

// --------------------------------------------
// Listen Call Status
// --------------------------------------------

callRef.child("status").on("value", snap => {

    const status = snap.val();

    if (!status) return;

    if (status === "ended") {

        alert("Call Ended");

        location.href = "chat.html";

    }

    if (status === "rejected") {

        alert("Call Rejected");

        location.href = "chat.html";

    }

});

console.log("✅ Video Call Part 3 Ready")
// ============================================
// Viewora Video Call
// Part 4 - End Call & Cleanup
// ============================================

// --------------------------------------------
// End Call
// --------------------------------------------

endBtn.onclick = async () => {

    try {

        await callRef.update({

            status: "ended",

            endedAt:
            firebase.database.ServerValue.TIMESTAMP

        });

    } catch (err) {

        console.error(err);

    }

    cleanup();

    location.href = "chat.html";

};

// --------------------------------------------
// Cleanup
// --------------------------------------------

function cleanup() {

    clearInterval(timerInterval);

    if (localStream) {

        localStream.getTracks().forEach(track => {

            track.stop();

        });

    }

    if (remoteStream) {

        remoteStream.getTracks().forEach(track => {

            track.stop();

        });

    }

    if (peerConnection) {

        peerConnection.close();

    }

    callRef.child("offer").off();
    callRef.child("answer").off();
    callRef.child("status").off();

    callRef.child("callerCandidates").off();
    callRef.child("receiverCandidates").off();

}

// --------------------------------------------
// Page Close
// --------------------------------------------

window.addEventListener("beforeunload", async () => {

    try {

        await callRef.update({

            status: "ended",

            endedAt:
            firebase.database.ServerValue.TIMESTAMP

        });

    } catch (e) {

        console.error(e);

    }

    cleanup();

});

// --------------------------------------------
// ICE Connection State
// --------------------------------------------

peerConnection.oniceconnectionstatechange = () => {

    console.log(
        "ICE:",
        peerConnection.iceConnectionState
    );

    switch (peerConnection.iceConnectionState) {

        case "checking":

            console.log("Checking...");

            break;

        case "connected":

            console.log("ICE Connected");

            break;

        case "completed":

            console.log("ICE Completed");

            break;

        case "disconnected":

            console.log("ICE Disconnected");

            break;

        case "failed":

            console.log("ICE Failed");

            break;

        case "closed":

            console.log("ICE Closed");

            break;

    }

};

// --------------------------------------------
// Error Handling
// --------------------------------------------

window.addEventListener("error", (event) => {

    console.error("Video Call Error:", event.error);

});

window.addEventListener("unhandledrejection", (event) => {

    console.error("Promise Error:", event.reason);

});

console.log("✅ Video Call Final Ready");