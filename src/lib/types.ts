export type EventStatus = "confirmed" | "rain-delay" | "canceled" | "relocated";

export type RsvpStatus = "going" | "not-going";

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
  /** Compressed JPEG/PNG base64 (no data: prefix). Preferred over Storage. */
  photoBase64: string;
  photoMimeType: string;
  /** Optional external URL (legacy); base64 takes precedence when present. */
  photoUrl: string;
  approved: boolean;
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
