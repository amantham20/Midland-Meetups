"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { StatusPill } from "@/components/StatusPill";
import { Icons } from "@/components/Icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeApprovedEvents,
  subscribeGroups,
  subscribeRsvps,
} from "@/lib/firebase/data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { AudienceGroup, MeetupEvent, Rsvp } from "@/lib/types";
import { filterEventsForViewer, groupNameMap } from "@/lib/audience";
import { formatDateShort, formatTimeDisplay, todayIso } from "@/lib/utils";
import { TagChips } from "@/components/TagChips";

function EventRsvpCard({
  event,
  rsvps,
  tagLabels,
}: {
  event: MeetupEvent;
  rsvps: Rsvp[];
  tagLabels?: Record<string, string>;
}) {
  const rows = rsvps.filter((r) => r.eventId === event.id);
  const going = rows.filter((r) => r.status === "going");
  const notGoing = rows.filter((r) => r.status === "not-going");

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">{event.title}</h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              {Icons.calendar} {formatDateShort(event.date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {Icons.clock} {formatTimeDisplay(event.time)}
            </span>
          </div>
          {event.tags?.length > 0 && (
            <div className="mt-2">
              <TagChips tags={event.tags} labels={tagLabels} />
            </div>
          )}
        </div>
        <StatusPill status={event.status} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-green">
            Going ({going.length})
          </h4>
          {going.length === 0 ? (
            <p className="text-sm text-muted">No one yet</p>
          ) : (
            <ul className="space-y-1 text-sm text-ink">
              {going.map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted">
            Can&apos;t make it ({notGoing.length})
          </h4>
          {notGoing.length === 0 ? (
            <p className="text-sm text-muted">No one yet</p>
          ) : (
            <ul className="space-y-1 text-sm text-ink">
              {notGoing.map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RsvpsPage() {
  const { configured, user, isAdmin } = useAuth();
  const [events, setEvents] = useState<MeetupEvent[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [loading, setLoading] = useState(() => isFirebaseConfigured());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsubE = subscribeApprovedEvents(
      (data) => {
        setEvents(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Couldn't load RSVPs.");
        setLoading(false);
      },
    );
    const unsubR = subscribeRsvps(setRsvps);
    return () => {
      unsubE();
      unsubR();
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) return;
    return subscribeGroups(setGroups, (err) => console.error(err));
  }, [user]);

  const visible = useMemo(
    () =>
      filterEventsForViewer(events, {
        userEmail: user?.email,
        isAdmin,
        groups,
      }),
    [events, user?.email, isAdmin, groups],
  );

  const tagLabels = useMemo(() => groupNameMap(groups), [groups]);

  const { upcoming, past } = useMemo(() => {
    const today = todayIso();
    return {
      upcoming: visible
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
      past: visible
        .filter((e) => e.date < today)
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [visible]);

  if (!configured) {
    return (
      <>
        <PageHeader
          kicker="Who's going"
          title="RSVPs"
          lede="Every event, and who's said they're going or can't make it."
        />
        <ConfigNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker="Who's going"
        title="RSVPs"
        lede="Every event, and who's said they're going or can't make it. Updates live when someone RSVPs on Happenings."
      />

      {loading && <EmptyNote>Loading RSVPs…</EmptyNote>}
      {error && <EmptyNote>{error}</EmptyNote>}
      {!loading && !error && visible.length === 0 && (
        <EmptyNote>No events yet.</EmptyNote>
      )}

      {!loading && !error && visible.length > 0 && (
        <>
          <h2 className="mb-3 font-display text-xl font-bold text-ink">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyNote>Nothing upcoming.</EmptyNote>
          ) : (
            upcoming.map((evt) => (
              <EventRsvpCard
                key={evt.id}
                event={evt}
                rsvps={rsvps}
                tagLabels={tagLabels}
              />
            ))
          )}

          {past.length > 0 && (
            <>
              <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink">
                Past
              </h2>
              {past.map((evt) => (
                <EventRsvpCard
                  key={evt.id}
                  event={evt}
                  rsvps={rsvps}
                  tagLabels={tagLabels}
                />
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}
