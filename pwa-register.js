/* Register Viewora SW + manifest helpers */
(function () {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(function (e) {
      console.warn("[Viewora SW]", e);
    });
  });
})();
