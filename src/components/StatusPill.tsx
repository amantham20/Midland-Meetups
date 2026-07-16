import { STATUS_LABEL, type EventStatus } from "@/lib/types";

const STYLES: Record<EventStatus, string> = {
  confirmed: "bg-green/15 text-green",
  "rain-delay": "bg-yellow/25 text-[#8a6a12]",
  canceled: "bg-red/15 text-red",
  relocated: "bg-blue/15 text-blue-ink",
};

export function StatusPill({ status }: { status: EventStatus }) {
  if (status === "confirmed") return null;
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
