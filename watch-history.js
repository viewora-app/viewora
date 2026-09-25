/* Viewora watch-history — aggressive save for mobile WebView (Acode) */
(function (w) {
  "use strict";

  var LS_KEY = "viewora_watch_history";
  var boundFlag = "data-vwh-bound";
  var lastSave = {};

  function clamp01(n) {
    n = Number(n);
    if (!isFinite(n) || n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  function loadArr() {
    var keys = [LS_KEY];
    try {
      var u =
        w.firebase &&
        firebase.auth &&
        firebase.auth().currentUser &&
        firebase.auth().currentUser.uid;
      if (u) keys.unshift(LS_KEY + "_" + u);
    } catch (_) {}
    for (var i = 0; i < keys.length; i++) {
      try {
        var a = JSON.parse(localStorage.getItem(keys[i]) || "[]");
        if (Array.isArray(a) && a.length) return a;
      } catch (_) {}
    }
    try {
      var b = JSON.parse(sessionStorage.getItem(LS_KEY) || "[]");
      if (Array.isArray(b) && b.length) return b;
    } catch (_) {}
    return [];
  }

  function persist(arr) {
    arr = (arr || []).slice(0, 150);
    var raw = JSON.stringify(arr);
    try {
      localStorage.setItem(LS_KEY, raw);
    } catch (e) {
      console.warn("[VWH] localStorage", e);
    }
    try {
      sessionStorage.setItem(LS_KEY, raw);
    } catch (_) {}
    try {
      var u =
        w.firebase &&
        firebase.auth &&
        firebase.auth().currentUser &&
        firebase.auth().currentUser.uid;
      if (u) localStorage.setItem(LS_KEY + "_" + u, raw);
    } catch (_) {}
    return arr.length;
  }

  function saveFirebase(row) {
    try {
      if (!w.firebase || !firebase.auth || !firebase.database) return;
      var u = firebase.auth().currentUser;
      if (!u) {
        // retry when auth becomes ready
        try {
          firebase.auth().onAuthStateChanged(function (user) {
            if (user) {
              var key =
                String(row.type || "video") +
                "_" +
                String(row.videoId).replace(/[^a-zA-Z0-9_-]/g, "_");
              firebase
                .database()
                .ref("users/" + user.uid + "/watchHistory/" + key)
                .update(row);
            }
          });
        } catch (_) {}
        return;
      }
      var key =
        String(row.type || "video") +
        "_" +
        String(row.videoId).replace(/[^a-zA-Z0-9_-]/g, "_");
      firebase
        .database()
        .ref("users/" + u.uid + "/watchHistory/" + key)
        .update(row)
        .then(function () {
          console.log("[VWH] firebase saved", key);
        })
        .catch(function (e) {
          console.warn("[VWH] firebase write fail", e);
        });
    } catch (e) {
      console.warn("[VWH] fb", e);
    }
  }

  w.VieworaRecordWatch = function (entry) {
    try {
      if (!entry) return false;
      var id = entry.videoId || entry.id || entry.shortId || entry.key;
      if (!id) return false;
      var type = String(entry.type || "video").toLowerCase();
      if (type === "shorts") type = "short";
      var progress = clamp01(
        entry.progress != null ? entry.progress : 0.12
      );

      var arr = loadArr();
      var prev = null;
      for (var i = 0; i < arr.length; i++) {
        if (
          arr[i] &&
          String(arr[i].videoId) === String(id) &&
          String(arr[i].type || "video") === type
        ) {
          prev = arr[i];
          break;
        }
      }
      if (prev && (prev.progress || 0) > progress) progress = prev.progress;

      var row = {
        videoId: String(id),
        type: type,
        title: String(entry.title || entry.caption || "Video").slice(0, 160),
        thumb: String(
          entry.thumb ||
            entry.thumbnail ||
            (prev && prev.thumb) ||
            entry.poster ||
            ""
        ),
        ownerName: String(
          entry.ownerName || entry.username || entry.userName || ""
        ).replace(/^@/, ""),
        progress: progress,
        at: Date.now()
      };

      arr = arr.filter(function (x) {
        return !(
          x &&
          String(x.videoId) === String(id) &&
          String(x.type || "video") === type
        );
      });
      arr.unshift(row);
      var n = persist(arr);
      saveFirebase(row);
      console.log(
        "[VieworaRecordWatch] OK",
        row.type,
        row.videoId,
        Math.round(row.progress * 100) + "%",
        "total=" + n
      );
      try {
        w.dispatchEvent(
          new CustomEvent("viewora-history-updated", { detail: row })
        );
      } catch (_) {}
      return true;
    } catch (e) {
      console.warn("[VieworaRecordWatch]", e);
      return false;
    }
  };

  w.VieworaWatchProgress = function (entry, cur, dur) {
    try {
      if (!entry) return;
      var id = entry.videoId || entry.id || entry.shortId;
      if (!id) return;
      cur = Number(cur) || 0;
      dur = Number(dur) || 0;
      var p = dur > 0 && cur > 0 ? clamp01(cur / dur) : 0.12;
      var k = (entry.type || "video") + "_" + id;
      var now = Date.now();
      if (lastSave[k] && now - lastSave[k] < 1500 && p < 0.95) return;
      lastSave[k] = now;
      w.VieworaRecordWatch(Object.assign({}, entry, { videoId: id, progress: p }));
    } catch (_) {}
  };

  w.VieworaGetWatchHistory = function () {
    return loadArr();
  };

  function detectType() {
    try {
      var h = (location.href || "").toLowerCase();
      if (h.indexOf("short") !== -1) return "short";
    } catch (_) {}
    return "video";
  }

  function metaFrom(videoEl) {
    var id = "";
    var type = detectType();
    var title = type === "short" ? "Short" : "Video";
    var thumb = "";
    var owner = "";

    try {
      var el = videoEl;
      for (var i = 0; i < 10 && el; i++) {
        if (el.getAttribute) {
          id =
            id ||
            el.getAttribute("data-short-id") ||
            el.getAttribute("data-video-id") ||
            el.getAttribute("data-id") ||
            "";
        }
        if (el.dataset) {
          id =
            id ||
            el.dataset.shortId ||
            el.dataset.videoId ||
            el.dataset.id ||
            "";
          if (el.dataset.title) title = el.dataset.title;
        }
        if (
          el.classList &&
          (el.classList.contains("shortCard") ||
            el.classList.contains("video-card"))
        ) {
          if (/short/i.test(el.className)) type = "short";
        }
        el = el.parentElement;
      }
    } catch (_) {}

    if (!id) {
      try {
        var p = new URLSearchParams(location.search);
        id = p.get("id") || p.get("videoId") || p.get("shortId") || "";
      } catch (_) {}
    }

    try {
      var t =
        document.getElementById("videoTitle") ||
        document.querySelector(".shortTitle, .video-title, .caption");
      if (t && t.textContent) title = t.textContent.trim().slice(0, 120) || title;
    } catch (_) {}

    try {
      if (videoEl) thumb = videoEl.getAttribute("poster") || thumb;
    } catch (_) {}

    if (!id && videoEl) {
      try {
        var src = videoEl.currentSrc || videoEl.src || "";
        if (src) {
          var m = src.match(/\/([A-Za-z0-9_-]{6,})(?:\.[a-z0-9]+)?(?:\?|#|$)/);
          id = m ? "src_" + m[1] : "src_" + src.length;
        }
      } catch (_) {}
    }
    if (!id) {
      id =
        "loc_" +
        String(location.pathname + location.search)
          .replace(/\W+/g, "_")
          .slice(0, 48);
    }

    return {
      videoId: String(id),
      type: type,
      title: title,
      thumb: thumb,
      ownerName: owner
    };
  }

  /* ---- core: save if video looks "watched" ---- */
  var playWall = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  var playWallFallback = [];

  function wallGet(el) {
    if (playWall) return playWall.get(el) || 0;
    for (var i = 0; i < playWallFallback.length; i++) {
      if (playWallFallback[i].el === el) return playWallFallback[i].t;
    }
    return 0;
  }
  function wallSet(el, t) {
    if (playWall) playWall.set(el, t);
    else playWallFallback.push({ el: el, t: t });
  }

  function consider(videoEl, force) {
    try {
      if (!videoEl) return;
      var paused = !!videoEl.paused;
      var ended = !!videoEl.ended;
      var cur = Number(videoEl.currentTime) || 0;
      var dur = Number(videoEl.duration) || 0;
      var started = wallGet(videoEl);
      var wall = started ? (Date.now() - started) / 1000 : 0;

      if (!paused && !ended && !started) {
        wallSet(videoEl, Date.now());
        started = Date.now();
        wall = 0;
      }
      if (paused && !force) {
        /* keep wall */
      }

      var watched = cur >= 0.5 || wall >= 0.6 || ended || force;
      if (!watched) return;

      var meta = metaFrom(videoEl);
      var p = 0.12;
      if (ended) p = 1;
      else if (dur > 0 && cur > 0) p = clamp01(cur / dur);
      else if (wall > 0) p = Math.min(0.6, 0.1 + wall / 40);

      var k = meta.type + "_" + meta.videoId;
      var now = Date.now();
      if (!force && lastSave[k] && now - lastSave[k] < 2000 && p < 0.95) return;
      lastSave[k] = now;
      w.VieworaRecordWatch(Object.assign({}, meta, { progress: p }));
    } catch (e) {
      console.warn("[VWH] consider", e);
    }
  }

  function onPlay(e) {
    var v = e.target;
    if (!v || v.tagName !== "VIDEO") return;
    wallSet(v, Date.now());
    setTimeout(function () {
      consider(v, false);
    }, 1000);
  }
  function onTime(e) {
    var v = e.target;
    if (!v || v.tagName !== "VIDEO") return;
    if ((v.currentTime || 0) >= 0.5) consider(v, false);
  }
  function onPause(e) {
    var v = e.target;
    if (!v || v.tagName !== "VIDEO") return;
    consider(v, false);
  }
  function onEnded(e) {
    var v = e.target;
    if (!v || v.tagName !== "VIDEO") return;
    consider(v, true);
  }

  // Capture phase — works even if page stops propagation
  document.addEventListener("play", onPlay, true);
  document.addEventListener("playing", onPlay, true);
  document.addEventListener("timeupdate", onTime, true);
  document.addEventListener("pause", onPause, true);
  document.addEventListener("ended", onEnded, true);

  // Poll every 1s — WebView safety net
  setInterval(function () {
    try {
      var list = document.querySelectorAll("video");
      for (var i = 0; i < list.length; i++) {
        var v = list[i];
        if (!v.paused && !v.ended) {
          if (!wallGet(v)) wallSet(v, Date.now());
          consider(v, false);
        }
      }
    } catch (_) {}
  }, 1000);

  // When page hides, flush
  document.addEventListener(
    "visibilitychange",
    function () {
      if (document.hidden) {
        try {
          document.querySelectorAll("video").forEach(function (v) {
            consider(v, false);
          });
        } catch (_) {}
      }
    },
    true
  );

  console.log("[watch-history] armed (capture + 1s poll)");
})(window);
