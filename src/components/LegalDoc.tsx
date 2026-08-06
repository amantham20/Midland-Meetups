import type { ReactNode } from "react";

export const LEGAL_CONTACT_EMAIL = "hey@amantham.com";

const linkClass = "font-semibold text-blue hover:underline";

/** Holds legal copy to a readable measure inside the page container. */
export function LegalDoc({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl pb-4">{children}</div>;
}

/**
 * A block of legal copy. The source documents lean on bold runs for headings
 * and bare <br> for spacing; `title` promotes those runs to real headings, and
 * leaving it off keeps the un-headed paragraphs in their original order.
 */
export function LegalSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 space-y-4 leading-relaxed text-ink/90">
      {title && (
        <h2 className="font-display text-xl font-bold tracking-tight text-ink">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6 marker:text-muted">{children}</ul>;
}

/** The contact address, repeated throughout both documents. */
export function LegalMail() {
  return (
    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className={linkClass}>
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}

export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  );
}

export function LegalEffectiveDate({ children }: { children: ReactNode }) {
  return (
    <p className="mt-8 rounded-md border border-border bg-surface-2/60 px-4 py-3 text-sm text-muted">
      {children}
    </p>
  );
}

/** Attribution for the generator the documents were produced with. */
export function LegalGeneratorNote({ children }: { children: ReactNode }) {
  return (
    <>
      <hr className="mt-10 border-border" />
      <p className="mt-4 text-sm text-muted">{children}</p>
    </>
  );
}
