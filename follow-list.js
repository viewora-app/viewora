(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var targetUid = params.get("uid") || "";
  var startTab = (params.get("tab") || "").toLowerCase() === "following" ? "following" : "followers";

  var pager = document.getElementById("flPager");
  var ink = document.getElementById("flTabInk");
  var tabs = document.querySelectorAll(".flTab");
  var searchInput = document.getElementById("flSearch");
  var me = null;
  var myFollowing = {};
  var myFollowers = {}; // people who follow ME → Follow back

  function $(id) { return document.getElementById(id); }

  document.getElementById("flBack").onclick = function () {
    if (history.length > 1) history.back();
    else location.href = targetUid ? "profile.html?uid=" + encodeURIComponent(targetUid) : "profile.html";
  };

  function setTab(tab, scroll) {
    tab = tab === "following" ? "following" : "followers";
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === tab);
    });
    if (ink) ink.style.transform = tab === "following" ? "translateX(100%)" : "translateX(0%)";
    if (scroll && pager) {
      var w = pager.clientWidth || window.innerWidth;
      pager.scrollTo({ left: tab === "following" ? w : 0, behavior: "smooth" });
    }
    try {
      var u = new URL(location.href);
      u.searchParams.set("tab", tab);
      if (targetUid) u.searchParams.set("uid", targetUid);
      history.replaceState(null, "", u.pathname + u.search);
    } catch (_) {}
    applySearch();
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
        var tab = pager.scrollLeft > w * 0.45 ? "following" : "followers";
        setTab(tab, false);
        lock = false;
      });
    }, { passive: true });
  }

  function avatarOf(u) {
    return (u && (u.profilePhoto || u.photoURL || u.avatar || u.profilePic)) || "assets/default-avatar.png";
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

  function tickHtml(u) {
    if (!u) return "";
    var tt = String(u.tickType || "").toLowerCase();
    var color = "";
    if (u.redTick || tt === "red" || u.vip) color = "#ff3b5c";
    else if (u.yellowTick || tt === "yellow") color = "#f5c542";
    else if (u.whiteTick || tt === "white" || u.monetized) color = "#e8eef7";
    else if (u.blueTick || u.verified || u.isVerified || tt === "blue") color = "#1d9bf0";
    if (!color) return "";
    return (
      '<svg class="flTick" width="14" height="14" viewBox="0 0 24 24">' +
      '<circle cx="12" cy="12" r="11" fill="' + color + '"/>' +
      '<path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      "</svg>"
    );
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function searchText(u) {
    return (nameOf(u) + " " + userOf(u) + " " + ((u && u.email) || "")).toLowerCase();
  }

  /** Button label: Following | Follow back | Follow */
  function btnState(uid) {
    if (myFollowing[uid]) return { label: "Following", cls: "following", on: true, back: false };
    if (myFollowers[uid]) return { label: "Follow back", cls: "follow", on: false, back: true };
    return { label: "Follow", cls: "follow", on: false, back: false };
  }

  function rowHtml(uid, u) {
    var q = searchText(u);
    var st = btnState(uid);
    if (me && uid === me.uid) {
      return (
        '<div class="flRow" data-uid="' + uid + '" data-q="' + escapeHtml(q) + '">' +
        '<img class="flAv" src="' + avatarOf(u) + '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
        '<div class="flMeta"><strong><span class="flName">' + escapeHtml(nameOf(u)) + "</span>" + tickHtml(u) +
        "</strong><span>" + escapeHtml(userOf(u)) + "</span></div></div>"
      );
    }
    return (
      '<div class="flRow" data-uid="' + uid + '" data-q="' + escapeHtml(q) + '">' +
      '<img class="flAv" src="' + avatarOf(u) + '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
      '<div class="flMeta"><strong><span class="flName">' + escapeHtml(nameOf(u)) + "</span>" + tickHtml(u) +
      "</strong><span>" + escapeHtml(userOf(u)) + "</span></div>" +
      '<button type="button" class="flBtn ' + st.cls + (st.back ? " followBack" : "") +
      '" data-uid="' + uid + '" data-following="' + (st.on ? "1" : "0") +
      '" data-back="' + (st.back ? "1" : "0") + '">' + st.label + "</button></div>"
    );
  }

  function applySearch() {
    var q = ((searchInput && searchInput.value) || "").trim().toLowerCase();
    document.querySelectorAll(".flList .flRow").forEach(function (row) {
      var hay = (row.getAttribute("data-q") || "").toLowerCase();
      row.classList.toggle("flHidden", !!(q && hay.indexOf(q) === -1));
    });
  }

  if (searchInput) searchInput.addEventListener("input", applySearch);

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

  async function loadMyMaps() {
    myFollowing = {};
    myFollowers = {};
    if (!me) return;
    try {
      var f1 = await loadMap("following/" + me.uid);
      f1.forEach(function (id) { myFollowing[id] = true; });
    } catch (_) {}
    try {
      var f2 = await loadMap("followers/" + me.uid);
      f2.forEach(function (id) { myFollowers[id] = true; });
    } catch (_) {}
  }

  function paint(listId, ids, users) {
    var el = $(listId);
    if (!el) return;
    if (!ids.length) {
      el.innerHTML = '<div class="flEmpty">No users yet</div>';
      return;
    }
    el.innerHTML = ids.map(function (id) { return rowHtml(id, users[id]); }).join("");

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
            await firebase.database().ref().update(updates);
            myFollowing[uid] = false;
          } else {
            updates["following/" + me.uid + "/" + uid] = true;
            updates["followers/" + uid + "/" + me.uid] = true;
            await firebase.database().ref().update(updates);
            myFollowing[uid] = true;
          }
          var st = btnState(uid);
          btn.setAttribute("data-following", st.on ? "1" : "0");
          btn.setAttribute("data-back", st.back ? "1" : "0");
          btn.className = "flBtn " + st.cls + (st.back ? " followBack" : "");
          btn.textContent = st.label;
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
    applySearch();
  }

  function goStartTab() {
    var w = (pager && pager.clientWidth) || window.innerWidth;
    if (pager) pager.scrollLeft = startTab === "following" ? w : 0;
    setTab(startTab, false);
  }

  async function boot() {
    if (!targetUid) {
      $("followersList").innerHTML = '<div class="flEmpty">Missing user</div>';
      $("followingList").innerHTML = '<div class="flEmpty">Missing user</div>';
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
      $("flTitle").textContent = pd.displayName || pd.username || "Connections";
    } catch (_) {}

    await loadMyMaps();

    var followerIds = await loadMap("followers/" + targetUid);
    var followingIds = await loadMap("following/" + targetUid);
    var allIds = Array.from(new Set(followerIds.concat(followingIds)));
    var users = await loadUsers(allIds);

    paint("followersList", followerIds, users);
    paint("followingList", followingIds, users);

    goStartTab();
    setTimeout(goStartTab, 50);
    setTimeout(goStartTab, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
