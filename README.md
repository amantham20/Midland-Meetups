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
| Host / author names | Taken from the signed-in account, with a “someone else is hosting” escape hatch |
| Tag a host | Pick a squad member instead of typing a name — they can then edit the event too |
| Edit your own events | Submitter and tagged host edit from `/submit` or the event dialog; admins edit any event from `/admin` → Events |
| Sign-in | Firebase Auth — Email/Password |
| Report content or a user | Firestore `reports` — a Report action on every event and Lore story, plus `/report` (web) and More → Report (iOS) |
| Admin queue | `/admin` — approve/reject + edit any event end to end, and work the report queue (bootstrap UID and/or admin claim) |
| Hide or delete content | Organizers take an event, Lore story or profile off the board for every member (`approved: false` + `hidden: true`), or delete it outright — `/admin` → Events / Lore / Reports, and the same actions on iOS |
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
ios/                   # native SwiftUI app (see §10)
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
2. Put it in `NEXT_PUBLIC_ADMIN_UIDS` **and** in the `firestore.rules` `isBootstrapAdmin()` list; redeploy rules if you change the rules file. That alone unlocks approve/reject and event status — no service account needed.
3. Optional: add `FIREBASE_SERVICE_ACCOUNT_JSON`, open `/admin` → **Request admin claim** (hits `POST /api/admin/claim`). The button only appears when the server can actually mint claims; without a service account the bootstrap list is the whole story.
4. Approve submissions on `/admin`.

The `/admin` access strip shows which of the two paths is granting you access. It turns yellow only when Firestore actually rejects a read — the usual cause is a UID present in `NEXT_PUBLIC_ADMIN_UIDS` but missing from `isBootstrapAdmin()` in the deployed rules.

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
| hostUserId | string | Auth UID of the tagged host; `""` when the name was typed in |
| date | string | `YYYY-MM-DD` |
| time | string | display time |
| status | string | `confirmed` \| `rain-delay` \| `canceled` \| `relocated` |
| statusNote | string | shown with status flags |
| approved | boolean | public only when `true` |
| hidden | boolean | `true` when an organizer took it down (always with `approved: false`) — see below |
| createdBy | string | Auth UID — also who may edit the event |
| reminderSent | boolean | set by cron after FCM send; cleared when a host moves the date/time |
| updatedAt | timestamp | stamped on every edit |

`createdBy` and `hostUserId` may edit `title`, `host`, `hostUserId`, `date`,
`time`, `location`, `description`, `status`, `statusNote` and `tags` on their
own event — rules pin every other field, so a host can't self-approve one or
take it over from the account that submitted it. Admins edit anything, on any
event, from **Admin → Events**.

### Hiding vs deleting

Organizers have two ways to take something off the board, on `events`,
`memories` and `squad` alike:

- **Hide** writes `approved: false` + `hidden: true`. That's what removes it for
  every member: the public feeds query `approved == true` and the read rule
  enforces the same condition, so a hidden document isn't merely filtered in the
  client — nobody outside the organizers and its own author can read it, in any
  audience group, on web or iOS. Reversible from **Admin → Events / Lore /
  Squad**, and the day-before reminder stops firing for a hidden event.
- **Delete** removes the document. Not reversible; RSVPs for a deleted event are
  left behind as orphans (rules only let each member delete their own).

