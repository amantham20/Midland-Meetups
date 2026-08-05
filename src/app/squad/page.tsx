"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/PageHeader";
import { EmptyNote } from "@/components/EmptyNote";
import { SQUAD_HEADER } from "./header";

/**
 * Squad data (Firestore + session cache) is browser-only. Loading the body
 * with ssr:false avoids hydrating member cards against an empty server shell.
 * (ssr:false must live in a Client Component in the App Router.)
 */
const SquadClient = dynamic(() => import("./SquadClient"), {
  ssr: false,
  loading: () => (
    <>
      <PageHeader {...SQUAD_HEADER} />
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
