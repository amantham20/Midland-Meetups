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
  subscribeRsvps,
} from "@/lib/firebase/data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { MeetupEvent, Rsvp } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { isWithinNextWeek } from "@/lib/utils";

export default function HappeningsPage() {
  const { user, configured } = useAuth();
  const [events, setEvents] = useState<MeetupEvent[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
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
        setError("Couldn't load events. Check your connection and Firestore rules.");
        setLoading(false);
      },
    );
    const unsubRsvps = subscribeRsvps(
      setRsvps,
      (err) => console.error(err),
    );
    return () => {
      unsubEvents();
      unsubRsvps();
    };
  }, []);

  const weekEvents = useMemo(
    () =>
      events
        .filter((e) => isWithinNextWeek(e.date))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [events],
  );

  const tickerUpdates = useMemo(
    () =>
      weekEvents.filter((e) => e.status !== "confirmed" && e.statusNote),
    [weekEvents],
  );

  const selected = events.find((e) => e.id === selectedId) || null;

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
        lede="Everything on the books between now and next week. Tap any card for the full details, host info, and to let people know if you're going."
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
      {error && (
        <EmptyNote>
          {error}
        </EmptyNote>
      )}
      {!loading && !error && weekEvents.length === 0 && (
        <EmptyNote>
          Nothing on the board for the next 7 days.{" "}
          <Link href="/submit" className="font-semibold text-blue hover:underline">
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
