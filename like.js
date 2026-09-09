/*! Viewora like.js — race-safe short likes */
(function (global) {
  "use strict";

  var inFlight = Object.create(null);
  var spamLog = Object.create(null);
  var SPAM_LIMIT = 6;
  var SPAM_WINDOW = 12000;

  function safeNum(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function spamCount(id) {
    var now = Date.now();
    var arr = (spamLog[id] || []).filter(function (t) {
      return now - t < SPAM_WINDOW;
    });
    arr.push(now);
    spamLog[id] = arr;
    return arr.length;
  }

  function warnSpam() {
    var msg =
      "Please do not spam likes. Rapid like / unlike is against Viewora Community Guidelines. Repeated abuse may lead to account suspension.";
    try {
      window.alert(msg);
    } catch (e) {
      console.warn(msg);
    }
  }

  /**
   * @returns {Promise<{liked:boolean,count:number,blocked?:boolean}>}
   */
  async function toggleShortLike(shortId, uid, currentCount) {
    if (!global.db || !shortId || !uid) {
      throw new Error("Missing db/shortId/uid");
    }

    var lock = shortId + ":" + uid;
    if (inFlight[lock]) {
      return { liked: null, count: safeNum(currentCount), blocked: true };
    }

    if (spamCount(shortId) >= SPAM_LIMIT) {
      warnSpam();
      return { liked: null, count: safeNum(currentCount), blocked: true };
    }

    inFlight[lock] = true;
    try {
      var primary = db.ref("shortLikes/" + shortId + "/" + uid);
      var wasLiked = false;

      await primary.transaction(function (cur) {
        if (cur === null) {
          wasLiked = false;
          return { uid: uid, at: Date.now() };
        }
        wasLiked = true;
        return null;
      });

      var after = await primary.once("value");
      var isLiked = after.exists();
      var delta = 0;
      if (isLiked && !wasLiked) delta = 1;
      if (!isLiked && wasLiked) delta = -1;

      var finalCount = safeNum(currentCount);
      if (delta !== 0) {
        var tx = await db.ref("shorts/" + shortId + "/likes").transaction(function (cur) {
          return Math.max(0, safeNum(cur) + delta);
        });
        if (tx.committed && tx.snapshot) {
          finalCount = safeNum(tx.snapshot.val());
        } else {
          finalCount = Math.max(0, finalCount + delta);
        }
        try {
          await db.ref("shorts/" + shortId + "/likeCount").set(finalCount);
        } catch (e) {}
      }

      return { liked: isLiked, count: finalCount };
    } finally {
      delete inFlight[lock];
    }
  }

  async function isShortLiked(shortId, uid) {
    if (!global.db || !shortId || !uid) return false;
    var snap = await db.ref("shortLikes/" + shortId + "/" + uid).once("value");
    return snap.exists();
  }

  global.VieworaLikes = {
    toggleShortLike: toggleShortLike,
    isShortLiked: isShortLiked
  };
})(window);
