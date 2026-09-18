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

            const isProfile = link.getAttribute("data-nav") === "profile";

            // Profile: single click = own profile; double-click / 3s hold = switch account
            if (isProfile) {
                let holdTimer = null;
                let holdFired = false;
                let lastTap = 0;

                link.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (holdFired) {
                        holdFired = false;
                        return;
                    }
                    const now = Date.now();
                    if (now - lastTap < 320) {
                        // double click → account switcher
                        lastTap = 0;
                        openAccountSwitcher();
                        return;
                    }
                    lastTap = now;
                    setTimeout(function () {
                        if (Date.now() - lastTap >= 300 && lastTap !== 0) {
                            lastTap = 0;
                            // single click → always own profile (no uid)
                            window.location.href = "profile.html";
                        }
                    }, 320);
                });

                link.addEventListener("touchstart", function (e) {
                    holdFired = false;
                    holdTimer = setTimeout(function () {
                        holdFired = true;
                        if (navigator.vibrate) {
                            try { navigator.vibrate(30); } catch (_) {}
                        }
                        openAccountSwitcher();
                    }, 3000);
                }, { passive: true });

                link.addEventListener("touchend", function () {
                    if (holdTimer) clearTimeout(holdTimer);
                    holdTimer = null;
                });
                link.addEventListener("touchmove", function () {
                    if (holdTimer) clearTimeout(holdTimer);
                    holdTimer = null;
                });
                link.addEventListener("mousedown", function () {
                    holdFired = false;
                    holdTimer = setTimeout(function () {
                        holdFired = true;
                        openAccountSwitcher();
                    }, 3000);
                });
                link.addEventListener("mouseup", function () {
                    if (holdTimer) clearTimeout(holdTimer);
                    holdTimer = null;
                });
                link.addEventListener("mouseleave", function () {
                    if (holdTimer) clearTimeout(holdTimer);
                    holdTimer = null;
                });
                return;
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

    /* ========== Account switcher (Instagram-style) ========== */
    function getSavedAccounts() {
        try {
            const raw = localStorage.getItem("viewora_saved_accounts");
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (_) {
            return [];
        }
    }

    function saveAccountToList(acc) {
        if (!acc || !acc.uid) return;
        try {
            let list = getSavedAccounts();
            list = list.filter(function (a) { return a && a.uid !== acc.uid; });
            list.unshift({
                uid: acc.uid,
                username: acc.username || "user",
                displayName: acc.displayName || acc.username || "User",
                avatar: acc.avatar || "assets/default-avatar.png",
                email: acc.email || ""
            });
            list = list.slice(0, 8);
            localStorage.setItem("viewora_saved_accounts", JSON.stringify(list));
        } catch (_) {}
    }

    function ensureCurrentAccountSaved() {
        try {
            if (typeof firebase === "undefined" || !firebase.auth) return;
            const u = firebase.auth().currentUser;
            if (!u) return;
            try { localStorage.setItem("viewora_last_uid", u.uid); } catch (_) {}
            const db = window.db || (firebase.database && firebase.database());
            if (!db) {
                saveAccountToList({
                    uid: u.uid,
                    username: u.displayName || (u.email || "").split("@")[0] || "user",
                    displayName: u.displayName || "User",
                    avatar: u.photoURL || "assets/default-avatar.png",
                    email: u.email || ""
                });
                return;
            }
            db.ref("users/" + u.uid).once("value").then(function (snap) {
                const d = snap.val() || {};
                saveAccountToList({
                    uid: u.uid,
                    username: d.username || d.userName || u.displayName || "user",
                    displayName: d.displayName || d.name || u.displayName || "User",
                    avatar: d.avatar || d.profilePhoto || u.photoURL || "assets/default-avatar.png",
                    email: u.email || d.email || ""
                });
            }).catch(function () {});
        } catch (_) {}
    }

    function openAccountSwitcher() {
        ensureCurrentAccountSaved();
        let sheet = document.getElementById("vieworaAccountSwitcher");
        if (!sheet) {
            sheet = document.createElement("div");
            sheet.id = "vieworaAccountSwitcher";
            sheet.className = "vieworaAccountSwitcher hidden";
            sheet.innerHTML =
                '<div class="vasBackdrop" data-vas-close="1"></div>' +
                '<div class="vasSheet">' +
                '<div class="vasHandle"></div>' +
                '<div class="vasList" id="vasAccountList"></div>' +
                '<button type="button" class="vasAdd" id="vasAddAccount"><span class="vasAddIcon">+</span> Add Viewora account</button>' +
                '<button type="button" class="vasCenter" id="vasAccountsCenter">Go to Settings</button>' +
                '</div>';
            document.body.appendChild(sheet);
            sheet.addEventListener("click", function (e) {
                if (e.target && e.target.getAttribute("data-vas-close")) {
                    closeAccountSwitcher();
                }
            });
            sheet.querySelector("#vasAddAccount")?.addEventListener("click", function () {
                // No confirm popup — Instagram style, go add account
                try {
                    if (firebase && firebase.auth) firebase.auth().signOut();
                } catch (_) {}
                location.href = "login.html?addAccount=1";
            });
            sheet.querySelector("#vasAccountsCenter")?.addEventListener("click", function () {
                location.href = "settings.html";
            });
        }
        renderAccountList();
        sheet.classList.remove("hidden");
        document.body.classList.add("vasOpen");
    }

    function closeAccountSwitcher() {
        const sheet = document.getElementById("vieworaAccountSwitcher");
        if (sheet) sheet.classList.add("hidden");
        document.body.classList.remove("vasOpen");
    }

    function getCurrentUidSafe() {
        try {
            if (typeof firebase !== "undefined" && firebase.auth) {
                const u = firebase.auth().currentUser;
                if (u && u.uid) {
                    try { localStorage.setItem("viewora_last_uid", u.uid); } catch (_) {}
                    return u.uid;
                }
            }
        } catch (_) {}
        try {
            return localStorage.getItem("viewora_last_uid") || "";
        } catch (_) {
            return "";
        }
    }

    function renderAccountList() {
        const listEl = document.getElementById("vasAccountList");
        if (!listEl) return;
        const list = getSavedAccounts();
        const currentUid = getCurrentUidSafe();

        if (!list.length) {
            listEl.innerHTML =
                '<div class="vasEmpty">Only this device session is active.<br>Use Add account to login another.</div>';
            return;
        }

        listEl.innerHTML = list.map(function (a) {
            const active = currentUid && a.uid === currentUid;
            const saved = window.VieworaAccounts && window.VieworaAccounts.hasSavedLogin
                ? window.VieworaAccounts.hasSavedLogin(a)
                : false;
            return (
                '<button type="button" class="vasItem' + (active ? " active" : "") + '" data-uid="' +
                String(a.uid).replace(/"/g, "") + '" data-active="' + (active ? "1" : "0") + '" data-saved="' + (saved ? "1" : "0") + '">' +
                '<img class="vasAvatar" src="' + String(a.avatar || "assets/default-avatar.png").replace(/"/g, "") +
                '" alt="">' +
                '<span class="vasMeta"><strong>' + escapeNav(a.username || a.displayName || "user") +
                '</strong>' + (saved && !active ? '<small style="opacity:.55">Tap to switch</small>' : (!saved && !active ? '<small style="opacity:.55">Enter password once</small>' : "")) + '</span>' +
                (active ? '<span class="vasCheck"><i class="fa-solid fa-circle-check"></i></span>' : "") +
                "</button>"
            );
        }).join("");
        // Inline password row for accounts without saved login
        if (!document.getElementById("vasPassRow")) {
            const row = document.createElement("div");
            row.id = "vasPassRow";
            row.className = "vasPassRow hidden";
            row.innerHTML = '<input type="password" id="vasPassInput" placeholder="Password for this account" autocomplete="current-password">' +
                '<button type="button" id="vasPassGo">Switch</button>';
            listEl.parentNode.insertBefore(row, listEl.nextSibling);
        }

        listEl.querySelectorAll(".vasItem").forEach(function (btn) {
            btn.addEventListener("click", async function () {
                const uid = btn.getAttribute("data-uid");
                if (!uid) return;
                const isActive = btn.getAttribute("data-active") === "1" || (currentUid && uid === currentUid);
                if (isActive) {
                    closeAccountSwitcher();
                    location.href = "profile.html";
                    return;
                }
                const acc = getSavedAccounts().find(function (x) { return x.uid === uid; });
                if (!acc) return;

                const saved = btn.getAttribute("data-saved") === "1";
                const passRow = document.getElementById("vasPassRow");
                const passInput = document.getElementById("vasPassInput");

                async function doSwitch(passwordOptional) {
                    btn.disabled = true;
                    try {
                        if (passwordOptional && acc.email && window.VieworaAccounts) {
                            window.VieworaAccounts.saveCredentials(acc.email, passwordOptional, acc.uid);
                        }
                        if (window.VieworaAccounts && window.VieworaAccounts.switchToAccount) {
                            await window.VieworaAccounts.switchToAccount(acc);
                            closeAccountSwitcher();
                            location.href = "profile.html?switched=1";
                            return;
                        }
                    } catch (err) {
                        if (err && err.code === "ACCOUNT_RESTRICTED") {
                            closeAccountSwitcher();
                            location.href = "appeal.html";
                            return;
                        }
                        if (err && err.code === "NO_CREDS") {
                            if (passRow) {
                                passRow.classList.remove("hidden");
                                passRow.dataset.uid = uid;
                                if (passInput) {
                                    passInput.value = "";
                                    passInput.focus();
                                }
                            }
                            return;
                        }
                        // wrong password
                        if (passRow) {
                            passRow.classList.remove("hidden");
                            passRow.dataset.uid = uid;
                            if (passInput) {
                                passInput.value = "";
                                passInput.placeholder = "Wrong password — try again";
                                passInput.focus();
                            }
                        }
                        console.warn("switch", err);
                    } finally {
                        btn.disabled = false;
                    }
                }

                if (saved) {
                    await doSwitch();
                } else {
                    // show password field in sheet (no full login page)
                    if (passRow) {
                        passRow.classList.remove("hidden");
                        passRow.dataset.uid = uid;
                        if (passInput) {
                            passInput.value = "";
                            passInput.placeholder = "Password for @" + (acc.username || "user");
                            passInput.focus();
                        }
                        const go = document.getElementById("vasPassGo");
                        if (go && !go.__bound) {
                            go.__bound = true;
                            go.addEventListener("click", async function () {
                                const u = passRow.dataset.uid;
                                const a = getSavedAccounts().find(function (x) { return x.uid === u; });
                                const pw = (passInput && passInput.value) || "";
                                if (!a || !pw) return;
                                await doSwitch(pw);
                            });
                        }
                    }
                }
            });
        });
    }

    function escapeNav(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
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

    
    function ensureGlobalListeners() {
        // Load message-listener + call-listener once if page forgot to include them
        function loadScript(src) {
            if (document.querySelector('script[src="' + src + '"]')) return;
            var s = document.createElement("script");
            s.src = src;
            s.async = true;
            document.head.appendChild(s);
        }
        try {
            if (!window.__VIEWORA_MESSAGE_LISTENER__) loadScript("message-listener.js");
            if (!window.__VIEWORA_GLOBAL_CALL_LISTENER__) loadScript("call-listener.js");
            if (!window.__VIEWORA_LIVE_RING__) loadScript("live-ring.js");
            // Live ring CSS once
            if (!document.querySelector('link[href="live.css"]') && !document.getElementById("vieworaLiveRingCss")) {
                var l = document.createElement("link");
                l.rel = "stylesheet";
                l.href = "live.css";
                l.id = "vieworaLiveRingCss";
                document.head.appendChild(l);
            }
        } catch (_) {}
    }

    function init() {
        const nav = buildNav();
        bindNav(nav);
        wireActivityBadge();
        ensureGlobalListeners();

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
