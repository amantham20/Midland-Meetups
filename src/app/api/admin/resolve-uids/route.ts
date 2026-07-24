import { NextResponse } from "next/server";
import {
  getAdminAuth,
  isAdminSdkConfigured,
  parseUidList,
  verifyIdToken,
} from "@/lib/firebase/admin";
import { normalizeEmail } from "@/lib/audience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/resolve-uids
 * Body: { emails: string[] }
 * Returns: { uids: Record<string, string | null> }  (normalized email → Auth uid)
 *
 * Looks up Firebase Auth users by email so squad profiles can stamp userId
 * when an admin sets email.
 */
export async function POST(request: Request) {
  if (!isAdminSdkConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server Admin SDK not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON.",
        uids: {},
      },
      { status: 503 },
    );
  }

  const decoded = await verifyIdToken(request.headers.get("authorization"));
  if (!decoded) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const bootstrap = parseUidList(
    process.env.ADMIN_BOOTSTRAP_UIDS || process.env.NEXT_PUBLIC_ADMIN_UIDS,
  );
  const callerIsBootstrap = bootstrap.includes(decoded.uid);
  const callerIsAdmin = decoded.admin === true;
  if (!callerIsBootstrap && !callerIsAdmin) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let emails: string[] = [];
  try {
    const body = (await request.json()) as { emails?: unknown };
    if (Array.isArray(body.emails)) {
      emails = body.emails.map((e) => normalizeEmail(String(e))).filter(Boolean);
    }
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const unique = Array.from(new Set(emails));
  const auth = getAdminAuth();
  const uids: Record<string, string | null> = {};

  await Promise.all(
    unique.map(async (email) => {
      try {
        const user = await auth.getUserByEmail(email);
        uids[email] = user.uid;
      } catch {
        // No Auth account for this email yet
        uids[email] = null;
      }
    }),
  );

  return NextResponse.json({ ok: true, uids });
}
