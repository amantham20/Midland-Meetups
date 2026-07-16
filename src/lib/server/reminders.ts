import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/admin";

function tomorrowIso(timeZone = "America/Detroit"): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayParts = fmt.format(now);
  const [y, m, d] = todayParts.split("-").map(Number);
  const localMidnightUtcGuess = new Date(Date.UTC(y, m - 1, d));
  localMidnightUtcGuess.setUTCDate(localMidnightUtcGuess.getUTCDate() + 1);
  const yy = localMidnightUtcGuess.getUTCFullYear();
  const mm = String(localMidnightUtcGuess.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(localMidnightUtcGuess.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type ReminderRunResult = {
  date: string;
  eventsChecked: number;
  eventsReminded: number;
  messagesAttempted: number;
  successCount: number;
  failureCount: number;
};

/**
 * Send FCM pushes for approved events happening tomorrow (America/Detroit)
 * to users who RSVP'd "going". Same logic as the old Cloud Function.
 */
export async function runEventReminders(): Promise<ReminderRunResult> {
  const db = getAdminDb();
  const date = tomorrowIso("America/Detroit");

  const eventsSnap = await db
    .collection("events")
    .where("approved", "==", true)
    .where("date", "==", date)
    .where("status", "in", ["confirmed", "relocated", "rain-delay"])
    .get();

  let eventsReminded = 0;
  let messagesAttempted = 0;
  let successCount = 0;
  let failureCount = 0;

  if (eventsSnap.empty) {
    return {
      date,
      eventsChecked: 0,
      eventsReminded: 0,
      messagesAttempted: 0,
      successCount: 0,
      failureCount: 0,
    };
  }

  for (const eventDoc of eventsSnap.docs) {
    const event = eventDoc.data();
    if (event.reminderSent === true) continue;

    const rsvpsSnap = await db
      .collection("rsvps")
      .where("eventId", "==", eventDoc.id)
      .where("status", "==", "going")
      .get();

    if (rsvpsSnap.empty) {
      await eventDoc.ref.update({ reminderSent: true });
      continue;
    }

    const userIds = new Set(
      rsvpsSnap.docs.map((d) => String(d.data().userId)),
    );
    const tokens: string[] = [];
    const tokenSnap = await db.collection("fcmTokens").get();
    tokenSnap.forEach((t) => {
      const data = t.data();
      if (userIds.has(String(data.userId)) && data.token) {
        tokens.push(String(data.token));
      }
    });

    if (tokens.length === 0) {
      await eventDoc.ref.update({ reminderSent: true });
      continue;
    }

    const title = `Tomorrow: ${event.title}`;
    const body = `${event.time} @ ${event.location}`;
    messagesAttempted += tokens.length;

    const res = await getAdminMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        fcmOptions: { link: "/" },
      },
      data: {
        eventId: eventDoc.id,
        type: "event_reminder",
      },
    });

    successCount += res.successCount;
    failureCount += res.failureCount;
    eventsReminded += 1;

    await eventDoc.ref.update({
      reminderSent: true,
      reminderSentAt: Timestamp.now(),
    });
  }

  return {
    date,
    eventsChecked: eventsSnap.size,
    eventsReminded,
    messagesAttempted,
    successCount,
    failureCount,
  };
}