`hidden` exists purely to separate "an organizer pulled this" from "nobody has
reviewed this yet" — without it, hiding would drop the item back into the review
queue looking like a fresh submission. Nothing queries on it; it drives labels
and filters only. Only admins can write it (`hostEditableKeysOnly()` leaves it
out for events, and a memory's author may only touch `author`).

### `memories/{id}`

`title`, `author`, `date`, `text`, `approved`, `hidden`, `createdBy`

### `squad/{id}`

`name`, `occupation`, `age`, `gender`, `socialLink`, `bio`, `photoBase64`, `photoMimeType`, `photoUrl` (legacy/empty), `approved`, `hidden`, `createdBy`

Photos are **not** in Cloud Storage. The browser compresses to ~320px JPEG and stores base64 on the document. Client caches (memory + `sessionStorage` + Firestore persistent cache) avoid rebuilding/re-fetching on every visit.

### `rsvps/{userId}_{eventId}`

`eventId`, `userId`, `name`, `status` (`going` \| `not-going`), `updatedAt`

`name` is always the account's own name — there's no alias to pick when you RSVP.

### `reports/{id}`

| Field | Type | Notes |
|-------|------|--------|
| targetType | string | `event` \| `memory` \| `member` \| `other` (`other` = the general form) |
| targetId | string | document id of the reported content; `""` for a general report |
| targetLabel | string | title/name captured when filed, so the queue still reads after a delete |
| reason | string | `harassment`, `hate`, `sexual`, `violence`, `spam`, `impersonation`, `illegal`, `other` |
| details | string | free text, capped at 2,000 characters by the rules |
| reportedBy | string | Auth UID, pinned to `request.auth.uid` by the rules |
| reporterEmail, reporterName | string | so an organizer can follow up |
| status | string | `open` \| `reviewed` — creates are pinned to `open` |
| createdAt | timestamp | |

Write-only for members: reporting needs an account so the collection isn't an
open write endpoint, and **only admins can read** — a reporter can't read back
even their own report. Admins mark a report reviewed, hide or delete what it
points at, or dismiss it; hiding is the usual first move, since it takes the
content off the board for everyone while leaving the evidence in place. The
published fallback is the address in the Terms.

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

A spreadsheet export and import script live under **`conversions/`**:

```bash
python3 conversions/import_to_firestore.py --dry-run
python3 conversions/import_to_firestore.py   # needs FIREBASE_SERVICE_ACCOUNT_JSON
```

See [`conversions/README.md`](conversions/README.md). New RSVPs still need real Firebase accounts; imported legacy RSVPs use synthetic `legacy_*` user ids.

## 9. Local development without Firebase

If env keys are missing, pages show a **Connect Firebase** notice instead of crashing.

---

## 10. Native iOS app

`ios/` is a native SwiftUI app for the same Firestore project — not a web view. It
shares no code with the Next.js app; the domain types, audience rules, and date
helpers are ported to Swift, and the design tokens from `globals.css` are ported to
`ios/MidlandMeetups/Design/Theme.swift`.

**Why REST instead of the Firebase iOS SDK.** That SDK needs a
`GoogleService-Info.plist` from an *iOS* app registered in the Firebase console;
this project only has web credentials. Firebase's REST APIs accept exactly those —
the web API key for signed-out reads, a Firebase ID token for everything else — and
Firestore evaluates the same `firestore.rules` either way. No third-party
dependencies, no CocoaPods, no SwiftPM.

### Build & run

```bash
./ios/Scripts/generate-firebase-config.sh
```

That reads `.env.local` (it finds the main checkout automatically when you're in a
git worktree) and writes `ios/MidlandMeetups/Config/Firebase.plist`, which is
gitignored just like `.env.local`. Without it the app shows the same **Connect
Firebase** notice the web app does. Then open `ios/MidlandMeetups.xcodeproj` and run,
or from the command line:

```bash
xcodebuild -project ios/MidlandMeetups.xcodeproj -scheme MidlandMeetups -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

### What's there

| Web page | iOS |
|----------|-----|
| `/` Happenings | Happenings tab — next 7 days, status ticker, event detail with RSVP and (for the host) Edit |
| `/rsvps` | RSVPs tab — upcoming / past, going and can't-make-it lists |
| `/lore` | Lore tab — archive + submit a memory |
| `/squad` | Squad tab — member grid, join/edit your profile with a photo picker |
| `/submit` | More → Submit an Event, your own submissions with Edit, and the **+** on Happenings |
| `/login` | More → Sign in (Identity Toolkit REST; session in the keychain) |
| `/admin` | More → Admin queue — approvals, full edit on any event, hide/delete on events and Lore stories, audience groups, reports |
| `/report` | More → Report content or a user, plus a Report action on every event and Lore story |
| Game link | More → Game (opens in the browser) |

Native additions: **Add to Calendar** writes straight into the user's calendar via
EventKit (write-only permission — it never reads existing events), dark mode, and
pull-to-refresh.

### Differences from the web app

- **No realtime.** Firestore's live channel is gRPC-only, so `onSnapshot` becomes a
  refresh on appear, on pull-to-refresh, on foreground, and immediately after the
  app's own writes.
- **No push notifications.** The web build's FCM/`fcmTokens` flow would need an APNs
  key and an iOS app registered in Firebase; the daily reminder cron still runs
  server-side and emails/pushes on the web as before.
- **Admin email → uid linking is web-only.** That path calls a `firebase-admin`
  Next.js route, and the app has no server. Squad ownership in `firestore.rules` is
  matched by email, so admin editing works regardless.

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
