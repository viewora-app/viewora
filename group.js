
(function () {
  "use strict";

  const ROOM_KIND = document.body.getAttribute("data-room") || "group";
  // Firebase roots
  const ROOTS = {
    group: "groups",
    teamwork: "teams",
    podcast: "podcasts"
  };
  const ROOT = ROOTS[ROOM_KIND] || "groups";

  // Role hierarchy: owner > admin > member
  const ROLE_RANK = { owner: 3, admin: 2, member: 1 };

  let me = null;
  let roomId = "";
  let room = null;
  let myRole = "member";
  let members = {};
  let msgsRef = null;

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

  function getDb() {
    try {
      return window.db || firebase.database();
    } catch (_) {
      return null;
    }
  }

  function can(action) {
    // Strong rules
    const r = myRole || "member";
    const rules = {
      sendMessage: true, // all members
      invite: r === "owner" || r === "admin",
      kickMember: r === "owner" || r === "admin",
      promoteAdmin: r === "owner",
      demoteAdmin: r === "owner",
      editInfo: r === "owner" || r === "admin",
      deleteRoom: r === "owner",
      transferOwner: r === "owner",
      manageTasks: r === "owner" || r === "admin",
      startSession: r === "owner" || r === "admin",
      addEpisode: r === "owner" || r === "admin"
    };
    return !!rules[action];
  }

  function openSheet(html) {
    const sheet = $("sheet");
    const panel = $("sheetPanel");
    if (!sheet || !panel) return;
    panel.innerHTML = html;
    sheet.classList.remove("hidden");
  }
  function closeSheet() {
    $("sheet")?.classList.add("hidden");
  }

  function setTab(tab) {
    document.querySelectorAll(".roomTab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    document.querySelectorAll(".roomPanel").forEach((p) => {
      p.classList.toggle("active", p.id === "tab" + tab.charAt(0).toUpperCase() + tab.slice(1) || p.id === "tab" + tab[0].toUpperCase() + tab.slice(1));
    });
    // map chat/tasks/members/info/episodes
    const map = {
      chat: "tabChat",
      tasks: "tabTasks",
      members: "tabMembers",
      info: "tabInfo",
      episodes: "tabEpisodes"
    };
    document.querySelectorAll(".roomPanel").forEach((p) => p.classList.remove("active"));
    const el = document.getElementById(map[tab] || "tabChat");
    if (el) el.classList.add("active");
  }

  async function loadUser(uid) {
    const db = getDb();
    try {
      const s = await db.ref("users/" + uid).once("value");
      return s.val() || {};
    } catch (_) {
      return {};
    }
  }

  function renderHeader() {
    const name = room?.name || ROOM_KIND;
    const photo = room?.photoURL || room?.photo || "assets/default-avatar.png";
    const count = Object.keys(members || {}).length;
    if ($("roomName")) $("roomName").textContent = name;
    if ($("roomSub")) $("roomSub").textContent = count + " members · " + (myRole || "member");
    if ($("roomAvatar")) $("roomAvatar").src = photo;
    if ($("infoName")) $("infoName").textContent = name;
    if ($("infoDesc")) $("infoDesc").textContent = room?.description || room?.desc || "No description";
    if ($("infoAvatar")) $("infoAvatar").src = photo;
    if ($("myRolePill")) {
      $("myRolePill").textContent = (myRole || "member").toUpperCase();
    }
  }

  function renderMembers() {
    const box = $("membersList");
    if (!box) return;
    const list = Object.keys(members).map((uid) => ({
      uid,
      ...(members[uid] || {})
    }));
    list.sort((a, b) => (ROLE_RANK[b.role] || 0) - (ROLE_RANK[a.role] || 0));
    box.innerHTML = list
      .map((m) => {
        const role = m.role || "member";
        return (
          '<div class="memberRow" data-uid="' +
          esc(m.uid) +
          '">' +
          '<img src="' +
          esc(m.photoURL || m.photo || "assets/default-avatar.png") +
          '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
          '<div class="info"><strong>' +
          esc(m.name || m.username || "User") +
          '</strong><span>@' +
          esc(m.username || "user") +
          "</span></div>" +
          '<span class="badge ' +
          esc(role) +
          '">' +
          esc(role) +
          "</span>" +
          "</div>"
        );
      })
      .join("");

    box.querySelectorAll(".memberRow").forEach((row) => {
      row.addEventListener("click", () => openMemberActions(row.dataset.uid));
    });
  }

  function openMemberActions(uid) {
    if (!uid || uid === me.uid) return;
    const m = members[uid] || {};
    const role = m.role || "member";
    let actions = "";
    if (can("promoteAdmin") && role === "member") {
      actions += '<button type="button" class="row" data-act="promote">Make admin</button>';
    }
    if (can("demoteAdmin") && role === "admin") {
      actions += '<button type="button" class="row" data-act="demote">Remove admin</button>';
    }
    if (can("transferOwner") && role !== "owner") {
      actions += '<button type="button" class="row" data-act="transfer">Transfer ownership</button>';
    }
    if (can("kickMember") && role !== "owner" && ROLE_RANK[myRole] > ROLE_RANK[role]) {
      actions += '<button type="button" class="row danger" data-act="kick">Remove from room</button>';
    }
    if (!actions) {
      toast("No actions available");
      return;
    }
    openSheet(
      "<h3>" +
        esc(m.name || "Member") +
        "</h3>" +
        actions +
        '<button type="button" class="row" data-act="close">Cancel</button>'
    );
    $("sheetPanel").querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const act = btn.dataset.act;
        closeSheet();
        if (act === "close") return;
        await memberAction(uid, act);
      });
    });
  }

  async function memberAction(uid, act) {
    const db = getDb();
    if (!can(
      act === "promote" || act === "demote"
        ? "promoteAdmin"
        : act === "transfer"
        ? "transferOwner"
        : "kickMember"
    )) {
      toast("Not allowed");
      return;
    }
    try {
      if (act === "promote") {
        await db.ref(ROOT + "/" + roomId + "/members/" + uid + "/role").set("admin");
        toast("Promoted to admin");
      } else if (act === "demote") {
        await db.ref(ROOT + "/" + roomId + "/members/" + uid + "/role").set("member");
        toast("Admin removed");
      } else if (act === "kick") {
        await db.ref(ROOT + "/" + roomId + "/members/" + uid).remove();
        toast("Member removed");
      } else if (act === "transfer") {
        await db.ref(ROOT + "/" + roomId + "/members/" + me.uid + "/role").set("admin");
        await db.ref(ROOT + "/" + roomId + "/members/" + uid + "/role").set("owner");
        await db.ref(ROOT + "/" + roomId + "/ownerId").set(uid);
        toast("Ownership transferred");
      }
    } catch (e) {
      console.error(e);
      toast("Action failed");
    }
  }

  function renderSettings() {
    const box = $("settingsList");
    if (!box) return;
    let html = "";
    if (can("editInfo")) {
      html += '<button type="button" class="setBtn" data-set="edit">Edit name & description</button>';
    }
    if (can("invite")) {
      html += '<button type="button" class="setBtn" data-set="invite">Invite people</button>';
    }
    html += '<button type="button" class="setBtn" data-set="leave">Leave room</button>';
    if (can("deleteRoom")) {
      html += '<button type="button" class="setBtn danger" data-set="delete">Delete room</button>';
    }
    box.innerHTML = html;
    box.querySelectorAll("[data-set]").forEach((btn) => {
      btn.addEventListener("click", () => handleSetting(btn.dataset.set));
    });
  }


  async function resolveUsernameToUid(q) {
    if (!q) return null;
    var uname = String(q).replace(/^@/, "").toLowerCase().trim();
    var db = getDb();
    try {
      var s = await db.ref("usernames/" + uname).once("value");
      if (s.exists()) {
        var v = s.val();
        return typeof v === "string" ? v : v.uid || null;
      }
    } catch (_) {}
    try {
      var fol = await db.ref("following/" + me.uid).once("value");
      var ids = Object.keys(fol.val() || {});
      for (var i = 0; i < ids.length; i++) {
        var us = await db.ref("users/" + ids[i]).once("value");
        var u = us.val() || {};
        if (String(u.username || "").toLowerCase() === uname) return ids[i];
      }
    } catch (_) {}
    try {
      var scan = await db.ref("users").limitToFirst(100).once("value");
      var found = null;
      scan.forEach(function (c) {
        var u = c.val() || {};
        if (String(u.username || "").toLowerCase() === uname) found = c.key;
      });
      if (found) return found;
    } catch (_) {}
    return null;
  }

  async function searchUsersForInvite(q) {
    var box = $("formSearchResults");
    if (!box) return;
    var raw = String(q || "").replace(/^@/, "").trim();
    if (raw.length < 1) {
      box.innerHTML = '<p class="muted" style="padding:8px">Type a name or @username</p>';
      return;
    }
    box.innerHTML = '<p class="muted" style="padding:8px">Searching…</p>';
    var db = getDb();
    var needle = raw.toLowerCase();
    var map = {};
    function addHit(uid, u) {
      if (!uid || !me || uid === me.uid || (members && members[uid])) return;
      u = u || {};
      map[uid] = {
        uid: uid,
        name: u.displayName || u.name || u.username || "User",
        username: u.username || "",
        photo: u.profilePhoto || u.photoURL || u.avatar || u.photo || ""
      };
    }
    try {
      var fol = await db.ref("following/" + me.uid).once("value");
      var ids = Object.keys(fol.val() || {}).slice(0, 80);
      for (var i = 0; i < ids.length; i++) {
        var us = await db.ref("users/" + ids[i]).once("value");
        var u = us.val() || {};
        var blob = ((u.username || "") + " " + (u.displayName || "") + " " + (u.name || "")).toLowerCase();
        if (blob.indexOf(needle) !== -1) addHit(ids[i], u);
      }
    } catch (e) { console.warn(e); }
    try {
      var s = await db.ref("usernames/" + needle).once("value");
      if (s.exists()) {
        var v = s.val();
        var uid = typeof v === "string" ? v : v.uid;
        if (uid) {
          var us2 = await db.ref("users/" + uid).once("value");
          addHit(uid, us2.val() || {});
        }
      }
    } catch (_) {}
    if (Object.keys(map).length < 2) {
      try {
        var s2 = await db.ref("users").limitToFirst(80).once("value");
        s2.forEach(function (c) {
          var u = c.val() || {};
          var blob = ((u.username || "") + " " + (u.displayName || "") + " " + (u.name || "")).toLowerCase();
          if (blob.indexOf(needle) !== -1) addHit(c.key, u);
        });
      } catch (e) { console.warn(e); }
    }
    var results = Object.keys(map).map(function (k) { return map[k]; });
    if (!results.length) {
      box.innerHTML = '<p class="muted" style="padding:8px">No users found</p>';
      return;
    }
    box.innerHTML = results.map(function (u) {
      return '<button type="button" class="inviteUserRow" data-uid="' + esc(u.uid) + '">' +
        '<img src="' + esc(u.photo || "assets/default-avatar.png") + '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
        "<div><strong>" + esc(u.name) + "</strong><span>@" + esc(u.username || "user") + "</span></div></button>";
    }).join("");
    box.querySelectorAll(".inviteUserRow").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        await addMemberToRoom(btn.dataset.uid);
        closeSheet();
      });
    });
  }

  async function addMemberToRoom(uid) {
    if (!uid || !me) return;
    if (members[uid]) { toast("Already a member"); return; }
    var db = getDb();
    var u = await loadUser(uid);
    var member = {
      role: "member",
      name: u.displayName || u.name || u.username || "User",
      username: u.username || "",
      photoURL: u.profilePhoto || u.photoURL || u.avatar || "",
      joinedAt: Date.now()
    };
    await db.ref(ROOT + "/" + roomId + "/members/" + uid).set(member);
    try {
      await db.ref("userChats/" + uid + "/" + roomId).set({
        chatId: roomId,
        groupId: roomId,
        isGroup: true,
        chatType: (room && room.type) || ROOM_KIND,
        name: (room && room.name) || "Group",
        photo: (room && (room.photoURL || room.photo)) || "",
        photoURL: (room && (room.photoURL || room.photo)) || "",
        updatedAt: Date.now(),
        lastMessage: "Added to group",
        lastMessageAt: Date.now(),
        unread: 1
      });
    } catch (_) {}
    toast("Member added");
  }

  function openFormSheet(opts) {
    const title = opts.title || "";
    const fields = opts.fields || [];
    const submitLabel = opts.submit || "Save";
    let html =
      '<div class="formSheet"><h3>' +
      esc(title) +
      "</h3>";
    fields.forEach(function (f) {
      html +=
        '<label class="formLabel">' +
        esc(f.label) +
        "</label>";
      if (f.type === "textarea") {
        html +=
          '<textarea class="formInput" id="' +
          esc(f.id) +
          '" rows="3" placeholder="' +
          esc(f.placeholder || "") +
          '">' +
          esc(f.value || "") +
          "</textarea>";
      } else {
        html +=
          '<input class="formInput" id="' +
          esc(f.id) +
          '" type="text" value="' +
          esc(f.value || "") +
          '" placeholder="' +
          esc(f.placeholder || "") +
          '" autocomplete="off">';
      }
    });
    html +=
      '<div id="formSearchResults" class="formSearchResults"></div>';
    html +=
      '<button type="button" class="formSubmit" id="formSubmitBtn">' +
      esc(submitLabel) +
      "</button>";
    html +=
      '<button type="button" class="formCancel" id="formCancelBtn">Cancel</button></div>';
    openSheet(html);
    $("formCancelBtn")?.addEventListener("click", closeSheet);
    if (opts.onReady) opts.onReady();
    $("formSubmitBtn")?.addEventListener("click", async function () {
      if (opts.onSubmit) await opts.onSubmit();
    });
  }

  async function handleSetting(set) {
    const db = getDb();
    if (set === "edit" && can("editInfo")) {
      openFormSheet({
        title: "Edit group",
        submit: "Save",
        fields: [
          {
            id: "editName",
            label: "Group name",
            value: room?.name || "",
            placeholder: "Name"
          },
          {
            id: "editDesc",
            label: "Description",
            type: "textarea",
            value: room?.description || room?.desc || "",
            placeholder: "About this group"
          }
        ],
        onSubmit: async function () {
          const name = ($("editName") && $("editName").value.trim()) || "";
          const desc = ($("editDesc") && $("editDesc").value.trim()) || "";
          if (name.length < 2) return toast("Name too short");
          await db.ref(ROOT + "/" + roomId).update({
            name: name.slice(0, 60),
            description: desc.slice(0, 300)
          });
          closeSheet();
          toast("Updated");
          renderHeader();
          if (typeof renderGroupProfile === "function") renderGroupProfile();
        }
      });
    } else if (set === "invite" && can("invite")) {
      openFormSheet({
        title: "Add people",
        submit: "Invite",
        fields: [
          {
            id: "inviteQuery",
            label: "Search username",
            value: "",
            placeholder: "@username"
          }
        ],
        onReady: function () {
          const input = $("inviteQuery");
          let timer = null;
          input?.addEventListener("input", function () {
            clearTimeout(timer);
            timer = setTimeout(function () {
              searchUsersForInvite(input.value.trim());
            }, 280);
          });
        },
        onSubmit: async function () {
          const q = ($("inviteQuery") && $("inviteQuery").value.trim()) || "";
          if (!q) return toast("Enter a username");
          const uid = await resolveUsernameToUid(q);
          if (!uid) return toast("User not found");
          await addMemberToRoom(uid);
          closeSheet();
        }
      });
    } else if (set === "leave") {
      if (!confirm("Leave this room?")) return;
      if (myRole === "owner") {
        toast("Transfer ownership before leaving");
        return;
      }
      await db.ref(ROOT + "/" + roomId + "/members/" + me.uid).remove();
      location.href = "messages.html";
    } else if (set === "delete" && can("deleteRoom")) {
      if (!confirm("Delete this room permanently?")) return;
      await db.ref(ROOT + "/" + roomId).remove();
      location.href = "messages.html";
    }
  }

  function appendMsg(id, m) {
    const box = $("messagesBox");
    if (!box || !m) return;
    if (box.querySelector('[data-id="' + id + '"]')) return;
    const el = document.createElement("div");
    el.className = "msg" + (m.senderId === me.uid ? " me" : "");
    el.dataset.id = id;
    let body = esc(m.text || "");
    if (m.type === "image" && m.image) {
      body = '<img class="msgImg" src="' + esc(m.image) + '" alt="photo">';
    } else if (m.type === "sticker") {
      body = '<span class="msgSticker">' + esc(m.sticker || m.text || "") + "</span>";
    } else if (m.type === "voice" && m.audio) {
      body =
        '<audio class="msgAudio" controls src="' +
        esc(m.audio) +
        '"></audio>';
    }
    el.innerHTML =
      '<span class="meta">' +
      esc(m.senderName || "User") +
      "</span>" +
      body;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }


  async function sendMediaMessage(payload) {
    const db = getDb();
    const u = await loadUser(me.uid);
    await db.ref(ROOT + "/" + roomId + "/messages").push(
      Object.assign(
        {
          senderId: me.uid,
          senderName: u.displayName || u.name || u.username || "User",
          createdAt: Date.now()
        },
        payload
      )
    );
  }

  function openAttachSheet() {
    openSheet(
      "<h3>Send</h3>" +
        '<button type="button" class="row" id="attPhoto"><i class="fa-solid fa-image"></i> Photo</button>' +
        '<button type="button" class="row" id="attSticker"><i class="fa-solid fa-face-smile"></i> Sticker</button>' +
        '<button type="button" class="row" id="attVoice"><i class="fa-solid fa-microphone"></i> Voice</button>' +
        '<button type="button" class="row" data-act="close">Cancel</button>'
    );
    $("attPhoto")?.addEventListener("click", function () {
      closeSheet();
      $("groupImageInput")?.click();
    });
    $("attSticker")?.addEventListener("click", function () {
      closeSheet();
      openStickerSheet();
    });
    $("attVoice")?.addEventListener("click", function () {
      closeSheet();
      startVoiceRecord();
    });
    $("sheetPanel")
      ?.querySelector('[data-act="close"]')
      ?.addEventListener("click", closeSheet);
  }

  function openStickerSheet() {
    const stickers = [
      "😀","😂","😍","🔥","👍","❤️","😎","🥳","😭","🤔",
      "🙌","👏","💯","✨","🎉","🤝","💪","😇","😜","🫡"
    ];
    openSheet(
      "<h3>Stickers</h3><div class='stickerGrid'>" +
        stickers
          .map(function (s) {
            return '<button type="button" class="stickerBtn">' + s + "</button>";
          })
          .join("") +
        "</div>"
    );
    document.querySelectorAll(".stickerBtn").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        closeSheet();
        await sendMediaMessage({ type: "sticker", text: btn.textContent, sticker: btn.textContent });
      });
    });
  }

  function fileToDataUrl(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const w = Math.min(maxW || 720, img.width);
        const h = Math.round((img.height / img.width) * w);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", quality || 0.7));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  let recStream = null;
  let rec = null;
  let recChunks = [];
  async function startVoiceRecord() {
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recChunks = [];
      rec = new MediaRecorder(recStream);
      rec.ondataavailable = function (e) {
        if (e.data && e.data.size) recChunks.push(e.data);
      };
      rec.onstop = async function () {
        try {
          recStream.getTracks().forEach(function (t) { t.stop(); });
        } catch (_) {}
        const blob = new Blob(recChunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 180000) {
          toast("Voice too long — keep under ~8s");
          return;
        }
        const reader = new FileReader();
        reader.onload = async function () {
          await sendMediaMessage({
            type: "voice",
            text: "Voice message",
            audio: String(reader.result || "")
          });
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      openSheet(
        "<h3>Recording…</h3><p class='muted'>Tap stop to send</p>" +
          '<button type="button" class="formSubmit" id="stopVoice">Stop & send</button>' +
          '<button type="button" class="formCancel" id="cancelVoice">Cancel</button>'
      );
      $("stopVoice")?.addEventListener("click", function () {
        closeSheet();
        try { rec.stop(); } catch (_) {}
      });
      $("cancelVoice")?.addEventListener("click", function () {
        closeSheet();
        try { rec.stop(); } catch (_) {}
        recChunks = [];
        try { recStream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      });
    } catch (e) {
      console.error(e);
      toast("Mic permission needed");
    }
  }

  async function sendMessage() {
    const input = $("msgInput");
    const text = (input?.value || "").trim();
    if (!text || !me) return;
    if (!can("sendMessage")) {
      toast("You cannot send messages");
      return;
    }
    input.value = "";
    const db = getDb();
    const u = await loadUser(me.uid);
    await db.ref(ROOT + "/" + roomId + "/messages").push({
      text: text.slice(0, 2000),
      senderId: me.uid,
      senderName: u.displayName || u.name || u.username || "User",
      createdAt: Date.now()
    });
  }


  function openGroupProfile() {
    const gp = $("groupProfile");
    if (!gp) {
      setTab("info");
      return;
    }
    gp.classList.remove("hidden");
    renderGroupProfile();
  }
  function closeGroupProfile() {
    $("groupProfile")?.classList.add("hidden");
  }
  function renderGroupProfile() {
    const name = room?.name || "Group";
    const photo = room?.photoURL || room?.photo || "assets/default-avatar.png";
    const bg = room?.background || "";
    if ($("gpName")) $("gpName").textContent = name;
    if ($("gpAvatar")) $("gpAvatar").src = photo;
    if ($("gpHeroBg") && bg) {
      $("gpHeroBg").style.backgroundImage = "url(" + bg + ")";
      $("gpHeroBg").style.backgroundSize = "cover";
    }
    if ($("gpMemberCount"))
      $("gpMemberCount").textContent =
        "(" + Object.keys(members || {}).length + ")";
    const box = $("gpMembers");
    if (!box) return;
    const list = Object.keys(members).map((uid) => ({
      uid,
      ...(members[uid] || {})
    }));
    list.sort(
      (a, b) => (ROLE_RANK[b.role] || 0) - (ROLE_RANK[a.role] || 0)
    );
    box.innerHTML = list
      .map((m) => {
        const role = m.role || "member";
        return (
          '<div class="gpMember" data-uid="' +
          esc(m.uid) +
          '">' +
          '<img src="' +
          esc(m.photoURL || m.photo || "assets/default-avatar.png") +
          '" alt="" onerror="this.src=\'assets/default-avatar.png\'">' +
          '<div class="meta"><strong>' +
          esc(m.name || m.username || "User") +
          '</strong><span>' +
          esc(role) +
          (m.username ? " · " + esc(m.username) : "") +
          "</span></div>" +
          (m.uid !== me.uid
            ? '<button type="button" class="more" data-uid="' +
              esc(m.uid) +
              '"><i class="fa-solid fa-ellipsis-vertical"></i></button>'
            : "") +
          "</div>"
        );
      })
      .join("");
    box.querySelectorAll(".more").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openMemberActions(btn.dataset.uid);
      });
    });
    // change name visibility
    if ($("gpChangeName")) {
      $("gpChangeName").style.display = can("editInfo") ? "" : "none";
    }
    if ($("gpInvite")) {
      $("gpInvite").style.display = can("invite") ? "" : "none";
    }
  }

  function bindGroupProfileUI() {
    $("headerMain")?.addEventListener("click", openGroupProfile);
    $("roomMoreBtn")?.addEventListener("click", openGroupProfile);
    $("gpBack")?.addEventListener("click", closeGroupProfile);
    $("gpChangeName")?.addEventListener("click", () => {
      if (!can("editInfo")) return toast("Only owner/admin");
      handleSetting("edit");
    });
    $("gpLeave")?.addEventListener("click", () => handleSetting("leave"));
    $("gpReport")?.addEventListener("click", () => {
      location.href =
        "report.html?type=group&id=" + encodeURIComponent(roomId);
    });
    $("gpInvite")?.addEventListener("click", () => handleSetting("invite"));
    $("gpMute")?.addEventListener("click", async () => {
      try {
        const db = getDb();
        const ref = db.ref(
          "userChats/" + me.uid + "/" + roomId + "/muted"
        );
        const cur = (await ref.once("value")).val();
        await ref.set(!cur);
        toast(cur ? "Unmuted" : "Muted");
      } catch (_) {
        toast("Could not update mute");
      }
    });
    $("gpPhotoBtn")?.addEventListener("click", () => {
      if (!can("editInfo")) return toast("Only owner/admin");
      $("gpPhotoInput")?.click();
    });
    $("gpBgBtn")?.addEventListener("click", () => {
      $("gpBgInput")?.click();
    });
    $("gpPhotoInput")?.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const data = String(reader.result || "");
        if (data.length > 180000) return toast("Image too large");
        await getDb()
          .ref(ROOT + "/" + roomId)
          .update({ photo: data, photoURL: data });
        toast("Photo updated");
        renderGroupProfile();
        renderHeader();
      };
      reader.readAsDataURL(f);
    });
    $("gpBgInput")?.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const data = String(reader.result || "");
        if (data.length > 200000) return toast("Image too large");
        await getDb()
          .ref(ROOT + "/" + roomId)
          .update({ background: data });
        // also local chat bg
        try {
          localStorage.setItem("viewora_group_bg_" + roomId, data);
        } catch (_) {}
        applyChatBackground(data);
        toast("Background set");
      };
      reader.readAsDataURL(f);
    });
  }

  function applyChatBackground(url) {
    const box = $("messagesBox");
    if (!box) return;
    if (url) {
      box.classList.add("hasBg");
      box.style.backgroundImage = "url(" + url + ")";
    } else {
      box.classList.remove("hasBg");
      box.style.backgroundImage = "";
    }
  }

  async function boot() {
    const params = new URLSearchParams(location.search);
    roomId = params.get("id") || params.get("gid") || params.get("room") || "";
    if (!roomId) {
      toast("Room not found");
      setTimeout(() => (location.href = "messages.html"), 800);
      return;
    }

    const auth = window.auth || firebase.auth();
    const db = getDb();
    await new Promise((resolve, reject) => {
      auth.onAuthStateChanged((u) => {
        if (u) {
          me = u;
          resolve();
        } else reject();
      });
    }).catch(() => {
      location.href = "login.html";
    });
    if (!me) return;

    // Load room
    const snap = await db.ref(ROOT + "/" + roomId).once("value");
    if (!snap.exists()) {
      toast("Room missing");
      setTimeout(() => (location.href = "messages.html"), 800);
      return;
    }
    room = snap.val() || {};
    members = room.members || {};
    myRole = (members[me.uid] && members[me.uid].role) || "member";
    if (room.ownerId === me.uid || room.createdBy === me.uid) {
      if (myRole !== "owner") {
        myRole = "owner";
        try {
          getDb()
            .ref(ROOT + "/" + roomId + "/members/" + me.uid + "/role")
            .set("owner");
        } catch (_) {}
      }
    }
    // hydrate member profiles
    try {
      const uids = Object.keys(members);
      await Promise.all(
        uids.map(async (uid) => {
          const u = await loadUser(uid);
          const merged = Object.assign({}, members[uid], {
            name:
              members[uid].name ||
              u.displayName ||
              u.name ||
              u.username ||
              "User",
            username: members[uid].username || u.username || "",
            photoURL:
              members[uid].photoURL ||
              members[uid].photo ||
              u.profilePhoto ||
              u.photoURL ||
              u.avatar ||
              ""
          });
          members[uid] = merged;
          try {
            if (!members[uid].name || members[uid].name === "User") {
              /* keep */
            }
            getDb()
              .ref(ROOT + "/" + roomId + "/members/" + uid)
              .update({
                name: merged.name,
                username: merged.username,
                photoURL: merged.photoURL || ""
              });
          } catch (_) {}
        })
      );
    } catch (_) {}

    // Must be a member
    if (!members[me.uid] && room.ownerId !== me.uid) {
      // auto-join as member if public? strict: deny
      if (room.visibility === "public") {
        const u = await loadUser(me.uid);
        await db.ref(ROOT + "/" + roomId + "/members/" + me.uid).set({
          role: "member",
          name: u.displayName || u.name || u.username || "User",
          username: u.username || "",
          photoURL: u.profilePhoto || u.photoURL || "",
          joinedAt: Date.now()
        });
        members[me.uid] = { role: "member" };
        myRole = "member";
      } else {
        toast("You are not a member");
        setTimeout(() => (location.href = "messages.html"), 900);
        return;
      }
    }
    if (room.ownerId === me.uid) myRole = "owner";

    renderHeader();
    renderMembers();
    renderSettings();

    // Live members
    db.ref(ROOT + "/" + roomId + "/members").on("value", (s) => {
      members = s.val() || {};
      myRole =
        (members[me.uid] && members[me.uid].role) ||
        (room.ownerId === me.uid ? "owner" : "member");
      renderHeader();
      renderMembers();
      renderSettings();
      updateFeatureButtons();
    });

    db.ref(ROOT + "/" + roomId).on("value", (s) => {
      if (!s.exists()) {
        toast("Room deleted");
        location.href = "messages.html";
        return;
      }
      room = s.val() || room;
      renderHeader();
    });

    msgsRef = db.ref(ROOT + "/" + roomId + "/messages").limitToLast(80);
    msgsRef.on("child_added", (s) => appendMsg(s.key, s.val() || {}));

    // Tabs
    document.querySelectorAll(".roomTab").forEach((btn) => {
      btn.addEventListener("click", () => setTab(btn.dataset.tab));
    });
    $("backBtn")?.addEventListener("click", () => {
      location.href = "messages.html";
    });
    $("sendBtn")?.addEventListener("click", sendMessage);
    $("msgInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
    $("inviteBtn")?.addEventListener("click", () => handleSetting("invite"));
    $("attachBtn")?.addEventListener("click", openAttachSheet);
    $("voiceBtn")?.addEventListener("click", startVoiceRecord);
    $("groupImageInput")?.addEventListener("change", async function () {
      const f = this.files && this.files[0];
      this.value = "";
      if (!f) return;
      try {
        const data = await fileToDataUrl(f, 720, 0.68);
        if (data.length > 220000) return toast("Photo too large");
        await sendMediaMessage({ type: "image", text: "Photo", image: data });
      } catch (e) {
        console.error(e);
        toast("Could not send photo");
      }
    });
    $("roomMoreBtn")?.addEventListener("click", () => setTab("info"));
    $("sheet")?.addEventListener("click", (e) => {
      if (e.target && e.target.getAttribute("data-close")) closeSheet();
    });

    // Teamwork tasks
    if (ROOM_KIND === "teamwork") {
      bindTasks(db);
    }
    // Podcast
    if (ROOM_KIND === "podcast") {
      bindPodcast(db);
    }
    updateFeatureButtons();
    bindGroupProfileUI();
    // background
    try {
      const bg =
        (room && room.background) ||
        localStorage.getItem("viewora_group_bg_" + roomId) ||
        "";
      if (bg) applyChatBackground(bg);
    } catch (_) {}
  }

  function updateFeatureButtons() {
    const start = $("startSessionBtn");
    if (start) {
      start.style.display = can("startSession") ? "" : "none";
    }
    const addEp = $("addEpisodeBtn");
    if (addEp) addEp.style.display = can("addEpisode") ? "" : "none";
    const addTask = $("addTaskBtn");
    if (addTask) addTask.style.display = can("manageTasks") ? "" : "none";
  }

  function bindTasks(db) {
    const list = $("tasksList");
    db.ref(ROOT + "/" + roomId + "/tasks").on("value", (snap) => {
      if (!list) return;
      const rows = [];
      snap.forEach((c) => {
        const t = c.val() || {};
        rows.push({ id: c.key, ...t });
      });
      rows.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      list.innerHTML = rows
        .map(
          (t) =>
            '<div class="taskRow' +
            (t.done ? " done" : "") +
            '" data-id="' +
            esc(t.id) +
            '">' +
            '<input type="checkbox" ' +
            (t.done ? "checked" : "") +
            (can("manageTasks") || t.assignee === me.uid ? "" : " disabled") +
            ">" +
            '<span class="taskTitle">' +
            esc(t.title || "Task") +
            "</span>" +
            "</div>"
        )
        .join("") || '<p class="muted" style="padding:12px">No tasks yet</p>';
      list.querySelectorAll(".taskRow").forEach((row) => {
        const cb = row.querySelector("input");
        cb?.addEventListener("change", async () => {
          await db
            .ref(ROOT + "/" + roomId + "/tasks/" + row.dataset.id + "/done")
            .set(!!cb.checked);
        });
      });
    });
    $("addTaskBtn")?.addEventListener("click", async () => {
      if (!can("manageTasks")) return toast("Admins only");
      const title = prompt("Task title");
      if (!title) return;
      await db.ref(ROOT + "/" + roomId + "/tasks").push({
        title: title.slice(0, 120),
        done: false,
        createdBy: me.uid,
        createdAt: Date.now()
      });
    });
  }

  function bindPodcast(db) {
    $("startSessionBtn")?.addEventListener("click", async () => {
      if (!can("startSession")) return toast("Only owner/admin");
      await db.ref(ROOT + "/" + roomId + "/session").set({
        active: true,
        startedBy: me.uid,
        startedAt: Date.now()
      });
      if ($("podStatus")) $("podStatus").textContent = "Session live";
      toast("Session started");
    });
    db.ref(ROOT + "/" + roomId + "/session").on("value", (s) => {
      const d = s.val() || {};
      if ($("podStatus"))
        $("podStatus").textContent = d.active ? "Session live" : "Lobby";
    });
    const epList = $("episodesList");
    db.ref(ROOT + "/" + roomId + "/episodes").on("value", (snap) => {
      if (!epList) return;
      const rows = [];
      snap.forEach((c) => rows.push({ id: c.key, ...(c.val() || {}) }));
      rows.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      epList.innerHTML =
        rows
          .map(
            (e) =>
              '<div class="episodeRow"><div class="info"><strong>' +
              esc(e.title || "Episode") +
              '</strong><span class="muted">' +
              esc(e.note || "") +
              "</span></div></div>"
          )
          .join("") || '<p class="muted" style="padding:12px">No episodes</p>';
    });
    $("addEpisodeBtn")?.addEventListener("click", async () => {
      if (!can("addEpisode")) return toast("Admins only");
      const title = prompt("Episode title");
      if (!title) return;
      const note = prompt("Notes (optional)") || "";
      await db.ref(ROOT + "/" + roomId + "/episodes").push({
        title: title.slice(0, 100),
        note: note.slice(0, 200),
        createdBy: me.uid,
        createdAt: Date.now()
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
