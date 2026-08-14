"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AudienceGroup, MeetupEvent, Rsvp, RsvpStatus } from "@/lib/types";
import {
  accountDisplayName,
  buildGoogleCalendarUrl,
  formatDateLong,
  formatTimeDisplay,
} from "@/lib/utils";
import { setRsvp } from "@/lib/firebase/data";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { EventEditModal } from "./EventEditModal";
import { Icons, PencilIcon } from "./Icons";
import { ReportDialog } from "./ReportDialog";
import { StatusPill } from "./StatusPill";

function EventModalBody({
  event,
  rsvps,
  groups,
  onClose,
}: {
  event: MeetupEvent;
  rsvps: Rsvp[];
  /** All audience groups — passed through to the edit dialog. */
  groups: AudienceGroup[];
  onClose: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const myName = accountDisplayName(user);
  const mine = user
    ? rsvps.find((r) => r.eventId === event.id && r.userId === user.uid)
    : null;
  const [statusMsg, setStatusMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);

  // Whoever submitted it and whoever is tagged as host can fix their own
  // event; admins can fix any.
  const canEdit = Boolean(
    user &&
      (isAdmin ||
        (event.createdBy && event.createdBy === user.uid) ||
        (event.hostUserId && event.hostUserId === user.uid)),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // While a nested dialog is up it owns Escape — closing both at once
      // would throw away the draft and the event the user was reading.
      if (e.key === "Escape" && !editing && !reporting) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, editing, reporting]);

  const going = rsvps.filter((r) => r.eventId === event.id && r.status === "going").length;
  const notGoing = rsvps.filter(
    (r) => r.eventId === event.id && r.status === "not-going",
  ).length;

  async function handleRsvp(value: RsvpStatus) {
    if (!user) {
      setStatusMsg("Sign in to RSVP.");
      toast.info("Sign in to RSVP.");
      return;
    }
    // RSVPs always go on the list under the account's own name.
    const displayName = myName.trim() || user.email || "Guest";

    const next = mine?.status === value ? null : value;
    setSaving(true);
    setStatusMsg("Saving…");
    try {
      await setRsvp({
        eventId: event.id,
        userId: user.uid,
        name: displayName,
        status: next,
      });
      const msg = next
        ? next === "going"
          ? "You're going!"
          : "Marked as not going."
        : "RSVP cleared.";
      setStatusMsg(msg);
      toast.success(msg);
    } catch (err) {
      console.error(err);
      const msg = "Couldn't save that — check your connection and try again.";
      setStatusMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusPill status={event.status} />
            </div>
            <h2 id="event-modal-title" className="font-display text-2xl font-bold text-ink">
              {event.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-border px-2 py-1 text-sm text-muted hover:bg-surface-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 space-y-2 text-sm text-muted">
          <div className="flex items-center gap-2">
            {Icons.calendar} {formatDateLong(event.date)}
          </div>
          <div className="flex items-center gap-2">
            {Icons.clock} {formatTimeDisplay(event.time)}
          </div>
          <div className="flex items-center gap-2">
            {Icons.pin} {event.location}
          </div>
          <div>Hosted by {event.host}</div>
        </div>

        {event.statusNote && (
          <p className="mb-4 rounded-md bg-surface-2 px-3 py-2 text-sm text-ink">
            <strong>Update:</strong> {event.statusNote}
          </p>
        )}

        <p className="mb-6 whitespace-pre-wrap text-[0.98rem] leading-relaxed text-ink">
          {event.description}
        </p>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <a
            href={buildGoogleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-sm font-semibold text-blue hover:text-blue-ink"
          >
            Add to Google Calendar
          </a>
          {canEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditing(true)}
            >
              <PencilIcon className="h-4 w-4" />
              Edit event
            </button>
          )}
          <button
            type="button"
            className="ml-auto text-sm font-semibold text-muted hover:text-red-ink"
            onClick={() => setReporting(true)}
          >
            Report
          </button>
        </div>

        <div className="rounded-lg border border-border bg-surface-2/50 p-4">
          <div className="mb-2 text-sm font-semibold text-ink">Are you going?</div>
          {!user ? (
            <p className="text-sm text-muted">
              <Link href="/login" className="font-semibold text-blue hover:underline">
                Sign in
              </Link>{" "}
              to RSVP and get event reminders.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">
                You&apos;ll show up on the list as{" "}
                <strong className="font-semibold text-ink">
                  {myName || user.email}
                </strong>
                .
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleRsvp("going")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    mine?.status === "going"
                      ? "bg-green text-white"
                      : "border border-border bg-surface text-ink hover:bg-surface-2"
                  }`}
                >
                  I&apos;m going
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleRsvp("not-going")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    mine?.status === "not-going"
                      ? "bg-muted text-white"
                      : "border border-border bg-surface text-ink hover:bg-surface-2"
                  }`}
                >
                  Can&apos;t make it
                </button>
              </div>
            </>
          )}
          <p className="mt-3 text-sm text-muted">
            {statusMsg ||
              (going > 0 || notGoing > 0
                ? `${going} going · ${notGoing} can't make it`
                : "Be the first to say you're in.")}
          </p>
        </div>
      </div>

      {editing && (
        <EventEditModal
          event={event}
          groups={groups}
          onClose={() => setEditing(false)}
        />
      )}

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        target={{ type: "event", id: event.id, label: event.title }}
      />
    </div>
  );
}

export function EventModal({
  event,
  rsvps,
  groups = [],
  onClose,
}: {
  event: MeetupEvent | null;
  rsvps: Rsvp[];
  groups?: AudienceGroup[];
  onClose: () => void;
}) {
  if (!event) return null;
  // key remounts local form state when switching events
  return (
    <EventModalBody
      key={event.id}
      event={event}
      rsvps={rsvps}
      groups={groups}
      onClose={onClose}
    />
  );
}
