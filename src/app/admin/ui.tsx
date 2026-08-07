"use client";

import { CheckIcon } from "@/components/Icons";

/** Headline number with a label — the row of tiles at the top of the admin page. */
export function StatTile({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "neutral" | "blue" | "amber" | "green";
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    blue: "bg-blue/10 text-blue",
    amber: "bg-yellow/20 text-yellow-ink",
    green: "bg-green/12 text-green-ink",
  } as const;
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-xl font-bold leading-tight text-ink">
          {value}
        </span>
        <span className="block truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </span>
      </span>
    </div>
  );
}

/** Section title + optional count chip and right-aligned actions. */
export function SectionHeading({
  title,
  count,
  hint,
  actions,
}: {
  title: string;
  count?: number;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-ink">
          {title}
          {typeof count === "number" && (
            <span className="badge badge-neutral">{count}</span>
          )}
        </h2>
        {hint && <p className="mt-1 max-w-2xl text-sm text-muted">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Dashed placeholder used wherever a list has nothing in it. */
export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-surface-2/50 px-6 py-10 text-center">
      {icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-muted shadow-sm">
          {icon}
        </span>
      )}
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-muted">{hint}</p>}
    </div>
  );
}

/** Accessible on/off switch. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue/30 disabled:opacity-55",
          checked ? "bg-green" : "bg-surface-2 ring-1 ring-border ring-inset",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Segmented filter control (All / Approved / Pending …). */
export function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-full border border-border bg-surface p-1 shadow-sm">
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

/** Green “nothing left to do” panel for a cleared queue. */
export function AllClear({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-green/25 bg-green/8 px-5 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green/15 text-green-ink">
        <CheckIcon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-green-ink">{children}</p>
    </div>
  );
}
