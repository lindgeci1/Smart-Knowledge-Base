import React, { useEffect, useState, createContext, ReactNode } from "react";
import {
  decodeJwt,
  getJwtFromCookie,
  loginRequest,
  logoutRequest,
  registerRequest,
} from "../lib/authClient";

// Types
export type UserRole = "admin" | "user";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  usageLimit: number;
  usageCount: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUserUsage: (increment: number) => void;
  updateUserLimit: (additionalLimit: number) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

// Helper to construct a User object from JWT + optional stored user/email/name
function buildUserFromToken(
  jwt: string,
  storedUser?: Partial<User> | null,
  fallbackEmail?: string,
  fallbackName?: string
): User {
  const payload = decodeJwt(jwt) || {};
  const userId = (payload.userId as string) || storedUser?.id || "";
  const rawRole =
    (payload[
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
    ] as string) || "";

  const role: UserRole = rawRole === "1" ? "admin" : "user";

  const email = storedUser?.email || fallbackEmail || "";
  const baseName =
    storedUser?.name || fallbackName || (email ? email.split("@")[0] : "User");

  return {
    id: userId,
    email,
    name: baseName.charAt(0).toUpperCase() + baseName.slice(1),
    role,
    usageLimit: storedUser?.usageLimit ?? 100,
    usageCount: storedUser?.usageCount ?? 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize auth state from JWT cookie only (no localStorage)
  useEffect(() => {
    const initAuth = () => {
      try {
        const jwt = getJwtFromCookie();

        if (jwt) {
          const userFromToken = buildUserFromToken(jwt);
          setToken(jwt);
          setUser(userFromToken);
        } else {
          setUser(null);
          setToken(null);
        }
      } catch (error) {
        console.error("Failed to initialize auth state", error);
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { jwt } = await loginRequest(email, password);
      if (!jwt) {
        throw new Error("Missing token from login response");
      }

      const storedUserStr =
        typeof window !== "undefined"
          ? window.localStorage.getItem("auth_user")
          : null;
      const storedUser = storedUserStr
        ? (JSON.parse(storedUserStr) as Partial<User>)
        : null;

      const userFromToken = buildUserFromToken(
        jwt,
        storedUser ?? undefined,
        email
      );
      setUser(userFromToken);
      setToken(jwt);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("auth_token", jwt);
        window.localStorage.setItem("auth_user", JSON.stringify(userFromToken));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    _name: string,
    email: string,
    password: string,
    _role: UserRole
  ) => {
    // Backend controls role assignment (first user = admin (1), others = user (2))
    setIsLoading(true);
    try {
      await registerRequest(email, password);
      // Do NOT log user in automatically – mirror Razor pages (they go to login after register)
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setToken(null);
      setIsLoading(false);
    }
  };

  const updateUserUsage = (increment: number) => {
    if (!user) return;
    const updatedUser: User = {
      ...user,
      usageCount: user.usageCount + increment,
    };
    setUser(updatedUser);
  };

  const updateUserLimit = (additionalLimit: number) => {
    if (!user) return;
    const updatedUser: User = {
      ...user,
      usageLimit: user.usageLimit + additionalLimit,
    };
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUserUsage,
        updateUserLimit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
