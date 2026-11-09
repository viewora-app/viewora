
/* VIEWORA_CALL_UI_BOOT — never blank on any device */
(function () {
  function showStage() {
    try {
      document.body.classList.add("call-page");
      var app = document.getElementById("callApp") || document.getElementById("callPage");
      if (app) { app.style.display = "block"; app.style.visibility = "visible"; app.style.opacity = "1"; }
      var err = document.getElementById("callErrorScreen");
      if (err && !err.dataset.force) err.classList.add("hidden");
      var stage = document.querySelector(".call-stage, .callStage, #callStage");
      if (stage) { stage.style.display = "block"; stage.style.minHeight = "100vh"; }
      var controls = document.querySelector(".call-controls");
      if (controls) { controls.style.display = "flex"; controls.style.visibility = "visible"; }
    } catch (e) {}
  }
  showStage();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showStage);
  setTimeout(showStage, 50);
  setTimeout(showStage, 400);
  setTimeout(showStage, 1200);
})();
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

    /* STUN + TURN. Production: set window.VieworaTurnConfig = { urls, username, credential }
       or localStorage viewora_turn_config JSON before call starts. */
    function buildRtcConfig() {
        var servers = [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun.cloudflare.com:3478"
                ]
            }
        ];
        var custom = null;
        try {
            if (window.VieworaTurnConfig && window.VieworaTurnConfig.urls) {
                custom = window.VieworaTurnConfig;
            } else {
                var raw = localStorage.getItem("viewora_turn_config");
                if (raw) custom = JSON.parse(raw);
            }
        } catch (_) {}
        if (custom && custom.urls) {
            servers.push({
                urls: Array.isArray(custom.urls) ? custom.urls : [custom.urls],
                username: custom.username || "",
                credential: custom.credential || custom.credentialPassword || ""
            });
        } else {
            // Public openrelay (dev/fallback — rate limited)
            servers.push({
                urls: [
                    "turn:openrelay.metered.ca:80",
                    "turn:openrelay.metered.ca:443",
                    "turns:openrelay.metered.ca:443"
                ],
                username: "openrelayproject",
                credential: "openrelayproject"
            });
        }
        return {
            iceServers: servers,
            iceCandidatePoolSize: 16,
            iceTransportPolicy: "all",
            bundlePolicy: "max-bundle"
        };
    }
    var RTC_CONFIG = buildRtcConfig();


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
    const MAX_CALL_PARTICIPANTS = 6; // group call limit (mesh / room)
    window.VieworaCall = window.VieworaCall || {};
    window.VieworaCall.MAX_PARTICIPANTS = MAX_CALL_PARTICIPANTS;


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

    const MAX_ICE_RESTARTS = 4;
    const CALL_PURGE_MS = 45000; // delete signaling after end


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

    
    
/* Viewora real sound hooks */
function __vsPlay(name, loop) {
  try {
    if (!window.VieworaSounds) return false;
    if (loop) VieworaSounds.loop(name); else VieworaSounds.play(name);
    return true;
  } catch (_) { return false; }
}
function __vsStop() {
  try { if (window.VieworaSounds) VieworaSounds.stopAll(); } catch (_) {}
}

async function peerIsOnline(uid) {
        // My network must be up; otherwise always "Calling..."
        try {
            if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
        } catch (_) {}
        if (!uid || !db) return false;
        try {
            const snap = await db.ref("users/" + uid).once("value");
            const u = snap.val() || {};
            var on = !!(u.online || u.isOnline || (u.presence && u.presence === "online"));
            if (!on && u.presence && typeof u.presence === "object") {
                on = !!(u.presence.online || u.presence.state === "online");
            }
            // Stale presence: lastSeen older than 2 min → offline
            if (on && u.lastSeen) {
                var ls = Number(u.lastSeen);
                if (ls < 1e12) ls = ls * 1000;
                if (Date.now() - ls > 120000) on = false;
            }
            return on;
        } catch (_) {}
        return false;
    }

    
    var __toneAudio = null;
    function stopTonePattern() {
        try {
            if (__toneAudio && typeof __toneAudio.stop === "function") __toneAudio.stop();
        } catch (_) {}
        __toneAudio = null;
        try { if (window.VieworaSounds) window.VieworaSounds.stopAll(); } catch (_) {}
        try { stopCallerRingtone(); } catch (_) {}
    }
    function startTonePattern(kind) {
        try {
            if (window.VieworaSounds) {
                try { window.VieworaSounds.stopAll(); } catch (_) {}
                if (kind === "ringing") {
                    window.VieworaSounds.loop("ringing", { volume: 0.75 });
                    __toneAudio = { stop: function () { try { window.VieworaSounds.stop("ringing"); window.VieworaSounds.stop("incoming"); } catch (_) {} } };
                    return;
                }
                if (kind === "calling") {
                    window.VieworaSounds.loop("calling", { volume: 0.7 });
                    __toneAudio = { stop: function () { try { window.VieworaSounds.stop("calling"); window.VieworaSounds.stop("outgoing_call"); } catch (_) {} } };
                    return;
                }
                if (kind === "reconnect") {
                    window.VieworaSounds.loop("on_hold", { volume: 0.4 });
                    __toneAudio = { stop: function () { try { window.VieworaSounds.stop("on_hold"); window.VieworaSounds.stop("reconnect"); } catch (_) {} } };
                    return;
                }
            }
        } catch (e) { console.warn("tone file", e); }
        // Synth fallback
        try {
            stopTonePattern();
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            var ctx = new Ctx();
            var gain = ctx.createGain();
            gain.connect(ctx.destination);
            gain.gain.value = 0.08;
            var dead = false;
            var timers = [];
            function beep(freq, dur) {
                if (dead) return;
                try {
                    var o = ctx.createOscillator();
                    o.type = kind === "ringing" ? "sine" : (kind === "reconnect" ? "triangle" : "square");
                    o.frequency.value = freq;
                    o.connect(gain);
                    var t0 = ctx.currentTime;
                    o.start(t0);
                    o.stop(t0 + dur);
                } catch (_) {}
            }
            function loop() {
                if (dead) return;
                if (kind === "ringing") {
                    beep(440, 0.2);
                    timers.push(setTimeout(function () { beep(480, 0.2); }, 220));
                    timers.push(setTimeout(loop, 1800));
                } else if (kind === "reconnect") {
                    beep(360, 0.15);
                    timers.push(setTimeout(loop, 900));
                } else {
                    beep(420, 0.4);
                    timers.push(setTimeout(loop, 2000));
                }
            }
            loop();
            __toneAudio = {
                stop: function () {
                    dead = true;
                    timers.forEach(function (id) { try { clearTimeout(id); } catch (_) {} });
                    try { ctx.close(); } catch (_) {}
                }
            };
        } catch (e2) {
            console.warn("tone synth", e2);
        }
    }

