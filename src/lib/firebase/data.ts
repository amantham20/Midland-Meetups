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
  Report,
  ReportStatus,
  ReportTargetType,
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
    hostUserId: data.hostUserId ? String(data.hostUserId) : undefined,
    date: String(data.date ?? ""),
    time: String(data.time ?? ""),
    location: String(data.location ?? ""),
    description: String(data.description ?? ""),
    status: (data.status as EventStatus) || "confirmed",
    statusNote: String(data.statusNote ?? ""),
    approved: Boolean(data.approved),
    hidden: Boolean(data.hidden),
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
    hidden: Boolean(data.hidden),
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
  };
}

function mapSquad(id: string, data: Record<string, unknown>): SquadMember {
  // userId is canonical; fall back to legacy createdBy on older docs
  const uid = data.userId
    ? String(data.userId)
    : data.createdBy
      ? String(data.createdBy)
      : undefined;
  return {
    id,
    name: String(data.name ?? ""),
    occupation: String(data.occupation ?? ""),
    age: String(data.age ?? ""),
    gender: String(data.gender ?? ""),
    socialLink: String(data.socialLink ?? ""),
    bio: String(data.bio ?? ""),
    email: normalizeEmail(String(data.email ?? "")),
    userId: uid,
    photoBase64: String(data.photoBase64 ?? ""),
    photoMimeType: String(data.photoMimeType ?? "image/jpeg"),
    photoUrl: String(data.photoUrl ?? ""),
    approved: Boolean(data.approved),
    hidden: Boolean(data.hidden),
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

function mapReport(id: string, data: Record<string, unknown>): Report {
  return {
    id,
    targetType: (data.targetType as ReportTargetType) || "other",
    targetId: String(data.targetId ?? ""),
    targetLabel: String(data.targetLabel ?? ""),
    reason: String(data.reason ?? ""),
    details: String(data.details ?? ""),
    reportedBy: String(data.reportedBy ?? ""),
    reporterEmail: String(data.reporterEmail ?? ""),
    reporterName: String(data.reporterName ?? ""),
    status: data.status === "reviewed" ? "reviewed" : "open",
    // ISO rather than the locale string the other mappers keep, so the queue can
    // sort on it lexicographically.
    createdAt: data.createdAt
      ? ((data.createdAt as { toDate?: () => Date })
          .toDate?.()
          ?.toISOString() ?? String(data.createdAt))
      : "",
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

/**
 * Every event this user is responsible for — the ones they submitted plus the
 * ones they're tagged as host on — approved or not, newest date first.
 *
 * Two single-field queries rather than one `or()`: each matches a clause the
 * read rule can satisfy on its own, and neither needs a composite index.
 */
export function subscribeMyEvents(
  userId: string,
  onData: (events: MeetupEvent[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getClientDb();
  let submitted: MeetupEvent[] = [];
  let hosting: MeetupEvent[] = [];

  function emit() {
    const byId = new Map<string, MeetupEvent>();
    for (const e of [...submitted, ...hosting]) byId.set(e.id, e);
    onData(
      Array.from(byId.values()).sort((a, b) => b.date.localeCompare(a.date)),
    );
  }

  const unsubSubmitted = onSnapshot(
    query(collection(db, "events"), where("createdBy", "==", userId)),
    (snap) => {
      submitted = snap.docs.map((d) => mapEvent(d.id, d.data()));
      emit();
    },
    (err) => onError?.(err),
  );
  const unsubHosting = onSnapshot(
    query(collection(db, "events"), where("hostUserId", "==", userId)),
    (snap) => {
      hosting = snap.docs.map((d) => mapEvent(d.id, d.data()));
      emit();
    },
    (err) => onError?.(err),
  );

  return () => {
    unsubSubmitted();
    unsubHosting();
  };
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
  /** Auth uid when the host was tagged from the squad; "" for a typed name. */
  hostUserId?: string;
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
    hostUserId: input.hostUserId || "",
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
  const email = normalizeEmail(input.email || "");
  await addDoc(collection(getClientDb(), "squad"), {
    name: input.name,
    occupation: input.occupation,
    age: input.age,
    gender: input.gender,
    socialLink: input.socialLink,
    bio: input.bio,
    email,
    // Stamp uid whenever email is set (email is how we match “your” profile).
    userId: email ? input.userId : "",
    // Stored inline — no Cloud Storage. Compressed client-side before write.
    photoBase64: input.photoBase64,
    photoMimeType: input.photoMimeType || "image/jpeg",
    photoUrl: "",
    approved: false,
    createdBy: input.userId, // legacy mirror of userId
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

export type ModeratedCollection = "events" | "memories" | "squad";

/**
 * Publish a piece of content, or pull it back off the board (admin only).
 *
 * Hiding flips `approved` to false, and that — not any client-side filter — is
 * what makes it disappear for everyone: the public feeds query
 * `approved == true` and the Firestore read rule enforces the same condition,
 * so a hidden event or story can't be read by any member, in any audience
 * group, on web or in the iOS app. Only organizers and the author it belongs to
 * can still see it.
 *
 * `hidden` records that an organizer pulled it rather than that it was never
 * reviewed, which is what keeps a taken-down item out of the review queue
 * instead of sitting there looking like a fresh submission waiting for a yes.
 */
export async function setContentPublished(
  collectionName: ModeratedCollection,
  id: string,
  published: boolean,
): Promise<void> {
  await updateDoc(doc(getClientDb(), collectionName, id), {
    approved: published,
    hidden: !published,
    updatedAt: serverTimestamp(),
  });
}

/** Approve a pending submission — publishes it on the board. */
export async function approveDocument(
  collectionName: ModeratedCollection,
  id: string,
): Promise<void> {
  await setContentPublished(collectionName, id, true);
}

/**
 * Delete a document outright (admin only) — rejecting a pending submission,
 * and removing an event or Lore story for good. Unlike hiding, this can't be
 * undone; prefer `setContentPublished` when the content may need to come back
 * or has an open report against it.
 */
export async function deleteDocument(
  collectionName: ModeratedCollection,
  id: string,
): Promise<void> {
  await deleteDoc(doc(getClientDb(), collectionName, id));
}

/**
 * File a report against a piece of content or a member.
 *
 * Signed-in only: the rules stamp the report with `request.auth.uid`, which is
 * what stops the collection being an open write endpoint. Signed-out visitors
 * get the email route the Terms publish instead.
 */
export async function submitReport(input: {
  targetType: ReportTargetType;
  targetId?: string;
  targetLabel?: string;
  reason: string;
  details: string;
  userId: string;
  reporterEmail?: string | null;
  reporterName?: string;
}): Promise<void> {
  await addDoc(collection(getClientDb(), "reports"), {
    targetType: input.targetType,
    targetId: input.targetId || "",
    targetLabel: (input.targetLabel || "").slice(0, 200),
    reason: input.reason,
    details: input.details.trim().slice(0, 2000),
    reportedBy: input.userId,
    reporterEmail: normalizeEmail(input.reporterEmail || ""),
    reporterName: (input.reporterName || "").trim(),
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function setReportStatus(
  id: string,
  status: ReportStatus,
): Promise<void> {
  await updateDoc(doc(getClientDb(), "reports", id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** Clear a report out of the queue once it's been dealt with (admin only). */
export async function deleteReport(id: string): Promise<void> {
  await deleteDoc(doc(getClientDb(), "reports", id));
}

export type EventDetailFields = {
  title: string;
  host: string;
  hostUserId?: string;
  date: string;
  time: string;
  location: string;
  description: string;
  status: EventStatus;
  statusNote: string;
  tags: string[];
};

/**
 * Full edit of an event. Allowed for the host who submitted it and for admins
 * (rules check `createdBy`); `approved`, `createdBy` and `createdAt` are never
 * written, so a host can't self-approve or hand the event to someone else.
 *
 * Pass `resetReminder` when the date or time moved so the day-before push goes
 * out again for the new slot.
 */
export async function updateEventDetails(
  eventId: string,
  fields: EventDetailFields,
  opts: { resetReminder?: boolean } = {},
): Promise<void> {
  const payload: Record<string, unknown> = {
    title: fields.title.trim(),
    host: fields.host.trim(),
    hostUserId: fields.hostUserId || "",
    date: fields.date.trim(),
    time: fields.time.trim(),
    location: fields.location.trim(),
    description: fields.description.trim(),
    status: fields.status,
    statusNote: fields.statusNote.trim(),
    tags: fields.tags.map((t) => String(t).trim()).filter(Boolean),
    updatedAt: serverTimestamp(),
  };
  if (opts.resetReminder) payload.reminderSent = false;
  await updateDoc(doc(getClientDb(), "events", eventId), payload);
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

/**
 * Resolve Firebase Auth uids for emails (admin API).
 * Missing Auth accounts return null for that email.
 */
export async function resolveAuthUidsByEmail(
  emails: string[],
): Promise<Record<string, string | null>> {
  const normalized = Array.from(
    new Set(emails.map((e) => normalizeEmail(e)).filter(Boolean)),
  );
  if (normalized.length === 0) return {};

  const { getClientAuth } = await import("./client");
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Sign in required.");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/admin/resolve-uids", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ emails: normalized }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    uids?: Record<string, string | null>;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Could not resolve uids (${res.status})`);
  }
  return data.uids || {};
}

/** Update own profile matched by email; always stamps userId when email is set. */
export async function updateMySquadProfile(
  memberId: string,
  userId: string,
  fields: SquadProfileFields,
): Promise<void> {
  const email = normalizeEmail(fields.email);
  const payload: Record<string, unknown> = {
    name: fields.name.trim(),
    occupation: fields.occupation.trim(),
    age: String(fields.age).trim(),
    gender: fields.gender.trim(),
    socialLink: fields.socialLink.trim(),
    bio: fields.bio.trim(),
    email,
    // Email is the match key; userId is stamped whenever email is present.
    userId: email ? userId : "",
    createdBy: email ? userId : "",
    updatedAt: serverTimestamp(),
  };
  if (fields.photoBase64) {
    payload.photoBase64 = fields.photoBase64;
    payload.photoMimeType = fields.photoMimeType || "image/jpeg";
  }
  await updateDoc(doc(getClientDb(), "squad", memberId), payload);
}

/**
 * Admin full edit of any squad member.
 * When email is set, looks up Auth uid and stamps userId (and legacy createdBy).
 */
export async function adminUpdateSquadMember(
  memberId: string,
  fields: SquadProfileFields & { approved?: boolean; userId?: string },
): Promise<void> {
  const email = normalizeEmail(fields.email);
  let userId = fields.userId ? String(fields.userId) : "";

  if (email && !userId) {
    try {
      const map = await resolveAuthUidsByEmail([email]);
      userId = map[email] || "";
    } catch (err) {
      // Admin SDK may be unavailable in local dev — still save email.
      console.warn("Could not resolve userId for squad email", err);
    }
  }

  const payload: Record<string, unknown> = {
    name: fields.name.trim(),
    occupation: fields.occupation.trim(),
    age: String(fields.age).trim(),
    gender: fields.gender.trim(),
    socialLink: fields.socialLink.trim(),
    bio: fields.bio.trim(),
    email,
    updatedAt: serverTimestamp(),
  };

  if (email) {
    // Always set userId when email is present (empty string if no Auth user yet).
    payload.userId = userId;
    payload.createdBy = userId;
  } else {
    payload.userId = "";
    payload.createdBy = "";
  }

  if (typeof fields.approved === "boolean") {
    payload.approved = fields.approved;
    // Keep the pair in step with setContentPublished, so republishing from the
    // editor clears the "taken down" mark instead of leaving it stale.
    payload.hidden = !fields.approved;
  }
  if (fields.photoBase64) {
    payload.photoBase64 = fields.photoBase64;
    payload.photoMimeType = fields.photoMimeType || "image/jpeg";
  }
  await updateDoc(doc(getClientDb(), "squad", memberId), payload);
}

/**
 * For every squad member that already has an email, resolve Auth uid and stamp userId.
 * Call from admin after load or via a “link accounts” action.
 */
export async function linkUserIdsForSquadEmails(
  members: { id: string; email: string; userId?: string }[],
): Promise<{ linked: number; missing: number }> {
  const withEmail = members.filter((m) => normalizeEmail(m.email));
  if (withEmail.length === 0) return { linked: 0, missing: 0 };

  const map = await resolveAuthUidsByEmail(withEmail.map((m) => m.email));
  let linked = 0;
  let missing = 0;

  await Promise.all(
    withEmail.map(async (m) => {
      const email = normalizeEmail(m.email);
      const uid = map[email] || "";
      if (!uid) {
        missing += 1;
        // Still clear a stale userId if email has no Auth account? keep existing.
        return;
      }
      if (m.userId === uid) return;
      await updateDoc(doc(getClientDb(), "squad", m.id), {
        email,
        userId: uid,
        createdBy: uid,
        updatedAt: serverTimestamp(),
      });
      linked += 1;
    }),
  );

  return { linked, missing };
}

/**
 * Profile this user may edit — matched by sign-in email only (not createdBy / userId).
 * When found, stamps userId if missing so the doc stays linked.
 */
export async function findEditableSquadProfile(
  userId: string,
  email: string | null | undefined,
): Promise<SquadMember | null> {
  const e = normalizeEmail(email);
  if (!e || !userId) return null;

  const emailSnap = await getDocs(
    query(collection(getClientDb(), "squad"), where("email", "==", e)),
  );
  if (emailSnap.empty) return null;

  const docSnap = emailSnap.docs[0]!;
  const member = mapSquad(docSnap.id, docSnap.data());

  // Stamp userId whenever email matches and uid is missing/outdated.
  if (member.userId !== userId) {
    try {
      await updateDoc(doc(getClientDb(), "squad", member.id), {
        userId,
        createdBy: userId,
        updatedAt: serverTimestamp(),
      });
      member.userId = userId;
      member.createdBy = userId;
    } catch (err) {
      console.warn("Could not stamp squad userId", err);
    }
  }

  return member;
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
  /** null when the reports collection can't be read — not the same as empty. */
  reports: Report[] | null;
}> {
  const [eventsSnap, memoriesSnap, squadSnap, groupsSnap, reportsSnap] =
    await Promise.all([
      getDocs(collection(getClientDb(), "events")),
      getDocs(collection(getClientDb(), "memories")),
      getDocs(collection(getClientDb(), "squad")),
      getDocs(collection(getClientDb(), "groups")),
      // Deployments whose rules predate the reports collection must still get
      // their queue, so this one read is allowed to come back empty-handed.
      getDocs(collection(getClientDb(), "reports")).catch((err) => {
        console.warn("Could not read reports", err);
        return null;
      }),
    ]);
  return {
    events: eventsSnap.docs.map((d) => mapEvent(d.id, d.data())),
    memories: memoriesSnap.docs.map((d) => mapMemory(d.id, d.data())),
    squad: squadSnap.docs.map((d) => mapSquad(d.id, d.data())),
    groups: groupsSnap.docs
      .map((d) => mapGroup(d.id, d.data()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    reports:
      reportsSnap?.docs
        .map((d) => mapReport(d.id, d.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) ?? null,
  };
}

/**
 * Can this deployment mint custom claims at all? False when the server has no
 * FIREBASE_SERVICE_ACCOUNT_JSON, in which case the admin UI should not offer a
 * "Request admin claim" button that can only ever fail.
 */
export async function isAdminClaimEndpointConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/claim", { method: "GET" });
    if (!res.ok) return false;
    const data = (await res.json()) as { configured?: boolean };
    return data.configured === true;
  } catch {
    return false;
  }
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
