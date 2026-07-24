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
  host: string;
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
