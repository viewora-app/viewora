(function () {
  "use strict";

  var form = document.getElementById("loginForm");
  var loginId = document.getElementById("loginId");
  var password = document.getElementById("password");
  var togglePassword = document.getElementById("togglePassword");
  var eyeIcon = document.getElementById("eyeIcon");
  var rememberMe = document.getElementById("rememberMe");
  var loginBtn = document.getElementById("loginBtn");
  var loginBtnText = document.getElementById("loginBtnText");
  var loginSpinner = document.getElementById("loginSpinner");
  var errorMsg = document.getElementById("errorMsg");
  var toastEl = document.getElementById("toast");

  var forgotModal = document.getElementById("forgotModal");
  var forgotEmail = document.getElementById("forgotEmail");
  var forgotSend = document.getElementById("forgotSend");
  var forgotError = document.getElementById("forgotError");

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.classList.add("hidden");
    }, 2800);
  }

  function showError(msg) {
    if (!errorMsg) return;
    errorMsg.textContent = msg || "";
    errorMsg.classList.toggle("hidden", !msg);
  }

  function setLoading(on) {
    if (loginBtn) loginBtn.disabled = !!on;
    if (loginBtnText) loginBtnText.textContent = on ? "Signing in…" : "Log in";
    if (loginSpinner) loginSpinner.classList.toggle("hidden", !on);
  }

  // Password eye — reliable toggle
  if (togglePassword && password) {
    togglePassword.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var show = password.type === "password";
      password.type = show ? "text" : "password";
      if (eyeIcon) {
        eyeIcon.className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
      } else {
        togglePassword.innerHTML = show
          ? '<i class="fa-solid fa-eye-slash"></i>'
          : '<i class="fa-solid fa-eye"></i>';
      }
      togglePassword.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  }

  // Remembered id
  try {
    var remembered = localStorage.getItem("viewora_remember_login");
    if (remembered && loginId) loginId.value = remembered;
  } catch (_) {}

  // Already signed in?
  function goHome() {
    var next = "index.html";
    try {
      var p = new URLSearchParams(location.search);
      if (p.get("next") && !/^https?:/i.test(p.get("next"))) next = p.get("next");
    } catch (_) {}
    location.replace(next);
  }

  function waitAuth() {
    return new Promise(function (resolve) {
      try {
        if (!window.firebase || !firebase.auth) return resolve(null);
        var unsub = firebase.auth().onAuthStateChanged(function (u) {
          unsub && unsub();
          resolve(u || null);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  waitAuth().then(function (u) {
    if (u) goHome();
  });

  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  }

  async function resolveEmail(id) {
    id = String(id || "").trim();
    if (!id) throw new Error("Enter email or username");
    if (isEmail(id)) return id.toLowerCase();

    var username = id.replace(/^@/, "").toLowerCase();
    var db = firebase.database();
    // indexOn username preferred
    var snap = await db.ref("users").orderByChild("username").equalTo(username).limitToFirst(1).once("value");
    var val = snap.val();
    if (val) {
      var key = Object.keys(val)[0];
      var email = val[key] && val[key].email;
      if (email) return String(email).toLowerCase();
    }
    // fallback handle field
    snap = await db.ref("users").orderByChild("handle").equalTo(username).limitToFirst(1).once("value");
    val = snap.val();
    if (val) {
      var k2 = Object.keys(val)[0];
      var e2 = val[k2] && val[k2].email;
      if (e2) return String(e2).toLowerCase();
    }
    throw new Error("No account found for that username");
  }

  function mapAuthError(code, message) {
    switch (code) {
      case "auth/user-not-found":
        return "No account with this email. Create an account first.";
      case "auth/invalid-email":
        return "Invalid email format.";
      case "auth/wrong-password":
        return "Wrong password. Try again or reset it.";
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
        return "Email or password is incorrect. Check both, or use Forgot password.";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a minute and try again.";
      case "auth/network-request-failed":
        return "Network error. Check your connection.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/operation-not-allowed":
        return "Email/password sign-in is disabled in Firebase Console.";
      default:
        return (message && String(message).slice(0, 120)) || "Login failed. Please try again.";
    }
  }

  async function saveToSwitcher(user) {
    try {
      if (window.VieworaAccounts && VieworaAccounts.saveAccount) {
        await VieworaAccounts.saveAccount(user, {
          password: rememberMe && rememberMe.checked ? password.value : null
        });
        return;
      }
    } catch (_) {}
    try {
      var db = firebase.database();
      var snap = await db.ref("users/" + user.uid).once("value");
      var p = snap.val() || {};
      var list = [];
      try {
        list = JSON.parse(localStorage.getItem("viewora_saved_accounts") || "[]") || [];
      } catch (_) {}
      if (!Array.isArray(list)) list = [];
      var entry = {
        uid: user.uid,
        email: user.email || p.email || "",
        displayName: p.displayName || p.name || user.displayName || "User",
        username: p.username || "",
        avatar: p.profilePhoto || p.photoURL || p.avatar || user.photoURL || "",
        blueTick: !!(p.blueTick || p.verified),
        redTick: !!(p.redTick || p.vip),
        yellowTick: !!p.yellowTick,
        whiteTick: !!p.whiteTick,
        tickType: p.tickType || "",
        lastLoginAt: Date.now()
      };
      list = list.filter(function (a) {
        return a && a.uid && a.uid !== user.uid;
      });
      list.unshift(entry);
      localStorage.setItem("viewora_saved_accounts", JSON.stringify(list.slice(0, 12)));
      if (rememberMe && rememberMe.checked && user.email) {
        localStorage.setItem("viewora_remember_login", user.email);
      }
    } catch (e) {
      console.warn("save switcher", e);
    }
  }

  form && form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");
    var id = (loginId && loginId.value || "").trim();
    // trim password — trailing spaces often cause "wrong password"
    var pass = String((password && password.value) || "").replace(/^\s+|\s+$/g, "");
    if (password && pass !== password.value) password.value = pass;

    if (!id) {
      showError("Enter email or username");
      loginId && loginId.focus();
      return;
    }
    if (!pass || pass.length < 6) {
      showError("Enter a valid password (min 6 characters)");
      password && password.focus();
      return;
    }
    if (!window.firebase || !firebase.auth) {
      showError("Firebase not loaded. Refresh the page.");
      return;
    }

    setLoading(true);
    try {
      try {
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (_) {}

      var email = await resolveEmail(id);
      email = String(email || "").trim().toLowerCase();

      var cred = await firebase.auth().signInWithEmailAndPassword(email, pass);
      await saveToSwitcher(cred.user);
      try {
        await firebase.database().ref("users/" + cred.user.uid).update({
          lastLoginAt: firebase.database.ServerValue.TIMESTAMP
        });
      } catch (_) {}
      toast("Welcome back");
      setTimeout(goHome, 200);
    } catch (err) {
      console.warn("login error", err && err.code, err);
      var code = (err && err.code) || "";
      var msg = mapAuthError(code, err && err.message);
      // If Firebase says invalid-credential, hint reset
      if (code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
        msg = "Email or password incorrect. Tip: use the exact password from signup, or Forgot password.";
      }
      showError(msg);
      setLoading(false);
    }
  });

  // Forgot password
  function openForgot() {
    if (!forgotModal) return;
    forgotModal.classList.remove("hidden");
    forgotModal.setAttribute("aria-hidden", "false");
    if (forgotEmail && loginId && isEmail(loginId.value)) {
      forgotEmail.value = loginId.value.trim();
    }
    if (forgotError) forgotError.classList.add("hidden");
  }
  function closeForgot() {
    if (!forgotModal) return;
    forgotModal.classList.add("hidden");
    forgotModal.setAttribute("aria-hidden", "true");
  }

  document.getElementById("forgotBtn")?.addEventListener("click", openForgot);
  document.getElementById("forgotClose")?.addEventListener("click", closeForgot);
  document.getElementById("forgotBackdrop")?.addEventListener("click", closeForgot);

  forgotSend && forgotSend.addEventListener("click", async function () {
    var email = (forgotEmail && forgotEmail.value || "").trim().toLowerCase();
    if (!isEmail(email)) {
      if (forgotError) {
        forgotError.textContent = "Enter a valid email";
        forgotError.classList.remove("hidden");
      }
      return;
    }
    forgotSend.disabled = true;
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      toast("Reset link sent — check your email");
      closeForgot();
    } catch (err) {
      if (forgotError) {
        forgotError.textContent = mapAuthError(err && err.code) || "Could not send email";
        forgotError.classList.remove("hidden");
      }
    }
    forgotSend.disabled = false;
  });
})();
