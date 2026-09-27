/**
 * Viewora WebRTC Full-Mesh (max 6 peers)
 * --------------------------------------
 * Each participant maintains a direct RTCPeerConnection to every other peer.
 * Signaling: Firebase RTDB
 *   calls/{callId}/participants/{uid}
 *   calls/{callId}/mesh/{toUid}/{fromUid}/offer|answer
 *   calls/{callId}/mesh/{toUid}/{fromUid}/candidates/{pushId}
 *
 * Negotiation: lower uid is the "offerer" for the pair (no glare).
 * Usage (from call.js):
 *   VieworaMesh.init({ db, callId, uid, localStream, callType, max: 6, onRemoteStream, onPeerLeft })
 *   VieworaMesh.join(profile)
 *   VieworaMesh.setLocalStream(stream)
 *   VieworaMesh.leave()
 */
(function (global) {
  "use strict";

  var MAX_DEFAULT = 6;
  var peers = Object.create(null); // remoteUid -> { pc, stream, polite }
  var cfg = null;
  var participantsRef = null;
  var meshRoot = null;
  var unsubscribers = [];
  var joined = false;

  function log() {
    try {
      if (global.console && console.log) {
        console.log.apply(console, ["[VieworaMesh]"].concat([].slice.call(arguments)));
      }
    } catch (_) {}
  }

  function buildRtcConfig() {
    if (typeof global.buildRtcConfig === "function") {
      try {
        return global.buildRtcConfig();
      } catch (_) {}
    }
    var servers = [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun.cloudflare.com:3478"
        ]
      }
    ];
    try {
      var custom = global.VieworaTurnConfig;
      if (!custom) {
        var raw = localStorage.getItem("viewora_turn_config");
        if (raw) custom = JSON.parse(raw);
      }
      if (custom && custom.urls) {
        servers.push({
          urls: Array.isArray(custom.urls) ? custom.urls : [custom.urls],
          username: custom.username || "",
          credential: custom.credential || ""
        });
      } else {
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
    } catch (_) {}
    return {
      iceServers: servers,
      iceCandidatePoolSize: 12,
      bundlePolicy: "max-bundle"
    };
  }

  /** Lower UID offers — deterministic, avoids glare */
  function shouldOffer(localUid, remoteUid) {
    return String(localUid) < String(remoteUid);
  }

  function signalPath(toUid, fromUid) {
    return meshRoot.child(toUid).child(fromUid);
  }

  function closePeer(remoteUid) {
    var entry = peers[remoteUid];
    if (!entry) return;
    try {
      entry.pc.ontrack = null;
      entry.pc.onicecandidate = null;
      entry.pc.onconnectionstatechange = null;
      entry.pc.close();
    } catch (_) {}
    delete peers[remoteUid];
    if (cfg && typeof cfg.onPeerLeft === "function") {
      try {
        cfg.onPeerLeft(remoteUid);
      } catch (_) {}
    }
  }

  function attachLocalTracks(pc) {
    if (!cfg || !cfg.localStream) return;
    var senders = pc.getSenders();
    cfg.localStream.getTracks().forEach(function (track) {
      var already = senders.some(function (s) {
        return s.track && s.track.id === track.id;
      });
      if (!already) {
        try {
          pc.addTrack(track, cfg.localStream);
        } catch (e) {
          log("addTrack", e);
        }
      }
    });
  }

  async function createPeer(remoteUid) {
    if (!cfg || remoteUid === cfg.uid) return null;
    if (peers[remoteUid]) return peers[remoteUid];

    var count = Object.keys(peers).length;
    var max = (cfg.max || MAX_DEFAULT) - 1; // exclude self
    if (count >= max) {
      log("peer limit reached");
      return null;
    }

    var pc = new RTCPeerConnection(buildRtcConfig());
    var remoteStream = new MediaStream();
    var entry = {
      pc: pc,
      stream: remoteStream,
      offerer: shouldOffer(cfg.uid, remoteUid)
    };
    peers[remoteUid] = entry;

    attachLocalTracks(pc);

    pc.ontrack = function (ev) {
      var tracks = [];
      if (ev.streams && ev.streams[0]) {
        tracks = ev.streams[0].getTracks();
      } else if (ev.track) {
        tracks = [ev.track];
      }
      tracks.forEach(function (tr) {
        if (!remoteStream.getTracks().some(function (x) { return x.id === tr.id; })) {
          remoteStream.addTrack(tr);
        }
      });
      if (cfg && typeof cfg.onRemoteStream === "function") {
        cfg.onRemoteStream(remoteUid, remoteStream);
      }
    };

    pc.onicecandidate = function (ev) {
      if (!ev.candidate || !meshRoot) return;
      signalPath(remoteUid, cfg.uid)
        .child("candidates")
        .push(ev.candidate.toJSON ? ev.candidate.toJSON() : {
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid,
          sdpMLineIndex: ev.candidate.sdpMLineIndex
        })
        .catch(function () {});
    };

    pc.onconnectionstatechange = function () {
      var st = pc.connectionState;
      log("pc", remoteUid, st);
      if (st === "failed") {
        tryRestart(remoteUid);
      }
      if (st === "closed") {
        closePeer(remoteUid);
      }
    };

    // Listen for signals from this remote toward us
    listenSignalsFrom(remoteUid);

    if (entry.offerer) {
      await makeOffer(remoteUid);
    }

    return entry;
  }

  async function makeOffer(remoteUid) {
    var entry = peers[remoteUid];
    if (!entry) return;
    try {
      var offer = await entry.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: !!(cfg && cfg.callType === "video")
      });
      await entry.pc.setLocalDescription(offer);
      await signalPath(remoteUid, cfg.uid).child("offer").set({
        type: offer.type,
        sdp: offer.sdp,
        at: Date.now()
      });
      log("offer →", remoteUid);
    } catch (e) {
      log("makeOffer error", e);
    }
  }

  async function tryRestart(remoteUid) {
    var entry = peers[remoteUid];
    if (!entry || !entry.offerer) return;
    try {
      if (entry.pc.restartIce) entry.pc.restartIce();
      var offer = await entry.pc.createOffer({ iceRestart: true });
      await entry.pc.setLocalDescription(offer);
      await signalPath(remoteUid, cfg.uid).child("offer").set({
        type: offer.type,
        sdp: offer.sdp,
        iceRestart: true,
        at: Date.now()
      });
    } catch (e) {
      log("restart failed", e);
    }
  }

  function listenSignalsFrom(remoteUid) {
    if (!meshRoot || !cfg) return;
    var path = signalPath(cfg.uid, remoteUid);

    var offRef = path.child("offer");
    var offHandler = async function (snap) {
      var offer = snap.val();
      if (!offer || !offer.sdp) return;
      var entry = peers[remoteUid] || (await createPeer(remoteUid));
      if (!entry) return;
      try {
        var desc = { type: offer.type, sdp: offer.sdp };
        if (entry.pc.signalingState === "stable" && !offer.iceRestart) {
          // already negotiated
          if (entry.pc.currentRemoteDescription) return;
        }
        await entry.pc.setRemoteDescription(new RTCSessionDescription(desc));
        var answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        await signalPath(remoteUid, cfg.uid).child("answer").set({
          type: answer.type,
          sdp: answer.sdp,
          at: Date.now()
        });
        log("answer →", remoteUid);
      } catch (e) {
        log("handle offer error", e);
      }
    };
    offRef.on("value", offHandler);
    unsubscribers.push(function () {
      offRef.off("value", offHandler);
    });

    var ansRef = path.child("answer");
    var ansHandler = async function (snap) {
      var answer = snap.val();
      if (!answer || !answer.sdp) return;
      var entry = peers[remoteUid];
      if (!entry) return;
      try {
        if (entry.pc.signalingState !== "have-local-offer" && !answer.iceRestart) {
          if (entry.pc.currentRemoteDescription) return;
        }
        await entry.pc.setRemoteDescription(
          new RTCSessionDescription({ type: answer.type, sdp: answer.sdp })
        );
        log("answer ←", remoteUid);
      } catch (e) {
        log("handle answer error", e);
      }
    };
    ansRef.on("value", ansHandler);
    unsubscribers.push(function () {
      ansRef.off("value", ansHandler);
    });

    var candRef = path.child("candidates");
    var candHandler = async function (snap) {
      var c = snap.val();
      if (!c) return;
      var entry = peers[remoteUid];
      if (!entry) return;
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        /* ignore early candidates */
      }
    };
    candRef.on("child_added", candHandler);
    unsubscribers.push(function () {
      candRef.off("child_added", candHandler);
    });
  }

  function onParticipants(snap) {
    if (!cfg || !joined) return;
    var map = snap.val() || {};
    var ids = Object.keys(map);
    // Create peers for new members
    ids.forEach(function (id) {
      if (id === cfg.uid) return;
      if (!peers[id]) {
        createPeer(id);
      }
    });
    // Close peers who left
    Object.keys(peers).forEach(function (id) {
      if (!map[id]) closePeer(id);
    });
    if (cfg && typeof cfg.onParticipants === "function") {
      try {
        cfg.onParticipants(map);
      } catch (_) {}
    }
  }

  function init(options) {
    leave(true);
    cfg = options || {};
    if (!cfg.db || !cfg.callId || !cfg.uid) {
      throw new Error("VieworaMesh.init requires db, callId, uid");
    }
    meshRoot = cfg.db.ref("calls/" + cfg.callId + "/mesh");
    participantsRef = cfg.db.ref("calls/" + cfg.callId + "/participants");
    log("init", cfg.callId, cfg.uid);
  }

  async function join(profile) {
    if (!cfg || !participantsRef) return;
    joined = true;
    var payload = Object.assign(
      {
        uid: cfg.uid,
        joinedAt: Date.now(),
        type: cfg.callType || "video"
      },
      profile || {}
    );
    await participantsRef.child(cfg.uid).set(payload);
    try {
      participantsRef.child(cfg.uid).onDisconnect().remove();
    } catch (_) {}

    participantsRef.on("value", onParticipants);
    unsubscribers.push(function () {
      participantsRef.off("value", onParticipants);
    });

    // Bootstrap existing members
    var snap = await participantsRef.once("value");
    onParticipants(snap);
  }

  function setLocalStream(stream) {
    if (!cfg) return;
    cfg.localStream = stream;
    Object.keys(peers).forEach(function (id) {
      attachLocalTracks(peers[id].pc);
    });
  }

  function replaceTrack(kind, track) {
    Object.keys(peers).forEach(function (id) {
      var pc = peers[id].pc;
      var sender = pc.getSenders().find(function (s) {
        return s.track && s.track.kind === kind;
      });
      if (sender && track) {
        sender.replaceTrack(track).catch(function () {});
      }
    });
  }

  function getPeers() {
    return peers;
  }

  function leave(silent) {
    joined = false;
    unsubscribers.forEach(function (fn) {
      try {
        fn();
      } catch (_) {}
    });
    unsubscribers = [];
    Object.keys(peers).forEach(closePeer);
    if (!silent && cfg && participantsRef && cfg.uid) {
      try {
        participantsRef.child(cfg.uid).remove();
      } catch (_) {}
    }
    if (!silent && meshRoot && cfg && cfg.uid) {
      try {
        meshRoot.child(cfg.uid).remove();
      } catch (_) {}
    }
    participantsRef = null;
    meshRoot = null;
  }

  global.VieworaMesh = {
    init: init,
    join: join,
    setLocalStream: setLocalStream,
    replaceTrack: replaceTrack,
    getPeers: getPeers,
    leave: leave,
    MAX: MAX_DEFAULT
  };
})(typeof window !== "undefined" ? window : globalThis);
