/* Viewora Media Upload — Cloudinary helper for chat / messages */
(function (global) {
  "use strict";

  var CLOUD =
    global.VIEWORA_CLOUDINARY_CLOUD ||
    global.CLOUDINARY_CLOUD_NAME ||
    "z5m6wjdf";
  var PRESET =
    global.VIEWORA_CLOUDINARY_PRESET ||
    global.CLOUDINARY_UPLOAD_PRESET ||
    "Viewora-upload";
  var FOLDER =
    global.VIEWORA_CLOUDINARY_FOLDER || "viewora/chat";

  function resourceType(file) {
    var t = String((file && file.type) || "").toLowerCase();
    if (t.indexOf("image/") === 0) return "image";
    if (t.indexOf("video/") === 0) return "video";
    if (t.indexOf("audio/") === 0) return "video"; // cloudinary audio via video endpoint
    return "auto";
  }

  function upload(file, options) {
    options = options || {};
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("No file"));
        return;
      }
      if (!CLOUD || !PRESET) {
        reject(new Error("Cloudinary not configured"));
        return;
      }

      var rt = resourceType(file);
      var url =
        "https://api.cloudinary.com/v1_1/" +
        encodeURIComponent(CLOUD) +
        "/" +
        rt +
        "/upload";

      var fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", PRESET);
      fd.append("folder", options.folder || FOLDER);

      var xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);

      if (typeof options.onProgress === "function") {
        xhr.upload.onprogress = function (e) {
          if (e.lengthComputable) {
            options.onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total);
          }
        };
      }

      xhr.onload = function () {
        var data = null;
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch (_) {
          data = {};
        }
        if (xhr.status >= 200 && xhr.status < 300 && (data.secure_url || data.url)) {
          resolve({
            url: data.secure_url || data.url,
            secure_url: data.secure_url || data.url,
            public_id: data.public_id || "",
            format: data.format || "",
            width: data.width || null,
            height: data.height || null,
            duration: data.duration || null,
            bytes: data.bytes || file.size || 0,
            resource_type: data.resource_type || rt
          });
        } else {
          var msg =
            (data && (data.error && data.error.message)) ||
            data.message ||
            "Upload failed (" + xhr.status + ")";
          reject(new Error(msg));
        }
      };

      xhr.onerror = function () {
        reject(new Error("Network error during upload"));
      };

      if (options.signal && typeof options.signal.addEventListener === "function") {
        options.signal.addEventListener("abort", function () {
          try { xhr.abort(); } catch (_) {}
          reject(new Error("Upload cancelled"));
        });
      }

      xhr.send(fd);
    });
  }

  global.VieworaMediaUpload = {
    upload: upload,
    cloud: CLOUD,
    preset: PRESET
  };
})(typeof window !== "undefined" ? window : this);
