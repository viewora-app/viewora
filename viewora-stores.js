"use strict";

/*
============================================================
 VIEWORA — Music Store · Sticker Store · Monetization
               Verification Tiers · Subscriptions

 Firebase schema (Realtime Database):

  musicLibrary/{trackId}
    title, artist, audioUrl, coverUrl, duration, genre,
    uses, trending, active, createdAt

  stickerPacks/{packId}
    name, coverUrl, category, price (0 = free),
    stickers: [{ id, url, name }],
    active, uses, createdAt

  users/{uid}
    verified, isVerified, blueTick
    badge: "none" | "creator" | "influencer" | "subscriber"
    monetizationEnabled, monetizationStatus
    subscription: {
      enabled, priceMonthly, priceYearly,
      subscriberCount, currency
    }

  subscriptions/{creatorId}/{subscriberId}
    status: active|cancelled, plan, startedAt, expiresAt

  monetization/{uid}
    enabled, status, earnings, policy

  Badge rules (admin can override):
    creator     → verified blue tick
    influencer  → verified + 10k followers OR admin grant
    subscriber  → has active paid plan to a creator
============================================================
*/

(function (global) {

    const db =
        global.db ||
        global.firebaseDB ||
        (global.firebase && firebase.database && firebase.database());

    const auth =
        global.auth ||
        (global.firebase && firebase.auth && firebase.auth());

    /* ---------- helpers ---------- */

    function escapeHTML(v) {
        return String(v ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatCount(n) {
        n = Number(n) || 0;
        if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
        if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
        return String(n);
    }

    /* =====================================================
       MUSIC STORE
    ===================================================== */

    const MusicStore = {

        async list(limit = 40) {
            if (!db) return [];
            const snap = await db
                .ref("musicLibrary")
                .orderByChild("active")
                .equalTo(true)
                .limitToLast(limit)
                .once("value");

            const list = [];
            snap.forEach((c) => {
                list.push({ id: c.key, ...c.val() });
            });
            return list.reverse();
        },

        async search(query) {
            const all = await this.list(100);
            const q = String(query || "").toLowerCase().trim();
            if (!q) return all;
            return all.filter(
                (t) =>
                    (t.title || "").toLowerCase().includes(q) ||
                    (t.artist || "").toLowerCase().includes(q) ||
                    (t.genre || "").toLowerCase().includes(q)
            );
        },

        async addTrack(data) {
            if (!db) throw new Error("DB missing");
            const ref = db.ref("musicLibrary").push();
            await ref.set({
                title: data.title || "Untitled",
                artist: data.artist || "Unknown",
                audioUrl: data.audioUrl || "",
                coverUrl: data.coverUrl || "",
                duration: Number(data.duration) || 0,
                genre: data.genre || "Other",
                uses: 0,
                trending: false,
                active: true,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            return ref.key;
        },

        async incrementUse(trackId) {
            if (!db || !trackId) return;
            await db
                .ref("musicLibrary/" + trackId + "/uses")
                .transaction((v) => (Number(v) || 0) + 1);
        },

        /** Attach selected music to a short/story payload */
        attachToMedia(payload, track) {
            if (!track) return payload;
            return {
                ...payload,
                music: {
                    id: track.id,
                    title: track.title,
                    artist: track.artist,
                    audioUrl: track.audioUrl,
                    coverUrl: track.coverUrl
                },
                musicId: track.id,
                musicTitle: track.title,
                musicArtist: track.artist
            };
        }
    };

    /* =====================================================
       STICKER STORE
    ===================================================== */

    const StickerStore = {

        async listPacks(limit = 30) {
            if (!db) return [];
            const snap = await db
                .ref("stickerPacks")
                .limitToLast(limit)
                .once("value");

            const list = [];
            snap.forEach((c) => {
                const v = c.val() || {};
                if (v.active === false) return;
                list.push({ id: c.key, ...v });
            });
            return list.reverse();
        },

        async addPack(data) {
            if (!db) throw new Error("DB missing");
            const ref = db.ref("stickerPacks").push();
            await ref.set({
                name: data.name || "Pack",
                coverUrl: data.coverUrl || "",
                category: data.category || "General",
                price: Number(data.price) || 0,
                stickers: Array.isArray(data.stickers)
                    ? data.stickers
                    : [],
                uses: 0,
                active: true,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            return ref.key;
        },

        async incrementUse(packId) {
            if (!db || !packId) return;
            await db
                .ref("stickerPacks/" + packId + "/uses")
                .transaction((v) => (Number(v) || 0) + 1);
        }
    };

    /* =====================================================
       VERIFICATION / BADGES
       creator · influencer · subscriber
    ===================================================== */

    const Badges = {

        /** HTML snippet for name row */
        tickHTML(user) {
            if (!user) return "";
            const verified =
                user.verified === true ||
                user.isVerified === true ||
                user.blueTick === true;

            if (!verified) return "";

            const badge = String(user.badge || "creator").toLowerCase();
            let title = "Verified Creator";
            let extra = "";

            if (badge === "influencer") {
                title = "Verified Influencer";
                extra = " influencer";
            } else if (badge === "subscriber") {
                title = "Subscriber";
            }

            return `<span class="vieworaTick${extra}" title="${escapeHTML(title)}" aria-label="${escapeHTML(title)}"><i class="fa-solid fa-circle-check"></i></span>`;
        },

        async setBadge(uid, badge) {
            if (!db || !uid) return;
            const allowed = [
                "none",
                "creator",
                "influencer",
                "subscriber"
            ];
            const b = allowed.includes(badge) ? badge : "creator";

            const updates = {
                badge: b,
                verified: b !== "none",
                isVerified: b !== "none",
                blueTick: b === "creator" || b === "influencer",
                verificationStatus:
                    b === "none" ? "none" : "verified",
                verifiedAt:
                    firebase.database.ServerValue.TIMESTAMP
            };

            await db.ref("users/" + uid).update(updates);
        }
    };

    /* =====================================================
       MONETIZATION (policy already in admin)
         300k views · 600 followers · 100 stories
    ===================================================== */

    const Monetization = {
        RULES: {
            minViews: 300000,
            minFollowers: 600,
            minStories: 100
        },

        async isEnabled(uid) {
            if (!db || !uid) return false;
            const snap = await db
                .ref("users/" + uid + "/monetizationEnabled")
                .once("value");
            return snap.val() === true;
        },

        async setEnabled(uid, enabled) {
            if (!db || !uid) return;
            await db.ref("users/" + uid).update({
                monetizationEnabled: !!enabled,
                monetizationStatus: enabled ? "active" : "disabled",
                monetizationUpdatedAt:
                    firebase.database.ServerValue.TIMESTAMP
            });
            await db.ref("monetization/" + uid).update({
                enabled: !!enabled,
                status: enabled ? "active" : "disabled",
                updatedAt:
                    firebase.database.ServerValue.TIMESTAMP
            });
        }
    };

    /* =====================================================
       CREATOR SUBSCRIPTIONS
       Fan pays creator monthly/yearly
    ===================================================== */

    const Subscriptions = {

        async getCreatorPlan(creatorId) {
            if (!db || !creatorId) return null;
            const snap = await db
                .ref("users/" + creatorId + "/subscription")
                .once("value");
            return snap.val() || null;
        },

        /** Creator enables their subscription channel */
        async enablePlan(creatorId, opts = {}) {
            if (!db || !creatorId) return;
            await db.ref("users/" + creatorId + "/subscription").update({
                enabled: true,
                priceMonthly: Number(opts.priceMonthly) || 49,
                priceYearly: Number(opts.priceYearly) || 499,
                currency: opts.currency || "INR",
                subscriberCount: Number(opts.subscriberCount) || 0,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
        },

        async disablePlan(creatorId) {
            if (!db || !creatorId) return;
            await db
                .ref("users/" + creatorId + "/subscription/enabled")
                .set(false);
        },

        /** Fan subscribes (payment gateway hook later) */
        async subscribe(creatorId, subscriberId, plan = "monthly") {
            if (!db || !creatorId || !subscriberId) return;
            if (creatorId === subscriberId) {
                throw new Error("Cannot subscribe to yourself");
            }

            const planSnap = await this.getCreatorPlan(creatorId);
            if (!planSnap || planSnap.enabled !== true) {
                throw new Error("Creator has no active subscription plan");
            }

            const days = plan === "yearly" ? 365 : 30;
            const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;

            await db
                .ref("subscriptions/" + creatorId + "/" + subscriberId)
                .set({
                    status: "active",
                    plan,
                    price:
                        plan === "yearly"
                            ? planSnap.priceYearly
                            : planSnap.priceMonthly,
                    currency: planSnap.currency || "INR",
                    startedAt:
                        firebase.database.ServerValue.TIMESTAMP,
                    expiresAt
                });

            await db
                .ref(
                    "users/" +
                        creatorId +
                        "/subscription/subscriberCount"
                )
                .transaction((v) => (Number(v) || 0) + 1);

            /* Mark subscriber badge optionally */
            await db.ref("users/" + subscriberId).update({
                hasSubscriptions: true
            });
        },

        async isSubscribed(creatorId, subscriberId) {
            if (!db || !creatorId || !subscriberId) return false;
            const snap = await db
                .ref(
                    "subscriptions/" +
                        creatorId +
                        "/" +
                        subscriberId
                )
                .once("value");
            const v = snap.val();
            if (!v || v.status !== "active") return false;
            if (v.expiresAt && Number(v.expiresAt) < Date.now()) {
                return false;
            }
            return true;
        },

        async cancel(creatorId, subscriberId) {
            if (!db || !creatorId || !subscriberId) return;
            await db
                .ref(
                    "subscriptions/" +
                        creatorId +
                        "/" +
                        subscriberId +
                        "/status"
                )
                .set("cancelled");
        }
    };

    /* ---------- CSS for tick (inject once) ---------- */
    function injectBadgeCSS() {
        if (document.getElementById("viewora-badge-css")) return;
        const style = document.createElement("style");
        style.id = "viewora-badge-css";
        style.textContent = `
            .vieworaTick {
                display: inline-flex;
                align-items: center;
                margin-left: 4px;
                color: #1d9bf0;
                font-size: 0.9em;
                vertical-align: middle;
            }
            .vieworaTick.influencer {
                color: #a855f7;
            }
            .vieworaTick i { font-size: inherit; }
        `;
        document.head.appendChild(style);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectBadgeCSS, {
            once: true
        });
    } else {
        injectBadgeCSS();
    }

    global.VieworaStores = {
        MusicStore,
        StickerStore,
        Badges,
        Monetization,
        Subscriptions,
        formatCount,
        escapeHTML
    };

})(typeof window !== "undefined" ? window : globalThis);
