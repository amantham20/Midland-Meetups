"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { TagPicker } from "@/components/TagChips";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast-store";
import { submitEvent, subscribeGroups } from "@/lib/firebase/data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { AudienceGroup } from "@/lib/types";
import { formatTimeDisplay } from "@/lib/utils";

export default function SubmitPage() {
  const { user, loading, configured } = useAuth();
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) return;
    return subscribeGroups(setGroups, (err) => console.error(err));
  }, [user]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      toast.info("Sign in to submit an event.");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    const timeRaw = String(fd.get("time") || "");
    const time = timeRaw ? formatTimeDisplay(timeRaw) : timeRaw;

    setSaving(true);
    setStatus("Sending…");
    toast.info("Submitting event…");
    try {
      await submitEvent({
        title: String(fd.get("title") || "").trim(),
        host: String(fd.get("host") || "").trim(),
        date: String(fd.get("date") || "").trim(),
        time,
        location: String(fd.get("location") || "").trim(),
        description: String(fd.get("description") || "").trim(),
        userId: user.uid,
        tags,
      });
      form.reset();
      setTags([]);
      const msg =
        "Event submitted! It'll show on the board once it's approved.";
      setStatus(msg);
      toast.success(msg);
    } catch (err) {
      console.error(err);
      const msg =
        "Couldn't submit that event. Check your connection and try again.";
      setStatus(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!configured) {
    return (
      <>
        <PageHeader
          kicker="Got an idea?"
          title="Submit an Event"
          lede="Propose something for the board."
        />
        <ConfigNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker="Got an idea?"
        title="Submit an Event"
        lede="Fill this out and it'll go to the organizer for review. Optionally limit the audience to specific groups (by email)."
      />

      {loading ? (
        <p className="text-muted">Checking sign-in…</p>
      ) : !user ? (
        <div className="form-card">
          <p className="mb-4 text-muted">
            You need an account to submit events — this keeps spam off the board
            without a shared plaintext password in the page source.
          </p>
          <Link href="/login?next=/submit" className="btn-primary">
            Sign in to continue
          </Link>
        </div>
      ) : (
        <form className="form-card" onSubmit={(e) => void onSubmit(e)}>
          <div className="form-row">
            <label className="field-label" htmlFor="title">
              Event title
            </label>
            <input
              className="field"
              id="title"
              name="title"
              required
              placeholder="e.g. Kayak Night at Sanford Lake"
            />
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="host">
              Host name
            </label>
            <input
              className="field"
              id="host"
              name="host"
              required
              defaultValue={user.displayName || ""}
              placeholder="Who's running this one?"
            />
          </div>
          <div className="form-row two-col">
            <div>
              <label className="field-label" htmlFor="date">
                Date
              </label>
              <input
                className="field"
                id="date"
                name="date"
                type="date"
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="time">
                Time
              </label>
              <input
                className="field"
                id="time"
                name="time"
                type="time"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="location">
              Location
            </label>
            <input
              className="field"
              id="location"
              name="location"
              required
              placeholder="Where's it happening?"
            />
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="description">
              Description{" "}
              <span className="field-hint">— what should people expect?</span>
            </label>
            <textarea
              className="field min-h-[120px]"
              id="description"
              name="description"
              required
              placeholder="What's the plan, what to bring, anything people should know."
            />
          </div>
          <div className="form-row">
            <div className="field-label">Audience groups</div>
            <TagPicker
              groups={groups}
              selected={tags}
              onChange={setTags}
              idPrefix="submit-tag"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            Send Submission
          </button>
          {status && <p className="mt-3 text-sm text-muted">{status}</p>}
        </form>
      )}
    </>
  );
}
