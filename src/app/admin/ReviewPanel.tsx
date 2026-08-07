"use client";

import { SquadPhoto } from "@/components/SquadPhoto";
import {
  CheckIcon,
  Icons,
  InboxIcon,
  SparkIcon,
  UsersIcon,
  XIcon,
} from "@/components/Icons";
import type { MeetupEvent, Memory, SquadMember } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";
import { AllClear, EmptyState, SectionHeading } from "./ui";

type Collection = "events" | "memories" | "squad";

function ReviewActions({
  busy,
  onApprove,
  onReject,
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={busy}
        onClick={onApprove}
      >
        <CheckIcon className="h-4 w-4" />
        {busy ? "Working…" : "Approve"}
      </button>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={busy}
        onClick={onReject}
      >
        <XIcon className="h-4 w-4" />
        Reject
      </button>
    </div>
  );
}

function ReviewCard({
  media,
  title,
  meta,
  body,
  busy,
  onApprove,
  onReject,
}: {
  media?: React.ReactNode;
  title: string;
  meta: React.ReactNode;
  body?: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="card card-hover flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
      {media}
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base font-bold text-ink">{title}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {meta}
        </div>
        {body && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/80">
            {body}
          </p>
        )}
      </div>
      <ReviewActions busy={busy} onApprove={onApprove} onReject={onReject} />
    </article>
  );
}

export function ReviewPanel({
  pendingEvents,
  pendingMemories,
  pendingSquad,
  busyId,
  onApprove,
  onReject,
}: {
  pendingEvents: MeetupEvent[];
  pendingMemories: Memory[];
  pendingSquad: SquadMember[];
  busyId: string | null;
  onApprove: (collection: Collection, id: string) => void;
  onReject: (collection: Collection, id: string) => void;
}) {
  const total =
    pendingEvents.length + pendingMemories.length + pendingSquad.length;

  if (total === 0) {
    return (
      <AllClear>
        Inbox zero — no events, memories, or profiles are waiting on you.
      </AllClear>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          title="Events"
          count={pendingEvents.length}
          hint="Approved events show up on Happenings and can be given a status and audience."
        />
        {pendingEvents.length === 0 ? (
          <EmptyState
            icon={<InboxIcon className="h-5 w-5" />}
            title="No events waiting"
          />
        ) : (
          <div className="space-y-3">
            {pendingEvents.map((e) => (
              <ReviewCard
                key={e.id}
                title={e.title}
                busy={busyId === e.id}
                meta={
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      {Icons.calendar} {formatDateShort(e.date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      {Icons.clock} {e.time}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      {Icons.pin} {e.location}
                    </span>
                    <span className="badge badge-neutral">host {e.host}</span>
                  </>
                }
                body={e.description}
                onApprove={() => onApprove("events", e.id)}
                onReject={() => onReject("events", e.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="Lore letters"
          count={pendingMemories.length}
          hint="Stories submitted by the crew for The Lore Letter."
        />
        {pendingMemories.length === 0 ? (
          <EmptyState
            icon={<SparkIcon className="h-5 w-5" />}
            title="No memories waiting"
          />
        ) : (
          <div className="space-y-3">
            {pendingMemories.map((m) => (
              <ReviewCard
                key={m.id}
                title={m.title}
                busy={busyId === m.id}
                meta={
                  <>
                    <span>by {m.author}</span>
                    {m.date && (
                      <span className="badge badge-neutral">{m.date}</span>
                    )}
                  </>
                }
                body={m.text}
                onApprove={() => onApprove("memories", m.id)}
                onReject={() => onReject("memories", m.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="Squad profiles"
          count={pendingSquad.length}
          hint="Approving publishes the profile on The Squad board."
        />
        {pendingSquad.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-5 w-5" />}
            title="No profiles waiting"
          />
        ) : (
          <div className="space-y-3">
            {pendingSquad.map((s) => (
              <ReviewCard
                key={s.id}
                busy={busyId === s.id}
                media={
                  <SquadPhoto
                    member={s}
                    sizeClass="h-14 w-14 shrink-0 ring-2 ring-border"
                  />
                }
                title={s.name}
                meta={
                  <>
                    {[s.occupation, s.age, s.gender]
                      .filter(Boolean)
                      .join(" · ") || "No details given"}
                    {s.email ? (
                      <span className="font-mono text-xs">{s.email}</span>
                    ) : (
                      <span className="badge badge-red">no email</span>
                    )}
                  </>
                }
                body={s.bio}
                onApprove={() => onApprove("squad", s.id)}
                onReject={() => onReject("squad", s.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
