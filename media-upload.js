/* Viewora Media Upload — Firebase Storage primary (Cloudinary optional) */
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
    if (t.indexOf("audio/") === 0) return "video";
    return "auto";
  }

  function uploadFirebase(file, options) {
    options = options || {};
    return new Promise(function (resolve, reject) {
      try {
        if (typeof firebase === "undefined" || !firebase.storage) {
          reject(new Error("Firebase Storage not available"));
          return;
        }
        var uid =
          (firebase.auth &&
            firebase.auth().currentUser &&
            firebase.auth().currentUser.uid) ||
          "anon";
        var safe = String(file.name || "file")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(0, 80);
        var path =
          (options.folder || FOLDER || "viewora/chat") +
          "/" +
          uid +
          "/" +
          Date.now() +
          "_" +
          safe;
        var ref = firebase.storage().ref(path);
        var task = ref.put(file, {
          contentType: file.type || "application/octet-stream"
        });
        task.on(
          "state_changed",
          function (snap) {
            if (typeof options.onProgress === "function" && snap.totalBytes) {
              options.onProgress(
                Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
                snap.bytesTransferred,
                snap.totalBytes
              );
            }
          },
          function (err) {
            reject(err || new Error("Storage upload failed"));
          },
          function () {
            task.snapshot.ref
              .getDownloadURL()
              .then(function (url) {
                resolve({
                  url: url,
                  secure_url: url,
                  public_id: path,
                  format: (file.type || "").split("/")[1] || "",
                  bytes: file.size || 0,
                  resource_type: resourceType(file),
                  _provider: "firebase"
                });
              })
              .catch(reject);
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  function uploadCloudinary(file, options) {
    options = options || {};
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("No file"));
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
            options.onProgress(
              Math.round((e.loaded / e.total) * 100),
              e.loaded,
              e.total
            );
          }
        };
      }
      xhr.onload = function () {
        var data = {};
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch (_) {}
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
            resource_type: data.resource_type || rt,
            _provider: "cloudinary"
          });
        } else {
          var msg =
            (data && data.error && data.error.message) ||
            data.message ||
            "Upload failed (" + xhr.status + ")";
          reject(new Error(msg));
        }
      };
      xhr.onerror = function () {
        reject(new Error("Network error during upload"));
      };
      xhr.send(fd);
    });
  }

  function upload(file, options) {
    options = options || {};
    if (!file) return Promise.reject(new Error("No file"));
    var forceCloud =
      global.VIEWORA_FORCE_CLOUDINARY === true ||
      global.VIEWORA_FORCE_CLOUDINARY === "1";
    if (forceCloud) {
      return uploadCloudinary(file, options).catch(function (err) {
        console.warn("[VIEWORA] Cloudinary to Storage", err && err.message);
        return uploadFirebase(file, options);
      });
    }
    return uploadFirebase(file, options);
  }

  global.VieworaMediaUpload = {
    upload: upload,
    uploadFirebase: uploadFirebase,
    cloud: CLOUD,
    preset: PRESET
  };
})(typeof window !== "undefined" ? window : this);
