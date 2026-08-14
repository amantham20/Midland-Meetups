import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border px-6 py-8 text-center text-sm text-muted">
      <p>Midland Meetups · a bulletin board for the crew · Midland, MI</p>
      <nav
        aria-label="Legal and safety"
        className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
      >
        <Link href="/privacy" className="hover:text-ink hover:underline">
          Privacy Policy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:text-ink hover:underline">
          Terms &amp; Conditions
        </Link>
        <span aria-hidden>·</span>
        <Link href="/report" className="hover:text-ink hover:underline">
          Report content or a user
        </Link>
      </nav>
    </footer>
  );
}
