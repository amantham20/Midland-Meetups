"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type ToastItem,
  type ToastTone,
} from "@/lib/toast-store";

const TONE_BG: Record<ToastTone, string> = {
  success: "#12b76a",
  error: "#e5484d",
  info: "#14181f",
};

function ToastCard({ item }: { item: ToastItem }) {
  return (
    <div
      role="status"
      data-toast={item.tone}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        width: "min(420px, calc(100vw - 32px))",
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.18)",
        background: TONE_BG[item.tone],
        color: "#ffffff",
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.4,
        boxShadow: "0 12px 40px rgba(20,24,31,0.28)",
        pointerEvents: "auto",
      }}
    >
      <span style={{ flex: 1 }}>{item.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissToast(item.id)}
        style={{
          border: "none",
          background: "transparent",
          color: "rgba(255,255,255,0.85)",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        ×
      </button>
    </div>
  );
}

function subscribeNothing() {
  return () => {};
}

/** Stable server snapshot — inline `() => []` creates a new array every call and loops. */
const EMPTY_TOASTS: ToastItem[] = [];
const getServerToasts = () => EMPTY_TOASTS;
const getClientTrue = () => true;
const getServerFalse = () => false;

/**
 * Renders toasts into document.body via portal so layout/z-index never hide them.
 */
export function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
  // false on server, true on client — avoids hydration mismatch for portal
  const isClient = useSyncExternalStore(
    subscribeNothing,
    getClientTrue,
    getServerFalse,
  );

  if (!isClient || toasts.length === 0 || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      id="mm-toast-root"
      aria-live="polite"
      aria-relevant="additions"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 24,
        zIndex: 2147483646,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "0 16px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>,
    document.body,
  );
}
