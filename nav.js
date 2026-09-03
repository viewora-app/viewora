"use strict";

(() => {
    /* =====================================================
       VIEWORA — ONE GLOBAL FIXED NAVIGATION
       Home · Shorts · Create · Activity · Profile
    ===================================================== */

    if (window.__VIEWORA_NAV_INITIALIZED__) return;
    window.__VIEWORA_NAV_INITIALIZED__ = true;

    const ROUTES = {
        home: "index.html",
        shorts: "shorts.html",
        create: "upload.html",
        activity: "activity.html",
        profile: "profile.html"
    };

    const OLD_NAV_SELECTORS = [
        ".bottomNav",
        "#bottomNav",
        ".vieworaBottomNav",
        ".shortsBottomNav",
        "nav.bottom-nav",
        ".appBottomNav",
        "#appBottomNav",
        ".mainBottomNav",
        "[data-bottom-nav]",
        "nav.bottomNav"
    ];

    function currentPageName() {
        return (
            location.pathname.split("/").pop() ||
            "index.html"
        ).toLowerCase();
    }

    function detectActiveKey() {
        const page = currentPageName();

        if (
            page === "index.html" ||
            page === "" ||
            page === "home.html"
        ) return "home";

        if (
            page.includes("short") ||
            page === "reels.html"
        ) return "shorts";

        if (
            page.includes("upload") ||
            page.includes("create") ||
            page.includes("story-upload")
        ) return "create";

        if (
            page.includes("activity") ||
            page.includes("notif")
        ) return "activity";

        if (page.includes("profile")) return "profile";

        return "";
    }

    function stripOldNavs() {
        OLD_NAV_SELECTORS.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                // keep our injected nav
                if (el.id === "vieworaGlobalNav") return;
                el.remove();
            });
        });
    }

    function buildNav() {
        stripOldNavs();

        // already exists
        let existing = document.getElementById("vieworaGlobalNav");
        if (existing) existing.remove();

        const active = detectActiveKey();

        const nav = document.createElement("nav");
        nav.className = "bottomNav vieworaGlobalNav";
        nav.id = "vieworaGlobalNav";
        nav.setAttribute("aria-label", "Main navigation");

        nav.innerHTML = `
            <a href="${ROUTES.home}" class="navItem ${active === "home" ? "active" : ""}" data-nav="home">
                <div class="activeIndicator"></div>
                <i class="fa-solid fa-house"></i>
                <span>Home</span>
            </a>

            <a href="${ROUTES.shorts}" class="navItem ${active === "shorts" ? "active" : ""}" data-nav="shorts">
                <div class="activeIndicator"></div>
                <i class="fa-solid fa-clapperboard"></i>
                <span>Shorts</span>
            </a>

            <a href="${ROUTES.create}" class="navItem uploadNav ${active === "create" ? "active" : ""}" data-nav="create" aria-label="Create">
                <span class="uploadNavInner">
                    <i class="fa-solid fa-plus"></i>
                </span>
            </a>

            <a href="${ROUTES.activity}" class="navItem ${active === "activity" ? "active" : ""}" data-nav="activity">
                <div class="activeIndicator"></div>
                <i class="fa-regular fa-heart"></i>
                <span>Activity</span>
                <span class="navBadge hidden" id="navActivityBadge">0</span>
            </a>

            <a href="${ROUTES.profile}" class="navItem ${active === "profile" ? "active" : ""}" data-nav="profile">
                <div class="activeIndicator"></div>
                <i class="fa-regular fa-user"></i>
                <span>Profile</span>
            </a>
        `;

        document.body.appendChild(nav);
        document.body.classList.add("has-bottom-nav");
        document.documentElement.classList.add("has-bottom-nav");

        return nav;
    }

    function bindNav(nav) {
        const links = nav.querySelectorAll("a");
        const currentPage = currentPageName();

        links.forEach((link) => {
            const href = link.getAttribute("href");
            if (!href) return;

            const cleanHref = href.split("?")[0].split("#")[0];
            if (cleanHref === currentPage) {
                link.classList.add("active");
            }

            link.addEventListener("click", function (e) {
                const target = this.getAttribute("href");
                if (!target || target === "#") return;

                const targetPage = target.split("?")[0].split("#")[0];

                if (targetPage === currentPage) {
                    e.preventDefault();
                    if (targetPage === "index.html" || targetPage === "shorts.html") {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                    return;
                }

                e.preventDefault();

                links.forEach((item) => item.classList.remove("active"));
                this.classList.add("active");

                // ripple
                const ripple = document.createElement("span");
                ripple.className = "navRipple";
                const rect = this.getBoundingClientRect();
                ripple.style.left = (e.clientX - rect.left) + "px";
                ripple.style.top = (e.clientY - rect.top) + "px";
                this.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);

                if (typeof this.animate === "function") {
                    this.animate(
                        [{ transform: "scale(.88)" }, { transform: "scale(1)" }],
                        { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }
                    );
                }

                if (navigator.vibrate) {
                    try { navigator.vibrate(12); } catch (_) {}
                }

                window.location.href = target;
            });
        });
    }

    function wireActivityBadge() {
        try {
            if (typeof firebase === "undefined" || !firebase.auth) return;

            firebase.auth().onAuthStateChanged((user) => {
                if (!user) return;
                const db =
                    window.db ||
                    window.firebaseDB ||
                    (firebase.database && firebase.database());
                if (!db) return;

                db.ref("notifications/" + user.uid)
                    .limitToLast(50)
                    .on("value", (snap) => {
                        let unread = 0;
                        snap.forEach((child) => {
                            const v = child.val() || {};
                            if (v.read !== true && v.seen !== true) unread += 1;
                        });
                        const badge = document.getElementById("navActivityBadge");
                        if (!badge) return;
                        if (unread > 0) {
                            badge.textContent = unread > 99 ? "99+" : String(unread);
                            badge.classList.remove("hidden");
                        } else {
                            badge.classList.add("hidden");
                        }
                    });
            });
        } catch (_) {}
    }

    function init() {
        const nav = buildNav();
        bindNav(nav);
        wireActivityBadge();

        // Kill any page-local nav that appears later
        const mo = new MutationObserver(() => {
            document
                .querySelectorAll(
                    ".bottomNav:not(#vieworaGlobalNav), #bottomNav:not(#vieworaGlobalNav), .vieworaBottomNav, .shortsBottomNav, nav.bottom-nav:not(#vieworaGlobalNav)"
                )
                .forEach((el) => {
                    if (el.id !== "vieworaGlobalNav") el.remove();
                });
        });

        mo.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
