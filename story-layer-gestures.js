/**
 * Story editor: 2-finger pinch zoom + drag + bin delete for text/sticker/music
 * Add in story-upload.html: <script src="story-layer-gestures.js"></script>
 */
(function () {
  if (window.__VIEWORA_STORY_GESTURES__) return;
  window.__VIEWORA_STORY_GESTURES__ = true;

  function ensureBin() {
    var bin = document.getElementById("storyDeleteBin");
    if (bin) return bin;
    bin = document.createElement("div");
    bin.id = "storyDeleteBin";
    bin.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
    bin.style.cssText =
      "position:fixed;left:18px;top:calc(80px + env(safe-area-inset-top,0px));z-index:120;" +
      "display:none;align-items:center;justify-content:center;width:54px;height:54px;" +
      "border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font-size:20px;" +
      "border:1px solid rgba(255,255,255,.2);pointer-events:none;opacity:0;transition:.15s";
    document.body.appendChild(bin);
    return bin;
  }
  function showBin(hot) {
    var b = ensureBin();
    b.style.display = "flex";
    b.style.opacity = "1";
    b.style.background = hot ? "rgba(239,68,68,.95)" : "rgba(0,0,0,.55)";
    b.style.transform = hot ? "scale(1.12)" : "scale(1)";
  }
  function hideBin() {
    var b = document.getElementById("storyDeleteBin");
    if (!b) return;
    b.style.opacity = "0";
    setTimeout(function () { if (b.style.opacity === "0") b.style.display = "none"; }, 160);
  }
  function overBin(x, y) {
    var b = document.getElementById("storyDeleteBin");
    if (!b || b.style.display === "none") return false;
    var r = b.getBoundingClientRect();
    return x > r.left - 16 && x < r.right + 16 && y > r.top - 16 && y < r.bottom + 16;
  }

  function wire(el) {
    if (!el || el.__g) return;
    el.__g = true;
    el.style.touchAction = "none";
    el.style.userSelect = "none";
    if (!el.style.position) el.style.position = "absolute";
    if (!el.style.left) el.style.left = "50%";
    if (!el.style.top) el.style.top = "42%";
    var st = { x: 0, y: 0, scale: 1, rot: 0, pts: {}, mode: null, sd: 1, ss: 1, sa: 0, sr: 0, ox: 0, oy: 0 };
    function apply() {
      el.style.transform =
        "translate(-50%,-50%) translate(" + st.x + "px," + st.y + "px) scale(" + st.scale + ") rotate(" + st.rot + "deg)";
      el.style.transformOrigin = "center center";
    }
    apply();
    function dist(a, b) {
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }
    function ang(a, b) {
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    }
    el.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      st.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(st.pts);
      if (ids.length === 1) {
        st.mode = "drag";
        st.ox = e.clientX - st.x;
        st.oy = e.clientY - st.y;
        showBin(false);
      } else {
        st.mode = "pinch";
        var p1 = st.pts[ids[0]], p2 = st.pts[ids[1]];
        st.sd = dist(p1, p2);
        st.ss = st.scale;
        st.sa = ang(p1, p2);
        st.sr = st.rot;
      }
    });
    el.addEventListener("pointermove", function (e) {
      if (!st.pts[e.pointerId]) return;
      st.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(st.pts);
      if (st.mode === "drag" && ids.length === 1) {
        st.x = e.clientX - st.ox;
        st.y = e.clientY - st.oy;
        apply();
        showBin(overBin(e.clientX, e.clientY));
      } else if (ids.length >= 2) {
        var p1 = st.pts[ids[0]], p2 = st.pts[ids[1]];
        st.scale = Math.max(0.35, Math.min(5, st.ss * (dist(p1, p2) / st.sd)));
        st.rot = st.sr + (ang(p1, p2) - st.sa);
        apply();
      }
    });
    function end(e) {
      if (st.pts[e.pointerId] && st.mode === "drag" && overBin(e.clientX, e.clientY)) {
        try { el.remove(); } catch (_) {}
        hideBin();
        st.pts = {};
        st.mode = null;
        return;
      }
      delete st.pts[e.pointerId];
      if (!Object.keys(st.pts).length) {
        st.mode = null;
        hideBin();
      }
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  function scan() {
    document
      .querySelectorAll("#textLayer .storyText, #textLayer > *, #stickerLayer .storySticker, #stickerLayer img, #stickerLayer > *, #musicBadge")
      .forEach(wire);
  }
  var obs = new MutationObserver(scan);
  function boot() {
    ensureBin();
    scan();
    try {
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
