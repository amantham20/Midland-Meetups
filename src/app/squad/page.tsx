"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/PageHeader";
import { EmptyNote } from "@/components/EmptyNote";

/**
 * Squad data (Firestore + session cache) is browser-only. Loading the body
 * with ssr:false avoids hydrating member cards against an empty server shell.
 * (ssr:false must live in a Client Component in the App Router.)
 */
const SquadClient = dynamic(() => import("./SquadClient"), {
  ssr: false,
  loading: () => (
    <>
      <PageHeader
        kicker="Who's in it"
        title="The Squad"
        lede="The people who show up. Sign in to join or edit your profile. Email links you to audience groups for private events."
      />
      <section
        className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Squad members"
      >
        <div className="col-span-full">
          <EmptyNote>Loading the squad…</EmptyNote>
        </div>
      </section>
    </>
  ),
});

export default function SquadPage() {
  return <SquadClient />;
}
