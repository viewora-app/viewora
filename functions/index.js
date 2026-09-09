/**
 * VIEWORA — Firebase Cloud Functions
 *
 * Features:
 *  - Razorpay subscription order + verify
 *  - Permanent account deletion (Admin SDK)
 *  - Cleanup orphaned content on delete
 *  - Like spam soft rate-limit helper (callable)
 *
 * SETUP:
 *   cd functions && npm install
 *   firebase functions:config:set razorpay.key_id="..." razorpay.key_secret="..."
 *   firebase deploy --only functions,database
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const cors = require("cors")({ origin: true });
const crypto = require("crypto");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();

function getKeys() {
  const cfg = functions.config().razorpay || {};
  return {
    key_id: process.env.RAZORPAY_KEY_ID || cfg.key_id || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || cfg.key_secret || ""
  };
}

function getRazorpay() {
  const { key_id, key_secret } = getKeys();
  if (!key_id || !key_secret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Razorpay keys not configured on server."
    );
  }
  return new Razorpay({ key_id, key_secret });
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.ref("admins/" + uid).once("value");
  return snap.val() === true;
}

/* =========================================================
   RAZORPAY
========================================================= */

exports.createSubscriptionOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  const amount = Number(data.amount || 0);
  if (!amount || amount < 100) {
    throw new functions.https.HttpsError("invalid-argument", "Amount must be at least 100 paise.");
  }
  const plan = String(data.plan || "plus");
  const billingCycle = String(data.billingCycle || "monthly");
  const rzp = getRazorpay();
  const order = await rzp.orders.create({
    amount: Math.round(amount),
    currency: "INR",
    receipt: `viewora_${context.auth.uid}_${Date.now()}`.slice(0, 40),
    notes: { uid: context.auth.uid, plan, billingCycle }
  });
  return {
    order_id: order.id,
    amount: order.amount,
    currency: order.currency || "INR"
  };
});

exports.verifySubscriptionPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  const orderId = data.razorpay_order_id;
  const paymentId = data.razorpay_payment_id;
  const signature = data.razorpay_signature;
  if (!orderId || !paymentId || !signature) {
    throw new functions.https.HttpsError("invalid-argument", "Missing payment fields.");
  }
  const { key_secret } = getKeys();
  const body = orderId + "|" + paymentId;
  const expected = crypto.createHmac("sha256", key_secret).update(body).digest("hex");
  if (expected !== signature) {
    throw new functions.https.HttpsError("permission-denied", "Invalid payment signature.");
  }

  const plan = String(data.plan || "plus");
  const billingCycle = String(data.billingCycle || "monthly");
  const days = billingCycle === "yearly" ? 365 : 30;
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  const uid = context.auth.uid;

  const sub = {
    active: true,
    status: "active",
    plan,
    billingCycle,
    expiresAt,
    paymentId,
    orderId,
    updatedAt: admin.database.ServerValue.TIMESTAMP
  };

  const userPatch = {
    subscriptionActive: true,
    subscriptionStatus: "active",
    plan,
    subscriptionExpiresAt: expiresAt
  };

  // Elite / yearly → red tick; paid → blue path via badges client
  if (String(plan).toLowerCase().includes("elite") || billingCycle === "yearly") {
    userPatch.redTick = true;
    userPatch.vip = true;
  } else {
    userPatch.blueTick = true;
  }

  await db.ref("subscription/" + uid).update(sub);
  await db.ref("users/" + uid).update(userPatch);

  return { ok: true, expiresAt, plan, billingCycle };
});

/* =========================================================
   PERMANENT ACCOUNT DELETE (Admin SDK)
========================================================= */

