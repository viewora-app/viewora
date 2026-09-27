/*! Viewora global theme + font + language */
(function () {
  "use strict";
  var KEY = "viewora_theme";
  var FONT_KEY = "viewora_font";
  var LANG_KEY = "viewora_lang";
  var PREF_KEY = "viewora_settings_v2";

  var FONT_PX = { default: "", large: "17px", xlarge: "19px" };
  var FONT_SCALE = { default: "1", large: "1.12", xlarge: "1.25" };

  function getTheme() {
    try {
      var t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") return t;
      if (t === "system") {
        try {
          return window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
        } catch (_) {
          return "dark";
        }
      }
    } catch (_) {}
    return "dark";
  }

  function applyTheme(mode) {
    if (mode === "system") {
      try {
        localStorage.setItem(KEY, "system");
      } catch (_) {}
      mode = getTheme();
    } else {
      mode = mode === "light" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, mode);
      } catch (_) {}
    }
    var root = document.documentElement;
    root.setAttribute("data-theme", mode);
    root.classList.toggle("theme-light", mode === "light");
    root.classList.toggle("theme-dark", mode === "dark");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", mode === "light" ? "#f4f4f5" : "#050507");
    }
    try {
      window.dispatchEvent(
        new CustomEvent("viewora:theme", { detail: { theme: mode } })
      );
    } catch (_) {}
  }

  function getFont() {
    try {
      var f = localStorage.getItem(FONT_KEY);
      if (f === "large" || f === "xlarge" || f === "default") return f;
      var prefs = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
      if (prefs.font === "large" || prefs.font === "xlarge" || prefs.font === "default")
        return prefs.font;
    } catch (_) {}
    return "default";
  }

  function applyFont(size) {
    size = size === "large" || size === "xlarge" ? size : "default";
    try {
      localStorage.setItem(FONT_KEY, size);
    } catch (_) {}
    var root = document.documentElement;
    root.setAttribute("data-font", size);
    root.style.setProperty("--v-font-scale", FONT_SCALE[size] || "1");
    var px = FONT_PX[size] || "";
    root.style.fontSize = px || "16px";
    if (document.body) {
      document.body.style.fontSize = px || "";
      document.body.setAttribute("data-font", size);
    }
    try {
      window.dispatchEvent(
        new CustomEvent("viewora:font", { detail: { font: size } })
      );
    } catch (_) {}
  }

  function getLang() {
    try {
      var l = localStorage.getItem(LANG_KEY);
      if (l && l.length <= 5) return l;
      var prefs = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
      if (prefs.lang) return prefs.lang;
    } catch (_) {}
    return "en";
  }

  var I18N = {
    en: {
      Settings: "Settings", Account: "Account", Privacy: "Privacy",
      Appearance: "Appearance", "Log Out": "Log Out", Home: "Home",
      Search: "Search", Upload: "Upload", Activity: "Activity",
      Profile: "Profile", Messages: "Messages", Save: "Save",
      Cancel: "Cancel", Edit: "Edit", Follow: "Follow", Following: "Following",
      Share: "Share", Like: "Like", Comment: "Comment", Shorts: "Shorts",
      Videos: "Videos", Posts: "Posts", Language: "Language",
      "Font Size": "Font Size", Theme: "Theme"
    },
    hi: {
      Settings: "सेटिंग्स", Account: "अकाउंट", Privacy: "प्राइवेसी",
      Appearance: "दिखावट", "Log Out": "लॉग आउट", Home: "होम",
      Search: "खोजें", Upload: "अपलोड", Activity: "एक्टिविटी",
      Profile: "प्रोफ़ाइल", Messages: "मैसेज", Save: "सेव",
      Cancel: "रद्द", Edit: "एडिट", Follow: "फॉलो", Following: "फॉलोइंग",
      Share: "शेयर", Like: "लाइक", Comment: "कमेंट", Shorts: "शॉर्ट्स",
      Videos: "वीडियो", Posts: "पोस्ट", Language: "भाषा",
      "Font Size": "फ़ॉन्ट साइज़", Theme: "थीम"
    },
    de: {
      Settings: "Einstellungen", Account: "Konto", Privacy: "Datenschutz",
      Appearance: "Erscheinung", "Log Out": "Abmelden", Home: "Start",
      Search: "Suche", Upload: "Hochladen", Activity: "Aktivität",
      Profile: "Profil", Messages: "Nachrichten", Save: "Speichern",
      Cancel: "Abbrechen", Edit: "Bearbeiten", Follow: "Folgen",
      Following: "Folge ich", Share: "Teilen", Like: "Gefällt mir",
      Comment: "Kommentar", Shorts: "Shorts", Videos: "Videos",
      Posts: "Beiträge", Language: "Sprache", "Font Size": "Schriftgröße",
      Theme: "Design"
    },
    sa: {
      Settings: "व्यवस्थाः", Account: "खाता", Privacy: "गोपनीयता",
      Appearance: "रूपम्", "Log Out": "निर्गमनम्", Home: "गृहम्",
      Search: "अन्वेषणम्", Upload: "अपलोड्", Activity: "क्रिया",
      Profile: "प्रोफ़ाइल्", Messages: "सन्देशाः", Save: "रक्षतु",
      Cancel: "निरसयतु", Edit: "सम्पादयतु", Follow: "अनुसरतु",
      Following: "अनुसरति", Share: "विभजतु", Like: "रोचते",
      Comment: "टिप्पणी", Shorts: "लघु", Videos: "चलचित्राणि",
      Posts: "प्रकाशनानि", Language: "भाषा", "Font Size": "अक्षरमात्रा",
      Theme: "थीम"
    },
    ja: {
      Settings: "設定", Account: "アカウント", Privacy: "プライバシー",
      Appearance: "外観", "Log Out": "ログアウト", Home: "ホーム",
      Search: "検索", Upload: "アップロード", Activity: "アクティビティ",
      Profile: "プロフィール", Messages: "メッセージ", Save: "保存",
      Cancel: "キャンセル", Edit: "編集", Follow: "フォロー",
      Following: "フォロー中", Share: "共有", Like: "いいね",
      Comment: "コメント", Shorts: "ショート", Videos: "動画",
      Posts: "投稿", Language: "言語", "Font Size": "文字サイズ",
      Theme: "テーマ"
    },
    zh: {
      Settings: "设置", Account: "账户", Privacy: "隐私",
      Appearance: "外观", "Log Out": "退出登录", Home: "首页",
      Search: "搜索", Upload: "上传", Activity: "动态",
      Profile: "主页", Messages: "消息", Save: "保存",
      Cancel: "取消", Edit: "编辑", Follow: "关注",
      Following: "已关注", Share: "分享", Like: "赞",
      Comment: "评论", Shorts: "短视频", Videos: "视频",
      Posts: "帖子", Language: "语言", "Font Size": "字体大小",
      Theme: "主题"
    }
  };

  function t(key, lang) {
    lang = lang || getLang();
    var dict = I18N[lang] || I18N.en;
    return dict[key] || (I18N.en[key] || key);
  }

  function applyI18n(lang) {
    lang = lang || getLang();
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!key) return;
      var val = t(key, lang);
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        if (el.getAttribute("placeholder") != null) el.placeholder = val;
      } else {
        el.textContent = val;
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key, lang));
    });
  }

  function applyLang(lang) {
    lang = String(lang || "en").toLowerCase();
    if (!I18N[lang]) lang = "en";
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}
    var root = document.documentElement;
    root.setAttribute("lang", lang === "sa" ? "sa" : lang);
    root.setAttribute("data-lang", lang);
    applyI18n(lang);
    try {
      window.dispatchEvent(
        new CustomEvent("viewora:lang", { detail: { lang: lang } })
      );
    } catch (_) {}
  }

  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "light" ? "dark" : "light");
    return document.documentElement.getAttribute("data-theme");
  }

  try {
    applyTheme(localStorage.getItem(KEY) || "dark");
  } catch (_) {
    applyTheme("dark");
  }
  applyFont(getFont());
  applyLang(getLang());

  window.VieworaTheme = {
    get: getTheme,
    set: applyTheme,
    toggle: toggleTheme,
    apply: applyTheme,
    getFont: getFont,
    setFont: applyFont,
    getLang: getLang,
    setLang: applyLang,
    t: t,
    applyI18n: applyI18n
  };

  window.addEventListener("storage", function (e) {
    if (e.key === KEY && e.newValue) applyTheme(e.newValue);
    if (e.key === FONT_KEY && e.newValue) applyFont(e.newValue);
    if (e.key === LANG_KEY && e.newValue) applyLang(e.newValue);
  });

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }
  onReady(function () {
    applyFont(getFont());
    applyI18n(getLang());
  });
})();
