/**
 * VIEWORA — Edit Shorts (Phase 2)
 * URL: edit-shorts.html?id=SHORT_ID
 * Updates title, description, hashtags, thumbnail, audience, comments only.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    user: null,
    shortId: "",
    data: null,
    saving: false
  };

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function setStatus(text, type) {
    const el = $("statusText");
    if (!el) return;
    el.textContent = text || "";
    el.className = "status" + (type ? " " + type : "");
  }

  function getId() {
    try {
      const p = new URLSearchParams(location.search);
      return (p.get("id") || p.get("shortId") || p.get("short") || "").trim();
    } catch (_) {
      return "";
    }
  }

  function ownerOf(d) {
    return (d && (d.uid || d.userId || d.ownerId)) || "";
  }

  function mediaURL(d) {
    if (!d) return "";
    return (
      d.videoURL ||
      d.videoUrl ||
      d.mediaURL ||
      d.mediaUrl ||
      d.url ||
      d.src ||
      ""
    );
  }

  function thumbURL(d) {
    if (!d) return "";
    return (
      d.thumbnail ||
      d.thumb ||
      d.poster ||
      d.cover ||
      d.imageUrl ||
      ""
    );
  }

  function bindCounters() {
    const title = $("titleInput");
    const desc = $("descInput");
    const tc = $("titleCount");
    const dc = $("descCount");
    function sync() {
      if (tc && title) tc.textContent = String(title.value.length);
      if (dc && desc) dc.textContent = String(desc.value.length);
    }
    title?.addEventListener("input", sync);
    desc?.addEventListener("input", sync);
    sync();
  }

  function fillForm(d) {
    $("titleInput").value = d.title || d.caption || d.name || "";
    $("descInput").value = d.description || d.caption || d.text || "";
    const tags = d.hashtags || d.tags || d.tagList || [];
    $("tagsInput").value = Array.isArray(tags)
      ? tags.map((t) => (String(t).startsWith("#") ? t : "#" + t)).join(" ")
      : String(tags || "");
    $("thumbInput").value = "";
    const aud = String(d.audience || d.visibility || "public").toLowerCase();
    $("audienceSelect").value = ["public", "followers", "private"].includes(aud)
      ? aud
      : "public";
    const commentsOff =
      d.allowComments === false ||
      d.commentsEnabled === false ||
      d.comments === "off";
    $("commentsSelect").value = commentsOff ? "off" : "on";

    const video = mediaURL(d);
    const thumb = thumbURL(d);
    const pv = $("previewVideo");
    const pi = $("previewThumb");
    const ph = $("previewPh");
    if (video && pv) {
      pv.src = video;
      pv.style.display = "block";
      if (pi) pi.style.display = "none";
      if (ph) ph.style.display = "none";
    } else if (thumb && pi) {
      pi.src = thumb;
      pi.style.display = "block";
      if (pv) pv.style.display = "none";
      if (ph) ph.style.display = "none";
    } else if (ph) {
      ph.style.display = "grid";
    }
    bindCounters();
  }

  async function loadShort(uid, id) {
    const db = firebase.database();
    // Prefer /shorts/{id}, fallback user mirror
    const paths = [
      "shorts/" + id,
      "users/" + uid + "/shorts/" + id,
      "videos/" + id
    ];
    for (let i = 0; i < paths.length; i++) {
      try {
        const snap = await db.ref(paths[i]).once("value");
        if (snap.exists()) {
          const val = snap.val() || {};
          val.__path = paths[i];
          return val;
        }
      } catch (e) {
        console.warn("[edit-shorts] read", paths[i], e);
      }
    }
    return null;
  }

  function collectPatch() {
    const title = ($("titleInput").value || "").trim().slice(0, 100);
    const description = ($("descInput").value || "").trim().slice(0, 500);
    const rawTags = ($("tagsInput").value || "").trim();
    const hashtags = rawTags
      ? rawTags
          .split(/[\s,]+/)
          .map((t) => t.replace(/^#/, "").trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];
    const thumb = ($("thumbInput").value || "").trim();
    const audience = $("audienceSelect").value || "public";
    const allowComments = ($("commentsSelect").value || "on") === "on";

    const patch = {
      title: title,
      description: description,
      caption: description || title,
      hashtags: hashtags,
      audience: audience,
      visibility: audience,
      allowComments: allowComments,
      commentsEnabled: allowComments,
      updatedAt: Date.now()
    };
    if (thumb) {
      patch.thumbnail = thumb;
      patch.thumb = thumb;
      patch.poster = thumb;
    }
    return patch;
  }

  async function save() {
    if (state.saving || !state.user || !state.shortId || !state.data) return;
    const owner = ownerOf(state.data);
    if (owner && owner !== state.user.uid) {
      toast("You can only edit your own short");
      return;
    }
    const patch = collectPatch();
    if (!patch.title && !patch.description) {
      toast("Title or description required");
      return;
    }

    state.saving = true;
    $("saveBtn").disabled = true;
    setStatus("Saving…");

    try {
      const db = firebase.database();
      const path = state.data.__path || "shorts/" + state.shortId;
      await db.ref(path).update(patch);

      // Mirror under user node if main path was /shorts
      if (path.indexOf("shorts/") === 0) {
        try {
          await db
            .ref("users/" + state.user.uid + "/shorts/" + state.shortId)
            .update(patch);
        } catch (_) {}
      }

      setStatus("Saved", "ok");
      toast("Short updated");
      setTimeout(function () {
        const back = document.referrer;
        if (back && back.indexOf(location.host) !== -1) history.back();
        else location.href = "profile.html";
      }, 700);
    } catch (e) {
      console.error("[edit-shorts] save", e);
      setStatus("Save failed", "err");
      toast((e && e.message) || "Save failed");
      $("saveBtn").disabled = false;
    } finally {
      state.saving = false;
    }
  }

  async function start(user) {
    state.user = user;
    if (!user) {
      $("loginGate").style.display = "grid";
      $("editorWrap").style.display = "none";
      return;
    }
    $("loginGate").style.display = "none";
    $("editorWrap").style.display = "block";

    state.shortId = getId();
    if (!state.shortId) {
      setStatus("Missing short id (?id=)", "err");
      $("saveBtn").disabled = true;
      toast("Open from your short menu: Edit");
      return;
    }

    setStatus("Loading short…");
    const data = await loadShort(user.uid, state.shortId);
    if (!data) {
      setStatus("Short not found", "err");
      $("saveBtn").disabled = true;
      return;
    }
    const owner = ownerOf(data);
    if (owner && owner !== user.uid) {
      setStatus("Not your short", "err");
      $("saveBtn").disabled = true;
      toast("You can only edit your own short");
      return;
    }

    state.data = data;
    fillForm(data);
    $("saveBtn").disabled = false;
    setStatus("Ready", "ok");
    $("pageTitle").textContent = "Edit Shorts";
  }

  function bind() {
    $("backBtn")?.addEventListener("click", function () {
      if (history.length > 1) history.back();
      else location.href = "profile.html";
    });
    $("saveBtn")?.addEventListener("click", save);
  }

  function init() {
    bind();
    if (typeof firebase === "undefined" || !firebase.auth) {
      setStatus("Firebase not ready", "err");
      return;
    }
    firebase.auth().onAuthStateChanged(function (user) {
      start(user || null);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else init();
})();
