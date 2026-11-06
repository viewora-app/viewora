/*==========================================================
  Viewora Auth Gate — guest browse, signup for actions
  Upload: auth-gate.js (root)
  Include AFTER firebase.js, BEFORE index.js / shorts.js:

    <script src="auth-gate.js"></script>

  API:
    VieworaAuthGate.isLoggedIn()
    VieworaAuthGate.require(action)  // true if ok, else shows modal
    VieworaAuthGate.open(action)
==========================================================*/
(function (global) {
  "use strict";
  if (global.__VIEWORA_AUTH_GATE__) return;
  global.__VIEWORA_AUTH_GATE__ = true;

  var ACTIONS = {
    like: { title: "Like this", sub: "Sign up to like posts, videos and shorts" },
    comment: { title: "Join the conversation", sub: "Create an account to comment" },
    share: { title: "Share with friends", sub: "Sign up to share on Viewora" },
    follow: { title: "Follow creators", sub: "Sign up to follow and see their updates" },
    save: { title: "Save for later", sub: "Sign up to save posts and videos" },
    upload: { title: "Create on Viewora", sub: "Sign up to post, shoot shorts and go live" },
    message: { title: "Send a message", sub: "Sign up to chat with people" },
    profile: { title: "Your profile", sub: "Sign up to create your Viewora profile" },
    default: { title: "Join Viewora", sub: "Sign up to like, comment, follow and create" }
  };

  function currentUser() {
    try {
      if (typeof firebase !== "undefined" && firebase.auth) {
        return firebase.auth().currentUser || null;
      }
    } catch (_) {}
    try {
      if (global.auth && global.auth.currentUser) return global.auth.currentUser;
    } catch (_) {}
    return null;
  }

  function isLoggedIn() {
    var u = currentUser();
    return !!(u && u.uid);
  }

  function ensureStyles() {
    if (document.getElementById("vieworaAuthGateCss")) return;
    var css = document.createElement("style");
    css.id = "vieworaAuthGateCss";
    css.textContent =
      "#vieworaAuthGate{position:fixed;inset:0;z-index:2147482500;display:none;align-items:flex-end;justify-content:center;" +
      "background:rgba(0,0,0,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:0}" +
      "#vieworaAuthGate.open{display:flex}" +
      "#vieworaAuthGate .vagSheet{width:100%;max-width:480px;background:#121218;color:#fff;" +
      "border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));" +
      "box-shadow:0 -12px 40px rgba(0,0,0,.5);animation:vagUp .28s ease}" +
      "@keyframes vagUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}" +
      "#vieworaAuthGate .vagHandle{width:40px;height:4px;border-radius:99px;background:rgba(255,255,255,.2);margin:0 auto 14px}" +
      "#vieworaAuthGate .vagBrand{display:flex;align-items:center;gap:10px;margin-bottom:12px}" +
      "#vieworaAuthGate .vagBrand img{width:40px;height:40px;border-radius:12px;object-fit:cover;background:#1a1a22}" +
      "#vieworaAuthGate .vagBrand strong{font:700 16px/1.2 system-ui,sans-serif}" +
      "#vieworaAuthGate .vagBrand span{display:block;font:500 12px/1.2 system-ui,sans-serif;color:rgba(255,255,255,.55);margin-top:2px}" +
      "#vieworaAuthGate h3{margin:0 0 6px;font:700 20px/1.25 system-ui,sans-serif}" +
      "#vieworaAuthGate p{margin:0 0 16px;font:500 14px/1.45 system-ui,sans-serif;color:rgba(255,255,255,.65)}" +
      "#vieworaAuthGate .vagBtns{display:flex;flex-direction:column;gap:10px}" +
      "#vieworaAuthGate .vagPrimary{border:0;border-radius:14px;padding:14px 16px;font:700 15px system-ui,sans-serif;" +
      "color:#fff;background:linear-gradient(135deg,#7c3aed,#2563eb);cursor:pointer}" +
      "#vieworaAuthGate .vagSecondary{border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:13px 16px;" +
      "font:600 14px system-ui,sans-serif;color:#fff;background:rgba(255,255,255,.06);cursor:pointer}" +
      "#vieworaAuthGate .vagGhost{border:0;background:transparent;color:rgba(255,255,255,.5);font:500 13px system-ui,sans-serif;" +
      "padding:10px;cursor:pointer;margin-top:2px}" +
      "#vieworaAuthGate .vagFeatures{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 16px}" +
      "#vieworaAuthGate .vagFeat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);" +
      "border-radius:12px;padding:10px;font:500 12px/1.3 system-ui,sans-serif;color:rgba(255,255,255,.75)}" +
      "#vieworaAuthGate .vagFeat i{color:#a78bfa;margin-right:6px}";
    document.head.appendChild(css);
  }

  function ensureDom() {
    ensureStyles();
    if (document.getElementById("vieworaAuthGate")) return;
    var el = document.createElement("div");
    el.id = "vieworaAuthGate";
    el.innerHTML =
      '<div class="vagSheet" role="dialog" aria-modal="true" aria-labelledby="vagTitle">' +
      '<div class="vagHandle"></div>' +
      '<div class="vagBrand">' +
      '<img src="icon-192.png" alt="" onerror="this.style.display=\'none\'">' +
      "<div><strong>Viewora</strong><span>Watch free · join to engage</span></div>" +
      "</div>" +
      '<h3 id="vagTitle">Join Viewora</h3>' +
      '<p id="vagSub">Sign up to like, comment, follow and create</p>' +
      '<div class="vagFeatures">' +
      '<div class="vagFeat"><i class="fa-solid fa-play"></i>Watch videos</div>' +
      '<div class="vagFeat"><i class="fa-solid fa-magnifying-glass"></i>Search people</div>' +
      '<div class="vagFeat"><i class="fa-solid fa-heart"></i>Like & save</div>' +
      '<div class="vagFeat"><i class="fa-solid fa-user-plus"></i>Follow creators</div>' +
      "</div>" +
      '<div class="vagBtns">' +
      '<button type="button" class="vagPrimary" id="vagSignup">Create account</button>' +
      '<button type="button" class="vagSecondary" id="vagLogin">I already have an account</button>' +
      '<button type="button" class="vagGhost" id="vagDismiss">Continue watching</button>' +
      "</div></div>";
    (document.body || document.documentElement).appendChild(el);

    el.addEventListener("click", function (e) {
      if (e.target === el) close();
    });
    var su = document.getElementById("vagSignup");
    var li = document.getElementById("vagLogin");
    var di = document.getElementById("vagDismiss");
    if (su)
      su.onclick = function () {
        try {
          sessionStorage.setItem("viewora_auth_return", location.pathname.split("/").pop() || "index.html");
        } catch (_) {}
        location.href = "signup.html";
      };
    if (li)
      li.onclick = function () {
        try {
          sessionStorage.setItem("viewora_auth_return", location.pathname.split("/").pop() || "index.html");
        } catch (_) {}
        location.href = "login.html";
      };
    if (di) di.onclick = function () {
      close();
    };
  }

  function open(action) {
    ensureDom();
    var meta = ACTIONS[action] || ACTIONS.default;
    var t = document.getElementById("vagTitle");
    var s = document.getElementById("vagSub");
    if (t) t.textContent = meta.title;
    if (s) s.textContent = meta.sub;
    var el = document.getElementById("vieworaAuthGate");
    if (el) el.classList.add("open");
    try {
      document.body.style.overflow = "hidden";
    } catch (_) {}
  }

  function close() {
    var el = document.getElementById("vieworaAuthGate");
    if (el) el.classList.remove("open");
    try {
      document.body.style.overflow = "";
    } catch (_) {}
  }

  /**
   * @param {string} action like|comment|share|follow|save|upload|message|profile
   * @returns {boolean} true if user may continue
   */
  function require(action) {
    if (isLoggedIn()) return true;
    open(action || "default");
    return false;
  }

  // Global click capture for common gated actions (works across pages)
  function wireGlobalClicks() {
    document.addEventListener(
      "click",
      function (e) {
        if (isLoggedIn()) return;
        var t = e.target;
        if (!t || !t.closest) return;
        var gate = t.closest(
          '[data-action="like"],[data-action="comment"],[data-action="share"],[data-action="save"],' +
            '[data-action="follow"],.likeBtn,.like-btn,.commentBtn,.shareBtn,.saveBtn,.followBtn,' +
            "#followBtn,#uploadBtn,[data-auth-gate],a[href=\"upload.html\"],a[href=\"edit-post.html\"]," +
            'a[href="story-upload.html"],a[href="short_upload.html"],a[href="live.html"]'
        );
        if (!gate) return;
        var action = gate.getAttribute("data-action") || gate.getAttribute("data-auth-gate") || "";
        if (!action) {
          var href = (gate.getAttribute("href") || "").toLowerCase();
          if (/upload|edit-post|story-upload|short_upload|live/.test(href)) action = "upload";
          else if (/follow/i.test(gate.className || "") || gate.id === "followBtn") action = "follow";
          else if (/like/i.test(gate.className || "")) action = "like";
          else if (/comment/i.test(gate.className || "")) action = "comment";
          else if (/share/i.test(gate.className || "")) action = "share";
          else if (/save/i.test(gate.className || "")) action = "save";
          else action = "default";
        }
        e.preventDefault();
        e.stopPropagation();
        open(action);
      },
      true
    );
  }

  function boot() {
    ensureDom();
    wireGlobalClicks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.VieworaAuthGate = {
    isLoggedIn: isLoggedIn,
    require: require,
    open: open,
    close: close,
    currentUser: currentUser
  };
})(typeof window !== "undefined" ? window : this);
