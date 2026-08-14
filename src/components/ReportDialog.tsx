"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { submitReport } from "@/lib/firebase/data";
import {
  REPORT_REASONS,
  REPORT_TARGET_LABEL,
  type ReportTargetType,
} from "@/lib/types";
import { accountDisplayName } from "@/lib/utils";
import { LEGAL_CONTACT_EMAIL } from "./LegalDoc";
import { Modal } from "./Modal";

export type ReportTarget = {
  type: ReportTargetType;
  /** Document id of the thing being reported; omitted for a general report. */
  id?: string;
  /** Title or name, shown back to the reporter and stored with the report. */
  label?: string;
};

/** Prefilled mail fallback for anyone who can't or won't file in-app. */
export function reportMailtoHref(target?: ReportTarget): string {
  const subject = target?.label
    ? `Report: ${target.label}`
    : "Report content or a user";
  const body = [
    "What are you reporting?",
    target?.label
      ? `${REPORT_TARGET_LABEL[target.type]}: ${target.label}`
      : "(event, story, profile or account)",
    "",
    "What's wrong with it?",
    "",
  ].join("\n");
  return `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

/**
 * Reports a piece of content or a member to the organizers.
 *
 * The report lands in the admin queue (`reports`), which only organizers can
 * read — filing one is a write the reporter can never read back. Reporting
 * needs an account so the queue can't be flooded anonymously; signed-out
 * visitors get the published email address instead.
 */
export function ReportDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: ReportTarget;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGeneral = target.type === "other";

  async function send() {
    if (!user) return;
    if (isGeneral && !details.trim()) {
      setError("Tell us what you're reporting so we can find it.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitReport({
        targetType: target.type,
        targetId: target.id,
        targetLabel: target.label,
        reason,
        details,
        userId: user.uid,
        reporterEmail: user.email,
        reporterName: accountDisplayName(user),
      });
      toast.success("Report sent. An organizer will review it.");
      setDetails("");
      setReason(REPORT_REASONS[0].value);
      onClose();
    } catch (err) {
      console.error(err);
      const msg = "Couldn't send that report. Check your connection and retry.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={isGeneral ? "Report content or a user" : "Report this"}
      description={
        target.label
          ? `${REPORT_TARGET_LABEL[target.type]} · ${target.label}`
          : "Tell the organizers about anything that breaks the content guidelines."
      }
      footer={
        user ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void send()}
              disabled={saving}
            >
              {saving ? "Sending…" : "Send report"}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      {!user ? (
        <div className="space-y-3 text-sm text-muted">
          <p>
            <Link href="/login" className="font-semibold text-blue hover:underline">
              Sign in
            </Link>{" "}
            to send a report from here, so an organizer can follow up with you.
          </p>
          <p>
            Or email{" "}
            <a
              href={reportMailtoHref(target)}
              className="font-semibold text-blue hover:underline"
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="field-label mb-2">What&apos;s wrong?</legend>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-2.5 text-sm text-ink"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    disabled={saving}
                    className="h-4 w-4 accent-red"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="form-row">
            <label className="field-label" htmlFor="report-details">
              Details {isGeneral ? "" : "— optional"}
            </label>
            <textarea
              id="report-details"
              className="field min-h-[96px]"
              value={details}
              maxLength={2000}
              disabled={saving}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                isGeneral
                  ? "Which event, story, profile or person, and what's wrong with it?"
                  : "Anything the organizers should know."
              }
            />
          </div>

          {error && <p className="text-sm font-medium text-red-ink">{error}</p>}

          <p className="text-sm text-muted">
            Reports go to the organizers only. They can hide or delete the content
            and take action on the account. You can also email{" "}
            <a
              href={reportMailtoHref(target)}
              className="font-semibold text-blue hover:underline"
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      )}
    </Modal>
  );
}

/** The standard trigger: a quiet text button that opens the dialog. */
export function ReportButton({
  target,
  className = "text-sm font-semibold text-muted hover:text-red-ink",
  label = "Report",
}: {
  target: ReportTarget;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <ReportDialog open={open} onClose={() => setOpen(false)} target={target} />
    </>
  );
}
