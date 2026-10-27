/**
 * follow-list.js — Instagram-style followers / following
 * Real follows only · Request for private · Follow back correct
 */
(function () {
  "use strict";
  if (window.__VIEWORA_FOLLOW_LIST__) return;
  window.__VIEWORA_FOLLOW_LIST__ = true;

  var params = new URLSearchParams(location.search);
  var targetUid = params.get("uid") || "";
  var startTab = (params.get("tab") || "").toLowerCase() === "following" ? "following" : "followers";
  var pager = document.getElementById("flPager");
  var ink = document.getElementById("flTabInk");
  var tabs = document.querySelectorAll(".flTab");
  var searchInput = document.getElementById("flSearch");
  var me = null;
  var myFollowing = {};
  var myFollowers = {};
  var myOutgoingReq = {};
  var userPrivacy = {};

  function $(id) { return document.getElementById(id); }

  var back = document.getElementById("flBack");
  if (back) {
    back.onclick = function () {
      if (history.length > 1) history.back();
      else location.href = targetUid ? "profile.html?uid=" + encodeURIComponent(targetUid) : "profile.html";
    };
  }

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
    t.addEventListener("click", function () { setTab(t.getAttribute("data-tab"), true); });
  });
  if (pager) {
    var lock = false;
    pager.addEventListener("scroll", function () {
      if (lock) return;
      lock = true;
      requestAnimationFrame(function () {
        var w = pager.clientWidth || 1;
        setTab(pager.scrollLeft > w * 0.45 ? "following" : "followers", false);
        lock = false;
      });
    }, { passive: true });
  }

  function isRealFollow(v) {
    if (v === true || v === 1 || v === "true") return true;
    if (v && typeof v === "object") {
      var st = String(v.status || v.state || "").toLowerCase();
      if (st === "pending" || st === "requested" || st === "rejected") return false;
      if (v.pending === true) return false;
      return true;
    }
    return false;
  }
  function isPending(v) {
    if (v === true || v === 1) return true;
    if (v && typeof v === "object") {
      var st = String(v.status || "").toLowerCase();
      return !st || st === "pending" || st === "requested";
    }
    return false;
  }
  function isPrivateUser(u) {
    return !!(u && (u.privateAccount === true || u.isPrivate === true || u.privacy === "private"));
  }
  function avatarOf(u) {
    try {
      if (window.vieworaPickPhoto) {
        var p = vieworaPickPhoto(u);
        if (p) return p;
      }
    } catch (_) {}
    return (u && (u.profilePhoto || u.photoURL || u.avatar || u.profilePic)) ||
      (window.VIEWORA_FALLBACK_AVATAR || "assets/default-avatar.png");
  }
  function nameOf(u) {
    if (!u || u.deleted || u.status === "deleted") return "Viewora user";
    return u.displayName || u.name || u.username || "Viewora user";
  }
  function userOf(u) {
    var h = (u && (u.username || u.handle)) || "";
    return h ? "@" + String(h).replace(/^@/, "") : "";
  }
  function tickHtml(u) {
    if (!u) return "";
    try {
      if (window.VieworaBadges && VieworaBadges.resolveBadge) {
        var b = VieworaBadges.resolveBadge(u);
        if (b && b.html) return " " + b.html;
      }
    } catch (_) {}
    var tt = String((u.tickType || u.badge || "")).toLowerCase();
    var color = "";
    if (tt === "red" || u.redTick) color = "#E53935";
    else if (tt === "blue" || u.blueTick || u.verified) color = "#1D9BF0";
    else if (tt === "yellow" || u.yellowTick || u.businessVerified) color = "#F5C518";
    if (!color) return "";
    return ' <i class="fa-solid fa-circle-check" style="color:' + color + ';font-size:14px;margin-left:2px"></i>';
  }
  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function btnState(uid) {
    if (myFollowing[uid]) return { label: "Following", cls: "following", following: true, requested: false, back: false };
    if (myOutgoingReq[uid]) return { label: "Requested", cls: "requested", following: false, requested: true, back: false };
    if (myFollowers[uid]) return { label: "Follow back", cls: "follow followBack", following: false, requested: false, back: true };
    return { label: "Follow", cls: "follow", following: false, requested: false, back: false };
  }

  function rowHtml(uid, u) {
    var q = (nameOf(u) + " " + userOf(u)).toLowerCase();
    var st = btnState(uid);
    if (me && uid === me.uid) {
      return '<div class="flRow" data-uid="' + uid + '" data-q="' + escapeHtml(q) + '">' +
        '<img class="flAv" src="' + escapeHtml(avatarOf(u)) + '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
        '<div class="flMeta"><strong><span class="flName">' + escapeHtml(nameOf(u)) + "</span>" + tickHtml(u) +
        "</strong><span>" + escapeHtml(userOf(u)) + "</span></div></div>";
    }
    return '<div class="flRow" data-uid="' + uid + '" data-q="' + escapeHtml(q) + '">' +
      '<img class="flAv" src="' + escapeHtml(avatarOf(u)) + '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
      '<div class="flMeta"><strong><span class="flName">' + escapeHtml(nameOf(u)) + "</span>" + tickHtml(u) +
      "</strong><span>" + escapeHtml(userOf(u)) + "</span></div>" +
      '<button type="button" class="flBtn ' + st.cls + '" data-uid="' + uid +
      '" data-following="' + (st.following ? "1" : "0") +
      '" data-requested="' + (st.requested ? "1" : "0") + '">' + st.label + "</button></div>";
  }

  function applySearch() {
    var q = ((searchInput && searchInput.value) || "").trim().toLowerCase();
    document.querySelectorAll(".flList .flRow").forEach(function (row) {
      var hay = (row.getAttribute("data-q") || "").toLowerCase();
      row.classList.toggle("flHidden", !!(q && hay.indexOf(q) === -1));
    });
  }
  if (searchInput) searchInput.addEventListener("input", applySearch);

  async function loadRealIds(path) {
    var snap = await firebase.database().ref(path).once("value");
    var val = snap.val() || {};
    return Object.keys(val).filter(function (k) { return isRealFollow(val[k]); });
  }

  async function loadUsers(ids) {
    var out = {};
    await Promise.all(ids.map(async function (id) {
      try {
        var s = await firebase.database().ref("users/" + id).once("value");
        out[id] = s.val() || { uid: id };
        userPrivacy[id] = isPrivateUser(out[id]);
      } catch (_) { out[id] = { uid: id }; }
    }));
    return out;
  }

  async function loadMyMaps() {
    myFollowing = {}; myFollowers = {}; myOutgoingReq = {};
    if (!me) return;
    try { (await loadRealIds("following/" + me.uid)).forEach(function (id) { myFollowing[id] = true; }); } catch (_) {}
    try { (await loadRealIds("followers/" + me.uid)).forEach(function (id) { myFollowers[id] = true; }); } catch (_) {}
    try {
      var o = await firebase.database().ref("followRequestsOut/" + me.uid).once("value");
      var ov = o.val() || {};
      Object.keys(ov).forEach(function (k) { if (isPending(ov[k])) myOutgoingReq[k] = true; });
    } catch (_) {}
  }

  async function hydrateOutgoing(ids) {
    if (!me) return;
    await Promise.all(ids.map(async function (uid) {
      if (myFollowing[uid] || myOutgoingReq[uid]) return;
      try {
        var s = await firebase.database().ref("followRequests/" + uid + "/" + me.uid).once("value");
        if (isPending(s.val())) myOutgoingReq[uid] = true;
      } catch (_) {}
    }));
  }

  async function doFollow(uid, btn) {
    if (!me || !uid) return;
    var db = firebase.database();
    var my = me.uid;
    var following = btn.getAttribute("data-following") === "1";
    var requested = btn.getAttribute("data-requested") === "1";
    var updates = {};

    if (following) {
      updates["following/" + my + "/" + uid] = null;
      updates["followers/" + uid + "/" + my] = null;
      updates["followRequests/" + uid + "/" + my] = null;
      updates["followRequestsOut/" + my + "/" + uid] = null;
      await db.ref().update(updates);
      myFollowing[uid] = false; myOutgoingReq[uid] = false;
      return;
    }
    if (requested) {
      updates["followRequests/" + uid + "/" + my] = null;
      updates["followRequestsOut/" + my + "/" + uid] = null;
      await db.ref().update(updates);
      myOutgoingReq[uid] = false;
      return;
    }

    var priv = userPrivacy[uid];
    if (priv === undefined) {
      try {
        var us = await db.ref("users/" + uid).once("value");
        priv = isPrivateUser(us.val() || {});
        userPrivacy[uid] = priv;
      } catch (_) { priv = false; }
    }

    if (priv) {
      var payload = { from: my, fromUID: my, status: "pending", createdAt: Date.now() };
      updates["followRequests/" + uid + "/" + my] = payload;
      updates["followRequestsOut/" + my + "/" + uid] = payload;
      await db.ref().update(updates);
      try {
        var n = db.ref("notifications/" + uid).push();
        await n.set({ type: "follow_request", senderUID: my, fromUID: my, message: "requested to follow you", read: false, createdAt: firebase.database.ServerValue.TIMESTAMP });
      } catch (_) {}
      myOutgoingReq[uid] = true; myFollowing[uid] = false;
      return;
    }

    updates["following/" + my + "/" + uid] = true;
    updates["followers/" + uid + "/" + my] = true;
    updates["followRequests/" + uid + "/" + my] = null;
    updates["followRequestsOut/" + my + "/" + uid] = null;
    await db.ref().update(updates);
    try {
      var n2 = db.ref("notifications/" + uid).push();
      await n2.set({ type: "follow", senderUID: my, message: "started following you", read: false, createdAt: firebase.database.ServerValue.TIMESTAMP });
    } catch (_) {}
    myFollowing[uid] = true; myOutgoingReq[uid] = false;
  }

  function paintBtn(btn, uid) {
    var st = btnState(uid);
    btn.setAttribute("data-following", st.following ? "1" : "0");
    btn.setAttribute("data-requested", st.requested ? "1" : "0");
    btn.className = "flBtn " + st.cls;
    btn.textContent = st.label;
  }

  function paint(listId, ids, users) {
    var el = $(listId);
    if (!el) return;
    if (!ids.length) { el.innerHTML = '<div class="flEmpty">No users yet</div>'; return; }
    el.innerHTML = ids.map(function (id) { return rowHtml(id, users[id]); }).join("");
    el.querySelectorAll(".flBtn").forEach(function (btn) {
      btn.addEventListener("click", async function (e) {
        e.stopPropagation();
        if (!me) return;
        var uid = btn.getAttribute("data-uid");
        btn.disabled = true;
        try { await doFollow(uid, btn); paintBtn(btn, uid); } catch (err) { console.warn(err); }
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
      if ($("followersList")) $("followersList").innerHTML = '<div class="flEmpty">Missing user</div>';
      if ($("followingList")) $("followingList").innerHTML = '<div class="flEmpty">Missing user</div>';
      return;
    }
    await new Promise(function (resolve) {
      firebase.auth().onAuthStateChanged(function (u) { me = u; resolve(); });
    });
    try {
      var ps = await firebase.database().ref("users/" + targetUid).once("value");
      var pd = ps.val() || {};
      if ($("flTitle")) $("flTitle").textContent = pd.displayName || pd.username || "Connections";
    } catch (_) {}
    await loadMyMaps();
    var followerIds = await loadRealIds("followers/" + targetUid);
    var followingIds = await loadRealIds("following/" + targetUid);
    var allIds = Array.from(new Set(followerIds.concat(followingIds)));
    var users = await loadUsers(allIds);
    await hydrateOutgoing(allIds);
    paint("followersList", followerIds, users);
    paint("followingList", followingIds, users);
    goStartTab();
    setTimeout(goStartTab, 50);
    setTimeout(goStartTab, 200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
