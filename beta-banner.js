/**
 * Viewora Closed Beta badge
 * Add before </body> on index, signup, login, settings:
 *   <script src="beta-banner.js"></script>
 */
(function () {
  if (window.__VIEWORA_BETA_BANNER__) return;
  window.__VIEWORA_BETA_BANNER__ = true;
  try {
    if (localStorage.getItem("viewora_hide_beta_banner") === "1") return;
  } catch (_) {}

  var style = document.createElement("style");
  style.textContent =
    "#vieworaBetaBadge{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:99998;" +
    "background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font:600 11px/1.2 system-ui,sans-serif;" +
    "padding:6px 12px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.35);letter-spacing:.02em;" +
    "display:flex;align-items:center;gap:8px;max-width:92vw}" +
    "#vieworaBetaBadge button{background:transparent;border:0;color:#fff;opacity:.85;font-size:14px;padding:0 2px;cursor:pointer}" +
    "@media(min-width:768px){#vieworaBetaBadge{top:16px}}";
  document.head.appendChild(style);

  var el = document.createElement("div");
  el.id = "vieworaBetaBadge";
  el.setAttribute("role", "status");
  el.innerHTML =
    "<span>Closed Beta</span><span style=\"opacity:.8;font-weight:500\">· testers only</span>" +
    "<button type=\"button\" aria-label=\"Dismiss\" id=\"vieworaBetaDismiss\">×</button>";
  function mount() {
    if (!document.body) return;
    document.body.appendChild(el);
    var b = document.getElementById("vieworaBetaDismiss");
    if (b)
      b.onclick = function () {
        try {
          localStorage.setItem("viewora_hide_beta_banner", "1");
        } catch (_) {}
        el.remove();
      };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
