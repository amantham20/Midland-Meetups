"use client";

import { useMemo, useState } from "react";
import { SearchIcon, SparkIcon, TrashIcon } from "@/components/Icons";
import type { Memory } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";
import { EmptyState, FilterChips, SectionHeading } from "./ui";

type Filter = "live" | "hidden" | "pending" | "all";

/**
 * Every Lore Letter story on file, live or not. Hiding one takes it off the
 * archive for every member at once; deleting removes it for good.
 */
export function LorePanel({
  memories,
  busyId,
  onSetPublished,
  onDelete,
}: {
  /** All stories, approved or not, newest first. */
  memories: Memory[];
  busyId: string | null;
  onSetPublished: (memory: Memory, published: boolean) => void;
  onDelete: (memory: Memory) => void;
}) {
  const [filter, setFilter] = useState<Filter>("live");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: memories.length,
      live: memories.filter((m) => m.approved).length,
      hidden: memories.filter((m) => !m.approved && m.hidden).length,
      pending: memories.filter((m) => !m.approved && !m.hidden).length,
    }),
    [memories],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      if (filter === "live" && !m.approved) return false;
      if (filter === "hidden" && !(!m.approved && m.hidden)) return false;
      if (filter === "pending" && (m.approved || m.hidden)) return false;
      if (!q) return true;
      return [m.title, m.author, m.text]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [memories, filter, query]);

  return (
    <section>
      <SectionHeading
        title="Lore Letter"
        count={memories.length}
        hint="Hide a story to pull it off the archive for everyone — it stays here so you can put it back. Delete removes it for good."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="field pl-9"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, storyteller, text…"
            aria-label="Search Lore Letter stories"
          />
        </div>
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "live", label: "Live", count: counts.live },
            { value: "hidden", label: "Hidden", count: counts.hidden },
            { value: "pending", label: "Pending", count: counts.pending },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<SparkIcon className="h-5 w-5" />}
          title={
            memories.length === 0
              ? "No stories yet"
              : "Nothing matches those filters"
          }
          hint={
            memories.length === 0
              ? "Stories show up here as soon as someone sends one in from The Lore Letter."
              : "Try a different search term or another filter."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((m) => {
            const busy = busyId === m.id;
            return (
              <article key={m.id} className="card card-hover p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-ink">
                        {m.title || "Untitled"}
                      </h3>
                      {m.approved ? (
                        <span className="badge badge-green">Live</span>
                      ) : m.hidden ? (
                        <span className="badge badge-red">Hidden</span>
                      ) : (
                        <span className="badge badge-amber">
                          Awaiting approval
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span>by {m.author || "someone"}</span>
                      {m.date && <span>{formatDateShort(m.date)}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => onSetPublished(m, !m.approved)}
                    >
                      {busy
                        ? "Saving…"
                        : m.approved
                          ? "Hide from everyone"
                          : "Publish"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busy}
                      onClick={() => onDelete(m)}
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>

                {m.text && (
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-ink/80">
                    {m.text}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
