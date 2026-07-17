"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { Icons } from "@/components/Icons";
import { SquadPhoto } from "@/components/SquadPhoto";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  findEditableSquadProfile,
  submitSquadMember,
  subscribeApprovedSquad,
  subscribeGroups,
  updateMySquadProfile,
} from "@/lib/firebase/data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { AudienceGroup, SquadMember } from "@/lib/types";
import { groupsForEmail } from "@/lib/audience";
import {
  membersContentKey,
  readSquadListCache,
} from "@/lib/photoCache";
import { resizeImageToBase64 } from "@/lib/utils";

export default function SquadPage() {
  const { user, configured } = useAuth();
  const toast = useToast();
  // Keep SSR + first client paint identical — sessionStorage is client-only and
  // must not seed useState (that caused article vs col-span-full hydration mismatches).
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [loading, setLoading] = useState(() => isFirebaseConfigured());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  /** undefined = not loaded yet; null = no profile; object = editable profile */
  const [myProfile, setMyProfile] = useState<SquadMember | null | undefined>(
    undefined,
  );
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    // Apply list cache after mount so hydration stays in sync with the server.
    const cached = readSquadListCache<SquadMember[]>();
    if (cached?.length) {
      lastKeyRef.current = membersContentKey(cached);
      setMembers(cached);
      setLoading(false);
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
        setError((prev) =>
          lastKeyRef.current || readSquadListCache()
            ? prev
            : "Couldn't load the squad.",
        );
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) return;
    let cancelled = false;
    void findEditableSquadProfile(user.uid, user.email)
      .then((p) => {
        if (!cancelled) setMyProfile(p);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setMyProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) return;
    return subscribeGroups(setGroups, (err) => console.error(err));
  }, [user]);

  async function readPhoto(
    form: HTMLFormElement,
  ): Promise<{ photoBase64: string; photoMimeType: string } | null> {
    const file = (form.elements.namedItem("photo") as HTMLInputElement)
      ?.files?.[0];
    if (!file) return null;
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      throw new Error("That photo needs to be a JPG or PNG.");
    }
    setStatus("Compressing photo…");
    const compressed = await resizeImageToBase64(file, 320, 0.72);
    return {
      photoBase64: compressed.base64,
      photoMimeType: compressed.mimeType,
    };
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      toast.info("Sign in to join the squad.");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setStatus("Sending…");
    try {
      const photo = await readPhoto(form);
      await submitSquadMember({
        name: String(fd.get("name") || "").trim(),
        occupation: String(fd.get("occupation") || "").trim(),
        age: String(fd.get("age") || "").trim(),
        gender: String(fd.get("gender") || "").trim(),
        socialLink: String(fd.get("socialLink") || "").trim(),
        bio: String(fd.get("bio") || "").trim(),
        email: String(fd.get("email") || user.email || "").trim(),
        photoBase64: photo?.photoBase64 || "",
        photoMimeType: photo?.photoMimeType || "image/jpeg",
        userId: user.uid,
      });
      form.reset();
      const msg =
        "Sent! Your profile is in for review and will show up once approved.";
      setStatus(msg);
      toast.success(msg);
      const p = await findEditableSquadProfile(user.uid, user.email);
      setMyProfile(p);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Check your connection and try again.";
      setStatus(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !myProfile) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setStatus("Saving…");
    try {
      const photo = await readPhoto(form);
      await updateMySquadProfile(myProfile.id, user.uid, {
        name: String(fd.get("name") || "").trim(),
        occupation: String(fd.get("occupation") || "").trim(),
        age: String(fd.get("age") || "").trim(),
        gender: String(fd.get("gender") || "").trim(),
        socialLink: String(fd.get("socialLink") || "").trim(),
        bio: String(fd.get("bio") || "").trim(),
        email: String(fd.get("email") || user.email || "").trim(),
        photoBase64: photo?.photoBase64,
        photoMimeType: photo?.photoMimeType,
      });
      const msg = "Profile updated.";
      setStatus(msg);
      toast.success(msg);
      const p = await findEditableSquadProfile(user.uid, user.email);
      setMyProfile(p);
      // clear file input only
      const photoInput = form.elements.namedItem("photo") as HTMLInputElement;
      if (photoInput) photoInput.value = "";
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't save your profile. Check your connection.";
      setStatus(message);
      toast.error(message);
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

  const myGroups =
    myProfile || user
      ? groupsForEmail(groups, myProfile?.email || user?.email)
      : [];

  return (
    <>
      <PageHeader
        kicker="Who's in it"
        title="The Squad"
        lede="The people who show up. Sign in to join or edit your profile. Email links you to audience groups for private events."
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
          Your profile
        </div>
        <h2 className="font-display text-[clamp(1.7rem,3.5vw,2.2rem)] font-bold tracking-tight">
          {myProfile ? "Edit your profile" : "Join the Squad"}
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          {myProfile
            ? myProfile.approved
              ? "Update your details anytime. Keep your email current so you stay in the right event groups."
              : "Your profile is waiting for approval — you can still edit it. It will appear on the board once approved."
            : "Tell us a bit about yourself. A photo is optional. Use the same email as your account so admins can connect you to audience groups."}
        </p>
        {myProfile && myGroups.length > 0 && (
          <p className="mt-2 text-sm font-semibold text-blue">
            Your groups: {myGroups.map((g) => g.name).join(", ")}
          </p>
        )}
      </div>

      {!user ? (
        <div className="form-card">
          <p className="text-muted">
            <Link
              href="/login?next=/squad"
              className="font-semibold text-blue hover:underline"
            >
              Sign in
            </Link>{" "}
            to join or edit your squad profile.
          </p>
        </div>
      ) : myProfile === undefined ? (
        <EmptyNote>Loading your profile…</EmptyNote>
      ) : (
        <form
          className="form-card"
          key={myProfile?.id || "new"}
          onSubmit={(e) => void (myProfile ? onUpdate(e) : onCreate(e))}
        >
          <div className="form-row">
            <label className="field-label" htmlFor="sq-name">
              Name
            </label>
            <input
              className="field"
              id="sq-name"
              name="name"
              required
              defaultValue={myProfile?.name || user.displayName || ""}
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
                defaultValue={myProfile?.occupation || ""}
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
                defaultValue={myProfile?.age || ""}
                placeholder="e.g. 29"
              />
            </div>
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="sq-gender">
              Gender{" "}
              <span className="field-hint">— however you&apos;d like it shown</span>
            </label>
            <input
              className="field"
              id="sq-gender"
              name="gender"
              required
              defaultValue={myProfile?.gender || ""}
              placeholder="e.g. she/her, he/him, they/them"
            />
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="sq-email">
              Email{" "}
              <span className="field-hint">
                — must match your sign-in email to claim an existing profile
              </span>
            </label>
            <input
              className="field"
              id="sq-email"
              name="email"
              type="email"
              required
              defaultValue={
                myProfile?.email || user.email || ""
              }
              placeholder="you@example.com"
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
              defaultValue={myProfile?.socialLink || ""}
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
              defaultValue={myProfile?.bio || ""}
              placeholder="A sentence or two about you — what brings you around, what you're into."
            />
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="sq-photo">
              Photo{" "}
              <span className="field-hint">
                — {myProfile ? "optional, leave empty to keep current" : "optional"},
                JPG/PNG
              </span>
            </label>
            {myProfile && (
              <div className="mb-2">
                <SquadPhoto member={myProfile} sizeClass="h-20 w-20" />
              </div>
            )}
            <input
              id="sq-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png"
              className="block w-full text-sm text-muted"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? myProfile
                ? "Saving…"
                : "Sending…"
              : myProfile
                ? "Save profile"
                : "Send Profile"}
          </button>
          {status && <p className="mt-3 text-sm text-muted">{status}</p>}
        </form>
      )}
    </>
  );
}
