import { NextResponse } from "next/server";
import { isAdminSdkConfigured } from "@/lib/firebase/admin";
import { runEventReminders } from "@/lib/server/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET|POST /api/cron/reminders
 *
 * Replaces the Firebase scheduled function `sendEventReminders`.
 * Protect with CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret).
 *
 * Schedule with:
 * - Vercel Cron (vercel.json)
 * - Any external cron (cron-job.org, GitHub Actions, etc.) hitting this URL daily ~9am Detroit
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const header = request.headers.get("x-cron-secret");
  if (header === secret) return true;

  // Vercel Cron can pass ?secret= for simple setups (optional)
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("secret") === secret) return true;
  } catch {
    // ignore
  }

  return false;
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set on the server." },
      { status: 503 },
    );
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminSdkConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server Admin SDK not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await runEventReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Event reminders failed", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Reminder job failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
