import { AlertIcon } from "./Icons";

export function ConfigNotice() {
  return (
    <div className="card flex max-w-2xl items-start gap-4 p-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-yellow/20 text-yellow-ink">
        <AlertIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold text-ink">
          Connect Firebase
        </h2>
        <p className="mt-2 text-muted">
          Copy{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-ink">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-ink">
            .env.local
          </code>{" "}
          and fill in your Firebase web app keys. See the README for the full
          setup walkthrough.
        </p>
      </div>
    </div>
  );
}
