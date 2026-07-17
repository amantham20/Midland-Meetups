"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { StatusPill } from "@/components/StatusPill";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { TagPicker } from "@/components/TagChips";
import {
  approveDocument,
  deleteGroup,
  fetchAllForAdmin,
  rejectDocument,
  requestAdminClaim,
  saveGroup,
  updateEventStatus,
  updateEventTags,
  adminUpdateSquadMember,
} from "@/lib/firebase/data";
import {
  groupsForEmail,
  normalizeEmail,
  parseEmailList,
} from "@/lib/audience";
import type {
  AudienceGroup,
  EventStatus,
  MeetupEvent,
  Memory,
  SquadMember,
} from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

const STATUSES: EventStatus[] = [
  "confirmed",
  "rain-delay",
  "canceled",
  "relocated",
];

export default function AdminPage() {
  const {
    user,
    isAdmin,
    isAdminListed,
    hasAdminClaim,
    loading,
    configured,
    refreshClaims,
  } = useAuth();
  const toast = useToast();

  const [events, setEvents] = useState<MeetupEvent[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [squad, setSquad] = useState<SquadMember[]>([]);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);

  // Per-event draft state for status editor
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, { status: EventStatus; note: string }>
  >({});
  const [eventTagDrafts, setEventTagDrafts] = useState<Record<string, string[]>>(
    {},
  );
  const [squadDrafts, setSquadDrafts] = useState<
    Record<
      string,
      {
        name: string;
        occupation: string;
        age: string;
        gender: string;
        email: string;
        socialLink: string;
        bio: string;
        approved: boolean;
      }
    >
  >({});

  // New / edit group form
  const [groupName, setGroupName] = useState("");
  /** Squad member ids selected into the group (emails come from their profiles). */
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  /** Optional extra emails not on a squad profile yet */
  const [groupExtraEmails, setGroupExtraEmails] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);

  const applyAdminData = useCallback(
    (data: {
      events: MeetupEvent[];
      memories: Memory[];
      squad: SquadMember[];
      groups: AudienceGroup[];
    }) => {
      setEvents(data.events);
      setMemories(data.memories);
      setSquad(data.squad);
      setGroups(data.groups);
      const drafts: Record<string, { status: EventStatus; note: string }> = {};
      const tags: Record<string, string[]> = {};
      for (const e of data.events) {
        drafts[e.id] = { status: e.status, note: e.statusNote || "" };
        tags[e.id] = e.tags || [];
      }
      setStatusDrafts(drafts);
      setEventTagDrafts(tags);
      const memberDrafts: typeof squadDrafts = {};
      for (const s of data.squad) {
        memberDrafts[s.id] = {
          name: s.name,
          occupation: s.occupation,
          age: s.age,
          gender: s.gender,
          email: s.email || "",
          socialLink: s.socialLink || "",
          bio: s.bio || "",
          approved: s.approved,
        };
      }
      setSquadDrafts(memberDrafts);
      setError(null);
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const data = await fetchAllForAdmin();
      applyAdminData(data);
    } catch (err) {
      console.error(err);
      setError(
        hasAdminClaim
          ? "Couldn't load admin data. Check Firestore rules and indexes."
          : "Couldn't load admin data. Your account needs the admin custom claim (Firestore rules check request.auth.token.admin).",
      );
    }
  }, [applyAdminData, hasAdminClaim]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetchAllForAdmin()
      .then((data) => {
        if (!cancelled) applyAdminData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(
          hasAdminClaim
            ? "Couldn't load admin data. Check Firestore rules and indexes."
            : "Couldn't load admin data. Your account needs the admin custom claim (Firestore rules check request.auth.token.admin).",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, hasAdminClaim, applyAdminData]);

  const pendingEvents = useMemo(
    () => events.filter((e) => !e.approved),
    [events],
  );
  const pendingMemories = useMemo(
    () => memories.filter((m) => !m.approved),
    [memories],
  );
  const pendingSquad = useMemo(
    () => squad.filter((s) => !s.approved),
    [squad],
  );
  const approvedEvents = useMemo(
    () =>
      events
        .filter((e) => e.approved)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [events],
  );

  async function approve(
    collectionName: "events" | "memories" | "squad",
    id: string,
  ) {
    setBusyId(id);
    setInfo(null);
    try {
      await approveDocument(collectionName, id);
      await load();
      setInfo("Approved.");
      toast.success("Approved.");
    } catch (err) {
      console.error(err);
      const msg =
        "Approve failed. Check admin access and Firestore rules.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(
    collectionName: "events" | "memories" | "squad",
    id: string,
  ) {
    if (!window.confirm("Reject and delete this submission?")) return;
    setBusyId(id);
    setInfo(null);
    try {
      await rejectDocument(collectionName, id);
      await load();
      setInfo("Rejected and removed.");
      toast.success("Rejected and removed.");
    } catch (err) {
      console.error(err);
      const msg = "Reject failed. Check admin access and Firestore rules.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function saveStatus(eventId: string) {
    const draft = statusDrafts[eventId];
    if (!draft) return;
    setBusyId(eventId);
    setInfo(null);
    try {
      await updateEventStatus(eventId, draft.status, draft.note);
      await updateEventTags(eventId, eventTagDrafts[eventId] || []);
      await load();
      setInfo("Event status & audience tags updated.");
      toast.success("Event status & audience tags updated.");
    } catch (err) {
      console.error(err);
      const msg = "Status update failed. Check admin access and rules.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  function memberEmail(id: string): string {
    const draft = squadDrafts[id];
    const member = squad.find((m) => m.id === id);
    return (draft?.email || member?.email || "").trim();
  }

  /** Resolve emails for a group from selected squad members + optional extras. */
  function emailsFromGroupForm(): string[] {
    const fromMembers = groupMemberIds.map(memberEmail).filter(Boolean);
    return parseEmailList([...fromMembers, groupExtraEmails].join("\n"));
  }

  async function saveGroupForm() {
    setGroupBusy(true);
    setError(null);
    try {
      // Persist emails on selected profiles that have an email filled in drafts
      for (const id of groupMemberIds) {
        const em = memberEmail(id);
        if (!em) {
          throw new Error(
            "Every selected profile needs an email. Fill it next to their name, or save it under Squad profiles first.",
          );
        }
        const m = squad.find((x) => x.id === id);
        const d = squadDrafts[id];
        if (m && d && normalizeEmail(m.email) !== normalizeEmail(em)) {
          await adminUpdateSquadMember(id, {
            name: d.name || m.name,
            occupation: d.occupation || m.occupation,
            age: d.age || m.age,
            gender: d.gender || m.gender,
            socialLink: d.socialLink || m.socialLink,
            bio: d.bio || m.bio,
            email: em,
            approved: d.approved ?? m.approved,
          });
        }
      }

      const emails = emailsFromGroupForm();
      if (emails.length === 0) {
        throw new Error("Select at least one profile (with email) for this group.");
      }
      await saveGroup({
        id: editingGroupId || undefined,
        name: groupName,
        emails,
      });
      resetGroupForm();
      await load();
      toast.success(editingGroupId ? "Group updated." : "Group created.");
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : "Couldn't save group.";
      setError(msg);
      toast.error(msg);
    } finally {
      setGroupBusy(false);
    }
  }

  function startEditGroup(g: AudienceGroup) {
    setEditingGroupId(g.id);
    setGroupName(g.name);
    const emailSet = new Set(g.emails.map((e) => e.toLowerCase()));
    const selectedIds = squad
      .filter((m) => {
        const em = memberEmail(m.id).toLowerCase();
        return em && emailSet.has(em);
      })
      .map((m) => m.id);
    setGroupMemberIds(selectedIds);
    const memberEmails = new Set(
      selectedIds.map((id) => memberEmail(id).toLowerCase()),
    );
    const extras = g.emails.filter((e) => !memberEmails.has(e.toLowerCase()));
    setGroupExtraEmails(extras.join("\n"));
  }

  function toggleGroupMember(memberId: string) {
    setGroupMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  }

  function resetGroupForm() {
    setEditingGroupId(null);
    setGroupName("");
    setGroupMemberIds([]);
    setGroupExtraEmails("");
  }

  /** Emails that appear in groups but are not on any squad profile. */
  const unmatchedEmails = useMemo(() => {
    const profileEmails = new Set(
      squad
        .map((m) => (squadDrafts[m.id]?.email || m.email || "").toLowerCase())
        .filter(Boolean),
    );
    const all = new Set<string>();
    for (const g of groups) {
      for (const e of g.emails) {
        if (e && !profileEmails.has(e.toLowerCase())) {
          all.add(e.toLowerCase());
        }
      }
    }
    for (const e of parseEmailList(groupExtraEmails)) {
      if (!profileEmails.has(e)) all.add(e);
    }
    return Array.from(all).sort();
  }, [groups, squad, squadDrafts, groupExtraEmails]);

  const [matchEmail, setMatchEmail] = useState("");
  const [matchProfileId, setMatchProfileId] = useState("");

  async function assignUnmatchedEmail() {
    if (!matchEmail || !matchProfileId) {
      toast.info("Pick an unmatched email and a profile.");
      return;
    }
    const m = squad.find((x) => x.id === matchProfileId);
    const d = squadDrafts[matchProfileId];
    if (!m || !d) return;
    setBusyId(matchProfileId);
    try {
      await adminUpdateSquadMember(matchProfileId, {
        name: d.name || m.name,
        occupation: d.occupation || m.occupation,
        age: d.age || m.age,
        gender: d.gender || m.gender,
        socialLink: d.socialLink || m.socialLink,
        bio: d.bio || m.bio,
        email: matchEmail,
        approved: d.approved ?? m.approved,
      });
      await load();
      setMatchEmail("");
      setMatchProfileId("");
      toast.success(`Linked ${matchEmail} to ${d.name || m.name}.`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't link email to profile.");
    } finally {
      setBusyId(null);
    }
  }

  const squadSorted = useMemo(
    () =>
      [...squad].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        }),
      ),
    [squad],
  );

  async function removeGroup(id: string) {
    if (!window.confirm("Delete this audience group?")) return;
    try {
      await deleteGroup(id);
      await load();
      toast.success("Group deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete group.");
    }
  }

  async function saveMemberProfile(memberId: string) {
    const d = squadDrafts[memberId];
    if (!d) return;
    setBusyId(memberId);
    try {
      await adminUpdateSquadMember(memberId, {
        name: d.name,
        occupation: d.occupation,
        age: d.age,
        gender: d.gender,
        email: d.email,
        socialLink: d.socialLink,
        bio: d.bio,
        approved: d.approved,
      });
      await load();
      toast.success("Squad profile saved.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save squad profile.");
    } finally {
      setBusyId(null);
    }
  }

  function patchSquadDraft(
    id: string,
    patch: Partial<(typeof squadDrafts)[string]>,
  ) {
    setSquadDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  async function bootstrapClaim() {
    setClaimBusy(true);
    setError(null);
    setInfo(null);
    try {
      await requestAdminClaim();
      await refreshClaims();
      const msg =
        "Admin claim granted. You can approve content and edit event status now.";
      setInfo(msg);
      toast.success(msg);
      await load();
    } catch (err) {
      console.error(err);
      const msg =
        "Could not grant admin claim. Bootstrap UID already works for approve/import without a service account.";
      setError(msg);
      toast.error(msg);
    } finally {
      setClaimBusy(false);
    }
  }

  if (!configured) {
    return (
      <>
        <PageHeader kicker="Organizer" title="Admin" lede="Review submissions." />
        <ConfigNotice />
      </>
    );
  }

  if (loading) {
    return <EmptyNote>Checking access…</EmptyNote>;
  }

  if (!user) {
    return (
      <>
        <PageHeader kicker="Organizer" title="Admin" lede="Review submissions." />
        <div className="form-card">
          <p className="mb-3 text-muted">Sign in with an admin account.</p>
          <Link href="/login?next=/admin" className="btn-primary">
            Sign in
          </Link>
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader kicker="Organizer" title="Admin" lede="Review submissions." />
        <EmptyNote>
          Your account is signed in, but it is not an admin. Put your UID (
          <code className="rounded bg-surface-2 px-1 font-mono text-sm">
            {user.uid}
          </code>
          ) in{" "}
          <code className="rounded bg-surface-2 px-1 font-mono text-sm">
            NEXT_PUBLIC_ADMIN_UIDS
          </code>{" "}
          for the nav link, then grant the{" "}
          <code className="rounded bg-surface-2 px-1 font-mono text-sm">
            admin
          </code>{" "}
          custom claim (see README).
        </EmptyNote>
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker="Organizer"
        title="Admin"
        lede="Approve submissions, manage audience groups (by email), and set who can see each event."
      />

      {/* Access / bootstrap panel */}
      <div className="mb-8 rounded-lg border border-border bg-surface p-4 text-sm shadow-sm">
        <div className="mb-2 font-semibold text-ink">Your access</div>
        <ul className="mb-3 space-y-1 text-muted">
          <li>
            UID:{" "}
            <code className="rounded bg-surface-2 px-1 font-mono text-xs">
              {user.uid}
            </code>
          </li>
          <li>
            Listed in{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_ADMIN_UIDS</code>:{" "}
            {isAdminListed ? "yes" : "no"}
          </li>
          <li>
            Admin custom claim:{" "}
            {hasAdminClaim ? (
              <span className="font-semibold text-green">yes — writes allowed</span>
            ) : (
              <span className="font-semibold text-red">
                no — approve/status writes will fail until set
              </span>
            )}
          </li>
        </ul>
        {!hasAdminClaim && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={claimBusy}
              onClick={() => void bootstrapClaim()}
            >
              {claimBusy ? "Requesting…" : "Request admin claim"}
            </button>
            <p className="text-muted">
              Optional. Uses the Next.js route{" "}
              <code className="font-mono text-xs">/api/admin/claim</code> (no
              Blaze plan). Your UID is already a bootstrap admin in Firestore
              rules for approve/reject.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <EmptyNote>{error}</EmptyNote>
        </div>
      )}
      {info && (
        <p className="mb-4 text-sm font-medium text-green">{info}</p>
      )}

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">
          Pending events ({pendingEvents.length})
        </h2>
        {pendingEvents.length === 0 ? (
          <EmptyNote>No pending events.</EmptyNote>
        ) : (
          pendingEvents.map((e) => (
            <div
              key={e.id}
              className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <div className="font-semibold">{e.title}</div>
                <div className="text-sm text-muted">
                  {e.date} · {e.time} · {e.location} · host {e.host}
                </div>
                <p className="mt-1 text-sm">{e.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === e.id}
                  onClick={() => void approve("events", e.id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2"
                  disabled={busyId === e.id}
                  onClick={() => void reject("events", e.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">
          Pending memories ({pendingMemories.length})
        </h2>
        {pendingMemories.length === 0 ? (
          <EmptyNote>No pending memories.</EmptyNote>
        ) : (
          pendingMemories.map((m) => (
            <div
              key={m.id}
              className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <div className="font-semibold">{m.title}</div>
                <div className="text-sm text-muted">by {m.author}</div>
                <p className="mt-1 text-sm">{m.text}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === m.id}
                  onClick={() => void approve("memories", m.id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2"
                  disabled={busyId === m.id}
                  onClick={() => void reject("memories", m.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="mb-12">
        <h2 className="mb-3 font-display text-xl font-bold">
          Pending squad ({pendingSquad.length})
        </h2>
        {pendingSquad.length === 0 ? (
          <EmptyNote>No pending profiles.</EmptyNote>
        ) : (
          pendingSquad.map((s) => (
            <div
              key={s.id}
              className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex gap-3">
                {s.photoBase64 ? (
                  // data: URL from Firestore base64 — next/image not applicable
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${s.photoMimeType || "image/jpeg"};base64,${s.photoBase64.includes(",") ? s.photoBase64.split(",")[1] : s.photoBase64}`}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-muted">
                    {s.occupation} · {s.age} · {s.gender}
                  </div>
                  <p className="mt-1 text-sm">{s.bio}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === s.id}
                  onClick={() => void approve("squad", s.id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2"
                  disabled={busyId === s.id}
                  onClick={() => void reject("squad", s.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* ——— Squad profiles: edit everyone ——— */}
      <section className="mb-12">
        <h2 className="mb-2 font-display text-xl font-bold">
          Squad profiles ({squad.length})
        </h2>
        <p className="mb-4 text-sm text-muted">
          Edit every profile and set emails so you can put people into audience
          groups. Profiles without email show a red badge.
        </p>
        {squadSorted.length === 0 ? (
          <EmptyNote>No squad profiles yet.</EmptyNote>
        ) : (
          squadSorted.map((s) => {
            const d = squadDrafts[s.id] || {
              name: s.name,
              occupation: s.occupation,
              age: s.age,
              gender: s.gender,
              email: s.email || "",
              socialLink: s.socialLink || "",
              bio: s.bio || "",
              approved: s.approved,
            };
            const matched = groupsForEmail(groups, d.email);
            return (
              <div
                key={s.id}
                className="mb-4 rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-ink">
                    {d.name || s.name}
                    {!d.approved && (
                      <span className="ml-2 text-xs font-medium text-muted">
                        pending
                      </span>
                    )}
                    {!d.email && (
                      <span className="ml-2 text-xs font-semibold text-red">
                        no email
                      </span>
                    )}
                  </div>
                  {matched.length > 0 && (
                    <div className="text-xs font-semibold text-blue">
                      Groups: {matched.map((g) => g.name).join(", ")}
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor={`adm-name-${s.id}`}>
                      Name
                    </label>
                    <input
                      id={`adm-name-${s.id}`}
                      className="field"
                      value={d.name}
                      onChange={(ev) =>
                        patchSquadDraft(s.id, { name: ev.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`adm-email-${s.id}`}>
                      Email
                    </label>
                    <input
                      id={`adm-email-${s.id}`}
                      className="field"
                      type="email"
                      value={d.email}
                      onChange={(ev) =>
                        patchSquadDraft(s.id, { email: ev.target.value })
                      }
                      placeholder="name@example.com"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`adm-occ-${s.id}`}>
                      Occupation
                    </label>
                    <input
                      id={`adm-occ-${s.id}`}
                      className="field"
                      value={d.occupation}
                      onChange={(ev) =>
                        patchSquadDraft(s.id, { occupation: ev.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label" htmlFor={`adm-age-${s.id}`}>
                        Age
                      </label>
                      <input
                        id={`adm-age-${s.id}`}
                        className="field"
                        value={d.age}
                        onChange={(ev) =>
                          patchSquadDraft(s.id, { age: ev.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label
                        className="field-label"
                        htmlFor={`adm-gender-${s.id}`}
                      >
                        Gender
                      </label>
                      <input
                        id={`adm-gender-${s.id}`}
                        className="field"
                        value={d.gender}
                        onChange={(ev) =>
                          patchSquadDraft(s.id, { gender: ev.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      className="field-label"
                      htmlFor={`adm-social-${s.id}`}
                    >
                      Social link
                    </label>
                    <input
                      id={`adm-social-${s.id}`}
                      className="field"
                      value={d.socialLink}
                      onChange={(ev) =>
                        patchSquadDraft(s.id, { socialLink: ev.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="field-label" htmlFor={`adm-bio-${s.id}`}>
                      Bio
                    </label>
                    <textarea
                      id={`adm-bio-${s.id}`}
                      className="field min-h-[72px]"
                      value={d.bio}
                      onChange={(ev) =>
                        patchSquadDraft(s.id, { bio: ev.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={d.approved}
                      onChange={(ev) =>
                        patchSquadDraft(s.id, { approved: ev.target.checked })
                      }
                    />
                    Approved (public on The Squad)
                  </label>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === s.id}
                    onClick={() => void saveMemberProfile(s.id)}
                  >
                    {busyId === s.id ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ——— Match unmatched emails ——— */}
      {unmatchedEmails.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-2 font-display text-xl font-bold">
            Match unmatched emails ({unmatchedEmails.length})
          </h2>
          <p className="mb-4 text-sm text-muted">
            These emails are in a group (or extra list) but not on any squad
            profile yet. Assign one to a profile to connect them.
          </p>
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="min-w-[180px] flex-1">
              <label className="field-label" htmlFor="match-email">
                Unmatched email
              </label>
              <select
                id="match-email"
                className="field"
                value={matchEmail}
                onChange={(e) => setMatchEmail(e.target.value)}
              >
                <option value="">Select email…</option>
                {unmatchedEmails.map((em) => (
                  <option key={em} value={em}>
                    {em}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="field-label" htmlFor="match-profile">
                Squad profile
              </label>
              <select
                id="match-profile"
                className="field"
                value={matchProfileId}
                onChange={(e) => setMatchProfileId(e.target.value)}
              >
                <option value="">Select profile…</option>
                {squadSorted.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {(squadDrafts[m.id]?.email || m.email)
                      ? ` (${squadDrafts[m.id]?.email || m.email})`
                      : " — no email"}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={!matchEmail || !matchProfileId || busyId === matchProfileId}
              onClick={() => void assignUnmatchedEmail()}
            >
              Link email to profile
            </button>
          </div>
        </section>
      )}

      {/* ——— Audience groups: select profiles ——— */}
      <section className="mb-12">
        <h2 className="mb-2 font-display text-xl font-bold">
          Audience groups ({groups.length})
        </h2>
        <p className="mb-4 text-sm text-muted">
          Create a group, then check profiles from the list to add them. You can
          type an email next to a profile if they don&apos;t have one yet.
        </p>

        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 font-semibold text-ink">
            {editingGroupId ? "Edit group" : "Create audience group"}
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="group-name">
              Group name
            </label>
            <input
              id="group-name"
              className="field"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Core crew, Work friends"
            />
          </div>

          <div className="form-row">
            <div className="field-label">Add profiles from the list</div>
            {squadSorted.length === 0 ? (
              <p className="text-sm text-muted">
                No squad profiles yet. Edit Squad profiles above first.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {squadSorted.map((m) => {
                  const d = squadDrafts[m.id];
                  const email = (d?.email || m.email || "").trim();
                  const checked = groupMemberIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className={[
                        "flex flex-wrap items-center gap-3 rounded-md px-2 py-2 text-sm",
                        checked ? "bg-blue/10" : "hover:bg-surface-2",
                      ].join(" ")}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-[var(--blue)]"
                          checked={checked}
                          onChange={() => toggleGroupMember(m.id)}
                        />
                        <span className="min-w-0">
                          <span className="font-semibold text-ink">{m.name}</span>
                          {!m.approved && (
                            <span className="ml-1 text-xs text-muted">
                              (pending)
                            </span>
                          )}
                        </span>
                      </label>
                      <input
                        type="email"
                        className="field max-w-[220px] py-1.5 text-xs"
                        placeholder="email@…"
                        value={email}
                        onChange={(ev) =>
                          patchSquadDraft(m.id, { email: ev.target.value })
                        }
                        onClick={(ev) => ev.stopPropagation()}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-muted">
              {groupMemberIds.length} profile
              {groupMemberIds.length === 1 ? "" : "s"} selected
              {emailsFromGroupForm().length > 0
                ? ` · ${emailsFromGroupForm().length} email(s) will be on this group`
                : ""}
            </p>
          </div>

          <div className="form-row">
            <label className="field-label" htmlFor="group-extra-emails">
              Extra emails{" "}
              <span className="field-hint">
                — optional, not on the squad yet
              </span>
            </label>
            <textarea
              id="group-extra-emails"
              className="field min-h-[64px] font-mono text-sm"
              value={groupExtraEmails}
              onChange={(e) => setGroupExtraEmails(e.target.value)}
              placeholder="guest@example.com"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={groupBusy || !groupName.trim()}
              onClick={() => void saveGroupForm()}
            >
              {groupBusy
                ? "Saving…"
                : editingGroupId
                  ? "Update group"
                  : "Create group"}
            </button>
            {editingGroupId && (
              <button
                type="button"
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2"
                onClick={resetGroupForm}
              >
                Cancel edit
              </button>
            )}
          </div>
        </div>

        {groups.length === 0 ? (
          <EmptyNote>
            No groups yet — create one above by naming it and selecting profiles.
          </EmptyNote>
        ) : (
          groups.map((g) => {
            const membersInGroup = squadSorted.filter((m) => {
              const em = memberEmail(m.id).toLowerCase();
              return em && g.emails.includes(em);
            });
            return (
              <div
                key={g.id}
                className="mb-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-ink">{g.name}</div>
                    <div className="text-xs text-muted">
                      tag: <span className="font-mono">{g.slug}</span> ·{" "}
                      {g.emails.length} email
                      {g.emails.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-2"
                      onClick={() => startEditGroup(g)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2"
                      onClick={() => void removeGroup(g.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {membersInGroup.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {membersInGroup.map((m) => (
                      <span
                        key={m.id}
                        className="rounded-full bg-blue/10 px-2.5 py-0.5 text-xs font-semibold text-blue"
                      >
                        {m.name}
                      </span>
                    ))}
                  </div>
                )}
                {g.emails.length > 0 && (
                  <ul className="max-h-24 overflow-y-auto font-mono text-xs text-muted">
                    {g.emails.map((em) => (
                      <li key={em}>{em}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl font-bold">
          Event status & audience ({approvedEvents.length})
        </h2>
        <p className="mb-4 text-sm text-muted">
          Status notes show on the Happenings ticker. Audience tags limit who
          can see the event.
        </p>
        {approvedEvents.length === 0 ? (
          <EmptyNote>No approved events yet.</EmptyNote>
        ) : (
          approvedEvents.map((e) => {
            const draft = statusDrafts[e.id] || {
              status: e.status,
              note: e.statusNote || "",
            };
            return (
              <div
                key={e.id}
                className="mb-4 rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-ink">{e.title}</div>
                    <div className="text-sm text-muted">
                      {formatDateShort(e.date)} · {e.time} · {e.location}
                    </div>
                  </div>
                  <StatusPill status={e.status} />
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                  <div>
                    <label
                      className="field-label"
                      htmlFor={`status-${e.id}`}
                    >
                      Status
                    </label>
                    <select
                      id={`status-${e.id}`}
                      className="field"
                      value={draft.status}
                      onChange={(ev) =>
                        setStatusDrafts((prev) => ({
                          ...prev,
                          [e.id]: {
                            ...draft,
                            status: ev.target.value as EventStatus,
                          },
                        }))
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`note-${e.id}`}>
                      Status note
                    </label>
                    <input
                      id={`note-${e.id}`}
                      className="field"
                      value={draft.note}
                      onChange={(ev) =>
                        setStatusDrafts((prev) => ({
                          ...prev,
                          [e.id]: { ...draft, note: ev.target.value },
                        }))
                      }
                      placeholder="e.g. Moved to Pavilion B"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="btn-primary w-full sm:w-auto"
                      disabled={busyId === e.id}
                      onClick={() => void saveStatus(e.id)}
                    >
                      Save
                    </button>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <div className="field-label mb-2">Audience tags</div>
                  <TagPicker
                    groups={groups}
                    selected={eventTagDrafts[e.id] || []}
                    onChange={(next) =>
                      setEventTagDrafts((prev) => ({
                        ...prev,
                        [e.id]: next,
                      }))
                    }
                    idPrefix={`evt-tag-${e.id}`}
                  />
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
