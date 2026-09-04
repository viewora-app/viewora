"use strict";

/*
============================================================
 VIEWORA BADGES — Single source of truth
 Hierarchy (highest first):
   1. RED  (VIP)   — Elite subscription (active)
   2. BLUE (Verified) — Admin creator/influencer OR any paid plan
   3. WHITE (Monetized) — Monetization complete + strong stats
      (only if no red/blue)

 Usage:
   VieworaBadges.resolve(userData) → { level, html, className, title }
   VieworaBadges.isVerified(userData)
   VieworaBadges.applyToUserNode(uid, subscriptionPayload)  // after payment
============================================================
*/

(function (global) {

    const FOLLOWERS_WHITE_MIN = 100000; // 1 lakh
    const VIEWS_WHITE_MIN = 300000;    // 3 lakh lifetime views (soft)

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function subActive(sub) {
        if (!sub || typeof sub !== "object") return false;
        if (sub.active === true || sub.status === "active") {
            const exp = num(sub.expiresAt);
            if (exp > 0 && exp < Date.now()) return false;
            return true;
        }
        return false;
    }

    function planOf(user) {
        const sub = user?.subscription || user?.sub || {};
        if (subActive(sub)) {
            return String(sub.plan || user.plan || "").toLowerCase();
        }
        return String(user?.plan || "").toLowerCase();
    }

    function hasAdminBlue(user) {
        if (!user || typeof user !== "object") return false;
        if (
            user.verified === true ||
            user.isVerified === true ||
            user.blueTick === true ||
            user.verification === true
        ) {
            // But red overrides display; still counts as blue-capable
            return true;
        }
        const status = String(
            user.verificationStatus ||
            user.badge ||
            user.role ||
            ""
        ).toLowerCase();
        return (
            status === "verified" ||
            status === "creator" ||
            status === "influencer" ||
            status === "admin"
        );
    }

    function hasRed(user) {
        if (!user || typeof user !== "object") return false;
        if (user.redTick === true || user.vip === true || user.elite === true) {
            // still require active elite if subscription-driven
            const plan = planOf(user);
            if (plan === "elite") return true;
            if (user.redTick === true && subActive(user.subscription)) return true;
            // admin-forced red
            if (user.redTickForce === true) return true;
            return user.redTick === true && !user.subscription;
        }
        return planOf(user) === "elite" && subActive(user.subscription || { active: true, status: "active", expiresAt: user.subscription?.expiresAt || Date.now() + 1 });
    }

    function hasBlue(user) {
        if (hasRed(user)) return false; // hierarchy: red wins, blue not shown together
        if (hasAdminBlue(user)) return true;
        const plan = planOf(user);
        if ((plan === "plus" || plan === "pro" || plan === "elite") && subActive(user.subscription || user)) {
            return true;
        }
        // any paid flag
        if (user.premium === true || user.isPremium === true) {
            if (subActive(user.subscription || { active: true, status: "active" })) return true;
        }
        return false;
    }

    function hasWhite(user) {
        if (!user) return false;
        if (hasRed(user) || hasBlue(user) || hasAdminBlue(user)) return false;

        const monetized =
            user.monetization === true ||
            user.monetized === true ||
            user.monetizationStatus === "approved" ||
            user.monetizationStatus === "active" ||
            user.whiteTick === true;

        if (!monetized) return false;

        const followers =
            num(user.followers) ||
            num(user.followersCount) ||
            num(user.followerCount);

        const views =
            num(user.totalViews) ||
            num(user.views) ||
            num(user.lifetimeViews);

        // 1L followers OR (monetized + 3L views)
        if (followers >= FOLLOWERS_WHITE_MIN) return true;
        if (views >= VIEWS_WHITE_MIN) return true;

        // explicit white from admin after review
        if (user.whiteTickForce === true) return true;

        return false;
    }

    /**
     * Resolve badge for a user object (from users/{uid} or enriched card).
     */
    function resolve(user) {
        if (!user || typeof user !== "object") {
            return { level: "none", html: "", className: "", title: "", color: "" };
        }

        // Red VIP
        if (
            user.redTick === true ||
            user.vip === true ||
            (String(user.plan || user.subscription?.plan || "").toLowerCase() === "elite" &&
                subActive(user.subscription || { active: user.subscriptionActive, status: user.subscriptionStatus || (user.premium ? "active" : "") }))
        ) {
            // tighten: elite plan active OR forced red
            const eliteActive =
                user.redTickForce === true ||
                user.redTick === true ||
                (String(user.subscription?.plan || user.plan || "").toLowerCase() === "elite" &&
                    subActive(user.subscription || { active: true, status: "active", expiresAt: user.subscription?.expiresAt || (Date.now() + 86400000) }));

            if (eliteActive || user.redTick === true) {
                return {
                    level: "red",
                    html: '<i class="fa-solid fa-certificate vieworaTick redTick" title="VIP Elite" aria-label="VIP"></i>',
                    className: "redTick",
                    title: "VIP Elite",
                    color: "#ff3b5c"
                };
            }
        }

        if (hasBlue(user) || hasAdminBlue(user)) {
            return {
                level: "blue",
                html: '<i class="fa-solid fa-circle-check vieworaTick blueTick" title="Verified" aria-label="Verified"></i>',
                className: "blueTick verifiedTick",
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

    /**
     * After successful Razorpay payment — write badge flags on users/{uid}
     */
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

        // Reset ticks then set by plan
        updates.redTick = false;
        updates.vip = false;
        updates.elite = false;

        if (active && plan === "elite") {
            // RED VIP — only Elite (most expensive)
            updates.redTick = true;
            updates.vip = true;
            updates.elite = true;
            updates.verified = true;
            updates.isVerified = true;
            updates.blueTick = true; // internal verified, UI shows red
            updates.badge = "vip";
            updates.verificationStatus = "vip";
        } else if (active && (plan === "plus" || plan === "pro")) {
            // BLUE for paid Plus / Pro
            updates.verified = true;
            updates.isVerified = true;
            updates.blueTick = true;
            updates.badge = "verified";
            updates.verificationStatus = "verified";
            // no red
            updates.redTick = false;
            updates.vip = false;
        }

        // White never auto from subscription
        // (admin monetization flow sets whiteTick)

        try {
            await firebase.database().ref("users/" + uid).update(updates);
        } catch (e) {
            console.warn("Badge apply failed:", e);
        }
    }

    // CSS once
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

    // Back-compat helpers used across pages
    global.vieworaIsVerified = function (data) {
        return isVerified(data);
    };
    global.vieworaBadgeHTML = function (data) {
        return resolve(data).html;
    };

})(typeof window !== "undefined" ? window : globalThis);
