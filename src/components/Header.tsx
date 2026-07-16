"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { BrandMark } from "./BrandMark";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/firebase/auth";

const NAV = [
  { href: "/", label: "Happenings", match: (p: string) => p === "/" },
  { href: "/rsvps", label: "RSVPs", match: (p: string) => p.startsWith("/rsvps") },
  {
    href: "/lore",
    label: "The Lore Letter",
    match: (p: string) => p.startsWith("/lore"),
  },
  {
    href: "/squad",
    label: "The Squad",
    match: (p: string) => p.startsWith("/squad"),
  },
  {
    href: "/submit",
    label: "Submit an Event",
    match: (p: string) => p.startsWith("/submit"),
    cta: true,
  },
];

function linkClass(active: boolean, cta?: boolean) {
  return [
    "rounded-full px-3.5 py-2.5 text-[0.92rem] font-semibold no-underline transition-colors",
    cta
      ? active
        ? "bg-blue-ink text-white"
        : "bg-blue text-white hover:bg-blue-ink"
      : active
        ? "bg-ink text-white"
        : "text-muted hover:bg-surface-2 hover:text-ink",
  ].join(" ");
}

export function Header() {
  const pathname = usePathname();
  const { user, loading, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const navId = useId();

  // Close on Escape + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function toggleMenu() {
    setOpen((v) => !v);
  }

  const authControls = !loading &&
    (user ? (
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          void signOut();
        }}
        className={linkClass(false)}
        title={user.email || user.displayName || "Signed in"}
      >
        Sign out
      </button>
    ) : (
      <Link
        href="/login"
        onClick={() => setOpen(false)}
        className={linkClass(pathname.startsWith("/login"))}
      >
        Sign in
      </Link>
    ));

  const links = (
    <>
      {NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={linkClass(active, item.cta)}
          >
            {item.label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          onClick={() => setOpen(false)}
          aria-current={pathname.startsWith("/admin") ? "page" : undefined}
          className={linkClass(pathname.startsWith("/admin"))}
        >
          Admin
        </Link>
      )}
      {authControls}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/86 backdrop-blur-[10px]">
      <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-6 py-4">
        <Link
          href="/"
          className="mr-auto flex min-w-0 items-center gap-3 text-ink no-underline"
          onClick={() => setOpen(false)}
        >
          <BrandMark />
          <span className="truncate font-display text-[1.3rem] font-bold tracking-tight">
            Midland Meetups
          </span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 md:flex"
        >
          {links}
        </nav>

        {/* Mobile hamburger — high z-index + touch-manipulation so taps always hit */}
        <button
          type="button"
          className="relative z-[60] -mr-1 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-sm border-[1.5px] border-border bg-surface text-ink md:hidden"
          aria-expanded={open}
          aria-controls={navId}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          onClick={toggleMenu}
        >
          {open ? (
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu — in-flow under the bar (not absolute under a squeezed flex row) */}
      {open && (
        <>
          {/* Scrim: tap outside to close */}
          <button
            type="button"
            className="fixed inset-0 z-40 bg-ink/25 md:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav
            id={navId}
            aria-label="Primary"
            className="relative z-50 border-t border-border bg-surface px-4 py-3 shadow-md md:hidden"
          >
            <div className="mx-auto flex max-w-[1180px] flex-col gap-1">
              {links}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
