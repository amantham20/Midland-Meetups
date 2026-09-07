"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { SquadPhoto } from "@/components/SquadPhoto";
import {
  MailIcon,
  PencilIcon,
  SearchIcon,
  UsersIcon,
} from "@/components/Icons";
import { groupsForEmail, normalizeEmail } from "@/lib/audience";
import type { AudienceGroup, SquadMember } from "@/lib/types";
import { EmptyState, FilterChips, SectionHeading, Toggle } from "./ui";

export type SquadDraft = {
  name: string;
  occupation: string;
  age: string;
  gender: string;
  email: string;
  socialLink: string;
  bio: string;
  approved: boolean;
};

export function draftFromMember(m: SquadMember): SquadDraft {
  return {
    name: m.name || "",
    occupation: m.occupation || "",
    age: m.age || "",
    gender: m.gender || "",
    email: m.email || "",
    socialLink: m.socialLink || "",
    bio: m.bio || "",
    approved: m.approved,
  };
}

type Filter = "all" | "live" | "pending" | "no-email";

export function SquadPanel({
  squad,
  groups,
  busyId,
  onSave,
  onSetApproved,
}: {
  squad: SquadMember[];
  groups: AudienceGroup[];
  busyId: string | null;
  onSave: (memberId: string, draft: SquadDraft) => Promise<void>;
  onSetApproved: (member: SquadMember, approved: boolean) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SquadDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const counts = useMemo(
    () => ({
      all: squad.length,
      live: squad.filter((m) => m.approved).length,
      pending: squad.filter((m) => !m.approved).length,
      noEmail: squad.filter((m) => !m.email).length,
    }),
    [squad],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return squad.filter((m) => {
      if (filter === "live" && !m.approved) return false;
      if (filter === "pending" && m.approved) return false;
      if (filter === "no-email" && m.email) return false;
      if (!q) return true;
      return [m.name, m.email, m.occupation, m.bio]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [squad, query, filter]);

  /**
   * Every email the admin could put on a profile: the ones already on a squad
   * profile plus everything that turns up in an audience group. `owner` is the
   * profile using it today, so the editor can refuse to hand the same email to
   * two people.
   */
  const emailChoices = useMemo(() => {
    const owner = new Map<string, SquadMember>();
    for (const m of squad) {
      const e = normalizeEmail(m.email);
      if (e && !owner.has(e)) owner.set(e, m);
    }
    const all = new Set<string>(owner.keys());
    for (const g of groups) {
      for (const e of g.emails) {
        const n = normalizeEmail(e);
        if (n) all.add(n);
      }
    }
    return Array.from(all)
      .sort()
      .map((email) => ({ email, owner: owner.get(email) ?? null }));
  }, [squad, groups]);

  /** The same list from the open profile's point of view — its own email is free. */
  const editingChoices = useMemo(
    () =>
      emailChoices.map(({ email, owner }) => ({
        email,
        takenBy:
          owner && owner.id !== editingId ? owner.name || "Unnamed" : null,
      })),
    [emailChoices, editingId],
  );

  const editing = editingId ? squad.find((m) => m.id === editingId) : null;

  function startEdit(m: SquadMember) {
    setEditingId(m.id);
    setDraft(draftFromMember(m));
  }

  function closeEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function patch(next: Partial<SquadDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));
  }

  async function submit() {
    if (!editingId || !draft) return;
    setSaving(true);
    try {
      await onSave(editingId, draft);
      closeEdit();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Squad profiles"
        count={squad.length}
        hint="Tap Edit to change someone's details. An email is what links a profile to their sign-in and to audience groups."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="field pl-9"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, occupation…"
            aria-label="Search squad profiles"
          />
        </div>
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "live", label: "Live", count: counts.live },
            { value: "pending", label: "Pending", count: counts.pending },
            { value: "no-email", label: "No email", count: counts.noEmail },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-5 w-5" />}
          title={
            squad.length === 0
              ? "No squad profiles yet"
              : "Nothing matches those filters"
          }
          hint={
            squad.length === 0
              ? "Profiles appear here once someone joins from The Squad page."
              : "Try a different search term or clear the filter."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((m) => {
            const memberGroups = groupsForEmail(groups, m.email);
            const busy = busyId === m.id;
            return (
              <article
                key={m.id}
                className="card card-hover flex flex-col overflow-hidden"
              >
                <div className="flex items-start gap-3 p-4">
                  <SquadPhoto
                    member={m}
                    sizeClass="h-12 w-12 shrink-0 ring-2 ring-border"
                    textClass="text-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="truncate font-display text-base font-bold text-ink">
                        {m.name || "Unnamed"}
                      </h3>
                      {m.approved ? (
                        <span className="badge badge-green">Live</span>
                      ) : (
                        <span className="badge badge-amber">Pending</span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted">
                      {[m.occupation, m.age, m.gender]
                        .filter(Boolean)
                        .join(" · ") || "No details yet"}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                      <MailIcon className="h-3.5 w-3.5 text-muted" />
                      {m.email ? (
                        <span className="truncate font-mono text-muted">
                          {m.email}
                        </span>
                      ) : (
                        <span className="badge badge-red">No email</span>
                      )}
                    </p>
                    {memberGroups.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {memberGroups.map((g) => (
                          <span key={g.id} className="badge badge-blue">
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border bg-surface-2/40 px-3 py-2.5">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => startEdit(m)}
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => void onSetApproved(m, !m.approved)}
                  >
                    {busy ? "Saving…" : m.approved ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(editing && draft)}
        onClose={closeEdit}
        title={`Edit ${editing?.name || "profile"}`}
        description="Changes go live on The Squad as soon as you save."
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeEdit}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void submit()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        {editing && draft && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="flex items-center gap-4 rounded-md border border-border bg-surface-2/50 p-3">
              <SquadPhoto
                member={editing}
                sizeClass="h-16 w-16 shrink-0 ring-2 ring-surface"
                textClass="text-xl"
              />
              <p className="text-sm text-muted">
                Photos are managed by the member from{" "}
                <span className="font-semibold text-ink">The Squad</span> page —
                everything else is editable here.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="edit-name">
                  Name
                </label>
                <input
                  id="edit-name"
                  className="field"
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="edit-email">
                  Email{" "}
                  <span className="field-hint">— links sign-in & groups</span>
                </label>
                <EmailField
                  key={editing.id}
                  value={draft.email}
                  onChange={(email) => patch({ email })}
                  choices={editingChoices}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="edit-occupation">
                  Occupation
                </label>
                <input
                  id="edit-occupation"
                  className="field"
                  value={draft.occupation}
                  onChange={(e) => patch({ occupation: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label" htmlFor="edit-age">
                    Age
                  </label>
                  <input
                    id="edit-age"
                    className="field"
                    value={draft.age}
                    onChange={(e) => patch({ age: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="edit-gender">
                    Gender
                  </label>
                  <input
                    id="edit-gender"
                    className="field"
                    value={draft.gender}
                    onChange={(e) => patch({ gender: e.target.value })}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="edit-social">
                  Social link <span className="field-hint">— optional</span>
                </label>
                <input
                  id="edit-social"
                  className="field"
                  value={draft.socialLink}
                  onChange={(e) => patch({ socialLink: e.target.value })}
                  placeholder="https://instagram.com/…"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="edit-bio">
                  Bio
                </label>
                <textarea
                  id="edit-bio"
                  className="field min-h-[96px]"
                  value={draft.bio}
                  onChange={(e) => patch({ bio: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-md border border-border p-3.5">
              <Toggle
                checked={draft.approved}
                onChange={(approved) => patch({ approved })}
                label="Published on The Squad"
                hint="Off keeps the profile hidden from the public board."
              />
            </div>
            {/* Enter-to-submit for the text inputs above */}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        )}
      </Modal>
    </section>
  );
}

/** Select value that means "none of the known emails — let me type one". */
const CUSTOM_EMAIL = "__custom__";

/**
 * Email picker for a squad profile: pick one of the emails the app already
 * knows about, or drop into a text box for a brand new one. Emails sitting on
 * another profile are listed but not selectable — email is what links a profile
 * to a sign-in, so two profiles must never share one.
 */
function EmailField({
  value,
  onChange,
  choices,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Sorted known emails; `takenBy` names the profile already using it. */
  choices: { email: string; takenBy: string | null }[];
}) {
  const [custom, setCustom] = useState(false);

  const free = choices.filter((c) => !c.takenBy);
  const taken = choices.filter((c) => c.takenBy);
  const current = normalizeEmail(value);
  // An email that isn't on the list (a fresh one being typed, or one only this
  // profile has) has no option to sit on — show the text box instead.
  const typing =
    custom || (Boolean(current) && !free.some((c) => c.email === current));

  return (
    <>
      <select
        id="edit-email"
        className="field"
        value={typing ? CUSTOM_EMAIL : current}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_EMAIL) {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(next);
        }}
      >
        <option value="">No email</option>
        {free.length > 0 && (
          <optgroup label="Known emails">
            {free.map((c) => (
              <option key={c.email} value={c.email}>
                {c.email}
              </option>
            ))}
          </optgroup>
        )}
        {taken.length > 0 && (
          <optgroup label="Already on another profile">
            {taken.map((c) => (
              <option key={c.email} value={c.email} disabled>
                {c.email} — {c.takenBy}
              </option>
            ))}
          </optgroup>
        )}
        <option value={CUSTOM_EMAIL}>Type a different email…</option>
      </select>
      {typing && (
        <input
          className="field mt-2"
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="name@example.com"
          aria-label="Email address"
        />
      )}
    </>
  );
}
