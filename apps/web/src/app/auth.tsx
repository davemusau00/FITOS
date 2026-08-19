import { createContext, useContext, type PropsWithChildren } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthMeResponse } from "@fitos/contracts";
import { api, ApiClientError } from "../lib/api/client";

interface AuthContextValue {
  auth: AuthMeResponse | null;
  isLoading: boolean;
  signIn(input: { email: string; password: string }): Promise<AuthMeResponse>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const authKey = ["auth", "me"] as const;

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: authKey,
    queryFn: api.me,
    retry: false,
    staleTime: 60_000
  });
  const auth = query.data ?? null;
  const isUnauthenticated = query.error instanceof ApiClientError && query.error.status === 401;
  const value: AuthContextValue = {
    auth,
    isLoading: query.isLoading,
    async signIn(input) {
      const session = await api.login(input);
      queryClient.setQueryData(authKey, session);
      return session;
    },
    async signOut() {
      await api.logout();
      queryClient.clear();
    }
  };
  return <AuthContext.Provider value={{ ...value, auth: isUnauthenticated ? null : auth }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}

export function can(auth: AuthMeResponse | null, permission: string): boolean {
  return Boolean(auth?.permissions.includes(permission as never));
}
