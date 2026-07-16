"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { StatusPill } from "@/components/StatusPill";
import { useAuth } from "@/contexts/AuthContext";
import {
  approveDocument,
  fetchAllForAdmin,
  importSpreadsheetSeed,
  rejectDocument,
  requestAdminClaim,
  updateEventStatus,
} from "@/lib/firebase/data";
import type { EventStatus, MeetupEvent, Memory, SquadMember } from "@/lib/types";
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

  const [events, setEvents] = useState<MeetupEvent[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [squad, setSquad] = useState<SquadMember[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  // Per-event draft state for status editor
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, { status: EventStatus; note: string }>
  >({});

  const applyAdminData = useCallback(
    (data: {
      events: MeetupEvent[];
      memories: Memory[];
      squad: SquadMember[];
    }) => {
      setEvents(data.events);
      setMemories(data.memories);
      setSquad(data.squad);
      const drafts: Record<string, { status: EventStatus; note: string }> = {};
      for (const e of data.events) {
        drafts[e.id] = { status: e.status, note: e.statusNote || "" };
      }
      setStatusDrafts(drafts);
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
    } catch (err) {
      console.error(err);
      setError(
        "Approve failed. You need the admin custom claim on your Firebase user.",
      );
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
    } catch (err) {
      console.error(err);
      setError("Reject failed. Check admin custom claim and rules.");
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
      await load();
      setInfo("Event status updated.");
    } catch (err) {
      console.error(err);
      setError("Status update failed. Check admin custom claim and rules.");
    } finally {
      setBusyId(null);
    }
  }

  async function bootstrapClaim() {
    setClaimBusy(true);
    setError(null);
    setInfo(null);
    try {
      await requestAdminClaim();
      await refreshClaims();
      setInfo(
        "Admin claim granted. You can approve content and edit event status now.",
      );
      await load();
    } catch (err) {
      console.error(err);
      setError(
        "Could not grant admin claim. Optional — your bootstrap UID already works for approve/import. Service account not required.",
      );
    } finally {
      setClaimBusy(false);
    }
  }

  async function runSeedImport() {
    if (!user) return;
    if (
      !window.confirm(
        "Import the spreadsheet seed (events, memories, squad, RSVPs)? Existing docs with the same IDs will be updated.",
      )
    ) {
      return;
    }
    setImportBusy(true);
    setError(null);
    setInfo(null);
    try {
      const counts = await importSpreadsheetSeed(user.uid);
      await load();
      setInfo(
        `Imported seed: ${counts.events} events, ${counts.memories} memories, ${counts.squad} squad, ${counts.rsvps} RSVPs.`,
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Import failed. Deploy latest firestore.rules so admins can create docs.",
      );
    } finally {
      setImportBusy(false);
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
        lede="Approve or reject submissions, and update event status for the public ticker."
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
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={claimBusy}
              onClick={() => void bootstrapClaim()}
            >
              {claimBusy ? "Requesting…" : "Request admin claim"}
            </button>
            <p className="text-muted">
              Optional. Bootstrap UID already works for approve/import without a
              service account.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <button
            type="button"
            className="btn-primary"
            disabled={importBusy}
            onClick={() => void runSeedImport()}
          >
            {importBusy ? "Importing…" : "Import spreadsheet seed"}
          </button>
          <p className="text-muted">
            Loads{" "}
            <code className="font-mono text-xs">/seed/midland.json</code> from
            the app (from the Excel export). No Firebase service account
            needed — uses your signed-in admin session.
          </p>
        </div>
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

      <section>
        <h2 className="mb-2 font-display text-xl font-bold">
          Event status ({approvedEvents.length})
        </h2>
        <p className="mb-4 text-sm text-muted">
          Changes show on the Happenings ticker when status is not Confirmed and
          a note is set.
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
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
