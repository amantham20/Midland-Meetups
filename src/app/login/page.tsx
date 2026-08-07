"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { registerWithEmail, signInWithEmail } from "@/lib/firebase/auth";

function LoginForm() {
  const { configured, user, loading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!configured) {
    return <ConfigNotice />;
  }

  if (!loading && user) {
    router.replace(next);
    return <p className="text-muted">You&apos;re signed in. Redirecting…</p>;
  }

  async function onEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    const displayName = String(fd.get("displayName") || "").trim();
    try {
      if (mode === "register") {
        await registerWithEmail(email, password, displayName);
        toast.success("Account created — you're signed in.");
      } else {
        await signInWithEmail(email, password);
        toast.success("Signed in.");
      }
      router.push(next);
    } catch (err) {
      console.error(err);
      const msg =
        mode === "register"
          ? "Couldn't create that account. Use a valid email and a password of at least 6 characters."
          : "Couldn't sign in. Check your email and password.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const register = mode === "register";

  return (
    <div className="form-card max-w-md">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-border bg-surface-2 p-1">
        {(["signin", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={[
              "rounded-full px-3 py-2 text-sm font-semibold transition-colors",
              mode === m
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink",
            ].join(" ")}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {error && (
        <p className="alert alert-danger mb-5" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={(e) => void onEmail(e)}>
        {register && (
          <div className="form-row">
            <label className="field-label" htmlFor="displayName">
              Display name
            </label>
            <input
              className="field"
              id="displayName"
              name="displayName"
              required
              placeholder="What should we call you?"
            />
          </div>
        )}
        <div className="form-row">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            className="field"
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <div className="form-row">
          <label className="field-label" htmlFor="password">
            Password{" "}
            {register && (
              <span className="field-hint">— at least 6 characters</span>
            )}
          </label>
          <div className="relative">
            <input
              className="field pr-20"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete={register ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="btn btn-ghost btn-sm absolute inset-y-1 right-1"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy
              ? register
                ? "Creating account…"
                : "Signing in…"
              : register
                ? "Create account"
                : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <PageHeader
        kicker="Account"
        title="Sign in"
        lede="Use email and password. This replaces the old shared passwords for submit and other gated actions."
      />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </>
  );
}
