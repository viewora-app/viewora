/* Viewora Settings — Instagram / YouTube style, Firebase-synced */
(function () {
  "use strict";

  var PREF_KEY = "viewora_settings_v2";
  var THEME_KEY = "viewora_theme";
  var auth = null;
  var db = null;
  var user = null;
  var profile = {};
  var prefs = {};
  var choiceState = { key: null, value: null };
  var storyPrivacyDraft = "everyone";
  var otpState = { purpose: null, target: null, code: null, sessionId: null, channel: null };
  var contactDraft = {
    email1: "", email1Verified: false,
    email2: "", email2Verified: false,
    phone1: "", phone1Verified: false,
    phone2: "", phone2Verified: false
  };
  var forgotChannel = "device";
  var phoneConfirmResult = null; // Firebase ConfirmationResult
  var phoneVerificationId = null;
  var recaptchaVerifier = null;
  var pendingPhoneSlot = null;

  var FONT_KEY = "viewora_font";
  var LANG_KEY = "viewora_lang";


  function $(id) {
    return document.getElementById(id);
  }
  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(function () {
      t.classList.remove("show");
    }, 2200);
  }
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyFontGlobal(size) {
    size = size || getPref("font", "default");
    try { localStorage.setItem(FONT_KEY, size); } catch (_) {}
    try {
      if (window.VieworaTheme && VieworaTheme.setFont) {
        VieworaTheme.setFont(size);
        return;
      }
    } catch (_) {}
    var px = size === "xlarge" ? "19px" : size === "large" ? "17px" : "16px";
    document.documentElement.style.fontSize = px;
    document.documentElement.setAttribute("data-font", size);
    if (document.body) {
      document.body.style.fontSize = size === "default" ? "" : px;
      document.body.setAttribute("data-font", size);
    }
  }
  function applyLangGlobal(lang) {
    lang = lang || getPref("lang", "en");
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
    try {
      if (window.VieworaTheme && VieworaTheme.setLang) {
        VieworaTheme.setLang(lang);
        return;
      }
    } catch (_) {}
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("data-lang", lang);
  }
  function genOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  async function writeOtpSession(purpose, target, channel) {
    var code = genOtp();
    var sessionId = "otp_" + Date.now();
    var payload = {
      code: code,
      purpose: purpose,
      target: target || "",
      channel: channel || "device",
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000
    };
    if (db && user) {
      try {
        await db.ref("users/" + user.uid + "/otpSessions/" + sessionId).set(payload);
      } catch (_) {}
    }
    otpState = {
      purpose: purpose,
      target: target || "",
      code: code,
      sessionId: sessionId,
      channel: channel || "device"
    };
    return otpState;
  }
  function verifyOtpInput(inputCode) {
    var c = String(inputCode || "").trim();
    if (!otpState.code || c !== String(otpState.code)) return false;
    if (otpState.sessionId && db && user) {
      try {
        db.ref("users/" + user.uid + "/otpSessions/" + otpState.sessionId).update({
          used: true,
          usedAt: Date.now()
        });
      } catch (_) {}
    }
    return true;
  }

  function e164Phone(raw) {
    var d = String(raw || "").replace(/[^\d+]/g, "");
    if (!d) return "";
    if (d.charAt(0) !== "+") {
      // default India if 10-digit
      var digits = d.replace(/\D/g, "");
      if (digits.length === 10) d = "+91" + digits;
      else if (digits.length === 12 && digits.indexOf("91") === 0) d = "+" + digits;
      else d = "+" + digits;
    }
    return d;
  }

  function ensureRecaptcha() {
    return new Promise(function (resolve, reject) {
      try {
        if (!auth) return reject(new Error("Auth not ready"));
        var el = $("recaptchaContainer");
        if (!el) {
          el = document.createElement("div");
          el.id = "recaptchaContainer";
          document.body.appendChild(el);
        }
        if (recaptchaVerifier) {
          try { recaptchaVerifier.clear(); } catch (_) {}
          recaptchaVerifier = null;
        }
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptchaContainer", {
          size: "invisible",
          callback: function () {},
          "expired-callback": function () {
            try { recaptchaVerifier.clear(); } catch (_) {}
            recaptchaVerifier = null;
          }
        });
        recaptchaVerifier.render().then(function () {
          resolve(recaptchaVerifier);
        }).catch(reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function sendFirebasePhoneOtp(phoneRaw, slot) {
    var phone = e164Phone(phoneRaw);
    if (!phone || phone.length < 10) throw new Error("Invalid phone number");
    var verifier = await ensureRecaptcha();
    pendingPhoneSlot = slot || null;
    // Prefer PhoneAuthProvider.verifyPhoneNumber — SMS without replacing session
    try {
      var provider = new firebase.auth.PhoneAuthProvider(auth);
      phoneVerificationId = await provider.verifyPhoneNumber(phone, verifier);
      phoneConfirmResult = null;
      return { method: "verificationId", phone: phone };
    } catch (e1) {
      // Fallback: linkWithPhoneNumber if logged in
      if (user && user.linkWithPhoneNumber) {
        phoneConfirmResult = await user.linkWithPhoneNumber(phone, verifier);
        phoneVerificationId = phoneConfirmResult.verificationId || null;
        return { method: "link", phone: phone };
      }
      throw e1;
    }
  }

  async function confirmFirebasePhoneOtp(code) {
    code = String(code || "").trim();
    if (!code || code.length < 6) throw new Error("Enter 6-digit OTP");
    if (phoneConfirmResult && phoneConfirmResult.confirm) {
      await phoneConfirmResult.confirm(code);
      return true;
    }
    if (phoneVerificationId) {
      var cred = firebase.auth.PhoneAuthProvider.credential(phoneVerificationId, code);
      // Just validate credential — don't force sign-in switch if possible
      try {
        if (user && user.linkWithCredential) {
          await user.linkWithCredential(cred);
        } else {
          await auth.signInWithCredential(cred);
        }
      } catch (e) {
        // credential already linked / exists — treat OTP as valid if error is account-exists
        var codeErr = (e && e.code) || "";
        if (
          codeErr.indexOf("credential-already-in-use") !== -1 ||
          codeErr.indexOf("provider-already-linked") !== -1 ||
          codeErr.indexOf("email-already-in-use") !== -1
        ) {
          return true;
        }
        // invalid code
        if (codeErr.indexOf("invalid-verification-code") !== -1 || codeErr.indexOf("code-expired") !== -1) {
          throw e;
        }
        // still mark verified for contact book if SMS was correct path
        throw e;
      }
      return true;
    }
    // fallback local otp
    if (verifyOtpInput(code)) return true;
    throw new Error("Invalid OTP");
  }

  async function sendFirebaseEmailOtp(email, purpose) {
    email = String(email || "").trim();
    if (!email || email.indexOf("@") < 1) throw new Error("Invalid email");
    if (purpose === "password_reset") {
      await firebase.auth().sendPasswordResetEmail(email);
      return { method: "reset_email" };
    }
    // Verify / change email — Firebase sends real email
    if (user && user.email && email.toLowerCase() === String(user.email).toLowerCase()) {
      await user.sendEmailVerification();
      return { method: "verify_email" };
    }
    if (user && typeof user.verifyBeforeUpdateEmail === "function") {
      await user.verifyBeforeUpdateEmail(email);
      return { method: "verify_before_update" };
    }
    // Last resort: password reset style mail so something arrives in Gmail
    await firebase.auth().sendPasswordResetEmail(email);
    return { method: "reset_email_fallback" };
  }

  function maskContact(v) {
    v = String(v || "");
    if (v.indexOf("@") !== -1) {
      var parts = v.split("@");
      var name = parts[0] || "";
      var show = name.slice(0, 2) + "***";
      return show + "@" + (parts[1] || "");
    }
    if (v.length > 4) return v.slice(0, 3) + "****" + v.slice(-2);
    return "***";
  }
  function setBadge(id, state) {
    var el = $(id);
    if (!el) return;
    if (state === "verified") {
      el.textContent = "Verified";
      el.className = "badge ok";
    } else if (state === "pending") {
      el.textContent = "Pending";
      el.className = "badge pending";
    } else {
      el.textContent = state || "—";
      el.className = "badge";
    }
  }


  function loadLocalPrefs() {
    try {
      prefs = JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {};
    } catch (_) {
      prefs = {};
    }
  }
  function getPref(key, def) {
    return Object.prototype.hasOwnProperty.call(prefs, key) ? prefs[key] : def;
  }
  function setPref(key, val) {
    prefs[key] = val;
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch (_) {}
    syncPrefToFirebase(key, val);
  }
  function syncPrefToFirebase(key, val) {
    try {
      if (!db || !user) return;
      var patch = {};
      patch["appSettings/" + key] = val;
      // map important privacy to root user fields other pages read
      if (key === "private_account") {
        patch.isPrivate = !!val;
        patch.private = !!val;
        patch.privacy = val ? "private" : "public";
      }
      if (key === "msg_who") patch.whoCanMessage = val;
      if (key === "comment_who") patch.whoCanComment = val;
      if (key === "follow_who") patch.whoCanFollow = val;
      if (key === "mentions") patch.whoCanMention = val;
      if (key === "story_privacy") patch.storyPrivacy = val;
      if (key === "activity_status") patch.showActivity = !!val;
      if (key === "read_receipts") patch.readReceipts = !!val;
      db.ref("users/" + user.uid).update(patch).catch(function () {});
    } catch (_) {}
  }
  async function pullFirebasePrefs() {
    if (!db || !user) return;
    try {
      var snap = await db.ref("users/" + user.uid).once("value");
      var p = snap.val() || {};
      profile = p;
      var s = p.appSettings || {};
      Object.keys(s).forEach(function (k) {
        prefs[k] = s[k];
      });
      if (p.isPrivate != null) prefs.private_account = !!p.isPrivate;
      if (p.whoCanMessage) prefs.msg_who = p.whoCanMessage;
      if (p.whoCanComment) prefs.comment_who = p.whoCanComment;
      if (p.whoCanFollow) prefs.follow_who = p.whoCanFollow;
      if (p.whoCanMention) prefs.mentions = p.whoCanMention;
      if (p.storyPrivacy) prefs.story_privacy = p.storyPrivacy;
      if (p.showActivity != null) prefs.activity_status = !!p.showActivity;
      if (p.readReceipts != null) prefs.read_receipts = !!p.readReceipts;
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
      } catch (_) {}
    } catch (_) {}
  }

  /* Views */
  function showView(name) {
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.toggle("active", v.id === "view" + name);
    });
    window.scrollTo(0, 0);
  }
  function showMain() {
    showView("Main");
  }
  function showCategory(id, title) {
    $("catTitle").textContent = title;
    $("catBody").innerHTML = buildCategory(id);
    $("catBody").setAttribute("data-cat-id", id);
    wireCategoryBody(id);
    showView("Category");
  }

  /* Theme */
  function resolveTheme(mode) {
    if (mode === "system") {
      try {
        return window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
      } catch (_) {
        return "dark";
      }
    }
    return mode === "light" ? "light" : "dark";
  }
  function applyTheme(mode) {
    mode = mode || "dark";
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (_) {}
    var resolved = resolveTheme(mode);
    document.documentElement.setAttribute("data-theme", resolved);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
      meta.setAttribute("content", resolved === "dark" ? "#05050a" : "#f3f4f6");
    if (window.VieworaTheme && VieworaTheme.set) {
      try {
        VieworaTheme.set(resolved);
      } catch (_) {}
    }
  }
  try {
    applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  } catch (_) {
    applyTheme("dark");
  }

  function sw(on) {
    return (
      '<span class="switch' + (on ? " on" : "") + '"><i></i></span>'
    );
  }
  function rowIcon(cls, icon) {
    return (
      '<span class="rowIcon ' +
      (cls || "") +
      '"><i class="fa-solid fa-' +
      icon +
      '"></i></span>'
    );
  }
  function chev() {
    return (
      '<span class="rowRight"><i class="fa-solid fa-chevron-right"></i></span>'
    );
  }
  function valChev(v) {
    return (
      '<span class="rowRight"><span class="value">' +
      esc(v) +
      '</span><i class="fa-solid fa-chevron-right"></i></span>'
    );
  }

  function labelMap(key, def) {
    var maps = {
      follow_who: {
        everyone: "Everyone",
        approval: "Approval required"
      },
      msg_who: {
        everyone: "Everyone",
        followers: "Followers",
        following: "People you follow",
        off: "No one"
      },
      comment_who: {
        everyone: "Everyone",
        followers: "Followers",
        off: "Off"
      },
      mentions: {
        everyone: "Everyone",
        followers: "People you follow",
        off: "Off"
      },
      media_dl: {
        wifi: "Wi‑Fi only",
        always: "Always",
        never: "Never"
      },
      upload_q: {
        high: "High",
        medium: "Medium",
        data: "Data saver"
      },
      video_q: {
        auto: "Auto",
        "1080": "1080p",
        "720": "720p",
        "480": "480p"
      },
      font: {
        default: "Default",
        large: "Large",
        xlarge: "Extra large"
      },
      lang: {
        en: "English",
        hi: "हिन्दी",
        de: "Deutsch",
        sa: "संस्कृतम्",
        ja: "日本語",
        zh: "中文"
      },
      story_privacy: {
        everyone: "Everyone",
        followers: "Followers",
        close: "Close friends",
        hide: "Hide from selected"
      }
    };
    var m = maps[key] || {};
    var v = getPref(key, def);
    return m[v] || v || def;
  }

  function linkRow(href, icon, cls, title, desc) {
    return (
      '<a class="row" href="' +
      href +
      '">' +
      rowIcon(cls, icon) +
      '<span class="rowBody"><span class="rowTitle">' +
      esc(title) +
      "</span>" +
      (desc ? '<span class="rowDesc">' + esc(desc) + "</span>" : "") +
      "</span>" +
      chev() +
      "</a>"
    );
  }
  function actionRow(id, icon, cls, title, desc, right) {
    return (
      '<button type="button" class="row" id="' +
      id +
      '">' +
      rowIcon(cls, icon) +
      '<span class="rowBody"><span class="rowTitle">' +
      esc(title) +
      "</span>" +
      (desc ? '<span class="rowDesc">' + esc(desc) + "</span>" : "") +
      "</span>" +
      (right || "") +
      "</button>"
    );
  }
  function toggleRow(key, icon, cls, title, desc, on) {
    return (
      '<button type="button" class="row" data-toggle-key="' +
      key +
      '">' +
      rowIcon(cls, icon) +
      '<span class="rowBody"><span class="rowTitle">' +
      esc(title) +
      "</span>" +
      (desc ? '<span class="rowDesc">' + esc(desc) + "</span>" : "") +
      '</span><span class="rowRight">' +
      sw(!!on) +
      "</span></button>"
    );
  }
  function choiceRow(key, icon, cls, title, valueLabel) {
    return (
      '<button type="button" class="row" data-choice-key="' +
      key +
      '">' +
      rowIcon(cls, icon) +
      '<span class="rowBody"><span class="rowTitle">' +
      esc(title) +
      "</span></span>" +
      valChev(valueLabel) +
      "</button>"
    );
  }
  function plainRow(icon, cls, title, value) {
    return (
      '<div class="row">' +
      rowIcon(cls, icon) +
      '<span class="rowBody"><span class="rowTitle">' +
      esc(title) +
      "</span></span>" +
      '<span class="rowRight"><span class="value">' +
      esc(value) +
      "</span></span></div>"
    );
  }
  function themeBlock() {
    var cur = localStorage.getItem(THEME_KEY) || "dark";
    return (
      '<div class="themeChips" style="padding:14px">' +
      '<button type="button" class="themeChip' +
      (cur === "system" ? " active" : "") +
      '" data-theme-set="system">System</button>' +
      '<button type="button" class="themeChip' +
      (cur === "light" ? " active" : "") +
      '" data-theme-set="light">Light</button>' +
      '<button type="button" class="themeChip' +
      (cur === "dark" ? " active" : "") +
      '" data-theme-set="dark">Dark</button>' +
      "</div>"
    );
  }

  function buildCategory(id) {
    var html = '<div class="group"><div class="groupCard">';

    /* 1–6 Account */
    if (id === "account") {
      html += linkRow("profile.html", "user", "", "Profile", "View your public profile");
      html += linkRow(
        "edit-profile.html",
        "pen",
        "blue",
        "Edit Profile",
        "Photo, name, bio, links"
      );
      html += actionRow(
        "btnUsername",
        "at",
        "",
        "Username",
        "Change your @handle",
        valChev("@" + (profile.username || profile.userName || "user"))
      );
      html += actionRow(
        "btnEmailPhone",
        "envelope",
        "green",
        "Email & Phone",
        "Verify contact details",
        valChev(
          (function () {
            var e = (user && user.email) || profile.email || "—";
            if (e !== "—" && (user && user.emailVerified)) return e + " ✓";
            return e;
          })()
        )
      );
      html += actionRow(
        "btnPassword",
        "lock",
        "orange",
        "Password & Security",
        "Update password",
        chev()
      );
      html += plainRow(
        "shield-halved",
        "gold",
        "Account Status",
        profile.disabled || profile.suspended
          ? "Restricted"
          : profile.banned
          ? "Suspended"
          : "Active"
      );
      html += linkRow(
        "account-delete.html",
        "user-slash",
        "red",
        "Deactivate / Delete Account",
        "Temporary or permanent"
      );
    }

    /* 7–13 Privacy */
    if (id === "privacy") {
      html += toggleRow(
        "private_account",
        "user-lock",
        "",
        "Private Account",
        "Approve followers to see content",
        !!(profile.isPrivate || profile.private || getPref("private_account", false))
      );
      html += choiceRow(
        "follow_who",
        "user-plus",
        "blue",
        "Who can follow me",
        labelMap("follow_who", "everyone")
      );
      html += choiceRow(
        "msg_who",
        "comment",
        "pink",
        "Who can message me",
        labelMap("msg_who", "followers")
      );
      html += choiceRow(
        "comment_who",
        "comments",
        "green",
        "Who can comment",
        labelMap("comment_who", "everyone")
      );
      html += choiceRow(
        "mentions",
        "at",
        "orange",
        "Mentions & Tags",
        labelMap("mentions", "everyone")
      );
      html += actionRow(
        "btnStoryPrivacy",
        "circle-notch",
        "pink",
        "Story Privacy",
        "Default story audience",
        valChev(labelMap("story_privacy", "everyone"))
      );
      html += linkRow(
        "blocked-users.html",
        "ban",
        "red",
        "Blocked Accounts",
        "Manage blocked users"
      );
    }

    /* 14 Notifications */
    if (id === "notifications") {
      html += toggleRow(
        "push",
        "bell",
        "",
        "Push Notifications",
        "Master switch",
        getPref("push", true)
      );
      html += toggleRow(
        "notif_messages",
        "message",
        "pink",
        "Messages",
        "",
        getPref("notif_messages", true)
      );
      html += toggleRow(
        "notif_likes",
        "heart",
        "red",
        "Likes",
        "",
        getPref("notif_likes", true)
      );
      html += toggleRow(
        "notif_comments",
        "comment",
        "blue",
        "Comments",
        "",
        getPref("notif_comments", true)
      );
      html += toggleRow(
        "notif_followers",
        "user-plus",
        "green",
        "Followers",
        "",
        getPref("notif_followers", true)
      );
      html += toggleRow(
        "notif_mentions",
        "at",
        "orange",
        "Mentions",
        "",
        getPref("notif_mentions", true)
      );
      html += toggleRow(
        "notif_stories",
        "circle",
        "pink",
        "Stories",
        "",
        getPref("notif_stories", true)
      );
      html += toggleRow(
        "notif_shorts",
        "clapperboard",
        "",
        "Shorts",
        "",
        getPref("notif_shorts", true)
      );
      html += toggleRow(
        "notif_email",
        "envelope",
        "gray",
        "Email Notifications",
        "",
        getPref("notif_email", false)
      );
    }

    /* 15–17 Messages & Calls */
    if (id === "messages") {
      html += linkRow(
        "messages.html",
        "inbox",
        "pink",
        "Message Requests",
        "Pending chats from new people"
      );
      html += choiceRow(
        "msg_who",
        "comment-dots",
        "blue",
        "Message Privacy",
        labelMap("msg_who", "followers")
      );
      html += toggleRow(
        "group_invites",
        "users",
        "green",
        "Group Invitations",
        "",
        getPref("group_invites", true)
      );
      html += toggleRow(
        "voice_calls",
        "phone",
        "",
        "Voice Calls",
        "Allow incoming voice calls",
        getPref("voice_calls", true)
      );
      html += toggleRow(
        "video_calls",
        "video",
        "pink",
        "Video Calls",
        "Allow incoming video calls",
        getPref("video_calls", true)
      );
      html += toggleRow(
        "call_notif",
        "bell",
        "orange",
        "Call Notifications",
        "Ringtone & banners",
        getPref("call_notif", true)
      );
      html += choiceRow(
        "media_dl",
        "download",
        "gray",
        "Media Auto-download",
        labelMap("media_dl", "wifi")
      );
      html += toggleRow(
        "read_receipts",
        "check-double",
        "blue",
        "Read Receipts",
        "Let others see when you read",
        getPref("read_receipts", true)
      );
      html += toggleRow(
        "activity_status",
        "circle",
        "green",
        "Activity Status",
        "Show when you're active",
        getPref("activity_status", true)
      );
    }

    /* 18 Content & Media */
    if (id === "content") {
      html += choiceRow(
        "upload_q",
        "cloud-arrow-up",
        "",
        "Upload Quality",
        labelMap("upload_q", "high")
      );
      html += choiceRow(
        "video_q",
        "film",
        "blue",
        "Video Quality",
        labelMap("video_q", "auto")
      );
      html += toggleRow(
        "data_saver",
        "leaf",
        "green",
        "Data Saver",
        "Lower quality on mobile data",
        getPref("data_saver", false)
      );
      html += toggleRow(
        "autoplay",
        "play",
        "orange",
        "Autoplay",
        "",
        getPref("autoplay", true)
      );
      html += toggleRow(
        "save_original",
        "image",
        "",
        "Save Original Media",
        "",
        getPref("save_original", true)
      );
      html += toggleRow(
        "download_perm",
        "file-arrow-down",
        "pink",
        "Download Permissions",
        "",
        getPref("download_perm", true)
      );
    }

    /* 19–21 Safety */
    if (id === "safety") {
      html += linkRow(
        "report.html",
        "flag",
        "orange",
        "Report a Problem",
        "Content or account issues"
      );
      html += linkRow(
        "report.html?tab=mine",
        "triangle-exclamation",
        "red",
        "Reported Content",
        "Your past reports"
      );
      html += linkRow(
        "community-guidelines.html",
        "book",
        "",
        "Community Guidelines",
        "What is allowed on Viewora"
      );
      html += linkRow(
        "blocked-users.html",
        "ban",
        "gray",
        "Blocked Accounts",
        ""
      );
      html += toggleRow(
        "sensitive",
        "eye",
        "pink",
        "Sensitive Content Controls",
        "",
        getPref("sensitive", false)
      );
      html += toggleRow(
        "security_alerts",
        "shield",
        "gold",
        "Security Alerts",
        "Login and unusual activity",
        getPref("security_alerts", true)
      );
    }

    /* 22–23 Appearance + Language */
    if (id === "appearance") {
      html +=
        '</div></div><div class="group"><div class="groupTitle">Theme</div><div class="groupCard">';
      html += themeBlock();
      html +=
        '</div></div><div class="group"><div class="groupCard">';
      html += choiceRow(
        "font",
        "text-height",
        "blue",
        "Font Size",
        labelMap("font", "default")
      );
      html += choiceRow(
        "lang",
        "language",
        "green",
        "Language",
        labelMap("lang", "en")
      );
    }

    /* 24 Data & Storage */
    if (id === "app") {
      html += actionRow("btnDataUsage", "chart-pie", "", "Data Usage", "", chev());
      html += actionRow(
        "btnStorage",
        "hard-drive",
        "blue",
        "Storage",
        "",
        chev()
      );
      html += actionRow(
        "btnClearCache",
        "broom",
        "orange",
        "Clear Cache",
        "Free up space",
        chev()
      );
      html += toggleRow(
        "link_previews",
        "link",
        "green",
        "Link Previews",
        "",
        getPref("link_previews", true)
      );
      html += actionRow(
        "btnA11y",
        "universal-access",
        "gray",
        "Accessibility",
        "",
        chev()
      );
    }

    /* 25–29 About */
    if (id === "about") {
      html += linkRow("about.html", "circle-info", "", "About Viewora", "");
      html += linkRow(
        "terms.html",
        "file-contract",
        "blue",
        "Terms of Service",
        ""
      );
      html += linkRow(
        "privacy-policy.html",
        "user-shield",
        "green",
        "Privacy Policy",
        ""
      );
      html += linkRow(
        "copyright.html",
        "copyright",
        "gray",
        "Copyright Policy",
        ""
      );
      html += linkRow(
        "contact.html",
        "headset",
        "pink",
        "Contact Support",
        ""
      );
      html += linkRow("help.html", "circle-question", "", "Help Center", "");
      html += plainRow("code-branch", "", "App Version", "Viewora 1.0.0");
    }

    if (id === "appearance") {
      /* theme + font groups still open — close them */
      html += "</div></div>";
    } else {
      html += "</div></div>";
    }

    if (id === "account") {
      html += '<div class="group"><div class="groupCard">';
      html += actionRow(
        "btnLogoutAll",
        "mobile-screen",
        "red",
        "Log Out of All Devices",
        "",
        ""
      );
      html += "</div></div>";
    }

    return html;
  }

  /* Choice definitions */
  var CHOICES = {
    follow_who: {
      title: "Who can follow me",
      desc: "Control follow requests",
      options: [
        { value: "everyone", label: "Everyone" },
        { value: "approval", label: "Approval required" }
      ],
      def: "everyone"
    },
    msg_who: {
      title: "Who can message me",
      desc: "Message request rules",
      options: [
        { value: "everyone", label: "Everyone" },
        { value: "followers", label: "Followers" },
        { value: "following", label: "People you follow" },
        { value: "off", label: "No one" }
      ],
      def: "followers"
    },
    comment_who: {
      title: "Who can comment",
      desc: "On your posts, shorts & videos",
      options: [
        { value: "everyone", label: "Everyone" },
        { value: "followers", label: "Followers" },
        { value: "off", label: "Off" }
      ],
      def: "everyone"
    },
    mentions: {
      title: "Mentions & Tags",
      desc: "Who can @mention you",
      options: [
        { value: "everyone", label: "Everyone" },
        { value: "followers", label: "People you follow" },
        { value: "off", label: "Off" }
      ],
      def: "everyone"
    },
    media_dl: {
      title: "Media Auto-download",
      desc: "When on Wi‑Fi / mobile data",
      options: [
        { value: "wifi", label: "Wi‑Fi only" },
        { value: "always", label: "Always" },
        { value: "never", label: "Never" }
      ],
      def: "wifi"
    },
    upload_q: {
      title: "Upload Quality",
      desc: "Posts, shorts & videos",
      options: [
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "data", label: "Data saver" }
      ],
      def: "high"
    },
    video_q: {
      title: "Video Quality",
      desc: "Playback preference",
      options: [
        { value: "auto", label: "Auto" },
        { value: "1080", label: "1080p" },
        { value: "720", label: "720p" },
        { value: "480", label: "480p" }
      ],
      def: "auto"
    },
    font: {
      title: "Font Size",
      desc: "App text size",
      options: [
        { value: "default", label: "Default" },
        { value: "large", label: "Large" },
        { value: "xlarge", label: "Extra large" }
      ],
      def: "default"
    },
    lang: {
      title: "Language",
      desc: "App language — applies across Viewora",
      options: [
        { value: "en", label: "English" },
        { value: "hi", label: "हिन्दी (Hindi)" },
        { value: "de", label: "Deutsch (German)" },
        { value: "sa", label: "संस्कृतम् (Sanskrit)" },
        { value: "ja", label: "日本語 (Japanese)" },
        { value: "zh", label: "中文 (Chinese)" }
      ],
      def: "en"
    }
  };

  function openChoice(key) {
    var conf = CHOICES[key];
    if (!conf) return;
    var cur = getPref(key, conf.def);
    choiceState.key = key;
    choiceState.value = cur;
    $("choiceTitle").textContent = conf.title;
    $("choiceDesc").textContent = conf.desc || "";
    var box = $("choiceOptions");
    box.innerHTML = conf.options
      .map(function (o) {
        return (
          '<button type="button" class="radioRow' +
          (o.value === cur ? " selected" : "") +
          '" data-val="' +
          esc(o.value) +
          '"><span class="radio"></span><span class="lab">' +
          esc(o.label) +
          "</span></button>"
        );
      })
      .join("");
    box.querySelectorAll(".radioRow").forEach(function (btn) {
      btn.addEventListener("click", function () {
        box.querySelectorAll(".radioRow").forEach(function (b) {
          b.classList.remove("selected");
        });
        btn.classList.add("selected");
        choiceState.value = btn.getAttribute("data-val");
      });
    });
    showView("Choice");
  }

  $("choiceSave").addEventListener("click", function () {
    if (!choiceState.key) return;
    setPref(choiceState.key, choiceState.value);
    if (choiceState.key === "font") applyFontGlobal(choiceState.value);
    if (choiceState.key === "lang") applyLangGlobal(choiceState.value);
    toast(
      choiceState.key === "lang" && choiceState.value === "hi"
        ? "भाषा सहेजी गई"
        : "Saved"
    );
    var openId = $("catBody").getAttribute("data-cat-id");
    if (openId) {
      $("catBody").innerHTML = buildCategory(openId);
      $("catBody").setAttribute("data-cat-id", openId);
      wireCategoryBody(openId);
      showView("Category");
    } else {
      showMain();
    }
  });
  $("choiceBack").addEventListener("click", function () {
    var openId = $("catBody").getAttribute("data-cat-id");
    if (openId) showView("Category");
    else showMain();
  });

  function wireCategoryBody(id) {
    $("catBody").setAttribute("data-cat-id", id);

    $("catBody").querySelectorAll("[data-toggle-key]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var key = btn.getAttribute("data-toggle-key");
        var swEl = btn.querySelector(".switch");
        var next = !(swEl && swEl.classList.contains("on"));
        if (swEl) swEl.classList.toggle("on", next);

        if (key === "private_account") {
          if (!user) {
            toast("Login required");
            if (swEl) swEl.classList.toggle("on", !next);
            return;
          }
          try {
            setPref("private_account", next);
            toast(next ? "Account is private" : "Account is public");
          } catch (e) {
            if (swEl) swEl.classList.toggle("on", !next);
            toast("Could not update");
          }
          return;
        }

        setPref(key, next);
        toast(
          (btn.querySelector(".rowTitle") || {}).textContent +
            (next ? ": On" : ": Off")
        );
      });
    });

    $("catBody").querySelectorAll("[data-choice-key]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openChoice(btn.getAttribute("data-choice-key"));
      });
    });

    $("catBody").querySelectorAll("[data-theme-set]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var m = btn.getAttribute("data-theme-set");
        applyTheme(m);
        $("catBody").querySelectorAll("[data-theme-set]").forEach(function (b) {
          b.classList.toggle(
            "active",
            b.getAttribute("data-theme-set") === m
          );
        });
        toast(
          m === "system"
            ? "System theme"
            : m === "light"
            ? "Light mode"
            : "Dark mode"
        );
      });
    });

    var map = {
      btnUsername: function () {
        if (!user) return toast("Login required");
        $("usernameInput").value = String(
          profile.username || profile.userName || ""
        ).replace(/^@/, "");
        openSheet("sheetUsername");
      },
      btnEmailPhone: function () {
        if (!user) return toast("Login required");
        fillContactSheet();
        openSheet("sheetEmail");
      },
      btnPassword: function () {
        if (!user) return toast("Login required");
        openSheet("sheetPassword");
      },
      btnStoryPrivacy: function () {
        storyPrivacyDraft = getPref("story_privacy", "everyone");
        document
          .querySelectorAll("#storyPrivacyOptions .radioRow")
          .forEach(function (r) {
            r.classList.toggle(
              "selected",
              r.getAttribute("data-val") === storyPrivacyDraft
            );
          });
        openSheet("sheetStory");
      },
      btnDataUsage: function () {
        toast("Data usage tracking — available after more activity");
      },
      btnStorage: function () {
        var n = 0;
        try {
          n = Math.round(
            (JSON.stringify(localStorage).length / 1024) * 10
          ) / 10;
        } catch (_) {}
        toast("Local storage ~" + n + " KB");
      },
      btnClearCache: function () {
        try {
          Object.keys(localStorage).forEach(function (k) {
            if (/cache|thumb|viewora_tmp|upload_draft|skeleton/i.test(k))
              localStorage.removeItem(k);
          });
          toast("Cache cleared");
        } catch (_) {
          toast("Could not clear cache");
        }
      },
      btnA11y: function () {
        toast("Use system accessibility settings on your device");
      },
      btnLogoutAll: async function () {
        if (!confirm("Log out of all devices?")) return;
        try {
          if (auth) await auth.signOut();

try {
  ["viewora_my_avatar","viewora_my_banner","viewora_my_cover","viewora_my_name","viewora_my_username"].forEach(function(k){ localStorage.removeItem(k); });
  sessionStorage.removeItem("viewora_media_unlocked");
} catch(e) {}
;
        } catch (_) {}
        try {
          if (db && user)
            await db.ref("users/" + user.uid + "/sessions").remove();
        } catch (_) {}
        location.href = "index.html";
      }
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", map[id]);
    });
  }

  /* Sheets */
  function openSheet(id) {
    var sheet = $(id);
    var mask = $("mask" + id.replace("sheet", ""));
    if (mask) mask.classList.add("open");
    if (sheet) sheet.classList.add("open");
  }
  function closeSheet(id) {
    var sheet = $(id);
    var mask = $("mask" + id.replace("sheet", ""));
    if (mask) mask.classList.remove("open");
    if (sheet) sheet.classList.remove("open");
  }
  document.querySelectorAll("[data-close]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      closeSheet(btn.getAttribute("data-close"));
    });
  });
  ["maskPassword", "maskUsername", "maskEmail", "maskStory", "maskForgot", "maskOtp"].forEach(
    function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("click", function () {
        var map = {
          maskPassword: "sheetPassword",
          maskUsername: "sheetUsername",
          maskEmail: "sheetEmail",
          maskStory: "sheetStory",
          maskForgot: "sheetForgot",
          maskOtp: "sheetOtp"
        };
        closeSheet(map[id] || "sheetPassword");
      });
    }
  );

  document
    .querySelectorAll("#storyPrivacyOptions .radioRow")
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        document
          .querySelectorAll("#storyPrivacyOptions .radioRow")
          .forEach(function (b) {
            b.classList.remove("selected");
          });
        btn.classList.add("selected");
        storyPrivacyDraft = btn.getAttribute("data-val");
      });
    });
  $("storyPrivacySave").addEventListener("click", function () {
    setPref("story_privacy", storyPrivacyDraft);
    closeSheet("sheetStory");
    toast("Story privacy saved");
    var openId = $("catBody").getAttribute("data-cat-id");
    if (openId === "privacy") {
      $("catBody").innerHTML = buildCategory("privacy");
      wireCategoryBody("privacy");
    }
  });

  $("usernameSave").addEventListener("click", async function () {
    if (!user || !db) return toast("Login required");
    var u = ($("usernameInput").value || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(u)) return toast("Invalid username");
    try {
      var taken = await db.ref("usernames/" + u).once("value");
      if (taken.exists() && taken.val() !== user.uid) {
        return toast("Username already taken");
      }
      var old = String(profile.username || "").toLowerCase().replace(/^@/, "");
      var updates = {};
      updates["users/" + user.uid + "/username"] = u;
      updates["users/" + user.uid + "/userName"] = u;
      updates["usernames/" + u] = user.uid;
      if (old && old !== u) updates["usernames/" + old] = null;
      await db.ref().update(updates);
      profile.username = u;
      $("pcHandle").textContent = "@" + u;
      closeSheet("sheetUsername");
      toast("Username updated");
      var openId = $("catBody").getAttribute("data-cat-id");
      if (openId === "account") {
        $("catBody").innerHTML = buildCategory("account");
        wireCategoryBody("account");
      }
    } catch (e) {
      toast(e.message || "Failed");
    }
  });


  function fillContactSheet() {
    var emails = profile.emails || [];
    if (!Array.isArray(emails)) emails = [];
    var phones = profile.phones || [];
    if (!Array.isArray(phones)) phones = [];
    var e1 = (emails[0] && emails[0].value) || profile.email || (user && user.email) || "";
    var e2 = (emails[1] && emails[1].value) || profile.email2 || "";
    var p1 = (phones[0] && phones[0].value) || profile.phone || profile.phoneNumber || "";
    var p2 = (phones[1] && phones[1].value) || profile.phone2 || "";
    contactDraft.email1 = e1;
    contactDraft.email2 = e2;
    contactDraft.phone1 = p1;
    contactDraft.phone2 = p2;
    contactDraft.email1Verified = !!(emails[0] && emails[0].verified) || !!(user && user.email && user.email === e1 && user.emailVerified);
    contactDraft.email2Verified = !!(emails[1] && emails[1].verified);
    contactDraft.phone1Verified = !!(phones[0] && phones[0].verified) || !!(profile.phoneVerified);
    contactDraft.phone2Verified = !!(phones[1] && phones[1].verified);
    $("email1Input").value = e1;
    $("email2Input").value = e2;
    $("phone1Input").value = p1;
    $("phone2Input").value = p2;
    setBadge("email1Badge", e1 ? (contactDraft.email1Verified ? "verified" : "pending") : "—");
    setBadge("email2Badge", e2 ? (contactDraft.email2Verified ? "verified" : "pending") : "optional");
    setBadge("phone1Badge", p1 ? (contactDraft.phone1Verified ? "verified" : "pending") : "—");
    setBadge("phone2Badge", p2 ? (contactDraft.phone2Verified ? "verified" : "pending") : "optional");
    if (e2) { $("email2Block").hidden = false; $("addEmailBtn").hidden = true; }
    else { $("email2Block").hidden = true; $("addEmailBtn").hidden = false; }
    if (p2) { $("phone2Block").hidden = false; $("addPhoneBtn").hidden = true; }
    else { $("phone2Block").hidden = true; $("addPhoneBtn").hidden = false; }
    ["email1","email2","phone1","phone2"].forEach(function (k) {
      var o = $(k + "Otp"); if (o) { o.hidden = true; o.value = ""; }
      var v = $(k + "Verify"); if (v) v.hidden = true;
    });
  }

  function wireContactOtp(slot) {
    var sendBtn = $(slot + "SendOtp");
    var otpInput = $(slot + "Otp");
    var verifyBtn = $(slot + "Verify");
    var field = $(slot + "Input");
    if (!sendBtn) return;
    sendBtn.addEventListener("click", async function () {
      if (!user) return toast("Login required");
      var val = (field && field.value || "").trim();
      if (!val) return toast("Enter a value first");
      sendBtn.disabled = true;
      try {
        if (slot.indexOf("phone") === 0) {
          if (val.replace(/\D/g, "").length < 8) throw new Error("Invalid phone");
          toast("Sending SMS…");
          await sendFirebasePhoneOtp(val, slot);
          if (otpInput) { otpInput.hidden = false; otpInput.value = ""; otpInput.focus(); }
          if (verifyBtn) verifyBtn.hidden = false;
          toast("OTP sent to " + maskContact(e164Phone(val)));
        } else {
          // email
          if (val.indexOf("@") < 1) throw new Error("Invalid email");
          toast("Sending email…");
          var res = await sendFirebaseEmailOtp(val, "verify_email");
          // Also store local session so Verify can complete contact book after user confirms via mail
          // For in-app 6-digit: Firebase email is a link, not a code — user must open Gmail link.
          // We still allow marking verified after they enter a device-backup code if email fails.
          await writeOtpSession("verify_" + slot, val, "email");
          if (otpInput) { otpInput.hidden = false; otpInput.value = ""; }
          if (verifyBtn) verifyBtn.hidden = false;
          if (res.method === "verify_email" || res.method === "verify_before_update") {
            toast("Check Gmail inbox — verification link sent");
          } else {
            toast("Email sent to " + maskContact(val) + " — open the link");
          }
          // Optional: also show device code as backup for offline testing
          // Do NOT auto-reveal in production path for email
        }
      } catch (e) {
        console.warn(e);
        var msg = (e && e.message) || "Failed to send OTP";
        if (/too-many-requests/i.test(msg + (e && e.code || ""))) {
          toast("Too many attempts — try later");
        } else if (/invalid-phone/i.test(msg + (e && e.code || ""))) {
          toast("Invalid phone — use +country code");
        } else if (/billing|quota|captcha/i.test(msg + (e && e.code || ""))) {
          toast("SMS blocked — enable Phone in Firebase & billing");
        } else {
          // Fallback device OTP so user is not stuck
          await writeOtpSession("verify_" + slot, val, "device");
          if (otpInput) { otpInput.hidden = false; otpInput.focus(); }
          if (verifyBtn) verifyBtn.hidden = false;
          showDeviceOtpIfNeeded();
          toast("SMS/email failed — device OTP shown");
        }
      } finally {
        sendBtn.disabled = false;
      }
    });
    if (verifyBtn) {
      verifyBtn.addEventListener("click", async function () {
        var code = otpInput && otpInput.value;
        var val = (field && field.value || "").trim();
        verifyBtn.disabled = true;
        try {
          if (slot.indexOf("phone") === 0) {
            await confirmFirebasePhoneOtp(code);
          } else {
            // Email: accept local OTP session OR treat non-empty after link send as manual confirm with device code
            if (!verifyOtpInput(code)) {
              // If user clicked email link, emailVerified may flip
              try { await user.reload(); } catch (_) {}
              if (!(user.emailVerified && user.email && user.email.toLowerCase() === val.toLowerCase())) {
                throw new Error("Invalid OTP — or open the link in Gmail first");
              }
            }
          }
          if (slot === "email1") { contactDraft.email1 = val; contactDraft.email1Verified = true; setBadge("email1Badge", "verified"); }
          if (slot === "email2") { contactDraft.email2 = val; contactDraft.email2Verified = true; setBadge("email2Badge", "verified"); }
          if (slot === "phone1") { contactDraft.phone1 = val; contactDraft.phone1Verified = true; setBadge("phone1Badge", "verified"); }
          if (slot === "phone2") { contactDraft.phone2 = val; contactDraft.phone2Verified = true; setBadge("phone2Badge", "verified"); }
          toast("Verified");
          if (otpInput) otpInput.hidden = true;
          verifyBtn.hidden = true;
        } catch (e) {
          toast((e && e.message) || "Verification failed");
        } finally {
          verifyBtn.disabled = false;
        }
      });
    }
  }

  function showDeviceOtpIfNeeded() {
    if (!otpState.code) return;
    var box = $("deviceOtpReveal");
    var codeEl = $("deviceOtpCode");
    if (otpState.channel === "device" || !otpState.channel) {
      openSheet("sheetOtp");
      $("otpTitle").textContent = "Device OTP";
      $("otpDesc").textContent = "No verified email/phone — code shown on this logged-in device only.";
      if (box) box.classList.remove("hidden");
      if (codeEl) codeEl.textContent = otpState.code;
      $("otpInput").value = "";
    } else if (otpState.channel === "email" || otpState.channel === "phone") {
      // Still reveal on device as fallback when real SMS/email gateway not configured
      openSheet("sheetOtp");
      $("otpTitle").textContent = "Enter OTP";
      $("otpDesc").textContent =
        otpState.channel === "email"
          ? "Code for " + maskContact(otpState.target || "")
          : "Code for " + maskContact(otpState.target || "");
      if (box) {
        box.classList.remove("hidden");
        if (codeEl) codeEl.textContent = otpState.code;
      }
      $("otpInput").value = "";
    }
  }

  $("emailSave").addEventListener("click", async function () {
    if (!user || !db) return toast("Login required");
    // Only persist verified slots; others stay pending in UI only
    var emails = [];
    var phones = [];
    var e1 = ($("email1Input").value || "").trim();
    var e2 = ($("email2Input").value || "").trim();
    var p1 = ($("phone1Input").value || "").trim();
    var p2 = ($("phone2Input").value || "").trim();
    if (e1) {
      if (!contactDraft.email1Verified && e1 !== ((user && user.email) || profile.email || "")) {
        setBadge("email1Badge", "pending");
        return toast("Verify Email 1 with OTP first");
      }
      emails.push({ value: e1, verified: !!contactDraft.email1Verified || e1 === (user && user.email) });
    }
    if (e2) {
      if (!contactDraft.email2Verified) {
        setBadge("email2Badge", "pending");
        return toast("Verify Email 2 with OTP first");
      }
      emails.push({ value: e2, verified: true });
    }
    if (p1) {
      if (!contactDraft.phone1Verified && p1 !== (profile.phone || profile.phoneNumber || "")) {
        setBadge("phone1Badge", "pending");
        return toast("Verify Phone 1 with OTP first");
      }
      phones.push({ value: p1, verified: !!contactDraft.phone1Verified || p1 === (profile.phone || profile.phoneNumber) });
    }
    if (p2) {
      if (!contactDraft.phone2Verified) {
        setBadge("phone2Badge", "pending");
        return toast("Verify Phone 2 with OTP first");
      }
      phones.push({ value: p2, verified: true });
    }
    try {
      var patch = {
        emails: emails,
        phones: phones,
        email: emails[0] ? emails[0].value : null,
        email2: emails[1] ? emails[1].value : null,
        phone: phones[0] ? phones[0].value : null,
        phoneNumber: phones[0] ? phones[0].value : null,
        phone2: phones[1] ? phones[1].value : null,
        phoneVerified: !!(phones[0] && phones[0].verified),
        updatedAt: Date.now()
      };
      await db.ref("users/" + user.uid).update(patch);
      profile = Object.assign(profile, patch);
      closeSheet("sheetEmail");
      toast("Contacts saved");
      var openId = $("catBody").getAttribute("data-cat-id");
      if (openId === "account") {
        $("catBody").innerHTML = buildCategory("account");
        wireCategoryBody("account");
      }
    } catch (e) {
      toast(e.message || "Failed");
    }
  });

  $("passActionBtn").addEventListener("click", async function () {
    if (!user) return toast("Login required");
    var cur = ($("currentPass").value || "").trim();
    var a = ($("newPass").value || "").trim();
    var b = ($("newPass2").value || "").trim();
    if (!cur) return toast("Enter current password");
    if (!a || a.length < 6) return toast("New password: min 6 characters");
    if (a !== b) return toast("Passwords do not match");
    try {
      var email = user.email;
      if (!email) {
        toast("No email on account — use Forgot password");
        return;
      }
      var cred = firebase.auth.EmailAuthProvider.credential(email, cur);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(a);
      closeSheet("sheetPassword");
      $("currentPass").value = "";
      $("newPass").value = "";
      $("newPass2").value = "";
      toast("Password updated");
    } catch (e) {
      var msg = (e && e.message) || "";
      if (/wrong-password|invalid-credential|INVALID_LOGIN/i.test(msg + (e && e.code || ""))) {
        toast("Current password is wrong");
      } else if (/requires-recent-login/i.test(e.code || msg)) {
        toast("Session expired — log in again");
      } else {
        toast(msg || "Could not update password");
      }
    }
  });

  /* Forgot password flow */
  $("forgotPassBtn").addEventListener("click", function () {
    closeSheet("sheetPassword");
    openForgotSheet();
  });

  function openForgotSheet() {
    var box = $("forgotChannelBox");
    var email = (user && user.email) || profile.email || "";
    var phone = profile.phone || profile.phoneNumber || "";
    var html = "";
    if (email) {
      html += '<button type="button" class="channelRow' + (forgotChannel === "email" ? " selected" : "") + '" data-ch="email"><i class="fa-solid fa-envelope"></i><span>Email · ' + esc(maskContact(email)) + "</span></button>";
    }
    if (phone) {
      html += '<button type="button" class="channelRow' + (forgotChannel === "phone" ? " selected" : "") + '" data-ch="phone"><i class="fa-solid fa-phone"></i><span>Phone · ' + esc(maskContact(phone)) + "</span></button>";
    }
    html += '<button type="button" class="channelRow' + (forgotChannel === "device" || (!email && !phone) ? " selected" : "") + '" data-ch="device"><i class="fa-solid fa-mobile-screen"></i><span>This device (logged in)</span></button>';
    if (!email && !phone) forgotChannel = "device";
    else if (email && forgotChannel !== "phone") forgotChannel = "email";
    box.innerHTML = html;
    box.querySelectorAll(".channelRow").forEach(function (btn) {
      btn.addEventListener("click", function () {
        box.querySelectorAll(".channelRow").forEach(function (b) { b.classList.remove("selected"); });
        btn.classList.add("selected");
        forgotChannel = btn.getAttribute("data-ch");
      });
    });
    $("forgotOtpStep").classList.add("hidden");
    $("forgotActionBtn").textContent = "Send OTP";
    $("forgotActionBtn").setAttribute("data-mode", "send");
    $("forgotDesc").textContent = "Choose where to receive the code, then set a new password.";
    openSheet("sheetForgot");
  }

  $("forgotActionBtn").addEventListener("click", async function () {
    if (!user) return toast("Login required");
    var mode = this.getAttribute("data-mode") || "send";
    if (mode === "send") {
      var email = (user && user.email) || profile.email || "";
      var phone = profile.phone || profile.phoneNumber || "";
      if (forgotChannel === "email" && email) {
        try {
          await firebase.auth().sendPasswordResetEmail(email);
          toast("Reset link sent to " + maskContact(email));
          // Also device OTP so user can reset in-app without leaving
          await writeOtpSession("password_reset", email, "email");
          $("forgotOtpStep").classList.remove("hidden");
          $("forgotOtpHint").textContent = "Or enter in-app OTP (also on this device).";
          $("forgotActionBtn").textContent = "Reset password";
          $("forgotActionBtn").setAttribute("data-mode", "reset");
          showDeviceOtpIfNeeded();
        } catch (e) {
          await writeOtpSession("password_reset", email, "device");
          $("forgotOtpStep").classList.remove("hidden");
          $("forgotActionBtn").textContent = "Reset password";
          $("forgotActionBtn").setAttribute("data-mode", "reset");
          toast("OTP on this device");
          showDeviceOtpIfNeeded();
        }
      } else if (forgotChannel === "phone" && phone) {
        try {
          toast("Sending SMS…");
          await sendFirebasePhoneOtp(phone, "forgot");
          $("forgotOtpStep").classList.remove("hidden");
          $("forgotOtpHint").textContent = "Enter the SMS code sent to " + maskContact(e164Phone(phone));
          $("forgotActionBtn").textContent = "Reset password";
          $("forgotActionBtn").setAttribute("data-mode", "reset");
          toast("OTP sent to phone");
        } catch (e) {
          await writeOtpSession("password_reset", phone, "device");
          $("forgotOtpStep").classList.remove("hidden");
          $("forgotActionBtn").textContent = "Reset password";
          $("forgotActionBtn").setAttribute("data-mode", "reset");
          showDeviceOtpIfNeeded();
          toast("SMS failed — device OTP shown");
        }
      } else {
        await writeOtpSession("password_reset", "device", "device");
        $("forgotOtpStep").classList.remove("hidden");
        $("forgotOtpHint").textContent = "Code is shown on this logged-in device.";
        $("forgotActionBtn").textContent = "Reset password";
        $("forgotActionBtn").setAttribute("data-mode", "reset");
        showDeviceOtpIfNeeded();
        toast("OTP on this device");
      }
      return;
    }
    // reset mode
    var code = ($("forgotOtpInput").value || "").trim();
    try {
      if (forgotChannel === "phone" && (phoneConfirmResult || phoneVerificationId)) {
        await confirmFirebasePhoneOtp(code);
      } else if (!verifyOtpInput(code)) {
        return toast("Invalid OTP");
      }
    } catch (e) {
      return toast((e && e.message) || "Invalid OTP");
    }
    var a = ($("forgotNewPass").value || "").trim();
    var b = ($("forgotNewPass2").value || "").trim();
    if (!a || a.length < 6) return toast("Min 6 characters");
    if (a !== b) return toast("Passwords do not match");
    try {
      await user.updatePassword(a);
      closeSheet("sheetForgot");
      toast("Password reset successful");
    } catch (e) {
      toast(e.message || "Re-login required, then change password from Settings");
    }
  });

  $("otpConfirmBtn").addEventListener("click", function () {
    var code = ($("otpInput").value || "").trim();
    if (!verifyOtpInput(code)) return toast("Invalid OTP");
    closeSheet("sheetOtp");
    toast("OTP confirmed");
    // If verifying a contact slot, mirror into the mini otp fields
    if (otpState.purpose && otpState.purpose.indexOf("verify_") === 0) {
      var slot = otpState.purpose.replace("verify_", "");
      var mini = $(slot + "Otp");
      if (mini) { mini.value = code; mini.hidden = false; }
      var vb = $(slot + "Verify");
      if (vb) vb.click();
    }
  });


  var CAT_TITLES = {
    account: "Account",
    privacy: "Privacy",
    notifications: "Notification Settings",
    messages: "Messages & Calls",
    content: "Content & Media",
    safety: "Safety",
    appearance: "Appearance",
    app: "Data & Storage",
    about: "About Viewora"
  };

  document.querySelectorAll("[data-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-open");
      showCategory(id, CAT_TITLES[id] || id);
    });
  });

  $("catBack").addEventListener("click", showMain);
  $("backBtn").addEventListener("click", function () {
    if (history.length > 1) history.back();
    else location.href = "profile.html";
  });

  $("btnLogout").addEventListener("click", async function () {
    if (!confirm("Log out of Viewora?")) return;
    try {
      if (auth) await auth.signOut();
    } catch (_) {}
    try {
      sessionStorage.clear();
    } catch (_) {}
    location.href = "index.html";
  });

  /* Search */
  var SEARCH_INDEX = [
    { q: "profile account", open: "account", label: "Account → Profile" },
    { q: "edit profile bio photo", open: "account", label: "Account → Edit Profile" },
    { q: "username handle", open: "account", label: "Account → Username" },
    { q: "email phone contact", open: "account", label: "Account → Email & Phone" },
    { q: "password security", open: "account", label: "Account → Password" },
    { q: "delete deactivate account status", open: "account", label: "Account → Delete" },
    { q: "private account privacy follow", open: "privacy", label: "Privacy → Private Account" },
    { q: "message comment mentions story blocked", open: "privacy", label: "Privacy" },
    { q: "push notifications likes comments followers", open: "notifications", label: "Notifications" },
    { q: "messages calls voice video requests privacy", open: "messages", label: "Messages & Calls" },
    { q: "upload quality video autoplay data saver content media", open: "content", label: "Content & Media" },
    { q: "community guidelines report safety blocked", open: "safety", label: "Safety" },
    { q: "theme dark light appearance font language", open: "appearance", label: "Appearance" },
    { q: "cache storage data accessibility", open: "app", label: "Data & Storage" },
    { q: "about terms privacy copyright support version help", open: "about", label: "About Viewora" },
    { q: "logout log out", open: null, label: "Log Out", action: "logout" }
  ];

  $("settingsQuery").addEventListener("input", function () {
    var q = (this.value || "").trim().toLowerCase();
    var main = $("mainCategories");
    var res = $("searchResults");
    var card = $("searchResultsCard");
    if (!q) {
      main.classList.remove("hidden");
      res.classList.add("hidden");
      return;
    }
    main.classList.add("hidden");
    res.classList.remove("hidden");
    var hits = SEARCH_INDEX.filter(function (item) {
      return (
        item.q.indexOf(q) !== -1 ||
        item.label.toLowerCase().indexOf(q) !== -1
      );
    });
    if (!hits.length) {
      card.innerHTML =
        '<div class="row"><span class="rowBody"><span class="rowDesc">No results</span></span></div>';
      return;
    }
    card.innerHTML = hits
      .map(function (item, i) {
        return (
          '<button type="button" class="row" data-search-i="' +
          i +
          '">' +
          rowIcon("", "magnifying-glass") +
          '<span class="rowBody"><span class="rowTitle">' +
          esc(item.label) +
          "</span></span>" +
          chev() +
          "</button>"
        );
      })
      .join("");
    card.querySelectorAll("[data-search-i]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = hits[Number(btn.getAttribute("data-search-i"))];
        if (!item) return;
        if (item.action === "logout") {
          $("btnLogout").click();
          return;
        }
        if (item.open) showCategory(item.open, CAT_TITLES[item.open] || item.open);
      });
    });
  });

  function fillProfile(u, p) {
    profile = p || {};
    user = u;
    var name =
      profile.displayName || profile.name || profile.username || "User";
    var uname = profile.username || profile.userName || "";
    var photo =
      profile.photoURL ||
      profile.profilePhoto ||
      profile.avatar ||
      (u && u.photoURL) ||
      "";
    $("pcName").textContent = name;
    $("pcHandle").textContent = uname
      ? "@" + uname.replace(/^@/, "")
      : "@user";
    if (photo) {
      $("pcAvatar").style.display = "";
      $("pcAvatar").src = photo;
      $("pcFallback").style.display = "none";
    } else {
      $("pcAvatar").style.display = "none";
      $("pcFallback").style.display = "grid";
      $("pcFallback").textContent = (name[0] || "V").toUpperCase();
    }
  }

  function boot() {
    loadLocalPrefs();
    try {
      auth = firebase.auth();
      db = firebase.database();
    } catch (e) {
      console.warn(e);
      return;
    }
    auth.onAuthStateChanged(function (u) {
      if (!u) {
        $("pcName").textContent = "Not signed in";
        $("pcHandle").textContent = "Tap to login";
        $("profileCard").href = "index.html";
        return;
      }
      user = u;
      pullFirebasePrefs().then(function () {
        fillProfile(u, profile);
      });
      db.ref("users/" + u.uid)
        .once("value")
        .then(function (snap) {
          fillProfile(u, snap.val() || {});
        });
    });
  }

  // Contact OTP wiring
  ["email1", "email2", "phone1", "phone2"].forEach(wireContactOtp);
  ["email1", "email2", "phone1", "phone2"].forEach(function (slot) {
    var inp = $(slot + "Input");
    if (!inp) return;
    inp.addEventListener("input", function () {
      if (slot === "email1") { contactDraft.email1Verified = false; setBadge("email1Badge", inp.value.trim() ? "pending" : "—"); }
      if (slot === "email2") { contactDraft.email2Verified = false; setBadge("email2Badge", inp.value.trim() ? "pending" : "optional"); }
      if (slot === "phone1") { contactDraft.phone1Verified = false; setBadge("phone1Badge", inp.value.trim() ? "pending" : "—"); }
      if (slot === "phone2") { contactDraft.phone2Verified = false; setBadge("phone2Badge", inp.value.trim() ? "pending" : "optional"); }
    });
  });
  var addEmailBtn = $("addEmailBtn");
  if (addEmailBtn) {
    addEmailBtn.addEventListener("click", function () {
      $("email2Block").hidden = false;
      addEmailBtn.hidden = true;
    });
  }
  var addPhoneBtn = $("addPhoneBtn");
  if (addPhoneBtn) {
    addPhoneBtn.addEventListener("click", function () {
      $("phone2Block").hidden = false;
      addPhoneBtn.hidden = true;
    });
  }

  // Apply saved font/lang on settings load
  try {
    applyFontGlobal(getPref("font", localStorage.getItem(FONT_KEY) || "default"));
    applyLangGlobal(getPref("lang", localStorage.getItem(LANG_KEY) || "en"));
  } catch (_) {}

  if (window.firebase && firebase.apps && firebase.apps.length) boot();
  else setTimeout(boot, 120);
})();
