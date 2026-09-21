"use strict";

/*
============================================================
 VIEWORA BADGES — Single source of truth
 Hierarchy (highest first):
   1. RED  — Elite / most expensive active subscription (VIP)
   2. BLUE — Creator / influencer (admin) OR any active paid subscription
   3. WHITE — Monetized + 1L+ followers (or strong views)
              ONLY if no red and no blue
   4. NONE — normal user

 Rules:
   • Subscription active + Elite  → RED
   • Subscription active (Plus/Pro) OR admin creator → BLUE
   • Creator with 1L followers + subscription → BLUE (not white)
   • After subscription ends, still 1L followers + monetized → WHITE
   • Nothing → no tick
============================================================
*/

(function (global) {

    const FOLLOWERS_WHITE_MIN = 100000; // 1 lakh
    const VIEWS_WHITE_MIN = 300000;    // 3 lakh soft

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function subObj(user) {
        if (!user || typeof user !== "object") return {};
        if (user.subscription && typeof user.subscription === "object") {
            return user.subscription;
        }
        return {};
    }

    function subActive(user) {
        const sub = subObj(user);
        if (sub.active === true || sub.status === "active") {
            const exp = num(sub.expiresAt);
            if (exp > 0 && exp < Date.now()) return false;
            return true;
        }
        if (user.subscriptionActive === true || user.subscriptionStatus === "active") {
            const exp = num(user.subscriptionExpiresAt || sub.expiresAt);
            if (exp > 0 && exp < Date.now()) return false;
            return true;
        }
        if (user.premium === true || user.isPremium === true) {
            const exp = num(sub.expiresAt || user.subscriptionExpiresAt);
            if (exp > 0 && exp < Date.now()) return false;
            // premium flag without expiry → treat active carefully
            if (sub.plan || user.plan) return true;
        }
        return false;
    }

    function planOf(user) {
        const sub = subObj(user);
        if (subActive(user)) {
            return String(sub.plan || user.plan || "").toLowerCase();
        }
        return "";
    }

    /** Admin / creator blue from panel (not auto from followers) */
    function hasAdminBlue(user) {
        if (!user || typeof user !== "object") return false;
        const tt = String(user.tickType || "").toLowerCase();
        if (tt === "red" || tt === "white" || tt === "none") return false;

        if (
            user.blueTick === true ||
            user.verified === true ||
            user.isVerified === true ||
            user.verification === true
        ) {
            return true;
        }
        const status = String(
            user.verificationStatus ||
            user.badge ||
            ""
        ).toLowerCase();
        // role alone (influencer) must NOT force blue — admin uses tickType/redTick
        return (
            status === "verified" ||
            status === "creator"
        );
    }

    /** RED: Admin grant OR Elite VIP subscription */
    function hasRed(user) {
        if (!user || typeof user !== "object") return false;

        const tt = String(user.tickType || user.badge || "").toLowerCase();
        // Admin panel grant always wins
        if (
            user.redTickForce === true ||
            user.redTick === true ||
            tt === "red" ||
            tt === "vip"
        ) {
            return true;
        }

        if (user.vip === true || user.elite === true) {
            const plan = planOf(user);
            if (plan === "elite" && subActive(user)) return true;
            // vip/elite flags without active elite plan — still show red if explicit
            if (user.redTick === true) return true;
        }

        const plan = planOf(user);
        if (plan === "elite" && subActive(user)) return true;

        return false;
    }

    /** BLUE: Admin grant / creator OR active paid plan (plus/pro) */
    function hasBlue(user) {
        if (!user || typeof user !== "object") return false;
        if (hasRed(user)) return false;

        const tt = String(user.tickType || user.badge || "").toLowerCase();
        if (tt === "white") return false; // exclusive white
        if (tt === "blue" || user.blueTick === true) return true;

        if (hasAdminBlue(user)) return true;

        if (!subActive(user)) return false;
        const plan = planOf(user);
        if (plan === "plus" || plan === "pro" || plan === "elite") return true;
        if (user.premium === true || user.isPremium === true) return true;
        return false;
    }

    /** WHITE: Admin grant OR monetized + scale — never if red/blue */
    function hasWhite(user) {
        if (!user || typeof user !== "object") return false;
        // Red / blue always win
        if (hasRed(user)) return false;

        const tt = String(user.tickType || user.badge || "").toLowerCase();
        // If admin granted blue, not white
        if (tt === "blue" || user.blueTick === true) {
            // only skip white if still blue-level
            if (hasBlue(user)) return false;
        } else if (hasBlue(user)) {
            return false;
        }

        // Admin white grant always shows (when not red/blue)
        if (
            user.whiteTickForce === true ||
            user.whiteTick === true ||
            tt === "white"
        ) {
            return true;
        }

        const followers =
            num(user.followers) ||
            num(user.followersCount) ||
            num(user.followerCount) ||
            0;
        const views =
            num(user.totalViews) ||
            num(user.views) ||
            num(user.viewCount) ||
            0;
        const monetized =
            user.monetizationEnabled === true ||
            user.monetizationStatus === "active" ||
            user.monetized === true;

        if (followers >= FOLLOWERS_WHITE_MIN) {
            if (monetized || user.whiteTick === true) return true;
            return true;
        }

        if (monetized && views >= VIEWS_WHITE_MIN) return true;

        return false;
    }

    function resolve(user) {
        if (!user || typeof user !== "object") {
            return { level: "none", html: "", className: "", title: "", color: "" };
        }

        if (hasRed(user)) {
            return {
                level: "red",
                html: '<i class="fa-solid fa-certificate vieworaTick redTick" title="VIP Elite" aria-label="VIP"></i>',
                className: "redTick",
                title: "VIP Elite",
                color: "#ff3b5c"
            };
        }

        if (hasBlue(user)) {
            return {
                level: "blue",
                html: '<i class="fa-solid fa-circle-check vieworaTick blueTick verifiedTick" title="Verified" aria-label="Verified"></i>',
                className: "blueTick",
                title: "Verified",
                color: "#1d9bf0"
            };
        }

        if (hasWhite(user)) {
            return {
                level: "white",
                html: '<i class="fa-solid fa-circle-check vieworaTick whiteTick" title="Monetized creator" aria-label="Monetized"></i>',
                className: "whiteTick",
                title: "Monetized creator",
                color: "#e8eef7"
            };
        }

        return { level: "none", html: "", className: "", title: "", color: "" };
    }

    function isVerified(user) {
        const r = resolve(user);
        return r.level === "red" || r.level === "blue" || r.level === "white";
    }

    async function applySubscriptionBadges(uid, payload) {
        if (!uid || !payload) return;
        if (typeof firebase === "undefined" || !firebase.database) return;

        const plan = String(payload.plan || "").toLowerCase();
        const active = payload.status === "active" || payload.active === true;
        const cycle = String(payload.billingCycle || payload.cycle || "monthly").toLowerCase();

        const updates = {
            premium: active,
            isPremium: active,
            plan: plan,
            subscriptionActive: active,
            subscriptionStatus: active ? "active" : "inactive",
            "subscription/plan": plan,
            "subscription/status": active ? "active" : "inactive",
            "subscription/active": active,
            "subscription/billingCycle": cycle,
            "subscription/expiresAt": payload.expiresAt || null,
            "subscription/startedAt": payload.startedAt || Date.now(),
            updatedAt: Date.now()
        };

        if (!active) {
            updates.redTick = false;
            updates.vip = false;
            updates.elite = false;
            // Keep admin blueTick / verified if admin granted
            // Do NOT clear blueTick if verificationStatus is creator
            // White may reappear via hasWhite based on followers
        } else if (plan === "elite") {
            updates.redTick = true;
            updates.vip = true;
            updates.elite = true;
            updates.verified = true;
            updates.isVerified = true;
            updates.blueTick = true;
            updates.verificationStatus = "verified";
        } else {
            // plus / pro → blue
            updates.redTick = false;
            updates.vip = false;
            updates.elite = false;
            updates.verified = true;
            updates.isVerified = true;
            updates.blueTick = true;
            updates.verificationStatus = "verified";
        }

        try {
            await firebase.database().ref("users/" + uid).update(updates);
        } catch (e) {
            console.warn("Badge apply failed:", e);
        }
    }

    function injectBadgeCSS() {
        if (document.getElementById("vieworaBadgeCSS")) return;
        const s = document.createElement("style");
        s.id = "vieworaBadgeCSS";
        s.textContent = `
            .vieworaTick, .verifiedTick, .redTick, .blueTick, .whiteTick {
                display: inline-flex !important;
                align-items: center;
                justify-content: center;
                margin-left: 4px;
                vertical-align: middle;
                line-height: 1;
                font-size: 0.9em;
            }
            .vieworaTick.redTick, .redTick, i.redTick {
                color: #ff3b5c !important;
                filter: drop-shadow(0 0 6px rgba(255,59,92,.45));
            }
            .vieworaTick.blueTick, .blueTick, .verifiedTick, i.blueTick, i.verifiedTick {
                color: #1d9bf0 !important;
            }
            .vieworaTick.whiteTick, .whiteTick, i.whiteTick {
                color: #f0f4fa !important;
                filter: drop-shadow(0 0 4px rgba(255,255,255,.35));
            }
            #verifiedBadge:not(.hidden),
            .verifiedBadge:not(.hidden) {
                display: inline-flex !important;
            }
        `;
        document.head.appendChild(s);
    }

    if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", injectBadgeCSS, { once: true });
        } else {
            injectBadgeCSS();
        }
    }

    const API = {
        resolve,
        isVerified,
        hasRed,
        hasBlue,
        hasWhite,
        applySubscriptionBadges,
        FOLLOWERS_WHITE_MIN,
        VIEWS_WHITE_MIN
    };

    global.VieworaBadges = API;
    global.vieworaIsVerified = function (data) {
        return isVerified(data);
    };
    global.vieworaBadgeHTML = function (data) {
        return resolve(data).html;
    };

})(typeof window !== "undefined" ? window : globalThis);
