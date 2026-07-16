"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MeetupEvent, Rsvp, RsvpStatus } from "@/lib/types";
import {
  buildGoogleCalendarUrl,
  formatDateLong,
  formatTimeDisplay,
} from "@/lib/utils";
import { setRsvp } from "@/lib/firebase/data";
import { useAuth } from "@/contexts/AuthContext";
import { Icons } from "./Icons";
import { StatusPill } from "./StatusPill";

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
  const [name, setName] = useState(user?.displayName || "");
  const [statusMsg, setStatusMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const mine = user
    ? rsvps.find((r) => r.eventId === event.id && r.userId === user.uid)
    : null;
  const going = rsvps.filter((r) => r.eventId === event.id && r.status === "going").length;
  const notGoing = rsvps.filter(
    (r) => r.eventId === event.id && r.status === "not-going",
  ).length;

  async function handleRsvp(value: RsvpStatus) {
    if (!user) {
      setStatusMsg("Sign in to RSVP.");
      return;
    }
    const displayName = name.trim() || user.displayName || user.email || "Guest";
    if (!displayName.trim()) {
      setStatusMsg("Add your name first.");
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
      setStatusMsg(
        next
          ? next === "going"
            ? "You're going!"
            : "Marked as not going."
          : "RSVP cleared.",
      );
    } catch (err) {
      console.error(err);
      setStatusMsg("Couldn't save that — check your connection and try again.");
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

        <a
          href={buildGoogleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 inline-flex text-sm font-semibold text-blue hover:text-blue-ink"
        >
          Add to Google Calendar
        </a>

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
              <label className="mb-2 block text-sm text-muted" htmlFor="rsvp-name">
                Name shown on RSVPs
              </label>
              <input
                id="rsvp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mb-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-blue"
              />
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
    </div>
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
    <EventModalBody key={event.id} event={event} rsvps={rsvps} onClose={onClose} />
  );
}
