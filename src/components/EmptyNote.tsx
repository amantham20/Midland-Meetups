export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-surface-2/60 px-6 py-10 text-center text-[0.95rem] leading-relaxed text-muted">
      {children}
    </p>
  );
}
