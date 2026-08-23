"use strict";

/*
============================================================
 VIEWORA CALL V2 — FINAL
 Premium WebRTC Voice + Video Calling

 Firebase:
   Auth
   Realtime Database

 NOT REQUIRED:
   Firebase Storage
   Cloudinary

 FLOW:
   Caller
      ↓
   create call
      ↓
   getUserMedia
      ↓
   WebRTC offer
      ↓
   Firebase RTDB
      ↓
   Receiver accepts
      ↓
   WebRTC answer
      ↓
   Firebase RTDB
      ↓
   ICE candidates exchange
      ↓
   CONNECTED
============================================================
*/

(() => {

    if (window.__VIEWORA_CALL_V2_FINAL__) {
        console.warn("Viewora Call V2 already running.");
        return;
    }

    window.__VIEWORA_CALL_V2_FINAL__ = true;

    /* ======================================================
       FIREBASE
    ====================================================== */

    if (
        typeof firebase === "undefined" ||
        !window.auth ||
        !window.db
    ) {
        console.error(
            "Viewora Call: Firebase Auth/Database not ready."
        );
        return;
    }

    /* ======================================================
       WEBRTC
    ====================================================== */

    const RTC_CONFIG = {
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302"
                ]
            }
        ]
    };

    /* ======================================================
       URL PARAMS
    ====================================================== */

    const params = new URLSearchParams(
        window.location.search
    );

    let callId =
        params.get("callId");

    let receiverId =
        params.get("receiverId");

    let callType =
        params.get("type") === "video"
            ? "video"
            : "audio";

    let role =
        params.get("role") === "receiver"
            ? "receiver"
            : "caller";

    /* ======================================================
       STATE
    ====================================================== */

  let ringtoneContext = null;
let ringtoneOscillator = null;
let ringtoneGain = null;
let ringtoneTimer = null;
let ringtonePlaying = false;

    let currentUser = null;

    let remoteUserId = null;

    let callerId = null;

    let callRef = null;

    let pc = null;

    let localStream = null;

    let remoteStream = null;

    let pendingCandidates = [];

    let remoteDescriptionReady = false;

    let callFinished = false;

    let accepted = false;

    let timer = null;

    let seconds = 0;

    let offerProcessing = false;

    /* ======================================================
       DOM HELPER
    ====================================================== */

    const $ = id =>
        document.getElementById(id);

    /* ======================================================
       DOM
    ====================================================== */

    const callApp =
        $("callApp");

    const incomingScreen =
        $("incomingCallScreen");

    const endedScreen =
        $("callEndedScreen");

    const remoteVideo =
        $("remoteVideo");

    const localVideo =
        $("localVideo");

    const remoteAudio =
        $("remoteAudio");

    const localVideoWrap =
        $("localVideoWrap");

    const remotePlaceholder =
        $("remotePlaceholder");

    const connectingOverlay =
        $("connectingOverlay");

    const connectingText =
        $("connectingText");

    const callStatus =
        $("callStatus");

    const callDuration =
        $("callDuration");

    /* ======================================================
       LOG
    ====================================================== */

    function log(...args) {
        console.log(
            "[VIEWORA CALL]",
            ...args
        );
    }

    function error(...args) {
        console.error(
            "[VIEWORA CALL]",
            ...args
        );
    }

    /* ======================================================
       TOAST
    ====================================================== */

    function toast(message) {

        if (
            typeof window.showCallToast ===
            "function"
        ) {
            window.showCallToast(message);
            return;
        }

        const box =
            $("callToast");

        const text =
            $("callToastText");

        if (!box || !text) {
            console.warn(message);
            return;
        }

        text.textContent = message;

        box.classList.remove("hidden");

        clearTimeout(
            box.__timer
        );

        box.__timer =
            setTimeout(() => {
                box.classList.add("hidden");
            }, 3000);
    }


  /* ======================================================
   INCOMING CALL RINGTONE
   No Firebase Storage required
   Web Audio API generated ringtone
====================================================== */

