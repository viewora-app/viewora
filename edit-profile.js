/* Viewora Edit Profile — Instagram crop (circle in square + corner handles), Done/Cancel fixed */
(function () {
  "use strict";

  var auth = null, db = null, storage = null, user = null, profile = {};
  var avatarFile = null, bannerFile = null, avatarPreviewUrl = null, bannerPreviewUrl = null;
  var usernameCheckTimer = null, usernameOk = true;
  var detectedCountry = "", detectedCountryCode = "";
  var SOCIAL_KEYS = ["instagram","facebook","x","youtube","linkedin","pinterest"];

  var cropKind = "avatar", cropImg = null, cropScale = 1, cropPanX = 0, cropPanY = 0;
  var cropDragging = false, cropMode = null, cropLastX = 0, cropLastY = 0;
  var cropStartScale = 1, cropStartDist = 0, cropPointers = {}, cropBlobUrl = null;

  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var t = $("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
  function setLoading(on) {
    var m = $("loadingMask"); if (m) m.hidden = !on;
    var btn = $("saveBtn"); if (btn) { btn.disabled = !!on; btn.classList.toggle("busy", !!on); }
  }

  async function detectCountry() {
    var label = $("countryLabel");
    if (profile.country && profile.country !== "Unknown") {
      detectedCountry = profile.country; detectedCountryCode = profile.countryCode || "";
      if (label) label.textContent = detectedCountry; return;
    }
    try {
      var res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined });
      if (!res.ok) throw new Error("fail");
      var data = await res.json();
      detectedCountry = data.country_name || data.country || "";
      detectedCountryCode = data.country_code || "";
      if (!detectedCountry) throw new Error("empty");
      if (label) label.textContent = detectedCountry;
    } catch (_) {
      try {
        var res2 = await fetch("https://api.country.is/");
        var d2 = await res2.json();
        detectedCountryCode = d2.country || "";
        var names = { IN:"India",US:"United States",PK:"Pakistan",BD:"Bangladesh",GB:"United Kingdom",CA:"Canada",AU:"Australia",AE:"United Arab Emirates",SA:"Saudi Arabia",NP:"Nepal",DE:"Germany",FR:"France",JP:"Japan",SG:"Singapore",ID:"Indonesia",NG:"Nigeria" };
        detectedCountry = names[detectedCountryCode] || detectedCountryCode || "Unknown";
        if (label) label.textContent = detectedCountry;
      } catch (__) {
        detectedCountry = profile.country || "Unknown";
        if (label) label.textContent = detectedCountry;
      }
    }
  }

  function stripHandle(raw) {
    raw = String(raw || "").trim(); if (!raw) return "";
    raw = raw.replace(/^@/, "");
    try {
      if (/^https?:\/\//i.test(raw)) {
        var u = new URL(raw);
        var path = (u.pathname || "").replace(/^\/+|\/+$/g, "");
        if (/youtube\.com/i.test(u.hostname)) path = path.replace(/^(c|channel|user|@)\//, "").replace(/^@/, "");
        if (/linkedin\.com/i.test(u.hostname)) path = path.replace(/^(in|company)\//, "");
        if (/facebook\.com|fb\.com/i.test(u.hostname)) path = path.replace(/^profile\.php.*/, "").split("/")[0];
        return path.split("/")[0] || raw;
      }
    } catch (_) {}
    return raw.replace(/\s+/g, "");
  }

  function buildSocialUrl(platform, handleOrUrl) {
    var raw = String(handleOrUrl || "").trim(); if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    var h = stripHandle(raw); if (!h) return "";
    switch (platform) {
      case "instagram": return "https://instagram.com/" + encodeURIComponent(h);
      case "facebook": return "https://facebook.com/" + encodeURIComponent(h);
      case "x": return "https://x.com/" + encodeURIComponent(h);
      case "youtube": return h.indexOf("UC") === 0 ? "https://youtube.com/channel/" + encodeURIComponent(h) : "https://youtube.com/@" + encodeURIComponent(h.replace(/^@/, ""));
      case "linkedin": return "https://linkedin.com/in/" + encodeURIComponent(h);
      case "pinterest": return "https://pinterest.com/" + encodeURIComponent(h);
      default: return raw;
    }
  }

  function readSocialsFromForm() {
    var out = {};
    SOCIAL_KEYS.forEach(function (k) {
      var el = $("social_" + k);
      var val = el ? (el.value || "").trim() : "";
      if (val) out[k] = { handle: stripHandle(val), url: buildSocialUrl(k, val) };
    });
    return out;
  }

  function fillForm(p) {
    profile = p || {};
    var name = profile.name || profile.fullName || profile.displayName || (user && user.displayName) || "";
    var uname = String(profile.username || profile.userName || "").replace(/^@/, "");
    var bio = profile.bio || "";
    var web = profile.website || profile.link || "";
    if ($("nameInput")) $("nameInput").value = name;
    if ($("usernameInput")) $("usernameInput").value = uname;
    if ($("bioInput")) $("bioInput").value = bio;
    if ($("websiteInput")) $("websiteInput").value = web;
    if ($("bioCount")) $("bioCount").textContent = String(bio.length);
    var socials = profile.socials || profile.socialLinks || {};
    if (typeof socials === "string") { try { socials = JSON.parse(socials) || {}; } catch (_) { socials = {}; } }
    SOCIAL_KEYS.forEach(function (k) {
      var el = $("social_" + k); if (!el) return;
      var s = socials[k];
      if (typeof s === "string") el.value = s;
      else if (s && (s.handle || s.url)) el.value = s.handle || s.url || "";
      else el.value = profile[k] || "";
    });
    setAvatar(profile.profilePhoto || profile.photoURL || profile.avatar || (user && user.photoURL) || "");
    setBanner(profile.coverPhoto || profile.banner || profile.cover || profile.bannerURL || "");
    detectCountry();
  }

  function setAvatar(url) {
    var img = $("avatarImg"), fb = $("avatarFb"); if (!img || !fb) return;
    if (url) {
      img.style.display = "block"; img.src = url;
      img.onerror = function () { img.style.display = "none"; fb.style.display = "grid"; };
      fb.style.display = "none";
    } else {
      img.style.display = "none"; fb.style.display = "grid";
      fb.textContent = ((($("nameInput") && $("nameInput").value) || ($("usernameInput") && $("usernameInput").value) || "V")[0] || "V").toUpperCase();
    }
  }
  function setBanner(url) {
    var img = $("bannerImg"); if (!img) return;
    if (url) { img.src = url; img.style.opacity = "1"; }
    else { img.src = "assets/default-banner.jpg"; img.style.opacity = "0.5"; }
  }
  function updateBioCount() {
    if ($("bioCount") && $("bioInput")) $("bioCount").textContent = String(($("bioInput").value || "").length);
  }
  function scheduleUsernameCheck() {
    clearTimeout(usernameCheckTimer);
    var hint = $("usernameHint"); if (!hint) return;
    var raw = ($("usernameInput").value || "").trim().replace(/^@/, "").toLowerCase();
    if (!raw) { usernameOk = false; hint.textContent = "Username required"; hint.className = "hint error"; return; }
    if (!/^[a-z0-9_]{3,30}$/.test(raw)) { usernameOk = false; hint.textContent = "3–30 chars: letters, numbers, underscores only"; hint.className = "hint error"; return; }
    var current = String(profile.username || profile.userName || "").toLowerCase().replace(/^@/, "");
    if (raw === current) { usernameOk = true; hint.textContent = "Current username"; hint.className = "hint ok"; return; }
    hint.textContent = "Checking…"; hint.className = "hint";
    usernameCheckTimer = setTimeout(async function () {
      if (!db) return;
      try {
        var snap = await db.ref("usernames/" + raw).once("value");
        if (snap.exists() && snap.val() !== (user && user.uid)) {
          usernameOk = false; hint.textContent = "Username already taken"; hint.className = "hint error";
        } else {
          usernameOk = true; hint.textContent = "Available ✓"; hint.className = "hint ok";
        }
      } catch (_) {
        usernameOk = true; hint.textContent = "Could not verify — will check on save"; hint.className = "hint";
      }
    }, 450);
  }

  function stageSize() {
    var stage = $("cropStage"); if (!stage) return { w: 320, h: 320 };
    var rect = stage.getBoundingClientRect();
    var w = Math.max(200, Math.floor(rect.width) || 320);
    var h = cropKind === "banner" ? Math.max(120, Math.floor(rect.height) || Math.round(w * 9 / 16)) : Math.max(200, Math.floor(rect.height) || w);
    return { w: w, h: h };
  }

  function ensureHandles() {
    var stage = $("cropStage"); if (!stage) return;
    var box = stage.querySelector(".cropFrame");
    if (!box) {
      box = document.createElement("div");
      box.className = "cropFrame";
      box.innerHTML = '<span class="cropHandle h-tl"></span><span class="cropHandle h-tr"></span><span class="cropHandle h-bl"></span><span class="cropHandle h-br"></span>';
      stage.appendChild(box);
    }
    var mask = $("cropMask");
    if (mask) mask.style.display = cropKind === "banner" ? "none" : "block";
    box.style.display = "block";
  }

  function openCrop(file, kind) {
    if (!file) { toast("No file selected"); return; }
    cropKind = kind === "banner" ? "banner" : "avatar";
    var modal = $("cropModal"), stage = $("cropStage");
    if (!modal || !stage) { toast("Crop UI missing"); return; }
    stage.classList.toggle("banner", cropKind === "banner");
    stage.classList.toggle("avatar", cropKind !== "banner");
    var guides = $("cropGuides");
    if (guides) { guides.hidden = cropKind !== "banner"; guides.style.display = cropKind === "banner" ? "block" : "none"; }
    if ($("cropTitle")) $("cropTitle").textContent = cropKind === "banner" ? "Crop banner" : "Crop photo";
    if ($("cropHint")) $("cropHint").textContent = cropKind === "banner" ? "Drag photo · pull corners to zoom" : "Drag photo · pull corners to zoom · circle = final DP";
    cropScale = 1; cropPanX = 0; cropPanY = 0; cropPointers = {}; cropDragging = false; cropMode = null;
    if ($("cropZoom")) $("cropZoom").value = "1";
    if (cropBlobUrl) { try { URL.revokeObjectURL(cropBlobUrl); } catch (_) {} cropBlobUrl = null; }
    cropImg = new Image();
    cropImg.onload = function () {
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("cropOpen");
      ensureHandles();
      setTimeout(drawCrop, 40);
      setTimeout(drawCrop, 180);
    };
    cropImg.onerror = function () { toast("Could not load image"); closeCrop(); };
    cropBlobUrl = URL.createObjectURL(file);
    cropImg.src = cropBlobUrl;
  }

  function drawCrop() {
    var canvas = $("cropCanvas"); if (!canvas || !cropImg) return;
    var sz = stageSize(), w = sz.w, h = sz.h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, w, h);
    var iw = cropImg.naturalWidth, ih = cropImg.naturalHeight; if (!iw || !ih) return;
    var cover = Math.max(w / iw, h / ih);
    var base = cover * cropScale;
    var dw = iw * base, dh = ih * base;
    var dx = (w - dw) / 2 + cropPanX, dy = (h - dh) / 2 + cropPanY;
    ctx.drawImage(cropImg, dx, dy, dw, dh);
  }

  function finishCrop(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!cropImg) { closeCrop(); return; }
    var sz = stageSize(), w = sz.w, h = sz.h;
    var out = document.createElement("canvas");
    if (cropKind === "banner") { out.width = 1500; out.height = 844; }
    else { out.width = 720; out.height = 720; }
    var octx = out.getContext("2d");
    octx.fillStyle = "#000"; octx.fillRect(0, 0, out.width, out.height);
    var iw = cropImg.naturalWidth, ih = cropImg.naturalHeight;
    var cover = Math.max(w / iw, h / ih);
    var base = cover * cropScale;
    var dw = iw * base, dh = ih * base;
    var dx = (w - dw) / 2 + cropPanX, dy = (h - dh) / 2 + cropPanY;
    var sx = out.width / w, sy = out.height / h;
    octx.drawImage(cropImg, dx * sx, dy * sy, dw * sx, dh * sy);
    if (cropKind !== "banner") {
      var circled = document.createElement("canvas");
      circled.width = out.width; circled.height = out.height;
      var cctx = circled.getContext("2d");
      cctx.beginPath(); cctx.arc(out.width / 2, out.height / 2, out.width / 2, 0, Math.PI * 2); cctx.closePath(); cctx.clip();
      cctx.drawImage(out, 0, 0); out = circled;
    }
    out.toBlob(function (blob) {
      if (!blob) { toast("Crop failed"); return; }
      var file = new File([blob], cropKind + "-crop.jpg", { type: "image/jpeg" });
      if (cropKind === "banner") {
        bannerFile = file;
        if (bannerPreviewUrl) try { URL.revokeObjectURL(bannerPreviewUrl); } catch (_) {}
        bannerPreviewUrl = URL.createObjectURL(file); setBanner(bannerPreviewUrl);
        toast("Banner ready — tap Save");
      } else {
        avatarFile = file;
        if (avatarPreviewUrl) try { URL.revokeObjectURL(avatarPreviewUrl); } catch (_) {}
        avatarPreviewUrl = URL.createObjectURL(file); setAvatar(avatarPreviewUrl);
        toast("Photo ready — tap Save");
      }
      closeCrop();
    }, "image/jpeg", 0.92);
  }

  function closeCrop(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var modal = $("cropModal");
    if (modal) { modal.classList.add("hidden"); modal.setAttribute("aria-hidden", "true"); }
    document.body.classList.remove("cropOpen");
    cropDragging = false; cropMode = null; cropPointers = {};
    if (cropBlobUrl) { try { URL.revokeObjectURL(cropBlobUrl); } catch (_) {} cropBlobUrl = null; }
    cropImg = null;
  }

  function onPointerDown(e) {
    if (!cropImg) return;
    var target = e.target;
    if (target.closest && (target.closest("#cropDone") || target.closest("#cropCancel") || target.closest(".cropHead") || target.closest(".cropControls"))) return;
    e.preventDefault(); e.stopPropagation();
    var isHandle = target.classList && target.classList.contains("cropHandle");
    cropPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    cropLastX = e.clientX; cropLastY = e.clientY; cropStartScale = cropScale;
    if (isHandle) {
      cropMode = "zoom";
      var stage = $("cropStage"); var rect = stage.getBoundingClientRect();
      var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      cropStartDist = Math.sqrt(Math.pow(e.clientX - cx, 2) + Math.pow(e.clientY - cy, 2)) || 1;
    } else {
      cropMode = "pan"; cropDragging = true;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function onPointerMove(e) {
    if (!cropImg) return;
    e.preventDefault();
    if (cropMode === "zoom") {
      var stage = $("cropStage"); var rect = stage.getBoundingClientRect();
      var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      var dist = Math.sqrt(Math.pow(e.clientX - cx, 2) + Math.pow(e.clientY - cy, 2));
      if (cropStartDist > 0) {
        cropScale = Math.max(1, Math.min(4, cropStartScale * (dist / cropStartDist)));
        if ($("cropZoom")) $("cropZoom").value = String(cropScale);
        drawCrop();
      }
      return;
    }
    if (cropMode === "pan" || cropDragging) {
      cropPanX += e.clientX - cropLastX; cropPanY += e.clientY - cropLastY;
      cropLastX = e.clientX; cropLastY = e.clientY; drawCrop();
    }
  }
  function onPointerUp(e) {
    delete cropPointers[e.pointerId];
    if (!Object.keys(cropPointers).length) { cropDragging = false; cropMode = null; }
  }

  function pickAvatar() { var inp = $("avatarInput"); if (!inp) return; try { inp.value = ""; } catch (_) {} inp.click(); }
  function pickBanner() { var inp = $("bannerInput"); if (!inp) return; try { inp.value = ""; } catch (_) {} inp.click(); }
  function onFilePicked(e, kind) {
    var file = e.target.files && e.target.files[0];
    try { e.target.value = ""; } catch (_) {}
    if (!file) return;
    var ok = /^image\//.test(file.type) || !file.type || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name || "");
    if (!ok) { toast("Please choose an image"); return; }
    if (file.size > 18 * 1024 * 1024) { toast("Image too large (max 18 MB)"); return; }
    openCrop(file, kind);
  }

  function compressImage(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image(); var url = URL.createObjectURL(file);
      img.onload = function () {
        try { URL.revokeObjectURL(url); } catch (_) {}
        var w = img.width, h = img.height;
        var scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        var canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) { if (!blob) return reject(new Error("Compress failed")); resolve(blob); }, "image/jpeg", quality);
      };
      img.onerror = function () { try { URL.revokeObjectURL(url); } catch (_) {} reject(new Error("Invalid image")); };
      img.src = url;
    });
  }

  async function uploadImage(file, folder, uid, maxSide) {
    if (!file) return null;
    var blob = await compressImage(file, maxSide || 720, 0.85);
    var cloudName = (window.VIEWORA_CLOUDINARY_CLOUD || window.CLOUDINARY_CLOUD_NAME || "z5m6wjdf").trim();
    var preset = (window.VIEWORA_CLOUDINARY_PRESET || window.CLOUDINARY_UPLOAD_PRESET || "Viewora-upload").trim();
    try {
      var fd = new FormData();
      fd.append("file", blob, (folder || "img") + ".jpg");
      fd.append("upload_preset", preset);
      fd.append("folder", "viewora/" + (folder || "avatars") + "/" + (uid || "user"));
      var res = await fetch("https://api.cloudinary.com/v1_1/" + cloudName + "/image/upload", { method: "POST", body: fd });
      if (res.ok) { var j = await res.json(); if (j.secure_url || j.url) return j.secure_url || j.url; }
    } catch (ce) { console.warn("Cloudinary failed", ce); }
    if (storage) {
      try {
        var path = folder + "/" + uid + "/" + Date.now() + ".jpg";
        var ref = storage.ref(path);
        await ref.put(blob, { contentType: "image/jpeg" });
        return await ref.getDownloadURL();
      } catch (se) { console.warn("Storage failed", se); }
    }
    throw new Error("Image upload failed");
  }

  async function save() {
    if (!user || !db) { toast("Login required"); return; }
    var name = ($("nameInput").value || "").trim().slice(0, 50);
    var uname = ($("usernameInput").value || "").trim().replace(/^@/, "").toLowerCase().slice(0, 30);
    var bio = ($("bioInput").value || "").trim().slice(0, 150);
    var website = ($("websiteInput").value || "").trim().slice(0, 160);
    if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
    var socials = readSocialsFromForm();
    if (!name) { toast("Name is required"); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(uname)) { toast("Invalid username"); return; }
    if (!usernameOk) { toast("Choose an available username"); return; }
    setLoading(true);
    try {
      var oldUname = String(profile.username || profile.userName || "").toLowerCase().replace(/^@/, "");
      if (uname !== oldUname) {
        var taken = await db.ref("usernames/" + uname).once("value");
        if (taken.exists() && taken.val() !== user.uid) { toast("Username already taken"); setLoading(false); return; }
      }
      var photoURL = null, coverURL = null;
      if (avatarFile) { try { photoURL = await uploadImage(avatarFile, "avatars", user.uid, 720); } catch (err) { toast("Photo upload failed — other fields will save"); } }
      if (bannerFile) { try { coverURL = await uploadImage(bannerFile, "banners", user.uid, 1600); } catch (err) { toast("Banner upload failed — other fields will save"); } }
      if (!detectedCountry) await detectCountry();
      var patch = {
        name: name, fullName: name, displayName: name, username: uname, userName: uname, bio: bio,
        website: website || null, link: website || null, socials: socials, socialLinks: socials,
        country: detectedCountry || profile.country || null, countryCode: detectedCountryCode || profile.countryCode || null,
        location: detectedCountry || profile.location || null, updatedAt: Date.now()
      };
      if (photoURL) { patch.profilePhoto = photoURL; patch.photoURL = photoURL; patch.avatar = photoURL; }
      if (coverURL) { patch.coverPhoto = coverURL; patch.banner = coverURL; patch.cover = coverURL; patch.bannerURL = coverURL; }
      await db.ref("users/" + user.uid).update(patch);
      try {
        await db.ref("usernames/" + uname).set(user.uid);
        if (oldUname && oldUname !== uname) await db.ref("usernames/" + oldUname).set(null);
      } catch (_) {}
      try { var ap = { displayName: name }; if (photoURL) ap.photoURL = photoURL; await user.updateProfile(ap); } catch (_) {}
      try {
        if (photoURL) localStorage.setItem("viewora_my_avatar", photoURL);
        if (coverURL) { localStorage.setItem("viewora_my_banner", coverURL); localStorage.setItem("viewora_my_cover", coverURL); }
        localStorage.setItem("viewora_my_name", name); localStorage.setItem("viewora_my_username", uname);
        localStorage.setItem("viewora_profile_updated", String(Date.now()));
      } catch (_) {}
      avatarFile = null; bannerFile = null;
      toast("Profile updated");
      setTimeout(function () { location.href = "profile.html?uid=" + encodeURIComponent(user.uid) + "&t=" + Date.now(); }, 400);
    } catch (e) {
      console.error(e); toast(e.message || "Could not save");
    } finally { setLoading(false); }
  }

  function wire() {
    var done = $("cropDone"), cancel = $("cropCancel");
    if (done) done.onclick = function (e) { finishCrop(e); };
    if (cancel) cancel.onclick = function (e) { closeCrop(e); };

    var stage = $("cropStage");
    if (stage) {
      stage.addEventListener("pointerdown", onPointerDown);
      stage.addEventListener("pointermove", onPointerMove);
      stage.addEventListener("pointerup", onPointerUp);
      stage.addEventListener("pointercancel", onPointerUp);
      stage.addEventListener("wheel", function (e) {
        if (!cropImg) return; e.preventDefault();
        cropScale = Math.max(1, Math.min(4, cropScale + (e.deltaY > 0 ? -0.1 : 0.1)));
        if ($("cropZoom")) $("cropZoom").value = String(cropScale);
        drawCrop();
      }, { passive: false });
    }
    if ($("cropZoom")) $("cropZoom").addEventListener("input", function () { cropScale = parseFloat(this.value) || 1; drawCrop(); });

    if ($("backBtn")) $("backBtn").onclick = function () { if (history.length > 1) history.back(); else location.href = "settings.html"; };
    if ($("saveBtn")) $("saveBtn").onclick = save;
    if ($("avatarCam")) $("avatarCam").onclick = pickAvatar;
    if ($("changePhotoBtn")) $("changePhotoBtn").onclick = pickAvatar;
    if ($("avatarWrap")) $("avatarWrap").addEventListener("click", function (e) { if (e.target.closest && e.target.closest("#avatarCam")) return; pickAvatar(); });
    if ($("avatarInput")) $("avatarInput").addEventListener("change", function (e) { onFilePicked(e, "avatar"); });
    if ($("bannerCam")) $("bannerCam").onclick = pickBanner;
    if ($("bannerWrap")) $("bannerWrap").addEventListener("click", function (e) { if (e.target.closest && e.target.closest("#bannerCam")) return; pickBanner(); });
    if ($("bannerInput")) $("bannerInput").addEventListener("change", function (e) { onFilePicked(e, "banner"); });
    if ($("bioInput")) $("bioInput").addEventListener("input", updateBioCount);
    if ($("usernameInput")) {
      $("usernameInput").addEventListener("input", scheduleUsernameCheck);
      $("usernameInput").addEventListener("blur", scheduleUsernameCheck);
    }
  }

  function boot() {
    wire();
    try {
      auth = firebase.auth(); db = firebase.database();
      if (typeof firebase.storage === "function") { try { storage = firebase.storage(); } catch (_) {} }
    } catch (e) { toast("Firebase not available"); return; }
    auth.onAuthStateChanged(function (u) {
      if (!u) { toast("Login required"); setTimeout(function () { location.href = "login.html"; }, 800); return; }
      user = u;
      db.ref("users/" + u.uid).once("value").then(function (snap) { fillForm(snap.val() || {}); }).catch(function () { fillForm({}); });
    });
  }

  if (window.firebase && firebase.apps && firebase.apps.length) boot();
  else setTimeout(boot, 150);
})();
