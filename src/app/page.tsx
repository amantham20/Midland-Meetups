"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EventCard } from "@/components/EventCard";
import { EventModal } from "@/components/EventModal";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { EnableNotifications } from "@/components/EnableNotifications";
import { AlertIcon } from "@/components/Icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeApprovedEvents,
  subscribeGroups,
  subscribeRsvps,
} from "@/lib/firebase/data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { AudienceGroup, MeetupEvent, Rsvp } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { filterEventsForViewer, groupNameMap } from "@/lib/audience";
import { isWithinNextWeek } from "@/lib/utils";

export default function HappeningsPage() {
  const { user, configured, isAdmin } = useAuth();
  const [events, setEvents] = useState<MeetupEvent[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => isFirebaseConfigured());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsubEvents = subscribeApprovedEvents(
      (data) => {
        setEvents(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(err);
        setError(
          "Couldn't load events. Check your connection and Firestore rules.",
        );
        setLoading(false);
      },
    );
    const unsubRsvps = subscribeRsvps(setRsvps, (err) => console.error(err));
    return () => {
      unsubEvents();
      unsubRsvps();
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) return;
    return subscribeGroups(setGroups, (err) => console.error(err));
  }, [user]);

  const visibleEvents = useMemo(
    () =>
      filterEventsForViewer(events, {
        userEmail: user?.email,
        isAdmin,
        groups,
      }),
    [events, user?.email, isAdmin, groups],
  );

  const weekEvents = useMemo(
    () =>
      visibleEvents
        .filter((e) => isWithinNextWeek(e.date))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [visibleEvents],
  );

  const tickerUpdates = useMemo(
    () =>
      weekEvents.filter((e) => e.status !== "confirmed" && e.statusNote),
    [weekEvents],
  );

  const tagLabels = useMemo(() => groupNameMap(groups), [groups]);
  const selected = visibleEvents.find((e) => e.id === selectedId) || null;

  if (!configured) {
    return (
      <>
        <PageHeader
          kicker="Next 7 days"
          title="Happenings This Week"
          lede="Everything on the books between now and next week."
        />
        <ConfigNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker="Next 7 days"
        title="Happenings This Week"
        lede="Everything on the books between now and next week. Tagged events only show if your email is in that group (or you're an admin)."
      />

      <EnableNotifications />

      {tickerUpdates.length > 0 && (
        <div className="card mb-8 flex items-start gap-4 p-4 sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-yellow/20 text-yellow-ink">
            <AlertIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Heads up</p>
            <ul className="mt-1.5 space-y-1 text-sm text-muted">
              {tickerUpdates.map((e) => (
                <li key={e.id}>
                  <span className="font-medium text-ink">{e.title}</span> —{" "}
                  {STATUS_LABEL[e.status]}
                  {e.statusNote ? `: ${e.statusNote}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {loading && <EmptyNote>Loading the week…</EmptyNote>}
      {error && <EmptyNote>{error}</EmptyNote>}
      {!loading && !error && weekEvents.length === 0 && (
        <EmptyNote>
          Nothing on the board for the next 7 days
          {!user ? " (sign in to see tagged group events)." : "."}{" "}
          <Link href="/submit" className="link">
            Submit an event
          </Link>{" "}
          to get something posted.
        </EmptyNote>
      )}

      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="This week's events"
      >
        {weekEvents.map((evt) => (
          <EventCard
            key={evt.id}
            event={evt}
            rsvps={rsvps}
            myUserId={user?.uid}
            onOpen={setSelectedId}
            tagLabels={tagLabels}
          />
        ))}
      </section>

      <EventModal
        event={selected}
        rsvps={rsvps}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
