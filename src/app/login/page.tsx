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

  return (
    <div className="form-card max-w-md">
      <form onSubmit={(e) => void onEmail(e)}>
        {mode === "register" && (
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
          />
        </div>
        <div className="form-row">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            className="field"
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {mode === "register" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        {mode === "signin" ? (
          <>
            New here?{" "}
            <button
              type="button"
              className="font-semibold text-blue"
              onClick={() => setMode("register")}
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="font-semibold text-blue"
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
          </>
        )}
      </p>

      {error && <p className="mt-3 text-sm text-red">{error}</p>}
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
