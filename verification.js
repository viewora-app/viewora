"use strict";

/*
========================================================
 VIEWORA VERIFICATION SYSTEM
 Blue  : Identity / Creator Verification
 Red   : Elite Membership
 Yellow: Business / Brand Verification
 White : Follower Achievements

 Firebase:
 verificationApplications/{applicationId}
 users/{uid}/tickApplications/{type}
 notifications/{uid}/{notificationId}

 IMPORTANT:
 Production approval and payment entitlements must be
 controlled by a trusted server/admin, not client flags.
========================================================
*/

(function () {
  if (window.__VIEWORA_VERIFICATION_INIT__) return;
  window.__VIEWORA_VERIFICATION_INIT__ = true;

  const TYPES = {
    blue: {
      title: "Blue Tick",
      subtitle: "Identity & Creator Verification",
      color: "blue",
      points: [
        "Identity and account authenticity review",
        "Creator, artist or public figure",
        "Complete and authentic profile required",
        "Subscription does not guarantee approval"
      ]
    },

    red: {
      title: "Red Tick",
      subtitle: "Viewora Elite",
      color: "red",
      points: [
        "Elite subscription benefits",
        "Elite status must be active",
        "Membership and verification are separate",
        "Benefits end according to subscription status"
      ]
    },

    yellow: {
      title: "Yellow Tick",
      subtitle: "Official Business / Brand",
      color: "yellow",
      points: [
        "Minimum 5,000 genuine followers required",
        "Business or brand ownership review",
        "Business name and category required",
        "Registration or official proof may be requested",
        "Payment does not guarantee approval"
      ]
    },

    white: {
      title: "White Tick",
      subtitle: "Follower Achievement",
      color: "white",
      points: [
        "Earned through follower milestones",
        "1M, 5M and 10M milestone levels",
        "Follower authenticity may be reviewed",
        "Buying followers does not qualify"
      ]
    }
  };

  const $ = id => document.getElementById(id);

  let currentUser = null;
  let applicationType = null;
  let submitting = false;

  function getAuth() {
    if (window.auth) return window.auth;

    if (window.firebase && firebase.auth) {
      return firebase.auth();
    }

    return null;
  }

  function getDB() {
    if (window.db) return window.db;

    if (window.firebase && firebase.database) {
      return firebase.database();
    }

    return null;
  }

  function notify(message) {
    alert(message);
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeStatus(status) {
    const s = String(status || "").toLowerCase();

    if (["active", "approved", "verified"].includes(s)) {
      return "approved";
    }

    if (["pending", "review", "under_review"].includes(s)) {
      return "under_review";
    }

    if (["rejected", "more_info", "none"].includes(s)) {
      return s;
    }

    return "none";
  }

  function statusInfo(status) {
    const s = normalizeStatus(status);

    const map = {
      approved: {
        label: "Approved",
        cls: "active"
      },
      under_review: {
        label: "Under Review",
        cls: "review"
      },
      rejected: {
        label: "Rejected",
        cls: "rejected"
      },
      more_info: {
        label: "More Information Needed",
        cls: "review"
      },
      none: {
        label: "Not Applied",
        cls: "none"
      }
    };

    return map[s] || map.none;
  }

  async function loadUser(uid) {
    const database = getDB();

    if (!database) {
      throw new Error("Firebase Database is unavailable.");
    }

    const snapshot = await database
      .ref("users/" + uid)
      .once("value");

    return snapshot.val() || {};
  }

  /*
   * Badge eligibility should come from trusted server/admin
   * records. Application status alone is not approval.
   */
  function isBadgeActive(user, type) {
    const B = window.VieworaBadges;

    if (B) {
      if (type === "blue" && B.hasBlue) {
        return B.hasBlue(user);
      }

      if (type === "red" && B.hasRed) {
        return B.hasRed(user);
      }

      if (type === "yellow" && B.hasYellow) {
        return B.hasYellow(user);
      }

      if (type === "white" && B.hasWhite) {
        return B.hasWhite(user);
      }
    }

    const verification = user && user.verification;
    const approved = verification && verification[type];

    return !!(
      approved &&
      approved.status === "approved" &&
      approved.active === true
    );
  }

  function getStatus(user, type) {
    if (!user) return "none";

    if (isBadgeActive(user, type)) {
      return "approved";
    }

    const app = user.tickApplications &&
      user.tickApplications[type];

    return normalizeStatus(app && app.status);
  }

  var YELLOW_MIN_FOLLOWERS = 5000;

  function hasActiveSubscription(user) {
    if (!user) return false;
    var sub = user.subscription || {};
    if (sub.active === true || String(sub.status || "").toLowerCase() === "active") {
      var exp = Number(sub.expiresAt || 0);
      if (exp > 0 && exp < Date.now()) return false;
      return true;
    }
    if (user.subscriptionActive === true || user.premium === true || user.isPremium === true) {
      return true;
    }
    return false;
  }

  function planOfUser(user) {
    var sub = (user && user.subscription) || {};
    return String(sub.plan || user.plan || "").toLowerCase();
  }

  function getFollowerCount(user) {
    const B = window.VieworaBadges;

    if (B && typeof B.followersOf === "function") {
      return Number(B.followersOf(user)) || 0;
    }

    return Number(
      user.followersCount ||
      user.followers_count ||
      0
    );
  }

  function getWhiteLevel(user) {
    const B = window.VieworaBadges;

    if (B && typeof B.getWhiteLevel === "function") {
      return B.getWhiteLevel(user);
    }

    const count = getFollowerCount(user);

    if (count >= 10000000) {
      return { level: 3, label: "Level 3 · 10M followers" };
    }

    if (count >= 5000000) {
      return { level: 2, label: "Level 2 · 5M followers" };
    }

    if (count >= 1000000) {
      return { level: 1, label: "Level 1 · 1M followers" };
    }

    return {
      level: 0,
      label: "Next milestone: 1M followers"
    };
  }

  function renderGrid(user) {
    const grid = $("tickGrid");
    if (!grid) return;

    grid.replaceChildren();

    Object.keys(TYPES).forEach(type => {
      const item = TYPES[type];
      const status = getStatus(user, type);
      const info = statusInfo(status);

      const card = document.createElement("article");
      card.className = "vCard";

      const head = document.createElement("div");
      head.className = "vCardHead";

      const icon = document.createElement("div");
      icon.className = "vIcon " + item.color;
      icon.textContent = "✓";
      icon.setAttribute("aria-label", item.title);

      const details = document.createElement("div");
      details.style.flex = "1";
      details.style.minWidth = "0";

      const title = document.createElement("h3");
      title.textContent = item.title;

      const subtitle = document.createElement("p");
      subtitle.className = "vSub";
      subtitle.textContent = item.subtitle;

      details.append(title, subtitle);

      const badgeStatus = document.createElement("span");
      badgeStatus.className = "vStatus " + info.cls;
      badgeStatus.textContent = info.label;

      head.append(icon, details, badgeStatus);

      const list = document.createElement("ul");

      item.points.forEach(point => {
        const li = document.createElement("li");
        li.textContent = point;
        list.appendChild(li);
      });

      const button = document.createElement("button");
      button.type = "button";
      button.className = "vBtn";
      button.dataset.apply = type;

      if (status === "approved") {
        button.textContent = "Active on profile";
        button.disabled = true;
        button.classList.add("ghost");
      } else if (status === "under_review") {
        button.textContent = "Application under review";
        button.disabled = true;
        button.classList.add("ghost");
      } else if (type === "red") {
        button.textContent = "View Elite subscription";
      } else if (type === "white") {
        button.textContent = "View milestones";
      } else if (type === "yellow") {
        var yfc = getFollowerCount(user);
        if (yfc < YELLOW_MIN_FOLLOWERS) {
          button.textContent = "Locked · need 5,000 followers";
          button.classList.add("ghost");
        } else if (!hasActiveSubscription(user)) {
          button.textContent = "Buy plan, then Apply";
        } else {
          button.textContent =
            status === "rejected" || status === "more_info"
              ? "Review / Re-apply"
              : "Apply for " + item.title;
        }
      } else if (type === "blue" && !hasActiveSubscription(user)) {
        button.textContent = "Subscribe, then Apply";
      } else {
        button.textContent =
          status === "rejected" || status === "more_info"
            ? "Review / Re-apply"
            : "Apply for " + item.title;
      }

      card.append(head, list, button);
      grid.appendChild(card);
    });

    grid.querySelectorAll("[data-apply]").forEach(button => {
      button.addEventListener("click", () => {
        handleApply(button.dataset.apply, user);
      });
    });
  }

  function field(id, label, placeholder, maxLength) {
    return `
      <div class="vField">
        <label for="${id}">${escapeHTML(label)}</label>
        <input
          id="${id}"
          maxlength="${maxLength || 120}"
          placeholder="${escapeHTML(placeholder || "")}"
          autocomplete="off"
        >
      </div>
    `;
  }

  function selectField(id, label, options) {
    return `
      <div class="vField">
        <label for="${id}">${escapeHTML(label)}</label>
        <select id="${id}">
          ${options.map(option => `
            <option value="${escapeHTML(option[0])}">
              ${escapeHTML(option[1])}
            </option>
          `).join("")}
        </select>
      </div>
    `;
  }

  function textArea(id, label, placeholder) {
    return `
      <div class="vField">
        <label for="${id}">${escapeHTML(label)}</label>
        <textarea
          id="${id}"
          maxlength="500"
          placeholder="${escapeHTML(placeholder || "")}"
        ></textarea>
      </div>
    `;
  }

  function openSheet(type) {
    const meta = TYPES[type];
    const sheet = $("applySheet");
    const title = $("applyTitle");
    const body = $("applyBody");

    if (!meta || !sheet || !title || !body) {
      notify("Verification form could not be opened.");
      return;
    }

    applicationType = type;
    title.textContent = "Apply · " + meta.title;

    if (type === "blue") {
      body.innerHTML =
        field("vfName", "Public / creator name", "Your name", 100) +
        selectField("vfCat", "Account category", [
          ["creator", "Creator / Influencer"],
          ["artist", "Artist / Musician"],
          ["public", "Public figure"],
          ["journalist", "Journalist"],
          ["other", "Other"]
        ]) +
        field("vfWebsite", "Official website / profile link",
          "https://…", 250) +
        textArea("vfWhy", "Why should this account be verified?",
          "Share public links that help establish authenticity.") +
        `<p class="vNote">
          Do not enter Aadhaar/PAN numbers or upload identity documents
          into this form. If additional identity proof is needed, use a
          secure verification process provided by Viewora.
        </p>`;
    } else if (type === "yellow") {
      body.innerHTML =
        field("vfBiz", "Business / brand name",
          "Official registered name", 100) +
        selectField("vfBizType", "Business type", [
          ["company", "Company"],
          ["brand", "Brand"],
          ["seller", "Authorized seller"],
          ["shop", "Shop / Store"],
          ["other", "Other"]
        ]) +
        field("vfRegType", "Registration proof type",
          "For example: company registration", 100) +
        field("vfWebsite", "Official website / store link",
          "https://…", 250) +
        textArea("vfWhy", "Business details and proof links",
          "Describe the business and provide public proof links.") +
        `<p class="vNote">
          Never share passwords, bank details, full government ID numbers
          or confidential documents in this form. Payment alone does
          not approve a business badge.
        </p>`;
    } else {
      return;
    }

    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    const sheet = $("applySheet");

    if (sheet) {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    }

    applicationType = null;
  }

  function readValue(id) {
    const el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function handleApply(type, user) {
    if (!currentUser) {
      notify("Please log in to apply.");
      location.href = "login.html";
      return;
    }

    if (type === "red") {
      location.href = "subscription.html";
      return;
    }

    if (type === "white") {
      const followers = getFollowerCount(user);
      const level = getWhiteLevel(user);

      notify(
        "Your followers: " + followers.toLocaleString() +
        "\n" + level.label +
        "\n\nFollower milestones are subject to authenticity checks."
      );

      return;
    }

    const status = getStatus(user, type);

    if (status === "under_review") {
      notify("Your application is already under review.");
      return;
    }

    if (status === "approved") {
      notify("This badge is already active.");
      return;
    }

    /* Yellow: minimum 5,000 followers */
    if (type === "yellow") {
      var fc = getFollowerCount(user);
      if (fc < YELLOW_MIN_FOLLOWERS) {
        notify(
          "Business Verification Locked\n\n" +
          "You need at least 5,000 followers to apply.\n" +
          "Your followers: " + fc.toLocaleString() + "\n\n" +
          "Grow your authentic audience to unlock business verification."
        );
        return;
      }
      if (!hasActiveSubscription(user)) {
        notify(
          "Subscription required\n\n" +
          "Buy a Viewora plan first, then return here to Apply for Yellow Tick.\n" +
          "Payment alone does not approve the badge."
        );
        location.href = "subscription.html";
        return;
      }
    }

    /* Blue: need Plus/Pro/Elite (or any active sub) then Apply → under review */
    if (type === "blue") {
      if (!hasActiveSubscription(user)) {
        notify(
          "Subscription required\n\n" +
          "Purchase Plus, Pro or Elite first.\n" +
          "After payment, come back to Verification and tap Apply.\n" +
          "Admin review is required — tick is not automatic."
        );
        location.href = "subscription.html";
        return;
      }
    }

    openSheet(type);
  }

  function validHttpURL(value) {
    if (!value) return true;

    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch (_) {
      return false;
    }
  }

  async function submitApplication() {
    if (submitting) return;

    const auth = getAuth();
    const database = getDB();
    const user = auth && auth.currentUser;

    if (!user) {
      notify("Please log in first.");
      location.href = "login.html";
      return;
    }

    if (!database || !applicationType) {
      notify("Verification service is unavailable.");
      return;
    }

    if (!["blue", "yellow"].includes(applicationType)) {
      notify("This application type cannot be submitted here.");
      return;
    }

    const type = applicationType;
    const existingUser = await loadUser(user.uid).catch(() => ({}));

    const existingStatus = getStatus(existingUser, type);

    if (existingStatus === "under_review" ||
        existingStatus === "approved") {
      notify("An application is already active or under review.");
      closeSheet();
      renderGrid(existingUser);
      return;
    }

    const payload = {
      uid: user.uid,
      type: type,
      status: "under_review",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schemaVersion: 1
    };

    if (type === "blue") {
      payload.publicName = readValue("vfName");
      payload.category = readValue("vfCat");
      payload.officialLink = readValue("vfWebsite");
      payload.reason = readValue("vfWhy");

      if (!payload.publicName || !payload.reason) {
        notify("Please enter your name and verification reason.");
        return;
      }
    }

    if (type === "yellow") {
      payload.businessName = readValue("vfBiz");
      payload.businessType = readValue("vfBizType");
      payload.registrationProofType = readValue("vfRegType");
      payload.officialLink = readValue("vfWebsite");
      payload.reason = readValue("vfWhy");

      if (!payload.businessName || !payload.reason) {
        notify("Business name and business details are required.");
        return;
      }
    }

    if (!validHttpURL(payload.officialLink)) {
      notify("Enter a valid HTTP or HTTPS link.");
      return;
    }

    const submitButton = $("applySubmit");
    submitting = true;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting…";
    }

    try {
      const applicationRef =
        database.ref("verificationApplications").push();

      const applicationId = applicationRef.key;

      payload.id = applicationId;

      /*
       * Both writes are client requests, so Firebase Rules must
       * authorize only safe application fields. Approval fields
       * must be writable by trusted admin/server only.
       */
      await applicationRef.set(payload);

      await database
        .ref("users/" + user.uid + "/tickApplications/" + type)
        .set({
          status: "under_review",
          applicationId: applicationId,
          updatedAt: Date.now()
        });

      const notificationRef =
        database.ref("notifications/" + user.uid).push();

      await notificationRef.set({
        id: notificationRef.key,
        type: "verification_submitted",
        title: TYPES[type].title + " application submitted",
        body: "Your application is under review. Payment does not guarantee approval.",
        tickType: type,
        createdAt: Date.now(),
        read: false
      });

      closeSheet();
      notify("Application submitted successfully. It is now under review.");

      const refreshed = await loadUser(user.uid);
      renderGrid(refreshed);
    } catch (error) {
      console.error("[Viewora Verification]", error);
      notify(
        "Could not submit the application. Check your Firebase login and database rules."
      );
    } finally {
      submitting = false;

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit application";
      }
    }
  }

  /* -------- Tick details panel -------- */

  function showTickHoldPanel(user) {
    let panel = $("tickHoldPanel");

    if (!panel) {
      panel = document.createElement("div");
      panel.id = "tickHoldPanel";
      panel.className = "tickHoldPanel";

      panel.innerHTML = `
        <div class="tickHoldCard" role="dialog"
             aria-label="Viewora verification status">
          <h4>Viewora Verification</h4>
          <div class="tickHoldBrand">Viewora ✓</div>
          <div id="tickHoldRows"></div>
          <button type="button" class="tickHoldClose">Close</button>
        </div>
      `;

      document.body.appendChild(panel);

      panel.addEventListener("click", event => {
        if (event.target === panel) {
          panel.classList.remove("open");
        }
      });

      panel.querySelector(".tickHoldClose")
        .addEventListener("click", () => {
          panel.classList.remove("open");
        });
    }

    const rows = $("tickHoldRows");
    if (!rows) return;

    rows.replaceChildren();

    Object.keys(TYPES).forEach(type => {
      const meta = TYPES[type];
      const status = statusInfo(getStatus(user || {}, type));

      const row = document.createElement("div");
      row.className = "tickHoldRow";

      const label = document.createElement("span");
      label.textContent = meta.title;

      const value = document.createElement("span");
      value.className = "st " + status.cls;
      value.textContent = status.label;

      row.append(label, value);
      rows.appendChild(row);
    });

    panel.classList.add("open");
  }

  function bindLongPressOnTick(node, getUser) {
    if (!node || node.dataset.tickHoldBound) return;

    node.dataset.tickHoldBound = "1";

    let timer = null;
    let startX = 0;
    let startY = 0;
    let triggered = false;

    function cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    }

    function start(event) {
      cancel();
      triggered = false;

      const point = event.touches && event.touches[0]
        ? event.touches[0]
        : event;

      startX = point.clientX || 0;
      startY = point.clientY || 0;

      timer = setTimeout(async () => {
        timer = null;
        triggered = true;

        try {
          const user = await Promise.resolve(getUser());
          showTickHoldPanel(user || {});
        } catch (error) {
          console.warn(error);
        }
      }, 700);
    }

    function move(event) {
      const point = event.touches && event.touches[0]
        ? event.touches[0]
        : event;

      if (
        Math.abs((point.clientX || 0) - startX) > 12 ||
        Math.abs((point.clientY || 0) - startY) > 12
      ) {
        cancel();
      }
    }

    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: true });
    node.addEventListener("touchend", cancel);
    node.addEventListener("touchcancel", cancel);

    node.addEventListener("pointerdown", start);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", cancel);
    node.addEventListener("pointercancel", cancel);
    node.addEventListener("pointerleave", cancel);

    node.addEventListener("dblclick", async event => {
      event.preventDefault();

      const user = await Promise.resolve(getUser());
      showTickHoldPanel(user || {});
    });

    node.setAttribute(
      "title",
      "Hold to view badge statuses or double-click"
    );
  }

  window.VieworaVerification = {
    showTickHoldPanel,
    bindLongPressOnTick,
    tickStatusFromUser: getStatus,
    statusLabel: statusInfo,
    refresh: async function () {
      const user = getAuth() && getAuth().currentUser;
      if (!user) return;

      const data = await loadUser(user.uid);
      renderGrid(data);
    }
  };

  function init() {
    const cancelButton = $("applyCancel");
    const submitButton = $("applySubmit");
    const sheet = $("applySheet");

    if (cancelButton) {
      cancelButton.addEventListener("click", closeSheet);
    }

    if (submitButton) {
      submitButton.addEventListener("click", submitApplication);
    }

    if (sheet) {
      sheet.addEventListener("click", event => {
        if (event.target === sheet) closeSheet();
      });
    }

    const auth = getAuth();

    if (!auth) {
      renderGrid({});
      return;
    }

    auth.onAuthStateChanged(async user => {
      currentUser = user || null;

      if (!user) {
        renderGrid({});
        return;
      }

      try {
        const data = await loadUser(user.uid);
        renderGrid(data);
      } catch (error) {
        console.error("[Viewora Verification] Load failed:", error);
        renderGrid({});
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();