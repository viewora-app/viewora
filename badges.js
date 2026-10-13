"use strict";

/*
============================================================
 VIEWORA — 4 Official Ticks
 ONE icon shape (fa-circle-check) — only COLOR + 360 glow differ.
 Profile shows ONE primary tick. Admin grants only (no self-verify).
 Order: Red > Blue > Yellow > White
============================================================
*/

(function (global) {

    const WHITE_LEVELS = [
        { min: 1000000, level: 1 },
        { min: 5000000, level: 2 },
        { min: 10000000, level: 3 }
    ];

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function subObj(user) {
        if (!user || typeof user !== "object") return {};
        return (user.subscription && typeof user.subscription === "object") ? user.subscription : {};
    }

    function subActive(user) {
        const sub = subObj(user);
        if (sub.active === true || sub.status === "active") {
            const exp = num(sub.expiresAt);
            if (exp > 0 && exp < Date.now()) return false;
            return true;
        }
        if (user.subscriptionActive === true) {
            const exp = num(user.subscriptionExpiresAt || sub.expiresAt);
            if (exp > 0 && exp < Date.now()) return false;
            return true;
        }
        return false;
    }

    function planOf(user) {
        if (!subActive(user)) return "";
        const sub = subObj(user);
        return String(sub.plan || user.plan || "").toLowerCase();
    }

    function followersOf(user) {
        if (!user) return 0;
        return num(user.followersCount || user.followerCount || user.followers || 0);
    }

    function hasRed(user) {
        if (!user) return false;
        const tt = String(user.tickType || user.badge || "").toLowerCase();
        if (user.redTickForce === true || user.redTick === true || tt === "red") return true;
        if (planOf(user) === "elite" && subActive(user)) return true;
        return false;
    }

    function hasBlue(user) {
        if (!user) return false;
        const tt = String(user.tickType || user.badge || "").toLowerCase();
        if (user.blueTickForce === true || user.blueTick === true || tt === "blue") return true;
        if (user.verified === true || user.isVerified === true) {
            const st = String(user.verificationStatus || "").toLowerCase();
            if (st === "business" && user.blueTick !== true) return false;
            return true;
        }
        const st = String(user.verificationStatus || "").toLowerCase();
        return st === "verified" || st === "creator";
    }

    function hasYellow(user) {
        if (!user) return false;
        const tt = String(user.tickType || user.badge || "").toLowerCase();
        if (user.yellowTickForce === true || user.yellowTick === true || user.businessVerified === true) return true;
        if (tt === "yellow" || tt === "business") return true;
        return String(user.verificationStatus || "").toLowerCase() === "business";
    }

    function hasWhite(user) {
        if (!user) return false;
        const tt = String(user.tickType || user.badge || "").toLowerCase();
        if (user.whiteTickForce === true || user.whiteTick === true || tt === "white") return true;
        return followersOf(user) >= 1000000;
    }

    function isVerified(user) {
        return hasRed(user) || hasBlue(user) || hasYellow(user) || hasWhite(user);
    }

    /** Same icon for all — color only */
    function tickIcon(type, title) {
        const map = {
            red: { cls: "redTick", color: "#ff3b5c", title: title || "Viewora Elite" },
            blue: { cls: "blueTick verifiedTick", color: "#1d9bf0", title: title || "Verified Creator" },
            yellow: { cls: "yellowTick", color: "#f5c518", title: title || "Official Business" },
            white: { cls: "whiteTick", color: "#f0f4fa", title: title || "Achievement" }
        };
        const m = map[type];
        if (!m) return "";
        return (
            '<i class="fa-solid fa-circle-check vieworaTick ' + m.cls +
            '" title="' + m.title + '" aria-label="' + m.title +
            '" style="color:' + m.color + '"></i>'
        );
    }

    function resolveBadge(user) {
        if (hasRed(user)) {
            return { type: "red", level: "red", html: tickIcon("red"), className: "redTick", title: "Viewora Elite", color: "#ff3b5c" };
        }
        if (hasBlue(user)) {
            return { type: "blue", level: "blue", html: tickIcon("blue"), className: "blueTick", title: "Verified Creator", color: "#1d9bf0" };
        }
        if (hasYellow(user)) {
            return { type: "yellow", level: "yellow", html: tickIcon("yellow"), className: "yellowTick", title: "Official Business", color: "#f5c518" };
        }
        if (hasWhite(user)) {
            return { type: "white", level: "white", html: tickIcon("white"), className: "whiteTick", title: "Achievement", color: "#f0f4fa" };
        }
        return { type: "none", level: "none", html: "", className: "", title: "", color: "" };
    }

    function resolveAllBadges(user) {
        const list = [];
        if (hasRed(user)) list.push(resolveBadge({ redTick: true }));
        if (hasBlue(user)) list.push({ type: "blue", level: "blue", html: tickIcon("blue"), title: "Verified Creator" });
        if (hasYellow(user)) list.push({ type: "yellow", level: "yellow", html: tickIcon("yellow"), title: "Official Business" });
        if (hasWhite(user)) list.push({ type: "white", level: "white", html: tickIcon("white"), title: "Achievement" });
        return list;
    }

    function badgeHTML(user) {
        return resolveBadge(user).html || "";
    }

    function badgeHTMLPrimary(user) {
        return badgeHTML(user);
    }

    function badgeHTMLStack(user) {
        return resolveAllBadges(user).map(function (b) { return b.html; }).join("");
    }

    async function applySubscriptionBadges(uid, user) {
        if (!uid || !global.firebase) return;
        const updates = {};
        const plan = planOf(user || {});
        if (!subActive(user)) {
            updates.redTick = false;
            updates.vip = false;
            updates.elite = false;
        } else if (plan === "elite") {
            updates.redTick = true;
            updates.vip = true;
            updates.elite = true;
        }
        if (followersOf(user || {}) >= 1000000) {
            updates.whiteTick = true;
        }
        try {
            await firebase.database().ref("users/" + uid).update(updates);
        } catch (e) {
            console.warn("Badge apply failed:", e);
        }
    }

    function injectBadgeCSS() {
        if (typeof document === "undefined") return;
        if (document.getElementById("vieworaBadgeCSS")) return;
        const s = document.createElement("style");
        s.id = "vieworaBadgeCSS";
        s.textContent = `
.vieworaTick{
  display:inline-flex!important;
  align-items:center;
  justify-content:center;
  margin-left:5px;
  vertical-align:middle;
  line-height:1;
  font-size:.95em;
  border-radius:50%;
  animation:vieworaTickGlow 2.8s linear infinite;
}
@keyframes vieworaTickGlow{
  0%{filter:drop-shadow(0 0 2px currentColor) drop-shadow(2px 0 4px currentColor)}
  25%{filter:drop-shadow(0 0 2px currentColor) drop-shadow(0 2px 4px currentColor)}
  50%{filter:drop-shadow(0 0 2px currentColor) drop-shadow(-2px 0 4px currentColor)}
  75%{filter:drop-shadow(0 0 2px currentColor) drop-shadow(0 -2px 4px currentColor)}
  100%{filter:drop-shadow(0 0 2px currentColor) drop-shadow(2px 0 4px currentColor)}
}
.vieworaTick.redTick,.redTick{color:#ff3b5c!important}
.vieworaTick.blueTick,.blueTick,.verifiedTick{color:#1d9bf0!important}
.vieworaTick.yellowTick,.yellowTick{color:#f5c518!important}
.vieworaTick.whiteTick,.whiteTick{color:#f0f4fa!important}
#verifiedBadge:not(.hidden),.verifiedBadge:not(.hidden){display:inline-flex!important}
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
        hasRed: hasRed,
        hasBlue: hasBlue,
        hasYellow: hasYellow,
        hasWhite: hasWhite,
        isVerified: isVerified,
        resolveBadge: resolveBadge,
        resolve: resolveBadge,
        getBadge: resolveBadge,
        resolveAllBadges: resolveAllBadges,
        badgeHTML: badgeHTML,
        badgeHTMLPrimary: badgeHTMLPrimary,
        badgeHTMLStack: badgeHTMLStack,
        applySubscriptionBadges: applySubscriptionBadges,
        followersOf: followersOf,
        subActive: subActive,
        planOf: planOf
    };

    global.VieworaBadges = API;
    global.resolveBadge = resolveBadge;
    global.badgeHTML = badgeHTML;

})(typeof window !== "undefined" ? window : globalThis);
