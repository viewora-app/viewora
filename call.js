"use strict";

/*
============================================================
 VIEWORA CALL V3 — PREMIUM WEBRTC CALL ENGINE
============================================================

 Supports:
 • Voice Call
 • Video Call
 • Firebase Realtime Database signaling
 • Incoming call records
 • WebRTC Offer / Answer
 • ICE candidate exchange
 • Accept / Reject / End
 • Mute
 • Camera
 • Call timer
 • Caller / Receiver mode
 • Firebase race-condition protection

 REQUIRED:
 • firebase.js
 • Firebase Auth
 • Firebase Realtime Database
 • call.html

 GLOBAL:
   window.VieworaCall.startCall(uid, type)

============================================================
*/

(() => {

    /* ======================================================
       DOUBLE INITIALIZATION
    ====================================================== */

    if (window.__VIEWORA_CALL_V3__) {
        console.warn("VIEWORA CALL V3 already initialized.");
        return;
    }

    window.__VIEWORA_CALL_V3__ = true;


    /* ======================================================
       FIREBASE CHECK
    ====================================================== */

    if (
        typeof firebase === "undefined" ||
        !window.auth ||
        !window.db
    ) {
        console.error(
            "❌ Viewora Call: Firebase is not ready."
        );
        return;
    }


    /* ======================================================
       WEBRTC CONFIG
    ====================================================== */

    const RTC_CONFIG = {

        iceServers: [

            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302"
                ]
            }

        ]

    };


    /* ======================================================
       URL
    ====================================================== */

    const params =
        new URLSearchParams(
            window.location.search
        );


    let callId =
        params.get("callId");

    let receiverId =
        params.get("receiverId");

    let role =
        params.get("role") === "receiver"
            ? "receiver"
            : "caller";

    let callType =
        params.get("type") === "video"
            ? "video"
            : "audio";


    /* ======================================================
       STATE
    ====================================================== */

    let currentUser = null;

    let callerId = null;

    let remoteUserId = null;

    let callRef = null;

    let peerConnection = null;

    let localStream = null;

    let remoteStream = null;

    let pendingIceCandidates = [];

    let remoteDescriptionSet = false;

    let offerHandled = false;

    let answerHandled = false;

    let accepted = false;

    let callEnded = false;

    let timerInterval = null;

    let callSeconds = 0;

    let incomingRecordRemoved = false;


    /* ======================================================
       DOM
    ====================================================== */

    const $ = id =>
        document.getElementById(id);


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


    function logError(...args) {

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


        text.textContent =
            message;


        box.classList.remove(
            "hidden"
        );


        clearTimeout(
            box.__timer
        );


        box.__timer =
            setTimeout(() => {

                box.classList.add(
                    "hidden"
                );

            }, 3000);

    }


    /* ======================================================
       STATUS
    ====================================================== */

    function setStatus(text) {

        if (callStatus) {

            callStatus.textContent =
                text;

        }

    }


    function setConnecting(
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

    async function waitForAuth() {

        if (auth.currentUser) {

            currentUser =
                auth.currentUser;

            return currentUser;
        }


        return new Promise(
            (resolve, reject) => {

                let finished = false;

                const unsubscribe =
                    auth.onAuthStateChanged(
                        user => {

                            if (finished) {
                                return;
                            }

                            finished = true;

                            unsubscribe();


                            if (!user) {

                                reject(
                                    new Error(
                                        "User is not authenticated."
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
       LOAD USER
    ====================================================== */

    async function getUser(uid) {

        if (!uid) {
            return null;
        }


        try {

            const snapshot =
                await db
                    .ref(
                        "users/" +
                        uid
                    )
                    .once("value");


            return snapshot.exists()
                ? snapshot.val()
                : null;

        } catch (error) {

            logError(
                "User load error:",
                error
            );

            return null;

        }

    }


    /* ======================================================
       SHOW USER
    ====================================================== */

    async function loadRemoteUser(uid) {

        if (!uid) {
            return;
        }


        remoteUserId =
            uid;


        const user =
            await getUser(uid);


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


        const nameElements = [

            $("remoteName"),
            $("incomingName")

        ];


        nameElements.forEach(element => {

            if (element) {

                element.textContent =
                    name;

            }

        });


        const usernameElements = [

            $("remoteUsername"),
            $("incomingUsername")

        ];


        usernameElements.forEach(element => {

            if (element) {

                element.textContent =
                    username;

            }

        });


        const avatarElements = [

            $("remoteAvatar"),
            $("incomingAvatar")

        ];


        avatarElements.forEach(element => {

            if (element) {

                element.src =
                    photo;

            }

        });

    }


    /* ======================================================
       CALL REFERENCE
    ====================================================== */

    function ensureCallReference() {

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

    ensureCallReference();   // ← yahan change kiya

    callerId = currentUser.uid;

    const callData = {
        callId: callId,
        callerId: currentUser.uid,
        receiverId: receiverId,
        type: callType,
        status: "ringing",
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    const updates = {};

    updates[`calls/${callId}`] = callData;
    updates[`incomingCalls/${receiverId}/${callId}`] = callData;

    await db.ref().update(updates);

    log("📞 Call + Incoming call created:", callId);
}

    /* ======================================================
       REMOVE INCOMING RECORD
    ====================================================== */

    async function removeIncomingCall() {

        if (
            incomingRecordRemoved ||
            !receiverId ||
            !callId
        ) {
            return;
        }


        incomingRecordRemoved =
            true;


        try {

            await db
                .ref(
                    "incomingCalls/" +
                    receiverId +
                    "/" +
                    callId
                )
                .remove();

        } catch (error) {

            logError(
                "Incoming record remove:",
                error
            );

        }

    }


    /* ======================================================
       MEDIA
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
                "Camera/microphone unavailable."
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

                        facingMode:
                            "user",

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

        } catch (error) {

            logError(
                "getUserMedia:",
                error
            );


            if (
                error.name ===
                "NotAllowedError"
            ) {

                toast(
                    "Camera/microphone permission denied."
                );

            } else if (
                error.name ===
                "NotFoundError"
            ) {

                toast(
                    "Camera or microphone not found."
                );

            } else {

                toast(
                    "Unable to access camera or microphone."
                );

            }


            throw error;

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


        return localStream;

    }


    /* ======================================================
       CREATE PEER
    ====================================================== */

    function createPeerConnection() {

        if (peerConnection) {

            return peerConnection;

        }


        peerConnection =
            new RTCPeerConnection(
                RTC_CONFIG
            );


        remoteStream =
            new MediaStream();


        window.remoteStream =
            remoteStream;


        /*
         * LOCAL TRACKS
         */

        if (localStream) {

            localStream
                .getTracks()
                .forEach(track => {

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                });

        }


        /*
         * REMOTE TRACKS
         */

        peerConnection.ontrack =
            event => {

                if (
                    event.streams &&
                    event.streams[0]
                ) {

                    event.streams[0]
                        .getTracks()
                        .forEach(track => {

                            if (
                                !remoteStream
                                    .getTracks()
                                    .some(
                                        existing =>
                                            existing.id ===
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


                attachRemoteMedia();

            };


        /*
         * ICE OUT
         */

        peerConnection.onicecandidate =
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
                    .push(
                        candidate
                    )
                    .catch(
                        error =>
                            logError(
                                "ICE write:",
                                error
                            )
                    );

            };


        /*
         * CONNECTION
         */

        peerConnection.onconnectionstatechange =
            () => {

                if (!peerConnection) {
                    return;
                }


                const state =
                    peerConnection.connectionState;


                log(
                    "Connection:",
                    state
                );


                if (
                    state ===
                    "connecting"
                ) {

                    setConnecting(
                        true,
                        "Connecting..."
                    );

                    setStatus(
                        "Connecting..."
                    );

                }


                if (
                    state ===
                    "connected"
                ) {

                    setConnecting(
                        false
                    );

                    setStatus(
                        "Connected"
                    );

                    startTimer();

                }


                if (
                    state ===
                    "disconnected"
                ) {

                    setConnecting(
                        true,
                        "Reconnecting..."
                    );

                    setStatus(
                        "Reconnecting..."
                    );

                }


                if (
                    state ===
                    "failed"
                ) {

                    setConnecting(
                        false
                    );

                    setStatus(
                        "Connection failed"
                    );

                    toast(
                        "Call connection failed."
                    );

                }


                if (
                    state ===
                    "closed"
                ) {

                    cleanupMedia();

                }

            };


        /*
         * ICE STATE
         */

        peerConnection.oniceconnectionstatechange =
            () => {

                if (!peerConnection) {
                    return;
                }


                const state =
                    peerConnection
                        .iceConnectionState;


                log(
                    "ICE:",
                    state
                );


                if (
                    state ===
                    "connected" ||
                    state ===
                    "completed"
                ) {

                    setConnecting(
                        false
                    );

                    setStatus(
                        "Connected"
                    );

                    startTimer();

                }

            };


        return peerConnection;

    }


    /* ======================================================
       REMOTE MEDIA
    ====================================================== */

    function attachRemoteMedia() {

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

        }


        if (remoteAudio) {

            remoteAudio.srcObject =
                remoteStream;


            remoteAudio
                .play()
                .catch(() => {});

        }

    }


    /* ======================================================
       UPDATE CALL
    ====================================================== */

    async function updateCall(data) {

        if (!callRef) {
            return;
        }


        try {

            await callRef.update({

                ...data,

                updatedAt:
                    firebase.database.ServerValue.TIMESTAMP

            });

        } catch (error) {

            logError(
                "Call update:",
                error
            );

        }

    }


    /* ======================================================
       OFFER
    ====================================================== */

    async function createOffer() {

        const peer =
            createPeerConnection();


        const offer =
            await peer.createOffer({

                offerToReceiveAudio:
                    true,

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
            "📤 Offer sent."
        );

    }


    /* ======================================================
       HANDLE OFFER
    ====================================================== */

    async function handleOffer(
        offer
    ) {

        if (
            offerHandled ||
            !accepted
        ) {

            return;

        }


        if (!offer) {
            return;
        }


        offerHandled =
            true;


        try {

            const peer =
                createPeerConnection();


            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    offer
                )
            );


            remoteDescriptionSet =
                true;


            await flushPendingICE();


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


            await updateCall({

                status:
                    "accepted"

            });


            log(
                "📥 Answer sent."
            );

        } catch (error) {

            offerHandled =
                false;


            logError(
                "Offer handling:",
                error
            );


            toast(
                "Unable to connect call."
            );

        }

    }


    /* ======================================================
       ANSWER LISTENER
    ====================================================== */

    function listenForAnswer() {

        callRef
            .child("answer")
            .on(
                "value",
                async snapshot => {

                    if (
                        role !==
                        "caller"
                    ) {

                        return;

                    }


                    const answer =
                        snapshot.val();


                    if (
                        !answer ||
                        answerHandled ||
                        !peerConnection
                    ) {

                        return;

                    }


                    if (
                        peerConnection
                            .currentRemoteDescription
                    ) {

                        return;

                    }


                    try {

                        answerHandled =
                            true;


                        await peerConnection
                            .setRemoteDescription(
                                new RTCSessionDescription(
                                    answer
                                )
                            );


                        remoteDescriptionSet =
                            true;


                        await flushPendingICE();


                        log(
                            "📥 Answer received."
                        );

                    } catch (error) {

                        answerHandled =
                            false;


                        logError(
                            "Answer error:",
                            error
                        );

                    }

                }
            );

    }


    /* ======================================================
       OFFER LISTENER
    ====================================================== */

    function listenForOffer() {

        callRef
            .child("offer")
            .on(
                "value",
                async snapshot => {

                    if (
                        role !==
                        "receiver"
                    ) {

                        return;

                    }


                    const offer =
                        snapshot.val();


                    if (
                        !offer ||
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

    function listenForICE() {

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
                            peerConnection &&
                            peerConnection
                                .remoteDescription
                        ) {

                            await peerConnection
                                .addIceCandidate(
                                    ice
                                );

                        } else {

                            pendingIceCandidates.push(
                                ice
                            );

                        }

                    } catch (error) {

                        logError(
                            "ICE receive:",
                            error
                        );

                    }

                }
            );

    }


    /* ======================================================
       FLUSH ICE
    ====================================================== */

    async function flushPendingICE() {

        if (
            !peerConnection ||
            !peerConnection.remoteDescription
        ) {

            return;

        }


        while (
            pendingIceCandidates.length
        ) {

            const candidate =
                pendingIceCandidates.shift();


            try {

                await peerConnection
                    .addIceCandidate(
                        candidate
                    );

            } catch (error) {

                logError(
                    "ICE add:",
                    error
                );

            }

        }

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

                    if (!callEnded) {

                        callEnded =
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

                    if (!callEnded) {

                        callEnded =
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
       OUTGOING CALL
    ====================================================== */

    async function startOutgoingCall() {

        await waitForAuth();


        if (!receiverId) {

            toast(
                "Receiver ID is missing."
            );

            return;

        }


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


        await loadRemoteUser(
            receiverId
        );


        ensureCallReference();


        /*
         * Create Firebase signaling
         */

        await createCall();


        setStatus(
            "Calling..."
        );


        setConnecting(
            true,
            "Calling..."
        );


        /*
         * Media
         */

        await getLocalMedia();


        /*
         * Peer
         */

        createPeerConnection();


        /*
         * Listeners BEFORE offer
         */

        listenForAnswer();

        listenForICE();

        listenCallState();


        /*
         * Offer
         */

        await createOffer();


        log(
            "☎️ Outgoing call started."
        );

    }


    /* ======================================================
       INCOMING CALL
       ====================================================== */

    async function prepareIncomingCall() {

        await waitForAuth();


        if (!callId) {

            showEnded(
                "Call ID missing."
            );

            return;

        }


        ensureCallReference();


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


        await loadRemoteUser(
            remoteUserId
        );


        showIncoming();


        listenForOffer();

        listenForICE();

        listenCallState();


        log(
            "📲 Incoming call prepared."
        );

    }


    /* ======================================================
       INCOMING UI
    ====================================================== */

    function showIncoming() {

        const incomingType =
            $("incomingType");


        if (incomingType) {

            incomingType.innerHTML =
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

    }


    /* ======================================================
       ACCEPT
    ====================================================== */

    async function acceptCall() {

        if (
            accepted ||
            callEnded
        ) {

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


            setConnecting(
                true,
                "Connecting..."
            );


            setStatus(
                "Connecting..."
            );


            await getLocalMedia();


            createPeerConnection();


            /*
             * Mark accepted
             */

            await updateCall({

                status:
                    "accepted",

                acceptedAt:
                    firebase.database.ServerValue.TIMESTAMP

            });


            /*
             * Listen for ICE
             */

            listenForICE();


            /*
             * Read existing offer immediately.
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
                "✅ Call accepted."
            );

        } catch (error) {

            accepted =
                false;


            logError(
                "Accept error:",
                error
            );


            toast(
                "Could not accept call."
            );

        }

    }


    /* ======================================================
       REJECT
    ====================================================== */

    async function rejectCall() {

        if (
            !callRef ||
            callEnded
        ) {

            return;

        }


        callEnded =
            true;


        try {

            await updateCall({

                status:
                    "rejected",

                rejectedBy:
                    currentUser
                        ? currentUser.uid
                        : null,

                rejectedAt:
                    firebase.database.ServerValue.TIMESTAMP

            });


            /*
             * Remove receiver queue
             */

            await db
                .ref(
                    "incomingCalls/" +
                    currentUser.uid +
                    "/" +
                    callId
                )
                .remove();

        } catch (error) {

            logError(
                "Reject:",
                error
            );

        }


        cleanup();


        showEnded(
            "Call declined."
        );

    }


    /* ======================================================
       END CALL
    ====================================================== */

    async function endCall() {

        if (callEnded) {
            return;
        }


        callEnded =
            true;


        try {

            await updateCall({

                status:
                    "ended",

                endedBy:
                    currentUser
                        ? currentUser.uid
                        : null,

                endedAt:
                    firebase.database.ServerValue.TIMESTAMP

            });


            /*
             * Remove incoming queue.
             */

            if (receiverId) {

                await db
                    .ref(
                        "incomingCalls/" +
                        receiverId +
                        "/" +
                        callId
                    )
                    .remove();

            }


            if (
                currentUser &&
                remoteUserId
            ) {

                await db
                    .ref(
                        "incomingCalls/" +
                        remoteUserId +
                        "/" +
                        callId
                    )
                    .remove();

            }

        } catch (error) {

            logError(
                "End call:",
                error
            );

        }


        cleanup();


        showEnded(
            "Call ended."
        );

    }


    
    /* ======================================================
       SWITCH CAMERA (front / back) — no pause glitch
    ====================================================== */

    let usingFrontCamera = true;

    async function switchCamera() {
        if (callType !== "video") {
            toast("Camera switch only on video calls.");
            return;
        }

        if (!localStream || !peerConnection) {
            toast("Camera not ready.");
            return;
        }

        const oldTrack = localStream.getVideoTracks()[0];
        if (!oldTrack) {
            toast("No camera track.");
            return;
        }

        usingFrontCamera = !usingFrontCamera;
        const facing = usingFrontCamera ? "user" : "environment";

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: facing },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            const newTrack = newStream.getVideoTracks()[0];
            if (!newTrack) throw new Error("No new video track");

            // Replace on peer connection WITHOUT stopping negotiation
            const sender = peerConnection
                .getSenders()
                .find(s => s.track && s.track.kind === "video");

            if (sender) {
                await sender.replaceTrack(newTrack);
            }

            // Update local preview — keep stream continuous
            oldTrack.stop();
            localStream.removeTrack(oldTrack);
            localStream.addTrack(newTrack);

            window.localStream = localStream;

            if (localVideo) {
                // Re-assign only if needed; avoid black flash
                if (localVideo.srcObject !== localStream) {
                    localVideo.srcObject = localStream;
                }
                localVideo.playsInline = true;
                localVideo.muted = true;
                await localVideo.play().catch(() => {});
            }

            // Stop extra tracks from temp stream (audio none)
            newStream.getTracks().forEach(t => {
                if (t.id !== newTrack.id) t.stop();
            });

            toast(usingFrontCamera ? "Front camera" : "Back camera");
        } catch (error) {
            logError("Camera switch:", error);
            usingFrontCamera = !usingFrontCamera; // revert flag
            toast("Unable to switch camera.");
        }
    }

/* ======================================================
       MUTE
    ====================================================== */

    function toggleMute() {

        if (!localStream) {
            return;
        }


        const audioTrack =
            localStream
                .getAudioTracks()[0];


        if (!audioTrack) {
            return;
        }


        audioTrack.enabled =
            !audioTrack.enabled;


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
                !audioTrack.enabled
            );


            const icon =
                button.querySelector("i");


            if (icon) {

                icon.className =
                    audioTrack.enabled

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


        const videoTrack =
            localStream
                .getVideoTracks()[0];


        if (!videoTrack) {
            return;
        }


        videoTrack.enabled =
            !videoTrack.enabled;


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
                !videoTrack.enabled
            );


            const icon =
                button.querySelector("i");


            if (icon) {

                icon.className =
                    videoTrack.enabled

                        ? "fa-solid fa-video"

                        : "fa-solid fa-video-slash";

            }

        });

    }


    /* ======================================================
       TIMER
    ====================================================== */

    function startTimer() {

        if (
            timerInterval ||
            callEnded
        ) {

            return;

        }


        timerInterval =
            setInterval(() => {

                callSeconds++;


                const minutes =
                    String(
                        Math.floor(
                            callSeconds / 60
                        )
                    ).padStart(
                        2,
                        "0"
                    );


                const seconds =
                    String(
                        callSeconds % 60
                    ).padStart(
                        2,
                        "0"
                    );


                if (callDuration) {

                    callDuration.textContent =
                        `${minutes}:${seconds}`;

                }

            }, 1000);

    }


    function stopTimer() {

        if (timerInterval) {

            clearInterval(
                timerInterval
            );

            timerInterval =
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


        if (peerConnection) {

            try {

                peerConnection.ontrack =
                    null;

                peerConnection.onicecandidate =
                    null;

                peerConnection.close();

            } catch (_) {}

        }


        if (localVideo) {

            localVideo.srcObject =
                null;

        }


        if (remoteVideo) {

            remoteVideo.srcObject =
                null;

        }


        if (remoteAudio) {

            remoteAudio.srcObject =
                null;

        }


        localStream =
            null;


        remoteStream =
            null;


        peerConnection =
            null;


        window.localStream =
            null;


        window.remoteStream =
            null;

    }


    /* ======================================================
       CLEANUP
    ====================================================== */

    function cleanup() {

        stopTimer();

        cleanupMedia();

    }


    /* ======================================================
       ENDED UI
    ====================================================== */

    function showEnded(message) {

        setConnecting(
            false
        );


        setStatus(
            message
        );


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
       BUTTON EVENTS
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


    $("flipCameraBtn")
        ?.addEventListener(
            "click",
            switchCamera
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
                !callEnded
            ) {

                callRef
                    .update({

                        status:
                            "ended",

                        endedBy:
                            currentUser.uid,

                        endedAt:
                            firebase.database.ServerValue.TIMESTAMP

                    })
                    .catch(
                        () => {}
                    );

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

            if (!uid) {

                toast(
                    "User ID missing."
                );

                return;

            }


            const selectedType =
                type === "video"
                    ? "video"
                    : "audio";


            window.location.href =
                "call.html" +
                "?role=caller" +
                "&type=" +
                encodeURIComponent(
                    selectedType
                ) +
                "&receiverId=" +
                encodeURIComponent(
                    uid
                );

        },


        acceptCall:
            acceptCall,


        rejectCall:
            rejectCall,


        endCall:
            endCall,


        mute:
            toggleMute,


        toggleCamera:
            toggleCamera,

        switchCamera:
            switchCamera,

        getPeerConnection:
            () => peerConnection,


        getCallId:
            () => callId,


        getCallType:
            () => callType,


        getRemoteUserId:
            () => remoteUserId

    };


    /* ======================================================
       GLOBAL SHORTCUTS
    ====================================================== */

    window.VieworaStartVoiceCall =
        uid => {

            window.VieworaCall
                .startCall(
                    uid,
                    "audio"
                );

        };


    window.VieworaStartVideoCall =
        uid => {

            window.VieworaCall
                .startCall(
                    uid,
                    "video"
                );

        };


    window.startVoiceCall =
        window.VieworaStartVoiceCall;


    window.startVideoCall =
        window.VieworaStartVideoCall;


    /* ======================================================
       INIT
    ====================================================== */

    async function init() {

        try {

            await waitForAuth();


            if (
                role ===
                "receiver"
            ) {

                await prepareIncomingCall();

                return;

            }


            if (receiverId) {

                await startOutgoingCall();

                return;

            }


            log(
                "☎️ Viewora Call engine ready."
            );

        } catch (error) {

            logError(
                "Call initialization:",
                error
            );


            showEnded(
                "Unable to initialize call."
            );

        }

    }


    /* ======================================================
       START
    ====================================================== */

    init();


    log(
        "======================================"
    );

    log(
        "VIEWORA CALL V3"
    );

    log(
        "WebRTC: READY"
    );

    log(
        "Firebase Signaling: READY"
    );

    log(
        "Incoming Queue: READY"
    );

    log(
        "Voice: READY"
    );

    log(
        "Video: READY"
    );

    log(
        "======================================"
    );

})();