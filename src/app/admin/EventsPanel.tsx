"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { StatusPill } from "@/components/StatusPill";
import { TagChips, TagPicker } from "@/components/TagChips";
import { Icons, PencilIcon, SearchIcon } from "@/components/Icons";
import { groupNameMap } from "@/lib/audience";
import type { AudienceGroup, EventStatus, MeetupEvent } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { formatDateShort, todayIso } from "@/lib/utils";
import { EmptyState, FilterChips, SectionHeading } from "./ui";

const STATUSES: EventStatus[] = [
  "confirmed",
  "rain-delay",
  "canceled",
  "relocated",
];

type Filter = "upcoming" | "past" | "all";

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
  onSave,
}: {
  /** Approved events, sorted by date ascending. */
  events: MeetupEvent[];
  groups: AudienceGroup[];
  busyId: string | null;
  onSave: (
    eventId: string,
    draft: { status: EventStatus; note: string; tags: string[] },
  ) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    status: EventStatus;
    note: string;
    tags: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const labels = useMemo(() => groupNameMap(groups), [groups]);
  const today = todayIso();

  const counts = useMemo(
    () => ({
      all: events.length,
      upcoming: events.filter((e) => e.date >= today).length,
      past: events.filter((e) => e.date < today).length,
    }),
    [events, today],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => {
        if (filter === "upcoming" && e.date < today) return false;
        if (filter === "past" && e.date >= today) return false;
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

  function startEdit(e: MeetupEvent) {
    setEditingId(e.id);
    setDraft({
      status: e.status,
      note: e.statusNote || "",
      tags: e.tags || [],
    });
  }

  function close() {
    setEditingId(null);
    setDraft(null);
  }

  async function submit() {
    if (!editingId || !draft) return;
    setSaving(true);
    try {
      await onSave(editingId, draft);
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Live events"
        count={events.length}
        hint="Set a status note for the Happenings ticker and choose which audience groups can see each event."
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
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Icons.calendar}
          title={
            events.length === 0
              ? "No approved events yet"
              : "Nothing matches those filters"
          }
          hint={
            events.length === 0
              ? "Approve an event from the Review tab and it will show up here."
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
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    {Icons.clock} {e.time}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {Icons.pin} {e.location}
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

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => startEdit(e)}
              >
                <PencilIcon className="h-4 w-4" />
                Edit
              </button>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing && draft)}
        onClose={close}
        title={editing?.title || "Edit event"}
        description={
          editing
            ? `${formatDateShort(editing.date)} · ${editing.time} · ${editing.location}`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={close}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void submit()}
              disabled={saving || busyId === editingId}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        {draft && (
          <div className="space-y-5">
            <div>
              <span className="field-label">Status</span>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => {
                  const on = draft.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDraft({ ...draft, status: s })}
                      className={[
                        "rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue/30",
                        on
                          ? "border-blue bg-blue text-white"
                          : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-ink",
                      ].join(" ")}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="event-note">
                Status note{" "}
                <span className="field-hint">— shown on the ticker</span>
              </label>
              <input
                id="event-note"
                className="field"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="e.g. Moved to Pavilion B"
              />
            </div>

            <div className="border-t border-border pt-4">
              <span className="field-label">Audience</span>
              <TagPicker
                groups={groups}
                selected={draft.tags}
                onChange={(tags) => setDraft({ ...draft, tags })}
                idPrefix={`evt-tag-${editingId}`}
              />
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
