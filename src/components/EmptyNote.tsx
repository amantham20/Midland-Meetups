export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-surface-2/60 px-5 py-8 text-center text-muted">
      {children}
    </p>
  );
}
