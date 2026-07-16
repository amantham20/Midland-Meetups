import type { MeetupEvent } from "./types";

export function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function isWithinNextWeek(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekOut = new Date(today);
  weekOut.setDate(weekOut.getDate() + 7);
  const d = new Date(iso + "T00:00:00");
  return d >= today && d <= weekOut;
}

export function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseTimeToHM(timeStr: string): { h: number; m: number } | null {
  const str = String(timeStr).trim();
  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return { h, m };
  }
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return { h: parseInt(match24[1], 10), m: parseInt(match24[2], 10) };
  }
  return null;
}

/** Google Calendar template link — no API key required. Default duration 2 hours. */
export function buildGoogleCalendarUrl(evt: MeetupEvent): string {
  const DEFAULT_DURATION_MINUTES = 120;
  const hm = parseTimeToHM(evt.time);

  function stampFor(totalMinutesFromStartOfDay: number): string {
    const dayOffset = Math.floor(totalMinutesFromStartOfDay / (24 * 60));
    const minutesInDay =
      ((totalMinutesFromStartOfDay % (24 * 60)) + 24 * 60) % (24 * 60);
    const hh = String(Math.floor(minutesInDay / 60)).padStart(2, "0");
    const mm = String(minutesInDay % 60).padStart(2, "0");
    const d = new Date(evt.date + "T00:00:00");
    d.setDate(d.getDate() + dayOffset);
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${MM}${DD}T${hh}${mm}00`;
  }

  let dates: string;
  if (hm) {
    const startMinutes = hm.h * 60 + hm.m;
    dates = `${stampFor(startMinutes)}/${stampFor(startMinutes + DEFAULT_DURATION_MINUTES)}`;
  } else {
    const dateDigits = String(evt.date).replace(/-/g, "");
    dates = `${dateDigits}/${dateDigits}`;
  }

  const details =
    evt.description + (evt.statusNote ? "\n\nUpdate: " + evt.statusNote : "");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: evt.title,
    dates,
    details,
    location: evt.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function formatTimeDisplay(time: string): string {
  const hm = parseTimeToHM(time);
  if (!hm) return time;
  const period = hm.h >= 12 ? "PM" : "AM";
  const h12 = hm.h % 12 || 12;
  return `${h12}:${String(hm.m).padStart(2, "0")} ${period}`;
}

/**
 * Resize/compress an image in the browser for storage as base64 on the squad doc.
 * Defaults keep payloads small (Firestore 1MB doc limit; we aim for ~20–80KB).
 */
export function resizeImageToBase64(
  file: File,
  maxDim = 320,
  quality = 0.72,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read that image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1] || "";
        if (!base64) {
          reject(new Error("Could not compress image."));
          return;
        }
        // Soft guard: keep under ~250KB base64 (~188KB binary) for Firestore comfort
        if (base64.length > 250_000) {
          reject(
            new Error(
              "That photo is still too large after compression. Try a smaller image.",
            ),
          );
          return;
        }
        resolve({ base64, mimeType: "image/jpeg" });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function isAdminUid(uid: string | null | undefined): boolean {
  if (!uid) return false;
  const raw = process.env.NEXT_PUBLIC_ADMIN_UIDS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(uid);
}

export function initials(name: string): string {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}
