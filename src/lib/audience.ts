import type { AudienceGroup, MeetupEvent } from "./types";

export function normalizeEmail(email: string | null | undefined): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[\n,;]+/)) {
    const e = normalizeEmail(part);
    if (e && e.includes("@")) seen.add(e);
  }
  return Array.from(seen).sort();
}

export function slugifyGroupName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "group";
}

/** Groups that include this email. */
export function groupsForEmail(
  groups: AudienceGroup[],
  email: string | null | undefined,
): AudienceGroup[] {
  const e = normalizeEmail(email);
  if (!e) return [];
  return groups.filter((g) => g.emails.includes(e));
}

/** Whether a signed-in user (or guest) may see this event. */
export function canViewEvent(
  event: MeetupEvent,
  opts: {
    userEmail?: string | null;
    isAdmin?: boolean;
    groups: AudienceGroup[];
  },
): boolean {
  const tags = event.tags || [];
  if (tags.length === 0) return true; // public
  if (opts.isAdmin) return true;
  const email = normalizeEmail(opts.userEmail);
  if (!email) return false;
  return tags.some((slug) => {
    const g = opts.groups.find((x) => x.slug === slug || x.id === slug);
    return Boolean(g?.emails.includes(email));
  });
}

export function filterEventsForViewer(
  events: MeetupEvent[],
  opts: {
    userEmail?: string | null;
    isAdmin?: boolean;
    groups: AudienceGroup[];
  },
): MeetupEvent[] {
  return events.filter((e) => canViewEvent(e, opts));
}

export function groupNameMap(groups: AudienceGroup[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const g of groups) {
    m[g.slug] = g.name;
    m[g.id] = g.name;
  }
  return m;
}
