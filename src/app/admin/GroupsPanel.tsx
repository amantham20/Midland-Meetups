"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import {
  AlertIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
  TrashIcon,
} from "@/components/Icons";
import { parseEmailList } from "@/lib/audience";
import type { AudienceGroup, SquadMember } from "@/lib/types";
import { EmptyState, SectionHeading } from "./ui";

export function GroupsPanel({
  groups,
  squad,
  unmatchedEmails,
  busy,
  onSaveGroup,
  onDeleteGroup,
  onSetMemberEmail,
}: {
  groups: AudienceGroup[];
  /** Sorted by name. */
  squad: SquadMember[];
  unmatchedEmails: string[];
  busy: boolean;
  onSaveGroup: (input: {
    id?: string;
    name: string;
    emails: string[];
  }) => Promise<void>;
  onDeleteGroup: (id: string) => void;
  onSetMemberEmail: (memberId: string, email: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [extraEmails, setExtraEmails] = useState("");
  /** Emails typed in the picker for members that don't have one saved yet. */
  const [emailPatches, setEmailPatches] = useState<Record<string, string>>({});
  const [pickerQuery, setPickerQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function emailFor(m: SquadMember): string {
    return (emailPatches[m.id] ?? m.email ?? "").trim();
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setMemberIds([]);
    setExtraEmails("");
    setEmailPatches({});
    setPickerQuery("");
    setFormError(null);
    setOpen(true);
  }

  function openEdit(g: AudienceGroup) {
    const emailSet = new Set(g.emails.map((e) => e.toLowerCase()));
    const selected = squad.filter((m) =>
      Boolean(m.email && emailSet.has(m.email.toLowerCase())),
    );
    const selectedEmails = new Set(
      selected.map((m) => (m.email || "").toLowerCase()),
    );
    setEditingId(g.id);
    setName(g.name);
    setMemberIds(selected.map((m) => m.id));
    setExtraEmails(
      g.emails.filter((e) => !selectedEmails.has(e.toLowerCase())).join("\n"),
    );
    setEmailPatches({});
    setPickerQuery("");
    setFormError(null);
    setOpen(true);
  }

  function toggleMember(id: string) {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const selectedEmails = useMemo(() => {
    const picked = memberIds
      .map((id) => squad.find((m) => m.id === id))
      .filter((m): m is SquadMember => Boolean(m))
      .map((m) => (emailPatches[m.id] ?? m.email ?? "").trim())
      .filter(Boolean);
    return parseEmailList([...picked, extraEmails].join("\n"));
  }, [memberIds, squad, emailPatches, extraEmails]);

  const pickerMembers = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return squad;
    return squad.filter((m) =>
      [m.name, m.email].filter(Boolean).some((v) => v.toLowerCase().includes(q)),
    );
  }, [squad, pickerQuery]);

  async function submit() {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Give the group a name.");
      return;
    }
    setSaving(true);
    try {
      // Persist any email typed in the picker before it becomes a group member.
      for (const id of memberIds) {
        const m = squad.find((x) => x.id === id);
        if (!m) continue;
        const email = emailFor(m);
        if (!email) {
          throw new Error(
            `${m.name || "That profile"} needs an email before joining a group.`,
          );
        }
        if (email.toLowerCase() !== (m.email || "").toLowerCase()) {
          await onSetMemberEmail(id, email);
        }
      }
      if (selectedEmails.length === 0) {
        throw new Error("Pick at least one member, or add an extra email.");
      }
      await onSaveGroup({
        id: editingId || undefined,
        name: name.trim(),
        emails: selectedEmails,
      });
      setOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Couldn't save that group.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-10">
      <div>
        <SectionHeading
          title="Audience groups"
          count={groups.length}
          hint="A group is a named list of emails. Tag an event with a group and only those people can see it."
          actions={
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openCreate}
            >
              <PlusIcon className="h-4 w-4" />
              New group
            </button>
          }
        />

        {groups.length === 0 ? (
          <EmptyState
            icon={<TagIcon className="h-5 w-5" />}
            title="No audience groups yet"
            hint="Create one to keep an event private to just part of the crew."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.map((g) => {
              const members = squad.filter(
                (m) => m.email && g.emails.includes(m.email.toLowerCase()),
              );
              const guests = g.emails.length - members.length;
              return (
                <article key={g.id} className="card card-hover p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-bold text-ink">
                        {g.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted">
                        <span className="font-mono">{g.slug}</span> ·{" "}
                        {g.emails.length} email
                        {g.emails.length === 1 ? "" : "s"}
                        {guests > 0 && ` · ${guests} off-squad`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(g)}
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-icon"
                        onClick={() => onDeleteGroup(g.id)}
                        aria-label={`Delete ${g.name}`}
                        title={`Delete ${g.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {members.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m) => (
                        <span key={m.id} className="badge badge-blue">
                          {m.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      No squad profiles matched — this group is emails only.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {unmatchedEmails.length > 0 && (
        <div>
          <SectionHeading
            title="Unlinked emails"
            count={unmatchedEmails.length}
            hint="These emails are in a group but aren't on any squad profile. Link one to connect that person."
          />
          <div className="card divide-y divide-border">
            {unmatchedEmails.map((email) => (
              <UnmatchedRow
                key={email}
                email={email}
                squad={squad}
                onLink={onSetMemberEmail}
              />
            ))}
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit group" : "New audience group"}
        description="Pick who's in it. Everyone selected needs an email on their profile."
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOpen(false)}
              disabled={saving || busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void submit()}
              disabled={saving || busy || !name.trim()}
            >
              {saving ? "Saving…" : editingId ? "Save group" : "Create group"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="field-label" htmlFor="group-name">
              Group name
            </label>
            <input
              id="group-name"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Core crew, Work friends"
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="field-label mb-0">Members</span>
              <span className="badge badge-blue">
                {memberIds.length} selected · {selectedEmails.length} email
                {selectedEmails.length === 1 ? "" : "s"}
              </span>
            </div>

            {squad.length === 0 ? (
              <p className="text-sm text-muted">
                No squad profiles yet — use the extra emails box below.
              </p>
            ) : (
              <>
                <div className="relative mb-2">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    className="field pl-9"
                    type="search"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Filter members…"
                    aria-label="Filter members"
                  />
                </div>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-1.5">
                  {pickerMembers.length === 0 && (
                    <p className="px-2 py-3 text-sm text-muted">
                      Nobody matches “{pickerQuery}”.
                    </p>
                  )}
                  {pickerMembers.map((m) => {
                    const checked = memberIds.includes(m.id);
                    const email = emailFor(m);
                    return (
                      <div
                        key={m.id}
                        className={[
                          "rounded-md px-2 py-2 transition-colors",
                          checked ? "bg-blue/8" : "hover:bg-surface-2",
                        ].join(" ")}
                      >
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 accent-[var(--blue)]"
                            checked={checked}
                            onChange={() => toggleMember(m.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {m.name || "Unnamed"}
                              {!m.approved && (
                                <span className="ml-1.5 badge badge-amber">
                                  pending
                                </span>
                              )}
                            </span>
                            <span className="block truncate font-mono text-xs text-muted">
                              {email || "no email yet"}
                            </span>
                          </span>
                        </label>
                        {checked && !m.email && (
                          <input
                            type="email"
                            className="field mt-2 py-1.5 text-sm"
                            placeholder="Add their email to include them"
                            value={emailPatches[m.id] ?? ""}
                            onChange={(e) =>
                              setEmailPatches((prev) => ({
                                ...prev,
                                [m.id]: e.target.value,
                              }))
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="field-label" htmlFor="group-extra-emails">
              Extra emails{" "}
              <span className="field-hint">
                — people who aren&apos;t on the squad, one per line
              </span>
            </label>
            <textarea
              id="group-extra-emails"
              className="field min-h-[72px] font-mono text-sm"
              value={extraEmails}
              onChange={(e) => setExtraEmails(e.target.value)}
              placeholder="guest@example.com"
            />
          </div>

          {formError && (
            <p className="flex items-start gap-2 rounded-md border border-red/30 bg-red/8 px-3 py-2.5 text-sm font-medium text-red-ink">
              <AlertIcon className="mt-0.5 h-4 w-4" />
              {formError}
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}

function UnmatchedRow({
  email,
  squad,
  onLink,
}: {
  email: string;
  squad: SquadMember[];
  onLink: (memberId: string, email: string) => Promise<void>;
}) {
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 p-3.5">
      <span className="min-w-[180px] flex-1 truncate font-mono text-sm text-ink">
        {email}
      </span>
      <select
        className="field max-w-[240px] py-2 text-sm"
        value={memberId}
        onChange={(e) => setMemberId(e.target.value)}
        aria-label={`Squad profile for ${email}`}
      >
        <option value="">Link to profile…</option>
        {squad.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || "Unnamed"}
            {m.email ? ` (${m.email})` : " — no email"}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={!memberId || busy}
        onClick={() => {
          setBusy(true);
          void onLink(memberId, email).finally(() => setBusy(false));
        }}
      >
        {busy ? "Linking…" : "Link"}
      </button>
    </div>
  );
}
