"use strict";

/*
============================================================
 VIEWORA — SEARCH PAGE
 Users (@) + Videos + Posts + Shorts
 ~40% match • real followers • badges (red/blue/white)
============================================================
*/

(() => {
    if (window.__VIEWORA_SEARCH_INITIALIZED__) {
        console.warn("Viewora search-page.js already initialized.");
        return;
    }
    window.__VIEWORA_SEARCH_INITIALIZED__ = true;

    const CONFIG = {
        recentKey: "viewora_recent_searches",
        maxRecent: 12,
        debounceDelay: 280,
        maxUsers: 30,
        maxVideos: 40,
        minSearchLength: 1,
        matchThreshold: 0.4
    };

    const $ = (id) => document.getElementById(id);

    const searchInput = $("searchInput");
    const clearSearch = $("clearSearch");
    const recentSection = $("recentSection");
    const recentList = $("recentList");
    const clearAllRecent = $("clearAllRecent");
    const trendingSection = $("trendingSection");
    const resultsSection = $("resultsSection");
    const userResults = $("userResults");
    const videoResults = $("videoResults");
    const peopleBlock = $("peopleBlock");
    const videosBlock = $("videosBlock");
    const resultCount = $("resultCount");
    const emptyState = $("emptyState");
    const emptyTitle = $("emptyTitle");
    const emptyText = $("emptyText");

    let database = null;
    let currentUser = null;
    let searchTimer = null;
    let searchRequestId = 0;

    function initFirebase() {
        try {
            if (typeof firebase !== "undefined" && firebase.database) {
                database = firebase.database();
            }
            if (typeof firebase !== "undefined" && firebase.auth) {
                currentUser = firebase.auth().currentUser;
            }
        } catch (e) {
            console.warn("Search Firebase init:", e);
        }
    }

    function normalize(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/^@+/, "");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeUrl(value, fallback) {
        const url = String(value || "").trim();
        if (!url) return fallback || "";
        if (
            url.startsWith("https://") ||
            url.startsWith("http://") ||
            url.startsWith("data:image/") ||
            url.startsWith("blob:")
        ) {
            return url;
        }
        return fallback || "";
    }

    function similarity(a, b) {
        a = normalize(a);
        b = normalize(b);
        if (!a || !b) return 0;
        if (a === b) return 1;
        if (a.includes(b) || b.includes(a)) {
            const shorter = Math.min(a.length, b.length);
            const longer = Math.max(a.length, b.length);
            return Math.max(0.55, shorter / longer);
        }
        if (a.startsWith(b) || b.startsWith(a)) return 0.75;

        function bigrams(s) {
            const out = [];
            if (s.length < 2) return [s];
            for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
            return out;
        }
        const A = bigrams(a);
        const B = bigrams(b);
        if (!A.length || !B.length) return 0;
        let inter = 0;
        const used = new Array(B.length).fill(false);
        for (let i = 0; i < A.length; i++) {
            for (let j = 0; j < B.length; j++) {
                if (!used[j] && A[i] === B[j]) {
                    used[j] = true;
                    inter++;
                    break;
                }
            }
        }
        return (2 * inter) / (A.length + B.length);
    }

    function bestFieldScore(query, fields) {
        let best = 0;
        for (const f of fields) best = Math.max(best, similarity(query, f));
        return best;
    }

    function matchesThreshold(score) {
        return score >= CONFIG.matchThreshold;
    }

    async function getRealFollowersCount(uid) {
        if (!database || !uid) return 0;
        try {
            const snap = await database.ref("followers/" + uid).once("value");
            const val = snap.val();
            if (!val) return 0;
            if (typeof val === "number") return val;
            if (typeof val === "object") return Object.keys(val).length;
            return 0;
        } catch (_) {
            return 0;
        }
    }

    function formatFollowers(n) {
        const value = Number(n) || 0;
        if (value < 1000) return value + " followers";
        if (value < 1000000) {
            return (
                (value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, "") +
                "K followers"
            );
        }
        return (value / 1000000).toFixed(1).replace(/\.0$/, "") + "M followers";
    }

    function badgeHtmlFor(user) {
        try {
            if (window.VieworaBadges) {
                if (typeof VieworaBadges.badgeHTML === "function") {
                    const h = VieworaBadges.badgeHTML(user);
                    if (typeof h === "string") return h;
                }
                if (typeof VieworaBadges.resolve === "function") {
                    const r = VieworaBadges.resolve(user);
                    if (r && typeof r === "object" && typeof r.html === "string") {
                        return r.html;
                    }
                    if (typeof r === "string") return r;
                }
            }
        } catch (_) {}

        if (
            user.redTick === true ||
            user.eliteTick === true ||
            user.vipTick === true ||
            (user.subscription &&
                (user.subscription.plan === "elite" ||
                    user.subscription.tier === "elite") &&
                (user.subscription.active === true ||
                    user.subscriptionStatus === "active"))
        ) {
            return '<span class="verified verified-red" title="VIP" style="background:#ef4444;color:#fff;width:15px;height:15px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;"><i class="fa-solid fa-check"></i></span>';
        }
        if (
            user.blueTick === true ||
            user.verified === true ||
            user.isVerified === true ||
            user.blueVerified === true
        ) {
            return '<span class="verified verified-blue" title="Verified" style="background:#3b82f6;color:#fff;width:15px;height:15px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;"><i class="fa-solid fa-check"></i></span>';
        }
        if (user.whiteTick === true || user.monetized === true) {
            return '<span class="verified verified-white" title="Creator" style="background:#fff;color:#000;width:15px;height:15px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;"><i class="fa-solid fa-check"></i></span>';
        }
        return "";
    }

    function getRecent() {
        try {
            const raw = localStorage.getItem(CONFIG.recentKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed.map(String).filter(Boolean).slice(0, CONFIG.maxRecent)
                : [];
        } catch (_) {
            return [];
        }
    }

    function saveRecent(query) {
        const clean = String(query || "").trim();
        if (!clean) return;
        let list = getRecent().filter(
            (item) => normalize(item) !== normalize(clean)
        );
        list.unshift(clean);
        list = list.slice(0, CONFIG.maxRecent);
        try {
            localStorage.setItem(CONFIG.recentKey, JSON.stringify(list));
        } catch (_) {}
        renderRecent();
    }

    function removeRecent(query) {
        const list = getRecent().filter((item) => item !== query);
        try {
            localStorage.setItem(CONFIG.recentKey, JSON.stringify(list));
        } catch (_) {}
        renderRecent();
    }

    function clearRecent() {
        try {
            localStorage.removeItem(CONFIG.recentKey);
        } catch (_) {}
        renderRecent();
    }

    function renderRecent() {
        if (!recentList) return;
        const list = getRecent();
        recentList.innerHTML = "";
        if (!list.length) {
            if (recentSection) recentSection.style.display = "none";
            return;
        }
        if (recentSection) recentSection.style.display = "block";

        list.forEach((query) => {
            const item = document.createElement("div");
            item.className = "recentItem";
            item.innerHTML =
                '<button class="recentIcon" type="button"><i class="fa-solid fa-clock-rotate-left"></i></button>' +
                '<button class="recentInfo" type="button">' +
                '<div class="recentQuery">' +
                escapeHtml(query) +
                "</div>" +
                '<div class="recentMeta">Recent search</div></button>' +
                '<button class="removeRecent" type="button"><i class="fa-solid fa-xmark"></i></button>';
            item.querySelector(".recentIcon").addEventListener("click", () =>
                performSearch(query)
            );
            item.querySelector(".recentInfo").addEventListener("click", () =>
                performSearch(query)
            );
            item.querySelector(".removeRecent").addEventListener("click", (e) => {
                e.stopPropagation();
                removeRecent(query);
            });
            recentList.appendChild(item);
        });
    }

    function showHome() {
        resultsSection && resultsSection.classList.remove("active");
        emptyState && emptyState.classList.remove("active");
        if (trendingSection) trendingSection.style.display = "block";
        if (recentSection) {
            recentSection.style.display = getRecent().length ? "block" : "none";
        }
    }

    function showLoading(query) {
        if (trendingSection) trendingSection.style.display = "none";
        if (recentSection) recentSection.style.display = "none";
        emptyState && emptyState.classList.remove("active");
        resultsSection && resultsSection.classList.add("active");
        if (resultCount) resultCount.textContent = 'Searching for "' + query + '"...';
        if (userResults) {
            userResults.innerHTML =
                '<div style="padding:24px;text-align:center;color:rgba(255,255,255,.55);"><i class="fa-solid fa-spinner fa-spin"></i> Finding results...</div>';
        }
        if (videoResults) videoResults.innerHTML = "";
        if (peopleBlock) peopleBlock.style.display = "block";
        if (videosBlock) videosBlock.style.display = "none";
    }

    function showEmpty(query) {
        resultsSection && resultsSection.classList.remove("active");
        if (trendingSection) trendingSection.style.display = "none";
        if (recentSection) recentSection.style.display = "none";
        emptyState && emptyState.classList.add("active");
        if (emptyTitle) emptyTitle.textContent = "No results found";
        if (emptyText) {
            emptyText.textContent =
                'Nothing matched "' +
                query +
                '". Try another name, @username, or video title.';
        }
    }

    function showUnavailable() {
        resultsSection && resultsSection.classList.remove("active");
        emptyState && emptyState.classList.add("active");
        if (trendingSection) trendingSection.style.display = "none";
        if (recentSection) recentSection.style.display = "none";
        if (emptyTitle) emptyTitle.textContent = "Search unavailable";
        if (emptyText)
            emptyText.textContent = "Please check your connection and try again.";
    }

    function showSearchError() {
        resultsSection && resultsSection.classList.remove("active");
        emptyState && emptyState.classList.add("active");
        if (trendingSection) trendingSection.style.display = "none";
        if (recentSection) recentSection.style.display = "none";
        if (emptyTitle) emptyTitle.textContent = "Something went wrong";
        if (emptyText)
            emptyText.textContent =
                "We couldn't complete the search. Please try again.";
    }

    function performSearch(query) {
        const clean = String(query || "").trim();
        if (clean.length < CONFIG.minSearchLength) return;
        if (searchInput) searchInput.value = clean;
        updateClear();
        saveRecent(clean);
        showLoading(clean);
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            runSearch(clean);
        }, CONFIG.debounceDelay);
    }

    function handleInput() {
        const query = searchInput ? searchInput.value.trim() : "";
        updateClear();
        clearTimeout(searchTimer);
        if (!query) {
            searchRequestId++;
            showHome();
            return;
        }
        if (query.length < CONFIG.minSearchLength) return;
        showLoading(query);
        searchTimer = setTimeout(function () {
            runSearch(query);
        }, CONFIG.debounceDelay);
    }

    async function runSearch(rawQuery) {
        const requestId = ++searchRequestId;
        const isUserOnly = rawQuery.trim().startsWith("@");
        const query = normalize(rawQuery);

        if (!database) initFirebase();
        if (!database) {
            showUnavailable();
            return;
        }

        try {
            const paths = isUserOnly
                ? ["users"]
                : ["users", "videos", "posts", "shorts"];

            const snaps = await Promise.all(
                paths.map(function (p) {
                    return database.ref(p).once("value");
                })
            );

            if (requestId !== searchRequestId) return;

            const dataMap = {};
            paths.forEach(function (p, i) {
                dataMap[p] = snaps[i].val() || {};
            });

            const users = filterUsers(dataMap.users || {}, query);
            const videos = isUserOnly
                ? []
                : filterVideos(
                      dataMap.videos || {},
                      dataMap.posts || {},
                      dataMap.shorts || {},
                      query
                  );

            await Promise.all(
                users.map(async function (m) {
                    const real = await getRealFollowersCount(m.uid);
                    if (real > 0) {
                        m.realFollowers = real;
                    } else {
                        const u = m.user || {};
                        var fc = u.followersCount || u.followers || 0;
                        if (typeof fc === "object") {
                            fc = Object.keys(fc || {}).length;
                        }
                        m.realFollowers = Number(fc) || 0;
                    }
                })
            );

            if (requestId !== searchRequestId) return;
            renderAll(users, videos, rawQuery.trim());
        } catch (error) {
            console.error("Viewora Search Error:", error);
            showSearchError();
        }
    }

    function filterUsers(usersObj, query) {
        const matches = [];
        Object.entries(usersObj).forEach(function (entry) {
            var uid = entry[0];
            var user = entry[1];
            if (!user || typeof user !== "object") return;
            if (currentUser && uid === currentUser.uid) return;

            var displayName =
                user.displayName || user.name || user.fullName || "";
            var username =
                user.username || user.userName || user.handle || "";
            var email = user.email || "";

            var score = bestFieldScore(query, [
                displayName,
                username,
                email,
                "@" + username
            ]);
            if (!matchesThreshold(score)) return;

            matches.push({ uid: uid, user: user, score: score });
        });
        matches.sort(function (a, b) {
            return b.score - a.score;
        });
        return matches.slice(0, CONFIG.maxUsers);
    }

    function videoUrlOf(item) {
        return (
            item.videoUrl ||
            item.videoURL ||
            item.video ||
            item.mediaUrl ||
            item.url ||
            item.src ||
            ""
        );
    }

    function thumbOf(item) {
        return (
            item.thumbnailUrl ||
            item.thumbnailURL ||
            item.thumbnail ||
            item.coverUrl ||
            item.cover ||
            item.poster ||
            item.mediaUrl ||
            "assets/default-avatar.png"
        );
    }

    function isPrivate(item) {
        return String(item.visibility || "public").toLowerCase() === "private";
    }

    function filterVideos(videos, posts, shorts, query) {
        var hits = [];
        var seen = {};

        function consider(id, data, kind) {
            if (!data || typeof data !== "object") return;
            if (data.deleted === true || data.archived === true) return;
            if (isPrivate(data)) return;

            var title = data.title || data.name || data.caption || "";
            var desc = data.description || data.caption || data.text || "";
            var tags = Array.isArray(data.tags)
                ? data.tags.join(" ")
                : data.hashtags || data.tags || "";
            var category = data.category || "";
            var username =
                data.username ||
                data.creatorName ||
                data.displayName ||
                data.userName ||
                "";

            var url = videoUrlOf(data);
            var isShort =
                kind === "short" ||
                data.type === "short" ||
                data.postType === "short";
            var isVideo =
                kind === "video" ||
                data.type === "video" ||
                data.mediaType === "video" ||
                data.postType === "video" ||
                Boolean(url);

            if ((kind === "video" || kind === "short") && !url) return;

            var score = bestFieldScore(query, [
                title,
                desc,
                tags,
                category,
                username
            ]);
            if (!matchesThreshold(score)) return;

            var key = String(id);
            if (seen[key]) return;
            seen[key] = true;

            hits.push({
                id: key,
                data: data,
                score: score,
                kind: isShort ? "short" : isVideo ? "video" : "post"
            });
        }

        Object.entries(videos).forEach(function (e) {
            consider(e[0], e[1], "video");
        });
        Object.entries(shorts || {}).forEach(function (e) {
            consider(e[0], e[1], "short");
        });
        Object.entries(posts || {}).forEach(function (e) {
            consider(e[0], e[1], "post");
        });

        hits.sort(function (a, b) {
            return b.score - a.score;
        });
        return hits.slice(0, CONFIG.maxVideos);
    }

    function renderAll(users, videos, query) {
        if (!users.length && !videos.length) {
            showEmpty(query);
            return;
        }

        emptyState && emptyState.classList.remove("active");
        resultsSection && resultsSection.classList.add("active");
        if (trendingSection) trendingSection.style.display = "none";
        if (recentSection) recentSection.style.display = "none";

        var total = users.length + videos.length;
        if (resultCount) {
            resultCount.textContent =
                total +
                " result" +
                (total === 1 ? "" : "s") +
                ' for "' +
                query +
                '"';
        }

        if (peopleBlock) peopleBlock.style.display = users.length ? "block" : "none";
        if (userResults) {
            userResults.innerHTML = "";
            users.forEach(function (m) {
                userResults.appendChild(
                    createUserCard(m.uid, m.user, m.realFollowers)
                );
            });
        }

        if (videosBlock)
            videosBlock.style.display = videos.length ? "block" : "none";
        if (videoResults) {
            videoResults.innerHTML = "";
            videos.forEach(function (hit) {
                videoResults.appendChild(createVideoCard(hit));
            });
        }
    }

    function createUserCard(uid, user, realFollowers) {
        var card = document.createElement("div");
        card.className = "userResult";

        var displayName =
            user.displayName || user.name || user.fullName || "Viewora User";
        var username =
            user.username || user.userName || user.handle || "";
        var avatar = safeUrl(
            user.photoURL ||
                user.profilePic ||
                user.profilePhoto ||
                user.avatar ||
                user.photo ||
                "",
            "assets/default-avatar.png"
        );

        var badgeHtml = badgeHtmlFor(user) || "";
        if (typeof badgeHtml !== "string") badgeHtml = "";

        var followers =
            typeof realFollowers === "number"
                ? realFollowers
                : Number(user.followersCount || user.followers || 0) || 0;

        card.innerHTML =
            '<button class="avatar" type="button" aria-label="Open profile">' +
            '<img src="' +
            escapeHtml(avatar) +
            '" alt="" loading="lazy" onerror="this.src=\'assets/default-avatar.png\'">' +
            "</button>" +
            '<button class="userInfo" type="button" style="text-align:left;" aria-label="Open profile">' +
            '<div class="userNameRow">' +
            '<span class="userName">' +
            escapeHtml(displayName) +
            "</span>" +
            badgeHtml +
            "</div>" +
            '<div class="username">' +
            (username ? "@" + escapeHtml(username) : "Viewora creator") +
            "</div>" +
            '<div class="followText">' +
            escapeHtml(formatFollowers(followers)) +
            "</div>" +
            "</button>" +
            '<button class="followBtn" type="button">View</button>';

        function open() {
            window.location.href =
                "profile.html?uid=" + encodeURIComponent(uid);
        }
        card.querySelector(".avatar").addEventListener("click", open);
        card.querySelector(".userInfo").addEventListener("click", open);
        card.querySelector(".followBtn").addEventListener("click", function (e) {
            e.stopPropagation();
            open();
        });

        return card;
    }

    function createVideoCard(hit) {
        var id = hit.id;
        var data = hit.data;
        var kind = hit.kind;
        var card = document.createElement("div");
        card.className = "videoResult";
        card.style.cssText =
            "display:flex;gap:12px;align-items:center;padding:10px 6px;border-radius:16px;cursor:pointer;";

        var title = data.title || data.name || data.caption || "Untitled";
        var creator =
            data.username ||
            data.creatorName ||
            data.displayName ||
            data.userName ||
            "Creator";
        var thumb = safeUrl(thumbOf(data), "assets/default-avatar.png");
        var kindLabel =
            kind === "short" ? "Short" : kind === "post" ? "Post" : "Video";

        card.innerHTML =
            '<div style="width:96px;height:56px;flex:0 0 96px;border-radius:12px;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,.08);position:relative;">' +
            '<img src="' +
            escapeHtml(thumb) +
            '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.src=\'assets/default-avatar.png\'">' +
            '<span style="position:absolute;left:6px;bottom:6px;padding:2px 6px;border-radius:6px;background:rgba(0,0,0,.65);font-size:9px;font-weight:700;">' +
            kindLabel +
            "</span></div>" +
            '<div style="min-width:0;flex:1;">' +
            '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
            escapeHtml(title) +
            "</div>" +
            '<div style="margin-top:4px;font-size:11px;color:rgba(255,255,255,.55);">@' +
            escapeHtml(String(creator).replace(/^@/, "")) +
            "</div></div>" +
            '<i class="fa-solid fa-chevron-right" style="color:rgba(255,255,255,.35);font-size:12px;"></i>';

        card.addEventListener("click", function () {
            if (kind === "short") {
                window.location.href =
                    "shorts.html?id=" + encodeURIComponent(id);
            } else if (kind === "post" && !videoUrlOf(data)) {
                window.location.href =
                    "post.html?id=" + encodeURIComponent(id);
            } else {
                window.location.href =
                    "video.html?id=" + encodeURIComponent(id);
            }
        });

        return card;
    }

    function updateClear() {
        if (!clearSearch || !searchInput) return;
        clearSearch.classList.toggle(
            "visible",
            searchInput.value.trim().length > 0
        );
    }

    function clearInput() {
        if (!searchInput) return;
        searchRequestId++;
        clearTimeout(searchTimer);
        searchInput.value = "";
        updateClear();
        showHome();
        searchInput.focus();
    }

    if (searchInput) {
        searchInput.addEventListener("input", handleInput);
        searchInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                var q = searchInput.value.trim();
                if (q) performSearch(q);
            }
            if (event.key === "Escape") clearInput();
        });
    }
    if (clearSearch) clearSearch.addEventListener("click", clearInput);
    if (clearAllRecent) clearAllRecent.addEventListener("click", clearRecent);

    document.querySelectorAll("[data-search]").forEach(function (card) {
        card.addEventListener("click", function () {
            var q = card.dataset.search;
            if (q) performSearch(q);
        });
    });

    try {
        var params = new URLSearchParams(window.location.search);
        var q = params.get("q") || params.get("query") || "";
        if (q.trim()) {
            setTimeout(function () {
                performSearch(q.trim());
            }, 200);
        }
    } catch (_) {}

    initFirebase();
    renderRecent();
    updateClear();

    try {
        if (typeof firebase !== "undefined" && firebase.auth) {
            firebase.auth().onAuthStateChanged(function (user) {
                currentUser = user || null;
            });
        }
    } catch (_) {}

    window.VieworaSearch = { search: performSearch, clear: clearInput };
})();
