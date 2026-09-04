/* =========================================================
   VIEWORA ADMIN PANEL
   admin-panel.js
========================================================= */

"use strict";

/*
 * Firebase is initialized in firebase.js.
 * Do NOT declare auth or db again here.
 *
 * firebase.js must load before this file:
 *
 * <script src="firebase.js"></script>
 * <script src="admin-panel.js"></script>
 */

if (typeof firebase === "undefined") {
    console.error("Firebase SDK is not loaded.");
}

/*
 * Use the existing Firebase instances.
 * No const auth / const db declaration here.
 */


/* =========================================================
   STATE
========================================================= */

let currentAdmin = null;
let currentAdminData = null;
let currentSection = "dashboard";

let cachedUsers = {};
let cachedPosts = {};
let cachedReports = {};
let cachedLive = {};

let selectedUserId = null;
let confirmCallback = null;

let unsubscribeUsers = null;
let unsubscribePosts = null;
let unsubscribeReports = null;
let unsubscribeLive = null;

/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

const qs = (selector, parent = document) =>
    parent.querySelector(selector);

const qsa = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

/* =========================================================
   SAFE HTML
========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHTML(value);
}

/* =========================================================
   FORMAT HELPERS
========================================================= */

function formatNumber(value) {
    const number = Number(value || 0);

    if (number >= 1000000000) {
        return (number / 1000000000).toFixed(1) + "B";
    }

    if (number >= 1000000) {
        return (number / 1000000).toFixed(1) + "M";
    }

    if (number >= 1000) {
        return (number / 1000).toFixed(1) + "K";
    }

    return number.toLocaleString();
}

function formatDate(value) {
    if (!value) return "—";

    let date;

    if (typeof value === "number") {
        date = new Date(value);
    } else {
        date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getTimestamp(item) {
    if (!item) return 0;

    return Number(
        item.createdAt ||
        item.timestamp ||
        item.updatedAt ||
        item.joinedAt ||
        0
    );
}

function getUserName(user) {
    return (
        user?.name ||
        user?.displayName ||
        user?.username ||
        "Viewora User"
    );
}

function getUserEmail(user) {
    return user?.email || "No email";
}

function getUserAvatar(user) {
    return (
        user?.photoURL ||
        user?.avatar ||
        user?.profilePhoto ||
        "assets/default-avatar.png"
    );
}


function getUserTickHTML(user) {
    if (!user) return "";
    // Priority: Red (VIP) > Blue > White
    if (user.redTick === true || user.vip === true || user.plan === "elite" || (user.subscription && (user.subscription.plan === "elite" || user.subscription.tier === "elite"))) {
        return '<span class="tickBadge red" title="VIP Red Tick"><i class="fa-solid fa-check"></i></span>';
    }
    if (user.verified === true || user.isVerified === true || user.blueTick === true || user.verificationStatus === "verified") {
        return '<span class="tickBadge blue" title="Blue Tick"><i class="fa-solid fa-check"></i></span>';
    }
    if (user.whiteTick === true || user.monetizationEnabled === true || user.monetizationStatus === "active") {
        return '<span class="tickBadge white" title="White Tick (Monetized)"><i class="fa-solid fa-check"></i></span>';
    }
    return "";
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message, type = "success") {
    const toast = $("adminToast");

    if (!toast) {
        console.log(message);
        return;
    }

    const icon = $("adminToastIcon");
    const text = $("adminToastText");

    if (text) {
        text.textContent = message;
    }

    toast.classList.remove(
        "success",
        "error",
        "warning",
        "show"
    );

    toast.classList.add(type);

    if (icon) {
        if (type === "error") {
            icon.className =
                "fa-solid fa-circle-xmark";
        } else if (type === "warning") {
            icon.className =
                "fa-solid fa-triangle-exclamation";
        } else {
            icon.className =
                "fa-solid fa-circle-check";
        }
    }

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    clearTimeout(window.__vieworaToastTimer);

    window.__vieworaToastTimer =
        setTimeout(() => {
            toast.classList.remove("show");
        }, 3200);
}

/* =========================================================
   AUTH
========================================================= */

auth.onAuthStateChanged(async (user) => {

    if (!user) {
        window.location.replace("admin-login.html");
        return;
    }

    currentAdmin = user;

    try {
        currentAdminData =
            await verifyAdmin(user);

        updateAdminProfile(user, currentAdminData);

        await loadDashboard();

        startRealtimeListeners();

    } catch (error) {

        console.error(
            "Admin verification failed:",
            error
        );

        showToast(
            error.message ||
            "Admin verification failed.",
            "error"
        );

        setTimeout(async () => {

            try {
                await auth.signOut();
            } catch (_) {}

            window.location.replace(
                "admin-login.html"
            );

        }, 1200);
    }
});

/* =========================================================
   VERIFY ADMIN
========================================================= */

async function verifyAdmin(user) {

    if (!user) {
        throw new Error(
            "Authentication required."
        );
    }

    const snapshot =
        await db.ref(
            "admins/" + user.uid
        ).once("value");

    if (!snapshot.exists()) {
        throw new Error(
            "This account is not registered as a Viewora administrator."
        );
    }

    const adminData =
        snapshot.val() || {};

    if (adminData.active === false) {
        throw new Error(
            "Administrator access is disabled."
        );
    }

    const role =
        String(
            adminData.role || "admin"
        ).toLowerCase();

    if (
        role !== "admin" &&
        role !== "superadmin"
    ) {
        throw new Error(
            "This account does not have administrator privileges."
        );
    }

    return adminData;
}

/* =========================================================
   ADMIN PROFILE
========================================================= */

function updateAdminProfile(user, adminData = {}) {

    const name =
        adminData.name ||
        adminData.displayName ||
        user.displayName ||
        "Viewora Admin";

    const email =
        user.email ||
        adminData.email ||
        "Admin Account";

    const adminName = $("adminName");

    if (adminName) {
        adminName.textContent = name;
    }

    const adminEmail = $("adminEmail");

    if (adminEmail) {
        adminEmail.textContent = email;
    }

    const profileStrong =
        qs(".profileText strong");

    if (profileStrong) {
        profileStrong.textContent = name;
    }

    const profileSmall =
        qs(".profileText small");

    if (profileSmall) {
        profileSmall.textContent =
            adminData.role === "superadmin"
                ? "Super Administrator"
                : "Administrator";
    }
}

/* =========================================================
   NAVIGATION
========================================================= */

qsa(".navItem[data-section]").forEach(button => {

    button.addEventListener("click", () => {

        const section =
            button.dataset.section;

        if (section) {
            switchSection(section);
        }
    });
});

qsa(".quickAction[data-section]").forEach(button => {

    button.addEventListener("click", () => {

        const section =
            button.dataset.section;

        if (section) {
            switchSection(section);
        }
    });
});

qsa(".viewAllBtn[data-target]").forEach(button => {

    button.addEventListener("click", () => {

        const section =
            button.dataset.target;

        if (section) {
            switchSection(section);
        }
    });
});

function switchSection(section) {

    const sectionElement =
        $(section + "Section");

    if (!sectionElement) {
        console.warn(
            "Section not found:",
            section
        );
        return;
    }

    currentSection = section;

    qsa(".adminSection").forEach(item => {
        item.classList.remove("activeSection");
    });

    sectionElement.classList.add(
        "activeSection"
    );

    qsa(".navItem").forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.section === section
        );

    });

    const titles = {

        dashboard: [
            "Dashboard",
            "Welcome back, Admin"
        ],

        users: [
            "Users",
            "Manage Viewora accounts and permissions."
        ],

        posts: [
            "Content",
            "Manage posts, shorts and videos."
        ],

        reports: [
            "Reports",
            "Review reported content and moderation."
        ],

        live: [
            "Live",
            "Monitor active Viewora broadcasts."
        ],

        verification: [
            "Verification",
            "Review creator verification requests."
        ],

        analytics: [
            "Analytics",
            "View Viewora growth and engagement."
        ],

        music: [
            "Music Store",
            "Manage tracks for Shorts and Stories."
        ],

        stickers: [
            "Sticker Store",
            "Manage sticker packs for Stories."
        ],

        monetization: [
            "Monetization",
            "3L views · 600 followers · 100 stories"
        ],

        settings: [
            "Settings",
            "Configure your Viewora administration."
        ]
    };

    if (titles[section]) {

        const title = $("pageTitle");
        const subtitle = $("pageSubtitle");

        if (title) {
            title.textContent =
                titles[section][0];
        }

        if (subtitle) {
            subtitle.textContent =
                titles[section][1];
        }
    }

    if (section === "dashboard") {
        loadDashboard();
    }

    if (section === "users") {
        loadUsers();
    }

    if (section === "posts") {
        loadPosts();
    }

    if (section === "reports") {
        loadReports();
    }

    if (section === "live") {
        loadLive();
    }

    if (section === "verification") {
        loadVerification();
    }

    if (section === "analytics") {
        loadAnalytics();
    }

    if (section === "music") {
        loadMusicAdmin();
    }

    if (section === "stickers") {
        loadStickersAdmin();
    }

    if (section === "monetization") {
        loadMonetizationAdmin();
    }

    if (window.innerWidth <= 850) {
        closeSidebar();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* =========================================================
   SIDEBAR
========================================================= */

const sidebarToggle =
    $("sidebarToggle");

if (sidebarToggle) {
    sidebarToggle.addEventListener(
        "click",
        toggleSidebar
    );
}

function toggleSidebar() {

    const sidebar =
        $("adminSidebar");

    const overlay =
        $("sidebarOverlay");

    if (!sidebar) return;

    sidebar.classList.toggle("open");

    if (overlay) {
        overlay.classList.toggle(
            "show"
        );
    }
}

function closeSidebar() {

    const sidebar =
        $("adminSidebar");

    const overlay =
        $("sidebarOverlay");

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (overlay) {
        overlay.classList.remove("show");
    }
}

const sidebarOverlay =
    $("sidebarOverlay");

if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );
}

