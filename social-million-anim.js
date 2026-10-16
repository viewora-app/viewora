/* Viewora — social icons animation on profile when IG/YT/X/FB linked.
 * If followers/subscribers >= 1_000_000 (or million:true), stronger mega animation.
 */
(function () {
  "use strict";
  function injectCss() {
    if (document.getElementById("vieworaSocialMegaCss")) return;
    var s = document.createElement("style");
    s.id = "vieworaSocialMegaCss";
    s.textContent =
      ".vieworaSocialLink{position:relative;display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;margin:0 6px;text-decoration:none;transition:transform .2s}" +
      ".vieworaSocialLink:hover{transform:scale(1.08)}" +
      ".vieworaSocialLink.socialPulse{animation:vieworaSocialPulse 2.4s ease-in-out infinite}" +
      ".vieworaSocialLink.socialMega{animation:vieworaSocialMega 2s linear infinite;background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(219,39,119,.25));box-shadow:0 0 16px rgba(139,92,246,.55)}" +
      ".vieworaSocialLink.socialMega::after{content:\"1M+\";position:absolute;bottom:-2px;right:-4px;font-size:8px;font-weight:800;background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;padding:1px 4px;border-radius:6px}" +
      "@keyframes vieworaSocialPulse{0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.4)}50%{box-shadow:0 0 0 10px rgba(139,92,246,0)}}" +
      "@keyframes vieworaSocialMega{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}";
    document.head.appendChild(s);
  }
  function isMillion(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (entry.million === true) return true;
    var n = Number(entry.followers || entry.subscribers || entry.count || 0);
    return n >= 1000000;
  }
  function paint(container, socials) {
    if (!container || !socials) return;
    injectCss();
    var map = {
      instagram: { icon: "fa-instagram", color: "#E1306C" },
      facebook: { icon: "fa-facebook", color: "#1877F2" },
      x: { icon: "fa-x-twitter", color: "#fff" },
      youtube: { icon: "fa-youtube", color: "#FF0000" },
      linkedin: { icon: "fa-linkedin", color: "#0A66C2" },
      pinterest: { icon: "fa-pinterest", color: "#E60023" }
    };
    Object.keys(map).forEach(function (k) {
      var s = socials[k];
      if (!s) return;
      var url = typeof s === "string" ? s : s.url || "";
      if (!url) return;
      var a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "vieworaSocialLink " + (isMillion(s) ? "socialMega" : "socialPulse");
      a.title = k;
      a.innerHTML = "<i class=\"fa-brands " + map[k].icon + "\" style=\"color:" + map[k].color + ";font-size:18px\"></i>";
      container.appendChild(a);
    });
  }
  window.VieworaSocialAnim = { paint: paint, isMillion: isMillion };
  document.addEventListener("DOMContentLoaded", function () {
    try {
      var box = document.getElementById("profileSocials");
      if (box && window.__vieworaProfileSocials) paint(box, window.__vieworaProfileSocials);
    } catch (_) {}
  });
})();
