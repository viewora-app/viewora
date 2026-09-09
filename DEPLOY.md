# Viewora — Deploy Security + Functions

## 1. Firebase Database Rules
```bash
# From project root (where firebase.json is)
firebase deploy --only database
```
File: `database.rules.json`

## 2. Cloud Functions
```bash
cd functions
npm install
# Set Razorpay (optional if already set)
firebase functions:config:set razorpay.key_id="rzp_xxx" razorpay.key_secret="xxx"
firebase deploy --only functions
```

### Functions exported
| Name | Purpose |
|------|---------|
| `createSubscriptionOrder` | Razorpay order |
| `verifySubscriptionPayment` | Verify + activate sub + ticks |
| `requestAccountDeletion` | User delete request |
| `approveAccountDeletion` | Admin permanent purge + Auth delete |
| `deleteMyAccount` | Self hard-delete (confirm: "DELETE") |
| `checkLikeRate` | Server like spam guard |
| `cleanupExpiredStories` | Hourly story TTL cleanup |
| `ping` | Health check |

### Admin flag
In Realtime Database set:
```
admins/<your-uid>: true
```

## 3. Client notes
- After reading a chat, `userChats/{me}/{chatId}.unread` is set to 0 (all aliases).
- Home message badge only sums positive unread counters.
- Video call camera flip uses `replaceTrack` so remote video should not pause.

## 4. Still manual
- Enable Blaze plan for scheduled functions + outbound Razorpay
- Storage rules (if using Firebase Storage)
- FCM push (future)