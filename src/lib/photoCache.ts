/**
 * In-memory + sessionStorage cache for squad base64 photos.
 * Avoids rebuilding data URLs and re-decoding the same payload on every render
 * or navigation within the tab session.
 */

const memorySrc = new Map<string, string>();
const SESSION_PREFIX = "mm-photo:";
const SESSION_LIST_KEY = "mm-squad-list-v1";
const LIST_TTL_MS = 15 * 60 * 1000; // 15 minutes — reduce Firestore re-reads on revisit

export function photoFingerprint(
  id: string,
  photoBase64?: string,
  photoUrl?: string,
): string {
  if (photoBase64) {
    // id + length + head/tail is enough to detect changes without hashing the whole string
    const head = photoBase64.slice(0, 24);
    const tail = photoBase64.slice(-16);
    return `${id}:${photoBase64.length}:${head}:${tail}`;
  }
  if (photoUrl) return `${id}:url:${photoUrl.slice(0, 64)}`;
  return `${id}:none`;
}

/** Resolve a stable src for <img>. Cached by fingerprint so identical base64 is free. */
export function getCachedPhotoSrc(input: {
  id: string;
  photoBase64?: string;
  photoMimeType?: string;
  photoUrl?: string;
}): string | null {
  const { id, photoBase64, photoMimeType, photoUrl } = input;
  const key = photoFingerprint(id, photoBase64, photoUrl);

  const hit = memorySrc.get(key);
  if (hit) return hit;

  if (typeof window !== "undefined") {
    try {
      const fromSession = sessionStorage.getItem(SESSION_PREFIX + key);
      if (fromSession) {
        memorySrc.set(key, fromSession);
        return fromSession;
      }
    } catch {
      // private mode / quota — ignore
    }
  }

  let src: string | null = null;
  if (photoBase64) {
    const mime = photoMimeType || "image/jpeg";
    // strip accidental data-URL prefix if a client stored the full string
    const raw = photoBase64.includes(",")
      ? photoBase64.split(",")[1]!
      : photoBase64;
    src = `data:${mime};base64,${raw}`;
  } else if (photoUrl) {
    src = photoUrl;
  }

  if (!src) return null;

  memorySrc.set(key, src);
  if (typeof window !== "undefined") {
    try {
      // sessionStorage is best-effort; skip if the string is huge (quota)
      if (src.length < 400_000) {
        sessionStorage.setItem(SESSION_PREFIX + key, src);
      }
    } catch {
      // ignore quota errors
    }
  }
  return src;
}

export function membersContentKey(
  members: { id: string; photoBase64?: string; photoUrl?: string; name: string; approved: boolean }[],
): string {
  return members
    .map(
      (m) =>
        `${m.id}|${m.name}|${m.approved}|${photoFingerprint(m.id, m.photoBase64, m.photoUrl)}`,
    )
    .join(";");
}

/** Short-lived list cache so remounting /squad doesn't re-apply the same payload. */
export function readSquadListCache<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_LIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: T };
    if (Date.now() - parsed.at > LIST_TTL_MS) {
      sessionStorage.removeItem(SESSION_LIST_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeSquadListCache<T>(data: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      SESSION_LIST_KEY,
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {
    // ignore
  }
}
