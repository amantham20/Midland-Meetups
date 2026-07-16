"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { EmptyNote } from "@/components/EmptyNote";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  submitMemory,
  subscribeApprovedMemories,
} from "@/lib/firebase/data";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { Memory } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

export default function LorePage() {
  const { user, configured } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(() => isFirebaseConfigured());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return subscribeApprovedMemories(
      (data) => {
        setEntries(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Couldn't load the archive.");
        setLoading(false);
      },
    );
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      setStatus("Sign in to send a memory.");
      toast.info("Sign in to send a memory.");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setStatus("Sending…");
    try {
      await submitMemory({
        title: String(fd.get("title") || "").trim(),
        author: String(fd.get("author") || "").trim(),
        text: String(fd.get("text") || "").trim(),
        userId: user.uid,
      });
      form.reset();
      const msg =
        "Sent! Your story is in for review and will show up once approved.";
      setStatus(msg);
      toast.success(msg);
    } catch (err) {
      console.error(err);
      const msg = "Something went wrong. Check your connection and try again.";
      setStatus(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!configured) {
    return (
      <>
        <PageHeader
          kicker="Volume whatever, issue whenever"
          title="The Lore Letter"
          lede="The stories that get retold at the next event."
        />
        <ConfigNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker="Volume whatever, issue whenever"
        title="The Lore Letter"
        lede="The stories that get retold at the next event. Canoe disasters, pie controversies, the dog that got loose — if it happened at a Mixer event, it belongs here."
      />

      <section className="mb-14 space-y-4" aria-label="Memories">
        {loading && <EmptyNote>Loading the archive…</EmptyNote>}
        {error && <EmptyNote>{error}</EmptyNote>}
        {!loading && !error && entries.length === 0 && (
          <EmptyNote>No memories posted yet. Be the first!</EmptyNote>
        )}
        {entries.map((mem) => (
          <article
            key={mem.id}
            className="rounded-lg border border-border bg-surface p-5 shadow-sm"
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-ink">
                {mem.title}
              </h2>
              <span className="text-sm text-muted">
                {mem.author} · {formatDateShort(mem.date)}
              </span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-ink/90">
              {mem.text}
            </p>
          </article>
        ))}
      </section>

      <div className="mb-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Got a memory?
        </div>
        <h2 className="font-display text-[clamp(1.7rem,3.5vw,2.2rem)] font-bold tracking-tight">
          Add to the Letter
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Send in your story and it&apos;ll show up here once it&apos;s been approved.
        </p>
      </div>

      {!user ? (
        <div className="form-card">
          <p className="text-muted">
            <Link href="/login" className="font-semibold text-blue hover:underline">
              Sign in
            </Link>{" "}
            to submit a memory.
          </p>
        </div>
      ) : (
        <form className="form-card" onSubmit={(e) => void onSubmit(e)}>
          <div className="form-row">
            <label className="field-label" htmlFor="mem-title">
              Title
            </label>
            <input
              className="field"
              id="mem-title"
              name="title"
              required
              placeholder="e.g. The Great Canoe Mishap"
            />
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="mem-author">
              Your name
            </label>
            <input
              className="field"
              id="mem-author"
              name="author"
              required
              defaultValue={user.displayName || ""}
              placeholder="Who's telling it"
            />
          </div>
          <div className="form-row">
            <label className="field-label" htmlFor="mem-text">
              What happened
            </label>
            <textarea
              className="field min-h-[140px]"
              id="mem-text"
              name="text"
              required
              placeholder="Tell it like you would at the next event."
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            Send Memory
          </button>
          {status && <p className="mt-3 text-sm text-muted">{status}</p>}
        </form>
      )}
    </>
  );
}
