/*==========================================================
  Viewora Crash Guard v2
  - Ignores non-fatal mobile noise (FCM, permissions, network)
  - Recovery bar only for real repeated hard failures
  - Never blocks the app on first-open / new device

  Upload: root crash-guard.js (overwrite)
==========================================================*/
(function (global) {
  "use strict";

  if (global.__VIEWORA_CRASH_GUARD_V2__) return;
  global.__VIEWORA_CRASH_GUARD_V2__ = true;
  global.__VIEWORA_CRASH_GUARD__ = true;

  var MAX_LOGS_PER_SESSION = 20;
  var HARD_THRESHOLD = 6; // was 3 — too aggressive on new phones
  var logged = 0;
  var hardCount = 0;
  var lastSig = "";
  var lastAt = 0;

  function now() {
    return Date.now();
  }

  function pageName() {
    try {
      var p = (location.pathname || "").split("/").pop() || "index.html";
      return p || "index.html";
    } catch (_) {
      return "unknown";
    }
  }

  function uidOrAnon() {
    try {
      if (typeof firebase !== "undefined" && firebase.auth) {
        var u = firebase.auth().currentUser;
        if (u && u.uid) return u.uid;
      }
    } catch (_) {}
    try {
      var id = localStorage.getItem("viewora_crash_anon");
      if (!id) {
        id = "a" + Math.random().toString(36).slice(2, 12);
        localStorage.setItem("viewora_crash_anon", id);
      }
      return id;
    } catch (_) {
      return "anon";
    }
  }

  function signature(msg, src, line) {
    return String(msg || "").slice(0, 120) + "|" + String(src || "").slice(-40) + "|" + String(line || "");
  }

  /** Non-fatal patterns common on first open / mobile Chrome */
  function isSoftError(msg, src) {
    var m = String(msg || "");
    var s = String(src || "");
    var soft = [
      /Script error\.?$/i,
      /ResizeObserver loop/i,
      /Loading CSS chunk/i,
      /chrome-extension:\/\//i,
      /moz-extension:\/\//i,
      /Permission denied/i,
      /permission.?denied/i,
      /Notifications? permission/i,
      /Notification\.requestPermission/i,
      /messaging\/|FirebaseError.*messaging/i,
      /Failed to register a ServiceWorker/i,
      /ServiceWorker/i,
      /push service/i,
      /PushManager/i,
      /The operation is insecure/i,
      /Only secure origins/i,
      /NetworkError/i,
      /Failed to fetch/i,
      /Load failed/i,
      /net::ERR_/i,
      /AbortError/i,
      /QuotaExceeded/i,
      /Storage quota/i,
      /IDBDatabase/i,
      /IndexedDB/i,
      /play\(\) failed/i,
      /NotAllowedError/i,
      /NotSupportedError/i,
      /user denied/i,
      /blocked by client/i,
      /Cloudinary/i,
      /upload preset/i,
      /Login required to upload/i,
      /hydrate like/i,
      /crop|music trim/i,
      /MAXIMUM_CALL_STACK/i, // sometimes noise from third party
      /__gCrWeb/i,
      /Java object is gone/i,
      /onGetPixelsOutOfMemory/i
    ];
    for (var i = 0; i < soft.length; i++) {
      if (soft[i].test(m) || soft[i].test(s)) return true;
    }
    // fcm.js / messaging path
    if (/fcm\.js|firebase-messaging/i.test(s)) return true;
    return false;
  }

  function shouldSkip(sig, msg, src) {
    var t = now();
    if (sig === lastSig && t - lastAt < 4000) return true;
    if (logged >= MAX_LOGS_PER_SESSION) return true;
    if (isSoftError(msg, src)) return true;
    return false;
  }

  function writeCrash(payload) {
    try {
      if (typeof firebase === "undefined" || !firebase.database) return;
      var ref = firebase.database().ref("crashes/" + uidOrAnon()).push();
      ref.set(payload).catch(function () {});
    } catch (_) {}
  }

  function report(kind, err, extra, forceHard) {
    try {
      var msg = "";
      var stack = "";
      if (err && typeof err === "object") {
        msg = err.message || String(err);
        stack = err.stack || "";
      } else {
        msg = String(err || "unknown");
      }
      var src = (extra && extra.source) || "";
      var line = (extra && extra.lineno) || 0;
      var col = (extra && extra.colno) || 0;

      // Soft errors: console only, never recovery bar
      if (!forceHard && isSoftError(msg, src)) {
        try {
          console.warn("[Viewora soft]", kind, msg);
        } catch (_) {}
        return;
      }

      var sig = signature(msg, src, line);
      if (shouldSkip(sig, msg, src)) return;
      lastSig = sig;
      lastAt = now();
      logged += 1;

      var payload = {
        kind: kind || "error",
        message: String(msg).slice(0, 500),
        stack: String(stack).slice(0, 2000),
        source: String(src).slice(0, 300),
        lineno: line || 0,
        colno: col || 0,
        page: pageName(),
        href: String((location && location.href) || "").slice(0, 300),
        ua: String((navigator && navigator.userAgent) || "").slice(0, 220),
        online: !!(navigator && navigator.onLine),
        ts: now()
      };

      try {
        console.error("[Viewora Crash]", payload.kind, payload.message);
      } catch (_) {}

      writeCrash(payload);

      hardCount += 1;
      if (hardCount >= HARD_THRESHOLD) showRecovery();
    } catch (_) {}
  }

  global.onerror = function (message, source, lineno, colno, error) {
    report("onerror", error || message, {
      source: source,
      lineno: lineno,
      colno: colno
    });
    return false;
  };

  global.addEventListener("unhandledrejection", function (ev) {
    try {
      var r = ev && ev.reason;
      var msg = String((r && r.message) || r || "");
      if (isSoftError(msg, "")) {
        try {
          console.warn("[Viewora] soft rejection", msg);
        } catch (_) {}
        try {
          ev.preventDefault();
        } catch (_) {}
        return;
      }
    } catch (_) {}
    var reason = ev && ev.reason;
    report("unhandledrejection", reason || "rejection", {});
  });

  function softRecoveryUI() {
    try {
      if (document.getElementById("vieworaCrashBar")) return;
      var bar = document.createElement("div");
      bar.id = "vieworaCrashBar";
      bar.setAttribute("role", "alert");
      bar.style.cssText =
        "display:none;position:fixed;left:12px;right:12px;bottom:88px;z-index:2147483000;" +
        "padding:12px 14px;border-radius:14px;background:rgba(24,16,40,.96);" +
        "border:1px solid rgba(168,85,247,.35);color:#f5e8ff;font:600 13px/1.35 system-ui,sans-serif;" +
        "box-shadow:0 12px 40px rgba(0,0,0,.45);align-items:center;justify-content:space-between;gap:10px";
      bar.innerHTML =
        '<span style="flex:1">Something went wrong. Reload to continue.</span>' +
        '<button type="button" id="vieworaCrashReload" style="border:0;border-radius:10px;padding:8px 12px;' +
        'background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;font-weight:700;cursor:pointer">Reload</button>';
      (document.body || document.documentElement).appendChild(bar);
      var btn = document.getElementById("vieworaCrashReload");
      if (btn) {
        btn.onclick = function () {
          try {
            hardCount = 0;
            logged = 0;
            sessionStorage.setItem("viewora_force_reload", "1");
          } catch (_) {}
          try {
            location.reload();
          } catch (_) {
            location.href = location.href.split("#")[0];
          }
        };
      }
    } catch (_) {}
  }

  function showRecovery() {
    try {
      softRecoveryUI();
      var bar = document.getElementById("vieworaCrashBar");
      if (bar) bar.style.display = "flex";
    } catch (_) {}
  }

  function hideRecovery() {
    try {
      var bar = document.getElementById("vieworaCrashBar");
      if (bar) bar.style.display = "none";
      hardCount = 0;
    } catch (_) {}
  }

  function run(fn, fallback) {
    try {
      return typeof fn === "function" ? fn() : undefined;
    } catch (e) {
      report("safe.run", e, {});
      if (typeof fallback === "function") {
        try {
          return fallback(e);
        } catch (_) {}
      }
      return undefined;
    }
  }

  function runAsync(fn, fallback) {
    try {
      var r = typeof fn === "function" ? fn() : null;
      if (r && typeof r.then === "function") {
        return r.catch(function (e) {
          report("safe.async", e, {});
          if (typeof fallback === "function") return fallback(e);
          return null;
        });
      }
      return Promise.resolve(r);
    } catch (e) {
      report("safe.async", e, {});
      if (typeof fallback === "function") {
        try {
          return Promise.resolve(fallback(e));
        } catch (_) {}
      }
      return Promise.resolve(null);
    }
  }

  function killStuckLoaders() {
    run(function () {
      document
        .querySelectorAll(
          "#loadingOverlay, .loadingOverlay, #pageLoader, .pageLoader, #bootLoader, .premiumLoading, #feedSkeleton, .feedSkeleton"
        )
        .forEach(function (el) {
          el.classList.add("hidden", "loaderHide");
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("pointer-events", "none", "important");
        });
      try {
        document.body.classList.add("feed-ready");
      } catch (_) {}
    });
  }

  function boot() {
    softRecoveryUI();
    // Never auto-show bar on boot
    hideRecovery();
    setTimeout(killStuckLoaders, 2000);
    setTimeout(killStuckLoaders, 5000);
    setTimeout(killStuckLoaders, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
  global.addEventListener("load", function () {
    setTimeout(killStuckLoaders, 400);
    // If feed has content, hide recovery
    setTimeout(function () {
      try {
        if (document.querySelector(".vieworaPostCard, .longVideoCard, #videoFeed, #postFeed")) {
          hideRecovery();
        }
      } catch (_) {}
    }, 3000);
  });

  global.VieworaSafe = {
    run: run,
    async: runAsync,
    report: function (err, extra) {
      report("manual", err, extra || {});
    },
    killLoaders: killStuckLoaders,
    showRecovery: showRecovery,
    hideRecovery: hideRecovery
  };

  try {
    console.log("[Viewora Crash Guard v2] active");
  } catch (_) {}
})(typeof window !== "undefined" ? window : this);