/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

    try {

        const [
            usersSnapshot,
            postsSnapshot,
            reportsSnapshot,
            liveSnapshot
        ] = await Promise.all([

            db.ref("users").once("value"),

            db.ref("posts").once("value"),

            db.ref("reports").once("value"),

            db.ref("live").once("value")

        ]);

        cachedUsers =
            usersSnapshot.val() || {};

        cachedPosts =
            postsSnapshot.val() || {};

        cachedReports =
            reportsSnapshot.val() || {};

        cachedLive =
            liveSnapshot.val() || {};

        updateDashboardStats();

        renderRecentUsers(
            cachedUsers
        );

        renderRecentReports(
            cachedReports
        );

        updateNotificationCount();

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        showToast(
            "Unable to load dashboard.",
            "error"
        );
    }
}

/* =========================================================
   DASHBOARD STATS
========================================================= */

function updateDashboardStats() {

    const users =
        Object.values(cachedUsers || {});

    const posts =
        Object.values(cachedPosts || {});

    const reports =
        Object.values(cachedReports || {});

    const live =
        Object.values(cachedLive || {});

    const activeLive =
        live.filter(item =>
            item &&
            (
                item.active === true ||
                item.status === "live"
            )
        );

    const totalViews =
        posts.reduce(
            (sum, post) =>
                sum +
                Number(
                    post?.views ||
                    post?.viewCount ||
                    0
                ),
            0
        );

    const pendingReports =
        reports.filter(report =>
            !report ||
            report.status !== "resolved"
        ).length;

    setText(
        "totalUsers",
        formatNumber(users.length)
    );

    setText(
        "totalPosts",
        formatNumber(posts.length)
    );

    setText(
        "totalViews",
        formatNumber(totalViews)
    );

    setText(
        "liveNow",
        formatNumber(activeLive.length)
    );

    setText(
        "userNavCount",
        formatNumber(users.length)
    );

    setText(
        "reportNavCount",
        formatNumber(pendingReports)
    );

    setText(
        "liveNavCount",
        formatNumber(activeLive.length)
    );

    setText(
        "notificationBadge",
        formatNumber(pendingReports)
    );

    setText(
        "usersGrowth",
        "+0%"
    );

    setText(
        "postsGrowth",
        "+0%"
    );

    setText(
        "viewsGrowth",
        "+0%"
    );

    setText(
        "liveGrowth",
        activeLive.length
            ? "LIVE"
            : "Offline"
    );
}

function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent = value;
    }
}

/* =========================================================
   RECENT USERS
========================================================= */

function renderRecentUsers(users) {

    const container =
        $("recentUsers");

    if (!container) return;

    const entries =
        Object.entries(users || {})
            .sort(
                ([, a], [, b]) =>
                    getTimestamp(b) -
                    getTimestamp(a)
            )
            .slice(0, 5);

    if (!entries.length) {

        container.innerHTML = `
            <div class="emptyState">
                <i class="fa-solid fa-users"></i>
                <span>No users yet</span>
            </div>
        `;

        return;
    }

    container.innerHTML =
        entries.map(([uid, user]) => {

            const name =
                escapeHTML(
                    getUserName(user)
                );

            const email =
                escapeHTML(
                    getUserEmail(user)
                );

            const avatar =
                escapeAttribute(
                    getUserAvatar(user)
                );

            return `
                <div class="recentUserItem">

                    <img
                        src="${avatar}"
                        alt=""
                        onerror="
                            this.src='assets/default-avatar.png'
                        "
                    >

                    <div class="recentUserInfo">

                        <strong>
                            ${name}${getUserTickHTML(user)}
                        </strong>

                        <span>
                            ${email}
                        </span>

                    </div>

                    <span class="recentUserStatus">
                        ${user?.online ? "Online" : "New"}
                    </span>

                </div>
            `;

        }).join("");
}

/* =========================================================
   RECENT REPORTS
========================================================= */

function renderRecentReports(reports) {

    const container =
        $("recentReports");

    if (!container) return;

    const entries =
        Object.entries(reports || {})
            .filter(
                ([, report]) =>
                    report?.status !== "resolved"
            )
            .sort(
                ([, a], [, b]) =>
                    getTimestamp(b) -
                    getTimestamp(a)
            )
            .slice(0, 5);

    if (!entries.length) {

        container.innerHTML = `
            <div class="emptyState">
                <i class="fa-solid fa-shield-check"></i>
                <span>No pending reports</span>
            </div>
        `;

        return;
    }

    container.innerHTML =
        entries.map(([id, report]) => {

            const reason =
                escapeHTML(
                    report?.reason ||
                    "Reported content"
                );

            return `
                <div class="recentReportItem">

                    <div class="reportMiniIcon">
                        <i class="fa-solid fa-flag"></i>
                    </div>

                    <div>

                        <strong>
                            ${reason}
                        </strong>

                        <span>
                            Pending review
                        </span>

                    </div>

                </div>
            `;

        }).join("");
}

/* =========================================================
   USERS
========================================================= */

async function loadUsers() {

    const tbody =
        $("usersTableBody");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5">
                <div class="tableEmpty">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Loading users...</span>
                </div>
            </td>
        </tr>
    `;

    try {

        const snapshot =
            await db.ref("users").once("value");

        cachedUsers =
            snapshot.val() || {};

        renderUsersTable();

        updateDashboardStats();

    } catch (error) {

        console.error(error);

        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="tableEmpty">
                        <i class="fa-solid fa-circle-xmark"></i>
                        <span>Failed to load users.</span>
                    </div>
                </td>
            </tr>
        `;

        showToast(
            "Failed to load users.",
            "error"
        );
    }
}

function renderUsersTable() {

    const tbody =
        $("usersTableBody");

    if (!tbody) return;

    const search =
        ($("userSearch")?.value || "")
            .trim()
            .toLowerCase();

    const roleFilter =
        $("userRoleFilter")?.value ||
        "all";

    const statusFilter =
        $("userStatusFilter")?.value ||
        "all";

    let entries =
        Object.entries(cachedUsers || {});

    entries.sort(
        ([, a], [, b]) =>
            getTimestamp(b) -
            getTimestamp(a)
    );

    entries =
        entries.filter(([uid, user]) => {

            const name =
                getUserName(user)
                    .toLowerCase();

            const email =
                getUserEmail(user)
                    .toLowerCase();

            const username =
                String(
                    user?.username || ""
                ).toLowerCase();

            const matchesSearch =
                !search ||
                name.includes(search) ||
                email.includes(search) ||
                username.includes(search) ||
                uid.toLowerCase().includes(search);

            const role =
                String(
                    user?.role || "user"
                ).toLowerCase();

            const matchesRole =
                roleFilter === "all" ||
                role === roleFilter;

            const status =
                user?.blocked === true
                    ? "blocked"
                    : "active";

            const matchesStatus =
                statusFilter === "all" ||
                status === statusFilter;

            return (
                matchesSearch &&
                matchesRole &&
                matchesStatus
            );
        });

    if (!entries.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="tableEmpty">
                        <i class="fa-solid fa-users"></i>
                        <span>No matching users found.</span>
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        entries.map(([uid, user]) => {

            const name =
                escapeHTML(
                    getUserName(user)
                );

            const email =
                escapeHTML(
                    getUserEmail(user)
                );

            const avatar =
                escapeAttribute(
                    getUserAvatar(user)
                );

            const role =
                escapeHTML(
                    user?.role || "user"
                );

            const blocked =
                user?.blocked === true;

            return `
                <tr>

                    <td>

                        <div class="tableUser">

                            <img
                                src="${avatar}"
                                alt=""
                                onerror="
                                    this.src='assets/default-avatar.png'
                                "
                            >

                            <div>

                                <strong>
                                    ${name}${getUserTickHTML(user)}
                                </strong>

                                <span>
                                    ${email}
                                </span>

                            </div>

                        </div>

                    </td>

                    <td>
                        <span class="roleBadge">
                            ${role}
                        </span>
                    </td>

                    <td>

                        <span class="statusBadge ${
                            blocked
                                ? "blocked"
                                : "active"
                        }">

                            ${blocked
                                ? "Blocked"
                                : "Active"}

                        </span>

                    </td>

                    <td>
                        ${formatDate(
                            user?.createdAt ||
                            user?.joinedAt
                        )}
                    </td>

                    <td>

                        <button
                            class="tableActionBtn"
                            data-user-action="view"
                            data-user-id="${escapeAttribute(uid)}"
                            title="Manage user"
                        >

                            <i class="fa-solid fa-ellipsis"></i>

                        </button>

                    </td>

                </tr>
            `;

        }).join("");

    qsa("[data-user-action]", tbody)
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openUserModal(
                        button.dataset.userId
                    );

                }
            );

        });
}

/* =========================================================
   USER FILTERS
========================================================= */

const userSearch =
    $("userSearch");

if (userSearch) {
    userSearch.addEventListener(
        "input",
        renderUsersTable
    );
}

const userRoleFilter =
    $("userRoleFilter");

if (userRoleFilter) {
    userRoleFilter.addEventListener(
        "change",
        renderUsersTable
    );
}

const userStatusFilter =
    $("userStatusFilter");

if (userStatusFilter) {
    userStatusFilter.addEventListener(
        "change",
        renderUsersTable
    );
}

/* =========================================================
   USER MODAL
========================================================= */