async function setOutboundStatus(peerUid) {
        try {
            var myNet = true;
            try { myNet = navigator.onLine !== false; } catch (_) {}
            if (!myNet) {
                setStatus("Calling...");
                setConnecting(true, "Calling...");
                try { startTonePattern("calling"); } catch (_) {}
                return;
            }
            const on = await peerIsOnline(peerUid);
            setStatus(on ? "Ringing..." : "Calling...");
            setConnecting(true, on ? "Ringing..." : "Calling...");
            try { startTonePattern(on ? "ringing" : "calling"); } catch (_) {}
        } catch (_) {
            setStatus("Calling...");
            try { startTonePattern("calling"); } catch (_) {}
        }
    }

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

        try {
            attachCallOnDisconnect();
        } catch (_) {}

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

        if (!window.isSecureContext) {
            const e = new Error(
                "Calls need HTTPS. Open https://viewora-app.github.io (not http)."
            );
            e.name = "NotAllowedError";
            e.code = "PERMISSION_DENIED";
            throw e;
        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {
            throw new Error("Camera/microphone unavailable on this browser.");
        }

        // Chrome: if already permanently blocked, surface that clearly
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const mic = await navigator.permissions.query({ name: "microphone" });
                if (mic && mic.state === "denied") {
                    const e = new Error(
                        "Chrome blocked microphone for this site. Reset permission then Join."
                    );
                    e.name = "NotAllowedError";
                    e.code = "PERMISSION_DENIED";
                    e.permanent = true;
                    throw e;
                }
            }
        } catch (permErr) {
            if (permErr && permErr.permanent) throw permErr;
            // permissions.query unsupported or camera name fails — ignore
        }

        // Soft constraints — VIDEO first when video call (was audio-first → never got camera)
        const wantVideo = callType === "video";
        const attempts = [];

        if (wantVideo) {
            attempts.push({
                audio: true,
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
            });
            attempts.push({ audio: true, video: { facingMode: "user" } });
            attempts.push({ audio: true, video: true });
            attempts.push({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: { facingMode: { ideal: "user" } }
            });
        }
        // Audio fallbacks
        attempts.push({ audio: true, video: false });
        attempts.push({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

        let lastErr = null;

        for (let i = 0; i < attempts.length; i++) {
            try {
                localStream = await navigator.mediaDevices.getUserMedia(
                    attempts[i]
                );
                // If we need video but this attempt gave audio-only, keep trying
                if (wantVideo && !localStream.getVideoTracks().length) {
                    try {
                        localStream.getTracks().forEach(function (t) { t.stop(); });
                    } catch (_) {}
                    localStream = null;
                    lastErr = new Error("No video track");
                    continue;
                }
                lastErr = null;
                break;
            } catch (err) {
                lastErr = err;
                logError("getUserMedia attempt " + i + ":", err);
            }
        }

        if (localStream && wantVideo && !localStream.getVideoTracks().length) {
            callType = "audio";
            try { toast("Camera unavailable — continuing as voice call."); } catch (_) {}
        }
        if (!localStream) /* VIEWORA_VIDEO_FALLBACK_AUDIO_V2 */ {
            // Last chance: pure audio only
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                callType = "audio";
                try { toast("Camera unavailable — voice only."); } catch (_) {}
            } catch (audioOnlyErr) {
                lastErr = audioOnlyErr || lastErr;
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
                const e = new Error(
                    "Permission denied. Allow microphone (and camera) for this site, then tap Join again."
                );
                e.name = "NotAllowedError";
                e.code = "PERMISSION_DENIED";
                throw e;
            }

            // Never show "No video track" as fatal
            const msg = String((lastErr && lastErr.message) || "");
            if (/no video track/i.test(msg)) {
                const e = new Error("Camera not ready. Allow camera or continue with voice.");
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


        // Rebuild in case TURN config was set after page load
        try {
            RTC_CONFIG = buildRtcConfig();
        } catch (_) {}

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
            try { setConnecting(false); } catch (_) {}
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
                    try { stopTonePattern(); } catch (_) {}
                    try { if (window.VieworaSounds) window.VieworaSounds.play("connect_group_call"); } catch (_) {}
                    try { setupPipDragAndSwap(); setupCallMinimize(); listenCallTypeUpgrade(); listenRemoteMediaFlags(); } catch (_) {}
                    try { if (window.__vieworaArmCallBackGuard) window.__vieworaArmCallBackGuard(); } catch (_) {}
                    try {
                        if (db && currentUser) {
                            db.ref("users/" + currentUser.uid + "/callStatus").set({
                                busy: true,
                                callId: callId,
                                at: Date.now()
                            });
                        }
                        sessionStorage.setItem("viewora_call_busy", "1");
                    } catch (_) {}
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
                    setStatus("Reconnecting..."); try { startTonePattern("reconnect"); } catch (_) {}
                    setTimeout(() => {
                        tryRestartIce("disconnected");
                    }, 2500);
                }

                if (state === "failed") {
                    setConnecting(true, "Reconnecting...");
                    setStatus("Reconnecting..."); try { startTonePattern("reconnect"); } catch (_) {}
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

        var hasVideo = false;
        try {
            hasVideo = remoteStream.getVideoTracks().some(function (t) {
                return t && t.readyState !== "ended";
            });
        } catch (_) {}

        // Always attach video element if stream has video (fixes purple blank screen)
        if (remoteVideo) {
            try {
                remoteVideo.srcObject = remoteStream;
                remoteVideo.playsInline = true;
                remoteVideo.muted = false;
                remoteVideo.setAttribute("playsinline", "");
                remoteVideo.setAttribute("webkit-playsinline", "");
                var p = remoteVideo.play();
                if (p && p.catch) p.catch(function () {});
            } catch (e) {
                console.warn("remoteVideo attach", e);
            }
            if (hasVideo || callType === "video") {
                if (remotePlaceholder) remotePlaceholder.classList.add("hidden");
                try {
                    remoteVideo.style.display = "block";
                    remoteVideo.style.opacity = "1";
                } catch (_) {}
            }
        }

        if (remoteAudio) {
            try {
                remoteAudio.srcObject = remoteStream;
                remoteAudio.muted = false;
                var pa = remoteAudio.play();
                if (pa && pa.catch) pa.catch(function () {});
            } catch (_) {}
        }

        // Camera-off remote: show peer DP if no video track
        try {
            var off = document.getElementById("remoteCameraOff");
            if (!off && remoteVideo && remoteVideo.parentElement) {
                off = document.createElement("div");
                off.id = "remoteCameraOff";
                off.className = "remote-camera-off";
                off.innerHTML = '<img id="remoteCameraOffImg" alt=""/><span>Camera off</span>';
                remoteVideo.parentElement.appendChild(off);
            }
            if (off) {
                off.classList.toggle("show", !hasVideo && callType === "video");
                var img = document.getElementById("remoteCameraOffImg");
                if (img && !hasVideo) {
                    img.src =
                        (window.__vieworaRemotePhoto) ||
                        "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs><circle cx="64" cy="64" r="64" fill="url(#g)"/><circle cx="64" cy="48" r="24" fill="rgba(255,255,255,.92)"/><ellipse cx="64" cy="106" rx="40" ry="28" fill="rgba(255,255,255,.92)"/></svg>');
                }
            }
        } catch (_) {}
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

        if (!accepted) {
            return;
        }

        if (!offer) {
            return;
        }

        // First offer once; later offers for iceRestart OR video upgrade renegotiation
        var isRestart = !!(offer.iceRestart);
        var isRenego = !!(offer.renegotiate || offer.videoUpgrade);
        if (offerHandled && !isRestart && !isRenego) {
            // still allow if SDP is a new offer while we are stable (perfect negotiation)
            try {
                if (!(peerConnection && peerConnection.signalingState === "stable" && offer.type === "offer")) {
                    return;
                }
                isRenego = true;
            } catch (_) {
                return;
            }
        }

        offerHandled = true;

        try {

            const peer =
                peerConnection || createPeerConnection();

            // ICE restart: may already have remote description
            if (peer.signalingState === "stable" && peer.currentRemoteDescription && isRestart) {
                // Perfect negotiation: set remote offer while stable needs careful handling
                await peer.setRemoteDescription(
                    new RTCSessionDescription({ type: offer.type, sdp: offer.sdp })
                );
            } else if (!peer.currentRemoteDescription) {
                await peer.setRemoteDescription(
                    new RTCSessionDescription({ type: offer.type, sdp: offer.sdp })
                );
            } else if (offer.iceRestart) {
                await peer.setRemoteDescription(
                    new RTCSessionDescription({ type: offer.type, sdp: offer.sdp })
                );
            } else {
                return;
            }

            remoteDescriptionSet = true;
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
                        peer.localDescription.sdp,

                    iceRestart: !!offer.iceRestart,
                    at: Date.now()

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
                        !peerConnection
                    ) {
                        return;
                    }

                    // Skip duplicate unless ICE restart answer
                    if (answerHandled && !answer.iceRestart) {
                        return;
                    }
                    if (
                        peerConnection.currentRemoteDescription &&
                        !answer.iceRestart
                    ) {
                        return;
                    }

                    try {
                        answerHandled = true;
                        await peerConnection.setRemoteDescription(
                            new RTCSessionDescription({
                                type: answer.type,
                                sdp: answer.sdp
                            })
                        );
                        remoteDescriptionSet = true;
                        await flushPendingICE();
                        log("📥 Answer received.", answer.iceRestart ? "(ICE restart)" : "");
                    } catch (error) {
                        answerHandled = false;
                        logError("Answer error:", error);
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
            if (window.VieworaSounds) {
                window.VieworaSounds.loop("calling", { volume: 0.7 });
                callerRingAudio = {
                    pause: function () { try { window.VieworaSounds.stop("calling"); } catch (_) {} },
                    stop: function () { try { window.VieworaSounds.stop("calling"); } catch (_) {} }
                };
                return;
            }
        } catch (_) {}

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


        try {
            await setOutboundStatus(receiverId);
        } catch (_) {
            setStatus("Calling...");
            setConnecting(true, "Calling...");
        }

        startRingTimeout();
        requestWakeLock();
        startCallerRingtone();


        /*
         * Media
         */

        await getLocalMedia();
        try { setupPipDragAndSwap(); setupCallMinimize(); listenCallTypeUpgrade(); listenRemoteMediaFlags(); } catch (_) {}


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


        // Allow if receiver, caller, participant, or invited
        try {
            var uid = currentUser.uid;
            var allowed = false;
            if (!data.receiverId || data.receiverId === uid) allowed = true;
            if (data.callerId === uid) allowed = true;
            if (data.participants && data.participants[uid]) allowed = true;
            if (data.invited && data.invited[uid]) allowed = true;
            if (data.members && data.members[uid]) allowed = true;
            if (!allowed) {
                showEnded("This call is not for you.");
                return;
            }
        } catch (_) {
            if (data.receiverId && data.receiverId !== currentUser.uid) {
                showEnded("This call is not for you.");
                return;
            }
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
            log("📲 Auto-accept requested — on mobile show Join for gesture.");
            // Mobile browsers lose user-gesture after navigation → getUserMedia fails.
            // Always show a one-tap Join screen so permission + media works reliably.
            try {
                var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
                if (isMobile || !navigator.mediaDevices) {
                    try { showJoinCallScreen(); } catch (_) { showIncoming(); }
                    return;
                }
                await acceptCall();
            } catch (e) {
                logError("auto accept:", e);
                try { showJoinCallScreen(); } catch (_) { showIncoming(); }
            }
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

            if (/no video track/i.test(msg)) {
                toast("Camera not ready — try Join as voice or allow camera");
                try { showPermissionRetry(); } catch (_) { showJoinCallScreen && showJoinCallScreen(); }
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
            const ended = document.getElementById("callEndedScreen");
            if (ended) ended.classList.add("hidden");
        } catch (_) {}

        let box = document.getElementById("permissionRetryScreen");
        if (box) {
            try { box.remove(); } catch (_) {}
        }

        box = document.createElement("div");
        box.id = "permissionRetryScreen";
        box.style.cssText =
            "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0a0b10;padding:20px;";
        box.innerHTML =
            '<div style="max-width:360px;width:100%;text-align:left;background:rgba(24,26,36,.98);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:24px 18px;">' +
            '<div style="text-align:center;margin-bottom:14px;">' +
            '<div style="width:64px;height:64px;margin:0 auto 12px;border-radius:50%;background:rgba(255,59,92,.12);display:grid;place-items:center;color:#ff3b5c;font-size:26px;"><i class="fa-solid fa-microphone-slash"></i></div>' +
            '<h2 style="margin:0 0 6px;font-size:19px;color:#fff;text-align:center">Microphone blocked</h2>' +
            '<p style="margin:0;font-size:12px;color:#9aa0b0;text-align:center;line-height:1.45">Chrome ne Viewora ke liye mic band kar diya. Pehle Allow karo, phir Join.</p>' +
            "</div>" +
            '<ol style="margin:0 0 16px;padding-left:18px;color:#c9cdd8;font-size:12px;line-height:1.65;">' +
            "<li><strong style=\"color:#fff\">Address bar</strong> me 🔒 / ⓘ icon dabao</li>" +
            "<li><strong style=\"color:#fff\">Permissions</strong> / Site settings kholo</li>" +
            "<li><strong style=\"color:#fff\">Microphone</strong> → <span style=\"color:#22c55e\">Allow</span></li>" +
            "<li>Video call ho to <strong style=\"color:#fff\">Camera</strong> bhi Allow</li>" +
            "<li>Page <strong style=\"color:#fff\">Reload</strong> karo, phir neeche Join dabao</li>" +
            "</ol>" +
            '<p style="margin:0 0 14px;font-size:11px;color:#7a8090;line-height:1.4;text-align:center">Android Chrome: ⋮ → Settings → Site settings → Microphone → viewora-app.github.io → Allow</p>' +
            '<button type="button" id="permJoinBtn" style="width:100%;height:48px;border:0;border-radius:14px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:800;font-size:15px;cursor:pointer;margin-bottom:8px;"><i class="fa-solid fa-phone"></i> Try Join again</button>' +
            '<button type="button" id="permReloadBtn" style="width:100%;height:42px;border:0;border-radius:12px;background:rgba(124,92,255,.2);color:#c4b5fd;font-weight:700;cursor:pointer;margin-bottom:8px;">Reload page</button>' +
            '<button type="button" id="permBackBtn" style="width:100%;height:40px;border:0;border-radius:12px;background:transparent;color:#888;font-weight:600;cursor:pointer;">Back</button>' +
            "</div>";
        document.body.appendChild(box);

        document.getElementById("permJoinBtn").onclick = async function () {
            const btn = document.getElementById("permJoinBtn");
            if (btn) {
                btn.disabled = true;
                btn.textContent = "Requesting mic…";
            }
            try {
                // Direct request under user gesture (Chrome requires this)
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                });
                if (stream) {
                    try {
                        stream.getTracks().forEach(function (tr) { tr.stop(); });
                    } catch (_) {}
                }
                try { box.remove(); } catch (_) {}
                accepted = false;
                await acceptCall();
            } catch (err) {
                console.warn("[Viewora] mic retry failed", err);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-phone"></i> Try Join again';
                }
                try {
                    toast("Still blocked — Allow mic in Chrome site settings, then Reload.");
                } catch (_) {
                    alert("Still blocked. Chrome → Site settings → Microphone → Allow for viewora-app.github.io, then reload.");
                }
            }
        };
        document.getElementById("permReloadBtn").onclick = function () {
            location.reload();
        };
        document.getElementById("permBackBtn").onclick = function () {
            try { box.remove(); } catch (_) {}
            try {
                if (window.history.length > 1) history.back();
                else location.href = "messages.html";
            } catch (_) {
                location.href = "messages.html";
            }
        };
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

    
    async function logCallToChat(opts) {
        opts = opts || {};
        try {
            if (!db || !currentUser) return;
            var peer = remoteUserId || receiverId || callerId;
            if (!peer || peer === currentUser.uid) return;
            var uids = [currentUser.uid, peer].sort();
            var chatId = uids.join("_");
            var durationSec = 0;
            try {
                if (typeof callSeconds === "number") durationSec = callSeconds;
                else if (window.__vieworaCallSeconds) durationSec = window.__vieworaCallSeconds;
            } catch (_) {}
            var typeLabel = (callType === "video") ? "Video call" : "Voice call";
            var missed = !!opts.missed;
            var text = missed
                ? ("Missed " + (callType === "video" ? "video" : "voice") + " call")
                : (typeLabel + (durationSec > 0 ? (" · " + formatCallDuration(durationSec)) : ""));
            var payload = {
                type: "call",
                callType: callType || "voice",
                missed: missed,
                duration: durationSec,
                text: text,
                senderId: currentUser.uid,
                receiverId: peer,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            await db.ref("chats/" + chatId + "/messages").push(payload);
            var preview = text;
            var inbox = {
                lastMessage: preview,
                lastMessageType: "call",
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                chatId: chatId
            };
            await db.ref("userChats/" + currentUser.uid + "/" + chatId).update(inbox);
            await db.ref("userChats/" + peer + "/" + chatId).update(inbox);
        } catch (e) {
            console.warn("logCallToChat", e);
        }
    }
    function formatCallDuration(sec) {
        sec = Math.max(0, Math.floor(Number(sec) || 0));
        if (sec < 60) return sec + " secs";
        var m = Math.floor(sec / 60);
        if (m < 60) return m + (m === 1 ? " min" : " mins");
        var h = Math.floor(m / 60);
        return h + " hr " + (m % 60) + " min";
    }

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
        scheduleCallPurge();
        try { await logCallToChat({ missed: false }); } catch (_) {}
        showEnded("Call ended.");

    }

    function clearBusyFlag() {
        try {
            sessionStorage.removeItem("viewora_call_busy");
            if (db && currentUser) {
                db.ref("users/" + currentUser.uid + "/callStatus").remove();
            }
        } catch (_) {}
    }

    function scheduleCallPurge() {
        clearBusyFlag();

        if (!callId || !db) return;
        var id = callId;
        var rid = receiverId || remoteUserId;
        var cid = callerId || (currentUser && currentUser.uid);
        // Cancel onDisconnect so clean hangup doesn't get overwritten
        try {
            if (callRef) {
                callRef.onDisconnect().cancel();
                callRef.child("presence/" + (currentUser && currentUser.uid)).onDisconnect().cancel();
            }
        } catch (_) {}
        try {
            if (callRef) {
                callRef.child("candidates").remove().catch(function () {});
                callRef.child("offer").remove().catch(function () {});
                callRef.child("answer").remove().catch(function () {});
            }
        } catch (_) {}
        try {
            if (rid) db.ref("incomingCalls/" + rid + "/" + id).remove().catch(function () {});
            if (cid) db.ref("incomingCalls/" + cid + "/" + id).remove().catch(function () {});
            if (currentUser) db.ref("incomingCalls/" + currentUser.uid + "/" + id).remove().catch(function () {});
        } catch (_) {}
        setTimeout(function () {
            try {
                db.ref("calls/" + id).remove().catch(function () {});
            } catch (_) {}
        }, typeof CALL_PURGE_MS === "number" ? CALL_PURGE_MS : 45000);
    }

    function attachCallOnDisconnect() {
        if (!callRef || !currentUser) return;
        try {
            callRef.child("presence/" + currentUser.uid).onDisconnect().set({
                online: false,
                at: firebase.database.ServerValue.TIMESTAMP
            });
            callRef.onDisconnect().update({
                status: "ended",
                endedBy: currentUser.uid,
                endedReason: "disconnect",
                endedAt: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (e) {
            logError("onDisconnect:", e);
        }
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
        setStatus("Reconnecting… (" + iceRestartAttempts + "/" + MAX_ICE_RESTARTS + ")");

        try {
            // Drop stale remote candidates so fresh ICE can form
            try {
                if (callRef && currentUser) {
                    await callRef.child("candidates/" + currentUser.uid).remove();
                }
            } catch (_) {}
            pendingIceCandidates = [];

            if (role === "caller") {
                if (typeof peerConnection.restartIce === "function") {
                    peerConnection.restartIce();
                }
                const offer = await peerConnection.createOffer({
                    iceRestart: true,
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: callType === "video"
                });
                await peerConnection.setLocalDescription(offer);
                answerHandled = false; // allow new answer
                await callRef.child("offer").set({
                    type: offer.type,
                    sdp: offer.sdp,
                    iceRestart: true,
                    at: Date.now()
                });
                await updateCall({
                    iceRestartAt: firebase.database.ServerValue.TIMESTAMP,
                    iceRestartAttempt: iceRestartAttempts
                });
                return true;
            }
            // Receiver: handleOffer will process new offer with iceRestart flag
            return iceRestartAttempts < MAX_ICE_RESTARTS;
        } catch (err) {
            logError("ICE restart failed:", err);
            return false;
        }
    }

    // Network came back — try ICE restart
    try {
        window.addEventListener("online", function () {
            if (callEnded || !peerConnection) return;
            var st = peerConnection.iceConnectionState;
            if (st === "disconnected" || st === "failed" || st === "checking") {
                tryRestartIce("online");
            }
        });
    } catch (_) {}



    /* ======================================================
       SPEAKER (earpiece ↔ loudspeaker)
    ====================================================== */

    async function toggleSpeaker() {
        speakerOn = !speakerOn;

        const btn = $("speakerBtn");
        const btn2 = $("callSpeakerBtn");
        [btn, btn2].forEach(function (b) {
            if (!b) return;
            b.classList.toggle("active", speakerOn);
            const icon = b.querySelector("i");
            if (icon) {
                // ON = loud speaker icon, OFF = quieter/earpiece icon
                icon.className = speakerOn
                    ? "fa-solid fa-volume-high"
                    : "fa-solid fa-volume-low";
            }
        });

        const targets = [remoteAudio, remoteVideo].filter(Boolean);
        for (const el of targets) {
            try {
                el.muted = false;
                // Speaker ON → full volume + loud output
                // Speaker OFF → still audible (don't silence) but prefer earpiece if available
                el.volume = speakerOn ? 1.0 : 0.85;
                if (typeof el.setSinkId === "function") {
                    try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const outs = devices.filter(function (d) { return d.kind === "audiooutput"; });
                        if (speakerOn) {
                            var loud = outs.find(function (d) {
                                return /speaker|loud|external|wired/i.test(d.label || "");
                            }) || outs.find(function (d) {
                                return !/earpiece|phone|receiver/i.test(d.label || "");
                            }) || outs[0];
                            if (loud && loud.deviceId) await el.setSinkId(loud.deviceId);
                            else await el.setSinkId("default");
                        } else {
                            var ear = outs.find(function (d) {
                                return /earpiece|phone|receiver|headset/i.test(d.label || "");
                            });
                            if (ear && ear.deviceId) await el.setSinkId(ear.deviceId);
                            // else leave current sink — never blank id
                        }
                    } catch (e) {
                        try { await el.setSinkId("default"); } catch (_) {}
                    }
                }
                el.play().catch(function () {});
            } catch (err) {
                log("speaker toggle:", err && err.message);
            }
        }

        toast(speakerOn ? "Speaker on" : "Earpiece");
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
       WEBRTC MESH (4–6 participants)
    ====================================================== */

    function startMeshLayer() {
        if (!window.VieworaMesh || !db || !callId || !currentUser) return;
        if (!localStream) return;
        try {
            if (window.__vieworaArmCallBackGuard) window.__vieworaArmCallBackGuard();
            VieworaMesh.init({
                db: db,
                callId: callId,
                uid: currentUser.uid,
                localStream: localStream,
                callType: callType,
                max: MAX_CALL_PARTICIPANTS,
                onRemoteStream: function (remoteUid, stream) {
                    attachMeshRemote(remoteUid, stream);
                },
                onPeerLeft: function (remoteUid) {
                    removeMeshRemote(remoteUid);
                },
                onParticipants: function (map) {
                    updateParticipantsGrid(map);
                }
            });
            var photo =
                (currentUser.photoURL) ||
                localStorage.getItem("viewora_my_avatar") ||
                "";
            var name =
                currentUser.displayName ||
                localStorage.getItem("viewora_my_name") ||
                "Me";
            VieworaMesh.join({
                name: name,
                photo: photo,
                camera: true
            });
            log("Mesh layer started");
        } catch (e) {
            logError("Mesh init:", e);
        }
    }

    function attachMeshRemote(remoteUid, stream) {
        var grid = $("participantsGrid");
        if (!grid) return;
        grid.hidden = false;
        var id = "meshVideo_" + remoteUid;
        var cell = document.getElementById(id);
        if (!cell) {
            cell = document.createElement("div");
            cell.id = id;
            cell.className = "mesh-cell";
            cell.innerHTML =
                '<video autoplay playsinline></video>' +
                '<div class="mesh-cell-label"></div>';
            grid.appendChild(cell);
        }
        var vid = cell.querySelector("video");
        if (vid && vid.srcObject !== stream) {
            vid.srcObject = stream;
            vid.play().catch(function () {});
        }
        // Hide single remote when multi
        try {
            if (Object.keys(VieworaMesh.getPeers()).length >= 1) {
                if (remoteVideo) remoteVideo.classList.add("mesh-hidden-primary");
            }
        } catch (_) {}
    }

    function removeMeshRemote(remoteUid) {
        var cell = document.getElementById("meshVideo_" + remoteUid);
        if (cell) cell.remove();
        var grid = $("participantsGrid");
        if (grid && !grid.children.length) {
            grid.hidden = true;
            if (remoteVideo) remoteVideo.classList.remove("mesh-hidden-primary");
        }
    }

    function updateParticipantsGrid(map) {
        var grid = $("participantsGrid");
        if (!grid || !map) return;
        var n = Object.keys(map).length;
        if (n <= 2) {
            grid.classList.remove("mesh-3", "mesh-4", "mesh-many");
        } else if (n === 3) {
            grid.classList.add("mesh-3");
            grid.classList.remove("mesh-4", "mesh-many");
        } else if (n === 4) {
            grid.classList.add("mesh-4");
            grid.classList.remove("mesh-3", "mesh-many");
        } else {
            grid.classList.add("mesh-many");
            grid.classList.remove("mesh-3", "mesh-4");
        }
        Object.keys(map).forEach(function (uid) {
            if (currentUser && uid === currentUser.uid) return;
            var cell = document.getElementById("meshVideo_" + uid);
            if (cell) {
                var lab = cell.querySelector(".mesh-cell-label");
                if (lab) lab.textContent = (map[uid] && (map[uid].name || map[uid].username)) || "User";
            }
        });
    }


    /* ======================================================
       SWITCH CAMERA (front / back) — no pause glitch
    ====================================================== */

    let usingFrontCamera = true;



    async function openAddUsersSheet() {
        if (callEnded) return;
        if (!currentUser || !db) {
            toast("Login required");
            return;
        }
        let sheet = $("addUsersSheet");
        if (!sheet) {
            sheet = document.createElement("div");
            sheet.id = "addUsersSheet";
            sheet.className = "add-users-sheet";
            sheet.innerHTML =
                '<div class="add-users-mask" data-close-add></div>' +
                '<div class="add-users-panel">' +
                '<div class="add-users-handle"></div>' +
                '<div class="add-users-head"><strong>Add to call</strong>' +
                '<span class="add-users-limit">Max 6</span></div>' +
                '<p class="add-users-hint">Friends you follow or chat with</p>' +
                '<div id="addUsersList" class="add-users-list"><div class="add-users-loading">Loading…</div></div>' +
                '</div>';
            document.body.appendChild(sheet);
            sheet.querySelector("[data-close-add]")?.addEventListener("click", function () {
                sheet.classList.remove("open");
            });
        }
        sheet.classList.add("open");
        const list = $("addUsersList");
        if (!list) return;
        list.innerHTML = '<div class="add-users-loading">Loading…</div>';

        try {
            const uid = currentUser.uid;
            const [folSnap, chatSnap, partSnap] = await Promise.all([
                db.ref("users/" + uid + "/following").limitToFirst(40).once("value"),
                db.ref("userChats/" + uid).limitToFirst(30).once("value").catch(function () {
                    return db.ref("chats").orderByChild("members/" + uid).equalTo(true).limitToFirst(20).once("value").catch(function () { return { val: function () { return null; } }; });
                }),
                callId ? db.ref("calls/" + callId + "/participants").once("value") : Promise.resolve({ val: function () { return {}; } })
            ]);
            const inCall = Object.keys(partSnap.val() || {});
            if (currentUser) inCall.push(currentUser.uid);
            if (remoteUserId) inCall.push(remoteUserId);

            const ids = new Set();
            // Prefer people you already message (userChats)
            const chats = chatSnap.val() || {};
            Object.keys(chats).forEach(function (k) {
                const c = chats[k] || {};
                if (c.isGroup || c.groupId) return;
                var peer = c.userId || c.uid || c.peerId || c.with || c.otherUid || "";
                if (!peer && k && k.indexOf("_") !== -1) {
                    var parts = k.split("_");
                    peer = parts[0] === uid ? parts[1] : parts[0];
                }
                if (peer && peer !== uid) ids.add(peer);
            });
            // If no chats, fall back to following
            if (ids.size === 0) {
                const fol = folSnap.val() || {};
                Object.keys(fol).forEach(function (k) { if (fol[k]) ids.add(k); });
            }
            ids.delete(uid);

            const arr = Array.from(ids).slice(0, 40);
            if (!arr.length) {
                list.innerHTML = '<div class="add-users-empty">No friends yet — follow or chat first</div>';
                return;
            }

            const rows = await Promise.all(arr.map(async function (id) {
                try {
                    const s = await db.ref("users/" + id).once("value");
                    const u = s.val() || {};
                    return {
                        uid: id,
                        name: u.name || u.fullName || u.displayName || u.username || "User",
                        username: u.username || "",
                        photo: (function(){
                        var p = u.profilePhoto || u.photoURL || u.avatar || u.photo || "";
                        if (p && String(p).indexOf("ui-avatars") === -1 && p.length > 8) return p;
                        return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs><circle cx="64" cy="64" r="64" fill="url(#g)"/><circle cx="64" cy="48" r="24" fill="rgba(255,255,255,.92)"/><ellipse cx="64" cy="106" rx="40" ry="28" fill="rgba(255,255,255,.92)"/></svg>');
                    })(),
                        inCall: inCall.indexOf(id) !== -1
                    };
                } catch (_) {
                    return null;
                }
            }));

            list.innerHTML = rows.filter(Boolean).map(function (u) {
                const disabled = u.inCall || inCall.length >= MAX_CALL_PARTICIPANTS;
                return (
                    '<button type="button" class="add-user-row' + (disabled ? " disabled" : "") + '" data-add-uid="' + u.uid + '"' +
                    (disabled ? " disabled" : "") + ">" +
                    '<img src="' + String(u.photo).replace(/"/g, "") + '" alt="" >' +
                    '<div><strong>' + String(u.name).replace(/</g, "") + '</strong>' +
                    (u.username ? '<small>@' + String(u.username).replace(/</g, "") + '</small>' : '') +
                    '</div>' +
                    (u.inCall ? '<span class="tag">In call</span>' : '<i class="fa-solid fa-phone"></i>') +
                    '</button>'
                );
            }).join("") || '<div class="add-users-empty">No friends found</div>';

            list.querySelectorAll("[data-add-uid]").forEach(function (btn) {
                btn.addEventListener("click", async function () {
                    var id = btn.getAttribute("data-add-uid");
                    if (!id) return;
                    if (inCall.length >= MAX_CALL_PARTICIPANTS) {
                        toast("Max " + MAX_CALL_PARTICIPANTS + " people");
                        return;
                    }
                    btn.disabled = true;
                    await inviteToCall(id);
                    try {
                        var tag = document.createElement("span");
                        tag.className = "tag";
                        tag.textContent = "Invited";
                        var ic = btn.querySelector("i.fa-phone");
                        if (ic) ic.replaceWith(tag);
                        else btn.appendChild(tag);
                    } catch (_) {}
                });
            });

        } catch (e) {
            console.warn(e);
            list.innerHTML = '<div class="add-users-empty">Could not load friends</div>';
        }
    }

    async function inviteToCall(uid) {
        if (!uid) return;
        try {
            const room = callId;
            if (!room || !db) {
                toast("Start a call first, then add people.");
                return;
            }
            const ref = db.ref("calls/" + room + "/participants");
            const snap = await ref.once("value");
            const map = snap.val() || {};
            const count = Object.keys(map).length;
            if (count >= MAX_CALL_PARTICIPANTS) {
                toast("Max " + MAX_CALL_PARTICIPANTS + " people in a call");
                return;
            }
            if (map[uid]) {
                toast("Already in call");
                return;
            }
                        await ref.child(uid).set({
                invitedAt: Date.now(),
                by: currentUser && currentUser.uid,
                status: "invited"
            });
            // Ensure we are listed as participant too
            try {
                await ref.child(currentUser.uid).update({
                    uid: currentUser.uid,
                    joinedAt: Date.now(),
                    name: currentUser.displayName || "User",
                    status: "joined"
                });
            } catch (_) {}
            if (remoteUserId) {
                try {
                    await ref.child(remoteUserId).update({
                        uid: remoteUserId,
                        status: "joined"
                    });
                } catch (_) {}
            }
            // Ring invitee via same incomingCalls path (group flag)
            try {
                var invitePayload = {
                    callId: room,
                    callerId: currentUser.uid,
                    receiverId: uid,
                    type: callType || "video",
                    status: "ringing",
                    group: true,
                    createdAt: Date.now(),
                    createdAtMs: Date.now()
                };
                await db.ref("incomingCalls/" + uid + "/" + room).set(invitePayload);
            } catch (_) {}
            try {
                if (window.VieworaMesh && localStream) {
                    startMeshLayer();
                }
            } catch (_) {}
            try { if (window.VieworaSounds) window.VieworaSounds.play("join_group_call"); } catch (_) {}
            try {
                await db.ref("calls/" + (callId || room) + "/participants/" + uid).set({
                    invited: true,
                    invitedBy: currentUser.uid,
                    at: Date.now()
                });
                await db.ref("calls/" + (callId || room) + "/invited/" + uid).set(true);
            } catch (_) {}
            try { if (window.VieworaSounds) window.VieworaSounds.play("join_group_call"); } catch (_) {}
            toast("Invite sent");
        } catch (e) {
            console.warn(e);
            toast("Could not invite");
        }
    }

    async function switchCamera() {
        if (callType !== "video") {
            toast("Turn on video first, then flip camera.");
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

        async function applyNewTrack(newTrack, leftoverStream) {
            if (!newTrack) throw new Error("No new video track");
            // Replace on 1:1 peer
            if (peerConnection) {
                const sender = peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === "video");
                if (sender) await sender.replaceTrack(newTrack);
            }
            try { localStream.removeTrack(oldTrack); } catch (_) {}
            localStream.addTrack(newTrack);
            try { oldTrack.stop(); } catch (_) {}
            window.localStream = localStream;
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.playsInline = true;
                localVideo.muted = true;
                localVideo.setAttribute("playsinline", "");
                localVideo.style.transform = usingFrontCamera ? "scaleX(-1)" : "none";
                await localVideo.play().catch(() => {});
            }
            if (leftoverStream) {
                leftoverStream.getTracks().forEach(tr => {
                    if (tr.id !== newTrack.id) {
                        try { tr.stop(); } catch (_) {}
                    }
                });
            }
            try {
                if (window.VieworaMesh && newTrack) {
                    VieworaMesh.replaceTrack("video", newTrack);
                }
            } catch (_) {}
            toast(usingFrontCamera ? "Front camera" : "Back camera");
        }

        // Enumerate & cycle to next camera (front ↔ back)
        let devices = [];
        try {
            devices = await navigator.mediaDevices.enumerateDevices();
        } catch (_) {}
        let cams = devices.filter(d => d.kind === "videoinput");
        // If labels empty, need a live track first — already have permission
        if (cams.length < 2) {
            try {
                // trigger label population
                await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                    .then(s => s.getTracks().forEach(tr => tr.stop()));
                devices = await navigator.mediaDevices.enumerateDevices();
                cams = devices.filter(d => d.kind === "videoinput");
            } catch (_) {}
        }

        let newStream = null;
        let newTrack = null;

        if (cams.length >= 2) {
            const currentId = oldTrack.getSettings ? (oldTrack.getSettings().deviceId || "") : "";
            let idxCam = cams.findIndex(d => d.deviceId === currentId);
            if (idxCam < 0) idxCam = 0;
            const next = cams[(idxCam + 1) % cams.length];
            // Infer front/back from label
            const lab = String(next.label || "").toLowerCase();
            usingFrontCamera = !( /back|rear|environment|world/i.test(lab) );
            try {
                newStream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        deviceId: { exact: next.deviceId },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
                newTrack = newStream.getVideoTracks()[0];
                await applyNewTrack(newTrack, newStream);
                return;
            } catch (e1) {
                logError("deviceId switch failed", e1);
                try {
                    newStream = await navigator.mediaDevices.getUserMedia({
                        audio: false,
                        video: { deviceId: next.deviceId }
                    });
                    newTrack = newStream.getVideoTracks()[0];
                    await applyNewTrack(newTrack, newStream);
                    return;
                } catch (e1b) {
                    logError("deviceId soft failed", e1b);
                }
            }
        }

        // Fallback: facingMode ideal
        usingFrontCamera = !usingFrontCamera;
        const facing = usingFrontCamera ? "user" : "environment";
        try {
            newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: facing },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            newTrack = newStream.getVideoTracks()[0];
            await applyNewTrack(newTrack, newStream);
            return;
        } catch (e2) {
            logError("facingMode switch", e2);
        }
        try {
            newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: facing }
            });
            newTrack = newStream.getVideoTracks()[0];
            await applyNewTrack(newTrack, newStream);
            return;
        } catch (e3) {
            logError("facingMode plain", e3);
            usingFrontCamera = !usingFrontCamera; // revert
            toast("Could not switch camera. Check permissions.");
        }
    }



    function setupPipDragAndSwap() {
        var wrap = document.getElementById("localVideoWrap");
        if (!wrap || wrap.dataset.pipReady) return;
        wrap.dataset.pipReady = "1";
        var startX = 0, startY = 0, origL = 0, origT = 0, moved = false;

        function onDown(e) {
            var pt = e.touches ? e.touches[0] : e;
            startX = pt.clientX; startY = pt.clientY;
            var r = wrap.getBoundingClientRect();
            origL = r.left; origT = r.top;
            moved = false;
            wrap.classList.add("dragging");
            wrap.style.right = "auto";
            wrap.style.bottom = "auto";
            wrap.style.left = origL + "px";
            wrap.style.top = origT + "px";
            e.preventDefault();
        }
        function onMove(e) {
            if (!wrap.classList.contains("dragging")) return;
            var pt = e.touches ? e.touches[0] : e;
            var dx = pt.clientX - startX, dy = pt.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
            var nl = Math.max(0, Math.min(window.innerWidth - wrap.offsetWidth, origL + dx));
            var nt = Math.max(0, Math.min(window.innerHeight - wrap.offsetHeight - 80, origT + dy));
            wrap.style.left = nl + "px";
            wrap.style.top = nt + "px";
        }
        function onUp() {
            if (!wrap.classList.contains("dragging")) return;
            wrap.classList.remove("dragging");
            if (!moved) {
                // tap → swap / expand
                try { swapLocalRemoteView(); } catch (_) {}
            }
        }
        wrap.addEventListener("mousedown", onDown);
        wrap.addEventListener("touchstart", onDown, { passive: false });
        window.addEventListener("mousemove", onMove);
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("mouseup", onUp);
        window.addEventListener("touchend", onUp);
    }

    var __pipSwapped = false;
    function swapLocalRemoteView() {
        var local = document.getElementById("localVideo");
        var remote = document.getElementById("remoteVideo");
        var wrap = document.getElementById("localVideoWrap");
        if (!local || !remote) return;
        __pipSwapped = !__pipSwapped;
        // swap srcObjects
        var a = local.srcObject;
        local.srcObject = remote.srcObject;
        remote.srcObject = a;
        try { local.play(); remote.play(); } catch (_) {}
        if (wrap) wrap.classList.toggle("expanded", false);
    }

    function setupCallMinimize() {
        var bar = document.getElementById("callMiniBar");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "callMiniBar";
            bar.innerHTML = '<span class="miniDot"></span><span id="callMiniLabel">Viewora Call</span><span id="callMiniTimer">00:00</span><span class="miniNav"><a href="index.html" target="_blank" rel="noopener">Home</a><a href="messages.html" target="_blank" rel="noopener">Chat</a><a href="profile.html" target="_blank" rel="noopener">Profile</a></span>';
            document.body.appendChild(bar);
        }
        function showMini() {
            if (!bar) return;
            bar.classList.add("show");
            bar.style.display = "flex";
            document.body.classList.add("call-minimized");
            try {
                var stage = document.getElementById("callStage");
                if (stage) stage.style.opacity = "0";
                var c = document.querySelector(".call-controls");
                if (c) c.style.visibility = "hidden";
                var top = document.querySelector(".call-topbar");
                if (top) top.style.visibility = "hidden";
            } catch (_) {}
        }
        function hideMini() {
            if (!bar) return;
            bar.classList.remove("show");
            document.body.classList.remove("call-minimized");
            try {
                var c = document.querySelector(".call-controls");
                if (c) c.style.visibility = "";
                var top = document.querySelector(".call-topbar");
                if (top) top.style.visibility = "";
                var stage = document.getElementById("callStage");
                if (stage) stage.style.opacity = "";
            } catch (_) {}
        }
        window.__vieworaShowCallMini = showMini;
        window.__vieworaHideCallMini = hideMini;

        // Click restores full UI
        bar.addEventListener("click", function (e) {
            if (bar.dataset.dragging === "1") return;
            hideMini();
        });

        // Drag anywhere
        (function makeDraggable(el) {
            if (!el || el.dataset.dragReady) return;
            el.dataset.dragReady = "1";
            var ox = 0, oy = 0, sx = 0, sy = 0, moved = false;
            function pos(ev) {
                if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
                return { x: ev.clientX, y: ev.clientY };
            }
            function onStart(ev) {
                var p = pos(ev);
                var r = el.getBoundingClientRect();
                ox = p.x - r.left; oy = p.y - r.top;
                sx = p.x; sy = p.y; moved = false;
                el.dataset.dragging = "0";
                el.style.transition = "none";
                el.style.left = r.left + "px";
                el.style.top = r.top + "px";
                el.style.right = "auto";
                el.style.bottom = "auto";
                el.style.transform = "none";
            }
            function onMove(ev) {
                var p = pos(ev);
                if (Math.abs(p.x - sx) + Math.abs(p.y - sy) > 8) {
                    moved = true; el.dataset.dragging = "1";
                }
                if (!moved) return;
                ev.preventDefault();
                var nx = p.x - ox, ny = p.y - oy;
                nx = Math.max(4, Math.min(window.innerWidth - el.offsetWidth - 4, nx));
                ny = Math.max(4, Math.min(window.innerHeight - el.offsetHeight - 4, ny));
                el.style.left = nx + "px";
                el.style.top = ny + "px";
            }
            function onEnd() {
                setTimeout(function () { el.dataset.dragging = "0"; }, 50);
                el.style.transition = "";
            }
            el.addEventListener("mousedown", onStart);
            el.addEventListener("touchstart", onStart, { passive: true });
            window.addEventListener("mousemove", onMove, { passive: false });
            window.addEventListener("touchmove", onMove, { passive: false });
            window.addEventListener("mouseup", onEnd);
            window.addEventListener("touchend", onEnd);
        })(bar);

        var minBtn = document.getElementById("minimizeCallBtn");
        if (minBtn) {
            minBtn.style.display = "";
            minBtn.onclick = function (e) { e.preventDefault(); showMini(); };
        }
        setInterval(function () {
            try {
                var t = document.getElementById("callTimer") || document.getElementById("callDuration");
                var mt = document.getElementById("callMiniTimer");
                if (t && mt) mt.textContent = (t.textContent || "00:00").trim();
            } catch (_) {}
        }, 1000);
        document.addEventListener("visibilitychange", function () {
            if (document.hidden && !callEnded && accepted) {
                try { sessionStorage.setItem("viewora_call_bg", "1"); } catch (_) {}
                // Don't end — keep media; show mini when visible again
            } else if (!document.hidden && sessionStorage.getItem("viewora_call_bg") === "1") {
                try { sessionStorage.removeItem("viewora_call_bg"); } catch (_) {}
            }
        });
    }

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


    async function renegotiateForVideoUpgrade() {
        if (!peerConnection || !callRef) return;
        try {
            // Ensure we offer to receive video too
            var offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await peerConnection.setLocalDescription(offer);
            answerHandled = false;
            await callRef.child("offer").set({
                type: offer.type,
                sdp: offer.sdp,
                renegotiate: true,
                videoUpgrade: true,
                at: Date.now()
            });
            try {
                await callRef.update({ type: "video", video: true });
            } catch (_) {}
            console.log("[VieworaCall] video upgrade offer sent");
        } catch (e) {
            console.warn("renegotiateForVideoUpgrade", e);
            throw e;
        }
    }


    function showVideoSwitchModal() {
        return new Promise(function (resolve) {
            try {
                var old = document.getElementById("vieworaVideoSwitchModal");
                if (old) old.remove();
            } catch (_) {}
            var wrap = document.createElement("div");
            wrap.id = "vieworaVideoSwitchModal";
            wrap.innerHTML = [
                '<div class="vvs-backdrop"></div>',
                '<div class="vvs-card">',
                '  <div class="vvs-icon"><i class="fa-solid fa-video"></i></div>',
                '  <h3>Turn on camera?</h3>',
                '  <p>This will share your camera with the other person. You can turn it off anytime.</p>',
                '  <div class="vvs-actions">',
                '    <button type="button" class="vvs-cancel">Not now</button>',
                '    <button type="button" class="vvs-ok">Turn on</button>',
                '  </div>',
                '</div>'
            ].join("");
            document.body.appendChild(wrap);
            requestAnimationFrame(function () { wrap.classList.add("show"); });
            function close(val) {
                wrap.classList.remove("show");
                setTimeout(function () { try { wrap.remove(); } catch (_) {} }, 200);
                resolve(val);
            }
            wrap.querySelector(".vvs-cancel").onclick = function () { close(false); };
            wrap.querySelector(".vvs-backdrop").onclick = function () { close(false); };
            wrap.querySelector(".vvs-ok").onclick = function () { close(true); };
        });
    }

    async function toggleCamera() {

        if (!localStream) {
            return;
        }

        let videoTrack =
            localStream.getVideoTracks()[0];

        // No video track yet — turn camera on (confirm only if this was a VOICE call)
        if (!videoTrack) {
            var ok = true;
            if (callType !== "video") {
                try {
                    ok = await showVideoSwitchModal();
                } catch (_) { ok = true; }
                if (!ok) return;
            }
            try {
                setStatus(callType === "video" ? "Turning camera on..." : "Switching to video...");
                var vs = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        facingMode: { ideal: "user" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
                videoTrack = vs.getVideoTracks()[0];
                if (!videoTrack) {
                    toast("Camera unavailable");
                    return;
                }
                localStream.addTrack(videoTrack);
                if (peerConnection) {
                    try {
                        peerConnection.addTrack(videoTrack, localStream);
                    } catch (eAdd) {
                        try {
                            var senders = peerConnection.getSenders();
                            var vsender = senders.find(function (s) { return s.track && s.track.kind === "video"; });
                            if (vsender) await vsender.replaceTrack(videoTrack);
                            else peerConnection.addTrack(videoTrack, localStream);
                        } catch (e2) {
                            logError("add video track", e2);
                        }
                    }
                }
                if (localVideo) {
                    localVideo.srcObject = localStream;
                    localVideo.muted = true;
                    localVideo.play().catch(function () {});
                }
                try {
                    callType = "video";
                    if (callRef) callRef.update({ type: "video", video: true, videoUpgradeAt: Date.now() });
                } catch (_) {}
                // CRITICAL: renegotiate so peer receives video track
                try {
                    await renegotiateForVideoUpgrade();
                } catch (re) {
                    console.warn("renegotiate", re);
                }
                try {
                    document.body.classList.add("video-call");
                    var lv = document.getElementById("localVideo");
                    var wrap = document.getElementById("localVideoWrap") || document.querySelector(".local-video-wrap");
                    if (wrap) { wrap.classList.remove("hidden"); wrap.style.display = ""; }
                    if (lv) { lv.srcObject = localStream; lv.muted = true; lv.play().catch(function(){}); }
                    setStatus("Video call");
                } catch (_) {}
                toast("Video on");
            } catch (e) {
                logError("enable camera", e);
                toast("Allow camera permission to switch to video");
                return;
            }
        }

        videoTrack.enabled = !videoTrack.enabled;
        const on = !!videoTrack.enabled;

        const buttons = [
            $("cameraToggleBtn"),
            $("cameraCallBtn"),
            $("cameraBtn")
        ];

        buttons.forEach(button => {
            if (!button) return;
            button.classList.toggle("active", !on);
            const icon = button.querySelector("i");
            if (icon) {
                icon.className = on
                    ? "fa-solid fa-video"
                    : "fa-solid fa-video-slash";
            }
        });

        // Local PiP: hide video, show DP when camera off
        try {
            const wrap = $("localVideoWrap");
            const vid = $("localVideo");
            let av = $("localCameraOffAvatar");
            if (wrap && !av) {
                av = document.createElement("div");
                av.id = "localCameraOffAvatar";
                av.className = "local-camera-off";
                av.innerHTML = '<img alt="" /><span>Camera off</span>';
                wrap.appendChild(av);
            }
            if (av) {
                const img = av.querySelector("img");
                if (img) {
                    img.src =
                        (currentUser && currentUser.photoURL) ||
                        localStorage.getItem("viewora_my_avatar") ||
                        "assets/default-avatar.png";
                }
                av.classList.toggle("show", !on);
            }
            if (vid) vid.style.opacity = on ? "1" : "0";
        } catch (_) {}

        // Tell peer so they can show our DP
        try {
            if (callRef && currentUser) {
                callRef.child("media/" + currentUser.uid).update({
                    camera: on,
                    at: Date.now()
                });
            }
        } catch (_) {}
    }


    function listenCallTypeUpgrade() {
        if (!callRef) return;
        callRef.child("type").on("value", function (snap) {
            var t = snap.val();
            if (t === "video" && callType !== "video") {
                callType = "video";
                try {
                    document.body.classList.add("video-call");
                    setStatus("Video call");
                    toast("Peer switched to video");
                } catch (_) {}
                // Try play remote if track already present
                try {
                    if (remoteStream) {
                        var hasV = remoteStream.getVideoTracks().some(function (tr) { return tr.enabled !== false; });
                        if (hasV && remoteVideo) {
                            remoteVideo.srcObject = remoteStream;
                            remoteVideo.style.display = "block";
                            remoteVideo.style.opacity = "1";
                            remoteVideo.play().catch(function () {});
                        }
                    }
                } catch (_) {}
            }
        });
        // Also listen offer for renegotiation on callee
        callRef.child("offer").on("value", function (snap) {
            var o = snap.val();
            if (!o || !o.sdp) return;
            if (o.videoUpgrade || o.renegotiate) {
                try {
                    callType = "video";
                    document.body.classList.add("video-call");
                } catch (_) {}
                if (role !== "caller" && accepted) {
                    offerHandled = false; // allow handleOffer again
                    handleOffer(o).catch(function (e) { console.warn(e); });
                }
            }
        });
    }
    /* VIEWORA_REMOTE_VIDEO_UPGRADE */

    function listenRemoteMediaFlags() {
        if (!callRef || !remoteUserId) return;
        callRef.child("media/" + remoteUserId).on("value", function (snap) {
            const v = snap.val() || {};
            const camOn = v.camera !== false;
            try {
                let ov = $("remoteCameraOff");
                if (!ov) {
                    ov = document.createElement("div");
                    ov.id = "remoteCameraOff";
                    ov.className = "remote-camera-off";
                    ov.innerHTML = '<img id="remoteCameraOffImg" alt="" /><span>Camera off</span>';
                    const host = $("callApp") || document.body;
                    host.appendChild(ov);
                }
                const img = $("remoteCameraOffImg");
                if (img) {
                    img.src =
                        ($("remoteAvatar") && $("remoteAvatar").src) ||
                        "assets/default-avatar.png";
                }
                ov.classList.toggle("show", !camOn && callType === "video");
                if (remoteVideo) {
                    remoteVideo.style.opacity = camOn ? "1" : "0";
                }
            } catch (_) {}
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
        try {
            if (window.VieworaMesh) VieworaMesh.leave();
        } catch (_) {}


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
        try { stopTonePattern(); } catch (_) {}
        try { if (window.VieworaSounds) window.VieworaSounds.stopAll(); } catch (_) {}
        try { clearBusyFlag(); } catch (_) {}

        setConnecting(false);
        setStatus(message || "Call ended.");

        if ($("endedText")) {
            $("endedText").textContent = message || "Call ended.";
        }

        if (endedScreen) {
            endedScreen.classList.remove("hidden");
            endedScreen.style.display = "flex";
            endedScreen.style.zIndex = "9999";
        }

        if (callApp) {
            callApp.classList.add("hidden");
        }

        if (incomingScreen) {
            incomingScreen.classList.add("hidden");
        }

        // Wire Back buttons once
        try {
            function goBackFromCall(e) {
                try { if (e) { e.preventDefault(); e.stopPropagation(); } } catch (_) {}
                try { cleanup(); } catch (_) {}
                var backTo = "messages.html";
                try {
                    var q = new URLSearchParams(location.search || "");
                    var peer = q.get("uid") || q.get("peer") || remoteUserId || receiverId || "";
                    if (peer) backTo = "chat.html?uid=" + encodeURIComponent(peer);
                } catch (_) {}
                try { window.location.replace(backTo); } catch (_) {
                    window.location.href = backTo;
                }
            }
            ["endedBackBtn", "backHomeBtn", "backFromEnded", "endedBack"].forEach(function (id) {
                var el = document.getElementById(id);
                if (el && !el.dataset.bound) {
                    el.dataset.bound = "1";
                    el.onclick = goBackFromCall;
                }
            });
            // Any button inside ended screen
            if (endedScreen && !endedScreen.dataset.bound) {
                endedScreen.dataset.bound = "1";
                endedScreen.addEventListener("click", function (ev) {
                    var t = ev.target;
                    if (!t) return;
                    if (t.id === "endedBackBtn" || t.closest("#endedBackBtn") ||
                        (t.tagName === "BUTTON" && /back/i.test(t.textContent || ""))) {
                        goBackFromCall(ev);
                    }
                });
            }
        } catch (_) {}
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

    function __vieworaLeaveCallPage(e) {
        try { if (e) { e.preventDefault(); e.stopPropagation(); } } catch (_) {}
        try { cleanup(); } catch (_) {}
        try { clearBusyFlag(); } catch (_) {}
        var dest = "messages.html";
        try {
            var peer = remoteUserId || receiverId || "";
            if (peer) dest = "chat.html?uid=" + encodeURIComponent(peer);
        } catch (_) {}
        try { location.replace(dest); } catch (_) { location.href = dest; }
    }
    ["backHomeBtn", "endedBackBtn"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener("click", __vieworaLeaveCallPage);
    });



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
    $("callSpeakerBtn")
        ?.addEventListener(
            "click",
            toggleSpeaker
        );
    $("cameraBtn")
        ?.addEventListener(
            "click",
            toggleCamera
        );
    $("addCallUsersBtn")
        ?.addEventListener(
            "click",
            openAddUsersSheet
        );


    function minimizeCallUI() {
        if (callEnded) return;
        try {
            document.body.classList.add("call-minimized");
            let bubble = $("callMiniBubble");
            if (!bubble) {
                bubble = document.createElement("div");
                bubble.id = "callMiniBubble";
                bubble.className = "call-mini-bubble";
                bubble.innerHTML =
                    '<img id="callMiniAvatar" src="assets/default-avatar.png" alt="">' +
                    '<div class="call-mini-meta"><strong id="callMiniName">On call</strong>' +
                    '<span id="callMiniTimer">00:00</span></div>' +
                    '<button type="button" id="callMiniExpand" aria-label="Expand">' +
                    '<i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>';
                document.body.appendChild(bubble);
                $("callMiniExpand")?.addEventListener("click", expandCallUI);
                bubble.addEventListener("click", function (e) {
                    if (e.target.closest("#callMiniExpand")) return;
                    expandCallUI();
                });
            }
            const av = $("remoteAvatar");
            const img = $("callMiniAvatar");
            if (img && av) img.src = av.src || img.src;
            const nm = $("callMiniName");
            if (nm) nm.textContent = ($("remoteName") && $("remoteName").textContent) || "On call";
            // Keep media alive — do not navigate away
            try {
                sessionStorage.setItem("viewora_active_call", JSON.stringify({
                    callId: callId,
                    type: callType,
                    at: Date.now()
                }));
            } catch (_) {}
            toast("Call continues — tap bubble to return");
        } catch (e) {
            logError("minimize:", e);
        }
    }

    function expandCallUI() {
        document.body.classList.remove("call-minimized");
        try {
            const b = $("callMiniBubble");
            if (b) b.remove();
        } catch (_) {}
    }

    // Sync mini timer
    setInterval(function () {
        try {
            if (!document.body.classList.contains("call-minimized")) return;
            const src = $("callDuration");
            const dst = $("callMiniTimer");
            if (src && dst) dst.textContent = src.textContent || "00:00";
        } catch (_) {}
    }, 1000);

    $("minimizeCallBtn")
        ?.addEventListener("click", minimizeCallUI);

    // Hardware / browser back → minimize, do not kill call
    try {
        history.pushState({ vieworaCall: 1 }, "", location.href);
        window.addEventListener("popstate", function (e) {
            if (callEnded) return;
            if (!document.body.classList.contains("call-minimized")) {
                history.pushState({ vieworaCall: 1 }, "", location.href);
                minimizeCallUI();
            }
        });
    } catch (_) {}


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

        inviteToCall: inviteToCall,
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

/* VIEWORA_CAM_OFF_DP — when local camera off, show avatar instead of black */
(function () {
  function ensureLocalAvatarOverlay() {
    var wrap = document.getElementById("localVideoWrap") || document.querySelector(".local-video-wrap, .pip-wrap");
    var lv = document.getElementById("localVideo");
    if (!lv) return;
    var parent = wrap || lv.parentElement;
    if (!parent) return;
    var ov = document.getElementById("localCamOffAvatar");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "localCamOffAvatar";
      ov.className = "local-cam-off-avatar";
      ov.innerHTML = '<img id="localCamOffImg" alt="" /><span>Camera off</span>';
      parent.style.position = parent.style.position || "relative";
      parent.appendChild(ov);
    }
    return ov;
  }
  window.__vieworaSetLocalCameraOff = function (off) {
    try {
      var ov = ensureLocalAvatarOverlay();
      if (!ov) return;
      var img = document.getElementById("localCamOffImg");
      var src =
        (window.currentUser && (currentUser.photoURL || "")) ||
        localStorage.getItem("viewora_my_avatar") ||
        "https://ui-avatars.com/api/?name=Me&background=7c3aed&color=fff&size=128";
      if (img) {
        img.src = src;
        img.onerror = function () {
          this.onerror = null;
          this.src = "https://ui-avatars.com/api/?name=Me&background=7c3aed&color=fff&size=128";
        };
      }
      ov.classList.toggle("show", !!off);
      var lv = document.getElementById("localVideo");
      if (lv) lv.style.opacity = off ? "0" : "1";
    } catch (_) {}
  };
})();



/* VIEWORA_CALL_BACK_GUARD — back always minimizes; never ends; traps history */
(function () {
  var armed = false;
  function isInCall() {
    try {
      if (sessionStorage.getItem("viewora_call_busy") === "1") return true;
      if (document.body.classList.contains("in-call")) return true;
      if (window.localStream) return true;
    } catch (_) {}
    return false;
  }
  function doMinimize() {
    try {
      if (typeof window.__vieworaShowCallMini === "function") {
        window.__vieworaShowCallMini();
        return;
      }
      var bar = document.getElementById("callMiniBar");
      if (bar) { bar.classList.add("show"); bar.style.display = "flex"; }
      document.body.classList.add("call-minimized");
      var controls = document.querySelector(".call-controls");
      if (controls) controls.style.visibility = "hidden";
      var top = document.querySelector(".call-topbar");
      if (top) top.style.visibility = "hidden";
      var stage = document.getElementById("callStage");
      if (stage) stage.style.opacity = "0";
    } catch (e) { console.warn(e); }
  }
  function trapHistory() {
    try {
      history.pushState({ vieworaCall: 1 }, "", location.href);
      history.pushState({ vieworaCall: 2 }, "", location.href);
    } catch (_) {}
  }
  window.addEventListener("popstate", function (e) {
    if (!isInCall()) return;
    trapHistory();
    doMinimize();
  });
  window.__vieworaArmCallBackGuard = function () {
    armed = true;
    trapHistory();
  };
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest(
      "#backBtn, .backBtn, [data-action=back], #minimizeCallBtn, .call-back, #callBackBtn"
    );
    if (!t || !isInCall()) return;
    e.preventDefault();
    e.stopPropagation();
    doMinimize();
  }, true);
  // Block page unload accidentally
  window.addEventListener("beforeunload", function (e) {
    if (!isInCall()) return;
    e.preventDefault();
    e.returnValue = "Call is in progress";
    return e.returnValue;
  });
})();

