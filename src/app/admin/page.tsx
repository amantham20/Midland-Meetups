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
  deleteDocument,
  deleteGroup,
  deleteReport,
  fetchAllForAdmin,
  isAdminClaimEndpointConfigured,
  linkUserIdsForSquadEmails,
  requestAdminClaim,
  saveGroup,
  setContentPublished,
  setReportStatus,
  adminUpdateSquadMember,
  type ModeratedCollection,
} from "@/lib/firebase/data";
import { normalizeEmail } from "@/lib/audience";
import {
  REPORT_TARGET_COLLECTION,
  type AudienceGroup,
  type MeetupEvent,
  type Memory,
  type Report,
  type SquadMember,
} from "@/lib/types";
import { ReviewPanel } from "./ReviewPanel";
import { SquadPanel, draftFromMember, type SquadDraft } from "./SquadPanel";
import { GroupsPanel } from "./GroupsPanel";
import { EventsPanel } from "./EventsPanel";
import { LorePanel } from "./LorePanel";
import { ReportsPanel } from "./ReportsPanel";
import { StatTile } from "./ui";

type Tab = "review" | "reports" | "squad" | "groups" | "events" | "lore";

const TABS: { id: Tab; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "reports", label: "Reports" },
  { id: "squad", label: "Squad" },
  { id: "groups", label: "Groups" },
  { id: "events", label: "Events" },
  { id: "lore", label: "Lore" },
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
  /** null while unread — the reports rules may not be deployed yet. */
  const [reports, setReports] = useState<Report[] | null>(null);
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
      reports: Report[] | null;
    }) => {
      setEvents(data.events);
      setMemories(data.memories);
      setSquad(data.squad);
      setGroups(data.groups);
      setReports(data.reports);
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

  // Something an organizer took down is not waiting on a decision — it already
  // got one. Keeping hidden content out of the review queue is what stops it
  // reading like a fresh submission that another organizer should approve.
  const pendingEvents = useMemo(
    () => events.filter((e) => !e.approved && !e.hidden),
    [events],
  );
  const pendingMemories = useMemo(
    () => memories.filter((m) => !m.approved && !m.hidden),
    [memories],
  );
  const pendingSquad = useMemo(
    () => squad.filter((s) => !s.approved && !s.hidden),
    [squad],
  );
  const approvedEvents = useMemo(
    () => events.filter((e) => e.approved),
    [events],
  );
  /** Every event, pending and hidden included — the Events tab edits all of them. */
  const eventsByDate = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date)),
    [events],
  );
  /** Every story, newest first — the Lore tab publishes, hides and deletes. */
  const memoriesByDate = useMemo(
    () => [...memories].sort((a, b) => b.date.localeCompare(a.date)),
    [memories],
  );
  const pendingTotal =
    pendingEvents.length + pendingMemories.length + pendingSquad.length;
  const openReports = useMemo(
    () => (reports || []).filter((r) => r.status === "open").length,
    [reports],
  );
  /**
   * Every document a report can point at, mapped to whether it's still on the
   * board. A report keeps working after its target is deleted — a missing id is
   * what tells the panel to stop offering to remove something that's already
   * gone, and a `false` marks content that's been hidden but not deleted.
   */
  const targetPublished = useMemo(
    () =>
      new Map<string, boolean>([
        ...events.map((e) => [e.id, e.approved] as const),
        ...memories.map((m) => [m.id, m.approved] as const),
        ...squad.map((s) => [s.id, s.approved] as const),
      ]),
    [events, memories, squad],
  );

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

  async function reject(collectionName: ModeratedCollection, id: string) {
    if (!window.confirm("Reject and delete this submission?")) return;
    setBusyId(id);
    try {
      await deleteDocument(collectionName, id);
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

  /**
   * Take something off the board for every member, or put it back. Hiding is
   * the reversible half of moderation — the document stays, so a mistake costs
   * one click and an open report keeps its evidence.
   */
  async function setPublished(
    collectionName: ModeratedCollection,
    id: string,
    published: boolean,
    label: string,
  ) {
    if (
      !published &&
      !window.confirm(
        `Hide “${label}”? It disappears for every member until you publish it again.`,
      )
    )
      return;
    setBusyId(id);
    try {
      await setContentPublished(collectionName, id, published);
      await load();
      toast.success(
        published ? "Published — it's back on the board." : "Hidden from everyone.",
      );
    } catch (err) {
      console.error(err);
      if (isPermissionDenied(err)) setAccessDenied(true);
      const msg = published
        ? "Couldn't publish that."
        : "Couldn't hide that. Check admin access and Firestore rules.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  /** Delete a document for good, from the Events or Lore tab. */
  async function removeContent(
    collectionName: ModeratedCollection,
    id: string,
    label: string,
  ) {
    if (
      !window.confirm(
        `Delete “${label}”? This can't be undone — hide it instead if you might want it back.`,
      )
    )
      return;
    setBusyId(id);
    try {
      await deleteDocument(collectionName, id);
      await load();
      toast.success("Deleted.");
    } catch (err) {
      console.error(err);
      if (isPermissionDenied(err)) setAccessDenied(true);
      const msg = "Delete failed. Check admin access and Firestore rules.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function markReport(id: string, status: "open" | "reviewed") {
    setBusyId(id);
    try {
      await setReportStatus(id, status);
      await load();
      toast.success(status === "reviewed" ? "Marked reviewed." : "Reopened.");
    } catch (err) {
      console.error(err);
      if (isPermissionDenied(err)) setAccessDenied(true);
      toast.error("Couldn't update that report.");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Hide what a report points at, then close the report out. The usual first
   * move on a report: the content is off the board for everyone immediately,
   * and it's still there to look at if the reporter or its author follows up.
   */
  async function hideReportedContent(report: Report) {
    const collectionName = REPORT_TARGET_COLLECTION[report.targetType];
    if (!collectionName) return;
    if (
      !window.confirm(
        `Hide “${report.targetLabel || "this content"}” from every member? You can publish it again later.`,
      )
    )
      return;
    setBusyId(report.id);
    try {
      await setContentPublished(collectionName, report.targetId, false);
      await setReportStatus(report.id, "reviewed");
      await load();
      toast.success("Hidden from everyone and the report marked reviewed.");
    } catch (err) {
      console.error(err);
      if (isPermissionDenied(err)) setAccessDenied(true);
      toast.error("Couldn't hide that content.");
    } finally {
      setBusyId(null);
    }
  }

  /** Delete what a report points at, then close the report out. */
  async function removeReportedContent(report: Report) {
    const collectionName = REPORT_TARGET_COLLECTION[report.targetType];
    if (!collectionName) return;
    if (
      !window.confirm(
        `Delete “${report.targetLabel || "this content"}”? This can't be undone — hide it instead if you might want it back.`,
      )
    )
      return;
    setBusyId(report.id);
    try {
      await deleteDocument(collectionName, report.targetId);
      await setReportStatus(report.id, "reviewed");
      await load();
      toast.success("Content deleted and the report marked reviewed.");
    } catch (err) {
      console.error(err);
      if (isPermissionDenied(err)) setAccessDenied(true);
      toast.error("Couldn't delete that content.");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissReport(id: string) {
    if (!window.confirm("Dismiss and delete this report?")) return;
    setBusyId(id);
    try {
      await deleteReport(id);
      await load();
      toast.success("Report dismissed.");
    } catch (err) {
      console.error(err);
      if (isPermissionDenied(err)) setAccessDenied(true);
      toast.error("Couldn't dismiss that report.");
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
      // Only the two visibility fields — no need to rewrite the profile (and
      // re-resolve its uid) just to take it off the board.
      await setContentPublished("squad", member.id, approved);
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

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Awaiting review"
          value={pendingTotal}
          tone={pendingTotal > 0 ? "amber" : "green"}
          icon={<InboxIcon className="h-5 w-5" />}
        />
        <StatTile
          label="Open reports"
          value={openReports}
          tone={openReports > 0 ? "amber" : "green"}
          icon={<AlertIcon className="h-5 w-5" />}
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
                : t.id === "reports"
                  ? openReports
                  : t.id === "squad"
                    ? squad.length
                    : t.id === "groups"
                      ? groups.length
                      : t.id === "lore"
                        ? memories.length
                        : events.length;
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
                      : (t.id === "review" && pendingTotal > 0) ||
                          (t.id === "reports" && openReports > 0)
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
          {tab === "reports" && (
            <ReportsPanel
              reports={reports}
              busyId={busyId}
              targetPublished={targetPublished}
              onSetStatus={(id, status) => void markReport(id, status)}
              onHideContent={(report) => void hideReportedContent(report)}
              onDeleteContent={(report) => void removeReportedContent(report)}
              onDeleteReport={(id) => void dismissReport(id)}
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
              events={eventsByDate}
              groups={groups}
              busyId={busyId}
              onSaved={() => void load()}
              onSetPublished={(event, published) =>
                void setPublished("events", event.id, published, event.title)
              }
              onDelete={(event) =>
                void removeContent("events", event.id, event.title)
              }
            />
          )}
          {tab === "lore" && (
            <LorePanel
              memories={memoriesByDate}
              busyId={busyId}
              onSetPublished={(memory, published) =>
                void setPublished("memories", memory.id, published, memory.title)
              }
              onDelete={(memory) =>
                void removeContent("memories", memory.id, memory.title)
              }
            />
          )}
        </>
      )}
    </>
  );
}
