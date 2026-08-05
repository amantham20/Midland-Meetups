"use client";

import { SquadPhoto } from "@/components/SquadPhoto";
import { Icons } from "@/components/Icons";
import type { SquadMember } from "@/lib/types";

/**
 * Grid card. Everything except the (own-profile) Edit button is one tap target
 * that opens the detail modal — details live there instead of crowding the card.
 */
export function SquadMemberCard({
  member,
  isMine,
  onOpen,
  onEdit,
}: {
  member: SquadMember;
  isMine: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const meta = [member.age, member.gender].filter(Boolean).join(" · ");

  return (
    <article
      className={`group relative flex flex-col items-center rounded-lg border bg-surface p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isMine ? "border-blue/40 ring-1 ring-blue/15" : "border-border"
      }`}
    >
      {isMine && (
        <span className="absolute left-3 top-3 rounded-full bg-blue/10 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-blue-ink">
          You
        </span>
      )}

      <SquadPhoto member={member} sizeClass="mb-3 h-20 w-20" />

      <h3 className="font-display text-lg font-bold leading-snug text-ink">
        {member.name}
      </h3>
      {member.occupation && (
        <p className="text-sm font-medium text-muted">{member.occupation}</p>
      )}
      {meta && <p className="mt-1 text-xs text-muted">{meta}</p>}

      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-ink/80">
        {member.bio}
      </p>

      <span className="mt-4 text-xs font-semibold text-blue transition group-hover:text-blue-ink">
        View profile
      </span>

      {/* Stretched hit area, after the content so it wins the click. */}
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
      >
        <span className="sr-only">View {member.name}&apos;s profile</span>
      </button>

      {isMine && (
        <button
          type="button"
          onClick={onEdit}
          className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-blue hover:text-blue"
        >
          <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{Icons.pencil}</span>
          Edit
        </button>
      )}
    </article>
  );
}
