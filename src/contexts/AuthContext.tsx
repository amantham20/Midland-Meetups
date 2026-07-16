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
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";
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
  // If Firebase isn't configured, there's nothing to wait for.
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
    const unsub = onAuthStateChanged(getClientAuth(), (u) => {
      setUser(u);
      void loadClaims(u).finally(() => setLoading(false));
    });
    return unsub;
  }, [configured, loadClaims]);

  const refreshClaims = useCallback(async () => {
    const current = getClientAuth().currentUser;
    if (!current) {
      setHasAdminClaim(false);
      return;
    }
    await loadClaims(current, true);
  }, [loadClaims]);

  const isAdminListed = isAdminUid(user?.uid);
  // Show Admin nav/page if either path grants access so organizers can finish bootstrap.
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
