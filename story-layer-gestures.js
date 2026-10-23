/**
 * Viewora Story editor — Instagram-style layer gestures
 * Drag, pinch-zoom, long-press drag to bin for text / sticker / music badge.
 * Include after story-upload.js
 */
(function () {
  if (window.__VIEWORA_STORY_GESTURES__) return;
  window.__VIEWORA_STORY_GESTURES__ = true;

  function ensureBin() {
    var bin = document.getElementById("storyDeleteBin");
    if (bin) return bin;
    bin = document.createElement("div");
    bin.id = "storyDeleteBin";
    bin.innerHTML = '<i class="fa-regular fa-trash-can"></i><span>Delete</span>';
    bin.style.cssText =
      "position:fixed;left:16px;top:calc(72px + env(safe-area-inset-top,0px));z-index:80;" +
      "display:none;align-items:center;justify-content:center;flex-direction:column;gap:4px;" +
      "width:56px;height:56px;border-radius:16px;background:rgba(0,0,0,.55);color:#fff;" +
      "font-size:11px;border:1px solid rgba(255,255,255,.2);backdrop-filter:blur(10px);" +
      "pointer-events:none;opacity:0;transition:opacity .15s,transform .15s,background .15s";
    document.body.appendChild(bin);
    return bin;
  }

  function showBin(active) {
    var bin = ensureBin();
    bin.style.display = "flex";
    bin.style.opacity = "1";
    if (active) {
      bin.style.background = "rgba(239,68,68,.9)";
      bin.style.transform = "scale(1.08)";
    } else {
      bin.style.background = "rgba(0,0,0,.55)";
      bin.style.transform = "scale(1)";
    }
  }
  function hideBin() {
    var bin = document.getElementById("storyDeleteBin");
    if (!bin) return;
    bin.style.opacity = "0";
    setTimeout(function () {
      if (bin.style.opacity === "0") bin.style.display = "none";
    }, 180);
  }

  function overBin(x, y) {
    var bin = document.getElementById("storyDeleteBin");
    if (!bin || bin.style.display === "none") return false;
    var r = bin.getBoundingClientRect();
    return x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
  }

  function wireLayer(el) {
    if (!el || el.__gestureWired) return;
    el.__gestureWired = true;
    el.style.touchAction = "none";
    el.style.userSelect = "none";
    el.style.cursor = "grab";
    if (!el.style.position) el.style.position = "absolute";

    var st = {
      x: 0,
      y: 0,
      scale: 1,
      rot: 0,
      pointers: {},
      mode: null,
      startDist: 0,
      startScale: 1,
      startAngle: 0,
      startRot: 0,
      ox: 0,
      oy: 0
    };

    function apply() {
      el.style.transform =
        "translate(-50%,-50%) translate(" +
        st.x +
        "px," +
        st.y +
        "px) scale(" +
        st.scale +
        ") rotate(" +
        st.rot +
        "deg)";
      el.style.transformOrigin = "center center";
    }
    // default center if no left/top
    if (!el.style.left && !el.style.top) {
      el.style.left = "50%";
      el.style.top = "45%";
    }
    apply();

    function dist(a, b) {
      var dx = a.x - b.x,
        dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function angle(a, b) {
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    }

    el.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      st.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(st.pointers);
      if (ids.length === 1) {
        st.mode = "drag";
        st.ox = e.clientX - st.x;
        st.oy = e.clientY - st.y;
        showBin(false);
      } else if (ids.length >= 2) {
        st.mode = "pinch";
        var p1 = st.pointers[ids[0]],
          p2 = st.pointers[ids[1]];
        st.startDist = dist(p1, p2) || 1;
        st.startScale = st.scale;
        st.startAngle = angle(p1, p2);
        st.startRot = st.rot;
      }
    });

    el.addEventListener("pointermove", function (e) {
      if (!st.pointers[e.pointerId]) return;
      st.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(st.pointers);
      if (st.mode === "drag" && ids.length === 1) {
        st.x = e.clientX - st.ox;
        st.y = e.clientY - st.oy;
        apply();
        showBin(overBin(e.clientX, e.clientY));
      } else if (ids.length >= 2) {
        var p1 = st.pointers[ids[0]],
          p2 = st.pointers[ids[1]];
        var d = dist(p1, p2) || 1;
        st.scale = Math.max(0.4, Math.min(4, st.startScale * (d / st.startDist)));
        st.rot = st.startRot + (angle(p1, p2) - st.startAngle);
        // mid point pan lightly
        apply();
      }
    });

    function endPtr(e) {
      if (st.pointers[e.pointerId] && st.mode === "drag") {
        if (overBin(e.clientX, e.clientY)) {
          try {
            el.remove();
          } catch (_) {}
          hideBin();
          st.pointers = {};
          st.mode = null;
          return;
        }
      }
      delete st.pointers[e.pointerId];
      if (!Object.keys(st.pointers).length) {
        st.mode = null;
        hideBin();
      } else if (Object.keys(st.pointers).length === 1) {
        st.mode = "drag";
        var p = st.pointers[Object.keys(st.pointers)[0]];
        st.ox = p.x - st.x;
        st.oy = p.y - st.y;
      }
    }
    el.addEventListener("pointerup", endPtr);
    el.addEventListener("pointercancel", endPtr);
  }

  function scan() {
    document.querySelectorAll("#textLayer .storyText, #stickerLayer .storySticker, #stickerLayer img, #musicBadge").forEach(wireLayer);
  }

  var obs = new MutationObserver(function () {
    scan();
  });
  function boot() {
    ensureBin();
    scan();
    try {
      var root = document.getElementById("storyStage") || document.getElementById("app") || document.body;
      obs.observe(root, { childList: true, subtree: true });
    } catch (_) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.VieworaStoryGestures = { scan: scan, wire: wireLayer };
})();
