"use client";

import { useEffect, useState } from "react";
import { subscribeApprovedSquad } from "./firebase/data";
import { isFirebaseConfigured } from "./firebase/client";
import type { HostCandidate } from "./types";

/**
 * The people you can tag as a host: approved squad profiles that are linked to
 * an Auth account. Profiles without a `userId` can't be tagged — there'd be no
 * account to hand the event to — but their name can still be typed in.
 */
export function useHostCandidates(): HostCandidate[] {
  const [people, setPeople] = useState<HostCandidate[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return subscribeApprovedSquad(
      (members) => {
        setPeople(
          members
            .filter((m) => m.userId && m.name.trim())
            .map((m) => ({ userId: m.userId!, name: m.name.trim() }))
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
            ),
        );
      },
      (err) => console.error(err),
    );
  }, []);

  return people;
}
