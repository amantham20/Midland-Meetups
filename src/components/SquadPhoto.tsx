"use client";

import { memo } from "react";
import type { SquadMember } from "@/lib/types";
import { getCachedPhotoSrc } from "@/lib/photoCache";
import { initials } from "@/lib/utils";

function SquadPhotoInner({
  member,
  sizeClass = "mb-4 h-28 w-28",
}: {
  member: Pick<
    SquadMember,
    "id" | "name" | "photoBase64" | "photoMimeType" | "photoUrl"
  >;
  sizeClass?: string;
}) {
  const src = getCachedPhotoSrc({
    id: member.id,
    photoBase64: member.photoBase64,
    photoMimeType: member.photoMimeType,
    photoUrl: member.photoUrl,
  });

  if (!src) {
    return (
      <div
        className={`${sizeClass} flex items-center justify-center rounded-full bg-blue text-3xl font-bold text-white`}
        aria-hidden
      >
        {initials(member.name)}
      </div>
    );
  }

  return (
    // data: URLs / cached base64 — next/image not needed; browser keeps decoded frames
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={member.name}
      className={`${sizeClass} rounded-full object-cover`}
      loading="lazy"
      decoding="async"
      // Stable key via fingerprint so React doesn't thrash the img node
      data-photo-id={member.id}
    />
  );
}

export const SquadPhoto = memo(SquadPhotoInner, (prev, next) => {
  return (
    prev.member.id === next.member.id &&
    prev.member.photoBase64 === next.member.photoBase64 &&
    prev.member.photoUrl === next.member.photoUrl &&
    prev.member.name === next.member.name &&
    prev.sizeClass === next.sizeClass
  );
});
