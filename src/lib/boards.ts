/**
 * Tallies for the two member boards.
 *
 * Both boards keep their counts off the parent document: an idea's interest is
 * the set of `ideaVotes` pointing at it, a goal's progress is the sum of its
 * `goalLogs`. Nothing to keep in sync, and the same shape as `rsvps` — the
 * whole collection is subscribed once and added up here.
 */

import type { EventIdea, GoalLog, GroupGoal, IdeaVote } from "./types";
import { todayIso } from "./utils";

/** Groups any `{ <key>: string }` row by that key, preserving order. */
function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

export function votesByIdea(votes: IdeaVote[]): Map<string, IdeaVote[]> {
  return groupBy(votes, (v) => v.ideaId);
}

export function logsByGoal(logs: GoalLog[]): Map<string, GoalLog[]> {
  return groupBy(logs, (l) => l.goalId);
}

/** Newest first. Docs still awaiting their server timestamp sort to the top. */
export function byNewest<T extends { createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (!a.createdAt) return -1;
    if (!b.createdAt) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export type IdeaSort = "wanted" | "newest";

/** Most wanted first, newest breaking the tie — or straight newest. */
export function sortIdeas(
  ideas: EventIdea[],
  votes: Map<string, IdeaVote[]>,
  mode: IdeaSort,
): EventIdea[] {
  const newest = byNewest(ideas);
  if (mode === "newest") return newest;
  return newest.sort(
    (a, b) => (votes.get(b.id)?.length || 0) - (votes.get(a.id)?.length || 0),
  );
}

export interface GoalProgress {
  /** Everything logged against the goal so far, in its unit. */
  total: number;
  /** 0–100, clamped, for the bar width. */
  percent: number;
  /** How much is left; 0 once the target is met. */
  remaining: number;
  complete: boolean;
  /** How many people have logged anything. */
  contributors: number;
}

export function goalProgress(goal: GroupGoal, logs: GoalLog[]): GoalProgress {
  const total = logs.reduce((sum, l) => sum + (l.amount || 0), 0);
  const target = goal.target > 0 ? goal.target : 0;
  const percent = target ? Math.min(100, (total / target) * 100) : 0;
  return {
    total,
    percent,
    remaining: Math.max(0, target - total),
    complete: target > 0 && total >= target,
    contributors: new Set(logs.map((l) => l.userId)).size,
  };
}

/**
 * Board order for goals: what still needs people first, soonest deadline
 * first inside that, then newest. Finished and archived goals sink.
 */
export function sortGoals(
  goals: GroupGoal[],
  logs: Map<string, GoalLog[]>,
): GroupGoal[] {
  const done = (g: GroupGoal) =>
    g.status === "archived" ||
    goalProgress(g, logs.get(g.id) || []).complete;
  return byNewest(goals).sort((a, b) => {
    const rank = Number(done(a)) - Number(done(b));
    if (rank !== 0) return rank;
    // A goal with a deadline is more urgent than one without.
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });
}

export interface GoalStanding {
  userId: string;
  name: string;
  amount: number;
}

/** Who's put in what, biggest contribution first. */
export function goalStandings(logs: GoalLog[]): GoalStanding[] {
  const totals = new Map<string, GoalStanding>();
  for (const log of logs) {
    const current = totals.get(log.userId);
    if (current) {
      current.amount += log.amount || 0;
      // A member who renamed their account keeps the name on their latest log.
      if (log.name) current.name = log.name;
    } else {
      totals.set(log.userId, {
        userId: log.userId,
        name: log.name || "A member",
        amount: log.amount || 0,
      });
    }
  }
  return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
}

/**
 * Trim trailing zeros so 26.2 stays 26.2 and 100.0 reads as 100 — targets are
 * typed by hand and end up mixing whole numbers with decimals.
 */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatQuantity(value: number, unit: string): string {
  const amount = formatAmount(value);
  return unit ? `${amount} ${unit}` : amount;
}

/** Whole days from today to `iso`; negative once it's past. null for "". */
export function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const target = new Date(iso + "T00:00:00");
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(todayIso() + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "3 days left" / "Due today" / "Ended 2 days ago" — "" when open-ended. */
export function deadlineLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days === null) return "";
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  if (days > 1) return `${days} days left`;
  if (days === -1) return "Ended yesterday";
  return `Ended ${Math.abs(days)} days ago`;
}

/**
 * A starting point for a new goal, so the first one anybody writes isn't from a
 * blank box. "Group marathon" is the one this board was built for: 26.2 miles
 * split between everyone who shows up.
 */
export interface GoalPreset {
  label: string;
  title: string;
  description: string;
  unit: string;
  target: number;
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    label: "Group marathon",
    title: "Group marathon",
    description:
      "26.2 miles, split between all of us. Run it, walk it, treadmill it — log whatever you cover and we finish the distance together.",
    unit: "miles",
    target: 26.2,
  },
  {
    label: "Century ride",
    title: "Group century ride",
    description: "100 miles on bikes between everyone. Log your rides as you go.",
    unit: "miles",
    target: 100,
  },
  {
    label: "1,000 push-ups",
    title: "1,000 push-ups",
    description: "Everybody chips in reps until the group hits a thousand.",
    unit: "push-ups",
    target: 1000,
  },
  {
    label: "Book stack",
    title: "Read 12 books between us",
    description: "One shelf, all of us. Log a book when you finish it.",
    unit: "books",
    target: 12,
  },
  {
    label: "Trail cleanup",
    title: "Fill 25 bags on the Rail Trail",
    description: "Bring gloves. Log a bag each time you fill one.",
    unit: "bags",
    target: 25,
  },
];
