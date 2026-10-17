/**
 * Viewora — FCM push (app closed / background)
 *
 * Triggers:
 *  1) userChats/{uid}/{chatId} write  → chat message push
 *  2) pendingInbox/{uid}/{id} create → fallback inbox push
 *  3) notifications/{uid}/{id} create → like/follow/comment push
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.database();
const messaging = admin.messaging();

const WEB_BASE = "https://viewora-app.github.io/viewora";

async function getUserTokens(uid) {
  if (!uid) return [];
  const snap = await db.ref("users/" + uid + "/fcmTokens").once("value");
  if (!snap.exists()) return [];
  const tokens = [];
  snap.forEach((child) => {
    const v = child.val() || {};
    if (v.token && typeof v.token === "string") tokens.push(v.token);
  });
  return tokens;
}

async function sendToUser(uid, { title, body, link, tag }) {
  const tokens = await getUserTokens(uid);
  if (!tokens.length) {
    console.log("No FCM tokens for", uid);
    return { successCount: 0, failureCount: 0 };
  }

  const payload = {
    tokens,
    notification: {
      title: String(title || "Viewora").slice(0, 100),
      body: String(body || "").slice(0, 180)
    },
    data: {
      title: String(title || "Viewora").slice(0, 100),
      body: String(body || "").slice(0, 180),
      link: String(link || "index.html"),
      tag: String(tag || "viewora")
    },
    webpush: {
      fcmOptions: {
        link: link && link.indexOf("http") === 0 ? link : WEB_BASE + "/" + String(link || "index.html").replace(/^\.\//, "")
      },
      notification: {
        icon: WEB_BASE + "/icon-192.png",
        badge: WEB_BASE + "/icon-192.png"
      }
    }
  };

  try {
    const res = await messaging.sendEachForMulticast(payload);
    console.log("push →", uid, "ok:", res.successCount, "fail:", res.failureCount);

    // drop invalid tokens
    if (res.failureCount) {
      const stale = [];
      res.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error && r.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            stale.push(tokens[i]);
          }
        }
      });
      if (stale.length) {
        const all = await db.ref("users/" + uid + "/fcmTokens").once("value");
        const updates = {};
        all.forEach((c) => {
          const t = (c.val() || {}).token;
          if (stale.indexOf(t) !== -1) updates[c.key] = null;
        });
        if (Object.keys(updates).length) {
          await db.ref("users/" + uid + "/fcmTokens").update(updates);
        }
      }
    }
    return res;
  } catch (e) {
    console.error("sendToUser", uid, e);
    return null;
  }
}

/** Chat inbox updated for recipient */
exports.pushOnUserChat = functions.database
  .ref("/userChats/{uid}/{chatId}")
  .onWrite(async (change, context) => {
    if (!change.after.exists()) return null;

    const after = change.after.val() || {};
    const before = change.before.exists() ? change.before.val() || {} : {};
    const uid = context.params.uid;
    const chatId = context.params.chatId;

    const lastSender = after.lastSenderId || after.lastSender || "";
    // don't notify self
    if (!lastSender || String(lastSender) === String(uid)) return null;

    // only when message text changed or unread increased
    const msgAfter = after.lastMessage || "";
    const msgBefore = before.lastMessage || "";
    const unreadAfter = Number(after.unread || after.unreadCount || 0);
    const unreadBefore = Number(before.unread || before.unreadCount || 0);

    if (msgAfter === msgBefore && unreadAfter <= unreadBefore) {
      // no meaningful change
      if (change.before.exists()) return null;
    }

    const title = after.name || after.username || "New message";
    const body = msgAfter || "You have a new message";

    return sendToUser(uid, {
      title,
      body,
      link: "chat.html?uid=" + encodeURIComponent(lastSender),
      tag: "chat-" + chatId
    });
  });

/** pendingInbox fallback */
exports.pushOnPendingInbox = functions.database
  .ref("/pendingInbox/{uid}/{id}")
  .onCreate(async (snap, context) => {
    const data = snap.val() || {};
    const uid = context.params.uid;
    const from = data.fromUid || data.peerId || data.userId || "";
    if (from && String(from) === String(uid)) return null;

    const title = data.name || "New message";
    const body = data.lastMessage || "You have a new message";

    return sendToUser(uid, {
      title,
      body,
      link: from ? "chat.html?uid=" + encodeURIComponent(from) : "messages.html",
      tag: "pending-" + context.params.id
    });
  });

/** likes / follows / comments notifications node */
exports.pushOnNotification = functions.database
  .ref("/notifications/{uid}/{id}")
  .onCreate(async (snap, context) => {
    const data = snap.val() || {};
    const uid = context.params.uid;
    const from = data.fromUid || data.uid || "";
    if (from && String(from) === String(uid)) return null;

    const title = data.fromName || "Viewora";
    const body =
      data.message ||
      (data.type === "like"
        ? "liked your post"
        : data.type === "follow"
        ? "started following you"
        : data.type === "comment"
        ? "commented on your post"
        : "New notification");

    const link =
      data.actionUrl ||
      (data.postId ? "post.html?id=" + data.postId : "activity.html");

    return sendToUser(uid, {
      title,
      body,
      link,
      tag: "notif-" + context.params.id
    });
  });