function openUserModal(uid) {

    const user =
        cachedUsers?.[uid];

    if (!user) {

        showToast(
            "User not found.",
            "error"
        );

        return;
    }

    selectedUserId = uid;

    const modal =
        $("userModal");

    if (!modal) return;

    const title =
        $("userModalTitle");

    const description =
        $("userModalDescription");

    if (title) {
        title.textContent =
            getUserName(user);
    }

    if (description) {
        description.textContent =
            getUserEmail(user);
    }

    const blockButton =
        $("blockUserBtn");

    if (blockButton) {

        blockButton.innerHTML =
            user.blocked
                ? `
                    <i class="fa-solid fa-unlock"></i>
                    Unblock User
                  `
                : `
                    <i class="fa-solid fa-ban"></i>
                    Block User
                  `;
    }

    /* Inject Verify + Monetize actions if missing */
    const actions = $("userModalActions");
    if (actions) {
        if (!$("grantBlueTickBtn")) {
            const btn = document.createElement("button");
            btn.id = "grantBlueTickBtn";
            btn.className = "modalAction";
            btn.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                <span id="grantBlueTickLabel">Grant Blue Tick</span>
            `;
            btn.addEventListener("click", async () => {
                if (!selectedUserId) return;
                const u = cachedUsers[selectedUserId] || {};
                const isVerified =
                    u.verified === true ||
                    u.isVerified === true ||
                    u.blueTick === true;
                await grantBlueTick(selectedUserId, !isVerified);
                closeUserModal();
            });
            actions.appendChild(btn);
        }

        if (!$("monetizeUserBtn")) {
            const btn = document.createElement("button");
            btn.id = "monetizeUserBtn";
            btn.className = "modalAction";
            btn.innerHTML = `
                <i class="fa-solid fa-coins"></i>
                <span>Check Monetization</span>
            `;
            btn.addEventListener("click", async () => {
                if (!selectedUserId) return;
                await reviewMonetizationForUser(selectedUserId);
            });
            actions.appendChild(btn);
        }

        const tickLabel = $("grantBlueTickLabel");
        const isVerified =
            user.verified === true ||
            user.isVerified === true ||
            user.blueTick === true;
        if (tickLabel) {
            tickLabel.textContent =
                isVerified
                    ? "Remove Blue Tick"
                    : "Grant Blue Tick";
        }
    }

    modal.classList.remove("hidden");
    modal.classList.add("show");
}

function closeUserModal() {

    const modal =
        $("userModal");

    if (!modal) return;

    modal.classList.remove("show");

    setTimeout(() => {
        modal.classList.add("hidden");
    }, 180);

    selectedUserId = null;
}

const closeUserModalButton =
    $("closeUserModal");

if (closeUserModalButton) {

    closeUserModalButton.addEventListener(
        "click",
        closeUserModal
    );
}

/* =========================================================
   VIEW USER
========================================================= */

const viewUserBtn =
    $("viewUserBtn");

if (viewUserBtn) {

    viewUserBtn.addEventListener(
        "click",
        () => {

            if (!selectedUserId) return;

            const user =
                cachedUsers[selectedUserId];

            if (!user) return;

            showToast(
                `${getUserName(user)} • ${getUserEmail(user)}`
            );
        }
    );
}

/* =========================================================
   CHANGE ROLE
========================================================= */

const changeRoleBtn =
    $("changeRoleBtn");

if (changeRoleBtn) {

    changeRoleBtn.addEventListener(
        "click",
        async () => {

            if (!selectedUserId) return;

            const user =
                cachedUsers[selectedUserId];

            if (!user) return;

            const currentRole =
                user.role || "user";

            const newRole =
                window.prompt(
                    "Enter new role: user, creator, admin",
                    currentRole
                );

            if (!newRole) return;

            const allowedRoles = [
                "user",
                "creator",
                "admin"
            ];

            if (
                !allowedRoles.includes(
                    newRole.toLowerCase()
                )
            ) {

                showToast(
                    "Invalid role.",
                    "error"
                );

                return;
            }

            try {

                await db.ref(
                    "users/" +
                    selectedUserId
                ).update({
                    role: newRole.toLowerCase()
                });

                showToast(
                    "User role updated."
                );

                closeUserModal();
                await loadUsers();

            } catch (error) {

                console.error(error);

                showToast(
                    "Unable to change role.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   BLOCK / UNBLOCK USER
========================================================= */

const blockUserBtn =
    $("blockUserBtn");

if (blockUserBtn) {

    blockUserBtn.addEventListener(
        "click",
        () => {

            if (!selectedUserId) return;

            const user =
                cachedUsers[selectedUserId];

            if (!user) return;

            const shouldBlock =
                user.blocked !== true;

            openConfirmModal(
                shouldBlock
                    ? "Block User?"
                    : "Unblock User?",
                shouldBlock
                    ? "This user will be blocked from the platform."
                    : "This user will be allowed to use the platform again.",
                async () => {

                    try {

                        await db.ref(
                            "users/" +
                            selectedUserId
                        ).update({
                            blocked: shouldBlock
                        });

                        showToast(
                            shouldBlock
                                ? "User blocked."
                                : "User unblocked."
                        );

                        closeUserModal();

                        await loadUsers();

                    } catch (error) {

                        console.error(error);

                        showToast(
                            "Unable to update user.",
                            "error"
                        );
                    }
                }
            );
        }
    );
}

/* =========================================================
   CONTENT
========================================================= */

async function loadPosts() {

    const grid =
        $("contentGrid");

    if (!grid) return;

    grid.innerHTML = `
        <div class="largeEmptyState">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <h3>Loading content...</h3>
            <p>Please wait.</p>
        </div>
    `;

    try {

        const snapshot =
            await db.ref("posts").once("value");

        cachedPosts =
            snapshot.val() || {};

        renderContent();

        updateDashboardStats();

    } catch (error) {

        console.error(error);

        grid.innerHTML = `
            <div class="largeEmptyState">
                <i class="fa-solid fa-circle-xmark"></i>
                <h3>Unable to load content</h3>
                <p>Please try again.</p>
            </div>
        `;

        showToast(
            "Failed to load content.",
            "error"
        );
    }
}

/* =========================================================
   CONTENT FILTER
========================================================= */

qsa(".contentFilter").forEach(button => {

    button.addEventListener(
        "click",
        () => {

            qsa(".contentFilter")
                .forEach(item =>
                    item.classList.remove("active")
                );

            button.classList.add("active");

            renderContent();
        }
    );
});

function renderContent() {

    const grid =
        $("contentGrid");

    if (!grid) return;

    const activeFilter =
        qs(".contentFilter.active")
            ?.dataset.contentFilter ||
        "all";

    let entries =
        Object.entries(
            cachedPosts || {}
        );

    entries.sort(
        ([, a], [, b]) =>
            getTimestamp(b) -
            getTimestamp(a)
    );

    entries =
        entries.filter(
            ([, post]) => {

                if (activeFilter === "all") {
                    return true;
                }

                return getContentType(post) ===
                    activeFilter;
            }
        );

    if (!entries.length) {

        grid.innerHTML = `
            <div class="largeEmptyState">
                <i class="fa-solid fa-photo-film"></i>
                <h3>No content available</h3>
                <p>Published content will appear here.</p>
            </div>
        `;

        return;
    }

    grid.innerHTML =
        entries.map(([id, post]) => {

            const type =
                getContentType(post);

            const title =
                escapeHTML(
                    post?.title ||
                    post?.caption ||
                    "Untitled content"
                );

            const author =
                escapeHTML(
                    post?.username ||
                    post?.userName ||
                    post?.authorName ||
                    "Viewora Creator"
                );

            const views =
                formatNumber(
                    post?.views ||
                    post?.viewCount ||
                    0
                );

            const icon =
                type === "short"
                    ? "fa-bolt"
                    : type === "video"
                        ? "fa-video"
                        : "fa-image";

            return `
                <div
                    class="contentAdminCard"
                    data-content-type="${type}"
                >

                    <div class="contentAdminIcon">
                        <i class="fa-solid ${icon}"></i>
                    </div>

                    <div class="contentAdminInfo">

                        <span class="contentTypeBadge">
                            ${type.toUpperCase()}
                        </span>

                        <h3>
                            ${title}
                        </h3>

                        <p>
                            ${author}
                        </p>

                        <small>
                            <i class="fa-solid fa-eye"></i>
                            ${views} views
                        </small>

                    </div>

                    <button
                        class="contentDeleteBtn"
                        data-delete-post="${escapeAttribute(id)}"
                        title="Delete content"
                    >

                        <i class="fa-solid fa-trash"></i>

                    </button>

                </div>
            `;

        }).join("");

    qsa(
        "[data-delete-post]",
        grid
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                deletePost(
                    button.dataset.deletePost
                );

            }
        );
    });
}

function getContentType(post) {

    const type =
        String(
            post?.type ||
            post?.contentType ||
            "post"
        ).toLowerCase();

    if (
        type === "short" ||
        type === "shorts" ||
        type === "reel"
    ) {
        return "short";
    }

    if (
        type === "video" ||
        type === "long" ||
        type === "longvideo"
    ) {
        return "video";
    }

    return "post";
}

/* =========================================================
   DELETE CONTENT
========================================================= */

async function deletePost(postId) {

    if (!postId) return;

    openConfirmModal(
        "Delete Content?",
        "This content will be permanently removed.",
        async () => {

            try {

                await db.ref(
                    "posts/" + postId
                ).remove();

                showToast(
                    "Content deleted successfully."
                );

                await loadPosts();

                await loadDashboard();

            } catch (error) {

                console.error(error);

                showToast(
                    "Unable to delete content.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   REPORTS
========================================================= */

async function loadReports() {

    const container =
        $("reportsContainer");

    if (!container) return;

    container.innerHTML = `
        <div class="largeEmptyState">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <h3>Loading reports...</h3>
            <p>Please wait.</p>
        </div>
    `;

    try {

        const snapshot =
            await db.ref("reports").once("value");

        cachedReports =
            snapshot.val() || {};

        renderReports();

        updateDashboardStats();

    } catch (error) {

        console.error(error);

        showToast(
            "Failed to load reports.",
            "error"
        );
    }
}

/* =========================================================
   REPORT FILTER
========================================================= */

const reportFilter =
    $("reportFilter");

if (reportFilter) {

    reportFilter.addEventListener(
        "change",
        renderReports
    );
}

function renderReports() {

    const container =
        $("reportsContainer");

    if (!container) return;

    const filter =
        reportFilter?.value ||
        "pending";

    let entries =
        Object.entries(
            cachedReports || {}
        );

    entries.sort(
        ([, a], [, b]) =>
            getTimestamp(b) -
            getTimestamp(a)
    );

    entries =
        entries.filter(
            ([, report]) => {

                const status =
                    report?.status ||
                    "pending";

                if (filter === "all") {
                    return true;
                }

                return status === filter;
            }
        );

    if (!entries.length) {

        container.innerHTML = `
            <div class="largeEmptyState">
                <i class="fa-solid fa-flag"></i>
                <h3>No reports</h3>
                <p>No reports match the selected filter.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        entries.map(([id, report]) => {

            const reasonKey = String(report?.reason || "other").toLowerCase();
            const reasonLabels = {
                spam: "Spam or misleading",
                impersonation: "Impersonation or fake account",
                harassment: "Harassment or bullying",
                hate: "Hate or abusive content",
                inappropriate: "Inappropriate content",
                dangerous: "Dangerous or harmful",
                copyright: "Copyright issue",
                privacy: "Privacy violation",
                scam: "Scam or fraud",
                other: "Something else"
            };
            const reason =
                escapeHTML(
                    reasonLabels[reasonKey] ||
                    report?.reason ||
                    "Reported content"
                );

            const status =
                escapeHTML(
                    report?.status ||
                    "pending"
                );

            const reporter =
                escapeHTML(
                    report?.reporterName ||
                    report?.reporterEmail ||
                    report?.username ||
                    "Community member"
                );

            const reportType =
                escapeHTML(
                    report?.type ||
                    "content"
                );

            const details =
                escapeHTML(
                    (report?.details || "").slice(0, 120)
                );

            const resolved =
                status === "resolved";

            return `
                <div
                    class="reportAdminCard"
                    data-report-id="${escapeAttribute(id)}"
                >

                    <div class="reportAdminIcon">
                        <i class="fa-solid fa-flag"></i>
                    </div>

                    <div class="reportAdminInfo">

                        <span class="reportReason">
                            ${reason}
                        </span>

                        <strong>
                            ${reportType.toUpperCase()} · Reported by ${reporter}
                        </strong>

                        <small>
                            ${formatDate(
                                report?.createdAt ||
                                report?.timestamp
                            )}
                            ${report?.contentId ? " · ID: " + escapeHTML(String(report.contentId).slice(0, 12)) : ""}
                        </small>

                        ${details ? `<span class="reportMeta">${details}</span>` : ""}

                    </div>

                    <span class="reportStatus ${
                        resolved
                            ? "resolved"
                            : "pending"
                    }">
                        ${status}
                    </span>

                    ${
                        resolved
                            ? ""
                            : `
                                <button
                                    class="resolveReportBtn"
                                    data-resolve-report="${escapeAttribute(id)}"
                                >
                                    <i class="fa-solid fa-check"></i>
                                    Resolve
                                </button>
                              `
                    }

                </div>
            `;

        }).join("");

    qsa(
        "[data-resolve-report]",
        container
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                resolveReport(
                    button.dataset.resolveReport
                );

            }
        );
    });
}

