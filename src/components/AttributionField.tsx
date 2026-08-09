"use client";

/**
 * "It's you, unless you say otherwise" name control.
 *
 * Replaces the free-text host / author inputs on the submission forms: the
 * signed-in account's name is used by default and a name box only appears when
 * the user ticks the "someone else" box.
 */
export function AttributionField({
  idPrefix,
  label,
  myName,
  selfHint,
  toggleLabel,
  otherLabel,
  otherPlaceholder,
  byOther,
  onByOtherChange,
  otherName,
  onOtherNameChange,
  disabled,
}: {
  idPrefix: string;
  /** Field heading, e.g. "Host". */
  label: string;
  /** Name resolved from the signed-in account. */
  myName: string;
  /** Small print under the account name, e.g. "— from your account". */
  selfHint?: string;
  /** Checkbox label, e.g. "Someone else is hosting". */
  toggleLabel: string;
  /** Label for the revealed name box, e.g. "Host's name". */
  otherLabel: string;
  otherPlaceholder?: string;
  byOther: boolean;
  onByOtherChange: (next: boolean) => void;
  otherName: string;
  onOtherNameChange: (next: string) => void;
  disabled?: boolean;
}) {
  const toggleId = `${idPrefix}-by-other`;
  const nameId = `${idPrefix}-other-name`;

  return (
    <div className="form-row">
      <span className="field-label">{label}</span>

      <div
        className={[
          "rounded-md border px-3.5 py-2.5 transition-colors",
          byOther
            ? "border-border bg-surface-2/40 opacity-60"
            : "border-blue/40 bg-blue/10",
        ].join(" ")}
      >
        <div className="text-sm font-semibold text-ink">
          {myName || "Your account"}
        </div>
        {selfHint && <div className="text-xs text-muted">{selfHint}</div>}
      </div>

      <label
        htmlFor={toggleId}
        className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-sm text-ink"
      >
        <input
          id={toggleId}
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-blue"
          checked={byOther}
          disabled={disabled}
          onChange={(e) => onByOtherChange(e.target.checked)}
        />
        {toggleLabel}
      </label>

      {byOther && (
        <div className="mt-2.5">
          <label className="field-label" htmlFor={nameId}>
            {otherLabel}
          </label>
          <input
            className="field"
            id={nameId}
            name={nameId}
            required
            disabled={disabled}
            value={otherName}
            onChange={(e) => onOtherNameChange(e.target.value)}
            placeholder={otherPlaceholder}
          />
        </div>
      )}
    </div>
  );
}
