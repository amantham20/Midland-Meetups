import { STATUS_LABEL, type EventStatus } from "@/lib/types";

const STYLES: Record<EventStatus, string> = {
  confirmed: "badge-green",
  "rain-delay": "badge-amber",
  canceled: "badge-red",
  relocated: "badge-blue",
};

export function StatusPill({ status }: { status: EventStatus }) {
  if (status === "confirmed") return null;
  return (
    <span className={`badge ${STYLES[status]} shrink-0`}>
      <span
        className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
