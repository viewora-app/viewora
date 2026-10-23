/**
 * Optional closed-beta invite code (soft)
 * Enable: localStorage OR set BETA_CODE below.
 * Signup page: <script src="beta-invite.js"></script>
 * Disable anytime: set ENABLED = false
 */
(function () {
  var ENABLED = true;
  var BETA_CODE = "VIEWORA-BETA"; // change before share with testers
  if (!ENABLED) return;
  if (window.__VIEWORA_BETA_INVITE__) return;
  window.__VIEWORA_BETA_INVITE__ = true;

  var path = (location.pathname || "").toLowerCase();
  if (path.indexOf("signup") === -1 && path.indexOf("onboarding") === -1) return;

  try {
    if (sessionStorage.getItem("viewora_beta_ok") === "1") return;
  } catch (_) {}

  function ask() {
    var entered = window.prompt("Closed Beta invite code:", "");
    if (entered == null) {
      location.href = "login.html";
      return;
    }
    if (String(entered).trim().toUpperCase() === BETA_CODE.toUpperCase()) {
      try {
        sessionStorage.setItem("viewora_beta_ok", "1");
      } catch (_) {}
      return;
    }
    alert("Invalid invite code. Closed beta only.");
    location.href = "login.html";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ask);
  else setTimeout(ask, 100);
})();
