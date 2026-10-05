/**
 * Viewora multi-account metadata (NO passwords stored)
 * Account switch requires re-authentication via Firebase Auth.
 */
(function () {
  "use strict";

  var LIST_KEY = "viewora_saved_accounts";
  var LAST_EMAIL_KEY = "viewora_last_login_email";

  // One-time purge of any previously stored passwords
  (function purgeLegacyPasswords() {
    try {
      localStorage.removeItem("viewora_acct_creds");
      sessionStorage.removeItem("viewora_last_login_pass");
      sessionStorage.removeItem("viewora_last_login_email");
      // wipe any leftover keys that look like credential maps
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /pass|cred|pwd/i.test(k) && /viewora/i.test(k)) keys.push(k);
      }
      keys.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (_) {}
      });
    } catch (_) {}
  })();

  /**
   * SECURITY: never store passwords.
   * Kept for API compatibility with auth.js — only remembers email + uid.
   */
  function saveCredentials(email, password, uid) {
    // intentionally ignore password
    if (email) {
      try {
        sessionStorage.setItem(LAST_EMAIL_KEY, String(email).trim());
        localStorage.setItem("viewora_last_email", String(email).trim());
      } catch (_) {}
    }
    if (uid) {
      try {
        localStorage.setItem("viewora_last_uid", String(uid));
      } catch (_) {}
    }
  }

  function getCredentialsForAccount(acc) {
    // Passwords are never stored — return null so switch requires re-login
    return null;
  }

  function hasSavedLogin(acc) {
    return false;
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
        d.deactivated === true ||
        d.status === "banned" ||
        d.status === "suspended" ||
        d.status === "disabled"
      ) {
        return {
          ok: false,
          reason: d.banReason || d.suspendReason || d.reason || "Account restricted",
          status: d.status || (d.banned ? "banned" : d.deactivated ? "deactivated" : "suspended")
        };
      }
      return { ok: true };
    } catch (_) {
      return { ok: true };
    }
  }

  async function switchToAccount(acc) {
    // Cannot silent-switch without stored password — force login
    var err = new Error("NO_CREDS");
    err.code = "NO_CREDS";
    err.message = "Please sign in again to switch accounts";
    throw err;
  }

  function patchFirebaseAuth() {
    if (typeof firebase === "undefined" || !firebase.auth) return;
    try {
      var auth = firebase.auth();
      if (auth.__vieworaPatched) return;
      auth.__vieworaPatched = true;

      var origSignIn = auth.signInWithEmailAndPassword.bind(auth);
      auth.signInWithEmailAndPassword = function (email, password) {
        return origSignIn(email, password).then(function (cred) {
          var uid = cred && cred.user && cred.user.uid;
          // only email/uid — never password
          saveCredentials(email, null, uid);
          if (cred && cred.user) {
            upsertAccount({
              uid: cred.user.uid,
              email: cred.user.email || email,
              displayName: cred.user.displayName || "User",
              avatar: cred.user.photoURL || "assets/default-avatar.png"
            });
          }
          return cred;
        });
      };

      auth.onAuthStateChanged(function (user) {
        if (!user) return;
        try {
          localStorage.setItem("viewora_last_uid", user.uid);
        } catch (_) {}
        upsertAccount({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "User",
          avatar: user.photoURL || "assets/default-avatar.png"
        });
        checkAccountStatus(user.uid).then(function (st) {
          if (!st.ok) {
            try {
              sessionStorage.setItem(
                "viewora_appeal",
                JSON.stringify({ uid: user.uid, status: st.status, reason: st.reason })
              );
            } catch (_) {}
          }
        });
      });
    } catch (_) {}
  }

  function getSavedAccounts() {
    try {
      var list = JSON.parse(localStorage.getItem(LIST_KEY) || "[]") || [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function removeAccount(uid) {
    try {
      var list = getSavedAccounts().filter(function (a) {
        return a && a.uid !== uid;
      });
      localStorage.setItem(LIST_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  // boot patch early
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchFirebaseAuth);
  } else {
    patchFirebaseAuth();
  }
  // also try after short delay in case firebase loads late
  setTimeout(patchFirebaseAuth, 500);
  setTimeout(patchFirebaseAuth, 2000);

  window.VieworaAccounts = {
    saveCredentials: saveCredentials,
    getCredentialsForAccount: getCredentialsForAccount,
    hasSavedLogin: hasSavedLogin,
    upsertAccount: upsertAccount,
    switchToAccount: switchToAccount,
    checkAccountStatus: checkAccountStatus,
    getSavedAccounts: getSavedAccounts,
    removeAccount: removeAccount,
    // explicit: passwords are never persisted
    storesPasswords: false
  };
})();