/* VIEWORA_CALL_BLANK_FIX */
(function () {
  function unblank() {
    try {
      var ov = document.getElementById("connectingOverlay");
      if (ov) { ov.classList.add("hidden"); ov.style.display = "none"; }
      var app = document.getElementById("callApp");
      if (app) {
        app.classList.remove("hidden");
        app.style.display = "";
        app.style.opacity = "1";
        app.style.visibility = "visible";
      }
      var rv = document.getElementById("remoteVideo");
      if (rv && rv.srcObject) {
        rv.style.display = "block";
        rv.style.opacity = "1";
        rv.play().catch(function () {});
      }
      var lv = document.getElementById("localVideo");
      if (lv && lv.srcObject) {
        var w = document.getElementById("localVideoWrap");
        if (w) w.classList.remove("hidden");
        lv.play().catch(function () {});
      }
    } catch (e) {}
  }
  setInterval(unblank, 1500);
  document.addEventListener("DOMContentLoaded", unblank);
  window.addEventListener("load", unblank);
})();

/* VIEWORA_NET_CUT — phone off / long network loss ends call */
(function () {
  var offlineSince = 0;
  var failTimer = null;
  function scheduleEnd() {
    clearTimeout(failTimer);
    failTimer = setTimeout(function () {
      try {
        if (sessionStorage.getItem("viewora_call_busy") !== "1") return;
        if (navigator.onLine) return;
        if (window.VieworaCall && window.VieworaCall.endCall) window.VieworaCall.endCall();
      } catch (_) {}
    }, 45000);
  }
  window.addEventListener("offline", function () {
    offlineSince = Date.now();
    try {
      var st = document.getElementById("callStatus");
      if (st) st.textContent = "Reconnecting...";
    } catch (_) {}
    scheduleEnd();
  });
  window.addEventListener("online", function () {
    offlineSince = 0;
    clearTimeout(failTimer);
  });
})();

