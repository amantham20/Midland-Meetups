export type EventStatus = "confirmed" | "rain-delay" | "canceled" | "relocated";

export type RsvpStatus = "going" | "not-going";

/**
 * Audience group (tag). Admins map emails → groups.
 * Events with `tags` only show to signed-in users whose email is listed
 * on at least one of those groups (admins always see everything).
 * Empty `tags` on an event = public (everyone).
 */
export interface AudienceGroup {
  id: string;
  name: string;
  /** Stable lowercase slug used on events.tags */
  slug: string;
  /** Lowercased emails of people in this group */
  emails: string[];
}

export interface MeetupEvent {
  id: string;
  title: string;
  /** Display name of the host, tagged member or free text. */
  host: string;
  /**
   * Auth uid of the tagged host, when the host is a member rather than a
   * typed-in name. A tagged host can edit the event like its submitter.
   */
  hostUserId?: string;
  date: string; // YYYY-MM-DD
  time: string; // display time, e.g. "6:30 PM" or "18:30"
  location: string;
  description: string;
  status: EventStatus;
  statusNote: string;
  approved: boolean;
  /** Audience group slugs. Empty/undefined = everyone. */
  tags: string[];
  createdBy?: string;
  createdAt?: string;
  reminderSent?: boolean;
}

/** A member you can tag as host: an approved squad profile with an Auth account. */
export interface HostCandidate {
  userId: string;
  name: string;
}

export interface Memory {
  id: string;
  title: string;
  author: string;
  date: string;
  text: string;
  approved: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface SquadMember {
  id: string;
  name: string;
  occupation: string;
  age: string;
  gender: string;
  socialLink: string;
  bio: string;
  /** Sign-in email — primary key for “your profile” matching */
  email: string;
  /**
   * Firebase Auth uid stamped when email is set / profile is claimed.
   * Matching for edit uses email; userId is written alongside.
   */
  userId?: string;
  /** Compressed JPEG/PNG base64 (no data: prefix). Preferred over Storage. */
  photoBase64: string;
  photoMimeType: string;
  /** Optional external URL (legacy); base64 takes precedence when present. */
  photoUrl: string;
  approved: boolean;
  /** @deprecated Prefer userId — kept for older docs */
  createdBy?: string;
  createdAt?: string;
}

export interface Rsvp {
  id: string;
  eventId: string;
  userId: string;
  name: string;
  status: RsvpStatus;
  updatedAt: string;
}

export interface FcmToken {
  token: string;
  userId: string;
  updatedAt: string;
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  confirmed: "Confirmed",
  "rain-delay": "Rain delay",
  canceled: "Canceled",
  relocated: "Relocated",
};

/**
 * What a report points at. `member` covers both a squad profile and the person
 * behind it — reporting someone and reporting their profile is one action here.
 * `other` is the catch-all filed from the standalone report form, where there is
 * no single document to attach to.
 */
export type ReportTargetType = "event" | "memory" | "member" | "other";

export type ReportStatus = "open" | "reviewed";

export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech or discrimination" },
  { value: "sexual", label: "Sexual or explicit content" },
  { value: "violence", label: "Violence or threats" },
  { value: "spam", label: "Spam or a scam" },
  { value: "impersonation", label: "Impersonation or a fake profile" },
  { value: "illegal", label: "Illegal or dangerous activity" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export function reportReasonLabel(value: string): string {
  return REPORT_REASONS.find((r) => r.value === value)?.label || value;
}

/** The collection a report's target lives in, when it has one. */
export const REPORT_TARGET_COLLECTION: Record<
  ReportTargetType,
  "events" | "memories" | "squad" | null
> = {
  event: "events",
  memory: "memories",
  member: "squad",
  other: null,
};

export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
  event: "Event",
  memory: "Lore story",
  member: "Member",
  other: "General",
};

export interface Report {
  id: string;
  targetType: ReportTargetType;
  /** Document id of the reported content; "" for a general report. */
  targetId: string;
  /** Title / name captured when filed, so the queue reads even after a delete. */
  targetLabel: string;
  reason: string;
  details: string;
  reportedBy: string;
  reporterEmail: string;
  reporterName: string;
  status: ReportStatus;
  createdAt: string;
}
