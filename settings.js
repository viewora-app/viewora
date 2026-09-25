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
      lang: { en: "English", hi: "हिन्दी" },
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
        valChev((user && user.email) || profile.email || "—")
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
      desc: "App language",
      options: [
        { value: "en", label: "English" },
        { value: "hi", label: "हिन्दी" }
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
    if (choiceState.key === "font") {
      document.documentElement.style.fontSize =
        choiceState.value === "xlarge"
          ? "18px"
          : choiceState.value === "large"
          ? "16px"
          : "";
    }
    toast("Saved");
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
        $("emailInput").value = user.email || profile.email || "";
        $("phoneInput").value = profile.phone || profile.phoneNumber || "";
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
  ["maskPassword", "maskUsername", "maskEmail", "maskStory"].forEach(
    function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("click", function () {
        closeSheet(
          id === "maskPassword"
            ? "sheetPassword"
            : id === "maskUsername"
            ? "sheetUsername"
            : id === "maskEmail"
            ? "sheetEmail"
            : "sheetStory"
        );
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

  $("emailSave").addEventListener("click", async function () {
    if (!user || !db) return toast("Login required");
    var email = ($("emailInput").value || "").trim();
    var phone = ($("phoneInput").value || "").trim();
    try {
      var patch = { phone: phone, phoneNumber: phone };
      if (email) patch.email = email;
      await db.ref("users/" + user.uid).update(patch);
      profile.email = email || profile.email;
      profile.phone = phone;
      closeSheet("sheetEmail");
      toast("Contact details saved");
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
    var a = $("newPass").value,
      b = $("newPass2").value;
    if (!a || a.length < 6) return toast("Min 6 characters");
    if (a !== b) return toast("Passwords do not match");
    try {
      await user.updatePassword(a);
      closeSheet("sheetPassword");
      $("newPass").value = "";
      $("newPass2").value = "";
      toast("Password updated");
    } catch (e) {
      toast(e.message || "Re-login required to change password");
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

  if (window.firebase && firebase.apps && firebase.apps.length) boot();
  else setTimeout(boot, 120);
})();
