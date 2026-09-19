
(function () {
  "use strict";
  let me = null;
  let showSpam = false;
  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const t = $("toast");
    if (!t) return alert(msg);
    t.textContent = msg;
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 2200);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isRequestChat(c) {
    if (!c) return false;
    if (c.isGroup || c.groupId) return false;
    if (showSpam) return c.spam === true || c.requestSpam === true;
    return c.request === true && c.accepted !== true && c.spam !== true;
  }

  async function load() {
    const db = firebase.database();
    const snap = await db.ref("userChats/" + me).once("value");
    const list = [];
    snap.forEach((ch) => {
      const c = ch.val() || {};
      c.chatId = ch.key;
      if (isRequestChat(c)) list.push(c);
    });
    list.sort((a, b) => Number(b.lastMessageTime || b.updatedAt || 0) - Number(a.lastMessageTime || a.updatedAt || 0));

    // hydrate photos
    await Promise.all(
      list.map(async (c) => {
        const uid = c.userId || c.uid || "";
        if (!uid) return;
        try {
          const us = await db.ref("users/" + uid).once("value");
          const u = us.val() || {};
          c.photoURL = c.photoURL || c.profilePhoto || u.profilePhoto || u.photoURL || u.avatar || "assets/default-avatar.png";
          c.name = c.name || u.displayName || u.name || u.username || "User";
          c.username = c.username || u.username || "";
        } catch (_) {}
      })
    );

    const box = $("reqList");
    const empty = $("reqEmpty");
    if (!list.length) {
      if (box) box.innerHTML = "";
      if (empty) {
        empty.classList.remove("hidden");
        empty.querySelector("h2").textContent = showSpam ? "No spam requests" : "No message requests yet";
        empty.querySelector("p").textContent = showSpam
          ? "Declined requests marked as spam appear here."
          : "You can control who can send you message requests in settings.";
      }
      return;
    }
    if (empty) empty.classList.add("hidden");
    box.innerHTML = list
      .map((c) => {
        const uid = c.userId || c.uid || "";
        const name = esc(c.name || "User");
        const preview = esc(c.lastMessage || "Wants to message you");
        const photo = esc(c.photoURL || "assets/default-avatar.png");
        return (
          '<div class="reqCard" data-cid="' +
          esc(c.chatId) +
          '" data-uid="' +
          esc(uid) +
          '">' +
          '<div class="reqCardTop">' +
          '<img src="' +
          photo +
          '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
          '<div class="reqMeta"><strong>' +
          name +
          "</strong><span>" +
          preview +
          "</span></div></div>" +
          (showSpam
            ? '<div class="reqActions"><button type="button" class="btnDecline" data-act="delete">Delete</button></div>'
            : '<div class="reqActions">' +
              '<button type="button" class="btnAccept" data-act="accept">Accept</button>' +
              '<button type="button" class="btnDecline" data-act="decline">Decline</button>' +
              '<button type="button" class="btnBlock" data-act="block">Block</button>' +
              "</div>") +
          "</div>"
        );
      })
      .join("");

    box.querySelectorAll(".reqCard").forEach((card) => {
      card.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const act = btn.getAttribute("data-act");
          const cid = card.getAttribute("data-cid");
          const uid = card.getAttribute("data-uid");
          await handle(act, cid, uid);
        });
      });
      card.addEventListener("click", () => {
        const uid = card.getAttribute("data-uid");
        if (uid && !showSpam) location.href = "chat.html?uid=" + encodeURIComponent(uid);
      });
    });
  }

  async function handle(act, cid, uid) {
    const db = firebase.database();
    try {
      if (act === "accept") {
        await db.ref("userChats/" + me + "/" + cid).update({
          request: false,
          accepted: true,
          acceptedAt: Date.now(),
          spam: false
        });
        toast("Request accepted");
      } else if (act === "decline") {
        await db.ref("userChats/" + me + "/" + cid).update({
          request: false,
          spam: true,
          requestSpam: true,
          declinedAt: Date.now()
        });
        toast("Moved to spam");
      } else if (act === "block") {
        if (uid) {
          await db.ref("blocked/" + me + "/" + uid).set({ at: Date.now(), source: "request" });
        }
        await db.ref("userChats/" + me + "/" + cid).remove();
        toast("User blocked");
      } else if (act === "delete") {
        await db.ref("userChats/" + me + "/" + cid).remove();
        toast("Deleted");
      }
      load();
    } catch (e) {
      console.error(e);
      toast("Action failed");
    }
  }

  async function boot() {
    await new Promise((resolve, reject) => {
      firebase.auth().onAuthStateChanged((u) => {
        if (u) {
          me = u.uid;
          resolve();
        } else reject();
      });
    }).catch(() => {
      location.href = "login.html";
    });
    if (!me) return;

    $("backBtn")?.addEventListener("click", () => {
      location.href = "messages.html";
    });
    $("bannerClose")?.addEventListener("click", () => {
      $("reqBanner")?.classList.add("hidden");
    });
    $("spamFolderBtn")?.addEventListener("click", () => {
      showSpam = !showSpam;
      $("spamFolderBtn").style.opacity = showSpam ? "1" : "";
      document.querySelector(".reqHeader h1").textContent = showSpam
        ? "Spam"
        : "Message requests";
      load();
    });
    $("spamBtn")?.addEventListener("click", () => {
      $("spamFolderBtn")?.click();
    });

    firebase.database().ref("userChats/" + me).on("value", () => load());
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
