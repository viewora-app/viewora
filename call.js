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

    /* STUN + free public TURN (works across mobile data / NAT).
       For production scale, replace TURN with your Metered/Twilio credentials. */
    const RTC_CONFIG = {
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun.cloudflare.com:3478"
                ]
            },
            {
                urls: [
                    "turn:openrelay.metered.ca:80",
                    "turn:openrelay.metered.ca:443",
                    "turn:openrelay.metered.ca:443?transport=tcp"
                ],
                username: "openrelayproject",
                credential: "openrelayproject"
            }
        ],
        iceCandidatePoolSize: 10
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
        params.get("receiverId") ||
        params.get("uid") ||
        params.get("to") ||
        params.get("user");

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

    let speakerOn = false;

    let ringTimeoutId = null;

    let wakeLock = null;

    let iceRestartAttempts = 0;

    const RING_TIMEOUT_MS = 45000;

    const MAX_ICE_RESTARTS = 2;


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


                if (state === "connected") {
                    iceRestartAttempts = 0;
                    clearRingTimeout();
                    accepted = true;
                    setConnecting(false);
                    setStatus("Connected");
                    startTimer();
                    if (remoteVideo) remoteVideo.play().catch(() => {});
                    if (remoteAudio) remoteAudio.play().catch(() => {});
                }

                if (state === "disconnected") {
                    setConnecting(true, "Reconnecting...");
                    setStatus("Reconnecting...");
                    setTimeout(() => {
                        tryRestartIce("disconnected");
                    }, 2500);
                }

                if (state === "failed") {
                    setConnecting(true, "Reconnecting...");
                    setStatus("Reconnecting...");
                    tryRestartIce("failed").then(ok => {
                        if (!ok) {
                            setConnecting(false);
                            setStatus("Connection failed");
                            toast("Call connection failed. Check network.");
                            endCall();
                        }
                    });
                }

                if (state === "closed") {
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

        // Block check
        try {
            const [a, b] = await Promise.all([
                db.ref("blocks/" + currentUser.uid + "/" + receiverId).once("value"),
                db.ref("blocks/" + receiverId + "/" + currentUser.uid).once("value")
            ]);
            if ((a.exists() && a.val()) || (b.exists() && b.val())) {
                toast("Cannot call this user.");
                showEnded("Call unavailable.");
                return;
            }
        } catch (_) {}


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

        startRingTimeout();
        requestWakeLock();


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

            clearRingTimeout();
            requestWakeLock();


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

        clearRingTimeout();
        releaseWakeLock();


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
       ICE RESTART (network drop recovery)
    ====================================================== */

    async function tryRestartIce(reason) {
        if (callEnded || !peerConnection) return false;
        if (iceRestartAttempts >= MAX_ICE_RESTARTS) return false;

        const state = peerConnection.iceConnectionState;
        if (state === "connected" || state === "completed") return true;

        iceRestartAttempts++;
        log("ICE restart attempt", iceRestartAttempts, reason);

        try {
            if (role === "caller" && typeof peerConnection.restartIce === "function") {
                peerConnection.restartIce();
                const offer = await peerConnection.createOffer({ iceRestart: true });
                await peerConnection.setLocalDescription(offer);
                await updateCall({
                    offer: {
                        type: offer.type,
                        sdp: offer.sdp
                    },
                    iceRestartAt: firebase.database.ServerValue.TIMESTAMP
                });
                return true;
            }
            // Receiver side: wait for new offer from caller
            return iceRestartAttempts < MAX_ICE_RESTARTS;
        } catch (err) {
            logError("ICE restart failed:", err);
            return false;
        }
    }


    /* ======================================================
       SPEAKER (earpiece ↔ loudspeaker)
    ====================================================== */

    async function toggleSpeaker() {
        speakerOn = !speakerOn;

        const btn = $("speakerBtn");
        if (btn) {
            btn.classList.toggle("active", speakerOn);
            const icon = btn.querySelector("i");
            if (icon) {
                icon.className = speakerOn
                    ? "fa-solid fa-volume-high"
                    : "fa-solid fa-volume-low";
            }
        }

        try {
            const el = callType === "video" ? remoteVideo : remoteAudio;
            if (el && typeof el.setSinkId === "function") {
                // "" = default (earpiece on many mobiles), "default" = system default
                await el.setSinkId(speakerOn ? "default" : "");
            }
        } catch (err) {
            log("setSinkId not supported:", err && err.message);
        }

        toast(speakerOn ? "Speaker on" : "Speaker off");
    }


    /* ======================================================
       RING TIMEOUT (no answer → auto end)
    ====================================================== */

    function startRingTimeout() {
        clearRingTimeout();
        ringTimeoutId = setTimeout(() => {
            if (callEnded || accepted) return;
            toast("No answer");
            endCall();
        }, RING_TIMEOUT_MS);
    }

    function clearRingTimeout() {
        if (ringTimeoutId) {
            clearTimeout(ringTimeoutId);
            ringTimeoutId = null;
        }
    }


    /* ======================================================
       WAKE LOCK (screen stays on during call)
    ====================================================== */

    async function requestWakeLock() {
        try {
            if (navigator.wakeLock && navigator.wakeLock.request) {
                wakeLock = await navigator.wakeLock.request("screen");
                wakeLock.addEventListener("release", () => {
                    wakeLock = null;
                });
            }
        } catch (_) {}
    }

    async function releaseWakeLock() {
        try {
            if (wakeLock) {
                await wakeLock.release();
                wakeLock = null;
            }
        } catch (_) {}
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

        if (!localStream) {
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
            // Request new camera WITHOUT touching audio (prevents pause glitch)
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { exact: facing },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            });

            const newTrack = newStream.getVideoTracks()[0];
            if (!newTrack) throw new Error("No new video track");

            // Replace sender track first (WebRTC stays alive)
            if (peerConnection) {
                const sender = peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === "video");
                if (sender) {
                    await sender.replaceTrack(newTrack);
                }
            }

            // Swap local tracks without stopping whole stream
            try {
                localStream.removeTrack(oldTrack);
            } catch (_) {}
            localStream.addTrack(newTrack);
            try { oldTrack.stop(); } catch (_) {}

            window.localStream = localStream;

            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.playsInline = true;
                localVideo.muted = true;
                localVideo.setAttribute("playsinline", "");
                // Keep playing — never pause remote
                await localVideo.play().catch(() => {});
            }

            // Ensure remote video still playing
            if (typeof remoteVideo !== "undefined" && remoteVideo) {
                remoteVideo.play().catch(() => {});
            }

            newStream.getTracks().forEach(t => {
                if (t.id !== newTrack.id) {
                    try { t.stop(); } catch (_) {}
                }
            });

            toast(usingFrontCamera ? "Front camera" : "Back camera");
        } catch (error) {
            // Fallback: ideal instead of exact (some devices reject exact)
            try {
                const fallback = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { facingMode: { ideal: facing } }
                });
                const nt = fallback.getVideoTracks()[0];
                if (nt && peerConnection) {
                    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
                    if (sender) await sender.replaceTrack(nt);
                    try { localStream.removeTrack(oldTrack); oldTrack.stop(); } catch (_) {}
                    localStream.addTrack(nt);
                    if (localVideo) {
                        localVideo.srcObject = localStream;
                        await localVideo.play().catch(() => {});
                    }
                    toast(usingFrontCamera ? "Front camera" : "Back camera");
                    return;
                }
            } catch (_) {}
            logError("Camera switch:", error);
            usingFrontCamera = !usingFrontCamera;
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
        clearRingTimeout();
        releaseWakeLock();
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


    $("speakerBtn")
        ?.addEventListener(
            "click",
            toggleSpeaker
        );


    $("minimizeCallBtn")
        ?.addEventListener(
            "click",
            () => {

                window.history.back();

            }
        );

    // Re-acquire wake lock if tab becomes visible again mid-call
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && !callEnded && accepted) {
            requestWakeLock();
        }
    });


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
            // When call.js is included on chat/messages — only register API, do not start call UI
            const page = (location.pathname.split("/").pop() || "").toLowerCase();
            const onCallPage = page.indexOf("call") !== -1;

            if (!onCallPage) {
                log("☎️ Viewora Call API ready (embedded).");
                return;
            }

            await waitForAuth();

            if (role === "receiver") {
                await prepareIncomingCall();
                return;
            }

            if (receiverId) {
                await startOutgoingCall();
                return;
            }

            toast("Receiver ID is missing. Open chat and try call again.");
            log("☎️ Viewora Call engine ready — no receiverId.");

        } catch (error) {
            logError("Call initialization:", error);
            showEnded("Unable to initialize call.");
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