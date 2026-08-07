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
    <header className="mb-8 sm:mb-10">
      <span className="kicker">{kicker}</span>
      <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.15] font-bold tracking-tight text-balance text-ink">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed text-muted">
        {lede}
      </p>
    </header>
  );
}

/** Intro for a second section further down a page — same rhythm, one level down. */
export function SectionIntro({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 border-t border-border pt-10">
      <span className="kicker">{kicker}</span>
      <h2 className="font-display text-[clamp(1.6rem,3.5vw,2.1rem)] font-bold tracking-tight text-balance text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-muted">{lede}</p>
      {children}
    </div>
  );
}
