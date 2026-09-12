"use strict";
/**
 * VIEWORA — Background Upload Queue (YouTube-style)
 * - Default title = today date if empty
 * - Auto thumbnail 1–3s for video
 * - Cancel mid-upload
 * - No public entry until upload finishes
 */
(() => {
  if (window.__VIEWORA_UPLOAD_QUEUE__) return;
  window.__VIEWORA_UPLOAD_QUEUE__ = true;

  const DB_NAME = "VIEWORA_UPLOAD_QUEUE_DB";
  const DB_VER = 1;
  const STORE = "jobs";
  const CLOUD = window.VIEWORA_CLOUDINARY_CLOUD || "z5m6wjdf";
  const PRESET = window.VIEWORA_CLOUDINARY_PRESET || "Viewora-upload";

  let processing = false;
  let bannerEl = null;
  let activeXhr = null;
  let activeJobId = null;
  let cancelRequested = false;

  function log() {
    try {
      console.log.apply(console, ["[VIEWORA UPLOAD]"].concat([].slice.call(arguments)));
    } catch (_) {}
  }

  function defaultTitle() {
    try {
      return new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch (_) {
      const d = new Date();
      return d.getDate() + " " + d.toLocaleString("en", { month: "long" }) + " " + d.getFullYear();
    }
  }

  function cleanTitle(t, fileName) {
    let s = String(t || "").trim();
    if (!s || s === "Untitled video" || s === "Untitled" || s === "Short") {
      return defaultTitle();
    }
    // filename mistaken as title
    if (/\.(mp4|mov|webm|mkv|avi)$/i.test(s)) return defaultTitle();
    if (fileName && s === fileName) return defaultTitle();
    return s;
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(job) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(job);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGetAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbUpdate(id, patch) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const g = store.get(id);
      g.onsuccess = () => {
        const row = g.result;
        if (!row) return;
        Object.assign(row, patch);
        store.put(row);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function ensureBanner() {
    if (bannerEl && document.body.contains(bannerEl)) return bannerEl;
    bannerEl = document.createElement("div");
    bannerEl.id = "vieworaUploadBanner";
    bannerEl.innerHTML = `
      <div class="vu-inner">
        <div class="vu-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
        <div class="vu-text">
          <strong class="vu-title">Uploading…</strong>
          <span class="vu-sub">0%</span>
        </div>
        <div class="vu-bar"><div class="vu-fill"></div></div>
        <button type="button" class="vu-cancel" title="Cancel upload">✕</button>
      </div>`;
    if (!document.getElementById("vieworaUploadBannerCSS")) {
      const style = document.createElement("style");
      style.id = "vieworaUploadBannerCSS";
      style.textContent = `
        #vieworaUploadBanner{
          position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));
          z-index:99990;display:none;
        }
        #vieworaUploadBanner.show{display:block;animation:vuIn .25s ease}
        @keyframes vuIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        #vieworaUploadBanner .vu-inner{
          display:grid;grid-template-columns:36px 1fr 36px;grid-template-rows:auto auto;gap:4px 10px;
          align-items:center;padding:12px 14px;border-radius:16px;
          background:rgba(18,18,28,.96);border:1px solid rgba(255,255,255,.12);
          box-shadow:0 12px 40px rgba(0,0,0,.45);backdrop-filter:blur(16px);color:#fff;
          font-family:Inter,system-ui,sans-serif;
        }
        html[data-theme="light"] #vieworaUploadBanner .vu-inner{
          background:rgba(255,255,255,.96);color:#111;border-color:rgba(0,0,0,.08);
        }
        #vieworaUploadBanner .vu-icon{
          grid-row:1/3;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;
          background:linear-gradient(135deg,#7c5cff,#3b82f6);color:#fff;font-size:15px;
        }
        #vieworaUploadBanner .vu-title{font-size:13px;font-weight:700;display:block}
        #vieworaUploadBanner .vu-sub{font-size:11px;opacity:.7}
        #vieworaUploadBanner .vu-bar{
          grid-column:2/3;height:4px;border-radius:99px;background:rgba(127,127,127,.25);overflow:hidden;
        }
        #vieworaUploadBanner .vu-fill{
          height:100%;width:0%;border-radius:inherit;
          background:linear-gradient(90deg,#7c5cff,#22d3ee);transition:width .2s ease;
        }
        #vieworaUploadBanner .vu-cancel{
          grid-row:1/3;grid-column:3;width:32px;height:32px;border-radius:10px;border:0;
          background:rgba(255,80,80,.15);color:#ff6b7a;font-size:16px;cursor:pointer;line-height:1;
        }
        #vieworaUploadBanner.done .vu-icon{background:linear-gradient(135deg,#22c55e,#16a34a)}
        #vieworaUploadBanner.error .vu-icon{background:linear-gradient(135deg,#ef4444,#f97316)}
      `;
      document.head.appendChild(style);
    }
    document.body.appendChild(bannerEl);
    bannerEl.querySelector(".vu-cancel").onclick = () => {
      cancelActiveUpload();
    };
    return bannerEl;
  }

  function setBanner(state) {
    const el = ensureBanner();
    const title = el.querySelector(".vu-title");
    const sub = el.querySelector(".vu-sub");
    const fill = el.querySelector(".vu-fill");
    const cancelBtn = el.querySelector(".vu-cancel");
    el.classList.remove("done", "error");
    if (state.hidden) {
      el.classList.remove("show");
      return;
    }
    el.classList.add("show");
    if (state.done) el.classList.add("done");
    if (state.error) el.classList.add("error");
    if (title) title.textContent = state.title || "Uploading…";
    if (sub) sub.textContent = state.sub || "";
    if (fill) fill.style.width = Math.max(0, Math.min(100, Number(state.percent) || 0)) + "%";
    if (cancelBtn) {
      cancelBtn.style.display = state.done || state.error ? "none" : "";
    }
  }

  function toast(msg) {
    let t = document.getElementById("vieworaQToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "vieworaQToast";
      t.style.cssText =
        "position:fixed;left:50%;bottom:140px;transform:translateX(-50%);z-index:99999;padding:10px 16px;border-radius:12px;background:rgba(20,20,30,.95);color:#fff;font:600 12px Inter,sans-serif;opacity:0;transition:.25s;pointer-events:none;max-width:90vw";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._tm);
    t._tm = setTimeout(() => {
      t.style.opacity = "0";
    }, 2400);
  }

  async function cancelActiveUpload() {
    cancelRequested = true;
    try {
      if (activeXhr) activeXhr.abort();
    } catch (_) {}
    activeXhr = null;
    if (activeJobId) {
      try {
        await idbDelete(activeJobId);
      } catch (_) {}
      activeJobId = null;
    }
    setBanner({
      title: "Upload cancelled",
      sub: "Removed",
      percent: 0,
      error: true
    });
    toast("Upload cancelled");
    setTimeout(() => setBanner({ hidden: true }), 2000);
    processing = false;
  }

  function uploadCloudinary(file, onProgress) {
    return new Promise((resolve, reject) => {
      const url = "https://api.cloudinary.com/v1_1/" + CLOUD + "/auto/upload";
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", PRESET);
      const xhr = new XMLHttpRequest();
      activeXhr = xhr;
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        activeXhr = null;
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
            resolve(data);
          } else {
            reject(new Error(data.error?.message || "Upload failed"));
          }
        } catch (err) {
          reject(err);
        }
      };
      xhr.onerror = () => {
        activeXhr = null;
        reject(new Error("Network error"));
      };
      xhr.onabort = () => {
        activeXhr = null;
        reject(new Error("cancelled"));
      };
      xhr.send(fd);
    });
  }

  /** Capture frame at ~1.5–2s for thumbnail */
  function captureVideoThumb(blob, atSec) {
    atSec = atSec == null ? 1.5 : atSec;
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(blob);
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.preload = "auto";
        v.src = url;
        const fail = () => {
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
          resolve(null);
        };
        v.onerror = fail;
        v.onloadeddata = () => {
          const dur = Number(v.duration) || 3;
          const t = Math.min(Math.max(atSec, 0.3), Math.max(0.5, dur * 0.15));
          try {
            v.currentTime = t;
          } catch (_) {
            fail();
          }
        };
        v.onseeked = () => {
          try {
            const c = document.createElement("canvas");
            const w = v.videoWidth || 640;
            const h = v.videoHeight || 360;
            c.width = w;
            c.height = h;
            c.getContext("2d").drawImage(v, 0, 0, w, h);
            c.toBlob(
              (b) => {
                try {
                  URL.revokeObjectURL(url);
                } catch (_) {}
                resolve(b);
              },
              "image/jpeg",
              0.82
            );
          } catch (_) {
            fail();
          }
        };
        setTimeout(fail, 8000);
      } catch (_) {
        resolve(null);
      }
    });
  }

  function resolveDb() {
    if (window.db) return window.db;
    try {
      return firebase.database();
    } catch (_) {
      return null;
    }
  }

  function resolveAuth() {
    if (window.auth) return window.auth;
    try {
      return firebase.auth();
    } catch (_) {
      return null;
    }
  }

  async function waitAuth(ms) {
    const auth = resolveAuth();
    if (!auth) return null;
    if (auth.currentUser) return auth.currentUser;
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(auth.currentUser || null), ms || 4000);
      const unsub = auth.onAuthStateChanged((u) => {
        clearTimeout(t);
        try {
          unsub();
        } catch (_) {}
        resolve(u || null);
      });
    });
  }

  function typeLabel(type) {
    const m = {
      story: "Story",
      short: "Short",
      video: "Video",
      post: "Post",
      chat: "Photo",
      avatar: "Profile photo",
      live: "Live"
    };
    return m[type] || "Upload";
  }

  async function writeFirebase(job, media, thumbUrl) {
    const db = resolveDb();
    const user = await waitAuth(3000);
    if (!db || !user) throw new Error("Not signed in");

    const meta = job.meta || {};
    const now = Date.now();
    const mediaURL = media.secure_url;
    const resourceType =
      media.resource_type || (job.fileType || "").split("/")[0] || "image";
    const title = cleanTitle(meta.title || meta.caption, job.fileName);
    const thumb =
      thumbUrl ||
      meta.thumbnailUrl ||
      media.eager?.[0]?.secure_url ||
      (resourceType === "video" ? mediaURL.replace("/upload/", "/upload/so_2,w_640,h_360,c_fill/") : mediaURL);

    if (job.type === "story") {
      const ref = db.ref("stories").push();
      const mediaType = resourceType === "video" ? "video" : "image";
      // Normalize music so playback works after upload
      let musicPayload = null;
      const m = meta.music;
      if (m && typeof m === "object" && m.id !== "original" && m.id !== "original-audio") {
        musicPayload = {
          id: m.id || "",
          name: m.name || m.title || "Music",
          title: m.title || m.name || "Music",
          artist: m.artist || "",
          audioUrl: m.audioUrl || m.url || m.src || "",
          coverUrl: m.coverUrl || "",
          startAt: Number(meta.musicStartAt != null ? meta.musicStartAt : (m.startAt || 0)) || 0
        };
        if (!musicPayload.audioUrl) musicPayload = null;
      }
      const startAt = musicPayload ? Number(musicPayload.startAt || 0) || 0 : 0;
      await ref.set({
        id: ref.key,
        uid: user.uid,
        userId: user.uid,
        ownerId: user.uid,
        mediaUrl: mediaURL,
        mediaURL: mediaURL,
        url: mediaURL,
        type: mediaType,
        mediaType: mediaType,
        caption: meta.caption || "",
        title: title,
        username: meta.username || user.displayName || "User",
        userName: meta.username || user.displayName || "User",
        displayName: meta.username || user.displayName || "User",
        avatar: meta.avatar || user.photoURL || "",
        photoURL: meta.avatar || user.photoURL || "",
        profilePhoto: meta.avatar || user.photoURL || "",
        userPhoto: meta.avatar || user.photoURL || "",
        music: musicPayload,
        musicStartAt: startAt,
        audioName: musicPayload ? (musicPayload.name || "Music") : "Original audio",
        texts: meta.texts || [],
        stickers: meta.stickers || [],
        visibility: "followers",
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
        timestamp: now,
        uploadStatus: "ready",
        views: 0,
        viewers: {}
      });
      try {
        sessionStorage.removeItem("viewora_story_uploading");
      } catch (_) {}
      return { path: "stories/" + ref.key };
    }

    if (job.type === "post") {
      const ref = db.ref("posts").push();
      await ref.set({
        id: ref.key,
        uid: user.uid,
        userId: user.uid,
        type: "post",
        imageUrl: mediaURL,
        mediaUrl: mediaURL,
        caption: meta.caption || "",
        description: meta.description || meta.caption || "",
        username: meta.username || user.displayName || "User",
        name: meta.name || user.displayName || "",
        userPhoto: meta.userPhoto || user.photoURL || "",
        profilePhoto: meta.userPhoto || user.photoURL || "",
        music: meta.music || null,
        category: meta.category || "",
        tags: meta.tags || [],
        likes: 0,
        likesCount: 0,
        comments: 0,
        commentsCount: 0,
        views: 0,
        createdAt: now,
        timestamp: now,
        uploadStatus: "ready",
        deleted: false
      });
      return { path: "posts/" + ref.key };
    }

    if (job.type === "short") {
      const ref = db.ref("shorts").push();
      await ref.set({
        id: ref.key,
        uid: user.uid,
        userId: user.uid,
        type: "short",
        videoUrl: mediaURL,
        mediaUrl: mediaURL,
        thumbnailUrl: thumb,
        caption: meta.caption || "",
        title: title,
        description: meta.description || "",
        username: meta.username || user.displayName || "User",
        userPhoto: meta.userPhoto || user.photoURL || "",
        music: meta.music || null,
        likes: 0,
        likesCount: 0,
        commentsCount: 0,
        views: 0,
        createdAt: now,
        timestamp: now,
        uploadStatus: "ready",
        deleted: false
      });
      return { path: "shorts/" + ref.key };
    }

    if (job.type === "video") {
      const ref = db.ref("videos").push();
      const payload = {
        id: ref.key,
        uid: user.uid,
        userId: user.uid,
        type: "video",
        videoUrl: mediaURL,
        mediaUrl: mediaURL,
        thumbnailUrl: thumb,
        title: title,
        description: meta.description || "",
        caption: meta.caption || "",
        username: meta.username || user.displayName || "User",
        userPhoto: meta.userPhoto || user.photoURL || "",
        category: meta.category || "",
        tags: meta.tags || [],
        views: 0,
        likes: 0,
        createdAt: now,
        timestamp: now,
        uploadStatus: "ready",
        deleted: false
      };
      await ref.set(payload);
      try {
        await db.ref("posts/" + ref.key).set(
          Object.assign({}, payload, { type: "video" })
        );
      } catch (_) {}
      return { path: "videos/" + ref.key };
    }

    if (job.type === "avatar") {
      await db.ref("users/" + user.uid).update({
        profilePhoto: mediaURL,
        photoURL: mediaURL,
        avatar: mediaURL,
        updatedAt: now
      });
      try {
        await user.updateProfile({ photoURL: mediaURL });
      } catch (_) {}
      return { path: "users/" + user.uid };
    }

    if (meta.targetPath) {
      await db.ref(meta.targetPath).update(
        Object.assign({}, meta.fields || {}, {
          mediaUrl: mediaURL,
          url: mediaURL,
          thumbnailUrl: thumb,
          title: title,
          updatedAt: now,
          uploadStatus: "ready"
        })
      );
      return { path: meta.targetPath };
    }

    throw new Error("Unknown upload type: " + job.type);
  }

  async function processOne(job) {
    cancelRequested = false;
    activeJobId = job.id;
    const label = typeLabel(job.type);
    setBanner({ title: "Uploading " + label, sub: "Starting…", percent: 2 });
    await idbUpdate(job.id, { status: "uploading" });

    const file = job.blob;
    if (!file) throw new Error("Missing file data");

    // Auto thumbnail for video types
    let thumbUrl = (job.meta && job.meta.thumbnailUrl) || "";
    const isVideo =
      job.type === "video" ||
      job.type === "short" ||
      (job.fileType || "").indexOf("video") === 0;

    if (isVideo && !thumbUrl) {
      setBanner({ title: "Uploading " + label, sub: "Making thumbnail…", percent: 5 });
      try {
        const thumbBlob = await captureVideoThumb(file, 1.5);
        if (thumbBlob && !cancelRequested) {
          const thumbMedia = await uploadCloudinary(thumbBlob, () => {});
          thumbUrl = thumbMedia.secure_url || "";
        }
      } catch (e) {
        log("thumb fail", e);
      }
    }

    if (cancelRequested) throw new Error("cancelled");

    const media = await uploadCloudinary(file, (p) => {
      const pct = 8 + Math.round(p * 0.85);
      setBanner({
        title: "Uploading " + label,
        sub: pct + "% — tap ✕ to cancel",
        percent: pct
      });
    });

    if (cancelRequested) throw new Error("cancelled");

    setBanner({ title: "Finishing " + label, sub: "Saving…", percent: 96 });
    // Ensure title cleaned before write
    job.meta = job.meta || {};
    job.meta.title = cleanTitle(job.meta.title || job.meta.caption, job.fileName);

    await writeFirebase(job, media, thumbUrl);
    await idbDelete(job.id);
    activeJobId = null;
    setBanner({
      title: label + " uploaded",
      sub: "Done",
      percent: 100,
      done: true
    });
    toast(label + " is live");
    setTimeout(() => setBanner({ hidden: true }), 2500);
  }

  async function processQueue() {
    if (processing) return;
    processing = true;
    try {
      const jobs = (await idbGetAll()).filter(
        (j) => j && (j.status === "queued" || j.status === "uploading")
      );
      jobs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      for (const job of jobs) {
        try {
          await processOne(job);
        } catch (err) {
          const msg = String(err && err.message ? err.message : err);
          if (msg === "cancelled") {
            try {
              await idbDelete(job.id);
            } catch (_) {}
            continue;
          }
          log("job failed", job.id, err);
          await idbUpdate(job.id, { status: "error", error: msg });
          // remove failed job so it doesn't spam profile
          try {
            await idbDelete(job.id);
          } catch (_) {}
          setBanner({
            title: "Upload failed",
            sub: msg,
            percent: 100,
            error: true
          });
          toast("Upload failed");
          setTimeout(() => setBanner({ hidden: true }), 3500);
        }
      }
    } finally {
      processing = false;
      activeJobId = null;
    }
  }

  async function enqueueAndLeave(opts) {
    opts = opts || {};
    const file = opts.file;
    if (!file) throw new Error("No file");

    const id = "job_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], {
      type: file.type || opts.mime || "application/octet-stream"
    });

    const meta = Object.assign({}, opts.meta || {});
    meta.title = cleanTitle(meta.title || meta.caption, file.name);

    const job = {
      id,
      type: opts.type || "post",
      status: "queued",
      createdAt: Date.now(),
      fileName: file.name || "upload",
      fileType: file.type || "",
      fileSize: blob.size,
      blob,
      meta,
      returnUrl: opts.returnUrl || ""
    };

    await idbPut(job);
    toast("Uploading in background…");

    let go = opts.returnUrl || "index.html";
    try {
      if (!opts.returnUrl && document.referrer && document.referrer.indexOf(location.origin) === 0) {
        const path = document.referrer.split("/").pop() || "index.html";
        if (path && path.indexOf(".html") !== -1) go = path;
      }
    } catch (_) {}

    setTimeout(() => processQueue(), 40);
    setTimeout(() => {
      window.location.href = go;
    }, 100);
    return id;
  }

  async function enqueue(opts) {
    opts = opts || {};
    const file = opts.file;
    if (!file) throw new Error("No file");
    const id = "job_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type || "application/octet-stream" });
    const meta = Object.assign({}, opts.meta || {});
    meta.title = cleanTitle(meta.title || meta.caption, file.name);
    await idbPut({
      id,
      type: opts.type || "post",
      status: "queued",
      createdAt: Date.now(),
      fileName: file.name || "upload",
      fileType: file.type || "",
      fileSize: blob.size,
      blob,
      meta
    });
    processQueue();
    return id;
  }

  function boot() {
    ensureBanner();
    processQueue();
    window.addEventListener("online", () => processQueue());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") processQueue();
    });
  }

  window.VieworaUploadQueue = {
    enqueue,
    enqueueAndLeave,
    processQueue,
    cancel: cancelActiveUpload,
    typeLabel,
    defaultTitle,
    cleanTitle
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
