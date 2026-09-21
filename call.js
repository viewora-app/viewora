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

    // Early navigation API (works even before WebRTC init)
    window.VieworaCall = window.VieworaCall || {};
    window.VieworaCall.startCall = function (uid, type) {
        if (!uid) {
            alert("User ID missing");
            return;
        }
        var t = type === "video" ? "video" : "audio";
        window.location.assign(
            "call.html?role=caller&type=" + encodeURIComponent(t) +
            "&receiverId=" + encodeURIComponent(uid) +
            "&uid=" + encodeURIComponent(uid)
        );
    };
    window.VieworaStartVoiceCall = function (uid) {
        window.VieworaCall.startCall(uid, "audio");
    };
    window.VieworaStartVideoCall = function (uid) {
        window.VieworaCall.startCall(uid, "video");
    };
    window.startVoiceCall = window.VieworaStartVoiceCall;
    window.startVideoCall = window.VieworaStartVideoCall;



    /* ======================================================
       FIREBASE CHECK
    ====================================================== */

    function resolveAuth() {
        if (window.auth) return window.auth;
        try { return firebase.auth(); } catch (_) { return null; }
    }
    function resolveDb() {
        if (window.db) return window.db;
        try { return firebase.database(); } catch (_) { return null; }
    }
    // Bind globals used throughout this file
    var auth = resolveAuth();
    var db = resolveDb();
    if (!auth || !db) {
        console.warn("⚠️ Viewora Call: Firebase not ready yet — will retry on init.");
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

    // Optional: from accept URL
    const urlCallerId = params.get("callerId") || "";

    // Banner / first Accept → call.html?autoAccept=1 (must be defined!)
    const autoAccept =
        params.get("autoAccept") === "1" ||
        params.get("autoAccept") === "true" ||
        params.get("accepted") === "1" ||
        params.get("accept") === "1";


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

    let iceListening = false;
    let answerListening = false;
    let offerListening = false;
    let stateListening = false;

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
        // Ensure firebase bindings (firebase.js may load slightly later)
        auth = resolveAuth() || auth;
        db = resolveDb() || db;
        if (!auth || !db) {
            await new Promise((r) => setTimeout(r, 400));
            auth = resolveAuth() || auth;
            db = resolveDb() || db;
        }
        if (!auth || !db) {
            throw new Error("Firebase Auth/Database not available.");
        }
        window.auth = auth;
        window.db = db;

        if (auth.currentUser) {
            currentUser = auth.currentUser;
            return currentUser;
        }

        return new Promise((resolve, reject) => {
            let finished = false;
            const timer = setTimeout(() => {
                if (finished) return;
                finished = true;
                try { unsubscribe(); } catch (_) {}
                reject(new Error("Auth timeout — please login again."));
            }, 12000);

            const unsubscribe = auth.onAuthStateChanged((user) => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                try { unsubscribe(); } catch (_) {}
                if (!user) {
                    reject(new Error("User is not authenticated."));
                    return;
                }
                currentUser = user;
                resolve(user);
            });
        });
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
        createdAtMs: Date.now(),
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
            throw new Error("Camera/microphone unavailable on this browser.");
        }

        // Soft constraints first (mobile-friendly)
        const wantVideo = callType === "video";
        const attempts = [];

        if (wantVideo) {
            attempts.push({
                audio: true,
                video: { facingMode: "user" }
            });
            attempts.push({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                },
                video: {
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
        }

        attempts.push({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        attempts.push({ audio: true, video: false });

        let lastErr = null;

        for (let i = 0; i < attempts.length; i++) {
            try {
                localStream = await navigator.mediaDevices.getUserMedia(
                    attempts[i]
                );
                if (wantVideo && !localStream.getVideoTracks().length) {
                    callType = "audio";
                    try { toast("Camera unavailable — voice only."); } catch (_) {}
                }
                lastErr = null;
                break;
            } catch (err) {
                lastErr = err;
                logError("getUserMedia attempt " + i + ":", err);
            }
        }

        if (!localStream) {
            const name = lastErr && lastErr.name ? lastErr.name : "";
            const denied =
                name === "NotAllowedError" ||
                name === "PermissionDeniedError" ||
                /permission|denied|NotAllowed/i.test(
                    String(lastErr && lastErr.message)
                );

            if (denied) {
                // Don't hard-end — throw typed error for UI retry
                const e = new Error(
                    "Permission denied. Allow microphone (and camera) for this site, then tap Join again."
                );
                e.name = "NotAllowedError";
                e.code = "PERMISSION_DENIED";
                throw e;
            }

            throw lastErr || new Error("Unable to access microphone.");
        }

        window.localStream = localStream;

        if (localVideo && localStream.getVideoTracks().length) {
            try {
                localVideo.srcObject = localStream;
                localVideo.muted = true;
                localVideo.playsInline = true;
                localVideo.play().catch(() => {});
            } catch (_) {}
        }

        if (localVideoWrap && localStream.getVideoTracks().length) {
            try {
                localVideoWrap.classList.remove("hidden");
            } catch (_) {}
        }

        return localStream;
    }


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
                // User already gestured (accept/call) — force play
                try {
                    if (remoteAudio) {
                        remoteAudio.muted = false;
                        remoteAudio.play().catch(() => {});
                    }
                    if (remoteVideo && callType === "video") {
                        remoteVideo.muted = false;
                        remoteVideo.play().catch(() => {});
                    }
                } catch (_) {}

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
                    try { stopCallerRingtone(); } catch (_) {}
                    iceRestartAttempts = 0;
                    clearRingTimeout();
                    accepted = true;
                    setConnecting(false);
                    setStatus("Connected");
                    startTimer();
                    removeIncomingCall().catch(() => {});
                    try {
                        updateCall({ status: "active", connectedAt: firebase.database.ServerValue.TIMESTAMP });
                    } catch (_) {}
                    if (remoteVideo) remoteVideo.play().catch(() => {});
                    if (remoteAudio) {
                        remoteAudio.muted = false;
                        remoteAudio.play().catch(() => {});
                    }
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
        if (answerListening || !callRef) return;
        answerListening = true;

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
        if (offerListening || !callRef) return;
        offerListening = true;

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

        if (!remoteUserId || !callRef) {
            return;
        }
        if (iceListening) return;
        iceListening = true;

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
        if (stateListening || !callRef) return;
        stateListening = true;

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

                if (
                    data.status === "accepted" ||
                    data.status === "connected"
                ) {
                    try { stopCallerRingtone(); } catch (_) {}
                    try { clearRingTimeout(); } catch (_) {}
                    if (role === "caller" && !accepted) {
                        accepted = true;
                        setConnecting(false);
                        setStatus(data.status === "connected" ? "Connected" : "Connecting...");
                    }
                    if (data.status === "connected") {
                        setConnecting(false);
                        setStatus("Connected");
                    }
                }

            }
        );

    }



    let callerRingAudio = null;

    function startCallerRingtone() {
        try {
            stopCallerRingtone();
            const src =
                localStorage.getItem("viewora_call_ringtone") ||
                "assets/call-ringtone.mp3";
            const a = new Audio(src);
            a.loop = true;
            a.volume = 0.9;
            const p = a.play();
            if (p && p.catch) {
                p.catch(function () {
                    try {
                        const Ctx = window.AudioContext || window.webkitAudioContext;
                        if (!Ctx) return;
                        const ctx = new Ctx();
                        const gain = ctx.createGain();
                        gain.connect(ctx.destination);
                        gain.gain.value = 0.1;
                        function beep() {
                            if (!callerRingAudio || callerRingAudio._dead) return;
                            const o = ctx.createOscillator();
                            o.type = "sine";
                            o.frequency.value = 480;
                            o.connect(gain);
                            const t = ctx.currentTime;
                            o.start(t);
                            o.stop(t + 0.35);
                        }
                        beep();
                        const iv = setInterval(beep, 1500);
                        callerRingAudio = {
                            _dead: false,
                            pause: function () {},
                            stop: function () {
                                this._dead = true;
                                clearInterval(iv);
                                try { ctx.close(); } catch (_) {}
                            }
                        };
                    } catch (_) {}
                });
            }
            if (!callerRingAudio) callerRingAudio = a;
        } catch (e) {
            console.warn("caller ring", e);
        }
    }

    function stopCallerRingtone() {
        try {
            if (!callerRingAudio) return;
            if (typeof callerRingAudio.pause === "function") {
                callerRingAudio.pause();
                try { callerRingAudio.currentTime = 0; } catch (_) {}
            }
            if (typeof callerRingAudio.stop === "function") {
                callerRingAudio.stop();
            }
        } catch (_) {}
        callerRingAudio = null;
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
        startCallerRingtone();


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
            data.callerId || urlCallerId;


        remoteUserId =
            data.callerId || urlCallerId;


        callType =
            data.type === "video"
                ? "video"
                : "audio";


        await loadRemoteUser(
            remoteUserId
        );

        listenForOffer();
        listenForICE();
        listenCallState();

        // Banner already tapped Accept once — but getUserMedia needs a gesture
        // on many mobile browsers after navigation. Show one-tap Join (gesture).
        const alreadyAccepted =
            !!autoAccept ||
            data.status === "accepted" ||
            data.status === "connected";

        if (alreadyAccepted) {
            log("📲 Show Join (gesture required for mic/camera).");
            showJoinCallScreen();
            return;
        }

        showIncoming();

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
                await handleOffer(offer);
            } else {
                // Offer may arrive late — listener already active from prepareIncoming
                log("Waiting for offer…");
            }

            // Ensure we listen to caller's ICE with correct remoteUserId
            iceListening = false;
            listenForICE();

            log("✅ Call accepted.");

        } catch (error) {

            accepted = false;

            logError("Accept error:", error);

            const msg = String(
                (error && error.message) || error || ""
            );
            const denied =
                (error && error.name === "NotAllowedError") ||
                (error && error.code === "PERMISSION_DENIED") ||
                /permission|denied|NotAllowed/i.test(msg);

            if (denied) {
                toast("Allow mic/camera, then tap Join Call");
                showPermissionRetry();
                return;
            }

            toast("Could not accept call.");
            showEnded(msg || "Could not accept call.");
        }

    }

    function showJoinCallScreen() {
        try {
            if (incomingScreen) incomingScreen.classList.add("hidden");
            if (callApp) callApp.classList.add("hidden");
            if (endedScreen) endedScreen.classList.add("hidden");
        } catch (_) {}

        let box = document.getElementById("joinCallScreen");
        if (box) {
            box.style.display = "flex";
            return;
        }

        box = document.createElement("div");
        box.id = "joinCallScreen";
        box.style.cssText =
            "position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:#0a0b10;padding:24px;";
        const isVideo = callType === "video";
        box.innerHTML =
            '<div style="max-width:340px;width:100%;text-align:center;background:rgba(24,26,36,.96);border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:28px 20px;">' +
            '<div style="width:72px;height:72px;margin:0 auto 16px;border-radius:50%;background:linear-gradient(135deg,#7c5cff,#a855f7);display:grid;place-items:center;color:#fff;font-size:28px;">' +
            (isVideo ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-phone"></i>') +
            "</div>" +
            '<h2 style="margin:0 0 8px;font-size:20px;color:#fff">Incoming ' +
            (isVideo ? "Video" : "Voice") +
            " Call</h2>" +
            '<p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#9aa0b0">Tap Join to connect. Your browser will ask for microphone' +
            (isVideo ? " and camera" : "") +
            " permission.</p>" +
            '<button type="button" id="joinCallBtn" style="width:100%;height:50px;border:0;border-radius:14px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:800;font-size:16px;cursor:pointer;margin-bottom:10px;"><i class="fa-solid fa-phone"></i> Join Call</button>' +
            '<button type="button" id="joinDeclineBtn" style="width:100%;height:42px;border:0;border-radius:12px;background:rgba(255,59,92,.15);color:#ff6b81;font-weight:700;cursor:pointer;">Decline</button>' +
            "</div>";
        document.body.appendChild(box);

        document.getElementById("joinCallBtn").onclick = async function () {
            try { box.remove(); } catch (_) {}
            // User gesture → getUserMedia allowed
            await acceptCall();
        };
        document.getElementById("joinDeclineBtn").onclick = async function () {
            try { box.remove(); } catch (_) {}
            try {
                if (typeof rejectCall === "function") await rejectCall();
                else if (window.history.length > 1) history.back();
                else location.href = "messages.html";
            } catch (_) {
                location.href = "messages.html";
            }
        };
    }

        function showPermissionRetry() {
        try {
            if (incomingScreen) incomingScreen.classList.add("hidden");
            if (callApp) callApp.classList.add("hidden");
        } catch (_) {}

        let box = document.getElementById("permissionRetryScreen");
        if (!box) {
            box = document.createElement("div");
            box.id = "permissionRetryScreen";
            box.style.cssText =
                "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0a0b10;padding:24px;";
            box.innerHTML =
                '<div style="max-width:340px;width:100%;text-align:center;background:rgba(24,26,36,.96);border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:28px 20px;">' +
                '<div style="width:64px;height:64px;margin:0 auto 14px;border-radius:50%;background:rgba(255,59,92,.12);display:grid;place-items:center;color:#ff3b5c;font-size:26px;"><i class="fa-solid fa-microphone-slash"></i></div>' +
                "<h2 style=\"margin:0 0 8px;font-size:20px;color:#fff\">Microphone needed</h2>" +
                '<p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#9aa0b0">Browser blocked mic/camera. Tap the lock icon in the address bar → allow Microphone (and Camera), then Join.</p>' +
                '<button type="button" id="permJoinBtn" style="width:100%;height:48px;border:0;border-radius:14px;background:linear-gradient(135deg,#7c5cff,#a855f7);color:#fff;font-weight:800;font-size:15px;cursor:pointer;margin-bottom:10px;">Join Call</button>' +
                '<button type="button" id="permBackBtn" style="width:100%;height:42px;border:0;border-radius:12px;background:rgba(255,255,255,.06);color:#ccc;font-weight:600;cursor:pointer;">Back</button>' +
                "</div>";
            document.body.appendChild(box);
            document.getElementById("permJoinBtn").onclick = async function () {
                try {
                    box.remove();
                } catch (_) {}
                await acceptCall();
            };
            document.getElementById("permBackBtn").onclick = function () {
                try {
                    box.remove();
                } catch (_) {}
                try {
                    if (window.history.length > 1) history.back();
                    else location.href = "messages.html";
                } catch (_) {
                    location.href = "messages.html";
                }
            };
        } else {
            box.style.display = "flex";
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

        try { stopCallerRingtone(); } catch (_) {}
        try { clearRingTimeout(); } catch (_) {}

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

                {
                    const backUid = receiverId || remoteUserId || params.get("uid") || "";
                    if (backUid) {
                        window.location.href = "chat.html?uid=" + encodeURIComponent(backUid);
                    } else {
                        window.history.back();
                    }
                }

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

    window.VieworaCall = Object.assign(window.VieworaCall || {}, {

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
                ) +
                "&uid=" +
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

    });


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
            const page = (location.pathname.split("/").pop() || "").toLowerCase();
            const onCallPage = page.indexOf("call") !== -1;

            if (!onCallPage) {
                log("☎️ Viewora Call API ready (embedded).");
                return;
            }

            // Retry firebase bind up to 3s
            for (let i = 0; i < 6; i++) {
                auth = resolveAuth() || auth;
                db = resolveDb() || db;
                if (auth && db) break;
                await new Promise((r) => setTimeout(r, 500));
            }
            if (!auth || !db) {
                showEnded("Firebase not ready. Refresh and try again.");
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
            setTimeout(() => {
                try { history.back(); } catch (_) {}
            }, 1800);

        } catch (error) {
            logError("Call initialization:", error);
            const msg = (error && error.message) ? error.message : "Unable to initialize call.";
            showEnded(msg);
            toast(msg);
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