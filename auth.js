/**
 * Viewora Auth — shared account helpers (100% account system)
 */
(function (global) {
  "use strict";

  function auth() {
    try { return firebase.auth(); } catch (_) { return null; }
  }
  function db() {
    try { return firebase.database(); } catch (_) { return null; }
  }

  function ensurePersistence() {
    try {
      if (firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
        return firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      }
    } catch (_) {}
    return Promise.resolve();
  }

  function e164(phone, defaultCc) {
    var p = String(phone || "").replace(/[^\d+]/g, "");
    if (!p) return "";
    if (p.charAt(0) !== "+") {
      if (p.length === 10) p = (defaultCc || "+91") + p;
      else p = "+" + p;
    }
    return p;
  }

  function usernameFromEmail(email) {
    var base = String(email || "user").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    if (!base) base = "user";
    return base + Math.floor(100 + Math.random() * 900);
  }

  async function bootstrapUserProfile(user, extra) {
    if (!user || !db()) return;
    extra = extra || {};
    var ref = db().ref("users/" + user.uid);
    var snap = await ref.once("value");
    var existing = snap.val() || {};
    var uname = existing.username || extra.username || usernameFromEmail(user.email || extra.phone || user.uid);
    var patch = {
      uid: user.uid,
      email: user.email || existing.email || extra.email || null,
      phone: existing.phone || extra.phone || user.phoneNumber || null,
      phoneNumber: existing.phoneNumber || extra.phone || user.phoneNumber || null,
      username: uname,
      userName: uname,
      displayName: existing.displayName || extra.displayName || uname,
      name: existing.name || extra.displayName || uname,
      photoURL: existing.photoURL || user.photoURL || null,
      profilePhoto: existing.profilePhoto || user.photoURL || null,
      avatar: existing.avatar || user.photoURL || null,
      emailVerified: !!(user.emailVerified || existing.emailVerified),
      phoneVerified: !!(user.phoneNumber || existing.phoneVerified),
      updatedAt: Date.now()
    };
    if (!existing.createdAt) patch.createdAt = Date.now();
    if (!existing.username) {
      try {
        await db().ref("usernames/" + uname).set(user.uid);
      } catch (_) {}
    }
    await ref.update(patch);
    return patch;
  }

  async function signUpEmail(email, password, displayName) {
    await ensurePersistence();
    var cred = await auth().createUserWithEmailAndPassword(email, password);
    var user = cred.user;
    if (displayName) {
      try { await user.updateProfile({ displayName: displayName }); } catch (_) {}
    }
    try { await user.sendEmailVerification(); } catch (_) {}
    await bootstrapUserProfile(user, { displayName: displayName || "", email: email });
    try {
      if (window.VieworaAccounts && VieworaAccounts.saveCredentials) {
        VieworaAccounts.saveCredentials(email, password, user.uid);
      }
    } catch (_) {}
    return user;
  }

  async function signInEmail(email, password) {
    await ensurePersistence();
    var cred = await auth().signInWithEmailAndPassword(email, password);
    await bootstrapUserProfile(cred.user, { email: email });
    try {
      if (window.VieworaAccounts && VieworaAccounts.saveCredentials) {
        VieworaAccounts.saveCredentials(email, password, cred.user.uid);
      }
    } catch (_) {}
    return cred.user;
  }

  async function sendPasswordReset(email) {
    return auth().sendPasswordResetEmail(email);
  }

  async function resendEmailVerification() {
    var u = auth().currentUser;
    if (!u) throw new Error("Not logged in");
    await u.sendEmailVerification();
  }

  async function changePassword(currentPassword, newPassword) {
    var u = auth().currentUser;
    if (!u || !u.email) throw new Error("Email login required");
    var cred = firebase.auth.EmailAuthProvider.credential(u.email, currentPassword);
    await u.reauthenticateWithCredential(cred);
    await u.updatePassword(newPassword);
    try {
      if (window.VieworaAccounts && VieworaAccounts.saveCredentials) {
        VieworaAccounts.saveCredentials(u.email, newPassword, u.uid);
      }
    } catch (_) {}
  }

  var _recaptcha = null;
  var _confirmResult = null;
  var _verificationId = null;

  function ensureRecaptcha(containerId) {
    return new Promise(function (resolve, reject) {
      try {
        if (_recaptcha) return resolve(_recaptcha);
        var el = document.getElementById(containerId || "recaptchaContainer");
        if (!el) {
          el = document.createElement("div");
          el.id = containerId || "recaptchaContainer";
          el.style.cssText = "position:fixed;left:-9999px;bottom:0;width:1px;height:1px;opacity:0;";
          document.body.appendChild(el);
        }
        _recaptcha = new firebase.auth.RecaptchaVerifier(el.id, {
          size: "invisible",
          callback: function () {},
          "expired-callback": function () { _recaptcha = null; }
        });
        _recaptcha.render().then(function () { resolve(_recaptcha); }).catch(reject);
      } catch (e) { reject(e); }
    });
  }

  async function sendPhoneOtp(phoneRaw, mode) {
    // mode: login | link | signup
    var phone = e164(phoneRaw);
    if (!phone || phone.length < 10) throw new Error("Invalid phone number");
    var verifier = await ensureRecaptcha();
    var a = auth();
    var u = a.currentUser;
    if (mode === "link" && u) {
      _confirmResult = await u.linkWithPhoneNumber(phone, verifier);
      _verificationId = _confirmResult.verificationId || null;
      return { phone: phone, method: "link" };
    }
    // sign-in / signup via phone
    _confirmResult = await a.signInWithPhoneNumber(phone, verifier);
    _verificationId = _confirmResult.verificationId || null;
    return { phone: phone, method: "signIn" };
  }

  async function confirmPhoneOtp(code, extra) {
    if (!_confirmResult) throw new Error("Send OTP first");
    var result = await _confirmResult.confirm(code);
    var user = result.user;
    await bootstrapUserProfile(user, Object.assign({ phone: user.phoneNumber }, extra || {}));
    if (db()) {
      try {
        await db().ref("users/" + user.uid).update({
          phone: user.phoneNumber,
          phoneNumber: user.phoneNumber,
          phoneVerified: true
        });
      } catch (_) {}
    }
    return user;
  }

  async function linkEmailPassword(email, password) {
    var u = auth().currentUser;
    if (!u) throw new Error("Not logged in");
    var cred = firebase.auth.EmailAuthProvider.credential(email, password);
    await u.linkWithCredential(cred);
    try { await u.sendEmailVerification(); } catch (_) {}
    await bootstrapUserProfile(u, { email: email });
    try {
      if (window.VieworaAccounts && VieworaAccounts.saveCredentials) {
        VieworaAccounts.saveCredentials(email, password, u.uid);
      }
    } catch (_) {}
    return u;
  }

  function requireAuth(redirect) {
    return new Promise(function (resolve) {
      var a = auth();
      if (!a) return resolve(null);
      var unsub = a.onAuthStateChanged(function (u) {
        unsub();
        if (!u && redirect !== false) {
          try {
            sessionStorage.setItem("viewora_return_to", location.pathname.split("/").pop() + location.search);
          } catch (_) {}
          location.href = "login.html";
        }
        resolve(u);
      });
    });
  }

  function goAfterAuth() {
    var target = "index.html";
    try {
      var ret = sessionStorage.getItem("viewora_return_to");
      if (ret && /\.html/i.test(ret) && ret.indexOf("login") === -1 && ret.indexOf("signup") === -1) {
        sessionStorage.removeItem("viewora_return_to");
        target = ret;
      }
    } catch (_) {}
    location.replace(target);
  }

  global.VieworaAuth = {
    ensurePersistence: ensurePersistence,
    bootstrapUserProfile: bootstrapUserProfile,
    signUpEmail: signUpEmail,
    signInEmail: signInEmail,
    sendPasswordReset: sendPasswordReset,
    resendEmailVerification: resendEmailVerification,
    changePassword: changePassword,
    sendPhoneOtp: sendPhoneOtp,
    confirmPhoneOtp: confirmPhoneOtp,
    linkEmailPassword: linkEmailPassword,
    e164: e164,
    requireAuth: requireAuth,
    goAfterAuth: goAfterAuth
  };
})(window);
