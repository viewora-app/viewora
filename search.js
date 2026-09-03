// ==================== SEARCH.JS ====================
// Users + long videos + posts

document.addEventListener("DOMContentLoaded", () => {
    loadRecentVideos();
});

function getDb() {
    if (typeof firebase === "undefined") return null;
    try {
        return firebase.database();
    } catch (_) {
        return null;
    }
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function videoUrlOf(item) {
    return (
        item.videoUrl ||
        item.videoURL ||
        item.video ||
        item.mediaUrl ||
        item.url ||
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
        item.mediaUrl ||
        "assets/logo.png"
    );
}

window.search = async function () {
    const term = (document.getElementById("searchInput")?.value || "")
        .toLowerCase()
        .trim();

    const resultsContainer = document.getElementById("searchResults");
    if (!resultsContainer) return;

    if (!term) {
        resultsContainer.innerHTML =
            '<p style="text-align:center; padding:60px; color:#666;">Type something to search...</p>';
        loadRecentVideos();
        return;
    }

    const db = getDb();
    if (!db) {
        resultsContainer.innerHTML =
            '<p style="text-align:center; padding:40px; color:#888;">Firebase unavailable</p>';
        return;
    }

    resultsContainer.innerHTML =
        "<p style='text-align:center; padding:40px;'>Searching...</p>";

    try {
        const [usersSnap, videosSnap, postsSnap] = await Promise.all([
            db.ref("users").once("value"),
            db.ref("videos").once("value"),
            db.ref("posts").once("value")
        ]);

        let html = "";
        let found = false;

        /* ---- USERS ---- */
        usersSnap.forEach((child) => {
            const user = child.val() || {};
            const uid = child.key;
            const name = String(user.name || user.fullName || "").toLowerCase();
            const username = String(user.username || "").toLowerCase();

            if (name.includes(term) || username.includes(term)) {
                found = true;
                html += `
                    <div class="user-card">
                        <div>
                            <h3>${escapeHTML(user.name || user.fullName || "User")}</h3>
                            <p>@${escapeHTML(user.username || "user")}</p>
                        </div>
                        <button onclick="viewProfile('${uid}')">View</button>
                    </div>
                `;
            }
        });

        /* ---- VIDEOS ---- */
        const videoHits = [];

        const considerVideo = (id, data) => {
            if (!data) return;
            if (data.deleted === true || data.archived === true) return;

            const vis = String(data.visibility || "public").toLowerCase();
            if (vis === "private") return;

            const title = String(data.title || data.name || "").toLowerCase();
            const desc = String(data.description || data.caption || "").toLowerCase();
            const tags = String(data.hashtags || data.tags || "").toLowerCase();
            const category = String(data.category || "").toLowerCase();
            const username = String(data.username || data.creatorName || "").toLowerCase();

            if (
                title.includes(term) ||
                desc.includes(term) ||
                tags.includes(term) ||
                category.includes(term) ||
                username.includes(term)
            ) {
                if (videoUrlOf(data)) {
                    videoHits.push({ id, data });
                }
            }
        };

        videosSnap.forEach((child) => {
            considerVideo(child.key, child.val() || {});
        });

        postsSnap.forEach((child) => {
            const data = child.val() || {};
            const type = String(data.type || "").toLowerCase();
            if (
                type === "video" ||
                type === "long_video" ||
                type === "long-video" ||
                videoUrlOf(data)
            ) {
                considerVideo(child.key, data);
            }
        });

        // de-dupe by id
        const seen = new Set();
        videoHits.forEach(({ id, data }) => {
            if (seen.has(id)) return;
            seen.add(id);
            found = true;
            html += `
                <div class="video-card" onclick="viewVideo('${id}')">
                    <img src="${escapeHTML(thumbOf(data))}" class="thumbnail" alt="">
                    <div class="video-info">
                        <h3>${escapeHTML(data.title || data.name || "Untitled video")}</h3>
                        <p>${escapeHTML(data.username || data.creatorName || "Creator")}</p>
                    </div>
                </div>
            `;
        });

        resultsContainer.innerHTML = found
            ? html
            : `<p style="text-align:center; padding:60px; color:#888;">No results for "${escapeHTML(term)}"</p>`;

    } catch (error) {
        console.error("Search error:", error);
        resultsContainer.innerHTML =
            '<p style="text-align:center; padding:40px; color:#888;">Search failed. Try again.</p>';
    }
};

function loadRecentVideos() {
    const container = document.getElementById("recentVideos");
    if (!container) return;

    const db = getDb();
    if (!db) return;

    // Prefer /videos, fallback merge posts
    db.ref("videos")
        .orderByChild("createdAt")
        .limitToLast(12)
        .on("value", (snapshot) => {
            const items = [];
            snapshot.forEach((child) => {
                const data = child.val() || {};
                if (data.deleted === true || data.archived === true) return;
                const vis = String(data.visibility || "public").toLowerCase();
                if (vis === "private") return;
                if (!videoUrlOf(data)) return;
                items.push({ id: child.key, data });
            });

            items.sort(
                (a, b) =>
                    Number(b.data.createdAt || b.data.publishedAt || 0) -
                    Number(a.data.createdAt || a.data.publishedAt || 0)
            );

            if (!items.length) {
                container.innerHTML =
                    "<p style='text-align:center; color:#666; padding:30px;'>No videos yet</p>";
                return;
            }

            container.innerHTML = items
                .map(
                    ({ id, data }) => `
                <div class="video-card" onclick="viewVideo('${id}')">
                    <img src="${escapeHTML(thumbOf(data))}" class="thumbnail" alt="">
                    <div class="video-info">
                        <h3>${escapeHTML(data.title || "Untitled")}</h3>
                        <p>${escapeHTML(data.username || data.creatorName || "User")}</p>
                    </div>
                </div>
            `
                )
                .join("");
        });
}

window.viewProfile = function (uid) {
    window.location.href = `profile.html?uid=${encodeURIComponent(uid)}`;
};

window.viewVideo = function (videoId) {
    window.location.href = `video.html?id=${encodeURIComponent(videoId)}`;
};

window.viewPost = function (postId) {
    window.location.href = `post.html?id=${encodeURIComponent(postId)}`;
};