/* VIEWORA_LOCAL_VIDEO_BOOT */
(function () {
  function syncLocalPip() {
    try {
      var ls = window.localStream;
      if (!ls) return;
      var hasV = ls.getVideoTracks().some(function (t) { return t.readyState === "live"; });
      var lv = document.getElementById("localVideo");
      var wrap = document.getElementById("localVideoWrap") || document.querySelector(".local-video-wrap");
      if (hasV && lv) {
        if (lv.srcObject !== ls) lv.srcObject = ls;
        lv.muted = true;
        lv.playsInline = true;
        lv.play().catch(function () {});
        if (wrap) { wrap.classList.remove("hidden"); wrap.style.display = ""; }
        document.body.classList.add("video-call");
      }
    } catch (e) {}
  }
  setInterval(syncLocalPip, 2000);
})();

/* VIEWORA_MINI_V2 */
(function () {
  function ensureBar() {
    var bar = document.getElementById("callMiniBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "callMiniBar";
      bar.innerHTML = '<span class="miniDot"></span><span id="callMiniLabel">Viewora Call</span> <span id="callMiniTimer">00:00</span>';
      document.body.appendChild(bar);
    }
    return bar;
  }
  window.__vieworaShowCallMini = function () {
    var bar = ensureBar();
    bar.classList.add("show");
    bar.style.display = "flex";
    document.body.classList.add("call-minimized");
    try {
      var c = document.querySelector(".call-controls"); if (c) c.style.visibility = "hidden";
      var t = document.querySelector(".call-topbar"); if (t) t.style.visibility = "hidden";
      var s = document.getElementById("callStage"); if (s) s.style.opacity = "0";
    } catch (_) {}
  };
  window.__vieworaHideCallMini = function () {
    var bar = document.getElementById("callMiniBar");
    if (bar) { bar.classList.remove("show"); }
    document.body.classList.remove("call-minimized");
    try {
      var c = document.querySelector(".call-controls"); if (c) c.style.visibility = "";
      var t = document.querySelector(".call-topbar"); if (t) t.style.visibility = "";
      var s = document.getElementById("callStage"); if (s) s.style.opacity = "";
    } catch (_) {}
  };
})();


