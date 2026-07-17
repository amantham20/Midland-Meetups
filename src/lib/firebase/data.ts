"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "./client";
import type {
  AudienceGroup,
  MeetupEvent,
  Memory,
  Rsvp,
  RsvpStatus,
  SquadMember,
  EventStatus,
} from "../types";
import { membersContentKey, writeSquadListCache } from "../photoCache";
import { normalizeEmail, slugifyGroupName } from "../audience";

function mapTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t).trim()).filter(Boolean);
}

function mapEvent(id: string, data: Record<string, unknown>): MeetupEvent {
  return {
    id,
    title: String(data.title ?? ""),
    host: String(data.host ?? ""),
    date: String(data.date ?? ""),
    time: String(data.time ?? ""),
    location: String(data.location ?? ""),
    description: String(data.description ?? ""),
    status: (data.status as EventStatus) || "confirmed",
    statusNote: String(data.statusNote ?? ""),
    approved: Boolean(data.approved),
    tags: mapTags(data.tags),
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    createdAt: data.createdAt
      ? String((data.createdAt as { toDate?: () => Date }).toDate?.() ?? data.createdAt)
      : undefined,
    reminderSent: Boolean(data.reminderSent),
  };
}

function mapMemory(id: string, data: Record<string, unknown>): Memory {
  return {
    id,
    title: String(data.title ?? ""),
    author: String(data.author ?? ""),
    date: String(data.date ?? ""),
    text: String(data.text ?? ""),
    approved: Boolean(data.approved),
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

function mapSquad(id: string, data: Record<string, unknown>): SquadMember {
  return {
    id,
    name: String(data.name ?? ""),
    occupation: String(data.occupation ?? ""),
    age: String(data.age ?? ""),
    gender: String(data.gender ?? ""),
    socialLink: String(data.socialLink ?? ""),
    bio: String(data.bio ?? ""),
    email: normalizeEmail(String(data.email ?? "")),
    photoBase64: String(data.photoBase64 ?? ""),
    photoMimeType: String(data.photoMimeType ?? "image/jpeg"),
    photoUrl: String(data.photoUrl ?? ""),
    approved: Boolean(data.approved),
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

function mapGroup(id: string, data: Record<string, unknown>): AudienceGroup {
  const emailsRaw = Array.isArray(data.emails) ? data.emails : [];
  return {
    id,
    name: String(data.name ?? id),
    slug: String(data.slug ?? id),
    emails: emailsRaw
      .map((e) => normalizeEmail(String(e)))
      .filter((e) => e.includes("@")),
  };
}

function mapRsvp(id: string, data: Record<string, unknown>): Rsvp {
  return {
    id,
    eventId: String(data.eventId ?? ""),
    userId: String(data.userId ?? ""),
    name: String(data.name ?? ""),
    status: data.status as RsvpStatus,
    updatedAt: data.updatedAt
      ? String((data.updatedAt as { toDate?: () => Date }).toDate?.() ?? data.updatedAt)
      : "",
  };
}

/** Public feed: approved events only. */
export function subscribeApprovedEvents(
  onData: (events: MeetupEvent[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), "events"),
    where("approved", "==", true),
    orderBy("date", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapEvent(d.id, d.data())));
    },
    (err) => onError?.(err),
  );
}

export function subscribeRsvps(
  onData: (rsvps: Rsvp[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getClientDb(), "rsvps"),
    (snap) => {
      onData(snap.docs.map((d) => mapRsvp(d.id, d.data())));
    },
    (err) => onError?.(err),
  );
}

export function subscribeApprovedMemories(
  onData: (memories: Memory[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), "memories"),
    where("approved", "==", true),
    orderBy("date", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapMemory(d.id, d.data())));
    },
    (err) => onError?.(err),
  );
}

export function subscribeApprovedSquad(
  onData: (members: SquadMember[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), "squad"),
    where("approved", "==", true),
  );
  // Skip React updates when snapshot content is identical (incl. same base64)
  let lastKey = "";
  return onSnapshot(
    q,
    { includeMetadataChanges: false },
    (snap) => {
      // Prefer cache / local when available; still accept server to stay fresh
      const members = snap.docs.map((d) => mapSquad(d.id, d.data()));
      const key = membersContentKey(members);
      if (key === lastKey) return;
      lastKey = key;
      writeSquadListCache(members);
      onData(members);
    },
    (err) => onError?.(err),
  );
}

