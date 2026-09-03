/* =========================================================
   VIEWORA — User Monetization
   Eligibility + $50 minimum payout
========================================================= */

"use strict";

(function () {

    const RULES = {
        minViews: 300000,
        minFollowers: 600,
        minStories: 100,
        minPayout: 50
    };

    let currentUser = null;
    let earnings = {
        balance: 0,
        month: 0,
        lifetime: 0,
        pending: 0
    };
    let payoutMethod = null;
    let monetizationEnabled = false;
    let stats = { views: 0, followers: 0, stories: 0 };

    const $ = (id) => document.getElementById(id);

    function formatMoney(n) {
        const v = Number(n) || 0;
        return v.toFixed(2);
    }

    function formatNum(n) {
        const v = Number(n) || 0;
        if (v >= 1000000) return (v / 1000000).toFixed(1).replace(".0", "") + "M";
        if (v >= 1000) return (v / 1000).toFixed(1).replace(".0", "") + "K";
        return String(v);
    }

    function showToast(msg, type) {
        const toast = $("monoToast");
        const text = $("monoToastText");
        if (!toast) return;
        if (text) text.textContent = msg;
        toast.classList.toggle("error", type === "error");
        toast.classList.add("show");
        clearTimeout(window.__monoToast);
        window.__monoToast = setTimeout(() => toast.classList.remove("show"), 2800);
    }

    function openModal(id) {
        const el = $(id);
        if (el) el.classList.remove("hidden");
    }

    function closeModal(id) {
        const el = $(id);
        if (el) el.classList.add("hidden");
    }

    /* -------------------- Stats (same policy as admin) -------------------- */

    async function getCreatorStats(uid) {
        const out = { views: 0, followers: 0, stories: 0 };
        if (!uid || !window.db) return out;

        try {
            const folSnap = await db.ref("followers/" + uid).once("value");
            if (folSnap.exists()) {
                out.followers = Object.keys(folSnap.val() || {}).length;
            }

            const userSnap = await db.ref("users/" + uid).once("value");
            const user = userSnap.val() || {};

            out.followers = Math.max(
                out.followers,
                Number(user.followersCount || user.followerCount || user.followers || 0)
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
                sumViews(posts.val()) +
                sumViews(shorts.val()) +
                sumViews(videos.val());

            if (user.totalViews) {
                out.views = Math.max(out.views, Number(user.totalViews) || 0);
            }

            if (storiesSnap.exists()) {
                out.stories = Object.keys(storiesSnap.val() || {}).length;
            }
            if (user.storiesCount) {
                out.stories = Math.max(out.stories, Number(user.storiesCount) || 0);
            }
        } catch (e) {
            console.error("getCreatorStats", e);
        }

        return out;
    }

    function setReq(id, current, target) {
        const pct = Math.min(100, Math.round((current / target) * 100));
        const done = current >= target;

        const text = $(id + "Text");
        const bar = $(id + "Bar");
        const check = $(id + "Check");
        const item = document.querySelector('[data-req="' + id.replace("req", "").toLowerCase() + '"]');

        // map ids: reqViews -> views
        const map = {
            reqViews: "views",
            reqFollowers: "followers",
            reqStories: "stories"
        };
        const key = map[id] || "";
        const row = key ? document.querySelector('[data-req="' + key + '"]') : null;

        if (text) {
            text.textContent =
                formatNum(current) + " / " + formatNum(target);
        }
        if (bar) bar.style.width = pct + "%";
        if (row) row.classList.toggle("done", done);
        if (check) {
            check.style.opacity = done ? "1" : "0.25";
        }
    }

    function updateEligibilityUI() {
        const viewsOK = stats.views >= RULES.minViews;
        const followersOK = stats.followers >= RULES.minFollowers;
        const storiesOK = stats.stories >= RULES.minStories;
        const eligible = viewsOK && followersOK && storiesOK;

        setReq("reqViews", stats.views, RULES.minViews);
        setReq("reqFollowers", stats.followers, RULES.minFollowers);
        setReq("reqStories", stats.stories, RULES.minStories);

        // manual progress bars (setReq uses fixed ids)
        const map = [
            ["reqViews", stats.views, RULES.minViews],
            ["reqFollowers", stats.followers, RULES.minFollowers],
            ["reqStories", stats.stories, RULES.minStories]
        ];
        map.forEach(([prefix, cur, max]) => {
            const pct = Math.min(100, (cur / max) * 100);
            const text = $(prefix + "Text");
            const bar = $(prefix + "Bar");
            const check = $(prefix + "Check");
            const reqKey = prefix.replace("req", "").toLowerCase();
            const row = document.querySelector('[data-req="' + reqKey + '"]');
            if (text) text.textContent = formatNum(cur) + " / " + formatNum(max);
            if (bar) bar.style.width = pct + "%";
            if (row) row.classList.toggle("done", cur >= max);
            if (check) check.style.color = cur >= max ? "#22c55e" : "#334155";
        });

        const banner = $("eligibleBanner");
        const title = $("eligibleTitle");
        const text = $("eligibleText");
        const pill = $("monoStatusPill");
        const withdrawBtn = $("withdrawBtn");

        if (eligible && monetizationEnabled) {
            banner?.classList.add("ok");
            if (title) title.textContent = "Monetization active";
            if (text) text.textContent = "You meet all requirements and payouts are enabled.";
            if (pill) {
                pill.textContent = "Active";
                pill.className = "statusPill active";
            }
        } else if (eligible && !monetizationEnabled) {
            banner?.classList.add("ok");
            if (title) title.textContent = "Eligible — waiting for review";
            if (text) {
                text.textContent =
                    "You meet the policy. Admin will enable monetization soon.";
            }
            if (pill) {
                pill.textContent = "Eligible";
                pill.className = "statusPill pending";
            }
        } else {
            banner?.classList.remove("ok");
            if (title) title.textContent = "Not eligible yet";
            if (text) {
                text.textContent =
                    "Complete all requirements to unlock monetization.";
            }
            if (pill) {
                pill.textContent = "Locked";
                pill.className = "statusPill locked";
            }
        }

        const canWithdraw =
            monetizationEnabled &&
            Number(earnings.balance) >= RULES.minPayout &&
            !!payoutMethod?.value;

        if (withdrawBtn) {
            withdrawBtn.disabled = !canWithdraw;
        }

        const hint = $("balanceHint");
        if (hint) {
            if (!monetizationEnabled) {
                hint.textContent = "Monetization not enabled yet";
            } else if (Number(earnings.balance) < RULES.minPayout) {
                hint.textContent =
                    "Need $" +
                    formatMoney(RULES.minPayout - earnings.balance) +
                    " more to reach $50 minimum";
            } else if (!payoutMethod?.value) {
                hint.textContent = "Add a payout method to withdraw";
            } else {
                hint.textContent = "You can request a payout of $" + formatMoney(earnings.balance);
            }
        }
    }

    /* -------------------- Load user data -------------------- */

    async function loadEarnings(uid) {
        try {
            const snap = await db.ref("earnings/" + uid).once("value");
            const data = snap.val() || {};
            earnings = {
                balance: Number(data.balance || 0),
                month: Number(data.month || data.thisMonth || 0),
                lifetime: Number(data.lifetime || data.totalEarned || 0),
                pending: Number(data.pending || 0)
            };
        } catch (e) {
            console.warn(e);
            earnings = { balance: 0, month: 0, lifetime: 0, pending: 0 };
        }

        $("balanceValue") && ($("balanceValue").textContent = formatMoney(earnings.balance));
        $("monthEarn") && ($("monthEarn").textContent = "$" + formatMoney(earnings.month));
        $("lifetimeEarn") && ($("lifetimeEarn").textContent = "$" + formatMoney(earnings.lifetime));
        $("pendingEarn") && ($("pendingEarn").textContent = "$" + formatMoney(earnings.pending));
    }

    async function loadPayoutMethod(uid) {
        try {
            const snap = await db.ref("payoutMethods/" + uid).once("value");
            payoutMethod = snap.exists() ? snap.val() : null;
        } catch (e) {
            payoutMethod = null;
        }

        const title = $("methodTitle");
        const sub = $("methodSub");
        if (payoutMethod && payoutMethod.value) {
            if (title) title.textContent = (payoutMethod.type || "Method").toUpperCase();
            if (sub) {
                const v = String(payoutMethod.value);
                sub.textContent =
                    (payoutMethod.name ? payoutMethod.name + " · " : "") +
                    (v.length > 22 ? v.slice(0, 10) + "…" + v.slice(-6) : v);
            }
        } else {
            if (title) title.textContent = "Add payout method";
            if (sub) sub.textContent = "UPI · Bank · PayPal";
        }
    }

    async function loadUserFlags(uid) {
        try {
            const snap = await db.ref("users/" + uid).once("value");
            const user = snap.val() || {};
            monetizationEnabled = user.monetizationEnabled === true;
        } catch (e) {
            monetizationEnabled = false;
        }
    }

    /* -------------------- Withdraw -------------------- */

    function openWithdraw() {
        if (!monetizationEnabled) {
            showToast("Monetization is not active yet", "error");
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
        if (amount) amount.value = formatMoney(earnings.balance);
        const err = $("withdrawError");
        if (err) {
            err.classList.add("hidden");
            err.textContent = "";
        }
        openModal("withdrawModal");
    }

    async function submitWithdraw() {
        if (!currentUser) return;

        const amount = Number(earnings.balance);
        if (amount < RULES.minPayout) {
            showToast("Minimum is $50", "error");
            return;
        }

        const note = ($("withdrawNote")?.value || "").trim();
        const btn = $("confirmWithdrawBtn");
        if (btn) btn.disabled = true;

        try {
            const ref = db.ref("withdrawals").push();
            const payload = {
                id: ref.key,
                uid: currentUser.uid,
                amount: amount,
                currency: "USD",
                status: "pending",
                note: note || "",
                method: payoutMethod || {},
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };

            await ref.set(payload);

            /* Move balance → pending */
            const earnRef = db.ref("earnings/" + currentUser.uid);
            const earnSnap = await earnRef.once("value");
            const cur = earnSnap.val() || {};
            const newBalance = 0;
            const newPending = Number(cur.pending || 0) + amount;

            await earnRef.update({
                balance: newBalance,
                pending: newPending,
                lastWithdrawAt: firebase.database.ServerValue.TIMESTAMP
            });

            /* Mirror under user for quick admin list */
            await db.ref("users/" + currentUser.uid + "/lastWithdrawal").set({
                id: ref.key,
                amount,
                status: "pending",
                at: firebase.database.ServerValue.TIMESTAMP
            });

            earnings.balance = 0;
            earnings.pending = newPending;
            $("balanceValue").textContent = formatMoney(0);
            $("pendingEarn").textContent = "$" + formatMoney(newPending);

            closeModal("withdrawModal");
            showToast("Payout request submitted");
            updateEligibilityUI();
        } catch (e) {
            console.error(e);
            showToast(e.message || "Request failed", "error");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /* -------------------- Method -------------------- */

    async function saveMethod() {
        if (!currentUser) return;

        const type = $("methodType")?.value || "upi";
        const value = ($("methodValue")?.value || "").trim();
        const name = ($("methodName")?.value || "").trim();

        if (!value) {
            showToast("Enter account / UPI / email", "error");
            return;
        }

        const payload = {
            type,
            value,
            name,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };

        try {
            await db.ref("payoutMethods/" + currentUser.uid).set(payload);
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

    /* -------------------- History -------------------- */

    async function loadHistory() {
        const list = $("historyList");
        if (!list || !currentUser) return;

        list.innerHTML = '<div class="emptyHistory">Loading…</div>';

        try {
            const snap = await db
                .ref("withdrawals")
                .orderByChild("uid")
                .equalTo(currentUser.uid)
                .once("value");

            const rows = [];
            snap.forEach((child) => {
                rows.push({ id: child.key, ...(child.val() || {}) });
            });

            rows.sort(
                (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
            );

            if (!rows.length) {
                list.innerHTML = '<div class="emptyHistory">No payouts yet</div>';
                return;
            }

            list.innerHTML = rows
                .map((r) => {
                    const status = String(r.status || "pending").toLowerCase();
                    const date = r.createdAt
                        ? new Date(r.createdAt).toLocaleDateString()
                        : "—";
                    return `
                        <div class="historyItem">
                            <div>
                                <strong>$${formatMoney(r.amount)}</strong>
                                <small>${date}${r.note ? " · " + escapeHtml(r.note) : ""}</small>
                            </div>
                            <span class="historyBadge ${status}">${status}</span>
                        </div>
                    `;
                })
                .join("");
        } catch (e) {
            console.error(e);
            list.innerHTML = '<div class="emptyHistory">Could not load history</div>';
        }
    }

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /* -------------------- Init -------------------- */

    function wireUI() {
        $("backBtn")?.addEventListener("click", () => {
            if (history.length > 1) history.back();
            else location.href = "settings.html";
        });

        $("withdrawBtn")?.addEventListener("click", openWithdraw);
        $("confirmWithdrawBtn")?.addEventListener("click", submitWithdraw);
        $("paymentMethodBtn")?.addEventListener("click", () => {
            if (payoutMethod) {
                if ($("methodType")) $("methodType").value = payoutMethod.type || "upi";
                if ($("methodValue")) $("methodValue").value = payoutMethod.value || "";
                if ($("methodName")) $("methodName").value = payoutMethod.name || "";
            }
            openModal("methodModal");
        });
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

        if (!window.auth || !window.db) {
            showToast("Firebase not ready", "error");
            return;
        }

        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                location.href = "login.html";
                return;
            }
            currentUser = user;

            await Promise.all([
                loadUserFlags(user.uid),
                loadEarnings(user.uid),
                loadPayoutMethod(user.uid)
            ]);

            stats = await getCreatorStats(user.uid);
            updateEligibilityUI();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

})();
