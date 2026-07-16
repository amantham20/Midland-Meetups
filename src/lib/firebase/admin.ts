import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Server-only Firebase Admin. Used by Next.js Route Handlers
 * (replaces Firebase Cloud Functions — no Blaze plan required).
 *
 * Set one of:
 * - FIREBASE_SERVICE_ACCOUNT_JSON  (full service account JSON as a string)
 * - GOOGLE_APPLICATION_CREDENTIALS (path to a key file; local/dev only)
 */
function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.",
    );
  }
}

export function isAdminSdkConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );
}

function getAdminApp(): App {
  if (getApps().length) {
    return getApps()[0]!;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const sa = getServiceAccount();
  if (sa) {
    return initializeApp({
      credential: cert(sa),
      projectId: projectId || sa.projectId,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Application Default Credentials (file path or runtime SA)
    return initializeApp({ projectId: projectId || undefined });
  }

  throw new Error(
    "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON in the server environment.",
  );
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp());
}

/** Verify a Firebase ID token from Authorization: Bearer <token>. */
export async function verifyIdToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

export function parseUidList(envValue: string | undefined): string[] {
  return (envValue || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
