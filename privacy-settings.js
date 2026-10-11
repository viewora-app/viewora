// =====================================
// Viewora Privacy Settings JS — Phase 4
// Saves privacy object AND top-level flags
// (profile.js reads privateAccount / isPrivate)
// =====================================

let currentUser = null;

const defaultPrivacy = {
  privateAccount: false,
  profileVisibility: "everyone",
  onlineStatus: true,
  readReceipts: true,
  lastSeen: "everyone",
  locationSharing: false,
  storyPrivacy: "everyone",
  messagePrivacy: "everyone",
  commentPrivacy: "everyone"
};

function $(id) {
  return document.getElementById(id);
}

function showToast(msg) {
  try {
    var el = $("toast") || $("privacyToast");
    if (el) {
      el.textContent = msg;
      el.classList.add("show");
      clearTimeout(showToast._t);
      showToast._t = setTimeout(function () {
        el.classList.remove("show");
      }, 2200);
      return;
    }
  } catch (_) {}
  console.log("[privacy]", msg);
}

firebase.auth().onAuthStateChanged(function (user) {
  if (user) {
    currentUser = user;
    loadProfile(user);
    loadPrivacySettings(user.uid);
  } else {
    window.location.href = "login.html?next=privacy-settings.html";
  }
});

function loadProfile(user) {
  try {
    if (user.photoURL && $("profilePhoto")) {
      $("profilePhoto").src = user.photoURL;
    }
    if ($("profileName")) {
      $("profileName").innerText = user.displayName || "Viewora User";
    }
    if ($("profileUsername")) {
      $("profileUsername").innerText =
        "@" + (user.email ? user.email.split("@")[0] : "username");
    }
  } catch (_) {}
}

function loadPrivacySettings(uid) {
  var db = firebase.database();
  Promise.all([
    db.ref("users/" + uid + "/privacy").once("value"),
    db.ref("users/" + uid).once("value")
  ])
    .then(function (results) {
      var privacy = results[0].val() || {};
      var user = results[1].val() || {};
      var data = Object.assign({}, defaultPrivacy, privacy);
      // Prefer explicit top-level flags used by profile feed lock
      if (typeof user.privateAccount === "boolean") {
        data.privateAccount = user.privateAccount;
      } else if (typeof user.isPrivate === "boolean") {
        data.privateAccount = user.isPrivate;
      }
      applySettings(data);
    })
    .catch(function (err) {
      console.warn("[privacy] load", err);
      applySettings(defaultPrivacy);
    });
}

function applySettings(data) {
  try {
    if ($("privateAccount")) $("privateAccount").checked = !!data.privateAccount;
    if ($("onlineStatus")) $("onlineStatus").checked = !!data.onlineStatus;
    if ($("readReceipts")) $("readReceipts").checked = !!data.readReceipts;
    if ($("locationSharing")) $("locationSharing").checked = !!data.locationSharing;
    if ($("profileVisibility")) $("profileVisibility").value = data.profileVisibility || "everyone";
    if ($("lastSeen")) $("lastSeen").value = data.lastSeen || "everyone";
    if ($("storyPrivacy")) $("storyPrivacy").value = data.storyPrivacy || "everyone";
    if ($("messagePrivacy")) $("messagePrivacy").value = data.messagePrivacy || "everyone";
    if ($("commentPrivacy")) $("commentPrivacy").value = data.commentPrivacy || "everyone";
  } catch (e) {
    console.warn("[privacy] apply", e);
  }
}

function collectPrivacy() {
  return {
    privateAccount: $("privateAccount") ? $("privateAccount").checked : false,
    profileVisibility: $("profileVisibility") ? $("profileVisibility").value : "everyone",
    onlineStatus: $("onlineStatus") ? $("onlineStatus").checked : true,
    readReceipts: $("readReceipts") ? $("readReceipts").checked : true,
    lastSeen: $("lastSeen") ? $("lastSeen").value : "everyone",
    locationSharing: $("locationSharing") ? $("locationSharing").checked : false,
    storyPrivacy: $("storyPrivacy") ? $("storyPrivacy").value : "everyone",
    messagePrivacy: $("messagePrivacy") ? $("messagePrivacy").value : "everyone",
    commentPrivacy: $("commentPrivacy") ? $("commentPrivacy").value : "everyone",
    updatedAt: Date.now()
  };
}

function savePrivacySettings() {
  if (!currentUser) return;

  var privacyData = collectPrivacy();
  var uid = currentUser.uid;
  var db = firebase.database();

  // 1) nested privacy object
  // 2) top-level flags so profile.js / feed canView works
  var updates = {};
  updates["users/" + uid + "/privacy"] = privacyData;
  updates["users/" + uid + "/privateAccount"] = !!privacyData.privateAccount;
  updates["users/" + uid + "/isPrivate"] = !!privacyData.privateAccount;
  updates["users/" + uid + "/messagePrivacy"] = privacyData.messagePrivacy;
  updates["users/" + uid + "/storyPrivacy"] = privacyData.storyPrivacy;

  db.ref()
    .update(updates)
    .then(function () {
      showToast("Privacy settings saved");
    })
    .catch(function (error) {
      console.error("[privacy] save", error);
      showToast((error && error.message) || "Save failed");
    });
}

// Auto-save on change + explicit save button
document.addEventListener("DOMContentLoaded", function () {
  var ids = [
    "privateAccount",
    "onlineStatus",
    "readReceipts",
    "locationSharing",
    "profileVisibility",
    "lastSeen",
    "storyPrivacy",
    "messagePrivacy",
    "commentPrivacy"
  ];
  ids.forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener("change", function () {
      savePrivacySettings();
    });
  });
  var btn = $("savePrivacyBtn") || $("saveBtn");
  if (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      savePrivacySettings();
    });
  }
});

window.addEventListener("online", function () {
  showToast("Internet connected");
});
window.addEventListener("offline", function () {
  showToast("No internet connection");
});

console.log("Viewora Privacy Settings Loaded (Phase 4)");
