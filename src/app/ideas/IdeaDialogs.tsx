"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { AttributionField } from "@/components/AttributionField";
import { TagPicker } from "@/components/TagChips";
import { useHostCandidates } from "@/lib/useHostCandidates";
import type { AudienceGroup, EventIdea } from "@/lib/types";
import type { IdeaFields } from "@/lib/firebase/data";
import { todayIso } from "@/lib/utils";

/**
 * Post a new idea, or edit one you posted.
 *
 * Mount it only while the composer is open: the draft is seeded on mount, so a
 * live Firestore update to the same idea can't yank the fields out from under
 * whoever is typing. The footer submit reaches the form through `form=`,
 * because the dialog body scrolls in its own container.
 */
export function IdeaComposerDialog({
  initial,
  onClose,
  onSave,
  saving,
}: {
  /** The idea being edited; omit to post a new one. */
  initial?: EventIdea;
  onClose: () => void;
  onSave: (fields: IdeaFields) => void;
  saving: boolean;
}) {
  const formId = `idea-composer-${initial?.id || "new"}`;
  const [title, setTitle] = useState(initial?.title || "");
  const [pitch, setPitch] = useState(initial?.pitch || "");
  const [timeframe, setTimeframe] = useState(initial?.timeframe || "");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave({ title, pitch, timeframe });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Edit this idea" : "Post an idea"}
      description={
        initial
          ? undefined
          : "Half-formed is fine. Someone else can pick it up and put a date on it."
      }
      footer={
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
            type="submit"
            form={formId}
            className="btn btn-primary btn-sm"
            disabled={saving}
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Post it"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-title`}>
            The idea
          </label>
          <input
            id={`${formId}-title`}
            className="field"
            required
            maxLength={140}
            disabled={saving}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sunrise paddle on the Tittabawassee"
          />
        </div>
        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-pitch`}>
            The pitch{" "}
            <span className="field-hint">— why it&apos;d be a good time</span>
          </label>
          <textarea
            id={`${formId}-pitch`}
            className="field min-h-[120px]"
            required
            maxLength={2000}
            disabled={saving}
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="What it is, what it'd take, who'd love it."
          />
        </div>
        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-timeframe`}>
            Roughly when{" "}
            <span className="field-hint">— optional, no date needed yet</span>
          </label>
          <input
            id={`${formId}-timeframe`}
            className="field"
            maxLength={80}
            disabled={saving}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            placeholder="e.g. any Saturday before it snows"
          />
        </div>
      </form>
    </Modal>
  );
}

export type ScheduleFields = {
  title: string;
  host: string;
  hostUserId: string;
  date: string;
  time: string;
  location: string;
  description: string;
  tags: string[];
};

/**
 * Put a date on an idea.
 *
 * This files an ordinary event submission — it joins the same approval queue as
 * anything sent from `/submit` — and then marks the idea scheduled. Whoever
 * fills it in hosts, unless they hand it to someone else.
 */
export function ScheduleIdeaDialog({
  idea,
  myName,
  myUserId,
  myGroups,
  onClose,
  onSchedule,
  saving,
}: {
  idea: EventIdea;
  myName: string;
  myUserId: string;
  /** Audience groups the signed-in member belongs to. */
  myGroups: AudienceGroup[];
  onClose: () => void;
  onSchedule: (fields: ScheduleFields) => void;
  saving: boolean;
}) {
  const formId = `schedule-idea-${idea.id}`;
  const people = useHostCandidates();
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.pitch);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [hostedByOther, setHostedByOther] = useState(false);
  const [otherHost, setOtherHost] = useState("");
  const [otherHostUserId, setOtherHostUserId] = useState("");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const allowed = new Set(myGroups.map((g) => g.slug));
    onSchedule({
      title,
      host: (hostedByOther ? otherHost : myName).trim(),
      hostUserId: hostedByOther ? otherHostUserId : myUserId,
      date,
      time,
      location,
      description,
      // Enforce membership even if the picker is bypassed.
      tags: tags.filter((t) => allowed.has(t)),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Put a date on it"
      description={`“${idea.title}” goes to the organizers as an event submission.`}
      footer={
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
            type="submit"
            form={formId}
            className="btn btn-primary btn-sm"
            disabled={saving}
          >
            {saving ? "Sending…" : "Schedule it"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-title`}>
            Event title
          </label>
          <input
            id={`${formId}-title`}
            className="field"
            required
            disabled={saving}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <AttributionField
          idPrefix={`${formId}-host`}
          label="Host"
          myName={myName}
          selfHint="— your account name"
          toggleLabel="Someone else is hosting"
          otherLabel="Host's name"
          otherPlaceholder="Who's running this one?"
          byOther={hostedByOther}
          onByOtherChange={setHostedByOther}
          otherName={otherHost}
          onOtherNameChange={setOtherHost}
          people={people}
          otherUserId={otherHostUserId}
          onOtherUserIdChange={setOtherHostUserId}
          taggedHint="They'll be able to edit this event too."
          disabled={saving}
        />

        <div className="form-row two-col">
          <div>
            <label className="field-label" htmlFor={`${formId}-date`}>
              Date
            </label>
            <input
              id={`${formId}-date`}
              className="field"
              type="date"
              required
              min={todayIso()}
              disabled={saving}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`${formId}-time`}>
              Time
            </label>
            <input
              id={`${formId}-time`}
              className="field"
              type="time"
              required
              disabled={saving}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-location`}>
            Location
          </label>
          <input
            id={`${formId}-location`}
            className="field"
            required
            disabled={saving}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Where's it happening?"
          />
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-description`}>
            Description
          </label>
          <textarea
            id={`${formId}-description`}
            className="field min-h-[120px]"
            required
            disabled={saving}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {myGroups.length > 0 && (
          <div className="form-row">
            <div className="field-label">Invite audience groups</div>
            <TagPicker
              groups={myGroups}
              selected={tags}
              onChange={setTags}
              idPrefix={`${formId}-tag`}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
