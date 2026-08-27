/* =========================================================
   VIEWORA — USERS / DISCOVER
   users.js
   PREMIUM PROFESSIONAL USER DISCOVERY CORE

   Compatible with:
   • firebase.js V12
   • Users / Discover CSS
   • Firebase Authentication
   • Firebase Realtime Database
   • Followers
   • Following
   • Notifications
   • Online Presence
   • Profile Navigation
   • Suggested Users
   • All Users
   • Search / Filters
========================================================= */

"use strict";


/* =========================================================
   1. PREVENT DOUBLE INITIALIZATION
========================================================= */

(() => {

    if (window.__VIEWORA_USERS_INITIALIZED__) {

        console.warn(
            "VIEWORA USERS already initialized."
        );

        return;
    }

    window.__VIEWORA_USERS_INITIALIZED__ = true;


    /* =====================================================
       2. FIREBASE CHECK
    ===================================================== */

    if (
        typeof firebase === "undefined" ||
        typeof auth === "undefined" ||
        typeof db === "undefined"
    ) {

        console.error(
            "❌ Viewora Users: Firebase is not ready."
        );

        return;
    }


    /* =====================================================
       3. STATE
    ===================================================== */

    const state = {

        currentUser: null,

        currentUID: null,

        allUsers: [],

        suggestedUsers: [],

        filteredUsers: [],

        following: {},

        followers: {},

        dismissed: {},

        activeFilter: "all",

        searchQuery: "",

        loading: false,

        initialized: false

    };


    /* =====================================================
       4. DOM HELPERS
    ===================================================== */

    const $ = (
        selector,
        parent = document
    ) => {

        return parent.querySelector(selector);

    };


    const $$ = (
        selector,
        parent = document
    ) => {

        return Array.from(
            parent.querySelectorAll(selector)
        );

    };


    const findFirst = (
        selectors
    ) => {

        for (
            const selector of selectors
        ) {

            const element =
                $(selector);

            if (element) {
                return element;
            }
        }

        return null;

    };


    /* =====================================================
       5. DOM REFERENCES
    ===================================================== */

    const DOM = {

        app:
            findFirst([
                "#app",
                ".app",
                ".users-page",
                ".discover-page",
                ".page"
            ]),

        suggested:
            findFirst([
                "#suggestedUsers",
                "#suggested-users",
                ".suggested-users",
                ".suggestions-grid"
            ]),

        allUsers:
            findFirst([
                "#allUsers",
                "#all-users",
                ".all-users-list",
                ".users-grid"
            ]),

        search:
            findFirst([
                "#userSearch",
                "#usersSearch",
                "#searchUsers",
                ".user-search"
            ]),

        refresh:
            findFirst([
                "#refreshUsers",
                "#refresh-users",
                ".refresh-btn"
            ]),

        back:
            findFirst([
                "#backBtn",
                "#back-btn",
                ".back-btn"
            ]),

        count:
            findFirst([
                "#userCount",
                "#usersCount",
                ".user-count",
                ".users-count",
                ".section-count"
            ]),

        suggestedCount:
            findFirst([
                "#suggestedCount",
                "#suggested-count"
            ]),

        totalStat:
            findFirst([
                "#totalUsers",
                "#total-users",
                "[data-stat='users']",
                "[data-count='users']"
            ]),

        onlineStat:
            findFirst([
                "#onlineUsers",
                "#online-users",
                "[data-stat='online']",
                "[data-count='online']"
            ]),

        followingStat:
            findFirst([
                "#followingCount",
                "#following-count",
                "[data-stat='following']",
                "[data-count='following']"
            ]),

        emptySuggested:
            findFirst([
                "#emptySuggested",
                ".empty-suggested"
            ]),

        emptyUsers:
            findFirst([
                "#emptyUsers",
                ".empty-users"
            ])

    };


    /* =====================================================
       6. UTILITY FUNCTIONS
    ===================================================== */

    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function normalizeUsername(username) {

        return String(
            username || ""
        )
            .trim()
            .replace(/^@/, "")
            .toLowerCase();

    }


    function displayUsername(username) {

        const clean =
            String(
                username || "user"
            )
                .trim()
                .replace(/^@/, "");

        return "@" + clean;

    }


    function getUserName(user) {

        return (
            user.name ||
            user.fullName ||
            user.displayName ||
            "Viewora User"
        );

    }


    function getUserPhoto(user) {

        return (
            user.profilePhoto ||
            user.photoURL ||
            user.photoUrl ||
            "assets/default-avatar.png"
        );

    }


    function getUserBio(user) {

        return (
            user.bio ||
            "Viewora creator"
        );

    }


    function isOnline(user) {

        return (
            user.online === true
        );

    }


    function formatNumber(value) {

        const number =
            Number(value || 0);

        if (number < 1000) {
            return String(number);
        }

        if (number < 1000000) {

            return (
                (number / 1000)
                    .toFixed(
                        number >= 10000
                            ? 0
                            : 1
                    )
                    .replace(".0", "") +
                "K"
            );
        }

        if (number < 1000000000) {

            return (
                (number / 1000000)
                    .toFixed(
                        number >= 10000000
                            ? 0
                            : 1
                    )
                    .replace(".0", "") +
                "M"
            );
        }

        return (
            (number / 1000000000)
                .toFixed(1)
                .replace(".0", "") +
            "B"
        );

    }


    function isValidUser(user) {

        return (
            user &&
            typeof user === "object" &&
            user.uid
        );

    }


    /* =====================================================
       7. PROFILE NAVIGATION
    ===================================================== */

    function openProfile(uid) {

        if (!uid) {
            return;
        }

        const current =
            state.currentUID;

        if (uid === current) {

            window.location.href =
                "profile.html";

            return;
        }

        window.location.href =
            "profile.html?uid=" +
            encodeURIComponent(uid);

    }


    /* =====================================================
       8. LOAD CURRENT USER
    ===================================================== */

    async function loadCurrentUser() {

        state.currentUser =
            auth.currentUser;

        if (!state.currentUser) {

            return false;
        }

        state.currentUID =
            state.currentUser.uid;

        return true;

    }


    /* =====================================================
       9. LOAD FOLLOWING
    ===================================================== */

    async function loadFollowing() {

        if (!state.currentUID) {
            return;
        }

        try {

            const snapshot =
                await followingRef(
                    state.currentUID
                ).once("value");

            state.following =
                snapshot.exists()
                    ? (
                        snapshot.val() || {}
                    )
                    : {};

        } catch (error) {

            console.error(
                "❌ Failed to load following:",
                error
            );

            state.following = {};

        }

    }


    /* =====================================================
       10. LOAD FOLLOWERS
    ===================================================== */

    async function loadFollowers() {

        if (!state.currentUID) {
            return;
        }

        try {

            const snapshot =
                await followersRef(
                    state.currentUID
                ).once("value");

            state.followers =
                snapshot.exists()
                    ? (
                        snapshot.val() || {}
                    )
                    : {};

        } catch (error) {

            console.error(
                "❌ Failed to load followers:",
                error
            );

            state.followers = {};

        }

    }


    /* =====================================================
       11. LOAD DISMISSED USERS
    ===================================================== */

    function loadDismissed() {

        try {

            const key =
                "viewora_dismissed_users_" +
                state.currentUID;

            const saved =
                localStorage.getItem(key);

            state.dismissed =
                saved
                    ? JSON.parse(saved)
                    : {};

        } catch (error) {

            console.warn(
                "Could not load dismissed users.",
                error
            );

            state.dismissed = {};

        }

    }


    function saveDismissed() {

        try {

            const key =
                "viewora_dismissed_users_" +
                state.currentUID;

            localStorage.setItem(
                key,
                JSON.stringify(
                    state.dismissed
                )
            );

        } catch (error) {

            console.warn(
                "Could not save dismissed users.",
                error
            );

        }

    }


    /* =====================================================
       12. LOAD ALL USERS
    ===================================================== */

    async function loadUsers() {

        if (!DOM.allUsers) {
            console.warn(
                "All users container not found."
            );
        }

        state.loading = true;

        showLoading();


        try {

            const snapshot =
                await usersRef()
                    .once("value");

            const data =
                snapshot.exists()
                    ? snapshot.val()
                    : {};

            state.allUsers =
                Object.entries(data)
                    .map(
                        ([uid, user]) => {

                            return {
                                uid,
                                ...(user || {})
                            };

                        }
                    )
                    .filter(
                        isValidUser
                    )
                    .filter(
                        user =>
                            user.uid !==
                            state.currentUID
                    );


            state.allUsers.sort(
                sortUsers
            );


            state.suggestedUsers =
                buildSuggestions();


            updateStats();

            applyFilter();

        } catch (error) {

            console.error(
                "❌ Failed to load users:",
                error
            );

            state.allUsers = [];

            state.suggestedUsers = [];

            renderEmpty(
                DOM.allUsers,
                "Unable to load users",
                "Please check your connection and try again."
            );

        } finally {

            state.loading = false;

            hideLoading();

        }

    }


    /* =====================================================
       13. SORT USERS
    ===================================================== */

    function sortUsers(a, b) {

        const aOnline =
            isOnline(a)
                ? 1
                : 0;

        const bOnline =
            isOnline(b)
                ? 1
                : 0;

        if (
            bOnline !==
            aOnline
        ) {

            return (
                bOnline -
                aOnline
            );

        }

        const aFollowers =
            Number(
                a.followers || 0
            );

        const bFollowers =
            Number(
                b.followers || 0
            );

        return (
            bFollowers -
            aFollowers
        );

    }


    /* =====================================================
       14. BUILD SUGGESTIONS
    ===================================================== */

    function buildSuggestions() {

        return state.allUsers

            .filter(
                user =>
                    !state.dismissed[
                        user.uid
                    ]
            )

            .filter(
                user =>
                    !state.following[
                        user.uid
                    ]
            )

            .sort(
                (a, b) => {

                    const aScore =
                        getSuggestionScore(a);

                    const bScore =
                        getSuggestionScore(b);

                    return (
                        bScore -
                        aScore
                    );

                }
            )

            .slice(0, 8);

    }


    function getSuggestionScore(user) {

        let score = 0;

        if (isOnline(user)) {
            score += 100;
        }

        score +=
            Number(
                user.followers || 0
            ) *
            0.1;

        score +=
            Number(
                user.posts || 0
            ) *
            0.2;

        score +=
            Number(
                user.videos || 0
            ) *
            0.2;

        score +=
            Number(
                user.shorts || 0
            ) *
            0.2;

        if (user.verified === true) {
            score += 30;
        }

        return score;

    }


    /* =====================================================
       15. UPDATE STATS
    ===================================================== */

    function updateStats() {

        const total =
            state.allUsers.length;

        const online =
            state.allUsers.filter(
                isOnline
            ).length;

        const followingCount =
            Object.keys(
                state.following || {}
            ).length;


        setText(
            DOM.totalStat,
            formatNumber(
                total + 1
            )
        );

        setText(
            DOM.onlineStat,
            formatNumber(
                online
            )
        );

        setText(
            DOM.followingStat,
            formatNumber(
                followingCount
            )
        );

        setText(
            DOM.count,
            formatNumber(total)
        );

        setText(
            DOM.suggestedCount,
            formatNumber(
                state.suggestedUsers.length
            )
        );

    }


    function setText(
        element,
        value
    ) {

        if (!element) {
            return;
        }

        element.textContent =
            value;

    }


    /* =====================================================
       16. APPLY FILTER
    ===================================================== */

    function applyFilter() {

        const query =
            state.searchQuery
                .trim()
                .toLowerCase();


        let users =
            [...state.allUsers];


        if (state.activeFilter === "online") {

            users =
                users.filter(
                    isOnline
                );

        }


        if (
            state.activeFilter ===
            "popular"
        ) {

            users.sort(
                (a, b) =>
                    Number(
                        b.followers || 0
                    ) -
                    Number(
                        a.followers || 0
                    )
            );

        }


        if (
            state.activeFilter ===
            "new"
        ) {

            users.sort(
                (a, b) =>
                    Number(
                        b.createdAt || 0
                    ) -
                    Number(
                        a.createdAt || 0
                    )
            );

        }


        if (query) {

            users =
                users.filter(
                    user => {

                        const name =
                            getUserName(
                                user
                            )
                                .toLowerCase();

                        const username =
                            normalizeUsername(
                                user.username
                            );

                        const bio =
                            String(
                                user.bio || ""
                            )
                                .toLowerCase();

                        return (
                            name.includes(query) ||
                            username.includes(
                                query.replace(
                                    /^@/,
                                    ""
                                )
                            ) ||
                            bio.includes(query)
                        );

                    }
                );

        }


        state.filteredUsers =
            users;


        renderSuggested();

        renderAllUsers();

        updateStats();

    }


    /* =====================================================
       17. RENDER SUGGESTED
    ===================================================== */

    function renderSuggested() {

        if (!DOM.suggested) {
            return;
        }


        DOM.suggested.innerHTML =
            "";


        const users =
            state.suggestedUsers
                .filter(
                    user =>
                        !state.dismissed[
                            user.uid
                        ]
                )
                .slice(0, 6);


        if (!users.length) {

            renderEmpty(
                DOM.suggested,
                "No suggestions right now",
                "New people will appear here as Viewora grows."
            );

            return;
        }


        const fragment =
            document.createDocumentFragment();


        users.forEach(
            user => {

                fragment.appendChild(
                    createSuggestedCard(
                        user
                    )
                );

            }
        );


        DOM.suggested.appendChild(
            fragment
        );

    }


    /* =====================================================
       18. CREATE SUGGESTED CARD
    ===================================================== */

    function createSuggestedCard(user) {

        const card =
            document.createElement(
                "article"
            );

        card.className =
            "user-card suggested-user-card";

        card.dataset.uid =
            user.uid;


        const photo =
            escapeHTML(
                getUserPhoto(user)
            );

        const name =
            escapeHTML(
                getUserName(user)
            );

        const username =
            escapeHTML(
                displayUsername(
                    user.username
                )
            );

        const bio =
            escapeHTML(
                getUserBio(user)
            );


        card.innerHTML = `

            <div class="user-card-image">

                <img
                    src="${photo}"
                    alt="${name}"
                    loading="lazy"
                    data-profile="${user.uid}"
                >

                ${
                    isOnline(user)
                        ? `
                            <span
                                class="online-dot"
                                aria-label="Online"
                            ></span>
                        `
                        : ""
                }

                <button
                    type="button"
                    class="dismiss-user suggestion-close"
                    data-dismiss="${user.uid}"
                    aria-label="Dismiss suggestion"
                >
                    ×
                </button>

            </div>

            <div class="user-card-content">

                <h3
                    class="user-name"
                    data-profile="${user.uid}"
                    role="button"
                    tabindex="0"
                >
                    ${name}
                </h3>

                <span class="username">
                    ${username}
                </span>

                <p class="user-bio">
                    ${bio}
                </p>

                <button
                    type="button"
                    class="follow-btn"
                    data-follow="${user.uid}"
                >
                    <span>Follow</span>
                </button>

            </div>

        `;


        return card;

    }


    /* =====================================================
       19. RENDER ALL USERS
    ===================================================== */

    function renderAllUsers() {

        if (!DOM.allUsers) {
            return;
        }


        DOM.allUsers.innerHTML =
            "";


        const users =
            state.filteredUsers;


        if (!users.length) {

            renderEmpty(
                DOM.allUsers,
                "No users found",
                state.searchQuery
                    ? "Try another name or username."
                    : "There are no other users to show yet."
            );

            return;
        }


        const fragment =
            document.createDocumentFragment();


        users.forEach(
            user => {

                fragment.appendChild(
                    createUserListCard(
                        user
                    )
                );

            }
        );


        DOM.allUsers.appendChild(
            fragment
        );

    }


    /* =====================================================
       20. CREATE USER LIST CARD
    ===================================================== */

    function createUserListCard(user) {

        const card =
            document.createElement(
                "article"
            );

        card.className =
            "all-user-card user-list-card";

        card.dataset.uid =
            user.uid;


        const photo =
            escapeHTML(
                getUserPhoto(user)
            );

        const name =
            escapeHTML(
                getUserName(user)
            );

        const username =
            escapeHTML(
                displayUsername(
                    user.username
                )
            );


        const isFollowing =
            !!state.following[
                user.uid
            ];


        card.innerHTML = `

            <div
                class="avatar"
                data-profile="${user.uid}"
                role="button"
                tabindex="0"
            >

                <img
                    src="${photo}"
                    alt="${name}"
                    loading="lazy"
                >

                ${
                    isOnline(user)
                        ? `
                            <span
                                class="online-dot"
                                aria-label="Online"
                            ></span>
                        `
                        : ""
                }

            </div>


            <div
                class="user-details"
                data-profile="${user.uid}"
                role="button"
                tabindex="0"
            >

                <h3>
                    ${name}
                </h3>

                <p>
                    ${username}
                    ${
                        user.verified === true
                            ? " • ✓ Verified"
                            : ""
                    }
                </p>

            </div>


            <button
                type="button"
                class="
                    follow-btn
                    ${
                        isFollowing
                            ? "following"
                            : ""
                    }
                "
                data-follow="${user.uid}"
                aria-label="${
                    isFollowing
                        ? "Unfollow " + name
                        : "Follow " + name
                }"
            >

                ${
                    isFollowing
                        ? "Following"
                        : "Follow"
                }

            </button>

        `;


        return card;

    }


    /* =====================================================
       21. EMPTY STATE
    ===================================================== */

    function renderEmpty(
        container,
        title,
        message
    ) {

        if (!container) {
            return;
        }


        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    ✦
                </div>

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
                    ${escapeHTML(message)}
                </p>

            </div>

        `;

    }


    /* =====================================================
       22. LOADING
    ===================================================== */

    function showLoading() {

        if (!DOM.suggested &&
            !DOM.allUsers) {
            return;
        }


        if (DOM.suggested) {

            DOM.suggested.innerHTML = `

                <div class="user-skeleton"></div>
                <div class="user-skeleton"></div>

            `;

        }


        if (DOM.allUsers) {

            DOM.allUsers.innerHTML = `

                <div
                    class="user-skeleton"
                    style="min-height:86px"
                ></div>

                <div
                    class="user-skeleton"
                    style="min-height:86px"
                ></div>

                <div
                    class="user-skeleton"
                    style="min-height:86px"
                ></div>

            `;

        }

    }


    function hideLoading() {

        /* Rendering functions replace skeletons. */

    }


    /* =====================================================
       23. FOLLOW / UNFOLLOW
    ===================================================== */

    async function toggleFollow(
        targetUID,
        button
    ) {

        if (!targetUID) {
            return;
        }


        if (!state.currentUID) {

            window.location.href =
                "login.html";

            return;
        }


        if (
            targetUID ===
            state.currentUID
        ) {

            return;
        }


        const alreadyFollowing =
            !!state.following[
                targetUID
            ];


        if (button) {

            button.disabled =
                true;

            button.style.opacity =
                ".65";

        }


        try {

            if (alreadyFollowing) {

                await unfollowUser(
                    targetUID
                );

            } else {

                await followUser(
                    targetUID
                );

            }


            await refreshRelationshipData();


            updateLocalUserCounts(
                targetUID,
                !alreadyFollowing
            );


            state.suggestedUsers =
                buildSuggestions();


            applyFilter();


        } catch (error) {

            console.error(
                "❌ Follow action failed:",
                error
            );

            showToast(
                "Something went wrong. Please try again."
            );

        } finally {

            if (button) {

                button.disabled =
                    false;

                button.style.opacity =
                    "";

            }

        }

    }


    /* =====================================================
       24. FOLLOW USER
    ===================================================== */

    async function followUser(
        targetUID
    ) {

        const updates = {};


        updates[
            "following/" +
            state.currentUID +
            "/" +
            targetUID
        ] = true;


        updates[
            "followers/" +
            targetUID +
            "/" +
            state.currentUID
        ] = true;


        const target =
            state.allUsers.find(
                user =>
                    user.uid ===
                    targetUID
            );


        const currentUser =
            state.currentUser;


        const currentName =
            getUserName(
                currentUser
            );


        const currentUsername =
            normalizeUsername(
                currentUser.username ||
                currentUser.displayName ||
                "user"
            );


        const timestamp =
            firebase.database.ServerValue
                .TIMESTAMP;


        updates[
            "notifications/" +
            targetUID +
            "/" +
            state.currentUID +
            "_follow"
        ] = {

            type: "follow",

            fromUID:
                state.currentUID,

            fromName:
                currentName,

            fromUsername:
                currentUsername,

            fromPhoto:
                currentUser.photoURL ||
                currentUser.profilePhoto ||
                "assets/default-avatar.png",

            text:
                "started following you",

            createdAt:
                timestamp,

            read: false

        };


        await db.ref().update(
            updates
        );


        await updateCountersAfterFollow(
            targetUID,
            true
        );


        state.following[
            targetUID
        ] = true;


        if (target) {

            target.followers =
                Number(
                    target.followers || 0
                ) + 1;

        }

    }


    /* =====================================================
       25. UNFOLLOW USER
    ===================================================== */

    async function unfollowUser(
        targetUID
    ) {

        const updates = {};


        updates[
            "following/" +
            state.currentUID +
            "/" +
            targetUID
        ] = null;


        updates[
            "followers/" +
            targetUID +
            "/" +
            state.currentUID
        ] = null;


        await db.ref().update(
            updates
        );


        await updateCountersAfterFollow(
            targetUID,
            false
        );


        delete state.following[
            targetUID
        ];


        const target =
            state.allUsers.find(
                user =>
                    user.uid ===
                    targetUID
            );


        if (target) {

            target.followers =
                Math.max(
                    0,
                    Number(
                        target.followers || 0
                    ) - 1
                );

        }

    }


    /* =====================================================
       26. UPDATE FOLLOW COUNTERS
    ===================================================== */

    async function updateCountersAfterFollow(targetUID, following) {

    function safeNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    const currentRef = userRef(state.currentUID);
    const targetRef  = userRef(targetUID);

    const [currentSnapshot, targetSnapshot] = await Promise.all([
        currentRef.once("value"),
        targetRef.once("value")
    ]);

    const currentData = currentSnapshot.val() || {};
    const targetData  = targetSnapshot.val()  || {};

    const currentFollowing = Math.max(
        0,
        safeNumber(currentData.following) + (following ? 1 : -1)
    );

    const targetFollowers = Math.max(
        0,
        safeNumber(targetData.followers) + (following ? 1 : -1)
    );

    await Promise.all([
        currentRef.update({ following: currentFollowing }),
        targetRef.update({ followers: targetFollowers })
    ]);
}


    /* =====================================================
       27. REFRESH RELATIONSHIP DATA
    ===================================================== */

    async function refreshRelationshipData() {

        await loadFollowing();

        await loadFollowers();

    }


    /* =====================================================
       28. LOCAL COUNTER UPDATE
    ===================================================== */

    function updateLocalUserCounts(
        targetUID,
        followed
    ) {

        if (!state.currentUser) {
            return;
        }


        const currentFollowing =
            Number(
                state.currentUser.following ||
                0
            );


        state.currentUser.following =
            Math.max(
                0,
                currentFollowing +
                (
                    followed
                        ? 1
                        : -1
                )
            );

    }


    /* =====================================================
       29. DISMISS USER
    ===================================================== */

    function dismissUser(
        uid
    ) {

        if (!uid) {
            return;
        }


        state.dismissed[
            uid
        ] = true;


        saveDismissed();


        state.suggestedUsers =
            buildSuggestions();


        renderSuggested();


        showToast(
            "Suggestion removed"
        );

    }


    /* =====================================================
       30. SEARCH
    ===================================================== */

    function handleSearch(
        event
    ) {

        state.searchQuery =
            event.target.value ||
            "";

        applyFilter();

    }


    /* =====================================================
       31. FILTERS
    ===================================================== */

    function setupFilters() {

        const buttons =
            $$(".filter-btn");


        buttons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        buttons.forEach(
                            item =>
                                item.classList
                                    .remove(
                                        "active"
                                    )
                        );


                        button.classList.add(
                            "active"
                        );


                        state.activeFilter =
                            button.dataset.filter ||
                            "all";


                        applyFilter();

                    }
                );

            }
        );

    }


    /* =====================================================
       32. EVENT DELEGATION
    ===================================================== */

    function setupDelegation() {

        document.addEventListener(
            "click",
            event => {

                const followButton =
                    event.target.closest(
                        "[data-follow]"
                    );


                if (followButton) {

                    event.preventDefault();

                    event.stopPropagation();


                    const uid =
                        followButton.dataset.follow;


                    toggleFollow(
                        uid,
                        followButton
                    );

                    return;

                }


                const dismissButton =
                    event.target.closest(
                        "[data-dismiss]"
                    );


                if (dismissButton) {

                    event.preventDefault();

                    event.stopPropagation();


                    dismissUser(
                        dismissButton.dataset.dismiss
                    );

                    return;

                }


                const profileTarget =
                    event.target.closest(
                        "[data-profile]"
                    );


                if (profileTarget) {

                    const uid =
                        profileTarget.dataset.profile;


                    if (uid) {

                        openProfile(
                            uid
                        );

                    }

                    return;

                }

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Enter" &&
                    event.key !==
                    " "
                ) {
                    return;
                }


                const target =
                    event.target.closest(
                        "[data-profile]"
                    );


                if (!target) {
                    return;
                }


                event.preventDefault();


                openProfile(
                    target.dataset.profile
                );

            }
        );

    }


    /* =====================================================
       33. SEARCH EVENTS
    ===================================================== */

    function setupSearch() {

        if (!DOM.search) {
            return;
        }


        DOM.search.addEventListener(
            "input",
            handleSearch
        );


        DOM.search.addEventListener(
            "search",
            handleSearch
        );

    }


    /* =====================================================
       34. REFRESH
    ===================================================== */

    async function refreshUsers() {

        if (state.loading) {
            return;
        }


        const button =
            DOM.refresh;


        if (button) {

            button.disabled =
                true;

            button.style.transform =
                "rotate(180deg)";

        }


        try {

            await refreshRelationshipData();

            await loadUsers();


            showToast(
                "Users refreshed"
            );

        } catch (error) {

            console.error(
                "❌ Refresh failed:",
                error
            );

        } finally {

            if (button) {

                setTimeout(
                    () => {

                        button.disabled =
                            false;

                        button.style.transform =
                            "";

                    },
                    350
                );

            }

        }

    }


    /* =====================================================
       35. BACK BUTTON
    ===================================================== */

    function setupBackButton() {

        if (!DOM.back) {
            return;
        }


        DOM.back.addEventListener(
            "click",
            () => {

                if (
                    window.history.length >
                    1
                ) {

                    window.history.back();

                } else {

                    window.location.href =
                        "index.html";

                }

            }
        );

    }


    /* =====================================================
       36. TOAST
    ===================================================== */

    function showToast(
        message
    ) {

        let toast =
            document.querySelector(
                ".viewora-toast"
            );


        if (!toast) {

            toast =
                document.createElement(
                    "div"
                );

            toast.className =
                "viewora-toast";


            toast.style.position =
                "fixed";

            toast.style.left =
                "50%";

            toast.style.bottom =
                "calc(var(--nav-height, 76px) + 18px)";

            toast.style.transform =
                "translateX(-50%) translateY(15px)";

            toast.style.zIndex =
                "9999";

            toast.style.padding =
                "12px 18px";

            toast.style.borderRadius =
                "999px";

            toast.style.background =
                "rgba(20,23,39,.96)";

            toast.style.border =
                "1px solid rgba(255,255,255,.12)";

            toast.style.color =
                "#fff";

            toast.style.fontSize =
                "13px";

            toast.style.fontWeight =
                "650";

            toast.style.boxShadow =
                "0 15px 40px rgba(0,0,0,.35)";

            toast.style.backdropFilter =
                "blur(18px)";

            toast.style.transition =
                "opacity .2s ease, transform .2s ease";

            document.body.appendChild(
                toast
            );

        }


        toast.textContent =
            message;


        toast.style.opacity =
            "1";

        toast.style.transform =
            "translateX(-50%) translateY(0)";


        clearTimeout(
            toast.__timer
        );


        toast.__timer =
            setTimeout(
                () => {

                    toast.style.opacity =
                        "0";

                    toast.style.transform =
                        "translateX(-50%) translateY(15px)";

                },
                2200
            );

    }


    /* =====================================================
       37. IMAGE FALLBACK
    ===================================================== */

    function setupImageFallback() {

        document.addEventListener(
            "error",
            event => {

                const image =
                    event.target;


                if (
                    image &&
                    image.tagName ===
                    "IMG"
                ) {

                    if (
                        image.dataset
                            .fallbackApplied
                    ) {
                        return;
                    }


                    image.dataset
                        .fallbackApplied =
                        "true";


                    image.src =
                        "assets/default-avatar.png";

                }

            },
            true
        );

    }


    /* =====================================================
       38. REALTIME USER UPDATES
    ===================================================== */

    function setupRealtimeUsers() {

        usersRef().on(
            "value",
            snapshot => {

                if (!state.initialized) {
                    return;
                }


                const data =
                    snapshot.exists()
                        ? snapshot.val()
                        : {};


                state.allUsers =
                    Object.entries(data)
                        .map(
                            ([uid, user]) => {

                                return {
                                    uid,
                                    ...(user || {})
                                };

                            }
                        )
                        .filter(
                            isValidUser
                        )
                        .filter(
                            user =>
                                user.uid !==
                                state.currentUID
                        );


                state.allUsers.sort(
                    sortUsers
                );


                state.suggestedUsers =
                    buildSuggestions();


                applyFilter();

            },
            error => {

                console.error(
                    "❌ Realtime users listener:",
                    error
                );

            }
        );

    }


    /* =====================================================
       39. AUTH STATE
    ===================================================== */

    function waitForAuth() {

        return new Promise(
            resolve => {

                const unsubscribe =
                    auth.onAuthStateChanged(
                        user => {

                            unsubscribe();

                            resolve(
                                user
                            );

                        }
                    );

            }
        );

    }


    /* =====================================================
       40. INITIALIZATION
    ===================================================== */

    async function init() {

        console.log(
            "🚀 Viewora Users initializing..."
        );


        const user =
            await waitForAuth();


        if (!user) {

            console.warn(
                "👤 User is not authenticated."
            );

            return;

        }


        state.currentUser =
            user;

        state.currentUID =
            user.uid;


        loadDismissed();


        setupSearch();

        setupFilters();

        setupBackButton();

        setupDelegation();

        setupImageFallback();


        await Promise.all([

            loadFollowing(),

            loadFollowers()

        ]);


        await loadUsers();


        state.initialized =
            true;


        setupRealtimeUsers();


        console.log(
            "=========================================="
        );

        console.log(
            "🚀 VIEWORA USERS READY"
        );

        console.log(
            "👤 UID:",
            state.currentUID
        );

        console.log(
            "👥 Users:",
            state.allUsers.length
        );

        console.log(
            "⭐ Suggestions:",
            state.suggestedUsers.length
        );

        console.log(
            "=========================================="
        );

    }


    /* =====================================================
       41. GLOBAL API
    ===================================================== */

    window.VieworaUsers = {

        state,

        init,

        refresh:
            refreshUsers,

        reload:
            loadUsers,

        follow:
            followUser,

        unfollow:
            unfollowUser,

        toggleFollow,

        dismiss:
            dismissUser,

        openProfile,

        search(
            query
        ) {

            state.searchQuery =
                query || "";

            applyFilter();

        },

        getUsers() {

            return [
                ...state.allUsers
            ];

        },

        getFollowing() {

            return {
                ...state.following
            };

        }

    };


    /* =====================================================
       42. REFRESH BUTTON
    ===================================================== */

    if (DOM.refresh) {

        DOM.refresh.addEventListener(
            "click",
            refreshUsers
        );

    }


    /* =====================================================
       43. START
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();

    }


})();