"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { ReportButton } from "@/components/ReportDialog";
import { PlusIcon, TrashIcon } from "@/components/Icons";
import {
  BoardCard,
  BoardCardActions,
  BoardCardHead,
  BoardFilterChips,
  BoardToolbar,
  ProgressBar,
  SignInWall,
} from "@/components/BoardUI";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  addGoalLog,
  deleteGoal,
  deleteGoalLog,
  setGoalStatus,
  subscribeGoalLogs,
  subscribeGoals,
  submitGoal,
  updateGoalDetails,
  type GoalFields,
} from "@/lib/firebase/data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import {
  byNewest,
  deadlineLabel,
  formatAmount,
  formatQuantity,
  goalProgress,
  goalStandings,
  logsByGoal,
  sortGoals,
} from "@/lib/boards";
import { accountDisplayName, formatDateShort } from "@/lib/utils";
import type { GoalLog, GroupGoal } from "@/lib/types";
import { GoalComposerDialog, LogProgressDialog, type LogFields } from "./GoalDialogs";

type Filter = "active" | "done" | "mine" | "archived" | "all";

/** Everyone's contributions, newest first, with a delete on the ones you own. */
function LogList({
  logs,
  unit,
  myUserId,
  canModerate,
  busy,
  onDelete,
}: {
  logs: GoalLog[];
  unit: string;
  myUserId: string;
  /** Admins can pull anything off a goal; members only their own. */
  canModerate: boolean;
  busy: boolean;
  onDelete: (log: GoalLog) => void;
}) {
  if (logs.length === 0) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-semibold text-muted marker:text-muted hover:text-ink">
        {logs.length} {logs.length === 1 ? "entry" : "entries"}
      </summary>
      <ul className="mt-2 space-y-1.5">
        {byNewest(logs).map((log) => (
          <li
            key={log.id}
            className="flex items-baseline gap-2 rounded-md bg-surface-2/60 px-3 py-2 text-sm"
          >
            <span className="font-semibold tabular-nums text-ink">
              {formatQuantity(log.amount, unit)}
            </span>
            <span className="min-w-0 flex-1 truncate text-muted">
              {log.name || "A member"}
              {log.note && ` — ${log.note}`}
            </span>
            {log.date && (
              <span className="shrink-0 text-xs text-muted">
                {formatDateShort(log.date)}
              </span>
            )}
            {(canModerate || log.userId === myUserId) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon h-7 w-7 shrink-0"
                aria-label="Remove this entry"
                disabled={busy}
                onClick={() => onDelete(log)}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function GoalsPage() {
  const { user, loading: authLoading, isAdmin, configured } = useAuth();
  const toast = useToast();

  const [goals, setGoals] = useState<GroupGoal[]>([]);
  const [logs, setLogs] = useState<GoalLog[]>([]);
  const [loading, setLoading] = useState(() => isFirebaseConfigured());
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("active");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<GroupGoal | null>(null);
  const [logging, setLogging] = useState<GroupGoal | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const myName = accountDisplayName(user);

  // Members-only, like the idea board — nothing is read until there's a user.
  useEffect(() => {
    if (!isFirebaseConfigured() || !user) return;
    const unsubGoals = subscribeGoals(
      (data) => {
        setGoals(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Couldn't load the goals board.");
        setLoading(false);
      },
    );
    const unsubLogs = subscribeGoalLogs(setLogs, (err) => console.error(err));
    return () => {
      unsubGoals();
      unsubLogs();
    };
  }, [user]);

  const byGoal = useMemo(() => logsByGoal(logs), [logs]);

  const counts = useMemo(() => {
    const complete = (g: GroupGoal) =>
      goalProgress(g, byGoal.get(g.id) || []).complete;
    const live = goals.filter((g) => g.status === "active");
    return {
      active: live.filter((g) => !complete(g)).length,
      done: live.filter(complete).length,
      mine: goals.filter(
        (g) =>
          g.createdBy === user?.uid ||
          (byGoal.get(g.id) || []).some((l) => l.userId === user?.uid),
      ).length,
      archived: goals.filter((g) => g.status === "archived").length,
      all: goals.length,
    };
  }, [goals, byGoal, user?.uid]);

  const shown = useMemo(() => {
    const matched = goals.filter((goal) => {
      const mine =
        goal.createdBy === user?.uid ||
        (byGoal.get(goal.id) || []).some((l) => l.userId === user?.uid);
      const complete = goalProgress(goal, byGoal.get(goal.id) || []).complete;
      if (filter === "active") return goal.status === "active" && !complete;
      if (filter === "done") return goal.status === "active" && complete;
      if (filter === "archived") return goal.status === "archived";
      if (filter === "mine") return mine;
      return true;
    });
    return sortGoals(matched, byGoal);
  }, [goals, byGoal, filter, user?.uid]);

  function canManage(goal: GroupGoal): boolean {
    return Boolean(isAdmin || (user && goal.createdBy === user.uid));
  }

  async function saveGoal(fields: GoalFields) {
    if (!user) return;
    if (!(fields.target > 0)) {
      toast.error("Give the goal a target above zero.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateGoalDetails(editing.id, fields);
        toast.success("Goal updated.");
      } else {
        await submitGoal({ ...fields, userId: user.uid, createdByName: myName });
        toast.success("Goal started. Go log something.");
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

  async function log(fields: LogFields) {
    if (!user || !logging) return;
    if (!(fields.amount > 0)) {
      toast.error("Log an amount above zero.");
      return;
    }
    setSaving(true);
    try {
      await addGoalLog({
        goalId: logging.id,
        userId: user.uid,
        name: myName,
        amount: fields.amount,
        note: fields.note,
        date: fields.date,
      });
      setLogging(null);
      toast.success(
        `Logged ${formatQuantity(fields.amount, logging.unit)}. Nice.`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Couldn't log that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLog(goal: GroupGoal, entry: GoalLog) {
    setBusyId(goal.id);
    try {
      await deleteGoalLog(entry.id);
      toast.success("Entry removed.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't remove that entry.");
    } finally {
      setBusyId(null);
    }
  }

  async function archive(goal: GroupGoal) {
    setBusyId(goal.id);
    try {
      await setGoalStatus(
        goal.id,
        goal.status === "archived" ? "active" : "archived",
      );
      toast.success(goal.status === "archived" ? "Back on." : "Archived.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update that goal.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(goal: GroupGoal) {
    const entries = (byGoal.get(goal.id) || []).length;
    if (
      !window.confirm(
        entries > 0
          ? `Delete “${goal.title}” and all ${entries} logged ${
              entries === 1 ? "entry" : "entries"
            }? Archiving keeps the record instead.`
          : `Delete “${goal.title}”? This can't be undone.`,
      )
    )
      return;
    setBusyId(goal.id);
    try {
      await deleteGoal(goal.id);
      toast.success("Goal deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete that goal.");
    } finally {
      setBusyId(null);
    }
  }

  const header = (
    <PageHeader
      kicker="Everyone's numbers, one total"
      title="Group Goals"
      lede="Pick a target and knock it down together — a marathon split between all of us, a thousand push-ups, a stack of books. Log what you do and watch the bar fill."
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
        <SignInWall what="The goals board" next="/goals" />
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
            Start a goal
          </button>
        }
      >
        <BoardFilterChips<Filter>
          label="Filter goals"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: "In progress", count: counts.active },
            { value: "done", label: "Hit", count: counts.done },
            { value: "mine", label: "Mine", count: counts.mine },
            { value: "archived", label: "Archived", count: counts.archived },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </BoardToolbar>

      {error && <EmptyNote>{error}</EmptyNote>}
      {!error && loading && <EmptyNote>Loading the board…</EmptyNote>}
      {!error && !loading && shown.length === 0 && (
        <EmptyNote>
          {filter === "active"
            ? "Nothing running right now. Start one — a group marathon is a good first."
            : "Nothing here — try another filter."}
        </EmptyNote>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((goal) => {
          const entries = byGoal.get(goal.id) || [];
          const progress = goalProgress(goal, entries);
          const standings = goalStandings(entries);
          const mine = standings.find((s) => s.userId === user.uid);
          const busy = busyId === goal.id;
          const deadline = deadlineLabel(goal.deadline);
          const overdue =
            !progress.complete && deadline.startsWith("Ended");
          return (
            <BoardCard key={goal.id} dimmed={goal.status === "archived"}>
              <BoardCardHead
                title={goal.title}
                badges={
                  <>
                    {progress.complete && (
                      <span className="badge badge-green">Target hit</span>
                    )}
                    {goal.status === "archived" && (
                      <span className="badge badge-neutral">Archived</span>
                    )}
                    {deadline && !progress.complete && (
                      <span
                        className={`badge ${overdue ? "badge-red" : "badge-amber"}`}
                      >
                        {deadline}
                      </span>
                    )}
                  </>
                }
                byline={
                  <>
                    <span>Started by {goal.createdByName || "a member"}</span>
                    {progress.contributors > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          {progress.contributors}{" "}
                          {progress.contributors === 1 ? "person" : "people"} in
                        </span>
                      </>
                    )}
                  </>
                }
              />

              <p className="whitespace-pre-wrap leading-relaxed text-ink/90">
                {goal.description}
              </p>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-lg font-bold text-ink">
                    {formatQuantity(progress.total, goal.unit)}
                    <span className="text-sm font-semibold text-muted">
                      {" "}
                      of {formatAmount(goal.target)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-muted tabular-nums">
                    {progress.complete
                      ? "Done"
                      : `${formatQuantity(progress.remaining, goal.unit)} to go`}
                  </span>
                </div>
                <ProgressBar
                  percent={progress.percent}
                  complete={progress.complete}
                  label={`${formatQuantity(progress.total, goal.unit)} of ${formatAmount(
                    goal.target,
                  )}`}
                />
              </div>

              {standings.length > 0 && (
                <p className="text-sm text-muted">
                  {standings
                    .slice(0, 3)
                    .map(
                      (s) =>
                        `${s.userId === user.uid ? "You" : s.name} ${formatQuantity(
                          s.amount,
                          goal.unit,
                        )}`,
                    )
                    .join(" · ")}
                  {standings.length > 3 &&
                    ` · +${standings.length - 3} more`}
                  {!mine && " · you haven't logged anything yet"}
                </p>
              )}

              <LogList
                logs={entries}
                unit={goal.unit}
                myUserId={user.uid}
                canModerate={canManage(goal)}
                busy={busy}
                onDelete={(entry) => void removeLog(goal, entry)}
              />

              <BoardCardActions>
                <ReportButton
                  target={{ type: "goal", id: goal.id, label: goal.title }}
                />
                {goal.status === "active" && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => setLogging(goal)}
                  >
                    Log progress
                  </button>
                )}
                {canManage(goal) && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => {
                        setEditing(goal);
                        setComposerOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => void archive(goal)}
                    >
                      {goal.status === "archived" ? "Reopen" : "Archive"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busy}
                      onClick={() => void remove(goal)}
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
        <GoalComposerDialog
          key={editing?.id || "new"}
          initial={editing ?? undefined}
          onClose={() => {
            setComposerOpen(false);
            setEditing(null);
          }}
          onSave={(fields) => void saveGoal(fields)}
          saving={saving}
        />
      )}

      {logging && (
        <LogProgressDialog
          key={logging.id}
          goal={logging}
          remaining={
            goalProgress(logging, byGoal.get(logging.id) || []).remaining
          }
          onClose={() => setLogging(null)}
          onLog={(fields) => void log(fields)}
          saving={saving}
        />
      )}
    </>
  );
}