/* =========================================================
   RESOLVE REPORT
========================================================= */

async function resolveReport(reportId) {

    if (!reportId) return;

    try {

        await db.ref(
            "reports/" + reportId
        ).update({

            status: "resolved",

            resolvedAt:
                firebase.database.ServerValue.TIMESTAMP,

            resolvedBy:
                currentAdmin
                    ? currentAdmin.uid
                    : null
        });

        showToast(
            "Report marked as resolved."
        );

        await loadReports();
        await loadDashboard();

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to resolve report.",
            "error"
        );
    }
}

/* =========================================================
   LIVE
========================================================= */

async function loadLive() {

    const container =
        $("liveStreamsContainer");

    if (!container) return;

    container.innerHTML = `
        <div class="largeEmptyState">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <h3>Checking live sessions...</h3>
            <p>Please wait.</p>
        </div>
    `;

    try {

        const snapshot =
            await db.ref("live").once("value");

        cachedLive =
            snapshot.val() || {};

        renderLive();

        updateDashboardStats();

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to load live sessions.",
            "error"
        );
    }
}

function renderLive() {

    const container =
        $("liveStreamsContainer");

    if (!container) return;

    const sessions =
        Object.entries(
            cachedLive || {}
        ).filter(
            ([, session]) =>
                session &&
                (
                    session.active === true ||
                    session.status === "live"
                )
        );

    if (!sessions.length) {

        container.innerHTML = `
            <div class="largeEmptyState">
                <i class="fa-solid fa-tower-broadcast"></i>
                <h3>No active streams</h3>
                <p>Active live broadcasts will appear here.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        sessions.map(([id, session]) => {

            const title =
                escapeHTML(
                    session?.title ||
                    "Live Broadcast"
                );

            const host =
                escapeHTML(
                    session?.username ||
                    session?.hostName ||
                    "Creator"
                );

            const viewers =
                formatNumber(
                    session?.viewers ||
                    session?.viewerCount ||
                    0
                );

            return `
                <div class="liveAdminCard">

                    <div class="liveAdminTop">

                        <span class="livePulse"></span>

                        <strong>
                            LIVE
                        </strong>

                    </div>

                    <h3>
                        ${title}
                    </h3>

                    <p>
                        ${host}
                    </p>

                    <div class="liveAdminMeta">

                        <span>
                            <i class="fa-solid fa-eye"></i>
                            ${viewers} viewers
                        </span>

                    </div>

                    <button
                        class="stopLiveBtn"
                        data-stop-live="${escapeAttribute(id)}"
                    >

                        <i class="fa-solid fa-stop"></i>

                        Stop Live

                    </button>

                </div>
            `;

        }).join("");

    qsa(
        "[data-stop-live]",
        container
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                stopLive(
                    button.dataset.stopLive
                );

            }
        );
    });
}

/* =========================================================
   STOP LIVE
========================================================= */

async function stopLive(liveId) {

    if (!liveId) return;

    openConfirmModal(
        "Stop Live Session?",
        "This broadcast will be ended for everyone.",
        async () => {

            try {

                await db.ref(
                    "live/" + liveId
                ).update({

                    active: false,

                    status: "ended",

                    endedAt:
                        firebase.database.ServerValue.TIMESTAMP,

                    endedBy:
                        currentAdmin
                            ? currentAdmin.uid
                            : null
                });

                showToast(
                    "Live session stopped."
                );

                await loadLive();
                await loadDashboard();

            } catch (error) {

                console.error(error);

                showToast(
                    "Unable to stop live session.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   VERIFICATION
========================================================= */

async function loadVerification() {

    const container =
        $("verificationContainer");

    if (!container) return;

    container.innerHTML = `
        <div class="largeEmptyState">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <h3>Loading requests...</h3>
            <p>Please wait.</p>
        </div>
    `;

    try {

        const snapshot =
            await db.ref(
                "verificationRequests"
            ).once("value");

        const requests =
            snapshot.val() || {};

        renderVerification(requests);

    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="largeEmptyState">
                <i class="fa-solid fa-circle-xmark"></i>
                <h3>Unable to load requests</h3>
                <p>Check your Firebase database rules.</p>
            </div>
        `;
    }
}

