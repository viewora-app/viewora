"use strict";

/*
============================================================
 VIEWORA — SEARCH PAGE
 Premium Search Engine
 Firebase Realtime Database Ready
------------------------------------------------------------
 Features:
 • Live user search
 • Username + display name matching
 • Recent searches
 • Search history
 • Verified / blue tick
 • Profile navigation
 • Debounced Firebase reads
 • Empty states
 • Loading state
 • Safe rendering
 • Mobile optimized
============================================================
*/


(() => {

    /* ======================================================
       PREVENT DOUBLE INITIALIZATION
    ====================================================== */

    if (window.__VIEWORA_SEARCH_INITIALIZED__) {
        console.warn("Viewora search-page.js already initialized.");
        return;
    }

    window.__VIEWORA_SEARCH_INITIALIZED__ = true;


    /* ======================================================
       CONFIG
    ====================================================== */

    const CONFIG = {

        recentKey: "viewora_recent_searches",

        maxRecent: 10,

        debounceDelay: 320,

        maxUsers: 25,

        usersPath: "users",

        minSearchLength: 1

    };


    /* ======================================================
       DOM
    ====================================================== */

    const searchInput =
        document.getElementById("searchInput");

    const clearSearch =
        document.getElementById("clearSearch");

    const recentSection =
        document.getElementById("recentSection");

    const recentList =
        document.getElementById("recentList");

    const clearAllRecent =
        document.getElementById("clearAllRecent");

    const trendingSection =
        document.getElementById("trendingSection");

    const resultsSection =
        document.getElementById("resultsSection");

    const userResults =
        document.getElementById("userResults");

    const resultCount =
        document.getElementById("resultCount");

    const emptyState =
        document.getElementById("emptyState");

    const emptyTitle =
        document.getElementById("emptyTitle");

    const emptyText =
        document.getElementById("emptyText");


    /* ======================================================
       FIREBASE REFERENCES
    ====================================================== */

    let database = null;

    let currentUser = null;

    let searchTimer = null;

    let searchRequestId = 0;


    /* ======================================================
       INITIALIZE FIREBASE
    ====================================================== */

    function initializeFirebase() {

        try {

            if (
                typeof window.firebase !== "undefined" &&
                typeof window.firebase.database === "function"
            ) {

                database =
                    window.firebase.database();

            }

            if (
                typeof window.firebase !== "undefined" &&
                typeof window.firebase.auth === "function"
            ) {

                currentUser =
                    window.firebase.auth().currentUser;

            }

        } catch (error) {

            console.warn(
                "Viewora Search: Firebase initialization issue.",
                error
            );

        }

    }


    /* ======================================================
       HELPERS
    ====================================================== */

    function normalize(value) {

        return String(value || "")
            .trim()
            .toLowerCase();

    }


    function escapeHtml(value) {

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function safeUrl(value, fallback = "") {

        const url =
            String(value || "").trim();

        if (!url) {
            return fallback;
        }

        if (
            url.startsWith("https://") ||
            url.startsWith("http://") ||
            url.startsWith("data:image/")
        ) {
            return url;
        }

        return fallback;
    }


    function getInitials(name) {

        const text =
            String(name || "V")
                .trim();

        if (!text) {
            return "V";
        }

        const parts =
            text.split(/\s+/);

        if (parts.length === 1) {

            return parts[0]
                .substring(0, 2)
                .toUpperCase();

        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();

    }


    /* ======================================================
       RECENT SEARCHES
    ====================================================== */

    function getRecentSearches() {

        try {

            const stored =
                localStorage.getItem(
                    CONFIG.recentKey
                );

            if (!stored) {
                return [];
            }

            const parsed =
                JSON.parse(stored);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed
                .filter(Boolean)
                .map(item => String(item))
                .slice(0, CONFIG.maxRecent);

        } catch (error) {

            return [];

        }

    }


    function saveRecentSearch(query) {

        const clean =
            String(query || "").trim();

        if (!clean) {
            return;
        }

        let recent =
            getRecentSearches();

        recent =
            recent.filter(
                item =>
                    normalize(item) !==
                    normalize(clean)
            );

        recent.unshift(clean);

        recent =
            recent.slice(
                0,
                CONFIG.maxRecent
            );

        try {

            localStorage.setItem(
                CONFIG.recentKey,
                JSON.stringify(recent)
            );

        } catch (error) {

            console.warn(
                "Viewora Search: Unable to save history.",
                error
            );

        }

        renderRecentSearches();

    }


    function removeRecentSearch(query) {

        const recent =
            getRecentSearches()
                .filter(
                    item =>
                        item !== query
                );

        try {

            localStorage.setItem(
                CONFIG.recentKey,
                JSON.stringify(recent)
            );

        } catch (error) {}

        renderRecentSearches();

    }


    function clearRecentSearches() {

        try {

            localStorage.removeItem(
                CONFIG.recentKey
            );

        } catch (error) {}

        renderRecentSearches();

    }


    /* ======================================================
       RENDER RECENT SEARCHES
    ====================================================== */

    function renderRecentSearches() {

        if (!recentList) {
            return;
        }

        const recent =
            getRecentSearches();

        recentList.innerHTML = "";

        if (!recent.length) {

            if (recentSection) {
                recentSection.style.display =
                    "none";
            }

            return;
        }

        if (recentSection) {
            recentSection.style.display =
                "block";
        }


        recent.forEach(query => {

            const item =
                document.createElement("div");

            item.className =
                "recentItem";

            item.innerHTML = `

                <button
                    class="recentIcon"
                    type="button"
                    aria-label="Search recent query"
                >
                    <i class="fa-solid fa-clock-rotate-left"></i>
                </button>

                <button
                    class="recentInfo"
                    type="button"
                >

                    <div class="recentQuery">
                        ${escapeHtml(query)}
                    </div>

                    <div class="recentMeta">
                        Recent search
                    </div>

                </button>

                <button
                    class="removeRecent"
                    type="button"
                    aria-label="Remove search"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

            `;


            const searchButton =
                item.querySelector(
                    ".recentIcon"
                );

            const infoButton =
                item.querySelector(
                    ".recentInfo"
                );

            const removeButton =
                item.querySelector(
                    ".removeRecent"
                );


            searchButton.addEventListener(
                "click",
                () => {

                    performSearch(query);

                }
            );


            infoButton.addEventListener(
                "click",
                () => {

                    performSearch(query);

                }
            );


            removeButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    removeRecentSearch(query);

                }
            );


            recentList.appendChild(item);

        });

    }


    /* ======================================================
       SEARCH STATE
    ====================================================== */

    function showHomeState() {

        if (resultsSection) {
            resultsSection.classList.remove(
                "active"
            );
        }

        if (emptyState) {
            emptyState.classList.remove(
                "active"
            );
        }

        if (trendingSection) {
            trendingSection.style.display =
                "block";
        }

        if (recentSection) {

            recentSection.style.display =
                getRecentSearches().length
                    ? "block"
                    : "none";

        }

    }


    function showLoadingState(query) {

        if (trendingSection) {
            trendingSection.style.display =
                "none";
        }

        if (recentSection) {
            recentSection.style.display =
                "none";
        }

        if (emptyState) {
            emptyState.classList.remove(
                "active"
            );
        }

        if (resultsSection) {
            resultsSection.classList.add(
                "active"
            );
        }

        if (resultCount) {

            resultCount.textContent =
                `Searching for "${query}"...`;

        }

        if (userResults) {

            userResults.innerHTML = `

                <div
                    class="searchLoading"
                    aria-label="Loading search results"
                >

                    <div class="loadingSpinner"></div>

                    <span>
                        Finding people...
                    </span>

                </div>

            `;

        }

    }


    function showEmptyState(query) {

        if (resultsSection) {
            resultsSection.classList.remove(
                "active"
            );
        }

        if (trendingSection) {
            trendingSection.style.display =
                "none";
        }

        if (recentSection) {
            recentSection.style.display =
                "none";
        }

        if (emptyState) {
            emptyState.classList.add(
                "active"
            );
        }

        if (emptyTitle) {
            emptyTitle.textContent =
                "No results found";
        }

        if (emptyText) {

            emptyText.textContent =
                `We couldn't find anyone matching "${query}". Try another name or username.`;

        }

    }


    /* ======================================================
       PERFORM SEARCH
    ====================================================== */

    function performSearch(query) {

        const clean =
            String(query || "")
                .trim();

        if (
            clean.length <
            CONFIG.minSearchLength
        ) {
            return;
        }

        if (searchInput) {
            searchInput.value =
                clean;
        }

        updateClearButton();

        saveRecentSearch(clean);

        showLoadingState(clean);

        clearTimeout(searchTimer);

        searchTimer =
            setTimeout(
                () => {

                    searchUsers(clean);

                },
                CONFIG.debounceDelay
            );

    }


    /* ======================================================
       INPUT SEARCH
    ====================================================== */

    function handleInput() {

        const query =
            searchInput
                ? searchInput.value.trim()
                : "";

        updateClearButton();

        clearTimeout(searchTimer);

        if (!query) {

            searchRequestId++;

            showHomeState();

            return;
        }

        if (
            query.length <
            CONFIG.minSearchLength
        ) {
            return;
        }

        showLoadingState(query);

        searchTimer =
            setTimeout(
                () => {

                    searchUsers(query);

                },
                CONFIG.debounceDelay
            );

    }


    /* ======================================================
       FIREBASE USER SEARCH
    ====================================================== */

    async function searchUsers(query) {

        const requestId =
            ++searchRequestId;

        const normalizedQuery =
            normalize(query);

        if (!database) {

            initializeFirebase();

        }

        if (!database) {

            showFirebaseUnavailable();

            return;
        }


        try {

            const snapshot =
                await database
                    .ref(CONFIG.usersPath)
                    .once("value");


            if (
                requestId !==
                searchRequestId
            ) {
                return;
            }


            const data =
                snapshot.val() || {};

            const matches = [];


            Object.entries(data)
                .forEach(
                    ([uid, user]) => {

                        if (!user || typeof user !== "object") {
                            return;
                        }

                        /*
                         * Prevent current user from appearing
                         * in own people search.
                         */

                        if (
                            currentUser &&
                            uid === currentUser.uid
                        ) {
                            return;
                        }


                        const displayName =
                            normalize(
                                user.displayName ||
                                user.name ||
                                user.fullName ||
                                ""
                            );


                        const username =
                            normalize(
                                user.username ||
                                user.userName ||
                                user.handle ||
                                ""
                            );


                        const email =
                            normalize(
                                user.email ||
                                ""
                            );


                        if (
                            displayName.includes(
                                normalizedQuery
                            ) ||
                            username.includes(
                                normalizedQuery
                            ) ||
                            email.includes(
                                normalizedQuery
                            )
                        ) {

                            let score = 0;


                            /*
                             * Better ranking:
                             * exact username
                             * username starts with query
                             * name starts with query
                             * contains query
                             */

                            if (
                                username ===
                                normalizedQuery
                            ) {
                                score += 100;
                            }

                            if (
                                username.startsWith(
                                    normalizedQuery
                                )
                            ) {
                                score += 60;
                            }

                            if (
                                displayName.startsWith(
                                    normalizedQuery
                                )
                            ) {
                                score += 50;
                            }

                            if (
                                username.includes(
                                    normalizedQuery
                                )
                            ) {
                                score += 30;
                            }

                            if (
                                displayName.includes(
                                    normalizedQuery
                                )
                            ) {
                                score += 20;
                            }


                            matches.push({

                                uid,

                                user,

                                score

                            });

                        }

                    }
                );


            matches.sort(
                (a, b) =>
                    b.score - a.score
            );


            const limited =
                matches.slice(
                    0,
                    CONFIG.maxUsers
                );


            renderUserResults(
                limited,
                query
            );


        } catch (error) {

            console.error(
                "Viewora Search Error:",
                error
            );

            showSearchError();

        }

    }


    /* ======================================================
       RENDER USERS
    ====================================================== */

    function renderUserResults(
        matches,
        query
    ) {

        if (!userResults) {
            return;
        }

        userResults.innerHTML = "";


        if (!matches.length) {

            showEmptyState(query);

            return;
        }


        if (trendingSection) {
            trendingSection.style.display =
                "none";
        }

        if (recentSection) {
            recentSection.style.display =
                "none";
        }

        if (emptyState) {
            emptyState.classList.remove(
                "active"
            );
        }

        if (resultsSection) {
            resultsSection.classList.add(
                "active"
            );
        }


        if (resultCount) {

            resultCount.textContent =
                `${matches.length} ${
                    matches.length === 1
                        ? "person"
                        : "people"
                } found`;

        }


        matches.forEach(
            ({ uid, user }) => {

                const card =
                    createUserCard(
                        uid,
                        user
                    );

                userResults.appendChild(
                    card
                );

            }
        );

    }


    /* ======================================================
       CREATE USER CARD
    ====================================================== */

    function createUserCard(uid, user) {

        const card =
            document.createElement("div");

        card.className =
            "userResult";


        const displayName =
            user.displayName ||
            user.name ||
            user.fullName ||
            "Viewora User";


        const username =
            user.username ||
            user.userName ||
            user.handle ||
            "";


        const avatar =
            safeUrl(
                user.photoURL ||
                user.profilePic ||
                user.profilePhoto ||
                user.avatar ||
                user.photo ||
                ""
            );


        const verified =
            Boolean(
                user.verified === true ||
                user.isVerified === true ||
                user.blueTick === true ||
                user.blueVerified === true
            );


        const followers =
            Number(
                user.followersCount ||
                user.followers ||
                0
            );


        const avatarHtml =
            avatar

                ? `
                    <img
                        src="${escapeHtml(avatar)}"
                        alt=""
                        loading="lazy"
                        referrerpolicy="no-referrer"
                    >
                `

                : `
                    <div
                        style="
                            width:100%;
                            height:100%;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-size:15px;
                            font-weight:700;
                            color:rgba(255,255,255,.65);
                        "
                    >
                        ${escapeHtml(
                            getInitials(displayName)
                        )}
                    </div>
                `;


        const verifiedHtml =
            verified

                ? `
                    <span
                        class="verified"
                        title="Verified"
                        aria-label="Verified account"
                    >
                        <i class="fa-solid fa-check"></i>
                    </span>
                `

                : "";


        const followersText =
            formatFollowers(
                followers
            );


        card.innerHTML = `

            <button
                class="avatar"
                type="button"
                aria-label="Open profile"
            >
                ${avatarHtml}
            </button>

            <button
                class="userInfo"
                type="button"
                style="text-align:left;"
                aria-label="Open profile"
            >

                <div class="userNameRow">

                    <span class="userName">
                        ${escapeHtml(displayName)}
                    </span>

                    ${verifiedHtml}

                </div>

                <div class="username">
                    ${
                        username
                            ? "@" +
                              escapeHtml(username)
                            : "Viewora creator"
                    }
                </div>

                ${
                    followers > 0

                        ? `
                            <div class="followText">
                                ${escapeHtml(
                                    followersText
                                )}
                            </div>
                        `

                        : ""
                }

            </button>

            <button
                class="followBtn"
                type="button"
                data-uid="${escapeHtml(uid)}"
            >
                View
            </button>

        `;


        const avatarButton =
            card.querySelector(
                ".avatar"
            );

        const infoButton =
            card.querySelector(
                ".userInfo"
            );

        const actionButton =
            card.querySelector(
                ".followBtn"
            );


        avatarButton.addEventListener(
            "click",
            () => openProfile(uid)
        );


        infoButton.addEventListener(
            "click",
            () => openProfile(uid)
        );


        actionButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                openProfile(uid);

            }
        );


        return card;

    }


    /* ======================================================
       PROFILE NAVIGATION
    ====================================================== */

    function openProfile(uid) {

        if (!uid) {
            return;
        }

        /*
         * Change profile page filename here
         * if your project uses another name.
         */

        const url =
            `profile.html?uid=${encodeURIComponent(uid)}`;

        window.location.href =
            url;

    }


    /* ======================================================
       FORMAT FOLLOWERS
    ====================================================== */

    function formatFollowers(number) {

        const value =
            Number(number) || 0;

        if (value < 1000) {
            return `${value} followers`;
        }

        if (value < 1000000) {

            return (
                (value / 1000)
                    .toFixed(
                        value >= 10000
                            ? 0
                            : 1
                    )
                    .replace(/\.0$/, "")
                + "K followers"
            );

        }

        return (
            (value / 1000000)
                .toFixed(1)
                .replace(/\.0$/, "")
            + "M followers"
        );

    }


    /* ======================================================
       FIREBASE UNAVAILABLE
    ====================================================== */

    function showFirebaseUnavailable() {

        if (resultsSection) {
            resultsSection.classList.remove(
                "active"
            );
        }

        if (emptyState) {
            emptyState.classList.add(
                "active"
            );
        }

        if (trendingSection) {
            trendingSection.style.display =
                "none";
        }

        if (recentSection) {
            recentSection.style.display =
                "none";
        }

        if (emptyTitle) {
            emptyTitle.textContent =
                "Search unavailable";
        }

        if (emptyText) {

            emptyText.textContent =
                "Please check your connection and try again.";

        }

    }


    /* ======================================================
       SEARCH ERROR
    ====================================================== */

    function showSearchError() {

        if (resultsSection) {
            resultsSection.classList.remove(
                "active"
            );
        }

        if (emptyState) {
            emptyState.classList.add(
                "active"
            );
        }

        if (trendingSection) {
            trendingSection.style.display =
                "none";
        }

        if (recentSection) {
            recentSection.style.display =
                "none";
        }

        if (emptyTitle) {
            emptyTitle.textContent =
                "Something went wrong";
        }

        if (emptyText) {

            emptyText.textContent =
                "We couldn't complete the search. Please try again.";

        }

    }


    /* ======================================================
       CLEAR BUTTON
    ====================================================== */

    function updateClearButton() {

        if (!clearSearch || !searchInput) {
            return;
        }

        const hasValue =
            searchInput.value.trim().length > 0;

        clearSearch.classList.toggle(
            "visible",
            hasValue
        );

    }


    function clearInput() {

        if (!searchInput) {
            return;
        }

        searchRequestId++;

        clearTimeout(searchTimer);

        searchInput.value = "";

        updateClearButton();

        showHomeState();

        searchInput.focus();

    }


    /* ======================================================
       EVENTS
    ====================================================== */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            handleInput
        );


        searchInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    const query =
                        searchInput.value.trim();

                    if (query) {
                        performSearch(query);
                    }

                }


                if (
                    event.key === "Escape"
                ) {

                    clearInput();

                }

            }
        );

    }


    if (clearSearch) {

        clearSearch.addEventListener(
            "click",
            clearInput
        );

    }


    if (clearAllRecent) {

        clearAllRecent.addEventListener(
            "click",
            clearRecentSearches
        );

    }


    /* ======================================================
       EXPLORE / TRENDING
    ====================================================== */

    document
        .querySelectorAll(
            "[data-search]"
        )
        .forEach(
            card => {

                card.addEventListener(
                    "click",
                    () => {

                        const query =
                            card.dataset.search;

                        if (!query) {
                            return;
                        }

                        performSearch(query);

                    }
                );

            }
        );


    /* ======================================================
       INITIALIZE
    ====================================================== */

    initializeFirebase();

    renderRecentSearches();

    updateClearButton();


    /* ======================================================
       AUTH STATE
    ====================================================== */

    try {

        if (
            window.firebase &&
            typeof window.firebase.auth === "function"
        ) {

            window.firebase
                .auth()
                .onAuthStateChanged(
                    user => {

                        currentUser =
                            user || null;

                    }
                );

        }

    } catch (error) {

        console.warn(
            "Viewora Search: Auth listener unavailable.",
            error
        );

    }


})();