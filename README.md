# Midland Meetups (PWA rewrite)

Progressive Web App rewrite of the Midland Meetups bulletin board.

**Stack:** Next.js (App Router) · React · Tailwind CSS · Firebase Auth · Cloud Firestore · FCM · Next.js Route Handlers (admin claim + reminders) · `@ducanh2912/next-pwa`  
**No Firebase Cloud Functions / Blaze plan required.**

**Removed from the legacy site:** live Chat, Game / Wizards & Waffles / Walter. The old static site is preserved under `_legacy/` for reference.

---

## What ships in this rewrite

| Feature | Implementation |
|--------|----------------|
| Happenings (next 7 days) | Firestore `events` + live `onSnapshot` |
| Event status ticker | Same events feed (`rain-delay` / `canceled` / `relocated`) |
| RSVP + directory | Firestore `rsvps` (one doc per user × event) |
| The Lore Letter | Firestore `memories` + submission form |
| The Squad | Firestore `squad` + inline compressed base64 photos (no Storage) |
| Submit an Event | Auth-gated form (replaces plaintext `SUBMIT_PASSWORD`) |
| Sign-in | Firebase Auth — Email/Password |
| Admin queue | `/admin` — approve/reject + event status (bootstrap UID and/or admin claim) |
| PWA install | Web App Manifest + service worker via next-pwa |
| Event reminders | FCM tokens + Next.js `/api/cron/reminders` (Vercel Cron or any external cron) |
| Admin claim | Next.js `/api/admin/claim` (optional; bootstrap UIDs already in rules) |

---

## Project layout

```
src/
  app/                 # App Router pages + api/ routes
  components/          # UI
  contexts/            # AuthProvider
  lib/firebase/        # client + admin SDK helpers
  lib/server/          # reminder job logic
  lib/types.ts
  lib/utils.ts
functions/             # DEPRECATED (was Cloud Functions; needs Blaze)
firestore.rules
storage.rules
public/manifest.json
public/firebase-messaging-sw.js
vercel.json            # optional daily cron for reminders
_legacy/               # previous HTML/JS/CSS site
```

---

## 1. Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. Enable **Authentication** → Sign-in methods:
   - Email/Password
3. Create a **Firestore** database (production mode is fine; rules deploy next).
4. **Storage is optional** — squad photos are compressed base64 on Firestore (no Storage uploads).
5. (Optional but needed for reminders) Enable **Cloud Messaging** and generate a **Web Push certificate** (VAPID key).
6. Project settings → **Your apps** → Web → register app → copy the config object.

## 2. Configure the web app

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=   # optional
NEXT_PUBLIC_FIREBASE_VAPID_KEY=        # Web Push cert key
NEXT_PUBLIC_ADMIN_UIDS=                # your Firebase Auth UIDs (nav + bootstrap)
```

**Server-only** (for Next.js API routes — not required just to browse/submit):

```env
# Firebase Console → Project settings → Service accounts → Generate new private key
# Paste the whole JSON as a single line string:
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Protects GET/POST /api/cron/reminders
CRON_SECRET=some-long-random-string
```

> Firestore rules treat listed **bootstrap UIDs** and users with the **`admin` custom claim** as admins. Put your UID in both `NEXT_PUBLIC_ADMIN_UIDS` and `firestore.rules` `isBootstrapAdmin()` (already done for the first organizer).

Also paste the same Firebase web config into `public/firebase-messaging-sw.js` for background push.

## 3. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4. Deploy Firebase rules & indexes (no Cloud Functions)

```bash
npm install -g firebase-tools
firebase login
firebase use midland-25cd2

