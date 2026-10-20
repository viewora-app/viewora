/* Optional: wrap uploads with compress — include AFTER media-upload.js + media-perf.js */
(function () {
  if (!window.VieworaMedia || !window.VieworaMedia.compressImage) return;
  var prev = window.VieworaUpload || window.mediaUpload || null;
  // Hook common global if present
  if (window.VieworaMediaUpload && typeof window.VieworaMediaUpload.upload === "function") {
    var orig = window.VieworaMediaUpload.upload.bind(window.VieworaMediaUpload);
    window.VieworaMediaUpload.upload = function (file, options) {
      options = options || {};
      var isImg = file && /^image\//i.test(file.type || "");
      if (!isImg) return orig(file, options);
      return window.VieworaMedia.compressImage(file, {
        maxEdge: options.maxEdge || 1600,
        quality: options.quality || 0.82
      }).then(function (f) {
        return orig(f, options);
      });
    };
  }
})();
