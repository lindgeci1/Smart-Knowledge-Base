import React, { useEffect, useState, createContext, ReactNode } from "react";
import {
  apiClient,
  getJwtFromCookie,
  setJwtCookie,
  clearJwtCookie,
  decodeJWT,
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
export interface LoginTwoFactorRequired {
  requiresTwoFactor: true;
  tempToken: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithGitHub: (code: string, redirectUri: string) => Promise<void>;
  loginWithTwoFactor: (tempToken: string, code: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUserUsage: (increment: number) => void;
  updateUserLimit: (additionalLimit: number) => void;
  updateUsername: (newUsername: string) => void;
}
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

// Helper to get email from localStorage
const getStoredEmail = (): string => {
  try {
    return localStorage.getItem("user_email") || "";
  } catch {
    return "";
  }
};

// Helper to store email in localStorage
const storeEmail = (email: string): void => {
  try {
    localStorage.setItem("user_email", email);
  } catch {
    // Ignore localStorage errors
  }
};

// Helper to create user object from JWT
const createUserFromJWT = (jwt: string): User | null => {
  const decoded = decodeJWT(jwt);
  if (!decoded) return null;

  return {
    id: decoded.userId,
    email: getStoredEmail(), // Get email from localStorage
    name: decoded.username || "",
    role: decoded.role,
    usageLimit: 100,
    usageCount: 0,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize auth state from JWT cookie
  useEffect(() => {
    const initAuth = async () => {
      try {
        const jwt = getJwtFromCookie();
        if (jwt) {
          const userFromJWT = createUserFromJWT(jwt);
          if (userFromJWT) {
            setToken(jwt);
            setUser(userFromJWT);
          } else {
            // Invalid JWT, clear cookie
            clearJwtCookie();
          }
        }
      } catch (error) {
        console.error("Failed to initialize auth", error);
        clearJwtCookie();
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/login", { email, password });
      const requiresTwoFactor = response.data?.requiresTwoFactor === true;
      const tempToken = response.data?.tempToken;

      if (requiresTwoFactor && tempToken) {
        storeEmail(email);
        setIsLoading(false);
        const e = new Error("2FA required") as Error & LoginTwoFactorRequired;
        e.requiresTwoFactor = true;
        e.tempToken = tempToken;
        throw e;
      }

      const jwt = response.data?.Jwt || response.data?.jwt;
      if (!jwt) {
        throw new Error("No token received from server");
      }

      setJwtCookie(jwt);
      const userFromJWT = createUserFromJWT(jwt);
      if (!userFromJWT) {
        throw new Error("Failed to decode token");
      }
      userFromJWT.email = email;
      storeEmail(email);
      setToken(jwt);
      setUser(userFromJWT);
    } catch (error: any) {
      if (error?.requiresTwoFactor && error?.tempToken) {
        throw error;
      }
      clearJwtCookie();
      setToken(null);
      setUser(null);
      if (error.code === "ERR_NETWORK" || error.message?.includes("Network Error")) {
        throw new Error("Network Error");
      }
      if (error.response?.status === 401) {
        throw new Error("Invalid email or password");
      }
      const message = error.response?.data || error.message || "Login failed";
      throw new Error(typeof message === "string" ? message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/google", { idToken });
      const jwt = response.data?.Jwt ?? response.data?.jwt;
      const email = response.data?.email ?? "";
      if (!jwt) {
        throw new Error("No token received from server");
      }
      setJwtCookie(jwt);
      storeEmail(email);
      const userFromJWT = createUserFromJWT(jwt);
      if (!userFromJWT) {
        throw new Error("Failed to decode token");
      }
      userFromJWT.email = email;
      setToken(jwt);
      setUser(userFromJWT);
    } catch (error: any) {
      clearJwtCookie();
      setToken(null);
      setUser(null);
      if (error.code === "ERR_NETWORK" || error.message?.includes("Network Error")) {
        throw new Error("Network Error");
      }
      if (error.response?.status === 401) {
        const msg = error.response?.data ?? "Invalid Google sign-in.";
        throw new Error(typeof msg === "string" ? msg : "Invalid Google sign-in. Please try again.");
      }
      const message = error.response?.data ?? error.message ?? "Google sign-in failed";
      throw new Error(typeof message === "string" ? message : "Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGitHub = async (code: string, redirectUri: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/github", { code, redirectUri });
      const jwt = response.data?.Jwt ?? response.data?.jwt;
      const email = response.data?.email ?? "";
      if (!jwt) {
        throw new Error("No token received from server");
      }
      setJwtCookie(jwt);
      storeEmail(email);
      const userFromJWT = createUserFromJWT(jwt);
      if (!userFromJWT) {
        throw new Error("Failed to decode token");
      }
      userFromJWT.email = email;
      setToken(jwt);
      setUser(userFromJWT);
    } catch (error: any) {
      clearJwtCookie();
      setToken(null);
      setUser(null);
      if (error.code === "ERR_NETWORK" || error.message?.includes("Network Error")) {
        throw new Error("Network Error");
      }
      if (error.response?.status === 401) {
        const msg = error.response?.data ?? "Invalid GitHub sign-in.";
        throw new Error(typeof msg === "string" ? msg : "Invalid GitHub sign-in. Please try again.");
      }
      const message = error.response?.data ?? error.message ?? "GitHub sign-in failed";
      throw new Error(typeof message === "string" ? message : "GitHub sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithTwoFactor = async (tempToken: string, code: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/2fa/verify-login", {
        tempToken,
        code: code.trim(),
      });
      const jwt = response.data?.Jwt || response.data?.jwt;
      if (!jwt) {
        throw new Error("No token received from server");
      }
      setJwtCookie(jwt);
      const userFromJWT = createUserFromJWT(jwt);
      if (!userFromJWT) {
        throw new Error("Failed to decode token");
      }
      setToken(jwt);
      setUser(userFromJWT);
    } catch (error: any) {
      clearJwtCookie();
      setToken(null);
      setUser(null);
      if (error.code === "ERR_NETWORK" || error.message?.includes("Network Error")) {
        throw new Error("Network Error");
      }
      if (error.response?.status === 401) {
        const msg = error.response?.data?.message ?? error.response?.data ?? "Invalid code.";
        throw new Error(typeof msg === "string" ? msg : "Invalid code. Please try again.");
      }
      const message = error.response?.data?.message ?? error.response?.data ?? error.message ?? "Verification failed";
      throw new Error(typeof message === "string" ? message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    username: string,
    password: string
  ) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/register", {
        email,
        username,
        password,
      });

      // After registration, automatically login
      await login(email, password);
    } catch (error: any) {
      clearJwtCookie();
      setToken(null);
      setUser(null);

      // Check for network errors
      if (
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network Error")
      ) {
        throw new Error("Network Error");
      }

      // Other errors
      const message =
        error.response?.data || error.message || "Registration failed";
      throw new Error(
        typeof message === "string" ? message : "Failed to create account"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout API to clean up refresh token
      await apiClient.post("/auth/logout");
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore logout errors - cleanup anyway
      await new Promise(resolve => setTimeout(resolve, 100));
    } finally {
      // Clear local state
      clearJwtCookie();
      localStorage.removeItem("user_email"); // Clear stored email
      setUser(null);
      setToken(null);
    }
  };
  const updateUserUsage = (increment: number) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      usageCount: user.usageCount + increment,
    };
    setUser(updatedUser);
  };

  const updateUserLimit = (additionalLimit: number) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      usageLimit: user.usageLimit + additionalLimit,
    };
    setUser(updatedUser);
  };

  const updateUsername = (newUsername: string) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      name: newUsername,
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
        loginWithGoogle,
        loginWithGitHub,
        loginWithTwoFactor,
        register,
        logout,
        updateUserUsage,
        updateUserLimit,
        updateUsername,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
