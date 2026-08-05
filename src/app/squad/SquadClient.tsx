"use client";

import { useEffect, useRef, useState } from "react";
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
import { membersContentKey, readSquadListCache } from "@/lib/photoCache";
import { resizeImageToBase64 } from "@/lib/utils";
import { SQUAD_HEADER } from "./header";
import { SquadMemberCard } from "./SquadMemberCard";
import { SquadMemberModal } from "./SquadMemberModal";
import { SquadProfileDialog, type ProfileDraft } from "./SquadProfileDialog";

/**
 * Client-only squad UI (loaded with next/dynamic ssr:false from page.tsx).
 * Avoids hydrating Firebase/session-backed member lists against empty SSR HTML.
 *
 * The board is the page: your own profile is a single summary row with one
 * Edit button, and the create/edit form only appears in a dialog on demand.
 */
export default function SquadClient() {
  const { user, configured } = useAuth();
  const toast = useToast();
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
  const [editOpen, setEditOpen] = useState(false);
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
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
    if (!isFirebaseConfigured() || !user) {
      setMyProfile(undefined);
      return;
    }
    // Reset while resolving so we never flash another account's profile.
    setMyProfile(undefined);
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

  async function compressPhoto(
    file: File | null,
  ): Promise<{ photoBase64: string; photoMimeType: string } | null> {
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

  async function saveProfile(draft: ProfileDraft) {
    if (!user) {
      toast.info("Sign in to join the squad.");
      return;
    }
    const editing = myProfile;
    if (editing) {
      // Edit only the profile matched to this sign-in email.
      const signInEmail = (user.email || "").trim().toLowerCase();
      if (!signInEmail || editing.email !== signInEmail) {
        toast.error("You can only edit the profile for your sign-in email.");
        return;
      }
    }

    setSaving(true);
    setStatus(editing ? "Saving…" : "Sending…");
    try {
      const photo = await compressPhoto(draft.photoFile);
      if (editing) {
        await updateMySquadProfile(editing.id, user.uid, {
          name: draft.name,
          occupation: draft.occupation,
          age: draft.age,
          gender: draft.gender,
          socialLink: draft.socialLink,
          bio: draft.bio,
          email: user.email || "",
          photoBase64: photo?.photoBase64,
          photoMimeType: photo?.photoMimeType,
        });
      } else {
        // Always bind profile to the signed-in account — never trust form email.
        await submitSquadMember({
          name: draft.name,
          occupation: draft.occupation,
          age: draft.age,
          gender: draft.gender,
          socialLink: draft.socialLink,
          bio: draft.bio,
          email: user.email || "",
          photoBase64: photo?.photoBase64 || "",
          photoMimeType: photo?.photoMimeType || "image/jpeg",
          userId: user.uid,
        });
      }
      toast.success(
        editing
          ? "Profile updated."
          : "Sent! Your profile is in for review and will show up once approved.",
      );
      setStatus("");
      setEditOpen(false);
      setMyProfile(await findEditableSquadProfile(user.uid, user.email));
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : editing
            ? "Couldn't save your profile. Check your connection."
            : "Something went wrong. Check your connection and try again.";
      setStatus(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function openEditor() {
    setStatus("");
    setOpenMemberId(null);
    setEditOpen(true);
  }

  if (!configured) {
    return (
      <>
        <PageHeader {...SQUAD_HEADER} />
        <ConfigNotice />
      </>
    );
  }

  const myGroups =
    myProfile || user
      ? groupsForEmail(groups, myProfile?.email || user?.email)
      : [];
  const openMember = members.find((m) => m.id === openMemberId) || null;

  return (
    <>
      <PageHeader {...SQUAD_HEADER} />

      {/* One row for everything about you: who you are, and one Edit button. */}
      <section className="mb-10" aria-label="Your profile">
        {!user ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
            <p className="text-muted">
              Sign in to add your profile and get into event groups.
            </p>
            <Link
              href="/login?next=/squad"
              className="btn-primary w-full sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        ) : myProfile === undefined ? (
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <p className="text-muted">Loading your profile…</p>
          </div>
        ) : myProfile ? (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-blue/30 bg-surface p-5 shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <SquadPhoto member={myProfile} sizeClass="h-14 w-14 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-bold text-ink">
                    {myProfile.name}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      myProfile.approved
                        ? "bg-green/15 text-green"
                        : "bg-yellow/25 text-[#8a6a12]"
                    }`}
                  >
                    {myProfile.approved ? "On the board" : "Pending review"}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {myProfile.occupation}
                  {myGroups.length > 0 && (
                    <> · Groups: {myGroups.map((g) => g.name).join(", ")}</>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openEditor}
              className="btn-primary w-full sm:w-auto"
            >
              <span className="mr-1.5">{Icons.pencil}</span> Edit profile
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
            <p className="text-muted">
              You&apos;re not on the board yet — add a photo and a couple of
              lines about you.
            </p>
            <button
              type="button"
              onClick={openEditor}
              className="btn-primary w-full sm:w-auto"
            >
              <span className="mr-1.5">{Icons.plus}</span> Join the Squad
            </button>
          </div>
        )}
      </section>

      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[clamp(1.4rem,3vw,1.75rem)] font-bold tracking-tight text-ink">
          On the board
        </h2>
        {members.length > 0 && (
          <span className="text-sm text-muted">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        )}
      </div>

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
              No profiles yet — be the first to join the squad.
            </EmptyNote>
          </div>
        )}
        {members.map((m) => (
          <SquadMemberCard
            key={m.id}
            member={m}
            isMine={Boolean(myProfile && m.id === myProfile.id)}
            onOpen={() => setOpenMemberId(m.id)}
            onEdit={openEditor}
          />
        ))}
      </section>

      {openMember && (
        <SquadMemberModal
          member={openMember}
          isMine={Boolean(myProfile && openMember.id === myProfile.id)}
          onEdit={openEditor}
          onClose={() => setOpenMemberId(null)}
        />
      )}

      {editOpen && user && (
        <SquadProfileDialog
          key={`${user.uid}-${myProfile?.id || "new"}`}
          member={myProfile || null}
          email={user.email || ""}
          defaultName={user.displayName || ""}
          saving={saving}
          status={status}
          onSubmit={(draft) => void saveProfile(draft)}
          onClose={() => {
            if (saving) return;
            setEditOpen(false);
            setStatus("");
          }}
        />
      )}
    </>
  );
}