firebase deploy --only firestore:rules,firestore:indexes
```

Do **not** run `firebase deploy --only functions` — that needs the Blaze plan. Those jobs live in Next.js instead.

### Grant yourself admin

1. Sign in once and copy your UID (Auth console or `/admin`).
2. Put it in `NEXT_PUBLIC_ADMIN_UIDS` and in `firestore.rules` bootstrap list; redeploy rules if you change the rules file.
3. Optional: add `FIREBASE_SERVICE_ACCOUNT_JSON`, open `/admin` → **Request admin claim** (hits `POST /api/admin/claim`).
4. Approve submissions on `/admin`.

You can always flip `approved: true` in the Firestore console.

## 4b. Event reminders (optional)

Route: **`/api/cron/reminders`** (replaces the old scheduled Cloud Function).

1. Set `FIREBASE_SERVICE_ACCOUNT_JSON` and `CRON_SECRET` on the host (e.g. Vercel).
2. Schedule a daily call ~9:00 America/Detroit:
   - **Vercel:** `vercel.json` already has a cron at `0 14 * * *` UTC (≈ 9am EST). Vercel Cron sends the request; set `CRON_SECRET` and either pass it as `Authorization: Bearer …` via a proxy, or use an external cron with the secret.
   - **Any free cron** (cron-job.org, etc.):
     ```bash
     curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.example/api/cron/reminders
     ```

FCM still needs a VAPID key and users who enabled reminders in the app.

## 5. Firestore data model

### `events/{id}`

| Field | Type | Notes |
|-------|------|--------|
| title, host, location, description | string | |
| date | string | `YYYY-MM-DD` |
| time | string | display time |
| status | string | `confirmed` \| `rain-delay` \| `canceled` \| `relocated` |
| statusNote | string | shown with status flags |
| approved | boolean | public only when `true` |
| createdBy | string | Auth UID |
| reminderSent | boolean | set by cron after FCM send |

### `memories/{id}`

`title`, `author`, `date`, `text`, `approved`, `createdBy`

### `squad/{id}`

`name`, `occupation`, `age`, `gender`, `socialLink`, `bio`, `photoBase64`, `photoMimeType`, `photoUrl` (legacy/empty), `approved`, `createdBy`

Photos are **not** in Cloud Storage. The browser compresses to ~320px JPEG and stores base64 on the document. Client caches (memory + `sessionStorage` + Firestore persistent cache) avoid rebuilding/re-fetching on every visit.

### `rsvps/{userId}_{eventId}`

`eventId`, `userId`, `name`, `status` (`going` \| `not-going`), `updatedAt`

### `fcmTokens/{token}`

`token`, `userId`, `updatedAt`

**Not present:** `chat`, `scores`, `walterProgress` — intentionally dropped.

## 6. PWA

- Manifest: `public/manifest.json`
- Service worker generated by `@ducanh2912/next-pwa` on **production** builds (`npm run build`)
- Offline document fallback: `/offline`
- Install from mobile browser “Add to Home Screen” after deploy over HTTPS

## 7. Hosting the Next.js app

GitHub Pages is static-only and is **not** a good fit for this Next.js app anymore.

Recommended:

- **Firebase App Hosting** or **Cloud Run / Hosting + SSR**
- **Vercel** (drop-in for Next.js)
- Any Node host that runs `next start`

```bash
npm run build
npm start
```

Point the host env vars at the same `.env` values.

## 8. Migration from Google Sheets

The Apps Script / Sheet stack in `_legacy/` is no longer used by the app.

Spreadsheet export lives under **`conversions/`**. **No service account required** for the usual path:

1. `firebase deploy --only firestore:rules`
2. Sign in as bootstrap admin → **`/admin` → Import spreadsheet seed**

That loads `public/seed/midland.json` through your browser session. See [`conversions/README.md`](conversions/README.md).

## 9. Local development without Firebase

If env keys are missing, pages show a **Connect Firebase** notice instead of crashing.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next dev server |
| `npm run build` | Production build (+ PWA assets) |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

---

## Design tokens

Ported from the legacy `style.css` into Tailwind theme tokens in `src/app/globals.css`:

`--bg`, `--surface`, `--ink`, `--muted`, `--blue`, `--red`, `--yellow`, `--green`, Space Grotesk / Inter / JetBrains Mono.
