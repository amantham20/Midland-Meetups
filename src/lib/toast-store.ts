export type ToastTone = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type Listener = () => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

const DURATION: Record<ToastTone, number> = {
  success: 5000,
  error: 6500,
  info: 4000,
};

function emit() {
  listeners.forEach((l) => l());
}

export function getToasts(): ToastItem[] {
  return toasts;
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: string) {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function showToast(message: string, tone: ToastTone = "info") {
  if (typeof window === "undefined") return;
  const text = String(message || "").trim();
  if (!text) return;

  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  toasts = [...toasts.slice(-4), { id, message: text, tone }];
  emit();

  window.setTimeout(() => dismissToast(id), DURATION[tone]);
}

export const toast = {
  show: showToast,
  success: (message: string) => showToast(message, "success"),
  error: (message: string) => showToast(message, "error"),
  info: (message: string) => showToast(message, "info"),
  dismiss: dismissToast,
};
