/* =====================================================================
   THE MIDLAND MIXER — render logic
   Talks to the Google Apps Script web app defined in config.js.
   You shouldn't need to edit this file.
   ===================================================================== */

const STATUS_LABEL = {
  "confirmed": "On as planned",
  "rain-delay": "Rain delay",
  "canceled": "Canceled",
  "relocated": "New location"
};

const NAME_KEY = "midland-mixer-name";

let EVENTS_CACHE = [];
let RSVPS_CACHE = [];

/* ---------------- Shared nav partial ---------------- */
// Fetches nav.html (the single list of nav links) and drops it into the
// empty <nav id="main-nav"> that's already in each page's markup, so
// adding/renaming a page only means editing nav.html — not every page.
async function loadNav(){
  const nav = document.getElementById("main-nav");
  if (!nav) return;

  try{
    const res = await fetch("nav.html");
    if (!res.ok) throw new Error("nav.html fetch failed: " + res.status);
    nav.innerHTML = await res.text();
  }catch(err){
    console.error("Could not load navigation links:", err);
    // The header shell (logo + toggle button) still shows fine — just no links.
  }

  const currentPage = document.body.dataset.page;
  if (currentPage){
    const link = nav.querySelector(`a[data-page="${currentPage}"]`);
    if (link) link.classList.add("active");
  }

  initNavToggle();
}

/* ---------------- Mobile nav toggle ---------------- */
function initNavToggle(){
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("main-nav");
  if (!toggle || !nav) return;

  function closeNav(){
    nav.classList.remove("open");
    toggle.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Tapping a link closes the menu, so it doesn't stay open on the next page.
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", closeNav));

  // Avoid a stuck-open menu if the viewport grows past the mobile breakpoint
  // (e.g. rotating a tablet, or resizing a browser window).
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeNav();
  });
}

/* ---------------- API ---------------- */
function isConfigured() {
  return typeof APPS_SCRIPT_URL === "string" &&
    APPS_SCRIPT_URL.startsWith("http") &&
    !APPS_SCRIPT_URL.includes("PASTE_YOUR_WEB_APP_URL_HERE");
}

async function apiGet(action, params = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Request failed: " + res.status);
  return res.json();
}

async function apiPost(payload) {
  // text/plain avoids a CORS preflight that Apps Script doesn't handle well.
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Request failed: " + res.status);
  return res.json();
}

