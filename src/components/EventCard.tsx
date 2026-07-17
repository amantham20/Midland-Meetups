"use client";

import type { MeetupEvent, Rsvp } from "@/lib/types";
import { formatDateShort, formatTimeDisplay } from "@/lib/utils";
import { Icons } from "./Icons";
import { StatusPill } from "./StatusPill";
import { TagChips } from "./TagChips";

export function EventCard({
  event,
  rsvps,
  myUserId,
  onOpen,
  tagLabels,
}: {
  event: MeetupEvent;
  rsvps: Rsvp[];
  myUserId?: string | null;
  onOpen: (id: string) => void;
  tagLabels?: Record<string, string>;
}) {
  const mine = myUserId
    ? rsvps.find((r) => r.eventId === event.id && r.userId === myUserId)
    : null;
  const goingCount = rsvps.filter(
    (r) => r.eventId === event.id && r.status === "going",
  ).length;

  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      className="flex w-full flex-col rounded-lg border border-border bg-surface p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold leading-snug text-ink">
          {event.title}
        </h3>
        <StatusPill status={event.status} />
      </div>
      {event.tags?.length > 0 && (
        <div className="mb-2">
          <TagChips tags={event.tags} labels={tagLabels} />
        </div>
      )}
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          {Icons.calendar} {formatDateShort(event.date)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {Icons.clock} {formatTimeDisplay(event.time)}
        </span>
      </div>
      <div className="mb-3 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          {Icons.pin} {event.location}
        </span>
      </div>
      <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-ink/80">
        {event.description}
      </p>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
        <span className="text-muted">Hosted by {event.host}</span>
        <span
          className={
            mine?.status === "going"
              ? "font-semibold text-green"
              : "font-medium text-muted"
          }
        >
          {mine
            ? mine.status === "going"
              ? "✓ You're going"
              : "Not going"
            : goingCount > 0
              ? `${goingCount} going`
              : "Tap for details"}
        </span>
      </div>
    </button>
  );
}
