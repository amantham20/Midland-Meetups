"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  Icons,
  InboxIcon,
  ShieldIcon,
  TagIcon,
  UsersIcon,
} from "@/components/Icons";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  approveDocument,
  deleteGroup,
  fetchAllForAdmin,
  isAdminClaimEndpointConfigured,
  linkUserIdsForSquadEmails,
  rejectDocument,
  requestAdminClaim,
  saveGroup,
  updateEventStatus,
  updateEventTags,
  adminUpdateSquadMember,
} from "@/lib/firebase/data";
import { normalizeEmail } from "@/lib/audience";
import type {
  AudienceGroup,
  EventStatus,
  MeetupEvent,
  Memory,
  SquadMember,
} from "@/lib/types";
import { ReviewPanel } from "./ReviewPanel";
import { SquadPanel, draftFromMember, type SquadDraft } from "./SquadPanel";
import { GroupsPanel } from "./GroupsPanel";
import { EventsPanel } from "./EventsPanel";
import { StatTile } from "./ui";

type Tab = "review" | "squad" | "groups" | "events";

const TABS: { id: Tab; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "squad", label: "Squad" },
  { id: "groups", label: "Groups" },
  { id: "events", label: "Events" },
];

/** Firestore rejected the read/write outright — not a network or index problem. */
function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "permission-denied"
  );
}

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
  const [claimBusy, setClaimBusy] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("review");
  const [copied, setCopied] = useState(false);
  /** null until the availability probe answers. */
  const [claimEndpointReady, setClaimEndpointReady] = useState<boolean | null>(
    null,
  );
  /** Set when Firestore itself rejects admin reads (rules/env drift). */
  const [accessDenied, setAccessDenied] = useState(false);

  /**
   * Firestore rules accept EITHER the `admin` custom claim OR a bootstrap UID
   * (`isBootstrapAdmin()`, kept in sync with NEXT_PUBLIC_ADMIN_UIDS). Listed
   * UIDs can already approve and set status — the claim is the optional
   * long-term path, not a prerequisite. Only a real denial from Firestore
   * proves writes are blocked.
   */
  const writesAllowed = (hasAdminClaim || isAdminListed) && !accessDenied;

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
      setError(null);
      setAccessDenied(false);
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const data = await fetchAllForAdmin();
      // Backfill userId for every profile that has an email (Auth lookup).
      try {
        const { linked } = await linkUserIdsForSquadEmails(data.squad);
        if (linked > 0) {
          applyAdminData(await fetchAllForAdmin());
          return;
        }
      } catch (linkErr) {
        console.warn("Could not link squad userIds", linkErr);
      }
      applyAdminData(data);
    } catch (err) {
      console.error(err);
      const denied = isPermissionDenied(err);
      setAccessDenied(denied);
      setError(
        denied
          ? "Firestore denied admin access. Rules admit the `admin` custom claim or a UID listed in isBootstrapAdmin() — check your UID is in firestore.rules and that the rules are deployed."
          : "Couldn't load admin data. Check Firestore rules and indexes.",
      );
    } finally {
      setDataLoading(false);
    }
  }, [applyAdminData]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  // Only offer the claim button where the server can actually mint claims.
  useEffect(() => {
    if (!isAdmin || hasAdminClaim) return;
    let active = true;
    void isAdminClaimEndpointConfigured().then((ready) => {
      if (active) setClaimEndpointReady(ready);
    });
    return () => {
      active = false;
    };
  }, [isAdmin, hasAdminClaim]);

  const pendingEvents = useMemo(
    () => events.filter((e) => !e.approved),
    [events],
  );
  const pendingMemories = useMemo(
    () => memories.filter((m) => !m.approved),
    [memories],
  );
  const pendingSquad = useMemo(() => squad.filter((s) => !s.approved), [squad]);
  const approvedEvents = useMemo(
    () =>
      events
        .filter((e) => e.approved)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [events],
  );
  const pendingTotal =
    pendingEvents.length + pendingMemories.length + pendingSquad.length;

  const squadSorted = useMemo(
    () =>
      [...squad].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        }),
      ),
    [squad],
  );

  /** Emails that appear in a group but sit on no squad profile. */
  const unmatchedEmails = useMemo(() => {
    const profileEmails = new Set(
      squad.map((m) => normalizeEmail(m.email)).filter(Boolean),
    );
    const all = new Set<string>();
    for (const g of groups) {
      for (const e of g.emails) {
        const em = normalizeEmail(e);
        if (em && !profileEmails.has(em)) all.add(em);
      }
    }
    return Array.from(all).sort();
  }, [groups, squad]);

  async function approve(
    collectionName: "events" | "memories" | "squad",
    id: string,
  ) {
    setBusyId(id);
    try {
      await approveDocument(collectionName, id);
      await load();
      toast.success("Approved.");
    } catch (err) {
      console.error(err);
      if (isPermissionDenied(err)) setAccessDenied(true);
      const msg = "Approve failed. Check admin access and Firestore rules.";
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
    try {
      await rejectDocument(collectionName, id);
      await load();
      toast.success("Rejected and removed.");
    } catch (err) {
      console.error(err);
      if (isPermissionDenied(err)) setAccessDenied(true);
      const msg = "Reject failed. Check admin access and Firestore rules.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function saveMemberProfile(memberId: string, draft: SquadDraft) {
    setBusyId(memberId);
    try {
      await adminUpdateSquadMember(memberId, draft);
      await load();
      toast.success("Squad profile saved.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save squad profile.");
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  /** Publish / unpublish without opening the editor. */
  async function setMemberApproved(member: SquadMember, approved: boolean) {
    setBusyId(member.id);
    try {
      await adminUpdateSquadMember(member.id, {
        ...draftFromMember(member),
        approved,
      });
      await load();
      toast.success(approved ? "Profile published." : "Profile hidden.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update that profile.");
    } finally {
      setBusyId(null);
    }
  }

  /** Set just the email on a profile, keeping every other field as-is. */
  async function setMemberEmail(memberId: string, email: string) {
    const member = squad.find((m) => m.id === memberId);
    if (!member) return;
    setBusyId(memberId);
    try {
      await adminUpdateSquadMember(memberId, {
        ...draftFromMember(member),
        email,
      });
      await load();
      toast.success(`Linked ${email} to ${member.name || "that profile"}.`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't link that email to a profile.");
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  async function persistGroup(input: {
    id?: string;
    name: string;
    emails: string[];
  }) {
    try {
      await saveGroup(input);
      await load();
      toast.success(input.id ? "Group updated." : "Group created.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save that group.");
      throw err;
    }
  }

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

  async function saveEvent(
    eventId: string,
    draft: { status: EventStatus; note: string; tags: string[] },
  ) {
    setBusyId(eventId);
    try {
      await updateEventStatus(eventId, draft.status, draft.note);
      await updateEventTags(eventId, draft.tags);
      await load();
      toast.success("Event updated.");
    } catch (err) {
      console.error(err);
      if (isPermissionDenied(err)) setAccessDenied(true);
      const msg = "Status update failed. Check admin access and rules.";
      setError(msg);
      toast.error(msg);
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  async function bootstrapClaim() {
    setClaimBusy(true);
    setError(null);
    try {
      await requestAdminClaim();
      await refreshClaims();
      toast.success("Admin claim granted — writes are unlocked.");
      await load();
    } catch (err) {
      console.error(err);
      // Surface the server's actual reason (missing service account, refused
      // caller, …) instead of a canned line that hides it.
      const reason = err instanceof Error && err.message ? err.message : "";
      const msg = [
        reason || "Could not grant admin claim.",
        isAdminListed
          ? "Your UID is on the bootstrap list, so approve and status writes still work."
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      setError(msg);
      toast.error(msg);
    } finally {
      setClaimBusy(false);
    }
  }

  function copyUid() {
    if (!user) return;
    void navigator.clipboard
      ?.writeText(user.uid)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => toast.error("Couldn't copy your UID."));
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
          <p className="mb-4 text-muted">Sign in with an admin account.</p>
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
        lede="Approve what comes in, keep squad profiles tidy, and decide who sees each event."
      />

      {/* Access strip — loud only when writes genuinely can't go through */}
      <div
        className={[
          "card mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5",
          writesAllowed ? "" : "border-yellow/50 bg-yellow/8",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            writesAllowed
              ? "bg-green/15 text-green-ink"
              : "bg-yellow/25 text-yellow-ink",
          ].join(" ")}
        >
          {writesAllowed ? (
            <ShieldIcon className="h-5 w-5" />
          ) : (
            <AlertIcon className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {accessDenied
              ? "Firestore denied this account — approve and status writes will fail"
              : hasAdminClaim
                ? "Admin claim active — writes allowed"
                : "Bootstrap admin — writes allowed"}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="font-mono">{user.uid}</span>
            <span
              className={`badge ${isAdminListed ? "badge-blue" : "badge-neutral"}`}
            >
              {isAdminListed ? "listed in ADMIN_UIDS" : "not in ADMIN_UIDS"}
            </span>
            <span className={`badge ${hasAdminClaim ? "badge-blue" : "badge-neutral"}`}>
              {hasAdminClaim ? "admin claim" : "no admin claim"}
            </span>
          </p>
          {!hasAdminClaim && isAdminListed && !accessDenied && (
            <p className="mt-1 text-xs text-muted">
              Firestore rules accept this UID via{" "}
              <code className="rounded bg-surface-2 px-1 font-mono">
                isBootstrapAdmin()
              </code>
              . The{" "}
              <code className="rounded bg-surface-2 px-1 font-mono">admin</code>{" "}
              custom claim is optional
              {claimEndpointReady === false
                ? " and needs FIREBASE_SERVICE_ACCOUNT_JSON on the server"
                : ""}
              .
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyUid}>
            {copied ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy UID"}
          </button>
          {!hasAdminClaim && claimEndpointReady === true && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={claimBusy}
              onClick={() => void bootstrapClaim()}
            >
              {claimBusy ? "Requesting…" : "Request admin claim"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-6 flex items-start gap-2 rounded-lg border border-red/30 bg-red/8 px-4 py-3 text-sm font-medium text-red-ink">
          <AlertIcon className="mt-0.5 h-4 w-4" />
          {error}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting review"
          value={pendingTotal}
          tone={pendingTotal > 0 ? "amber" : "green"}
          icon={<InboxIcon className="h-5 w-5" />}
        />
        <StatTile
          label="Squad profiles"
          value={squad.length}
          tone="blue"
          icon={<UsersIcon className="h-5 w-5" />}
        />
        <StatTile
          label="Audience groups"
          value={groups.length}
          icon={<TagIcon className="h-5 w-5" />}
        />
        <StatTile
          label="Live events"
          value={approvedEvents.length}
          icon={Icons.calendar}
        />
      </div>

      {/* Sub-nav sticks right under the site header */}
      <div className="sticky top-[var(--header-h)] z-30 -mx-6 mb-8 border-b border-border bg-bg/85 px-6 py-2 backdrop-blur-[8px]">
        <nav
          aria-label="Admin sections"
          className="flex gap-1 overflow-x-auto"
        >
          {TABS.map((t) => {
            const on = tab === t.id;
            const badge =
              t.id === "review"
                ? pendingTotal
                : t.id === "squad"
                  ? squad.length
                  : t.id === "groups"
                    ? groups.length
                    : approvedEvents.length;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => setTab(t.id)}
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue/30",
                  on
                    ? "bg-ink text-white"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                ].join(" ")}
              >
                {t.label}
                <span
                  className={[
                    "rounded-full px-1.5 text-xs font-bold tabular-nums",
                    on
                      ? "bg-white/20 text-white"
                      : t.id === "review" && pendingTotal > 0
                        ? "bg-yellow/25 text-yellow-ink"
                        : "bg-surface-2 text-muted",
                  ].join(" ")}
                >
                  {badge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {dataLoading ? (
        <div className="space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="card h-24 animate-pulse bg-surface-2/60"
              aria-hidden
            />
          ))}
          <p className="text-center text-sm text-muted">Loading admin data…</p>
        </div>
      ) : (
        <>
          {tab === "review" && (
            <ReviewPanel
              pendingEvents={pendingEvents}
              pendingMemories={pendingMemories}
              pendingSquad={pendingSquad}
              busyId={busyId}
              onApprove={(c, id) => void approve(c, id)}
              onReject={(c, id) => void reject(c, id)}
            />
          )}
          {tab === "squad" && (
            <SquadPanel
              squad={squadSorted}
              groups={groups}
              busyId={busyId}
              onSave={saveMemberProfile}
              onSetApproved={setMemberApproved}
            />
          )}
          {tab === "groups" && (
            <GroupsPanel
              groups={groups}
              squad={squadSorted}
              unmatchedEmails={unmatchedEmails}
              busy={busyId !== null}
              onSaveGroup={persistGroup}
              onDeleteGroup={(id) => void removeGroup(id)}
              onSetMemberEmail={setMemberEmail}
            />
          )}
          {tab === "events" && (
            <EventsPanel
              events={approvedEvents}
              groups={groups}
              busyId={busyId}
              onSave={saveEvent}
            />
          )}
        </>
      )}
    </>
  );
}
