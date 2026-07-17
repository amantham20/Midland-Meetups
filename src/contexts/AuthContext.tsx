"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  ensureAuthPersistence,
  getClientAuth,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import {
  clearAuthSession,
  isAuthSessionValid,
  touchAuthSession,
} from "@/lib/authSession";
import { isAdminUid } from "@/lib/utils";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True if UID is listed in NEXT_PUBLIC_ADMIN_UIDS (nav / UI only). */
  isAdminListed: boolean;
  /** True if Firebase ID token has `admin: true` custom claim (real write access). */
  hasAdminClaim: boolean;
  /** UI admin access: listed UID and/or custom claim. */
  isAdmin: boolean;
  configured: boolean;
  /** Force-refresh ID token claims (e.g. after setAdminClaim). */
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdminListed: false,
  hasAdminClaim: false,
  isAdmin: false,
  configured: false,
  refreshClaims: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  const [loading, setLoading] = useState(configured);

  const loadClaims = useCallback(async (u: User | null, forceRefresh = false) => {
    if (!u) {
      setHasAdminClaim(false);
      return;
    }
    try {
      const result = await u.getIdTokenResult(forceRefresh);
      setHasAdminClaim(result.claims.admin === true);
    } catch (err) {
      console.error(err);
      setHasAdminClaim(false);
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    let unsub = () => {};

    void (async () => {
      await ensureAuthPersistence();
      unsub = onAuthStateChanged(getClientAuth(), (u) => {
        void (async () => {
          if (u) {
            // Sliding 100-day activity window
            if (!isAuthSessionValid()) {
              clearAuthSession();
              try {
                await getClientAuth().signOut();
              } catch (err) {
                console.error(err);
              }
              setUser(null);
              setHasAdminClaim(false);
              setLoading(false);
              return;
            }
            touchAuthSession();
            // Refresh ID token so refresh-token keeps the session warm
            try {
              await u.getIdToken(false);
            } catch {
              // ignore; next request may reauth
            }
          } else {
            clearAuthSession();
          }
          setUser(u);
          await loadClaims(u);
          setLoading(false);
        })();
      });
    })();

    return () => unsub();
  }, [configured, loadClaims]);

  // Keep session warm while the tab is open / focused
  useEffect(() => {
    if (!user) return;
    const bump = () => touchAuthSession();
    const onFocus = () => {
      touchAuthSession();
      void user.getIdToken(false).catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("pointerdown", bump);
    // Bump once a day while the tab stays open
    const interval = window.setInterval(bump, 24 * 60 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pointerdown", bump);
      window.clearInterval(interval);
    };
  }, [user]);

  const refreshClaims = useCallback(async () => {
    const current = getClientAuth().currentUser;
    if (!current) {
      setHasAdminClaim(false);
      return;
    }
    touchAuthSession();
    await loadClaims(current, true);
  }, [loadClaims]);

  const isAdminListed = isAdminUid(user?.uid);
  const isAdmin = isAdminListed || hasAdminClaim;

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdminListed,
      hasAdminClaim,
      isAdmin,
      configured,
      refreshClaims,
    }),
    [
      user,
      loading,
      isAdminListed,
      hasAdminClaim,
      isAdmin,
      configured,
      refreshClaims,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
