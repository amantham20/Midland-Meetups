"use client";

import { useEffect, useRef } from "react";
import { Icons } from "@/components/Icons";

/**
 * Shared dialog chrome for the squad screens (view profile / edit profile).
 * Handles Escape, backdrop click, scroll lock and focus restore so the two
 * squad modals stay consistent without repeating the plumbing.
 */
export function ModalShell({
  titleId,
  title,
  onClose,
  children,
  footer,
  widthClass = "max-w-lg",
}: {
  titleId: string;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-[90vh] w-full ${widthClass} flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg outline-none`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <h2
            id={titleId}
            className="font-display text-xl font-bold leading-snug text-ink"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-full p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            {Icons.close}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="border-t border-border bg-surface-2/40 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
