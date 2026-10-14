/**
 * Viewora — Ads Settings (admin, live Firebase)
 * Controls ads/config/{feed,shorts,banner,video} and ads/creatives.
 */
(function () {
  "use strict";

  const CONFIG_ROOT = "ads/config";
  const CREATIVES = "ads/creatives";

  function getDb() {
    if (window.db) return window.db;
    if (window.firebase && firebase.database) return firebase.database();
    return null;
  }
  function getAuth() {
    if (window.auth) return window.auth;
    if (window.firebase && firebase.auth) return firebase.auth();
    return null;
  }

  function isAdmin(uid) {
    const rdb = getDb();
    if (!rdb || !uid) return Promise.resolve(false);
    return rdb
      .ref("admins/" + uid)
      .once("value")
      .then((snap) => {
        const v = snap.val();
        if (!v) return false;
        if (v === true) return true;
        if (typeof v === "object") {
          if (v.active === false) return false;
          const role = String(v.role || "").toLowerCase();
          return role === "admin" || role === "superadmin" || v.active === true;
        }
        return false;
      })
      .catch(() => false);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function showStatus(msg, type) {
    const el = $("status");
    if (!el) return;
    el.textContent = msg;
    el.className = "status show" + (type === "ok" ? " ok" : type === "err" ? " err" : "");
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => {
      el.classList.remove("show");
    }, 3200);
  }

  function setPill(placement, on) {
    const p = $("pill-" + placement);
    if (!p) return;
    p.textContent = on ? "ON" : "OFF";
    p.classList.toggle("off", !on);
  }

  function readPlacementForm(name) {
    if (name === "feed") {
      return {
        enabled: $("feed-enabled").checked,
        frequency: Number($("feed-frequency").value) || 5,
        startAfter: Number($("feed-startAfter").value) || 0,
        maxPerSession: Number($("feed-maxPerSession").value) || 8,
        updatedAt: Date.now(),
      };
    }
    if (name === "shorts") {
      return {
        enabled: $("shorts-enabled").checked,
        frequency: Number($("shorts-frequency").value) || 4,
        startAfter: Number($("shorts-startAfter").value) || 0,
        maxPerSession: Number($("shorts-maxPerSession").value) || 6,
        updatedAt: Date.now(),
      };
    }
    if (name === "banner") {
      return {
        enabled: $("banner-enabled").checked,
        position: $("banner-position").value || "top",
        rotateSeconds: Number($("banner-rotateSeconds").value) || 30,
        dismissible: $("banner-dismissible").checked,
        updatedAt: Date.now(),
      };
    }
    if (name === "video") {
      return {
        enabled: $("video-enabled").checked,
        companion: $("video-companion").checked,
        preRoll: $("video-preRoll").checked,
        midRoll: $("video-midRoll").checked,
        midRollPercent: Number($("video-midRollPercent").value) || 50,
        skipAfterSeconds: Number($("video-skipAfterSeconds").value) || 5,
        vastUrl: ($("video-vastUrl").value || "").trim(),
        updatedAt: Date.now(),
      };
    }
    return null;
  }

  function fillPlacementForm(name, data) {
    const d = data || {};
    if (name === "feed") {
      $("feed-enabled").checked = d.enabled !== false;
      $("feed-frequency").value = d.frequency != null ? d.frequency : 5;
      $("feed-startAfter").value = d.startAfter != null ? d.startAfter : 2;
      $("feed-maxPerSession").value = d.maxPerSession != null ? d.maxPerSession : 8;
      setPill("feed", d.enabled !== false);
    }
    if (name === "shorts") {
      $("shorts-enabled").checked = d.enabled !== false;
      $("shorts-frequency").value = d.frequency != null ? d.frequency : 4;
      $("shorts-startAfter").value = d.startAfter != null ? d.startAfter : 1;
      $("shorts-maxPerSession").value = d.maxPerSession != null ? d.maxPerSession : 6;
      setPill("shorts", d.enabled !== false);
    }
    if (name === "banner") {
      $("banner-enabled").checked = d.enabled !== false;
      $("banner-position").value = d.position || "top";
      $("banner-rotateSeconds").value = d.rotateSeconds != null ? d.rotateSeconds : 30;
      $("banner-dismissible").checked = d.dismissible !== false;
      setPill("banner", d.enabled !== false);
    }
    if (name === "video") {
      $("video-enabled").checked = d.enabled !== false;
      $("video-companion").checked = d.companion !== false;
      $("video-preRoll").checked = d.preRoll === true;
      $("video-midRoll").checked = d.midRoll === true;
      $("video-midRollPercent").value = d.midRollPercent != null ? d.midRollPercent : 50;
      $("video-skipAfterSeconds").value = d.skipAfterSeconds != null ? d.skipAfterSeconds : 5;
      $("video-vastUrl").value = d.vastUrl || "";
      setPill("video", d.enabled !== false);
    }
  }

  async function loadAllConfig() {
    const rdb = getDb();
    if (!rdb) return;
    const snap = await rdb.ref(CONFIG_ROOT).once("value");
    const val = snap.val() || {};
    ["feed", "shorts", "banner", "video"].forEach((k) => fillPlacementForm(k, val[k]));
  }

  async function savePlacement(name) {
    const rdb = getDb();
    if (!rdb) {
      showStatus("Database not ready", "err");
      return;
    }
    const data = readPlacementForm(name);
    if (!data) return;
    try {
      await rdb.ref(CONFIG_ROOT + "/" + name).update(data);
      setPill(name, data.enabled !== false);
      showStatus(name + " settings saved (live)", "ok");
    } catch (e) {
      showStatus("Save failed: " + (e.message || e), "err");
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadCreatives() {
    const rdb = getDb();
    const list = $("creativesList");
    if (!rdb || !list) return;
    const snap = await rdb.ref(CREATIVES).once("value");
    list.innerHTML = "";
    if (!snap.exists()) {
      list.innerHTML = '<p class="hint">No creatives yet. Add one above.</p>';
      return;
    }
    const rows = [];
    snap.forEach((child) => {
      rows.push({ id: child.key, ...(child.val() || {}) });
    });
    rows.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    rows.forEach((c) => {
      const el = document.createElement("div");
      el.className = "creative";
      el.innerHTML =
        (c.imageUrl
          ? `<img src="${escapeHtml(c.imageUrl)}" alt="" onerror="this.style.opacity=0.3">`
          : `<div style="width:72px;height:48px;border-radius:8px;background:#1a1528"></div>`) +
        `<div class="meta">` +
        `<strong>${escapeHtml(c.title || "Untitled")}</strong>` +
        `<span>${escapeHtml(c.placement || "all")} · ${c.active === false ? "OFF" : "ON"}</span>` +
        `</div>` +
        `<div class="stats">` +
        `<div>${Number(c.impressions) || 0} imp</div>` +
        `<div>${Number(c.clicks) || 0} clicks</div>` +
        `<div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end">` +
        `<button type="button" class="btn ghost" data-toggle="${c.id}" style="padding:6px 10px">${c.active === false ? "Enable" : "Disable"}</button>` +
        `<button type="button" class="btn danger" data-del="${c.id}" style="padding:6px 10px">Delete</button>` +
        `</div></div>`;
      list.appendChild(el);
    });

    list.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-toggle");
        const ref = rdb.ref(CREATIVES + "/" + id);
        const s = await ref.once("value");
        const cur = s.val() || {};
        await ref.update({ active: cur.active === false, updatedAt: Date.now() });
        showStatus("Creative updated", "ok");
        loadCreatives();
      });
    });
    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this creative permanently?")) return;
        await rdb.ref(CREATIVES + "/" + btn.getAttribute("data-del")).remove();
        showStatus("Creative deleted", "ok");
        loadCreatives();
      });
    });
  }

  async function addCreative() {
    const rdb = getDb();
    if (!rdb) return;
    const title = ($("c-title").value || "").trim();
    const clickUrl = ($("c-click").value || "").trim();
    if (!title || !clickUrl) {
      showStatus("Title and click URL required", "err");
      return;
    }
    const payload = {
      title,
      description: ($("c-desc").value || "").trim(),
      imageUrl: ($("c-image").value || "").trim(),
      videoUrl: ($("c-video").value || "").trim(),
      clickUrl,
      cta: ($("c-cta").value || "Learn more").trim(),
      placement: $("c-placement").value || "all",
      priority: Number($("c-priority").value) || 0,
      sponsor: ($("c-sponsor").value || "").trim(),
      active: true,
      impressions: 0,
      clicks: 0,
      createdAt: Date.now(),
    };
    try {
      await rdb.ref(CREATIVES).push(payload);
      showStatus("Creative live", "ok");
      $("c-title").value = "";
      $("c-desc").value = "";
      $("c-image").value = "";
      $("c-video").value = "";
      $("c-click").value = "";
      loadCreatives();
    } catch (e) {
      showStatus("Add failed: " + (e.message || e), "err");
    }
  }

  function wireUi() {
    document.querySelectorAll("[data-save]").forEach((btn) => {
      btn.addEventListener("click", () => savePlacement(btn.getAttribute("data-save")));
    });
    $("addCreativeBtn")?.addEventListener("click", addCreative);
    $("refreshBtn")?.addEventListener("click", () => {
      loadAllConfig();
      loadCreatives();
      showStatus("Refreshed", "ok");
    });
    // live pill updates
    ["feed", "shorts", "banner", "video"].forEach((name) => {
      const cb = $(name + "-enabled");
      if (cb) cb.addEventListener("change", () => setPill(name, cb.checked));
    });
  }

  function boot() {
    const auth = getAuth();
    const gate = $("gate");
    const app = $("app");
    if (!auth) {
      if (gate) gate.hidden = false;
      return;
    }
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        if (app) app.hidden = true;
        if (gate) gate.hidden = false;
        return;
      }
      const ok = await isAdmin(user.uid);
      if (!ok) {
        if (app) app.hidden = true;
        if (gate) {
          gate.hidden = false;
          gate.querySelector("p").textContent = "This account is not an admin.";
        }
        return;
      }
      if (gate) gate.hidden = true;
      if (app) app.hidden = false;
      wireUi();
      await loadAllConfig();
      await loadCreatives();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
