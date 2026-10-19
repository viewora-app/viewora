(function () {
  "use strict";

  var state = {
    mode: "email", // email | phone
    email: "",
    phone: "",
    e164: "",
    password: "",
    dob: "",
    name: "",
    username: "",
    avatarFile: null,
    avatarUrl: "",
    followed: {},
    interests: {},
    confirmationResult: null,
    uid: null
  };


  // Routing: ?from=login skips welcome → contact
  // First-time (no saved accounts) stays on welcome
  try {
    var params = new URLSearchParams(location.search);
    var fromLogin = params.get("from") === "login" || params.get("step") === "contact";
    var hasAccounts = false;
    try {
      var acc = JSON.parse(localStorage.getItem("viewora_saved_accounts") || "[]");
      hasAccounts = Array.isArray(acc) && acc.length > 0;
    } catch (_) {}
    if (fromLogin) {
      // adding another account / came from login signup link
      setTimeout(function () { go("contact", false); stack = ["welcome", "contact"]; }, 0);
    }
  } catch (_) {}

  var stack = ["welcome"];
  var INTERESTS = [
    "Music", "Comedy", "Sports", "Fashion", "Food", "Travel",
    "Gaming", "Tech", "Dance", "News", "Education", "Animals"
  ];

  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._x);
    t._x = setTimeout(function () { t.classList.add("hidden"); }, 2600);
  }

  function go(step, push) {
    document.querySelectorAll(".step").forEach(function (s) {
      s.classList.toggle("active", s.getAttribute("data-step") === step);
    });
    if (push !== false) {
      if (stack[stack.length - 1] !== step) stack.push(step);
    }
    if (step === "follow") loadPeople();
    if (step === "interests") paintInterests();
    if (step === "hello") {
      var u = state.username || state.name || "";
      $("helloTitle").textContent = u ? ("Let's get started, " + u + "!") : "Let's get started!";
    }
    if (step === "photo") {
      $("suPhotoUname").textContent = state.username ? "@" + state.username : "";
      $("suPhotoName").textContent = state.name || "";
    }
  }

  function back() {
    if (stack.length > 1) stack.pop();
    go(stack[stack.length - 1] || "welcome", false);
  }

  document.querySelectorAll("[data-go]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var s = btn.getAttribute("data-go");
      if (s === "email") state.mode = "email";
      if (s === "phone") state.mode = "phone";
      go(s);
    });
  });
  document.querySelectorAll("[data-back]").forEach(function (b) {
    b.addEventListener("click", back);
  });
  document.querySelectorAll("[data-href]").forEach(function (b) {
    b.addEventListener("click", function () {
      location.href = b.getAttribute("data-href");
    });
  });

  // Email next
  $("emailNext").onclick = function () {
    var v = ($("suEmail").value || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast("Enter a valid email");
      return;
    }
    state.email = v;
    state.mode = "email";
    go("password");
  };

  // Phone next — real Firebase Phone Auth
  $("phoneNext").onclick = async function () {
    var raw = ($("suPhone").value || "").replace(/\D/g, "");
    var cc = $("suCountry").value || "+91";
    if (raw.length < 8) {
      toast("Enter a valid mobile number");
      return;
    }
    state.e164 = cc + raw;
    state.phone = raw;
    state.mode = "phone";
    $("otpHint").textContent = "Enter the 6-digit code we sent to " + state.e164;
    $("phoneNext").disabled = true;
    try {
      if (!window.firebase || !firebase.auth) throw new Error("Firebase missing");
      // clear old
      if (window.__vieworaRecaptcha) {
        try { window.__vieworaRecaptcha.clear(); } catch (_) {}
      }
      window.__vieworaRecaptcha = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
        size: "invisible"
      });
      state.confirmationResult = await firebase.auth().signInWithPhoneNumber(state.e164, window.__vieworaRecaptcha);
      toast("Code sent");
      go("otp");
    } catch (e) {
      console.warn(e);
      var msg = (e && e.message) || "Could not send code";
      if (/billing|Blaze|invalid-app|too-many|quota/i.test(msg)) {
        msg = "Phone signup needs Firebase Phone Auth enabled. Use email for now.";
      }
      toast(msg);
    }
    $("phoneNext").disabled = false;
  };

  // OTP boxes
  (function bindOtp() {
    var boxes = document.querySelectorAll(".otp");
    boxes.forEach(function (box, i) {
      box.addEventListener("input", function () {
        var v = box.value.replace(/\D/g, "").slice(-1);
        box.value = v;
        if (v && boxes[i + 1]) boxes[i + 1].focus();
      });
      box.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !box.value && boxes[i - 1]) boxes[i - 1].focus();
      });
    });
  })();

  $("otpNext").onclick = async function () {
    var code = Array.prototype.map.call(document.querySelectorAll(".otp"), function (b) {
      return b.value;
    }).join("");
    if (code.length !== 6) {
      toast("Enter the 6-digit code");
      return;
    }
    if (!state.confirmationResult) {
      toast("Request a new code");
      return;
    }
    $("otpNext").disabled = true;
    try {
      var cred = await state.confirmationResult.confirm(code);
      state.uid = cred.user.uid;
      // phone users still set password optional — skip to birthday, link email later
      go("birthday");
    } catch (e) {
      toast("Invalid code");
    }
    $("otpNext").disabled = false;
  };

  $("otpResend").onclick = function () {
    go("phone");
  };

  // Password
  $("suEye").onclick = function () {
    var p = $("suPass");
    var show = p.type === "password";
    p.type = show ? "text" : "password";
    $("suEye").innerHTML = show ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
  };
  $("passNext").onclick = function () {
    var p = $("suPass").value || "";
    if (p.length < 6) {
      toast("Password must be at least 6 characters");
      return;
    }
    state.password = p;
    go("birthday");
  };

  // DOB
  function ageFrom(val) {
    var d = new Date(val + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    var t = new Date();
    var a = t.getFullYear() - d.getFullYear();
    var m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
    return a;
  }
  $("suDob").addEventListener("change", function () {
    var a = ageFrom($("suDob").value);
    $("dobAgeHint").textContent = a == null ? "" : ("Age: " + a + " years");
  });
  $("dobNext").onclick = function () {
    var v = $("suDob").value;
    var a = ageFrom(v);
    if (a == null) {
      toast("Enter your date of birth");
      return;
    }
    if (a < 13) {
      toast("You must be at least 13 years old to use Viewora");
      return;
    }
    state.dob = v;
    go("name");
  };

  // Name
  $("nameNext").onclick = function () {
    var n = ($("suName").value || "").trim();
    if (n.length < 2) {
      toast("Enter your name");
      return;
    }
    state.name = n;
    // suggest username
    var base = n.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "user";
    $("suUser").value = base + Math.floor(Math.random() * 90 + 10);
    checkUsername();
    go("username");
  };

  // Username availability
  var userTimer = null;
  async function checkUsername() {
    var u = ($("suUser").value || "").trim().toLowerCase().replace(/^@/, "");
    $("suUser").value = u;
    var err = $("suUserErr");
    var av = $("suAvail");
    if (!/^[a-z0-9._]{3,30}$/.test(u)) {
      err.textContent = "3–30 chars: letters, numbers, . or _";
      av.textContent = "";
      av.className = "avail";
      return false;
    }
    err.textContent = "";
    av.textContent = "…";
    av.className = "avail";
    try {
      var snap = await firebase.database().ref("users").orderByChild("username").equalTo(u).limitToFirst(1).once("value");
      if (snap.exists()) {
        av.textContent = "Taken";
        av.className = "avail bad";
        err.textContent = "Username is not available";
        return false;
      }
      // also usernames index
      try {
        var us = await firebase.database().ref("usernames/" + u).once("value");
        if (us.exists()) {
          av.textContent = "Taken";
          av.className = "avail bad";
          err.textContent = "Username is not available";
          return false;
        }
      } catch (_) {}
      av.textContent = "Available";
      av.className = "avail ok";
      return true;
    } catch (e) {
      // if index missing, allow continue
      av.textContent = "OK";
      av.className = "avail ok";
      return true;
    }
  }
  $("suUser").addEventListener("input", function () {
    clearTimeout(userTimer);
    userTimer = setTimeout(checkUsername, 350);
  });
  $("userNext").onclick = async function () {
    var ok = await checkUsername();
    if (!ok) return;
    state.username = ($("suUser").value || "").trim().toLowerCase();
    go("terms");
  };

  // Create account
  $("agreeBtn").onclick = async function () {
    go("creating");
    $("createErr").textContent = "";
    try {
      var auth = firebase.auth();
      var db = firebase.database();
      var user = auth.currentUser;

      if (state.mode === "email") {
        var cred = await auth.createUserWithEmailAndPassword(state.email, state.password);
        user = cred.user;
        try {
          await user.sendEmailVerification();
        } catch (_) {}
      } else if (!user) {
        throw new Error("Phone verification missing — go back and confirm the code");
      }

      state.uid = user.uid;
      var age = ageFrom(state.dob);
      var profile = {
        uid: user.uid,
        email: state.email || user.email || "",
        phone: state.e164 || "",
        displayName: state.name,
        name: state.name,
        username: state.username,
        handle: state.username,
        birthDate: state.dob,
        dateOfBirth: state.dob,
        ageYears: age,
        ageVerified: true,
        ageVerifiedAt: Date.now(),
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        onboardingComplete: false,
        privacy: "public",
        followers: 0,
        following: 0
      };
      await db.ref("users/" + user.uid).update(profile);
      try {
        await db.ref("usernames/" + state.username).set(user.uid);
      } catch (_) {}
      try {
        if (window.VieworaCompliance && VieworaCompliance.saveAgeGate) {
          await VieworaCompliance.saveAgeGate(user.uid, state.dob);
        }
      } catch (_) {}

      // remember
      try {
        if ($("suRemember") && $("suRemember").checked && state.email) {
          localStorage.setItem("viewora_remember_login", state.email);
        }
        var list = JSON.parse(localStorage.getItem("viewora_saved_accounts") || "[]") || [];
        list = list.filter(function (a) { return a && a.uid !== user.uid; });
        list.unshift({
          uid: user.uid,
          email: profile.email,
          displayName: state.name,
          username: state.username,
          avatar: "",
          lastLoginAt: Date.now()
        });
        localStorage.setItem("viewora_saved_accounts", JSON.stringify(list.slice(0, 12)));
      } catch (_) {}

      go("hello");
    } catch (e) {
      console.warn(e);
      var msg = (e && e.message) || "Could not create account";
      if (e && e.code === "auth/email-already-in-use") msg = "Email already registered — log in instead";
      if (e && e.code === "auth/weak-password") msg = "Password is too weak";
      go("terms", false);
      $("createErr").textContent = msg;
      toast(msg);
    }
  };

  // Permissions
  $("permsNext").onclick = async function () {
    try {
      if (typeof window.Notification !== "undefined") {
        await window.Notification.requestPermission();
      }
    } catch (_) {}
    go("photo");
  };

  state.bannerFile = null;
  state.bannerUrl = "";
  state.bio = "";

  function previewFile(inputId, imgId, phId, key) {
    var el = $(inputId);
    if (!el) return;
    el.addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (!f) return;
      state[key] = f;
      var url = URL.createObjectURL(f);
      var img = $(imgId);
      if (img) {
        img.src = url;
        img.classList.remove("hidden");
      }
      var ph = $(phId);
      if (ph) ph.classList.add("hidden");
    });
  }
  previewFile("suAvatarFile", "suAvatarPreview", "suAvatarPh", "avatarFile");
  previewFile("suBannerFile", "suBannerPreview", "suBannerPh", "bannerFile");

  if ($("photoDone")) {
    $("photoDone").onclick = function () {
      state.bio = (($("suBio") && $("suBio").value) || "").trim().slice(0, 150);
      go("follow");
    };
  }


  // People
  async function loadPeople() {
    var box = $("suPeople");
    if (!box) return;
    box.innerHTML = '<div class="loading">Loading…</div>';
    var people = [];
    try {
      var snap = await firebase.database().ref("users").limitToFirst(40).once("value");
      var me = firebase.auth().currentUser;
      snap.forEach(function (ch) {
        if (me && ch.key === me.uid) return;
        var v = ch.val() || {};
        if (v.deleted || v.banned) return;
        people.push({
          uid: ch.key,
          name: v.displayName || v.name || v.username || "User",
          username: (v.username || "user").replace(/^@/, ""),
          photo: v.profilePhoto || v.photoURL || v.avatar || "",
          raw: v
        });
      });
    } catch (_) {}
    function tick(u) {
      try {
        if (window.VieworaBadges) {
          var b = VieworaBadges.resolveBadge(u.raw || u);
          if (b && b.html) return b.html;
        }
      } catch (_) {}
      return "";
    }
    function paint(list) {
      if (!list.length) {
        box.innerHTML = '<div class="loading">No people found</div>';
        return;
      }
      box.innerHTML = list
        .map(function (p) {
          var on = !!state.followed[p.uid];
          var img =
            p.photo ||
            "https://ui-avatars.com/api/?name=" + encodeURIComponent(p.name) + "&background=333&color=fff&size=96";
          return (
            '<div class="person" data-uid="' +
            p.uid +
            '"><img src="' +
            img +
            '" alt=""><div class="meta"><strong>' +
            p.name.replace(/</g, "") +
            " " +
            tick(p) +
            "</strong><span>@" +
            p.username +
            '</span></div><button type="button" class="followBtn' +
            (on ? " on" : "") +
            '" data-uid="' +
            p.uid +
            '">' +
            (on ? "Following" : "Follow") +
            "</button></div>"
          );
        })
        .join("");
      box.querySelectorAll(".followBtn").forEach(function (btn) {
        btn.onclick = async function () {
          var uid = btn.getAttribute("data-uid");
          var me = firebase.auth().currentUser;
          if (!me) return;
          var on = !state.followed[uid];
          try {
            var up = {};
            up["following/" + me.uid + "/" + uid] = on ? true : null;
            up["followers/" + uid + "/" + me.uid] = on ? true : null;
            await firebase.database().ref().update(up);
            state.followed[uid] = on;
            btn.classList.toggle("on", on);
            btn.textContent = on ? "Following" : "Follow";
          } catch (e) {
            toast("Follow failed");
          }
        };
      });
    }
    paint(people);
    var all = people;
    $("suSearch").oninput = function () {
      var q = (this.value || "").toLowerCase().trim();
      paint(
        !q
          ? all
          : all.filter(function (p) {
              return (p.name + " " + p.username).toLowerCase().indexOf(q) !== -1;
            })
      );
    };
  }

  function paintInterests() {
    var g = $("interestGrid");
    g.innerHTML = INTERESTS.map(function (label) {
      var on = !!state.interests[label];
      return (
        '<div class="interest' +
        (on ? " on" : "") +
        '" data-i="' +
        label +
        '"><i class="fa-solid fa-circle-check chk"></i><label>' +
        label +
        "</label></div>"
      );
    }).join("");
    g.querySelectorAll(".interest").forEach(function (el) {
      el.onclick = function () {
        var k = el.getAttribute("data-i");
        state.interests[k] = !state.interests[k];
        el.classList.toggle("on", !!state.interests[k]);
      };
    });
  }

  async function finish() {
    var user = firebase.auth().currentUser;
    if (user) {
      try {
        var patch = {
          onboardingComplete: true,
          onboardingAt: Date.now(),
          interests: Object.keys(state.interests).filter(function (k) {
            return state.interests[k];
          })
        };
        if (state.bio) patch.bio = state.bio;
        if (state.avatarUrl) {
          patch.profilePhoto = state.avatarUrl;
          patch.avatar = state.avatarUrl;
        }
        if (state.bannerUrl) {
          patch.banner = state.bannerUrl;
          patch.coverPhoto = state.bannerUrl;
        }
        await firebase.database().ref("users/" + user.uid).update(patch);
      } catch (_) {}
      // try cloudinary if global config exists
      try {
        if (state.avatarFile && window.CLOUDINARY_CLOUD) {
          /* optional */
        }
      } catch (_) {}
    }
    try {
      localStorage.setItem("viewora_onboarding_done", "1");
    } catch (_) {}
    location.replace("index.html");
  }

  $("finishBtn").onclick = finish;
  $("finishSkip").onclick = finish;

  // If already logged in with completed onboarding → home
  try {
    firebase.auth().onAuthStateChanged(function (u) {
      if (!u) return;
      firebase
        .database()
        .ref("users/" + u.uid + "/onboardingComplete")
        .once("value")
        .then(function (s) {
          if (s.val() === true) location.replace("index.html");
        });
    });
  } catch (_) {}
})();
