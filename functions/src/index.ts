/**
 * Midland Meetups Cloud Functions
 *
 * - sendEventReminders: daily cron that push-notifies users who RSVP'd "going"
 *   for events happening tomorrow.
 * - setAdminClaim: callable helper to grant admin custom claims (run once per organizer).
 *
 * Chat and games are intentionally not implemented.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { logger } from "firebase-functions";

initializeApp();
setGlobalOptions({ region: "us-central1" });

const db = getFirestore();

function tomorrowIso(timeZone = "America/Detroit"): string {
  // Compute "tomorrow" in the crew's local timezone (Midland, MI ≈ Detroit).
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA yields YYYY-MM-DD
  const todayParts = fmt.format(now); // local today
  const [y, m, d] = todayParts.split("-").map(Number);
  const localMidnightUtcGuess = new Date(Date.UTC(y, m - 1, d));
  localMidnightUtcGuess.setUTCDate(localMidnightUtcGuess.getUTCDate() + 1);
  const yy = localMidnightUtcGuess.getUTCFullYear();
  const mm = String(localMidnightUtcGuess.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(localMidnightUtcGuess.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export const sendEventReminders = onSchedule(
  {
    schedule: "0 9 * * *", // 9:00 every day
    timeZone: "America/Detroit",
  },
  async () => {
    const date = tomorrowIso("America/Detroit");
    logger.info(`Looking for events on ${date}`);

    const eventsSnap = await db
      .collection("events")
      .where("approved", "==", true)
      .where("date", "==", date)
      .where("status", "in", ["confirmed", "relocated", "rain-delay"])
      .get();

    if (eventsSnap.empty) {
      logger.info("No events tomorrow.");
      return;
    }

    for (const eventDoc of eventsSnap.docs) {
      const event = eventDoc.data();
      if (event.reminderSent === true) {
        logger.info(`Already reminded for ${eventDoc.id}`);
        continue;
      }

      const rsvpsSnap = await db
        .collection("rsvps")
        .where("eventId", "==", eventDoc.id)
        .where("status", "==", "going")
        .get();

      if (rsvpsSnap.empty) {
        await eventDoc.ref.update({ reminderSent: true });
        continue;
      }

      const userIds = new Set(rsvpsSnap.docs.map((d) => String(d.data().userId)));
      const tokens: string[] = [];

      // fcmTokens docs are keyed by token string
      const tokenSnap = await db.collection("fcmTokens").get();
      tokenSnap.forEach((t) => {
        const data = t.data();
        if (userIds.has(String(data.userId)) && data.token) {
          tokens.push(String(data.token));
        }
      });

      if (tokens.length === 0) {
        logger.info(`No FCM tokens for event ${eventDoc.id}`);
        await eventDoc.ref.update({ reminderSent: true });
        continue;
      }

      const title = `Tomorrow: ${event.title}`;
      const body = `${event.time} @ ${event.location}`;

      // sendEachForMulticast handles batches up to 500
      const messaging = getMessaging();
      const res = await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        webpush: {
          fcmOptions: {
            link: "/",
          },
        },
        data: {
          eventId: eventDoc.id,
          type: "event_reminder",
        },
      });

      logger.info(
        `Reminders for ${eventDoc.id}: success=${res.successCount} failure=${res.failureCount}`,
      );

      await eventDoc.ref.update({
        reminderSent: true,
        reminderSentAt: Timestamp.now(),
      });
    }
  },
);

/**
 * Grant admin custom claim. Call once from a trusted environment after
 * verifying the caller is the project owner (bootstrap via Firebase console
 * custom claims or restrict with ALLOWED_BOOTSTRAP_UIDS env).
 */
export const setAdminClaim = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const bootstrap = (process.env.ALLOWED_BOOTSTRAP_UIDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const targetUid = String(request.data?.uid || request.auth.uid);
  const callerIsBootstrap = bootstrap.includes(request.auth.uid);
  const callerIsAdmin = request.auth.token.admin === true;

  if (!callerIsBootstrap && !callerIsAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Only bootstrap or existing admins can grant admin.",
    );
  }

  await getAuth().setCustomUserClaims(targetUid, { admin: true });
  return { ok: true, uid: targetUid };
});
