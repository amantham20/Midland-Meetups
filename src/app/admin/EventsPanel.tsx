"use client";

import { useMemo, useState } from "react";
import { EventEditModal } from "@/components/EventEditModal";
import { StatusPill } from "@/components/StatusPill";
import { TagChips } from "@/components/TagChips";
import {
  Icons,
  PencilIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/Icons";
import { groupNameMap } from "@/lib/audience";
import type { AudienceGroup, MeetupEvent } from "@/lib/types";
import { todayIso } from "@/lib/utils";
import { EmptyState, FilterChips, SectionHeading } from "./ui";

type Filter = "upcoming" | "past" | "pending" | "hidden" | "all";

/** Month/day for the little calendar tile on each row. */
function dateTile(iso: string): { month: string; day: string } {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return { month: "—", day: "?" };
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: String(d.getDate()),
  };
}

export function EventsPanel({
  events,
  groups,
  busyId,
  onSaved,
  onSetPublished,
  onDelete,
}: {
  /** Every event, approved or not — admins can edit any of them. */
  events: MeetupEvent[];
  groups: AudienceGroup[];
  busyId: string | null;
  /** Reload admin data after an edit lands. */
  onSaved: () => void;
  onSetPublished: (event: MeetupEvent, published: boolean) => void;
  onDelete: (event: MeetupEvent) => void;
}) {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const labels = useMemo(() => groupNameMap(groups), [groups]);
  const today = todayIso();

  const counts = useMemo(
    () => ({
      all: events.length,
      upcoming: events.filter((e) => e.date >= today).length,
      past: events.filter((e) => e.date < today).length,
      pending: events.filter((e) => !e.approved && !e.hidden).length,
      hidden: events.filter((e) => !e.approved && e.hidden).length,
    }),
    [events, today],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => {
        if (filter === "upcoming" && e.date < today) return false;
        if (filter === "past" && e.date >= today) return false;
        if (filter === "pending" && (e.approved || e.hidden)) return false;
        if (filter === "hidden" && !(!e.approved && e.hidden)) return false;
        if (!q) return true;
        return [e.title, e.location, e.host]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q));
      })
      .sort((a, b) =>
        filter === "past" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
      );
  }, [events, filter, query, today]);

  const editing = editingId ? events.find((e) => e.id === editingId) : null;

  return (
    <section>
      <SectionHeading
        title="All events"
        count={events.length}
        hint="Edit any event end to end — details, status note for the Happenings ticker, and which audience groups can see it. Hide takes it off the board for every member at once; delete removes it for good."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="field pl-9"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, place, host…"
            aria-label="Search events"
          />
        </div>
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "upcoming", label: "Upcoming", count: counts.upcoming },
            { value: "past", label: "Past", count: counts.past },
            { value: "pending", label: "Pending", count: counts.pending },
            { value: "hidden", label: "Hidden", count: counts.hidden },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Icons.calendar}
          title={
            events.length === 0
              ? "No events yet"
              : "Nothing matches those filters"
          }
          hint={
            events.length === 0
              ? "Events show up here as soon as someone submits one."
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((e) => (
            <article
              key={e.id}
              className="card card-hover flex flex-wrap items-start gap-4 p-4"
            >
              <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-surface-2 py-2 text-center">
                <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">
                  {dateTile(e.date).month}
                </span>
                <span className="font-display text-xl leading-tight font-bold text-ink">
                  {dateTile(e.date).day}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-bold text-ink">
                    {e.title}
                  </h3>
                  <StatusPill status={e.status} />
                  {!e.approved &&
                    (e.hidden ? (
                      <span className="badge badge-red">
                        Hidden from everyone
                      </span>
                    ) : (
                      <span className="badge badge-amber">
                        Awaiting approval
                      </span>
                    ))}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    {Icons.clock} {e.time}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {Icons.pin} {e.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <UsersIcon className="h-4 w-4" /> {e.host}
                  </span>
                </div>
                {e.statusNote && (
                  <p className="mt-1.5 text-sm font-medium text-yellow-ink">
                    “{e.statusNote}”
                  </p>
                )}
                <div className="mt-2">
                  <TagChips
                    tags={e.tags || []}
                    labels={labels}
                    emptyLabel="Visible to everyone"
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditingId(e.id)}
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === e.id}
                  onClick={() => onSetPublished(e, !e.approved)}
                >
                  {busyId === e.id
                    ? "Saving…"
                    : e.approved
                      ? "Hide from everyone"
                      : "Publish"}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busyId === e.id}
                  onClick={() => onDelete(e)}
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <EventEditModal
          key={editing.id}
          event={editing}
          groups={groups}
          onClose={() => setEditingId(null)}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