async function purgeUserData(uid) {
  const paths = [
    `users/${uid}`,
    `followers/${uid}`,
    `following/${uid}`,
    `followRequests/${uid}`,
    `blocks/${uid}`,
    `notifications/${uid}`,
    `activity/${uid}`,
    `userChats/${uid}`,
    `presence/${uid}`,
    `calls/${uid}`,
    `incomingCalls/${uid}`,
    `monetization/${uid}`,
    `subscription/${uid}`,
    `devices/${uid}`,
    `rateLimits/${uid}`
  ];

  const updates = {};
  paths.forEach((p) => {
    updates[p] = null;
  });

  // Content owned by user (scan limited recent nodes)
  const contentRoots = ["posts", "videos", "shorts", "stories"];
  for (const root of contentRoots) {
    try {
      const snap = await db.ref(root).orderByChild("uid").equalTo(uid).once("value");
      if (snap.exists()) {
        snap.forEach((c) => {
          updates[`${root}/${c.key}`] = null;
        });
      }
    } catch (e) {
      console.warn("purge scan", root, e.message);
    }
    // also userId field
    try {
      const snap2 = await db.ref(root).orderByChild("userId").equalTo(uid).once("value");
      if (snap2.exists()) {
        snap2.forEach((c) => {
          updates[`${root}/${c.key}`] = null;
        });
      }
    } catch (_) {}
  }

  // Tombstone
  updates[`deletedUsers/${uid}`] = {
    deletedAt: Date.now(),
    by: "cloud-function"
  };

  // Chunk updates (RTDB limit)
  const keys = Object.keys(updates);
  const CHUNK = 400;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const part = {};
    keys.slice(i, i + CHUNK).forEach((k) => {
      part[k] = updates[k];
    });
    await db.ref().update(part);
  }

  // Remove Auth account
  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    console.warn("auth deleteUser:", e.message);
  }

  return { removedKeys: keys.length };
}

/** User requests delete — stored for admin; or self-serve if confirmed */
exports.requestAccountDeletion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  const uid = context.auth.uid;
  const reason = String(data.reason || "").slice(0, 500);
  const ref = db.ref("deletionRequests").push();
  await ref.set({
    id: ref.key,
    uid,
    reason,
    status: "pending",
    createdAt: admin.database.ServerValue.TIMESTAMP
  });
  return { ok: true, requestId: ref.key };
});

/** Admin approves → permanent purge + Auth delete */
exports.approveAccountDeletion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }
  const uid = String(data.uid || "");
  const requestKey = String(data.requestKey || data.requestId || "");
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "uid required.");
  }
  const result = await purgeUserData(uid);
  if (requestKey) {
    await db.ref("deletionRequests/" + requestKey).remove();
  } else {
    // remove any pending for this uid
    const snap = await db.ref("deletionRequests").orderByChild("uid").equalTo(uid).once("value");
    const up = {};
    snap.forEach((c) => {
      up[c.key] = null;
    });
    if (Object.keys(up).length) await db.ref("deletionRequests").update(up);
  }
  return { ok: true, ...result };
});

/** Optional: user confirms hard delete themselves (dangerous — enable carefully) */
exports.deleteMyAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  const confirm = String(data.confirm || "");
  if (confirm !== "DELETE") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      'Send confirm: "DELETE" to proceed.'
    );
  }
  const uid = context.auth.uid;
  const result = await purgeUserData(uid);
  return { ok: true, ...result };
});

/* =========================================================
   RATE LIMIT (likes spam soft guard — server side)
========================================================= */

exports.checkLikeRate = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  const uid = context.auth.uid;
  const ref = db.ref("rateLimits/" + uid + "/likes");
  const snap = await ref.once("value");
  const now = Date.now();
  const prev = snap.val() || { count: 0, window: now };
  let count = Number(prev.count || 0);
  let window = Number(prev.window || now);
  if (now - window > 12000) {
    count = 0;
    window = now;
  }
  count += 1;
  await ref.set({ count, window });
  if (count > 8) {
    return {
      allowed: false,
      message:
        "Please do not spam likes. Rapid like / unlike is against Viewora Community Guidelines. Repeated abuse may lead to account suspension."
    };
  }
  return { allowed: true, count };
});

/* =========================================================
   STORY EXPIRY CLEANUP (scheduled hourly)
========================================================= */

exports.cleanupExpiredStories = functions.pubsub
  .schedule("every 60 minutes")
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.ref("stories").once("value");
    const updates = {};
    let n = 0;
    snap.forEach((c) => {
      const d = c.val() || {};
      const exp = Number(d.expiresAt || 0);
      const created = Number(d.createdAt || d.timestamp || 0);
      const expired =
        (exp > 0 && exp < now) ||
        (created > 0 && created < now - 24 * 60 * 60 * 1000 && !exp);
      if (expired) {
        updates[c.key] = null;
        n++;
      }
    });
    if (n) {
      const keys = Object.keys(updates);
      for (let i = 0; i < keys.length; i += 300) {
        const part = {};
        keys.slice(i, i + 300).forEach((k) => {
          part[k] = null;
        });
        await db.ref("stories").update(part);
      }
    }
    console.log("Expired stories removed:", n);
    return null;
  });

/* =========================================================
   HEALTH
========================================================= */

exports.ping = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    res.json({ ok: true, service: "viewora-functions", ts: Date.now() });
  });
});
