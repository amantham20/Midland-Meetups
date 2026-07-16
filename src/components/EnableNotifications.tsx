"use client";

import { useState } from "react";
import { getToken } from "firebase/messaging";
import { useAuth } from "@/contexts/AuthContext";
import {
  getClientMessaging,
  getMessagingServiceWorkerRegistration,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { saveFcmToken } from "@/lib/firebase/data";

export function EnableNotifications() {
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user || !isFirebaseConfigured()) return null;

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
          "VAPID key missing. Firebase Console → Project settings → Cloud Messaging → Web Push certificates → Generate key pair, then paste it into NEXT_PUBLIC_FIREBASE_VAPID_KEY in .env.local and restart the dev server.",
        );
        return;
      }
      // Prefer the dedicated FCM SW over the next-pwa Workbox SW
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
      setMsg("Reminders enabled on this device.");
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
    <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-sm">
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
