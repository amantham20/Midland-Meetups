"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { Icons } from "@/components/Icons";
import { SquadPhoto } from "@/components/SquadPhoto";
import { useAuth } from "@/contexts/AuthContext";
import {
  submitSquadMember,
  subscribeApprovedSquad,
} from "@/lib/firebase/data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { SquadMember } from "@/lib/types";
import {
  membersContentKey,
  readSquadListCache,
} from "@/lib/photoCache";
import { resizeImageToBase64 } from "@/lib/utils";

export default function SquadPage() {
  const { user, configured } = useAuth();
  const [members, setMembers] = useState<SquadMember[]>(() => {
    const cached = readSquadListCache<SquadMember[]>();
    return cached ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (!isFirebaseConfigured()) return false;
    // If session cache has data, skip the loading spinner flash
    return !readSquadListCache<SquadMember[]>();
  });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const cached = readSquadListCache<SquadMember[]>();
    if (cached?.length) {
      lastKeyRef.current = membersContentKey(cached);
    }
    return subscribeApprovedSquad(
      (data) => {
        const key = membersContentKey(data);
        if (key === lastKeyRef.current) {
          setLoading(false);
          return;
        }
        lastKeyRef.current = key;
        setMembers(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(err);
        // Keep cached members if we already have them
        setError((prev) =>
          members.length || readSquadListCache()
            ? prev
            : "Couldn't load the squad.",
        );
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only subscription
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      setStatus("Sign in to join the squad.");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setStatus("Sending…");
    try {
      let photoBase64 = "";
      let photoMimeType = "image/jpeg";
      const file = (form.elements.namedItem("photo") as HTMLInputElement)
        ?.files?.[0];
      if (file) {
        if (file.type !== "image/jpeg" && file.type !== "image/png") {
          setStatus("That photo needs to be a JPG or PNG.");
          setSaving(false);
          return;
        }
        setStatus("Compressing photo…");
        const compressed = await resizeImageToBase64(file, 320, 0.72);
        photoBase64 = compressed.base64;
        photoMimeType = compressed.mimeType;
        setStatus("Sending…");
      }

      await submitSquadMember({
        name: String(fd.get("name") || "").trim(),
        occupation: String(fd.get("occupation") || "").trim(),
        age: String(fd.get("age") || "").trim(),
        gender: String(fd.get("gender") || "").trim(),
        socialLink: String(fd.get("socialLink") || "").trim(),
        bio: String(fd.get("bio") || "").trim(),
        photoBase64,
        photoMimeType,
        userId: user.uid,
      });
      form.reset();
      setStatus(
        "Sent! Your profile is in for review and will show up once approved.",
      );
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Check your connection and try again.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  }

  if (!configured) {
    return (
      <>
        <PageHeader
          kicker="Who's in it"
          title="The Squad"
          lede="The people who show up."
        />
        <ConfigNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker="Who's in it"
        title="The Squad"
        lede="The people who show up. Add yourself below and you'll show up here too, once it's been reviewed."
      />

      <section
        className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Squad members"
      >
        {loading && (
          <div className="col-span-full">
            <EmptyNote>Loading the squad…</EmptyNote>
          </div>
        )}
        {error && (
          <div className="col-span-full">
            <EmptyNote>{error}</EmptyNote>
          </div>
        )}
        {!loading && !error && members.length === 0 && (
          <div className="col-span-full">
            <EmptyNote>
              No profiles yet — be the first to join the squad below.
            </EmptyNote>
          </div>
        )}
        {members.map((m) => (
          <article
            key={m.id}
            className="rounded-lg border border-border bg-surface p-5 shadow-sm"
          >
            <SquadPhoto member={m} />
            <h3 className="font-display text-lg font-bold text-ink">{m.name}</h3>
            <div className="text-sm font-medium text-muted">{m.occupation}</div>
            {(m.age || m.gender) && (
              <div className="mt-1 text-sm text-muted">
                {[m.age, m.gender].filter(Boolean).join(" · ")}
              </div>
            )}
            <p className="mt-3 text-sm leading-relaxed text-ink/85">{m.bio}</p>
            {m.socialLink && (
              <a
                href={m.socialLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue hover:text-blue-ink"
              >
                {Icons.link} Follow
              </a>
            )}
          </article>
        ))}
      </section>

      <div className="mb-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          New here?
        </div>
        <h2 className="font-display text-[clamp(1.7rem,3.5vw,2.2rem)] font-bold tracking-tight">
          Join the Squad
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Tell us a bit about yourself. A photo is optional — it&apos;s compressed
          and stored with your profile (no separate file storage). Age and gender
          are shown publicly.
        </p>
      </div>

      {!user ? (
        <div className="form-card">
          <p className="text-muted">
            <Link href="/login" className="font-semibold text-blue hover:underline">
              Sign in
            </Link>{" "}
            to join the squad.
          </p>
        </div>
      ) : (
        <form className="form-card" onSubmit={(e) => void onSubmit(e)}>
          <div className="form-row">
            <label className="field-label" htmlFor="sq-name">
              Name
            </label>
            <input
              className="field"
              id="sq-name"
              name="name"
              required
              defaultValue={user.displayName || ""}
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
                placeholder="e.g. 29"
              />
            </div>
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="sq-gender">
              Gender <span className="field-hint">— however you&apos;d like it shown</span>
            </label>
            <input
              className="field"
              id="sq-gender"
              name="gender"
              required
              placeholder="e.g. she/her, he/him, they/them"
            />
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="sq-social">
              Social media link <span className="field-hint">— optional</span>
            </label>
            <input
              className="field"
              id="sq-social"
              name="socialLink"
              type="url"
              placeholder="https://instagram.com/yourname"
            />
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
              placeholder="A sentence or two about you — what brings you around, what you're into."
            />
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="sq-photo">
              Photo{" "}
              <span className="field-hint">
                — optional, JPG/PNG, compressed to ~320px
              </span>
            </label>
            <input
              id="sq-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png"
              className="block w-full text-sm text-muted"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            Send Profile
          </button>
          {status && <p className="mt-3 text-sm text-muted">{status}</p>}
        </form>
      )}
    </>
  );
}
