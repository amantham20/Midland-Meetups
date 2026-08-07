"use client";

import { useEffect, useState } from "react";
import { getToken } from "firebase/messaging";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  getClientMessaging,
  getMessagingServiceWorkerRegistration,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { saveFcmToken } from "@/lib/firebase/data";
import { BellIcon } from "./Icons";

const storageKey = (uid: string) => `mm-fcm-enabled:${uid}`;

function readEnabled(uid: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey(uid)) === "1";
  } catch {
    return false;
  }
}

function writeEnabled(uid: string) {
  try {
    localStorage.setItem(storageKey(uid), "1");
  } catch {
    // private mode / quota
  }
}

export function EnableNotifications() {
  const { user } = useAuth();
  const toast = useToast();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // Start hidden to avoid flash; reveal only if this user still needs the CTA
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      return;
    }

    let cancelled = false;

    async function resolve() {
      if (readEnabled(user!.uid)) {
        return; // stay hidden
      }

      // Permission already granted — refresh token quietly and stay hidden
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim()
      ) {
        try {
          const messaging = await getClientMessaging();
          if (messaging) {
            const registration =
              (await getMessagingServiceWorkerRegistration()) ||
              (await navigator.serviceWorker.ready);
            const token = await getToken(messaging, {
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!.trim(),
              serviceWorkerRegistration: registration,
            });
            if (token) {
              await saveFcmToken(user!.uid, token);
              writeEnabled(user!.uid);
              return;
            }
          }
        } catch (err) {
          console.error(err);
        }
      }

      if (!cancelled) setShowCta(true);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !isFirebaseConfigured() || !showCta) return null;

  async function enable() {
    setBusy(true);
    setMsg("");
    try {
      if (typeof Notification === "undefined") {
        const m = "Notifications aren't available in this browser.";
        setMsg(m);
        toast.error(m);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        const m =
          "Notifications were blocked. You can enable them in browser settings.";
        setMsg(m);
        toast.info(m);
        return;
      }
      const messaging = await getClientMessaging();
      if (!messaging) {
        const m = "Push notifications aren't supported in this browser.";
        setMsg(m);
        toast.error(m);
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
      if (!vapidKey) {
        const m = "VAPID key is not configured on this deployment.";
        setMsg(m);
        toast.error(m);
        return;
      }
      const registration =
        (await getMessagingServiceWorkerRegistration()) ||
        (await navigator.serviceWorker.ready);
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) {
        const m = "Could not get a push token.";
        setMsg(m);
        toast.error(m);
        return;
      }
      await saveFcmToken(user!.uid, token);
      writeEnabled(user!.uid);
      setShowCta(false);
      toast.success("Reminders enabled on this device.");
    } catch (err) {
      console.error(err);
      const m =
        "Couldn't enable notifications. Try again after the PWA is installed over HTTPS.";
      setMsg(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mb-8 p-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue/10 text-blue">
          <BellIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            Turn on event reminders
          </p>
          <p className="text-sm text-muted">
            Get a push the day before events you RSVP to.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="btn btn-primary"
        >
          {busy ? "Enabling…" : "Enable reminders"}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
    </div>
  );
}
