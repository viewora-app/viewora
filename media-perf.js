/*==========================================================
  Viewora Media Perf — lazy load + Cloudinary thumbs + compress
  Works WITHOUT Firebase Storage billing (uses CDN URLs)
==========================================================*/
(function (global) {
  "use strict";

  var CLOUD =
    global.VIEWORA_CLOUDINARY_CLOUD ||
    global.CLOUDINARY_CLOUD_NAME ||
    "z5m6wjdf";

  /** True if URL is a Cloudinary delivery URL */
  function isCloudinary(url) {
    return typeof url === "string" && /res\.cloudinary\.com\//i.test(url);
  }

  /**
   * Insert Cloudinary transforms: f_auto,q_auto, width/height
   * Example: thumb(url, 320) → smaller feed image
   */
  function cloudinaryTransform(url, opts) {
    opts = opts || {};
    if (!url || !isCloudinary(url)) return url;
    try {
      // .../upload/v123/folder/file → .../upload/TRANSFORMS/v123/...
      var parts = url.split("/upload/");
      if (parts.length < 2) return url;
      var rest = parts[1];
      // strip existing transform segment if present (simple heuristic)
      if (/^[^/]*[_,][^/]*\//.test(rest) && !/^v\d+\//.test(rest)) {
        rest = rest.replace(/^[^/]+\//, "");
      }
      var t = [];
      t.push("f_auto");
      t.push("q_auto:" + (opts.quality || "good"));
      if (opts.w) t.push("w_" + Math.round(opts.w));
      if (opts.h) t.push("h_" + Math.round(opts.h));
      if (opts.crop) t.push("c_" + opts.crop); // fill, limit, scale
      if (opts.g) t.push("g_" + opts.g); // auto, face
      return parts[0] + "/upload/" + t.join(",") + "/" + rest;
    } catch (_) {
      return url;
    }
  }

  function thumb(url, width) {
    return cloudinaryTransform(url, {
      w: width || 400,
      crop: "limit",
      quality: "auto"
    });
  }

  function avatarUrl(url, size) {
    size = size || 128;
    return cloudinaryTransform(url, {
      w: size,
      h: size,
      crop: "fill",
      g: "face",
      quality: "auto"
    });
  }

  function bannerUrl(url, width) {
    return cloudinaryTransform(url, {
      w: width || 900,
      h: 320,
      crop: "fill",
      g: "auto",
      quality: "auto"
    });
  }

  /** Video poster from Cloudinary video URL (frame at 1s) */
  function videoPoster(url, width) {
    if (!url || !isCloudinary(url)) return "";
    try {
      var u = url.replace("/video/upload/", "/video/upload/so_1,f_jpg,q_auto,w_" + (width || 480) + "/");
      if (u === url) {
        u = url.replace("/upload/", "/upload/so_1,f_jpg,q_auto,w_" + (width || 480) + "/");
      }
      return u.replace(/\.(mp4|webm|mov)(\?|$)/i, ".jpg$2");
    } catch (_) {
      return "";
    }
  }

  /**
   * Compress image File in browser (JPEG/WebP) before upload
   * maxEdge: longest side px, quality 0–1
   */
  function compressImage(file, options) {
    options = options || {};
    var maxEdge = options.maxEdge || 1600;
    var quality = options.quality != null ? options.quality : 0.82;
    var mime = options.mime || "image/jpeg";

    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//i.test(file.type || "")) {
        resolve(file);
        return;
      }
      // skip gif / already small
      if (/gif$/i.test(file.type) || (file.size && file.size < 180000)) {
        resolve(file);
        return;
      }

      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = 1;
          if (Math.max(w, h) > maxEdge) {
            scale = maxEdge / Math.max(w, h);
          }
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, cw, ch);
          canvas.toBlob(
            function (blob) {
              URL.revokeObjectURL(url);
              if (!blob) {
                resolve(file);
                return;
              }
              var name = String(file.name || "image.jpg").replace(/\.\w+$/, "") + (
                mime.indexOf("webp") >= 0 ? ".webp" : ".jpg"
              );
              resolve(new File([blob], name, { type: mime, lastModified: Date.now() }));
            },
            mime,
            quality
          );
        } catch (e) {
          URL.revokeObjectURL(url);
          resolve(file);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  /** Lazy-load: img[data-src], img.lazy, video[data-src] */
  function enhanceMedia(root) {
    root = root || document;
    var imgs = root.querySelectorAll("img[data-src], img.lazy");
    var videos = root.querySelectorAll("video[data-src]");

    function loadImg(el) {
      var src = el.getAttribute("data-src") || el.getAttribute("data-lazy");
      if (!src) return;
      var w = parseInt(el.getAttribute("data-w") || "0", 10) || 0;
      if (w > 0 && isCloudinary(src)) src = thumb(src, w);
      el.setAttribute("decoding", "async");
      el.setAttribute("loading", "lazy");
      el.src = src;
      el.removeAttribute("data-src");
      el.classList.remove("lazy");
      el.classList.add("media-loaded");
    }

    function loadVideo(el) {
      var src = el.getAttribute("data-src");
      if (!src) return;
      if (!el.getAttribute("poster") && isCloudinary(src)) {
        var p = videoPoster(src, 480);
        if (p) el.setAttribute("poster", p);
      }
      el.src = src;
      el.removeAttribute("data-src");
      el.setAttribute("preload", "metadata");
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            if (el.tagName === "IMG") loadImg(el);
            else if (el.tagName === "VIDEO") loadVideo(el);
            io.unobserve(el);
          });
        },
        { rootMargin: "200px 0px", threshold: 0.01 }
      );
      imgs.forEach(function (el) {
        el.setAttribute("loading", "lazy");
        io.observe(el);
      });
      videos.forEach(function (el) {
        io.observe(el);
      });
    } else {
      imgs.forEach(loadImg);
      videos.forEach(loadVideo);
    }
  }

  /** Observe DOM for new feed cards */
  function watchFeed() {
    enhanceMedia(document);
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (n.nodeType !== 1) continue;
          if (n.matches && (n.matches("img[data-src],img.lazy,video[data-src]") || n.querySelector)) {
            enhanceMedia(n);
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  /** Optimize an existing <img> src if Cloudinary */
  function optimizeImgEl(img, width) {
    if (!img || !img.src) return;
    if (!isCloudinary(img.src)) return;
    var next = thumb(img.src, width || img.clientWidth || 400);
    if (next && next !== img.src) img.src = next;
  }

  global.VieworaMedia = {
    thumb: thumb,
    avatarUrl: avatarUrl,
    bannerUrl: bannerUrl,
    videoPoster: videoPoster,
    compressImage: compressImage,
    cloudinaryTransform: cloudinaryTransform,
    isCloudinary: isCloudinary,
    enhanceMedia: enhanceMedia,
    optimizeImgEl: optimizeImgEl
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchFeed);
  } else {
    setTimeout(watchFeed, 0);
  }
})(typeof window !== "undefined" ? window : this);
