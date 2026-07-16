import { NextResponse } from "next/server";
import {
  getAdminAuth,
  isAdminSdkConfigured,
  parseUidList,
  verifyIdToken,
} from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/claim
 * Body: { uid?: string }  — defaults to the caller's UID
 *
 * Replaces the Firebase `setAdminClaim` Cloud Function.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON on the server.
 * Caller must be in ADMIN_BOOTSTRAP_UIDS (or NEXT_PUBLIC_ADMIN_UIDS) or already have admin claim.
 */
export async function POST(request: Request) {
  if (!isAdminSdkConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server Admin SDK not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON (service account key JSON).",
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
    return NextResponse.json(
      {
        error:
          "Only bootstrap UIDs or existing admins can grant the admin claim.",
      },
      { status: 403 },
    );
  }

  let targetUid = decoded.uid;
  try {
    const body = (await request.json().catch(() => ({}))) as { uid?: string };
    if (body.uid) targetUid = String(body.uid);
  } catch {
    // empty body is fine
  }

  await getAdminAuth().setCustomUserClaims(targetUid, { admin: true });

  return NextResponse.json({ ok: true, uid: targetUid });
}
