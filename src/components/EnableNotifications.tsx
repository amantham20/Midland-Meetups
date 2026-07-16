"use client";

import { useEffect, useState } from "react";
import { getToken } from "firebase/messaging";
import { useAuth } from "@/contexts/AuthContext";
import {
  getClientMessaging,
  getMessagingServiceWorkerRegistration,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { saveFcmToken } from "@/lib/firebase/data";

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
        setMsg("Notifications aren't available in this browser.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg(
          "Notifications were blocked. You can enable them in browser settings.",
        );
        return;
      }
      const messaging = await getClientMessaging();
      if (!messaging) {
        setMsg("Push notifications aren't supported in this browser.");
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
      if (!vapidKey) {
        setMsg(
          "VAPID key missing. Firebase Console → Project settings → Cloud Messaging → Web Push certificates → Generate key pair, then set NEXT_PUBLIC_FIREBASE_VAPID_KEY and redeploy.",
        );
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
        setMsg("Could not get a push token.");
        return;
      }
      await saveFcmToken(user!.uid, token);
      writeEnabled(user!.uid);
      setShowCta(false);
    } catch (err) {
      console.error(err);
      setMsg(
        "Couldn't enable notifications. Try again after the PWA is installed over HTTPS.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          Get a push reminder the day before events you RSVP to.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="rounded-full bg-ink px-4 py-2 font-semibold text-surface disabled:opacity-60"
        >
          {busy ? "Enabling…" : "Enable reminders"}
        </button>
      </div>
      {msg && <p className="mt-2 text-muted">{msg}</p>}
    </div>
  );
}
