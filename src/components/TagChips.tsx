"use client";

export function TagChips({
  tags,
  labels,
  emptyLabel,
}: {
  tags: string[];
  /** slug → display name */
  labels?: Record<string, string>;
  emptyLabel?: string;
}) {
  if (!tags.length) {
    if (!emptyLabel) return null;
    return (
      <span className="text-xs font-medium text-muted">{emptyLabel}</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-full bg-blue/10 px-2.5 py-0.5 text-xs font-semibold text-blue"
        >
          {labels?.[t] || t}
        </span>
      ))}
    </div>
  );
}

export function TagPicker({
  groups,
  selected,
  onChange,
  idPrefix = "tag",
}: {
  groups: { slug: string; name: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  idPrefix?: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted">
        No groups yet. Admins can create audience groups on the Admin page.
      </p>
    );
  }

  function toggle(slug: string) {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        Leave all unchecked for <strong>everyone</strong>. Checked tags limit
        who can see the event (by email on those groups).
      </p>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => {
          const on = selected.includes(g.slug);
          return (
            <label
              key={g.slug}
              htmlFor={`${idPrefix}-${g.slug}`}
              className={[
                "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                on
                  ? "border-blue bg-blue text-white"
                  : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-ink",
              ].join(" ")}
            >
              <input
                id={`${idPrefix}-${g.slug}`}
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => toggle(g.slug)}
              />
              {g.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}
