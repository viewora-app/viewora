/* =========================================================
   VIEWORA — Monetization + Withdrawal (95%)
   Eligibility · Apply · Balance · Payout methods · History
========================================================= */
"use strict";

(function () {
  const RULES = {
    minViews: 300000,
    minFollowers: 600,
    minStories: 100,
    minPayout: 50, // USD
    maxPendingWithdrawals: 1
  };

  // Approx creator share display only (admin credits real balance)
  const EST_CPM_USD = 0.4; // $0.40 per 1000 views estimate

  function getAuth() {
    if (window.auth) return window.auth;
    try {
      return firebase.auth();
    } catch (_) {
      return null;
    }
  }
  function getDb() {
    if (window.db) return window.db;
    try {
      return firebase.database();
    } catch (_) {
      return null;
    }
  }
  function serverTs() {
    try {
      return firebase.database.ServerValue.TIMESTAMP;
    } catch (_) {
      return Date.now();
    }
  }

  let currentUser = null;
  let earnings = { balance: 0, month: 0, lifetime: 0, pending: 0 };
  let payoutMethod = null;
  let monetizationEnabled = false;
  let monetizationRequested = false;
  let stats = { views: 0, followers: 0, stories: 0 };
  let pendingWithdrawCount = 0;

  const $ = (id) => document.getElementById(id);

  function formatMoney(n) {
    return (Number(n) || 0).toFixed(2);
  }
  function formatNum(n) {
    const v = Number(n) || 0;
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(Math.floor(v));
  }
  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg, type) {
    const toast = $("monoToast");
    const text = $("monoToastText");
    if (!toast) return;
    if (text) text.textContent = msg;
    toast.classList.toggle("error", type === "error");
    toast.classList.add("show");
    clearTimeout(window.__monoToast);
    window.__monoToast = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function openModal(id) {
    $(id)?.classList.remove("hidden");
  }
  function closeModal(id) {
    $(id)?.classList.add("hidden");
  }

  /* -------------------- Creator stats -------------------- */

  async function getCreatorStats(uid) {
    const out = { views: 0, followers: 0, stories: 0 };
    const db = getDb();
    if (!uid || !db) return out;

    try {
      const folSnap = await db.ref("followers/" + uid).once("value");
      if (folSnap.exists()) out.followers = Object.keys(folSnap.val() || {}).length;

      const userSnap = await db.ref("users/" + uid).once("value");
      const user = userSnap.val() || {};

      const fc = user.followersCount || user.followerCount || user.followers || 0;
      out.followers = Math.max(
        out.followers,
        typeof fc === "object" ? Object.keys(fc || {}).length : Number(fc) || 0
      );

      const sumViews = (obj) => {
        let total = 0;
        Object.values(obj || {}).forEach((item) => {
          if (!item || typeof item !== "object") return;
          const owner =
            item.uid || item.userId || item.ownerId || item.creatorId || "";
          if (String(owner) !== String(uid)) return;
          total += Number(item.views || item.viewCount || 0);
        });
        return total;
      };

      const [posts, shorts, videos, storiesSnap] = await Promise.all([
        db.ref("posts").once("value"),
        db.ref("shorts").once("value"),
        db.ref("videos").once("value"),
        db.ref("stories").orderByChild("uid").equalTo(uid).once("value")
      ]);

      out.views =
        sumViews(posts.val()) + sumViews(shorts.val()) + sumViews(videos.val());

      if (user.totalViews) out.views = Math.max(out.views, Number(user.totalViews) || 0);

      if (storiesSnap.exists()) out.stories = Object.keys(storiesSnap.val() || {}).length;
      if (user.storiesCount) out.stories = Math.max(out.stories, Number(user.storiesCount) || 0);
    } catch (e) {
      console.error("getCreatorStats", e);
    }
    return out;
  }

  function isEligible() {
    return (
      stats.views >= RULES.minViews &&
      stats.followers >= RULES.minFollowers &&
      stats.stories >= RULES.minStories
    );
  }

  function updateEligibilityUI() {
    const eligible = isEligible();
    const map = [
      ["reqViews", stats.views, RULES.minViews, "views"],
      ["reqFollowers", stats.followers, RULES.minFollowers, "followers"],
      ["reqStories", stats.stories, RULES.minStories, "stories"]
    ];
    map.forEach(([prefix, cur, max, key]) => {
      const pct = Math.min(100, (cur / max) * 100);
      const text = $(prefix + "Text");
      const bar = $(prefix + "Bar");
      const check = $(prefix + "Check");
      const row = document.querySelector('[data-req="' + key + '"]');
      if (text) text.textContent = formatNum(cur) + " / " + formatNum(max);
      if (bar) bar.style.width = pct + "%";
      if (row) row.classList.toggle("done", cur >= max);
      if (check) check.style.color = cur >= max ? "#22c55e" : "#334155";
    });

    const banner = $("eligibleBanner");
    const title = $("eligibleTitle");
    const text = $("eligibleText");
    const pill = $("monoStatusPill");
    const applyBtn = $("applyMonoBtn");
    const withdrawBtn = $("withdrawBtn");

    if (monetizationEnabled) {
      banner?.classList.add("ok");
      if (title) title.textContent = "Monetization active";
      if (text) text.textContent = "Payouts enabled. Keep posting quality content.";
      if (pill) {
        pill.textContent = "Active";
        pill.className = "statusPill active";
      }
      if (applyBtn) applyBtn.classList.add("hidden");
    } else if (eligible && monetizationRequested) {
      banner?.classList.add("ok");
      if (title) title.textContent = "Application under review";
      if (text) text.textContent = "Admin will review and enable monetization soon.";
      if (pill) {
        pill.textContent = "Pending";
        pill.className = "statusPill pending";
      }
      if (applyBtn) {
        applyBtn.classList.remove("hidden");
        applyBtn.disabled = true;
        applyBtn.textContent = "Application sent";
      }
    } else if (eligible) {
      banner?.classList.add("ok");
      if (title) title.textContent = "You are eligible!";
      if (text) text.textContent = "Apply now so admin can enable monetization.";
      if (pill) {
        pill.textContent = "Eligible";
        pill.className = "statusPill pending";
      }
      if (applyBtn) {
        applyBtn.classList.remove("hidden");
        applyBtn.disabled = false;
        applyBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Apply for monetization';
      }
    } else {
      banner?.classList.remove("ok");
      if (title) title.textContent = "Not eligible yet";
      if (text) text.textContent = "Complete all requirements to unlock monetization.";
      if (pill) {
        pill.textContent = "Locked";
        pill.className = "statusPill locked";
      }
      if (applyBtn) applyBtn.classList.add("hidden");
    }

    const canWithdraw =
      monetizationEnabled &&
      Number(earnings.balance) >= RULES.minPayout &&
      !!payoutMethod?.value &&
      pendingWithdrawCount < RULES.maxPendingWithdrawals;

    if (withdrawBtn) withdrawBtn.disabled = !canWithdraw;

    const hint = $("balanceHint");
    if (hint) {
      if (!monetizationEnabled) hint.textContent = "Monetization not enabled yet";
      else if (pendingWithdrawCount >= RULES.maxPendingWithdrawals)
        hint.textContent = "A payout request is already pending";
      else if (Number(earnings.balance) < RULES.minPayout)
        hint.textContent =
          "Need $" +
          formatMoney(RULES.minPayout - earnings.balance) +
          " more to reach $50 minimum";
      else if (!payoutMethod?.value) hint.textContent = "Add a payout method to withdraw";
      else hint.textContent = "You can request a payout";
    }

    // Estimate box
    const est = $("estEarn");
    if (est) {
      const e = (stats.views / 1000) * EST_CPM_USD;
      est.textContent = "~$" + formatMoney(e);
    }
  }

  /* -------------------- Load data -------------------- */

  async function loadEarnings(uid) {
    try {
      const snap = await getDb().ref("earnings/" + uid).once("value");
      const data = snap.val() || {};
      earnings = {
        balance: Number(data.balance || 0),
        month: Number(data.month || data.thisMonth || 0),
        lifetime: Number(data.lifetime || data.totalEarned || 0),
        pending: Number(data.pending || 0)
      };
    } catch (_) {
      earnings = { balance: 0, month: 0, lifetime: 0, pending: 0 };
    }
    paintEarnings();
  }

  function paintEarnings() {
    if ($("balanceValue")) $("balanceValue").textContent = formatMoney(earnings.balance);
    if ($("monthEarn")) $("monthEarn").textContent = "$" + formatMoney(earnings.month);
    if ($("lifetimeEarn")) $("lifetimeEarn").textContent = "$" + formatMoney(earnings.lifetime);
    if ($("pendingEarn")) $("pendingEarn").textContent = "$" + formatMoney(earnings.pending);
  }

  async function loadPayoutMethod(uid) {
    try {
      const snap = await getDb().ref("payoutMethods/" + uid).once("value");
      payoutMethod = snap.exists() ? snap.val() : null;
    } catch (_) {
      payoutMethod = null;
    }
    const title = $("methodTitle");
    const sub = $("methodSub");
    if (payoutMethod && payoutMethod.value) {
      if (title) title.textContent = String(payoutMethod.type || "Method").toUpperCase();
      if (sub) {
        const v = String(payoutMethod.value);
        sub.textContent =
          (payoutMethod.name ? payoutMethod.name + " · " : "") +
          (v.length > 24 ? v.slice(0, 10) + "…" + v.slice(-6) : v);
      }
    } else {
      if (title) title.textContent = "Add payout method";
      if (sub) sub.textContent = "UPI · Bank · PayPal";
    }
  }

  async function loadUserFlags(uid) {
    try {
      const snap = await getDb().ref("users/" + uid).once("value");
      const user = snap.val() || {};
      monetizationEnabled = user.monetizationEnabled === true;
      monetizationRequested =
        user.monetizationRequested === true ||
        user.monetizationStatus === "pending";
    } catch (_) {
      monetizationEnabled = false;
      monetizationRequested = false;
    }
  }

  async function countPendingWithdrawals(uid) {
    pendingWithdrawCount = 0;
    try {
      const snap = await getDb()
        .ref("withdrawals")
        .orderByChild("uid")
        .equalTo(uid)
        .once("value");
      snap.forEach((c) => {
        const s = String((c.val() || {}).status || "").toLowerCase();
        if (s === "pending" || s === "processing") pendingWithdrawCount++;
      });
    } catch (_) {}
  }

  /* -------------------- Apply monetization -------------------- */

  async function applyMonetization() {
    if (!currentUser || !isEligible()) {
      showToast("Complete eligibility first", "error");
      return;
    }
    if (monetizationEnabled) {
      showToast("Already enabled");
      return;
    }
    if (monetizationRequested) {
      showToast("Application already sent");
      return;
    }
    const db = getDb();
    const btn = $("applyMonoBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending…";
    }
    try {
      const payload = {
        uid: currentUser.uid,
        status: "pending",
        views: stats.views,
        followers: stats.followers,
        stories: stats.stories,
        email: currentUser.email || "",
        displayName: currentUser.displayName || "",
        createdAt: serverTs()
      };
      const ref = db.ref("admin/monetizationRequests").push();
      await ref.set({ ...payload, id: ref.key });
      await db.ref("users/" + currentUser.uid).update({
        monetizationRequested: true,
        monetizationStatus: "pending",
        monetizationRequestedAt: serverTs()
      });
      monetizationRequested = true;
      showToast("Application submitted to admin");
      updateEligibilityUI();
    } catch (e) {
      console.error(e);
      showToast("Could not apply", "error");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Apply for monetization';
      }
    }
  }

  /* -------------------- Method validation -------------------- */

  function validateMethod(type, value) {
    const v = String(value || "").trim();
    if (!v) return "Enter account details";
    if (type === "upi") {
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v)) return "Enter valid UPI ID (name@bank)";
    } else if (type === "paypal") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter valid PayPal email";
    } else if (type === "bank") {
      if (v.length < 8) return "Enter full account number / IBAN";
    }
    return "";
  }

  async function saveMethod() {
    if (!currentUser) return;
    const type = $("methodType")?.value || "upi";
    const value = ($("methodValue")?.value || "").trim();
    const name = ($("methodName")?.value || "").trim();
    const ifsc = ($("methodIfsc")?.value || "").trim();

    const err = validateMethod(type, value);
    if (err) {
      showToast(err, "error");
      return;
    }
    if (type === "bank" && ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) {
      showToast("Invalid IFSC code", "error");
      return;
    }

    const payload = {
      type,
      value,
      name,
      ifsc: type === "bank" ? ifsc.toUpperCase() : "",
      updatedAt: serverTs()
    };

    try {
      await getDb().ref("payoutMethods/" + currentUser.uid).set(payload);
      payoutMethod = payload;
      closeModal("methodModal");
      await loadPayoutMethod(currentUser.uid);
      updateEligibilityUI();
      showToast("Payout method saved");
    } catch (e) {
      console.error(e);
      showToast("Could not save method", "error");
    }
  }

  /* -------------------- Withdraw -------------------- */

  function openWithdraw() {
    if (!monetizationEnabled) {
      showToast("Monetization is not active yet", "error");
      return;
    }
    if (pendingWithdrawCount >= RULES.maxPendingWithdrawals) {
      showToast("You already have a pending payout", "error");
      return;
    }
    if (Number(earnings.balance) < RULES.minPayout) {
      showToast("Minimum payout is $50", "error");
      return;
    }
    if (!payoutMethod?.value) {
      showToast("Add a payout method first", "error");
      openModal("methodModal");
      return;
    }

    const amount = $("withdrawAmount");
    if (amount) {
      amount.min = RULES.minPayout;
      amount.max = earnings.balance;
      amount.value = formatMoney(earnings.balance);
      amount.readOnly = false;
    }
    const maxLabel = $("withdrawMaxLabel");
    if (maxLabel) maxLabel.textContent = "Available: $" + formatMoney(earnings.balance);
    const err = $("withdrawError");
    if (err) {
      err.classList.add("hidden");
      err.textContent = "";
    }
    const methodPreview = $("withdrawMethodPreview");
    if (methodPreview && payoutMethod) {
      methodPreview.textContent =
        String(payoutMethod.type || "").toUpperCase() +
        " · " +
        String(payoutMethod.value || "");
    }
    openModal("withdrawModal");
  }

  async function submitWithdraw() {
    if (!currentUser) return;
    const db = getDb();
    if (!db) {
      showToast("Database unavailable", "error");
      return;
    }

    let amount = Number($("withdrawAmount")?.value || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    amount = Math.round(amount * 100) / 100;

    if (amount < RULES.minPayout) {
      showToast("Minimum is $50", "error");
      return;
    }
    if (!payoutMethod || !payoutMethod.value) {
      showToast("Add a payout method first", "error");
      return;
    }

    const note = (($("withdrawNote") && $("withdrawNote").value) || "").trim();
    const btn = $("confirmWithdrawBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting…";
    }

    try {
      await countPendingWithdrawals(currentUser.uid);
      if (pendingWithdrawCount >= RULES.maxPendingWithdrawals) {
        showToast("A payout is already pending", "error");
        return;
      }

      const earnRef = db.ref("earnings/" + currentUser.uid);
      const earnSnap = await earnRef.once("value");
      const cur = earnSnap.val() || {};
      const liveBalance = Number(cur.balance || 0);

      if (liveBalance < RULES.minPayout) {
        showToast("Balance below $50 minimum", "error");
        return;
      }
      if (amount > liveBalance) {
        showToast("Amount exceeds available balance", "error");
        return;
      }

      const ref = db.ref("withdrawals").push();
      const payload = {
        id: ref.key,
        uid: currentUser.uid,
        amount: amount,
        currency: "USD",
        status: "pending",
        note: note || "",
        method: {
          type: payoutMethod.type || "",
          value: payoutMethod.value || "",
          name: payoutMethod.name || "",
          ifsc: payoutMethod.ifsc || ""
        },
        displayName: currentUser.displayName || "",
        email: currentUser.email || "",
        createdAt: serverTs(),
        updatedAt: serverTs()
      };

      await ref.set(payload);

      const newBalance = Math.round((liveBalance - amount) * 100) / 100;
      const newPending = Number(cur.pending || 0) + amount;
      await earnRef.update({
        balance: newBalance,
        pending: newPending,
        lastWithdrawAt: serverTs(),
        lastWithdrawId: ref.key
      });

      await db.ref("users/" + currentUser.uid + "/lastWithdrawal").set({
        id: ref.key,
        amount: amount,
        status: "pending",
        at: serverTs()
      });

      await db.ref("admin/withdrawalQueue/" + ref.key).set({
        uid: currentUser.uid,
        amount: amount,
        status: "pending",
        methodType: payoutMethod.type || "",
        createdAt: Date.now()
      });

      earnings.balance = newBalance;
      earnings.pending = newPending;
      pendingWithdrawCount++;
      paintEarnings();
      closeModal("withdrawModal");
      showToast("Payout request submitted — wait for admin");
      updateEligibilityUI();
    } catch (e) {
      console.error(e);
      showToast(e.message || "Request failed", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "Submit request";
      }
    }
  }

  /* -------------------- History -------------------- */

  async function loadHistory() {
    const list = $("historyList");
    if (!list || !currentUser) return;
    list.innerHTML = '<div class="emptyHistory">Loading…</div>';

    try {
      const snap = await getDb()
        .ref("withdrawals")
        .orderByChild("uid")
        .equalTo(currentUser.uid)
        .once("value");

      const rows = [];
      snap.forEach((child) => rows.push({ id: child.key, ...(child.val() || {}) }));
      rows.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

      if (!rows.length) {
        list.innerHTML = '<div class="emptyHistory">No payouts yet</div>';
        return;
      }

      list.innerHTML = rows
        .map((r) => {
          const status = String(r.status || "pending").toLowerCase();
          const date = r.createdAt ? new Date(r.createdAt).toLocaleString() : "—";
          const method = r.method
            ? String(r.method.type || "").toUpperCase()
            : "";
          return `
            <div class="historyItem">
              <div>
                <strong>$${formatMoney(r.amount)}</strong>
                <small>${escapeHtml(date)}${method ? " · " + escapeHtml(method) : ""}${
            r.note ? " · " + escapeHtml(r.note) : ""
          }</small>
              </div>
              <span class="historyBadge ${status}">${status}</span>
            </div>`;
        })
        .join("");
    } catch (e) {
      console.error(e);
      list.innerHTML = '<div class="emptyHistory">Could not load history</div>';
    }
  }

  /* -------------------- Method type UI -------------------- */

  function onMethodTypeChange() {
    const type = $("methodType")?.value || "upi";
    const ifscWrap = $("ifscField");
    const valueInput = $("methodValue");
    if (ifscWrap) ifscWrap.classList.toggle("hidden", type !== "bank");
    if (valueInput) {
      valueInput.placeholder =
        type === "upi"
          ? "name@upi"
          : type === "paypal"
            ? "email@example.com"
            : "Account number";
    }
  }

  /* -------------------- Wire + start -------------------- */

  function wireUI() {
    $("backBtn")?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = "settings.html";
    });

    $("withdrawBtn")?.addEventListener("click", openWithdraw);
    $("confirmWithdrawBtn")?.addEventListener("click", submitWithdraw);
    $("applyMonoBtn")?.addEventListener("click", applyMonetization);
    $("paymentMethodBtn")?.addEventListener("click", () => {
      if (payoutMethod) {
        if ($("methodType")) $("methodType").value = payoutMethod.type || "upi";
        if ($("methodValue")) $("methodValue").value = payoutMethod.value || "";
        if ($("methodName")) $("methodName").value = payoutMethod.name || "";
        if ($("methodIfsc")) $("methodIfsc").value = payoutMethod.ifsc || "";
      }
      onMethodTypeChange();
      openModal("methodModal");
    });
    $("methodType")?.addEventListener("change", onMethodTypeChange);
    $("saveMethodBtn")?.addEventListener("click", saveMethod);
    $("historyBtn")?.addEventListener("click", async () => {
      openModal("historyModal");
      await loadHistory();
    });

    document.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => {
        const modal = el.closest(".monoModal");
        if (modal) modal.classList.add("hidden");
      });
    });
  }

  async function start() {
    wireUI();
    const auth = getAuth();
    const database = getDb();
    if (!auth || !database) {
      showToast("Firebase not ready", "error");
      return;
    }
    window.db = database;
    window.auth = auth;

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        location.href = "login.html";
        return;
      }
      currentUser = user;

      await Promise.all([
        loadUserFlags(user.uid),
        loadEarnings(user.uid),
        loadPayoutMethod(user.uid),
        countPendingWithdrawals(user.uid)
      ]);

      stats = await getCreatorStats(user.uid);
      updateEligibilityUI();

      database.ref("earnings/" + user.uid).on("value", (snap) => {
        const data = snap.val() || {};
        earnings = {
          balance: Number(data.balance || 0),
          month: Number(data.month || data.thisMonth || 0),
          lifetime: Number(data.lifetime || data.totalEarned || 0),
          pending: Number(data.pending || 0)
        };
        paintEarnings();
        updateEligibilityUI();
      });

      // Live withdrawal status
      database
        .ref("withdrawals")
        .orderByChild("uid")
        .equalTo(user.uid)
        .on("value", () => {
          countPendingWithdrawals(user.uid).then(updateEligibilityUI);
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
