"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { toast as toastApi, type ToastTone } from "@/lib/toast-store";
import { ToastHost } from "@/components/ToastHost";

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Mounts the global toast host (portal) and exposes useToast().
 * The real queue lives in toast-store so it works even across re-renders.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ToastContextValue>(
    () => ({
      toast: toastApi.show,
      success: toastApi.success,
      error: toastApi.error,
      info: toastApi.info,
      dismiss: toastApi.dismiss,
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback so a missing provider still shows toasts instead of crashing
    return {
      toast: toastApi.show,
      success: toastApi.success,
      error: toastApi.error,
      info: toastApi.info,
      dismiss: toastApi.dismiss,
    };
  }
  return ctx;
}

export type { ToastTone };
