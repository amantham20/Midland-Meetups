"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { GOAL_PRESETS, formatQuantity, type GoalPreset } from "@/lib/boards";
import { todayIso } from "@/lib/utils";
import type { GroupGoal } from "@/lib/types";
import type { GoalFields } from "@/lib/firebase/data";

/**
 * Start a group goal, or edit one you started.
 *
 * Mounted only while open, like the other dialogs here — the draft is seeded on
 * mount so a live update to the same goal can't overwrite what's being typed.
 */
export function GoalComposerDialog({
  initial,
  onClose,
  onSave,
  saving,
}: {
  /** The goal being edited; omit to start a new one. */
  initial?: GroupGoal;
  onClose: () => void;
  onSave: (fields: GoalFields) => void;
  saving: boolean;
}) {
  const formId = `goal-composer-${initial?.id || "new"}`;
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [unit, setUnit] = useState(initial?.unit || "");
  const [target, setTarget] = useState(initial ? String(initial.target) : "");
  const [deadline, setDeadline] = useState(initial?.deadline || "");

  function applyPreset(preset: GoalPreset) {
    setTitle(preset.title);
    setDescription(preset.description);
    setUnit(preset.unit);
    setTarget(String(preset.target));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave({
      title,
      description,
      unit,
      target: Number(target),
      deadline,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Edit this goal" : "Start a group goal"}
      description={
        initial
          ? undefined
          : "One target, everybody chipping in. The bar fills as people log what they've done."
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
            {saving ? "Saving…" : initial ? "Save changes" : "Start it"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        {!initial && (
          <div className="form-row">
            <span className="field-label">
              Start from{" "}
              <span className="field-hint">— or write your own below</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {GOAL_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={saving}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-title`}>
            Goal
          </label>
          <input
            id={`${formId}-title`}
            className="field"
            required
            maxLength={140}
            disabled={saving}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Group marathon"
          />
        </div>

        <div className="form-row two-col">
          <div>
            <label className="field-label" htmlFor={`${formId}-target`}>
              Target
            </label>
            <input
              id={`${formId}-target`}
              className="field"
              type="number"
              required
              min="0.01"
              step="any"
              disabled={saving}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="26.2"
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`${formId}-unit`}>
              Counted in
            </label>
            <input
              id={`${formId}-unit`}
              className="field"
              required
              maxLength={24}
              disabled={saving}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="miles"
            />
          </div>
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-description`}>
            What counts{" "}
            <span className="field-hint">— how people should log it</span>
          </label>
          <textarea
            id={`${formId}-description`}
            className="field min-h-[110px]"
            required
            maxLength={2000}
            disabled={saving}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Run it, walk it, treadmill it — log whatever you cover."
          />
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-deadline`}>
            Finish by <span className="field-hint">— optional</span>
          </label>
          <input
            id={`${formId}-deadline`}
            className="field"
            type="date"
            disabled={saving}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}

export type LogFields = { amount: number; note: string; date: string };

/** Add what you've put in toward a goal. */
export function LogProgressDialog({
  goal,
  remaining,
  onClose,
  onLog,
  saving,
}: {
  goal: GroupGoal;
  /** What's left before the group hits the target. */
  remaining: number;
  onClose: () => void;
  onLog: (fields: LogFields) => void;
  saving: boolean;
}) {
  const formId = `goal-log-${goal.id}`;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onLog({ amount: Number(amount), note, date });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Log progress"
      description={`${goal.title} — ${
        remaining > 0
          ? `${formatQuantity(remaining, goal.unit)} to go`
          : "target already met, pile it on"
      }`}
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
            {saving ? "Adding…" : "Add it"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        <div className="form-row two-col">
          <div>
            <label className="field-label" htmlFor={`${formId}-amount`}>
              How many {goal.unit || "units"}?
            </label>
            <input
              id={`${formId}-amount`}
              className="field"
              type="number"
              required
              min="0.01"
              step="any"
              autoFocus
              disabled={saving}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`${formId}-date`}>
              When
            </label>
            <input
              id={`${formId}-date`}
              className="field"
              type="date"
              required
              max={todayIso()}
              disabled={saving}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <label className="field-label" htmlFor={`${formId}-note`}>
            Note <span className="field-hint">— optional</span>
          </label>
          <input
            id={`${formId}-note`}
            className="field"
            maxLength={280}
            disabled={saving}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Rail Trail loop, took the long way back"
          />
        </div>
      </form>
    </Modal>
  );
}
