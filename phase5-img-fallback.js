/**
 * VIEWORA Phase 5 — global image fallback
 * Optional: <script src="phase5-img-fallback.js" defer></script>
 */
(function () {
  "use strict";
  var FALLBACK = "assets/default-avatar.png";

  function bind(img) {
    if (!img || img.__vieworaFb) return;
    img.__vieworaFb = true;
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      if (img.getAttribute("src") === FALLBACK) return;
      img.src = FALLBACK;
      img.setAttribute("data-fallback", "1");
    });
  }

  function scan(root) {
    (root || document).querySelectorAll("img").forEach(bind);
  }

  function start() {
    scan(document);
    try {
      var mo = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          m.addedNodes &&
            m.addedNodes.forEach(function (n) {
              if (n.nodeType !== 1) return;
              if (n.tagName === "IMG") bind(n);
              else if (n.querySelectorAll) scan(n);
            });
        });
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else start();
})();
