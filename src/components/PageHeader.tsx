export function PageHeader({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="mb-8">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        {kicker}
      </div>
      <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-tight text-ink">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed text-muted">{lede}</p>
    </div>
  );
}
