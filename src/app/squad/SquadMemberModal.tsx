"use client";

import { SquadPhoto } from "@/components/SquadPhoto";
import { Icons } from "@/components/Icons";
import type { SquadMember } from "@/lib/types";
import { ModalShell } from "./ModalShell";

/** Full profile view — the long bio and social link live here, not on the card. */
export function SquadMemberModal({
  member,
  isMine,
  onEdit,
  onClose,
}: {
  member: SquadMember;
  isMine: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const meta = [member.occupation, member.age, member.gender]
    .filter(Boolean)
    .join(" · ");

  return (
    <ModalShell
      titleId="squad-member-title"
      title={member.name}
      onClose={onClose}
      footer={
        member.socialLink || isMine ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {member.socialLink && (
              <a
                href={member.socialLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue hover:text-blue-ink"
              >
                {Icons.link} Follow
              </a>
            )}
            {isMine && (
              <button
                type="button"
                onClick={onEdit}
                className="btn-primary ml-auto"
              >
                <span className="mr-1.5">{Icons.pencil}</span> Edit profile
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
        <SquadPhoto member={member} sizeClass="mb-4 h-24 w-24 sm:mb-0" />
        <div>
          {meta && <p className="text-sm font-medium text-muted">{meta}</p>}
          <p className="mt-3 whitespace-pre-wrap text-[0.98rem] leading-relaxed text-ink">
            {member.bio}
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
