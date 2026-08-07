import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface/60">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted">
        <BrandMark className="h-7 w-7 shrink-0 opacity-90" />
        <p>Midland Meetups · a bulletin board for the crew · Midland, MI</p>
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
        >
          <Link href="/privacy" className="hover:text-ink hover:underline">
            Privacy Policy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-ink hover:underline">
            Terms &amp; Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
