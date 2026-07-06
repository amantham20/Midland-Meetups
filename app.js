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
  host: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/></svg>'
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
  renderWeek();
  initModal();
  renderLore();
  initSubmitForm();
  initMemoryForm();
});
