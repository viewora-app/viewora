/* =========================================================
   VIEWORA — Security · Rate-limit · Production polish
   Include on every page AFTER firebase.js:

     <script src="firebase.js"></script>
     <script src="security.js"></script>

   window.VieworaSecurity API
========================================================= */
"use strict";

(function (global) {
  const IS_PROD =
    typeof location !== "undefined" &&
    /viewora-app\.github\.io|viewora\./i.test(location.hostname || "");

  /* -------------------- Logging -------------------- */
  const log = {
    debug: function () {
      if (!IS_PROD && console && console.log) console.log.apply(console, arguments);
    },
    warn: function () {
      if (console && console.warn) console.warn.apply(console, arguments);
    },
    error: function () {
      if (console && console.error) console.error.apply(console, arguments);
    }
  };

  if (IS_PROD) {
    // Soft mute noisy logs in production (keep errors)
    try {
      console.debug = function () {};
      // optional: keep console.log for critical ops — muted
      const _log = console.log;
      console.log = function () {
        if (arguments[0] && String(arguments[0]).indexOf("[VIEWORA") === 0) return;
        // allow through only if needed — mute generic
      };
    } catch (_) {}
  }

  /* -------------------- HTML / text sanitize -------------------- */

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripTags(str) {
    return String(str == null ? "" : str).replace(/<[^>]*>/g, "");
  }

  function sanitizeUrl(url) {
    const s = String(url || "").trim();
    if (!s) return "";
    // allow relative, https, http, blob, data:image
    if (/^(https?:|blob:|data:image\/|\/|\.\/)/i.test(s)) return s;
    if (s.startsWith("javascript:") || s.startsWith("vbscript:")) return "";
    return "";
  }

  function clampText(str, max) {
    const t = String(str == null ? "" : str);
    const m = max || 2000;
    return t.length > m ? t.slice(0, m) : t;
  }

  /* -------------------- Rate limiter (client) -------------------- */

  const buckets = Object.create(null);

  /**
   * @param {string} key
   * @param {{ max: number, windowMs: number }} opts
   * @returns {{ allowed: boolean, retryAfterMs: number, remaining: number }}
   */
  function rateLimit(key, opts) {
    const max = (opts && opts.max) || 10;
    const windowMs = (opts && opts.windowMs) || 10000;
    const now = Date.now();
    let b = buckets[key];
    if (!b || now - b.start > windowMs) {
      b = { start: now, count: 0 };
      buckets[key] = b;
    }
    b.count += 1;
    const allowed = b.count <= max;
    return {
      allowed: allowed,
      retryAfterMs: allowed ? 0 : Math.max(0, windowMs - (now - b.start)),
      remaining: Math.max(0, max - b.count)
    };
  }

  const LIMITS = {
    like: { max: 8, windowMs: 12000 },
    comment: { max: 6, windowMs: 20000 },
    message: { max: 12, windowMs: 15000 },
    follow: { max: 10, windowMs: 30000 },
    report: { max: 5, windowMs: 60000 },
    upload: { max: 5, windowMs: 60000 },
    call: { max: 4, windowMs: 60000 },
    search: { max: 20, windowMs: 15000 },
    withdraw: { max: 2, windowMs: 300000 }
  };

  function checkAction(action, uid) {
    const lim = LIMITS[action] || { max: 15, windowMs: 15000 };
    const key = (action || "gen") + ":" + (uid || "anon");
    const res = rateLimit(key, lim);
    if (!res.allowed) {
      return {
        allowed: false,
        message:
          "You're doing that too fast. Please wait a moment. Repeated abuse may lead to temporary limits (Viewora Community Guidelines)."
      };
    }
    return { allowed: true, remaining: res.remaining };
  }

  /* -------------------- Auth helpers -------------------- */

  function getAuth() {
    if (global.auth) return global.auth;
    try {
      return firebase.auth();
    } catch (_) {
      return null;
    }
  }

  function getDb() {
    if (global.db) return global.db;
    try {
      return firebase.database();
    } catch (_) {
      return null;
    }
  }

  function requireUser() {
    const a = getAuth();
    const u = a && a.currentUser;
    if (!u) {
      try {
        location.href = "login.html";
      } catch (_) {}
      return null;
    }
    return u;
  }

  function waitForAuth(timeoutMs) {
    return new Promise(function (resolve) {
      const a = getAuth();
      if (!a) {
        resolve(null);
        return;
      }
      if (a.currentUser) {
        resolve(a.currentUser);
        return;
      }
      const t = setTimeout(function () {
        unsub && unsub();
        resolve(a.currentUser || null);
      }, timeoutMs || 8000);
      const unsub = a.onAuthStateChanged(function (u) {
        clearTimeout(t);
        unsub && unsub();
        resolve(u || null);
      });
    });
  }

  /* -------------------- Block check -------------------- */

  async function isBlockedEither(me, other) {
    if (!me || !other || me === other) return false;
    const db = getDb();
    if (!db) return false;
    try {
      const [a, b] = await Promise.all([
        db.ref("blocks/" + me + "/" + other).once("value"),
        db.ref("blocks/" + other + "/" + me).once("value")
      ]);
      return a.exists() || b.exists();
    } catch (_) {
      return false;
    }
  }

  /* -------------------- Content guards -------------------- */

  function safeMessagePayload(raw) {
    const text = clampText(stripTags(raw && raw.text), 4000);
    return {
      text: text,
      type: ["text", "image", "video", "audio", "file"].indexOf(raw && raw.type) >= 0
        ? raw.type
        : "text",
      mediaUrl: sanitizeUrl(raw && (raw.mediaUrl || raw.url)),
      replyTo: raw && raw.replyTo ? String(raw.replyTo).slice(0, 64) : null
    };
  }

  function safeComment(text) {
    return clampText(stripTags(text), 1000);
  }

  /* -------------------- CSRF-ish action tokens (optional) -------------------- */

  function makeActionToken(scope) {
    const uid = (getAuth() && getAuth().currentUser && getAuth().currentUser.uid) || "x";
    const t = uid + ":" + (scope || "act") + ":" + Date.now() + ":" + Math.random().toString(36).slice(2);
    try {
      sessionStorage.setItem("viewora_act_" + (scope || "act"), t);
    } catch (_) {}
    return t;
  }

  function peekActionToken(scope) {
    try {
      return sessionStorage.getItem("viewora_act_" + (scope || "act")) || "";
    } catch (_) {
      return "";
    }
  }

  /* -------------------- Network / offline -------------------- */

  function isOnline() {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  function onConnectivity(cb) {
    if (typeof window === "undefined") return function () {};
    const up = function () {
      cb(true);
    };
    const down = function () {
      cb(false);
    };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return function () {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }

  /* -------------------- Toast (shared) -------------------- */

  function toast(msg, type) {
    try {
      if (global.VieworaToast) {
        global.VieworaToast(msg, type);
        return;
      }
    } catch (_) {}
    let el = document.getElementById("vieworaSecToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "vieworaSecToast";
      el.setAttribute(
        "style",
        "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:99999;max-width:90%;padding:12px 16px;border-radius:12px;background:#1a1b22;color:#fff;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.45);opacity:0;transition:opacity .2s;pointer-events:none"
      );
      document.body.appendChild(el);
    }
    el.style.background = type === "error" ? "#3b1220" : "#1a1b22";
    el.textContent = String(msg || "");
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.style.opacity = "0";
    }, 2800);
  }

  /* -------------------- Guarded action wrapper -------------------- */

  /**
   * await VieworaSecurity.guard('like', async () => { ... })
   */
  async function guard(action, fn, opts) {
    const user = (opts && opts.skipAuth) ? null : requireUser();
    if (!(opts && opts.skipAuth) && !user) {
      return { ok: false, reason: "auth" };
    }
    if (!isOnline()) {
      toast("You're offline. Check your connection.", "error");
      return { ok: false, reason: "offline" };
    }
    const check = checkAction(action, user && user.uid);
    if (!check.allowed) {
      toast(check.message, "error");
      return { ok: false, reason: "rate", message: check.message };
    }
    try {
      const result = await fn(user);
      return { ok: true, result: result };
    } catch (e) {
      log.error("[VieworaSecurity]", action, e);
      toast((e && e.message) || "Something went wrong", "error");
      return { ok: false, reason: "error", error: e };
    }
  }

  /* -------------------- Sensitive field mask -------------------- */

  function maskId(id) {
    const s = String(id || "");
    if (s.length < 8) return "••••";
    return s.slice(0, 4) + "…" + s.slice(-3);
  }

  function maskEmail(email) {
    const s = String(email || "");
    const i = s.indexOf("@");
    if (i < 1) return "••••";
    return s[0] + "•••" + s.slice(i);
  }

  /* -------------------- Global error boundary -------------------- */

  if (typeof window !== "undefined") {
    window.addEventListener("error", function (ev) {
      log.error("[window.error]", ev.message, ev.filename, ev.lineno);
    });
    window.addEventListener("unhandledrejection", function (ev) {
      log.error("[unhandledrejection]", ev.reason);
    });
  }

  /* -------------------- Public API -------------------- */

  const API = {
    IS_PROD: IS_PROD,
    log: log,
    escapeHtml: escapeHtml,
    stripTags: stripTags,
    sanitizeUrl: sanitizeUrl,
    clampText: clampText,
    rateLimit: rateLimit,
    checkAction: checkAction,
    LIMITS: LIMITS,
    requireUser: requireUser,
    waitForAuth: waitForAuth,
    isBlockedEither: isBlockedEither,
    safeMessagePayload: safeMessagePayload,
    safeComment: safeComment,
    makeActionToken: makeActionToken,
    peekActionToken: peekActionToken,
    isOnline: isOnline,
    onConnectivity: onConnectivity,
    toast: toast,
    guard: guard,
    maskId: maskId,
    maskEmail: maskEmail
  };

  global.VieworaSecurity = API;

  // Alias
  global.VS = API;
})(typeof window !== "undefined" ? window : globalThis);
