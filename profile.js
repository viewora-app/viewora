"use strict";

/*
============================================================
 VIEWORA V12
 PROFILE.JS
 FINAL • CLEAN PREMIUM PROFILE
============================================================

 COMPATIBLE WITH:
 • firebase.js provided by Viewora
 • Firebase Realtime Database
 • Cloudinary uploads
 • profile.html

 FEATURES
 -----------------------------------------------------------
 • Own / other profile detection
 • Real followers count
 • Real following count
 • Follow / Unfollow
 • Message
 • Edit profile
 • Profile sharing
 • Stories (active 24h)
 • Highlights (expired stories after 24h)
 • Story viewer via stories.html
 • Upload via story-upload.html
 • Posts
 • Shorts
 • Videos
 • Saved posts
 • Archive
 • Delete own content
 • NaN-safe counters
 • Loading UI removed
 • Missing Firebase data protection
 • No duplicate initialization
============================================================
*/

(() => {

    /* =====================================================
       PREVENT DOUBLE INITIALIZATION
    ===================================================== */

    if (window.__VIEWORA_PROFILE_INITIALIZED__) {
        console.warn("VIEWORA Profile already initialized.");
        return;
    }

    window.__VIEWORA_PROFILE_INITIALIZED__ = true;


    /* =====================================================
       STATE
    ===================================================== */

    let currentUser = null;
    let profileUser = null;

    let profileUID = null;

    let isOwnProfile = false;
    let isFollowing = false;
    let isPrivateProfile = false;
    let hasPendingRequest = false;
    let hasIncomingRequest = false;
    let canViewContent = true;

    let currentTab = "posts";

    let profileData = null;

    let storyInput = null;

    let busyFollow = false;
    let busyStory = false;

    let profileLoadFinished = false;


    /* =====================================================
       DEFAULT ASSETS
    ===================================================== */

    const DEFAULT_AVATAR =
        "assets/default-avatar.png";

    /* VIEWORA_PHOTO_HEAL — never lose profile picture on re-login */
    function healProfilePhoto(uid, data) {
        if (!uid || !data) return data || {};
        try {
            var photo =
                data.profilePhoto ||
                data.photoURL ||
                data.avatar ||
                data.profilePicture ||
                data.profile_image ||
                data.dp ||
                "";
            var cached = "";
            try { cached = localStorage.getItem("viewora_my_avatar") || ""; } catch (_) {}
            var mine = false;
            try {
                mine =
                    firebase.auth().currentUser &&
                    firebase.auth().currentUser.uid === uid;
            } catch (_) {}
            if (!photo && cached && mine) {
                photo = cached;
                data.profilePhoto = photo;
                data.photoURL = photo;
                data.avatar = photo;
                try {
                    db.ref("users/" + uid).update({
                        profilePhoto: photo,
                        photoURL: photo,
                        avatar: photo
                    });
                } catch (_) {}
            }
            if (photo && mine) {
                try { localStorage.setItem("viewora_my_avatar", photo); } catch (_) {}
            }
        } catch (_) {}
        return data;
    }



    const DEFAULT_BANNER =
        "assets/default-banner.jpg";


    /* =====================================================
       SAFE NUMBER
    ===================================================== */

    function safeNumber(value) {

        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : 0;

    }


    /* =====================================================
       FORMAT NUMBER
    ===================================================== */

    function formatNumber(value) {

        const number = safeNumber(value);

        if (number < 1000) {
            return String(number);
        }

        if (number < 1000000) {

            return (
                (number / 1000)
                    .toFixed(number >= 10000 ? 0 : 1)
                    .replace(".0", "") +
                "K"
            );

        }

        if (number < 1000000000) {

            return (
                (number / 1000000)
                    .toFixed(number >= 10000000 ? 0 : 1)
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


    /* =====================================================
       DOM HELPERS
    ===================================================== */

    function $(id) {
        return document.getElementById(id);
    }


    
    function postsRef() {
        return db.ref("posts");
    }
    function shortsRef() {
        return db.ref("shorts");
    }
    function videosRef() {
        return db.ref("videos");
    }
    function storiesRef() {
        return db.ref("stories");
    }
    function followingRef(uid) {
        return db.ref("following/" + uid);
    }
    function followersRef(uid) {
        return db.ref("followers/" + uid);
    }
    function userRef(uid) {
        return db.ref("users/" + uid);
    }
    function usersRef() {
        return db.ref("users");
    }
    function savedPostsRef(uid) {
        return db.ref("saved/" + uid + "/posts");
    }


    function setText(id, value) {

        const element = $(id);

        if (element) {
            element.textContent = value ?? "";
        }

    }


    function show(element) {

        if (!element) return;

        element.classList.remove("hidden");

    }


    function hide(element) {

        if (!element) return;

        element.classList.add("hidden");

    }


    /* =====================================================
       HTML ESCAPE
    ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* =====================================================
       VERIFIED / BLUE TICK
    ===================================================== */

    function isVerifiedUser(data) {
        if (!data || typeof data !== "object") return false;
        if (window.VieworaBadges && typeof VieworaBadges.isVerified === "function") {
            return VieworaBadges.isVerified(data);
        }
        if (
            data.redTick === true ||
            data.vip === true ||
            data.verified === true ||
            data.isVerified === true ||
            data.blueTick === true ||
            data.whiteTick === true ||
            data.verification === true
        ) {
            return true;
        }
        const status = String(
            data.verificationStatus ||
            data.badge ||
            ""
        ).toLowerCase();
        return (
            status === "verified" ||
            status === "creator" ||
            status === "influencer" ||
            status === "admin" ||
            status === "vip" ||
            status === "monetized"
        );
    }

    function badgeHTMLFor(data) {
        if (!data || typeof data !== "object") return "";
        try {
            if (window.VieworaBadges && typeof VieworaBadges.resolve === "function") {
                const r = VieworaBadges.resolve(data);
                if (r && r.html) return r.html;
                if (r && r.level === "red") {
                    return '<i class="fa-solid fa-circle-check vieworaTick redTick" title="VIP" style="color:#ef4444"></i>';
                }
                if (r && r.level === "blue") {
                    return '<i class="fa-solid fa-circle-check vieworaTick blueTick" title="Verified" style="color:#1d9bf0"></i>';
                }
                if (r && r.level === "white") {
                    return '<i class="fa-solid fa-circle-check vieworaTick whiteTick" title="Monetized" style="color:#e5e7eb"></i>';
                }
            }
        } catch (_) {}
        // Manual hierarchy: RED > BLUE > WHITE
        if (data.redTick || data.vip || data.elite) {
            return '<i class="fa-solid fa-circle-check vieworaTick redTick" title="VIP" style="color:#ef4444"></i>';
        }
        if (
            data.blueTick ||
            data.verified ||
            data.isVerified ||
            data.verificationStatus === "verified"
        ) {
            return '<i class="fa-solid fa-circle-check vieworaTick blueTick" title="Verified" style="color:#1d9bf0"></i>';
        }
        if (data.whiteTick || data.monetized) {
            return '<i class="fa-solid fa-circle-check vieworaTick whiteTick" title="Monetized" style="color:#e5e7eb"></i>';
        }
        return "";
    }



    /* =====================================================
       URL PROFILE UID
    ===================================================== */

    function getProfileUIDFromURL() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return (
            params.get("uid") ||
            params.get("user") ||
            params.get("userId") ||
            params.get("profile") ||
            null
        );

    }


    /* =====================================================
       AUTH
    ===================================================== */

    async function loadCurrentUser() {

        try {

            if (
                typeof requireAuth === "function"
            ) {

                currentUser =
                    await requireAuth();

            } else {

                currentUser =
                    window.auth?.currentUser;

            }

            if (!currentUser) {
                return null;
            }

            return currentUser;

        } catch (error) {

            console.error(
                "Profile authentication error:",
                error
            );

            currentUser =
                window.auth?.currentUser || null;

            return currentUser;

        }

    }


    /* =====================================================
       RESOLVE PROFILE
    ===================================================== */

    function resolveProfileUID() {

        const urlUID =
            getProfileUIDFromURL();

        if (urlUID) {
            return urlUID;
        }

        if (currentUser?.uid) {
            return currentUser.uid;
        }

        return null;

    }


    /* =====================================================
       LOAD USER
    ===================================================== */

    async function loadProfileUser(uid) {

        if (!uid) {
            return null;
        }

        try {

            const snapshot =
                await userRef(uid).once("value");

            const data =
                snapshot.exists()
                    ? snapshot.val() || {}
                    : {};

            /*
             * IMPORTANT:
             * A Firebase user may not have a users/
             * profile node yet. We still create a usable
             * profile from auth information.
             */

            if (
                !snapshot.exists() &&
                currentUser?.uid !== uid
            ) {
                return null;
            }

            return {

                ...data,

                uid,

                name:
                    data.name ||
                    data.fullName ||
                    (
                        currentUser?.uid === uid
                            ? currentUser.displayName
                            : ""
                    ) ||
                    "Viewora User",

                fullName:
                    data.fullName ||
                    data.name ||
                    (
                        currentUser?.uid === uid
                            ? currentUser.displayName
                            : ""
                    ) ||
                    "Viewora User",

                username:
                    data.username ||
                    (
                        currentUser?.uid === uid
                            ? (
                                currentUser.username ||
                                currentUser.email?.split("@")[0]
                            )
                            : ""
                    ) ||
                    "user",

                email:
                    data.email ||
                    (
                        currentUser?.uid === uid
                            ? currentUser.email
                            : ""
                    ) ||
                    "",

                profilePhoto:
                    data.profilePhoto ||
                    data.photoURL ||
                    (
                        currentUser?.uid === uid
                            ? currentUser.photoURL
                            : ""
                    ) ||
                    DEFAULT_AVATAR,

                coverPhoto:
                    data.coverPhoto ||
                    data.banner ||
                    DEFAULT_BANNER,

                bio:
                    data.bio ||
                    "Welcome to Viewora 🚀",

                verified:
                    isVerifiedUser(data),

                followers:
                    safeNumber(data.followers),

                following:
                    safeNumber(data.following),

                posts:
                    safeNumber(data.posts),

                videos:
                    safeNumber(data.videos),

                shorts:
                    safeNumber(data.shorts),

                createdAt:
                    data.createdAt ||
                    currentUser?.metadata?.creationTime ||
                    null

            };

        } catch (error) {

            console.error(
                "Failed to load profile user:",
                error
            );

            return null;

        }

    }


    /* =====================================================
       REAL FOLLOWER COUNT
    ===================================================== */

    async function getRealFollowersCount(uid) {

        if (!uid) {
            return 0;
        }

        try {

            const snapshot =
                await followersRef(uid)
                    .once("value");

            if (!snapshot.exists()) {
                return 0;
            }

            const value =
                snapshot.val();

            if (
                !value ||
                typeof value !== "object"
            ) {
                return 0;
            }

            /*
             * Only count actual truthy follower entries.
             */

            return Object.values(value)
                .filter(
                    item =>
                        item === true ||
                        item === 1 ||
                        item === "true"
                )
                .length;

        } catch (error) {

            console.warn(
                "Real followers count failed:",
                error
            );

            return 0;

        }

    }


    /* =====================================================
       REAL FOLLOWING COUNT
    ===================================================== */

    async function getRealFollowingCount(uid) {

        if (!uid) {
            return 0;
        }

        try {

            const snapshot =
                await followingRef(uid)
                    .once("value");

            if (!snapshot.exists()) {
                return 0;
            }

            const value =
                snapshot.val();

            if (
                !value ||
                typeof value !== "object"
            ) {
                return 0;
            }

            return Object.values(value)
                .filter(
                    item =>
                        item === true ||
                        item === 1 ||
                        item === "true"
                )
                .length;

        } catch (error) {

            console.warn(
                "Real following count failed:",
                error
            );

            return 0;

        }

    }


    /* =====================================================
       REFRESH REAL COUNTS
    ===================================================== */

    async function refreshRealFollowCounts() {

        if (!profileUID) {
            return;
        }

        try {

            const [
                followersCount,
                followingCount
            ] = await Promise.all([

                getRealFollowersCount(
                    profileUID
                ),

                getRealFollowingCount(
                    profileUID
                )

            ]);

            /*
             * Update local profile object.
             */

            if (profileData) {

                profileData.followers =
                    followersCount;

                profileData.following =
                    followingCount;

            }

            /*
             * Update UI.
             */

            setText(
                "followersCount",
                formatNumber(
                    followersCount
                )
            );

            setText(
                "followingCount",
                formatNumber(
                    followingCount
                )
            );

        } catch (error) {

            console.warn(
                "Follow counts refresh failed:",
                error
            );

        }

    }


    /* =====================================================
       RENDER PROFILE
    ===================================================== */


    async function loadProfileNote(uid) {
        if (!uid || !db) return;
        try {
            let n = null;
            const a = await db.ref("userNotes/" + uid).once("value");
            n = a.val();
            if (!n || !n.text) {
                const b = await db.ref("users/" + uid + "/note").once("value");
                n = b.val();
            }
            if (!n || !n.text) {
                removeProfileNoteUI();
                return;
            }
            if (n.updatedAt && Date.now() - Number(n.updatedAt) > 24 * 60 * 60 * 1000) {
                removeProfileNoteUI();
                return;
            }
            // reactions
            let reactions = {};
            try {
                const rs = await db.ref("userNotes/" + uid + "/reactions").once("value");
                reactions = rs.val() || {};
            } catch (_) {}
            const counts = {};
            Object.keys(reactions).forEach(function (k) {
                const e = reactions[k] && (reactions[k].emoji || reactions[k]);
                if (!e) return;
                counts[e] = (counts[e] || 0) + 1;
            });
            renderProfileNoteUI(String(n.text), counts, uid);
        } catch (e) {
            console.warn("profile note", e);
        }
    }

    function removeProfileNoteUI() {
        document.getElementById("profileNoteBubble")?.remove();
        document.getElementById("profileNoteReactions")?.remove();
    }

    function renderProfileNoteUI(text, counts, noteUid) {
        removeProfileNoteUI();
        const pic = document.getElementById("profilePic");
        if (!pic) return;
        const wrap =
            pic.closest(".profileAvatarWrap") ||
            pic.closest(".avatarWrap") ||
            pic.parentElement;
        if (!wrap) return;
        if (getComputedStyle(wrap).position === "static") {
            wrap.style.position = "relative";
        }
        const full = String(text || "").trim();
        if (!full) return;

        const bubble = document.createElement("div");
        bubble.id = "profileNoteBubble";
        bubble.className = "profileNoteBubble";
        bubble.setAttribute("role", "button");
        bubble.setAttribute("tabindex", "0");
        bubble.setAttribute("title", "Tap to reply");
        bubble.textContent = full;
        bubble.dataset.full = full;
        bubble.dataset.uid = noteUid || profileUID || "";
        wrap.appendChild(bubble);

        // Tap note → reply (other user) or edit (own)
        bubble.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            const uid = bubble.dataset.uid || profileUID;
            if (isOwnProfile) {
                // optional: go messages to edit note
                try {
                    window.location.href = "messages.html#note";
                } catch (_) {}
                return;
            }
            openProfileNoteReply(uid, full);
        });

        const entries = Object.entries(counts || {}).sort(function (a, b) {
            return b[1] - a[1];
        });
        if (!entries.length) return;
        const float = document.createElement("div");
        float.id = "profileNoteReactions";
        float.className = "profileNoteReactions";
        float.innerHTML = entries
            .slice(0, 5)
            .map(function (pair, i) {
                return (
                    '<span class="pnrItem" style="animation-delay:' +
                    i * 0.35 +
                    's">' +
                    pair[0] +
                    (pair[1] > 1 ? " " + pair[1] : "") +
                    "</span>"
                );
            })
            .join("");
        wrap.appendChild(float);
    }

    function openProfileNoteReply(targetUid, noteText) {
        if (!targetUid || !currentUser) {
            showToast && showToast("Login required");
            return;
        }
        if (document.getElementById("profileNoteReplySheet")) return;
        const sheet = document.createElement("div");
        sheet.id = "profileNoteReplySheet";
        sheet.className = "profileNoteReplySheet";
        sheet.innerHTML =
            '<div class="pnrBackdrop" data-close="1"></div>' +
            '<div class="pnrCard">' +
            '<h3>Reply to note</h3>' +
            '<p class="pnrQuote">' + String(noteText || "").replace(/</g, "&lt;").slice(0, 120) + "</p>" +
            '<textarea id="pnrInput" maxlength="200" placeholder="Write a reply..."></textarea>' +
            '<div class="pnrActions">' +
            '<button type="button" class="pnrCancel" data-close="1">Cancel</button>' +
            '<button type="button" class="pnrSend" id="pnrSendBtn">Send</button>' +
            "</div></div>";
        document.body.appendChild(sheet);
        requestAnimationFrame(function () { sheet.classList.add("show"); });
        sheet.addEventListener("click", function (e) {
            if (e.target.closest("[data-close]")) {
                sheet.classList.remove("show");
                setTimeout(function () { sheet.remove(); }, 220);
            }
        });
        document.getElementById("pnrSendBtn")?.addEventListener("click", async function () {
            const text = (document.getElementById("pnrInput")?.value || "").trim();
            if (!text) return;
            try {
                const myUid = currentUser.uid;
                const ids = [myUid, targetUid].sort();
                const chatId = ids[0] + "_" + ids[1];
                const msg = {
                    type: "note_reply",
                    text: text.slice(0, 200),
                    noteText: String(noteText || "").slice(0, 120),
                    senderId: myUid,
                    createdAt: Date.now()
                };
                await db.ref("vieworaChats/" + chatId + "/messages").push(msg);
                try { await db.ref("chats/" + chatId + "/messages").push(msg); } catch (_) {}
                const preview = "Note reply: " + text.slice(0, 60);
                await db.ref("userChats/" + targetUid + "/" + chatId).update({
                    chatId: chatId,
                    userId: myUid,
                    lastMessage: preview,
                    lastMessageTime: Date.now()
                });
                await db.ref("userChats/" + myUid + "/" + chatId).update({
                    chatId: chatId,
                    userId: targetUid,
                    lastMessage: preview,
                    lastMessageTime: Date.now()
                });
                sheet.remove();
                if (typeof showToast === "function") showToast("Reply sent");
                else window.location.href = "chat.html?uid=" + encodeURIComponent(targetUid);
            } catch (err) {
                console.error(err);
                if (typeof showToast === "function") showToast("Reply failed");
            }
        });
    }


    function renderProfile(user) {

        if (!user) {
            return;
        }

        profileData =
            user;

        isPrivateProfile = !!(
            user.privateAccount === true ||
            user.isPrivate === true
        );

        /* NAME */

        setText(
            "profileName",
            user.name
        );


        /* VERIFIED */

        const verifiedBadge =
            $("verifiedBadge");

        const verified =
            isVerifiedUser(user) ||
            user.verified === true;

        if (verifiedBadge) {
            verifiedBadge.classList.toggle(
                "hidden",
                !verified
            );
        }

        /* Also support other common badge selectors in HTML */
        document
            .querySelectorAll(
                ".verifiedBadge, .profileVerified, [data-verified-badge], #blueTick, .blueTick"
            )
            .forEach((el) => {
                el.classList.toggle("hidden", !verified);
                if (verified) {
                    el.style.display = "";
                    el.removeAttribute("hidden");
                }
            });

        /* Inject hierarchical tick next to name */
        const nameEl = $("profileName");
        if (nameEl) {
            nameEl.querySelectorAll(".profileBlueTick, .profileRedTick, .profileWhiteTick, .vieworaTick").forEach((x) => x.remove());
            if (verified || (window.VieworaBadges && VieworaBadges.isVerified(user))) {
                const badge = (window.VieworaBadges && VieworaBadges.resolve(user)) || null;
                const tick = document.createElement("i");
                const level = (badge && badge.level) || (
                    (user.redTick || user.vip || user.elite) ? "red" :
                    (user.blueTick || user.verified || user.isVerified) ? "blue" :
                    (user.whiteTick || user.monetized) ? "white" : "none"
                );
                // RED > BLUE > WHITE — never show white if blue/red
                if (level === "red") {
                    tick.className = "fa-solid fa-certificate profileRedTick vieworaTick redTick";
                    tick.title = "VIP Elite";
                    tick.style.cssText = "color:#ff3b5c;margin-left:6px;font-size:0.9em;vertical-align:middle";
                } else if (level === "blue") {
                    tick.className = "fa-solid fa-circle-check profileBlueTick vieworaTick blueTick verifiedTick";
                    tick.title = "Verified";
                    tick.style.cssText = "color:#1d9bf0;margin-left:6px;font-size:0.85em;vertical-align:middle";
                } else if (level === "white") {
                    tick.className = "fa-solid fa-circle-check profileWhiteTick vieworaTick whiteTick";
                    tick.title = "Monetized creator";
                    tick.style.cssText = "color:#f0f4fa;margin-left:6px;font-size:0.85em;vertical-align:middle";
                } else {
                    tick.remove();
                    if (verifiedBadge) verifiedBadge.classList.add("hidden");
                }
                if (level === "red" || level === "blue" || level === "white") {
                tick.setAttribute("aria-label", tick.title);
                nameEl.appendChild(tick);
                if (verifiedBadge) {
                    verifiedBadge.classList.remove("hidden");
                    verifiedBadge.innerHTML = tick.outerHTML;
                }
                }
            } else if (verifiedBadge) {
                verifiedBadge.classList.add("hidden");
            }
        }


        /* USERNAME */

        setText(
            "profileUsername",
            "@" +
            (
                user.username ||
                "user"
            )
        );


        /* BIO */

        setText(
            "profileBio",
            user.bio ||
            "Welcome to Viewora 🚀"
        );


        /* PROFILE IMAGE */

        const profilePic =
            $("profilePic");

        if (profilePic) {
            const photo =
                user.profilePhoto ||
                user.photoURL ||
                user.photoUrl ||
                user.avatar ||
                user.profilePic ||
                user.profilePicture ||
                user.profile_image ||
                user.dp ||
                user.image ||
                "";

            profilePic.src = photo || DEFAULT_AVATAR;

            profilePic.onerror = () => {
                profilePic.onerror = null;
                // try alternate fields once
                const alt =
                    user.photoURL ||
                    user.avatar ||
                    user.profilePhoto ||
                    "";
                if (alt && alt !== profilePic.src) {
                    profilePic.src = alt;
                    profilePic.onerror = () => {
                        profilePic.onerror = null;
                        profilePic.src = DEFAULT_AVATAR;
                    };
                } else {
                    profilePic.src = DEFAULT_AVATAR;
                }
            };
        }


        /* NOTE + REACTIONS */
        try {
            const noteUid = user.uid || user.id || profileUID;
            if (noteUid) loadProfileNote(noteUid);
        } catch (_) {}

        /* COVER */

        const coverPhoto =
            $("coverPhoto");

        if (coverPhoto) {

            coverPhoto.src =
                user.coverPhoto ||
                DEFAULT_BANNER;

            coverPhoto.onerror =
                () => {

                    coverPhoto.onerror = null;

                    coverPhoto.src =
                        DEFAULT_BANNER;

                };

        }


        /* POSTS */

        setText(
            "postsCount",
            formatNumber(user.posts)
        );


        /* FOLLOWERS */

        setText(
            "followersCount",
            formatNumber(user.followers)
        );


        /* FOLLOWING */

        setText(
            "followingCount",
            formatNumber(user.following)
        );


        /* VIDEOS */

        setText(
            "videosCount",
            formatNumber(user.videos)
        );


        /* JOIN DATE */

        renderJoinDate(
            user.createdAt
        );

        // About card only on OTHER users' profiles (own → Settings)
        if (!isOwnProfile) {
            paintAbout(user);
        } else {
            const aboutBox = $("profileAbout");
            if (aboutBox) {
                aboutBox.hidden = true;
                aboutBox.innerHTML = "";
            }
        }


        /* LOCATION */

        const location =
            user.location ||
            user.city ||
            user.country ||
            "";

        const locationElement =
            $("profileLocation");

        if (locationElement) {

            if (location) {

                locationElement.innerHTML =
                    '<i class="fa-solid fa-location-dot"></i> ' +
                    escapeHTML(location);

                show(locationElement);

            } else {

                hide(locationElement);

            }

        }

    }


    /* =====================================================
       JOIN DATE
    ===================================================== */

    
    function paintAbout(user) {
        const box = $("profileAbout");
        if (!box || !user) return;
        // Never show About card on own profile
        if (isOwnProfile) {
            box.hidden = true;
            box.innerHTML = "";
            return;
        }

        const created = user.createdAt || user.joinedAt || user.created || "";
        let joinedText = "—";
        try {
            const n = Number(created);
            const d = n ? new Date(n < 1e12 ? n * 1000 : n) : new Date(created);
            if (!isNaN(d.getTime())) {
                joinedText = d.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                });
            }
        } catch (_) {}

        const changes = safeNumber(
            user.usernameChangeCount ||
                user.nameChangeCount ||
                user.usernameChanges ||
                0
        );
        const place =
            user.country ||
            user.location ||
            user.city ||
            user.region ||
            user.belong ||
            "";

        const rows = [
            {
                icon: "fa-calendar-days",
                label: "Joined",
                value: joinedText
            },
            {
                icon: "fa-signature",
                label: "Username changes",
                value: String(changes)
            },
            {
                icon: "fa-location-dot",
                label: "From",
                value: place || "Not set"
            }
        ];

        box.innerHTML =
            '<div class="aboutHeader"><strong>About</strong></div>' +
            rows
                .map(
                    (r) =>
                        '<div class="aboutRow">' +
                        '<i class="fa-solid ' +
                        r.icon +
                        '"></i>' +
                        '<div><small>' +
                        escapeHTML(r.label) +
                        "</small><span>" +
                        escapeHTML(r.value) +
                        "</span></div></div>"
                )
                .join("");
        box.hidden = false;
    }

    function renderJoinDate(value) {

        const element =
            $("joinDate");

        if (!element) {
            return;
        }

        let date = null;


        if (typeof value === "number") {

            date =
                new Date(value);

        }


        if (
            typeof value === "string" &&
            value
        ) {

            const parsed =
                Date.parse(value);

            if (
                Number.isFinite(parsed)
            ) {

                date =
                    new Date(parsed);

            }

        }


        if (
            !date ||
            Number.isNaN(
                date.getTime()
            )
        ) {

            element.innerHTML =
                '<i class="fa-solid fa-calendar"></i> Joined Viewora';

            return;

        }


        element.innerHTML =
            '<i class="fa-solid fa-calendar"></i> Joined ' +
            date.getFullYear();

    }


    /* =====================================================
       PROFILE MODE
    ===================================================== */

    function renderProfileMode() {

        const followBtn =
            $("followBtn");

        const messageBtn =
            $("messageBtn");

        const editBtn =
            $("editProfileBtn");

        const settingsBtn =
            $("settingsBtn");

        const moreBtn =
            $("profileMoreBtn");

        // body class drives CSS ownerOnly / visitorOnly
        try {
            document.body.classList.toggle("is-owner", !!isOwnProfile);
            document.body.classList.toggle("is-visitor", !isOwnProfile);
        } catch (_) {}

        if (isOwnProfile) {

            hide(followBtn);
            hide(messageBtn);
            hide(moreBtn);

            show(editBtn);
            show(settingsBtn);

        } else {

            show(followBtn);
            show(moreBtn);
            hide(editBtn);
            hide(settingsBtn);

            // Private: Message only after accepted follow
            updateMessageButtonVisibility();

        }

        updateFollowButton();

    }

    function updateMessageButtonVisibility() {
        const messageBtn = $("messageBtn");
        if (!messageBtn) return;

        if (isOwnProfile) {
            hide(messageBtn);
            return;
        }

        const privateTarget = !!(
            isPrivateProfile ||
            profileData?.privateAccount === true ||
            profileData?.isPrivate === true ||
            profileUser?.privateAccount === true
        );

        // Public → message always; Private → only if following
        if (privateTarget && !isFollowing) {
            hide(messageBtn);
            messageBtn.style.display = "none";
            messageBtn.setAttribute("aria-hidden", "true");
        } else {
            show(messageBtn);
            messageBtn.style.removeProperty("display");
            messageBtn.removeAttribute("aria-hidden");
        }

        // Also hide any visitor message variants
        document.querySelectorAll(
            "#messageBtn, .messageBtn, [data-message-btn], #visitorMessageBtn"
        ).forEach((el) => {
            if (privateTarget && !isFollowing && !isOwnProfile) {
                el.classList.add("hidden");
                el.style.display = "none";
            } else if (!isOwnProfile) {
                el.classList.remove("hidden");
                if (el.id === "messageBtn" || el.classList.contains("messageBtn")) {
                    el.style.removeProperty("display");
                }
            }
        });
    }


    /* =====================================================
       FOLLOW STATE
    ===================================================== */

    async function checkFollowState() {

        if (
            !currentUser?.uid ||
            !profileUID ||
            isOwnProfile
        ) {
            isFollowing = false;
            hasPendingRequest = false;
            updateContentAccess();
            updateFollowButton();
            return;
        }

        try {
            const snapshot =
                await followingRef(currentUser.uid)
                    .child(profileUID)
                    .once("value");

            const value = snapshot.val();
            isFollowing =
                value === true ||
                value === 1 ||
                value === "true";

            // Outgoing: I requested to follow THEM (private)
            hasPendingRequest = false;
            if (!isFollowing) {
                try {
                    const reqSnap = await db
                        .ref(
                            "followRequests/" +
                            profileUID +
                            "/" +
                            currentUser.uid
                        )
                        .once("value");
                    const rv = reqSnap.val();
                    hasPendingRequest =
                        rv === true ||
                        rv === 1 ||
                        (rv && typeof rv === "object" && (rv.status === "pending" || !rv.status));
                } catch (_) {}
            }

            // Incoming: THEY requested to follow ME
            hasIncomingRequest = false;
            try {
                const inSnap = await db
                    .ref(
                        "followRequests/" +
                        currentUser.uid +
                        "/" +
                        profileUID
                    )
                    .once("value");
                const iv = inSnap.val();
                hasIncomingRequest =
                    iv === true ||
                    iv === 1 ||
                    (iv && typeof iv === "object" && (iv.status === "pending" || !iv.status));
            } catch (_) {}

        } catch (error) {
            console.warn("Follow state failed:", error);
            isFollowing = false;
            hasPendingRequest = false;
            hasIncomingRequest = false;
        }

        updateContentAccess();
        updateFollowButton();
        updateIncomingRequestUI();
    }

    function updateContentAccess() {
        isPrivateProfile = !!(
            profileData?.privateAccount === true ||
            profileData?.isPrivate === true ||
            profileUser?.privateAccount === true
        );

        canViewContent =
            isOwnProfile ||
            !isPrivateProfile ||
            isFollowing === true;

        // Hide tab grids if locked
        document.querySelectorAll(
            "#postsList, #shortsList, #videosList, #savedList, #liveList"
        ).forEach((el) => {
            if (!el) return;
            if (!canViewContent) {
                el.innerHTML =
                    '<div class="contentEmpty profilePrivateLock">' +
                    '<i class="fa-solid fa-lock"></i>' +
                    "<strong>This account is private</strong>" +
                    "<span>Follow this account to see their posts, shorts and videos.</span>" +
                    "</div>";
            }
        });

        // Hide story section content for private strangers
        const storiesWrap = $("storiesWrapper");
        if (storiesWrap && !canViewContent && !isOwnProfile) {
            // keep structure but show lock message in highlights gone
        }

        updateMessageButtonVisibility();
    }


    /* =====================================================
       FOLLOW BUTTON
    ===================================================== */

    function updateFollowButton() {

        const button =
            $("followBtn");

        if (!button) {
            return;
        }

        if (isOwnProfile) {

            hide(button);

            return;

        }

        show(button);

        button.disabled =
            busyFollow;

        if (busyFollow) {

            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i>' +
                '<span>Please wait</span>';

            return;

        }

        // Incoming request from this profile → hide single follow btn (use dual Accept/Decline)
        if (hasIncomingRequest && !isOwnProfile) {
            hide(button);
            return;
        }

        show(button);

        if (isFollowing) {

            button.classList.remove("primaryBtn");
            button.classList.add("secondaryBtn");
            button.innerHTML =
                '<i class="fa-solid fa-user-check"></i>' +
                '<span>Following</span>';

        } else if (hasPendingRequest) {

            button.classList.remove("primaryBtn");
            button.classList.add("secondaryBtn");
            button.innerHTML =
                '<i class="fa-solid fa-clock"></i>' +
                '<span>Requested</span>';

        } else {

            button.classList.remove("secondaryBtn");
            button.classList.add("primaryBtn");
            button.innerHTML =
                '<i class="fa-solid fa-user-plus"></i>' +
                '<span>' +
                (isPrivateProfile ? "Request" : "Follow") +
                '</span>';

        }

    }

    function updateIncomingRequestUI() {
        let row = document.getElementById("incomingRequestRow");
        const followBtn = $("followBtn");
        const profileButtons = document.querySelector(".profileButtons");

        if (!hasIncomingRequest || isOwnProfile) {
            if (row) row.remove();
            return;
        }

        if (!row && profileButtons) {
            row = document.createElement("div");
            row.id = "incomingRequestRow";
            row.className = "incomingRequestRow";
            row.innerHTML =
                '<button type="button" class="primaryBtn incomingAcceptBtn" id="incomingAcceptBtn">' +
                '<i class="fa-solid fa-check"></i><span>Accept</span></button>' +
                '<button type="button" class="secondaryBtn incomingDeclineBtn" id="incomingDeclineBtn">' +
                '<i class="fa-solid fa-xmark"></i><span>Decline</span></button>';
            // Insert before follow row or at start of buttons
            if (followBtn && followBtn.parentElement === profileButtons) {
                profileButtons.insertBefore(row, followBtn);
            } else {
                profileButtons.insertBefore(row, profileButtons.firstChild);
            }
            row.querySelector("#incomingAcceptBtn")?.addEventListener("click", async () => {
                await acceptIncomingFromProfile();
            });
            row.querySelector("#incomingDeclineBtn")?.addEventListener("click", async () => {
                await declineIncomingFromProfile();
            });
        }

        if (row) {
            row.style.display = "grid";
            hide(followBtn);
        }
    }

    async function acceptIncomingFromProfile() {
        if (!currentUser?.uid || !profileUID || busyFollow) return;
        busyFollow = true;
        try {
            const me = currentUser.uid;
            const fromUID = profileUID;
            // requester (fromUID) follows me → they can see my private content
            const updates = {};
            updates["followers/" + me + "/" + fromUID] = true;
            updates["following/" + fromUID + "/" + me] = true;
            updates["users/" + me + "/followers/" + fromUID] = true;
            updates["users/" + fromUID + "/following/" + me] = true;
            updates["followRequests/" + me + "/" + fromUID] = null;
            updates["followRequests/" + fromUID + "/" + me] = null;
            await db.ref().update(updates);

            try {
                const n = db.ref("notifications/" + fromUID).push();
                await n.set({
                    type: "follow_accepted",
                    senderUID: me,
                    message: "accepted your follow request",
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    read: false
                });
            } catch (_) {}

            hasIncomingRequest = false;
            // Now they follow me — offer follow back
            const row = document.getElementById("incomingRequestRow");
            if (row) row.remove();

            // Show Follow / Follow back button again
            isFollowing = false; // I may not follow them yet
            updateFollowButton();
            const followBtn = $("followBtn");
            if (followBtn) {
                show(followBtn);
                followBtn.classList.remove("secondaryBtn");
                followBtn.classList.add("primaryBtn");
                followBtn.innerHTML =
                    '<i class="fa-solid fa-user-plus"></i><span>Follow back</span>';
            }
            await refreshRealFollowCounts();
            showToast("Request accepted");
        } catch (e) {
            console.error(e);
            showToast("Could not accept");
        } finally {
            busyFollow = false;
        }
    }

    async function declineIncomingFromProfile() {
        if (!currentUser?.uid || !profileUID || busyFollow) return;
        busyFollow = true;
        try {
            await db.ref(
                "followRequests/" + currentUser.uid + "/" + profileUID
            ).remove();
            hasIncomingRequest = false;
            const row = document.getElementById("incomingRequestRow");
            if (row) row.remove();
            updateFollowButton();
            showToast("Request declined");
        } catch (e) {
            console.error(e);
            showToast("Could not decline");
        } finally {
            busyFollow = false;
        }
    }


    /* =====================================================
       FOLLOW / UNFOLLOW
    ===================================================== */

    async function toggleFollow() {

        if (busyFollow) {
            return;
        }

        if (
            !currentUser?.uid ||
            !profileUID ||
            isOwnProfile
        ) {
            return;
        }

        /*
         * Never allow following yourself.
         */

        if (
            currentUser.uid === profileUID
        ) {
            return;
        }

        busyFollow = true;

        updateFollowButton();


        const previousState =
            isFollowing;

        const nextState =
            !previousState;


        try {

            const myUID =
                currentUser.uid;

            const targetUID =
                profileUID;


            /*
             * IMPORTANT
             * ---------------------------------------------
             * Do NOT update users.followers using:
             *
             * Number(value) + 1
             *
             * because old database values may be NaN,
             * strings, null or missing.
             *
             * We maintain actual follower relationships
             * here. Counts are calculated from these nodes.
             */

            const updates = {};
            const privateTarget = !!(
                profileData?.privateAccount === true ||
                profileData?.isPrivate === true ||
                isPrivateProfile
            );

            if (nextState) {
                // Cancel pending request if clicking Requested again → unfollow request
                if (hasPendingRequest) {
                    updates[
                        "followRequests/" + targetUID + "/" + myUID
                    ] = null;
                    await db.ref().update(updates);
                    isFollowing = false;
                    hasPendingRequest = false;
                    updateContentAccess();
                    updateFollowButton();
                    showToast("Request cancelled");
                    await refreshRealFollowCounts();
                    return;
                }

                if (privateTarget) {
                    // Send follow REQUEST only
                    updates[
                        "followRequests/" + targetUID + "/" + myUID
                    ] = {
                        fromUID: myUID,
                        fromName:
                            currentUser.displayName ||
                            currentUser.name ||
                            "User",
                        fromPhoto:
                            currentUser.photoURL ||
                            DEFAULT_AVATAR,
                        status: "pending",
                        createdAt: Date.now()
                    };
                    await db.ref().update(updates);

                    // Notify target
                    try {
                        const n = notificationsRef(targetUID).push();
                        await n.set({
                            id: n.key,
                            type: "follow_request",
                            senderUID: myUID,
                            fromUID: myUID,
                            fromName:
                                currentUser.displayName || "User",
                            message: "requested to follow you",
                            read: false,
                            createdAt: SERVER_TIME
                        });
                    } catch (_) {}

                    hasPendingRequest = true;
                    isFollowing = false;
                    updateContentAccess();
                    updateFollowButton();
                    showToast("Request sent");
                    return;
                }

                // Public: direct follow
                updates[
                    "following/" + myUID + "/" + targetUID
                ] = true;
                updates[
                    "followers/" + targetUID + "/" + myUID
                ] = true;

            } else {
                // Unfollow
                updates[
                    "following/" + myUID + "/" + targetUID
                ] = null;
                updates[
                    "followers/" + targetUID + "/" + myUID
                ] = null;
                updates[
                    "followRequests/" + targetUID + "/" + myUID
                ] = null;
            }

            await db.ref().update(updates);

            isFollowing = nextState;
            hasPendingRequest = false;

            if (profileData) {
                const currentFollowers = safeNumber(profileData.followers);
                profileData.followers = Math.max(
                    0,
                    currentFollowers + (nextState ? 1 : -1)
                );
            }

            setText(
                "followersCount",
                formatNumber(profileData?.followers || 0)
            );

            updateContentAccess();
            updateFollowButton();
            await refreshRealFollowCounts();

            if (nextState) {
                await createFollowNotification(targetUID);
                showToast("Following");
            } else {
                showToast("Unfollowed");
            }

            // Reload content access
            if (canViewContent) {
                await refreshCurrentTab();
            }

        } catch (error) {

            console.error(
                "Follow action failed:",
                error
            );

            /*
             * Restore previous UI state.
             */

            isFollowing =
                previousState;

            updateFollowButton();

            showToast(
                "Follow action failed"
            );

        } finally {

            busyFollow = false;

            updateFollowButton();

        }

    }


    /* =====================================================
       FOLLOW NOTIFICATION
    ===================================================== */

    async function createFollowNotification(
        targetUID
    ) {

        if (
            !targetUID ||
            !currentUser?.uid
        ) {
            return;
        }

        try {

            const notification =
                notificationsRef(
                    targetUID
                ).push();

            const senderName =
                currentUser.displayName ||
                currentUser.name ||
                profileData?.name ||
                "Viewora User";

            const senderUsername =
                currentUser.username ||
                "user";

            const senderPhoto =
                currentUser.photoURL ||
                currentUser.profilePhoto ||
                DEFAULT_AVATAR;


            await notification.set({

                id:
                    notification.key,

                type:
                    "follow",

                senderUID:
                    currentUser.uid,

                fromUID:
                    currentUser.uid,

                fromName:
                    senderName,

                fromUsername:
                    senderUsername,

                fromPhoto:
                    senderPhoto,

                message:
                    "started following you",

                read:
                    false,

                createdAt:
                    SERVER_TIME

            });

        } catch (error) {

            /*
             * Notification failure should NEVER
             * make the follow action fail.
             */

            console.warn(
                "Follow notification failed:",
                error
            );

        }

    }


    /* =====================================================
       FOLLOWERS / FOLLOWING PAGE
    ===================================================== */

    function openFollowList(type) {

        if (!profileUID) {
            return;
        }

        const page =
            type === "followers"
                ? "followers.html"
                : "following.html";

        window.location.href =
            page +
            "?uid=" +
            encodeURIComponent(
                profileUID
            );

    }


    /* =====================================================
       PROFILE BUTTONS
    ===================================================== */

    
    /* =====================================================
       ABOUT ACCOUNT SHEET (3-dot)
    ===================================================== */

    function formatAboutDate(value) {
        try {
            const n = Number(value);
            const d = n
                ? new Date(n < 1e12 ? n * 1000 : n)
                : new Date(value);
            if (isNaN(d.getTime())) return "—";
            return d.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric"
            });
        } catch (_) {
            return "—";
        }
    }

    
    /* =====================================================
       VISITOR 3-DOT MENU
    ===================================================== */

    function openVisitorMenu(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (isOwnProfile) return;
        const sheet = $("visitorMoreSheet");
        if (!sheet) {
            openAboutSheet();
            return;
        }
        sheet.classList.remove("hidden");
        sheet.setAttribute("aria-hidden", "false");
        document.body.classList.add("modalOpen");
    }

    function closeVisitorMenu() {
        const sheet = $("visitorMoreSheet");
        if (!sheet) return;
        sheet.classList.add("hidden");
        sheet.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modalOpen");
    }

    async function blockProfileUser() {
        if (!currentUser?.uid || !profileUID || isOwnProfile) return;
        const ok = window.confirm(
            "Block this user? They will not be able to message or follow you."
        );
        if (!ok) return;
        try {
            const me = currentUser.uid;
            const updates = {};
            updates["blocked/" + me + "/" + profileUID] = {
                uid: profileUID,
                at: Date.now()
            };
            updates["blockedBy/" + profileUID + "/" + me] = true;
            // Unfollow both ways if present
            updates["following/" + me + "/" + profileUID] = null;
            updates["followers/" + me + "/" + profileUID] = null;
            updates["following/" + profileUID + "/" + me] = null;
            updates["followers/" + profileUID + "/" + me] = null;
            await db.ref().update(updates);
            showToast("User blocked");
            closeVisitorMenu();
            setTimeout(() => {
                window.location.href = "index.html";
            }, 500);
        } catch (e) {
            console.error(e);
            showToast("Could not block user");
        }
    }


    function openAboutSheet() {
        const sheet = $("aboutSheet");
        if (!sheet || !profileUser) return;

        const from =
            profileUser.country ||
            profileUser.from ||
            profileUser.signupCountry ||
            profileUser.location ||
            profileUser.city ||
            profileUser.region ||
            "Not set";

        const joined = formatAboutDate(
            profileUser.createdAt ||
                profileUser.joinedAt ||
                profileUser.created
        );

        const changes = safeNumber(
            profileUser.usernameChangeCount ||
                profileUser.nameChangeCount ||
                profileUser.usernameChanges ||
                (profileUser.usernameHistory
                    ? Object.keys(profileUser.usernameHistory).length
                    : 0)
        );

        setText("aboutFrom", from);
        setText("aboutJoined", joined);
        setText(
            "aboutUsernameChanges",
            String(changes) + (changes === 1 ? " time" : " times")
        );

        const reportRow = $("aboutReportRow");
        if (reportRow) {
            reportRow.hidden = !!isOwnProfile;
        }

        sheet.classList.remove("hidden");
        sheet.setAttribute("aria-hidden", "false");
        document.body.classList.add("modalOpen");
    }

    function closeAboutSheet() {
        const sheet = $("aboutSheet");
        if (!sheet) return;
        sheet.classList.add("hidden");
        sheet.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modalOpen");
    }

    function openUsernameHistory() {
        const sheet = $("usernameHistorySheet");
        const list = $("usernameHistoryList");
        if (!sheet || !list || !profileUser) return;

        const hist =
            profileUser.usernameHistory ||
            profileUser.nameHistory ||
            {};

        let entries = [];
        if (Array.isArray(hist)) {
            entries = hist.slice();
        } else if (hist && typeof hist === "object") {
            entries = Object.keys(hist)
                .map((k) => {
                    const v = hist[k];
                    if (v && typeof v === "object") {
                        return {
                            from: v.from || v.old || v.previous || "",
                            to: v.to || v.new || v.username || "",
                            at: v.at || v.changedAt || v.time || k
                        };
                    }
                    return { from: "", to: String(v), at: k };
                })
                .sort(
                    (a, b) =>
                        safeNumber(a.at) - safeNumber(b.at)
                );
        }

        // Always show current as latest
        const current =
            profileUser.username ||
            profileUser.userName ||
            profileUser.handle ||
            "";
        if (current && !entries.length) {
            entries.push({
                from: "",
                to: current,
                at: profileUser.createdAt || "",
                note: "Current"
            });
        }

        if (!entries.length) {
            list.innerHTML =
                '<p class="aboutEmpty">No username changes recorded yet.</p>';
        } else {
            list.innerHTML = entries
                .map((e, i) => {
                    const label =
                        e.from && e.to
                            ? escapeHTML(e.from) +
                              " → " +
                              escapeHTML(e.to)
                            : escapeHTML(e.to || e.from || "—");
                    const when = formatAboutDate(e.at);
                    return (
                        '<div class="historyItem">' +
                        "<strong>" +
                        label +
                        "</strong>" +
                        "<small>" +
                        (e.note
                            ? escapeHTML(e.note) + " · "
                            : "") +
                        when +
                        (i === 0 && !e.from ? " · first" : "") +
                        "</small></div>"
                    );
                })
                .join("");
        }

        sheet.classList.remove("hidden");
        sheet.setAttribute("aria-hidden", "false");
    }

    function closeUsernameHistory() {
        const sheet = $("usernameHistorySheet");
        if (!sheet) return;
        sheet.classList.add("hidden");
        sheet.setAttribute("aria-hidden", "true");
    }


    function setupProfileButtons() {

        $("followBtn")
            ?.addEventListener(
                "click",
                toggleFollow
            );


        $("messageBtn")
            ?.addEventListener(
                "click",
                openMessage
            );


        $("shareProfileBtn")
            ?.addEventListener(
                "click",
                shareProfile
            );


        $("settingsBtn")
            ?.addEventListener(
                "click",
                () => {

                    if (!isOwnProfile) {
                        return;
                    }

                    window.location.href =
                        "settings.html";

                }
            );

        $("profileMoreBtn")
            ?.addEventListener(
                "click",
                openVisitorMenu,
                true
            );

        document
            .querySelectorAll("[data-close-visitor]")
            .forEach((el) =>
                el.addEventListener("click", closeVisitorMenu)
            );

        $("visitorAboutBtn")
            ?.addEventListener("click", () => {
                closeVisitorMenu();
                openAboutSheet();
            });

        $("visitorShareBtnMenu")
            ?.addEventListener("click", () => {
                closeVisitorMenu();
                shareProfile();
            });

        $("visitorReportBtn")
            ?.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                closeVisitorMenu();
                // small delay so sheet closes cleanly; only then report
                setTimeout(function () {
                    reportProfileUser();
                }, 180);
            });

        $("visitorBlockBtn")
            ?.addEventListener("click", () => {
                blockProfileUser();
            });

        $("visitorFriendBtn")
            ?.addEventListener("click", async () => {
                closeVisitorMenu();
                try {
                    const btn = $("followBtn");
                    if (btn) btn.click();
                    else showToast("Use Follow on profile");
                } catch (_) {
                    showToast("Use Follow on profile");
                }
            });

        $("visitorCopyLinkBtn")
            ?.addEventListener("click", async () => {
                closeVisitorMenu();
                try {
                    const url =
                        window.location.origin +
                        window.location.pathname +
                        "?uid=" +
                        encodeURIComponent(profileUID || "");
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(url);
                        showToast("Profile link copied");
                    } else {
                        window.prompt("Copy link", url);
                    }
                } catch (_) {
                    showToast("Could not copy link");
                }
            });

        document
            .querySelectorAll("[data-close-about]")
            .forEach((el) =>
                el.addEventListener("click", closeAboutSheet)
            );

        document
            .querySelectorAll("[data-close-history]")
            .forEach((el) =>
                el.addEventListener("click", closeUsernameHistory)
            );

        $("aboutUsernameBtn")
            ?.addEventListener("click", openUsernameHistory);

        $("historyBackBtn")
            ?.addEventListener("click", closeUsernameHistory);

        $("aboutReportBtn")
            ?.addEventListener("click", () => {
                closeAboutSheet();
                reportProfileUser();
            });

        // Highlights manager
        $("manageHighlightsBtn")
            ?.addEventListener("click", () => {
                if (!isOwnProfile) return;
                window.location.href = "story-highlight.html";
            });



        $("editProfileBtn")
            ?.addEventListener(
                "click",
                () => {

                    if (!isOwnProfile) {
                        return;
                    }

                    window.location.href =
                        "edit-profile.html";

                }
            );


        /*
         * Use IDs first because they are more reliable.
         */

        $("followersStat")
            ?.addEventListener(
                "click",
                () =>
                    openFollowList(
                        "followers"
                    )
            );


        $("followingStat")
            ?.addEventListener(
                "click",
                () =>
                    openFollowList(
                        "following"
                    )
            );


        /*
         * Fallback for existing HTML where stats
         * only use .profileStats .stat.
         */

        const stats =
            document.querySelectorAll(
                ".profileStats .stat"
            );


        if (stats[1]) {

            stats[1].style.cursor =
                "pointer";

            stats[1].addEventListener(
                "click",
                () =>
                    openFollowList(
                        "followers"
                    )
            );

        }


        if (stats[2]) {

            stats[2].style.cursor =
                "pointer";

            stats[2].addEventListener(
                "click",
                () =>
                    openFollowList(
                        "following"
                    )
            );

        }

    }


    /* =====================================================
       MESSAGE
    ===================================================== */

    function openMessage() {
        // Private account: no DM until accepted follow
        if (!isOwnProfile && isPrivateProfile && !isFollowing) {
            showToast("Follow request must be accepted to message");
            return;
        }


        if (
            isOwnProfile ||
            !profileUID
        ) {
            return;
        }

        window.location.href =
            "chat.html?uid=" +
            encodeURIComponent(
                profileUID
            );

    }


    /* =====================================================
       SHARE
    ===================================================== */

    async function shareProfile() {

        if (!profileUID) {
            return;
        }

        const username =
            profileData?.username ||
            "user";

        const shareURL =
            (window.location.origin || "") +
            "/profile.html?uid=" +
            encodeURIComponent(profileUID);

        // Prefer in-app share sheet → appears in friend's chat
        if (window.VieworaShare && typeof VieworaShare.open === "function") {
            VieworaShare.open({
                type: "profile",
                id: profileUID,
                url: shareURL,
                title:
                    (profileData && (profileData.name || profileData.displayName)) ||
                    ("@" + username)
            });
            return;
        }

        const shareData = {
            title: profileData?.name || "Viewora Profile",
            text: "Check out @" + username + " on Viewora",
            url: shareURL
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareURL);
                showToast("Profile link copied");
            } else {
                showToast("Copy this profile link");
            }
        } catch (error) {
            if (error?.name !== "AbortError") {
                console.warn("Share failed:", error);
            }
        }

    }


    /* =====================================================
       TABS
    ===================================================== */

    function setupTabs() {

        document
            .querySelectorAll(
                ".tabBtn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const tab =
                                button.dataset.tab;

                            if (!tab) {
                                return;
                            }

                            switchTab(
                                tab
                            );

                        }
                    );

                }
            );

    }


    /* =====================================================
       SWITCH TAB
    ===================================================== */

    async function switchTab(tab) {

        currentTab =
            tab;


        document
            .querySelectorAll(
                ".tabBtn"
            )
            .forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.tab ===
                        tab
                    );

                }
            );


        document
            .querySelectorAll(
                ".tabContent"
            )
            .forEach(
                content => {

                    content.classList.remove(
                        "active"
                    );

                }
            );


        const target =
            $(
                tab +
                "Tab"
            );

        if (target) {

            target.classList.add(
                "active"
            );

        }


        if (tab === "posts") {
            await loadPosts();
        }


        if (tab === "shorts") {
            await loadShorts();
        }


        if (tab === "videos") {
            await loadVideos();
        }


        if (tab === "saved") {
            await loadSaved();
        }

        if (tab === "live") {
            await loadLive();
        }

    }


    /* =====================================================
       LOAD POSTS
    ===================================================== */

    async function loadPosts() {
        if (!canViewContent && !isOwnProfile) {
            updateContentAccess();
            return;
        }


        const container =
            $("postsList");

        if (
            !container ||
            !profileUID
        ) {
            return;
        }

        renderLoading(
            container,
            "Loading posts..."
        );


        try {

            let data = {};
            try {
                const snapshot = await postsRef()
                    .orderByChild("uid")
                    .equalTo(profileUID)
                    .once("value");
                data = snapshot.val() || {};
            } catch (e1) {
                console.warn("posts by uid", e1);
            }
            // Fallback: userId field
            if (!data || !Object.keys(data).length) {
                try {
                    const snap2 = await postsRef()
                        .orderByChild("userId")
                        .equalTo(profileUID)
                        .once("value");
                    data = snap2.val() || {};
                } catch (e2) {
                    console.warn("posts by userId", e2);
                }
            }
            // Fallback: scan last posts (no index)
            if (!data || !Object.keys(data).length) {
                try {
                    const snap3 = await postsRef().limitToLast(80).once("value");
                    const all = snap3.val() || {};
                    const filtered = {};
                    Object.keys(all).forEach(function (id) {
                        const p = all[id] || {};
                        const owner = p.uid || p.userId || p.ownerId || p.authorId || "";
                        if (owner === profileUID) filtered[id] = p;
                    });
                    data = filtered;
                } catch (e3) {
                    console.warn("posts scan", e3);
                }
            }

            const items =
                Object.entries(data)
                    .map(
                        ([id, value]) => ({
                            id,
                            ...(value || {})
                        })
                    )
                    .filter(
                        item =>
                            item.archived !== true &&
                            item.deleted !== true &&
                            item.hidden !== true
                    )
                    .filter(function (item) {
                        // Must have real post media — never count avatar-only junk rows
                        const media = getMediaURL(item);
                        if (!media) return false;
                        // Drop if media is clearly a profile/default avatar path reused by bug
                        const low = media.toLowerCase();
                        if (low.indexOf("default-avatar") !== -1) return false;
                        return true;
                    })
                    .sort(
                        (a, b) =>
                            safeNumber(
                                b.createdAt
                            ) -
                            safeNumber(
                                a.createdAt
                            )
                    );


            /*
             * Update post count from actual content.
             */

            // Always show real count from loaded posts (not stale user.posts)
            setText(
                "postsCount",
                formatNumber(items.length)
            );
            // Heal stale counter on own profile
            if (isOwnProfile && profileUID) {
                try {
                    db.ref("users/" + profileUID).update({
                        posts: items.length,
                        postsCount: items.length
                    });
                } catch (_) {}
            }


            if (!items.length) {

                renderEmpty(
                    container,
                    "No posts yet",
                    "Share your first moment on Viewora."
                );

                return;

            }


            container.innerHTML =
                items
                    .map(
                        renderPostCard
                    )
                    .join("");


            bindContentActions(
                container
            );

        } catch (error) {

            console.error(
                "Posts loading error:",
                error
            );

            renderEmpty(
                container,
                "Unable to load posts",
                "Please try again."
            );

        }

    }


    /* =====================================================
       POST CARD
    ===================================================== */

    function renderPostCard(item) {

        const media =
            getMediaURL(item);

        const type =
            String(
                item.type ||
                item.mediaType ||
                "image"
            ).toLowerCase();


        if (!media) {

            return `
                <article
                    class="profileContentCard"
                    data-id="${escapeHTML(item.id)}"
                    data-type="post"
                >

                    <div class="contentPlaceholder">
                        <i class="fa-solid fa-image"></i>
                    </div>

                </article>
            `;

        }


        const isVideo =
            type === "video" ||
            type === "mp4" ||
            item.video === true;


        const mediaCount = (function () {
            try {
                if (Array.isArray(item.mediaUrls) && item.mediaUrls.length) return item.mediaUrls.length;
                if (Array.isArray(item.images) && item.images.length) return item.images.length;
                if (Number(item.mediaCount) > 1) return Number(item.mediaCount);
            } catch (_) {}
            return 1;
        })();
        const multiBadge = mediaCount > 1
            ? `<span class="multiBadge"><i class="fa-regular fa-images"></i>${mediaCount}</span>`
            : "";

        return `
            <article
                class="profileContentCard"
                data-id="${escapeHTML(item.id)}"
                data-type="post"
            >
                ${multiBadge}
                ${
                    isVideo
                        ? `
                            <video
                                src="${escapeHTML(media)}"
                                muted
                                playsinline
                                preload="metadata"
                            ></video>
                        `
                        : `
                            <img
                                src="${escapeHTML(media)}"
                                alt="Post"
                                loading="lazy"
                            >
                        `
                }

                <div class="contentOverlay">

                    <span>
                        <i class="fa-solid fa-heart"></i>
                        ${formatNumber(item.likes)}
                    </span>

                    <span>
                        <i class="fa-solid fa-comment"></i>
                        ${formatNumber(item.comments)}
                    </span>

                </div>

            </article>
        `;

    }


    /* =====================================================
       LOAD SHORTS
    ===================================================== */

    async function loadShorts() {
        if (!canViewContent && !isOwnProfile) {
            updateContentAccess();
            return;
        }


        const container =
            $("shortsList");

        if (
            !container ||
            !profileUID
        ) {
            return;
        }

        renderLoading(
            container,
            "Loading shorts..."
        );


        try {

            const snapshot =
                await shortsRef()
                    .orderByChild("uid")
                    .equalTo(profileUID)
                    .once("value");


            const data =
                snapshot.val() || {};


            const items =
                Object.entries(data)
                    .map(
                        ([id, value]) => ({
                            id,
                            ...(value || {})
                        })
                    )
                    .filter(
                        item =>
                            item.archived !== true &&
                            item.deleted !== true
                    )
                    .sort(
                        (a, b) =>
                            safeNumber(
                                b.createdAt
                            ) -
                            safeNumber(
                                a.createdAt
                            )
                    );


            if (!items.length) {

                renderEmpty(
                    container,
                    "No shorts yet",
                    "Your short videos will appear here."
                );

                return;

            }


            container.innerHTML =
                items
                    .map(
                        renderShortCard
                    )
                    .join("");


            bindContentActions(
                container
            );

        } catch (error) {

            console.error(
                "Shorts loading error:",
                error
            );

            renderEmpty(
                container,
                "Unable to load shorts",
                "Please try again."
            );

        }

    }


    /* =====================================================
       SHORT CARD
    ===================================================== */

    function renderShortCard(item) {

        const media = getMediaURL(item);
        const poster = getThumbURL(item);
        const views = safeNumber(
            item.views ||
            item.viewCount ||
            item.plays ||
            item.playCount ||
            item.stats?.views ||
            item.stats?.viewCount ||
            0
        );

        // Prefer static thumbnail image (reliable on mobile); fallback video frame
        let mediaHtml = "";
        if (poster) {
            mediaHtml =
                '<img class="shortThumbImg" src="' +
                escapeHTML(poster) +
                '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'block\')">';
            if (media) {
                mediaHtml +=
                    '<video class="shortThumbVid" src="' +
                    escapeHTML(media) +
                    (media.indexOf("#") === -1 ? "#t=0.5" : "") +
                    '" muted playsinline preload="metadata" style="display:none"></video>';
            }
        } else if (media) {
            mediaHtml =
                '<video class="shortThumbVid" src="' +
                escapeHTML(media) +
                (media.indexOf("#") === -1 ? "#t=0.5" : "") +
                '" muted playsinline preload="metadata"></video>';
        } else {
            mediaHtml =
                '<div class="shortThumbFallback"><i class="fa-solid fa-clapperboard"></i></div>';
        }

        return `
            <article
                class="profileContentCard shortCard"
                data-id="${escapeHTML(item.id)}"
                data-type="short"
            >
                ${mediaHtml}
                <div class="shortBadge">
                    <i class="fa-solid fa-play"></i>
                </div>
                <div class="contentOverlay">
                    <span>
                        <i class="fa-solid fa-eye"></i>
                        ${formatNumber(views)}
                    </span>
                </div>
                <button
                    class="contentMoreBtn"
                    data-action="manage"
                    type="button"
                    aria-label="More options"
                >
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
            </article>
        `;

    }


    /* =====================================================
       LOAD VIDEOS
    ===================================================== */

    async function loadVideos() {
        if (!canViewContent && !isOwnProfile) {
            updateContentAccess();
            return;
        }


        const container =
            $("videosList");

        if (
            !container ||
            !profileUID
        ) {
            return;
        }

        renderLoading(
            container,
            "Loading videos..."
        );


        try {

            let items = [];


            /*
             * Dedicated videos node.
             */

            try {

                const videosSnapshot =
                    await db
                        .ref("videos")
                        .orderByChild("uid")
                        .equalTo(profileUID)
                        .once("value");


                const videos =
                    videosSnapshot.val() || {};


                items =
                    Object.entries(videos)
                        .map(
                            ([id, value]) => ({
                                id,
                                ...(value || {})
                            })
                        );

            } catch (error) {

                console.warn(
                    "Dedicated videos node unavailable:",
                    error
                );

            }


            /*
             * Fallback to video posts.
             */

            if (!items.length) {

                const postSnapshot =
                    await postsRef()
                        .orderByChild("uid")
                        .equalTo(profileUID)
                        .once("value");


                const posts =
                    postSnapshot.val() || {};


                items =
                    Object.entries(posts)
                        .map(
                            ([id, value]) => ({
                                id,
                                ...(value || {})
                            })
                        )
                        .filter(
                            item =>
                                String(
                                    item.type ||
                                    item.mediaType ||
                                    ""
                                ).toLowerCase() ===
                                "video" ||
                                item.video === true
                        );

            }


            items =
                items
                    .filter(
                        item =>
                            item.archived !== true &&
                            item.deleted !== true
                    )
                    .sort(
                        (a, b) =>
                            safeNumber(
                                b.createdAt
                            ) -
                            safeNumber(
                                a.createdAt
                            )
                    );


            if (!items.length) {

                renderEmpty(
                    container,
                    "No long videos yet",
                    "Long-form videos will appear here."
                );

                return;

            }


            container.innerHTML =
                items
                    .map(
                        renderVideoCard
                    )
                    .join("");


            bindContentActions(
                container
            );

        } catch (error) {

            console.error(
                "Videos loading error:",
                error
            );

            renderEmpty(
                container,
                "Unable to load videos",
                "Please try again."
            );

        }

    }


    /* =====================================================
       VIDEO CARD
    ===================================================== */

    function renderVideoCard(item) {

        const media =
            getMediaURL(item);

        const thumbnail =
            getThumbURL(item);


        return `
            <article
                class="videoProfileCard"
                data-id="${escapeHTML(item.id)}"
                data-type="video"
            >

                <div class="videoThumb">

                    ${
                        thumbnail
                            ? `
                                <img
                                    src="${escapeHTML(thumbnail)}"
                                    alt="Video"
                                    loading="lazy"
                                >
                            `
                            : `
                                <video
                                    src="${escapeHTML(media)}"
                                    muted
                                    playsinline
                                    preload="metadata"
                                ></video>
                            `
                    }

                    <div class="videoPlay">
                        <i class="fa-solid fa-play"></i>
                    </div>

                    <button
                    class="contentMoreBtn"
                    data-action="manage"
                    type="button"
                    aria-label="More options"
                >
                    <i class="fa-solid fa-ellipsis"></i>
                </button>

                </div>

                <div class="videoInfo">

                    <h3>
                        ${escapeHTML(
                            item.title ||
                            item.caption ||
                            "Viewora Video"
                        )}
                    </h3>

                    <p>
                        ${formatNumber(item.views)}
                        views
                    </p>

                </div>

            </article>
        `;

    }


    /* =====================================================
       LOAD SAVED
    ===================================================== */

    
    /* =====================================================
       LOAD LIVE (long-form / stream replays only — not story live)
    ===================================================== */

    async function loadLive() {
        if (!canViewContent && !isOwnProfile) {
            updateContentAccess();
            return;
        }

        const container = $("liveList");
        if (!container || !profileUID) return;

        renderLoading(container, "Loading live...");

        try {
            let items = [];
            const roots = ["lives", "live", "liveStreams", "liveVideos"];

            for (const root of roots) {
                try {
                    const snap = await db
                        .ref(root)
                        .orderByChild("uid")
                        .equalTo(profileUID)
                        .once("value");
                    const data = snap.val() || {};
                    Object.entries(data).forEach(([id, value]) => {
                        const v = value || {};
                        // Skip story-style lives
                        const mode = String(
                            v.mode || v.type || v.liveType || v.source || ""
                        ).toLowerCase();
                        if (
                            mode === "story" ||
                            mode === "stories" ||
                            v.isStory === true ||
                            v.storyLive === true
                        ) {
                            return;
                        }
                        items.push({ id, ...v, __root: root });
                    });
                } catch (_) {}
            }

            // Also long videos marked as live replay
            try {
                const vs = await db
                    .ref("videos")
                    .orderByChild("uid")
                    .equalTo(profileUID)
                    .once("value");
                const data = vs.val() || {};
                Object.entries(data).forEach(([id, value]) => {
                    const v = value || {};
                    if (
                        v.isLive === true ||
                        v.wasLive === true ||
                        String(v.type || "").toLowerCase() === "live"
                    ) {
                        items.push({ id, ...v, __root: "videos" });
                    }
                });
            } catch (_) {}

            // de-dupe
            const seen = {};
            items = items.filter((it) => {
                if (!it.id || seen[it.id]) return false;
                if (it.deleted || it.archived) return false;
                seen[it.id] = true;
                return true;
            });

            items.sort(
                (a, b) =>
                    safeNumber(b.createdAt || b.endedAt || b.startedAt) -
                    safeNumber(a.createdAt || a.endedAt || a.startedAt)
            );

            if (!items.length) {
                renderEmpty(
                    container,
                    "No live videos",
                    "Long live streams and replays appear here. Story live stays in Stories."
                );
                return;
            }

            container.innerHTML = items.map(renderVideoCard).join("");
            bindContentActions(container);
        } catch (error) {
            console.error("Live loading error:", error);
            renderEmpty(container, "Unable to load live", "Please try again.");
        }
    }

    async function loadSaved() {
        if (!canViewContent && !isOwnProfile) {
            updateContentAccess();
            return;
        }


        const container =
            $("savedList");

        if (!container) {
            return;
        }


        if (!isOwnProfile) {

            renderEmpty(
                container,
                "Private section",
                "Saved posts are visible only to you."
            );

            return;

        }


        if (!currentUser?.uid) {
            return;
        }


        renderLoading(
            container,
            "Loading saved..."
        );


        try {

            const snapshot =
                await savedPostsRef(
                    currentUser.uid
                ).once("value");


            const saved =
                snapshot.val() || {};


            const ids =
                Object.keys(saved);


            if (!ids.length) {

                renderEmpty(
                    container,
                    "Nothing saved",
                    "Posts you save will appear here."
                );

                return;

            }


            const posts = [];


            for (const id of ids) {

                try {

                    const postSnapshot =
                        await postRef(id)
                            .once("value");


                    if (
                        postSnapshot.exists()
                    ) {

                        const data =
                            postSnapshot.val() ||
                            {};


                        if (
                            data.deleted !== true &&
                            data.archived !== true
                        ) {

                            posts.push({
                                id,
                                ...data
                            });

                        }

                    }

                } catch (error) {

                    console.warn(
                        "Saved post skipped:",
                        id
                    );

                }

            }


            if (!posts.length) {

                renderEmpty(
                    container,
                    "Nothing saved",
                    "Your saved posts will appear here."
                );

                return;

            }


            container.innerHTML =
                posts
                    .map(
                        renderPostCard
                    )
                    .join("");


            bindContentActions(
                container
            );

        } catch (error) {

            console.error(
                "Saved loading error:",
                error
            );

            renderEmpty(
                container,
                "Unable to load saved posts",
                "Please try again."
            );

        }

    }


    /* =====================================================
       MEDIA URL
    ===================================================== */

        function getMediaURL(item) {
        if (!item) return "";

        function pick(v) {
            if (!v) return "";
            if (typeof v === "string") {
                const s = v.trim();
                if (!s || s === "undefined" || s === "null") return "";
                // skip data URLs that look like tiny placeholders
                if (s.indexOf("data:image/svg") === 0) return "";
                if (/^https?:\/\//i.test(s) || s.indexOf("//") === 0 || s.indexOf("data:") === 0) return s;
                if (s.indexOf("res.cloudinary") !== -1 || s.indexOf("cloudinary") !== -1) return s;
                // relative uploads path
                if (s.indexOf("uploads/") === 0 || s.indexOf("/uploads/") !== -1) return s;
                return "";
            }
            if (typeof v === "object") {
                return pick(v.secure_url || v.url || v.src || v.path || v.downloadURL || v.mediaUrl || "");
            }
            return "";
        }

        // Never treat author/profile fields as post media
        const ban = new Set([
            "photoURL", "photoUrl", "profilePhoto", "avatar", "profilePic",
            "profilePicture", "dp", "authorPhoto", "userPhoto", "ownerPhoto"
        ]);

        if (Array.isArray(item.mediaUrls) && item.mediaUrls.length) {
            for (let i = 0; i < item.mediaUrls.length; i++) {
                const u = pick(item.mediaUrls[i]);
                if (u) return u;
            }
        }
        if (Array.isArray(item.images) && item.images.length) {
            for (let i = 0; i < item.images.length; i++) {
                const u = pick(item.images[i]);
                if (u) return u;
            }
        }
        if (Array.isArray(item.media) && item.media.length) {
            for (let i = 0; i < item.media.length; i++) {
                const u = pick(item.media[i]);
                if (u) return u;
            }
        }

        const keys = [
            "thumbnailUrl", "thumbnail", "thumbnailURL", "thumb", "thumbUrl",
            "videoUrl", "videoURL", "mediaUrl", "mediaURL", "url", "fileUrl",
            "cloudinaryUrl", "secure_url", "downloadURL", "imageUrl", "imageURL",
            "postImage", "coverImage", "poster"
        ];
        for (let i = 0; i < keys.length; i++) {
            if (ban.has(keys[i])) continue;
            const u = pick(item[keys[i]]);
            if (u) return u;
        }
        return "";
    }

    function getThumbURL(item) {
        if (!item) return "";
        return (
            item.thumbnail ||
            item.thumbnailUrl ||
            item.thumbnailURL ||
            item.thumb ||
            item.thumbUrl ||
            item.poster ||
            item.cover ||
            item.coverUrl ||
            item.preview ||
            ""
        );
    }


    /* =====================================================
       CONTENT ACTIONS
    ===================================================== */

    function bindContentActions(container) {

        container
            .querySelectorAll("[data-type]")
            .forEach(
                card => {

                    card.addEventListener(
                        "click",
                        event => {

                            if (
                                event.target.closest(
                                    "[data-action='manage']"
                                )
                            ) {
                                return;
                            }

                            const id =
                                card.dataset.id;

                            const type =
                                card.dataset.type;

                            if (!id) {
                                return;
                            }

                            openContent(
                                id,
                                type
                            );

                        }
                    );

                }
            );


        container
            .querySelectorAll(
                "[data-action='manage']"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        event => {

                            event.preventDefault();

                            event.stopPropagation();

                            const card =
                                button.closest(
                                    "[data-id]"
                                );

                            if (!card) {
                                return;
                            }

                            openManageMenu(
                                card.dataset.id,
                                card.dataset.type || "short",
                                event.currentTarget || button
                            );

                        }
                    );

                }
            );

    }


    /* =====================================================
       OPEN CONTENT
    ===================================================== */

    function openContent(id, type) {

        if (!id) {
            return;
        }


        if (type === "short" || type === "shorts") {
            const q = new URLSearchParams();
            q.set("id", id);
            q.set("short", id);
            if (profileUID) {
                q.set("uid", profileUID);
                q.set("solo", "1");
                q.set("from", "profile");
            }
            window.location.href = "shorts.html?" + q.toString();
            return;
        }


        if (type === "video") {

            window.location.href =
                "video.html?id=" +
                encodeURIComponent(id);

            return;

        }


        window.location.href =
            "post.html?id=" +
            encodeURIComponent(id);

    }


    /* =====================================================
       MANAGE CONTENT
    ===================================================== */

    function openManageMenu(id, type, anchorEl) {
        const t = String(type || "").toLowerCase();
        if (t === "post" || t === "posts") return;
        openContentActionSheet(id, type, anchorEl);
    }

    function closeContentActionSheet() {
        const sheet = $("contentActionSheet");
        if (!sheet) return;
        sheet.classList.add("hidden");
        sheet.classList.remove("anchored");
        sheet.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modalOpen");
        const panel = sheet.querySelector(".aboutSheetPanel");
        if (panel) {
            panel.style.left = "";
            panel.style.top = "";
            panel.style.bottom = "";
            panel.style.right = "";
        }
    }

    function contentShareUrl(id, type) {
        const origin = window.location.origin || "";
        if (type === "short" || type === "shorts") {
            return origin + "/shorts.html?id=" + encodeURIComponent(id);
        }
        if (type === "video" || type === "videos") {
            return origin + "/video.html?id=" + encodeURIComponent(id);
        }
        return origin + "/post.html?id=" + encodeURIComponent(id);
    }

    function openContentActionSheet(id, type, anchorEl) {
        let sheet = $("contentActionSheet");
        if (!sheet) {
            sheet = document.createElement("div");
            sheet.id = "contentActionSheet";
            sheet.className = "aboutSheet hidden";
            sheet.setAttribute("aria-hidden", "true");
            sheet.innerHTML =
                '<div class="aboutSheetBackdrop" data-close-content-sheet></div>' +
                '<div class="aboutSheetPanel">' +
                '<div class="aboutSheetHandle"></div>' +
                '<header class="aboutSheetHead"><strong>Options</strong>' +
                '<button type="button" data-close-content-sheet aria-label="Close">' +
                '<i class="fa-solid fa-xmark"></i></button></header>' +
                '<div class="visitorMenuList" id="contentActionList"></div></div>';
            document.body.appendChild(sheet);
            sheet.querySelectorAll("[data-close-content-sheet]").forEach((el) => {
                el.addEventListener("click", closeContentActionSheet);
            });
        }

        const list = sheet.querySelector("#contentActionList");
        if (!list) return;

        const isOwn = !!isOwnProfile;
        const items = [
            { id: "share", icon: "fa-share-nodes", label: "Share", danger: false },
            { id: "copy", icon: "fa-link", label: "Copy link", danger: false }
        ];

        if (isOwn) {
            items.push({ id: "edit", icon: "fa-pen", label: "Edit", danger: false });
            items.push({ id: "archive", icon: "fa-box-archive", label: "Archive", danger: false });
            items.push({ id: "delete", icon: "fa-trash", label: "Delete", danger: true });
        } else {
            items.push({ id: "report", icon: "fa-flag", label: "Report", danger: true });
            items.push({ id: "hide", icon: "fa-eye-slash", label: "Not interested", danger: false });
        }

        list.innerHTML = items
            .map(
                (it) =>
                    '<button type="button" class="visitorMenuItem' +
                    (it.danger ? " danger" : "") +
                    '" data-content-action="' +
                    it.id +
                    '"><i class="fa-solid ' +
                    it.icon +
                    '"></i><span>' +
                    it.label +
                    "</span></button>"
            )
            .join("");

        list.querySelectorAll("[data-content-action]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const act = btn.getAttribute("data-content-action");
                closeContentActionSheet();
                const link = contentShareUrl(id, type);

                if (act === "share") {
                    try {
                        if (navigator.share) {
                            await navigator.share({ title: "Viewora", url: link });
                        } else if (navigator.clipboard) {
                            await navigator.clipboard.writeText(link);
                            showToast("Link copied");
                        } else {
                            window.prompt("Copy link", link);
                        }
                    } catch (_) {}
                    return;
                }
                if (act === "copy") {
                    try {
                        if (navigator.clipboard) {
                            await navigator.clipboard.writeText(link);
                            showToast("Link copied");
                        } else window.prompt("Copy link", link);
                    } catch (_) {
                        showToast("Could not copy");
                    }
                    return;
                }
                if (act === "edit") {
                    if (type === "short" || type === "shorts") {
                        location.href = "short-edit.html?id=" + encodeURIComponent(id);
                    } else if (type === "video" || type === "videos") {
                        location.href = "edit-video.html?id=" + encodeURIComponent(id);
                    } else {
                        location.href = "edit-post.html?id=" + encodeURIComponent(id);
                    }
                    return;
                }
                if (act === "archive") {
                    archiveContent(id, type);
                    return;
                }
                if (act === "delete") {
                    deleteContent(id, type);
                    return;
                }
                if (act === "report") {
                    const params = new URLSearchParams();
                    params.set("type", type || "post");
                    params.set("id", id);
                    if (profileUID) params.set("uid", profileUID);
                    location.href = "report.html?" + params.toString();
                    return;
                }
                if (act === "hide") {
                    showToast("We'll show fewer posts like this");
                    try {
                        const card = document.querySelector('[data-id="' + id + '"]');
                        if (card) card.remove();
                    } catch (_) {}
                }
            });
        });


        // Position near 3-dot if provided
        const panel = sheet.querySelector(".aboutSheetPanel");
        sheet.classList.add("anchored");
        if (panel && anchorEl && anchorEl.getBoundingClientRect) {
            const r = anchorEl.getBoundingClientRect();
            const pw = 220;
            const margin = 10;
            let left = r.right - pw;
            if (left < margin) left = margin;
            if (left + pw > window.innerWidth - margin) {
                left = window.innerWidth - pw - margin;
            }
            let top = r.bottom + 6;
            const estH = 260;
            if (top + estH > window.innerHeight - margin) {
                top = Math.max(margin, r.top - estH - 6);
            }
            panel.style.left = left + "px";
            panel.style.top = top + "px";
            panel.style.bottom = "auto";
            panel.style.right = "auto";
            panel.style.margin = "0";
        } else if (panel) {
            sheet.classList.remove("anchored");
            panel.style.left = "";
            panel.style.top = "";
            panel.style.bottom = "";
            panel.style.right = "";
        }

        sheet.classList.remove("hidden");
        sheet.setAttribute("aria-hidden", "false");
        document.body.classList.add("modalOpen");
    }


    /* =====================================================
       CONTENT REFERENCE
    ===================================================== */

    function contentReference(id, type) {

        if (type === "short") {

            return shortRef(id);

        }

        if (type === "video") {

            return db.ref(
                "videos/" + id
            );

        }

        return postRef(id);

    }


    /* =====================================================
       ARCHIVE
    ===================================================== */

    async function archiveContent(id, type) {

        if (
            !id ||
            !isOwnProfile
        ) {
            return;
        }


        try {

            await contentReference(
                id,
                type
            ).update({

                archived:
                    true,

                archivedAt:
                    SERVER_TIME

            });


            showToast(
                "Moved to archive"
            );


            await refreshCurrentTab();

        } catch (error) {

            console.error(
                "Archive failed:",
                error
            );

            showToast(
                "Archive failed"
            );

        }

    }


    /* =====================================================
       DELETE
    ===================================================== */

    async function deleteContent(id, type) {

        if (
            !id ||
            !isOwnProfile
        ) {
            return;
        }


        const confirmed =
            window.confirm(
                "Delete this content from your profile?"
            );


        if (!confirmed) {
            return;
        }


        try {

            const paths = [
                "posts/" + id,
                "shorts/" + id,
                "videos/" + id,
                "live/" + id,
                "lives/" + id,
                "users/" + (currentUser?.uid || profileUID || "") + "/posts/" + id,
                "users/" + (currentUser?.uid || profileUID || "") + "/shorts/" + id,
                "users/" + (currentUser?.uid || profileUID || "") + "/videos/" + id,
                "users/" + (currentUser?.uid || profileUID || "") + "/live/" + id
            ];
            // Soft-delete flag first
            try {
                const ref = contentReference(id, type);
                await ref.update({ deleted: true, deletedAt: Date.now() });
            } catch (_) {}
            // Permanent remove from every known path
            const updates = {};
            paths.forEach((path) => {
                if (path && !path.includes("//")) updates[path] = null;
            });
            try {
                await db.ref().update(updates);
            } catch (e) {
                console.warn("bulk delete partial", e);
                for (const path of paths) {
                    try { await db.ref(path).remove(); } catch (_) {}
                }
            }
            // Extra: comments / likes subtrees
            try { await db.ref("comments/" + id).remove(); } catch (_) {}
            try { await db.ref("likes/" + id).remove(); } catch (_) {}
            try { await db.ref("shortLikes/" + id).remove(); } catch (_) {}

            showToast(
                "Content deleted"
            );


            await refreshCurrentTab();

        } catch (error) {

            console.error(
                "Delete failed:",
                error
            );

            showToast(
                "Delete failed"
            );

        }

    }


    /* =====================================================
       REFRESH CURRENT TAB
    ===================================================== */

    async function refreshCurrentTab() {

        if (currentTab === "posts") {

            await loadPosts();

        }

        if (currentTab === "shorts") {

            await loadShorts();

        }

        if (currentTab === "videos") {

            await loadVideos();

        }

        if (currentTab === "saved") {

            await loadSaved();

        }

    }


    /* =====================================================
       STORY SETUP
    ===================================================== */

    function setupStory() {

        storyInput =
            $("storyFile");


        // Plus button → open story-upload.html (no file picker)
        $("storyPlusBtn")
            ?.addEventListener(
                "click",
                (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isOwnProfile) {
                        openProfileStories();
                        return;
                    }
                    window.location.href = "story-upload.html";
                }
            );

        // New story item → open story-upload.html (active stories only, NOT highlights)
        $("newStoryItem")
            ?.addEventListener(
                "click",
                (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isOwnProfile) {
                        window.location.href = "story-upload.html";
                    } else {
                        openProfileStories();
                    }
                }
            );


        // Keep file input support only as fallback (not triggered from UI)
        storyInput
            ?.addEventListener(
                "change",
                handleStoryUpload
            );

    }


    /* =====================================================
       STORY UPLOAD
    ===================================================== */

    async function handleStoryUpload(event) {

        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        if (busyStory) {
            return;
        }

        if (!isOwnProfile) {
            return;
        }

        busyStory = true;


        try {

            showToast(
                "Uploading story..."
            );


            const media =
                await uploadToCloudinary(
                    file
                );


            if (!media?.url) {

                throw new Error(
                    "Cloudinary upload failed."
                );

            }


            const story =
                storiesRef().push();


            await story.set({

                id:
                    story.key,

                uid:
                    currentUser.uid,

                type:
                    file.type.startsWith(
                        "video/"
                    )
                        ? "video"
                        : "image",

                mediaUrl:
                    media.url,

                thumbnail:
                    media.thumbnail ||
                    media.url,

                createdAt:
                    SERVER_TIME,

                // Active for 24 hours, then moves to Highlights
                expiresAt:
                    Date.now() +
                    (
                        24 *
                        60 *
                        60 *
                        1000
                    ),

                viewed:
                    false

            });


            if (storyInput) {
                storyInput.value = "";
            }


            showToast(
                "Story added"
            );


            await loadStories();

        } catch (error) {

            console.error(
                "Story upload failed:",
                error
            );

            showToast(
                "Story upload failed"
            );

        } finally {

            busyStory = false;

        }

    }


    /* =====================================================
       CLOUDINARY
    ===================================================== */

    async function uploadToCloudinary(file) {

        const CLOUD_NAME =
            "z5m6wjdf";

        const UPLOAD_PRESET =
            "Viewora-upload";

        const UPLOAD_URL =
            "https://api.cloudinary.com/v1_1/" +
            CLOUD_NAME +
            "/auto/upload";


        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );

        formData.append(
            "upload_preset",
            UPLOAD_PRESET
        );


        const response =
            await fetch(
                UPLOAD_URL,
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!response.ok) {

            throw new Error(
                "Cloudinary HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        return {

            url:
                data.secure_url ||
                data.url ||
                "",

            thumbnail:
                data.thumbnail_url ||
                data.secure_url ||
                "",

            publicId:
                data.public_id ||
                "",

            resourceType:
                data.resource_type ||
                ""

        };

    }


    /* =====================================================
       LOAD STORIES
    ===================================================== */

    async function loadStories() {

        const wrapper =
            $("storiesWrapper");

        if (
            !wrapper ||
            !profileUID
        ) {
            return;
        }


        try {

            // Load stories for THIS profile only (uid / userId / ownerId)
            let data = {};
            try {
                const snapUid = await storiesRef()
                    .orderByChild("uid")
                    .equalTo(profileUID)
                    .once("value");
                if (snapUid.exists()) {
                    Object.assign(data, snapUid.val() || {});
                }
            } catch (_) {}

            // Fallback: scan recent stories and filter by owner fields
            // (covers userId / ownerId / creatorId without index)
            try {
                const snapAll = await storiesRef().limitToLast(200).once("value");
                if (snapAll.exists()) {
                    snapAll.forEach((child) => {
                        const v = child.val() || {};
                        const owner =
                            v.uid ||
                            v.userId ||
                            v.ownerId ||
                            v.creatorId ||
                            "";
                        if (String(owner) === String(profileUID)) {
                            data[child.key] = v;
                        }
                    });
                }
            } catch (_) {}


            const now =
                Date.now();


            const allStories =
                Object.entries(data)
                    .map(
                        ([id, value]) => ({
                            id,
                            ...(value || {})
                        })
                    )
                    .filter((s) => {
                        const owner =
                            s.uid ||
                            s.userId ||
                            s.ownerId ||
                            s.creatorId ||
                            "";
                        return String(owner) === String(profileUID);
                    })
                    .sort(
                        (a, b) =>
                            safeNumber(
                                b.createdAt
                            ) -
                            safeNumber(
                                a.createdAt
                            )
                    );


            // Active = still within 24 hours
            const activeStories =
                allStories.filter(
                    story => {

                        const expiry =
                            safeNumber(
                                story.expiresAt
                            );

                        return (
                            !expiry ||
                            expiry > now
                        );

                    }
                );


            // Expired candidates (user may pin as highlight — optional)
            const expiredStories =
                allStories.filter(
                    story => {
                        const expiry = safeNumber(story.expiresAt);
                        return expiry && expiry <= now;
                    }
                );

            // Highlights = albums (collections) or legacy single pins
            let highlightStories = [];
            try {
                const hlSnap = await db
                    .ref("users/" + profileUID + "/highlights")
                    .once("value");
                const hlMap = hlSnap.exists() ? (hlSnap.val() || {}) : {};
                window.__vieworaHighlightMeta = hlMap;
                const byId = {};
                allStories.forEach((s) => { byId[s.id] = s; });

                for (const [key, meta] of Object.entries(hlMap)) {
                    if (!meta || meta === false || meta === 0) continue;

                    // Collection album: { title, coverUrl, storyIds: [] }
                    if (meta && typeof meta === "object" && Array.isArray(meta.storyIds)) {
                        const ids = meta.storyIds.filter(Boolean);
                        if (!ids.length) continue;
                        let cover =
                            meta.coverUrl ||
                            meta.cover ||
                            "";
                        if (!cover) {
                            const first = byId[ids[0]];
                            if (first) {
                                cover =
                                    first.thumbnail ||
                                    first.thumbnailUrl ||
                                    first.mediaUrl ||
                                    first.url ||
                                    "";
                            } else {
                                try {
                                    const ss = await db.ref("stories/" + ids[0]).once("value");
                                    if (ss.exists()) {
                                        const v = ss.val() || {};
                                        cover =
                                            v.thumbnail ||
                                            v.thumbnailUrl ||
                                            v.mediaUrl ||
                                            v.url ||
                                            "";
                                    }
                                } catch (_) {}
                            }
                        }
                        highlightStories.push({
                            id: key,
                            __isHighlight: true,
                            __isAlbum: true,
                            storyIds: ids,
                            highlightTitle: meta.title || "Highlight",
                            highlightCover: cover,
                            title: meta.title || "Highlight",
                            mediaUrl: cover,
                            thumbnail: cover
                        });
                        continue;
                    }

                    // Legacy: key is storyId
                    const storyId =
                        (meta && typeof meta === "object" && (meta.storyId || meta.id)) ||
                        key;
                    let storyObj = byId[storyId] ? { ...byId[storyId] } : null;
                    if (!storyObj) {
                        try {
                            const ss = await db.ref("stories/" + storyId).once("value");
                            if (ss.exists()) storyObj = { id: storyId, ...(ss.val() || {}) };
                        } catch (_) {}
                    }
                    if (!storyObj) continue;
                    if (meta && typeof meta === "object") {
                        if (meta.coverUrl || meta.cover) {
                            storyObj.highlightCover = meta.coverUrl || meta.cover;
                        }
                        if (meta.title) storyObj.highlightTitle = meta.title;
                    }
                    storyObj.__isHighlight = true;
                    storyObj.storyIds = [storyObj.id];
                    highlightStories.push(storyObj);
                }
            } catch (e) {
                console.warn("Highlights load failed:", e);
            }

            window.__vieworaExpiredStories = expiredStories;
            window.__vieworaPinnedHighlightIds = highlightStories.map((s) => s.id);


            const newItem =
                $("newStoryItem");


            wrapper.innerHTML = "";


            if (
                isOwnProfile &&
                newItem
            ) {

                wrapper.appendChild(
                    newItem
                );

            }


            // Render active stories (top ring)
            activeStories.forEach(
                story => {

                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "storyItem";


                    const media =
                        story.mediaUrl ||
                        story.url ||
                        "";


                    item.innerHTML = `

                        <div class="storyCircle">

                            ${
                                story.type === "video"
                                    ? `
                                        <video
                                            src="${escapeHTML(media)}"
                                            muted
                                            playsinline
                                            preload="metadata"
                                        ></video>
                                    `
                                    : `
                                        <img
                                            src="${escapeHTML(
                                                media ||
                                                DEFAULT_AVATAR
                                            )}"
                                            alt="Story"
                                        >
                                    `
                            }

                        </div>

                        <p>
                            ${
                                escapeHTML(
                                    story.title ||
                                    "Story"
                                )
                            }
                        </p>

                    `;


                    item.addEventListener(
                        "click",
                        () => {

                            // Open your stories.html viewer
                            openStoryViewer(
                                story
                            );

                        }
                    );


                    wrapper.appendChild(
                        item
                    );

                }
            );


            if (
                !activeStories.length &&
                !isOwnProfile
            ) {

                renderStoryEmpty(
                    wrapper
                );

            }

            // Avatar ring: only THIS profile's stories
            updateStoryRingUI(activeStories.length > 0);


            // Highlights: show pinned stories (any age)
            const hlSection = $("highlightsSection");
            const hlWrap =
                $("highlightsWrapper") ||
                $("highlightsList") ||
                $("profileHighlights");
            if (hlSection && hlWrap) {
                hlWrap.style.display = "";
                hlWrap.removeAttribute("hidden");
                // Owner always sees Highlights; visitors see only if pinned exist
                if (highlightStories.length || isOwnProfile) {
                    hlSection.removeAttribute("hidden");
                    hlSection.hidden = false;
                    hlSection.style.setProperty("display", "block", "important");
                    renderHighlights(highlightStories);
                } else {
                    hlSection.setAttribute("hidden", "");
                    hlSection.hidden = true;
                    hlSection.style.setProperty("display", "none", "important");
                    hlWrap.innerHTML = "";
                }
            }


        } catch (error) {

            console.warn(
                "Stories loading failed:",
                error
            );
            // Owner should still manage highlights even if story load fails
            try {
                if (isOwnProfile) {
                    const hlSection = $("highlightsSection");
                    const hlWrap = $("highlightsWrapper");
                    if (hlSection && hlWrap) {
                        hlSection.removeAttribute("hidden");
                        hlSection.hidden = false;
                        hlSection.style.setProperty("display", "block", "important");
                        renderHighlights([]);
                    }
                }
            } catch (_) {}

        }

    }


    /* =====================================================
       STORY VIEWER
    ===================================================== */

    function openStoryViewer(story, asHighlight) {

        if (!profileUID) {
            return;
        }

        // Album / multi-story highlight
        const ids =
            (story && Array.isArray(story.storyIds) && story.storyIds.length)
                ? story.storyIds
                : (story && story.id ? [story.id] : []);

        if (ids.length) {
            try {
                sessionStorage.setItem(
                    "vieworaHighlightPlaylist",
                    JSON.stringify({
                        uid: profileUID,
                        albumId: story.__isAlbum ? story.id : "",
                        title: story.highlightTitle || story.title || "Highlight",
                        storyIds: ids
                    })
                );
            } catch (_) {}
        }

        const firstId = ids[0] || (story && story.id) || "";
        let url =
            "stories.html?uid=" +
            encodeURIComponent(profileUID) +
            "&solo=1&from=profile&highlight=1";

        if (firstId) {
            url +=
                "&story=" +
                encodeURIComponent(firstId) +
                "&storyId=" +
                encodeURIComponent(firstId);
        }
        if (story && story.__isAlbum) {
            url += "&album=" + encodeURIComponent(story.id);
        }

        try {
            sessionStorage.setItem("VIEWORA_AUDIO_UNLOCK", "1");
            if (!window.__vieworaUnlockAudio) {
                window.__vieworaUnlockAudio = new Audio(
                    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
                );
            }
            window.__vieworaUnlockAudio.play().catch(function () {});
        } catch (_) {}
        window.location.href = url;

    }


    /* =====================================================
       OPEN PROFILE STORIES — only this profileUID
    ===================================================== */

    function openProfileStories() {

        if (!profileUID) {
            return;
        }

        // Solo = only this user's stories, no swipe to others
        try {
            sessionStorage.setItem("VIEWORA_AUDIO_UNLOCK", "1");
            if (!window.__vieworaUnlockAudio) {
                window.__vieworaUnlockAudio = new Audio(
                    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
                );
            }
            window.__vieworaUnlockAudio.play().catch(function () {});
        } catch (_) {}
        (function () {
            var url =
                "stories.html?uid=" +
                encodeURIComponent(profileUID) +
                "&solo=1&from=profile";
            try {
                var nm =
                    (window.__profileData &&
                        (__profileData.username ||
                            __profileData.displayName ||
                            __profileData.name)) ||
                    (document.getElementById("profileUsername") &&
                        document.getElementById("profileUsername").textContent) ||
                    (document.getElementById("displayName") &&
                        document.getElementById("displayName").textContent) ||
                    "";
                nm = String(nm || "").replace(/^@/, "").trim();
                if (nm) url += "&name=" + encodeURIComponent(nm);
                var img =
                    document.querySelector("#profileAvatar img, #storyRing img, .profileAvatar img");
                if (img && img.src && img.src.indexOf("default") === -1) {
                    url += "&photo=" + encodeURIComponent(img.src);
                }
            } catch (_) {}
            window.location.href = url;
        })();

    }

    function updateStoryRingUI(hasActive) {
        const ring = document.getElementById("storyRing");
        if (!ring) return;
        ring.classList.toggle("hasActiveStory", !!hasActive);
        ring.setAttribute(
            "data-has-story",
            hasActive ? "1" : "0"
        );
        // Click ring (not +) → this profile's stories only
        if (!ring.getAttribute("data-wired-story")) {
            ring.setAttribute("data-wired-story", "1");
            ring.addEventListener("click", function (event) {
                if (event.target.closest("#storyPlusBtn")) return;
                event.preventDefault();
                event.stopPropagation();
                const has =
                    ring.getAttribute("data-has-story") === "1";
                if (has) {
                    openProfileStories();
                } else if (isOwnProfile) {
                    window.location.href = "story-upload.html";
                }
                // Other profile with no active story → do NOT open stories
                else {
                    if (typeof showToast === "function") {
                        showToast("No story right now");
                    }
                }
            });
        }
    }


    /* =====================================================
       STORY EMPTY
    ===================================================== */

    function renderStoryEmpty(wrapper) {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "storyItem";


        item.innerHTML = `

            <div class="storyCircle addStory">

                <i class="fa-solid fa-clock"></i>

            </div>

            <p>
                No Story
            </p>

        `;


        wrapper.appendChild(
            item
        );

    }


    /* =====================================================
       HIGHLIGHTS (expired stories – 24h complete)
    ===================================================== */

    function renderHighlights(stories) {

        const container =
            $("highlightsWrapper") ||
            $("highlightsList") ||
            $("profileHighlights") ||
            document.querySelector(".highlightsWrapper");

        if (!container) return;

        container.innerHTML = "";

        // Owner only: + opens highlight builder (NOT story-upload)
        if (isOwnProfile) {
            const add = document.createElement("div");
            add.className = "highlightItem storyItem highlightAdd";
            add.innerHTML =
                '<div class="storyCircle highlightCircle addHighlight">' +
                '<i class="fa-solid fa-plus"></i></div><p>New</p>';
            add.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = "story-highlight.html";
            });
            container.appendChild(add);
        }

        if (!stories || !stories.length) {
            return;
        }

        stories.forEach((story) => {
            const item = document.createElement("div");
            item.className = "highlightItem storyItem";
            item.setAttribute("data-highlight-id", story.id || "");

            const media =
                story.highlightCover ||
                story.thumbnail ||
                story.thumbnailUrl ||
                story.mediaUrl ||
                story.url ||
                "";

            const title =
                story.highlightTitle ||
                story.title ||
                story.caption ||
                "Highlight";

            item.innerHTML =
                '<div class="storyCircle highlightCircle">' +
                (media
                    ? '<img src="' +
                      escapeHTML(media) +
                      '" alt="">'
                    : '<i class="fa-solid fa-circle-play" style="opacity:.5"></i>') +
                "</div><p>" +
                escapeHTML(title) +
                "</p>";

            item.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                story.__isHighlight = true;
                openStoryViewer(story, true);
            });

            if (isOwnProfile) {
                item.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    if (window.confirm("Delete this highlight?")) {
                        unpinHighlight(story.id);
                    }
                });
            }

            container.appendChild(item);
        });
    }

    /* =====================================================
       LOADING
    ===================================================== */

    function renderLoading(
        container,
        text
    ) {
        // Loading UI removed as requested – keep container empty while data loads
        if (container) {
            container.innerHTML = "";
        }
    }


    /* =====================================================
       EMPTY
    ===================================================== */

    function renderEmpty(
        container,
        title,
        description
    ) {

        container.innerHTML = `

            <div class="profileEmpty">

                <div class="emptyIcon">

                    <i class="fa-solid fa-layer-group"></i>

                </div>

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
                    ${escapeHTML(description)}
                </p>

            </div>

        `;

    }


    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(message) {

        let toast =
            document.getElementById(
                "vieworaProfileToast"
            );


        if (!toast) {

            toast =
                document.createElement(
                    "div"
                );

            toast.id =
                "vieworaProfileToast";

            document.body.appendChild(
                toast
            );

        }


        toast.textContent =
            message;


        toast.classList.add(
            "show"
        );


        clearTimeout(
            toast.__timer
        );


        toast.__timer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                2400
            );

    }


    /* =====================================================
       SCROLL TOP
    ===================================================== */

    function setupScrollTop() {

        const button =
            $("scrollTopBtn");

        if (!button) {
            return;
        }


        window.addEventListener(
            "scroll",
            () => {

                button.classList.toggle(
                    "hidden",
                    window.scrollY < 400
                );

            },
            {
                passive: true
            }
        );


        button.addEventListener(
            "click",
            () => {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }


    /* =====================================================
       PAGE LOADER
    ===================================================== */

    function hidePageLoader() {

        const loader =
            $("pageLoader");

        const app =
            $("app");


        loader?.classList.add(
            "hidden"
        );

        app?.classList.remove(
            "hidden"
        );

        profileLoadFinished = true;

    }


    /* =====================================================
       LOADER TIMEOUT
    ===================================================== */

    function startLoaderProtection() {
        // Disabled – loading UI removed
    }


    /* =====================================================
       ERROR SCREEN
    ===================================================== */

    function showProfileError(message) {

        const app =
            $("app");

        if (!app) {
            return;
        }


        app.classList.remove(
            "hidden"
        );


        app.innerHTML = `

            <div class="profileError">

                <div class="errorIcon">

                    <i class="fa-solid fa-user-slash"></i>

                </div>

                <h2>
                    Profile unavailable
                </h2>

                <p>
                    ${escapeHTML(message)}
                </p>

                <button
                    type="button"
                    onclick="history.back()"
                >
                    Go Back
                </button>

            </div>

        `;

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function unlockPageScroll() {
        try {
            document.documentElement.style.setProperty("overflow-y", "auto", "important");
            document.documentElement.style.setProperty("height", "auto", "important");
            document.body.style.setProperty("overflow-y", "auto", "important");
            document.body.style.setProperty("height", "auto", "important");
            document.body.style.setProperty("touch-action", "pan-y", "important");
            const app = document.getElementById("app");
            if (app) {
                app.classList.remove("hidden");
                app.style.setProperty("overflow", "visible", "important");
                app.style.setProperty("height", "auto", "important");
            }
            document.querySelectorAll("#pageLoader, .pageLoader").forEach((el) => {
                el.classList.add("hidden");
                el.style.display = "none";
            });
        } catch (_) {}
    }

    async function initProfile() {

        // Theme from settings (dark / light)
        try {
            const theme = localStorage.getItem("viewora_theme") || "dark";
            document.documentElement.setAttribute(
                "data-theme",
                theme === "light" ? "light" : "dark"
            );
            document.body.setAttribute(
                "data-theme",
                theme === "light" ? "light" : "dark"
            );
        } catch (_) {}

        unlockPageScroll();
        setTimeout(unlockPageScroll, 400);

        // Loading removed – hide page loader immediately
        hidePageLoader();


        try {

            /*
             * STEP 1
             * Authentication
             */

            await loadCurrentUser();


            if (!currentUser) {

                hidePageLoader();

                return;

            }


            /*
             * STEP 2
             * Profile UID
             */

            profileUID =
                resolveProfileUID();

            // Expose for HTML helpers (View all, story ring, etc.)
            window.profileUID =
                profileUID;


            if (!profileUID) {

                showProfileError(
                    "User profile could not be found."
                );

                hidePageLoader();

                return;

            }


            /*
             * STEP 3
             * Own profile
             */

            isOwnProfile =
                currentUser.uid ===
                profileUID;


            /*
             * STEP 4
             * Load profile
             */

            profileUser =
                await loadProfileUser(
                    profileUID
                );


            if (!profileUser) {

                showProfileError(
                    "This profile does not exist."
                );

                hidePageLoader();

                return;

            }


            /*
             * STEP 5
             * Render immediately.
             *
             * This prevents the page from staying
             * blank while counts are loading.
             */

            renderProfile(
                profileUser
            );


            /*
             * STEP 6
             * Profile mode
             */

            renderProfileMode();


            /*
             * STEP 7
             * Setup UI
             */

            setupProfileButtons();

            setupTabs();

            setupStory();

            setupScrollTop();


            /*
             * STEP 8
             * Hide loader NOW.
             */

            hidePageLoader();


            /*
             * STEP 9
             * Follow state.
             */

            await checkFollowState();


            /*
             * STEP 10
             * Real followers/following.
             */

            await refreshRealFollowCounts();


            /*
             * STEP 11
             * Stories.
             *
             * Don't let story errors block profile.
             */

            await loadStories();


            /*
             * STEP 12
             * Default posts.
             */

            await loadPosts();


            console.log(
                "=========================================="
            );

            console.log(
                "✅ VIEWORA PROFILE READY"
            );

            console.log(
                "Profile UID:",
                profileUID
            );

            console.log(
                "Own Profile:",
                isOwnProfile
            );

            console.log(
                "=========================================="
            );

        } catch (error) {

            console.error(
                "❌ Profile initialization failed:",
                error
            );


            /*
             * Never leave the user stuck on loading.
             */

            hidePageLoader();


            /*
             * Only show error if profile wasn't
             * already rendered.
             */

            if (!profileUser) {

                showProfileError(
                    "Something went wrong while loading this profile."
                );

            }

        }

    }


    /* =====================================================
       START
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initProfile,
            {
                once: true
            }
        );

    } else {

        initProfile();

    }


    /* =====================================================
       GLOBAL API
    ===================================================== */

    
    /* =====================================================
       REPORT USER → report.html
    ===================================================== */

    function reportProfileUser() {
        if (!profileUID || isOwnProfile) return;
        const params = new URLSearchParams();
        params.set("type", "user");
        params.set("uid", profileUID);
        window.location.href = "report.html?" + params.toString();
    }


    
    /* =====================================================
       HIGHLIGHTS — user chooses which expired stories to pin
    ===================================================== */

    async function pinHighlight(storyId) {
        if (!isOwnProfile || !currentUser?.uid || !storyId) return;
        try {
            await db.ref("users/" + currentUser.uid + "/highlights/" + storyId).set({
                storyId,
                pinnedAt: Date.now()
            });
            showToast("Added to highlights");
            await loadStories();
        } catch (e) {
            console.error(e);
            showToast("Could not add highlight");
        }
    }

    async function unpinHighlight(storyId) {
        if (!isOwnProfile || !currentUser?.uid || !storyId) return;
        try {
            await db.ref("users/" + currentUser.uid + "/highlights/" + storyId).remove();
            showToast("Removed from highlights");
            await loadStories();
        } catch (e) {
            console.error(e);
            showToast("Could not remove");
        }
    }

    function manageHighlights() {
        if (!isOwnProfile) {
            showToast("Only you can manage your highlights");
            return;
        }
        window.location.href = "story-highlight.html";
    }



    async function acceptFollowRequest(fromUID) {
        if (!isOwnProfile || !currentUser?.uid || !fromUID) return;
        const me = currentUser.uid;
        const updates = {};
        updates["followRequests/" + me + "/" + fromUID] = null;
        updates["followers/" + me + "/" + fromUID] = true;
        updates["following/" + fromUID + "/" + me] = true;
        await db.ref().update(updates);
        try {
            const n = notificationsRef(fromUID).push();
            await n.set({
                id: n.key,
                type: "follow_accepted",
                fromUID: me,
                message: "accepted your follow request",
                read: false,
                createdAt: SERVER_TIME
            });
        } catch (_) {}
        showToast("Request accepted");
        await refreshRealFollowCounts();
    }

    async function rejectFollowRequest(fromUID) {
        if (!isOwnProfile || !currentUser?.uid || !fromUID) return;
        await db.ref("followRequests/" + currentUser.uid + "/" + fromUID).remove();
        showToast("Request declined");
    }

    window.VieworaProfile = {

        openMore:
            openVisitorMenu,

        report:
            reportProfileUser,

        acceptFollowRequest:
            acceptFollowRequest,

        acceptIncomingFromProfile:
            acceptIncomingFromProfile,

        declineIncomingFromProfile:
            declineIncomingFromProfile,

        rejectFollowRequest:
            rejectFollowRequest,


        reload:
            initProfile,

        loadPosts:
            loadPosts,

        loadShorts:
            loadShorts,

        loadVideos:
            loadVideos,

        loadSaved:
            loadSaved,

        loadStories:
            loadStories,
        openProfileStories:
            openProfileStories,

        toggleFollow:
            toggleFollow,

        openContent:
            openContent,

        openStoryViewer:
            openStoryViewer,

        refreshCounts:
            refreshRealFollowCounts,

        pinHighlight:
            pinHighlight,

        unpinHighlight:
            unpinHighlight,

        manageHighlights:
            manageHighlights

    };


    // Also expose for older HTML helpers
    window.openStoryViewer =
        openStoryViewer;


})();