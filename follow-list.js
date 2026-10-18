(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var targetUid = params.get("uid") || "";
  var startTab = params.get("tab") === "following" ? "following" : "followers";

  var pager = document.getElementById("flPager");
  var ink = document.getElementById("flTabInk");
  var tabs = document.querySelectorAll(".flTab");
  var me = null;
  var myFollowing = {};
  var profileName = "Connections";

  function $(id) { return document.getElementById(id); }

  document.getElementById("flBack").onclick = function () {
    if (history.length > 1) history.back();
    else location.href = "profile.html?uid=" + encodeURIComponent(targetUid);
  };

  function setTab(tab, scroll) {
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === tab);
    });
    if (ink) ink.style.transform = tab === "following" ? "translateX(100%)" : "translateX(0%)";
    if (scroll && pager) {
      var w = pager.clientWidth || window.innerWidth;
      pager.scrollTo({ left: tab === "following" ? w : 0, behavior: "smooth" });
    }
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      setTab(t.getAttribute("data-tab"), true);
    });
  });

  if (pager) {
    var lock = false;
    pager.addEventListener("scroll", function () {
      if (lock) return;
      lock = true;
      requestAnimationFrame(function () {
        var w = pager.clientWidth || 1;
        var tab = pager.scrollLeft > w * 0.5 ? "following" : "followers";
        setTab(tab, false);
        lock = false;
      });
    }, { passive: true });
  }

  function avatarOf(u) {
    return (
      (u && (u.profilePhoto || u.photoURL || u.avatar || u.profilePic)) ||
      "assets/default-avatar.png"
    );
  }
  function nameOf(u) {
    if (!u) return "Viewora user";
    if (u.deleted || u.status === "deleted") return "Viewora user";
    return u.displayName || u.name || u.username || "Viewora user";
  }
  function userOf(u) {
    if (!u) return "";
    var h = u.username || u.handle || "";
    return h ? "@" + String(h).replace(/^@/, "") : "";
  }

  function rowHtml(uid, u, isFollowing) {
    var label = isFollowing ? "Following" : "Follow";
    var cls = isFollowing ? "following" : "follow";
    if (me && uid === me.uid) {
      return (
        '<div class="flRow" data-uid="' + uid + '">' +
        '<img class="flAv" src="' + avatarOf(u) + '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
        '<div class="flMeta"><strong>' + escapeHtml(nameOf(u)) + '</strong><span>' + escapeHtml(userOf(u)) + '</span></div>' +
        '</div>'
      );
    }
    return (
      '<div class="flRow" data-uid="' + uid + '">' +
      '<img class="flAv" src="' + avatarOf(u) + '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
      '<div class="flMeta"><strong>' + escapeHtml(nameOf(u)) + '</strong><span>' + escapeHtml(userOf(u)) + '</span></div>' +
      '<button type="button" class="flBtn ' + cls + '" data-uid="' + uid + '" data-following="' + (isFollowing ? "1" : "0") + '">' + label + '</button>' +
      '</div>'
    );
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadMap(path) {
    var snap = await firebase.database().ref(path).once("value");
    var val = snap.val() || {};
    var ids = [];
    Object.keys(val).forEach(function (k) {
      var v = val[k];
      if (v === true || v === 1 || v === "true" || (v && typeof v === "object" && v.status !== "rejected")) {
        ids.push(k);
      }
    });
    return ids;
  }

  async function loadUsers(ids) {
    var out = {};
    await Promise.all(
      ids.map(async function (id) {
        try {
          var s = await firebase.database().ref("users/" + id).once("value");
          out[id] = s.val() || { uid: id };
        } catch (_) {
          out[id] = { uid: id };
        }
      })
    );
    return out;
  }

  async function loadMyFollowing() {
    myFollowing = {};
    if (!me) return;
    try {
      var ids = await loadMap("following/" + me.uid);
      ids.forEach(function (id) { myFollowing[id] = true; });
    } catch (_) {}
  }

  function paint(listId, ids, users) {
    var el = $(listId);
    if (!el) return;
    if (!ids.length) {
      el.innerHTML = '<div class="flEmpty">No users yet</div>';
      return;
    }
    el.innerHTML = ids
      .map(function (id) {
        return rowHtml(id, users[id], !!myFollowing[id]);
      })
      .join("");

    el.querySelectorAll(".flBtn").forEach(function (btn) {
      btn.addEventListener("click", async function (e) {
        e.stopPropagation();
        if (!me) return;
        var uid = btn.getAttribute("data-uid");
        var on = btn.getAttribute("data-following") === "1";
        btn.disabled = true;
        try {
          var updates = {};
          if (on) {
            updates["following/" + me.uid + "/" + uid] = null;
            updates["followers/" + uid + "/" + me.uid] = null;
          } else {
            updates["following/" + me.uid + "/" + uid] = true;
            updates["followers/" + uid + "/" + me.uid] = true;
          }
          await firebase.database().ref().update(updates);
          myFollowing[uid] = !on;
          btn.setAttribute("data-following", on ? "0" : "1");
          btn.className = "flBtn " + (on ? "follow" : "following");
          btn.textContent = on ? "Follow" : "Following";
        } catch (err) {
          console.warn(err);
        }
        btn.disabled = false;
      });
    });

    el.querySelectorAll(".flRow").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest(".flBtn")) return;
        var uid = row.getAttribute("data-uid");
        if (uid) location.href = "profile.html?uid=" + encodeURIComponent(uid);
      });
    });
  }

  async function boot() {
    if (!targetUid) {
      $("followersList").innerHTML = '<div class="flEmpty">Missing user</div>';
      return;
    }
    await new Promise(function (resolve) {
      firebase.auth().onAuthStateChanged(function (u) {
        me = u;
        resolve();
      });
    });

    try {
      var ps = await firebase.database().ref("users/" + targetUid).once("value");
      var pd = ps.val() || {};
      profileName = pd.displayName || pd.username || "Connections";
      $("flTitle").textContent = profileName;
    } catch (_) {}

    await loadMyFollowing();

    var [followerIds, followingIds] = await Promise.all([
      loadMap("followers/" + targetUid),
      loadMap("following/" + targetUid)
    ]);
    var allIds = Array.from(new Set(followerIds.concat(followingIds)));
    var users = await loadUsers(allIds);
    paint("followersList", followerIds, users);
    paint("followingList", followingIds, users);

    setTab(startTab, false);
    requestAnimationFrame(function () {
      var w = pager.clientWidth || window.innerWidth;
      pager.scrollLeft = startTab === "following" ? w : 0;
      setTab(startTab, false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