function stopRingtone() {

    ringtonePlaying = false;

    if (ringtoneTimer) {
        clearTimeout(ringtoneTimer);
        ringtoneTimer = null;
    }

    try {
        if (ringtoneOscillator) {
            ringtoneOscillator.stop();
        }
    } catch (_) {}

    try {
        if (ringtoneGain) {
            ringtoneGain.disconnect();
        }
    } catch (_) {}

    ringtoneOscillator = null;
    ringtoneGain = null;

    if (ringtoneContext) {
        try {
            ringtoneContext.close();
        } catch (_) {}
    }

    ringtoneContext = null;

    log("🔕 Ringtone stopped.");
}


function playRingtoneTone() {

    if (!ringtonePlaying) {
        return;
    }

    try {

        if (!ringtoneContext) {

            ringtoneContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

        }

        if (
            ringtoneContext.state ===
            "suspended"
        ) {
            ringtoneContext.resume().catch(() => {});
        }

        const now =
            ringtoneContext.currentTime;

        ringtoneOscillator =
            ringtoneContext.createOscillator();

        ringtoneGain =
            ringtoneContext.createGain();

        ringtoneOscillator.type =
            "sine";

        /*
         * Premium phone-like two-tone
         */

        ringtoneOscillator.frequency
            .setValueAtTime(
                880,
                now
            );

        ringtoneOscillator.frequency
            .setValueAtTime(
                660,
                now + 0.25
            );

        ringtoneGain.gain
            .setValueAtTime(
                0.0001,
                now
            );

        ringtoneGain.gain
            .linearRampToValueAtTime(
                0.18,
                now + 0.04
            );

        ringtoneGain.gain
            .linearRampToValueAtTime(
                0.0001,
                now + 0.45
            );

        ringtoneOscillator
            .connect(
                ringtoneGain
            );

        ringtoneGain
            .connect(
                ringtoneContext.destination
            );

        ringtoneOscillator.start(
            now
        );

        ringtoneOscillator.stop(
            now + 0.5
        );

        ringtoneTimer =
            setTimeout(() => {

                if (ringtonePlaying) {
                    playRingtoneTone();
                }

            }, 750);

    } catch (e) {

        error(
            "Ringtone:",
            e
        );
    }
}


