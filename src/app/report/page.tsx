"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { LEGAL_CONTACT_EMAIL } from "@/components/LegalDoc";
import { ReportDialog, reportMailtoHref } from "@/components/ReportDialog";
import { useAuth } from "@/contexts/AuthContext";

/**
 * The one address that always works for a report, whatever page the content was
 * on: linked from the footer, and the web twin of More → Report on iOS. Each
 * event, story and profile also carries its own Report action.
 */
export default function ReportPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        kicker="Keeping the board civil"
        title="Report content or a user"
        lede="Tell the organizers about anything on the board that breaks the content guidelines — an event, a Lore story, a squad profile, or the person behind one."
      />

      <div className="form-card max-w-2xl space-y-4">
        <p className="text-muted">
          Reports go to the organizers only. They can hide or delete the content
          and take action on the account behind it. Every event, story and profile
          also has its own <strong className="text-ink">Report</strong> action —
          using that one attaches the report to the exact item.
        </p>

        {user ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setOpen(true)}
          >
            Report content or a user
          </button>
        ) : (
          <p className="text-muted">
            <Link href="/login?next=/report" className="font-semibold text-blue hover:underline">
              Sign in
            </Link>{" "}
            to file a report here, so an organizer can follow up with you.
          </p>
        )}

        <p className="text-sm text-muted">
          Prefer email, or can&apos;t sign in? Write to{" "}
          <a
            href={reportMailtoHref()}
            className="font-semibold text-blue hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>{" "}
          with enough detail to identify the content. Either way you&apos;ll get a
          reply. The full rules are in the{" "}
          <Link href="/terms" className="font-semibold text-blue hover:underline">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </div>

      <ReportDialog
        open={open}
        onClose={() => setOpen(false)}
        target={{ type: "other" }}
      />
    </>
  );
}
