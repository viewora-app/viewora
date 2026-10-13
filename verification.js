"use strict";
/**
 * Viewora Verification — application + status UI
 * Firebase paths:
 *   verificationApplications/{appId}
 *   users/{uid}/tickApplications/{type}
 *   notifications/{uid}/{nid}
 */

(function () {
  const TICKS = [
    {
      type: "blue",
      icon: "fa-circle-check",
      colorClass: "blue",
      title: "Blue Tick",
      subtitle: "Creator Verification",
      points: [
        "Identity & authenticity review",
        "Complete profile required",
        "Not sold by follower count alone",
        "Payment (if any) ≠ automatic approval"
      ],
      needsId: true,
      paidHint: "Optional verification plan on Subscription"
    },
    {
      type: "red",
      icon: "fa-certificate",
      colorClass: "red",
      title: "Red Tick",
      subtitle: "Viewora Elite",
      points: [
        "Active Elite membership",
        "Premium tools & priority support",
        "Not a wealth verification badge",
        "Ends if Elite subscription expires"
      ],
      needsId: false,
      paidHint: "Requires Elite plan",
      eliteOnly: true
    },
    {
      type: "yellow",
      icon: "fa-circle-check",
      colorClass: "yellow",
      title: "Yellow Tick",
      subtitle: "Official Business",
      points: [
        "Registered company / brand",
        "Business authorization review",
        "Does not guarantee every product is genuine",
        "Separate from creator Blue Tick"
      ],
      needsId: true,
      business: true
    },
    {
      type: "white",
      icon: "fa-certificate",
      colorClass: "white",
      title: "White Tick",
      subtitle: "Achievement",
      points: [
        "Earned from follower milestones",
        "1M → Level 1 · 5M → Level 2 · 10M → Level 3",
        "No subscription purchase required",
        "Suspicious growth may be reviewed"
      ],
      needsId: false,
      achievement: true
    }
  ];

  function db() {
    return window.db || (window.firebase && firebase.database && firebase.database());
  }
  function auth() {
    return window.auth || (window.firebase && firebase.auth && firebase.auth());
  }

  function statusLabel(st) {
    if (st === "active" || st === "approved" || st === "verified") return { text: "Active", cls: "active" };
    if (st === "under_review" || st === "pending" || st === "review") return { text: "Under Review", cls: "review" };
    if (st === "rejected") return { text: "Rejected", cls: "rejected" };
    if (st === "more_info") return { text: "More info needed", cls: "review" };
    return { text: "Not Earned", cls: "none" };
  }

  function tickStatusFromUser(user, type) {
    if (!user) return "none";
    const B = window.VieworaBadges;
    if (type === "blue" && B && B.hasBlue(user)) return "active";
    if (type === "red" && B && B.hasRed(user)) return "active";
    if (type === "yellow" && B && B.hasYellow(user)) return "active";
    if (type === "white" && B && B.hasWhite(user)) return "active";

    const apps = user.tickApplications || {};
    const a = apps[type];
    if (a && a.status) return String(a.status);
    return "none";
  }

  async function loadUser(uid) {
    const ref = db().ref("users/" + uid);
    const snap = await ref.once("value");
    return snap.val() || {};
  }

  async function pushActivity(uid, payload) {
    if (!uid || !db()) return;
    const nid = "verif_" + (payload.type || "x") + "_" + Date.now();
    try {
      await db().ref("notifications/" + uid + "/" + nid).set({
        id: nid,
        type: payload.notifType || "verification",
        title: payload.title || "Verification",
        body: payload.body || "",
        tickType: payload.type || null,
        createdAt: Date.now(),
        read: false,
        icon: payload.icon || "badge"
      });
    } catch (e) {
      console.warn("notif failed", e);
    }
  }

  function renderGrid(user) {
    const grid = document.getElementById("tickGrid");
    if (!grid) return;
    grid.innerHTML = "";

    TICKS.forEach(function (t) {
      const st = tickStatusFromUser(user, t.type);
      const lab = statusLabel(st);
      const card = document.createElement("article");
      card.className = "vCard";
      card.innerHTML =
        '<div class="vCardHead">' +
        '<div class="vIcon ' + t.colorClass + '"><i class="fa-solid ' + t.icon + '"></i></div>' +
        '<div style="flex:1;min-width:0">' +
        "<h3>" + t.title + "</h3>" +
        '<p class="vSub">' + t.subtitle + "</p></div>" +
        '<span class="vStatus ' + lab.cls + '">' + lab.text + "</span></div>" +
        "<ul>" + t.points.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul>" +
        '<button type="button" class="vBtn" data-apply="' + t.type + '"></button>';

      const btn = card.querySelector("[data-apply]");
      if (st === "active") {
        btn.textContent = "Active on profile";
        btn.disabled = true;
        btn.classList.add("ghost");
      } else if (st === "under_review" || st === "pending") {
        btn.textContent = "Under review…";
        btn.disabled = true;
        btn.classList.add("ghost");
      } else if (t.achievement) {
        btn.textContent = "View milestones";
        btn.classList.add("ghost");
      } else if (t.eliteOnly) {
        btn.textContent = "Go to Elite plan";
      } else {
        btn.textContent = st === "rejected" ? "Re-apply" : "Apply for " + t.title;
      }
      grid.appendChild(card);
    });

    grid.querySelectorAll("[data-apply]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const type = btn.getAttribute("data-apply");
        onApplyClick(type, user);
      });
    });
  }

  let applyType = null;

  function onApplyClick(type, user) {
    const meta = TICKS.find(function (t) { return t.type === type; });
    if (!meta) return;

    if (meta.eliteOnly) {
      location.href = "subscription.html";
      return;
    }
    if (meta.achievement) {
      const B = window.VieworaBadges;
      const fc = B ? B.followersOf(user) : 0;
      const wl = B ? B.getWhiteLevel(user) : { label: "", level: 0 };
      alert(
        "White Tick is earned from followers.\n\n" +
        "Your followers: " + fc.toLocaleString() + "\n" +
        (wl.label || "Keep growing to unlock Level 1 at 1M followers.")
      );
      return;
    }

    applyType = type;
    const sheet = document.getElementById("applySheet");
    const title = document.getElementById("applyTitle");
    const body = document.getElementById("applyBody");
    title.textContent = "Apply · " + meta.title;
    body.innerHTML = "";

    if (meta.business) {
      body.innerHTML =
        '<div class="vField"><label>Business / brand name</label><input id="vfBiz" maxlength="80" placeholder="Official company name"></div>' +
        '<div class="vField"><label>Business type</label><select id="vfBizType"><option value="company">Company</option><option value="brand">Brand</option><option value="seller">Authorized seller</option><option value="other">Other</option></select></div>' +
        '<div class="vField"><label>Registration / GST / ID (text only)</label><input id="vfReg" maxlength="60" placeholder="Registration number"></div>' +
        '<div class="vField"><label>Why this account is official</label><textarea id="vfWhy" maxlength="500" placeholder="Website, proof links…"></textarea></div>' +
        '<p class="vNote" style="padding:0">Payment does not auto-approve. Team reviews business authorization.</p>';
    } else {
      body.innerHTML =
        '<div class="vField"><label>Full legal name</label><input id="vfName" maxlength="80" placeholder="As on ID"></div>' +
        '<div class="vField"><label>Category</label><select id="vfCat"><option value="creator">Creator / influencer</option><option value="public">Public figure</option><option value="artist">Artist / musician</option><option value="other">Other</option></select></div>' +
        '<div class="vField"><label>Government ID type</label><select id="vfIdType"><option value="aadhaar">Aadhaar (last 4 only)</option><option value="passport">Passport</option><option value="dl">Driving licence</option><option value="other">Other</option></select></div>' +
        '<div class="vField"><label>ID last 4 digits only</label><input id="vfIdLast4" maxlength="4" inputmode="numeric" placeholder="XXXX"></div>' +
        '<div class="vField"><label>Why you should be verified</label><textarea id="vfWhy" maxlength="500" placeholder="Links to other platforms, press…"></textarea></div>' +
        '<p class="vNote" style="padding:0">We only store minimal ID hints. Full documents are reviewed securely by staff — never write secrets in public posts.</p>';
    }

    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    const sheet = document.getElementById("applySheet");
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    applyType = null;
  }

  async function submitApplication() {
    const u = auth() && auth().currentUser;
    if (!u) {
      alert("Please log in to apply.");
      location.href = "login.html";
      return;
    }
    if (!applyType) return;

    const meta = TICKS.find(function (t) { return t.type === applyType; });
    const payload = {
      uid: u.uid,
      type: applyType,
      status: "under_review",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      email: u.email || null
    };

    if (meta && meta.business) {
      payload.businessName = (document.getElementById("vfBiz") || {}).value || "";
      payload.businessType = (document.getElementById("vfBizType") || {}).value || "";
      payload.registrationHint = (document.getElementById("vfReg") || {}).value || "";
      payload.reason = (document.getElementById("vfWhy") || {}).value || "";
      if (!payload.businessName.trim()) {
        alert("Business name is required.");
        return;
      }
    } else {
      payload.legalName = (document.getElementById("vfName") || {}).value || "";
      payload.category = (document.getElementById("vfCat") || {}).value || "";
      payload.idType = (document.getElementById("vfIdType") || {}).value || "";
      payload.idLast4 = (document.getElementById("vfIdLast4") || {}).value || "";
      payload.reason = (document.getElementById("vfWhy") || {}).value || "";
      if (!payload.legalName.trim()) {
        alert("Legal name is required.");
        return;
      }
    }

    const btn = document.getElementById("applySubmit");
    btn.disabled = true;
    btn.textContent = "Submitting…";

    try {
      const appRef = db().ref("verificationApplications").push();
      payload.id = appRef.key;
      await appRef.set(payload);
      await db().ref("users/" + u.uid + "/tickApplications/" + applyType).set({
        status: "under_review",
        applicationId: payload.id,
        updatedAt: Date.now()
      });

      await pushActivity(u.uid, {
        type: applyType,
        notifType: "verification_submitted",
        title: meta.title + " application",
        body: "Your application has been submitted successfully and is now under review. We'll notify you when a decision is made.",
        icon: "badge"
      });

      closeSheet();
      alert("Application submitted. Check Activity for updates.");
      const user = await loadUser(u.uid);
      renderGrid(user);
    } catch (e) {
      console.error(e);
      alert("Could not submit. Check login and try again.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit application";
    }
  }

  /* ---------- Long-press tick panel (global helper) ---------- */
  function ensureHoldPanel() {
    let el = document.getElementById("tickHoldPanel");
    if (el) return el;
    el = document.createElement("div");
    el.id = "tickHoldPanel";
    el.className = "tickHoldPanel";
    el.innerHTML =
      '<div class="tickHoldCard" role="dialog" aria-label="Viewora Verification">' +
      "<h4>Viewora Verification</h4>" +
      '<div class="tickHoldBrand">Viewora ✓</div>' +
      '<div id="tickHoldRows"></div>' +
      '<button type="button" class="tickHoldClose" id="tickHoldClose">Close</button></div>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el) el.classList.remove("open");
    });
    el.querySelector("#tickHoldClose").addEventListener("click", function () {
      el.classList.remove("open");
    });
    return el;
  }

  function showTickHoldPanel(user) {
    const el = ensureHoldPanel();
    const rows = el.querySelector("#tickHoldRows");
    const items = [
      { type: "blue", label: "🔵 Blue Tick", key: "blue" },
      { type: "red", label: "🔴 Red Tick", key: "red" },
      { type: "yellow", label: "🟡 Yellow Tick", key: "yellow" },
      { type: "white", label: "⚪ White Tick", key: "white" }
    ];
    rows.innerHTML = items.map(function (it) {
      const st = tickStatusFromUser(user || {}, it.key);
      const lab = statusLabel(st);
      return (
        '<div class="tickHoldRow"><span>' + it.label + '</span>' +
        '<span class="lab"></span>' +
        '<span class="st ' +
        (lab.cls === "active" ? "ok" : lab.cls === "review" ? "rev" : lab.cls === "rejected" ? "rej" : "") +
        '">' + lab.text + "</span></div>"
      );
    }).join("");
    el.classList.add("open");
  }

  function bindLongPressOnTick(node, getUser) {
    if (!node || node.dataset.tickHoldBound) return;
    node.dataset.tickHoldBound = "1";
    let timer = null;
    const start = function (e) {
      timer = setTimeout(function () {
        timer = null;
        Promise.resolve(getUser()).then(function (user) {
          showTickHoldPanel(user || {});
        });
      }, 3000);
    };
    const cancel = function () {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchend", cancel);
    node.addEventListener("touchcancel", cancel);
    node.addEventListener("mousedown", start);
    node.addEventListener("mouseup", cancel);
    node.addEventListener("mouseleave", cancel);
    // Desktop click alternative: Alt+click or double-click
    node.addEventListener("dblclick", function (e) {
      e.preventDefault();
      Promise.resolve(getUser()).then(function (user) {
        showTickHoldPanel(user || {});
      });
    });
    node.setAttribute("title", "Hold 3s or double-click for all badges");
  }

  // Expose for profile/feed
  window.VieworaVerification = {
    showTickHoldPanel: showTickHoldPanel,
    bindLongPressOnTick: bindLongPressOnTick,
    tickStatusFromUser: tickStatusFromUser,
    statusLabel: statusLabel
  };

  // Page init
  document.getElementById("applyCancel") && document.getElementById("applyCancel").addEventListener("click", closeSheet);
  document.getElementById("applySubmit") && document.getElementById("applySubmit").addEventListener("click", submitApplication);
  document.getElementById("applySheet") && document.getElementById("applySheet").addEventListener("click", function (e) {
    if (e.target.id === "applySheet") closeSheet();
  });

  function boot() {
    const a = auth();
    if (!a) {
      renderGrid({});
      return;
    }
    a.onAuthStateChanged(async function (user) {
      if (!user) {
        renderGrid({});
        return;
      }
      try {
        const data = await loadUser(user.uid);
        renderGrid(data);
      } catch (e) {
        renderGrid({});
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