function startRingtone() {

    if (ringtonePlaying) {
        return;
    }

    ringtonePlaying =
        true;

    log("🔔 Incoming call ringtone started.");

    playRingtoneTone();
}

    /* ======================================================
       STATUS
    ====================================================== */

    function status(text) {

        if (callStatus) {
            callStatus.textContent =
                text;
        }
    }

    function connecting(
        visible,
        text = "Connecting..."
    ) {

        if (connectingText) {
            connectingText.textContent =
                text;
        }

        if (connectingOverlay) {
            connectingOverlay.classList.toggle(
                "hidden",
                !visible
            );
        }
    }

    /* ======================================================
       AUTH
    ====================================================== */

    function waitForUser() {

        if (auth.currentUser) {
            currentUser =
                auth.currentUser;

            return Promise.resolve(
                currentUser
            );
        }

        return new Promise(
            (resolve, reject) => {

                let done = false;

                const unsubscribe =
                    auth.onAuthStateChanged(
                        user => {

                            if (done) {
                                return;
                            }

                            done = true;

                            unsubscribe();

                            if (!user) {
                                reject(
                                    new Error(
                                        "Not authenticated"
                                    )
                                );
                                return;
                            }

                            currentUser =
                                user;

                            resolve(user);
                        }
                    );
            }
        );
    }

    /* ======================================================
       USER
    ====================================================== */

    async function loadUser(uid) {

        if (!uid) {
            return null;
        }

        try {

            const snap =
                await db
                    .ref("users/" + uid)
                    .once("value");

            return snap.exists()
                ? snap.val()
                : null;

        } catch (e) {

            error(
                "User load:",
                e
            );

            return null;
        }
    }

    async function setRemoteUser(uid) {

        if (!uid) {
            return;
        }

        remoteUserId =
            uid;

        const user =
            await loadUser(uid);

        if (!user) {
            return;
        }

        const name =
            user.name ||
            user.fullName ||
            user.displayName ||
            "Viewora User";

        const username =
            user.username
                ? "@" + user.username
                : "";

        const photo =
            user.profilePhoto ||
            user.photoURL ||
            user.avatar ||
            "assets/default-avatar.png";

        if ($("remoteName")) {
            $("remoteName").textContent =
                name;
        }

        if ($("remoteUsername")) {
            $("remoteUsername").textContent =
                username;
        }

        if ($("remoteAvatar")) {
            $("remoteAvatar").src =
                photo;
        }

        if ($("incomingName")) {
            $("incomingName").textContent =
                name;
        }

        if ($("incomingUsername")) {
            $("incomingUsername").textContent =
                username;
        }

        if ($("incomingAvatar")) {
            $("incomingAvatar").src =
                photo;
        }
    }

    /* ======================================================
       CALL REF
    ====================================================== */

    function getCallRef() {

        if (!callId) {

            callId =
                db
                    .ref("calls")
                    .push()
                    .key;
        }

        callRef =
            db.ref(
                "calls/" +
                callId
            );

        return callRef;
    }

    /* ======================================================
       CREATE CALL
    ====================================================== */

    async function createCall() {

        getCallRef();

        callerId =
            currentUser.uid;

        await callRef.set({

            callerId:
                currentUser.uid,

            receiverId:
                receiverId,

            type:
                callType,

            status:
                "ringing",

            createdAt:
                firebase.database.ServerValue.TIMESTAMP,

            updatedAt:
                firebase.database.ServerValue.TIMESTAMP

        });

        log(
            "Call created:",
            callId
        );
    }

    /* ======================================================
       LOCAL MEDIA
    ====================================================== */

    async function getLocalMedia() {

        if (localStream) {
            return localStream;
        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {
            throw new Error(
                "getUserMedia is unavailable."
            );
        }

        const constraints = {

            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },

            video:
                callType === "video"
                    ? {
                        facingMode: "user",
                        width: {
                            ideal: 1280
                        },
                        height: {
                            ideal: 720
                        },
                        frameRate: {
                            ideal: 30
                        }
                    }
                    : false
        };

        try {

            localStream =
                await navigator
                    .mediaDevices
                    .getUserMedia(
                        constraints
                    );

        } catch (e) {

            error(
                "Media permission:",
                e
            );

            if (
                e.name ===
                "NotAllowedError"
            ) {
                toast(
                    "Camera/microphone permission denied."
                );
            } else if (
                e.name ===
                "NotFoundError"
            ) {
                toast(
                    "Camera or microphone not found."
                );
            } else {
                toast(
                    "Unable to access camera/microphone."
                );
            }

            throw e;
        }

        window.localStream =
            localStream;

        if (
            callType === "video" &&
            localVideo
        ) {

            localVideo.srcObject =
                localStream;

            localVideo.muted =
                true;

            localVideo.playsInline =
                true;

            if (localVideoWrap) {
                localVideoWrap.classList.remove(
                    "hidden"
                );
            }

            localVideo
                .play()
                .catch(() => {});
        }

        log(
            "Local media ready."
        );

        return localStream;
    }

    /* ======================================================
       PEER CONNECTION
    ====================================================== */

    function createPeer() {

        if (pc) {
            return pc;
        }

        pc =
            new RTCPeerConnection(
                RTC_CONFIG
            );

        remoteStream =
            new MediaStream();

        window.remoteStream =
            remoteStream;

        /* LOCAL TRACKS */

        if (localStream) {

            localStream
                .getTracks()
                .forEach(track => {

                    pc.addTrack(
                        track,
                        localStream
                    );

                });
        }

        /* REMOTE TRACK */

        pc.ontrack =
            event => {

                if (event.streams?.[0]) {

                    event.streams[0]
                        .getTracks()
                        .forEach(track => {

                            if (
                                !remoteStream
                                    .getTracks()
                                    .some(
                                        t =>
                                            t.id ===
                                            track.id
                                    )
                            ) {

                                remoteStream.addTrack(
                                    track
                                );
                            }
                        });

                } else {

                    remoteStream.addTrack(
                        event.track
                    );
                }

                attachRemote();
            };

        /* ICE */

        pc.onicecandidate =
            event => {

                if (
                    !event.candidate ||
                    !callRef ||
                    !currentUser
                ) {
                    return;
                }

                const candidate =
                    event.candidate.toJSON
                        ? event.candidate.toJSON()
                        : event.candidate;

                callRef
                    .child(
                        "candidates/" +
                        currentUser.uid
                    )
                    .push(candidate)
                    .catch(e =>
                        error(
                            "ICE write:",
                            e
                        )
                    );
            };

        /* CONNECTION */

        pc.onconnectionstatechange =
            async () => {

                if (!pc) {
                    return;
                }

                const state =
                    pc.connectionState;

                log(
                    "Connection:",
                    state
                );

                if (
                    state ===
                    "connected"
                ) {

                    connecting(false);

                    status(
                        "Connected"
                    );

                    await updateStatus(
                        "connected"
                    );

                    startTimer();
                }

                if (
                    state ===
                    "connecting"
                ) {

                    connecting(
                        true,
                        "Connecting..."
                    );

                    status(
                        "Connecting..."
                    );
                }

                if (
                    state ===
                    "disconnected"
                ) {

                    connecting(
                        true,
                        "Reconnecting..."
                    );

                    status(
                        "Reconnecting..."
                    );
                }

                if (
                    state ===
                    "failed"
                ) {

                    connecting(false);

                    status(
                        "Connection failed"
                    );

                    toast(
                        "WebRTC connection failed."
                    );
                }

                if (
                    state ===
                    "closed"
                ) {
                    cleanupMedia();
                }
            };

        /* ICE STATE */

        pc.oniceconnectionstatechange =
            () => {

                if (!pc) {
                    return;
                }

                log(
                    "ICE state:",
                    pc.iceConnectionState
                );

                if (
                    pc.iceConnectionState ===
                    "connected" ||
                    pc.iceConnectionState ===
                    "completed"
                ) {
                    connecting(false);
                    status("Connected");
                    startTimer();
                }
            };

        return pc;
    }

    /* ======================================================
       REMOTE MEDIA
    ====================================================== */

    function attachRemote() {

        if (!remoteStream) {
            return;
        }

        if (
            callType === "video" &&
            remoteVideo
        ) {

            remoteVideo.srcObject =
                remoteStream;

            remoteVideo.playsInline =
                true;

            remoteVideo
                .play()
                .catch(() => {});

            if (remotePlaceholder) {
                remotePlaceholder.classList.add(
                    "hidden"
                );
            }

        } else if (remoteAudio) {

            remoteAudio.srcObject =
                remoteStream;

            remoteAudio
                .play()
                .catch(() => {});
        }
    }

    /* ======================================================
       UPDATE STATUS
    ====================================================== */

    async function updateStatus(value) {

        if (!callRef) {
            return;
        }

        try {

            await callRef.update({

                status:
                    value,

                updatedAt:
                    firebase.database.ServerValue.TIMESTAMP

            });

        } catch (e) {

            error(
                "Status:",
                e
            );
        }
    }

    /* ======================================================
       OFFER
    ====================================================== */

    async function sendOffer() {

        const peer =
            createPeer();

        const offer =
            await peer.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo:
                    callType === "video"
            });

        await peer.setLocalDescription(
            offer
        );

        await callRef
            .child("offer")
            .set({
                type:
                    peer.localDescription.type,

                sdp:
                    peer.localDescription.sdp
            });

        log(
            "Offer written to Firebase."
        );
    }

    /* ======================================================
       ANSWER
    ====================================================== */

    async function handleOffer(
        offer
    ) {

        if (
            offerProcessing ||
            remoteDescriptionReady
        ) {
            return;
        }

        offerProcessing =
            true;

        try {

            const peer =
                createPeer();

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    offer
                )
            );

            remoteDescriptionReady =
                true;

            await flushCandidates();

            const answer =
                await peer.createAnswer();

            await peer.setLocalDescription(
                answer
            );

            await callRef
                .child("answer")
                .set({

                    type:
                        peer.localDescription.type,

                    sdp:
                        peer.localDescription.sdp

                });

            await updateStatus(
                "accepted"
            );

            log(
                "Answer written to Firebase."
            );

        } catch (e) {

            error(
                "Handle offer:",
                e
            );

            toast(
                "Unable to establish call."
            );

        } finally {

            offerProcessing =
                false;
        }
    }

    /* ======================================================
       ANSWER LISTENER
    ====================================================== */

    function listenAnswer() {

        callRef
            .child("answer")
            .on(
                "value",
                async snapshot => {

                    if (role !== "caller") {
                        return;
                    }

                    const answer =
                        snapshot.val();

                    if (
                        !answer ||
                        !pc ||
                        pc.currentRemoteDescription
                    ) {
                        return;
                    }

                    try {

                        await pc.setRemoteDescription(
                            new RTCSessionDescription(
                                answer
                            )
                        );

                        remoteDescriptionReady =
                            true;

                        await flushCandidates();

                        log(
                            "Answer applied."
                        );

                    } catch (e) {

                        error(
                            "Answer:",
                            e
                        );
                    }
                }
            );
    }

    /* ======================================================
       OFFER LISTENER
    ====================================================== */

    function listenOffer() {

        callRef
            .child("offer")
            .on(
                "value",
                async snapshot => {

                    const offer =
                        snapshot.val();

                    if (
                        !offer ||
                        role !== "receiver" ||
                        !accepted
                    ) {
                        return;
                    }

                    await handleOffer(
                        offer
                    );
                }
            );
    }

    /* ======================================================
       ICE LISTENER
    ====================================================== */

    function listenICE() {

        if (!remoteUserId) {
            return;
        }

        callRef
            .child(
                "candidates/" +
                remoteUserId
            )
            .on(
                "child_added",
                async snapshot => {

                    const candidate =
                        snapshot.val();

                    if (!candidate) {
                        return;
                    }

                    try {

                        const ice =
                            new RTCIceCandidate(
                                candidate
                            );

                        if (
                            pc &&
                            pc.remoteDescription
                        ) {

                            await pc.addIceCandidate(
                                ice
                            );

                        } else {

                            pendingCandidates.push(
                                ice
                            );
                        }

                    } catch (e) {

                        error(
                            "ICE receive:",
                            e
                        );
                    }
                }
            );
    }

    /* ======================================================
       FLUSH ICE
    ====================================================== */

    async function flushCandidates() {

        if (
            !pc ||
            !pc.remoteDescription
        ) {
            return;
        }

        while (
            pendingCandidates.length
        ) {

            const candidate =
                pendingCandidates.shift();

            try {

                await pc.addIceCandidate(
                    candidate
                );

            } catch (e) {

                error(
                    "ICE add:",
                    e
                );
            }
        }
    }

    /* ======================================================
       CREATE OUTGOING CALL
    ====================================================== */

    async function startOutgoing() {

        if (!receiverId) {

            toast(
                "Receiver ID missing."
            );

            return;
        }

        await waitForUser();

        if (
            receiverId ===
            currentUser.uid
        ) {

            toast(
                "You cannot call yourself."
            );

            return;
        }

        remoteUserId =
            receiverId;

        await setRemoteUser(
            receiverId
        );

        getCallRef();

        const existing =
            await callRef.once(
                "value"
            );

        if (!existing.exists()) {
            await createCall();
        }

        status(
            "Calling..."
        );

        connecting(
            true,
            "Calling..."
        );

        await getLocalMedia();

        createPeer();

        listenAnswer();

        listenICE();

        await sendOffer();

        log(
            "Outgoing call started."
        );
    }

    /* ======================================================
       INCOMING
    ====================================================== */

    async function prepareIncoming() {

        await waitForUser();

        if (!callId) {

            showEnded(
                "Invalid call."
            );

            return;
        }

        getCallRef();

        const snapshot =
            await callRef.once(
                "value"
            );

        const data =
            snapshot.val();

        if (!data) {

            showEnded(
                "Call not found."
            );

            return;
        }

        if (
            data.receiverId &&
            data.receiverId !==
            currentUser.uid
        ) {

            showEnded(
                "This call is not for you."
            );

            return;
        }

        if (
            data.status ===
            "ended"
        ) {

            showEnded(
                "Call already ended."
            );

            return;
        }

        if (
            data.status ===
            "rejected"
        ) {

            showEnded(
                "Call declined."
            );

            return;
        }

        callerId =
            data.callerId;

        remoteUserId =
            data.callerId;

        callType =
            data.type === "video"
                ? "video"
                : "audio";

        await setRemoteUser(
            remoteUserId
        );

        showIncoming();

        listenOffer();

        listenICE();

        listenCallState();

        log(
            "Incoming call ready."
        );
    }

    /* ======================================================
       CALL STATE
    ====================================================== */

    function listenCallState() {

        callRef.on(
            "value",
            snapshot => {

                const data =
                    snapshot.val();

                if (!data) {
                    return;
                }

                if (
                    data.status ===
                    "ended"
                ) {

                    if (!callFinished) {

                        callFinished =
                            true;

                        cleanup();

                        showEnded(
                            "Call ended."
                        );
                    }
                }

                if (
                    data.status ===
                    "rejected"
                ) {

                    if (!callFinished) {

                        callFinished =
                            true;

                        cleanup();

                        showEnded(
                            "Call declined."
                        );
                    }
                }
            }
        );
    }

