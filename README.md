# The Midland Mixer — Bulletin Board

A website for posting upcoming events, event updates (rain delays,
cancellations, new locations), a "Happenings This Week" snapshot with
click-to-RSVP, an event submission form, and "The Lore Letter" — a feed of
memories from past events, with its own submission form. The site itself
is static HTML/CSS/JS hosted free on GitHub Pages. All the actual data —
events, memories, submissions, RSVPs — lives in a **Google Sheet**, read
and written through a **Google Apps Script** deployed as a web app. That
means everyone sees the same live data: shared RSVP counts, submissions
you can review before they go public, all editable right in a spreadsheet.

## How the pieces fit together

```
Your Google Sheet  <---->  Apps Script Web App  <---->  This website (GitHub Pages)
  (the database)         (the API in between)          (what people see/use)
```

- **The Sheet** has three tabs: `Events`, `Memories`, `RSVPs`. You can look
  at and hand-edit any of it any time.
- **The Apps Script** (`apps-script/Code.gs`) is code that lives *inside*
  that Sheet (via Extensions → Apps Script) and exposes it to the website
  through a URL.
- **The website** (everything else in this folder) calls that URL to load
  events/memories and to save RSVPs and new submissions.

## Part 1 — Set up the Google Sheet + Apps Script

1. Go to [sheets.google.com](https://sheets.google.com) and create a new,
   blank spreadsheet. Name it something like "Midland Mixer Data."
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
   about scripts that touch your Sheets.)
7. Go back to the Sheet tab — you should now see three tabs at the bottom:
   `Events`, `Memories`, `RSVPs`, with headers and a couple of sample rows
   marked "(sample — delete me)".
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
live URL.

## Part 2 — Connect the website to it

Open `config.js` in this folder and paste your Web app URL in:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
```

That's the only file you need to edit to wire things up. Once that's set
and the site is deployed (see Part 3), it should be pulling live data.

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
- **RSVPs tab:** one row per person per event — this fills in automatically
  as people RSVP on the site. You generally won't need to touch it, though
  you're welcome to look at who's going to what.
- **Deleting something:** just delete the row in the Sheet.

Changes to the Sheet show up on the site the next time someone loads the
page — no redeploying anything.

## How RSVPs work

Clicking an event card opens a pop-up with the full details and two
buttons: **I'm going** / **Can't make it**. First time, it'll ask for a
name (remembered on that device after that). RSVPs are shared and
tallied for everyone — the card and pop-up show a live count like
"4 going · 1 can't make it."

## How the submission forms work

Both **Submit an Event** and the Lore Letter's memory form post straight
to the Sheet with `approved` set to `FALSE`. Review new rows in the Sheet,
edit anything that needs cleaning up, and flip `approved` to `TRUE` to
make them public.

## Putting the website on GitHub Pages

1. Create a new repository on GitHub (public repos get free Pages hosting).
2. Upload the website files — `index.html`, `lore.html`, `submit.html`,
   `style.css`, `app.js`, `config.js` (with your URL already pasted in).
   You don't need to upload the `apps-script` folder; that code lives in
   the Sheet's Apps Script editor, not on GitHub.
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
- **A new event/memory you added directly in the Sheet isn't showing** —
  check its `approved` column is `TRUE`, and for events, that the date
  falls within the next 7 days.

## Customizing

- **Site name:** search for "The Midland Mixer" across the HTML files.
- **Colors:** CSS variables at the top of `style.css` (`--blue`, `--red`,
  `--yellow`, `--green`, `--ink`, `--bg`).
