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
      var prefs = {};
      try { prefs = JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch (_) {}
      prefs.font = size;
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch (_) {}
    var scale = FONT_SCALE[size] || "1";
    var px = size === "xlarge" ? "19px" : size === "large" ? "17px" : "16px";
    var root = document.documentElement;
    root.setAttribute("data-font", size);
    root.style.setProperty("--v-font-scale", scale);
    root.style.fontSize = px;
    if (document.body) {
      document.body.setAttribute("data-font", size);
      document.body.style.fontSize = "";
    }
    try {
      var sid = "viewora-font-style";
      var st = document.getElementById(sid);
      if (!st) {
        st = document.createElement("style");
        st.id = sid;
        (document.head || document.documentElement).appendChild(st);
      }
      st.textContent =
        "html{font-size:" + px + " !important;}" +
        "body{--v-font-scale:" + scale + ";}";
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent("viewora:font", { detail: { font: size } }));
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


  // Language aliases for codes without full dictionaries
  try {
    if (!I18N.ur) I18N.ur = I18N.hi || I18N.en;
    if (!I18N.bn) I18N.bn = I18N.hi || I18N.en;
    if (!I18N.fr) I18N.fr = Object.assign({}, I18N.en, {
      Settings: "Paramètres", Home: "Accueil", Search: "Recherche", Profile: "Profil",
      Messages: "Messages", Save: "Enregistrer", Cancel: "Annuler", Language: "Langue",
      Appearance: "Apparence", "Log Out": "Déconnexion", "Font Size": "Taille de police"
    });
    if (!I18N.es) I18N.es = Object.assign({}, I18N.en, {
      Settings: "Ajustes", Home: "Inicio", Search: "Buscar", Profile: "Perfil",
      Messages: "Mensajes", Save: "Guardar", Cancel: "Cancelar", Language: "Idioma",
      Appearance: "Apariencia", "Log Out": "Cerrar sesión", "Font Size": "Tamaño de fuente"
    });
    if (!I18N.ar) I18N.ar = Object.assign({}, I18N.en, {
      Settings: "الإعدادات", Home: "الرئيسية", Search: "بحث", Profile: "الملف",
      Messages: "الرسائل", Save: "حفظ", Cancel: "إلغاء", Language: "اللغة",
      Appearance: "المظهر", "Log Out": "تسجيل الخروج"
    });
    if (!I18N.ko) I18N.ko = Object.assign({}, I18N.en, {
      Settings: "설정", Home: "홈", Search: "검색", Profile: "프로필",
      Messages: "메시지", Save: "저장", Cancel: "취소", Language: "언어"
    });
    if (!I18N.pt) I18N.pt = Object.assign({}, I18N.en, {
      Settings: "Configurações", Home: "Início", Search: "Pesquisar", Profile: "Perfil",
      Save: "Salvar", Cancel: "Cancelar", Language: "Idioma"
    });
    if (!I18N.ru) I18N.ru = Object.assign({}, I18N.en, {
      Settings: "Настройки", Home: "Главная", Search: "Поиск", Profile: "Профиль",
      Messages: "Сообщения", Save: "Сохранить", Cancel: "Отмена", Language: "Язык"
    });
  } catch (_) {}

  function t(key, lang) {
    lang = lang || getLang();
    var dict = I18N[lang] || I18N.en;
    return dict[key] || (I18N.en[key] || key);
  }

  function applyI18n(lang) {
    lang = lang || getLang();
    if (!I18N[lang]) lang = "en";

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

    // Auto-translate common English UI phrases
    var en = I18N.en || {};
    var dict = I18N[lang] || en;
    var reverse = {};
    Object.keys(en).forEach(function (k) {
      reverse[String(en[k]).toLowerCase()] = k;
      reverse[String(k).toLowerCase()] = k;
    });

    var nodes = document.querySelectorAll(
      "a, button, span, h1, h2, h3, label, p, strong, small, li, " +
      ".rowTitle, .rowDesc, .navLabel, .groupTitle, .tabLabel, .choiceDesc"
    );
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || el.closest("script,style,code,pre,textarea,input,[contenteditable]")) continue;
      if (el.querySelector && el.querySelector("input,textarea,select,img,video,svg,i.fa-solid,i.fa-regular,i.fa-brands")) {
        // may still have text siblings — handle text-only children below
      }
      var src = el.getAttribute("data-i18n-src");
      if (!src) {
        // only pure text nodes or single text
        if (el.children.length > 0) {
          // try .rowTitle style: first text-ish
          var onlyText = true;
          for (var c = 0; c < el.children.length; c++) {
            var tg = el.children[c].tagName;
            if (tg !== "I" && tg !== "SPAN" && tg !== "EM" && tg !== "STRONG") {
              onlyText = false;
              break;
            }
          }
          if (!onlyText && el.children.length > 1) continue;
        }
        src = String(el.textContent || "").replace(/\s+/g, " ").trim();
        if (!src || src.length > 40) continue;
        el.setAttribute("data-i18n-src", src);
      }
      var key = reverse[src.toLowerCase()];
      if (!key) continue;
      var val = dict[key] || en[key] || src;
      if (el.children.length === 0) {
        el.textContent = val;
      } else {
        // update last text node
        var updated = false;
        for (var n = el.childNodes.length - 1; n >= 0; n--) {
          if (el.childNodes[n].nodeType === 3 && el.childNodes[n].textContent.trim()) {
            el.childNodes[n].textContent = " " + val + " ";
            updated = true;
            break;
          }
        }
        if (!updated) {
          // span.rowTitle etc
          var rt = el.querySelector(".rowTitle, .lab, .navLabel");
          if (rt && rt.children.length === 0) rt.textContent = val;
        }
      }
    }
  }

  function applyLang(lang) {
    lang = String(lang || "en").toLowerCase().trim();
    try {
      localStorage.setItem(LANG_KEY, lang);
      var prefs = {};
      try { prefs = JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch (_) {}
      prefs.lang = lang;
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch (_) {}
    var applyCode = I18N[lang] ? lang : "en";
    var root = document.documentElement;
    root.setAttribute("lang", applyCode);
    root.setAttribute("data-lang", lang);
    applyI18n(applyCode);
    try {
      window.dispatchEvent(new CustomEvent("viewora:lang", { detail: { lang: lang } }));
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
    applyLang(getLang());
    applyI18n(getLang());
  });

  // Re-apply i18n when DOM grows (nav, lists)
  try {
    var __i18nTimer = null;
    var vieworaI18nObserver = new MutationObserver(function () {
      clearTimeout(__i18nTimer);
      __i18nTimer = setTimeout(function () {
        try { applyI18n(getLang()); } catch (_) {}
      }, 120);
    });
    function startI18nObserver() {
      if (!document.body) return;
      vieworaI18nObserver.observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) startI18nObserver();
    else document.addEventListener("DOMContentLoaded", startI18nObserver);
  } catch (_) {}

})();
