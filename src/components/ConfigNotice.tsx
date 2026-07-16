export function ConfigNotice() {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold text-ink">Connect Firebase</h2>
      <p className="mt-2 text-muted">
        Copy <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm">.env.example</code>{" "}
        to{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm">.env.local</code>{" "}
        and fill in your Firebase web app keys. See the README for the full setup walkthrough.
      </p>
    </div>
  );
}
