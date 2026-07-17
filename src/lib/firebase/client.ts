import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Copy .env.example to .env.local and fill in your project keys.",
    );
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let authPersistenceReady: Promise<Auth> | null = null;

/**
 * Auth with browser local persistence so sessions survive restarts
 * (paired with a 100-day sliding activity window in AuthContext).
 */
export function getClientAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  if (typeof window !== "undefined" && !authPersistenceReady) {
    authPersistenceReady = setPersistence(auth, browserLocalPersistence)
      .then(() => auth)
      .catch((err) => {
        console.warn("Could not set auth persistence", err);
        return auth;
      });
  }
  return auth;
}

/** Await this after first paint if you need persistence guaranteed. */
export function ensureAuthPersistence(): Promise<Auth> {
  const auth = getClientAuth();
  return authPersistenceReady || Promise.resolve(auth);
}

/**
 * Firestore with multi-tab persistent local cache so squad base64 (and other
 * docs) are served from IndexedDB after the first load instead of re-hit every time.
 */
export function getClientDb(): Firestore {
  const app = getFirebaseApp();
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Already initialized in this JS context (HMR / second call)
    return getFirestore(app);
  }
}

export async function getClientMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(getFirebaseApp());
}

/**
 * FCM needs its own service worker registration (separate from next-pwa Workbox).
 */
export async function getMessagingServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (err) {
    console.warn("Could not register FCM service worker", err);
    return null;
  }
}
