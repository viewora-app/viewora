/**
 * Viewora multi-account — save login once, switch without login page
 */
(function () {
  "use strict";

  var CREDS_KEY = "viewora_acct_creds";
  var LIST_KEY = "viewora_saved_accounts";
  var LAST_PASS_KEY = "viewora_last_login_pass";
  var LAST_EMAIL_KEY = "viewora_last_login_email";

  function readCreds() {
    try {
      return JSON.parse(localStorage.getItem(CREDS_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function writeCreds(map) {
    try {
      localStorage.setItem(CREDS_KEY, JSON.stringify(map || {}));
    } catch (_) {}
  }

  function saveCredentials(email, password, uid) {
    if (!email || !password) return;
    var map = readCreds();
    var key = String(email).trim().toLowerCase();
    var entry = {
      email: String(email).trim(),
      password: String(password),
      uid: uid || (map[key] && map[key].uid) || "",
      updatedAt: Date.now()
    };
    map[key] = entry;
    if (entry.uid) map["uid:" + entry.uid] = entry;
    writeCreds(map);
    try {
      sessionStorage.setItem(LAST_EMAIL_KEY, entry.email);
      sessionStorage.setItem(LAST_PASS_KEY, entry.password);
    } catch (_) {}
  }

  function getCredentialsForAccount(acc) {
    if (!acc) return null;
    var map = readCreds();
    if (acc.uid && map["uid:" + acc.uid]) return map["uid:" + acc.uid];
    if (acc.email) {
      var k = String(acc.email).trim().toLowerCase();
      if (map[k]) return map[k];
    }
    return null;
  }

  function hasSavedLogin(acc) {
    var c = getCredentialsForAccount(acc);
    return !!(c && c.email && c.password);
  }

  function upsertAccount(acc) {
    if (!acc || !acc.uid) return;
    try {
      var list = [];
      try {
        list = JSON.parse(localStorage.getItem(LIST_KEY) || "[]") || [];
      } catch (_) {}
      if (!Array.isArray(list)) list = [];
      var prev = list.find(function (a) {
        return a && a.uid === acc.uid;
      });
      list = list.filter(function (a) {
        return a && a.uid !== acc.uid;
      });
      list.unshift({
        uid: acc.uid,
        username: acc.username || (prev && prev.username) || "user",
        displayName: acc.displayName || (prev && prev.displayName) || "User",
        avatar: acc.avatar || (prev && prev.avatar) || "assets/default-avatar.png",
        email: acc.email || (prev && prev.email) || ""
      });
      localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, 8)));
      localStorage.setItem("viewora_last_uid", acc.uid);
    } catch (_) {}
  }

  async function checkAccountStatus(uid) {
    try {
      var db =
        window.db ||
        window.firebaseDB ||
        (typeof firebase !== "undefined" && firebase.database && firebase.database());
      if (!db || !uid) return { ok: true };
      var snap = await db.ref("users/" + uid).once("value");
      var d = snap.val() || {};
      if (
        d.banned === true ||
        d.suspended === true ||
        d.disabled === true ||
        d.status === "banned" ||
        d.status === "suspended" ||
        d.status === "disabled"
      ) {
        return {
          ok: false,
          reason: d.banReason || d.suspendReason || d.reason || "Account restricted",
          status: d.status || (d.banned ? "banned" : "suspended")
        };
      }
      return { ok: true };
    } catch (_) {
      return { ok: true };
    }
  }

  async function switchToAccount(acc) {
    if (!acc) throw new Error("No account");
    var creds = getCredentialsForAccount(acc);
    if (!creds || !creds.email || !creds.password) {
      var err = new Error("NO_CREDS");
      err.code = "NO_CREDS";
      throw err;
    }
    if (typeof firebase === "undefined" || !firebase.auth) {
      throw new Error("Auth unavailable");
    }
    var auth = firebase.auth();
    await auth.signInWithEmailAndPassword(creds.email, creds.password);
    var u = auth.currentUser;
    if (!u) throw new Error("Sign-in failed");
    try {
      localStorage.setItem("viewora_last_uid", u.uid);
    } catch (_) {}
    saveCredentials(creds.email, creds.password, u.uid);
    upsertAccount({
      uid: u.uid,
      email: u.email || creds.email,
      username: acc.username,
      displayName: acc.displayName,
      avatar: acc.avatar
    });
    var st = await checkAccountStatus(u.uid);
    if (!st.ok) {
      try {
        sessionStorage.setItem(
          "viewora_appeal",
          JSON.stringify({ uid: u.uid, status: st.status, reason: st.reason })
        );
      } catch (_) {}
      var banErr = new Error("ACCOUNT_RESTRICTED");
      banErr.code = "ACCOUNT_RESTRICTED";
      throw banErr;
    }
    return u;
  }

  function patchFirebaseAuth() {
    if (typeof firebase === "undefined" || !firebase.auth) return;
    try {
      var auth = firebase.auth();
      if (auth.__vieworaPatched) return;
      auth.__vieworaPatched = true;
      var orig = auth.signInWithEmailAndPassword.bind(auth);
      auth.signInWithEmailAndPassword = function (email, password) {
        return orig(email, password).then(function (cred) {
          try {
            var uid = cred && cred.user && cred.user.uid;
            saveCredentials(email, password, uid);
            if (cred && cred.user) {
              upsertAccount({
                uid: cred.user.uid,
                email: email,
                username:
                  (cred.user.displayName || email.split("@")[0] || "user"),
                displayName: cred.user.displayName || "User",
                avatar: cred.user.photoURL || "assets/default-avatar.png"
              });
            }
          } catch (_) {}
          return cred;
        });
      };
    } catch (_) {}
  }

  function hookLoginForms() {
    document.addEventListener(
      "submit",
      function (e) {
        try {
          var form = e.target;
          if (!form || !form.querySelector) return;
          var emailEl =
            form.querySelector('input[type="email"]') ||
            form.querySelector('input[name="email"]') ||
            form.querySelector("#email") ||
            form.querySelector("#loginEmail");
          var passEl =
            form.querySelector('input[type="password"]') ||
            form.querySelector('input[name="password"]') ||
            form.querySelector("#password") ||
            form.querySelector("#loginPassword");
          if (!emailEl || !passEl) return;
          var email = (emailEl.value || "").trim();
          var password = passEl.value || "";
          if (!email || !password) return;
          saveCredentials(email, password, "");
        } catch (_) {}
      },
      true
    );

    // Capture password on input blur (in case login uses button click not form submit)
    document.addEventListener(
      "click",
      function (e) {
        try {
          var t = e.target;
          if (!t) return;
          var btn = t.closest && t.closest("button, [type=submit]");
          if (!btn) return;
          var text = ((btn.textContent || "") + (btn.value || "")).toLowerCase();
          if (
            text.indexOf("log in") === -1 &&
            text.indexOf("login") === -1 &&
            text.indexOf("sign in") === -1 &&
            text.indexOf("signin") === -1 &&
            !btn.classList.contains("loginBtn")
          ) {
            return;
          }
          var root = document;
          var emailEl =
            root.querySelector('input[type="email"]') ||
            root.querySelector("#email") ||
            root.querySelector("#loginEmail");
          var passEl =
            root.querySelector('input[type="password"]') ||
            root.querySelector("#password") ||
            root.querySelector("#loginPassword");
          if (emailEl && passEl && emailEl.value && passEl.value) {
            saveCredentials(emailEl.value.trim(), passEl.value, "");
          }
        } catch (_) {}
      },
      true
    );
  }

  function watchAuth() {
    function attach() {
      if (typeof firebase === "undefined" || !firebase.auth) return false;
      patchFirebaseAuth();
      try {
        firebase.auth().onAuthStateChanged(async function (user) {
          if (!user) return;
          try {
            localStorage.setItem("viewora_last_uid", user.uid);
          } catch (_) {}
          // Block accounts that were permanently deleted
          try {
            var dbx = firebase.database && firebase.database();
            if (dbx) {
              var tomb = await dbx.ref("deletedUsers/" + user.uid).once("value");
              if (tomb.exists() && tomb.val() && tomb.val().permanent) {
                try { await firebase.auth().signOut(); } catch (_) {}
                try { sessionStorage.setItem("viewora_deleted_block", "1"); } catch (_) {}
                location.href = "login.html?deleted=1";
                return;
              }
            }
          } catch (_) {}
          var map = readCreds();
          var email = (user.email || "").toLowerCase();
          if (email && map[email]) {
            map[email].uid = user.uid;
            map["uid:" + user.uid] = map[email];
            writeCreds(map);
          }
          // link last typed password if any
          try {
            var le = sessionStorage.getItem(LAST_EMAIL_KEY) || "";
            var lp = sessionStorage.getItem(LAST_PASS_KEY) || "";
            if (le && lp && user.email && le.toLowerCase() === user.email.toLowerCase()) {
              saveCredentials(user.email, lp, user.uid);
            }
          } catch (_) {}
          var cachedAv = "";
          try { cachedAv = localStorage.getItem("viewora_my_avatar") || ""; } catch (_) {}
          upsertAccount({
            uid: user.uid,
            email: user.email || "",
            username: user.displayName || (user.email || "").split("@")[0] || "user",
            displayName: user.displayName || "User",
            avatar: user.photoURL || cachedAv || "assets/default-avatar.png"
          });
          // enrich from users node
          try {
            var db = firebase.database && firebase.database();
            if (db) {
              db.ref("users/" + user.uid)
                .once("value")
                .then(function (snap) {
                  var d = snap.val() || {};
                  var photo =
                    d.profilePhoto ||
                    d.photoURL ||
                    d.avatar ||
                    d.profilePicture ||
                    user.photoURL ||
                    "";
                  if (photo) {
                    try { localStorage.setItem("viewora_my_avatar", photo); } catch (_) {}
                  } else {
                    try { photo = localStorage.getItem("viewora_my_avatar") || ""; } catch (_) {}
                  }
                  upsertAccount({
                    uid: user.uid,
                    email: user.email || d.email || "",
                    username: d.username || d.userName || user.displayName || "user",
                    displayName: d.displayName || d.name || user.displayName || "User",
                    avatar: photo || "assets/default-avatar.png"
                  });
                  // Heal empty profile photo in DB if we have cache
                  if (photo && !d.profilePhoto && !d.photoURL && !d.avatar) {
                    try {
                      db.ref("users/" + user.uid).update({
                        profilePhoto: photo,
                        photoURL: photo,
                        avatar: photo
                      });
                    } catch (_) {}
                  }
                });
            }
          } catch (_) {}
        });
      } catch (_) {}
      return true;
    }
    if (!attach()) {
      var n = 0;
      var t = setInterval(function () {
        n++;
        if (attach() || n > 40) clearInterval(t);
      }, 250);
    }
  }

  window.VieworaAccounts = {
    saveCredentials: saveCredentials,
    getCredentialsForAccount: getCredentialsForAccount,
    hasSavedLogin: hasSavedLogin,
    switchToAccount: switchToAccount,
    checkAccountStatus: checkAccountStatus,
    upsertAccount: upsertAccount
  };

  hookLoginForms();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchAuth);
  } else {
    watchAuth();
  }
})();
