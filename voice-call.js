// ============================================
// Viewora Voice Call
// Part 1 - Initialization
// ============================================

console.log("🎙️ Voice Call Started");

// URL Params
const params = new URLSearchParams(window.location.search);
const callId = params.get("callId");

if (!callId) {

    alert("Invalid Call");

    location.href = "chat.html";

}

// Firebase
const callRef = db.ref("calls/" + callId);

// HTML Elements
const callerPhoto = document.getElementById("callerPhoto");
const callerName = document.getElementById("callerName");
const callStatus = document.getElementById("callStatus");
const callTimer = document.getElementById("callTimer");

const muteBtn = document.getElementById("muteBtn");
const speakerBtn = document.getElementById("speakerBtn");
const endCall = document.getElementById("endCall");

// Streams
let localStream = null;
let remoteStream = new MediaStream();

let timerInterval = null;
let seconds = 0;

let micEnabled = true;
let speakerEnabled = true;

// Remote Audio
const remoteAudio = new Audio();
remoteAudio.autoplay = true;
remoteAudio.srcObject = remoteStream;

// ============================================
// Peer Connection
// ============================================

const peerConnection = new RTCPeerConnection({

    iceServers: [

        {

            urls: "stun:stun.l.google.com:19302"

        }

    ]

});

// ============================================
// Load Call Information
// ============================================

async function loadCall(){

    const snap = await callRef.once("value");

    if(!snap.exists()){

        location.href="chat.html";

        return;

    }

    const call = snap.val();

    const otherUser =
        auth.currentUser.uid === call.caller
        ? call.receiver
        : call.caller;

    const userSnap =
        await db.ref("users/"+otherUser)
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

}

// ============================================
// Microphone
// ============================================

async function initAudio(){

    try{

        localStream =
            await navigator.mediaDevices.getUserMedia({

                audio:true,
                video:false

            });

        localStream.getTracks().forEach(track=>{

            peerConnection.addTrack(
                track,
                localStream
            );

        });

        console.log("🎤 Microphone Ready");

    }catch(err){

        console.error(err);

        alert("Microphone Permission Denied");

    }

}

// ============================================
// Remote Audio
// ============================================

peerConnection.ontrack=(event)=>{

    event.streams[0]
    .getTracks()
    .forEach(track=>{

        remoteStream.addTrack(track);

    });

};

// ============================================
// Start
// ============================================

auth.onAuthStateChanged(async(user)=>{

    if(!user){

        location.href="login.html";

        return;

    }

    await loadCall();

    await initAudio();

});

console.log("✅ Voice Call Part 1 Ready");
// ============================================
// Viewora Voice Call
// Part 2 - WebRTC Signaling
// ============================================

// ICE Candidate
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
// Caller Create Offer
// --------------------------------------------

async function createOffer() {

    const offer = await peerConnection.createOffer({

        offerToReceiveAudio: true,
        offerToReceiveVideo: false

    });

    await peerConnection.setLocalDescription(offer);

    await callRef.child("offer").set({

        type: offer.type,
        sdp: offer.sdp

    });

    console.log("📤 Offer Created");

}

// --------------------------------------------
// Receiver Create Answer
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
// Caller Listen Answer
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
// Listen Caller ICE
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
// Listen Receiver ICE
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
// Decide Caller / Receiver
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

console.log("✅ Voice Call Part 2 Ready");
// ============================================
// Viewora Voice Call
// Part 3 - Call Controls
// ============================================

// --------------------------------------------
// Connection State
// --------------------------------------------

peerConnection.onconnectionstatechange = () => {

    console.log("Connection:", peerConnection.connectionState);

    switch (peerConnection.connectionState) {

        case "connecting":

            callStatus.textContent = "Connecting...";
            break;

        case "connected":

            callStatus.textContent = "Connected";
            startCallTimer();
            break;

        case "disconnected":

            callStatus.textContent = "Disconnected";
            break;

        case "failed":

            callStatus.textContent = "Connection Failed";
            break;

        case "closed":

            callStatus.textContent = "Call Ended";
            break;

    }

};

// --------------------------------------------
// Call Timer
// --------------------------------------------

function startCallTimer() {

    if (timerInterval) return;

    timerInterval = setInterval(() => {

        seconds++;

        const min = String(Math.floor(seconds / 60)).padStart(2, "0");
        const sec = String(seconds % 60).padStart(2, "0");

        callTimer.textContent = `${min}:${sec}`;

    }, 1000);

}

// --------------------------------------------
// Mute / Unmute
// --------------------------------------------

muteBtn.onclick = () => {

    if (!localStream) return;

    micEnabled = !micEnabled;

    localStream.getAudioTracks().forEach(track => {

        track.enabled = micEnabled;

    });

    muteBtn.textContent = micEnabled ? "🎤" : "🔇";

};

// --------------------------------------------
// Speaker Toggle
// --------------------------------------------

speakerBtn.onclick = () => {

    speakerEnabled = !speakerEnabled;

    remoteAudio.muted = !speakerEnabled;

    speakerBtn.textContent = speakerEnabled ? "🔊" : "🔈";

};

// --------------------------------------------
// Remote Call Status
// --------------------------------------------

callRef.child("status").on("value", (snap) => {

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

console.log("✅ Voice Call Part 3 Ready");
// ============================================
// Viewora Voice Call
// Part 4 - End Call & Cleanup
// ============================================

// --------------------------------------------
// End Call
// --------------------------------------------

endCall.onclick = async () => {

    try {

        await callRef.update({

            status: "ended",
            endedAt: firebase.database.ServerValue.TIMESTAMP

        });

    } catch (e) {

        console.error(e);

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
            endedAt: firebase.database.ServerValue.TIMESTAMP

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

        case "connected":

            console.log("ICE Connected");

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

    console.error("Voice Call Error:", event.error);

});

window.addEventListener("unhandledrejection", (event) => {

    console.error("Promise Error:", event.reason);

});

console.log("✅ Voice Call Final Ready");