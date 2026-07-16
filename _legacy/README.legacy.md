# Midland Meetups — Bulletin Board

A website for posting upcoming events, event updates (rain delays,
cancellations, new locations), a "Happenings This Week" snapshot with
click-to-RSVP, an event submission form, "The Lore Letter" (a memory feed
with its own submission form), "The Squad" (a member directory with
profile submissions and photos), and a live group Chat. The site itself
is static HTML/CSS/JS hosted free on GitHub Pages. All the actual data —
events, memories, squad profiles, RSVPs, chat messages — lives in a
**Google Sheet**, read and written through a **Google Apps Script**
deployed as a web app. That means everyone sees the same live data, and
you can review submissions before they go public, all editable right in
a spreadsheet.

## How the pieces fit together

```
Your Google Sheet  <---->  Apps Script Web App  <---->  This website (GitHub Pages)
  (the database)         (the API in between)          (what people see/use)
```

- **The Sheet** has seven tabs: `Events`, `Memories`, `RSVPs`, `Squad`,
  `Chat`, `Scores`, `WalterProgress`. You can look at and hand-edit any
  of it any time.
- **The Apps Script** (`apps-script/Code.gs`) is code that lives *inside*
  that Sheet (via Extensions → Apps Script) and exposes it to the website
  through a URL. It also emails you when something needs review, and
  saves Squad photos to Google Drive.
- **The website** (everything else in this folder) calls that URL to load
  content and to save RSVPs, submissions, and chat messages.

## Part 1 — Set up the Google Sheet + Apps Script