function renderVerification(requests) {

    const container =
        $("verificationContainer");

    if (!container) return;

    const entries =
        Object.entries(requests || {})
            .filter(
                ([, item]) =>
                    item?.status !== "approved" &&
                    item?.status !== "rejected"
            );

    if (!entries.length) {

        container.innerHTML = `
            <div class="largeEmptyState">
                <i class="fa-solid fa-circle-check"></i>
                <h3>No pending requests</h3>
                <p>Verification requests will appear here.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        entries.map(([id, request]) => {

            const name =
                escapeHTML(
                    request?.name ||
                    request?.username ||
                    "Creator"
                );

            return `
                <div class="verificationAdminCard">

                    <div class="verificationIcon">
                        <i class="fa-solid fa-user-check"></i>
                    </div>

                    <div class="verificationInfo">

                        <strong>
                            ${name}
                        </strong>

                        <span>
                            Verification request
                        </span>

                        <small>
                            ${formatDate(
                                request?.createdAt
                            )}
                        </small>

                    </div>

                    <button
                        class="verificationApproveBtn"
                        data-approve-verification="${escapeAttribute(id)}"
                    >
                        Approve
                    </button>

                    <button
                        class="verificationRejectBtn"
                        data-reject-verification="${escapeAttribute(id)}"
                    >
                        Reject
                    </button>

                </div>
            `;

        }).join("");

    qsa(
        "[data-approve-verification]",
        container
    ).forEach(button => {

        button.addEventListener(
            "click",
            () =>
                updateVerification(
                    button.dataset.approveVerification,
                    "approved"
                )
        );
    });

    qsa(
        "[data-reject-verification]",
        container
    ).forEach(button => {

        button.addEventListener(
            "click",
            () =>
                updateVerification(
                    button.dataset.rejectVerification,
                    "rejected"
                )
        );
    });
}

async function updateVerification(
    id,
    status
) {

    if (!id) return;

    try {

        const reqSnap =
            await db.ref(
                "verificationRequests/" + id
            ).once("value");

        const request =
            reqSnap.val() || {};

        const targetUID =
            request.uid ||
            request.userId ||
            request.creatorId ||
            id;

        await db.ref(
            "verificationRequests/" + id
        ).update({

            status,

            reviewedAt:
                firebase.database.ServerValue.TIMESTAMP,

            reviewedBy:
                currentAdmin
                    ? currentAdmin.uid
                    : null
        });

        /*
         * BLUE TICK
         * Approve → users/{uid}.verified = true
         * Reject  → remove verified flag
         */
        if (targetUID) {

            if (status === "approved") {

                await db.ref(
                    "users/" + targetUID
                ).update({

                    verified: true,
                    isVerified: true,
                    blueTick: true,
                    verificationStatus: "verified",
                    verifiedAt:
                        firebase.database.ServerValue.TIMESTAMP,
                    verifiedBy:
                        currentAdmin
                            ? currentAdmin.uid
                            : null
                });

            } else if (status === "rejected") {

                await db.ref(
                    "users/" + targetUID
                ).update({

                    verified: false,
                    isVerified: false,
                    blueTick: false,
                    verificationStatus: "rejected"
                });
            }
        }

        showToast(
            status === "approved"
                ? "Blue tick granted. Creator is verified."
                : "Verification rejected."
        );

        await loadVerification();

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to update verification.",
            "error"
        );
    }
}


/* =========================================================
   MONETIZATION POLICY
   Requirements:
     • 300,000 total views
     • 600 followers
     • 100 stories posted
========================================================= */

const MONETIZATION_RULES = {
    minViews: 300000,
    minFollowers: 600,
    minStories: 100
};

async function getCreatorStats(uid) {

    const stats = {
        views: 0,
        followers: 0,
        stories: 0
    };

    if (!uid) return stats;

    try {
        /* Followers */
        const folSnap =
            await db.ref(
                "followers/" + uid
            ).once("value");

        if (folSnap.exists()) {
            stats.followers =
                Object.keys(
                    folSnap.val() || {}
                ).length;
        }

        /* Also check user node counters */
        const userSnap =
            await db.ref(
                "users/" + uid
            ).once("value");

        const user =
            userSnap.val() || {};

        if (user.followersCount) {
            stats.followers = Math.max(
                stats.followers,
                Number(user.followersCount) || 0
            );
        }

        if (user.followerCount) {
            stats.followers = Math.max(
                stats.followers,
                Number(user.followerCount) || 0
            );
        }

        /* Views from posts + shorts + videos */
        const sumViews = (obj) => {
            let total = 0;
            Object.values(obj || {}).forEach((item) => {
                if (!item || typeof item !== "object") return;
                const owner =
                    item.uid ||
                    item.userId ||
                    item.ownerId ||
                    item.creatorId ||
                    "";
                if (owner !== uid) return;
                total += Number(
                    item.views ||
                    item.viewCount ||
                    0
                );
            });
            return total;
        };

        const [posts, shorts, videos] =
            await Promise.all([
                db.ref("posts").once("value"),
                db.ref("shorts").once("value"),
                db.ref("videos").once("value")
            ]);

        stats.views +=
            sumViews(posts.val()) +
            sumViews(shorts.val()) +
            sumViews(videos.val());

        if (user.totalViews) {
            stats.views = Math.max(
                stats.views,
                Number(user.totalViews) || 0
            );
        }

        /* Stories count */
        const storiesSnap =
            await db.ref("stories").once("value");

        const stories =
            storiesSnap.val() || {};

        Object.values(stories).forEach((s) => {
            if (!s || typeof s !== "object") return;
            const owner =
                s.uid ||
                s.userId ||
                s.ownerId ||
                "";
            if (owner === uid) {
                stats.stories += 1;
            }
        });

        if (user.storiesCount) {
            stats.stories = Math.max(
                stats.stories,
                Number(user.storiesCount) || 0
            );
        }

    } catch (err) {
        console.warn("Creator stats error:", err);
    }

    return stats;
}

function checkMonetizationEligibility(stats) {
    const viewsOK =
        Number(stats.views) >= MONETIZATION_RULES.minViews;
    const followersOK =
        Number(stats.followers) >= MONETIZATION_RULES.minFollowers;
    const storiesOK =
        Number(stats.stories) >= MONETIZATION_RULES.minStories;

    return {
        eligible: viewsOK && followersOK && storiesOK,
        viewsOK,
        followersOK,
        storiesOK,
        stats
    };
}

async function grantMonetization(uid, enable = true) {

    if (!uid) return;

    try {
        await db.ref("users/" + uid).update({

            monetizationEnabled: enable === true,
            monetizationStatus:
                enable === true
                    ? "active"
                    : "disabled",

            monetizationUpdatedAt:
                firebase.database.ServerValue.TIMESTAMP,

            monetizationBy:
                currentAdmin
                    ? currentAdmin.uid
                    : null
        });

        await db.ref(
            "monetization/" + uid
        ).update({

            enabled: enable === true,
            status:
                enable === true
                    ? "active"
                    : "disabled",
            policy: {
                minViews: MONETIZATION_RULES.minViews,
                minFollowers: MONETIZATION_RULES.minFollowers,
                minStories: MONETIZATION_RULES.minStories
            },
            updatedAt:
                firebase.database.ServerValue.TIMESTAMP,
            updatedBy:
                currentAdmin
                    ? currentAdmin.uid
                    : null
        });

        showToast(
            enable
                ? "Monetization enabled for creator."
                : "Monetization disabled."
        );

    } catch (error) {
        console.error(error);
        showToast(
            "Unable to update monetization.",
            "error"
        );
    }
}

async function reviewMonetizationForUser(uid) {

    if (!uid) return;

    const stats = await getCreatorStats(uid);
    const check = checkMonetizationEligibility(stats);

    const lines = [
        "Views: " +
            formatNumber(stats.views) +
            " / " +
            formatNumber(MONETIZATION_RULES.minViews) +
            (check.viewsOK ? " ✓" : " ✗"),
        "Followers: " +
            formatNumber(stats.followers) +
            " / " +
            formatNumber(MONETIZATION_RULES.minFollowers) +
            (check.followersOK ? " ✓" : " ✗"),
        "Stories: " +
            formatNumber(stats.stories) +
            " / " +
            formatNumber(MONETIZATION_RULES.minStories) +
            (check.storiesOK ? " ✓" : " ✗")
    ].join("\n");

    if (check.eligible) {

        openConfirmModal(
            "Enable Monetization?",
            "Creator meets policy:\n" + lines,
            async () => {
                await grantMonetization(uid, true);
            }
        );

    } else {

        showToast(
            "Not eligible yet. " +
                lines.replace(/\n/g, " | "),
            "warning"
        );
    }
}

/* Grant blue tick directly from user modal */
async function grantBlueTick(uid, enable = true) {

    if (!uid) return;

    try {
        await db.ref("users/" + uid).update({
            verified: enable === true,
            isVerified: enable === true,
            blueTick: enable === true,
            verificationStatus:
                enable === true
                    ? "verified"
                    : "none",
            verifiedAt:
                enable === true
                    ? firebase.database.ServerValue.TIMESTAMP
                    : null,
            verifiedBy:
                enable === true && currentAdmin
                    ? currentAdmin.uid
                    : null
        });

        showToast(
            enable
                ? "Blue tick granted."
                : "Blue tick removed."
        );

        await loadUsers();

    } catch (error) {
        console.error(error);
        showToast(
            "Unable to update verification.",
            "error"
        );
    }
}

/* =========================================================
   ANALYTICS
========================================================= */

async function loadAnalytics() {

    try {

        const usersSnapshot =
            await db.ref("users").once("value");

        const postsSnapshot =
            await db.ref("posts").once("value");

        const reportsSnapshot =
            await db.ref("reports").once("value");

        const users =
            usersSnapshot.val() || {};

        const posts =
            postsSnapshot.val() || {};

        const reports =
            reportsSnapshot.val() || {};

        const period =
            Number(
                $("analyticsPeriod")?.value ||
                7
            );

        const since =
            Date.now() -
            period * 24 * 60 * 60 * 1000;

        const newUsers =
            Object.values(users)
                .filter(
                    item =>
                        getTimestamp(item) >= since
                ).length;

        const newPosts =
            Object.values(posts)
                .filter(
                    item =>
                        getTimestamp(item) >= since
                ).length;

        const newReports =
            Object.values(reports)
                .filter(
                    item =>
                        getTimestamp(item) >= since
                ).length;

        const totalLikes =
            Object.values(posts)
                .reduce(
                    (sum, post) =>
                        sum +
                        Number(
                            post?.likesCount ||
                            post?.likes ||
                            0
                        ),
                    0
                );

        const totalViews =
            Object.values(posts)
                .reduce(
                    (sum, post) =>
                        sum +
                        Number(
                            post?.views ||
                            post?.viewCount ||
                            0
                        ),
                    0
                );

        const engagement =
            totalViews > 0
                ? Math.min(
                    100,
                    Math.round(
                        (
                            totalLikes /
                            totalViews
                        ) * 100
                    )
                )
                : 0;

        setText(
            "analyticsUsers",
            formatNumber(newUsers)
        );

        setText(
            "analyticsPosts",
            formatNumber(newPosts)
        );

        setText(
            "analyticsEngagement",
            engagement + "%"
        );

        setText(
            "analyticsReports",
            formatNumber(newReports)
        );

        renderAnalyticsChart(
            users,
            posts,
            period
        );

    } catch (error) {

        console.error(
            "Analytics error:",
            error
        );

        showToast(
            "Unable to load analytics.",
            "error"
        );
    }
}

const analyticsPeriod =
    $("analyticsPeriod");

if (analyticsPeriod) {

    analyticsPeriod.addEventListener(
        "change",
        loadAnalytics
    );
}

/* =========================================================
   SIMPLE ANALYTICS CHART
========================================================= */

function renderAnalyticsChart(
    users,
    posts,
    period
) {

    const chart =
        $("activityChart");

    if (!chart) return;

    const days =
        Math.min(period, 14);

    const now =
        new Date();

    const data = [];

    for (
        let i = days - 1;
        i >= 0;
        i--
    ) {

        const date =
            new Date(now);

        date.setHours(
            0,
            0,
            0,
            0
        );

        date.setDate(
            date.getDate() - i
        );

        const next =
            new Date(date);

        next.setDate(
            next.getDate() + 1
        );

        const userCount =
            Object.values(users)
                .filter(item => {

                    const time =
                        getTimestamp(item);

                    return (
                        time >= date.getTime() &&
                        time < next.getTime()
                    );
                }).length;

        const postCount =
            Object.values(posts)
                .filter(item => {

                    const time =
                        getTimestamp(item);

                    return (
                        time >= date.getTime() &&
                        time < next.getTime()
                    );
                }).length;

        data.push({
            label: date.toLocaleDateString(
                undefined,
                {
                    day: "2-digit",
                    month: "short"
                }
            ),
            value:
                userCount +
                postCount
        });
    }

    const max =
        Math.max(
            1,
            ...data.map(
                item => item.value
            )
        );

    chart.innerHTML = `
        <div class="adminChartBars">
            ${
                data.map(item => {

                    const height =
                        Math.max(
                            5,
                            (
                                item.value /
                                max
                            ) * 100
                        );

                    return `
                        <div class="chartBarItem">

                            <div
                                class="chartBar"
                                style="
                                    height:${height}%;
                                "
                                title="${item.label}: ${item.value}"
                            ></div>

                            <small>
                                ${escapeHTML(
                                    item.label
                                )}
                            </small>

                        </div>
                    `;

                }).join("")
            }
        </div>
    `;
}

/* =========================================================
   SETTINGS
========================================================= */

qsa(
    ".settingsArrow[data-setting]"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {

            const setting =
                button.dataset.setting;

            showToast(
                `${setting} settings will be available here.`
            );
        }
    );
});

/* =========================================================
   DATABASE STATUS
========================================================= */

function updateDatabaseStatus(online) {

    const status =
        $("databaseStatus");

    if (!status) return;

    status.textContent =
        online
            ? "Connected"
            : "Disconnected";

    status.classList.toggle(
        "online",
        online
    );
}

/* =========================================================
   REALTIME LISTENERS
========================================================= */

function startRealtimeListeners() {

    stopRealtimeListeners();

    unsubscribeUsers =
        db.ref("users").on(
            "value",
            snapshot => {

                cachedUsers =
                    snapshot.val() || {};

                updateDatabaseStatus(true);

                if (
                    currentSection ===
                    "dashboard"
                ) {

                    updateDashboardStats();

                    renderRecentUsers(
                        cachedUsers
                    );
                }

                if (
                    currentSection ===
                    "users"
                ) {

                    renderUsersTable();
                }
            },
            error => {

                console.error(error);

                updateDatabaseStatus(false);
            }
        );

    unsubscribePosts =
        db.ref("posts").on(
            "value",
            snapshot => {

                cachedPosts =
                    snapshot.val() || {};

                if (
                    currentSection ===
                    "dashboard"
                ) {
                    updateDashboardStats();
                }

                if (
                    currentSection ===
                    "posts"
                ) {
                    renderContent();
                }
            }
        );

    unsubscribeReports =
        db.ref("reports").on(
            "value",
            snapshot => {

                cachedReports =
                    snapshot.val() || {};

                if (
                    currentSection ===
                    "dashboard"
                ) {

                    updateDashboardStats();

                    renderRecentReports(
                        cachedReports
                    );
                }

                if (
                    currentSection ===
                    "reports"
                ) {
                    renderReports();
                }

                updateNotificationCount();
            }
        );

    unsubscribeLive =
        db.ref("live").on(
            "value",
            snapshot => {

                cachedLive =
                    snapshot.val() || {};

                if (
                    currentSection ===
                    "dashboard"
                ) {
                    updateDashboardStats();
                }

                if (
                    currentSection ===
                    "live"
                ) {
                    renderLive();
                }
            }
        );
}

function stopRealtimeListeners() {

    try {

        if (unsubscribeUsers) {
            db.ref("users")
                .off("value", unsubscribeUsers);
        }

        if (unsubscribePosts) {
            db.ref("posts")
                .off("value", unsubscribePosts);
        }

        if (unsubscribeReports) {
            db.ref("reports")
                .off("value", unsubscribeReports);
        }

        if (unsubscribeLive) {
            db.ref("live")
                .off("value", unsubscribeLive);
        }

    } catch (error) {
        console.warn(
            "Listener cleanup:",
            error
        );
    }

    unsubscribeUsers = null;
    unsubscribePosts = null;
    unsubscribeReports = null;
    unsubscribeLive = null;
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function updateNotificationCount() {

    const pending =
        Object.values(
            cachedReports || {}
        ).filter(
            report =>
                report?.status !== "resolved"
        ).length;

    setText(
        "notificationBadge",
        formatNumber(pending)
    );
}

const notificationBtn =
    $("notificationBtn");

if (notificationBtn) {

    notificationBtn.addEventListener(
        "click",
        openNotifications
    );
}

function openNotifications() {

    const panel =
        $("notificationPanel");

    if (!panel) return;

    const list =
        $("notificationList");

    const pendingReports =
        Object.entries(
            cachedReports || {}
        )
        .filter(
            ([, report]) =>
                report?.status !== "resolved"
        )
        .slice(0, 10);

    if (!pendingReports.length) {

        if (list) {

            list.innerHTML = `
                <div class="notificationEmpty">

                    <i class="fa-regular fa-bell-slash"></i>

                    <span>
                        No new notifications
                    </span>

                </div>
            `;
        }

    } else if (list) {

        list.innerHTML =
            pendingReports.map(
                ([, report]) => `
                    <div class="adminNotificationItem">

                        <i class="fa-solid fa-flag"></i>

                        <div>

                            <strong>
                                New report
                            </strong>

                            <span>
                                ${escapeHTML(
                                    report?.reason ||
                                    "Reported content"
                                )}
                            </span>

                        </div>

                    </div>
                `
            ).join("");
    }

    panel.classList.remove("hidden");
    panel.classList.add("show");
}

const closeNotificationBtn =
    $("closeNotificationBtn");

if (closeNotificationBtn) {

    closeNotificationBtn.addEventListener(
        "click",
        closeNotifications
    );
}

function closeNotifications() {

    const panel =
        $("notificationPanel");

    if (!panel) return;

    panel.classList.remove("show");

    setTimeout(() => {
        panel.classList.add("hidden");
    }, 180);
}

/* =========================================================
   PROFILE BUTTON
========================================================= */

const profileButton =
    $("profileButton");

if (profileButton) {

    profileButton.addEventListener(
        "click",
        () => {

            showToast(
                currentAdmin?.email ||
                "Administrator"
            );
        }
    );
}

/* =========================================================
   OPEN VIEWORA
========================================================= */

const openVieworaBtn =
    $("openVieworaBtn");

if (openVieworaBtn) {

    openVieworaBtn.addEventListener(
        "click",
        () => {

            window.open(
                "index.html",
                "_blank"
            );
        }
    );
}

/* =========================================================
   LOGOUT
========================================================= */

const adminLogoutBtn =
    $("adminLogoutBtn");

if (adminLogoutBtn) {

    adminLogoutBtn.addEventListener(
        "click",
        () => {

            openConfirmModal(
                "Logout?",
                "You will be signed out of the Viewora Admin Panel.",
                async () => {

                    try {

                        await auth.signOut();

                        window.location.replace(
                            "admin-login.html"
                        );

                    } catch (error) {

                        console.error(error);

                        showToast(
                            "Logout failed.",
                            "error"
                        );
                    }
                }
            );
        }
    );
}

/* =========================================================
   CONFIRM MODAL
========================================================= */

function openConfirmModal(
    title,
    text,
    callback
) {

    const modal =
        $("confirmModal");

    if (!modal) {

        if (
            window.confirm(
                `${title}\n\n${text}`
            )
        ) {
            callback();
        }

        return;
    }

    setText(
        "confirmTitle",
        title
    );

    setText(
        "confirmText",
        text
    );

    confirmCallback = callback;

    modal.classList.remove("hidden");
    modal.classList.add("show");
}

function closeConfirmModal() {

    const modal =
        $("confirmModal");

    if (!modal) return;

    modal.classList.remove("show");

    setTimeout(() => {
        modal.classList.add("hidden");
    }, 180);

    confirmCallback = null;
}

const confirmCancelBtn =
    $("confirmCancelBtn");

if (confirmCancelBtn) {

    confirmCancelBtn.addEventListener(
        "click",
        closeConfirmModal
    );
}

const confirmActionBtn =
    $("confirmActionBtn");

if (confirmActionBtn) {

    confirmActionBtn.addEventListener(
        "click",
        async () => {

            const callback =
                confirmCallback;

            closeConfirmModal();

            if (typeof callback === "function") {
                await callback();
            }
        }
    );
}

/* =========================================================
   MODAL BACKDROPS
========================================================= */

qsa(".modalBackdrop")
    .forEach(backdrop => {

        backdrop.addEventListener(
            "click",
            () => {

                const modal =
                    backdrop.closest(
                        ".adminModal"
                    );

                if (!modal) return;

                modal.classList.remove(
                    "show"
                );

                setTimeout(() => {
                    modal.classList.add(
                        "hidden"
                    );
                }, 180);

            }
        );
    });

/* =========================================================
   REFRESH BUTTONS
========================================================= */

const refreshUsersBtn =
    $("refreshUsersBtn");

if (refreshUsersBtn) {

    refreshUsersBtn.addEventListener(
        "click",
        async () => {

            await animateRefresh(
                refreshUsersBtn,
                loadUsers
            );
        }
    );
}

const refreshPostsBtn =
    $("refreshPostsBtn");

if (refreshPostsBtn) {

    refreshPostsBtn.addEventListener(
        "click",
        async () => {

            await animateRefresh(
                refreshPostsBtn,
                loadPosts
            );
        }
    );
}

async function animateRefresh(
    button,
    callback
) {

    if (!button) return;

    button.classList.add(
        "rotating"
    );

    try {
        await callback();
    } finally {

        setTimeout(() => {

            button.classList.remove(
                "rotating"
            );

        }, 500);
    }
}

/* =========================================================
   GLOBAL SEARCH
========================================================= */

const globalSearch =
    $("globalSearch");

if (globalSearch) {

    globalSearch.addEventListener(
        "input",
        () => {

            const query =
                globalSearch.value
                    .trim()
                    .toLowerCase();

            if (!query) return;

            if (
                currentSection ===
                "users"
            ) {

                if ($("userSearch")) {
                    $("userSearch").value =
                        query;
                }

                renderUsersTable();

            } else if (
                currentSection ===
                "posts"
            ) {

                filterContentBySearch(
                    query
                );

            } else {

                showGlobalSearchResult(
                    query
                );
            }
        }
    );
}

function filterContentBySearch(query) {

    const cards =
        qsa(
            ".contentAdminCard"
        );

    cards.forEach(card => {

        const text =
            card.textContent
                .toLowerCase();

        card.style.display =
            text.includes(query)
                ? ""
                : "none";
    });
}

function showGlobalSearchResult(query) {

    const users =
        Object.values(
            cachedUsers || {}
        );

    const userMatch =
        users.find(user =>
            getUserName(user)
                .toLowerCase()
                .includes(query) ||
            getUserEmail(user)
                .toLowerCase()
                .includes(query)
        );

    if (userMatch) {

        showToast(
            `User found: ${getUserName(userMatch)}`
        );

        return;
    }

    const posts =
        Object.values(
            cachedPosts || {}
        );

    const postMatch =
        posts.find(post =>
            String(
                post?.title ||
                post?.caption ||
                ""
            )
            .toLowerCase()
            .includes(query)
        );

    if (postMatch) {

        showToast(
            "Content found."
        );

        return;
    }

    showToast(
        "No matching result.",
        "warning"
    );
}

/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {

            closeSidebar();
            closeNotifications();
            closeUserModal();
            closeConfirmModal();
        }

        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "k"
        ) {

            event.preventDefault();

            if (globalSearch) {
                globalSearch.focus();
            }
        }
    }
);

/* =========================================================
   DATABASE CONNECTION TEST
========================================================= */

db.ref(".info/connected")
    .on(
        "value",
        snapshot => {

            updateDatabaseStatus(
                snapshot.val() === true
            );
        }
    );

/* =========================================================
   INITIAL UI
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        switchSection("dashboard");

    }
);

/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    stopRealtimeListeners
);

/* =========================================================
   GLOBAL API
   Useful if other Viewora files need these.
========================================================= */


/* =========================================================
   MUSIC STORE (ADMIN)
========================================================= */

async function loadMusicAdmin() {

    const container = $("musicAdminList");
    if (!container) return;

    container.innerHTML = `
        <div class="largeEmptyState">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <h3>Loading music...</h3>
        </div>
    `;

    try {
        const snap = await db.ref("musicLibrary").once("value");
        const data = snap.val() || {};
        let entries = Object.entries(data).map(([id, v]) => ({ id, ...v }));

        const q = ($("musicAdminSearch")?.value || "").toLowerCase().trim();
        if (q) {
            entries = entries.filter(
                (t) =>
                    String(t.title || "").toLowerCase().includes(q) ||
                    String(t.artist || "").toLowerCase().includes(q)
            );
        }

        entries.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

        if (!entries.length) {
            container.innerHTML = `
                <div class="largeEmptyState">
                    <i class="fa-solid fa-music"></i>
                    <h3>No tracks yet</h3>
                    <p>Click Add Track to upload music links.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = entries.map((t) => `
            <div class="verificationAdminCard">
                <div class="verificationIcon">
                    <i class="fa-solid fa-music"></i>
                </div>
                <div class="verificationInfo">
                    <strong>${escapeHTML(t.title || "Untitled")}</strong>
                    <span>${escapeHTML(t.artist || "Unknown")} · ${escapeHTML(t.genre || "")}</span>
                    <small>${formatNumber(t.uses || 0)} uses · ${t.active === false ? "Hidden" : "Active"}</small>
                </div>
                <button class="verificationApproveBtn" data-toggle-music="${escapeAttribute(t.id)}" data-active="${t.active === false ? "0" : "1"}">
                    ${t.active === false ? "Show" : "Hide"}
                </button>
                <button class="verificationRejectBtn" data-delete-music="${escapeAttribute(t.id)}">
                    Delete
                </button>
            </div>
        `).join("");

        qsa("[data-toggle-music]", container).forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.dataset.toggleMusic;
                const next = btn.dataset.active === "1" ? false : true;
                await db.ref("musicLibrary/" + id + "/active").set(next);
                showToast(next ? "Track visible." : "Track hidden.");
                loadMusicAdmin();
            });
        });

        qsa("[data-delete-music]", container).forEach((btn) => {
            btn.addEventListener("click", () => {
                openConfirmModal(
                    "Delete track?",
                    "This music will be removed from the store.",
                    async () => {
                        await db.ref("musicLibrary/" + btn.dataset.deleteMusic).remove();
                        showToast("Track deleted.");
                        loadMusicAdmin();
                    }
                );
            });
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="largeEmptyState">
                <i class="fa-solid fa-circle-xmark"></i>
                <h3>Failed to load music</h3>
            </div>
        `;
    }
}

function openAddMusicModal(show) {
    const modal = $("addMusicModal");
    if (!modal) return;
    if (show) {
        modal.classList.remove("hidden");
        modal.classList.add("show");
    } else {
        modal.classList.remove("show");
        setTimeout(() => modal.classList.add("hidden"), 180);
    }
}

const addMusicBtn = $("addMusicBtn");
if (addMusicBtn) {
    addMusicBtn.addEventListener("click", () => openAddMusicModal(true));
}

["closeAddMusicModal", "cancelAddMusicBtn"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("click", () => openAddMusicModal(false));
});

async function adminUploadToCloudinary(file) {
    const CLOUD_NAME = "z5m6wjdf";
    const UPLOAD_PRESET = "Viewora-upload";
    const UPLOAD_URL =
        "https://api.cloudinary.com/v1_1/" +
        CLOUD_NAME +
        "/auto/upload";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(UPLOAD_URL, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        throw new Error("Cloudinary HTTP " + response.status);
    }

    const data = await response.json();
    return data.secure_url || data.url;
}

const saveMusicBtn = $("saveMusicBtn");
if (saveMusicBtn) {
    saveMusicBtn.addEventListener("click", async () => {
        const title = $("musicTitleInput")?.value?.trim();
        const artist = $("musicArtistInput")?.value?.trim();
        const genre = $("musicGenreInput")?.value?.trim() || "Other";
        const audioFile = $("musicAudioFile")?.files?.[0];
        const coverFile = $("musicCoverFile")?.files?.[0];
        const statusEl = $("musicUploadStatus");

        if (!title) {
            showToast("Song title required.", "warning");
            return;
        }

        if (!audioFile) {
            showToast("Please choose an audio file.", "warning");
            return;
        }

        /* Max ~40MB soft limit */
        if (audioFile.size > 40 * 1024 * 1024) {
            showToast("Audio file too large (max 40MB).", "warning");
            return;
        }

        saveMusicBtn.disabled = true;
        if (statusEl) statusEl.textContent = "Uploading audio...";

        try {
            const audioUrl = await adminUploadToCloudinary(audioFile);

            let coverUrl = "";
            if (coverFile) {
                if (statusEl) statusEl.textContent = "Uploading cover...";
                coverUrl = await adminUploadToCloudinary(coverFile);
            }

            if (statusEl) statusEl.textContent = "Saving track...";

            const payload = {
                title,
                artist: artist || "Unknown",
                audioUrl,
                coverUrl: coverUrl || "",
                genre,
                duration: 0,
                uses: 0,
                trending: false,
                active: true,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            if (window.VieworaStores?.MusicStore) {
                await VieworaStores.MusicStore.addTrack(payload);
            } else {
                await db.ref("musicLibrary").push(payload);
            }

            showToast("Music track uploaded.");
            openAddMusicModal(false);

            ["musicTitleInput", "musicArtistInput", "musicGenreInput"].forEach((id) => {
                if ($(id)) $(id).value = "";
            });
            if ($("musicAudioFile")) $("musicAudioFile").value = "";
            if ($("musicCoverFile")) $("musicCoverFile").value = "";
            if (statusEl) statusEl.textContent = "";

            loadMusicAdmin();

        } catch (e) {
            console.error(e);
            showToast(
                e.message || "Upload failed. Check Cloudinary preset.",
                "error"
            );
            if (statusEl) statusEl.textContent = "Upload failed.";
        } finally {
            saveMusicBtn.disabled = false;
        }
    });
}

const musicAdminSearch = $("musicAdminSearch");
if (musicAdminSearch) {
    musicAdminSearch.addEventListener("input", () => loadMusicAdmin());
}


/* =========================================================
   STICKER STORE (ADMIN)
========================================================= */

async function loadStickersAdmin() {

    const container = $("stickerAdminList");
    if (!container) return;

    container.innerHTML = `
        <div class="largeEmptyState">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <h3>Loading packs...</h3>
        </div>
    `;

    try {
        const snap = await db.ref("stickerPacks").once("value");
        const data = snap.val() || {};
        const entries = Object.entries(data)
            .map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

        if (!entries.length) {
            container.innerHTML = `
                <div class="largeEmptyState">
                    <i class="fa-solid fa-face-smile"></i>
                    <h3>No sticker packs</h3>
                    <p>Click Add Pack to create one.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = entries.map((p) => `
            <div class="verificationAdminCard">
                <div class="verificationIcon">
                    <i class="fa-solid fa-face-smile"></i>
                </div>
                <div class="verificationInfo">
                    <strong>${escapeHTML(p.name || "Pack")}</strong>
                    <span>${escapeHTML(p.category || "General")} · ${(p.stickers || []).length} stickers</span>
                    <small>${Number(p.price) > 0 ? "₹" + p.price : "Free"} · ${p.active === false ? "Hidden" : "Active"}</small>
                </div>
                <button class="verificationApproveBtn" data-toggle-pack="${escapeAttribute(p.id)}" data-active="${p.active === false ? "0" : "1"}">
                    ${p.active === false ? "Show" : "Hide"}
                </button>
                <button class="verificationRejectBtn" data-delete-pack="${escapeAttribute(p.id)}">
                    Delete
                </button>
            </div>
        `).join("");

        qsa("[data-toggle-pack]", container).forEach((btn) => {
            btn.addEventListener("click", async () => {
                const next = btn.dataset.active === "1" ? false : true;
                await db.ref("stickerPacks/" + btn.dataset.togglePack + "/active").set(next);
                showToast(next ? "Pack visible." : "Pack hidden.");
                loadStickersAdmin();
            });
        });

        qsa("[data-delete-pack]", container).forEach((btn) => {
            btn.addEventListener("click", () => {
                openConfirmModal(
                    "Delete pack?",
                    "This sticker pack will be removed.",
                    async () => {
                        await db.ref("stickerPacks/" + btn.dataset.deletePack).remove();
                        showToast("Pack deleted.");
                        loadStickersAdmin();
                    }
                );
            });
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="largeEmptyState">
                <i class="fa-solid fa-circle-xmark"></i>
                <h3>Failed to load stickers</h3>
            </div>
        `;
    }
}

function openAddStickerModal(show) {
    const modal = $("addStickerModal");
    if (!modal) return;
    if (show) {
        modal.classList.remove("hidden");
        modal.classList.add("show");
    } else {
        modal.classList.remove("show");
        setTimeout(() => modal.classList.add("hidden"), 180);
    }
}

const addStickerPackBtn = $("addStickerPackBtn");
if (addStickerPackBtn) {
    addStickerPackBtn.addEventListener("click", () => openAddStickerModal(true));
}

["closeAddStickerModal", "cancelAddStickerBtn"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("click", () => openAddStickerModal(false));
});

const saveStickerPackBtn = $("saveStickerPackBtn");
if (saveStickerPackBtn) {
    saveStickerPackBtn.addEventListener("click", async () => {
        const name = $("stickerPackNameInput")?.value?.trim();
        let coverUrl = $("stickerPackCoverInput")?.value?.trim() || "";
        const category = $("stickerPackCategoryInput")?.value?.trim() || "General";
        const price = Number($("stickerPackPriceInput")?.value || 0);
        const urlLines = ($("stickerUrlsInput")?.value || "")
            .split(/\n/)
            .map((s) => s.trim())
            .filter(Boolean);
        const files = $("stickerFilesInput")?.files
            ? [...$("stickerFilesInput").files]
            : [];
        const statusEl = $("stickerUploadStatus");

        if (!name) {
            showToast("Pack name required.", "warning");
            return;
        }

        if (!files.length && !urlLines.length) {
            showToast("Add sticker images or URLs.", "warning");
            return;
        }

        saveStickerPackBtn.disabled = true;

        try {
            const stickers = [];

            for (let i = 0; i < files.length; i++) {
                if (statusEl) {
                    statusEl.textContent =
                        "Uploading sticker " + (i + 1) + "/" + files.length + "...";
                }
                const url = await adminUploadToCloudinary(files[i]);
                stickers.push({
                    id: "s" + (stickers.length + 1),
                    url,
                    name: "Sticker " + (stickers.length + 1)
                });
            }

            urlLines.forEach((url) => {
                stickers.push({
                    id: "s" + (stickers.length + 1),
                    url,
                    name: "Sticker " + (stickers.length + 1)
                });
            });

            if (!coverUrl && stickers[0]) {
                coverUrl = stickers[0].url;
            }

            if (statusEl) statusEl.textContent = "Saving pack...";

            const payload = {
                name,
                coverUrl: coverUrl || "",
                category,
                price,
                stickers,
                uses: 0,
                active: true,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            if (window.VieworaStores?.StickerStore) {
                await VieworaStores.StickerStore.addPack(payload);
            } else {
                await db.ref("stickerPacks").push(payload);
            }

            showToast("Sticker pack added.");
            openAddStickerModal(false);

            ["stickerPackNameInput","stickerPackCoverInput","stickerPackCategoryInput","stickerPackPriceInput","stickerUrlsInput"]
                .forEach((id) => { if ($(id)) $(id).value = ""; });
            if ($("stickerFilesInput")) $("stickerFilesInput").value = "";
            if (statusEl) statusEl.textContent = "";

            loadStickersAdmin();
        } catch (e) {
            console.error(e);
            showToast(e.message || "Failed to add pack.", "error");
            if (statusEl) statusEl.textContent = "Upload failed.";
        } finally {
            saveStickerPackBtn.disabled = false;
        }
    });
}


/* =========================================================
   MONETIZATION ADMIN LIST
========================================================= */

async function loadMonetizationAdmin() {

    const container = $("monetizationList");
    if (!container) return;

    container.innerHTML = `
        <div class="largeEmptyState">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <h3>Checking creators...</h3>
        </div>
    `;

    try {
        const usersSnap = await db.ref("users").once("value");
        const users = usersSnap.val() || {};
        const entries = Object.entries(users);

        const results = [];
        let eligibleCount = 0;

        /* Sample up to 40 users for performance */
        for (const [uid, user] of entries.slice(0, 40)) {
            let stats = { views: 0, followers: 0, stories: 0 };

            if (typeof getCreatorStats === "function") {
                stats = await getCreatorStats(uid);
            } else {
                stats.followers = Number(
                    user.followersCount ||
                    user.followerCount ||
                    0
                );
                stats.views = Number(user.totalViews || 0);
                stats.stories = Number(user.storiesCount || 0);
            }

            const check =
                typeof checkMonetizationEligibility === "function"
                    ? checkMonetizationEligibility(stats)
                    : {
                        eligible:
                            stats.views >= 300000 &&
                            stats.followers >= 600 &&
                            stats.stories >= 100,
                        stats
                    };

            if (check.eligible) eligibleCount += 1;

            results.push({
                uid,
                user,
                stats,
                eligible: check.eligible,
                enabled: user.monetizationEnabled === true
            });
        }

        results.sort((a, b) => {
            if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
            return b.stats.views - a.stats.views;
        });

        setText("monetizationEligibleCount", formatNumber(eligibleCount));

        if (!results.length) {
            container.innerHTML = `
                <div class="largeEmptyState">
                    <i class="fa-solid fa-coins"></i>
                    <h3>No creators found</h3>
                </div>
            `;
            return;
        }

        container.innerHTML = results.map((row) => {
            const name = escapeHTML(getUserName(row.user));
            return `
                <div class="verificationAdminCard">
                    <div class="verificationIcon">
                        <i class="fa-solid fa-coins"></i>
                    </div>
                    <div class="verificationInfo">
                        <strong>${name}</strong>
                        <span>
                            ${formatNumber(row.stats.views)} views ·
                            ${formatNumber(row.stats.followers)} followers ·
                            ${formatNumber(row.stats.stories)} stories
                        </span>
                        <small>
                            ${row.eligible ? "Eligible" : "Not eligible"} ·
                            ${row.enabled ? "Monetization ON" : "OFF"}
                        </small>
                    </div>
                    <button
                        class="verificationApproveBtn"
                        data-mono-uid="${escapeAttribute(row.uid)}"
                        data-mono-enable="${row.enabled ? "0" : "1"}"
                    >
                        ${row.enabled ? "Disable" : "Enable"}
                    </button>
                </div>
            `;
        }).join("");

        qsa("[data-mono-uid]", container).forEach((btn) => {
            btn.addEventListener("click", async () => {
                const uid = btn.dataset.monoUid;
                const enable = btn.dataset.monoEnable === "1";
                if (typeof grantMonetization === "function") {
                    await grantMonetization(uid, enable);
                } else {
                    await db.ref("users/" + uid).update({
                        monetizationEnabled: enable,
                        monetizationStatus: enable ? "active" : "disabled"
                    });
                    showToast(enable ? "Monetization enabled." : "Disabled.");
                }
                loadMonetizationAdmin();
            });
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="largeEmptyState">
                <i class="fa-solid fa-circle-xmark"></i>
                <h3>Failed to load monetization</h3>
            </div>
        `;
    }
}

const refreshMonetizationBtn = $("refreshMonetizationBtn");
if (refreshMonetizationBtn) {
    refreshMonetizationBtn.addEventListener("click", () => loadMonetizationAdmin());
}


window.VieworaAdmin = {

    switchSection,

    loadDashboard,

    loadUsers,

    loadPosts,

    loadReports,

    loadLive,

    loadVerification,

    loadAnalytics,

    loadMusicAdmin,

    loadStickersAdmin,

    loadMonetizationAdmin,

    showToast,

    grantBlueTick,

    grantMonetization,

    reviewMonetizationForUser,

    getCreatorStats,

    MONETIZATION_RULES

};

/* =========================================================
   END
========================================================= */