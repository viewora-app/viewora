/*==========================================================
  Viewora Crash Guard (D — bugs / crash pass)
  - Global error + unhandledrejection handlers
  - Optional RTDB log: crashes/{uid|anon}/{id}
  - Soft UI: never leave user on pure white screen
  - Safe helpers: VieworaSafe.run / VieworaSafe.async

  Upload: root crash-guard.js
  Include FIRST after firebase.js (or early in <head>):
    <script src="crash-guard.js"></script>
==========================================================*/
(function (global) {
  "use strict";

  if (global.__VIEWORA_CRASH_GUARD__) return;
  global.__VIEWORA_CRASH_GUARD__ = true;

  var MAX_LOGS_PER_SESSION = 12;
  var logged = 0;
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

  function shouldSkip(sig) {
    var t = now();
    if (sig === lastSig && t - lastAt < 4000) return true;
    if (logged >= MAX_LOGS_PER_SESSION) return true;
    // ignore noisy browser noise
    if (/Script error\.?$/i.test(sig)) return true;
    if (/ResizeObserver loop/i.test(sig)) return true;
    if (/Loading CSS chunk/i.test(sig)) return true;
    if (/chrome-extension:\/\//i.test(sig)) return true;
    return false;
  }

  function writeCrash(payload) {
    try {
      if (typeof firebase === "undefined" || !firebase.database) return;
      var ref = firebase.database().ref("crashes/" + uidOrAnon()).push();
      ref.set(payload).catch(function () {});
    } catch (_) {}
  }

  function report(kind, err, extra) {
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
      var sig = signature(msg, src, line);
      if (shouldSkip(sig)) return;
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
        console.error("[Viewora Crash]", payload.kind, payload.message, payload);
      } catch (_) {}

      writeCrash(payload);
    } catch (_) {}
  }

  // Global JS errors
  global.onerror = function (message, source, lineno, colno, error) {
    report("onerror", error || message, {
      source: source,
      lineno: lineno,
      colno: colno
    });
    // do not block default logging
    return false;
  };

  // Unhandled promise rejections
  global.addEventListener("unhandledrejection", function (ev) {
    try {
      var r = ev && ev.reason;
      var msg = String((r && r.message) || r || "");
      // Non-fatal upload/crop/music noise — log only
      if (/crop|music|Cloudinary|upload preset|Login required to upload|hydrate like|NetworkError|AbortError/i.test(msg)) {
        console.warn("[Viewora] soft rejection", msg);
        try { ev.preventDefault(); } catch (_) {}
        return;
      }
    } catch (_) {}

    var reason = ev && ev.reason;
    report("unhandledrejection", reason || "rejection", {});
  });

  // Soft recovery: if body looks empty after load, show recovery bar
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
      document.body.appendChild(bar);
      var btn = document.getElementById("vieworaCrashReload");
      if (btn) {
        btn.onclick = function () {
          try {
            location.reload();
          } catch (_) {
            location.href = location.href;
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

  // Expose after several crashes in one session
  var hardCount = 0;
  var origReport = report;
  report = function (kind, err, extra) {
    origReport(kind, err, extra);
    hardCount += 1;
    if (hardCount >= 3) showRecovery();
  };

  // Safe runners
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

  // Kill stuck loaders globally (any page)
  function killStuckLoaders() {
    run(function () {
      document
        .querySelectorAll(
          "#loadingOverlay, .loadingOverlay, #pageLoader, .pageLoader, #bootLoader, .premiumLoading"
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
    setTimeout(killStuckLoaders, 2500);
    setTimeout(killStuckLoaders, 6000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
  global.addEventListener("load", function () {
    setTimeout(killStuckLoaders, 400);
  });

  global.VieworaSafe = {
    run: run,
    async: runAsync,
    report: function (err, extra) {
      report("manual", err, extra || {});
    },
    killLoaders: killStuckLoaders,
    showRecovery: showRecovery
  };

  try {
    console.log("[Viewora Crash Guard] active");
  } catch (_) {}
})(typeof window !== "undefined" ? window : this);
