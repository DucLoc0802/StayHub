"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/services";
import { User } from "@/lib/types";

interface AuthContextValue {
  user?: User;
  loading: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const router = useRouter();
  const hasToken =
    typeof window !== "undefined" &&
    Boolean(localStorage.getItem("stayhub_token"));
  const query = useQuery({
    queryKey: ["me"],
    queryFn: authService.me,
    enabled: hasToken,
    retry: false,
  });
  const setSession = (token: string, user: User) => {
    localStorage.setItem("stayhub_token", token);
    client.setQueryData(["me"], user);
  };
  const logout = () => {
    localStorage.removeItem("stayhub_token");
    client.setQueryData(["me"], undefined);
    client.clear();
    router.push("/");
  };
  return (
    <AuthContext.Provider
      value={{ user: query.data, loading: query.isLoading, setSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
