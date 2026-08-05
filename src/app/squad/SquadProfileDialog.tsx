"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SquadPhoto } from "@/components/SquadPhoto";
import { Icons } from "@/components/Icons";
import { initials } from "@/lib/utils";
import type { SquadMember } from "@/lib/types";
import { ModalShell } from "./ModalShell";

export interface ProfileDraft {
  name: string;
  occupation: string;
  age: string;
  gender: string;
  socialLink: string;
  bio: string;
  photoFile: File | null;
}

const ACCEPTED = ["image/jpeg", "image/png"];

/**
 * Create/edit form for your own squad profile. Lives in a dialog so the board
 * stays the page — the form is only on screen when you asked for it.
 */
export function SquadProfileDialog({
  member,
  email,
  defaultName = "",
  saving,
  status,
  onSubmit,
  onClose,
}: {
  /** null = creating a new profile */
  member: SquadMember | null;
  email: string;
  defaultName?: string;
  saving: boolean;
  status: string;
  onSubmit: (draft: ProfileDraft) => void;
  onClose: () => void;
}) {
  const editing = Boolean(member);
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  // Object URLs must be revoked or the blob sticks around for the tab's life.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  function onPickPhoto(file: File | null) {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (fileRef.current && !file) fileRef.current.value = "";
    if (!file) {
      setPicked(null);
      setPhotoError("");
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setPicked(null);
      setPhotoError("That photo needs to be a JPG or PNG.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setPhotoError("");
    setPicked({ file, url });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      name: String(fd.get("name") || "").trim(),
      occupation: String(fd.get("occupation") || "").trim(),
      age: String(fd.get("age") || "").trim(),
      gender: String(fd.get("gender") || "").trim(),
      socialLink: String(fd.get("socialLink") || "").trim(),
      bio: String(fd.get("bio") || "").trim(),
      photoFile: picked?.file || null,
    });
  }

  const formId = "squad-profile-form";

  return (
    <ModalShell
      titleId="squad-profile-title"
      title={editing ? "Edit your profile" : "Join the Squad"}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          {status && (
            <span className="mr-auto text-sm text-muted">{status}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-2 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            className="btn-primary"
            disabled={saving}
          >
            {saving
              ? editing
                ? "Saving…"
                : "Sending…"
              : editing
                ? "Save changes"
                : "Send profile"}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        {/* Photo first: a face, a button, no bare file input. */}
        <div className="mb-5 flex items-center gap-4">
          {picked ? (
            // Local object URL for the just-picked file — next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={picked.url}
              alt="Selected photo preview"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : member ? (
            <SquadPhoto member={member} sizeClass="h-20 w-20" />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-2 text-2xl font-bold text-muted"
              aria-hidden
            >
              {initials(defaultName) || "?"}
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink transition hover:border-blue hover:text-blue"
            >
              {Icons.camera}
              {picked
                ? "Choose a different photo"
                : editing
                  ? "Change photo"
                  : "Add a photo"}
            </button>
            <p className="mt-1.5 text-xs text-muted">
              {photoError ? (
                <span className="font-semibold text-red">{photoError}</span>
              ) : picked ? (
                <>
                  {picked.file.name} ·{" "}
                  <button
                    type="button"
                    onClick={() => onPickPhoto(null)}
                    className="font-semibold text-blue hover:underline"
                  >
                    Undo
                  </button>
                </>
              ) : (
                "Optional — JPG or PNG."
              )}
            </p>
            <input
              ref={fileRef}
              id="sq-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor="sq-name">
            Name
          </label>
          <input
            className="field"
            id="sq-name"
            name="name"
            required
            defaultValue={member?.name || defaultName}
            placeholder="What should people call you?"
          />
        </div>

        <div className="form-row two-col">
          <div>
            <label className="field-label" htmlFor="sq-occupation">
              Occupation
            </label>
            <input
              className="field"
              id="sq-occupation"
              name="occupation"
              required
              defaultValue={member?.occupation || ""}
              placeholder="What do you do?"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="sq-age">
              Age
            </label>
            <input
              className="field"
              id="sq-age"
              name="age"
              type="number"
              required
              min={1}
              max={120}
              defaultValue={member?.age || ""}
              placeholder="e.g. 29"
            />
          </div>
        </div>

        <div className="form-row two-col">
          <div>
            <label className="field-label" htmlFor="sq-gender">
              Pronouns / gender
            </label>
            <input
              className="field"
              id="sq-gender"
              name="gender"
              required
              defaultValue={member?.gender || ""}
              placeholder="e.g. she/her, he/him, they/them"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="sq-social">
              Social link <span className="field-hint">— optional</span>
            </label>
            <input
              className="field"
              id="sq-social"
              name="socialLink"
              type="url"
              defaultValue={member?.socialLink || ""}
              placeholder="https://instagram.com/yourname"
            />
          </div>
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor="sq-bio">
            Bio
          </label>
          <textarea
            className="field min-h-[100px]"
            id="sq-bio"
            name="bio"
            required
            defaultValue={member?.bio || ""}
            placeholder="A sentence or two about you — what brings you around, what you're into."
          />
        </div>

        <p className="text-xs text-muted">
          Saved to <span className="font-semibold text-ink">{email}</span> —
          your sign-in email links you to private event groups.
        </p>
      </form>
    </ModalShell>
  );
}
