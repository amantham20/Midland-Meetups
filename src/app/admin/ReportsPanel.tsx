"use client";

import { useMemo, useState } from "react";
import { AlertIcon, CheckIcon, TrashIcon } from "@/components/Icons";
import {
  REPORT_TARGET_COLLECTION,
  REPORT_TARGET_LABEL,
  reportReasonLabel,
  type Report,
} from "@/lib/types";
import { AllClear, EmptyState, FilterChips, SectionHeading } from "./ui";

type Filter = "open" | "reviewed" | "all";

function formatFiled(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ReportCard({
  report,
  busy,
  targetExists,
  onSetStatus,
  onDeleteContent,
  onDeleteReport,
}: {
  report: Report;
  busy: boolean;
  /** False once the reported document is gone — deleted, or never a document. */
  targetExists: boolean;
  onSetStatus: (status: "open" | "reviewed") => void;
  onDeleteContent: () => void;
  onDeleteReport: () => void;
}) {
  const open = report.status === "open";
  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink">
            {reportReasonLabel(report.reason)}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="badge badge-neutral">
              {REPORT_TARGET_LABEL[report.targetType]}
            </span>
            {report.targetLabel && (
              <span className="font-semibold text-ink">{report.targetLabel}</span>
            )}
            {!targetExists && report.targetId && (
              <span className="badge badge-neutral">content already gone</span>
            )}
            <span>{formatFiled(report.createdAt)}</span>
          </div>
        </div>
        <span className={`badge ${open ? "badge-red" : "badge-neutral"}`}>
          {open ? "Open" : "Reviewed"}
        </span>
      </div>

      {report.details && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">
          {report.details}
        </p>
      )}

      <p className="text-xs text-muted">
        Filed by {report.reporterName || "a member"}
        {report.reporterEmail && (
          <>
            {" · "}
            <a
              href={`mailto:${report.reporterEmail}`}
              className="font-semibold text-blue hover:underline"
            >
              {report.reporterEmail}
            </a>
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy}
          onClick={() => onSetStatus(open ? "reviewed" : "open")}
        >
          <CheckIcon className="h-4 w-4" />
          {open ? "Mark reviewed" : "Reopen"}
        </button>
        {targetExists && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={onDeleteContent}
          >
            <TrashIcon className="h-4 w-4" />
            Delete the {REPORT_TARGET_LABEL[report.targetType].toLowerCase()}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={onDeleteReport}
        >
          Dismiss report
        </button>
      </div>
    </article>
  );
}

/**
 * The report queue. Reports are filed from the app (and the /report page) and
 * are readable by organizers only, so this is the only place they surface.
 */
export function ReportsPanel({
  reports: loaded,
  busyId,
  liveTargetIds,
  onSetStatus,
  onDeleteContent,
  onDeleteReport,
}: {
  /** null when the collection couldn't be read — not the same as empty. */
  reports: Report[] | null;
  busyId: string | null;
  /** Ids of every event, memory and profile still on file. */
  liveTargetIds: Set<string>;
  onSetStatus: (id: string, status: "open" | "reviewed") => void;
  onDeleteContent: (report: Report) => void;
  onDeleteReport: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const reports = useMemo(() => loaded || [], [loaded]);

  const openReports = useMemo(
    () => reports.filter((r) => r.status === "open"),
    [reports],
  );
  const reviewed = useMemo(
    () => reports.filter((r) => r.status === "reviewed"),
    [reports],
  );
  const shown =
    filter === "open" ? openReports : filter === "reviewed" ? reviewed : reports;

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Reports"
        count={openReports.length}
        hint="Filed from the app by members. Mark one reviewed once you've acted on it, or dismiss it to clear the queue."
        actions={
          <FilterChips<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: "Open", count: openReports.length },
              { value: "reviewed", label: "Reviewed", count: reviewed.length },
              { value: "all", label: "All", count: reports.length },
            ]}
          />
        }
      />

      {loaded === null ? (
        <EmptyState
          icon={<AlertIcon className="h-5 w-5" />}
          title="Couldn't read the reports queue"
          hint="Deploy the current firestore.rules — that's what grants organizers access to it — then reload."
        />
      ) : reports.length === 0 ? (
        <AllClear>No one has reported anything.</AllClear>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<AlertIcon className="h-5 w-5" />}
          title={filter === "open" ? "Nothing open" : "Nothing here"}
          hint="Switch the filter to see the rest."
        />
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              busy={busyId === r.id}
              targetExists={
                REPORT_TARGET_COLLECTION[r.targetType] !== null &&
                liveTargetIds.has(r.targetId)
              }
              onSetStatus={(status) => onSetStatus(r.id, status)}
              onDeleteContent={() => onDeleteContent(r)}
              onDeleteReport={() => onDeleteReport(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
