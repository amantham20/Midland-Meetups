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
      className="card card-hover group flex h-full w-full flex-col p-5 text-left transition-transform hover:-translate-y-0.5"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-display text-lg leading-snug font-bold text-balance text-ink transition-colors group-hover:text-blue">
          {event.title}
        </h3>
        <StatusPill status={event.status} />
      </div>

      {event.tags?.length > 0 && (
        <div className="mb-3">
          <TagChips tags={event.tags} labels={tagLabels} />
        </div>
      )}

      <div className="mb-4 space-y-1.5 text-sm text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5">
            {Icons.calendar} {formatDateShort(event.date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {Icons.clock} {formatTimeDisplay(event.time)}
          </span>
        </div>
        <div className="flex items-start gap-1.5">
          {Icons.pin}
          <span className="min-w-0 flex-1 truncate">{event.location}</span>
        </div>
      </div>

      <p className="mb-5 line-clamp-3 flex-1 text-sm leading-relaxed text-ink/75">
        {event.description}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3.5 text-sm">
        <span className="min-w-0 truncate text-muted">
          Hosted by <span className="font-medium text-ink">{event.host}</span>
        </span>
        {mine ? (
          <span
            className={`badge ${mine.status === "going" ? "badge-green" : "badge-neutral"}`}
          >
            {mine.status === "going" ? "You're going" : "Not going"}
          </span>
        ) : (
          <span className="shrink-0 font-medium text-muted">
            {goingCount > 0
              ? `${goingCount} going`
              : "No RSVPs yet"}
          </span>
        )}
      </div>
    </button>
  );
}
