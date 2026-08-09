"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { AttributionField } from "./AttributionField";
import { TagChips, TagPicker } from "./TagChips";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { updateEventDetails } from "@/lib/firebase/data";
import { groupNameMap, groupsForEmail } from "@/lib/audience";
import type { AudienceGroup, EventStatus, MeetupEvent } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import {
  accountDisplayName,
  formatTimeDisplay,
  toTimeInputValue,
} from "@/lib/utils";

const STATUSES: EventStatus[] = [
  "confirmed",
  "rain-delay",
  "canceled",
  "relocated",
];

/**
 * Edit an event you submitted (or any event, if you're an admin).
 *
 * Mount it only while editing — the draft is seeded from `event` on mount, so
 * a live Firestore update to the same doc won't yank the fields out from under
 * whoever is typing.
 */
export function EventEditModal({
  event,
  groups,
  onClose,
  onSaved,
}: {
  event: MeetupEvent;
  /** All audience groups; the picker is narrowed to the editor's own. */
  groups: AudienceGroup[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  // The dialog body scrolls in its own container, so the submit button in the
  // footer reaches the form through `form=` rather than sitting inside it.
  const formId = `edit-event-${event.id}`;

  const myName = accountDisplayName(user);
  const [title, setTitle] = useState(event.title);
  const [byOther, setByOther] = useState(
    () => event.host.trim().toLowerCase() !== myName.trim().toLowerCase(),
  );
  const [otherHost, setOtherHost] = useState(() =>
    event.host.trim().toLowerCase() === myName.trim().toLowerCase()
      ? ""
      : event.host,
  );
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(() => toTimeInputValue(event.time));
  const [location, setLocation] = useState(event.location);
  const [description, setDescription] = useState(event.description);
  const [status, setStatus] = useState<EventStatus>(event.status);
  const [statusNote, setStatusNote] = useState(event.statusNote || "");
  const [tags, setTags] = useState<string[]>(event.tags || []);
  const [saving, setSaving] = useState(false);

  // Derived on every render, not frozen in state: `groups` streams in after
  // mount, and an empty list must not make every tag look locked.
  const editableGroups = isAdmin
    ? groups
    : groupsForEmail(groups, user?.email);
  const allowed = new Set(editableGroups.map((g) => g.slug));
  const selectableTags = tags.filter((t) => allowed.has(t));
  // Groups you're not in stay on the event untouched — an admin may have added
  // them, and dropping them silently would widen the audience.
  const lockedTags = tags.filter((t) => !allowed.has(t));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const host = (byOther ? otherHost : myName).trim();
    if (!host) {
      toast.error("Add a host name.");
      return;
    }

    const displayTime = time ? formatTimeDisplay(time) : "";
    const moved = date !== event.date || displayTime !== event.time;

    setSaving(true);
    try {
      await updateEventDetails(
        event.id,
        {
          title: title.trim(),
          host,
          date,
          time: displayTime,
          location: location.trim(),
          description: description.trim(),
          status,
          statusNote,
          tags,
        },
        { resetReminder: moved },
      );
      toast.success("Event updated.");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save those changes. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit event"
      description={
        event.approved
          ? "Changes go live on the board right away."
          : "This one is still waiting for approval — edits won't reset its place in the queue."
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={(e) => void onSubmit(e)}>
        <div className="form-row">
          <label className="field-label" htmlFor="edit-title">
            Event title
          </label>
          <input
            className="field"
            id="edit-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <AttributionField
          idPrefix="edit-host"
          label="Host"
          myName={myName}
          selfHint="— your account name"
          toggleLabel="Someone else is hosting"
          otherLabel="Host's name"
          otherPlaceholder="Who's running this one?"
          byOther={byOther}
          onByOtherChange={setByOther}
          otherName={otherHost}
          onOtherNameChange={setOtherHost}
          disabled={saving}
        />

        <div className="form-row two-col">
          <div>
            <label className="field-label" htmlFor="edit-date">
              Date
            </label>
            <input
              className="field"
              id="edit-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-time">
              Time
            </label>
            <input
              className="field"
              id="edit-time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor="edit-location">
            Location
          </label>
          <input
            className="field"
            id="edit-location"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor="edit-description">
            Description
          </label>
          <textarea
            className="field min-h-[120px]"
            id="edit-description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-row">
          <span className="field-label">Status</span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const on = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStatus(s)}
                  className={[
                    "rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue/30",
                    on
                      ? "border-blue bg-blue text-white"
                      : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-ink",
                  ].join(" ")}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor="edit-status-note">
            Status note{" "}
            <span className="field-hint">— shown on the Happenings ticker</span>
          </label>
          <input
            className="field"
            id="edit-status-note"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="e.g. Moved to Pavilion B"
          />
        </div>

        <div className="form-row">
          <span className="field-label">Invite audience groups</span>
          {editableGroups.length === 0 ? (
            <p className="text-sm text-muted">
              You&apos;re not in any audience groups, so there&apos;s nothing to
              change here.
            </p>
          ) : (
            <TagPicker
              groups={editableGroups}
              selected={selectableTags}
              onChange={(next) => setTags([...lockedTags, ...next])}
              idPrefix={`edit-tag-${event.id}`}
            />
          )}
          {lockedTags.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-muted">
                Also invited by an admin (you can&apos;t change these):
              </p>
              <TagChips tags={lockedTags} labels={groupNameMap(groups)} />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
