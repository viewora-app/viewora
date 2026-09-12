"use strict";

/*
============================================================
 VIEWORA — GLOBAL CALL LISTENER
 Premium Incoming Call System

 LISTENS:
   incomingCalls/{receiverUid}

 FEATURES:
   • Global incoming call detection
   • Voice / Video call UI
   • Caller name + avatar
   • Ringtone
   • Accept
   • Decline
   • Firebase call status sync
   • Works on every page where this file is loaded

 REQUIRED BEFORE THIS FILE:
   firebase SDK
   firebase.js

 DATABASE:
   incomingCalls/{receiverUid}/{callId}

 EXPECTED CALL DATA:

 {
    callId: "...",
    callerId: "...",
    receiverId: "...",
    type: "audio" | "video",
    status: "ringing",
    createdAt: 123456789
 }

============================================================
*/

(() => {

    /* ======================================================
       PREVENT DOUBLE INITIALIZATION
    ====================================================== */

    if (window.__VIEWORA_GLOBAL_CALL_LISTENER__) {

        console.warn(
            "[VIEWORA CALL] Global listener already running."
        );

        return;
    }

    window.__VIEWORA_GLOBAL_CALL_LISTENER__ = true;


    /* ======================================================
       FIREBASE CHECK
    ====================================================== */

    // Soft check — init() will wait for auth/db
    if (typeof firebase === "undefined") {
        console.error("[VIEWORA CALL] Firebase SDK missing.");
        return;
    }
    var auth = window.auth || null;
    var db = window.db || null;


    /* ======================================================
       STATE
    ====================================================== */

    let currentUser = null;

    let incomingRef = null;

    let activeCall = null;
    let incomingSyncDone = false;
    const processedCallIds = new Set();
    const MAX_RING_AGE_MS = 55 * 1000; // ignore stale ringing older than 55s

    function isFreshRinging(data) {
        if (!data || data.status !== "ringing") return false;
        let created = data.createdAtMs || data.createdAt || data.timestamp || data.time || 0;
        if (created && typeof created === "object") return false;
        created = Number(created);
        if (!created || created < 100000) return false;
        const age = Date.now() - created;
        if (age < -5000) return false;
        return age <= MAX_RING_AGE_MS;
    }

    function cleanupStaleCall(callId) {
        if (!currentUser || !callId) return;
        try {
            db.ref("incomingCalls/" + currentUser.uid + "/" + callId).update({
                status: "ended",
                endedReason: "stale",
                endedAt: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (_) {}
    }

    let popup = null;

    let ringtoneContext = null;

    let ringtoneTimer = null;

    let ringtoneGain = null;

    let initialized = false;


    /* ======================================================
       HELPERS
    ====================================================== */

    const $ = id =>
        document.getElementById(id);


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
       AUTH
    ====================================================== */

    function waitForUser() {
        auth = window.auth || auth;
        db = window.db || db;
        if (!auth && typeof firebase !== "undefined") {
            try { auth = firebase.auth(); } catch (_) {}
        }
        if (!db && typeof firebase !== "undefined") {
            try { db = firebase.database(); } catch (_) {}
        }
        if (!auth) {
            return Promise.reject(new Error("Auth unavailable"));
        }

        if (auth.currentUser) {
            currentUser = auth.currentUser;
            return Promise.resolve(currentUser);
        }

        return new Promise((resolve, reject) => {
            let finished = false;
            const timer = setTimeout(() => {
                if (finished) return;
                finished = true;
                try { unsubscribe(); } catch (_) {}
                reject(new Error("Auth timeout"));
            }, 12000);

            const unsubscribe = auth.onAuthStateChanged((user) => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                try { unsubscribe(); } catch (_) {}

                if (!user) {
                    reject(new Error("User not authenticated."));
                    return;
                }

                currentUser = user;

                            resolve(user);
                        }
                    );
            }
        );
    }


    /* ======================================================
       LOAD CALLER
    ====================================================== */

    async function loadCaller(uid) {

        if (!uid) {
            return null;
        }


        try {

            const snapshot =
                await db
                    .ref(
                        "users/" + uid
                    )
                    .once("value");


            if (!snapshot.exists()) {
                return null;
            }


            return snapshot.val();

        } catch (e) {

            error(
                "Caller load failed:",
                e
            );

            return null;
        }
    }


    /* ======================================================
       FORMAT CALL TYPE
    ====================================================== */

    function getCallType(type) {

        return type === "video"
            ? "video"
            : "audio";
    }


    /* ======================================================
       CREATE PREMIUM UI
    ====================================================== */

    function createPopup() {

        if (popup) {
            return popup;
        }


        const style =
            document.createElement("style");

        style.id =
            "viewora-global-call-style";


        if (!$(style.id)) {

            style.textContent = `

                #vieworaIncomingCall {

                    position: fixed;

                    top: 18px;
                    left: 50%;

                    transform:
                        translateX(-50%)
                        translateY(-130px);

                    width:
                        min(430px, calc(100vw - 24px));

                    z-index: 2147483647;

                    opacity: 0;

                    transition:
                        transform .42s
                        cubic-bezier(.22,1,.36,1),
                        opacity .32s ease;

                    pointer-events: none;

                    font-family:
                        Inter,
                        -apple-system,
                        BlinkMacSystemFont,
                        "Segoe UI",
                        sans-serif;
                }


                #vieworaIncomingCall.show {

                    transform:
                        translateX(-50%)
                        translateY(0);

                    opacity: 1;

                    pointer-events: auto;
                }


                .viewora-call-card {

                    position: relative;

                    overflow: hidden;

                    padding: 18px;

                    border-radius: 24px;

                    background:
                        linear-gradient(
                            145deg,
                            rgba(30,30,36,.98),
                            rgba(12,12,17,.98)
                        );

                    border:
                        1px solid
                        rgba(255,255,255,.12);

                    box-shadow:
                        0 24px 70px
                        rgba(0,0,0,.42),
                        inset 0 1px 0
                        rgba(255,255,255,.08);

                    color: white;

                    backdrop-filter:
                        blur(24px);

                    -webkit-backdrop-filter:
                        blur(24px);
                }


                .viewora-call-glow {

                    position: absolute;

                    width: 180px;
                    height: 180px;

                    top: -100px;
                    right: -70px;

                    border-radius: 50%;

                    background:
                        radial-gradient(
                            circle,
                            rgba(100,120,255,.34),
                            transparent 68%
                        );

                    pointer-events: none;
                }


                .viewora-call-top {

                    position: relative;

                    display: flex;

                    align-items: center;

                    gap: 14px;
                }


                .viewora-call-avatar-wrap {

                    position: relative;

                    flex: 0 0 auto;
                }


                .viewora-call-avatar {

                    width: 58px;
                    height: 58px;

                    border-radius: 50%;

                    object-fit: cover;

                    background:
                        #25252d;

                    border:
                        2px solid
                        rgba(255,255,255,.15);

                    box-shadow:
                        0 8px 25px
                        rgba(0,0,0,.32);
                }


                .viewora-call-pulse {

                    position: absolute;

                    right: 1px;
                    bottom: 1px;

                    width: 15px;
                    height: 15px;

                    border-radius: 50%;

                    background: #32d583;

                    border:
                        3px solid
                        #15151b;

                    animation:
                        vieworaCallPulse
                        1.5s infinite;
                }


                @keyframes vieworaCallPulse {

                    0% {
                        box-shadow:
                            0 0 0 0
                            rgba(50,213,131,.55);
                    }

                    70% {
                        box-shadow:
                            0 0 0 10px
                            rgba(50,213,131,0);
                    }

                    100% {
                        box-shadow:
                            0 0 0 0
                            rgba(50,213,131,0);
                    }
                }


                .viewora-call-info {

                    min-width: 0;

                    flex: 1;
                }


                .viewora-call-label {

                    display: flex;

                    align-items: center;

                    gap: 7px;

                    margin-bottom: 4px;

                    color:
                        rgba(255,255,255,.62);

                    font-size: 12px;

                    font-weight: 600;

                    letter-spacing:
                        .02em;
                }


                .viewora-call-label i {

                    color:
                        #8c9eff;
                }


                .viewora-call-name {

                    overflow: hidden;

                    text-overflow: ellipsis;

                    white-space: nowrap;

                    font-size: 17px;

                    font-weight: 700;
                }


                .viewora-call-username {

                    margin-top: 2px;

                    overflow: hidden;

                    text-overflow: ellipsis;

                    white-space: nowrap;

                    color:
                        rgba(255,255,255,.48);

                    font-size: 12px;
                }


                .viewora-call-actions {

                    position: relative;

                    display: grid;

                    grid-template-columns:
                        1fr 1fr;

                    gap: 10px;

                    margin-top: 18px;
                }


                .viewora-call-action {

                    height: 46px;

                    border: 0;

                    border-radius: 15px;

                    display: flex;

                    align-items: center;

                    justify-content: center;

                    gap: 8px;

                    font-size: 14px;

                    font-weight: 700;

                    cursor: pointer;

                    transition:
                        transform .18s ease,
                        filter .18s ease;
                }


                .viewora-call-action:active {

                    transform:
                        scale(.96);
                }


                .viewora-call-decline {

                    color: white;

                    background:
                        rgba(255,255,255,.09);

                    border:
                        1px solid
                        rgba(255,255,255,.08);
                }


                .viewora-call-decline:hover {

                    filter:
                        brightness(1.18);
                }


                .viewora-call-accept {

                    color: white;

                    background:
                        linear-gradient(
                            135deg,
                            #4f7cff,
                            #7657ff
                        );

                    box-shadow:
                        0 8px 22px
                        rgba(91,91,255,.28);
                }


                .viewora-call-accept:hover {

                    filter:
                        brightness(1.12);
                }


                .viewora-call-ringing {

                    position: absolute;

                    inset: 0;

                    pointer-events: none;

                    background:
                        linear-gradient(
                            90deg,
                            transparent,
                            rgba(255,255,255,.035),
                            transparent
                        );

                    transform:
                        translateX(-100%);

                    animation:
                        vieworaCallShimmer
                        2.2s infinite;
                }


                @keyframes vieworaCallShimmer {

                    to {
                        transform:
                            translateX(100%);
                    }
                }


                @media (max-width: 520px) {

                    #vieworaIncomingCall {

                        top: 10px;

                        width:
                            calc(100vw - 18px);
                    }

                    .viewora-call-card {

                        border-radius:
                            21px;

                        padding:
                            15px;
                    }

                }

            `;

            document.head.appendChild(
                style
            );
        }


        popup =
            document.createElement("div");

        popup.id =
            "vieworaIncomingCall";


        popup.innerHTML = `

            <div class="viewora-call-card">

                <div class="viewora-call-glow"></div>

                <div class="viewora-call-ringing"></div>

                <div class="viewora-call-top">

                    <div class="viewora-call-avatar-wrap">

                        <img
                            id="vieworaIncomingAvatar"
                            class="viewora-call-avatar"
                            src="assets/default-avatar.png"
                            alt=""
                        >

                        <span
                            class="viewora-call-pulse"
                        ></span>

                    </div>


                    <div class="viewora-call-info">

                        <div
                            id="vieworaIncomingLabel"
                            class="viewora-call-label"
                        >
                            <i class="fa-solid fa-phone"></i>
                            Incoming Call
                        </div>

                        <div
                            id="vieworaIncomingName"
                            class="viewora-call-name"
                        >
                            Viewora User
                        </div>

                        <div
                            id="vieworaIncomingUsername"
                            class="viewora-call-username"
                        >
                        </div>

                    </div>

                </div>


                <div class="viewora-call-actions">

                    <button
                        id="vieworaDeclineCall"
                        class="viewora-call-action viewora-call-decline"
                        type="button"
                    >
                        <i class="fa-solid fa-phone-slash"></i>
                        Decline
                    </button>


                    <button
                        id="vieworaAcceptCall"
                        class="viewora-call-action viewora-call-accept"
                        type="button"
                    >
                        <i class="fa-solid fa-phone"></i>
                        Accept
                    </button>

                </div>

            </div>
        `;


        document.body.appendChild(
            popup
        );


        $("vieworaAcceptCall")
            ?.addEventListener(
                "click",
                acceptIncoming
            );


        $("vieworaDeclineCall")
            ?.addEventListener(
                "click",
                declineIncoming
            );


        return popup;
    }


    /* ======================================================
       SHOW POPUP
    ====================================================== */

    async function showIncoming(
        callId,
        data
    ) {

        if (
            !callId ||
            !data ||
            data.status !== "ringing"
        ) {
            return;
        }


        /*
         * Do not show own calls.
         */

        if (
            currentUser &&
            data.callerId ===
            currentUser.uid
        ) {
            return;
        }


        /*
         * Only show calls for current user.
         */

        if (
            data.receiverId &&
            currentUser &&
            data.receiverId !==
            currentUser.uid
        ) {
            return;
        }


        /*
         * Already handling another call.
         */

        if (
            activeCall &&
            activeCall.callId !== callId
        ) {

            log(
                "Another incoming call already active."
            );

            return;
        }


        const caller =
            await loadCaller(
                data.callerId
            );


        activeCall = {

            callId:
                callId,

            data:
                data,

            caller:
                caller

        };


        const ui =
            createPopup();


        const avatar =
            $("vieworaIncomingAvatar");

        const name =
            $("vieworaIncomingName");

        const username =
            $("vieworaIncomingUsername");

        const label =
            $("vieworaIncomingLabel");


        const callerName =
            caller?.name ||
            caller?.fullName ||
            caller?.displayName ||
            "Viewora User";


        const callerUsername =
            caller?.username
                ? "@" + caller.username
                : "";


        const callerPhoto =
            caller?.profilePhoto ||
            caller?.photoURL ||
            caller?.avatar ||
            "assets/default-avatar.png";


        if (avatar) {
            avatar.src =
                callerPhoto;
        }


        if (name) {
            name.textContent =
                callerName;
        }


        if (username) {
            username.textContent =
                callerUsername;
        }


        const type =
            getCallType(
                data.type
            );


        if (label) {

            label.innerHTML =
                type === "video"
                    ? `
                        <i class="fa-solid fa-video"></i>
                        Incoming Video Call
                    `
                    : `
                        <i class="fa-solid fa-phone"></i>
                        Incoming Voice Call
                    `;
        }


        ui.classList.add(
            "show"
        );


        startRingtone();


        log(
            "Incoming call:",
            callId,
            type
        );
    }


    /* ======================================================
       HIDE POPUP
    ====================================================== */

    function hidePopup() {

        if (popup) {

            popup.classList.remove(
                "show"
            );
        }

        stopRingtone();
    }


    /* ======================================================
       RINGTONE
       Generated locally — no audio file required.
    ====================================================== */

    function startRingtone() {

        stopRingtone();

        // 1) Custom ringtone path from settings (localStorage)
        //    User can set: localStorage.setItem('viewora_call_ringtone', 'assets/my-ring.mp3')
        try {
            let customSrc = localStorage.getItem("viewora_call_ringtone") || "assets/call-ringtone.mp3";
            // Never use message tone as call ring
            if (customSrc.indexOf("message") !== -1) {
                customSrc = "assets/call-ringtone.mp3";
            }
            if (customSrc) {
                const custom = new Audio(customSrc);
                custom.loop = true;
                custom.preload = "auto";
                custom.volume = 1;
                window.__vieworaCustomRing = custom;
                const p = custom.play();
                if (p && p.catch) {
                    p.catch(() => startBuiltinRingtone());
                }
                return;
            }
        } catch (_) {}

        startBuiltinRingtone();
    }

    function startBuiltinRingtone() {
        // Prefer page <audio id="incomingCallRingtone"> MP3 if present
        try {
            const audioEl = document.getElementById("incomingCallRingtone");
            if (audioEl) {
                // Allow override via localStorage without element change
                try {
                    const customSrc = localStorage.getItem("viewora_call_ringtone");
                    if (customSrc) {
                        const src = audioEl.querySelector("source");
                        if (src) src.src = customSrc;
                        else audioEl.src = customSrc;
                        audioEl.load();
                    }
                } catch (_) {}
                audioEl.loop = true;
                audioEl.currentTime = 0;
                const p = audioEl.play();
                if (p && p.catch) {
                    p.catch(() => startWebAudioRingtone());
                }
                return;
            }
        } catch (_) {}

        startWebAudioRingtone();
    }

    function startWebAudioRingtone() {
        try {

            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;


            if (!AudioContext) {
                return;
            }


            ringtoneContext =
                new AudioContext();


            ringtoneGain =
                ringtoneContext
                    .createGain();


            ringtoneGain.gain.value =
                0.0001;


            ringtoneGain.connect(
                ringtoneContext.destination
            );


            const ring = () => {

                if (
                    !ringtoneContext ||
                    !ringtoneGain ||
                    !activeCall
                ) {
                    return;
                }


                const now =
                    ringtoneContext.currentTime;


                /*
                 * Two-tone premium ring.
                 */

                const osc1 =
                    ringtoneContext
                        .createOscillator();


                const osc2 =
                    ringtoneContext
                        .createOscillator();


                osc1.type =
                    "sine";

                osc2.type =
                    "sine";


                osc1.frequency.value =
                    660;

                osc2.frequency.value =
                    880;


                osc1.connect(
                    ringtoneGain
                );

                osc2.connect(
                    ringtoneGain
                );


                ringtoneGain.gain
                    .cancelScheduledValues(
                        now
                    );


                ringtoneGain.gain
                    .setValueAtTime(
                        0.0001,
                        now
                    );


                ringtoneGain.gain
                    .linearRampToValueAtTime(
                        0.055,
                        now + 0.05
                    );


                ringtoneGain.gain
                    .linearRampToValueAtTime(
                        0.0001,
                        now + 0.45
                    );


                ringtoneGain.gain
                    .setValueAtTime(
                        0.0001,
                        now + 0.62
                    );


                ringtoneGain.gain
                    .linearRampToValueAtTime(
                        0.055,
                        now + 0.67
                    );


                ringtoneGain.gain
                    .linearRampToValueAtTime(
                        0.0001,
                        now + 1.07
                    );


                osc1.start(
                    now
                );

                osc2.start(
                    now
                );


                osc1.stop(
                    now + 1.1
                );

                osc2.stop(
                    now + 1.1
                );
            };


            ring();


            ringtoneTimer =
                setInterval(
                    ring,
                    1800
                );


            /*
             * Browser autoplay policy.
             * Resume when possible.
             */

            if (
                ringtoneContext.state ===
                "suspended"
            ) {

                ringtoneContext
                    .resume()
                    .catch(() => {});
            }

        } catch (e) {

            error(
                "Ringtone:",
                e
            );
        }
    }


    /* ======================================================
       STOP RINGTONE
    ====================================================== */

    function stopRingtone() {

        try {
            const audioEl = document.getElementById("incomingCallRingtone");
            if (audioEl) {
                audioEl.pause();
                audioEl.currentTime = 0;
            }
        } catch (_) {}

        try {
            if (window.__vieworaCustomRing) {
                window.__vieworaCustomRing.pause();
                window.__vieworaCustomRing.currentTime = 0;
                window.__vieworaCustomRing = null;
            }
        } catch (_) {}

        if (ringtoneTimer) {

            clearInterval(
                ringtoneTimer
            );

            ringtoneTimer =
                null;
        }


        if (ringtoneGain) {

            try {

                ringtoneGain.gain.value =
                    0.0001;

            } catch (_) {}
        }


        if (ringtoneContext) {

            try {

                ringtoneContext.close();

            } catch (_) {}
        }


        ringtoneContext =
            null;

        ringtoneGain =
            null;
    }


    /* ======================================================
       ACCEPT
    ====================================================== */

    async function acceptIncoming() {

        if (!activeCall) {
            return;
        }


        const call =
            activeCall;


        const callId =
            call.callId;


        const data =
            call.data;


        hidePopup();


        /*
         * Prevent duplicate clicks.
         */

        activeCall =
            null;


        try {

            /*
             * Mark incoming call accepted.
             */

            await db
                .ref(
                    "incomingCalls/" +
                    currentUser.uid +
                    "/" +
                    callId
                )
                .update({

                    status:
                        "accepted",

                    acceptedAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                });


            /*
             * Open WebRTC call page.
             */

            const type =
                getCallType(
                    data.type
                );


            const caller =
                (data && data.callerId) ? data.callerId : "";
            const url =
                "call.html" +
                "?callId=" +
                encodeURIComponent(callId) +
                "&role=receiver" +
                "&type=" +
                encodeURIComponent(type) +
                (caller
                    ? "&callerId=" + encodeURIComponent(caller)
                    : "");

            window.location.href = url;


        } catch (e) {

            error(
                "Accept incoming call:",
                e
            );

            toast(
                "Unable to accept call."
            );
        }
    }


    /* ======================================================
       DECLINE
    ====================================================== */

    async function declineIncoming() {

        if (!activeCall) {
            return;
        }


        const call =
            activeCall;


        const callId =
            call.callId;


        activeCall =
            null;


        hidePopup();


        try {

            /*
             * Update actual call.
             */

            await db
                .ref(
                    "calls/" +
                    callId
                )
                .update({

                    status:
                        "rejected",

                    rejectedBy:
                        currentUser.uid,

                    rejectedAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP,

                    updatedAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                });


            /*
             * Update receiver inbox.
             */

            await db
                .ref(
                    "incomingCalls/" +
                    currentUser.uid +
                    "/" +
                    callId
                )
                .update({

                    status:
                        "rejected",

                    rejectedAt:
                        firebase.database
                            .ServerValue
                            .TIMESTAMP

                });


            log(
                "Incoming call declined:",
                callId
            );


        } catch (e) {

            error(
                "Decline call:",
                e
            );
        }
    }


    /* ======================================================
       WATCH CALL STATUS
    ====================================================== */

    function watchActiveCall(
        callId
    ) {

        if (!callId) {
            return;
        }


        db.ref(
            "calls/" +
            callId +
            "/status"
        ).on(
            "value",
            snapshot => {

                const status =
                    snapshot.val();


                if (
                    status === "ended" ||
                    status === "rejected" ||
                    status === "cancelled"
                ) {

                    if (
                        activeCall &&
                        activeCall.callId ===
                        callId
                    ) {

                        activeCall =
                            null;

                        hidePopup();
                    }


                    db.ref(
                        "calls/" +
                        callId +
                        "/status"
                    ).off();

                }

            }
        );
    }


    /* ======================================================
       INCOMING CALL LISTENER
    ====================================================== */

    function listenIncomingCalls() {

        if (
            !currentUser ||
            initialized
        ) {
            return;
        }


        initialized =
            true;


        incomingRef =
            db.ref(
                "incomingCalls/" +
                currentUser.uid
            );


        /*
         * New incoming call.
         */

        incomingRef.on(
            "child_added",
            async snapshot => {

                const callId = snapshot.key;
                const data = snapshot.val();
                if (!data) return;

                if (data.status !== "ringing") return;

                if (
                    data.receiverId &&
                    data.receiverId !== currentUser.uid
                ) {
                    return;
                }

                // Skip backlog on first connect — allow only brand-new rings (created < 8s ago)
                if (!incomingSyncDone) {
                    if (!isFreshRinging(data)) {
                        cleanupStaleCall(callId);
                        return;
                    }
                    const created = Number(data.createdAtMs || data.createdAt || 0);
                    if (!created || Date.now() - created > 8000) {
                        return; // historical
                    }
                    // fall through — brand new ring during connect
                }

                if (!isFreshRinging(data)) {
                    cleanupStaleCall(callId);
                    return;
                }

                if (processedCallIds.has(callId)) return;
                processedCallIds.add(callId);

                await showIncoming(callId, data);
                watchActiveCall(callId);
            }
        );


        /*
         * Existing ringing calls.
         *
         * This is useful if the page loads
         * while a call is already ringing.
         */

        // One-time scan: cleanup stale, show only fresh ring if any
        incomingRef.once("value", async snapshot => {
            const data = snapshot.val() || {};
            const entries = Object.entries(data);

            for (const [id, call] of entries) {
                if (!call) continue;
                if (call.status === "ringing" && !isFreshRinging(call)) {
                    cleanupStaleCall(id);
                }
            }

            const ringing = entries
                .filter(([id, call]) => call && isFreshRinging(call))
                .sort(
                    (a, b) =>
                        Number(b[1].createdAt || 0) -
                        Number(a[1].createdAt || 0)
                );

            incomingSyncDone = true;

            if (ringing.length && !activeCall) {
                const [id, call] = ringing[0];
                if (!processedCallIds.has(id)) {
                    processedCallIds.add(id);
                    await showIncoming(id, call);
                    watchActiveCall(id);
                }
            }
        });


        log(
            "Listening:",
            "incomingCalls/" +
            currentUser.uid
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

            window.showCallToast(
                message
            );

            return;
        }

        console.warn(
            "[VIEWORA CALL]",
            message
        );
    }


    /* ======================================================
       CLEANUP
    ====================================================== */

    function cleanup() {

        stopRingtone();


        if (
            incomingRef
        ) {

            incomingRef.off();

            incomingRef =
                null;
        }


        initialized =
            false;

        activeCall =
            null;
    }


    /* ======================================================
       PAGE VISIBILITY
    ====================================================== */

    document.addEventListener(
        "visibilitychange",
        () => {

            /*
             * If user comes back to the page
             * and a call is still ringing,
             * restart ringtone.
             */

            if (
                !document.hidden &&
                activeCall
            ) {

                startRingtone();
            }
        }
    );


    /* ======================================================
       BEFORE UNLOAD
    ====================================================== */

    window.addEventListener(
        "beforeunload",
        () => {

            stopRingtone();

            if (incomingRef) {
                incomingRef.off();
            }

        }
    );


    /* ======================================================
       PUBLIC API
    ====================================================== */

    window.VieworaCallListener = {

        getActiveCall:
            () => activeCall,

        hide:
            hidePopup,

        stopRingtone,

        cleanup

    };


    /* ======================================================
       INITIALIZE
    ====================================================== */

    async function init() {

        try {
            // Do not show global incoming popup on the call page itself
            const page = (location.pathname.split("/").pop() || "").toLowerCase();
            if (page.indexOf("call") !== -1) {
                log("On call page — global popup disabled.");
                return;
            }

            for (let i = 0; i < 8; i++) {
                auth = window.auth || auth;
                db = window.db || db;
                if (!auth && typeof firebase !== "undefined") {
                    try { auth = firebase.auth(); } catch (_) {}
                }
                if (!db && typeof firebase !== "undefined") {
                    try { db = firebase.database(); } catch (_) {}
                }
                if (auth && db) break;
                await new Promise((r) => setTimeout(r, 400));
            }
            if (!auth || !db) {
                error("Firebase Auth/Database unavailable for call listener.");
                return;
            }
            window.auth = auth;
            window.db = db;

            await waitForUser();

            listenIncomingCalls();

            log(
                "================================"
            );

            log(
                "VIEWORA GLOBAL CALL LISTENER"
            );

            log(
                "Incoming calls: READY"
            );

            log(
                "Ringtone: READY"
            );

            log(
                "Accept / Decline: READY"
            );

            log(
                "================================"
            );

        } catch (e) {

            error(
                "Listener initialization:",
                e
            );
        }
    }


    init();

})();