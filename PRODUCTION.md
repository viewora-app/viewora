# Viewora — Security / Rate-limit / Production (95%)

## 1. Client security module

Include on **every page** after `firebase.js`:

```html
<script src="firebase.js"></script>
<script src="security.js"></script>
```

### API (`window.VieworaSecurity` / `VS`)

| Method | Use |
|--------|-----|
| `VS.guard('like', async () => { ... })` | Rate-limit + auth + offline + try/catch |
| `VS.checkAction('message', uid)` | Client bucket check |
| `VS.escapeHtml(str)` | XSS-safe text |
| `VS.sanitizeUrl(url)` | Block `javascript:` |
| `VS.safeComment(text)` | Strip tags + clamp |
| `VS.isBlockedEither(me, other)` | Block gate for chat/call |
| `VS.waitForAuth()` | Auth ready |
| `VS.toast(msg, 'error')` | Shared toast |
| `VS.isOnline()` | Connectivity |

### Example — safe like

```js
await VieworaSecurity.guard("like", async (user) => {
  // your existing like toggle
});
```

### Example — safe message send

```js
const check = VieworaSecurity.checkAction("message", uid);
if (!check.allowed) {
  VieworaSecurity.toast(check.message, "error");
  return;
}
const payload = VieworaSecurity.safeMessagePayload({ text, type: "text" });
```

---

## 2. Client rate limits (defaults)

| Action | Max | Window |
|--------|-----|--------|
| like | 8 | 12s |
| comment | 6 | 20s |
| message | 12 | 15s |
| follow | 10 | 30s |
| report | 5 | 60s |
| upload | 5 | 60s |
| call | 4 | 60s |
| withdraw | 2 | 5 min |

---

## 3. Server rate limits (Cloud Functions)

```js
const check = firebase.functions().httpsCallable("checkActionRate");
const res = await check({ action: "message" });
if (!res.data.allowed) alert(res.data.message);
```

Also:

- `checkLikeRate`
- `checkAccountStatus` → banned / suspended

---

## 4. Database rules (already in `database.rules.json`)

- Default deny
- Owner-only writes for profile / content
- Admin-only: ticks, monetizationEnabled, reports queue
- Withdrawals: user create pending only; admin status change
- Earnings: owner read; credit via **admin function** preferred

Deploy:

```bash
firebase deploy --only database,functions
```

Admin node:

```
admins/
  <YOUR_UID>: true
```

---

## 5. Production checklist

- [ ] `database.rules.json` deployed (not open rules)
- [ ] Cloud Functions deployed + Razorpay keys set
- [ ] `admins/{uid}=true` for team only
- [ ] HTTPS only (GitHub Pages OK)
- [ ] Mic/Camera permissions tested on real devices
- [ ] `security.js` on index, chat, messages, shorts, posts, profile, call, upload, monetization
- [ ] Custom claim or admin flag never exposed to free client writes for ticks
- [ ] Offline UI message (optional banner)
- [ ] Error monitoring (optional: Sentry)

---

## 6. Quick page snippet

```html
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js"></script>
<script src="firebase.js"></script>
<script src="security.js"></script>
<script src="theme.js"></script>
<script src="nav.js"></script>
<!-- page script -->
```

---

## 7. Ban / suspend (admin)

Realtime Database:

```
users/{uid}/banned: true
users/{uid}/banReason: "Spam"
```

Client pages can call `checkAccountStatus` on load and redirect if banned.
'''
