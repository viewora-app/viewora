/**
 * Viewora — Instagram-style share sheet (Posts / Shorts / Long videos)
 * Usage: VieworaShare.open({ type: "post"|"short"|"video", id, url, title })
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getDB() {
    try {
      return window.db || window.firebaseDB || (firebase && firebase.database && firebase.database());
    } catch (_) {
      return null;
    }
  }

  function getUid() {
    try {
      if (typeof getCurrentUID === "function") return getCurrentUID();
      if (typeof getMyUID === "function") return getMyUID();
      if (firebase && firebase.auth && firebase.auth().currentUser)
        return firebase.auth().currentUser.uid;
    } catch (_) {}
    return null;
  }

  function toast(msg) {
    if (typeof showToast === "function") showToast(msg);
    else try { console.log(msg); } catch (_) {}
  }

  function injectCSS() {
    if (document.getElementById("vieworaShareCSS")) return;
    var style = document.createElement("style");
    style.id = "vieworaShareCSS";
    style.textContent = [
      "body.shareSheetOpen{overflow:hidden!important}",
      ".vieworaShareSheet{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s ease}",
      ".vieworaShareSheet.open{opacity:1;pointer-events:auto}",
      ".vieworaShareSheet.closing{opacity:0}",
      ".vssBackdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}",
      ".vssPanel{position:relative;z-index:2;width:100%;max-width:480px;max-height:78vh;background:#1a1b22;border-radius:22px 22px 0 0;padding:8px 0 calc(18px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .32s cubic-bezier(.22,1,.36,1);overflow:hidden;display:flex;flex-direction:column}",
      ".vieworaShareSheet.open .vssPanel{transform:translateY(0)}",
      ".vssHandle{width:40px;height:4px;border-radius:99px;background:rgba(255,255,255,.25);margin:6px auto 10px}",
      ".vssNote{text-align:center;font-size:12px;color:rgba(255,255,255,.45);padding:0 20px 10px;line-height:1.4}",
      ".vssSearchRow{display:flex;align-items:center;gap:10px;margin:0 16px 12px;padding:0 14px;height:42px;border-radius:14px;background:rgba(255,255,255,.08)}",
      ".vssSearchRow i{color:rgba(255,255,255,.4);font-size:14px}",
      ".vssSearchRow input{flex:1;border:0;background:transparent;color:#fff;font-size:14px;outline:none}",
      ".vssFriends{display:flex;flex-wrap:wrap;gap:14px 10px;padding:8px 16px 16px;max-height:42vh;overflow-y:auto}",
      ".vssFriend{width:calc(25% - 8px);max-width:80px;display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:transparent;color:#fff;padding:4px;cursor:pointer;animation:vssPop .4s cubic-bezier(.22,1,.36,1) both}",
      "@keyframes vssPop{from{opacity:0;transform:scale(.6) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}",
      ".vssAvatarWrap{position:relative;width:64px;height:64px}",
      ".vssFriend img{width:64px;height:64px;border-radius:50%;object-fit:cover;background:#2a2a35;border:2px solid transparent}",
      ".vssFriend.vssBest img{border-color:#7c5cff;box-shadow:0 0 0 2px rgba(124,92,255,.35),0 8px 20px rgba(124,92,255,.25);animation:vssBestPulse 2s ease-in-out infinite}",
      "@keyframes vssBestPulse{0%,100%{box-shadow:0 0 0 2px rgba(124,92,255,.35),0 8px 20px rgba(124,92,255,.2)}50%{box-shadow:0 0 0 4px rgba(124,92,255,.2),0 8px 28px rgba(124,92,255,.4)}}",
      ".vssRank{position:absolute;top:-4px;left:-4px;z-index:2;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:linear-gradient(135deg,#7c5cff,#ec4899);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center}",
      ".vssOnline{position:absolute;bottom:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid #1a1b22}",
      ".vssName{font-size:11px;font-weight:600;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}",
      ".vssFriend.sent{opacity:.55;pointer-events:none}",
      ".vssFriend.sent .vssAvatarWrap::after{content:'\\2713';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(34,197,94,.75);border-radius:50%;color:#fff;font-weight:800;font-size:22px}",
      ".vssEmpty,.vssLoading{width:100%;text-align:center;padding:24px 12px;color:rgba(255,255,255,.45);font-size:13px;line-height:1.5}",
      ".vssActions{display:flex;gap:8px;padding:8px 12px 0;overflow-x:auto;border-top:1px solid rgba(255,255,255,.06);margin-top:4px}",
      ".vssAct{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:64px;border:0;background:transparent;color:#fff;font-size:11px;font-weight:600;padding:8px 4px}",
      ".vssActIcon{width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:20px}",
      ".vssActIcon.wa{background:#25d366;color:#fff}"
    ].join("");
    document.head.appendChild(style);
  }

  function close() {
    var el = document.getElementById("vieworaShareSheet");
    if (el) {
      el.classList.add("closing");
      setTimeout(function () {
        try { el.remove(); } catch (_) {}
      }, 280);
    }
    document.body.classList.remove("shareSheetOpen");
  }

  async function loadFriends(myUid) {
    var db = getDB();
    var friends = [];
    if (!myUid || !db) return friends;

    var following = {};
    try {
      var fs = await db.ref("following/" + myUid).once("value");
      following = fs.val() || {};
    } catch (_) {
      try {
        var fs2 = await db.ref("users/" + myUid + "/following").once("value");
        following = fs2.val() || {};
      } catch (__) {}
    }

    // Map uid -> score from chats (people you already talked to)
    var chatScore = {};
    var chatMeta = {}; // uid -> { name, photo from inbox }
    try {
      var cs = await db.ref("userChats/" + myUid).once("value");
      if (cs.exists()) {
        cs.forEach(function (child) {
          var v = child.val() || {};
          // skip pure group entries without a peer uid
          if (v.isGroup || v.groupId) return;
          var other =
            v.uid ||
            v.userId ||
            v.peerId ||
            v.with ||
            v.otherUid ||
            null;
          // chat key might be uid1_uid2
          if (!other && child.key && String(child.key).indexOf("_") !== -1) {
            var parts = String(child.key).split("_");
            other = parts[0] === myUid ? parts[1] : parts[0];
          }
          if (!other || other === myUid) return;
          var updated = Number(
            v.updatedAt || v.lastMessageAt || v.lastMessageTime || v.timestamp || 0
          );
          var msgs = Number(v.messageCount || v.messages || 0);
          var score = (chatScore[other] || 0) + msgs * 3 + 50; // base for having a chat
          if (updated && Date.now() - updated < 7 * 864e5) score += 20;
          if (updated && Date.now() - updated < 864e5) score += 40;
          if (updated && Date.now() - updated < 3600e3) score += 30;
          chatScore[other] = score;
          chatMeta[other] = {
            name: v.name || v.username || v.displayName || "",
            photo: v.photoURL || v.profilePhoto || v.avatar || ""
          };
        });
      }
    } catch (_) {}

    // Merge: following + everyone you've chatted with
    var idSet = {};
    Object.keys(following).forEach(function (k) {
      var v = following[k];
      if (v === true || v === 1 || (v && typeof v === "object")) idSet[k] = true;
    });
    Object.keys(chatScore).forEach(function (k) {
      idSet[k] = true;
    });

    var ranked = Object.keys(idSet).map(function (uid) {
      return {
        uid: uid,
        score: chatScore[uid] || 0,
        chatted: !!chatScore[uid],
        following: !!following[uid]
      };
    });
    ranked.sort(function (a, b) {
      if (a.chatted !== b.chatted) return a.chatted ? -1 : 1;
      return b.score - a.score;
    });

    var top = ranked.slice(0, 40);
    await Promise.all(
      top.map(async function (item, idx) {
        try {
          var us = await db.ref("users/" + item.uid).once("value");
          var u = us.val() || {};
          var meta = chatMeta[item.uid] || {};
          var name =
            u.username ||
            u.userName ||
            u.displayName ||
            u.name ||
            meta.name ||
            "user";
          var photo =
            u.profilePhoto ||
            u.photoURL ||
            u.avatar ||
            u.profilePicture ||
            meta.photo ||
            "";
          friends.push({
            uid: item.uid,
            username: name,
            avatar:
              photo ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(String(name).slice(0, 2)) +
                "&background=3b82f6&color=fff&size=128",
            score: item.score,
            chatted: item.chatted,
            rank: idx + 1
          });
        } catch (_) {
          // still show from chat meta if users node missing
          var meta2 = chatMeta[item.uid];
          if (meta2 && meta2.name) {
            friends.push({
              uid: item.uid,
              username: meta2.name,
              avatar:
                meta2.photo ||
                "https://ui-avatars.com/api/?name=U&background=6366f1&color=fff&size=128",
              score: item.score,
              chatted: true,
              rank: idx + 1
            });
          }
        }
      })
    );
    friends.sort(function (a, b) {
      if (a.chatted !== b.chatted) return a.chatted ? -1 : 1;
      return b.score - a.score;
    });
    // re-rank 1..n after sort
    friends.forEach(function (f, i) {
      f.rank = i + 1;
    });
    return friends;
  }

  async function open(opts) {
    opts = opts || {};
    injectCSS();
    var type = opts.type || "post";
    var id = opts.id || "";
    var title = opts.title || "Viewora";
    var presetThumb = opts.thumb || opts.thumbnail || opts.imageUrl || "";
    var shareURL =
      opts.url ||
      location.origin +
        location.pathname +
        "?" +
        type +
        "=" +
        encodeURIComponent(id);
    var myUid = getUid();
    var db = getDB();
    close();

    var sheet = document.createElement("div");
    sheet.id = "vieworaShareSheet";
    sheet.className = "vieworaShareSheet";
    sheet.innerHTML =
      '<div class="vssBackdrop" data-vss-close="1"></div>' +
      '<div class="vssPanel">' +
      '<div class="vssHandle"></div>' +
      '<p class="vssNote">Share with people you chat with or follow. Best friends first.</p>' +
      '<div class="vssSearchRow"><i class="fa-solid fa-magnifying-glass"></i>' +
      '<input type="search" id="vssSearch" placeholder="Search" autocomplete="off"></div>' +
      '<div class="vssFriends" id="vssFriends"><div class="vssLoading">Loading friends…</div></div>' +
      '<div class="vssActions">' +
      '<button type="button" class="vssAct" data-vss="story"><span class="vssActIcon"><i class="fa-regular fa-circle"></i></span><span>Add to story</span></button>' +
      '<button type="button" class="vssAct" data-vss="whatsapp"><span class="vssActIcon wa"><i class="fa-brands fa-whatsapp"></i></span><span>WhatsApp</span></button>' +
      '<button type="button" class="vssAct" data-vss="copy"><span class="vssActIcon"><i class="fa-solid fa-link"></i></span><span>Copy link</span></button>' +
      '<button type="button" class="vssAct" data-vss="system"><span class="vssActIcon"><i class="fa-solid fa-share-nodes"></i></span><span>Share</span></button>' +
      "</div></div>";
    document.body.appendChild(sheet);
    document.body.classList.add("shareSheetOpen");
    requestAnimationFrame(function () {
      sheet.classList.add("open");
    });
    sheet.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute("data-vss-close")) close();
    });

    var friendsEl = sheet.querySelector("#vssFriends");
    var allFriends = [];

    function renderFriends(list) {
      if (!friendsEl) return;
      if (!list.length) {
        friendsEl.innerHTML =
          '<div class="vssEmpty">No friends to share with yet.<br>Follow people and chat to see them here.</div>';
        return;
      }
      friendsEl.innerHTML = list
        .map(function (f, i) {
          var isBest = f.rank <= 4 && f.chatted;
          var rankBadge = isBest ? '<span class="vssRank">#' + f.rank + "</span>" : "";
          var online = isBest ? '<span class="vssOnline"></span>' : "";
          return (
            '<button type="button" class="vssFriend' +
            (isBest ? " vssBest" : "") +
            '" data-uid="' +
            esc(f.uid) +
            '" style="animation-delay:' +
            i * 0.04 +
            's"><span class="vssAvatarWrap">' +
            rankBadge +
            '<img src="' +
            esc(f.avatar) +
            '" alt="" onerror="this.src=\'https://ui-avatars.com/api/?name=U&background=6366f1&color=fff&size=96\'">' +
            online +
            '</span><span class="vssName">' +
            esc(f.username) +
            "</span></button>"
          );
        })
        .join("");

      friendsEl.querySelectorAll(".vssFriend").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          var uid = btn.getAttribute("data-uid");
          if (!uid || !myUid || !db) return;
          btn.classList.add("sent");
          try {
            var chatId = [myUid, uid].sort().join("_");
            var label =
              type === "short"
                ? "Shared a short"
                : type === "video"
                ? "Shared a video"
                : type === "story"
                ? "Shared a story"
                : type === "profile"
                ? "Shared a profile"
                : "Shared a post";
            var msgType =
              type === "short"
                ? "short_share"
                : type === "video"
                ? "video_share"
                : type === "story"
                ? "story_share"
                : type === "profile"
                ? "profile_share"
                : "post_share";

            // Enrich with thumb/title so chat bubble looks good
            function pickThumb(d) {
              if (!d) return "";
              var t =
                d.thumbnail ||
                d.thumbnailUrl ||
                d.thumbnailURL ||
                d.thumb ||
                d.cover ||
                d.coverUrl ||
                d.poster ||
                d.posterUrl ||
                d.imageUrl ||
                d.previewImage ||
                "";
              if (!t && Array.isArray(d.mediaUrls) && d.mediaUrls.length) {
                var m0 = d.mediaUrls[0];
                t = typeof m0 === "string" ? m0 : (m0 && (m0.url || m0.thumb)) || "";
              }
              if (!t) t = d.mediaUrl || d.mediaURL || d.postImage || "";
              // Cloudinary video → frame jpg
              var vid = d.videoUrl || d.videoURL || d.url || "";
              if ((!t || /\.mp4|\.webm|\.mov/i.test(t)) && vid) {
                if (/res\.cloudinary\.com/i.test(vid) && /\/video\/upload\//i.test(vid)) {
                  t = vid
                    .replace("/video/upload/", "/video/upload/so_0,w_480,h_840,c_fill,q_auto,f_jpg/")
                    .replace(/\.mp4($|\?)/i, ".jpg$1")
                    .replace(/\.webm($|\?)/i, ".jpg$1");
                } else if (!t) {
                  t = vid; // last resort; chat may show play icon
                }
              }
              return t || "";
            }
            var thumb = presetThumb || "";
            var shareTitle = title || label;
            var authorName = "";
            try {
              if (type === "profile") {
                var us = await db.ref("users/" + id).once("value");
                if (us.exists()) {
                  var ud = us.val() || {};
                  if (!thumb)
                    thumb =
                      ud.profilePhoto ||
                      ud.photoURL ||
                      ud.avatar ||
                      "";
                  shareTitle =
                    ud.name ||
                    ud.displayName ||
                    ud.username ||
                    shareTitle;
                  authorName = ud.username || "";
                }
              } else {
                var roots =
                  type === "short"
                    ? ["shorts", "videos"]
                    : type === "video"
                    ? ["videos", "longVideos", "posts"]
                    : type === "story"
                    ? ["stories"]
                    : ["posts"];
                for (var ri = 0; ri < roots.length; ri++) {
                  var snap = await db.ref(roots[ri] + "/" + id).once("value");
                  if (snap.exists()) {
                    var d = snap.val() || {};
                    if (!thumb) thumb = pickThumb(d);
                    shareTitle =
                      d.caption || d.title || d.text || shareTitle;
                    authorName =
                      d.username ||
                      d.userName ||
                      d.authorName ||
                      authorName;
                    break;
                  }
                }
              }
            } catch (_) {}
            // still empty for short — try opts already set
            if (!thumb && presetThumb) thumb = presetThumb;

            var msgRef = db.ref("vieworaChats/" + chatId + "/messages").push();
            var payload = {
              id: msgRef.key,
              type: msgType,
              contentId: id,
              postId: type === "post" ? id : null,
              shortId: type === "short" ? id : null,
              videoId: type === "video" ? id : null,
              storyId: type === "story" ? id : null,
              profileUid: type === "profile" ? id : null,
              text: label,
              caption: shareTitle || "",
              title: shareTitle || "",
              thumb: thumb || "",
              thumbnail: thumb || "",
              authorName: authorName || "",
              username: authorName || "",
              shareUrl: shareURL,
              senderId: myUid,
              createdAt: Date.now(),
              timestamp: Date.now()
            };
            await msgRef.set(payload);

            // Mirror to legacy chats/ path (if any old listeners)
            try {
              await db.ref("chats/" + chatId + "/messages/" + msgRef.key).set(payload);
            } catch (_) {}

            // Touch chat room meta so list updates
            try {
              await db.ref("vieworaChats/" + chatId).update({
                updatedAt: Date.now(),
                lastMessage: label,
                lastMessageAt: Date.now(),
                lastMessageType: msgType
              });
            } catch (_) {}

            // My profile for their inbox
            var myName = "Viewora User";
            var myPhoto = "";
            var myUsername = "";
            try {
              var meSnap = await db.ref("users/" + myUid).once("value");
              if (meSnap.exists()) {
                var me = meSnap.val() || {};
                myName =
                  me.name ||
                  me.displayName ||
                  me.username ||
                  myName;
                myUsername = me.username || "";
                myPhoto =
                  me.profilePhoto || me.photoURL || me.avatar || "";
              }
            } catch (_) {}

            // Their profile for my inbox
            var otherName = "Viewora User";
            var otherPhoto = "";
            var otherUsername = "";
            try {
              var oSnap = await db.ref("users/" + uid).once("value");
              if (oSnap.exists()) {
                var ou = oSnap.val() || {};
                otherName =
                  ou.name ||
                  ou.displayName ||
                  ou.username ||
                  otherName;
                otherUsername = ou.username || "";
                otherPhoto =
                  ou.profilePhoto || ou.photoURL || ou.avatar || "";
              }
            } catch (_) {}

            var now = Date.now();
            // My inbox row
            await db.ref("userChats/" + myUid + "/" + chatId).update({
              chatId: chatId,
              uid: uid,
              userId: uid,
              name: otherName,
              username: otherUsername,
              photoURL: otherPhoto,
              profilePhoto: otherPhoto,
              lastMessage: label,
              lastMessageTime: now,
              lastMessageAt: now,
              updatedAt: now,
              unread: 0
            });
            // Their inbox row — this makes share appear in their Messages list
            await db.ref("userChats/" + uid + "/" + chatId).update({
              chatId: chatId,
              uid: myUid,
              userId: myUid,
              name: myName,
              username: myUsername,
              photoURL: myPhoto,
              profilePhoto: myPhoto,
              lastMessage: label,
              lastMessageTime: now,
              lastMessageAt: now,
              updatedAt: now,
              unread: 1
            });

            toast("Sent to " + otherName + "!");
            setTimeout(close, 450);
          } catch (err) {
            console.error("[VIEWORA] share send", err);
            toast("Could not send — try again");
            btn.classList.remove("sent");
          }
        });
      });
    }

    try {
      allFriends = await loadFriends(myUid);
      renderFriends(allFriends);
    } catch (e) {
      if (friendsEl)
        friendsEl.innerHTML = '<div class="vssEmpty">Could not load friends.</div>';
    }

    var search = sheet.querySelector("#vssSearch");
    if (search) {
      search.addEventListener("input", function () {
        var q = (search.value || "").trim().toLowerCase();
        renderFriends(
          !q
            ? allFriends
            : allFriends.filter(function (f) {
                return String(f.username || "")
                  .toLowerCase()
                  .indexOf(q) !== -1;
              })
        );
      });
    }

    sheet.querySelectorAll("[data-vss]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var act = btn.getAttribute("data-vss");
        if (act === "copy") {
          try {
            await navigator.clipboard.writeText(shareURL);
            toast("Link copied");
          } catch (_) {
            toast(shareURL);
          }
        } else if (act === "whatsapp") {
          window.open(
            "https://wa.me/?text=" + encodeURIComponent(shareURL),
            "_blank"
          );
        } else if (act === "system") {
          try {
            if (navigator.share)
              await navigator.share({ title: title, url: shareURL });
            else {
              await navigator.clipboard.writeText(shareURL);
              toast("Link copied");
            }
          } catch (_) {}
        } else if (act === "story") {
          location.href =
            "story-upload.html?share=" +
            encodeURIComponent(type) +
            "&id=" +
            encodeURIComponent(id);
        }
      });
    });
  }

  window.VieworaShare = { open: open, close: close };
})();