/* ======================================================
   INCOMING UI
====================================================== */

function showIncoming() {

    const type =
        $("incomingType");

    if (type) {

        type.innerHTML =
            callType === "video"
                ? '<i class="fa-solid fa-video"></i> Video Call'
                : '<i class="fa-solid fa-phone"></i> Voice Call';
    }

    if (incomingScreen) {

        incomingScreen.classList.remove(
            "hidden"
        );
    }

    if (callApp) {

        callApp.classList.add(
            "hidden"
        );
    }

    status(
        callType === "video"
            ? "Incoming video call..."
            : "Incoming voice call..."
    );

    /*
     * 🔔 START RINGTONE
     */

    startRingtone();

    log(
        "📲 Incoming call UI + ringtone ready."
    );
}

    /* ======================================================
       ACCEPT
    ====================================================== */

    async function acceptCall() {

        if (accepted || callFinished) {
            return;
        }

        try {

            accepted =
                true;

            if (incomingScreen) {
                incomingScreen.classList.add(
                    "hidden"
                );
            }

            if (callApp) {
                callApp.classList.remove(
                    "hidden"
                );
            }

            connecting(
                true,
                "Connecting..."
            );

            status(
                "Connecting..."
            );

            await getLocalMedia();

            createPeer();

            /*
             * IMPORTANT:
             * Firebase offer listener is already active.
             * After accepted=true it will process offer.
             */

            await updateStatus(
                "accepted"
            );

            /*
             * Read existing offer immediately.
             * This removes Firebase timing race.
             */

            const snapshot =
                await callRef
                    .child("offer")
                    .once("value");

            const offer =
                snapshot.val();

            if (offer) {

                await handleOffer(
                    offer
                );
            }

            log(
                "Call accepted."
            );

        } catch (e) {

            error(
                "Accept call:",
                e
            );

            accepted =
                false;

            toast(
                "Could not accept call."
            );
        }
    }

    /* ======================================================
       REJECT
    ====================================================== */

    async function rejectCall() {

        if (!callRef) {
            return;
        }

        try {

            await updateStatus(
                "rejected"
            );

        } finally {

            callFinished =
                true;

            cleanup();

            showEnded(
                "Call declined."
            );
        }
    }

    /* ======================================================
       END CALL
    ====================================================== */

    async function endCall() {

        if (callFinished) {
            return;
        }

        callFinished =
            true;

        try {

            if (callRef) {

                await callRef.update({

                    status:
                        "ended",

                    endedBy:
                        currentUser
                            ? currentUser.uid
                            : null,

                    endedAt:
                        firebase.database.ServerValue.TIMESTAMP,

                    updatedAt:
                        firebase.database.ServerValue.TIMESTAMP

                });
            }

        } catch (e) {

            error(
                "End call:",
                e
            );
        }

        cleanup();

        showEnded(
            "Call ended."
        );
    }

    /* ======================================================
       MUTE
    ====================================================== */

    function toggleMute() {

        if (!localStream) {
            return;
        }

        const track =
            localStream
                .getAudioTracks()[0];

        if (!track) {
            return;
        }

        track.enabled =
            !track.enabled;

        const buttons = [
            $("muteBtn"),
            $("muteCallBtn")
        ];

        buttons.forEach(button => {

            if (!button) {
                return;
            }

            button.classList.toggle(
                "active",
                !track.enabled
            );

            const icon =
                button.querySelector("i");

            if (icon) {

                icon.className =
                    track.enabled
                        ? "fa-solid fa-microphone"
                        : "fa-solid fa-microphone-slash";
            }
        });
    }

    /* ======================================================
       CAMERA
    ====================================================== */

    function toggleCamera() {

        if (!localStream) {
            return;
        }

        const track =
            localStream
                .getVideoTracks()[0];

        if (!track) {
            return;
        }

        track.enabled =
            !track.enabled;

        const buttons = [
            $("cameraToggleBtn"),
            $("cameraCallBtn")
        ];

        buttons.forEach(button => {

            if (!button) {
                return;
            }

            button.classList.toggle(
                "active",
                !track.enabled
            );

            const icon =
                button.querySelector("i");

            if (icon) {

                icon.className =
                    track.enabled
                        ? "fa-solid fa-video"
                        : "fa-solid fa-video-slash";
            }
        });
    }

    /* ======================================================
       TIMER
    ====================================================== */

    function startTimer() {

        if (timer || callFinished) {
            return;
        }

        timer =
            setInterval(() => {

                seconds++;

                const min =
                    String(
                        Math.floor(
                            seconds / 60
                        )
                    ).padStart(
                        2,
                        "0"
                    );

                const sec =
                    String(
                        seconds % 60
                    ).padStart(
                        2,
                        "0"
                    );

                if (callDuration) {

                    callDuration.textContent =
                        `${min}:${sec}`;
                }

            }, 1000);
    }

    function stopTimer() {

        if (timer) {

            clearInterval(
                timer
            );

            timer =
                null;
        }
    }

    /* ======================================================
       CLEAN MEDIA
    ====================================================== */

    function cleanupMedia() {

        if (localStream) {

            localStream
                .getTracks()
                .forEach(track => {

                    try {
                        track.stop();
                    } catch (_) {}

                });
        }

        if (pc) {

            try {
                pc.ontrack = null;
                pc.onicecandidate = null;
                pc.close();
            } catch (_) {}
        }

        if (localVideo) {
            localVideo.srcObject = null;
        }

        if (remoteVideo) {
            remoteVideo.srcObject = null;
        }

        if (remoteAudio) {
            remoteAudio.srcObject = null;
        }

        localStream =
            null;

        remoteStream =
            null;

        pc =
            null;

        window.localStream =
            null;

        window.remoteStream =
            null;
    }

    function cleanup() {

        cleanupMedia();

        stopTimer();
    }

    /* ======================================================
       ENDED
    ====================================================== */

    function showEnded(message) {

        connecting(false);

        status(message);

        if ($("endedText")) {
            $("endedText").textContent =
                message;
        }

        if (endedScreen) {
            endedScreen.classList.remove(
                "hidden"
            );
        }

        if (callApp) {
            callApp.classList.add(
                "hidden"
            );
        }

        if (incomingScreen) {
            incomingScreen.classList.add(
                "hidden"
            );
        }
    }

    /* ======================================================
       BUTTONS
    ====================================================== */

    $("acceptCallBtn")
        ?.addEventListener(
            "click",
            acceptCall
        );

    $("rejectCallBtn")
        ?.addEventListener(
            "click",
            rejectCall
        );

    $("endCallBtn")
        ?.addEventListener(
            "click",
            endCall
        );

    $("muteBtn")
        ?.addEventListener(
            "click",
            toggleMute
        );

    $("muteCallBtn")
        ?.addEventListener(
            "click",
            toggleMute
        );

    $("cameraToggleBtn")
        ?.addEventListener(
            "click",
            toggleCamera
        );

    $("cameraCallBtn")
        ?.addEventListener(
            "click",
            toggleCamera
        );

    $("minimizeCallBtn")
        ?.addEventListener(
            "click",
            () => {
                window.history.back();
            }
        );

    /* ======================================================
       BEFORE UNLOAD
    ====================================================== */

    window.addEventListener(
        "beforeunload",
        () => {

            if (
                callRef &&
                currentUser &&
                !callFinished
            ) {

                callRef.update({

                    status:
                        "ended",

                    endedBy:
                        currentUser.uid,

                    endedAt:
                        firebase.database.ServerValue.TIMESTAMP

                }).catch(() => {});
            }

            cleanupMedia();
        }
    );

    /* ======================================================
       PUBLIC API
    ====================================================== */

    window.VieworaCall = {

        startCall: async (
            uid,
            type = "audio"
        ) => {

            receiverId =
                uid;

            callType =
                type === "video"
                    ? "video"
                    : "audio";

            role =
                "caller";

            window.location.href =
                "call.html" +
                "?type=" +
                encodeURIComponent(
                    callType
                ) +
                "&role=caller" +
                "&receiverId=" +
                encodeURIComponent(
                    receiverId
                );
        },

        acceptCall,

        rejectCall,

        endCall,

        mute:
            toggleMute,

        toggleCamera,

        getCallId:
            () => callId,

        getCallType:
            () => callType,

        getRemoteUserId:
            () => remoteUserId
    };

    /* ======================================================
       INITIALIZE
    ====================================================== */

    async function init() {

        try {

            await waitForUser();

            /*
             * Receiver
             */

            if (
                role ===
                "receiver"
            ) {

                await prepareIncoming();

                return;
            }

            /*
             * Caller
             */

            if (receiverId) {

                await startOutgoing();

            } else {

                log(
                    "Call engine ready."
                );
            }

        } catch (e) {

            error(
                "Init:",
                e
            );

            showEnded(
                "Unable to initialize call."
            );
        }
    }

    init();

    log(
        "================================"
    );

    log(
        "VIEWORA CALL V2 FINAL"
    );

    log(
        "WebRTC: READY"
    );

    log(
        "Firebase Signaling: READY"
    );

    log(
        "Voice: READY"
    );

    log(
        "Video: READY"
    );

    log(
        "================================"
    );

})();
window.VieworaStartVoiceCall = function (uid) {
  window.VieworaCall.startCall(uid, "audio");
};

window.VieworaStartVideoCall = function (uid) {
  window.VieworaCall.startCall(uid, "video");
};

window.startVoiceCall = window.VieworaStartVoiceCall;
window.startVideoCall = window.VieworaStartVideoCall;