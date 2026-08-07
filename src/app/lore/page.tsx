"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader, SectionIntro } from "@/components/PageHeader";
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
          <article key={mem.id} className="card p-5 sm:p-6">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-display text-lg font-bold text-balance text-ink">
                {mem.title}
              </h2>
              <span className="text-sm text-muted">
                {mem.author} · {formatDateShort(mem.date)}
              </span>
            </div>
            <p className="leading-relaxed whitespace-pre-wrap text-ink/85">
              {mem.text}
            </p>
          </article>
        ))}
      </section>

      <SectionIntro
        kicker="Got a memory?"
        title="Add to the Letter"
        lede="Send in your story and it'll show up here once it's been approved."
      />

      {!user ? (
        <div className="form-card">
          <p className="text-muted">
            <Link href="/login?next=/lore" className="link">
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
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Sending…" : "Send memory"}
            </button>
            {status && !saving && (
              <p className="text-sm text-muted" aria-live="polite">
                {status}
              </p>
            )}
          </div>
        </form>
      )}
    </>
  );
}
