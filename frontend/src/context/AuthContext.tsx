import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest } from "../data/api";

export type UserRole = "client" | "vendeur" | "admin";
export type User = { id: string; name: string; email: string; role: UserRole; status?: "en attente" | "validé" | "refusé"; storeName?: string };
type ApiUser = { id: string; name: string; email: string; role: "CLIENT" | "SELLER" | "ADMIN"; sellerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null; store?: { name: string } | null };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string;
  retrySession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role: Exclude<UserRole, "admin">, storeName?: string) => Promise<User>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(user: ApiUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "ADMIN" ? "admin" : user.role === "SELLER" ? "vendeur" : "client",
    ...(user.sellerStatus ? { status: user.sellerStatus === "APPROVED" ? "validé" as const : user.sellerStatus === "REJECTED" ? "refusé" as const : "en attente" as const } : {}),
    ...(user.store ? { storeName: user.store.name } : {}),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const retrySession = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await apiRequest<ApiUser>("/auth/me");
      setUser(mapUser(currentUser));
      setError("");
    } catch (reason: unknown) {
      if (reason instanceof ApiError && reason.status === 401) {
        setUser(null);
        setError("");
      } else {
        setError(reason instanceof Error ? reason.message : "Impossible de vérifier la session.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void retrySession();
  }, [retrySession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    retrySession,
    signIn: async (email, password) => {
      const result = await apiRequest<{ user: ApiUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const next = mapUser(result.user);
      setUser(next);
      setError("");
      return next;
    },
    register: async (name, email, password, role, storeName) => {
      const result = await apiRequest<{ user: ApiUser }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          role: role === "vendeur" ? "SELLER" : "CLIENT",
          ...(role === "vendeur" ? { storeName } : {}),
        }),
      });
      const next = mapUser(result.user);
      setUser(next);
      setError("");
      return next;
    },
    signOut: async () => {
      await apiRequest<{ success: true }>("/auth/logout", { method: "POST" });
      setUser(null);
    },
  }), [user, loading, error, retrySession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
}
