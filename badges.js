"use strict";

/*
===========================================================
 VIEWORA — OFFICIAL BADGE SYSTEM
 Instagram-inspired scalloped verification badge
 4 colors: Red, Blue, Yellow, White
 360-degree rotating light animation
 Priority: Red > Blue > Yellow > White
===========================================================
*/

(function (global) {

    var COLORS = {
        red: "#E53935",
        blue: "#1D9BF0",
        yellow: "#F5C518",
        white: "#F0F4FA"
    };

    var TITLES = {
        red: "Viewora Elite",
        blue: "Verified Creator",
        yellow: "Official Business",
        white: "Achievement"
    };

    function num(value) {
        var n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function text(value) {
        return String(value == null ? "" : value)
            .toLowerCase()
            .trim();
    }

    function subscriptionOf(user) {
        if (!user || typeof user !== "object") return {};

        return user.subscription &&
            typeof user.subscription === "object"
            ? user.subscription
            : {};
    }

    function subActive(user) {
        var sub = subscriptionOf(user);

        if (sub.active !== true && text(sub.status) !== "active") {
            return false;
        }

        var expiresAt = num(sub.expiresAt);

        if (expiresAt > 0 && expiresAt <= Date.now()) {
            return false;
        }

        return true;
    }

    function planOf(user) {
        if (!user || !subActive(user)) return "";

        var sub = subscriptionOf(user);

        return text(sub.plan || user.plan);
    }

    function followersOf(user) {
        if (!user) return 0;

        return Math.max(
            0,
            num(
                user.followersCount ||
                user.followerCount ||
                user.followers ||
                0
            )
        );
    }

    /*
    -----------------------------------------------------------
    BADGE ELIGIBILITY
    Existing field names retained for compatibility.
    -----------------------------------------------------------
    */

    function hasRed(user) {
        if (!user) return false;

        var type = text(user.tickType || user.badge);

        if (
            user.redTickForce === true ||
            user.redTick === true ||
            type === "red"
        ) {
            return true;
        }

        return (
            planOf(user) === "elite" &&
            subActive(user) &&
            user.redTick === true
        );
    }

    function hasBlue(user) {
        if (!user) return false;

        var type = text(user.tickType || user.badge);
        var status = text(user.verificationStatus);

        if (
            user.blueTickForce === true ||
            user.blueTick === true ||
            type === "blue"
        ) {
            return true;
        }

        if (user.verified === true || user.isVerified === true) {
            if (status === "business" && user.blueTick !== true) {
                return false;
            }

            return true;
        }

        return status === "verified" || status === "creator";
    }

    function hasYellow(user) {
        if (!user) return false;

        var type = text(user.tickType || user.badge);
        var status = text(user.verificationStatus);

        return (
            user.yellowTickForce === true ||
            user.yellowTick === true ||
            user.businessVerified === true ||
            type === "yellow" ||
            type === "business" ||
            status === "business"
        );
    }

    function hasWhite(user) {
        if (!user) return false;

        var type = text(user.tickType || user.badge);

        if (
            user.whiteTickForce === true ||
            user.whiteTick === true ||
            type === "white"
        ) {
            return true;
        }

        return followersOf(user) >= 1000000;
    }

    function isVerified(user) {
        return (
            hasRed(user) ||
            hasBlue(user) ||
            hasYellow(user) ||
            hasWhite(user)
        );
    }

    /*
    -----------------------------------------------------------
    SCALLOPED SVG BADGE
    Same shape for all colors.
    White checkmark inside.
    -----------------------------------------------------------
    */

    function tickSvg(type, title) {
        type = text(type);

        if (!COLORS[type]) {
            type = "blue";
        }

        var color = COLORS[type];
        var label = String(title || TITLES[type])
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        /*
          12-point scalloped edge.
          The SVG itself stays still; its lighting rotates.
        */

        var scallopPath =
            "M12 1.2" +
            " L14.15 3.05" +
            " L16.95 2.75" +
            " L17.95 5.35" +
            " L20.55 6.35" +
            " L20.25 9.15" +
            " L22.1 12" +
            " L20.25 14.15" +
            " L20.55 16.95" +
            " L17.95 17.95" +
            " L16.95 20.55" +
            " L14.15 20.25" +
            " L12 22.1" +
            " L9.85 20.25" +
            " L7.05 20.55" +
            " L6.05 17.95" +
            " L3.45 16.95" +
            " L3.75 14.15" +
            " L1.9 12" +
            " L3.75 9.85" +
            " L3.45 7.05" +
            " L6.05 6.05" +
            " L7.05 3.45" +
            " L9.85 3.75 Z";

        return (
            '<span class="vieworaBadge ' +
                type +
                'Tick" role="img" aria-label="' +
                label +
                '" title="' +
                label +
                '" data-tick-type="' +
                type +
                '">' +

                '<svg class="vieworaBadgeSvg" ' +
                    'viewBox="0 0 24 24" ' +
                    'width="1.15em" height="1.15em" ' +
                    'aria-hidden="true" focusable="false">' +

                    '<defs>' +
                        '<linearGradient id="vieworaLight-' + type + '"' +
                            ' x1="0%" y1="0%" x2="100%" y2="100%">' +
                            '<stop offset="0%" stop-color="#FFFFFF" ' +
                                'stop-opacity="0.95"/>' +
                            '<stop offset="35%" stop-color="' + color + '"/>' +
                            '<stop offset="70%" stop-color="' + color + '"/>' +
                            '<stop offset="100%" stop-color="#FFFFFF" ' +
                                'stop-opacity="0.9"/>' +
                        '</linearGradient>' +
                    '</defs>' +

                    '<path class="vieworaBadgeShape" d="' +
                        scallopPath +
                        '" fill="' + color + '"/>' +

                    '<path class="vieworaBadgeLight" d="' +
                        scallopPath +
                        '" fill="none" ' +
                        'stroke="url(#vieworaLight-' + type + ')" ' +
                        'stroke-width="1.5" ' +
                        'stroke-linejoin="round"/>' +

                    '<path class="vieworaBadgeCheck" ' +
                        'd="M7.2 12.2 L10.2 15.1 L16.8 8.7" ' +
                        'fill="none" stroke="#FFFFFF" ' +
                        'stroke-width="2.15" ' +
                        'stroke-linecap="round" ' +
                        'stroke-linejoin="round"/>' +

                '</svg>' +
            '</span>'
        );
    }

    /*
    -----------------------------------------------------------
    RESOLVE PRIMARY BADGE
    Priority: Red > Blue > Yellow > White
    -----------------------------------------------------------
    */

    function resolveBadge(user) {
        var type = "";

        if (hasRed(user)) {
            type = "red";
        } else if (hasBlue(user)) {
            type = "blue";
        } else if (hasYellow(user)) {
            type = "yellow";
        } else if (hasWhite(user)) {
            type = "white";
        }

        if (!type) {
            return {
                type: "none",
                level: "none",
                html: "",
                className: "",
                title: "",
                color: ""
            };
        }

        return {
            type: type,
            level: type,
            html: tickSvg(type, TITLES[type]),
            className: type + "Tick",
            title: TITLES[type],
            color: COLORS[type]
        };
    }

    function resolveAllBadges(user) {
        var badges = [];

        ["red", "blue", "yellow", "white"].forEach(function (type) {
            var active =
                type === "red" ? hasRed(user) :
                type === "blue" ? hasBlue(user) :
                type === "yellow" ? hasYellow(user) :
                hasWhite(user);

            if (active) {
                badges.push({
                    type: type,
                    level: type,
                    html: tickSvg(type, TITLES[type]),
                    title: TITLES[type],
                    color: COLORS[type],
                    className: type + "Tick"
                });
            }
        });

        return badges;
    }

    function badgeHTML(user) {
        return resolveBadge(user).html || "";
    }

    function badgeHTMLStack(user) {
        return resolveAllBadges(user)
            .map(function (badge) {
                return badge.html;
            })
            .join("");
    }

    /*
    -----------------------------------------------------------
    360-DEGREE ROTATING LIGHT
    Rotates the light overlay around the badge.
    Badge shape and checkmark remain stationary.
    -----------------------------------------------------------
    */

    function injectBadgeCSS() {
        if (!global.document) return;

        var doc = global.document;

        if (doc.getElementById("vieworaBadgeCSS")) return;

        var style = doc.createElement("style");
        style.id = "vieworaBadgeCSS";

        style.textContent = [
            ".vieworaBadge{",
                "display:inline-flex!important;",
                "position:relative!important;",
                "align-items:center!important;",
                "justify-content:center!important;",
                "vertical-align:middle!important;",
                "width:1.15em!important;",
                "height:1.15em!important;",
                "margin-left:5px!important;",
                "line-height:1!important;",
                "flex-shrink:0!important;",
                "overflow:visible!important;",
                "isolation:isolate;",
                "cursor:pointer;",
            "}",

            ".vieworaBadgeSvg{",
                "display:block!important;",
                "width:100%!important;",
                "height:100%!important;",
                "overflow:visible!important;",
                "animation:vieworaBadgeFloat 3s ease-in-out infinite;",
            "}",

            ".vieworaBadgeShape{",
                "transform-origin:12px 12px;",
            "}",

            ".vieworaBadgeLight{",
                "transform-origin:12px 12px;",
                "animation:vieworaBadgeLight360 2.4s linear infinite;",
                "filter:drop-shadow(0 0 1.5px currentColor);",
            "}",

            ".vieworaBadgeCheck{",
                "filter:drop-shadow(0 0 0.4px rgba(0,0,0,.2));",
            "}",

            ".vieworaBadge.redTick{color:#E53935;}",
            ".vieworaBadge.blueTick{color:#1D9BF0;}",
            ".vieworaBadge.yellowTick{color:#F5C518;}",
            ".vieworaBadge.whiteTick{color:#F0F4FA;}",

            "@keyframes vieworaBadgeLight360{",
                "from{transform:rotate(0deg);}",
                "to{transform:rotate(360deg);}",
            "}",

            "@keyframes vieworaBadgeFloat{",
                "0%,100%{filter:drop-shadow(0 0 1px currentColor);}",
                "50%{filter:drop-shadow(0 0 4px currentColor);}",
            "}",

            "@media(prefers-reduced-motion:reduce){",
                ".vieworaBadgeSvg,",
                ".vieworaBadgeLight{animation:none!important;}",
            "}"
        ].join("");

        doc.head.appendChild(style);
    }

    /*
    -----------------------------------------------------------
    PUBLIC API — KEEP EXISTING FUNCTION NAMES
    -----------------------------------------------------------
    */

    var API = {
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
        badgeHTMLPrimary: badgeHTML,
        badgeHTMLStack: badgeHTMLStack,

        tickSvg: tickSvg,
        followersOf: followersOf,
        subActive: subActive,
        planOf: planOf,

        injectBadgeCSS: injectBadgeCSS
    };

    global.VieworaBadges = API;
    global.resolveBadge = resolveBadge;
    global.badgeHTML = badgeHTML;

    if (global.document) {
        if (global.document.readyState === "loading") {
            global.document.addEventListener(
                "DOMContentLoaded",
                injectBadgeCSS,
                { once: true }
            );
        } else {
            injectBadgeCSS();
        }
    }

})(typeof window !== "undefined" ? window : globalThis);