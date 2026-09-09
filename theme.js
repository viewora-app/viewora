/*! Viewora global theme — dark / light */
(function () {
  "use strict";
  var KEY = "viewora_theme";

  function getTheme() {
    try {
      var t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") return t;
    } catch (_) {}
    return "dark";
  }

  function applyTheme(mode) {
    mode = mode === "light" ? "light" : "dark";
    var root = document.documentElement;
    root.setAttribute("data-theme", mode);
    root.classList.toggle("theme-light", mode === "light");
    root.classList.toggle("theme-dark", mode === "dark");
    try {
      localStorage.setItem(KEY, mode);
    } catch (_) {}
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

  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "light" ? "dark" : "light");
    return document.documentElement.getAttribute("data-theme");
  }

  // Apply ASAP
  applyTheme(getTheme());

  window.VieworaTheme = {
    get: getTheme,
    set: applyTheme,
    toggle: toggleTheme,
    apply: applyTheme
  };

  // Sync across tabs
  window.addEventListener("storage", function (e) {
    if (e.key === KEY && e.newValue) applyTheme(e.newValue);
  });
})();
