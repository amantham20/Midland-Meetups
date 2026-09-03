"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { ReportButton } from "@/components/ReportDialog";
import { CheckIcon, PlusIcon, SparkIcon } from "@/components/Icons";
import {
  BoardCard,
  BoardCardActions,
  BoardCardHead,
  BoardFilterChips,
  BoardToolbar,
  PersonList,
  SignInWall,
} from "@/components/BoardUI";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  deleteIdea,
  scheduleIdeaAsEvent,
  setIdeaInterest,
  setIdeaStatus,
  subscribeGroups,
  subscribeIdeaVotes,
  subscribeIdeas,
  submitIdea,
  updateIdea,
  type IdeaFields,
} from "@/lib/firebase/data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { groupsForEmail } from "@/lib/audience";
import { sortIdeas, votesByIdea, type IdeaSort } from "@/lib/boards";
import { accountDisplayName, formatTimeDisplay } from "@/lib/utils";
import type { AudienceGroup, EventIdea, IdeaVote } from "@/lib/types";
import { IdeaComposerDialog, ScheduleIdeaDialog, type ScheduleFields } from "./IdeaDialogs";

type Filter = "open" | "planned" | "mine" | "all";

export default function IdeasPage() {
  const { user, loading: authLoading, isAdmin, configured } = useAuth();
  const toast = useToast();

  const [ideas, setIdeas] = useState<EventIdea[]>([]);
  const [votes, setVotes] = useState<IdeaVote[]>([]);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [loading, setLoading] = useState(() => isFirebaseConfigured());
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("open");
  const [sort, setSort] = useState<IdeaSort>("wanted");

  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<EventIdea | null>(null);
  const [scheduling, setScheduling] = useState<EventIdea | null>(null);
  const [saving, setSaving] = useState(false);
  /** Id of the idea whose row is mid-write, so only its buttons go quiet. */
  const [busyId, setBusyId] = useState<string | null>(null);

  const myName = accountDisplayName(user);

  // Both collections are members-only, so nothing is read until there's a user.
  useEffect(() => {
    if (!isFirebaseConfigured() || !user) return;
    const unsubIdeas = subscribeIdeas(
      (data) => {
        setIdeas(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Couldn't load the idea board.");
        setLoading(false);
      },
    );
    const unsubVotes = subscribeIdeaVotes(setVotes, (err) => console.error(err));
    const unsubGroups = subscribeGroups(setGroups, (err) => console.error(err));
    return () => {
      unsubIdeas();
      unsubVotes();
      unsubGroups();
    };
  }, [user]);

  const interest = useMemo(() => votesByIdea(votes), [votes]);
  const myGroups = useMemo(
    () => groupsForEmail(groups, user?.email),
    [groups, user?.email],
  );

  const counts = useMemo(
    () => ({
      open: ideas.filter((i) => i.status === "open").length,
      planned: ideas.filter((i) => i.status === "planned").length,
      mine: ideas.filter((i) => i.createdBy === user?.uid).length,
      all: ideas.length,
    }),
    [ideas, user?.uid],
  );

  const shown = useMemo(() => {
    const matched = ideas.filter((idea) => {
      if (filter === "open") return idea.status === "open";
      if (filter === "planned") return idea.status === "planned";
      if (filter === "mine") return idea.createdBy === user?.uid;
      return true;
    });
    return sortIdeas(matched, interest, sort);
  }, [ideas, filter, sort, interest, user?.uid]);

  function canManage(idea: EventIdea): boolean {
    return Boolean(isAdmin || (user && idea.createdBy === user.uid));
  }

  async function saveIdea(fields: IdeaFields) {
    if (!user) return;
    setSaving(true);
    try {
      if (editing) {
        await updateIdea(editing.id, fields);
        toast.success("Idea updated.");
      } else {
        await submitIdea({ ...fields, proposedBy: myName, userId: user.uid });
        toast.success("Posted. See who bites.");
      }
      setComposerOpen(false);
      setEditing(null);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleInterest(idea: EventIdea, interested: boolean) {
    if (!user) return;
    setBusyId(idea.id);
    try {
      await setIdeaInterest({
        ideaId: idea.id,
        userId: user.uid,
        name: myName,
        interested,
      });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't register that. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function schedule(fields: ScheduleFields) {
    if (!user || !scheduling) return;
    if (!fields.host) {
      toast.error("Add a host name before sending this one in.");
      return;
    }
    setSaving(true);
    try {
      await scheduleIdeaAsEvent({
        ideaId: scheduling.id,
        title: fields.title,
        host: fields.host,
        hostUserId: fields.hostUserId,
        date: fields.date,
        time: fields.time ? formatTimeDisplay(fields.time) : fields.time,
        location: fields.location,
        description: fields.description,
        userId: user.uid,
        tags: fields.tags,
      });
      setScheduling(null);
      // The idea leaves the Open filter the moment it's scheduled, so follow it
      // over rather than letting the card blink out of the list.
      setFilter("planned");
      toast.success(
        "Sent to the organizers — it lands on Happenings once approved.",
      );
    } catch (err) {
      console.error(err);
      toast.error("Couldn't schedule that one. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function park(idea: EventIdea) {
    setBusyId(idea.id);
    try {
      await setIdeaStatus(idea.id, idea.status === "parked" ? "open" : "parked");
      toast.success(idea.status === "parked" ? "Back on the board." : "Parked.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update that idea.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(idea: EventIdea) {
    if (
      !window.confirm(`Delete “${idea.title}”? This can't be undone.`)
    )
      return;
    setBusyId(idea.id);
    try {
      await deleteIdea(idea.id);
      toast.success("Idea deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete that idea.");
    } finally {
      setBusyId(null);
    }
  }

  const header = (
    <PageHeader
      kicker="Nothing's on the calendar yet"
      title="Idea Board"
      lede="Where events start. Pitch something you'd want to do, back the ones you'd show up for, and when an idea has enough takers, put a date on it."
    />
  );

  if (!configured) {
    return (
      <>
        {header}
        <ConfigNotice />
      </>
    );
  }

  if (authLoading) {
    return (
      <>
        {header}
        <p className="text-muted">Checking sign-in…</p>
      </>
    );
  }

  if (!user) {
    return (
      <>
        {header}
        <SignInWall what="The idea board" next="/ideas" />
      </>
    );
  }

  return (
    <>
      {header}

      <BoardToolbar
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setComposerOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" />
            Post an idea
          </button>
        }
      >
        <BoardFilterChips<Filter>
          label="Filter ideas"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open", count: counts.open },
            { value: "planned", label: "Scheduled", count: counts.planned },
            { value: "mine", label: "Mine", count: counts.mine },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
        <BoardFilterChips<IdeaSort>
          label="Sort ideas"
          value={sort}
          onChange={setSort}
          options={[
            { value: "wanted", label: "Most wanted" },
            { value: "newest", label: "Newest" },
          ]}
        />
      </BoardToolbar>

      {error && <EmptyNote>{error}</EmptyNote>}
      {!error && loading && <EmptyNote>Loading the board…</EmptyNote>}
      {!error && !loading && shown.length === 0 && (
        <EmptyNote>
          {filter === "open"
            ? "No open ideas right now. Post the first one."
            : "Nothing here — try another filter."}
        </EmptyNote>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((idea) => {
          const backers = interest.get(idea.id) || [];
          const mine = backers.some((v) => v.userId === user.uid);
          const busy = busyId === idea.id;
          const manageable = canManage(idea);
          return (
            <BoardCard key={idea.id} dimmed={idea.status === "parked"}>
              <BoardCardHead
                title={idea.title}
                badges={
                  <>
                    {idea.status === "planned" && (
                      <span className="badge badge-green">Scheduled</span>
                    )}
                    {idea.status === "parked" && (
                      <span className="badge badge-neutral">Parked</span>
                    )}
                  </>
                }
                byline={
                  <>
                    <span>{idea.proposedBy || "A member"}</span>
                    {idea.timeframe && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{idea.timeframe}</span>
                      </>
                    )}
                  </>
                }
              />

              <p className="whitespace-pre-wrap leading-relaxed text-ink/90">
                {idea.pitch}
              </p>

              {idea.status === "planned" && (
                <p className="rounded-md border border-green/25 bg-green/8 px-3.5 py-2.5 text-sm text-green-ink">
                  On its way — it shows up on{" "}
                  <Link href="/" className="font-semibold underline">
                    Happenings
                  </Link>{" "}
                  once an organizer approves it.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="button"
                  className={`btn btn-sm ${mine ? "btn-soft" : "btn-secondary"}`}
                  disabled={busy}
                  aria-pressed={mine}
                  onClick={() => void toggleInterest(idea, !mine)}
                >
                  {mine ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <SparkIcon className="h-4 w-4" />
                  )}
                  {mine ? "You're in" : "I'd go"}
                  <span className="tabular-nums">· {backers.length}</span>
                </button>
                <PersonList
                  names={backers
                    .filter((v) => v.userId !== user.uid)
                    .map((v) => v.name || "A member")}
                  includesYou={mine}
                  empty="No takers yet."
                />
              </div>

              <BoardCardActions>
                <ReportButton
                  target={{ type: "idea", id: idea.id, label: idea.title }}
                />
                {/* The rules let any member schedule an *open* idea; moving a
                    parked one back into play is the author's call. */}
                {(idea.status === "open" ||
                  (idea.status === "parked" && manageable)) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => setScheduling(idea)}
                  >
                    Put a date on it
                  </button>
                )}
                {manageable && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => {
                        setEditing(idea);
                        setComposerOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    {idea.status !== "planned" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => void park(idea)}
                      >
                        {idea.status === "parked" ? "Unpark" : "Park it"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busy}
                      onClick={() => void remove(idea)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </BoardCardActions>
            </BoardCard>
          );
        })}
      </div>

      {composerOpen && (
        <IdeaComposerDialog
          key={editing?.id || "new"}
          initial={editing ?? undefined}
          onClose={() => {
            setComposerOpen(false);
            setEditing(null);
          }}
          onSave={(fields) => void saveIdea(fields)}
          saving={saving}
        />
      )}

      {scheduling && (
        <ScheduleIdeaDialog
          key={scheduling.id}
          idea={scheduling}
          myName={myName}
          myUserId={user.uid}
          myGroups={myGroups}
          onClose={() => setScheduling(null)}
          onSchedule={(fields) => void schedule(fields)}
          saving={saving}
        />
      )}
    </>
  );
}
