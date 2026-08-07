"use client";

import { useState } from "react";
import Link from "next/link";
import type { MeetupEvent, Rsvp, RsvpStatus } from "@/lib/types";
import {
  buildGoogleCalendarUrl,
  formatDateLong,
  formatTimeDisplay,
} from "@/lib/utils";
import { setRsvp } from "@/lib/firebase/data";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Modal } from "./Modal";
import { CheckIcon, Icons, XIcon } from "./Icons";
import { StatusPill } from "./StatusPill";

function MetaRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 text-muted">{icon}</span>
      <span className="min-w-0 flex-1 text-ink">{children}</span>
    </div>
  );
}

function EventModalBody({
  event,
  rsvps,
  onClose,
}: {
  event: MeetupEvent;
  rsvps: Rsvp[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.displayName || "");
  const [statusMsg, setStatusMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const mine = user
    ? rsvps.find((r) => r.eventId === event.id && r.userId === user.uid)
    : null;
  const going = rsvps.filter(
    (r) => r.eventId === event.id && r.status === "going",
  ).length;
  const notGoing = rsvps.filter(
    (r) => r.eventId === event.id && r.status === "not-going",
  ).length;

  async function handleRsvp(value: RsvpStatus) {
    if (!user) {
      setStatusMsg("Sign in to RSVP.");
      toast.info("Sign in to RSVP.");
      return;
    }
    const displayName = name.trim() || user.displayName || user.email || "Guest";
    if (!displayName.trim()) {
      setStatusMsg("Add your name first.");
      toast.info("Add your name first.");
      return;
    }

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
    <Modal
      open
      onClose={onClose}
      title={event.title}
      description={`Hosted by ${event.host}`}
      size="md"
      footer={
        <>
          <a
            href={buildGoogleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            {Icons.calendar} Add to Google Calendar
          </a>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {event.status !== "confirmed" && (
        <div className="mb-4">
          <StatusPill status={event.status} />
        </div>
      )}

      <div className="space-y-2.5 rounded-md border border-border bg-surface-2/50 px-4 py-3.5">
        <MetaRow icon={Icons.calendar}>{formatDateLong(event.date)}</MetaRow>
        <MetaRow icon={Icons.clock}>{formatTimeDisplay(event.time)}</MetaRow>
        <MetaRow icon={Icons.pin}>{event.location}</MetaRow>
      </div>

      {event.statusNote && (
        <p className="alert alert-info mt-4">
          <strong className="font-semibold">Update:</strong> {event.statusNote}
        </p>
      )}

      <p className="mt-5 text-[0.98rem] leading-relaxed whitespace-pre-wrap text-ink/90">
        {event.description}
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface-2/40 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-base font-bold text-ink">
            Are you going?
          </h3>
          <span className="text-sm tabular-nums text-muted">
            {`${going} going · ${notGoing} can’t make it`}
          </span>
        </div>

        {!user ? (
          <p className="text-sm text-muted">
            <Link href="/login" className="link">
              Sign in
            </Link>{" "}
            to RSVP and get event reminders.
          </p>
        ) : (
          <>
            <label className="field-label" htmlFor="rsvp-name">
              Name shown on RSVPs
            </label>
            <input
              id="rsvp-name"
              type="text"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={saving}
                aria-pressed={mine?.status === "going"}
                onClick={() => void handleRsvp("going")}
                className={
                  mine?.status === "going"
                    ? "btn bg-green text-white shadow-sm"
                    : "btn btn-secondary"
                }
              >
                <CheckIcon className="h-4 w-4" />
                I&apos;m going
              </button>
              <button
                type="button"
                disabled={saving}
                aria-pressed={mine?.status === "not-going"}
                onClick={() => void handleRsvp("not-going")}
                className={
                  mine?.status === "not-going"
                    ? "btn bg-ink text-white shadow-sm"
                    : "btn btn-secondary"
                }
              >
                <XIcon className="h-4 w-4" />
                Can&apos;t make it
              </button>
            </div>
          </>
        )}

        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {statusMsg ||
            (mine
              ? "Tap your answer again to clear it."
              : going + notGoing === 0
                ? "Be the first to say you're in."
                : "")}
        </p>
      </div>
    </Modal>
  );
}

export function EventModal({
  event,
  rsvps,
  onClose,
}: {
  event: MeetupEvent | null;
  rsvps: Rsvp[];
  onClose: () => void;
}) {
  if (!event) return null;
  // key remounts local form state when switching events
  return (
    <EventModalBody
      key={event.id}
      event={event}
      rsvps={rsvps}
      onClose={onClose}
    />
  );
}
