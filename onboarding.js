/**
 * VIEWORA — Onboarding (Instagram-style)
 * Steps: Photo → Age+Verify → Follow → Permissions → Welcome
 */
(function () {
  "use strict";

  var MIN_AGE = 13;
  var step = 1;
  var total = 4;
  var state = {
    avatarFile: null,
    bannerFile: null,
    avatarUrl: "",
    bannerUrl: "",
    dob: "",
    ageVerified: false,
    followed: {},
    notif: false,
    loc: false
  };

  var auth = null;
  var db = null;
  var storage = null;
  var user = null;

  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    if (typeof showToast === "function") return showToast(msg);
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#1a1a24;color:#fff;padding:12px 18px;border-radius:12px;font-size:13px;z-index:200;border:1px solid rgba(255,255,255,.1)";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2400);
  }

  function waitAuth() {
    return new Promise(function (resolve) {
      try {
        if (!window.firebase || !firebase.auth) {
          resolve(null);
          return;
        }
        auth = firebase.auth();
        db = firebase.database();
        try { if (typeof firebase.storage === "function") storage = firebase.storage(); } catch (_) {}
        var unsub = auth.onAuthStateChanged(function (u) {
          unsub && unsub();
          user = u;
          resolve(u);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function ageFromDob(val) {
    if (!val) return null;
    var dob = new Date(val + "T00:00:00");
    if (isNaN(dob.getTime())) return null;
    var t = new Date();
    var age = t.getFullYear() - dob.getFullYear();
    var m = t.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < dob.getDate())) age--;
    return age;
  }

  function maxDob() {
    var d = new Date();
    d.setFullYear(d.getFullYear() - MIN_AGE);
    return d.toISOString().slice(0, 10);
  }

  function minDob() {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 120);
    return d.toISOString().slice(0, 10);
  }

  function goStep(n) {
    if (n < 1) n = 1;
    if (n > total) n = total;
    step = n;
    document.querySelectorAll(".obStep").forEach(function (el) {
      el.classList.toggle("active", Number(el.getAttribute("data-step")) === step);
    });
    document.querySelectorAll(".obProgress i").forEach(function (el) {
      var s = Number(el.getAttribute("data-step"));
      el.classList.toggle("active", s === step);
      el.classList.toggle("done", s < step);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === 3) loadSuggestions();
  }

  function skipOrNext() {
    if (step === 2 && !state.ageVerified) {
      toast("You must be " + MIN_AGE + "+ to continue");
      return;
    }
    if (step < total) goStep(step + 1);
    else finish();
  }

  /* ---- uploads (Cloudinary preferred, Storage optional) ---- */
  async function uploadImage(file, folder) {
    if (!file) return "";
    var cloud = window.VIEWORA_CLOUDINARY_CLOUD || window.CLOUDINARY_CLOUD_NAME || "z5m6wjdf";
    var preset = window.VIEWORA_CLOUDINARY_PRESET || window.CLOUDINARY_UPLOAD_PRESET || "Viewora-upload";
    try {
      var fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", preset);
      fd.append("folder", "viewora/" + (folder || "onboarding") + "/" + (user && user.uid ? user.uid : "user"));
      var res = await fetch("https://api.cloudinary.com/v1_1/" + cloud + "/image/upload", { method: "POST", body: fd });
      if (res.ok) {
        var j = await res.json();
        if (j.secure_url) return j.secure_url;
      }
    } catch (e) {
      console.warn("Cloudinary upload", e);
    }
    if (storage && user) {
      try {
        var path = (folder || "avatars") + "/" + user.uid + "/" + Date.now() + ".jpg";
        var ref = storage.ref(path);
        await ref.put(file, { contentType: file.type || "image/jpeg" });
        return await ref.getDownloadURL();
      } catch (e2) {
        console.warn("Storage upload", e2);
      }
    }
    return URL.createObjectURL(file);
  }

  function bindPhoto() {
    $("obAvatarPick")?.addEventListener("click", function () { $("obAvatarFile")?.click(); });
    $("obBannerPick")?.addEventListener("click", function () { $("obBannerFile")?.click(); });
    $("obAvatarFile")?.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      state.avatarFile = f;
      $("obAvatarPreview").src = URL.createObjectURL(f);
    });
    $("obBannerFile")?.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      state.bannerFile = f;
      $("obBannerPreview").src = URL.createObjectURL(f);
    });
    $("obNext1")?.addEventListener("click", async function () {
      var btn = $("obNext1");
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
      try {
        if (state.avatarFile) state.avatarUrl = await uploadImage(state.avatarFile, "avatars");
        if (state.bannerFile) state.bannerUrl = await uploadImage(state.bannerFile, "covers");
        if (user && db) {
          var patch = {};
          if (state.avatarUrl) {
            patch.profilePhoto = state.avatarUrl;
            patch.photoURL = state.avatarUrl;
            patch.avatar = state.avatarUrl;
          }
          if (state.bannerUrl) {
            patch.coverPhoto = state.bannerUrl;
            patch.banner = state.bannerUrl;
          }
          if (Object.keys(patch).length) await db.ref("users/" + user.uid).update(patch);
          try {
            if (state.avatarUrl) localStorage.setItem("viewora_my_avatar", state.avatarUrl);
            if (state.bannerUrl) localStorage.setItem("viewora_my_banner", state.bannerUrl);
          } catch (_) {}
        }
      } catch (err) {
        console.warn(err);
        toast("Could not save photo — you can add later");
      }
      btn.disabled = false;
      btn.innerHTML = 'Continue <i class="fa-solid fa-arrow-right"></i>';
      goStep(2);
    });
  }

  /* ---- age + verify ---- */
  function bindVerify() {
    var dob = $("obDob");
    if (dob) {
      dob.max = maxDob();
      dob.min = minDob();
    }
    function refreshAge() {
      var msg = $("obAgeMsg");
      var block = $("obAgeBlock");
      var next = $("obNext2");
      var val = dob && dob.value;
      var age = ageFromDob(val);
      var conf = $("obAgeConfirm") && $("obAgeConfirm").checked;
      state.dob = val || "";
      state.ageVerified = false;
      if (!val) {
        msg.textContent = "You must be at least " + MIN_AGE + " years old";
        msg.className = "obMsg";
        block.classList.add("hidden");
        next.disabled = true;
        return;
      }
      if (age === null) {
        msg.textContent = "Enter a valid date";
        msg.className = "obMsg err";
        next.disabled = true;
        return;
      }
      if (age < MIN_AGE) {
        msg.textContent = "You must be at least " + MIN_AGE + " to use Viewora";
        msg.className = "obMsg err";
        block.classList.remove("hidden");
        next.disabled = true;
        state.ageVerified = false;
        return;
      }
      block.classList.add("hidden");
      msg.textContent = "Age verified (" + age + " years)";
      msg.className = "obMsg ok";
      state.ageVerified = !!conf;
      next.disabled = !conf;
    }
    dob?.addEventListener("change", refreshAge);
    dob?.addEventListener("input", refreshAge);
    $("obAgeConfirm")?.addEventListener("change", refreshAge);

    document.querySelectorAll(".obTab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".obTab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        var mode = tab.getAttribute("data-verify");
        $("obVerifyEmail").classList.toggle("hidden", mode !== "email");
        $("obVerifyPhone").classList.toggle("hidden", mode !== "phone");
      });
    });

    if (user && user.email && $("obEmail")) $("obEmail").value = user.email;

    $("obSendEmail")?.addEventListener("click", async function () {
      if (!user) return toast("Login required");
      try {
        await user.sendEmailVerification();
        $("obEmailStatus").textContent = "Verification link sent — check your inbox";
        toast("Email sent");
      } catch (e) {
        toast(e.message || "Could not send email");
      }
    });

    $("obSendOtp")?.addEventListener("click", function () {
      toast("Enable Phone Auth in Firebase to use OTP");
      $("obPhoneStatus").textContent = "Configure Phone provider in Firebase Console";
    });

    $("obNext2")?.addEventListener("click", async function () {
      if (!state.ageVerified) {
        toast("Confirm you are " + MIN_AGE + "+");
        return;
      }
      if (user && db) {
        try {
          await db.ref("users/" + user.uid).update({
            dateOfBirth: state.dob,
            ageVerified: true,
            ageVerifiedAt: Date.now()
          });
        } catch (e) {
          console.warn(e);
        }
      }
      goStep(3);
    });
  }

  /* ---- suggested follows ---- */
  var DEFAULT_SUGGEST = [
    { uid: "viewora", name: "Viewora", username: "viewora", photo: "assets/logo.png", badge: "Official" },
    { uid: "demo1", name: "Creator Hub", username: "creatorhub", photo: "", badge: "Creator" },
    { uid: "demo2", name: "Viral Now", username: "viralnow", photo: "", badge: "Trending" },
    { uid: "demo3", name: "Music Wave", username: "musicwave", photo: "", badge: "" },
    { uid: "demo4", name: "Daily Clips", username: "dailyclips", photo: "", badge: "" }
  ];

    function niceName(v) {
    var name = (v.name || v.fullName || v.displayName || "").trim();
    var uname = String(v.username || v.userName || "").replace(/^@/, "").trim();
    if (name && !/^user$/i.test(name)) return name;
    if (uname && !/^user$/i.test(uname)) return uname;
    return name || uname || "Viewora user";
  }

  function mapUser(uid, v) {
    v = v || {};
    if (v.banned || v.disabled || v.deleted || v.status === "deleted") return null;
    var uname = String(v.username || v.userName || v.handle || "").replace(/^@/, "").trim();
    return {
      uid: uid,
      name: niceName(v),
      username: uname || "viewora_user",
      photo: v.profilePhoto || v.photoURL || v.avatar || v.profilePic || "",
      // keep full tick fields for VieworaBadges
      redTick: !!(v.redTick || v.vip || v.elite),
      blueTick: !!(v.blueTick || v.verified || v.isVerified),
      yellowTick: !!(v.yellowTick || v.businessVerified),
      whiteTick: !!v.whiteTick,
      vip: !!v.vip,
      elite: !!v.elite,
      verified: !!(v.verified || v.isVerified || v.blueTick),
      tickType: v.tickType || v.badge || "",
      badge: v.badge || "",
      _raw: v
    };
  }

  function tickHtml(u) {
    if (!u) return "";
    try {
      if (window.VieworaBadges && typeof VieworaBadges.resolveBadge === "function") {
        var b = VieworaBadges.resolveBadge(u._raw || u);
        if (b && b.html) return " " + b.html;
      }
    } catch (_) {}
    var tt = String(u.tickType || "").toLowerCase();
    var color = "";
    if (tt === "red" || u.redTick || u.vip || u.elite) color = "#E53935";
    else if (tt === "blue" || u.blueTick || u.verified) color = "#1D9BF0";
    else if (tt === "yellow" || u.yellowTick) color = "#F5C518";
    else if (tt === "white" || u.whiteTick) color = "#F0F4FA";
    if (!color) return "";
    return ' <i class="fa-solid fa-circle-check" style="color:' + color + ';font-size:13px;margin-left:3px"></i>';
  }

  var _suggestCache = [];

  async function loadSuggestions() {
    var list = $("obSuggestList");
    if (!list) return;
    list.innerHTML = '<div class="obPeopleLoading"><i class="fa-solid fa-spinner fa-spin"></i> Loading…</div>';
    var people = [];
    try {
      if (db) {
        var snap = await db.ref("users").limitToFirst(80).once("value");
        if (snap.exists()) {
          snap.forEach(function (ch) {
            var uid = ch.key;
            if (user && uid === user.uid) return;
            var mapped = mapUser(uid, ch.val());
            if (mapped) people.push(mapped);
          });
        }
      }
    } catch (e) {
      console.warn(e);
    }
    if (!people.length) people = DEFAULT_SUGGEST.slice();
    people = people.slice(0, 24);
    _suggestCache = people;
    renderPeople(people);

    var searchEl = $("obFollowSearch");
    if (searchEl && !searchEl.__bound) {
      searchEl.__bound = true;
      var searchTimer = null;
      searchEl.addEventListener("input", function () {
        var q = (this.value || "").toLowerCase().trim();
        clearTimeout(searchTimer);
        if (!q) {
          renderPeople(_suggestCache);
          return;
        }
        // local filter first (instant)
        var local = _suggestCache.filter(function (p) {
          return (p.name + " " + p.username).toLowerCase().indexOf(q) !== -1;
        });
        renderPeople(local);
        // then Firebase username lookup
        searchTimer = setTimeout(async function () {
          if (!db || q.length < 1) return;
          try {
            var results = [];
            var seen = {};
            function addMapped(uid, val) {
              if (!uid || (user && uid === user.uid) || seen[uid]) return;
              var mapped = mapUser(uid, val);
              if (mapped) {
                seen[uid] = true;
                results.push(mapped);
              }
            }

            // 1) usernames index (if exists)
            try {
              var unameSnap = await db.ref("usernames").orderByKey().startAt(q).endAt(q + "\uf8ff").limitToFirst(20).once("value");
              if (unameSnap.exists()) {
                var jobs = [];
                unameSnap.forEach(function (ch) {
                  var uid = ch.val();
                  if (typeof uid === "string" && uid) {
                    jobs.push(
                      db.ref("users/" + uid).once("value").then(function (us) {
                        addMapped(uid, us.val());
                      })
                    );
                  }
                });
                await Promise.all(jobs);
              }
            } catch (e1) {
              console.warn("usernames search", e1);
            }

            // 2) users.username prefix (needs .indexOn: username)
            if (results.length < 12) {
              try {
                var byUser = await db
                  .ref("users")
                  .orderByChild("username")
                  .startAt(q)
                  .endAt(q + "\uf8ff")
                  .limitToFirst(20)
                  .once("value");
                if (byUser.exists()) {
                  byUser.forEach(function (ch) {
                    addMapped(ch.key, ch.val());
                  });
                }
              } catch (e2) {
                console.warn("username field search", e2);
              }
            }

            // 3) displayName prefix
            if (results.length < 12) {
              try {
                var byName = await db
                  .ref("users")
                  .orderByChild("displayName")
                  .startAt(q)
                  .endAt(q + "\uf8ff")
                  .limitToFirst(15)
                  .once("value");
                if (byName.exists()) {
                  byName.forEach(function (ch) {
                    addMapped(ch.key, ch.val());
                  });
                }
              } catch (e3) {
                console.warn("displayName search", e3);
              }
            }

            // 4) client-side scan fallback (first 200 users) — works without indexes
            if (results.length < 5) {
              try {
                var scan = await db.ref("users").limitToFirst(200).once("value");
                if (scan.exists()) {
                  scan.forEach(function (ch) {
                    var v = ch.val() || {};
                    var hay = (
                      (v.displayName || "") + " " +
                      (v.name || "") + " " +
                      (v.username || "") + " " +
                      (v.handle || "")
                    ).toLowerCase();
                    if (hay.indexOf(q) !== -1) addMapped(ch.key, v);
                  });
                }
              } catch (e4) {
                console.warn("scan search", e4);
              }
            }

            // merge with local
            local.forEach(function (p) {
              if (p && !seen[p.uid]) {
                seen[p.uid] = true;
                results.unshift(p);
              }
            });

            renderPeople(results.length ? results : []);
          } catch (e) {
            console.warn("search", e);
            renderPeople(local);
          }
        }, 280);
      });
    }
  }

    function renderPeople(people) {
    var list = $("obSuggestList");
    if (!list) return;
    if (!people.length) {
      list.innerHTML = '<div class="obPeopleLoading">No people found</div>';
      return;
    }
    list.innerHTML = people.map(function (p) {
      var followed = !!state.followed[p.uid];
      var img = p.photo || ("https://ui-avatars.com/api/?name=" + encodeURIComponent(p.name) + "&background=6d28d9&color=fff&size=96");
      return (
        '<div class="obPerson" data-uid="' + p.uid + '">' +
        '<img src="' + img + '" alt="" onerror="this.src=\'https://ui-avatars.com/api/?name=U&background=6d28d9&color=fff&size=96\'">' +
        '<div class="obPersonMeta"><strong>' + escapeHtml(p.name) + tickHtml(p) +
        "</strong><span>@" + escapeHtml(p.username) + "</span></div>" +
        '<button type="button" class="obFollowBtn' + (followed ? " following" : "") + '" data-follow="' + p.uid + '">' +
        (followed ? "✓ Following" : "Follow") + "</button></div>"
      );
    }).join("");

    list.querySelectorAll("[data-follow]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggleFollow(btn.getAttribute("data-follow"), btn);
      });
    });
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  async function toggleFollow(targetUid, btn) {
    if (!user || !db || !targetUid) {
      state.followed[targetUid] = !state.followed[targetUid];
      btn.classList.toggle("following", !!state.followed[targetUid]);
      btn.textContent = state.followed[targetUid] ? "Following" : "Follow";
      return;
    }
    if (targetUid === user.uid) return;
    var on = !state.followed[targetUid];
    btn.disabled = true;
    try {
      var updates = {};
      // canonical graphs used by profile / feed / shorts
      updates["following/" + user.uid + "/" + targetUid] = on ? true : null;
      updates["followers/" + targetUid + "/" + user.uid] = on ? true : null;
      // nested mirrors some pages still read
      updates["users/" + user.uid + "/following/" + targetUid] = on ? true : null;
      updates["users/" + targetUid + "/followers/" + user.uid] = on ? true : null;
      await db.ref().update(updates);
      state.followed[targetUid] = on;
      btn.classList.toggle("following", on);
      btn.textContent = on ? "Following" : "Follow";
      toast(on ? "Following" : "Unfollowed");
    } catch (e) {
      console.warn(e);
      toast("Follow failed");
    }
    btn.disabled = false;
  }

  $("obNext3")?.addEventListener("click", function () { goStep(4); });

  /* ---- permissions ---- */
  function bindPerms() {
    $("obEnableNotif")?.addEventListener("click", async function () {
      var btn = this;
      try {
        if (!("Notification" in window)) {
          toast("Notifications not supported");
          return;
        }
        var perm = await Notification.requestPermission();
        if (perm === "granted") {
          state.notif = true;
          btn.textContent = "On";
          btn.classList.add("on");
          toast("Notifications enabled");
          if (user && db) {
            await db.ref("notificationSettings/" + user.uid).update({ push: true, enabled: true });
          }
        } else {
          toast("Permission denied");
        }
      } catch (e) {
        toast("Could not enable notifications");
      }
    });

    $("obEnableLoc")?.addEventListener("click", function () {
      var btn = this;
      if (!navigator.geolocation) {
        toast("Location not supported");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async function (pos) {
          state.loc = true;
          btn.textContent = "On";
          btn.classList.add("on");
          toast("Location enabled");
          if (user && db) {
            try {
              await db.ref("users/" + user.uid).update({
                lastLat: pos.coords.latitude,
                lastLng: pos.coords.longitude,
                locationEnabled: true
              });
            } catch (_) {}
          }
        },
        function () {
          toast("Location permission denied");
        },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });

    $("obFinish")?.addEventListener("click", finish);
  }

  async function finish() {
    if (step === 2 && !state.ageVerified) {
      toast("Age verification required");
      goStep(2);
      return;
    }
    if (user && db) {
      try {
        await db.ref("users/" + user.uid).update({
          onboardingComplete: true,
          onboardingAt: Date.now()
        });
      } catch (_) {}
    }
    try { localStorage.setItem("viewora_onboarding_done", "1"); } catch (_) {}
    showWelcome();
  }

  function showWelcome() {
    var ov = $("welcomeOverlay");
    if (!ov) {
      location.replace("index.html");
      return;
    }
    ov.classList.add("show");
    ov.setAttribute("aria-hidden", "false");
    setTimeout(function () {
      location.replace("index.html");
    }, 2800);
  }

  $("obSkip")?.addEventListener("click", function () {
    if (step === 2 && !state.ageVerified) {
      toast("Please confirm your age (13+) — required");
      return;
    }
    if (step < total) goStep(step + 1);
    else finish();
  });

  async function init() {
    await waitAuth();
    if (!user) {
      // Allow UI preview; redirect after short moment if truly logged out
      console.warn("Onboarding: no auth user");
    }
    if (user && user.email && $("obEmail")) $("obEmail").value = user.email;
    if (user && user.photoURL && $("obAvatarPreview")) {
      $("obAvatarPreview").src = user.photoURL;
    }
    bindPhoto();
    bindVerify();
    bindPerms();
    goStep(1);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