1. Go to [sheets.google.com](https://sheets.google.com) and create a new,
   blank spreadsheet. Name it something like "Midland Meetups Data."
2. In that Sheet, go to **Extensions → Apps Script**. A new tab opens with
   a code editor.
3. Delete the placeholder `function myFunction() {}` code and paste in the
   entire contents of `apps-script/Code.gs` from this folder.
4. Save the project (the disk icon, or Ctrl/Cmd+S). Name it whatever you like.
5. In the toolbar, next to the "Run" button, there's a function picker
   dropdown — select **setup** and click **Run**.
6. The first time, Google will show an authorization prompt: click
   **Review permissions**, pick your account, click **Advanced**, then
   **Go to [project name] (unsafe)**, then **Allow**. (This warning shows
   up for any script you write yourself — it's just Google being cautious
   about scripts that touch your Sheets, Drive, and Gmail.)
7. Go back to the Sheet tab — you should now see seven tabs at the bottom:
   `Events`, `Memories`, `RSVPs`, `Squad`, `Chat`, `Scores`,
   `WalterProgress`, with headers and a couple of sample rows marked
   "(sample — delete me)".
8. Back in the Apps Script editor: **Deploy → New deployment**.
9. Click the gear icon next to "Select type" and choose **Web app**.
10. Set **Execute as** to "Me" and **Who has access** to **"Anyone"** —
    this is what lets the website reach it. (It does not give anyone
    access to your Sheet itself — only to the specific actions the script
    allows.)
11. Click **Deploy**. Copy the **Web app URL** it gives you
    (looks like `https://script.google.com/macros/s/AKfycb.../exec`).

Keep that tab open — you'll need to come back and make a **new version**
any time you edit the script later (Deploy → Manage deployments → pencil
icon → New version → Deploy). Editing the code alone doesn't update the
live URL, but it *does* keep the same URL — no need to update `config.js`
again after that first time.

## Part 2 — Connect the website to it

Open `config.js` in this folder and paste your Web app URL in:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
```

That's the main thing you need to edit to wire things up. Once that's set
and the site is deployed (see below), it should be pulling live data.

## Managing content — it's all just the Sheet now

- **Events tab:** columns are `id`, `title`, `host`, `date`, `time`,
  `location`, `description`, `status`, `statusNote`, `approved`.
  - `status` is one of `confirmed`, `rain-delay`, `canceled`, `relocated`.
  - `statusNote` is the short explanation shown with the flag (e.g. "Moved
    indoors due to weather"). Leave blank for `confirmed`.
  - `approved` is a checkbox (TRUE/FALSE). Only `TRUE` rows show up on the
    site. If you type a row in yourself, set it to `TRUE`. Rows that come
    in through the "Submit an Event" form arrive as `FALSE` so you can
    review them first — flip to `TRUE` when ready to publish.
  - The home page automatically only shows events dated in the next 7
    days — no need to manage that part.
- **Memories tab:** columns are `id`, `title`, `author`, `date`, `text`,
  `approved`. Same approval pattern as Events.
- **Squad tab:** columns are `id`, `name`, `occupation`, `age`, `gender`,
  `socialLink`, `bio`, `photoUrl`, `approved`. Same approval pattern —
  profiles submitted through "Join the Squad" arrive as `FALSE` for review.
- **RSVPs tab:** one row per person per event — fills in automatically as
  people RSVP on the site. You generally won't need to touch it.
- **Scores tab:** columns are `id`, `name`, `score`, `timestamp` — powers
  the Wizards &amp; Waffles leaderboard. Only each person's *best* score is kept
  (one row per name); a new run only overwrites their row if it beats
  their previous best. No approval step, same reasoning as Chat.
- **WalterProgress tab:** columns are `name`, `password`, `progress`,
  `updatedAt` — powers Walter vs. Wizards' save system (see below).
- **Chat tab:** columns are `id`, `name`, `message`, `timestamp`. Messages
  post immediately with no approval step (a review queue would defeat the
  point of a live chat). The page polls for new messages every 8 seconds.
  Only the most recent 200 messages are sent to the site at a time (see
  `CHAT_MESSAGE_LIMIT` in `Code.gs` to change that). To remove a message,
  delete its row directly — it disappears from the site within one poll.
- **Deleting something (any tab):** just delete the row in the Sheet.

Changes to the Sheet show up on the site the next time someone loads the
page — no redeploying anything, unless you've changed the script itself.

## How RSVPs work

Clicking an event card opens a pop-up with the full details and two
buttons: **I'm going** / **Can't make it**. First time, it'll ask for a
name (remembered on that device after that). RSVPs are shared and
tallied for everyone — the card and pop-up show a live count like
"4 going · 1 can't make it."

The same pop-up has an **Add to Google Calendar** button. It's a plain
link (no API key or Google account connection involved), so it works for
anyone regardless of whether they use Gmail. Since events don't store a
duration, it defaults every event to a 2-hour block starting at the
listed time — whoever adds it can adjust that in their own calendar
after the fact. If an event's `time` value isn't in a format the site
recognizes (`6:30 PM` or `18:30` both work), it falls back to adding it
as an all-day entry instead of guessing.

There's also a dedicated **RSVPs** page — a full directory of who's going
and who's not, for every event, split into Upcoming and Past. It's built
from the same `Events` and `RSVPs` data already used elsewhere, so there
was nothing new to add on the Sheet side for this one.

## How the submission forms work

**Submit an Event**, the Lore Letter's memory form, and "Join the Squad"
all post straight to the Sheet with `approved` set to `FALSE`. Review new
rows in the Sheet, edit anything that needs cleaning up, and flip
`approved` to `TRUE` to make them public.

## How Squad photos are stored

Google Sheets isn't built to hold images, so photos work a little
differently: when someone uploads one on the "Join the Squad" form
(JPG or PNG only), the site resizes it down in the browser first (so a
big phone photo doesn't turn into a slow upload), then sends it to the
Apps Script, which saves it into a Google Drive folder called
**"Midland Meetups Squad Photos"** (created automatically the first time
it's needed) and stores just the resulting image link in the `photoUrl`
column. The Sheet itself never holds the actual image data.

That folder lives in the Drive of whoever's Google account the script is
deployed under. If you ever want to review or remove a photo directly,
you can find it there.

Photos are optional — if someone skips it, their card shows a colored
circle with their first initial instead. The social media link is
optional too.

**Worth knowing:** Age and gender submitted here are shown publicly on the
site. Make sure that's something people submitting are aware of and
comfortable with.

## Passwords

Two pages are behind a simple password, set in `config.js`:

- **Submit an Event** — `SUBMIT_PASSWORD`, currently `gatsbymethod`.
- **Chat** — `CHAT_PASSWORD`, currently `ryanisthebest`. Chat doesn't even
  start polling for messages until it's unlocked.

These are light deterrents to keep the pages from being stumbled on by
strangers browsing the site — not real security. Since this is a static
site, anyone who views the page source can see the password values. Once
someone enters the right one, that page stays unlocked for the rest of
that browser tab session. To change either, just edit the constant in
`config.js`.

## Email notifications

Every time someone submits an event, a memory, or a Squad profile, the
Apps Script emails whatever address is set as `ORGANIZER_EMAIL` near the
top of `Code.gs` (currently `Rdp4709@gmail.com`), with the submitted
details and a reminder to flip `approved` to `TRUE` once reviewed. Chat
messages don't trigger an email since they post immediately without a
review step — a notification for every message would just be noise.

To change the notification address, edit `ORGANIZER_EMAIL` in `Code.gs`
and push a new deployment version.

**One-time step:** since sending email is a new capability for the
script, Google will likely ask you to re-authorize it. In the Apps Script
editor, run any function once (e.g. `setup`) and approve the new
permission prompt *before* creating the new deployment version —
otherwise the emails may silently fail.

Gmail/Apps Script email sending has a daily quota (100/day on a regular
Gmail account), which is far more than this is likely to need.

## If a date or time looks like "1899-12-31T02:32:11.000Z"

This is a known Google Sheets quirk, not a bug in the website. Sheets
auto-detects things that look like times or dates and silently stores
them as real Date values instead of plain text — timestamped against a
placeholder date from 1899/1900. `Code.gs` converts these back to a
normal-looking date/time before sending them to the site. If you're
seeing this, you're likely running an older deployment — run `setup()`
again (safe, won't touch existing data) and push a new deployment version.

## How Wizards & Waffles works

`game.html` is a small canvas-based arcade shooter (mid-century modern
style — bold primary colors, simple flat shapes) built from scratch in
`game.js`, no external game library. You run right automatically; jump
obstacles and wizards, or throw waffles to defeat wizards outright.
Grab the motorcycle power-up for 10 seconds of invincibility, or the
jetpack to hover above ground threats and throw arcing muffins instead.
The board gets faster the longer you survive.

**Controls:** Up arrow to jump, Space to throw. On touch devices, tap the
left half of the game to jump, the right half to throw.

**This is entirely self-contained and safe to experiment with** — every
tunable number (enemy spawn rate, projectile speed, power-up duration,
wizard-to-obstacle ratio, colors, everything) lives in a `CONFIG` block
at the top of `game.js`. Changing how the game looks or plays never
touches the Apps Script backend or the Sheet; the only thing that talks
to the backend is saving a score, which is a fixed `{name, score}` shape
regardless of what the game does above it. Edit `game.js`, re-upload it,
done — no redeployment, no new Sheet columns, nothing on the backend
side to keep in sync.

The **High Scores** leaderboard sits above the game and shows the top 10
scores from the `Scores` tab, refreshing automatically every 20 seconds
and immediately after anyone saves a new score. It only keeps each
person's best run, so the board stays a clean "who's the best" list
rather than a log of every game ever played. Same name-remembering trick
as RSVPs and Chat — it'll pre-fill whatever name you've used before on
that device.

`game.js` is its own file, loaded only on `game.html`, so it doesn't add
any weight to the rest of the site.

## How Walter vs. Wizards works

A second, more complex game living on the same page as Wizards & Waffles
(both load from `game.html`), built in its own file, `walter.js`. It's a
wave-based brawler rather than an endless runner:

- **Move and fight:** arrow keys to move, Up to jump (or to climb the
  tower's ladder), Space to swing your sword or cast whatever spell is
  currently active, number keys 1–5 to switch spells once you've
  unlocked them.
- **Three connected areas, left to right:** the **Tower** (a safe hub —
  climb it to reach the **Skill Altar** at the top, with a **crystal
  chest** at its base), the **Castle Wall** (waves attack from the
  right only), and the **Fair Grounds** (waves can attack from either
  side). Walking into the Wall or Fair Grounds triggers enemy spawns;
  retreating to the Tower pauses them.
- **Enemies:** knights (melee, drop **silver**), archers (ranged), and
  wizards (ranged magic, drop **crystals**). Waves start about 90%
  knights and gradually mix in more archers and wizards as you rack up
  kills. Walter's sword one-shots any of them (30 damage vs. 22–30 HP).
- **Crystals:** carried crystals are at risk — if Walter's HP hits
  zero, he respawns at the Tower and loses whatever he was carrying but
  hadn't banked. Walking onto the chest automatically banks whatever
  you're carrying. The altar lets you spend **carried + banked
  combined** to unlock any of the five spells (fireball, lightning,
  freeze, summon ally, black hole) — your choice, not an automatic
  unlock.
- **Silver & armor:** knights drop silver instead — a separate, simpler
  currency with no carry/bank risk (it's just always safe). Spend it at
  the same altar on **Leather Armor** (5 silver, a 150-point buffer —
  1.5× Walter's 100 HP) or **Steel Armor** (10 silver, a 200-point
  buffer, 2×). Armor is consumable: incoming damage drains the armor bar
  completely before touching Walter's actual HP, and once it hits zero
  it's gone. Buying new armor replaces whatever's left of the old piece
  rather than stacking.

**Progress saves to the Sheet now** — this used to be deferred, no longer
is. There's no shared leaderboard for Walter yet, but that's the only
thing still on the "later" list.

## How Walter vs. Wizards saves progress

The first thing the game asks for is a **name and password** — a
lightweight login, not a real account system. Typing a brand-new name
auto-creates a save under that name with whatever password you typed;
typing an existing name requires the matching password to load it
(and to prevent someone else from overwriting your save by reusing your
name). There's also a **"Play without saving"** link on that screen for
anyone who just wants to try the game once.

**What's saved:** unlocked spells, armor type, silver, and *banked*
crystals. **What's not:** carried-but-unbanked crystals, kill count, and
HP — those always reset fresh each session, same as any other respawn.
A save only updates at natural checkpoints — depositing crystals at the
chest, or buying a spell or armor at the altar — not continuously, so
nothing is spammed to the Sheet on every single knight kill.

**The save format is a deliberately simple, hand-readable string** (not
JSON), stored as-is in the `progress` column of `WalterProgress`:

```
$<silver>$&<5 spell letters>&@<banked crystals>@!<armor: L/S/N>!
```

Example: `$12$&fLzsb&@5@!N!` means 12 silver, only Lightning unlocked
(the one uppercase letter — the rest are locked/lowercase), 5 banked
crystals, no armor. The five spell-letter positions are always in this
order: **F**ireball, **L**ightning, free**Z**e, **S**ummonAlly,
**B**lackHole. Freeze uses Z instead of F since fireball already claimed
F; every other spell just uses its natural first letter.

You can read or hand-edit anyone's save directly in the Sheet if you
ever need to (e.g. to grant someone a spell, or fix a mistake) — it's
plain text, no encoding beyond what's shown above.

**A technical note for future changes:** since two games now share one
page, both `game.js` and `walter.js` check that their *own* canvas is
the focused element before responding to a keypress (see
`document.activeElement !== canvas` near the top of each file's keydown
handler). If you add a third game to this page later, it'll need the
same guard, or its controls will collide with the other two.

## Adding a new page (or renaming/reordering nav links)

The nav links are shared across every page from one file: **`nav.html`**.
It's just a plain list of links — no HTML boilerplate, no header, nothing
page-specific:

```html
<a href="index.html" data-page="index">Happenings</a>
<a href="rsvps.html" data-page="rsvps">RSVPs</a>
...
```

Each page fetches this file at load time and drops it into its (otherwise
empty) `<nav id="main-nav">` element — that's the only place nav links
live. To add, rename, reorder, or remove a link, edit `nav.html` once;
every page picks up the change automatically, no need to touch the other
HTML files.

To add a brand-new page:
1. Create the new `.html` file (easiest: copy an existing simple page like
   `lore.html` and swap out the `<main>` content).
2. Give its `<body>` tag a `data-page="something"` attribute — a short
   unique key for that page (e.g. `data-page="events-archive"`).
3. Add a matching link to `nav.html`:
   `<a href="your-page.html" data-page="something">Your Page</a>`

The `data-page` value just needs to match between the page's `<body>` tag
and its link in `nav.html` — that's what tells the site which nav link to
highlight as "active" on that page. If you skip step 2, the page still
works fine, it just won't highlight anything in the nav.

**Note on local testing:** since this uses `fetch()` to load `nav.html`,
opening a page by double-clicking the file (a `file://` URL) won't load
the nav — browsers block that kind of local file fetch for security
reasons. It works fine once uploaded to GitHub Pages (or if you run a
local server, e.g. `python3 -m http.server`, and open the page through
that instead).

## Putting the website on GitHub Pages

1. Create a new repository on GitHub (public repos get free Pages hosting).
2. Upload the website files — `index.html`, `rsvps.html`, `lore.html`,
   `submit.html`, `squad.html`, `chat.html`, `game.html`, `nav.html`,
   `style.css`, `app.js`, `game.js`, `walter.js`, `config.js` (with your
   URL already pasted in). You don't need to upload the `apps-script`
   folder; that code lives in the Sheet's Apps Script editor, not on
   GitHub.
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment," set **Source** to "Deploy from a branch,"
   pick the `main` branch and the `/ (root)` folder, then **Save**.
5. GitHub will give you a URL like
   `https://yourusername.github.io/your-repo-name/` within a minute or two.

## If something's not loading

- **"This page hasn't been connected to your Google Sheet yet"** — means
  `config.js` still has the placeholder text. Paste in your real Web app URL.
- **Nothing loads / console shows a fetch error** — double check the
  deployment's "Who has access" is set to "Anyone," not "Anyone with a
  Google account." Also confirm you're using the newest deployment's URL
  after any script edits.
- **A new event/memory/profile you added directly in the Sheet isn't
  showing** — check its `approved` column is `TRUE`, and for events, that
  the date falls within the next 7 days.
- **Notification emails aren't arriving** — check spam, confirm
  `ORGANIZER_EMAIL` in `Code.gs` is correct, and make sure you
  re-authorized the script (see "Email notifications" above) after this
  feature was added.

## Customizing

- **Site name:** search for "Midland Meetups" across the HTML files.
- **Colors:** CSS variables at the top of `style.css` (`--blue`, `--red`,
  `--yellow`, `--green`, `--ink`, `--bg`).
