/*! Viewora global theme + font + language */
(function () {
  "use strict";
  // Prevent duplicate execution when firebase.js auto-loads theme.js
  // and a page also includes <script src="theme.js"> explicitly.
  if (window.__VIEWORA_THEME_V3__) return;
  window.__VIEWORA_THEME_V3__ = true;
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

    // Keep one canonical preference key so every Viewora page reads the same value.
    try {
      localStorage.setItem(FONT_KEY, size);
      var prefs = {};
      try { prefs = JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch (_) {}
      prefs.font = size;
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch (_) {}

    var scale = FONT_SCALE[size] || "1";
    var root = document.documentElement;
    root.setAttribute("data-font", size);
    root.style.setProperty("--v-font-scale", scale);
    root.style.setProperty("--v-font-size", size === "xlarge" ? "19px" : size === "large" ? "17px" : "16px");

    // The old implementation changed only html{font-size}, but most Viewora CSS
    // uses px values.  Chrome therefore showed almost no visible difference.
    // A small page scale makes the setting work consistently even on px-based UI.
    try {
      var sid = "viewora-font-style";
      var st = document.getElementById(sid);
      if (!st) {
        st = document.createElement("style");
        st.id = sid;
        (document.head || document.documentElement).appendChild(st);
      }
      st.textContent =
        "html{font-size:" + (size === "xlarge" ? "19px" : size === "large" ? "17px" : "16px") + " !important;}" +
        "body{--v-font-scale:" + scale + ";--v-font-size:" +
          (size === "xlarge" ? "19px" : size === "large" ? "17px" : "16px") + ";}" +
        "body input,body textarea,body select,body button{font:inherit;}";
      if (document.body) {
        document.body.setAttribute("data-font", size);
      }
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent("viewora:font", { detail: { font: size } }));
    } catch (_) {}
  }

  function refreshFontAfterDom() {
    try { applyFont(getFont()); } catch (_) {}
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

  // Common Viewora UI phrases.  Pages can use plain English text or data-i18n
  // and the global observer will translate dynamically-created elements too.
  var COMMON = {
    en: {
      "Users":"Users","Create":"Create","Notifications":"Notifications","Notification Settings":"Notification Settings",
      "Messages & Calls":"Messages & Calls","Content & Media":"Content & Media","Data & Storage":"Data & Storage",
      "About Viewora":"About Viewora","Search settings":"Search settings","Profile, email, password, delete":"Profile, email, password, delete",
      "Private account, messages, story":"Private account, messages, story","Push, likes, messages, email":"Push, likes, messages, email",
      "Requests, privacy, voice & video":"Requests, privacy, voice & video","Quality, autoplay, data saver":"Quality, autoplay, data saver",
      "Report a Problem":"Report a Problem","Reported Content":"Reported Content","Community Guidelines":"Community Guidelines",
      "Blocked Accounts":"Blocked Accounts","Security Alerts":"Security Alerts","Viewora Premium":"Viewora Premium",
      "Creator Monetization":"Creator Monetization","Payout method":"Payout method","Secure payments":"Secure payments",
      "Billing notes":"Billing notes","Theme":"Theme","Font Size":"Font Size","Language":"Language",
      "System":"System","Light":"Light","Dark":"Dark","Default":"Default","Large":"Large","Extra large":"Extra large",
      "Everyone":"Everyone","Followers":"Followers","People you follow":"People you follow","No one":"No one",
      "Off":"Off","Approval required":"Approval required","Wi‑Fi only":"Wi‑Fi only","Always":"Always","Never":"Never",
      "High":"High","Medium":"Medium","Data saver":"Data saver","Auto":"Auto","Save":"Save","Cancel":"Cancel",
      "Back":"Back","Done":"Done","Edit":"Edit","Delete":"Delete","Follow":"Follow","Following":"Following",
      "Share":"Share","Like":"Like","Comment":"Comment","Comments":"Comments","Likes":"Likes","Stories":"Stories",
      "Shorts":"Shorts","Videos":"Videos","Posts":"Posts","Home":"Home","Search":"Search","Upload":"Upload",
      "Activity":"Activity","Profile":"Profile","Messages":"Messages","Account":"Account","Privacy":"Privacy",
      "Appearance":"Appearance","Log Out":"Log Out","Settings":"Settings","Public":"Public","Private":"Private",
      "Username":"Username","Email & Phone":"Email & Phone","Password & Security":"Password & Security",
      "Account Status":"Account Status","Active":"Active","Restricted":"Restricted","Suspended":"Suspended",
      "Who can follow me":"Who can follow me","Who can message me":"Who can message me","Who can comment":"Who can comment",
      "Mentions & Tags":"Mentions & Tags","Story Privacy":"Story Privacy","Message Requests":"Message Requests",
      "Message Privacy":"Message Privacy","Group Invitations":"Group Invitations","Voice Calls":"Voice Calls",
      "Video Calls":"Video Calls","Call Notifications":"Call Notifications","Media Auto-download":"Media Auto-download",
      "Read Receipts":"Read Receipts","Activity Status":"Activity Status","Upload Quality":"Upload Quality",
      "Video Quality":"Video Quality","Data Saver":"Data Saver","Autoplay":"Autoplay","Save Original Media":"Save Original Media",
      "Download Permissions":"Download Permissions","Sensitive Content Controls":"Sensitive Content Controls",
      "Login required":"Login required","Invalid OTP":"Invalid OTP","Invalid email":"Invalid email","Verified":"Verified",
      "Try Again":"Try Again","Update":"Update","Users":"Users"
    }
  };

  COMMON.hi = {
    "Users":"यूज़र्स","Create":"बनाएँ","Notifications":"नोटिफिकेशन","Notification Settings":"नोटिफिकेशन सेटिंग्स",
    "Messages & Calls":"मैसेज और कॉल","Content & Media":"कंटेंट और मीडिया","Data & Storage":"डेटा और स्टोरेज",
    "About Viewora":"Viewora के बारे में","Search settings":"सेटिंग्स खोजें","Profile, email, password, delete":"प्रोफ़ाइल, ईमेल, पासवर्ड, डिलीट",
    "Private account, messages, story":"प्राइवेट अकाउंट, मैसेज, स्टोरी","Push, likes, messages, email":"पुश, लाइक, मैसेज, ईमेल",
    "Requests, privacy, voice & video":"रिक्वेस्ट, प्राइवेसी, वॉइस और वीडियो","Quality, autoplay, data saver":"क्वालिटी, ऑटोप्ले, डेटा सेवर",
    "Report a Problem":"समस्या की रिपोर्ट करें","Reported Content":"रिपोर्ट किया गया कंटेंट","Community Guidelines":"कम्युनिटी गाइडलाइंस",
    "Blocked Accounts":"ब्लॉक किए गए अकाउंट","Security Alerts":"सिक्योरिटी अलर्ट","Viewora Premium":"Viewora प्रीमियम",
    "Creator Monetization":"क्रिएटर मोनेटाइजेशन","Payout method":"पेआउट मेथड","Secure payments":"सुरक्षित भुगतान",
    "Billing notes":"बिलिंग जानकारी","Theme":"थीम","Font Size":"फ़ॉन्ट साइज़","Language":"भाषा",
    "System":"सिस्टम","Light":"लाइट","Dark":"डार्क","Default":"डिफ़ॉल्ट","Large":"बड़ा","Extra large":"बहुत बड़ा",
    "Everyone":"सभी","Followers":"फॉलोअर्स","People you follow":"जिन्हें आप फॉलो करते हैं","No one":"कोई नहीं",
    "Off":"बंद","Approval required":"अनुमोदन आवश्यक","Wi‑Fi only":"केवल Wi‑Fi","Always":"हमेशा","Never":"कभी नहीं",
    "High":"उच्च","Medium":"मध्यम","Data saver":"डेटा सेवर","Auto":"ऑटो","Save":"सेव","Cancel":"रद्द करें",
    "Back":"वापस","Done":"हो गया","Edit":"एडिट","Delete":"डिलीट","Follow":"फॉलो","Following":"फॉलोइंग",
    "Share":"शेयर","Like":"लाइक","Comment":"कमेंट","Comments":"कमेंट्स","Likes":"लाइक्स","Stories":"स्टोरीज़",
    "Shorts":"शॉर्ट्स","Videos":"वीडियो","Posts":"पोस्ट","Home":"होम","Search":"खोजें","Upload":"अपलोड",
    "Activity":"एक्टिविटी","Profile":"प्रोफ़ाइल","Messages":"मैसेज","Account":"अकाउंट","Privacy":"प्राइवेसी",
    "Appearance":"दिखावट","Log Out":"लॉग आउट","Settings":"सेटिंग्स","Public":"पब्लिक","Private":"प्राइवेट",
    "Username":"यूज़रनेम","Email & Phone":"ईमेल और फोन","Password & Security":"पासवर्ड और सिक्योरिटी",
    "Account Status":"अकाउंट स्टेटस","Active":"सक्रिय","Restricted":"प्रतिबंधित","Suspended":"सस्पेंडेड",
    "Who can follow me":"मुझे कौन फॉलो कर सकता है","Who can message me":"मुझे कौन मैसेज कर सकता है","Who can comment":"कौन कमेंट कर सकता है",
    "Mentions & Tags":"मेंशन और टैग","Story Privacy":"स्टोरी प्राइवेसी","Message Requests":"मैसेज रिक्वेस्ट",
    "Message Privacy":"मैसेज प्राइवेसी","Group Invitations":"ग्रुप इनवाइट","Voice Calls":"वॉइस कॉल",
    "Video Calls":"वीडियो कॉल","Call Notifications":"कॉल नोटिफिकेशन","Media Auto-download":"मीडिया ऑटो-डाउनलोड",
    "Read Receipts":"रीड रिसीट्स","Activity Status":"एक्टिविटी स्टेटस","Upload Quality":"अपलोड क्वालिटी",
    "Video Quality":"वीडियो क्वालिटी","Data Saver":"डेटा सेवर","Autoplay":"ऑटोप्ले","Save Original Media":"ओरिजिनल मीडिया सेव करें",
    "Download Permissions":"डाउनलोड परमिशन","Sensitive Content Controls":"सेंसिटिव कंटेंट कंट्रोल",
    "Login required":"लॉगिन आवश्यक","Invalid OTP":"गलत OTP","Invalid email":"गलत ईमेल","Verified":"सत्यापित",
    "Try Again":"फिर कोशिश करें","Update":"अपडेट"
  };
  COMMON.ja = {
    "Settings":"設定","Account":"アカウント","Privacy":"プライバシー","Appearance":"外観","Log Out":"ログアウト",
    "Home":"ホーム","Search":"検索","Upload":"アップロード","Activity":"アクティビティ","Profile":"プロフィール",
    "Messages":"メッセージ","Save":"保存","Cancel":"キャンセル","Back":"戻る","Done":"完了","Edit":"編集","Delete":"削除",
    "Follow":"フォロー","Following":"フォロー中","Share":"共有","Like":"いいね","Comment":"コメント","Comments":"コメント",
    "Likes":"いいね","Stories":"ストーリー","Shorts":"ショート","Videos":"動画","Posts":"投稿","Language":"言語",
    "Font Size":"文字サイズ","Theme":"テーマ","System":"システム","Light":"ライト","Dark":"ダーク","Default":"デフォルト",
    "Large":"大","Extra large":"特大","Everyone":"全員","Followers":"フォロワー","People you follow":"フォロー中の人",
    "No one":"誰もいない","Off":"オフ","Approval required":"承認が必要","Notifications":"通知","Notification Settings":"通知設定",
    "Messages & Calls":"メッセージと通話","Content & Media":"コンテンツとメディア","Data & Storage":"データとストレージ",
    "About Viewora":"Vieworaについて","Search settings":"設定を検索","Viewora Premium":"Vieworaプレミアム",
    "Creator Monetization":"クリエイターモネタイズ","Payout method":"支払い方法","Who can follow me":"フォローできる人",
    "Who can message me":"メッセージできる人","Who can comment":"コメントできる人","Story Privacy":"ストーリーのプライバシー",
    "Message Requests":"メッセージリクエスト","Message Privacy":"メッセージのプライバシー","Voice Calls":"音声通話",
    "Video Calls":"ビデオ通話","Call Notifications":"通話通知","Read Receipts":"既読通知","Activity Status":"アクティビティステータス",
    "Upload Quality":"アップロード品質","Video Quality":"動画品質","Data Saver":"データセーバー","Autoplay":"自動再生",
    "Blocked Accounts":"ブロック済みアカウント","Community Guidelines":"コミュニティガイドライン","Security Alerts":"セキュリティ通知",
    "Try Again":"もう一度試す","Update":"更新"
  };
  COMMON.zh = {
    "Settings":"设置","Account":"账户","Privacy":"隐私","Appearance":"外观","Log Out":"退出登录","Home":"首页",
    "Search":"搜索","Upload":"上传","Activity":"动态","Profile":"个人资料","Messages":"消息","Save":"保存","Cancel":"取消",
    "Back":"返回","Done":"完成","Edit":"编辑","Delete":"删除","Follow":"关注","Following":"已关注","Share":"分享","Like":"赞",
    "Comment":"评论","Comments":"评论","Likes":"赞","Stories":"故事","Shorts":"短视频","Videos":"视频","Posts":"帖子",
    "Language":"语言","Font Size":"字体大小","Theme":"主题","System":"系统","Light":"浅色","Dark":"深色","Default":"默认",
    "Large":"大","Extra large":"特大","Everyone":"所有人","Followers":"关注者","People you follow":"你关注的人","No one":"没有人",
    "Off":"关闭","Notifications":"通知","Notification Settings":"通知设置","Messages & Calls":"消息和通话",
    "Content & Media":"内容和媒体","Data & Storage":"数据和存储","About Viewora":"关于 Viewora","Search settings":"搜索设置",
    "Viewora Premium":"Viewora 高级版","Creator Monetization":"创作者收益","Payout method":"收款方式",
    "Who can follow me":"谁可以关注我","Who can message me":"谁可以给我发消息","Who can comment":"谁可以评论我",
    "Story Privacy":"故事隐私","Message Requests":"消息请求","Message Privacy":"消息隐私","Voice Calls":"语音通话",
    "Video Calls":"视频通话","Call Notifications":"通话通知","Read Receipts":"已读回执","Activity Status":"活动状态",
    "Upload Quality":"上传质量","Video Quality":"视频质量","Data Saver":"省流量","Autoplay":"自动播放",
    "Blocked Accounts":"已屏蔽账户","Community Guidelines":"社区指南","Security Alerts":"安全提醒","Try Again":"重试","Update":"更新"
  };
  COMMON.ko = {
    "Settings":"설정","Account":"계정","Privacy":"개인정보","Appearance":"화면","Log Out":"로그아웃","Home":"홈",
    "Search":"검색","Upload":"업로드","Activity":"활동","Profile":"프로필","Messages":"메시지","Save":"저장","Cancel":"취소",
    "Back":"뒤로","Done":"완료","Edit":"편집","Delete":"삭제","Follow":"팔로우","Following":"팔로잉","Share":"공유","Like":"좋아요",
    "Comment":"댓글","Comments":"댓글","Likes":"좋아요","Stories":"스토리","Shorts":"쇼츠","Videos":"동영상","Posts":"게시물",
    "Language":"언어","Font Size":"글꼴 크기","Theme":"테마","System":"시스템","Light":"라이트","Dark":"다크","Default":"기본",
    "Large":"크게","Extra large":"매우 크게","Everyone":"모두","Followers":"팔로워","People you follow":"팔로우하는 사람",
    "No one":"아무도 없음","Off":"끔","Notifications":"알림","Notification Settings":"알림 설정","Messages & Calls":"메시지 및 통화",
    "Content & Media":"콘텐츠 및 미디어","Data & Storage":"데이터 및 저장공간","About Viewora":"Viewora 정보","Search settings":"설정 검색",
    "Viewora Premium":"Viewora 프리미엄","Creator Monetization":"크리에이터 수익화","Payout method":"지급 방법",
    "Who can follow me":"나를 팔로우할 수 있는 사람","Who can message me":"나에게 메시지할 수 있는 사람","Who can comment":"댓글을 달 수 있는 사람",
    "Story Privacy":"스토리 개인정보","Message Requests":"메시지 요청","Voice Calls":"음성 통화","Video Calls":"영상 통화",
    "Call Notifications":"통화 알림","Read Receipts":"읽음 확인","Activity Status":"활동 상태","Upload Quality":"업로드 품질",
    "Video Quality":"영상 품질","Data Saver":"데이터 절약","Autoplay":"자동 재생","Blocked Accounts":"차단된 계정",
    "Community Guidelines":"커뮤니티 가이드라인","Security Alerts":"보안 알림","Try Again":"다시 시도","Update":"업데이트"
  };
  COMMON.fr = Object.assign({}, COMMON.en, {
    Settings:"Paramètres",Account:"Compte",Privacy:"Confidentialité",Appearance:"Apparence","Log Out":"Déconnexion",
    Home:"Accueil",Search:"Rechercher",Upload:"Téléverser",Activity:"Activité",Profile:"Profil",Messages:"Messages",
    Save:"Enregistrer",Cancel:"Annuler",Back:"Retour",Done:"Terminé",Edit:"Modifier",Delete:"Supprimer",
    Follow:"Suivre",Following:"Abonné",Share:"Partager",Like:"J’aime",Comment:"Commenter",Comments:"Commentaires",
    Likes:"J’aime",Stories:"Stories",Shorts:"Shorts",Videos:"Vidéos",Posts:"Publications",Language:"Langue",
    "Font Size":"Taille de police",Theme:"Thème",System:"Système",Light:"Clair",Dark:"Sombre",Default:"Par défaut",
    Large:"Grand","Extra large":"Très grand",Everyone:"Tout le monde",Followers:"Abonnés","People you follow":"Personnes que vous suivez",
    "No one":"Personne",Off:"Désactivé",Notifications:"Notifications","Notification Settings":"Paramètres des notifications",
    "Messages & Calls":"Messages et appels","Content & Media":"Contenu et médias","Data & Storage":"Données et stockage",
    "About Viewora":"À propos de Viewora","Search settings":"Rechercher dans les paramètres","Viewora Premium":"Viewora Premium",
    "Creator Monetization":"Monétisation des créateurs","Payout method":"Mode de paiement","Who can follow me":"Qui peut me suivre",
    "Who can message me":"Qui peut m’envoyer des messages","Who can comment":"Qui peut commenter","Story Privacy":"Confidentialité des stories",
    "Message Requests":"Demandes de messages","Voice Calls":"Appels vocaux","Video Calls":"Appels vidéo","Call Notifications":"Notifications d’appel",
    "Read Receipts":"Accusés de lecture","Activity Status":"Statut d’activité","Upload Quality":"Qualité d’importation",
    "Video Quality":"Qualité vidéo","Data Saver":"Économiseur de données","Autoplay":"Lecture automatique","Blocked Accounts":"Comptes bloqués",
    "Community Guidelines":"Règles de la communauté","Security Alerts":"Alertes de sécurité","Try Again":"Réessayer",Update:"Mettre à jour"
  });
  COMMON.es = Object.assign({}, COMMON.en, {
    Settings:"Ajustes",Account:"Cuenta",Privacy:"Privacidad",Appearance:"Apariencia","Log Out":"Cerrar sesión",Home:"Inicio",
    Search:"Buscar",Upload:"Subir",Activity:"Actividad",Profile:"Perfil",Messages:"Mensajes",Save:"Guardar",Cancel:"Cancelar",
    Back:"Atrás",Done:"Listo",Edit:"Editar",Delete:"Eliminar",Follow:"Seguir",Following:"Siguiendo",Share:"Compartir",
    Like:"Me gusta",Comment:"Comentar",Comments:"Comentarios",Likes:"Me gusta",Stories:"Historias",Shorts:"Shorts",Videos:"Videos",
    Posts:"Publicaciones",Language:"Idioma","Font Size":"Tamaño de fuente",Theme:"Tema",System:"Sistema",Light:"Claro",Dark:"Oscuro",
    Default:"Predeterminado",Large:"Grande","Extra large":"Muy grande",Everyone:"Todos",Followers:"Seguidores",
    "People you follow":"Personas que sigues","No one":"Nadie",Off:"Desactivado",Notifications:"Notificaciones",
    "Notification Settings":"Ajustes de notificaciones","Messages & Calls":"Mensajes y llamadas","Content & Media":"Contenido y medios",
    "Data & Storage":"Datos y almacenamiento","About Viewora":"Acerca de Viewora","Search settings":"Buscar en ajustes",
    "Viewora Premium":"Viewora Premium","Creator Monetization":"Monetización de creadores","Payout method":"Método de pago",
    "Who can follow me":"Quién puede seguirme","Who can message me":"Quién puede enviarme mensajes","Who can comment":"Quién puede comentar",
    "Story Privacy":"Privacidad de historias","Message Requests":"Solicitudes de mensajes","Voice Calls":"Llamadas de voz",
    "Video Calls":"Videollamadas","Call Notifications":"Notificaciones de llamadas","Read Receipts":"Confirmaciones de lectura",
    "Activity Status":"Estado de actividad","Upload Quality":"Calidad de subida","Video Quality":"Calidad de video",
    "Data Saver":"Ahorro de datos","Autoplay":"Reproducción automática","Blocked Accounts":"Cuentas bloqueadas",
    "Community Guidelines":"Normas de la comunidad","Security Alerts":"Alertas de seguridad","Try Again":"Intentar de nuevo",Update:"Actualizar"
  });
  COMMON.de = Object.assign({}, COMMON.en, {
    Settings:"Einstellungen",Account:"Konto",Privacy:"Datenschutz",Appearance:"Erscheinungsbild","Log Out":"Abmelden",
    Home:"Startseite",Search:"Suche",Upload:"Hochladen",Activity:"Aktivität",Profile:"Profil",Messages:"Nachrichten",
    Save:"Speichern",Cancel:"Abbrechen",Back:"Zurück",Done:"Fertig",Edit:"Bearbeiten",Delete:"Löschen",Follow:"Folgen",
    Following:"Gefolgt",Share:"Teilen",Like:"Gefällt mir",Comment:"Kommentieren",Comments:"Kommentare",Likes:"Gefällt mir",
    Stories:"Stories",Shorts:"Shorts",Videos:"Videos",Posts:"Beiträge",Language:"Sprache","Font Size":"Schriftgröße",Theme:"Design",
    System:"System",Light:"Hell",Dark:"Dunkel",Default:"Standard",Large:"Groß","Extra large":"Sehr groß",Everyone:"Jeder",
    Followers:"Follower","People you follow":"Personen, denen du folgst","No one":"Niemand",Off:"Aus",Notifications:"Benachrichtigungen",
    "Notification Settings":"Benachrichtigungseinstellungen","Messages & Calls":"Nachrichten & Anrufe","Content & Media":"Inhalte & Medien",
    "Data & Storage":"Daten & Speicher","About Viewora":"Über Viewora","Search settings":"Einstellungen durchsuchen",
    "Viewora Premium":"Viewora Premium","Creator Monetization":"Creator-Monetarisierung","Payout method":"Auszahlungsmethode",
    "Who can follow me":"Wer mir folgen kann","Who can message me":"Wer mir schreiben kann","Who can comment":"Wer kommentieren kann",
    "Story Privacy":"Story-Privatsphäre","Message Requests":"Nachrichtenanfragen","Voice Calls":"Sprachanrufe","Video Calls":"Videoanrufe",
    "Call Notifications":"Anrufbenachrichtigungen","Read Receipts":"Lesebestätigungen","Activity Status":"Aktivitätsstatus",
    "Upload Quality":"Upload-Qualität","Video Quality":"Videoqualität","Data Saver":"Datensparmodus","Autoplay":"Automatische Wiedergabe",
    "Blocked Accounts":"Blockierte Konten","Community Guidelines":"Community-Richtlinien","Security Alerts":"Sicherheitswarnungen",
    "Try Again":"Erneut versuchen",Update:"Aktualisieren"
  });
  COMMON.ar = Object.assign({}, COMMON.en, {
    Settings:"الإعدادات",Account:"الحساب",Privacy:"الخصوصية",Appearance:"المظهر","Log Out":"تسجيل الخروج",Home:"الرئيسية",
    Search:"بحث",Upload:"رفع",Activity:"النشاط",Profile:"الملف الشخصي",Messages:"الرسائل",Save:"حفظ",Cancel:"إلغاء",
    Back:"رجوع",Done:"تم",Edit:"تعديل",Delete:"حذف",Follow:"متابعة",Following:"متابَع",Share:"مشاركة",Like:"إعجاب",
    Comment:"تعليق",Comments:"التعليقات",Likes:"الإعجابات",Stories:"القصص",Shorts:"المقاطع القصيرة",Videos:"الفيديوهات",
    Posts:"المنشورات",Language:"اللغة","Font Size":"حجم الخط",Theme:"المظهر",System:"النظام",Light:"فاتح",Dark:"داكن",
    Default:"افتراضي",Large:"كبير","Extra large":"كبير جدًا",Everyone:"الجميع",Followers:"المتابعون","People you follow":"الأشخاص الذين تتابعهم",
    "No one":"لا أحد",Off:"إيقاف",Notifications:"الإشعارات","Notification Settings":"إعدادات الإشعارات","Messages & Calls":"الرسائل والمكالمات",
    "Content & Media":"المحتوى والوسائط","Data & Storage":"البيانات والتخزين","About Viewora":"حول Viewora","Search settings":"بحث في الإعدادات",
    "Viewora Premium":"Viewora Premium","Creator Monetization":"تحقيق الدخل للمنشئين","Payout method":"طريقة الدفع",
    "Who can follow me":"من يمكنه متابعتي","Who can message me":"من يمكنه مراسلتي","Who can comment":"من يمكنه التعليق",
    "Story Privacy":"خصوصية القصة","Message Requests":"طلبات الرسائل","Voice Calls":"المكالمات الصوتية","Video Calls":"مكالمات الفيديو",
    "Call Notifications":"إشعارات المكالمات","Read Receipts":"إيصالات القراءة","Activity Status":"حالة النشاط",
    "Upload Quality":"جودة الرفع","Video Quality":"جودة الفيديو","Data Saver":"توفير البيانات","Autoplay":"التشغيل التلقائي",
    "Blocked Accounts":"الحسابات المحظورة","Community Guidelines":"إرشادات المجتمع","Security Alerts":"تنبيهات الأمان",
    "Try Again":"حاول مرة أخرى",Update:"تحديث"
  });
  COMMON.pt = Object.assign({}, COMMON.en, {
    Settings:"Configurações",Account:"Conta",Privacy:"Privacidade",Appearance:"Aparência","Log Out":"Sair",Home:"Início",
    Search:"Pesquisar",Upload:"Enviar",Activity:"Atividade",Profile:"Perfil",Messages:"Mensagens",Save:"Salvar",Cancel:"Cancelar",
    Back:"Voltar",Done:"Concluído",Edit:"Editar",Delete:"Excluir",Follow:"Seguir",Following:"Seguindo",Share:"Compartilhar",
    Like:"Curtir",Comment:"Comentar",Comments:"Comentários",Likes:"Curtidas",Stories:"Stories",Shorts:"Shorts",Videos:"Vídeos",
    Posts:"Publicações",Language:"Idioma","Font Size":"Tamanho da fonte",Theme:"Tema",System:"Sistema",Light:"Claro",Dark:"Escuro",
    Default:"Padrão",Large:"Grande","Extra large":"Muito grande",Everyone:"Todos",Followers:"Seguidores","People you follow":"Pessoas que você segue",
    "No one":"Ninguém",Off:"Desativado",Notifications:"Notificações","Notification Settings":"Configurações de notificações",
    "Messages & Calls":"Mensagens e chamadas","Content & Media":"Conteúdo e mídia","Data & Storage":"Dados e armazenamento",
    "About Viewora":"Sobre o Viewora","Search settings":"Pesquisar nas configurações","Viewora Premium":"Viewora Premium",
    "Creator Monetization":"Monetização de criadores","Payout method":"Método de pagamento","Who can follow me":"Quem pode me seguir",
    "Who can message me":"Quem pode me enviar mensagens","Who can comment":"Quem pode comentar","Story Privacy":"Privacidade dos stories",
    "Message Requests":"Solicitações de mensagens","Voice Calls":"Chamadas de voz","Video Calls":"Chamadas de vídeo",
    "Call Notifications":"Notificações de chamadas","Read Receipts":"Confirmações de leitura","Activity Status":"Status de atividade",
    "Upload Quality":"Qualidade de upload","Video Quality":"Qualidade do vídeo","Data Saver":"Economia de dados",
    "Autoplay":"Reprodução automática","Blocked Accounts":"Contas bloqueadas","Community Guidelines":"Diretrizes da comunidade",
    "Security Alerts":"Alertas de segurança","Try Again":"Tentar novamente",Update:"Atualizar"
  });
  COMMON.ru = Object.assign({}, COMMON.en, {
    Settings:"Настройки",Account:"Аккаунт",Privacy:"Конфиденциальность",Appearance:"Внешний вид","Log Out":"Выйти",Home:"Главная",
    Search:"Поиск",Upload:"Загрузить",Activity:"Активность",Profile:"Профиль",Messages:"Сообщения",Save:"Сохранить",Cancel:"Отмена",
    Back:"Назад",Done:"Готово",Edit:"Изменить",Delete:"Удалить",Follow:"Подписаться",Following:"Подписки",Share:"Поделиться",
    Like:"Нравится",Comment:"Комментарий",Comments:"Комментарии",Likes:"Нравится",Stories:"Истории",Shorts:"Короткие видео",
    Videos:"Видео",Posts:"Публикации",Language:"Язык","Font Size":"Размер шрифта",Theme:"Тема",System:"Система",Light:"Светлая",
    Dark:"Тёмная",Default:"По умолчанию",Large:"Большой","Extra large":"Очень большой",Everyone:"Все",Followers:"Подписчики",
    "People you follow":"Люди, на которых вы подписаны","No one":"Никто",Off:"Выкл.",Notifications:"Уведомления",
    "Notification Settings":"Настройки уведомлений","Messages & Calls":"Сообщения и звонки","Content & Media":"Контент и медиа",
    "Data & Storage":"Данные и хранилище","About Viewora":"О Viewora","Search settings":"Поиск в настройках","Viewora Premium":"Viewora Premium",
    "Creator Monetization":"Монетизация авторов","Payout method":"Способ выплаты","Who can follow me":"Кто может подписываться на меня",
    "Who can message me":"Кто может писать мне","Who can comment":"Кто может комментировать","Story Privacy":"Конфиденциальность историй",
    "Message Requests":"Запросы сообщений","Voice Calls":"Голосовые вызовы","Video Calls":"Видеозвонки","Call Notifications":"Уведомления о звонках",
    "Read Receipts":"Отчёты о прочтении","Activity Status":"Статус активности","Upload Quality":"Качество загрузки",
    "Video Quality":"Качество видео","Data Saver":"Экономия данных","Autoplay":"Автовоспроизведение","Blocked Accounts":"Заблокированные аккаунты",
    "Community Guidelines":"Правила сообщества","Security Alerts":"Оповещения безопасности","Try Again":"Повторить",Update:"Обновить"
  });
  COMMON.sa = Object.assign({}, COMMON.en, {
    Settings:"व्यवस्थाः",Account:"खाता",Privacy:"गोपनीयता",Appearance:"रूपम्","Log Out":"निर्गमनम्",Home:"गृहम्",
    Search:"अन्वेषणम्",Upload:"उत्थापनम्",Activity:"क्रिया",Profile:"प्रोफ़ाइल्",Messages:"सन्देशाः",Save:"रक्षतु",
    Cancel:"निरसयतु",Back:"पुनः",Done:"सम्पन्नम्",Edit:"सम्पादयतु",Delete:"विलोपयतु",Follow:"अनुसरतु",Following:"अनुसरणम्",
    Share:"विभजतु",Like:"रोचते",Comment:"टिप्पणी",Comments:"टिप्पण्यः",Likes:"रुचयः",Stories:"कथाः",Shorts:"लघु",
    Videos:"चलचित्राणि",Posts:"प्रकाशनानि",Language:"भाषा","Font Size":"अक्षरमात्रा",Theme:"आकृतिः",System:"प्रणाली",
    Light:"शुक्लम्",Dark:"कृष्णम्",Default:"मानकः",Large:"बृहत्","Extra large":"अतिबृहत्",Everyone:"सर्वे",Followers:"अनुसरणकर्तारः",
    "No one":"न कश्चित्",Off:"निष्क्रिय",Notifications:"सूचनाः","Notification Settings":"सूचना-व्यवस्थाः",
    "Messages & Calls":"सन्देशाः तथा आह्वानानि","Content & Media":"विषयः तथा माध्यमानि","Data & Storage":"दत्तांशः तथा सञ्चयः",
    "About Viewora":"Viewora विषये","Search settings":"व्यवस्थासु अन्वेषणम्","Viewora Premium":"Viewora प्रीमियम",
    "Creator Monetization":"निर्मातृ-आयः","Payout method":"भुगतान-विधिः","Who can follow me":"कः माम् अनुसर्तुं शक्नोति",
    "Who can message me":"कः मां सन्देशितुं शक्नोति","Who can comment":"कः टिप्पणीं कर्तुं शक्नोति","Story Privacy":"कथा-गोपनीयता",
    "Message Requests":"सन्देश-याचनाः","Voice Calls":"स्वर-आह्वानानि","Video Calls":"दृश्य-आह्वानानि","Call Notifications":"आह्वान-सूचनाः",
    "Read Receipts":"पठन-प्राप्तिसूचना","Activity Status":"क्रिया-स्थितिः","Upload Quality":"उत्थापन-गुणः","Video Quality":"चलचित्र-गुणः",
    "Data Saver":"दत्तांश-संरक्षणम्","Autoplay":"स्वयंचालनम्","Blocked Accounts":"अवरुद्ध-खातानि","Community Guidelines":"समुदाय-निर्देशाः",
    "Security Alerts":"सुरक्षा-सूचनाः","Try Again":"पुनः प्रयतताम्",Update:"नवीनीकरणम्"
  });

  Object.keys(COMMON).forEach(function(code) {
    I18N[code] = Object.assign({}, I18N[code] || {}, COMMON[code]);
  });
  // Fill any remaining supported language with English keys so auto-translation
  // never crashes.  Missing entries intentionally fall back to English.
  ["ur","bn"].forEach(function(code) {
    I18N[code] = Object.assign({}, I18N.en, COMMON[code] || {});
  });

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
        if (el.textContent !== val) el.textContent = val;
      } else {
        // update last text node
        var updated = false;
        for (var n = el.childNodes.length - 1; n >= 0; n--) {
          if (el.childNodes[n].nodeType === 3 && el.childNodes[n].textContent.trim()) {
            var nextText = " " + val + " ";
            if (el.childNodes[n].textContent !== nextText) {
              el.childNodes[n].textContent = nextText;
            }
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
    // Run after the full DOM exists so the selected font scale is visible.
    refreshFontAfterDom();
    applyLang(getLang());
    applyI18n(getLang());
  });

  // Re-apply i18n when DOM grows (nav, lists)
  try {
    var __i18nTimer = null;
    var vieworaI18nObserver = new MutationObserver(function () {
      clearTimeout(__i18nTimer);
      __i18nTimer = setTimeout(function () {
        try {
          applyI18n(getLang());
          refreshFontAfterDom();
        } catch (_) {}
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
