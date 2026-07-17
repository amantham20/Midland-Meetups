"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EventCard } from "@/components/EventCard";
import { EventModal } from "@/components/EventModal";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { EnableNotifications } from "@/components/EnableNotifications";
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
        <div className="mb-6 overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex flex-wrap gap-3 px-4 py-3 text-sm">
            {tickerUpdates.map((e) => (
              <span key={e.id} className="text-muted">
                <strong className="text-ink">{e.title}</strong> —{" "}
                {STATUS_LABEL[e.status]}
                {e.statusNote ? `: ${e.statusNote}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <EmptyNote>Loading the week…</EmptyNote>}
      {error && <EmptyNote>{error}</EmptyNote>}
      {!loading && !error && weekEvents.length === 0 && (
        <EmptyNote>
          Nothing on the board for the next 7 days
          {!user
            ? " (sign in to see tagged group events)."
            : "."}{" "}
          <Link
            href="/submit"
            className="font-semibold text-blue hover:underline"
          >
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
