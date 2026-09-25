(function () {
  "use strict";

  var TOTAL_MS = 4500; // 4.5 seconds
  var navigated = false;
  var root = document.getElementById("splash");

  // starfield
  (function buildStars() {
    var box = document.getElementById("stars");
    if (!box) return;
    var n = 48;
    var html = "";
    for (var i = 0; i < n; i++) {
      var x = Math.random() * 100;
      var y = Math.random() * 100;
      var d = (1.8 + Math.random() * 2.5).toFixed(2);
      var delay = (Math.random() * 3).toFixed(2);
      var size = Math.random() > 0.85 ? 3 : 2;
      html +=
        '<span class="star" style="left:' +
        x +
        "%;top:" +
        y +
        "%;width:" +
        size +
        "px;height:" +
        size +
        "px;--dur:" +
        d +
        "s;--delay:" +
        delay +
        's"></span>';
    }
    box.innerHTML = html;
  })();

  function goNext() {
    if (navigated) return;
    navigated = true;
    try {
      sessionStorage.setItem("viewora_splash_seen", String(Date.now()));
      sessionStorage.removeItem("viewora_splash_redirecting");
    } catch (_) {}

    var target = "index.html";
    try {
      var ret = sessionStorage.getItem("viewora_return_to");
      if (ret && /\.html/i.test(ret) && ret.indexOf("splash") === -1) {
        sessionStorage.removeItem("viewora_return_to");
        target = ret;
      }
    } catch (_) {}

    // keep current page if opened as non-entry (admin etc.) — only when ?from= param
    try {
      var params = new URLSearchParams(location.search);
      if (params.get("next")) target = params.get("next");
    } catch (_) {}

    if (root) root.classList.add("exit");
    setTimeout(function () {
      window.location.replace(target);
    }, 420);
  }

  // ?skip=1 → skip for dev
  if (/[?&]skip=1/.test(location.search)) {
    window.location.replace("index.html");
    return;
  }

  setTimeout(goNext, TOTAL_MS);

  // tap to skip after 1.2s
  var armed = false;
  setTimeout(function () {
    armed = true;
  }, 1200);
  document.addEventListener(
    "click",
    function () {
      if (!armed) return;
      goNext();
    },
    { once: true }
  );
})();
