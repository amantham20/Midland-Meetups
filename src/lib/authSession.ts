/** Sliding session length: stay signed in for 100 days of activity. */
export const AUTH_SESSION_DAYS = 100;
export const AUTH_SESSION_MS = AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000;

const ACTIVITY_KEY = "mm-auth-last-activity";
const STARTED_KEY = "mm-auth-session-started";

function now() {
  return Date.now();
}

export function touchAuthSession() {
  if (typeof window === "undefined") return;
  try {
    const t = String(now());
    localStorage.setItem(ACTIVITY_KEY, t);
    if (!localStorage.getItem(STARTED_KEY)) {
      localStorage.setItem(STARTED_KEY, t);
    }
  } catch {
    // private mode
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem(STARTED_KEY);
  } catch {
    // ignore
  }
}

/** True if last activity is within AUTH_SESSION_DAYS. */
export function isAuthSessionValid(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) {
      // First load after deploy: start a fresh window rather than kicking everyone out
      touchAuthSession();
      return true;
    }
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return now() - last < AUTH_SESSION_MS;
  } catch {
    return true;
  }
}