/* VIEWORA_CALL_HARDEN_V3 — video fallback, minimize, no blank, equal grid */
(function () {
  // Force busy flag whenever media is live
  setInterval(function () {
    try {
      if (window.localStream && window.localStream.getTracks().some(function (t) { return t.readyState === "live"; })) {
        sessionStorage.setItem("viewora_call_busy", "1");
        document.body.classList.add("in-call");
      }
    } catch (_) {}
  }, 800);

  // Never show "No video track" on ended screen — rewrite to useful message
  var _origShowEnded = window.showEnded;
  // Intercept text content on ended screen
  var observer = new MutationObserver(function () {
    try {
      var el = document.getElementById("callEndedScreen") || document.querySelector(".call-ended-screen");
      if (!el) return;
      var txt = el.textContent || "";
      if (/no video track/i.test(txt)) {
        var p = el.querySelector("p, .ended-sub, .call-ended-msg, span");
        if (p) p.textContent = "Camera not available. Try voice call or allow camera permission.";
        // Auto-offer join again instead of dead end
        var back = el.querySelector("button, #endedBackBtn, .ended-back");
        if (back && !back.dataset.patched) {
          back.dataset.patched = "1";
          back.textContent = "Try again";
          back.onclick = function (e) {
            e.preventDefault();
            try {
              el.classList.add("hidden");
              if (typeof showJoinCallScreen === "function") showJoinCallScreen();
              else if (typeof showPermissionRetry === "function") showPermissionRetry();
              else location.reload();
            } catch (_) { location.reload(); }
          };
        }
      }
    } catch (_) {}
  });
  try { observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true }); } catch (_) {}

  // Equal-size tiles when multiple participants
  function equalGrid() {
    try {
      var stage = document.getElementById("callStage") || document.querySelector(".call-stage, .remote-wrap");
      if (!stage) return;
      var tiles = stage.querySelectorAll(".participant, .peer-tile, .call-tile, video");
      var n = 0;
      tiles.forEach(function (t) {
        if (t.offsetParent !== null || t.style.display !== "none") n++;
      });
      // Fallback: remote + local
      var remote = document.getElementById("remoteVideo");
      var local = document.getElementById("localVideoWrap") || document.getElementById("localVideo");
      document.body.classList.toggle("call-multi-2", n >= 2);
      document.body.classList.toggle("call-multi-3", n >= 3);
      document.body.classList.toggle("call-multi-4", n >= 4);
    } catch (_) {}
  }
  setInterval(equalGrid, 1500);

  // Hard minimize: if somehow navigated but call busy, restore mini bar
  window.addEventListener("pageshow", function () {
    try {
      if (sessionStorage.getItem("viewora_call_busy") === "1" && window.localStream) {
        if (typeof window.__vieworaShowCallMini === "function") window.__vieworaShowCallMini();
      }
    } catch (_) {}
  });

  // Clear busy only on real end
  window.addEventListener("viewora-call-ended", function () {
    try {
      sessionStorage.removeItem("viewora_call_busy");
      document.body.classList.remove("in-call", "call-minimized");
    } catch (_) {}
  });
})();
