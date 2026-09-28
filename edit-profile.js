/* Viewora Edit Profile — banner, avatar, IP country, social links */
(function () {
  "use strict";

  var auth = null;
  var db = null;
  var storage = null;
  var user = null;
  var profile = {};
  var avatarFile = null;
  var bannerFile = null;
  var avatarPreviewUrl = null;
  var bannerPreviewUrl = null;
  var usernameCheckTimer = null;
  var usernameOk = true;
  var detectedCountry = "";
  var detectedCountryCode = "";

  var SOCIAL_KEYS = [
    "instagram",
    "facebook",
    "x",
    "youtube",
    "linkedin",
    "pinterest"
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(function () {
      t.classList.remove("show");
    }, 2400);
  }

  function setLoading(on) {
    var m = $("loadingMask");
    if (m) m.hidden = !on;
    var btn = $("saveBtn");
    if (btn) {
      btn.disabled = !!on;
      btn.classList.toggle("busy", !!on);
    }
  }

  /* ---- Country from IP ---- */
  async function detectCountry() {
    var label = $("countryLabel");
    if (profile.country && profile.country !== "Unknown") {
      detectedCountry = profile.country;
      detectedCountryCode = profile.countryCode || "";
      if (label) label.textContent = detectedCountry;
      return;
    }
    try {
      var res = await fetch("https://ipapi.co/json/", {
        signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
      });
      if (!res.ok) throw new Error("ipapi failed");
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
        var names = {
          IN: "India", US: "United States", PK: "Pakistan", BD: "Bangladesh",
          GB: "United Kingdom", CA: "Canada", AU: "Australia", AE: "United Arab Emirates",
          SA: "Saudi Arabia", NP: "Nepal", LK: "Sri Lanka", DE: "Germany",
          FR: "France", BR: "Brazil", NG: "Nigeria", ID: "Indonesia",
          PH: "Philippines", MY: "Malaysia", SG: "Singapore", JP: "Japan"
        };
        detectedCountry = names[detectedCountryCode] || detectedCountryCode || "Unknown";
        if (label) label.textContent = detectedCountry;
      } catch (__) {
        detectedCountry = profile.country || "Unknown";
        if (label) label.textContent = detectedCountry;
      }
    }
  }

  /* ---- Social normalize: handle or full URL → clean handle + canonical URL ---- */
  function stripHandle(raw) {
    raw = String(raw || "").trim();
    if (!raw) return "";
    raw = raw.replace(/^@/, "");
    try {
      if (/^https?:\/\//i.test(raw)) {
        var u = new URL(raw);
        var path = (u.pathname || "").replace(/^\/+|\/+$/g, "");
        if (/youtube\.com/i.test(u.hostname)) {
          path = path.replace(/^(c|channel|user|@)\//, "").replace(/^@/, "");
        }
        if (/linkedin\.com/i.test(u.hostname)) {
          path = path.replace(/^(in|company)\//, "");
        }
        if (/facebook\.com|fb\.com/i.test(u.hostname)) {
          path = path.replace(/^profile\.php.*/, "").split("/")[0];
        }
        return path.split("/")[0] || raw;
      }
    } catch (_) {}
    return raw.replace(/\s+/g, "");
  }

  function buildSocialUrl(platform, handleOrUrl) {
    var raw = String(handleOrUrl || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    var h = stripHandle(raw);
    if (!h) return "";
    switch (platform) {
      case "instagram":
        return "https://instagram.com/" + encodeURIComponent(h);
      case "facebook":
        return "https://facebook.com/" + encodeURIComponent(h);
      case "x":
        return "https://x.com/" + encodeURIComponent(h);
      case "youtube":
        return h.indexOf("UC") === 0
          ? "https://youtube.com/channel/" + encodeURIComponent(h)
          : "https://youtube.com/@" + encodeURIComponent(h.replace(/^@/, ""));
      case "linkedin":
        return "https://linkedin.com/in/" + encodeURIComponent(h);
      case "pinterest":
        return "https://pinterest.com/" + encodeURIComponent(h);
      default:
        return raw;
    }
  }

  function readSocialsFromForm() {
    var out = {};
    SOCIAL_KEYS.forEach(function (k) {
      var el = $("social_" + k);
      var val = el ? (el.value || "").trim() : "";
      if (val) {
        out[k] = {
          handle: stripHandle(val),
          url: buildSocialUrl(k, val)
        };
      }
    });
    return out;
  }

  function fillForm(p) {
    profile = p || {};
    var name =
      profile.name ||
      profile.fullName ||
      profile.displayName ||
      (user && user.displayName) ||
      "";
    var uname = String(
      profile.username || profile.userName || ""
    ).replace(/^@/, "");
    var bio = profile.bio || "";
    var web = profile.website || profile.link || "";

    $("nameInput").value = name;
    $("usernameInput").value = uname;
    $("bioInput").value = bio;
    $("websiteInput").value = web;
    $("bioCount").textContent = String(bio.length);

    var socials = profile.socials || profile.socialLinks || {};
    if (typeof socials === "string") {
      try {
        socials = JSON.parse(socials) || {};
      } catch (_) {
        socials = {};
      }
    }
    SOCIAL_KEYS.forEach(function (k) {
      var el = $("social_" + k);
      if (!el) return;
      var s = socials[k];
      if (typeof s === "string") el.value = s;
      else if (s && (s.handle || s.url)) el.value = s.handle || s.url || "";
      else el.value = profile[k] || "";
    });

    var photo =
      profile.profilePhoto ||
      profile.photoURL ||
      profile.avatar ||
      (user && user.photoURL) ||
      "";
    setAvatar(photo);

    var cover =
      profile.coverPhoto ||
      profile.banner ||
      profile.cover ||
      "";
    setBanner(cover);

    detectCountry();
  }

  function setAvatar(url) {
    var img = $("avatarImg");
    var fb = $("avatarFb");
    if (url) {
      img.style.display = "block";
      img.src = url;
      fb.style.display = "none";
    } else {
      img.style.display = "none";
      fb.style.display = "grid";
      var letter = (
        ($("nameInput").value || $("usernameInput").value || "V")[0] || "V"
      ).toUpperCase();
      fb.textContent = letter;
    }
  }

  function setBanner(url) {
    var img = $("bannerImg");
    if (!img) return;
    if (url) {
      img.src = url;
      img.style.opacity = "1";
    } else {
      img.src = "assets/default-banner.jpg";
    }
  }

  function updateBioCount() {
    $("bioCount").textContent = String(($("bioInput").value || "").length);
  }

  function scheduleUsernameCheck() {
    clearTimeout(usernameCheckTimer);
    var hint = $("usernameHint");
    var raw = ($("usernameInput").value || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    if (!raw) {
      usernameOk = false;
      hint.textContent = "Username required";
      hint.className = "hint error";
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(raw)) {
      usernameOk = false;
      hint.textContent = "3–30 chars: letters, numbers, underscores only";
      hint.className = "hint error";
      return;
    }
    var current = String(profile.username || profile.userName || "")
      .toLowerCase()
      .replace(/^@/, "");
    if (raw === current) {
      usernameOk = true;
      hint.textContent = "Current username";
      hint.className = "hint ok";
      return;
    }
    hint.textContent = "Checking…";
    hint.className = "hint";
    usernameCheckTimer = setTimeout(async function () {
      if (!db) return;
      try {
        var snap = await db.ref("usernames/" + raw).once("value");
        if (snap.exists() && snap.val() !== (user && user.uid)) {
          usernameOk = false;
          hint.textContent = "Username already taken";
          hint.className = "hint error";
        } else {
          usernameOk = true;
          hint.textContent = "Available";
          hint.className = "hint ok";
        }
      } catch (_) {
        usernameOk = true;
        hint.textContent = "Could not verify — will check on save";
        hint.className = "hint";
      }
    }, 450);
  }


  /* ---- Simple crop (avatar 1:1, banner 3:1) ---- */
  var cropKind = "avatar"; // avatar | banner
  var cropImg = null;
  var cropScale = 1;
  var cropPanX = 0;
  var cropPanY = 0;
  var cropDragging = false;
  var cropLastX = 0;
  var cropLastY = 0;

  function openCrop(file, kind) {
    cropKind = kind === "banner" ? "banner" : "avatar";
    var modal = $("cropModal");
    var stage = document.querySelector(".cropStage");
    if (stage) stage.classList.toggle("banner", cropKind === "banner");
    $("cropTitle").textContent = cropKind === "banner" ? "Crop banner" : "Crop photo";
    $("cropHint").textContent =
      cropKind === "banner" ? "3:1 banner · drag & zoom" : "Square photo · drag & zoom";
    cropScale = 1;
    cropPanX = 0;
    cropPanY = 0;
    $("cropZoom").value = "1";
    cropImg = new Image();
    cropImg.onload = function () {
      drawCrop();
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
    };
    cropImg.src = URL.createObjectURL(file);
  }

  function drawCrop() {
    var canvas = $("cropCanvas");
    if (!canvas || !cropImg) return;
    var stage = canvas.parentElement;
    var w = stage.clientWidth || 320;
    var h = stage.clientHeight || (cropKind === "banner" ? Math.round(w / 3) : w);
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    var iw = cropImg.naturalWidth;
    var ih = cropImg.naturalHeight;
    var base = Math.max(w / iw, h / ih) * cropScale;
    var dw = iw * base;
    var dh = ih * base;
    var dx = (w - dw) / 2 + cropPanX;
    var dy = (h - dh) / 2 + cropPanY;
    ctx.drawImage(cropImg, dx, dy, dw, dh);
  }

  function finishCrop() {
    var canvas = $("cropCanvas");
    if (!canvas) return;
    // Export at target resolution
    var out = document.createElement("canvas");
    if (cropKind === "banner") {
      out.width = 1500;
      out.height = 500;
    } else {
      out.width = 720;
      out.height = 720;
    }
    var octx = out.getContext("2d");
    // redraw scaled
    var w = canvas.width;
    var h = canvas.height;
    var iw = cropImg.naturalWidth;
    var ih = cropImg.naturalHeight;
    var base = Math.max(w / iw, h / ih) * cropScale;
    var dw = iw * base;
    var dh = ih * base;
    var dx = (w - dw) / 2 + cropPanX;
    var dy = (h - dh) / 2 + cropPanY;
    // map canvas coords to out
    var sx = -dx / base;
    var sy = -dy / base;
    var sw = w / base;
    var sh = h / base;
    octx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, out.width, out.height);
    out.toBlob(function (blob) {
      if (!blob) return;
      var file = new File([blob], cropKind + "-crop.jpg", { type: "image/jpeg" });
      if (cropKind === "banner") {
        bannerFile = file;
        if (bannerPreviewUrl) try { URL.revokeObjectURL(bannerPreviewUrl); } catch (_) {}
        bannerPreviewUrl = URL.createObjectURL(file);
        setBanner(bannerPreviewUrl);
      } else {
        avatarFile = file;
        if (avatarPreviewUrl) try { URL.revokeObjectURL(avatarPreviewUrl); } catch (_) {}
        avatarPreviewUrl = URL.createObjectURL(file);
        setAvatar(avatarPreviewUrl);
      }
      closeCrop();
    }, "image/jpeg", 0.92);
  }

  function closeCrop() {
    var modal = $("cropModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    if (cropImg && cropImg.src && cropImg.src.indexOf("blob:") === 0) {
      try { URL.revokeObjectURL(cropImg.src); } catch (_) {}
    }
    cropImg = null;
  }

  // Replace onAvatarPicked / onBannerPicked to open crop

  function pickAvatar() {
    var inp = $("avatarInput");
    if (!inp) return;
    try { inp.value = ""; } catch (_) {}
    inp.setAttribute("accept", "image/*");
    // iOS/Android WebView: click must be sync in gesture
    inp.click();
  }
  function pickBanner() {
    var inp = $("bannerInput");
    if (!inp) return;
    try { inp.value = ""; } catch (_) {}
    inp.setAttribute("accept", "image/*");
    inp.click();
  }

  function onAvatarPicked(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast("Please choose an image");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Image must be under 10 MB");
      return;
    }
    openCrop(file, "avatar");
    try { e.target.value = ""; } catch (_) {}
  }

  function onBannerPicked(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast("Please choose an image");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast("Banner must be under 12 MB");
      return;
    }
    openCrop(file, "banner");
    try { e.target.value = ""; } catch (_) {}
  }

  function compressImage(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
        var w = img.width;
        var h = img.height;
        var scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          function (blob) {
            if (!blob) return reject(new Error("Compress failed"));
            resolve(blob);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = function () {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
        reject(new Error("Invalid image"));
      };
      img.src = url;
    });
  }

  async function uploadImage(file, folder, uid, maxSide) {
    if (!file || !storage) return null;
    var blob = await compressImage(file, maxSide || 720, 0.82);
    var path = folder + "/" + uid + "/" + Date.now() + ".jpg";
    var ref = storage.ref(path);
    await ref.put(blob, { contentType: "image/jpeg" });
    return await ref.getDownloadURL();
  }

  async function save() {
    if (!user || !db) {
      toast("Login required");
      return;
    }
    var name = ($("nameInput").value || "").trim().slice(0, 50);
    var uname = ($("usernameInput").value || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase()
      .slice(0, 30);
    var bio = ($("bioInput").value || "").trim().slice(0, 150);
    var website = ($("websiteInput").value || "").trim().slice(0, 160);
    if (website && !/^https?:\/\//i.test(website)) {
      website = "https://" + website;
    }
    var socials = readSocialsFromForm();

    if (!name) {
      toast("Name is required");
      $("nameInput").focus();
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(uname)) {
      toast("Invalid username");
      $("usernameInput").focus();
      return;
    }
    if (!usernameOk) {
      toast("Choose an available username");
      $("usernameInput").focus();
      return;
    }

    setLoading(true);
    try {
      var oldUname = String(profile.username || profile.userName || "")
        .toLowerCase()
        .replace(/^@/, "");

      if (uname !== oldUname) {
        var taken = await db.ref("usernames/" + uname).once("value");
        if (taken.exists() && taken.val() !== user.uid) {
          toast("Username already taken");
          usernameOk = false;
          $("usernameHint").textContent = "Username already taken";
          $("usernameHint").className = "hint error";
          setLoading(false);
          return;
        }
      }

      var photoURL = null;
      var coverURL = null;
      if (avatarFile) {
        try {
          photoURL = await uploadImage(avatarFile, "avatars", user.uid, 720);
        } catch (upErr) {
          console.warn("Avatar upload failed", upErr);
          toast("Photo upload failed — saving other fields");
        }
      }
      if (bannerFile) {
        try {
          coverURL = await uploadImage(bannerFile, "banners", user.uid, 1600);
        } catch (upErr) {
          console.warn("Banner upload failed", upErr);
          toast("Banner upload failed — saving other fields");
        }
      }

      if (!detectedCountry) await detectCountry();

      var patch = {
        name: name,
        fullName: name,
        displayName: name,
        username: uname,
        userName: uname,
        bio: bio,
        website: website || null,
        link: website || null,
        socials: socials,
        country: detectedCountry || profile.country || null,
        countryCode: detectedCountryCode || profile.countryCode || null,
        location: detectedCountry || profile.location || null,
        updatedAt: Date.now()
      };
      if (photoURL) {
        patch.profilePhoto = photoURL;
        patch.photoURL = photoURL;
        patch.avatar = photoURL;
      }
      if (coverURL) {
        patch.coverPhoto = coverURL;
        patch.banner = coverURL;
        patch.cover = coverURL;
      }

      var updates = {};
      Object.keys(patch).forEach(function (k) {
        updates["users/" + user.uid + "/" + k] = patch[k];
      });
      updates["usernames/" + uname] = user.uid;
      if (oldUname && oldUname !== uname) {
        updates["usernames/" + oldUname] = null;
      }

      await db.ref().update(updates);

      try {
        var authPatch = { displayName: name };
        if (photoURL) authPatch.photoURL = photoURL;
        await user.updateProfile(authPatch);
      } catch (_) {}

      try {
        if (photoURL) localStorage.setItem("viewora_my_avatar", photoURL);
        if (coverURL) {
          localStorage.setItem("viewora_my_banner", coverURL);
          localStorage.setItem("viewora_my_cover", coverURL);
        }
        localStorage.setItem("viewora_my_name", name);
        localStorage.setItem("viewora_my_username", uname);
      } catch (_) {}

      profile = Object.assign(profile, patch);
      avatarFile = null;
      bannerFile = null;
      toast("Profile updated");
      setTimeout(function () {
        if (history.length > 1) history.back();
        else location.href = "profile.html";
      }, 600);
    } catch (e) {
      console.error(e);
      toast(e.message || "Could not save");
    } finally {
      setLoading(false);
    }
  }

  function wire() {
    $("backBtn").addEventListener("click", function () {
      if (history.length > 1) history.back();
      else location.href = "settings.html";
    });
    $("saveBtn").addEventListener("click", save);
    $("avatarCam").addEventListener("click", pickAvatar);
    $("changePhotoBtn").addEventListener("click", pickAvatar);
    $("avatarInput").addEventListener("change", onAvatarPicked);
    $("bannerCam").addEventListener("click", pickBanner);
    $("bannerInput").addEventListener("change", onBannerPicked);
    $("bioInput").addEventListener("input", updateBioCount);
    $("usernameInput").addEventListener("input", scheduleUsernameCheck);
    $("usernameInput").addEventListener("blur", scheduleUsernameCheck);
  }

  function boot() {
    wire();
    try {
      auth = firebase.auth();
      db = firebase.database();
      if (typeof firebase.storage === "function") {
        storage = firebase.storage();
      }
    } catch (e) {
      console.warn(e);
      toast("Firebase not available");
      return;
    }
    try {
      $("cropCancel") && $("cropCancel").addEventListener("click", closeCrop);
      $("cropDone") && $("cropDone").addEventListener("click", finishCrop);
      $("cropZoom") && $("cropZoom").addEventListener("input", function () {
        cropScale = parseFloat($("cropZoom").value) || 1;
        drawCrop();
      });
      var stage = document.querySelector(".cropStage");
      if (stage) {
        stage.addEventListener("pointerdown", function (e) {
          cropDragging = true;
          cropLastX = e.clientX;
          cropLastY = e.clientY;
          try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        });
        stage.addEventListener("pointermove", function (e) {
          if (!cropDragging) return;
          cropPanX += e.clientX - cropLastX;
          cropPanY += e.clientY - cropLastY;
          cropLastX = e.clientX;
          cropLastY = e.clientY;
          drawCrop();
        });
        stage.addEventListener("pointerup", function () { cropDragging = false; });
        stage.addEventListener("pointercancel", function () { cropDragging = false; });
      }
    } catch (_) {}
    auth.onAuthStateChanged(function (u) {
      if (!u) {
        toast("Login required");
        setTimeout(function () {
          location.href = "index.html";
        }, 800);
        return;
      }
      user = u;
      db.ref("users/" + u.uid)
        .once("value")
        .then(function (snap) {
          fillForm(snap.val() || {});
        })
        .catch(function () {
          fillForm({});
        });
    });
  }

  if (window.firebase && firebase.apps && firebase.apps.length) boot();
  else setTimeout(boot, 150);
})();
