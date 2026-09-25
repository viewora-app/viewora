(function () {
  "use strict";
  var filter = "all";
  var allItems = [];

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dayLabel(ts) {
    var d = new Date(Number(ts) || 0);
    var now = new Date();
    var startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var startY = startToday - 86400000;
    var t = d.getTime();
    if (t >= startToday) return "Today";
    if (t >= startY) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function loadLocal() {
    var a = [];
    try {
      a = JSON.parse(localStorage.getItem("viewora_watch_history") || "[]") || [];
    } catch (_) { a = []; }
    if (!a.length) {
      try {
        a = JSON.parse(sessionStorage.getItem("viewora_watch_history") || "[]") || [];
      } catch (_) {}
    }
    if (!a.length) {
      try {
        var u = firebase.auth().currentUser;
        if (u) a = JSON.parse(localStorage.getItem("viewora_watch_history_" + u.uid) || "[]") || [];
      } catch (_) {}
    }
    if (!Array.isArray(a)) a = [];
    return a;
  }

  async function loadFirebase() {
    var items = [];
    try {
      if (typeof firebase === "undefined") return items;
      var u = firebase.auth().currentUser;
      if (!u) return items;
      var snap = await firebase.database().ref("users/" + u.uid + "/watchHistory").once("value");
      if (!snap.exists()) return items;
      snap.forEach(function (ch) {
        var v = ch.val() || {};
        items.push({
          videoId: v.videoId || ch.key,
          type: (v.type || "video").toLowerCase(),
          title: v.title || "Video",
          thumb: v.thumb || "",
          ownerName: v.ownerName || "",
          progress: Number(v.progress) || 0,
          at: v.at || 0
        });
      });
    } catch (_) {}
    return items;
  }

  function merge(a, b) {
    var map = {};
    a.concat(b).forEach(function (it) {
      if (!it || !it.videoId) return;
      var k = (it.type || "video") + "_" + it.videoId;
      if (!map[k] || (it.at || 0) > (map[k].at || 0)) map[k] = it;
    });
    return Object.keys(map)
      .map(function (k) { return map[k]; })
      .sort(function (x, y) { return (y.at || 0) - (x.at || 0); });
  }

  function render() {
    var q = (($("hQuery") && $("hQuery").value) || "").trim().toLowerCase();
    var list = allItems.filter(function (it) {
      var t = (it.type || "video").toLowerCase();
      if (t === "shorts") t = "short";
      if (filter === "video" && t === "short") return false;
      if (filter === "short" && t !== "short") return false;
      if (!q) return true;
      return (
        String(it.title || "").toLowerCase().indexOf(q) !== -1 ||
        String(it.ownerName || "").toLowerCase().indexOf(q) !== -1
      );
    });

    var main = $("hMain");
    if (!list.length) {
      var rawN = 0;
      try { rawN = (JSON.parse(localStorage.getItem("viewora_watch_history")||"[]")||[]).length; } catch(_){}
      main.innerHTML =
        '<div class="hEmpty" id="hEmpty">No history yet.<br>Videos &amp; Shorts you watch will show up here.' +
        (rawN ? '<br><small style="opacity:.5">storage:'+rawN+' (filter empty)</small>' : '') +
        '<br><br><button type="button" id="hTestSave" style="margin-top:12px;padding:10px 16px;border-radius:12px;border:0;background:#7c5cff;color:#fff;font-weight:700">Test save (debug)</button>' +
        '</div>';
      setTimeout(function () {
        var b = $("hTestSave");
        if (!b) return;
        b.onclick = function () {
          try {
            if (window.VieworaRecordWatch) {
              VieworaRecordWatch({
                videoId: "test_" + Date.now(),
                type: "video",
                title: "Test watch item",
                thumb: "",
                progress: 0.4
              });
            }
            allItems = merge(loadLocal(), allItems);
            render();
          } catch (e) { alert(String(e)); }
        };
      }, 50);
      return;
    }

    // group by day
    var groups = {};
    var order = [];
    list.forEach(function (it) {
      var lab = dayLabel(it.at);
      if (!groups[lab]) {
        groups[lab] = [];
        order.push(lab);
      }
      groups[lab].push(it);
    });

    var html = "";
    order.forEach(function (lab) {
      var items = groups[lab];
      var shorts = items.filter(function (x) {
        var t = (x.type || "").toLowerCase();
        return t === "short" || t === "shorts";
      });
      var videos = items.filter(function (x) {
        var t = (x.type || "").toLowerCase();
        return t !== "short" && t !== "shorts";
      });

      html += '<div class="hDay">' + esc(lab) + "</div>";

      if (shorts.length && filter !== "video") {
        html += '<div class="hShortsRow">';
        shorts.forEach(function (it) {
          var href = "shorts.html?id=" + encodeURIComponent(it.videoId);
          var pctS = Math.round(Math.min(1, Math.max(0, Number(it.progress) || 0)) * 100);
          html +=
            '<button type="button" class="hShortCard" data-href="' +
            esc(href) +
            '"><div class="hThumbWrap">' +
            (it.thumb
              ? '<img class="hShortThumb" src="' + esc(it.thumb) + '" alt="" loading="lazy">'
              : '<div class="hShortThumb" style="display:grid;place-items:center;color:#555"><i class="fa-solid fa-play"></i></div>') +
            (pctS > 0 ? '<div class="hProg"><i style="width:' + pctS + '%"></i></div>' : '') +
            '</div><div class="hShortTitle">' +
            esc(it.title) +
            "</div>" +
            '<div class="hShortSub">' +
            esc(it.ownerName || "Short") +
            "</div></button>";
        });
        html += "</div>";
      }

      videos.forEach(function (it) {
        if (filter === "short") return;
        var href = "video.html?id=" + encodeURIComponent(it.videoId);
        var pctV = Math.round(Math.min(1, Math.max(0, Number(it.progress) || 0)) * 100);
        html +=
          '<button type="button" class="hVid" data-href="' +
          esc(href) +
          '">' +
          '<div class="hThumbWrap" style="position:relative;flex-shrink:0">' +
          (it.thumb
            ? '<img class="hVidThumb" src="' + esc(it.thumb) + '" alt="" loading="lazy">'
            : '<div class="hVidThumb" style="display:grid;place-items:center;color:#555"><i class="fa-solid fa-play"></i></div>') +
          (pctV > 0 ? '<div class="hProg"><i style="width:' + pctV + '%"></i></div>' : '') +
          "</div>" +
          '<div class="hVidMeta"><div class="hVidTitle">' +
          esc(it.title) +
          '</div><div class="hVidSub">' +
          esc(it.ownerName || "Video") +
          "</div></div></button>";
      });
    });

    main.innerHTML = html;
    main.querySelectorAll("[data-href]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        location.href = btn.getAttribute("data-href");
      });
    });
  }

  async function boot() {
    var local = loadLocal();
    try { console.log("[history] local items", local.length, local.slice(0,3)); } catch(_){}

    allItems = merge(local, []);
    render();

    function afterAuth(u) {
      loadFirebase().then(function (fb) {
        try { console.log("[history] firebase items", fb.length); } catch (_) {}
        allItems = merge(loadLocal(), fb);
        try {
          if (fb.length) {
            localStorage.setItem("viewora_watch_history", JSON.stringify(allItems.slice(0, 150)));
            if (u && u.uid)
              localStorage.setItem("viewora_watch_history_" + u.uid, JSON.stringify(allItems.slice(0, 150)));
          }
        } catch (_) {}
        render();
      });
    }

    try {
      if (firebase.auth().currentUser) afterAuth(firebase.auth().currentUser);
      else
        firebase.auth().onAuthStateChanged(function (u) {
          if (u) afterAuth(u);
        });
    } catch (_) {}

    setInterval(function () {
      try {
        var u = firebase.auth().currentUser;
        if (!u) return;
        loadFirebase().then(function (fb) {
          if (!fb || !fb.length) return;
          var merged = merge(loadLocal(), fb);
          if (merged.length !== allItems.length) {
            allItems = merged;
            render();
          }
        });
      } catch (_) {}
    }, 6000);
  }

  $("hBack").onclick = function () {
    if (history.length > 1) history.back();
    else location.href = "profile.html";
  };
  $("hClear").onclick = async function () {
    if (!confirm("Clear all watch history?")) return;
    try { localStorage.removeItem("viewora_watch_history"); } catch (_) {}
    try {
      var u = firebase.auth().currentUser;
      if (u) await firebase.database().ref("users/" + u.uid + "/watchHistory").remove();
    } catch (_) {}
    allItems = [];
    render();
  };
  $("hQuery").addEventListener("input", render);
  document.querySelectorAll(".hTab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".hTab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      filter = tab.getAttribute("data-filter") || "all";
      render();
    });
  });

  window.addEventListener("viewora-history-updated", function () {
    try {
      allItems = merge(loadLocal(), allItems);
      render();
    } catch (_) {}
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else boot();
})();
