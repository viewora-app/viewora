/**
 * ============================================================
 * VIEWORA — Monetization Test Helper
 * ------------------------------------------------------------
 * Load AFTER firebase.js on monetization.html (dev only):
 *   <script src="firebase.js"></script>
 *   <script src="monetization-test.js"></script>
 *   <script src="monetization.js"></script>
 *
 * Console / floating panel:
 *   VieworaMonoTest.help()
 *   VieworaMonoTest.grantEligible()
 *   VieworaMonoTest.setBalance(75)
 *   VieworaMonoTest.enableMonetization()
 *   VieworaMonoTest.reset()
 * ============================================================
 */
(function () {
  "use strict";

  if (window.__VIEWORA_MONO_TEST__) return;
  window.__VIEWORA_MONO_TEST__ = true;

  function db() {
    if (window.db) return window.db;
    try {
      return firebase.database();
    } catch (_) {
      return null;
    }
  }

  function auth() {
    if (window.auth) return window.auth;
    try {
      return firebase.auth();
    } catch (_) {
      return null;
    }
  }

  function uid() {
    const u = auth() && auth().currentUser;
    return u ? u.uid : null;
  }

  function ts() {
    try {
      return firebase.database.ServerValue.TIMESTAMP;
    } catch (_) {
      return Date.now();
    }
  }

  function log() {
    const args = ["[MonoTest]"].concat([].slice.call(arguments));
    console.log.apply(console, args);
  }

  function toast(msg) {
    try {
      const el = document.getElementById("monoToast");
      const text = document.getElementById("monoToastText");
      if (text) text.textContent = msg;
      if (el) {
        el.classList.add("show");
        setTimeout(function () {
          el.classList.remove("show");
        }, 2500);
      }
    } catch (_) {}
    log(msg);
  }

  async function requireUser() {
    const id = uid();
    if (!id) throw new Error("Login required — open monetization while signed in");
    if (!db()) throw new Error("Firebase database not ready");
    return id;
  }

  /** Make stats pass 300k views / 600 followers / 100 stories */
  async function grantEligible(opts) {
    opts = opts || {};
    const id = await requireUser();
    const views = opts.views != null ? opts.views : 350000;
    const followers = opts.followers != null ? opts.followers : 650;
    const stories = opts.stories != null ? opts.stories : 120;

    const updates = {};
    updates["users/" + id + "/totalViews"] = views;
    updates["users/" + id + "/followersCount"] = followers;
    updates["users/" + id + "/storiesCount"] = stories;
    updates["users/" + id + "/monetizationEligible"] = true;

    // seed follower nodes so getCreatorStats counts them
    for (let i = 0; i < Math.min(followers, 20); i++) {
      updates["followers/" + id + "/test_follower_" + i] = true;
    }

    await db().ref().update(updates);
    toast("Eligible stats set (views " + views + ")");
    return { views: views, followers: followers, stories: stories };
  }

  /** Admin flag — unlocks withdraw UI when balance >= 50 */
  async function enableMonetization(on) {
    const id = await requireUser();
    const val = on !== false;
    await db()
      .ref("users/" + id)
      .update({
        monetizationEnabled: val,
        monetized: val,
        whiteTick: val
      });
    toast(val ? "Monetization ENABLED" : "Monetization disabled");
    return val;
  }

  /** Set available balance (USD) */
  async function setBalance(amount, extra) {
    const id = await requireUser();
    const bal = Number(amount);
    if (!(bal >= 0)) throw new Error("amount must be >= 0");
    extra = extra || {};
    const payload = {
      balance: bal,
      month: Number(extra.month != null ? extra.month : bal),
      lifetime: Number(extra.lifetime != null ? extra.lifetime : bal),
      pending: Number(extra.pending != null ? extra.pending : 0),
      updatedAt: ts()
    };
    await db().ref("earnings/" + id).update(payload);
    toast("Balance set to $" + bal.toFixed(2));
    return payload;
  }

  /** Quick path: eligible + enabled + $75 balance + sample UPI */
  async function setupPayoutReady() {
    const id = await requireUser();
    await grantEligible();
    await enableMonetization(true);
    await setBalance(75, { month: 40, lifetime: 120, pending: 0 });
    await db()
      .ref("payoutMethods/" + id)
      .set({
        type: "upi",
        value: "viewora-test@upi",
        name: "Test Creator",
        updatedAt: ts()
      });
    toast("Ready to withdraw — refresh if UI lag");
    return true;
  }

  /** Clear test earnings / flags (keeps account) */
  async function reset() {
    const id = await requireUser();
    const updates = {};
    updates["earnings/" + id] = null;
    updates["payoutMethods/" + id] = null;
    updates["users/" + id + "/monetizationEnabled"] = false;
    updates["users/" + id + "/monetizationEligible"] = false;
    updates["users/" + id + "/totalViews"] = 0;
    updates["users/" + id + "/followersCount"] = 0;
    updates["users/" + id + "/storiesCount"] = 0;
    updates["users/" + id + "/lastWithdrawal"] = null;
    // remove test followers only
    for (let i = 0; i < 20; i++) {
      updates["followers/" + id + "/test_follower_" + i] = null;
    }
    await db().ref().update(updates);
    toast("Monetization test data reset");
    return true;
  }

  /** Dump current state */
  async function status() {
    const id = await requireUser();
    const [userSnap, earnSnap, methodSnap, wdSnap] = await Promise.all([
      db().ref("users/" + id).once("value"),
      db().ref("earnings/" + id).once("value"),
      db().ref("payoutMethods/" + id).once("value"),
      db().ref("withdrawals").orderByChild("uid").equalTo(id).once("value")
    ]);
    const user = userSnap.val() || {};
    const earnings = earnSnap.val() || {};
    const method = methodSnap.val() || null;
    const withdrawals = [];
    wdSnap.forEach(function (c) {
      withdrawals.push(Object.assign({ id: c.key }, c.val() || {}));
    });
    const info = {
      uid: id,
      monetizationEnabled: !!user.monetizationEnabled,
      totalViews: user.totalViews || 0,
      followersCount: user.followersCount || 0,
      storiesCount: user.storiesCount || 0,
      earnings: earnings,
      method: method,
      withdrawals: withdrawals.length
    };
    console.table
      ? console.table({
          enabled: info.monetizationEnabled,
          views: info.totalViews,
          followers: info.followersCount,
          stories: info.storiesCount,
          balance: earnings.balance || 0,
          pending: earnings.pending || 0
        })
      : log(info);
    return info;
  }

  /** Simulate admin marking last pending withdrawal as paid */
  async function markLastPaid() {
    const id = await requireUser();
    const snap = await db()
      .ref("withdrawals")
      .orderByChild("uid")
      .equalTo(id)
      .once("value");
    let last = null;
    snap.forEach(function (c) {
      const v = c.val() || {};
      if ((v.status || "pending") === "pending") {
        last = { id: c.key, data: v };
      }
    });
    if (!last) {
      toast("No pending withdrawal");
      return null;
    }
    const amount = Number(last.data.amount || 0);
    await db()
      .ref("withdrawals/" + last.id)
      .update({
        status: "paid",
        paidAt: ts(),
        updatedAt: ts()
      });
    const earnSnap = await db().ref("earnings/" + id).once("value");
    const cur = earnSnap.val() || {};
    const pending = Math.max(0, Number(cur.pending || 0) - amount);
    await db()
      .ref("earnings/" + id)
      .update({ pending: pending, updatedAt: ts() });
    await db().ref("admin/withdrawalQueue/" + last.id).update({
      status: "paid",
      paidAt: Date.now()
    });
    toast("Withdrawal " + last.id + " marked PAID");
    return last.id;
  }

  function help() {
    const lines = [
      "VieworaMonoTest.grantEligible()     → 350k views / 650 followers / 120 stories",
      "VieworaMonoTest.enableMonetization()→ users/{uid}.monetizationEnabled = true",
      "VieworaMonoTest.setBalance(75)      → earnings balance $75",
      "VieworaMonoTest.setupPayoutReady()  → all-in-one ready to withdraw",
      "VieworaMonoTest.status()            → print current state",
      "VieworaMonoTest.markLastPaid()      → simulate admin paid",
      "VieworaMonoTest.reset()             → clear test data",
      "VieworaMonoTest.panel()             → toggle on-page buttons"
    ];
    console.log(lines.join("\n"));
    return lines;
  }

  /** Floating test panel on page */
  function panel() {
    var existing = document.getElementById("monoTestPanel");
    if (existing) {
      existing.remove();
      return;
    }
    var box = document.createElement("div");
    box.id = "monoTestPanel";
    box.innerHTML =
      '<div style="font-weight:800;margin-bottom:8px;font-size:12px">Mono Test</div>' +
      '<button type="button" data-a="setup">Setup payout ready</button>' +
      '<button type="button" data-a="eligible">Grant eligible</button>' +
      '<button type="button" data-a="enable">Enable mono</button>' +
      '<button type="button" data-a="bal50">Balance $50</button>' +
      '<button type="button" data-a="bal75">Balance $75</button>' +
      '<button type="button" data-a="status">Status</button>' +
      '<button type="button" data-a="paid">Mark last paid</button>' +
      '<button type="button" data-a="reset">Reset</button>' +
      '<button type="button" data-a="close">Close</button>';
    box.style.cssText =
      "position:fixed;right:12px;bottom:80px;z-index:9999;width:180px;" +
      "background:#12131a;border:1px solid rgba(255,255,255,.12);border-radius:14px;" +
      "padding:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);font-family:Inter,sans-serif;color:#fff";
    var btnCss =
      "display:block;width:100%;margin:4px 0;padding:8px;border-radius:10px;" +
      "border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);" +
      "color:#fff;font-size:11px;font-weight:600;cursor:pointer;text-align:left";
    box.querySelectorAll("button").forEach(function (b) {
      b.style.cssText = btnCss;
      b.addEventListener("click", function () {
        var a = b.getAttribute("data-a");
        if (a === "close") return box.remove();
        if (a === "setup") return setupPayoutReady().catch(err);
        if (a === "eligible") return grantEligible().catch(err);
        if (a === "enable") return enableMonetization(true).catch(err);
        if (a === "bal50") return setBalance(50).catch(err);
        if (a === "bal75") return setBalance(75).catch(err);
        if (a === "status") return status().catch(err);
        if (a === "paid") return markLastPaid().catch(err);
        if (a === "reset") return reset().catch(err);
      });
    });
    document.body.appendChild(box);

    function err(e) {
      console.error(e);
      toast(e.message || "Error");
    }
  }

  window.VieworaMonoTest = {
    help: help,
    grantEligible: grantEligible,
    enableMonetization: enableMonetization,
    setBalance: setBalance,
    setupPayoutReady: setupPayoutReady,
    status: status,
    markLastPaid: markLastPaid,
    reset: reset,
    panel: panel
  };

  // auto panel in non-production hosts
  try {
    var host = location.hostname || "";
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.indexOf("192.168.") === 0 ||
      /test|dev|preview/i.test(host)
    ) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          setTimeout(panel, 600);
        });
      } else {
        setTimeout(panel, 600);
      }
    }
  } catch (_) {}

  log("Loaded. Type VieworaMonoTest.help() or VieworaMonoTest.panel()");
})();