export async function submitEvent(input: {
  title: string;
  host: string;
  date: string;
  time: string;
  location: string;
  description: string;
  userId: string;
  tags?: string[];
}): Promise<void> {
  await addDoc(collection(getClientDb(), "events"), {
    title: input.title,
    host: input.host,
    date: input.date,
    time: input.time,
    location: input.location,
    description: input.description,
    status: "confirmed",
    statusNote: "",
    approved: false,
    reminderSent: false,
    tags: input.tags || [],
    createdBy: input.userId,
    createdAt: serverTimestamp(),
  });
}

export async function submitMemory(input: {
  title: string;
  author: string;
  text: string;
  userId: string;
}): Promise<void> {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await addDoc(collection(getClientDb(), "memories"), {
    title: input.title,
    author: input.author,
    text: input.text,
    date,
    approved: false,
    createdBy: input.userId,
    createdAt: serverTimestamp(),
  });
}

export async function submitSquadMember(input: {
  name: string;
  occupation: string;
  age: string;
  gender: string;
  socialLink: string;
  bio: string;
  email?: string;
  photoBase64: string;
  photoMimeType: string;
  userId: string;
}): Promise<void> {
  await addDoc(collection(getClientDb(), "squad"), {
    name: input.name,
    occupation: input.occupation,
    age: input.age,
    gender: input.gender,
    socialLink: input.socialLink,
    bio: input.bio,
    email: normalizeEmail(input.email || ""),
    // Stored inline — no Cloud Storage. Compressed client-side before write.
    photoBase64: input.photoBase64,
    photoMimeType: input.photoMimeType || "image/jpeg",
    photoUrl: "",
    approved: false,
    createdBy: input.userId,
    createdAt: serverTimestamp(),
  });
}

/** One RSVP doc per user per event: rsvps/{userId}_{eventId} */
export async function setRsvp(input: {
  eventId: string;
  userId: string;
  name: string;
  status: RsvpStatus | null;
}): Promise<void> {
  const id = `${input.userId}_${input.eventId}`;
  const docRef = doc(getClientDb(), "rsvps", id);
  if (!input.status) {
    await deleteDoc(docRef);
    return;
  }
  await setDoc(docRef, {
    eventId: input.eventId,
    userId: input.userId,
    name: input.name,
    status: input.status,
    updatedAt: serverTimestamp(),
  });
}

