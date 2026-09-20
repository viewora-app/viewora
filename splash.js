(function () {
  "use strict";

  var TOTAL_MS = 7800; // ~7.8 sec
  var WORLD_MS = 3200;
  var LOGO_MS = TOTAL_MS - WORLD_MS;

  var phaseWorld = document.getElementById("phaseWorld");
  var phaseLogo = document.getElementById("phaseLogo");
  var root = document.getElementById("splash");

  function goNext() {
    try {
      sessionStorage.setItem("viewora_splash_seen", String(Date.now()));
    } catch (_) {}

    var target = "index.html";
    try {
      // If user was deep-linked, honor returnTo once
      var ret = sessionStorage.getItem("viewora_return_to");
      if (ret && /\.html/.test(ret) && ret.indexOf("splash") === -1) {
        sessionStorage.removeItem("viewora_return_to");
        target = ret;
      }
    } catch (_) {}

    if (root) root.classList.add("exit");
    setTimeout(function () {
      window.location.replace(target);
    }, 420);
  }

  // Skip if already shown in this session (optional — comment out to always show)
  try {
    var seen = sessionStorage.getItem("viewora_splash_seen");
    var force = /[?&]splash=1/.test(location.search);
    if (seen && !force) {
      // Still show briefly? User asked 7-8 sec always on open — keep full animation
      // Only skip if ?skip=1
      if (/[?&]skip=1/.test(location.search)) {
        window.location.replace("index.html");
        return;
      }
    }
  } catch (_) {}

  // Phase 1 — world + hands
  requestAnimationFrame(function () {
    if (phaseWorld) phaseWorld.classList.add("show");
  });

  setTimeout(function () {
    if (phaseWorld) {
      phaseWorld.classList.remove("show");
      phaseWorld.classList.add("hide");
    }
    setTimeout(function () {
      if (phaseLogo) phaseLogo.classList.add("show");
    }, 280);
  }, WORLD_MS);

  setTimeout(goNext, TOTAL_MS);

  // Tap to skip after 1.5s
  var armed = false;
  setTimeout(function () { armed = true; }, 1500);
  document.addEventListener(
    "click",
    function () {
      if (!armed) return;
      goNext();
    },
    { once: true }
  );
})();
