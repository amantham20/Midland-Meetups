"use client";

import Link from "next/link";

/**
 * The furniture both member boards share — the idea board and the goals board
 * are the same page shape with a different card body, so the toolbar, filter
 * chips, card shell and sign-in wall live here rather than being written twice.
 */

/** Row above the cards: filters on the left, the compose button on the right. */
export function BoardToolbar({
  children,
  action,
}: {
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {action}
    </div>
  );
}

/** Segmented filter control. Counts are shown when a filter has any. */
export function BoardFilterChips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; count?: number }[];
  /** Screen-reader name for the group, e.g. "Filter ideas". */
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-1.5 rounded-full border border-border bg-surface p-1 shadow-sm"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue/30",
              on
                ? "bg-ink text-white"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            ].join(" ")}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span
                className={[
                  "rounded-full px-1.5 text-xs font-bold tabular-nums",
                  on ? "bg-white/20 text-white" : "bg-surface-2 text-muted",
                ].join(" ")}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Card shell. `dimmed` greys out what's been parked or archived. */
export function BoardCard({
  children,
  dimmed,
}: {
  children: React.ReactNode;
  dimmed?: boolean;
}) {
  return (
    <article
      className={[
        "card card-hover flex flex-col gap-3 p-5",
        dimmed ? "opacity-70" : "",
      ].join(" ")}
    >
      {children}
    </article>
  );
}

/** Title line with its badges, plus the byline underneath. */
export function BoardCardHead({
  title,
  badges,
  byline,
}: {
  title: string;
  badges?: React.ReactNode;
  byline?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">
          {title}
        </h2>
        {byline && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {byline}
          </div>
        )}
      </div>
      {badges && <div className="flex shrink-0 flex-wrap gap-1.5">{badges}</div>}
    </div>
  );
}

/**
 * Right-aligned strip of card actions, split off by a hairline. `mt-auto` sits
 * it on the bottom edge, so a short card in a row of tall ones still lines its
 * buttons up with its neighbours'.
 */
export function BoardCardActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
      {children}
    </div>
  );
}

/**
 * "You, Ada, Ben and 3 others" — the people behind a count, without turning the
 * card into a list. Pass everyone but the signed-in member in `names` and set
 * `includesYou`; they're pulled to the front as "You".
 */
export function PersonList({
  names,
  includesYou,
  max = 4,
  empty,
}: {
  /** Everyone except the signed-in member. */
  names: string[];
  includesYou?: boolean;
  max?: number;
  empty?: string;
}) {
  const ordered = includesYou ? ["You", ...names] : names;
  if (ordered.length === 0) {
    return empty ? (
      <span className="text-sm text-muted">{empty}</span>
    ) : null;
  }
  const shown = ordered.slice(0, max);
  const rest = ordered.length - shown.length;
  return (
    <span className="text-sm text-muted">
      {shown.join(", ")}
      {rest > 0 && ` and ${rest} other${rest === 1 ? "" : "s"}`}
    </span>
  );
}

/** Progress toward a target. `tone` goes green once the target is met. */
export function ProgressBar({
  percent,
  complete,
  label,
}: {
  percent: number;
  complete?: boolean;
  /** Announced to screen readers, e.g. "12 of 26.2 miles". */
  label: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div
        className={[
          "h-full rounded-full transition-[width] duration-500",
          complete ? "bg-green" : "bg-blue",
        ].join(" ")}
        style={{ width: `${Math.max(percent > 0 ? 2 : 0, percent)}%` }}
      />
    </div>
  );
}

/**
 * Both boards are members-only — nothing on them is public, so a signed-out
 * visitor gets this instead of an empty page.
 */
export function SignInWall({
  what,
  next,
}: {
  /** What they'd be joining, e.g. "the idea board". */
  what: string;
  /** Path to come back to after sign-in. */
  next: string;
}) {
  return (
    <div className="form-card">
      <p className="mb-4 text-muted">
        {what} is for members — sign in and you can post, weigh in and see who
        else is up for what.
      </p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-primary">
        Sign in to continue
      </Link>
    </div>
  );
}
