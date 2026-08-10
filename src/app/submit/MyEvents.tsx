"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyNote } from "@/components/EmptyNote";
import { EventEditModal } from "@/components/EventEditModal";
import { Icons, PencilIcon } from "@/components/Icons";
import { StatusPill } from "@/components/StatusPill";
import { TagChips } from "@/components/TagChips";
import { useAuth } from "@/contexts/AuthContext";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { subscribeMyEvents } from "@/lib/firebase/data";
import { groupNameMap } from "@/lib/audience";
import type { AudienceGroup, MeetupEvent } from "@/lib/types";
import { formatDateShort, formatTimeDisplay, todayIso } from "@/lib/utils";

function EventRow({
  event,
  labels,
  myUserId,
  onEdit,
}: {
  event: MeetupEvent;
  labels: Record<string, string>;
  myUserId?: string;
  onEdit: (event: MeetupEvent) => void;
}) {
  // Someone else submitted it and tagged you as the host.
  const taggedIn = Boolean(myUserId && event.createdBy !== myUserId);

  return (
    <article className="card card-hover flex flex-wrap items-start gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base font-bold text-ink">
            {event.title}
          </h3>
          <StatusPill status={event.status} />
          {!event.approved && (
            <span className="badge badge-amber">Awaiting approval</span>
          )}
          {taggedIn && (
            <span className="badge badge-blue">Tagged as host</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            {Icons.calendar} {formatDateShort(event.date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {Icons.clock} {formatTimeDisplay(event.time)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {Icons.pin} {event.location}
          </span>
        </div>
        <div className="mt-1.5 text-sm text-muted">Hosted by {event.host}</div>
        {event.tags.length > 0 && (
          <div className="mt-2">
            <TagChips tags={event.tags} labels={labels} />
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onEdit(event)}
      >
        <PencilIcon className="h-4 w-4" />
        Edit
      </button>
    </article>
  );
}

/**
 * Events the signed-in user is responsible for: their own submissions —
 * including the ones still waiting for approval, which show up nowhere else —
 * plus any event that tagged them as host. All editable in place.
 */
export function MyEvents({ groups }: { groups: AudienceGroup[] }) {
  const { user } = useAuth();
  // Stamped with the uid it came from, so switching accounts reads as
  // "loading" instead of briefly showing the previous account's events.
  const [feed, setFeed] = useState<{
    uid: string;
    events: MeetupEvent[];
    error: string | null;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) return;
    const uid = user.uid;
    return subscribeMyEvents(
      uid,
      (data) => setFeed({ uid, events: data, error: null }),
      (err) => {
        console.error(err);
        setFeed({ uid, events: [], error: "Couldn't load your events." });
      },
    );
  }, [user]);

  const current = feed && feed.uid === user?.uid ? feed : null;
  const loading = !current;
  const events = useMemo(() => current?.events ?? [], [current]);
  const error = current?.error ?? null;

  const labels = useMemo(() => groupNameMap(groups), [groups]);

  const { upcoming, past } = useMemo(() => {
    const today = todayIso();
    return {
      upcoming: events
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
      past: events
        .filter((e) => e.date < today)
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [events]);

  const editing = editingId
    ? events.find((e) => e.id === editingId) || null
    : null;

  return (
    <section className="mt-14" aria-label="Your events">
      <div className="mb-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Yours to run
        </div>
        <h2 className="font-display text-[clamp(1.7rem,3.5vw,2.2rem)] font-bold tracking-tight">
          Events you host
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Everything you submitted, plus anything someone tagged you as host on.
          Change the details, move the date or flag a rain delay — edits to an
          approved event show on the board right away.
        </p>
      </div>

      {loading && <EmptyNote>Loading your events…</EmptyNote>}
      {error && <EmptyNote>{error}</EmptyNote>}
      {!loading && !error && events.length === 0 && (
        <EmptyNote>
          Nothing yet — send one in with the form above, or ask a host to tag
          you on theirs.
        </EmptyNote>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          {upcoming.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              labels={labels}
              myUserId={user?.uid}
              onEdit={(evt) => setEditingId(evt.id)}
            />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h3 className="mt-8 mb-3 font-display text-lg font-bold text-ink">
            Past
          </h3>
          <div className="space-y-3">
            {past.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                labels={labels}
                myUserId={user?.uid}
                onEdit={(evt) => setEditingId(evt.id)}
              />
            ))}
          </div>
        </>
      )}

      {editing && (
        <EventEditModal
          key={editing.id}
          event={editing}
          groups={groups}
          onClose={() => setEditingId(null)}
        />
      )}
    </section>
  );
}