/* ---------------- helpers ---------------- */
function formatDateShort(iso){
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatDateLong(iso){
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function escapeHTML(str){
  const div = document.createElement("div");
  div.textContent = String(str == null ? "" : str);
  return div.innerHTML;
}
function isWithinNextWeek(iso){
  const today = new Date();
  today.setHours(0,0,0,0);
  const weekOut = new Date(today);
  weekOut.setDate(weekOut.getDate() + 7);
  const d = new Date(iso + "T00:00:00");
  return d >= today && d <= weekOut;
}

// Parses either "9:00 PM" (12-hour) or "21:00" (24-hour, from <input type="time">)
// into 24-hour { h, m }. Returns null if it doesn't recognize the format.
function parseTimeToHM(timeStr){
  if (!timeStr) return null;
  const str = String(timeStr).trim();

  let m = str.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (m){
    let h = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return { h, m: parseInt(m[2], 10) };
  }

  m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m){
    return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
  }

  return null;
}

// Builds a Google Calendar "quick add" link — no API key or auth needed.
// Since events don't store a duration, this defaults every event to a
// 2-hour block starting at its listed time (editable by whoever adds it).
function buildGoogleCalendarUrl(evt){
  const DEFAULT_DURATION_MINUTES = 120;
  const hm = parseTimeToHM(evt.time);

  function stampFor(totalMinutesFromStartOfDay){
    const dayOffset = Math.floor(totalMinutesFromStartOfDay / (24 * 60));
    const minutesInDay = ((totalMinutesFromStartOfDay % (24 * 60)) + 24 * 60) % (24 * 60);
    const hh = String(Math.floor(minutesInDay / 60)).padStart(2, "0");
    const mm = String(minutesInDay % 60).padStart(2, "0");
    const d = new Date(evt.date + "T00:00:00");
    d.setDate(d.getDate() + dayOffset);
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${MM}${DD}T${hh}${mm}00`;
  }

  let datesParam;
  if (hm){
    const startMinutes = hm.h * 60 + hm.m;
    datesParam = `${stampFor(startMinutes)}/${stampFor(startMinutes + DEFAULT_DURATION_MINUTES)}`;
  }else{
    // Couldn't parse a time — fall back to a simple all-day entry.
    const dateDigits = String(evt.date).replace(/-/g, "");
    datesParam = `${dateDigits}/${dateDigits}`;
  }

  const details = evt.description + (evt.statusNote ? "\n\nUpdate: " + evt.statusNote : "");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: evt.title,
    dates: datesParam,
    details: details,
    location: evt.location,
    ctz: "America/Detroit"
  });

  return "https://www.google.com/calendar/render?" + params.toString();
}
function getStoredName(){
  return localStorage.getItem(NAME_KEY) || "";
}
function setStoredName(name){
  localStorage.setItem(NAME_KEY, name);
}

const ICONS = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6.5-7-11.5A7 7 0 0 1 19 9.5C19 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg>',
  host: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>'
};

function configNotice(where){
  return `<div class="empty-note">This page hasn't been connected to your Google Sheet yet.
    Open <code>config.js</code> and paste in your deployed Apps Script Web App URL.
    ${where ? `See the README for the "${where}" setup steps.` : ""}</div>`;
}
function loadErrorNotice(){
  return `<div class="empty-note">Couldn't load data from the Sheet right now. Check your internet
    connection, or that the Apps Script deployment in config.js is still active, then refresh.</div>`;
}

/* ---------------- Home page: this week's events ---------------- */
async function renderWeek(){
  const grid = document.getElementById("grid");
  if (!grid) return;

  if (!isConfigured()){
    grid.innerHTML = configNotice("Install the backend");
    return;
  }

  try{
    const [events, rsvps] = await Promise.all([
      apiGet("getEvents"),
      apiGet("getRsvps")
    ]);
    EVENTS_CACHE = events;
    RSVPS_CACHE = rsvps;
  }catch(err){
    console.error(err);
    grid.innerHTML = loadErrorNotice();
    return;
  }

  renderTicker();

  const upcoming = EVENTS_CACHE
    .filter(evt => isWithinNextWeek(evt.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (upcoming.length === 0){
    grid.innerHTML = `<div class="empty-note">Nothing on the books in the next seven days.
      <a href="submit.html">Submit an event</a> to get something on the board.</div>`;
    return;
  }

  const myName = getStoredName().toLowerCase().trim();

  grid.innerHTML = upcoming.map(evt => {
    const mine = myName
      ? RSVPS_CACHE.find(r => r.eventId === evt.id && String(r.name).toLowerCase().trim() === myName)
      : null;
    const goingCount = RSVPS_CACHE.filter(r => r.eventId === evt.id && r.status === "going").length;

    return `
    <button class="card" type="button" data-event-id="${escapeHTML(evt.id)}" aria-haspopup="dialog">
      <div class="card-top">
        <h3>${escapeHTML(evt.title)}</h3>
        ${evt.status !== "confirmed" ? `<span class="pill ${evt.status}">${STATUS_LABEL[evt.status] || evt.status}</span>` : ""}
      </div>
      <div class="card-meta">
        <span>${ICONS.calendar} ${formatDateShort(evt.date)}</span>
        <span>${ICONS.clock} ${escapeHTML(evt.time)}</span>
      </div>
      <div class="card-meta">
        <span>${ICONS.pin} ${escapeHTML(evt.location)}</span>
      </div>
      <p class="desc">${escapeHTML(evt.description)}</p>
      <div class="card-foot">
        <span>Hosted by ${escapeHTML(evt.host)}</span>
        <span class="rsvp-tag" style="${mine ? `color:${mine.status === "going" ? "var(--green)" : "var(--muted)"}` : ""}">
          ${mine ? (mine.status === "going" ? "✓ You're going" : "Not going") : (goingCount > 0 ? `${goingCount} going` : "Tap for details")}
        </span>
      </div>
    </button>
  `;
  }).join("");

  grid.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => openModal(card.dataset.eventId));
  });
}

/* ---------------- Ticker (updates banner) ---------------- */
function renderTicker(){
  const wrap = document.getElementById("ticker-wrap");
  const track = document.getElementById("ticker-track");
  if (!wrap || !track) return;

  const updates = EVENTS_CACHE.filter(evt => evt.status !== "confirmed" && isWithinNextWeek(evt.date));

  if (updates.length === 0){
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "";

  const items = updates.map(evt =>
    `<span><b>${(STATUS_LABEL[evt.status] || evt.status).toUpperCase()}</b> — ${escapeHTML(evt.title)}: ${escapeHTML(evt.statusNote || "details on the card below")}</span>`
  );

  track.innerHTML = items.join("") + items.join("");
}

/* ---------------- Modal ---------------- */
function tallyFor(eventId){
  const rows = RSVPS_CACHE.filter(r => r.eventId === eventId);
  const going = rows.filter(r => r.status === "going").length;
  const notGoing = rows.filter(r => r.status === "not-going").length;
  return { going, notGoing };
}

function openModal(eventId){
  const evt = EVENTS_CACHE.find(e => e.id === eventId);
  if (!evt) return;

  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal");
  const myName = getStoredName();
  const mine = myName
    ? RSVPS_CACHE.find(r => r.eventId === eventId && String(r.name).toLowerCase().trim() === myName.toLowerCase().trim())
    : null;
  const tally = tallyFor(eventId);

  modal.className = `modal status-${evt.status}`;
  modal.innerHTML = `
    <button class="modal-close" id="modal-close" aria-label="Close">&times;</button>
    ${evt.status !== "confirmed" ? `<span class="pill ${evt.status}">${STATUS_LABEL[evt.status] || evt.status}</span>` : ""}
    <h2>${escapeHTML(evt.title)}</h2>
    <div class="modal-meta">
      <div class="row">${ICONS.calendar} <span><b>${formatDateLong(evt.date)}</b></span></div>
      <div class="row">${ICONS.clock} <span>${escapeHTML(evt.time)}</span></div>
      <div class="row">${ICONS.pin} <span>${escapeHTML(evt.location)}</span></div>
      <div class="row">${ICONS.host} <span>Hosted by ${escapeHTML(evt.host)}</span></div>
    </div>
    ${evt.statusNote ? `<p class="status-note">${escapeHTML(evt.statusNote)}</p>` : ""}
    <p class="modal-desc">${escapeHTML(evt.description)}</p>
    <a class="btn light block" href="${escapeHTML(buildGoogleCalendarUrl(evt))}" target="_blank" rel="noopener noreferrer">${ICONS.calendar} Add to Google Calendar</a>
    <div class="rsvp-block">
      <div class="rsvp-label">Are you going?</div>
      <div class="form-row" style="margin-bottom:10px;">
        <input type="text" id="rsvp-name" placeholder="Your name" value="${escapeHTML(myName)}">
      </div>
      <div class="rsvp-buttons">
        <button class="rsvp-btn going ${mine && mine.status === "going" ? "selected" : ""}" data-value="going">I'm going</button>
        <button class="rsvp-btn not-going ${mine && mine.status === "not-going" ? "selected" : ""}" data-value="not-going">Can't make it</button>
      </div>
      <div class="rsvp-confirm" id="rsvp-confirm">${tally.going > 0 || tally.notGoing > 0 ? `${tally.going} going · ${tally.notGoing} can't make it` : "Be the first to say you're in."}</div>
    </div>
  `;

  modal.querySelectorAll(".rsvp-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nameInput = modal.querySelector("#rsvp-name");
      const name = nameInput.value.trim();
      if (!name){
        nameInput.focus();
        nameInput.style.borderColor = "var(--red)";
        document.getElementById("rsvp-confirm").textContent = "Add your name first.";
        return;
      }
      setStoredName(name);

      const value = btn.dataset.value;
      const current = mine && mine.status;
      const next = current === value ? null : value;

      modal.querySelectorAll(".rsvp-btn").forEach(b => b.disabled = true);
      document.getElementById("rsvp-confirm").textContent = "Saving…";

      try{
        await apiPost({ action: "setRsvp", eventId, name, status: next });
        // refresh local cache
        RSVPS_CACHE = RSVPS_CACHE.filter(r => !(r.eventId === eventId && String(r.name).toLowerCase().trim() === name.toLowerCase().trim()));
        if (next) RSVPS_CACHE.push({ eventId, name, status: next, timestamp: new Date().toISOString() });
        openModal(eventId);
        renderCardsOnly();
      }catch(err){
        console.error(err);
        document.getElementById("rsvp-confirm").textContent = "Couldn't save that — check your connection and try again.";
        modal.querySelectorAll(".rsvp-btn").forEach(b => b.disabled = false);
      }
    });
  });

  modal.querySelector("#modal-close").addEventListener("click", closeModal);

  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(){
  const overlay = document.getElementById("modal-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function initModal(){
  const overlay = document.getElementById("modal-overlay");
  if (!overlay) return;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

// Re-render just the card grid from cached data (no re-fetch) after an RSVP change.
function renderCardsOnly(){
  const grid = document.getElementById("grid");
  if (!grid) return;
  const upcoming = EVENTS_CACHE
    .filter(evt => isWithinNextWeek(evt.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const myName = getStoredName().toLowerCase().trim();

  grid.innerHTML = upcoming.map(evt => {
    const mine = myName
      ? RSVPS_CACHE.find(r => r.eventId === evt.id && String(r.name).toLowerCase().trim() === myName)
      : null;
    const goingCount = RSVPS_CACHE.filter(r => r.eventId === evt.id && r.status === "going").length;
    return `
    <button class="card" type="button" data-event-id="${escapeHTML(evt.id)}" aria-haspopup="dialog">
      <div class="card-top">
        <h3>${escapeHTML(evt.title)}</h3>
        ${evt.status !== "confirmed" ? `<span class="pill ${evt.status}">${STATUS_LABEL[evt.status] || evt.status}</span>` : ""}
      </div>
      <div class="card-meta">
        <span>${ICONS.calendar} ${formatDateShort(evt.date)}</span>
        <span>${ICONS.clock} ${escapeHTML(evt.time)}</span>
      </div>
      <div class="card-meta">
        <span>${ICONS.pin} ${escapeHTML(evt.location)}</span>
      </div>
      <p class="desc">${escapeHTML(evt.description)}</p>
      <div class="card-foot">
        <span>Hosted by ${escapeHTML(evt.host)}</span>
        <span class="rsvp-tag" style="${mine ? `color:${mine.status === "going" ? "var(--green)" : "var(--muted)"}` : ""}">
          ${mine ? (mine.status === "going" ? "✓ You're going" : "Not going") : (goingCount > 0 ? `${goingCount} going` : "Tap for details")}
        </span>
      </div>
    </button>`;
  }).join("");

  grid.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => openModal(card.dataset.eventId));
  });
}

/* ---------------- RSVPs directory page ---------------- */
function rsvpNamesListHTML(names, emptyLabel){
  if (names.length === 0){
    return `<ul class="rsvp-names empty"><li>${escapeHTML(emptyLabel)}</li></ul>`;
  }
  return `<ul class="rsvp-names">${names.map(n => `<li>${escapeHTML(n)}</li>`).join("")}</ul>`;
}

function eventRsvpCardHTML(evt, rsvps){
  const rows = rsvps.filter(r => r.eventId === evt.id);
  const going = rows.filter(r => r.status === "going").map(r => r.name);
  const notGoing = rows.filter(r => r.status === "not-going").map(r => r.name);

  return `
    <div class="rsvp-event-card">
      <div class="rsvp-event-head">
        <div>
          <h3>${escapeHTML(evt.title)}</h3>
          <div class="card-meta">
            <span>${ICONS.calendar} ${formatDateShort(evt.date)}</span>
            <span>${ICONS.clock} ${escapeHTML(evt.time)}</span>
          </div>
        </div>
        ${evt.status !== "confirmed" ? `<span class="pill ${evt.status}">${STATUS_LABEL[evt.status] || evt.status}</span>` : ""}
      </div>
      <div class="rsvp-columns">
        <div class="rsvp-column going">
          <h4>Going (${going.length})</h4>
          ${rsvpNamesListHTML(going, "No one yet")}
        </div>
        <div class="rsvp-column not-going">
          <h4>Can't make it (${notGoing.length})</h4>
          ${rsvpNamesListHTML(notGoing, "No one yet")}
        </div>
      </div>
    </div>
  `;
}

async function renderRsvpsPage(){
  const container = document.getElementById("rsvps-list");
  if (!container) return;

  if (!isConfigured()){
    container.innerHTML = configNotice("Install the backend");
    return;
  }

  let events, rsvps;
  try{
    [events, rsvps] = await Promise.all([apiGet("getEvents"), apiGet("getRsvps")]);
  }catch(err){
    console.error(err);
    container.innerHTML = loadErrorNotice();
    return;
  }

  if (events.length === 0){
    container.innerHTML = '<p class="empty-note">No events yet.</p>';
    return;
  }

  const todayStr = (() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();

  const upcoming = events.filter(e => String(e.date) >= todayStr).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const past = events.filter(e => String(e.date) < todayStr).sort((a,b) => String(b.date).localeCompare(String(a.date)));

  let html = "";
  html += `<h2 class="rsvp-section-title">Upcoming</h2>`;
  html += upcoming.length
    ? upcoming.map(evt => eventRsvpCardHTML(evt, rsvps)).join("")
    : '<p class="empty-note">Nothing upcoming.</p>';

  if (past.length){
    html += `<h2 class="rsvp-section-title">Past</h2>`;
    html += past.map(evt => eventRsvpCardHTML(evt, rsvps)).join("");
  }

  container.innerHTML = html;
}

/* ---------------- Lore Letter ---------------- */
async function renderLore(){
  const feed = document.getElementById("lore-feed");
  if (!feed) return;

  if (!isConfigured()){
    feed.innerHTML = configNotice("Install the backend");
    return;
  }

  let entries;
  try{
    entries = await apiGet("getMemories");
  }catch(err){
    console.error(err);
    feed.innerHTML = loadErrorNotice();
    return;
  }

  entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  if (entries.length === 0){
    feed.innerHTML = '<p class="empty-note">No memories posted yet. Be the first!</p>';
    return;
  }

  feed.innerHTML = entries.map(mem => `
    <article class="entry">
      <div class="entry-head">
        <span class="entry-title">${escapeHTML(mem.title)}</span>
        <span class="entry-meta">${escapeHTML(mem.author)} · ${formatDateShort(mem.date)}</span>
      </div>
      <p class="entry-body">${escapeHTML(mem.text)}</p>
    </article>
  `).join("");
}

/* ---------------- The Squad ---------------- */
async function renderSquad(){
  const grid = document.getElementById("squad-grid");
  if (!grid) return;

  if (!isConfigured()){
    grid.innerHTML = configNotice("Install the backend");
    return;
  }

  let members;
  try{
    members = await apiGet("getSquad");
  }catch(err){
    console.error(err);
    grid.innerHTML = loadErrorNotice();
    return;
  }

  if (members.length === 0){
    grid.innerHTML = '<p class="empty-note">No profiles yet — be the first to join the squad below.</p>';
    return;
  }

  grid.innerHTML = members.map(m => {
    const initial = String(m.name || "?").trim().charAt(0).toUpperCase();
    const photo = m.photoUrl
      ? `<img class="member-photo" src="${escapeHTML(m.photoUrl)}" alt="${escapeHTML(m.name)}" loading="lazy">`
      : `<div class="member-photo member-photo-fallback">${escapeHTML(initial)}</div>`;
    const social = m.socialLink
      ? `<a class="member-social" href="${escapeHTML(m.socialLink)}" target="_blank" rel="noopener noreferrer">${ICONS.link} Follow</a>`
      : "";
    const submeta = [m.age, m.gender].filter(Boolean).map(escapeHTML).join(" · ");

    return `
      <article class="member-card">
        ${photo}
        <h3>${escapeHTML(m.name)}</h3>
        <div class="member-occupation">${escapeHTML(m.occupation)}</div>
        ${submeta ? `<div class="member-submeta">${submeta}</div>` : ""}
        <p class="member-bio">${escapeHTML(m.bio)}</p>
        ${social}
      </article>
    `;
  }).join("");
}

// Resizes/compresses an image file in the browser before sending it up,
// so a big phone photo doesn't turn into a huge upload.
function resizeImageFile(file, maxDim){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read that image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim){
          if (width > height){ height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function initSquadForm(){
  const form = document.getElementById("squad-form");
  if (!form) return;
  const statusEl = document.getElementById("squad-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isConfigured()){
      statusEl.textContent = "This form isn't connected to a Google Sheet yet — see config.js.";
      statusEl.style.color = "var(--red)";
      return;
    }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    statusEl.textContent = "Sending…";
    statusEl.style.color = "var(--muted)";

    try{
      const payload = {
        action: "submitSquadMember",
        name: form.name.value.trim(),
        occupation: form.occupation.value.trim(),
        age: form.age.value.trim(),
        gender: form.gender.value.trim(),
        socialLink: form.socialLink.value.trim(),
        bio: form.bio.value.trim()
      };

      const file = form.photo && form.photo.files && form.photo.files[0];
      if (file){
        if (file.type !== "image/jpeg" && file.type !== "image/png"){
          statusEl.textContent = "That photo needs to be a JPG or PNG — try a different file.";
          statusEl.style.color = "var(--red)";
          btn.disabled = false;
          return;
        }
        statusEl.textContent = "Preparing photo…";
        const { base64, mimeType } = await resizeImageFile(file, 640);
        payload.photoBase64 = base64;
        payload.photoMimeType = mimeType;
        statusEl.textContent = "Sending…";
      }

      await apiPost(payload);
      form.reset();
      statusEl.textContent = "Sent! Your profile is in for review and will show up once approved.";
      statusEl.style.color = "var(--green)";
    }catch(err){
      console.error(err);
      statusEl.textContent = "Something went wrong sending that. Check your connection and try again.";
      statusEl.style.color = "var(--red)";
    }finally{
      btn.disabled = false;
    }
  });
}

/* ---------------- Chat ---------------- */
let CHAT_POLL_TIMER = null;
const CHAT_NAME_COLORS = ["#2851E3", "#E5484D", "#B8860B", "#12B76A", "#8B5CF6", "#DB2777"];

function chatColorFor(name){
  let hash = 0;
  const str = String(name || "");
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return CHAT_NAME_COLORS[Math.abs(hash) % CHAT_NAME_COLORS.length];
}

function formatChatTime(iso){
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

async function renderChat(isPoll){
  const win = document.getElementById("chat-window");
  if (!win) return;

  if (!isConfigured()){
    win.innerHTML = configNotice("Install the backend");
    return;
  }

  const wasNearBottom = win.scrollHeight - win.scrollTop - win.clientHeight < 60;

  let messages;
  try{
    messages = await apiGet("getChat");
  }catch(err){
    console.error(err);
    if (!isPoll) win.innerHTML = loadErrorNotice();
    return;
  }

  if (messages.length === 0){
    win.innerHTML = '<p class="empty-note">No messages yet — say hi below.</p>';
    return;
  }

  win.innerHTML = messages.map(m => `
    <div class="chat-message">
      <div class="chat-head">
        <span class="chat-name" style="color:${chatColorFor(m.name)}">${escapeHTML(m.name)}</span>
        <span class="chat-time">${formatChatTime(m.timestamp)}</span>
      </div>
      <div class="chat-bubble">${escapeHTML(m.message)}</div>
    </div>
  `).join("");

  if (!isPoll || wasNearBottom){
    win.scrollTop = win.scrollHeight;
  }
}

function initChat(){
  const win = document.getElementById("chat-window");
  if (!win) return;
  renderChat(false);
  CHAT_POLL_TIMER = setInterval(() => renderChat(true), 8000);
  window.addEventListener("beforeunload", () => clearInterval(CHAT_POLL_TIMER));
}

function initChatForm(){
  const form = document.getElementById("chat-form");
  if (!form) return;

  const storedName = getStoredName();
  if (storedName) form.name.value = storedName;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isConfigured()){
      return;
    }

    const name = form.name.value.trim();
    const message = form.message.value.trim();
    if (!name || !message) return;

    setStoredName(name);

    const btn = form.querySelector("button[type=submit]");
    const msgInput = form.message;
    btn.disabled = true;
    msgInput.disabled = true;

    try{
      await apiPost({ action: "postChatMessage", name, message });
      msgInput.value = "";
      await renderChat(false);
    }catch(err){
      console.error(err);
    }finally{
      btn.disabled = false;
      msgInput.disabled = false;
      msgInput.focus();
    }
  });
}

/* ---------------- Password gates (Submit an Event, Chat) ---------------- */
const GATE_KEY = "midland-meetups-submit-unlocked";
const CHAT_GATE_KEY = "midland-meetups-chat-unlocked";

// Generic gate: shows a password box, hides `contentId` until the right
// password is entered (or it was already unlocked earlier this tab session).
function createPasswordGate(opts){
  const { gateId, contentId, password, storageKey, inputId, buttonId, statusId, onUnlock } = opts;
  const gate = document.getElementById(gateId);
  const content = document.getElementById(contentId);
  if (!gate || !content) return;

  function unlock(){
    gate.style.display = "none";
    content.style.display = "";
    if (typeof onUnlock === "function") onUnlock();
  }

  if (sessionStorage.getItem(storageKey) === "true"){
    unlock();
    return;
  }

  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  const status = document.getElementById(statusId);

  function tryUnlock(){
    const value = input.value;
    if (typeof password === "string" && value === password){
      sessionStorage.setItem(storageKey, "true");
      unlock();
    }else{
      status.textContent = "That's not it — try again.";
      status.style.color = "var(--red)";
      input.value = "";
      input.focus();
    }
  }

  button.addEventListener("click", tryUnlock);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter"){ e.preventDefault(); tryUnlock(); }
  });
}

function initGate(){
  createPasswordGate({
    gateId: "gate",
    contentId: "submit-form",
    password: typeof SUBMIT_PASSWORD === "string" ? SUBMIT_PASSWORD : null,
    storageKey: GATE_KEY,
    inputId: "gate-password",
    buttonId: "gate-submit",
    statusId: "gate-status"
  });
}

function initChatGate(){
  createPasswordGate({
    gateId: "chat-gate",
    contentId: "chat-content",
    password: typeof CHAT_PASSWORD === "string" ? CHAT_PASSWORD : null,
    storageKey: CHAT_GATE_KEY,
    inputId: "chat-gate-password",
    buttonId: "chat-gate-submit",
    statusId: "chat-gate-status",
    onUnlock: () => { initChat(); initChatForm(); }
  });
}

/* ---------------- Submit Event form ---------------- */
function initSubmitForm(){
  const form = document.getElementById("submit-form");
  if (!form) return;
  const statusEl = document.getElementById("submit-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isConfigured()){
      statusEl.textContent = "This form isn't connected to a Google Sheet yet — see config.js.";
      statusEl.style.color = "var(--red)";
      return;
    }

    const payload = {
      action: "submitEvent",
      title: form.title.value.trim(),
      host: form.host.value.trim(),
      date: form.date.value,
      time: form.time.value,
      location: form.location.value.trim(),
      description: form.description.value.trim()
    };

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    statusEl.textContent = "Sending…";
    statusEl.style.color = "var(--muted)";

    try{
      await apiPost(payload);
      form.reset();
      statusEl.textContent = "Sent! Your event is in for review and will show up once approved.";
      statusEl.style.color = "var(--green)";
    }catch(err){
      console.error(err);
      statusEl.textContent = "Something went wrong sending that. Check your connection and try again.";
      statusEl.style.color = "var(--red)";
    }finally{
      btn.disabled = false;
    }
  });
}

/* ---------------- Submit Memory form (Lore Letter) ---------------- */
function initMemoryForm(){
  const form = document.getElementById("memory-form");
  if (!form) return;
  const statusEl = document.getElementById("memory-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isConfigured()){
      statusEl.textContent = "This form isn't connected to a Google Sheet yet — see config.js.";
      statusEl.style.color = "var(--red)";
      return;
    }

    const payload = {
      action: "submitMemory",
      title: form.title.value.trim(),
      author: form.author.value.trim(),
      text: form.text.value.trim()
    };

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    statusEl.textContent = "Sending…";
    statusEl.style.color = "var(--muted)";

    try{
      await apiPost(payload);
      form.reset();
      statusEl.textContent = "Sent! It'll show up here once approved.";
      statusEl.style.color = "var(--green)";
    }catch(err){
      console.error(err);
      statusEl.textContent = "Something went wrong sending that. Check your connection and try again.";
      statusEl.style.color = "var(--red)";
    }finally{
      btn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadNav();
  renderWeek();
  initModal();
  renderLore();
  renderSquad();
  renderRsvpsPage();
  initChatGate();
  initGate();
  initSubmitForm();
  initMemoryForm();
  initSquadForm();
});