export async function saveFcmToken(
  userId: string,
  token: string,
): Promise<void> {
  await setDoc(
    doc(getClientDb(), "fcmTokens", token),
    {
      token,
      userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function approveDocument(
  collectionName: "events" | "memories" | "squad",
  id: string,
): Promise<void> {
  await updateDoc(doc(getClientDb(), collectionName, id), { approved: true });
}

/** Reject a pending submission by deleting the document (admin only). */
export async function rejectDocument(
  collectionName: "events" | "memories" | "squad",
  id: string,
): Promise<void> {
  await deleteDoc(doc(getClientDb(), collectionName, id));
}

/** Organizer updates for the public status ticker. */
export async function updateEventStatus(
  eventId: string,
  status: EventStatus,
  statusNote: string,
): Promise<void> {
  await updateDoc(doc(getClientDb(), "events", eventId), {
    status,
    statusNote: statusNote.trim(),
  });
}

export async function updateEventTags(
  eventId: string,
  tags: string[],
): Promise<void> {
  await updateDoc(doc(getClientDb(), "events", eventId), {
    tags: tags.map((t) => String(t).trim()).filter(Boolean),
  });
}

export async function updateSquadEmail(
  memberId: string,
  email: string,
): Promise<void> {
  await updateDoc(doc(getClientDb(), "squad", memberId), {
    email: normalizeEmail(email),
  });
}

export type SquadProfileFields = {
  name: string;
  occupation: string;
  age: string;
  gender: string;
  socialLink: string;
  bio: string;
  email: string;
  photoBase64?: string;
  photoMimeType?: string;
};

/** Owner or email-matched user updates their profile (and claims createdBy). */
export async function updateMySquadProfile(
  memberId: string,
  userId: string,
  fields: SquadProfileFields,
): Promise<void> {
  const payload: Record<string, unknown> = {
    name: fields.name.trim(),
    occupation: fields.occupation.trim(),
    age: String(fields.age).trim(),
    gender: fields.gender.trim(),
    socialLink: fields.socialLink.trim(),
    bio: fields.bio.trim(),
    email: normalizeEmail(fields.email),
    createdBy: userId,
    updatedAt: serverTimestamp(),
  };
  if (fields.photoBase64) {
    payload.photoBase64 = fields.photoBase64;
    payload.photoMimeType = fields.photoMimeType || "image/jpeg";
  }
  await updateDoc(doc(getClientDb(), "squad", memberId), payload);
}

/** Admin full edit of any squad member (can also set approved). */
export async function adminUpdateSquadMember(
  memberId: string,
  fields: SquadProfileFields & { approved?: boolean },
): Promise<void> {
  const payload: Record<string, unknown> = {
    name: fields.name.trim(),
    occupation: fields.occupation.trim(),
    age: String(fields.age).trim(),
    gender: fields.gender.trim(),
    socialLink: fields.socialLink.trim(),
    bio: fields.bio.trim(),
    email: normalizeEmail(fields.email),
    updatedAt: serverTimestamp(),
  };
  if (typeof fields.approved === "boolean") {
    payload.approved = fields.approved;
  }
  if (fields.photoBase64) {
    payload.photoBase64 = fields.photoBase64;
    payload.photoMimeType = fields.photoMimeType || "image/jpeg";
  }
  await updateDoc(doc(getClientDb(), "squad", memberId), payload);
}

/**
 * Find a profile this user can edit: own createdBy, or email match
 * (includes unapproved so they can edit while pending).
 */
export async function findEditableSquadProfile(
  userId: string,
  email: string | null | undefined,
): Promise<SquadMember | null> {
  const db = getClientDb();
  const snap = await getDocs(collection(db, "squad"));
  const all = snap.docs.map((d) => mapSquad(d.id, d.data()));
  const byUid = all.find((m) => m.createdBy === userId);
  if (byUid) return byUid;
  const e = normalizeEmail(email);
  if (!e) return null;
  return all.find((m) => m.email === e) || null;
}

export function subscribeGroups(
  onData: (groups: AudienceGroup[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getClientDb(), "groups"),
    (snap) => {
      const groups = snap.docs
        .map((d) => mapGroup(d.id, d.data()))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(groups);
    },
    (err) => onError?.(err),
  );
}

export async function fetchGroups(): Promise<AudienceGroup[]> {
  const snap = await getDocs(collection(getClientDb(), "groups"));
  return snap.docs
    .map((d) => mapGroup(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveGroup(input: {
  id?: string;
  name: string;
  emails: string[];
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Group name is required.");
  const slug = slugifyGroupName(name);
  const id = input.id || slug;
  const emails = input.emails.map(normalizeEmail).filter((e) => e.includes("@"));
  await setDoc(
    doc(getClientDb(), "groups", id),
    {
      name,
      slug,
      emails,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return id;
}

export async function deleteGroup(id: string): Promise<void> {
  await deleteDoc(doc(getClientDb(), "groups", id));
}

export async function fetchAllForAdmin(): Promise<{
  events: MeetupEvent[];
  memories: Memory[];
  squad: SquadMember[];
  groups: AudienceGroup[];
}> {
  const [eventsSnap, memoriesSnap, squadSnap, groupsSnap] = await Promise.all([
    getDocs(collection(getClientDb(), "events")),
    getDocs(collection(getClientDb(), "memories")),
    getDocs(collection(getClientDb(), "squad")),
    getDocs(collection(getClientDb(), "groups")),
  ]);
  return {
    events: eventsSnap.docs.map((d) => mapEvent(d.id, d.data())),
    memories: memoriesSnap.docs.map((d) => mapMemory(d.id, d.data())),
    squad: squadSnap.docs.map((d) => mapSquad(d.id, d.data())),
    groups: groupsSnap.docs
      .map((d) => mapGroup(d.id, d.data()))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * Grant admin custom claim via Next.js API (no Firebase Cloud Functions / Blaze).
 * Requires server FIREBASE_SERVICE_ACCOUNT_JSON and a signed-in bootstrap UID.
 * After success, call refreshClaims() so the ID token picks up the claim.
 */
export async function requestAdminClaim(targetUid?: string): Promise<{
  ok: boolean;
  uid: string;
}> {
  const { getClientAuth } = await import("./client");
  const user = getClientAuth().currentUser;
  if (!user) {
    throw new Error("Sign in required.");
  }
  const idToken = await user.getIdToken();
  const res = await fetch("/api/admin/claim", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(targetUid ? { uid: targetUid } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    uid?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return { ok: true, uid: data.uid || targetUid || user.uid };
}
